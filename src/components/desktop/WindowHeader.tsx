import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  Flame,
  Minus,
  Square,
  X,
  Radio,
  RefreshCw,
  Globe,
  User as UserIcon,
  Crown,
} from 'lucide-react';
import { LanguageSwitcher } from './LanguageSwitcher';
import { DyarteLogo } from '../common/DyarteLogo';

export const WindowHeader: React.FC = () => {
  const {
    currentUser,
    device,
    toggleAgentConnection,
    refreshHardwareTelemetry,
    switchUserRole,
    syncWithWebsite,
    isSyncingWithWeb,
    t,
  } = useApp();

  const handleMinimize = () => {
    // Desktop window simulation feedback
  };

  const handleClose = () => {
    // Desktop window simulation feedback
  };

  return (
    <header className="h-10 bg-[#08080a] border-b border-[#1c1c24] flex items-center justify-between px-3 select-none z-30 shrink-0">
      {/* Left: Brand & App Title */}
      <div className="flex items-center gap-2.5">
        <DyarteLogo size="sm" showText={false} />
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-bold tracking-wider text-white uppercase font-mono">
            DYARTE OPTIMIZER
          </span>
          <span className="text-[10px] text-zinc-500 font-mono hidden md:inline-block">
            v2.4.0 Pro • Windows 11 Build
          </span>
        </div>
      </div>

      {/* Center: Windows Agent Live Status */}
      <div className="hidden lg:flex items-center gap-3">
        <button
          onClick={toggleAgentConnection}
          className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono border transition-all cursor-pointer ${
            device.is_agent_connected
              ? 'bg-emerald-950/40 border-emerald-600/50 text-emerald-300 hover:bg-emerald-950/60'
              : 'bg-red-950/40 border-[#E00000]/50 text-[#FF4444] hover:bg-red-950/60'
          }`}
          title="Clique para alternar conexão com o DYARTE Windows Agent"
        >
          <span
            className={`w-2 h-2 rounded-full ${
              device.is_agent_connected
                ? 'bg-emerald-400 animate-pulse shadow-[0_0_6px_#10b981]'
                : 'bg-[#E00000]'
            }`}
          />
          <Radio className="w-3 h-3" />
          <span>
            {device.is_agent_connected
              ? 'Windows Agent: Conectado'
              : 'Windows Agent: Desconectado'}
          </span>
        </button>

        <button
          onClick={refreshHardwareTelemetry}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono text-zinc-400 hover:text-white hover:bg-zinc-800/60 border border-transparent hover:border-zinc-700 transition-all cursor-pointer"
          title="Atualizar sensores de hardware em tempo real"
        >
          <RefreshCw className="w-2.5 h-2.5" />
          <span>Sincronizar PC</span>
        </button>

        <button
          onClick={() => syncWithWebsite()}
          disabled={isSyncingWithWeb}
          className="flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono text-emerald-300 bg-emerald-950/30 border border-emerald-600/40 hover:bg-emerald-950/50 transition-all cursor-pointer"
          title="Sincronizar plano com a conta web no site dyarte.com"
        >
          <Globe className={`w-3 h-3 text-emerald-400 ${isSyncingWithWeb ? 'animate-spin' : ''}`} />
          <span>{isSyncingWithWeb ? 'Sincronizando...' : 'Web Sync'}</span>
        </button>
      </div>

      {/* Right: Language Switcher, Quick Role Switcher & Windows Chrome Controls */}
      <div className="flex items-center gap-2">
        {/* Language Dropdown in Header */}
        <LanguageSwitcher className="hidden sm:flex" />

        {currentUser && (
          <div className="flex items-center gap-1.5 mr-2">
            <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-mono hidden sm:inline-block">
              Simulador:
            </span>
            <button
              onClick={() => switchUserRole(currentUser.role === 'ADMIN' ? 'USER' : 'ADMIN')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono border transition-all cursor-pointer ${
                currentUser.role === 'ADMIN'
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 hover:bg-amber-500/20'
                  : 'bg-[#181820] border-[#2c2c38] text-zinc-300 hover:text-white hover:border-[#E00000]/60'
              }`}
              title="Alternar entre perfil de Usuário e perfil de Administrador"
            >
              {currentUser.role === 'ADMIN' ? (
                <>
                  <Crown className="w-3 h-3 text-amber-400" />
                  <span>Modo ADMIN</span>
                </>
              ) : (
                <>
                  <UserIcon className="w-3 h-3 text-[#E00000]" />
                  <span>Modo USUÁRIO</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Windows Standard Title Bar Buttons */}
        <div className="flex items-center -mr-1">
          <button
            onClick={handleMinimize}
            className="w-8 h-7 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition-colors"
            title="Minimizar"
            aria-label="Minimizar janela"
          >
            <Minus className="w-3 h-3" />
          </button>
          <button
            onClick={handleMinimize}
            className="w-8 h-7 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition-colors"
            title="Maximizar"
            aria-label="Maximizar janela"
          >
            <Square className="w-2.5 h-2.5" />
          </button>
          <button
            onClick={handleClose}
            className="w-9 h-7 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-[#E00000] transition-colors"
            title="Fechar"
            aria-label="Fechar janela"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
