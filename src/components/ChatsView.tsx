import React, { useState, useEffect } from 'react';
import {
  Search,
  CheckCheck,
  Send,
  ArrowRight,
  ArrowLeft,
  UserPlus,
  Users,
  UserCheck,
  Phone,
  Video,
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
} from 'lucide-react';
import { Language, AuthUser } from '../types';
import { subscribeToConversation, supabase } from '../lib/supabase';
import { FriendsView } from './FriendsView';
import { GiftModal, GiftItem } from './GiftModal';
import {
  formatLocalTime,
  formatLocalDateTime,
  formatRelativeChatTime,
} from '../lib/dateUtils';

interface ChatsViewProps {
  lang: Language;
  currentUser?: AuthUser | null;
  walletBalance?: number;
  coinsBalance?: number;
  onDeductDiamonds?: (amount: number) => void;
  onDeductCoins?: (amount: number) => void;
  onOpenWallet?: () => void;
}

interface Message {
  id: string;
  sender: 'me' | 'them';
  text: string;
  createdAt?: string;
  time: string;
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
}

interface Friend {
  id: string;
  name: string;
  avatar: string;
  status: 'online' | 'offline';
  bio: string;
}

export const ChatsView: React.FC<ChatsViewProps> = ({
  lang,
  currentUser,
  walletBalance = 0,
  coinsBalance = 0,
  onDeductDiamonds,
  onDeductCoins,
  onOpenWallet,
}) => {
  const isAr = lang === 'ar';

  // Separate Full-Screen Page for Friends & Friend Requests
  const [isFriendsPageOpen, setIsFriendsPageOpen] = useState(false);
  const [isGiftModalOpen, setIsGiftModalOpen] = useState(false);

  // Currently open chat thread (null means we are in the WhatsApp chat list)
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  // Dedicated pending/newly started friend chat to prevent polling from closing it
  const [activePendingChat, setActivePendingChat] = useState<ChatConversation | null>(null);

  // Search input
  const [searchQuery, setSearchQuery] = useState('');

  // Typing indicator simulation
  const [isTyping, setIsTyping] = useState(false);

  // Message input in active chat
  const [inputMessage, setInputMessage] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);

  // Loading and Error states for database fetching
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Real Conversations list from Database
  const [conversations, setConversations] = useState<ChatConversation[]>([]);

  // Current logged in user ID
  const getCurrentUserId = () => {
    if (typeof window !== 'undefined') {
      try {
        const u = JSON.parse(localStorage.getItem('soulx_auth_user') || '{}');
        if (u?.id) return u.id;
      } catch {}
    }
    return '549182301';
  };

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
      return {
        ...remoteConv,
        partnerId: remoteConv.partnerId || localConv.partnerId,
        unreadCount:
          remoteConv.id === currentActiveId || localConv.id === currentActiveId
            ? 0
            : remoteConv.unreadCount,
        messages:
          remoteConv.messages && remoteConv.messages.length > 0
            ? remoteConv.messages
            : localConv.messages,
      };
    });

    // 2. CRITICAL FIX: Keep any conversation in `prev` that does not exist yet on the remote server
    // (Crucial: prevents newly opened friend chats from disappearing on poll before first message is sent)
    const localOnly = prev.filter((localConv) => {
      const existsInRemote = remoteList.some(
        (rc) =>
          rc.id === localConv.id ||
          (rc.partnerId && localConv.partnerId && rc.partnerId === localConv.partnerId) ||
          rc.name === localConv.name
      );
      return !existsInRemote;
    });

    return [...localOnly, ...updatedRemotes];
  };

  // Fetch real data from backend database endpoints with loading & error handling
  const loadDatabaseData = async () => {
    setIsLoading(true);
    setLoadError(null);
    const uid = getCurrentUserId();

    try {
      const convsRes = await fetch(`/api/conversations/list?userId=${encodeURIComponent(uid)}`).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      });

      if (convsRes.success && Array.isArray(convsRes.conversations)) {
        setConversations((prev) => mergeRemoteWithLocalConversations(prev, convsRes.conversations, activeChatId));
      }
    } catch (err: any) {
      setLoadError(
        isAr
          ? 'تعذر تحميل الرسائل. يرجى التحقق من الاتصال والمحاولة ثانية.'
          : 'Failed to load messages. Please check connection and retry.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDatabaseData();

    // Auto-poll conversations every 2.5s so messages from friends appear in real-time for recipient
    const pollInterval = setInterval(() => {
      const uid = getCurrentUserId();
      fetch(`/api/conversations/list?userId=${encodeURIComponent(uid)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.success && Array.isArray(data.conversations)) {
            setConversations((prev) => mergeRemoteWithLocalConversations(prev, data.conversations, activeChatId));
          }
        })
        .catch(() => {});
    }, 2500);

    const handleUpdate = () => {
      loadDatabaseData();
    };
    window.addEventListener('soulx_friends_updated', handleUpdate);
    window.addEventListener('soulx_friend_requests_updated', handleUpdate);
    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('soulx_friends_updated', handleUpdate);
      window.removeEventListener('soulx_friend_requests_updated', handleUpdate);
    };
  }, [activeChatId]);

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
  };

  // Open Chat thread
  const handleOpenChat = (chatId: string) => {
    setActiveChatId(chatId);
    setActivePendingChat(null);
    // Mark as read
    setConversations((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, unreadCount: 0 } : c))
    );
  };

  const handleBackToChatsList = () => {
    setActiveChatId(null);
    setActivePendingChat(null);
  };

  // Active Chat Object (stable fallback to activePendingChat prevents chat screen from flashing/closing)
  const currentChat =
    conversations.find(
      (c) =>
        c.id === activeChatId ||
        (activeChatId && c.partnerId && c.partnerId === activeChatId) ||
        (activePendingChat && (c.id === activePendingChat.id || c.name === activePendingChat.name))
    ) || (activePendingChat && (activePendingChat.id === activeChatId || activePendingChat.partnerId === activeChatId) ? activePendingChat : undefined);

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
          },
        })
      );
    } else if (currentChat) {
      window.dispatchEvent(
        new CustomEvent('soulx:set-navbar-back', {
          detail: {
            onBack: handleBackToChatsList,
            label: isAr ? 'العودة للمحادثات' : 'Back to Chats',
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

  // Supabase Realtime: Live updates for active conversation
  useEffect(() => {
    if (!activeChatId) return;

    const channel = subscribeToConversation(activeChatId, (newMsg: any) => {
      if (newMsg && newMsg.text) {
        const utcTimestamp = newMsg.created_at || new Date().toISOString();

        setConversations((prev) =>
          prev.map((c) => {
            if (c.id === activeChatId) {
              const alreadyExists = c.messages.some((m) => m.id === newMsg.id);
              if (alreadyExists) return c;
              return {
                ...c,
                lastMessage: newMsg.text,
                time: utcTimestamp,
                createdAt: utcTimestamp,
                messages: [
                  ...c.messages,
                  {
                    id: newMsg.id || `rt-${Date.now()}`,
                    sender: 'them',
                    text: newMsg.text,
                    createdAt: utcTimestamp,
                    time: utcTimestamp,
                  },
                ],
              };
            }
            return c;
          })
        );
      }
    });

    return () => {
      if (channel) {
        channel.unsubscribe();
      }
    };
  }, [activeChatId]);

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
    const uid = getCurrentUserId();
    const targetRecipientId = currentChat?.partnerId || currentChat?.id;
    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: activeChatId,
          recipientId: targetRecipientId,
          senderId: uid,
          senderName: currentUser?.name,
          senderAvatar: currentUser?.photoUrl,
          recipientName: currentChat?.name,
          recipientAvatar: currentChat?.avatar,
          text: messageText,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to send message');
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

  // إرسال هدية في الشات (خصم كوينز للمرسل وإيداع ماسات للمستلم)
  const handleSendGift = async (gift: GiftItem) => {
    if (!currentChat) return;
    if (onDeductCoins) {
      onDeductCoins(gift.cost);
    }

    const giftText = isAr
      ? `🎁 أرسل لك هدية: ${gift.nameAr} (${gift.cost} كوينز 🪙 تم تحويلها كماسات 💎 إلى رصيدك) ✨`
      : `🎁 Sent you a gift: ${gift.nameEn} (${gift.cost} Coins 🪙 credited as Diamonds 💎) ✨`;

    const nowUtc = new Date().toISOString();

    const giftMsg: Message = {
      id: `gift-${Date.now()}`,
      sender: 'me',
      text: giftText,
      createdAt: nowUtc,
      time: nowUtc,
    };

    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === activeChatId) {
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

    const uid = getCurrentUserId();
    const targetRecipientId = currentChat.partnerId || currentChat.id;
    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: activeChatId,
          senderId: uid,
          senderName: currentUser?.name,
          senderAvatar: currentUser?.photoUrl,
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
      if (data.success && typeof data.senderCoins === 'number') {
        window.dispatchEvent(
          new CustomEvent('soulx:balance-updated', {
            detail: { userId: uid, balance: data.senderCoins, currency: 'coins' },
          })
        );
      }
    } catch (err) {
      console.warn('Failed to send gift in chat:', err);
    }
  };

  // Filtered conversations by search
  const filteredConversations = conversations.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          });
        }}
        currentUserId={getCurrentUserId()}
      />
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto flex-1 flex flex-col h-full">
      {/* ========================================================
          SCREEN A: ACTIVE CHAT CONVERSATION VIEW (NO CARD / DIRECT ON PAGE)
         ======================================================== */}
      {currentChat ? (
        <div className="flex-1 flex flex-col w-full h-full relative">
          {/* Partner Info Header Bar - موزع مباشرة على خلفية الصفحة */}
          <div className="sticky top-16 z-20 w-full backdrop-blur-md bg-white/90 dark:bg-neutral-950/90 border-b border-neutral-200/80 dark:border-neutral-800/80 px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between transition-colors">
            <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
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
                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover border border-neutral-200 dark:border-neutral-700"
                />
                {currentChat.status === 'online' && (
                  <span className="w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-neutral-950 absolute bottom-0 right-0" />
                )}
              </div>

              {/* Contact Name & Status */}
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-white leading-tight truncate">
                  {currentChat.name}
                </h3>
                <div className="text-[11px] sm:text-xs text-emerald-600 dark:text-emerald-400 font-medium">
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

            {/* Header Call & Action Icons */}
            <div className="flex items-center gap-1 sm:gap-2 text-neutral-600 dark:text-neutral-300 shrink-0">
              <button
                type="button"
                onClick={() => alert(isAr ? 'بدء مكالمة صوتية مشفرة...' : 'Starting voice call...')}
                className="p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                title={isAr ? 'مكالمة صوتية' : 'Voice Call'}
              >
                <Phone className="w-4.5 h-4.5" />
              </button>
              <button
                type="button"
                onClick={() => alert(isAr ? 'بدء مكالمة فيديو...' : 'Starting video call...')}
                className="p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                title={isAr ? 'مكالمة فيديو' : 'Video Call'}
              >
                <Video className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>

          {/* Messages Feed Area - مباشرة على خلفية الصفحة بدون خلفيات إضافية */}
          <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 sm:py-6 space-y-3.5 w-full">
            {/* Encryption Notice */}
            <div className="flex justify-center my-2">
              <div className="px-3.5 py-1.5 rounded-full bg-neutral-200/60 dark:bg-neutral-900 border border-neutral-300/40 dark:border-neutral-800 text-[10px] sm:text-[11px] text-neutral-600 dark:text-neutral-400 font-medium flex items-center gap-1.5 shadow-2xs">
                <span>🔒</span>
                <span>
                  {isAr
                    ? 'الرسائل والمكالمات مشفرة تماماً بين الطرفين في Soul-X'
                    : 'Messages are end-to-end encrypted in Soul-X'}
                </span>
              </div>
            </div>

            {currentChat.messages.map((msg) => {
              const isMe = msg.sender === 'me';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] sm:max-w-[70%] md:max-w-[60%] px-4 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-xs relative ${
                      isMe
                        ? 'bg-emerald-600 text-white rounded-br-xs'
                        : 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 rounded-bl-xs border border-neutral-200 dark:border-neutral-800'
                    }`}
                  >
                    {msg.text.includes('🎁') ? (
                      <div className="flex items-center gap-2.5 py-0.5">
                        <span className="text-2xl animate-bounce shrink-0">🎁</span>
                        <div>
                          <div className="font-bold text-amber-300">
                            {isAr ? 'هدية كوينز وماسات مميزة! ✨' : 'Special Gift! ✨'}
                          </div>
                          <div className="text-xs opacity-95">{msg.text}</div>
                        </div>
                      </div>
                    ) : (
                      <div>{msg.text}</div>
                    )}
                    <div
                      className={`flex items-center gap-1 text-[10px] justify-end mt-1 font-mono ${
                        isMe ? 'text-emerald-100' : 'text-neutral-400'
                      }`}
                    >
                      <span title={formatLocalDateTime(msg.createdAt || msg.time, lang)}>
                        {formatLocalTime(msg.createdAt || msg.time, lang)}
                      </span>
                      {isMe && <CheckCheck className="w-3.5 h-3.5 text-cyan-200" />}
                    </div>
                  </div>
                </div>
              );
            })}

            {isTyping && (
              <div className="flex items-center gap-1.5 p-2 bg-white dark:bg-neutral-900 rounded-2xl w-fit text-xs text-neutral-400 border border-neutral-200 dark:border-neutral-800 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce" />
                <span className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce [animation-delay:0.2s]" />
                <span className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce [animation-delay:0.4s]" />
              </div>
            )}
          </div>

          {/* Message Input Bar: خانة إدخال + زر إرسال هدية + زر إرسال رسالة */}
          <form
            onSubmit={handleSendMessage}
            className="sticky bottom-16 z-30 w-full backdrop-blur-md bg-white/95 dark:bg-neutral-950/95 border-t border-neutral-200/80 dark:border-neutral-800/80 px-3 sm:px-6 py-2.5 sm:py-3 flex items-center gap-2 transition-colors"
          >
            {/* زر إرسال هدية */}
            <button
              type="button"
              onClick={() => setIsGiftModalOpen(true)}
              className="p-2.5 sm:px-3.5 sm:py-2.5 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/30 flex items-center gap-1.5 font-bold text-xs shrink-0 cursor-pointer active:scale-95 transition-all shadow-xs"
              title={isAr ? 'إرسال هدية' : 'Send Gift'}
            >
              <Gift className="w-4.5 h-4.5 text-amber-500" />
              <span className="hidden sm:inline">{isAr ? 'هدية' : 'Gift'}</span>
            </button>

            {/* خانة إدخال الرسالة */}
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={isAr ? 'اكتب رسالة...' : 'Type a message...'}
              className="flex-1 h-11 sm:h-12 px-4 text-xs sm:text-sm rounded-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 focus:border-cyan-500 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none transition-colors shadow-inner"
            />

            {/* زر إرسال الرسالة */}
            <button
              type="submit"
              disabled={!inputMessage.trim() || isSendingMessage}
              className="w-11 h-11 rounded-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white flex items-center justify-center transition-all cursor-pointer shadow-md shrink-0 active:scale-95"
              title={isAr ? 'إرسال' : 'Send'}
            >
              {isSendingMessage ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4.5 h-4.5" />
              )}
            </button>
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
        <div className="flex-1 flex flex-col space-y-4 pt-1 px-4 sm:px-6">
          {/* Top Bar: Title + Dedicated "الأصدقاء و طلبات الصداقة" Button */}
          <div className="flex items-center justify-between pb-1">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 dark:text-white flex items-center gap-2.5">
                <span>{isAr ? 'الدردشات' : 'Chats'}</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                  {conversations.length}
                </span>
              </h1>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                {isAr ? 'محادثاتك الخاصة وتوافقاتك الروحية' : 'Your private soul conversations'}
              </p>
            </div>

            {/* زر بالاعلى لفتح صفحة الأصدقاء */}
            <button
              type="button"
              onClick={() => setIsFriendsPageOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 font-bold text-xs transition-all duration-200 cursor-pointer active:scale-95 group"
            >
              <Users className="w-4 h-4 transition-transform group-hover:scale-110" />
              <span>{isAr ? 'الأصدقاء' : 'Friends'}</span>
            </button>
          </div>

          {/* Search Bar - موزع بشكل طبيعي على الخلفية */}
          <div className="relative">
            <Search className="w-4 h-4 text-neutral-400 absolute right-4 top-1/2 -translate-y-1/2 rtl:right-4 rtl:left-auto ltr:left-4 ltr:right-auto" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isAr ? 'البحث أو بدء محادثة جديدة...' : 'Search or start a new chat...'}
              className="w-full h-11 pr-11 pl-4 rtl:pr-11 rtl:pl-4 ltr:pl-11 ltr:pr-4 text-xs sm:text-sm rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:border-cyan-500 transition-colors shadow-xs"
            />
          </div>

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
                  onClick={loadDatabaseData}
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
                  {isAr ? 'لا توجد محادثات في قاعدة البيانات حالياً' : 'No chats found in database currently'}
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
    </div>
  );
};
