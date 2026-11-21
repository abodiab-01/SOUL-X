import React from 'react';
import { getFrameById, AvatarFrameDef } from '../data/avatarFrames';

interface FrameOverlayProps {
  frame: AvatarFrameDef;
}

const FrameOverlaySvg: React.FC<FrameOverlayProps> = ({ frame }) => {
  const gradId = `frame-grad-${frame.id}`;
  const glowId = `frame-glow-${frame.id}`;

  // 1. Colored Frames (Crisp glowing gradient ring)
  if (frame.category === 'colored') {
    const isRainbow = frame.id === 'color-rainbow';
    return (
      <svg
        viewBox="0 0 120 120"
        className="absolute inset-[-12%] w-[124%] h-[124%] pointer-events-none select-none overflow-visible"
        aria-hidden="true"
      >
        <defs>
          {isRainbow ? (
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="20%" stopColor="#f59e0b" />
              <stop offset="40%" stopColor="#10b981" />
              <stop offset="60%" stopColor="#06b6d4" />
              <stop offset="80%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>
          ) : (
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={frame.primaryColor} />
              <stop offset="50%" stopColor={frame.accentColor || frame.primaryColor} />
              <stop offset="100%" stopColor={frame.secondaryColor} />
            </linearGradient>
          )}
        </defs>
        <circle
          cx="60"
          cy="60"
          r="50"
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth="6.5"
          opacity="0.3"
        />
        <circle
          cx="60"
          cy="60"
          r="50"
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth="4.5"
        />
        <circle
          cx="60"
          cy="60"
          r="53.5"
          fill="none"
          stroke={frame.accentColor || frame.primaryColor}
          strokeWidth="1"
          strokeDasharray="6 6"
          opacity="0.7"
        />
      </svg>
    );
  }

  // 2. Professional Frames (Dual Neon, Flames, Volt, Frost, Cosmic, Titanium)
  if (frame.category === 'professional') {
    return (
      <svg
        viewBox="0 0 120 120"
        className="absolute inset-[-15%] w-[130%] h-[130%] pointer-events-none select-none overflow-visible"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={frame.primaryColor} />
            <stop offset="50%" stopColor={frame.accentColor || frame.primaryColor} />
            <stop offset="100%" stopColor={frame.secondaryColor} />
          </linearGradient>
          <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Outer glowing tech halo */}
        <circle
          cx="60"
          cy="60"
          r="52"
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth="4.8"
          filter={`url(#${glowId})`}
        />

        {/* Animated rotating outer orbital arcs */}
        <g className="origin-center animate-[spin_9s_linear_infinite]">
          <circle
            cx="60"
            cy="60"
            r="56"
            fill="none"
            stroke={frame.primaryColor}
            strokeWidth="2"
            strokeDasharray="24 14 8 14"
            strokeLinecap="round"
            opacity="0.9"
          />
          <circle cx="60" cy="4" r="3" fill={frame.accentColor || '#fff'} />
          <circle cx="60" cy="116" r="3" fill={frame.secondaryColor} />
        </g>

        {/* Counter-rotating inner accent segments */}
        <g className="origin-center animate-[spin_14s_linear_infinite_reverse]">
          <circle
            cx="60"
            cy="60"
            r="48.5"
            fill="none"
            stroke={frame.accentColor || frame.secondaryColor}
            strokeWidth="1.4"
            strokeDasharray="10 18"
            strokeLinecap="round"
            opacity="0.75"
          />
        </g>

        {/* Flame / Frost / Volt cardinal accents */}
        {frame.id === 'pro-blazing-flame' && (
          <g fill={frame.accentColor || '#fde047'}>
            <path d="M60 1 C64 7 62 12 60 14 C58 12 56 7 60 1Z" opacity="0.95" />
            <path d="M118 60 C112 64 107 62 105 60 C107 58 112 56 118 60Z" opacity="0.85" />
            <path d="M2 60 C8 56 13 58 15 60 C13 62 8 64 2 60Z" opacity="0.85" />
          </g>
        )}
        {frame.id === 'pro-frost-crystal' && (
          <g stroke="#ffffff" strokeWidth="1.5" fill={frame.primaryColor}>
            <polygon points="60,1 63,7 60,12 57,7" />
            <polygon points="60,119 63,113 60,108 57,113" />
            <polygon points="1,60 7,57 12,60 7,63" />
            <polygon points="119,60 113,57 108,60 113,63" />
          </g>
        )}
        {frame.id === 'pro-electric-pulse' && (
          <g fill={frame.accentColor || '#e0f2fe'}>
            <polygon points="61,2 56,10 60,10 58,16 65,8 61,8" />
            <polygon points="59,118 64,110 60,110 62,104 55,112 59,112" />
          </g>
        )}
        {frame.id === 'pro-cosmic-orbit' && (
          <g fill={frame.accentColor || '#fde68a'}>
            <circle cx="20" cy="20" r="2.2" />
            <circle cx="100" cy="22" r="2.6" />
            <circle cx="98" cy="100" r="2" />
            <circle cx="22" cy="98" r="2.4" />
          </g>
        )}
      </svg>
    );
  }

  // 3. VIP Shapes (Crowns, Wings, Diamonds, Crescent, Sovereign Phoenix, Apex Throne)
  const hasWings =
    frame.id === 'vip-royal-wings' ||
    frame.id === 'vip-apex-throne' ||
    frame.id === 'vip-sovereign-phoenix';
  const hasCrown =
    frame.id === 'vip-golden-crown' ||
    frame.id === 'vip-imperial-diamond' ||
    frame.id === 'vip-apex-throne' ||
    frame.id === 'vip-sovereign-phoenix';
  const isMoon = frame.id === 'vip-celestial-moon';

  return (
    <svg
      viewBox="0 0 140 140"
      className="absolute inset-[-22%] w-[144%] h-[144%] pointer-events-none select-none overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={frame.accentColor || '#fef08a'} />
          <stop offset="45%" stopColor={frame.primaryColor} />
          <stop offset="100%" stopColor={frame.secondaryColor} />
        </linearGradient>
        <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Ornate Wings for Winged VIP Frames */}
      {hasWings && (
        <g filter={`url(#${glowId})`}>
          {/* Left Wing */}
          <path
            d="M22 68 C6 60 2 44 6 32 C12 40 20 42 26 44 C14 34 12 22 18 16 C23 26 30 33 36 37 C28 48 26 60 27 72 Z"
            fill={`url(#${gradId})`}
            stroke="#ffffff"
            strokeWidth="0.9"
            opacity="0.94"
          />
          <path
            d="M24 74 C10 74 4 64 7 56 C13 62 19 63 26 63 Z"
            fill={frame.primaryColor}
            opacity="0.85"
          />
          {/* Right Wing */}
          <path
            d="M118 68 C134 60 138 44 134 32 C128 40 120 42 114 44 C126 34 128 22 122 16 C117 26 110 33 104 37 C112 48 114 60 113 72 Z"
            fill={`url(#${gradId})`}
            stroke="#ffffff"
            strokeWidth="0.9"
            opacity="0.94"
          />
          <path
            d="M116 74 C130 74 136 64 133 56 C127 62 121 63 114 63 Z"
            fill={frame.primaryColor}
            opacity="0.85"
          />
        </g>
      )}

      {/* Main VIP Outer Ornate Ring */}
      <circle
        cx="70"
        cy="70"
        r="50"
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth="5.8"
        filter={`url(#${glowId})`}
      />
      <circle
        cx="70"
        cy="70"
        r="54"
        fill="none"
        stroke={frame.accentColor || '#fef08a'}
        strokeWidth="1.3"
        strokeDasharray="16 8 4 8"
        className="origin-center animate-[spin_18s_linear_infinite]"
      />

      {/* Side Laurel / Gem Accents */}
      <circle cx="20" cy="70" r="3.4" fill={frame.accentColor || '#fff'} stroke={frame.secondaryColor} strokeWidth="1.2" />
      <circle cx="120" cy="70" r="3.4" fill={frame.accentColor || '#fff'} stroke={frame.secondaryColor} strokeWidth="1.2" />

      {/* Top Royal Crown / Tiara */}
      {hasCrown && (
        <g transform="translate(46, 2)" filter={`url(#${glowId})`}>
          <path
            d="M4 22 L0 7 L14 14 L24 2 L34 14 L48 7 L44 22 Z"
            fill={`url(#${gradId})`}
            stroke="#ffffff"
            strokeWidth="1.1"
            strokeLinejoin="round"
          />
          <rect x="4" y="21" width="40" height="4.5" rx="2.2" fill={frame.secondaryColor} stroke={frame.accentColor || '#fef08a'} strokeWidth="0.8" />
          <circle cx="24" cy="1.8" r="2.4" fill={frame.accentColor || '#fff'} />
          <circle cx="24" cy="14.5" r="2.6" fill={frame.id === 'vip-imperial-diamond' ? '#38bdf8' : frame.id === 'vip-sovereign-phoenix' ? '#f43f5e' : '#ef4444'} />
        </g>
      )}

      {/* Celestial Moon & Stars VIP Crest */}
      {isMoon && (
        <g filter={`url(#${glowId})`}>
          <path
            d="M78 6 C68 6 62 15 65 23 C71 21 76 15 78 6 Z"
            fill={frame.accentColor || '#fde68a'}
            stroke="#ffffff"
            strokeWidth="0.9"
          />
          <polygon points="56,12 57.5,16 61.5,16 58.3,18.4 59.5,22 56,19.8 52.5,22 53.7,18.4 50.5,16 54.5,16" fill="#fef08a" />
          <polygon points="88,16 89,19 92,19 89.6,20.8 90.5,23.5 88,21.8 85.5,23.5 86.4,20.8 84,19 87,19" fill="#fef08a" />
        </g>
      )}

      {/* Bottom VIP Crest Pill */}
      {frame.vipTag && (
        <g transform="translate(50, 111)">
          <rect
            x="0"
            y="0"
            width="40"
            height="14"
            rx="7"
            fill={frame.secondaryColor}
            stroke={frame.accentColor || '#fef08a'}
            strokeWidth="1.2"
          />
          <text
            x="20"
            y="10"
            textAnchor="middle"
            fill={frame.accentColor || '#ffffff'}
            fontSize="8.5"
            fontWeight="900"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            letterSpacing="0.8"
          >
            {frame.vipTag}
          </text>
        </g>
      )}
    </svg>
  );
};

interface AvatarWithFrameProps {
  src: string;
  alt: string;
  frameId?: string | null;
  sizeClass?: string;
  imgClassName?: string;
  fallbackSrc?: string;
  onError?: React.ReactEventHandler<HTMLImageElement>;
  children?: React.ReactNode;
}

export const AvatarWithFrame: React.FC<AvatarWithFrameProps> = ({
  src,
  alt,
  frameId,
  sizeClass = 'w-12 h-12',
  imgClassName = 'rounded-full object-cover w-full h-full',
  fallbackSrc,
  onError,
  children,
}) => {
  const frame = getFrameById(frameId);

  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${sizeClass}`}>
      <img
        src={src}
        alt={alt}
        className={imgClassName}
        onError={(e) => {
          if (fallbackSrc && e.currentTarget.src !== fallbackSrc) {
            e.currentTarget.src = fallbackSrc;
          }
          onError?.(e);
        }}
      />
      {frame && <FrameOverlaySvg frame={frame} />}
      {children}
    </div>
  );
};
