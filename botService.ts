// Telegram Bot Service (Long-polling & Dynamic Auto Web App Button)
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
  private abortController: AbortController | null = null;
  private lastConfiguredUrl: string | null = null;

  constructor(botToken: string, appUrl: string) {
    this.botToken = botToken;
    this.appUrl = appUrl.trim().replace(/\/$/, '');
  }

  public getAppUrl(): string {
    return this.appUrl;
  }

  public isTunnelRunning(): boolean {
    return !!this.tunnelProcess && !this.tunnelProcess.killed;
  }

  // Dynamically update the Web App URL at runtime and auto-sync with Telegram
  public async updateAppUrl(newUrl: string, force: boolean = false): Promise<boolean> {
    if (!newUrl || typeof newUrl !== 'string') return false;
    const cleanUrl = newUrl.trim().replace(/\/$/, '');
    if (!cleanUrl.startsWith('https://') && !cleanUrl.startsWith('http://')) {
      return false;
    }

    // If active Cloudflare tunnel is running, don't overwrite with private or localhost unless forced
    if (
      this.appUrl.includes('trycloudflare.com') &&
      !cleanUrl.includes('trycloudflare.com') &&
      !force
    ) {
      return false;
    }

    if (this.appUrl !== cleanUrl || this.lastConfiguredUrl !== cleanUrl) {
      console.log(`[Telegram Bot] 🔄 Dynamically auto-updating Web App URL to: ${cleanUrl}`);
      this.appUrl = cleanUrl;
      await this.setMenuButton();
      return true;
    }
    return false;
  }

  // Ensures a public HTTPS URL that bypasses Google login and works in Telegram WebApp
  private async ensurePublicUrl(): Promise<string> {
    // If a custom public domain is provided
    if (
      this.appUrl &&
      !this.appUrl.includes('localhost') &&
      !this.appUrl.includes('127.0.0.1') &&
      this.appUrl.startsWith('https://')
    ) {
      // Still start tunnel in background if on cloud run to provide no-login access, but return immediately
      this.launchTunnelInBackground();
      return this.appUrl;
    }

    console.log('[Telegram Bot] Initializing public HTTPS tunnel in background...');
    this.launchTunnelInBackground();
    return this.appUrl;
  }

  // Launch Cloudflare tunnel non-blockingly so bot polling starts immediately
  private launchTunnelInBackground() {
    if (this.tunnelProcess && !this.tunnelProcess.killed) return;

    let binaryPath = fs.existsSync('./cloudflared')
      ? './cloudflared'
      : fs.existsSync('/tmp/cloudflared')
      ? '/tmp/cloudflared'
      : null;

    if (!binaryPath) {
      try {
        console.log('[Telegram Bot] Downloading cloudflared for direct Telegram tunnel...');
        execSync(
          'curl -L -s https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /tmp/cloudflared && chmod +x /tmp/cloudflared',
          { timeout: 25000 }
        );
        binaryPath = '/tmp/cloudflared';
      } catch (err: any) {
        console.warn('[Telegram Bot] cloudflared download skipped:', err.message);
      }
    }

    if (!binaryPath) {
      console.log('[Telegram Bot] Using active dynamic URL fallback:', this.appUrl);
      return;
    }

    try {
      const proc = spawn(binaryPath, [
        'tunnel',
        '--url',
        'http://127.0.0.1:3000',
        '--no-autoupdate',
      ]);
      this.tunnelProcess = proc;

      const handleData = (chunk: any) => {
        const str = chunk.toString();
        const match = str.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
        if (match) {
          const publicUrl = match[0];
          console.log(`[Telegram Bot] 🌐 Public Tunnel Generated: ${publicUrl}`);
          this.updateAppUrl(publicUrl, true);
        }
      };

      proc.stderr.on('data', handleData);
      proc.stdout.on('data', handleData);

      proc.on('error', (err) => {
        console.warn('[Telegram Bot] Tunnel process error:', err.message);
      });

      proc.on('exit', (code) => {
        if (this.isRunning) {
          console.log(`[Telegram Bot] Tunnel process ended (${code}), will retry in 5s...`);
          setTimeout(() => {
            if (this.isRunning) this.launchTunnelInBackground();
          }, 5000);
        }
      });
    } catch (err: any) {
      console.warn('[Telegram Bot] Could not launch tunnel:', err.message);
    }
  }

  public async start() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      // 1. Verify Bot Token with Telegram
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

      // 2. Establish / Start Dynamic Tunnel
      await this.ensurePublicUrl();

      // 3. Set Bot Menu Button dynamically
      await this.setMenuButton();

      // 4. Register Bot Commands (/start, /app, /url)
      try {
        await fetch(`https://api.telegram.org/bot${this.botToken}/setMyCommands`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            commands: [
              { command: 'start', description: 'بدء الاستخدام وفتح تطبيق Soul-X' },
              { command: 'app', description: 'فتح تطبيق Soul-X داخل تيليجرام مباشرة' },
              { command: 'url', description: 'عرض الرابط الديناميكي الفعال للتطبيق' },
            ],
          }),
        });
      } catch {
        // ignore
      }

      // 5. Clean up existing webhook if any to allow getUpdates polling
      try {
        await fetch(
          `https://api.telegram.org/bot${this.botToken}/deleteWebhook?drop_pending_updates=false`
        );
      } catch {
        // ignore
      }

      // 6. Start Long Polling
      this.pollUpdates();
    } catch (err: any) {
      console.error('[Telegram Bot] Failed to initialize bot:', err.message);
      this.isRunning = false;
    }
  }

  public stop() {
    this.isRunning = false;
    if (this.abortController) {
      try {
        this.abortController.abort();
      } catch {
        // ignore
      }
      this.abortController = null;
    }
    if (this.tunnelProcess) {
      try {
        this.tunnelProcess.kill();
      } catch {
        // ignore
      }
      this.tunnelProcess = null;
    }
    console.log('[Telegram Bot] Stopped bot service.');
  }

  // Set or update Telegram Menu Button dynamically
  public async setMenuButton(customUrl?: string) {
    const targetUrl = (customUrl || this.appUrl).trim().replace(/\/$/, '');
    if (!targetUrl || (!targetUrl.startsWith('https://') && !targetUrl.startsWith('http://'))) {
      return;
    }

    try {
      const payload = {
        menu_button: {
          type: 'web_app',
          text: '✨ Soul-X App',
          web_app: {
            url: targetUrl,
          },
        },
      };

      const res = await fetch(`https://api.telegram.org/bot${this.botToken}/setChatMenuButton`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (result.ok) {
        this.lastConfiguredUrl = targetUrl;
        console.log(`[Telegram Bot] ✅ Web App menu button dynamically auto-set: ${targetUrl}`);
      } else {
        console.warn('[Telegram Bot] Could not set menu button:', result.description);
      }
    } catch (err: any) {
      console.warn('[Telegram Bot] setMenuButton error:', err.message);
    }
  }

  private async pollUpdates() {
    console.log('[Telegram Bot] Long-polling active. Waiting for messages...');

    await new Promise((r) => setTimeout(r, 1000));

    while (this.isRunning) {
      try {
        this.abortController = new AbortController();
        const url = `https://api.telegram.org/bot${this.botToken}/getUpdates?offset=${this.offset}&timeout=15&allowed_updates=["message"]`;
        const res = await fetch(url, { signal: this.abortController.signal });
        const data = await res.json();

        if (data.ok && Array.isArray(data.result)) {
          for (const update of data.result as TelegramUpdate[]) {
            this.offset = update.update_id + 1;
            if (update.message) {
              await this.handleMessage(update.message);
            }
          }
        } else if (!data.ok) {
          if (data.error_code === 409 || data.description?.includes('Conflict')) {
            console.log(
              '[Telegram Bot] Notice: Multiple getUpdates detected. Backing off for 10s...'
            );
            await new Promise((r) => setTimeout(r, 10000));
          } else {
            console.warn('[Telegram Bot] Polling returned error:', data.description);
            await new Promise((r) => setTimeout(r, 5000));
          }
        }
      } catch (err: any) {
        if (err?.name === 'AbortError' || !this.isRunning) {
          break;
        }
        await new Promise((r) => setTimeout(r, 3000));
      } finally {
        this.abortController = null;
      }
    }
  }

  private async handleMessage(msg: TelegramUpdate['message']) {
    if (!msg || !msg.chat) return;

    const chatId = msg.chat.id;
    const user = msg.from;
    const senderName = user?.first_name || 'صديقي';
    const text = (msg.text || '').trim();

    console.log(
      `[Telegram Bot] Received message from ${senderName} (ID: ${user?.id}): "${text}"`
    );

    // Current dynamic URL at this exact moment
    const dynamicUrl = this.getAppUrl();

    // Command: /url or /status to check dynamic link
    if (text === '/url' || text === '/status') {
      const isTunnel = this.isTunnelRunning();
      const statusText =
        `🌐 *رابط تطبيق Soul-X الديناميكي الحالي:*\n` +
        `\`${dynamicUrl}\`\n\n` +
        `حالة النفق التلقائي: ${isTunnel ? '🟢 نشط ومباشر' : '🟡 يعمل عبر الرابط العام المباشر'}\n` +
        `زر Web App في البوت متصل بهذا الرابط تلقائياً.`;

      await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: statusText,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '🌟 فتح تطبيق Soul-X الآن',
                  web_app: {
                    url: dynamicUrl,
                  },
                },
              ],
            ],
          },
        }),
      }).catch(() => {});
      return;
    }

    // Default welcoming response with dynamic Web App button
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
                url: dynamicUrl,
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
