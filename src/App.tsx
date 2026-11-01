import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { BottomNav, TabType } from './components/BottomNav';
import { AccountView } from './components/AccountView';
import { ChatsView } from './components/ChatsView';
import { MatchingView } from './components/MatchingView';
import { WalletView } from './components/WalletView';
import { SettingsView } from './components/SettingsView';
import { Language, Theme } from './types';

export default function App() {
  const [lang, setLang] = useState<Language>('ar');
  const [theme, setTheme] = useState<Theme>('dark');
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Persistent wallet balance (starts at 1,250 diamonds)
  const [walletBalance, setWalletBalance] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('soulx_wallet_balance');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed)) return parsed;
      }
    }
    return 1250;
  });

  const handleRecharge = (amount: number) => {
    setWalletBalance((prev) => {
      const next = prev + amount;
      if (typeof window !== 'undefined') {
        localStorage.setItem('soulx_wallet_balance', next.toString());
      }
      return next;
    });
  };

  const isAr = lang === 'ar';

  // Synchronize document dir and lang attributes
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  // Synchronize dark mode class
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const isAccountTab = activeTab === 'account';

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 transition-colors flex flex-col selection:bg-cyan-500/20 selection:text-cyan-400">
      {/* البار العلوي / Top Bar */}
      <Navbar
        lang={lang}
        walletBalance={walletBalance}
        onOpenWallet={() => {
          setIsSettingsOpen(false);
          setIsWalletOpen(true);
        }}
        onBrandClick={() => {
          setIsWalletOpen(false);
          setIsSettingsOpen(false);
          setActiveTab('home');
        }}
      />

      {/* المحتوى الرئيسي حسب التبويب أو شاشة المحفظة / الإعدادات ملء الشاشة */}
      <main
        className={`flex-1 flex flex-col ${
          isAccountTab || isWalletOpen || isSettingsOpen
            ? 'w-full px-0 pt-0 pb-20 items-stretch justify-start'
            : activeTab === 'chats'
            ? 'w-full px-2 sm:px-4 pt-1 sm:pt-3 pb-20 items-stretch justify-start'
            : 'items-center justify-center px-4 sm:px-6 pb-24 pt-6'
        }`}
      >
        {isWalletOpen ? (
          /* شاشة المحفظة كصفحة منفصلة ملء الشاشة مع زر عودة */
          <WalletView
            lang={lang}
            walletBalance={walletBalance}
            onRecharge={handleRecharge}
            onBack={() => setIsWalletOpen(false)}
          />
        ) : isSettingsOpen ? (
          /* شاشة الإعدادات كصفحة منفصلة ملء الشاشة مع زر عودة */
          <SettingsView
            lang={lang}
            setLang={setLang}
            theme={theme}
            setTheme={setTheme}
            onBack={() => setIsSettingsOpen(false)}
          />
        ) : (
          <>
            {activeTab === 'home' && (
              <div className="w-full max-w-xl text-center flex flex-col items-center justify-center py-20 animate-in fade-in duration-300">
                {/* Subtle atmospheric glow */}
                <div className="w-64 h-64 bg-cyan-500/10 dark:bg-cyan-500/5 blur-3xl rounded-full absolute pointer-events-none" />

                <div className="relative">
                  {/* Soul-X Minimal Brand Emblem */}
                  <div className="w-16 h-16 rounded-2xl mx-auto mb-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm flex items-center justify-center text-cyan-600 dark:text-cyan-400">
                    <span className="font-mono text-xl font-bold tracking-tighter">
                      S<span className="text-cyan-500">X</span>
                    </span>
                  </div>

                  <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-900 dark:text-white mb-3">
                    SOUL<span className="text-neutral-400 dark:text-neutral-600 font-light">—</span>X
                  </h1>

                  <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto leading-relaxed mb-6">
                    {isAr
                      ? 'منصة الشات والتعارف وتوافق الأرواح — تواصل حقيقي ولقاءات صادقة.'
                      : 'Where souls meet — genuine chat, matchmaking, and meaningful connection.'}
                  </p>

                  {/* Quick Action Shortcuts to Match & Chat */}
                  <div className="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setActiveTab('match')}
                      className="px-5 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-semibold text-xs transition-colors cursor-pointer shadow-md"
                    >
                      {isAr ? 'ابدأ المطابقة الآن' : 'Start Matching'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('chats')}
                      className="px-5 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white font-medium text-xs transition-colors cursor-pointer border border-neutral-200 dark:border-neutral-700/60"
                    >
                      {isAr ? 'فتح المحادثات' : 'Open Chats'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'match' && (
              <MatchingView
                lang={lang}
                onGoToChat={() => setActiveTab('chats')}
              />
            )}

            {activeTab === 'chats' && <ChatsView lang={lang} />}

            {activeTab === 'account' && (
              <AccountView
                lang={lang}
                walletBalance={walletBalance}
                onOpenWallet={() => setIsWalletOpen(true)}
                onOpenSettings={() => setIsSettingsOpen(true)}
              />
            )}
          </>
        )}
      </main>

      {/* البار السفلي / Bottom Navigation Bar */}
      <BottomNav
        activeTab={isWalletOpen || isSettingsOpen ? 'account' : activeTab}
        onChangeTab={(tab) => {
          setIsWalletOpen(false);
          setIsSettingsOpen(false);
          setActiveTab(tab);
        }}
        lang={lang}
      />
    </div>
  );
}
