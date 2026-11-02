import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  MessageSquare,
  Filter,
  CheckCircle2,
  RefreshCw,
  MessageCircle,
  Users,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Language, Gender } from '../types';

interface MatchingViewProps {
  lang: Language;
  onGoToChat: () => void;
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

export const MatchingView: React.FC<MatchingViewProps> = ({ lang, onGoToChat }) => {
  const isAr = lang === 'ar';

  // Search State: 'idle' | 'searching' | 'matched' | 'empty'
  const [searchState, setSearchState] = useState<'idle' | 'searching' | 'matched' | 'empty'>('idle');

  // Filters
  const [genderFilter, setGenderFilter] = useState<'all' | 'female' | 'male'>('all');

  // Search step text animation
  const [searchStepText, setSearchStepText] = useState('');
  const [matchedPartner, setMatchedPartner] = useState<TextPartner | null>(null);
  const [partnerIndex, setPartnerIndex] = useState(0);

  // Real registered users pool from database
  const [dbUsers, setDbUsers] = useState<any[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);

  const loadRealUsers = async () => {
    setIsLoadingUsers(true);
    setUsersError(null);
    let currentUid = '';
    if (typeof window !== 'undefined') {
      try {
        const u = JSON.parse(localStorage.getItem('soulx_auth_user') || '{}');
        if (u?.id) currentUid = u.id;
      } catch {}
    }

    try {
      const res = await fetch(`/api/users/search?q=&currentUserId=${encodeURIComponent(currentUid)}`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.users)) {
        setDbUsers(data.users);
      } else {
        throw new Error(data.message || 'Failed to fetch users');
      }
    } catch (err: any) {
      setUsersError(
        isAr
          ? 'تعذر الاتصال بقاعدة البيانات لجلب المستخدمين المسجلين للمطابقة.'
          : 'Failed to connect to database for matching candidates.'
      );
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    loadRealUsers();
  }, []);

  // Start matching
  const handleStartSearch = () => {
    setSearchState('searching');
    setMatchedPartner(null);

    const steps = isAr
      ? [
          'جاري مسح الحسابات المسجلة في قاعدة البيانات...',
          'فحص التوافق اللغوي والنصي...',
          'مطابقة الاهتمامات وتفضيل الجنس...',
          'تم الانتهاء من فحص قاعدة البيانات!',
        ]
      : [
          'Scanning registered database accounts...',
          'Checking compatibility & language...',
          'Matching mutual topics & gender preferences...',
          'Finished scanning database!',
        ];

    let currentStep = 0;
    setSearchStepText(steps[0]);

    const interval = setInterval(() => {
      currentStep++;
      if (currentStep < steps.length) {
        setSearchStepText(steps[currentStep]);
      } else {
        clearInterval(interval);

        let candidatePool: TextPartner[] = [];

        if (dbUsers.length > 0) {
          const filteredDb = dbUsers.filter((u) => {
            if (genderFilter === 'all') return true;
            return u.gender === genderFilter;
          });
          const source = filteredDb.length > 0 ? filteredDb : [];
          candidatePool = source.map((u) => ({
            id: u.id,
            name: u.name,
            gender: (u.gender as Gender) || 'female',
            age: u.age || 25,
            city: { ar: u.location || 'الرياض', en: u.location || 'Riyadh' },
            avatar:
              u.avatar ||
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
            matchScore: u.matchScore || 96,
            topic: { ar: 'حوار هادئ ونقاش روحي عميق', en: 'Deep calm discussion' },
            quote: { ar: u.bio || 'مستخدم مسجل في Soul-X', en: u.bio || 'Registered Soul-X member' },
            tags: { ar: ['تواصل حقيقي', 'تفاهم متبادل', 'Soul-X'], en: ['True Connection', 'Soul-X'] },
            firstMessage: {
              ar: 'أهلاً بك! يسعدني بدء الحديث والتواصل معك عبر Soul-X ✨',
              en: 'Hello! Happy to connect with you via Soul-X ✨',
            },
          }));
        }

        if (candidatePool.length === 0) {
          setMatchedPartner(null);
          setSearchState('empty');
          return;
        }

        const selectedPartner = candidatePool[partnerIndex % candidatePool.length];
        setMatchedPartner(selectedPartner);
        setPartnerIndex((prev) => prev + 1);
        setSearchState('matched');
      }
    }, 800);
  };

  // Cancel search
  const handleCancelSearch = () => {
    setSearchState('idle');
  };

  // Connect & jump to chat
  const handleConnectChat = (partner: TextPartner) => {
    let currentUid = '549182301';
    if (typeof window !== 'undefined') {
      try {
        const u = JSON.parse(localStorage.getItem('soulx_auth_user') || '{}');
        if (u?.id) currentUid = u.id;
      } catch {}
    }

    fetch('/api/messages/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        senderId: currentUid,
        recipientId: partner.id,
        text: partner.firstMessage[lang],
      }),
    }).catch(() => {});

    if (typeof window !== 'undefined') {
      const newChatData = {
        id: `chat-match-${partner.id}`,
        name: partner.name,
        avatar: partner.avatar,
        status: 'online',
        lastMessage: partner.firstMessage[lang],
        time: isAr ? 'الآن' : 'Just now',
        unreadCount: 1,
        messages: [
          {
            id: `m-${Date.now()}`,
            sender: 'them',
            text: partner.firstMessage[lang],
            time: isAr ? 'الآن' : 'Just now',
          },
        ],
      };
      localStorage.setItem('soulx_new_match_chat', JSON.stringify(newChatData));
      localStorage.setItem('soulx_open_chat_id', newChatData.id);
    }
    onGoToChat();
  };

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col items-center py-4 px-2 sm:px-4 animate-in fade-in duration-300">
      {/* ---------------- STATE 1: SEARCHING RADAR ANIMATION ---------------- */}
      {searchState === 'searching' && (
        <div className="w-full p-8 sm:p-12 rounded-3xl bg-white dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-800 flex flex-col items-center justify-center text-center space-y-6 animate-in fade-in zoom-in-95 duration-200 shadow-lg">
          {/* Animated radar rings */}
          <div className="relative flex items-center justify-center w-36 h-36">
            <span className="absolute inline-flex h-full w-full rounded-full bg-cyan-400/20 animate-ping opacity-75" />
            <span className="absolute inline-flex h-24 w-24 rounded-full bg-cyan-400/30 animate-pulse" />
            <div className="relative z-10 w-16 h-16 rounded-2xl bg-cyan-500 text-neutral-950 flex items-center justify-center shadow-xl">
              <Sparkles className="w-8 h-8 animate-spin" />
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg sm:text-xl font-black text-neutral-900 dark:text-white">
              {isAr ? 'جاري البحث عن شريك متوافق...' : 'Searching for a resonant partner...'}
            </h3>
            <p className="text-xs text-cyan-600 dark:text-cyan-400 font-mono tracking-wide h-5">
              {searchStepText}
            </p>
          </div>

          <button
            type="button"
            onClick={handleCancelSearch}
            className="px-6 py-2 rounded-xl text-xs font-semibold text-neutral-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors cursor-pointer"
          >
            {isAr ? 'إلغاء البحث' : 'Cancel Search'}
          </button>
        </div>
      )}

      {/* ---------------- STATE 2: MATCH FOUND CARD ---------------- */}
      {searchState === 'matched' && matchedPartner && (
        <div className="w-full bg-white dark:bg-neutral-900 border border-cyan-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300 relative overflow-hidden">
          {/* Ambient cyan corner glow */}
          <div className="w-48 h-48 bg-cyan-500/10 blur-3xl rounded-full absolute -top-10 -right-10 pointer-events-none" />

          {/* Top Bar with Match Score */}
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>
                {isAr
                  ? `نسبة التوافق: ${matchedPartner.matchScore}%`
                  : `Compatibility: ${matchedPartner.matchScore}%`}
              </span>
            </div>

            <span className="text-[11px] font-mono text-neutral-400">
              {matchedPartner.city[lang]}
            </span>
          </div>

          {/* Partner Info */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
            <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-cyan-500/30 shrink-0 shadow-md">
              <img
                src={matchedPartner.avatar}
                alt={matchedPartner.name}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="text-center sm:text-start space-y-1 flex-1">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h3 className="text-xl font-black text-neutral-900 dark:text-white">
                  {matchedPartner.name}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                  {matchedPartner.gender === 'female'
                    ? isAr
                      ? `أنثى، ${matchedPartner.age} سنة`
                      : `Female, ${matchedPartner.age}`
                    : isAr
                    ? `ذكر، ${matchedPartner.age} سنة`
                    : `Male, ${matchedPartner.age}`}
                </span>
              </div>

              <p className="text-xs text-cyan-600 dark:text-cyan-400 font-medium">
                {matchedPartner.topic[lang]}
              </p>

              {/* Quote */}
              <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950/70 border border-neutral-200 dark:border-neutral-800/80 mt-2">
                <p className="text-xs text-neutral-700 dark:text-neutral-300 italic leading-relaxed">
                  "{matchedPartner.quote[lang]}"
                </p>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1.5 pt-2">
                {matchedPartner.tags[lang].map((tag, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => handleConnectChat(matchedPartner)}
              className="flex-1 py-3 px-5 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md active:scale-98"
            >
              <MessageSquare className="w-4 h-4" />
              <span>{isAr ? 'بدء المحادثة الآن' : 'Start Chat Now'}</span>
            </button>

            <button
              type="button"
              onClick={handleStartSearch}
              className="py-3 px-4 rounded-2xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-neutral-200 dark:border-neutral-700"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{isAr ? 'بحث عن شريك آخر' : 'Find Another'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ---------------- STATE 3: EMPTY MATCH STATE (NO REAL USERS FOUND) ---------------- */}
      {searchState === 'empty' && (
        <div className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-xl text-center space-y-5 animate-in fade-in duration-300">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mx-auto shadow-inner">
            <Users className="w-8 h-8" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-lg sm:text-xl font-black text-neutral-900 dark:text-white">
              {isAr ? 'لا يوجد مستخدمون مطابقون حالياً في قاعدة البيانات' : 'No matching users currently in database'}
            </h3>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto leading-relaxed">
              {isAr
                ? 'لم نجد حسابات مسجلة تطابق التفضيلات المحددة في قاعدة البيانات حالياً. يمكنك تعديل فلتر الجنس وإعادة المحاولة.'
                : 'No users found matching your selected filters in the database. You can adjust gender filter and try again.'}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => {
                setGenderFilter('all');
                handleStartSearch();
              }}
              className="w-full sm:w-auto py-2.5 px-5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-bold text-xs cursor-pointer shadow-sm transition-all active:scale-95"
            >
              {isAr ? 'مطابقة للجميع (ذكر وأنثى)' : 'Match Anyone (All)'}
            </button>
            <button
              type="button"
              onClick={() => setSearchState('idle')}
              className="w-full sm:w-auto py-2.5 px-4 rounded-xl text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 text-xs font-semibold cursor-pointer"
            >
              {isAr ? 'العودة' : 'Back'}
            </button>
          </div>
        </div>
      )}

      {/* ---------------- STATE 0: IDLE VIEW ---------------- */}
      {searchState === 'idle' && (
        <div className="w-full space-y-4">
          {/* الكارد العلوي (The Upper Matching Card) */}
          <div className="p-7 sm:p-9 rounded-3xl bg-gradient-to-b from-neutral-100 to-white dark:from-neutral-900 dark:to-neutral-950 border border-neutral-200 dark:border-neutral-800/80 flex flex-col items-center justify-center text-center space-y-4 shadow-sm relative overflow-hidden">
            <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shadow-inner">
              <MessageCircle className="w-8 h-8" />
            </div>

            {/* حالة تحميل قاعدة البيانات أو الأخطاء */}
            {isLoadingUsers ? (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-xs font-medium">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{isAr ? 'جاري الاتصال بقاعدة بيانات المستخدمين...' : 'Connecting to users database...'}</span>
              </div>
            ) : usersError ? (
              <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs max-w-sm flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-start">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{usersError}</span>
                </div>
                <button
                  type="button"
                  onClick={loadRealUsers}
                  className="px-2.5 py-1 rounded-lg bg-rose-500 text-white font-bold text-[11px] shrink-0 cursor-pointer"
                >
                  {isAr ? 'إعادة' : 'Retry'}
                </button>
              </div>
            ) : dbUsers.length > 0 ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>
                  {isAr
                    ? `${dbUsers.length} مستخدم مسجل متاح في قاعدة البيانات`
                    : `${dbUsers.length} registered users available in database`}
                </span>
              </div>
            ) : null}

            <button
              type="button"
              onClick={handleStartSearch}
              className="w-full max-w-sm py-4 px-6 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-black text-sm tracking-wide shadow-lg shadow-cyan-500/20 transition-all cursor-pointer active:scale-98 flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isAr ? 'ابدأ البحث الآن' : 'Start Matching Now'}</span>
            </button>
          </div>

          {/* كارد تفضيلات التطابق (Matching Preferences Card) */}
          <div className="p-4 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-3 shadow-xs">
            <div className="flex items-center justify-between text-xs font-bold text-neutral-800 dark:text-neutral-200">
              <span className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-cyan-500" />
                <span>{isAr ? 'تفضيلات التطابق' : 'Matching Preferences'}</span>
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setGenderFilter('all')}
                className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                  genderFilter === 'all'
                    ? 'bg-cyan-500/10 border-cyan-500 text-cyan-600 dark:text-cyan-400 font-bold'
                    : 'bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400'
                }`}
              >
                {isAr ? 'الكل' : 'All'}
              </button>

              <button
                type="button"
                onClick={() => setGenderFilter('female')}
                className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                  genderFilter === 'female'
                    ? 'bg-rose-500/10 border-rose-500 text-rose-600 dark:text-rose-400 font-bold'
                    : 'bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400'
                }`}
              >
                {isAr ? 'إناث فقط' : 'Females only'}
              </button>

              <button
                type="button"
                onClick={() => setGenderFilter('male')}
                className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                  genderFilter === 'male'
                    ? 'bg-cyan-500/10 border-cyan-500 text-cyan-600 dark:text-cyan-400 font-bold'
                    : 'bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400'
                }`}
              >
                {isAr ? 'ذكور فقط' : 'Males only'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
