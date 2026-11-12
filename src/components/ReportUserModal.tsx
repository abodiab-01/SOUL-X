import React, { useState } from 'react';
import {
  X,
  Flag,
  AlertTriangle,
  Flame,
  ShieldAlert,
  UserX,
  AlertOctagon,
  UserMinus,
  MessageSquareWarning,
  Check,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  Info,
} from 'lucide-react';
import { Language, AuthUser } from '../types';

export interface ReportTargetUser {
  id: string;
  displayId?: string;
  name: string;
  avatar?: string;
  email?: string;
}

interface ReportUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  currentUser?: AuthUser | null;
  targetUser: ReportTargetUser | null;
  source?: 'chat' | 'matching';
  onSuccess?: () => void;
}

interface ReportReasonOption {
  id: string;
  labelAr: string;
  labelEn: string;
  descAr: string;
  descEn: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
}

const REPORT_REASONS: ReportReasonOption[] = [
  {
    id: 'محتوى جنسي',
    labelAr: 'محتوى جنسي',
    labelEn: 'Sexual Content',
    descAr: 'صور أو رسائل خادشة للحياء أو محتوى غير لائق',
    descEn: 'Inappropriate, explicit, or adult messages/photos',
    icon: Flame,
    color: 'text-rose-500',
    bgColor: 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400',
  },
  {
    id: 'احتيالي',
    labelAr: 'احتيالي',
    labelEn: 'Fraud / Scam',
    descAr: 'محاولات نصب، طلب أموال، أو احتيال مالي',
    descEn: 'Financial scams, suspicious requests, or deception',
    icon: ShieldAlert,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400',
  },
  {
    id: 'مستخدم ما دون 18 سنة',
    labelAr: 'مستخدم ما دون 18 سنة',
    labelEn: 'User Under 18',
    descAr: 'المستخدم قاصر دون السن القانوني المسموح به',
    descEn: 'User is a minor below the allowed legal age',
    icon: UserX,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10 border-orange-500/30 text-orange-600 dark:text-orange-400',
  },
  {
    id: 'إساءة',
    labelAr: 'إساءة',
    labelEn: 'Abuse / Insults',
    descAr: 'شتائم، كراهية، تنمر، أو سلوك مسيء وغير محترم',
    descEn: 'Offensive language, insults, hate speech, or bullying',
    icon: MessageSquareWarning,
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400',
  },
  {
    id: 'تحرش',
    labelAr: 'تحرش',
    labelEn: 'Harassment',
    descAr: 'إلحاح مزعج، ملاحقة، أو مضايقة مستمرة رغماً عن الطرف الآخر',
    descEn: 'Persistent unwanted contact, stalking, or harassment',
    icon: AlertOctagon,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400',
  },
  {
    id: 'انتحال شخصية أخرى',
    labelAr: 'انتحال شخصية أخرى',
    labelEn: 'Impersonation',
    descAr: 'استخدام صور أو اسم شخص آخر والادعاء بأنه هو',
    descEn: 'Pretending to be someone else or using fake identity',
    icon: UserMinus,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400',
  },
];

export const ReportUserModal: React.FC<ReportUserModalProps> = ({
  isOpen,
  onClose,
  lang,
  currentUser,
  targetUser,
  source = 'chat',
  onSuccess,
}) => {
  const isAr = lang === 'ar';

  const [selectedReason, setSelectedReason] = useState<string>('');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !targetUser) return null;

  const handleSelectReason = (reasonId: string) => {
    if (selectedReason === reasonId) {
      setSelectedReason(''); // Toggle deselect
    } else {
      setSelectedReason(reasonId);
    }
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload = {
        reporterId: currentUser?.id,
        reporterDisplayId: currentUser?.displayId,
        reporterName: currentUser?.name || (isAr ? 'مستخدم Soul-X' : 'Soul-X User'),
        reporterEmail: currentUser?.email,
        reporterAvatar: currentUser?.photoUrl,
        reportedUserId: targetUser.id,
        reportedUserDisplayId: targetUser.displayId || targetUser.id,
        reportedUserName: targetUser.name,
        reportedUserAvatar: targetUser.avatar,
        reportedUserEmail: targetUser.email,
        reason: selectedReason || (isAr ? 'غير محدد' : 'Not specified'),
        details: details.trim(),
        source,
      };

      const res = await fetch('/api/reports/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || (isAr ? 'فشل إرسال البلاغ' : 'Failed to submit report'));
      }

      setIsSuccess(true);
      window.dispatchEvent(
        new CustomEvent('soulx:user-reported', {
          detail: {
            reportedUserId: targetUser.id,
            reason: selectedReason,
          },
        })
      );

      setTimeout(() => {
        setIsSuccess(false);
        setSelectedReason('');
        setDetails('');
        onSuccess?.();
        onClose();
      }, 2200);
    } catch (err: any) {
      setErrorMessage(err.message || (isAr ? 'حدث خطأ أثناء إرسال البلاغ' : 'Error submitting report'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-neutral-950/80 backdrop-blur-md animate-in fade-in duration-200"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <div className="relative w-full max-w-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 left-4 rtl:left-4 rtl:right-auto ltr:right-4 ltr:left-auto p-2 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
          aria-label={isAr ? 'إغلاق' : 'Close'}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0 border border-rose-500/20">
            <Flag className="w-6 h-6 stroke-[2.3]" />
          </div>
          <div className="min-w-0 pr-6 rtl:pr-0 rtl:pl-6">
            <h3 className="text-base sm:text-lg font-black text-neutral-900 dark:text-white leading-tight">
              {isAr ? 'إبلاغ عن مستخدم' : 'Report User'}
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              {source === 'matching'
                ? isAr
                  ? 'تقديم بلاغ عن شريك المحادثة من شاشة المطابقة'
                  : 'Report matched chat partner'
                : isAr
                ? 'تقديم بلاغ عن مستخدم من شاشة المراسلة'
                : 'Report user from messaging screen'}
            </p>
          </div>
        </div>

        {/* Target User Info Banner */}
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800">
          <img
            src={
              targetUser.avatar ||
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'
            }
            alt={targetUser.name}
            className="w-11 h-11 rounded-full object-cover border-2 border-rose-500/30 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-neutral-900 dark:text-white truncate">
                {targetUser.name}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-bold">
                ID: {targetUser.displayId || targetUser.id}
              </span>
            </div>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
              {isAr ? 'المستخدم المبلغ عنه في إدارة المنصة' : 'Reported user for admin review'}
            </p>
          </div>
        </div>

        {/* Success State */}
        {isSuccess ? (
          <div className="py-8 text-center space-y-3 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto border border-emerald-500/20">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="text-base font-bold text-neutral-900 dark:text-white">
              {isAr ? 'تم استلام بلاغك بنجاح' : 'Report Received Successfully'}
            </h4>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto leading-relaxed">
              {isAr
                ? 'شكراً لك لمساعدتنا في الحفاظ على مجتمع Soul-X آمناً ومحترماً. تم تحويل البلاغ للوحة تحكم الإدارة للمراجعة واتخاذ الإجراء اللازم.'
                : 'Thank you for helping keep Soul-X safe and respectful. The report has been sent to the Admin Panel for immediate review.'}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Reason Selection Header */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-cyan-500" />
                  <span>{isAr ? 'سبب البلاغ (اختياري من أحد الخيارات):' : 'Reason (Optional from choices):'}</span>
                </label>
                {selectedReason && (
                  <button
                    type="button"
                    onClick={() => setSelectedReason('')}
                    className="text-[11px] text-neutral-400 hover:text-rose-500 cursor-pointer transition-colors"
                  >
                    {isAr ? 'إلغاء التحديد' : 'Clear selection'}
                  </button>
                )}
              </div>

              {/* 6 Predefined Choices */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {REPORT_REASONS.map((r) => {
                  const Icon = r.icon;
                  const isSelected = selectedReason === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => handleSelectReason(r.id)}
                      className={`p-3 rounded-2xl border text-start transition-all cursor-pointer flex items-start gap-2.5 relative group ${
                        isSelected
                          ? 'border-rose-500 bg-rose-500/10 dark:bg-rose-950/30 ring-2 ring-rose-500/20 shadow-xs'
                          : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 hover:border-neutral-300 dark:hover:border-neutral-700'
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                          isSelected ? 'bg-rose-500 text-white' : r.bgColor
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className={`text-xs font-bold truncate ${
                              isSelected ? 'text-rose-600 dark:text-rose-400' : 'text-neutral-900 dark:text-white'
                            }`}
                          >
                            {isAr ? r.labelAr : r.labelEn}
                          </span>
                          {isSelected && (
                            <span className="w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center text-[10px] shrink-0 font-bold">
                              ✓
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400 line-clamp-1 mt-0.5">
                          {isAr ? r.descAr : r.descEn}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Optional Additional Details */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                <span>{isAr ? 'تفاصيل أو ملاحظات إضافية (اختياري):' : 'Additional Details (Optional):'}</span>
                <span className="text-[10px] text-neutral-400">{details.length}/300</span>
              </label>
              <textarea
                rows={3}
                maxLength={300}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder={
                  isAr
                    ? 'اكتب أي تفاصيل توضيحية تساعد فريق الدعم والإدارة في التحقق...'
                    : 'Provide any helpful context for the support and moderation team...'
                }
                className="w-full p-3 text-xs sm:text-sm rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 resize-none leading-relaxed"
              />
            </div>

            {/* MANDATORY WARNING/NOTICE BANNER */}
            <div className="p-3.5 rounded-2xl bg-amber-500/10 dark:bg-amber-950/25 border-2 border-amber-500/35 flex items-start gap-3 text-amber-800 dark:text-amber-300">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5 animate-pulse" />
              <div className="text-xs leading-relaxed font-semibold">
                {isAr
                  ? 'تنبيه: من الممكن تواصل الدعم مع مقدم البلاغ للحصول على المزيد من التفاصيل.'
                  : 'Notice: Support may contact the reporter to obtain further details.'}
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50 transition-all active:scale-95"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{isAr ? 'جاري إرسال البلاغ...' : 'Submitting report...'}</span>
                  </>
                ) : (
                  <>
                    <Flag className="w-4 h-4" />
                    <span>{isAr ? 'إرسال البلاغ' : 'Submit Report'}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-3 rounded-2xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-bold text-xs sm:text-sm cursor-pointer transition-colors active:scale-95"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
