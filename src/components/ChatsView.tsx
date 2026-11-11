import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  CheckCheck,
  Send,
  ArrowRight,
  ArrowLeft,
  UserPlus,
  Users,
  UserCheck,
  MoreVertical,
  Smile,
  Paperclip,
  Mic,
  X,
  MessageCircle,
  Clock,
  Sparkles,
  Loader2,
  AlertCircle,
  RefreshCw,
  Gift,
  Bell,
  Lock,
  ShieldCheck,
  CheckCircle2,
  ArrowDownToLine,
  Radio,
  Megaphone,
  Mail,
  Plus,
  Camera,
  Image as ImageIcon,
  Music,
  Trash2,
  Maximize2,
} from 'lucide-react';
import { Language, AuthUser, UserNotification } from '../types';
import { FriendsView } from './FriendsView';
import { GiftModal, GiftItem, getGiftDisplayInfo } from './GiftModal';
import { CoinIcon } from './CurrencyIcons';
import { getEffectiveAvatar, getDefaultAvatar } from '../lib/avatar';
import {
  formatLocalTime,
  formatLocalDateTime,
  formatRelativeChatTime,
} from '../lib/dateUtils';
import { formatCountryUnified } from '../lib/countryUtils';
import { AudioMessagePlayer } from './AudioMessagePlayer';
import { LiveCameraModal } from './LiveCameraModal';
import { MediaPreviewModal } from './MediaPreviewModal';
import { ImageLightboxModal } from './ImageLightboxModal';
import { compressImageFile, fileToDataUrl, formatAudioDuration } from '../lib/mediaUtils';

interface ChatsViewProps {
  lang: Language;
  currentUser?: AuthUser | null;
  walletBalance?: number;
  coinsBalance?: number;
  onDeductDiamonds?: (amount: number) => void;
  onDeductCoins?: (amount: number) => void;
  onOpenWallet?: () => void;
  onActiveChatChange?: (isActive: boolean) => void;
}

interface Message {
  id: string;
  clientMessageId?: string;
  sender: 'me' | 'them';
  text: string;
  createdAt?: string;
  time: string;
  isGift?: boolean;
  giftIcon?: string;
  giftName?: string;
  giftCost?: number;
  mediaType?: 'image' | 'audio' | 'text';
  mediaUrl?: string;
  audioDuration?: number;
}

interface ChatConversation {
  id: string;
  partnerId?: string;
  name: string;
  avatar: string;
  status: 'online' | 'offline';
  lastMessage: string;
  createdAt?: string;
  time: string;
  unreadCount: number;
  messages: Message[];
  age?: number;
  country?: string;
}

interface Friend {
  id: string;
  name: string;
  avatar: string;
  status: 'online' | 'offline';
  bio: string;
  age?: number;
  country?: string;
  location?: string;
}

export const ChatsView: React.FC<ChatsViewProps> = ({
  lang,
  currentUser,
  walletBalance = 0,
  coinsBalance = 0,
  onDeductDiamonds,
  onDeductCoins,
  onOpenWallet,
  onActiveChatChange,
}) => {
  const isAr = lang === 'ar';
  const myEffectiveAvatar = getEffectiveAvatar(currentUser?.photoUrl, currentUser?.gender);

  // Separate Full-Screen Page for Friends & Friend Requests
  const [isFriendsPageOpen, setIsFriendsPageOpen] = useState(false);
  const [isGiftModalOpen, setIsGiftModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Real Conversations list strictly loaded from Database (no local storage)
  const [conversations, setConversations] = useState<ChatConversation[]>([]);

  // Currently open chat thread (null means we are in the WhatsApp chat list)
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  // Dedicated pending/newly started friend chat to prevent polling from closing it
  const [activePendingChat, setActivePendingChat] = useState<ChatConversation | null>(null);

  // Active Chat Object (stable fallback to activePendingChat prevents chat screen from flashing/closing)
  const currentChat =
    activeChatId === 'official-notifications'
      ? undefined
      : conversations.find(
          (c) =>
            c.id === activeChatId ||
            (activeChatId && c.partnerId && c.partnerId === activeChatId) ||
            (activePendingChat && (c.id === activePendingChat.id || c.name === activePendingChat.name))
        ) || (activePendingChat && (activePendingChat.id === activeChatId || activePendingChat.partnerId === activeChatId) ? activePendingChat : undefined);

  // Synchronize active chat state with parent (to hide/show BottomNav smoothly and track open thread)
  useEffect(() => {
    const isChatActive = Boolean(activeChatId);
    onActiveChatChange?.(isChatActive);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('soulx:active-chat-changed', {
          detail: {
            isActive: isChatActive,
            chatId: activeChatId,
            partnerId: currentChat?.partnerId,
            conversationId: currentChat?.id,
          },
        })
      );
    }
  }, [activeChatId, currentChat?.partnerId, currentChat?.id, onActiveChatChange]);

  // Synchronize total unread messages count with App state
  useEffect(() => {
    const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('soulx:unread-messages-count', {
          detail: { unreadCount: totalUnread },
        })
      );
    }
  }, [conversations]);

  useEffect(() => {
    return () => {
      onActiveChatChange?.(false);
    };
  }, [onActiveChatChange]);

  // Search input
  const [searchQuery, setSearchQuery] = useState('');

  // Typing indicator simulation
  const [isTyping, setIsTyping] = useState(false);

  const [inputMessage, setInputMessage] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);

  // Media Sharing states (+ button menu, camera, voice note recording, preview, lightbox)
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [previewMedia, setPreviewMedia] = useState<{
    type: 'image' | 'audio';
    url: string;
    duration?: number;
  } | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{
    url: string;
    caption?: string;
  } | null>(null);

  // In-line Voice Recording State
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);

  // Hidden File Input & Menu Refs
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const audioFileInputRef = useRef<HTMLInputElement | null>(null);
  const attachmentMenuRef = useRef<HTMLDivElement | null>(null);

  // Close attachment menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        attachmentMenuRef.current &&
        !attachmentMenuRef.current.contains(e.target as Node)
      ) {
        setIsAttachmentMenuOpen(false);
      }
    };
    if (isAttachmentMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isAttachmentMenuOpen]);

  // Loading and Error states for database fetching
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Current logged in user full identifiers
  const getUserIdentifiers = () => {
    let uid = '';
    let dispId = '';
    let email = '';
    if (typeof window !== 'undefined') {
      try {
        const u = JSON.parse(localStorage.getItem('soulx_auth_user') || '{}');
        if (u?.id) uid = u.id;
        if (u?.displayId) dispId = u.displayId;
        if (u?.email) email = u.email;
      } catch {}
    }
    return {
      userId: uid || currentUser?.id || '549182301',
      displayId: dispId || currentUser?.displayId || '',
      email: email || currentUser?.email || '',
    };
  };

  const getCurrentUserId = () => {
    return getUserIdentifiers().userId;
  };

  // User Notifications for the Pinned "مركز الإشعارات" Chat (قبول طلب الصداقة وشحن حسابه بواسطة الوكيل فقط)
  const [userNotifications, setUserNotifications] = useState<UserNotification[]>([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState<boolean>(false);

  // Friend requests count state
  const [friendRequestsCount, setFriendRequestsCount] = useState<number>(0);

  // Scroll anchors for chat messages and notifications
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const notificationsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on chat open or new messages
  useEffect(() => {
    if (activeChatId && activeChatId !== 'official-notifications') {
      const timer = setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [activeChatId, activePendingChat?.id, activePendingChat?.messages.length, isTyping]);

  useEffect(() => {
    if (activeChatId === 'official-notifications' && userNotifications.length) {
      const timer = setTimeout(() => {
        notificationsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [activeChatId, userNotifications.length]);

  // Fetch pending incoming friend requests count
  const fetchFriendRequestsCount = async () => {
    try {
      const ident = getUserIdentifiers();
      let queryUrl = `/api/friends/list?userId=${encodeURIComponent(ident.userId)}`;
      if (ident.displayId) queryUrl += `&displayId=${encodeURIComponent(ident.displayId)}`;
      if (ident.email) queryUrl += `&email=${encodeURIComponent(ident.email)}`;
      const res = await fetch(queryUrl);
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.incomingRequests)) {
        const friendIds = new Set((data.friends || []).map((f: any) => f.id));
        const validRequests = data.incomingRequests.filter(
          (r: any) => !friendIds.has(r.senderId) && !friendIds.has(r.userId)
        );
        setFriendRequestsCount(validRequests.length);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('soulx_friend_requests_count', {
              detail: { count: validRequests.length },
            })
          );
        }
      }
    } catch {}
  };

  // Cleanup: purge any legacy locally stored chat conversations from browser localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith('soulx_saved_conversations_') || key === 'soulx_chat_last_message')) {
            keysToRemove.push(key);
          }
        }
        for (const k of keysToRemove) {
          localStorage.removeItem(k);
        }
      } catch {}
    }
  }, []);

  // Fetch fresh conversations directly from database when currentUser changes or logs in
  useEffect(() => {
    setActiveChatId(null);
    setActivePendingChat(null);
    setConversations([]);
    loadDatabaseData(true);
    fetchFriendRequestsCount();
    loadUserNotifications();
  }, [currentUser?.id, currentUser?.displayId, currentUser?.email]);

  // Helper to merge fetched remote conversations with local conversations without dropping active or unsent chats
  const mergeRemoteWithLocalConversations = (
    prev: ChatConversation[],
    remoteList: ChatConversation[],
    currentActiveId: string | null
  ): ChatConversation[] => {
    // 1. Update remote conversations with any local state (messages, unread count)
    const updatedRemotes = remoteList.map((remoteConv) => {
      const localConv = prev.find(
        (c) =>
          c.id === remoteConv.id ||
          (c.partnerId && remoteConv.partnerId && c.partnerId === remoteConv.partnerId) ||
          c.name === remoteConv.name
      );
      if (!localConv) return remoteConv;
      const isReadLocally = localConv.unreadCount === 0;

      // Union messages by ID and deduplicate between remote and local optimistic copies
      const combinedMap = new Map<string, Message>();
      // 1. Populate remote messages (authoritative from database)
      for (const m of remoteConv.messages || []) {
        if (m && m.id) combinedMap.set(m.id, m);
      }
      // 2. Add local messages only if they are genuinely pending and not already in remote
      for (const m of localConv.messages || []) {
        if (!m || !m.id) continue;
        if (combinedMap.has(m.id)) continue;
        const timeLocal = new Date(m.createdAt || m.time || 0).getTime();
        const isDuplicateOfRemote = Array.from(combinedMap.values()).some((rm) => {
          if (rm.sender !== m.sender) return false;
          if (rm.text !== m.text) return false;
          const timeRemote = new Date(rm.createdAt || rm.time || 0).getTime();
          return Math.abs(timeRemote - timeLocal) < 20000;
        });
        if (!isDuplicateOfRemote) {
          combinedMap.set(m.id, m);
        }
      }
      const rawMsgs = Array.from(combinedMap.values());
      rawMsgs.sort(
        (a, b) => new Date(a.createdAt || a.time || 0).getTime() - new Date(b.createdAt || b.time || 0).getTime()
      );

      // 3. Strict deduplication pass: collapse any duplicate with identical sender & text within 15 seconds
      const allMsgs: Message[] = [];
      for (const msg of rawMsgs) {
        const timeMsg = new Date(msg.createdAt || msg.time || 0).getTime();
        const isDup = allMsgs.some((existing) => {
          if (existing.id === msg.id) return true;
          if (existing.sender === msg.sender && existing.text === msg.text) {
            const timeExisting = new Date(existing.createdAt || existing.time || 0).getTime();
            return Math.abs(timeExisting - timeMsg) < 15000;
          }
          return false;
        });
        if (!isDup) {
          allMsgs.push(msg);
        }
      }

      const latestMsg = allMsgs.length > 0 ? allMsgs[allMsgs.length - 1] : null;

      return {
        ...remoteConv,
        partnerId: remoteConv.partnerId || localConv.partnerId,
        unreadCount:
          remoteConv.id === currentActiveId ||
          localConv.id === currentActiveId ||
          (remoteConv.partnerId && remoteConv.partnerId === currentActiveId) ||
          (localConv.partnerId && localConv.partnerId === currentActiveId) ||
          isReadLocally
            ? 0
            : remoteConv.unreadCount,
        messages: allMsgs.length > 0 ? allMsgs : (remoteConv.messages || localConv.messages || []),
        lastMessage: latestMsg ? latestMsg.text : (remoteConv.lastMessage || localConv.lastMessage),
        time: latestMsg ? (latestMsg.createdAt || latestMsg.time) : (remoteConv.time || localConv.time),
        age: remoteConv.age ?? localConv.age,
        country: remoteConv.country || localConv.country,
      };
    });

    // 2. Keep any conversation in `prev` that does not exist yet on the remote server
    const localOnly = prev.filter((localConv) => {
      const existsInRemote = remoteList.some(
        (rc) =>
          rc.id === localConv.id ||
          (rc.partnerId && localConv.partnerId && rc.partnerId === localConv.partnerId) ||
          rc.name === localConv.name
      );
      return !existsInRemote;
    });

    const combined = [...localOnly, ...updatedRemotes];
    // Always sort newest message first!
    combined.sort((a, b) => {
      const timeA = new Date(a.time || a.createdAt || 0).getTime();
      const timeB = new Date(b.time || b.createdAt || 0).getTime();
      return timeB - timeA;
    });
    return combined;
  };

  // Fetch real data from backend database endpoints with loading & error handling
  const loadDatabaseData = async (showLoadingSpinner = true) => {
    if (showLoadingSpinner) {
      setIsLoading(true);
    }
    setLoadError(null);
    const ident = getUserIdentifiers();

    try {
      const query = new URLSearchParams({
        userId: ident.userId,
        ...(ident.displayId ? { displayId: ident.displayId } : {}),
        ...(ident.email ? { email: ident.email } : {}),
      });

      const convsRes = await fetch(`/api/conversations/list?${query.toString()}`).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      });

      if (convsRes.success && Array.isArray(convsRes.conversations)) {
        setConversations((prev) => mergeRemoteWithLocalConversations(prev, convsRes.conversations, activeChatId));
      }
    } catch (err: any) {
      if (showLoadingSpinner) {
        setLoadError(
          isAr
            ? 'تعذر تحميل الرسائل. يرجى التحقق من الاتصال والمحاولة ثانية.'
            : 'Failed to load messages. Please check connection and retry.'
        );
      }
    } finally {
      if (showLoadingSpinner) {
        setIsLoading(false);
      }
    }
  };

  // جلب إشعارات المستخدم لمركز الإشعارات (قبول الصداقة وشحن الوكيل فقط)
  const loadUserNotifications = async () => {
    const ident = getUserIdentifiers();
    if (!ident.userId && !ident.displayId && !ident.email) return;

    try {
      const query = new URLSearchParams({
        userId: ident.userId,
        ...(ident.displayId ? { displayId: ident.displayId } : {}),
        ...(ident.email ? { email: ident.email } : {}),
      });

      const res = await fetch(`/api/user/notifications?${query.toString()}`);
      const data = await res.json().catch(() => null);
      if (data && data.success && Array.isArray(data.notifications)) {
        setUserNotifications(data.notifications);
        if (activeChatId === 'official-notifications') {
          setUnreadNotificationsCount(0);
        } else {
          setUnreadNotificationsCount(data.unreadCount || 0);
        }
      }
    } catch (err) {
      console.warn('Failed to load user notifications:', err);
    }
  };

  // تعليم إشعارات المستخدم كمقروءة عند فتح مركز الإشعارات
  const handleMarkNotificationsRead = async () => {
    const ident = getUserIdentifiers();
    try {
      await fetch('/api/user/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: ident.userId,
          displayId: ident.displayId,
          email: ident.email,
        }),
      });
      setUnreadNotificationsCount(0);
      setUserNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.warn('Failed to mark notifications read:', err);
    }
  };

  // 1. Real-time Server-Sent Events (SSE) listener for instantaneous 0ms chat message arrival
  useEffect(() => {
    const ident = getUserIdentifiers();
    const query = new URLSearchParams({
      userId: ident.userId,
      ...(ident.displayId ? { displayId: ident.displayId } : {}),
      ...(ident.email ? { email: ident.email } : {}),
    });

    let eventSource: EventSource | null = null;
    let reconnectTimer: any = null;

    const connectSSE = () => {
      try {
        eventSource = new EventSource(`/api/messages/stream?${query.toString()}`);

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            // 1. Real-time direct balance update event from server
            if (data?.type === 'balance_update' && typeof data.balance === 'number') {
              const isTargetUser =
                !data.userId ||
                data.userId === ident.userId ||
                data.userId === ident.displayId ||
                (data.displayId && data.displayId === ident.displayId);

              if (isTargetUser) {
                window.dispatchEvent(
                  new CustomEvent('soulx:balance-updated', {
                    detail: {
                      userId: ident.userId,
                      displayId: ident.displayId,
                      balance: data.balance,
                      currency: data.currency,
                    },
                  })
                );
              }
              return;
            }

            if (data?.type === 'new_message') {
              const incomingMsg = data.message;
              const convId = data.conversationId;
              const sender = data.sender;
              const recipient = data.recipient;

              const senderIdFromMsg = incomingMsg?.senderId || sender?.id || data.senderId;
              const isMe =
                senderIdFromMsg === ident.userId ||
                senderIdFromMsg === ident.displayId ||
                (currentUser?.id && senderIdFromMsg === currentUser.id) ||
                (currentUser?.displayId && senderIdFromMsg === currentUser.displayId);

              // If message is a gift, sync recipient diamonds or sender coins immediately
              if (data.isGift) {
                if (!isMe && typeof data.recipientDiamonds === 'number') {
                  window.dispatchEvent(
                    new CustomEvent('soulx:balance-updated', {
                      detail: {
                        userId: ident.userId,
                        displayId: ident.displayId,
                        balance: data.recipientDiamonds,
                        currency: 'diamonds',
                      },
                    })
                  );
                } else if (isMe && typeof data.senderCoins === 'number') {
                  window.dispatchEvent(
                    new CustomEvent('soulx:balance-updated', {
                      detail: {
                        userId: ident.userId,
                        displayId: ident.displayId,
                        balance: data.senderCoins,
                        currency: 'coins',
                      },
                    })
                  );
                }
              }

              const isMsgForActiveChat = Boolean(
                activeChatId && (
                  activeChatId === convId ||
                  (currentChat && (
                    currentChat.id === convId ||
                    currentChat.partnerId === sender?.id ||
                    currentChat.partnerId === sender?.displayId ||
                    currentChat.partnerId === recipient?.id ||
                    currentChat.partnerId === recipient?.displayId
                  )) ||
                  (sender && (activeChatId === sender.id || activeChatId === sender.displayId)) ||
                  (recipient && (activeChatId === recipient.id || activeChatId === recipient.displayId))
                )
              );

              setConversations((prev) => {
                const existingIndex = prev.findIndex(
                  (c) =>
                    c.id === convId ||
                    (c.partnerId && (c.partnerId === sender?.id || c.partnerId === sender?.displayId || c.partnerId === recipient?.id || c.partnerId === recipient?.displayId)) ||
                    (isMe ? c.name === recipient?.name : c.name === sender?.name)
                );

                const newMsgObj: Message = {
                  id: incomingMsg.id || `msg-${Date.now()}`,
                  sender: isMe ? 'me' : 'them',
                  text: incomingMsg.text,
                  createdAt: incomingMsg.createdAt || new Date().toISOString(),
                  time: incomingMsg.createdAt || new Date().toISOString(),
                  mediaType: incomingMsg.mediaType,
                  mediaUrl: incomingMsg.mediaUrl,
                  audioDuration: incomingMsg.audioDuration,
                };

                if (existingIndex >= 0) {
                  const existing = prev[existingIndex];
                  const timeNew = new Date(newMsgObj.createdAt || newMsgObj.time || 0).getTime();
                  // Check if this message was already optimistically added (by ID or matching sender, text, and timestamp)
                  const existingMsgIndex = existing.messages.findIndex(
                    (m) =>
                      m.id === newMsgObj.id ||
                      (m.sender === newMsgObj.sender &&
                       m.text === newMsgObj.text &&
                       Math.abs(new Date(m.createdAt || m.time || 0).getTime() - timeNew) < 15000)
                  );

                  const updatedMessages =
                    existingMsgIndex >= 0
                      ? existing.messages.map((m, idx) =>
                          idx === existingMsgIndex
                            ? { ...m, id: newMsgObj.id, createdAt: newMsgObj.createdAt, time: newMsgObj.time }
                            : m
                        )
                      : [...existing.messages, newMsgObj];
                  const isCurrentActive = Boolean(
                    isMsgForActiveChat ||
                    (activeChatId && (
                      activeChatId === existing.id ||
                      activeChatId === convId ||
                      (existing.partnerId && activeChatId === existing.partnerId)
                    ))
                  );

                  const updatedConv: ChatConversation = {
                    ...existing,
                    id: convId || existing.id,
                    lastMessage: newMsgObj.text,
                    time: newMsgObj.createdAt || new Date().toISOString(),
                    createdAt: newMsgObj.createdAt || new Date().toISOString(),
                    unreadCount: isCurrentActive || isMe ? 0 : (existing.unreadCount || 0) + 1,
                    messages: updatedMessages,
                  };

                  if (isCurrentActive && !isMe && (convId || existing.id)) {
                    fetch('/api/conversations/mark-read', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        conversationId: convId || existing.id,
                        userId: ident.userId || ident.displayId,
                      }),
                    }).catch(() => {});
                  }

                  const updatedList = prev.map((c, i) => (i === existingIndex ? updatedConv : c));
                  return updatedList.sort((a, b) => new Date(b.time || b.createdAt || 0).getTime() - new Date(a.time || a.createdAt || 0).getTime());
                } else {
                  // Brand new conversation started by friend -> appears immediately on the chats screen!
                  const partnerInfo = isMe ? recipient : sender;
                  const isNewActive = Boolean(
                    isMsgForActiveChat ||
                    (activeChatId && (
                      activeChatId === convId ||
                      (partnerInfo && (activeChatId === partnerInfo.id || activeChatId === partnerInfo.displayId))
                    ))
                  );
                  const newConv: ChatConversation = {
                    id: convId,
                    partnerId: partnerInfo?.displayId || partnerInfo?.id || '',
                    name: partnerInfo?.name || (isAr ? 'صديق جديد' : 'New Friend'),
                    avatar: partnerInfo?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
                    status: 'online',
                    lastMessage: newMsgObj.text,
                    time: newMsgObj.createdAt || new Date().toISOString(),
                    createdAt: newMsgObj.createdAt || new Date().toISOString(),
                    unreadCount: isMe || isNewActive ? 0 : 1,
                    messages: [newMsgObj],
                  };
                  return [newConv, ...prev];
                }
              });

              window.dispatchEvent(
                new CustomEvent('soulx_chat_updated', {
                  detail: { ...data, isCurrentActive: isMsgForActiveChat },
                })
              );
            } else if (data?.type === 'user_notification') {
              const incomingNotif: UserNotification = data.notification;
              if (incomingNotif) {
                setUserNotifications((prev) => {
                  if (prev.some((n) => n.id === incomingNotif.id)) return prev;
                  return [incomingNotif, ...prev];
                });
                if (activeChatId !== 'official-notifications') {
                  setUnreadNotificationsCount((prev) => prev + 1);
                }
                window.dispatchEvent(
                  new CustomEvent('soulx_user_notification_received', { detail: incomingNotif })
                );
              }
            }
          } catch {}
        };

        eventSource.onerror = () => {
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          reconnectTimer = setTimeout(connectSSE, 3000);
        };
      } catch {
        reconnectTimer = setTimeout(connectSSE, 3000);
      }
    };

    connectSSE();

    // Cross-tab broadcast channel for instant multi-tab sync
    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('soulx_chat_events');
        bc.onmessage = () => {
          loadDatabaseData(false);
        };
      } catch {}
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'soulx_chat_last_message' || e.key === 'soulx_friends_list') {
        loadDatabaseData(false);
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      if (eventSource) eventSource.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (bc) bc.close();
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [activeChatId]);

  // 2. Initial load and fallback polling every 1.5s as background resilience
  useEffect(() => {
    loadDatabaseData(true);
    loadUserNotifications();

    const pollInterval = setInterval(() => {
      loadDatabaseData(false);
      loadUserNotifications();
    }, 2500);

    const handleUpdate = () => {
      loadDatabaseData(false);
      loadUserNotifications();
    };
    window.addEventListener('soulx_friends_updated', handleUpdate);
    window.addEventListener('soulx_friend_requests_updated', handleUpdate);
    window.addEventListener('soulx:user-notifications-updated', handleUpdate);
    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('soulx_friends_updated', handleUpdate);
      window.removeEventListener('soulx_friend_requests_updated', handleUpdate);
      window.removeEventListener('soulx:user-notifications-updated', handleUpdate);
    };
  }, [activeChatId]);

  // 3. Live polling for incoming friend requests count & listeners
  useEffect(() => {
    fetchFriendRequestsCount();
    const friendInterval = setInterval(fetchFriendRequestsCount, 3500);

    const handleCountUpdate = (e: any) => {
      if (typeof e.detail?.count === 'number') {
        setFriendRequestsCount(e.detail.count);
      } else {
        fetchFriendRequestsCount();
      }
    };

    const handleOpenFriends = () => {
      setIsFriendsPageOpen(true);
    };

    window.addEventListener('soulx:open-friends', handleOpenFriends);
    window.addEventListener('soulx_friend_requests_count', handleCountUpdate);
    window.addEventListener('soulx_friend_requests_updated', fetchFriendRequestsCount);
    window.addEventListener('focus', fetchFriendRequestsCount);

    return () => {
      clearInterval(friendInterval);
      window.removeEventListener('soulx:open-friends', handleOpenFriends);
      window.removeEventListener('soulx_friend_requests_count', handleCountUpdate);
      window.removeEventListener('soulx_friend_requests_updated', fetchFriendRequestsCount);
      window.removeEventListener('focus', fetchFriendRequestsCount);
    };
  }, []);

  // 4. Open specific conversation triggered by notifications or toasts
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const openId = localStorage.getItem('soulx_open_conversation_id');
    if (openId) {
      localStorage.removeItem('soulx_open_conversation_id');
      handleOpenChat(openId);
    }
    const handleOpenEvent = (e: any) => {
      const id = e.detail?.conversationId;
      if (id) handleOpenChat(id);
    };
    window.addEventListener('soulx:open-conversation', handleOpenEvent);
    return () => {
      window.removeEventListener('soulx:open-conversation', handleOpenEvent);
    };
  }, [conversations]);

  // Check for incoming matched partner from Text Matching
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const matchChatStr = localStorage.getItem('soulx_new_match_chat');
    if (matchChatStr) {
      try {
        const matchChat: ChatConversation = JSON.parse(matchChatStr);
        setConversations((prev) => {
          const exists = prev.find((c) => c.name === matchChat.name);
          if (exists) return prev;
          return [matchChat, ...prev];
        });
        setActiveChatId(matchChat.id);
        localStorage.removeItem('soulx_new_match_chat');
      } catch {
        // ignore
      }
    }
  }, []);

  // Start chat with a friend from the friends list
  const handleStartChatWithFriend = (friend: Friend) => {
    setIsFriendsPageOpen(false);
    const uid = getCurrentUserId();
    const canonicalConvId = `conv-${[uid, friend.id].sort().join('-')}`;
    let targetChat = conversations.find(
      (c) =>
        c.id === canonicalConvId ||
        c.partnerId === friend.id ||
        c.id === friend.id ||
        c.name === friend.name
    );
    if (!targetChat) {
      targetChat = {
        id: canonicalConvId,
        partnerId: friend.id,
        name: friend.name,
        avatar: friend.avatar,
        status: friend.status,
        lastMessage: isAr ? 'ابدأ محادثتك مع ' + friend.name : 'Start your conversation with ' + friend.name,
        time: isAr ? 'الآن' : 'Just now',
        unreadCount: 0,
        age: friend.age || 24,
        country: friend.country || (friend as any).location,
        messages: [],
      };
      setConversations((prev) => [
        targetChat!,
        ...prev.filter(
          (c) =>
            c.id !== canonicalConvId &&
            c.partnerId !== friend.id &&
            c.name !== friend.name
        ),
      ]);
    }
    setActivePendingChat(targetChat);
    setActiveChatId(targetChat.id);

    // Mark as read in local state & server
    setConversations((prev) =>
      prev.map((c) =>
        c.id === targetChat!.id || (c.partnerId && c.partnerId === targetChat!.id)
          ? { ...c, unreadCount: 0 }
          : c
      )
    );
    const ident = getUserIdentifiers();
    fetch('/api/conversations/mark-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: targetChat.id,
        userId: ident.userId,
      }),
    }).catch(() => {});
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('soulx:chat-read', { detail: { conversationId: targetChat.id } })
      );
    }
  };

  // Open Chat thread & Mark as Read
  const handleOpenChat = (chatId: string) => {
    setActiveChatId(chatId);
    setActivePendingChat(null);

    if (chatId === 'official-notifications') {
      handleMarkNotificationsRead();
      return;
    }

    // 1. Mark as read immediately in local state (clears unread badge on chat card)
    setConversations((prev) =>
      prev.map((c) =>
        c.id === chatId || (c.partnerId && c.partnerId === chatId)
          ? { ...c, unreadCount: 0 }
          : c
      )
    );

    // 2. Persist read state to backend
    const ident = getUserIdentifiers();
    fetch('/api/conversations/mark-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: chatId,
        userId: ident.userId,
      }),
    }).catch(() => {});

    // 3. Dispatch event to clear/decrement unread badge on bottom nav icon and toasts
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('soulx:chat-read', { detail: { conversationId: chatId } })
      );
    }
  };

  const handleBackToChatsList = () => {
    setActiveChatId(null);
    setActivePendingChat(null);
  };

  const handleOpenNotificationCenter = () => {
    setActiveChatId('official-notifications');
    setActivePendingChat(null);
    handleMarkNotificationsRead();
  };

  // Partner age and country for active chat
  const [partnerDetails, setPartnerDetails] = useState<{ age?: number; country?: string }>({});

  useEffect(() => {
    if (!currentChat) {
      setPartnerDetails({});
      return;
    }

    if (currentChat.age || currentChat.country) {
      setPartnerDetails((prev) => ({
        age: currentChat.age ?? prev.age,
        country: currentChat.country ?? prev.country,
      }));
    }

    let pid = currentChat.partnerId;
    const myUid = currentUser?.displayId || currentUser?.id || '';
    if (!pid && currentChat.id) {
      if (currentChat.id.startsWith('conv-')) {
        const rawNoPrefix = currentChat.id.replace('conv-', '');
        if (myUid && rawNoPrefix.startsWith(`${myUid}-`)) {
          pid = rawNoPrefix.slice(myUid.length + 1);
        } else if (myUid && rawNoPrefix.endsWith(`-${myUid}`)) {
          pid = rawNoPrefix.slice(0, -(myUid.length + 1));
        } else {
          const parts = rawNoPrefix.split('-');
          pid = parts.find((p) => p && p !== myUid) || parts[0];
        }
      } else {
        pid = currentChat.id;
      }
    }

    const queryParams = new URLSearchParams();
    if (pid) queryParams.set('id', pid);
    if (currentChat.name) queryParams.set('name', currentChat.name);
    if (myUid) queryParams.set('callerId', myUid);

    fetch(`/api/users/profile?${queryParams.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.user) {
          setPartnerDetails({
            age: data.user.age,
            country: data.user.country,
          });
        }
      })
      .catch(() => {});
  }, [currentChat?.id, currentChat?.partnerId, currentChat?.name, currentUser?.id, currentUser?.displayId]);

  const partnerAge = partnerDetails.age || currentChat?.age || 24;
  const partnerCountry = formatCountryUnified(partnerDetails.country || currentChat?.country, lang);

  // Auto-scroll whenever messages in active chat change
  useEffect(() => {
    if (currentChat?.messages?.length) {
      const timer = setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [currentChat?.messages?.length, activeChatId]);

  // Synchronize top bar back button with active chat conversation or friends view
  useEffect(() => {
    if (isFriendsPageOpen) {
      window.dispatchEvent(
        new CustomEvent('soulx:set-navbar-back', {
          detail: {
            onBack: () => {
              setIsFriendsPageOpen(false);
              loadDatabaseData();
            },
            label: isAr ? 'العودة للمحادثات' : 'Back to Chats',
            title: isAr ? 'قائمة الأصدقاء' : 'Friends List',
          },
        })
      );
    } else if (currentChat) {
      window.dispatchEvent(
        new CustomEvent('soulx:set-navbar-back', {
          detail: {
            onBack: handleBackToChatsList,
            label: isAr ? 'العودة للمحادثات' : 'Back to Chats',
            title: currentChat.name,
          },
        })
      );
    } else {
      window.dispatchEvent(
        new CustomEvent('soulx:set-navbar-back', { detail: null })
      );
    }

    return () => {
      window.dispatchEvent(
        new CustomEvent('soulx:set-navbar-back', { detail: null })
      );
    };
  }, [isFriendsPageOpen, Boolean(currentChat), isAr]);

  // Send message inside active chat with real persistence and no fake reply
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !activeChatId || isSendingMessage) return;

    const messageText = inputMessage.trim();
    setInputMessage('');
    setMessageError(null);
    setIsSendingMessage(true);

    const nowUtc = new Date().toISOString();

    const newMsg: Message = {
      id: `msg-${Date.now()}`,
      sender: 'me',
      text: messageText,
      createdAt: nowUtc,
      time: nowUtc,
    };

    // Optimistically update conversation list & active view
    setConversations((prev) => {
      const exists = prev.some((c) => c.id === activeChatId);
      if (exists) {
        return prev.map((c) => {
          if (c.id === activeChatId) {
            return {
              ...c,
              lastMessage: newMsg.text,
              time: nowUtc,
              createdAt: nowUtc,
              messages: [...c.messages, newMsg],
            };
          }
          return c;
        });
      } else if (currentChat) {
        const updated = {
          ...currentChat,
          lastMessage: newMsg.text,
          time: nowUtc,
          createdAt: nowUtc,
          messages: [...currentChat.messages, newMsg],
        };
        return [updated, ...prev];
      }
      return prev;
    });

    setActivePendingChat((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        lastMessage: newMsg.text,
        time: nowUtc,
        createdAt: nowUtc,
        messages: [...prev.messages, newMsg],
      };
    });

    // Persist real message to database
    const ident = getUserIdentifiers();
    const uid = ident.userId;
    let targetRecipientId = currentChat?.partnerId;
    if (!targetRecipientId || targetRecipientId.startsWith('conv-')) {
      if (activeChatId && activeChatId.startsWith('conv-')) {
        const parts = activeChatId.replace('conv-', '').split('-');
        const other = parts.find((p) => p !== uid && p !== ident.displayId);
        if (other) targetRecipientId = other;
      }
    }
    if (!targetRecipientId && currentChat?.id && !currentChat.id.startsWith('conv-')) {
      targetRecipientId = currentChat.id;
    }

    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: activeChatId,
          recipientId: targetRecipientId,
          senderId: uid,
          clientMessageId: newMsg.id,
          id: newMsg.id,
          senderName: currentUser?.name,
          senderAvatar: myEffectiveAvatar,
          recipientName: currentChat?.name,
          recipientAvatar: currentChat?.avatar,
          text: messageText,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to send message');
      }

      // Notify local and other tabs via BroadcastChannel & Storage Event
      if (typeof BroadcastChannel !== 'undefined') {
        try {
          const bc = new BroadcastChannel('soulx_chat_events');
          bc.postMessage({ type: 'new_message', conversationId: activeChatId, message: newMsg });
          bc.close();
        } catch {}
      }
      if (data.message?.id) {
        const confirmedId = data.message.id;
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id === activeChatId || (data.conversationId && c.id === data.conversationId)) {
              return {
                ...c,
                id: data.conversationId || c.id,
                messages: c.messages.map((m) =>
                  m.id === newMsg.id ? { ...m, id: confirmedId } : m
                ),
              };
            }
            return c;
          })
        );
        setActivePendingChat((prev) =>
          prev
            ? {
                ...prev,
                id: data.conversationId || prev.id,
                messages: prev.messages.map((m) =>
                  m.id === newMsg.id ? { ...m, id: confirmedId } : m
                ),
              }
            : null
        );
      }

      if (data.conversationId && data.conversationId !== activeChatId) {
        setConversations((prev) =>
          prev.map((c) => (c.id === activeChatId ? { ...c, id: data.conversationId } : c))
        );
        setActivePendingChat((prev) => (prev ? { ...prev, id: data.conversationId } : null));
        setActiveChatId(data.conversationId);
      }
    } catch (err: any) {
      setMessageError(isAr ? 'تعذر حفظ الرسالة في قاعدة البيانات. يرجى التحقق من الاتصال.' : 'Failed to save message in database.');
    } finally {
      setIsSendingMessage(false);
    }
  };

  // -----------------------------------------------------------------
  // Media Sharing Handlers (Photos & Audio Voice Notes)
  // -----------------------------------------------------------------
  const handleSendMediaMessage = async (
    mediaType: 'image' | 'audio',
    mediaUrl: string,
    caption?: string,
    duration?: number
  ) => {
    if (!activeChatId || isSendingMessage) return;

    setIsSendingMessage(true);
    setMessageError(null);
    const nowUtc = new Date().toISOString();

    const defaultText =
      caption && caption.trim()
        ? caption.trim()
        : mediaType === 'image'
        ? isAr
          ? '📷 صورة'
          : '📷 Photo'
        : isAr
        ? `🎙️ مقطع صوتي (${formatAudioDuration(duration || 0)})`
        : `🎙️ Voice Note (${formatAudioDuration(duration || 0)})`;

    const newMsg: Message = {
      id: `msg-${Date.now()}`,
      sender: 'me',
      text: defaultText,
      createdAt: nowUtc,
      time: nowUtc,
      mediaType,
      mediaUrl,
      audioDuration: duration,
    };

    // Optimistically update conversation list & active view
    setConversations((prev) => {
      const exists = prev.some((c) => c.id === activeChatId);
      if (exists) {
        return prev.map((c) => {
          if (c.id === activeChatId) {
            return {
              ...c,
              lastMessage: newMsg.text,
              time: nowUtc,
              createdAt: nowUtc,
              messages: [...c.messages, newMsg],
            };
          }
          return c;
        });
      } else if (currentChat) {
        return [
          {
            ...currentChat,
            lastMessage: newMsg.text,
            time: nowUtc,
            createdAt: nowUtc,
            messages: [...currentChat.messages, newMsg],
          },
          ...prev,
        ];
      }
      return prev;
    });

    setActivePendingChat((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        lastMessage: newMsg.text,
        time: nowUtc,
        createdAt: nowUtc,
        messages: [...prev.messages, newMsg],
      };
    });

    // Close preview modal if open
    setPreviewMedia(null);

    // Persist real message to database
    const ident = getUserIdentifiers();
    const uid = ident.userId;
    let targetRecipientId = currentChat?.partnerId;
    if (!targetRecipientId || targetRecipientId.startsWith('conv-')) {
      if (activeChatId && activeChatId.startsWith('conv-')) {
        const parts = activeChatId.replace('conv-', '').split('-');
        const other = parts.find((p) => p !== uid && p !== ident.displayId);
        if (other) targetRecipientId = other;
      }
    }
    if (!targetRecipientId && currentChat?.id && !currentChat.id.startsWith('conv-')) {
      targetRecipientId = currentChat.id;
    }

    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: activeChatId,
          recipientId: targetRecipientId,
          senderId: uid,
          clientMessageId: newMsg.id,
          id: newMsg.id,
          senderName: currentUser?.name,
          senderAvatar: myEffectiveAvatar,
          recipientName: currentChat?.name,
          recipientAvatar: currentChat?.avatar,
          text: defaultText,
          mediaType,
          mediaUrl,
          audioDuration: duration,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to send media message');
      }

      // Notify local and other tabs via BroadcastChannel & Storage Event
      if (typeof BroadcastChannel !== 'undefined') {
        try {
          const bc = new BroadcastChannel('soulx_chat_events');
          bc.postMessage({ type: 'new_message', conversationId: activeChatId, message: newMsg });
          bc.close();
        } catch {}
      }
      if (data.message?.id) {
        const confirmedId = data.message.id;
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id === activeChatId || (data.conversationId && c.id === data.conversationId)) {
              return {
                ...c,
                id: data.conversationId || c.id,
                messages: c.messages.map((m) =>
                  m.id === newMsg.id ? { ...m, id: confirmedId } : m
                ),
              };
            }
            return c;
          })
        );
        setActivePendingChat((prev) =>
          prev
            ? {
                ...prev,
                id: data.conversationId || prev.id,
                messages: prev.messages.map((m) =>
                  m.id === newMsg.id ? { ...m, id: confirmedId } : m
                ),
              }
            : null
        );
      }

      if (data.conversationId && data.conversationId !== activeChatId) {
        setConversations((prev) =>
          prev.map((c) => (c.id === activeChatId ? { ...c, id: data.conversationId } : c))
        );
        setActivePendingChat((prev) => (prev ? { ...prev, id: data.conversationId } : null));
        setActiveChatId(data.conversationId);
      }
    } catch {
      setMessageError(
        isAr
          ? 'تعذر حفظ الوسائط في قاعدة البيانات. يرجى التحقق من الاتصال.'
          : 'Failed to save media in database.'
      );
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleCameraPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressedDataUrl = await compressImageFile(file, 1280, 1280, 0.82);
      setPreviewMedia({
        type: 'image',
        url: compressedDataUrl,
      });
    } catch (err) {
      console.error('Failed to compress camera photo:', err);
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const handleGalleryPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressedDataUrl = await compressImageFile(file, 1280, 1280, 0.82);
      setPreviewMedia({
        type: 'image',
        url: compressedDataUrl,
      });
    } catch (err) {
      console.error('Failed to compress gallery photo:', err);
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const handleAudioFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      const tempAudio = new Audio(dataUrl);
      tempAudio.onloadedmetadata = () => {
        const dur = Math.round(tempAudio.duration || 0);
        setPreviewMedia({
          type: 'audio',
          url: dataUrl,
          duration: dur,
        });
      };
      tempAudio.onerror = () => {
        setPreviewMedia({
          type: 'audio',
          url: dataUrl,
          duration: 0,
        });
      };
    } catch (err) {
      console.error('Failed to read audio file:', err);
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const startVoiceRecording = async () => {
    setIsAttachmentMenuOpen(false);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert(isAr ? 'الميكروفون غير مدعوم في متصفحك' : 'Microphone not supported in browser');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.start(100);
      setIsRecordingVoice(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Error starting voice recording:', err);
      alert(
        isAr
          ? 'تعذر الوصول إلى الميكروفون. يرجى السماح بإذن الوصول للصوت في المتصفح.'
          : 'Unable to access microphone. Please grant audio permission in browser.'
      );
    }
  };

  const stopVoiceRecording = async (sendImmediately = true) => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    const duration = recordingSeconds;
    setIsRecordingVoice(false);

    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;

    recorder.onstop = async () => {
      if (recordingStreamRef.current) {
        recordingStreamRef.current.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
      }

      const audioBlob = new Blob(audioChunksRef.current, {
        type: recorder.mimeType || 'audio/webm',
      });

      if (audioBlob.size === 0) return;

      const dataUrl = await fileToDataUrl(audioBlob);

      if (sendImmediately && duration >= 1) {
        await handleSendMediaMessage('audio', dataUrl, '', duration);
      } else {
        setPreviewMedia({
          type: 'audio',
          url: dataUrl,
          duration,
        });
      }
    };

    recorder.stop();
  };

  const cancelVoiceRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recordingStreamRef.current) {
      recordingStreamRef.current.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
    }
    audioChunksRef.current = [];
    setIsRecordingVoice(false);
    setRecordingSeconds(0);
  };

  // إرسال هدية في الشات (خصم كوينز للمرسل وإيداع ماسات للمستلم)
  const handleSendGift = async (gift: GiftItem) => {
    if (!currentChat) return;

    if (coinsBalance < gift.cost) {
      showToast(
        isAr
          ? `رصيد الكوينز غير كافٍ! تحتاج إلى ${gift.cost.toLocaleString()} كوينز 🪙`
          : `Insufficient coins! Need ${gift.cost.toLocaleString()} coins 🪙`
      );
      return;
    }

    const uid = getCurrentUserId();
    if (onDeductCoins) {
      onDeductCoins(gift.cost);
    }

    // خصم فوري متزامن للكوينز
    const newCoins = Math.max(0, coinsBalance - gift.cost);
    window.dispatchEvent(
      new CustomEvent('soulx:balance-updated', {
        detail: { userId: uid, balance: newCoins, currency: 'coins' },
      })
    );

    const giftText = `${gift.icon} ${isAr ? gift.nameAr : gift.nameEn}`;

    const nowUtc = new Date().toISOString();
    const tempGiftId = `gift-${Date.now()}`;

    const giftMsg: Message = {
      id: tempGiftId,
      clientMessageId: tempGiftId,
      sender: 'me',
      text: giftText,
      isGift: true,
      giftIcon: gift.icon,
      giftName: isAr ? gift.nameAr : gift.nameEn,
      giftCost: gift.cost,
      createdAt: nowUtc,
      time: nowUtc,
    };

    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === activeChatId) {
          const isDup = c.messages.some(
            (m) =>
              m.id === tempGiftId ||
              (m.sender === 'me' &&
               m.text === giftText &&
               Math.abs(new Date(m.createdAt || m.time || 0).getTime() - new Date(nowUtc).getTime()) < 10000)
          );
          if (isDup) return c;
          return {
            ...c,
            lastMessage: giftText,
            time: nowUtc,
            createdAt: nowUtc,
            messages: [...c.messages, giftMsg],
          };
        }
        return c;
      })
    );

    showToast(isAr ? `تم إرسال ${gift.nameAr} بنجاح! 🪙` : `Sent ${gift.nameEn} successfully! 🪙`);

    const targetRecipientId = currentChat.partnerId || currentChat.id;
    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: activeChatId,
          senderId: uid,
          clientMessageId: tempGiftId,
          id: tempGiftId,
          senderName: currentUser?.name,
          senderAvatar: myEffectiveAvatar,
          recipientId: targetRecipientId,
          recipientName: currentChat.name,
          recipientAvatar: currentChat.avatar,
          text: giftText,
          isGift: true,
          giftCost: gift.cost,
          giftName: isAr ? gift.nameAr : gift.nameEn,
          giftIcon: gift.icon,
        }),
      });
      const data = await res.json();
      if (data.message?.id) {
        const confirmedId = data.message.id;
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id === activeChatId) {
              return {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === tempGiftId ? { ...m, id: confirmedId } : m
                ),
              };
            }
            return c;
          })
        );
      }
      if (data.success && typeof data.senderCoins === 'number') {
        window.dispatchEvent(
          new CustomEvent('soulx:balance-updated', {
            detail: { userId: uid, balance: data.senderCoins, currency: 'coins' },
          })
        );
      } else if (!data.success) {
        showToast(isAr ? (data.message || 'فشل إرسال الهدية') : (data.message || 'Failed to send gift'));
        // استرجاع الرصيد في حالة الفشل
        window.dispatchEvent(
          new CustomEvent('soulx:balance-updated', {
            detail: { userId: uid, balance: coinsBalance, currency: 'coins' },
          })
        );
      }
    } catch (err) {
      console.warn('Failed to send gift in chat:', err);
    }
  };

  // Filtered conversations by search and ALWAYS sorted newest message first
  const filteredConversations = conversations
    .filter(
      (c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      const timeA = new Date(a.time || a.createdAt || 0).getTime();
      const timeB = new Date(b.time || b.createdAt || 0).getTime();
      return timeB - timeA;
    });

  // هل تطابق دردشة مركز الإشعارات المثبتة عبارة البحث الحالية؟
  const isNotificationCenterMatch = (() => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    if (
      'مركز الإشعارات'.includes(q) ||
      'إشعار'.includes(q) ||
      'إشعارات'.includes(q) ||
      'إذاعة'.includes(q) ||
      'إدارة'.includes(q) ||
      'notification'.includes(q) ||
      'broadcast'.includes(q) ||
      'شحن'.includes(q) ||
      'صداقة'.includes(q) ||
      'وكيل'.includes(q)
    ) {
      return true;
    }
    return userNotifications.some(
      (n) =>
        n.titleAr?.toLowerCase().includes(q) ||
        n.messageAr?.toLowerCase().includes(q) ||
        n.titleEn?.toLowerCase().includes(q) ||
        n.messageEn?.toLowerCase().includes(q) ||
        (n.metadata?.friendName && n.metadata.friendName.toLowerCase().includes(q)) ||
        (n.metadata?.agentName && n.metadata.agentName.toLowerCase().includes(q))
    );
  })();


  const latestNotificationTime = userNotifications.length > 0 ? userNotifications[0].timestamp : undefined;

  if (isFriendsPageOpen) {
    return (
      <FriendsView
        lang={lang}
        onBack={() => {
          setIsFriendsPageOpen(false);
          loadDatabaseData();
        }}
        onStartChat={(friend) => {
          setIsFriendsPageOpen(false);
          handleStartChatWithFriend({
            id: friend.id,
            name: friend.name,
            avatar: friend.avatar,
            status: friend.status,
            bio: friend.bio || '',
            age: friend.age,
            country: friend.country || (friend as any).location,
          });
        }}
        currentUserId={getCurrentUserId()}
      />
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto flex-1 flex flex-col min-w-0 max-w-full overflow-x-hidden h-full">
      {/* ========================================================
          SCREEN C: NOTIFICATION CENTER ACTIVE VIEW (READ ONLY - لا يمكن مراسلتها)
         ======================================================== */}
      {activeChatId === 'official-notifications' ? (
        <div className="flex-1 flex flex-col w-full max-w-full min-w-0 h-[calc(100vh-4rem)] h-[calc(100dvh-4rem)] relative overflow-hidden">
          {/* Partner Info Header Bar */}
          <div className="shrink-0 z-20 w-full backdrop-blur-md bg-white/90 dark:bg-neutral-950/90 border-b border-neutral-200/80 dark:border-neutral-800/80 px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between min-w-0 transition-colors">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              {/* Back to Chat List Button */}
              <button
                type="button"
                onClick={handleBackToChatsList}
                className="p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer shrink-0"
                title={isAr ? 'العودة للمحادثات' : 'Back to chats'}
              >
                {isAr ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
              </button>

              {/* Official Notification Center Emblem */}
              <div className="relative shrink-0">
                <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-gradient-to-tr from-cyan-600 via-cyan-500 to-sky-400 text-white flex items-center justify-center font-bold shadow-sm ring-2 ring-cyan-400/30">
                  <Bell className="w-4.5 h-4.5 sm:w-5.5 sm:h-5.5 stroke-[2.3] text-white" />
                </div>
                <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-neutral-950 absolute bottom-0 right-0 flex items-center justify-center text-[7px] text-white font-bold" title={isAr ? 'قناة موثقة' : 'Verified Channel'}>
                  ✓
                </span>
              </div>

              {/* Contact Name & Status */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="text-xs sm:text-sm md:text-base font-black text-neutral-900 dark:text-white leading-tight truncate">
                    {isAr ? 'مركز الإشعارات' : 'Notification Center'}
                  </h3>
                  <span className="px-1.5 py-0.2 rounded-md bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 text-[10px] font-bold border border-cyan-500/25 shrink-0">
                    {isAr ? 'رسمي' : 'Official'}
                  </span>
                </div>
                <div className="text-[10px] sm:text-xs text-neutral-500 dark:text-neutral-400 font-medium truncate">
                  {isAr ? 'قناة إشعارات رسمية موثقة • غير قابلة للرد' : 'Official Verified Channel • Read-only'}
                </div>
              </div>
            </div>

            {/* Read-only Lock Indicator */}
            <div className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-700 dark:text-cyan-400 text-[10px] sm:text-xs font-bold shrink-0">
              <Lock className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
              <span className="hidden sm:inline">{isAr ? 'للقراءة فقط' : 'Read-only'}</span>
            </div>
          </div>

          {/* Messages Feed Area: Official Notifications */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 sm:px-6 py-3 sm:py-4 space-y-3.5 w-full max-w-full">
            {/* Notifications Feed */}
            {userNotifications.length === 0 ? (
              <div className="py-20 text-center space-y-3">
                <div className="w-14 h-14 rounded-3xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-500 flex items-center justify-center mx-auto shadow-sm">
                  <Bell className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
                  {isAr ? 'لا توجد إشعارات حتى الآن' : 'No notifications yet'}
                </h4>
                <p className="text-xs text-neutral-400 max-w-xs mx-auto leading-relaxed">
                  {isAr
                    ? 'عند قبول طلب صداقتك أو شحن حسابك أو تقديم طلب سحب، ستصلك الإشعارات هنا فوراً.'
                    : 'When someone accepts your friend request, an agent tops up your coins, or a cashout is requested, notifications will arrive here.'}
                </p>
              </div>
            ) : (
              userNotifications.map((notif) => {
                const isFriendAccepted = notif.type === 'friend_request_accepted';
                const isWithdrawal = notif.type === 'withdrawal_request';
                const isAdminBroadcast = notif.type === 'admin_broadcast';
                const isAdminMessage = notif.type === 'admin_message';

                const borderStyle = isAdminBroadcast
                  ? 'bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-transparent dark:from-violet-950/30 dark:via-purple-950/15 dark:to-transparent border-violet-500/40 ring-1 ring-violet-500/30'
                  : isAdminMessage
                  ? 'bg-gradient-to-br from-cyan-500/10 via-blue-500/5 to-transparent dark:from-cyan-950/30 dark:via-blue-950/15 dark:to-transparent border-cyan-500/40 ring-1 ring-cyan-500/30'
                  : isFriendAccepted
                  ? 'bg-white dark:bg-neutral-900 border-emerald-500/30 ring-1 ring-emerald-500/20'
                  : isWithdrawal
                  ? 'bg-white dark:bg-neutral-900 border-cyan-500/30 ring-1 ring-cyan-500/20'
                  : 'bg-white dark:bg-neutral-900 border-cyan-500/30 ring-1 ring-cyan-500/20';

                const iconStyle = isAdminBroadcast
                  ? 'bg-violet-500/20 text-violet-600 dark:text-violet-400'
                  : isAdminMessage
                  ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400'
                  : isFriendAccepted
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  : isWithdrawal
                  ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400'
                  : 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400';

                return (
                  <div
                    key={notif.id}
                    className={`p-4 sm:p-5 rounded-2xl border shadow-xs space-y-3 transition-all ${borderStyle}`}
                  >
                    {/* Notification Card Header */}
                    <div className="flex items-center justify-between gap-2 border-b border-neutral-100 dark:border-neutral-800 pb-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs shrink-0 ${iconStyle}`}>
                          {isAdminBroadcast ? (
                            <Megaphone className="w-4 h-4" />
                          ) : isAdminMessage ? (
                            <ShieldCheck className="w-4 h-4" />
                          ) : isFriendAccepted ? (
                            <UserCheck className="w-4 h-4" />
                          ) : isWithdrawal ? (
                            <ArrowDownToLine className="w-4 h-4" />
                          ) : (
                            <CoinIcon className="w-4 h-4" />
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-xs sm:text-sm text-neutral-900 dark:text-white">
                            {isAr ? notif.titleAr : notif.titleEn}
                          </span>
                          {isAdminBroadcast && (
                            <span className="px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-700 dark:text-violet-300 text-[10px] font-bold">
                              {isAr ? '📢 إذاعة عامة' : '📢 Broadcast'}
                            </span>
                          )}
                          {isAdminMessage && (
                            <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 text-[10px] font-bold">
                              {isAr ? '🛡️ رسالة إدارية' : '🛡️ Admin Message'}
                            </span>
                          )}
                          {notif.metadata?.priority === 'urgent' && (
                            <span className="px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-700 dark:text-red-400 text-[10px] font-extrabold animate-pulse">
                              {isAr ? 'عاجل' : 'Urgent'}
                            </span>
                          )}
                          {notif.metadata?.priority === 'important' && (
                            <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400 text-[10px] font-bold">
                              {isAr ? 'هام' : 'Important'}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] sm:text-[11px] font-mono text-neutral-400 shrink-0" dir="ltr">
                        {formatRelativeChatTime(notif.timestamp, lang)}
                      </span>
                    </div>

                    {/* Notification Card Content */}
                    {isAdminBroadcast ? (
                      /* 4. إذاعة عامة من إدارة Soul-X */
                      <div className="p-3.5 rounded-xl bg-violet-500/5 dark:bg-violet-950/20 border border-violet-500/20 space-y-2.5">
                        <div className="text-xs sm:text-sm text-neutral-800 dark:text-neutral-200 leading-relaxed whitespace-pre-line font-medium">
                          {isAr ? notif.messageAr : notif.messageEn}
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-violet-500/10 text-[11px] text-neutral-500 dark:text-neutral-400">
                          <span className="flex items-center gap-1 font-semibold text-violet-600 dark:text-violet-400">
                            <Sparkles className="w-3 h-3" />
                            {isAr ? 'صادر عن إدارة Soul-X الرسمية' : 'Soul-X Administration'}
                          </span>
                          <span>{isAr ? 'موجه للجميع' : 'To all users'}</span>
                        </div>
                      </div>
                    ) : isAdminMessage ? (
                      /* 5. رسالة إدارية خاصة لمستخدم معين */
                      <div className="p-3.5 rounded-xl bg-cyan-500/5 dark:bg-cyan-950/20 border border-cyan-500/20 space-y-2.5">
                        <div className="text-xs sm:text-sm text-neutral-800 dark:text-neutral-200 leading-relaxed whitespace-pre-line font-medium">
                          {isAr ? notif.messageAr : notif.messageEn}
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-cyan-500/10 text-[11px] text-neutral-500 dark:text-neutral-400">
                          <span className="flex items-center gap-1 font-semibold text-cyan-600 dark:text-cyan-400">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            {isAr ? 'رسالة إدارية خاصة بحسابك' : 'Official message for your account'}
                          </span>
                          <span>{isAr ? 'إدارة Soul-X' : 'Soul-X Admin'}</span>
                        </div>
                      </div>
                    ) : isFriendAccepted ? (
                      /* 1. قبول طلب صداقة: تم قبول طلب الصداقة الذي أرسلته الى: اسم المستخدم */
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3">
                          <img
                            src={
                              notif.metadata?.friendAvatar ||
                              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'
                            }
                            alt={notif.metadata?.friendName || 'صديق'}
                            className="w-11 h-11 rounded-full object-cover border border-emerald-500/30 shrink-0"
                          />
                          <div>
                            <h5 className="font-bold text-xs sm:text-sm text-neutral-900 dark:text-white">
                              {notif.metadata?.friendName || 'مستخدم Soul-X'}
                            </h5>
                            <span className="text-[10px] font-mono text-neutral-500 dark:text-neutral-400 block">
                              ID: {notif.metadata?.friendDisplayId || notif.metadata?.friendId || '—'}
                            </span>
                            <p className="text-xs text-neutral-700 dark:text-neutral-300 mt-1 leading-relaxed font-medium">
                              {isAr ? notif.messageAr : notif.messageEn}
                            </p>
                          </div>
                        </div>

                        {/* Direct Action to start chat with that friend */}
                        {notif.metadata?.friendId && (
                          <button
                            type="button"
                            onClick={() => {
                              handleStartChatWithFriend({
                                id: notif.metadata!.friendId!,
                                name: notif.metadata?.friendName || 'صديق',
                                avatar: notif.metadata?.friendAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
                                status: 'online',
                                bio: '',
                              });
                            }}
                            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer shadow-xs transition-all active:scale-95 flex items-center gap-1.5 shrink-0"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>{isAr ? 'بدء محادثة' : 'Start Chat'}</span>
                          </button>
                        )}
                      </div>
                    ) : isWithdrawal ? (
                      /* 3. بعد طلب السحب:
                         عملية سحب جديدة بالمعرف: معرف عملية السحب
                         القيمة المسحوبة:  coins
                         عبر الوكيل: معرف وكالة الشحن المسحوب اليها */
                      <div className="p-3.5 rounded-xl bg-cyan-500/10 dark:bg-cyan-950/20 border border-cyan-500/20">
                        <div className="text-xs sm:text-sm text-neutral-800 dark:text-neutral-200 leading-relaxed font-mono whitespace-pre-line font-medium space-y-1">
                          {isAr ? notif.messageAr : notif.messageEn}
                        </div>
                      </div>
                    ) : (
                      /* 2. نجاح ايداع:
                          تمت إعادة تعبئة حسابك بقيمة: المبلغ Coins عبر الوكيل.
                          فقط دون ذكر اي تفاصيل أكثر */
                      <div className="p-3.5 rounded-xl bg-amber-500/10 dark:bg-amber-950/20 border border-amber-500/20">
                        <p className="text-xs sm:text-sm text-neutral-800 dark:text-neutral-200 leading-relaxed font-semibold">
                          {isAr ? notif.messageAr : notif.messageEn}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div ref={notificationsEndRef} className="h-px w-full" />
          </div>

          {/* Locked Message Input Bar (لا يمكن مراسلتها) */}
          <div className="shrink-0 z-40 w-full max-w-full min-w-0 bg-white/95 dark:bg-neutral-950/95 backdrop-blur-md border-t border-neutral-200 dark:border-neutral-800 px-3 sm:px-4 py-3 flex items-center justify-center gap-2 text-[11px] sm:text-xs font-bold text-neutral-500 dark:text-neutral-400 shadow-xs text-center safe-area-pb">
            <Lock className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="break-words [overflow-wrap:anywhere]">
              {isAr
                ? 'هذه محادثة رسمية مخصصة للإشعارات فقط ولا يمكن إرسال رسائل بها'
                : 'Official notification-only channel. Sending messages is disabled.'}
            </span>
          </div>
        </div>
      ) : currentChat ? (
        <div className="flex-1 flex flex-col w-full max-w-full min-w-0 h-[calc(100vh-4rem)] h-[calc(100dvh-4rem)] relative overflow-hidden">
          {/* Partner Info Header Bar */}
          <div className="shrink-0 z-20 w-full backdrop-blur-md bg-white/90 dark:bg-neutral-950/90 border-b border-neutral-200/80 dark:border-neutral-800/80 px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between min-w-0 transition-colors">
            <div className="flex items-center gap-2 sm:gap-3.5 min-w-0 flex-1">
              {/* Back to Chat List Button */}
              <button
                type="button"
                onClick={handleBackToChatsList}
                className="p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer shrink-0"
                title={isAr ? 'العودة للمحادثات' : 'Back to chats'}
              >
                {isAr ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
              </button>

              {/* Contact Avatar & Online Status */}
              <div className="relative shrink-0">
                <img
                  src={currentChat.avatar}
                  alt={currentChat.name}
                  className="w-9 h-9 sm:w-11 sm:h-11 rounded-full object-cover border border-neutral-200 dark:border-neutral-700"
                />
                {currentChat.status === 'online' && (
                  <span className="w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-neutral-950 absolute bottom-0 right-0" />
                )}
              </div>

              {/* Contact Name & Status */}
              <div className="min-w-0 flex-1">
                <h3 className="text-xs sm:text-sm md:text-base font-bold text-neutral-900 dark:text-white leading-tight truncate">
                  {currentChat.name}
                </h3>
                <div className="text-[10px] sm:text-xs text-emerald-600 dark:text-emerald-400 font-medium truncate">
                  {isTyping
                    ? isAr
                      ? 'يكتب الآن...'
                      : 'typing...'
                    : currentChat.status === 'online'
                    ? isAr
                      ? 'متصل الآن'
                      : 'online'
                    : isAr
                    ? 'آخر ظهور اليوم'
                    : 'last seen today'}
                </div>
              </div>
            </div>
          </div>

          {/* Messages Feed Area */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 sm:px-6 py-3 sm:py-4 space-y-3 w-full max-w-full">
            {/* Age & Country card */}
            <div className="flex justify-center my-1.5 w-full max-w-full px-2">
              <div className="w-full max-w-sm px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs flex items-center justify-around gap-2 sm:gap-4 text-center min-w-0">
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] sm:text-[11px] font-medium text-neutral-500 dark:text-neutral-400 truncate">
                    {isAr ? 'العمر' : 'Age'}
                  </div>
                  <div className="text-xs sm:text-sm md:text-base font-black text-neutral-900 dark:text-white mt-0.5 truncate">
                    {partnerAge} {isAr ? 'سنة' : 'years'}
                  </div>
                </div>
                <div className="w-px h-7 bg-neutral-200 dark:bg-neutral-800 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] sm:text-[11px] font-medium text-neutral-500 dark:text-neutral-400 truncate">
                    {isAr ? 'الدولة' : 'Country'}
                  </div>
                  <div className="text-xs sm:text-sm md:text-base font-black text-neutral-900 dark:text-white mt-0.5 truncate">
                    {partnerCountry}
                  </div>
                </div>
              </div>
            </div>

            {/* Encryption Notice */}
            <div className="flex justify-center my-1.5 w-full max-w-full px-2">
              <div className="max-w-full px-3 py-1.5 rounded-2xl bg-neutral-200/60 dark:bg-neutral-900 border border-neutral-300/40 dark:border-neutral-800 text-[10px] sm:text-[11px] text-neutral-600 dark:text-neutral-400 font-medium flex items-center justify-center gap-1.5 shadow-2xs text-center flex-wrap break-words">
                <span className="shrink-0">🔒</span>
                <span className="break-words [overflow-wrap:anywhere]">
                  {isAr
                    ? 'الرسائل والمكالمات مشفرة تماماً بين الطرفين في Soul-X'
                    : 'Messages are end-to-end encrypted in Soul-X'}
                </span>
              </div>
            </div>

            {(() => {
              const dedupedMessages: Message[] = [];
              for (const m of currentChat.messages || []) {
                if (!m) continue;
                const mTime = new Date(m.createdAt || m.time || 0).getTime();
                const isDupe = dedupedMessages.some((existing) => {
                  if (existing.id === m.id) return true;
                  if (m.clientMessageId && existing.clientMessageId === m.clientMessageId) return true;
                  if (m.clientMessageId && existing.id === m.clientMessageId) return true;
                  if (existing.clientMessageId && existing.clientMessageId === m.id) return true;
                  const exTime = new Date(existing.createdAt || existing.time || 0).getTime();
                  return existing.sender === m.sender && existing.text === m.text && Math.abs(exTime - mTime) < 3500;
                });
                if (!isDupe) {
                  dedupedMessages.push(m);
                }
              }
              return dedupedMessages.map((msg) => {
                const isMe = msg.sender === 'me';
                return (
                  <div
                    key={msg.id}
                    className={`flex items-end gap-1.5 sm:gap-2 w-full max-w-full min-w-0 ${isMe ? 'justify-end' : 'justify-start'}`}
                  >
                  {!isMe && (
                    <img
                      src={currentChat.avatar}
                      alt={currentChat.name}
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border border-neutral-200 dark:border-neutral-800 shrink-0 mb-1 shadow-xs"
                    />
                  )}
                  <div
                    className={`max-w-[calc(100%-2.5rem)] sm:max-w-[75%] md:max-w-[65%] px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-xs relative min-w-0 break-words [overflow-wrap:anywhere] [word-break:break-word] ${
                      isMe
                        ? 'bg-emerald-600 text-white rounded-br-xs'
                        : 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 rounded-bl-xs border border-neutral-200 dark:border-neutral-800'
                    }`}
                  >
                    {/* 1. Image message */}
                    {(msg.mediaType === 'image' || (msg.mediaUrl && !msg.mediaUrl.startsWith('data:audio') && !msg.mediaUrl.endsWith('.mp3'))) && msg.mediaUrl ? (
                      <div className="space-y-1.5 max-w-full">
                        <div
                          className="relative rounded-xl overflow-hidden cursor-pointer group bg-black/5 dark:bg-black/20"
                          onClick={() => setLightboxImage({ url: msg.mediaUrl!, caption: msg.text !== '📷 صورة' && msg.text !== '📷 Photo' ? msg.text : undefined })}
                        >
                          <img
                            src={msg.mediaUrl}
                            alt="Shared photo"
                            className="w-full max-h-64 sm:max-h-80 object-cover rounded-xl transition-transform group-hover:scale-102"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <span className="p-2 rounded-full bg-black/60 text-white backdrop-blur-xs">
                              <Maximize2 className="w-4 h-4" />
                            </span>
                          </div>
                        </div>
                        {msg.text && msg.text !== '📷 صورة' && msg.text !== '📷 Photo' && (
                          <div className="break-words [overflow-wrap:anywhere] whitespace-pre-wrap leading-relaxed pt-0.5">
                            {msg.text}
                          </div>
                        )}
                      </div>
                    ) : (msg.mediaType === 'audio' || (msg.mediaUrl && (msg.mediaUrl.startsWith('data:audio') || msg.mediaUrl.endsWith('.mp3') || msg.mediaUrl.endsWith('.wav') || msg.mediaUrl.endsWith('.m4a') || msg.mediaUrl.endsWith('.webm') || msg.mediaUrl.endsWith('.ogg')))) && msg.mediaUrl ? (
                      /* 2. Audio message */
                      <div className="space-y-1 max-w-full">
                        <AudioMessagePlayer
                          src={msg.mediaUrl}
                          duration={msg.audioDuration}
                          isMe={isMe}
                        />
                        {msg.text && !msg.text.startsWith('🎙️') && (
                          <div className="text-[11px] break-words [overflow-wrap:anywhere] pt-0.5 opacity-90">
                            {msg.text}
                          </div>
                        )}
                      </div>
                    ) : (getGiftDisplayInfo(msg.text, isAr) || msg.text.includes('🎁')) ? (
                      /* 3. Gift message: only gift icon/shape and name, with zero extra details */
                      (() => {
                        const giftInfo = getGiftDisplayInfo(msg.text, isAr) || {
                          icon: '🎁',
                          name: msg.text.replace(/^[🎁\s]+/, '').trim() || (isAr ? 'هدية' : 'Gift'),
                        };
                        return (
                          <div className="flex items-center gap-2.5 py-1 px-1 min-w-0">
                            <span className="text-2xl sm:text-3xl shrink-0 drop-shadow-xs select-none">
                              {giftInfo.icon}
                            </span>
                            <span className="font-black text-sm sm:text-base text-amber-300 dark:text-amber-400 truncate">
                              {giftInfo.name}
                            </span>
                          </div>
                        );
                      })()
                    ) : (
                      /* 4. Text message */
                      <div className="break-words [overflow-wrap:anywhere] whitespace-pre-wrap leading-relaxed">
                        {msg.text}
                      </div>
                    )}
                    <div
                      className={`flex items-center gap-1 text-[10px] justify-end mt-1 font-mono shrink-0 ${
                        isMe ? 'text-emerald-100' : 'text-neutral-400'
                      }`}
                    >
                      <span title={formatLocalDateTime(msg.createdAt || msg.time, lang)}>
                        {formatLocalTime(msg.createdAt || msg.time, lang)}
                      </span>
                      {isMe && <CheckCheck className="w-3.5 h-3.5 text-cyan-200 shrink-0" />}
                    </div>
                  </div>
                  {isMe && (
                    <img
                      src={myEffectiveAvatar}
                      alt="أنا"
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border border-emerald-400/50 shrink-0 mb-1 shadow-xs"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = getDefaultAvatar(currentUser?.gender);
                      }}
                    />
                  )}
                </div>
              );
            });
          })()}

            {isTyping && (
              <div className="flex items-center gap-1.5 p-2 bg-white dark:bg-neutral-900 rounded-2xl w-fit text-xs text-neutral-400 border border-neutral-200 dark:border-neutral-800 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce" />
                <span className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce [animation-delay:0.2s]" />
                <span className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce [animation-delay:0.4s]" />
              </div>
            )}

            {/* Auto-scroll target */}
            <div ref={messagesEndRef} className="h-px w-full" />
          </div>

          {/* Message Input Bar */}
          <form
            onSubmit={handleSendMessage}
            className="shrink-0 z-40 w-full max-w-full min-w-0 bg-white/95 dark:bg-neutral-950/95 backdrop-blur-md border-t border-neutral-200 dark:border-neutral-800 px-3 sm:px-6 py-2.5 sm:py-3 flex items-center gap-2 transition-colors safe-area-pb shadow-lg relative"
          >
            {isRecordingVoice ? (
              <div className="flex-1 flex items-center justify-between gap-3 bg-neutral-100 dark:bg-neutral-900 rounded-full px-4 h-11 border border-rose-500/40 shadow-inner">
                {/* Blinking red mic dot and timer */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                  <span className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400">
                    {formatAudioDuration(recordingSeconds)}
                  </span>
                </div>

                <div className="text-xs text-neutral-500 font-medium truncate flex-1 text-center">
                  {isAr ? 'جاري التسجيل الصوتي...' : 'Recording audio...'}
                </div>

                {/* Cancel (Trash) Button */}
                <button
                  type="button"
                  onClick={cancelVoiceRecording}
                  className="p-2 rounded-full text-neutral-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
                  title={isAr ? 'إلغاء التسجيل' : 'Cancel'}
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                {/* Stop & Send Button */}
                <button
                  type="button"
                  onClick={() => stopVoiceRecording(true)}
                  className="px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95 transition-all shrink-0"
                  title={isAr ? 'إرسال التسجيل' : 'Send'}
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isAr ? 'إرسال' : 'Send'}</span>
                </button>
              </div>
            ) : (
              <>
                {/* 1. The '+' Media Menu Trigger Button */}
                <div className="relative shrink-0" ref={attachmentMenuRef}>
                  <button
                    type="button"
                    onClick={() => setIsAttachmentMenuOpen(!isAttachmentMenuOpen)}
                    className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95 ${
                      isAttachmentMenuOpen
                        ? 'bg-cyan-500 text-neutral-950 rotate-45 shadow-cyan-500/25'
                        : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300 hover:text-cyan-500 hover:bg-neutral-200 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-800'
                    }`}
                    title={isAr ? 'مشاركة وسائط (صورة، صوت، تسجيل، كاميرا)' : 'Share media'}
                  >
                    <Plus className="w-5 h-5 transition-transform stroke-[2.5]" />
                  </button>

                  {/* Popup Attachment Menu */}
                  {isAttachmentMenuOpen && (
                    <div
                      className="absolute bottom-13 start-0 z-50 w-72 sm:w-80 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl border border-neutral-200 dark:border-neutral-800 rounded-3xl p-3 shadow-2xl animate-in zoom-in-95 fade-in duration-150 space-y-2 select-none"
                      dir={isAr ? 'rtl' : 'ltr'}
                    >
                      <div className="px-2 pt-1 pb-1 border-b border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between">
                        <span className="text-xs font-black text-neutral-800 dark:text-neutral-200">
                          {isAr ? 'مشاركة وسائط' : 'Share Media'}
                        </span>
                        <span className="text-[10px] text-neutral-400">
                          {isAr ? 'صور وتسجيلات صوتية' : 'Photos & Audio'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        {/* Option 1: تصوير مباشر (Live Camera Capture) */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsAttachmentMenuOpen(false);
                            if (/Mobi|Android|iPhone/i.test(navigator.userAgent) && cameraInputRef.current) {
                              cameraInputRef.current.click();
                            } else {
                              setIsCameraModalOpen(true);
                            }
                          }}
                          className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950/70 hover:bg-cyan-500/10 border border-neutral-200/80 dark:border-neutral-800 hover:border-cyan-500/30 text-start transition-all cursor-pointer group flex flex-col gap-2"
                        >
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                            <Camera className="w-4.5 h-4.5" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-neutral-900 dark:text-white group-hover:text-cyan-500 transition-colors">
                              {isAr ? 'تصوير مباشر' : 'Camera Capture'}
                            </div>
                            <div className="text-[10px] text-neutral-400 leading-tight">
                              {isAr ? 'التقاط بالكاميرا فوراً' : 'Instant snapshot'}
                            </div>
                          </div>
                        </button>

                        {/* Option 2: رفع صورة من الهاتف (Upload photo from phone) */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsAttachmentMenuOpen(false);
                            galleryInputRef.current?.click();
                          }}
                          className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950/70 hover:bg-cyan-500/10 border border-neutral-200/80 dark:border-neutral-800 hover:border-cyan-500/30 text-start transition-all cursor-pointer group flex flex-col gap-2"
                        >
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                            <ImageIcon className="w-4.5 h-4.5" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-neutral-900 dark:text-white group-hover:text-cyan-500 transition-colors">
                              {isAr ? 'رفع من الهاتف' : 'Upload Photo'}
                            </div>
                            <div className="text-[10px] text-neutral-400 leading-tight">
                              {isAr ? 'صورة من المعرض' : 'From phone files'}
                            </div>
                          </div>
                        </button>

                        {/* Option 3: تسجيل مقطع صوتي (Record Voice Note) */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsAttachmentMenuOpen(false);
                            startVoiceRecording();
                          }}
                          className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950/70 hover:bg-rose-500/10 border border-neutral-200/80 dark:border-neutral-800 hover:border-rose-500/30 text-start transition-all cursor-pointer group flex flex-col gap-2"
                        >
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                            <Mic className="w-4.5 h-4.5" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-neutral-900 dark:text-white group-hover:text-rose-500 transition-colors">
                              {isAr ? 'تسجيل مقطع صوتي' : 'Record Audio'}
                            </div>
                            <div className="text-[10px] text-neutral-400 leading-tight">
                              {isAr ? 'تسجيل بالمايك فوراً' : 'Live mic recording'}
                            </div>
                          </div>
                        </button>

                        {/* Option 4: رفع مقطع صوتي من الهاتف (Upload audio file) */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsAttachmentMenuOpen(false);
                            audioFileInputRef.current?.click();
                          }}
                          className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950/70 hover:bg-amber-500/10 border border-neutral-200/80 dark:border-neutral-800 hover:border-amber-500/30 text-start transition-all cursor-pointer group flex flex-col gap-2"
                        >
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                            <Music className="w-4.5 h-4.5" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-neutral-900 dark:text-white group-hover:text-amber-500 transition-colors">
                              {isAr ? 'رفع مقطع صوتي' : 'Upload Audio'}
                            </div>
                            <div className="text-[10px] text-neutral-400 leading-tight">
                              {isAr ? 'ملف صوتي من الهاتف' : 'Audio file from phone'}
                            </div>
                          </div>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Gift Button */}
                <button
                  type="button"
                  onClick={() => setIsGiftModalOpen(true)}
                  className="p-2 sm:px-3 sm:py-2 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/30 flex items-center gap-1 font-bold text-xs shrink-0 cursor-pointer active:scale-95 transition-all shadow-xs"
                  title={isAr ? 'إرسال هدية' : 'Send Gift'}
                >
                  <Gift className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-amber-500 shrink-0" />
                  <span className="hidden sm:inline">{isAr ? 'هدية' : 'Gift'}</span>
                </button>

                {/* 3. Text Input */}
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder={isAr ? 'اكتب رسالة...' : 'Type a message...'}
                  className="flex-1 min-w-0 h-10 sm:h-11 px-3.5 sm:px-4 text-xs sm:text-sm rounded-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 focus:border-cyan-500 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none transition-colors shadow-inner"
                />

                {/* 4. Send or Quick Mic Button */}
                {inputMessage.trim() ? (
                  <button
                    type="submit"
                    disabled={isSendingMessage}
                    className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white flex items-center justify-center transition-all cursor-pointer shadow-md shrink-0 active:scale-95"
                    title={isAr ? 'إرسال' : 'Send'}
                  >
                    {isSendingMessage ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={startVoiceRecording}
                    className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-neutral-100 hover:bg-rose-500/15 dark:bg-neutral-900 dark:hover:bg-rose-950/40 text-neutral-600 dark:text-neutral-300 hover:text-rose-500 border border-neutral-200 dark:border-neutral-800 flex items-center justify-center transition-all cursor-pointer shadow-xs shrink-0 active:scale-95"
                    title={isAr ? 'تسجيل رسالة صوتية' : 'Record voice note'}
                  >
                    <Mic className="w-4.5 h-4.5" />
                  </button>
                )}
              </>
            )}
          </form>

          {/* Gift Modal */}
          {currentChat && (
            <GiftModal
              isOpen={isGiftModalOpen}
              onClose={() => setIsGiftModalOpen(false)}
              lang={lang}
              coinsBalance={coinsBalance}
              walletBalance={walletBalance}
              recipientName={currentChat.name}
              onSendGift={handleSendGift}
              onOpenWallet={onOpenWallet}
            />
          )}
        </div>
      ) : (
        /* ========================================================
            SCREEN B: CHATS CONVERSATIONS LIST
           ======================================================== */
        <div className="flex-1 flex flex-col space-y-4 pt-1 px-3 sm:px-6 pb-24 sm:pb-28 w-full max-w-full min-w-0">
          {/* Search Bar - موزع بشكل طبيعي على الخلفية */}
          <div className="relative pt-1">
            <Search className="w-4 h-4 text-neutral-400 absolute right-4 top-1/2 -translate-y-1/2 rtl:right-4 rtl:left-auto ltr:left-4 ltr:right-auto" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isAr ? 'البحث أو بدء محادثة جديدة...' : 'Search or start a new chat...'}
              className="w-full h-11 pr-11 pl-4 rtl:pr-11 rtl:pl-4 ltr:pl-11 ltr:pr-4 text-xs sm:text-sm rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:border-cyan-500 transition-colors shadow-xs"
            />
          </div>

          {/* ========================================================
              PRIMARY CHAT: مركز الإشعارات (دردشة أساسية لا يمكن مراسلتها)
             ======================================================== */}
          {isNotificationCenterMatch && (
            <div
              onClick={handleOpenNotificationCenter}
              className="p-3 sm:px-4 sm:py-3.5 rounded-2xl bg-cyan-500/5 dark:bg-cyan-950/25 border-2 border-cyan-500/35 hover:border-cyan-500/60 hover:bg-cyan-500/10 dark:hover:bg-cyan-950/40 transition-all flex items-center gap-3.5 cursor-pointer group shadow-sm relative my-1"
            >
              {/* Avatar: Official Cyan Bell Emblem */}
              <div className="relative shrink-0">
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-cyan-600 via-cyan-500 to-sky-400 text-white flex items-center justify-center shadow-md shadow-cyan-500/20 ring-2 ring-cyan-400/40">
                  <Bell className="w-6 h-6 stroke-[2.3] text-white" />
                </div>
                <span
                  className="w-4 h-4 rounded-full bg-emerald-500 border-2 border-white dark:border-neutral-900 absolute bottom-0 right-0 flex items-center justify-center text-[8px] text-white font-bold"
                  title={isAr ? 'قناة موثقة' : 'Verified Channel'}
                >
                  ✓
                </span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 pr-1 rtl:pr-1 ltr:pl-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 truncate">
                    <h2 className="text-sm font-black text-neutral-900 dark:text-white truncate">
                      {isAr ? 'مركز الإشعارات' : 'Notification Center'}
                    </h2>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 font-bold border border-cyan-500/25 shrink-0">
                      {isAr ? 'رسمي' : 'Official'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {latestNotificationTime && (
                      <span
                        className="text-[11px] text-neutral-400 font-mono tabular-nums shrink-0"
                        title={formatLocalDateTime(latestNotificationTime, lang)}
                      >
                        {formatRelativeChatTime(latestNotificationTime, lang)}
                      </span>
                    )}

                    {unreadNotificationsCount > 0 && (
                      <span className="min-w-5 h-5 px-1.5 rounded-full bg-cyan-500 text-white font-mono text-[10px] font-black flex items-center justify-center shrink-0 shadow-sm shadow-cyan-500/30 animate-pulse">
                        {unreadNotificationsCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Conversations List - موزعة بانسيابية على خلفية الصفحة */}
          <div className="flex-1 space-y-1 pt-1">
            {isLoading ? (
              <div className="space-y-3 py-4">
                <div className="flex items-center justify-center gap-2 text-xs font-semibold text-cyan-600 dark:text-cyan-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{isAr ? 'جاري تحميل الرسائل' : 'Loading messages...'}</span>
                </div>
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="p-3.5 rounded-2xl bg-white/60 dark:bg-neutral-900/40 border border-neutral-100 dark:border-neutral-800/60 animate-pulse flex items-center gap-3.5"
                  >
                    <div className="w-12 h-12 rounded-full bg-neutral-200 dark:bg-neutral-800 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-1/3 bg-neutral-200 dark:bg-neutral-800 rounded" />
                      <div className="h-3 w-2/3 bg-neutral-200 dark:bg-neutral-800 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : loadError ? (
              <div className="p-6 rounded-3xl bg-rose-500/10 border border-rose-500/30 text-center space-y-3 my-4">
                <AlertCircle className="w-9 h-9 text-rose-500 mx-auto" />
                <h3 className="font-bold text-rose-600 dark:text-rose-400 text-sm">
                  {loadError}
                </h3>
                <button
                  type="button"
                  onClick={() => loadDatabaseData(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-bold text-xs cursor-pointer shadow-sm transition-all active:scale-95"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{isAr ? 'إعادة المحاولة' : 'Retry'}</span>
                </button>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-400 flex items-center justify-center mx-auto shadow-xs">
                  <MessageCircle className="w-6 h-6" />
                </div>
                <div className="text-xs text-neutral-500">
                  {isAr ? 'لا توجد محادثات' : 'No conversations'}
                </div>
              </div>
            ) : (
              filteredConversations.map((chat) => (
                <div
                  key={chat.id}
                  onClick={() => handleOpenChat(chat.id)}
                  className="p-3 sm:px-4 sm:py-3.5 rounded-2xl hover:bg-white dark:hover:bg-neutral-900/80 transition-colors flex items-center gap-3.5 cursor-pointer group"
                >
                  {/* Avatar with Online indicator */}
                  <div className="relative shrink-0">
                    <img
                      src={chat.avatar}
                      alt={chat.name}
                      className="w-12 h-12 rounded-full object-cover border border-neutral-200 dark:border-neutral-700"
                    />
                    {chat.status === 'online' && (
                      <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-neutral-900 absolute bottom-0 right-0" />
                    )}
                  </div>

                  {/* Contact Info & Last Message */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h2 className="text-sm font-bold text-neutral-900 dark:text-white truncate">
                        {chat.name}
                      </h2>
                      <span
                        className="text-[11px] text-neutral-400 font-mono tabular-nums shrink-0"
                        title={formatLocalDateTime(chat.time || chat.createdAt, lang)}
                      >
                        {formatRelativeChatTime(chat.time || chat.createdAt, lang)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate leading-relaxed">
                        {chat.lastMessage}
                      </p>

                      {chat.unreadCount > 0 && (
                        <span className="min-w-5 h-5 px-1.5 rounded-full bg-emerald-600 text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                          {chat.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Live Camera Modal */}
      <LiveCameraModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onCapture={(dataUrl) => {
          setPreviewMedia({
            type: 'image',
            url: dataUrl,
          });
        }}
        lang={lang}
      />

      {/* Media Preview Modal (Before Sending Photo or Audio) */}
      <MediaPreviewModal
        isOpen={Boolean(previewMedia)}
        onClose={() => setPreviewMedia(null)}
        onSend={(caption) => {
          if (previewMedia) {
            handleSendMediaMessage(
              previewMedia.type,
              previewMedia.url,
              caption,
              previewMedia.duration
            );
          }
        }}
        mediaType={previewMedia?.type || 'image'}
        mediaUrl={previewMedia?.url || ''}
        audioDuration={previewMedia?.duration}
        isLoading={isSendingMessage}
        lang={lang}
      />

      {/* Image Lightbox Modal for fullscreen viewing */}
      <ImageLightboxModal
        isOpen={Boolean(lightboxImage)}
        onClose={() => setLightboxImage(null)}
        imageUrl={lightboxImage?.url || ''}
        caption={lightboxImage?.caption}
        lang={lang}
      />

      {/* Hidden file inputs for direct camera, gallery image, and audio files */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCameraPhotoChange}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleGalleryPhotoChange}
      />
      <input
        ref={audioFileInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={handleAudioFileChange}
      />

      {/* تنبيه Toast في وسط الشاشة */}
      {toastMessage && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] px-6 py-4 rounded-3xl bg-neutral-950/95 dark:bg-neutral-900/95 text-white font-black text-xs sm:text-sm shadow-2xl border-2 border-cyan-400 shadow-cyan-500/30 backdrop-blur-xl flex items-center justify-center gap-2.5 text-center max-w-[90vw] animate-in fade-in zoom-in-95 duration-200 pointer-events-none">
          <Sparkles className="w-5 h-5 shrink-0 text-cyan-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
