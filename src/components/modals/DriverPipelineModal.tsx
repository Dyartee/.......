import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  Download,
  HardDrive,
  CheckCircle2,
  X,
  Play,
  FileArchive,
  ExternalLink,
  ShieldCheck,
  Cpu,
  Layers,
  Terminal,
} from 'lucide-react';

export const DriverPipelineModal: React.FC = () => {
  const { driverPipeline, closeDriverPipeline, config } = useApp();

  if (!driverPipeline || !driverPipeline.isOpen) {
    return null;
  }

  const {
    brand,
    phase,
    progress,
    downloadedMb,
    totalMb,
    speed,
    actionText,
    logs,
    installerFileName,
  } = driverPipeline;

  const isAmd = brand === 'AMD';
  const brandColor = isAmd ? 'red' : 'emerald';
  const driveUrl = isAmd ? config.amd_driver_drive_url : config.nvidia_driver_drive_url;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-2xl rounded-2xl bg-[#0e0e14] border border-[#262638] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div
          className={`p-5 border-b flex items-center justify-between ${
            isAmd
              ? 'bg-gradient-to-r from-[#1f0b0b] via-[#140a0a] to-[#121018] border-red-900/50'
              : 'bg-gradient-to-r from-[#0b1f13] via-[#0a140f] to-[#101813] border-emerald-900/50'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center font-mono font-black text-sm border shadow-md ${
                isAmd
                  ? 'bg-red-950/80 text-red-400 border-red-700/60'
                  : 'bg-emerald-950/80 text-emerald-400 border-emerald-700/60'
              }`}
            >
              {isAmd ? 'AMD' : 'NV'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wide">
                  {isAmd ? 'AMD DRIVER OPTIMIZED' : 'NVIDIA DRIVER OPTIMIZED'}
                </h3>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                    isAmd
                      ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {isAmd ? 'Radeon Adrenalin' : 'GeForce Debloated'}
                </span>
              </div>
              <span className="text-xs text-zinc-400 font-mono">
                Pipeline Automatizado: Download • Extração • Execução
              </span>
            </div>
          </div>

          {phase === 'completed' && (
            <button
              onClick={closeDriverPipeline}
              className="text-zinc-400 hover:text-white p-1.5 rounded-lg hover:bg-zinc-800/60 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Phase Stepper */}
          <div className="grid grid-cols-3 gap-3">
            {/* Step 1: Download */}
            <div
              className={`p-3 rounded-xl border flex flex-col gap-1.5 transition-all ${
                phase === 'downloading'
                  ? isAmd
                    ? 'bg-red-950/30 border-red-600/70 text-white'
                    : 'bg-emerald-950/30 border-emerald-600/70 text-white'
                  : phase === 'extracting' || phase === 'executing' || phase === 'completed'
                  ? 'bg-zinc-900/60 border-zinc-700 text-zinc-300'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-600'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-mono font-bold">
                <span className="flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5" />
                  1. BAIXANDO
                </span>
                {phase !== 'downloading' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <div
                    className={`w-3.5 h-3.5 border-2 border-t-transparent rounded-full animate-spin ${
                      isAmd ? 'border-red-400' : 'border-emerald-400'
                    }`}
                  />
                )}
              </div>
              <span className="text-[10px] text-zinc-400 font-mono truncate">
                {totalMb} MB • {speed}
              </span>
            </div>

            {/* Step 2: Extraction */}
            <div
              className={`p-3 rounded-xl border flex flex-col gap-1.5 transition-all ${
                phase === 'extracting'
                  ? isAmd
                    ? 'bg-red-950/30 border-red-600/70 text-white'
                    : 'bg-emerald-950/30 border-emerald-600/70 text-white'
                  : phase === 'executing' || phase === 'completed'
                  ? 'bg-zinc-900/60 border-zinc-700 text-zinc-300'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-600'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-mono font-bold">
                <span className="flex items-center gap-1.5">
                  <FileArchive className="w-3.5 h-3.5" />
                  2. EXTRAINDO
                </span>
                {phase === 'executing' || phase === 'completed' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : phase === 'extracting' ? (
                  <div
                    className={`w-3.5 h-3.5 border-2 border-t-transparent rounded-full animate-spin ${
                      isAmd ? 'border-red-400' : 'border-emerald-400'
                    }`}
                  />
                ) : (
                  <span className="text-[10px] text-zinc-600">Espera</span>
                )}
              </div>
              <span className="text-[10px] text-zinc-400 font-mono truncate">
                Limpeza & Registros
              </span>
            </div>

            {/* Step 3: Execution */}
            <div
              className={`p-3 rounded-xl border flex flex-col gap-1.5 transition-all ${
                phase === 'executing'
                  ? isAmd
                    ? 'bg-red-950/30 border-red-600/70 text-white'
                    : 'bg-emerald-950/30 border-emerald-600/70 text-white'
                  : phase === 'completed'
                  ? 'bg-emerald-950/30 border-emerald-600 text-white'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-600'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-mono font-bold">
                <span className="flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5" />
                  3. EXECUTANDO
                </span>
                {phase === 'completed' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : phase === 'executing' ? (
                  <div
                    className={`w-3.5 h-3.5 border-2 border-t-transparent rounded-full animate-spin ${
                      isAmd ? 'border-red-400' : 'border-emerald-400'
                    }`}
                  />
                ) : (
                  <span className="text-[10px] text-zinc-600">Espera</span>
                )}
              </div>
              <span className="text-[10px] text-zinc-400 font-mono truncate">
                Instalação no Windows
              </span>
            </div>
          </div>

          {/* Progress Bar & Current Status */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-zinc-300 font-semibold">{actionText}</span>
              <span
                className={`font-bold ${
                  isAmd ? 'text-red-400' : 'text-emerald-400'
                }`}
              >
                {progress}%
              </span>
            </div>

            <div className="h-3 w-full rounded-full bg-zinc-900 border border-zinc-800 overflow-hidden p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-300 shadow-lg ${
                  isAmd
                    ? 'bg-gradient-to-r from-red-600 to-rose-500 shadow-red-900/50'
                    : 'bg-gradient-to-r from-emerald-600 to-green-500 shadow-emerald-900/50'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 pt-1">
              <span>Pacote: {installerFileName}</span>
              <span>
                {phase === 'downloading'
                  ? `${downloadedMb} MB / ${totalMb} MB (${speed})`
                  : `${totalMb} MB verificado`}
              </span>
            </div>
          </div>

          {/* Real-time Execution Logs Terminal */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
              <Terminal className="w-3.5 h-3.5" />
              <span>Console de Execução do Instalador:</span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#08080c] border border-zinc-800 font-mono text-xs text-zinc-300 space-y-1 max-h-40 overflow-y-auto shadow-inner">
              {logs.map((log, index) => (
                <div
                  key={index}
                  className="flex items-start gap-2 leading-relaxed"
                >
                  <span className="text-zinc-600 select-none">&gt;</span>
                  <span
                    className={
                      log.includes('[CONCLUÍDO]') || log.includes('[OK]')
                        ? 'text-emerald-400 font-bold'
                        : log.includes('[INÍCIO]')
                        ? 'text-white font-bold'
                        : log.includes('[OTIMIZAÇÃO]')
                        ? isAmd
                          ? 'text-red-400'
                          : 'text-emerald-400'
                        : 'text-zinc-300'
                    }
                  >
                    {log}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Success Banner when Completed */}
          {phase === 'completed' && (
            <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-700/60 flex items-start gap-3 animate-fade-in">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs font-mono">
                <div className="text-white font-bold">
                  Driver {brand} Baixado, Extraído e Executado com Sucesso!
                </div>
                <p className="text-zinc-300 leading-relaxed">
                  O script executável de inicialização automatizada foi enviado para o seu
                  computador e as chaves de performance do registro foram configuradas.
                </p>
                {driveUrl && (
                  <div className="pt-1 flex items-center gap-2">
                    <span className="text-zinc-400 text-[11px]">Repositório Nuvem:</span>
                    <a
                      href={driveUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-400 hover:underline inline-flex items-center gap-1 text-[11px]"
                    >
                      <span>Abrir pasta no Google Drive</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 bg-[#0c0c12] flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
            <HardDrive className="w-3.5 h-3.5" />
            <span>Destino: C:\DYARTE\Drivers\{brand}\</span>
          </div>

          <div className="flex items-center gap-2">
            {phase === 'completed' ? (
              <button
                onClick={closeDriverPipeline}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-emerald-900/40"
              >
                Concluir
              </button>
            ) : (
              <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                <div
                  className={`w-3.5 h-3.5 border-2 border-t-transparent rounded-full animate-spin ${
                    isAmd ? 'border-red-400' : 'border-emerald-400'
                  }`}
                />
                <span>Processando driver no Windows...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
