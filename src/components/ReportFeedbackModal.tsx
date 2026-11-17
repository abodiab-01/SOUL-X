import React, { useState, useEffect } from 'react';
import {
  X,
  Bug,
  Lightbulb,
  MessageSquare,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  History,
  RefreshCw,
  Clock,
} from 'lucide-react';
import { Language, AuthUser, FeedbackReport } from '../types';

interface ReportFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  currentUser?: AuthUser | null;
}

export const ReportFeedbackModal: React.FC<ReportFeedbackModalProps> = ({
  isOpen,
  onClose,
  lang,
  currentUser,
}) => {
  const isAr = lang === 'ar';

  const [viewMode, setViewMode] = useState<'new' | 'history'>('new');
  const [type, setType] = useState<'suggestion' | 'bug' | 'feedback'>('suggestion');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [myReports, setMyReports] = useState<FeedbackReport[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const getAuthHeaders = (withJson = false): Record<string, string> => {
    const headers: Record<string, string> = {};
    if (withJson) headers['Content-Type'] = 'application/json';
    try {
      const token = localStorage.getItem('soulx_auth_token');
      if (token) headers['Authorization'] = `Bearer ${token}`;
    } catch {}
    return headers;
  };

  const loadMyReports = async () => {
    if (!currentUser?.id && !currentUser?.displayId && !currentUser?.email) return;
    setIsLoadingHistory(true);
    try {
      const q = new URLSearchParams();
      if (currentUser.id) q.set('userId', currentUser.id);
      if (currentUser.displayId) q.set('displayId', currentUser.displayId);
      if (currentUser.email) q.set('email', currentUser.email);
      const res = await fetch(`/api/feedback/my?${q.toString()}`, {
        headers: getAuthHeaders(false),
        cache: 'no-store',
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.reports)) {
        setMyReports(data.reports);
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setViewMode('new');
      setErrorMessage(null);
      loadMyReports();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMessage(isAr ? 'يرجى إدخال عنوان مختصر للموضوع' : 'Please enter a title');
      return;
    }
    if (!description.trim()) {
      setErrorMessage(isAr ? 'يرجى كتابة تفاصيل المشكلة أو الاقتراح' : 'Please provide details');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload = {
        type,
        title: title.trim(),
        description: description.trim(),
        priority: type === 'bug' ? 'high' : 'medium',
        userId: currentUser?.id,
        userDisplayId: currentUser?.displayId,
        userName: currentUser?.name || (isAr ? 'مستخدم Soul-X' : 'Soul-X User'),
        userEmail: currentUser?.email,
        userAvatar: currentUser?.photoUrl,
      };

      const res = await fetch('/api/feedback/submit', {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || (isAr ? 'فشل إرسال البلاغ' : 'Failed to submit feedback'));
      }

      setIsSuccess(true);
      await loadMyReports();
      setTimeout(() => {
        setIsSuccess(false);
        setTitle('');
        setDescription('');
        setViewMode('history');
      }, 1500);
    } catch (err: any) {
      setErrorMessage(err.message || (isAr ? 'حدث خطأ أثناء الإرسال' : 'Error sending report'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 left-4 rtl:left-4 rtl:right-auto ltr:right-4 ltr:left-auto p-1.5 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
          aria-label={isAr ? 'إغلاق' : 'Close'}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-500/20">
            {viewMode === 'history' ? (
              <History className="w-5 h-5 text-cyan-500" />
            ) : type === 'suggestion' ? (
              <Lightbulb className="w-5 h-5 text-amber-500" />
            ) : type === 'bug' ? (
              <Bug className="w-5 h-5 text-rose-500" />
            ) : (
              <MessageSquare className="w-5 h-5 text-cyan-500" />
            )}
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-neutral-900 dark:text-white">
              {isAr ? 'البلاغات والاقتراحات' : 'Reports & Suggestions'}
            </h3>
            <p className="text-[11px] sm:text-xs text-neutral-500 dark:text-neutral-400">
              {isAr
                ? 'تصل رسالتك مباشرة إلى لوحة تحكم إدارة Soul-X ويمكنك متابعة الرد هنا.'
                : 'Your message is sent directly to the Admin Panel and you can track replies here.'}
            </p>
          </div>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">
          <button
            type="button"
            onClick={() => {
              setViewMode('new');
              setIsSuccess(false);
            }}
            className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              viewMode === 'new'
                ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-xs'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Send className="w-3.5 h-3.5 text-cyan-500" />
            <span>{isAr ? 'تقديم جديد' : 'New Submission'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setViewMode('history');
              loadMyReports();
            }}
            className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              viewMode === 'history'
                ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-xs'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5 text-amber-500" />
            <span>{isAr ? 'بلاغاتي واقتراحاتي' : 'My Submissions'}</span>
            {myReports.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-cyan-500/15 text-cyan-600 dark:text-cyan-400">
                {myReports.length}
              </span>
            )}
          </button>
        </div>

        {viewMode === 'history' ? (
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-600 dark:text-neutral-400">
                {isAr ? 'حالة البلاغات والاقتراحات المرسلة' : 'Submitted Reports & Suggestions'}
              </span>
              <button
                type="button"
                onClick={loadMyReports}
                disabled={isLoadingHistory}
                className="text-xs font-bold text-cyan-600 dark:text-cyan-400 flex items-center gap-1 cursor-pointer hover:underline"
              >
                <RefreshCw className={`w-3 h-3 ${isLoadingHistory ? 'animate-spin' : ''}`} />
                <span>{isAr ? 'تحديث' : 'Refresh'}</span>
              </button>
            </div>

            {isLoadingHistory && myReports.length === 0 ? (
              <div className="py-10 text-center text-xs text-neutral-500">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-500" />
                <span>{isAr ? 'جاري التحميل...' : 'Loading...'}</span>
              </div>
            ) : myReports.length === 0 ? (
              <div className="py-10 text-center space-y-2 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-4">
                <Clock className="w-8 h-8 text-neutral-400 mx-auto" />
                <p className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                  {isAr ? 'لم تقم بإرسال أي بلاغات أو اقتراحات حتى الآن' : 'You have not submitted any reports yet'}
                </p>
                <button
                  type="button"
                  onClick={() => setViewMode('new')}
                  className="text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
                >
                  {isAr ? 'إرسال أول اقتراح أو بلاغ' : 'Submit your first one'}
                </button>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-80 overflow-y-auto pe-1">
                {myReports.map((r) => (
                  <div
                    key={r.id}
                    className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-bold text-neutral-900 dark:text-white truncate max-w-[65%]">
                        {r.title}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          r.status === 'resolved'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25'
                            : r.status === 'in_review'
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25'
                            : r.status === 'dismissed'
                            ? 'bg-neutral-500/10 text-neutral-500 border-neutral-500/25'
                            : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25'
                        }`}
                      >
                        {r.status === 'resolved'
                          ? isAr ? 'تم الحل ✅' : 'Resolved'
                          : r.status === 'in_review'
                          ? isAr ? 'قيد المراجعة' : 'In Review'
                          : r.status === 'dismissed'
                          ? isAr ? 'مستبعد' : 'Dismissed'
                          : isAr ? 'قيد الانتظار' : 'Pending'}
                      </span>
                    </div>

                    <p className="text-[11px] text-neutral-600 dark:text-neutral-400 whitespace-pre-wrap leading-relaxed">
                      {r.description}
                    </p>

                    {r.adminReply && (
                      <div className="p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20 text-[11px] text-violet-900 dark:text-violet-200 space-y-0.5">
                        <span className="font-bold block text-violet-600 dark:text-violet-400">
                          {isAr ? 'رد الإدارة:' : 'Admin Reply:'}
                        </span>
                        <p className="whitespace-pre-wrap">{r.adminReply}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : isSuccess ? (
          <div className="py-10 text-center space-y-3 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto border border-emerald-500/30">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="text-base font-bold text-neutral-900 dark:text-white">
              {isAr ? 'تم استلام رسالتك بنجاح!' : 'Report Submitted Successfully!'}
            </h4>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto leading-relaxed">
              {type === 'suggestion'
                ? isAr
                  ? 'نشكرك على اقتراحك الرائع! تم إرساله إلى لوحة تحكم الإدارة بنجاح.'
                  : 'Thank you for your suggestion! Sent directly to the Admin Panel.'
                : type === 'bug'
                ? isAr
                  ? 'شكراً لك على إبلاغنا. سيقوم الفريق بمراجعة المشكلة ومتابعتها.'
                  : 'Thank you for reporting. Our team will review this issue promptly.'
                : isAr
                ? 'شكراً لك على ملاحظتك الكريمة. تم تسجيلها في لوحة الإدارة.'
                : 'Thank you for your feedback!'}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Type Selector Tabs */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setType('suggestion')}
                className={`py-2.5 px-2 rounded-2xl border text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  type === 'suggestion'
                    ? 'bg-amber-500/15 border-amber-500 text-amber-700 dark:text-amber-400 shadow-xs'
                    : 'border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                }`}
              >
                <Lightbulb className="w-4 h-4 text-amber-500" />
                <span>{isAr ? 'اقتراح فكرة' : 'Suggestion'}</span>
              </button>

              <button
                type="button"
                onClick={() => setType('bug')}
                className={`py-2.5 px-2 rounded-2xl border text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  type === 'bug'
                    ? 'bg-rose-500/15 border-rose-500 text-rose-700 dark:text-rose-400 shadow-xs'
                    : 'border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                }`}
              >
                <Bug className="w-4 h-4 text-rose-500" />
                <span>{isAr ? 'إبلاغ عن خطأ' : 'Bug Report'}</span>
              </button>

              <button
                type="button"
                onClick={() => setType('feedback')}
                className={`py-2.5 px-2 rounded-2xl border text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  type === 'feedback'
                    ? 'bg-cyan-500/15 border-cyan-500 text-cyan-700 dark:text-cyan-400 shadow-xs'
                    : 'border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                }`}
              >
                <MessageSquare className="w-4 h-4 text-cyan-500" />
                <span>{isAr ? 'ملاحظة عامة' : 'Feedback'}</span>
              </button>
            </div>

            {/* Title Input */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300">
                {isAr
                  ? type === 'suggestion'
                    ? 'عنوان الاقتراح *'
                    : type === 'bug'
                    ? 'عنوان المشكلة أو الخطأ *'
                    : 'عنوان الملاحظة *'
                  : 'Subject / Title *'}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  isAr
                    ? type === 'suggestion'
                      ? 'مثال: إضافة ميزة إرسال صور متحركة بالدردشة...'
                      : type === 'bug'
                      ? 'مثال: لا تظهر قائمة المحادثات عند فتح التطبيق...'
                      : 'اكتب عنواناً مختصراً...'
                    : 'Brief subject...'
                }
                className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white focus:outline-none focus:border-cyan-500 font-medium"
              />
            </div>

            {/* Description Textarea */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300">
                {isAr ? 'التفاصيل والشرح *' : 'Detailed Description *'}
              </label>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  isAr
                    ? type === 'suggestion'
                      ? 'اشرح فكرتك بالتفصيل وكيف ستفيد مستخدمي المنصة...'
                      : type === 'bug'
                      ? 'يرجى كتابة خطوات تكرار المشكلة وماذا حدث بالتحديد لمساعدتنا في معالجتها سريعاً...'
                      : 'اكتب ملاحظاتك بالتفصيل...'
                    : 'Provide full details...'
                }
                className="w-full text-xs p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white focus:outline-none focus:border-cyan-500 font-medium leading-relaxed resize-none"
              />
            </div>

            {/* Sender Info Badge */}
            <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                <span>{isAr ? 'المرسل:' : 'Sender:'}</span>
                <span className="text-neutral-900 dark:text-white font-bold">
                  {currentUser?.name || (isAr ? 'حساب مسجل' : 'Account')}
                </span>
                <span className="font-mono text-[10px] text-neutral-500">
                  ({currentUser?.displayId || currentUser?.email || 'User'})
                </span>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 py-3 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-semibold cursor-pointer transition-colors"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-3 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all active:scale-95 bg-cyan-600 hover:bg-cyan-500 shadow-cyan-600/25"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{isAr ? 'جاري الإرسال للوحة التحكم...' : 'Sending...'}</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>
                      {type === 'suggestion'
                        ? isAr ? 'إرسال الاقتراح للإدارة' : 'Submit Suggestion'
                        : type === 'bug'
                        ? isAr ? 'إرسال البلاغ للإدارة' : 'Submit Bug Report'
                        : isAr ? 'إرسال الملاحظة للإدارة' : 'Submit Feedback'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
