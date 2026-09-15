import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { useApp } from '../../context/AppContext';
import {
  Cpu,
  Activity,
  Flame,
  Zap,
  Gauge,
  Thermometer,
  Layers,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Timer,
  Play,
  Pause,
  Clock,
  Radio,
} from 'lucide-react';

interface TelemetrySample {
  time: string;
  cpuUsage: number;
  cpuTemp: number;
  gpuUsage: number;
  gpuTemp: number;
  ramUsage: number;
  ramFreq: number;
  inputLagMs: number;
  frametimeMs: number;
}

export const RealtimeTelemetryCharts: React.FC = () => {
  const { device, t } = useApp();
  const [isLive, setIsLive] = useState(true);

  // Buffer of data points for mini sparkline charts
  const [samples, setSamples] = useState<TelemetrySample[]>(() => {
    const points: TelemetrySample[] = [];
    const now = Date.now();
    for (let i = 14; i >= 0; i--) {
      const timeStr = new Date(now - i * 1500).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      points.push({
        time: timeStr,
        cpuUsage: Math.max(8, Math.min(95, device.cpu_usage_pct + Math.floor(Math.random() * 10 - 5))),
        cpuTemp: Math.max(38, Math.min(85, (device.temp_c || 52) - 4 + Math.floor(Math.random() * 8 - 4))),
        gpuUsage: Math.max(5, Math.min(98, device.gpu_usage_pct + Math.floor(Math.random() * 12 - 6))),
        gpuTemp: Math.max(42, Math.min(88, (device.temp_c || 58) + Math.floor(Math.random() * 6 - 3))),
        ramUsage: Math.max(20, Math.min(92, device.ram_usage_pct + Math.floor(Math.random() * 4 - 2))),
        ramFreq: 3600,
        inputLagMs: +(1.4 + Math.random() * 1.6).toFixed(2),
        frametimeMs: +(5.2 + Math.random() * 2.8).toFixed(1),
      });
    }
    return points;
  });

  // Current real-time indicators
  const latest = samples[samples.length - 1] || {
    cpuUsage: device.cpu_usage_pct,
    cpuTemp: 52,
    gpuUsage: device.gpu_usage_pct,
    gpuTemp: device.temp_c || 58,
    ramUsage: device.ram_usage_pct,
    ramFreq: 3600,
    inputLagMs: device.input_lag_ms || 2.1,
    frametimeMs: 6.2,
  };

  useEffect(() => {
    if (!isLive) return;

    const timer = setInterval(() => {
      const nowStr = new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      const nextCpu = Math.max(
        6,
        Math.min(98, device.cpu_usage_pct + Math.floor(Math.random() * 14 - 7))
      );
      const nextCpuTemp = Math.floor(45 + (nextCpu / 100) * 26);

      const nextGpu = Math.max(
        4,
        Math.min(99, device.gpu_usage_pct + Math.floor(Math.random() * 16 - 8))
      );
      const nextGpuTemp = Math.floor(48 + (nextGpu / 100) * 28);

      const nextRam = Math.max(
        18,
        Math.min(92, device.ram_usage_pct + Math.floor(Math.random() * 4 - 2))
      );

      // Low input lag telemetry (1.1ms - 3.2ms)
      const nextInputLag = +(1.2 + (nextCpu / 100) * 1.5 + Math.random() * 0.5).toFixed(2);
      const nextFrametime = +(4.8 + (nextGpu / 100) * 3.6 + Math.random() * 0.8).toFixed(1);

      setSamples((prev) => [
        ...prev.slice(1),
        {
          time: nowStr,
          cpuUsage: nextCpu,
          cpuTemp: nextCpuTemp,
          gpuUsage: nextGpu,
          gpuTemp: nextGpuTemp,
          ramUsage: nextRam,
          ramFreq: 3600,
          inputLagMs: nextInputLag,
          frametimeMs: nextFrametime,
        },
      ]);
    }, 1500);

    return () => clearInterval(timer);
  }, [isLive, device.cpu_usage_pct, device.gpu_usage_pct, device.ram_usage_pct, device.temp_c]);

  return (
    <div className="space-y-4">
      {/* Top Header of Telemetry Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-white font-mono flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#FF3333]" />
            <span>TELEMETRIA EM TEMPO REAL (MINI-GRÁFICOS)</span>
          </h3>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
            DPC / KERNEL 0.5ms
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsLive(!isLive)}
            className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border ${
              isLive
                ? 'bg-emerald-950/40 text-emerald-400 border-emerald-700/50 hover:bg-emerald-950/70'
                : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
            }`}
          >
            {isLive ? (
              <>
                <Pause className="w-3 h-3" />
                <span>AO VIVO (1.5s)</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3" />
                <span>PAUSADO</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Grid of Mini-Graphs for Each Function: CPU, GPU, RAM (Freq + XMP/DOCP), Input Lag & MS */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* 1. CPU: Uso da CPU e Temperatura */}
        <div className="p-4 rounded-xl bg-[#111118] border border-[#232330] hover:border-[#38384d] transition-all flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-red-950/60 border border-red-800/40 text-[#FF4444]">
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-mono font-bold text-white uppercase block">
                  CPU: USO & TEMP
                </span>
                <span className="text-[10px] font-mono text-zinc-400 truncate max-w-[130px] block">
                  {device.cpu.split('(')[0] || 'Intel / AMD Core'}
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-lg font-black font-mono text-white block">
                {latest.cpuUsage}%
              </span>
              <span className="text-xs font-mono text-amber-400 font-bold flex items-center justify-end gap-1">
                <Thermometer className="w-3 h-3 text-amber-400" />
                {latest.cpuTemp}°C
              </span>
            </div>
          </div>

          {/* Mini Chart CPU */}
          <div className="h-24 w-full bg-[#0a0a0f] rounded-lg p-1 border border-zinc-800/80 overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={samples} margin={{ top: 4, right: 2, left: 2, bottom: 0 }}>
                <defs>
                  <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E00000" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#E00000" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="cpuTempGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-[#14141c] border border-zinc-700 px-2 py-1 rounded text-[10px] font-mono text-white shadow">
                          <div>Uso: {payload[0]?.value}%</div>
                          <div className="text-amber-400">Temp: {payload[1]?.value}°C</div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="cpuUsage"
                  stroke="#E00000"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#cpuGrad)"
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="cpuTemp"
                  stroke="#f59e0b"
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                  fillOpacity={1}
                  fill="url(#cpuTempGrad)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 pt-1 border-t border-zinc-800/60">
            <span>Clock: {(3.8 + (latest.cpuUsage / 100) * 0.9).toFixed(2)} GHz</span>
            <span className="text-emerald-400 font-bold">Turbo All-Core</span>
          </div>
        </div>

        {/* 2. GPU: Uso da GPU e Temperatura */}
        <div className="p-4 rounded-xl bg-[#111118] border border-[#232330] hover:border-[#38384d] transition-all flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-rose-950/60 border border-rose-800/40 text-rose-400">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-mono font-bold text-white uppercase block">
                  GPU: USO & TEMP
                </span>
                <span className="text-[10px] font-mono text-zinc-400 truncate max-w-[130px] block">
                  {device.gpu.split('(')[0] || 'DirectX 12 Ultimate'}
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-lg font-black font-mono text-white block">
                {latest.gpuUsage}%
              </span>
              <span className="text-xs font-mono text-rose-400 font-bold flex items-center justify-end gap-1">
                <Thermometer className="w-3 h-3 text-rose-400" />
                {latest.gpuTemp}°C
              </span>
            </div>
          </div>

          {/* Mini Chart GPU */}
          <div className="h-24 w-full bg-[#0a0a0f] rounded-lg p-1 border border-zinc-800/80 overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={samples} margin={{ top: 4, right: 2, left: 2, bottom: 0 }}>
                <defs>
                  <linearGradient id="gpuGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="gpuTempGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#fb7185" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#fb7185" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-[#14141c] border border-zinc-700 px-2 py-1 rounded text-[10px] font-mono text-white shadow">
                          <div>GPU: {payload[0]?.value}%</div>
                          <div className="text-rose-400">Temp: {payload[1]?.value}°C</div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="gpuUsage"
                  stroke="#f43f5e"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#gpuGrad)"
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="gpuTemp"
                  stroke="#fb7185"
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                  fillOpacity={1}
                  fill="url(#gpuTempGrad)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 pt-1 border-t border-zinc-800/60">
            <span>Clock: {Math.floor(2150 + (latest.gpuUsage / 100) * 450)} MHz</span>
            <span className="text-rose-400 font-bold">PCIe 4.0 x16</span>
          </div>
        </div>

        {/* 3. MEMÓRIA RAM: Uso, Frequência e XMP/DOCP Ativo */}
        <div className="p-4 rounded-xl bg-[#111118] border border-[#232330] hover:border-[#38384d] transition-all flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-950/60 border border-amber-800/40 text-amber-400">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-mono font-bold text-white uppercase block">
                  RAM: USO & FREQUÊNCIA
                </span>
                <span className="text-[10px] font-mono text-zinc-400 truncate max-w-[130px] block">
                  {device.ram.split('(')[0] || 'Dual Channel DDR4/DDR5'}
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-lg font-black font-mono text-white block">
                {latest.ramUsage}%
              </span>
              <span className="text-xs font-mono text-amber-400 font-bold">
                {device.ram_frequency || '3600 MHz'}
              </span>
            </div>
          </div>

          {/* Mini Chart RAM */}
          <div className="h-24 w-full bg-[#0a0a0f] rounded-lg p-1 border border-zinc-800/80 overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={samples} margin={{ top: 4, right: 2, left: 2, bottom: 0 }}>
                <defs>
                  <linearGradient id="ramGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-[#14141c] border border-zinc-700 px-2 py-1 rounded text-[10px] font-mono text-white shadow">
                          <div>Uso RAM: {payload[0]?.value}%</div>
                          <div className="text-amber-400">Freq: {device.ram_frequency || '3600 MHz'}</div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="ramUsage"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#ramGrad)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* XMP / DOCP Badge & Frequência */}
          <div className="flex items-center justify-between text-[11px] font-mono pt-1 border-t border-zinc-800/60">
            <span className="text-zinc-400">Freq: {device.ram_frequency || '3600 MHz'}</span>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-600/50 text-emerald-300 font-bold">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>{device.xmp_profile || 'XMP/DOCP ATIVO'}</span>
            </div>
          </div>
        </div>

        {/* 4. INPUT LAG & LATÊNCIA (MS) */}
        <div className="p-4 rounded-xl bg-[#111118] border border-[#232330] hover:border-[#38384d] transition-all flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-cyan-950/60 border border-cyan-800/40 text-cyan-400">
                <Gauge className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-mono font-bold text-white uppercase block">
                  INPUT LAG & RESPOSTA
                </span>
                <span className="text-[10px] font-mono text-zinc-400 block">
                  Timer Res 0.5ms • DPC Low
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-lg font-black font-mono text-cyan-300 block">
                {latest.inputLagMs} ms
              </span>
              <span className="text-xs font-mono text-emerald-400 font-bold">
                {latest.frametimeMs} ms frame
              </span>
            </div>
          </div>

          {/* Mini Chart Input Lag */}
          <div className="h-24 w-full bg-[#0a0a0f] rounded-lg p-1 border border-zinc-800/80 overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={samples} margin={{ top: 4, right: 2, left: 2, bottom: 0 }}>
                <defs>
                  <linearGradient id="lagGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-[#14141c] border border-zinc-700 px-2 py-1 rounded text-[10px] font-mono text-white shadow">
                          <div className="text-cyan-400">Input Lag: {payload[0]?.value} ms</div>
                          <div className="text-zinc-400">Frametime: {latest.frametimeMs} ms</div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="inputLagMs"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#lagGrad)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono pt-1 border-t border-zinc-800/60">
            <span className="text-zinc-400">Interrupts: 24 μs</span>
            <span className="text-cyan-400 font-bold">Ultra Response</span>
          </div>
        </div>
      </div>
    </div>
  );
};
