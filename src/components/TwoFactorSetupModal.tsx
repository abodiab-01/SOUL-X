import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  ShieldAlert,
  Copy,
  Check,
  QrCode,
  KeyRound,
  Lock,
  Loader2,
  AlertCircle,
  Download,
} from 'lucide-react';
import { Language, AuthUser } from '../types';
import { getStoredAuthToken, getStoredRefreshToken } from '../lib/authStorage';

interface TwoFactorSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  currentUser?: AuthUser | null;
  onStatusChanged: (enabled: boolean) => void;
  mode: 'enable' | 'disable';
}

export const TwoFactorSetupModal: React.FC<TwoFactorSetupModalProps> = ({
  isOpen,
  onClose,
  lang,
  onStatusChanged,
  mode,
}) => {
  const isAr = lang === 'ar';

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Setup data when enabling
  const [setupData, setSetupData] = useState<{
    secret: string;
    manualEntryKey: string;
    backupCodes: string[];
    qrCodeDataUrl: string;
  } | null>(null);

  // Input code for verification (either for enabling or disabling)
  const [verifyCode, setVerifyCode] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);

  // Load setup data when opening in enable mode
  useEffect(() => {
    if (!isOpen) {
      setSetupData(null);
      setVerifyCode('');
      setError(null);
      setSuccessMessage(null);
      return;
    }

    if (mode === 'enable') {
      fetchSetupData();
    }
  }, [isOpen, mode]);

  const getAuthHeaders = () => {
    const token = getStoredAuthToken();
    const refreshToken = getStoredRefreshToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(refreshToken ? { 'X-Refresh-Token': refreshToken } : {}),
    };
  };

  const fetchSetupData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/2fa/setup', {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || (isAr ? 'فشل تحميل بيانات المصادقة' : 'Failed to generate 2FA credentials'));
      }
      setSetupData({
        secret: data.secret,
        manualEntryKey: data.manualEntryKey,
        backupCodes: data.backupCodes || [],
        qrCodeDataUrl: data.qrCodeDataUrl,
      });
    } catch (err: any) {
      setError(err?.message || (isAr ? 'حدث خطأ في الاتصال' : 'Network error'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyKey = () => {
    if (!setupData) return;
    navigator.clipboard.writeText(setupData.secret);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleCopyBackupCodes = () => {
    if (!setupData) return;
    const text = setupData.backupCodes.join('\n');
    navigator.clipboard.writeText(text);
    setCopiedCodes(true);
    setTimeout(() => setCopiedCodes(false), 2000);
  };

  // Confirm activation by checking the 6-digit code
  const handleConfirmEnable = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = verifyCode.trim();
    if (!cleanCode || cleanCode.length < 6) {
      setError(isAr ? 'يرجى إدخال رمز التحقق المكون من 6 أرقام' : 'Please enter the 6-digit code');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/2fa/enable', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ code: cleanCode }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || (isAr ? 'رمز التحقق غير صحيح' : 'Invalid verification code'));
      }

      setSuccessMessage(isAr ? 'تم تفعيل المصادقة الثنائية بنجاح!' : 'Two-Factor Authentication Enabled!');
      onStatusChanged(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err?.message || (isAr ? 'فشل التفعيل، تحقق من الكود' : 'Failed to verify'));
    } finally {
      setIsLoading(false);
    }
  };

  // Confirm deactivation by verifying code first (Required by user prompt: "حتى الغائه يطلب كود التحقق")
  const handleConfirmDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = verifyCode.trim();
    if (!cleanCode) {
      setError(isAr ? 'يرجى إدخال رمز التحقق أو رمز احتياطي لإلغاء التفعيل' : 'Please enter verification code or backup code');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/2fa/disable', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ code: cleanCode }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || (isAr ? 'كود التحقق غير صحيح' : 'Invalid verification code'));
      }

      setSuccessMessage(isAr ? 'تم تعطيل المصادقة الثنائية بنجاح' : 'Two-Factor Authentication Disabled');
      onStatusChanged(false);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err?.message || (isAr ? 'فشل التعطيل، تأكد من كود التحقق' : 'Failed to disable'));
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
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
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border ${
              mode === 'enable'
                ? 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20'
                : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
            }`}
          >
            {mode === 'enable' ? <ShieldCheck className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-neutral-900 dark:text-white">
              {mode === 'enable'
                ? isAr ? 'تفعيل المصادقة الثنائية (Google Authenticator)' : 'Enable Google Authenticator'
                : isAr ? 'تعطيل المصادقة الثنائية' : 'Disable Two-Factor Authentication'}
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {mode === 'enable'
                ? isAr
                  ? 'حماية إضافية لحسابك باستخدام رموز مؤقتة متجددة كل 30 ثانية.'
                  : 'Extra protection for your account with 30-second rotating codes.'
                : isAr
                ? 'يتطلب إلغاء التفعيل إدخال كود المصادقة الحالي أو رمز احتياطي لتأكيد هويتك.'
                : 'Requires your current 2FA code or backup code to confirm deactivation.'}
            </p>
          </div>
        </div>

        {/* Alert/Error Messages */}
        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span className="font-bold">{successMessage}</span>
          </div>
        )}

        {/* ========================================================
            MODE A: ENABLE 2FA FLOW
            ======================================================== */}
        {mode === 'enable' && (
          <div className="space-y-4">
            {isLoading && !setupData ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-cyan-600">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="text-xs font-bold">{isAr ? 'جاري إنشاء مفاتيح الأمان...' : 'Generating security keys...'}</span>
              </div>
            ) : setupData ? (
              <>
                {/* Step 1: Scan QR or copy key */}
                <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-neutral-800 dark:text-neutral-200">
                    <QrCode className="w-4 h-4 text-cyan-500" />
                    <span>{isAr ? 'الخطوة 1: امسح الرمز أو أدخل المفتاح' : 'Step 1: Scan QR or enter key'}</span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-4 pt-1">
                    {/* QR Code */}
                    <div className="p-2 rounded-2xl bg-white border border-neutral-200 shrink-0 shadow-xs">
                      <img
                        src={setupData.qrCodeDataUrl}
                        alt="2FA QR Code"
                        className="w-36 h-36 object-contain rounded-xl"
                      />
                    </div>

                    {/* Manual Key */}
                    <div className="flex-1 space-y-2 text-center sm:text-start min-w-0">
                      <p className="text-[11px] text-neutral-500 leading-relaxed">
                        {isAr
                          ? 'افتح تطبيق Google Authenticator واختر مسح رمز QR أو إدخال مفتاح الإعداد يدوياً:'
                          : 'Open Google Authenticator app, tap + and scan this QR code or type key:'}
                      </p>
                      <div className="flex items-center gap-1.5 p-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                        <KeyRound className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                        <span className="font-mono text-xs font-bold text-neutral-900 dark:text-white truncate flex-1 select-all" dir="ltr">
                          {setupData.manualEntryKey}
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyKey}
                          className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 hover:text-cyan-500 transition-colors cursor-pointer shrink-0"
                          title={isAr ? 'نسخ المفتاح' : 'Copy Key'}
                        >
                          {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 2: Backup recovery codes */}
                <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5" />
                      {isAr ? 'الرموز الاحتياطية (احفظها في مكان آمن):' : 'Backup Recovery Codes:'}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyBackupCodes}
                      className="text-[11px] text-amber-600 dark:text-amber-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {copiedCodes ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedCodes ? (isAr ? 'تم النسخ' : 'Copied') : (isAr ? 'نسخ الكل' : 'Copy All')}</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-neutral-500">
                    {isAr
                      ? 'يمكن استخدام كل رمز لمرة واحدة فقط لتسجيل الدخول في حال فقدت هاتفك.'
                      : 'Each code can be used once to log in if you lose access to your phone.'}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1" dir="ltr">
                    {setupData.backupCodes.map((code, idx) => (
                      <div
                        key={idx}
                        className="py-1 px-2 rounded-lg bg-white/80 dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-800 font-mono text-[11px] text-center font-bold text-neutral-800 dark:text-neutral-200"
                      >
                        {code}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Step 3: Enter 6-digit verification code to confirm */}
                <form onSubmit={handleConfirmEnable} className="space-y-3 pt-1">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300">
                      {isAr
                        ? 'الخطوة 2: أدخل رمز التحقق (6 أرقام) للتأكيد والتفعيل:'
                        : 'Step 2: Enter 6-digit code from Google Authenticator:'}
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      autoFocus
                      value={verifyCode}
                      onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="123456"
                      dir="ltr"
                      className="w-full h-12 text-center font-mono text-xl tracking-[0.4em] font-black rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || verifyCode.trim().length < 6}
                    className="w-full py-3.5 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-black text-xs sm:text-sm transition-all cursor-pointer shadow-md shadow-cyan-500/25 active:scale-98 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4 stroke-[2.5]" />}
                    <span>{isAr ? 'تأكيد وتفعيل المصادقة الثنائية' : 'Confirm and Enable 2FA'}</span>
                  </button>
                </form>
              </>
            ) : null}
          </div>
        )}

        {/* ========================================================
            MODE B: DISABLE 2FA FLOW (Requires Verification Code)
            ======================================================== */}
        {mode === 'disable' && (
          <form onSubmit={handleConfirmDisable} className="space-y-4 pt-1">
            <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/20 space-y-2 text-xs">
              <span className="font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" />
                {isAr ? 'تأكيد أمني مطلوب' : 'Security Confirmation Required'}
              </span>
              <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed text-[11px]">
                {isAr
                  ? 'لحماية حسابك من الإلغاء غير المصرح به، يرجى إدخال كود المصادقة الحالي المكون من 6 أرقام من تطبيق Google Authenticator (أو أحد الرموز الاحتياطية) لإتمام التعطيل.'
                  : 'To protect your account, enter the current 6-digit Authenticator code (or backup code) to disable 2FA.'}
              </p>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300">
                {isAr ? 'كود التحقق (أو رمز احتياطي):' : 'Verification or Backup Code:'}
              </label>
              <input
                type="text"
                autoFocus
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.trim())}
                placeholder={isAr ? 'مثال: 123456 أو XXXX-XXXX' : 'e.g. 123456 or XXXX-XXXX'}
                dir="ltr"
                className="w-full h-12 text-center font-mono text-lg font-black rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3.5 rounded-2xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-bold text-xs transition-colors cursor-pointer"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>

              <button
                type="submit"
                disabled={isLoading || !verifyCode.trim()}
                className="flex-1 py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs transition-all cursor-pointer shadow-md shadow-rose-600/25 active:scale-98 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
                <span>{isAr ? 'تأكيد التعطيل' : 'Confirm Disable'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
