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
  Database,
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
  History,
  Volume2,
  ShieldCheck,
  Bug,
  Lightbulb,
  MessageSquarePlus,
  LifeBuoy,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { Language, AuthUser, AgentRecord, FeedbackReport, PasswordResetRequest } from '../types';
import { CoinIcon, DiamondIcon } from './CurrencyIcons';
import { formatLocalDate, formatLocalDateTime } from '../lib/dateUtils';

interface AdminPanelViewProps {
  lang: Language;
  currentUser: AuthUser | null;
  adminToken: string;
  onBack: () => void;
  onLock: () => void;
}

interface AdminStats {
  registeredUsersCount: number;
  totalUsersBalance?: number;
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
}

export const AdminPanelView: React.FC<AdminPanelViewProps> = ({
  lang,
  currentUser,
  adminToken,
  onBack,
  onLock,
}) => {
  const isAr = lang === 'ar';
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [neonStatus, setNeonStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Active top navigation tab
  const [activeTab, setActiveTab] = useState<'users' | 'agents' | 'broadcast' | 'feedback' | 'passwordResets' | 'bot' | 'database'>('users');

  // -----------------------------------------------------------------
  // Password Reset Requests (طلبات استعادة كلمة المرور من بوت تيليجرام)
  // -----------------------------------------------------------------
  const [passwordResets, setPasswordResets] = useState<PasswordResetRequest[]>([]);
  const [isLoadingPasswordResets, setIsLoadingPasswordResets] = useState(false);
  const [passwordResetsFilterStatus, setPasswordResetsFilterStatus] = useState<'all' | 'pending' | 'contacted' | 'resolved'>('all');
  const [passwordResetsSearch, setPasswordResetsSearch] = useState('');
  const [editingResetItem, setEditingResetItem] = useState<PasswordResetRequest | null>(null);
  const [resetItemStatus, setResetItemStatus] = useState<'pending' | 'contacted' | 'resolved' | 'cancelled'>('contacted');
  const [resetItemAdminNotes, setResetItemAdminNotes] = useState('');
  const [isUpdatingResetItem, setIsUpdatingResetItem] = useState(false);
  const [deletingResetId, setDeletingResetId] = useState<string | null>(null);

  // -----------------------------------------------------------------
  // Feedback & Bug Reports Management State (البلاغات والاقتراحات)
  // -----------------------------------------------------------------
  const [feedbackReports, setFeedbackReports] = useState<FeedbackReport[]>([]);
  const [feedbackStats, setFeedbackStats] = useState<{
    total: number;
    bugs: number;
    suggestions: number;
    feedback: number;
    pending: number;
    inReview: number;
    resolved: number;
    dismissed: number;
  } | null>(null);
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);
  const [feedbackFilterType, setFeedbackFilterType] = useState<'all' | 'bug' | 'suggestion' | 'feedback'>('all');
  const [feedbackFilterStatus, setFeedbackFilterStatus] = useState<'all' | 'pending' | 'in_review' | 'resolved' | 'dismissed'>('all');
  const [feedbackSearch, setFeedbackSearch] = useState('');
  const [selectedReport, setSelectedReport] = useState<FeedbackReport | null>(null);
  const [adminReplyText, setAdminReplyText] = useState('');
  const [adminNotesText, setAdminNotesText] = useState('');
  const [replyStatus, setReplyStatus] = useState<'pending' | 'in_review' | 'resolved' | 'dismissed'>('in_review');
  const [notifyUserViaCenter, setNotifyUserViaCenter] = useState(true);
  const [isUpdatingFeedback, setIsUpdatingFeedback] = useState(false);
  const [deletingReportId, setDeletingReportId] = useState<string | null>(null);

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
  const [broadcastHistory, setBroadcastHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [deletingNotificationId, setDeletingNotificationId] = useState<string | null>(null);

  // Quick Direct Notify Modal from User table
  const [directNotifyUser, setDirectNotifyUser] = useState<AdminUserRecord | null>(null);
  const [directNotifyTitleAr, setDirectNotifyTitleAr] = useState('');
  const [directNotifyTitleEn, setDirectNotifyTitleEn] = useState('');
  const [directNotifyMessageAr, setDirectNotifyMessageAr] = useState('');
  const [directNotifyMessageEn, setDirectNotifyMessageEn] = useState('');
  const [directNotifyCategory, setDirectNotifyCategory] = useState<'announcement' | 'warning' | 'alert' | 'system' | 'custom' | 'reward'>('custom');
  const [directNotifyPriority, setDirectNotifyPriority] = useState<'normal' | 'important' | 'urgent'>('normal');
  const [isSendingDirectNotify, setIsSendingDirectNotify] = useState(false);

  // Neon PostgreSQL Database Connection configuration state
  const [neonDatabaseUrl, setNeonDatabaseUrl] = useState('');
  const [isSavingDbConfig, setIsSavingDbConfig] = useState(false);
  const [isTestingDb, setIsTestingDb] = useState(false);
  const [isSyncingDb, setIsSyncingDb] = useState(false);
  const [isMigratingDb, setIsMigratingDb] = useState(false);
  const [isCopiedSql, setIsCopiedSql] = useState(false);

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
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);

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

  // Database Reset State
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

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
    const effectiveToken = sessionAdminToken || userAuthToken || '2026';

    h['Authorization'] = `Bearer ${effectiveToken}`;
    h['x-admin-pin'] = sessionAdminToken || '2026';
    if (currentUser?.email) {
      h['x-admin-email'] = currentUser.email;
    }
    return h;
  };

  // Fetch all admin data
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const headers = getAdminHeaders();

      const [statsRes, usersRes, agentsRes, neonRes, neonCfgRes] = await Promise.all([
        fetch('/api/admin/stats', { headers }),
        fetch('/api/admin/users', { headers }),
        fetch('/api/admin/agents', { headers }),
        fetch('/api/neon/status').catch(() => null),
        fetch('/api/neon/config').catch(() => null),
      ]);

      if (statsRes.status === 403 || usersRes.status === 403) {
        onLock();
        return;
      }

      const statsData = await statsRes.json();
      const usersData = await usersRes.json();
      const agentsData = await agentsRes.json();

      if (neonRes) {
        const neonData = await neonRes.json();
        setNeonStatus(neonData);
      }

      if (neonCfgRes) {
        const cfgData = await neonCfgRes.json();
        if (cfgData?.databaseUrl && !neonDatabaseUrl) {
          setNeonDatabaseUrl(cfgData.databaseUrl);
        }
      }

      if (statsData.success) setStats(statsData.stats);
      if (usersData.success && Array.isArray(usersData.users)) setUsers(usersData.users);
      if (agentsData.success && Array.isArray(agentsData.agents)) setAgents(agentsData.agents);
    } catch (err: any) {
      showToast('error', err.message || 'خطأ في جلب بيانات لوحة التحكم');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [adminToken]);

  // -----------------------------------------------------------------
  // FEEDBACK & BUG REPORTS HANDLERS (البلاغات والاقتراحات)
  // -----------------------------------------------------------------
  const fetchFeedbackReports = async () => {
    setIsLoadingFeedback(true);
    try {
      const headers = getAdminHeaders();
      const res = await fetch('/api/admin/feedback', { headers });
      const data = await res.json();
      if (data.success && Array.isArray(data.reports)) {
        setFeedbackReports(data.reports);
        if (data.stats) {
          setFeedbackStats(data.stats);
        }
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

  const handleOpenReportDetails = (report: FeedbackReport) => {
    setSelectedReport(report);
    setAdminReplyText(report.adminReply || '');
    setAdminNotesText(report.adminNotes || '');
    setReplyStatus(report.status);
    setNotifyUserViaCenter(true);
  };

  const handleUpdateFeedbackReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReport) return;

    setIsUpdatingFeedback(true);
    try {
      const headers = getAdminHeaders();
      const res = await fetch('/api/admin/feedback/update', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: selectedReport.id,
          status: replyStatus,
          adminNotes: adminNotesText,
          adminReply: adminReplyText,
          notifyUser: notifyUserViaCenter,
        }),
      });

      const data = await res.json();
      if (data.success && data.report) {
        showToast(
          'success',
          isAr
            ? notifyUserViaCenter && adminReplyText
              ? 'تم تحديث حالة البلاغ وإشعار المستخدم في مركز إشعاراته بنجاح!'
              : 'تم تحديث حالة البلاغ بنجاح'
            : 'Feedback updated successfully!'
        );
        setFeedbackReports((prev) =>
          prev.map((r) => (r.id === selectedReport.id ? data.report : r))
        );
        setSelectedReport(null);
        fetchFeedbackReports();
      } else {
        showToast('error', data.message || 'فشل تحديث البلاغ');
      }
    } catch (err: any) {
      showToast('error', err.message || 'حدث خطأ أثناء التحديث');
    } finally {
      setIsUpdatingFeedback(false);
    }
  };

  const handleQuickStatusChange = async (reportId: string, newStatus: 'pending' | 'in_review' | 'resolved' | 'dismissed') => {
    try {
      const headers = getAdminHeaders();
      const res = await fetch('/api/admin/feedback/update', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: reportId,
          status: newStatus,
        }),
      });
      const data = await res.json();
      if (data.success && data.report) {
        setFeedbackReports((prev) =>
          prev.map((r) => (r.id === reportId ? data.report : r))
        );
        showToast('success', isAr ? 'تم تعديل الحالة بنجاح' : 'Status updated');
        fetchFeedbackReports();
      }
    } catch (err: any) {
      showToast('error', err.message);
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
        showToast('success', isAr ? 'تم حذف البلاغ نهائياً' : 'Report deleted successfully');
        setFeedbackReports((prev) => prev.filter((r) => r.id !== reportId));
        if (selectedReport?.id === reportId) {
          setSelectedReport(null);
        }
        fetchFeedbackReports();
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
  // PASSWORD RESET REQUESTS HANDLERS (طلبات استعادة كلمة المرور من البوت)
  // -----------------------------------------------------------------
  const fetchPasswordResets = async () => {
    setIsLoadingPasswordResets(true);
    try {
      const headers = getAdminHeaders();
      const res = await fetch('/api/admin/password-resets', { headers });
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

  const handleOpenEditResetItem = (item: PasswordResetRequest) => {
    setEditingResetItem(item);
    setResetItemStatus(item.status);
    setResetItemAdminNotes(item.adminNotes || '');
  };

  const handleUpdatePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingResetItem) return;

    setIsUpdatingResetItem(true);
    try {
      const headers = getAdminHeaders();
      const res = await fetch('/api/admin/password-resets/update', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: editingResetItem.id,
          status: resetItemStatus,
          adminNotes: resetItemAdminNotes,
        }),
      });

      const data = await res.json();
      if (data.success && data.request) {
        showToast('success', isAr ? 'تم تحديث حالة طلب الاستعادة بنجاح' : 'Request updated successfully');
        setPasswordResets((prev) =>
          prev.map((r) => (r.id === editingResetItem.id ? data.request : r))
        );
        setEditingResetItem(null);
        fetchPasswordResets();
      } else {
        showToast('error', data.message || 'فشل تحديث الطلب');
      }
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setIsUpdatingResetItem(false);
    }
  };

  const handleQuickResetStatusChange = async (requestId: string, newStatus: 'pending' | 'contacted' | 'resolved' | 'cancelled') => {
    try {
      const headers = getAdminHeaders();
      const res = await fetch('/api/admin/password-resets/update', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: requestId,
          status: newStatus,
        }),
      });
      const data = await res.json();
      if (data.success && data.request) {
        setPasswordResets((prev) =>
          prev.map((r) => (r.id === requestId ? data.request : r))
        );
        showToast('success', isAr ? 'تم تغيير الحالة بنجاح' : 'Status updated');
        fetchPasswordResets();
      }
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

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
        if (editingResetItem?.id === requestId) {
          setEditingResetItem(null);
        }
        fetchPasswordResets();
      } else {
        showToast('error', data.message || 'فشل حذف الطلب');
      }
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setDeletingResetId(null);
    }
  };


  // BROADCAST & NOTIFICATIONS HANDLERS (إذاعة عامة ورسائل إدارية)
  // -----------------------------------------------------------------
  const fetchBroadcastHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const headers = getAdminHeaders();
      const res = await fetch('/api/admin/notifications/history', { headers });
      const data = await res.json();
      if (data.success && Array.isArray(data.history)) {
        setBroadcastHistory(data.history);
      }
    } catch (err: any) {
      console.warn('Failed to fetch broadcast history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'broadcast') {
      fetchBroadcastHistory();
    }
  }, [activeTab]);

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
    if (!broadcastTitleAr.trim()) {
      showToast('error', isAr ? 'يرجى كتابة عنوان الإشعار بالعربية' : 'Please enter notification title in Arabic');
      return;
    }
    if (!broadcastMessageAr.trim()) {
      showToast('error', isAr ? 'يرجى كتابة نص الإشعار بالعربية' : 'Please enter notification message in Arabic');
      return;
    }
    if (broadcastTargetType === 'single' && !broadcastSelectedUser) {
      showToast('error', isAr ? 'يرجى اختيار المستخدم المستهدف' : 'Please select target user');
      return;
    }

    setIsSendingBroadcast(true);
    try {
      const headers = getAdminHeaders();
      const payload = {
        targetType: broadcastTargetType,
        userId: broadcastTargetType === 'single' ? (broadcastSelectedUser?.id || broadcastSelectedUser?.displayId) : undefined,
        titleAr: broadcastTitleAr.trim(),
        titleEn: broadcastTitleEn.trim() || broadcastTitleAr.trim(),
        messageAr: broadcastMessageAr.trim(),
        messageEn: broadcastMessageEn.trim() || broadcastMessageAr.trim(),
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

      showToast('success', data.message || (isAr ? 'تم إرسال الإشعار بنجاح!' : 'Notification sent successfully!'));
      setBroadcastTitleAr('');
      setBroadcastTitleEn('');
      setBroadcastMessageAr('');
      setBroadcastMessageEn('');
      setBroadcastPriority('normal');
      fetchBroadcastHistory();
    } catch (err: any) {
      showToast('error', err.message || (isAr ? 'حدث خطأ أثناء الإرسال' : 'Error sending notification'));
    } finally {
      setIsSendingBroadcast(false);
    }
  };

  const handleDeleteBroadcast = async (item: any) => {
    try {
      const headers = getAdminHeaders();
      const res = await fetch('/api/admin/notifications/delete', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: item.type === 'admin_message' ? item.id : undefined,
          broadcastId: item.type === 'admin_broadcast' ? (item.broadcastId || item.id) : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'فشل حذف الإشعار');
      }

      showToast('success', data.message || 'تم حذف الإشعار بنجاح');
      setDeletingNotificationId(null);
      fetchBroadcastHistory();
    } catch (err: any) {
      showToast('error', err.message || 'خطأ أثناء حذف الإشعار');
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
    if (!directNotifyTitleAr.trim()) {
      showToast('error', isAr ? 'يرجى إدخال عنوان الإشعار' : 'Please enter title');
      return;
    }
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
        titleAr: directNotifyTitleAr.trim(),
        titleEn: directNotifyTitleEn.trim() || directNotifyTitleAr.trim(),
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
      if (activeTab === 'broadcast') {
        fetchBroadcastHistory();
      }
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
    setEditingUser(u);
    setEditName(u.name);
    setEditEmail(u.email);
    setEditDisplayId(u.displayId || u.id);
    setEditBirthDate(u.birthDate || '');
    setEditGender(u.gender);
  };

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setIsUpdatingUser(true);
    try {
      const res = await fetch('/api/admin/update-user', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: editingUser.id,
          name: editName,
          email: editEmail,
          displayId: editDisplayId,
          birthDate: editBirthDate || null,
          gender: editGender,
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast('success', data.message || (isAr ? 'تم تحديث بيانات المستخدم بنجاح' : 'User updated successfully'));
        setUsers((prev) =>
          prev.map((u) =>
            u.id === editingUser.id
              ? {
                  ...u,
                  name: editName.trim(),
                  email: editEmail.trim(),
                  displayId: editDisplayId.trim(),
                  birthDate: editBirthDate || null,
                  gender: editGender,
                }
              : u
          )
        );
        setEditingUser(null);
      } else {
        showToast('error', data.message || 'فشل التحديث');
      }
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setIsUpdatingUser(false);
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
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
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
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
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

  // Delete User Handler
  const handleConfirmDeleteUser = async () => {
    if (!deletingUserId) return;
    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: deletingUserId }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', isAr ? 'تم حذف المستخدم من النظام' : 'User deleted');
        setUsers((prev) => prev.filter((u) => u.id !== deletingUserId && u.displayId !== deletingUserId));
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
    if (!deletingAgentId) return;
    try {
      const res = await fetch('/api/admin/delete-agent', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ agentId: deletingAgentId }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', data.message || (isAr ? 'تم حذف الوكيل نهائياً وتحديث المحفظة بنجاح' : 'Agent deleted successfully'));
        setAgents((prev) =>
          prev.filter(
            (a) =>
              a.id !== deletingAgentId &&
              a.email.toLowerCase() !== deletingAgentId.toLowerCase() &&
              (a.gridCode || '').toUpperCase() !== deletingAgentId.toUpperCase()
          )
        );
        fetchData();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('soulx:agents-updated'));
        }
      } else {
        showToast('error', data.message || 'فشل الحذف');
      }
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setDeletingAgentId(null);
    }
  };

  // Neon Database Configuration & Connectivity Handlers
  const handleSaveDatabaseConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!neonDatabaseUrl.trim()) {
      showToast('error', isAr ? 'يرجى إدخال رابط اتصال Neon (DATABASE_URL1)' : 'Neon connection string (DATABASE_URL1) is required');
      return;
    }

    setIsSavingDbConfig(true);
    try {
      const res = await fetch('/api/neon/config', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          databaseUrl: neonDatabaseUrl.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', data.message || (isAr ? 'تم حفظ رابط Neon والاتصال بقاعدة البيانات بنجاح!' : 'Neon database settings saved successfully!'));
        await fetchData();
      } else {
        showToast('error', data.message || (isAr ? 'فشل الربط بـ Neon، يرجى مراجعة رابط الاتصال' : 'Failed to connect to Neon'));
      }
    } catch (err: any) {
      showToast('error', err.message || 'خطأ أثناء الاتصال بقاعدة بيانات Neon');
    } finally {
      setIsSavingDbConfig(false);
    }
  };

  const handleTestDatabase = async () => {
    setIsTestingDb(true);
    try {
      const res = await fetch('/api/neon/test-connection', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          databaseUrl: neonDatabaseUrl.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(
          'success',
          isAr
            ? `قاعدة بيانات Neon متصلة بنجاح! الاستجابة: ${data.latencyMs}ms (${data.version?.split(' ')[0] || 'PostgreSQL'})`
            : `Neon connected! Latency: ${data.latencyMs}ms`
        );
        await fetchData();
      } else {
        showToast('error', data.message || (isAr ? 'تعذر الاتصال بقاعدة بيانات Neon' : 'Connection failed'));
      }
    } catch (err: any) {
      showToast('error', err.message || 'تعذر فحص حالة الاتصال');
    } finally {
      setIsTestingDb(false);
    }
  };

  const handleSyncDatabase = async () => {
    setIsSyncingDb(true);
    try {
      const res = await fetch('/api/neon/sync', {
        method: 'POST',
        headers: getAdminHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', data.message || (isAr ? 'تمت مزامنة البيانات الثنائية مع Neon بنجاح!' : 'Data synchronized successfully!'));
        await fetchData();
      } else {
        showToast('error', data.message || (isAr ? 'فشلت المزامنة مع Neon' : 'Sync failed'));
      }
    } catch (err: any) {
      showToast('error', err?.message || 'خطأ أثناء المزامنة');
    } finally {
      setIsSyncingDb(false);
    }
  };

  const handleMigrateDatabase = async () => {
    setIsMigratingDb(true);
    try {
      const res = await fetch('/api/neon/migrate', {
        method: 'POST',
        headers: getAdminHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', data.message || (isAr ? 'تم تنفيذ الـ Schema وإنشاء جميع الجداول بنجاح!' : 'Database schema migrated successfully!'));
        await fetchData();
      } else {
        showToast('error', data.message || (isAr ? 'فشل تنفيذ Schema' : 'Migration failed'));
      }
    } catch (err: any) {
      showToast('error', err?.message || 'خطأ أثناء تطبيق الترحيل');
    } finally {
      setIsMigratingDb(false);
    }
  };

  const handleCopyMigrationSql = async () => {
    try {
      const res = await fetch('/api/neon/schema-sql');
      const data = await res.json();
      if (data.success && data.sql) {
        await navigator.clipboard.writeText(data.sql);
        setIsCopiedSql(true);
        showToast(
          'success',
          isAr
            ? 'تم نسخ كود SQL لـ Neon بالكامل! يمكنك لصقه في Neon SQL Editor'
            : 'SQL copied to clipboard! Paste into Neon SQL Editor'
        );
        setTimeout(() => setIsCopiedSql(false), 3500);
      } else {
        showToast('error', isAr ? 'تعذر جلب ملف Schema' : 'Failed to retrieve schema SQL');
      }
    } catch (err: any) {
      showToast('error', err?.message || 'فشل النسخ');
    }
  };

  // Full Database Reset
  const handleResetDatabase = async () => {
    setIsResetting(true);
    try {
      const res = await fetch('/api/admin/reset-database', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', data.message || (isAr ? 'تم تصفير البيانات بنجاح' : 'Database wiped successfully'));
        setIsResetModalOpen(false);
        fetchData();
      } else {
        showToast('error', data.message || 'فشل مسح البيانات');
      }
    } catch (err: any) {
      showToast('error', err?.message || 'خطأ أثناء مسح البيانات');
    } finally {
      setIsResetting(false);
    }
  };

  // Filter users by search: ID, displayId, email, or name
  const filteredUsers = users.filter((u) => {
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

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-in fade-in duration-300">
      {/* Toast Notification */}
      {feedback && (
        <div
          className={`p-3.5 rounded-2xl text-xs sm:text-sm font-semibold shadow-xl flex items-center justify-between gap-2 border ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
              : 'bg-red-500/10 text-red-500 border-red-500/30'
          }`}
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="p-1 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-800 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
            title={isAr ? 'العودة' : 'Back'}
          >
            {isAr ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
          </button>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-neutral-900 dark:text-white flex items-center gap-2">
                <span>{isAr ? 'لوحة تحكم الإدارة' : 'Admin Control Panel'}</span>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-500 text-neutral-950 font-bold font-mono">
                  ADMIN
                </span>
              </h1>
            </div>
            <p className="text-xs text-neutral-500 mt-0.5">
              {isAr
                ? `مسجّل كمدير: ${currentUser?.email || 'ADMIN (ADMIN1 / ADMIN2)'} • محمية برمز ADMIN_PIN`
                : `Logged as Admin: ${currentUser?.email || 'ADMIN (ADMIN1 / ADMIN2)'} • Protected by ADMIN_PIN`}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchData}
            disabled={isLoading}
            className="px-3.5 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isAr ? 'تحديث' : 'Refresh'}</span>
          </button>

          <button
            type="button"
            onClick={onLock}
            className="px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            title={isAr ? 'قفل لوحة التحكم' : 'Lock Panel'}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>{isAr ? 'قفل اللوحة' : 'Lock'}</span>
          </button>
        </div>
      </div>


      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Users & Total Real Balances */}
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-semibold">{isAr ? 'المستخدمين المسجلين' : 'Registered Users'}</span>
            <Users className="w-4 h-4 text-cyan-500" />
          </div>
          <div className="text-2xl font-black text-neutral-900 dark:text-white font-mono">
            {stats?.registeredUsersCount ?? users.length}
          </div>
          <div className="text-[10px] text-cyan-600 dark:text-cyan-400 font-bold font-mono truncate flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1">
              <DiamondIcon className="w-3 h-3 text-cyan-400" />
              <span>{totalUsersBalance.toLocaleString()}</span>
            </span>
            <span className="text-neutral-400">•</span>
            <span className="inline-flex items-center gap-1 text-amber-500">
              <CoinIcon className="w-3 h-3" />
              <span>{totalUsersCoins.toLocaleString()}</span>
            </span>
          </div>
        </div>

        {/* Total Agents */}
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-semibold">{isAr ? 'وكلاء الشحن والسحب' : 'Deposit & Cashout Agents'}</span>
            <Building2 className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
            {agents.length}
          </div>
          <div className="text-[10px] text-neutral-400 inline-flex items-center gap-1 font-mono">
            <span>{isAr ? 'إجمالي الأرصدة:' : 'Total:'}</span>
            <span>{totalAgentsBalance.toLocaleString()}</span>
            <DiamondIcon className="w-3 h-3 text-amber-400" />
          </div>
        </div>

        {/* Telegram Bot Status */}
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-semibold">{isAr ? 'بوت تيليجرام' : 'Telegram Bot'}</span>
            <Bot className="w-4 h-4 text-[#24A1DE]" />
          </div>
          <div className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                stats?.botConfigured ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <span>{stats?.botConfigured ? (isAr ? 'متصل ونشط' : 'Connected') : (isAr ? 'غير مهيأ' : 'Not Configured')}</span>
          </div>
          <div className="text-[10px] text-neutral-400 truncate">
            {stats?.isTunnelActive ? (isAr ? 'نفق Cloudflare نشط' : 'Tunnel Active') : (isAr ? 'اتصال عام' : 'Public URL')}
          </div>
        </div>

        {/* Server Uptime */}
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-semibold">{isAr ? 'مدة تشغيل الخادم' : 'Server Uptime'}</span>
            <Activity className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-neutral-900 dark:text-white font-mono">
            {stats ? `${Math.floor(stats.uptimeSeconds / 60)} دقيقة` : '—'}
          </div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
            {isAr ? 'الخادم يعمل بحالة ممتازة' : 'Server Healthy'}
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex border-b border-neutral-200 dark:border-neutral-800 gap-2 sm:gap-4 overflow-x-auto">
        {/* Tab 1: Users */}
        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 shrink-0 ${
            activeTab === 'users'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400'
              : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>{isAr ? 'إدارة المستخدمين' : 'Users Management'}</span>
          <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800">
            {filteredUsers.length}
          </span>
        </button>

        {/* Tab 2: Agents */}
        <button
          type="button"
          onClick={() => setActiveTab('agents')}
          className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 shrink-0 ${
            activeTab === 'agents'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400'
              : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>{isAr ? 'إدارة الوكلاء' : 'Agents Management'}</span>
          <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800">
            {filteredAgents.length}
          </span>
        </button>

        {/* Tab: Broadcast & Notifications */}
        <button
          type="button"
          onClick={() => {
            setActiveTab('broadcast');
            fetchBroadcastHistory();
          }}
          className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 shrink-0 ${
            activeTab === 'broadcast'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400'
              : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <Megaphone className="w-4 h-4 text-violet-500" />
          <span>{isAr ? 'الإذاعة والإشعارات' : 'Broadcasts & Notifications'}</span>
          <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300">
            {broadcastHistory.length > 0 ? broadcastHistory.length : '📢'}
          </span>
        </button>

        {/* Tab: Feedback & Bug Reports (البلاغات والاقتراحات) */}
        <button
          type="button"
          onClick={() => {
            setActiveTab('feedback');
            fetchFeedbackReports();
          }}
          className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 shrink-0 ${
            activeTab === 'feedback'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400'
              : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <LifeBuoy className="w-4 h-4 text-rose-500" />
          <span>{isAr ? 'البلاغات والاقتراحات' : 'Reports & Suggestions'}</span>
          {feedbackReports.filter((r) => r.status === 'pending').length > 0 ? (
            <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-rose-500 text-white font-bold animate-pulse">
              {feedbackReports.filter((r) => r.status === 'pending').length}
            </span>
          ) : (
            <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
              {feedbackReports.length}
            </span>
          )}
        </button>

        {/* Tab: Telegram Password Resets (طلبات استعادة كلمة المرور) */}
        <button
          type="button"
          onClick={() => {
            setActiveTab('passwordResets');
            fetchPasswordResets();
          }}
          className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 shrink-0 ${
            activeTab === 'passwordResets'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400'
              : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <KeyRound className="w-4 h-4 text-amber-500" />
          <span>{isAr ? 'استعادة كلمة المرور (البوت)' : 'Bot Password Resets'}</span>
          {passwordResets.filter((r) => r.status === 'pending').length > 0 ? (
            <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-amber-500 text-neutral-950 font-bold animate-pulse">
              {passwordResets.filter((r) => r.status === 'pending').length}
            </span>
          ) : (
            <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
              {passwordResets.length}
            </span>
          )}
        </button>

        {/* Tab 3: Bot */}
        <button
          type="button"
          onClick={() => setActiveTab('bot')}
          className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 shrink-0 ${
            activeTab === 'bot'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400'
              : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <Bot className="w-4 h-4" />
          <span>{isAr ? 'بوت تيليجرام والربط' : 'Telegram Bot'}</span>
        </button>

        {/* Tab 4: Neon Database */}
        <button
          type="button"
          onClick={() => setActiveTab('database')}
          className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 shrink-0 ${
            activeTab === 'database'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400'
              : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>{isAr ? 'قاعدة بيانات NEON (PostgreSQL)' : 'Neon Database (PostgreSQL)'}</span>
          <span
            className={`w-2 h-2 rounded-full ${
              neonStatus?.connected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
            }`}
          />
        </button>

      </div>

      {/* =========================================================================
          TAB 1: إدارة المستخدمين (عرض كامل البيانات + بحث بالمعرف والبريد + عمليات)
          ========================================================================= */}
      {activeTab === 'users' && (
        <div className="space-y-4">
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

            <div className="text-xs text-neutral-500 self-center">
              {isAr ? `إجمالي المستخدمين: ${filteredUsers.length}` : `Total results: ${filteredUsers.length}`}
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
            <div className="space-y-3">
              {filteredUsers.map((u) => {
                const existingAgent = agents.find(
                  (a) => a.email.toLowerCase() === u.email.toLowerCase()
                );
                return (
                  <div
                    key={u.id}
                    className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-amber-500/40 transition-all shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    {/* User Profile Info */}
                    <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-600 via-indigo-700 to-neutral-900 text-white font-bold text-sm flex items-center justify-center shrink-0 border border-neutral-200 dark:border-neutral-700 shadow-xs">
                        {u.photoUrl ? (
                          <img src={u.photoUrl} alt={u.name} className="w-full h-full object-cover rounded-full" />
                        ) : (
                          u.name.substring(0, 2)
                        )}
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-neutral-900 dark:text-white truncate">
                            {u.name}
                          </span>

                          {/* Account ID Badge */}
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border border-neutral-500/20 font-bold">
                            ID: {u.displayId || u.id}
                          </span>

                          {/* Personal Diamonds Balance Badge (Clickable for instant edit) */}
                          <button
                            type="button"
                            onClick={() => handleOpenBalanceModal(u, 'diamonds')}
                            title={isAr ? 'تعديل رصيد الماسات الشخصية (منفصل عن رصيد الوكالة)' : 'Modify personal diamonds (separate from agency)'}
                            className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 font-bold transition-colors cursor-pointer"
                          >
                            <Sparkles className="w-3 h-3 text-cyan-500" />
                            <span>{(typeof u.walletBalance === 'number' ? u.walletBalance : 0).toLocaleString()}</span>
                            <DiamondIcon className="w-3 h-3 text-cyan-400" />
                            <span className="text-[9px] opacity-75 font-sans">({isAr ? 'شخصي' : 'Personal'})</span>
                          </button>

                          {/* Personal Coins Balance Badge (Clickable for instant edit) */}
                          <button
                            type="button"
                            onClick={() => handleOpenBalanceModal(u, 'coins')}
                            title={isAr ? 'تعديل رصيد الكوينز الشخصية (منفصل عن رصيد الوكالة)' : 'Modify personal coins'}
                            className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-bold transition-colors cursor-pointer"
                          >
                            <Coins className="w-3 h-3 text-amber-500" />
                            <span>{(typeof u.coinsBalance === 'number' ? u.coinsBalance : 0).toLocaleString()}</span>
                            <CoinIcon className="w-3 h-3" />
                            <span className="text-[9px] opacity-75 font-sans">({isAr ? 'شخصي' : 'Personal'})</span>
                          </button>

                          {/* If user is an agent, display Agency Balance directly */}
                          {existingAgent && (
                            <button
                              type="button"
                              onClick={() => handleOpenAgentBalanceModal(existingAgent)}
                              title={isAr ? 'تعديل رصيد وكالة الشحن (منفصل عن الحساب الشخصي)' : 'Modify agency recharge balance'}
                              className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-bold transition-colors cursor-pointer shadow-xs"
                            >
                              <Building2 className="w-3 h-3 text-amber-500" />
                              <span>{(existingAgent.balance || 0).toLocaleString()}</span>
                              <DiamondIcon className="w-3 h-3 text-amber-400" />
                              <span className="text-[9px] font-sans font-extrabold text-amber-700 dark:text-amber-300">({isAr ? 'وكالة' : 'Agency'})</span>
                            </button>
                          )}

                          {/* Gender */}
                          {u.gender && (
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                                u.gender === 'female'
                                  ? 'bg-rose-500/10 text-rose-500'
                                  : 'bg-cyan-500/10 text-cyan-600'
                              }`}
                            >
                              {u.gender === 'female' ? (isAr ? 'أنثى' : 'Female') : (isAr ? 'ذكر' : 'Male')}
                            </span>
                          )}
                        </div>

                        {/* Details row: Email - Birthdate - Created Date */}
                        <div className="text-xs text-neutral-500 dark:text-neutral-400 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="font-mono text-neutral-700 dark:text-neutral-300 font-medium">
                            {u.email}
                          </span>
                          {u.birthDate && (
                            <span>
                              {isAr ? 'الميلاد:' : 'DOB:'} {u.birthDate}
                            </span>
                          )}
                          <span title={formatLocalDateTime(u.createdAt, isAr ? 'ar' : 'en')}>
                            {isAr ? 'التسجيل:' : 'Joined:'} {formatLocalDate(u.createdAt, isAr ? 'ar' : 'en')}
                          </span>
                          {existingAgent && (
                            <span className="text-amber-600 dark:text-amber-400 font-medium text-[11px]">
                              • {isAr ? `قريد الوكالة: ${existingAgent.gridCode || 'A8838'}` : `Grid: ${existingAgent.gridCode || 'A8838'}`} (رصيد الوكالة والشخصي منفصلان)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* User Action Buttons */}
                    <div className="flex items-center gap-2 self-end md:self-center shrink-0 flex-wrap">
                      {/* 0. Appoint / Agent Badge & Agency Balance button */}
                      {existingAgent ? (
                        <button
                          type="button"
                          onClick={() => handleOpenAgentBalanceModal(existingAgent)}
                          className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                          title={isAr ? `تعديل رصيد وكالة الشحن (${existingAgent.balance || 0}) - منفصل عن الحساب الشخصي` : `Modify Agency Balance (${existingAgent.balance || 0})`}
                        >
                          <Building2 className="w-3.5 h-3.5" />
                          <span className="inline-flex items-center gap-1">
                            <span>{isAr ? `رصيد الوكالة (${(existingAgent.balance || 0).toLocaleString()}` : `Agency (${(existingAgent.balance || 0).toLocaleString()}`}</span>
                            <DiamondIcon className="w-3 h-3 text-amber-400" />
                            <span>)</span>
                          </span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenAddAgent(u)}
                          className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                          title={isAr ? 'تعيين هذا المستخدم كوكيل بالرقم الفريد والاسم والدولة كتابةً' : 'Appoint as recharge agent'}
                        >
                          <Building2 className="w-3.5 h-3.5" />
                          <span>{isAr ? 'تعيين كوكيل شحن' : 'Appoint Agent'}</span>
                        </button>
                      )}

                      {/* Send Direct Notification to User's Notification Center */}
                      <button
                        type="button"
                        onClick={() => handleOpenUserNotifyModal(u)}
                        className="px-2.5 py-1.5 rounded-xl bg-violet-500/10 hover:bg-violet-500/20 text-violet-600 dark:text-violet-400 border border-violet-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                        title={isAr ? 'إرسال إشعار لمركز إشعارات هذا المستخدم مباشرة' : 'Send notification to this user'}
                      >
                        <Megaphone className="w-3.5 h-3.5" />
                        <span>{isAr ? 'إرسال إشعار' : 'Notify'}</span>
                      </button>

                      {/* 1. Modify Personal Balance Button */}
                      <button
                        type="button"
                        onClick={() => handleOpenBalanceModal(u)}
                        className="px-2.5 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                        title={isAr ? 'تعديل رصيد الحساب الشخصي (منفصل عن الوكالة)' : 'Modify Personal Balance'}
                      >
                        <Coins className="w-3.5 h-3.5" />
                        <span>{isAr ? 'الرصيد الشخصي' : 'Personal Balance'}</span>
                      </button>

                    {/* 2. Change Password Button */}
                    <button
                      type="button"
                      onClick={() => handleOpenPasswordModal(u)}
                      className="px-2.5 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title={isAr ? 'تغيير كلمة المرور' : 'Change Password'}
                    >
                      <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                      <span>{isAr ? 'كلمة المرور' : 'Password'}</span>
                    </button>

                    {/* 3. Edit User Details (Name, Email, Account ID, DOB) */}
                    <button
                      type="button"
                      onClick={() => handleOpenEditUser(u)}
                      className="p-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
                      title={isAr ? 'تعديل بيانات المستخدم (الاسم، البريد، ID الحساب)' : 'Edit User Profile'}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>

                    {/* 4. Delete User */}
                    <button
                      type="button"
                      onClick={() => setDeletingUserId(u.id)}
                      className="p-2 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-950/50 text-red-600 dark:text-red-400 transition-colors cursor-pointer"
                      title={isAr ? 'حذف المستخدم' : 'Delete User'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
            </div>
          )}
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
                        onClick={() => setDeletingAgentId(agent.id)}
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
              <button
                type="button"
                onClick={fetchBroadcastHistory}
                disabled={isLoadingHistory}
                className="p-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                title={isAr ? 'تحديث السجل' : 'Refresh History'}
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingHistory ? 'animate-spin text-violet-500' : ''}`} />
              </button>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Title Arabic */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300">
                    {isAr ? 'عنوان الإشعار (بالعربية) *' : 'Notification Title (Arabic) *'}
                  </label>
                  <input
                    type="text"
                    value={broadcastTitleAr}
                    onChange={(e) => setBroadcastTitleAr(e.target.value)}
                    placeholder={isAr ? 'مثال: 📢 إعلان رسمي من إدارة المنصة' : 'Title in Arabic...'}
                    className="w-full text-xs px-3 py-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white focus:outline-none focus:border-violet-500 font-medium"
                  />
                </div>

                {/* Title English */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300">
                    {isAr ? 'عنوان الإشعار (بالإنجليزية - اختياري)' : 'Title (English - Optional)'}
                  </label>
                  <input
                    type="text"
                    value={broadcastTitleEn}
                    onChange={(e) => setBroadcastTitleEn(e.target.value)}
                    placeholder="e.g. Official Announcement from Soul-X Admin"
                    dir="ltr"
                    className="w-full text-xs px-3 py-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white focus:outline-none focus:border-violet-500 font-medium"
                  />
                </div>
              </div>

              {/* Category & Priority Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Priority */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300">
                    {isAr ? 'مستوى الأهمية والدرجة:' : 'Priority Level:'}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setBroadcastPriority('normal')}
                      className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer text-center ${
                        broadcastPriority === 'normal'
                          ? 'bg-neutral-200 dark:bg-neutral-800 border-neutral-400 text-neutral-900 dark:text-white'
                          : 'border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-950'
                      }`}
                    >
                      {isAr ? 'عادي' : 'Normal'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setBroadcastPriority('important')}
                      className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer text-center ${
                        broadcastPriority === 'important'
                          ? 'bg-amber-500/20 border-amber-500 text-amber-700 dark:text-amber-400'
                          : 'border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-950'
                      }`}
                    >
                      ⭐ {isAr ? 'هام' : 'Important'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setBroadcastPriority('urgent')}
                      className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer text-center ${
                        broadcastPriority === 'urgent'
                          ? 'bg-red-500/20 border-red-500 text-red-600 dark:text-red-400 animate-pulse'
                          : 'border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-950'
                      }`}
                    >
                      🔴 {isAr ? 'عاجل' : 'Urgent'}
                    </button>
                  </div>
                </div>

                {/* Category */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300">
                    {isAr ? 'تصنيف الرسالة:' : 'Category:'}
                  </label>
                  <select
                    value={broadcastCategory}
                    onChange={(e: any) => setBroadcastCategory(e.target.value)}
                    className="w-full text-xs px-3 py-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white focus:outline-none focus:border-violet-500 font-medium"
                  >
                    <option value="announcement">{isAr ? '📢 إعلان عام (Announcement)' : 'Announcement'}</option>
                    <option value="system">{isAr ? '⚙️ تحديث نظام وتطبيق (System Update)' : 'System Update'}</option>
                    <option value="warning">{isAr ? '⚠️ تنبيه وتحذير (Warning)' : 'Warning'}</option>
                    <option value="reward">{isAr ? '🎁 مكافأة وهدية (Reward)' : 'Reward'}</option>
                    <option value="alert">{isAr ? '🛡️ إشعار أمان (Security Alert)' : 'Security Alert'}</option>
                    <option value="custom">{isAr ? '✉️ رسالة مخصصة (Custom)' : 'Custom'}</option>
                  </select>
                </div>
              </div>

              {/* Message Arabic */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300">
                  {isAr ? 'نص الإشعار / الرسالة (بالعربية) *' : 'Notification Text (Arabic) *'}
                </label>
                <textarea
                  rows={4}
                  value={broadcastMessageAr}
                  onChange={(e) => setBroadcastMessageAr(e.target.value)}
                  placeholder={
                    isAr
                      ? 'اكتب تفاصيل الإذاعة أو الرسالة هنا... يمكن استخدام أسطر متعددة ونقاط واضحة.'
                      : 'Write the announcement or message text here...'
                  }
                  className="w-full text-xs p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white focus:outline-none focus:border-violet-500 font-medium leading-relaxed resize-none"
                />
              </div>

              {/* Message English */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300">
                  {isAr ? 'نص الإشعار (بالإنجليزية - اختياري)' : 'Message (English - Optional)'}
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
            {(broadcastTitleAr || broadcastMessageAr) && (
              <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-2.5">
                <div className="text-[11px] font-bold text-neutral-500 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-violet-500" />
                  <span>{isAr ? 'معاينة حية كما ستظهر في مركز الإشعارات:' : 'Live Notification Center Preview:'}</span>
                </div>

                <div
                  className={`p-4 rounded-2xl border shadow-xs space-y-2.5 ${
                    broadcastTargetType === 'all'
                      ? 'bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-transparent border-violet-500/40 ring-1 ring-violet-500/20'
                      : 'bg-gradient-to-br from-cyan-500/10 via-blue-500/5 to-transparent border-cyan-500/40 ring-1 ring-cyan-500/20'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 border-b border-neutral-200/60 dark:border-neutral-800/60 pb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs ${
                          broadcastTargetType === 'all'
                            ? 'bg-violet-500/20 text-violet-600 dark:text-violet-400'
                            : 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400'
                        }`}
                      >
                        {broadcastTargetType === 'all' ? <Megaphone className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-xs sm:text-sm text-neutral-900 dark:text-white">
                          {broadcastTitleAr || (isAr ? 'عنوان الإشعار' : 'Notification Title')}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            broadcastTargetType === 'all'
                              ? 'bg-violet-500/20 text-violet-700 dark:text-violet-300'
                              : 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300'
                          }`}
                        >
                          {broadcastTargetType === 'all'
                            ? isAr ? '📢 إذاعة عامة' : '📢 Broadcast'
                            : isAr ? '🛡️ رسالة إدارية' : '🛡️ Admin Message'}
                        </span>
                        {broadcastPriority === 'urgent' && (
                          <span className="px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-600 dark:text-red-400 text-[10px] font-extrabold animate-pulse">
                            {isAr ? 'عاجل' : 'Urgent'}
                          </span>
                        )}
                        {broadcastPriority === 'important' && (
                          <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400 text-[10px] font-bold">
                            {isAr ? 'هام' : 'Important'}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-neutral-400">الآن</span>
                  </div>

                  <p className="text-xs text-neutral-800 dark:text-neutral-200 leading-relaxed whitespace-pre-line font-medium">
                    {broadcastMessageAr || (isAr ? 'نص الإشعار سيظهر هنا...' : 'Message text appears here...')}
                  </p>

                  <div className="flex items-center justify-between pt-1.5 border-t border-neutral-200/40 dark:border-neutral-800/40 text-[10px] text-neutral-500">
                    <span className="flex items-center gap-1 font-semibold text-violet-600 dark:text-violet-400">
                      <Sparkles className="w-3 h-3" />
                      {isAr ? 'إدارة Soul-X الرسمية' : 'Soul-X Official Administration'}
                    </span>
                    <span>
                      {broadcastTargetType === 'all'
                        ? isAr ? `موجه لكافة الأعضاء (${users.length})` : `To all ${users.length} members`
                        : isAr ? `موجه للحساب: ${broadcastSelectedUser?.name || 'محدد'}` : `To user`}
                    </span>
                  </div>
                </div>
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

          {/* Broadcasts & Notifications History Card */}
          <div className="p-4 sm:p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-violet-500" />
                <h4 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-white">
                  {isAr ? 'سجل الإذاعات والرسائل الإدارية المرسلة' : 'Sent Broadcasts & Notifications History'}
                </h4>
                <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800">
                  {broadcastHistory.length}
                </span>
              </div>

              {/* History Search Box */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-neutral-400 absolute right-3 top-1/2 -translate-y-1/2 rtl:right-3 rtl:left-auto ltr:left-3 ltr:right-auto" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder={isAr ? 'بحث في السجل...' : 'Search history...'}
                  className="w-full text-xs pr-8 pl-3 rtl:pr-8 rtl:pl-3 ltr:pl-8 ltr:pr-3 py-1.5 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:border-violet-500"
                />
              </div>
            </div>

            {/* History Feed */}
            {isLoadingHistory ? (
              <div className="py-12 text-center text-xs text-neutral-400 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-violet-500" />
                <span>{isAr ? 'جاري تحميل السجل...' : 'Loading history...'}</span>
              </div>
            ) : broadcastHistory.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-400 flex items-center justify-center mx-auto">
                  <Megaphone className="w-6 h-6" />
                </div>
                <div className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                  {isAr ? 'لا توجد إذاعات أو رسائل إدارية مرسلة حتى الآن' : 'No broadcasts sent yet'}
                </div>
                <div className="text-[11px] text-neutral-400">
                  {isAr
                    ? 'عند إرسال إذاعة عامة أو رسالة لمستخدم ستظهر هنا مع إحصائيات القراءة.'
                    : 'Sent broadcasts and targeted notices will appear here.'}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {broadcastHistory
                  .filter((item) => {
                    if (!historySearch.trim()) return true;
                    const q = historySearch.trim().toLowerCase();
                    return (
                      item.titleAr?.toLowerCase().includes(q) ||
                      item.messageAr?.toLowerCase().includes(q) ||
                      item.recipientName?.toLowerCase().includes(q) ||
                      item.recipientDisplayId?.toLowerCase().includes(q)
                    );
                  })
                  .map((item) => {
                    const isBroadcast = item.type === 'admin_broadcast';
                    return (
                      <div
                        key={item.id || item.broadcastId}
                        className={`p-4 rounded-2xl border transition-all ${
                          isBroadcast
                            ? 'bg-neutral-50/50 dark:bg-neutral-950/50 border-violet-500/25 hover:border-violet-500/50'
                            : 'bg-neutral-50/50 dark:bg-neutral-950/50 border-cyan-500/25 hover:border-cyan-500/50'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-neutral-200/60 dark:border-neutral-800/60">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isBroadcast
                                  ? 'bg-violet-500/20 text-violet-700 dark:text-violet-300'
                                  : 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300'
                              }`}
                            >
                              {isBroadcast
                                ? isAr ? '📢 إذاعة عامة' : '📢 Broadcast'
                                : isAr ? '👤 رسالة خاصة' : '👤 Private Notice'}
                            </span>

                            <h5 className="font-bold text-xs sm:text-sm text-neutral-900 dark:text-white">
                              {item.titleAr}
                            </h5>

                            {item.priority === 'urgent' && (
                              <span className="px-1.5 py-0.2 rounded-md bg-red-500/20 text-red-600 dark:text-red-400 text-[10px] font-extrabold">
                                {isAr ? 'عاجل' : 'Urgent'}
                              </span>
                            )}
                            {item.priority === 'important' && (
                              <span className="px-1.5 py-0.2 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-400 text-[10px] font-bold">
                                {isAr ? 'هام' : 'Important'}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-center">
                            <span className="text-[11px] font-mono text-neutral-400" dir="ltr">
                              {formatLocalDateTime(item.timestamp, isAr ? 'ar' : 'en')}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteBroadcast(item)}
                              className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                              title={isAr ? 'حذف من مركز الإشعارات' : 'Delete Notification'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <p className="text-xs text-neutral-700 dark:text-neutral-300 my-2 leading-relaxed whitespace-pre-line font-medium">
                          {item.messageAr}
                        </p>

                        <div className="flex items-center justify-between pt-2 text-[11px] text-neutral-500 dark:text-neutral-400">
                          <div>
                            {isBroadcast ? (
                              <span>
                                {isAr
                                  ? `المرسل إليهم: جميع المستخدمين (${item.totalRecipients || users.length}) • مقروءة: ${item.readCount || 0}`
                                  : `Sent to: All (${item.totalRecipients || users.length}) • Read: ${item.readCount || 0}`}
                              </span>
                            ) : (
                              <span>
                                {isAr ? 'المستلم:' : 'Recipient:'}{' '}
                                <strong className="text-neutral-800 dark:text-neutral-200">
                                  {item.recipientName || 'مستخدم'}
                                </strong>{' '}
                                <span className="font-mono text-[10px]">
                                  ({item.recipientDisplayId || item.userId})
                                </span>{' '}
                                • {item.read ? (
                                  <span className="text-emerald-500 font-bold">{isAr ? 'مقروءة ✓' : 'Read ✓'}</span>
                                ) : (
                                  <span className="text-amber-500 font-bold">{isAr ? 'غير مقروءة' : 'Unread'}</span>
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB: قسم البلاغات والاقتراحات (Reports & Suggestions Management)
          ========================================================================= */}
      {activeTab === 'feedback' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Header & Stats Banner */}
          <div className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
                      ? 'متابعة شكاوى المستخدمين، الأخطاء التقنية، والاقتراحات المرسلة من شاشة الحساب والرد عليها مباشرة.'
                      : 'Track user bug reports, feature suggestions, and reply to user notifications directly.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchFeedbackReports}
                  disabled={isLoadingFeedback}
                  className="px-3.5 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFeedback ? 'animate-spin' : ''}`} />
                  <span>{isAr ? 'تحديث' : 'Refresh'}</span>
                </button>
              </div>
            </div>

            {/* Quick KPI stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-neutral-500 font-medium">{isAr ? 'أخطاء تقنية' : 'Bugs'}</p>
                  <p className="text-xl font-black text-rose-600 dark:text-rose-400 font-mono">
                    {feedbackReports.filter((r) => r.type === 'bug').length}
                  </p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
                  <Bug className="w-4 h-4" />
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-neutral-500 font-medium">{isAr ? 'أفكار واقتراحات' : 'Suggestions'}</p>
                  <p className="text-xl font-black text-amber-600 dark:text-amber-400 font-mono">
                    {feedbackReports.filter((r) => r.type === 'suggestion').length}
                  </p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                  <Lightbulb className="w-4 h-4" />
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-neutral-500 font-medium">{isAr ? 'قيد الانتظار' : 'Pending'}</p>
                  <p className="text-xl font-black text-blue-600 dark:text-blue-400 font-mono">
                    {feedbackReports.filter((r) => r.status === 'pending').length}
                  </p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-neutral-500 font-medium">{isAr ? 'تم الحل والمعالجة' : 'Resolved'}</p>
                  <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                    {feedbackReports.filter((r) => r.status === 'resolved').length}
                  </p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>

          {/* Filters & Search Toolbar */}
          <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-3">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* Type Filters */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
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
                  onClick={() => setFeedbackFilterType('bug')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 cursor-pointer transition-colors flex items-center gap-1 ${
                    feedbackFilterType === 'bug'
                      ? 'bg-rose-500 text-white font-bold'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200'
                  }`}
                >
                  <Bug className="w-3 h-3" />
                  <span>{isAr ? 'أخطاء برمجية' : 'Bugs'}</span>
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
                  <span>{isAr ? 'اقتراحات' : 'Suggestions'}</span>
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
                  <span>{isAr ? 'ملاحظات عامة' : 'General'}</span>
                </button>
              </div>

              {/* Status Filters */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                <span className="text-xs font-bold text-neutral-400 shrink-0 ml-1 rtl:mr-1">
                  {isAr ? 'الحالة:' : 'Status:'}
                </span>
                <button
                  type="button"
                  onClick={() => setFeedbackFilterStatus('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 cursor-pointer transition-colors ${
                    feedbackFilterStatus === 'all'
                      ? 'bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-900 font-bold'
                      : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  {isAr ? 'الكل' : 'All'}
                </button>
                <button
                  type="button"
                  onClick={() => setFeedbackFilterStatus('pending')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 cursor-pointer transition-colors ${
                    feedbackFilterStatus === 'pending'
                      ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 font-bold'
                      : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  {isAr ? 'قيد الانتظار' : 'Pending'}
                </button>
                <button
                  type="button"
                  onClick={() => setFeedbackFilterStatus('in_review')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 cursor-pointer transition-colors ${
                    feedbackFilterStatus === 'in_review'
                      ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-bold'
                      : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  {isAr ? 'قيد المراجعة' : 'In Review'}
                </button>
                <button
                  type="button"
                  onClick={() => setFeedbackFilterStatus('resolved')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 cursor-pointer transition-colors ${
                    feedbackFilterStatus === 'resolved'
                      ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-bold'
                      : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  {isAr ? 'تم الحل' : 'Resolved'}
                </button>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-neutral-400 absolute top-3 right-3 rtl:right-3 rtl:left-auto ltr:left-3 ltr:right-auto" />
              <input
                type="text"
                value={feedbackSearch}
                onChange={(e) => setFeedbackSearch(e.target.value)}
                placeholder={
                  isAr
                    ? 'ابحث بالعنوان، النص، اسم المستخدم، البريد، أو الـ ID...'
                    : 'Search by title, description, user name, email, or ID...'
                }
                className="w-full pl-3 pr-10 rtl:pr-10 rtl:pl-3 ltr:pl-10 ltr:pr-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:border-rose-500 transition-colors"
              />
            </div>
          </div>

          {/* Feedback Reports List */}
          {(() => {
            const filteredReports = feedbackReports.filter((r) => {
              if (feedbackFilterType !== 'all' && r.type !== feedbackFilterType) return false;
              if (feedbackFilterStatus !== 'all' && r.status !== feedbackFilterStatus) return false;
              if (feedbackSearch.trim()) {
                const q = feedbackSearch.toLowerCase().trim();
                const matchTitle = (r.title || '').toLowerCase().includes(q);
                const matchDesc = (r.description || '').toLowerCase().includes(q);
                const matchName = (r.userName || '').toLowerCase().includes(q);
                const matchEmail = (r.userEmail || '').toLowerCase().includes(q);
                const matchId = (r.userDisplayId || '').toLowerCase().includes(q);
                const matchAdminReply = (r.adminReply || '').toLowerCase().includes(q);
                if (!matchTitle && !matchDesc && !matchName && !matchEmail && !matchId && !matchAdminReply) {
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
                    {isAr ? 'لا توجد بلاغات أو اقتراحات تطابق المعايير' : 'No matching reports found'}
                  </h4>
                  <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                    {isAr
                      ? 'عند قيام أي مستخدم بتقديم بلاغ عن خطأ أو فكرة تطويرية ستظهر هنا فوراً مع كامل التفاصيل.'
                      : 'When any user submits a bug report or suggestion from their account, it will appear here.'}
                  </p>
                </div>
              );
            }

            return (
              <div className="space-y-3">
                {filteredReports.map((report) => {
                  const isBug = report.type === 'bug';
                  const isSuggestion = report.type === 'suggestion';
                  const statusColors = {
                    pending: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
                    in_review: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
                    resolved: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
                    dismissed: 'bg-neutral-500/10 text-neutral-500 border-neutral-500/20',
                  };

                  const statusLabels = {
                    pending: isAr ? 'قيد الانتظار' : 'Pending',
                    in_review: isAr ? 'قيد المراجعة' : 'In Review',
                    resolved: isAr ? 'تم الحل والمعالجة' : 'Resolved',
                    dismissed: isAr ? 'مستبعد' : 'Dismissed',
                  };

                  const priorityColors = {
                    low: 'text-neutral-500 bg-neutral-100 dark:bg-neutral-800',
                    medium: 'text-blue-500 bg-blue-500/10',
                    high: 'text-amber-500 bg-amber-500/10',
                    urgent: 'text-rose-600 bg-rose-500/15 font-bold animate-pulse',
                  };

                  return (
                    <div
                      key={report.id}
                      className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 transition-all shadow-xs space-y-3"
                    >
                      {/* Top Header of Card */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-neutral-100 dark:border-neutral-800/80">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          {/* Type Badge */}
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold ${
                              isBug
                                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                : isSuggestion
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                : 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                            }`}
                          >
                            {isBug ? <Bug className="w-3.5 h-3.5" /> : isSuggestion ? <Lightbulb className="w-3.5 h-3.5" /> : <MessageSquarePlus className="w-3.5 h-3.5" />}
                            <span>
                              {isBug
                                ? isAr ? 'خطأ برمجي / مشكلة' : 'Bug Report'
                                : isSuggestion
                                ? isAr ? 'اقتراح تطوير' : 'Feature Idea'
                                : isAr ? 'ملاحظة عامة' : 'General Feedback'}
                            </span>
                          </span>

                          {/* Status Badge */}
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusColors[report.status]}`}>
                            {statusLabels[report.status]}
                          </span>

                          {/* Priority Badge */}
                          {report.priority && (
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${priorityColors[report.priority]}`}>
                              {report.priority === 'urgent'
                                ? isAr ? '🚨 طارئ جداً' : 'Urgent'
                                : report.priority === 'high'
                                ? isAr ? 'أولوية عالية' : 'High'
                                : report.priority === 'medium'
                                ? isAr ? 'متوسط' : 'Medium'
                                : isAr ? 'عادي' : 'Low'}
                            </span>
                          )}

                          {/* ID badge */}
                          <span className="font-mono text-[10px] text-neutral-400">
                            #{report.id.substring(report.id.lastIndexOf('-') + 1)}
                          </span>
                        </div>

                        {/* Date */}
                        <div className="text-[11px] text-neutral-400 font-mono flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-neutral-400" />
                          <span>{formatLocalDateTime(report.createdAt)}</span>
                        </div>
                      </div>

                      {/* User Info Bar */}
                      <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-950/70 border border-neutral-100 dark:border-neutral-800 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          {report.userAvatar ? (
                            <img src={report.userAvatar} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 flex items-center justify-center font-bold text-xs shrink-0">
                              {(report.userName || 'U')[0].toUpperCase()}
                            </div>
                          )}
                          <div className="truncate">
                            <span className="font-bold text-neutral-900 dark:text-white ml-1 rtl:mr-1">
                              {report.userName || (isAr ? 'مستخدم مجهول' : 'Anonymous')}
                            </span>
                            {report.userDisplayId && (
                              <span className="font-mono text-[11px] text-cyan-600 dark:text-cyan-400 ml-1.5 rtl:mr-1.5">
                                (ID: {report.userDisplayId})
                              </span>
                            )}
                            {report.userEmail && (
                              <span className="text-[11px] text-neutral-400 ml-1.5 rtl:mr-1.5 hidden sm:inline">
                                • {report.userEmail}
                              </span>
                            )}
                          </div>
                        </div>

                        {report.deviceInfo && (
                          <div className="text-[10px] text-neutral-400 truncate max-w-[200px]" title={report.deviceInfo}>
                            📱 {report.deviceInfo}
                          </div>
                        )}
                      </div>

                      {/* Title & Description Body */}
                      <div className="space-y-1.5">
                        <h4 className="text-sm font-bold text-neutral-900 dark:text-white">
                          {report.title}
                        </h4>
                        <p className="text-xs text-neutral-600 dark:text-neutral-300 whitespace-pre-wrap leading-relaxed bg-neutral-50/50 dark:bg-neutral-950/40 p-3 rounded-xl border border-neutral-100 dark:border-neutral-800/60 font-sans">
                          {report.description}
                        </p>
                      </div>

                      {/* Admin Reply & Notes Section if already present */}
                      {(report.adminReply || report.adminNotes) && (
                        <div className="space-y-2 p-3 rounded-xl bg-violet-50/50 dark:bg-violet-950/20 border border-violet-200/50 dark:border-violet-900/40 text-xs">
                          {report.adminReply && (
                            <div>
                              <span className="font-bold text-violet-700 dark:text-violet-300 flex items-center gap-1 mb-1">
                                <Send className="w-3 h-3" />
                                {isAr ? 'رد الإدارة المرسل للمستخدم (في مركز الإشعارات):' : 'Admin Reply (sent to user):'}
                              </span>
                              <p className="text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap bg-white dark:bg-neutral-900 p-2 rounded-lg border border-violet-200 dark:border-violet-800/40">
                                {report.adminReply}
                              </p>
                            </div>
                          )}
                          {report.adminNotes && (
                            <div>
                              <span className="font-bold text-neutral-500 flex items-center gap-1 mb-1">
                                <FileCode className="w-3 h-3" />
                                {isAr ? 'ملاحظات فريق التطوير الداخلية:' : 'Internal Dev Notes:'}
                              </span>
                              <p className="text-neutral-600 dark:text-neutral-400 italic font-mono text-[11px]">
                                {report.adminNotes}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Card Action Footer */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                        {/* Quick Status Buttons */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-neutral-400 font-semibold">{isAr ? 'تغيير سريع:' : 'Quick:'}</span>
                          {report.status !== 'in_review' && (
                            <button
                              type="button"
                              onClick={() => handleQuickStatusChange(report.id, 'in_review')}
                              className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 transition-colors cursor-pointer"
                            >
                              {isAr ? 'قيد المراجعة' : 'In Review'}
                            </button>
                          )}
                          {report.status !== 'resolved' && (
                            <button
                              type="button"
                              onClick={() => handleQuickStatusChange(report.id, 'resolved')}
                              className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 transition-colors cursor-pointer"
                            >
                              {isAr ? 'تم الحل ✅' : 'Resolved ✅'}
                            </button>
                          )}
                        </div>

                        {/* Action Buttons: Reply / Delete */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenReportDetails(report)}
                            className="px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>{isAr ? 'الرد وإشعار المستخدم' : 'Reply & Notify'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteFeedbackReport(report.id)}
                            disabled={deletingReportId === report.id}
                            className="p-1.5 rounded-xl text-neutral-400 hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                            title={isAr ? 'حذف البلاغ نهائياً' : 'Delete Report'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Reply & Update Status Modal */}
          {selectedReport && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-md animate-in fade-in duration-200">
              <div className="relative w-full max-w-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
                <button
                  type="button"
                  onClick={() => setSelectedReport(null)}
                  className="absolute top-4 right-4 rtl:right-auto rtl:left-4 p-2 rounded-full text-neutral-400 hover:text-neutral-900 dark:hover:text-white bg-neutral-100 dark:bg-neutral-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-violet-500/10 text-violet-600 flex items-center justify-center shrink-0">
                    <LifeBuoy className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                      {isAr ? 'الرد على البلاغ وتحديث الحالة' : 'Reply to Report & Update Status'}
                    </h3>
                    <p className="text-xs text-neutral-500">
                      {selectedReport.userName} ({selectedReport.userDisplayId ? `ID: ${selectedReport.userDisplayId}` : selectedReport.userEmail || ''})
                    </p>
                  </div>
                </div>

                {/* Report Summary Card */}
                <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-1.5 text-xs">
                  <div className="font-bold text-neutral-900 dark:text-white">
                    {selectedReport.title}
                  </div>
                  <p className="text-neutral-600 dark:text-neutral-400 whitespace-pre-wrap leading-relaxed">
                    {selectedReport.description}
                  </p>
                </div>

                <form onSubmit={handleUpdateFeedbackReport} className="space-y-4">
                  {/* Status Picker */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                      {isAr ? 'حالة البلاغ:' : 'Report Status:'}
                    </label>
                    <div className="grid grid-cols-4 gap-1.5 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => setReplyStatus('pending')}
                        className={`py-2 rounded-lg transition-colors cursor-pointer ${
                          replyStatus === 'pending'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-neutral-600 dark:text-neutral-400'
                        }`}
                      >
                        {isAr ? 'قيد الانتظار' : 'Pending'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setReplyStatus('in_review')}
                        className={`py-2 rounded-lg transition-colors cursor-pointer ${
                          replyStatus === 'in_review'
                            ? 'bg-amber-500 text-neutral-950 shadow-xs'
                            : 'text-neutral-600 dark:text-neutral-400'
                        }`}
                      >
                        {isAr ? 'قيد المراجعة' : 'Reviewing'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setReplyStatus('resolved')}
                        className={`py-2 rounded-lg transition-colors cursor-pointer ${
                          replyStatus === 'resolved'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-neutral-600 dark:text-neutral-400'
                        }`}
                      >
                        {isAr ? 'تم الحل ✅' : 'Resolved'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setReplyStatus('dismissed')}
                        className={`py-2 rounded-lg transition-colors cursor-pointer ${
                          replyStatus === 'dismissed'
                            ? 'bg-neutral-600 text-white shadow-xs'
                            : 'text-neutral-600 dark:text-neutral-400'
                        }`}
                      >
                        {isAr ? 'استبعاد' : 'Dismiss'}
                      </button>
                    </div>
                  </div>

                  {/* Admin Reply Input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                      <span>{isAr ? 'رسالة الرد للمستخدم:' : 'Reply Message to User:'}</span>
                      <span className="text-[10px] text-neutral-400 font-normal">
                        {isAr ? 'تصل كإشعار رسمي في حسابه' : 'Delivered to notification center'}
                      </span>
                    </label>
                    <textarea
                      value={adminReplyText}
                      onChange={(e) => setAdminReplyText(e.target.value)}
                      rows={3}
                      placeholder={
                        isAr
                          ? 'شكراً لتواصلك! تم فحص المشكلة وحلها في التحديث الأخير...'
                          : 'Thank you for your report! The issue has been investigated and resolved...'
                      }
                      className="w-full px-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:border-violet-500 resize-none"
                    />
                  </div>

                  {/* Notify User Checkbox */}
                  <label className="flex items-center gap-2 p-3 rounded-xl bg-violet-50/60 dark:bg-violet-950/30 border border-violet-200/60 dark:border-violet-900/40 text-xs text-violet-900 dark:text-violet-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifyUserViaCenter}
                      onChange={(e) => setNotifyUserViaCenter(e.target.checked)}
                      className="rounded border-violet-400 text-violet-600 focus:ring-violet-500"
                    />
                    <div className="font-semibold">
                      {isAr
                        ? 'إرسال الرد فوراً إلى مركز إشعارات المستخدم 🔔'
                        : 'Send reply directly to the user Notification Center 🔔'}
                    </div>
                  </label>

                  {/* Internal Admin Notes */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                      {isAr ? 'ملاحظات داخلية للمشرفين (سرية لا تظهر للمستخدم):' : 'Internal Admin Notes (Private):'}
                    </label>
                    <input
                      type="text"
                      value={adminNotesText}
                      onChange={(e) => setAdminNotesText(e.target.value)}
                      placeholder={isAr ? 'تم معالجة الخطأ في commit #abc12' : 'Fixed in commit #abc12'}
                      className="w-full px-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:border-neutral-400"
                    />
                  </div>

                  {/* Submit Button */}
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedReport(null)}
                      className="flex-1 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-bold transition-colors cursor-pointer"
                    >
                      {isAr ? 'إلغاء' : 'Cancel'}
                    </button>
                    <button
                      type="submit"
                      disabled={isUpdatingFeedback}
                      className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
                    >
                      {isUpdatingFeedback ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>{isAr ? 'جاري الحفظ...' : 'Saving...'}</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{isAr ? 'حفظ وتحديث الحالة' : 'Save & Update'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB: طلبات استعادة كلمة المرور من بوت تيليجرام (Telegram Password Resets)
          ========================================================================= */}
      {activeTab === 'passwordResets' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Header Card */}
          <div className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 border border-amber-500/20">
                  <KeyRound className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                    <span>{isAr ? 'طلبات استعادة كلمة المرور (بوت تيليجرام)' : 'Telegram Bot Password Reset Requests'}</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-mono font-bold">
                      {passwordResets.length}
                    </span>
                  </h3>
                  <p className="text-xs text-neutral-500">
                    {isAr
                      ? 'قسم مخصص لاستقبال طلبات "نسيت كلمة المرور" من مستخدمي البوت مع يوزر تيليجرام للتواصل الفوري والمباشر معهم عبر الدعم.'
                      : 'Dedicated section for forgot password requests via Telegram bot with direct contact usernames for support.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchPasswordResets}
                  disabled={isLoadingPasswordResets}
                  className="px-3.5 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingPasswordResets ? 'animate-spin' : ''}`} />
                  <span>{isAr ? 'تحديث' : 'Refresh'}</span>
                </button>
              </div>
            </div>

            {/* Quick KPI stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-neutral-500 font-medium">{isAr ? 'إجمالي الطلبات' : 'Total Requests'}</p>
                  <p className="text-xl font-black text-neutral-900 dark:text-white font-mono">
                    {passwordResets.length}
                  </p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-neutral-500/10 text-neutral-500 flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-neutral-500 font-medium">{isAr ? 'قيد الانتظار' : 'Pending'}</p>
                  <p className="text-xl font-black text-amber-600 dark:text-amber-400 font-mono">
                    {passwordResets.filter((r) => r.status === 'pending').length}
                  </p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-neutral-500 font-medium">{isAr ? 'تم التواصل' : 'Contacted'}</p>
                  <p className="text-xl font-black text-blue-600 dark:text-blue-400 font-mono">
                    {passwordResets.filter((r) => r.status === 'contacted').length}
                  </p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                  <MessageCircle className="w-4 h-4" />
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-neutral-500 font-medium">{isAr ? 'تم الحل والتسليم' : 'Resolved'}</p>
                  <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                    {passwordResets.filter((r) => r.status === 'resolved').length}
                  </p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>

          {/* Filters & Search Toolbar */}
          <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                <span className="text-xs font-bold text-neutral-400 shrink-0 ml-1 rtl:mr-1">
                  <Filter className="w-3.5 h-3.5 inline ml-1" />
                  {isAr ? 'الحالة:' : 'Status:'}
                </span>
                <button
                  type="button"
                  onClick={() => setPasswordResetsFilterStatus('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 cursor-pointer transition-colors ${
                    passwordResetsFilterStatus === 'all'
                      ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-bold'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200'
                  }`}
                >
                  {isAr ? 'الكل' : 'All'}
                </button>
                <button
                  type="button"
                  onClick={() => setPasswordResetsFilterStatus('pending')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 cursor-pointer transition-colors ${
                    passwordResetsFilterStatus === 'pending'
                      ? 'bg-amber-500 text-neutral-950 font-bold'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200'
                  }`}
                >
                  {isAr ? 'قيد الانتظار' : 'Pending'}
                </button>
                <button
                  type="button"
                  onClick={() => setPasswordResetsFilterStatus('contacted')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 cursor-pointer transition-colors ${
                    passwordResetsFilterStatus === 'contacted'
                      ? 'bg-blue-600 text-white font-bold'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200'
                  }`}
                >
                  {isAr ? 'تم التواصل' : 'Contacted'}
                </button>
                <button
                  type="button"
                  onClick={() => setPasswordResetsFilterStatus('resolved')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 cursor-pointer transition-colors ${
                    passwordResetsFilterStatus === 'resolved'
                      ? 'bg-emerald-600 text-white font-bold'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200'
                  }`}
                >
                  {isAr ? 'تم الحل' : 'Resolved'}
                </button>
              </div>

              {/* Search */}
              <div className="relative sm:w-80">
                <Search className="w-4 h-4 text-neutral-400 absolute top-2.5 right-3 rtl:right-3 rtl:left-auto ltr:left-3 ltr:right-auto" />
                <input
                  type="text"
                  value={passwordResetsSearch}
                  onChange={(e) => setPasswordResetsSearch(e.target.value)}
                  placeholder={
                    isAr
                      ? 'ابحث بيوزر تلغرام، الاسم، أو آيدي المستخدم...'
                      : 'Search by Telegram username, name, or ID...'
                  }
                  className="w-full pl-3 pr-9 rtl:pr-9 rtl:pl-3 ltr:pl-9 ltr:pr-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Requests List */}
          {(() => {
            const filteredRequests = passwordResets.filter((item) => {
              if (passwordResetsFilterStatus !== 'all' && item.status !== passwordResetsFilterStatus) return false;
              if (passwordResetsSearch.trim()) {
                const q = passwordResetsSearch.toLowerCase().trim();
                const matchUser = (item.telegramUsername || '').toLowerCase().includes(q);
                const matchFirst = (item.telegramFirstName || '').toLowerCase().includes(q);
                const matchLast = (item.telegramLastName || '').toLowerCase().includes(q);
                const matchId = String(item.telegramUserId || '').toLowerCase().includes(q);
                const matchNotes = (item.adminNotes || '').toLowerCase().includes(q);
                if (!matchUser && !matchFirst && !matchLast && !matchId && !matchNotes) {
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
                  <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                    {isAr
                      ? 'عندما يضغط أي مستخدم في بوت تيليجرام على زر "🔑 نسيت كلمة المرور / طلب مساعدة" سيظهر طلبه هنا فوراً مع يوزر حسابه للتواصل المباشر.'
                      : 'When any user taps the Forgot Password button in the Telegram Bot, their request and username will appear here for direct support contact.'}
                  </p>
                </div>
              );
            }

            return (
              <div className="space-y-3">
                {filteredRequests.map((item) => {
                  const statusColors = {
                    pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
                    contacted: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
                    resolved: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
                    cancelled: 'bg-neutral-500/10 text-neutral-500 border-neutral-500/20',
                  };

                  const statusLabels = {
                    pending: isAr ? 'قيد الانتظار' : 'Pending',
                    contacted: isAr ? 'تم التواصل' : 'Contacted',
                    resolved: isAr ? 'تم الحل ✅' : 'Resolved',
                    cancelled: isAr ? 'ملغي' : 'Cancelled',
                  };

                  const cleanUsername = item.telegramUsername
                    ? item.telegramUsername.replace(/^@/, '')
                    : null;
                  const telegramDirectLink = cleanUsername
                    ? `https://t.me/${cleanUsername}`
                    : `tg://user?id=${item.telegramUserId}`;

                  const fullName = [item.telegramFirstName, item.telegramLastName].filter(Boolean).join(' ') || (isAr ? 'مستخدم تيليجرام' : 'Telegram User');

                  return (
                    <div
                      key={item.id}
                      className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 transition-all shadow-xs space-y-3"
                    >
                      {/* Top Header of Card */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-neutral-100 dark:border-neutral-800">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusColors[item.status]}`}>
                            {statusLabels[item.status]}
                          </span>

                          <span className="font-mono text-xs text-neutral-400">
                            #{item.id}
                          </span>
                        </div>

                        <div className="text-[11px] text-neutral-400 font-mono flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-neutral-400" />
                          <span>{formatLocalDateTime(item.requestedAt)}</span>
                        </div>
                      </div>

                      {/* Main Telegram Contact Card */}
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3.5 rounded-2xl bg-gradient-to-r from-sky-500/10 via-blue-500/5 to-transparent border border-sky-500/20">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-[#24A1DE] text-white flex items-center justify-center font-bold text-lg shadow-md shrink-0">
                            <Bot className="w-6 h-6" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-base font-bold text-neutral-900 dark:text-white">
                                {fullName}
                              </h4>
                              {item.telegramUsername ? (
                                <span className="text-sm font-mono font-bold text-[#24A1DE] bg-sky-500/10 px-2.5 py-0.5 rounded-lg border border-sky-500/20">
                                  @{cleanUsername}
                                </span>
                              ) : (
                                <span className="text-xs text-neutral-400 font-mono bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-md">
                                  (لا يوجد يوزر عام)
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-neutral-500 font-mono mt-0.5 flex items-center gap-2">
                              <span>آيدي تيليجرام: <b className="text-neutral-700 dark:text-neutral-300">{item.telegramUserId}</b></span>
                              <span>•</span>
                              <span>Chat ID: <b className="text-neutral-700 dark:text-neutral-300">{item.chatId}</b></span>
                            </div>
                          </div>
                        </div>

                        {/* Direct Telegram Chat Button */}
                        <div className="flex items-center gap-2 shrink-0">
                          {cleanUsername ? (
                            <a
                              href={telegramDirectLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-4 py-2.5 rounded-xl bg-[#24A1DE] hover:bg-[#208bbf] text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-sky-500/25 transition-all cursor-pointer"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>{isAr ? 'محادثة المستخدم تيليجرام مباشرة' : 'Chat via Telegram'}</span>
                              <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                            </a>
                          ) : (
                            <a
                              href={telegramDirectLink}
                              className="px-4 py-2.5 rounded-xl bg-[#24A1DE] hover:bg-[#208bbf] text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-sky-500/25 transition-all cursor-pointer"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>{isAr ? 'فتح المحادثة بالآيدي' : 'Open Chat by ID'}</span>
                            </a>
                          )}

                          {cleanUsername && (
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(`@${cleanUsername}`);
                                showToast('success', isAr ? 'تم نسخ اليوزر بنجاح' : 'Username copied');
                              }}
                              className="p-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
                              title={isAr ? 'نسخ يوزر تيليجرام' : 'Copy Username'}
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Admin Notes if any */}
                      {item.adminNotes && (
                        <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-800 text-xs">
                          <span className="font-bold text-neutral-500 block mb-0.5">
                            {isAr ? 'ملاحظات الدعم الفني والإدارة:' : 'Support Notes:'}
                          </span>
                          <p className="text-neutral-700 dark:text-neutral-300 font-sans leading-relaxed">
                            {item.adminNotes}
                          </p>
                        </div>
                      )}

                      {/* Footer Actions */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                        {/* Quick Status Buttons */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] text-neutral-400 font-semibold">{isAr ? 'الحالة:' : 'Status:'}</span>
                          {item.status !== 'contacted' && (
                            <button
                              type="button"
                              onClick={() => handleQuickResetStatusChange(item.id, 'contacted')}
                              className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 transition-colors cursor-pointer"
                            >
                              {isAr ? 'تم التواصل معه' : 'Mark Contacted'}
                            </button>
                          )}
                          {item.status !== 'resolved' && (
                            <button
                              type="button"
                              onClick={() => handleQuickResetStatusChange(item.id, 'resolved')}
                              className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 transition-colors cursor-pointer"
                            >
                              {isAr ? 'تم الحل وتعيين كلمة المرور ✅' : 'Mark Resolved ✅'}
                            </button>
                          )}
                        </div>

                        {/* Modals & Delete */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenEditResetItem(item)}
                            className="px-3 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>{isAr ? 'تعديل وملاحظات' : 'Edit & Notes'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeletePasswordReset(item.id)}
                            disabled={deletingResetId === item.id}
                            className="p-1.5 rounded-xl text-neutral-400 hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                            title={isAr ? 'حذف الطلب' : 'Delete'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Edit Reset Item Modal */}
          {editingResetItem && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-md animate-in fade-in duration-200">
              <div className="relative w-full max-w-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-4">
                <button
                  type="button"
                  onClick={() => setEditingResetItem(null)}
                  className="absolute top-4 right-4 rtl:right-auto rtl:left-4 p-2 rounded-full text-neutral-400 hover:text-neutral-900 dark:hover:text-white bg-neutral-100 dark:bg-neutral-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                      {isAr ? 'تحديث حالة طلب الاستعادة' : 'Update Reset Request'}
                    </h3>
                    <p className="text-xs text-neutral-500">
                      {editingResetItem.telegramFirstName || ''} {editingResetItem.telegramUsername ? `(${editingResetItem.telegramUsername})` : `(ID: ${editingResetItem.telegramUserId})`}
                    </p>
                  </div>
                </div>

                <form onSubmit={handleUpdatePasswordReset} className="space-y-4 pt-1">
                  {/* Status */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                      {isAr ? 'حالة الطلب:' : 'Request Status:'}
                    </label>
                    <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => setResetItemStatus('pending')}
                        className={`py-2 rounded-lg transition-colors cursor-pointer ${
                          resetItemStatus === 'pending'
                            ? 'bg-amber-500 text-neutral-950 shadow-xs'
                            : 'text-neutral-600 dark:text-neutral-400'
                        }`}
                      >
                        {isAr ? 'قيد الانتظار' : 'Pending'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setResetItemStatus('contacted')}
                        className={`py-2 rounded-lg transition-colors cursor-pointer ${
                          resetItemStatus === 'contacted'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-neutral-600 dark:text-neutral-400'
                        }`}
                      >
                        {isAr ? 'تم التواصل' : 'Contacted'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setResetItemStatus('resolved')}
                        className={`py-2 rounded-lg transition-colors cursor-pointer ${
                          resetItemStatus === 'resolved'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-neutral-600 dark:text-neutral-400'
                        }`}
                      >
                        {isAr ? 'تم الحل ✅' : 'Resolved'}
                      </button>
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                      {isAr ? 'ملاحظات الدعم الفني:' : 'Support Notes:'}
                    </label>
                    <textarea
                      value={resetItemAdminNotes}
                      onChange={(e) => setResetItemAdminNotes(e.target.value)}
                      rows={3}
                      placeholder={
                        isAr
                          ? 'مثال: تم التواصل معه على حساب تيليجرام وتعيين كلمة مرور جديدة مؤقتة...'
                          : 'e.g. Contacted user on Telegram, set a temporary password...'
                      }
                      className="w-full px-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:border-amber-500 resize-none"
                    />
                  </div>

                  {/* Submit */}
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setEditingResetItem(null)}
                      className="flex-1 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-bold transition-colors cursor-pointer"
                    >
                      {isAr ? 'إلغاء' : 'Cancel'}
                    </button>
                    <button
                      type="submit"
                      disabled={isUpdatingResetItem}
                      className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
                    >
                      {isUpdatingResetItem ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>{isAr ? 'جاري الحفظ...' : 'Saving...'}</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{isAr ? 'حفظ التعديل' : 'Save Changes'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 3: حالة بوت تيليجرام والرابط الديناميكي
          ========================================================================= */}
      {activeTab === 'bot' && (
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
      )}

      {/* =========================================================================
          TAB 4: قاعدة بيانات NEON (Neon Database - Serverless PostgreSQL)
          ========================================================================= */}
      {activeTab === 'database' && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                    neonStatus?.connected
                      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                  }`}
                >
                  <Database className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black text-neutral-900 dark:text-white">
                      {isAr ? 'قاعدة بيانات NEON (Neon Serverless PostgreSQL)' : 'Neon Database (Serverless PostgreSQL)'}
                    </h2>
                    <span
                      className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold inline-flex items-center gap-1 ${
                        neonStatus?.connected
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          neonStatus?.connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                        }`}
                      />
                      {neonStatus?.connected
                        ? isAr
                          ? 'متصل وحيوي بـ Neon'
                          : 'Connected & Live'
                        : isAr
                        ? 'في انتظار ضبط الرابط'
                        : 'Awaiting Connection'}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {isAr
                      ? 'قاعدة بيانات Neon السحابية تضمن حفظ الحسابات والرسائل والوكلاء وعلاقات الصداقة بشكل دائم وفوري دون فقدان'
                      : 'Neon Serverless PostgreSQL ensures permanent persistence of accounts, chats, agents, and friendships'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={handleSyncDatabase}
                  disabled={isSyncingDb || !neonStatus?.connected}
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-50 shadow-sm"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingDb ? 'animate-spin' : ''}`} />
                  <span>{isSyncingDb ? (isAr ? 'جاري المزامنة...' : 'Syncing...') : (isAr ? 'مزامنة البيانات الآن' : 'Sync Data Now')}</span>
                </button>

                <button
                  type="button"
                  onClick={handleMigrateDatabase}
                  disabled={isMigratingDb || !neonStatus?.connected}
                  className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-50 shadow-sm"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isMigratingDb ? 'animate-spin' : ''}`} />
                  <span>{isMigratingDb ? (isAr ? 'جاري الترحيل...' : 'Migrating...') : (isAr ? 'إنشاء وتحديث الجداول (1-Click)' : 'Run Migration')}</span>
                </button>

                <button
                  type="button"
                  onClick={handleTestDatabase}
                  disabled={isTestingDb}
                  className="px-4 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 text-xs font-bold transition-colors cursor-pointer flex items-center gap-2"
                >
                  <Activity className={`w-3.5 h-3.5 ${isTestingDb ? 'animate-spin' : ''}`} />
                  <span>{isAr ? 'فحص الاتصال' : 'Check Status'}</span>
                </button>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">
                <span className="text-[11px] text-neutral-500 block">
                  {isAr ? 'سرعة الاستجابة (Latency)' : 'Latency'}
                </span>
                <span className="text-base font-bold font-mono text-neutral-900 dark:text-white">
                  {neonStatus?.latencyMs ? `${neonStatus.latencyMs} ms` : '—'}
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">
                <span className="text-[11px] text-neutral-500 block">
                  {isAr ? 'حسابات المستخدمين' : 'Profiles Count'}
                </span>
                <span className="text-base font-bold font-mono text-neutral-900 dark:text-white">
                  {neonStatus?.counts?.profiles ?? users.length}
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">
                <span className="text-[11px] text-neutral-500 block">
                  {isAr ? 'الوكلاء المعتمدين النشطين' : 'Active Agents'}
                </span>
                <span className="text-base font-bold font-mono text-neutral-900 dark:text-white">
                  {neonStatus?.counts?.agents ?? agents.length}
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">
                <span className="text-[11px] text-neutral-500 block">
                  {isAr ? 'نوع المحرك وقاعدة البيانات' : 'Engine & Version'}
                </span>
                <span className="text-xs font-bold font-mono text-neutral-900 dark:text-white truncate block">
                  {neonStatus?.version?.split(',')[0]?.split('on')[0]?.trim() || 'PostgreSQL (Neon)'}
                </span>
              </div>
            </div>
          </div>

          {/* Connection Form Card */}
          <div className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 border border-amber-500/20">
                <KeyRound className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                  {isAr ? 'ضبط رابط الاتصال بقاعدة بيانات NEON (DATABASE_URL1)' : 'Neon Connection String (DATABASE_URL1)'}
                </h3>
                <p className="text-xs text-neutral-500">
                  {isAr
                    ? 'انسخ رابط الاتصال من لوحة تحكم Neon (Connection Details -> postgresql://) والصقه هنا، وسيتم تعيينه في متغير DATABASE_URL1'
                    : 'Paste connection string from Neon Console Dashboard into DATABASE_URL1'}
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveDatabaseConfig} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                  <span>{isAr ? 'رابط الاتصال الكامل (PostgreSQL Connection URI):' : 'Full Connection URI:'}</span>
                  <span className="text-[10px] text-neutral-400 font-mono">
                    postgresql://user:pass@ep-xyz.region.neon.tech/neondb?sslmode=require
                  </span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="postgresql://neondb_owner:npg_xyz@ep-cool-snowflake-123456.us-east-2.aws.neon.tech/neondb?sslmode=require"
                  value={neonDatabaseUrl}
                  onChange={(e) => setNeonDatabaseUrl(e.target.value)}
                  className="w-full p-3.5 rounded-2xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs font-mono text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                <button
                  type="submit"
                  disabled={isSavingDbConfig}
                  className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                >
                  <Database className="w-4 h-4" />
                  <span>
                    {isSavingDbConfig
                      ? isAr
                        ? 'جاري الحفظ والاختبار...'
                        : 'Saving & Connecting...'
                      : isAr
                      ? 'حفظ واختبار الربط المباشر'
                      : 'Save & Connect to Neon'}
                  </span>
                </button>

                <p className="text-[11px] text-neutral-400">
                  {isAr
                    ? '✓ يتم حفظ الرابط في متغيرات البيئة وتشغيل الاتصال فورياً مع دعم SSL تلقائي'
                    : '✓ Stored securely with pooling and auto SSL handling'}
                </p>
              </div>
            </form>
          </div>

          {/* Verified Tables & Structural Integrity */}
          <div className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>
                    {isAr
                      ? 'جداول Neon المفحوصة والمؤكدة في قاعدة البيانات (10 جداول)'
                      : 'Verified Database Tables in Neon (10 Tables)'}
                  </span>
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  {isAr
                    ? 'فحص حيوي لحالة وجود كل جدول وعدد السجلات المخزنة فيه في Neon PostgreSQL'
                    : 'Real-time verification of table existence and record counts in Neon'}
                </p>
              </div>

              <button
                type="button"
                onClick={handleMigrateDatabase}
                disabled={isMigratingDb || !neonStatus?.connected}
                className="px-3.5 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isAr ? 'تطبيق الـ Schema بضغطة زر' : 'Run Schema Migration'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                {
                  id: 'profiles',
                  name: isAr ? 'جدول المستخدمين (profiles)' : 'Profiles (profiles)',
                  desc: isAr ? 'حسابات حقيقية، أرصدة الماسات والكوينز، وتواريخ الميلاد' : 'Real accounts, wallet balances, DOB',
                  ok: neonStatus?.tables?.profiles,
                  count: neonStatus?.counts?.profiles,
                },
                {
                  id: 'agents',
                  name: isAr ? 'جدول الوكلاء (agents)' : 'Agents (agents)',
                  desc: isAr ? 'وكلاء الشحن والسحب المعتمدين مع علامة الحذف deleted_at' : 'Recharge & withdrawal agents',
                  ok: neonStatus?.tables?.agents,
                  count: neonStatus?.counts?.agents,
                },
                {
                  id: 'friends',
                  name: isAr ? 'جدول الصداقات (friends)' : 'Friendships (friends)',
                  desc: isAr ? 'علاقات الصداقة المؤكدة بين معرفات Soul-X' : 'Confirmed friendships between Soul-X IDs',
                  ok: neonStatus?.tables?.friends,
                  count: neonStatus?.counts?.friends,
                },
                {
                  id: 'friend_requests',
                  name: isAr ? 'طلبات الصداقة (friend_requests)' : 'Friend Requests (friend_requests)',
                  desc: isAr ? 'طلبات الصداقة المتبادلة وحالتها' : 'Pending and accepted friend requests',
                  ok: neonStatus?.tables?.friend_requests,
                  count: neonStatus?.counts?.friend_requests,
                },
                {
                  id: 'conversations',
                  name: isAr ? 'المحادثات (conversations)' : 'Conversations (conversations)',
                  desc: isAr ? 'غرف الدردشة الفردية والمطابقات' : 'Direct message threads and match sessions',
                  ok: neonStatus?.tables?.conversations,
                  count: neonStatus?.counts?.conversations,
                },
                {
                  id: 'messages',
                  name: isAr ? 'الرسائل الفورية (messages)' : 'Messages (messages)',
                  desc: isAr ? 'سجل الرسائل والهدايا المرسلة لحظياً' : 'Live messages, timestamps and gifts sent',
                  ok: neonStatus?.tables?.messages,
                  count: neonStatus?.counts?.messages,
                },
                {
                  id: 'agency_withdrawals',
                  name: isAr ? 'سحوبات الوكالات (agency_withdrawals)' : 'Agency Withdrawals',
                  desc: isAr ? 'طلبات تحويل وسحب أرصدة الوكلاء والعملاء' : 'Agency and user withdrawal records',
                  ok: neonStatus?.tables?.agency_withdrawals,
                  count: neonStatus?.counts?.agency_withdrawals,
                },
                {
                  id: 'agency_transactions',
                  name: isAr ? 'معاملات الوكلاء (agency_transactions)' : 'Agency Transactions',
                  desc: isAr ? 'سجل عمليات شحن الكوينز والماسات اليومية' : 'Deposit and transaction history',
                  ok: neonStatus?.tables?.agency_transactions,
                  count: neonStatus?.counts?.agency_transactions,
                },
                {
                  id: 'tombstones',
                  name: isAr ? 'شواهد المحذوفين (tombstones)' : 'Tombstones (tombstones)',
                  desc: isAr ? 'منع استرجاع أي وكيل أو مستخدم محذوف نهائياً' : 'Permanent deletion persistence ledger',
                  ok: neonStatus?.tables?.tombstones,
                  count: neonStatus?.counts?.tombstones,
                },
              ].map((tbl) => (
                <div
                  key={tbl.id}
                  className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-900 dark:text-white truncate">
                      {tbl.name}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                        tbl.ok
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {tbl.ok ? (isAr ? `مؤكد (${tbl.count ?? 0})` : `Verified (${tbl.count ?? 0})`) : (isAr ? 'في انتظار الإنشاء' : 'Pending')}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-500 leading-relaxed">{tbl.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* SQL Migration & Schema Setup Card */}
          <div className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center shrink-0 border border-cyan-500/20">
                  <FileCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                    {isAr
                      ? 'كود الـ Schema لإنشاء الجداول في Neon PostgreSQL'
                      : 'Neon PostgreSQL Schema Migration Script'}
                  </h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {isAr
                      ? 'يمكنك تشغيل الكود تلقائياً عبر زر "إنشاء وتحديث الجداول" أعلاه، أو نسخه ولصقه في Neon Console SQL Editor'
                      : 'Run directly via button above or paste into Neon Console SQL Editor'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleMigrateDatabase}
                  disabled={isMigratingDb || !neonStatus?.connected}
                  className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50 shadow-sm"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{isMigratingDb ? (isAr ? 'جاري التطبيق...' : 'Applying...') : (isAr ? 'تطبيق الكود في Neon' : 'Execute in Neon')}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyMigrationSql}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 shadow-sm ${
                    isCopiedSql
                      ? 'bg-emerald-500 text-neutral-950 font-black'
                      : 'bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200'
                  }`}
                >
                  {isCopiedSql ? <Check className="w-4 h-4 text-neutral-950" /> : <Copy className="w-4 h-4" />}
                  <span>{isCopiedSql ? (isAr ? 'تم النسخ!' : 'Copied!') : (isAr ? 'نسخ كود SQL' : 'Copy SQL')}</span>
                </button>
              </div>
            </div>

            {/* Step-by-step Execution Instructions */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-800 dark:text-neutral-200">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 inline-flex items-center justify-center text-[10px] font-mono">1</span>
                  <span>{isAr ? 'إنشاء مشروع في Neon' : '1. Create Neon Project'}</span>
                </div>
                <p className="text-[11px] text-neutral-500 leading-relaxed">
                  {isAr ? 'افتح neon.tech وأنشئ قاعدة بيانات مجانية فورية.' : 'Visit neon.tech and create a free serverless project.'}
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-800 dark:text-neutral-200">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 inline-flex items-center justify-center text-[10px] font-mono">2</span>
                  <span>{isAr ? 'نسخ Connection String' : '2. Copy Connection String'}</span>
                </div>
                <p className="text-[11px] text-neutral-500 leading-relaxed">
                  {isAr ? 'انسخ رابط postgresql:// من Dashboard والصقه في حقل الإدخال أعلاه.' : 'Copy postgresql:// URI from dashboard and save above.'}
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-800 dark:text-neutral-200">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 inline-flex items-center justify-center text-[10px] font-mono">3</span>
                  <span>{isAr ? 'تطبيق الجداول والمزامنة' : '3. Migrate & Sync'}</span>
                </div>
                <p className="text-[11px] text-neutral-500 leading-relaxed">
                  {isAr ? 'اضغط "إنشاء وتحديث الجداول" ثم "مزامنة البيانات الآن" لتجهيز كل شيء فوراً!' : 'Click Migrate and Sync to verify all tables!'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 1: Edit User Profile (Name, Email, Display ID, DOB, Gender) */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <button
              type="button"
              onClick={() => setEditingUser(null)}
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

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="flex-1 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-semibold transition-colors cursor-pointer"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingUser}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition-colors shadow-sm cursor-pointer"
                >
                  {isUpdatingUser ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ التغييرات' : 'Save Changes')}
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
      {deletingAgentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-neutral-900 dark:text-white">
              {isAr ? 'تأكيد حذف الوكيل' : 'Confirm Agent Deletion'}
            </h3>

            <p className="text-xs text-neutral-500 leading-relaxed">
              {isAr
                ? 'هل أنت متأكد من رغبتك في حذف هذا الوكيل نهائياً من شبكة وكلاء Soul-X؟ لن يظهر الوكيل بعد ذلك في المحفظة.'
                : 'Are you sure you want to permanently delete this agent? They will no longer appear in the wallet.'}
            </p>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingAgentId(null)}
                className="flex-1 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>

              <button
                type="button"
                onClick={handleConfirmDeleteAgent}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors cursor-pointer shadow-sm"
              >
                {isAr ? 'تأكيد الحذف' : 'Confirm Delete'}
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

      {/* Modal 9: Full Database Reset Confirmation */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white dark:bg-neutral-900 border border-red-500/30 rounded-3xl p-6 shadow-2xl space-y-4 text-center">
            <div className="w-14 h-14 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto border border-red-500/20">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <h3 className="text-lg font-black text-neutral-900 dark:text-white">
              {isAr ? 'تأكيد تصفير وحذف جميع بيانات الموقع' : 'Confirm Complete Database Purge'}
            </h3>

            <div className="text-xs text-neutral-500 leading-relaxed text-right space-y-2 bg-neutral-50 dark:bg-neutral-950 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800">
              <p className="font-semibold text-red-600 dark:text-red-400">
                {isAr
                  ? '⚠️ تحذير شديد الأهمية: هذا الإجراء سيقوم بما يلي:'
                  : '⚠️ Warning: This action will permanently execute:'}
              </p>
              <ul className="list-disc list-inside space-y-1 text-neutral-600 dark:text-neutral-400">
                <li>{isAr ? 'حذف كافة الحسابات من جدول profiles وقاعدة بيانات Supabase' : 'Purge all profiles and auth users from Supabase'}</li>
                <li>{isAr ? 'حذف كافة المحادثات والرسائل وقوائم الأصدقاء بالكامل' : 'Purge all conversations, messages, and friend relationships'}</li>
                <li>{isAr ? 'حذف ملفات الصور الشخصية من حاوية soul-x' : 'Purge avatar storage in soul-x bucket'}</li>
                <li>{isAr ? 'إعادة تهيئة النظام لربط وحفظ المستخدمين الجدد حصراً في Supabase' : 'Bind fresh to Supabase for newly created accounts'}</li>
              </ul>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                disabled={isResetting}
                onClick={() => setIsResetModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                {isAr ? 'إلغاء وتراجع' : 'Cancel'}
              </button>

              <button
                type="button"
                disabled={isResetting}
                onClick={handleResetDatabase}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
              >
                {isResetting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{isAr ? 'جاري التصفير...' : 'Purging...'}</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isAr ? 'نعم، احذف وصفر الكل' : 'Yes, Purge Everything'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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
                  {isAr ? 'عنوان الإشعار *' : 'Title *'}
                </label>
                <input
                  type="text"
                  value={directNotifyTitleAr}
                  onChange={(e) => setDirectNotifyTitleAr(e.target.value)}
                  placeholder={isAr ? 'مثال: 🛡️ إشعار إداري رسمي من إدارة Soul-X' : 'Notification title...'}
                  className="w-full text-xs px-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white focus:outline-none focus:border-cyan-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300">
                    {isAr ? 'الأهمية:' : 'Priority:'}
                  </label>
                  <select
                    value={directNotifyPriority}
                    onChange={(e: any) => setDirectNotifyPriority(e.target.value)}
                    className="w-full text-xs px-2.5 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white focus:outline-none focus:border-cyan-500 font-medium"
                  >
                    <option value="normal">{isAr ? 'عادي (Normal)' : 'Normal'}</option>
                    <option value="important">{isAr ? '⭐ هام (Important)' : 'Important'}</option>
                    <option value="urgent">{isAr ? '🔴 عاجل (Urgent)' : 'Urgent'}</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300">
                    {isAr ? 'التصنيف:' : 'Category:'}
                  </label>
                  <select
                    value={directNotifyCategory}
                    onChange={(e: any) => setDirectNotifyCategory(e.target.value)}
                    className="w-full text-xs px-2.5 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white focus:outline-none focus:border-cyan-500 font-medium"
                  >
                    <option value="custom">{isAr ? '✉️ رسالة خاصة' : 'Custom Note'}</option>
                    <option value="warning">{isAr ? '⚠️ تنبيه ومخالفة' : 'Warning'}</option>
                    <option value="reward">{isAr ? '🎁 مكافأة وتكريم' : 'Reward'}</option>
                    <option value="announcement">{isAr ? '📢 إشعار رسمي' : 'Official Notice'}</option>
                  </select>
                </div>
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
    </div>
  );
};
