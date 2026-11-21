import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  Mic,
  MicOff,
  Lock,
  Unlock,
  Users,
  Star,
  Settings,
  Gift,
  Gamepad2,
  Music,
  Send,
  Crown,
  Shield,
  Volume2,
  VolumeX,
  Copy,
  Check,
  Hand,
  LogOut,
  Pin,
  Trash2,
  Pause,
  Play,
  Calendar,
  AlertCircle,
  User,
  Armchair,
  Ban,
  SlidersHorizontal,
} from 'lucide-react';
import {
  AuthUser,
  Language,
  RoomDetail,
  RoomEventRecord,
  RoomGameState,
  RoomMessageRecord,
  RoomMiniGameType,
  RoomModRecord,
  RoomMusicState,
  RoomOccupantInfo,
  RoomQueueItem,
  RoomSeatInfo,
} from '../../types';
import { roomsApi } from '../../lib/roomsApi';
import { getStoredAuthToken } from '../../lib/authStorage';
import { WebRtcMeshAudioProvider, MicConnectionStatus } from '../../lib/roomAudio';
import { RoomMusicEngine } from '../../lib/roomMusicEngine';
import { getEffectiveAvatar, getDefaultAvatar } from '../../lib/avatar';
import { AvatarWithFrame } from '../AvatarFrame';
import { VerifiedBadge } from '../VerifiedBadge';
import { GiftSvgIcon } from '../GiftIcons';
import { openUserProfile } from '../../lib/profileModal';
import { RoomGiftModal } from './RoomGiftModal';
import { RoomGamesModal } from './RoomGamesModal';
import { RoomMusicModal } from './RoomMusicModal';
import { RoomManageModal, ManageTab } from './RoomManageModal';

interface VoiceRoomViewProps {
  lang: Language;
  roomCode: string;
  inviteToken?: string;
  currentUser: AuthUser;
  coinsBalance: number;
  onCoinsSync: (nextCoins: number) => void;
  onOpenWallet: () => void;
  onLeave: () => void;
}

const IDLE_GAME: RoomGameState = {
  status: 'idle',
  gameType: null,
  gameId: null,
  roundNumber: 0,
  totalRounds: 0,
  question: null,
  roundStartedAtMs: 0,
  roundDurationSec: 15,
  answeredUserIds: [],
  winnerName: null,
  leaderboard: [],
};

const DEFAULT_MUSIC: RoomMusicState = {
  isPlaying: false,
  trackId: 'lounge-evening',
  trackTitleAr: 'صالة المساء الهادئة',
  trackTitleEn: 'Evening Lounge Chill',
  artist: 'SOUL-X Soundlab',
  startedAtMs: 0,
  offsetSec: 0,
};

export const VoiceRoomView: React.FC<VoiceRoomViewProps> = ({
  lang,
  roomCode,
  inviteToken,
  currentUser,
  coinsBalance,
  onCoinsSync,
  onOpenWallet,
  onLeave,
}) => {
  const isAr = lang === 'ar';
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<string | null>(null);
  const [requiresPin, setRequiresPin] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinSubmitting, setPinSubmitting] = useState(false);
  const [activeInvite, setActiveInvite] = useState<string | undefined>(inviteToken);

  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [seats, setSeats] = useState<RoomSeatInfo[]>([]);
  const [occupants, setOccupants] = useState<RoomOccupantInfo[]>([]);
  const [queue, setQueue] = useState<RoomQueueItem[]>([]);
  const [messages, setMessages] = useState<RoomMessageRecord[]>([]);
  const [events, setEvents] = useState<RoomEventRecord[]>([]);
  const [moderators, setModerators] = useState<RoomModRecord[]>([]);
  const [music, setMusic] = useState<RoomMusicState>(DEFAULT_MUSIC);
  const [game, setGame] = useState<RoomGameState>(IDLE_GAME);

  // Audio & Music engines
  const audioRef = useRef<WebRtcMeshAudioProvider | null>(null);
  const musicEngineRef = useRef<RoomMusicEngine | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const explicitLeaveRef = useRef(false);
  const [micStatus, setMicStatus] = useState<MicConnectionStatus>('muted');
  const [micError, setMicError] = useState<string | null>(null);
  const [isDeafened, setIsDeafened] = useState(false);
  const [musicVolume, setMusicVolume] = useState(0.35);
  const [voiceVolume, setVoiceVolume] = useState(() => {
    try {
      const saved = localStorage.getItem('soulx_room_voice_volume');
      if (saved !== null) {
        const parsed = parseFloat(saved);
        if (Number.isFinite(parsed)) return Math.max(0, Math.min(1, parsed));
      }
    } catch {}
    return 1;
  });

  // UI state
  const [chatText, setChatText] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [sitConfirmSeat, setSitConfirmSeat] = useState<number | null>(null);
  const [actionUser, setActionUser] = useState<RoomOccupantInfo | null>(null);
  const [giftCelebration, setGiftCelebration] = useState<any | null>(null);

  // Sub-modals
  const [isGiftOpen, setIsGiftOpen] = useState(false);
  const [giftTargetId, setGiftTargetId] = useState<string | null>(null);
  const [isGamesOpen, setIsGamesOpen] = useState(false);
  const [isMusicOpen, setIsMusicOpen] = useState(false);
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [manageInitialTab, setManageInitialTab] = useState<ManageTab>('users');

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3200);
  }, []);

  const loadRoomData = useCallback(async () => {
    setLoading(true);
    setErrorState(null);
    const res = await roomsApi.getRoom(roomCode, activeInvite);
    if (!res.success) {
      setErrorState(res.message || (isAr ? 'تعذر الدخول إلى الغرفة' : 'Cannot enter room'));
      setLoading(false);
      return;
    }
    if (res.requiresPin) {
      setRequiresPin(true);
      setLoading(false);
      return;
    }
    setRequiresPin(false);
    if (res.room) setRoom(res.room);
    if (res.seats) setSeats(res.seats);
    if (res.occupants) setOccupants(res.occupants);
    if (res.queue) setQueue(res.queue);
    if (res.messages) setMessages(res.messages);
    if (res.events) setEvents(res.events);
    if (res.moderators) setModerators(res.moderators);
    if (res.music) setMusic(res.music);
    if (res.game) setGame(res.game);
    setLoading(false);
  }, [roomCode, activeInvite, isAr]);

  useEffect(() => {
    loadRoomData();
  }, [loadRoomData]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Music engine lifecycle & sync
  useEffect(() => {
    const engine = new RoomMusicEngine();
    musicEngineRef.current = engine;
    setMusicVolume(engine.getVolume());
    return () => {
      engine.destroy();
      musicEngineRef.current = null;
    };
  }, []);

  useEffect(() => {
    musicEngineRef.current?.syncState(music);
  }, [music]);

  // WebRTC audio + WebSocket real-time lifecycle
  useEffect(() => {
    if (!room || requiresPin || errorState) return;
    const token = getStoredAuthToken();
    if (!token) return;

    let cancelled = false;
    const audio = new WebRtcMeshAudioProvider();
    audio.setVoiceVolume(voiceVolume);
    audio.setDeafened(isDeafened);
    audioRef.current = audio;

    roomsApi.getRtcConfig().then((iceServers) => {
      if (cancelled) return;
      audio.init(currentUser.id, iceServers, {
        onStatusChange: (status, err) => {
          setMicStatus(status);
          if (err) setMicError(err);
          else setMicError(null);
        },
        onSpeakingChange: (speaking) => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'mic:speaking', isSpeaking: speaking }));
          }
        },
        onSignal: (signal) => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(signal));
          }
        },
      });
    });

    let reconnectTimer: number | null = null;
    let pingTimer: number | null = null;
    let reconnectAttempt = 0;

    const connectWs = () => {
      if (cancelled || explicitLeaveRef.current) return;
      if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
        return;
      }
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const qs = new URLSearchParams({ token, roomId: room.code });
      if (activeInvite) qs.set('invite', activeInvite);
      const ws = new WebSocket(`${proto}//${window.location.host}/ws/rooms?${qs.toString()}`);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttempt = 0;
        if (pingTimer) clearInterval(pingTimer);
        pingTimer = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 20000);
      };

      ws.onmessage = async (evt) => {
        let data: any;
        try {
          data = JSON.parse(evt.data);
        } catch {
          return;
        }
        if (!data || !data.type) return;

        switch (data.type) {
          case 'room:snapshot':
            if (data.room) setRoom(data.room);
            if (data.seats) setSeats(data.seats);
            if (data.occupants) setOccupants(data.occupants);
            if (data.queue) setQueue(data.queue);
            if (data.messages) setMessages(data.messages);
            if (data.events) setEvents(data.events);
            if (data.music) setMusic(data.music);
            if (data.game) setGame(data.game);
            break;

          case 'room:state':
            if (data.room) setRoom(data.room);
            break;

          case 'seats:update':
            if (data.seats) setSeats(data.seats);
            if (data.occupants) setOccupants(data.occupants);
            if (data.queue) setQueue(data.queue);
            if (typeof data.isRoomMuted === 'boolean') {
              setRoom((prev) => (prev ? { ...prev, isRoomMuted: data.isRoomMuted } : prev));
            }
            break;

          case 'mic:speaking':
            setOccupants((prev) =>
              prev.map((o) => (o.userId === data.userId ? { ...o, isSpeaking: Boolean(data.isSpeaking) } : o))
            );
            setSeats((prev) =>
              prev.map((s) => (s.userId === data.userId ? { ...s, isSpeaking: Boolean(data.isSpeaking) } : s))
            );
            break;

          case 'chat:message':
            if (data.message) {
              setMessages((prev) => [...prev.slice(-149), data.message]);
            }
            break;

          case 'chat:message_deleted':
            setMessages((prev) => prev.filter((m) => m.id !== data.messageId));
            break;

          case 'room:gift':
            if (data.gift) {
              setGiftCelebration(data.gift);
              setTimeout(() => setGiftCelebration(null), 4200);
            }
            break;

          case 'music:state':
            if (data.music) setMusic(data.music);
            break;

          case 'game:state':
            if (data.game) setGame(data.game);
            break;

          case 'events:update':
            if (data.events) setEvents(data.events);
            break;

          case 'rtc:offer':
          case 'rtc:answer':
          case 'rtc:ice-candidate':
            await audio.handleIncomingSignal(data.fromUserId, data);
            break;

          case 'room:kicked':
            explicitLeaveRef.current = true;
            setErrorState(data.reason || (isAr ? 'تم إخراجك من الغرفة' : 'Removed from room'));
            break;

          case 'room:frozen':
            explicitLeaveRef.current = true;
            setErrorState(
              data.message ||
                (data.reason
                  ? (isAr ? `تم تجميد الغرفة إدارياً: ${data.reason}` : `Room frozen: ${data.reason}`)
                  : (isAr ? 'تم تجميد الغرفة إدارياً من قبل إدارة المنصة' : 'Room administratively frozen'))
            );
            break;

          case 'room:deleted':
            explicitLeaveRef.current = true;
            onLeave();
            break;

          case 'error':
            if (data.message) showToast(data.message);
            break;
        }
      };

      ws.onclose = (closeEvt) => {
        if (pingTimer) {
          clearInterval(pingTimer);
          pingTimer = null;
        }
        const terminalCodes = new Set([1000, 4001, 4002, 4003, 4004, 4010, 4011]);
        if (terminalCodes.has(closeEvt.code)) {
          if (closeEvt.code === 4002) setRequiresPin(true);
          return;
        }
        if (!cancelled && !explicitLeaveRef.current) {
          const delay = Math.min(5000, 1200 * Math.pow(1.6, Math.min(reconnectAttempt, 4)));
          reconnectAttempt++;
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = window.setTimeout(connectWs, delay);
        }
      };
    };

    const handleVisibilityOrNetworkResume = () => {
      if (cancelled || explicitLeaveRef.current) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      audio.handleResume();
      musicEngineRef.current?.resumeIfNeeded();
      const ws = wsRef.current;
      if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
        if (reconnectTimer) clearTimeout(reconnectTimer);
        connectWs();
      } else if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: 'ping' }));
        } catch {}
      }
    };

    connectWs();
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityOrNetworkResume);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleVisibilityOrNetworkResume);
    }

    return () => {
      cancelled = true;
      if (pingTimer) clearInterval(pingTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityOrNetworkResume);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleVisibilityOrNetworkResume);
      }
      if (wsRef.current) {
        try {
          wsRef.current.close(1000, 'Unmount');
        } catch {}
        wsRef.current = null;
      }
      audio.destroy();
      audioRef.current = null;
    };
  }, [room?.id, requiresPin, errorState, currentUser.id, activeInvite]);

  // Synchronize WebRTC peers & publish permission whenever seats/mute/occupants change
  const mySeat = seats.find((s) => s.userId === currentUser.id) || null;
  const canTransmitAudio = Boolean(mySeat && !mySeat.isMutedBySelf && !mySeat.isMutedByMod && !room?.isRoomMuted);
  const seatedUserIds = seats.map((s) => s.userId).filter((uid): uid is string => Boolean(uid));
  const targetPeerIds = mySeat ? occupants.map((o) => o.userId) : seatedUserIds;
  const targetPeerKey = targetPeerIds.slice().sort().join(',');

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !room) return;
    audio.syncPeers(targetPeerIds, canTransmitAudio);
    audio.setPublishEnabled(canTransmitAudio);
  }, [targetPeerKey, canTransmitAudio, room?.id]);

  const handleExplicitLeave = () => {
    explicitLeaveRef.current = true;
    const activeWsOpen = wsRef.current?.readyState === WebSocket.OPEN;
    if (activeWsOpen) {
      try {
        wsRef.current?.send(JSON.stringify({ type: 'room:leave' }));
      } catch {}
    } else if (room && mySeat) {
      roomsApi.leaveSeat(room.code).catch(() => {});
    }
    onLeave();
  };

  const handleToggleMic = async () => {
    if (!mySeat) {
      // If listener, open seat prompt or request mic
      const firstFree = seats.find((s) => !s.userId && !s.isLocked);
      if (firstFree) {
        setSitConfirmSeat(firstFree.seatNumber);
      } else {
        await handleQueueToggle();
      }
      return;
    }
    if (room?.isRoomMuted) {
      showToast(isAr ? 'الغرفة مكتومة بالكامل حالياً من الإدارة' : 'Room is muted by moderators');
      return;
    }
    if (mySeat.isMutedByMod) {
      showToast(isAr ? 'المايك الخاص بك مكتوم من قبل الإدارة' : 'Your mic is muted by moderators');
      return;
    }

    const wantOpen = mySeat.isMutedBySelf;
    if (wantOpen && audioRef.current) {
      const ok = await audioRef.current.setPublishEnabled(true);
      if (!ok) {
        showToast(micError || (isAr ? 'تعذر تشغيل المايكروفون' : 'Microphone failed'));
        return;
      }
    }
    wsRef.current?.send(JSON.stringify({ type: 'mic:toggle', isOpen: wantOpen }));
  };

  const handleQueueToggle = async () => {
    if (!room) return;
    const inQueue = queue.some((q) => q.userId === currentUser.id);
    const res = await roomsApi.manageQueue(room.code, inQueue ? 'cancel' : 'request');
    if (res.success) {
      showToast(
        inQueue
          ? isAr
            ? 'تم إلغاء طلب المايك'
            : 'Mic request cancelled'
          : isAr
          ? 'تم إرسال طلب المايك لقائمة الانتظار'
          : 'Mic request added to queue'
      );
    } else {
      showToast(res.message || 'Error');
    }
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    const txt = chatText.trim();
    if (!txt || wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'chat:send', text: txt }));
    setChatText('');
  };

  // PIN gate view
  if (requiresPin) {
    return (
      <div className="flex-1 h-full min-h-0 flex items-center justify-center p-4" dir={isAr ? 'rtl' : 'ltr'}>
        <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 shadow-2xl space-y-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 mx-auto">
            <Lock className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-black text-neutral-900 dark:text-white">
            {isAr ? 'هذه الغرفة محمية برمز سري' : 'PIN Required'}
          </h3>
          <p className="text-xs text-neutral-500">
            {isAr ? `أدخل الرمز السري للدخول إلى ${roomCode}` : `Enter Room PIN for ${roomCode}`}
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setPinSubmitting(true);
              const r = await roomsApi.verifyPin(roomCode, pinInput.trim());
              setPinSubmitting(false);
              if (r.success && r.entryToken) {
                setActiveInvite(r.entryToken);
                setRequiresPin(false);
              } else {
                showToast(r.message || (isAr ? 'الرمز غير صحيح' : 'Incorrect PIN'));
              }
            }}
            className="space-y-3"
          >
            <input
              type="password"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="••••••"
              className="w-full text-center font-mono text-lg tracking-widest px-4 py-3 rounded-2xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onLeave}
                className="flex-1 py-3 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-xs font-bold cursor-pointer"
              >
                {isAr ? 'رجوع' : 'Back'}
              </button>
              <button
                type="submit"
                disabled={pinSubmitting || !pinInput.trim()}
                className="flex-[2] py-3 rounded-2xl bg-cyan-500 text-neutral-950 text-xs font-black cursor-pointer disabled:opacity-50"
              >
                {pinSubmitting ? (isAr ? 'جاري التحقق...' : 'Verifying...') : (isAr ? 'دخول الغرفة' : 'Enter Room')}
              </button>
            </div>
          </form>
          {toastMsg && <p className="text-xs text-rose-500 font-bold">{toastMsg}</p>}
        </div>
      </div>
    );
  }

  if (loading || errorState || !room) {
    return (
      <div className="flex-1 h-full min-h-0 flex items-center justify-center p-4 text-center" dir={isAr ? 'rtl' : 'ltr'}>
        {loading ? (
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-full border-3 border-cyan-500 border-t-transparent animate-spin mx-auto" />
            <p className="text-xs font-bold text-neutral-500">{isAr ? 'جاري الدخول للغرفة الصوتية...' : 'Joining voice room...'}</p>
          </div>
        ) : (
          <div className="max-w-sm rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 space-y-4">
            <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
            <p className="text-sm font-black text-neutral-900 dark:text-white">{errorState}</p>
            <button
              type="button"
              onClick={onLeave}
              className="px-5 py-2.5 rounded-2xl bg-cyan-500 text-neutral-950 text-xs font-black cursor-pointer"
            >
              {isAr ? 'العودة لقائمة الغرف' : 'Back to Rooms'}
            </button>
          </div>
        )}
      </div>
    );
  }

  const canManageAny =
    room.myRole === 'owner' ||
    room.myRole === 'head_admin' ||
    Boolean(currentUser.isAdmin) ||
    Object.values(room.myPermissions).some(Boolean);

  const canManageGames =
    room.gamesPermission === 'all' ||
    room.myRole === 'owner' ||
    room.myRole === 'head_admin' ||
    room.myPermissions.manageGames ||
    Boolean(currentUser.isAdmin);

  const canControlMusic =
    room.myRole === 'owner' ||
    room.myRole === 'head_admin' ||
    (room.musicPermission === 'moderators' && room.myPermissions.manageMusic) ||
    Boolean(currentUser.isAdmin);

  const inQueue = queue.some((q) => q.userId === currentUser.id);
  const nextEvent = events[0] || null;

  const micLabel = !mySeat
    ? inQueue
      ? (isAr ? 'إلغاء الطلب' : 'Cancel Req')
      : (isAr ? 'صعود للمايك' : 'Take Mic')
    : micStatus === 'connecting'
    ? (isAr ? 'جاري الاتصال' : 'Connecting')
    : micStatus === 'reconnecting'
    ? (isAr ? 'إعادة الاتصال' : 'Reconnecting')
    : micStatus === 'failed'
    ? (isAr ? 'فشل الاتصال' : 'Failed')
    : canTransmitAudio
    ? (isAr ? 'مايك مفتوح' : 'Mic Open')
    : (isAr ? 'مايك مغلق' : 'Muted');

  return (
    <div
      onClick={() => musicEngineRef.current?.resumeIfNeeded()}
      className="relative flex-1 h-full min-h-0 flex flex-col max-w-6xl w-full mx-auto bg-neutral-50 dark:bg-neutral-950 overflow-hidden"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* Room Top Header */}
      <div className="px-3 sm:px-5 py-1.5 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={handleExplicitLeave}
            className="w-9 h-9 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center text-neutral-700 dark:text-neutral-200 cursor-pointer shrink-0"
            title={isAr ? 'مغادرة الغرفة' : 'Leave Room'}
          >
            {isAr ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
          </button>

          <img
            src={room.coverUrl}
            referrerPolicy="no-referrer"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
            alt={room.name}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-cover border border-neutral-200 dark:border-neutral-700 shrink-0"
          />

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-xs sm:text-sm font-black text-neutral-900 dark:text-white truncate">
                {room.name}
              </h2>
              {room.isLocked && <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
            </div>
            <div className="flex items-center gap-2 text-[10px] sm:text-[11px] text-neutral-500 dark:text-neutral-400">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(room.code);
                  setCopiedCode(true);
                  setTimeout(() => setCopiedCode(false), 1600);
                }}
                className="font-mono font-bold text-cyan-600 dark:text-cyan-400 inline-flex items-center gap-1 cursor-pointer"
              >
                <span>{room.code}</span>
                {copiedCode ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              </button>
              <span>·</span>
              <span className="inline-flex items-center gap-1 font-bold">
                <Users className="w-3 h-3 text-emerald-500" />
                {occupants.length}
              </span>
            </div>
          </div>
        </div>

        {/* Header Quick Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              const next = !isDeafened;
              setIsDeafened(next);
              audioRef.current?.setDeafened(next);
              showToast(next ? (isAr ? 'تم كتم صوت الغرفة لديك' : 'Audio deafened') : (isAr ? 'تم تشغيل صوت الغرفة' : 'Audio restored'));
            }}
            className={`w-9 h-9 rounded-xl border flex items-center justify-center cursor-pointer ${
              isDeafened
                ? 'bg-rose-500/15 border-rose-500/30 text-rose-500'
                : 'bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200'
            }`}
            title={isAr ? 'كتم/تشغيل السماعة' : 'Mute Speaker'}
          >
            {isDeafened ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={async () => {
              const r = await roomsApi.toggleFavorite(room.code);
              if (r.success) setRoom((prev) => (prev ? { ...prev, isFavorite: Boolean(r.isFavorite) } : prev));
            }}
            className={`w-9 h-9 rounded-xl border flex items-center justify-center cursor-pointer ${
              room.isFavorite
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-500'
                : 'bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300'
            }`}
            title={isAr ? 'المفضلة' : 'Favorite'}
          >
            <Star className={`w-4 h-4 ${room.isFavorite ? 'fill-current' : ''}`} />
          </button>

          {canManageAny && (
            <button
              type="button"
              onClick={() => {
                setManageInitialTab('users');
                setIsManageOpen(true);
              }}
              className="px-2.5 h-9 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/35 text-cyan-700 dark:text-cyan-300 text-xs font-black flex items-center gap-1.5 cursor-pointer"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">{isAr ? 'إدارة' : 'Manage'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Floating Live Gift Celebration & Toast Overlays (do not compress seats/chat) */}
      {(giftCelebration || toastMsg) && (
        <div className="pointer-events-none absolute top-14 inset-x-3 z-30 flex flex-col items-center gap-1.5">
          {giftCelebration && (
            <div className="px-3 py-1.5 rounded-2xl bg-gradient-to-r from-amber-500/90 via-pink-500/90 to-cyan-500/90 backdrop-blur-md border border-amber-300/60 shadow-lg flex items-center justify-center gap-2 animate-in zoom-in-95 duration-200 max-w-full">
              <GiftSvgIcon giftId={giftCelebration.giftId} className="w-6 h-6 shrink-0" />
              <div className="text-xs font-black text-white truncate">
                {giftCelebration.senderName} ← {giftCelebration.recipientsSummary}: {giftCelebration.giftNameAr} ×{giftCelebration.quantity}
              </div>
            </div>
          )}
          {toastMsg && (
            <div className="px-3.5 py-1.5 rounded-xl bg-neutral-900/95 dark:bg-white/95 text-white dark:text-neutral-900 text-xs font-bold text-center shadow-lg">
              {toastMsg}
            </div>
          )}
        </div>
      )}

      {/* Alerts: Room Mute / Pinned / Upcoming Event */}
      {(room.isRoomMuted || room.pinnedMessage || nextEvent) && (
      <div className="px-3 sm:px-5 pt-1 space-y-1 shrink-0">
        {room.isRoomMuted && (
          <div className="px-2.5 py-1 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-[11px] font-bold flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <MicOff className="w-3.5 h-3.5" />
              {isAr ? 'تم تفعيل كتم الغرفة بالكامل من الإدارة' : 'Room is muted by moderators'}
            </span>
          </div>
        )}
        {room.pinnedMessage && (
          <div className="px-2.5 py-1 rounded-xl bg-cyan-500/10 border border-cyan-500/25 text-cyan-800 dark:text-cyan-200 text-[11px] flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 truncate font-bold">
              <Pin className="w-3 h-3 shrink-0 text-cyan-500" />
              <span className="truncate">{room.pinnedMessage.senderName}: {room.pinnedMessage.text}</span>
            </span>
            {(room.myRole === 'owner' || room.myRole === 'head_admin' || room.myPermissions.pinMessages) && (
              <button
                type="button"
                onClick={() => roomsApi.moderateChat(room.code, { action: 'unpin' })}
                className="text-[10px] font-black text-rose-500 shrink-0 cursor-pointer"
              >
                {isAr ? 'إلغاء التثبيت' : 'Unpin'}
              </button>
            )}
          </div>
        )}
        {nextEvent && (
          <div className="px-2.5 py-1 rounded-xl bg-violet-500/10 border border-violet-500/25 text-[11px] flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 truncate font-bold text-violet-700 dark:text-violet-300">
              <Calendar className="w-3 h-3 shrink-0" />
              <span className="truncate">{nextEvent.title} · {new Date(nextEvent.startsAt).toLocaleString()}</span>
            </span>
            <button
              type="button"
              onClick={async () => {
                await roomsApi.manageEvents(room.code, { action: 'rsvp', eventId: nextEvent.id });
              }}
              className="px-2 py-0.5 rounded-lg bg-violet-500 text-white text-[10px] font-black shrink-0 cursor-pointer"
            >
              {nextEvent.rsvpUserIds.includes(currentUser.id)
                ? (isAr ? `مسجل (${nextEvent.rsvpUserIds.length})` : `Joined (${nextEvent.rsvpUserIds.length})`)
                : (isAr ? 'حجز تذكير' : 'RSVP')}
            </button>
          </div>
        )}
      </div>
      )}

      {/* Main Content Split: Expanded 15-Seat Stage + Half-Size Compact Real-time Chat */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-2 p-2 sm:p-2.5 overflow-hidden">
        {/* 15 Voice Seats Stage (3x5 balanced grid on mobile, 5x3 spacious stage on sm+/desktop) */}
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="grid grid-cols-3 grid-rows-5 sm:grid-cols-5 sm:grid-rows-3 flex-1 min-h-0 h-full gap-1.5 sm:gap-2">
            {seats.map((seat) => {
              const isOccupied = Boolean(seat.userId);
              const occ = seat.userId ? occupants.find((o) => o.userId === seat.userId) : undefined;
              const isSpeaking = Boolean(seat.isSpeaking && !seat.isMutedBySelf && !seat.isMutedByMod && !room.isRoomMuted);
              const micMuted = seat.isMutedBySelf || seat.isMutedByMod || room.isRoomMuted;

              return (
                <button
                  key={seat.seatNumber}
                  type="button"
                  onClick={() => {
                    if (isOccupied && occ) {
                      setActionUser(occ);
                    } else if (isOccupied && seat.userId) {
                      setActionUser({
                        userId: seat.userId,
                        displayId: seat.displayId || undefined,
                        name: seat.name || 'عضو',
                        avatar: seat.avatar || undefined,
                        isVerified: seat.isVerified,
                        equippedFrameId: seat.equippedFrameId,
                        role: seat.role || 'member',
                        seatNumber: seat.seatNumber,
                        isMicOpen: !micMuted,
                        isMutedByMod: seat.isMutedByMod,
                        isSpeaking,
                        reconnecting: seat.reconnecting,
                        joinedAt: seat.occupiedAt || new Date().toISOString(),
                      });
                    } else if (!seat.isLocked) {
                      setSitConfirmSeat(seat.seatNumber);
                    } else if (room.myRole === 'owner' || room.myRole === 'head_admin' || room.myPermissions.manageSeats) {
                      roomsApi.manageSeat(room.code, { action: 'unlock', seatNumber: seat.seatNumber }).then(() => loadRoomData());
                    } else {
                      showToast(isAr ? 'هذا المقعد مقفل من الإدارة' : 'Seat is locked');
                    }
                  }}
                  className={`relative h-full min-h-0 rounded-xl sm:rounded-2xl p-1 sm:p-1.5 border flex flex-col items-center justify-center gap-0.5 sm:gap-1 transition-all cursor-pointer overflow-hidden ${
                    isSpeaking
                      ? 'bg-cyan-500/10 border-cyan-500 ring-2 ring-cyan-500/40'
                      : isOccupied
                      ? 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 hover:border-cyan-500/50'
                      : seat.isLocked
                      ? 'bg-neutral-100/70 dark:bg-neutral-900/40 border-neutral-200/70 dark:border-neutral-800/70 opacity-70'
                      : 'bg-white/70 dark:bg-neutral-900/60 border-dashed border-neutral-300 dark:border-neutral-700 hover:border-cyan-500'
                  }`}
                >
                  <span className="absolute top-1 start-1.5 text-[8px] sm:text-[9px] font-mono font-bold text-neutral-400">
                    #{seat.seatNumber}
                  </span>

                  {seat.role === 'owner' && (
                    <Crown className="w-3 h-3 text-amber-500 absolute top-1 end-1.5" />
                  )}
                  {(seat.role === 'head_admin' || seat.role === 'moderator') && (
                    <Shield
                      className={`w-3 h-3 absolute top-1 end-1.5 ${
                        seat.role === 'head_admin' ? 'text-violet-500' : 'text-cyan-500'
                      }`}
                    />
                  )}

                  {isOccupied ? (
                    <>
                      <div className={`relative ${isSpeaking ? 'animate-pulse' : ''}`}>
                        <AvatarWithFrame
                          src={getEffectiveAvatar(seat.avatar)}
                          fallbackSrc={getDefaultAvatar()}
                          alt={seat.name || 'User'}
                          frameId={seat.equippedFrameId}
                          sizeClass="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12"
                        />
                        <span
                          className={`absolute -bottom-0.5 -end-0.5 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border-2 border-white dark:border-neutral-900 flex items-center justify-center ${
                            micMuted ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'
                          }`}
                        >
                          {micMuted ? <MicOff className="w-2 h-2" /> : <Mic className="w-2 h-2" />}
                        </span>
                      </div>

                      <div className="w-full text-center px-0.5">
                        <div className="text-[9px] sm:text-[10px] font-bold text-neutral-900 dark:text-white truncate inline-flex items-center justify-center gap-0.5 max-w-full leading-tight">
                          <span className="truncate">{seat.name}</span>
                          {seat.isVerified && <VerifiedBadge lang={lang} size="xs" />}
                        </div>
                        {seat.reconnecting && (
                          <div className="text-[8px] font-bold text-amber-500 leading-none">
                            {isAr ? 'إعادة اتصال...' : 'Reconnecting'}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-7 h-7 sm:w-9 sm:h-9 lg:w-10 lg:h-10 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-400">
                        {seat.isLocked ? <Lock className="w-3.5 h-3.5 text-amber-500" /> : <Armchair className="w-4 h-4" />}
                      </div>
                      <span className="text-[9px] sm:text-[10px] font-bold text-neutral-400 leading-none">
                        {seat.isLocked ? (isAr ? 'مقفل' : 'Locked') : (isAr ? 'صعود' : 'Sit')}
                      </span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Real-time Room Chat Panel (Halved compact size) */}
        <div className="h-[140px] sm:h-[165px] lg:h-full lg:w-[27%] lg:min-w-[240px] lg:max-w-[300px] shrink-0 flex flex-col rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 overflow-hidden">
          <div className="px-2.5 py-1 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-[10px] sm:text-[11px] font-black shrink-0">
            <span>{isAr ? 'دردشة الغرفة المباشرة' : 'Live Room Chat'}</span>
            {(room.myRole === 'owner' || room.myRole === 'head_admin' || room.myPermissions.pauseChat) && (
              <button
                type="button"
                onClick={() =>
                  roomsApi.moderateChat(room.code, { action: room.chatPaused ? 'resume' : 'pause' })
                }
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer ${
                  room.chatPaused ? 'bg-emerald-500/15 text-emerald-600' : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                }`}
              >
                {room.chatPaused ? <Play className="w-2.5 h-2.5" /> : <Pause className="w-2.5 h-2.5" />}
                <span>{room.chatPaused ? (isAr ? 'تشغيل' : 'Resume') : (isAr ? 'إيقاف مؤقت' : 'Pause')}</span>
              </button>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-2 py-1 space-y-1">
            {messages.map((msg) => {
              if (msg.msgType === 'system' || msg.msgType === 'announcement') {
                return (
                  <div
                    key={msg.id}
                    className={`px-2.5 py-1 rounded-xl text-[10px] sm:text-[11px] font-bold text-center ${
                      msg.msgType === 'announcement'
                        ? 'bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-500/20'
                        : 'bg-neutral-100 dark:bg-neutral-800/60 text-neutral-500 dark:text-neutral-400'
                    }`}
                  >
                    {msg.text}
                  </div>
                );
              }

              if (msg.msgType === 'gift') {
                return (
                  <div
                    key={msg.id}
                    className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center gap-2 text-[11px]"
                  >
                    {msg.metadata?.giftId && <GiftSvgIcon giftId={msg.metadata.giftId} className="w-6 h-6 shrink-0" />}
                    <span className="font-bold text-amber-800 dark:text-amber-200">{msg.text}</span>
                  </div>
                );
              }

              const canDel =
                msg.senderId === currentUser.id ||
                room.myRole === 'owner' ||
                room.myRole === 'head_admin' ||
                room.myPermissions.deleteMessages;
              const canPin =
                room.myRole === 'owner' || room.myRole === 'head_admin' || room.myPermissions.pinMessages;

              return (
                <div key={msg.id} className="group flex items-start gap-1.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      if (!msg.senderId) return;
                      const found = occupants.find((o) => o.userId === msg.senderId);
                      if (found) setActionUser(found);
                      else openUserProfile({ id: msg.senderId, name: msg.senderName || '' });
                    }}
                    className="shrink-0 cursor-pointer mt-0.5"
                  >
                    <img
                      src={getEffectiveAvatar(msg.senderAvatar)}
                      onError={(e) => {
                        e.currentTarget.src = getDefaultAvatar();
                      }}
                      alt={msg.senderName || ''}
                      className="w-5 h-5 rounded-full object-cover"
                    />
                  </button>
                  <div className="flex-1 min-w-0 bg-neutral-100/80 dark:bg-neutral-800/60 rounded-xl px-2 py-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-black text-[10px] text-cyan-700 dark:text-cyan-400 inline-flex items-center gap-1 truncate">
                        {msg.senderRole === 'owner' && <Crown className="w-2.5 h-2.5 text-amber-500" />}
                        {msg.senderRole === 'head_admin' && <Shield className="w-2.5 h-2.5 text-violet-500" />}
                        {msg.senderRole === 'moderator' && <Shield className="w-2.5 h-2.5 text-cyan-500" />}
                        <span className="truncate">{msg.senderName}</span>
                        {msg.senderIsVerified && <VerifiedBadge lang={lang} size="xs" />}
                      </span>
                      <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100">
                        {canPin && (
                          <button
                            type="button"
                            onClick={() => roomsApi.moderateChat(room.code, { action: 'pin', messageId: msg.id })}
                            className="p-0.5 hover:text-cyan-500 cursor-pointer"
                            title={isAr ? 'تثبيت' : 'Pin'}
                          >
                            <Pin className="w-2.5 h-2.5" />
                          </button>
                        )}
                        {canDel && (
                          <button
                            type="button"
                            onClick={() => roomsApi.moderateChat(room.code, { action: 'delete', messageId: msg.id })}
                            className="p-0.5 hover:text-rose-500 cursor-pointer"
                            title={isAr ? 'حذف' : 'Delete'}
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-[11px] text-neutral-800 dark:text-neutral-100 leading-snug break-words">{msg.text}</p>
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleSendChat} className="p-1 sm:p-1.5 border-t border-neutral-200 dark:border-neutral-800 flex items-center gap-1.5 shrink-0">
            <input
              ref={chatInputRef}
              type="text"
              maxLength={600}
              disabled={(!room.chatEnabled || room.chatPaused) && room.myRole === 'member'}
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              placeholder={
                !room.chatEnabled
                  ? (isAr ? 'الدردشة معطلة في الغرفة' : 'Chat disabled')
                  : room.chatPaused
                  ? (isAr ? 'الدردشة متوقفة مؤقتاً...' : 'Chat paused...')
                  : (isAr ? 'اكتب رسالة للغرفة...' : 'Type a message...')
              }
              className="flex-1 h-8 px-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-55"
            />
            <button
              type="submit"
              disabled={!chatText.trim()}
              className="w-8 h-8 rounded-xl bg-cyan-500 hover:bg-cyan-600 disabled:opacity-45 text-neutral-950 flex items-center justify-center cursor-pointer shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>

      {/* Bottom Thumb Control Dock */}
      <div className="px-2 sm:px-5 py-1.5 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-1 shrink-0 overflow-x-auto no-scrollbar">
        {/* Mic / Sit / Request */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleToggleMic}
            className={`min-h-[38px] px-2.5 sm:px-3.5 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer transition-all shrink-0 ${
              !mySeat
                ? inQueue
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/35'
                  : 'bg-cyan-500 text-neutral-950'
                : canTransmitAudio
                ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/35'
            }`}
          >
            {mySeat ? (canTransmitAudio ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />) : <Hand className="w-4 h-4" />}
            <span>{micLabel}</span>
          </button>

          {mySeat && (
            <button
              type="button"
              onClick={() => roomsApi.leaveSeat(room.code)}
              className="min-h-[38px] px-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 text-xs font-bold text-neutral-700 dark:text-neutral-200 cursor-pointer shrink-0"
              title={isAr ? 'النزول عن المقعد' : 'Leave Seat'}
            >
              {isAr ? 'نزول' : 'Unseat'}
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Queue / Users */}
          <button
            type="button"
            onClick={() => {
              setManageInitialTab(queue.length > 0 && canManageAny ? 'queue' : 'users');
              setIsManageOpen(true);
            }}
            className="relative min-h-[38px] px-2 sm:px-3 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
          >
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">{isAr ? 'الأعضاء' : 'Users'}</span>
            {queue.length > 0 && (
              <span className="min-w-4 h-4 px-1 rounded-full bg-amber-500 text-neutral-950 font-mono text-[9px] font-black flex items-center justify-center">
                {queue.length}
              </span>
            )}
          </button>

          {/* Gifts */}
          <button
            type="button"
            onClick={() => {
              setGiftTargetId(null);
              setIsGiftOpen(true);
            }}
            className="min-h-[38px] px-2 sm:px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-black flex items-center gap-1 cursor-pointer shrink-0"
          >
            <Gift className="w-4 h-4" />
            <span className="hidden sm:inline">{isAr ? 'هدايا' : 'Gifts'}</span>
          </button>

          {/* Games */}
          <button
            type="button"
            onClick={() => setIsGamesOpen(true)}
            className={`relative min-h-[38px] px-2 sm:px-3 rounded-xl border text-xs font-black flex items-center gap-1 cursor-pointer shrink-0 ${
              game.status !== 'idle'
                ? 'bg-cyan-500/20 border-cyan-500 text-cyan-600 dark:text-cyan-300'
                : 'bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 border-transparent text-neutral-700 dark:text-neutral-200'
            }`}
          >
            <Gamepad2 className="w-4 h-4" />
            <span className="hidden sm:inline">{isAr ? 'ألعاب' : 'Games'}</span>
          </button>

          {/* Music (for DJ/admin) or Audio Control (for users) */}
          {canControlMusic ? (
            <button
              type="button"
              onClick={() => setIsMusicOpen(true)}
              className={`relative min-h-[38px] px-2 sm:px-3 rounded-xl border text-xs font-black flex items-center gap-1 cursor-pointer shrink-0 ${
                music.isPlaying
                  ? 'bg-cyan-500/20 border-cyan-500 text-cyan-600 dark:text-cyan-300'
                  : 'bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 border-transparent text-neutral-700 dark:text-neutral-200'
              }`}
              title={isAr ? 'موسيقى الغرفة' : 'Music'}
            >
              <Music className={`w-4 h-4 ${music.isPlaying ? 'animate-pulse' : ''}`} />
              <span className="hidden sm:inline">{isAr ? 'موسيقى' : 'Music'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsMusicOpen(true)}
              className={`relative min-h-[38px] px-2 sm:px-3 rounded-xl border text-xs font-black flex items-center gap-1 cursor-pointer shrink-0 ${
                isDeafened || voiceVolume <= 0.01 || musicVolume <= 0.01
                  ? 'bg-amber-500/15 border-amber-500/35 text-amber-700 dark:text-amber-300'
                  : 'bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 border-transparent text-neutral-700 dark:text-neutral-200'
              }`}
              title={isAr ? 'التحكم بالصوت' : 'Audio Control'}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span className="hidden sm:inline">{isAr ? 'التحكم بالصوت' : 'Audio'}</span>
            </button>
          )}

          {/* Leave Room */}
          <button
            type="button"
            onClick={handleExplicitLeave}
            className="min-h-[38px] px-2 sm:px-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-400 text-xs font-black flex items-center gap-1 cursor-pointer shrink-0"
            title={isAr ? 'مغادرة الغرفة' : 'Leave'}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Confirm Sit Seat Modal */}
      {sitConfirmSeat !== null && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-xs rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-5 text-center space-y-4 shadow-2xl">
            <Armchair className="w-10 h-10 text-cyan-500 mx-auto" />
            <div className="space-y-1">
              <h4 className="text-sm font-black">{isAr ? `الجلوس على المقعد #${sitConfirmSeat}` : `Take Seat #${sitConfirmSeat}`}</h4>
              <p className="text-xs text-neutral-500">
                {isAr ? 'سيبدأ المايك مكتوماً افتراضياً حفاظاً على خصوصيتك' : 'Your microphone starts muted by default'}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSitConfirmSeat(null)}
                className="flex-1 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-xs font-bold cursor-pointer"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const targetNum = sitConfirmSeat;
                  setSitConfirmSeat(null);
                  const r = await roomsApi.sitOnSeat(room.code, targetNum);
                  if (!r.success) showToast(r.message || 'Cannot sit');
                }}
                className="flex-1 py-2.5 rounded-xl bg-cyan-500 text-neutral-950 text-xs font-black cursor-pointer"
              >
                {isAr ? 'تأكيد الصعود' : 'Sit Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick User Profile & Room Actions Sheet */}
      {actionUser && (
        <div
          className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/65 backdrop-blur-xs"
          onClick={() => setActionUser(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center gap-3">
              <AvatarWithFrame
                src={getEffectiveAvatar(actionUser.avatar)}
                fallbackSrc={getDefaultAvatar()}
                alt={actionUser.name}
                frameId={actionUser.equippedFrameId}
                sizeClass="w-14 h-14"
              />
              <div className="min-w-0 flex-1">
                <div className="text-base font-black text-neutral-900 dark:text-white inline-flex items-center gap-1 truncate max-w-full">
                  <span className="truncate">{actionUser.name}</span>
                  {actionUser.isVerified && <VerifiedBadge lang={lang} size="xs" />}
                </div>
                <div className="text-xs font-mono text-neutral-500">
                  {actionUser.displayId || actionUser.userId}
                  {actionUser.seatNumber ? ` · #${actionUser.seatNumber}` : ''}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  const target = actionUser;
                  setActionUser(null);
                  openUserProfile({
                    id: target.userId,
                    displayId: target.displayId,
                    name: target.name,
                    avatar: target.avatar,
                    isVerified: target.isVerified,
                    equippedFrameId: target.equippedFrameId,
                  });
                }}
                className="py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <User className="w-4 h-4 text-cyan-500" />
                <span>{isAr ? 'الملف الشخصي' : 'Profile'}</span>
              </button>

              {actionUser.userId !== currentUser.id && (
                <button
                  type="button"
                  onClick={() => {
                    setGiftTargetId(actionUser.userId);
                    setActionUser(null);
                    setIsGiftOpen(true);
                  }}
                  className="py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Gift className="w-4 h-4" />
                  <span>{isAr ? 'إرسال هدية' : 'Send Gift'}</span>
                </button>
              )}

              {actionUser.userId === currentUser.id && actionUser.seatNumber && (
                <button
                  type="button"
                  onClick={() => {
                    setActionUser(null);
                    roomsApi.leaveSeat(room.code);
                  }}
                  className="py-2.5 rounded-xl bg-rose-500/15 text-rose-600 text-xs font-black cursor-pointer"
                >
                  {isAr ? 'النزول عن المقعد' : 'Leave Seat'}
                </button>
              )}

              {actionUser.userId !== currentUser.id &&
                actionUser.seatNumber &&
                (room.myRole === 'owner' || room.myRole === 'head_admin' || room.myPermissions.muteUsers) &&
                actionUser.role !== 'owner' && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = actionUser;
                      setActionUser(null);
                      roomsApi.manageSeat(room.code, {
                        action: target.isMutedByMod ? 'unmute_user' : 'mute_user',
                        targetUserId: target.userId,
                      });
                    }}
                    className="py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <MicOff className="w-4 h-4 text-rose-500" />
                    <span>{actionUser.isMutedByMod ? (isAr ? 'فك كتم المايك' : 'Unmute Mic') : (isAr ? 'كتم المايك' : 'Mute Mic')}</span>
                  </button>
                )}

              {actionUser.userId !== currentUser.id &&
                actionUser.seatNumber &&
                (room.myRole === 'owner' || room.myRole === 'head_admin' || room.myPermissions.manageSeats) &&
                actionUser.role !== 'owner' && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = actionUser;
                      setActionUser(null);
                      roomsApi.manageSeat(room.code, { action: 'evict', targetUserId: target.userId });
                    }}
                    className="py-2.5 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300 text-xs font-bold cursor-pointer"
                  >
                    {isAr ? 'إنزال من المقعد' : 'Remove Seat'}
                  </button>
                )}

              {actionUser.userId !== currentUser.id &&
                (room.myRole === 'owner' || room.myRole === 'head_admin' || room.myPermissions.kickUsers || room.myPermissions.banUsers) &&
                actionUser.role !== 'owner' && (
                  <button
                    type="button"
                    onClick={() => {
                      setActionUser(null);
                      setManageInitialTab('users');
                      setIsManageOpen(true);
                    }}
                    className="py-2.5 rounded-xl bg-rose-500/15 text-rose-600 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Ban className="w-4 h-4" />
                    <span>{isAr ? 'إدارة / طرد' : 'Kick / Ban'}</span>
                  </button>
                )}
            </div>
          </div>
        </div>
      )}

      {/* Sub-Modals */}
      <RoomGiftModal
        isOpen={isGiftOpen}
        onClose={() => setIsGiftOpen(false)}
        lang={lang}
        roomCode={room.code}
        ownerId={room.ownerId}
        ownerName={room.ownerName}
        myUserId={currentUser.id}
        coinsBalance={coinsBalance}
        occupants={occupants}
        initialRecipientId={giftTargetId}
        onOpenWallet={onOpenWallet}
        onBalanceSync={onCoinsSync}
      />

      <RoomGamesModal
        isOpen={isGamesOpen}
        onClose={() => setIsGamesOpen(false)}
        lang={lang}
        game={game}
        canManageGames={canManageGames}
        myUserId={currentUser.id}
        onStartGame={(gType: RoomMiniGameType) =>
          wsRef.current?.send(JSON.stringify({ type: 'game:action', action: 'start', gameType: gType }))
        }
        onAnswer={(ans) =>
          wsRef.current?.send(JSON.stringify({ type: 'game:action', action: 'answer', answer: ans }))
        }
        onNextRound={() => wsRef.current?.send(JSON.stringify({ type: 'game:action', action: 'next' }))}
        onEndGame={() => wsRef.current?.send(JSON.stringify({ type: 'game:action', action: 'end' }))}
      />

      <RoomMusicModal
        isOpen={isMusicOpen}
        onClose={() => setIsMusicOpen(false)}
        lang={lang}
        music={music}
        canControlMusic={canControlMusic}
        localVolume={musicVolume}
        onLocalVolumeChange={(v) => {
          setMusicVolume(v);
          musicEngineRef.current?.setVolume(v);
        }}
        voiceVolume={voiceVolume}
        onVoiceVolumeChange={(v) => {
          setVoiceVolume(v);
          audioRef.current?.setVoiceVolume(v);
          if (v > 0.01 && isDeafened) {
            setIsDeafened(false);
            audioRef.current?.setDeafened(false);
          }
        }}
        isDeafened={isDeafened}
        onToggleDeafen={() => {
          const next = !isDeafened;
          setIsDeafened(next);
          audioRef.current?.setDeafened(next);
          if (!next && voiceVolume <= 0.01) {
            setVoiceVolume(1);
            audioRef.current?.setVoiceVolume(1);
          }
        }}
        onControl={(action, trackId) =>
          wsRef.current?.send(JSON.stringify({ type: 'music:control', action, trackId }))
        }
      />

      <RoomManageModal
        isOpen={isManageOpen}
        onClose={() => setIsManageOpen(false)}
        lang={lang}
        room={room}
        seats={seats}
        occupants={occupants}
        queue={queue}
        moderators={moderators}
        events={events}
        isPlatformAdmin={Boolean(currentUser.isAdmin)}
        initialTab={manageInitialTab}
        onRoomUpdated={(u) => setRoom(u)}
        onDeletedRoom={() => {
          explicitLeaveRef.current = true;
          onLeave();
        }}
        onRefreshRoom={loadRoomData}
      />
    </div>
  );
};
