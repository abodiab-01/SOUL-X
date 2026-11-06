import React, { useState } from 'react';
import {
  Sparkles,
  MessageCircle,
  Heart,
  Coins,
  Copy,
  Check,
  ShieldCheck,
  Zap,
  ArrowRight,
  ArrowLeft,
  Users,
} from 'lucide-react';
import { Language, AuthUser } from '../types';
import { getDefaultAvatar, getEffectiveAvatar } from '../lib/avatar';

interface HomeViewProps {
  lang: Language;
  currentUser: AuthUser | null;
  onNavigateToTab: (tab: 'home' | 'match' | 'chats' | 'account') => void;
  onGoToChat: (friendName?: string) => void;
  onOpenWallet: () => void;
  onOpenSearch?: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  lang,
  currentUser,
  onNavigateToTab,
  onGoToChat,
  onOpenWallet,
  onOpenSearch,
}) => {
  const isAr = lang === 'ar';
  const [copiedId, setCopiedId] = useState(false);

  const effectiveAvatar = getEffectiveAvatar(currentUser?.photoUrl, currentUser?.gender);
  const displayName = currentUser?.name || (isAr ? 'عضو مميز' : 'Special Member');
  const myDisplayId = currentUser?.displayId || currentUser?.id || 'S-0101V77-X711';

  const handleCopyId = () => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(myDisplayId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleTriggerSearch = () => {
    if (onOpenSearch) {
      onOpenSearch();
    } else if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('soulx:open-search'));
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col py-3 px-3 sm:px-6 space-y-6 animate-in fade-in duration-300">
      {/* 1. Hero Welcoming Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-white via-cyan-50/40 to-white dark:from-neutral-900 dark:via-cyan-950/20 dark:to-neutral-900 border border-neutral-200/80 dark:border-neutral-800 p-6 sm:p-8 shadow-sm">
        {/* Glow ambient background accents */}
        <div className="absolute -top-12 -left-12 w-48 h-48 bg-cyan-500/10 dark:bg-cyan-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -right-10 w-44 h-44 bg-cyan-400/10 dark:bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start justify-between gap-5 text-center sm:text-start">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="relative shrink-0">
              <img
                src={effectiveAvatar}
                alt={displayName}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = getDefaultAvatar(currentUser?.gender);
                }}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-2 border-cyan-400 shadow-md"
              />
              <span className="w-4 h-4 rounded-full bg-emerald-500 border-2 border-white dark:border-neutral-900 absolute bottom-0 right-0" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">
                  Soul—X Network
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20">
                  {isAr ? 'متصل' : 'Active'}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-neutral-900 dark:text-white">
                {isAr ? `أهلاً بك، ${displayName}` : `Welcome back, ${displayName}`}
              </h1>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-md">
                {isAr
                  ? 'منصتك الموثوقة لتوافق الأرواح، التعارف الصادق، والدردشة الآمنة بين الأعضاء.'
                  : 'Your trusted platform for soul connection, authentic matching, and private conversations.'}
              </p>
            </div>
          </div>

          {/* User ID Pill with quick copy */}
          <div className="flex items-center gap-2 bg-neutral-100 dark:bg-neutral-950/80 border border-neutral-200 dark:border-neutral-800 px-3 py-2 rounded-2xl shrink-0">
            <div className="text-start">
              <span className="text-[10px] text-neutral-400 block font-medium">
                {isAr ? 'معرفك الخاص:' : 'Your ID:'}
              </span>
              <span className="font-mono text-xs font-bold text-neutral-900 dark:text-neutral-100">
                {myDisplayId}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopyId}
              className="p-1.5 rounded-xl hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-500 hover:text-cyan-500 transition-colors cursor-pointer"
              title={isAr ? 'نسخ معرفي' : 'Copy my ID'}
            >
              {copiedId ? (
                <Check className="w-4 h-4 text-emerald-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 2. Primary Navigation Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: توافق الأرواح */}
        <div
          onClick={() => onNavigateToTab('match')}
          className="group relative overflow-hidden rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 shadow-sm hover:shadow-md hover:border-cyan-500/50 transition-all cursor-pointer flex flex-col justify-between space-y-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-500/20 group-hover:scale-105 transition-transform">
              <Heart className="w-6 h-6 stroke-[2.2]" />
            </div>
            <span className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 px-2.5 py-1 rounded-xl">
              {isAr ? 'توافق فوري' : 'Instant Match'}
            </span>
          </div>

          <div className="space-y-1">
            <h2 className="text-base sm:text-lg font-black text-neutral-900 dark:text-white flex items-center gap-2">
              <span>{isAr ? 'توافق الأرواح' : 'Soul Matching'}</span>
              <Sparkles className="w-4 h-4 text-cyan-500" />
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
              {isAr
                ? 'استكشف الأشخاص المتوافقين معك فكرياً وروحياً بناءً على معايير دقيقة واهتمامات مشتركة.'
                : 'Discover individuals resonating with your spirit and shared interests instantly.'}
            </p>
          </div>

          <div className="pt-2 flex items-center gap-1.5 text-xs font-bold text-cyan-600 dark:text-cyan-400 group-hover:gap-2 transition-all">
            <span>{isAr ? 'ابدأ الاستكشاف الآن' : 'Start Exploring'}</span>
            {isAr ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
          </div>
        </div>

        {/* Card 2: المحادثات والدردشة */}
        <div
          onClick={() => onGoToChat()}
          className="group relative overflow-hidden rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 shadow-sm hover:shadow-md hover:border-cyan-500/50 transition-all cursor-pointer flex flex-col justify-between space-y-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-500/20 group-hover:scale-105 transition-transform">
              <MessageCircle className="w-6 h-6 stroke-[2.2]" />
            </div>
            <span className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 px-2.5 py-1 rounded-xl">
              {isAr ? 'محادثات خاصة' : 'Private Chats'}
            </span>
          </div>

          <div className="space-y-1">
            <h2 className="text-base sm:text-lg font-black text-neutral-900 dark:text-white flex items-center gap-2">
              <span>{isAr ? 'الدردشات والرسائل' : 'Chats & Messages'}</span>
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
              {isAr
                ? 'تواصل مع أصدقائك في بيئة محادثة سلسة وسريعة مع حماية تامة للخصوصية.'
                : 'Connect with friends in a fluid, real-time messaging space with complete privacy.'}
            </p>
          </div>

          <div className="pt-2 flex items-center gap-1.5 text-xs font-bold text-cyan-600 dark:text-cyan-400 group-hover:gap-2 transition-all">
            <span>{isAr ? 'فتح المحادثات' : 'Open Chats'}</span>
            {isAr ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
          </div>
        </div>

        {/* Card 3: المحفظة والرصيد */}
        <div
          onClick={onOpenWallet}
          className="group relative overflow-hidden rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 shadow-sm hover:shadow-md hover:border-cyan-500/50 transition-all cursor-pointer flex flex-col justify-between space-y-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 border border-amber-500/20 group-hover:scale-105 transition-transform">
              <Coins className="w-6 h-6 stroke-[2.2]" />
            </div>
            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-xl">
              {isAr ? 'الرصيد والعملات' : 'Wallet & Coins'}
            </span>
          </div>

          <div className="space-y-1">
            <h2 className="text-base sm:text-lg font-black text-neutral-900 dark:text-white flex items-center gap-2">
              <span>{isAr ? 'المحفظة والهدايا' : 'Wallet & Gifts'}</span>
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
              {isAr
                ? 'إدارة رصيد الماس والعملات الذهبية، شحن الرصيد، وإرسال الهدايا التفاعلية للأصدقاء.'
                : 'Manage diamonds and gold coins, recharge balances, and send interactive gifts.'}
            </p>
          </div>

          <div className="pt-2 flex items-center gap-1.5 text-xs font-bold text-cyan-600 dark:text-cyan-400 group-hover:gap-2 transition-all">
            <span>{isAr ? 'عرض المحفظة' : 'View Wallet'}</span>
            {isAr ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
          </div>
        </div>

        {/* Card 4: البحث عن الأصدقاء بالمعرف أو الباركود */}
        <div
          onClick={handleTriggerSearch}
          className="group relative overflow-hidden rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 shadow-sm hover:shadow-md hover:border-cyan-500/50 transition-all cursor-pointer flex flex-col justify-between space-y-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-500/20 group-hover:scale-105 transition-transform">
              <Users className="w-6 h-6 stroke-[2.2]" />
            </div>
            <span className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 px-2.5 py-1 rounded-xl">
              {isAr ? 'بحث فوري' : 'Quick Search'}
            </span>
          </div>

          <div className="space-y-1">
            <h2 className="text-base sm:text-lg font-black text-neutral-900 dark:text-white flex items-center gap-2">
              <span>{isAr ? 'البحث عن أصدقاء' : 'Find Friends'}</span>
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
              {isAr
                ? 'ابحث بالمعرف الرقمي الخاص بالصديق أو امسح رمز الباركود فورياً للتواصل معه.'
                : 'Search by friend ID or scan a barcode/QR code to connect instantly.'}
            </p>
          </div>

          <div className="pt-2 flex items-center gap-1.5 text-xs font-bold text-cyan-600 dark:text-cyan-400 group-hover:gap-2 transition-all">
            <span>{isAr ? 'فتح البحث والمسح' : 'Open Search & Scanner'}</span>
            {isAr ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
          </div>
        </div>
      </div>

      {/* 3. Safety & Trust Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
        <div className="p-4 rounded-2xl bg-white/70 dark:bg-neutral-900/70 border border-neutral-200/60 dark:border-neutral-800/60 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-neutral-900 dark:text-white">
              {isAr ? 'أمان وخصوصية' : 'Encrypted & Safe'}
            </h3>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
              {isAr ? 'بياناتك ومحادثاتك محمية' : 'Protected private data'}
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white/70 dark:bg-neutral-900/70 border border-neutral-200/60 dark:border-neutral-800/60 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-neutral-900 dark:text-white">
              {isAr ? 'سرعة فائقة' : 'Ultra Fast'}
            </h3>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
              {isAr ? 'اتصال وتوافق لحظي' : 'Real-time responsiveness'}
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white/70 dark:bg-neutral-900/70 border border-neutral-200/60 dark:border-neutral-800/60 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-neutral-900 dark:text-white">
              {isAr ? 'توافق ذكي' : 'Smart Resonance'}
            </h3>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
              {isAr ? 'اهتمامات وتوافق حقيقي' : 'Meaningful connections'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
