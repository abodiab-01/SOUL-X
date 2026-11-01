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
} from 'lucide-react';
import { Language } from '../types';
import { subscribeToConversation, supabase } from '../lib/supabase';

interface ChatsViewProps {
  lang: Language;
}

interface Message {
  id: string;
  sender: 'me' | 'them';
  text: string;
  time: string;
}

interface ChatConversation {
  id: string;
  name: string;
  avatar: string;
  status: 'online' | 'offline';
  lastMessage: string;
  time: string;
  unreadCount: number;
  messages: Message[];
}

interface FriendRequest {
  id: string;
  name: string;
  avatar: string;
  time: string;
  bio: string;
  matchScore: number;
}

interface Friend {
  id: string;
  name: string;
  avatar: string;
  status: 'online' | 'offline';
  bio: string;
}

export const ChatsView: React.FC<ChatsViewProps> = ({ lang }) => {
  const isAr = lang === 'ar';

  // Modal / View for Friends & Friend Requests
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const [friendsModalTab, setFriendsModalTab] = useState<'requests' | 'friends'>('requests');

  // Currently open chat thread (null means we are in the WhatsApp chat list)
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  // Search input
  const [searchQuery, setSearchQuery] = useState('');

  // Typing indicator simulation
  const [isTyping, setIsTyping] = useState(false);

  // Message input in active chat
  const [inputMessage, setInputMessage] = useState('');

  // Sub-tab for requests: incoming vs sent
  const [requestsSubTab, setRequestsSubTab] = useState<'incoming' | 'sent'>('incoming');

  // Sent friend requests (persisted in localStorage from Navbar search)
  const [sentRequestsList, setSentRequestsList] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('soulx_sent_requests_details');
        if (saved) return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
    return [];
  });

  // Sync sent requests with localStorage events
  React.useEffect(() => {
    const handleUpdate = () => {
      try {
        const saved = localStorage.getItem('soulx_sent_requests_details');
        if (saved) setSentRequestsList(JSON.parse(saved));
        else setSentRequestsList([]);
      } catch {
        // ignore
      }
    };
    window.addEventListener('soulx_friend_requests_updated', handleUpdate);
    return () => window.removeEventListener('soulx_friend_requests_updated', handleUpdate);
  }, []);

  // Real Friend Requests State from Database
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);

  // Real Friends State from Database
  const [friends, setFriends] = useState<Friend[]>([]);

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

  // Fetch real data from backend database endpoints
  const loadDatabaseData = () => {
    const uid = getCurrentUserId();

    fetch(`/api/friends/list?userId=${encodeURIComponent(uid)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          if (Array.isArray(data.friends)) {
            setFriends(data.friends);
          }
          if (Array.isArray(data.incomingRequests)) {
            setFriendRequests(
              data.incomingRequests.map((r: any) => ({
                id: r.id,
                name: r.senderName,
                avatar:
                  r.senderAvatar ||
                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
                time: new Date(r.createdAt).toLocaleDateString(),
                bio: r.senderBio || (isAr ? 'طلب صداقة جديد في Soul-X' : 'New friend request'),
                matchScore: 95,
              }))
            );
          }
        }
      })
      .catch(() => {});

    fetch(`/api/conversations/list?userId=${encodeURIComponent(uid)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.conversations)) {
          setConversations(data.conversations);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadDatabaseData();
  }, []);

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

  // Handle Accepting a Friend Request
  const handleAcceptRequest = (request: FriendRequest) => {
    // Add to Friends
    const newFriend: Friend = {
      id: `fr-${Date.now()}`,
      name: request.name,
      avatar: request.avatar,
      status: 'online',
      bio: request.bio,
    };
    setFriends((prev) => [newFriend, ...prev]);

    // Check if conversation already exists, if not create one
    setConversations((prev) => {
      const exists = prev.find((c) => c.name === request.name);
      if (exists) return prev;
      return [
        {
          id: `chat-${Date.now()}`,
          name: request.name,
          avatar: request.avatar,
          status: 'online',
          lastMessage: isAr ? 'تم قبول طلب الصداقة! ابدأ المحادثة الآن' : 'Friend request accepted! Start chatting now',
          time: 'Just now',
          unreadCount: 1,
          messages: [
            {
              id: `m-${Date.now()}`,
              sender: 'them',
              text: isAr ? 'مرحباً عبدالله! يسعدني قبول طلب الصداقة، تشرفت بك.' : 'Hi Abdullah! Glad we connected.',
              time: 'Just now',
            },
          ],
        },
        ...prev,
      ];
    });

    // Remove from Requests
    setFriendRequests((prev) => prev.filter((r) => r.id !== request.id));
  };

  // Handle Declining a Friend Request
  const handleDeclineRequest = (requestId: string) => {
    setFriendRequests((prev) => prev.filter((r) => r.id !== requestId));
  };

  // Handle Cancelling a Sent Friend Request
  const handleCancelSentRequest = (userId: string) => {
    setSentRequestsList((prev) => prev.filter((r) => r.userId !== userId));
    try {
      const saved = JSON.parse(localStorage.getItem('soulx_sent_requests_details') || '[]');
      localStorage.setItem(
        'soulx_sent_requests_details',
        JSON.stringify(saved.filter((r: any) => r.userId !== userId))
      );
      const savedIds = JSON.parse(localStorage.getItem('soulx_sent_friend_requests') || '[]');
      localStorage.setItem(
        'soulx_sent_friend_requests',
        JSON.stringify(savedIds.filter((id: string) => id !== userId))
      );
      window.dispatchEvent(new Event('soulx_friend_requests_updated'));
    } catch {
      // ignore
    }
  };

  // Start chat with a friend from the friends list
  const handleStartChatWithFriend = (friend: Friend) => {
    setShowFriendsModal(false);
    let targetChat = conversations.find((c) => c.name === friend.name);
    if (!targetChat) {
      targetChat = {
        id: `chat-${Date.now()}`,
        name: friend.name,
        avatar: friend.avatar,
        status: friend.status,
        lastMessage: isAr ? 'ابدأ محادثتك الروحية مع ' + friend.name : 'Start your conversation with ' + friend.name,
        time: 'Just now',
        unreadCount: 0,
        messages: [],
      };
      setConversations((prev) => [targetChat!, ...prev]);
    }
    setActiveChatId(targetChat.id);
  };

  // Open Chat thread
  const handleOpenChat = (chatId: string) => {
    setActiveChatId(chatId);
    // Mark as read
    setConversations((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, unreadCount: 0 } : c))
    );
  };

  // Active Chat Object
  const currentChat = conversations.find((c) => c.id === activeChatId);

  // Supabase Realtime: Live updates for active conversation
  useEffect(() => {
    if (!activeChatId) return;

    const channel = subscribeToConversation(activeChatId, (newMsg: any) => {
      if (newMsg && newMsg.text) {
        const timeStr = new Date(newMsg.created_at || Date.now()).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });

        setConversations((prev) =>
          prev.map((c) => {
            if (c.id === activeChatId) {
              const alreadyExists = c.messages.some((m) => m.id === newMsg.id);
              if (alreadyExists) return c;
              return {
                ...c,
                lastMessage: newMsg.text,
                time: timeStr,
                messages: [
                  ...c.messages,
                  {
                    id: newMsg.id || `rt-${Date.now()}`,
                    sender: 'them',
                    text: newMsg.text,
                    time: timeStr,
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

  // Send message inside active chat
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !activeChatId) return;

    const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

    const newMsg: Message = {
      id: `msg-${Date.now()}`,
      sender: 'me',
      text: inputMessage.trim(),
      time: currentTime,
    };

    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === activeChatId) {
          return {
            ...c,
            lastMessage: newMsg.text,
            time: currentTime,
            messages: [...c.messages, newMsg],
          };
        }
        return c;
      })
    );

    // Persist message in database
    const uid = getCurrentUserId();
    fetch('/api/messages/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: activeChatId,
        senderId: uid,
        text: newMsg.text,
      }),
    }).catch(() => {});

    const messageText = inputMessage.trim();
    setInputMessage('');

    // Trigger auto-reply simulation from contact
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      const replyTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
      const replyReplies = isAr
        ? [
            'سعدت جداً برسالتك! كلامك في الصميم ✨',
            'أتفق معك تماماً، التفاهم هو أساس كل تواصل راقي.',
            'يا له من شعور جميل، يسعدني الحديث معك دوماً!',
          ]
        : [
            'So wonderful hearing from you! ✨',
            'I completely agree with you on that.',
            'Always a pleasure talking with you!',
          ];
      const randomReply = replyReplies[Math.floor(Math.random() * replyReplies.length)];

      const contactReply: Message = {
        id: `reply-${Date.now()}`,
        sender: 'them',
        text: randomReply,
        time: replyTime,
      };

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === activeChatId) {
            return {
              ...c,
              lastMessage: contactReply.text,
              time: replyTime,
              messages: [...c.messages, contactReply],
            };
          }
          return c;
        })
      );
    }, 1200);
  };

  // Filtered conversations by search
  const filteredConversations = conversations.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full max-w-4xl mx-auto flex-1 flex flex-col bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl shadow-xl overflow-hidden my-2 sm:my-4 min-h-[78vh] max-h-[85vh]">
      {/* ========================================================
          SCREEN A: WHATSAPP ACTIVE CHAT CONVERSATION VIEW
         ======================================================== */}
      {currentChat ? (
        <div className="flex-1 flex flex-col h-full bg-[#efeae2] dark:bg-neutral-950 relative">
          {/* WhatsApp Header */}
          <div className="px-4 py-3 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between z-10 shadow-xs">
            <div className="flex items-center gap-3">
              {/* Back to Chat List Button */}
              <button
                type="button"
                onClick={() => setActiveChatId(null)}
                className="p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
                title={isAr ? 'العودة للمحادثات' : 'Back to chats'}
              >
                {isAr ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
              </button>

              {/* Contact Avatar & Online Status */}
              <div className="relative">
                <img
                  src={currentChat.avatar}
                  alt={currentChat.name}
                  className="w-10 h-10 rounded-full object-cover border border-neutral-200 dark:border-neutral-700"
                />
                {currentChat.status === 'online' && (
                  <span className="w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-neutral-900 absolute bottom-0 right-0" />
                )}
              </div>

              {/* Contact Name & Status */}
              <div>
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white leading-tight">
                  {currentChat.name}
                </h3>
                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
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

            {/* Header Call & Action Icons (WhatsApp Style) */}
            <div className="flex items-center gap-1 sm:gap-2 text-neutral-600 dark:text-neutral-300">
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

          {/* Messages Feed Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#1f2937_1px,transparent_1px)] [background-size:16px_16px]">
            {/* Encryption Notice */}
            <div className="flex justify-center my-2">
              <div className="px-3 py-1 rounded-lg bg-neutral-200/70 dark:bg-neutral-900/80 backdrop-blur-xs text-[10px] text-neutral-600 dark:text-neutral-400 font-medium flex items-center gap-1.5 shadow-2xs">
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
                    className={`max-w-[85%] sm:max-w-[70%] px-3.5 py-2 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-xs relative ${
                      isMe
                        ? 'bg-emerald-600 text-white rounded-br-xs'
                        : 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 rounded-bl-xs border border-neutral-200/80 dark:border-neutral-800'
                    }`}
                  >
                    <div>{msg.text}</div>
                    <div
                      className={`flex items-center gap-1 text-[10px] justify-end mt-1 font-mono ${
                        isMe ? 'text-emerald-100' : 'text-neutral-400'
                      }`}
                    >
                      <span>{msg.time}</span>
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

          {/* WhatsApp Message Input Bar */}
          <form
            onSubmit={handleSendMessage}
            className="p-3 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 flex items-center gap-2"
          >
            <button
              type="button"
              className="p-2 text-neutral-500 hover:text-cyan-500 transition-colors cursor-pointer"
              title="Emoji"
            >
              <Smile className="w-5 h-5" />
            </button>
            <button
              type="button"
              className="p-2 text-neutral-500 hover:text-cyan-500 transition-colors cursor-pointer"
              title="Attach"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={isAr ? 'اكتب رسالة...' : 'Type a message...'}
              className="flex-1 px-4 py-2.5 text-xs sm:text-sm rounded-full bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 focus:border-emerald-500 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none transition-colors"
            />

            {inputMessage.trim() ? (
              <button
                type="submit"
                className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center transition-colors cursor-pointer shadow-md shrink-0"
              >
                <Send className="w-4.5 h-4.5" />
              </button>
            ) : (
              <button
                type="button"
                className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 flex items-center justify-center transition-colors cursor-pointer shrink-0"
              >
                <Mic className="w-4.5 h-4.5" />
              </button>
            )}
          </form>
        </div>
      ) : (
        /* ========================================================
            SCREEN B: WHATSAPP CONVERSATIONS LIST
           ======================================================== */
        <div className="flex-1 flex flex-col bg-white dark:bg-neutral-900 h-full">
          {/* Top Bar: Title + Dedicated "الأصدقاء و طلبات الصداقة" Button */}
          <div className="p-4 sm:p-5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/70 dark:bg-neutral-950/50">
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-neutral-900 dark:text-white flex items-center gap-2">
                <span>{isAr ? 'الدردشات' : 'Chats'}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                  {conversations.length}
                </span>
              </h1>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                {isAr ? 'محادثاتك الخاصة وتوافقاتك الروحية' : 'Your private soul conversations'}
              </p>
            </div>

            {/* زر بالاعلى لعرض الاصدقاء و طلبات الصداقة */}
            <button
              type="button"
              onClick={() => setShowFriendsModal(true)}
              className="relative flex items-center gap-2 px-3.5 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 font-bold text-xs transition-all duration-200 cursor-pointer shadow-xs active:scale-95 group"
            >
              <Users className="w-4 h-4 transition-transform group-hover:scale-110" />
              <span>{isAr ? 'الأصدقاء والطلبات' : 'Friends & Requests'}</span>

              {/* Notification Badge on pending requests */}
              {friendRequests.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-rose-500 text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0 shadow-xs">
                  {friendRequests.length}
                </span>
              )}
            </button>
          </div>

          {/* Search Bar (مثل واتس اب) */}
          <div className="p-3 sm:px-4 border-b border-neutral-100 dark:border-neutral-800/80">
            <div className="relative">
              <Search className="w-4 h-4 text-neutral-400 absolute right-3.5 top-1/2 -translate-y-1/2 rtl:right-3.5 rtl:left-auto ltr:left-3.5 ltr:right-auto" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isAr ? 'البحث أو بدء محادثة جديدة...' : 'Search or start a new chat...'}
                className="w-full py-2 px-9 text-xs sm:text-sm rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-transparent focus:border-cyan-500/50 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Conversations List (مثل واتس اب) */}
          <div className="flex-1 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800/60">
            {filteredConversations.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-400 flex items-center justify-center mx-auto">
                  <MessageCircle className="w-6 h-6" />
                </div>
                <div className="text-xs text-neutral-500">
                  {isAr ? 'لا توجد محادثات تطابق بحثك' : 'No chats found matching your search'}
                </div>
              </div>
            ) : (
              filteredConversations.map((chat) => (
                <div
                  key={chat.id}
                  onClick={() => handleOpenChat(chat.id)}
                  className="p-3.5 sm:px-4 sm:py-3.5 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors flex items-center gap-3.5 cursor-pointer group"
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
                      <span className="text-[11px] text-neutral-400 font-mono tabular-nums shrink-0">
                        {chat.time}
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

      {/* ========================================================
          MODAL: الأصدقاء و طلبات الصداقة (Friends & Friend Requests)
         ======================================================== */}
      {showFriendsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-6 max-h-[85vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-cyan-500" />
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
                  {isAr ? 'الأصدقاء وطلبات الصداقة' : 'Friends & Requests'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFriendsModal(false)}
                className="p-2 rounded-full text-neutral-400 hover:text-neutral-900 dark:hover:text-white bg-neutral-100 dark:bg-neutral-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Tabs: طلبات الصداقة (Requests) / قائمة الأصدقاء (Friends) */}
            <div className="grid grid-cols-2 p-1 rounded-2xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setFriendsModalTab('requests')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  friendsModalTab === 'requests'
                    ? 'bg-white dark:bg-neutral-800 text-cyan-600 dark:text-cyan-400 shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{isAr ? 'طلبات الصداقة' : 'Requests'}</span>
                {friendRequests.length > 0 && (
                  <span className="w-4.5 h-4.5 rounded-full bg-rose-500 text-white font-mono text-[9px] font-bold flex items-center justify-center">
                    {friendRequests.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setFriendsModalTab('friends')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  friendsModalTab === 'friends'
                    ? 'bg-white dark:bg-neutral-800 text-cyan-600 dark:text-cyan-400 shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>{isAr ? 'قائمة الأصدقاء' : 'My Friends'}</span>
                <span className="text-[10px] text-neutral-400 font-mono">
                  ({friends.length})
                </span>
              </button>
            </div>

            {/* Modal Tab Content */}
            <div className="flex-1 overflow-y-auto space-y-3 min-h-[220px]">
              {friendsModalTab === 'requests' ? (
                /* 1. قائمة طلبات الصداقة: الواردة والمرسلة */
                <div className="space-y-3">
                  {/* Sub-tabs: الواردة vs المرسلة */}
                  <div className="flex items-center gap-2 border-b border-neutral-100 dark:border-neutral-800 pb-2">
                    <button
                      type="button"
                      onClick={() => setRequestsSubTab('incoming')}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                        requestsSubTab === 'incoming'
                          ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20'
                          : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                      }`}
                    >
                      <span>{isAr ? 'الطلبات الواردة' : 'Incoming Requests'}</span>
                      <span className="font-mono text-[10px]">({friendRequests.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRequestsSubTab('sent')}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                        requestsSubTab === 'sent'
                          ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20'
                          : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                      }`}
                    >
                      <span>{isAr ? 'الطلبات المرسلة' : 'Sent Requests'}</span>
                      <span className="font-mono text-[10px]">({sentRequestsList.length})</span>
                    </button>
                  </div>

                  {requestsSubTab === 'incoming' ? (
                    friendRequests.length === 0 ? (
                      <div className="py-10 text-center space-y-2">
                        <UserCheck className="w-8 h-8 text-neutral-400 mx-auto" />
                        <p className="text-xs text-neutral-500">
                          {isAr ? 'لا توجد طلبات صداقة واردة حالياً' : 'No incoming friend requests'}
                        </p>
                      </div>
                    ) : (
                      friendRequests.map((req) => (
                        <div
                          key={req.id}
                          className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-100 dark:border-neutral-800/80 space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <img
                                src={req.avatar}
                                alt={req.name}
                                className="w-11 h-11 rounded-full object-cover border border-neutral-200 dark:border-neutral-700"
                              />
                              <div>
                                <div className="text-xs font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                                  <span>{req.name}</span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-mono font-bold">
                                    {req.matchScore}% {isAr ? 'توافق' : 'match'}
                                  </span>
                                </div>
                                <div className="text-[11px] text-neutral-500 line-clamp-1 mt-0.5">
                                  {req.bio}
                                </div>
                              </div>
                            </div>
                            <span className="text-[10px] text-neutral-400 font-mono">
                              {req.time}
                            </span>
                          </div>

                          {/* Accept / Decline Action Buttons */}
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => handleAcceptRequest(req)}
                              className="flex-1 py-2 px-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-bold text-xs transition-colors cursor-pointer shadow-xs text-center"
                            >
                              {isAr ? 'قبول الصداقة' : 'Accept'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeclineRequest(req.id)}
                              className="flex-1 py-2 px-3 rounded-xl bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-medium text-xs transition-colors cursor-pointer text-center"
                            >
                              {isAr ? 'رفض' : 'Decline'}
                            </button>
                          </div>
                        </div>
                      ))
                    )
                  ) : (
                    /* Sent requests list */
                    sentRequestsList.length === 0 ? (
                      <div className="py-10 text-center space-y-2">
                        <Clock className="w-8 h-8 text-neutral-400 mx-auto" />
                        <p className="text-xs text-neutral-500">
                          {isAr
                            ? 'لم تقم بإرسال أي طلبات صداقة بعد. ابحث بالمعرف من البار العلوي لإرسال طلب.'
                            : 'No sent requests yet. Search by ID in top bar to send one.'}
                        </p>
                      </div>
                    ) : (
                      sentRequestsList.map((req) => (
                        <div
                          key={req.id || req.userId}
                          className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={req.avatar}
                              alt={req.name}
                              className="w-10 h-10 rounded-full object-cover border border-neutral-200 dark:border-neutral-700 shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-neutral-900 dark:text-white truncate flex items-center gap-1.5">
                                <span>{req.name}</span>
                                <span className="text-[10px] text-amber-500 font-semibold bg-amber-500/10 px-1.5 py-0.5 rounded-full">
                                  {isAr ? 'قيد الانتظار' : 'Pending'}
                                </span>
                              </div>
                              <div className="text-[11px] text-neutral-500 truncate mt-0.5">
                                {req.bio}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleCancelSentRequest(req.userId)}
                            className="py-1.5 px-2.5 rounded-xl bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-medium transition-colors cursor-pointer shrink-0"
                          >
                            {isAr ? 'إلغاء الطلب' : 'Cancel'}
                          </button>
                        </div>
                      ))
                    )
                  )}
                </div>
              ) : (
                /* 2. قائمة الأصدقاء */
                friends.length === 0 ? (
                  <div className="py-12 text-center space-y-2">
                    <Users className="w-8 h-8 text-neutral-400 mx-auto" />
                    <p className="text-xs text-neutral-500">
                      {isAr ? 'لم تقم بإضافة أصدقاء بعد' : 'No friends added yet'}
                    </p>
                  </div>
                ) : (
                  friends.map((friend) => (
                    <div
                      key={friend.id}
                      className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                          <img
                            src={friend.avatar}
                            alt={friend.name}
                            className="w-10 h-10 rounded-full object-cover border border-neutral-200 dark:border-neutral-700"
                          />
                          {friend.status === 'online' && (
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-neutral-900 absolute bottom-0 right-0" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-neutral-900 dark:text-white truncate">
                            {friend.name}
                          </div>
                          <div className="text-[11px] text-neutral-500 truncate">
                            {friend.bio}
                          </div>
                        </div>
                      </div>

                      {/* Direct Message Button */}
                      <button
                        type="button"
                        onClick={() => handleStartChatWithFriend(friend)}
                        className="py-1.5 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 font-bold text-xs transition-colors cursor-pointer shrink-0 border border-emerald-200 dark:border-emerald-900/40"
                      >
                        {isAr ? 'محادثة' : 'Chat'}
                      </button>
                    </div>
                  ))
                )
              )}
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={() => setShowFriendsModal(false)}
              className="w-full py-2.5 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 font-semibold text-xs transition-colors cursor-pointer"
            >
              {isAr ? 'إغلاق' : 'Close'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
