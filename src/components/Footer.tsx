import React from 'react';
import { Language } from '../types';

interface FooterProps {
  lang: Language;
}

export const Footer: React.FC<FooterProps> = ({ lang }) => {
  const isAr = lang === 'ar';

  return (
    <footer className="border-t border-neutral-200 dark:border-neutral-900 bg-neutral-950 text-neutral-400 py-16 transition-colors">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 pb-12 border-b border-neutral-800">
          <div>
            <span className="text-xl font-extrabold tracking-widest text-cyan-400">
              SOUL<span className="text-neutral-600 font-light">—</span>X
            </span>
            <p className="text-xs text-neutral-500 mt-2 max-w-sm">
              {isAr
                ? 'استوديو مستقل متخصص في ابتكار الأجهزة الحسية والواجهات الرقمية فائقة البساطة.'
                : 'An independent design atelier crafting sensory hardware and minimalist digital interfaces.'}
            </p>
          </div>

          <div className="flex flex-wrap gap-8 text-xs font-medium text-neutral-400">
            <a href="#vision" className="hover:text-white transition-colors">
              {isAr ? 'الرؤية' : 'Vision'}
            </a>
            <a href="#pillars" className="hover:text-white transition-colors">
              {isAr ? 'الركائز' : 'Disciplines'}
            </a>
            <a href="#creations" className="hover:text-white transition-colors">
              {isAr ? 'الإصدارات' : 'Editions'}
            </a>
            <a href="#lab" className="hover:text-white transition-colors">
              {isAr ? 'المختبر' : 'Lab'}
            </a>
            <a href="#contact" className="hover:text-white transition-colors">
              {isAr ? 'التواصل' : 'Inquire'}
            </a>
          </div>
        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-600">
          <div>
            © {new Date().getFullYear()} Soul-X Atelier. {isAr ? 'جميع الحقوق محفوظة.' : 'All rights reserved.'}
          </div>

          <div className="flex items-center gap-3">
            <span>Berlin</span>
            <span aria-hidden="true">·</span>
            <span>Tokyo</span>
            <span aria-hidden="true">·</span>
            <span>Riyadh</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
