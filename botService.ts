// Telegram Bot Service (Long-polling & Dynamic Auto Web App Button)
// Runs automatically when TELEGRAM_BOT_TOKEN is present in process.env
import { spawn, execSync } from 'child_process';
import fs from 'fs';
import {
  recordPasswordResetRequest,
  getBotReferralSettings,
  registerOrUpdateBotUser,
  lookupSoulXAccountForReferralTransfer,
  transferBotReferralBalanceToSoulX,
} from './server.ts';

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

interface PendingReferralTransferState {
  step: 'awaiting_account_id' | 'confirm';
  targetAccountId?: string;
  targetName?: string;
  expiresAt: number;
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
  private pendingTransfers = new Map<string, PendingReferralTransferState>();

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

  private async ensureBotUsername(): Promise<string | null> {
    if (this.botInfo?.username) {
      return this.botInfo.username;
    }
    try {
      const res = await fetch(`https://api.telegram.org/bot${this.botToken}/getMe`);
      const data = await res.json();
      if (data.ok && data.result) {
        this.botInfo = data.result;
        return this.botInfo.username || null;
      }
    } catch {
      // ignore
    }
    return null;
  }

  private buildMainKeyboard() {
    const refSettings = getBotReferralSettings();
    const inline_keyboard: any[][] = [
      [
        {
          text: '🌟 فتح تطبيق Soul-X',
          web_app: {
            url: TARGET_SOULX_URL,
          },
        },
      ],
    ];

    if (refSettings.enabled) {
      inline_keyboard.push([
        {
          text: '🎁 الإحالات والمكافآت',
          callback_data: 'referrals_menu',
        },
      ]);
    }

    inline_keyboard.push([
      {
        text: '🔑 نسيت كلمة المرور / طلب مساعدة',
        callback_data: 'forgot_password',
      },
    ]);

    return { inline_keyboard };
  }

  private formatUsd(amount: number): string {
    const num = Number(amount || 0);
    if (!Number.isFinite(num)) return '0.00';
    return num.toFixed(2);
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

      // 4. Register Bot Commands (/start, /app, /referrals, /forgot, /url)
      try {
        await fetch(`https://api.telegram.org/bot${this.botToken}/setMyCommands`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            commands: [
              { command: 'start', description: 'بدء الاستخدام وفتح تطبيق Soul-X' },
              { command: 'referrals', description: 'الإحالات والمكافآت وتحويل الرصيد' },
              { command: 'app', description: 'فتح تطبيق Soul-X داخل تيليجرام مباشرة' },
              { command: 'forgot', description: 'نسيت كلمة المرور — طلب مساعدة من الدعم' },
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

  private async answerCallback(cbId: string, text?: string, showAlert = false) {
    try {
      await fetch(`https://api.telegram.org/bot${this.botToken}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: cbId,
          text,
          show_alert: showAlert,
        }),
      });
    } catch {
      // ignore
    }
  }

  private async sendReferralsDashboard(
    chatId: number | string,
    fromUser: { id?: number | string; username?: string; first_name?: string; last_name?: string },
    threadId?: number
  ) {
    const settings = getBotReferralSettings();
    if (!settings.enabled) {
      const disabledHtml =
        `⚠️ <b>نظام الإحالات متوقف حالياً</b>\n\n` +
        `تم إيقاف ميزة الإحالات والمكافآت مؤقتاً من قبل الإدارة. يمكنك متابعة استخدام تطبيق Soul-X كالمعتاد.`;
      const disabledPlain =
        `⚠️ نظام الإحالات متوقف حالياً\n\nتم إيقاف ميزة الإحالات والمكافآت مؤقتاً من قبل الإدارة.`;
      await this.sendSafeMessage(chatId, disabledHtml, disabledPlain, this.buildMainKeyboard(), threadId);
      return;
    }

    const reg = registerOrUpdateBotUser({
      telegramUserId: fromUser?.id || chatId,
      chatId,
      username: fromUser?.username,
      firstName: fromUser?.first_name,
      lastName: fromUser?.last_name,
    });

    const botUser = reg.user;
    const botUsername = await this.ensureBotUsername();
    const refLink = botUsername
      ? `https://t.me/${botUsername}?start=${botUser.referralCode}`
      : botUser.referralCode;

    const coinsPerDollar = Math.max(1, Math.round(settings.coinsPerDollar || 25000));
    const coinsEquivalent = Math.round(botUser.balanceUsd * coinsPerDollar + Number.EPSILON);

    const htmlText =
      `🎁 <b>برنامج الإحالات والمكافآت — Soul-X</b>\n\n` +
      `🔗 <b>رابط الإحالة الخاص بك:</b>\n` +
      `<code>${this.escapeHtml(refLink)}</code>\n\n` +
      `🆔 <b>معرف الإحالة:</b> <code>${this.escapeHtml(botUser.referralCode)}</code>\n` +
      `💵 <b>رصيد الإحالات الحالي:</b> <b>$${this.formatUsd(botUser.balanceUsd)}</b>\n` +
      `🪙 <b>ما يعادله بالكوينز:</b> <b>${coinsEquivalent.toLocaleString()} Coins</b>\n` +
      `👥 <b>عدد الإحالات الناجحة:</b> <b>${botUser.referralsCount || 0}</b>\n\n` +
      `📌 <b>تفاصيل المكافآت وسعر الصرف:</b>\n` +
      `• مكافأتك عند دخول مستخدم جديد من رابطك: <b>$${this.formatUsd(settings.referrerBonusUsd)}</b>\n` +
      `• مكافأة المستخدم الجديد عند الدخول: <b>$${this.formatUsd(settings.newUserBonusUsd)}</b>\n` +
      `• سعر الصرف للتحويل: <b>1$ = ${coinsPerDollar.toLocaleString()} Coins 🪙</b>\n\n` +
      `💡 اضغط على <b>💸 تحويل الرصيد إلى حساب Soul-X</b> لتحويل رصيدك إلى حسابك عبر ID الحساب مباشرة.`;

    const plainText =
      `🎁 برنامج الإحالات والمكافآت — Soul-X\n\n` +
      `🔗 رابط الإحالة الخاص بك:\n${refLink}\n\n` +
      `🆔 معرف الإحالة: ${botUser.referralCode}\n` +
      `💵 رصيد الإحالات الحالي: $${this.formatUsd(botUser.balanceUsd)}\n` +
      `🪙 ما يعادله بالكوينز: ${coinsEquivalent.toLocaleString()} Coins\n` +
      `👥 عدد الإحالات الناجحة: ${botUser.referralsCount || 0}\n\n` +
      `📌 تفاصيل المكافآت وسعر الصرف:\n` +
      `• مكافأتك عن كل مستخدم جديد: $${this.formatUsd(settings.referrerBonusUsd)}\n` +
      `• مكافأة المستخدم الجديد: $${this.formatUsd(settings.newUserBonusUsd)}\n` +
      `• سعر الصرف: 1$ = ${coinsPerDollar.toLocaleString()} Coins`;

    const inline_keyboard: any[][] = [
      [
        {
          text: '💸 تحويل الرصيد إلى حساب Soul-X',
          callback_data: 'referral_transfer',
        },
      ],
    ];

    if (botUsername) {
      const shareText = `انضم معي إلى Soul-X عبر رابط الإحالة واحصل على $${this.formatUsd(settings.newUserBonusUsd)} مكافأة ترحيبية! ✨`;
      inline_keyboard.push([
        {
          text: '📤 مشاركة رابط الإحالة',
          url: `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent(shareText)}`,
        },
      ]);
    }

    inline_keyboard.push([
      {
        text: '🔄 تحديث الرصيد',
        callback_data: 'referrals_menu',
      },
      {
        text: '🔙 القائمة الرئيسية',
        callback_data: 'back_to_main',
      },
    ]);

    await this.sendSafeMessage(chatId, htmlText, plainText, { inline_keyboard }, threadId);
  }

  // Answer callback query if user taps inline buttons
  private async handleCallbackQuery(cb: any) {
    if (!cb || !cb.id) return;
    const data = cb.data;
    const fromUser = cb.from;
    const chatId = cb.message?.chat?.id || fromUser?.id;
    const uid = String(fromUser?.id || chatId);

    if (data === 'forgot_password') {
      try {
        const username = fromUser?.username ? `@${fromUser.username}` : undefined;
        const firstName = fromUser?.first_name || '';
        const lastName = fromUser?.last_name || '';

        // Record request into persistent storage and admin panel
        const { isNew } = recordPasswordResetRequest({
          telegramUserId: fromUser?.id || chatId,
          telegramUsername: username,
          telegramFirstName: firstName,
          telegramLastName: lastName,
          chatId,
        });

        await this.answerCallback(
          cb.id,
          isNew
            ? '✅ تم إرسال طلبك للدعم الفني بنجاح!'
            : 'ℹ️ طلبك السابق مسجل بالفعل وهو قيد المتابعة من الدعم.',
          true
        );

        const confirmHtml =
          `🔐 <b>طلب استعادة كلمة المرور — منصة Soul-X</b>\n\n` +
          `تم استلام طلبك بنجاح.\n\n` +
          `👤 <b>معلومات حسابك في تيليجرام:</b>\n` +
          `• الاسم: <b>${this.escapeHtml(firstName || 'مستخدم')}</b>\n` +
          (username ? `• يوزر تيليجرام: <b>${this.escapeHtml(username)}</b>\n` : `• آيدي تيليجرام: <code>${fromUser?.id}</code>\n`) +
          `\n💬 سيقوم فريق الدعم الفني بالتواصل معك <b>بشكل مباشر عبر تيليجرام</b> لمساعدتك في استعادة وتعيين كلمة المرور لحسابك في أسرع وقت.`;

        const confirmPlain =
          `🔐 طلب استعادة كلمة المرور — منصة Soul-X\n\n` +
          `تم استلام طلبك بنجاح.\n\n` +
          `👤 معلومات حسابك في تيليجرام:\n` +
          `• الاسم: ${firstName || 'مستخدم'}\n` +
          (username ? `• يوزر تيليجرام: ${username}\n` : `• آيدي تيليجرام: ${fromUser?.id}\n`) +
          `\nسيقوم فريق الدعم الفني بالتواصل معك بشكل مباشر عبر تيليجرام لمساعدتك في استعادة وتعيين كلمة المرور لحسابك في أسرع وقت.`;

        await this.sendSafeMessage(chatId, confirmHtml, confirmPlain);
      } catch (err: any) {
        console.error('[Telegram Bot] Error handling forgot_password callback:', err?.message || err);
      }
      return;
    }

    if (data === 'referrals_menu') {
      this.pendingTransfers.delete(uid);
      const settings = getBotReferralSettings();
      if (!settings.enabled) {
        await this.answerCallback(cb.id, '⚠️ نظام الإحالات متوقف حالياً من قبل الإدارة.', true);
        return;
      }
      await this.answerCallback(cb.id);
      await this.sendReferralsDashboard(chatId, fromUser);
      return;
    }

    if (data === 'back_to_main') {
      this.pendingTransfers.delete(uid);
      await this.answerCallback(cb.id);
      const rawSenderName = fromUser?.first_name || fromUser?.username || 'صديقي';
      const safeSenderName = this.escapeHtml(rawSenderName);
      const replyHtml =
        `مرحباً بك يا <b>${safeSenderName}</b> في <b>Soul-X</b> ✨\n\n` +
        `منصة الشات والتعارف وتوافق الأرواح — تواصل حقيقي ولقاءات صادقة.\n\n` +
        `• اضغط على <b>🌟 فتح تطبيق Soul-X</b> للدخول للمنصة.\n` +
        `• اضغط على <b>🎁 الإحالات والمكافآت</b> للحصول على رابط إحالتك وتحويل رصيدك إلى Coins.`;
      const replyPlain =
        `مرحباً بك يا ${rawSenderName} في Soul-X ✨\n\n` +
        `• اضغط على 🌟 فتح تطبيق Soul-X للدخول للمنصة.\n` +
        `• اضغط على 🎁 الإحالات والمكافآت للحصول على رابط إحالتك وتحويل رصيدك إلى Coins.`;
      await this.sendSafeMessage(chatId, replyHtml, replyPlain, this.buildMainKeyboard());
      return;
    }

    if (data === 'referral_transfer') {
      const settings = getBotReferralSettings();
      if (!settings.enabled) {
        await this.answerCallback(cb.id, '⚠️ نظام الإحالات متوقف حالياً من قبل الإدارة.', true);
        return;
      }
      const reg = registerOrUpdateBotUser({
        telegramUserId: fromUser?.id || chatId,
        chatId,
        username: fromUser?.username,
        firstName: fromUser?.first_name,
        lastName: fromUser?.last_name,
      });
      const botUser = reg.user;
      const coinsPerDollar = Math.max(1, Math.round(settings.coinsPerDollar || 25000));
      const coinsToCredit = Math.round(botUser.balanceUsd * coinsPerDollar + Number.EPSILON);

      if (botUser.balanceUsd <= 0 || coinsToCredit <= 0) {
        await this.answerCallback(
          cb.id,
          '⚠️ رصيد الإحالات لديك حالياً $0.00! شارك رابط إحالتك مع أصدقائك لكسب الرصيد أولاً.',
          true
        );
        return;
      }

      this.pendingTransfers.set(uid, {
        step: 'awaiting_account_id',
        expiresAt: Date.now() + 10 * 60 * 1000,
      });

      await this.answerCallback(cb.id);

      const promptHtml =
        `💸 <b>تحويل رصيد الإحالات إلى حساب Soul-X</b>\n\n` +
        `💵 الرصيد المتاح للتحويل: <b>$${this.formatUsd(botUser.balanceUsd)}</b>\n` +
        `🪙 ستحصل على: <b>${coinsToCredit.toLocaleString()} Coins</b>\n` +
        `📊 سعر الصرف: <code>1$ = ${coinsPerDollar.toLocaleString()} Coins</code>\n\n` +
        `🆔 <b>أرسل الآن معرف الحساب (ID) الخاص بك في Soul-X</b>\n` +
        `(مثال: <code>S-0101V77-X711</code>):`;

      const promptPlain =
        `💸 تحويل رصيد الإحالات إلى حساب Soul-X\n\n` +
        `💵 الرصيد المتاح للتحويل: $${this.formatUsd(botUser.balanceUsd)}\n` +
        `🪙 ستحصل على: ${coinsToCredit.toLocaleString()} Coins\n` +
        `📊 سعر الصرف: 1$ = ${coinsPerDollar.toLocaleString()} Coins\n\n` +
        `🆔 أرسل الآن معرف الحساب (ID) الخاص بك في Soul-X (مثال: S-0101V77-X711):`;

      await this.sendSafeMessage(chatId, promptHtml, promptPlain, {
        inline_keyboard: [
          [{ text: '❌ إلغاء التحويل', callback_data: 'cancel_referral_transfer' }],
        ],
      });
      return;
    }

    if (data === 'cancel_referral_transfer') {
      this.pendingTransfers.delete(uid);
      await this.answerCallback(cb.id, 'تم إلغاء عملية التحويل');
      const cancelHtml = `❌ تم إلغاء عملية التحويل بنجاح.`;
      const cancelPlain = `❌ تم إلغاء عملية التحويل بنجاح.`;
      await this.sendSafeMessage(chatId, cancelHtml, cancelPlain, {
        inline_keyboard: [
          [{ text: '🎁 العودة لصفحة الإحالات', callback_data: 'referrals_menu' }],
        ],
      });
      return;
    }

    if (data === 'confirm_ref_tx') {
      const pending = this.pendingTransfers.get(uid);
      if (!pending || pending.expiresAt < Date.now() || !pending.targetAccountId) {
        this.pendingTransfers.delete(uid);
        await this.answerCallback(cb.id, '⏳ انتهت صلاحية الجلسة، يرجى بدء التحويل من جديد.', true);
        return;
      }

      const result = await transferBotReferralBalanceToSoulX(uid, pending.targetAccountId);
      this.pendingTransfers.delete(uid);

      if (!result.success) {
        const errMsg =
          result.error === 'DISABLED'
            ? '⚠️ نظام الإحالات متوقف حالياً من قبل الإدارة.'
            : result.error === 'INSUFFICIENT_BALANCE'
            ? '⚠️ رصيد الإحالات غير كافٍ للتحويل.'
            : result.error === 'ACCOUNT_NOT_FOUND'
            ? '❌ لم يتم العثور على حساب Soul-X المستهدف.'
            : '❌ تعذر إتمام التحويل، يرجى المحاولة مجدداً.';
        await this.answerCallback(cb.id, errMsg, true);
        return;
      }

      await this.answerCallback(cb.id, '✅ تم تحويل الرصيد بنجاح!');

      const receiptHtml =
        `🎉 <b>تم تحويل رصيد الإحالات بنجاح!</b>\n\n` +
        `💵 المبلغ المحوّل: <b>$${this.formatUsd(result.amountUsd || 0)}</b>\n` +
        `🪙 الكوينز المضافة: <b>+${(result.coinsCredited || 0).toLocaleString()} Coins</b>\n` +
        `👤 الحساب المستلم: <b>${this.escapeHtml(result.targetUser?.name || '')}</b>\n` +
        `🆔 معرف الحساب: <code>${this.escapeHtml(result.targetUser?.displayId || '')}</code>\n` +
        `💰 رصيد الكوينز الجديد في Soul-X: <b>${(result.targetUser?.newCoins || 0).toLocaleString()} Coins</b>\n` +
        `📉 رصيد الإحالات المتبقي في البوت: <b>$0.00</b>`;

      const receiptPlain =
        `🎉 تم تحويل رصيد الإحالات بنجاح!\n\n` +
        `💵 المبلغ المحوّل: $${this.formatUsd(result.amountUsd || 0)}\n` +
        `🪙 الكوينز المضافة: +${(result.coinsCredited || 0).toLocaleString()} Coins\n` +
        `👤 الحساب المستلم: ${result.targetUser?.name || ''}\n` +
        `🆔 معرف الحساب: ${result.targetUser?.displayId || ''}\n` +
        `💰 رصيد الكوينز الجديد في Soul-X: ${(result.targetUser?.newCoins || 0).toLocaleString()} Coins\n` +
        `📉 رصيد الإحالات المتبقي في البوت: $0.00`;

      await this.sendSafeMessage(chatId, receiptHtml, receiptPlain, {
        inline_keyboard: [
          [{ text: '🌟 فتح تطبيق Soul-X', web_app: { url: TARGET_SOULX_URL } }],
          [{ text: '🎁 العودة لصفحة الإحالات', callback_data: 'referrals_menu' }],
        ],
      });
      return;
    }

    await this.answerCallback(cb.id, 'جاري فتح تطبيق Soul-X...');
  }

  public async sendDirectMessage(
    chatId: number | string,
    htmlText: string,
    plainText: string
  ): Promise<boolean> {
    if (!chatId) return false;
    return this.sendSafeMessage(chatId, htmlText, plainText);
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
    const uid = String(user?.id || chatId);
    const rawSenderName = user?.first_name || user?.username || 'صديقي';
    const safeSenderName = this.escapeHtml(rawSenderName);
    const text = (msg.text || '').trim();

    console.log(
      `[Telegram Bot] 📩 Received message from "${rawSenderName}" (ID: ${user?.id}, Chat: ${chatId}): "${text}"`
    );

    const isSlashCommand = text.startsWith('/');
    const pendingState = this.pendingTransfers.get(uid);

    // Handle active referral transfer ID input flow
    if (pendingState && pendingState.expiresAt > Date.now() && pendingState.step === 'awaiting_account_id' && !isSlashCommand) {
      if (text === 'إلغاء' || text.toLowerCase() === 'cancel') {
        this.pendingTransfers.delete(uid);
        await this.sendSafeMessage(
          chatId,
          '❌ تم إلغاء عملية التحويل بنجاح.',
          '❌ تم إلغاء عملية التحويل بنجاح.',
          {
            inline_keyboard: [[{ text: '🎁 العودة لصفحة الإحالات', callback_data: 'referrals_menu' }]],
          },
          threadId
        );
        return;
      }

      const settings = getBotReferralSettings();
      if (!settings.enabled) {
        this.pendingTransfers.delete(uid);
        await this.sendSafeMessage(
          chatId,
          '⚠️ نظام الإحالات متوقف حالياً من قبل الإدارة.',
          '⚠️ نظام الإحالات متوقف حالياً من قبل الإدارة.',
          this.buildMainKeyboard(),
          threadId
        );
        return;
      }

      const lookup = await lookupSoulXAccountForReferralTransfer(text);
      if (!lookup.found || !lookup.user) {
        const notFoundHtml =
          `❌ لم يتم العثور على أي حساب في <b>Soul-X</b> بالمعرف: <code>${this.escapeHtml(text)}</code>\n\n` +
          `يرجى التأكد من نسخ <b>ID الحساب</b> بشكل صحيح (مثال: <code>S-0101V77-X711</code>) وإرساله مجدداً، أو اضغط إلغاء:`;
        const notFoundPlain =
          `❌ لم يتم العثور على أي حساب في Soul-X بالمعرف: ${text}\n\n` +
          `يرجى التأكد من نسخ ID الحساب بشكل صحيح وإرساله مجدداً، أو اضغط إلغاء:`;
        await this.sendSafeMessage(
          chatId,
          notFoundHtml,
          notFoundPlain,
          {
            inline_keyboard: [[{ text: '❌ إلغاء التحويل', callback_data: 'cancel_referral_transfer' }]],
          },
          threadId
        );
        return;
      }

      const reg = registerOrUpdateBotUser({
        telegramUserId: user?.id || chatId,
        chatId,
        username: user?.username,
        firstName: user?.first_name,
        lastName: user?.last_name,
      });
      const coinsPerDollar = Math.max(1, Math.round(settings.coinsPerDollar || 25000));
      const coinsToCredit = Math.round(reg.user.balanceUsd * coinsPerDollar + Number.EPSILON);

      if (reg.user.balanceUsd <= 0 || coinsToCredit <= 0) {
        this.pendingTransfers.delete(uid);
        await this.sendSafeMessage(
          chatId,
          '⚠️ رصيد الإحالات لديك غير كافٍ للتحويل حالياً ($0.00).',
          '⚠️ رصيد الإحالات لديك غير كافٍ للتحويل حالياً ($0.00).',
          this.buildMainKeyboard(),
          threadId
        );
        return;
      }

      this.pendingTransfers.set(uid, {
        step: 'confirm',
        targetAccountId: lookup.user.displayId || lookup.user.id,
        targetName: lookup.user.name,
        expiresAt: Date.now() + 10 * 60 * 1000,
      });

      const confirmTxHtml =
        `🔎 <b>تم العثور على الحساب! يرجى تأكيد التحويل:</b>\n\n` +
        `👤 اسم الحساب: <b>${this.escapeHtml(lookup.user.name)}</b>\n` +
        `🆔 معرف الحساب: <code>${this.escapeHtml(lookup.user.displayId)}</code>\n` +
        `💵 الرصيد المحوّل: <b>$${this.formatUsd(reg.user.balanceUsd)}</b>\n` +
        `🪙 الكوينز المستلمة: <b>+${coinsToCredit.toLocaleString()} Coins</b>\n\n` +
        `اضغط على <b>✅ تأكيد التحويل الآن</b> لإتمام التحويل فوراً:`;

      const confirmTxPlain =
        `🔎 تم العثور على الحساب! يرجى تأكيد التحويل:\n\n` +
        `👤 اسم الحساب: ${lookup.user.name}\n` +
        `🆔 معرف الحساب: ${lookup.user.displayId}\n` +
        `💵 الرصيد المحوّل: $${this.formatUsd(reg.user.balanceUsd)}\n` +
        `🪙 الكوينز المستلمة: +${coinsToCredit.toLocaleString()} Coins\n\n` +
        `اضغط على تأكيد التحويل الآن لإتمام التحويل فوراً:`;

      await this.sendSafeMessage(
        chatId,
        confirmTxHtml,
        confirmTxPlain,
        {
          inline_keyboard: [
            [{ text: '✅ تأكيد التحويل الآن', callback_data: 'confirm_ref_tx' }],
            [
              { text: '🔄 تغيير المعرف', callback_data: 'referral_transfer' },
              { text: '❌ إلغاء', callback_data: 'cancel_referral_transfer' },
            ],
          ],
        },
        threadId
      );
      return;
    }

    if (text.toLowerCase() === '/cancel') {
      this.pendingTransfers.delete(uid);
      await this.sendSafeMessage(
        chatId,
        '❌ تم إلغاء العملية الحالية.',
        '❌ تم إلغاء العملية الحالية.',
        this.buildMainKeyboard(),
        threadId
      );
      return;
    }

    // Clear any stale pending transfer when running another command
    this.pendingTransfers.delete(uid);

    // Command: /referrals or /ref or الإحالات
    if (
      text === '/referrals' ||
      text.startsWith('/referrals@') ||
      text === '/ref' ||
      text.startsWith('/ref@') ||
      text === 'الإحالات' ||
      text === 'رابط الإحالة'
    ) {
      await this.sendReferralsDashboard(chatId, user || { id: chatId }, threadId);
      return;
    }

    // Command: /forgot or text requesting password reset
    if (
      text === '/forgot' ||
      text === 'نسيت كلمة المرور' ||
      text === 'استعادة كلمة المرور' ||
      text === 'نسيت الباسورد'
    ) {
      registerOrUpdateBotUser({
        telegramUserId: user?.id || chatId,
        chatId,
        username: user?.username,
        firstName: user?.first_name,
        lastName: user?.last_name,
      });

      const username = user?.username ? `@${user.username}` : undefined;
      const firstName = user?.first_name || '';
      const lastName = user?.last_name || '';

      recordPasswordResetRequest({
        telegramUserId: user?.id || chatId,
        telegramUsername: username,
        telegramFirstName: firstName,
        telegramLastName: lastName,
        chatId,
      });

      const confirmHtml =
        `🔐 <b>طلب استعادة كلمة المرور — منصة Soul-X</b>\n\n` +
        `تم استلام طلبك بنجاح.\n\n` +
        `👤 <b>معلومات حسابك في تيليجرام:</b>\n` +
        `• الاسم: <b>${this.escapeHtml(firstName || 'مستخدم')}</b>\n` +
        (username ? `• يوزر تيليجرام: <b>${this.escapeHtml(username)}</b>\n` : `• آيدي تيليجرام: <code>${user?.id}</code>\n`) +
        `\n💬 سيقوم فريق الدعم الفني بالتواصل معك <b>بشكل مباشر عبر تيليجرام</b> لمساعدتك في استعادة وتعيين كلمة المرور لحسابك في أسرع وقت.`;

      const confirmPlain =
        `🔐 طلب استعادة كلمة المرور — منصة Soul-X\n\n` +
        `تم استلام طلبك بنجاح.\n\n` +
        `👤 معلومات حسابك في تيليجرام:\n` +
        `• الاسم: ${firstName || 'مستخدم'}\n` +
        (username ? `• يوزر تيليجرام: ${username}\n` : `• آيدي تيليجرام: ${user?.id}\n`) +
        `\nسيقوم فريق الدعم الفني بالتواصل معك بشكل مباشر عبر تيليجرام لمساعدتك في استعادة وتعيين كلمة المرور لحسابك في أسرع وقت.`;

      await this.sendSafeMessage(chatId, confirmHtml, confirmPlain, this.buildMainKeyboard(), threadId);
      return;
    }

    // Command: /url or /status to check link
    if (text === '/url' || text === '/status') {
      registerOrUpdateBotUser({
        telegramUserId: user?.id || chatId,
        chatId,
        username: user?.username,
        firstName: user?.first_name,
        lastName: user?.last_name,
      });

      const htmlText =
        `🌐 <b>رابط منصة Soul-X الرسمي المعتمد:</b>\n` +
        `<code>${TARGET_SOULX_URL}</code>\n\n` +
        `✅ زر Web App في البوت مهيأ لفتح المنصة مباشرة.\n` +
        `🔒 تسجيل الدخول في المنصة يتم بالبريد الإلكتروني فقط.\n` +
        `🔑 إذا نسيت كلمة المرور، يمكنك الضغط على زر "نسيت كلمة المرور" أدناه ليتواصل معك الدعم عبر تيليجرام.`;

      const plainText =
        `🌐 رابط منصة Soul-X الرسمي المعتمد:\n` +
        `${TARGET_SOULX_URL}\n\n` +
        `زر Web App في البوت مهيأ لفتح المنصة مباشرة.\n` +
        `تسجيل الدخول في المنصة يتم بالبريد الإلكتروني فقط.\n` +
        `إذا نسيت كلمة المرور، يمكنك الضغط على زر "نسيت كلمة المرور" أدناه ليتواصل معك الدعم عبر تيليجرام.`;

      await this.sendSafeMessage(chatId, htmlText, plainText, this.buildMainKeyboard(), threadId);
      return;
    }

    // Check /start <referralCode> payload and register/update bot user
    const startMatch = text.match(/^\/start(?:@[a-zA-Z0-9_]+)?(?:\s+([a-zA-Z0-9_-]+))?$/i);
    const startReferralCode = startMatch?.[1];

    const regResult = registerOrUpdateBotUser({
      telegramUserId: user?.id || chatId,
      chatId,
      username: user?.username,
      firstName: user?.first_name,
      lastName: user?.last_name,
      startReferralCode,
    });

    const settings = getBotReferralSettings();
    const actionKeyboard = this.buildMainKeyboard();

    // Notify both the new user and referrer if a valid referral was credited
    if (regResult.referralApplied && regResult.referrer) {
      const botUsername = await this.ensureBotUsername();
      const myRefLink = botUsername
        ? `https://t.me/${botUsername}?start=${regResult.user.referralCode}`
        : regResult.user.referralCode;
      const coinsPerDollar = Math.max(1, Math.round(settings.coinsPerDollar || 25000));
      const newBonus = regResult.newUserBonusUsd ?? settings.newUserBonusUsd;
      const refBonus = regResult.referrerBonusUsd ?? settings.referrerBonusUsd;
      const newUserCoins = Math.round(newBonus * coinsPerDollar + Number.EPSILON);
      const referrerCoins = Math.round(regResult.referrer.balanceUsd * coinsPerDollar + Number.EPSILON);

      const refWelcomeHtml =
        `مرحباً بك يا <b>${safeSenderName}</b> في <b>Soul-X</b> ✨\n\n` +
        `🎉 <b>تم تفعيل مكافأة الإحالة الترحيبية بنجاح!</b>\n` +
        `• حصلت على: <b>+$${this.formatUsd(newBonus)}</b> (ما يعادل <b>${newUserCoins.toLocaleString()} Coins 🪙</b>) في رصيد الإحالات داخل البوت!\n\n` +
        `🔗 <b>رابط الإحالة الخاص بك لمضاعفة رصيدك:</b>\n` +
        `<code>${this.escapeHtml(myRefLink)}</code>\n` +
        `• اربح <b>$${this.formatUsd(settings.referrerBonusUsd)}</b> عن كل صديق جديد ينضم عبر رابطك!`;

      const refWelcomePlain =
        `مرحباً بك يا ${rawSenderName} في Soul-X ✨\n\n` +
        `🎉 تم تفعيل مكافأة الإحالة الترحيبية بنجاح!\n` +
        `• حصلت على: +$${this.formatUsd(newBonus)} (${newUserCoins.toLocaleString()} Coins) في رصيد الإحالات داخل البوت!\n\n` +
        `🔗 رابط الإحالة الخاص بك:\n${myRefLink}\n` +
        `• اربح $${this.formatUsd(settings.referrerBonusUsd)} عن كل صديق جديد ينضم عبر رابطك!`;

      await this.sendSafeMessage(chatId, refWelcomeHtml, refWelcomePlain, actionKeyboard, threadId);

      // Notify the referrer via Telegram
      if (regResult.referrer.chatId) {
        const referrerNotifHtml =
          `🎉 <b>إحالة جديدة ناجحة!</b>\n\n` +
          `انضم المستخدم <b>${safeSenderName}</b> عبر رابط الإحالة الخاص بك!\n` +
          `💵 المكافأة المضافة: <b>+$${this.formatUsd(refBonus)}</b>\n` +
          `💰 رصيد الإحالات الحالي: <b>$${this.formatUsd(regResult.referrer.balanceUsd)}</b> (${referrerCoins.toLocaleString()} Coins 🪙)\n` +
          `👥 إجمالي إحالاتك: <b>${regResult.referrer.referralsCount}</b>`;

        const referrerNotifPlain =
          `🎉 إحالة جديدة ناجحة!\n\n` +
          `انضم المستخدم ${rawSenderName} عبر رابط الإحالة الخاص بك!\n` +
          `💵 المكافأة المضافة: +$${this.formatUsd(refBonus)}\n` +
          `💰 رصيد الإحالات الحالي: $${this.formatUsd(regResult.referrer.balanceUsd)} (${referrerCoins.toLocaleString()} Coins)\n` +
          `👥 إجمالي إحالاتك: ${regResult.referrer.referralsCount}`;

        await this.sendSafeMessage(regResult.referrer.chatId, referrerNotifHtml, referrerNotifPlain, {
          inline_keyboard: [
            [{ text: '🎁 فتح صفحة الإحالات والتحويل', callback_data: 'referrals_menu' }],
          ],
        }).catch(() => {});
      }
      return;
    }

    // Default welcoming response with Web App, Referrals (when enabled) & Forgot Password buttons
    const replyHtml =
      `مرحباً بك يا <b>${safeSenderName}</b> في <b>Soul-X</b> ✨\n\n` +
      `منصة الشات والتعارف وتوافق الأرواح — تواصل حقيقي ولقاءات صادقة.\n\n` +
      `🔒 <b>تسجيل الدخول يتم بالبريد الإلكتروني فقط.</b>\n` +
      `• اضغط على <b>🌟 فتح تطبيق Soul-X</b> للدخول للمنصة.\n` +
      (settings.enabled
        ? `• اضغط على <b>🎁 الإحالات والمكافآت</b> للحصول على رابط إحالتك والربح وتحويل الرصيد إلى Coins.\n`
        : '') +
      `• إذا فقدت الوصول لحسابك، اضغط على <b>🔑 نسيت كلمة المرور</b> ليتواصل معك الدعم الفني مباشرة عبر حسابك هنا في تيليجرام:`;

    const replyPlain =
      `مرحباً بك يا ${rawSenderName} في Soul-X ✨\n\n` +
      `منصة الشات والتعارف وتوافق الأرواح — تواصل حقيقي ولقاءات صادقة.\n\n` +
      `تسجيل الدخول يتم بالبريد الإلكتروني فقط.\n` +
      `• اضغط على 🌟 فتح تطبيق Soul-X للدخول للمنصة.\n` +
      (settings.enabled
        ? `• اضغط على 🎁 الإحالات والمكافآت للحصول على رابط إحالتك والربح وتحويل الرصيد إلى Coins.\n`
        : '') +
      `• إذا فقدت الوصول لحسابك، اضغط على 🔑 نسيت كلمة المرور ليتواصل معك الدعم الفني مباشرة عبر حسابك هنا في تيليجرام:`;

    await this.sendSafeMessage(chatId, replyHtml, replyPlain, actionKeyboard, threadId);
  }
}

