import React, { useState, useEffect } from 'react';
import {
  Building2,
  X,
  Sparkles,
  Wallet,
  Send,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  Search,
  UserCheck,
  Loader2,
  DollarSign,
  TrendingUp,
  Receipt,
  ShieldCheck,
  CreditCard,
  History,
  Coins,
  ChevronLeft,
  ChevronRight,
  User,
} from 'lucide-react';
import { Language, AgentRecord, AgencyWithdrawalRequest, AgencyRechargeTransaction, AuthUser } from '../types';

interface AgencyPortalModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  agent: AgentRecord;
  onBalanceUpdated?: (newBalance: number) => void;
  currentUser?: AuthUser | null;
  personalWalletBalance?: number;
  personalCoinsBalance?: number;
  onPersonalBalanceUpdated?: (newBalance: number) => void;
}

const QUICK_AMOUNTS = [500, 1000, 2500, 5000, 10000, 25000];

const WITHDRAW_METHODS = [
  { id: 'usdt_trc20', nameAr: 'USDT (TRC20)', nameEn: 'USDT (TRC20)', icon: '💎' },
  { id: 'stc_pay', nameAr: 'STC Pay / Urpay', nameEn: 'STC Pay / Urpay', icon: '🇸🇦' },
  { id: 'bank_transfer', nameAr: 'تحويل بنكي مباشر (IBAN)', nameEn: 'Bank Wire (IBAN)', icon: '🏦' },
  { id: 'instapay', nameAr: 'انستاباي InstaPay (مصر)', nameEn: 'InstaPay (Egypt)', icon: '🇪🇬' },
  { id: 'vodafone_cash', nameAr: 'فودافون كاش / محافظ إلكترونية', nameEn: 'Vodafone Cash / E-Wallets', icon: '📱' },
  { id: 'zain_cash', nameAr: 'زين كاش / آسيا حوالة (العراق)', nameEn: 'ZainCash / AsiaHawala', icon: '🇮🇶' },
  { id: 'binance_pay', nameAr: 'Binance Pay ID', nameEn: 'Binance Pay ID', icon: '🟡' },
];

export const AgencyPortalModal: React.FC<AgencyPortalModalProps> = ({
  isOpen,
  onClose,
  lang,
  agent: initialAgent,
  onBalanceUpdated,
  currentUser,
  personalWalletBalance = 0,
  personalCoinsBalance = 0,
  onPersonalBalanceUpdated,
}) => {
  const isAr = lang === 'ar';

  const [agent, setAgent] = useState<AgentRecord>(initialAgent);
  const [activeTab, setActiveTab] = useState<'recharge' | 'withdraw' | 'history'>('recharge');

  // رصيد الحساب الشخصي للوكيل (منفصل تماماً عن رصيد الوكالة)
  const [personalDiamonds, setPersonalDiamonds] = useState<number>(() => {
    if (typeof personalWalletBalance === 'number') return personalWalletBalance;
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('soulx_wallet_balance');
      if (saved) return parseInt(saved, 10) || 0;
    }
    return 0;
  });

  const [personalCoins, setPersonalCoins] = useState<number>(() => {
    if (typeof personalCoinsBalance === 'number') return personalCoinsBalance;
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('soulx_coins_balance');
      if (saved) return parseInt(saved, 10) || 0;
    }
    return 0;
  });

  useEffect(() => {
    if (typeof personalWalletBalance === 'number') {
      setPersonalDiamonds(personalWalletBalance);
    }
  }, [personalWalletBalance]);

  useEffect(() => {
    if (typeof personalCoinsBalance === 'number') {
      setPersonalCoins(personalCoinsBalance);
    }
  }, [personalCoinsBalance]);

  // Copied Grid Code feedback
  const [copiedGrid, setCopiedGrid] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Recharge user states
  const [targetUserIdInput, setTargetUserIdInput] = useState('');
  const [rechargeAmount, setRechargeAmount] = useState<number>(1000);
  const [customAmount, setCustomAmount] = useState<string>('1000');
  const [isLookingUpUser, setIsLookingUpUser] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [verifiedUser, setVerifiedUser] = useState<{
    id: string;
    displayId: string;
    name: string;
    photoUrl: string | null;
    walletBalance: number;
    gender?: string | null;
  } | null>(null);
  const [isSubmittingRecharge, setIsSubmittingRecharge] = useState(false);
  const [rechargeReceipt, setRechargeReceipt] = useState<{
    txId: string;
    targetName: string;
    targetDisplayId: string;
    amount: number;
    newTargetBalance: number;
    remainingAgentBalance: number;
    timestamp: string;
  } | null>(null);

  // Withdraw requests states
  const [withdrawRequests, setWithdrawRequests] = useState<AgencyWithdrawalRequest[]>([]);
  const [isLoadingWithdraws, setIsLoadingWithdraws] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState<string>('5000');
  const [selectedMethod, setSelectedMethod] = useState<string>('USDT (TRC20)');
  const [accountDetails, setAccountDetails] = useState('');
  const [withdrawNotes, setWithdrawNotes] = useState('');
  const [isSubmittingWithdraw, setIsSubmittingWithdraw] = useState(false);
  const [withdrawSuccessMsg, setWithdrawSuccessMsg] = useState<string | null>(null);

  // Recharge transactions history
  const [transactions, setTransactions] = useState<AgencyRechargeTransaction[]>([]);
  const [isLoadingTx, setIsLoadingTx] = useState(false);

  // Sync initial agent prop
  useEffect(() => {
    setAgent(initialAgent);
  }, [initialAgent]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCopyGridCode = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const code = agent.gridCode || 'A8838';
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(code);
      setCopiedGrid(true);
      showToast(isAr ? `تم نسخ رقم القريد [${code}]!` : `Copied Grid Code [${code}]!`);
      setTimeout(() => setCopiedGrid(false), 2000);
    }
  };

  // Fetch updated agent details and personal user details
  const refreshAgencyData = async () => {
    try {
      const emailParam = encodeURIComponent(agent.email);
      const uidParam = encodeURIComponent(currentUser?.id || agent.id);
      const dispParam = encodeURIComponent(currentUser?.displayId || '');
      const res = await fetch(`/api/agent/my-agency?email=${emailParam}&userId=${uidParam}&displayId=${dispParam}`);
      const data = await res.json();
      if (data.success && data.agent) {
        setAgent(data.agent);
        if (onBalanceUpdated) {
          onBalanceUpdated(data.agent.balance);
        }
      }
      if (data.personalAccount) {
        if (typeof data.personalAccount.walletBalance === 'number') {
          setPersonalDiamonds(data.personalAccount.walletBalance);
          if (onPersonalBalanceUpdated) {
            onPersonalBalanceUpdated(data.personalAccount.walletBalance);
          }
        }
        if (typeof data.personalAccount.coinsBalance === 'number') {
          setPersonalCoins(data.personalAccount.coinsBalance);
        }
      }
    } catch {}
  };

  // Fetch withdrawal requests
  const fetchWithdrawRequests = async () => {
    setIsLoadingWithdraws(true);
    try {
      const res = await fetch(`/api/agent/withdraw-requests?agentId=${encodeURIComponent(agent.id)}&gridCode=${encodeURIComponent(agent.gridCode || '')}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.requests)) {
        setWithdrawRequests(data.requests);
      }
    } catch {} finally {
      setIsLoadingWithdraws(false);
    }
  };

  // Fetch recharge history
  const fetchTransactions = async () => {
    setIsLoadingTx(true);
    try {
      const res = await fetch(`/api/agent/transactions?agentId=${encodeURIComponent(agent.id)}&gridCode=${encodeURIComponent(agent.gridCode || '')}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.transactions)) {
        setTransactions(data.transactions);
      }
    } catch {} finally {
      setIsLoadingTx(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshAgencyData();
      fetchWithdrawRequests();
      fetchTransactions();
    }
  }, [isOpen]);

  // Lookup target user by Account ID
  const handleLookupUser = async (e?: React.FormEvent, overrideId?: string) => {
    if (e) e.preventDefault();
    const cleanId = (overrideId || targetUserIdInput).trim();
    if (!cleanId) return;

    setIsLookingUpUser(true);
    setLookupError(null);
    setVerifiedUser(null);

    try {
      const res = await fetch('/api/agent/lookup-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIdentifier: cleanId }),
      });
      const data = await res.json();

      if (data.success && data.user) {
        setVerifiedUser(data.user);
      } else {
        setLookupError(data.message || (isAr ? 'لم يتم العثور على المستخدم' : 'User not found'));
      }
    } catch {
      setLookupError(isAr ? 'حدث خطأ أثناء فحص الحساب' : 'Error checking user account');
    } finally {
      setIsLookingUpUser(false);
    }
  };

  // زر سريع لشحن الحساب الشخصي للوكيل من رصيد وكالته
  const handleQuickFillMyAccount = () => {
    const myId = currentUser?.displayId || currentUser?.id;
    if (!myId) return;
    setTargetUserIdInput(myId);
    handleLookupUser(undefined, myId);
  };

  // Submit Recharge to User
  const handleExecuteRecharge = async () => {
    if (!verifiedUser) return;
    const amountToTransfer = parseInt(customAmount, 10) || rechargeAmount;

    if (amountToTransfer <= 0) {
      showToast(isAr ? 'يرجى إدخال قيمة شحن صالحة' : 'Invalid recharge amount');
      return;
    }

    if (agent.balance < amountToTransfer) {
      showToast(isAr ? 'رصيد الوكالة غير كافٍ!' : 'Insufficient agency balance!');
      return;
    }

    setIsSubmittingRecharge(true);

    try {
      const res = await fetch('/api/agent/recharge-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: agent.id,
          agentEmail: agent.email,
          targetUserIdentifier: verifiedUser.displayId || verifiedUser.id,
          amount: amountToTransfer,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setAgent((prev) => ({
          ...prev,
          balance: data.newAgentBalance,
        }));
        if (onBalanceUpdated) {
          onBalanceUpdated(data.newAgentBalance);
        }

        const isRechargingSelf =
          (currentUser?.id && (verifiedUser.id === currentUser.id || verifiedUser.displayId === currentUser.id)) ||
          (currentUser?.displayId && (verifiedUser.displayId === currentUser.displayId || verifiedUser.id === currentUser.displayId));

        if (isRechargingSelf) {
          const newSelfBal = data.targetUser?.walletBalance || (personalDiamonds + amountToTransfer);
          setPersonalDiamonds(newSelfBal);
          if (typeof window !== 'undefined') {
            localStorage.setItem('soulx_wallet_balance', String(newSelfBal));
            window.dispatchEvent(
              new CustomEvent('soulx:balance-updated', {
                detail: {
                  currency: 'diamonds',
                  balance: newSelfBal,
                  userId: currentUser?.id,
                  displayId: currentUser?.displayId,
                },
              })
            );
          }
          if (onPersonalBalanceUpdated) {
            onPersonalBalanceUpdated(newSelfBal);
          }
        }

        setRechargeReceipt({
          txId: data.transaction?.id || `TX-${Date.now()}`,
          targetName: verifiedUser.name,
          targetDisplayId: verifiedUser.displayId,
          amount: amountToTransfer,
          newTargetBalance: data.targetUser?.walletBalance || (verifiedUser.walletBalance + amountToTransfer),
          remainingAgentBalance: data.newAgentBalance,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });

        // Add to local transactions
        if (data.transaction) {
          setTransactions((prev) => [data.transaction, ...prev]);
        }

        if (isRechargingSelf) {
          showToast(isAr ? `تم شحن ${amountToTransfer.toLocaleString()} 💎 لحسابك الشخصي بنجاح! تم تحديث الرصيدين بشكل منفصل.` : `Recharged ${amountToTransfer} to personal account!`);
        } else {
          showToast(isAr ? `تم شحن ${amountToTransfer.toLocaleString()} 💎 بنجاح للمستخدم! ✨` : `Successfully recharged ${amountToTransfer} Diamonds!`);
        }
      } else {
        showToast(data.message || (isAr ? 'تعذر إتمام الشحن' : 'Recharge failed'));
      }
    } catch {
      showToast(isAr ? 'حدث خطأ في الاتصال' : 'Connection error');
    } finally {
      setIsSubmittingRecharge(false);
    }
  };

  // Submit New Withdrawal Request
  const handleSubmitWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = parseInt(withdrawAmount, 10);

    if (!amountVal || amountVal <= 0) {
      showToast(isAr ? 'أدخل مبلغ سحب صالح' : 'Enter valid withdrawal amount');
      return;
    }

    if (agent.balance < amountVal) {
      showToast(isAr ? 'رصيد الوكالة غير كافٍ لهذا المبلغ' : 'Insufficient agency balance');
      return;
    }

    if (!accountDetails.trim()) {
      showToast(isAr ? 'يرجى كتابة بيانات الحساب أو المحفظة' : 'Please provide account details');
      return;
    }

    setIsSubmittingWithdraw(true);
    setWithdrawSuccessMsg(null);

    try {
      const res = await fetch('/api/agent/withdraw-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: agent.id,
          amount: amountVal,
          method: selectedMethod,
          accountDetails: accountDetails.trim(),
          notes: withdrawNotes.trim(),
        }),
      });

      const data = await res.json();

      if (data.success && data.request) {
        setWithdrawRequests((prev) => [data.request, ...prev]);
        if (typeof data.newAgentBalance === 'number') {
          setAgent((prev) => ({ ...prev, balance: data.newAgentBalance }));
          if (onBalanceUpdated) onBalanceUpdated(data.newAgentBalance);
        }
        setWithdrawSuccessMsg(isAr ? 'تم إرسال طلب السحب بنجاح للإدارة وجارٍ تدقيقه.' : 'Withdrawal request submitted successfully.');
        setAccountDetails('');
        setWithdrawNotes('');
        showToast(isAr ? 'تم تقديم طلب السحب بنجاح! ✨' : 'Withdrawal request submitted!');
      } else {
        showToast(data.message || (isAr ? 'تعذر تقديم طلب السحب' : 'Failed to submit request'));
      }
    } catch {
      showToast(isAr ? 'حدث خطأ في الاتصال' : 'Connection error');
    } finally {
      setIsSubmittingWithdraw(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-neutral-950/85 backdrop-blur-md animate-in fade-in duration-200">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-60 px-4 py-2.5 rounded-2xl bg-cyan-400 text-neutral-950 font-bold text-xs sm:text-sm shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl shadow-2xl overflow-hidden">
        {/* ========================================================
            MODAL HEADER BAR
            ======================================================== */}
        <div className="px-5 sm:px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/70 dark:bg-neutral-950/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-cyan-500 to-emerald-400 text-neutral-950 flex items-center justify-center font-bold shadow-md">
              <Building2 className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-neutral-900 dark:text-white">
                  {isAr ? 'وكالتي للشحن' : 'My Recharge Agency'}
                </h2>
                {/* شارة رقم القريد (Grid ID) */}
                <button
                  type="button"
                  onClick={handleCopyGridCode}
                  title={isAr ? 'اضغط لنسخ رقم القريد' : 'Click to copy Grid ID'}
                  className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 text-[11px] font-mono font-bold flex items-center gap-1 transition-all cursor-pointer group"
                >
                  <Sparkles className="w-3 h-3 text-cyan-500" />
                  <span>{isAr ? 'قريد:' : 'GRID:'} {agent.gridCode || 'A8838'}</span>
                  {copiedGrid ? (
                    <Check className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <Copy className="w-3 h-3 text-cyan-500/60 group-hover:text-cyan-500" />
                  )}
                </button>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5 mt-0.5">
                <span>{agent.flag}</span>
                <span>{agent.name}</span>
                <span>•</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{isAr ? 'معتمد رسمياً' : 'Certified'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={refreshAgencyData}
              title={isAr ? 'تحديث رصيد الوكالة' : 'Refresh Agency Balance'}
              className="p-2 rounded-xl text-neutral-400 hover:text-cyan-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ========================================================
            MODAL BODY (SCROLLABLE)
            ======================================================== */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* 1. SEPARATE BALANCES DASHBOARD (رصيد الوكالة للشحن والسحب VS رصيد الحساب الشخصي) */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Card A: رصيد الوكالة للشحن والسحب */}
              <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-neutral-900 via-neutral-950 to-neutral-900 text-white border-2 border-cyan-500/40 shadow-xl relative overflow-hidden flex flex-col justify-between">
                <div className="absolute top-0 right-0 w-36 h-36 bg-cyan-500/15 rounded-full blur-2xl pointer-events-none" />
                <div className="relative z-10 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-cyan-400">
                      <Building2 className="w-4 h-4 text-cyan-400" />
                      <span>{isAr ? 'رصيد الوكالة (للشحن والسحب)' : 'Agency Balance'}</span>
                    </div>
                    {/* Grid ID badge */}
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-[10px] font-mono text-cyan-300 font-bold">
                      <span>{isAr ? 'قريد:' : 'GRID:'} {agent.gridCode || 'A8838'}</span>
                    </div>
                  </div>

                  <div className="text-3xl sm:text-4xl font-black text-cyan-400 font-mono tracking-tight flex items-baseline gap-2">
                    <span>{(agent.balance || 0).toLocaleString()}</span>
                    <span className="text-xs sm:text-sm font-sans font-bold text-neutral-300">💎 {isAr ? 'ماسة' : 'Diamonds'}</span>
                  </div>

                  <p className="text-[11px] text-neutral-400 leading-tight">
                    {isAr
                      ? 'مخصص حصرياً لعمليات شحن رصيد المستخدمين وتنفيذ طلبات السحب.'
                      : 'Dedicated exclusively for servicing user top-ups and cashouts.'}
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-neutral-800 flex items-center justify-between text-[11px] text-neutral-400 font-mono">
                  <span>{isAr ? 'قيمة تقريبية:' : 'Approx:'}</span>
                  <span className="text-cyan-300 font-bold">${(((agent.balance || 0) * 0.01)).toLocaleString()} USDT</span>
                </div>
              </div>

              {/* Card B: رصيد الحساب الشخصي للوكيل (منفصل تماماً) */}
              <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-neutral-900 via-neutral-950 to-amber-950/40 text-white border-2 border-amber-500/30 shadow-xl relative overflow-hidden flex flex-col justify-between">
                <div className="absolute top-0 right-0 w-36 h-36 bg-amber-500/15 rounded-full blur-2xl pointer-events-none" />
                <div className="relative z-10 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                      <User className="w-4 h-4 text-amber-400" />
                      <span>{isAr ? 'رصيد حسابك الشخصي (منفصل)' : 'Personal Account Balance'}</span>
                    </div>
                    {/* User display ID badge */}
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-[10px] font-mono text-amber-300 font-bold">
                      ID: {currentUser?.displayId || currentUser?.id || 'حسابك'}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight flex items-baseline gap-2 flex-wrap">
                      <span>{personalDiamonds.toLocaleString()}</span>
                      <span className="text-xs sm:text-sm font-sans font-bold text-cyan-400">💎</span>
                      <span className="text-neutral-500 text-sm font-sans">•</span>
                      <span className="text-xl sm:text-2xl text-amber-400">{personalCoins.toLocaleString()}</span>
                      <span className="text-xs font-sans text-amber-300">🪙</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-neutral-400 leading-tight">
                    {isAr
                      ? 'رصيدك الخاص داخل التطبيق: إرسال الهدايا، المحادثات، والتفاعل الشخصي.'
                      : 'Your personal balance for gifts, tipping, and private chats.'}
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-neutral-800 flex items-center justify-between text-[11px]">
                  <span className="text-neutral-400">{isAr ? 'الحالة المالية:' : 'Status:'}</span>
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{isAr ? 'حساب شخصي مستقل ومفصول' : 'Isolated Personal Account'}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* شريط تأكيد الفصل المالي التام بين الرصيدين */}
            <div className="p-3 rounded-2xl bg-cyan-500/10 dark:bg-cyan-950/30 border border-cyan-500/30 flex items-center gap-2.5 text-xs text-neutral-800 dark:text-cyan-200">
              <ShieldCheck className="w-5 h-5 text-cyan-500 shrink-0" />
              <div className="leading-relaxed">
                <span className="font-bold text-cyan-600 dark:text-cyan-300">
                  {isAr ? 'نظام الفصل المالي: ' : 'Financial Separation: '}
                </span>
                <span>
                  {isAr
                    ? 'رصيد وكالتك المعتمدة للشحن والسحب منفصل تماماً عن رصيد حسابك الشخصي. أي عملية شحن أو سحب للمستخدمين تتم من رصيد الوكالة فقط دون التأثير على رصيدك الشخصي.'
                    : 'Agency balance is strictly isolated from your personal balance. Operations only affect the agency balance.'}
                </span>
              </div>
            </div>
          </div>

          {/* 2. THREE NAVIGATION TABS */}
          <div className="grid grid-cols-3 p-1 rounded-2xl bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700/60 shadow-xs">
            {/* Tab 1: شحن رصيد مستخدم */}
            <button
              type="button"
              onClick={() => setActiveTab('recharge')}
              className={`py-2.5 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'recharge'
                  ? 'bg-cyan-400 text-neutral-950 shadow-sm font-black'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isAr ? 'شحن لمستخدم' : 'Recharge User'}</span>
            </button>

            {/* Tab 2: طلبات السحب */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('withdraw');
                fetchWithdrawRequests();
              }}
              className={`py-2.5 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'withdraw'
                  ? 'bg-cyan-400 text-neutral-950 shadow-sm font-black'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>{isAr ? 'طلبات السحب' : 'Withdrawals'}</span>
              {withdrawRequests.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-neutral-950/20 font-mono font-bold">
                  {withdrawRequests.length}
                </span>
              )}
            </button>

            {/* Tab 3: سجل العمليات */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('history');
                fetchTransactions();
              }}
              className={`py-2.5 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'history'
                  ? 'bg-cyan-400 text-neutral-950 shadow-sm font-black'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>{isAr ? 'سجل العمليات' : 'History'}</span>
            </button>
          </div>

          {/* ========================================================
              TAB 1 CONTENT: شحن رصيد لمستخدم من خلال ID الحساب
              ======================================================== */}
          {activeTab === 'recharge' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Receipt Modal Overlay if just completed */}
              {rechargeReceipt && (
                <div className="p-5 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 text-neutral-900 dark:text-white space-y-3 animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-black text-sm">
                      <CheckCircle2 className="w-5 h-5" />
                      <span>{isAr ? 'تم شحن الرصيد بنجاح!' : 'Recharge Completed!'}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRechargeReceipt(null)}
                      className="p-1 rounded-lg text-neutral-400 hover:text-neutral-900 dark:hover:text-white cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-white dark:bg-neutral-950/60 p-3.5 rounded-2xl border border-emerald-500/20">
                    <div>
                      <span className="text-neutral-400 block text-[11px]">{isAr ? 'المستلم' : 'Recipient'}</span>
                      <span className="font-bold">{rechargeReceipt.targetName}</span>
                    </div>
                    <div>
                      <span className="text-neutral-400 block text-[11px]">{isAr ? 'معرف الحساب' : 'Account ID'}</span>
                      <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">{rechargeReceipt.targetDisplayId}</span>
                    </div>
                    <div>
                      <span className="text-neutral-400 block text-[11px]">{isAr ? 'المبلغ المشحون' : 'Amount'}</span>
                      <span className="font-black font-mono text-emerald-600 dark:text-emerald-400">+{rechargeReceipt.amount.toLocaleString()} 💎</span>
                    </div>
                    <div>
                      <span className="text-neutral-400 block text-[11px]">{isAr ? 'رقم الإيصال' : 'TxID'}</span>
                      <span className="font-mono text-neutral-500 text-[10px]">{rechargeReceipt.txId}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setRechargeReceipt(null);
                      setVerifiedUser(null);
                      setTargetUserIdInput('');
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-bold text-xs cursor-pointer transition-colors shadow-xs"
                  >
                    {isAr ? 'إجراء عملية شحن جديدة' : 'New Recharge Operation'}
                  </button>
                </div>
              )}

              {/* Step 1: Input Account ID */}
              <div className="p-5 rounded-3xl bg-neutral-50 dark:bg-neutral-950/50 border border-neutral-200 dark:border-neutral-800 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300">
                    {isAr ? '1. أدخل معرّف حساب المستخدم (Account ID)' : '1. Enter User Account ID'}
                  </label>
                  {currentUser && (
                    <button
                      type="button"
                      onClick={handleQuickFillMyAccount}
                      className="px-2.5 py-1 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                    >
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      <span>{isAr ? '⚡ شحن حسابي الشخصي من الوكالة' : '⚡ Recharge My Account'}</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-neutral-400 absolute right-3.5 top-1/2 -translate-y-1/2 rtl:right-3.5 rtl:left-auto ltr:left-3.5 ltr:right-auto pointer-events-none" />
                    <input
                      type="text"
                      value={targetUserIdInput}
                      onChange={(e) => {
                        setTargetUserIdInput(e.target.value);
                        setLookupError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleLookupUser();
                        }
                      }}
                      placeholder={isAr ? 'مثال: S-0101V77-X711 أو المعرف الرقمي...' : 'e.g. S-0101V77-X711 or ID...'}
                      className="w-full h-11 pr-10 pl-3.5 rtl:pr-10 rtl:pl-3.5 ltr:pl-10 ltr:pr-3.5 text-xs sm:text-sm font-mono rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:border-cyan-500 shadow-inner"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleLookupUser()}
                    disabled={isLookingUpUser || !targetUserIdInput.trim()}
                    className="h-11 px-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-neutral-950 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-xs"
                  >
                    {isLookingUpUser ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <UserCheck className="w-4 h-4" />
                    )}
                    <span>{isAr ? 'فحص الحساب' : 'Verify'}</span>
                  </button>
                </div>

                {lookupError && (
                  <p className="text-xs text-rose-500 font-medium flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{lookupError}</span>
                  </p>
                )}

                {/* Verified Target User Card Preview */}
                {verifiedUser && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                    <div className="p-3.5 rounded-2xl bg-white dark:bg-neutral-900 border-2 border-emerald-500/40 flex items-center justify-between gap-3 shadow-sm">
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={verifiedUser.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'}
                          alt={verifiedUser.name}
                          className="w-11 h-11 rounded-xl object-cover border border-neutral-200 dark:border-neutral-700 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-sm font-bold text-neutral-900 dark:text-white truncate">
                              {verifiedUser.name}
                            </h4>
                            <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold">
                              ✓ {isAr ? 'حساب مطابق' : 'Verified'}
                            </span>
                          </div>
                          <p className="text-xs font-mono text-cyan-600 dark:text-cyan-400 font-bold truncate">
                            ID: {verifiedUser.displayId}
                          </p>
                        </div>
                      </div>

                      <div className="text-end shrink-0">
                        <span className="text-[10px] text-neutral-400 block">{isAr ? 'رصيده الحالي' : 'Current Balance'}</span>
                        <span className="text-xs font-mono font-bold text-neutral-700 dark:text-neutral-300">
                          {verifiedUser.walletBalance?.toLocaleString()} 💎
                        </span>
                      </div>
                    </div>

                    {/* Notice if the verified user is the agent themselves */}
                    {((currentUser?.id && (verifiedUser.id === currentUser.id || verifiedUser.displayId === currentUser.id)) ||
                      (currentUser?.displayId && (verifiedUser.displayId === currentUser.displayId || verifiedUser.id === currentUser.displayId))) && (
                      <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-700 dark:text-amber-300 font-semibold flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                        <span>
                          {isAr
                            ? 'أنت تقوم الآن بنقل رصيد من وكالتك إلى حسابك الشخصي المنفصل: سيتم خصم المبلغ من رصيد الوكالة وإضافته فوراً إلى رصيد حسابك الشخصي في المحفظة.'
                            : 'You are transferring diamonds from your agency to your separate personal wallet.'}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Step 2: Choose Recharge Amount */}
              <div className="p-5 rounded-3xl bg-neutral-50 dark:bg-neutral-950/50 border border-neutral-200 dark:border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                    {isAr ? '2. حدد عدد الماسات المراد شحنها' : '2. Select Recharge Diamond Amount'}
                  </label>
                  <span className="text-xs text-neutral-400 font-mono">
                    {isAr ? 'الرصيد المتبقي بعد الشحن:' : 'Remaining:'}{' '}
                    <span className="font-bold text-cyan-600 dark:text-cyan-400">
                      {Math.max(0, (agent.balance || 0) - (parseInt(customAmount, 10) || 0)).toLocaleString()} 💎
                    </span>
                  </span>
                </div>

                {/* Quick Presets */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {QUICK_AMOUNTS.map((amt) => {
                    const isSelected = (parseInt(customAmount, 10) || rechargeAmount) === amt;
                    return (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => {
                          setRechargeAmount(amt);
                          setCustomAmount(amt.toString());
                        }}
                        className={`py-2 px-1 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer border ${
                          isSelected
                            ? 'bg-cyan-400 text-neutral-950 border-cyan-400 shadow-sm scale-102'
                            : 'bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:border-cyan-500/50'
                        }`}
                      >
                        {amt.toLocaleString()}
                      </button>
                    );
                  })}
                </div>

                {/* Custom Amount Input */}
                <div className="relative">
                  <input
                    type="number"
                    min="10"
                    max={agent.balance || 200000}
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    placeholder={isAr ? 'أو اكتب قيمة مخصصة...' : 'Or enter custom amount...'}
                    className="w-full h-11 px-4 text-xs sm:text-sm font-mono font-bold rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:border-cyan-500 shadow-inner"
                  />
                  <span className="absolute left-3 rtl:left-3 rtl:right-auto ltr:right-3 ltr:left-auto top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400">
                    💎 {isAr ? 'ماسة' : 'Diamonds'}
                  </span>
                </div>
              </div>

              {/* Step 3: Big Execution Button */}
              <button
                type="button"
                disabled={!verifiedUser || isSubmittingRecharge || (parseInt(customAmount, 10) || 0) <= 0 || (agent.balance || 0) < (parseInt(customAmount, 10) || 0)}
                onClick={handleExecuteRecharge}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-cyan-400 via-cyan-300 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 disabled:opacity-50 text-neutral-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg transition-all active:scale-98 cursor-pointer"
              >
                {isSubmittingRecharge ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{isAr ? 'جاري شحن الرصيد للمستخدم...' : 'Processing User Recharge...'}</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 stroke-[2.5]" />
                    <span>
                      {isAr
                        ? `تأكيد شحن ${(parseInt(customAmount, 10) || 0).toLocaleString()} 💎 لحساب (${verifiedUser?.displayId || '—'})`
                        : `Confirm Recharge ${(parseInt(customAmount, 10) || 0).toLocaleString()} 💎 to (${verifiedUser?.displayId || '—'})`}
                    </span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* ========================================================
              TAB 2 CONTENT: تبويب طلبات السحب
              ======================================================== */}
          {activeTab === 'withdraw' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              {/* Form to submit withdrawal */}
              <form onSubmit={handleSubmitWithdrawal} className="p-5 rounded-3xl bg-neutral-50 dark:bg-neutral-950/50 border border-neutral-200 dark:border-neutral-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-neutral-900 dark:text-white flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-cyan-500" />
                    <span>{isAr ? 'طلب سحب رصيد وكالة جديد' : 'New Agency Withdrawal Request'}</span>
                  </h3>
                  <span className="text-[11px] text-neutral-500">
                    {isAr ? 'الحد الأدنى: 500 ماسة' : 'Min: 500 Diamonds'}
                  </span>
                </div>

                {/* تنبيه الفصل المالي عند السحب */}
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 shrink-0 text-amber-500" />
                  <span>
                    {isAr
                      ? 'تنويه السحب: طلب السحب هذا مخصص لسحب أرباح الوكالة، ويتم خصم القيمة من رصيد الوكالة فقط دون المساس برصيد حسابك الشخصي.'
                      : 'Notice: This cashout request is deducted only from agency balance without touching your personal account balance.'}
                  </span>
                </div>

                {withdrawSuccessMsg && (
                  <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{withdrawSuccessMsg}</span>
                  </div>
                )}

                {/* Amount to withdraw */}
                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    {isAr ? 'مبلغ السحب (ماسات)' : 'Withdrawal Amount (Diamonds)'}
                  </label>
                  <input
                    type="number"
                    min="500"
                    max={agent.balance || 200000}
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="5000"
                    className="w-full h-11 px-4 text-xs sm:text-sm font-mono font-bold rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:border-cyan-500"
                  />
                  <span className="text-[11px] text-neutral-400 mt-1 block">
                    {isAr
                      ? `القيمة التقديرية بالدولار: $${(((parseInt(withdrawAmount, 10) || 0) / 400000) * 10).toFixed(2)} USD (كل 10$ = 400,000 ماسة)`
                      : `Approx value: $${(((parseInt(withdrawAmount, 10) || 0) / 400000) * 10).toFixed(2)} USD ($10 = 400,000 Diamonds)`}
                  </span>
                </div>

                {/* Method selector */}
                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
                    {isAr ? 'طريقة الاستلام والسحب' : 'Payment Method'}
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {WITHDRAW_METHODS.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSelectedMethod(m.nameAr)}
                        className={`p-2 rounded-xl text-xs font-medium transition-all cursor-pointer border text-start flex items-center gap-1.5 ${
                          selectedMethod === m.nameAr
                            ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/50 font-bold shadow-xs'
                            : 'bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700/60'
                        }`}
                      >
                        <span className="text-sm">{m.icon}</span>
                        <span className="truncate">{isAr ? m.nameAr : m.nameEn}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Account details */}
                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    {isAr ? 'بيانات المحفظة / الحساب البنكي' : 'Wallet / Account Details'}
                  </label>
                  <input
                    type="text"
                    required
                    value={accountDetails}
                    onChange={(e) => setAccountDetails(e.target.value)}
                    placeholder={isAr ? 'مثال: عنوان TRC20 أو رقم الآيبان IBAN أو رقم الجوال...' : 'e.g. TRC20 address, IBAN, or Mobile...'}
                    className="w-full h-11 px-4 text-xs sm:text-sm rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    {isAr ? 'ملاحظات إضافية أو رقم للتواصل (اختياري)' : 'Additional Notes / Phone (Optional)'}
                  </label>
                  <input
                    type="text"
                    value={withdrawNotes}
                    onChange={(e) => setWithdrawNotes(e.target.value)}
                    placeholder={isAr ? 'رقم واتساب للمتابعة أو اسم المستلم...' : 'Contact phone or beneficiary name...'}
                    className="w-full h-10 px-4 text-xs rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingWithdraw || !accountDetails.trim() || (parseInt(withdrawAmount, 10) || 0) <= 0 || (agent.balance || 0) < (parseInt(withdrawAmount, 10) || 0)}
                  className="w-full py-3 px-5 rounded-2xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-neutral-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm"
                >
                  {isSubmittingWithdraw ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>{isAr ? 'إرسال طلب السحب للإدارة' : 'Submit Withdrawal to Admin'}</span>
                </button>
              </form>

              {/* List of past withdrawal requests */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-neutral-600 dark:text-neutral-400 px-1">
                  <span>{isAr ? 'طلبات السحب السابقة للوكالة' : 'Previous Withdrawal Requests'}</span>
                  <span className="font-mono">{withdrawRequests.length} {isAr ? 'طلب' : 'requests'}</span>
                </div>

                {isLoadingWithdraws ? (
                  <div className="py-8 text-center text-xs text-neutral-400 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-cyan-500" />
                    <span>{isAr ? 'جاري جلب طلبات السحب...' : 'Loading requests...'}</span>
                  </div>
                ) : withdrawRequests.length === 0 ? (
                  <div className="py-10 text-center space-y-2 rounded-2xl bg-neutral-50 dark:bg-neutral-950/40 border border-neutral-200 dark:border-neutral-800 p-6">
                    <CreditCard className="w-7 h-7 text-neutral-400 mx-auto" />
                    <p className="text-xs text-neutral-500 font-medium">
                      {isAr ? 'لا توجد طلبات سحب مسجلة لهذه الوكالة بعد' : 'No withdrawal requests yet'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {withdrawRequests.map((req) => {
                      const isUserWithdrawal = req.type === 'incoming_user_withdrawal' || Boolean(req.userName);
                      const grossAmount = req.amount;
                      const feeAmt = req.fee || Math.round(grossAmount * 0.025);
                      const netCredited = req.netCredited || (grossAmount - feeAmt);

                      return (
                        <div
                          key={req.id}
                          className={`p-4 rounded-2xl border shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            isUserWithdrawal
                              ? 'bg-emerald-500/5 dark:bg-emerald-950/20 border-emerald-500/30'
                              : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800'
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {isUserWithdrawal ? (
                                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] flex items-center gap-1">
                                  <span>📥</span>
                                  <span>{isAr ? 'سحب مستخدم عبر وكالتك' : 'User Cashout via Agency'}</span>
                                </span>
                              ) : null}

                              <span className="font-mono font-bold text-sm text-neutral-900 dark:text-white">
                                {grossAmount.toLocaleString()} 💎
                              </span>
                              <span className="text-xs text-neutral-500 font-mono">
                                (≈ ${((grossAmount / 400000) * 10).toFixed(2)} USD)
                              </span>
                              <span className="text-[10px] px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-medium">
                                {req.method}
                              </span>
                            </div>

                            {isUserWithdrawal && (
                              <div className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-2 flex-wrap">
                                <span>{isAr ? 'العميل:' : 'User:'} <strong className="text-cyan-500">{req.userName}</strong> ({req.userDisplayId || req.userId})</span>
                                <span className="text-emerald-500 font-mono font-bold">
                                  {isAr ? `الصافي المضاف لرصيد وكالتك: +${netCredited.toLocaleString()} 💎` : `Net Credited: +${netCredited.toLocaleString()} 💎`}
                                </span>
                                <span className="text-rose-500 text-[11px] font-mono">
                                  {isAr ? `(خصم 2.5%: -${feeAmt.toLocaleString()} 💎)` : `(2.5% fee: -${feeAmt.toLocaleString()})`}
                                </span>
                              </div>
                            )}

                            <p className="text-xs font-mono text-neutral-600 dark:text-neutral-400 truncate max-w-md">
                              {req.accountDetails}
                            </p>
                            <span className="text-[10px] text-neutral-400 block font-mono">
                              {req.id} • {new Date(req.createdAt).toLocaleString()}
                            </span>
                          </div>

                          {/* Status Badge */}
                          <div className="shrink-0 self-start sm:self-center">
                            {isUserWithdrawal ? (
                              <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-500/30 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>{isAr ? 'أُضيف الصافي لرصيدك ✓' : 'Net Added to Balance ✓'}</span>
                              </span>
                            ) : req.status === 'completed' ? (
                              <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-500/20 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>{isAr ? 'تم التحويل ✓' : 'Completed ✓'}</span>
                              </span>
                            ) : req.status === 'rejected' ? (
                              <span className="px-3 py-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-bold border border-rose-500/20 flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5" />
                                <span>{isAr ? 'مرفوض' : 'Rejected'}</span>
                              </span>
                            ) : (
                              <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold border border-amber-500/20 flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 animate-pulse" />
                                <span>{isAr ? 'قيد المراجعة' : 'Pending Review'}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================
              TAB 3 CONTENT: سجل عمليات الشحن المنفذة
              ======================================================== */}
          {activeTab === 'history' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between text-xs font-bold text-neutral-600 dark:text-neutral-400 px-1">
                <span>{isAr ? 'سجل شحن رصيد المستخدمين' : 'User Top-Up Operations'}</span>
                <span className="font-mono">{transactions.length} {isAr ? 'عملية' : 'transactions'}</span>
              </div>

              {isLoadingTx ? (
                <div className="py-8 text-center text-xs text-neutral-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-cyan-500" />
                  <span>{isAr ? 'جاري تحميل السجل...' : 'Loading history...'}</span>
                </div>
              ) : transactions.length === 0 ? (
                <div className="py-12 text-center space-y-2 rounded-2xl bg-neutral-50 dark:bg-neutral-950/40 border border-neutral-200 dark:border-neutral-800 p-6">
                  <Receipt className="w-8 h-8 text-neutral-400 mx-auto" />
                  <p className="text-xs text-neutral-500 font-medium">
                    {isAr ? 'لم تنفذ هذه الوكالة أي عمليات شحن للمستخدمين بعد' : 'No recharge transactions recorded yet'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {transactions.map((tx) => {
                    const isUserWithdrawal = tx.type === 'user_withdrawal';

                    return (
                      <div
                        key={tx.id}
                        className={`p-4 rounded-2xl border shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isUserWithdrawal
                            ? 'bg-emerald-500/5 dark:bg-emerald-950/20 border-emerald-500/30'
                            : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800'
                        }`}
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {isUserWithdrawal ? (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] flex items-center gap-1">
                                <span>📥</span>
                                <span>{isAr ? 'سحب مستخدم عبر وكالتك (إيداع رصيد)' : 'User Cashout via Agency (Credit)'}</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 font-bold text-[10px] flex items-center gap-1">
                                <span>📤</span>
                                <span>{isAr ? 'شحن رصيد مستخدم' : 'User Top-Up'}</span>
                              </span>
                            )}

                            <h4 className="text-xs sm:text-sm font-bold text-neutral-900 dark:text-white truncate">
                              {tx.targetUserName}
                            </h4>
                            <span className="text-[10px] font-mono px-2 py-0.2 rounded-md bg-neutral-100 dark:bg-neutral-800 text-cyan-600 dark:text-cyan-400 font-bold">
                              {tx.targetUserDisplayId || tx.targetUserId}
                            </span>
                          </div>

                          {isUserWithdrawal && (
                            <div className="text-[11px] text-neutral-600 dark:text-neutral-300 font-mono flex items-center gap-2 flex-wrap">
                              <span>{isAr ? 'المبلغ المسحوب:' : 'Gross:'} <strong>{(tx.grossAmount || tx.amount).toLocaleString()} 💎</strong></span>
                              <span className="text-rose-500">{isAr ? `(خصم 2.5%: -${(tx.feeAmount || 0).toLocaleString()} 💎)` : `(2.5% fee)`}</span>
                              {tx.payoutMethod && (
                                <span className="text-neutral-400">({tx.payoutMethod})</span>
                              )}
                            </div>
                          )}

                          <span className="text-[10px] text-neutral-400 font-mono block">
                            {tx.id} • {new Date(tx.timestamp).toLocaleString()}
                          </span>
                        </div>

                        <div className="text-end shrink-0 self-start sm:self-center">
                          <span className={`text-sm font-black font-mono block ${isUserWithdrawal ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-900 dark:text-white'}`}>
                            {isUserWithdrawal ? `+${tx.amount.toLocaleString()} 💎` : `-${tx.amount.toLocaleString()} 💎`}
                          </span>
                          <span className="text-[10px] text-emerald-500 dark:text-emerald-400 font-mono block font-bold">
                            {isUserWithdrawal
                              ? (isAr ? 'صافي أضيف للوكالة ✓' : 'Net Credited ✓')
                              : (isAr ? 'تم الشحن بنجاح ✓' : 'Success ✓')}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ========================================================
            MODAL FOOTER BAR
            ======================================================== */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/70 dark:bg-neutral-950/50 shrink-0 text-xs text-neutral-500">
          <div className="flex items-center gap-1.5 font-mono">
            <span>{isAr ? 'قريد الوكالة:' : 'Agency Grid:'}</span>
            <span className="font-bold text-neutral-900 dark:text-white">{agent.gridCode || 'A8838'}</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white font-bold text-xs cursor-pointer transition-colors"
          >
            {isAr ? 'إغلاق' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
