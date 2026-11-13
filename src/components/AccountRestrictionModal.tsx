import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Snowflake,
  Clock,
  LogOut,
  RefreshCw,
  AlertOctagon,
  Copy,
  Check,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { Language, AccountRestrictionInfo } from '../types';

interface AccountRestrictionModalProps {
  isOpen?: boolean;
  restriction: AccountRestrictionInfo;
  userName?: string;
  userDisplayId?: string;
  lang: Language;
  onLogout: () => void;
  onUnfrozen?: () => void;
  onRefreshStatus?: () => Promise<void>;
}

export const AccountRestrictionModal: React.FC<AccountRestrictionModalProps> = ({
  isOpen = true,
  restriction,
  userName,
  userDisplayId,
  lang,
  onLogout,
  onUnfrozen,
  onRefreshStatus,
}) => {
  if (!isOpen) return null;
  const isAr = lang === 'ar';
  const [copiedId, setCopiedId] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [justUnfrozen, setJustUnfrozen] = useState(false);

  const computeServerSyncedRemainingMs = (r: AccountRestrictionInfo): number => {
    if (typeof r.remainingMs === 'number' && r.remainingMs > 0) {
      const sinceReceived = r.receivedAt ? Math.max(0, Date.now() - r.receivedAt) : 0;
      return Math.max(0, r.remainingMs - sinceReceived);
    }
    if (r.freezeExpiresAt && r.serverNow) {
      const serverDiff = new Date(r.freezeExpiresAt).getTime() - r.serverNow;
      const sinceReceived = r.receivedAt ? Math.max(0, Date.now() - r.receivedAt) : 0;
      return Math.max(0, serverDiff - sinceReceived);
    }
    if (r.freezeExpiresAt) {
      return Math.max(0, new Date(r.freezeExpiresAt).getTime() - Date.now());
    }
    return 0;
  };

  const initialRemaining = computeServerSyncedRemainingMs(restriction);
  const [remainingMs, setRemainingMs] = useState<number>(initialRemaining);
  const deadlinePerfRef = React.useRef<number>(
    (typeof performance !== 'undefined' ? performance.now() : Date.now()) + initialRemaining
  );
  const [localExpiresWallMs, setLocalExpiresWallMs] = useState<number>(
    () => Date.now() + initialRemaining
  );
  const unfreezeTriggeredRef = React.useRef<boolean>(false);
  const onUnfrozenRef = React.useRef(onUnfrozen);
  const onRefreshStatusRef = React.useRef(onRefreshStatus);

  useEffect(() => {
    onUnfrozenRef.current = onUnfrozen;
    onRefreshStatusRef.current = onRefreshStatus;
  }, [onUnfrozen, onRefreshStatus]);

  // Sync deadline whenever fresh restriction data arrives from server
  useEffect(() => {
    if (!restriction.isFrozen) return;
    const synced = computeServerSyncedRemainingMs(restriction);
    const nowPerf = typeof performance !== 'undefined' ? performance.now() : Date.now();
    deadlinePerfRef.current = nowPerf + synced;
    setRemainingMs(synced);
    if (synced > 0) {
      setLocalExpiresWallMs(Date.now() + synced);
      setJustUnfrozen(false);
      unfreezeTriggeredRef.current = false;
    }
  }, [
    restriction.isFrozen,
    restriction.remainingMs,
    restriction.freezeExpiresAt,
    restriction.serverNow,
    restriction.receivedAt,
  ]);

  // Calculate total freeze duration in ms for progress bar
  const totalDurationMs = Math.max(1, (restriction.freezeDurationMinutes || 1) * 60 * 1000);
  const elapsedMs = Math.max(0, totalDurationMs - remainingMs);
  const progressPercent = Math.min(100, Math.max(0, (elapsedMs / totalDurationMs) * 100));

  // Real-time monotonic countdown effect
  useEffect(() => {
    if (!restriction.isFrozen) return;

    const tick = () => {
      const nowPerf = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const diff = Math.max(0, deadlinePerfRef.current - nowPerf);
      setRemainingMs(diff);

      if (diff <= 0 && !unfreezeTriggeredRef.current) {
        unfreezeTriggeredRef.current = true;
        setJustUnfrozen(true);

        const refreshFn = onRefreshStatusRef.current;
        const unfrozenFn = onUnfrozenRef.current;
        if (unfrozenFn) {
          unfrozenFn();
        } else if (refreshFn) {
          refreshFn();
        }
      }
    };

    tick();
    const interval = setInterval(tick, 250);

    return () => clearInterval(interval);
  }, [restriction.isFrozen]);

  // Format remaining time into Hours, Minutes, Seconds
  const formatTimeParts = (ms: number) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return { days, hours, minutes, seconds };
  };

  const { days, hours, minutes, seconds } = formatTimeParts(remainingMs);

  const padZero = (n: number) => n.toString().padStart(2, '0');

  const handleCopy = (text?: string | null) => {
    if (!text || !navigator?.clipboard?.writeText) return;
    navigator.clipboard.writeText(text);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (onRefreshStatus) {
        await onRefreshStatus();
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-neutral-950/95 backdrop-blur-2xl animate-in fade-in duration-300 select-none overflow-y-auto"
      dir={isAr ? 'rtl' : 'ltr'}
      role="alertdialog"
      aria-modal="true"
    >
      {/* Background ambient lighting accents */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {restriction.isBanned ? (
          <>
            <div className="absolute top-1/4 -right-20 w-96 h-96 bg-rose-600/15 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-1/4 -left-20 w-96 h-96 bg-red-700/15 rounded-full blur-3xl animate-pulse" />
          </>
        ) : (
          <>
            <div className="absolute top-1/4 -right-20 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-1/4 -left-20 w-96 h-96 bg-sky-500/15 rounded-full blur-3xl animate-pulse" />
          </>
        )}
      </div>

      <div className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-neutral-900 border-2 border-neutral-200 dark:border-neutral-800 shadow-2xl p-6 sm:p-8 space-y-6 animate-in zoom-in-95 duration-200 my-auto">
        {/* ========================================================
            CASE A: الحساب محظور نهائياً (BANNED ACCOUNT)
            ======================================================== */}
        {restriction.isBanned ? (
          <>
            {/* Header Icon & Title */}
            <div className="text-center space-y-3">
              <div className="relative mx-auto inline-flex items-center justify-center">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-rose-500/15 border-2 border-rose-500/40 text-rose-500 flex items-center justify-center shadow-xl shadow-rose-500/20 animate-bounce">
                  <ShieldAlert className="w-10 h-10 sm:w-12 sm:h-12 stroke-[2.3]" />
                </div>
                <div className="absolute -bottom-1 -right-1 p-2 rounded-2xl bg-rose-600 text-white shadow-md">
                  <AlertOctagon className="w-4 h-4" />
                </div>
              </div>

              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 font-black text-xs border border-rose-500/30 uppercase tracking-wider">
                  <span>{isAr ? 'حظر إداري' : 'Administrative Ban'}</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-neutral-900 dark:text-white">
                  {isAr ? 'تم حظر حسابك' : 'Your Account Has Been Banned'}
                </h2>
                <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto leading-relaxed">
                  {isAr
                    ? 'تم تعليق وصولك لمنصة Soul-X لمخالفة شروط وسياسات الاستخدام أو بناءً على قرار الإدارة.'
                    : 'Access to Soul-X has been suspended for terms of service violations.'}
                </p>
                {(userName || userDisplayId) && (
                  <div className="pt-1 flex items-center justify-center gap-2 text-xs text-neutral-500 font-mono">
                    {userName && <span className="font-bold text-neutral-800 dark:text-neutral-200">{userName}</span>}
                    {userDisplayId && (
                      <span className="px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 font-bold">
                        ID: {userDisplayId}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Details Box */}
            <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-950/70 border border-neutral-200 dark:border-neutral-800 space-y-3 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-neutral-200/60 dark:border-neutral-800/60">
                <span className="font-bold text-neutral-500 dark:text-neutral-400">
                  {isAr ? 'سبب الحظر:' : 'Ban Reason:'}
                </span>
                <span className="font-bold text-rose-600 dark:text-rose-400 text-end">
                  {restriction.banReason || (isAr ? 'مخالفة معايير وشروط الاستخدام' : 'Terms violation')}
                </span>
              </div>

              {restriction.bannedAt && (
                <div className="flex items-center justify-between pb-2 border-b border-neutral-200/60 dark:border-neutral-800/60">
                  <span className="font-bold text-neutral-500 dark:text-neutral-400">
                    {isAr ? 'تاريخ الحظر:' : 'Banned Date:'}
                  </span>
                  <span className="font-mono text-neutral-700 dark:text-neutral-300">
                    {new Date(restriction.bannedAt).toLocaleString(isAr ? 'ar-EG' : 'en-US')}
                  </span>
                </div>
              )}

              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-[11px] leading-relaxed">
                {isAr
                  ? 'لا يمكنك الوصول إلى أي شاشة أو محادثة أو خدمة في الموقع أثناء فترة الحظر. يمكنك تسجيل الخروج والتبديل لحساب آخر.'
                  : 'You cannot access any service, chat, or screen while banned. You may log out to switch accounts.'}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={onLogout}
                className="w-full py-3.5 px-5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-sm transition-all cursor-pointer shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 active:scale-98"
              >
                <LogOut className="w-4 h-4" />
                <span>{isAr ? 'تسجيل الخروج والتبديل لحساب آخر' : 'Log Out & Switch Account'}</span>
              </button>
            </div>
          </>
        ) : (
          /* ========================================================
             CASE B: الحساب مجمّد مؤقتاً مع عداد الوقت المتبقي
             ======================================================== */
          <>
            {/* Header Icon & Title */}
            <div className="text-center space-y-3">
              <div className="relative mx-auto inline-flex items-center justify-center">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-cyan-500/15 border-2 border-cyan-500/40 text-cyan-500 flex items-center justify-center shadow-xl shadow-cyan-500/20">
                  <Snowflake className="w-10 h-10 sm:w-12 sm:h-12 stroke-[2.2] animate-spin-slow" />
                </div>
                <div className="absolute -bottom-1 -right-1 p-2 rounded-2xl bg-cyan-600 text-neutral-950 shadow-md">
                  <Clock className="w-4 h-4" />
                </div>
              </div>

              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 font-black text-xs border border-cyan-500/30 uppercase tracking-wider">
                  <Snowflake className="w-3.5 h-3.5" />
                  <span>{isAr ? 'تجميد مؤقت للحساب' : 'Account Temporarily Frozen'}</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-neutral-900 dark:text-white">
                  {isAr ? 'حسابك مجمّد مؤقتاً' : 'Your Account is Frozen'}
                </h2>
                <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto leading-relaxed">
                  {isAr
                    ? 'تم تجميد حسابك مؤقتاً بقرار إداري. لا يمكنك تصفح الموقع أو إرسال الرسائل حتى انتهاء المدة أدناه.'
                    : 'Your account has been temporarily frozen. Access is paused until the timer expires.'}
                </p>
                {(userName || userDisplayId) && (
                  <div className="pt-1 flex items-center justify-center gap-2 text-xs text-neutral-500 font-mono">
                    {userName && <span className="font-bold text-neutral-800 dark:text-neutral-200">{userName}</span>}
                    {userDisplayId && (
                      <span className="px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 font-bold">
                        ID: {userDisplayId}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ========================================================
                عداد الوقت المتبقي لفك التجميد التلقائي (LIVE COUNTDOWN)
                ======================================================== */}
            <div className="p-5 rounded-3xl bg-gradient-to-br from-neutral-900 to-neutral-950 text-white border-2 border-cyan-500/40 shadow-xl space-y-3 text-center relative overflow-hidden">
              <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-cyan-400">
                <Clock className="w-4 h-4 animate-pulse" />
                <span>{isAr ? 'الوقت المتبقي لفك التجميد التلقائي:' : 'Remaining Time Until Unfreeze:'}</span>
              </div>

              {justUnfrozen || remainingMs <= 0 ? (
                <div className="py-4 space-y-2 animate-in zoom-in-95 duration-200">
                  <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
                  <h3 className="text-base font-black text-emerald-400">
                    {isAr ? 'انتهت مدة التجميد بنجاح! ✨' : 'Freeze period has ended! ✨'}
                  </h3>
                  <p className="text-xs text-neutral-300">
                    {isAr ? 'جاري فك القفل واستعادة الوصول للمنصة...' : 'Unlocking your account now...'}
                  </p>
                </div>
              ) : (
                <>
                  {/* Digital Clock Boxes */}
                  <div className="flex items-center justify-center gap-2 pt-1 font-mono">
                    {days > 0 && (
                      <div className="flex flex-col items-center">
                        <div className="w-13 h-14 sm:w-16 sm:h-16 rounded-2xl bg-neutral-800/90 border border-neutral-700/80 flex items-center justify-center text-xl sm:text-2xl font-black text-cyan-400 shadow-inner">
                          {padZero(days)}
                        </div>
                        <span className="text-[10px] text-neutral-400 font-bold mt-1">
                          {isAr ? 'يوم' : 'Days'}
                        </span>
                      </div>
                    )}

                    <div className="flex flex-col items-center">
                      <div className="w-13 h-14 sm:w-16 sm:h-16 rounded-2xl bg-neutral-800/90 border border-neutral-700/80 flex items-center justify-center text-xl sm:text-2xl font-black text-cyan-400 shadow-inner">
                        {padZero(hours)}
                      </div>
                      <span className="text-[10px] text-neutral-400 font-bold mt-1">
                        {isAr ? 'ساعة' : 'Hours'}
                      </span>
                    </div>

                    <span className="text-2xl font-black text-cyan-500/70 -mt-4">:</span>

                    <div className="flex flex-col items-center">
                      <div className="w-13 h-14 sm:w-16 sm:h-16 rounded-2xl bg-neutral-800/90 border border-neutral-700/80 flex items-center justify-center text-xl sm:text-2xl font-black text-cyan-400 shadow-inner">
                        {padZero(minutes)}
                      </div>
                      <span className="text-[10px] text-neutral-400 font-bold mt-1">
                        {isAr ? 'دقيقة' : 'Mins'}
                      </span>
                    </div>

                    <span className="text-2xl font-black text-cyan-500/70 -mt-4">:</span>

                    <div className="flex flex-col items-center">
                      <div className="w-13 h-14 sm:w-16 sm:h-16 rounded-2xl bg-neutral-800/90 border border-neutral-700/80 flex items-center justify-center text-xl sm:text-2xl font-black text-white shadow-inner animate-pulse">
                        {padZero(seconds)}
                      </div>
                      <span className="text-[10px] text-neutral-400 font-bold mt-1">
                        {isAr ? 'ثانية' : 'Secs'}
                      </span>
                    </div>
                  </div>

                  {/* Progress Line */}
                  <div className="space-y-1 pt-2">
                    <div className="w-full h-2 rounded-full bg-neutral-800 overflow-hidden border border-neutral-700/60">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-sky-400 transition-all duration-1000 ease-linear rounded-full"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-neutral-400 font-bold px-1">
                      <span>{isAr ? 'بدء التجميد' : 'Start'}</span>
                      <span className="text-cyan-400">{Math.round(progressPercent)}%</span>
                      <span>{isAr ? 'فك القفل' : 'Unlock'}</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Details Box */}
            <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-950/70 border border-neutral-200 dark:border-neutral-800 space-y-2.5 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-neutral-200/60 dark:border-neutral-800/60">
                <span className="font-bold text-neutral-500 dark:text-neutral-400">
                  {isAr ? 'مدة التجميد الإجمالية:' : 'Total Duration:'}
                </span>
                <span className="font-bold text-neutral-900 dark:text-white font-mono">
                  {restriction.freezeDurationMinutes || 0} {isAr ? 'دقيقة' : 'minutes'}
                </span>
              </div>

              {(restriction.freezeExpiresAt || localExpiresWallMs > 0) && (
                <div className="flex items-center justify-between pb-2 border-b border-neutral-200/60 dark:border-neutral-800/60">
                  <span className="font-bold text-neutral-500 dark:text-neutral-400">
                    {isAr ? 'ينتهي التجميد بتاريخ:' : 'Freeze Expires:'}
                  </span>
                  <span className="font-mono text-neutral-700 dark:text-neutral-300">
                    {new Date(localExpiresWallMs).toLocaleTimeString(isAr ? 'ar-EG' : 'en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                </div>
              )}

              {restriction.freezeReason && (
                <div className="flex items-center justify-between">
                  <span className="font-bold text-neutral-500 dark:text-neutral-400">
                    {isAr ? 'السبب:' : 'Reason:'}
                  </span>
                  <span className="font-medium text-neutral-800 dark:text-neutral-200 max-w-[65%] truncate text-end">
                    {restriction.freezeReason}
                  </span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2.5 pt-1">
              <button
                type="button"
                disabled={isRefreshing}
                onClick={handleManualRefresh}
                className="flex-1 py-3 px-4 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-black text-xs sm:text-sm transition-all cursor-pointer shadow-md flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{isRefreshing ? (isAr ? 'جاري الفحص...' : 'Checking...') : (isAr ? 'تحديث حالة الحساب' : 'Check Status')}</span>
              </button>

              <button
                type="button"
                onClick={onLogout}
                className="py-3 px-4 rounded-2xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-bold text-xs sm:text-sm transition-all cursor-pointer border border-neutral-200 dark:border-neutral-700 flex items-center justify-center gap-1.5 active:scale-98"
                title={isAr ? 'تسجيل الخروج والتبديل لحساب آخر' : 'Log out'}
              >
                <LogOut className="w-4 h-4" />
                <span>{isAr ? 'تسجيل الخروج' : 'Log Out'}</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
