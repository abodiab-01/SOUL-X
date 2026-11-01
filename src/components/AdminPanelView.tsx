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
} from 'lucide-react';
import { Language, AuthUser } from '../types';

interface AdminPanelViewProps {
  lang: Language;
  currentUser: AuthUser | null;
  adminToken: string;
  onBack: () => void;
  onLock: () => void;
}

interface AdminStats {
  registeredUsersCount: number;
  admins: string[];
  botConfigured: boolean;
  botPublicUrl: string | null;
  isTunnelActive: boolean;
  uptimeSeconds: number;
  serverTime: string;
}

interface AdminUserRecord {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  birthDate: string | null;
  gender: 'male' | 'female' | null;
  photoUrl: string | null;
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
  const [supabaseStatus, setSupabaseStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userSearch, setUserSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'users' | 'bot' | 'security'>('users');

  // Edit user state
  const [editingUser, setEditingUser] = useState<AdminUserRecord | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editBirthDate, setEditBirthDate] = useState('');
  const [editGender, setEditGender] = useState<'male' | 'female' | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Delete user state
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  // Toast feedback
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const showToast = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 3000);
  };

  // Fetch stats and users with admin authorization
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const headers = {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      };

      const [statsRes, usersRes, supaRes] = await Promise.all([
        fetch('/api/admin/stats', { headers }),
        fetch('/api/admin/users', { headers }),
        fetch('/api/supabase/status').catch(() => null),
      ]);

      if (statsRes.status === 403 || usersRes.status === 403) {
        onLock();
        return;
      }

      const statsData = await statsRes.json();
      const usersData = await usersRes.json();
      if (supaRes) {
        const supaData = await supaRes.json();
        setSupabaseStatus(supaData);
      }

      if (statsData.success) setStats(statsData.stats);
      if (usersData.success) setUsers(usersData.users);
    } catch (err: any) {
      showToast('error', err.message || 'خطأ في جلب بيانات لوحة التحكم');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [adminToken]);

  // Handle Edit User
  const handleOpenEdit = (user: AdminUserRecord) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditBirthDate(user.birthDate || '');
    setEditGender(user.gender);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setIsUpdating(true);
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
          birthDate: editBirthDate || null,
          gender: editGender,
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast('success', isAr ? 'تم تحديث بيانات المستخدم بنجاح' : 'User updated successfully');
        setUsers((prev) =>
          prev.map((u) =>
            u.id === editingUser.id
              ? {
                  ...u,
                  name: editName,
                  email: editEmail,
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
      setIsUpdating(false);
    }
  };

  // Handle Delete User
  const handleConfirmDelete = async () => {
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
        setUsers((prev) => prev.filter((u) => u.id !== deletingUserId));
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

  // Filter users by search
  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.id.includes(userSearch)
  );

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
            className="p-1 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-800"
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
            className="p-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
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

      {/* Supabase Database Connection Status Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 border border-emerald-500/20">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-neutral-900 dark:text-white">
                {isAr ? 'قاعدة بيانات Supabase المباشرة' : 'Live Supabase Database'}
              </span>
              {supabaseStatus?.configured ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/30">
                  {supabaseStatus.databaseConnected
                    ? (isAr ? 'متصلة وفعلية (Live)' : 'Connected & Active')
                    : (isAr ? 'مضبوطة في البيئة' : 'Configured in Env')}
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/30">
                  {isAr ? 'وضع التخزين الاحتياطي (Local Fallback)' : 'Local Fallback Mode'}
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-500 mt-0.5 font-mono">
              {supabaseStatus?.configured
                ? `${supabaseStatus.supabaseUrl || 'Connected'} // Tables: profiles, friends, messages, conversations // Bucket: soul-x`
                : (isAr ? 'لم يتم العثور على SUPABASE_URL في متغيرات البيئة (.env)' : 'SUPABASE_URL not configured in environment')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs self-end sm:self-center">
          <span className="text-neutral-400">
            {supabaseStatus?.profilesTableReady
              ? (isAr ? `الحسابات الفعلية: ${supabaseStatus.profilesCount}` : `Active Profiles: ${supabaseStatus.profilesCount}`)
              : ''}
          </span>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Users */}
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-semibold">{isAr ? 'المستخدمين المسجلين' : 'Registered Users'}</span>
            <Users className="w-4 h-4 text-cyan-500" />
          </div>
          <div className="text-2xl font-black text-neutral-900 dark:text-white font-mono">
            {stats?.registeredUsersCount ?? users.length}
          </div>
          <div className="text-[10px] text-neutral-400">
            {isAr ? 'في قاعدة بيانات Soul-X' : 'In Soul-X Database'}
          </div>
        </div>

        {/* Telegram Bot Status */}
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-2">
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
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-2">
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

        {/* Admin Accounts */}
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-semibold">{isAr ? 'المديرين المصرحين' : 'Authorized Admins'}</span>
            <ShieldAlert className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
            {stats?.admins.length || 2}
          </div>
          <div className="text-[10px] text-neutral-400 truncate">
            ADMIN1 & ADMIN2
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-neutral-200 dark:border-neutral-800 gap-3">
        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
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

        <button
          type="button"
          onClick={() => setActiveTab('bot')}
          className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'bot'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400'
              : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <Bot className="w-4 h-4" />
          <span>{isAr ? 'حالة البوت والربط' : 'Bot & Dynamic Link'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('security')}
          className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'security'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400'
              : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>{isAr ? 'الأمان والصلاحيات' : 'Security & PIN'}</span>
        </button>
      </div>

      {/* Tab 1: Users Management */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Search Box */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-neutral-400 absolute right-3.5 top-1/2 -translate-y-1/2 rtl:right-3.5 rtl:left-auto ltr:left-3.5 ltr:right-auto" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder={isAr ? 'بحث بالاسم أو البريد أو المعرف...' : 'Search by name, email, or ID...'}
                className="w-full py-2.5 px-9 text-xs sm:text-sm rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 focus:border-amber-500 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none"
              />
            </div>

            <div className="text-xs text-neutral-500 self-center">
              {isAr ? `إجمالي النتائج: ${filteredUsers.length}` : `Total results: ${filteredUsers.length}`}
            </div>
          </div>

          {/* Users List / Table */}
          {filteredUsers.length === 0 ? (
            <div className="py-16 text-center space-y-2 bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800">
              <Users className="w-8 h-8 text-neutral-400 mx-auto" />
              <p className="text-xs text-neutral-500">
                {isAr ? 'لا يوجد مستخدمين يطابقون البحث' : 'No users match your search'}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredUsers.map((u) => (
                <div
                  key={u.id}
                  className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-amber-500/40 transition-colors shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-cyan-600 to-neutral-900 text-white font-bold text-sm flex items-center justify-center shrink-0 border border-neutral-200 dark:border-neutral-700">
                      {u.photoUrl ? (
                        <img src={u.photoUrl} alt={u.name} className="w-full h-full object-cover rounded-full" />
                      ) : (
                        u.name.substring(0, 2)
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-neutral-900 dark:text-white truncate">
                          {u.name}
                        </span>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                          ID: {u.id}
                        </span>
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

                      <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                        <span>{u.email}</span>
                        {u.birthDate && <span className="mx-2">• {u.birthDate}</span>}
                        <span className="mx-2">• {new Date(u.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Edit and Delete Buttons */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(u)}
                      className="p-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
                      title={isAr ? 'تعديل بيانات المستخدم' : 'Edit User'}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>

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

      {/* Tab 2: Bot & Dynamic Link */}
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

      {/* Tab 3: Security & PIN */}
      {activeTab === 'security' && (
        <div className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-neutral-100 dark:border-neutral-800">
            <Lock className="w-5 h-5 text-amber-500" />
            <h3 className="text-base font-bold text-neutral-900 dark:text-white">
              {isAr ? 'إعدادات الأمان وحماية مسارات الإدارة' : 'Security & PIN Protection'}
            </h3>
          </div>

          <div className="space-y-3 text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
            <p>
              {isAr
                ? 'يتم تحديد مديري لوحة التحكم حصرياً عبر متغيرات البيئة:'
                : 'Admin dashboard managers are strictly defined via environment variables:'}
            </p>

            <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 font-mono space-y-1">
              <div>ADMIN1 = {stats?.admins[0] || (isAr ? '(غير محدد في البيئة)' : '(Not configured in ADMIN1)')}</div>
              <div>ADMIN2 = {stats?.admins[1] || (isAr ? '(غير محدد في البيئة)' : '(Not configured in ADMIN2)')}</div>
              <div>ADMIN_PIN = •••• ({isAr ? 'محدد في البيئة ومحمٍ في السيرفر' : 'Configured in env & secured'})</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-amber-500" />
              <span>
                {isAr
                  ? 'جميع مسارات الخادم الإدارية (/api/admin/*) لا يمكن استدعاؤها إلا بتمرير رمز ADMIN_PIN الصحيح.'
                  : 'All server admin endpoints (/api/admin/*) require valid ADMIN_PIN verification.'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit User */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <button
              type="button"
              onClick={() => setEditingUser(null)}
              className="absolute top-4 right-4 p-2 rounded-full text-neutral-400 hover:text-neutral-900 dark:hover:text-white bg-neutral-100 dark:bg-neutral-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-base font-bold text-neutral-900 dark:text-white">
              {isAr ? 'تعديل بيانات المستخدم' : 'Edit User Profile'}
            </h3>

            <form onSubmit={handleSaveEdit} className="space-y-3 pt-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  {isAr ? 'الاسم الكامل:' : 'Full Name:'}
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
                  {isAr ? 'البريد الإلكتروني:' : 'Email Address:'}
                </label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500"
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

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="flex-1 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-semibold transition-colors"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition-colors shadow-sm"
                >
                  {isUpdating ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ التغييرات' : 'Save Changes')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Delete User Confirmation */}
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
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors cursor-pointer shadow-sm"
              >
                {isAr ? 'تأكيد الحذف' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
