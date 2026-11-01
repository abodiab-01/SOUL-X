// Telegram Bot Service (Long-polling & Auto Web App Button)
// Runs automatically when TELEGRAM_BOT_TOKEN is present in process.env
import { spawn, execSync } from 'child_process';
import fs from 'fs';

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
    };
    chat: {
      id: number;
      type: string;
      first_name?: string;
      username?: string;
    };
    text?: string;
    date: number;
  };
}

export class TelegramBotService {
  private botToken: string;
  private appUrl: string;
  private isRunning: boolean = false;
  private offset: number = 0;
  private botInfo: any = null;
  private tunnelProcess: any = null;

  constructor(botToken: string, appUrl: string) {
    this.botToken = botToken;
    this.appUrl = appUrl;
  }

  public getAppUrl(): string {
    return this.appUrl;
  }

  public isTunnelRunning(): boolean {
    return !!this.tunnelProcess && !this.tunnelProcess.killed;
  }

  // Ensures a public HTTPS URL that bypasses Google login and works in Telegram WebApp
  private async ensurePublicUrl(): Promise<string> {
    // If a custom public domain is provided (and not private dev cloud run or localhost)
    if (
      this.appUrl &&
      !this.appUrl.includes('ais-dev-') &&
      !this.appUrl.includes('localhost') &&
      !this.appUrl.includes('127.0.0.1') &&
      this.appUrl.startsWith('https://')
    ) {
      return this.appUrl;
    }

    console.log('[Telegram Bot] Initializing public HTTPS tunnel for Telegram Web App (bypasses Google login)...');

    let binaryPath = fs.existsSync('./cloudflared')
      ? './cloudflared'
      : fs.existsSync('/tmp/cloudflared')
      ? '/tmp/cloudflared'
      : null;

    if (!binaryPath) {
      console.log('[Telegram Bot] cloudflared binary not found, auto-downloading...');
      try {
        execSync(
          'curl -L -s https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /tmp/cloudflared && chmod +x /tmp/cloudflared',
          { timeout: 30000 }
        );
        binaryPath = '/tmp/cloudflared';
      } catch (err: any) {
        console.warn('[Telegram Bot] Auto-download of cloudflared failed:', err.message);
      }
    }

    if (!binaryPath) {
      console.warn('[Telegram Bot] cloudflared binary not found, using fallback URL:', this.appUrl);
      return this.appUrl;
    }

    return new Promise((resolve) => {
      try {
        const proc = spawn(binaryPath, [
          'tunnel',
          '--url',
          'http://127.0.0.1:3000',
          '--no-autoupdate',
        ]);
        this.tunnelProcess = proc;

        let resolved = false;

        const handleData = (chunk: any) => {
          const str = chunk.toString();
          const match = str.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
          if (match) {
            const publicUrl = match[0];
            if (this.appUrl !== publicUrl) {
              this.appUrl = publicUrl;
              console.log(`[Telegram Bot] 🌐 Public WebApp Tunnel Active: ${publicUrl}`);
              // Automatically configure Bot Menu Button with the verified public URL
              this.setMenuButton();
            }
            if (!resolved) {
              resolved = true;
              // Short warm-up delay to ensure Cloudflare edge routing is ready
              setTimeout(() => {
                resolve(publicUrl);
              }, 1200);
            }
          }
        };

        proc.stderr.on('data', handleData);
        proc.stdout.on('data', handleData);

        proc.on('error', (err) => {
          console.error('[Telegram Bot] Tunnel error:', err.message);
          if (!resolved) {
            resolved = true;
            resolve(this.appUrl);
          }
        });

        proc.on('exit', (code) => {
          console.warn(`[Telegram Bot] Tunnel process exited with code ${code}`);
          if (this.isRunning) {
            console.log('[Telegram Bot] Restarting tunnel in 3 seconds...');
            setTimeout(() => {
              if (this.isRunning) this.ensurePublicUrl();
            }, 3000);
          }
        });

        // Timeout fallback
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            console.log('[Telegram Bot] Tunnel init timeout, proceeding with current URL');
            resolve(this.appUrl);
          }
        }, 12000);
      } catch (err: any) {
        console.error('[Telegram Bot] Could not launch tunnel:', err.message);
        resolve(this.appUrl);
      }
    });
  }

  public async start() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      // 1. Verify Bot Token
      const res = await fetch(`https://api.telegram.org/bot${this.botToken}/getMe`);
      const data = await res.json();

      if (!data.ok) {
        console.error('[Telegram Bot] Authentication failed:', data.description);
        this.isRunning = false;
        return;
      }

      this.botInfo = data.result;
      console.log(
        `[Telegram Bot] Successfully authenticated as @${this.botInfo.username} (${this.botInfo.first_name})`
      );

      // 2. Establish public HTTPS URL that bypasses Google Auth
      await this.ensurePublicUrl();

      // 3. Set Bot Menu Button with Public Web App URL
      await this.setMenuButton();

      // 4. Register Bot Commands (/start and /app)
      try {
        await fetch(`https://api.telegram.org/bot${this.botToken}/setMyCommands`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            commands: [
              { command: 'start', description: 'بدء الاستخدام وفتح تطبيق Soul-X' },
              { command: 'app', description: 'فتح تطبيق Soul-X داخل تيليجرام' },
            ],
          }),
        });
      } catch {
        // ignore
      }

      // 5. Start Long Polling
      this.pollUpdates();
    } catch (err: any) {
      console.error('[Telegram Bot] Failed to initialize bot:', err.message);
      this.isRunning = false;
    }
  }

  public stop() {
    this.isRunning = false;
    if (this.tunnelProcess) {
      try {
        this.tunnelProcess.kill();
      } catch {
        // ignore
      }
    }
    console.log('[Telegram Bot] Stopped bot polling.');
  }

  public async setMenuButton() {
    try {
      const payload = {
        menu_button: {
          type: 'web_app',
          text: '✨ Soul-X App',
          web_app: {
            url: this.appUrl,
          },
        },
      };

      const res = await fetch(
        `https://api.telegram.org/bot${this.botToken}/setChatMenuButton`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      const result = await res.json();
      if (result.ok) {
        console.log(`[Telegram Bot] ✅ Web App menu button configured with Public URL: ${this.appUrl}`);
      } else {
        console.warn('[Telegram Bot] Could not set menu button:', result.description);
      }
    } catch (err: any) {
      console.warn('[Telegram Bot] setMenuButton error:', err.message);
    }
  }

  private async pollUpdates() {
    console.log('[Telegram Bot] Long-polling active. Waiting for messages...');

    while (this.isRunning) {
      try {
        const url = `https://api.telegram.org/bot${this.botToken}/getUpdates?offset=${this.offset}&timeout=25&allowed_updates=["message"]`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.ok && Array.isArray(data.result)) {
          for (const update of data.result as TelegramUpdate[]) {
            this.offset = update.update_id + 1;
            if (update.message) {
              await this.handleMessage(update.message);
            }
          }
        } else if (!data.ok) {
          console.warn('[Telegram Bot] Polling returned error:', data.description);
          await new Promise((r) => setTimeout(r, 5000));
        }
      } catch {
        await new Promise((r) => setTimeout(r, 4000));
      }
    }
  }

  private async handleMessage(msg: TelegramUpdate['message']) {
    if (!msg || !msg.chat) return;

    const chatId = msg.chat.id;
    const user = msg.from;
    const senderName = user?.first_name || 'صديقي';
    const text = msg.text || '';

    console.log(`[Telegram Bot] Received message from ${senderName} (ID: ${user?.id}): "${text}"`);

    // Welcoming response with SINGLE Web App button pointing directly to appUrl (no telegram params passed)
    const replyText =
      `مرحباً بك يا ${senderName} في *Soul-X* ✨\n\n` +
      `منصة الشات والتعارف وتوافق الأرواح — تواصل حقيقي ولقاءات صادقة.\n\n` +
      `اضغط على الزر أدناه لفتح التطبيق وتسجيل الدخول بالبريد الإلكتروني:`;

    const payload = {
      chat_id: chatId,
      text: replyText,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '🌟 فتح تطبيق Soul-X',
              web_app: {
                url: this.appUrl,
              },
            },
          ],
        ],
      },
    };

    try {
      await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err: any) {
      console.error('[Telegram Bot] Failed to send message:', err.message);
    }
  }
}
