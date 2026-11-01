import React from 'react';
import { pillarsData } from '../data/content';
import { Language } from '../types';
import { ArrowUpRight } from 'lucide-react';

interface PillarsProps {
  lang: Language;
}

export const Pillars: React.FC<PillarsProps> = ({ lang }) => {
  const isAr = lang === 'ar';

  return (
    <section id="pillars" className="py-24 border-t border-neutral-200 dark:border-neutral-800 transition-colors">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
          <div>
            <div className="text-xs uppercase tracking-widest text-cyan-500 font-semibold mb-3">
              {isAr ? 'الركائز الإبداعية' : 'Core Disciplines'}
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-neutral-900 dark:text-white">
              {isAr ? 'مجالات العمل والتخصص' : 'Architectural Methodologies'}
            </h2>
          </div>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 max-w-md">
            {isAr
              ? 'نعمل عند تقاطع الفن التجريدي والهندسة الصارمة، لنبتكر حلولاً تحافظ على هدوء الفضاء وفاعلية الوظيفة.'
              : 'Operating at the precise convergence of fine art, acoustic science, and computational clarity.'}
          </p>
        </div>

        {/* 4 Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {pillarsData.map((pillar) => (
            <div
              key={pillar.number}
              className="p-8 rounded-2xl border border-neutral-200 dark:border-neutral-800/90 bg-white dark:bg-neutral-900/40 hover:border-neutral-300 dark:hover:border-neutral-700 transition-all duration-300 flex flex-col justify-between group"
            >
              <div>
                {/* Number & Header */}
                <div className="flex items-center justify-between mb-6">
                  <span className="text-sm font-mono text-cyan-600 dark:text-cyan-400 font-semibold">
                    {pillar.number}.
                  </span>
                  <div className="w-8 h-8 rounded-full border border-neutral-200 dark:border-neutral-800 flex items-center justify-center text-neutral-400 group-hover:text-cyan-500 group-hover:border-cyan-500/40 transition-colors">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>

                <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-3">
                  {pillar.title[lang]}
                </h3>

                <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed mb-6">
                  {pillar.description[lang]}
                </p>
              </div>

              {/* Deliverable info */}
              <div className="pt-6 border-t border-neutral-100 dark:border-neutral-800/70 text-xs text-neutral-500 dark:text-neutral-400 flex items-start gap-2">
                <span className="font-semibold text-neutral-700 dark:text-neutral-300 shrink-0">
                  {isAr ? 'المخرجات:' : 'Outputs:'}
                </span>
                <span>{pillar.deliverable[lang]}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
