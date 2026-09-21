import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Tooltip,
} from 'recharts';
import { useApp } from '../../context/AppContext';
import {
  Cpu,
  Activity,
  Gauge,
  Thermometer,
  Layers,
  Play,
  Pause,
} from 'lucide-react';

interface TelemetrySample {
  time: string;
  cpuUsage: number | null;
  cpuTemp: number | null;
  gpuUsage: number | null;
  gpuTemp: number | null;
  ramUsage: number | null;
  inputLagMs: number | null;
  frametimeMs: number | null;
}

export const RealtimeTelemetryCharts: React.FC = () => {
  const { device } = useApp();
  const [isLive, setIsLive] = useState(true);

  // Buffer de dados reais coletados exclusivamente do Agent
  const [samples, setSamples] = useState<TelemetrySample[]>([]);

  // Coleta dados SOMENTE quando há telemetria real reportada pelo Agent
  useEffect(() => {
    if (!isLive) return;

    // Zero é valor válido, mas se ambos forem null, não há dados reais
    if (device.cpu_usage_pct === null && device.gpu_usage_pct === null && device.ram_usage_pct === null) {
      return;
    }

    const nowStr = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const newSample: TelemetrySample = {
      time: nowStr,
      cpuUsage: device.cpu_usage_pct,
      cpuTemp: device.cpu_temperature ?? device.temp_c,
      gpuUsage: device.gpu_usage_pct,
      gpuTemp: device.gpu_temperature ?? device.temp_c,
      ramUsage: device.ram_usage_pct,
      inputLagMs: device.input_lag_ms,
      frametimeMs: device.frametime_ms ?? null,
    };

    setSamples((prev) => [...prev.slice(-14), newSample]);
  }, [
    isLive,
    device.cpu_usage_pct,
    device.gpu_usage_pct,
    device.ram_usage_pct,
    device.cpu_temperature,
    device.gpu_temperature,
    device.temp_c,
    device.input_lag_ms,
    device.frametime_ms,
  ]);

  const hasRealTelemetry =
    Boolean(device.is_agent_connected) &&
    (device.cpu_usage_pct !== null || device.gpu_usage_pct !== null || device.ram_usage_pct !== null);

  const validCpuSamples = samples.filter((s) => s.cpuUsage !== null);
  const validGpuSamples = samples.filter((s) => s.gpuUsage !== null);
  const validRamSamples = samples.filter((s) => s.ramUsage !== null);
  const validLagSamples = samples.filter((s) => s.inputLagMs !== null);

  return (
    <div className="space-y-4">
      {/* Top Header of Telemetry Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              hasRealTelemetry ? 'bg-emerald-400 animate-ping' : 'bg-zinc-600'
            }`}
          />
          <h3 className="text-sm font-bold uppercase tracking-wider text-white font-mono flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#FF3333]" />
            <span>TELEMETRIA DO SISTEMA</span>
          </h3>
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
              hasRealTelemetry
                ? 'bg-emerald-950/40 text-emerald-400 border-emerald-700/50'
                : 'bg-zinc-800 text-zinc-400 border-zinc-700'
            }`}
          >
            {hasRealTelemetry ? 'Sensores Ativos' : 'Aguardando Agent'}
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
                <span>AO VIVO</span>
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

      {/* Grid of Mini-Graphs for Each Function: CPU, GPU, RAM, Input Lag */}
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
                <span className="text-[10px] font-mono text-zinc-400 truncate max-w-[130px] block" title={device.cpu}>
                  {device.cpu || 'N/D'}
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-lg font-black font-mono text-white block">
                {device.cpu_usage_pct !== null ? `${device.cpu_usage_pct}%` : 'N/D'}
              </span>
              <span className="text-xs font-mono text-amber-400 font-bold flex items-center justify-end gap-1">
                <Thermometer className="w-3 h-3 text-amber-400" />
                {device.temp_c !== null ? `${device.temp_c}°C` : 'N/D'}
              </span>
            </div>
          </div>

          {/* Mini Chart CPU */}
          <div className="h-24 w-full bg-[#0a0a0f] rounded-lg p-1 border border-zinc-800/80 overflow-hidden flex items-center justify-center">
            {hasRealTelemetry && validCpuSamples.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={validCpuSamples} margin={{ top: 4, right: 2, left: 2, bottom: 0 }}>
                  <defs>
                    <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#E00000" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="#E00000" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-[#14141c] border border-zinc-700 px-2 py-1 rounded text-[10px] font-mono text-white shadow">
                            <div>Uso: {payload[0]?.value !== null ? `${payload[0]?.value}%` : 'N/D'}</div>
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
                    connectNulls={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center p-2">
                <span className="text-[11px] font-mono text-zinc-500 block">Aguardando dados do Agent</span>
                <span className="text-[9px] font-mono text-zinc-600 block">Sem injeção de dados simulados</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 pt-1 border-t border-zinc-800/60">
            <span>Fonte: {device.is_agent_connected ? 'Agent Local' : 'Desconectado'}</span>
            <span className={device.is_agent_connected ? 'text-emerald-400 font-bold' : 'text-zinc-600'}>
              {device.is_agent_connected ? '127.0.0.1:49152' : 'Sem conexão'}
            </span>
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
                <span className="text-[10px] font-mono text-zinc-400 truncate max-w-[130px] block" title={device.gpu}>
                  {device.gpu || 'N/D'}
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-lg font-black font-mono text-white block">
                {device.gpu_usage_pct !== null ? `${device.gpu_usage_pct}%` : 'N/D'}
              </span>
              <span className="text-xs font-mono text-rose-400 font-bold flex items-center justify-end gap-1">
                <Thermometer className="w-3 h-3 text-rose-400" />
                {device.temp_c !== null ? `${device.temp_c}°C` : 'N/D'}
              </span>
            </div>
          </div>

          {/* Mini Chart GPU */}
          <div className="h-24 w-full bg-[#0a0a0f] rounded-lg p-1 border border-zinc-800/80 overflow-hidden flex items-center justify-center">
            {hasRealTelemetry && validGpuSamples.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={validGpuSamples} margin={{ top: 4, right: 2, left: 2, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gpuGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-[#14141c] border border-zinc-700 px-2 py-1 rounded text-[10px] font-mono text-white shadow">
                            <div>GPU: {payload[0]?.value !== null ? `${payload[0]?.value}%` : 'N/D'}</div>
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
                    connectNulls={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center p-2">
                <span className="text-[11px] font-mono text-zinc-500 block">Aguardando dados do Agent</span>
                <span className="text-[9px] font-mono text-zinc-600 block">Sem injeção de dados simulados</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 pt-1 border-t border-zinc-800/60">
            <span>Clock: {device.gpu_clock_mhz ? `${device.gpu_clock_mhz} MHz` : 'N/D'}</span>
            <span className="text-zinc-500">{device.resizable_bar === true ? 'ReBAR Ativo' : 'ReBAR N/D'}</span>
          </div>
        </div>

        {/* 3. MEMÓRIA RAM: Uso, Frequência e Perfil */}
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
                <span className="text-[10px] font-mono text-zinc-400 truncate max-w-[130px] block" title={device.ram}>
                  {device.ram || 'N/D'}
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-lg font-black font-mono text-white block">
                {device.ram_usage_pct !== null ? `${device.ram_usage_pct}%` : 'N/D'}
              </span>
              <span className="text-xs font-mono text-amber-400 font-bold">
                {device.ram_frequency || 'N/D'}
              </span>
            </div>
          </div>

          {/* Mini Chart RAM */}
          <div className="h-24 w-full bg-[#0a0a0f] rounded-lg p-1 border border-zinc-800/80 overflow-hidden flex items-center justify-center">
            {hasRealTelemetry && validRamSamples.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={validRamSamples} margin={{ top: 4, right: 2, left: 2, bottom: 0 }}>
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
                            <div>Uso RAM: {payload[0]?.value !== null ? `${payload[0]?.value}%` : 'N/D'}</div>
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
                    connectNulls={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center p-2">
                <span className="text-[11px] font-mono text-zinc-500 block">Aguardando dados do Agent</span>
                <span className="text-[9px] font-mono text-zinc-600 block">Sem injeção de dados simulados</span>
              </div>
            )}
          </div>

          {/* XMP / DOCP Badge & Frequência */}
          <div className="flex items-center justify-between text-[11px] font-mono pt-1 border-t border-zinc-800/60">
            <span className="text-zinc-400">Freq: {device.ram_frequency || 'N/D'}</span>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 font-bold">
              <span>{device.xmp_profile || 'XMP: N/D'}</span>
            </div>
          </div>
        </div>

        {/* 4. LATÊNCIA E RESPOSTA DO SISTEMA */}
        <div className="p-4 rounded-xl bg-[#111118] border border-[#232330] hover:border-[#38384d] transition-all flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-cyan-950/60 border border-cyan-800/40 text-cyan-400">
                <Gauge className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-mono font-bold text-white uppercase block">
                  RESPOSTA & LATÊNCIA
                </span>
                <span className="text-[10px] font-mono text-zinc-400 block">
                  Ping Local: {device.ping_ms !== null ? `${device.ping_ms} ms` : 'N/D'}
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-lg font-black font-mono text-cyan-300 block">
                {device.input_lag_ms !== null ? `${device.input_lag_ms} ms` : 'N/D'}
              </span>
              <span className="text-xs font-mono text-zinc-400">
                Input Lag
              </span>
            </div>
          </div>

          {/* Mini Chart Input Lag */}
          <div className="h-24 w-full bg-[#0a0a0f] rounded-lg p-1 border border-zinc-800/80 overflow-hidden flex items-center justify-center">
            {hasRealTelemetry && validLagSamples.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={validLagSamples} margin={{ top: 4, right: 2, left: 2, bottom: 0 }}>
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
                            <div className="text-cyan-400">
                              Input Lag: {payload[0]?.value !== null ? `${payload[0]?.value} ms` : 'N/D'}
                            </div>
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
                    connectNulls={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center p-2">
                <span className="text-[11px] font-mono text-zinc-500 block">Aguardando medição de sensor</span>
                <span className="text-[9px] font-mono text-zinc-600 block">Sem injeção de latência simulada</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono pt-1 border-t border-zinc-800/60">
            <span className="text-zinc-400">Sensor de Input Lag</span>
            <span className="text-zinc-500 font-bold">{device.input_lag_ms !== null ? 'Medido' : 'N/D'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
