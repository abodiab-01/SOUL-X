import React, { useState, useRef } from 'react';
import {
  Pencil,
  Calendar,
  User as UserIcon,
  Settings,
  LogOut,
  X,
  Check,
  ShieldAlert,
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
  Zap,
  Fingerprint,
  Building2,
  Globe,
  Camera,
} from 'lucide-react';
import { Language, Gender, AuthUser, AgentRecord } from '../types';
import { UseTelegramAuthReturn } from '../hooks/useTelegramAuth';
import { getDefaultAvatar, getEffectiveAvatar } from '../lib/avatar';
import { AgencyPortalModal } from './AgencyPortalModal';
import { CoinIcon, DiamondIcon } from './CurrencyIcons';

interface AccountViewProps {
  lang: Language;
  walletBalance: number;
  coinsBalance?: number;
  onOpenWallet: (tab?: 'diamonds' | 'coins') => void;
  onOpenSettings: () => void;
  auth: UseTelegramAuthReturn;
  onOpenTelegramModal: () => void;
  birthDate?: string | null;
  gender?: Gender | null;
  country?: string | null;
  onOpenEditProfile?: () => void;
  currentUser?: AuthUser | null;
  onLogout?: () => void;
  onOpenAdminPanel?: () => void;
}

export const AccountView: React.FC<AccountViewProps> = ({
  lang,
  walletBalance,
  coinsBalance = 0,
  onOpenWallet,
  onOpenSettings,
  auth,
  onOpenTelegramModal,
  birthDate,
  gender,
  country,
  onOpenEditProfile,
  currentUser,
  onLogout,
  onOpenAdminPanel,
}) => {
  const isAr = lang === 'ar';

  // Check if current user is an authorized admin
  const [isAdmin, setIsAdmin] = useState(false);

  // Check if current user is an appointed recharge agent
  const [agentData, setAgentData] = useState<AgentRecord | null>(null);
  const [isAgencyModalOpen, setIsAgencyModalOpen] = useState(false);

  const checkAgentStatus = () => {
    const currentEmail = currentUser?.email?.toLowerCase().trim();
    const currentUid = currentUser?.id;
    const currentDisplayId = currentUser?.displayId;
    if (!currentEmail && !currentUid && !currentDisplayId) {
      setAgentData(null);
      return;
    }

    const query = new URLSearchParams();
    if (currentEmail) query.set('email', currentEmail);
    if (currentUid) query.set('userId', currentUid);
    if (currentDisplayId) query.set('displayId', currentDisplayId);

    fetch(`/api/agent/my-agency?${query.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.isAgent && data.agent) {
          setAgentData(data.agent);
        } else {
          setAgentData(null);
        }
      })
      .catch(() => {
        setAgentData(null);
      });
  };

  React.useEffect(() => {
    checkAgentStatus();
    const handleAgentUpdate = () => checkAgentStatus();
    window.addEventListener('soulx:agents-updated', handleAgentUpdate);
    window.addEventListener('soulx_agent_updated', handleAgentUpdate);
    return () => {
      window.removeEventListener('soulx:agents-updated', handleAgentUpdate);
      window.removeEventListener('soulx_agent_updated', handleAgentUpdate);
    };
  }, [currentUser?.email, currentUser?.id, currentUser?.displayId]);

  React.useEffect(() => {
    const currentEmail = currentUser?.email?.toLowerCase().trim();
    if (!currentEmail) {
      setIsAdmin(false);
      return;
    }

    fetch('/api/admin/check-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: currentEmail }),
    })
      .then((res) => res.json())
      .then((data) => {
        setIsAdmin(Boolean(data.isAdmin));
      })
      .catch(() => {
        setIsAdmin(false);
      });
  }, [currentUser?.email]);

  // Profile image state with gender-based default avatar fallback (Blue for Male, Pink for Female)
  const [profileImage, setProfileImage] = useState<string | null>(() => {
    if (currentUser?.photoUrl && !currentUser.photoUrl.includes('soulx_audio_spatial_1793489090595.jpg')) {
      return currentUser.photoUrl;
    }
    return null;
  });

  React.useEffect(() => {
    if (currentUser?.photoUrl && !currentUser.photoUrl.includes('soulx_audio_spatial_1793489090595.jpg')) {
      setProfileImage(currentUser.photoUrl);
    } else if (!currentUser?.photoUrl) {
      setProfileImage(null);
    }
  }, [currentUser?.photoUrl]);

  const effectiveGender: Gender = (gender || currentUser?.gender || 'male') as Gender;
  const effectiveAvatar = profileImage || getDefaultAvatar(effectiveGender);

  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert(isAr ? 'يرجى اختيار ملف صورة صالح' : 'Please select a valid image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert(isAr ? 'حجم الصورة كبير جداً (الحد الأقصى 5 ميجابايت)' : 'Image size is too large (max 5MB)');
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result as string;
        setProfileImage(base64Data);

        if (currentUser) {
          const updatedUser: AuthUser = { ...currentUser, photoUrl: base64Data };
          if (typeof window !== 'undefined') {
            localStorage.setItem('soulx_auth_user', JSON.stringify(updatedUser));
            window.dispatchEvent(
              new CustomEvent('soulx:user-profile-updated', { detail: { user: updatedUser } })
            );
          }
        }

        // Sync with backend
        await fetch('/api/auth/update-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUser?.id || currentUser?.displayId,
            photoUrl: base64Data,
          }),
        }).catch(() => {});

        setIsUploadingPhoto(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setIsUploadingPhoto(false);
    }
  };

  const handleUseAvatar = async () => {
    setProfileImage(null);
    if (currentUser) {
      const updatedUser: AuthUser = { ...currentUser, photoUrl: undefined };
      if (typeof window !== 'undefined') {
        localStorage.setItem('soulx_auth_user', JSON.stringify(updatedUser));
        window.dispatchEvent(
          new CustomEvent('soulx:user-profile-updated', { detail: { user: updatedUser } })
        );
      }
    }
    await fetch('/api/auth/update-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUser?.id || currentUser?.displayId,
        photoUrl: null,
      }),
    }).catch(() => {});
  };


  const [showLogoutAlert, setShowLogoutAlert] = useState(false);

  // User ID: Authenticated account ID conforming to S-0101V77-X711
  const effectiveUserId = currentUser ? (currentUser.displayId || currentUser.id) : 'S-0101V77-X711';
  const displayName = currentUser
    ? currentUser.name
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

  return (
    <div className="w-full flex-1 flex flex-col animate-in fade-in duration-300">
      {/* Profile Details Container (Full Width / Expanded) */}
      <div className="w-full max-w-4xl mx-auto px-6 sm:px-12 pt-6 sm:pt-10 pb-12 flex-1">
        {/* Avatar */}
        <div className="relative mb-6 flex flex-col sm:flex-row items-center sm:items-end justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="relative group">
              <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full overflow-hidden border-4 border-white dark:border-neutral-950 shadow-2xl bg-neutral-800 flex items-center justify-center relative">
                <img
                  src={effectiveAvatar}
                  alt={displayName}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = getDefaultAvatar(effectiveGender);
                  }}
                  className="w-full h-full object-cover"
                />
                {isUploadingPhoto && (
                  <div className="absolute inset-0 bg-neutral-950/70 flex flex-col items-center justify-center text-white text-xs gap-1">
                    <Loader2 className="w-7 h-7 text-cyan-400 animate-spin" />
                    <span className="font-bold">{isAr ? 'جاري الحفظ...' : 'Saving...'}</span>
                  </div>
                )}
              </div>

              {/* Camera upload button */}
              <label
                htmlFor="account-avatar-file-upload"
                className="absolute bottom-1 right-1 sm:bottom-2 sm:right-2 p-2.5 sm:p-3 rounded-full bg-cyan-500 hover:bg-cyan-400 text-neutral-950 shadow-xl cursor-pointer transition-transform group-hover:scale-110 active:scale-95 border-2 border-white dark:border-neutral-950"
                title={isAr ? 'تغيير الصورة الشخصية أو الأفاتار' : 'Change picture or avatar'}
              >
                <Camera className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.3]" />
                <input
                  id="account-avatar-file-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
              </label>
            </div>

            {/* Dynamic Name & Badges */}
            <div className="text-center sm:text-start space-y-1">
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
                  {displayName}
                </h1>
                {currentUser?.email && (
                  <div className="flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 text-xs font-mono">
                    <Mail className="w-3 h-3" />
                    <span>{currentUser.email}</span>
                  </div>
                )}
              </div>

              {/* Unique numerical ID with copy button */}
              <div className="flex items-center justify-center sm:justify-start gap-2 pt-0.5">
                <span className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 font-mono tracking-wide tabular-nums flex items-center gap-1.5">
                  <span>ID: {effectiveUserId}</span>
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

              {/* Quick toggle buttons: Upload photo vs Switch to avatar */}
              <div className="flex items-center gap-2 pt-2 flex-wrap justify-center sm:justify-start">
                <label
                  htmlFor="account-avatar-file-upload"
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 text-[11px] font-bold cursor-pointer transition-colors"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{isAr ? 'رفع صورة شخصية' : 'Upload photo'}</span>
                </label>

                {profileImage && (
                  <button
                    type="button"
                    onClick={handleUseAvatar}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 text-[11px] font-bold cursor-pointer transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>{isAr ? 'التبديل إلى الأفاتار' : 'Switch to avatar'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* زر وكالتي: يظهر للوكيل المعتمد بدون أي تفاصيل إضافية */}
        {agentData && (
          <div className="w-full max-w-2xl mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <button
              type="button"
              onClick={() => setIsAgencyModalOpen(true)}
              className="w-full p-4 rounded-2xl bg-white/70 hover:bg-white dark:bg-neutral-900/60 dark:hover:bg-neutral-900/90 border border-neutral-200 dark:border-neutral-800 hover:border-cyan-500/40 dark:hover:border-cyan-500/40 shadow-xs transition-all duration-200 flex items-center justify-between group cursor-pointer text-start"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-sm font-bold text-neutral-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                    {isAr ? 'وكالتي' : 'My Agency'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-neutral-400 group-hover:text-cyan-500 transition-colors">
                {isAr ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </div>
            </button>
          </div>
        )}

        {/* زر المحفظة (الأرصدة تظهر داخل المحفظة فقط) */}
        <div className="w-full max-w-2xl mb-5">
          <button
            type="button"
            onClick={() => onOpenWallet('coins')}
            className="w-full p-4 rounded-2xl bg-white/70 hover:bg-white dark:bg-neutral-900/60 dark:hover:bg-neutral-900/90 border border-neutral-200 dark:border-neutral-800 hover:border-cyan-500/40 dark:hover:border-cyan-500/40 shadow-xs transition-all duration-200 flex items-center justify-between group cursor-pointer text-start"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <span className="text-sm font-bold text-neutral-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                  {isAr ? 'المحفظة الشخصية' : 'Personal Wallet'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-neutral-400 group-hover:text-cyan-500 transition-colors">
              <span className="text-xs font-semibold hidden sm:inline">
                {isAr ? 'عرض' : 'Open'}
              </span>
              {isAr ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
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

        {/* Details: Date of Birth, Gender and Country (تاريخ الميلاد و الجنس و الدولة) */}
        <div className="border-t border-b border-neutral-200 dark:border-neutral-800/80 py-5 mb-6 grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
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

          {/* الدولة - كتابة فقط بدون اعلام */}
          <div
            className="col-span-2 sm:col-span-1 flex items-center gap-3 sm:gap-4 p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 shadow-sm"
          >
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
              <Globe className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[11px] sm:text-xs text-neutral-500 font-medium block truncate">
                {isAr ? 'الدولة' : 'Country'}
              </span>
              <div className="text-xs sm:text-sm md:text-base font-semibold text-neutral-900 dark:text-white truncate">
                {currentUser?.country || country || (isAr ? 'غير محددة' : 'Not specified')}
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

        {/* زر لوحة تحكم الإدارة: يظهر فقط إذا كان المستخدم مسجلاً بحساب ADMIN1 أو ADMIN2 من متغيرات البيئة */}
        {isAdmin && onOpenAdminPanel && (
          <div className="pt-4 mt-4 border-t border-neutral-200 dark:border-neutral-800 animate-in fade-in duration-300 space-y-2.5">
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
                      ADMIN
                    </span>
                  </div>
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-normal">
                    {isAr
                      ? 'لوحة إدارة النظام • محمية برمز الأمان PIN'
                      : 'Admin Management Panel • Protected by Security PIN'}
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
          </div>
        )}

      </div>







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
                ? 'سيتم إلغاء جلسة التوكن بالكامل، وحذف كافة البيانات المحفوظة محلياً، والعودة لشاشة البداية.'
                : 'Your session token will be completely revoked, local credentials cleared, and you will return to the start.'}
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

      {/* بوابة وكالتي للشحن Modal */}
      {agentData && (
        <AgencyPortalModal
          isOpen={isAgencyModalOpen}
          onClose={() => setIsAgencyModalOpen(false)}
          lang={lang}
          agent={agentData}
          currentUser={currentUser}
          personalWalletBalance={walletBalance}
          personalCoinsBalance={coinsBalance}
          onBalanceUpdated={(newBal) => {
            setAgentData((prev) => (prev ? { ...prev, balance: newBal } : null));
          }}
          onPersonalCoinsBalanceUpdated={(newCoins) => {
            if (typeof window !== 'undefined') {
              localStorage.setItem('soulx_coins_balance', newCoins.toString());
              window.dispatchEvent(
                new CustomEvent('soulx:balance-updated', {
                  detail: { currency: 'coins', balance: newCoins },
                })
              );
            }
          }}
        />
      )}
    </div>
  );
};
