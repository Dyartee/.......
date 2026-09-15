/**
 * DYARTE OPTIMIZER - Local Agent Bridge
 * Conexão segura via WebSocket local (127.0.0.1:49152) com o dYARTE-agent.exe
 */

import {
  AgentConnectionState,
  SystemTelemetry,
  TelemetrySnapshot,
  OptimizationToolState,
  OptimizationBackupRecord,
} from './telemetryTypes';

export type AgentMessageListener = (snapshot: TelemetrySnapshot) => void;
export type AgentStateListener = (state: AgentConnectionState) => void;

class AgentBridgeService {
  private socket: WebSocket | null = null;
  private connectionState: AgentConnectionState = 'AGENT_OFFLINE';
  private telemetryListeners: Set<AgentMessageListener> = new Set();
  private stateListeners: Set<AgentStateListener> = new Set();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private localToken: string = '';
  private currentSnapshot: TelemetrySnapshot | null = null;

  private readonly AGENT_PORT = 49152;
  private readonly AGENT_HOST = '127.0.0.1'; // Conexão estrita em loopback local
  private readonly PROTOCOL_VERSION = 1;

  constructor() {
    // Carrega ou gera token local efêmero de handshake
    if (typeof window !== 'undefined') {
      const storedToken = sessionStorage.getItem('dyarte_agent_local_token');
      if (storedToken) {
        this.localToken = storedToken;
      } else {
        this.localToken = `tk_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;
        sessionStorage.setItem('dyarte_agent_local_token', this.localToken);
      }
    }
  }

  public getState(): AgentConnectionState {
    return this.connectionState;
  }

  public getLatestTelemetry(): SystemTelemetry | null {
    return this.currentSnapshot ? this.currentSnapshot.telemetry : null;
  }

  public onTelemetry(listener: AgentMessageListener): () => void {
    this.telemetryListeners.add(listener);
    if (this.currentSnapshot) {
      listener(this.currentSnapshot);
    }
    return () => this.telemetryListeners.delete(listener);
  }

  public onStateChange(listener: AgentStateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.connectionState);
    return () => this.stateListeners.delete(listener);
  }

  private setState(newState: AgentConnectionState) {
    if (this.connectionState !== newState) {
      this.connectionState = newState;
      this.stateListeners.forEach((listener) => listener(newState));
    }
  }

  /**
   * Inicia a conexão com o dyarte-agent.exe em 127.0.0.1
   */
  public connect() {
    if (typeof window === 'undefined') return;
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.setState('AGENT_CONNECTING');

    try {
      const wsUrl = `ws://${this.AGENT_HOST}:${this.AGENT_PORT}?token=${encodeURIComponent(this.localToken)}&v=${this.PROTOCOL_VERSION}`;
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.setState('AGENT_ONLINE');
        this.sendHandshake();
        this.startHeartbeat();
      };

      this.socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleIncomingMessage(message);
        } catch {
          // Payload inválido descartado com segurança
        }
      };

      this.socket.onerror = () => {
        this.setState('AGENT_OFFLINE');
      };

      this.socket.onclose = () => {
        this.setState('AGENT_OFFLINE');
        this.stopHeartbeat();
        this.scheduleReconnect();
      };
    } catch {
      this.setState('AGENT_OFFLINE');
      this.scheduleReconnect();
    }
  }

  public disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopHeartbeat();
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.setState('AGENT_OFFLINE');
  }

  private sendHandshake() {
    this.sendMessage({
      version: this.PROTOCOL_VERSION,
      type: 'HANDSHAKE',
      token: this.localToken,
      client: 'DYARTE_REACT_UI',
      timestamp: Date.now(),
    });
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.sendMessage({
          version: this.PROTOCOL_VERSION,
          type: 'PING',
          timestamp: Date.now(),
        });
      }
    }, 5000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 4000);
  }

  private sendMessage(payload: Record<string, any>) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(payload));
    }
  }

  private handleIncomingMessage(msg: any) {
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'TELEMETRY_SNAPSHOT' && msg.data) {
      const snapshot: TelemetrySnapshot = {
        version: msg.version || this.PROTOCOL_VERSION,
        timestamp: msg.timestamp || Date.now(),
        agent_version: msg.agent_version || '1.0.0',
        telemetry: {
          timestamp: msg.timestamp || Date.now(),
          cpu_usage: typeof msg.data.cpu?.usage === 'number' ? msg.data.cpu.usage : null,
          cpu_temperature: typeof msg.data.cpu?.temperature === 'number' ? msg.data.cpu.temperature : null,
          cpu_clock_mhz: typeof msg.data.cpu?.clock_mhz === 'number' ? msg.data.cpu.clock_mhz : null,
          cpu_power_w: typeof msg.data.cpu?.power_w === 'number' ? msg.data.cpu.power_w : null,

          gpu_usage: typeof msg.data.gpu?.usage === 'number' ? msg.data.gpu.usage : null,
          gpu_temperature: typeof msg.data.gpu?.temperature === 'number' ? msg.data.gpu.temperature : null,
          gpu_clock_mhz: typeof msg.data.gpu?.clock_mhz === 'number' ? msg.data.gpu.clock_mhz : null,
          gpu_memory_used_mb: typeof msg.data.gpu?.memory_used_mb === 'number' ? msg.data.gpu.memory_used_mb : null,
          gpu_memory_total_mb: typeof msg.data.gpu?.memory_total_mb === 'number' ? msg.data.gpu.memory_total_mb : null,
          gpu_power_w: typeof msg.data.gpu?.power_w === 'number' ? msg.data.gpu.power_w : null,
          gpu_vendor: msg.data.gpu?.vendor || 'UNKNOWN',
          gpu_model: msg.data.gpu?.model || null,
          driver_version: msg.data.gpu?.driver_version || null,
          rebar_enabled: typeof msg.data.gpu?.rebar_enabled === 'boolean' ? msg.data.gpu.rebar_enabled : null,

          ram_usage_pct: typeof msg.data.memory?.usage === 'number' ? msg.data.memory.usage : null,
          ram_used_mb: typeof msg.data.memory?.used_mb === 'number' ? msg.data.memory.used_mb : null,
          ram_total_mb: typeof msg.data.memory?.total_mb === 'number' ? msg.data.memory.total_mb : null,

          active_process: msg.data.game?.process || null,
          active_game_pid: typeof msg.data.game?.pid === 'number' ? msg.data.game.pid : null,
          active_game_name: msg.data.game?.name || null,
          fps: typeof msg.data.game?.fps === 'number' ? msg.data.game.fps : null,
          frametime_ms: typeof msg.data.game?.frametime_ms === 'number' ? msg.data.game.frametime_ms : null,
          gpu_latency_ms: typeof msg.data.game?.gpu_latency_ms === 'number' ? msg.data.game.gpu_latency_ms : null,
          presentmon_available: Boolean(msg.data.game?.presentmon_available),
        },
      };

      this.currentSnapshot = snapshot;
      this.telemetryListeners.forEach((listener) => listener(snapshot));
    }
  }

  /**
   * Solicita aplicação de otimização estritamente por ID conhecido
   */
  public async requestApplyOptimization(toolId: string): Promise<{ success: boolean; state: OptimizationToolState; error?: string }> {
    if (this.connectionState !== 'AGENT_ONLINE') {
      return { success: false, state: 'FALHA', error: 'DYARTE Agent não conectado no Windows (127.0.0.1:49152).' };
    }

    // Emissão de comando tipado na whitelist
    this.sendMessage({
      version: this.PROTOCOL_VERSION,
      type: 'APPLY_OPTIMIZATION',
      tool_id: toolId,
      timestamp: Date.now(),
    });

    return { success: true, state: 'APLICANDO' };
  }

  /**
   * Solicita rollback específico para o estado anterior registrado pelo agente
   */
  public async requestRollbackOptimization(toolId: string): Promise<{ success: boolean; state: OptimizationToolState; error?: string }> {
    if (this.connectionState !== 'AGENT_ONLINE') {
      return { success: false, state: 'FALHA', error: 'DYARTE Agent offline.' };
    }

    this.sendMessage({
      version: this.PROTOCOL_VERSION,
      type: 'ROLLBACK_OPTIMIZATION',
      tool_id: toolId,
      timestamp: Date.now(),
    });

    return { success: true, state: 'REVERTENDO' };
  }
}

export const agentBridge = new AgentBridgeService();
