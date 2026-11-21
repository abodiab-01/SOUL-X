export type FrameCategory = 'colored' | 'professional' | 'vip';

export type FrameDurationKey = '1d' | '1w' | '1m' | '1y';

export interface FrameDurationOption {
  key: FrameDurationKey;
  days: number;
  durationMs: number;
  labelAr: string;
  labelEn: string;
  multiplier: number;
  badgeAr?: string;
  badgeEn?: string;
}

export const FRAME_DURATIONS: FrameDurationOption[] = [
  {
    key: '1d',
    days: 1,
    durationMs: 1 * 24 * 60 * 60 * 1000,
    labelAr: '1 يوم',
    labelEn: '1 Day',
    multiplier: 1,
  },
  {
    key: '1w',
    days: 7,
    durationMs: 7 * 24 * 60 * 60 * 1000,
    labelAr: '1 أسبوع',
    labelEn: '1 Week',
    multiplier: 5,
    badgeAr: 'وفر 28%',
    badgeEn: 'Save 28%',
  },
  {
    key: '1m',
    days: 30,
    durationMs: 30 * 24 * 60 * 60 * 1000,
    labelAr: '1 شهر',
    labelEn: '1 Month',
    multiplier: 16,
    badgeAr: 'الأكثر طلباً',
    badgeEn: 'Popular',
  },
  {
    key: '1y',
    days: 365,
    durationMs: 365 * 24 * 60 * 60 * 1000,
    labelAr: '1 سنة',
    labelEn: '1 Year',
    multiplier: 100,
    badgeAr: 'أفضل قيمة',
    badgeEn: 'Best Value',
  },
];

export interface AvatarFrameDef {
  id: string;
  category: FrameCategory;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  dailyPrice: number;
  primaryColor: string;
  secondaryColor: string;
  accentColor?: string;
  vipTag?: string;
}

export const AVATAR_FRAMES_CATALOG: AvatarFrameDef[] = [
  // ==========================================
  // 1. الإطارات الملونة بجميع الألوان (Colored)
  // ==========================================
  {
    id: 'color-red',
    category: 'colored',
    nameAr: 'الأحمر الياقوتي',
    nameEn: 'Ruby Red',
    descriptionAr: 'إطار أحمر لامع بحافة متوهجة',
    descriptionEn: 'Vibrant ruby red glowing frame',
    dailyPrice: 500,
    primaryColor: '#ef4444',
    secondaryColor: '#b91c1c',
  },
  {
    id: 'color-blue',
    category: 'colored',
    nameAr: 'الأزرق الملكي',
    nameEn: 'Royal Blue',
    descriptionAr: 'إطار أزرق عميق بتوهج أنيق',
    descriptionEn: 'Deep royal blue luminous frame',
    dailyPrice: 500,
    primaryColor: '#3b82f6',
    secondaryColor: '#1d4ed8',
  },
  {
    id: 'color-cyan',
    category: 'colored',
    nameAr: 'السماوي النيون',
    nameEn: 'Neon Cyan',
    descriptionAr: 'إطار سماوي ساطع بطابع عصري',
    descriptionEn: 'Bright cyber cyan glowing ring',
    dailyPrice: 500,
    primaryColor: '#22d3ee',
    secondaryColor: '#0284c7',
  },
  {
    id: 'color-green',
    category: 'colored',
    nameAr: 'الأخضر الزمردي',
    nameEn: 'Emerald Green',
    descriptionAr: 'إطار زمردي نقي بتدرج مشرق',
    descriptionEn: 'Pure emerald green radiant ring',
    dailyPrice: 500,
    primaryColor: '#10b981',
    secondaryColor: '#047857',
  },
  {
    id: 'color-yellow',
    category: 'colored',
    nameAr: 'الأصفر الذهبي',
    nameEn: 'Solar Yellow',
    descriptionAr: 'إطار أصفر دافئ بإضاءة شمسية',
    descriptionEn: 'Warm sunlit yellow frame',
    dailyPrice: 500,
    primaryColor: '#facc15',
    secondaryColor: '#eab308',
  },
  {
    id: 'color-orange',
    category: 'colored',
    nameAr: 'البرتقالي الناري',
    nameEn: 'Sunset Orange',
    descriptionAr: 'إطار برتقالي متدرج بألوان الغروب',
    descriptionEn: 'Warm sunset orange gradient ring',
    dailyPrice: 500,
    primaryColor: '#fb923c',
    secondaryColor: '#ea580c',
  },
  {
    id: 'color-pink',
    category: 'colored',
    nameAr: 'الوردي اللؤلؤي',
    nameEn: 'Sakura Pink',
    descriptionAr: 'إطار وردي ناعم بلمعة لؤلؤية',
    descriptionEn: 'Soft pearl pink luminous ring',
    dailyPrice: 500,
    primaryColor: '#f472b6',
    secondaryColor: '#db2777',
  },
  {
    id: 'color-purple',
    category: 'colored',
    nameAr: 'البنفسجي الساحر',
    nameEn: 'Mystic Violet',
    descriptionAr: 'إطار بنفسجي فاخر بتوهج هادئ',
    descriptionEn: 'Rich mystic violet glowing ring',
    dailyPrice: 500,
    primaryColor: '#a855f7',
    secondaryColor: '#7e22ce',
  },
  {
    id: 'color-teal',
    category: 'colored',
    nameAr: 'الفيروزي البحري',
    nameEn: 'Aqua Teal',
    descriptionAr: 'إطار فيروزي هادئ بلون المحيط',
    descriptionEn: 'Calm ocean aqua teal frame',
    dailyPrice: 500,
    primaryColor: '#2dd4bf',
    secondaryColor: '#0f766e',
  },
  {
    id: 'color-silver',
    category: 'colored',
    nameAr: 'الفضي الكريستالي',
    nameEn: 'Crystal Silver',
    descriptionAr: 'إطار فضي معدني نظيف وأنيق',
    descriptionEn: 'Clean metallic silver frame',
    dailyPrice: 600,
    primaryColor: '#f8fafc',
    secondaryColor: '#94a3b8',
  },
  {
    id: 'color-obsidian',
    category: 'colored',
    nameAr: 'الأسود الأوبسيديان',
    nameEn: 'Obsidian Black',
    descriptionAr: 'إطار داكن فخم بحافة معدنية',
    descriptionEn: 'Sleek dark obsidian metallic ring',
    dailyPrice: 600,
    primaryColor: '#334155',
    secondaryColor: '#09090b',
    accentColor: '#94a3b8',
  },
  {
    id: 'color-rainbow',
    category: 'colored',
    nameAr: 'طيف قوس قزح',
    nameEn: 'Rainbow Spectrum',
    descriptionAr: 'إطار يجمع كافة ألوان الطيف الحيوية',
    descriptionEn: 'Full spectrum multicolor ring',
    dailyPrice: 900,
    primaryColor: '#ec4899',
    secondaryColor: '#06b6d4',
    accentColor: '#facc15',
  },

  // ==========================================
  // 2. الإطارات الاحترافية (Professional)
  // ==========================================
  {
    id: 'pro-cyber-neon',
    category: 'professional',
    nameAr: 'النيون المزدوج',
    nameEn: 'Dual Cyber Neon',
    descriptionAr: 'حلقات نيون دوارة ثنائية الإضاءة',
    descriptionEn: 'Rotating dual-beam cyber neon rings',
    dailyPrice: 2000,
    primaryColor: '#06b6d4',
    secondaryColor: '#ec4899',
    accentColor: '#38bdf8',
  },
  {
    id: 'pro-blazing-flame',
    category: 'professional',
    nameAr: 'هالة اللهب',
    nameEn: 'Inferno Halo',
    descriptionAr: 'إطار ناري مشتعل بشرارات متوهجة',
    descriptionEn: 'Animated fiery aura with glowing embers',
    dailyPrice: 2500,
    primaryColor: '#f97316',
    secondaryColor: '#dc2626',
    accentColor: '#fde047',
  },
  {
    id: 'pro-electric-pulse',
    category: 'professional',
    nameAr: 'الصاعقة الكهربائية',
    nameEn: 'Volt Surge',
    descriptionAr: 'توهج طاقة كهربائية ونبضات سريعة',
    descriptionEn: 'High-voltage electric energy frame',
    dailyPrice: 2800,
    primaryColor: '#38bdf8',
    secondaryColor: '#6366f1',
    accentColor: '#e0f2fe',
  },
  {
    id: 'pro-frost-crystal',
    category: 'professional',
    nameAr: 'الكريستال الجليدي',
    nameEn: 'Frost Prism',
    descriptionAr: 'تشكيل بلوري جليدي ببريق الماس',
    descriptionEn: 'Geometric ice crystal prism border',
    dailyPrice: 3000,
    primaryColor: '#bae6fd',
    secondaryColor: '#0284c7',
    accentColor: '#ffffff',
  },
  {
    id: 'pro-cosmic-orbit',
    category: 'professional',
    nameAr: 'المدار الكوني',
    nameEn: 'Cosmic Orbit',
    descriptionAr: 'مدار نجوم دوار وأضواء مجرية',
    descriptionEn: 'Orbiting starlight & galaxy ring',
    dailyPrice: 3500,
    primaryColor: '#8b5cf6',
    secondaryColor: '#06b6d4',
    accentColor: '#fde68a',
  },
  {
    id: 'pro-titanium-shield',
    category: 'professional',
    nameAr: 'الدرع التيتانيوم',
    nameEn: 'Titanium Tech',
    descriptionAr: 'تصميم هندسي معدني بدقة احترافية',
    descriptionEn: 'Precision segmented titanium frame',
    dailyPrice: 3800,
    primaryColor: '#94a3b8',
    secondaryColor: '#0f172a',
    accentColor: '#22d3ee',
  },

  // ==========================================
  // 3. أشكال VIP الفاخرة (VIP Shapes)
  // ==========================================
  {
    id: 'vip-golden-crown',
    category: 'vip',
    nameAr: 'تاج VIP الذهبي',
    nameEn: 'Golden Crown VIP',
    descriptionAr: 'تاج ملكي ذهبي مع غصون الغار وشارة VIP',
    descriptionEn: 'Royal golden crown with laurel wreath',
    dailyPrice: 6000,
    primaryColor: '#fbbf24',
    secondaryColor: '#b45309',
    accentColor: '#fef08a',
    vipTag: 'VIP',
  },
  {
    id: 'vip-royal-wings',
    category: 'vip',
    nameAr: 'الأجنحة الملكية',
    nameEn: 'Royal Wings VIP',
    descriptionAr: 'أجنحة ذهبية مهيبة تحيط بالملف الشخصي',
    descriptionEn: 'Majestic golden wings framing avatar',
    dailyPrice: 8000,
    primaryColor: '#fcd34d',
    secondaryColor: '#d97706',
    accentColor: '#fffbeb',
    vipTag: 'VIP',
  },
  {
    id: 'vip-imperial-diamond',
    category: 'vip',
    nameAr: 'الماسة الإمبراطورية',
    nameEn: 'Imperial Diamond VIP',
    descriptionAr: 'جواهر ماسية سماوية وتاج بلوري فاخر',
    descriptionEn: 'Faceted sapphire gems & crystal tiara',
    dailyPrice: 10000,
    primaryColor: '#38bdf8',
    secondaryColor: '#1e40af',
    accentColor: '#e0f2fe',
    vipTag: 'VIP+',
  },
  {
    id: 'vip-celestial-moon',
    category: 'vip',
    nameAr: 'الهلال والنجوم VIP',
    nameEn: 'Celestial Moon VIP',
    descriptionAr: 'هلال ذهبي مضيء مرصع بالنجوم الليلية',
    descriptionEn: 'Golden crescent moon & twinkling stars',
    dailyPrice: 12000,
    primaryColor: '#f59e0b',
    secondaryColor: '#4c1d95',
    accentColor: '#fde68a',
    vipTag: 'VIP+',
  },
  {
    id: 'vip-sovereign-phoenix',
    category: 'vip',
    nameAr: 'العنقاء الملكية VIP',
    nameEn: 'Sovereign Phoenix VIP',
    descriptionAr: 'شعار ياقوتي وذهبي متوهج بنار الملوك',
    descriptionEn: 'Imperial crimson & gold phoenix crest',
    dailyPrice: 16000,
    primaryColor: '#f43f5e',
    secondaryColor: '#d97706',
    accentColor: '#fef08a',
    vipTag: 'SVIP',
  },
  {
    id: 'vip-apex-throne',
    category: 'vip',
    nameAr: 'العرش الأسطوري VIP',
    nameEn: 'Apex Throne VIP',
    descriptionAr: 'أعلى إطار VIP بأجنحة ماسية وتاج ملكي متكامل',
    descriptionEn: 'Supreme diamond wings & sovereign crown',
    dailyPrice: 25000,
    primaryColor: '#facc15',
    secondaryColor: '#7c3aed',
    accentColor: '#22d3ee',
    vipTag: 'KING',
  },
];

export function getFrameById(frameId?: string | null): AvatarFrameDef | undefined {
  if (!frameId) return undefined;
  return AVATAR_FRAMES_CATALOG.find((f) => f.id === frameId);
}

export function getFrameDurationOption(key: FrameDurationKey): FrameDurationOption {
  return FRAME_DURATIONS.find((d) => d.key === key) || FRAME_DURATIONS[0];
}

export function getFramePriceForDuration(frame: AvatarFrameDef, durationKey: FrameDurationKey): number {
  const dur = getFrameDurationOption(durationKey);
  return Math.round(frame.dailyPrice * dur.multiplier);
}

export function formatRemainingDuration(remainingMs: number, isAr: boolean): string {
  if (remainingMs <= 0) {
    return isAr ? 'منتهي الصلاحية' : 'Expired';
  }
  const totalMinutes = Math.floor(remainingMs / 60000);
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = totalMinutes % 60;

  if (days >= 1) {
    if (hours > 0) {
      return isAr ? `${days} يوم و ${hours} ساعة` : `${days}d ${hours}h`;
    }
    return isAr ? `${days} يوم` : `${days}d`;
  }
  if (hours >= 1) {
    return isAr ? `${hours} ساعة و ${minutes} دقيقة` : `${hours}h ${minutes}m`;
  }
  if (minutes >= 1) {
    return isAr ? `${minutes} دقيقة` : `${minutes}m`;
  }
  return isAr ? 'أقل من دقيقة' : '< 1m';
}
