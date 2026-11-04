import React from 'react';
import { Home, Sparkles, MessageSquare, User } from 'lucide-react';
import { Language } from '../types';

export type TabType = 'home' | 'match' | 'chats' | 'account';

interface BottomNavProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  lang: Language;
  unreadChatsCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onChangeTab,
  lang,
  unreadChatsCount = 0,
}) => {
  const isAr = lang === 'ar';

  return (
    <nav
      aria-label="Bottom Navigation"
      className="fixed bottom-0 inset-x-0 z-40 bg-white/90 dark:bg-neutral-950/90 backdrop-blur-lg border-t border-neutral-200 dark:border-neutral-800/80 transition-colors py-2 px-3 sm:px-6 safe-area-pb"
    >
      <div className="max-w-md mx-auto flex items-center justify-around gap-1 sm:gap-4">

        {/* الرئيسية / Home Tab */}
        <button
          type="button"
          onClick={() => onChangeTab('home')}
          className={`flex flex-col items-center justify-center py-1.5 px-3 sm:px-4 rounded-xl transition-all duration-200 relative group cursor-pointer ${
            activeTab === 'home'
              ? 'text-cyan-600 dark:text-cyan-400 font-semibold'
              : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'
          }`}
        >
          <Home
            className={`w-5 h-5 mb-1 transition-transform group-hover:scale-110 ${
              activeTab === 'home' ? 'stroke-[2.5]' : 'stroke-[1.75]'
            }`}
          />
          <span className="text-xs tracking-tight whitespace-nowrap">
            {isAr ? 'الرئيسية' : 'Home'}
          </span>
          {activeTab === 'home' && (
            <span className="absolute bottom-0 w-8 h-0.5 bg-cyan-500 rounded-full" />
          )}
        </button>

        {/* المطابقة / Match Tab */}
        <button
          type="button"
          onClick={() => onChangeTab('match')}
          className={`flex flex-col items-center justify-center py-1.5 px-3 sm:px-4 rounded-xl transition-all duration-200 relative group cursor-pointer ${
            activeTab === 'match'
              ? 'text-cyan-600 dark:text-cyan-400 font-semibold'
              : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'
          }`}
        >
          <Sparkles
            className={`w-5 h-5 mb-1 transition-transform group-hover:scale-110 ${
              activeTab === 'match' ? 'stroke-[2.5]' : 'stroke-[1.75]'
            }`}
          />
          <span className="text-xs tracking-tight whitespace-nowrap">
            {isAr ? 'المطابقة' : 'Match'}
          </span>
          {activeTab === 'match' && (
            <span className="absolute bottom-0 w-8 h-0.5 bg-cyan-500 rounded-full" />
          )}
        </button>

        {/* الدردشات / Chats Tab */}
        <button
          type="button"
          onClick={() => onChangeTab('chats')}
          className={`flex flex-col items-center justify-center py-1.5 px-3 sm:px-4 rounded-xl transition-all duration-200 relative group cursor-pointer ${
            activeTab === 'chats'
              ? 'text-cyan-600 dark:text-cyan-400 font-semibold'
              : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'
          }`}
        >
          <div className="relative">
            <MessageSquare
              className={`w-5 h-5 mb-1 transition-transform group-hover:scale-110 ${
                activeTab === 'chats' ? 'stroke-[2.5]' : 'stroke-[1.75]'
              }`}
            />
            {unreadChatsCount > 0 && (
              <span className="absolute -top-1 -right-2.5 px-1.5 min-w-4 h-4 rounded-full bg-emerald-600 text-white text-[9px] font-mono font-black flex items-center justify-center ring-2 ring-white dark:ring-neutral-950 animate-pulse">
                {unreadChatsCount > 99 ? '99+' : unreadChatsCount}
              </span>
            )}
          </div>
          <span className="text-xs tracking-tight whitespace-nowrap">
            {isAr ? 'الدردشات' : 'Chats'}
          </span>
          {activeTab === 'chats' && (
            <span className="absolute bottom-0 w-8 h-0.5 bg-cyan-500 rounded-full" />
          )}
        </button>

        {/* حسابي / My Account Tab */}
        <button
          type="button"
          onClick={() => onChangeTab('account')}
          className={`flex flex-col items-center justify-center py-1.5 px-3 sm:px-4 rounded-xl transition-all duration-200 relative group cursor-pointer ${
            activeTab === 'account'
              ? 'text-cyan-600 dark:text-cyan-400 font-semibold'
              : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'
          }`}
        >
          <User
            className={`w-5 h-5 mb-1 transition-transform group-hover:scale-110 ${
              activeTab === 'account' ? 'stroke-[2.5]' : 'stroke-[1.75]'
            }`}
          />
          <span className="text-xs tracking-tight whitespace-nowrap">
            {isAr ? 'حسابي' : 'Account'}
          </span>
          {activeTab === 'account' && (
            <span className="absolute bottom-0 w-8 h-0.5 bg-cyan-500 rounded-full" />
          )}
        </button>
      </div>
    </nav>
  );
};
