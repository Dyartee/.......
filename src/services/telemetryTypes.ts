/**
 * DYARTE OPTIMIZER - Telemetry & Agent Contracts
 * Contratos de telemetria em tempo real, monitoramento de processos e comunicação com o DYARTE Agent
 */

export type AgentConnectionState =
  | 'AGENT_OFFLINE'
  | 'AGENT_CONNECTING'
  | 'AGENT_ONLINE'
  | 'AGENT_ERROR';

export type OptimizationToolState =
  | 'DISPONIVEL'
  | 'INCOMPATIVEL'
  | 'JA_APLICADO'
  | 'APLICANDO'
  | 'APLICADO'
  | 'FALHA'
  | 'REVERTENDO'
  | 'REVERTIDO';

/**
 * Modelo oficial de telemetria recebido do agente local.
 * Campos indisponíveis em determinado hardware retornam estritamente null.
 */
export interface SystemTelemetry {
  timestamp: number;
  // CPU Telemetry (via LibreHardwareMonitor / Windows CIM)
  cpu_usage: number | null;
  cpu_temperature: number | null;
  cpu_clock_mhz: number | null;
  cpu_power_w: number | null;

  // GPU Telemetry (via NVAPI / AMD ADLX / LibreHardwareMonitor / ETW)
  gpu_usage: number | null;
  gpu_temperature: number | null;
  gpu_clock_mhz: number | null;
  gpu_memory_used_mb: number | null;
  gpu_memory_total_mb: number | null;
  gpu_power_w: number | null;
  gpu_vendor: 'NVIDIA' | 'AMD' | 'INTEL' | 'UNKNOWN';
  gpu_model: string | null;
  driver_version: string | null;
  rebar_enabled: boolean | null;

  // Memory Telemetry
  ram_usage_pct: number | null;
  ram_used_mb: number | null;
  ram_total_mb: number | null;

  // Real-time Gaming / Frame Capture (via PresentMon / RTSS)
  active_process: string | null;
  active_game_pid: number | null;
  active_game_name: string | null;
  fps: number | null;
  frametime_ms: number | null;
  gpu_latency_ms: number | null;
  presentmon_available: boolean;
}

/**
 * Snapshot estruturado para consumo na interface React
 */
export interface TelemetrySnapshot {
  version: number;
  timestamp: number;
  agent_version: string;
  telemetry: SystemTelemetry;
}

/**
 * Contrato de Provedores de Monitoramento no Agente Windows
 */
export interface IMonitorProvider {
  name: string;
  isAvailable(): Promise<boolean>;
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
}

/**
 * Registro de Backup e Rollback do Agente Windows
 */
export interface OptimizationBackupRecord {
  tool_id: string;
  timestamp: string;
  device_id: string;
  before_state: Record<string, any>;
  after_state: Record<string, any>;
  agent_version: string;
  rollback_available: boolean;
}
