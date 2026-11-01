import React, { useState } from 'react';
import {
  X,
  Bot,
  Send,
  ShieldCheck,
  AlertTriangle,
  Copy,
  Check,
  Code2,
  Sparkles,
  RefreshCw,
  Sliders,
  CheckCircle2,
  Globe,
  Key,
} from 'lucide-react';
import { Language, TelegramUser } from '../types';
import { UseTelegramAuthReturn } from '../hooks/useTelegramAuth';

interface TelegramBotModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  auth: UseTelegramAuthReturn;
}

export const TelegramBotModal: React.FC<TelegramBotModalProps> = ({
  isOpen,
  onClose,
  lang,
  auth,
}) => {
  const isAr = lang === 'ar';
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://soulx.app';
  // Prefer public tunnel URL (which bypasses Google IAP and opens directly inside Telegram)
  const activeUrl = auth.publicUrl || currentOrigin;

  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [activeTab, setActiveTab] = useState<'setup' | 'simulate' | 'code'>('setup');

  // Input for bot token configuration
  const [tokenInput, setTokenInput] = useState('');
  const [isConfiguringToken, setIsConfiguringToken] = useState(false);
  const [tokenFeedback, setTokenFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // One-click set menu button state
  const [isSettingMenu, setIsSettingMenu] = useState(false);
  const [menuButtonResult, setMenuButtonResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Simulation form states
  const [simName, setSimName] = useState('سلطان الشمري');
  const [simUsername, setSimUsername] = useState('sultan_sh');
  const [simId, setSimId] = useState('694820153');
  const [simLang, setSimLang] = useState<'ar' | 'en'>('ar');
  const [simIsLoading, setSimIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleCopyUrl = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(activeUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  const handleSaveToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;

    setIsConfiguringToken(true);
    setTokenFeedback(null);
    const res = await auth.configureBotToken(tokenInput.trim());
    setTokenFeedback(res);
    setIsConfiguringToken(false);
    if (res.success) {
      setTokenInput('');
    }
  };

  const handleSetMenuButton = async () => {
    setIsSettingMenu(true);
    setMenuButtonResult(null);
    try {
      const res = await fetch('/api/telegram/set-menu-button', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webAppUrl: activeUrl,
          buttonText: isAr ? '✨ فتح Soul-X' : '✨ Open Soul-X',
        }),
      });
      const data = await res.json();
      setMenuButtonResult({
        success: data.success,
        message: data.message,
      });
      await auth.checkBotStatus();
    } catch (err: any) {
      setMenuButtonResult({
        success: false,
        message: err.message || 'حدث خطأ أثناء الاتصال بتيليجرام',
      });
    } finally {
      setIsSettingMenu(false);
    }
  };

  const handleSimulate = async () => {
    setSimIsLoading(true);
    const customUser: Partial<TelegramUser> = {
      id: parseInt(simId, 10) || 549182301,
      first_name: simName.split(' ')[0] || 'سلطان',
      last_name: simName.split(' ').slice(1).join(' ') || '',
      username: simUsername,
      language_code: simLang,
      is_premium: true,
    };
    await auth.simulateTelegramLogin(customUser);
    setSimIsLoading(false);
    onClose();
  };

  const botPythonCode = `# كود بايثون لبوت تيليجرام مع زر فتح تطبيق Soul-X داخل تيليجرام
# Python telegram bot snippet
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import ApplicationBuilder, CommandHandler, ContextTypes

WEB_APP_URL = "${activeUrl}"

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # زر Web App يفتح التطبيق مباشرة داخل تيليجرام بدون متصفح خارجي
    keyboard = [
        [
            InlineKeyboardButton(
                text="🌟 فتح تطبيق Soul-X",
                web_app=WebAppInfo(url=WEB_APP_URL)
            )
        ]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    await update.message.reply_text(
        "مرحباً بك في Soul-X! اضغط الزر أدناه لفتح التطبيق وتسجيل الدخول تلقائياً:",
        reply_markup=reply_markup
    )

app = ApplicationBuilder().token("YOUR_TELEGRAM_BOT_TOKEN").build()
app.add_handler(CommandHandler("start", start))
app.add_handler(CommandHandler("app", start))
app.run_polling()`;

  const botNodeCode = `// كود Node.js (Telegraf) لبوت تيليجرام - زر تطبيق Soul-X
import { Telegraf, Markup } from 'telegraf';

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const WEB_APP_URL = '${activeUrl}';

bot.start((ctx) => {
  return ctx.reply(
    'مرحباً بك في Soul-X! اضغط الزر أدناه للدخول فوراً:',
    Markup.inlineKeyboard([
      Markup.button.webApp('🌟 فتح تطبيق Soul-X', WEB_APP_URL)
    ])
  );
});

bot.command('app', (ctx) => {
  return ctx.reply(
    'فتح تطبيق Soul-X:',
    Markup.inlineKeyboard([
      Markup.button.webApp('🌟 فتح تطبيق Soul-X', WEB_APP_URL)
    ])
  );
});

bot.launch();`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-neutral-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between shrink-0 bg-neutral-50/50 dark:bg-neutral-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#24A1DE]/10 text-[#24A1DE] flex items-center justify-center shrink-0">
              <Send className="w-5 h-5 -rotate-45" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white">
                  {isAr ? 'ربط بوت Telegram مع Web App' : 'Telegram Bot Web App Integration'}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[#24A1DE]/15 text-[#24A1DE]">
                  MINI APP
                </span>
              </div>
              <p className="text-xs text-neutral-500">
                {isAr
                  ? 'فتح التطبيق الفعلي وتسجيل الدخول التلقائي من داخل تيليجرام'
                  : 'Direct in-app launch & server-side HMAC validation'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-neutral-900 dark:hover:text-white bg-neutral-100 dark:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 pt-3 flex gap-2 border-b border-neutral-200 dark:border-neutral-800 shrink-0 bg-neutral-50/30 dark:bg-neutral-950/20">
          <button
            type="button"
            onClick={() => setActiveTab('setup')}
            className={`pb-2.5 px-3 text-xs font-semibold cursor-pointer border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'setup'
                ? 'border-[#24A1DE] text-[#24A1DE]'
                : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>{isAr ? 'خطوات التفعيل والإعداد' : 'Setup & Instructions'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('simulate')}
            className={`pb-2.5 px-3 text-xs font-semibold cursor-pointer border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'simulate'
                ? 'border-[#24A1DE] text-[#24A1DE]'
                : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{isAr ? 'تجربة ومحاكاة البوت' : 'Simulator & Testing'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('code')}
            className={`pb-2.5 px-3 text-xs font-semibold cursor-pointer border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'code'
                ? 'border-[#24A1DE] text-[#24A1DE]'
                : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>{isAr ? 'أكواد البوت الجاهزة' : 'Bot Code Snippets'}</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Status Alert Banner */}
          <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    auth.isTelegram ? 'bg-emerald-500 animate-pulse' : 'bg-cyan-500'
                  }`}
                />
                {auth.isTelegram
                  ? isAr
                    ? 'التطبيق مفتوح حالياً من داخل Telegram Mini App'
                    : 'Currently active inside Telegram Mini App'
                  : isAr
                  ? 'التطبيق جاهز للعمل داخل تيليجرام'
                  : 'App ready for Telegram Mini App'}
              </span>

              <span className="font-mono text-[11px] text-neutral-400">
                {auth.botConfigured ? 'BOT_TOKEN: OK' : 'BOT_TOKEN: PENDING'}
              </span>
            </div>

            {/* Server Verification Details */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800/80 text-xs">
              <div className="flex items-center gap-2">
                <ShieldCheck
                  className={`w-4 h-4 ${
                    auth.isVerified ? 'text-emerald-500' : 'text-neutral-400'
                  }`}
                />
                <span className="text-neutral-600 dark:text-neutral-300">
                  {isAr ? 'التحقق المشفر من جهة السيرفر (HMAC-SHA256):' : 'Server HMAC Validation:'}
                </span>
              </div>
              <span
                className={`font-semibold px-2 py-0.5 rounded-md text-[11px] ${
                  auth.isVerified
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500'
                }`}
              >
                {auth.isVerified
                  ? isAr
                    ? 'موثق ومعتمد بنجاح'
                    : 'Verified & Trusted'
                  : isAr
                  ? 'في انتظار البيانات'
                  : 'Awaiting Data'}
              </span>
            </div>

            {auth.serverMessage && (
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 px-1">
                {auth.serverMessage}
              </p>
            )}

            {auth.serverError && (
              <p className="text-[11px] text-red-500 dark:text-red-400 px-1">
                ⚠️ {auth.serverError}
              </p>
            )}
          </div>

          {activeTab === 'setup' && (
            <div className="space-y-5">
              {/* Token Configuration Box if not configured yet */}
              {!auth.botConfigured && (
                <div className="p-4 rounded-2xl bg-[#24A1DE]/5 border border-[#24A1DE]/25 space-y-3">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-[#24A1DE]" />
                    <span className="text-xs font-bold text-neutral-900 dark:text-white">
                      {isAr ? 'إدخال رمز البوت (Bot Token) وتشغيله فوراً' : 'Configure Bot Token'}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    {isAr
                      ? 'الصق رمز التوكن الذي حصلت عليه من @BotFather للبدء الفوري بربط البوت وتشغيل النفق:'
                      : 'Paste the bot token from @BotFather to instantly launch the bot and tunnel:'}
                  </p>
                  <form onSubmit={handleSaveToken} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={tokenInput}
                        onChange={(e) => setTokenInput(e.target.value)}
                        placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ..."
                        className="flex-1 p-2.5 rounded-xl bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 text-xs font-mono text-neutral-900 dark:text-white focus:outline-none focus:border-[#24A1DE]"
                      />
                      <button
                        type="submit"
                        disabled={isConfiguringToken || !tokenInput.trim()}
                        className="px-4 py-2.5 rounded-xl bg-[#24A1DE] hover:bg-[#208fcf] text-white font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                      >
                        {isConfiguringToken ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" />
                        )}
                        <span>{isAr ? 'تشغيل البوت' : 'Launch Bot'}</span>
                      </button>
                    </div>
                  </form>
                  {tokenFeedback && (
                    <p
                      className={`text-xs ${
                        tokenFeedback.success ? 'text-emerald-500' : 'text-red-500'
                      }`}
                    >
                      {tokenFeedback.message}
                    </p>
                  )}
                </div>
              )}

              {/* 1. Web App URL */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-neutral-800 dark:text-neutral-200 block">
                    {isAr ? '1. رابط فتح التطبيق داخل Telegram' : '1. Telegram Web App URL'}
                  </label>
                  {auth.publicUrl && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      <Globe className="w-3 h-3" />
                      {isAr ? 'نفق عام فعال (مباشر)' : 'Active Public Tunnel'}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1 p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-950 font-mono text-xs text-cyan-600 dark:text-cyan-400 truncate border border-neutral-200 dark:border-neutral-800">
                    {activeUrl}
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyUrl}
                    className="p-2.5 px-3.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                  >
                    {copiedUrl ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-neutral-950" />
                        <span>{isAr ? 'تم النسخ' : 'Copied'}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>{isAr ? 'نسخ الرابط' : 'Copy URL'}</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-neutral-500">
                  {isAr
                    ? 'هذا الرابط يعمل بشكل فعلي ومباشر داخل نافذة تيليجرام دون الحاجة لتسجيل دخول خارجي.'
                    : 'This URL works reliably inside Telegram Mini App without requiring external Google auth.'}
                </p>
              </div>

              {/* 2. Steps with BotFather */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-neutral-800 dark:text-neutral-200 block">
                  {isAr ? '2. خطوات ربط البوت عبر BotFather' : '2. Steps in @BotFather'}
                </label>

                <div className="space-y-2 text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                  <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950/40 border border-neutral-200 dark:border-neutral-800/80 flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </span>
                    <div>
                      <span className="font-semibold text-neutral-900 dark:text-white">
                        {isAr ? 'افتح بوت ' : 'Open '}
                        <a
                          href="https://t.me/BotFather"
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#24A1DE] underline"
                        >
                          @BotFather
                        </a>
                      </span>
                      <p className="text-[11px] text-neutral-500 mt-0.5">
                        {isAr
                          ? 'أنشئ بوتاً جديداً بأمر /newbot أو اختر بوتاً حالياً لديك، واحصل على رمز API Token.'
                          : 'Create a new bot via /newbot or pick an existing bot, and get your API Token.'}
                      </p>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950/40 border border-neutral-200 dark:border-neutral-800/80 flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </span>
                    <div>
                      <span className="font-semibold text-neutral-900 dark:text-white">
                        {isAr ? 'تفعيل زر القائمة ' : 'Enable Menu Button '}
                        <code className="text-cyan-500 font-mono">/setmenubutton</code>
                      </span>
                      <p className="text-[11px] text-neutral-500 mt-0.5">
                        {isAr
                          ? 'أرسل /setmenubutton في BotFather، اختر بوتك، ثم الصق رابط الـ Web App واكتب عنوان الزر: ✨ Soul-X App'
                          : 'Send /setmenubutton in BotFather, select your bot, paste your Web App URL and set title.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* One-Click Set Menu Button if Token is present */}
              {auth.botConfigured ? (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      {isAr
                        ? 'توكن البوت متصل في السيرفر بنجاح!'
                        : 'Bot Token active on server!'}
                    </span>
                  </div>
                  {auth.botInfo && (
                    <div className="text-xs text-neutral-600 dark:text-neutral-300 font-mono">
                      @{auth.botInfo.username} ({auth.botInfo.first_name})
                    </div>
                  )}
                  <button
                    type="button"
                    disabled={isSettingMenu}
                    onClick={handleSetMenuButton}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#24A1DE] hover:bg-[#208fcf] text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
                  >
                    {isSettingMenu ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    <span>
                      {isAr
                        ? 'تحديث وضبط زر القائمة (Menu Button) في البوت تلقائياً'
                        : 'Automatically Set Menu Button in Telegram Bot'}
                    </span>
                  </button>

                  {menuButtonResult && (
                    <p
                      className={`text-xs ${
                        menuButtonResult.success ? 'text-emerald-500' : 'text-red-500'
                      }`}
                    >
                      {menuButtonResult.message}
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          )}

          {activeTab === 'simulate' && (
            <div className="space-y-4">
              <div className="p-3 rounded-2xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                {isAr
                  ? 'يتيح لك هذا المحاكي تجربة ما يحدث تماماً عندما يضغط المستخدم على زر فتح تطبيق Soul-X من داخل تيليجرام: يتم التحقق بالسيرفر وتسجيل الدخول التلقائي بالبيانات أدناه.'
                  : 'This simulator lets you test the exact Telegram Mini App flow: generating signed payload, verifying on server via HMAC-SHA256, and logging in automatically.'}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    {isAr ? 'الاسم الكامل من Telegram' : 'Full Name'}
                  </label>
                  <input
                    type="text"
                    value={simName}
                    onChange={(e) => setSimName(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-cyan-500"
                    placeholder="سلطان الشمري"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    {isAr ? 'اسم المستخدم (Username)' : 'Username'}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-neutral-400 font-mono">
                      @
                    </span>
                    <input
                      type="text"
                      value={simUsername}
                      onChange={(e) => setSimUsername(e.target.value)}
                      className="w-full p-2.5 pl-7 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white font-mono focus:outline-none focus:border-cyan-500"
                      placeholder="sultan_sh"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    {isAr ? 'معرف تيليجرام (Telegram ID)' : 'Telegram ID'}
                  </label>
                  <input
                    type="text"
                    value={simId}
                    onChange={(e) => setSimId(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white font-mono focus:outline-none focus:border-cyan-500"
                    placeholder="694820153"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    {isAr ? 'لغة المستخدم (Language)' : 'Language Code'}
                  </label>
                  <select
                    value={simLang}
                    onChange={(e) => setSimLang(e.target.value as 'ar' | 'en')}
                    className="w-full p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="ar">العربية (Arabic - ar)</option>
                    <option value="en">English (en)</option>
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  disabled={simIsLoading}
                  onClick={handleSimulate}
                  className="w-full py-3 px-4 rounded-xl bg-[#24A1DE] hover:bg-[#208fcf] text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50"
                >
                  {simIsLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 -rotate-45" />
                  )}
                  <span>
                    {isAr
                      ? 'محاكاة فتح التطبيق من Telegram والتحقق بالسيرفر'
                      : 'Simulate Telegram Launch & Server Verification'}
                  </span>
                </button>
              </div>

              {auth.telegramUser && (
                <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                  <div className="text-xs text-neutral-500">
                    {isAr ? 'الحساب المربوط حالياً:' : 'Active linked account:'}{' '}
                    <span className="font-semibold text-neutral-900 dark:text-white">
                      {auth.telegramUser.first_name} (@{auth.telegramUser.username})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={auth.logoutTelegram}
                    className="text-xs text-red-500 hover:text-red-400 font-semibold cursor-pointer underline"
                  >
                    {isAr ? 'إلغاء الربط' : 'Unlink'}
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'code' && (
            <div className="space-y-4">
              <p className="text-xs text-neutral-500 leading-relaxed">
                {isAr
                  ? 'يمكنك نسخ هذا الكود ونشره في بوتك لفتح تطبيق Soul-X مباشرة داخل نافذة Telegram Mini App:'
                  : 'Ready-to-use bot code with direct in-app Telegram Web App button:'}
              </p>

              {/* Python Code */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  <span>Python (python-telegram-bot)</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator?.clipboard?.writeText(botPythonCode);
                      setCopiedCode(true);
                      setTimeout(() => setCopiedCode(false), 2000);
                    }}
                    className="text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {copiedCode ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedCode ? (isAr ? 'تم النسخ' : 'Copied') : isAr ? 'نسخ الكود' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="p-3 rounded-2xl bg-neutral-900 text-neutral-200 font-mono text-[11px] overflow-x-auto leading-relaxed border border-neutral-800" dir="ltr">
                  <code>{botPythonCode}</code>
                </pre>
              </div>

              {/* Node.js Code */}
              <div className="space-y-1.5 pt-2">
                <div className="flex items-center justify-between text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  <span>Node.js (Telegraf)</span>
                </div>
                <pre className="p-3 rounded-2xl bg-neutral-900 text-neutral-200 font-mono text-[11px] overflow-x-auto leading-relaxed border border-neutral-800" dir="ltr">
                  <code>{botNodeCode}</code>
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
