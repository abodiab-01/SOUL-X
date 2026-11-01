import React from 'react';
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import { Language } from '../types';

interface HeroProps {
  lang: Language;
  onExploreWork: () => void;
  onOpenContact: () => void;
}

export const Hero: React.FC<HeroProps> = ({ lang, onExploreWork, onOpenContact }) => {
  const isAr = lang === 'ar';

  return (
    <section id="vision" className="relative pt-16 pb-24 md:pt-24 md:pb-32 overflow-hidden">
      {/* Background radial gradient mesh */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-cyan-600/10 dark:bg-cyan-500/10 blur-[130px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Text Content Column */}
          <div className="lg:col-span-7 flex flex-col justify-center">
            {/* Unboxed Metadata Kicker with typographic separator */}
            <div className="flex items-center gap-2 text-xs font-medium text-cyan-600 dark:text-cyan-400 mb-6">
              <span>{isAr ? 'استوديو التصميم والهندسة الحسية' : 'Sensory Engineering & Design Atelier'}</span>
              <span aria-hidden="true">·</span>
              <span className="text-neutral-500">{isAr ? 'إصدارات 2026' : '2026 Editions'}</span>
              <span aria-hidden="true">·</span>
              <span className="text-neutral-500">Soul-X Labs</span>
            </div>

            {/* Display Headline with text-wrap: balance to prevent orphan words */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-neutral-900 dark:text-white leading-[1.12] mb-6 [text-wrap:balance]">
              {isAr ? (
                <>
                  واجهات ومنتجات حية <br className="hidden sm:inline" />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-neutral-900 via-neutral-700 to-cyan-600 dark:from-white dark:via-neutral-200 dark:to-cyan-400">
                    بروح فائقة البساطة
                  </span>
                </>
              ) : (
                <>
                  Sensory interfaces & objects <br className="hidden sm:inline" />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-neutral-900 via-neutral-700 to-cyan-600 dark:from-white dark:via-neutral-200 dark:to-cyan-400">
                    born with radical purity.
                  </span>
                </>
              )}
            </h1>

            {/* Body Description */}
            <p className="text-base sm:text-lg text-neutral-600 dark:text-neutral-300 leading-relaxed mb-8 max-w-xl [text-wrap:pretty]">
              {isAr
                ? 'في Soul-X، نبتكر جسراً متيناً بين الهندسة الدقيقة والجمال الحسي الهادئ. نصمم الأجهزة الصوتية الفريدة والواجهات التفاعلية التي تمنح مستخدميها سكينة ووضوحاً استثنائياً.'
                : 'At Soul-X, we forge the bridge between precision industrial engineering and sensory minimalism. Creating iconic acoustic hardware and fluid digital interfaces designed to resonate.'}
            </p>

            {/* Interactive Action Buttons */}
            <div className="flex flex-wrap items-center gap-4 mb-12">
              <button
                type="button"
                onClick={onOpenContact}
                className="px-6 py-3.5 text-sm font-semibold text-neutral-950 bg-cyan-400 hover:bg-cyan-300 rounded-xl transition-all shadow-[0_0_25px_rgba(6,182,212,0.3)] flex items-center gap-2 whitespace-nowrap"
              >
                <span>{isAr ? 'ابدأ محادثة مع الاستوديو' : 'Initiate Studio Dialogue'}</span>
                {isAr ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={onExploreWork}
                className="px-6 py-3.5 text-sm font-medium text-neutral-800 dark:text-neutral-200 hover:text-neutral-950 dark:hover:text-white bg-neutral-100 dark:bg-neutral-900 hover:bg-neutral-200 dark:hover:bg-neutral-800 border border-neutral-300 dark:border-neutral-800 rounded-xl transition-all whitespace-nowrap"
              >
                {isAr ? 'استكشف الأعمال والإصدارات' : 'Explore Works & Editions'}
              </button>
            </div>

            {/* Sub-hero trust metrics: Clean unboxed stats */}
            <div className="pt-8 border-t border-neutral-200 dark:border-neutral-800/80 grid grid-cols-3 gap-6 max-w-lg">
              <div>
                <div className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-neutral-900 dark:text-white tabular-nums">
                  14+
                </div>
                <div className="text-xs text-neutral-500 mt-1">
                  {isAr ? 'جوائز تصميم دولية' : 'International Awards'}
                </div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-neutral-900 dark:text-white tabular-nums">
                  99.8%
                </div>
                <div className="text-xs text-neutral-500 mt-1">
                  {isAr ? 'نقاء استجابة الصوت' : 'Acoustic Fidelity'}
                </div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-neutral-900 dark:text-white tabular-nums">
                  150
                </div>
                <div className="text-xs text-neutral-500 mt-1">
                  {isAr ? 'قطعة في الإصدار الأول' : 'Edition 01 Units'}
                </div>
              </div>
            </div>
          </div>

          {/* Focal Image Visual Anchor */}
          <div className="lg:col-span-5 relative">
            <div className="relative rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 shadow-2xl bg-neutral-950 group">
              <img
                src="/src/assets/images/hero_soulx_monolith_1793489091169.jpg"
                alt="Soul-X Monolith Acoustic Showcase"
                referrerPolicy="no-referrer"
                className="w-full h-[460px] sm:h-[520px] object-cover group-hover:scale-[1.02] transition-transform duration-700 ease-out"
              />

              {/* Scrim Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/90 via-neutral-950/20 to-transparent pointer-events-none" />

              {/* Caption Tag on bottom of image */}
              <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between">
                <div>
                  <div className="text-xs font-mono text-cyan-400 mb-1">
                    EDITION 01 // MONOLITH
                  </div>
                  <div className="text-sm font-semibold text-white">
                    {isAr ? 'العمود الصوتي المعتم Soul-X' : 'Soul-X Matte Obsidian Column'}
                  </div>
                </div>
                <span className="text-xs font-mono text-neutral-400 tabular-nums">
                  18Hz — 42kHz
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
