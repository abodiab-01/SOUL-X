import type { RoomMiniGameType, RoomModPermissions, RoomRole } from '../src/types.ts';

export const ROOM_CREATE_COST_COINS = 25000;
export const ROOM_MAX_SEATS = 15;
export const ROOM_RECONNECT_GRACE_MS = 25_000;

export interface ServerGiftCatalogItem {
  id: string;
  nameAr: string;
  nameEn: string;
  cost: number;
  icon: string;
}

export const SOULX_ROOM_GIFTS: ServerGiftCatalogItem[] = [
  { id: 'rose', nameAr: 'وردة روحية', nameEn: 'Soul Rose', cost: 20, icon: '🌹' },
  { id: 'coffee', nameAr: 'قهوة فاخرة', nameEn: 'Luxury Coffee', cost: 35, icon: '☕' },
  { id: 'diamond', nameAr: 'ماسة نقية', nameEn: 'Pure Diamond', cost: 50, icon: '💎' },
  { id: 'heart', nameAr: 'قلب متوهج', nameEn: 'Glowing Heart', cost: 100, icon: '💖' },
  { id: 'bouquet', nameAr: 'باقة زهور', nameEn: 'Flower Bouquet', cost: 150, icon: '💐' },
  { id: 'crown', nameAr: 'تاج الأرواح', nameEn: 'Soul Crown', cost: 250, icon: '👑' },
  { id: 'rocket', nameAr: 'صاروخ الإعجاب', nameEn: 'Super Rocket', cost: 500, icon: '🚀' },
  { id: 'galaxy', nameAr: 'مجرة التوافق', nameEn: 'Soul Galaxy', cost: 1000, icon: '🌌' },
  { id: 'ring', nameAr: 'خاتم الأبدية', nameEn: 'Eternity Ring', cost: 2500, icon: '💍' },
  { id: 'unicorn', nameAr: 'وحيد القرن', nameEn: 'Magic Unicorn', cost: 5000, icon: '🦄' },
  { id: 'fireworks', nameAr: 'ألعاب نارية', nameEn: 'Royal Fireworks', cost: 10000, icon: '🎆' },
  { id: 'supercar', nameAr: 'سيارة خارقة', nameEn: 'Supercar', cost: 25000, icon: '🏎️' },
  { id: 'yacht', nameAr: 'يخت فاخر', nameEn: 'Luxury Yacht', cost: 50000, icon: '🛥️' },
  { id: 'jet', nameAr: 'طائرة خاصة', nameEn: 'Private Jet', cost: 100000, icon: '🛩️' },
  { id: 'castle', nameAr: 'قصر الأحلام', nameEn: 'Dream Castle', cost: 250000, icon: '🏰' },
  { id: 'island', nameAr: 'جزيرة خاصة', nameEn: 'Private Island', cost: 500000, icon: '🏝️' },
  { id: 'phoenix', nameAr: 'عنقاء الخلود', nameEn: 'Eternal Phoenix', cost: 1000000, icon: '🦅' },
  { id: 'planet', nameAr: 'كوكب ذهبي', nameEn: 'Golden Planet', cost: 2500000, icon: '🪐' },
  { id: 'throne', nameAr: 'عرش الملوك', nameEn: 'Sovereign Throne', cost: 5000000, icon: '⚜️' },
];

export interface RoomMusicTrackMeta {
  id: string;
  titleAr: string;
  titleEn: string;
  artist: string;
  durationSec: number;
  bpm: number;
  mood: 'chill' | 'oriental' | 'lofi' | 'party' | 'ambient';
}

export const ROOM_MUSIC_PLAYLIST: RoomMusicTrackMeta[] = [
  {
    id: 'lounge-evening',
    titleAr: 'صالة المساء الهادئة',
    titleEn: 'Evening Lounge Chill',
    artist: 'SOUL-X Soundlab',
    durationSec: 180,
    bpm: 84,
    mood: 'chill',
  },
  {
    id: 'neo-oud',
    titleAr: 'إيقاع شرقي حديث',
    titleEn: 'Neo Oud Groove',
    artist: 'SOUL-X Ensemble',
    durationSec: 210,
    bpm: 96,
    mood: 'oriental',
  },
  {
    id: 'lofi-rain',
    titleAr: 'مطر وقهوة Lo-Fi',
    titleEn: 'Midnight Lo-Fi Rain',
    artist: 'SOUL-X Beats',
    durationSec: 195,
    bpm: 76,
    mood: 'lofi',
  },
  {
    id: 'neon-party',
    titleAr: 'نبض النيون الاحتفالي',
    titleEn: 'Neon Pulse Party',
    artist: 'SOUL-X Club',
    durationSec: 165,
    bpm: 118,
    mood: 'party',
  },
  {
    id: 'starlight-ambient',
    titleAr: 'نسمة السماء الليلية',
    titleEn: 'Starlight Ambient',
    artist: 'SOUL-X Waves',
    durationSec: 240,
    bpm: 68,
    mood: 'ambient',
  },
];

export const EMPTY_PERMISSIONS: RoomModPermissions = {
  manageSeats: false,
  muteUsers: false,
  roomMuteAll: false,
  acceptMicQueue: false,
  kickUsers: false,
  banUsers: false,
  deleteMessages: false,
  pinMessages: false,
  pauseChat: false,
  manageLockPin: false,
  manageGames: false,
  manageMusic: false,
  manageEvents: false,
};

export const FULL_PERMISSIONS: RoomModPermissions = {
  manageSeats: true,
  muteUsers: true,
  roomMuteAll: true,
  acceptMicQueue: true,
  kickUsers: true,
  banUsers: true,
  deleteMessages: true,
  pinMessages: true,
  pauseChat: true,
  manageLockPin: true,
  manageGames: true,
  manageMusic: true,
  manageEvents: true,
};

export function getEffectivePermissions(
  role: RoomRole,
  stored?: Partial<RoomModPermissions> | null
): RoomModPermissions {
  if (role === 'owner' || role === 'head_admin') {
    return { ...FULL_PERMISSIONS };
  }
  if (role === 'moderator') {
    return {
      manageSeats: Boolean(stored?.manageSeats),
      muteUsers: Boolean(stored?.muteUsers),
      roomMuteAll: Boolean(stored?.roomMuteAll),
      acceptMicQueue: Boolean(stored?.acceptMicQueue),
      kickUsers: Boolean(stored?.kickUsers),
      banUsers: Boolean(stored?.banUsers),
      deleteMessages: Boolean(stored?.deleteMessages),
      pinMessages: Boolean(stored?.pinMessages),
      pauseChat: Boolean(stored?.pauseChat),
      manageLockPin: Boolean(stored?.manageLockPin),
      manageGames: Boolean(stored?.manageGames),
      manageMusic: Boolean(stored?.manageMusic),
      manageEvents: Boolean(stored?.manageEvents),
    };
  }
  return { ...EMPTY_PERMISSIONS };
}

export function getRoleRank(role: RoomRole): number {
  switch (role) {
    case 'owner':
      return 3;
    case 'head_admin':
      return 2;
    case 'moderator':
      return 1;
    default:
      return 0;
  }
}

export interface ServerGameQuestionItem {
  promptAr: string;
  promptEn: string;
  optionsAr?: string[];
  optionsEn?: string[];
  answerAr: string;
  answerEn: string;
  acceptedAnswers: string[];
  hintAr?: string;
  hintEn?: string;
}

export const ROOM_GAMES_BANK: Record<RoomMiniGameType, ServerGameQuestionItem[]> = {
  quiz: [
    {
      promptAr: 'ما هو أكبر كوكب في المجموعة الشمسية؟',
      promptEn: 'What is the largest planet in our solar system?',
      optionsAr: ['المريخ', 'المشتري', 'زحل', 'نبتون'],
      optionsEn: ['Mars', 'Jupiter', 'Saturn', 'Neptune'],
      answerAr: 'المشتري',
      answerEn: 'Jupiter',
      acceptedAnswers: ['المشتري', 'مشتري', 'jupiter', '1'],
    },
    {
      promptAr: 'كم عدد ألوان قوس قزح الأساسية؟',
      promptEn: 'How many colors are in a classic rainbow?',
      optionsAr: ['5', '6', '7', '8'],
      optionsEn: ['5', '6', '7', '8'],
      answerAr: '7',
      answerEn: '7',
      acceptedAnswers: ['7', 'سبعة', 'seven', '2'],
    },
    {
      promptAr: 'ما هي عاصمة اليابان؟',
      promptEn: 'What is the capital city of Japan?',
      optionsAr: ['أوساكا', 'كيوتو', 'طوكيو', 'سيول'],
      optionsEn: ['Osaka', 'Kyoto', 'Tokyo', 'Seoul'],
      answerAr: 'طوكيو',
      answerEn: 'Tokyo',
      acceptedAnswers: ['طوكيو', 'tokyo', '2'],
    },
    {
      promptAr: 'أي معدن يكون في الحالة السائلة عند درجة حرارة الغرفة؟',
      promptEn: 'Which metal is liquid at room temperature?',
      optionsAr: ['الحديد', 'الزئبق', 'الفضة', 'النحاس'],
      optionsEn: ['Iron', 'Mercury', 'Silver', 'Copper'],
      answerAr: 'الزئبق',
      answerEn: 'Mercury',
      acceptedAnswers: ['الزئبق', 'زئبق', 'mercury', '1'],
    },
    {
      promptAr: 'ما هو أطول نهر في العالم؟',
      promptEn: 'Which river is among the longest rivers in the world, flowing through Egypt?',
      optionsAr: ['الأمازون', 'النيل', 'الفرات', 'الدانوب'],
      optionsEn: ['Amazon', 'Nile', 'Euphrates', 'Danube'],
      answerAr: 'النيل',
      answerEn: 'Nile',
      acceptedAnswers: ['النيل', 'نيل', 'nile', '1'],
    },
  ],
  true_false: [
    {
      promptAr: 'صح أم خطأ: الضوء أسرع من الصوت.',
      promptEn: 'True or False: Light travels faster than sound.',
      optionsAr: ['صح', 'خطأ'],
      optionsEn: ['True', 'False'],
      answerAr: 'صح',
      answerEn: 'True',
      acceptedAnswers: ['صح', 'true', 'yes', 'نعم', '0'],
    },
    {
      promptAr: 'صح أم خطأ: الأخطبوط يمتلك قلباً واحداً فقط.',
      promptEn: 'True or False: An octopus has only one heart.',
      optionsAr: ['صح', 'خطأ'],
      optionsEn: ['True', 'False'],
      answerAr: 'خطأ',
      answerEn: 'False',
      acceptedAnswers: ['خطأ', 'خطا', 'false', 'no', 'لا', '1'],
    },
    {
      promptAr: 'صح أم خطأ: الماء يغلي عند 100 درجة مئوية على مستوى سطح البحر.',
      promptEn: 'True or False: Water boils at 100°C at sea level.',
      optionsAr: ['صح', 'خطأ'],
      optionsEn: ['True', 'False'],
      answerAr: 'صح',
      answerEn: 'True',
      acceptedAnswers: ['صح', 'true', 'yes', 'نعم', '0'],
    },
    {
      promptAr: 'صح أم خطأ: الشمس هي أقرب نجم إلى كوكب الأرض.',
      promptEn: 'True or False: The Sun is the closest star to Earth.',
      optionsAr: ['صح', 'خطأ'],
      optionsEn: ['True', 'False'],
      answerAr: 'صح',
      answerEn: 'True',
      acceptedAnswers: ['صح', 'true', 'yes', 'نعم', '0'],
    },
    {
      promptAr: 'صح أم خطأ: الخفافيش طيور تضع البيض.',
      promptEn: 'True or False: Bats are birds that lay eggs.',
      optionsAr: ['صح', 'خطأ'],
      optionsEn: ['True', 'False'],
      answerAr: 'خطأ',
      answerEn: 'False',
      acceptedAnswers: ['خطأ', 'خطا', 'false', 'no', 'لا', '1'],
    },
  ],
  word_guess: [
    {
      promptAr: 'خمّن الكلمة: وسيلة تواصل بالصوت داخل غرف SOUL-X (من 7 أحرف: م_ي_ر_ف_ن)',
      promptEn: 'Guess the word: Audio input device for voice rooms (M _ C _ O _ H _ N _)',
      hintAr: 'يبدأ بحرف الميم',
      hintEn: 'Starts with M',
      answerAr: 'مايكروفون',
      answerEn: 'Microphone',
      acceptedAnswers: ['مايكروفون', 'ميكروفون', 'مايك', 'microphone', 'mic'],
    },
    {
      promptAr: 'خمّن الكلمة: النجم الذي ينير الأرض نهاراً (3 أحرف)',
      promptEn: 'Guess the word: The star that lights Earth during daytime (3 letters)',
      hintAr: 'تشرق كل صباح',
      hintEn: 'Rises every morning',
      answerAr: 'شمس',
      answerEn: 'Sun',
      acceptedAnswers: ['شمس', 'الشمس', 'sun'],
    },
    {
      promptAr: 'خمّن الكلمة: أبيض من الثلج وأسود من الليل، أكله حرام وشربه حلال؟',
      promptEn: 'Guess the word: Sweet natural nectar made by bees (5 letters)',
      hintAr: 'يصنعه النحل أو مقبرة (في اللغز العربي)',
      hintEn: 'Golden and sweet',
      answerAr: 'عسل',
      answerEn: 'Honey',
      acceptedAnswers: ['عسل', 'العسل', 'مقبرة', 'المقبرة', 'honey'],
    },
    {
      promptAr: 'خمّن الكلمة: معدن ثمين أصفر اللون (3 أحرف)',
      promptEn: 'Guess the word: Precious yellow metal (4 letters)',
      hintAr: 'يُصنع منه التاج',
      hintEn: 'Crowns are made of it',
      answerAr: 'ذهب',
      answerEn: 'Gold',
      acceptedAnswers: ['ذهب', 'الذهب', 'gold'],
    },
  ],
  who_am_i: [
    {
      promptAr: 'من أنا؟ أجري ولا أمشي، ولي لسان ولا أتكلم، ولي فراش ولا أنام.',
      promptEn: 'Who am I? I run but never walk, have a bed but never sleep, and a mouth but never speak.',
      hintAr: 'ماء جارٍ في الطبيعة',
      hintEn: 'Flowing fresh water',
      answerAr: 'النهر',
      answerEn: 'River',
      acceptedAnswers: ['النهر', 'نهر', 'river', 'a river'],
    },
    {
      promptAr: 'من أنا؟ لي أوراق ولست بنبات، ولي جلد ولست بحيوان، وأعلمك أشياء كثيرة.',
      promptEn: 'Who am I? I have many leaves and a spine, yet I am not a tree or an animal.',
      hintAr: 'تقرأه يومياً',
      hintEn: 'You read it',
      answerAr: 'الكتاب',
      answerEn: 'Book',
      acceptedAnswers: ['الكتاب', 'كتاب', 'book', 'a book'],
    },
    {
      promptAr: 'من أنا؟ أسمع بلا أذن وأتكلم بلا لسان.',
      promptEn: 'Who am I? I speak without a mouth and hear without ears, coming alive with wind.',
      hintAr: 'يرد الصوت',
      hintEn: 'Sound bounce',
      answerAr: 'الصدى',
      answerEn: 'Echo',
      acceptedAnswers: ['الصدى', 'صدى', 'الهاتف', 'echo', 'an echo'],
    },
    {
      promptAr: 'من أنا؟ كلما أخذت مني كبرتُ أكثر.',
      promptEn: 'Who am I? The more you take away from me, the bigger I grow.',
      hintAr: 'في الأرض',
      hintEn: 'Digging',
      answerAr: 'الحفرة',
      answerEn: 'Hole',
      acceptedAnswers: ['الحفرة', 'حفرة', 'hole', 'a hole'],
    },
  ],
  speed_challenge: [
    {
      promptAr: 'تحدي السرعة: ما ناتج 15 × 4 + 12 ؟',
      promptEn: 'Speed Math: What is 15 × 4 + 12 ?',
      optionsAr: ['62', '72', '82', '68'],
      optionsEn: ['62', '72', '82', '68'],
      answerAr: '72',
      answerEn: '72',
      acceptedAnswers: ['72', '1'],
    },
    {
      promptAr: 'تحدي السرعة: كم دقيقة في 3 ساعات ونصف؟',
      promptEn: 'Speed Challenge: How many minutes are in 3.5 hours?',
      optionsAr: ['180', '195', '210', '220'],
      optionsEn: ['180', '195', '210', '220'],
      answerAr: '210',
      answerEn: '210',
      acceptedAnswers: ['210', '2'],
    },
    {
      promptAr: 'تحدي السرعة: كم عدد مقاعد الصوت في غرف SOUL-X؟',
      promptEn: 'Speed Challenge: How many voice seats are in a SOUL-X Room?',
      optionsAr: ['10', '12', '15', '20'],
      optionsEn: ['10', '12', '15', '20'],
      answerAr: '15',
      answerEn: '15',
      acceptedAnswers: ['15', '2'],
    },
    {
      promptAr: 'تحدي السرعة: ما ناتج 9 × 9 - 11 ؟',
      promptEn: 'Speed Math: What is 9 × 9 - 11 ?',
      optionsAr: ['70', '72', '69', '80'],
      optionsEn: ['70', '72', '69', '80'],
      answerAr: '70',
      answerEn: '70',
      acceptedAnswers: ['70', '0'],
    },
  ],
};
