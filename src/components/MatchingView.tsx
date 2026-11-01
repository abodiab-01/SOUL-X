import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Send,
  MessageSquare,
  Search,
  Filter,
  CheckCircle2,
  RefreshCw,
  Users,
  Compass,
  ArrowRight,
  ArrowLeft,
  X,
  Flame,
  Radio,
  FileText,
  MessageCircle,
  Clock,
  Shuffle,
  ShieldCheck,
  Check,
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

interface SoulLetter {
  id: string;
  authorName: string;
  gender: Gender;
  age: number;
  city: { ar: string; en: string };
  text: { ar: string; en: string };
  category: { ar: string; en: string };
  time: string;
}

// Pool of text-matched souls for realistic matching simulation
const POOL_OF_PARTNERS: TextPartner[] = [
  {
    id: 'partner-1',
    name: 'سارة العتيبي',
    gender: 'female',
    age: 24,
    city: { ar: 'الرياض', en: 'Riyadh' },
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
    matchScore: 97,
    topic: {
      ar: 'أحاديث فكرية هادئة وفلسفة الحياة',
      en: 'Deep intellectual chats & life philosophy',
    },
    quote: {
      ar: 'أؤمن أن الكلمات الصادقة هي أقصر طريق يربط بين روحين دون تكلف.',
      en: 'I believe honest words are the shortest bridge between two souls.',
    },
    tags: {
      ar: ['نقاش هادئ', 'كتب وقراءة', 'قهوة مختصة', 'أحاديث عميقة'],
      en: ['Calm chat', 'Books & Reading', 'Specialty Coffee', 'Deep Talks'],
    },
    firstMessage: {
      ar: 'أهلاً بك! لفتني توافق أفكارنا النصية، يسعدني الحديث معك ✨',
      en: 'Hello! I noticed our thoughts resonate, happy to connect ✨',
    },
  },
  {
    id: 'partner-2',
    name: 'فيصل الشمري',
    gender: 'male',
    age: 27,
    city: { ar: 'جدة', en: 'Jeddah' },
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    matchScore: 94,
    topic: {
      ar: 'شغف السفر، الطبيعة والفضفضة الصادقة',
      en: 'Travel passion, nature & authentic sharing',
    },
    quote: {
      ar: 'الحياة أهدأ بكثير حين نجد شخصاً نستطيع التحدث معه بكل عفوية وصدق.',
      en: 'Life feels much calmer when you find someone to speak with without masks.',
    },
    tags: {
      ar: ['سفر وتصوير', 'بودكاست', 'عفوية', 'تفاهم متبادل'],
      en: ['Travel & Photography', 'Podcasts', 'Spontaneity', 'Mutual Understanding'],
    },
    firstMessage: {
      ar: 'مساء الخير، جميل أن نلتقي هنا عبر التوافق النصي. كيف كان يومك؟',
      en: 'Good evening! Wonderful to meet via text matching. How has your day been?',
    },
  },
  {
    id: 'partner-3',
    name: 'دانية الشهري',
    gender: 'female',
    age: 23,
    city: { ar: 'الدمام', en: 'Dammam' },
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    matchScore: 96,
    topic: {
      ar: 'تطوير الذات، الفن والموسيقى الهادئة',
      en: 'Self-growth, art & calm melodies',
    },
    quote: {
      ar: 'الجمال الحقيقي يبدأ من نقاء الفكرة وعمق الحوار.',
      en: 'True beauty starts with pure thought and genuine depth.',
    },
    tags: {
      ar: ['موسيقى هادئة', 'تطوير ذات', 'فن تشكيلي', 'إيجابية'],
      en: ['Ambient Music', 'Personal Growth', 'Visual Arts', 'Positive Vibe'],
    },
    firstMessage: {
      ar: 'مرحباً! توافق جميل في الاهتمامات. ما هو الموضوع المفضل لديك للنقاش؟',
      en: 'Hi! Lovely match in interests. What is your favorite topic to talk about?',
    },
  },
  {
    id: 'partner-4',
    name: 'سعود الحربي',
    gender: 'male',
    age: 26,
    city: { ar: 'الرياض', en: 'Riyadh' },
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    matchScore: 92,
    topic: {
      ar: 'طموح العمل والمشاريع والضحك العفوي',
      en: 'Ambition, projects & lighthearted laughter',
    },
    quote: {
      ar: 'خير جليس في هذا العصر شخص تسمع منه فكرة ملهمة أو ضحكة صادقة.',
      en: 'The best company is someone who brings you an inspiring idea or sincere laugh.',
    },
    tags: {
      ar: ['ريادة وطموح', 'حوار ذكي', 'مرح', 'نقاش مفتوح'],
      en: ['Ambition', 'Smart Talk', 'Humor', 'Open Dialogue'],
    },
    firstMessage: {
      ar: 'أهلاً! يسعدني بدء الحديث معك عبر المطابقة النصية لـ Soul-X.',
      en: 'Hello! Excited to chat with you via Soul-X text matching.',
    },
  },
];

// Pre-configured Soul Letters for community reading & reply
const INITIAL_SOUL_LETTERS: SoulLetter[] = [
  {
    id: 'letter-1',
    authorName: 'روح هادئة',
    gender: 'female',
    age: 24,
    city: { ar: 'الرياض', en: 'Riyadh' },
    text: {
      ar: 'أبحث عن محادثة تشبه الجلوس أمام نافذة المطر: هادئة، دافئة، وصادقة دون أي تصنّع. هل ما زال الحوار العميق ممكناً؟',
      en: 'Looking for a conversation like sitting by a rainy window: calm, warm, and true without any masks.',
    },
    category: { ar: 'أحاديث عميقة', en: 'Deep Talk' },
    time: 'قبل 5 دقائق',
  },
  {
    id: 'letter-2',
    authorName: 'مسافر فكري',
    gender: 'male',
    age: 28,
    city: { ar: 'جدة', en: 'Jeddah' },
    text: {
      ar: 'أكبر متعة في الحياة هي اكتشاف طريقة تفكير شخص آخر ورؤية العالم من زاويته. ما هو الكتاب أو الموقف الذي غيّر نظرتك للحياة؟',
      en: 'The greatest joy is discovering someone else’s perspective. What book or experience changed your view on life?',
    },
    category: { ar: 'فكر وتأمل', en: 'Philosophy' },
    time: 'قبل 18 دقيقة',
  },
  {
    id: 'letter-3',
    authorName: 'نجمة المساء',
    gender: 'female',
    age: 22,
    city: { ar: 'دبي', en: 'Dubai' },
    text: {
      ar: 'أحياناً نحتاج فقط لشخص يستمع دون أن يحكم، يشاطرنا أفكار المساء البسيطة وعشقه للقهوة والموسيقى الهادئة.',
      en: 'Sometimes we just need a non-judgmental ear to share evening thoughts, coffee passion, and calm melodies.',
    },
    category: { ar: 'فضفضة واستماع', en: 'Comfort & Listening' },
    time: 'قبل 34 دقيقة',
  },
];

export const MatchingView: React.FC<MatchingViewProps> = ({ lang, onGoToChat }) => {
  const isAr = lang === 'ar';

  // Modes: 'instant' (فوري) | 'topics' (بالموضوع) | 'letters' (رسائل الأرواح)
  const [matchingMode, setMatchingMode] = useState<'instant' | 'topics' | 'letters'>('instant');

  // Search State: 'idle' | 'searching' | 'matched'
  const [searchState, setSearchState] = useState<'idle' | 'searching' | 'matched'>('idle');

  // Filters
  const [genderFilter, setGenderFilter] = useState<'all' | 'female' | 'male'>('all');
  const [selectedVibe, setSelectedVibe] = useState<string>('deep');

  // Topic input state
  const [customTopic, setCustomTopic] = useState('');
  const [selectedPresetTopic, setSelectedPresetTopic] = useState<string>('أحاديث هادئة وفلسفة');

  // Search step text animation
  const [searchStepText, setSearchStepText] = useState('');
  const [matchedPartner, setMatchedPartner] = useState<TextPartner | null>(null);
  const [partnerIndex, setPartnerIndex] = useState(0);

  // Soul Letters State
  const [letters, setLetters] = useState<SoulLetter[]>(INITIAL_SOUL_LETTERS);
  const [newLetterText, setNewLetterText] = useState('');
  const [isPublishingLetter, setIsPublishingLetter] = useState(false);
  const [letterSentSuccess, setLetterSentSuccess] = useState(false);

  // Preset topics
  const presetTopics = [
    { id: '1', ar: 'أحاديث هادئة وفلسفة الحياة', en: 'Calm talks & philosophy' },
    { id: '2', ar: 'فضفضة واستماع بدون أحكام', en: 'Listening & gentle sharing' },
    { id: '3', ar: 'شغف السفر واكتشاف العالم', en: 'Travel & world discovery' },
    { id: '4', ar: 'تطوير الذات وبناء الطموح', en: 'Self-growth & ambition' },
    { id: '5', ar: 'كتب، سينما وموسيقى دافئة', en: 'Books, cinema & warm music' },
    { id: '6', ar: 'علاقة جادة وتوافق روحي صادق', en: 'Serious bond & soul resonance' },
  ];

  // Start instant text matching
  const handleStartSearch = () => {
    setSearchState('searching');
    setMatchedPartner(null);

    const steps = isAr
      ? [
          'جاري مسح الأرواح المتصلة حالياً...',
          'فحص التوافق اللغوي والنصي...',
          'مطابقة الاهتمامات المشتركة والمزاج...',
          'تم العثور على شريك متوافق نصياً بنجاح!',
        ]
      : [
          'Scanning currently active souls...',
          'Checking text resonance & language...',
          'Matching mutual topics & vibe...',
          'Soul matched successfully!',
        ];

    let currentStep = 0;
    setSearchStepText(steps[0]);

    const interval = setInterval(() => {
      currentStep++;
      if (currentStep < steps.length) {
        setSearchStepText(steps[currentStep]);
      } else {
        clearInterval(interval);
        // Select next partner matching gender filter if possible
        const filtered = POOL_OF_PARTNERS.filter((p) => {
          if (genderFilter === 'all') return true;
          return p.gender === genderFilter;
        });
        const pool = filtered.length > 0 ? filtered : POOL_OF_PARTNERS;
        const partner = pool[partnerIndex % pool.length];
        setMatchedPartner(partner);
        setPartnerIndex((prev) => prev + 1);
        setSearchState('matched');
      }
    }, 900);
  };

  // Cancel search
  const handleCancelSearch = () => {
    setSearchState('idle');
  };

  // Connect & jump to chat
  const handleConnectChat = (partner: TextPartner) => {
    if (typeof window !== 'undefined') {
      // Store new match to appear in ChatsView
      const newChatData = {
        id: `chat-match-${partner.id}-${Date.now()}`,
        name: partner.name,
        avatar: partner.avatar,
        status: 'online',
        lastMessage: partner.firstMessage[lang],
        time: 'Just now',
        unreadCount: 1,
        messages: [
          {
            id: `m-${Date.now()}`,
            sender: 'them',
            text: partner.firstMessage[lang],
            time: 'Just now',
          },
        ],
      };
      localStorage.setItem('soulx_new_match_chat', JSON.stringify(newChatData));
      localStorage.setItem('soulx_open_chat_id', newChatData.id);
    }
    onGoToChat();
  };

  // Publish a new Soul Letter
  const handlePublishLetter = () => {
    if (!newLetterText.trim()) return;
    const newLetter: SoulLetter = {
      id: `letter-${Date.now()}`,
      authorName: isAr ? 'أنت (عضو موثق)' : 'You (Verified Member)',
      gender: 'male',
      age: 25,
      city: { ar: 'الرياض', en: 'Riyadh' },
      text: { ar: newLetterText, en: newLetterText },
      category: { ar: 'رسالة خاصة', en: 'Soul Note' },
      time: isAr ? 'الآن' : 'Just now',
    };
    setLetters([newLetter, ...letters]);
    setNewLetterText('');
    setIsPublishingLetter(false);
    setLetterSentSuccess(true);
    setTimeout(() => setLetterSentSuccess(false), 3000);
  };

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center py-4 px-2 sm:px-4 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="w-full text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 text-xs font-semibold mb-3">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>
            {isAr
              ? '1,482 مستخدم متصل يبحثون عن محادثة نصية'
              : '1,482 active souls looking for text chat'}
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-neutral-900 dark:text-white">
          {isAr ? 'نظام المطابقة النصية' : 'Text Matching System'}
        </h1>
        <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 max-w-md mx-auto mt-1 leading-relaxed">
          {isAr
            ? 'تواصل حقيقي يبدأ بالكلمات والأفكار المشتركة والتوافق الفكري والروحي.'
            : 'True connection beginning with words, thoughts, and genuine soul resonance.'}
        </p>
      </div>

      {/* Navigation Mode Switcher */}
      <div className="w-full grid grid-cols-3 gap-1.5 sm:gap-2 p-1.5 rounded-2xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 mb-6">
        {/* Instant Match */}
        <button
          type="button"
          onClick={() => {
            setMatchingMode('instant');
            setSearchState('idle');
          }}
          className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            matchingMode === 'instant'
              ? 'bg-white dark:bg-neutral-800 text-cyan-600 dark:text-cyan-400 shadow-sm'
              : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <Shuffle className="w-3.5 h-3.5" />
          <span>{isAr ? 'المطابقة الفورية' : 'Instant Match'}</span>
        </button>

        {/* Topics Match */}
        <button
          type="button"
          onClick={() => {
            setMatchingMode('topics');
            setSearchState('idle');
          }}
          className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            matchingMode === 'topics'
              ? 'bg-white dark:bg-neutral-800 text-cyan-600 dark:text-cyan-400 shadow-sm'
              : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>{isAr ? 'حسب الموضوع' : 'By Topic'}</span>
        </button>

        {/* Soul Letters */}
        <button
          type="button"
          onClick={() => {
            setMatchingMode('letters');
            setSearchState('idle');
          }}
          className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            matchingMode === 'letters'
              ? 'bg-white dark:bg-neutral-800 text-cyan-600 dark:text-cyan-400 shadow-sm'
              : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          <span>{isAr ? 'رسائل الأرواح' : 'Soul Letters'}</span>
        </button>
      </div>

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
              {isAr ? 'جاري البحث عن شريك نصي متوافق...' : 'Searching for a resonant soul...'}
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
                  ? `نسبة التوافق النصي: ${matchedPartner.matchScore}%`
                  : `Text Compatibility: ${matchedPartner.matchScore}%`}
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
              <span>{isAr ? 'بدء المحادثة النصية الآن' : 'Start Text Chat Now'}</span>
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

      {/* ---------------- STATE 0: IDLE MODES ---------------- */}
      {searchState === 'idle' && (
        <div className="w-full space-y-6">
          {/* Mode 1: Instant Random Match */}
          {matchingMode === 'instant' && (
            <div className="space-y-6">
              {/* Filter controls */}
              <div className="p-4 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-3 shadow-xs">
                <div className="flex items-center justify-between text-xs font-bold text-neutral-800 dark:text-neutral-200">
                  <span className="flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-cyan-500" />
                    <span>{isAr ? 'تفضيلات التطابق' : 'Matching Preferences'}</span>
                  </span>
                  <span className="text-[11px] text-neutral-400 font-normal">
                    {isAr ? 'تخصيص البحث' : 'Customize filter'}
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

              {/* Big CTA Button for Instant Match */}
              <div className="p-8 sm:p-10 rounded-3xl bg-gradient-to-b from-neutral-100 to-white dark:from-neutral-900 dark:to-neutral-950 border border-neutral-200 dark:border-neutral-800/80 flex flex-col items-center justify-center text-center space-y-4 shadow-sm relative overflow-hidden">
                <div className="w-20 h-20 rounded-full bg-cyan-500/10 border-2 border-cyan-500/30 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shadow-inner">
                  <MessageCircle className="w-10 h-10" />
                </div>

                <div className="space-y-1">
                  <h3 className="text-lg sm:text-xl font-bold text-neutral-900 dark:text-white">
                    {isAr ? 'المطابقة النصية الفورية' : 'Instant Text Match'}
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-sm">
                    {isAr
                      ? 'ربط فوري 1-على-1 مع مستخدم متصل متوافق معك فكرياً لبدء محادثة نصية راقية.'
                      : 'Connect 1-on-1 instantly with a compatible online soul for meaningful text chat.'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleStartSearch}
                  className="w-full max-w-sm py-4 px-6 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-black text-sm tracking-wide shadow-lg shadow-cyan-500/20 transition-all cursor-pointer active:scale-98 flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{isAr ? 'ابدأ البحث عن شريك نصي الآن' : 'Start Instant Matching'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Mode 2: By Topic */}
          {matchingMode === 'topics' && (
            <div className="space-y-5">
              <div className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-4 shadow-xs">
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                    {isAr ? 'اختر موضوع النقاش المشترك' : 'Select Discussion Topic'}
                  </h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {isAr
                      ? 'سيقوم النظام بمطابقتك مع من يبحث عن نفس الموضوع والاهتمامات'
                      : 'The system matches you with someone passionate about the same topic'}
                  </p>
                </div>

                {/* Preset Chips */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {presetTopics.map((topic) => (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() => setSelectedPresetTopic(topic[lang])}
                      className={`p-3 rounded-2xl border text-start transition-all cursor-pointer flex items-center justify-between text-xs font-semibold ${
                        selectedPresetTopic === topic[lang]
                          ? 'bg-cyan-500/10 border-cyan-500 text-cyan-600 dark:text-cyan-400 shadow-xs'
                          : 'bg-neutral-50 hover:bg-neutral-100 dark:bg-neutral-950/60 dark:hover:bg-neutral-800/80 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300'
                      }`}
                    >
                      <span>{topic[lang]}</span>
                      {selectedPresetTopic === topic[lang] && (
                        <Check className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>

                {/* Custom topic input */}
                <div className="space-y-1.5 pt-2">
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    {isAr ? 'أو اكتب فكرة أو موضوعاً مخصصاً:' : 'Or type a custom thought:'}
                  </label>
                  <input
                    type="text"
                    value={customTopic}
                    onChange={(e) => setCustomTopic(e.target.value)}
                    placeholder={
                      isAr
                        ? 'مثال: التحدث عن الهوايات المفضلة، أو السفر إلى اليابان...'
                        : 'e.g. Talking about favorite books or travel...'
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleStartSearch}
                  className="w-full py-3.5 px-5 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                >
                  <Search className="w-4 h-4" />
                  <span>
                    {isAr
                      ? `مطابقة شريك مهتم بـ: ${customTopic || selectedPresetTopic}`
                      : 'Match Partner on This Topic'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Mode 3: Soul Letters */}
          {matchingMode === 'letters' && (
            <div className="space-y-5">
              {/* Write your own letter banner */}
              <div className="p-5 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                    <Radio className="w-4 h-4 text-cyan-500" />
                    <span>{isAr ? 'رسائل فضاء Soul-X' : 'Soul-X Orbit Letters'}</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsPublishingLetter(!isPublishingLetter)}
                    className="px-3 py-1 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    {isPublishingLetter
                      ? isAr
                        ? 'إلغاء'
                        : 'Cancel'
                      : isAr
                      ? '+ كتابة رسالة في الفضاء'
                      : '+ Write a Letter'}
                  </button>
                </div>

                {isPublishingLetter && (
                  <div className="space-y-3 pt-2">
                    <textarea
                      rows={3}
                      maxLength={200}
                      value={newLetterText}
                      onChange={(e) => setNewLetterText(e.target.value)}
                      placeholder={
                        isAr
                          ? 'اكتب رسالة تعبر عن روحك أو فكرة ترغب أن يقرأها الآخرون ويتواصلوا معك...'
                          : 'Write a thought or message you wish someone to read and connect with you...'
                      }
                      className="w-full p-3 rounded-2xl text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:border-cyan-500 resize-none"
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-neutral-400 font-mono">
                        {200 - newLetterText.length} {isAr ? 'حرف متبقي' : 'chars left'}
                      </span>
                      <button
                        type="button"
                        onClick={handlePublishLetter}
                        disabled={!newLetterText.trim()}
                        className="py-2 px-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5 -rotate-45" />
                        <span>{isAr ? 'نشر في الفضاء' : 'Broadcast Letter'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {letterSentSuccess && (
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    {isAr
                      ? 'تم نشر رسالتك في فضاء الأرواح بنجاح! سيتم إشعارك عند تفاعل أي شريك معها.'
                      : 'Your letter was broadcasted into space! You will be notified when someone responds.'}
                  </div>
                )}
              </div>

              {/* Feed of Community Letters */}
              <div className="space-y-3">
                {letters.map((letter) => (
                  <div
                    key={letter.id}
                    className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-neutral-900/70 border border-neutral-200 dark:border-neutral-800/80 space-y-3 shadow-xs hover:border-cyan-500/40 transition-colors"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-cyan-400" />
                        <span className="font-bold text-neutral-900 dark:text-white">
                          {letter.authorName}
                        </span>
                        <span className="text-[10px] text-neutral-400">
                          ({letter.city[lang]} · {letter.age} {isAr ? 'سنة' : 'y/o'})
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-neutral-400">
                        {letter.time}
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
                      "{letter.text[lang]}"
                    </p>

                    <div className="pt-1 flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                        #{letter.category[lang]}
                      </span>

                      <button
                        type="button"
                        onClick={() => {
                          // Connect with author of this letter
                          const fakePartner: TextPartner = {
                            id: letter.id,
                            name: letter.authorName,
                            gender: letter.gender,
                            age: letter.age,
                            city: letter.city,
                            avatar:
                              letter.gender === 'female'
                                ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'
                                : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
                            matchScore: 98,
                            topic: letter.category,
                            quote: letter.text,
                            tags: { ar: ['رسائل الفضاء'], en: ['Soul Letter'] },
                            firstMessage: {
                              ar: `مرحباً، قرأت رسالتك في الفضاء: "${letter.text.ar.substring(0, 40)}..." وأحببت الرد عليها والحديث معك!`,
                              en: `Hi! I read your letter in space and would love to chat!`,
                            },
                          };
                          handleConnectChat(fakePartner);
                        }}
                        className="py-1.5 px-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>{isAr ? 'الرد وبدء محادثة' : 'Reply & Chat'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
