import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Wallet,
  Sparkles,
  Check,
  CreditCard,
  Gift,
  Flame,
  Clock,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Language } from '../types';

interface WalletViewProps {
  lang: Language;
  walletBalance: number;
  onRecharge: (amount: number) => void;
  onBack: () => void;
}

export const WalletView: React.FC<WalletViewProps> = ({
  lang,
  walletBalance,
  onRecharge,
  onBack,
}) => {
  const isAr = lang === 'ar';
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const handleTopUp = (amount: number) => {
    onRecharge(amount);
    setSuccessNotice(isAr ? `تمت إضافة +${amount} ماسة بنجاح!` : `Successfully added +${amount} diamonds!`);
    setTimeout(() => setSuccessNotice(null), 2500);
  };

  const packages = [
    { diamonds: 100, price: isAr ? '10 ر.س' : '$2.99', popular: false },
    { diamonds: 500, price: isAr ? '45 ر.س' : '$11.99', popular: false },
    { diamonds: 1000, price: isAr ? '80 ر.س' : '$19.99', popular: true, tag: isAr ? 'الأكثر طلباً' : 'Most Popular' },
    { diamonds: 2500, price: isAr ? '175 ر.س' : '$44.99', popular: false, tag: isAr ? 'باقة النخبة' : 'Elite Pack' },
  ];

  return (
    <div className="w-full flex-1 flex flex-col bg-neutral-50 dark:bg-neutral-950 animate-in fade-in duration-200">
      {/* Top Header with Back Button (شريط علوي مع زر عودة) */}
      <div className="sticky top-16 z-30 w-full bg-white/90 dark:bg-neutral-950/90 backdrop-blur-md border-b border-neutral-200 dark:border-neutral-800 transition-colors">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 text-sm font-semibold text-neutral-800 dark:text-neutral-200 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors cursor-pointer group"
          >
            {isAr ? (
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            ) : (
              <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
            )}
            <span>{isAr ? 'العودة للملف الشخصي' : 'Back to Profile'}</span>
          </button>

          <div className="flex items-center gap-2 text-xs font-mono text-neutral-500">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span>SOUL-X // WALLET</span>
          </div>
        </div>
      </div>

      {/* Main Full-Screen Content */}
      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8 flex-1">
        {/* Big Balance Showcase Card */}
        <div className="relative rounded-3xl p-8 sm:p-10 bg-gradient-to-br from-neutral-900 via-neutral-900 to-cyan-950 border border-cyan-500/30 shadow-2xl overflow-hidden text-center">
          {/* Ambient Glow */}
          <div className="absolute top-0 right-1/4 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-cyan-300 text-xs font-medium">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>{isAr ? 'رصيد محفظة Soul-X' : 'Soul-X Diamond Balance'}</span>
            </div>

            <div className="text-4xl sm:text-6xl font-black font-mono text-white tabular-nums flex items-center justify-center gap-3 pt-1">
              <span>{walletBalance.toLocaleString()}</span>
              {/* Diamond SVG */}
              <svg
                className="w-9 h-9 sm:w-12 sm:h-12 text-cyan-400 fill-cyan-400/20 stroke-cyan-400 stroke-[1.8] shrink-0"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <polygon points="6 3 18 3 22 9 12 22 2 9 6 3" />
                <polyline points="11 3 8 9 12 22 16 9 13 3" fill="none" />
                <line x1="2" y1="9" x2="22" y2="9" />
              </svg>
            </div>

            <p className="text-xs sm:text-sm text-neutral-400 max-w-sm mx-auto">
              {isAr
                ? 'استخدم الماسات لإرسال هدايا تفاعلية في الشات، وتفعيل ميزات المطابقة المميزة.'
                : 'Use diamonds to send interactive gifts in chat and activate match boosts.'}
            </p>

            {successNotice && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-semibold animate-in fade-in">
                <Check className="w-4 h-4" />
                <span>{successNotice}</span>
              </div>
            )}
          </div>
        </div>

        {/* Packages Grid (باقات الشحن) */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-cyan-500" />
              <span>{isAr ? 'شحن رصيد الماسات' : 'Top-Up Diamond Packages'}</span>
            </h2>
            <span className="text-xs text-neutral-500">
              {isAr ? 'شحن فوري وآمن 100%' : '100% Instant & Secure'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {packages.map((pkg) => (
              <div
                key={pkg.diamonds}
                className={`relative p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${
                  pkg.popular
                    ? 'bg-gradient-to-b from-cyan-950/30 to-neutral-900 border-cyan-500/50 shadow-lg'
                    : 'bg-white dark:bg-neutral-900/60 border-neutral-200 dark:border-neutral-800'
                }`}
              >
                {pkg.tag && (
                  <span className="absolute -top-2.5 right-4 px-2.5 py-0.5 rounded-full bg-cyan-400 text-neutral-950 font-bold text-[10px] tracking-wide">
                    {pkg.tag}
                  </span>
                )}

                <div>
                  <div className="flex items-center gap-2 text-2xl font-black font-mono text-neutral-900 dark:text-white tabular-nums mb-1">
                    <span>+{pkg.diamonds.toLocaleString()}</span>
                    <svg
                      className="w-5 h-5 text-cyan-500 fill-cyan-500/20 stroke-cyan-500 stroke-[1.8] shrink-0"
                      viewBox="0 0 24 24"
                    >
                      <polygon points="6 3 18 3 22 9 12 22 2 9 6 3" />
                      <polyline points="11 3 8 9 12 22 16 9 13 3" fill="none" />
                      <line x1="2" y1="9" x2="22" y2="9" />
                    </svg>
                  </div>
                  <div className="text-xs text-neutral-500 font-medium mb-4">
                    {pkg.price}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleTopUp(pkg.diamonds)}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 ${
                    pkg.popular
                      ? 'bg-cyan-400 hover:bg-cyan-300 text-neutral-950 shadow-md'
                      : 'bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white'
                  }`}
                >
                  <span>{isAr ? 'شحن الآن' : 'Recharge'}</span>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Benefits in Chat & Dating (ميزات الماسات في الشات والتعارف) */}
        <div className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 rounded-3xl p-6 sm:p-8 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            {isAr ? 'استخدامات رصيد المحفظة في Soul-X' : 'Wallet Benefits & Privileges'}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-100 dark:border-neutral-800/80">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
                <Gift className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-neutral-900 dark:text-white">
                  {isAr ? 'إرسال هدايا خاصة في الشات' : 'VIP Chat Gifts'}
                </div>
                <div className="text-[11px] text-neutral-500 mt-0.5 leading-relaxed">
                  {isAr ? 'لفت انتباه الشريك بهدايا حصرية تكسر الجليد.' : 'Stand out with animated tokens.'}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-100 dark:border-neutral-800/80">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center shrink-0">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-neutral-900 dark:text-white">
                  {isAr ? 'مضاعفة ظهور الملف (Super Boost)' : 'Super Boost'}
                </div>
                <div className="text-[11px] text-neutral-500 mt-0.5 leading-relaxed">
                  {isAr ? 'ظهور ملفك كأولوية قصوى في رادار المطابقة.' : 'Priority visibility on the match radar.'}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-100 dark:border-neutral-800/80">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-neutral-900 dark:text-white">
                  {isAr ? 'أمان وضمان كامل' : 'Guaranteed Protection'}
                </div>
                <div className="text-[11px] text-neutral-500 mt-0.5 leading-relaxed">
                  {isAr ? 'عمليات دفع مشفرة ودعم فني مخصص على مدار الساعة.' : 'Encrypted transactions with 24/7 support.'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Transaction History (سجل المعاملات الأخير) */}
        <div className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 rounded-3xl p-6 sm:p-8 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-500" />
              <span>{isAr ? 'سجل العمليات الأخير' : 'Recent Transactions'}</span>
            </h3>
            <span className="text-xs font-mono text-neutral-500">Live Sync</span>
          </div>

          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            <div className="py-3.5 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-neutral-900 dark:text-white">
                  {isAr ? 'مكافأة الانضمام إلى Soul-X' : 'Soul-X Welcome Bonus'}
                </div>
                <div className="text-[10px] text-neutral-500">14 أكتوبر 1998 · 10:00 AM</div>
              </div>
              <div className="flex items-center gap-1 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                <span>+1,000</span>
                <svg
                  className="w-3.5 h-3.5 text-emerald-500 fill-emerald-500/20 stroke-emerald-500 stroke-[1.8] shrink-0"
                  viewBox="0 0 24 24"
                >
                  <polygon points="6 3 18 3 22 9 12 22 2 9 6 3" />
                  <polyline points="11 3 8 9 12 22 16 9 13 3" fill="none" />
                  <line x1="2" y1="9" x2="22" y2="9" />
                </svg>
              </div>
            </div>

            <div className="py-3.5 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-neutral-900 dark:text-white">
                  {isAr ? 'هدية تفاعلية تم إرسالها في الشات' : 'Gift sent in chat'}
                </div>
                <div className="text-[10px] text-neutral-500">اليوم · 03:45 PM</div>
              </div>
              <div className="flex items-center gap-1 text-xs font-mono font-bold text-neutral-500">
                <span>-50</span>
                <svg
                  className="w-3.5 h-3.5 text-neutral-400 fill-neutral-400/20 stroke-neutral-400 stroke-[1.8] shrink-0"
                  viewBox="0 0 24 24"
                >
                  <polygon points="6 3 18 3 22 9 12 22 2 9 6 3" />
                  <polyline points="11 3 8 9 12 22 16 9 13 3" fill="none" />
                  <line x1="2" y1="9" x2="22" y2="9" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
