import React, { useState } from 'react';
import { Sparkles, Heart, X, RotateCcw, Check, MessageSquare, Compass, ArrowRight, ArrowLeft } from 'lucide-react';
import { Language } from '../types';

interface MatchingViewProps {
  lang: Language;
  onGoToChat: () => void;
}

interface MatchProfile {
  id: string;
  name: string;
  role: { ar: string; en: string };
  city: { ar: string; en: string };
  matchRate: number;
  tags: { ar: string[]; en: string[] };
  bio: { ar: string; en: string };
  image: string;
}

const mockProfiles: MatchProfile[] = [
  {
    id: 'p1',
    name: 'ليان الصالح',
    role: { ar: 'معمارية ومصممة مساحات صوتية', en: 'Architect & Acoustic Space Designer' },
    city: { ar: 'الرياض', en: 'Riyadh' },
    matchRate: 98,
    tags: {
      ar: ['تصميم تجريدي', 'صوت مكاني', 'أوبسيديان', 'بساطة مطلقة'],
      en: ['Minimalism', 'Spatial Audio', 'Obsidian', 'Pure Form'],
    },
    bio: {
      ar: 'أبحث عن شركاء مهتمين بدمج الهندسة المعمارية الحديثة مع الأنظمة الحسية الذكية لابتكار مساحات هادئة.',
      en: 'Exploring the intersection of modern minimalist architecture and sensory systems for tranquil living.',
    },
    image: '/src/assets/images/soulx_audio_spatial_1793489090595.jpg',
  },
  {
    id: 'p2',
    name: 'عمر التميمي',
    role: { ar: 'مهندس واجهات وأنظمة تفاعلية', en: 'Interactive Systems Engineer' },
    city: { ar: 'دبي', en: 'Dubai' },
    matchRate: 94,
    tags: {
      ar: ['زجاج ذكي', 'محركات لمسية', 'أجهزة IoT', 'تصميم حسي'],
      en: ['Smart Glass', 'Haptics', 'IoT', 'Tactile UI'],
    },
    bio: {
      ar: 'أطور واجهات مادية ملموسة تعيد للإنسان متعة اللمس الفيزيائي في عصر الشاشات المسطحة.',
      en: 'Building tangible hardware interfaces that restore physical tactility in an era of flat screens.',
    },
    image: '/src/assets/images/soulx_digital_interface_1793489092983.jpg',
  },
  {
    id: 'p3',
    name: 'سارة فاندربيلت',
    role: { ar: 'مديرة فنية ومصممة منتجات صناعية', en: 'Art Director & Industrial Designer' },
    city: { ar: 'برلين', en: 'Berlin' },
    matchRate: 91,
    tags: {
      ar: ['تيتانيوم مؤكسد', 'نحت حركي', 'هندسة ذهبية', 'إصدارات حصرية'],
      en: ['Anodized Titanium', 'Kinetic Art', 'Golden Ratio', 'Limited Series'],
    },
    bio: {
      ar: 'شغوفة بتشكيل المعادن الفاخرة لابتكار قطع هندسية تدوم عقوداً دون أن تفقد بريقها.',
      en: 'Dedicated to precision metalcraft and sculptural forms designed to outlive ephemeral trends.',
    },
    image: '/src/assets/images/hero_soulx_monolith_1793489091169.jpg',
  },
];

export const MatchingView: React.FC<MatchingViewProps> = ({ lang, onGoToChat }) => {
  const isAr = lang === 'ar';
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lastAction, setLastAction] = useState<'match' | 'pass' | null>(null);
  const [matchedModal, setMatchedModal] = useState<MatchProfile | null>(null);

  const currentProfile = mockProfiles[currentIndex % mockProfiles.length];

  const handlePass = () => {
    setLastAction('pass');
    setTimeout(() => {
      setCurrentIndex((prev) => prev + 1);
      setLastAction(null);
    }, 200);
  };

  const handleMatch = () => {
    setLastAction('match');
    setMatchedModal(currentProfile);
    setTimeout(() => {
      setCurrentIndex((prev) => prev + 1);
      setLastAction(null);
    }, 200);
  };

  const handleReset = () => {
    setCurrentIndex(0);
    setMatchedModal(null);
  };

  return (
    <div className="w-full max-w-sm sm:max-w-md mx-auto flex flex-col items-center justify-center animate-in fade-in duration-300">
      {/* Top Affinity Header */}
      <div className="w-full flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-xs uppercase tracking-wider font-semibold text-neutral-600 dark:text-neutral-400">
            {isAr ? 'رادار المطابقة الفكرية والذوقية' : 'Soul Affinity Matcher'}
          </span>
        </div>
        <span className="text-xs font-mono text-cyan-600 dark:text-cyan-400 font-semibold tabular-nums">
          {currentProfile.matchRate}% {isAr ? 'توافق' : 'Match'}
        </span>
      </div>

      {/* Profile Card Deck */}
      <div className="relative w-full aspect-[4/5] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-xl flex flex-col justify-between group transition-all">
        {/* Background artwork */}
        <div className="absolute inset-0 bg-neutral-950">
          <img
            src={currentProfile.image}
            alt={currentProfile.name}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover opacity-85 group-hover:scale-105 transition-transform duration-700 ease-out"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/40 to-transparent pointer-events-none" />
        </div>

        {/* Top Badges */}
        <div className="relative z-10 p-5 flex items-center justify-between">
          <div className="px-3 py-1 rounded-full bg-neutral-900/80 backdrop-blur-md border border-neutral-700/60 text-white text-[11px] font-mono flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-cyan-400" />
            <span>{currentProfile.city[lang]}</span>
          </div>

          <div className="px-3 py-1 rounded-full bg-cyan-500/20 backdrop-blur-md border border-cyan-500/40 text-cyan-300 text-[11px] font-mono font-bold tabular-nums">
            {currentProfile.matchRate}%
          </div>
        </div>

        {/* Bottom Profile Details */}
        <div className="relative z-10 p-6 text-white space-y-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight mb-1 flex items-center gap-2">
              <span>{currentProfile.name}</span>
            </h2>
            <div className="text-xs text-neutral-300 font-medium">
              {currentProfile.role[lang]}
            </div>
          </div>

          <p className="text-xs text-neutral-300 leading-relaxed line-clamp-2">
            {currentProfile.bio[lang]}
          </p>

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {currentProfile.tags[lang].map((tag, idx) => (
              <span
                key={idx}
                className="text-[10px] px-2 py-0.5 rounded-md bg-white/10 backdrop-blur-xs text-neutral-200 border border-white/10"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Action Controls Bar */}
      <div className="w-full flex items-center justify-center gap-6 mt-6">
        {/* Pass Button */}
        <button
          type="button"
          onClick={handlePass}
          className="w-14 h-14 rounded-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-md flex items-center justify-center text-neutral-500 hover:text-red-500 hover:border-red-400/50 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all cursor-pointer group active:scale-95"
          aria-label={isAr ? 'تخطي' : 'Pass'}
        >
          <X className="w-6 h-6 transition-transform group-hover:scale-110" />
        </button>

        {/* Super Match Button */}
        <button
          type="button"
          onClick={handleMatch}
          className="w-16 h-16 rounded-full bg-cyan-400 hover:bg-cyan-300 text-neutral-950 shadow-[0_0_25px_rgba(6,182,212,0.4)] flex items-center justify-center transition-all cursor-pointer group active:scale-95"
          aria-label={isAr ? 'مطابقة' : 'Match'}
        >
          <Sparkles className="w-7 h-7 transition-transform group-hover:scale-110 fill-current" />
        </button>

        {/* Reset / Rewind Button */}
        <button
          type="button"
          onClick={handleReset}
          className="w-14 h-14 rounded-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-md flex items-center justify-center text-neutral-500 hover:text-cyan-500 hover:border-cyan-400/50 hover:bg-cyan-50 dark:hover:bg-cyan-950/20 transition-all cursor-pointer group active:scale-95"
          aria-label={isAr ? 'إعادة' : 'Reset'}
        >
          <RotateCcw className="w-5 h-5 transition-transform group-hover:-rotate-45" />
        </button>
      </div>

      {/* Match Success Modal */}
      {matchedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-neutral-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 text-center shadow-2xl space-y-4">
            <div className="w-16 h-16 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center justify-center mx-auto animate-bounce">
              <Sparkles className="w-8 h-8" />
            </div>

            <h3 className="text-xl font-bold text-neutral-900 dark:text-white">
              {isAr ? 'توافق أرواح استثنائي!' : "It's an Affinity Match!"}
            </h3>

            <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
              {isAr
                ? `تطابقت رؤيتك مع ${matchedModal.name} بنسبة توافق تبلغ ${matchedModal.matchRate}%. يمكنك بدء محادثة فورية الآن.`
                : `You and ${matchedModal.name} share a ${matchedModal.matchRate}% aesthetic resonance. Start a conversation now.`}
            </p>

            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setMatchedModal(null);
                  onGoToChat();
                }}
                className="w-full py-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-semibold text-xs shadow-md transition-colors flex items-center justify-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                <span>{isAr ? 'بدء محادثة في الدردشات' : 'Open in Chats'}</span>
              </button>

              <button
                type="button"
                onClick={() => setMatchedModal(null)}
                className="w-full py-2.5 rounded-xl text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white text-xs transition-colors"
              >
                {isAr ? 'متابعة التصفح' : 'Continue Browsing'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
