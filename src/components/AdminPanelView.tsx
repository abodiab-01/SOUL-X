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
} from 'lucide-react';
import { Language, AuthUser, AgentRecord } from '../types';

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
  walletBalance?: number;
  coinsBalance?: number;
}

const COUNTRY_PRESETS = [
  { name: 'السعودية والخليج', flag: '🇸🇦' },
  { name: 'مصر', flag: '🇪🇬' },
  { name: 'العراق', flag: '🇮🇶' },
  { name: 'الإمارات', flag: '🇦🇪' },
  { name: 'الكويت', flag: '🇰🇼' },
  { name: 'قطر', flag: '🇶🇦' },
  { name: 'الأردن', flag: '🇯🇴' },
  { name: 'المغرب', flag: '🇲🇦' },
  { name: 'الجزائر', flag: '🇩🇿' },
  { name: 'تونس', flag: '🇹🇳' },
  { name: 'لبنان', flag: '🇱🇧' },
  { name: 'تركيا', flag: '🇹🇷' },
  { name: 'عالمي / دولي (USDT)', flag: '🌐' },
];

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
  const [supabaseStatus, setSupabaseStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Active top navigation tab
  const [activeTab, setActiveTab] = useState<'users' | 'agents' | 'bot'>('users');

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
  // 1. Add Agent Modal
  const [isAddAgentModalOpen, setIsAddAgentModalOpen] = useState(false);
  const [agentGridCode, setAgentGridCode] = useState('A8838');
  const [agentEmail, setAgentEmail] = useState('');
  const [agentName, setAgentName] = useState('');
  const [agentCountry, setAgentCountry] = useState('السعودية والخليج');
  const [agentFlag, setAgentFlag] = useState('🇸🇦');
  const [agentBalance, setAgentBalance] = useState<string>('50000');
  const [agentCategory, setAgentCategory] = useState<'recharge' | 'withdraw' | 'both'>('both');
  const [agentWhatsapp, setAgentWhatsapp] = useState('');
  const [agentTelegram, setAgentTelegram] = useState('');
  const [agentMethods, setAgentMethods] = useState('STC Pay, تحويل بنكي, مدى, Apple Pay');
  const [agentRateNote, setAgentRateNote] = useState('1,000 ماسة = 40 ر.س | تنفيذ فوري ومضمون');
  const [isCreatingAgent, setIsCreatingAgent] = useState(false);
  const [appointingUserId, setAppointingUserId] = useState<string | null>(null);

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

  // Helper for admin headers to ensure authentication works seamlessly with both session tokens and PINs
  const getAdminHeaders = () => {
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (adminToken) {
      h['Authorization'] = `Bearer ${adminToken}`;
      h['x-admin-pin'] = adminToken;
    }
    return h;
  };

  // Fetch all admin data
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const headers = getAdminHeaders();

      const [statsRes, usersRes, agentsRes, supaRes] = await Promise.all([
        fetch('/api/admin/stats', { headers }),
        fetch('/api/admin/users', { headers }),
        fetch('/api/admin/agents', { headers }),
        fetch('/api/supabase/status').catch(() => null),
      ]);

      if (statsRes.status === 403 || usersRes.status === 403) {
        onLock();
        return;
      }

      const statsData = await statsRes.json();
      const usersData = await usersRes.json();
      const agentsData = await agentsRes.json();

      if (supaRes) {
        const supaData = await supaRes.json();
        setSupabaseStatus(supaData);
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
  const handleOpenAddAgent = () => {
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    setAgentGridCode(`A${randomDigits}`);
    setAgentEmail('');
    setAgentName('');
    setAgentCountry('السعودية والخليج');
    setAgentFlag('🇸🇦');
    setAgentBalance('50000');
    setAgentCategory('both');
    setAgentWhatsapp('');
    setAgentTelegram('');
    setAgentMethods('STC Pay, تحويل بنكي, مدى, Apple Pay');
    setAgentRateNote('1,000 ماسة = 40 ر.س | تنفيذ فوري ومضمون');
    setIsAddAgentModalOpen(true);
  };

  const handleSubmitAddAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentEmail || !agentCountry) {
      showToast('error', isAr ? 'البريد الإلكتروني والدولة مطلوبان' : 'Email and Country are required');
      return;
    }

    setIsCreatingAgent(true);
    try {
      const res = await fetch('/api/admin/create-agent', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          gridCode: agentGridCode.trim() || undefined,
          email: agentEmail,
          name: agentName,
          country: agentCountry,
          flag: agentFlag,
          balance: parseFloat(agentBalance) || 0,
          category: agentCategory,
          whatsapp: agentWhatsapp,
          telegram: agentTelegram,
          methods: agentMethods,
          rateNote: agentRateNote,
        }),
      });

      const data = await res.json();
      if (data.success && data.agent) {
        showToast('success', data.message || (isAr ? 'تمت إضافة الوكيل وتثبيته في قاعدة البيانات بنجاح' : 'Agent added successfully'));
        setAgents((prev) => [data.agent, ...prev.filter((a) => a.id !== data.agent.id && a.email.toLowerCase() !== data.agent.email.toLowerCase())]);
        setIsAddAgentModalOpen(false);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('soulx:agents-updated'));
        }
      } else {
        showToast('error', data.message || 'فشل إضافة الوكيل');
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

  const handleAppointUserAsAgent = async (user: AdminUserRecord) => {
    setAppointingUserId(user.id);
    try {
      const res = await fetch('/api/admin/appoint-user-agent', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
          name: user.name || 'وكيل شحن معتمد',
          initialBalance: 50000,
        }),
      });
      const data = await res.json();
      if (data.success && data.agent) {
        showToast(
          'success',
          data.message ||
            (isAr
              ? `تم تعيين ${user.name || user.email} كوكيل شحن بنجاح برقم القريد ${data.agent.gridCode}`
              : `User appointed as agent with Grid ID ${data.agent.gridCode}`)
        );
        setAgents((prev) => [
          data.agent,
          ...prev.filter(
            (a) => a.id !== data.agent.id && a.email.toLowerCase() !== data.agent.email.toLowerCase()
          ),
        ]);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('soulx:agents-updated'));
        }
      } else {
        showToast('error', data.message || 'فشل تعيين الوكيل');
      }
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setAppointingUserId(null);
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
        setAgents((prev) => prev.filter((a) => a.id !== deletingAgentId && a.email !== deletingAgentId));
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
  const totalUsersBalance = users.reduce((acc, u) => acc + (typeof u.walletBalance === 'number' ? u.walletBalance : 1250), 0);
  const totalUsersCoins = users.reduce((acc, u) => acc + (typeof u.coinsBalance === 'number' ? u.coinsBalance : 25000), 0);

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
          <div className="text-[10px] text-cyan-600 dark:text-cyan-400 font-bold font-mono truncate">
            {isAr
              ? `💎 ${totalUsersBalance.toLocaleString()} • 🪙 ${totalUsersCoins.toLocaleString()}`
              : `💎 ${totalUsersBalance.toLocaleString()} • 🪙 ${totalUsersCoins.toLocaleString()}`}
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
          <div className="text-[10px] text-neutral-400">
            {isAr ? `إجمالي الأرصدة: ${totalAgentsBalance.toLocaleString()} 💎` : `Total: ${totalAgentsBalance.toLocaleString()} 💎`}
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
              {filteredUsers.map((u) => (
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
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-bold">
                          ID: {u.displayId || u.id}
                        </span>

                        {/* Diamonds Balance Badge (Clickable for instant edit) */}
                        <button
                          type="button"
                          onClick={() => handleOpenBalanceModal(u, 'diamonds')}
                          title={isAr ? 'تعديل رصيد الماسات 💎 (إضافة / خصم / تعيين)' : 'Modify diamonds balance 💎'}
                          className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 font-bold transition-colors cursor-pointer"
                        >
                          <Sparkles className="w-3 h-3 text-cyan-500" />
                          <span>{(typeof u.walletBalance === 'number' ? u.walletBalance : 1250).toLocaleString()} 💎</span>
                        </button>

                        {/* Coins Balance Badge (Clickable for instant edit) */}
                        <button
                          type="button"
                          onClick={() => handleOpenBalanceModal(u, 'coins')}
                          title={isAr ? 'تعديل رصيد الكوينز 🪙 (إضافة / خصم / تعيين)' : 'Modify coins balance 🪙'}
                          className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-bold transition-colors cursor-pointer"
                        >
                          <Coins className="w-3 h-3 text-amber-500" />
                          <span>{(typeof u.coinsBalance === 'number' ? u.coinsBalance : 25000).toLocaleString()} 🪙</span>
                        </button>

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
                        <span>
                          {isAr ? 'التسجيل:' : 'Joined:'} {new Date(u.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* User Action Buttons */}
                  <div className="flex items-center gap-2 self-end md:self-center shrink-0 flex-wrap">
                    {/* 0. Appoint / Agent Badge */}
                    {(() => {
                      const existingAgent = agents.find(
                        (a) => a.email.toLowerCase() === u.email.toLowerCase()
                      );
                      if (existingAgent) {
                        return (
                          <span
                            className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold flex items-center gap-1.5 shadow-xs"
                            title={isAr ? `وكيل شحن معتمد (قريد: ${existingAgent.gridCode || 'A8838'})` : `Agent (Grid: ${existingAgent.gridCode || 'A8838'})`}
                          >
                            <Building2 className="w-3.5 h-3.5" />
                            <span>{isAr ? `وكيل (${existingAgent.gridCode || 'A8838'})` : `Agent (${existingAgent.gridCode || 'A8838'})`}</span>
                          </span>
                        );
                      }
                      return (
                        <button
                          type="button"
                          onClick={() => handleAppointUserAsAgent(u)}
                          disabled={appointingUserId === u.id}
                          className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                          title={isAr ? 'تعيين هذا المستخدم كوكيل شحن معتمد مع توليد رقم قريد' : 'Appoint as recharge agent'}
                        >
                          <Building2 className="w-3.5 h-3.5" />
                          <span>
                            {appointingUserId === u.id
                              ? isAr ? 'جاري التعيين...' : 'Assigning...'
                              : isAr ? 'تعيين كوكيل شحن' : 'Appoint Agent'}
                          </span>
                        </button>
                      );
                    })()}

                    {/* 1. Modify Balance Button */}
                    <button
                      type="button"
                      onClick={() => handleOpenBalanceModal(u)}
                      className="px-2.5 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title={isAr ? 'تعديل رصيد المستخدم (إضافة أو خصم)' : 'Modify Balance'}
                    >
                      <Coins className="w-3.5 h-3.5" />
                      <span>{isAr ? 'الرصيد' : 'Balance'}</span>
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
              ))}
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
              onClick={handleOpenAddAgent}
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
                        <span className="text-neutral-500">{isAr ? 'رصيد الوكيل المتاح:' : 'Available Balance:'}</span>
                        <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-sm">
                          {(agent.balance || 0).toLocaleString()} 💎
                        </span>
                      </div>
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
          MODALS
          ========================================================================= */}

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
                  {isAr ? 'تعديل وإدارة رصيد الحساب' : 'Modify Account Balance'}
                </h3>
                <p className="text-xs text-neutral-500">
                  {balanceUser.name} • {isAr ? 'الرصيد الحالي:' : 'Current:'}{' '}
                  {userBalanceCurrency === 'coins' ? (
                    <span className="font-mono font-bold text-amber-500">
                      {(balanceUser.coinsBalance ?? 25000).toLocaleString()} 🪙
                    </span>
                  ) : (
                    <span className="font-mono font-bold text-cyan-500">
                      {(balanceUser.walletBalance ?? 1250).toLocaleString()} 💎
                    </span>
                  )}
                </p>
              </div>
            </div>

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
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isAr ? 'الماسات (Diamonds) 💎' : 'Diamonds 💎'}</span>
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
                <Coins className="w-3.5 h-3.5" />
                <span>{isAr ? 'الكوينز (Coins) 🪙' : 'Coins 🪙'}</span>
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
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  {userBalanceCurrency === 'coins'
                    ? (isAr ? 'القيمة المطلوبة (بالكوينز 🪙):' : 'Amount in Coins 🪙:')
                    : (isAr ? 'القيمة المطلوبة (بالماسات 💎):' : 'Amount in Diamonds 💎:')}
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
                <span className={`font-mono font-bold text-sm ${userBalanceCurrency === 'coins' ? 'text-amber-500' : 'text-cyan-600 dark:text-cyan-400'}`}>
                  {(() => {
                    const current = userBalanceCurrency === 'coins'
                      ? (balanceUser.coinsBalance ?? 25000)
                      : (balanceUser.walletBalance ?? 1250);
                    const val = parseFloat(userBalanceAmount) || 0;
                    if (userBalanceAction === 'add') return (current + val).toLocaleString();
                    if (userBalanceAction === 'deduct') return Math.max(0, current - val).toLocaleString();
                    return Math.max(0, val).toLocaleString();
                  })()}{' '}
                  {userBalanceCurrency === 'coins' ? '🪙' : '💎'}
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
                    : (isAr ? `تأكيد عملية ${userBalanceCurrency === 'coins' ? 'الكوينز 🪙' : 'الماسات 💎'}` : 'Confirm Update')}
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

            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-amber-500" />
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                  {isAr ? 'تعيين وإضافة وكيل معتمد جديد' : 'Assign & Add Certified Agent'}
                </h3>
                <p className="text-xs text-neutral-500">
                  {isAr ? 'يتم تعيين الوكيل بالبريد الإلكتروني للظهور في المحفظة' : 'Assign agent by email to display in wallet'}
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmitAddAgent} className="space-y-3 pt-2">
              {/* Agent Grid ID (رقم القريد) */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                  <span>{isAr ? 'رقم القريد للوكيل (Grid ID):' : 'Agent Grid ID:'}</span>
                  <span className="text-[10px] text-amber-500 font-mono">مثال: A8838</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={agentGridCode}
                    onChange={(e) => setAgentGridCode(e.target.value.toUpperCase())}
                    placeholder="A8838"
                    className="flex-1 p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs font-mono font-bold text-amber-500 focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setAgentGridCode('A' + Math.floor(1000 + Math.random() * 9000))}
                    className="px-3 py-2 rounded-xl bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs font-bold hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
                  >
                    {isAr ? 'توليد جديد' : 'Generate'}
                  </button>
                </div>
              </div>

              {/* Agent Email (Core Requirement) */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                  <span>{isAr ? 'البريد الإلكتروني للوكيل المعين:' : 'Agent Email Address:'}</span>
                  <span className="text-[10px] text-amber-500 font-bold">{isAr ? 'مطلوب للربط' : 'Required'}</span>
                </label>
                <input
                  type="email"
                  required
                  value={agentEmail}
                  onChange={(e) => setAgentEmail(e.target.value)}
                  placeholder="agent@example.com"
                  className="w-full p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              {/* Agent Name */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  {isAr ? 'اسم الوكيل أو الوكالة:' : 'Agent / Agency Name:'}
                </label>
                <input
                  type="text"
                  required
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="مثال: وكالة الرياض السريعة للشحن"
                  className="w-full p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Country & Flag Quick Presets */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  {isAr ? 'تعيين دولة الوكيل:' : 'Select Country:'}
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">
                  {COUNTRY_PRESETS.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => {
                        setAgentCountry(c.name);
                        setAgentFlag(c.flag);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                        agentCountry === c.name
                          ? 'bg-amber-500 text-neutral-950 font-bold'
                          : 'bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border border-neutral-200/50 dark:border-neutral-800'
                      }`}
                    >
                      <span>{c.flag}</span>
                      <span>{c.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Country custom input and Flag */}
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    {isAr ? 'اسم الدولة:' : 'Country Name:'}
                  </label>
                  <input
                    type="text"
                    required
                    value={agentCountry}
                    onChange={(e) => setAgentCountry(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    {isAr ? 'العلم (Flag):' : 'Flag Emoji:'}
                  </label>
                  <input
                    type="text"
                    value={agentFlag}
                    onChange={(e) => setAgentFlag(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white text-center focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Initial Balance & Category */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    {isAr ? 'رصيد الوكيل الأولي (ماسات):' : 'Initial Balance (Diamonds):'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={agentBalance}
                    onChange={(e) => setAgentBalance(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs font-mono font-bold text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    {isAr ? 'نوع الخدمة:' : 'Service Category:'}
                  </label>
                  <select
                    value={agentCategory}
                    onChange={(e) => setAgentCategory(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="both">{isAr ? 'إيداع وسحب (كلاهما)' : 'Both Deposit & Cashout'}</option>
                    <option value="recharge">{isAr ? 'إيداع وشحن فقط' : 'Deposit only'}</option>
                    <option value="withdraw">{isAr ? 'سحب فقط' : 'Withdraw only'}</option>
                  </select>
                </div>
              </div>

              {/* Contact Channels (WhatsApp & Telegram for messaging) */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    {isAr ? 'رقم الواتساب (WhatsApp):' : 'WhatsApp Number:'}
                  </label>
                  <input
                    type="text"
                    value={agentWhatsapp}
                    onChange={(e) => setAgentWhatsapp(e.target.value)}
                    placeholder="+966500000000"
                    className="w-full p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs font-mono text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    {isAr ? 'معرف تيليجرام (Telegram):' : 'Telegram Handle:'}
                  </label>
                  <input
                    type="text"
                    value={agentTelegram}
                    onChange={(e) => setAgentTelegram(e.target.value)}
                    placeholder="Agent_SoulX"
                    className="w-full p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs font-mono text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Supported Payment Methods */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  {isAr ? 'طرق الدفع (مفصولة بفاصلة):' : 'Payment methods (comma separated):'}
                </label>
                <input
                  type="text"
                  value={agentMethods}
                  onChange={(e) => setAgentMethods(e.target.value)}
                  placeholder="STC Pay, Urpay, تحويل بنكي, مدى, Apple Pay"
                  className="w-full p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Rate Note */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  {isAr ? 'ملاحظة سعر الصرف والعمولة:' : 'Rate Note:'}
                </label>
                <input
                  type="text"
                  value={agentRateNote}
                  onChange={(e) => setAgentRateNote(e.target.value)}
                  placeholder="1,000 ماسة = 40 ر.س | سحب فوري بدون عمولة"
                  className="w-full p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddAgentModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-semibold transition-colors cursor-pointer"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isCreatingAgent}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition-colors shadow-sm cursor-pointer"
                >
                  {isCreatingAgent ? (isAr ? 'جاري الإضافة...' : 'Adding...') : (isAr ? 'حفظ وتعيين الوكيل' : 'Save & Assign Agent')}
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

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    {isAr ? 'الدولة:' : 'Country:'}
                  </label>
                  <input
                    type="text"
                    required
                    value={editingAgent.country}
                    onChange={(e) => setEditingAgent({ ...editingAgent, country: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    {isAr ? 'العلم:' : 'Flag:'}
                  </label>
                  <input
                    type="text"
                    value={editingAgent.flag}
                    onChange={(e) => setEditingAgent({ ...editingAgent, flag: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white text-center focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    {isAr ? 'نوع الخدمة:' : 'Category:'}
                  </label>
                  <select
                    value={editingAgent.category}
                    onChange={(e) => setEditingAgent({ ...editingAgent, category: e.target.value as any })}
                    className="w-full p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="both">{isAr ? 'إيداع وسحب' : 'Both'}</option>
                    <option value="recharge">{isAr ? 'إيداع فقط' : 'Deposit only'}</option>
                    <option value="withdraw">{isAr ? 'سحب فقط' : 'Withdraw only'}</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    {isAr ? 'الحالة:' : 'Status:'}
                  </label>
                  <select
                    value={editingAgent.status || 'active'}
                    onChange={(e) => setEditingAgent({ ...editingAgent, status: e.target.value as any })}
                    className="w-full p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="active">{isAr ? 'نشط' : 'Active'}</option>
                    <option value="suspended">{isAr ? 'معلق / غير نشط' : 'Suspended'}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    {isAr ? 'واتساب:' : 'WhatsApp:'}
                  </label>
                  <input
                    type="text"
                    value={editingAgent.whatsapp || ''}
                    onChange={(e) => setEditingAgent({ ...editingAgent, whatsapp: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs font-mono text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    {isAr ? 'تيليجرام:' : 'Telegram:'}
                  </label>
                  <input
                    type="text"
                    value={editingAgent.telegram || ''}
                    onChange={(e) => setEditingAgent({ ...editingAgent, telegram: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs font-mono text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  {isAr ? 'طرق الدفع (مفصولة بفاصلة):' : 'Payment Methods:'}
                </label>
                <input
                  type="text"
                  value={Array.isArray(editingAgent.methods) ? editingAgent.methods.join(', ') : ''}
                  onChange={(e) =>
                    setEditingAgent({
                      ...editingAgent,
                      methods: e.target.value.split(',').map((m) => m.trim()).filter(Boolean),
                    })
                  }
                  className="w-full p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
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

            <div className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-amber-500" />
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                  {isAr ? 'تعديل رصيد الوكيل' : 'Modify Agent Balance'}
                </h3>
                <p className="text-xs text-neutral-500">
                  {balanceAgent.name} • {isAr ? 'الرصيد الحالي:' : 'Current Balance:'} {(balanceAgent.balance || 0).toLocaleString()} 💎
                </p>
              </div>
            </div>

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
                <span className="font-mono font-bold text-sm text-amber-600 dark:text-amber-400">
                  {(() => {
                    const current = balanceAgent.balance || 0;
                    const val = parseFloat(agentBalanceAmount) || 0;
                    if (agentBalanceAction === 'add') return (current + val).toLocaleString();
                    if (agentBalanceAction === 'deduct') return Math.max(0, current - val).toLocaleString();
                    return Math.max(0, val).toLocaleString();
                  })()}{' '}
                  💎
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
    </div>
  );
};
