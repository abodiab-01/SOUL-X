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

export const TARGET_SOULX_URL = 'https://soul-x.onrender.com';

export class TelegramBotService {
  private botToken: string;
  private appUrl: string = TARGET_SOULX_URL;
  private isRunning: boolean = false;
  private offset: number = 0;
  private botInfo: any = null;
  private tunnelProcess: any = null;
  private abortController: AbortController | null = null;
  private lastConfiguredUrl: string | null = null;

  constructor(botToken: string, _appUrl?: string) {
    this.botToken = botToken;
    this.appUrl = TARGET_SOULX_URL;
  }

  public getAppUrl(): string {
    return TARGET_SOULX_URL;
  }

  public isTunnelRunning(): boolean {
    return !!this.tunnelProcess && !this.tunnelProcess.killed;
  }

  // Web App URL is strictly anchored to https://soul-x.onrender.com
  public async updateAppUrl(newUrl?: string, force: boolean = false): Promise<boolean> {
    // Strictly preserve official https://soul-x.onrender.com URL
    if (this.appUrl !== TARGET_SOULX_URL || this.lastConfiguredUrl !== TARGET_SOULX_URL) {
      console.log(`[Telegram Bot] 🔄 Web App URL anchored strictly to: ${TARGET_SOULX_URL}`);
      this.appUrl = TARGET_SOULX_URL;
      await this.setMenuButton();
      return true;
    }
    return false;
  }

  // Ensures official public HTTPS URL that works in Telegram WebApp
  private async ensurePublicUrl(): Promise<string> {
    this.appUrl = TARGET_SOULX_URL;
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
          const tunnelUrl = match[0];
          console.log(`[Telegram Bot] 🌐 Diagnostic Tunnel: ${tunnelUrl} (Web App strictly remains: ${TARGET_SOULX_URL})`);
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

  // Set or update Telegram Menu Button (strictly https://soul-x.onrender.com)
  public async setMenuButton(_customUrl?: string) {
    const targetUrl = TARGET_SOULX_URL;

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

  private escapeHtml(str: string): string {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private async pollUpdates() {
    console.log('[Telegram Bot] Long-polling active. Waiting for messages...');

    await new Promise((r) => setTimeout(r, 1000));

    while (this.isRunning) {
      try {
        this.abortController = new AbortController();
        const res = await fetch(`https://api.telegram.org/bot${this.botToken}/getUpdates`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            offset: this.offset,
            timeout: 20,
            allowed_updates: ['message', 'edited_message', 'callback_query'],
          }),
          signal: this.abortController.signal,
        });

        const data = await res.json();

        if (data.ok && Array.isArray(data.result)) {
          for (const update of data.result as any[]) {
            this.offset = Math.max(this.offset, update.update_id + 1);

            if (update.message) {
              try {
                await this.handleMessage(update.message);
              } catch (msgErr: any) {
                console.error('[Telegram Bot] Error handling message:', msgErr?.message || msgErr);
              }
            } else if (update.edited_message) {
              try {
                await this.handleMessage(update.edited_message);
              } catch (msgErr: any) {
                console.error('[Telegram Bot] Error handling edited message:', msgErr?.message || msgErr);
              }
            } else if (update.callback_query) {
              try {
                await this.handleCallbackQuery(update.callback_query);
              } catch (cbErr: any) {
                console.error('[Telegram Bot] Error answering callback:', cbErr?.message || cbErr);
              }
            }
          }
        } else if (!data.ok) {
          if (data.error_code === 409 || data.description?.includes('Conflict')) {
            console.warn(
              '[Telegram Bot] Notice: Conflict 409 detected (another instance might be polling). Backing off for 10s...'
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

  // Answer callback query if user taps inline buttons
  private async handleCallbackQuery(cb: any) {
    if (!cb || !cb.id) return;
    try {
      await fetch(`https://api.telegram.org/bot${this.botToken}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: cb.id,
          text: 'جاري فتح تطبيق Soul-X...',
        }),
      });
    } catch {}
  }

  // Robust send message helper with HTML escaping and automatic plain-text fallback
  private async sendSafeMessage(
    chatId: number | string,
    htmlText: string,
    plainText: string,
    replyMarkup?: any,
    threadId?: number
  ): Promise<boolean> {
    const basePayload: any = {
      chat_id: chatId,
      text: htmlText,
      parse_mode: 'HTML',
      disable_web_page_preview: false,
    };

    if (threadId) {
      basePayload.message_thread_id = threadId;
    }
    if (replyMarkup) {
      basePayload.reply_markup = replyMarkup;
    }

    try {
      // 1. Try sending with HTML formatting
      const res = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(basePayload),
      });

      const data = await res.json();
      if (data.ok) {
        console.log(`[Telegram Bot] ✅ Message successfully sent to chat ${chatId}`);
        return true;
      }

      console.warn(
        `[Telegram Bot] HTML send failed (${data.description}), retrying as raw plain text...`
      );

      // 2. Fallback: Send as raw plain text without parse_mode (never fails on special characters)
      const fallbackPayload = {
        ...basePayload,
        text: plainText,
        parse_mode: undefined,
      };
      delete fallbackPayload.parse_mode;

      const fallbackRes = await fetch(
        `https://api.telegram.org/bot${this.botToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fallbackPayload),
        }
      );

      const fallbackData = await fallbackRes.json();
      if (fallbackData.ok) {
        console.log(`[Telegram Bot] ✅ Fallback plain text message sent to chat ${chatId}`);
        return true;
      }

      console.error(
        `[Telegram Bot] ❌ SendMessage fallback failed: ${fallbackData.description}`
      );
      return false;
    } catch (err: any) {
      console.error('[Telegram Bot] ❌ Network error sending message:', err.message);
      return false;
    }
  }

  private async handleMessage(msg: any) {
    if (!msg || !msg.chat) return;

    const chatId = msg.chat.id;
    const threadId = msg.message_thread_id;
    const user = msg.from;
    const rawSenderName = user?.first_name || user?.username || 'صديقي';
    const safeSenderName = this.escapeHtml(rawSenderName);
    const text = (msg.text || '').trim();

    console.log(
      `[Telegram Bot] 📩 Received message from "${rawSenderName}" (ID: ${user?.id}, Chat: ${chatId}): "${text}"`
    );

    // Standard buttons: Web App within Telegram + Direct Browser Link
    const actionKeyboard = {
      inline_keyboard: [
        [
          {
            text: '🌟 فتح تطبيق Soul-X',
            web_app: {
              url: TARGET_SOULX_URL,
            },
          },
        ],
        [
          {
            text: '🌐 فتح المنصة في المتصفح',
            url: TARGET_SOULX_URL,
          },
        ],
      ],
    };

    // Command: /url or /status to check link
    if (text === '/url' || text === '/status') {
      const htmlText =
        `🌐 <b>رابط منصة Soul-X الرسمي المعتمد:</b>\n` +
        `<code>${TARGET_SOULX_URL}</code>\n\n` +
        `✅ زر Web App في البوت مهيأ لفتح المنصة مباشرة.\n` +
        `🔒 تسجيل الدخول في المنصة يتم بالبريد الإلكتروني فقط.`;

      const plainText =
        `🌐 رابط منصة Soul-X الرسمي المعتمد:\n` +
        `${TARGET_SOULX_URL}\n\n` +
        `زر Web App في البوت مهيأ لفتح المنصة مباشرة.\n` +
        `تسجيل الدخول في المنصة يتم بالبريد الإلكتروني فقط.`;

      await this.sendSafeMessage(chatId, htmlText, plainText, actionKeyboard, threadId);
      return;
    }

    // Default welcoming response with Web App & Direct Link buttons (matches /start, start, or any greeting)
    const replyHtml =
      `مرحباً بك يا <b>${safeSenderName}</b> في <b>Soul-X</b> ✨\n\n` +
      `منصة الشات والتعارف وتوافق الأرواح — تواصل حقيقي ولقاءات صادقة.\n\n` +
      `🔒 <b>تسجيل الدخول يتم بالبريد الإلكتروني فقط.</b>\n` +
      `اضغط على الزر أدناه لفتح المنصة وتسجيل الدخول:`;

    const replyPlain =
      `مرحباً بك يا ${rawSenderName} في Soul-X ✨\n\n` +
      `منصة الشات والتعارف وتوافق الأرواح — تواصل حقيقي ولقاءات صادقة.\n\n` +
      `تسجيل الدخول يتم بالبريد الإلكتروني فقط.\n` +
      `اضغط على الزر أدناه لفتح المنصة وتسجيل الدخول:`;

    await this.sendSafeMessage(chatId, replyHtml, replyPlain, actionKeyboard, threadId);
  }
}
