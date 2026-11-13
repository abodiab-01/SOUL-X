import React, { useState, useEffect } from 'react';
import {
  UserX,
  UserCheck,
  RefreshCw,
  ShieldCheck,
  AlertCircle,
  Search,
  X,
} from 'lucide-react';
import { Language, AuthUser, BlockedUserRecord } from '../types';
import { fetchBlockedUsers, unblockUserApi } from '../lib/blockUtils';
import { getEffectiveAvatar, getDefaultAvatar } from '../lib/avatar';
import { formatLocalDate } from '../lib/dateUtils';

interface BlockedUsersViewProps {
  lang: Language;
  currentUser?: AuthUser | null;
  onBack: () => void;
}

export const BlockedUsersView: React.FC<BlockedUsersViewProps> = ({
  lang,
  currentUser,
  onBack: _onBack,
}) => {
  const isAr = lang === 'ar';

  const [blockedUsers, setBlockedUsers] = useState<BlockedUserRecord[]>([]);
  const [isLoadingBlocked, setIsLoadingBlocked] = useState(false);
  const [unblockingUserId, setUnblockingUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [blockedToast, setBlockedToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  const loadBlockedUsers = () => {
    if (!currentUser?.id && !currentUser?.displayId && !currentUser?.email) return;
    setIsLoadingBlocked(true);
    fetchBlockedUsers(currentUser?.id, currentUser?.displayId, currentUser?.email)
      .then((list) => {
        setBlockedUsers(list);
      })
      .catch(() => {})
      .finally(() => {
        setIsLoadingBlocked(false);
      });
  };

  useEffect(() => {
    loadBlockedUsers();
    const handleBlockUpdate = () => loadBlockedUsers();
    window.addEventListener('soulx:blocks-updated', handleBlockUpdate);
    return () => window.removeEventListener('soulx:blocks-updated', handleBlockUpdate);
  }, [currentUser?.id, currentUser?.displayId, currentUser?.email]);

  const handleUnblock = async (targetUserId: string, targetName: string) => {
    const myUid = currentUser?.id || currentUser?.displayId;
    if (!myUid) return;
    setUnblockingUserId(targetUserId);
    try {
      const res = await unblockUserApi({
        userId: myUid,
        targetUserId,
      });
      if (res.success) {
        setBlockedUsers((prev) =>
          prev.filter(
            (u) =>
              u.blockedId !== targetUserId &&
              u.blockedDisplayId !== targetUserId &&
              u.id !== targetUserId
          )
        );
        setBlockedToast({
          message: isAr
            ? `تم فك الحظر عن ${targetName} بنجاح`
            : `Unblocked ${targetName} successfully`,
          type: 'success',
        });
        setTimeout(() => setBlockedToast(null), 3500);
      } else {
        setBlockedToast({
          message:
            res.message ||
            (isAr ? 'تعذر فك الحظر، يرجى المحاولة ثانية' : 'Failed to unblock user'),
          type: 'error',
        });
        setTimeout(() => setBlockedToast(null), 3500);
      }
    } catch {
      setBlockedToast({
        message: isAr
          ? 'حدث خطأ في الاتصال أثناء فك الحظر'
          : 'Connection error while unblocking',
        type: 'error',
      });
      setTimeout(() => setBlockedToast(null), 3500);
    } finally {
      setUnblockingUserId(null);
    }
  };

  const filteredBlockedUsers = blockedUsers.filter((user) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      (user.name && user.name.toLowerCase().includes(q)) ||
      (user.displayId && user.displayId.toLowerCase().includes(q)) ||
      (user.blockedDisplayId && user.blockedDisplayId.toLowerCase().includes(q)) ||
      (user.blockedId && user.blockedId.toLowerCase().includes(q))
    );
  });

  return (
    <div className="w-full flex-1 flex flex-col bg-neutral-50 dark:bg-neutral-950 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5 flex-1">
        {/* بطاقة قائمة المحظورين المستقلة */}
        <div className="bg-white dark:bg-neutral-900/70 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 sm:p-7 space-y-5 shadow-xs">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/20">
                <UserX className="w-5.5 h-5.5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-neutral-900 dark:text-white">
                    {isAr ? 'قائمة المحظورين' : 'Blocked Users'}
                  </h2>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                    {blockedUsers.length} {isAr ? 'محظور' : 'blocked'}
                  </span>
                </div>
                <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">
                  {isAr
                    ? 'المستخدمون المحظورون لا يمكنهم مراسلتك أو إرسال هدايا لك. يمكنك فك الحظر عنهم في أي وقت.'
                    : 'Blocked users cannot message or send gifts to you. You can unblock them at any time.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={loadBlockedUsers}
              disabled={isLoadingBlocked}
              className="self-start sm:self-auto px-3.5 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shrink-0"
              title={isAr ? 'تحديث القائمة' : 'Refresh list'}
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isLoadingBlocked ? 'animate-spin' : ''}`}
              />
              <span>{isAr ? 'تحديث' : 'Refresh'}</span>
            </button>
          </div>

          {/* Search input when there are blocked users */}
          {blockedUsers.length > 0 && (
            <div className="relative">
              <Search className="w-4 h-4 text-neutral-400 absolute top-1/2 -translate-y-1/2 start-3.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  isAr
                    ? 'ابحث بالاسم أو المعرف في قائمة المحظورين...'
                    : 'Search blocked users by name or ID...'
                }
                className="w-full ps-10 pe-9 py-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800 text-xs sm:text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-cyan-500 transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute top-1/2 -translate-y-1/2 end-3 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {/* Feedback Toast */}
          {blockedToast && (
            <div
              className={`p-3.5 rounded-2xl text-xs flex items-center gap-2 animate-in fade-in ${
                blockedToast.type === 'success'
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                  : 'bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400'
              }`}
            >
              {blockedToast.type === 'success' ? (
                <ShieldCheck className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span className="leading-relaxed font-medium">
                {blockedToast.message}
              </span>
            </div>
          )}

          {/* List Content */}
          {isLoadingBlocked && blockedUsers.length === 0 ? (
            <div className="py-10 text-center flex flex-col items-center justify-center gap-2.5 text-neutral-400 text-xs">
              <RefreshCw className="w-6 h-6 animate-spin text-cyan-500" />
              <span>
                {isAr ? 'جاري تحميل قائمة المحظورين...' : 'Loading blocked users...'}
              </span>
            </div>
          ) : blockedUsers.length === 0 ? (
            <div className="py-10 px-4 rounded-2xl bg-neutral-50 dark:bg-neutral-950/40 border border-dashed border-neutral-200 dark:border-neutral-800 text-center flex flex-col items-center justify-center space-y-2.5">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-1">
                <UserCheck className="w-7 h-7" />
              </div>
              <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
                {isAr ? 'لا يوجد أي مستخدم محظور في حسابك' : 'No blocked users'}
              </p>
              <p className="text-xs text-neutral-400 max-w-sm leading-relaxed">
                {isAr
                  ? 'عند قيامك بحظر أي مستخدم من داخل المحادثات أو الملفات الشخصية، سيتم منعه من مراسلتك وستجده مدرجاً هنا مع خيار فك الحظر.'
                  : 'When you block a user from chats or profiles, they will be prevented from messaging you and listed here.'}
              </p>
            </div>
          ) : filteredBlockedUsers.length === 0 ? (
            <div className="py-8 text-center text-xs text-neutral-500">
              {isAr
                ? 'لا توجد نتائج مطابقة لبحثك في قائمة المحظورين'
                : 'No matching blocked users found'}
            </div>
          ) : (
            <div className="space-y-2.5 pt-1">
              {filteredBlockedUsers.map((user) => {
                const targetKey = user.blockedId || user.blockedDisplayId || user.id;
                const isUnblocking =
                  unblockingUserId === targetKey ||
                  unblockingUserId === user.blockedId ||
                  unblockingUserId === user.blockedDisplayId;
                const avatarSrc = getEffectiveAvatar(user.photoUrl, user.gender);

                return (
                  <div
                    key={user.id}
                    className="p-3.5 sm:p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800/80 hover:border-neutral-300 dark:hover:border-neutral-700 flex items-center justify-between gap-3 transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0">
                        <img
                          src={avatarSrc}
                          alt={user.name}
                          className="w-11 h-11 rounded-2xl object-cover border border-neutral-200 dark:border-neutral-800"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = getDefaultAvatar(
                              user.gender
                            );
                          }}
                        />
                        <div className="absolute -bottom-1 -end-1 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center border-2 border-white dark:border-neutral-900">
                          <UserX className="w-2.5 h-2.5" />
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-xs sm:text-sm text-neutral-900 dark:text-white truncate">
                            {user.name}
                          </h4>
                          {user.country && (
                            <span className="text-[10px] text-neutral-400 truncate hidden sm:inline">
                              • {user.country}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span
                            className="text-[11px] font-mono text-cyan-600 dark:text-cyan-400 font-semibold"
                            dir="ltr"
                          >
                            {user.displayId || user.blockedDisplayId || user.blockedId}
                          </span>
                          {user.blockedAt && (
                            <span className="text-[10px] text-neutral-400">
                              {isAr ? 'محظور منذ:' : 'Blocked:'}{' '}
                              {formatLocalDate(user.blockedAt, lang)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleUnblock(targetKey, user.name)}
                      disabled={isUnblocking}
                      className="px-3.5 sm:px-4 py-2 rounded-xl bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700 font-bold text-xs shadow-xs hover:border-cyan-500 transition-all cursor-pointer flex items-center gap-1.5 shrink-0 active:scale-95 disabled:opacity-50"
                      title={isAr ? 'فك الحظر' : 'Unblock'}
                    >
                      {isUnblocking ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-500" />
                          <span>{isAr ? 'جاري الفك...' : 'Unblocking...'}</span>
                        </>
                      ) : (
                        <>
                          <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                          <span>{isAr ? 'فك الحظر' : 'Unblock'}</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
