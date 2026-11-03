import React from 'react';

interface CurrencyIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  size?: number | string;
}

/**
 * High-definition Vector SVG Coin Icon
 * Stylized gold/amber coin with metallic relief, rim, and Soul-X spark
 */
export const CoinIcon: React.FC<CurrencyIconProps> = ({
  className = 'w-4 h-4',
  size,
  ...props
}) => {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block shrink-0 select-none align-middle ${className}`}
      width={size}
      height={size}
      aria-hidden="true"
      {...props}
    >
      <defs>
        {/* Outer Coin Edge Gradient */}
        <linearGradient id="sxCoinRim" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="30%" stopColor="#F59E0B" />
          <stop offset="70%" stopColor="#D97706" />
          <stop offset="100%" stopColor="#92400E" />
        </linearGradient>

        {/* Inner Coin Face Gradient */}
        <radialGradient id="sxCoinInner" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#FEF3C7" />
          <stop offset="45%" stopColor="#FBBF24" />
          <stop offset="85%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#B45309" />
        </radialGradient>

        {/* Center Spark / Star Gradient */}
        <linearGradient id="sxCoinSpark" x1="8" y1="7" x2="16" y2="17" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFBEB" />
          <stop offset="50%" stopColor="#FDE68A" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>

        {/* Subtle upper rim specular highlight */}
        <linearGradient id="sxCoinHighlight" x1="12" y1="2" x2="12" y2="10" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Drop shadow / base circle */}
      <circle cx="12" cy="12.5" r="9.75" fill="#78350F" opacity="0.35" />

      {/* Outer Coin Rim */}
      <circle cx="12" cy="12" r="9.5" fill="url(#sxCoinRim)" stroke="#F59E0B" strokeWidth="0.5" />

      {/* Coin Ridges/Bevel Border */}
      <circle cx="12" cy="12" r="8" fill="url(#sxCoinInner)" stroke="#B45309" strokeWidth="0.6" strokeDasharray="1.2 0.8" opacity="0.8" />

      {/* Inner Recessed Face */}
      <circle cx="12" cy="12" r="7.2" fill="url(#sxCoinInner)" />

      {/* Top Specular Arc Highlight */}
      <path
        d="M6 10 C7.5 5.5 16.5 5.5 18 10"
        stroke="url(#sxCoinHighlight)"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
      />

      {/* Center Stylized Emblem: 4-Pointed Starburst / Currency Crest */}
      <path
        d="M12 6.5 C12 9.2 13 10.8 15.5 12 C13 13.2 12 14.8 12 17.5 C12 14.8 11 13.2 8.5 12 C11 10.8 12 9.2 12 6.5 Z"
        fill="url(#sxCoinSpark)"
        stroke="#B45309"
        strokeWidth="0.4"
      />

      {/* Center Spark Core */}
      <circle cx="12" cy="12" r="1.3" fill="#FFFBEB" />
    </svg>
  );
};

/**
 * High-definition Vector SVG Diamond Icon
 * Faceted cyan/azure crystal diamond gemstone with specular light facets
 */
export const DiamondIcon: React.FC<CurrencyIconProps> = ({
  className = 'w-4 h-4',
  size,
  ...props
}) => {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block shrink-0 select-none align-middle ${className}`}
      width={size}
      height={size}
      aria-hidden="true"
      {...props}
    >
      <defs>
        {/* Diamond Crown Gradient */}
        <linearGradient id="sxDiaTable" x1="7" y1="4" x2="17" y2="9" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E0F2FE" />
          <stop offset="40%" stopColor="#BAE6FD" />
          <stop offset="100%" stopColor="#38BDF8" />
        </linearGradient>

        {/* Diamond Pavilion (Lower Cone) Center Gradient */}
        <linearGradient id="sxDiaPavilionCenter" x1="12" y1="9" x2="12" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="45%" stopColor="#0EA5E9" />
          <stop offset="100%" stopColor="#0284C7" />
        </linearGradient>

        {/* Diamond Pavilion Left Facet */}
        <linearGradient id="sxDiaPavilionLeft" x1="2" y1="9" x2="12" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0284C7" />
          <stop offset="100%" stopColor="#0369A1" />
        </linearGradient>

        {/* Diamond Pavilion Right Facet */}
        <linearGradient id="sxDiaPavilionRight" x1="22" y1="9" x2="12" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0284C7" />
          <stop offset="100%" stopColor="#075985" />
        </linearGradient>

        {/* Diamond Upper Left Star Facet */}
        <linearGradient id="sxDiaUpperLeft" x1="2" y1="9" x2="7" y2="4" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#7DD3FC" />
        </linearGradient>

        {/* Diamond Upper Right Star Facet */}
        <linearGradient id="sxDiaUpperRight" x1="22" y1="9" x2="17" y2="4" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0284C7" />
          <stop offset="100%" stopColor="#38BDF8" />
        </linearGradient>
      </defs>

      {/* Subtle outer glow shadow */}
      <polygon points="6.5 4 17.5 4 22 9 12 21 2 9" fill="#082F49" opacity="0.3" transform="translate(0, 0.7)" />

      {/* Table (Top Flat Facet) */}
      <polygon points="7.2 4 16.8 4 14.5 9 9.5 9" fill="url(#sxDiaTable)" />

      {/* Top Left Facet */}
      <polygon points="7.2 4 9.5 9 2 9" fill="url(#sxDiaUpperLeft)" />

      {/* Top Center-Left Facet */}
      <polygon points="7.2 4 12 4 9.5 9" fill="#E0F2FE" opacity="0.9" />

      {/* Top Right Facet */}
      <polygon points="16.8 4 22 9 14.5 9" fill="url(#sxDiaUpperRight)" />

      {/* Top Center-Right Facet */}
      <polygon points="12 4 16.8 4 14.5 9" fill="#7DD3FC" opacity="0.95" />

      {/* Lower Pavilion Left Triangular Facet */}
      <polygon points="2 9 9.5 9 12 21" fill="url(#sxDiaPavilionLeft)" />

      {/* Lower Pavilion Center Triangular Facet (Primary Face) */}
      <polygon points="9.5 9 14.5 9 12 21" fill="url(#sxDiaPavilionCenter)" />

      {/* Lower Pavilion Right Triangular Facet */}
      <polygon points="14.5 9 22 9 12 21" fill="url(#sxDiaPavilionRight)" />

      {/* Crisp Facet Lines / Light Refractions */}
      <polyline
        points="7.2 4 16.8 4 22 9 12 21 2 9 7.2 4"
        stroke="#E0F2FE"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
      <line x1="2" y1="9" x2="22" y2="9" stroke="#E0F2FE" strokeWidth="0.5" opacity="0.8" />
      <line x1="9.5" y1="9" x2="12" y2="21" stroke="#BAE6FD" strokeWidth="0.5" opacity="0.7" />
      <line x1="14.5" y1="9" x2="12" y2="21" stroke="#BAE6FD" strokeWidth="0.5" opacity="0.7" />
      <line x1="9.5" y1="9" x2="7.2" y2="4" stroke="#FFFFFF" strokeWidth="0.5" opacity="0.8" />
      <line x1="14.5" y1="9" x2="16.8" y2="4" stroke="#BAE6FD" strokeWidth="0.5" opacity="0.8" />

      {/* Specular sparkle highlight on top-left facet */}
      <circle cx="8" cy="6" r="0.8" fill="#FFFFFF" opacity="0.9" />
      <polygon points="8 4.6 8.4 5.8 9.4 6 8.4 6.2 8 7.4 7.6 6.2 6.6 6 7.6 5.8" fill="#FFFFFF" opacity="0.95" />
    </svg>
  );
};
