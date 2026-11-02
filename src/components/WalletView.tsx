import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Check,
  ShieldCheck,
  Zap,
  ArrowUpRight,
  Send,
  MessageCircle,
  Clock,
  Star,
  Search,
  X,
  Building2,
  Globe,
  User,
  ArrowDownUp,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Loader2,
  RefreshCw,
  AlertCircle,
  Coins,
  Gift,
  ArrowRightLeft,
  Award,
} from 'lucide-react';
import { Language, AuthUser } from '../types';

export interface WalletAgent {
  id: string;
  email?: string;
  nameAr: string;
  nameEn: string;
  taglineAr: string;
  taglineEn: string;
  country: string;
  flag: string;
  balance?: number;
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

interface WalletViewProps {
  lang: Language;
  walletBalance: number;
  coinsBalance?: number;
  initialTab?: 'diamonds' | 'coins';
  onRecharge: (amount: number) => void;
  onWithdraw?: (amount: number) => void;
  onUpdateCoins?: (amount: number) => void;
  onBack: () => void;
  currentUser?: AuthUser | null;
}

export const WalletView: React.FC<WalletViewProps> = ({
  lang,
  walletBalance,
  coinsBalance = 25000,
  initialTab = 'diamonds',
  onRecharge,
  onWithdraw,
  onUpdateCoins,
  onBack,
  currentUser,
}) => {
  const isAr = lang === 'ar';

  // Currency Tab: 'diamonds' (رصيد الماس) or 'coins' (رصيد كوينز)
  const [currencyTab, setCurrencyTab] = useState<'diamonds' | 'coins'>(initialTab);

  // Sub-view navigation: 'main' (Balance Cards & Tabs) or 'agents' (Agents List Page)
  const [currentSubView, setCurrentSubView] = useState<'main' | 'agents'>('main');

  // Daily coin claim state
  const [dailyClaimed, setDailyClaimed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const last = localStorage.getItem('soulx_last_daily_claim');
      return last === new Date().toDateString();
    }
    return false;
  });
  const [dailyClaimFeedback, setDailyClaimFeedback] = useState<string | null>(null);

  // Exchange diamonds to coins feedback
  const [exchangeFeedback, setExchangeFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Real Agents list from database
  const [agentsList, setAgentsList] = useState<WalletAgent[]>([]);
  const [isLoadingAgents, setIsLoadingAgents] = useState(true);
  const [agentsError, setAgentsError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Agent profile modal
  const [selectedAgentProfile, setSelectedAgentProfile] = useState<WalletAgent | null>(null);

  // Direct Message modal
  const [messageModalAgent, setMessageModalAgent] = useState<WalletAgent | null>(null);
  const [directMessageText, setDirectMessageText] = useState('');
  const [isSendingDirectMessage, setIsSendingDirectMessage] = useState(false);
  const [directMessageSuccess, setDirectMessageSuccess] = useState<string | null>(null);

  // Quick transaction modal (recharge/withdraw via agent)
  const [activeTransactionAgent, setActiveTransactionAgent] = useState<{
    agent: WalletAgent;
    type: 'recharge' | 'withdraw';
  } | null>(null);
  const [transactionAmount, setTransactionAmount] = useState<number>(500);
  const [paymentAccountInput, setPaymentAccountInput] = useState('');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [orderSuccessMessage, setOrderSuccessMessage] = useState<string | null>(null);

  // User wallet reference
  const userWalletId = currentUser?.id
    ? `SX-${currentUser.id.slice(0, 6).toUpperCase()}`
    : 'SX-884920';

  // Fetch accredited agents directly from database endpoint
  const loadAgents = async () => {
    setIsLoadingAgents(true);
    setAgentsError(null);
    try {
      const res = await fetch('/api/agents');
      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }
      const data = await res.json();
      if (data.success && Array.isArray(data.agents)) {
        const mapped: WalletAgent[] = data.agents.map((a: any) => ({
          id: a.id,
          email: a.email,
          nameAr: a.name || a.nameAr || 'وكيل معتمد',
          nameEn: a.nameEn || a.name || a.nameAr || 'Certified Agent',
          taglineAr: a.taglineAr || `الوكيل المعتمد لخدمات الإيداع والسحب في ${a.country || 'المنطقة'}`,
          taglineEn: a.taglineEn || `Certified agent for deposit and cashout in ${a.country || 'Region'}`,
          country: a.country || (isAr ? 'دولي' : 'International'),
          flag: a.flag || '🌐',
          balance: typeof a.balance === 'number' ? a.balance : 50000,
          category: a.category || 'both',
          methods: Array.isArray(a.methods) && a.methods.length > 0 ? a.methods : ['تحويل بنكي', 'USDT', 'كاش'],
          responseTimeAr: a.responseTimeAr || 'متصل الآن (أقل من دقيقتين)',
          responseTimeEn: a.responseTimeEn || 'Online (< 2 mins)',
          rating: typeof a.rating === 'number' ? a.rating : 4.96,
          completedOrders: typeof a.completedOrders === 'number' ? a.completedOrders : 120,
          whatsapp: a.whatsapp || '',
          telegram: a.telegram || '',
          isOnline: a.isOnline ?? true,
          minAmount: a.minAmount || 100,
          maxAmount: a.maxAmount || 200000,
          rateNoteAr: a.rateNoteAr || 'تنفيذ فوري وموثق من إدارة Soul-X',
          rateNoteEn: a.rateNoteEn || 'Verified instant settlement',
        }));
        setAgentsList(mapped);
      } else {
        throw new Error(data.message || 'Failed to parse agents response');
      }
    } catch (err: any) {
      setAgentsError(
        isAr
          ? 'تعذر الاتصال بقاعدة البيانات لجلب قائمة الوكلاء المعتمدين. يرجى التحقق من الاتصال والمحاولة ثانية.'
          : 'Unable to connect to database to fetch accredited agents. Please check connection and retry.'
      );
    } finally {
      setIsLoadingAgents(false);
    }
  };

  useEffect(() => {
    loadAgents();

    const handleAgentsUpdated = () => {
      loadAgents();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('soulx:agents-updated', handleAgentsUpdated);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('soulx:agents-updated', handleAgentsUpdated);
      }
    };
  }, []);

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

  const handleSendDirectMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageModalAgent || !directMessageText.trim()) return;

    setIsSendingDirectMessage(true);
    try {
      const senderId = currentUser?.id || userWalletId;
      const senderName = currentUser?.name || 'مستخدم Soul-X';

      await fetch('/api/conversations/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId,
          senderName,
          recipientId: messageModalAgent.email || messageModalAgent.id,
          recipientName: messageModalAgent.nameAr,
          text: directMessageText.trim(),
        }),
      }).catch(() => {});

      setDirectMessageSuccess(
        isAr
          ? `تم إرسال رسالتك بنجاح إلى الوكيل (${messageModalAgent.nameAr})! سيصلك الرد في قسم المحادثات.`
          : `Message sent to (${messageModalAgent.nameAr}) successfully!`
      );
      setDirectMessageText('');
      setTimeout(() => {
        setDirectMessageSuccess(null);
        setMessageModalAgent(null);
      }, 2500);
    } finally {
      setIsSendingDirectMessage(false);
    }
  };

  const handleSubmitOrder = () => {
    if (!activeTransactionAgent) return;
    const isWithdraw = activeTransactionAgent.type === 'withdraw';

    if (isWithdraw && transactionAmount > walletBalance) {
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
          onWithdraw(transactionAmount);
        } else {
          onRecharge(-transactionAmount);
        }
        setOrderSuccessMessage(
          isAr
            ? `تم رفع طلب السحب بقيمة ${transactionAmount.toLocaleString()} ماسة للوكيل ${activeTransactionAgent.agent.nameAr} بنجاح! سيتم التحويل إلى حسابك خلال دقائق.`
            : `Withdrawal request for ${transactionAmount.toLocaleString()} diamonds submitted successfully!`
        );
      } else {
        onRecharge(transactionAmount);
        setOrderSuccessMessage(
          isAr
            ? `تم إرسال طلب الشحن بقيمة +${transactionAmount.toLocaleString()} ماسة للوكيل ${activeTransactionAgent.agent.nameAr} وتم تأكيد العملية فورياً!`
            : `Recharge request for +${transactionAmount.toLocaleString()} diamonds submitted and credited!`
        );
      }
    }, 1200);
  };

  const filteredAgents = agentsList.filter((agent) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      agent.nameAr.toLowerCase().includes(q) ||
      agent.nameEn.toLowerCase().includes(q) ||
      agent.country.toLowerCase().includes(q) ||
      agent.methods.some((m) => m.toLowerCase().includes(q))
    );
  });

  return (
    <div className="w-full flex-1 flex flex-col bg-neutral-50 dark:bg-neutral-950 animate-in fade-in duration-200">
      {/* ========================================================
          Top Sticky Navigation Bar
          ======================================================== */}
      <div className="sticky top-16 z-30 w-full bg-white/90 dark:bg-neutral-950/90 backdrop-blur-md border-b border-neutral-200 dark:border-neutral-800 transition-colors">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          {currentSubView === 'main' ? (
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
              <span>{isAr ? 'العودة' : 'Back'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setCurrentSubView('main')}
              className="flex items-center gap-2 text-sm font-semibold text-neutral-800 dark:text-neutral-200 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors cursor-pointer group"
            >
              {isAr ? (
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              ) : (
                <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
              )}
              <span>{isAr ? 'العودة للمحفظة' : 'Back to Wallet'}</span>
            </button>
          )}

          <div className="flex items-center gap-2 text-xs font-semibold text-neutral-500">
            {currentSubView === 'main' ? (
              <span className="font-bold text-neutral-700 dark:text-neutral-300">
                {isAr ? 'المحفظة' : 'Wallet'}
              </span>
            ) : (
              <div className="flex items-center gap-1.5 text-cyan-600 dark:text-cyan-400">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <span className="font-bold">{isAr ? 'وكلاء السحب و الإيداع' : 'Deposit & Withdrawal Agents'}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================
          VIEW 1: صفحة المحفظة الرئيسية (تبويبين: رصيد الماس & رصيد كوينز)
          ======================================================== */}
      {currentSubView === 'main' && (
        <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 flex-1 flex flex-col justify-start animate-in fade-in">
          
          {/* تبويبات المحفظة: رصيد الماس (Diamonds) ورصيد كوينز (Coins) */}
          <div className="w-full grid grid-cols-2 p-1.5 rounded-2xl bg-neutral-200/70 dark:bg-neutral-900 border border-neutral-300/70 dark:border-neutral-800 shadow-inner">
            <button
              type="button"
              onClick={() => {
                setCurrencyTab('diamonds');
                setExchangeFeedback(null);
              }}
              className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-black transition-all cursor-pointer ${
                currencyTab === 'diamonds'
                  ? 'bg-gradient-to-r from-cyan-400 via-cyan-500 to-teal-400 text-neutral-950 shadow-md shadow-cyan-500/25 scale-[1.01]'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <svg
                className={`w-4 h-4 ${
                  currencyTab === 'diamonds'
                    ? 'text-neutral-950 fill-neutral-950/20 stroke-neutral-950 stroke-[2]'
                    : 'text-cyan-500 fill-cyan-500/20 stroke-cyan-500'
                }`}
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <polygon points="6 3 18 3 22 9 12 22 2 9 6 3" />
                <polyline points="11 3 8 9 12 22 16 9 13 3" fill="none" />
                <line x1="2" y1="9" x2="22" y2="9" />
              </svg>
              <span>{isAr ? 'رصيد الماس' : 'Diamonds'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setCurrencyTab('coins');
                setExchangeFeedback(null);
              }}
              className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-black transition-all cursor-pointer ${
                currencyTab === 'coins'
                  ? 'bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 text-neutral-950 shadow-md shadow-amber-500/25 scale-[1.01]'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <span className="text-base leading-none">🪙</span>
              <span>{isAr ? 'رصيد كوينز' : 'Coins'}</span>
            </button>
          </div>

          {/* ========================================================
              تبويب 1: رصيد الماس (Diamonds Tab)
              ======================================================== */}
          {currencyTab === 'diamonds' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* كارت رصيد الماس */}
              <div className="relative rounded-3xl p-8 sm:p-10 bg-gradient-to-br from-neutral-900 via-neutral-900 to-cyan-950 border border-cyan-500/30 shadow-2xl overflow-hidden text-neutral-100 flex flex-col items-center justify-center text-center">
                <div className="absolute -top-12 -right-12 w-64 h-64 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

                {/* Diamond Icon */}
                <div className="relative mb-4">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-cyan-400/10 border border-cyan-400/40 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                    <svg
                      className="w-10 h-10 sm:w-12 sm:h-12 text-cyan-400 fill-cyan-400/25 stroke-cyan-400 stroke-[1.8] drop-shadow-[0_0_16px_rgba(34,211,238,0.6)]"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <polygon points="6 3 18 3 22 9 12 22 2 9 6 3" />
                      <polyline points="11 3 8 9 12 22 16 9 13 3" fill="none" />
                      <line x1="2" y1="9" x2="22" y2="9" />
                    </svg>
                  </div>
                </div>

                <span className="text-xs sm:text-sm font-semibold text-cyan-300/90 tracking-wide uppercase">
                  {isAr ? 'رصيد الماس (Diamonds)' : 'Diamond Balance'}
                </span>

                <div className="mt-2 text-5xl sm:text-6xl font-black font-mono tracking-tight text-white tabular-nums flex items-baseline justify-center gap-3">
                  <span>{walletBalance.toLocaleString()}</span>
                  <span className="text-xl sm:text-2xl font-bold font-sans text-cyan-400">
                    {isAr ? 'ماسة' : 'Diamonds'}
                  </span>
                </div>

                <div className="mt-4 flex items-center gap-2 text-xs text-neutral-400">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  <span>{isAr ? 'حسابك معتمد وموثق على شبكة Soul-X' : 'Verified Soul-X Account'}</span>
                </div>
              </div>

              {/* زر: وكلاء السحب و الإيداع */}
              <button
                type="button"
                onClick={() => setCurrentSubView('agents')}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-cyan-400 via-cyan-500 to-teal-400 hover:from-cyan-300 hover:via-cyan-400 hover:to-teal-300 text-neutral-950 font-black text-base sm:text-lg shadow-xl shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all cursor-pointer flex items-center justify-between group active:scale-[0.99]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-neutral-950/10 flex items-center justify-center">
                    <ArrowDownUp className="w-5 h-5 text-neutral-950" />
                  </div>
                  <div className="text-start">
                    <span className="block font-black text-base sm:text-lg">
                      {isAr ? 'وكلاء السحب و الإيداع' : 'Deposit & Withdrawal Agents'}
                    </span>
                    <span className="block text-xs font-medium text-neutral-900/80">
                      {isAr ? 'شحن فوري وسحب للأرباح مع وكلاء معتمدين في بلدك' : 'Instant deposit & cashout via certified local agents'}
                    </span>
                  </div>
                </div>

                <div className="w-8 h-8 rounded-full bg-neutral-950/10 flex items-center justify-center transition-transform group-hover:scale-110 shrink-0">
                  {isAr ? (
                    <ChevronLeft className="w-5 h-5 text-neutral-950" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-neutral-950" />
                  )}
                </div>
              </button>

              {/* تحويل سريع لرصيد الكوينز */}
              <button
                type="button"
                onClick={() => setCurrencyTab('coins')}
                className="w-full p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-amber-500/50 shadow-sm transition-all flex items-center justify-between cursor-pointer group"
              >
                <div className="flex items-center gap-3 text-start">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center text-lg shrink-0">
                    🪙
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-neutral-900 dark:text-white group-hover:text-amber-500 transition-colors">
                      {isAr ? 'تحويل الماس إلى كوينز (Coins)' : 'Convert Diamonds to Coins'}
                    </h4>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {isAr ? 'استبدل ماساتك بكوينز مع بونص إضافي يصل إلى 30%' : 'Exchange diamonds for coins with up to 30% bonus'}
                    </p>
                  </div>
                </div>
                <div className="text-neutral-400 group-hover:text-amber-500 transition-colors">
                  {isAr ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </div>
              </button>
            </div>
          )}

          {/* ========================================================
              تبويب 2: رصيد كوينز (Coins Tab)
              ======================================================== */}
          {currencyTab === 'coins' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* كارت رصيد الكوينز */}
              <div className="relative rounded-3xl p-8 sm:p-10 bg-gradient-to-br from-neutral-900 via-neutral-900 to-amber-950/60 border border-amber-500/30 shadow-2xl overflow-hidden text-neutral-100 flex flex-col items-center justify-center text-center">
                <div className="absolute -top-12 -right-12 w-64 h-64 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-yellow-500/15 rounded-full blur-3xl pointer-events-none" />

                {/* Golden Coin Icon */}
                <div className="relative mb-4">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-amber-500/10 border border-amber-400/40 flex items-center justify-center shadow-lg shadow-amber-500/20 text-3xl sm:text-4xl">
                    🪙
                  </div>
                </div>

                <span className="text-xs sm:text-sm font-semibold text-amber-300/90 tracking-wide uppercase">
                  {isAr ? 'رصيد كوينز (Coins)' : 'Coins Balance'}
                </span>

                <div className="mt-2 text-5xl sm:text-6xl font-black font-mono tracking-tight text-white tabular-nums flex items-baseline justify-center gap-3">
                  <span>{coinsBalance.toLocaleString()}</span>
                  <span className="text-xl sm:text-2xl font-bold font-sans text-amber-400">
                    {isAr ? 'كوينز' : 'Coins'}
                  </span>
                </div>

                <div className="mt-4 flex items-center gap-2 text-xs text-amber-200/80">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>{isAr ? 'يُستخدم لإرسال الهدايا، تمييز الحساب، والمحادثات الحصرية' : 'Used for gifts, account boosts, and matches'}</span>
                </div>
              </div>

              {/* زر استلام المكافأة اليومية مجاناً */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-yellow-500/10 to-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-start">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-xl shrink-0">
                    🎁
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-neutral-900 dark:text-white flex items-center justify-center sm:justify-start gap-1.5">
                      <span>{isAr ? 'مكافأة الدخول اليومية المجانية' : 'Free Daily Login Reward'}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-neutral-950">+500 🪙</span>
                    </h4>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                      {dailyClaimed
                        ? (isAr ? 'تم استلام مكافأة اليوم بنجاح! عد غداً للمزيد.' : 'Claimed for today! Return tomorrow for more.')
                        : (isAr ? 'احصل على 500 كوينز مجاناً كل 24 ساعة بنقرة واحدة.' : 'Claim 500 free coins every 24 hours.')}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={dailyClaimed}
                  onClick={() => {
                    if (dailyClaimed) return;
                    if (onUpdateCoins) onUpdateCoins(500);
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('soulx_last_daily_claim', new Date().toDateString());
                    }
                    setDailyClaimed(true);
                    setDailyClaimFeedback(
                      isAr ? '🎉 مبروك! تم إضافة +500 كوينز إلى رصيدك مجاناً.' : '🎉 Congrats! +500 Coins added to your balance.'
                    );
                    setTimeout(() => setDailyClaimFeedback(null), 4000);
                  }}
                  className={`px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shrink-0 cursor-pointer ${
                    dailyClaimed
                      ? 'bg-neutral-200 dark:bg-neutral-800 text-neutral-500 cursor-not-allowed'
                      : 'bg-amber-400 hover:bg-amber-300 text-neutral-950 shadow-md shadow-amber-500/30 active:scale-95'
                  }`}
                >
                  {dailyClaimed ? (isAr ? 'تم الاستلام اليوم' : 'Claimed') : (isAr ? 'استلام الآن' : 'Claim Now')}
                </button>
              </div>

              {dailyClaimFeedback && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{dailyClaimFeedback}</span>
                </div>
              )}

              {/* تحويل الماس إلى كوينز (Convert Diamonds to Coins) */}
              <div className="rounded-2xl p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ArrowRightLeft className="w-5 h-5 text-amber-500" />
                    <h3 className="text-sm font-black text-neutral-900 dark:text-white">
                      {isAr ? 'تحويل رصيد الماس إلى كوينز' : 'Exchange Diamonds to Coins'}
                    </h3>
                  </div>
                  <span className="text-xs font-semibold text-neutral-500">
                    {isAr ? `رصيدك الحالي: ${walletBalance.toLocaleString()} 💎` : `Your: ${walletBalance.toLocaleString()} 💎`}
                  </span>
                </div>

                {exchangeFeedback && (
                  <div
                    className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                      exchangeFeedback.type === 'success'
                        ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                        : 'bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {exchangeFeedback.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0" />
                    )}
                    <span>{exchangeFeedback.message}</span>
                  </div>
                )}

                {/* باقات الاستبدال */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { diamonds: 100, coins: 1000, bonus: null },
                    { diamonds: 500, coins: 5500, bonus: '+10% بونص' },
                    { diamonds: 1000, coins: 12000, bonus: '+20% بونص' },
                    { diamonds: 2500, coins: 32500, bonus: '+30% بونص' },
                  ].map((pkg, idx) => {
                    const canAfford = walletBalance >= pkg.diamonds;
                    return (
                      <div
                        key={idx}
                        className="relative p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-950/70 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between hover:border-amber-500/50 transition-colors"
                      >
                        {pkg.bonus && (
                          <span className="absolute -top-2 left-3 rtl:left-3 rtl:right-auto ltr:right-3 ltr:left-auto px-2 py-0.5 rounded-full text-[9px] font-black bg-gradient-to-r from-amber-500 to-yellow-400 text-neutral-950 shadow-xs">
                            {pkg.bonus}
                          </span>
                        )}
                        <div className="text-start">
                          <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                            <span>{pkg.diamonds.toLocaleString()}</span>
                            <span className="text-cyan-500 font-bold">💎</span>
                            <span>➔</span>
                          </div>
                          <div className="text-base font-black text-amber-500 font-mono">
                            {pkg.coins.toLocaleString()} <span className="text-xs font-sans">🪙</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={!canAfford}
                          onClick={() => {
                            if (!canAfford) {
                              setExchangeFeedback({
                                type: 'error',
                                message: isAr
                                  ? `رصيد الماس غير كافٍ. تحتاج إلى ${pkg.diamonds.toLocaleString()} ماسة على الأقل لإتمام التحويل.`
                                  : `Insufficient diamonds. You need ${pkg.diamonds.toLocaleString()} diamonds.`,
                              });
                              setTimeout(() => setExchangeFeedback(null), 4000);
                              return;
                            }
                            onRecharge(-pkg.diamonds);
                            if (onUpdateCoins) onUpdateCoins(pkg.coins);
                            setExchangeFeedback({
                              type: 'success',
                              message: isAr
                                ? `تم استبدال ${pkg.diamonds.toLocaleString()} ماسة بنجاح إلى +${pkg.coins.toLocaleString()} كوينز!`
                                : `Exchanged ${pkg.diamonds.toLocaleString()} diamonds for ${pkg.coins.toLocaleString()} coins!`,
                            });
                            setTimeout(() => setExchangeFeedback(null), 4000);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            canAfford
                              ? 'bg-amber-400 hover:bg-amber-300 text-neutral-950 shadow-xs active:scale-95'
                              : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed'
                          }`}
                        >
                          {canAfford ? (isAr ? 'استبدال' : 'Exchange') : (isAr ? 'رصيد غير كافٍ' : 'Low 💎')}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* شحن الكوينز عبر الوكلاء */}
              <button
                type="button"
                onClick={() => setCurrentSubView('agents')}
                className="w-full p-4 rounded-2xl bg-neutral-100 hover:bg-neutral-200/80 dark:bg-neutral-900 dark:hover:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-800 transition-all flex items-center justify-between cursor-pointer group"
              >
                <div className="flex items-center gap-3 text-start">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-neutral-900 dark:text-white">
                      {isAr ? 'شحن كوينز مباشرة عبر وكلاء Soul-X' : 'Top-Up Coins via Agents'}
                    </h4>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {isAr ? 'تواصل مع وكلائنا المعتمدين للشحن عبر الحسابات البنكية أو المحافظ الإلكترونية' : 'Contact accredited agents for direct bank/wallet top-up'}
                    </p>
                  </div>
                </div>

                <div className="text-neutral-400 group-hover:text-cyan-500 transition-colors shrink-0">
                  {isAr ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </div>
              </button>

              {/* مميزات رصيد الكوينز */}
              <div className="p-4 rounded-2xl bg-neutral-50/70 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800/80 space-y-2.5">
                <h4 className="text-xs font-black text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                  {isAr ? 'استخدامات رصيد كوينز في Soul-X' : 'Coins Perks in Soul-X'}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-neutral-600 dark:text-neutral-400">
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-neutral-950/60 border border-neutral-200/70 dark:border-neutral-800">
                    <span className="text-base">🎁</span>
                    <span>{isAr ? 'إرسال هدايا فورية' : 'Send instant gifts'}</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-neutral-950/60 border border-neutral-200/70 dark:border-neutral-800">
                    <span className="text-base">⚡</span>
                    <span>{isAr ? 'أولوية التوافق في البحث' : 'Matchmaking priority'}</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-neutral-950/60 border border-neutral-200/70 dark:border-neutral-800">
                    <span className="text-base">✨</span>
                    <span>{isAr ? 'تمييز الرسائل وشارات VIP' : 'Highlight chat & VIP'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ========================================================
          VIEW 2: صفحة وكلاء السحب و الإيداع
          تظهر الوكيل و دولته مع زر مراسلة مباشر او عرض الملف الشخصي
          ======================================================== */}
      {currentSubView === 'agents' && (
        <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 flex-1 animate-in fade-in">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 dark:text-white flex items-center gap-3">
                <Building2 className="w-7 h-7 text-cyan-500" />
                <span>{isAr ? 'وكلاء السحب و الإيداع' : 'Deposit & Withdrawal Agents'}</span>
              </h1>
              <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                {isAr
                  ? 'اختر الوكيل المناسب لدولتك للمراسلة المباشرة أو الاطلاع على ملفه الشخصي وطرق التحويل.'
                  : 'Select an authorized agent for your country to chat directly or inspect profile.'}
              </p>
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold self-start sm:self-auto">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{isAr ? `${filteredAgents.length} وكلاء معتمدون` : `${filteredAgents.length} Verified Agents`}</span>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 right-4 rtl:right-4 rtl:left-auto ltr:left-4 ltr:right-auto text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                isAr
                  ? 'ابحث باسم الوكيل، أو الدولة (السعودية، مصر، العراق، الإمارات، الأردن)...'
                  : 'Search by agent name or country...'
              }
              className="w-full h-11 pr-11 pl-4 rtl:pr-11 rtl:pl-4 ltr:pl-11 ltr:pr-4 rounded-2xl bg-white dark:bg-neutral-900/90 border border-neutral-200 dark:border-neutral-800 text-xs sm:text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:border-cyan-500 transition-colors shadow-sm"
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

          {/* حالة التحميل أو الخطأ أو قائمة الوكلاء الحقيقية من قاعدة البيانات */}
          {isLoadingAgents ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-2.5 py-4 text-xs font-semibold text-cyan-600 dark:text-cyan-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>{isAr ? 'جاري جلب الوكلاء المعتمدين من قاعدة البيانات...' : 'Loading accredited agents from database...'}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                {[1, 2, 3, 4].map((n) => (
                  <div
                    key={n}
                    className="rounded-3xl p-5 sm:p-6 bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 animate-pulse space-y-4"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-neutral-200 dark:bg-neutral-800" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-3/4 bg-neutral-200 dark:bg-neutral-800 rounded" />
                        <div className="h-3 w-1/2 bg-neutral-200 dark:bg-neutral-800 rounded" />
                        <div className="h-3 w-1/3 bg-neutral-200 dark:bg-neutral-800 rounded" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5 pt-2">
                      <div className="h-9 bg-neutral-200 dark:bg-neutral-800 rounded-xl" />
                      <div className="h-9 bg-neutral-200 dark:bg-neutral-800 rounded-xl" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : agentsError ? (
            <div className="p-8 rounded-3xl bg-rose-500/10 border border-rose-500/30 text-center space-y-3">
              <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
              <h3 className="font-bold text-rose-600 dark:text-rose-400 text-sm">
                {agentsError}
              </h3>
              <p className="text-xs text-neutral-500">
                {isAr
                  ? 'يرجى التحقق من اتصالك بالإنترنت ثم الضغط على زر إعادة المحاولة'
                  : 'Please check your connection and click retry'}
              </p>
              <button
                type="button"
                onClick={loadAgents}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-bold text-xs cursor-pointer shadow-sm transition-all active:scale-95"
              >
                <RefreshCw className="w-4 h-4" />
                <span>{isAr ? 'إعادة المحاولة' : 'Retry'}</span>
              </button>
            </div>
          ) : (
            <>
              {/* قائمة الوكلاء: يظهر الوكيل و دولته مع زر مراسلة مباشر أو عرض الملف الشخصي */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                {filteredAgents.map((agent) => (
                  <div
                    key={agent.id}
                    className="rounded-3xl p-5 sm:p-6 bg-white dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-800 shadow-sm hover:shadow-md hover:border-cyan-500/40 transition-all flex flex-col justify-between gap-5 group"
                  >
                    {/* معلومات الوكيل و دولته */}
                    <div className="flex items-start gap-4">
                      {/* علم ودولة الوكيل */}
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-neutral-100 to-neutral-200 dark:from-neutral-800 dark:to-neutral-900 border border-neutral-200 dark:border-neutral-700/70 flex items-center justify-center text-3xl shadow-inner shrink-0">
                        <span>{agent.flag}</span>
                      </div>

                      {/* اسم الوكيل و دولته */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-base text-neutral-900 dark:text-white truncate">
                            {isAr ? agent.nameAr : agent.nameEn}
                          </h3>
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-[10px] font-bold border border-cyan-500/20"
                            title={isAr ? 'وكيل معتمد وموثق' : 'Verified Agent'}
                          >
                            <ShieldCheck className="w-3 h-3 text-cyan-500" />
                            <span>{isAr ? 'معتمد' : 'Verified'}</span>
                          </span>
                        </div>

                        {/* دولة الوكيل */}
                        <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                          <Globe className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                          <span>{isAr ? `الدولة: ${agent.country}` : `Country: ${agent.country}`}</span>
                        </div>

                        {/* شارة الاتصال */}
                        <div className="mt-2 flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>{isAr ? 'متصل الآن' : 'Online'}</span>
                          </span>
                          <span className="text-[11px] text-neutral-400">
                            {isAr ? agent.responseTimeAr : agent.responseTimeEn}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* زرا الإجراءات: زر مراسلة مباشر + زر عرض الملف الشخصي */}
                    <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800/80 grid grid-cols-2 gap-2.5">
                      {/* زر مراسلة مباشر */}
                      <button
                        type="button"
                        onClick={() => {
                          setMessageModalAgent(agent);
                          setDirectMessageSuccess(null);
                          setDirectMessageText('');
                        }}
                        className="py-2.5 px-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                      >
                        <MessageCircle className="w-4 h-4 fill-neutral-950" />
                        <span>{isAr ? 'مراسلة مباشر' : 'Direct Message'}</span>
                      </button>

                      {/* زر عرض الملف الشخصي */}
                      <button
                        type="button"
                        onClick={() => setSelectedAgentProfile(agent)}
                        className="py-2.5 px-3 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-bold text-xs transition-all cursor-pointer border border-neutral-200 dark:border-neutral-700 flex items-center justify-center gap-1.5 active:scale-95"
                      >
                        <User className="w-4 h-4 text-neutral-500" />
                        <span>{isAr ? 'عرض الملف الشخصي' : 'View Profile'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {filteredAgents.length === 0 && (
                <div className="text-center py-12 p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                  <Building2 className="w-10 h-10 text-neutral-400 mx-auto mb-3" />
                  <h3 className="font-bold text-neutral-800 dark:text-neutral-200 text-sm">
                    {isAr ? 'لم يتم العثور على وكلاء مطابقين' : 'No matching agents found'}
                  </h3>
                  <p className="text-xs text-neutral-500 mt-1">
                    {isAr ? 'جرب البحث باسم دولة أو وكيل آخر' : 'Try searching another country or agent'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="mt-4 px-4 py-2 rounded-xl bg-cyan-400 text-neutral-950 font-bold text-xs cursor-pointer"
                  >
                    {isAr ? 'عرض جميع الوكلاء' : 'View all agents'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ========================================================
          MODAL 1: عرض الملف الشخصي للوكيل (Agent Profile View)
          ======================================================== */}
      {selectedAgentProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            {/* Close button */}
            <button
              type="button"
              onClick={() => setSelectedAgentProfile(null)}
              className="absolute top-4 right-4 rtl:right-auto rtl:left-4 p-2 rounded-full text-neutral-400 hover:text-neutral-900 dark:hover:text-white bg-neutral-100 dark:bg-neutral-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Profile Header */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-neutral-100 to-neutral-200 dark:from-neutral-800 dark:to-neutral-900 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center text-4xl shadow-inner shrink-0">
                {selectedAgentProfile.flag}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-black text-lg text-neutral-900 dark:text-white">
                    {isAr ? selectedAgentProfile.nameAr : selectedAgentProfile.nameEn}
                  </h3>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-[10px] font-bold border border-cyan-500/20">
                    <ShieldCheck className="w-3 h-3 text-cyan-500" />
                    <span>{isAr ? 'معتمد رسمياً' : 'Official Agent'}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs font-semibold text-neutral-500">
                  <Globe className="w-3.5 h-3.5 text-cyan-500" />
                  <span>{selectedAgentProfile.country}</span>
                  {selectedAgentProfile.email && (
                    <span className="font-mono text-[11px]">• {selectedAgentProfile.email}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Tagline / Bio */}
            <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950/70 border border-neutral-200/80 dark:border-neutral-800 text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed">
              {isAr ? selectedAgentProfile.taglineAr : selectedAgentProfile.taglineEn}
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2 py-1">
              <div className="p-3 rounded-2xl bg-neutral-100/70 dark:bg-neutral-800/60 text-center">
                <div className="flex items-center justify-center gap-1 text-amber-500 font-black text-sm">
                  <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                  <span>{selectedAgentProfile.rating}</span>
                </div>
                <div className="text-[10px] text-neutral-400 mt-0.5">{isAr ? 'التقييم' : 'Rating'}</div>
              </div>

              <div className="p-3 rounded-2xl bg-neutral-100/70 dark:bg-neutral-800/60 text-center">
                <div className="font-mono font-bold text-neutral-900 dark:text-white text-sm">
                  {selectedAgentProfile.completedOrders.toLocaleString()}
                </div>
                <div className="text-[10px] text-neutral-400 mt-0.5">{isAr ? 'طلب منفّذ' : 'Orders'}</div>
              </div>

              <div className="p-3 rounded-2xl bg-neutral-100/70 dark:bg-neutral-800/60 text-center">
                <div className="flex items-center justify-center gap-1 text-emerald-500 font-bold text-xs">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{isAr ? 'فوري' : 'Instant'}</span>
                </div>
                <div className="text-[10px] text-neutral-400 mt-0.5">{isAr ? 'سرعة الرد' : 'Speed'}</div>
              </div>
            </div>

            {/* Rate note & limits */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                {isAr ? 'تفاصيل السعر وحدود المعاملات:' : 'Rates & Limits:'}
              </div>
              <div className="p-3 rounded-2xl bg-cyan-500/5 border border-cyan-500/20 text-xs text-cyan-900 dark:text-cyan-300 leading-relaxed flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-500 shrink-0" />
                <span>{isAr ? selectedAgentProfile.rateNoteAr : selectedAgentProfile.rateNoteEn}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-neutral-500 font-mono px-1">
                <span>{isAr ? `الحد الأدنى: ${selectedAgentProfile.minAmount.toLocaleString()} ماسة` : `Min: ${selectedAgentProfile.minAmount} Diamonds`}</span>
                <span>{isAr ? `الحد الأقصى: ${selectedAgentProfile.maxAmount.toLocaleString()} ماسة` : `Max: ${selectedAgentProfile.maxAmount} Diamonds`}</span>
              </div>
            </div>

            {/* Supported Payment Channels */}
            <div className="space-y-1.5">
              <div className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                {isAr ? 'طرق الدفع والتحويل المتاحة:' : 'Supported Payment Channels:'}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selectedAgentProfile.methods.map((method, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs font-medium border border-neutral-200 dark:border-neutral-700"
                  >
                    {method}
                  </span>
                ))}
              </div>
            </div>

            {/* Action buttons inside Profile */}
            <div className="pt-2 space-y-2 border-t border-neutral-100 dark:border-neutral-800">
              <div className="grid grid-cols-2 gap-2">
                {(selectedAgentProfile.category === 'recharge' || selectedAgentProfile.category === 'both') && (
                  <button
                    type="button"
                    onClick={() => {
                      const ag = selectedAgentProfile;
                      setSelectedAgentProfile(null);
                      setOrderSuccessMessage(null);
                      setTransactionAmount(500);
                      setActiveTransactionAgent({ agent: ag, type: 'recharge' });
                    }}
                    className="py-2.5 px-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Zap className="w-4 h-4 fill-neutral-950" />
                    <span>{isAr ? 'طلب شحن فوري' : 'Recharge Request'}</span>
                  </button>
                )}

                {(selectedAgentProfile.category === 'withdraw' || selectedAgentProfile.category === 'both') && (
                  <button
                    type="button"
                    onClick={() => {
                      const ag = selectedAgentProfile;
                      setSelectedAgentProfile(null);
                      setOrderSuccessMessage(null);
                      setTransactionAmount(500);
                      setActiveTransactionAgent({ agent: ag, type: 'withdraw' });
                    }}
                    className="py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    <span>{isAr ? 'طلب سحب أرباح' : 'Cashout Request'}</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  const ag = selectedAgentProfile;
                  setSelectedAgentProfile(null);
                  setMessageModalAgent(ag);
                  setDirectMessageSuccess(null);
                  setDirectMessageText('');
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-neutral-200 text-white dark:text-neutral-950 font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                <span>{isAr ? 'مراسلة الوكيل الآن' : 'Message Agent Now'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 2: زر مراسلة مباشر (Direct Messaging Modal)
          ======================================================== */}
      {messageModalAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <button
              type="button"
              onClick={() => setMessageModalAgent(null)}
              className="absolute top-4 right-4 rtl:right-auto rtl:left-4 p-2 rounded-full text-neutral-400 hover:text-neutral-900 dark:hover:text-white bg-neutral-100 dark:bg-neutral-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Agent Header */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-cyan-500/20 border border-amber-500/30 flex items-center justify-center text-2xl shrink-0">
                {messageModalAgent.flag}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm sm:text-base text-neutral-900 dark:text-white">
                    {isAr ? messageModalAgent.nameAr : messageModalAgent.nameEn}
                  </h3>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-bold">
                    {isAr ? 'متصل' : 'Online'}
                  </span>
                </div>
                <div className="text-xs text-neutral-500 font-mono flex items-center gap-2 mt-0.5">
                  <span>{messageModalAgent.country}</span>
                  {messageModalAgent.email && <span>• {messageModalAgent.email}</span>}
                </div>
              </div>
            </div>

            {directMessageSuccess ? (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs text-center font-bold space-y-1">
                <CheckCircle2 className="w-7 h-7 mx-auto mb-1 text-emerald-500" />
                <p>{directMessageSuccess}</p>
              </div>
            ) : (
              <div className="space-y-4 pt-1">
                {/* Instant Social Channels */}
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-neutral-400">
                    {isAr ? 'اختر وسيلة المحادثة المباشرة:' : 'Choose direct contact channel:'}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenContact(messageModalAgent, 'whatsapp')}
                      className="py-2.5 px-3 rounded-xl bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] font-bold text-xs border border-[#25D366]/30 flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>{isAr ? 'واتساب WhatsApp' : 'WhatsApp'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenContact(messageModalAgent, 'telegram')}
                      className="py-2.5 px-3 rounded-xl bg-[#24A1DE]/10 hover:bg-[#24A1DE]/20 text-[#24A1DE] font-bold text-xs border border-[#24A1DE]/30 flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Send className="w-4 h-4 -rotate-45" />
                      <span>{isAr ? 'تلغرام Telegram' : 'Telegram'}</span>
                    </button>
                  </div>
                </div>

                {/* Direct In-App Message */}
                <form onSubmit={handleSendDirectMessage} className="pt-2 border-t border-neutral-100 dark:border-neutral-800 space-y-2.5">
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    {isAr ? 'أو أرسل رسالة فورية للوكيل داخل منصة Soul-X:' : 'Or send direct Soul-X in-app message:'}
                  </label>

                  {/* Predefined message templates */}
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      isAr ? 'السلام عليكم، أرغب في شحن رصيد ماسات' : 'Hi, I want to recharge diamonds',
                      isAr ? 'مرحباً، أود سحب رصيد وأرباح من المحفظة' : 'Hi, I want to cashout my balance',
                      isAr ? 'استفسار بخصوص سعر الصرف وطرق التحويل' : 'Inquiry about exchange rates',
                    ].map((msg, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setDirectMessageText(msg)}
                        className="px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 text-[11px] transition-colors cursor-pointer text-right"
                      >
                        {msg}
                      </button>
                    ))}
                  </div>

                  <textarea
                    rows={3}
                    value={directMessageText}
                    onChange={(e) => setDirectMessageText(e.target.value)}
                    placeholder={
                      isAr
                        ? 'اكتب تفاصيل طلبك أو استفسارك هنا وسيقوم الوكيل بالرد عليك...'
                        : 'Type your inquiry here...'
                    }
                    className="w-full p-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-cyan-500 resize-none"
                  />

                  <button
                    type="submit"
                    disabled={isSendingDirectMessage || !directMessageText.trim()}
                    className="w-full py-2.5 px-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-bold text-xs transition-all cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSendingDirectMessage ? (
                      <span>{isAr ? 'جاري الإرسال...' : 'Sending...'}</span>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5 rtl:rotate-180" />
                        <span>{isAr ? 'إرسال الرسالة إلى الوكيل' : 'Send Message to Agent'}</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 3: Direct Transaction Order (Recharge / Cashout)
          ======================================================== */}
      {activeTransactionAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden p-6 space-y-5 animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${
                    activeTransactionAgent.type === 'recharge'
                      ? 'bg-cyan-400/20 text-cyan-500'
                      : 'bg-emerald-500/20 text-emerald-500'
                  }`}
                >
                  {activeTransactionAgent.type === 'recharge' ? (
                    <Zap className="w-4 h-4 fill-cyan-500" />
                  ) : (
                    <ArrowUpRight className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-neutral-900 dark:text-white">
                    {activeTransactionAgent.type === 'recharge'
                      ? isAr
                        ? 'طلب شحن رصيد الماسات'
                        : 'Diamond Recharge Request'
                      : isAr
                      ? 'طلب سحب رصيد وأرباح'
                      : 'Earnings Withdrawal Request'}
                  </h3>
                  <div className="text-xs text-neutral-500">
                    {isAr ? activeTransactionAgent.agent.nameAr : activeTransactionAgent.agent.nameEn}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveTransactionAgent(null)}
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
                    onClick={() => setActiveTransactionAgent(null)}
                    className="px-6 py-2.5 rounded-xl bg-cyan-400 text-neutral-950 font-bold text-xs cursor-pointer shadow-md"
                  >
                    {isAr ? 'إغلاق ومتابعة' : 'Close & Continue'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Wallet Balance Display */}
                <div className="p-3.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 flex items-center justify-between text-xs">
                  <div>
                    <div className="text-neutral-500 text-[11px]">{isAr ? 'معرّف محفظتك:' : 'Your Wallet ID:'}</div>
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
                        onClick={() => setTransactionAmount(amt)}
                        className={`py-2 px-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                          transactionAmount === amt
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
                    value={transactionAmount}
                    onChange={(e) => setTransactionAmount(Math.max(1, parseInt(e.target.value, 10) || 0))}
                    className="w-full h-11 px-4 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-sm font-mono font-bold text-neutral-900 dark:text-white focus:outline-none focus:border-cyan-500"
                  />
                  <div className="flex items-center justify-between text-[11px] text-neutral-500 mt-1">
                    <span>
                      {isAr
                        ? `الحد الأدنى: ${activeTransactionAgent.agent.minAmount} ماسة`
                        : `Min: ${activeTransactionAgent.agent.minAmount} diamonds`}
                    </span>
                    <span className="font-mono font-semibold text-cyan-600 dark:text-cyan-400">
                      {isAr
                        ? `القيمة التقديرية: ≈ ${(transactionAmount * 0.04).toFixed(2)} ر.س / ${(
                            transactionAmount * 0.01
                          ).toFixed(2)} $ USDT`
                        : `Value: ≈ $${(transactionAmount * 0.01).toFixed(2)} USD`}
                    </span>
                  </div>
                </div>

                {/* Account / Note input */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                    {activeTransactionAgent.type === 'withdraw'
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
                      activeTransactionAgent.type === 'withdraw'
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
                    onClick={handleSubmitOrder}
                    className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs transition-all cursor-pointer shadow-md flex items-center justify-center gap-2 ${
                      activeTransactionAgent.type === 'recharge'
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
                          {activeTransactionAgent.type === 'recharge'
                            ? isAr
                              ? `تأكيد طلب شحن +${transactionAmount.toLocaleString()} ماسة`
                              : `Confirm Recharge (+${transactionAmount.toLocaleString()})`
                            : isAr
                            ? `تأكيد طلب سحب ${transactionAmount.toLocaleString()} ماسة`
                            : `Confirm Cashout (${transactionAmount.toLocaleString()})`}
                        </span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenContact(activeTransactionAgent.agent, 'whatsapp')}
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
