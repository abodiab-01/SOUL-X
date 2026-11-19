import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  ArrowLeftRight,
  Plus,
  Trash2,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  Mail,
  User as UserIcon,
  Globe,
  Calendar,
  Check,
  ShieldAlert,
  ShieldCheck,
  LogIn,
  UserPlus,
  ChevronDown,
  Search,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Fingerprint,
} from 'lucide-react';
import { Language, AuthUser, Gender } from '../types';
import { getStoredAuthToken, getStoredRefreshToken } from '../lib/authStorage';
import { getDefaultAvatar } from '../lib/avatar';
import { WORLD_COUNTRIES } from '../data/countries';
import { VerifiedBadge } from './VerifiedBadge';

export interface SwitcherAccountItem {
  linkId?: string;
  userId: string;
  displayId?: string;
  name: string;
  email: string;
  photoUrl?: string | null;
  gender?: Gender | null;
  country?: string | null;
  isAdmin?: boolean;
  isVerified?: boolean;
  isBanned?: boolean;
  isFrozen?: boolean;
  addedByMethod?: 'login' | 'register';
  addedAt?: string;
}

export interface AccountSwitchResult {
  token: string;
  refreshToken?: string;
  expiresAt?: string;
  refreshExpiresAt?: string;
  isAdmin: boolean;
  user: AuthUser;
  adminSwitchOriginToken: string | null;
}

interface AdminAccountSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  currentUser: AuthUser | null;
  isAdmin: boolean;
  adminSwitchOriginToken: string | null;
  onAccountSwitched: (result: AccountSwitchResult) => void;
}

const MONTHS_AR = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

const MONTHS_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const AdminAccountSwitcherModal: React.FC<AdminAccountSwitcherModalProps> = ({
  isOpen,
  onClose,
  lang,
  currentUser,
  isAdmin,
  adminSwitchOriginToken,
  onAccountSwitched,
}) => {
  const isAr = lang === 'ar';

  // Unlock state when switched to a regular account (always reset on close so PIN is always requested)
  const [pinInput, setPinInput] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [unlockToken, setUnlockToken] = useState<string | null>(null);

  // Switcher UI state
  const [view, setView] = useState<'list' | 'add-login' | 'add-register' | 'add-2fa'>('list');
  const [adminAccount, setAdminAccount] = useState<SwitcherAccountItem | null>(null);
  const [linkedAccounts, setLinkedAccounts] = useState<SwitcherAccountItem[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [switchingUserId, setSwitchingUserId] = useState<string | null>(null);
  const [confirmUnlinkId, setConfirmUnlinkId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Add by Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [switchAfterAdd, setSwitchAfterAdd] = useState(false);

  // 2FA state for existing account linking
  const [pending2FA, setPending2FA] = useState<{
    tempToken: string;
    name: string;
    email: string;
  } | null>(null);
  const [totpCode, setTotpCode] = useState('');

  // Add by Real Registration form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPass, setShowRegPass] = useState(false);
  const [regGender, setRegGender] = useState<Gender | null>(null);
  const [regCountry, setRegCountry] = useState('');
  const [countrySearch, setCountrySearch] = useState('');
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
  const countryDropdownRef = useRef<HTMLDivElement>(null);
  const [birthYear, setBirthYear] = useState<number>(1998);
  const [birthMonth, setBirthMonth] = useState<number>(9);
  const [birthDay, setBirthDay] = useState<number>(14);

  const isUnlocked = isAdmin || Boolean(unlockToken);

  const buildHeaders = (extra?: Record<string, string>) => {
    const authToken = getStoredAuthToken();
    const refreshToken = getStoredRefreshToken();
    return {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(refreshToken ? { 'X-Refresh-Token': refreshToken } : {}),
      ...(adminSwitchOriginToken ? { 'X-Admin-Switch-Origin': adminSwitchOriginToken } : {}),
      ...(unlockToken ? { 'X-Admin-Switch-Unlock': unlockToken } : {}),
      ...(extra || {}),
    };
  };

  // Sorted & filtered countries
  const sortedCountries = useMemo(() => {
    return [...WORLD_COUNTRIES].sort((a, b) => {
      const nameA = isAr ? a.nameAr : a.nameEn;
      const nameB = isAr ? b.nameAr : b.nameEn;
      return nameA.localeCompare(isAr ? 'ar' : 'en');
    });
  }, [isAr]);

  const filteredCountries = useMemo(() => {
    const q = countrySearch.trim().toLowerCase();
    if (!q) return sortedCountries;
    return sortedCountries.filter(
      (c) =>
        c.nameAr.toLowerCase().includes(q) ||
        c.nameEn.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q)
    );
  }, [sortedCountries, countrySearch]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(e.target as Node)) {
        setIsCountryDropdownOpen(false);
      }
    };
    if (isCountryDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isCountryDropdownOpen]);

  // Age & date calculations
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = currentYear - 18; y >= currentYear - 85; y--) {
    years.push(y);
  }
  const daysInMonth = new Date(birthYear, birthMonth + 1, 0).getDate();
  const validDay = Math.min(birthDay, daysInMonth);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const calculatedAge = (() => {
    const birthObj = new Date(birthYear, birthMonth, validDay);
    const today = new Date();
    let age = today.getFullYear() - birthObj.getFullYear();
    const mDiff = today.getMonth() - birthObj.getMonth();
    if (mDiff < 0 || (mDiff === 0 && today.getDate() < birthObj.getDate())) {
      age--;
    }
    return age;
  })();

  const resetForms = () => {
    setError(null);
    setSuccessMsg(null);
    setLoginEmail('');
    setLoginPassword('');
    setShowLoginPass(false);
    setPending2FA(null);
    setTotpCode('');
    setRegName('');
    setRegEmail('');
    setRegPassword('');
    setRegConfirmPassword('');
    setShowRegPass(false);
    setRegGender(null);
    setRegCountry('');
    setCountrySearch('');
    setIsCountryDropdownOpen(false);
    setBirthYear(1998);
    setBirthMonth(9);
    setBirthDay(14);
    setSwitchAfterAdd(false);
    setConfirmUnlinkId(null);
  };

  useEffect(() => {
    if (!isOpen) {
      setPinInput('');
      setShowPin(false);
      setUnlockToken(null);
      setView('list');
      resetForms();
      return;
    }

    setView('list');
    setError(null);
    setSuccessMsg(null);

    if (isAdmin) {
      fetchLinkedAccounts();
    }
  }, [isOpen, isAdmin]);

  const fetchLinkedAccounts = async (explicitUnlockToken?: string) => {
    setIsLoadingList(true);
    setError(null);
    try {
      const headers = buildHeaders(
        explicitUnlockToken ? { 'X-Admin-Switch-Unlock': explicitUnlockToken } : undefined
      );
      const res = await fetch('/api/admin-switcher/accounts', {
        cache: 'no-store',
        headers,
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAdminAccount(data.adminAccount || null);
        setLinkedAccounts(Array.isArray(data.accounts) ? data.accounts : []);
      } else {
        setError(data.message || (isAr ? 'تعذر تحميل قائمة الحسابات' : 'Failed to load accounts'));
      }
    } catch {
      setError(isAr ? 'تعذر الاتصال بالخادم' : 'Network error');
    } finally {
      setIsLoadingList(false);
    }
  };

  if (!isOpen) return null;

  // Quick Return to Admin directly using ADMIN_PIN (from switched regular account)
  const handleQuickReturnToAdminWithPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinInput.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/admin-switcher/switch', {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({
          targetType: 'admin',
          pin: pinInput.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.user && data.token) {
        onAccountSwitched({
          token: data.token,
          refreshToken: data.refreshToken,
          expiresAt: data.expiresAt,
          refreshExpiresAt: data.refreshExpiresAt,
          isAdmin: Boolean(data.isAdmin),
          user: data.user,
          adminSwitchOriginToken: data.adminSwitchOriginToken || null,
        });
        onClose();
      } else {
        setError(data.message || (isAr ? 'كلمة مرور لوحة التحكم غير صحيحة' : 'Invalid Admin PIN'));
      }
    } catch {
      setError(isAr ? 'حدث خطأ أثناء الاتصال بالخادم' : 'Connection error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Unlock linked accounts list using ADMIN_PIN (so admin can switch to any linked account or manage them)
  const handleUnlockSwitcherList = async () => {
    if (!pinInput.trim()) {
      setError(isAr ? 'يرجى إدخال كلمة مرور لوحة التحكم (PIN)' : 'Please enter Admin Panel PIN');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/admin-switcher/unlock', {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ pin: pinInput.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.unlockToken) {
        setUnlockToken(data.unlockToken);
        setAdminAccount(data.adminAccount || null);
        setLinkedAccounts(Array.isArray(data.accounts) ? data.accounts : []);
        setPinInput('');
      } else {
        setError(data.message || (isAr ? 'كلمة مرور لوحة التحكم غير صحيحة' : 'Invalid Admin PIN'));
      }
    } catch {
      setError(isAr ? 'حدث خطأ أثناء التحقق' : 'Verification error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Switch to Admin or to any linked account once authorized/unlocked
  const handleSwitchToTarget = async (targetType: 'admin' | 'linked', targetUserId?: string) => {
    setSwitchingUserId(targetUserId || 'admin');
    setError(null);
    try {
      const res = await fetch('/api/admin-switcher/switch', {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({
          targetType,
          targetUserId,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.user && data.token) {
        onAccountSwitched({
          token: data.token,
          refreshToken: data.refreshToken,
          expiresAt: data.expiresAt,
          refreshExpiresAt: data.refreshExpiresAt,
          isAdmin: Boolean(data.isAdmin),
          user: data.user,
          adminSwitchOriginToken: data.adminSwitchOriginToken || null,
        });
        onClose();
      } else {
        setError(data.message || (isAr ? 'تعذر التبديل إلى الحساب' : 'Failed to switch account'));
      }
    } catch {
      setError(isAr ? 'تعذر الاتصال بالخادم' : 'Network error');
    } finally {
      setSwitchingUserId(null);
    }
  };

  const handleUnlinkAccount = async (linkId: string) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin-switcher/accounts/${encodeURIComponent(linkId)}`, {
        method: 'DELETE',
        headers: buildHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setLinkedAccounts(Array.isArray(data.accounts) ? data.accounts : []);
        setConfirmUnlinkId(null);
        setSuccessMsg(data.message || (isAr ? 'تمت إزالة الحساب من القائمة' : 'Account removed'));
      } else {
        setError(data.message || (isAr ? 'تعذر حذف الحساب من القائمة' : 'Failed to remove'));
      }
    } catch {
      setError(isAr ? 'تعذر الاتصال بالخادم' : 'Network error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add existing account via real login credentials
  const handleLinkExistingLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = loginEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !loginPassword) {
      setError(isAr ? 'يرجى إدخال البريد الإلكتروني وكلمة المرور' : 'Please enter email and password');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/admin-switcher/link-existing', {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({
          email: cleanEmail,
          password: loginPassword,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.requires2FA && data.tempToken) {
          setPending2FA({
            tempToken: data.tempToken,
            name: data.user?.name || cleanEmail,
            email: data.user?.email || cleanEmail,
          });
          setTotpCode('');
          setView('add-2fa');
          return;
        }
        setAdminAccount(data.adminAccount || adminAccount);
        setLinkedAccounts(Array.isArray(data.accounts) ? data.accounts : []);
        const addedEmail = cleanEmail;
        if (switchAfterAdd && Array.isArray(data.accounts)) {
          const added = data.accounts.find((a: SwitcherAccountItem) => a.email.toLowerCase() === addedEmail);
          if (added) {
            await handleSwitchToTarget('linked', added.userId);
            return;
          }
        }
        resetForms();
        setSuccessMsg(data.message || (isAr ? 'تم ربط الحساب بنجاح' : 'Account linked successfully'));
        setView('list');
      } else {
        setError(data.message || (isAr ? 'فشل التحقق من بيانات الحساب' : 'Authentication failed'));
      }
    } catch {
      setError(isAr ? 'تعذر الاتصال بالخادم' : 'Network error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyLink2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pending2FA || !totpCode.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/admin-switcher/link-existing/verify-2fa', {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({
          tempToken: pending2FA.tempToken,
          code: totpCode.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setLinkedAccounts(Array.isArray(data.accounts) ? data.accounts : []);
        const targetEmail = pending2FA.email.toLowerCase();
        if (switchAfterAdd && Array.isArray(data.accounts)) {
          const added = data.accounts.find((a: SwitcherAccountItem) => a.email.toLowerCase() === targetEmail);
          if (added) {
            await handleSwitchToTarget('linked', added.userId);
            return;
          }
        }
        resetForms();
        setSuccessMsg(data.message || (isAr ? 'تم التحقق وربط الحساب بنجاح' : 'Account linked'));
        setView('list');
      } else {
        setError(data.message || (isAr ? 'رمز التحقق غير صحيح' : 'Invalid verification code'));
      }
    } catch {
      setError(isAr ? 'تعذر الاتصال بالخادم' : 'Network error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add brand new REAL account with full mandatory details
  const handleCreateAndLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = regName.trim();
    const cleanEmail = regEmail.trim().toLowerCase();

    if (!cleanName) {
      setError(isAr ? 'يرجى كتابة الاسم للمتابعة' : 'Please enter full name');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setError(isAr ? 'يرجى إدخال بريد إلكتروني صحيح' : 'Please enter a valid email');
      return;
    }
    if (!regCountry.trim()) {
      setError(isAr ? 'اختيار الدولة خطوة إجبارية' : 'Country is required');
      return;
    }
    if (!regGender) {
      setError(isAr ? 'تحديد الجنس خطوة إجبارية' : 'Gender is required');
      return;
    }
    if (calculatedAge < 18) {
      setError(isAr ? 'يجب أن يكون العمر 18 عاماً أو أكثر' : 'Must be at least 18 years old');
      return;
    }
    if (!regPassword || regPassword.length < 4) {
      setError(isAr ? 'كلمة المرور يجب أن لا تقل عن 4 خانات' : 'Password must be at least 4 characters');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setError(isAr ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match');
      return;
    }

    const formattedBirthDate = `${birthYear}-${String(birthMonth + 1).padStart(2, '0')}-${String(validDay).padStart(
      2,
      '0'
    )}`;

    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/admin-switcher/create-and-link', {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({
          name: cleanName,
          email: cleanEmail,
          country: regCountry.trim(),
          gender: regGender,
          birthDate: formattedBirthDate,
          password: regPassword,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAdminAccount(data.adminAccount || adminAccount);
        setLinkedAccounts(Array.isArray(data.accounts) ? data.accounts : []);
        if (switchAfterAdd && data.createdUserId) {
          await handleSwitchToTarget('linked', data.createdUserId);
          return;
        }
        resetForms();
        setSuccessMsg(data.message || (isAr ? 'تم إنشاء الحساب الحقيقي وربطه بنجاح' : 'Account created and linked'));
        setView('list');
      } else {
        setError(data.message || (isAr ? 'تعذر إنشاء الحساب' : 'Failed to create account'));
      }
    } catch {
      setError(isAr ? 'تعذر الاتصال بالخادم' : 'Network error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-neutral-950/85 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <div className="relative w-full max-w-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 my-auto max-h-[92vh] overflow-y-auto">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 left-4 rtl:left-4 rtl:right-auto ltr:right-4 ltr:left-auto p-2 rounded-full text-neutral-400 hover:text-neutral-900 dark:hover:text-white bg-neutral-100 dark:bg-neutral-800 transition-colors cursor-pointer"
          aria-label={isAr ? 'إغلاق' : 'Close'}
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 pe-8">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
            <ArrowLeftRight className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-extrabold text-neutral-900 dark:text-white truncate">
              {!isUnlocked
                ? isAr
                  ? 'العودة السريعة وتبديل الحساب'
                  : 'Quick Return & Account Switch'
                : isAr
                ? 'تبديل الحسابات السريع وإدارتها'
                : 'Quick Account Switcher & Manager'}
            </h2>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
              {!isUnlocked
                ? isAr
                  ? 'يتطلب كلمة مرور لوحة التحكم (PIN) فقط للتحقق'
                  : 'Requires Admin Panel PIN only'
                : isAr
                ? 'إضافة، حذف، وتبديل فوري بين حساب الأدمن والحسابات المرتبطة'
                : 'Add, remove & switch instantly between Admin and linked accounts'}
            </p>
          </div>
        </div>

        {/* Status Feedback */}
        {error && (
          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2 font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2 font-semibold">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ================================================================= */}
        {/* LOCKED STATE (When currently on a non-admin account switched from Admin) */}
        {/* ================================================================= */}
        {!isUnlocked ? (
          <form onSubmit={handleQuickReturnToAdminWithPin} className="space-y-4 pt-1">
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
              <Lock className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                {isAr
                  ? 'أنت تتصفح حالياً حساباً مرتبطاً تم التبديل إليه من حساب الأدمن. أدخل كلمة مرور لوحة التحكم (ADMIN_PIN) فقط للعودة السريعة إلى حساب الأدمن أو فتح قائمة الحسابات المرتبطة.'
                  : 'You are viewing a linked account switched from Admin. Enter only your Admin Panel PIN to return to Admin or switch to another linked account.'}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300">
                {isAr ? 'كلمة مرور لوحة التحكم (ADMIN_PIN):' : 'Admin Panel Password (PIN):'}
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-neutral-400 absolute start-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showPin ? 'text' : 'password'}
                  autoFocus
                  maxLength={64}
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    setError(null);
                  }}
                  placeholder={isAr ? 'أدخل رمز الـ PIN الإداري...' : 'Enter Admin PIN...'}
                  className="w-full py-3 ps-10 pe-10 text-center font-mono text-base tracking-wider rounded-2xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-neutral-900 dark:text-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPin((p) => !p)}
                  className="absolute end-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer"
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="submit"
                disabled={isSubmitting || !pinInput.trim()}
                className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ShieldCheck className="w-4 h-4" />
                )}
                <span>{isAr ? 'العودة السريعة إلى حساب الأدمن' : 'Quick Return to Admin Account'}</span>
              </button>

              <button
                type="button"
                disabled={isSubmitting || !pinInput.trim()}
                onClick={handleUnlockSwitcherList}
                className="w-full py-2.5 rounded-2xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
              >
                <ArrowLeftRight className="w-4 h-4 text-cyan-500" />
                <span>
                  {isAr
                    ? 'عرض واختيار حساب مرتبط آخر (أو إدارة الحسابات)'
                    : 'View & Switch to Another Linked Account'}
                </span>
              </button>
            </div>
          </form>
        ) : view === 'list' ? (
          /* =============================================================== */
          /* ACCOUNTS LIST & MANAGEMENT VIEW                                  */
          /* =============================================================== */
          <div className="space-y-4">
            {/* Primary Admin Account Card */}
            {adminAccount && (
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/15 to-amber-500/10 border border-amber-500/35 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={adminAccount.photoUrl || getDefaultAvatar(adminAccount.gender || 'male')}
                    alt={adminAccount.name}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = getDefaultAvatar('male');
                    }}
                    className="w-11 h-11 rounded-full object-cover border-2 border-amber-500 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs sm:text-sm font-extrabold text-neutral-900 dark:text-white truncate">
                        {adminAccount.name}
                      </span>
                      <span className="px-1.5 py-0.5 rounded-md bg-amber-500 text-neutral-950 font-mono text-[9px] font-black">
                        ADMIN
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-neutral-600 dark:text-neutral-300 truncate" dir="ltr">
                      {adminAccount.email}
                    </div>
                  </div>
                </div>

                {currentUser?.email?.toLowerCase() === adminAccount.email.toLowerCase() ? (
                  <span className="px-2.5 py-1 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[11px] font-bold shrink-0">
                    {isAr ? 'نشط الآن' : 'Active'}
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={Boolean(switchingUserId)}
                    onClick={() => handleSwitchToTarget('admin', adminAccount.userId)}
                    className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-extrabold text-xs flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    {switchingUserId === 'admin' || switchingUserId === adminAccount.userId ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ShieldCheck className="w-3.5 h-3.5" />
                    )}
                    <span>{isAr ? 'عودة للأدمن' : 'Return'}</span>
                  </button>
                )}
              </div>
            )}

            {/* Header + Add Account CTA */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-xs font-bold text-neutral-600 dark:text-neutral-300">
                {isAr
                  ? `الحسابات المرتبطة (${linkedAccounts.length})`
                  : `Linked Accounts (${linkedAccounts.length})`}
              </span>
              <button
                type="button"
                onClick={() => {
                  resetForms();
                  setView('add-login');
                }}
                className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-extrabold text-xs flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>{isAr ? 'إضافة حساب' : 'Add Account'}</span>
              </button>
            </div>

            {/* Linked Accounts List */}
            {isLoadingList ? (
              <div className="py-10 flex items-center justify-center gap-2 text-xs text-neutral-500">
                <Loader2 className="w-4 h-4 animate-spin text-cyan-500" />
                <span>{isAr ? 'جاري تحميل الحسابات المرتبطة...' : 'Loading linked accounts...'}</span>
              </div>
            ) : linkedAccounts.length === 0 ? (
              <div className="p-6 rounded-2xl bg-neutral-50 dark:bg-neutral-950/60 border border-dashed border-neutral-300 dark:border-neutral-800 text-center space-y-2">
                <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                  {isAr ? 'لا توجد حسابات مرتبطة بعد' : 'No linked accounts yet'}
                </p>
                <p className="text-[11px] text-neutral-500">
                  {isAr
                    ? 'اضغط على "إضافة حساب" لتسجيل الدخول إلى حساب حالي أو إنشاء حساب جديد حقيقي.'
                    : 'Tap "Add Account" to sign in to an existing account or create a real new one.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pe-1">
                {linkedAccounts.map((acc) => {
                  const isActiveAcc =
                    currentUser?.id === acc.userId ||
                    currentUser?.email?.toLowerCase() === acc.email.toLowerCase();
                  const isConfirmingDel = confirmUnlinkId === acc.linkId;

                  return (
                    <div
                      key={acc.linkId || acc.userId}
                      className={`p-3 rounded-2xl border transition-colors ${
                        isActiveAcc
                          ? 'bg-cyan-500/10 border-cyan-500/40'
                          : 'bg-neutral-50 dark:bg-neutral-950/60 border-neutral-200 dark:border-neutral-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={acc.photoUrl || getDefaultAvatar(acc.gender || 'male')}
                            alt={acc.name}
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = getDefaultAvatar(acc.gender || 'male');
                            }}
                            className="w-10 h-10 rounded-full object-cover border border-neutral-300 dark:border-neutral-700 shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-extrabold text-neutral-900 dark:text-white truncate">
                                {acc.name}
                              </span>
                              {acc.isVerified && <VerifiedBadge lang={lang} size="xs" />}
                              {acc.isAdmin && (
                                <span className="px-1.5 py-0.2 rounded bg-amber-500 text-neutral-950 font-mono text-[9px] font-black">
                                  ADMIN
                                </span>
                              )}
                              {acc.isBanned && (
                                <span className="px-1.5 py-0.2 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400 text-[9px] font-bold">
                                  {isAr ? 'محظور' : 'Banned'}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] font-mono text-neutral-500 truncate" dir="ltr">
                              {acc.email}
                            </div>
                            {acc.displayId && (
                              <div className="text-[10px] font-mono text-neutral-400 truncate">
                                {acc.displayId}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {isActiveAcc ? (
                            <span className="px-2.5 py-1 rounded-xl bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 text-[11px] font-bold">
                              {isAr ? 'نشط' : 'Active'}
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={Boolean(switchingUserId)}
                              onClick={() => handleSwitchToTarget('linked', acc.userId)}
                              className="px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {switchingUserId === acc.userId ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <ArrowLeftRight className="w-3.5 h-3.5" />
                              )}
                              <span>{isAr ? 'تبديل' : 'Switch'}</span>
                            </button>
                          )}

                          {acc.linkId && !isConfirmingDel && (
                            <button
                              type="button"
                              onClick={() => setConfirmUnlinkId(acc.linkId!)}
                              className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
                              title={isAr ? 'حذف من القائمة' : 'Remove from list'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {acc.linkId && isConfirmingDel && (
                        <div className="mt-2.5 pt-2.5 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-2 text-[11px]">
                          <span className="text-rose-600 dark:text-rose-400 font-semibold">
                            {isAr ? 'إزالة الحساب من القائمة المرتبطة؟' : 'Remove account from linked list?'}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setConfirmUnlinkId(null)}
                              className="px-2.5 py-1 rounded-lg bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-bold cursor-pointer"
                            >
                              {isAr ? 'إلغاء' : 'Cancel'}
                            </button>
                            <button
                              type="button"
                              disabled={isSubmitting}
                              onClick={() => handleUnlinkAccount(acc.linkId!)}
                              className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer disabled:opacity-50"
                            >
                              {isAr ? 'تأكيد الحذف' : 'Confirm'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : view === 'add-2fa' && pending2FA ? (
          /* =============================================================== */
          /* 2FA CHALLENGE WHEN LINKING AN EXISTING 2FA-ENABLED ACCOUNT       */
          /* =============================================================== */
          <form onSubmit={handleVerifyLink2FA} className="space-y-4">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setPending2FA(null);
                  setView('add-login');
                  setError(null);
                }}
                className="text-xs font-bold text-neutral-500 hover:text-neutral-900 dark:hover:text-white flex items-center gap-1 cursor-pointer"
              >
                {isAr ? <ArrowRight className="w-3.5 h-3.5" /> : <ArrowLeft className="w-3.5 h-3.5" />}
                <span>{isAr ? 'رجوع' : 'Back'}</span>
              </button>
            </div>

            <div className="text-center space-y-1.5">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center mx-auto">
                <Fingerprint className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-extrabold text-neutral-900 dark:text-white">
                {isAr ? 'التحقق من المصادقة الثنائية (2FA)' : 'Two-Factor Verification'}
              </h3>
              <p className="text-xs text-neutral-500">
                {pending2FA.name} ({pending2FA.email})
              </p>
            </div>

            <input
              type="text"
              autoFocus
              value={totpCode}
              onChange={(e) => {
                setTotpCode(e.target.value);
                setError(null);
              }}
              placeholder={isAr ? 'أدخل رمز التحقق (6 أرقام أو رمز احتياطي)...' : 'Enter 6-digit code or backup code...'}
              className="w-full py-3 px-4 text-center font-mono text-base tracking-widest rounded-2xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 focus:border-cyan-500 text-neutral-900 dark:text-white focus:outline-none"
            />

            <button
              type="submit"
              disabled={isSubmitting || !totpCode.trim()}
              className="w-full py-3 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{isAr ? 'تأكيد وربط الحساب' : 'Verify & Link Account'}</span>
            </button>
          </form>
        ) : (
          /* =============================================================== */
          /* ADD ACCOUNT VIEW (TAB A: LOGIN EXISTING | TAB B: CREATE REAL)   */
          /* =============================================================== */
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  resetForms();
                  setView('list');
                }}
                className="text-xs font-bold text-neutral-500 hover:text-neutral-900 dark:hover:text-white flex items-center gap-1 cursor-pointer"
              >
                {isAr ? <ArrowRight className="w-3.5 h-3.5" /> : <ArrowLeft className="w-3.5 h-3.5" />}
                <span>{isAr ? 'العودة للقائمة' : 'Back to List'}</span>
              </button>
            </div>

            {/* Method Toggle Tabs */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setView('add-login');
                }}
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  view === 'add-login'
                    ? 'bg-white dark:bg-neutral-800 text-cyan-600 dark:text-cyan-400 shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{isAr ? 'حساب حالي' : 'Existing Account'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setView('add-register');
                }}
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  view === 'add-register'
                    ? 'bg-white dark:bg-neutral-800 text-cyan-600 dark:text-cyan-400 shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{isAr ? 'إنشاء حساب حقيقي' : 'Create Real Account'}</span>
              </button>
            </div>

            {view === 'add-login' ? (
              <form onSubmit={handleLinkExistingLogin} className="space-y-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    {isAr ? 'البريد الإلكتروني للحساب' : 'Account Email'}
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-neutral-400 absolute start-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="email"
                      required
                      dir="ltr"
                      value={loginEmail}
                      onChange={(e) => {
                        setLoginEmail(e.target.value);
                        setError(null);
                      }}
                      placeholder="name@example.com"
                      className="w-full py-2.5 ps-10 pe-3 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 focus:border-cyan-500 text-sm text-neutral-900 dark:text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    {isAr ? 'كلمة المرور' : 'Password'}
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-neutral-400 absolute start-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showLoginPass ? 'text' : 'password'}
                      required
                      value={loginPassword}
                      onChange={(e) => {
                        setLoginPassword(e.target.value);
                        setError(null);
                      }}
                      placeholder="••••••••"
                      className="w-full py-2.5 ps-10 pe-10 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 focus:border-cyan-500 text-sm text-neutral-900 dark:text-white focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPass((p) => !p)}
                      className="absolute end-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer"
                    >
                      {showLoginPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300 cursor-pointer select-none pt-1">
                  <input
                    type="checkbox"
                    checked={switchAfterAdd}
                    onChange={(e) => setSwitchAfterAdd(e.target.checked)}
                    className="rounded border-neutral-300 text-cyan-500 focus:ring-cyan-500"
                  />
                  <span>{isAr ? 'التبديل إلى الحساب فور ربطه' : 'Switch to this account right after linking'}</span>
                </label>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                  <span>{isAr ? 'تسجيل الدخول وربط الحساب' : 'Sign In & Link Account'}</span>
                </button>
              </form>
            ) : (
              /* Real New Account Creation Form with Full Mandatory Fields */
              <form onSubmit={handleCreateAndLink} className="space-y-3">
                {/* Full Name */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    {isAr ? 'الاسم الكامل *' : 'Full Name *'}
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-neutral-400 absolute start-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={regName}
                      onChange={(e) => {
                        setRegName(e.target.value);
                        setError(null);
                      }}
                      placeholder={isAr ? 'أدخل الاسم الحقيقي للحساب...' : 'Enter full name...'}
                      className="w-full py-2.5 ps-10 pe-3 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 focus:border-cyan-500 text-sm text-neutral-900 dark:text-white focus:outline-none"
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    {isAr ? 'البريد الإلكتروني *' : 'Email Address *'}
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-neutral-400 absolute start-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="email"
                      required
                      dir="ltr"
                      value={regEmail}
                      onChange={(e) => {
                        setRegEmail(e.target.value);
                        setError(null);
                      }}
                      placeholder="newaccount@example.com"
                      className="w-full py-2.5 ps-10 pe-3 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 focus:border-cyan-500 text-sm text-neutral-900 dark:text-white focus:outline-none"
                    />
                  </div>
                </div>

                {/* Mandatory Country Selector */}
                <div className="space-y-1" ref={countryDropdownRef}>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    {isAr ? 'الدولة *' : 'Country *'}
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsCountryDropdownOpen((o) => !o)}
                      className="w-full py-2.5 px-3.5 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 flex items-center justify-between text-sm text-neutral-900 dark:text-white cursor-pointer"
                    >
                      <span className="flex items-center gap-2 truncate">
                        <Globe className="w-4 h-4 text-neutral-400 shrink-0" />
                        <span className={!regCountry ? 'text-neutral-400' : ''}>
                          {regCountry || (isAr ? 'اختر الدولة...' : 'Select country...')}
                        </span>
                      </span>
                      <ChevronDown className="w-4 h-4 text-neutral-400 shrink-0" />
                    </button>

                    {isCountryDropdownOpen && (
                      <div className="absolute z-20 mt-1 w-full rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xl overflow-hidden">
                        <div className="p-2 border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-2">
                          <Search className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                          <input
                            type="text"
                            value={countrySearch}
                            onChange={(e) => setCountrySearch(e.target.value)}
                            placeholder={isAr ? 'ابحث عن الدولة...' : 'Search country...'}
                            className="w-full bg-transparent text-xs text-neutral-900 dark:text-white focus:outline-none"
                          />
                        </div>
                        <div className="max-h-40 overflow-y-auto">
                          {filteredCountries.map((c) => {
                            const label = isAr ? c.nameAr : c.nameEn;
                            return (
                              <button
                                key={c.code}
                                type="button"
                                onClick={() => {
                                  setRegCountry(label);
                                  setIsCountryDropdownOpen(false);
                                  setCountrySearch('');
                                  setError(null);
                                }}
                                className="w-full px-3 py-2 text-start text-xs hover:bg-cyan-500/10 text-neutral-800 dark:text-neutral-200 flex items-center justify-between cursor-pointer"
                              >
                                <span>{label}</span>
                                {regCountry === label && <Check className="w-3.5 h-3.5 text-cyan-500" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Mandatory Gender */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    {isAr ? 'الجنس *' : 'Gender *'}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setRegGender('male');
                        setError(null);
                      }}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        regGender === 'male'
                          ? 'bg-cyan-500/15 border-cyan-500 text-cyan-700 dark:text-cyan-300'
                          : 'bg-neutral-100 dark:bg-neutral-950 border-neutral-300 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400'
                      }`}
                    >
                      {isAr ? 'ذكر' : 'Male'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRegGender('female');
                        setError(null);
                      }}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        regGender === 'female'
                          ? 'bg-rose-500/15 border-rose-500 text-rose-700 dark:text-rose-300'
                          : 'bg-neutral-100 dark:bg-neutral-950 border-neutral-300 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400'
                      }`}
                    >
                      {isAr ? 'أنثى' : 'Female'}
                    </button>
                  </div>
                </div>

                {/* Mandatory Birth Date */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                      <span>{isAr ? 'تاريخ الميلاد *' : 'Date of Birth *'}</span>
                    </label>
                    <span className="text-[11px] font-mono text-neutral-500">
                      {isAr ? `العمر: ${calculatedAge}` : `Age: ${calculatedAge}`}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      value={validDay}
                      onChange={(e) => setBirthDay(Number(e.target.value))}
                      className="py-2 px-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white focus:outline-none"
                    >
                      {days.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                    <select
                      value={birthMonth}
                      onChange={(e) => setBirthMonth(Number(e.target.value))}
                      className="py-2 px-2 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white focus:outline-none"
                    >
                      {(isAr ? MONTHS_AR : MONTHS_EN).map((m, idx) => (
                        <option key={idx} value={idx}>
                          {m}
                        </option>
                      ))}
                    </select>
                    <select
                      value={birthYear}
                      onChange={(e) => setBirthYear(Number(e.target.value))}
                      className="py-2 px-2 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 text-xs text-neutral-900 dark:text-white focus:outline-none"
                    >
                      {years.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Password & Confirm Password */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                      {isAr ? 'كلمة المرور *' : 'Password *'}
                    </label>
                    <div className="relative">
                      <input
                        type={showRegPass ? 'text' : 'password'}
                        required
                        minLength={4}
                        value={regPassword}
                        onChange={(e) => {
                          setRegPassword(e.target.value);
                          setError(null);
                        }}
                        placeholder="••••"
                        className="w-full py-2.5 px-3 pe-9 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 focus:border-cyan-500 text-sm text-neutral-900 dark:text-white focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPass((p) => !p)}
                        className="absolute end-2.5 top-1/2 -translate-y-1/2 text-neutral-400 cursor-pointer"
                      >
                        {showRegPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                      {isAr ? 'تأكيد كلمة المرور *' : 'Confirm Password *'}
                    </label>
                    <input
                      type={showRegPass ? 'text' : 'password'}
                      required
                      minLength={4}
                      value={regConfirmPassword}
                      onChange={(e) => {
                        setRegConfirmPassword(e.target.value);
                        setError(null);
                      }}
                      placeholder="••••"
                      className="w-full py-2.5 px-3 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 focus:border-cyan-500 text-sm text-neutral-900 dark:text-white focus:outline-none"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300 cursor-pointer select-none pt-1">
                  <input
                    type="checkbox"
                    checked={switchAfterAdd}
                    onChange={(e) => setSwitchAfterAdd(e.target.checked)}
                    className="rounded border-neutral-300 text-cyan-500 focus:ring-cyan-500"
                  />
                  <span>{isAr ? 'التبديل إلى الحساب فور إنشائه' : 'Switch to this account right after creation'}</span>
                </label>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  <span>{isAr ? 'إنشاء الحساب الحقيقي وربطه' : 'Create Real Account & Link'}</span>
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
