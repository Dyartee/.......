import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  X,
  Cpu,
  Activity,
  Layers,
  HardDrive,
  ShieldCheck,
  Server,
  Terminal,
  Copy,
  Check,
  Sparkles,
  RefreshCw,
} from 'lucide-react';

export const EditHardwareModal: React.FC = () => {
  const {
    hardwareEditModalOpen,
    setHardwareEditModalOpen,
    device,
    updateHardwareSpecs,
    detectAndSetRealHardware,
    isHardwareDetecting,
    t,
    addToast,
  } = useApp();

  const [cpu, setCpu] = useState(device.cpu);
  const [gpu, setGpu] = useState(device.gpu);
  const [ram, setRam] = useState(device.ram);
  const [storage, setStorage] = useState(device.storage);
  const [motherboard, setMotherboard] = useState(device.motherboard);
  const [windows, setWindows] = useState(device.windows);
  const [copied, setCopied] = useState(false);

  if (!hardwareEditModalOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateHardwareSpecs({
      cpu,
      gpu,
      ram,
      storage,
      motherboard,
      windows,
    });
    setHardwareEditModalOpen(false);
  };

  const handleAutoDetect = async () => {
    await detectAndSetRealHardware(false);
    setCpu(device.cpu);
    setGpu(device.gpu);
    setRam(device.ram);
    setStorage(device.storage);
    setMotherboard(device.motherboard);
    setWindows(device.windows);
  };

  const psScript = `Get-CimInstance Win32_Processor | Select-Object Name, NumberOfCores, NumberOfLogicalProcessors; Get-CimInstance Win32_VideoController | Select-Object Name, DriverVersion; (Get-CimInstance Win32_PhysicalMemory | Measure-Object Capacity -Sum).Sum / 1GB`;

  const copyScript = () => {
    navigator.clipboard.writeText(psScript);
    setCopied(true);
    addToast('success', 'Script Copiado', 'Comando PowerShell copiado para a área de transferência.');
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#111118] border border-[#262638] rounded-2xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#20202e] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E00000]/10 border border-[#E00000]/30 flex items-center justify-center text-[#FF4444]">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white font-mono uppercase">
                {t('modal_edit_hardware_title')}
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                {t('modal_edit_hardware_desc')}
              </p>
            </div>
          </div>
          <button
            onClick={() => setHardwareEditModalOpen(false)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action bar to re-run auto detection */}
        <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-zinc-300">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Deseja recarregar o hardware real detectado automaticamente pelo sistema?</span>
          </div>
          <button
            type="button"
            onClick={handleAutoDetect}
            disabled={isHardwareDetecting}
            className="px-3 py-1.5 rounded-lg text-xs font-mono text-emerald-300 bg-emerald-950/40 border border-emerald-600/50 hover:bg-emerald-900/60 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isHardwareDetecting ? 'animate-spin' : ''}`} />
            <span>{isHardwareDetecting ? 'Detectando...' : 'Re-Detectar'}</span>
          </button>
        </div>

        {/* Form Fields */}
        <form onSubmit={handleSave} className="space-y-4">
          {/* CPU */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-semibold text-zinc-300 flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5 text-[#FF4444]" />
              <span>{t('comp_cpu_label')}</span>
            </label>
            <input
              type="text"
              value={cpu}
              onChange={(e) => setCpu(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0a0a0f] border border-[#222230] text-sm text-white font-mono focus:outline-none focus:border-[#E00000]"
              placeholder="Ex: Intel Core i7-13700K ou AMD Ryzen 7 7800X3D"
            />
          </div>

          {/* GPU */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-semibold text-zinc-300 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-rose-400" />
              <span>{t('comp_gpu_label')}</span>
            </label>
            <input
              type="text"
              value={gpu}
              onChange={(e) => setGpu(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0a0a0f] border border-[#222230] text-sm text-white font-mono focus:outline-none focus:border-rose-500"
              placeholder="Ex: NVIDIA GeForce RTX 4070 ou AMD Radeon RX 7800 XT"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* RAM */}
            <div className="space-y-1.5">
              <label className="text-xs font-mono font-semibold text-zinc-300 flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                <span>{t('comp_ram_label')}</span>
              </label>
              <input
                type="text"
                value={ram}
                onChange={(e) => setRam(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0a0a0f] border border-[#222230] text-sm text-white font-mono focus:outline-none focus:border-amber-500"
                placeholder="Ex: 32 GB DDR5 Dual-Channel (2x16GB)"
              />
            </div>

            {/* Storage */}
            <div className="space-y-1.5">
              <label className="text-xs font-mono font-semibold text-zinc-300 flex items-center gap-2">
                <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
                <span>{t('comp_storage_label')}</span>
              </label>
              <input
                type="text"
                value={storage}
                onChange={(e) => setStorage(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0a0a0f] border border-[#222230] text-sm text-white font-mono focus:outline-none focus:border-cyan-500"
                placeholder="Ex: 1TB NVMe SSD PCIe 4.0"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Motherboard */}
            <div className="space-y-1.5">
              <label className="text-xs font-mono font-semibold text-zinc-300 flex items-center gap-2">
                <Server className="w-3.5 h-3.5 text-indigo-400" />
                <span>{t('comp_motherboard_label')}</span>
              </label>
              <input
                type="text"
                value={motherboard}
                onChange={(e) => setMotherboard(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0a0a0f] border border-[#222230] text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
                placeholder="Ex: ASUS TUF Gaming B650-PLUS WIFI"
              />
            </div>

            {/* Windows */}
            <div className="space-y-1.5">
              <label className="text-xs font-mono font-semibold text-zinc-300 flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t('comp_os_label')}</span>
              </label>
              <input
                type="text"
                value={windows}
                onChange={(e) => setWindows(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0a0a0f] border border-[#222230] text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                placeholder="Ex: Windows 11 Pro 23H2"
              />
            </div>
          </div>

          {/* PowerShell Helper */}
          <div className="p-3 rounded-xl bg-[#0a0a0f] border border-zinc-800/80 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
              <span className="flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-zinc-400" />
                Comando PowerShell para ler specs nativas do Windows:
              </span>
              <button
                type="button"
                onClick={copyScript}
                className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 text-[11px] cursor-pointer"
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copiado!' : 'Copiar'}</span>
              </button>
            </div>
            <pre className="p-2 rounded bg-black/60 text-[11px] font-mono text-zinc-300 overflow-x-auto select-all">
              {psScript}
            </pre>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setHardwareEditModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-mono text-zinc-400 hover:text-white bg-zinc-800/60 hover:bg-zinc-800 transition-colors"
            >
              {t('btn_cancel')}
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-mono font-bold uppercase text-white bg-[#E00000] hover:bg-[#c40000] shadow-[0_0_15px_rgba(224,0,0,0.4)] transition-all cursor-pointer"
            >
              {t('btn_save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
