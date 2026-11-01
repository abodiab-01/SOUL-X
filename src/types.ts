export type Language = 'ar' | 'en';
export type Theme = 'dark' | 'light';
export type Gender = 'male' | 'female';

export interface UserProfileDetails {
  birthDate: string; // Format: YYYY-MM-DD
  gender: Gender;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  photoUrl?: string;
  createdAt: string;
  birthDate?: string | null;
  gender?: Gender | null;
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
