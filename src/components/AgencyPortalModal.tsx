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
} from 'lucide-react';
import { Language, AgentRecord, AgencyWithdrawalRequest, AgencyRechargeTransaction } from '../types';

interface AgencyPortalModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  agent: AgentRecord;
  onBalanceUpdated?: (newBalance: number) => void;
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
}) => {
  const isAr = lang === 'ar';

  const [agent, setAgent] = useState<AgentRecord>(initialAgent);
  const [activeTab, setActiveTab] = useState<'recharge' | 'withdraw' | 'history'>('recharge');

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

  // Fetch updated agent details
  const refreshAgencyData = async () => {
    try {
      const res = await fetch(`/api/agent/my-agency?email=${encodeURIComponent(agent.email)}&userId=${encodeURIComponent(agent.id)}`);
      const data = await res.json();
      if (data.success && data.agent) {
        setAgent(data.agent);
        if (onBalanceUpdated) {
          onBalanceUpdated(data.agent.balance);
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
  const handleLookupUser = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanId = targetUserIdInput.trim();
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

        showToast(isAr ? `تم شحن ${amountToTransfer.toLocaleString()} 💎 بنجاح! ✨` : `Successfully recharged ${amountToTransfer} Diamonds!`);
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
          {/* 1. AGENCY BALANCE HERO CARD */}
          <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-neutral-900 via-neutral-950 to-neutral-900 text-white border border-neutral-800 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-neutral-400">
                  <Wallet className="w-4 h-4 text-cyan-400" />
                  <span>{isAr ? 'رصيد الوكالة المتاح للشحن والسحب' : 'Available Agency Balance'}</span>
                </div>
                <div className="text-3xl sm:text-4xl font-black text-cyan-400 font-mono tracking-tight flex items-baseline gap-2">
                  <span>{(agent.balance || 0).toLocaleString()}</span>
                  <span className="text-sm font-sans font-bold text-neutral-300">💎 {isAr ? 'ماسة' : 'Diamonds'}</span>
                </div>
                <p className="text-[11px] text-neutral-400 font-mono">
                  {isAr
                    ? `قيمة الرصيد التقريبية: $${(((agent.balance || 0) * 0.01)).toLocaleString()} USDT`
                    : `Approx Value: $${(((agent.balance || 0) * 0.01)).toLocaleString()} USDT`}
                </p>
              </div>

              {/* Grid ID Box */}
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md space-y-1 shrink-0 text-center sm:text-end">
                <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block">
                  {isAr ? 'رقم قريد الوكيل' : 'Agent Grid Code'}
                </span>
                <div className="flex items-center justify-center sm:justify-end gap-2">
                  <span className="text-xl font-mono font-black text-amber-400 tracking-wider">
                    {agent.gridCode || 'A8838'}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyGridCode}
                    className="p-1 rounded text-neutral-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {copiedGrid ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <span className="text-[10px] text-emerald-400 font-medium block">
                  ✓ {isAr ? 'معتمد للإيداع والشحن' : 'Verified Agent'}
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
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300">
                  {isAr ? '1. أدخل معرّف حساب المستخدم (Account ID)' : '1. Enter User Account ID'}
                </label>

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
                  <div className="p-3.5 rounded-2xl bg-white dark:bg-neutral-900 border-2 border-emerald-500/40 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-1 shadow-sm">
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
                    {withdrawRequests.map((req) => (
                      <div
                        key={req.id}
                        className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-sm text-neutral-900 dark:text-white">
                              {req.amount.toLocaleString()} 💎
                            </span>
                            <span className="text-xs text-neutral-500">
                              (${((req.amount || 0) * 0.01).toFixed(2)})
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-medium">
                              {req.method}
                            </span>
                          </div>
                          <p className="text-xs font-mono text-neutral-500 truncate max-w-md">
                            {req.accountDetails}
                          </p>
                          <span className="text-[10px] text-neutral-400 block font-mono">
                            {req.id} • {new Date(req.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        {/* Status Badge */}
                        <div className="shrink-0 self-start sm:self-center">
                          {req.status === 'completed' ? (
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
                    ))}
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
                  {transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs flex items-center justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs sm:text-sm font-bold text-neutral-900 dark:text-white truncate">
                            {tx.targetUserName}
                          </h4>
                          <span className="text-[10px] font-mono px-2 py-0.2 rounded-md bg-neutral-100 dark:bg-neutral-800 text-cyan-600 dark:text-cyan-400 font-bold">
                            {tx.targetUserDisplayId || tx.targetUserId}
                          </span>
                        </div>
                        <span className="text-[10px] text-neutral-400 font-mono block">
                          {tx.id} • {new Date(tx.timestamp).toLocaleString()}
                        </span>
                      </div>

                      <div className="text-end shrink-0">
                        <span className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">
                          +{tx.amount.toLocaleString()} 💎
                        </span>
                        <span className="text-[10px] text-neutral-400 block font-mono">
                          {isAr ? 'تنفيذ ناجح ✓' : 'Success ✓'}
                        </span>
                      </div>
                    </div>
                  ))}
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
