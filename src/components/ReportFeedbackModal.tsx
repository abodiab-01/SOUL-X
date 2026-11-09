import React, { useState } from 'react';
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
} from 'lucide-react';
import { Language, AuthUser } from '../types';

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

  const [type, setType] = useState<'suggestion' | 'bug' | 'feedback'>('suggestion');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
        priority: 'medium',
        userId: currentUser?.id,
        userDisplayId: currentUser?.displayId,
        userName: currentUser?.name || (isAr ? 'مستخدم Soul-X' : 'Soul-X User'),
        userEmail: currentUser?.email,
        userAvatar: currentUser?.photoUrl,
      };

      const res = await fetch('/api/feedback/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || (isAr ? 'فشل إرسال البلاغ' : 'Failed to submit feedback'));
      }

      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setTitle('');
        setDescription('');
        onClose();
      }, 2000);
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
            {type === 'suggestion' ? (
              <Lightbulb className="w-5 h-5 text-amber-500" />
            ) : type === 'bug' ? (
              <Bug className="w-5 h-5 text-rose-500" />
            ) : (
              <MessageSquare className="w-5 h-5 text-cyan-500" />
            )}
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-neutral-900 dark:text-white">
              {isAr ? 'تقديم اقتراح أو بلاغ' : 'Submit Suggestion or Report'}
            </h3>
            <p className="text-[11px] sm:text-xs text-neutral-500 dark:text-neutral-400">
              {isAr
                ? 'تصل رسالتك مباشرة إلى لوحة تحكم إدارة Soul-X للمراجعة والمتابعة.'
                : 'Your message is sent directly to the Soul-X Admin Panel.'}
            </p>
          </div>
        </div>

        {isSuccess ? (
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
                  ? 'نشكرك على اقتراحك الرائع! نحن نقدر مساهمتك القيمة في تحسين وتطوير منصة Soul-X.'
                  : 'Thank you for your valuable suggestion! We appreciate your contribution to Soul-X.'
                : type === 'bug'
                ? isAr
                  ? 'شكراً لك على إبلاغنا. سيقوم الفريق التقني بمراجعة المشكلة والعمل على حلها فوراً.'
                  : 'Thank you for reporting. Our team will review and address the issue promptly.'
                : isAr
                ? 'شكراً لك على ملاحظتك الكريمة. نسعى دائماً لتقديم أفضل تجربة.'
                : 'Thank you for your feedback! We strive to deliver the best experience.'}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            {/* Error Message */}
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

            {/* Sender Info Badge (SVG Icon only, no device info checkbox) */}
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
