import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Settings,
  Link,
  Radio,
  Save,
  Key,
  MessageSquare,
  Mail,
  Shield,
  RefreshCw,
  Server,
  FileCode,
  Globe,
  Check,
} from 'lucide-react';
import { BrazilFlag, UsaFlag, SpainFlag } from '../../i18n/FlagIcons';
import { LanguageCode, SUPPORTED_LANGUAGES } from '../../i18n/translations';

export const SettingsView: React.FC = () => {
  const { config, adminUpdateConfig, addToast, currentLanguage, setLanguage, t } = useApp();

  const [formData, setFormData] = useState({
    basic_checkout_url: config.basic_checkout_url,
    medium_checkout_url: config.medium_checkout_url,
    advanced_checkout_url: config.advanced_checkout_url,
    complete_checkout_url: config.complete_checkout_url,
    support_email: config.support_email,
    discord_url: config.discord_url,
    agent_download_url: config.agent_download_url,
    require_agent_connection: config.require_agent_connection,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    adminUpdateConfig(formData);
  };

  const getFlag = (code: LanguageCode) => {
    switch (code) {
      case 'pt':
        return <BrazilFlag size="md" />;
      case 'en':
        return <UsaFlag size="md" />;
      case 'es':
        return <SpainFlag size="md" />;
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white font-mono uppercase">
          Configurações do Software
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Centralize as URLs de checkout dos 4 planos, parâmetros do Windows Agent e endpoints de webhook.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 0: Language & Region Selection with miniature flags */}
        <div className="p-6 rounded-2xl bg-[#121218] border border-[#232332] space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[#20202d]">
            <Globe className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white font-mono uppercase">
              {t('lang_view_title')} (Language)
            </h3>
          </div>
          <p className="text-xs text-zinc-400">
            {t('lang_view_subtitle')}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {SUPPORTED_LANGUAGES.map((lang) => {
              const isActive = currentLanguage === lang.code;
              return (
                <div
                  key={lang.code}
                  onClick={() => setLanguage(lang.code)}
                  className={`p-4 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                    isActive
                      ? 'bg-emerald-950/20 border-emerald-500 shadow-sm'
                      : 'bg-[#09090d] border-[#222230] hover:border-zinc-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="shrink-0">{getFlag(lang.code)}</div>
                    <div>
                      <p className="text-xs font-bold text-white font-mono">{lang.nativeName}</p>
                      <p className="text-[10px] text-zinc-400 font-mono">{lang.country}</p>
                    </div>
                  </div>
                  {isActive && <Check className="w-4 h-4 text-emerald-400" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 1: External Checkout URLs */}
        <div className="p-6 rounded-2xl bg-[#121218] border border-[#232332] space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[#20202d]">
            <Link className="w-4 h-4 text-[#FF3333]" />
            <h3 className="text-sm font-bold text-white font-mono uppercase">
              URLs de Checkout dos Planos (Site Externo)
            </h3>
          </div>
          <p className="text-xs text-zinc-400">
            Conforme a arquitetura definida, o checkout é realizado no site externo. O software
            redireciona o usuário para estes links quando ele seleciona um plano.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-mono text-zinc-400 uppercase block mb-1">
                Plano Básico URL (R$ 20,00):
              </label>
              <input
                type="url"
                value={formData.basic_checkout_url}
                onChange={(e) => setFormData({ ...formData, basic_checkout_url: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-[#09090d] border border-[#262635] text-xs font-mono text-white focus:outline-none focus:border-[#E00000]"
              />
            </div>

            <div>
              <label className="text-[11px] font-mono text-zinc-400 uppercase block mb-1">
                Plano Médio URL (R$ 30,00):
              </label>
              <input
                type="url"
                value={formData.medium_checkout_url}
                onChange={(e) => setFormData({ ...formData, medium_checkout_url: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-[#09090d] border border-[#262635] text-xs font-mono text-white focus:outline-none focus:border-[#E00000]"
              />
            </div>

            <div>
              <label className="text-[11px] font-mono text-zinc-400 uppercase block mb-1">
                Plano Avançado URL (R$ 45,00):
              </label>
              <input
                type="url"
                value={formData.advanced_checkout_url}
                onChange={(e) =>
                  setFormData({ ...formData, advanced_checkout_url: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg bg-[#09090d] border border-[#262635] text-xs font-mono text-white focus:outline-none focus:border-[#E00000]"
              />
            </div>

            <div>
              <label className="text-[11px] font-mono text-zinc-400 uppercase block mb-1">
                Plano Completo URL (R$ 60,00):
              </label>
              <input
                type="url"
                value={formData.complete_checkout_url}
                onChange={(e) =>
                  setFormData({ ...formData, complete_checkout_url: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg bg-[#09090d] border border-[#262635] text-xs font-mono text-white focus:outline-none focus:border-[#E00000]"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Windows Agent Settings */}
        <div className="p-6 rounded-2xl bg-[#121218] border border-[#232332] space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[#20202d]">
            <Radio className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white font-mono uppercase">
              Configurações do DYARTE Windows Agent
            </h3>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#09090d] border border-[#1f1f2a]">
              <div>
                <p className="text-xs font-bold text-white font-mono">
                  Exigir Conexão Ativa do Agente para Execução
                </p>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Impede que otimizações sejam disparadas se o daemon local não responder ao handshake.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.require_agent_connection}
                  onChange={(e) =>
                    setFormData({ ...formData, require_agent_connection: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#E00000]"></div>
              </label>
            </div>

            <div>
              <label className="text-[11px] font-mono text-zinc-400 uppercase block mb-1">
                URL para Download do Binário Windows Agent (.exe):
              </label>
              <input
                type="url"
                value={formData.agent_download_url}
                onChange={(e) => setFormData({ ...formData, agent_download_url: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-[#09090d] border border-[#262635] text-xs font-mono text-white focus:outline-none focus:border-[#E00000]"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Webhook & Support */}
        <div className="p-6 rounded-2xl bg-[#121218] border border-[#232332] space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[#20202d]">
            <Server className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-bold text-white font-mono uppercase">
              Canais de Suporte & Webhook Secret
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-mono text-zinc-400 uppercase block mb-1">
                E-mail de Suporte Oficial:
              </label>
              <input
                type="email"
                value={formData.support_email}
                onChange={(e) => setFormData({ ...formData, support_email: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-[#09090d] border border-[#262635] text-xs font-mono text-white focus:outline-none focus:border-[#E00000]"
              />
            </div>

            <div>
              <label className="text-[11px] font-mono text-zinc-400 uppercase block mb-1">
                Comunidade Discord Oficial:
              </label>
              <input
                type="text"
                value={formData.discord_url}
                onChange={(e) => setFormData({ ...formData, discord_url: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-[#09090d] border border-[#262635] text-xs font-mono text-white focus:outline-none focus:border-[#E00000]"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-[11px] font-mono text-zinc-400 uppercase block mb-1">
                Webhook Secret (Validação de Assinatura HMAC):
              </label>
              <input
                type="text"
                readOnly
                value={config.webhook_secret}
                className="w-full px-3 py-2 rounded-lg bg-[#09090d]/60 border border-[#262635] text-xs font-mono text-zinc-400 cursor-not-allowed"
              />
              <span className="text-[10px] text-zinc-500 font-mono mt-1 block">
                Utilizado pelo gateway externo (Stripe, Mercado Pago, etc.) para assinar payloads no header <code className="text-zinc-400 font-mono">x-dyarte-signature</code>.
              </span>
            </div>
          </div>
        </div>

        {/* Save button */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-[#E00000] hover:bg-[#c50000] text-white text-xs font-mono font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-lg"
          >
            <Save className="w-4 h-4" />
            <span>Salvar Todas as Configurações</span>
          </button>
        </div>
      </form>
    </div>
  );
};
