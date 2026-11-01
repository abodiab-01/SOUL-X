import React, { useState } from 'react';
import { projectsData } from '../data/content';
import { Language, Project } from '../types';
import { Eye, ArrowUpRight } from 'lucide-react';

interface WorkShowcaseProps {
  lang: Language;
  onSelectProject: (project: Project) => void;
}

export const WorkShowcase: React.FC<WorkShowcaseProps> = ({ lang, onSelectProject }) => {
  const isAr = lang === 'ar';
  const [filter, setFilter] = useState<'all' | 'hardware' | 'digital' | 'spatial'>('all');

  const filteredProjects = projectsData.filter((p) => {
    if (filter === 'all') return true;
    return p.categoryKey === filter;
  });

  return (
    <section id="creations" className="py-24 border-t border-neutral-200 dark:border-neutral-800 transition-colors">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Section Header & Filter Controls */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <div className="text-xs uppercase tracking-widest text-cyan-500 font-semibold mb-3">
              {isAr ? 'الإصدارات والأعمال' : 'Selected Works'}
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-neutral-900 dark:text-white">
              {isAr ? 'روائع استوديو Soul-X' : 'Soul-X Signature Editions'}
            </h2>
          </div>

          {/* Interactive filter tabs (clean segmented control) */}
          <div className="flex items-center gap-1 p-1 bg-neutral-100 dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                filter === 'all'
                  ? 'bg-white dark:bg-neutral-800 text-neutral-950 dark:text-white shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              {isAr ? 'جميع الإصدارات' : 'All Editions'}
            </button>
            <button
              type="button"
              onClick={() => setFilter('hardware')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                filter === 'hardware'
                  ? 'bg-white dark:bg-neutral-800 text-neutral-950 dark:text-white shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              {isAr ? 'أجهزة صوتية' : 'Hardware'}
            </button>
            <button
              type="button"
              onClick={() => setFilter('digital')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                filter === 'digital'
                  ? 'bg-white dark:bg-neutral-800 text-neutral-950 dark:text-white shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              {isAr ? 'واجهات ذكية' : 'Digital UI'}
            </button>
            <button
              type="button"
              onClick={() => setFilter('spatial')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                filter === 'spatial'
                  ? 'bg-white dark:bg-neutral-800 text-neutral-950 dark:text-white shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              {isAr ? 'نحت ومكان' : 'Sculpture'}
            </button>
          </div>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {filteredProjects.map((project, index) => {
            const isMarquee = index === 0;

            return (
              <div
                key={project.id}
                onClick={() => onSelectProject(project)}
                className={`cursor-pointer group rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 hover:border-neutral-300 dark:hover:border-neutral-700 transition-all duration-300 flex flex-col justify-between ${
                  isMarquee ? 'lg:col-span-8' : 'lg:col-span-4'
                }`}
              >
                {/* Visual Image container with fallback */}
                <div className="relative aspect-[16/10] sm:aspect-[16/9] overflow-hidden bg-neutral-950">
                  <img
                    src={project.image}
                    alt={project.title[lang]}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                  />
                  {/* Contrast Scrim */}
                  <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/80 via-transparent to-transparent pointer-events-none" />

                  {/* Quick Inspect Hover Chip */}
                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity bg-neutral-950/80 backdrop-blur-md text-white text-xs px-3 py-1.5 rounded-lg border border-neutral-700 flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{isAr ? 'عرض المواصفات' : 'Inspect Details'}</span>
                  </div>
                </div>

                {/* Content Panel */}
                <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between">
                  <div>
                    {/* Unboxed Metadata with separator */}
                    <div className="flex items-center gap-2 text-xs text-neutral-500 mb-3">
                      <span className="font-medium text-cyan-600 dark:text-cyan-400">
                        {project.category[lang]}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{project.year}</span>
                    </div>

                    <h3 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white mb-2 flex items-center justify-between">
                      <span>{project.title[lang]}</span>
                      <ArrowUpRight className="w-5 h-5 text-neutral-400 group-hover:text-cyan-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                    </h3>

                    <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed mb-6">
                      {project.tagline[lang]}
                    </p>
                  </div>

                  {/* Adjacent Claim-to-Proof Metric */}
                  <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800 text-xs font-mono text-neutral-500 dark:text-neutral-400">
                    <span className="text-cyan-600 dark:text-cyan-400 font-semibold">
                      {project.metrics[lang]}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
