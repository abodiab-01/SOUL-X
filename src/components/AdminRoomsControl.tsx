import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Armchair,
  Check,
  Coins,
  Crown,
  Eye,
  EyeOff,
  Globe,
  Lock,
  MessageCircle,
  Mic,
  RefreshCw,
  Search,
  ShieldAlert,
  Snowflake,
  Trash2,
  Unlock,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { AdminRoomRecord, Language } from '../types';
import { VerifiedBadge } from './VerifiedBadge';
import { formatLocalDateTime } from '../lib/dateUtils';

export interface AdminRoomsUserOption {
  id: string;
  displayId?: string;
  name: string;
  email: string;
  photoUrl?: string | null;
  isVerified?: boolean;
  isBanned?: boolean;
}

interface AdminRoomsControlProps {
  lang: Language;
  getAdminHeaders: () => Record<string, string>;
  users: AdminRoomsUserOption[];
  refreshSignal?: number;
  onToast: (type: 'success' | 'error', message: string) => void;
}

type RoomFilterMode = 'all' | 'public' | 'private' | 'hidden' | 'frozen';

const CATEGORY_LABELS: Record<string, { ar: string; en: string }> = {
  chat: { ar: 'دردشة عامة', en: 'Chat' },
  music: { ar: 'موسيقى', en: 'Music' },
  games: { ar: 'ألعاب', en: 'Games' },
  friends: { ar: 'أصدقاء', en: 'Friends' },
  vip: { ar: 'VIP', en: 'VIP' },
  dating: { ar: 'تعارف', en: 'Dating' },
  chill: { ar: 'استرخاء', en: 'Chill' },
};

export const AdminRoomsControl: React.FC<AdminRoomsControlProps> = ({
  lang,
  getAdminHeaders,
  users,
  refreshSignal = 0,
  onToast,
}) => {
  const isAr = lang === 'ar';

  const [rooms, setRooms] = useState<AdminRoomRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterMode, setFilterMode] = useState<RoomFilterMode>('all');
  const [busyActionKey, setBusyActionKey] = useState<string | null>(null);

  // Change Primary Admin (Owner) Modal
  const [ownerModalRoom, setOwnerModalRoom] = useState<AdminRoomRecord | null>(null);
  const [ownerSearchQuery, setOwnerSearchQuery] = useState<string>('');
  const [selectedOwnerIdentifier, setSelectedOwnerIdentifier] = useState<string>('');
  const [keepPreviousAsHeadAdmin, setKeepPreviousAsHeadAdmin] = useState<boolean>(true);
  const [isSubmittingOwner, setIsSubmittingOwner] = useState<boolean>(false);

  // Administrative Freeze Modal
  const [freezeModalRoom, setFreezeModalRoom] = useState<AdminRoomRecord | null>(null);
  const [freezeReasonInput, setFreezeReasonInput] = useState<string>('');
  const [isSubmittingFreeze, setIsSubmittingFreeze] = useState<boolean>(false);

  // Permanent Delete Confirmation Modal
  const [deleteModalRoom, setDeleteModalRoom] = useState<AdminRoomRecord | null>(null);
  const [isSubmittingDelete, setIsSubmittingDelete] = useState<boolean>(false);

  const fetchRooms = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/rooms', {
        headers: getAdminHeaders(),
        cache: 'no-store',
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        onToast('error', data?.message || (isAr ? 'فشل جلب قائمة الغرف' : 'Failed to load rooms'));
        return;
      }
      if (Array.isArray(data.rooms)) {
        setRooms(data.rooms);
      }
    } catch (err: any) {
      onToast('error', err?.message || (isAr ? 'تعذر الاتصال بالخادم' : 'Network error'));
    } finally {
      setIsLoading(false);
    }
  }, [getAdminHeaders, isAr, onToast]);

  useEffect(() => {
    fetchRooms();
  }, [refreshSignal]);

  const counts = useMemo(() => {
    let publicCount = 0;
    let privateCount = 0;
    let hiddenCount = 0;
    let frozenCount = 0;
    let liveOccupants = 0;

    for (const r of rooms) {
      if (r.isPublic) publicCount += 1;
      else privateCount += 1;
      if (r.isHidden) hiddenCount += 1;
      if (r.isFrozen) frozenCount += 1;
      liveOccupants += Number(r.occupantsCount || 0);
    }

    return {
      total: rooms.length,
      publicCount,
      privateCount,
      hiddenCount,
      frozenCount,
      liveOccupants,
    };
  }, [rooms]);

  const filteredRooms = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rooms.filter((r) => {
      if (filterMode === 'public' && !r.isPublic) return false;
      if (filterMode === 'private' && r.isPublic) return false;
      if (filterMode === 'hidden' && !r.isHidden) return false;
      if (filterMode === 'frozen' && !r.isFrozen) return false;

      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q) ||
        (r.ownerName || '').toLowerCase().includes(q) ||
        (r.ownerDisplayId || '').toLowerCase().includes(q) ||
        (r.ownerEmail || '').toLowerCase().includes(q)
      );
    });
  }, [rooms, filterMode, searchQuery]);

  const filteredCandidateUsers = useMemo(() => {
    const q = ownerSearchQuery.trim().toLowerCase();
    const list = users.filter((u) => {
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        (u.displayId || '').toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q)
      );
    });
    return list.slice(0, 40);
  }, [users, ownerSearchQuery]);

  // Action 1: Toggle Public / Private
  const handleTogglePrivacy = async (room: AdminRoomRecord) => {
    const nextPublic = !room.isPublic;
    const key = `privacy:${room.id}`;
    setBusyActionKey(key);
    try {
      const res = await fetch(`/api/admin/rooms/${encodeURIComponent(room.id)}/privacy`, {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ isPublic: nextPublic }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        onToast('error', data?.message || (isAr ? 'فشل تغيير خصوصية الغرفة' : 'Failed to update privacy'));
        return;
      }
      setRooms((prev) =>
        prev.map((r) =>
          r.id === room.id
            ? { ...r, isPublic: Boolean(data.isPublic), isLocked: Boolean(data.isLocked) }
            : r
        )
      );
      onToast(
        'success',
        data.message ||
          (nextPublic
            ? isAr
              ? 'تم تحويل الغرفة إلى عامة'
              : 'Room switched to Public'
            : isAr
            ? 'تم تحويل الغرفة إلى خاصة'
            : 'Room switched to Private')
      );
    } catch (err: any) {
      onToast('error', err?.message || (isAr ? 'حدث خطأ أثناء العملية' : 'Action failed'));
    } finally {
      setBusyActionKey(null);
    }
  };

  // Action 2: Toggle Complete UI Hide
  const handleToggleHide = async (room: AdminRoomRecord) => {
    const nextHidden = !room.isHidden;
    const key = `hide:${room.id}`;
    setBusyActionKey(key);
    try {
      const res = await fetch(`/api/admin/rooms/${encodeURIComponent(room.id)}/hide`, {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ isHidden: nextHidden }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        onToast('error', data?.message || (isAr ? 'فشل تحديث حالة الإخفاء' : 'Failed to toggle visibility'));
        return;
      }
      setRooms((prev) =>
        prev.map((r) => (r.id === room.id ? { ...r, isHidden: Boolean(data.isHidden) } : r))
      );
      onToast(
        'success',
        data.message ||
          (nextHidden
            ? isAr
              ? 'تم إخفاء الغرفة بالكامل من الواجهة'
              : 'Room completely hidden from UI'
            : isAr
            ? 'تم إظهار الغرفة في الواجهة'
            : 'Room is now visible in UI')
      );
    } catch (err: any) {
      onToast('error', err?.message || (isAr ? 'حدث خطأ أثناء العملية' : 'Action failed'));
    } finally {
      setBusyActionKey(null);
    }
  };

  // Action 3: Administrative Freeze / Unfreeze
  const handleUnfreezeDirect = async (room: AdminRoomRecord) => {
    const key = `freeze:${room.id}`;
    setBusyActionKey(key);
    try {
      const res = await fetch(`/api/admin/rooms/${encodeURIComponent(room.id)}/freeze`, {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ isFrozen: false }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        onToast('error', data?.message || (isAr ? 'فشل فك التجميد الإداري' : 'Failed to unfreeze room'));
        return;
      }
      setRooms((prev) =>
        prev.map((r) =>
          r.id === room.id ? { ...r, isFrozen: false, freezeReason: null, frozenAt: null } : r
        )
      );
      onToast('success', data.message || (isAr ? 'تم فك التجميد الإداري بنجاح' : 'Room unfrozen'));
    } catch (err: any) {
      onToast('error', err?.message || (isAr ? 'حدث خطأ أثناء العملية' : 'Action failed'));
    } finally {
      setBusyActionKey(null);
    }
  };

  const handleConfirmFreeze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!freezeModalRoom) return;
    setIsSubmittingFreeze(true);
    try {
      const res = await fetch(`/api/admin/rooms/${encodeURIComponent(freezeModalRoom.id)}/freeze`, {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          isFrozen: true,
          reason: freezeReasonInput.trim(),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        onToast('error', data?.message || (isAr ? 'فشل تجميد الغرفة إدارياً' : 'Failed to freeze room'));
        return;
      }
      setRooms((prev) =>
        prev.map((r) =>
          r.id === freezeModalRoom.id
            ? {
                ...r,
                isFrozen: true,
                freezeReason: data.freezeReason || freezeReasonInput.trim() || null,
                frozenAt: data.frozenAt || new Date().toISOString(),
                occupantsCount: 0,
                occupiedSeatsCount: 0,
              }
            : r
        )
      );
      onToast('success', data.message || (isAr ? 'تم تجميد الغرفة إدارياً' : 'Room administratively frozen'));
      setFreezeModalRoom(null);
      setFreezeReasonInput('');
    } catch (err: any) {
      onToast('error', err?.message || (isAr ? 'حدث خطأ أثناء العملية' : 'Action failed'));
    } finally {
      setIsSubmittingFreeze(false);
    }
  };

  // Action 4: Change Primary Admin (Owner)
  const openOwnerModal = (room: AdminRoomRecord) => {
    setOwnerModalRoom(room);
    setOwnerSearchQuery('');
    setSelectedOwnerIdentifier('');
    setKeepPreviousAsHeadAdmin(true);
  };

  const handleConfirmChangeOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerModalRoom) return;
    const identifier = selectedOwnerIdentifier.trim();
    if (!identifier) {
      onToast('error', isAr ? 'يرجى اختيار أو إدخال المستخدم الجديد' : 'Select or enter the new primary admin');
      return;
    }

    setIsSubmittingOwner(true);
    try {
      const res = await fetch(`/api/admin/rooms/${encodeURIComponent(ownerModalRoom.id)}/owner`, {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          newOwnerIdentifier: identifier,
          keepPreviousAsHeadAdmin,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        onToast('error', data?.message || (isAr ? 'فشل تغيير الأدمن الأساسي' : 'Failed to change primary admin'));
        return;
      }
      onToast('success', data.message || (isAr ? 'تم تغيير الأدمن الأساسي بنجاح' : 'Primary admin updated'));
      setOwnerModalRoom(null);
      await fetchRooms();
    } catch (err: any) {
      onToast('error', err?.message || (isAr ? 'حدث خطأ أثناء العملية' : 'Action failed'));
    } finally {
      setIsSubmittingOwner(false);
    }
  };

  // Action 5: Permanent Delete Room
  const handleConfirmDeleteRoom = async () => {
    if (!deleteModalRoom) return;
    setIsSubmittingDelete(true);
    try {
      const res = await fetch(`/api/admin/rooms/${encodeURIComponent(deleteModalRoom.id)}`, {
        method: 'DELETE',
        headers: getAdminHeaders(),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        onToast('error', data?.message || (isAr ? 'فشل حذف الغرفة نهائياً' : 'Failed to delete room'));
        return;
      }
      setRooms((prev) => prev.filter((r) => r.id !== deleteModalRoom.id));
      onToast('success', data.message || (isAr ? 'تم حذف الغرفة نهائياً' : 'Room permanently deleted'));
      setDeleteModalRoom(null);
    } catch (err: any) {
      onToast('error', err?.message || (isAr ? 'حدث خطأ أثناء الحذف' : 'Delete failed'));
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/25 shrink-0">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-neutral-900 dark:text-white">
                {isAr ? 'إدارة الغرف الصوتية' : 'Voice Rooms Administration'}
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                {isAr
                  ? 'تحكم كامل في الغرف: نقل الأدمن الأساسي، التحويل بين عامة وخاصة، الإخفاء من الواجهة، التجميد الإداري، أو الحذف النهائي.'
                  : 'Full room moderation: reassign primary owner, toggle public/private, hide from UI, freeze administratively, or permanently delete.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchRooms}
            disabled={isLoading}
            className="px-3.5 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isAr ? 'تحديث القائمة' : 'Refresh'}</span>
          </button>
        </div>

        {/* Summary KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`text-start p-3.5 rounded-2xl border transition-all cursor-pointer ${
              filterMode === 'all'
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 border-transparent shadow-sm'
                : 'bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-bold opacity-75">
              <span>{isAr ? 'إجمالي الغرف' : 'Total Rooms'}</span>
              <Mic className="w-3.5 h-3.5" />
            </div>
            <div className="mt-1.5 flex items-baseline justify-between gap-2">
              <span className="text-xl font-black font-mono">{counts.total}</span>
              <span className="text-[10px] font-bold opacity-75">
                {counts.liveOccupants} {isAr ? 'متصل' : 'live'}
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setFilterMode('public')}
            className={`text-start p-3.5 rounded-2xl border transition-all cursor-pointer ${
              filterMode === 'public'
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                : 'bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 hover:border-emerald-500/30'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              <span>{isAr ? 'غرف عامة' : 'Public'}</span>
              <Globe className="w-3.5 h-3.5" />
            </div>
            <div className="mt-1.5 text-xl font-black font-mono text-neutral-900 dark:text-white">
              {counts.publicCount}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setFilterMode('private')}
            className={`text-start p-3.5 rounded-2xl border transition-all cursor-pointer ${
              filterMode === 'private'
                ? 'bg-violet-500/15 border-violet-500/40 text-violet-700 dark:text-violet-300'
                : 'bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 hover:border-violet-500/30'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-bold text-violet-600 dark:text-violet-400">
              <span>{isAr ? 'غرف خاصة' : 'Private'}</span>
              <Lock className="w-3.5 h-3.5" />
            </div>
            <div className="mt-1.5 text-xl font-black font-mono text-neutral-900 dark:text-white">
              {counts.privateCount}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setFilterMode('hidden')}
            className={`text-start p-3.5 rounded-2xl border transition-all cursor-pointer ${
              filterMode === 'hidden'
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300'
                : 'bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 hover:border-amber-500/30'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-bold text-amber-600 dark:text-amber-400">
              <span>{isAr ? 'مخفية من الواجهة' : 'Hidden'}</span>
              <EyeOff className="w-3.5 h-3.5" />
            </div>
            <div className="mt-1.5 text-xl font-black font-mono text-neutral-900 dark:text-white">
              {counts.hiddenCount}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setFilterMode('frozen')}
            className={`text-start p-3.5 rounded-2xl border transition-all cursor-pointer col-span-2 sm:col-span-1 ${
              filterMode === 'frozen'
                ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-700 dark:text-cyan-300'
                : 'bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 hover:border-cyan-500/30'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-bold text-cyan-600 dark:text-cyan-400">
              <span>{isAr ? 'مجمّدة إدارياً' : 'Frozen'}</span>
              <Snowflake className="w-3.5 h-3.5" />
            </div>
            <div className="mt-1.5 text-xl font-black font-mono text-neutral-900 dark:text-white">
              {counts.frozenCount}
            </div>
          </button>
        </div>

        {/* Search + Filter Controls */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-400 absolute top-1/2 -translate-y-1/2 start-3.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                isAr
                  ? 'بحث باسم الغرفة، الكود (SX-...)، أو اسم/بريد/ID الأدمن الأساسي...'
                  : 'Search by room name, code (SX-...), or owner name/ID/email...'
              }
              className="w-full h-11 ps-10 pe-9 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs font-medium text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="p-1 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-400 absolute top-1/2 -translate-y-1/2 end-2.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {(
              [
                { id: 'all', label: isAr ? 'الكل' : 'All' },
                { id: 'public', label: isAr ? 'عامة' : 'Public' },
                { id: 'private', label: isAr ? 'خاصة' : 'Private' },
                { id: 'hidden', label: isAr ? 'مخفية' : 'Hidden' },
                { id: 'frozen', label: isAr ? 'مجمّدة' : 'Frozen' },
              ] as Array<{ id: RoomFilterMode; label: string }>
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilterMode(f.id)}
                className={`px-3 py-2 rounded-xl text-xs font-bold shrink-0 transition-colors cursor-pointer ${
                  filterMode === f.id
                    ? 'bg-amber-500 text-neutral-950 shadow-xs'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Rooms List */}
      {isLoading && rooms.length === 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div
              key={idx}
              className="h-56 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 animate-pulse"
            />
          ))}
        </div>
      ) : filteredRooms.length === 0 ? (
        <div className="p-10 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-400 flex items-center justify-center mx-auto">
            <Mic className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-neutral-900 dark:text-white">
            {isAr ? 'لا توجد غرف مطابقة للبحث أو الفلتر' : 'No matching rooms found'}
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {isAr ? 'جرّب تغيير الفلتر أو مسح عبارة البحث.' : 'Try changing the filter or clearing the search query.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filteredRooms.map((room) => {
            const categoryLabel =
              CATEGORY_LABELS[room.category]?.[isAr ? 'ar' : 'en'] || room.category;
            const privacyBusy = busyActionKey === `privacy:${room.id}`;
            const hideBusy = busyActionKey === `hide:${room.id}`;
            const freezeBusy = busyActionKey === `freeze:${room.id}`;

            return (
              <div
                key={room.id}
                className={`p-4 sm:p-5 rounded-3xl bg-white dark:bg-neutral-900 border transition-all space-y-4 ${
                  room.isFrozen
                    ? 'border-cyan-500/40 bg-cyan-500/[0.03]'
                    : room.isHidden
                    ? 'border-amber-500/40 bg-amber-500/[0.02]'
                    : 'border-neutral-200 dark:border-neutral-800'
                }`}
              >
                {/* Top Row: Cover, Title, Code & Status Badges */}
                <div className="flex items-start gap-3.5">
                  <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-neutral-900 border border-neutral-200 dark:border-neutral-700 shrink-0">
                    {room.coverUrl ? (
                      <img
                        src={room.coverUrl}
                        alt={room.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-amber-500">
                        <Mic className="w-6 h-6" />
                      </div>
                    )}
                    {room.isFrozen && (
                      <div className="absolute inset-0 bg-cyan-950/60 flex items-center justify-center">
                        <Snowflake className="w-6 h-6 text-cyan-300" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="text-sm sm:text-base font-black text-neutral-900 dark:text-white truncate">
                          {room.name}
                        </h4>
                        <div className="flex items-center flex-wrap gap-1.5 mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                          <span className="font-mono font-bold px-1.5 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200">
                            {room.code}
                          </span>
                          <span>•</span>
                          <span>{categoryLabel}</span>
                          {room.isLocked && (
                            <>
                              <span>•</span>
                              <span className="text-rose-500 font-bold">
                                {isAr ? 'مقفلة' : 'Locked'}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status Badges */}
                    <div className="flex items-center flex-wrap gap-1.5 pt-0.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black border ${
                          room.isPublic
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25'
                            : 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/25'
                        }`}
                      >
                        {room.isPublic ? (
                          <Globe className="w-3 h-3" />
                        ) : (
                          <Lock className="w-3 h-3" />
                        )}
                        {room.isPublic
                          ? isAr
                            ? 'غرفة عامة'
                            : 'Public'
                          : isAr
                          ? 'غرفة خاصة'
                          : 'Private'}
                      </span>

                      {room.isHidden && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                          <EyeOff className="w-3 h-3" />
                          {isAr ? 'مخفية من الواجهة' : 'Hidden from UI'}
                        </span>
                      )}

                      {room.isFrozen && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30">
                          <Snowflake className="w-3 h-3" />
                          {isAr ? 'مجمّدة إدارياً' : 'Admin Frozen'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Freeze Banner if Frozen */}
                {room.isFrozen && (
                  <div className="p-2.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/25 text-[11px] text-cyan-800 dark:text-cyan-200 flex items-start gap-2">
                    <Snowflake className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
                    <div className="min-w-0 space-y-0.5">
                      <div className="font-bold">
                        {isAr ? 'الغرفة مجمدة إدارياً ولا يمكن دخولها' : 'Room is frozen and inaccessible to users'}
                      </div>
                      {room.freezeReason && (
                        <div className="opacity-90 break-words">
                          {isAr ? 'السبب:' : 'Reason:'} {room.freezeReason}
                        </div>
                      )}
                      {room.frozenAt && (
                        <div className="text-[10px] opacity-75 font-mono">
                          {formatLocalDateTime(room.frozenAt, lang)}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Primary Admin (Owner) + Room Metrics */}
                <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25 flex items-center justify-center shrink-0 overflow-hidden">
                        {room.ownerAvatar ? (
                          <img
                            src={room.ownerAvatar}
                            alt={room.ownerName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Crown className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1 text-xs font-black text-neutral-900 dark:text-white truncate">
                          <span className="truncate">{room.ownerName}</span>
                          {room.ownerIsVerified && <VerifiedBadge size="sm" />}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 dark:text-neutral-400 truncate">
                          <span className="font-bold text-amber-600 dark:text-amber-400">
                            {isAr ? 'الأدمن الأساسي' : 'Primary Admin'}
                          </span>
                          {room.ownerDisplayId && (
                            <span className="font-mono">• {room.ownerDisplayId}</span>
                          )}
                          {room.ownerEmail && (
                            <span className="truncate hidden sm:inline">• {room.ownerEmail}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => openOwnerModal(room)}
                      className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 hover:border-amber-500/50 text-[11px] font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                    >
                      <UserCog className="w-3.5 h-3.5 text-amber-500" />
                      <span>{isAr ? 'تعديل الأدمن' : 'Change Owner'}</span>
                    </button>
                  </div>

                  {/* Quick Stats Strip */}
                  <div className="grid grid-cols-4 gap-2 pt-2 border-t border-neutral-200/70 dark:border-neutral-800/80 text-[11px]">
                    <div className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300">
                      <Users className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                      <span className="font-mono font-bold">{room.occupantsCount}</span>
                      <span className="text-[10px] text-neutral-400 hidden sm:inline">
                        {isAr ? 'متواجد' : 'live'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300">
                      <Armchair className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span className="font-mono font-bold">
                        {room.occupiedSeatsCount}/{room.maxSeats}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300">
                      <MessageCircle className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                      <span className="font-mono font-bold">{room.messagesCount}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300">
                      <Coins className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span className="font-mono font-bold truncate">
                        {Number(room.totalGiftsCoins || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 5 Administrative Controls Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {/* 1. Toggle Public / Private */}
                  <button
                    type="button"
                    disabled={privacyBusy}
                    onClick={() => handleTogglePrivacy(room)}
                    className={`h-10 px-3 rounded-xl text-[11px] font-bold border flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 ${
                      room.isPublic
                        ? 'bg-violet-500/10 hover:bg-violet-500/20 text-violet-700 dark:text-violet-300 border-violet-500/25'
                        : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/25'
                    }`}
                  >
                    {privacyBusy ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : room.isPublic ? (
                      <Lock className="w-3.5 h-3.5" />
                    ) : (
                      <Globe className="w-3.5 h-3.5" />
                    )}
                    <span className="truncate">
                      {room.isPublic
                        ? isAr
                          ? 'تحويل لخاصة'
                          : 'Make Private'
                        : isAr
                        ? 'تحويل لعامة'
                        : 'Make Public'}
                    </span>
                  </button>

                  {/* 2. Toggle Complete Hide From UI */}
                  <button
                    type="button"
                    disabled={hideBusy}
                    onClick={() => handleToggleHide(room)}
                    className={`h-10 px-3 rounded-xl text-[11px] font-bold border flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 ${
                      room.isHidden
                        ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/25'
                        : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/25'
                    }`}
                  >
                    {hideBusy ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : room.isHidden ? (
                      <Eye className="w-3.5 h-3.5" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5" />
                    )}
                    <span className="truncate">
                      {room.isHidden
                        ? isAr
                          ? 'إظهار بالواجهة'
                          : 'Show in UI'
                        : isAr
                        ? 'إخفاء كامل'
                        : 'Hide Completely'}
                    </span>
                  </button>

                  {/* 3. Administrative Freeze / Unfreeze */}
                  {room.isFrozen ? (
                    <button
                      type="button"
                      disabled={freezeBusy}
                      onClick={() => handleUnfreezeDirect(room)}
                      className="h-10 px-3 rounded-xl text-[11px] font-bold border bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {freezeBusy ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Unlock className="w-3.5 h-3.5" />
                      )}
                      <span className="truncate">{isAr ? 'فك التجميد' : 'Unfreeze'}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setFreezeModalRoom(room);
                        setFreezeReasonInput('');
                      }}
                      className="h-10 px-3 rounded-xl text-[11px] font-bold border bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border-cyan-500/25 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Snowflake className="w-3.5 h-3.5" />
                      <span className="truncate">{isAr ? 'تجميد إداري' : 'Admin Freeze'}</span>
                    </button>
                  )}

                  {/* 4. Change Primary Admin */}
                  <button
                    type="button"
                    onClick={() => openOwnerModal(room)}
                    className="h-10 px-3 rounded-xl text-[11px] font-bold border bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 border-neutral-200 dark:border-neutral-700 flex items-center justify-center gap-1.5 transition-all cursor-pointer sm:col-span-2"
                  >
                    <UserCog className="w-3.5 h-3.5 text-amber-500" />
                    <span className="truncate">
                      {isAr ? 'تعديل الأدمن الأساسي' : 'Edit Primary Admin'}
                    </span>
                  </button>

                  {/* 5. Permanent Delete */}
                  <button
                    type="button"
                    onClick={() => setDeleteModalRoom(room)}
                    className="h-10 px-3 rounded-xl text-[11px] font-bold border bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/25 flex items-center justify-center gap-1.5 transition-all cursor-pointer col-span-2 sm:col-span-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="truncate">{isAr ? 'حذف نهائي' : 'Delete Room'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =========================================================================
          MODAL 1: CHANGE PRIMARY ADMIN (تعديل الأدمن الأساسي للغرفة)
          ========================================================================= */}
      {ownerModalRoom && (
        <div
          onClick={() => !isSubmittingOwner && setOwnerModalRoom(null)}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-md"
        >
          <form
            onSubmit={handleConfirmChangeOwner}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25 flex items-center justify-center shrink-0">
                  <Crown className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-black text-neutral-900 dark:text-white">
                    {isAr ? 'تعديل الأدمن الأساسي للغرفة' : 'Change Primary Room Admin'}
                  </h4>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {ownerModalRoom.name} ({ownerModalRoom.code})
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isSubmittingOwner}
                onClick={() => setOwnerModalRoom(null)}
                className="p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs flex items-center justify-between gap-2">
              <span className="text-neutral-500 dark:text-neutral-400">
                {isAr ? 'الأدمن الحالي:' : 'Current Owner:'}
              </span>
              <span className="font-bold text-neutral-900 dark:text-white truncate">
                {ownerModalRoom.ownerName}{' '}
                {ownerModalRoom.ownerDisplayId ? `(${ownerModalRoom.ownerDisplayId})` : ''}
              </span>
            </div>

            {/* Search Registered Users */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300">
                {isAr ? 'اختر المستخدم الجديد من القائمة' : 'Select New Owner From Users'}
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-neutral-400 absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none" />
                <input
                  type="text"
                  value={ownerSearchQuery}
                  onChange={(e) => setOwnerSearchQuery(e.target.value)}
                  placeholder={isAr ? 'ابحث بالاسم أو ID أو البريد...' : 'Search by name, ID, or email...'}
                  className="w-full h-10 ps-9 pe-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                />
              </div>

              <div className="max-h-48 overflow-y-auto rounded-2xl border border-neutral-200 dark:border-neutral-800 divide-y divide-neutral-100 dark:divide-neutral-800/80">
                {filteredCandidateUsers.length === 0 ? (
                  <div className="p-4 text-center text-xs text-neutral-500">
                    {isAr ? 'لا يوجد مستخدمون مطابقون للبحث' : 'No matching users'}
                  </div>
                ) : (
                  filteredCandidateUsers.map((u) => {
                    const isCurrent = u.id === ownerModalRoom.ownerId;
                    const isDisabled = Boolean(u.isBanned) || isCurrent;
                    const isSelected = selectedOwnerIdentifier === u.id;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => setSelectedOwnerIdentifier(u.id)}
                        className={`w-full px-3 py-2.5 text-start flex items-center justify-between gap-2.5 transition-colors ${
                          isDisabled
                            ? 'opacity-45 cursor-not-allowed bg-neutral-50 dark:bg-neutral-950/50'
                            : isSelected
                            ? 'bg-amber-500/15 text-neutral-900 dark:text-white cursor-pointer'
                            : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/60 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-neutral-200 dark:bg-neutral-800 text-xs font-bold flex items-center justify-center shrink-0 overflow-hidden">
                            {u.photoUrl ? (
                              <img src={u.photoUrl} alt={u.name} className="w-full h-full object-cover" />
                            ) : (
                              u.name.substring(0, 2)
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1 text-xs font-bold text-neutral-900 dark:text-white truncate">
                              <span className="truncate">{u.name}</span>
                              {u.isVerified && <VerifiedBadge size="sm" />}
                            </div>
                            <div className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate">
                              {u.displayId ? `${u.displayId} • ` : ''}
                              {u.email}
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0">
                          {isCurrent ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                              {isAr ? 'الحالي' : 'Current'}
                            </span>
                          ) : u.isBanned ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-500">
                              {isAr ? 'محظور' : 'Banned'}
                            </span>
                          ) : isSelected ? (
                            <Check className="w-4 h-4 text-amber-500" />
                          ) : null}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Manual Identifier Fallback */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-neutral-600 dark:text-neutral-400">
                {isAr
                  ? 'أو أدخل المعرف يدوياً (ID / Display ID / البريد الإلكتروني)'
                  : 'Or enter identifier manually (ID / Display ID / Email)'}
              </label>
              <input
                type="text"
                value={selectedOwnerIdentifier}
                onChange={(e) => setSelectedOwnerIdentifier(e.target.value)}
                placeholder="SX-10001 / user@example.com"
                className="w-full h-10 px-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs font-mono text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              />
            </div>

            {/* Keep Previous Owner as Head Admin */}
            <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 cursor-pointer">
              <input
                type="checkbox"
                checked={keepPreviousAsHeadAdmin}
                onChange={(e) => setKeepPreviousAsHeadAdmin(e.target.checked)}
                className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
              />
              <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                {isAr
                  ? 'إبقاء الأدمن الأساسي السابق كمشرف رئيسي (Head Admin) في الغرفة'
                  : 'Keep previous owner as Head Admin in the room'}
              </span>
            </label>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={isSubmittingOwner}
                onClick={() => setOwnerModalRoom(null)}
                className="px-4 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 cursor-pointer"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={isSubmittingOwner || !selectedOwnerIdentifier.trim()}
                className="px-5 h-10 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-black flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmittingOwner && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{isAr ? 'تأكيد نقل الملكية' : 'Confirm Transfer'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: ADMINISTRATIVE FREEZE (تجميد إداري للغرفة)
          ========================================================================= */}
      {freezeModalRoom && (
        <div
          onClick={() => !isSubmittingFreeze && setFreezeModalRoom(null)}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-md"
        >
          <form
            onSubmit={handleConfirmFreeze}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl bg-white dark:bg-neutral-900 border border-cyan-500/30 p-5 sm:p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 text-cyan-500 border border-cyan-500/25 flex items-center justify-center shrink-0">
                  <Snowflake className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-black text-neutral-900 dark:text-white">
                    {isAr ? 'تجميد إداري للغرفة' : 'Administrative Room Freeze'}
                  </h4>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {freezeModalRoom.name} ({freezeModalRoom.code})
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isSubmittingFreeze}
                onClick={() => setFreezeModalRoom(null)}
                className="p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/25 text-xs text-cyan-800 dark:text-cyan-200 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
              <span>
                {isAr
                  ? 'سيتم إخراج جميع المتواجدين وإخلاء المقاعد وإيقاف الموسيقى والألعاب فوراً ومنع دخول أي مستخدم حتى فك التجميد.'
                  : 'All live occupants will be disconnected, seats vacated, and access blocked until unfrozen.'}
              </span>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300">
                {isAr ? 'سبب التجميد الإداري (اختياري)' : 'Freeze Reason (Optional)'}
              </label>
              <textarea
                rows={3}
                maxLength={300}
                value={freezeReasonInput}
                onChange={(e) => setFreezeReasonInput(e.target.value)}
                placeholder={
                  isAr
                    ? 'مثال: مخالفة قوانين الغرف الصوتية أو قيد المراجعة الإدارية...'
                    : 'e.g., Policy violation or pending administrative review...'
                }
                className="w-full p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isSubmittingFreeze}
                onClick={() => setFreezeModalRoom(null)}
                className="px-4 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 cursor-pointer"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={isSubmittingFreeze}
                className="px-5 h-10 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-neutral-950 text-xs font-black flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmittingFreeze ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Snowflake className="w-3.5 h-3.5" />
                )}
                <span>{isAr ? 'تأكيد التجميد' : 'Freeze Room'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: PERMANENT DELETE CONFIRMATION (حذف الغرفة نهائياً)
          ========================================================================= */}
      {deleteModalRoom && (
        <div
          onClick={() => !isSubmittingDelete && setDeleteModalRoom(null)}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-md"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl bg-white dark:bg-neutral-900 border border-rose-500/35 p-5 sm:p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/15 text-rose-500 border border-rose-500/25 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-black text-neutral-900 dark:text-white">
                    {isAr ? 'تأكيد الحذف النهائي للغرفة' : 'Confirm Permanent Room Deletion'}
                  </h4>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {deleteModalRoom.name} ({deleteModalRoom.code})
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isSubmittingDelete}
                onClick={() => setDeleteModalRoom(null)}
                className="p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-700 dark:text-rose-300 space-y-1">
              <p className="font-black">
                {isAr
                  ? 'هذا الإجراء نهائي ولا يمكن التراجع عنه!'
                  : 'This action is permanent and cannot be undone!'}
              </p>
              <p className="opacity-90">
                {isAr
                  ? 'سيتم فصل جميع المستخدمين المتواجدين وحذف الغرفة وسجل الرسائل والمقاعد والمشرفين وصورة الغلاف نهائياً من قاعدة البيانات.'
                  : 'All connected users will be disconnected and the room, messages, seats, moderators, and cover will be permanently erased.'}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isSubmittingDelete}
                onClick={() => setDeleteModalRoom(null)}
                className="px-4 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 cursor-pointer"
              >
                {isAr ? 'تراجع' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={isSubmittingDelete}
                onClick={handleConfirmDeleteRoom}
                className="px-5 h-10 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmittingDelete ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>{isAr ? 'حذف الغرفة نهائياً' : 'Delete Permanently'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
