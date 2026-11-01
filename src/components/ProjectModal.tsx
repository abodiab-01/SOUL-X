import React, { useEffect } from 'react';
import { X, Check, ArrowRight, ArrowLeft } from 'lucide-react';
import { Project, Language } from '../types';

interface ProjectModalProps {
  project: Project | null;
  onClose: () => void;
  lang: Language;
  onInquire: (projectName: string) => void;
}

export const ProjectModal: React.FC<ProjectModalProps> = ({
  project,
  onClose,
  lang,
  onInquire,
}) => {
  const isAr = lang === 'ar';

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (project) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [project]);

  if (!project) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10 bg-neutral-950/80 backdrop-blur-lg animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl overflow-y-auto">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 z-10 p-2 text-neutral-400 hover:text-neutral-900 dark:hover:text-white bg-neutral-100 dark:bg-neutral-800/80 rounded-full transition-colors"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Hero image in modal */}
        <div className="relative h-72 sm:h-96 w-full bg-neutral-950">
          <img
            src={project.image}
            alt={project.title[lang]}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 via-transparent to-transparent pointer-events-none" />
          <div className="absolute bottom-6 left-6 right-6">
            <div className="text-xs font-mono text-cyan-400 uppercase tracking-widest mb-1">
              {project.category[lang]} · {project.year}
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              {project.title[lang]}
            </h2>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-8 space-y-8">
          <div>
            <h3 className="text-xs uppercase tracking-wider text-neutral-500 font-semibold mb-2">
              {isAr ? 'فلسفة التصميم' : 'Design Philosophy'}
            </h3>
            <p className="text-base text-neutral-700 dark:text-neutral-200 leading-relaxed">
              {project.description[lang]}
            </p>
          </div>

          {/* Details list */}
          <div>
            <h3 className="text-xs uppercase tracking-wider text-neutral-500 font-semibold mb-4">
              {isAr ? 'الخصائص والميزات الهندسية' : 'Engineering Highlights'}
            </h3>
            <ul className="space-y-3">
              {project.details[lang].map((detail, idx) => (
                <li key={idx} className="flex items-start gap-3 text-sm text-neutral-600 dark:text-neutral-300">
                  <div className="w-5 h-5 rounded-full bg-cyan-500/10 text-cyan-500 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <span>{detail}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Specifications Table with Tabular Figures */}
          <div>
            <h3 className="text-xs uppercase tracking-wider text-neutral-500 font-semibold mb-4">
              {isAr ? 'المواصفات التقنية الدقيقة' : 'Technical Specifications'}
            </h3>
            <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden divide-y divide-neutral-200 dark:divide-neutral-800">
              {project.specs.map((spec, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-neutral-50/50 dark:bg-neutral-950/30 text-xs gap-1 sm:gap-4">
                  <span className="font-semibold text-neutral-500 dark:text-neutral-400">
                    {spec.label[lang]}
                  </span>
                  <span className="font-mono text-neutral-900 dark:text-neutral-200 font-medium tabular-nums">
                    {spec.value[lang]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Action */}
          <div className="pt-6 border-t border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-xs font-mono text-neutral-500">
              {project.metrics[lang]}
            </span>
            <button
              type="button"
              onClick={() => {
                onInquire(project.title[lang]);
                onClose();
              }}
              className="w-full sm:w-auto px-6 py-3 text-xs font-semibold text-neutral-950 bg-cyan-400 hover:bg-cyan-300 rounded-xl transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] flex items-center justify-center gap-2"
            >
              <span>{isAr ? 'طلب معاينة أو حجز الإصدار' : 'Request Private Inspection'}</span>
              {isAr ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
