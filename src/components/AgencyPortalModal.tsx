import React, { useState, useEffect } from 'react';
import {
  Building2,
  X,
  Sparkles,
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
  Receipt,
  ShieldCheck,
  CreditCard,
  History,
  Coins,
  User,
  Bell,
} from 'lucide-react';
import {
  Language,
  AgentRecord,
  AgencyWithdrawalRequest,
  AgencyRechargeTransaction,
  AgencyNotification,
  AuthUser,
} from '../types';
import { CoinIcon, DiamondIcon } from './CurrencyIcons';
import { formatLocalDateTime } from '../lib/dateUtils';

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

const QUICK_COIN_AMOUNTS = [500, 1000, 2500, 5000, 10000, 25000, 50000];

/**
 * دالة لتنسيق رصيد وكالة الشحن (Coins) بحد أقصى فاصلتين عشريتين فقط
 */
export function formatAgencyCoins(val: number | string | null | undefined): string {
  const n = typeof val === 'number' ? val : parseFloat(String(val || '0')) || 0;
  const rounded = Math.round((n + Number.EPSILON) * 100) / 100;
  return rounded.toLocaleString('en-US', {
    minimumFractionDigits: rounded % 1 !== 0 ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

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
  onPersonalCoinsBalanceUpdated,
}) => {
  const isAr = lang === 'ar';

  const [agent, setAgent] = useState<AgentRecord>(initialAgent);
  const [activeTab, setActiveTab] = useState<'recharge' | 'withdraw' | 'notifications' | 'history'>('recharge');

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

  // Recharge user states (Coins only)
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
    coinsBalance?: number;
    gender?: string | null;
  } | null>(null);
  const [isSubmittingRecharge, setIsSubmittingRecharge] = useState(false);
  const [rechargeReceipt, setRechargeReceipt] = useState<{
    txId: string;
    targetName: string;
    targetDisplayId: string;
    amount: number;
    newTargetCoins: number;
    remainingAgentBalance: number;
    timestamp: string;
  } | null>(null);

  // Incoming User Cashouts (withdrawals)
  const [withdrawRequests, setWithdrawRequests] = useState<AgencyWithdrawalRequest[]>([]);
  const [isLoadingWithdraws, setIsLoadingWithdraws] = useState(false);

  // Recharge transactions history
  const [transactions, setTransactions] = useState<AgencyRechargeTransaction[]>([]);
  const [isLoadingTx, setIsLoadingTx] = useState(false);

  // Agency Notifications state
  const [agencyNotifications, setAgencyNotifications] = useState<AgencyNotification[]>([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState<boolean>(false);
  const [notificationsSearch, setNotificationsSearch] = useState<string>('');

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
          if (onPersonalCoinsBalanceUpdated) {
            onPersonalCoinsBalanceUpdated(data.personalAccount.coinsBalance);
          }
        }
      }
    } catch {}
  };

  // Fetch incoming user cashout requests
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
    } catch {} finally {
      setIsLoadingWithdraws(false);
    }
  };

  // Fetch recharge history
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
    } catch {} finally {
      setIsLoadingTx(false);
    }
  };

  // Fetch agency notifications
  const fetchAgencyNotifications = async () => {
    setIsLoadingNotifications(true);
    try {
      const res = await fetch(
        `/api/agent/notifications?agentId=${encodeURIComponent(agent.id)}&gridCode=${encodeURIComponent(
          agent.gridCode || ''
        )}`
      );
      const data = await res.json();
      if (data.success && Array.isArray(data.notifications)) {
        setAgencyNotifications(data.notifications);
        setUnreadNotificationsCount(data.unreadCount || 0);
      }
    } catch {} finally {
      setIsLoadingNotifications(false);
    }
  };

  const handleMarkNotificationsRead = async () => {
    try {
      await fetch('/api/agent/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: agent.id }),
      });
      setUnreadNotificationsCount(0);
      setAgencyNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {}
  };

  useEffect(() => {
    if (isOpen) {
      refreshAgencyData();
      fetchWithdrawRequests();
      fetchTransactions();
      fetchAgencyNotifications();
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

  // زر سريع لشحن كوينز للحساب الشخصي للوكيل من رصيد وكالته
  const handleQuickFillMyAccount = () => {
    const myId = currentUser?.displayId || currentUser?.id;
    if (!myId) return;
    setTargetUserIdInput(myId);
    handleLookupUser(undefined, myId);
  };

  // Submit Coins Recharge to User (Coins only)
  const handleExecuteRecharge = async () => {
    if (!verifiedUser) return;
    const amountToTransfer = parseInt(customAmount, 10) || rechargeAmount;

    if (amountToTransfer <= 0) {
      showToast(isAr ? 'يرجى إدخال كمية كوينز صالحة' : 'Invalid coin amount');
      return;
    }

    if ((agent.balance || 0) < amountToTransfer) {
      showToast(isAr ? 'رصيد كوينز الوكالة غير كافٍ!' : 'Insufficient agency coins balance!');
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
          (currentUser?.displayId &&
            (verifiedUser.displayId === currentUser.displayId || verifiedUser.id === currentUser.displayId));

        const targetNewCoins = data.targetUser?.coinsBalance ?? ((verifiedUser.coinsBalance || 0) + amountToTransfer);

        if (isRechargingSelf) {
          setPersonalCoins(targetNewCoins);
          if (typeof window !== 'undefined') {
            localStorage.setItem('soulx_coins_balance', String(targetNewCoins));
            window.dispatchEvent(
              new CustomEvent('soulx:balance-updated', {
                detail: {
                  currency: 'coins',
                  balance: targetNewCoins,
                  userId: currentUser?.id,
                  displayId: currentUser?.displayId,
                },
              })
            );
          }
          if (onPersonalCoinsBalanceUpdated) {
            onPersonalCoinsBalanceUpdated(targetNewCoins);
          }
        }

        setRechargeReceipt({
          txId: data.transaction?.id || `TX-${Date.now()}`,
          targetName: verifiedUser.name,
          targetDisplayId: verifiedUser.displayId,
          amount: amountToTransfer,
          newTargetCoins: targetNewCoins,
          remainingAgentBalance: data.newAgentBalance,
          timestamp: new Date().toISOString(),
        });

        // Add to local transactions
        if (data.transaction) {
          setTransactions((prev) => [data.transaction, ...prev]);
        }

        if (isRechargingSelf) {
          showToast(
            isAr
              ? `تم شحن ${amountToTransfer.toLocaleString()} كوينز 🪙 لحسابك الشخصي بنجاح!`
              : `Recharged ${amountToTransfer} coins to personal account!`
          );
        } else {
          showToast(
            isAr
              ? `تم شحن ${amountToTransfer.toLocaleString()} كوينز 🪙 بنجاح للمستخدم!`
              : `Successfully recharged ${amountToTransfer} Coins to user!`
          );
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 w-full h-full min-h-screen bg-neutral-100 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col overflow-hidden animate-in fade-in duration-200">
      {/* Toast Alert - وسط الشاشة */}
      {toastMessage && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] px-6 py-4 rounded-3xl bg-neutral-950/95 dark:bg-neutral-900/95 text-white font-black text-xs sm:text-sm shadow-2xl border-2 border-amber-400 shadow-amber-500/30 backdrop-blur-xl flex items-center justify-center gap-2.5 text-center max-w-[90vw] animate-in fade-in zoom-in-95 duration-200 pointer-events-none">
          <Sparkles className="w-5 h-5 shrink-0 text-amber-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ========================================================
          FULL SCREEN HEADER BAR
          ======================================================== */}
      <header className="sticky top-0 z-30 px-4 sm:px-8 py-3.5 border-b border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          {/* Back button to return to app */}
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 text-xs sm:text-sm font-bold transition-all cursor-pointer"
            title={isAr ? 'العودة' : 'Back'}
          >
            {isAr ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
            <span>{isAr ? 'العودة' : 'Back'}</span>
          </button>

          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-neutral-950 flex items-center justify-center font-bold shadow-sm">
            <Building2 className="w-5 h-5 stroke-[2.2]" />
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm sm:text-base font-black text-neutral-900 dark:text-white">
                {isAr ? 'لوحة تحكم وكالة الشحن' : 'Recharge Agency Dashboard'}
              </h1>
              {/* شارة رقم القريد (Grid ID) */}
              <button
                type="button"
                onClick={handleCopyGridCode}
                title={isAr ? 'اضغط لنسخ رقم القريد' : 'Click to copy Grid ID'}
                className="px-2.5 py-0.5 rounded-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-[11px] font-mono font-bold flex items-center gap-1 transition-all cursor-pointer group"
              >
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>{isAr ? 'قريد:' : 'GRID:'} {agent.gridCode || 'A8838'}</span>
                {copiedGrid ? (
                  <Check className="w-3 h-3 text-emerald-500" />
                ) : (
                  <Copy className="w-3 h-3 text-amber-500/70 group-hover:text-amber-500" />
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

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refreshAgencyData}
            title={isAr ? 'تحديث رصيد وبيانات الوكالة' : 'Refresh Agency Data'}
            className="p-2 sm:px-3 sm:py-2 rounded-xl text-neutral-600 dark:text-neutral-300 hover:text-amber-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">{isAr ? 'تحديث' : 'Refresh'}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            title={isAr ? 'إغلاق' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ========================================================
          FULL SCREEN BODY (SCROLLABLE)
          ======================================================== */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto w-full p-4 sm:p-6 md:p-8 space-y-6 pb-24">
          {/* 1. SEPARATE BALANCES DASHBOARD */}
          <div className="space-y-3">
            {/* Card A: رصيد وكالة الشحن (Coins فقط، بفاصلتين عشريتين وبدون أي قيمة تقديرية) */}
            <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-neutral-900 via-neutral-950 to-neutral-900 text-white border-2 border-amber-500/40 shadow-xl relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-44 h-44 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
              <div className="relative z-10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                    <Coins className="w-4 h-4 text-amber-400" />
                    <span>{isAr ? 'رصيد وكالة الشحن (Coins)' : 'Charging Agency Coins Balance'}</span>
                  </div>
                  {/* Grid ID badge */}
                  <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-[11px] font-mono text-amber-300 font-bold">
                    <span>{isAr ? 'قريد:' : 'GRID:'} {agent.gridCode || 'A8838'}</span>
                  </div>
                </div>

                {/* رصيد الكوينز بفاصلتين عشريتين */}
                <div className="text-3xl sm:text-4xl font-black text-amber-400 font-mono tracking-tight flex items-center gap-2 flex-wrap">
                  <span>{formatAgencyCoins(agent.balance || 0)}</span>
                  <span className="text-xs sm:text-sm font-sans font-bold text-neutral-300 inline-flex items-center gap-1">
                    <CoinIcon className="w-5 h-5 text-amber-400" />
                    <span>{isAr ? 'كوينز' : 'Coins'}</span>
                  </span>
                </div>

                <p className="text-xs text-neutral-400 leading-relaxed">
                  {isAr
                    ? 'مخصص حصرياً لعمليات شحن الكوينز للمستخدمين، وتضاف إليه الكوينز بعد خصم 2.5% عند سحب المستخدمين للماسات.'
                    : 'Dedicated exclusively for user coin top-ups and receiving diamond cashouts (after 2.5% fee).'}
                </p>
              </div>
            </div>

            {/* شريط تأكيد نظام رصيد الوكالة */}
            <div className="p-3.5 rounded-2xl bg-amber-500/10 dark:bg-amber-950/30 border border-amber-500/30 flex items-center gap-3 text-xs text-neutral-800 dark:text-amber-200">
              <ShieldCheck className="w-5 h-5 text-amber-500 shrink-0" />
              <div className="leading-relaxed">
                <span className="font-bold text-amber-600 dark:text-amber-400">
                  {isAr ? 'نظام رصيد الوكالة: ' : 'Agency Balance System: '}
                </span>
                <span>
                  {isAr
                    ? 'رصيد وكالة الشحن يعمل بعملة الكوينز (Coins) فقط ويشحن للمستخدمين كوينز حصراً.'
                    : 'Agency balance operates strictly in Coins and top-ups users with coins only.'}
                </span>
              </div>
            </div>
          </div>

          {/* 2. NAVIGATION TABS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1.5 rounded-2xl bg-neutral-200/70 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs">
            {/* Tab 1: شحن كوينز لمستخدم */}
            <button
              type="button"
              onClick={() => setActiveTab('recharge')}
              className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'recharge'
                  ? 'bg-amber-400 text-neutral-950 shadow-sm font-black'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <Send className="w-4 h-4" />
              <span>{isAr ? 'شحن كوينز لمستخدم' : 'Recharge Coins'}</span>
            </button>

            {/* Tab 2: سحوبات المستخدمين */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('withdraw');
                fetchWithdrawRequests();
              }}
              className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'withdraw'
                  ? 'bg-amber-400 text-neutral-950 shadow-sm font-black'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>{isAr ? 'سحوبات المستخدمين' : 'User Cashouts'}</span>
              {withdrawRequests.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-neutral-950/20 font-mono font-bold">
                  {withdrawRequests.length}
                </span>
              )}
            </button>

            {/* Tab 3: إشعارات الوكالة */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('notifications');
                fetchAgencyNotifications();
                if (unreadNotificationsCount > 0) {
                  handleMarkNotificationsRead();
                }
              }}
              className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 relative ${
                activeTab === 'notifications'
                  ? 'bg-amber-400 text-neutral-950 shadow-sm font-black'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <Bell className="w-4 h-4" />
              <span>{isAr ? 'إشعارات الوكالة' : 'Notifications'}</span>
              {unreadNotificationsCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-500 text-white font-mono font-bold animate-pulse">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>

            {/* Tab 4: سجل العمليات */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('history');
                fetchTransactions();
              }}
              className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'history'
                  ? 'bg-amber-400 text-neutral-950 shadow-sm font-black'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <History className="w-4 h-4" />
              <span>{isAr ? 'سجل العمليات' : 'History'}</span>
            </button>
          </div>

          {/* ========================================================
              TAB 1 CONTENT: شحن كوينز لمستخدم فقط
              ======================================================== */}
          {activeTab === 'recharge' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              {/* Receipt Overlay if just completed */}
              {rechargeReceipt && (
                <div className="p-6 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 text-neutral-900 dark:text-white space-y-4 animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-black text-sm sm:text-base">
                      <CheckCircle2 className="w-5 h-5" />
                      <span>{isAr ? 'تم شحن الكوينز بنجاح!' : 'Coins Recharge Completed!'}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRechargeReceipt(null)}
                      className="p-1 rounded-lg text-neutral-400 hover:text-neutral-900 dark:hover:text-white cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-emerald-500/20 shadow-sm">
                    <div>
                      <span className="text-neutral-400 block text-[11px]">{isAr ? 'المستلم' : 'Recipient'}</span>
                      <span className="font-bold text-neutral-900 dark:text-white">{rechargeReceipt.targetName}</span>
                    </div>
                    <div>
                      <span className="text-neutral-400 block text-[11px]">{isAr ? 'معرف الحساب' : 'Account ID'}</span>
                      <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{rechargeReceipt.targetDisplayId}</span>
                    </div>
                    <div>
                      <span className="text-neutral-400 block text-[11px]">{isAr ? 'كمية الكوينز المشحونة' : 'Recharged Coins'}</span>
                      <span className="font-black font-mono text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1 text-sm">
                        <span>+{rechargeReceipt.amount.toLocaleString()}</span>
                        <CoinIcon className="w-4 h-4" />
                        <span>{isAr ? 'كوينز' : 'Coins'}</span>
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-400 block text-[11px]">{isAr ? 'رصيد كوينز الجديد للمستخدم' : 'Recipient Coins Balance'}</span>
                      <span className="font-mono font-bold text-amber-500 inline-flex items-center gap-1">
                        <span>{rechargeReceipt.newTargetCoins.toLocaleString()}</span>
                        <CoinIcon className="w-3.5 h-3.5" />
                      </span>
                    </div>
                    <div className="col-span-2 pt-2 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                      <div>
                        <span className="text-neutral-400 block text-[10px]">{isAr ? 'رقم الإيصال والتوقيت' : 'TxID & Time'}</span>
                        <span className="font-mono text-neutral-500 text-[10px]">{rechargeReceipt.txId}</span>
                        <span className="text-neutral-400 text-[10px] block font-mono">{formatLocalDateTime(rechargeReceipt.timestamp, lang)}</span>
                      </div>
                      <div className="text-end">
                        <span className="text-neutral-400 block text-[10px]">{isAr ? 'رصيد الوكالة المتبقي' : 'Remaining Agency Coins'}</span>
                        <span className="font-mono font-bold text-neutral-800 dark:text-neutral-200">
                          {formatAgencyCoins(rechargeReceipt.remainingAgentBalance)} 🪙
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setRechargeReceipt(null);
                      setVerifiedUser(null);
                      setTargetUserIdInput('');
                    }}
                    className="w-full py-3 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold text-xs cursor-pointer transition-colors shadow-sm"
                  >
                    {isAr ? 'إجراء عملية شحن كوينز جديدة' : 'New Coins Recharge'}
                  </button>
                </div>
              )}

              {/* Step 1: Input Account ID */}
              <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-4 shadow-sm">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300">
                    {isAr ? '1. أدخل معرّف حساب المستخدم (Account ID)' : '1. Enter User Account ID'}
                  </label>
                  {currentUser && (
                    <button
                      type="button"
                      onClick={handleQuickFillMyAccount}
                      className="px-3 py-1 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>{isAr ? '⚡ شحن كوينز لحسابي الشخصي من الوكالة' : '⚡ Recharge My Account Coins'}</span>
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
                      className="w-full h-11 pr-10 pl-3.5 rtl:pr-10 rtl:pl-3.5 ltr:pl-10 ltr:pr-3.5 text-xs sm:text-sm font-mono rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleLookupUser()}
                    disabled={isLookingUpUser || !targetUserIdInput.trim()}
                    className="h-11 px-4 sm:px-5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-neutral-950 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-xs"
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
                    <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border-2 border-emerald-500/40 flex items-center justify-between gap-3 shadow-xs">
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={verifiedUser.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'}
                          alt={verifiedUser.name}
                          className="w-12 h-12 rounded-xl object-cover border border-neutral-200 dark:border-neutral-700 shrink-0"
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
                          <p className="text-xs font-mono text-amber-600 dark:text-amber-400 font-bold truncate">
                            ID: {verifiedUser.displayId}
                          </p>
                        </div>
                      </div>

                      {/* رصيد كوينز الحالي للمستخدم المستهدف */}
                      <div className="text-end shrink-0">
                        <span className="text-[10px] text-neutral-400 block">{isAr ? 'رصيد كوينز الحالي' : 'Current Coins'}</span>
                        <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400 inline-flex items-center gap-1">
                          <span>{(verifiedUser.coinsBalance || 0).toLocaleString()}</span>
                          <CoinIcon className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </div>

                    {/* Notice if the verified user is the agent themselves */}
                    {((currentUser?.id && (verifiedUser.id === currentUser.id || verifiedUser.displayId === currentUser.id)) ||
                      (currentUser?.displayId && (verifiedUser.displayId === currentUser.displayId || verifiedUser.id === currentUser.displayId))) && (
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-800 dark:text-amber-300 font-semibold flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                        <span>
                          {isAr
                            ? 'أنت تقوم الآن بنقل كوينز من رصيد وكالتك إلى رصيد حسابك الشخصي المنفصل في المحفظة.'
                            : 'You are transferring coins from your agency balance to your personal coins wallet.'}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Step 2: Choose Recharge Amount (Coins) */}
              <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                    {isAr ? '2. حدد عدد الكوينز (Coins) المراد شحنها للمستخدم' : '2. Select Recharge Coins Amount'}
                  </label>
                  <span className="text-xs text-neutral-400 font-mono flex items-center gap-1">
                    <span>{isAr ? 'المتبقي برصيد الوكالة:' : 'Remaining:'}</span>
                    <span className="font-bold text-amber-600 dark:text-amber-400 inline-flex items-center gap-1">
                      <span>{formatAgencyCoins(Math.max(0, (agent.balance || 0) - (parseFloat(customAmount) || 0)))}</span>
                      <CoinIcon className="w-3.5 h-3.5" />
                    </span>
                  </span>
                </div>

                {/* Quick Presets */}
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                  {QUICK_COIN_AMOUNTS.map((amt) => {
                    const isSelected = (parseInt(customAmount, 10) || rechargeAmount) === amt;
                    return (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => {
                          setRechargeAmount(amt);
                          setCustomAmount(amt.toString());
                        }}
                        className={`py-2 px-1 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer border flex flex-col items-center justify-center gap-0.5 ${
                          isSelected
                            ? 'bg-amber-400 text-neutral-950 border-amber-400 shadow-sm scale-102 font-black'
                            : 'bg-neutral-50 dark:bg-neutral-950 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:border-amber-500/50'
                        }`}
                      >
                        <span>{amt.toLocaleString()}</span>
                        <span className="text-[10px] opacity-75">{isAr ? 'كوينز' : 'Coins'}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Custom Amount Input */}
                <div className="relative">
                  <input
                    type="number"
                    min="10"
                    max={agent.balance || 500000}
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    placeholder={isAr ? 'أو اكتب قيمة كوينز مخصصة...' : 'Or enter custom coin amount...'}
                    className="w-full h-11 px-4 text-xs sm:text-sm font-mono font-bold rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:border-amber-500"
                  />
                  <span className="absolute left-3 rtl:left-3 rtl:right-auto ltr:right-3 ltr:left-auto top-1/2 -translate-y-1/2 text-xs font-bold text-amber-500 inline-flex items-center gap-1">
                    <CoinIcon className="w-3.5 h-3.5" />
                    <span>{isAr ? 'كوينز' : 'Coins'}</span>
                  </span>
                </div>
              </div>

              {/* Step 3: Big Execution Button */}
              <button
                type="button"
                disabled={
                  !verifiedUser ||
                  isSubmittingRecharge ||
                  (parseInt(customAmount, 10) || 0) <= 0 ||
                  (agent.balance || 0) < (parseInt(customAmount, 10) || 0)
                }
                onClick={handleExecuteRecharge}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 disabled:opacity-50 text-neutral-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg transition-all active:scale-98 cursor-pointer"
              >
                {isSubmittingRecharge ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{isAr ? 'جاري شحن الكوينز للمستخدم...' : 'Processing User Recharge...'}</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 stroke-[2.5]" />
                    <span className="inline-flex items-center gap-1.5">
                      <span>
                        {isAr
                          ? `تأكيد شحن ${(parseInt(customAmount, 10) || 0).toLocaleString()} كوينز`
                          : `Confirm Recharge ${(parseInt(customAmount, 10) || 0).toLocaleString()} Coins`}
                      </span>
                      <CoinIcon className="w-4 h-4" />
                      <span>{isAr ? `لحساب (${verifiedUser?.displayId || '—'})` : `to (${verifiedUser?.displayId || '—'})`}</span>
                    </span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* ========================================================
              TAB 2 CONTENT: سحوبات المستخدمين الواردة عبر الوكالة
              ======================================================== */}
          {activeTab === 'withdraw' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* ترويسة توضيحية لنظام سحب المستخدمين والتحويل لكوينز الوكالة */}
              <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-sm sm:text-base font-black text-neutral-900 dark:text-white flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-amber-500" />
                    <span>{isAr ? 'سحوبات الماسات من قبل المستخدمين عبر وكالتك' : 'Incoming Diamond Cashouts via Agency'}</span>
                  </h3>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 font-mono font-bold">
                    {withdrawRequests.length} {isAr ? 'سحب' : 'cashouts'}
                  </span>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  {isAr
                    ? 'عندما يسحب أي مستخدم ألماساً باختيار وكالتك، يتم تحويل المبلغ إلى كوينز بسعر (1 ماسة = 0.625 كوينز) مع خصم 2.5% وإضافته فوراً لرصيدك. يظهر أدناه المبلغ المطلوب تسليمه للمستخدم بالدولار.'
                    : 'When users cash out diamonds, coins are credited at rate 1 Diamond = 0.625 Coins after 2.5% fee deduction. The required USD amount to pay the user is shown below.'}
                </p>
              </div>

              {/* List of user cashouts */}
              {isLoadingWithdraws ? (
                <div className="py-12 text-center text-xs text-neutral-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                  <span>{isAr ? 'جاري جلب سحوبات المستخدمين...' : 'Loading cashouts...'}</span>
                </div>
              ) : withdrawRequests.length === 0 ? (
                <div className="py-14 text-center space-y-2 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 shadow-sm">
                  <CreditCard className="w-8 h-8 text-neutral-400 mx-auto" />
                  <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
                    {isAr ? 'لا توجد سحوبات مستخدمين مسجلة بعد' : 'No user cashouts yet'}
                  </p>
                  <p className="text-xs text-neutral-400 max-w-md mx-auto">
                    {isAr
                      ? `عندما يسحب أي مستخدم ماسات باختيار رقم قريدك [${agent.gridCode || 'A8838'}]، ستظهر تفاصيل العملية هنا وتضاف الكوينز فوراً لرصيدك.`
                      : 'When users withdraw diamonds using your agency grid, the record will show here.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {withdrawRequests.map((req) => {
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

                    return (
                      <div
                        key={req.id}
                        className="p-4 sm:p-5 rounded-2xl border shadow-xs bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-2 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-400 font-mono font-black text-xs">
                              {isAr ? 'طلب:' : 'Order:'} {orderNum}
                            </span>

                            <span className="font-mono font-black text-sm text-neutral-900 dark:text-white inline-flex items-center gap-1">
                              <span>{grossDiamonds.toLocaleString()}</span>
                              <DiamondIcon className="w-3.5 h-3.5 text-cyan-400" />
                              <span className="text-xs text-neutral-400 font-normal">{isAr ? 'ماسة (مبلغ السحب)' : 'Diamonds'}</span>
                            </span>

                            {req.method && (
                              <span className="text-[10px] px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-medium font-mono">
                                {req.method}
                              </span>
                            )}
                          </div>

                          <div className="text-xs space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-neutral-500">{isAr ? 'المستخدم:' : 'User:'}</span>
                              <strong className="text-neutral-900 dark:text-white font-bold">{req.userName || 'مستخدم Soul-X'}</strong>
                              <span className="font-mono text-[11px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 font-bold">
                                ID: {req.userDisplayId || req.userId || '—'}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap text-emerald-600 dark:text-emerald-400 font-bold">
                              <span>{isAr ? 'المبلغ المطلوب للمستخدم بالدولار:' : 'Required USD to User:'}</span>
                              <span className="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400">
                                ${requiredUsd.toFixed(2)} USD
                              </span>
                              <span className="text-[10px] font-mono text-neutral-400 font-normal">
                                ({isAr ? 'بعد خصم 2.5%' : 'after 2.5% fee'})
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-mono font-bold">
                              <span>{isAr ? 'الكوينز المضافة لوكالتك: +' : 'Coins Credited to Agency: +'}</span>
                              <span>{formatAgencyCoins(netCoinsCredited)}</span>
                              <CoinIcon className="w-3.5 h-3.5" />
                              <span className="text-[10px] text-neutral-400 font-sans font-normal">
                                ({isAr ? 'بعد تحويلها لكوينز وخصم 2.5%' : 'after 2.5% fee'})
                              </span>
                            </div>
                          </div>

                          {req.accountDetails && (
                            <p className="text-xs font-mono text-neutral-500 dark:text-neutral-400 truncate max-w-md">
                              {req.accountDetails}
                            </p>
                          )}

                          <span className="text-[10px] text-neutral-400 block font-mono">
                            {formatLocalDateTime(req.createdAt, lang)}
                          </span>
                        </div>

                        {/* Status Badge */}
                        <div className="shrink-0 self-start sm:self-center">
                          <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-500/30 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{isAr ? 'أُضيفت الكوينز لرصيدك ✓' : 'Coins Credited ✓'}</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ========================================================
              TAB 3 CONTENT: إشعارات الوكالة (سحوبات المستخدمين فقط مع البحث)
              ======================================================== */}
          {activeTab === 'notifications' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between text-xs font-bold text-neutral-600 dark:text-neutral-400 px-1">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-amber-500" />
                  <span>{isAr ? 'إشعارات سحوبات المستخدمين (إيداع كوينز للوكالة)' : 'Incoming User Cashout Notifications'}</span>
                </div>
                {unreadNotificationsCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkNotificationsRead}
                    className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline cursor-pointer font-bold"
                  >
                    {isAr ? 'تحديد الكل كمقروء' : 'Mark all read'}
                  </button>
                )}
              </div>

              {/* شريط البحث في إشعارات السحب */}
              <div className="relative">
                <Search className="w-4 h-4 text-neutral-400 absolute right-3.5 top-1/2 -translate-y-1/2 rtl:right-3.5 rtl:left-auto ltr:left-3.5 ltr:right-auto pointer-events-none" />
                <input
                  type="text"
                  value={notificationsSearch}
                  onChange={(e) => setNotificationsSearch(e.target.value)}
                  placeholder={
                    isAr
                      ? 'ابحث في إشعارات السحب (اسم المستخدم، معرف الحساب، رقم الطلب الفريد)...'
                      : 'Search cashout notifications (user name, ID, unique order #)...'
                  }
                  className="w-full h-11 pr-10 pl-9 rtl:pr-10 rtl:pl-9 ltr:pl-10 ltr:pr-9 text-xs sm:text-sm rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:border-amber-500 shadow-xs"
                />
                {notificationsSearch && (
                  <button
                    type="button"
                    onClick={() => setNotificationsSearch('')}
                    className="absolute left-3 rtl:left-3 rtl:right-auto ltr:right-3 ltr:left-auto top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer p-1"
                    title={isAr ? 'مسح البحث' : 'Clear search'}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {isLoadingNotifications ? (
                <div className="py-12 text-center text-xs text-neutral-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                  <span>{isAr ? 'جاري تحميل إشعارات الوكالة...' : 'Loading notifications...'}</span>
                </div>
              ) : agencyNotifications.length === 0 ? (
                <div className="py-14 text-center space-y-2 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 shadow-sm">
                  <Bell className="w-8 h-8 text-neutral-400 mx-auto" />
                  <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
                    {isAr ? 'لا توجد إشعارات سحب واردة حالياً في الوكالة' : 'No cashout notifications yet'}
                  </p>
                  <p className="text-xs text-neutral-400 max-w-sm mx-auto leading-relaxed">
                    {isAr
                      ? 'عندما يسحب أي مستخدم ألماساً باختيار وكالتك، سيصلك إشعار فوري هنا مع تفاصيل المستخدم، مبلغ السحب، المبلغ المطلوب للمستخدم بالدولار، ورقم الطلب الفريد.'
                      : 'When users withdraw diamonds, notifications with user details, amount, required USD, and unique order number will appear here.'}
                  </p>
                </div>
              ) : (() => {
                const searchQ = notificationsSearch.trim().toLowerCase();
                const filtered = agencyNotifications.filter((notif) => {
                  // الوكيل يستلم إشعار فقط في سحوبات المستخدمين
                  const isUserWdr = notif.type === 'incoming_user_withdrawal' || notif.type === 'user_withdrawal';
                  if (!isUserWdr) return false;

                  if (!searchQ) return true;
                  const uName = (notif.userName || '').toLowerCase();
                  const uId = (notif.userDisplayId || notif.userId || '').toLowerCase();
                  const oNum = (notif.orderNumber || notif.orderId || notif.id || '').toLowerCase();
                  const gAmt = String(notif.grossAmount || '');
                  const nCoins = String(notif.netAmount || '');
                  const nUsd = String(notif.netUsdAmount || '');
                  return (
                    uName.includes(searchQ) ||
                    uId.includes(searchQ) ||
                    oNum.includes(searchQ) ||
                    gAmt.includes(searchQ) ||
                    nCoins.includes(searchQ) ||
                    nUsd.includes(searchQ)
                  );
                });

                if (filtered.length === 0) {
                  return (
                    <div className="py-10 text-center space-y-2 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 shadow-sm">
                      <Search className="w-7 h-7 text-neutral-400 mx-auto" />
                      <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
                        {isAr ? 'لا توجد إشعارات سحب مطابقة لبحثك' : 'No matching cashout notifications'}
                      </p>
                      <button
                        type="button"
                        onClick={() => setNotificationsSearch('')}
                        className="text-xs text-amber-600 dark:text-amber-400 font-bold hover:underline cursor-pointer"
                      >
                        {isAr ? 'إعادة ضبط البحث' : 'Reset search'}
                      </button>
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    {filtered.map((notif) => {
                      const grossDiamonds = notif.grossAmount || 0;
                      const orderNum = notif.orderNumber || notif.orderId || notif.id;
                      const grossUsd = notif.usdAmount || (grossDiamonds / 400000) * 10;
                      const requiredUsdToUser =
                        typeof notif.netUsdAmount === 'number'
                          ? notif.netUsdAmount
                          : Math.round((grossUsd * 0.975 + Number.EPSILON) * 100) / 100;
                      const creditedCoins =
                        typeof notif.netAmount === 'number'
                          ? notif.netAmount
                          : Math.round((grossDiamonds * 0.625 * 0.975 + Number.EPSILON) * 100) / 100;

                      return (
                        <div
                          key={notif.id}
                          className={`p-5 rounded-2xl border shadow-xs space-y-3.5 transition-all ${
                            !notif.read
                              ? 'bg-amber-500/5 dark:bg-amber-950/25 border-amber-500/40'
                              : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800'
                          }`}
                        >
                          {/* Notification Header: Unique Order Number + Status + Date */}
                          <div className="flex items-start justify-between gap-2 border-b border-neutral-100 dark:border-neutral-800/80 pb-3">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              {/* شارة رقم الطلب الفريد */}
                              <div className="px-3 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-400 font-mono font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-xs">
                                <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                <span>{isAr ? 'رقم الطلب:' : 'Order:'}</span>
                                <span>{orderNum}</span>
                              </div>

                              {!notif.read && (
                                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-neutral-950 text-[10px] font-black">
                                  {isAr ? 'جديد' : 'NEW'}
                                </span>
                              )}
                            </div>

                            <span className="text-[11px] text-neutral-400 font-mono shrink-0">
                              {formatLocalDateTime(notif.timestamp, lang)}
                            </span>
                          </div>

                          {/* 1. المستخدم */}
                          <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200/60 dark:border-neutral-800/60 flex items-center justify-between gap-3 flex-wrap">
                            <div className="space-y-0.5">
                              <span className="text-[10px] text-neutral-400 block font-semibold">
                                {isAr ? 'المستخدم (صاحب السحب):' : 'User (Cashout Owner):'}
                              </span>
                              <div className="font-bold text-neutral-900 dark:text-white flex items-center gap-2 flex-wrap">
                                <User className="w-4 h-4 text-amber-500 shrink-0" />
                                <span className="text-sm font-black">{notif.userName || 'مستخدم Soul-X'}</span>
                                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-400">
                                  ID: {notif.userDisplayId || notif.userId}
                                </span>
                              </div>
                            </div>

                            <div className="text-end">
                              <span className="text-[10px] text-neutral-400 block font-semibold">{isAr ? 'وكالة السحب:' : 'Agency:'}</span>
                              <span className="font-mono font-bold text-xs text-neutral-700 dark:text-neutral-300">
                                قريد: [{notif.gridCode}]
                              </span>
                            </div>
                          </div>

                          {/* 2. مبلغ السحب والمبلغ المطلوب للمستخدم بالدولار */}
                          <div className="p-4 rounded-xl bg-amber-500/5 dark:bg-amber-950/20 border border-amber-500/25 space-y-2.5">
                            {/* مبلغ السحب بالماسات */}
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-neutral-600 dark:text-neutral-400 font-bold">
                                {isAr ? 'مبلغ السحب (الماسات المسحوبة):' : 'Withdrawal Amount (Diamonds):'}
                              </span>
                              <span className="font-mono font-black text-neutral-900 dark:text-white text-sm inline-flex items-center gap-1">
                                <span>{grossDiamonds.toLocaleString()}</span>
                                <DiamondIcon className="w-4 h-4 text-cyan-400" />
                                <span className="text-xs font-sans text-neutral-400 font-normal">({isAr ? 'ماسة' : 'Diamonds'})</span>
                              </span>
                            </div>

                            {/* المبلغ المطلوب للمستخدم بالدولار */}
                            <div className="flex items-center justify-between text-xs pt-2 border-t border-amber-500/20">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-black text-emerald-700 dark:text-emerald-400 text-xs sm:text-sm">
                                  {isAr ? 'المبلغ المطلوب للمستخدم بالدولار:' : 'Amount Required to User in USD:'}
                                </span>
                                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold">
                                  {isAr ? 'بعد خصم 2.5%' : 'after 2.5% fee'}
                                </span>
                              </div>
                              <span className="font-mono font-black text-sm sm:text-base text-emerald-600 dark:text-emerald-400">
                                ${requiredUsdToUser.toFixed(2)} USD
                              </span>
                            </div>

                            {/* الكوينز المضافة لرصيد الوكالة بعد تحويلها لـ coins وخصم 2.5% */}
                            <div className="flex items-center justify-between text-xs pt-2 border-t border-dashed border-amber-500/20 font-mono">
                              <span className="text-neutral-500 dark:text-neutral-400">
                                {isAr ? 'الكوينز المضافة لرصيد وكالتك فوراً:' : 'Coins Credited to Agency:'}
                              </span>
                              <span className="font-black text-amber-500 inline-flex items-center gap-1 text-xs sm:text-sm">
                                <span>+{formatAgencyCoins(creditedCoins)}</span>
                                <CoinIcon className="w-4 h-4" />
                                <span className="text-[11px] font-sans font-bold">{isAr ? 'كوينز' : 'Coins'}</span>
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-emerald-600 dark:text-emerald-400 font-medium pt-0.5">
                            <span className="flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              <span>{isAr ? 'تم تحويل المبلغ إلى كوينز وخصم 2.5% وإضافته بنجاح.' : 'Converted to coins with 2.5% fee deducted.'}</span>
                            </span>
                            <span className="font-mono text-[10px] text-neutral-400">
                              1 💎 = 0.625 🪙 (-2.5%)
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ========================================================
              TAB 4 CONTENT: سجل عمليات الشحن المنفذة
              ======================================================== */}
          {activeTab === 'history' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between text-xs font-bold text-neutral-600 dark:text-neutral-400 px-1">
                <span>{isAr ? 'سجل عمليات شحن الكوينز للمستخدمين' : 'Coins Top-Up Operations'}</span>
                <span className="font-mono">{transactions.length} {isAr ? 'عملية' : 'transactions'}</span>
              </div>

              {isLoadingTx ? (
                <div className="py-12 text-center text-xs text-neutral-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                  <span>{isAr ? 'جاري تحميل السجل...' : 'Loading history...'}</span>
                </div>
              ) : transactions.length === 0 ? (
                <div className="py-14 text-center space-y-2 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 shadow-sm">
                  <Receipt className="w-8 h-8 text-neutral-400 mx-auto" />
                  <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
                    {isAr ? 'لم تنفذ هذه الوكالة أي عمليات شحن كوينز للمستخدمين بعد' : 'No recharge transactions recorded yet'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {transactions.map((tx) => {
                    const isUserWithdrawal = tx.type === 'user_withdrawal';

                    return (
                      <div
                        key={tx.id}
                        className="p-4 sm:p-5 rounded-2xl border shadow-xs bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {isUserWithdrawal ? (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] flex items-center gap-1">
                                <span>📥</span>
                                <span>{isAr ? 'سحب مستخدم عبر وكالتك (إيداع كوينز)' : 'User Cashout via Agency (Credit)'}</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-400 font-bold text-[10px] flex items-center gap-1">
                                <span>📤</span>
                                <span>{isAr ? 'شحن كوينز لمستخدم' : 'User Coins Top-Up'}</span>
                              </span>
                            )}

                            <h4 className="text-xs sm:text-sm font-bold text-neutral-900 dark:text-white truncate">
                              {tx.targetUserName}
                            </h4>
                            <span className="text-[10px] font-mono px-2 py-0.2 rounded-md bg-neutral-100 dark:bg-neutral-800 text-amber-600 dark:text-amber-400 font-bold">
                              {tx.targetUserDisplayId || tx.targetUserId}
                            </span>
                          </div>

                          {isUserWithdrawal && (
                            <div className="text-[11px] text-neutral-600 dark:text-neutral-300 font-mono flex items-center gap-2 flex-wrap">
                              <span className="inline-flex items-center gap-1">
                                <span>{isAr ? 'الماسات المسحوبة:' : 'Gross:'}</span>
                                <strong>{(tx.grossAmount || tx.amount).toLocaleString()}</strong>
                                <DiamondIcon className="w-3 h-3 text-cyan-400" />
                              </span>
                              <span className="text-neutral-400">
                                (1 Diamond = 0.625 Coins)
                              </span>
                            </div>
                          )}

                          <span className="text-[10px] text-neutral-400 font-mono block">
                            {tx.id} • {formatLocalDateTime(tx.timestamp, lang)}
                          </span>
                        </div>

                        <div className="text-end shrink-0 self-start sm:self-center">
                          <span
                            className={`text-sm font-black font-mono flex items-center justify-end gap-1 ${
                              isUserWithdrawal ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            <span>{isUserWithdrawal ? `+${formatAgencyCoins(tx.amount)}` : `-${tx.amount.toLocaleString()}`}</span>
                            <CoinIcon className="w-3.5 h-3.5" />
                          </span>
                          <span className="text-[10px] text-emerald-500 dark:text-emerald-400 font-mono block font-bold mt-0.5">
                            {isUserWithdrawal
                              ? isAr
                                ? 'أُضيفت الكوينز لرصيدك ✓'
                                : 'Coins Credited ✓'
                              : isAr
                              ? 'تم الشحن بنجاح ✓'
                              : 'Recharged ✓'}
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
