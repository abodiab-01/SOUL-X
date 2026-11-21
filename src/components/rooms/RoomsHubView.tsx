import React, { useState, useEffect, useCallback } from 'react';
import {
  Mic,
  Video,
  Lock,
  Plus,
  Search,
  Hash,
  Users,
  Armchair,
  Star,
  Copy,
  Check,
  Sparkles,
  RefreshCw,
  Snowflake,
} from 'lucide-react';
import { AuthUser, Language, RoomSummary } from '../../types';
import { roomsApi, RoomsListResponse } from '../../lib/roomsApi';
import { getEffectiveAvatar, getDefaultAvatar } from '../../lib/avatar';
import { VerifiedBadge } from '../VerifiedBadge';
import { CoinIcon } from '../CurrencyIcons';
import { CreateRoomModal } from './CreateRoomModal';

interface RoomsHubViewProps {
  lang: Language;
  currentUser: AuthUser;
  coinsBalance: number;
  onCoinsSync: (nextCoins: number) => void;
  onOpenWallet: () => void;
  onEnterRoom: (roomCode: string) => void;
}

export const RoomsHubView: React.FC<RoomsHubViewProps> = ({
  lang,
  currentUser,
  coinsBalance,
  onCoinsSync,
  onOpenWallet,
  onEnterRoom,
}) => {
  const isAr = lang === 'ar';
  // Strictly 2 tabs only: Voice (active) and Video (locked - Coming Soon)
  const [nameQuery, setNameQuery] = useState('');
  const [directCode, setDirectCode] = useState('');
  const [sortBy, setSortBy] = useState<'activity' | 'users' | 'newest'>('activity');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<RoomsListResponse | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    try {
      const res = await roomsApi.list({
        q: nameQuery.trim() || undefined,
        code: directCode.trim() || undefined,
        sort: sortBy,
      });
      if (res.success) {
        setData(res);
      }
    } finally {
      setLoading(false);
    }
  }, [nameQuery, directCode, sortBy]);

  useEffect(() => {
    const t = setTimeout(() => {
      fetchRooms();
    }, 180);
    return () => clearTimeout(t);
  }, [fetchRooms]);

  const handleToggleFavorite = async (e: React.MouseEvent, room: RoomSummary) => {
    e.stopPropagation();
    const res = await roomsApi.toggleFavorite(room.code);
    if (res.success) {
      fetchRooms();
    }
  };

  const handleCopyCode = (e: React.MouseEvent, code: string) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1600);
  };

  const renderRoomCard = (room: RoomSummary) => (
    <div
      key={room.id}
      onClick={() => {
        if (room.isFrozen) {
          showToast(
            room.freezeReason
              ? (isAr ? `الغرفة مجمّدة إدارياً: ${room.freezeReason}` : `Room frozen: ${room.freezeReason}`)
              : (isAr ? 'هذه الغرفة مجمّدة إدارياً حالياً' : 'This room is administratively frozen')
          );
          return;
        }
        onEnterRoom(room.code);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          if (room.isFrozen) {
            showToast(
              room.freezeReason
                ? (isAr ? `الغرفة مجمّدة إدارياً: ${room.freezeReason}` : `Room frozen: ${room.freezeReason}`)
                : (isAr ? 'هذه الغرفة مجمّدة إدارياً حالياً' : 'This room is administratively frozen')
            );
            return;
          }
          onEnterRoom(room.code);
        }
      }}
      className={`group relative aspect-square w-full rounded-2xl sm:rounded-3xl bg-gradient-to-br from-neutral-800 to-neutral-950 border overflow-hidden shadow-sm hover:shadow-lg transition-all cursor-pointer select-none ${
        room.isFrozen
          ? 'border-cyan-500/50 opacity-85'
          : 'border-neutral-200 dark:border-neutral-800 hover:border-cyan-500/60'
      }`}
    >
      {/* Full-bleed Square Cover Image */}
      {room.coverUrl && (
        <img
          src={room.coverUrl}
          referrerPolicy="no-referrer"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
          alt={room.name}
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/45" />

      {/* Top Overlay: Status Badges & Quick Actions */}
      <div className="absolute top-2 inset-x-2 sm:top-3 sm:inset-x-3 flex items-start justify-between gap-1">
        <div className="flex flex-wrap items-center gap-1 min-w-0">
          {room.isFrozen ? (
            <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black inline-flex items-center gap-1 bg-cyan-500/90 text-neutral-950 backdrop-blur-md">
              <Snowflake className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              <span>{isAr ? 'مجمّدة' : 'Frozen'}</span>
            </span>
          ) : (
            <span
              className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black inline-flex items-center gap-1 backdrop-blur-md ${
                room.isActive
                  ? 'bg-emerald-500/90 text-white'
                  : 'bg-neutral-900/75 text-neutral-200 border border-white/15'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${room.isActive ? 'bg-white animate-pulse' : 'bg-neutral-400'}`} />
              <span>{room.isActive ? (isAr ? 'نشطة' : 'Active') : (isAr ? 'هادئة' : 'Idle')}</span>
            </span>
          )}
          {room.isLocked && (
            <span className="p-1 rounded-full bg-amber-500/90 text-neutral-950" title={isAr ? 'مقفلة' : 'Locked'}>
              <Lock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
            </span>
          )}
          {room.isFeatured && (
            <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full bg-amber-400 text-neutral-950 text-[10px] font-black">
              {isAr ? 'مميزة' : 'Featured'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={(e) => handleToggleFavorite(e, room)}
            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full backdrop-blur-md flex items-center justify-center cursor-pointer transition-colors ${
              room.isFavorite
                ? 'bg-amber-400 text-neutral-950'
                : 'bg-black/50 text-white hover:bg-black/75'
            }`}
            title={isAr ? 'المفضلة' : 'Favorite'}
          >
            <Star className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${room.isFavorite ? 'fill-current' : ''}`} />
          </button>
        </div>
      </div>

      {/* Bottom Overlay: Name, Code, Counts & Compact Owner Bar */}
      <div className="absolute bottom-2 inset-x-2 sm:bottom-3 sm:inset-x-3 text-white space-y-1.5">
        <div className="space-y-1">
          <h3 className="text-xs sm:text-sm font-black truncate leading-tight drop-shadow-xs">
            {room.name}
          </h3>
          <div className="flex items-center justify-between gap-1 text-[10px] sm:text-[11px] font-mono">
            <button
              type="button"
              onClick={(e) => handleCopyCode(e, room.code)}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/15 backdrop-blur-md hover:bg-white/25 cursor-pointer truncate max-w-[58%]"
            >
              <span className="truncate">{room.code}</span>
              {copiedCode === room.code ? <Check className="w-2.5 h-2.5 text-emerald-400 shrink-0" /> : <Copy className="w-2.5 h-2.5 shrink-0" />}
            </button>
            <span className="inline-flex items-center gap-1.5 font-bold shrink-0">
              <span className="inline-flex items-center gap-0.5">
                <Users className="w-3 h-3 text-cyan-400" />
                {room.occupantsCount}
              </span>
              <span className="inline-flex items-center gap-0.5">
                <Armchair className="w-3 h-3 text-amber-400" />
                {room.occupiedSeatsCount}/{room.maxSeats}
              </span>
            </span>
          </div>
        </div>

        {/* Compact Owner Footer inside the square card (direct click anywhere on card enters room) */}
        <div className="pt-1.5 border-t border-white/15 flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <img
              src={getEffectiveAvatar(room.ownerAvatar)}
              onError={(e) => {
                e.currentTarget.src = getDefaultAvatar();
              }}
              alt={room.ownerName}
              className="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover border border-white/40 shrink-0"
            />
            <div className="min-w-0">
              <div className="text-[10px] sm:text-xs font-bold text-white/95 inline-flex items-center gap-0.5 truncate max-w-full">
                <span className="truncate">{room.ownerName}</span>
                {room.ownerIsVerified && <VerifiedBadge lang={lang} size="xs" />}
              </div>
              {room.friendsInsideCount > 0 && (
                <div className="text-[9px] font-bold text-cyan-300 truncate">
                  {isAr ? `${room.friendsInsideCount} صديق` : `${room.friendsInsideCount} friend`}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const sections = data?.sections;
  const allRooms = data?.rooms || [];
  const hasFilters = Boolean(nameQuery.trim() || directCode.trim());

  const organizedBlocks: Array<{ key: string; titleAr: string; titleEn: string; items: RoomSummary[] }> = sections
    ? [
        { key: 'friends', titleAr: 'غرف يتواجد فيها الأصدقاء', titleEn: 'Friends Are Here', items: sections.friendsInside },
        { key: 'featured', titleAr: 'غرف مميزة من الإدارة', titleEn: 'Featured Rooms', items: sections.featured },
        { key: 'active', titleAr: 'غرف نشطة الآن', titleEn: 'Active Now', items: sections.active },
        { key: 'favorites', titleAr: 'الغرف المفضلة', titleEn: 'Favorites', items: sections.favorites },
        { key: 'owned', titleAr: 'الغرف التي تملكها', titleEn: 'Your Rooms', items: sections.owned },
        { key: 'new', titleAr: 'غرف جديدة', titleEn: 'New Rooms', items: sections.newRooms },
      ].filter((b) => b.items.length > 0)
    : [];

  return (
    <div className="w-full max-w-6xl mx-auto px-3 sm:px-6 py-4 space-y-5" dir={isAr ? 'rtl' : 'ltr'}>
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[120] px-4 py-2 rounded-2xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 text-xs font-bold shadow-xl">
          {toast}
        </div>
      )}

      {/* Strictly 2 Tabs ONLY: Voice (active) & Video (Locked + Coming Soon) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="inline-flex p-1.5 rounded-2xl bg-neutral-200/80 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 self-start">
          <button
            type="button"
            className="px-5 py-2.5 rounded-xl bg-white dark:bg-neutral-800 text-cyan-600 dark:text-cyan-400 shadow-xs text-xs sm:text-sm font-black flex items-center gap-2 cursor-pointer"
          >
            <Mic className="w-4 h-4" />
            <span>{isAr ? 'صوت' : 'Voice'}</span>
          </button>

          <button
            type="button"
            disabled
            aria-disabled="true"
            className="px-5 py-2.5 rounded-xl text-neutral-400 dark:text-neutral-500 text-xs sm:text-sm font-bold flex items-center gap-2 cursor-not-allowed opacity-75"
            title={isAr ? 'قريباً — غرف الفيديو مقفلة حالياً' : 'Coming Soon — Video rooms are locked'}
          >
            <Video className="w-4 h-4" />
            <span>{isAr ? 'فيديو' : 'Video'}</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-neutral-300/70 dark:bg-neutral-800 text-[10px] font-black text-neutral-600 dark:text-neutral-400">
              <Lock className="w-3 h-3" />
              {isAr ? 'قريبًا' : 'Soon'}
            </span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="px-4 py-3 rounded-2xl bg-cyan-500 hover:bg-cyan-600 text-neutral-950 text-xs sm:text-sm font-black flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-cyan-500/20 active:scale-[0.98]"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>{isAr ? 'إنشاء غرفة صوتية' : 'Create Voice Room'}</span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-neutral-950/15 font-mono text-[11px]">
            <CoinIcon className="w-3.5 h-3.5" />
            25K
          </span>
        </button>
      </div>

      {/* Search & Direct Room ID Bar + Sort */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
        <div className="sm:col-span-5 relative">
          <Search className="w-4 h-4 text-neutral-400 absolute top-1/2 -translate-y-1/2 start-3.5" />
          <input
            type="text"
            value={nameQuery}
            onChange={(e) => setNameQuery(e.target.value)}
            placeholder={isAr ? 'ابحث باسم الغرفة أو المالك...' : 'Search by room name or host...'}
            className="w-full ps-10 pe-3.5 py-2.5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (directCode.trim()) onEnterRoom(directCode.trim().toUpperCase());
          }}
          className="sm:col-span-4 flex gap-1.5"
        >
          <div className="relative flex-1">
            <Hash className="w-4 h-4 text-neutral-400 absolute top-1/2 -translate-y-1/2 start-3" />
            <input
              type="text"
              value={directCode}
              onChange={(e) => setDirectCode(e.target.value)}
              placeholder={isAr ? 'معرّف الغرفة (SX-...)' : 'Room ID (SX-...)'}
              className="w-full ps-9 pe-3 py-2.5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs sm:text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          {directCode.trim() && (
            <button
              type="submit"
              className="px-3.5 py-2 rounded-2xl bg-cyan-500 text-neutral-950 text-xs font-black cursor-pointer shrink-0"
            >
              {isAr ? 'دخول' : 'Go'}
            </button>
          )}
        </form>

        <div className="sm:col-span-3 flex gap-1.5">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="flex-1 px-3 py-2.5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <option value="activity">{isAr ? 'الفرز: حسب النشاط' : 'Sort: Activity'}</option>
            <option value="users">{isAr ? 'الفرز: الأكثر متواجدين' : 'Sort: Most Users'}</option>
            <option value="newest">{isAr ? 'الفرز: الأحدث' : 'Sort: Newest'}</option>
          </select>
          <button
            type="button"
            onClick={fetchRooms}
            className="w-11 h-11 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-center text-neutral-600 dark:text-neutral-300 cursor-pointer shrink-0"
            title={isAr ? 'تحديث' : 'Refresh'}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* Directory Content */}
      {loading && !data ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="aspect-square rounded-2xl sm:rounded-3xl bg-neutral-200/70 dark:bg-neutral-800/60 animate-pulse" />
          ))}
        </div>
      ) : allRooms.length === 0 ? (
        <div className="rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-8 sm:p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-cyan-500 mx-auto">
            <Mic className="w-8 h-8" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-base sm:text-lg font-black text-neutral-900 dark:text-white">
              {hasFilters
                ? (isAr ? 'لم يتم العثور على غرف مطابقة' : 'No matching rooms found')
                : (isAr ? 'لا توجد غرف صوتية بعد' : 'No voice rooms yet')}
            </h3>
            <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
              {hasFilters
                ? (isAr ? 'جرب البحث بكلمة مختلفة أو امسح الفلاتر' : 'Try another search term or clear filters')
                : (isAr ? 'كن أول من ينشئ غرفة صوتية بـ 15 مقعداً ومعرّف دائم في SOUL-X!' : 'Be the first to create a permanent 15-seat voice room on SOUL-X!')}
            </p>
          </div>
          {!hasFilters && (
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="px-5 py-3 rounded-2xl bg-cyan-500 hover:bg-cyan-600 text-neutral-950 text-xs sm:text-sm font-black inline-flex items-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isAr ? 'إنشاء أول غرفة الآن' : 'Create First Room'}</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Organized non-empty sections */}
          {!hasFilters &&
            organizedBlocks.map((block) => (
              <section key={block.key} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm sm:text-base font-black text-neutral-900 dark:text-white">
                    {isAr ? block.titleAr : block.titleEn}
                  </h3>
                  <span className="text-xs font-mono font-bold text-neutral-400">{block.items.length}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  {block.items.slice(0, 6).map(renderRoomCard)}
                </div>
              </section>
            ))}

          {/* Full Rooms List */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-black text-neutral-900 dark:text-white">
                {hasFilters ? (isAr ? 'نتائج البحث' : 'Search Results') : (isAr ? 'كل الغرف الصوتية' : 'All Voice Rooms')}
              </h3>
              <span className="text-xs font-mono font-bold text-neutral-400">{allRooms.length}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {allRooms.map(renderRoomCard)}
            </div>
          </section>
        </div>
      )}

      <CreateRoomModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        lang={lang}
        coinsBalance={coinsBalance}
        onOpenWallet={onOpenWallet}
        onCreated={(room, nextCoins) => {
          onCoinsSync(nextCoins);
          fetchRooms();
          onEnterRoom(room.code);
        }}
      />
    </div>
  );
};
