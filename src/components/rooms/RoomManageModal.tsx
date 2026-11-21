import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Users,
  Shield,
  Lock,
  Unlock,
  Ban,
  Settings,
  FileText,
  Calendar,
  Hand,
  MicOff,
  Mic,
  Crown,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  Star,
  AlertTriangle,
  Search,
  Upload,
} from 'lucide-react';
import {
  Language,
  RoomAuditLogRecord,
  RoomBanRecord,
  RoomCategory,
  RoomDetail,
  RoomEventRecord,
  RoomModPermissions,
  RoomModRecord,
  RoomOccupantInfo,
  RoomQueueItem,
  RoomSeatInfo,
} from '../../types';
import { roomsApi } from '../../lib/roomsApi';
import { getEffectiveAvatar, getDefaultAvatar } from '../../lib/avatar';

interface RoomManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  room: RoomDetail;
  seats: RoomSeatInfo[];
  occupants: RoomOccupantInfo[];
  queue: RoomQueueItem[];
  moderators: RoomModRecord[];
  events: RoomEventRecord[];
  isPlatformAdmin: boolean;
  initialTab?: ManageTab;
  onRoomUpdated: (updated: RoomDetail) => void;
  onDeletedRoom: () => void;
  onRefreshRoom: () => void;
}

export type ManageTab = 'users' | 'queue' | 'mods' | 'lock' | 'bans' | 'events' | 'settings' | 'audit';

const PERM_LABELS: Array<{ key: keyof RoomModPermissions; ar: string; en: string }> = [
  { key: 'manageSeats', ar: 'إدارة المقاعد (صعود/إنزال/قفل)', en: 'Manage seats' },
  { key: 'muteUsers', ar: 'كتم مايك الأعضاء', en: 'Mute user mics' },
  { key: 'roomMuteAll', ar: 'كتم الغرفة بالكامل', en: 'Room-wide mute' },
  { key: 'acceptMicQueue', ar: 'قبول/رفض طلبات المايك', en: 'Accept mic requests' },
  { key: 'kickUsers', ar: 'طرد المستخدمين', en: 'Kick users' },
  { key: 'banUsers', ar: 'حظر وفك حظر المستخدمين', en: 'Ban & unban users' },
  { key: 'deleteMessages', ar: 'حذف رسائل الدردشة', en: 'Delete chat messages' },
  { key: 'pinMessages', ar: 'تثبيت الرسائل', en: 'Pin messages' },
  { key: 'pauseChat', ar: 'إيقاف/تشغيل الدردشة', en: 'Pause chat' },
  { key: 'manageLockPin', ar: 'قفل الغرفة والرمز السري', en: 'Lock & PIN management' },
  { key: 'manageGames', ar: 'تشغيل وإدارة الألعاب', en: 'Manage mini-games' },
  { key: 'manageMusic', ar: 'تشغيل وإدارة الموسيقى', en: 'Manage music' },
  { key: 'manageEvents', ar: 'إدارة أحداث الغرفة', en: 'Manage events' },
];

export const RoomManageModal: React.FC<RoomManageModalProps> = ({
  isOpen,
  onClose,
  lang,
  room,
  seats,
  occupants,
  queue,
  moderators,
  events,
  isPlatformAdmin,
  initialTab = 'users',
  onRoomUpdated,
  onDeletedRoom,
  onRefreshRoom,
}) => {
  const isAr = lang === 'ar';
  const [tab, setTab] = useState<ManageTab>(initialTab);
  const [toast, setToast] = useState<string | null>(null);

  // PIN & Lock state
  const [pinValue, setPinValue] = useState<string | null>(null);
  const [hasPin, setHasPin] = useState(false);
  const [customPinInput, setCustomPinInput] = useState('');
  const [copiedPin, setCopiedPin] = useState(false);

  // Bans & Audit
  const [bans, setBans] = useState<RoomBanRecord[]>([]);
  const [banSearch, setBanSearch] = useState('');
  const [auditLogs, setAuditLogs] = useState<RoomAuditLogRecord[]>([]);

  // Settings form
  const [editName, setEditName] = useState(room.name);
  const [editDesc, setEditDesc] = useState(room.description);
  const [editCat, setEditCat] = useState<RoomCategory>(room.category);
  const [editPublic, setEditPublic] = useState(room.isPublic);
  const [editChatEnabled, setEditChatEnabled] = useState(room.chatEnabled);
  const [editMicReq, setEditMicReq] = useState(room.micRequestsEnabled);
  const [editQueueEnabled, setEditQueueEnabled] = useState(room.queueEnabled);
  const [editInvitesEnabled, setEditInvitesEnabled] = useState(room.invitesEnabled);
  const [editNotifs, setEditNotifs] = useState(room.notificationsEnabled);
  const [editGamesPerm, setEditGamesPerm] = useState<'owner' | 'moderators' | 'all'>(room.gamesPermission);
  const [editMusicPerm, setEditMusicPerm] = useState<'owner' | 'moderators'>(room.musicPermission);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const coverRef = useRef<HTMLInputElement | null>(null);
  const [confirmDeleteStep, setConfirmDeleteStep] = useState(0);

  // Kick/Ban picker modal state
  const [banTarget, setBanTarget] = useState<RoomOccupantInfo | null>(null);
  const [banAction, setBanAction] = useState<'kick' | 'ban'>('kick');
  const [banMinutes, setBanMinutes] = useState<number>(30);
  const [banCustomMins, setBanCustomMins] = useState('');
  const [banPermanent, setBanPermanent] = useState(false);
  const [banReason, setBanReason] = useState('');

  // Moderator permissions editor
  const [modTargetId, setModTargetId] = useState('');
  const [modRole, setModRole] = useState<'head_admin' | 'moderator'>('moderator');
  const [modPerms, setModPerms] = useState<RoomModPermissions>({
    manageSeats: true,
    muteUsers: true,
    roomMuteAll: false,
    acceptMicQueue: true,
    kickUsers: true,
    banUsers: false,
    deleteMessages: true,
    pinMessages: true,
    pauseChat: false,
    manageLockPin: false,
    manageGames: true,
    manageMusic: true,
    manageEvents: false,
  });

  // Event creator
  const [evtTitle, setEvtTitle] = useState('');
  const [evtDesc, setEvtDesc] = useState('');
  const [evtStartsAt, setEvtStartsAt] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const p = room.myPermissions;
  const isOwner = room.myRole === 'owner';
  const isHead = room.myRole === 'head_admin' || isOwner || isPlatformAdmin;

  useEffect(() => {
    if (!isOpen) return;
    setTab(initialTab);
    setEditName(room.name);
    setEditDesc(room.description);
    setEditCat(room.category);
    setEditPublic(room.isPublic);
    setEditChatEnabled(room.chatEnabled);
    setEditMicReq(room.micRequestsEnabled);
    setEditQueueEnabled(room.queueEnabled);
    setEditInvitesEnabled(room.invitesEnabled);
    setEditNotifs(room.notificationsEnabled);
    setEditGamesPerm(room.gamesPermission);
    setEditMusicPerm(room.musicPermission);
    setConfirmDeleteStep(0);
    setCoverFile(null);
  }, [isOpen, initialTab, room.id]);

  useEffect(() => {
    if (!isOpen) return;
    if (tab === 'lock' && (isHead || p.manageLockPin)) {
      roomsApi.getRoomPin(room.code).then((r) => {
        if (r.success) {
          setHasPin(r.hasPin);
          setPinValue(r.pin);
        }
      });
    } else if (tab === 'bans' && (isHead || p.banUsers || p.kickUsers)) {
      roomsApi.getBans(room.code).then((r) => {
        if (r.success && r.bans) setBans(r.bans);
      });
    } else if (tab === 'audit' && isHead) {
      roomsApi.getAuditLogs(room.code).then((r) => {
        if (r.success && r.logs) setAuditLogs(r.logs);
      });
    }
  }, [isOpen, tab, room.code]);

  if (!isOpen) return null;

  const tabsList: Array<{ id: ManageTab; labelAr: string; labelEn: string; visible: boolean; Icon: any }> = [
    { id: 'users', labelAr: 'الأعضاء والمقاعد', labelEn: 'Users & Seats', visible: true, Icon: Users },
    { id: 'queue', labelAr: `المايك (${queue.length})`, labelEn: `Queue (${queue.length})`, visible: isHead || p.acceptMicQueue || p.roomMuteAll, Icon: Hand },
    { id: 'mods', labelAr: 'المشرفون', labelEn: 'Mods', visible: isHead, Icon: Shield },
    { id: 'lock', labelAr: 'القفل والرمز', labelEn: 'Lock & PIN', visible: isHead || p.manageLockPin, Icon: Lock },
    { id: 'bans', labelAr: 'المحظورون', labelEn: 'Bans', visible: isHead || p.banUsers || p.kickUsers, Icon: Ban },
    { id: 'events', labelAr: 'الأحداث', labelEn: 'Events', visible: isHead || p.manageEvents, Icon: Calendar },
    { id: 'settings', labelAr: 'الإعدادات', labelEn: 'Settings', visible: isHead, Icon: Settings },
    { id: 'audit', labelAr: 'السجل', labelEn: 'Audit', visible: isHead, Icon: FileText },
  ];

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append('name', editName.trim());
    fd.append('description', editDesc.trim());
    fd.append('category', editCat);
    fd.append('isPublic', String(editPublic));
    fd.append('chatEnabled', String(editChatEnabled));
    fd.append('micRequestsEnabled', String(editMicReq));
    fd.append('queueEnabled', String(editQueueEnabled));
    fd.append('invitesEnabled', String(editInvitesEnabled));
    fd.append('notificationsEnabled', String(editNotifs));
    fd.append('gamesPermission', editGamesPerm);
    fd.append('musicPermission', editMusicPerm);
    if (coverFile) fd.append('cover', coverFile);

    const res = await roomsApi.updateSettings(room.code, fd);
    if (res.success && res.room) {
      onRoomUpdated(res.room);
      showToast(isAr ? 'تم حفظ إعدادات الغرفة بنجاح' : 'Settings saved');
    } else {
      showToast(res.message || (isAr ? 'تعذر حفظ الإعدادات' : 'Failed to save'));
    }
  };

  const handleConfirmBan = async () => {
    if (!banTarget) return;
    const finalMinutes = banCustomMins.trim() ? Math.max(1, parseInt(banCustomMins, 10) || 1) : banMinutes;
    const res = await roomsApi.manageBan(room.code, {
      action: banAction,
      targetUserId: banTarget.userId,
      durationMinutes: banPermanent ? 0 : finalMinutes,
      isPermanent: banPermanent,
      reason: banReason.trim() || undefined,
    });
    if (res.success) {
      setBanTarget(null);
      setBanReason('');
      onRefreshRoom();
      showToast(isAr ? 'تم تنفيذ الإجراء بنجاح' : 'Action applied');
    } else {
      showToast(res.message || 'Error');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[115] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-neutral-950/75 backdrop-blur-md animate-in fade-in duration-200"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <div className="w-full sm:max-w-2xl max-h-[92dvh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Shield className="w-5 h-5 text-cyan-500 shrink-0" />
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black text-neutral-900 dark:text-white truncate">
                {isAr ? 'إدارة الغرفة' : 'Room Management'} · {room.name}
              </h3>
              <p className="text-[11px] font-mono text-neutral-500">{room.code}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center text-neutral-500 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toast */}
        {toast && (
          <div className="mx-4 mt-3 px-3 py-2 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-700 dark:text-cyan-300 text-xs font-bold">
            {toast}
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="px-4 py-2.5 border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {tabsList
            .filter((t) => t.visible)
            .map((t) => {
              const IconComp = t.Icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border cursor-pointer transition-all ${
                    active
                      ? 'bg-cyan-500 text-neutral-950 border-cyan-500'
                      : 'bg-neutral-100 dark:bg-neutral-800 border-transparent text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                  }`}
                >
                  <IconComp className="w-3.5 h-3.5" />
                  <span>{isAr ? t.labelAr : t.labelEn}</span>
                </button>
              );
            })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* 1. USERS & SEATS */}
          {tab === 'users' && (
            <div className="space-y-4">
              {/* Seat locks grid */}
              {(isHead || p.manageSeats) && (
                <div className="space-y-2">
                  <div className="text-xs font-black text-neutral-600 dark:text-neutral-400">
                    {isAr ? 'حالة المقاعد الصوتية (اضغط لقفل/فتح أي مقعد)' : 'Voice Seats (tap to lock/unlock)'}
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {seats.map((s) => (
                      <button
                        key={s.seatNumber}
                        type="button"
                        onClick={async () => {
                          const r = await roomsApi.manageSeat(room.code, {
                            action: s.isLocked ? 'unlock' : 'lock',
                            seatNumber: s.seatNumber,
                          });
                          if (r.success) onRefreshRoom();
                        }}
                        className={`py-2 px-1 rounded-xl border text-[11px] font-bold flex flex-col items-center gap-0.5 cursor-pointer ${
                          s.isLocked
                            ? 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300'
                            : s.userId
                            ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-700 dark:text-cyan-300'
                            : 'bg-neutral-100 dark:bg-neutral-800 border-transparent text-neutral-600 dark:text-neutral-300'
                        }`}
                      >
                        <span className="font-mono">#{s.seatNumber}</span>
                        <span>{s.isLocked ? '🔒' : s.userId ? '🎙️' : '✓'}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Occupants list */}
              <div className="space-y-2">
                <div className="text-xs font-black text-neutral-600 dark:text-neutral-400">
                  {isAr ? `المتواجدون حالياً (${occupants.length})` : `Present Users (${occupants.length})`}
                </div>
                <div className="space-y-2">
                  {occupants.map((occ) => (
                    <div
                      key={occ.userId}
                      className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-2 flex-wrap"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={getEffectiveAvatar(occ.avatar)}
                          onError={(e) => {
                            e.currentTarget.src = getDefaultAvatar();
                          }}
                          alt={occ.name}
                          className="w-9 h-9 rounded-full object-cover shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-black text-neutral-900 dark:text-white flex items-center gap-1 truncate">
                            <span className="truncate">{occ.name}</span>
                            {occ.role === 'owner' && <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                            {occ.role === 'head_admin' && <Shield className="w-3.5 h-3.5 text-violet-500 shrink-0" />}
                            {occ.role === 'moderator' && <Shield className="w-3.5 h-3.5 text-cyan-500 shrink-0" />}
                          </div>
                          <div className="text-[11px] text-neutral-500 font-mono">
                            {occ.seatNumber ? `${isAr ? 'مقعد' : 'Seat'} #${occ.seatNumber}` : isAr ? 'مستمع' : 'Listener'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {occ.seatNumber && (isHead || p.muteUsers) && occ.role !== 'owner' && (
                          <button
                            type="button"
                            onClick={async () => {
                              await roomsApi.manageSeat(room.code, {
                                action: occ.isMutedByMod ? 'unmute_user' : 'mute_user',
                                targetUserId: occ.userId,
                              });
                              onRefreshRoom();
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-neutral-200 dark:bg-neutral-700 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            {occ.isMutedByMod ? <Mic className="w-3.5 h-3.5 text-emerald-500" /> : <MicOff className="w-3.5 h-3.5 text-rose-500" />}
                            <span>{occ.isMutedByMod ? (isAr ? 'فك الكتم' : 'Unmute') : (isAr ? 'كتم' : 'Mute')}</span>
                          </button>
                        )}
                        {occ.seatNumber && (isHead || p.manageSeats) && occ.role !== 'owner' && (
                          <button
                            type="button"
                            onClick={async () => {
                              await roomsApi.manageSeat(room.code, { action: 'evict', targetUserId: occ.userId });
                              onRefreshRoom();
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[11px] font-bold cursor-pointer"
                          >
                            {isAr ? 'إنزال' : 'Unseat'}
                          </button>
                        )}
                        {!occ.seatNumber && (isHead || p.manageSeats) && (
                          <button
                            type="button"
                            onClick={async () => {
                              const free = seats.find((s) => !s.userId && !s.isLocked);
                              if (!free) {
                                showToast(isAr ? 'لا يوجد مقعد شاغر' : 'No free seat');
                                return;
                              }
                              await roomsApi.manageSeat(room.code, {
                                action: 'assign_user',
                                seatNumber: free.seatNumber,
                                targetUserId: occ.userId,
                              });
                              onRefreshRoom();
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 text-[11px] font-bold cursor-pointer"
                          >
                            {isAr ? 'إصعاد لمقعد' : 'Seat'}
                          </button>
                        )}
                        {occ.role !== 'owner' && (isHead || p.kickUsers || p.banUsers) && (
                          <button
                            type="button"
                            onClick={() => {
                              setBanTarget(occ);
                              setBanAction(p.kickUsers || isHead ? 'kick' : 'ban');
                              setBanPermanent(false);
                              setBanMinutes(30);
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 text-[11px] font-bold cursor-pointer"
                          >
                            {isAr ? 'طرد / حظر' : 'Kick / Ban'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 2. MIC QUEUE & ROOM-WIDE MUTE */}
          {tab === 'queue' && (
            <div className="space-y-4">
              {(isHead || p.roomMuteAll) && (
                <div className="p-4 rounded-2xl bg-neutral-100 dark:bg-neutral-800/70 border border-neutral-200 dark:border-neutral-700 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-black text-neutral-900 dark:text-white">
                      {isAr ? 'كتم الغرفة بالكامل' : 'Room-Wide Mute'}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {isAr ? 'تعطيل صوت جميع المتحدثين دون إنزالهم من المقاعد' : 'Disable all speaker mics without unseating anyone'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await roomsApi.toggleRoomMuteAll(room.code, !room.isRoomMuted);
                      if (res.success) {
                        onRefreshRoom();
                        showToast(res.isRoomMuted ? (isAr ? 'تم كتم الغرفة' : 'Room muted') : (isAr ? 'تم فك الكتم العام' : 'Room unmuted'));
                      }
                    }}
                    className={`px-4 py-2.5 rounded-xl text-xs font-black cursor-pointer shrink-0 ${
                      room.isRoomMuted
                        ? 'bg-rose-500 text-white'
                        : 'bg-cyan-500 text-neutral-950'
                    }`}
                  >
                    {room.isRoomMuted ? (isAr ? 'فك كتم الغرفة' : 'Unmute Room') : (isAr ? 'كتم الكل الآن' : 'Mute Room')}
                  </button>
                </div>
              )}

              <div className="space-y-2">
                <div className="text-xs font-black text-neutral-600 dark:text-neutral-400">
                  {isAr ? 'طلبات المايك المنتظرة' : 'Pending Mic Requests'}
                </div>
                {queue.length === 0 ? (
                  <p className="text-xs text-neutral-500 py-4 text-center">
                    {isAr ? 'لا توجد طلبات مايك في قائمة الانتظار حالياً' : 'No mic requests in queue'}
                  </p>
                ) : (
                  queue.map((q) => (
                    <div
                      key={q.userId}
                      className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={getEffectiveAvatar(q.avatar)}
                          onError={(e) => {
                            e.currentTarget.src = getDefaultAvatar();
                          }}
                          alt={q.name}
                          className="w-9 h-9 rounded-full object-cover"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-black truncate">{q.name}</div>
                          <div className="text-[11px] font-mono text-neutral-500">{q.displayId || q.userId}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={async () => {
                            const r = await roomsApi.manageQueue(room.code, 'accept', q.userId);
                            if (!r.success) showToast(r.message || 'Error');
                            onRefreshRoom();
                          }}
                          className="px-3 py-1.5 rounded-xl bg-emerald-500 text-white text-xs font-black cursor-pointer"
                        >
                          {isAr ? 'قبول' : 'Accept'}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await roomsApi.manageQueue(room.code, 'reject', q.userId);
                            onRefreshRoom();
                          }}
                          className="px-3 py-1.5 rounded-xl bg-neutral-200 dark:bg-neutral-700 text-xs font-bold cursor-pointer"
                        >
                          {isAr ? 'رفض' : 'Reject'}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 3. MODERATORS */}
          {tab === 'mods' && isHead && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-800 space-y-3">
                <div className="text-xs font-black text-neutral-800 dark:text-white">
                  {isAr ? 'تعيين أو تحديث مشرف' : 'Assign or Update Moderator'}
                </div>
                <select
                  value={modTargetId}
                  onChange={(e) => setModTargetId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-xs font-bold"
                >
                  <option value="">{isAr ? 'اختر مستخدماً من الغرفة...' : 'Select user inside room...'}</option>
                  {occupants
                    .filter((o) => o.role !== 'owner')
                    .map((o) => (
                      <option key={o.userId} value={o.userId}>
                        {o.name} ({o.displayId || o.userId})
                      </option>
                    ))}
                </select>

                {isOwner && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setModRole('moderator')}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                        modRole === 'moderator' ? 'bg-cyan-500/15 border-cyan-500 text-cyan-700 dark:text-cyan-300' : 'bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700'
                      }`}
                    >
                      {isAr ? 'مشرف بصلاحيات محددة' : 'Moderator'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setModRole('head_admin')}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                        modRole === 'head_admin' ? 'bg-violet-500/15 border-violet-500 text-violet-700 dark:text-violet-300' : 'bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700'
                      }`}
                    >
                      {isAr ? 'مشرف رئيسي (كامل الصلاحيات)' : 'Head Admin'}
                    </button>
                  </div>
                )}

                {modRole === 'moderator' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                    {PERM_LABELS.map((item) => (
                      <label key={item.key} className="flex items-center gap-2 text-xs font-medium cursor-pointer p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800">
                        <input
                          type="checkbox"
                          checked={modPerms[item.key]}
                          onChange={(e) => setModPerms((prev) => ({ ...prev, [item.key]: e.target.checked }))}
                          className="accent-cyan-500 w-4 h-4"
                        />
                        <span>{isAr ? item.ar : item.en}</span>
                      </label>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  disabled={!modTargetId}
                  onClick={async () => {
                    const res = await roomsApi.manageModerator(room.code, {
                      action: 'upsert',
                      targetUserId: modTargetId,
                      role: modRole,
                      permissions: modPerms,
                    });
                    if (res.success) {
                      showToast(isAr ? 'تم حفظ صلاحيات المشرف' : 'Moderator updated');
                      setModTargetId('');
                      onRefreshRoom();
                    } else {
                      showToast(res.message || 'Error');
                    }
                  }}
                  className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 disabled:opacity-45 text-neutral-950 text-xs font-black cursor-pointer"
                >
                  {isAr ? 'حفظ وتعيين الصلاحيات' : 'Save Moderator'}
                </button>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-black text-neutral-600 dark:text-neutral-400">
                  {isAr ? `قائمة المشرفين الحاليين (${moderators.length})` : `Current Moderators (${moderators.length})`}
                </div>
                {moderators.map((m) => (
                  <div key={m.userId} className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-black">{m.name}</div>
                      <div className="text-[11px] text-cyan-600 dark:text-cyan-400 font-bold">
                        {m.role === 'head_admin' ? (isAr ? 'مشرف رئيسي' : 'Head Admin') : (isAr ? 'مشرف' : 'Moderator')}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        const r = await roomsApi.manageModerator(room.code, { action: 'remove', targetUserId: m.userId });
                        if (r.success) {
                          onRefreshRoom();
                          showToast(isAr ? 'تمت إزالة المشرف' : 'Moderator removed');
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 text-xs font-bold cursor-pointer"
                    >
                      {isAr ? 'إزالة' : 'Remove'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. LOCK & PIN */}
          {tab === 'lock' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-black">{room.isLocked ? (isAr ? 'الغرفة مقفلة حالياً' : 'Room is Locked') : (isAr ? 'الغرفة مفتوحة' : 'Room is Open')}</div>
                  <div className="text-xs text-neutral-500">
                    {isAr ? 'القفل يمنع انضمام المستخدمين الجدد بدون الرمز السري دون إخراج المتواجدين' : 'Lock prevents new uninvited joins without kicking current occupants'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const res = await roomsApi.setLockAndPin(room.code, {
                      isLocked: !room.isLocked,
                      pinMode: 'keep',
                    });
                    if (res.success) {
                      setHasPin(res.hasPin);
                      setPinValue(res.pin);
                      onRefreshRoom();
                    }
                  }}
                  className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shrink-0 ${
                    room.isLocked ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-neutral-950'
                  }`}
                >
                  {room.isLocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  <span>{room.isLocked ? (isAr ? 'فتح الغرفة' : 'Unlock') : (isAr ? 'قفل الغرفة' : 'Lock Room')}</span>
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black">{isAr ? 'الرمز السري الحالي (PIN):' : 'Current Room PIN:'}</span>
                  {hasPin && pinValue ? (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(pinValue);
                        setCopiedPin(true);
                        setTimeout(() => setCopiedPin(false), 1800);
                      }}
                      className="px-3 py-1 rounded-xl bg-cyan-500/15 border border-cyan-500/30 font-mono text-sm font-black text-cyan-700 dark:text-cyan-300 flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>{pinValue}</span>
                      {copiedPin ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  ) : (
                    <span className="text-xs text-neutral-500">{isAr ? 'لم يتم تعيين رمز' : 'No PIN set'}</span>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await roomsApi.setLockAndPin(room.code, {
                        isLocked: room.isLocked,
                        pinMode: 'auto',
                      });
                      if (res.success) {
                        setHasPin(res.hasPin);
                        setPinValue(res.pin);
                        showToast(isAr ? `تم توليد رمز عشوائي: ${res.pin}` : `Generated PIN: ${res.pin}`);
                      }
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-neutral-200 dark:bg-neutral-700 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{isAr ? 'توليد رمز عشوائي' : 'Generate Random PIN'}</span>
                  </button>
                  {hasPin && (
                    <button
                      type="button"
                      onClick={async () => {
                        const res = await roomsApi.setLockAndPin(room.code, {
                          isLocked: false,
                          pinMode: 'remove',
                        });
                        if (res.success) {
                          setHasPin(false);
                          setPinValue(null);
                          onRefreshRoom();
                        }
                      }}
                      className="px-3 py-2.5 rounded-xl bg-rose-500/15 text-rose-600 text-xs font-bold cursor-pointer"
                    >
                      {isAr ? 'إلغاء الرمز' : 'Remove'}
                    </button>
                  )}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={12}
                    value={customPinInput}
                    onChange={(e) => setCustomPinInput(e.target.value)}
                    placeholder={isAr ? 'تعيين رمز مخصص (4-12 خانة)...' : 'Set custom PIN (4-12 chars)...'}
                    className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await roomsApi.setLockAndPin(room.code, {
                        isLocked: true,
                        pinMode: 'custom',
                        pin: customPinInput.trim(),
                      });
                      if (res.success) {
                        setHasPin(true);
                        setPinValue(res.pin);
                        setCustomPinInput('');
                        onRefreshRoom();
                        showToast(isAr ? 'تم حفظ الرمز السري وقفل الغرفة' : 'Custom PIN saved');
                      } else {
                        showToast(res.message || 'Invalid PIN');
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-cyan-500 text-neutral-950 text-xs font-black cursor-pointer"
                  >
                    {isAr ? 'تعيين' : 'Set'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 5. BANS */}
          {tab === 'bans' && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-neutral-400 absolute top-1/2 -translate-y-1/2 start-3" />
                <input
                  type="text"
                  value={banSearch}
                  onChange={(e) => setBanSearch(e.target.value)}
                  placeholder={isAr ? 'بحث في المحظورين والمطرودين...' : 'Search banned list...'}
                  className="w-full ps-9 pe-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-xs"
                />
              </div>
              {bans.filter((b) => !banSearch.trim() || b.name.toLowerCase().includes(banSearch.toLowerCase())).length === 0 ? (
                <p className="text-xs text-neutral-500 text-center py-6">
                  {isAr ? 'لا يوجد مستخدمون محظورون في هذه الغرفة' : 'No banned users'}
                </p>
              ) : (
                bans
                  .filter((b) => !banSearch.trim() || b.name.toLowerCase().includes(banSearch.toLowerCase()))
                  .map((b) => (
                    <div key={b.id} className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-black">{b.name}</div>
                        <div className="text-[11px] text-neutral-500">
                          {b.banType === 'kick' ? (isAr ? 'طرد مؤقت' : 'Timed Kick') : (isAr ? 'حظر' : 'Ban')}
                          {b.expiresAt ? ` · ${new Date(b.expiresAt).toLocaleString()}` : ` · ${isAr ? 'دائم' : 'Permanent'}`}
                        </div>
                        {b.reason && <div className="text-[11px] text-rose-500 mt-0.5">{b.reason}</div>}
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          const r = await roomsApi.manageBan(room.code, { action: 'unban', targetUserId: b.userId });
                          if (r.success) {
                            setBans((prev) => prev.filter((x) => x.userId !== b.userId));
                            showToast(isAr ? 'تم فك الحظر بنجاح' : 'Unbanned');
                          }
                        }}
                        className="px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-xs font-bold cursor-pointer"
                      >
                        {isAr ? 'فك الحظر' : 'Unban'}
                      </button>
                    </div>
                  ))
              )}
            </div>
          )}

          {/* 6. EVENTS */}
          {tab === 'events' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-800 space-y-2.5">
                <div className="text-xs font-black">{isAr ? 'جدولة حدث جديد للغرفة' : 'Schedule New Room Event'}</div>
                <input
                  type="text"
                  value={evtTitle}
                  onChange={(e) => setEvtTitle(e.target.value)}
                  placeholder={isAr ? 'عنوان الحدث (مثال: مسابقة الجمعة الكبرى)' : 'Event title'}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-xs"
                />
                <input
                  type="datetime-local"
                  value={evtStartsAt}
                  onChange={(e) => setEvtStartsAt(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-xs"
                />
                <textarea
                  rows={2}
                  value={evtDesc}
                  onChange={(e) => setEvtDesc(e.target.value)}
                  placeholder={isAr ? 'تفاصيل الحدث (اختياري)...' : 'Details (optional)'}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-xs resize-none"
                />
                <button
                  type="button"
                  onClick={async () => {
                    const res = await roomsApi.manageEvents(room.code, {
                      action: 'create',
                      title: evtTitle.trim(),
                      description: evtDesc.trim(),
                      startsAt: evtStartsAt,
                    });
                    if (res.success) {
                      setEvtTitle('');
                      setEvtDesc('');
                      setEvtStartsAt('');
                      onRefreshRoom();
                      showToast(isAr ? 'تمت جدولة الحدث بنجاح' : 'Event created');
                    } else {
                      showToast(res.message || 'Error');
                    }
                  }}
                  className="w-full py-2.5 rounded-xl bg-cyan-500 text-neutral-950 text-xs font-black cursor-pointer"
                >
                  {isAr ? 'إنشاء الحدث وإشعار المتابعين' : 'Create Event'}
                </button>
              </div>

              {events.map((ev) => (
                <div key={ev.id} className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-black">{ev.title}</div>
                    <div className="text-[11px] text-neutral-500">
                      {new Date(ev.startsAt).toLocaleString()} · {ev.rsvpUserIds.length} {isAr ? 'مهتم' : 'RSVPs'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await roomsApi.manageEvents(room.code, { action: 'cancel', eventId: ev.id });
                      onRefreshRoom();
                    }}
                    className="px-3 py-1.5 rounded-xl bg-rose-500/15 text-rose-600 text-xs font-bold cursor-pointer"
                  >
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 7. SETTINGS & DELETE */}
          {tab === 'settings' && isHead && (
            <form onSubmit={handleSaveSettings} className="space-y-4">
              {isPlatformAdmin && (
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
                  <div className="text-xs font-black text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                    <Star className="w-4 h-4" />
                    <span>{isAr ? 'تمييز الغرفة من الإدارة (Featured)' : 'Admin Featured Room'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const r = await roomsApi.setFeatured(room.code, !room.isFeatured);
                      if (r.success) onRefreshRoom();
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer ${
                      room.isFeatured ? 'bg-amber-500 text-neutral-950' : 'bg-neutral-200 dark:bg-neutral-700'
                    }`}
                  >
                    {room.isFeatured ? (isAr ? 'مميزة ✓' : 'Featured ✓') : (isAr ? 'تفعيل التمييز' : 'Feature')}
                  </button>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-bold block">{isAr ? 'اسم الغرفة' : 'Room Name'}</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-xs font-bold"
                />
                <label className="text-xs font-bold block">{isAr ? 'الوصف' : 'Description'}</label>
                <textarea
                  rows={2}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-xs resize-none"
                />

                <input
                  ref={coverRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => coverRef.current?.click()}
                  className="w-full py-2.5 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-cyan-500" />
                  <span>{coverFile ? coverFile.name : (isAr ? 'تغيير صورة الغرفة' : 'Replace Cover Image')}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {[
                  { label: isAr ? 'غرفة عامة (ظاهرة بالبحث)' : 'Public Room', val: editPublic, set: setEditPublic },
                  { label: isAr ? 'تفعيل الدردشة' : 'Enable Chat', val: editChatEnabled, set: setEditChatEnabled },
                  { label: isAr ? 'طلبات المايك' : 'Mic Requests', val: editMicReq, set: setEditMicReq },
                  { label: isAr ? 'قائمة انتظار المايك' : 'Mic Queue', val: editQueueEnabled, set: setEditQueueEnabled },
                  { label: isAr ? 'دعوات الغرفة' : 'Room Invites', val: editInvitesEnabled, set: setEditInvitesEnabled },
                  { label: isAr ? 'إشعارات الأحداث للمتابعين' : 'Follower Notifications', val: editNotifs, set: setEditNotifs },
                ].map((tog, i) => (
                  <label key={i} className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 flex items-center justify-between cursor-pointer">
                    <span className="font-bold">{tog.label}</span>
                    <input
                      type="checkbox"
                      checked={tog.val}
                      onChange={(e) => tog.set(e.target.checked)}
                      className="accent-cyan-500 w-4 h-4"
                    />
                  </label>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="font-bold block mb-1">{isAr ? 'التصنيف' : 'Category'}</label>
                  <select
                    value={editCat}
                    onChange={(e) => setEditCat(e.target.value as RoomCategory)}
                    className="w-full px-2.5 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 font-bold"
                  >
                    <option value="chat">{isAr ? 'دردشة' : 'Chat'}</option>
                    <option value="music">{isAr ? 'موسيقى' : 'Music'}</option>
                    <option value="games">{isAr ? 'ألعاب' : 'Games'}</option>
                    <option value="chill">{isAr ? 'استرخاء' : 'Chill'}</option>
                    <option value="culture">{isAr ? 'ثقافة' : 'Culture'}</option>
                    <option value="vip">VIP</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold block mb-1">{isAr ? 'صلاحية الألعاب' : 'Games Control'}</label>
                  <select
                    value={editGamesPerm}
                    onChange={(e) => setEditGamesPerm(e.target.value as any)}
                    className="w-full px-2.5 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 font-bold"
                  >
                    <option value="owner">{isAr ? 'المالك فقط' : 'Owner only'}</option>
                    <option value="moderators">{isAr ? 'المشرفون والمالك' : 'Moderators+'}</option>
                    <option value="all">{isAr ? 'الجميع' : 'Everyone'}</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-cyan-500 hover:bg-cyan-600 text-neutral-950 text-xs sm:text-sm font-black cursor-pointer"
              >
                {isAr ? 'حفظ كافة التغييرات' : 'Save Settings'}
              </button>

              {(isOwner || isPlatformAdmin) && (
                <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800 space-y-2">
                  {confirmDeleteStep === 0 ? (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteStep(1)}
                      className="w-full py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 border border-rose-500/30 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>{isAr ? 'حذف الغرفة نهائياً' : 'Delete Room Permanently'}</span>
                    </button>
                  ) : (
                    <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/40 space-y-2">
                      <div className="text-xs font-black text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>{isAr ? 'هل أنت متأكد؟ سيتم حذف الغرفة وجميع سجلاتها ولا يمكن التراجع.' : 'Confirm permanent deletion? Cannot be undone.'}</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteStep(0)}
                          className="flex-1 py-2 rounded-xl bg-neutral-200 dark:bg-neutral-800 text-xs font-bold cursor-pointer"
                        >
                          {isAr ? 'إلغاء' : 'Cancel'}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const r = await roomsApi.deleteRoom(room.code);
                            if (r.success) onDeletedRoom();
                            else showToast(r.message || 'Error');
                          }}
                          className="flex-1 py-2 rounded-xl bg-rose-600 text-white text-xs font-black cursor-pointer"
                        >
                          {isAr ? 'نعم، احذف نهائياً' : 'Confirm Delete'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </form>
          )}

          {/* 8. IMMUTABLE AUDIT LOG */}
          {tab === 'audit' && isHead && (
            <div className="space-y-2">
              <p className="text-[11px] text-neutral-500">
                {isAr ? 'سجل تدقيق محمي وغير قابل للتعديل أو الحذف:' : 'Immutable room audit log:'}
              </p>
              {auditLogs.length === 0 ? (
                <p className="text-xs text-neutral-500 text-center py-6">{isAr ? 'لا توجد أحداث مسجلة بعد' : 'No audit logs yet'}</p>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-800 text-xs space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-black text-cyan-600 dark:text-cyan-400">{log.action}</span>
                      <span className="text-[10px] font-mono text-neutral-400">{new Date(log.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="text-neutral-700 dark:text-neutral-300">
                      {log.actorName || log.actorId}
                      {log.targetUserName ? ` → ${log.targetUserName}` : ''}
                      {log.details ? ` (${log.details})` : ''}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sub-Modal: Kick / Ban Duration Picker */}
      {banTarget && (
        <div className="fixed inset-0 z-[125] flex items-center justify-center p-4 bg-black/70">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-5 space-y-3 shadow-2xl">
            <h4 className="text-sm font-black">{isAr ? `إجراء بحق ${banTarget.name}` : `Moderation: ${banTarget.name}`}</h4>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setBanAction('kick');
                  setBanPermanent(false);
                }}
                className={`py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                  banAction === 'kick' ? 'bg-amber-500/15 border-amber-500 text-amber-700 dark:text-amber-300' : 'bg-neutral-100 dark:bg-neutral-800 border-transparent'
                }`}
              >
                {isAr ? 'طرد' : 'Kick'}
              </button>
              <button
                type="button"
                onClick={() => setBanAction('ban')}
                className={`py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                  banAction === 'ban' ? 'bg-rose-500/15 border-rose-500 text-rose-600 dark:text-rose-400' : 'bg-neutral-100 dark:bg-neutral-800 border-transparent'
                }`}
              >
                {isAr ? 'حظر' : 'Ban'}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1.5 text-xs">
              {[
                { label: isAr ? 'فوري (بدون منع)' : 'Instant', mins: 0, perm: false },
                { label: isAr ? '5 دقائق' : '5 min', mins: 5, perm: false },
                { label: isAr ? '30 دقيقة' : '30 min', mins: 30, perm: false },
                { label: isAr ? '1 ساعة' : '1 hour', mins: 60, perm: false },
                { label: isAr ? '24 ساعة' : '24 hours', mins: 1440, perm: false },
                { label: isAr ? 'دائم' : 'Permanent', mins: 0, perm: true },
              ].map((opt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setBanMinutes(opt.mins);
                    setBanPermanent(opt.perm);
                    setBanCustomMins('');
                  }}
                  className={`py-2 rounded-xl font-bold border cursor-pointer ${
                    ((opt.perm && banPermanent) || (!opt.perm && !banPermanent && !banCustomMins && banMinutes === opt.mins))
                      ? 'bg-cyan-500 text-neutral-950 border-cyan-500'
                      : 'bg-neutral-100 dark:bg-neutral-800 border-transparent'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <input
              type="number"
              min={1}
              value={banCustomMins}
              onChange={(e) => {
                setBanCustomMins(e.target.value);
                setBanPermanent(false);
              }}
              placeholder={isAr ? 'أو أدخل مدة مخصصة بالدقائق...' : 'Or custom duration in minutes...'}
              className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-xs"
            />
            <input
              type="text"
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              placeholder={isAr ? 'السبب (اختياري)...' : 'Reason (optional)...'}
              className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-xs"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setBanTarget(null)}
                className="flex-1 py-2.5 rounded-xl bg-neutral-200 dark:bg-neutral-800 text-xs font-bold cursor-pointer"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmBan}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-black cursor-pointer"
              >
                {isAr ? 'تنفيذ' : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
