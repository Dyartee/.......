import React from 'react';

interface FlagProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * High-definition SVG Flag of Brazil 🇧🇷
 */
export const BrazilFlag: React.FC<FlagProps> = ({ className = '', size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-4 h-3',
    md: 'w-6 h-4',
    lg: 'w-8 h-5.5',
  }[size];

  return (
    <svg
      viewBox="0 0 720 504"
      className={`rounded-sm shadow-sm shrink-0 object-cover ${sizeClasses} ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Bandeira do Brasil"
    >
      {/* Green Field */}
      <rect width="720" height="504" fill="#009c3b" />
      {/* Yellow Rhombus */}
      <polygon points="360,50 660,252 360,454 60,252" fill="#ffdf00" />
      {/* Blue Celestial Globe */}
      <circle cx="360" cy="252" r="126" fill="#002776" />
      {/* White Arc (Ordem e Progresso banner) */}
      <path
        d="M 234 252 A 130 130 0 0 1 486 252"
        fill="none"
        stroke="#ffffff"
        strokeWidth="16"
      />
    </svg>
  );
};

/**
 * High-definition SVG Flag of United States 🇺🇸
 */
export const UsaFlag: React.FC<FlagProps> = ({ className = '', size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-4 h-3',
    md: 'w-6 h-4',
    lg: 'w-8 h-5.5',
  }[size];

  return (
    <svg
      viewBox="0 0 741 390"
      className={`rounded-sm shadow-sm shrink-0 object-cover ${sizeClasses} ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Flag of the United States"
    >
      {/* 13 Stripes */}
      <rect width="741" height="390" fill="#b22234" />
      <rect y="30" width="741" height="30" fill="#ffffff" />
      <rect y="90" width="741" height="30" fill="#ffffff" />
      <rect y="150" width="741" height="30" fill="#ffffff" />
      <rect y="210" width="741" height="30" fill="#ffffff" />
      <rect y="270" width="741" height="30" fill="#ffffff" />
      <rect y="330" width="741" height="30" fill="#ffffff" />
      {/* Blue Canton */}
      <rect width="296" height="210" fill="#3c3b6e" />
      {/* Mini Stars Representation */}
      <circle cx="50" cy="40" r="8" fill="#ffffff" />
      <circle cx="100" cy="40" r="8" fill="#ffffff" />
      <circle cx="150" cy="40" r="8" fill="#ffffff" />
      <circle cx="200" cy="40" r="8" fill="#ffffff" />
      <circle cx="250" cy="40" r="8" fill="#ffffff" />

      <circle cx="75" cy="80" r="8" fill="#ffffff" />
      <circle cx="125" cy="80" r="8" fill="#ffffff" />
      <circle cx="175" cy="80" r="8" fill="#ffffff" />
      <circle cx="225" cy="80" r="8" fill="#ffffff" />

      <circle cx="50" cy="120" r="8" fill="#ffffff" />
      <circle cx="100" cy="120" r="8" fill="#ffffff" />
      <circle cx="150" cy="120" r="8" fill="#ffffff" />
      <circle cx="200" cy="120" r="8" fill="#ffffff" />
      <circle cx="250" cy="120" r="8" fill="#ffffff" />

      <circle cx="75" cy="160" r="8" fill="#ffffff" />
      <circle cx="125" cy="160" r="8" fill="#ffffff" />
      <circle cx="175" cy="160" r="8" fill="#ffffff" />
      <circle cx="225" cy="160" r="8" fill="#ffffff" />
    </svg>
  );
};

/**
 * High-definition SVG Flag of Spain 🇪🇸
 */
export const SpainFlag: React.FC<FlagProps> = ({ className = '', size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-4 h-3',
    md: 'w-6 h-4',
    lg: 'w-8 h-5.5',
  }[size];

  return (
    <svg
      viewBox="0 0 750 500"
      className={`rounded-sm shadow-sm shrink-0 object-cover ${sizeClasses} ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Bandera de España"
    >
      {/* Red Top Stripe */}
      <rect width="750" height="125" fill="#aa151b" />
      {/* Yellow Middle Stripe (2x height) */}
      <rect y="125" width="750" height="250" fill="#f1bf00" />
      {/* Red Bottom Stripe */}
      <rect y="375" width="750" height="125" fill="#aa151b" />
      {/* Spanish Coat of Arms emblem */}
      <g transform="translate(180, 190)">
        {/* Crown */}
        <path d="M 0 -10 L 40 -10 L 35 10 L 5 10 Z" fill="#aa151b" />
        <circle cx="20" cy="-20" r="6" fill="#aa151b" />
        {/* Shield */}
        <rect x="0" y="15" width="40" height="55" rx="10" fill="#aa151b" />
        <rect x="5" y="20" width="30" height="45" rx="8" fill="#f1bf00" />
        <line x1="20" y1="20" x2="20" y2="65" stroke="#aa151b" strokeWidth="2" />
        <line x1="5" y1="42" x2="35" y2="42" stroke="#aa151b" strokeWidth="2" />
        {/* Pillars */}
        <rect x="-15" y="10" width="6" height="65" rx="2" fill="#aa151b" />
        <rect x="49" y="10" width="6" height="65" rx="2" fill="#aa151b" />
      </g>
    </svg>
  );
};
