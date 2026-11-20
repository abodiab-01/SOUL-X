import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Users,
  Bot,
  Activity,
  ArrowRight,
  ArrowLeft,
  Trash2,
  Pencil,
  Lock,
  RefreshCw,
  Search,
  CheckCircle2,
  X,
  AlertTriangle,
  Globe,
  Calendar,
  User as UserIcon,
  Sparkles,
  KeyRound,
  Wallet,
  PlusCircle,
  Building2,
  BadgeCheck,
  Send,
  MessageCircle,
  MinusCircle,
  Coins,
  DollarSign,
  Filter,
  Copy,
  Check,
  FileCode,
  Radio,
  Megaphone,
  Bell,
  Mail,
  Volume2,
  ShieldCheck,
  Bug,
  Lightbulb,
  MessageSquarePlus,
  LifeBuoy,
  Clock,
  ExternalLink,
  Flag,
  Snowflake,
  Ban,
  Unlock,
  UserCheck,
  Eye,
  EyeOff,
  Wand2,
  UserCog,
  Gift,
  Link,
  Power,
  ArrowLeftRight,
  Gamepad2,
  ShoppingBag,
  LayoutGrid,
  BarChart3,
  TrendingUp,
  ZoomIn,
  XCircle,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
} from 'lucide-react';
import { Language, AuthUser, AgentRecord, FeedbackReport, PasswordResetRequest, VerificationRequestRecord } from '../types';
import { VerifiedBadge } from './VerifiedBadge';
import { CoinIcon, DiamondIcon } from './CurrencyIcons';
import { formatLocalDate, formatLocalDateTime } from '../lib/dateUtils';
import { WORLD_COUNTRIES } from '../data/countries';
import { formatCountryUnified } from '../lib/countryUtils';
import { AdminGamesAlgorithmControl } from './AdminGamesAlgorithmControl';
import { AdminGoldenTreeControl } from './AdminGoldenTreeControl';

interface AdminPanelViewProps {
  lang: Language;
  currentUser: AuthUser | null;
  adminToken: string;
  onBack: () => void;
  onLock: () => void;
  onLoadingChange?: (loading: boolean) => void;
}

interface AdminStats {
  registeredUsersCount: number;
  totalUsersBalance?: number;
  friendshipsCount?: number;
  conversationsCount?: number;
  admins: string[];
  botConfigured: boolean;
  botPublicUrl: string | null;
  isTunnelActive: boolean;
  uptimeSeconds: number;
  serverTime: string;
}

interface AdminUserRecord {
  id: string;
  displayId?: string;
  name: string;
  email: string;
  createdAt: string;
  birthDate: string | null;
  gender: 'male' | 'female' | null;
  photoUrl: string | null;
  country?: string | null;
  walletBalance?: number;
  coinsBalance?: number;
  bio?: string | null;
  twoFactorEnabled?: boolean;
  reportsCount?: number;
  isBanned?: boolean;
  bannedAt?: string | null;
  banReason?: string | null;
  isFrozen?: boolean;
  frozenAt?: string | null;
  freezeDurationMinutes?: number | null;
  freezeExpiresAt?: string | null;
  freezeReason?: string | null;
  freezeRemainingMs?: number | null;
  isVerified?: boolean;
}

export const AdminPanelView: React.FC<AdminPanelViewProps> = ({
  lang,
  currentUser,
  adminToken,
  onBack,
  onLock,
  onLoadingChange,
}) => {
  const isAr = lang === 'ar';
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Active top navigation tab
  const [activeTab, setActiveTab] = useState<'stats' | 'users' | 'verifications' | 'restrictions' | 'agents' | 'broadcast' | 'feedback' | 'passwordResets' | 'bot' | 'games' | 'sections'>('stats');

  // Account Verification Requests State (طلبات توثيق الحسابات بالشارة الزرقاء)
  const [verificationRequests, setVerificationRequests] = useState<VerificationRequestRecord[]>([]);
  const [isLoadingVerifications, setIsLoadingVerifications] = useState(false);
  const [verificationsFilter, setVerificationsFilter] = useState<'pending' | 'all' | 'approved' | 'rejected'>('pending');
  const [verificationsSearch, setVerificationsSearch] = useState('');
  const [processingVerifId, setProcessingVerifId] = useState<string | null>(null);
  const [deletingVerifId, setDeletingVerifId] = useState<string | null>(null);
  const [confirmDeleteVerifId, setConfirmDeleteVerifId] = useState<string | null>(null);
  const [rejectModalRequest, setRejectModalRequest] = useState<VerificationRequestRecord | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState('');
  const [previewVerifImage, setPreviewVerifImage] = useState<{ url: string; label: string } | null>(null);
  const [togglingVerifyUserId, setTogglingVerifyUserId] = useState<string | null>(null);

  // Restrictions Tab Quick Action States
  const [quickRestrictSearch, setQuickRestrictSearch] = useState('');
  const [quickRestrictUser, setQuickRestrictUser] = useState<AdminUserRecord | null>(null);
  const [quickRestrictType, setQuickRestrictType] = useState<'freeze' | 'ban'>('freeze');
  const [quickFreezeMinutes, setQuickFreezeMinutes] = useState('60');
  const [quickRestrictReason, setQuickRestrictReason] = useState('');
  const [isSubmittingQuickAction, setIsSubmittingQuickAction] = useState(false);
  const [showGoldenTreeAdvanced, setShowGoldenTreeAdvanced] = useState(false);

  // -----------------------------------------------------------------
  // Password Reset Requests (طلبات استعادة كلمة المرور - الموقع وتيليجرام)
  // -----------------------------------------------------------------
  const [passwordResets, setPasswordResets] = useState<PasswordResetRequest[]>([]);
  const [isLoadingPasswordResets, setIsLoadingPasswordResets] = useState(false);
  const [passwordResetsSourceFilter, setPasswordResetsSourceFilter] = useState<'all' | 'web' | 'telegram'>('all');
  const [passwordResetsSearch, setPasswordResetsSearch] = useState('');
  const [deletingResetId, setDeletingResetId] = useState<string | null>(null);

  const [clearConfirmTarget, setClearConfirmTarget] = useState<'feedback' | 'passwordResets' | null>(null);
  const [isClearingSection, setIsClearingSection] = useState(false);

  // -----------------------------------------------------------------
  // Feedback & Bug Reports Management State (البلاغات والاقتراحات)
  // -----------------------------------------------------------------
  const [feedbackReports, setFeedbackReports] = useState<FeedbackReport[]>([]);
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);
  const [feedbackFilterType, setFeedbackFilterType] = useState<'all' | 'bug' | 'suggestion' | 'feedback' | 'user_report'>('all');
  const [feedbackSearch, setFeedbackSearch] = useState('');
  const [deletingReportId, setDeletingReportId] = useState<string | null>(null);

  // User Reports Inspection Modal state & filter in User Management
  const [filterReportedUsersOnly, setFilterReportedUsersOnly] = useState(false);
  const [userReportsModalData, setUserReportsModalData] = useState<{
    user: AdminUserRecord;
    reports: FeedbackReport[];
  } | null>(null);
  const [isLoadingUserReportsModal, setIsLoadingUserReportsModal] = useState(false);

  // User Freeze & Ban States
  const [freezingUser, setFreezingUser] = useState<AdminUserRecord | null>(null);
  const [freezeMinutesInput, setFreezeMinutesInput] = useState<string>('60');
  const [freezeReasonInput, setFreezeReasonInput] = useState<string>('');
  const [isSubmittingFreeze, setIsSubmittingFreeze] = useState(false);

  const [banningUser, setBanningUser] = useState<AdminUserRecord | null>(null);
  const [banReasonInput, setBanReasonInput] = useState<string>('');
  const [isSubmittingBan, setIsSubmittingBan] = useState(false);

  const [filterUserStatus, setFilterUserStatus] = useState<'all' | 'frozen' | 'banned' | 'reported' | 'verified'>('all');

  // -----------------------------------------------------------------
  // Broadcast & Notifications Management State (إذاعة عامة أو رسائل موجهة)
  // -----------------------------------------------------------------
  const [broadcastTargetType, setBroadcastTargetType] = useState<'all' | 'single'>('all');
  const [broadcastSelectedUser, setBroadcastSelectedUser] = useState<AdminUserRecord | null>(null);
  const [broadcastUserSearch, setBroadcastUserSearch] = useState('');
  const [broadcastTitleAr, setBroadcastTitleAr] = useState('');
  const [broadcastTitleEn, setBroadcastTitleEn] = useState('');
  const [broadcastMessageAr, setBroadcastMessageAr] = useState('');
  const [broadcastMessageEn, setBroadcastMessageEn] = useState('');
  const [broadcastCategory, setBroadcastCategory] = useState<'announcement' | 'warning' | 'alert' | 'system' | 'custom' | 'reward'>('announcement');
  const [broadcastPriority, setBroadcastPriority] = useState<'normal' | 'important' | 'urgent'>('normal');
  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);

  // Quick Direct Notify Modal from User table
  const [directNotifyUser, setDirectNotifyUser] = useState<AdminUserRecord | null>(null);
  const [directNotifyTitleAr, setDirectNotifyTitleAr] = useState('');
  const [directNotifyTitleEn, setDirectNotifyTitleEn] = useState('');
  const [directNotifyMessageAr, setDirectNotifyMessageAr] = useState('');
  const [directNotifyMessageEn, setDirectNotifyMessageEn] = useState('');
  const [directNotifyCategory, setDirectNotifyCategory] = useState<'announcement' | 'warning' | 'alert' | 'system' | 'custom' | 'reward'>('custom');
  const [directNotifyPriority, setDirectNotifyPriority] = useState<'normal' | 'important' | 'urgent'>('normal');
  const [isSendingDirectNotify, setIsSendingDirectNotify] = useState(false);

  // Search & filter states
  const [userSearch, setUserSearch] = useState('');
  const [agentSearch, setAgentSearch] = useState('');
  const [agentCategoryFilter, setAgentCategoryFilter] = useState<'all' | 'recharge' | 'withdraw'>('all');

  // -----------------------------------------------------------------
  // User Management State (تعديل - كلمة المرور - ID الحساب - الرصيد)
  // -----------------------------------------------------------------
  // 1. Edit User Modal (Name, Email, Display ID, Birthdate, Gender)
  const [editingUser, setEditingUser] = useState<AdminUserRecord | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editDisplayId, setEditDisplayId] = useState('');
  const [editBirthDate, setEditBirthDate] = useState('');
  const [editGender, setEditGender] = useState<'male' | 'female' | null>(null);
  const [editBio, setEditBio] = useState('');
  const [editCountry, setEditCountry] = useState('');
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);
  const [editUserError, setEditUserError] = useState<string | null>(null);

  // Quick Country Change Modal State
  const [countryUser, setCountryUser] = useState<AdminUserRecord | null>(null);
  const [selectedCountry, setSelectedCountry] = useState('');
  const [countrySearchFilter, setCountrySearchFilter] = useState('');
  const [isUpdatingCountry, setIsUpdatingCountry] = useState(false);

  // Default Bio Management State (البايو الافتراضي العام عند بدء التسجيل)
  const [defaultBioInput, setDefaultBioInput] = useState('مرحباً أنا مستخدم جديد في Soul-X و لم أقم بتعيين الوصف حتى الأن');
  const [isSavingDefaultBio, setIsSavingDefaultBio] = useState(false);
  const [applyBioToExisting, setApplyBioToExisting] = useState(false);

  // 2. Change Password Modal
  const [passwordUser, setPasswordUser] = useState<AdminUserRecord | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // 3. User Balance Management Modal (Add, Deduct, or Set for Diamonds and Coins)
  const [balanceUser, setBalanceUser] = useState<AdminUserRecord | null>(null);
  const [userBalanceCurrency, setUserBalanceCurrency] = useState<'diamonds' | 'coins'>('diamonds');
  const [userBalanceAction, setUserBalanceAction] = useState<'add' | 'deduct' | 'set'>('add');
  const [userBalanceAmount, setUserBalanceAmount] = useState<string>('500');
  const [isUpdatingUserBalance, setIsUpdatingUserBalance] = useState(false);

  // 4. Delete user confirmation
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  // Selected User for Account Details & Actions Menu Modal
  const [selectedActionUser, setSelectedActionUser] = useState<AdminUserRecord | null>(null);
  const [copiedActionField, setCopiedActionField] = useState<'id' | 'uuid' | 'email' | null>(null);

  // 5. Two-Factor Authentication (2FA) Admin Management
  const [twoFactorUser, setTwoFactorUser] = useState<AdminUserRecord | null>(null);
  const [twoFactorDetails, setTwoFactorDetails] = useState<{
    twoFactorEnabled: boolean;
    twoFactorSecret: string | null;
    twoFactorBackupCodes: string[];
    twoFactorEnabledAt: string | null;
    qrCodeDataUrl?: string;
  } | null>(null);
  const [isLoading2FA, setIsLoading2FA] = useState(false);
  const [isUpdating2FA, setIsUpdating2FA] = useState(false);
  const [copied2FASecret, setCopied2FASecret] = useState(false);
  const [copied2FABackup, setCopied2FABackup] = useState(false);

  // -----------------------------------------------------------------
  // Agents Management State (إضافة - حذف - تعديل رصيد - تعيين الدولة)
  // -----------------------------------------------------------------
  // 1. Add / Appoint Agent Modal (تعيين وإضافة الوكيل تتم فقط بالأربعة حقول المطلوبة)
  const [isAddAgentModalOpen, setIsAddAgentModalOpen] = useState(false);
  const [agentGridCode, setAgentGridCode] = useState('A8838');
  const [agentEmail, setAgentEmail] = useState('');
  const [agentName, setAgentName] = useState('');
  const [agentCountry, setAgentCountry] = useState('');
  const [isCreatingAgent, setIsCreatingAgent] = useState(false);

  // 2. Edit Agent Modal
  const [editingAgent, setEditingAgent] = useState<AgentRecord | null>(null);
  const [isUpdatingAgent, setIsUpdatingAgent] = useState(false);

  // 3. Agent Balance Modal (تعديل رصيد الوكيل)
  const [balanceAgent, setBalanceAgent] = useState<AgentRecord | null>(null);
  const [agentBalanceAction, setAgentBalanceAction] = useState<'add' | 'deduct' | 'set'>('add');
  const [agentBalanceAmount, setAgentBalanceAmount] = useState<string>('5000');
  const [isUpdatingAgentBalance, setIsUpdatingAgentBalance] = useState(false);

  // 4. Delete agent confirmation
  const [deletingAgentId, setDeletingAgentId] = useState<string | null>(null);
  const [deletingAgent, setDeletingAgent] = useState<AgentRecord | null>(null);
  const [isDeletingAgent, setIsDeletingAgent] = useState(false);

  // -----------------------------------------------------------------
  // Telegram Bot Referrals State (إعدادات وإحصائيات نظام الإحالات في البوت)
  // -----------------------------------------------------------------
  const [botRefEnabled, setBotRefEnabled] = useState<boolean>(true);
  const [botRefNewUserBonus, setBotRefNewUserBonus] = useState<string>('0.10');
  const [botRefReferrerBonus, setBotRefReferrerBonus] = useState<string>('0.50');
  const [botRefCoinsPerDollar, setBotRefCoinsPerDollar] = useState<string>('25000');
  const [botRefStats, setBotRefStats] = useState<{
    totalBotUsers: number;
    totalReferrals: number;
    totalBalanceUsd: number;
    totalEarnedUsd: number;
    totalTransferredUsd: number;
    totalTransferredCoins: number;
    transfersCount: number;
    eventsCount: number;
  } | null>(null);
  const [botRefUsers, setBotRefUsers] = useState<any[]>([]);
  const [botRefTransfers, setBotRefTransfers] = useState<any[]>([]);
  const [isLoadingBotReferrals, setIsLoadingBotReferrals] = useState(false);
  const [isSavingBotReferrals, setIsSavingBotReferrals] = useState(false);

  // -----------------------------------------------------------------
  // Games Algorithm Refresh Signal
  // -----------------------------------------------------------------
  const [gamesRefreshSignal, setGamesRefreshSignal] = useState<number>(0);

  // -----------------------------------------------------------------
  // App Sections Toggle State (تفعيل وتعطيل قسم المتجر وقسم الألعاب)
  // -----------------------------------------------------------------
  const [gamesSectionEnabled, setGamesSectionEnabled] = useState<boolean>(true);
  const [storeSectionEnabled, setStoreSectionEnabled] = useState<boolean>(true);
  const [isLoadingSections, setIsLoadingSections] = useState<boolean>(false);
  const [togglingSectionTarget, setTogglingSectionTarget] = useState<'games' | 'store' | null>(null);

  // Toast feedback
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 3500);
  };

  // Helper for admin headers to ensure authentication works seamlessly with session tokens, stored auth, and PINs
  const getAdminHeaders = () => {
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const sessionAdminToken = adminToken || (typeof window !== 'undefined' ? sessionStorage.getItem('soulx_admin_token') : null);
    const userAuthToken = typeof window !== 'undefined' ? localStorage.getItem('soulx_auth_token') : null;
    const effectiveToken = sessionAdminToken || userAuthToken || '';

    if (effectiveToken) {
      h['Authorization'] = `Bearer ${effectiveToken}`;
    }
    if (sessionAdminToken) {
      h['x-admin-pin'] = sessionAdminToken;
    }
    if (currentUser?.email) {
      h['x-admin-email'] = currentUser.email;
    }
    return h;
  };

  // Fetch all admin data
  const fetchData = async () => {
    setIsLoading(true);
    onLoadingChange?.(true);
    try {
      const headers = getAdminHeaders();

      const [statsRes, usersRes, agentsRes, bioRes] = await Promise.all([
        fetch('/api/admin/stats', { headers }),
        fetch('/api/admin/users', { headers }),
        fetch('/api/admin/agents', { headers }),
        fetch('/api/settings/default-bio').catch(() => null),
      ]);

      if (statsRes.status === 403 || usersRes.status === 403) {
        onLock();
        return;
      }

      const statsData = await statsRes.json();
      const usersData = await usersRes.json();
      const agentsData = await agentsRes.json();

      if (bioRes) {
        try {
          const bioData = await bioRes.json();
          if (bioData.success && bioData.defaultBio) {
            setDefaultBioInput(bioData.defaultBio);
          }
        } catch {}
      }

      if (statsData.success) setStats(statsData.stats);
      if (usersData.success && Array.isArray(usersData.users)) setUsers(usersData.users);
      if (agentsData.success && Array.isArray(agentsData.agents)) setAgents(agentsData.agents);
    } catch (err: any) {
      showToast('error', err.message || 'خطأ في جلب بيانات لوحة التحكم');
    } finally {
      setIsLoading(false);
      onLoadingChange?.(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [adminToken]);

  useEffect(() => {
    const handleTopBarRefresh = () => {
      fetchData();
      if (activeTab === 'bot') fetchBotReferrals();
      else if (activeTab === 'games') setGamesRefreshSignal((n) => n + 1);
      else if (activeTab === 'sections') fetchSectionSettings();
      else if (activeTab === 'feedback') fetchFeedbackReports();
      else if (activeTab === 'passwordResets') fetchPasswordResets();
      else if (activeTab === 'verifications') fetchVerifications();
    };
    window.addEventListener('soulx:admin-refresh', handleTopBarRefresh);
    return () => window.removeEventListener('soulx:admin-refresh', handleTopBarRefresh);
  }, [activeTab, adminToken]);

  const fetchBotReferrals = async () => {
    setIsLoadingBotReferrals(true);
    try {
      const headers = getAdminHeaders();
      const res = await fetch('/api/admin/bot/referrals', { headers, cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        if (data.settings) {
          setBotRefEnabled(Boolean(data.settings.enabled));
          setBotRefNewUserBonus(Number(data.settings.newUserBonusUsd ?? 0.1).toFixed(2));
          setBotRefReferrerBonus(Number(data.settings.referrerBonusUsd ?? 0.5).toFixed(2));
          setBotRefCoinsPerDollar(String(data.settings.coinsPerDollar ?? 25000));
        }
        if (data.stats) setBotRefStats(data.stats);
        if (Array.isArray(data.users)) setBotRefUsers(data.users);
        if (Array.isArray(data.transfers)) setBotRefTransfers(data.transfers);
      }
    } catch (err) {
      console.warn('Failed to fetch bot referrals:', err);
    } finally {
      setIsLoadingBotReferrals(false);
    }
  };

  const fetchSectionSettings = async () => {
    setIsLoadingSections(true);
    try {
      const headers = getAdminHeaders();
      const res = await fetch('/api/admin/settings/sections', { headers, cache: 'no-store' });
      const data = await res.json();
      if (data?.success) {
        setGamesSectionEnabled(data.gamesEnabled !== false);
        setStoreSectionEnabled(data.storeEnabled !== false);
      }
    } catch (err) {
      console.warn('Failed to fetch section settings:', err);
    } finally {
      setIsLoadingSections(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'bot') {
      fetchBotReferrals();
    } else if (activeTab === 'sections') {
      fetchSectionSettings();
    }
  }, [activeTab, adminToken]);

  const handleToggleAppSection = async (target: 'games' | 'store') => {
    const nextGames = target === 'games' ? !gamesSectionEnabled : gamesSectionEnabled;
    const nextStore = target === 'store' ? !storeSectionEnabled : storeSectionEnabled;

    setTogglingSectionTarget(target);
    try {
      const res = await fetch('/api/admin/settings/sections', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          gamesEnabled: nextGames,
          storeEnabled: nextStore,
        }),
      });
      const data = await res.json();
      if (data?.success) {
        const resolvedGames = data.gamesEnabled !== false;
        const resolvedStore = data.storeEnabled !== false;
        setGamesSectionEnabled(resolvedGames);
        setStoreSectionEnabled(resolvedStore);

        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('soulx:sections-updated', {
              detail: { gamesEnabled: resolvedGames, storeEnabled: resolvedStore },
            })
          );
        }

        const label =
          target === 'games'
            ? resolvedGames
              ? isAr
                ? 'تم تفعيل قسم الألعاب بنجاح'
                : 'Games section enabled'
              : isAr
              ? 'تم تعطيل قسم الألعاب بنجاح'
              : 'Games section disabled'
            : resolvedStore
            ? isAr
              ? 'تم تفعيل قسم المتجر بنجاح'
              : 'Store section enabled'
            : isAr
            ? 'تم تعطيل قسم المتجر بنجاح'
            : 'Store section disabled';
        showToast('success', label);
      } else {
        showToast('error', data?.message || (isAr ? 'فشل تحديث حالة القسم' : 'Failed to update section'));
      }
    } catch (err: any) {
      showToast('error', err?.message || (isAr ? 'خطأ في الاتصال بالخادم' : 'Network error'));
    } finally {
      setTogglingSectionTarget(null);
    }
  };

  const handleToggleBotReferralsEnabled = async () => {
    const nextEnabled = !botRefEnabled;
    setIsSavingBotReferrals(true);
    try {
      const res = await fetch('/api/admin/bot/referrals/settings', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          enabled: nextEnabled,
          newUserBonusUsd: Number(botRefNewUserBonus),
          referrerBonusUsd: Number(botRefReferrerBonus),
          coinsPerDollar: Number(botRefCoinsPerDollar),
        }),
      });
      const data = await res.json();
      if (data.success && data.settings) {
        setBotRefEnabled(Boolean(data.settings.enabled));
        showToast('success', data.message || (nextEnabled ? 'تم تفعيل نظام الإحالات' : 'تم إيقاف نظام الإحالات'));
      } else {
        showToast('error', data.message || 'تعذر تحديث الحالة');
      }
    } catch (err: any) {
      showToast('error', err.message || 'خطأ في الاتصال بالخادم');
    } finally {
      setIsSavingBotReferrals(false);
    }
  };

  const handleSaveBotReferralSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const newBonus = Number(botRefNewUserBonus);
    const refBonus = Number(botRefReferrerBonus);
    const rate = Number(botRefCoinsPerDollar);

    if (!Number.isFinite(newBonus) || newBonus < 0) {
      showToast('error', isAr ? 'قيمة مكافأة المستخدم الجديد غير صالحة' : 'Invalid new user bonus');
      return;
    }
    if (!Number.isFinite(refBonus) || refBonus < 0) {
      showToast('error', isAr ? 'قيمة مكافأة المحيل غير صالحة' : 'Invalid referrer bonus');
      return;
    }
    if (!Number.isFinite(rate) || rate < 1) {
      showToast('error', isAr ? 'سعر الصرف يجب أن يكون 1 كوينز على الأقل' : 'Exchange rate must be at least 1');
      return;
    }

    setIsSavingBotReferrals(true);
    try {
      const res = await fetch('/api/admin/bot/referrals/settings', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          enabled: botRefEnabled,
          newUserBonusUsd: newBonus,
          referrerBonusUsd: refBonus,
          coinsPerDollar: Math.round(rate),
        }),
      });
      const data = await res.json();
      if (data.success && data.settings) {
        setBotRefEnabled(Boolean(data.settings.enabled));
        setBotRefNewUserBonus(Number(data.settings.newUserBonusUsd).toFixed(2));
        setBotRefReferrerBonus(Number(data.settings.referrerBonusUsd).toFixed(2));
        setBotRefCoinsPerDollar(String(data.settings.coinsPerDollar));
        showToast('success', data.message || (isAr ? 'تم حفظ إعدادات الإحالات بنجاح' : 'Referral settings saved'));
        fetchBotReferrals();
      } else {
        showToast('error', data.message || 'فشل حفظ الإعدادات');
      }
    } catch (err: any) {
      showToast('error', err.message || 'خطأ في الاتصال بالخادم');
    } finally {
      setIsSavingBotReferrals(false);
    }
  };

  // -----------------------------------------------------------------
  // FEEDBACK & BUG REPORTS HANDLERS (البلاغات والاقتراحات)
  // -----------------------------------------------------------------
  const fetchFeedbackReports = async () => {
    setIsLoadingFeedback(true);
    try {
      const headers = getAdminHeaders();
      const res = await fetch('/api/admin/feedback', { headers, cache: 'no-store' });
      const data = await res.json();
      if (data.success && Array.isArray(data.reports)) {
        setFeedbackReports(data.reports);
      }
    } catch (err: any) {
      console.warn('Failed to fetch feedback reports:', err);
    } finally {
      setIsLoadingFeedback(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'feedback') {
      fetchFeedbackReports();
    }
  }, [activeTab]);

  // Initial feedback check on load to show badge
  useEffect(() => {
    fetchFeedbackReports();
  }, [adminToken]);

  const handleOpenUserReportsModal = async (u: AdminUserRecord) => {
    setIsLoadingUserReportsModal(true);
    const ids = [u.id, u.displayId, u.email].filter(Boolean) as string[];
    const localReports = feedbackReports.filter((r) => {
      if (r.type !== 'user_report') return false;
      const rIds = [r.reportedUserId, r.reportedUserDisplayId, r.reportedUserEmail].filter(Boolean) as string[];
      return rIds.some((rid) => ids.some((id) => id.toLowerCase() === rid.toLowerCase()));
    });

    setUserReportsModalData({
      user: u,
      reports: localReports,
    });

    try {
      const headers = getAdminHeaders();
      const res = await fetch(`/api/admin/users/${encodeURIComponent(u.id)}/reports`, { headers });
      const data = await res.json();
      if (data.success && Array.isArray(data.reports)) {
        setUserReportsModalData({
          user: u,
          reports: data.reports,
        });
      }
    } catch (e) {
      console.warn('Error fetching fresh user reports:', e);
    } finally {
      setIsLoadingUserReportsModal(false);
    }
  };

  const handleDeleteFeedbackReport = async (reportId: string) => {
    setDeletingReportId(reportId);
    try {
      const headers = getAdminHeaders();
      const res = await fetch('/api/admin/feedback/delete', {
        method: 'POST',
        headers,
        body: JSON.stringify({ id: reportId }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', isAr ? 'تم حذف البلاغ بنجاح' : 'Report deleted successfully');
        setFeedbackReports((prev) => prev.filter((r) => r.id !== reportId));
      } else {
        showToast('error', data.message || 'فشل حذف البلاغ');
      }
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setDeletingReportId(null);
    }
  };

  // -----------------------------------------------------------------
  // PASSWORD RESET REQUESTS HANDLERS (طلبات استعادة كلمة المرور)
  // -----------------------------------------------------------------
  const fetchPasswordResets = async () => {
    setIsLoadingPasswordResets(true);
    try {
      const headers = getAdminHeaders();
      const res = await fetch('/api/admin/password-resets', { headers, cache: 'no-store' });
      const data = await res.json();
      if (data.success && Array.isArray(data.requests)) {
        setPasswordResets(data.requests);
      }
    } catch (err: any) {
      console.warn('Failed to fetch password reset requests:', err);
    } finally {
      setIsLoadingPasswordResets(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'passwordResets') {
      fetchPasswordResets();
    }
  }, [activeTab]);

  useEffect(() => {
    fetchPasswordResets();
  }, [adminToken]);

  const handleDeletePasswordReset = async (requestId: string) => {
    setDeletingResetId(requestId);
    try {
      const headers = getAdminHeaders();
      const res = await fetch('/api/admin/password-resets/delete', {
        method: 'POST',
        headers,
        body: JSON.stringify({ id: requestId }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', isAr ? 'تم حذف الطلب بنجاح' : 'Request deleted');
        setPasswordResets((prev) => prev.filter((r) => r.id !== requestId));
      } else {
        showToast('error', data.message || 'فشل حذف الطلب');
      }
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setDeletingResetId(null);
    }
  };

  // -----------------------------------------------------------------
  // ACCOUNT VERIFICATION REQUESTS HANDLERS (طلبات توثيق الحساب بالشارة الزرقاء)
  // -----------------------------------------------------------------
  const fetchVerifications = async () => {
    setIsLoadingVerifications(true);
    try {
      const headers = getAdminHeaders();
      const res = await fetch('/api/admin/verifications', { headers, cache: 'no-store' });
      const data = await res.json();
      if (data.success && Array.isArray(data.requests)) {
        setVerificationRequests(data.requests);
      }
    } catch (err: any) {
      console.warn('Failed to fetch verification requests:', err);
    } finally {
      setIsLoadingVerifications(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'verifications') {
      fetchVerifications();
    }
  }, [activeTab]);

  useEffect(() => {
    fetchVerifications();
  }, [adminToken]);

  const handleApproveVerification = async (reqItem: VerificationRequestRecord) => {
    setProcessingVerifId(reqItem.id);
    try {
      const res = await fetch('/api/admin/verifications/approve', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ requestId: reqItem.id }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', data.message || (isAr ? 'تمت الموافقة وتوثيق الحساب بنجاح' : 'Account verified successfully'));
        await Promise.all([fetchVerifications(), fetchData()]);
      } else {
        showToast('error', data.message || (isAr ? 'فشل الموافقة على الطلب' : 'Failed to approve'));
      }
    } catch (err: any) {
      showToast('error', err?.message || 'خطأ في الموافقة');
    } finally {
      setProcessingVerifId(null);
    }
  };

  const handleRejectVerification = async () => {
    if (!rejectModalRequest) return;
    setProcessingVerifId(rejectModalRequest.id);
    try {
      const res = await fetch('/api/admin/verifications/reject', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          requestId: rejectModalRequest.id,
          reason: rejectReasonInput.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', data.message || (isAr ? 'تم رفض طلب التوثيق' : 'Verification request rejected'));
        setRejectModalRequest(null);
        setRejectReasonInput('');
        await fetchVerifications();
      } else {
        showToast('error', data.message || (isAr ? 'فشل رفض الطلب' : 'Failed to reject'));
      }
    } catch (err: any) {
      showToast('error', err?.message || 'خطأ في الرفض');
    } finally {
      setProcessingVerifId(null);
    }
  };

  const handleDeleteVerification = async (reqItem: VerificationRequestRecord) => {
    if (reqItem.status !== 'approved' && reqItem.status !== 'rejected') return;
    setDeletingVerifId(reqItem.id);
    try {
      const res = await fetch(`/api/admin/verifications/${encodeURIComponent(reqItem.id)}`, {
        method: 'DELETE',
        headers: getAdminHeaders(),
      });
      const data = await res.json();
      if (res.ok && data?.success) {
        setVerificationRequests((prev) => prev.filter((r) => r.id !== reqItem.id));
        setConfirmDeleteVerifId(null);
        showToast(
          'success',
          data.message ||
            (isAr
              ? 'تم حذف الطلب بنجاح دون التأثير على التوثيق أو حالة الطلب'
              : 'Verification request deleted without affecting verification status')
        );
      } else {
        showToast('error', data?.message || (isAr ? 'فشل حذف الطلب' : 'Failed to delete request'));
      }
    } catch (err: any) {
      showToast('error', err?.message || (isAr ? 'حدث خطأ أثناء الحذف' : 'Error deleting request'));
    } finally {
      setDeletingVerifId(null);
    }
  };

  const handleToggleUserVerify = async (u: AdminUserRecord) => {
    const nextVerified = !Boolean(u.isVerified);
    setTogglingVerifyUserId(u.id);
    try {
      const res = await fetch('/api/admin/users/verify-toggle', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ userId: u.id, isVerified: nextVerified }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(
          'success',
          data.message ||
            (nextVerified
              ? isAr
                ? `تم توثيق حساب ${u.name} بنجاح`
                : `${u.name} verified`
              : isAr
              ? `تم إلغاء توثيق حساب ${u.name}`
              : `${u.name} unverified`)
        );
        setUsers((prev) =>
          prev.map((item) => (item.id === u.id ? { ...item, isVerified: nextVerified } : item))
        );
        fetchVerifications();
      } else {
        showToast('error', data.message || (isAr ? 'فشل تحديث حالة التوثيق' : 'Failed to update verification'));
      }
    } catch (err: any) {
      showToast('error', err?.message || 'خطأ أثناء تحديث التوثيق');
    } finally {
      setTogglingVerifyUserId(null);
    }
  };

  const handleConfirmClearSection = async () => {
    if (!clearConfirmTarget) return;
    setIsClearingSection(true);
    try {
      const headers = getAdminHeaders();
      const endpoint =
        clearConfirmTarget === 'feedback'
          ? '/api/admin/feedback/clear'
          : '/api/admin/password-resets/clear';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ mode: 'all' }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', data.message || (isAr ? 'تم الإفراغ بنجاح' : 'Cleared successfully'));
        if (clearConfirmTarget === 'feedback') {
          setFeedbackReports([]);
        } else {
          setPasswordResets([]);
        }
        setClearConfirmTarget(null);
        fetchData();
      } else {
        showToast('error', data.message || (isAr ? 'فشل عملية الإفراغ' : 'Clear failed'));
      }
    } catch (err: any) {
      showToast('error', err.message || 'خطأ في الاتصال');
    } finally {
      setIsClearingSection(false);
    }
  };


  // BROADCAST & NOTIFICATIONS HANDLERS (إذاعة عامة ورسائل إدارية)
  // -----------------------------------------------------------------

  const handleApplyTemplate = (type: 'update' | 'gift' | 'maintenance' | 'welcome' | 'security' | 'direct_warning' | 'direct_thanks') => {
    switch (type) {
      case 'update':
        setBroadcastTitleAr('🚀 تحديث جديد وميزات حصرية في منصة Soul-X');
        setBroadcastTitleEn('🚀 New Update & Exclusive Features in Soul-X');
        setBroadcastMessageAr('يسر إدارة Soul-X الإعلان عن إطلاق تحديث شامل لتحسين تجربة المستخدم وسرعة المحادثات وتوافق الأرواح! نتمنى لكم تجربة مميزة.');
        setBroadcastMessageEn('Soul-X management is pleased to announce a comprehensive update enhancing chats, speed, and soul matching!');
        setBroadcastCategory('system');
        setBroadcastPriority('important');
        break;
      case 'gift':
        setBroadcastTitleAr('🎁 مكافأة مجتمعية لجميع أعضاء Soul-X');
        setBroadcastTitleEn('🎁 Community Reward for All Soul-X Members');
        setBroadcastMessageAr('تقديراً لتفاعلكم المستمر وتواجدكم الراقي في المنصة، تم توزيع هدايا ومكافآت رمزية لأعضاء المجتمع! شكراً لكونكم جزءاً من عائلة Soul-X.');
        setBroadcastMessageEn('In appreciation of your active participation, rewards have been distributed to our community! Thank you for being part of Soul-X.');
        setBroadcastCategory('reward');
        setBroadcastPriority('normal');
        break;
      case 'maintenance':
        setBroadcastTitleAr('⚠️ تنبيه صيانة مجدولة لتحسين كفاءة الخوادم');
        setBroadcastTitleEn('⚠️ Scheduled Maintenance Notice');
        setBroadcastMessageAr('يرجى العلم بأنه ستتم ترقية دورية لخوادم المنصة وقاعدة البيانات لتحسين الاستقرار والسرعة. لن تتأثر بياناتكم أو أرصدتكم بأي شكل من الأشكال.');
        setBroadcastMessageEn('Please be advised of scheduled server upgrades to enhance stability and speed. Your data and balances remain fully safe.');
        setBroadcastCategory('warning');
        setBroadcastPriority('urgent');
        break;
      case 'welcome':
        setBroadcastTitleAr('🌟 مرحباً بكم في مجتمع Soul-X للتعارف وتوافق الأرواح');
        setBroadcastTitleEn('🌟 Welcome to Soul-X Community');
        setBroadcastMessageAr('نرحب بجميع المنضمين الجدد إلى Soul-X! نتمنى لكم أوقاتاً ممتعة وتواصلاً راقياً وآمناً. يمكنكم شحن الرصيد والتعرف على الأصدقاء بسهولة.');
        setBroadcastMessageEn('Welcome to Soul-X! We wish you wonderful, safe, and meaningful connections.');
        setBroadcastCategory('announcement');
        setBroadcastPriority('normal');
        break;
      case 'security':
        setBroadcastTitleAr('🛡️ إرشادات الأمان والخصوصية وحماية الحسابات');
        setBroadcastTitleEn('🛡️ Security & Privacy Safety Guidelines');
        setBroadcastMessageAr('تذكر دائماً أن إدارة Soul-X لن تطلب أبداً كلمة مرور حسابك أو بياناتك الخاصة عبر الدردشة. حافظ على سرية بياناتك وتواصل مع الإدارة فقط عبر القنوات الرسمية.');
        setBroadcastMessageEn('Soul-X admin will never ask for your password. Keep your credentials private and communicate only through verified channels.');
        setBroadcastCategory('alert');
        setBroadcastPriority('important');
        break;
      case 'direct_warning':
        setDirectNotifyTitleAr('⚠️ تنبيه إداري رسمي بشأن الالتزام بالقواعد');
        setDirectNotifyTitleEn('⚠️ Official Admin Notice Regarding Community Guidelines');
        setDirectNotifyMessageAr('يرجى الالتزام التام بقواعد المجتمع والآداب العامة أثناء الدردشة لتجنب فرض قيود على حسابك.');
        setDirectNotifyMessageEn('Please adhere strictly to our community standards during chats to avoid account restrictions.');
        setDirectNotifyCategory('warning');
        setDirectNotifyPriority('important');
        break;
      case 'direct_thanks':
        setDirectNotifyTitleAr('🌟 شكر وتقدير من إدارة Soul-X');
        setDirectNotifyTitleEn('🌟 Appreciation Note from Soul-X');
        setDirectNotifyMessageAr('نشكرك على تفاعلك الإيجابي ومشاركتك المميزة في مجتمع Soul-X. حسابك يعتبر من الحسابات المميزة لدينا!');
        setDirectNotifyMessageEn('Thank you for your positive presence in Soul-X. Your account is valued among our community!');
        setDirectNotifyCategory('custom');
        setDirectNotifyPriority('normal');
        break;
    }
  };

  const handleSendBroadcast = async () => {
    if (!broadcastMessageAr.trim()) {
      showToast('error', isAr ? 'يرجى كتابة نص الرسالة' : 'Please enter message text');
      return;
    }
    if (broadcastTargetType === 'single' && !broadcastSelectedUser) {
      showToast('error', isAr ? 'يرجى اختيار المستخدم المستهدف' : 'Please select target user');
      return;
    }

    setIsSendingBroadcast(true);
    try {
      const headers = getAdminHeaders();
      const isBroadcast = broadcastTargetType !== 'single';
      const payload = {
        targetType: broadcastTargetType,
        userId: broadcastTargetType === 'single' ? (broadcastSelectedUser?.id || broadcastSelectedUser?.displayId) : undefined,
        titleAr: isBroadcast ? '' : (broadcastTitleAr.trim() || 'رسالة من الإدارة:'),
        titleEn: isBroadcast ? '' : (broadcastTitleEn.trim() || broadcastTitleAr.trim() || 'Message from Administration:'),
        messageAr: isBroadcast ? broadcastMessageAr : broadcastMessageAr.trim(),
        messageEn: isBroadcast ? (broadcastMessageEn || broadcastMessageAr) : (broadcastMessageEn.trim() || broadcastMessageAr.trim()),
        category: broadcastCategory,
        priority: broadcastPriority,
      };

      const res = await fetch('/api/admin/notifications/send', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || (isAr ? 'فشل إرسال الإشعار' : 'Failed to send notification'));
      }

      showToast('success', data.message || (isAr ? 'تم الإرسال بنجاح!' : 'Sent successfully!'));
      setBroadcastTitleAr('');
      setBroadcastTitleEn('');
      setBroadcastMessageAr('');
      setBroadcastMessageEn('');
      setBroadcastPriority('normal');
    } catch (err: any) {
      showToast('error', err.message || (isAr ? 'حدث خطأ أثناء الإرسال' : 'Error sending notification'));
    } finally {
      setIsSendingBroadcast(false);
    }
  };

  const handleOpenUserNotifyModal = (u: AdminUserRecord) => {
    setDirectNotifyUser(u);
    setDirectNotifyTitleAr('');
    setDirectNotifyTitleEn('');
    setDirectNotifyMessageAr('');
    setDirectNotifyMessageEn('');
    setDirectNotifyCategory('custom');
    setDirectNotifyPriority('normal');
  };

  const handleSendDirectNotifyFromModal = async () => {
    if (!directNotifyUser) return;
    if (!directNotifyMessageAr.trim()) {
      showToast('error', isAr ? 'يرجى إدخال نص الرسالة' : 'Please enter message');
      return;
    }

    setIsSendingDirectNotify(true);
    try {
      const headers = getAdminHeaders();
      const payload = {
        targetType: 'single',
        userId: directNotifyUser.id,
        titleAr: directNotifyTitleAr.trim() || 'رسالة من الإدارة:',
        titleEn: directNotifyTitleEn.trim() || directNotifyTitleAr.trim() || 'Message from Administration:',
        messageAr: directNotifyMessageAr.trim(),
        messageEn: directNotifyMessageEn.trim() || directNotifyMessageAr.trim(),
        category: directNotifyCategory,
        priority: directNotifyPriority,
      };

      const res = await fetch('/api/admin/notifications/send', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'فشل إرسال الإشعار');
      }

      showToast('success', data.message || 'تم إرسال الرسالة إلى مركز إشعارات المستخدم بنجاح!');
      setDirectNotifyUser(null);
    } catch (err: any) {
      showToast('error', err.message || 'خطأ أثناء إرسال الإشعار');
    } finally {
      setIsSendingDirectNotify(false);
    }
  };

  // -----------------------------------------------------------------
  // USER HANDLERS
  // -----------------------------------------------------------------
  const handleOpenEditUser = (u: AdminUserRecord) => {
    setEditUserError(null);
    setEditingUser(u);
    setEditName(u.name || '');
    setEditEmail(u.email || '');
    setEditDisplayId(u.displayId || u.id || '');
    setEditBirthDate(u.birthDate ? String(u.birthDate).split('T')[0] : '');
    setEditGender(u.gender === 'male' || u.gender === 'female' ? u.gender : null);
    setEditBio(u.bio || '');
    const rawCountry = (u.country || '').trim();
    const matchedCountry = rawCountry
      ? WORLD_COUNTRIES.find(
          (c) =>
            c.nameAr === rawCountry ||
            c.nameEn.toLowerCase() === rawCountry.toLowerCase() ||
            c.code.toLowerCase() === rawCountry.toLowerCase()
        )
      : undefined;
    setEditCountry(matchedCountry ? matchedCountry.nameAr : rawCountry);
  };

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    const cleanName = editName.trim();
    const cleanEmail = editEmail.trim();
    const cleanDisplayId = editDisplayId.trim();

    if (!cleanName || !cleanEmail || !cleanDisplayId) {
      const msg = isAr ? 'يرجى تعبئة الاسم والبريد الإلكتروني ومعرف الحساب' : 'Please fill in name, email, and account ID';
      setEditUserError(msg);
      showToast('error', msg);
      return;
    }

    setEditUserError(null);
    setIsUpdatingUser(true);
    try {
      const res = await fetch('/api/admin/update-user', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          userId: editingUser.id,
          originalEmail: editingUser.email,
          originalDisplayId: editingUser.displayId,
          name: cleanName,
          email: cleanEmail,
          displayId: cleanDisplayId,
          birthDate: editBirthDate ? editBirthDate.split('T')[0] : null,
          gender: editGender || null,
          bio: editBio.trim(),
          country: editCountry.trim() ? editCountry.trim() : null,
        }),
      });

      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        const updated = data.user || {};
        showToast('success', data.message || (isAr ? 'تم تحديث بيانات المستخدم بنجاح' : 'User updated successfully'));
        setUsers((prev) =>
          prev.map((u) =>
            u.id === editingUser.id
              ? {
                  ...u,
                  id: updated.id || u.id,
                  name: updated.name ?? cleanName,
                  email: updated.email ?? cleanEmail.toLowerCase(),
                  displayId: updated.displayId ?? cleanDisplayId,
                  birthDate: updated.birthDate !== undefined ? updated.birthDate : (editBirthDate || null),
                  gender: updated.gender !== undefined ? updated.gender : editGender,
                  bio: updated.bio !== undefined ? (updated.bio || undefined) : (editBio.trim() || undefined),
                  country: updated.country !== undefined ? (updated.country || undefined) : (editCountry.trim() || undefined),
                }
              : u
          )
        );
        setEditingUser(null);
        setEditUserError(null);
      } else {
        const errMsg = data?.message || (isAr ? `فشل التحديث (${res.status})` : `Update failed (${res.status})`);
        setEditUserError(errMsg);
        showToast('error', errMsg);
      }
    } catch (err: any) {
      const errMsg = err?.message || (isAr ? 'حدث خطأ أثناء الاتصال بالخادم' : 'Network error');
      setEditUserError(errMsg);
      showToast('error', errMsg);
    } finally {
      setIsUpdatingUser(false);
    }
  };

  // Quick Country Change Handlers
  const handleOpenCountryModal = (u: AdminUserRecord) => {
    setCountryUser(u);
    setSelectedCountry(u.country || 'المملكة العربية السعودية');
    setCountrySearchFilter('');
  };

  const handleSaveCountry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!countryUser || !selectedCountry.trim()) return;

    setIsUpdatingCountry(true);
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(countryUser.id)}/country`, {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ country: selectedCountry.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', data.message || (isAr ? 'تم تحديث دولة المستخدم بنجاح' : 'User country updated successfully'));
        setUsers((prev) =>
          prev.map((u) => (u.id === countryUser.id ? { ...u, country: selectedCountry.trim() } : u))
        );
        setCountryUser(null);
      } else {
        showToast('error', data.message || 'فشل تحديث الدولة');
      }
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setIsUpdatingCountry(false);
    }
  };

  // Save Default Bio Handler (تعديل البايو الافتراضي العام من لوحة التحكم)
  const handleSaveDefaultBio = async () => {
    if (!defaultBioInput.trim()) return;
    setIsSavingDefaultBio(true);
    try {
      const res = await fetch('/api/admin/settings/default-bio', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          defaultBio: defaultBioInput.trim(),
          applyToExisting: applyBioToExisting,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', data.message || (isAr ? 'تم حفظ البايو الافتراضي بنجاح' : 'Default bio saved successfully'));
        if (applyBioToExisting) {
          setUsers((prev) =>
            prev.map((u) => ({
              ...u,
              bio: (!u.bio || !u.bio.trim() || u.bio.includes('لم أقم بتعيين الوصف') || u.bio.includes('أبحث عن تواصل حقيقي'))
                ? defaultBioInput.trim()
                : u.bio,
            }))
          );
        }
      } else {
        showToast('error', data.message || 'فشل حفظ البايو الافتراضي');
      }
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setIsSavingDefaultBio(false);
    }
  };

  // Change Password Handler
  const handleOpenPasswordModal = (u: AdminUserRecord) => {
    setPasswordUser(u);
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleSubmitChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordUser) return;

    if (newPassword.length < 4) {
      showToast('error', isAr ? 'كلمة المرور يجب أن لا تقل عن 4 خانات' : 'Password must be at least 4 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('error', isAr ? 'كلمتا المرور غير متطابقتين!' : 'Passwords do not match');
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await fetch('/api/admin/change-user-password', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          userId: passwordUser.id,
          newPassword,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', data.message || (isAr ? 'تم تغيير كلمة المرور بنجاح' : 'Password changed successfully'));
        setPasswordUser(null);
      } else {
        showToast('error', data.message || 'فشل تغيير كلمة المرور');
      }
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setIsChangingPassword(false);
    }
  };

  // User Balance Change Handler (Add / Deduct / Set for Diamonds 💎 & Coins 🪙)
  const handleOpenBalanceModal = (u: AdminUserRecord, initialCurrency: 'diamonds' | 'coins' = 'diamonds') => {
    setBalanceUser(u);
    setUserBalanceCurrency(initialCurrency);
    setUserBalanceAction('add');
    setUserBalanceAmount(initialCurrency === 'coins' ? '5000' : '500');
  };

  const handleSubmitUserBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!balanceUser) return;
    const amountNum = parseFloat(userBalanceAmount);
    if (isNaN(amountNum) || amountNum < 0) {
      showToast('error', isAr ? 'يرجى إدخال قيمة صحيحة' : 'Please enter a valid amount');
      return;
    }

    setIsUpdatingUserBalance(true);
    try {
      const res = await fetch('/api/admin/update-user-balance', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          userId: balanceUser.id,
          displayId: balanceUser.displayId,
          email: balanceUser.email,
          action: userBalanceAction,
          amount: amountNum,
          currency: userBalanceCurrency,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', data.message || (isAr ? 'تم تحديث الرصيد بنجاح' : 'Balance updated'));
        setUsers((prev) =>
          prev.map((u) => {
            if (
              u.id === balanceUser.id ||
              (balanceUser.displayId && u.displayId === balanceUser.displayId) ||
              (balanceUser.email && u.email.toLowerCase() === balanceUser.email.toLowerCase())
            ) {
              if (userBalanceCurrency === 'coins') {
                return {
                  ...u,
                  coinsBalance: typeof data.coinsBalance === 'number' ? data.coinsBalance : u.coinsBalance,
                };
              } else {
                return {
                  ...u,
                  walletBalance: typeof data.walletBalance === 'number' ? data.walletBalance : u.walletBalance,
                };
              }
            }
            return u;
          })
        );

        // Broadcast balance update event so active views immediately reflect the new balance
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('soulx:balance-updated', {
              detail: {
                currency: userBalanceCurrency,
                balance: userBalanceCurrency === 'coins' ? data.coinsBalance : data.walletBalance,
                userId: balanceUser.id,
                displayId: balanceUser.displayId,
                email: balanceUser.email,
              },
            })
          );
        }

        setBalanceUser(null);
      } else {
        showToast('error', data.message || 'فشل تحديث الرصيد');
      }
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setIsUpdatingUserBalance(false);
    }
  };

  // -------------------------------------------------------------
  // Two-Factor Authentication (2FA) Admin Handlers
  // -------------------------------------------------------------
  const handleOpen2FAModal = async (u: AdminUserRecord) => {
    setTwoFactorUser(u);
    setTwoFactorDetails(null);
    setIsLoading2FA(true);
    setCopied2FASecret(false);
    setCopied2FABackup(false);
    try {
      const res = await fetch(`/api/admin/users/${u.id}/2fa`, {
        headers: getAdminHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setTwoFactorDetails({
          twoFactorEnabled: Boolean(data.twoFactorEnabled),
          twoFactorSecret: data.twoFactorSecret || null,
          twoFactorBackupCodes: data.twoFactorBackupCodes || [],
          twoFactorEnabledAt: data.twoFactorEnabledAt || null,
          qrCodeDataUrl: data.qrCodeDataUrl,
        });
      } else {
        showToast('error', data.message || (isAr ? 'فشل تحميل بيانات المصادقة الثنائية' : 'Failed to fetch 2FA info'));
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Error fetching 2FA');
    } finally {
      setIsLoading2FA(false);
    }
  };

  const handleAdminEnable2FA = async () => {
    if (!twoFactorUser) return;
    setIsUpdating2FA(true);
    try {
      const res = await fetch(`/api/admin/users/${twoFactorUser.id}/2fa/enable`, {
        method: 'POST',
        headers: getAdminHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', data.message || (isAr ? 'تم تفعيل المصادقة الثنائية وتوليد المفاتيح بنجاح' : '2FA Enabled successfully'));
        setTwoFactorDetails({
          twoFactorEnabled: true,
          twoFactorSecret: data.secret,
          twoFactorBackupCodes: data.backupCodes || [],
          twoFactorEnabledAt: new Date().toISOString(),
          qrCodeDataUrl: data.qrCodeDataUrl,
        });
        setUsers((prev) =>
          prev.map((u) => (u.id === twoFactorUser.id ? { ...u, twoFactorEnabled: true } : u))
        );
      } else {
        showToast('error', data.message || (isAr ? 'فشل تفعيل المصادقة' : 'Failed to enable 2FA'));
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Error enabling 2FA');
    } finally {
      setIsUpdating2FA(false);
    }
  };

  const handleAdminDisable2FA = async () => {
    if (!twoFactorUser) return;
    setIsUpdating2FA(true);
    try {
      const res = await fetch(`/api/admin/users/${twoFactorUser.id}/2fa/disable`, {
        method: 'POST',
        headers: getAdminHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', data.message || (isAr ? 'تم تعطيل المصادقة الثنائية لهذا الحساب' : '2FA Disabled'));
        setTwoFactorDetails({
          twoFactorEnabled: false,
          twoFactorSecret: null,
          twoFactorBackupCodes: [],
          twoFactorEnabledAt: null,
        });
        setUsers((prev) =>
          prev.map((u) => (u.id === twoFactorUser.id ? { ...u, twoFactorEnabled: false } : u))
        );
      } else {
        showToast('error', data.message || (isAr ? 'فشل تعطيل المصادقة' : 'Failed to disable 2FA'));
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Error disabling 2FA');
    } finally {
      setIsUpdating2FA(false);
    }
  };

  const handleCopy2FASecret = () => {
    if (!twoFactorDetails?.twoFactorSecret) return;
    navigator.clipboard.writeText(twoFactorDetails.twoFactorSecret);
    setCopied2FASecret(true);
    setTimeout(() => setCopied2FASecret(false), 2000);
  };

  const handleCopy2FABackupCodes = () => {
    if (!twoFactorDetails?.twoFactorBackupCodes?.length) return;
    navigator.clipboard.writeText(twoFactorDetails.twoFactorBackupCodes.join('\n'));
    setCopied2FABackup(true);
    setTimeout(() => setCopied2FABackup(false), 2000);
  };

  // Delete User Handler
  const handleConfirmDeleteUser = async () => {
    if (!deletingUserId) return;
    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ userId: deletingUserId }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', isAr ? 'تم حذف المستخدم من النظام' : 'User deleted');
        setUsers((prev) => prev.filter((u) => u.id !== deletingUserId && u.displayId !== deletingUserId));
        if (selectedActionUser && (selectedActionUser.id === deletingUserId || selectedActionUser.displayId === deletingUserId)) {
          setSelectedActionUser(null);
        }
        if (stats) {
          setStats({
            ...stats,
            registeredUsersCount: Math.max(0, stats.registeredUsersCount - 1),
          });
        }
      } else {
        showToast('error', data.message || 'فشل الحذف');
      }
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setDeletingUserId(null);
    }
  };

  // -----------------------------------------------------------------
  // AGENT HANDLERS
  // -----------------------------------------------------------------
  const handleOpenAddAgent = (user?: AdminUserRecord) => {
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    setAgentGridCode(`A${randomDigits}`);
    if (user) {
      setAgentEmail(user.email || '');
      setAgentName(user.name ? (user.name.startsWith('وكالة') ? user.name : `وكالة ${user.name}`) : `وكالة ${user.email.split('@')[0]}`);
      setAgentCountry(user.country || '');
    } else {
      setAgentEmail('');
      setAgentName('');
      setAgentCountry('');
    }
    setIsAddAgentModalOpen(true);
  };

  const handleSubmitAddAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentGridCode.trim()) {
      showToast('error', isAr ? 'يرجى تحديد أو كتابة رقم فريد للوكيل' : 'Unique Agent Grid ID is required');
      return;
    }
    if (!agentEmail.trim()) {
      showToast('error', isAr ? 'يرجى كتابة البريد الإلكتروني للوكيل' : 'Agent Email is required');
      return;
    }
    if (!agentName.trim()) {
      showToast('error', isAr ? 'يرجى كتابة اسم الوكيل أو الوكالة' : 'Agent / Agency Name is required');
      return;
    }
    if (!agentCountry.trim()) {
      showToast('error', isAr ? 'يرجى كتابة دولة الوكيل' : 'Agent Country is required');
      return;
    }

    setIsCreatingAgent(true);
    try {
      const res = await fetch('/api/admin/create-agent', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          gridCode: agentGridCode.trim().toUpperCase(),
          email: agentEmail.trim().toLowerCase(),
          name: agentName.trim(),
          country: agentCountry.trim(),
        }),
      });

      const data = await res.json();
      if (data.success && data.agent) {
        showToast(
          'success',
          data.message ||
            (isAr
              ? `تم تعيين وإضافة الوكيل (${data.agent.name}) بالرقم الفريد [${data.agent.gridCode}] بنجاح!`
              : `Agent added successfully with ID [${data.agent.gridCode}]!`)
        );
        setAgents((prev) => [
          data.agent,
          ...prev.filter(
            (a) =>
              a.id !== data.agent.id &&
              a.email.toLowerCase() !== data.agent.email.toLowerCase() &&
              a.gridCode !== data.agent.gridCode
          ),
        ]);
        setIsAddAgentModalOpen(false);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('soulx:agents-updated'));
        }
      } else {
        showToast('error', data.message || (isAr ? 'فشل تعيين وإضافة الوكيل' : 'Failed to add agent'));
      }
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setIsCreatingAgent(false);
    }
  };

  const handleOpenEditAgent = (agent: AgentRecord) => {
    setEditingAgent(agent);
  };

  const handleSubmitEditAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAgent) return;

    setIsUpdatingAgent(true);
    try {
      const res = await fetch('/api/admin/update-agent', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          agentId: editingAgent.id,
          gridCode: editingAgent.gridCode,
          email: editingAgent.email,
          name: editingAgent.name,
          country: editingAgent.country,
          flag: editingAgent.flag,
          category: editingAgent.category,
          whatsapp: editingAgent.whatsapp,
          telegram: editingAgent.telegram,
          methods: editingAgent.methods,
          rateNote: editingAgent.rateNoteAr,
          status: editingAgent.status,
        }),
      });

      const data = await res.json();
      if (data.success && data.agent) {
        showToast('success', data.message || (isAr ? 'تم حفظ التعديلات بنجاح' : 'Agent updated successfully'));
        setAgents((prev) => prev.map((a) => (a.id === editingAgent.id ? data.agent : a)));
        setEditingAgent(null);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('soulx:agents-updated'));
        }
      } else {
        showToast('error', data.message || 'فشل تعديل بيانات الوكيل');
      }
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setIsUpdatingAgent(false);
    }
  };


  // Agent Balance Edit Handler (Add / Deduct / Set)
  const handleOpenAgentBalanceModal = (agent: AgentRecord) => {
    setBalanceAgent(agent);
    setAgentBalanceAction('add');
    setAgentBalanceAmount('10000');
  };

  const handleSubmitAgentBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!balanceAgent) return;
    const amountNum = parseFloat(agentBalanceAmount);
    if (isNaN(amountNum) || amountNum < 0) {
      showToast('error', isAr ? 'يرجى إدخال قيمة صحيحة' : 'Please enter a valid amount');
      return;
    }

    setIsUpdatingAgentBalance(true);
    try {
      const res = await fetch('/api/admin/update-agent-balance', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          agentId: balanceAgent.id,
          action: agentBalanceAction,
          amount: amountNum,
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast('success', data.message || (isAr ? 'تم تعديل رصيد الوكيل بنجاح' : 'Agent balance updated'));
        setAgents((prev) =>
          prev.map((a) => (a.id === balanceAgent.id ? { ...a, balance: data.balance } : a))
        );
        setBalanceAgent(null);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('soulx:agents-updated'));
        }
      } else {
        showToast('error', data.message || 'فشل تعديل رصيد الوكيل');
      }
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setIsUpdatingAgentBalance(false);
    }
  };

  // Delete Agent Handler
  const handleConfirmDeleteAgent = async () => {
    const targetAgent = deletingAgent;
    const targetId = deletingAgentId || targetAgent?.id;
    if (!targetId) return;

    setIsDeletingAgent(true);
    try {
      const res = await fetch('/api/admin/delete-agent', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          agentId: targetId,
          email: targetAgent?.email,
          gridCode: targetAgent?.gridCode,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', data.message || (isAr ? 'تم حذف الوكيل نهائياً وتحديث المحفظة بنجاح' : 'Agent deleted successfully'));
        setAgents((prev) =>
          prev.filter(
            (a) =>
              a.id !== targetId &&
              (!targetAgent?.email || a.email.toLowerCase() !== targetAgent.email.toLowerCase()) &&
              (!targetAgent?.gridCode || (a.gridCode || '').toUpperCase() !== targetAgent.gridCode.toUpperCase())
          )
        );
        await fetchData();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('soulx:agents-updated'));
        }
      } else {
        showToast('error', data.message || (isAr ? 'فشل حذف الوكيل' : 'Delete agent failed'));
      }
    } catch (err: any) {
      showToast('error', err?.message || (isAr ? 'حدث خطأ أثناء الحذف' : 'Error deleting agent'));
    } finally {
      setIsDeletingAgent(false);
      setDeletingAgentId(null);
      setDeletingAgent(null);
    }
  };

  // -----------------------------------------------------------------
  // USER FREEZE & BAN HANDLERS (تجميد وحظر وفك تجميد وفك حظر)
  // -----------------------------------------------------------------
  const handleOpenFreezeModal = (u: AdminUserRecord) => {
    setFreezingUser(u);
    setFreezeMinutesInput('60');
    setFreezeReasonInput('');
  };

  const handleConfirmFreezeUser = async () => {
    if (!freezingUser) return;
    const minutes = parseInt(freezeMinutesInput, 10);
    if (isNaN(minutes) || minutes <= 0) {
      showToast('error', isAr ? 'يرجى إدخال مدة تجميد صحيحة بالدقائق (أكبر من 0)' : 'Please enter a valid freeze duration in minutes (> 0)');
      return;
    }
    setIsSubmittingFreeze(true);
    try {
      const res = await fetch('/api/admin/users/freeze', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          userId: freezingUser.id,
          durationMinutes: minutes,
          reason: freezeReasonInput.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', data.message || (isAr ? `تم تجميد حساب المستخدم لمدة ${minutes} دقيقة بنجاح` : `User frozen for ${minutes} minutes`));
        setFreezingUser(null);
        await fetchData();
      } else {
        showToast('error', data.message || (isAr ? 'فشل تجميد الحساب' : 'Failed to freeze user'));
      }
    } catch (err: any) {
      showToast('error', err?.message || 'خطأ أثناء تجميد الحساب');
    } finally {
      setIsSubmittingFreeze(false);
    }
  };

  const handleUnfreezeUser = async (u: AdminUserRecord) => {
    if (!confirm(isAr ? `هل أنت متأكد من فك التجميد عن حساب ${u.name}؟` : `Are you sure you want to unfreeze ${u.name}?`)) {
      return;
    }
    try {
      const res = await fetch('/api/admin/users/unfreeze', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ userId: u.id }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', data.message || (isAr ? 'تم فك التجميد عن الحساب بنجاح' : 'Account unfrozen successfully'));
        await fetchData();
      } else {
        showToast('error', data.message || (isAr ? 'فشل فك التجميد' : 'Failed to unfreeze'));
      }
    } catch (err: any) {
      showToast('error', err?.message || 'خطأ أثناء فك التجميد');
    }
  };

  const handleOpenBanModal = (u: AdminUserRecord) => {
    setBanningUser(u);
    setBanReasonInput('');
  };

  const handleConfirmBanUser = async () => {
    if (!banningUser) return;
    setIsSubmittingBan(true);
    try {
      const res = await fetch('/api/admin/users/ban', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          userId: banningUser.id,
          reason: banReasonInput.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', data.message || (isAr ? 'تم حظر المستخدم نهائياً بنجاح' : 'User banned successfully'));
        setBanningUser(null);
        await fetchData();
      } else {
        showToast('error', data.message || (isAr ? 'فشل حظر المستخدم' : 'Failed to ban user'));
      }
    } catch (err: any) {
      showToast('error', err?.message || 'خطأ أثناء حظر المستخدم');
    } finally {
      setIsSubmittingBan(false);
    }
  };

  const handleUnbanUser = async (u: AdminUserRecord) => {
    if (!confirm(isAr ? `هل أنت متأكد من إلغاء الحظر عن حساب ${u.name}؟` : `Are you sure you want to unban ${u.name}?`)) {
      return;
    }
    try {
      const res = await fetch('/api/admin/users/unban', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ userId: u.id }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', data.message || (isAr ? 'تم إلغاء الحظر عن الحساب بنجاح' : 'User unbanned successfully'));
        await fetchData();
      } else {
        showToast('error', data.message || (isAr ? 'فشل إلغاء الحظر' : 'Failed to unban'));
      }
    } catch (err: any) {
      showToast('error', err?.message || 'خطأ أثناء إلغاء الحظر');
    }
  };

  const handleQuickExecuteRestriction = async () => {
    if (!quickRestrictUser) {
      showToast('error', isAr ? 'يرجى اختيار مستخدم أولاً' : 'Please select a user first');
      return;
    }
    setIsSubmittingQuickAction(true);
    try {
      if (quickRestrictType === 'freeze') {
        const mins = parseInt(quickFreezeMinutes, 10);
        if (isNaN(mins) || mins <= 0) {
          showToast('error', isAr ? 'يرجى إدخال مدة تجميد صحيحة بالدقائق' : 'Please enter valid freeze duration in minutes');
          return;
        }
        const res = await fetch('/api/admin/users/freeze', {
          method: 'POST',
          headers: getAdminHeaders(),
          body: JSON.stringify({
            userId: quickRestrictUser.id,
            durationMinutes: mins,
            reason: quickRestrictReason.trim() || undefined,
          }),
        });
        const data = await res.json();
        if (data.success) {
          showToast('success', data.message || (isAr ? `تم تجميد الحساب لمدة ${mins} دقيقة بنجاح` : `User frozen for ${mins} mins`));
          setQuickRestrictUser(null);
          setQuickRestrictSearch('');
          setQuickRestrictReason('');
          await fetchData();
        } else {
          showToast('error', data.message || (isAr ? 'فشل تجميد الحساب' : 'Failed to freeze account'));
        }
      } else {
        const res = await fetch('/api/admin/users/ban', {
          method: 'POST',
          headers: getAdminHeaders(),
          body: JSON.stringify({
            userId: quickRestrictUser.id,
            reason: quickRestrictReason.trim() || undefined,
          }),
        });
        const data = await res.json();
        if (data.success) {
          showToast('success', data.message || (isAr ? 'تم حظر المستخدم نهائياً بنجاح' : 'User banned successfully'));
          setQuickRestrictUser(null);
          setQuickRestrictSearch('');
          setQuickRestrictReason('');
          await fetchData();
        } else {
          showToast('error', data.message || (isAr ? 'فشل حظر المستخدم' : 'Failed to ban user'));
        }
      }
    } catch (err: any) {
      showToast('error', err?.message || 'خطأ أثناء تنفيذ العملية');
    } finally {
      setIsSubmittingQuickAction(false);
    }
  };

  // Filter users by search: ID, displayId, email, or name and reported status and freeze/ban/verified status
  const filteredUsers = users.filter((u) => {
    if (filterReportedUsersOnly && (u.reportsCount || 0) <= 0) return false;
    if (filterUserStatus === 'frozen' && !u.isFrozen) return false;
    if (filterUserStatus === 'banned' && !u.isBanned) return false;
    if (filterUserStatus === 'reported' && (u.reportsCount || 0) <= 0) return false;
    if (filterUserStatus === 'verified' && !u.isVerified) return false;
    const q = userSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.id.toLowerCase().includes(q) ||
      (u.displayId && u.displayId.toLowerCase().includes(q))
    );
  });

  // Filter agents by search & category
  const filteredAgents = agents.filter((a) => {
    const q = agentSearch.toLowerCase().trim();
    const matchCategory =
      agentCategoryFilter === 'all'
        ? true
        : agentCategoryFilter === 'recharge'
        ? a.category === 'recharge' || a.category === 'both'
        : a.category === 'withdraw' || a.category === 'both';

    if (!matchCategory) return false;
    if (!q) return true;
    return (
      a.name.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q) ||
      a.country.toLowerCase().includes(q) ||
      a.methods.some((m) => m.toLowerCase().includes(q))
    );
  });

  // Total agents balance
  const totalAgentsBalance = agents.reduce((acc, a) => acc + (a.balance || 0), 0);
  // Total users real balance (Diamonds & Coins)
  const totalUsersBalance = users.reduce((acc, u) => acc + (typeof u.walletBalance === 'number' ? u.walletBalance : 0), 0);
  const totalUsersCoins = users.reduce((acc, u) => acc + (typeof u.coinsBalance === 'number' ? u.coinsBalance : 0), 0);

  const frozenUsersCount = users.filter((u) => u.isFrozen).length;
  const bannedUsersCount = users.filter((u) => u.isBanned).length;
  const restrictedUsersCount = frozenUsersCount + bannedUsersCount;
  const pendingFeedbackCount = feedbackReports.length;
  const pendingResetsCount = passwordResets.length;
  const pendingVerificationsCount = verificationRequests.filter((r) => r.status === 'pending').length;
  const verifiedUsersCount = users.filter((u) => Boolean(u.isVerified)).length;

  // Comprehensive Statistics Analytics (Users, Agents & Balances)
  const totalSystemDiamonds = totalUsersBalance + totalAgentsBalance;
  const usersDiamondsSharePct =
    totalSystemDiamonds > 0 ? Math.round((totalUsersBalance / totalSystemDiamonds) * 100) : 0;
  const agentsDiamondsSharePct =
    totalSystemDiamonds > 0 ? Math.max(0, 100 - usersDiamondsSharePct) : 0;
  const fundedDiamondsUsersCount = users.filter((u) => (u.walletBalance || 0) > 0).length;
  const fundedCoinsUsersCount = users.filter((u) => (u.coinsBalance || 0) > 0).length;
  const avgUserDiamonds = users.length > 0 ? Math.round(totalUsersBalance / users.length) : 0;
  const avgUserCoins = users.length > 0 ? Math.round(totalUsersCoins / users.length) : 0;
  const maxUserDiamonds = users.reduce((max, u) => Math.max(max, u.walletBalance || 0), 0);
  const maxUserCoins = users.reduce((max, u) => Math.max(max, u.coinsBalance || 0), 0);
  const topBalanceUsers = [...users]
    .sort(
      (a, b) =>
        (b.walletBalance || 0) - (a.walletBalance || 0) ||
        (b.coinsBalance || 0) - (a.coinsBalance || 0)
    )
    .slice(0, 5);

  const activeUsersCount = Math.max(0, users.length - restrictedUsersCount);
  const twoFactorUsersCount = users.filter((u) => u.twoFactorEnabled).length;
  const maleUsersCount = users.filter((u) => u.gender === 'male').length;
  const femaleUsersCount = users.filter((u) => u.gender === 'female').length;
  const unspecifiedGenderCount = Math.max(0, users.length - maleUsersCount - femaleUsersCount);
  const nowTimestamp = Date.now();
  const newUsers24hCount = users.filter((u) => {
    const t = Date.parse(u.createdAt);
    return Number.isFinite(t) && nowTimestamp - t <= 24 * 60 * 60 * 1000;
  }).length;
  const newUsers7dCount = users.filter((u) => {
    const t = Date.parse(u.createdAt);
    return Number.isFinite(t) && nowTimestamp - t <= 7 * 24 * 60 * 60 * 1000;
  }).length;

  const countryBuckets = new Map<string, number>();
  users.forEach((u) => {
    const label = u.country ? formatCountryUnified(u.country, lang) : isAr ? 'غير محدد' : 'Unspecified';
    countryBuckets.set(label, (countryBuckets.get(label) || 0) + 1);
  });
  const topUserCountries = Array.from(countryBuckets.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const activeAgentsCount = agents.filter((a) => a.status === 'active').length;
  const suspendedAgentsCount = agents.filter((a) => a.status === 'suspended').length;
  const onlineAgentsCount = agents.filter((a) => a.isOnline).length;
  const rechargeAgentsCount = agents.filter((a) => a.category === 'recharge').length;
  const withdrawAgentsCount = agents.filter((a) => a.category === 'withdraw').length;
  const bothAgentsCount = agents.filter((a) => a.category === 'both').length;
  const totalAgentOrders = agents.reduce((sum, a) => sum + (a.completedOrders || 0), 0);
  const avgAgentBalance = agents.length > 0 ? Math.round(totalAgentsBalance / agents.length) : 0;
  const topAgentsByBalance = [...agents]
    .sort((a, b) => (b.balance || 0) - (a.balance || 0))
    .slice(0, 5);

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 pt-3 space-y-5 animate-in fade-in duration-300">
      {/* Floating Toast Notification (above all modals) */}
      {feedback && (
        <div
          className={`fixed top-20 inset-x-4 max-w-xl mx-auto z-[100] p-3.5 sm:p-4 rounded-2xl text-xs sm:text-sm font-bold shadow-xl backdrop-blur-xl flex items-center justify-between gap-3 border animate-in fade-in slide-in-from-top-2 duration-200 ${
            feedback.type === 'success'
              ? 'bg-emerald-50/95 dark:bg-emerald-950/90 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
              : 'bg-rose-50/95 dark:bg-rose-950/90 text-rose-700 dark:text-rose-300 border-rose-500/40'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
            )}
            <span className="truncate sm:whitespace-normal">{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer shrink-0 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Sticky Segmented Navigation Bar */}
      <div className="sticky top-16 z-30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-2 bg-neutral-50/95 dark:bg-neutral-950/95 backdrop-blur-md border-b border-neutral-200/70 dark:border-neutral-800/70">
        <div className="p-1.5 rounded-2xl bg-neutral-100/95 dark:bg-neutral-900/95 border border-neutral-200/80 dark:border-neutral-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {/* Tab 0: Comprehensive Statistics */}
          <button
            type="button"
            onClick={() => setActiveTab('stats')}
            className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'stats'
                ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm ring-1 ring-amber-500/40'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-neutral-800/40'
            }`}
          >
            <BarChart3 className={`w-4 h-4 ${activeTab === 'stats' ? 'text-amber-500' : 'text-cyan-500'}`} />
            <span>{isAr ? 'الإحصائيات' : 'Statistics'}</span>
          </button>

          {/* Tab 1: Users */}
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'users'
                ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm ring-1 ring-neutral-200/80 dark:ring-neutral-700/80'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-neutral-800/40'
            }`}
          >
            <Users className={`w-4 h-4 ${activeTab === 'users' ? 'text-amber-500' : ''}`} />
            <span>{isAr ? 'إدارة المستخدمين' : 'Users'}</span>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300">
              {filteredUsers.length}
            </span>
          </button>

          {/* Tab: Account Verifications (توثيق الحسابات بالشارة الزرقاء) */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('verifications');
              fetchVerifications();
            }}
            className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'verifications'
                ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm ring-1 ring-[#1D9BF0]/40'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-neutral-800/40'
            }`}
          >
            <BadgeCheck className="w-4 h-4 text-[#1D9BF0]" />
            <span>{isAr ? 'توثيق الحسابات' : 'Verifications'}</span>
            {pendingVerificationsCount > 0 ? (
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-md bg-[#1D9BF0] text-white font-black">
                {pendingVerificationsCount}
              </span>
            ) : (
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-900 text-neutral-500">
                {verificationRequests.length}
              </span>
            )}
          </button>

          {/* Tab: Freeze & Ban Management */}
          <button
            type="button"
            onClick={() => setActiveTab('restrictions')}
            className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'restrictions'
                ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm ring-1 ring-cyan-500/40'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-neutral-800/40'
            }`}
          >
            <Snowflake className="w-4 h-4 text-cyan-500" />
            <span>{isAr ? 'التجميد والحظر' : 'Freeze & Ban'}</span>
            <span
              className={`font-mono text-[10px] px-1.5 py-0.5 rounded-md font-bold ${
                restrictedUsersCount > 0
                  ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400'
                  : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-500'
              }`}
            >
              {restrictedUsersCount}
            </span>
          </button>

          {/* Tab 2: Agents */}
          <button
            type="button"
            onClick={() => setActiveTab('agents')}
            className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'agents'
                ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm ring-1 ring-neutral-200/80 dark:ring-neutral-700/80'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-neutral-800/40'
            }`}
          >
            <Building2 className={`w-4 h-4 ${activeTab === 'agents' ? 'text-amber-500' : ''}`} />
            <span>{isAr ? 'إدارة الوكلاء' : 'Agents'}</span>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300">
              {filteredAgents.length}
            </span>
          </button>

          {/* Tab: Broadcast & Notifications */}
          <button
            type="button"
            onClick={() => setActiveTab('broadcast')}
            className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'broadcast'
                ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm ring-1 ring-neutral-200/80 dark:ring-neutral-700/80'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-neutral-800/40'
            }`}
          >
            <Megaphone className="w-4 h-4 text-violet-500" />
            <span>{isAr ? 'الإذاعة والإشعارات' : 'Broadcasts'}</span>
          </button>

          {/* Tab: Feedback & Bug Reports */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('feedback');
              fetchFeedbackReports();
            }}
            className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'feedback'
                ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm ring-1 ring-neutral-200/80 dark:ring-neutral-700/80'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-neutral-800/40'
            }`}
          >
            <LifeBuoy className="w-4 h-4 text-rose-500" />
            <span>{isAr ? 'البلاغات والاقتراحات' : 'Reports'}</span>
            {pendingFeedbackCount > 0 ? (
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-md bg-rose-500 text-white font-black">
                {pendingFeedbackCount}
              </span>
            ) : (
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-900 text-neutral-500">
                {feedbackReports.length}
              </span>
            )}
          </button>

          {/* Tab: Telegram Password Resets */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('passwordResets');
              fetchPasswordResets();
            }}
            className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'passwordResets'
                ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm ring-1 ring-neutral-200/80 dark:ring-neutral-700/80'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-neutral-800/40'
            }`}
          >
            <KeyRound className="w-4 h-4 text-amber-500" />
            <span>{isAr ? 'استعادة كلمة المرور' : 'Password Resets'}</span>
            {pendingResetsCount > 0 ? (
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500 text-neutral-950 font-black">
                {pendingResetsCount}
              </span>
            ) : (
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-900 text-neutral-500">
                {passwordResets.length}
              </span>
            )}
          </button>

          {/* Tab: Bot */}
          <button
            type="button"
            onClick={() => setActiveTab('bot')}
            className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'bot'
                ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm ring-1 ring-neutral-200/80 dark:ring-neutral-700/80'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-neutral-800/40'
            }`}
          >
            <Bot className="w-4 h-4 text-[#24A1DE]" />
            <span>{isAr ? 'بوت تيليجرام' : 'Telegram Bot'}</span>
          </button>

          {/* Tab: Games */}
          <button
            type="button"
            onClick={() => setActiveTab('games')}
            className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'games'
                ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm ring-1 ring-neutral-200/80 dark:ring-neutral-700/80'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-neutral-800/40'
            }`}
          >
            <Gamepad2 className="w-4 h-4 text-amber-500" />
            <span>{isAr ? 'الألعاب' : 'Games'}</span>
          </button>

          {/* Tab: App Sections (تفعيل وتعطيل قسم المتجر وقسم الألعاب) */}
          <button
            type="button"
            onClick={() => setActiveTab('sections')}
            className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'sections'
                ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm ring-1 ring-neutral-200/80 dark:ring-neutral-700/80'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-neutral-800/40'
            }`}
          >
            <LayoutGrid className="w-4 h-4 text-cyan-500" />
            <span>{isAr ? 'المتجر والألعاب' : 'Sections'}</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          TAB 0: الإحصائيات الشاملة (المستخدمين والوكلاء والأرصدة)
          ========================================================================= */}
      {activeTab === 'stats' && (
        <div className="space-y-5">
          {/* Primary Overview KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Card 1: Total Users */}
            <button
              type="button"
              onClick={() => setActiveTab('users')}
              className="text-start p-4 sm:p-5 rounded-3xl bg-white dark:bg-neutral-900/90 border border-neutral-200/90 dark:border-neutral-800 hover:border-cyan-500/40 shadow-xs space-y-2 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400">
                  {isAr ? 'إجمالي المستخدمين' : 'Total Users'}
                </span>
                <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-neutral-900 dark:text-white font-mono tabular-nums">
                {(stats?.registeredUsersCount ?? users.length).toLocaleString()}
              </div>
              <div className="text-[11px] font-bold flex items-center gap-2 flex-wrap text-neutral-500 dark:text-neutral-400">
                <span className="text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
                  {isAr ? `${activeUsersCount} نشط` : `${activeUsersCount} Active`}
                </span>
                <span>·</span>
                <span className="text-rose-600 dark:text-rose-400 font-mono tabular-nums">
                  {isAr ? `${restrictedUsersCount} مقيد` : `${restrictedUsersCount} Restricted`}
                </span>
              </div>
            </button>

            {/* Card 2: Total Agents */}
            <button
              type="button"
              onClick={() => setActiveTab('agents')}
              className="text-start p-4 sm:p-5 rounded-3xl bg-white dark:bg-neutral-900/90 border border-neutral-200/90 dark:border-neutral-800 hover:border-amber-500/40 shadow-xs space-y-2 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400">
                  {isAr ? 'الوكلاء المعتمدون' : 'Agents'}
                </span>
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Building2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 font-mono tabular-nums">
                {agents.length.toLocaleString()}
              </div>
              <div className="text-[11px] font-bold flex items-center gap-2 flex-wrap text-neutral-500 dark:text-neutral-400">
                <span className="text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
                  {isAr ? `${activeAgentsCount} نشط` : `${activeAgentsCount} Active`}
                </span>
                <span>·</span>
                <span className="font-mono tabular-nums">
                  {isAr ? `${onlineAgentsCount} متصل` : `${onlineAgentsCount} Online`}
                </span>
              </div>
            </button>

            {/* Card 3: Total Diamonds in System */}
            <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-neutral-900/90 border border-neutral-200/90 dark:border-neutral-800 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400">
                  {isAr ? 'إجمالي الماس بالمنصة' : 'Total Diamonds'}
                </span>
                <div className="w-8 h-8 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                  <DiamondIcon className="w-4 h-4 text-cyan-500" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-cyan-600 dark:text-cyan-400 font-mono tabular-nums">
                {totalSystemDiamonds.toLocaleString()}
              </div>
              <div className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400 font-mono tabular-nums truncate">
                {isAr
                  ? `مستخدمين: ${totalUsersBalance.toLocaleString()} · وكلاء: ${totalAgentsBalance.toLocaleString()}`
                  : `Users: ${totalUsersBalance.toLocaleString()} · Agents: ${totalAgentsBalance.toLocaleString()}`}
              </div>
            </div>

            {/* Card 4: Total Coins & System */}
            <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-neutral-900/90 border border-neutral-200/90 dark:border-neutral-800 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400">
                  {isAr ? 'إجمالي الكوينز لدى المستخدمين' : 'Total User Coins'}
                </span>
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <CoinIcon className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 font-mono tabular-nums">
                {totalUsersCoins.toLocaleString()}
              </div>
              <div className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400 font-mono tabular-nums truncate">
                {isAr
                  ? `محافظ مشحونة: ${fundedCoinsUsersCount} · متوسط: ${avgUserCoins.toLocaleString()}`
                  : `Funded: ${fundedCoinsUsersCount} · Avg: ${avgUserCoins.toLocaleString()}`}
              </div>
            </div>
          </div>

          {/* Section 1: Comprehensive Balances Statistics */}
          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-neutral-900/90 border border-neutral-200/90 dark:border-neutral-800 shadow-xs space-y-5">
            <div className="flex items-center justify-between gap-3 pb-3.5 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 flex items-center justify-center shrink-0">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                    {isAr ? 'إحصائيات الأرصدة الشاملة (Diamonds & Coins)' : 'Comprehensive Balances Analytics'}
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {isAr
                      ? 'توزيع أرصدة الماس والكوينز بين المستخدمين والوكلاء ومتوسطات المحافظ'
                      : 'Distribution of Diamonds and Coins across users, agents, and wallet averages'}
                  </p>
                </div>
              </div>
            </div>

            {/* Diamonds Share Bar (Users vs Agents) */}
            <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800 space-y-3">
              <div className="flex items-center justify-between gap-2 text-xs font-bold">
                <span className="text-neutral-700 dark:text-neutral-200">
                  {isAr ? 'توزيع كتلة الماس بين المستخدمين والوكلاء' : 'Diamonds Pool Split (Users vs Agents)'}
                </span>
                <span className="font-mono tabular-nums text-neutral-500 dark:text-neutral-400">
                  {totalSystemDiamonds.toLocaleString()} {isAr ? 'ماسة' : 'Diamonds'}
                </span>
              </div>
              <div className="w-full h-3 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden flex">
                <div
                  className="h-full bg-cyan-500 transition-all duration-300"
                  style={{ width: `${usersDiamondsSharePct}%` }}
                />
                <div
                  className="h-full bg-amber-500 transition-all duration-300"
                  style={{ width: `${agentsDiamondsSharePct}%` }}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 shrink-0" />
                  <span className="text-neutral-600 dark:text-neutral-300">
                    {isAr ? 'محافظ المستخدمين:' : 'Users Wallets:'}
                  </span>
                  <span className="font-mono tabular-nums text-cyan-600 dark:text-cyan-400">
                    {totalUsersBalance.toLocaleString()} ({usersDiamondsSharePct}%)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                  <span className="text-neutral-600 dark:text-neutral-300">
                    {isAr ? 'أرصدة الوكلاء:' : 'Agents Balances:'}
                  </span>
                  <span className="font-mono tabular-nums text-amber-600 dark:text-amber-400">
                    {totalAgentsBalance.toLocaleString()} ({agentsDiamondsSharePct}%)
                  </span>
                </div>
              </div>
            </div>

            {/* Balances Breakdown Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800 space-y-1">
                <span className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400 block">
                  {isAr ? 'متوسط ماس المستخدم' : 'Avg User Diamonds'}
                </span>
                <span className="text-base font-black font-mono tabular-nums text-neutral-900 dark:text-white">
                  {avgUserDiamonds.toLocaleString()}
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800 space-y-1">
                <span className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400 block">
                  {isAr ? 'أعلى رصيد ماس' : 'Top User Diamonds'}
                </span>
                <span className="text-base font-black font-mono tabular-nums text-cyan-600 dark:text-cyan-400">
                  {maxUserDiamonds.toLocaleString()}
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800 space-y-1">
                <span className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400 block">
                  {isAr ? 'محافظ ماس نشطة' : 'Funded Diamond Wallets'}
                </span>
                <span className="text-base font-black font-mono tabular-nums text-neutral-900 dark:text-white">
                  {fundedDiamondsUsersCount} / {users.length}
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800 space-y-1">
                <span className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400 block">
                  {isAr ? 'متوسط كوينز المستخدم' : 'Avg User Coins'}
                </span>
                <span className="text-base font-black font-mono tabular-nums text-neutral-900 dark:text-white">
                  {avgUserCoins.toLocaleString()}
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800 space-y-1">
                <span className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400 block">
                  {isAr ? 'أعلى رصيد كوينز' : 'Top User Coins'}
                </span>
                <span className="text-base font-black font-mono tabular-nums text-amber-600 dark:text-amber-400">
                  {maxUserCoins.toLocaleString()}
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800 space-y-1">
                <span className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400 block">
                  {isAr ? 'متوسط رصيد الوكيل' : 'Avg Agent Balance'}
                </span>
                <span className="text-base font-black font-mono tabular-nums text-neutral-900 dark:text-white">
                  {avgAgentBalance.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Users & Agents Detailed Analytics Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Users Comprehensive Card */}
            <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-neutral-900/90 border border-neutral-200/90 dark:border-neutral-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-neutral-100 dark:border-neutral-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
                    <Users className="w-4.5 h-4.5" />
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-white">
                    {isAr ? 'تفاصيل إحصائيات المستخدمين' : 'Users Analytics'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('users')}
                  className="text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
                >
                  {isAr ? 'عرض الكل' : 'View all'}
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 block">
                    {isAr ? 'حسابات نشطة' : 'Active'}
                  </span>
                  <span className="text-lg font-black font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                    {activeUsersCount}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20">
                  <span className="text-[11px] font-bold text-cyan-700 dark:text-cyan-300 block">
                    {isAr ? 'مجمّدة' : 'Frozen'}
                  </span>
                  <span className="text-lg font-black font-mono tabular-nums text-cyan-600 dark:text-cyan-400">
                    {frozenUsersCount}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20">
                  <span className="text-[11px] font-bold text-rose-700 dark:text-rose-300 block">
                    {isAr ? 'محظورة' : 'Banned'}
                  </span>
                  <span className="text-lg font-black font-mono tabular-nums text-rose-600 dark:text-rose-400">
                    {bannedUsersCount}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800">
                  <span className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400 block">
                    {isAr ? 'تسجيل آخر 24س' : 'Last 24h'}
                  </span>
                  <span className="text-lg font-black font-mono tabular-nums text-neutral-900 dark:text-white">
                    {newUsers24hCount}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800">
                  <span className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400 block">
                    {isAr ? 'تسجيل آخر 7 أيام' : 'Last 7 days'}
                  </span>
                  <span className="text-lg font-black font-mono tabular-nums text-neutral-900 dark:text-white">
                    {newUsers7dCount}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800">
                  <span className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400 block">
                    {isAr ? 'مفعّل 2FA' : '2FA Enabled'}
                  </span>
                  <span className="text-lg font-black font-mono tabular-nums text-neutral-900 dark:text-white">
                    {twoFactorUsersCount}
                  </span>
                </div>
              </div>

              {/* Gender & Social Stats */}
              <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-neutral-700 dark:text-neutral-200">
                  <span>{isAr ? 'توزيع الجنس والتفاعل' : 'Gender & Social Activity'}</span>
                  <span className="font-mono tabular-nums text-[11px] text-neutral-500">
                    {isAr
                      ? `${stats?.friendshipsCount ?? 0} صداقة · ${stats?.conversationsCount ?? 0} محادثة`
                      : `${stats?.friendshipsCount ?? 0} Friends · ${stats?.conversationsCount ?? 0} Chats`}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs font-bold flex-wrap">
                  <span className="text-cyan-600 dark:text-cyan-400 font-mono tabular-nums">
                    {isAr ? `ذكور: ${maleUsersCount}` : `Male: ${maleUsersCount}`}
                  </span>
                  <span className="text-neutral-300 dark:text-neutral-700">·</span>
                  <span className="text-rose-500 dark:text-rose-400 font-mono tabular-nums">
                    {isAr ? `إناث: ${femaleUsersCount}` : `Female: ${femaleUsersCount}`}
                  </span>
                  <span className="text-neutral-300 dark:text-neutral-700">·</span>
                  <span className="text-neutral-500 font-mono tabular-nums">
                    {isAr ? `غير محدد: ${unspecifiedGenderCount}` : `Unspecified: ${unspecifiedGenderCount}`}
                  </span>
                </div>
              </div>

              {/* Top Countries */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-neutral-500 dark:text-neutral-400">
                  {isAr ? 'أعلى الدول تسجيلاً' : 'Top Countries'}
                </h4>
                {topUserCountries.length === 0 ? (
                  <p className="text-xs text-neutral-400">{isAr ? 'لا توجد بيانات دول' : 'No country data'}</p>
                ) : (
                  <div className="space-y-1.5">
                    {topUserCountries.map(([countryLabel, count]) => {
                      const pct = users.length > 0 ? Math.round((count / users.length) * 100) : 0;
                      return (
                        <div key={countryLabel} className="flex items-center justify-between gap-3 text-xs">
                          <span className="font-bold text-neutral-700 dark:text-neutral-200 truncate">
                            {countryLabel}
                          </span>
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="w-20 h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                              <div className="h-full bg-cyan-500" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="font-mono tabular-nums font-bold text-neutral-600 dark:text-neutral-300 w-12 text-end">
                              {count} ({pct}%)
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Agents Comprehensive Card */}
            <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-neutral-900/90 border border-neutral-200/90 dark:border-neutral-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-neutral-100 dark:border-neutral-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    <Building2 className="w-4.5 h-4.5" />
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-white">
                    {isAr ? 'تفاصيل إحصائيات الوكلاء' : 'Agents Analytics'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('agents')}
                  className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                >
                  {isAr ? 'إدارة الوكلاء' : 'Manage'}
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 block">
                    {isAr ? 'وكلاء نشطون' : 'Active'}
                  </span>
                  <span className="text-lg font-black font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                    {activeAgentsCount}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20">
                  <span className="text-[11px] font-bold text-rose-700 dark:text-rose-300 block">
                    {isAr ? 'موقوفون' : 'Suspended'}
                  </span>
                  <span className="text-lg font-black font-mono tabular-nums text-rose-600 dark:text-rose-400">
                    {suspendedAgentsCount}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20">
                  <span className="text-[11px] font-bold text-cyan-700 dark:text-cyan-300 block">
                    {isAr ? 'متصل الآن' : 'Online'}
                  </span>
                  <span className="text-lg font-black font-mono tabular-nums text-cyan-600 dark:text-cyan-400">
                    {onlineAgentsCount}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800">
                  <span className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400 block">
                    {isAr ? 'شحن فقط' : 'Recharge Only'}
                  </span>
                  <span className="text-lg font-black font-mono tabular-nums text-neutral-900 dark:text-white">
                    {rechargeAgentsCount}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800">
                  <span className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400 block">
                    {isAr ? 'سحب فقط' : 'Withdraw Only'}
                  </span>
                  <span className="text-lg font-black font-mono tabular-nums text-neutral-900 dark:text-white">
                    {withdrawAgentsCount}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800">
                  <span className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400 block">
                    {isAr ? 'شحن وسحب' : 'Both'}
                  </span>
                  <span className="text-lg font-black font-mono tabular-nums text-neutral-900 dark:text-white">
                    {bothAgentsCount}
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between text-xs font-bold">
                <span className="text-neutral-600 dark:text-neutral-300">
                  {isAr ? 'إجمالي الطلبات المكتملة للوكلاء' : 'Total Agent Completed Orders'}
                </span>
                <span className="font-mono tabular-nums text-sm font-black text-amber-600 dark:text-amber-400">
                  {totalAgentOrders.toLocaleString()}
                </span>
              </div>

              {/* Top Agents by Balance */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-neutral-500 dark:text-neutral-400">
                  {isAr ? 'أعلى الوكلاء رصيداً' : 'Top Agents by Balance'}
                </h4>
                {topAgentsByBalance.length === 0 ? (
                  <p className="text-xs text-neutral-400">{isAr ? 'لا يوجد وكلاء مسجلون' : 'No agents registered'}</p>
                ) : (
                  <div className="space-y-1.5">
                    {topAgentsByBalance.map((ag) => (
                      <div
                        key={ag.id}
                        className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/70 dark:border-neutral-800/80 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="shrink-0">{ag.flag || '🏳️'}</span>
                          <span className="font-bold text-neutral-800 dark:text-neutral-200 truncate">
                            {ag.name}
                          </span>
                          {ag.gridCode && (
                            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 shrink-0">
                              {ag.gridCode}
                            </span>
                          )}
                        </div>
                        <span className="font-mono tabular-nums font-black text-amber-600 dark:text-amber-400 shrink-0 inline-flex items-center gap-1">
                          {(ag.balance || 0).toLocaleString()}
                          <DiamondIcon className="w-3 h-3" />
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Top User Wallets & Server/System Status */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top 5 User Wallets */}
            <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-neutral-900/90 border border-neutral-200/90 dark:border-neutral-800 shadow-xs space-y-3.5">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-neutral-100 dark:border-neutral-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <TrendingUp className="w-4.5 h-4.5" />
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-white">
                    {isAr ? 'أعلى المحافظ رصيداً (المستخدمين)' : 'Top User Wallets'}
                  </h3>
                </div>
              </div>

              {topBalanceUsers.length === 0 ? (
                <p className="text-xs text-neutral-400">{isAr ? 'لا يوجد مستخدمون' : 'No users found'}</p>
              ) : (
                <div className="space-y-2">
                  {topBalanceUsers.map((u, idx) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/70 dark:border-neutral-800/80 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-5 h-5 rounded-lg bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 font-mono font-black text-[10px] flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="font-bold text-neutral-800 dark:text-neutral-200 truncate flex items-center gap-1">
                            <span className="truncate">{u.name}</span>
                            {u.isVerified && <VerifiedBadge lang={lang} size="xs" />}
                          </div>
                          <div className="font-mono text-[10px] text-neutral-400 truncate">
                            {u.displayId || u.id}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 font-mono tabular-nums font-bold">
                        <span className="inline-flex items-center gap-1 text-cyan-600 dark:text-cyan-400">
                          {(u.walletBalance || 0).toLocaleString()}
                          <DiamondIcon className="w-3 h-3" />
                        </span>
                        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                          {(u.coinsBalance || 0).toLocaleString()}
                          <CoinIcon className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Platform, Bot & Operations Status */}
            <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-neutral-900/90 border border-neutral-200/90 dark:border-neutral-800 shadow-xs space-y-3.5">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-neutral-100 dark:border-neutral-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <Activity className="w-4.5 h-4.5" />
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-white">
                    {isAr ? 'حالة الخادم والعمليات' : 'System & Operations'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('bot')}
                  className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  {isAr ? 'إعدادات البوت' : 'Bot settings'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800 space-y-1">
                  <span className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400 block">
                    {isAr ? 'مدة تشغيل الخادم' : 'Server Uptime'}
                  </span>
                  <span className="text-base font-black font-mono tabular-nums text-neutral-900 dark:text-white">
                    {stats ? `${Math.floor(stats.uptimeSeconds / 60)} ${isAr ? 'دقيقة' : 'min'}` : '—'}
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800 space-y-1">
                  <span className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400 block">
                    {isAr ? 'حالة بوت تيليجرام' : 'Telegram Bot'}
                  </span>
                  <span
                    className={`text-sm font-black ${
                      stats?.botConfigured
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {stats?.botConfigured
                      ? isAr
                        ? 'متصل ونشط'
                        : 'Connected'
                      : isAr
                      ? 'غير مهيأ'
                      : 'Not Configured'}
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800 space-y-1">
                  <span className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400 block">
                    {isAr ? 'البلاغات والاقتراحات' : 'Reports & Suggestions'}
                  </span>
                  <span className="text-base font-black font-mono tabular-nums text-rose-600 dark:text-rose-400">
                    {pendingFeedbackCount}
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800 space-y-1">
                  <span className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400 block">
                    {isAr ? 'طلبات استعادة كلمة مرور' : 'Password Resets'}
                  </span>
                  <span className="text-base font-black font-mono tabular-nums text-amber-600 dark:text-amber-400">
                    {pendingResetsCount}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 1: إدارة المستخدمين (عرض كامل البيانات + بحث بالمعرف والبريد + عمليات)
          ========================================================================= */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Compact Restrictions Quick Bar */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-neutral-900/90 border border-neutral-200/90 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center border border-cyan-500/20 shrink-0">
                <Snowflake className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs sm:text-sm font-bold text-neutral-900 dark:text-white">
                    {isAr ? 'إدارة التجميد والحظر السريع' : 'Quick Freeze & Ban Controls'}
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-mono font-bold">
                    {isAr
                      ? `${frozenUsersCount} مجمّد • ${bannedUsersCount} محظور`
                      : `${frozenUsersCount} Frozen • ${bannedUsersCount} Banned`}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                  {isAr
                    ? 'يمكنك التجميد بالدقائق أو الحظر من بطاقة كل مستخدم أو من التبويب المخصص'
                    : 'Freeze by minutes or ban from user cards or the dedicated tab'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('restrictions')}
              className="px-3.5 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0 active:scale-95"
            >
              <Snowflake className="w-3.5 h-3.5" />
              <span>{isAr ? 'فتح إدارة التجميد والحظر' : 'Open Freeze & Ban'}</span>
            </button>
          </div>

          {/* Default Bio Configuration Card (البايو الافتراضي عند البدء للمستخدمين الجدد) */}
          <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-3 relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-500/20">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-neutral-900 dark:text-white">
                    {isAr ? 'البايو الافتراضي عند البدء للمستخدمين الجدد' : 'Default Bio for New Users'}
                  </h3>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    {isAr
                      ? 'النص الذي يظهر في ملف أي مستخدم جديد عند تسجيل حسابه لأول مرة قبل تعيين وصفه الخاص'
                      : 'Default description assigned to new profiles before setting their custom bio'}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <div className="relative">
                <textarea
                  rows={2}
                  value={defaultBioInput}
                  onChange={(e) => setDefaultBioInput(e.target.value)}
                  className="w-full p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs sm:text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 resize-none leading-relaxed"
                  placeholder={isAr ? 'اكتب البايو الافتراضي...' : 'Enter default bio...'}
                />
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-neutral-600 dark:text-neutral-400 select-none">
                  <input
                    type="checkbox"
                    checked={applyBioToExisting}
                    onChange={(e) => setApplyBioToExisting(e.target.checked)}
                    className="rounded border-neutral-300 text-cyan-500 focus:ring-cyan-500"
                  />
                  <span>
                    {isAr
                      ? 'تطبيق وتحديث البايو أيضاً لجميع المستخدمين الذين لم يحددوا وصفاً خاصاً بعد'
                      : 'Also apply to registered users who haven’t set a custom bio yet'}
                  </span>
                </label>

                <button
                  type="button"
                  disabled={isSavingDefaultBio || !defaultBioInput.trim()}
                  onClick={handleSaveDefaultBio}
                  className="self-end sm:self-auto px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-black text-xs transition-all cursor-pointer shadow-sm disabled:opacity-50 flex items-center gap-1.5 active:scale-95 shrink-0"
                >
                  {isSavingDefaultBio ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  )}
                  <span>{isAr ? 'حفظ البايو الافتراضي' : 'Save Default Bio'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Search Box */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-lg">
              <Search className="w-4 h-4 text-neutral-400 absolute right-3.5 top-1/2 -translate-y-1/2 rtl:right-3.5 rtl:left-auto ltr:left-3.5 ltr:right-auto" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder={
                  isAr
                    ? 'بحث بالمعرف الرقمي (ID)، البريد الإلكتروني، أو اسم المستخدم...'
                    : 'Search by Account ID, Email, or Username...'
                }
                className="w-full py-2.5 px-9 text-xs sm:text-sm rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 focus:border-amber-500 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none shadow-xs"
              />
              {userSearch && (
                <button
                  type="button"
                  onClick={() => setUserSearch('')}
                  className="absolute left-3 top-1/2 -translate-y-1/2 rtl:left-3 rtl:right-auto ltr:right-3 ltr:left-auto text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter by Status & Reported */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setFilterUserStatus('all');
                  setFilterReportedUsersOnly(false);
                }}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border shadow-2xs ${
                  filterUserStatus === 'all' && !filterReportedUsersOnly
                    ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-neutral-900 dark:border-white'
                    : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300'
                }`}
              >
                <span>{isAr ? 'الكل' : 'All'}</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono opacity-80">
                  {users.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFilterUserStatus(filterUserStatus === 'frozen' ? 'all' : 'frozen');
                  setFilterReportedUsersOnly(false);
                }}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border shadow-2xs ${
                  filterUserStatus === 'frozen'
                    ? 'bg-cyan-600 text-white border-cyan-600 ring-2 ring-cyan-500/30'
                    : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-cyan-500/40'
                }`}
                title={isAr ? 'تصفية الحسابات المجمدة' : 'Filter frozen accounts'}
              >
                <Snowflake className={`w-3.5 h-3.5 ${filterUserStatus === 'frozen' ? 'text-white' : 'text-cyan-500'}`} />
                <span>{isAr ? 'المجمدين' : 'Frozen'}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${filterUserStatus === 'frozen' ? 'bg-white/20' : 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-black'}`}>
                  {users.filter((u) => u.isFrozen).length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFilterUserStatus(filterUserStatus === 'banned' ? 'all' : 'banned');
                  setFilterReportedUsersOnly(false);
                }}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border shadow-2xs ${
                  filterUserStatus === 'banned'
                    ? 'bg-rose-600 text-white border-rose-600 ring-2 ring-rose-500/30'
                    : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-rose-500/40'
                }`}
                title={isAr ? 'تصفية الحسابات المحظورة نهائياً' : 'Filter banned accounts'}
              >
                <Ban className={`w-3.5 h-3.5 ${filterUserStatus === 'banned' ? 'text-white' : 'text-rose-500'}`} />
                <span>{isAr ? 'المحظورين' : 'Banned'}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${filterUserStatus === 'banned' ? 'bg-white/20' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 font-black'}`}>
                  {users.filter((u) => u.isBanned).length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFilterReportedUsersOnly((prev) => !prev);
                  if (!filterReportedUsersOnly) setFilterUserStatus('all');
                }}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border shadow-2xs ${
                  filterReportedUsersOnly
                    ? 'bg-amber-600 text-white border-amber-600 ring-2 ring-amber-500/30'
                    : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-amber-500/40'
                }`}
                title={isAr ? 'تصفية المستخدمين الذين تم تقديم بلاغات ضدهم' : 'Filter users with reports'}
              >
                <Flag className={`w-3.5 h-3.5 ${filterReportedUsersOnly ? 'text-white' : 'text-amber-500'}`} />
                <span>{isAr ? 'المبلغ عنهم' : 'Reported'}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${filterReportedUsersOnly ? 'bg-white/20' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 font-black'}`}>
                  {users.filter((u) => (u.reportsCount || 0) > 0).length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFilterUserStatus(filterUserStatus === 'verified' ? 'all' : 'verified');
                  setFilterReportedUsersOnly(false);
                }}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border shadow-2xs ${
                  filterUserStatus === 'verified'
                    ? 'bg-[#1D9BF0] text-white border-[#1D9BF0] ring-2 ring-[#1D9BF0]/30'
                    : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-[#1D9BF0]/40'
                }`}
                title={isAr ? 'تصفية الحسابات الموثقة بالشارة الزرقاء' : 'Filter verified accounts'}
              >
                <BadgeCheck className={`w-3.5 h-3.5 ${filterUserStatus === 'verified' ? 'text-white' : 'text-[#1D9BF0]'}`} />
                <span>{isAr ? 'الموثقين' : 'Verified'}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${filterUserStatus === 'verified' ? 'bg-white/20' : 'bg-[#1D9BF0]/10 text-[#1D9BF0] font-black'}`}>
                  {verifiedUsersCount}
                </span>
              </button>

              <div className="text-xs text-neutral-500 self-center">
                {isAr ? `إجمالي النتائج: ${filteredUsers.length}` : `Total results: ${filteredUsers.length}`}
              </div>
            </div>
          </div>

          {/* Users List / Table */}
          {filteredUsers.length === 0 ? (
            <div className="py-16 text-center space-y-2 bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800">
              <Users className="w-8 h-8 text-neutral-400 mx-auto" />
              <p className="text-xs text-neutral-500">
                {isAr ? 'لا يوجد مستخدمين يطابقون البحث بالمعرف أو البريد' : 'No users match your ID or email search'}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredUsers.map((u) => {
                const existingAgent = agents.find(
                  (a) => a.email.toLowerCase() === u.email.toLowerCase()
                );
                return (
                  <div
                    key={u.id}
                    className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-amber-500/40 transition-all shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    {/* Compact User Account Summary */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-cyan-600 via-indigo-700 to-neutral-900 text-white font-bold text-sm flex items-center justify-center shrink-0 border border-neutral-200 dark:border-neutral-700 shadow-xs overflow-hidden">
                        {u.photoUrl ? (
                          <img src={u.photoUrl} alt={u.name} className="w-full h-full object-cover" />
                        ) : (
                          u.name.substring(0, 2)
                        )}
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-bold text-neutral-900 dark:text-white inline-flex items-center gap-1 min-w-0">
                            <span className="truncate">{u.name}</span>
                            {u.isVerified && <VerifiedBadge lang={lang} size="sm" />}
                          </span>

                          <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 font-bold">
                            ID: {u.displayId || u.id}
                          </span>

                          {existingAgent && (
                            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                              <Building2 className="w-3 h-3" />
                              <span>{isAr ? 'وكيل' : 'Agent'}</span>
                            </span>
                          )}

                          {u.isBanned && (
                            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-bold bg-rose-600/15 text-rose-600 dark:text-rose-400 border border-rose-600/30">
                              <Ban className="w-3 h-3" />
                              <span>{isAr ? 'محظور' : 'Banned'}</span>
                            </span>
                          )}

                          {u.isFrozen && (
                            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-bold bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30">
                              <Snowflake className="w-3 h-3" />
                              <span>{isAr ? 'مجمّد' : 'Frozen'}</span>
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-neutral-500 dark:text-neutral-400 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="font-mono text-neutral-700 dark:text-neutral-300 truncate max-w-[230px] sm:max-w-xs">
                            {u.email}
                          </span>
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] text-cyan-600 dark:text-cyan-400 font-bold">
                            <DiamondIcon className="w-3 h-3" />
                            <span>{(typeof u.walletBalance === 'number' ? u.walletBalance : 0).toLocaleString()}</span>
                          </span>
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] text-amber-600 dark:text-amber-400 font-bold">
                            <CoinIcon className="w-3 h-3" />
                            <span>{(typeof u.coinsBalance === 'number' ? u.coinsBalance : 0).toLocaleString()}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Simple Button to Open Account Details & Actions Menu */}
                    <button
                      type="button"
                      onClick={() => setSelectedActionUser(u)}
                      className="self-end sm:self-center px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-950 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      <span>{isAr ? 'تفاصيل وإجراءات' : 'Details & Actions'}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB: قسم إدارة التجميد والحظر (مركز التحكم بالتجميد بالدقائق والحظر وفك التجميد والحظر)
          ========================================================================= */}
      {activeTab === 'restrictions' && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="p-4 sm:p-6 rounded-3xl bg-gradient-to-r from-cyan-500/15 via-rose-500/10 to-transparent border-2 border-cyan-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center -space-x-2 rtl:space-x-reverse">
                  <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center border border-cyan-500/30 shadow-2xs">
                    <Snowflake className="w-5 h-5 animate-pulse" />
                  </div>
                  <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-500/30 shadow-2xs">
                    <Ban className="w-5 h-5" />
                  </div>
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-neutral-900 dark:text-white">
                    {isAr ? 'مركز إدارة التجميد والحظر الإداري' : 'Administrative Freeze & Ban Control Center'}
                  </h2>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {isAr
                      ? 'تجميد الحسابات بالدقائق مع عداد تنازلي حي، أو حظر الحسابات نهائياً، مع إمكانية فك التجميد وفك الحظر فوراً'
                      : 'Freeze accounts by minutes with live countdown, or ban permanently, with instant unfreeze/unban'}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Summary Badges */}
            <div className="flex items-center gap-2 self-end sm:self-center">
              <div className="px-3.5 py-1.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-700 dark:text-cyan-300 text-xs font-bold flex items-center gap-1.5">
                <Snowflake className="w-3.5 h-3.5 text-cyan-500" />
                <span>{isAr ? 'المجمدين:' : 'Frozen:'}</span>
                <span className="font-mono font-black">{users.filter((u) => u.isFrozen).length}</span>
              </div>
              <div className="px-3.5 py-1.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-1.5">
                <Ban className="w-3.5 h-3.5 text-rose-500" />
                <span>{isAr ? 'المحظورين:' : 'Banned:'}</span>
                <span className="font-mono font-black">{users.filter((u) => u.isBanned).length}</span>
              </div>
            </div>
          </div>

          {/* Quick Action: Freeze / Ban Any User */}
          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-neutral-800 pb-3">
              <div className="w-8 h-8 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4 text-cyan-500" />
              </div>
              <div>
                <h3 className="text-sm font-black text-neutral-900 dark:text-white">
                  {isAr ? 'تنفيذ إجراء تجميد أو حظر على مستخدم' : 'Execute Freeze or Ban on User'}
                </h3>
                <p className="text-[11px] text-neutral-500">
                  {isAr ? 'ابحث عن أي مستخدم بالاسم أو المعرف الرقمي أو البريد وحدد الإجراء المطلوب' : 'Search user by ID or email and select action'}
                </p>
              </div>
            </div>

            {/* User Search & Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block">
                  {isAr ? '1. اختيار المستخدم (بالاسم، ID الحساب، أو البريد) *' : '1. Select User (Name, ID, or Email) *'}
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-neutral-400 absolute right-3.5 top-1/2 -translate-y-1/2 rtl:right-3.5 rtl:left-auto ltr:left-3.5 ltr:right-auto" />
                  <input
                    type="text"
                    value={quickRestrictSearch}
                    onChange={(e) => {
                      setQuickRestrictSearch(e.target.value);
                      if (quickRestrictUser) setQuickRestrictUser(null);
                    }}
                    placeholder={isAr ? 'اكتب معرف المستخدم أو بريده...' : 'Search name, ID or email...'}
                    className="w-full py-2.5 px-9 text-xs sm:text-sm rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 focus:border-cyan-500 text-neutral-900 dark:text-white focus:outline-none font-medium"
                  />
                  {quickRestrictSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setQuickRestrictSearch('');
                        setQuickRestrictUser(null);
                      }}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Dropdown Suggestions if searching and no user selected yet */}
                {!quickRestrictUser && quickRestrictSearch.trim().length > 0 && (
                  <div className="mt-1 max-h-48 overflow-y-auto rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xl p-1.5 space-y-1">
                    {users
                      .filter(
                        (u) =>
                          u.name.toLowerCase().includes(quickRestrictSearch.toLowerCase()) ||
                          u.email.toLowerCase().includes(quickRestrictSearch.toLowerCase()) ||
                          u.id.toLowerCase().includes(quickRestrictSearch.toLowerCase()) ||
                          (u.displayId && u.displayId.toLowerCase().includes(quickRestrictSearch.toLowerCase()))
                      )
                      .slice(0, 5)
                      .map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            setQuickRestrictUser(u);
                            setQuickRestrictSearch(`${u.name} (${u.displayId || u.id})`);
                          }}
                          className="w-full text-start p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-between text-xs transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-neutral-900 dark:text-white">{u.name}</span>
                            <span className="text-[10px] text-neutral-400 font-mono">ID: {u.displayId || u.id}</span>
                          </div>
                          {u.isFrozen ? (
                            <span className="text-[10px] font-bold text-cyan-600 bg-cyan-500/10 px-2 py-0.5 rounded-md">
                              {isAr ? 'مجمّد' : 'Frozen'}
                            </span>
                          ) : u.isBanned ? (
                            <span className="text-[10px] font-bold text-rose-600 bg-rose-500/10 px-2 py-0.5 rounded-md">
                              {isAr ? 'محظور' : 'Banned'}
                            </span>
                          ) : (
                            <span className="text-[10px] text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                              {isAr ? 'نشط' : 'Active'}
                            </span>
                          )}
                        </button>
                      ))}
                  </div>
                )}

                {/* Selected User Pill */}
                {quickRestrictUser && (
                  <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-cyan-600 text-white font-bold flex items-center justify-center text-xs">
                        {quickRestrictUser.photoUrl ? (
                          <img src={quickRestrictUser.photoUrl} alt="" className="w-full h-full rounded-full object-cover" />
                        ) : (
                          quickRestrictUser.name.substring(0, 2)
                        )}
                      </div>
                      <div className="text-xs">
                        <div className="font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                          <span>{quickRestrictUser.name}</span>
                          <span className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400">
                            (ID: {quickRestrictUser.displayId || quickRestrictUser.id})
                          </span>
                        </div>
                        <div className="text-[10px] text-neutral-500">{quickRestrictUser.email}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setQuickRestrictUser(null);
                        setQuickRestrictSearch('');
                      }}
                      className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Action Type Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block">
                  {isAr ? '2. نوع الإجراء المطلوب *' : '2. Action Type *'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setQuickRestrictType('freeze')}
                    className={`p-3 rounded-2xl border-2 text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      quickRestrictType === 'freeze'
                        ? 'bg-cyan-500/15 border-cyan-500 text-cyan-700 dark:text-cyan-300 ring-2 ring-cyan-500/20 shadow-xs'
                        : 'bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400'
                    }`}
                  >
                    <Snowflake className="w-4 h-4 text-cyan-500" />
                    <span>{isAr ? 'تجميد مؤقت (بالدقائق)' : 'Temporary Freeze'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setQuickRestrictType('ban')}
                    className={`p-3 rounded-2xl border-2 text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      quickRestrictType === 'ban'
                        ? 'bg-rose-500/15 border-rose-500 text-rose-700 dark:text-rose-300 ring-2 ring-rose-500/20 shadow-xs'
                        : 'bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400'
                    }`}
                  >
                    <Ban className="w-4 h-4 text-rose-500" />
                    <span>{isAr ? 'حظر نهائي' : 'Permanent Ban'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Inputs based on type */}
            {quickRestrictType === 'freeze' ? (
              <div className="p-4 rounded-2xl bg-cyan-500/5 border border-cyan-500/20 space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-cyan-900 dark:text-cyan-300 block">
                    {isAr ? 'مدة التجميد (بالدقائق) *' : 'Freeze Duration (Minutes) *'}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      value={quickFreezeMinutes}
                      onChange={(e) => setQuickFreezeMinutes(e.target.value)}
                      className="w-40 px-3.5 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-xs font-mono font-bold text-neutral-900 dark:text-white"
                      placeholder="60"
                    />
                    <span className="text-xs text-neutral-500 font-bold">{isAr ? 'دقيقة' : 'minutes'}</span>
                  </div>

                  {/* Preset minute buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    {[
                      { label: isAr ? '15 د' : '15m', mins: '15' },
                      { label: isAr ? '30 د' : '30m', mins: '30' },
                      { label: isAr ? 'ساعة (60د)' : '1h (60m)', mins: '60' },
                      { label: isAr ? '3 ساعات (180د)' : '3h', mins: '180' },
                      { label: isAr ? '24 ساعة (يوم)' : '24h', mins: '1440' },
                      { label: isAr ? '3 أيام' : '3 days', mins: '4320' },
                      { label: isAr ? 'أسبوع' : '7 days', mins: '10080' },
                    ].map((p) => (
                      <button
                        key={p.mins}
                        type="button"
                        onClick={() => setQuickFreezeMinutes(p.mins)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                          quickFreezeMinutes === p.mins
                            ? 'bg-cyan-600 text-white border-cyan-600 shadow-2xs'
                            : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block">
                    {isAr ? 'سبب التجميد (يظهر للمستخدم في شاشة القفل - اختياري)' : 'Freeze Reason (shown to user)'}
                  </label>
                  <input
                    type="text"
                    value={quickRestrictReason}
                    onChange={(e) => setQuickRestrictReason(e.target.value)}
                    placeholder={isAr ? 'مثال: مخالفة معايير المحادثة أو إرسال رسائل غير لائقة' : 'e.g. Inappropriate messages'}
                    className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-xs text-neutral-900 dark:text-white"
                  />
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/20 space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-rose-900 dark:text-rose-300 block">
                    {isAr ? 'سبب الحظر النهائي (يظهر للمستخدم في شاشة المنع - اختياري)' : 'Ban Reason (shown to user)'}
                  </label>
                  <input
                    type="text"
                    value={quickRestrictReason}
                    onChange={(e) => setQuickRestrictReason(e.target.value)}
                    placeholder={isAr ? 'مثال: انتهاك جسيم لقوانين المنصة أو احتيال' : 'e.g. Terms of service violation'}
                    className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-xs text-neutral-900 dark:text-white"
                  />
                </div>
              </div>
            )}

            {/* Execute Button */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                disabled={!quickRestrictUser || isSubmittingQuickAction}
                onClick={handleQuickExecuteRestriction}
                className={`px-6 py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer shadow-md flex items-center gap-2 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
                  quickRestrictType === 'freeze'
                    ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-600/20'
                    : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20'
                }`}
              >
                {isSubmittingQuickAction ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : quickRestrictType === 'freeze' ? (
                  <Snowflake className="w-4 h-4" />
                ) : (
                  <Ban className="w-4 h-4" />
                )}
                <span>
                  {quickRestrictType === 'freeze'
                    ? isAr
                      ? `تأكيد تجميد الحساب (${quickFreezeMinutes} دقيقة)`
                      : `Confirm Freeze (${quickFreezeMinutes}m)`
                    : isAr
                    ? 'تأكيد الحظر النهائي للمستخدم'
                    : 'Confirm Permanent Ban'}
                </span>
              </button>
            </div>
          </div>

          {/* List 1: Currently Frozen Accounts (الحسابات المجمدة حالياً) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-600 flex items-center justify-center">
                  <Snowflake className="w-4 h-4 animate-pulse" />
                </div>
                <h3 className="text-sm font-black text-neutral-900 dark:text-white">
                  {isAr ? 'الحسابات المجمدة حالياً (مع العداد التنازلي لفك التجميد)' : 'Currently Frozen Accounts'}
                </h3>
              </div>
              <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 font-black">
                {users.filter((u) => u.isFrozen).length}
              </span>
            </div>

            {users.filter((u) => u.isFrozen).length === 0 ? (
              <div className="p-8 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <p className="text-xs text-neutral-500 font-bold">
                  {isAr ? 'لا توجد أي حسابات مجمدة حالياً في النظام' : 'No accounts currently frozen'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {users
                  .filter((u) => u.isFrozen)
                  .map((u) => {
                    const remainingMins =
                      typeof u.freezeRemainingMs === 'number'
                        ? Math.max(0, Math.ceil(u.freezeRemainingMs / 60000))
                        : u.freezeExpiresAt
                        ? Math.max(0, Math.ceil((new Date(u.freezeExpiresAt).getTime() - Date.now()) / 60000))
                        : 0;

                    return (
                      <div
                        key={u.id}
                        className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border-2 border-cyan-500/40 shadow-xs space-y-3 flex flex-col justify-between"
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-cyan-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                                {u.photoUrl ? (
                                  <img src={u.photoUrl} alt="" className="w-full h-full rounded-full object-cover" />
                                ) : (
                                  u.name.substring(0, 2)
                                )}
                              </div>
                              <div>
                                <h4 className="text-sm font-black text-neutral-900 dark:text-white">{u.name}</h4>
                                <div className="text-[11px] font-mono text-neutral-500">ID: {u.displayId || u.id}</div>
                              </div>
                            </div>
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                              <Clock className="w-3 h-3 animate-spin" />
                              <span>{isAr ? `متبقي ~${remainingMins} دقيقة` : `~${remainingMins}m left`}</span>
                            </span>
                          </div>

                          {/* Reason */}
                          <div className="text-xs bg-cyan-500/10 p-2.5 rounded-xl border border-cyan-500/20 text-cyan-900 dark:text-cyan-200">
                            <span className="font-bold">{isAr ? 'السبب: ' : 'Reason: '}</span>
                            <span>{u.freezeReason || (isAr ? 'تجميد إداري مؤقت' : 'Temporary freeze')}</span>
                          </div>

                          <div className="text-[11px] text-neutral-500 flex items-center gap-2">
                            <span>{isAr ? 'المدة الأصلية:' : 'Duration:'} {u.freezeDurationMinutes || 0} دقيقة</span>
                            {u.frozenAt && (
                              <span>• {isAr ? 'بدأ في:' : 'Started:'} {formatLocalDateTime(u.frozenAt, isAr ? 'ar' : 'en')}</span>
                            )}
                          </div>
                        </div>

                        {/* Unfreeze Action Button */}
                        <div className="pt-1 flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleUnfreezeUser(u)}
                            className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-black text-xs transition-all cursor-pointer shadow-xs flex items-center gap-1.5 active:scale-95"
                          >
                            <Unlock className="w-4 h-4 stroke-[2.5]" />
                            <span>{isAr ? 'فك التجميد الآن' : 'Unfreeze Now'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* List 2: Currently Banned Accounts (الحسابات المحظورة نهائياً) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-rose-500/20 text-rose-600 flex items-center justify-center">
                  <Ban className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-black text-neutral-900 dark:text-white">
                  {isAr ? 'الحسابات المحظورة نهائياً' : 'Permanently Banned Accounts'}
                </h3>
              </div>
              <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300 font-black">
                {users.filter((u) => u.isBanned).length}
              </span>
            </div>

            {users.filter((u) => u.isBanned).length === 0 ? (
              <div className="p-8 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <p className="text-xs text-neutral-500 font-bold">
                  {isAr ? 'لا توجد أي حسابات محظورة نهائياً في النظام' : 'No accounts permanently banned'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {users
                  .filter((u) => u.isBanned)
                  .map((u) => (
                    <div
                      key={u.id}
                      className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border-2 border-rose-500/40 shadow-xs space-y-3 flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-rose-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                              {u.photoUrl ? (
                                <img src={u.photoUrl} alt="" className="w-full h-full rounded-full object-cover" />
                              ) : (
                                u.name.substring(0, 2)
                              )}
                            </div>
                            <div>
                              <h4 className="text-sm font-black text-neutral-900 dark:text-white">{u.name}</h4>
                              <div className="text-[11px] font-mono text-neutral-500">ID: {u.displayId || u.id}</div>
                            </div>
                          </div>
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30 flex items-center gap-1">
                            <Ban className="w-3 h-3 text-rose-500" />
                            <span>{isAr ? 'حظر نهائي' : 'Banned'}</span>
                          </span>
                        </div>

                        {/* Ban Details */}
                        <div className="text-xs bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20 text-rose-900 dark:text-rose-200">
                          <span className="font-bold">{isAr ? 'سبب الحظر: ' : 'Reason: '}</span>
                          <span>{u.banReason || (isAr ? 'حظر إداري نهائي' : 'Permanent ban')}</span>
                        </div>

                        {u.bannedAt && (
                          <div className="text-[11px] text-neutral-500">
                            {isAr ? 'تاريخ الحظر:' : 'Banned at:'} {formatLocalDateTime(u.bannedAt, isAr ? 'ar' : 'en')}
                          </div>
                        )}
                      </div>

                      {/* Unban Action Button */}
                      <div className="pt-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleUnbanUser(u)}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition-all cursor-pointer shadow-xs flex items-center gap-1.5 active:scale-95"
                        >
                          <UserCheck className="w-4 h-4 stroke-[2.5]" />
                          <span>{isAr ? 'إلغاء الحظر الآن' : 'Unban Now'}</span>
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: قسم إدارة الوكلاء (إضافة وحذف وتعديل رصيد وكيل وتعيين دولته بالبريد)
          ========================================================================= */}
      {activeTab === 'agents' && (
        <div className="space-y-5">
          {/* Agents Management Header Bar */}
          <div className="p-4 sm:p-6 rounded-3xl bg-gradient-to-r from-amber-500/10 via-cyan-500/5 to-transparent border border-amber-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-amber-500" />
                <h2 className="text-base sm:text-lg font-black text-neutral-900 dark:text-white">
                  {isAr ? 'إدارة شبكة وكلاء الإيداع والسحب' : 'Deposit & Cashout Agents Management'}
                </h2>
              </div>
              <p className="text-xs text-neutral-500">
                {isAr
                  ? 'تعيين الوكلاء بالبريد الإلكتروني وتحديد دولهم وأرصدتهم للظهور في المحفظة مع أزرار المراسلة المباشرة'
                  : 'Assign agents by email, set their country & balance for wallet deposit and cashout display'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleOpenAddAgent()}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs flex items-center gap-2 transition-all shadow-md cursor-pointer shrink-0"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{isAr ? 'إضافة وكيل جديد' : 'Add New Agent'}</span>
            </button>
          </div>

          {/* Search & Category Filter */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-neutral-400 absolute right-3.5 top-1/2 -translate-y-1/2 rtl:right-3.5 rtl:left-auto ltr:left-3.5 ltr:right-auto" />
              <input
                type="text"
                value={agentSearch}
                onChange={(e) => setAgentSearch(e.target.value)}
                placeholder={isAr ? 'ابحث باسم الوكيل، البريد، الدولة، أو طريقة الدفع...' : 'Search by agent name, email, country...'}
                className="w-full py-2.5 px-9 text-xs sm:text-sm rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 focus:border-amber-500 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none shadow-xs"
              />
            </div>

            {/* Category Filter Chips */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs">
              <button
                type="button"
                onClick={() => setAgentCategoryFilter('all')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                  agentCategoryFilter === 'all'
                    ? 'bg-white dark:bg-neutral-800 text-amber-600 dark:text-amber-400 shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                {isAr ? `الكل (${agents.length})` : `All (${agents.length})`}
              </button>

              <button
                type="button"
                onClick={() => setAgentCategoryFilter('recharge')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                  agentCategoryFilter === 'recharge'
                    ? 'bg-white dark:bg-neutral-800 text-cyan-600 dark:text-cyan-400 shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                {isAr ? 'إيداع وشحن' : 'Recharge'}
              </button>

              <button
                type="button"
                onClick={() => setAgentCategoryFilter('withdraw')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                  agentCategoryFilter === 'withdraw'
                    ? 'bg-white dark:bg-neutral-800 text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                {isAr ? 'سحب وكاش أوت' : 'Withdraw'}
              </button>
            </div>
          </div>

          {/* Agents Grid */}
          {filteredAgents.length === 0 ? (
            <div className="py-16 text-center space-y-2 bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800">
              <Building2 className="w-8 h-8 text-neutral-400 mx-auto" />
              <p className="text-xs text-neutral-500">
                {isAr ? 'لا يوجد وكلاء يطابقون البحث' : 'No agents match your search'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredAgents.map((agent) => (
                <div
                  key={agent.id}
                  className="p-5 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-amber-500/40 transition-all shadow-xs space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    {/* Agent Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-neutral-100 to-neutral-200 dark:from-neutral-800 dark:to-neutral-950 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center text-2xl shadow-xs shrink-0">
                          <span>{agent.flag}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-sm sm:text-base text-neutral-900 dark:text-white">
                              {agent.name}
                            </h3>
                            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
                              <BadgeCheck className="w-3 h-3" />
                              <span>{isAr ? 'وكيل معتمد' : 'Accredited'}</span>
                            </span>
                          </div>
                          <div className="text-xs text-neutral-500 flex items-center gap-1.5 mt-0.5">
                            <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                              {agent.flag} {agent.country}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Category Badge */}
                      <span
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                          agent.category === 'both'
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                            : agent.category === 'recharge'
                            ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20'
                            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                        }`}
                      >
                        {agent.category === 'both'
                          ? (isAr ? 'إيداع وسحب' : 'Deposit & Cashout')
                          : agent.category === 'recharge'
                          ? (isAr ? 'شحن وإيداع' : 'Deposit only')
                          : (isAr ? 'سحب فقط' : 'Withdraw only')}
                      </span>
                    </div>

                    {/* Agent Email, Grid ID & Balance Card */}
                    <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-500">{isAr ? 'رقم القريد (Grid ID):' : 'Agent Grid ID:'}</span>
                        <span className="font-mono font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20 text-xs">
                          {agent.gridCode || 'A8838'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-neutral-200/50 dark:border-neutral-800">
                        <span className="text-neutral-500">{isAr ? 'البريد المعين للوكيل:' : 'Assigned Email:'}</span>
                        <span className="font-mono font-bold text-neutral-800 dark:text-neutral-200">{agent.email}</span>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-neutral-200/50 dark:border-neutral-800">
                        <span className="text-neutral-500">{isAr ? 'رصيد وكالة الشحن المتاح:' : 'Available Agency Balance:'}</span>
                        <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-sm inline-flex items-center gap-1">
                          <span>{(agent.balance || 0).toLocaleString()}</span>
                          <DiamondIcon className="w-3.5 h-3.5 text-amber-400" />
                        </span>
                      </div>

                      {/* Linked Personal Account Balance (Strict Separation Guarantee) */}
                      {(() => {
                        const linkedUser = users.find((u) => u.email.toLowerCase() === agent.email.toLowerCase());
                        if (linkedUser) {
                          return (
                            <div className="pt-2 border-t border-neutral-200/60 dark:border-neutral-800 bg-cyan-500/5 dark:bg-cyan-950/20 p-2.5 rounded-xl border border-cyan-500/15 space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-cyan-700 dark:text-cyan-300 font-bold text-[11px] flex items-center gap-1">
                                  <Sparkles className="w-3 h-3 text-cyan-500" />
                                  <span>{isAr ? 'الحساب الشخصي للوكيل:' : 'Personal Account:'}</span>
                                </span>
                                <span className="text-[10px] font-mono text-neutral-400">
                                  ID: {linkedUser.displayId || linkedUser.id}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400 inline-flex items-center gap-1">
                                    <span>{(linkedUser.walletBalance || 0).toLocaleString()}</span>
                                    <DiamondIcon className="w-3 h-3 text-cyan-400" />
                                  </span>
                                  <span className="text-neutral-300 dark:text-neutral-700">•</span>
                                  <span className="font-mono font-bold text-amber-500 inline-flex items-center gap-1">
                                    <span>{(linkedUser.coinsBalance || 0).toLocaleString()}</span>
                                    <CoinIcon className="w-3 h-3" />
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleOpenBalanceModal(linkedUser)}
                                  className="text-[10px] px-2 py-0.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 font-bold transition-colors cursor-pointer"
                                  title={isAr ? 'تعديل رصيد الحساب الشخصي' : 'Edit Personal Balance'}
                                >
                                  {isAr ? 'تعديل الشخصي' : 'Edit Personal'}
                                </button>
                              </div>
                              <div className="text-[10px] text-neutral-400 dark:text-neutral-400">
                                {isAr ? '🛡️ رصيد الحساب الشخصي ورصيد الوكالة منفصلان كلياً' : '🛡️ Personal and agency balances are strictly isolated'}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>

                    {/* Methods & Channels */}
                    <div className="space-y-1.5 text-xs">
                      <div className="text-[11px] font-semibold text-neutral-400">
                        {isAr ? 'طرق الدفع المعينة:' : 'Supported Payment Methods:'}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {agent.methods.map((method, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-[10px] font-medium border border-neutral-200/50 dark:border-neutral-700"
                          >
                            {method}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Contact Links */}
                    {(agent.whatsapp || agent.telegram) && (
                      <div className="flex items-center gap-2 pt-1 text-xs">
                        {agent.whatsapp && (
                          <span className="inline-flex items-center gap-1 text-[#25D366] font-mono text-[11px]">
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>{agent.whatsapp}</span>
                          </span>
                        )}
                        {agent.telegram && (
                          <span className="inline-flex items-center gap-1 text-[#24A1DE] font-mono text-[11px] mx-2">
                            <Send className="w-3.5 h-3.5" />
                            <span>@{agent.telegram}</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Agent Actions Bar */}
                  <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenAgentBalanceModal(agent)}
                      className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Coins className="w-3.5 h-3.5" />
                      <span>{isAr ? 'تعديل الرصيد' : 'Modify Balance'}</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEditAgent(agent)}
                        className="p-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
                        title={isAr ? 'تعديل بيانات الوكيل' : 'Edit Agent'}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDeletingAgent(agent);
                          setDeletingAgentId(agent.id);
                        }}
                        className="p-2 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-950/50 text-red-600 dark:text-red-400 transition-colors cursor-pointer"
                        title={isAr ? 'حذف الوكيل' : 'Delete Agent'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB: الإذاعة العامة والإشعارات الموجهة (مركز الإشعارات)
          ========================================================================= */}
      {activeTab === 'broadcast' && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="p-4 sm:p-6 rounded-3xl bg-gradient-to-r from-violet-500/15 via-purple-500/10 to-transparent border border-violet-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-violet-500/20 text-violet-600 dark:text-violet-400 flex items-center justify-center font-bold">
                  <Megaphone className="w-4.5 h-4.5" />
                </div>
                <h3 className="text-base sm:text-lg font-black text-neutral-900 dark:text-white">
                  {isAr ? 'الإذاعة العامة ورسائل مركز الإشعارات' : 'Broadcast & Notifications'}
                </h3>
              </div>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 max-w-xl leading-relaxed">
                {isAr
                  ? 'إرسال إذاعة عامة تصل فوراً إلى مركز إشعارات كافة المستخدمين المسجلين، أو إرسال رسالة إدارية رسمية موجهة لمستخدم معين.'
                  : 'Broadcast official announcements to all registered users or send targeted private messages directly to their notification center.'}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="px-3 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-violet-500/30 text-xs font-mono font-bold text-violet-700 dark:text-violet-300">
                {isAr ? `المستخدمون المسجلون: ${users.length}` : `Users: ${users.length}`}
              </div>
            </div>
          </div>

          {/* Broadcast Composer Card */}
          <div className="p-4 sm:p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-5 shadow-xs">
            {/* Target Selector Buttons */}
            <div>
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-2">
                {isAr ? 'نوع وجهة الإرسال:' : 'Target Recipient Type:'}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-md">
                <button
                  type="button"
                  onClick={() => {
                    setBroadcastTargetType('all');
                    setBroadcastSelectedUser(null);
                  }}
                  className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    broadcastTargetType === 'all'
                      ? 'bg-violet-500/15 border-violet-500 text-violet-700 dark:text-violet-300 shadow-xs'
                      : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                  }`}
                >
                  <Megaphone className="w-4 h-4" />
                  <span>{isAr ? '📢 إذاعة عامة (لكافة المستخدمين)' : '📢 Public Broadcast (All Users)'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setBroadcastTargetType('single')}
                  className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    broadcastTargetType === 'single'
                      ? 'bg-cyan-500/15 border-cyan-500 text-cyan-700 dark:text-cyan-300 shadow-xs'
                      : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>{isAr ? '👤 رسالة خاصة لمستخدم محدد' : '👤 Private Message (Single User)'}</span>
                </button>
              </div>
            </div>

            {/* Targeted User Selector Section (Only if targetType === 'single') */}
            {broadcastTargetType === 'single' && (
              <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-cyan-500" />
                    {isAr ? 'تحديد المستخدم المستهدف:' : 'Select Target User:'}
                  </span>
                  {broadcastSelectedUser && (
                    <button
                      type="button"
                      onClick={() => setBroadcastSelectedUser(null)}
                      className="text-xs text-red-500 hover:underline cursor-pointer"
                    >
                      {isAr ? 'إلغاء الاختيار وتغيير المستخدم' : 'Change User'}
                    </button>
                  )}
                </div>

                {broadcastSelectedUser ? (
                  <div className="p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={
                          broadcastSelectedUser.photoUrl ||
                          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'
                        }
                        alt={broadcastSelectedUser.name}
                        className="w-10 h-10 rounded-full object-cover border border-cyan-500/40"
                      />
                      <div>
                        <div className="font-bold text-xs sm:text-sm text-neutral-900 dark:text-white">
                          {broadcastSelectedUser.name}
                        </div>
                        <div className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
                          ID: {broadcastSelectedUser.displayId || broadcastSelectedUser.id} • {broadcastSelectedUser.email}
                        </div>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-cyan-500 text-neutral-950 text-[11px] font-black shrink-0">
                      {isAr ? 'تم التحديد' : 'Selected'}
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="w-4 h-4 text-neutral-400 absolute right-3 top-1/2 -translate-y-1/2 rtl:right-3 rtl:left-auto ltr:left-3 ltr:right-auto" />
                      <input
                        type="text"
                        value={broadcastUserSearch}
                        onChange={(e) => setBroadcastUserSearch(e.target.value)}
                        placeholder={
                          isAr
                            ? 'ابحث باسم المستخدم، البريد، أو المعرف ID...'
                            : 'Search user by name, email, or ID...'
                        }
                        className="w-full text-xs pr-9 pl-3 rtl:pr-9 rtl:pl-3 ltr:pl-9 ltr:pr-3 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    <div className="max-h-44 overflow-y-auto space-y-1.5 pt-1">
                      {users
                        .filter((u) => {
                          if (!broadcastUserSearch.trim()) return true;
                          const q = broadcastUserSearch.trim().toLowerCase();
                          return (
                            u.name.toLowerCase().includes(q) ||
                            u.email.toLowerCase().includes(q) ||
                            u.id.toLowerCase().includes(q) ||
                            (u.displayId && u.displayId.toLowerCase().includes(q))
                          );
                        })
                        .slice(0, 10)
                        .map((u) => (
                          <div
                            key={u.id}
                            className="p-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-cyan-500/50 flex items-center justify-between gap-2 transition-colors"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <img
                                src={
                                  u.photoUrl ||
                                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'
                                }
                                alt={u.name}
                                className="w-8 h-8 rounded-full object-cover shrink-0"
                              />
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-neutral-900 dark:text-white truncate">
                                  {u.name}
                                </div>
                                <div className="text-[10px] font-mono text-neutral-400 truncate">
                                  {u.displayId || u.id} • {u.email}
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setBroadcastSelectedUser(u)}
                              className="px-3 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-bold text-xs shrink-0 cursor-pointer shadow-xs active:scale-95"
                            >
                              {isAr ? 'اختيار' : 'Select'}
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Quick Templates Buttons */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>{isAr ? 'قوالب جاهزة للتعبئة السريعة:' : 'Quick Ready Templates:'}</span>
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleApplyTemplate('update')}
                  className="px-2.5 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-semibold cursor-pointer transition-colors"
                >
                  🚀 {isAr ? 'تحديث جديد' : 'New Update'}
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyTemplate('gift')}
                  className="px-2.5 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-semibold cursor-pointer transition-colors"
                >
                  🎁 {isAr ? 'مكافأة مجتمعية' : 'Community Reward'}
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyTemplate('maintenance')}
                  className="px-2.5 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-semibold cursor-pointer transition-colors"
                >
                  ⚠️ {isAr ? 'صيانة خوادم' : 'Maintenance'}
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyTemplate('welcome')}
                  className="px-2.5 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-semibold cursor-pointer transition-colors"
                >
                  🌟 {isAr ? 'ترحيب بالأعضاء' : 'Welcome'}
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyTemplate('security')}
                  className="px-2.5 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-semibold cursor-pointer transition-colors"
                >
                  🛡️ {isAr ? 'إرشادات الأمان' : 'Security'}
                </button>
              </div>
            </div>

            {/* Inputs Form */}
            <div className="space-y-4">
              {broadcastTargetType === 'single' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Title Arabic (Optional for Admin Message) */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300">
                      {isAr ? 'البادئة (اختياري — الافتراضي: رسالة من الإدارة:)' : 'Prefix (Optional)'}
                    </label>
                    <input
                      type="text"
                      value={broadcastTitleAr}
                      onChange={(e) => setBroadcastTitleAr(e.target.value)}
                      placeholder="رسالة من الإدارة:"
                      className="w-full text-xs px-3 py-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white focus:outline-none focus:border-violet-500 font-medium"
                    />
                  </div>

                  {/* Title English */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300">
                      {isAr ? 'البادئة بالإنجليزية (اختياري)' : 'Prefix (English - Optional)'}
                    </label>
                    <input
                      type="text"
                      value={broadcastTitleEn}
                      onChange={(e) => setBroadcastTitleEn(e.target.value)}
                      placeholder="Message from Administration:"
                      dir="ltr"
                      className="w-full text-xs px-3 py-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white focus:outline-none focus:border-violet-500 font-medium"
                    />
                  </div>
                </div>
              )}

              {/* Message Arabic */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300">
                  {broadcastTargetType === 'all'
                    ? isAr
                      ? 'نص الإذاعة العامة (تصل كما تكتبها تماماً بدون أي حرف زيادة أو نقصان) *'
                      : 'Public Broadcast Text (Delivered verbatim) *'
                    : isAr
                    ? 'محتوى الرسالة (بالعربية) *'
                    : 'Message Content (Arabic) *'}
                </label>
                <textarea
                  rows={4}
                  value={broadcastMessageAr}
                  onChange={(e) => setBroadcastMessageAr(e.target.value)}
                  placeholder={
                    broadcastTargetType === 'all'
                      ? isAr
                        ? 'اكتب نص الإذاعة هنا كما تريد وصوله تماماً إلى المستخدمين...'
                        : 'Write the exact broadcast text...'
                      : isAr
                      ? 'اكتب محتوى الرسالة من الإدارة...'
                      : 'Write the admin message content...'
                  }
                  className="w-full text-xs p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white focus:outline-none focus:border-violet-500 font-medium leading-relaxed resize-none"
                />
              </div>

              {/* Message English */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300">
                  {isAr ? 'نص الرسالة (بالإنجليزية - اختياري)' : 'Message (English - Optional)'}
                </label>
                <textarea
                  rows={2}
                  value={broadcastMessageEn}
                  onChange={(e) => setBroadcastMessageEn(e.target.value)}
                  placeholder="Optional English translation..."
                  dir="ltr"
                  className="w-full text-xs p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white focus:outline-none focus:border-violet-500 font-medium leading-relaxed resize-none"
                />
              </div>
            </div>

            {/* Live Preview Card */}
            {broadcastMessageAr && (
              <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-2.5">
                <div className="text-[11px] font-bold text-neutral-500 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-violet-500" />
                  <span>{isAr ? 'معاينة حية كما ستظهر في مركز الإشعارات:' : 'Live Notification Center Preview:'}</span>
                </div>

                {broadcastTargetType === 'all' ? (
                  <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                    <div className="text-xs sm:text-sm text-neutral-900 dark:text-neutral-100 leading-relaxed whitespace-pre-wrap font-medium">
                      {broadcastMessageAr}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-cyan-500/30">
                    <div className="text-xs sm:text-sm text-neutral-900 dark:text-neutral-100 leading-relaxed whitespace-pre-wrap font-medium">
                      <span className="font-bold text-cyan-700 dark:text-cyan-400">
                        {broadcastTitleAr.trim() || 'رسالة من الإدارة:'}{' '}
                      </span>
                      {broadcastMessageAr}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Submit Button */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleSendBroadcast}
                disabled={isSendingBroadcast}
                className={`w-full sm:w-auto px-6 py-3 rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all active:scale-95 text-white ${
                  broadcastTargetType === 'all'
                    ? 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 shadow-violet-500/25'
                    : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-cyan-500/25'
                }`}
              >
                {isSendingBroadcast ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{isAr ? 'جاري الإرسال لمركز الإشعارات...' : 'Sending to notifications...'}</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>
                      {broadcastTargetType === 'all'
                        ? isAr
                          ? `إرسال الإذاعة العامة لجميع المستخدمين (${users.length} مستخدم)`
                          : `Broadcast to All Users (${users.length} users)`
                        : isAr
                        ? `إرسال الرسالة إلى مركز إشعارات ${broadcastSelectedUser ? broadcastSelectedUser.name : 'المستخدم'}`
                        : `Send Private Notice to User`}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>

        </div>
      )}

      {/* =========================================================================
          TAB: مركز البلاغات والاقتراحات (Reports & Suggestions Center)
          ========================================================================= */}
      {activeTab === 'feedback' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Header */}
          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500/20 to-orange-500/20 text-rose-500 flex items-center justify-center shrink-0 border border-rose-500/30">
                <LifeBuoy className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                  <span>{isAr ? 'مركز البلاغات والاقتراحات' : 'Reports & Suggestions Center'}</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 font-mono font-bold">
                    {feedbackReports.length}
                  </span>
                </h3>
                <p className="text-xs text-neutral-500">
                  {isAr
                    ? 'عرض نوع البلاغ أو الاقتراح، المستخدم المرسل، وتفاصيل الرسالة مع إمكانية الحذف.'
                    : 'Displays report or suggestion type, sending user, message details, and delete button.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={fetchFeedbackReports}
                disabled={isLoadingFeedback}
                className="px-3.5 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFeedback ? 'animate-spin' : ''}`} />
                <span>{isAr ? 'تحديث' : 'Refresh'}</span>
              </button>
              {feedbackReports.length > 0 && (
                <button
                  type="button"
                  onClick={() => setClearConfirmTarget('feedback')}
                  className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isAr ? 'إفراغ الكل' : 'Clear All'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Type Filter & Search Toolbar */}
          <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <span className="text-xs font-bold text-neutral-400 shrink-0 ml-1 rtl:mr-1">
                <Filter className="w-3.5 h-3.5 inline ml-1" />
                {isAr ? 'النوع:' : 'Type:'}
              </span>
              <button
                type="button"
                onClick={() => setFeedbackFilterType('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 cursor-pointer transition-colors ${
                  feedbackFilterType === 'all'
                    ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-bold'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200'
                }`}
              >
                {isAr ? 'الكل' : 'All'}
              </button>
              <button
                type="button"
                onClick={() => setFeedbackFilterType('user_report')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 cursor-pointer transition-colors flex items-center gap-1.5 ${
                  feedbackFilterType === 'user_report'
                    ? 'bg-rose-600 text-white font-bold shadow-xs'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200'
                }`}
              >
                <Flag className="w-3 h-3" />
                <span>{isAr ? 'بلاغات المستخدمين' : 'User Reports'}</span>
              </button>
              <button
                type="button"
                onClick={() => setFeedbackFilterType('bug')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 cursor-pointer transition-colors flex items-center gap-1 ${
                  feedbackFilterType === 'bug'
                    ? 'bg-rose-500 text-white font-bold'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200'
                }`}
              >
                <Bug className="w-3 h-3" />
                <span>{isAr ? 'بلاغ عن خطأ' : 'Bug Report'}</span>
              </button>
              <button
                type="button"
                onClick={() => setFeedbackFilterType('suggestion')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 cursor-pointer transition-colors flex items-center gap-1 ${
                  feedbackFilterType === 'suggestion'
                    ? 'bg-amber-500 text-neutral-950 font-bold'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200'
                }`}
              >
                <Lightbulb className="w-3 h-3" />
                <span>{isAr ? 'اقتراح' : 'Suggestion'}</span>
              </button>
              <button
                type="button"
                onClick={() => setFeedbackFilterType('feedback')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 cursor-pointer transition-colors flex items-center gap-1 ${
                  feedbackFilterType === 'feedback'
                    ? 'bg-purple-500 text-white font-bold'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200'
                }`}
              >
                <MessageSquarePlus className="w-3 h-3" />
                <span>{isAr ? 'ملاحظة عامة' : 'Feedback'}</span>
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-neutral-400 absolute top-3 right-3 rtl:right-3 rtl:left-auto ltr:left-3 ltr:right-auto" />
              <input
                type="text"
                value={feedbackSearch}
                onChange={(e) => setFeedbackSearch(e.target.value)}
                placeholder={
                  isAr
                    ? 'ابحث في البلاغات والاقتراحات أو باسم المستخدم أو ID...'
                    : 'Search reports, suggestions, user name, or ID...'
                }
                className="w-full pl-3 pr-10 rtl:pr-10 rtl:pl-3 ltr:pl-10 ltr:pr-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:border-rose-500 transition-colors"
              />
            </div>
          </div>

          {/* Feedback Reports List */}
          {(() => {
            const filteredReports = feedbackReports.filter((r) => {
              if (feedbackFilterType !== 'all' && r.type !== feedbackFilterType) return false;
              if (feedbackSearch.trim()) {
                const q = feedbackSearch.toLowerCase().trim();
                const matchTitle = (r.title || '').toLowerCase().includes(q);
                const matchDesc = (r.description || '').toLowerCase().includes(q);
                const matchName = (r.userName || '').toLowerCase().includes(q);
                const matchEmail = (r.userEmail || '').toLowerCase().includes(q);
                const matchId = (r.userDisplayId || '').toLowerCase().includes(q);
                if (!matchTitle && !matchDesc && !matchName && !matchEmail && !matchId) {
                  return false;
                }
              }
              return true;
            });

            if (isLoadingFeedback) {
              return (
                <div className="p-12 text-center rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                  <RefreshCw className="w-8 h-8 text-rose-500 animate-spin mx-auto mb-3" />
                  <p className="text-sm text-neutral-500">{isAr ? 'جاري تحميل البلاغات والاقتراحات...' : 'Loading reports...'}</p>
                </div>
              );
            }

            if (filteredReports.length === 0) {
              return (
                <div className="p-12 text-center rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-2">
                  <div className="w-14 h-14 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-400 flex items-center justify-center mx-auto">
                    <LifeBuoy className="w-7 h-7" />
                  </div>
                  <h4 className="text-base font-bold text-neutral-900 dark:text-white">
                    {isAr ? 'لا توجد بلاغات أو اقتراحات حالياً' : 'No reports or suggestions'}
                  </h4>
                  <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                    {isAr
                      ? 'عند إرسال أي مستخدم لبلاغ أو اقتراح سيظهر هنا مباشرة مع نوع الرسالة وتفاصيلها واسم المستخدم المرسل.'
                      : 'Submitted reports and suggestions will appear here immediately.'}
                  </p>
                </div>
              );
            }

            return (
              <div className="space-y-3">
                {filteredReports.map((report) => {
                  const isBug = report.type === 'bug';
                  const isSuggestion = report.type === 'suggestion';
                  const isUserReport = report.type === 'user_report';

                  return (
                    <div
                      key={report.id}
                      className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 transition-all shadow-xs space-y-3"
                    >
                      {/* 1. Type & Date + Delete Button */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-neutral-100 dark:border-neutral-800/80">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold ${
                              isUserReport
                                ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                                : isBug
                                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                : isSuggestion
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                : 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                            }`}
                          >
                            {isUserReport ? (
                              <Flag className="w-3.5 h-3.5" />
                            ) : isBug ? (
                              <Bug className="w-3.5 h-3.5" />
                            ) : isSuggestion ? (
                              <Lightbulb className="w-3.5 h-3.5" />
                            ) : (
                              <MessageSquarePlus className="w-3.5 h-3.5" />
                            )}
                            <span>
                              {isUserReport
                                ? isAr ? 'بلاغ عن مستخدم' : 'User Report'
                                : isBug
                                ? isAr ? 'بلاغ عن خطأ' : 'Bug Report'
                                : isSuggestion
                                ? isAr ? 'اقتراح' : 'Suggestion'
                                : isAr ? 'ملاحظة عامة' : 'Feedback'}
                            </span>
                          </span>

                          {report.reason && (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                              {report.reason}
                            </span>
                          )}

                          <span className="text-[11px] text-neutral-400 font-mono flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-neutral-400" />
                            <span>{formatLocalDateTime(report.createdAt)}</span>
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteFeedbackReport(report.id)}
                          disabled={deletingReportId === report.id}
                          className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-600 hover:text-white text-rose-600 dark:text-rose-400 border border-rose-500/20 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>{isAr ? 'حذف' : 'Delete'}</span>
                        </button>
                      </div>

                      {/* 2. Sending User Info */}
                      <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-950/70 border border-neutral-100 dark:border-neutral-800 text-xs">
                        <span className="font-bold text-neutral-500 dark:text-neutral-400">
                          {isAr ? 'المستخدم المرسل:' : 'Sender:'}
                        </span>
                        <span className="font-bold text-neutral-900 dark:text-white">
                          {report.userName || (isAr ? 'مستخدم Soul-X' : 'Soul-X User')}
                        </span>
                        {(report.userDisplayId || report.userId) && (
                          <span className="font-mono text-[11px] text-cyan-600 dark:text-cyan-400">
                            (ID: {report.userDisplayId || report.userId})
                          </span>
                        )}
                        {report.userEmail && (
                          <span className="font-mono text-[11px] text-neutral-500 dark:text-neutral-400" dir="ltr">
                            • {report.userEmail}
                          </span>
                        )}
                      </div>

                      {/* 3. Message Details */}
                      <div className="space-y-1.5">
                        {report.title && (
                          <h4 className="text-sm font-bold text-neutral-900 dark:text-white">
                            {report.title}
                          </h4>
                        )}
                        <p className="text-xs text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap leading-relaxed bg-neutral-50/70 dark:bg-neutral-950/50 p-3 rounded-xl border border-neutral-100 dark:border-neutral-800/70 font-sans">
                          {report.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* =========================================================================
          TAB: طلبات استعادة كلمة المرور (الموقع وتيليجرام)
          ========================================================================= */}
      {activeTab === 'passwordResets' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Header Card */}
          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 border border-amber-500/20">
                <KeyRound className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                  <span>{isAr ? 'طلبات استعادة كلمة المرور (الموقع وتيليجرام)' : 'Password Reset Requests (Web & Telegram)'}</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-mono font-bold">
                    {passwordResets.length}
                  </span>
                </h3>
                <p className="text-xs text-neutral-500">
                  {isAr
                    ? 'عرض تفاصيل المستخدم ورابط حسابه في تيليجرام للتواصل معه مباشرة مع زر حذف الطلب.'
                    : 'Displays user details, direct Telegram contact link, and delete button.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={fetchPasswordResets}
                disabled={isLoadingPasswordResets}
                className="px-3.5 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingPasswordResets ? 'animate-spin' : ''}`} />
                <span>{isAr ? 'تحديث' : 'Refresh'}</span>
              </button>
              {passwordResets.length > 0 && (
                <button
                  type="button"
                  onClick={() => setClearConfirmTarget('passwordResets')}
                  className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isAr ? 'إفراغ الكل' : 'Clear All'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Source Filter & Search */}
          <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                <span className="text-xs font-bold text-neutral-400 shrink-0 ml-1 rtl:mr-1">
                  <Filter className="w-3.5 h-3.5 inline ml-1" />
                  {isAr ? 'المصدر:' : 'Source:'}
                </span>
                <button
                  type="button"
                  onClick={() => setPasswordResetsSourceFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 cursor-pointer transition-colors ${
                    passwordResetsSourceFilter === 'all'
                      ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-bold'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200'
                  }`}
                >
                  {isAr ? 'الكل' : 'All'}
                </button>
                <button
                  type="button"
                  onClick={() => setPasswordResetsSourceFilter('web')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 cursor-pointer transition-colors flex items-center gap-1 ${
                    passwordResetsSourceFilter === 'web'
                      ? 'bg-violet-600 text-white font-bold'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200'
                  }`}
                >
                  <Globe className="w-3 h-3" />
                  <span>{isAr ? 'الموقع' : 'Website'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPasswordResetsSourceFilter('telegram')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 cursor-pointer transition-colors flex items-center gap-1 ${
                    passwordResetsSourceFilter === 'telegram'
                      ? 'bg-[#24A1DE] text-white font-bold'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200'
                  }`}
                >
                  <Bot className="w-3 h-3" />
                  <span>{isAr ? 'تيليجرام' : 'Telegram'}</span>
                </button>
              </div>

              <div className="relative sm:w-80">
                <Search className="w-4 h-4 text-neutral-400 absolute top-2.5 right-3 rtl:right-3 rtl:left-auto ltr:left-3 ltr:right-auto" />
                <input
                  type="text"
                  value={passwordResetsSearch}
                  onChange={(e) => setPasswordResetsSearch(e.target.value)}
                  placeholder={
                    isAr
                      ? 'ابحث بالاسم، البريد، ID الحساب، أو يوزر تيليجرام...'
                      : 'Search by name, email, ID, or Telegram username...'
                  }
                  className="w-full pl-3 pr-9 rtl:pr-9 rtl:pl-3 ltr:pl-9 ltr:pr-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Requests List */}
          {(() => {
            const filteredRequests = passwordResets.filter((item) => {
              const isWebSource = item.source === 'web' || (!item.telegramUserId && !item.chatId);
              if (passwordResetsSourceFilter === 'web' && !isWebSource) return false;
              if (passwordResetsSourceFilter === 'telegram' && isWebSource) return false;
              if (passwordResetsSearch.trim()) {
                const q = passwordResetsSearch.toLowerCase().trim();
                const matchUser = (item.telegramUsername || '').toLowerCase().includes(q);
                const matchFirst = (item.telegramFirstName || '').toLowerCase().includes(q);
                const matchLast = (item.telegramLastName || '').toLowerCase().includes(q);
                const matchTgId = String(item.telegramUserId || '').toLowerCase().includes(q);
                const matchEmail = (item.userEmail || '').toLowerCase().includes(q);
                const matchUserName = (item.userName || '').toLowerCase().includes(q);
                const matchDisplayId = (item.userDisplayId || '').toLowerCase().includes(q);
                const matchContact = (item.contactNote || '').toLowerCase().includes(q);
                if (!matchUser && !matchFirst && !matchLast && !matchTgId && !matchEmail && !matchUserName && !matchDisplayId && !matchContact) {
                  return false;
                }
              }
              return true;
            });

            if (isLoadingPasswordResets) {
              return (
                <div className="p-12 text-center rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                  <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mx-auto mb-3" />
                  <p className="text-sm text-neutral-500">{isAr ? 'جاري تحميل الطلبات...' : 'Loading requests...'}</p>
                </div>
              );
            }

            if (filteredRequests.length === 0) {
              return (
                <div className="p-12 text-center rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-2">
                  <div className="w-14 h-14 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-400 flex items-center justify-center mx-auto">
                    <KeyRound className="w-7 h-7" />
                  </div>
                  <h4 className="text-base font-bold text-neutral-900 dark:text-white">
                    {isAr ? 'لا توجد طلبات استعادة كلمة مرور حالياً' : 'No password reset requests'}
                  </h4>
                  <p className="text-xs text-neutral-500 max-w-md mx-auto leading-relaxed">
                    {isAr
                      ? 'عندما يطلب أي مستخدم استعادة كلمة المرور من الموقع أو بوت تيليجرام سيظهر طلبه هنا مع تفاصيله ورابط حسابه في تيليجرام.'
                      : 'Password recovery requests from website or Telegram bot will appear here with user details and Telegram link.'}
                  </p>
                </div>
              );
            }

            return (
              <div className="space-y-3">
                {filteredRequests.map((item) => {
                  const isWebSource = item.source === 'web' || (!item.telegramUserId && !item.chatId);
                  const cleanUsername = item.telegramUsername
                    ? item.telegramUsername.replace(/^@/, '')
                    : null;
                  const telegramDirectLink =
                    item.telegramLink ||
                    (cleanUsername
                      ? `https://t.me/${cleanUsername}`
                      : item.telegramUserId
                      ? `tg://user?id=${item.telegramUserId}`
                      : null);

                  const fullName =
                    item.userName ||
                    [item.telegramFirstName, item.telegramLastName].filter(Boolean).join(' ') ||
                    item.userEmail ||
                    (isAr ? 'مستخدم Soul-X' : 'Soul-X User');

                  return (
                    <div
                      key={item.id}
                      className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 transition-all shadow-xs space-y-3"
                    >
                      {/* Top row: Source + Date */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-neutral-100 dark:border-neutral-800">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border ${
                            isWebSource
                              ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20'
                              : 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20'
                          }`}
                        >
                          {isWebSource ? <Globe className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                          <span>{isWebSource ? (isAr ? 'طلب من الموقع' : 'Website') : (isAr ? 'بوت تيليجرام' : 'Telegram Bot')}</span>
                        </span>

                        <div className="text-[11px] text-neutral-400 font-mono flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-neutral-400" />
                          <span>{formatLocalDateTime(item.requestedAt)}</span>
                        </div>
                      </div>

                      {/* User Details + Telegram Link + Delete Request Button */}
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950/70 border border-neutral-200/80 dark:border-neutral-800">
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-white truncate">
                              {fullName}
                            </h4>
                            {(item.userDisplayId || item.userId) && (
                              <span className="text-xs font-mono font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-lg border border-cyan-500/20">
                                ID: {item.userDisplayId || item.userId}
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-neutral-600 dark:text-neutral-300 flex items-center gap-2 flex-wrap">
                            {item.userEmail && (
                              <span className="font-mono bg-white dark:bg-neutral-900 px-2 py-0.5 rounded-md border border-neutral-200 dark:border-neutral-800" dir="ltr">
                                {item.userEmail}
                              </span>
                            )}
                            {cleanUsername && (
                              <span className="font-mono text-[#24A1DE] font-bold" dir="ltr">
                                @{cleanUsername}
                              </span>
                            )}
                            {item.telegramUserId && (
                              <span className="font-mono text-[11px] text-neutral-500">
                                TG ID: {item.telegramUserId}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 flex-wrap">
                          {telegramDirectLink ? (
                            <a
                              href={telegramDirectLink}
                              target={telegramDirectLink.startsWith('http') ? '_blank' : undefined}
                              rel={telegramDirectLink.startsWith('http') ? 'noopener noreferrer' : undefined}
                              className="px-3.5 py-2 rounded-xl bg-[#24A1DE] hover:bg-[#208bbf] text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>{isAr ? 'التواصل عبر تيليجرام' : 'Contact on Telegram'}</span>
                              <ExternalLink className="w-3 h-3 opacity-85" />
                            </a>
                          ) : (
                            <span className="text-xs text-neutral-400 px-2">
                              {isAr ? 'لا يوجد رابط تيليجرام' : 'No Telegram link'}
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDeletePasswordReset(item.id)}
                            disabled={deletingResetId === item.id}
                            className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-600 hover:text-white text-rose-600 dark:text-rose-400 border border-rose-500/20 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>{isAr ? 'حذف الطلب' : 'Delete Request'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* =========================================================================
          TAB: طلبات توثيق الحسابات بالشارة الزرقاء
          ========================================================================= */}
      {activeTab === 'verifications' && (
        <div className="space-y-4">
          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#1D9BF0]/10 text-[#1D9BF0] flex items-center justify-center shrink-0 border border-[#1D9BF0]/25">
                  <BadgeCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                    <span>{isAr ? 'مركز طلبات توثيق الحسابات' : 'Account Verification Center'}</span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#1D9BF0]/15 text-[#1D9BF0] border border-[#1D9BF0]/25">
                      {verificationRequests.filter((r) => r.status === 'pending').length} {isAr ? 'قيد المراجعة' : 'pending'}
                    </span>
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {isAr
                      ? 'راجع صور الهوية الأمامية والخلفية والسيلفي ثم وافق لمنح الشارة الزرقاء أو ارفض الطلب.'
                      : 'Review ID front, ID back, and selfie photos to approve the blue verification badge or reject.'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={fetchVerifications}
                disabled={isLoadingVerifications}
                className="self-start sm:self-auto px-3.5 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingVerifications ? 'animate-spin' : ''}`} />
                <span>{isAr ? 'تحديث' : 'Refresh'}</span>
              </button>
            </div>

            {/* Filters & Search */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { id: 'pending', labelAr: 'قيد المراجعة', labelEn: 'Pending' },
                    { id: 'all', labelAr: 'الكل', labelEn: 'All' },
                    { id: 'approved', labelAr: 'المقبولة', labelEn: 'Approved' },
                    { id: 'rejected', labelAr: 'المرفوضة', labelEn: 'Rejected' },
                  ] as const
                ).map((f) => {
                  const count =
                    f.id === 'all'
                      ? verificationRequests.length
                      : verificationRequests.filter((r) => r.status === f.id).length;
                  const active = verificationsFilter === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setVerificationsFilter(f.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                        active
                          ? 'bg-[#1D9BF0] text-white border-[#1D9BF0] shadow-xs'
                          : 'bg-neutral-50 dark:bg-neutral-950 text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                      }`}
                    >
                      <span>{isAr ? f.labelAr : f.labelEn}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                          active ? 'bg-white/25 text-white' : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="relative flex-1">
                <Search className="w-4 h-4 text-neutral-400 absolute top-1/2 -translate-y-1/2 start-3.5 pointer-events-none" />
                <input
                  type="text"
                  value={verificationsSearch}
                  onChange={(e) => setVerificationsSearch(e.target.value)}
                  placeholder={isAr ? 'ابحث باسم المستخدم أو البريد أو المعرف...' : 'Search by name, email or ID...'}
                  className="w-full ps-10 pe-4 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-[#1D9BF0]"
                />
              </div>
            </div>

            {/* Verification Requests List */}
            {isLoadingVerifications && verificationRequests.length === 0 ? (
              <div className="py-12 text-center flex flex-col items-center justify-center gap-2 text-neutral-400 text-xs">
                <RefreshCw className="w-6 h-6 animate-spin text-[#1D9BF0]" />
                <span>{isAr ? 'جاري تحميل طلبات التوثيق...' : 'Loading verification requests...'}</span>
              </div>
            ) : (() => {
              const q = verificationsSearch.trim().toLowerCase();
              const filtered = verificationRequests.filter((r) => {
                if (verificationsFilter !== 'all' && r.status !== verificationsFilter) return false;
                if (!q) return true;
                return (
                  (r.userName || '').toLowerCase().includes(q) ||
                  (r.userEmail || '').toLowerCase().includes(q) ||
                  (r.userDisplayId || '').toLowerCase().includes(q) ||
                  (r.userId || '').toLowerCase().includes(q)
                );
              });

              if (filtered.length === 0) {
                return (
                  <div className="py-12 text-center rounded-2xl bg-neutral-50 dark:bg-neutral-950/60 border border-dashed border-neutral-200 dark:border-neutral-800 space-y-2">
                    <BadgeCheck className="w-9 h-9 text-neutral-300 dark:text-neutral-700 mx-auto" />
                    <p className="text-sm font-bold text-neutral-700 dark:text-neutral-300">
                      {isAr ? 'لا توجد طلبات توثيق مطابقة' : 'No matching verification requests'}
                    </p>
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  {filtered.map((reqItem) => {
                    const isProcessing = processingVerifId === reqItem.id;
                    const statusBadge =
                      reqItem.status === 'approved'
                        ? {
                            label: isAr ? 'موثق ومقبول' : 'Approved',
                            cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
                          }
                        : reqItem.status === 'rejected'
                        ? {
                            label: isAr ? 'مرفوض' : 'Rejected',
                            cls: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25',
                          }
                        : {
                            label: isAr ? 'بانتظار المراجعة' : 'Pending Review',
                            cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25',
                          };

                    return (
                      <div
                        key={reqItem.id}
                        className="p-4 sm:p-5 rounded-2xl bg-neutral-50 dark:bg-neutral-950/70 border border-neutral-200 dark:border-neutral-800 space-y-4"
                      >
                        {/* Top User Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={
                                reqItem.userAvatar ||
                                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'
                              }
                              alt={reqItem.userName}
                              className="w-11 h-11 rounded-2xl object-cover border border-neutral-200 dark:border-neutral-800 shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h4 className="font-black text-sm text-neutral-900 dark:text-white truncate">
                                  {reqItem.userName}
                                </h4>
                                {reqItem.status === 'approved' && <VerifiedBadge lang={lang} size="sm" />}
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusBadge.cls}`}>
                                  {statusBadge.label}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-neutral-500 mt-0.5">
                                <span className="font-mono text-cyan-600 dark:text-cyan-400 font-bold" dir="ltr">
                                  ID: {reqItem.userDisplayId || reqItem.userId}
                                </span>
                                {reqItem.userEmail && <span dir="ltr">{reqItem.userEmail}</span>}
                                <span>{formatLocalDateTime(reqItem.submittedAt, lang)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Approve / Reject Actions for Pending, Delete Action for Approved / Rejected */}
                          {reqItem.status === 'pending' ? (
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleApproveVerification(reqItem)}
                                disabled={isProcessing}
                                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                <span>{isAr ? 'موافقة وتوثيق' : 'Approve'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setRejectModalRequest(reqItem);
                                  setRejectReasonInput('');
                                }}
                                disabled={isProcessing}
                                className="px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-600 hover:text-white text-rose-600 dark:text-rose-400 border border-rose-500/25 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                              >
                                <XCircle className="w-4 h-4" />
                                <span>{isAr ? 'رفض' : 'Reject'}</span>
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 shrink-0">
                              {confirmDeleteVerifId === reqItem.id ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteVerification(reqItem)}
                                    disabled={deletingVerifId === reqItem.id}
                                    className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                                  >
                                    {deletingVerifId === reqItem.id ? (
                                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <Trash2 className="w-3.5 h-3.5" />
                                    )}
                                    <span>{isAr ? 'تأكيد الحذف' : 'Confirm Delete'}</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteVerifId(null)}
                                    disabled={deletingVerifId === reqItem.id}
                                    className="px-3 py-2 rounded-xl bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                                  >
                                    {isAr ? 'إلغاء' : 'Cancel'}
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteVerifId(reqItem.id)}
                                  className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-600 hover:text-white text-rose-600 dark:text-rose-400 border border-rose-500/25 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                                  title={
                                    isAr
                                      ? 'حذف الطلب من السجل دون التأثير على التوثيق أو حالة الطلب'
                                      : 'Delete request without affecting verification or status'
                                  }
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>{isAr ? 'حذف الطلب' : 'Delete Request'}</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* 3 Uploaded Verification Images */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {(
                            [
                              {
                                url: reqItem.idFrontImage,
                                label: isAr ? 'الوجه الأمامي للهوية' : 'ID Front Side',
                              },
                              {
                                url: reqItem.idBackImage,
                                label: isAr ? 'الوجه الخلفي للهوية' : 'ID Back Side',
                              },
                              {
                                url: reqItem.selfieWithIdImage,
                                label: isAr ? 'سيلفي مع الوجه الأمامي للهوية' : 'Selfie with Front ID',
                              },
                            ] as const
                          ).map((imgItem, idx) => (
                            <div
                              key={idx}
                              className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col"
                            >
                              <div className="px-3 py-2 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between gap-2">
                                <span className="text-[11px] font-bold text-neutral-700 dark:text-neutral-300 truncate">
                                  {imgItem.label}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPreviewVerifImage({
                                      url: imgItem.url,
                                      label: `${reqItem.userName} — ${imgItem.label}`,
                                    })
                                  }
                                  className="p-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-[#1D9BF0]/15 text-neutral-600 dark:text-neutral-300 hover:text-[#1D9BF0] transition-colors cursor-pointer"
                                  title={isAr ? 'تكبير الصورة' : 'Zoom image'}
                                >
                                  <ZoomIn className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewVerifImage({
                                    url: imgItem.url,
                                    label: `${reqItem.userName} — ${imgItem.label}`,
                                  })
                                }
                                className="relative h-44 w-full bg-neutral-100 dark:bg-neutral-950 overflow-hidden group cursor-pointer"
                              >
                                <img
                                  src={imgItem.url}
                                  alt={imgItem.label}
                                  className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-200"
                                />
                              </button>
                            </div>
                          ))}
                        </div>

                        {reqItem.status === 'rejected' && reqItem.rejectionReason && (
                          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-700 dark:text-rose-300">
                            <span className="font-bold">{isAr ? 'سبب الرفض:' : 'Rejection reason:'}</span>{' '}
                            {reqItem.rejectionReason}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: حالة بوت تيليجرام ونظام الإحالات
          ========================================================================= */}
      {activeTab === 'bot' && (
        <div className="space-y-4">
          {/* Card 1: Bot Status */}
          <div className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <Bot className="w-5 h-5 text-[#24A1DE]" />
              <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                {isAr ? 'حالة بوت تيليجرام والرابط الديناميكي' : 'Telegram Bot & Dynamic URL'}
              </h3>
            </div>

            <div className="space-y-3 text-xs leading-relaxed">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">
                <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                  {isAr ? 'حالة التوكن (TELEGRAM_BOT_TOKEN):' : 'Token Status:'}
                </span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {stats?.botConfigured ? (isAr ? 'مُعد ونشط' : 'Configured') : (isAr ? 'غير مسجل' : 'Missing')}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                    {isAr ? 'الرابط الديناميكي الحالي لزر Web App:' : 'Active Dynamic Web App URL:'}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-bold">
                    {isAr ? 'تلقائي' : 'Dynamic Auto'}
                  </span>
                </div>
                <div className="font-mono text-cyan-600 dark:text-cyan-400 truncate bg-white dark:bg-neutral-900 p-2 rounded-xl border border-neutral-200 dark:border-neutral-800">
                  {stats?.botPublicUrl || 'http://127.0.0.1:3000'}
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Bot Referrals Settings & Controls */}
          <div className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20 shrink-0">
                  <Gift className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                      {isAr ? 'نظام الإحالات والمكافآت في البوت' : 'Bot Referrals & Rewards System'}
                    </h3>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        botRefEnabled
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25'
                          : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25'
                      }`}
                    >
                      {botRefEnabled ? (isAr ? 'مفعّل في البوت' : 'Active') : (isAr ? 'متوقف حالياً' : 'Disabled')}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    {isAr
                      ? 'تحكم في تشغيل وإيقاف الإحالات، قيم المكافآت بالدولار، وسعر الصرف إلى Coins في Soul-X'
                      : 'Toggle bot referrals, customize USD bonuses, and set the Coins conversion rate'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={fetchBotReferrals}
                  disabled={isLoadingBotReferrals}
                  className="p-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 transition-colors cursor-pointer"
                  title={isAr ? 'تحديث البيانات' : 'Refresh'}
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingBotReferrals ? 'animate-spin' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={handleToggleBotReferralsEnabled}
                  disabled={isSavingBotReferrals}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shadow-xs active:scale-95 disabled:opacity-50 ${
                    botRefEnabled
                      ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20'
                  }`}
                >
                  <Power className="w-4 h-4" />
                  <span>
                    {botRefEnabled
                      ? isAr ? 'إيقاف الميزة في البوت' : 'Disable Feature'
                      : isAr ? 'تشغيل الميزة في البوت' : 'Enable Feature'}
                  </span>
                </button>
              </div>
            </div>

            {/* Editable Values Form */}
            <form onSubmit={handleSaveBotReferralSettings} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-2">
                  <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                    <span>{isAr ? 'مكافأة المستخدم الجديد ($)' : 'New User Bonus ($)'}</span>
                    <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={botRefNewUserBonus}
                    onChange={(e) => setBotRefNewUserBonus(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-sm font-mono font-bold text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500"
                    dir="ltr"
                  />
                  <p className="text-[11px] text-neutral-500">
                    {isAr ? 'الافتراضي: 0.10$ عند الدخول عبر رابط إحالة' : 'Default: $0.10 on referral join'}
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-2">
                  <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                    <span>{isAr ? 'مكافأة المحيل ($)' : 'Referrer Bonus ($)'}</span>
                    <DollarSign className="w-3.5 h-3.5 text-amber-500" />
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={botRefReferrerBonus}
                    onChange={(e) => setBotRefReferrerBonus(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-sm font-mono font-bold text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500"
                    dir="ltr"
                  />
                  <p className="text-[11px] text-neutral-500">
                    {isAr ? 'الافتراضي: 0.50$ لكل مستخدم جديد يدخل من رابطه' : 'Default: $0.50 per new user'}
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-2">
                  <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                    <span>{isAr ? 'سعر الصرف (Coins لكل 1$)' : 'Rate (Coins per $1)'}</span>
                    <Coins className="w-3.5 h-3.5 text-cyan-500" />
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    required
                    value={botRefCoinsPerDollar}
                    onChange={(e) => setBotRefCoinsPerDollar(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-sm font-mono font-bold text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500"
                    dir="ltr"
                  />
                  <p className="text-[11px] text-neutral-500">
                    {isAr ? 'الافتراضي: 1$ يساوي 25,000 Coins' : 'Default: $1 = 25,000 Coins'}
                  </p>
                </div>
              </div>

              {/* Live Calculation Preview + Save Button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-amber-500/5 dark:bg-amber-950/20 border border-amber-500/20">
                <div className="text-xs text-neutral-700 dark:text-neutral-300 flex items-center gap-2 flex-wrap">
                  <ArrowLeftRight className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="font-bold">{isAr ? 'معاينة التحويل الحالية:' : 'Live Rate Preview:'}</span>
                  <span className="font-mono px-2 py-0.5 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                    ${Number(botRefNewUserBonus || 0).toFixed(2)} = {Math.round(Number(botRefNewUserBonus || 0) * Math.max(1, Number(botRefCoinsPerDollar || 25000))).toLocaleString()} Coins
                  </span>
                  <span className="font-mono px-2 py-0.5 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                    ${Number(botRefReferrerBonus || 0).toFixed(2)} = {Math.round(Number(botRefReferrerBonus || 0) * Math.max(1, Number(botRefCoinsPerDollar || 25000))).toLocaleString()} Coins
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={isSavingBotReferrals}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-extrabold text-xs transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm shrink-0 active:scale-95 disabled:opacity-50"
                >
                  {isSavingBotReferrals ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>{isAr ? 'حفظ القيم المعدلة' : 'Save Referral Settings'}</span>
                </button>
              </div>
            </form>

            {/* Stats Summary */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
              <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">
                <div className="text-[11px] font-bold text-neutral-500">{isAr ? 'مستخدمو البوت' : 'Bot Users'}</div>
                <div className="text-xl font-black font-mono text-neutral-900 dark:text-white mt-1">
                  {botRefStats?.totalBotUsers ?? 0}
                </div>
              </div>
              <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">
                <div className="text-[11px] font-bold text-neutral-500">{isAr ? 'الإحالات الناجحة' : 'Successful Referrals'}</div>
                <div className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                  {botRefStats?.totalReferrals ?? 0}
                </div>
              </div>
              <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">
                <div className="text-[11px] font-bold text-neutral-500">{isAr ? 'أرصدة البوت المعلقة' : 'Pending USD Balance'}</div>
                <div className="text-xl font-black font-mono text-amber-600 dark:text-amber-400 mt-1" dir="ltr">
                  ${Number(botRefStats?.totalBalanceUsd ?? 0).toFixed(2)}
                </div>
              </div>
              <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">
                <div className="text-[11px] font-bold text-neutral-500">{isAr ? 'المحوّل إلى Soul-X' : 'Converted to Coins'}</div>
                <div className="text-xl font-black font-mono text-cyan-600 dark:text-cyan-400 mt-1">
                  {(botRefStats?.totalTransferredCoins ?? 0).toLocaleString()} <span className="text-xs font-bold">Coins</span>
                </div>
              </div>
            </div>

            {/* Recent Referrers & Transfers Lists */}
            {(botRefUsers.length > 0 || botRefTransfers.length > 0) && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
                {/* Top/Recent Bot Referral Users */}
                <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                      <Link className="w-3.5 h-3.5 text-amber-500" />
                      <span>{isAr ? 'أعضاء الإحالات في البوت' : 'Bot Referral Users'}</span>
                    </h4>
                    <span className="text-[10px] font-mono text-neutral-500">{botRefUsers.length}</span>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {botRefUsers.slice(0, 15).map((bu) => (
                      <div
                        key={bu.telegramUserId}
                        className="p-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-neutral-900 dark:text-white truncate">
                            {[bu.firstName, bu.lastName].filter(Boolean).join(' ') || bu.username || `ID: ${bu.telegramUserId}`}
                          </div>
                          <div className="text-[11px] text-neutral-500 font-mono flex items-center gap-2">
                            <span>{bu.referralCode}</span>
                            <span>•</span>
                            <span>{isAr ? `${bu.referralsCount || 0} إحالة` : `${bu.referralsCount || 0} refs`}</span>
                          </div>
                        </div>
                        <div className="text-end shrink-0 font-mono">
                          <div className="font-bold text-emerald-600 dark:text-emerald-400" dir="ltr">
                            ${Number(bu.balanceUsd || 0).toFixed(2)}
                          </div>
                          <div className="text-[10px] text-neutral-400">
                            {(bu.totalTransferredCoins || 0).toLocaleString()} Coins
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Transfers to Soul-X */}
                <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                      <ArrowLeftRight className="w-3.5 h-3.5 text-cyan-500" />
                      <span>{isAr ? 'آخر التحويلات إلى حسابات Soul-X' : 'Recent Transfers to Soul-X'}</span>
                    </h4>
                    <span className="text-[10px] font-mono text-neutral-500">{botRefTransfers.length}</span>
                  </div>
                  {botRefTransfers.length === 0 ? (
                    <div className="text-xs text-neutral-500 py-6 text-center">
                      {isAr ? 'لا توجد عمليات تحويل مسجلة بعد' : 'No transfers yet'}
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {botRefTransfers.slice(0, 15).map((tx) => (
                        <div
                          key={tx.id}
                          className="p-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="font-bold text-neutral-900 dark:text-white truncate">
                              {tx.targetUserName} <span className="font-mono text-[11px] text-cyan-600 dark:text-cyan-400">({tx.targetDisplayId})</span>
                            </div>
                            <div className="text-[11px] text-neutral-500 truncate">
                              {tx.telegramName} • {formatLocalDateTime(tx.createdAt, lang)}
                            </div>
                          </div>
                          <div className="text-end shrink-0 font-mono">
                            <div className="font-bold text-amber-600 dark:text-amber-400">
                              +{Number(tx.coinsCredited || 0).toLocaleString()} 🪙
                            </div>
                            <div className="text-[10px] text-neutral-400" dir="ltr">
                              ${Number(tx.amountUsd || 0).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB: إدارة الألعاب والخوارزمية الذكية
          ========================================================================= */}
      {activeTab === 'games' && (
        <div className="space-y-4">
          <AdminGamesAlgorithmControl
            lang={lang}
            getAdminHeaders={getAdminHeaders}
            showToast={showToast}
            externalRefreshSignal={gamesRefreshSignal}
          />
          <div className="rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowGoldenTreeAdvanced((prev) => !prev)}
              className="w-full px-5 py-4 flex items-center justify-between gap-3 text-right hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors cursor-pointer"
            >
              <div>
                <div className="text-xs font-extrabold text-neutral-800 dark:text-neutral-100">
                  {isAr
                    ? 'إعدادات Golden Tree التفصيلية (الرموز والبونص)'
                    : 'Golden Tree Advanced Settings (Symbols & Bonus)'}
                </div>
                <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {isAr
                    ? 'اختياري — خوارزمية الربح الموحدة أعلاه تتحكم بالفعل في Golden Tree وباقي الألعاب'
                    : 'Optional — the unified profit algorithm above already governs Golden Tree & all games'}
                </div>
              </div>
              {showGoldenTreeAdvanced ? (
                <ChevronUp className="w-4 h-4 text-neutral-500 shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-neutral-500 shrink-0" />
              )}
            </button>
            {showGoldenTreeAdvanced && (
              <div className="p-4 pt-0 border-t border-neutral-100 dark:border-neutral-800">
                <AdminGoldenTreeControl
                  lang={lang}
                  getAdminHeaders={getAdminHeaders}
                  showToast={showToast}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB: إدارة الأقسام (تفعيل وتعطيل قسم المتجر وقسم الألعاب)
          ========================================================================= */}
      {activeTab === 'sections' && (
        <div className="space-y-4">
          <div className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-5">
            <div className="flex items-center justify-between gap-3 pb-4 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 flex items-center justify-center border border-cyan-500/20 shrink-0">
                  <LayoutGrid className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                    {isAr ? 'تفعيل وتعطيل قسم المتجر وقسم الألعاب' : 'Store & Games Sections Control'}
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    {isAr
                      ? 'تحكم في إتاحة قسم المتجر وقسم الألعاب للمستخدمين في الصفحة الرئيسية'
                      : 'Enable or disable access to the Store and Games sections on the Home screen'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={fetchSectionSettings}
                disabled={isLoadingSections}
                className="p-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 transition-colors cursor-pointer shrink-0"
                title={isAr ? 'تحديث' : 'Refresh'}
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingSections ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Store Section Card */}
              <div className="p-5 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 flex flex-col justify-between gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
                      <ShoppingBag className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-neutral-900 dark:text-white">
                        {isAr ? 'قسم المتجر' : 'Store Section'}
                      </h4>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                        {storeSectionEnabled
                          ? isAr
                            ? 'مفعّل حالياً للمستخدمين'
                            : 'Currently enabled for users'
                          : isAr
                          ? 'معطّل حالياً من قبل الإدارة'
                          : 'Currently disabled by Admin'}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-black border shrink-0 ${
                      storeSectionEnabled
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25'
                        : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25'
                    }`}
                  >
                    {storeSectionEnabled ? (isAr ? 'مفعّل' : 'Enabled') : isAr ? 'معطّل' : 'Disabled'}
                  </span>
                </div>

                <button
                  type="button"
                  disabled={togglingSectionTarget === 'store' || isLoadingSections}
                  onClick={() => handleToggleAppSection('store')}
                  className={`w-full h-11 rounded-xl font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-2 border active:scale-[0.98] disabled:opacity-50 ${
                    storeSectionEnabled
                      ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/30'
                      : 'bg-emerald-500 hover:bg-emerald-400 text-neutral-950 border-emerald-500 shadow-sm'
                  }`}
                >
                  {togglingSectionTarget === 'store' ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Power className="w-4 h-4" />
                  )}
                  <span>
                    {storeSectionEnabled
                      ? isAr
                        ? 'تعطيل قسم المتجر'
                        : 'Disable Store Section'
                      : isAr
                      ? 'تفعيل قسم المتجر'
                      : 'Enable Store Section'}
                  </span>
                </button>
              </div>

              {/* Games Section Card */}
              <div className="p-5 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 flex flex-col justify-between gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 flex items-center justify-center shrink-0">
                      <Gamepad2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-neutral-900 dark:text-white">
                        {isAr ? 'قسم الألعاب' : 'Games Section'}
                      </h4>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                        {gamesSectionEnabled
                          ? isAr
                            ? 'مفعّل حالياً (الألعاب متاحة للتشغيل)'
                            : 'Currently enabled (games playable)'
                          : isAr
                          ? 'معطّل حالياً (مغلق أمام المستخدمين)'
                          : 'Currently disabled (blocked for users)'}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-black border shrink-0 ${
                      gamesSectionEnabled
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25'
                        : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25'
                    }`}
                  >
                    {gamesSectionEnabled ? (isAr ? 'مفعّل' : 'Enabled') : isAr ? 'معطّل' : 'Disabled'}
                  </span>
                </div>

                <button
                  type="button"
                  disabled={togglingSectionTarget === 'games' || isLoadingSections}
                  onClick={() => handleToggleAppSection('games')}
                  className={`w-full h-11 rounded-xl font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-2 border active:scale-[0.98] disabled:opacity-50 ${
                    gamesSectionEnabled
                      ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/30'
                      : 'bg-emerald-500 hover:bg-emerald-400 text-neutral-950 border-emerald-500 shadow-sm'
                  }`}
                >
                  {togglingSectionTarget === 'games' ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Power className="w-4 h-4" />
                  )}
                  <span>
                    {gamesSectionEnabled
                      ? isAr
                        ? 'تعطيل قسم الألعاب'
                        : 'Disable Games Section'
                      : isAr
                      ? 'تفعيل قسم الألعاب'
                      : 'Enable Games Section'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 0: Selected User Details & Actions Menu */}
      {(() => {
        const activeActionUser = selectedActionUser
          ? users.find((x) => x.id === selectedActionUser.id) || null
          : null;
        if (!activeActionUser) return null;
        const activeActionUserAgent =
          agents.find((a) => a.email.toLowerCase() === activeActionUser.email.toLowerCase()) || null;

        const copyField = (val: string, key: 'id' | 'uuid' | 'email') => {
          try {
            navigator.clipboard?.writeText(val);
            setCopiedActionField(key);
            setTimeout(() => setCopiedActionField(null), 1500);
          } catch {}
        };

        return (
          <div
            onClick={() => setSelectedActionUser(null)}
            className="fixed inset-0 z-[45] flex items-center justify-center p-3 sm:p-4 bg-neutral-950/80 backdrop-blur-md animate-in fade-in duration-200"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-600 via-indigo-700 to-neutral-900 text-white font-bold text-base flex items-center justify-center shrink-0 border border-neutral-200 dark:border-neutral-700 shadow-sm overflow-hidden">
                    {activeActionUser.photoUrl ? (
                      <img src={activeActionUser.photoUrl} alt={activeActionUser.name} className="w-full h-full object-cover" />
                    ) : (
                      activeActionUser.name.substring(0, 2)
                    )}
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="text-base sm:text-lg font-black text-neutral-900 dark:text-white truncate">
                        {activeActionUser.name}
                      </h3>
                      {activeActionUser.isVerified && <VerifiedBadge lang={lang} size="sm" />}
                      {activeActionUserAgent && (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                          <Building2 className="w-3 h-3" />
                          <span>{isAr ? 'وكيل معتمد' : 'Agent'}</span>
                        </span>
                      )}
                      {activeActionUser.isBanned && (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-bold bg-rose-600/15 text-rose-600 dark:text-rose-400 border border-rose-600/30">
                          <Ban className="w-3 h-3" />
                          <span>{isAr ? 'محظور نهائياً' : 'Banned'}</span>
                        </span>
                      )}
                      {activeActionUser.isFrozen && (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-bold bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30">
                          <Snowflake className="w-3 h-3" />
                          <span>
                            {isAr
                              ? `مجمّد (${activeActionUser.freezeDurationMinutes || 0} د)`
                              : `Frozen (${activeActionUser.freezeDurationMinutes || 0}m)`}
                          </span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-mono text-neutral-500 dark:text-neutral-400 truncate">
                      {activeActionUser.email}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedActionUser(null)}
                  className="p-2 rounded-full text-neutral-400 hover:text-neutral-900 dark:hover:text-white bg-neutral-100 dark:bg-neutral-800 transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Selected Account Details Section */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-wide flex items-center gap-1.5">
                  <UserIcon className="w-3.5 h-3.5 text-cyan-500" />
                  <span>{isAr ? 'تفاصيل الحساب المحدد' : 'Selected Account Details'}</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  {/* Account Display ID */}
                  <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[10px] text-neutral-500 block">{isAr ? 'معرف الحساب (ID)' : 'Account ID'}</span>
                      <span className="font-mono font-bold text-neutral-900 dark:text-white truncate block">
                        {activeActionUser.displayId || activeActionUser.id}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyField(activeActionUser.displayId || activeActionUser.id, 'id')}
                      className="p-1.5 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white cursor-pointer shrink-0"
                      title={isAr ? 'نسخ المعرف' : 'Copy ID'}
                    >
                      {copiedActionField === 'id' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* Email */}
                  <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[10px] text-neutral-500 block">{isAr ? 'البريد الإلكتروني' : 'Email Address'}</span>
                      <span className="font-mono font-bold text-neutral-900 dark:text-white truncate block">
                        {activeActionUser.email}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyField(activeActionUser.email, 'email')}
                      className="p-1.5 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white cursor-pointer shrink-0"
                      title={isAr ? 'نسخ البريد' : 'Copy Email'}
                    >
                      {copiedActionField === 'email' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* Personal Diamonds */}
                  <div className="p-3 rounded-2xl bg-cyan-500/5 border border-cyan-500/20 flex items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] text-neutral-500 block">{isAr ? 'الألماس الشخصي' : 'Personal Diamonds'}</span>
                      <span className="font-mono text-sm font-black text-cyan-600 dark:text-cyan-400">
                        {(typeof activeActionUser.walletBalance === 'number' ? activeActionUser.walletBalance : 0).toLocaleString()}
                      </span>
                    </div>
                    <DiamondIcon className="w-5 h-5 text-cyan-500 shrink-0" />
                  </div>

                  {/* Personal Coins */}
                  <div className="p-3 rounded-2xl bg-amber-500/5 border border-amber-500/20 flex items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] text-neutral-500 block">{isAr ? 'الكوينز الشخصية' : 'Personal Coins'}</span>
                      <span className="font-mono text-sm font-black text-amber-600 dark:text-amber-400">
                        {(typeof activeActionUser.coinsBalance === 'number' ? activeActionUser.coinsBalance : 0).toLocaleString()}
                      </span>
                    </div>
                    <CoinIcon className="w-5 h-5 shrink-0" />
                  </div>

                  {/* Agency Info (if agent) */}
                  {activeActionUserAgent && (
                    <div className="sm:col-span-2 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-amber-500 shrink-0" />
                        <div>
                          <span className="text-[10px] text-amber-700 dark:text-amber-300 font-bold block">
                            {isAr ? `رصيد وكالة الشحن (قريد: ${activeActionUserAgent.gridCode || 'A8838'})` : `Agency Balance (Grid: ${activeActionUserAgent.gridCode || 'A8838'})`}
                          </span>
                          <span className="font-mono text-sm font-black text-amber-700 dark:text-amber-300">
                            {(activeActionUserAgent.balance || 0).toLocaleString()} 💎
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] text-amber-700/80 dark:text-amber-300/80 font-medium">
                        {isAr ? 'منفصل عن الرصيد الشخصي' : 'Separate from personal wallet'}
                      </span>
                    </div>
                  )}

                  {/* Country */}
                  <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800">
                    <span className="text-[10px] text-neutral-500 block">{isAr ? 'الدولة' : 'Country'}</span>
                    <span className="font-bold text-neutral-900 dark:text-white flex items-center gap-1.5 mt-0.5">
                      <Globe className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>{formatCountryUnified(activeActionUser.country, isAr ? 'ar' : 'en')}</span>
                    </span>
                  </div>

                  {/* Gender & Birthdate */}
                  <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800">
                    <span className="text-[10px] text-neutral-500 block">{isAr ? 'الجنس / تاريخ الميلاد' : 'Gender / DOB'}</span>
                    <span className="font-bold text-neutral-900 dark:text-white block mt-0.5">
                      {activeActionUser.gender === 'female'
                        ? isAr ? 'أنثى' : 'Female'
                        : activeActionUser.gender === 'male'
                        ? isAr ? 'ذكر' : 'Male'
                        : '—'}{' '}
                      • {activeActionUser.birthDate || '—'}
                    </span>
                  </div>

                  {/* Registration Date */}
                  <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800">
                    <span className="text-[10px] text-neutral-500 block">{isAr ? 'تاريخ التسجيل' : 'Joined Date'}</span>
                    <span className="font-mono font-semibold text-neutral-800 dark:text-neutral-200 block mt-0.5">
                      {formatLocalDateTime(activeActionUser.createdAt, isAr ? 'ar' : 'en')}
                    </span>
                  </div>

                  {/* Security & Reports */}
                  <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] text-neutral-500 block">{isAr ? 'المصادقة الثنائية / البلاغات' : '2FA / Reports'}</span>
                      <span className="font-bold text-neutral-900 dark:text-white block mt-0.5">
                        <span className={activeActionUser.twoFactorEnabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-500'}>
                          {activeActionUser.twoFactorEnabled ? (isAr ? '2FA مفعّلة' : '2FA On') : (isAr ? '2FA معطّلة' : '2FA Off')}
                        </span>
                        {' • '}
                        <span className={(activeActionUser.reportsCount || 0) > 0 ? 'text-rose-600 dark:text-rose-400 font-black' : 'text-neutral-500'}>
                          {isAr ? `${activeActionUser.reportsCount || 0} بلاغ` : `${activeActionUser.reportsCount || 0} reports`}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Internal UUID */}
                <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/70 dark:border-neutral-800 flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-mono text-neutral-500 truncate">
                    UUID: {activeActionUser.id}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyField(activeActionUser.id, 'uuid')}
                    className="text-neutral-500 hover:text-neutral-900 dark:hover:text-white cursor-pointer shrink-0"
                    title="Copy UUID"
                  >
                    {copiedActionField === 'uuid' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* Bio */}
                {activeActionUser.bio && (
                  <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800 text-xs text-neutral-700 dark:text-neutral-300">
                    <span className="font-bold text-cyan-600 dark:text-cyan-400">{isAr ? 'النبذة التعريفية: ' : 'Bio: '}</span>
                    {activeActionUser.bio}
                  </div>
                )}

                {/* Ban / Freeze Reasons */}
                {(activeActionUser.banReason || activeActionUser.freezeReason) && (
                  <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-700 dark:text-rose-300 space-y-1">
                    {activeActionUser.banReason && (
                      <div>
                        <span className="font-bold">{isAr ? 'سبب الحظر: ' : 'Ban Reason: '}</span>
                        {activeActionUser.banReason}
                      </div>
                    )}
                    {activeActionUser.freezeReason && (
                      <div>
                        <span className="font-bold">{isAr ? 'سبب التجميد: ' : 'Freeze Reason: '}</span>
                        {activeActionUser.freezeReason}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Actions Menu Grid */}
              <div className="space-y-2.5 pt-1 border-t border-neutral-200 dark:border-neutral-800">
                <h4 className="text-xs font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-wide flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-amber-500" />
                  <span>{isAr ? 'قائمة الإجراءات' : 'Actions Menu'}</span>
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {/* Edit Balance */}
                  <button
                    type="button"
                    onClick={() => handleOpenBalanceModal(activeActionUser)}
                    className="p-2.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Coins className="w-4 h-4 shrink-0" />
                    <span className="truncate">{isAr ? 'الرصيد الشخصي' : 'Personal Balance'}</span>
                  </button>

                  {/* Agency Action */}
                  {activeActionUserAgent ? (
                    <button
                      type="button"
                      onClick={() => handleOpenAgentBalanceModal(activeActionUserAgent)}
                      className="p-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <Building2 className="w-4 h-4 shrink-0" />
                      <span className="truncate">{isAr ? 'رصيد الوكالة' : 'Agency Balance'}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleOpenAddAgent(activeActionUser)}
                      className="p-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <Building2 className="w-4 h-4 shrink-0" />
                      <span className="truncate">{isAr ? 'تعيين كوكيل شحن' : 'Appoint Agent'}</span>
                    </button>
                  )}

                  {/* Edit Profile */}
                  <button
                    type="button"
                    onClick={() => handleOpenEditUser(activeActionUser)}
                    className="p-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Pencil className="w-4 h-4 shrink-0" />
                    <span className="truncate">{isAr ? 'تعديل البيانات' : 'Edit Profile'}</span>
                  </button>

                  {/* Change Password */}
                  <button
                    type="button"
                    onClick={() => handleOpenPasswordModal(activeActionUser)}
                    className="p-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <KeyRound className="w-4 h-4 text-amber-500 shrink-0" />
                    <span className="truncate">{isAr ? 'كلمة المرور' : 'Password'}</span>
                  </button>

                  {/* Country */}
                  <button
                    type="button"
                    onClick={() => handleOpenCountryModal(activeActionUser)}
                    className="p-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Globe className="w-4 h-4 shrink-0" />
                    <span className="truncate">{isAr ? 'تغيير الدولة' : 'Country'}</span>
                  </button>

                  {/* 2FA */}
                  <button
                    type="button"
                    onClick={() => handleOpen2FAModal(activeActionUser)}
                    className="p-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span className="truncate">{isAr ? 'المصادقة الثنائية' : 'Manage 2FA'}</span>
                  </button>

                  {/* Send Notification */}
                  <button
                    type="button"
                    onClick={() => handleOpenUserNotifyModal(activeActionUser)}
                    className="p-2.5 rounded-xl bg-violet-500/10 hover:bg-violet-500/20 text-violet-700 dark:text-violet-300 border border-violet-500/30 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Megaphone className="w-4 h-4 shrink-0" />
                    <span className="truncate">{isAr ? 'إرسال إشعار' : 'Notify'}</span>
                  </button>

                  {/* Reports */}
                  <button
                    type="button"
                    onClick={() => handleOpenUserReportsModal(activeActionUser)}
                    className="p-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Flag className="w-4 h-4 shrink-0" />
                    <span className="truncate">
                      {isAr ? `البلاغات (${activeActionUser.reportsCount || 0})` : `Reports (${activeActionUser.reportsCount || 0})`}
                    </span>
                  </button>

                  {/* Verify Toggle */}
                  <button
                    type="button"
                    disabled={togglingVerifyUserId === activeActionUser.id}
                    onClick={() => handleToggleUserVerify(activeActionUser)}
                    className={`p-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer border disabled:opacity-50 ${
                      activeActionUser.isVerified
                        ? 'bg-[#1D9BF0]/15 hover:bg-rose-500/15 text-[#1D9BF0] hover:text-rose-600 dark:hover:text-rose-400 border-[#1D9BF0]/40 hover:border-rose-500/40'
                        : 'bg-[#1D9BF0]/10 hover:bg-[#1D9BF0] text-[#1D9BF0] hover:text-white border-[#1D9BF0]/30'
                    }`}
                  >
                    {togglingVerifyUserId === activeActionUser.id ? (
                      <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                    ) : (
                      <BadgeCheck className="w-4 h-4 shrink-0" />
                    )}
                    <span className="truncate">
                      {activeActionUser.isVerified ? (isAr ? 'إلغاء التوثيق' : 'Unverify') : isAr ? 'توثيق الحساب' : 'Verify'}
                    </span>
                  </button>

                  {/* Freeze / Unfreeze */}
                  {activeActionUser.isFrozen ? (
                    <button
                      type="button"
                      onClick={() => handleUnfreezeUser(activeActionUser)}
                      className="p-2.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-800 dark:text-cyan-200 border border-cyan-500/50 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <Unlock className="w-4 h-4 shrink-0" />
                      <span className="truncate">{isAr ? 'فك التجميد' : 'Unfreeze'}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleOpenFreezeModal(activeActionUser)}
                      className="p-2.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <Snowflake className="w-4 h-4 shrink-0" />
                      <span className="truncate">{isAr ? 'تجميد (بالدقائق)' : 'Freeze'}</span>
                    </button>
                  )}

                  {/* Ban / Unban */}
                  {activeActionUser.isBanned ? (
                    <button
                      type="button"
                      onClick={() => handleUnbanUser(activeActionUser)}
                      className="p-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-800 dark:text-emerald-200 border border-emerald-500/50 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <UserCheck className="w-4 h-4 shrink-0" />
                      <span className="truncate">{isAr ? 'فك الحظر' : 'Unban'}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleOpenBanModal(activeActionUser)}
                      className="p-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <Ban className="w-4 h-4 shrink-0" />
                      <span className="truncate">{isAr ? 'حظر نهائي' : 'Ban User'}</span>
                    </button>
                  )}

                  {/* Delete User */}
                  <button
                    type="button"
                    onClick={() => setDeletingUserId(activeActionUser.id)}
                    className="p-2.5 rounded-xl bg-red-600/10 hover:bg-red-600/20 text-red-600 dark:text-red-400 border border-red-500/30 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4 shrink-0" />
                    <span className="truncate">{isAr ? 'حذف المستخدم' : 'Delete User'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Bulk Clear Section Confirmation Modal */}
      {clearConfirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <button
              type="button"
              onClick={() => setClearConfirmTarget(null)}
              className="absolute top-4 right-4 rtl:right-auto rtl:left-4 p-2 rounded-full text-neutral-400 hover:text-neutral-900 dark:hover:text-white bg-neutral-100 dark:bg-neutral-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0 border border-rose-500/20">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                  {clearConfirmTarget === 'feedback'
                    ? isAr ? 'إفراغ مركز البلاغات والاقتراحات' : 'Clear Reports & Suggestions'
                    : isAr ? 'إفراغ طلبات استعادة كلمة المرور' : 'Clear Password Resets'}
                </h3>
                <p className="text-xs text-neutral-500">
                  {isAr ? 'سيتم حذف جميع السجلات في هذا القسم نهائياً.' : 'All records in this section will be deleted permanently.'}
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setClearConfirmTarget(null)}
                className="flex-1 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-bold transition-colors cursor-pointer"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={isClearingSection}
                onClick={handleConfirmClearSection}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
              >
                {isClearingSection ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{isAr ? 'جاري الإفراغ...' : 'Clearing...'}</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isAr ? 'تأكيد الإفراغ' : 'Confirm Clear'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 1: Edit User Profile (Name, Email, Display ID, DOB, Gender) */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <button
              type="button"
              onClick={() => {
                setEditingUser(null);
                setEditUserError(null);
              }}
              className="absolute top-4 right-4 rtl:right-auto rtl:left-4 p-2 rounded-full text-neutral-400 hover:text-neutral-900 dark:hover:text-white bg-neutral-100 dark:bg-neutral-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-amber-500" />
              <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                {isAr ? 'تعديل بيانات المستخدم والحساب' : 'Edit User & Account Data'}
              </h3>
            </div>

            <form onSubmit={handleSaveEditUser} className="space-y-3 pt-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  {isAr ? 'اسم المستخدم (Full Name):' : 'Full Name:'}
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  {isAr ? 'البريد الإلكتروني (Email):' : 'Email Address:'}
                </label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                  <span>{isAr ? 'معرف الحساب ID (نمط Soul-X):' : 'Account ID (Soul-X format):'}</span>
                  <span className="text-[10px] text-amber-500 font-mono font-normal">
                    {isAr ? 'نمط: S-0101V77-X711' : 'e.g. S-0101V77-X711'}
                  </span>
                </label>
                <input
                  type="text"
                  required
                  value={editDisplayId}
                  onChange={(e) => setEditDisplayId(e.target.value)}
                  placeholder="مثال: S-0101V77-X711"
                  className="w-full p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    {isAr ? 'تاريخ الميلاد:' : 'Date of Birth:'}
                  </label>
                  <input
                    type="date"
                    value={editBirthDate}
                    onChange={(e) => setEditBirthDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    {isAr ? 'الجنس:' : 'Gender:'}
                  </label>
                  <select
                    value={editGender || ''}
                    onChange={(e) => setEditGender((e.target.value as any) || null)}
                    className="w-full p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="">{isAr ? 'غير محدد' : 'Unspecified'}</option>
                    <option value="male">{isAr ? 'ذكر' : 'Male'}</option>
                    <option value="female">{isAr ? 'أنثى' : 'Female'}</option>
                  </select>
                </div>
              </div>

              {/* Country Selection Field */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-emerald-500" />
                    <span>{isAr ? 'الدولة:' : 'Country:'}</span>
                  </span>
                  {editCountry && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                      {formatCountryUnified(editCountry, isAr ? 'ar' : 'en')}
                    </span>
                  )}
                </label>
                <select
                  value={editCountry || ''}
                  onChange={(e) => setEditCountry(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500 font-medium"
                >
                  <option value="">{isAr ? 'اختر الدولة...' : 'Select Country...'}</option>
                  {editCountry && !WORLD_COUNTRIES.some((c) => c.nameAr === editCountry) && (
                    <option value={editCountry}>{editCountry}</option>
                  )}
                  {WORLD_COUNTRIES.map((c) => (
                    <option key={c.code} value={c.nameAr}>
                      {isAr ? c.nameAr : c.nameEn}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  {isAr ? 'النبذة الشخصية (Bio):' : 'Bio:'}
                </label>
                <textarea
                  rows={3}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder={isAr ? 'اكتب نبذة المستخدم...' : 'User bio...'}
                  className="w-full p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500 resize-none leading-relaxed"
                />
              </div>

              {editUserError && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{editUserError}</span>
                </div>
              )}

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setEditingUser(null);
                    setEditUserError(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-semibold transition-colors cursor-pointer"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingUser}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isUpdatingUser ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ التغييرات' : 'Save Changes')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dedicated Country Management Modal */}
      {countryUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <button
              type="button"
              onClick={() => setCountryUser(null)}
              className="absolute top-4 right-4 rtl:right-auto rtl:left-4 p-2 rounded-full text-neutral-400 hover:text-neutral-900 dark:hover:text-white bg-neutral-100 dark:bg-neutral-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 shrink-0">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                <Globe className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <h3 className="text-base font-black text-neutral-900 dark:text-white">
                  {isAr ? 'تعديل وتعيين دولة المستخدم' : 'Edit & Set User Country'}
                </h3>
                <p className="text-xs text-neutral-500 truncate max-w-[240px]">
                  {countryUser.name} ({countryUser.displayId || countryUser.id})
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveCountry} className="space-y-4 pt-1 flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* Current Country Badge */}
              <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs flex items-center justify-between shrink-0">
                <span className="text-neutral-500">{isAr ? 'الدولة الحالية المسجلة:' : 'Current Registered Country:'}</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5" />
                  <span>{formatCountryUnified(countryUser.country, isAr ? 'ar' : 'en')}</span>
                </span>
              </div>

              {/* Search Country Input */}
              <div className="relative shrink-0">
                <Search className="w-4 h-4 text-neutral-400 absolute right-3 top-1/2 -translate-y-1/2 rtl:right-3 rtl:left-auto ltr:left-3 ltr:right-auto" />
                <input
                  type="text"
                  value={countrySearchFilter}
                  onChange={(e) => setCountrySearchFilter(e.target.value)}
                  placeholder={isAr ? 'ابحث عن الدولة في القائمة...' : 'Search countries in list...'}
                  className="w-full py-2.5 pr-9 pl-3 rtl:pr-9 rtl:pl-3 ltr:pl-9 ltr:pr-3 text-xs rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
                {countrySearchFilter && (
                  <button
                    type="button"
                    onClick={() => setCountrySearchFilter('')}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 rtl:left-2.5 rtl:right-auto ltr:right-2.5 ltr:left-auto text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 p-0.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Scrollable list of countries */}
              <div className="flex-1 overflow-y-auto space-y-1 pr-1 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-2 bg-neutral-50/50 dark:bg-neutral-950/50 min-h-[160px] max-h-[220px]">
                {WORLD_COUNTRIES
                  .filter((c) => {
                    if (!countrySearchFilter.trim()) return true;
                    const q = countrySearchFilter.trim().toLowerCase();
                    return c.nameAr.toLowerCase().includes(q) || c.nameEn.toLowerCase().includes(q) || c.code.toLowerCase().includes(q);
                  })
                  .map((c) => {
                    const isSelected = selectedCountry === c.nameAr || selectedCountry === c.nameEn;
                    return (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => setSelectedCountry(c.nameAr)}
                        className={`w-full py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-500 text-white font-bold shadow-xs'
                            : 'hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <Globe className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-emerald-500'}`} />
                          <span>{isAr ? c.nameAr : c.nameEn}</span>
                        </span>
                        {isSelected && <Check className="w-4 h-4 stroke-[2.5]" />}
                      </button>
                    );
                  })}
              </div>

              {/* Custom Country Manual Input */}
              <div className="space-y-1 shrink-0 pt-1">
                <label className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 flex items-center justify-between">
                  <span>{isAr ? 'الدولة المختارة / إدخال مخصص:' : 'Selected / Custom Country:'}</span>
                </label>
                <input
                  type="text"
                  required
                  value={selectedCountry}
                  onChange={(e) => setSelectedCountry(e.target.value)}
                  placeholder={isAr ? 'اكتب اسم الدولة هنا...' : 'Type country name here...'}
                  className="w-full p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs font-bold text-neutral-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setCountryUser(null)}
                  className="flex-1 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-semibold transition-colors cursor-pointer"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingCountry || !selectedCountry.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white font-bold text-xs transition-colors shadow-sm disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {isUpdatingCountry ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>{isAr ? 'جاري الحفظ...' : 'Saving...'}</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>{isAr ? 'حفظ وتحديث الدولة' : 'Save Country'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Change User Password */}
      {passwordUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <button
              type="button"
              onClick={() => setPasswordUser(null)}
              className="absolute top-4 right-4 rtl:right-auto rtl:left-4 p-2 rounded-full text-neutral-400 hover:text-neutral-900 dark:hover:text-white bg-neutral-100 dark:bg-neutral-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-amber-500" />
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                  {isAr ? 'تغيير كلمة مرور المستخدم' : 'Change User Password'}
                </h3>
                <p className="text-xs text-neutral-500">
                  {passwordUser.name} ({passwordUser.email})
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmitChangePassword} className="space-y-3 pt-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  {isAr ? 'كلمة المرور الجديدة:' : 'New Password:'}
                </label>
                <input
                  type="password"
                  required
                  minLength={4}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  {isAr ? 'تأكيد كلمة المرور:' : 'Confirm Password:'}
                </label>
                <input
                  type="password"
                  required
                  minLength={4}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setPasswordUser(null)}
                  className="flex-1 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-semibold transition-colors cursor-pointer"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition-colors shadow-sm cursor-pointer"
                >
                  {isChangingPassword ? (isAr ? 'جاري التغيير...' : 'Updating...') : (isAr ? 'تحديث كلمة المرور' : 'Update Password')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2.5: Admin Manage Two-Factor Authentication (2FA) */}
      {twoFactorUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => {
                setTwoFactorUser(null);
                setTwoFactorDetails(null);
              }}
              className="absolute top-4 right-4 rtl:right-auto rtl:left-4 p-2 rounded-full text-neutral-400 hover:text-neutral-900 dark:hover:text-white bg-neutral-100 dark:bg-neutral-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-500 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-black text-neutral-900 dark:text-white">
                    {isAr ? 'إدارة المصادقة الثنائية (2FA)' : 'Manage Two-Factor Authentication'}
                  </h3>
                  {twoFactorDetails && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                        twoFactorDetails.twoFactorEnabled
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 border-neutral-200 dark:border-neutral-700'
                      }`}
                    >
                      {twoFactorDetails.twoFactorEnabled
                        ? (isAr ? 'مفعلة للحساب' : 'Enabled')
                        : (isAr ? 'معطلة حالياً' : 'Disabled')}
                    </span>
                  )}
                </div>
                <p className="text-xs text-neutral-500 truncate">
                  {twoFactorUser.name} • <span className="font-mono">{twoFactorUser.email}</span> (ID: {twoFactorUser.displayId || twoFactorUser.id})
                </p>
              </div>
            </div>

            {isLoading2FA ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-cyan-600 dark:text-cyan-400">
                <RefreshCw className="w-6 h-6 animate-spin" />
                <span className="text-xs font-bold">{isAr ? 'جاري جلب تفاصيل المصادقة...' : 'Loading 2FA details...'}</span>
              </div>
            ) : twoFactorDetails ? (
              <div className="space-y-4">
                {/* Status overview */}
                {twoFactorDetails.twoFactorEnabled ? (
                  <div className="space-y-4">
                    {/* Secret Key Display */}
                    <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                          <KeyRound className="w-3.5 h-3.5 text-cyan-500" />
                          <span>{isAr ? 'مفتاح المصادقة السري (Secret Key):' : 'Authenticator Secret Key:'}</span>
                        </label>
                        <button
                          type="button"
                          onClick={handleCopy2FASecret}
                          className="text-[11px] text-cyan-600 dark:text-cyan-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          {copied2FASecret ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                          <span>{copied2FASecret ? (isAr ? 'تم النسخ' : 'Copied') : (isAr ? 'نسخ المفتاح' : 'Copy Key')}</span>
                        </button>
                      </div>
                      <div className="p-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                        <span className="font-mono text-xs font-black text-neutral-900 dark:text-white select-all break-all tracking-wider" dir="ltr">
                          {twoFactorDetails.twoFactorSecret || (isAr ? 'غير متوفر' : 'Unavailable')}
                        </span>
                      </div>
                      <p className="text-[10px] text-neutral-500">
                        {isAr
                          ? 'يمكن للمستخدم إدخال هذا المفتاح يدوياً في تطبيق Google Authenticator إذا تعذر مسح رمز QR.'
                          : 'User can manually type this key into Google Authenticator.'}
                      </p>
                    </div>

                    {/* QR Code if generated in this session */}
                    {twoFactorDetails.qrCodeDataUrl && (
                      <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 flex flex-col items-center gap-2">
                        <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                          {isAr ? 'رمز QR للإعداد السريع:' : 'Quick Setup QR Code:'}
                        </span>
                        <div className="p-2 rounded-2xl bg-white border border-neutral-200 shadow-xs">
                          <img
                            src={twoFactorDetails.qrCodeDataUrl}
                            alt="2FA QR Code"
                            className="w-36 h-36 object-contain rounded-xl"
                          />
                        </div>
                      </div>
                    )}

                    {/* Backup Codes Display */}
                    <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5" />
                          <span>{isAr ? 'الرموز الاحتياطية (8 رموز للطوارئ):' : 'Backup Recovery Codes:'}</span>
                        </span>
                        <button
                          type="button"
                          onClick={handleCopy2FABackupCodes}
                          className="text-[11px] text-amber-600 dark:text-amber-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          {copied2FABackup ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                          <span>{copied2FABackup ? (isAr ? 'تم النسخ' : 'Copied') : (isAr ? 'نسخ الرموز' : 'Copy Codes')}</span>
                        </button>
                      </div>

                      {twoFactorDetails.twoFactorBackupCodes && twoFactorDetails.twoFactorBackupCodes.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1" dir="ltr">
                          {twoFactorDetails.twoFactorBackupCodes.map((code, idx) => (
                            <div
                              key={idx}
                              className="py-1 px-2 rounded-lg bg-white/80 dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-800 font-mono text-[11px] text-center font-bold text-neutral-800 dark:text-neutral-200 select-all"
                            >
                              {code}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-neutral-500">
                          {isAr ? 'لم يتم حفظ رموز احتياطية إضافية' : 'No extra backup codes saved'}
                        </p>
                      )}
                    </div>

                    {/* Action: Disable 2FA for this user */}
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={handleAdminDisable2FA}
                        disabled={isUpdating2FA}
                        className="w-full py-3 px-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs transition-all cursor-pointer shadow-md shadow-rose-600/20 active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isUpdating2FA ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <ShieldAlert className="w-4 h-4" />
                        )}
                        <span>{isAr ? 'تعطيل المصادقة الثنائية لهذا الحساب فوراً' : 'Disable 2FA for this Account'}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* When 2FA is Disabled: Show Enable option */
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed space-y-2">
                      <div className="flex items-center gap-2 text-neutral-800 dark:text-neutral-200 font-bold">
                        <Lock className="w-4 h-4 text-cyan-500" />
                        <span>{isAr ? 'المصادقة الثنائية غير مفعلة لهذا الحساب' : '2FA is currently disabled for this user'}</span>
                      </div>
                      <p>
                        {isAr
                          ? 'يمكنك تفعيل المصادقة الثنائية للحساب مباشرة من هنا؛ سيتم توليد مفتاح سري جديد، رمز QR، و 8 أكواد احتياطية لتسليمها للمستخدم.'
                          : 'You can enable 2FA directly. A new secret key, QR code, and 8 backup codes will be generated for the user.'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleAdminEnable2FA}
                      disabled={isUpdating2FA}
                      className="w-full py-3.5 px-4 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-black text-xs transition-all cursor-pointer shadow-md shadow-cyan-500/25 active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isUpdating2FA ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
                      )}
                      <span>{isAr ? 'تفعيل وتوليد مفاتيح المصادقة الثنائية لهذا الحساب' : 'Enable & Generate 2FA Keys'}</span>
                    </button>
                  </div>
                )}
              </div>
            ) : null}

            {/* Close footer button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setTwoFactorUser(null);
                  setTwoFactorDetails(null);
                }}
                className="w-full py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                {isAr ? 'إغلاق النافذة' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Change User Balance (Diamonds 💎 & Coins 🪙) */}
      {balanceUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <button
              type="button"
              onClick={() => setBalanceUser(null)}
              className="absolute top-4 right-4 rtl:right-auto rtl:left-4 p-2 rounded-full text-neutral-400 hover:text-neutral-900 dark:hover:text-white bg-neutral-100 dark:bg-neutral-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-xl ${userBalanceCurrency === 'coins' ? 'bg-amber-500/10 text-amber-500' : 'bg-cyan-500/10 text-cyan-500'}`}>
                {userBalanceCurrency === 'coins' ? <Coins className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                  {isAr ? 'تعديل رصيد الحساب الشخصي للمستخدم' : 'Modify Personal Account Balance'}
                </h3>
                <p className="text-xs text-neutral-500">
                  {balanceUser.name} • {isAr ? 'الرصيد الشخصي الحالي:' : 'Current Personal:'}{' '}
                  {userBalanceCurrency === 'coins' ? (
                    <span className="font-mono font-bold text-amber-500 inline-flex items-center gap-1">
                      <span>{(balanceUser.coinsBalance ?? 0).toLocaleString()}</span>
                      <CoinIcon className="w-3.5 h-3.5" />
                    </span>
                  ) : (
                    <span className="font-mono font-bold text-cyan-500 inline-flex items-center gap-1">
                      <span>{(balanceUser.walletBalance ?? 0).toLocaleString()}</span>
                      <DiamondIcon className="w-3.5 h-3.5 text-cyan-400" />
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* If user is an agent, show explicit isolation reminder */}
            {(() => {
              const linkedAgent = agents.find((a) => a.email.toLowerCase() === balanceUser.email.toLowerCase());
              if (linkedAgent) {
                return (
                  <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-300 text-xs flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-amber-500 shrink-0" />
                      <div>
                        <div className="font-bold">
                          {isAr ? `المستخدم وكيل معتمد (${linkedAgent.gridCode || 'A8838'})` : `User is an Agent (${linkedAgent.gridCode || 'A8838'})`}
                        </div>
                        <div className="text-[11px] opacity-80 inline-flex items-center gap-1">
                          <span>{isAr ? 'رصيد وكالته:' : 'Agency balance:'}</span>
                          <span>{(linkedAgent.balance || 0).toLocaleString()}</span>
                          <DiamondIcon className="w-3 h-3 text-amber-400" />
                          <span>{isAr ? '(منفصل ولا يتأثر)' : '(isolated)'}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setBalanceUser(null);
                        handleOpenAgentBalanceModal(linkedAgent);
                      }}
                      className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-800 dark:text-amber-200 text-[10px] font-bold transition-colors cursor-pointer shrink-0"
                    >
                      {isAr ? 'تعديل رصيد الوكالة' : 'Edit Agency'}
                    </button>
                  </div>
                );
              }
              return null;
            })()}

            {/* Currency Selector Tabs (💎 الماسات vs 🪙 الكوينز) */}
            <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => {
                  setUserBalanceCurrency('diamonds');
                  if (userBalanceAmount === '5000' || userBalanceAmount === '10000' || userBalanceAmount === '50000') {
                    setUserBalanceAmount('500');
                  }
                }}
                className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  userBalanceCurrency === 'diamonds'
                    ? 'bg-cyan-500 text-neutral-950 shadow-sm'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                <DiamondIcon className="w-3.5 h-3.5" />
                <span>{isAr ? 'الماسات (Diamonds)' : 'Diamonds'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setUserBalanceCurrency('coins');
                  if (userBalanceAmount === '500' || userBalanceAmount === '100') {
                    setUserBalanceAmount('5000');
                  }
                }}
                className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  userBalanceCurrency === 'coins'
                    ? 'bg-amber-500 text-neutral-950 shadow-sm'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                <CoinIcon className="w-3.5 h-3.5" />
                <span>{isAr ? 'الكوينز (Coins)' : 'Coins'}</span>
              </button>
            </div>

            <form onSubmit={handleSubmitUserBalance} className="space-y-4 pt-1">
              {/* Action type buttons */}
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setUserBalanceAction('add')}
                  className={`py-2 rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                    userBalanceAction === 'add'
                      ? 'bg-emerald-500 text-white shadow-xs'
                      : 'text-neutral-600 dark:text-neutral-400'
                  }`}
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>{isAr ? 'إضافة (+)' : 'Add (+)'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setUserBalanceAction('deduct')}
                  className={`py-2 rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                    userBalanceAction === 'deduct'
                      ? 'bg-red-500 text-white shadow-xs'
                      : 'text-neutral-600 dark:text-neutral-400'
                  }`}
                >
                  <MinusCircle className="w-3.5 h-3.5" />
                  <span>{isAr ? 'خصم (-)' : 'Deduct (-)'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setUserBalanceAction('set')}
                  className={`py-2 rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                    userBalanceAction === 'set'
                      ? userBalanceCurrency === 'coins'
                        ? 'bg-amber-500 text-neutral-950 shadow-xs'
                        : 'bg-cyan-500 text-neutral-950 shadow-xs'
                      : 'text-neutral-600 dark:text-neutral-400'
                  }`}
                >
                  <Coins className="w-3.5 h-3.5" />
                  <span>{isAr ? 'تعيين (=)' : 'Set (=)'}</span>
                </button>
              </div>

              {/* Amount input */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                  <span>{userBalanceCurrency === 'coins' ? (isAr ? 'القيمة المطلوبة (بالكوينز):' : 'Amount in Coins:') : (isAr ? 'القيمة المطلوبة (بالماسات):' : 'Amount in Diamonds:')}</span>
                  {userBalanceCurrency === 'coins' ? <CoinIcon className="w-3.5 h-3.5" /> : <DiamondIcon className="w-3.5 h-3.5 text-cyan-400" />}
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={userBalanceAmount}
                  onChange={(e) => setUserBalanceAmount(e.target.value)}
                  className={`w-full p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-sm font-mono font-bold text-neutral-900 dark:text-white focus:outline-none ${
                    userBalanceCurrency === 'coins' ? 'focus:border-amber-500' : 'focus:border-cyan-500'
                  }`}
                />
              </div>

              {/* Quick Amount Chips */}
              <div className="flex flex-wrap gap-1.5">
                {(userBalanceCurrency === 'coins'
                  ? [1000, 5000, 10000, 50000, 100000]
                  : [100, 500, 1000, 5000, 10000]
                ).map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setUserBalanceAmount(amt.toString())}
                    className="px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-mono font-semibold transition-colors cursor-pointer"
                  >
                    +{amt.toLocaleString()}
                  </button>
                ))}
              </div>

              {/* Live Preview */}
              <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-xs">
                <span className="text-neutral-500">{isAr ? 'الرصيد النهائي بعد التعديل:' : 'New Balance Preview:'}</span>
                <span className={`font-mono font-bold text-sm inline-flex items-center gap-1 ${userBalanceCurrency === 'coins' ? 'text-amber-500' : 'text-cyan-600 dark:text-cyan-400'}`}>
                  <span>{(() => {
                    const current = userBalanceCurrency === 'coins'
                      ? (balanceUser.coinsBalance ?? 0)
                      : (balanceUser.walletBalance ?? 0);
                    const val = parseFloat(userBalanceAmount) || 0;
                    if (userBalanceAction === 'add') return (current + val).toLocaleString();
                    if (userBalanceAction === 'deduct') return Math.max(0, current - val).toLocaleString();
                    return Math.max(0, val).toLocaleString();
                  })()}</span>
                  {userBalanceCurrency === 'coins' ? (
                    <CoinIcon className="w-3.5 h-3.5" />
                  ) : (
                    <DiamondIcon className="w-3.5 h-3.5 text-cyan-400" />
                  )}
                </span>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setBalanceUser(null)}
                  className="flex-1 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-semibold transition-colors cursor-pointer"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingUserBalance}
                  className={`flex-1 py-2.5 rounded-xl text-neutral-950 text-xs font-bold transition-colors shadow-sm cursor-pointer disabled:opacity-50 ${
                    userBalanceCurrency === 'coins'
                      ? 'bg-amber-500 hover:bg-amber-400'
                      : 'bg-cyan-500 hover:bg-cyan-400'
                  }`}
                >
                  {isUpdatingUserBalance
                    ? (isAr ? 'جاري التحديث...' : 'Saving...')
                    : (isAr ? `تأكيد تعديل ${userBalanceCurrency === 'coins' ? 'الكوينز' : 'الماسات'}` : 'Confirm Update')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Add New Agent (إضافة وكيل وتعيينه بالبريد والدولة والرصيد) */}
      {isAddAgentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setIsAddAgentModalOpen(false)}
              className="absolute top-4 right-4 rtl:right-auto rtl:left-4 p-2 rounded-full text-neutral-400 hover:text-neutral-900 dark:hover:text-white bg-neutral-100 dark:bg-neutral-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 border border-amber-500/20">
                <Building2 className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                  {isAr ? 'تعيين وإضافة وكيل معتمد' : 'Assign & Add Certified Agent'}
                </h3>
                <p className="text-xs text-neutral-500">
                  {isAr ? 'البيانات المطلوبة للتعيين والإضافة: الرقم الفريد، البريد، اسم الوكالة، ودولة الوكيل كتابةً' : 'Required fields: Unique ID, Email, Agency Name, and Country (typed)'}
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmitAddAgent} className="space-y-4 pt-2">
              {/* 1. رقم فريد للوكيل */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[11px] font-bold inline-flex items-center justify-center">1</span>
                    <span>{isAr ? 'رقم فريد للوكيل (Grid ID):' : 'Unique Agent ID (Grid ID):'}</span>
                  </span>
                  <span className="text-[10px] text-amber-500 font-mono font-bold">مثال: A8838</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={agentGridCode}
                    onChange={(e) => setAgentGridCode(e.target.value.toUpperCase())}
                    placeholder="A8838"
                    className="flex-1 p-3 rounded-2xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-sm font-mono font-bold text-amber-500 focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setAgentGridCode('A' + Math.floor(1000 + Math.random() * 9000))}
                    className="px-3.5 py-2.5 rounded-2xl bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs font-bold hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-colors cursor-pointer shrink-0"
                  >
                    {isAr ? 'توليد تلقائي' : 'Generate'}
                  </button>
                </div>
              </div>

              {/* 2. البريد الإلكتروني */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[11px] font-bold inline-flex items-center justify-center">2</span>
                    <span>{isAr ? 'البريد الإلكتروني للوكيل:' : 'Agent Email Address:'}</span>
                  </span>
                  <span className="text-[10px] text-neutral-400 font-mono">agent@example.com</span>
                </label>
                <input
                  type="email"
                  required
                  value={agentEmail}
                  onChange={(e) => setAgentEmail(e.target.value)}
                  placeholder="agent@example.com"
                  className="w-full p-3 rounded-2xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              {/* 3. اسم الوكيل أو الوكالة */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[11px] font-bold inline-flex items-center justify-center">3</span>
                  <span>{isAr ? 'اسم الوكيل أو الوكالة:' : 'Agent or Agency Name:'}</span>
                </label>
                <input
                  type="text"
                  required
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder={isAr ? 'اكتب اسم الوكيل أو الوكالة (مثال: وكالة الرياض السريعة للشحن)' : 'Agent or agency name...'}
                  className="w-full p-3 rounded-2xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* 4. دولة الوكيل (كتابة) */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[11px] font-bold inline-flex items-center justify-center">4</span>
                    <span>{isAr ? 'دولة الوكيل (كتابة):' : 'Agent Country (Written):'}</span>
                  </span>
                  <span className="text-[10px] text-amber-500 font-bold">{isAr ? 'كتابة يدوية' : 'Type manually'}</span>
                </label>
                <input
                  type="text"
                  required
                  value={agentCountry}
                  onChange={(e) => setAgentCountry(e.target.value)}
                  placeholder={isAr ? 'اكتب اسم الدولة (مثال: المملكة العربية السعودية، مصر، العراق، الإمارات)...' : 'Type country name (e.g. Saudi Arabia, Egypt, Iraq)...'}
                  className="w-full p-3 rounded-2xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
                <p className="text-[10px] text-neutral-500">
                  {isAr ? 'يتم تحديد نطاق الوكالة للمستخدمين وفق الدولة المكتوبة هنا.' : 'Agency regional scope is matched based on this typed country.'}
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddAgentModalOpen(false)}
                  className="flex-1 py-3 rounded-2xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-semibold transition-colors cursor-pointer"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isCreatingAgent || !agentGridCode.trim() || !agentEmail.trim() || !agentName.trim() || !agentCountry.trim()}
                  className="flex-1 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  {isCreatingAgent ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>{isAr ? 'جاري التعيين والإضافة...' : 'Assigning...'}</span>
                    </>
                  ) : (
                    <span>{isAr ? 'تأكيد تعيين وإضافة الوكيل' : 'Confirm & Assign Agent'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 5: Edit Agent Details */}
      {editingAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setEditingAgent(null)}
              className="absolute top-4 right-4 rtl:right-auto rtl:left-4 p-2 rounded-full text-neutral-400 hover:text-neutral-900 dark:hover:text-white bg-neutral-100 dark:bg-neutral-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-amber-500" />
              <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                {isAr ? 'تعديل بيانات الوكيل' : 'Edit Agent Information'}
              </h3>
            </div>

            <form onSubmit={handleSubmitEditAgent} className="space-y-3 pt-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                  <span>{isAr ? 'رقم القريد (Grid ID):' : 'Agent Grid ID:'}</span>
                  <span className="text-[10px] text-amber-500 font-mono">مثال: A8838</span>
                </label>
                <input
                  type="text"
                  required
                  value={editingAgent.gridCode || ''}
                  onChange={(e) => setEditingAgent({ ...editingAgent, gridCode: e.target.value.toUpperCase() })}
                  placeholder="A8838"
                  className="w-full p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs font-mono font-bold text-amber-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  {isAr ? 'اسم الوكيل أو الوكالة:' : 'Agent Name:'}
                </label>
                <input
                  type="text"
                  required
                  value={editingAgent.name}
                  onChange={(e) => setEditingAgent({ ...editingAgent, name: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  {isAr ? 'البريد الإلكتروني للوكيل:' : 'Agent Email:'}
                </label>
                <input
                  type="email"
                  required
                  value={editingAgent.email}
                  onChange={(e) => setEditingAgent({ ...editingAgent, email: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs font-mono text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* 4. دولة الوكيل (كتابة) */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  {isAr ? 'دولة الوكيل (كتابة):' : 'Agent Country (Written):'}
                </label>
                <input
                  type="text"
                  required
                  value={editingAgent.country}
                  onChange={(e) => setEditingAgent({ ...editingAgent, country: e.target.value })}
                  placeholder={isAr ? 'اكتب اسم الدولة...' : 'Country name...'}
                  className="w-full p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* حالة الوكيل */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  {isAr ? 'حالة الوكيل:' : 'Agent Status:'}
                </label>
                <select
                  value={editingAgent.status || 'active'}
                  onChange={(e) => setEditingAgent({ ...editingAgent, status: e.target.value as any })}
                  className="w-full p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="active">{isAr ? 'نشط ومتاح للخدمة' : 'Active'}</option>
                  <option value="suspended">{isAr ? 'معلق / غير نشط' : 'Suspended'}</option>
                </select>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingAgent(null)}
                  className="flex-1 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-semibold transition-colors cursor-pointer"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingAgent}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition-colors shadow-sm cursor-pointer"
                >
                  {isUpdatingAgent ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ التعديلات' : 'Save Changes')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 6: Modify Agent Balance (تعديل رصيد وكيل) */}
      {balanceAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <button
              type="button"
              onClick={() => setBalanceAgent(null)}
              className="absolute top-4 right-4 rtl:right-auto rtl:left-4 p-2 rounded-full text-neutral-400 hover:text-neutral-900 dark:hover:text-white bg-neutral-100 dark:bg-neutral-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                  {isAr ? 'تعديل رصيد وكالة الشحن والسحب' : 'Modify Agency Balance'}
                </h3>
                <p className="text-xs text-neutral-500">
                  {balanceAgent.name} (قريد: {balanceAgent.gridCode || 'A8838'}) • {isAr ? 'رصيد الوكالة الحالي:' : 'Current Agency Balance:'}{' '}
                  <span className="font-mono font-bold text-amber-600 dark:text-amber-400 inline-flex items-center gap-1">
                    <span>{(balanceAgent.balance || 0).toLocaleString()}</span>
                    <DiamondIcon className="w-3.5 h-3.5 text-amber-400" />
                  </span>
                </p>
              </div>
            </div>

            {/* Linked User Personal Account Info */}
            {(() => {
              const linkedUser = users.find((u) => u.email.toLowerCase() === balanceAgent.email.toLowerCase());
              return (
                <div className="p-2.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/25 text-xs text-cyan-800 dark:text-cyan-300 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-500" />
                      <span>{isAr ? 'الحساب الشخصي للوكيل (منفصل تماماً):' : 'Agent Personal Account (Isolated):'}</span>
                    </span>
                    {linkedUser && (
                      <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400 inline-flex items-center gap-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1">
                          <span>{(linkedUser.walletBalance || 0).toLocaleString()}</span>
                          <DiamondIcon className="w-3 h-3 text-cyan-400" />
                        </span>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1 text-amber-500">
                          <span>{(linkedUser.coinsBalance || 0).toLocaleString()}</span>
                          <CoinIcon className="w-3 h-3" />
                        </span>
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] opacity-80 leading-relaxed">
                    {isAr
                      ? '🔒 هذا التعديل يغير رصيد وكالة الشحن فقط المستخدم في شحن الزبائن وسحب أرباح الوكالة، ولا يمس الرصيد الشخصي إطلاقاً.'
                      : '🔒 This modification exclusively affects the agency balance used for customer recharges and withdrawals.'}
                  </p>
                </div>
              );
            })()}

            <form onSubmit={handleSubmitAgentBalance} className="space-y-4 pt-2">
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setAgentBalanceAction('add')}
                  className={`py-2 rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                    agentBalanceAction === 'add'
                      ? 'bg-emerald-500 text-white shadow-xs'
                      : 'text-neutral-600 dark:text-neutral-400'
                  }`}
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>{isAr ? 'إضافة (+)' : 'Add (+)'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAgentBalanceAction('deduct')}
                  className={`py-2 rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                    agentBalanceAction === 'deduct'
                      ? 'bg-red-500 text-white shadow-xs'
                      : 'text-neutral-600 dark:text-neutral-400'
                  }`}
                >
                  <MinusCircle className="w-3.5 h-3.5" />
                  <span>{isAr ? 'خصم (-)' : 'Deduct (-)'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAgentBalanceAction('set')}
                  className={`py-2 rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                    agentBalanceAction === 'set'
                      ? 'bg-amber-500 text-neutral-950 shadow-xs'
                      : 'text-neutral-600 dark:text-neutral-400'
                  }`}
                >
                  <Coins className="w-3.5 h-3.5" />
                  <span>{isAr ? 'تعيين (=)' : 'Set (=)'}</span>
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  {isAr ? 'القيمة المراد تطبيقها:' : 'Amount:'}
                </label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  required
                  value={agentBalanceAmount}
                  onChange={(e) => setAgentBalanceAmount(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-sm font-mono font-bold text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex flex-wrap gap-1.5">
                {[1000, 5000, 10000, 50000, 100000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setAgentBalanceAmount(amt.toString())}
                    className="px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-mono font-semibold transition-colors cursor-pointer"
                  >
                    +{amt.toLocaleString()}
                  </button>
                ))}
              </div>

              {/* Preview */}
              <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-xs">
                <span className="text-neutral-500">{isAr ? 'رصيد الوكيل بعد التعديل:' : 'New Agent Balance Preview:'}</span>
                <span className="font-mono font-bold text-sm text-amber-600 dark:text-amber-400 inline-flex items-center gap-1">
                  <span>{(() => {
                    const current = balanceAgent.balance || 0;
                    const val = parseFloat(agentBalanceAmount) || 0;
                    if (agentBalanceAction === 'add') return (current + val).toLocaleString();
                    if (agentBalanceAction === 'deduct') return Math.max(0, current - val).toLocaleString();
                    return Math.max(0, val).toLocaleString();
                  })()}</span>
                  <DiamondIcon className="w-3.5 h-3.5 text-amber-400" />
                </span>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setBalanceAgent(null)}
                  className="flex-1 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-semibold transition-colors cursor-pointer"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingAgentBalance}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition-colors shadow-sm cursor-pointer"
                >
                  {isUpdatingAgentBalance ? (isAr ? 'جاري التعديل...' : 'Updating...') : (isAr ? 'تأكيد تعديل الرصيد' : 'Confirm Balance')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 7: Delete Agent Confirmation */}
      {(deletingAgentId || deletingAgent) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-neutral-900 dark:text-white">
              {isAr ? 'تأكيد حذف الوكيل' : 'Confirm Agent Deletion'}
            </h3>

            {deletingAgent && (
              <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs text-start space-y-1">
                <div className="font-bold text-neutral-900 dark:text-white">
                  {deletingAgent.name}
                </div>
                <div className="text-neutral-500 font-mono text-[11px]">
                  {deletingAgent.email} • {deletingAgent.gridCode || 'A8838'}
                </div>
              </div>
            )}

            <p className="text-xs text-neutral-500 leading-relaxed">
              {isAr
                ? 'هل أنت متأكد من رغبتك في حذف هذا الوكيل نهائياً من شبكة وكلاء Soul-X؟ لن يظهر الوكيل بعد ذلك في المحفظة ولا في لوحة التحكم.'
                : 'Are you sure you want to permanently delete this agent? They will no longer appear in the wallet or control panel.'}
            </p>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                disabled={isDeletingAgent}
                onClick={() => {
                  setDeletingAgentId(null);
                  setDeletingAgent(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>

              <button
                type="button"
                disabled={isDeletingAgent}
                onClick={handleConfirmDeleteAgent}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
              >
                {isDeletingAgent && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{isDeletingAgent ? (isAr ? 'جاري الحذف...' : 'Deleting...') : (isAr ? 'تأكيد الحذف' : 'Confirm Delete')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 8: Delete User Confirmation */}
      {deletingUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-neutral-900 dark:text-white">
              {isAr ? 'تأكيد حذف المستخدم' : 'Confirm User Deletion'}
            </h3>

            <p className="text-xs text-neutral-500 leading-relaxed">
              {isAr
                ? 'هل أنت متأكد من رغبتك في حذف هذا المستخدم نهائياً من قاعدة بيانات Soul-X؟ هذا الإجراء لا يمكن التراجع عنه.'
                : 'Are you sure you want to permanently delete this user? This action cannot be undone.'}
            </p>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingUserId(null)}
                className="flex-1 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>

              <button
                type="button"
                onClick={handleConfirmDeleteUser}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors cursor-pointer shadow-sm"
              >
                {isAr ? 'تأكيد الحذف' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 9 removed */}

      {/* ========================================================
          MODAL: إرسال إشعار إداري مباشر لمستخدم معين
         ======================================================== */}
      {directNotifyUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white dark:bg-neutral-900 rounded-3xl p-5 sm:p-6 shadow-2xl border border-neutral-200 dark:border-neutral-800 space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-violet-500/20 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                  <Megaphone className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                  {isAr ? 'إرسال إشعار لمركز إشعارات المستخدم' : 'Send Notification to User'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDirectNotifyUser(null)}
                className="p-1 rounded-full text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Recipient User Badge */}
            <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center gap-3">
              <img
                src={
                  directNotifyUser.photoUrl ||
                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'
                }
                alt={directNotifyUser.name}
                className="w-11 h-11 rounded-full object-cover border border-cyan-500/40 shrink-0"
              />
              <div className="min-w-0">
                <h4 className="font-bold text-xs sm:text-sm text-neutral-900 dark:text-white truncate">
                  {directNotifyUser.name}
                </h4>
                <div className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400 truncate">
                  ID: {directNotifyUser.displayId || directNotifyUser.id} • {directNotifyUser.email}
                </div>
                <div className="text-[10px] text-cyan-600 dark:text-cyan-400 font-semibold mt-0.5">
                  {isAr ? 'ستصل هذه الرسالة فوراً إلى مركز الإشعارات الخاص بهذا المستخدم' : 'Will arrive instantly in this user\'s Notification Center'}
                </div>
              </div>
            </div>

            {/* Quick Templates */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>{isAr ? 'قوالب سريعة:' : 'Quick Templates:'}</span>
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleApplyTemplate('direct_warning')}
                  className="px-2.5 py-1 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-semibold cursor-pointer"
                >
                  ⚠️ {isAr ? 'تنبيه إداري' : 'Warning'}
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyTemplate('direct_thanks')}
                  className="px-2.5 py-1 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-semibold cursor-pointer"
                >
                  🌟 {isAr ? 'شكر وتقدير' : 'Appreciation'}
                </button>
              </div>
            </div>

            {/* Inputs */}
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300">
                  {isAr ? 'البادئة (اختياري — الافتراضي: رسالة من الإدارة:)' : 'Prefix (Optional)'}
                </label>
                <input
                  type="text"
                  value={directNotifyTitleAr}
                  onChange={(e) => setDirectNotifyTitleAr(e.target.value)}
                  placeholder="رسالة من الإدارة:"
                  className="w-full text-xs px-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white focus:outline-none focus:border-cyan-500 font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300">
                  {isAr ? 'نص الرسالة / الإشعار *' : 'Message Text *'}
                </label>
                <textarea
                  rows={4}
                  value={directNotifyMessageAr}
                  onChange={(e) => setDirectNotifyMessageAr(e.target.value)}
                  placeholder={
                    isAr
                      ? 'اكتب نص الرسالة التي ستصل في مركز إشعارات هذا المستخدم...'
                      : 'Message text...'
                  }
                  className="w-full text-xs p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white focus:outline-none focus:border-cyan-500 font-medium leading-relaxed resize-none"
                />
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                disabled={isSendingDirectNotify}
                onClick={() => setDirectNotifyUser(null)}
                className="flex-1 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-semibold cursor-pointer transition-colors"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>

              <button
                type="button"
                disabled={isSendingDirectNotify}
                onClick={handleSendDirectNotifyFromModal}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white text-xs font-bold transition-all cursor-pointer shadow-md shadow-violet-500/25 flex items-center justify-center gap-1.5 active:scale-95"
              >
                {isSendingDirectNotify ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{isAr ? 'جاري الإرسال...' : 'Sending...'}</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>{isAr ? 'إرسال الإشعار فوراً' : 'Send Notification'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: تفاصيل البلاغات المقدمة ضد مستخدم محدد (User Reports Inspection)
          ========================================================================= */}
      {userReportsModalData && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-neutral-950/80 backdrop-blur-md animate-in fade-in duration-200"
          dir={isAr ? 'rtl' : 'ltr'}
        >
          <div className="relative w-full max-w-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0 border border-rose-500/20">
                  <Flag className="w-5 h-5 stroke-[2.3]" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-neutral-900 dark:text-white flex items-center gap-2">
                    <span>{isAr ? 'البلاغات المقدمة ضد المستخدم' : 'Reports Against User'}</span>
                    <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 font-mono text-xs font-black">
                      {userReportsModalData.reports.length}
                    </span>
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {isAr
                      ? 'قائمة الشكاوى والبلاغات المرفوعة من مستخدمين آخرين ضد هذا الحساب'
                      : 'List of reports and complaints submitted by other users against this account'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setUserReportsModalData(null)}
                className="p-1.5 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* User Profile Card */}
            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">
              <img
                src={
                  userReportsModalData.user.photoUrl ||
                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'
                }
                alt={userReportsModalData.user.name}
                className="w-12 h-12 rounded-full object-cover border-2 border-rose-500/30 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm text-neutral-900 dark:text-white truncate">
                    {userReportsModalData.user.name}
                  </span>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                    ID: {userReportsModalData.user.displayId || userReportsModalData.user.id}
                  </span>
                  <span className="text-xs text-rose-600 dark:text-rose-400 font-bold bg-rose-500/10 px-2 py-0.5 rounded-md">
                    {isAr ? `إجمالي البلاغات: ${userReportsModalData.reports.length}` : `Total Reports: ${userReportsModalData.reports.length}`}
                  </span>
                </div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                  {userReportsModalData.user.email}
                  {userReportsModalData.user.country && ` • ${formatCountryUnified(userReportsModalData.user.country, isAr ? 'ar' : 'en')}`}
                </div>
              </div>

              {/* Quick Action: Direct Notify */}
              <button
                type="button"
                onClick={() => {
                  const targetU = userReportsModalData.user;
                  setUserReportsModalData(null);
                  handleOpenUserNotifyModal(targetU);
                }}
                className="px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95 flex items-center gap-1.5 shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isAr ? 'مراسلة إدارية' : 'Notify'}</span>
              </button>
            </div>

            {/* Reports List */}
            {isLoadingUserReportsModal ? (
              <div className="py-12 text-center space-y-2">
                <RefreshCw className="w-6 h-6 text-rose-500 animate-spin mx-auto" />
                <p className="text-xs text-neutral-500">{isAr ? 'جاري جلب تفاصيل البلاغات...' : 'Loading reports...'}</p>
              </div>
            ) : userReportsModalData.reports.length === 0 ? (
              <div className="py-12 text-center space-y-2 bg-neutral-50 dark:bg-neutral-950 rounded-2xl border border-neutral-200 dark:border-neutral-800">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <h4 className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
                  {isAr ? 'لا توجد بلاغات مسجلة ضد هذا المستخدم' : 'No reports filed against this user'}
                </h4>
                <p className="text-xs text-neutral-500 max-w-xs mx-auto">
                  {isAr ? 'سجل المستخدم سليم ولم يتم تقديم أي شكوى ضده حتى الآن.' : 'User has a clean record with no reported violations.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {userReportsModalData.reports.map((rpt, idx) => (
                  <div
                    key={rpt.id || idx}
                    className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-950/70 border border-neutral-200 dark:border-neutral-800 space-y-2.5"
                  >
                    {/* Header: Reason & Source & Date */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-rose-500 text-white shadow-xs">
                          {rpt.reason || (isAr ? 'بلاغ مستخدم' : 'User Report')}
                        </span>
                        {rpt.source && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                            {rpt.source === 'matching'
                              ? isAr ? '📍 شاشة المطابقة' : '📍 Matching'
                              : isAr ? '📍 شاشة المراسلة في الدردشات' : '📍 Chats'}
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          rpt.status === 'resolved'
                            ? 'bg-emerald-500/15 text-emerald-600'
                            : rpt.status === 'in_review'
                            ? 'bg-amber-500/15 text-amber-600'
                            : 'bg-blue-500/15 text-blue-600'
                        }`}>
                          {rpt.status === 'resolved' ? (isAr ? 'تم الحل' : 'Resolved') : rpt.status === 'in_review' ? (isAr ? 'قيد المراجعة' : 'In Review') : (isAr ? 'قيد الانتظار' : 'Pending')}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-neutral-400">
                        {formatLocalDateTime(rpt.createdAt)}
                      </span>
                    </div>

                    {/* Reporter User Info */}
                    <div className="p-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        {rpt.userAvatar ? (
                          <img src={rpt.userAvatar} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-cyan-500/10 text-cyan-600 flex items-center justify-center font-bold text-xs shrink-0">
                            {(rpt.userName || 'U')[0].toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <span className="font-bold text-neutral-900 dark:text-white">
                            {isAr ? 'مقدم البلاغ: ' : 'Reporter: '}
                            {rpt.userName || (isAr ? 'مستخدم مجهول' : 'Anonymous')}
                          </span>
                          {(rpt.userDisplayId || rpt.userId) && (
                            <span className="font-mono text-[10px] text-cyan-600 dark:text-cyan-400 ms-1.5">
                              (ID: {rpt.userDisplayId || rpt.userId})
                            </span>
                          )}
                          {rpt.userEmail && (
                            <span className="text-neutral-400 text-[10px] ms-1.5">
                              • {rpt.userEmail}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    {rpt.description && (
                      <div className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed whitespace-pre-wrap bg-white dark:bg-neutral-900 p-2.5 rounded-xl border border-neutral-200/60 dark:border-neutral-800">
                        {rpt.description}
                      </div>
                    )}

                    {/* Notice */}
                    <div className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-500/10 p-2 rounded-xl flex items-center gap-1.5 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>{isAr ? 'تنبيه: من الممكن تواصل الدعم مع مقدم البلاغ للحصول على المزيد من التفاصيل.' : 'Notice: Support may contact the reporter to obtain further details.'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Footer Actions */}
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setUserReportsModalData(null)}
                className="px-5 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-bold text-xs cursor-pointer active:scale-95 transition-all"
              >
                {isAr ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          FREEZE USER MODAL (تجميد حساب مستخدم بالدقيقة)
      ========================================================================= */}
      {freezingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl p-6 w-full max-w-md border border-neutral-200 dark:border-neutral-800 shadow-2xl space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center border border-cyan-500/20">
                  <Snowflake className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                    {isAr ? 'تجميد حساب مستخدم' : 'Freeze User Account'}
                  </h3>
                  <p className="text-xs text-neutral-500">
                    {freezingUser.name} ({freezingUser.displayId || freezingUser.id})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFreezingUser(null)}
                className="p-2 rounded-xl text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Explanatory Info */}
            <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-800 dark:text-cyan-300 space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>{isAr ? 'تأثير التجميد المؤقت:' : 'Freeze Effect:'}</span>
              </p>
              <p className="leading-relaxed opacity-90 text-[11px]">
                {isAr
                  ? 'سيتم حظر المستخدم من التصفح واستخدام أي قسم في الموقع فوراً، وستظهر له شاشة قفل مع عداد تنازلي حي بالوقت المتبقي حتى انتهاء التجميد تلقائياً.'
                  : 'The user will be immediately blocked from accessing any part of the site, seeing a lock screen with a live countdown timer until the freeze expires.'}
              </p>
            </div>

            {/* Duration Input (بالدقيقة) */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block">
                {isAr ? 'مدة التجميد (بالدقائق) *' : 'Freeze Duration (in minutes) *'}
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={freezeMinutesInput}
                  onChange={(e) => setFreezeMinutesInput(e.target.value)}
                  placeholder={isAr ? 'مثال: 60' : 'e.g. 60'}
                  className="w-full px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/40 font-mono font-bold"
                />
                <span className="absolute left-3 rtl:left-auto rtl:right-auto rtl:left-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400 font-bold pointer-events-none">
                  {isAr ? 'دقيقة' : 'mins'}
                </span>
              </div>

              {/* Quick minute preset buttons */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <span className="text-[10px] text-neutral-400 font-semibold">{isAr ? 'اختصارات سريعة:' : 'Presets:'}</span>
                {[
                  { label: isAr ? '15 د' : '15m', mins: '15' },
                  { label: isAr ? '30 د' : '30m', mins: '30' },
                  { label: isAr ? 'ساعة (60د)' : '1h (60m)', mins: '60' },
                  { label: isAr ? '3 ساعات' : '3h', mins: '180' },
                  { label: isAr ? '24 ساعة (يوم)' : '24h', mins: '1440' },
                  { label: isAr ? '3 أيام' : '3 days', mins: '4320' },
                  { label: isAr ? 'أسبوع' : '7 days', mins: '10080' },
                ].map((preset) => (
                  <button
                    key={preset.mins}
                    type="button"
                    onClick={() => setFreezeMinutesInput(preset.mins)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                      freezeMinutesInput === preset.mins
                        ? 'bg-cyan-600 text-white border-cyan-600 shadow-2xs'
                        : 'bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Optional Reason */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block">
                {isAr ? 'سبب التجميد (يظهر للمستخدم - اختياري)' : 'Freeze Reason (shown to user - optional)'}
              </label>
              <textarea
                rows={2}
                value={freezeReasonInput}
                onChange={(e) => setFreezeReasonInput(e.target.value)}
                placeholder={isAr ? 'مثال: مخالفة شروط استخدام المحادثة أو إرسال رسائل غير لائقة' : 'e.g. Violation of chat community guidelines'}
                className="w-full px-3.5 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500/40 resize-none"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setFreezingUser(null)}
                className="px-4 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-bold text-xs cursor-pointer transition-colors"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={isSubmittingFreeze}
                onClick={handleConfirmFreezeUser}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-md shadow-cyan-600/20 cursor-pointer transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSubmittingFreeze ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Snowflake className="w-3.5 h-3.5" />
                )}
                <span>{isAr ? 'تأكيد تجميد الحساب' : 'Confirm Freeze'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          BAN USER MODAL (حظر حساب مستخدم نهائياً)
      ========================================================================= */}
      {banningUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl p-6 w-full max-w-md border border-neutral-200 dark:border-neutral-800 shadow-2xl space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-500/20">
                  <Ban className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                    {isAr ? 'حظر مستخدم نهائياً' : 'Ban User Permanently'}
                  </h3>
                  <p className="text-xs text-neutral-500">
                    {banningUser.name} ({banningUser.displayId || banningUser.id})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBanningUser(null)}
                className="p-2 rounded-xl text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Danger Warning Info */}
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-800 dark:text-rose-300 space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                <span>{isAr ? 'تحذير: حظر دائم' : 'Permanent Ban Warning:'}</span>
              </p>
              <p className="leading-relaxed opacity-90 text-[11px]">
                {isAr
                  ? 'سيتم حظر المستخدم فوراً من الدخول واستخدام الموقع نهائياً حتى يقوم أحد المشرفين بفك الحظر عنه يدوياً.'
                  : 'The user will be immediately blocked from logging in and navigating the site permanently until an admin unbans them.'}
              </p>
            </div>

            {/* Optional Reason */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block">
                {isAr ? 'سبب الحظر (يظهر للمستخدم - اختياري)' : 'Ban Reason (shown to user - optional)'}
              </label>
              <textarea
                rows={2}
                value={banReasonInput}
                onChange={(e) => setBanReasonInput(e.target.value)}
                placeholder={isAr ? 'مثال: انتهاك جسيم لقوانين المنصة أو احتيال' : 'e.g. Severe violation of platform rules'}
                className="w-full px-3.5 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/40 resize-none"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setBanningUser(null)}
                className="px-4 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-bold text-xs cursor-pointer transition-colors"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={isSubmittingBan}
                onClick={handleConfirmBanUser}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold text-xs shadow-md shadow-rose-600/20 cursor-pointer transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSubmittingBan ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Ban className="w-3.5 h-3.5" />
                )}
                <span>{isAr ? 'تأكيد الحظر النهائي' : 'Confirm Ban'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VERIFICATION REJECT MODAL (رفض طلب التوثيق مع سبب اختياري)
      ========================================================================= */}
      {rejectModalRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl p-6 w-full max-w-md border border-neutral-200 dark:border-neutral-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-500/20">
                  <XCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                    {isAr ? 'رفض طلب التوثيق' : 'Reject Verification Request'}
                  </h3>
                  <p className="text-xs text-neutral-500">
                    {rejectModalRequest.userName} ({rejectModalRequest.userDisplayId || rejectModalRequest.userId})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRejectModalRequest(null)}
                className="p-2 rounded-xl text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block">
                {isAr ? 'سبب الرفض (اختياري - يظهر للمستخدم ليتمكن من التصحيح)' : 'Rejection Reason (Optional - shown to user)'}
              </label>
              <textarea
                rows={3}
                value={rejectReasonInput}
                onChange={(e) => setRejectReasonInput(e.target.value)}
                placeholder={isAr ? 'مثال: الصورة غير واضحة أو لم تظهر الهوية بشكل كامل مع السيلفي' : 'e.g. Photos are blurry or ID is partially hidden'}
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/40 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setRejectModalRequest(null)}
                className="px-4 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-bold text-xs cursor-pointer transition-colors"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={processingVerifId === rejectModalRequest.id}
                onClick={handleRejectVerification}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md cursor-pointer transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {processingVerifId === rejectModalRequest.id ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <XCircle className="w-3.5 h-3.5" />
                )}
                <span>{isAr ? 'تأكيد الرفض' : 'Confirm Reject'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VERIFICATION PHOTO LIGHTBOX (معاينة مكبرة لصور الهوية والسيلفي)
      ========================================================================= */}
      {previewVerifImage && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-150"
          onClick={() => setPreviewVerifImage(null)}
        >
          <div
            className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between text-white px-2">
              <span className="text-sm font-bold truncate">{previewVerifImage.label}</span>
              <button
                type="button"
                onClick={() => setPreviewVerifImage(null)}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <img
              src={previewVerifImage.url}
              alt={previewVerifImage.label}
              className="max-w-full max-h-[80vh] rounded-2xl object-contain border border-white/15 shadow-2xl bg-neutral-950"
            />
          </div>
        </div>
      )}
    </div>
  );
};
