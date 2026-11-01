export type Language = 'ar' | 'en';
export type Theme = 'dark' | 'light';

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
