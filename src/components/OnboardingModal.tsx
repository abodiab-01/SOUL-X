import React, { useState } from 'react';
import {
  Calendar,
  Sparkles,
  Check,
  User as UserIcon,
  ShieldCheck,
  Send,
  Heart,
  X,
  ChevronDown,
} from 'lucide-react';
import { Language, Gender, AuthUser } from '../types';
import { MALE_DEFAULT_AVATAR, FEMALE_DEFAULT_AVATAR } from '../lib/avatar';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onComplete: (data: { birthDate: string; gender: Gender }) => void;
  lang: Language;
  currentUser?: AuthUser | null;
  isFirstLogin?: boolean;
  initialBirthDate?: string | null;
  initialGender?: Gender | null;
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

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  onComplete,
  lang,
  currentUser,
  isFirstLogin = true,
  initialBirthDate,
  initialGender,
}) => {
  const isAr = lang === 'ar';

  // Parse initial date or default to 1998-10-14
  const defaultDate = initialBirthDate || '1998-10-14';
  const [initYear, initMonth, initDay] = defaultDate.split('-').map((v) => parseInt(v, 10));

  const [selectedGender, setSelectedGender] = useState<Gender>(initialGender || 'male');
  const [selectedDay, setSelectedDay] = useState<number>(initDay || 14);
  const [selectedMonth, setSelectedMonth] = useState<number>(initMonth ? initMonth - 1 : 9); // 0-indexed
  const [selectedYear, setSelectedYear] = useState<number>(initYear || 1998);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Generate Year options (Age 18 to 90)
  const currentYear = new Date().getFullYear();
  const maxYear = currentYear - 18; // At least 18 years old
  const minYear = currentYear - 85;
  const years: number[] = [];
  for (let y = maxYear; y >= minYear; y--) {
    years.push(y);
  }

  // Days in month
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Calculate user age
  const birth = new Date(selectedYear, selectedMonth, Math.min(selectedDay, daysInMonth));
  const today = new Date();
  let calculatedAge = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    calculatedAge--;
  }

  const handleSave = () => {
    if (!selectedGender) {
      setErrorMessage(isAr ? 'يرجى تحديد الجنس للمتابعة.' : 'Please select your gender.');
      return;
    }

    if (calculatedAge < 18) {
      setErrorMessage(
        isAr
          ? 'يجب أن يكون عمرك 18 عاماً أو أكثر للتسجيل في Soul-X.'
          : 'You must be at least 18 years old to join Soul-X.'
      );
      return;
    }

    const validDay = Math.min(selectedDay, daysInMonth);
    const formattedMonth = (selectedMonth + 1).toString().padStart(2, '0');
    const formattedDay = validDay.toString().padStart(2, '0');
    const formattedDate = `${selectedYear}-${formattedMonth}-${formattedDay}`;

    onComplete({
      birthDate: formattedDate,
      gender: selectedGender,
    });
  };

  const displayName = currentUser?.name
    ? currentUser.name
    : isAr
    ? 'عضو جديد'
    : 'New Member';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-neutral-950/85 backdrop-blur-md animate-in fade-in duration-300">
      <div className="relative w-full max-w-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl shadow-2xl p-6 sm:p-7 space-y-6 overflow-hidden">
        {/* Subtle background glow */}
        <div className="w-56 h-56 bg-cyan-500/10 dark:bg-cyan-500/5 blur-3xl rounded-full absolute -top-10 -right-10 pointer-events-none" />

        {/* Close button if not forced first login */}
        {!isFirstLogin && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl text-neutral-400 hover:text-neutral-900 dark:hover:text-white bg-neutral-100 dark:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Header with Soul-X Emblem */}
        <div className="text-center space-y-2 relative">
          <div className="w-14 h-14 rounded-2xl mx-auto bg-gradient-to-br from-cyan-500/15 via-rose-500/10 to-transparent border border-cyan-500/20 flex items-center justify-center text-cyan-600 dark:text-cyan-400 shadow-sm">
            <Sparkles className="w-6 h-6 text-cyan-500" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-[11px] font-semibold border border-cyan-500/20">
            <span>{isAr ? 'بيانات الملف الشخصي' : 'Profile Details'}</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
            {isFirstLogin
              ? isAr
                ? 'أهلاً بك في Soul-X ✨'
                : 'Welcome to Soul-X ✨'
              : isAr
              ? 'تعديل تاريخ الميلاد والجنس'
              : 'Edit Birth Date & Gender'}
          </h2>

          <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-xs mx-auto leading-relaxed">
            {isFirstLogin
              ? isAr
                ? `مرحباً ${displayName}! لتخصيص تجربة التوافق والمطابقة بدقة، يرجى تحديد جنسك وتاريخ ميلادك.`
                : `Welcome ${displayName}! Please select your gender and date of birth to tailor your matchmaking.`
              : isAr
              ? 'تستخدم هذه البيانات لتحديد الفئات والتوافق المناسب لك.'
              : 'Used to provide accurate matchmaking.'}
          </p>
        </div>

        {/* Form Body */}
        <div className="space-y-5 relative">
          {/* 1. تحديد الجنس / Gender Selection */}
          <div className="space-y-2.5">
            <label className="block text-xs font-bold text-neutral-800 dark:text-neutral-200">
              {isAr ? '1. الجنس' : '1. Gender'}
            </label>

            <div className="grid grid-cols-2 gap-3">
              {/* ذكر / Male */}
              <button
                type="button"
                onClick={() => {
                  setSelectedGender('male');
                  setErrorMessage(null);
                }}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col items-center justify-center gap-2 relative group ${
                  selectedGender === 'male'
                    ? 'bg-cyan-500/10 border-cyan-500 text-cyan-600 dark:text-cyan-400 font-bold shadow-sm'
                    : 'bg-neutral-50 hover:bg-neutral-100 dark:bg-neutral-950/60 dark:hover:bg-neutral-800/80 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400'
                }`}
              >
                <div className="w-12 h-12 rounded-full overflow-hidden shadow-md border-2 border-cyan-400/60 transition-transform group-hover:scale-105 shrink-0 bg-blue-900">
                  <img
                    src={MALE_DEFAULT_AVATAR}
                    alt="Male Avatar"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="text-center">
                  <span className="text-xs font-bold block">{isAr ? 'ذكر' : 'Male'}</span>
                  <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-medium">{isAr ? 'الرمز الأزرق' : 'Blue Avatar'}</span>
                </div>
                {selectedGender === 'male' && (
                  <div className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-cyan-500 text-white flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                )}
              </button>

              {/* أنثى / Female */}
              <button
                type="button"
                onClick={() => {
                  setSelectedGender('female');
                  setErrorMessage(null);
                }}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col items-center justify-center gap-2 relative group ${
                  selectedGender === 'female'
                    ? 'bg-rose-500/10 border-rose-500 text-rose-600 dark:text-rose-400 font-bold shadow-sm'
                    : 'bg-neutral-50 hover:bg-neutral-100 dark:bg-neutral-950/60 dark:hover:bg-neutral-800/80 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400'
                }`}
              >
                <div className="w-12 h-12 rounded-full overflow-hidden shadow-md border-2 border-rose-400/60 transition-transform group-hover:scale-105 shrink-0 bg-pink-900">
                  <img
                    src={FEMALE_DEFAULT_AVATAR}
                    alt="Female Avatar"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="text-center">
                  <span className="text-xs font-bold block">{isAr ? 'أنثى' : 'Female'}</span>
                  <span className="text-[10px] text-rose-600 dark:text-rose-400 font-medium">{isAr ? 'الرمز الزهري' : 'Pink Avatar'}</span>
                </div>
                {selectedGender === 'female' && (
                  <div className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                )}
              </button>
            </div>
          </div>

          {/* 2. تاريخ الميلاد / Date of Birth Selection */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-cyan-500" />
                <span>{isAr ? '2. تاريخ الميلاد' : '2. Date of Birth'}</span>
              </label>

              {/* Calculated Age Pill */}
              <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                {isAr ? `العمر: ${calculatedAge} سنة` : `Age: ${calculatedAge} years`}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {/* Day */}
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-neutral-500">
                  {isAr ? 'اليوم' : 'Day'}
                </label>
                <div className="relative">
                  <select
                    value={Math.min(selectedDay, daysInMonth)}
                    onChange={(e) => {
                      setSelectedDay(parseInt(e.target.value, 10));
                      setErrorMessage(null);
                    }}
                    className="w-full appearance-none px-3 py-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs font-mono font-semibold text-neutral-900 dark:text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    {days.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-3 pointer-events-none" />
                </div>
              </div>

              {/* Month */}
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-neutral-500">
                  {isAr ? 'الشهر' : 'Month'}
                </label>
                <div className="relative">
                  <select
                    value={selectedMonth}
                    onChange={(e) => {
                      setSelectedMonth(parseInt(e.target.value, 10));
                      setErrorMessage(null);
                    }}
                    className="w-full appearance-none px-3 py-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs font-semibold text-neutral-900 dark:text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    {(isAr ? MONTHS_AR : MONTHS_EN).map((mName, idx) => (
                      <option key={idx} value={idx}>
                        {mName}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-3 pointer-events-none" />
                </div>
              </div>

              {/* Year */}
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-neutral-500">
                  {isAr ? 'السنة' : 'Year'}
                </label>
                <div className="relative">
                  <select
                    value={selectedYear}
                    onChange={(e) => {
                      setSelectedYear(parseInt(e.target.value, 10));
                      setErrorMessage(null);
                    }}
                    className="w-full appearance-none px-3 py-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs font-mono font-semibold text-neutral-900 dark:text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    {years.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-3 pointer-events-none" />
                </div>
              </div>
            </div>

            <p className="text-[11px] text-neutral-400 pt-1">
              {isAr
                ? 'ملاحظة: المنصة مخصصة للبالغين من سن 18 عاماً فما فوق.'
                : 'Soul-X is strictly for adults aged 18 and older.'}
            </p>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400">
              {errorMessage}
            </div>
          )}

          {/* Action Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleSave}
              className="w-full py-3.5 px-5 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-bold text-sm transition-all shadow-md active:scale-98 cursor-pointer flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>{isAr ? 'تأكيد ومتابعة' : 'Confirm & Continue'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
