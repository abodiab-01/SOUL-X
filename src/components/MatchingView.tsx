import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  MessageSquare,
  CheckCircle2,
  RefreshCw,
  MessageCircle,
  Users,
  AlertCircle,
  Loader2,
  SlidersHorizontal,
  Compass,
  Gift,
  Send,
  UserPlus,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  ArrowLeft,
  X,
  CheckCheck,
} from 'lucide-react';
import { Language, Gender, AuthUser } from '../types';
import { GiftModal, GiftItem } from './GiftModal';
import { CoinIcon, DiamondIcon } from './CurrencyIcons';
import { formatLocalTime, formatLocalDateTime } from '../lib/dateUtils';

interface MatchingViewProps {
  lang: Language;
  onGoToChat: () => void;
  currentUser?: AuthUser | null;
  walletBalance?: number;
  coinsBalance?: number;
  onDeductDiamonds?: (amount: number) => void;
  onDeductCoins?: (amount: number) => void;
  onOpenWallet?: () => void;
}

interface TextPartner {
  id: string;
  name: string;
  gender: Gender;
  age: number;
  city: { ar: string; en: string };
  avatar: string;
  matchScore: number;
  topic: { ar: string; en: string };
  quote: { ar: string; en: string };
  tags: { ar: string[]; en: string[] };
  firstMessage: { ar: string; en: string };
}

interface InstantChatMessage {
  id: string;
  sender: 'me' | 'them';
  text: string;
  createdAt?: string;
  time: string;
  isGift?: boolean;
  giftIcon?: string;
  giftName?: string;
  giftCost?: number;
}

export const MatchingView: React.FC<MatchingViewProps> = ({
  lang,
  onGoToChat,
  currentUser,
  walletBalance = 0,
  coinsBalance = 0,
  onDeductDiamonds,
  onDeductCoins,
  onOpenWallet,
}) => {
  const isAr = lang === 'ar';

  // State: 'idle' (preferences & start button) | 'searching' (radar) | 'chat' (instant match chat) | 'empty'
  const [searchState, setSearchState] = useState<'idle' | 'searching' | 'chat' | 'empty'>('idle');

  // Filters
  const [genderFilter, setGenderFilter] = useState<'all' | 'female' | 'male'>('all');
  const [ageFilter, setAgeFilter] = useState<'all' | '18-25' | '26-35' | '36+'>('all');
  const [vibeFilter, setVibeFilter] = useState<'all' | 'spiritual' | 'deep' | 'friendly'>('all');

  // Matchmaking Queue states
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [queuePosition, setQueuePosition] = useState<number>(1);
  const [queueCount, setQueueCount] = useState<number>(1);
  const [matchedPartner, setMatchedPartner] = useState<TextPartner | null>(null);

  // Instant Chat in Matching Page
  const [chatMessages, setChatMessages] = useState<InstantChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isGiftModalOpen, setIsGiftModalOpen] = useState(false);
  const [isAddingFriend, setIsAddingFriend] = useState(false);
  const [isFriendRequested, setIsFriendRequested] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isTypingReply, setIsTypingReply] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (searchState === 'chat') {
      scrollToBottom();
    }
  }, [chatMessages, isTypingReply, searchState]);

  // Stable User ID & Age helpers
  const getUserId = () => {
    if (currentUser?.id) return currentUser.id;
    if (typeof window !== 'undefined') {
      let saved = localStorage.getItem('soulx_session_uid');
      if (!saved) {
        saved = 'user-' + Math.random().toString(36).substring(2, 9);
        localStorage.setItem('soulx_session_uid', saved);
      }
      return saved;
    }
    return 'guest-user';
  };

  const getUserAge = () => {
    if (currentUser?.birthDate) {
      const birth = new Date(currentUser.birthDate);
      if (!isNaN(birth.getTime())) {
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
        if (age > 15) return age;
      }
    }
    return 24;
  };

  // Poll live queue count for stats badge in preferences view
  useEffect(() => {
    const fetchQueueStats = async () => {
      try {
        const res = await fetch('/api/matching/queue/stats');
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && typeof data.waitingCount === 'number') {
          setQueueCount(data.waitingCount);
        }
      } catch {}
    };
    fetchQueueStats();
    const interval = setInterval(fetchQueueStats, 4000);
    return () => clearInterval(interval);
  }, []);

  // Format matched partner from queue response
  const setupMatchedPartner = (partnerData: any, sessionId: string) => {
    const formattedPartner: TextPartner = {
      id: partnerData.userId || partnerData.id,
      name: partnerData.name,
      gender: (partnerData.gender as Gender) || 'female',
      age: partnerData.age || 25,
      city: { ar: partnerData.city || 'الرياض', en: partnerData.city || 'Riyadh' },
      avatar:
        partnerData.avatar ||
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
      matchScore: 98,
      topic: {
        ar: vibeFilter === 'deep' ? 'حوار عميق وفكري' : vibeFilter === 'friendly' ? 'صداقة وتواصل يومي' : 'توافق روحي ونقاش هادئ',
        en: vibeFilter === 'deep' ? 'Deep intellectual conversation' : vibeFilter === 'friendly' ? 'Friendly daily connection' : 'Spiritual resonance & calm chat',
      },
      quote: { ar: partnerData.bio || (isAr ? 'عضو متواجد في دور المطابقة' : 'Member in matching queue'), en: partnerData.bio || 'Member in matching queue' },
      tags: { ar: ['دور المطابقة', 'تواصل مباشر', 'Soul-X'], en: ['Matching Queue', 'Live Match', 'Soul-X'] },
      firstMessage: {
        ar: 'أهلاً بك! تم التوافق والمطابقة بيننا من دور المطابقة بنجاح ✨',
        en: 'Hello! Matched with you from the matching queue successfully ✨',
      },
    };

    setMatchedPartner(formattedPartner);
    setActiveSessionId(sessionId);
    setSearchState('chat');

    if (typeof window !== 'undefined') {
      try {
        const friendsList = JSON.parse(localStorage.getItem('soulx_friends_list') || '[]');
        const sentRequests = JSON.parse(localStorage.getItem('soulx_sent_friend_requests') || '[]');
        setIsFriendRequested(
          sentRequests.includes(formattedPartner.id) || friendsList.includes(formattedPartner.id)
        );
      } catch {}
    }
  };

  // 1. Start Search: Joins the exclusive matchmaking queue
  const handleStartSearch = async () => {
    setSearchState('searching');
    setMatchedPartner(null);
    setActiveSessionId(null);
    setChatMessages([]);

    const uid = getUserId();
    try {
      const res = await fetch('/api/matching/queue/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: uid,
          displayId: currentUser?.displayId || uid,
          name: currentUser?.name || (isAr ? 'مستخدم Soul-X' : 'Soul-X User'),
          avatar:
            currentUser?.photoUrl ||
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
          gender: currentUser?.gender || 'male',
          age: getUserAge(),
          city: 'الرياض',
          genderPreference: genderFilter,
          agePreference: ageFilter,
          vibePreference: vibeFilter,
        }),
      });

      const data = await res.json();
      if (data.success) {
        if (data.matched && data.partner && data.sessionId) {
          showToast(isAr ? 'تمت المطابقة بنجاح مع مستخدم من الدور! 🎉' : 'Matched with a queue member! 🎉');
          setupMatchedPartner(data.partner, data.sessionId);
        } else {
          setQueuePosition(data.queuePosition || 1);
          setQueueCount(data.waitingCount || 1);
        }
      }
    } catch (err) {
      console.warn('Queue join error:', err);
    }
  };

  // 2. Queue Polling: Checks status and matches while in queue
  useEffect(() => {
    if (searchState !== 'searching') return;
    const uid = getUserId();

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/matching/queue/poll?userId=${encodeURIComponent(uid)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.success) {
          if (data.matched && data.partner && data.sessionId) {
            showToast(isAr ? 'تمت المطابقة بنجاح مع مستخدم من الدور! 🎉' : 'Matched with a queue member! 🎉');
            setupMatchedPartner(data.partner, data.sessionId);
          } else if (data.inQueue) {
            if (typeof data.queuePosition === 'number') setQueuePosition(data.queuePosition);
            if (typeof data.waitingCount === 'number') setQueueCount(data.waitingCount);
          }
        }
      } catch (err) {
        console.warn('Queue poll error:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [searchState, genderFilter, ageFilter, vibeFilter]);

  // 3. Live Chat Session Polling: Keeps instant chat in sync between the matched pair
  useEffect(() => {
    if (searchState !== 'chat' || !activeSessionId) return;
    const uid = getUserId();

    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/matching/session/messages?sessionId=${encodeURIComponent(activeSessionId)}&userId=${encodeURIComponent(uid)}`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && Array.isArray(data.messages)) {
          const mapped: InstantChatMessage[] = data.messages.map((m: any) => ({
            id: m.id,
            sender: m.senderId === uid ? 'me' : 'them',
            text: m.text,
            createdAt: m.createdAt || m.time,
            time: m.time || m.createdAt,
            isGift: m.isGift,
            giftIcon: m.giftIcon,
            giftName: m.giftName,
            giftCost: m.giftCost,
          }));
          setChatMessages(mapped);

          if (data.status === 'ended') {
            showToast(isAr ? 'قام الطرف الآخر بإنهاء جلسة المطابقة' : 'Partner ended the match session');
          }
        }
      } catch (err) {
        console.warn('Session messages poll error:', err);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [searchState, activeSessionId]);

  // Cancel search and leave queue
  const handleCancelSearch = async () => {
    const uid = getUserId();
    try {
      await fetch('/api/matching/queue/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: uid }),
      });
    } catch {}
    setSearchState('idle');
  };

  // زر التالي: يغلق المطابقة الحالية لدى الطرفين وينتقل إلى بحث عن مطابقة جديدة من الدور
  const handleNextMatch = async () => {
    const uid = getUserId();
    if (activeSessionId) {
      try {
        await fetch('/api/matching/session/end', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: activeSessionId,
            userId: uid,
            action: 'next',
          }),
        });
      } catch {}
    }

    showToast(isAr ? 'تم إغلاق المطابقة، جاري البحث عن شريك جديد من الدور...' : 'Match closed, searching next partner from queue...');
    setChatMessages([]);
    setMatchedPartner(null);
    setActiveSessionId(null);
    handleStartSearch();
  };

  // الخروج من الدردشة والعودة للتفضيلات
  const handleExitChat = async () => {
    const uid = getUserId();
    if (activeSessionId) {
      try {
        await fetch('/api/matching/session/end', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: activeSessionId,
            userId: uid,
            action: 'exit',
          }),
        });
      } catch {}
    }
    setActiveSessionId(null);
    setMatchedPartner(null);
    setSearchState('idle');
  };

  // زر إضافة صديق من شاشة المطابقة
  const handleAddFriendFromMatch = async () => {
    if (!matchedPartner || isFriendRequested) return;
    setIsAddingFriend(true);

    const senderId = currentUser?.displayId || currentUser?.id || getUserId();
    const senderName = currentUser?.name || 'مستخدم Soul-X';

    try {
      const res = await fetch('/api/friends/send-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId,
          senderName,
          senderAvatar: currentUser?.photoUrl,
          senderBio: currentUser?.bio,
          senderDisplayId: currentUser?.displayId,
          targetUserId: matchedPartner.id,
          targetUserName: matchedPartner.name,
          targetUserAvatar: matchedPartner.avatar,
          targetUserBio: matchedPartner.quote?.[lang] || matchedPartner.quote?.ar || '',
          timestamp: new Date().toISOString(),
        }),
      });

      const data = await res.json().catch(() => ({}));

      // Update local storage
      const existingSent = JSON.parse(localStorage.getItem('soulx_sent_requests_details') || '[]');
      const newReq = {
        id: `sent-${matchedPartner.id}-${Date.now()}`,
        userId: matchedPartner.id,
        name: matchedPartner.name,
        avatar: matchedPartner.avatar,
        bio: matchedPartner.quote[lang],
        time: isAr ? 'الآن' : 'Just now',
        status: 'pending',
      };
      localStorage.setItem(
        'soulx_sent_requests_details',
        JSON.stringify([newReq, ...existingSent.filter((r: any) => r.userId !== matchedPartner.id)])
      );

      const savedIds = JSON.parse(localStorage.getItem('soulx_sent_friend_requests') || '[]');
      localStorage.setItem(
        'soulx_sent_friend_requests',
        JSON.stringify(Array.from(new Set([...savedIds, matchedPartner.id])))
      );
      window.dispatchEvent(new Event('soulx_friend_requests_updated'));

      setIsFriendRequested(true);
      showToast(
        data.alreadyFriends
          ? (isAr ? `أنت و ${matchedPartner.name} أصدقاء بالفعل! ✨` : `You and ${matchedPartner.name} are already friends! ✨`)
          : (isAr ? `تم إرسال طلب الصداقة إلى ${matchedPartner.name}! ✨` : `Friend request sent to ${matchedPartner.name}! ✨`)
      );
    } catch {
      showToast(isAr ? 'تعذر إرسال الطلب' : 'Failed to send request');
    } finally {
      setIsAddingFriend(false);
    }
  };

  // إرسال رسالة في الشات الفوري
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !matchedPartner) return;

    const userText = chatInput.trim();
    setChatInput('');
    const uid = getUserId();

    const nowUtc = new Date().toISOString();
    const newMsg: InstantChatMessage = {
      id: `m-${Date.now()}`,
      sender: 'me',
      text: userText,
      createdAt: nowUtc,
      time: nowUtc,
    };

    setChatMessages((prev) => [...prev, newMsg]);

    // Send to match session endpoint
    if (activeSessionId) {
      try {
        await fetch('/api/matching/session/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: activeSessionId,
            senderId: uid,
            senderName: currentUser?.name || 'مستخدم Soul-X',
            text: userText,
          }),
        });
      } catch (err) {
        console.warn('Failed to send message to session:', err);
      }
    }
  };

  // إرسال هدية في الشات الفوري (خصم كوينز للمرسل وإيداع ماسات للمستلم)
  const handleSendGift = async (gift: GiftItem) => {
    if (!matchedPartner) return;
    if (onDeductCoins) {
      onDeductCoins(gift.cost);
    }
    const uid = getUserId();
    const giftUtc = new Date().toISOString();

    const giftMsg: InstantChatMessage = {
      id: `gift-${Date.now()}`,
      sender: 'me',
      text: isAr
        ? `🎁 أرسل لك هدية: ${gift.nameAr} (${gift.cost} كوينز 🪙 تم تحويلها كماسات 💎 إلى رصيدك) ✨`
        : `🎁 Sent you a gift: ${gift.nameEn} (${gift.cost} Coins 🪙 credited as Diamonds 💎) ✨`,
      isGift: true,
      giftIcon: gift.icon,
      giftName: isAr ? gift.nameAr : gift.nameEn,
      giftCost: gift.cost,
      createdAt: giftUtc,
      time: giftUtc,
    };

    setChatMessages((prev) => [...prev, giftMsg]);
    showToast(isAr ? `تم إرسال ${gift.nameAr} بنجاح! 🪙` : `Sent ${gift.nameEn} successfully! 🪙`);

    if (activeSessionId) {
      try {
        const res = await fetch('/api/matching/session/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: activeSessionId,
            senderId: uid,
            senderName: currentUser?.name || 'مستخدم Soul-X',
            text: giftMsg.text,
            isGift: true,
            giftIcon: gift.icon,
            giftName: isAr ? gift.nameAr : gift.nameEn,
            giftCost: gift.cost,
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
        console.warn('Failed to send gift to session:', err);
      }
    }
  };

  // ========================================================
  // STATE 1: FULL-SCREEN INSTANT CHAT AFTER MATCHING
  // بعد المطابقة تصبح شاشة الدردشة ملء الشاشة بالكامل بدلاً من العرض في كارت
  // ========================================================
  if (searchState === 'chat' && matchedPartner) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col w-screen h-[100dvh] bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 overflow-hidden animate-in fade-in duration-200">
        {/* Toast alert */}
        {toastMessage && (
          <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[80] px-4 py-2.5 rounded-2xl bg-cyan-500 text-neutral-950 font-bold text-xs sm:text-sm shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Header Bar - Full Width with Backdrop Blur */}
        <header className="px-3 sm:px-6 py-3 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-2 shrink-0 z-20 shadow-xs">
          {/* Right/Left: Exit/Back Button + Partner info */}
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            {/* زر العودة / خروج من الدردشة والعودة للتفضيلات */}
            <button
              type="button"
              onClick={handleExitChat}
              className="p-2 sm:p-2.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer shrink-0 active:scale-95"
              title={isAr ? 'إنهاء المحادثة والعودة' : 'Exit chat & return'}
            >
              {isAr ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
            </button>

            {/* الصورة الرمزية مع مؤشر الاتصال */}
            <div className="relative shrink-0">
              <img
                src={matchedPartner.avatar}
                alt={matchedPartner.name}
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover border-2 border-cyan-500/50 shadow-xs"
              />
              <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-neutral-950 absolute bottom-0 right-0 animate-pulse" />
            </div>

            {/* الاسم ونسبة التوافق والاتصال */}
            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="text-sm sm:text-base font-black text-neutral-900 dark:text-white truncate">
                  {matchedPartner.name}
                </h3>
                <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-mono font-black border border-cyan-500/20">
                  {matchedPartner.matchScore}%
                </span>
                <span className="text-[11px] text-neutral-400 font-medium hidden sm:inline">
                  • {matchedPartner.city[lang]} ({matchedPartner.age} {isAr ? 'سنة' : 'y/o'})
                </span>
              </div>
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                <span>{isAr ? 'متصل الآن في مطابقة فورية' : 'Online in instant match'}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons: Add Friend + Next Match + Exit */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* زر إضافة صديق */}
            <button
              type="button"
              disabled={isAddingFriend || isFriendRequested}
              onClick={handleAddFriendFromMatch}
              className={`py-2 px-2.5 sm:px-3 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs ${
                isFriendRequested
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                  : 'bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700 active:scale-95'
              }`}
              title={isAr ? 'إضافة صديق' : 'Add Friend'}
            >
              {isAddingFriend ? (
                <Loader2 className="w-4 h-4 animate-spin text-cyan-500" />
              ) : isFriendRequested ? (
                <UserCheck className="w-4 h-4 text-emerald-500" />
              ) : (
                <UserPlus className="w-4 h-4 text-cyan-500" />
              )}
              <span className="hidden sm:inline">
                {isFriendRequested ? (isAr ? 'تم الطلب' : 'Requested') : isAr ? 'إضافة صديق' : 'Add Friend'}
              </span>
            </button>

            {/* زر التالي: يغلق المطابقة الحالية لدى الطرفين وينتقل إلى بحث عن مطابقة جديدة */}
            <button
              type="button"
              onClick={handleNextMatch}
              className="py-2 px-3 sm:px-4 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-black text-xs sm:text-sm transition-all cursor-pointer shadow-md active:scale-95 flex items-center gap-1.5"
              title={isAr ? 'إغلاق المطابقة والبحث عن شريك جديد' : 'Close match & search next partner'}
            >
              <span>{isAr ? 'التالي' : 'Next'}</span>
              {isAr ? (
                <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
              ) : (
                <ChevronRight className="w-4 h-4 stroke-[2.5]" />
              )}
            </button>

            {/* زر إغلاق X */}
            <button
              type="button"
              onClick={handleExitChat}
              className="p-2 rounded-2xl text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors cursor-pointer hidden xs:flex"
              title={isAr ? 'إغلاق' : 'Close'}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Messages Feed Area - Full Viewport Height minus Header & Footer */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 space-y-3.5 bg-neutral-100/50 dark:bg-neutral-950/70">
          <div className="max-w-3xl mx-auto w-full space-y-3.5">
            {/* Banner: Match Established */}
            <div className="flex justify-center my-2">
              <div className="px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-700 dark:text-cyan-300 font-bold flex items-center gap-2 shadow-2xs">
                <Sparkles className="w-4 h-4 text-cyan-500 shrink-0" />
                <span>
                  {isAr
                    ? `توافق روحي بنسبة ${matchedPartner.matchScore}% — دردشة فورية نشطة الآن`
                    : `${matchedPartner.matchScore}% Resonance — Live instant chat active`}
                </span>
              </div>
            </div>

            {/* Messages */}
            {chatMessages.map((msg) => {
              const isMe = msg.sender === 'me';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-200`}
                >
                  {msg.isGift ? (
                    /* بطاقة الهدية المميزة */
                    <div className="max-w-[85%] sm:max-w-[70%] p-3.5 sm:p-4 rounded-3xl bg-gradient-to-r from-amber-500/20 via-amber-400/10 to-amber-500/20 border-2 border-amber-400/50 shadow-md flex items-center gap-3.5">
                      <span className="text-3xl sm:text-4xl animate-bounce shrink-0">{msg.giftIcon || '🎁'}</span>
                      <div className="space-y-0.5 min-w-0">
                        <div className="text-xs sm:text-sm font-black text-amber-600 dark:text-amber-400">
                          {isAr ? 'هدية كوينز وماسات مميزة! ✨' : 'Special Gift! ✨'}
                        </div>
                        <div className="text-xs sm:text-sm font-bold text-neutral-800 dark:text-neutral-200 inline-flex items-center gap-1.5 flex-wrap">
                          <span>{msg.giftName}</span>
                          <span className="inline-flex items-center gap-1">
                            <span>({msg.giftCost}</span>
                            <CoinIcon className="w-3.5 h-3.5" />
                            <span>➔ {msg.giftCost}</span>
                            <DiamondIcon className="w-3.5 h-3.5 text-cyan-400" />
                            <span>)</span>
                          </span>
                        </div>
                        <span
                          className="text-[10px] text-neutral-400 font-mono block mt-1"
                          title={formatLocalDateTime(msg.createdAt || msg.time, lang)}
                        >
                          {formatLocalTime(msg.createdAt || msg.time, lang)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    /* رسالة عادية */
                    <div
                      className={`max-w-[85%] sm:max-w-[75%] px-4 py-3 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-xs relative ${
                        isMe
                          ? 'bg-cyan-500 text-neutral-950 font-medium rounded-br-xs'
                          : 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white rounded-bl-xs border border-neutral-200 dark:border-neutral-800'
                      }`}
                    >
                      <div className="whitespace-pre-wrap break-words">{msg.text}</div>
                      <div
                        className={`flex items-center gap-1 text-[10px] justify-end mt-1 font-mono ${
                          isMe ? 'text-neutral-900/70' : 'text-neutral-400'
                        }`}
                      >
                        <span title={formatLocalDateTime(msg.createdAt || msg.time, lang)}>
                          {formatLocalTime(msg.createdAt || msg.time, lang)}
                        </span>
                        {isMe && <CheckCheck className="w-3.5 h-3.5 text-neutral-900" />}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Typing indicator */}
            {isTypingReply && (
              <div className="flex items-center gap-1.5 p-2.5 bg-white dark:bg-neutral-900 rounded-2xl w-fit text-xs text-neutral-400 border border-neutral-200 dark:border-neutral-800 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce" />
                <span className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce [animation-delay:0.2s]" />
                <span className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce [animation-delay:0.4s]" />
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Full-Width Bottom Input Bar */}
        <div className="p-3 sm:p-4 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md border-t border-neutral-200 dark:border-neutral-800 z-20 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <form
            onSubmit={handleSendMessage}
            className="max-w-3xl mx-auto w-full flex items-center gap-2 sm:gap-3"
          >
            {/* زر إرسال هدية */}
            <button
              type="button"
              onClick={() => setIsGiftModalOpen(true)}
              className="px-3.5 py-3 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/30 flex items-center gap-1.5 font-bold text-xs sm:text-sm shrink-0 cursor-pointer active:scale-95 transition-all shadow-xs"
              title={isAr ? 'إرسال هدية' : 'Send Gift'}
            >
              <Gift className="w-5 h-5 text-amber-500" />
              <span className="hidden sm:inline">{isAr ? 'هدية' : 'Gift'}</span>
            </button>

            {/* خانة إدخال الرسالة */}
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={isAr ? 'اكتب رسالة فورية...' : 'Type instant message...'}
              className="flex-1 h-12 px-5 text-xs sm:text-sm rounded-full bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 focus:border-cyan-500 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none transition-colors shadow-inner"
            />

            {/* زر إرسال الرسالة */}
            <button
              type="submit"
              disabled={!chatInput.trim()}
              className="w-12 h-12 rounded-full bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 text-neutral-950 font-bold flex items-center justify-center shrink-0 cursor-pointer active:scale-95 transition-all shadow-md"
              title={isAr ? 'إرسال' : 'Send'}
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>

        {/* Gift Selection Modal */}
        <GiftModal
          isOpen={isGiftModalOpen}
          onClose={() => setIsGiftModalOpen(false)}
          lang={lang}
          coinsBalance={coinsBalance}
          walletBalance={walletBalance}
          recipientName={matchedPartner.name}
          onSendGift={handleSendGift}
          onOpenWallet={onOpenWallet}
        />
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col h-full py-2 px-2 sm:px-4 animate-in fade-in duration-300">
      {/* Toast alert */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-cyan-500 text-neutral-950 font-bold text-xs sm:text-sm shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ========================================================
          STATE 2: MATCHMAKING QUEUE (دور المطابقة الحصري)
          المطابقة تتم بين الأشخاص المتواجدين في الدور حصراً
          ======================================================== */}
      {searchState === 'searching' && (
        <div className="w-full p-6 sm:p-10 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex flex-col items-center justify-center text-center space-y-6 animate-in fade-in zoom-in-95 duration-200 shadow-xl relative overflow-hidden">
          <div className="w-48 h-48 bg-cyan-500/10 blur-3xl rounded-full absolute -top-10 -right-10 pointer-events-none" />

          {/* شارة دور المطابقة المباشر */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-xs font-black shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>{isAr ? 'دور المطابقة المباشر نشط' : 'Live Matching Queue Active'}</span>
          </div>

          {/* رادار البحث التفاعلي */}
          <div className="relative flex items-center justify-center w-36 h-36 sm:w-40 sm:h-40 my-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-cyan-400/20 animate-ping opacity-75" />
            <span className="absolute inline-flex h-28 w-28 rounded-full bg-cyan-400/30 animate-pulse" />
            <span className="absolute inline-flex h-20 w-20 rounded-full bg-cyan-400/40" />
            <div className="relative z-10 w-16 h-16 rounded-2xl bg-cyan-500 text-neutral-950 flex items-center justify-center shadow-2xl">
              <Sparkles className="w-8 h-8 animate-spin" />
            </div>
          </div>

          {/* معلومات الدور والتوافق الحصري */}
          <div className="space-y-2 max-w-md">
            <h3 className="text-lg sm:text-xl font-black text-neutral-900 dark:text-white">
              {isAr ? 'أنت الآن في دور المطابقة...' : 'You are in the matching queue...'}
            </h3>
            <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 font-medium leading-relaxed">
              {isAr
                ? 'يتم مطابقتك حصرياً مع شخص آخر متواجد في الدور حالياً بشكل عشوائي أو حسب تفضيلاتك المحددة.'
                : 'You are matched exclusively with another member waiting in the queue, randomly or per your preferences.'}
            </p>
          </div>

          {/* إحصائيات موقعك في الدور وعدد المنتظرين */}
          <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
            <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800 text-center shadow-xs">
              <div className="text-[11px] text-neutral-500 font-bold mb-0.5">
                {isAr ? 'ترتيبك في الدور' : 'Your Position'}
              </div>
              <div className="text-base sm:text-lg font-black text-cyan-600 dark:text-cyan-400 font-mono">
                #{queuePosition}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800 text-center shadow-xs">
              <div className="text-[11px] text-neutral-500 font-bold mb-0.5">
                {isAr ? 'المتواجدون في الدور' : 'Waiting in Queue'}
              </div>
              <div className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono flex items-center justify-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>{queueCount}</span>
              </div>
            </div>
          </div>

          {/* تنبيه: المطابقة من الدور حصراً */}
          <div className="px-3.5 py-2 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-semibold max-w-sm">
            <span>{isAr ? '⚡ المطابقة تتم بين الأشخاص من الدور حصراً' : '⚡ Matching is exclusively between queue members'}</span>
          </div>

          {/* زر الإجراء: إلغاء الانسحاب من الدور */}
          <div className="w-full max-w-sm pt-1 space-y-2.5">
            <button
              type="button"
              onClick={handleCancelSearch}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-neutral-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors cursor-pointer"
            >
              {isAr ? 'إلغاء والانسحاب من الدور' : 'Cancel & Leave Queue'}
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          STATE 3: EMPTY MATCH STATE (NO USERS FOUND)
          ======================================================== */}
      {searchState === 'empty' && (
        <div className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-xl text-center space-y-5 animate-in fade-in duration-300">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mx-auto shadow-inner">
            <Users className="w-8 h-8" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-lg sm:text-xl font-black text-neutral-900 dark:text-white">
              {isAr ? 'الدور فارغ حالياً' : 'Queue is currently empty'}
            </h3>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto leading-relaxed">
              {isAr
                ? 'بانتظار انضمام مستخدمين حقيقيين آخرين إلى دور المطابقة. يمكنك الانتظار في الدور ليتم توافقك فور دخولهم.'
                : 'Waiting for other registered members to join the matching queue. You can stay in queue to match instantly.'}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={handleStartSearch}
              className="w-full sm:w-auto py-2.5 px-5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-bold text-xs cursor-pointer shadow-sm transition-all active:scale-95"
            >
              {isAr ? 'دخول الدور مجدداً' : 'Re-enter Queue'}
            </button>
            <button
              type="button"
              onClick={() => setSearchState('idle')}
              className="w-full sm:w-auto py-2.5 px-4 rounded-xl text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 text-xs font-semibold cursor-pointer"
            >
              {isAr ? 'العودة للتفضيلات' : 'Back to preferences'}
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          STATE 0: IDLE VIEW (PREFERENCES AT TOP, START SEARCH BUTTON BELOW IT)
          ======================================================== */}
      {searchState === 'idle' && (
        <div className="w-full space-y-4">
          {/* كارد تفضيلات التطابق بالأعلى */}
          <div className="p-5 sm:p-7 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-5 relative overflow-hidden">
            <div className="w-32 h-32 bg-cyan-500/10 blur-2xl rounded-full absolute -top-8 -right-8 pointer-events-none" />

            {/* Header: Title + Status */}
            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800/80 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-neutral-900 dark:text-white">
                    {isAr ? 'تفضيلات التطابق' : 'Matching Preferences'}
                  </h2>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    {isAr ? 'حدد مواصفات الشريك الذي تبحث عنه في الدور' : 'Set your partner preferences before entering queue'}
                  </p>
                </div>
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>{queueCount} {isAr ? 'في دور المطابقة' : 'in matching queue'}</span>
              </div>
            </div>

            {/* 1. تفضيل الجنس */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-cyan-500" />
                <span>{isAr ? 'الجنس المفضل' : 'Gender Preference'}</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setGenderFilter('all')}
                  className={`py-2.5 px-3 rounded-2xl text-xs font-bold transition-all cursor-pointer border ${
                    genderFilter === 'all'
                      ? 'bg-cyan-500 text-neutral-950 border-cyan-500 shadow-sm'
                      : 'bg-neutral-50 dark:bg-neutral-950/70 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-700'
                  }`}
                >
                  {isAr ? 'الكل' : 'All'}
                </button>

                <button
                  type="button"
                  onClick={() => setGenderFilter('female')}
                  className={`py-2.5 px-3 rounded-2xl text-xs font-bold transition-all cursor-pointer border ${
                    genderFilter === 'female'
                      ? 'bg-rose-500 text-white border-rose-500 shadow-sm'
                      : 'bg-neutral-50 dark:bg-neutral-950/70 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-700'
                  }`}
                >
                  {isAr ? 'إناث فقط' : 'Females only'}
                </button>

                <button
                  type="button"
                  onClick={() => setGenderFilter('male')}
                  className={`py-2.5 px-3 rounded-2xl text-xs font-bold transition-all cursor-pointer border ${
                    genderFilter === 'male'
                      ? 'bg-sky-500 text-white border-sky-500 shadow-sm'
                      : 'bg-neutral-50 dark:bg-neutral-950/70 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-700'
                  }`}
                >
                  {isAr ? 'ذكور فقط' : 'Males only'}
                </button>
              </div>
            </div>

            {/* 2. الفئة العمرية */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-500" />
                <span>{isAr ? 'الفئة العمرية' : 'Age Range'}</span>
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: 'all', labelAr: 'الكل', labelEn: 'All' },
                  { id: '18-25', labelAr: '18 - 25', labelEn: '18 - 25' },
                  { id: '26-35', labelAr: '26 - 35', labelEn: '26 - 35' },
                  { id: '36+', labelAr: '+36', labelEn: '36+' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setAgeFilter(item.id as any)}
                    className={`py-2 px-2 text-center rounded-2xl text-xs font-bold transition-all cursor-pointer border ${
                      ageFilter === item.id
                        ? 'bg-cyan-500 text-neutral-950 border-cyan-500 shadow-sm'
                        : 'bg-neutral-50 dark:bg-neutral-950/70 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-700'
                    }`}
                  >
                    {isAr ? item.labelAr : item.labelEn}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. نمط التواصل المفضل */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-cyan-500" />
                <span>{isAr ? 'نمط التواصل والتوافق' : 'Connection Vibe'}</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'all', labelAr: 'تلقائي', labelEn: 'Any Vibe' },
                  { id: 'deep', labelAr: 'حوار عميق', labelEn: 'Deep Chat' },
                  { id: 'friendly', labelAr: 'صداقة وتوافق', labelEn: 'Friendly' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setVibeFilter(item.id as any)}
                    className={`py-2 px-2 text-center rounded-2xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer border truncate ${
                      vibeFilter === item.id
                        ? 'bg-cyan-500 text-neutral-950 border-cyan-500 shadow-sm'
                        : 'bg-neutral-50 dark:bg-neutral-950/70 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-700'
                    }`}
                  >
                    {isAr ? item.labelAr : item.labelEn}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* أسفله زر فقط: بدء البحث */}
          <button
            type="button"
            onClick={handleStartSearch}
            className="w-full py-4 px-6 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-black text-sm sm:text-base tracking-wide shadow-lg shadow-cyan-500/20 transition-all cursor-pointer active:scale-98 flex items-center justify-center gap-2"
          >
            <Sparkles className="w-5 h-5" />
            <span>{isAr ? 'بدء البحث' : 'Start Search'}</span>
          </button>
        </div>
      )}
    </div>
  );
};
