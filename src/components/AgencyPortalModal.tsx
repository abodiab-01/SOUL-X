import React, { useState, useEffect } from 'react';
import {
  Building2,
  X,
  Send,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  Search,
  UserCheck,
  Loader2,
  Receipt,
  CreditCard,
  History,
  Coins,
  User,
} from 'lucide-react';
import {
  Language,
  AgentRecord,
  AgencyWithdrawalRequest,
  AgencyRechargeTransaction,
  AuthUser,
} from '../types';
import { CoinIcon, DiamondIcon } from './CurrencyIcons';
import { formatEnglishDateTime } from '../lib/dateUtils';
import { VerifiedBadge } from './VerifiedBadge';

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
  onPersonalCoinsBalanceUpdated?: (newBalance: number) => void;
}

/**
 * تنسيق الأرقام دائماً بالأرقام الإنجليزية بحد أقصى فاصلتين عشريتين
 */
export function formatAgencyCoins(val: number | string | null | undefined): string {
  const n = typeof val === 'number' ? val : parseFloat(String(val || '0')) || 0;
  const rounded = Math.round((n + Number.EPSILON) * 100) / 100;
  return rounded.toLocaleString('en-US', {
    minimumFractionDigits: rounded % 1 !== 0 ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

function formatEnglishNumber(val: number | string | null | undefined): string {
  const n = typeof val === 'number' ? val : parseFloat(String(val || '0')) || 0;
  return Math.round(n).toLocaleString('en-US');
}

const COINS_PER_USD = 25000;
const RECHARGE_USD_PRESETS = [
  { usd: 1, coins: 25000 },
  { usd: 2, coins: 50000 },
  { usd: 5, coins: 125000 },
  { usd: 10, coins: 250000 },
  { usd: 50, coins: 1250000 },
  { usd: 100, coins: 2500000 },
];

export const AgencyPortalModal: React.FC<AgencyPortalModalProps> = ({
  isOpen,
  onClose,
  lang,
  agent: initialAgent,
  onBalanceUpdated,
  currentUser,
  onPersonalBalanceUpdated,
  onPersonalCoinsBalanceUpdated,
}) => {
  const isAr = lang === 'ar';

  const [agent, setAgent] = useState<AgentRecord>(initialAgent);
  const [activeTab, setActiveTab] = useState<'recharge' | 'withdraw' | 'history'>('recharge');

  const [copiedGrid, setCopiedGrid] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isRefreshingHeader, setIsRefreshingHeader] = useState(false);

  // Flow: Enter Account ID + Amount -> "شحن" (verify ID) -> Confirmation ("تحقق من المعرف") -> "تأكيد شحن"
  const [targetUserIdInput, setTargetUserIdInput] = useState('');
  const [amountInput, setAmountInput] = useState<string>('');
  const [isLookingUpUser, setIsLookingUpUser] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [verifiedUser, setVerifiedUser] = useState<{
    id: string;
    displayId: string;
    name: string;
    photoUrl: string | null;
    gender?: string | null;
    isVerified?: boolean;
  } | null>(null);
  const [isSubmittingRecharge, setIsSubmittingRecharge] = useState(false);
  const [rechargeReceipt, setRechargeReceipt] = useState<{
    txId: string;
    targetName: string;
    targetDisplayId: string;
    amount: number;
    remainingAgentBalance: number;
    timestamp: string;
  } | null>(null);

  // Incoming User Cashouts (withdrawals)
  const [withdrawRequests, setWithdrawRequests] = useState<AgencyWithdrawalRequest[]>([]);
  const [isLoadingWithdraws, setIsLoadingWithdraws] = useState(false);
  const [withdrawSearch, setWithdrawSearch] = useState('');
  const [withdrawFilterTab, setWithdrawFilterTab] = useState<'pending' | 'completed'>('pending');
  const [processingWithdrawId, setProcessingWithdrawId] = useState<string | null>(null);
  const [copiedUserIdForReq, setCopiedUserIdForReq] = useState<string | null>(null);

  // Operations history
  const [transactions, setTransactions] = useState<AgencyRechargeTransaction[]>([]);
  const [isLoadingTx, setIsLoadingTx] = useState(false);
  const [historySearch, setHistorySearch] = useState('');

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
      showToast(isAr ? `تم نسخ رقم القريد [${code}]` : `Copied Grid Code [${code}]`);
      setTimeout(() => setCopiedGrid(false), 2000);
    }
  };

  const refreshAgencyData = async () => {
    setIsRefreshingHeader(true);
    try {
      const emailParam = encodeURIComponent(agent.email);
      const uidParam = encodeURIComponent(currentUser?.id || agent.id);
      const dispParam = encodeURIComponent(currentUser?.displayId || '');
      const res = await fetch(
        `/api/agent/my-agency?email=${emailParam}&userId=${uidParam}&displayId=${dispParam}`
      );
      const data = await res.json();
      if (data.success && data.agent) {
        setAgent(data.agent);
        if (onBalanceUpdated) {
          onBalanceUpdated(data.agent.balance);
        }
      }
      if (data.personalAccount) {
        if (typeof data.personalAccount.walletBalance === 'number' && onPersonalBalanceUpdated) {
          onPersonalBalanceUpdated(data.personalAccount.walletBalance);
        }
        if (typeof data.personalAccount.coinsBalance === 'number') {
          if (typeof window !== 'undefined') {
            localStorage.setItem('soulx_coins_balance', String(data.personalAccount.coinsBalance));
            window.dispatchEvent(
              new CustomEvent('soulx:balance-updated', {
                detail: {
                  currency: 'coins',
                  balance: data.personalAccount.coinsBalance,
                  userId: currentUser?.id,
                  displayId: currentUser?.displayId,
                },
              })
            );
          }
          if (onPersonalCoinsBalanceUpdated) {
            onPersonalCoinsBalanceUpdated(data.personalAccount.coinsBalance);
          }
        }
      }
    } catch {
      // ignore
    } finally {
      setIsRefreshingHeader(false);
    }
  };

  const fetchWithdrawRequests = async () => {
    setIsLoadingWithdraws(true);
    try {
      const res = await fetch(
        `/api/agent/withdraw-requests?agentId=${encodeURIComponent(agent.id)}&gridCode=${encodeURIComponent(
          agent.gridCode || ''
        )}`
      );
      const data = await res.json();
      if (data.success && Array.isArray(data.requests)) {
        setWithdrawRequests(data.requests);
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingWithdraws(false);
    }
  };

  const handleMarkWithdrawCompleted = async (req: AgencyWithdrawalRequest) => {
    if (processingWithdrawId) return;
    setProcessingWithdrawId(req.id);
    try {
      const res = await fetch(
        `/api/agent/withdraw-requests/${encodeURIComponent(req.id)}/complete`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentId: agent.id,
            gridCode: agent.gridCode || '',
          }),
        }
      );
      const data = await res.json();
      if (data.success) {
        const updatedReq = data.request || {
          ...req,
          status: 'completed' as const,
          updatedAt: new Date().toISOString(),
        };
        setWithdrawRequests((prev) =>
          prev.map((item) => (item.id === req.id ? { ...item, ...updatedReq, status: 'completed' } : item))
        );
        showToast(
          isAr
            ? 'تمت معالجة الطلب ونقله إلى الطلبات المكتملة'
            : 'Request marked as processed and moved to completed'
        );
      } else {
        showToast(data.message || (isAr ? 'تعذر تحديث حالة الطلب' : 'Failed to update request'));
      }
    } catch {
      showToast(isAr ? 'حدث خطأ في الاتصال بالسيرفر' : 'Server connection error');
    } finally {
      setProcessingWithdrawId(null);
    }
  };

  const handleCopyWithdrawUserId = (userIdValue: string, reqId: string) => {
    if (!userIdValue || userIdValue === '—') return;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(userIdValue);
      setCopiedUserIdForReq(reqId);
      showToast(isAr ? `تم نسخ ID المستخدم [${userIdValue}]` : `Copied User ID [${userIdValue}]`);
      setTimeout(() => setCopiedUserIdForReq(null), 2000);
    }
  };

  const fetchTransactions = async () => {
    setIsLoadingTx(true);
    try {
      const res = await fetch(
        `/api/agent/transactions?agentId=${encodeURIComponent(agent.id)}&gridCode=${encodeURIComponent(
          agent.gridCode || ''
        )}`
      );
      const data = await res.json();
      if (data.success && Array.isArray(data.transactions)) {
        setTransactions(data.transactions);
      }
    } catch {
      // ignore
    } finally {
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

  // Step 1 -> Verify Account ID before confirmation
  const handleVerifyBeforeConfirm = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanId = targetUserIdInput.trim();
    const parsedAmount = Math.floor(Number(amountInput) || 0);

    if (!cleanId) {
      setFormError(isAr ? 'يرجى إدخال معرّف الحساب المراد شحنه' : 'Please enter the target account ID');
      return;
    }
    if (parsedAmount <= 0) {
      setFormError(isAr ? 'يرجى إدخال مبلغ كوينز صالح' : 'Please enter a valid coins amount');
      return;
    }
    if ((agent.balance || 0) < parsedAmount) {
      setFormError(
        isAr
          ? 'رصيد كوينز الوكالة غير كافٍ لإتمام هذا المبلغ'
          : 'Insufficient agency coins balance'
      );
      return;
    }

    setFormError(null);
    setIsLookingUpUser(true);
    setVerifiedUser(null);

    try {
      const res = await fetch('/api/agent/lookup-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIdentifier: cleanId }),
      });
      const data = await res.json();

      if (data.success && data.user) {
        setVerifiedUser({
          id: data.user.id,
          displayId: data.user.displayId || data.user.id,
          name: data.user.name,
          photoUrl: data.user.photoUrl || null,
          gender: data.user.gender || null,
          isVerified: Boolean(data.user.isVerified),
        });
      } else {
        setFormError(
          data.message ||
            (isAr
              ? 'لم يتم العثور على حساب بهذا المعرف'
              : 'No account found with this ID')
        );
      }
    } catch {
      setFormError(isAr ? 'تعذر التحقق من المعرف، حاول مجدداً' : 'Failed to verify account ID');
    } finally {
      setIsLookingUpUser(false);
    }
  };

  // Step 2 -> Confirm and execute recharge
  const handleConfirmRecharge = async () => {
    if (!verifiedUser) return;
    const amountToTransfer = Math.floor(Number(amountInput) || 0);

    if (amountToTransfer <= 0) {
      setFormError(isAr ? 'يرجى إدخال مبلغ كوينز صالح' : 'Invalid coins amount');
      return;
    }
    if ((agent.balance || 0) < amountToTransfer) {
      setFormError(isAr ? 'رصيد كوينز الوكالة غير كافٍ' : 'Insufficient agency balance');
      return;
    }

    setIsSubmittingRecharge(true);
    setFormError(null);

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
          (currentUser?.id &&
            (verifiedUser.id === currentUser.id || verifiedUser.displayId === currentUser.id)) ||
          (currentUser?.displayId &&
            (verifiedUser.displayId === currentUser.displayId ||
              verifiedUser.id === currentUser.displayId));

        if (isRechargingSelf) {
          refreshAgencyData();
        }

        setRechargeReceipt({
          txId: data.transaction?.id || `TX-${Date.now()}`,
          targetName: verifiedUser.name,
          targetDisplayId: verifiedUser.displayId,
          amount: amountToTransfer,
          remainingAgentBalance: data.newAgentBalance,
          timestamp: new Date().toISOString(),
        });

        if (data.transaction) {
          setTransactions((prev) => [data.transaction, ...prev]);
        }

        setVerifiedUser(null);
        setTargetUserIdInput('');
        setAmountInput('');
        showToast(
          isAr
            ? `تم شحن ${formatEnglishNumber(amountToTransfer)} Coins بنجاح`
            : `Recharged ${formatEnglishNumber(amountToTransfer)} Coins`
        );
      } else {
        setFormError(data.message || (isAr ? 'تعذر إتمام الشحن' : 'Recharge failed'));
      }
    } catch {
      setFormError(isAr ? 'حدث خطأ في الاتصال بالسيرفر' : 'Server connection error');
    } finally {
      setIsSubmittingRecharge(false);
    }
  };

  if (!isOpen) return null;

  const parsedAmountPreview = Math.max(0, Math.floor(Number(amountInput) || 0));

  const filteredWithdraws = withdrawRequests.filter((req) => {
    const q = withdrawSearch.trim().toLowerCase();
    if (!q) return true;
    const orderNum = (req.orderNumber || req.orderId || req.id || '').toLowerCase();
    const uName = (req.userName || '').toLowerCase();
    const uId = (req.userDisplayId || req.userId || '').toLowerCase();
    const rawId = (req.userId || '').toLowerCase();
    return orderNum.includes(q) || uName.includes(q) || uId.includes(q) || rawId.includes(q);
  });

  const pendingWithdraws = filteredWithdraws.filter(
    (req) => req.status !== 'completed' && req.status !== 'rejected'
  );
  const completedWithdraws = filteredWithdraws.filter((req) => req.status === 'completed');
  const totalPendingWithdrawsCount = withdrawRequests.filter(
    (req) => req.status !== 'completed' && req.status !== 'rejected'
  ).length;
  const displayedWithdraws =
    withdrawFilterTab === 'pending' ? pendingWithdraws : completedWithdraws;

  const filteredTransactions = transactions.filter((tx) => {
    const q = historySearch.trim().toLowerCase();
    if (!q) return true;
    const uName = (tx.targetUserName || '').toLowerCase();
    const uId = (tx.targetUserDisplayId || tx.targetUserId || '').toLowerCase();
    const txId = (tx.id || '').toLowerCase();
    return uName.includes(q) || uId.includes(q) || txId.includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 w-full h-full min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col overflow-hidden">
      {/* Center Toast */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[100] px-4 py-2.5 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 font-bold text-xs shadow-lg border border-neutral-700 dark:border-neutral-200 flex items-center gap-2 pointer-events-none">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ========================================================
          IMPROVED CLEAN TOP HEADER BAR
      ======================================================== */}
      <header className="sticky top-0 z-30 border-b border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md shrink-0">
        <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
          {/* Start: Back + Agency Identity */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center justify-center text-neutral-700 dark:text-neutral-200 transition-colors cursor-pointer shrink-0"
              title={isAr ? 'العودة' : 'Back'}
            >
              {isAr ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
            </button>

            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-extrabold text-neutral-900 dark:text-white truncate">
                  {isAr ? 'وكالة الشحن' : 'Recharge Agency'}
                </h1>
                <button
                  type="button"
                  onClick={handleCopyGridCode}
                  title={isAr ? 'نسخ رقم القريد' : 'Copy Grid Code'}
                  dir="ltr"
                  className="px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-neutral-700 text-[11px] font-mono font-bold text-neutral-700 dark:text-neutral-300 inline-flex items-center gap-1 cursor-pointer shrink-0 tabular-nums"
                >
                  <span>{agent.gridCode || 'A8838'}</span>
                  {copiedGrid ? (
                    <Check className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <Copy className="w-3 h-3 text-neutral-400" />
                  )}
                </button>
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                {agent.name}
              </p>
            </div>
          </div>

          {/* End: Compact Live Coins Readout + Refresh */}
          <div className="flex items-center gap-2 shrink-0">
            <div
              dir="ltr"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs font-mono font-extrabold text-amber-700 dark:text-amber-400 tabular-nums"
            >
              <CoinIcon className="w-3.5 h-3.5 text-amber-500" />
              <span>{formatAgencyCoins(agent.balance || 0)}</span>
            </div>

            <button
              type="button"
              onClick={refreshAgencyData}
              disabled={isRefreshingHeader}
              title={isAr ? 'تحديث الرصيد' : 'Refresh balance'}
              className="w-9 h-9 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center justify-center text-neutral-600 dark:text-neutral-300 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshingHeader ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* ========================================================
          SCROLLABLE CONTENT BODY
      ======================================================== */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto w-full p-4 sm:p-6 space-y-5 pb-24">
          {/* Clean Agency Balance Summary Card */}
          <div className="p-5 rounded-2xl bg-neutral-900 dark:bg-neutral-900 text-white border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-neutral-400">
                <Coins className="w-4 h-4 text-amber-400" />
                <span>{isAr ? 'رصيد وكالة الشحن المتاح' : 'Available Agency Coins'}</span>
              </div>
              <div
                dir="ltr"
                className="text-2xl sm:text-3xl font-extrabold text-amber-400 font-mono tabular-nums flex items-center gap-2 w-fit"
              >
                <span>{formatAgencyCoins(agent.balance || 0)}</span>
                <CoinIcon className="w-5 h-5 text-amber-400" />
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs border-t sm:border-t-0 pt-3 sm:pt-0 border-neutral-800">
              <div className="px-3 py-2 rounded-xl bg-neutral-800/70 border border-neutral-700/70">
                <span className="text-[10px] text-neutral-400 block">
                  {isAr ? 'رقم القريد' : 'Grid Code'}
                </span>
                <span dir="ltr" className="font-mono font-bold text-white tabular-nums">
                  {agent.gridCode || 'A8838'}
                </span>
              </div>
              <div className="px-3 py-2 rounded-xl bg-neutral-800/70 border border-neutral-700/70">
                <span className="text-[10px] text-neutral-400 block">
                  {isAr ? 'العملة المعتمدة' : 'Currency'}
                </span>
                <span className="font-bold text-amber-400">Coins</span>
              </div>
            </div>
          </div>

          {/* 3 Clean Hairline Tabs (Notifications Removed) */}
          <div className="flex items-center border-b border-neutral-200 dark:border-neutral-800 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('recharge')}
              className={`px-4 py-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'recharge'
                  ? 'border-amber-500 text-neutral-900 dark:text-white'
                  : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
              }`}
            >
              <Send className={`w-4 h-4 ${activeTab === 'recharge' ? 'text-amber-500' : ''}`} />
              <span>{isAr ? 'شحن كوينز' : 'Recharge Coins'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('withdraw');
                fetchWithdrawRequests();
              }}
              className={`px-4 py-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'withdraw'
                  ? 'border-amber-500 text-neutral-900 dark:text-white'
                  : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
              }`}
            >
              <CreditCard className={`w-4 h-4 ${activeTab === 'withdraw' ? 'text-amber-500' : ''}`} />
              <span>{isAr ? 'سحوبات المستخدمين' : 'User Cashouts'}</span>
              {totalPendingWithdrawsCount > 0 && (
                <span
                  dir="ltr"
                  className="text-[11px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 font-mono font-bold tabular-nums"
                >
                  {formatEnglishNumber(totalPendingWithdrawsCount)}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('history');
                fetchTransactions();
              }}
              className={`px-4 py-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'history'
                  ? 'border-amber-500 text-neutral-900 dark:text-white'
                  : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
              }`}
            >
              <History className={`w-4 h-4 ${activeTab === 'history' ? 'text-amber-500' : ''}`} />
              <span>{isAr ? 'سجل العمليات' : 'Operations Log'}</span>
              {transactions.length > 0 && (
                <span
                  dir="ltr"
                  className="text-[11px] px-1.5 py-0.2 rounded bg-neutral-200/80 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-mono font-bold tabular-nums"
                >
                  {formatEnglishNumber(transactions.length)}
                </span>
              )}
            </button>
          </div>

          {/* ========================================================
              TAB 1: RECHARGE COINS (USD PRESETS + VERIFY -> CONFIRM, NO USER BALANCE)
          ======================================================== */}
          {activeTab === 'recharge' && (
            <div className="space-y-4">
              {/* Completion Receipt (Strictly WITHOUT user's new balance) */}
              {rechargeReceipt && (
                <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-extrabold text-sm">
                      <CheckCircle2 className="w-5 h-5" />
                      <span>{isAr ? 'تم تنفيذ الشحن بنجاح' : 'Recharge Completed'}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRechargeReceipt(null)}
                      className="p-1 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-white cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs">
                    <div>
                      <span className="text-neutral-400 block text-[11px]">
                        {isAr ? 'اسم الحساب' : 'Account Name'}
                      </span>
                      <span className="font-bold text-neutral-900 dark:text-white text-sm">
                        {rechargeReceipt.targetName}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-400 block text-[11px]">
                        {isAr ? 'معرّف الحساب' : 'Account ID'}
                      </span>
                      <span
                        dir="ltr"
                        className="font-mono font-bold text-amber-600 dark:text-amber-400 text-sm inline-block"
                      >
                        {rechargeReceipt.targetDisplayId}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-400 block text-[11px]">
                        {isAr ? 'المبلغ المشحون' : 'Recharged Amount'}
                      </span>
                      <span
                        dir="ltr"
                        className="font-mono font-extrabold text-emerald-600 dark:text-emerald-400 text-sm inline-flex items-center gap-1 tabular-nums"
                      >
                        <span>+{formatEnglishNumber(rechargeReceipt.amount)}</span>
                        <CoinIcon className="w-4 h-4" />
                        <span>Coins</span>
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-400 block text-[11px]">
                        {isAr ? 'رصيد الوكالة المتبقي' : 'Remaining Agency Balance'}
                      </span>
                      <span
                        dir="ltr"
                        className="font-mono font-bold text-neutral-900 dark:text-white text-sm inline-flex items-center gap-1 tabular-nums"
                      >
                        <span>{formatAgencyCoins(rechargeReceipt.remainingAgentBalance)}</span>
                        <CoinIcon className="w-3.5 h-3.5" />
                      </span>
                    </div>
                    <div className="sm:col-span-2 pt-2 border-t border-neutral-100 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-neutral-500">
                      <span dir="ltr">{rechargeReceipt.txId}</span>
                      <span dir="ltr">{formatEnglishDateTime(rechargeReceipt.timestamp)}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setRechargeReceipt(null)}
                    className="w-full py-2.5 px-4 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 font-bold text-xs cursor-pointer"
                  >
                    {isAr ? 'عملية شحن جديدة' : 'New Recharge'}
                  </button>
                </div>
              )}

              {/* Step 1: Account ID & Amount Input Form with USD Presets */}
              {!verifiedUser ? (
                <form
                  onSubmit={handleVerifyBeforeConfirm}
                  className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                        {isAr ? 'معرّف الحساب المراد شحنه' : 'Target Account ID'}
                      </label>
                      {currentUser && (currentUser.displayId || currentUser.id) && (
                        <button
                          type="button"
                          onClick={() => {
                            const myId = currentUser.displayId || currentUser.id;
                            if (myId) {
                              setTargetUserIdInput(myId);
                              setFormError(null);
                            }
                          }}
                          className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                        >
                          {isAr ? 'تعبئة معرفي الشخصي' : 'Use My ID'}
                        </button>
                      )}
                    </div>
                    <div className="relative" dir="ltr">
                      <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        dir="ltr"
                        value={targetUserIdInput}
                        onChange={(e) => {
                          setTargetUserIdInput(e.target.value);
                          setFormError(null);
                        }}
                        placeholder={isAr ? 'مثال: S-0101V77-X711' : 'e.g. S-0101V77-X711'}
                        className="w-full h-11 pl-10 pr-3.5 text-left text-sm font-mono rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white placeholder:text-neutral-400/80 placeholder:text-xs focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                          {isAr ? 'مبلغ الشحن (Coins)' : 'Recharge Amount (Coins)'}
                        </label>
                        <span
                          dir="ltr"
                          className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400"
                        >
                          $1 = 25,000 Coins
                        </span>
                      </div>
                      <span className="text-[11px] text-neutral-500 font-mono tabular-nums" dir="ltr">
                        {isAr ? 'المتبقي:' : 'Remaining:'}{' '}
                        <strong className="text-amber-600 dark:text-amber-400">
                          {formatAgencyCoins(Math.max(0, (agent.balance || 0) - parsedAmountPreview))}
                        </strong>
                      </span>
                    </div>

                    {/* Quick USD Presets ($1 = 25,000 Coins) */}
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {RECHARGE_USD_PRESETS.map((preset) => {
                        const isSelected = parsedAmountPreview === preset.coins;
                        return (
                          <button
                            key={preset.usd}
                            type="button"
                            dir="ltr"
                            onClick={() => {
                              setAmountInput(String(preset.coins));
                              setFormError(null);
                            }}
                            className={`h-10 rounded-xl border text-xs font-mono font-extrabold transition-all cursor-pointer flex items-center justify-center tabular-nums ${
                              isSelected
                                ? 'bg-amber-400 border-amber-500 text-neutral-950 shadow-sm ring-2 ring-amber-400/30'
                                : 'bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 hover:border-amber-400 hover:bg-amber-500/5'
                            }`}
                          >
                            {preset.usd}$
                          </button>
                        );
                      })}
                    </div>

                    <div className="relative" dir="ltr">
                      <input
                        type="number"
                        dir="ltr"
                        min={1}
                        step={1}
                        value={amountInput}
                        onChange={(e) => {
                          setAmountInput(e.target.value);
                          setFormError(null);
                        }}
                        placeholder={isAr ? 'أدخل كمية الكوينز...' : 'Enter coins amount...'}
                        className="w-full h-11 pl-4 pr-24 text-left text-sm font-mono font-bold tabular-nums rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white placeholder:text-neutral-400/80 placeholder:text-xs placeholder:font-normal focus:outline-none focus:border-amber-500"
                      />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-amber-500 inline-flex items-center gap-1 pointer-events-none select-none">
                        <CoinIcon className="w-3.5 h-3.5" />
                        <span>Coins</span>
                      </span>
                    </div>

                    {parsedAmountPreview > 0 && (
                      <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400 px-1">
                        <span>{isAr ? 'القيمة المعادلة بالدولار:' : 'USD Equivalent:'}</span>
                        <span dir="ltr" className="font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                          $
                          {(parsedAmountPreview / COINS_PER_USD).toLocaleString('en-US', {
                            minimumFractionDigits: parsedAmountPreview % COINS_PER_USD === 0 ? 0 : 2,
                            maximumFractionDigits: 2,
                          })}{' '}
                          USD
                        </span>
                      </div>
                    )}
                  </div>

                  {formError && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLookingUpUser || !targetUserIdInput.trim() || parsedAmountPreview <= 0}
                    className="w-full h-12 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-neutral-950 font-extrabold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    {isLookingUpUser ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{isAr ? 'جاري التحقق من المعرف...' : 'Verifying Account...'}</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>{isAr ? 'شحن' : 'Recharge'}</span>
                      </>
                    )}
                  </button>
                </form>
              ) : (
                /* Step 2: Account Verification Confirmation Card (Displays ONLY ID & Name + Amount, NO Balance) */
                <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-neutral-900 border-2 border-amber-500/40 space-y-4">
                  <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
                    <div className="flex items-center gap-2 text-sm font-extrabold text-neutral-900 dark:text-white">
                      <UserCheck className="w-4 h-4 text-emerald-500" />
                      <span>{isAr ? 'تحقق من المعرف' : 'Verify Account'}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setVerifiedUser(null);
                        setFormError(null);
                      }}
                      className="text-xs font-bold text-neutral-500 hover:text-neutral-900 dark:hover:text-white cursor-pointer"
                    >
                      {isAr ? 'تعديل البيانات' : 'Edit'}
                    </button>
                  </div>

                  {/* Verified Account ID & Name (STRICTLY NO BALANCE SHOWN) */}
                  <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={
                          verifiedUser.photoUrl ||
                          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'
                        }
                        alt={verifiedUser.name}
                        className="w-11 h-11 rounded-xl object-cover border border-neutral-200 dark:border-neutral-700 shrink-0"
                      />
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-neutral-400">
                            {isAr ? 'اسم الحساب:' : 'Account Name:'}
                          </span>
                          <span className="text-sm font-extrabold text-neutral-900 dark:text-white truncate">
                            {verifiedUser.name}
                          </span>
                          {verifiedUser.isVerified && <VerifiedBadge lang={lang} size="xs" />}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="text-neutral-400">
                            {isAr ? 'معرّف الحساب:' : 'Account ID:'}
                          </span>
                          <span
                            dir="ltr"
                            className="font-mono font-bold text-amber-600 dark:text-amber-400"
                          >
                            {verifiedUser.displayId}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-end shrink-0">
                      <span className="text-[11px] text-neutral-400 block">
                        {isAr ? 'المبلغ المراد شحنه' : 'Amount'}
                      </span>
                      <span
                        dir="ltr"
                        className="font-mono font-extrabold text-base text-neutral-900 dark:text-white inline-flex items-center gap-1 tabular-nums"
                      >
                        <span>{formatEnglishNumber(parsedAmountPreview)}</span>
                        <CoinIcon className="w-4 h-4 text-amber-500" />
                      </span>
                    </div>
                  </div>

                  {formError && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setVerifiedUser(null);
                        setFormError(null);
                      }}
                      disabled={isSubmittingRecharge}
                      className="px-4 h-12 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-xs font-bold text-neutral-700 dark:text-neutral-200 cursor-pointer disabled:opacity-50"
                    >
                      {isAr ? 'إلغاء' : 'Cancel'}
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmRecharge}
                      disabled={isSubmittingRecharge}
                      className="flex-1 h-12 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-neutral-950 font-extrabold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      {isSubmittingRecharge ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>{isAr ? 'جاري التنفيذ...' : 'Processing...'}</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{isAr ? 'تأكيد شحن' : 'Confirm Recharge'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================
              TAB 2: USER WITHDRAWALS (PENDING & COMPLETED + ACCOUNT ID + PROCESSED ACTION)
          ======================================================== */}
          {activeTab === 'withdraw' && (
            <div className="space-y-4">
              {/* Top Filter & Count */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-neutral-600 dark:text-neutral-300">
                  <CreditCard className="w-4 h-4 text-amber-500" />
                  <span>{isAr ? 'سحوبات المستخدمين عبر الوكالة' : 'User Diamond Cashouts'}</span>
                  <span
                    dir="ltr"
                    className="px-2 py-0.5 rounded bg-neutral-200/70 dark:bg-neutral-800 font-mono tabular-nums text-[11px]"
                  >
                    {formatEnglishNumber(filteredWithdraws.length)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1 sm:w-56">
                    <Search className="w-3.5 h-3.5 text-neutral-400 absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none" />
                    <input
                      type="text"
                      value={withdrawSearch}
                      onChange={(e) => setWithdrawSearch(e.target.value)}
                      placeholder={isAr ? 'بحث بالاسم أو ID أو رقم الطلب...' : 'Search ID, Name, Order...'}
                      className="w-full h-9 ps-8 pe-3 text-xs rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={fetchWithdrawRequests}
                    disabled={isLoadingWithdraws}
                    className="w-9 h-9 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-center justify-center text-neutral-500 hover:text-neutral-900 dark:hover:text-white cursor-pointer shrink-0"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingWithdraws ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Sub-tabs: Pending vs Completed Requests */}
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-neutral-200/60 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setWithdrawFilterTab('pending')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    withdrawFilterTab === 'pending'
                      ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
                      : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
                  }`}
                >
                  <span>{isAr ? 'قيد الانتظار' : 'Pending'}</span>
                  <span
                    dir="ltr"
                    className={`px-1.5 py-0.5 rounded-md font-mono text-[11px] tabular-nums ${
                      withdrawFilterTab === 'pending'
                        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                        : 'bg-neutral-300/60 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                    }`}
                  >
                    {formatEnglishNumber(pendingWithdraws.length)}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setWithdrawFilterTab('completed')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    withdrawFilterTab === 'completed'
                      ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
                      : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
                  }`}
                >
                  <span>{isAr ? 'الطلبات المكتملة' : 'Completed'}</span>
                  <span
                    dir="ltr"
                    className={`px-1.5 py-0.5 rounded-md font-mono text-[11px] tabular-nums ${
                      withdrawFilterTab === 'completed'
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                        : 'bg-neutral-300/60 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                    }`}
                  >
                    {formatEnglishNumber(completedWithdraws.length)}
                  </span>
                </button>
              </div>

              {isLoadingWithdraws ? (
                <div className="py-12 text-center text-xs text-neutral-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                  <span>{isAr ? 'جاري التحميل...' : 'Loading...'}</span>
                </div>
              ) : displayedWithdraws.length === 0 ? (
                <div className="py-14 text-center space-y-2 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6">
                  <CreditCard className="w-8 h-8 text-neutral-400 mx-auto" />
                  <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
                    {withdrawFilterTab === 'pending'
                      ? isAr
                        ? 'لا توجد طلبات سحب قيد الانتظار حالياً'
                        : 'No pending cashout requests'
                      : isAr
                      ? 'لا توجد طلبات مكتملة بعد'
                      : 'No completed requests yet'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {displayedWithdraws.map((req) => {
                    const grossDiamonds = req.amount;
                    const orderNum = req.orderNumber || req.orderId || req.id;
                    const grossUsd = (grossDiamonds / 400000) * 10;
                    const requiredUsd =
                      typeof req.netUsdAmount === 'number'
                        ? req.netUsdAmount
                        : Math.round((grossUsd * 0.975 + Number.EPSILON) * 100) / 100;
                    const netCoinsCredited =
                      typeof req.netCredited === 'number'
                        ? req.netCredited
                        : Math.round((grossDiamonds * 0.625 * 0.975 + Number.EPSILON) * 100) / 100;
                    const userAccountId = req.userDisplayId || req.userId || '—';
                    const isCompleted = req.status === 'completed';
                    const isProcessing = processingWithdrawId === req.id;

                    return (
                      <div
                        key={req.id}
                        className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-3"
                      >
                        {/* Header row: Order #, Status & Date in English numerals */}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              dir="ltr"
                              className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-400 font-mono font-bold text-xs tabular-nums"
                            >
                              #{orderNum}
                            </span>
                            <span className="text-xs font-bold text-neutral-900 dark:text-white inline-flex items-center gap-1">
                              <User className="w-3.5 h-3.5 text-neutral-400" />
                              <span>{req.userName || 'Soul-X User'}</span>
                            </span>
                            {isCompleted && (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>{isAr ? 'مكتمل' : 'Completed'}</span>
                              </span>
                            )}
                          </div>

                          <span dir="ltr" className="text-[11px] font-mono text-neutral-400 tabular-nums">
                            {formatEnglishDateTime(
                              isCompleted ? req.updatedAt || req.createdAt : req.createdAt
                            )}
                          </span>
                        </div>

                        {/* Dedicated User Account ID Row with Copy Button */}
                        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800 text-xs">
                          <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
                            {isAr ? 'ID حساب المستخدم:' : 'User Account ID:'}
                          </span>
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              dir="ltr"
                              className="font-mono font-extrabold text-neutral-900 dark:text-white truncate"
                            >
                              {userAccountId}
                            </span>
                            {userAccountId !== '—' && (
                              <button
                                type="button"
                                onClick={() => handleCopyWithdrawUserId(userAccountId, req.id)}
                                title={isAr ? 'نسخ ID المستخدم' : 'Copy User ID'}
                                className="p-1 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer shrink-0"
                              >
                                {copiedUserIdForReq === req.id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Clean 3-column metrics */}
                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800 text-xs">
                          <div>
                            <span className="text-[10px] text-neutral-400 block">
                              {isAr ? 'مبلغ السحب' : 'Diamonds'}
                            </span>
                            <span
                              dir="ltr"
                              className="font-mono font-bold text-neutral-900 dark:text-white inline-flex items-center gap-1 tabular-nums"
                            >
                              <span>{formatEnglishNumber(grossDiamonds)}</span>
                              <DiamondIcon className="w-3 h-3 text-cyan-400" />
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] text-neutral-400 block">
                              {isAr ? 'التسليم بالدولار' : 'Pay USD'}
                            </span>
                            <span
                              dir="ltr"
                              className="font-mono font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums inline-block"
                            >
                              ${requiredUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>

                          <div className="text-end">
                            <span className="text-[10px] text-neutral-400 block">
                              {isAr ? 'المضاف لوكالتك' : 'Agency Credit'}
                            </span>
                            <span
                              dir="ltr"
                              className="font-mono font-extrabold text-amber-600 dark:text-amber-400 inline-flex items-center gap-1 tabular-nums"
                            >
                              <span>+{formatAgencyCoins(netCoinsCredited)}</span>
                              <CoinIcon className="w-3 h-3" />
                            </span>
                          </div>
                        </div>

                        {/* Action Button for Pending Requests */}
                        {!isCompleted && (
                          <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleMarkWithdrawCompleted(req)}
                              disabled={isProcessing}
                              className="w-full sm:w-auto px-4 h-9 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-neutral-950 font-extrabold text-xs inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                            >
                              {isProcessing ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  <span>{isAr ? 'جاري النقل...' : 'Processing...'}</span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>{isAr ? 'تمت المعالجة' : 'Processed'}</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ========================================================
              TAB 3: SIMPLIFIED OPERATIONS LOG (ENGLISH NUMERALS & DATES)
          ======================================================== */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              {/* Top Filter & Count */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-neutral-600 dark:text-neutral-300">
                  <History className="w-4 h-4 text-amber-500" />
                  <span>{isAr ? 'سجل العمليات' : 'Operations Log'}</span>
                  <span
                    dir="ltr"
                    className="px-2 py-0.5 rounded bg-neutral-200/70 dark:bg-neutral-800 font-mono tabular-nums text-[11px]"
                  >
                    {formatEnglishNumber(filteredTransactions.length)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1 sm:w-56">
                    <Search className="w-3.5 h-3.5 text-neutral-400 absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none" />
                    <input
                      type="text"
                      value={historySearch}
                      onChange={(e) => setHistorySearch(e.target.value)}
                      placeholder={isAr ? 'بحث بالاسم أو المعرف...' : 'Search Name, ID, Tx...'}
                      className="w-full h-9 ps-8 pe-3 text-xs rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={fetchTransactions}
                    disabled={isLoadingTx}
                    className="w-9 h-9 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-center justify-center text-neutral-500 hover:text-neutral-900 dark:hover:text-white cursor-pointer shrink-0"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTx ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {isLoadingTx ? (
                <div className="py-12 text-center text-xs text-neutral-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                  <span>{isAr ? 'جاري التحميل...' : 'Loading...'}</span>
                </div>
              ) : filteredTransactions.length === 0 ? (
                <div className="py-14 text-center space-y-2 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6">
                  <Receipt className="w-8 h-8 text-neutral-400 mx-auto" />
                  <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
                    {isAr ? 'لا توجد عمليات مسجلة بعد' : 'No operations recorded yet'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredTransactions.map((tx) => {
                    const isUserWithdrawal = tx.type === 'user_withdrawal';

                    return (
                      <div
                        key={tx.id}
                        className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-center justify-between gap-3"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                                isUserWithdrawal
                                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                                  : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                              }`}
                            >
                              {isUserWithdrawal
                                ? isAr
                                  ? 'سحب مستخدم'
                                  : 'Cashout Credit'
                                : isAr
                                ? 'شحن كوينز'
                                : 'Top-Up'}
                            </span>
                            <span className="text-xs sm:text-sm font-bold text-neutral-900 dark:text-white truncate">
                              {tx.targetUserName}
                            </span>
                            <span
                              dir="ltr"
                              className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400"
                            >
                              {tx.targetUserDisplayId || tx.targetUserId}
                            </span>
                          </div>

                          <div
                            dir="ltr"
                            className="text-[11px] font-mono text-neutral-400 flex items-center gap-2 flex-wrap tabular-nums w-fit"
                          >
                            <span>{tx.id}</span>
                            <span>•</span>
                            <span>{formatEnglishDateTime(tx.timestamp)}</span>
                          </div>
                        </div>

                        <div className="text-end shrink-0">
                          <span
                            dir="ltr"
                            className={`text-sm font-extrabold font-mono inline-flex items-center gap-1 tabular-nums ${
                              isUserWithdrawal
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            <span>
                              {isUserWithdrawal
                                ? `+${formatAgencyCoins(tx.amount)}`
                                : `-${formatEnglishNumber(tx.amount)}`}
                            </span>
                            <CoinIcon className="w-3.5 h-3.5" />
                          </span>
                          <span className="text-[10px] text-neutral-400 block">
                            {isAr ? 'مكتملة' : 'Completed'}
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
      </main>
    </div>
  );
};
