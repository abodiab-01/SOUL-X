import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ShieldCheck,
  Users,
  MessageSquareOff,
  Sparkles,
  Activity,
  Eye,
  Trash2,
  RefreshCw,
  Lock,
  Search,
  KeyRound,
  Mail,
  Calendar,
  Clock,
  Globe,
  UserCheck,
  Ban,
  Snowflake,
  Image as ImageIcon,
  Mic,
  Gift,
  Download,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  AlertTriangle,
  X,
  ArrowRight,
  ArrowLeft,
  ShieldAlert,
} from 'lucide-react';
import { Language } from '../types';
import { getStoredAuthToken, getStoredRefreshToken } from '../lib/authStorage';
import { getDefaultAvatar } from '../lib/avatar';
import { ImageLightboxModal } from './ImageLightboxModal';
import { CoinIcon, DiamondIcon } from './CurrencyIcons';
import { VerifiedBadge } from './VerifiedBadge';

type SupremeTab = 'users' | 'deleted-chats' | 'matches' | 'user-logs' | 'admin2-logs';

interface SupremeUserRecord {
  id: string;
  displayId: string;
  name: string;
  email: string;
  hasPasswordHash: boolean;
  passwordHashFingerprint: string | null;
  role: 'ADMIN1' | 'ADMIN2' | 'USER';
  photoUrl: string | null;
  birthDate: string | null;
  gender: string | null;
  country: string | null;
  bio: string | null;
  walletBalance: number;
  coinsBalance: number;
  isVerified: boolean;
  isBanned: boolean;
  banReason: string | null;
  bannedAt: string | null;
  isFrozen: boolean;
  freezeReason: string | null;
  freezeExpiresAt: string | null;
  twoFactorEnabled: boolean;
  twoFactorEnabledAt: string | null;
  createdAt: string;
  updatedAt: string | null;
}

interface SupremeDeletedChatMessage {
  id: string;
  senderId: string;
  senderEmail?: string;
  senderName?: string;
  text: string;
  mediaType?: 'image' | 'audio' | 'text';
  mediaUrl?: string;
  hasArchivedMedia?: boolean;
  audioDuration?: number;
  isGift?: boolean;
  giftIcon?: string;
  giftName?: string;
  giftCost?: number;
  createdAt: string;
}

interface SupremeDeletedChat {
  id: string;
  conversationId: string;
  senderId: string;
  senderDisplayId?: string;
  senderEmail: string;
  senderName: string;
  senderAvatar?: string;
  receiverId: string;
  receiverDisplayId?: string;
  receiverEmail: string;
  receiverName: string;
  receiverAvatar?: string;
  deletedByUserId?: string;
  deletedByEmail?: string;
  deletedByName?: string;
  deletedAt: string;
  createdAt?: string;
  messages: SupremeDeletedChatMessage[];
  mediaCount: number;
}

interface SupremeMatchParticipant {
  userId: string;
  displayId?: string;
  email?: string;
  name: string;
  avatar?: string;
  gender?: string;
  age?: number;
  country?: string;
}

interface SupremeMatchMessage {
  id: string;
  senderId: string;
  senderEmail?: string;
  senderName: string;
  text: string;
  mediaType?: 'image' | 'audio' | 'text';
  mediaUrl?: string;
  isGift?: boolean;
  giftIcon?: string;
  giftName?: string;
  giftCost?: number;
  createdAt: string;
}

interface SupremeMatchLog {
  id: string;
  sessionId: string;
  user1: SupremeMatchParticipant;
  user2: SupremeMatchParticipant;
  matchedAt: string;
  endedAt?: string;
  endedBy?: string;
  endedReason?: string;
  status: 'active' | 'ended';
  messages: SupremeMatchMessage[];
}

interface SupremeUserLog {
  id: string;
  userId?: string;
  displayId?: string;
  email?: string;
  name?: string;
  action: string;
  actionLabelAr: string;
  details?: string;
  ip?: string;
  createdAt: string;
}

interface SupremeAdmin2Log {
  id: string;
  adminEmail: string;
  adminId?: string;
  adminName?: string;
  action: string;
  actionLabelAr: string;
  target?: string;
  details?: string;
  method: string;
  path: string;
  ip?: string;
  createdAt: string;
}

interface SupremeAdminPanelViewProps {
  lang: Language;
  supremeToken: string;
  onLock: () => void;
  onLoadingChange?: (loading: boolean) => void;
}

export const SupremeAdminPanelView: React.FC<SupremeAdminPanelViewProps> = ({
  lang,
  supremeToken,
  onLock,
  onLoadingChange,
}) => {
  const isAr = lang === 'ar';
  const [activeTab, setActiveTab] = useState<SupremeTab>('users');
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Data stores
  const [users, setUsers] = useState<SupremeUserRecord[]>([]);
  const [deletedChats, setDeletedChats] = useState<SupremeDeletedChat[]>([]);
  const [matches, setMatches] = useState<SupremeMatchLog[]>([]);
  const [userLogs, setUserLogs] = useState<SupremeUserLog[]>([]);
  const [admin2Logs, setAdmin2Logs] = useState<SupremeAdmin2Log[]>([]);
  const [admin2Email, setAdmin2Email] = useState('');

  // Selected items for detail panes
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [userLogFilter, setUserLogFilter] = useState<string>('all');

  // Modals & notifications
  const [statusBanner, setStatusBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; caption?: string } | null>(null);
  const [resetPasswordTarget, setResetPasswordTarget] = useState<SupremeUserRecord | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [isSubmittingReset, setIsSubmittingReset] = useState(false);

  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [isConfirmRunning, setIsConfirmRunning] = useState(false);

  const notify = (type: 'success' | 'error', text: string) => {
    setStatusBanner({ type, text });
    setTimeout(() => {
      setStatusBanner((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  };

  const getHeaders = useCallback(() => {
    const authToken = getStoredAuthToken();
    const refreshToken = getStoredRefreshToken();
    return {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(refreshToken ? { 'X-Refresh-Token': refreshToken } : {}),
      'x-supreme-token': supremeToken,
    };
  }, [supremeToken]);

  const safeFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      const res = await fetch(url, {
        ...options,
        cache: 'no-store',
        headers: {
          ...getHeaders(),
          ...(options.headers || {}),
        },
      });
      if (res.status === 401 || res.status === 404) {
        onLock();
        return null;
      }
      return res;
    },
    [getHeaders, onLock]
  );

  const fetchAllSupremeData = useCallback(async () => {
    if (!supremeToken) {
      onLock();
      return;
    }
    setIsLoading(true);
    onLoadingChange?.(true);
    try {
      const [uRes, dcRes, mRes, ulRes, a2Res] = await Promise.all([
        safeFetch('/api/supreme/users'),
        safeFetch('/api/supreme/deleted-chats'),
        safeFetch('/api/supreme/matches'),
        safeFetch('/api/supreme/user-logs'),
        safeFetch('/api/supreme/admin2-logs'),
      ]);

      if (uRes?.ok) {
        const uData = await uRes.json();
        if (uData.success && Array.isArray(uData.users)) {
          setUsers(uData.users);
        }
      }
      if (dcRes?.ok) {
        const dcData = await dcRes.json();
        if (dcData.success && Array.isArray(dcData.deletedChats)) {
          setDeletedChats(dcData.deletedChats);
        }
      }
      if (mRes?.ok) {
        const mData = await mRes.json();
        if (mData.success && Array.isArray(mData.matches)) {
          setMatches(mData.matches);
        }
      }
      if (ulRes?.ok) {
        const ulData = await ulRes.json();
        if (ulData.success && Array.isArray(ulData.logs)) {
          setUserLogs(ulData.logs);
        }
      }
      if (a2Res?.ok) {
        const a2Data = await a2Res.json();
        if (a2Data.success && Array.isArray(a2Data.logs)) {
          setAdmin2Logs(a2Data.logs);
          if (a2Data.admin2Email) setAdmin2Email(a2Data.admin2Email);
        }
      }
    } catch {
      notify('error', isAr ? 'تعذر تحميل بعض بيانات الإدارة العليا' : 'Failed to load data');
    } finally {
      setIsLoading(false);
      onLoadingChange?.(false);
    }
  }, [supremeToken, safeFetch, onLock, onLoadingChange, isAr]);

  useEffect(() => {
    fetchAllSupremeData();
  }, [fetchAllSupremeData]);

  useEffect(() => {
    const handleRefresh = () => fetchAllSupremeData();
    window.addEventListener('soulx:supreme-refresh', handleRefresh);
    return () => window.removeEventListener('soulx:supreme-refresh', handleRefresh);
  }, [fetchAllSupremeData]);

  const formatDateTime = (iso?: string | null) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleString(isAr ? 'ar-EG' : 'en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const resolveMediaSrc = (msg: { id: string; mediaUrl?: string; hasArchivedMedia?: boolean }) => {
    const tokenQ = encodeURIComponent(supremeToken);
    if (msg.mediaUrl && msg.mediaUrl.startsWith('/api/supreme/media/')) {
      return msg.mediaUrl.includes('?') ? `${msg.mediaUrl}&st=${tokenQ}` : `${msg.mediaUrl}?st=${tokenQ}`;
    }
    if (msg.hasArchivedMedia && msg.id) {
      return `/api/supreme/media/${encodeURIComponent(msg.id)}?st=${tokenQ}`;
    }
    return msg.mediaUrl || '';
  };

  // Actions
  const handleResetUserPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordTarget || newPasswordInput.trim().length < 4) return;
    setIsSubmittingReset(true);
    try {
      const res = await safeFetch(
        `/api/supreme/users/${encodeURIComponent(resetPasswordTarget.id)}/reset-password`,
        {
          method: 'POST',
          body: JSON.stringify({ newPassword: newPasswordInput.trim() }),
        }
      );
      if (res) {
        const data = await res.json();
        if (data.success) {
          notify('success', isAr ? `تم تحديث كلمة مرور ${resetPasswordTarget.name}` : 'Password updated');
          setResetPasswordTarget(null);
          setNewPasswordInput('');
          await fetchAllSupremeData();
        } else {
          notify('error', data.message || (isAr ? 'فشل تحديث كلمة المرور' : 'Failed'));
        }
      }
    } catch {
      notify('error', isAr ? 'حدث خطأ أثناء الاتصال' : 'Network error');
    } finally {
      setIsSubmittingReset(false);
    }
  };

  const handleDeleteUser = (u: SupremeUserRecord) => {
    setConfirmAction({
      title: isAr ? 'حذف المستخدم بالكامل' : 'Delete User Permanently',
      message: isAr
        ? `هل أنت متأكد من حذف الحساب "${u.name}" (${u.email}) وجميع بياناته نهائياً؟ سيتم أرشفة محادثاته تلقائياً في الدردشات المحذوفة.`
        : `Permanently delete ${u.name} (${u.email}) and all data?`,
      confirmLabel: isAr ? 'حذف المستخدم بالكامل' : 'Delete Permanently',
      onConfirm: async () => {
        const res = await safeFetch(`/api/supreme/users/${encodeURIComponent(u.id)}`, { method: 'DELETE' });
        if (res?.ok) {
          notify('success', isAr ? 'تم حذف المستخدم وجميع بياناته نهائياً' : 'User deleted');
          await fetchAllSupremeData();
        } else {
          const data = await res?.json().catch(() => ({}));
          notify('error', data?.message || (isAr ? 'تعذر حذف المستخدم' : 'Delete failed'));
        }
      },
    });
  };

  const handleDeleteDeletedChat = (chat: SupremeDeletedChat) => {
    setConfirmAction({
      title: isAr ? 'حذف الدردشة بالكامل' : 'Delete Archived Chat Permanently',
      message: isAr
        ? `سيتم حذف الدردشة (${chat.senderEmail} ⇄ ${chat.receiverEmail}) وجميع رسائلها ووسائطها نهائياً من السجل.`
        : `Permanently delete chat ${chat.senderEmail} ⇄ ${chat.receiverEmail} and all media?`,
      confirmLabel: isAr ? 'حذف الدردشة بالكامل' : 'Delete Chat',
      onConfirm: async () => {
        const res = await safeFetch(`/api/supreme/deleted-chats/${encodeURIComponent(chat.id)}`, {
          method: 'DELETE',
        });
        if (res?.ok) {
          setDeletedChats((prev) => prev.filter((c) => c.id !== chat.id));
          if (selectedChatId === chat.id) setSelectedChatId(null);
          notify('success', isAr ? 'تم حذف الدردشة وجميع وسائطها بالكامل' : 'Chat deleted');
        }
      },
    });
  };

  const handleClearAllDeletedChats = () => {
    setConfirmAction({
      title: isAr ? 'حذف جميع الدردشات المحذوفة' : 'Clear All Deleted Chats',
      message: isAr
        ? 'هل تريد مسح جميع الدردشات المحذوفة وجميع وسائطها المؤرشفة نهائياً؟'
        : 'Permanently wipe all archived deleted chats and media?',
      confirmLabel: isAr ? 'حذف الكل نهائياً' : 'Clear All',
      onConfirm: async () => {
        const res = await safeFetch('/api/supreme/deleted-chats', { method: 'DELETE' });
        if (res?.ok) {
          setDeletedChats([]);
          setSelectedChatId(null);
          notify('success', isAr ? 'تم مسح جميع الدردشات المحذوفة' : 'Cleared');
        }
      },
    });
  };

  const handleDeleteMatch = (match: SupremeMatchLog) => {
    setConfirmAction({
      title: isAr ? 'حذف سجل المطابقة' : 'Delete Match Record',
      message: isAr
        ? `حذف سجل المطابقة بين ${match.user1.name} و ${match.user2.name} بالكامل؟`
        : `Delete match between ${match.user1.name} and ${match.user2.name}?`,
      confirmLabel: isAr ? 'حذف السجل' : 'Delete Record',
      onConfirm: async () => {
        const res = await safeFetch(`/api/supreme/matches/${encodeURIComponent(match.id)}`, { method: 'DELETE' });
        if (res?.ok) {
          setMatches((prev) => prev.filter((m) => m.id !== match.id));
          if (selectedMatchId === match.id) setSelectedMatchId(null);
          notify('success', isAr ? 'تم حذف سجل المطابقة' : 'Match deleted');
        }
      },
    });
  };

  const handleClearAllMatches = () => {
    setConfirmAction({
      title: isAr ? 'مسح سجل المطابقات بالكامل' : 'Clear All Match History',
      message: isAr ? 'هل تريد حذف جميع سجلات المطابقات ومحادثاتها نهائياً؟' : 'Delete all match records?',
      confirmLabel: isAr ? 'مسح الكل' : 'Clear All',
      onConfirm: async () => {
        const res = await safeFetch('/api/supreme/matches', { method: 'DELETE' });
        if (res?.ok) {
          setMatches([]);
          setSelectedMatchId(null);
          notify('success', isAr ? 'تم مسح سجل المطابقات' : 'Cleared');
        }
      },
    });
  };

  const handleDeleteUserLog = async (logId: string) => {
    const res = await safeFetch(`/api/supreme/user-logs/${encodeURIComponent(logId)}`, { method: 'DELETE' });
    if (res?.ok) {
      setUserLogs((prev) => prev.filter((l) => l.id !== logId));
    }
  };

  const handleClearAllUserLogs = () => {
    setConfirmAction({
      title: isAr ? 'مسح سجل المستخدمين' : 'Clear User Logs',
      message: isAr ? 'هل تريد حذف جميع سجلات نشاط المستخدمين نهائياً؟' : 'Clear all user logs?',
      confirmLabel: isAr ? 'مسح الكل' : 'Clear All',
      onConfirm: async () => {
        const res = await safeFetch('/api/supreme/user-logs', { method: 'DELETE' });
        if (res?.ok) {
          setUserLogs([]);
          notify('success', isAr ? 'تم مسح سجل المستخدمين' : 'Cleared');
        }
      },
    });
  };

  const handleDeleteAdmin2Log = async (logId: string) => {
    const res = await safeFetch(`/api/supreme/admin2-logs/${encodeURIComponent(logId)}`, { method: 'DELETE' });
    if (res?.ok) {
      setAdmin2Logs((prev) => prev.filter((l) => l.id !== logId));
    }
  };

  const handleClearAllAdmin2Logs = () => {
    setConfirmAction({
      title: isAr ? 'مسح سجل نشاط ADMIN2' : 'Clear ADMIN2 Logs',
      message: isAr ? 'هل تريد حذف جميع سجلات نشاط ADMIN2 نهائياً؟' : 'Clear all ADMIN2 activity logs?',
      confirmLabel: isAr ? 'مسح الكل' : 'Clear All',
      onConfirm: async () => {
        const res = await safeFetch('/api/supreme/admin2-logs', { method: 'DELETE' });
        if (res?.ok) {
          setAdmin2Logs([]);
          notify('success', isAr ? 'تم مسح سجل نشاط ADMIN2' : 'Cleared');
        }
      },
    });
  };

  const q = searchTerm.trim().toLowerCase();

  const filteredUsers = useMemo(() => {
    if (!q) return users;
    return users.filter(
      (u) =>
        (u.name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.displayId || '').toLowerCase().includes(q) ||
        (u.id || '').toLowerCase().includes(q) ||
        (u.country || '').toLowerCase().includes(q) ||
        (u.role || '').toLowerCase().includes(q)
    );
  }, [users, q]);

  const filteredDeletedChats = useMemo(() => {
    if (!q) return deletedChats;
    return deletedChats.filter(
      (c) =>
        (c.senderEmail || '').toLowerCase().includes(q) ||
        (c.receiverEmail || '').toLowerCase().includes(q) ||
        (c.senderName || '').toLowerCase().includes(q) ||
        (c.receiverName || '').toLowerCase().includes(q) ||
        (c.deletedByEmail || '').toLowerCase().includes(q) ||
        c.messages.some((m) => (m.text || '').toLowerCase().includes(q))
    );
  }, [deletedChats, q]);

  const filteredMatches = useMemo(() => {
    if (!q) return matches;
    return matches.filter(
      (m) =>
        (m.user1.name || '').toLowerCase().includes(q) ||
        (m.user1.email || '').toLowerCase().includes(q) ||
        (m.user1.displayId || '').toLowerCase().includes(q) ||
        (m.user2.name || '').toLowerCase().includes(q) ||
        (m.user2.email || '').toLowerCase().includes(q) ||
        (m.user2.displayId || '').toLowerCase().includes(q) ||
        m.messages.some((msg) => (msg.text || '').toLowerCase().includes(q))
    );
  }, [matches, q]);

  const userLogActions = useMemo(() => {
    const set = new Set<string>();
    for (const l of userLogs) {
      if (l.action) set.add(l.action);
    }
    return Array.from(set);
  }, [userLogs]);

  const filteredUserLogs = useMemo(() => {
    return userLogs.filter((l) => {
      if (userLogFilter !== 'all' && l.action !== userLogFilter) return false;
      if (!q) return true;
      return (
        (l.name || '').toLowerCase().includes(q) ||
        (l.email || '').toLowerCase().includes(q) ||
        (l.displayId || '').toLowerCase().includes(q) ||
        (l.actionLabelAr || '').toLowerCase().includes(q) ||
        (l.details || '').toLowerCase().includes(q) ||
        (l.ip || '').toLowerCase().includes(q)
      );
    });
  }, [userLogs, userLogFilter, q]);

  const filteredAdmin2Logs = useMemo(() => {
    if (!q) return admin2Logs;
    return admin2Logs.filter(
      (l) =>
        (l.actionLabelAr || '').toLowerCase().includes(q) ||
        (l.target || '').toLowerCase().includes(q) ||
        (l.details || '').toLowerCase().includes(q) ||
        (l.path || '').toLowerCase().includes(q) ||
        (l.ip || '').toLowerCase().includes(q)
    );
  }, [admin2Logs, q]);

  const selectedChat = useMemo(
    () => deletedChats.find((c) => c.id === selectedChatId) || null,
    [deletedChats, selectedChatId]
  );

  const selectedMatch = useMemo(
    () => matches.find((m) => m.id === selectedMatchId) || null,
    [matches, selectedMatchId]
  );

  const tabs: Array<{
    id: SupremeTab;
    label: string;
    count: number;
    icon: React.ReactNode;
  }> = [
    {
      id: 'users',
      label: isAr ? 'المستخدمون وكلمات المرور' : 'Users & Credentials',
      count: users.length,
      icon: <Users className="w-4 h-4" />,
    },
    {
      id: 'deleted-chats',
      label: isAr ? 'الدردشات المحذوفة' : 'Deleted Chats',
      count: deletedChats.length,
      icon: <MessageSquareOff className="w-4 h-4" />,
    },
    {
      id: 'matches',
      label: isAr ? 'سجل المطابقات' : 'Matches Log',
      count: matches.length,
      icon: <Sparkles className="w-4 h-4" />,
    },
    {
      id: 'user-logs',
      label: isAr ? 'سجل المستخدمين' : 'Users Log',
      count: userLogs.length,
      icon: <Activity className="w-4 h-4" />,
    },
    {
      id: 'admin2-logs',
      label: isAr ? 'سجل نشاط ADMIN2' : 'ADMIN2 Log',
      count: admin2Logs.length,
      icon: <Eye className="w-4 h-4" />,
    },
  ];

  return (
    <div
      className="w-full max-w-6xl mx-auto px-3 sm:px-6 pt-4 pb-16 space-y-5 animate-in fade-in duration-300"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* Top Supreme Header Card */}
      <div className="rounded-3xl bg-gradient-to-br from-neutral-900 via-violet-950/80 to-neutral-900 border border-violet-500/30 p-4 sm:p-6 text-white shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-violet-500/20 border border-violet-400/40 flex items-center justify-center text-violet-300 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-black tracking-tight">
                  {isAr ? 'لوحة الإدارة العليا' : 'Supreme Admin Panel'}
                </h1>
                <span className="px-2 py-0.5 rounded-md bg-violet-500 text-white text-[10px] font-mono font-bold">
                  ADMIN1 ONLY
                </span>
              </div>
              <p className="text-xs text-violet-200/80 mt-0.5">
                {isAr
                  ? 'قسم معزول بالكامل لإدارة البيانات، الدردشات المحذوفة ووسائطها، سجل المطابقات، ومراقبة النشاط'
                  : 'Isolated supreme control vault for data, deleted chats & media, matches, and activity logs'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              type="button"
              onClick={fetchAllSupremeData}
              disabled={isLoading}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isAr ? 'تحديث' : 'Refresh'}</span>
            </button>
            <button
              type="button"
              onClick={onLock}
              className="px-3.5 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/35 border border-rose-400/30 text-rose-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{isAr ? 'قفل وإغلاق' : 'Lock & Exit'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Status Toast Banner */}
      {statusBanner && (
        <div
          className={`p-3.5 rounded-2xl border flex items-center justify-between gap-2 text-xs font-bold animate-in fade-in duration-200 ${
            statusBanner.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusBanner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{statusBanner.text}</span>
          </div>
          <button type="button" onClick={() => setStatusBanner(null)} className="p-1 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                setSearchTerm('');
              }}
              className={`shrink-0 px-3.5 py-2.5 rounded-2xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                isActive
                  ? 'bg-violet-600 text-white border-violet-500 shadow-md'
                  : 'bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-800 hover:border-violet-500/40'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.5 rounded-md font-mono text-[10px] ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Global Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-neutral-400 absolute start-4 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={
            activeTab === 'users'
              ? isAr
                ? 'بحث بالاسم، البريد الإلكتروني، المعرف، الدولة، أو الدور...'
                : 'Search users by name, email, ID, country...'
              : activeTab === 'deleted-chats'
              ? isAr
                ? 'بحث ببريد المرسل أو المستلم أو نص الرسائل...'
                : 'Search by sender/receiver email or text...'
              : activeTab === 'matches'
              ? isAr
                ? 'بحث بالمشاركين أو البريد الإلكتروني أو نص الدردشة...'
                : 'Search participants, emails, or messages...'
              : isAr
              ? 'بحث في السجلات...'
              : 'Search logs...'
          }
          className="w-full py-3 ps-11 pe-10 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 focus:border-violet-500 text-xs sm:text-sm text-neutral-900 dark:text-white focus:outline-none"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            className="absolute end-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: USERS & CREDENTIALS                                             */}
      {/* ===================================================================== */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">
                {isAr
                  ? 'ملاحظة أمنية حول كلمات المرور: جميع كلمات المرور مشفّرة باتجاه واحد (HMAC-SHA256 Hash)'
                  : 'Security note: Passwords are stored strictly as one-way HMAC-SHA256 hashes'}
              </p>
              <p className="opacity-90">
                {isAr
                  ? 'لا يمكن استخراج أو عرض كلمة المرور الأصلية كنص مكشوف لأنها غير محفوظة بصيغة قابلة لفك التشفير، ويمكنك من هنا فحص بصمة التشفير وتغيير كلمة مرور أي مستخدم فوراً أو حذف حسابه بالكامل.'
                  : 'Plaintext passwords are never stored or recoverable. You can inspect hash status/fingerprint, reset any user password immediately, or delete any user.'}
              </p>
            </div>
          </div>

          {filteredUsers.length === 0 ? (
            <div className="p-10 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-center text-xs text-neutral-500">
              {isAr ? 'لا يوجد مستخدمون مطابقون للبحث' : 'No matching users'}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredUsers.map((u) => {
                const avatarSrc = u.photoUrl || getDefaultAvatar((u.gender as 'male' | 'female') || 'male');
                return (
                  <div
                    key={u.id}
                    className="rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-4 sm:p-5 space-y-4 shadow-xs"
                  >
                    {/* User Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={avatarSrc}
                          alt={u.name}
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = getDefaultAvatar('male');
                          }}
                          className="w-12 h-12 rounded-2xl object-cover border border-neutral-200 dark:border-neutral-700 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="text-sm font-extrabold text-neutral-900 dark:text-white truncate">
                              {u.name}
                            </h3>
                            {u.isVerified && <VerifiedBadge lang={lang} size="xs" />}
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                                u.role === 'ADMIN1'
                                  ? 'bg-violet-600 text-white'
                                  : u.role === 'ADMIN2'
                                  ? 'bg-amber-500 text-neutral-950'
                                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'
                              }`}
                            >
                              {u.role}
                            </span>
                            {u.isBanned && (
                              <span className="px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-600 dark:text-rose-400 text-[10px] font-bold flex items-center gap-1">
                                <Ban className="w-3 h-3" />
                                {isAr ? 'محظور' : 'Banned'}
                              </span>
                            )}
                            {u.isFrozen && (
                              <span className="px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 text-[10px] font-bold flex items-center gap-1">
                                <Snowflake className="w-3 h-3" />
                                {isAr ? 'مجمد' : 'Frozen'}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-cyan-600 dark:text-cyan-400 font-mono truncate mt-0.5 flex items-center gap-1">
                            <Mail className="w-3 h-3 shrink-0" />
                            <span>{u.email}</span>
                          </div>
                          <div className="text-[11px] text-neutral-500 font-mono truncate">
                            ID: {u.displayId} • UUID: {u.id}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Balances & Profile Details Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                      <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/70 dark:border-neutral-800 flex items-center gap-2">
                        <CoinIcon className="w-4 h-4 shrink-0" />
                        <div className="min-w-0">
                          <span className="text-[10px] text-neutral-500 block">{isAr ? 'الكوينز' : 'Coins'}</span>
                          <span className="font-mono font-bold">{Number(u.coinsBalance || 0).toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/70 dark:border-neutral-800 flex items-center gap-2">
                        <DiamondIcon className="w-4 h-4 shrink-0" />
                        <div className="min-w-0">
                          <span className="text-[10px] text-neutral-500 block">{isAr ? 'الألماس' : 'Diamonds'}</span>
                          <span className="font-mono font-bold">{Number(u.walletBalance || 0).toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/70 dark:border-neutral-800">
                        <span className="text-[10px] text-neutral-500 block">{isAr ? 'الجنس / الميلاد' : 'Gender / DOB'}</span>
                        <span className="font-semibold truncate block">
                          {u.gender === 'female' ? (isAr ? 'أنثى' : 'Female') : u.gender === 'male' ? (isAr ? 'ذكر' : 'Male') : '—'} •{' '}
                          {u.birthDate || '—'}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/70 dark:border-neutral-800">
                        <span className="text-[10px] text-neutral-500 block">{isAr ? 'الدولة' : 'Country'}</span>
                        <span className="font-semibold truncate block">{u.country || '—'}</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/70 dark:border-neutral-800">
                        <span className="text-[10px] text-neutral-500 block">{isAr ? 'المصادقة الثنائية' : '2FA'}</span>
                        <span className={`font-bold ${u.twoFactorEnabled ? 'text-emerald-500' : 'text-neutral-500'}`}>
                          {u.twoFactorEnabled ? (isAr ? 'مفعّلة' : 'Enabled') : (isAr ? 'معطلة' : 'Off')}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/70 dark:border-neutral-800">
                        <span className="text-[10px] text-neutral-500 block">{isAr ? 'تاريخ التسجيل' : 'Joined'}</span>
                        <span className="font-mono text-[11px] truncate block">{formatDateTime(u.createdAt)}</span>
                      </div>
                    </div>

                    {u.bio && (
                      <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/70 dark:border-neutral-800 text-xs text-neutral-600 dark:text-neutral-400">
                        <span className="font-bold text-neutral-700 dark:text-neutral-300">{isAr ? 'النبذة: ' : 'Bio: '}</span>
                        {u.bio}
                      </div>
                    )}

                    {/* Security / Password Hash Box */}
                    <div className="p-3 rounded-2xl bg-violet-500/5 border border-violet-500/20 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-bold text-violet-700 dark:text-violet-300 flex items-center gap-1.5">
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>{isAr ? 'حالة كلمة المرور (Hash):' : 'Password Hash Status:'}</span>
                        </span>
                        <span className="font-mono text-[11px] text-neutral-700 dark:text-neutral-300">
                          {u.hasPasswordHash
                            ? `HMAC-SHA256 (${u.passwordHashFingerprint || 'active'})`
                            : isAr
                            ? 'لا يوجد Hash محفوظ'
                            : 'No hash'}
                        </span>
                      </div>
                      {(u.banReason || u.freezeReason) && (
                        <div className="text-[11px] text-rose-600 dark:text-rose-400">
                          {u.banReason ? `${isAr ? 'سبب الحظر:' : 'Ban reason:'} ${u.banReason}` : ''}
                          {u.freezeReason ? ` • ${isAr ? 'سبب التجميد:' : 'Freeze reason:'} ${u.freezeReason}` : ''}
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          setResetPasswordTarget(u);
                          setNewPasswordInput('');
                        }}
                        className="flex-1 py-2 px-3 rounded-xl bg-violet-500/10 hover:bg-violet-500/20 text-violet-700 dark:text-violet-300 border border-violet-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        <span>{isAr ? 'تعيين كلمة مرور جديدة' : 'Reset Password'}</span>
                      </button>

                      {u.role !== 'ADMIN1' && (
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(u)}
                          className="py-2 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>{isAr ? 'حذف المستخدم بالكامل' : 'Delete User'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: DELETED CHATS ARCHIVE (WITH ALL MEDIA)                          */}
      {/* ===================================================================== */}
      {activeTab === 'deleted-chats' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="text-xs text-neutral-500 font-semibold">
              {isAr
                ? `إجمالي الدردشات المحذوفة المؤرشفة: ${filteredDeletedChats.length}`
                : `Total archived deleted chats: ${filteredDeletedChats.length}`}
            </span>
            {deletedChats.length > 0 && (
              <button
                type="button"
                onClick={handleClearAllDeletedChats}
                className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isAr ? 'حذف جميع الدردشات المحذوفة' : 'Clear All'}</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Deleted Chats List */}
            <div
              className={`lg:col-span-5 space-y-2.5 ${
                selectedChat ? 'hidden lg:block' : 'block'
              }`}
            >
              {filteredDeletedChats.length === 0 ? (
                <div className="p-10 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-center text-xs text-neutral-500">
                  {isAr ? 'لا توجد دردشات محذوفة مؤرشفة حتى الآن' : 'No deleted chats archived yet'}
                </div>
              ) : (
                filteredDeletedChats.map((chat) => {
                  const isSelected = selectedChatId === chat.id;
                  return (
                    <div
                      key={chat.id}
                      onClick={() => setSelectedChatId(chat.id)}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all space-y-2 ${
                        isSelected
                          ? 'bg-violet-500/10 border-violet-500 shadow-sm'
                          : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 hover:border-violet-500/40'
                      }`}
                    >
                      {/* Title strictly formatted with sender & receiver emails */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div
                            className="text-xs sm:text-sm font-extrabold text-neutral-900 dark:text-white font-mono break-all"
                            dir="ltr"
                          >
                            {chat.senderEmail} ⇄ {chat.receiverEmail}
                          </div>
                          <div className="text-[11px] text-neutral-500 mt-1">
                            {chat.senderName} ⇄ {chat.receiverName}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteDeletedChat(chat);
                          }}
                          title={isAr ? 'حذف الدردشة بالكامل' : 'Delete Chat'}
                          className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 shrink-0 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-2 flex-wrap text-[11px] text-neutral-500 pt-1 border-t border-neutral-100 dark:border-neutral-800">
                        <span className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 font-mono">
                            {chat.messages.length} {isAr ? 'رسالة' : 'msgs'}
                          </span>
                          {chat.mediaCount > 0 && (
                            <span className="px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-mono font-bold">
                              {chat.mediaCount} {isAr ? 'وسائط' : 'media'}
                            </span>
                          )}
                        </span>
                        <span className="font-mono text-[10px]">{formatDateTime(chat.deletedAt)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Selected Deleted Chat Conversation + Media Viewer */}
            <div className={`lg:col-span-7 ${selectedChat ? 'block' : 'hidden lg:block'}`}>
              {!selectedChat ? (
                <div className="h-full min-h-[320px] rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-center p-8 text-center text-xs text-neutral-500">
                  {isAr
                    ? 'اختر دردشة محذوفة من القائمة لعرض جميع الرسائل والصور والرسائل الصوتية'
                    : 'Select an archived chat to inspect all messages and media'}
                </div>
              ) : (
                <div className="rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-xs">
                  {/* Chat Detail Header */}
                  <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950/60 space-y-2.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 min-w-0">
                        <button
                          type="button"
                          onClick={() => setSelectedChatId(null)}
                          className="lg:hidden p-2 rounded-xl bg-neutral-200/70 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 cursor-pointer"
                        >
                          {isAr ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
                        </button>
                        <div className="min-w-0">
                          <h3
                            className="text-xs sm:text-sm font-black text-neutral-900 dark:text-white font-mono break-all"
                            dir="ltr"
                          >
                            {selectedChat.senderEmail} ⇄ {selectedChat.receiverEmail}
                          </h3>
                          <p className="text-[11px] text-neutral-500">
                            {selectedChat.senderName} ({selectedChat.senderDisplayId || selectedChat.senderId}) ⇄{' '}
                            {selectedChat.receiverName} ({selectedChat.receiverDisplayId || selectedChat.receiverId})
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteDeletedChat(selectedChat)}
                        className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{isAr ? 'حذف الدردشة بالكامل' : 'Delete Chat'}</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap text-[11px] text-neutral-500">
                      <span>
                        {isAr ? 'تاريخ الحذف:' : 'Deleted at:'}{' '}
                        <strong className="font-mono text-neutral-800 dark:text-neutral-200">
                          {formatDateTime(selectedChat.deletedAt)}
                        </strong>
                      </span>
                      {selectedChat.deletedByEmail && (
                        <span>
                          {isAr ? 'حُذفت بواسطة:' : 'Deleted by:'}{' '}
                          <strong className="text-neutral-800 dark:text-neutral-200">
                            {selectedChat.deletedByName || ''} ({selectedChat.deletedByEmail})
                          </strong>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Messages & Media Timeline */}
                  <div className="p-4 max-h-[600px] overflow-y-auto space-y-3 bg-neutral-50/40 dark:bg-neutral-950/30">
                    {selectedChat.messages.map((m) => {
                      const isSenderSide =
                        m.senderId === selectedChat.senderId ||
                        m.senderId === selectedChat.senderDisplayId ||
                        (m.senderEmail && m.senderEmail.toLowerCase() === selectedChat.senderEmail.toLowerCase());
                      const mediaSrc = resolveMediaSrc(m);
                      const isImage = m.mediaType === 'image' || (mediaSrc && mediaSrc.startsWith('data:image/'));
                      const isAudio = m.mediaType === 'audio' || (mediaSrc && mediaSrc.startsWith('data:audio/'));

                      return (
                        <div
                          key={m.id}
                          className={`p-3 rounded-2xl border max-w-[92%] space-y-2 ${
                            isSenderSide
                              ? 'ms-auto bg-violet-500/10 border-violet-500/25'
                              : 'me-auto bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3 text-[10px] text-neutral-500">
                            <span className="font-bold text-neutral-800 dark:text-neutral-200">
                              {m.senderName || selectedChat.senderName}{' '}
                              <span className="font-mono opacity-75">({m.senderEmail || m.senderId})</span>
                            </span>
                            <span className="font-mono shrink-0">{formatDateTime(m.createdAt)}</span>
                          </div>

                          {m.isGift && (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300 text-xs font-bold">
                              <Gift className="w-3.5 h-3.5" />
                              <span>
                                {m.giftIcon} {m.giftName}
                              </span>
                              {m.giftCost ? <span className="font-mono">({m.giftCost})</span> : null}
                            </div>
                          )}

                          {mediaSrc && isImage && (
                            <div className="space-y-1.5">
                              <div className="relative group inline-block">
                                <img
                                  src={mediaSrc}
                                  alt="Archived media"
                                  onClick={() =>
                                    setLightboxImage({
                                      url: mediaSrc,
                                      caption: `${m.senderEmail || m.senderId} • ${formatDateTime(m.createdAt)}`,
                                    })
                                  }
                                  className="max-w-full max-h-64 rounded-xl object-cover border border-neutral-200 dark:border-neutral-700 cursor-zoom-in"
                                />
                                <a
                                  href={mediaSrc}
                                  download={`soulx-archived-${m.id}.jpg`}
                                  className="mt-1 inline-flex items-center gap-1 text-[11px] text-cyan-600 dark:text-cyan-400 font-bold hover:underline"
                                >
                                  <Download className="w-3 h-3" />
                                  <span>{isAr ? 'تحميل الصورة' : 'Download Image'}</span>
                                </a>
                              </div>
                            </div>
                          )}

                          {mediaSrc && isAudio && (
                            <div className="p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 space-y-1">
                              <div className="flex items-center gap-1.5 text-[11px] font-bold text-cyan-600 dark:text-cyan-400">
                                <Mic className="w-3.5 h-3.5" />
                                <span>
                                  {isAr ? 'رسالة صوتية' : 'Voice Note'}
                                  {m.audioDuration ? ` (${m.audioDuration}s)` : ''}
                                </span>
                              </div>
                              <audio controls preload="metadata" src={mediaSrc} className="w-full h-9" />
                            </div>
                          )}

                          {mediaSrc && !isImage && !isAudio && (
                            <div className="flex items-center gap-2 text-xs text-cyan-600 dark:text-cyan-400">
                              <ImageIcon className="w-3.5 h-3.5" />
                              <a href={mediaSrc} download={`media-${m.id}`} className="underline font-mono">
                                {isAr ? 'فتح / تحميل المرفق' : 'Download attachment'}
                              </a>
                            </div>
                          )}

                          {m.text && (
                            <p className="text-xs sm:text-sm text-neutral-900 dark:text-neutral-100 whitespace-pre-wrap break-words">
                              {m.text}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: MATCHES LOG (WITH EXACT DATE/TIME & FULL CHAT LOG)             */}
      {/* ===================================================================== */}
      {activeTab === 'matches' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="text-xs text-neutral-500 font-semibold">
              {isAr ? `إجمالي سجلات المطابقات: ${filteredMatches.length}` : `Total match logs: ${filteredMatches.length}`}
            </span>
            {matches.length > 0 && (
              <button
                type="button"
                onClick={handleClearAllMatches}
                className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isAr ? 'مسح كل سجل المطابقات' : 'Clear All'}</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className={`lg:col-span-5 space-y-2.5 ${selectedMatch ? 'hidden lg:block' : 'block'}`}>
              {filteredMatches.length === 0 ? (
                <div className="p-10 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-center text-xs text-neutral-500">
                  {isAr ? 'لا توجد مطابقات مسجلة حتى الآن' : 'No match records yet'}
                </div>
              ) : (
                filteredMatches.map((m) => {
                  const isSelected = selectedMatchId === m.id;
                  return (
                    <div
                      key={m.id}
                      onClick={() => setSelectedMatchId(m.id)}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all space-y-2 ${
                        isSelected
                          ? 'bg-violet-500/10 border-violet-500 shadow-sm'
                          : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 hover:border-violet-500/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="text-xs sm:text-sm font-extrabold text-neutral-900 dark:text-white">
                            {m.user1.name} ⇄ {m.user2.name}
                          </div>
                          <div className="text-[11px] font-mono text-cyan-600 dark:text-cyan-400 break-all" dir="ltr">
                            {m.user1.email || m.user1.displayId || m.user1.userId} ⇄{' '}
                            {m.user2.email || m.user2.displayId || m.user2.userId}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteMatch(m);
                          }}
                          className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 shrink-0 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-2 flex-wrap text-[11px] text-neutral-500 pt-1 border-t border-neutral-100 dark:border-neutral-800">
                        <span className="flex items-center gap-1 font-mono text-neutral-700 dark:text-neutral-300">
                          <Clock className="w-3 h-3 text-violet-500" />
                          {formatDateTime(m.matchedAt)}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                              m.status === 'active'
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500'
                            }`}
                          >
                            {m.status === 'active' ? (isAr ? 'جارية' : 'Active') : (isAr ? 'منتهية' : 'Ended')}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 font-mono text-[10px]">
                            {m.messages.length} {isAr ? 'رسالة' : 'msgs'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className={`lg:col-span-7 ${selectedMatch ? 'block' : 'hidden lg:block'}`}>
              {!selectedMatch ? (
                <div className="h-full min-h-[320px] rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-center p-8 text-center text-xs text-neutral-500">
                  {isAr
                    ? 'اختر مطابقة من القائمة لعرض التاريخ والوقت وسجل الدردشة الكامل'
                    : 'Select a match to inspect timestamps and full chat history'}
                </div>
              ) : (
                <div className="rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-xs">
                  <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950/60 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 min-w-0">
                        <button
                          type="button"
                          onClick={() => setSelectedMatchId(null)}
                          className="lg:hidden p-2 rounded-xl bg-neutral-200/70 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 cursor-pointer"
                        >
                          {isAr ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
                        </button>
                        <div>
                          <h3 className="text-sm font-black text-neutral-900 dark:text-white">
                            {selectedMatch.user1.name} ⇄ {selectedMatch.user2.name}
                          </h3>
                          <p className="text-[11px] font-mono text-neutral-500" dir="ltr">
                            {selectedMatch.user1.email || selectedMatch.user1.displayId || selectedMatch.user1.userId} ⇄{' '}
                            {selectedMatch.user2.email || selectedMatch.user2.displayId || selectedMatch.user2.userId}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteMatch(selectedMatch)}
                        className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{isAr ? 'حذف السجل' : 'Delete'}</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-neutral-600 dark:text-neutral-400">
                      <div className="p-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/70 dark:border-neutral-800">
                        <span className="text-neutral-400">{isAr ? 'وقت المطابقة: ' : 'Matched at: '}</span>
                        <strong className="font-mono text-neutral-900 dark:text-white">
                          {formatDateTime(selectedMatch.matchedAt)}
                        </strong>
                      </div>
                      <div className="p-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/70 dark:border-neutral-800">
                        <span className="text-neutral-400">{isAr ? 'وقت الانتهاء: ' : 'Ended at: '}</span>
                        <strong className="font-mono text-neutral-900 dark:text-white">
                          {selectedMatch.endedAt ? formatDateTime(selectedMatch.endedAt) : isAr ? 'نشطة حالياً' : 'Active'}
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 max-h-[560px] overflow-y-auto space-y-2.5 bg-neutral-50/40 dark:bg-neutral-950/30">
                    {selectedMatch.messages.length === 0 ? (
                      <div className="py-12 text-center text-xs text-neutral-500">
                        {isAr ? 'لم يتم إرسال رسائل داخل هذه المطابقة' : 'No messages were sent in this match'}
                      </div>
                    ) : (
                      selectedMatch.messages.map((msg) => {
                        const isU1 = msg.senderId === selectedMatch.user1.userId;
                        return (
                          <div
                            key={msg.id}
                            className={`p-3 rounded-2xl border max-w-[92%] space-y-1.5 ${
                              isU1
                                ? 'ms-auto bg-violet-500/10 border-violet-500/25'
                                : 'me-auto bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3 text-[10px] text-neutral-500">
                              <span className="font-bold text-neutral-800 dark:text-neutral-200">
                                {msg.senderName}{' '}
                                <span className="font-mono opacity-75">({msg.senderEmail || msg.senderId})</span>
                              </span>
                              <span className="font-mono shrink-0">{formatDateTime(msg.createdAt)}</span>
                            </div>
                            {msg.isGift && (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300 text-xs font-bold">
                                <Gift className="w-3.5 h-3.5" />
                                <span>
                                  {msg.giftIcon} {msg.giftName}
                                </span>
                                {msg.giftCost ? <span className="font-mono">({msg.giftCost})</span> : null}
                              </div>
                            )}
                            {msg.text && (
                              <p className="text-xs sm:text-sm text-neutral-900 dark:text-neutral-100 whitespace-pre-wrap break-words">
                                {msg.text}
                              </p>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: USERS ACTIVITY LOG                                             */}
      {/* ===================================================================== */}
      {activeTab === 'user-logs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={userLogFilter}
                onChange={(e) => setUserLogFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-bold text-neutral-800 dark:text-neutral-200 focus:outline-none"
              >
                <option value="all">{isAr ? 'كافة الأنشطة' : 'All Actions'}</option>
                {userLogActions.map((act) => (
                  <option key={act} value={act}>
                    {act}
                  </option>
                ))}
              </select>
              <span className="text-xs text-neutral-500 font-semibold">
                {filteredUserLogs.length} {isAr ? 'سجل' : 'entries'}
              </span>
            </div>

            {userLogs.length > 0 && (
              <button
                type="button"
                onClick={handleClearAllUserLogs}
                className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isAr ? 'مسح سجل المستخدمين بالكامل' : 'Clear All'}</span>
              </button>
            )}
          </div>

          {filteredUserLogs.length === 0 ? (
            <div className="p-10 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-center text-xs text-neutral-500">
              {isAr ? 'لا توجد سجلات نشاط للمستخدمين' : 'No user activity logs'}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredUserLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3.5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 text-[11px] font-bold">
                        {log.actionLabelAr || log.action}
                      </span>
                      <span className="text-xs font-extrabold text-neutral-900 dark:text-white">
                        {log.name || '—'}
                      </span>
                      {log.email && (
                        <span className="text-[11px] font-mono text-neutral-500" dir="ltr">
                          {log.email}
                        </span>
                      )}
                      {log.displayId && (
                        <span className="text-[11px] font-mono text-neutral-400">({log.displayId})</span>
                      )}
                    </div>
                    {log.details && (
                      <p className="text-xs text-neutral-600 dark:text-neutral-300 break-words">{log.details}</p>
                    )}
                    <div className="flex items-center gap-3 flex-wrap text-[10px] font-mono text-neutral-400">
                      <span>{formatDateTime(log.createdAt)}</span>
                      {log.ip && <span>IP: {log.ip}</span>}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteUserLog(log.id)}
                    className="p-2 rounded-xl hover:bg-rose-500/10 text-neutral-400 hover:text-rose-500 transition-colors cursor-pointer shrink-0"
                    title={isAr ? 'حذف السجل' : 'Delete log'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 5: ADMIN2 ACTIVITY LOG                                            */}
      {/* ===================================================================== */}
      {activeTab === 'admin2-logs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-xs text-neutral-500 font-semibold">
              <span>{isAr ? 'الحساب المراقَب:' : 'Monitored ADMIN2:'}</span>
              <span className="font-mono text-amber-600 dark:text-amber-400 font-bold" dir="ltr">
                {admin2Email || 'ADMIN2'}
              </span>
              <span>• {filteredAdmin2Logs.length} {isAr ? 'حدث' : 'events'}</span>
            </div>

            {admin2Logs.length > 0 && (
              <button
                type="button"
                onClick={handleClearAllAdmin2Logs}
                className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isAr ? 'مسح سجل ADMIN2 بالكامل' : 'Clear All'}</span>
              </button>
            )}
          </div>

          {filteredAdmin2Logs.length === 0 ? (
            <div className="p-10 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-center text-xs text-neutral-500">
              {isAr ? 'لم يتم تسجيل أي نشاط لحساب ADMIN2 حتى الآن' : 'No ADMIN2 activity logged yet'}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredAdmin2Logs.map((log) => (
                <div
                  key={log.id}
                  className="p-3.5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[11px] font-bold">
                        {log.actionLabelAr || log.action}
                      </span>
                      <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                        {log.method} {log.path}
                      </span>
                      {log.target && (
                        <span className="text-xs font-mono text-cyan-600 dark:text-cyan-400">
                          {isAr ? 'الهدف:' : 'Target:'} {log.target}
                        </span>
                      )}
                    </div>
                    {log.details && (
                      <p className="text-xs text-neutral-600 dark:text-neutral-300 break-words font-mono">
                        {log.details}
                      </p>
                    )}
                    <div className="flex items-center gap-3 flex-wrap text-[10px] font-mono text-neutral-400">
                      <span>{formatDateTime(log.createdAt)}</span>
                      <span>{log.adminEmail}</span>
                      {log.ip && <span>IP: {log.ip}</span>}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteAdmin2Log(log.id)}
                    className="p-2 rounded-xl hover:bg-rose-500/10 text-neutral-400 hover:text-rose-500 transition-colors cursor-pointer shrink-0"
                    title={isAr ? 'حذف السجل' : 'Delete log'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal: Reset User Password */}
      {resetPasswordTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/85 backdrop-blur-md">
          <div className="w-full max-w-sm bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-neutral-900 dark:text-white">
                {isAr ? 'تعيين كلمة مرور جديدة' : 'Reset User Password'}
              </h3>
              <button
                type="button"
                onClick={() => setResetPasswordTarget(null)}
                className="p-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-neutral-500">
              {resetPasswordTarget.name} ({resetPasswordTarget.email})
            </p>
            <form onSubmit={handleResetUserPassword} className="space-y-3">
              <input
                type="text"
                autoFocus
                minLength={4}
                value={newPasswordInput}
                onChange={(e) => setNewPasswordInput(e.target.value)}
                placeholder={isAr ? 'كلمة المرور الجديدة (4 أحرف على الأقل)...' : 'New password...'}
                className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 text-sm text-neutral-900 dark:text-white focus:border-violet-500 focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setResetPasswordTarget(null)}
                  className="flex-1 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-xs font-bold cursor-pointer"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReset || newPasswordInput.trim().length < 4}
                  className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingReset ? '...' : isAr ? 'حفظ' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirmation Dialog */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/85 backdrop-blur-md">
          <div className="w-full max-w-sm bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 text-rose-500 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-extrabold text-neutral-900 dark:text-white">{confirmAction.title}</h3>
            <p className="text-xs text-neutral-500 leading-relaxed">{confirmAction.message}</p>
            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                disabled={isConfirmRunning}
                onClick={() => setConfirmAction(null)}
                className="flex-1 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs font-bold cursor-pointer"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={isConfirmRunning}
                onClick={async () => {
                  setIsConfirmRunning(true);
                  try {
                    await confirmAction.onConfirm();
                    setConfirmAction(null);
                  } finally {
                    setIsConfirmRunning(false);
                  }
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {isConfirmRunning ? '...' : confirmAction.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox for archived chat images */}
      <ImageLightboxModal
        isOpen={Boolean(lightboxImage)}
        onClose={() => setLightboxImage(null)}
        imageUrl={lightboxImage?.url || ''}
        caption={lightboxImage?.caption}
        lang={lang}
      />
    </div>
  );
};
