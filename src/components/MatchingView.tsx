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
  Gift,
  Send,
  UserPlus,
  UserCheck,
  ArrowRight,
  ArrowLeft,
  X,
  CheckCheck,
  Coins,
  ShieldCheck,
  Calendar,
  Flag,
} from 'lucide-react';
import { Language, Gender, AuthUser } from '../types';
import { GiftModal, GiftItem, SOULX_GIFTS, getGiftDisplayInfo } from './GiftModal';
import { CoinIcon, DiamondIcon } from './CurrencyIcons';
import { formatLocalTime, formatLocalDateTime } from '../lib/dateUtils';
import { getEffectiveAvatar, getDefaultAvatar } from '../lib/avatar';
import { formatCountryUnified } from '../lib/countryUtils';
import { blockUserApi } from '../lib/blockUtils';
import { ReportUserModal, ReportTargetUser } from './ReportUserModal';

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
  country?: string;
  avatar: string;
  matchScore: number;
  topic: { ar: string; en: string };
  quote: { ar: string; en: string };
  tags: { ar: string[]; en: string[] };
  firstMessage: { ar: string; en: string };
}

interface InstantChatMessage {
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
  const myEffectiveAvatar = getEffectiveAvatar(currentUser?.photoUrl, currentUser?.gender);

  // State: 'idle' | 'searching' | 'confirm' | 'chat' | 'empty'
  const [searchState, setSearchState] = useState<'idle' | 'searching' | 'confirm' | 'chat' | 'empty'>('idle');

  // Filters (تم حذف نمط التواصل والتوافق بالكامل)
  const [genderFilter, setGenderFilter] = useState<'all' | 'female' | 'male'>('all');
  const [ageFilter, setAgeFilter] = useState<'all' | '18-25' | '26-35' | '36+'>('all');

  // حساب تكلفة البحث المحددة:
  // فئة عمرية محددة: 500 Coins
  // جنس معين: 1500 Coins
  // اختيار الكل في الجنس أو العمر: مجاني تماماً (0 Coins)
  const ageCost = ageFilter !== 'all' ? 500 : 0;
  const genderCost = genderFilter !== 'all' ? 1500 : 0;
  const currentMatchingCost = ageCost + genderCost;

  // التكلفة التي تم بدء البحث بها لتأكيد الخصم عند تأكيد المطابقة فقط
  const [committedCost, setCommittedCost] = useState<number>(0);

  // Insufficient Balance Modal Alert
  const [showInsufficientModal, setShowInsufficientModal] = useState<boolean>(false);

  // Matchmaking Queue states
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [queuePosition, setQueuePosition] = useState<number>(1);
  const [queueCount, setQueueCount] = useState<number>(1);
  const [matchedPartner, setMatchedPartner] = useState<TextPartner | null>(null);

  // Instant Chat in Matching Page
  const [chatMessages, setChatMessages] = useState<InstantChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isGiftModalOpen, setIsGiftModalOpen] = useState(false);
  const [isAddingFriend, setIsAddingFriend] = useState(false);
  const [isFriendRequested, setIsFriendRequested] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTargetUser | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isTypingReply, setIsTypingReply] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    const handleOpenReport = (e: any) => {
      if (e.detail?.id) {
        setReportTarget({
          id: e.detail.id,
          displayId: e.detail.displayId || e.detail.id,
          name: e.detail.name,
          avatar: e.detail.avatar,
          email: e.detail.email,
        });
        setIsReportModalOpen(true);
      }
    };
    window.addEventListener('soulx:open-report-user', handleOpenReport);
    return () => window.removeEventListener('soulx:open-report-user', handleOpenReport);
  }, []);

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

  // Format matched partner from queue response and open chat immediately
  const setupMatchedPartner = (partnerData: any, sessionId: string, costToDeduct?: number) => {
    const formattedPartner: TextPartner = {
      id: partnerData.userId || partnerData.id,
      name: partnerData.name,
      gender: (partnerData.gender as Gender) || 'female',
      age: partnerData.age || 25,
      city: { ar: partnerData.city || 'الرياض', en: partnerData.city || 'Riyadh' },
      country: partnerData.country || partnerData.city || '',
      avatar:
        partnerData.avatar ||
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
      matchScore: 98,
      topic: {
        ar: 'توافق مباشر ونقاش راقٍ',
        en: 'Direct match & respectful conversation',
      },
      quote: {
        ar: partnerData.bio || (isAr ? 'عضو متواجد في دور المطابقة' : 'Member in matching queue'),
        en: partnerData.bio || 'Member in matching queue',
      },
      tags: { ar: ['دور المطابقة', 'تواصل مباشر', 'Soul-X'], en: ['Matching Queue', 'Live Match', 'Soul-X'] },
      firstMessage: {
        ar: 'أهلاً بك! تم التوافق والمطابقة بيننا بنجاح ✨',
        en: 'Hello! Matched with you successfully ✨',
      },
    };

    setMatchedPartner(formattedPartner);
    setActiveSessionId(sessionId);

    // Initial greeting from partner in chat
    const initialGreeting: InstantChatMessage = {
      id: `welcome_${Date.now()}`,
      sender: 'them',
      text: formattedPartner.firstMessage[lang] || formattedPartner.firstMessage.ar,
      createdAt: new Date().toISOString(),
      time: new Date().toISOString(),
    };
    setChatMessages([initialGreeting]);

    // فتح شاشة مراسلة المطابقة فوراً دون الحاجة لأي زر متابعة
    const finalCost = typeof costToDeduct === 'number' ? costToDeduct : (committedCost || currentMatchingCost);
    if (finalCost > 0) {
      if (onDeductCoins) {
        onDeductCoins(finalCost);
      }
      const uid = getUserId();
      window.dispatchEvent(
        new CustomEvent('soulx:balance-updated', {
          detail: {
            userId: uid,
            balance: Math.max(0, coinsBalance - finalCost),
            currency: 'coins',
          },
        })
      );
      showToast(
        isAr
          ? `تمت المطابقة وفتح شاشة المراسلة فوراً! (تم خصم ${finalCost.toLocaleString()} كوينز 🪙)`
          : `Matched! Messaging opened directly (${finalCost.toLocaleString()} coins deducted)`
      );
    } else {
      showToast(
        isAr
          ? 'تمت المطابقة وفتح شاشة المراسلة فوراً! 🎉'
          : 'Matched! Messaging opened directly! 🎉'
      );
    }

    // الانتقال لشاشة المحادثة مباشرة
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

  // 1. Start Search: التحقق من رصيد الكوينز أولاً قبل البدء
  const handleStartSearch = async () => {
    const cost = currentMatchingCost;

    // التحقق من الرصيد عند بدء البحث
    if (cost > 0 && coinsBalance < cost) {
      setShowInsufficientModal(true);
      return;
    }

    // تثبيت التكلفة الملتزم بها للخصم عند المطابقة
    setCommittedCost(cost);
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
          avatar: myEffectiveAvatar,
          gender: currentUser?.gender || 'male',
          age: getUserAge(),
          city: 'الرياض',
          country: currentUser?.country || (typeof window !== 'undefined' ? localStorage.getItem('soulx_country') : undefined) || undefined,
          genderPreference: genderFilter,
          agePreference: ageFilter,
          vibePreference: 'all',
        }),
      });

      const data = await res.json();
      if (data.success) {
        if (data.matched && data.partner && data.sessionId) {
          setupMatchedPartner(data.partner, data.sessionId, cost);
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
            showToast(isAr ? 'تم العثور على شريك متوافق! 🎉' : 'Matched partner found! 🎉');
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
  }, [searchState, genderFilter, ageFilter]);

  // 3. تأكيد المطابقة وفتح شاشة المحادثة فورياً مع خصم الرصيد
  const handleConfirmMatchAndOpenChat = () => {
    if (!matchedPartner) return;

    // يتم خصم الرصيد فور تأكيد المطابقة وفتح شاشة المحادثة فقط
    if (committedCost > 0) {
      if (onDeductCoins) {
        onDeductCoins(committedCost);
      }
      const uid = getUserId();
      window.dispatchEvent(
        new CustomEvent('soulx:balance-updated', {
          detail: {
            userId: uid,
            balance: Math.max(0, coinsBalance - committedCost),
            currency: 'coins',
          },
        })
      );
      showToast(
        isAr
          ? `تم تأكيد المطابقة وخصم ${committedCost.toLocaleString()} كوينز 🪙 بنجاح!`
          : `Match confirmed and ${committedCost.toLocaleString()} coins deducted!`
      );
    } else {
      showToast(isAr ? 'تم تأكيد المطابقة المجانية بنجاح! ✨' : 'Free match confirmed! ✨');
    }

    // الانتقال لشاشة المحادثة الفورية
    setSearchState('chat');
  };

  // إلغاء المطابقة من شاشة التأكيد دون أي خصم
  const handleRejectOrCancelMatch = async () => {
    const uid = getUserId();
    const sessionToClose = activeSessionId;

    setActiveSessionId(null);
    setMatchedPartner(null);
    setChatMessages([]);
    setSearchState('idle');

    showToast(isAr ? 'تم إلغاء المطابقة دون خصم أي رصيد من حسابك.' : 'Match cancelled with no coins deducted.');

    if (sessionToClose) {
      try {
        await fetch('/api/matching/session/end', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: sessionToClose,
            userId: uid,
            action: 'decline',
          }),
        });
      } catch {}
    }
  };

  // 4. Live Chat Session Polling: Keeps instant chat in sync between the matched pair
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

        // إذا تم إغلاق الجلسة من قبل الطرف الآخر
        if (data.status === 'ended' || (!data.success && data.status === 'ended')) {
          showToast(isAr ? 'قام الطرف الآخر بإغلاق المحادثة' : 'Partner closed the conversation');
          setActiveSessionId(null);
          setMatchedPartner(null);
          setChatMessages([]);
          setSearchState('idle');
          return;
        }

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
          setChatMessages((prev) => {
            const initialGreeting = prev.find((m) => m.id?.startsWith('welcome_'));
            const baseList =
              initialGreeting && !mapped.some((m) => m.id?.startsWith('welcome_'))
                ? [initialGreeting, ...mapped]
                : mapped;

            // Keep any pending local message from 'me' not yet returned by server
            const pendingLocal = prev.filter((localMsg) => {
              if (localMsg.sender !== 'me') return false;
              const timeLocal = new Date(localMsg.createdAt || localMsg.time || 0).getTime();
              const alreadyInBase = baseList.some(
                (bm) =>
                  bm.id === localMsg.id ||
                  (bm.sender === localMsg.sender &&
                   bm.text === localMsg.text &&
                   Math.abs(new Date(bm.createdAt || bm.time || 0).getTime() - timeLocal) < 15000)
              );
              return !alreadyInBase;
            });

            const merged = [...baseList, ...pendingLocal];
            // Deduplicate to guarantee no identical message appears twice
            const deduped: InstantChatMessage[] = [];
            for (const item of merged) {
              const itemTime = new Date(item.createdAt || item.time || 0).getTime();
              const exists = deduped.some(
                (d) =>
                  d.id === item.id ||
                  (d.sender === item.sender &&
                   d.text === item.text &&
                   Math.abs(new Date(d.createdAt || d.time || 0).getTime() - itemTime) < 15000)
              );
              if (!exists) {
                deduped.push(item);
              }
            }
            return deduped;
          });

          // تزامن رصيد الماسات والكوينز فورياً إذا تم تلقي هدية في الجلسة
          if (typeof data.userDiamonds === 'number') {
            window.dispatchEvent(
              new CustomEvent('soulx:balance-updated', {
                detail: { userId: uid, balance: data.userDiamonds, currency: 'diamonds' },
              })
            );
          }
          if (typeof data.userCoins === 'number') {
            window.dispatchEvent(
              new CustomEvent('soulx:balance-updated', {
                detail: { userId: uid, balance: data.userCoins, currency: 'coins' },
              })
            );
          }
        }
      } catch (err) {
        console.warn('Session messages poll error:', err);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [searchState, activeSessionId, isAr]);

  // Cancel search and leave queue (دون خصم أي رصيد)
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
    showToast(isAr ? 'تم إلغاء البحث دون أي خصم' : 'Search cancelled, no coins deducted');
  };

  // زر إغلاق: يغلق المحادثة لدى الطرفين ويعود بهما إلى صفحة المطابقة
  const handleCloseChat = async () => {
    const uid = getUserId();
    const sessionToClose = activeSessionId;

    setActiveSessionId(null);
    setMatchedPartner(null);
    setChatMessages([]);
    setSearchState('idle');
    showToast(isAr ? 'تم إغلاق المحادثة والعودة لصفحة المطابقة' : 'Chat closed, returned to matching page');

    if (sessionToClose) {
      try {
        await fetch('/api/matching/session/end', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: sessionToClose,
            userId: uid,
            action: 'close',
          }),
        });
      } catch (err) {
        console.warn('Failed to notify server of match session end:', err);
      }
    }
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
          senderAvatar: myEffectiveAvatar,
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

  // Synchronize active chat state with App and Navbar
  useEffect(() => {
    if (searchState === 'chat' && matchedPartner) {
      window.dispatchEvent(
        new CustomEvent('soulx:active-chat-changed', {
          detail: {
            isActive: true,
            chatId: activeSessionId || matchedPartner.id,
            partnerId: matchedPartner.id,
          },
        })
      );
      window.dispatchEvent(
        new CustomEvent('soulx:set-navbar-chat', {
          detail: {
            name: matchedPartner.name,
            avatar: matchedPartner.avatar,
            statusText: isTypingReply
              ? isAr
                ? 'يكتب الآن...'
                : 'typing...'
              : isAr
              ? 'متصل الآن'
              : 'online',
            isOnline: true,
            isTyping: isTypingReply,
            partnerId: matchedPartner.id,
            displayId: matchedPartner.id,
            age: matchedPartner.age,
            country: formatCountryUnified(matchedPartner.country, lang),
            onBack: handleCloseChat,
            onDeleteChat: handleCloseChat,
            onBlock: async () => {
              const myUid = currentUser?.id || currentUser?.displayId || 'user_guest';
              handleCloseChat();
              try {
                await blockUserApi({
                  userId: myUid,
                  targetUserId: matchedPartner.id,
                  targetName: matchedPartner.name,
                  targetAvatar: matchedPartner.avatar,
                  targetDisplayId: matchedPartner.id,
                });
                showToast(isAr ? 'تم حظر المستخدم بنجاح' : 'User blocked successfully');
              } catch (err: any) {
                showToast(isAr ? 'تم حظر المستخدم بنجاح' : 'User blocked successfully');
              }
            },
            onAddFriend: handleAddFriendFromMatch,
            isFriendRequested,
            onReport: () => {
              setReportTarget({
                id: matchedPartner.id,
                displayId: matchedPartner.id,
                name: matchedPartner.name,
                avatar: matchedPartner.avatar,
              });
              setIsReportModalOpen(true);
            },
          },
        })
      );
    } else {
      window.dispatchEvent(
        new CustomEvent('soulx:active-chat-changed', {
          detail: { isActive: false, chatId: null },
        })
      );
      window.dispatchEvent(new CustomEvent('soulx:set-navbar-chat', { detail: null }));
    }

    return () => {
      window.dispatchEvent(
        new CustomEvent('soulx:active-chat-changed', {
          detail: { isActive: false, chatId: null },
        })
      );
      window.dispatchEvent(new CustomEvent('soulx:set-navbar-chat', { detail: null }));
    };
  }, [searchState, matchedPartner, isTypingReply, isFriendRequested, activeSessionId, isAr, lang]);

  // إرسال رسالة في الشات الفوري
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !matchedPartner || isSendingMessage) return;

    const userText = chatInput.trim();
    setChatInput('');
    setIsSendingMessage(true);
    const uid = getUserId();

    const nowUtc = new Date().toISOString();
    const tempId = `m-${Date.now()}`;
    const newMsg: InstantChatMessage = {
      id: tempId,
      sender: 'me',
      text: userText,
      createdAt: nowUtc,
      time: nowUtc,
    };

    setChatMessages((prev) => {
      const isDup = prev.some(
        (m) =>
          m.id === tempId ||
          (m.sender === 'me' &&
           m.text === userText &&
           Math.abs(new Date(m.createdAt || m.time || 0).getTime() - new Date(nowUtc).getTime()) < 10000)
      );
      if (isDup) return prev;
      return [...prev, newMsg];
    });

    // Send to match session endpoint
    if (activeSessionId) {
      try {
        const res = await fetch('/api/matching/session/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: activeSessionId,
            senderId: uid,
            clientMessageId: tempId,
            id: tempId,
            senderName: currentUser?.name || 'مستخدم Soul-X',
            text: userText,
          }),
        });
        const data = await res.json().catch(() => null);
        if (data?.success && data?.message?.id) {
          const confirmedId = data.message.id;
          setChatMessages((prev) =>
            prev.map((m) => (m.id === tempId ? { ...m, id: confirmedId } : m))
          );
        }
      } catch (err) {
        console.warn('Failed to send message to session:', err);
      } finally {
        setIsSendingMessage(false);
      }
    } else {
      setIsSendingMessage(false);
    }
  };

  // إرسال هدية في الشات الفوري
  const handleSendGift = async (gift: GiftItem) => {
    if (!matchedPartner) return;

    if (coinsBalance < gift.cost) {
      showToast(
        isAr
          ? `رصيد الكوينز غير كافٍ! تحتاج إلى ${gift.cost.toLocaleString()} كوينز 🪙`
          : `Insufficient coins! Need ${gift.cost.toLocaleString()} coins 🪙`
      );
      return;
    }

    const uid = getUserId();
    if (onDeductCoins) {
      onDeductCoins(gift.cost);
    }

    // خصم الكوينز فورياً للمرسل
    const newCoins = Math.max(0, coinsBalance - gift.cost);
    window.dispatchEvent(
      new CustomEvent('soulx:balance-updated', {
        detail: { userId: uid, balance: newCoins, currency: 'coins' },
      })
    );

    const giftUtc = new Date().toISOString();
    const tempGiftId = `gift-${Date.now()}`;
    const giftText = `${gift.icon} ${isAr ? gift.nameAr : gift.nameEn}`;

    const giftMsg: InstantChatMessage = {
      id: tempGiftId,
      sender: 'me',
      text: giftText,
      isGift: true,
      giftIcon: gift.icon,
      giftName: isAr ? gift.nameAr : gift.nameEn,
      giftCost: gift.cost,
      createdAt: giftUtc,
      time: giftUtc,
    };

    setChatMessages((prev) => {
      const isDup = prev.some(
        (m) =>
          m.id === tempGiftId ||
          (m.sender === 'me' &&
           m.text === giftText &&
           Math.abs(new Date(m.createdAt || m.time || 0).getTime() - new Date(giftUtc).getTime()) < 10000)
      );
      if (isDup) return prev;
      return [...prev, giftMsg];
    });

    showToast(isAr ? `تم إرسال ${gift.nameAr} بنجاح! 🪙` : `Sent ${gift.nameEn} successfully! 🪙`);

    if (activeSessionId) {
      try {
        const res = await fetch('/api/matching/session/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: activeSessionId,
            senderId: uid,
            clientMessageId: tempGiftId,
            id: tempGiftId,
            senderName: currentUser?.name || 'مستخدم Soul-X',
            text: giftText,
            isGift: true,
            giftIcon: gift.icon,
            giftName: isAr ? gift.nameAr : gift.nameEn,
            giftCost: gift.cost,
          }),
        });
        const data = await res.json().catch(() => null);
        if (data?.success && data?.message?.id) {
          const confirmedId = data.message.id;
          setChatMessages((prev) =>
            prev.map((m) => (m.id === tempGiftId ? { ...m, id: confirmedId } : m))
          );
        }
        if (data?.success && typeof data.senderCoins === 'number') {
          window.dispatchEvent(
            new CustomEvent('soulx:balance-updated', {
              detail: { userId: uid, balance: data.senderCoins, currency: 'coins' },
            })
          );
        } else if (data && !data.success) {
          showToast(isAr ? (data.message || 'فشل إرسال الهدية') : (data.message || 'Failed to send gift'));
          // استرجاع الرصيد في حالة الفشل
          window.dispatchEvent(
            new CustomEvent('soulx:balance-updated', {
              detail: { userId: uid, balance: coinsBalance, currency: 'coins' },
            })
          );
        }
      } catch (err) {
        console.warn('Failed to send gift to session:', err);
      }
    }
  };

  // ========================================================
  // STATE 1: MATCH CONFIRMATION SCREEN (تأكيد المطابقة)
  // يتم خصم الرصيد فور تأكيد المطابقة وفتح شاشة المحادثة فقط
  // ========================================================
  // STATE 1: MATCH SCREEN AUTO-TRANSITION (فتح فوري لشاشة المراسلة)
  // ========================================================
  if (searchState === 'confirm' && matchedPartner) {
    setSearchState('chat');
    return null;
  }

  // ========================================================
  // STATE 2: FULL-SCREEN INSTANT CHAT AFTER MATCHING
  // ========================================================
  if (searchState === 'chat' && matchedPartner) {
    return (
      <div className="fixed top-16 inset-x-0 bottom-0 z-40 flex flex-col overflow-hidden bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 animate-in fade-in duration-200">
        {/* Toast alert - وسط الشاشة */}
        {toastMessage && (
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] px-6 py-4 rounded-3xl bg-neutral-950/95 dark:bg-neutral-900/95 text-white font-black text-xs sm:text-sm shadow-2xl border-2 border-cyan-400 shadow-cyan-500/30 backdrop-blur-xl flex items-center justify-center gap-2.5 text-center max-w-[90vw] animate-in fade-in zoom-in-95 duration-200 pointer-events-none">
            <Sparkles className="w-5 h-5 shrink-0 text-cyan-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Messages Feed Area - ONLY SCROLLABLE AREA */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-6 py-4 space-y-3.5 bg-neutral-100/50 dark:bg-neutral-950/70">
          <div className="max-w-3xl mx-auto w-full space-y-3.5">
            {/* Age & Country card */}
            <div className="flex justify-center my-2">
              <div className="w-full max-w-sm px-4 py-3 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs flex items-center justify-around gap-4 text-center">
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                    {isAr ? 'العمر' : 'Age'}
                  </div>
                  <div className="text-sm sm:text-base font-black text-neutral-900 dark:text-white mt-0.5">
                    {matchedPartner.age} {isAr ? 'سنة' : 'years'}
                  </div>
                </div>
                <div className="w-px h-8 bg-neutral-200 dark:bg-neutral-800" />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                    {isAr ? 'الدولة' : 'Country'}
                  </div>
                  <div className="text-sm sm:text-base font-black text-neutral-900 dark:text-white mt-0.5 truncate">
                    {formatCountryUnified(matchedPartner.country, lang)}
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Action banner inside match chat (Add Friend & Report User) */}
            <div className="flex items-center justify-between gap-2 p-2.5 sm:p-3 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs max-w-sm mx-auto flex-wrap">
              {!isFriendRequested ? (
                <div className="flex items-center gap-2 min-w-0">
                  <UserPlus className="w-4 h-4 text-cyan-500 shrink-0" />
                  <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 truncate">
                    {isAr ? 'صديق جديد' : 'New friend'}
                  </span>
                  <button
                    type="button"
                    disabled={isAddingFriend}
                    onClick={handleAddFriendFromMatch}
                    className="px-2.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-black text-xs cursor-pointer shadow-xs active:scale-95 transition-all shrink-0"
                  >
                    {isAddingFriend ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isAr ? 'إضافة' : 'Add'}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                  <UserCheck className="w-4 h-4" />
                  <span>{isAr ? 'تم إرسال طلب الصداقة' : 'Friend request sent'}</span>
                </div>
              )}

              {/* Direct Report Button on screen */}
              <button
                type="button"
                onClick={() => {
                  setReportTarget({
                    id: matchedPartner.id,
                    displayId: matchedPartner.id,
                    name: matchedPartner.name,
                    avatar: matchedPartner.avatar,
                  });
                  setIsReportModalOpen(true);
                }}
                className="px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors active:scale-95 shrink-0"
                title={isAr ? 'إبلاغ عن هذا المستخدم' : 'Report user'}
              >
                <Flag className="w-3.5 h-3.5" />
                <span>{isAr ? 'إبلاغ' : 'Report'}</span>
              </button>
            </div>

            {/* Messages */}
            {(() => {
              const dedupedMessages: InstantChatMessage[] = [];
              for (const m of chatMessages || []) {
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
                const bubbleAvatar = isMe ? myEffectiveAvatar : matchedPartner.avatar;
                return (
                  <div
                    key={msg.id}
                    className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'} animate-in fade-in slide-in-from-bottom-2 duration-200`}
                  >
                  <img
                    src={bubbleAvatar}
                    alt={isMe ? (currentUser?.name || 'Me') : matchedPartner.name}
                    className="w-7 h-7 rounded-full object-cover border border-neutral-200 dark:border-neutral-800 shrink-0"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = getDefaultAvatar(isMe ? currentUser?.gender : matchedPartner.gender);
                    }}
                  />
                  <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[85%] sm:max-w-[75%]`}>
                    {msg.isGift || getGiftDisplayInfo(msg.text, isAr) ? (
                      (() => {
                        const giftInfo = getGiftDisplayInfo(msg.text, isAr) || {
                          icon: msg.giftIcon || '🎁',
                          name: msg.giftName || (isAr ? 'هدية' : 'Gift'),
                        };
                        return (
                          <div className="flex items-center gap-2.5 py-1 px-1 min-w-0">
                            <span className="text-2xl sm:text-3xl shrink-0 drop-shadow-xs select-none">
                              {giftInfo.icon}
                            </span>
                            <span className="font-black text-sm sm:text-base text-amber-500 dark:text-amber-400 truncate">
                              {giftInfo.name}
                            </span>
                          </div>
                        );
                      })()
                    ) : (
                      <div
                        className={`w-full px-4 py-3 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-xs relative ${
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
                </div>
              );
            });
          })()}

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

        {/* Bottom Input Bar */}
        <div className="p-3 sm:p-4 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md border-t border-neutral-200 dark:border-neutral-800 z-20 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <form
            onSubmit={handleSendMessage}
            className="max-w-3xl mx-auto w-full flex items-center gap-2 sm:gap-3"
          >
            <button
              type="button"
              onClick={() => setIsGiftModalOpen(true)}
              className="px-3.5 py-3 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/30 flex items-center gap-1.5 font-bold text-xs sm:text-sm shrink-0 cursor-pointer active:scale-95 transition-all shadow-xs"
              title={isAr ? 'إرسال هدية' : 'Send Gift'}
            >
              <Gift className="w-5 h-5 text-amber-500" />
              <span className="hidden sm:inline">{isAr ? 'هدية' : 'Gift'}</span>
            </button>

            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={isAr ? 'اكتب رسالة فورية...' : 'Type instant message...'}
              className="flex-1 h-12 px-5 text-xs sm:text-sm rounded-full bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 focus:border-cyan-500 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none transition-colors shadow-inner"
            />

            <button
              type="submit"
              disabled={!chatInput.trim() || isSendingMessage}
              className="w-12 h-12 rounded-full bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 text-neutral-950 font-bold flex items-center justify-center shrink-0 cursor-pointer active:scale-95 transition-all shadow-md"
              title={isAr ? 'إرسال' : 'Send'}
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>

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
      {/* Toast alert - وسط الشاشة */}
      {toastMessage && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] px-6 py-4 rounded-3xl bg-neutral-950/95 dark:bg-neutral-900/95 text-white font-black text-xs sm:text-sm shadow-2xl border-2 border-cyan-400 shadow-cyan-500/30 backdrop-blur-xl flex items-center justify-center gap-2.5 text-center max-w-[90vw] animate-in fade-in zoom-in-95 duration-200 pointer-events-none">
          <Sparkles className="w-5 h-5 shrink-0 text-cyan-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* نافذة تنبيه: الرصيد غير كافٍ */}
      {showInsufficientModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-5 text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/15 text-amber-500 border border-amber-500/30 flex items-center justify-center mx-auto shadow-inner">
              <Coins className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h3 className="text-base sm:text-lg font-black text-neutral-900 dark:text-white">
                {isAr ? 'رصيد الكوينز غير كافٍ' : 'Insufficient Coins Balance'}
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                {isAr
                  ? `رصيدك الحالي هو ${coinsBalance.toLocaleString()} كوينز، بينما تكلفة هذا البحث بالتفضيلات المحددة هي ${currentMatchingCost.toLocaleString()} كوينز.`
                  : `Your current balance is ${coinsBalance.toLocaleString()} Coins, while this search requires ${currentMatchingCost.toLocaleString()} Coins.`}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs space-y-1 font-mono text-start">
              <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                <span>{isAr ? 'تفضيل الجنس المحدد:' : 'Selected Gender:'}</span>
                <span className="font-bold text-neutral-900 dark:text-white">
                  {genderFilter === 'all' ? (isAr ? 'مجاني' : 'Free') : '1,500 🪙'}
                </span>
              </div>
              <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                <span>{isAr ? 'تفضيل العمر المحدد:' : 'Selected Age:'}</span>
                <span className="font-bold text-neutral-900 dark:text-white">
                  {ageFilter === 'all' ? (isAr ? 'مجاني' : 'Free') : '500 🪙'}
                </span>
              </div>
              <div className="flex justify-between text-amber-600 dark:text-amber-400 font-bold pt-1.5 border-t border-neutral-200 dark:border-neutral-800">
                <span>{isAr ? 'إجمالي التكلفة المطلوبة:' : 'Total Cost:'}</span>
                <span>{currentMatchingCost.toLocaleString()} 🪙</span>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              {onOpenWallet && (
                <button
                  type="button"
                  onClick={() => {
                    setShowInsufficientModal(false);
                    onOpenWallet();
                  }}
                  className="w-full py-3 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black text-xs sm:text-sm cursor-pointer shadow-md transition-all active:scale-95"
                >
                  {isAr ? 'شحن رصيد الكوينز من المحفظة' : 'Recharge Coins in Wallet'}
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setGenderFilter('all');
                  setAgeFilter('all');
                  setShowInsufficientModal(false);
                  showToast(isAr ? 'تم ضبط الخيارات على (الكل) للبحث المجاني ✨' : 'Set to (All) for free search ✨');
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 text-xs font-bold cursor-pointer transition-colors"
              >
                {isAr ? 'اختيار (الكل) للمطابقة المجانية' : 'Select (All) for Free Match'}
              </button>

              <button
                type="button"
                onClick={() => setShowInsufficientModal(false)}
                className="w-full py-2 text-xs font-semibold text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
              >
                {isAr ? 'إلغاء' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          STATE 3: MATCHMAKING QUEUE (دور المطابقة)
          ======================================================== */}
      {searchState === 'searching' && (
        <div className="w-full p-6 sm:p-10 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex flex-col items-center justify-center text-center space-y-6 animate-in fade-in zoom-in-95 duration-200 shadow-xl relative overflow-hidden">
          <div className="w-48 h-48 bg-cyan-500/10 blur-3xl rounded-full absolute -top-10 -right-10 pointer-events-none" />

          {/* شارة دور المطابقة المباشر */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-xs font-black shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>{isAr ? 'دور المطابقة المباشر نشط' : 'Live Matching Queue Active'}</span>
          </div>

          {/* رادار البحث مع صورة المستخدم الشخصية في المنتصف */}
          <div className="relative flex items-center justify-center w-36 h-36 sm:w-40 sm:h-40 my-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-cyan-400/20 animate-ping opacity-75" />
            <span className="absolute inline-flex h-28 w-28 rounded-full bg-cyan-400/30 animate-pulse" />
            <span className="absolute inline-flex h-20 w-20 rounded-full bg-cyan-400/40" />
            <div className="relative z-10 w-16 h-16 sm:w-18 sm:h-18 rounded-full overflow-hidden border-2 border-cyan-400 shadow-2xl bg-neutral-900">
              <img
                src={myEffectiveAvatar}
                alt="أنت"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = getDefaultAvatar(currentUser?.gender);
                }}
              />
            </div>
          </div>

          <div className="space-y-2 max-w-md">
            <h3 className="text-lg sm:text-xl font-black text-neutral-900 dark:text-white">
              {isAr ? 'أنت الآن في دور المطابقة...' : 'You are in the matching queue...'}
            </h3>
            <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 font-medium leading-relaxed">
              {isAr
                ? 'جاري البحث عن شريك متوافق وفق تفضيلاتك'
                : 'Searching for a partner matching your preferences'}
            </p>
            {committedCost > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold font-mono">
                {isAr
                  ? `التكلفة: ${committedCost.toLocaleString()} كوينز (تُخصم فور حدوث المطابقة وفتح شاشة المراسلة مباشرة)`
                  : `Cost: ${committedCost.toLocaleString()} Coins (deducted immediately upon match and opening chat)`}
              </p>
            )}
          </div>

          <div className="w-full max-w-sm pt-1 space-y-2.5">
            <button
              type="button"
              onClick={handleCancelSearch}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-neutral-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors cursor-pointer"
            >
              {isAr ? 'إلغاء والانسحاب من الدور (دون أي خصم)' : 'Cancel & Leave Queue (No deduction)'}
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          STATE 4: EMPTY MATCH STATE
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
                : 'Waiting for other members to join the matching queue.'}
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
          STATE 0: IDLE VIEW (PREFERENCES & START BUTTON)
          (تم حذف نمط التواصل والتوافق بالكامل)
          ======================================================== */}
      {searchState === 'idle' && (
        <div className="w-full space-y-4">
          {/* User Profile Card in Matching */}
          <div className="flex items-center gap-3.5 p-3.5 sm:p-4 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm">
            <div className="relative shrink-0">
              <img
                src={myEffectiveAvatar}
                alt={currentUser?.name || 'أنت'}
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover border-2 border-cyan-500/50 shadow-xs"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = getDefaultAvatar(currentUser?.gender);
                }}
              />
              <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-neutral-900 absolute bottom-0 right-0" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-sm sm:text-base text-neutral-900 dark:text-white truncate">
                  {currentUser?.name || (isAr ? 'حسابك في المطابقة' : 'Your Profile')}
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-bold">
                  {isAr ? 'صورتك في المطابقة' : 'Your Matching Picture'}
                </span>
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">
                {isAr
                  ? 'صورة ملفك الشخصي المعتمدة التي تظهر للشركاء المتوافقين'
                  : 'Your verified profile picture shown to matching partners'}
              </p>
            </div>
          </div>

          <div className="p-5 sm:p-7 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-5 relative overflow-hidden">
            <div className="w-32 h-32 bg-cyan-500/10 blur-2xl rounded-full absolute -top-8 -right-8 pointer-events-none" />

            {/* Header: Title */}
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
                    {isAr ? 'حدد مواصفات الشريك الذي تبحث عنه' : 'Set your partner preferences'}
                  </p>
                </div>
              </div>

              {/* رصيد الكوينز المتوفر */}
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-400 text-xs font-mono font-bold">
                <CoinIcon className="w-3.5 h-3.5" />
                <span>{coinsBalance.toLocaleString()}</span>
              </div>
            </div>

            {/* 1. تفضيل الجنس (تحديد جنس معين = 1,500 Coins، الكل = مجاني) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-cyan-500" />
                  <span>{isAr ? 'الجنس المفضل' : 'Gender Preference'}</span>
                </label>
                <span className="text-[11px] text-neutral-400 font-mono">
                  {genderFilter === 'all'
                    ? (isAr ? 'مجاناً' : 'Free')
                    : '1,500 🪙'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {/* خيار الكل: مجاني تماماً */}
                <button
                  type="button"
                  onClick={() => setGenderFilter('all')}
                  className={`py-2.5 px-3 rounded-2xl text-xs font-bold transition-all cursor-pointer border flex flex-col items-center justify-center gap-0.5 ${
                    genderFilter === 'all'
                      ? 'bg-cyan-500 text-neutral-950 border-cyan-500 shadow-sm font-black'
                      : 'bg-neutral-50 dark:bg-neutral-950/70 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-700'
                  }`}
                >
                  <span>{isAr ? 'الكل' : 'All'}</span>
                  <span className={`text-[10px] ${genderFilter === 'all' ? 'text-neutral-950/80 font-bold' : 'text-emerald-500'}`}>
                    {isAr ? 'مجاناً' : 'Free'}
                  </span>
                </button>

                {/* إناث فقط: 1,500 Coins */}
                <button
                  type="button"
                  onClick={() => setGenderFilter('female')}
                  className={`py-2.5 px-3 rounded-2xl text-xs font-bold transition-all cursor-pointer border flex flex-col items-center justify-center gap-0.5 ${
                    genderFilter === 'female'
                      ? 'bg-rose-500 text-white border-rose-500 shadow-sm font-black'
                      : 'bg-neutral-50 dark:bg-neutral-950/70 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-700'
                  }`}
                >
                  <span>{isAr ? 'إناث فقط' : 'Females only'}</span>
                  <span className={`text-[10px] font-mono ${genderFilter === 'female' ? 'text-white/90 font-bold' : 'text-amber-500'}`}>
                    1,500 🪙
                  </span>
                </button>

                {/* ذكور فقط: 1,500 Coins */}
                <button
                  type="button"
                  onClick={() => setGenderFilter('male')}
                  className={`py-2.5 px-3 rounded-2xl text-xs font-bold transition-all cursor-pointer border flex flex-col items-center justify-center gap-0.5 ${
                    genderFilter === 'male'
                      ? 'bg-sky-500 text-white border-sky-500 shadow-sm font-black'
                      : 'bg-neutral-50 dark:bg-neutral-950/70 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-700'
                  }`}
                >
                  <span>{isAr ? 'ذكور فقط' : 'Males only'}</span>
                  <span className={`text-[10px] font-mono ${genderFilter === 'male' ? 'text-white/90 font-bold' : 'text-amber-500'}`}>
                    1,500 🪙
                  </span>
                </button>
              </div>
            </div>

            {/* 2. الفئة العمرية (تحديد فئة عمرية محددة = 500 Coins، الكل = مجاني) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-cyan-500" />
                  <span>{isAr ? 'الفئة العمرية' : 'Age Range'}</span>
                </label>
                <span className="text-[11px] text-neutral-400 font-mono">
                  {ageFilter === 'all'
                    ? (isAr ? 'مجاناً' : 'Free')
                    : '500 🪙'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'all', labelAr: 'الكل', labelEn: 'All', cost: 0 },
                  { id: '18-25', labelAr: '18 - 25', labelEn: '18 - 25', cost: 500 },
                  { id: '26-35', labelAr: '26 - 35', labelEn: '26 - 35', cost: 500 },
                  { id: '36+', labelAr: '+36', labelEn: '36+', cost: 500 },
                ].map((item) => {
                  const isSelected = ageFilter === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setAgeFilter(item.id as any)}
                      className={`py-2 px-2 text-center rounded-2xl text-xs font-bold transition-all cursor-pointer border flex flex-col items-center justify-center gap-0.5 ${
                        isSelected
                          ? 'bg-cyan-500 text-neutral-950 border-cyan-500 shadow-sm font-black'
                          : 'bg-neutral-50 dark:bg-neutral-950/70 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-700'
                      }`}
                    >
                      <span>{isAr ? item.labelAr : item.labelEn}</span>
                      <span className={`text-[10px] font-mono ${isSelected ? 'text-neutral-950/80 font-bold' : item.cost === 0 ? 'text-emerald-500' : 'text-amber-500'}`}>
                        {item.cost === 0 ? (isAr ? 'مجاناً' : 'Free') : `${item.cost} 🪙`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* تفصيل التكلفة وتنويه الخصم عند تأكيد المطابقة فقط */}
            <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <div className="font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>
                    {currentMatchingCost === 0
                      ? isAr
                        ? 'مطابقة مجانية تماماً'
                        : 'Completely Free Match'
                      : isAr
                      ? `تكلفة البحث: ${currentMatchingCost.toLocaleString()} كوينز`
                      : `Search Cost: ${currentMatchingCost.toLocaleString()} Coins`}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  {isAr
                    ? 'يتم الخصم فور نجاح المطابقة وفتح شاشة المراسلة مباشرة.'
                    : 'Coins are deducted upon successful match and opening chat directly.'}
                </p>
              </div>

              {currentMatchingCost > 0 ? (
                <span className="font-mono font-black text-amber-600 dark:text-amber-400 text-sm inline-flex items-center gap-1 shrink-0">
                  <span>{currentMatchingCost.toLocaleString()}</span>
                  <CoinIcon className="w-4 h-4" />
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-500/20 shrink-0">
                  {isAr ? 'مجاناً' : 'Free'}
                </span>
              )}
            </div>
          </div>

          {/* زر بدء البحث */}
          <button
            type="button"
            onClick={handleStartSearch}
            className={`w-full py-4 px-6 rounded-2xl font-black text-sm sm:text-base tracking-wide shadow-lg transition-all cursor-pointer active:scale-98 flex items-center justify-center gap-2 ${
              currentMatchingCost > 0
                ? 'bg-amber-400 hover:bg-amber-300 text-neutral-950 shadow-amber-500/20'
                : 'bg-cyan-400 hover:bg-cyan-300 text-neutral-950 shadow-cyan-500/20'
            }`}
          >
            <Sparkles className="w-5 h-5" />
            <span className="inline-flex items-center gap-1.5">
              <span>{isAr ? 'بدء البحث' : 'Start Search'}</span>
              {currentMatchingCost > 0 ? (
                <span className="inline-flex items-center gap-1 text-xs sm:text-sm font-mono opacity-90">
                  <span>({currentMatchingCost.toLocaleString()}</span>
                  <CoinIcon className="w-4 h-4" />
                  <span>)</span>
                </span>
              ) : (
                <span className="text-xs sm:text-sm opacity-90">({isAr ? 'مجاناً' : 'Free'})</span>
              )}
            </span>
          </button>
        </div>
      )}

      {/* Reusable Report User Modal for Matching */}
      <ReportUserModal
        isOpen={isReportModalOpen}
        onClose={() => {
          setIsReportModalOpen(false);
          setReportTarget(null);
        }}
        lang={lang}
        currentUser={currentUser}
        targetUser={reportTarget}
        source="matching"
        onSuccess={() => {
          showToast(isAr ? 'تم إرسال بلاغك للإدارة بنجاح' : 'Report submitted successfully');
        }}
      />
    </div>
  );
};
