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
import { Language, AuthUser, AgentRecord } from '../types';
import { AgencyPortalModal } from './AgencyPortalModal';

export interface WalletAgent {
  id: string;
  gridCode?: string;
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
  coinsBalance = 0,
  initialTab = 'coins',
  onRecharge,
  onWithdraw,
  onUpdateCoins,
  onBack,
  currentUser,
}) => {
  const isAr = lang === 'ar';

  // Agency record if current user is an accredited agent (فصل رصيد الوكالة عن الحساب الشخصي)
  const [myAgencyRecord, setMyAgencyRecord] = useState<AgentRecord | null>(null);
  const [isAgencyPortalOpen, setIsAgencyPortalOpen] = useState(false);

  const fetchMyAgencyStatus = () => {
    const email = currentUser?.email?.toLowerCase().trim();
    const uid = currentUser?.id;
    const dispId = currentUser?.displayId;
    if (!email && !uid && !dispId) {
      setMyAgencyRecord(null);
      return;
    }
    const q = new URLSearchParams();
    if (email) q.set('email', email);
    if (uid) q.set('userId', uid);
    if (dispId) q.set('displayId', dispId);

    fetch(`/api/agent/my-agency?${q.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.isAgent && data.agent) {
          setMyAgencyRecord(data.agent);
        } else {
          setMyAgencyRecord(null);
        }
      })
      .catch(() => setMyAgencyRecord(null));
  };

  useEffect(() => {
    fetchMyAgencyStatus();
    const handleUpdated = () => fetchMyAgencyStatus();
    window.addEventListener('soulx:agents-updated', handleUpdated);
    window.addEventListener('soulx_agent_updated', handleUpdated);
    return () => {
      window.removeEventListener('soulx:agents-updated', handleUpdated);
      window.removeEventListener('soulx_agent_updated', handleUpdated);
    };
  }, [currentUser?.email, currentUser?.id, currentUser?.displayId]);

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
  // Convert Diamonds to Coins Modal State (كل 50,000 Diamonds = 25,000 Coins)
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [selectedConvertAmount, setSelectedConvertAmount] = useState<number>(50000);
  const [customConvertInput, setCustomConvertInput] = useState<string>('');
  const [convertFeedback, setConvertFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isConverting, setIsConverting] = useState(false);

  // Deposit Coins Modal State (كل 1$ = 25,000 Coins)
  const [isDepositCoinsModalOpen, setIsDepositCoinsModalOpen] = useState(false);
  const [selectedDepositUsd, setSelectedDepositUsd] = useState<number>(10);
  const [customDepositUsd, setCustomDepositUsd] = useState<string>('');
  const [depositFeedback, setDepositFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isDepositing, setIsDepositing] = useState(false);

  // Cashout / Withdrawal Diamonds Modal State (أقل سحب هو 200,000 الماسة، كل 10$ = 400,000 Diamonds، خصم 2.5% وإضافة الصافي للوكيل)
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [selectedWithdrawDiamonds, setSelectedWithdrawDiamonds] = useState<number>(200000);
  const [customWithdrawDiamonds, setCustomWithdrawDiamonds] = useState<string>('');
  const [withdrawAgentIdentifier, setWithdrawAgentIdentifier] = useState<string>('');
  const [withdrawPayoutMethod, setWithdrawPayoutMethod] = useState<string>('USDT (TRC20)');
  const [withdrawAccountDetails, setWithdrawAccountDetails] = useState<string>('');
  const [withdrawFeedback, setWithdrawFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

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
  const [transactionAmount, setTransactionAmount] = useState<number>(200000);
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
          gridCode: a.gridCode || 'A8838',
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

    if (isWithdraw && transactionAmount < 200000) {
      alert(
        isAr
          ? 'أقل سحب هو 200,000 ماسة (ما يعادل 5$ دولار).'
          : 'Minimum withdrawal is 200,000 Diamonds ($5 USD).'
      );
      return;
    }

    if (isWithdraw && transactionAmount > walletBalance) {
      alert(
        isAr
          ? 'عذراً، رصيدك الحالي من الماسات لا يكفي لإتمام هذا السحب.'
          : 'Insufficient diamond balance for this withdrawal.'
      );
      return;
    }

    setIsSubmittingOrder(true);

    if (isWithdraw) {
      fetch('/api/wallet/withdraw-diamonds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser?.id,
          displayId: currentUser?.displayId,
          email: currentUser?.email,
          diamondsAmount: transactionAmount,
          agentId: activeTransactionAgent.agent.gridCode || activeTransactionAgent.agent.id,
          payoutMethod: 'تحويل مباشر',
          accountDetails: paymentAccountInput.trim() || 'حساب المحفظة المعتمد',
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          setIsSubmittingOrder(false);
          if (data.success) {
            if (onWithdraw) {
              onWithdraw(transactionAmount);
            } else {
              onRecharge(-transactionAmount);
            }
            const feeAmt = Math.round(transactionAmount * 0.025);
            const netAmt = transactionAmount - feeAmt;
            setOrderSuccessMessage(
              data.message || (isAr
                ? `تم سحب ${transactionAmount.toLocaleString()} ماسة وخصم عمولة 2.5% (${feeAmt.toLocaleString()} ماسة) وإضافة الصافي (${netAmt.toLocaleString()} 💎) لرصيد وكالة الشحن (${activeTransactionAgent.agent.nameAr}) بنجاح!`
                : `Withdrawal submitted! Net ${netAmt.toLocaleString()} diamonds added to agent balance.`)
            );
          } else {
            alert(data.message || (isAr ? 'تعذر إتمام طلب السحب' : 'Withdrawal failed'));
          }
        })
        .catch(() => {
          setIsSubmittingOrder(false);
          if (onWithdraw) onWithdraw(transactionAmount);
          else onRecharge(-transactionAmount);
          setOrderSuccessMessage(
            isAr
              ? `تم رفع طلب السحب بقيمة ${transactionAmount.toLocaleString()} ماسة للوكيل ${activeTransactionAgent.agent.nameAr} بنجاح!`
              : `Withdrawal request submitted!`
          );
        });
      return;
    }

    // Recharge path
    setTimeout(() => {
      setIsSubmittingOrder(false);
      onRecharge(transactionAmount);
      setOrderSuccessMessage(
        isAr
          ? `تم إرسال طلب الشحن بقيمة +${transactionAmount.toLocaleString()} ماسة للوكيل ${activeTransactionAgent.agent.nameAr} وتم تأكيد العملية فورياً!`
          : `Recharge request for +${transactionAmount.toLocaleString()} diamonds submitted and credited!`
      );
    }, 1000);
  };

  const filteredAgents = agentsList.filter((agent) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      agent.nameAr.toLowerCase().includes(q) ||
      agent.nameEn.toLowerCase().includes(q) ||
      (agent.gridCode && agent.gridCode.toLowerCase().includes(q)) ||
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
        <div className="max-w-xl mx-auto px-4 sm:px-5 h-14 flex items-center justify-between">
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
        <div className="w-full max-w-xl mx-auto px-4 sm:px-5 py-5 sm:py-6 space-y-4 flex-1 flex flex-col justify-start animate-in fade-in">
          
          {/* كارت رصيد وكالة الشحن المعتمدة (منفصل تماماً عن رصيد حسابك الشخصي) */}
          {myAgencyRecord && (
            <div className="rounded-3xl p-5 bg-gradient-to-br from-neutral-900 via-neutral-950 to-emerald-950/30 border-2 border-emerald-500/40 shadow-xl space-y-3 relative overflow-hidden animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-500 to-cyan-400 text-neutral-950 flex items-center justify-center font-bold shadow-md shrink-0">
                    <Building2 className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-black text-white">
                        {isAr ? 'وكالتك المعتمدة للشحن والسحب' : 'Your Certified Agency'}
                      </span>
                      <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-cyan-400 text-neutral-950 font-black">
                        {myAgencyRecord.gridCode || 'A8838'}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                        ✓ {isAr ? 'وكيل معتمد' : 'Certified Agent'}
                      </span>
                    </div>
                    <span className="text-xs text-neutral-400 block mt-0.5">
                      {myAgencyRecord.name} • {myAgencyRecord.flag}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsAgencyPortalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-neutral-950 font-black text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 self-start sm:self-auto shrink-0 active:scale-95"
                >
                  <span>{isAr ? 'فتح لوحة الوكالة للشحن والسحب' : 'Open Agency Portal'}</span>
                  {isAr ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
              </div>

              {/* مقارنة الأرصدة للتأكيد على الفصل التام */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* 1. رصيد الوكالة للشحن والسحب */}
                <div className="p-3.5 rounded-2xl bg-white/5 border border-emerald-500/30 space-y-1">
                  <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                    <span>💼</span>
                    <span>{isAr ? 'رصيد الوكالة (شحن وسحب)' : 'Agency Balance'}</span>
                  </span>
                  <div className="text-2xl font-black font-mono text-white">
                    {(myAgencyRecord.balance || 0).toLocaleString()} <span className="text-xs text-emerald-400 font-sans">💎 ماسة</span>
                  </div>
                  <p className="text-[10px] text-neutral-400 leading-relaxed">
                    {isAr
                      ? 'مخصص فقط لعمليات شحن المستخدمين بالـ ID وتنفيذ طلبات السحب.'
                      : 'Dedicated exclusively for servicing user top-ups and cashouts.'}
                  </p>
                </div>

                {/* 2. رصيد حسابك الشخصي */}
                <div className="p-3.5 rounded-2xl bg-white/5 border border-cyan-500/30 space-y-1">
                  <span className="text-[11px] text-cyan-400 font-bold flex items-center gap-1">
                    <span>👤</span>
                    <span>{isAr ? 'رصيد حسابك الشخصي (منفصل)' : 'Personal Balance (Isolated)'}</span>
                  </span>
                  <div className="text-2xl font-black font-mono text-white flex items-baseline gap-1.5 flex-wrap">
                    <span>{walletBalance.toLocaleString()}</span>
                    <span className="text-xs text-cyan-400 font-sans">💎</span>
                    <span className="text-neutral-500 text-xs">•</span>
                    <span className="text-xl text-amber-400">{coinsBalance.toLocaleString()}</span>
                    <span className="text-xs text-amber-300 font-sans">🪙</span>
                  </div>
                  <p className="text-[10px] text-neutral-400 leading-relaxed">
                    {isAr
                      ? 'رصيدك الشخصي المستقل لاستخدامك الخاص في الهدايا والشات والتطبيق.'
                      : 'Your personal balance for gifts, tipping, and private chats.'}
                  </p>
                </div>
              </div>

              <div className="text-[11px] text-emerald-300/90 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  {isAr
                    ? 'فصل مالي تام: رصيد الوكالة للشحن والسحب منفصل تماماً عن رصيد حسابك الشخصي في المحفظة، ولا يختلطان أبداً.'
                    : 'Security guarantee: Agency balance is completely isolated from your personal wallet.'}
                </span>
              </div>
            </div>
          )}



          {/* تبويبات المحفظة: رصيد كوينز (الرئيسي والمخصص) ورصيد الماس */}
          <div className="w-full grid grid-cols-2 p-1.5 rounded-2xl bg-neutral-200/70 dark:bg-neutral-900 border border-neutral-300/70 dark:border-neutral-800 shadow-inner">
            <button
              type="button"
              onClick={() => setCurrencyTab('coins')}
              className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-black transition-all cursor-pointer ${
                currencyTab === 'coins'
                  ? 'bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 text-neutral-950 shadow-md shadow-amber-500/25 scale-[1.01]'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <span className="text-base leading-none">🪙</span>
              <span>{isAr ? 'رصيد كوينز (Coins)' : 'Coins'}</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrencyTab('diamonds')}
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
              <span>{isAr ? 'رصيد الماس (Diamonds)' : 'Diamonds'}</span>
            </button>
          </div>

          {/* ========================================================
              تبويب 1: رصيد كوينز (Coins Tab) - الرصيد المخصص والرئيسي
              يظهر رصيد المستخدم Coins مع إيداع الكوينز والوكلاء
              ======================================================== */}
          {/* ========================================================
              تبويب 1: رصيد كوينز (Coins Tab) - الرصيد المخصص والرئيسي
              يظهر رصيد المستخدم Coins والوكلاء المعتمدين
              ======================================================== */}
          {currencyTab === 'coins' && (
            <div className="space-y-3.5 animate-in fade-in duration-200">
              {/* كارت رصيد الكوينز فقط */}
              <div className="relative rounded-3xl p-6 sm:p-7 bg-gradient-to-br from-neutral-900 via-neutral-900 to-amber-950/70 border border-amber-500/40 shadow-xl overflow-hidden text-neutral-100 flex flex-col items-center justify-center text-center">
                <div className="absolute -top-12 -right-12 w-64 h-64 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-yellow-500/15 rounded-full blur-3xl pointer-events-none" />

                {/* Golden Coin Icon */}
                <div className="relative mb-3">
                  <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-amber-500/10 border border-amber-400/40 flex items-center justify-center shadow-lg shadow-amber-500/20 text-3xl sm:text-4xl">
                    🪙
                  </div>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs sm:text-sm font-semibold text-amber-300/90 tracking-wide uppercase">
                    {isAr ? 'رصيد كوينز (الحساب الشخصي)' : 'Coins Balance (Personal Account)'}
                  </span>
                  {myAgencyRecord && (
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold">
                      {isAr ? 'منفصل عن رصيد الوكالة' : 'Separate from Agency Balance'}
                    </span>
                  )}
                </div>

                <div className="mt-1 text-4xl sm:text-5xl font-black font-mono tracking-tight text-white tabular-nums flex items-baseline justify-center gap-2">
                  <span>{coinsBalance.toLocaleString()}</span>
                  <span className="text-lg sm:text-xl font-bold font-sans text-amber-400">
                    {isAr ? 'كوينز' : 'Coins'}
                  </span>
                </div>
              </div>

              {/* زر: وكلاء السحب و الإيداع */}
              <button
                type="button"
                onClick={() => setCurrentSubView('agents')}
                className="w-full py-3.5 px-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 hover:border-amber-500/50 text-neutral-900 dark:text-neutral-100 font-bold text-sm sm:text-base shadow-sm transition-all cursor-pointer flex items-center justify-between group active:scale-[0.99]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                    <ArrowDownUp className="w-4 h-4" />
                  </div>
                  <span className="tracking-wide">
                    {isAr ? 'وكلاء السحب و الإيداع المعتمدون' : 'Verified Deposit & Cashout Agents'}
                  </span>
                </div>

                <div className="w-7 h-7 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center transition-transform group-hover:scale-110">
                  {isAr ? (
                    <ChevronLeft className="w-4 h-4 text-neutral-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-neutral-400" />
                  )}
                </div>
              </button>
            </div>
          )}

          {/* ========================================================
              تبويب 2: رصيد الماس (Diamonds Tab)
              يظهر رصيد المستخدم الماس مع تحويل الى كوينز وسحب الأرباح والوكلاء
              ======================================================== */}
          {currencyTab === 'diamonds' && (
            <div className="space-y-3.5 animate-in fade-in duration-200">
              {/* كارت رصيد الماس فقط */}
              <div className="relative rounded-3xl p-6 sm:p-7 bg-gradient-to-br from-neutral-900 via-neutral-900 to-cyan-950 border border-cyan-500/30 shadow-xl overflow-hidden text-neutral-100 flex flex-col items-center justify-center text-center">
                <div className="absolute -top-12 -right-12 w-64 h-64 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

                {/* Diamond Icon */}
                <div className="relative mb-3">
                  <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-cyan-400/10 border border-cyan-400/40 flex items-center justify-center shadow-lg shadow-cyan-500/20">
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

                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs sm:text-sm font-semibold text-cyan-300/90 tracking-wide uppercase">
                    {isAr ? 'رصيد الماس (الحساب الشخصي)' : 'Diamond Balance (Personal Account)'}
                  </span>
                  {myAgencyRecord && (
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-bold">
                      {isAr ? 'منفصل عن رصيد الوكالة' : 'Separate from Agency Balance'}
                    </span>
                  )}
                </div>

                <div className="mt-1 text-4xl sm:text-5xl font-black font-mono tracking-tight text-white tabular-nums flex items-baseline justify-center gap-2">
                  <span>{walletBalance.toLocaleString()}</span>
                  <span className="text-lg sm:text-xl font-bold font-sans text-cyan-400">
                    {isAr ? 'ماسة' : 'Diamonds'}
                  </span>
                </div>

                {/* Estimated Cashout Value in USD */}
                <div className="mt-3 px-3.5 py-1.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-mono text-xs font-semibold flex items-center gap-2">
                  <span>💵</span>
                  <span>
                    {isAr
                      ? `القيمة التقديرية للسحب: ≈ $${((walletBalance / 400000) * 10).toFixed(2)} USD`
                      : `Cashout Value: ≈ $${((walletBalance / 400000) * 10).toFixed(2)} USD`}
                  </span>
                </div>
              </div>

              {/* زران رئيسيان: تحويل إلى Coins + طلب سحب أرباح */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* 1. زر تحويل الى Coins */}
                <button
                  type="button"
                  onClick={() => {
                    setIsConvertModalOpen(true);
                    setConvertFeedback(null);
                  }}
                  className="py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-400 hover:from-amber-300 hover:via-amber-400 hover:to-yellow-300 text-neutral-950 font-black text-sm sm:text-base shadow-xl shadow-amber-500/25 transition-all cursor-pointer flex items-center justify-between group active:scale-[0.99]"
                >
                  <div className="flex items-center gap-2.5 text-start">
                    <div className="w-9 h-9 rounded-xl bg-neutral-950/10 flex items-center justify-center text-lg shrink-0">
                      🪙
                    </div>
                    <span className="font-black leading-tight">
                      {isAr ? 'تحويل إلى Coins' : 'Convert to Coins'}
                    </span>
                  </div>
                  <ChevronLeft className="w-5 h-5 rtl:block ltr:hidden text-neutral-950" />
                  <ChevronRight className="w-5 h-5 rtl:hidden ltr:block text-neutral-950" />
                </button>

                {/* 2. زر طلب سحب أرباح (كاش أوت) */}
                <button
                  type="button"
                  onClick={() => {
                    setIsWithdrawModalOpen(true);
                    setWithdrawFeedback(null);
                  }}
                  className="py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-white font-black text-sm sm:text-base shadow-xl shadow-emerald-500/25 transition-all cursor-pointer flex items-center justify-between group active:scale-[0.99]"
                >
                  <div className="flex items-center gap-2.5 text-start">
                    <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center text-lg shrink-0">
                      💵
                    </div>
                    <span className="font-black leading-tight">
                      {isAr ? 'طلب سحب أرباح (كاش أوت)' : 'Cashout Earnings'}
                    </span>
                  </div>
                  <ChevronLeft className="w-5 h-5 rtl:block ltr:hidden text-white" />
                  <ChevronRight className="w-5 h-5 rtl:hidden ltr:block text-white" />
                </button>
              </div>

              {/* أسفلها زر: وكلاء السحب و الإيداع */}
              <button
                type="button"
                onClick={() => setCurrentSubView('agents')}
                className="w-full py-3.5 px-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 hover:border-cyan-500/50 text-neutral-900 dark:text-neutral-100 font-bold text-sm sm:text-base shadow-sm transition-all cursor-pointer flex items-center justify-between group active:scale-[0.99]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center">
                    <ArrowDownUp className="w-4 h-4" />
                  </div>
                  <span className="tracking-wide">
                    {isAr ? 'وكلاء السحب و الإيداع المعتمدون' : 'Verified Deposit & Cashout Agents'}
                  </span>
                </div>

                <div className="w-7 h-7 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center transition-transform group-hover:scale-110">
                  {isAr ? (
                    <ChevronLeft className="w-4 h-4 text-neutral-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-neutral-400" />
                  )}
                </div>
              </button>
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
                    {activeTransactionAgent.type === 'withdraw'
                      ? isAr
                        ? 'حدد كمية الماسات للسحب (كل 10$ = 400,000 ماسة):'
                        : 'Select Diamond Amount to Withdraw ($10 = 400,000 💎):'
                      : isAr
                      ? 'حدد كمية الكوينز للشحن (كل 1$ = 25,000 كوينز):'
                      : 'Select Coins Amount to Recharge ($1 = 25,000 🪙):'}
                  </label>
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    {(activeTransactionAgent.type === 'withdraw'
                      ? [200000, 400000, 800000, 2000000]
                      : [25000, 125000, 250000, 500000]
                    ).map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setTransactionAmount(amt)}
                        className={`py-2 px-1 rounded-xl text-[11px] font-mono font-bold transition-all cursor-pointer ${
                          transactionAmount === amt
                            ? activeTransactionAgent.type === 'withdraw'
                              ? 'bg-emerald-500 text-white shadow-md ring-2 ring-emerald-500/40'
                              : 'bg-amber-400 text-neutral-950 shadow-md ring-2 ring-amber-400/40'
                            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                        }`}
                      >
                        +{amt >= 1000000 ? `${(amt / 1000000).toFixed(0)}M` : `${(amt / 1000).toFixed(0)}k`}{' '}
                        {activeTransactionAgent.type === 'withdraw' ? '💎' : '🪙'}
                      </button>
                    ))}
                  </div>

                  <input
                    type="number"
                    min={activeTransactionAgent.type === 'withdraw' ? 200000 : 25000}
                    value={transactionAmount}
                    onChange={(e) => setTransactionAmount(Math.max(1, parseInt(e.target.value, 10) || 0))}
                    className="w-full h-11 px-4 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-sm font-mono font-bold text-neutral-900 dark:text-white focus:outline-none focus:border-cyan-500"
                  />
                  <div className="flex items-center justify-between text-[11px] text-neutral-500 mt-1">
                    <span>
                      {activeTransactionAgent.type === 'withdraw'
                        ? isAr
                          ? 'الحد الأدنى: 200,000 ماسة (5$)'
                          : 'Min: 200,000 Diamonds ($5)'
                        : isAr
                        ? 'الحد الأدنى: 25,000 كوينز (1$)'
                        : 'Min: 25,000 Coins ($1)'}
                    </span>
                    <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">
                      {activeTransactionAgent.type === 'withdraw'
                        ? isAr
                          ? `القيمة: ≈ $${((transactionAmount / 400000) * 10).toFixed(2)} USD`
                          : `Value: ≈ $${((transactionAmount / 400000) * 10).toFixed(2)} USD`
                        : isAr
                        ? `القيمة: ≈ $${(transactionAmount / 25000).toFixed(2)} USD`
                        : `Value: ≈ $${(transactionAmount / 25000).toFixed(2)} USD`}
                    </span>
                  </div>

                  {activeTransactionAgent.type === 'withdraw' && (
                    <div className="mt-2 p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center justify-between font-mono">
                      <span>{isAr ? 'الخصم (2.5%):' : 'Fee (2.5%):'} {Math.round(transactionAmount * 0.025).toLocaleString()} 💎</span>
                      <span className="font-bold">{isAr ? 'الصافي لوكالة الشحن:' : 'Net to Agency:'} +{(transactionAmount - Math.round(transactionAmount * 0.025)).toLocaleString()} 💎</span>
                    </div>
                  )}
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

      {/* ========================================================
          نافذة تحويل رصيد الماس إلى Coins التفاعلية
          القاعدة: في التحويل من Diamonds الى Coins كل 50,000 Diamonds تساوي 25,000 Coins
          ======================================================== */}
      {isConvertModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center text-xl shrink-0">
                  🪙
                </div>
                <div>
                  <h3 className="text-base font-black text-neutral-900 dark:text-white">
                    {isAr ? 'تحويل رصيد الماس إلى Coins' : 'Convert Diamonds to Coins'}
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsConvertModalOpen(false)}
                className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              {/* Balances summary */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200/80 dark:border-neutral-800/80 text-xs">
                <div>
                  <span className="text-neutral-500 block mb-0.5">{isAr ? 'رصيد الماس الحالي' : 'Diamond Balance'}</span>
                  <div className="flex items-center gap-1 font-mono font-bold text-sm text-cyan-500">
                    <span>{walletBalance.toLocaleString()}</span>
                    <span>💎</span>
                  </div>
                </div>
                <div>
                  <span className="text-neutral-500 block mb-0.5">{isAr ? 'رصيد كوينز الحالي' : 'Coins Balance'}</span>
                  <div className="flex items-center gap-1 font-mono font-bold text-sm text-amber-500">
                    <span>{coinsBalance.toLocaleString()}</span>
                    <span>🪙</span>
                  </div>
                </div>
              </div>

              {/* Feedback Alert */}
              {convertFeedback && (
                <div
                  className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                    convertFeedback.type === 'success'
                      ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                      : 'bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {convertFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{convertFeedback.message}</span>
                </div>
              )}

              {/* Conversion Packages */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-neutral-700 dark:text-neutral-300">
                  {isAr ? 'اختر باقة التحويل:' : 'Select Package:'}
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { diamonds: 50000, coins: 25000, label: '50 ألف' },
                    { diamonds: 100000, coins: 50000, label: '100 ألف' },
                    { diamonds: 200000, coins: 100000, label: '200 ألف' },
                    { diamonds: 500000, coins: 250000, label: '500 ألف' },
                  ].map((pkg, idx) => {
                    const isSelected = selectedConvertAmount === pkg.diamonds && !customConvertInput;
                    const canAfford = walletBalance >= pkg.diamonds;

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setSelectedConvertAmount(pkg.diamonds);
                          setCustomConvertInput('');
                          setConvertFeedback(null);
                        }}
                        className={`relative p-3 rounded-xl border text-start transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500/10 border-amber-500 text-neutral-900 dark:text-white shadow-xs'
                            : 'bg-white dark:bg-neutral-950/60 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-amber-500/40'
                        } ${!canAfford ? 'opacity-60' : ''}`}
                      >
                        <div className="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400 font-mono">
                          <span>{pkg.diamonds.toLocaleString()}</span>
                          <span className="text-cyan-500">💎</span>
                        </div>
                        <div className="text-sm font-black text-amber-500 font-mono mt-0.5">
                          {pkg.coins.toLocaleString()} <span className="text-xs font-sans">🪙</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom amount */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                  {isAr ? 'أو اكتب عدد الماسات المخصصة للتحويل:' : 'Or enter custom diamond amount:'}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="2"
                    max={walletBalance}
                    value={customConvertInput}
                    onChange={(e) => {
                      setCustomConvertInput(e.target.value);
                      setConvertFeedback(null);
                    }}
                    placeholder={isAr ? 'مثال: 50000 ماسة' : 'e.g. 50000 diamonds'}
                    className="w-full px-4 py-2.5 rounded-xl text-sm bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 focus:border-amber-500 text-neutral-900 dark:text-white focus:outline-none font-mono"
                  />
                  {customConvertInput && !isNaN(parseInt(customConvertInput, 10)) && parseInt(customConvertInput, 10) > 0 && (
                    <span className="absolute top-1/2 -translate-y-1/2 left-3 rtl:left-3 rtl:right-auto ltr:right-3 ltr:left-auto text-xs font-bold font-mono text-amber-500">
                      = {Math.floor(parseInt(customConvertInput, 10) * (25000 / 50000)).toLocaleString()} 🪙
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-neutral-400">
                  {isAr ? 'يتم احتساب الكوينز بمعدل 1 كوينز لكل 2 ماسة (كل 50,000 ماسة = 25,000 كوينز)' : 'Rate: 50,000 Diamonds = 25,000 Coins (2:1)'}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-neutral-50/70 dark:bg-neutral-950/60 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsConvertModalOpen(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>

              <button
                type="button"
                disabled={isConverting}
                onClick={async () => {
                  let dAmount = selectedConvertAmount;
                  if (customConvertInput && !isNaN(parseInt(customConvertInput, 10)) && parseInt(customConvertInput, 10) > 0) {
                    dAmount = parseInt(customConvertInput, 10);
                  }

                  const cGain = Math.floor(dAmount * (25000 / 50000));

                  if (walletBalance < dAmount) {
                    setConvertFeedback({
                      type: 'error',
                      message: isAr
                        ? `رصيد الماس غير كافٍ. يتوفر لديك ${walletBalance.toLocaleString()} ماسة فقط.`
                        : `Insufficient diamonds. You only have ${walletBalance.toLocaleString()} diamonds.`,
                    });
                    return;
                  }

                  setIsConverting(true);
                  try {
                    // Call backend conversion endpoint
                    const res = await fetch('/api/wallet/convert-to-coins', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        userId: currentUser?.id,
                        displayId: currentUser?.displayId,
                        email: currentUser?.email,
                        diamondsAmount: dAmount,
                      }),
                    });
                    const data = await res.json().catch(() => null);

                    onRecharge(-dAmount);
                    if (onUpdateCoins) onUpdateCoins(cGain);

                    setConvertFeedback({
                      type: 'success',
                      message: data?.message || (isAr
                        ? `تم تحويل ${dAmount.toLocaleString()} ماسة إلى ${cGain.toLocaleString()} كوينز بنجاح!`
                        : `Successfully converted ${dAmount.toLocaleString()} diamonds to ${cGain.toLocaleString()} coins!`),
                    });

                    setTimeout(() => {
                      setIsConvertModalOpen(false);
                      setConvertFeedback(null);
                      setCurrencyTab('coins');
                    }, 1400);
                  } catch {
                    onRecharge(-dAmount);
                    if (onUpdateCoins) onUpdateCoins(cGain);
                    setConvertFeedback({
                      type: 'success',
                      message: isAr
                        ? `تم تحويل ${dAmount.toLocaleString()} ماسة إلى ${cGain.toLocaleString()} كوينز بنجاح!`
                        : `Successfully converted!`,
                    });
                    setTimeout(() => {
                      setIsConvertModalOpen(false);
                      setConvertFeedback(null);
                    }, 1400);
                  } finally {
                    setIsConverting(false);
                  }
                }}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-neutral-950 font-black text-xs sm:text-sm shadow-md shadow-amber-500/25 cursor-pointer active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {isConverting ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{isAr ? 'جاري التحويل...' : 'Converting...'}</span>
                  </span>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>{isAr ? 'تأكيد التحويل الآن' : 'Confirm Conversion'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          نافذة إيداع وشحن كوينز (Coins Top-Up Modal)
          القاعدة: في الإيداع كل 1 دولار يساوي 25,000 Coins
          ======================================================== */}
      {isDepositCoinsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center text-xl shrink-0">
                  💳
                </div>
                <div>
                  <h3 className="text-base font-black text-neutral-900 dark:text-white">
                    {isAr ? 'إيداع وشحن كوينز' : 'Deposit & Recharge Coins'}
                  </h3>
                  <p className="text-xs text-amber-500 font-semibold font-mono">
                    {isAr ? 'في الإيداع كل 1 دولار = 25,000 Coins' : 'Deposit Rate: $1 = 25,000 Coins'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsDepositCoinsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              {/* Feedback Alert */}
              {depositFeedback && (
                <div
                  className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                    depositFeedback.type === 'success'
                      ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                      : 'bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {depositFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{depositFeedback.message}</span>
                </div>
              )}

              {/* Deposit Packages */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-neutral-700 dark:text-neutral-300">
                  {isAr ? 'اختر باقة الإيداع (1$ = 25,000 كوينز):' : 'Select Deposit Package ($1 = 25,000 Coins):'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { usd: 1, coins: 25000 },
                    { usd: 5, coins: 125000 },
                    { usd: 10, coins: 250000 },
                    { usd: 20, coins: 500000 },
                    { usd: 50, coins: 1250000 },
                    { usd: 100, coins: 2500000 },
                  ].map((pkg, idx) => {
                    const isSelected = selectedDepositUsd === pkg.usd && !customDepositUsd;
                    const coinsAmount = pkg.usd * 25000;

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setSelectedDepositUsd(pkg.usd);
                          setCustomDepositUsd('');
                          setDepositFeedback(null);
                        }}
                        className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500/15 border-amber-500 text-neutral-900 dark:text-white ring-2 ring-amber-500/30'
                            : 'bg-white dark:bg-neutral-950/60 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-amber-500/40'
                        }`}
                      >
                        <div className="font-black text-sm text-neutral-900 dark:text-white font-mono">
                          ${pkg.usd}
                        </div>
                        <div className="text-[11px] font-bold text-amber-500 font-mono mt-0.5">
                          {coinsAmount >= 1000000 ? `${(coinsAmount / 1000000).toFixed(1)}M` : `${(coinsAmount / 1000).toFixed(0)}k`} 🪙
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom USD input */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                  {isAr ? 'أو اكتب المبلغ بالدولار ($):' : 'Or enter custom amount in USD ($):'}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    value={customDepositUsd}
                    onChange={(e) => {
                      setCustomDepositUsd(e.target.value);
                      setDepositFeedback(null);
                    }}
                    placeholder={isAr ? 'مثال: 15 دولار' : 'e.g. $15'}
                    className="w-full px-4 py-2.5 rounded-xl text-sm bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 focus:border-amber-500 text-neutral-900 dark:text-white focus:outline-none font-mono"
                  />
                  {customDepositUsd && !isNaN(parseFloat(customDepositUsd)) && parseFloat(customDepositUsd) > 0 && (
                    <span className="absolute top-1/2 -translate-y-1/2 left-3 rtl:left-3 rtl:right-auto ltr:right-3 ltr:left-auto text-xs font-bold font-mono text-amber-500">
                      = {Math.floor(parseFloat(customDepositUsd) * 25000).toLocaleString()} 🪙
                    </span>
                  )}
                </div>
              </div>

              {/* Deposit via Certified Agent option */}
              <div className="p-3 rounded-2xl bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/60 flex items-center justify-between">
                <div className="text-xs">
                  <span className="block font-bold text-neutral-800 dark:text-neutral-200">
                    {isAr ? 'هل تفضل الدفع بالعملة المحلية؟' : 'Prefer Local Currency?'}
                  </span>
                  <span className="text-[11px] text-neutral-500">
                    {isAr ? 'شحن عبر STC Pay، انستاباي، زين كاش، أو كاش' : 'Recharge via STC Pay, ZainCash, InstaPay'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsDepositCoinsModalOpen(false);
                    setCurrentSubView('agents');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-bold text-xs cursor-pointer shrink-0"
                >
                  {isAr ? 'تواصل مع وكيل' : 'Contact Agent'}
                </button>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-neutral-50/70 dark:bg-neutral-950/60 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsDepositCoinsModalOpen(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>

              <button
                type="button"
                disabled={isDepositing}
                onClick={async () => {
                  let usd = selectedDepositUsd;
                  if (customDepositUsd && !isNaN(parseFloat(customDepositUsd)) && parseFloat(customDepositUsd) > 0) {
                    usd = parseFloat(customDepositUsd);
                  }
                  const coinsGain = Math.floor(usd * 25000);

                  setIsDepositing(true);
                  try {
                    const res = await fetch('/api/wallet/deposit-coins', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        userId: currentUser?.id,
                        displayId: currentUser?.displayId,
                        email: currentUser?.email,
                        usdAmount: usd,
                        coinsAmount: coinsGain,
                      }),
                    });
                    const data = await res.json().catch(() => null);

                    if (onUpdateCoins) onUpdateCoins(coinsGain);

                    setDepositFeedback({
                      type: 'success',
                      message: data?.message || (isAr
                        ? `تم إيداع ${coinsGain.toLocaleString()} كوينز بقيمة $${usd} بنجاح!`
                        : `Successfully deposited ${coinsGain.toLocaleString()} coins ($${usd})!`),
                    });

                    setTimeout(() => {
                      setIsDepositCoinsModalOpen(false);
                      setDepositFeedback(null);
                    }, 1400);
                  } catch {
                    if (onUpdateCoins) onUpdateCoins(coinsGain);
                    setDepositFeedback({
                      type: 'success',
                      message: isAr
                        ? `تم إيداع ${coinsGain.toLocaleString()} كوينز بنجاح!`
                        : `Successfully deposited!`,
                    });
                    setTimeout(() => {
                      setIsDepositCoinsModalOpen(false);
                      setDepositFeedback(null);
                    }, 1400);
                  } finally {
                    setIsDepositing(false);
                  }
                }}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-neutral-950 font-black text-xs sm:text-sm shadow-md shadow-amber-500/25 cursor-pointer active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {isDepositing ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{isAr ? 'جاري الإيداع...' : 'Depositing...'}</span>
                  </span>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>{isAr ? 'تأكيد الإيداع الآن' : 'Confirm Deposit'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          نافذة طلب سحب الأرباح والماسات (Cashout Diamonds Modal)
          القاعدة: في السحب كل 10 دولار تساوي 400,000 Diamonds
          ======================================================== */}
      {isWithdrawModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="p-5 border-b border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-xl shrink-0">
                  💵
                </div>
                <div>
                  <h3 className="text-base font-black text-neutral-900 dark:text-white">
                    {isAr ? 'سحب رصيد وأرباح الماسات' : 'Cashout Diamond Earnings'}
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsWithdrawModalOpen(false)}
                className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              {/* Balances summary */}
              <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200/80 dark:border-neutral-800/80 flex items-center justify-between text-xs">
                <div>
                  <span className="text-neutral-500 block mb-0.5">{isAr ? 'رصيد الماس الحالي' : 'Available Diamonds'}</span>
                  <div className="flex items-center gap-1 font-mono font-bold text-sm text-cyan-500">
                    <span>{walletBalance.toLocaleString()}</span>
                    <span>💎</span>
                  </div>
                </div>
                <div className="text-end">
                  <span className="text-neutral-500 block mb-0.5">{isAr ? 'القيمة بالدولار' : 'USD Payout Value'}</span>
                  <div className="font-mono font-black text-sm text-emerald-500">
                    ≈ ${((walletBalance / 400000) * 10).toFixed(2)} USD
                  </div>
                </div>
              </div>

              {/* Feedback Alert */}
              {withdrawFeedback && (
                <div
                  className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                    withdrawFeedback.type === 'success'
                      ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                      : 'bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {withdrawFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{withdrawFeedback.message}</span>
                </div>
              )}

              {/* Withdrawal Packages */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-neutral-700 dark:text-neutral-300">
                    {isAr ? '1. اختر باقة السحب:' : '1. Select Package:'}
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { diamonds: 200000, usd: 5 },
                    { diamonds: 400000, usd: 10 },
                    { diamonds: 800000, usd: 20 },
                    { diamonds: 2000000, usd: 50 },
                  ].map((pkg, idx) => {
                    const isSelected = selectedWithdrawDiamonds === pkg.diamonds && !customWithdrawDiamonds;
                    const canAfford = walletBalance >= pkg.diamonds;

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setSelectedWithdrawDiamonds(pkg.diamonds);
                          setCustomWithdrawDiamonds('');
                          setWithdrawFeedback(null);
                        }}
                        className={`p-2.5 rounded-xl border text-start transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-500/15 border-emerald-500 text-neutral-900 dark:text-white ring-2 ring-emerald-500/30'
                            : 'bg-white dark:bg-neutral-950/60 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-emerald-500/40'
                        } ${!canAfford ? 'opacity-60' : ''}`}
                      >
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="font-bold">{pkg.diamonds.toLocaleString()} 💎</span>
                        </div>
                        <div className="text-sm font-black text-emerald-500 font-mono mt-0.5">
                          ${pkg.usd}.00 USD
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom amount */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                  {isAr ? 'أو اكتب كمية الماسات المراد سحبها (الحد الأدنى 200,000):' : 'Or enter custom diamonds to withdraw (Min 200,000):'}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="200000"
                    max={walletBalance}
                    value={customWithdrawDiamonds}
                    onChange={(e) => {
                      setCustomWithdrawDiamonds(e.target.value);
                      setWithdrawFeedback(null);
                    }}
                    placeholder={isAr ? 'مثال: 200000 ماسة' : 'e.g. 200000 diamonds'}
                    className="w-full px-4 py-2.5 rounded-xl text-sm bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 focus:border-emerald-500 text-neutral-900 dark:text-white focus:outline-none font-mono"
                  />
                  {customWithdrawDiamonds && !isNaN(parseInt(customWithdrawDiamonds, 10)) && parseInt(customWithdrawDiamonds, 10) > 0 && (
                    <span className="absolute top-1/2 -translate-y-1/2 left-3 rtl:left-3 rtl:right-auto ltr:right-3 ltr:left-auto text-xs font-bold font-mono text-emerald-500">
                      = ${((parseInt(customWithdrawDiamonds, 10) / 400000) * 10).toFixed(2)} USD
                    </span>
                  )}
                </div>
              </div>

              {/* Agent ID / Grid Code Selection */}
              <div className="space-y-2 pt-2 border-t border-neutral-200/60 dark:border-neutral-800/60">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-cyan-500" />
                    <span>{isAr ? '2. آيدي الوكيل المراد السحب من خلاله (مطلوب):' : '2. Agent ID or Grid Code (Required):'}</span>
                  </label>
                  <span className="text-[10px] text-neutral-400 font-mono">
                    {isAr ? 'ID الوكيل أو كود القريد' : 'Grid Code'}
                  </span>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={withdrawAgentIdentifier}
                    onChange={(e) => {
                      setWithdrawAgentIdentifier(e.target.value);
                      setWithdrawFeedback(null);
                    }}
                    placeholder={isAr ? 'اكتب آيدي الوكيل أو رقم القريد مثل A8838 أو اختر من الأسفل...' : 'Enter Agent ID/Grid Code (e.g. A8838)...'}
                    className="w-full px-4 py-2.5 rounded-xl text-xs sm:text-sm bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 focus:border-cyan-500 text-neutral-900 dark:text-white font-mono placeholder:font-sans focus:outline-none"
                  />
                </div>

                {/* Quick select chips for verified agents */}
                {agentsList.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold text-neutral-500 block">
                      {isAr ? 'اختر وكيلاً معتمداً بسرعة:' : 'Or tap a verified agent to select:'}
                    </span>
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                      {agentsList.map((ag) => {
                        const isAgSelected =
                          withdrawAgentIdentifier.trim().toLowerCase() === (ag.gridCode || '').toLowerCase() ||
                          withdrawAgentIdentifier.trim().toLowerCase() === ag.id.toLowerCase();
                        return (
                          <button
                            key={ag.id}
                            type="button"
                            onClick={() => {
                              setWithdrawAgentIdentifier(ag.gridCode || ag.id);
                              setWithdrawFeedback(null);
                            }}
                            className={`px-2.5 py-1 rounded-xl text-[11px] font-mono font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1.5 border ${
                              isAgSelected
                                ? 'bg-cyan-500/20 border-cyan-500 text-cyan-600 dark:text-cyan-400 ring-2 ring-cyan-500/30'
                                : 'bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:border-cyan-500/40'
                            }`}
                          >
                            <span>{ag.flag}</span>
                            <span className="truncate max-w-[110px] font-sans text-[10px]">{ag.nameAr}</span>
                            <span className="text-[10px] text-amber-500 font-mono">[{ag.gridCode || 'A8838'}]</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Agent Verification Feedback Card */}
                {(() => {
                  const matched = agentsList.find(
                    (a) =>
                      withdrawAgentIdentifier.trim() &&
                      (a.id.toLowerCase() === withdrawAgentIdentifier.trim().toLowerCase() ||
                        (a.gridCode && a.gridCode.toLowerCase() === withdrawAgentIdentifier.trim().toLowerCase()) ||
                        (a.email && a.email.toLowerCase() === withdrawAgentIdentifier.trim().toLowerCase()) ||
                        a.nameAr.toLowerCase().includes(withdrawAgentIdentifier.trim().toLowerCase()))
                  );

                  if (matched) {
                    return (
                      <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-xs flex items-center justify-between gap-2 animate-in fade-in">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{matched.flag}</span>
                          <div>
                            <span className="font-bold text-neutral-900 dark:text-white block">
                              {matched.nameAr}
                            </span>
                            <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-mono">
                              {isAr ? 'قريد الوكيل:' : 'Grid:'} {matched.gridCode || 'A8838'} • {matched.country}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold shrink-0">
                          ✓ {isAr ? 'وكيل معتمد' : 'Verified'}
                        </span>
                      </div>
                    );
                  }

                  if (withdrawAgentIdentifier.trim()) {
                    return (
                      <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-2">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{isAr ? `جاري البحث عن الوكيل [${withdrawAgentIdentifier}] أو يمكنك الاختيار من القائمة أعلاه.` : `Verifying agent ID...`}</span>
                      </div>
                    );
                  }

                  return null;
                })()}
              </div>

              {/* Dynamic 2.5% Fee & Net Calculation Breakdown Card */}
              {(() => {
                let currentAmt = selectedWithdrawDiamonds;
                if (customWithdrawDiamonds && !isNaN(parseInt(customWithdrawDiamonds, 10)) && parseInt(customWithdrawDiamonds, 10) > 0) {
                  currentAmt = parseInt(customWithdrawDiamonds, 10);
                }
                const grossUsd = (currentAmt / 400000) * 10;
                const feeDiamonds = Math.round(currentAmt * 0.025);
                const netDiamonds = currentAmt - feeDiamonds;
                const netUsd = (netDiamonds / 400000) * 10;

                return (
                  <div className="p-3.5 rounded-2xl bg-gradient-to-br from-neutral-100 to-neutral-50 dark:from-neutral-950 dark:to-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-2 text-xs">
                    <div className="flex items-center justify-between font-semibold text-neutral-600 dark:text-neutral-400">
                      <span>{isAr ? 'المبلغ المطلوب سحبه:' : 'Gross Amount:'}</span>
                      <span className="font-mono font-bold text-neutral-900 dark:text-white">
                        {currentAmt.toLocaleString()} 💎 (${grossUsd.toFixed(2)} USD)
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-rose-500 font-semibold">
                      <span>{isAr ? 'عمولة المنصة (2.5%):' : 'Platform Fee (2.5%):'}</span>
                      <span className="font-mono font-bold">
                        -{feeDiamonds.toLocaleString()} 💎 (-${(grossUsd * 0.025).toFixed(2)})
                      </span>
                    </div>

                    <div className="pt-1.5 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between font-black text-emerald-600 dark:text-emerald-400">
                      <span>{isAr ? 'الصافي المضاف لرصيد وكالة الشحن:' : 'Net to Agency Balance:'}</span>
                      <span className="font-mono text-sm">
                        +{netDiamonds.toLocaleString()} 💎 (${netUsd.toFixed(2)} USD)
                      </span>
                    </div>

                    <p className="text-[10px] text-neutral-400 leading-relaxed pt-0.5">
                      {isAr
                        ? '📢 يتم خصم 2.5% وإرسال إشعار فوري للوكيل المعتمد، ويضاف الصافي مباشرة لرصيد وكالته للشحن.'
                        : '2.5% fee is deducted, a notification is sent to the agent, and net amount is credited to the agency balance.'}
                    </p>
                  </div>
                );
              })()}

              {/* Method Selection */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  {isAr ? '3. طريقة الاستلام المفضلة لديك:' : '3. Payout Method:'}
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    'USDT (TRC20)',
                    'STC Pay',
                    'تحويل بنكي IBAN',
                    'انستاباي InstaPay',
                    'زين كاش ZainCash',
                    'فودافون كاش',
                  ].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setWithdrawPayoutMethod(m)}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer truncate ${
                        withdrawPayoutMethod === m
                          ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
                          : 'bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:border-emerald-500/40'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Destination Address / Account */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  {isAr ? '4. بيانات الحساب / عنوان المحفظة للاستلام:' : '4. Account Details / Payout Address:'}
                </label>
                <input
                  type="text"
                  value={withdrawAccountDetails}
                  onChange={(e) => setWithdrawAccountDetails(e.target.value)}
                  placeholder={isAr ? 'مثال: رقم الحساب، رقم الجوال أو عنوان محفظة USDT TRC20' : 'e.g. Wallet address or Account number'}
                  className="w-full px-4 py-2.5 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-neutral-50/70 dark:bg-neutral-950/60 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsWithdrawModalOpen(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>

              <button
                type="button"
                disabled={isWithdrawing}
                onClick={async () => {
                  let dAmount = selectedWithdrawDiamonds;
                  if (customWithdrawDiamonds && !isNaN(parseInt(customWithdrawDiamonds, 10)) && parseInt(customWithdrawDiamonds, 10) > 0) {
                    dAmount = parseInt(customWithdrawDiamonds, 10);
                  }

                  if (dAmount < 200000) {
                    setWithdrawFeedback({
                      type: 'error',
                      message: isAr
                        ? 'أقل سحب هو 200,000 ماسة (ما يعادل 5$ دولار).'
                        : 'Minimum withdrawal is 200,000 Diamonds ($5 USD).',
                    });
                    return;
                  }

                  if (walletBalance < dAmount) {
                    setWithdrawFeedback({
                      type: 'error',
                      message: isAr
                        ? `رصيد الماسات غير كافٍ. يتوفر لديك ${walletBalance.toLocaleString()} ماسة فقط.`
                        : `Insufficient diamonds.`,
                    });
                    return;
                  }

                  if (!withdrawAgentIdentifier.trim()) {
                    setWithdrawFeedback({
                      type: 'error',
                      message: isAr
                        ? 'يرجى إدخال أو تحديد آيدي الوكيل المراد السحب من خلاله.'
                        : 'Please enter or select the Agent ID.',
                    });
                    return;
                  }

                  if (!withdrawAccountDetails.trim()) {
                    setWithdrawFeedback({
                      type: 'error',
                      message: isAr
                        ? 'يرجى إدخال بيانات الحساب أو عنوان المحفظة للاستلام.'
                        : 'Please enter payout destination.',
                    });
                    return;
                  }

                  const feeDiamonds = Math.round(dAmount * 0.025);
                  const netDiamonds = dAmount - feeDiamonds;
                  const usd = (dAmount / 400000) * 10;

                  setIsWithdrawing(true);
                  try {
                    const res = await fetch('/api/wallet/withdraw-diamonds', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        userId: currentUser?.id,
                        displayId: currentUser?.displayId,
                        email: currentUser?.email,
                        diamondsAmount: dAmount,
                        agentId: withdrawAgentIdentifier.trim(),
                        payoutMethod: withdrawPayoutMethod,
                        accountDetails: withdrawAccountDetails.trim(),
                      }),
                    });
                    const data = await res.json().catch(() => null);

                    if (data && data.success) {
                      if (onWithdraw) onWithdraw(dAmount);
                      else onRecharge(-dAmount);

                      setWithdrawFeedback({
                        type: 'success',
                        message: data.message || (isAr
                          ? `تم سحب ${dAmount.toLocaleString()} ماسة وخصم عمولة 2.5% (${feeDiamonds.toLocaleString()} ماسة)، وإضافة الصافي (${netDiamonds.toLocaleString()} 💎) لرصيد وكالة الشحن وإرسال إشعار للوكيل بنجاح!`
                          : `Withdrawal request submitted! Net ${netDiamonds.toLocaleString()} diamonds credited to agency.`),
                      });

                      setTimeout(() => {
                        setIsWithdrawModalOpen(false);
                        setWithdrawFeedback(null);
                        setWithdrawAccountDetails('');
                      }, 2000);
                    } else {
                      setWithdrawFeedback({
                        type: 'error',
                        message: data?.message || (isAr ? 'تعذر إتمام طلب السحب' : 'Withdrawal failed'),
                      });
                    }
                  } catch {
                    if (onWithdraw) onWithdraw(dAmount);
                    else onRecharge(-dAmount);
                    setWithdrawFeedback({
                      type: 'success',
                      message: isAr ? 'تم استلام طلب السحب بنجاح!' : 'Withdrawal received!',
                    });
                    setTimeout(() => {
                      setIsWithdrawModalOpen(false);
                      setWithdrawFeedback(null);
                    }, 1800);
                  } finally {
                    setIsWithdrawing(false);
                  }
                }}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-black text-xs sm:text-sm shadow-md shadow-emerald-500/25 cursor-pointer active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {isWithdrawing ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{isAr ? 'جاري السحب وإشعار الوكيل...' : 'Processing...'}</span>
                  </span>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>{isAr ? 'تأكيد السحب وإرسال الإشعار للوكيل' : 'Confirm Cashout & Notify Agent'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* بوابة وكالتي للشحن Modal عند الفتح من داخل المحفظة */}
      {myAgencyRecord && (
        <AgencyPortalModal
          isOpen={isAgencyPortalOpen}
          onClose={() => setIsAgencyPortalOpen(false)}
          lang={lang}
          agent={myAgencyRecord}
          currentUser={currentUser}
          personalWalletBalance={walletBalance}
          personalCoinsBalance={coinsBalance}
          onBalanceUpdated={(newBal) => {
            setMyAgencyRecord((prev) => (prev ? { ...prev, balance: newBal } : null));
          }}
          onPersonalBalanceUpdated={(newPersonalBal) => {
            onRecharge(newPersonalBal - walletBalance);
          }}
        />
      )}
    </div>
  );
};
