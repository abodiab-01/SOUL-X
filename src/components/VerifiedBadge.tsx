import React from 'react';
import { Language } from '../types';

interface VerifiedBadgeProps {
  lang?: Language;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<VerifiedBadgeProps['size']>, string> = {
  xs: 'w-3.5 h-3.5',
  sm: 'w-4 h-4',
  md: 'w-[18px] h-[18px]',
  lg: 'w-5 h-5',
};

export const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({
  lang = 'ar',
  size = 'sm',
  className = '',
}) => {
  const title = lang === 'ar' ? 'حساب موثق' : 'Verified Account';
  return (
    <span
      title={title}
      aria-label={title}
      className={`inline-flex items-center justify-center shrink-0 align-middle select-none ${SIZE_CLASSES[size]} ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-[0_1px_2px_rgba(29,155,240,0.35)]"
      >
        <path
          d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34z"
          fill="#1D9BF0"
        />
        <path
          d="M10.54 16.2L6.8 12.46l1.41-1.42 2.33 2.33 5.29-5.3 1.41 1.42-6.7 6.71z"
          fill="#FFFFFF"
        />
      </svg>
    </span>
  );
};
