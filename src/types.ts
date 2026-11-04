export type Language = 'ar' | 'en';
export type Theme = 'dark' | 'light';
export type Gender = 'male' | 'female';

export interface UserProfileDetails {
  birthDate: string; // Format: YYYY-MM-DD
  gender: Gender;
  country?: string;
}

export interface AuthUser {
  id: string;
  displayId?: string;
  name: string;
  email: string;
  photoUrl?: string;
  createdAt: string;
  birthDate?: string | null;
  gender?: Gender | null;
  country?: string | null;
  walletBalance?: number;
  coinsBalance?: number;
  bio?: string;
}

export interface SavedAccount {
  id: string;
  displayId: string;
  name: string;
  email: string;
  photoUrl?: string | null;
  gender?: Gender | null;
  birthDate?: string | null;
  country?: string | null;
  lastLogin: string;
  refreshToken?: string;
  token?: string;
  refreshExpiresAt?: string;
  autoLoginEnabled?: boolean;
}

export interface AgentRecord {
  id: string;
  gridCode?: string; // رقم القريد للوكيل مثال A8838
  email: string;
  name: string;
  nameEn?: string;
  taglineAr?: string;
  taglineEn?: string;
  country: string;
  flag: string;
  balance: number;
  category: 'recharge' | 'withdraw' | 'both';
  methods: string[];
  responseTimeAr?: string;
  responseTimeEn?: string;
  rating?: number;
  completedOrders?: number;
  whatsapp?: string;
  telegram?: string;
  isOnline?: boolean;
  minAmount?: number;
  maxAmount?: number;
  rateNoteAr?: string;
  rateNoteEn?: string;
  status: 'active' | 'suspended';
  createdAt: string;
  updatedAt?: string;
}

export interface AgencyWithdrawalRequest {
  id: string;
  agentId: string;
  agentName: string;
  gridCode: string;
  amount: number;
  fee?: number;
  netCredited?: number;
  method: string;
  accountDetails: string;
  notes?: string;
  status: 'pending' | 'completed' | 'rejected';
  userId?: string;
  userDisplayId?: string;
  userName?: string;
  type?: 'agency_cashout' | 'incoming_user_withdrawal';
  createdAt: string;
  updatedAt?: string;
  adminNote?: string;
}

export interface AgencyRechargeTransaction {
  id: string;
  agentId: string;
  gridCode: string;
  targetUserId: string;
  targetUserDisplayId?: string;
  targetUserName: string;
  amount: number;
  grossAmount?: number;
  feeAmount?: number;
  feePercentage?: number;
  payoutMethod?: string;
  accountDetails?: string;
  type?: 'recharge' | 'user_withdrawal';
  timestamp: string;
  previousBalance?: number;
  newBalance?: number;
}

export interface SearchUserResult {
  id: string;
  name: string;
  nameEn?: string;
  username?: string;
  avatar: string;
  bio: string;
  bioEn?: string;
  gender?: Gender | null;
  age?: number;
  location?: string;
  matchScore: number;
  status: 'online' | 'offline';
  isFriend?: boolean;
  hasPendingRequest?: boolean;
}

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

export interface TelegramAuthResult {
  isTelegram: boolean;
  isVerified: boolean;
  user: TelegramUser | null;
  authDate?: number;
  error?: string;
  message?: string;
  isSimulated?: boolean;
}

export interface Project {
  id: string;
  title: {
    ar: string;
    en: string;
  };
  category: {
    ar: string;
    en: string;
  };
  categoryKey: 'hardware' | 'digital' | 'spatial';
  year: string;
  tagline: {
    ar: string;
    en: string;
  };
  description: {
    ar: string;
    en: string;
  };
  metrics: {
    ar: string;
    en: string;
  };
  image: string;
  details: {
    ar: string[];
    en: string[];
  };
  specs: {
    label: { ar: string; en: string };
    value: { ar: string; en: string };
  }[];
}

export interface Pillar {
  number: string;
  title: {
    ar: string;
    en: string;
  };
  description: {
    ar: string;
    en: string;
  };
  deliverable: {
    ar: string;
    en: string;
  };
}
