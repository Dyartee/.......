import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  ShieldCheck,
  ShieldAlert,
  RotateCcw,
  Trash2,
  CheckCircle2,
  X,
  AlertTriangle,
  Lock,
  Cpu,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

export const SafetyLockModal: React.FC = () => {
  const {
    safetyLockActive,
    toggleSafetyLock,
    isRestoringDefaults,
    restoreWindowsFactoryDefaults,
    safetyModalOpen,
    setSafetyModalOpen,
    activeToolsState,
  } = useApp();

  const [confirmRestoreOpen, setConfirmRestoreOpen] = useState(false);
  const activeCount = Object.values(activeToolsState).filter(Boolean).length;

  if (!safetyModalOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isRestoringDefaults) {
          setSafetyModalOpen(false);
        }
      }}
    >
      <div className="relative w-full max-w-2xl bg-[#0f0f15] border border-[#232333] rounded-2xl shadow-2xl overflow-hidden text-zinc-200 font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#14141c] border-b border-[#232333]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-950/80 border border-emerald-600/50 flex items-center justify-center text-emerald-400 shadow-sm">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wide">
                  CHAVE DE SEGURANÇA WINDOWS
                </h2>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                    safetyLockActive
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-zinc-700/30 text-zinc-400 border-zinc-600/40'
                  }`}
                >
                  {safetyLockActive ? 'ATIVA & PROTEGIDA' : 'DESATIVADA'}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Restauração automática para o padrão de fábrica da Microsoft.
              </p>
            </div>
          </div>

          <button
            onClick={() => setSafetyModalOpen(false)}
            disabled={isRestoringDefaults}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6">
          {/* Main feature highlight */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-[#121815] to-[#121218] border border-emerald-900/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-emerald-400 uppercase">
                <Lock className="w-4 h-4" />
                <span>Garantia de Integridade do Sistema</span>
              </div>
              <button
                onClick={toggleSafetyLock}
                disabled={isRestoringDefaults}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  safetyLockActive ? 'bg-emerald-600' : 'bg-zinc-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    safetyLockActive ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              A <strong>Chave de Segurança</strong> assegura que qualquer intervenção feita pelo
              DYARTE Optimizer (serviços de diagnóstico, timers NT de 0.5ms, esquemas de energia,
              parâmetros de registro e drivers) seja{' '}
              <strong className="text-white">revertida 100% para o padrão de fábrica do Windows</strong>{' '}
              nas seguintes situações:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px] font-mono">
              <div className="p-2.5 rounded-lg bg-[#0e0e14] border border-[#20202e] flex items-start gap-2">
                <Trash2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-white font-bold block">Ao Desinstalar o App:</span>
                  <span className="text-zinc-400">
                    O desinstalador executa o hook de limpeza profunda e restaura o Windows stock.
                  </span>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-[#0e0e14] border border-[#20202e] flex items-start gap-2">
                <RotateCcw className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-white font-bold block">Ao Expirar a Assinatura:</span>
                  <span className="text-zinc-400">
                    Ao término da vigência do plano, os valores retornam ao padrão de segurança.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Current system status */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#13131c] border border-[#232333] text-xs">
            <div className="flex items-center gap-2.5">
              <Cpu className="w-4 h-4 text-zinc-400" />
              <div>
                <span className="text-white font-mono font-bold block">
                  Status de Otimizações Aplicadas no PC
                </span>
                <span className="text-[11px] text-zinc-400">
                  {activeCount > 0
                    ? `${activeCount} módulos ativos no registro e serviços do Windows`
                    : 'Sistema já se encontra no padrão original ou sem módulos ativos'}
                </span>
              </div>
            </div>
            <span
              className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold ${
                activeCount > 0
                  ? 'bg-red-500/20 text-[#FF4444] border border-red-500/30'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              }`}
            >
              {activeCount > 0 ? `${activeCount} ATIVOS` : 'ORIGINAL'}
            </span>
          </div>

          {/* Action buttons */}
          <div className="space-y-2.5 pt-1">
            <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
              Ações Imediatas de Restauração:
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={async () => {
                  await restoreWindowsFactoryDefaults('Restauração manual imediata');
                }}
                disabled={isRestoringDefaults}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-mono text-xs font-bold transition-all border border-zinc-700 cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className={`w-4 h-4 ${isRestoringDefaults ? 'animate-spin' : ''}`} />
                <span>
                  {isRestoringDefaults
                    ? 'Restaurando Padrão Windows...'
                    : 'Restaurar Padrão de Fábrica Agora'}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="px-6 py-3.5 bg-[#12121a] border-t border-[#232333] flex items-center justify-between text-[11px] text-zinc-400 font-mono">
          <span>Padrão Microsoft: DiagTrack, SysMain, Balanced Power, Timer 15.6ms</span>
          <button
            onClick={() => setSafetyModalOpen(false)}
            className="text-zinc-300 hover:text-white underline cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
