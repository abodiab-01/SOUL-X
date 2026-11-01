import React, { useState, useRef } from 'react';
import {
  Pencil,
  Trash2,
  Upload,
  Calendar,
  User as UserIcon,
  Settings,
  LogOut,
  X,
  Check,
  ShieldCheck,
  ShieldAlert,
  Bell,
  Lock,
  Copy,
  Wallet,
  ChevronLeft,
  ChevronRight,
  Plus,
  Send,
  Sparkles,
  Bot,
  Mail,
  Loader2,
} from 'lucide-react';
import { Language, Gender, AuthUser } from '../types';
import { UseTelegramAuthReturn } from '../hooks/useTelegramAuth';
import { uploadAvatarToSupabase, deleteAvatarFromSupabase } from '../lib/supabase';

interface AccountViewProps {
  lang: Language;
  walletBalance: number;
  onOpenWallet: () => void;
  onOpenSettings: () => void;
  auth: UseTelegramAuthReturn;
  onOpenTelegramModal: () => void;
  birthDate?: string | null;
  gender?: Gender | null;
  onOpenEditProfile?: () => void;
  currentUser?: AuthUser | null;
  onLogout?: () => void;
  onOpenAdminPanel?: () => void;
}

export const AccountView: React.FC<AccountViewProps> = ({
  lang,
  walletBalance,
  onOpenWallet,
  onOpenSettings,
  auth,
  onOpenTelegramModal,
  birthDate,
  gender,
  onOpenEditProfile,
  currentUser,
  onLogout,
  onOpenAdminPanel,
}) => {
  const isAr = lang === 'ar';

  // Check if current user is an authorized admin (ADMIN1 or ADMIN2) from environment variables
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminRole, setAdminRole] = useState<'ADMIN1' | 'ADMIN2' | null>(null);
  const [adminConfig, setAdminConfig] = useState<{ admin1: string; admin2: string }>({
    admin1: 'lasmr.ok9900@gmail.com',
    admin2: 'admin@soulx.app',
  });

  React.useEffect(() => {
    fetch('/api/admin/config')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          const a1 = (data.admin1 || 'lasmr.ok9900@gmail.com').toLowerCase().trim();
          const a2 = (data.admin2 || 'admin@soulx.app').toLowerCase().trim();
          setAdminConfig({ admin1: a1, admin2: a2 });

          const currentEmail = currentUser?.email?.toLowerCase().trim();
          if (currentEmail) {
            if (currentEmail === a1) {
              setIsAdmin(true);
              setAdminRole('ADMIN1');
            } else if (currentEmail === a2) {
              setIsAdmin(true);
              setAdminRole('ADMIN2');
            } else {
              setIsAdmin(false);
              setAdminRole(null);
            }
          } else {
            setIsAdmin(false);
            setAdminRole(null);
          }
        }
      })
      .catch(() => {
        const currentEmail = currentUser?.email?.toLowerCase().trim();
        if (currentEmail === 'lasmr.ok9900@gmail.com') {
          setIsAdmin(true);
          setAdminRole('ADMIN1');
        } else if (currentEmail === 'admin@soulx.app') {
          setIsAdmin(true);
          setAdminRole('ADMIN2');
        } else {
          setIsAdmin(false);
          setAdminRole(null);
        }
      });
  }, [currentUser?.email]);

  const tgUser = auth.telegramUser;

  // Profile image state with fallback or Telegram avatar
  const [profileImage, setProfileImage] = useState<string | null>(() => {
    return currentUser?.photoUrl || tgUser?.photo_url || '/src/assets/images/soulx_audio_spatial_1793489090595.jpg';
  });
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showLogoutAlert, setShowLogoutAlert] = useState(false);

  // Dynamic user ID: Authenticated account ID, or Telegram ID, or fallback
  const effectiveUserId = currentUser ? currentUser.id : tgUser ? tgUser.id.toString() : '549182301';
  const displayName = currentUser
    ? currentUser.name
    : tgUser
    ? `${tgUser.first_name} ${tgUser.last_name || ''}`.trim()
    : isAr
    ? 'عبدالله الناصر'
    : 'Abdullah Al-Nasser';

  const [copiedId, setCopiedId] = useState(false);

  const handleCopyId = () => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(effectiveUserId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  // Sync profile image if telegram photo becomes available
  React.useEffect(() => {
    if (tgUser?.photo_url) {
      setProfileImage(tgUser.photo_url);
    }
  }, [tgUser?.photo_url]);

  // Hidden file input ref
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Bio state (Chat & Dating profile bio)
  const defaultBio = isAr
    ? 'أبحث عن تواصل حقيقي وعلاقة صادقة مبنية على التفاهم والاهتمامات المشتركة. أحب السفر، القهوة المختصة، والنقاشات الهادئة.'
    : 'Seeking a meaningful connection and genuine bond built on mutual understanding and shared values. Passionate about travel and good conversations.';
  const [bio, setBio] = useState(defaultBio);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [tempBio, setTempBio] = useState(defaultBio);

  const handleSaveBio = () => {
    setBio(tempBio);
    setIsEditingBio(false);
  };

  const handleCancelBio = () => {
    setTempBio(bio);
    setIsEditingBio(false);
  };

  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Handle uploading photo to Supabase Storage (Bucket: soul-x)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPhoto(true);
    setPhotoError(null);

    try {
      const res = await uploadAvatarToSupabase(effectiveUserId, file);
      if (res.success && res.avatarUrl) {
        setProfileImage(res.avatarUrl);

        // Update local session
        if (currentUser) {
          const updated = { ...currentUser, photoUrl: res.avatarUrl };
          localStorage.setItem('soulx_auth_user', JSON.stringify(updated));
        }

        setShowPhotoModal(false);
      } else {
        setPhotoError(res.error || (isAr ? 'تعذر رفع الصورة إلى خوادم التخزين' : 'Failed to upload photo'));
      }
    } catch (err: any) {
      setPhotoError(err?.message || (isAr ? 'حدث خطأ أثناء رفع الصورة' : 'Error uploading photo'));
    } finally {
      setIsUploadingPhoto(false);
      if (e.target) e.target.value = '';
    }
  };

  // Handle deleting photo from Supabase Storage & Database
  const handleDeletePhoto = async () => {
    setIsUploadingPhoto(true);
    setPhotoError(null);

    try {
      await deleteAvatarFromSupabase(effectiveUserId, profileImage || undefined);
      setProfileImage(null);

      if (currentUser) {
        const updated = { ...currentUser, photoUrl: undefined };
        localStorage.setItem('soulx_auth_user', JSON.stringify(updated));
      }

      setShowPhotoModal(false);
    } catch (err: any) {
      setPhotoError(err?.message || (isAr ? 'تعذر حذف الصورة' : 'Failed to delete photo'));
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  return (
    <div className="w-full flex-1 flex flex-col animate-in fade-in duration-300">
      {/* Hidden File Input for Image Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Full-Screen Cover Photo Banner (ملء الشاشة مع هوية واسم موقع Soul-X للشات والتعارف) */}
      <div className="relative w-full h-64 sm:h-80 md:h-96 bg-neutral-950 overflow-hidden border-b border-neutral-200 dark:border-neutral-800">
        {/* Background Romantic Dating Image */}
        <img
          src="/src/assets/images/soulx_dating_cover_1793490890850.jpg"
          alt="Soul-X Dating & Chat Cover"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover object-center opacity-65"
        />

        {/* Ambient Gradient Overlay & Warm Twilight Glow */}
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/50 to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-950/85 via-neutral-950/20 to-rose-950/30 pointer-events-none" />

        {/* Integrated Website Name & Identity (اسم موقع Soul-X للشات والتعارف) */}
        <div className="absolute inset-0 flex flex-col justify-center items-center sm:items-start px-6 sm:px-16 pointer-events-none select-none">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
            <span className="text-[11px] font-mono tracking-widest text-rose-300 uppercase font-semibold">
              {isAr ? 'شات وتوافق الأرواح' : 'SOUL CONNECTION & CHAT'}
            </span>
          </div>

          <h2 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white via-rose-100 to-cyan-300 drop-shadow-md font-sans">
            SOUL<span className="text-rose-400 font-light">—</span>X
          </h2>

          <p className="text-xs sm:text-sm text-neutral-200 tracking-wider font-light mt-1.5 max-w-md text-center sm:text-start [text-wrap:balance]">
            {isAr
              ? 'منصة الشات والتعارف والارتباط بين الأرواح'
              : 'Where Souls Meet · Authentic Connections & Dating'}
          </p>
        </div>

        {/* Top Right Dating Tag */}
        <div className="absolute top-4 right-4 sm:right-8 flex items-center gap-2">
          <div className="px-3.5 py-1.5 rounded-full bg-neutral-900/80 backdrop-blur-md border border-rose-500/30 text-rose-200 text-[11px] font-mono tracking-wider flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            <span>SOUL-X DATING</span>
          </div>
        </div>
      </div>

      {/* Profile Details Container (Full Width / Expanded) */}
      <div className="w-full max-w-4xl mx-auto px-6 sm:px-12 pb-12 flex-1">
        {/* Avatar with Pencil Edit Button */}
        <div className="relative -mt-20 sm:-mt-24 mb-6 flex flex-col sm:flex-row items-center sm:items-end justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="relative">
              <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full overflow-hidden border-4 border-white dark:border-neutral-950 shadow-2xl bg-neutral-800 flex items-center justify-center">
                {profileImage ? (
                  <img
                    src={profileImage}
                    alt="User Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-cyan-600 to-neutral-900 flex items-center justify-center text-white text-4xl font-bold font-mono">
                    ع.ن
                  </div>
                )}
              </div>

              {/* زر القلم على صورة الملف لرفع او حذف الصورة */}
              <button
                type="button"
                onClick={() => setShowPhotoModal(true)}
                title={isAr ? 'تعديل صورة الملف الشخصي' : 'Edit profile picture'}
                className="absolute bottom-1 right-1 sm:bottom-2 sm:right-2 p-3 rounded-full bg-cyan-400 hover:bg-cyan-300 text-neutral-950 shadow-xl border-3 border-white dark:border-neutral-950 transition-transform active:scale-95 cursor-pointer"
                aria-label={isAr ? 'تعديل الصورة' : 'Edit photo'}
              >
                <Pencil className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
              </button>
            </div>

            {/* Dynamic Name & Badges */}
            <div className="text-center sm:text-start space-y-1">
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
                  {displayName}
                </h1>
                {currentUser?.email ? (
                  <div className="flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 text-xs font-mono">
                    <Mail className="w-3 h-3" />
                    <span>{currentUser.email}</span>
                  </div>
                ) : tgUser ? (
                  <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#24A1DE]/10 text-[#24A1DE] border border-[#24A1DE]/30 text-xs font-semibold">
                    <Send className="w-3 h-3 -rotate-45" />
                    <span>@{tgUser.username || `user_${tgUser.id}`}</span>
                    {auth.isVerified && (
                      <span className="flex items-center gap-0.5 text-emerald-500 font-bold" title={isAr ? 'تم التحقق من التوقيع التشفيري بالسيرفر' : 'HMAC verified'}>
                        <ShieldCheck className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                ) : null}
              </div>

              {/* Unique numerical ID with copy button */}
              <div className="flex items-center justify-center sm:justify-start gap-2 pt-0.5">
                <span className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 font-mono tracking-wide tabular-nums flex items-center gap-1.5">
                  <span>ID: {effectiveUserId}</span>
                  {tgUser && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500 font-sans">
                      {isAr ? 'معرّف تيليجرام' : 'Telegram ID'}
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={handleCopyId}
                  title={isAr ? 'نسخ المعرف الرقمي' : 'Copy User ID'}
                  className="p-1 sm:p-1.5 rounded-lg text-neutral-400 hover:text-cyan-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer flex items-center gap-1 group"
                  aria-label={isAr ? 'نسخ المعرف' : 'Copy ID'}
                >
                  {copiedId ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-[11px] text-emerald-500 font-medium font-sans">
                        {isAr ? 'تم النسخ' : 'Copied'}
                      </span>
                    </>
                  ) : (
                    <Copy className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Simplified Wallet Button (زر المحفظة المبسط بعرض كرت البايو) */}
        <div className="w-full max-w-2xl mb-5">
          <button
            type="button"
            onClick={onOpenWallet}
            className="w-full p-3.5 sm:p-4 rounded-2xl bg-neutral-50/70 hover:bg-neutral-100/90 dark:bg-neutral-900/60 dark:hover:bg-neutral-900/90 border border-neutral-200 dark:border-neutral-800 hover:border-cyan-500/40 dark:hover:border-cyan-500/40 shadow-xs transition-all duration-200 flex items-center justify-between group cursor-pointer text-start"
          >
            {/* Left: Icon & Label */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
                <Wallet className="w-5 h-5" />
              </div>
              <span className="text-sm font-semibold text-neutral-900 dark:text-white">
                {isAr ? 'المحفظة' : 'Wallet'}
              </span>
            </div>

            {/* Right: Balance & Chevron */}
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-1.5 text-cyan-600 dark:text-cyan-400">
                <span className="text-sm font-mono font-bold tabular-nums">
                  {walletBalance.toLocaleString()}
                </span>
                <svg
                  className="w-4 h-4 text-cyan-500 fill-cyan-500/20 stroke-cyan-500 stroke-[1.8] shrink-0"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <polygon points="6 3 18 3 22 9 12 22 2 9 6 3" />
                  <polyline points="11 3 8 9 12 22 16 9 13 3" fill="none" />
                  <line x1="2" y1="9" x2="22" y2="9" />
                </svg>
              </div>
              <div className="text-neutral-400 group-hover:text-cyan-500 transition-colors">
                {isAr ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </div>
            </div>
          </button>
        </div>

        {/* Bio (السيرة الذاتية) */}
        <div className="mb-6 max-w-2xl">
          {isEditingBio ? (
            <div className="space-y-3 bg-neutral-50 dark:bg-neutral-950/60 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800">
              <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                {isAr ? 'السيرة الذاتية (Bio)' : 'Bio'}
              </label>
              <textarea
                rows={3}
                maxLength={160}
                value={tempBio}
                onChange={(e) => setTempBio(e.target.value)}
                placeholder={isAr ? 'اكتب نبذة عنك...' : 'Describe yourself...'}
                className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 focus:border-cyan-500 text-neutral-900 dark:text-white focus:outline-none resize-none transition-colors"
              />
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-400 font-mono tabular-nums">
                  {160 - tempBio.length} {isAr ? 'حرف متبقي' : 'characters left'}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCancelBio}
                    className="px-3.5 py-1.5 rounded-lg text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
                  >
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveBio}
                    className="px-4 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-semibold transition-colors cursor-pointer"
                  >
                    {isAr ? 'حفظ' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-center sm:text-start p-4 rounded-2xl bg-neutral-50/60 dark:bg-neutral-950/40 border border-neutral-100 dark:border-neutral-800/60">
              <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed font-normal">
                {bio}
              </p>
              <button
                type="button"
                onClick={() => {
                  setTempBio(bio);
                  setIsEditingBio(true);
                }}
                className="self-center sm:self-start shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-950/30 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Pencil className="w-3 h-3" />
                <span>{isAr ? 'تعديل النبذة' : 'Edit Bio'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Details: Date of Birth and Gender (تاريخ الميلاد و الجنس بجانب بعض) */}
        <div className="border-t border-b border-neutral-200 dark:border-neutral-800/80 py-5 mb-6 grid grid-cols-2 gap-3 sm:gap-4">
          {/* تاريخ الميلاد */}
          <div
            onClick={onOpenEditProfile}
            role="button"
            tabIndex={0}
            title={isAr ? 'اضغط لتعديل تاريخ الميلاد' : 'Click to edit date of birth'}
            className="flex items-center gap-3 sm:gap-4 p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 hover:border-cyan-500/40 shadow-sm cursor-pointer transition-colors group"
          >
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] sm:text-xs text-neutral-500 font-medium truncate">
                  {isAr ? 'تاريخ الميلاد' : 'Date of Birth'}
                </span>
                <Pencil className="w-3 h-3 text-neutral-400 group-hover:text-cyan-500 transition-colors opacity-0 group-hover:opacity-100" />
              </div>
              <div className="text-xs sm:text-sm md:text-base font-semibold text-neutral-900 dark:text-white tabular-nums truncate">
                {(() => {
                  const effectiveDate = birthDate || '1998-10-14';
                  const parts = effectiveDate.split('-');
                  if (parts.length === 3) {
                    const y = parseInt(parts[0], 10);
                    const m = parseInt(parts[1], 10);
                    const d = parseInt(parts[2], 10);
                    const monthsAr = [
                      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
                      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
                    ];
                    const monthsEn = [
                      'January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'
                    ];
                    if (isAr) {
                      return `${d} ${monthsAr[m - 1] || ''} ${y}`;
                    }
                    return `${monthsEn[m - 1] || ''} ${d}, ${y}`;
                  }
                  return effectiveDate;
                })()}
              </div>
            </div>
          </div>

          {/* الجنس */}
          <div
            onClick={onOpenEditProfile}
            role="button"
            tabIndex={0}
            title={isAr ? 'اضغط لتعديل الجنس' : 'Click to edit gender'}
            className="flex items-center gap-3 sm:gap-4 p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 hover:border-cyan-500/40 shadow-sm cursor-pointer transition-colors group"
          >
            <div
              className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform ${
                gender === 'female'
                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                  : 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400'
              }`}
            >
              <UserIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] sm:text-xs text-neutral-500 font-medium truncate">
                  {isAr ? 'الجنس' : 'Gender'}
                </span>
                <Pencil className="w-3 h-3 text-neutral-400 group-hover:text-cyan-500 transition-colors opacity-0 group-hover:opacity-100" />
              </div>
              <div className="text-xs sm:text-base font-semibold text-neutral-900 dark:text-white truncate">
                {gender === 'female'
                  ? isAr
                    ? 'أنثى'
                    : 'Female'
                  : isAr
                  ? 'ذكر'
                  : 'Male'}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons: زر الإعدادات و زر تسجيل الخروج بالأسفل */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            type="button"
            onClick={onOpenSettings}
            className="w-full sm:flex-1 py-3 px-5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer border border-neutral-200 dark:border-neutral-700/60"
          >
            <Settings className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <span>{isAr ? 'الإعدادات' : 'Settings'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowLogoutAlert(true)}
            className="w-full sm:flex-1 py-3 px-5 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-950/50 text-red-600 dark:text-red-400 font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer border border-red-200 dark:border-red-900/40"
          >
            <LogOut className="w-4 h-4" />
            <span>{isAr ? 'تسجيل الخروج' : 'Log Out'}</span>
          </button>
        </div>

        {/* زر لوحة تحكم الإدارة لكلا الحسابين ADMIN1 و ADMIN2 من المتغيرات */}
        <div className="pt-4 mt-4 border-t border-neutral-200 dark:border-neutral-800 animate-in fade-in duration-300 space-y-2.5">
          {isAdmin ? (
            /* حالة: المستخدم الحالي مسجل بأحد حسابي الإدارة ADMIN1 أو ADMIN2 */
            <button
              type="button"
              onClick={onOpenAdminPanel}
              className="w-full py-3.5 px-4 sm:px-5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-amber-500/20 to-amber-500/15 hover:from-amber-500/25 hover:to-amber-500/30 border border-amber-500/40 hover:border-amber-500/70 text-amber-800 dark:text-amber-300 font-bold text-xs sm:text-sm flex items-center justify-between transition-all duration-200 cursor-pointer shadow-md active:scale-98 group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform border border-amber-500/30">
                  <ShieldAlert className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div className="text-start">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-neutral-900 dark:text-white">
                      {isAr ? 'لوحة تحكم الإدارة' : 'Admin Control Panel'}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500 text-neutral-950 font-bold font-mono tracking-wider">
                      {adminRole || 'ADMIN'}
                    </span>
                  </div>
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-normal">
                    {isAr
                      ? `حساب إدارة معتمد (${adminRole === 'ADMIN1' ? 'ADMIN1' : 'ADMIN2'}: ${currentUser?.email}) • رمز PIN`
                      : `Authorized Admin (${adminRole}: ${currentUser?.email}) • PIN Protected`}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-amber-500 font-mono text-xs">
                <span>{isAr ? 'دخول اللوحة' : 'Enter Panel'}</span>
                {isAr ? (
                  <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                ) : (
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                )}
              </div>
            </button>
          ) : (
            /* زر دخول لوحة التحكم لكلا الحسابين ADMIN1 و ADMIN2 من المتغيرات */
            <div className="p-3.5 rounded-2xl bg-neutral-100/70 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
                    <ShieldAlert className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                    {isAr ? 'لوحة تحكم المديرين (ADMIN1 & ADMIN2)' : 'Admin Control Panel (ADMIN1 & ADMIN2)'}
                  </span>
                </div>

                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold border border-amber-500/20">
                  PIN PROTECTED
                </span>
              </div>

              {/* بطاقات الحسابين من المتغيرات */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
                <div className="p-2 rounded-xl bg-white dark:bg-neutral-950/80 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                  <span className="text-neutral-500 text-[10px]">ADMIN 1:</span>
                  <span className="text-neutral-900 dark:text-neutral-200 truncate ps-1 font-semibold">
                    {adminConfig.admin1}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-white dark:bg-neutral-950/80 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                  <span className="text-neutral-500 text-[10px]">ADMIN 2:</span>
                  <span className="text-neutral-900 dark:text-neutral-200 truncate ps-1 font-semibold">
                    {adminConfig.admin2}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={onOpenAdminPanel}
                className="w-full py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-98"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>{isAr ? 'فتح لوحة التحكم برمز PIN' : 'Access Admin Panel with PIN'}</span>
              </button>
            </div>
          )}
        </div>

      </div>



      {/* Modal: رفع أو حذف صورة الملف الشخصي */}
      {showPhotoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <button
              type="button"
              onClick={() => setShowPhotoModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full text-neutral-400 hover:text-neutral-900 dark:hover:text-white bg-neutral-100 dark:bg-neutral-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
              {isAr ? 'تعديل صورة الملف الشخصي' : 'Update Profile Picture'}
            </h3>
            <p className="text-xs text-neutral-500">
              {isAr
                ? 'يمكنك رفع صورة جديدة من جهازك أو حذف الصورة الحالية والعودة للرمز الافتراضي.'
                : 'Upload a new photo from your device or remove the current image.'}
            </p>

            <div className="space-y-2 pt-2">
              {photoError && (
                <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs text-center font-medium">
                  {photoError}
                </div>
              )}

              {/* خيار رفع صورة جديدة */}
              <button
                type="button"
                disabled={isUploadingPhoto}
                onClick={() => {
                  fileInputRef.current?.click();
                }}
                className="w-full py-3 px-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-neutral-950 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                {isUploadingPhoto ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{isAr ? 'جاري المعالجة والرفع في Soul-X...' : 'Uploading to Soul-X...'}</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>{isAr ? 'رفع صورة جديدة من الجهاز' : 'Upload New Photo'}</span>
                  </>
                )}
              </button>

              {/* خيار حذف الصورة الحالية */}
              {profileImage && (
                <button
                  type="button"
                  disabled={isUploadingPhoto}
                  onClick={handleDeletePhoto}
                  className="w-full py-2.5 px-4 rounded-xl bg-neutral-100 hover:bg-red-50 dark:bg-neutral-800 dark:hover:bg-red-950/20 disabled:opacity-50 text-neutral-700 hover:text-red-600 dark:text-neutral-300 dark:hover:text-red-400 font-medium text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer border border-neutral-200 dark:border-neutral-700/60"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{isAr ? 'حذف الصورة الحالية' : 'Remove Current Photo'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}



      {/* Modal: تنبيه تأكيد تسجيل الخروج */}
      {showLogoutAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto">
              <LogOut className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
              {isAr ? 'تسجيل الخروج من Soul-X' : 'Sign Out of Soul-X'}
            </h3>

            <p className="text-xs text-neutral-500 leading-relaxed">
              {isAr
                ? 'هل أنت متأكد من رغبتك في تسجيل الخروج؟ يمكنك تسجيل الدخول مجدداً في أي وقت.'
                : 'Are you sure you want to sign out? You can sign back in at any time.'}
            </p>

            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={() => setShowLogoutAlert(false)}
                className="flex-1 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onLogout) {
                    onLogout();
                  } else {
                    auth.logoutTelegram();
                  }
                  setShowLogoutAlert(false);
                }}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors shadow-sm cursor-pointer"
              >
                {isAr ? 'تأكيد الخروج' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
