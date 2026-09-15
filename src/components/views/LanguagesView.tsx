import React from 'react';
import { useApp } from '../../context/AppContext';
import { BrazilFlag, UsaFlag, SpainFlag } from '../../i18n/FlagIcons';
import { LanguageCode, SUPPORTED_LANGUAGES } from '../../i18n/translations';
import { Globe, Check, Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';

export const LanguagesView: React.FC = () => {
  const { currentLanguage, setLanguage, t } = useApp();

  const getFlag = (code: LanguageCode, size: 'sm' | 'md' | 'lg' = 'lg') => {
    switch (code) {
      case 'pt':
        return <BrazilFlag size={size} />;
      case 'en':
        return <UsaFlag size={size} />;
      case 'es':
        return <SpainFlag size={size} />;
    }
  };

  const getLanguageDescription = (code: LanguageCode) => {
    switch (code) {
      case 'pt':
        return t('lang_card_pt_desc');
      case 'en':
        return t('lang_card_en_desc');
      case 'es':
        return t('lang_card_es_desc');
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="space-y-1">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-semibold">
          <Globe className="w-3.5 h-3.5" />
          <span>MULTI-LANGUAGE SUPPORT</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white font-mono uppercase">
          {t('lang_view_title')}
        </h1>
        <p className="text-sm text-zinc-400 max-w-2xl leading-relaxed">
          {t('lang_view_subtitle')}
        </p>
      </div>

      {/* Language Selection Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {SUPPORTED_LANGUAGES.map((lang) => {
          const isActive = currentLanguage === lang.code;

          return (
            <div
              key={lang.code}
              onClick={() => setLanguage(lang.code)}
              className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden ${
                isActive
                  ? 'bg-gradient-to-b from-[#181824] to-[#12121a] border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/50'
                  : 'bg-[#111117] border-[#222230] hover:border-zinc-600 hover:bg-[#15151f]'
              }`}
            >
              {/* Active Badge */}
              {isActive && (
                <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-mono font-bold uppercase">
                  <Check className="w-3 h-3" />
                  <span>{t('lang_active_badge')}</span>
                </div>
              )}

              <div className="space-y-4">
                {/* Miniature Flag Icon container with click trigger */}
                <div className="flex items-center gap-3">
                  <div
                    className={`p-1.5 rounded-xl border transition-transform group-hover:scale-105 ${
                      isActive
                        ? 'bg-emerald-500/10 border-emerald-500/40'
                        : 'bg-zinc-800/60 border-zinc-700'
                    }`}
                  >
                    {getFlag(lang.code, 'lg')}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
                      {lang.nativeName}
                    </h3>
                    <span className="text-xs text-zinc-400 font-mono">
                      {lang.country} • {lang.code.toUpperCase()}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-zinc-400 leading-relaxed min-h-[48px]">
                  {getLanguageDescription(lang.code)}
                </p>
              </div>

              {/* Action Button */}
              <div className="pt-4 border-t border-zinc-800/80 mt-4">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLanguage(lang.code);
                  }}
                  className={`w-full py-2.5 px-3 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    isActive
                      ? 'bg-emerald-500 text-black shadow-md'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-white'
                  }`}
                >
                  {isActive ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>{t('lang_selected_msg')}</span>
                    </>
                  ) : (
                    <>
                      <div className="shrink-0">{getFlag(lang.code, 'sm')}</div>
                      <span>{t('lang_switch_btn')}</span>
                      <ArrowRight className="w-3 h-3" />
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Info Card */}
      <div className="p-5 rounded-2xl bg-[#0f0f15] border border-[#20202e] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0 text-zinc-300">
            <Sparkles className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white font-mono uppercase">
              Sincronização de Idioma Persistente
            </h4>
            <p className="text-xs text-zinc-400 mt-0.5">
              O idioma selecionado é gravado localmente no seu computador e será mantido mesmo ao fechar e reabrir o aplicativo. Você também pode alternar o idioma a qualquer momento clicando nas bandeiras no topo da janela.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex -space-x-1.5 p-1.5 rounded-lg bg-zinc-900 border border-zinc-800">
            <BrazilFlag size="sm" />
            <UsaFlag size="sm" />
            <SpainFlag size="sm" />
          </div>
          <span className="text-[11px] font-mono text-zinc-400">3 Países Suportados</span>
        </div>
      </div>
    </div>
  );
};
