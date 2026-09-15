import React from 'react';

interface DyarteLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  subtitle?: string;
}

export const DyarteLogo: React.FC<DyarteLogoProps> = ({
  className = '',
  size = 'md',
  showText = true,
  subtitle = 'OPTIMIZER PRO',
}) => {
  const sizeMap = {
    sm: { icon: 22, text: 'text-xs', sub: 'text-[8px]' },
    md: { icon: 32, text: 'text-sm', sub: 'text-[9px]' },
    lg: { icon: 44, text: 'text-base', sub: 'text-[10px]' },
    xl: { icon: 64, text: 'text-xl', sub: 'text-xs' },
  };

  const currentSize = sizeMap[size];

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* Chrome / Metallic Stylized 'D' Icon with Dynamic Arrow */}
      <div
        className="relative shrink-0 flex items-center justify-center"
        style={{ width: currentSize.icon, height: currentSize.icon }}
      >
        <svg
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-[0_2px_10px_rgba(255,255,255,0.15)]"
        >
          <defs>
            <linearGradient id="dyarteMetallic" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="30%" stopColor="#E2E8F0" />
              <stop offset="70%" stopColor="#94A3B8" />
              <stop offset="100%" stopColor="#CBD5E1" />
            </linearGradient>
            <linearGradient id="dyarteAccent" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FF3333" />
              <stop offset="100%" stopColor="#B30000" />
            </linearGradient>
            <filter id="subtleGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Stylized Modern 'D' Monogram from user's brand logo */}
          {/* Outer stroke / ribbon */}
          <path
            d="M 18 16 
               L 60 16 
               C 82 16, 92 32, 92 50 
               C 92 68, 80 84, 58 84 
               L 42 84 
               L 56 60 
               L 60 60 
               C 70 60, 76 56, 76 50 
               C 76 44, 70 38, 58 38 
               L 33 38 
               L 18 16 Z"
            fill="url(#dyarteMetallic)"
          />

          {/* Inner dynamic arrow chevron pointing forward */}
          <path
            d="M 28 32 
               L 52 50 
               L 26 84 
               L 16 84 
               L 38 50 
               L 18 32 Z"
            fill="url(#dyarteMetallic)"
          />

          {/* Subtle red accent highlight for the optimizer brand identity */}
          <circle cx="52" cy="50" r="2.5" fill="url(#dyarteAccent)" />
        </svg>
      </div>

      {/* Brand typography */}
      {showText && (
        <div className="flex flex-col">
          {/* DYARTE text using uniform clean display styling */}
          <div className={`tracking-[0.22em] font-black text-white leading-none font-mono ${currentSize.text}`}>
            DYARTE
          </div>
          {subtitle && (
            <span
              className={`font-mono font-bold tracking-[0.2em] text-[#E00000] uppercase mt-1 ${currentSize.sub}`}
            >
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
