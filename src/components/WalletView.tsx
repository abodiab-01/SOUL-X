import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Check,
  Copy,
  ShieldCheck,
  Zap,
  ArrowDownLeft,
  ArrowUpRight,
  Send,
  MessageCircle,
  Clock,
  Star,
  Search,
  Filter,
  CheckCircle2,
  X,
  CreditCard,
  Building2,
  Globe,
  BadgeAlert,
  Wallet,
} from 'lucide-react';
import { Language, AuthUser } from '../types';

export interface WalletAgent {
  id: string;
  nameAr: string;
  nameEn: string;
  taglineAr: string;
  taglineEn: string;
  country: string;
  flag: string;
  category: 'recharge' | 'withdraw' | 'both';
  methods: string[];
  responseTimeAr: string;
  responseTimeEn: string;
  rating: number;
  completedOrders: number;
  whatsapp: string;
  telegram: string;
  isOnline: boolean;
  minAmount: number;
  maxAmount: number;
  rateNoteAr: string;
  rateNoteEn: string;
}

const ACCREDITED_AGENTS: WalletAgent[] = [
  {
    id: 'agent-1',
    nameAr: 'وكالة الفهد المعتمدة (الخليج والسعودية)',
    nameEn: 'Al-Fahad Certified Agency (KSA & Gulf)',
    taglineAr: 'الوكيل الذهبي الأول المعتمد في السعودية والإمارات والكويت',
    taglineEn: 'Top-tier certified agent for Saudi Arabia, UAE & Kuwait',
    country: 'السعودية والخليج',
    flag: '🇸🇦',
    category: 'both',
    methods: ['STC Pay', 'Urpay', 'تحويل الراجحي', 'مدى Mada', 'Apple Pay'],
    responseTimeAr: 'رد فوري (أقل من دقيقة)',
    responseTimeEn: 'Instant reply (< 1 min)',
    rating: 4.98,
    completedOrders: 14850,
    whatsapp: '+966500000001',
    telegram: 'AlFahad_SoulX',
    isOnline: true,
    minAmount: 100,
    maxAmount: 100000,
    rateNoteAr: '1,000 ماسة = 40 ر.س | سحب فوري بدون عمولة إضافية',
    rateNoteEn: '1,000 Diamonds = 40 SAR | Instant 0% fee cashout',
  },
  {
    id: 'agent-2',
    nameAr: 'سول-إكس جلوبال كاش (USDT وعالمي)',
    nameEn: 'Soul-X Global Cash (USDT & International)',
    taglineAr: 'شحن وسحب دولي عبر العملات الرقمية والبطاقات الدولية',
    taglineEn: 'Global crypto recharge & cashout worldwide 24/7',
    country: 'عالمي / دولي',
    flag: '🌐',
    category: 'both',
    methods: ['USDT (TRC20)', 'Binance Pay', 'USDT (BEP20)', 'Visa / MasterCard'],
    responseTimeAr: 'فوري على مدار 24/7',
    responseTimeEn: '24/7 Automated sync',
    rating: 4.99,
    completedOrders: 28340,
    whatsapp: '+14155552671',
    telegram: 'SoulX_GlobalPay',
    isOnline: true,
    minAmount: 250,
    maxAmount: 500000,
    rateNoteAr: '1,000 ماسة = 10.00 $ USDT | تنفيذ تلقائي وموثق',
    rateNoteEn: '1,000 Diamonds = 10.00 USDT | Fast automated settlement',
  },
  {
    id: 'agent-3',
    nameAr: 'وكالة الأهرام للخدمات المالية (مصر)',
    nameEn: 'Al-Ahram Financial Services (Egypt)',
    taglineAr: 'الوكيل الرسمي المعتمد في جمهورية مصر العربية',
    taglineEn: 'Official certified agent across Egypt',
    country: 'مصر',
    flag: '🇪🇬',
    category: 'both',
    methods: ['فودافون كاش', 'انستاباي InstaPay', 'أورانج كاش', 'فوري Fawry'],
    responseTimeAr: 'رد سريع (1-3 دقائق)',
    responseTimeEn: 'Fast reply (1-3 mins)',
    rating: 4.95,
    completedOrders: 19420,
    whatsapp: '+201000000002',
    telegram: 'Ahram_SoulX_Egypt',
    isOnline: true,
    minAmount: 100,
    maxAmount: 80000,
    rateNoteAr: '1,000 ماسة = 500 جنيه مصري | سحب واستلام كاش فوري',
    rateNoteEn: '1,000 Diamonds = 500 EGP | Instant InstaPay cashout',
  },
  {
    id: 'agent-4',
    nameAr: 'وكالة دجلة والفرات (العراق والشرق الأوسط)',
    nameEn: 'Tigris & Euphrates Exchange (Iraq)',
    taglineAr: 'المعتمد الأول لكافة محافظ وبنوك العراق',
    taglineEn: 'Leading certified partner across Iraq financial networks',
    country: 'العراق',
    flag: '🇮🇶',
    category: 'both',
    methods: ['زين كاش ZainCash', 'آسيا حوالة', 'كي كارد Qi Card', 'FIB'],
    responseTimeAr: 'متصل الآن (أقل من دقيقتين)',
    responseTimeEn: 'Online now (< 2 mins)',
    rating: 4.96,
    completedOrders: 12100,
    whatsapp: '+9647700000003',
    telegram: 'Dijla_SoulX',
    isOnline: true,
    minAmount: 100,
    maxAmount: 120000,
    rateNoteAr: '1,000 ماسة = 14,000 دينار عراقي | تحويل زين كاش فوري',
    rateNoteEn: '1,000 Diamonds = 14,000 IQD | Direct ZainCash payout',
  },
  {
    id: 'agent-5',
    nameAr: 'وكالة برزان السريعة للشحن (الخليج)',
    nameEn: 'Barzan Express Recharge (Gulf Region)',
    taglineAr: 'وكيل شحن فوري بخصومات حصرية للباقات الكبرى',
    taglineEn: 'Instant top-up agency with VIP volume discounts',
    country: 'الخليج العربي',
    flag: '🇦🇪',
    category: 'recharge',
    methods: ['STC Pay', 'حوالة مصرفية', 'KNET', 'بنك أبوظبي الأول'],
    responseTimeAr: 'رد فوري على مدار الساعة',
    responseTimeEn: 'Instant round-the-clock',
    rating: 4.94,
    completedOrders: 9800,
    whatsapp: '+971500000004',
    telegram: 'Barzan_TopUp',
    isOnline: true,
    minAmount: 200,
    maxAmount: 250000,
    rateNoteAr: 'عروض شحن مميزة وهدايا إضافية +5% على الباقات الكبيرة',
    rateNoteEn: 'Special recharge deals + 5% bonus on bulk top-ups',
  },
  {
    id: 'agent-6',
    nameAr: 'وكالة الأمان لكاش أوت وسحب الأرباح',
    nameEn: 'Al-Aman Cashout & Earnings Withdrawal',
    taglineAr: 'متخصصون حصرياً في سحب أرباح المبدعين وصناع المحتوى',
    taglineEn: 'Specialized in creators & match earnings cashouts',
    country: 'دولي ومتعدد',
    flag: '🌐',
    category: 'withdraw',
    methods: ['USDT TRC20', 'Western Union', 'تحويل بنكي IBAN', 'Wise'],
    responseTimeAr: 'متصل (معالجة خلال 10 دقائق)',
    responseTimeEn: 'Online (processed within 10 mins)',
    rating: 4.97,
    completedOrders: 16700,
    whatsapp: '+966500000005',
    telegram: 'AlAman_Cashout',
    isOnline: true,
    minAmount: 500,
    maxAmount: 300000,
    rateNoteAr: 'أعلى سعر صرف للسحب وسرعة إيداع مضمونة بحسابك',
    rateNoteEn: 'Best exchange rate guarantee with direct IBAN settlement',
  },
];

interface WalletViewProps {
  lang: Language;
  walletBalance: number;
  onRecharge: (amount: number) => void;
  onWithdraw?: (amount: number) => void;
  onBack: () => void;
  currentUser?: AuthUser | null;
}

export const WalletView: React.FC<WalletViewProps> = ({
  lang,
  walletBalance,
  onRecharge,
  onWithdraw,
  onBack,
  currentUser,
}) => {
  const isAr = lang === 'ar';
  const [filterType, setFilterType] = useState<'all' | 'recharge' | 'withdraw'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState(false);
  const [activeModalAgent, setActiveModalAgent] = useState<{
    agent: WalletAgent;
    type: 'recharge' | 'withdraw';
  } | null>(null);

  // Modal interactive form state
  const [requestDiamonds, setRequestDiamonds] = useState<number>(500);
  const [paymentAccountInput, setPaymentAccountInput] = useState('');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [orderSuccessMessage, setOrderSuccessMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Unique Wallet reference code
  const userWalletId = currentUser?.id
    ? `SX-${currentUser.id.slice(0, 6).toUpperCase()}`
    : 'SX-884920';

  const handleCopyWalletId = () => {
    navigator.clipboard?.writeText(userWalletId);
    setCopiedId(true);
    setSuccessToast(isAr ? 'تم نسخ معرّف المحفظة بنجاح!' : 'Wallet ID copied to clipboard!');
    setTimeout(() => {
      setCopiedId(false);
      setSuccessToast(null);
    }, 2500);
  };

  // Filter agents
  const filteredAgents = ACCREDITED_AGENTS.filter((agent) => {
    const matchesFilter =
      filterType === 'all'
        ? true
        : filterType === 'recharge'
        ? agent.category === 'recharge' || agent.category === 'both'
        : agent.category === 'withdraw' || agent.category === 'both';

    const matchesQuery =
      searchQuery.trim() === ''
        ? true
        : agent.nameAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
          agent.nameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
          agent.country.toLowerCase().includes(searchQuery.toLowerCase()) ||
          agent.methods.some((m) => m.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesFilter && matchesQuery;
  });

  const rechargeAgentsCount = ACCREDITED_AGENTS.filter(
    (a) => a.category === 'recharge' || a.category === 'both'
  ).length;

  const withdrawAgentsCount = ACCREDITED_AGENTS.filter(
    (a) => a.category === 'withdraw' || a.category === 'both'
  ).length;

  // Handle direct request submission
  const handleSubmitAgentOrder = () => {
    if (!activeModalAgent) return;
    const isWithdraw = activeModalAgent.type === 'withdraw';

    if (isWithdraw && requestDiamonds > walletBalance) {
      alert(
        isAr
          ? 'عذراً، رصيدك الحالي من الماسات لا يكفي لإتمام هذا السحب.'
          : 'Insufficient diamond balance for this withdrawal.'
      );
      return;
    }

    setIsSubmittingOrder(true);
    setTimeout(() => {
      setIsSubmittingOrder(false);
      if (isWithdraw) {
        if (onWithdraw) {
          onWithdraw(requestDiamonds);
        } else {
          onRecharge(-requestDiamonds);
        }
        setOrderSuccessMessage(
          isAr
            ? `تم رفع طلب السحب بقيمة ${requestDiamonds.toLocaleString()} ماسة للوكيل ${activeModalAgent.agent.nameAr} بنجاح! سيتم التحويل إلى حسابك خلال دقائق.`
            : `Withdrawal request for ${requestDiamonds.toLocaleString()} diamonds submitted successfully!`
        );
      } else {
        onRecharge(requestDiamonds);
        setOrderSuccessMessage(
          isAr
            ? `تم إرسال طلب الشحن بقيمة +${requestDiamonds.toLocaleString()} ماسة للوكيل ${activeModalAgent.agent.nameAr} وتم تأكيد العملية فورياً!`
            : `Recharge request for +${requestDiamonds.toLocaleString()} diamonds submitted and credited!`
        );
      }
    }, 1200);
  };

  const handleOpenContact = (agent: WalletAgent, platform: 'whatsapp' | 'telegram') => {
    const textMsg = isAr
      ? `السلام عليكم، أود التواصل بخصوص محفظة Soul-X.\nمعرف محفظتي: ${userWalletId}\nحسابي: ${
          currentUser?.name || 'مستخدم Soul-X'
        }`
      : `Hello, I want to contact you regarding Soul-X wallet.\nWallet ID: ${userWalletId}\nName: ${
          currentUser?.name || 'Soul-X User'
        }`;

    if (platform === 'whatsapp') {
      window.open(
        `https://wa.me/${agent.whatsapp.replace(/\+/g, '')}?text=${encodeURIComponent(textMsg)}`,
        '_blank'
      );
    } else {
      window.open(`https://t.me/${agent.telegram}`, '_blank');
    }
  };

  return (
    <div className="w-full flex-1 flex flex-col bg-neutral-50 dark:bg-neutral-950 animate-in fade-in duration-200">
      {/* Top sticky bar */}
      <div className="sticky top-16 z-30 w-full bg-white/90 dark:bg-neutral-950/90 backdrop-blur-md border-b border-neutral-200 dark:border-neutral-800 transition-colors">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
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
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold">{isAr ? 'شبكة الوكلاء المعتمدة' : 'OFFICIAL AGENTS NETWORK'}</span>
          </div>
        </div>
      </div>

      {/* Floating success toast */}
      {successToast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-emerald-500 text-white font-semibold text-xs shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Main Content Area */}
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8 flex-1">
        {/* ========================================================
            1. كرت رصيد الماس في رأس الصفحة (Hero Diamond Balance Card)
            ======================================================== */}
        <div className="relative rounded-3xl p-6 sm:p-10 bg-gradient-to-br from-neutral-900 via-neutral-900 to-cyan-950 border border-cyan-500/30 shadow-2xl overflow-hidden text-neutral-100">
          {/* Ambient luminous glow effects */}
          <div className="absolute top-0 right-1/4 w-80 h-80 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -top-12 -left-12 w-48 h-48 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Left/Main Column: Diamond Counter & Metadata */}
            <div className="text-center md:text-start space-y-3 w-full md:w-auto">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 backdrop-blur-md border border-cyan-500/25 text-cyan-300 text-xs font-medium">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>{isAr ? 'رصيد محفظة الماس — Soul-X' : 'Soul-X Diamond Balance'}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                <span className="text-[11px] text-cyan-400 font-mono">100% مضمون ومؤمن</span>
              </div>

              {/* Big Diamond Number Display */}
              <div className="flex items-center justify-center md:justify-start gap-4">
                <div className="relative">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-cyan-400/10 border border-cyan-400/30 flex items-center justify-center shadow-inner">
                    <svg
                      className="w-8 h-8 sm:w-10 sm:h-10 text-cyan-400 fill-cyan-400/20 stroke-cyan-400 stroke-[1.8] drop-shadow-[0_0_12px_rgba(34,211,238,0.5)]"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <polygon points="6 3 18 3 22 9 12 22 2 9 6 3" />
                      <polyline points="11 3 8 9 12 22 16 9 13 3" fill="none" />
                      <line x1="2" y1="9" x2="22" y2="9" />
                    </svg>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-neutral-900 flex items-center justify-center text-[10px] text-white">
                    ✓
                  </div>
                </div>

                <div>
                  <div className="text-4xl sm:text-6xl font-black font-mono tracking-tight text-white tabular-nums flex items-baseline gap-2">
                    <span>{walletBalance.toLocaleString()}</span>
                    <span className="text-sm sm:text-base font-semibold font-sans text-cyan-400">
                      {isAr ? 'ماسة' : 'Diamonds'}
                    </span>
                  </div>
                  <div className="text-xs sm:text-sm text-neutral-400 font-mono mt-0.5">
                    {isAr
                      ? `القيمة التقديرية: ≈ ${(walletBalance * 0.04).toFixed(2)} ر.س / ${(
                          walletBalance * 0.01
                        ).toFixed(2)} $ USDT`
                      : `Estimated value: ≈ $${(walletBalance * 0.01).toFixed(2)} USD`}
                  </div>
                </div>
              </div>

              {/* User ID reference chip with copy */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-1 text-xs">
                <span className="text-neutral-400">{isAr ? 'معرّف محفظتك الموحد:' : 'Your Wallet ID:'}</span>
                <button
                  type="button"
                  onClick={handleCopyWalletId}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-neutral-800/90 hover:bg-neutral-800 text-cyan-300 font-mono font-bold border border-cyan-500/20 hover:border-cyan-500/40 transition-colors cursor-pointer active:scale-95"
                  title={isAr ? 'انقر لنسخ المعرف' : 'Click to copy ID'}
                >
                  <span>{userWalletId}</span>
                  {copiedId ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-cyan-400" />
                  )}
                </button>
                <span className="text-[11px] text-neutral-500">
                  {isAr ? '(أعطه للوكيل لإتمام الشحن أو السحب)' : '(Share with agent for deposit/cashout)'}
                </span>
              </div>
            </div>

            {/* Right Column: Quick Action buttons */}
            <div className="flex flex-col sm:flex-row md:flex-col gap-3 w-full md:w-64 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setFilterType('recharge');
                  const el = document.getElementById('agents-section');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-cyan-400 to-cyan-500 hover:from-cyan-300 hover:to-cyan-400 text-neutral-950 font-bold text-sm shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
              >
                <Zap className="w-4 h-4 fill-neutral-950" />
                <span>{isAr ? 'شحن رصيد مع وكيل ⚡' : 'Recharge Diamonds ⚡'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFilterType('withdraw');
                  const el = document.getElementById('agents-section');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="w-full py-3.5 px-5 rounded-2xl bg-neutral-800/90 hover:bg-neutral-800 text-white font-semibold text-sm border border-neutral-700/80 hover:border-emerald-500/40 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
              >
                <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                <span>{isAr ? 'سحب رصيد وأرباح 💸' : 'Withdraw / Cashout 💸'}</span>
              </button>
            </div>
          </div>

          {/* Quick Security Trust Bar */}
          <div className="mt-6 pt-5 border-t border-neutral-800/80 flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-400">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{isAr ? 'ضمان مالي بنسبة 100% مودع لدى إدارة Soul-X' : '100% Escrow Protection via Soul-X'}</span>
            </div>
            <div className="flex items-center gap-4 text-[11px] font-mono text-neutral-400">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                {isAr ? 'جميع الوكلاء متصلون' : 'Agents Online'}
              </span>
              <span>⚡ {isAr ? 'متوسط سرعة التنفيذ: 3 دقائق' : 'Avg. speed: 3 mins'}</span>
            </div>
          </div>
        </div>

        {/* ========================================================
            2. قسم وكلاء الشحن و السحب (Agents Section)
            ======================================================== */}
        <div id="agents-section" className="space-y-6 pt-2">
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-neutral-900 dark:text-white flex items-center gap-2.5">
                <Building2 className="w-6 h-6 text-cyan-500" />
                <span>{isAr ? 'وكلاء الشحن والسحب المعتمدون' : 'Accredited Deposit & Cashout Agents'}</span>
              </h2>
              <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                {isAr
                  ? 'اختر الوكيل المناسب لبلدك وطريقة دفعك للتواصل المباشر والشحن أو سحب الأرباح فورياً.'
                  : 'Select an authorized agent for your region and payment method.'}
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 p-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setFilterType('all')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  filterType === 'all'
                    ? 'bg-neutral-900 text-white dark:bg-cyan-400 dark:text-neutral-950 shadow-sm'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                {isAr ? `الكل (${ACCREDITED_AGENTS.length})` : `All (${ACCREDITED_AGENTS.length})`}
              </button>

              <button
                type="button"
                onClick={() => setFilterType('recharge')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  filterType === 'recharge'
                    ? 'bg-cyan-400 text-neutral-950 shadow-sm'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>{isAr ? `وكلاء الشحن (${rechargeAgentsCount})` : `Recharge (${rechargeAgentsCount})`}</span>
              </button>

              <button
                type="button"
                onClick={() => setFilterType('withdraw')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  filterType === 'withdraw'
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>{isAr ? `وكلاء السحب (${withdrawAgentsCount})` : `Cashout (${withdrawAgentsCount})`}</span>
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 right-4 rtl:right-4 rtl:left-auto ltr:left-4 ltr:right-auto text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                isAr
                  ? 'ابحث باسم الوكيل، البلد (السعودية، مصر، العراق)، أو طريقة الدفع (STC Pay، فودافون كاش، USDT)...'
                  : 'Search by agent name, country, or payment method...'
              }
              className="w-full h-11 pr-11 pl-4 rtl:pr-11 rtl:pl-4 ltr:pl-11 ltr:pr-4 rounded-2xl bg-white dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-800 text-xs sm:text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:border-cyan-500 transition-colors shadow-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute top-1/2 -translate-y-1/2 left-3 rtl:left-3 rtl:right-auto ltr:right-3 ltr:left-auto text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Agents Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredAgents.map((agent) => (
              <div
                key={agent.id}
                className="relative rounded-3xl p-5 sm:p-6 bg-white dark:bg-neutral-900/70 border border-neutral-200/90 dark:border-neutral-800 shadow-sm hover:shadow-md hover:border-cyan-500/40 transition-all flex flex-col justify-between group"
              >
                {/* Agent Header */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-neutral-100 to-neutral-200 dark:from-neutral-800 dark:to-neutral-900 border border-neutral-200 dark:border-neutral-700/60 flex items-center justify-center text-xl shadow-sm shrink-0">
                        <span>{agent.flag}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-bold text-sm sm:text-base text-neutral-900 dark:text-white group-hover:text-cyan-500 transition-colors">
                            {isAr ? agent.nameAr : agent.nameEn}
                          </h3>
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-[10px] font-semibold border border-cyan-500/20"
                            title={isAr ? 'وكيل معتمد وموثق' : 'Verified Agent'}
                          >
                            <ShieldCheck className="w-3 h-3 text-cyan-500" />
                            <span>{isAr ? 'معتمد' : 'Verified'}</span>
                          </span>
                        </div>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                          {isAr ? agent.taglineAr : agent.taglineEn}
                        </p>
                      </div>
                    </div>

                    {/* Agent Status Badge */}
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[11px] font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>{isAr ? 'متصل' : 'Online'}</span>
                      </span>
                    </div>
                  </div>

                  {/* Rating & Orders */}
                  <div className="flex items-center gap-4 text-xs text-neutral-500 dark:text-neutral-400 border-y border-neutral-100 dark:border-neutral-800/80 py-2.5">
                    <div className="flex items-center gap-1 text-amber-500 font-bold">
                      <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                      <span>{agent.rating}</span>
                    </div>
                    <span>•</span>
                    <div className="font-mono text-neutral-600 dark:text-neutral-300">
                      {agent.completedOrders.toLocaleString()}{' '}
                      <span className="text-neutral-400">{isAr ? 'عملية منجزة' : 'orders'}</span>
                    </div>
                    <span>•</span>
                    <div className="flex items-center gap-1 text-neutral-500">
                      <Clock className="w-3 h-3 text-cyan-500" />
                      <span>{isAr ? agent.responseTimeAr : agent.responseTimeEn}</span>
                    </div>
                  </div>

                  {/* Rate note / Exchange rule */}
                  <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200/60 dark:border-neutral-800 text-[11px] text-neutral-700 dark:text-neutral-300 leading-relaxed flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                    <span>{isAr ? agent.rateNoteAr : agent.rateNoteEn}</span>
                  </div>

                  {/* Payment methods supported */}
                  <div>
                    <div className="text-[11px] font-semibold text-neutral-400 mb-1.5">
                      {isAr ? 'طرق الدفع والتحويل المدعومة:' : 'Supported payment channels:'}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {agent.methods.map((method, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-[11px] font-medium border border-neutral-200/50 dark:border-neutral-700/50"
                        >
                          {method}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Actions Bar */}
                <div className="mt-5 pt-4 border-t border-neutral-100 dark:border-neutral-800/80 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    {/* Recharge button if supported */}
                    {(agent.category === 'recharge' || agent.category === 'both') && (
                      <button
                        type="button"
                        onClick={() => {
                          setOrderSuccessMessage(null);
                          setRequestDiamonds(500);
                          setActiveModalAgent({ agent, type: 'recharge' });
                        }}
                        className="py-2.5 px-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                      >
                        <Zap className="w-3.5 h-3.5 fill-neutral-950" />
                        <span>{isAr ? 'طلب شحن' : 'Recharge'}</span>
                      </button>
                    )}

                    {/* Cashout/Withdraw button if supported */}
                    {(agent.category === 'withdraw' || agent.category === 'both') && (
                      <button
                        type="button"
                        onClick={() => {
                          setOrderSuccessMessage(null);
                          setRequestDiamonds(500);
                          setActiveModalAgent({ agent, type: 'withdraw' });
                        }}
                        className="py-2.5 px-3 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-emerald-600 dark:text-emerald-400 font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 border border-neutral-200 dark:border-neutral-700 active:scale-95"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        <span>{isAr ? 'طلب سحب' : 'Cashout'}</span>
                      </button>
                    )}
                  </div>

                  {/* Direct Contact Buttons (WhatsApp / Telegram) */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleOpenContact(agent, 'whatsapp')}
                      className="flex-1 py-2 px-3 rounded-xl bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] font-semibold text-xs transition-colors cursor-pointer border border-[#25D366]/30 flex items-center justify-center gap-1.5"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>{isAr ? 'واتساب' : 'WhatsApp'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenContact(agent, 'telegram')}
                      className="flex-1 py-2 px-3 rounded-xl bg-[#24A1DE]/10 hover:bg-[#24A1DE]/20 text-[#24A1DE] font-semibold text-xs transition-colors cursor-pointer border border-[#24A1DE]/30 flex items-center justify-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5 -rotate-45" />
                      <span>{isAr ? 'تلغرام' : 'Telegram'}</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredAgents.length === 0 && (
            <div className="text-center py-12 p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
              <BadgeAlert className="w-10 h-10 text-neutral-400 mx-auto mb-3" />
              <h3 className="font-bold text-neutral-800 dark:text-neutral-200 text-sm">
                {isAr ? 'لم يتم العثور على وكلاء مطابقين' : 'No matching agents found'}
              </h3>
              <p className="text-xs text-neutral-500 mt-1">
                {isAr ? 'جرب تغيير كلمة البحث أو تصفية الوكلاء' : 'Try adjusting your search query'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setFilterType('all');
                }}
                className="mt-4 px-4 py-2 rounded-xl bg-cyan-400 text-neutral-950 font-bold text-xs"
              >
                {isAr ? 'عرض جميع الوكلاء' : 'View all agents'}
              </button>
            </div>
          )}

          {/* ========================================================
              Official Security Notice / تنبيه وضمان أمني رسمي
              ======================================================== */}
          <div className="rounded-3xl p-5 sm:p-6 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-cyan-500/5 border border-amber-500/30 flex items-start gap-4">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0 mt-0.5">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="space-y-1 text-xs leading-relaxed">
              <h4 className="font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <span>{isAr ? 'تنبيه أمان وضمان مالي رسمي من إدارة Soul-X' : 'Soul-X Financial Security Advisory'}</span>
              </h4>
              <p className="text-neutral-600 dark:text-neutral-300">
                {isAr
                  ? 'جميع الوكلاء المسجلين في هذه القائمة معتمدون رسمياً ولديهم تأمين مالي مودع لدى إدارة التطبيق لضمان حقوقك بنسبة 100%. لا تقم بالتحويل لأي شخص يدعي أنه وكيل غير موجود بهذه القائمة الرسمية الموثقة.'
                  : 'All agents listed above are officially certified and carry deposit escrows with Soul-X. Never transact with unverified individuals outside this official list.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================
          Interactive Modal: Direct Recharge / Cashout Request
          ======================================================== */}
      {activeModalAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden p-6 space-y-5 animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${
                    activeModalAgent.type === 'recharge'
                      ? 'bg-cyan-400/20 text-cyan-500'
                      : 'bg-emerald-500/20 text-emerald-500'
                  }`}
                >
                  {activeModalAgent.type === 'recharge' ? (
                    <Zap className="w-4 h-4 fill-cyan-500" />
                  ) : (
                    <ArrowUpRight className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-neutral-900 dark:text-white">
                    {activeModalAgent.type === 'recharge'
                      ? isAr
                        ? 'طلب شحن رصيد الماسات'
                        : 'Diamond Recharge Request'
                      : isAr
                      ? 'طلب سحب رصيد وأرباح'
                      : 'Earnings Withdrawal Request'}
                  </h3>
                  <div className="text-xs text-neutral-500">
                    {isAr ? activeModalAgent.agent.nameAr : activeModalAgent.agent.nameEn}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveModalAgent(null)}
                className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {orderSuccessMessage ? (
              <div className="text-center py-6 space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-500 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h4 className="font-bold text-base text-neutral-900 dark:text-white">
                  {isAr ? 'تم استلام وتأكيد الطلب بنجاح!' : 'Order Received Successfully!'}
                </h4>
                <p className="text-xs text-neutral-600 dark:text-neutral-300 max-w-sm mx-auto leading-relaxed">
                  {orderSuccessMessage}
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveModalAgent(null)}
                    className="px-6 py-2.5 rounded-xl bg-cyan-400 text-neutral-950 font-bold text-xs cursor-pointer shadow-md"
                  >
                    {isAr ? 'إغلاق ومتابعة' : 'Close & Continue'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Wallet Reference Banner */}
                <div className="p-3.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 flex items-center justify-between text-xs">
                  <div>
                    <div className="text-neutral-500 text-[11px]">{isAr ? 'معرّف محفظة Soul-X:' : 'Soul-X Wallet ID:'}</div>
                    <div className="font-mono font-bold text-cyan-600 dark:text-cyan-400 text-sm">
                      {userWalletId}
                    </div>
                  </div>
                  <div className="text-end">
                    <div className="text-neutral-500 text-[11px]">{isAr ? 'رصيدك الحالي:' : 'Current Balance:'}</div>
                    <div className="font-mono font-bold text-neutral-900 dark:text-white text-sm">
                      {walletBalance.toLocaleString()} 💎
                    </div>
                  </div>
                </div>

                {/* Amount Selection */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                    {isAr ? 'حدد كمية الماسات:' : 'Select diamond amount:'}
                  </label>
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    {[250, 500, 1000, 2500].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setRequestDiamonds(amt)}
                        className={`py-2 px-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                          requestDiamonds === amt
                            ? 'bg-cyan-400 text-neutral-950 shadow-md ring-2 ring-cyan-400/40'
                            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                        }`}
                      >
                        +{amt} 💎
                      </button>
                    ))}
                  </div>

                  <input
                    type="number"
                    min={100}
                    max={100000}
                    value={requestDiamonds}
                    onChange={(e) => setRequestDiamonds(Math.max(1, parseInt(e.target.value, 10) || 0))}
                    className="w-full h-11 px-4 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-sm font-mono font-bold text-neutral-900 dark:text-white focus:outline-none focus:border-cyan-500"
                  />
                  <div className="flex items-center justify-between text-[11px] text-neutral-500 mt-1">
                    <span>
                      {isAr
                        ? `الحد الأدنى: ${activeModalAgent.agent.minAmount} ماسة`
                        : `Min: ${activeModalAgent.agent.minAmount} diamonds`}
                    </span>
                    <span className="font-mono font-semibold text-cyan-600 dark:text-cyan-400">
                      {isAr
                        ? `القيمة: ≈ ${(requestDiamonds * 0.04).toFixed(2)} ر.س / ${(
                            requestDiamonds * 0.01
                          ).toFixed(2)} $ USDT`
                        : `Value: ≈ $${(requestDiamonds * 0.01).toFixed(2)} USD`}
                    </span>
                  </div>
                </div>

                {/* Account / Note input */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                    {activeModalAgent.type === 'withdraw'
                      ? isAr
                        ? 'رقم حسابك المستلم (STC Pay / رقم الآيبان IBAN / محفظة USDT):'
                        : 'Payout Destination (STC Pay / IBAN / USDT Wallet):'
                      : isAr
                      ? 'ملاحظات إضافية أو اسم المحول (اختياري):'
                      : 'Sender Notes / Name (Optional):'}
                  </label>
                  <input
                    type="text"
                    value={paymentAccountInput}
                    onChange={(e) => setPaymentAccountInput(e.target.value)}
                    placeholder={
                      activeModalAgent.type === 'withdraw'
                        ? isAr
                          ? 'مثال: 0501234567 (STC Pay) أو TXYZ... (USDT TRC20)'
                          : 'e.g. STC Pay number or TRC20 address'
                        : isAr
                        ? 'مثال: تم التحويل من حساب عبدالله'
                        : 'e.g. Transferred from John Doe'
                    }
                    className="w-full h-11 px-4 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Buttons */}
                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    disabled={isSubmittingOrder}
                    onClick={handleSubmitAgentOrder}
                    className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs transition-all cursor-pointer shadow-md flex items-center justify-center gap-2 ${
                      activeModalAgent.type === 'recharge'
                        ? 'bg-cyan-400 hover:bg-cyan-300 text-neutral-950 shadow-cyan-400/20'
                        : 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-emerald-500/20'
                    } disabled:opacity-60 disabled:cursor-not-allowed`}
                  >
                    {isSubmittingOrder ? (
                      <span className="flex items-center gap-2">
                        <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                        <span>{isAr ? 'جاري المعالجة والتأكيد...' : 'Processing...'}</span>
                      </span>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>
                          {activeModalAgent.type === 'recharge'
                            ? isAr
                              ? `تأكيد طلب شحن +${requestDiamonds.toLocaleString()} ماسة`
                              : `Confirm Recharge (+${requestDiamonds.toLocaleString()})`
                            : isAr
                            ? `تأكيد طلب سحب ${requestDiamonds.toLocaleString()} ماسة`
                            : `Confirm Cashout (${requestDiamonds.toLocaleString()})`}
                        </span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenContact(activeModalAgent.agent, 'whatsapp')}
                    className="py-3 px-4 rounded-xl bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] font-semibold text-xs border border-[#25D366]/30 flex items-center gap-1.5 cursor-pointer"
                    title={isAr ? 'محادثة الوكيل واتساب' : 'WhatsApp Agent'}
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>{isAr ? 'محادثة' : 'Chat'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
