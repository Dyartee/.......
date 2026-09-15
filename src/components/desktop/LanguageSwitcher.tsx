import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { BrazilFlag, UsaFlag, SpainFlag } from '../../i18n/FlagIcons';
import { LanguageCode } from '../../i18n/translations';
import { ChevronDown, Check } from 'lucide-react';

interface LanguageSwitcherProps {
  className?: string;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ className = '' }) => {
  const { currentLanguage, setLanguage } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const languageMap: Record<
    LanguageCode,
    { label: string; codeName: string; flag: React.ReactNode }
  > = {
    pt: {
      label: 'Português (BR)',
      codeName: 'PT-BR',
      flag: <BrazilFlag size="sm" />,
    },
    en: {
      label: 'English (US)',
      codeName: 'EN-US',
      flag: <UsaFlag size="sm" />,
    },
    es: {
      label: 'Español (ES)',
      codeName: 'ES-ES',
      flag: <SpainFlag size="sm" />,
    },
  };

  const currentOption = languageMap[currentLanguage] || languageMap.pt;

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      {/* Trigger: Show ONLY flag and subtle chevron, no language text */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#12121a] hover:bg-[#1b1b26] border border-[#262638] hover:border-[#3b3b54] text-xs font-mono text-zinc-200 transition-all cursor-pointer shadow-sm group"
        title="Alterar Idioma"
        aria-label="Alterar Idioma"
      >
        <span className="shrink-0 drop-shadow">{currentOption.flag}</span>
        <ChevronDown
          className={`w-3 h-3 text-zinc-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-white' : 'group-hover:text-zinc-200'
          }`}
        />
      </button>

      {/* Floating Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-44 rounded-xl bg-[#101017] border border-[#29293d] shadow-2xl z-50 py-1 overflow-hidden backdrop-blur-md animate-in fade-in duration-150">
          <div className="px-3 py-1.5 text-[10px] font-mono uppercase text-zinc-500 font-bold tracking-wider border-b border-[#1c1c2b]">
            Selecionar Idioma
          </div>

          {(Object.keys(languageMap) as LanguageCode[]).map((code) => {
            const opt = languageMap[code];
            const isSelected = currentLanguage === code;

            return (
              <button
                key={code}
                type="button"
                onClick={() => {
                  setLanguage(code);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-mono transition-colors cursor-pointer text-left ${
                  isSelected
                    ? 'bg-[#E00000]/15 text-white font-bold border-l-2 border-[#E00000]'
                    : 'text-zinc-300 hover:bg-[#181824] hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="shrink-0">{opt.flag}</span>
                  <span>{opt.label}</span>
                </div>
                {isSelected && <Check className="w-3.5 h-3.5 text-[#FF4444]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
