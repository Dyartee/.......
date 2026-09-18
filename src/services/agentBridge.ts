/**
 * DYARTE OPTIMIZER - Local Agent Bridge
 * Conexão segura via WebSocket local (127.0.0.1:49152) com o dyarte-agent.exe
 */

import {
  AgentConnectionState,
  SystemTelemetry,
  TelemetrySnapshot,
  OptimizationToolState,
} from './telemetryTypes';

export type AgentMessageListener = (snapshot: TelemetrySnapshot) => void;
export type AgentStateListener = (state: AgentConnectionState) => void;

interface PendingRequest {
  resolve: (response: any) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

class AgentBridgeService {
  private socket: WebSocket | null = null;
  private connectionState: AgentConnectionState = 'AGENT_OFFLINE';
  private telemetryListeners: Set<AgentMessageListener> = new Set();
  private stateListeners: Set<AgentStateListener> = new Set();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private currentSnapshot: TelemetrySnapshot | null = null;
  private lastPingTimestamp: number = 0;
  private lastLatencyMs: number = 0;

  private pendingRequests: Map<string, PendingRequest> = new Map();

  private readonly AGENT_PORT = 49152;
  private readonly AGENT_HOST = '127.0.0.1'; // Conexão estrita em loopback local
  private readonly PROTOCOL_VERSION = 1;

  public getState(): AgentConnectionState {
    return this.connectionState;
  }

  public getLatency(): number {
    return this.lastLatencyMs;
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
      this.stateListeners.forEach((listener) => {
        try {
          listener(newState);
        } catch (err) {
          console.error('Erro no listener de estado do agente:', err);
        }
      });
    }
  }

  /**
   * 1. Conectar ao dyarte-agent.exe em 127.0.0.1:49152
   */
  public connect() {
    console.log('[AgentBridge] connect chamado');
    if (typeof window === 'undefined') return;

    // Evita abrir múltiplos sockets simultâneos
    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)
    ) {
      console.log('[AgentBridge] Socket já ativo ou conectando (readyState:', this.socket.readyState, ')');
      return;
    }

    this.setState('AGENT_CONNECTING');

    try {
      const wsUrl = `ws://${this.AGENT_HOST}:${this.AGENT_PORT}`;
      console.log('[AgentBridge] WebSocket CONNECTING para', wsUrl);
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        console.log('[AgentBridge] WebSocket OPEN');
        // Envia handshake inicial. Estado transita para ONLINE apenas após HANDSHAKE_ACK
        this.sendHandshake();
      };

      this.socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleIncomingMessage(message);
        } catch {
          // Payload inválido descartado com segurança
        }
      };

      this.socket.onerror = (err) => {
        console.warn('[AgentBridge] WebSocket ERROR:', err);
        this.setState('AGENT_ERROR');
      };

      this.socket.onclose = (event) => {
        console.log('[AgentBridge] WebSocket CLOSED (code:', event.code, 'reason:', event.reason, ')');
        this.setState('AGENT_OFFLINE');
        this.stopHeartbeat();
        this.clearPendingRequests('Conexão encerrada pelo agente.');
        this.scheduleReconnect();
      };
    } catch (err) {
      console.error('[AgentBridge] Falha ao criar WebSocket:', err);
      this.setState('AGENT_ERROR');
      this.scheduleReconnect();
    }
  }

  public disconnect() {
    console.log('[AgentBridge] disconnect chamado');
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopHeartbeat();
    this.clearPendingRequests('Desconexão solicitada pelo usuário.');

    if (this.socket) {
      this.socket.onclose = null;
      this.socket.onerror = null;
      this.socket.close();
      this.socket = null;
    }
    this.setState('AGENT_OFFLINE');
  }

  /**
   * 2. Realizar Handshake
   */
  private sendHandshake() {
    console.log('[AgentBridge] HANDSHAKE enviado');
    this.sendMessage({
      protocol_version: this.PROTOCOL_VERSION,
      type: 'HANDSHAKE',
      client: 'DYARTE_OPTIMIZER',
    });
  }

  /**
   * 4. Enviar PING
   */
  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.lastPingTimestamp = Date.now();
        this.sendMessage({
          protocol_version: this.PROTOCOL_VERSION,
          type: 'PING',
          timestamp: this.lastPingTimestamp,
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

  /**
   * 6. Executar TEST_CONNECTION
   */
  public async testConnection(customRequestId?: string, timeoutMs: number = 5000): Promise<{
    success: boolean;
    agent_version?: string;
    request_id?: string;
    error?: string;
  }> {
    if (this.connectionState !== 'AGENT_ONLINE' || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return {
        success: false,
        error: 'Agente offline. Inicie o dyarte-agent.exe em 127.0.0.1:49152 para conectar.',
      };
    }

    const requestId =
      customRequestId || `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        resolve({
          success: false,
          error: 'Tempo limite esgotado aguardando TEST_CONNECTION_RESULT do agente.',
        });
      }, timeoutMs);

      this.pendingRequests.set(requestId, {
        resolve: (resp) => {
          clearTimeout(timer);
          if (resp.type === 'TEST_CONNECTION_RESULT') {
            resolve({
              success: Boolean(resp.success),
              agent_version: resp.agent_version || '1.0.0',
              request_id: resp.request_id,
            });
          } else {
            resolve({
              success: false,
              error: resp.error || 'Resposta inesperada do agente.',
            });
          }
        },
        reject: (err) => {
          clearTimeout(timer);
          resolve({ success: false, error: err.message });
        },
        timer,
      });

      this.sendMessage({
        protocol_version: this.PROTOCOL_VERSION,
        request_id: requestId,
        type: 'TEST_CONNECTION',
      });
    });
  }

  /**
   * Processamento das mensagens recebidas do Agente Windows
   */
  private handleIncomingMessage(msg: any) {
    if (!msg || typeof msg !== 'object') return;

    // 3. Receber HANDSHAKE_ACK
    if (msg.type === 'HANDSHAKE_ACK') {
      console.log('[AgentBridge] HANDSHAKE_ACK recebido:', msg);
      if (msg.status === 'ONLINE') {
        this.setState('AGENT_ONLINE');
        this.startHeartbeat();
      }
      return;
    }

    // 5. Receber PONG
    if (msg.type === 'PONG') {
      if (this.lastPingTimestamp > 0) {
        this.lastLatencyMs = Math.max(1, Date.now() - this.lastPingTimestamp);
      }
      return;
    }

    // 5 & 6. Request ID correlation (e.g. TEST_CONNECTION_RESULT)
    if (msg.request_id && this.pendingRequests.has(msg.request_id)) {
      const pending = this.pendingRequests.get(msg.request_id);
      this.pendingRequests.delete(msg.request_id);
      if (pending) {
        pending.resolve(msg);
      }
      return;
    }

    // Telemetria futura enviada pelo agente
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

  private clearPendingRequests(reason: string) {
    this.pendingRequests.forEach((req) => {
      clearTimeout(req.timer);
      req.reject(new Error(reason));
    });
    this.pendingRequests.clear();
  }

  /**
   * Solicita aplicação de otimização por ID
   */
  public async applyOptimization(
    toolId: string
  ): Promise<{ success: boolean; state: OptimizationToolState; error?: string }> {
    return this.requestApplyOptimization(toolId);
  }

  public async requestApplyOptimization(
    toolId: string
  ): Promise<{ success: boolean; state: OptimizationToolState; error?: string }> {
    if (this.connectionState !== 'AGENT_ONLINE') {
      return {
        success: false,
        state: 'FALHA',
        error: 'DYARTE Agent não conectado no Windows (127.0.0.1:49152).',
      };
    }

    const requestId = `opt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    this.sendMessage({
      protocol_version: this.PROTOCOL_VERSION,
      request_id: requestId,
      type: 'APPLY_OPTIMIZATION',
      tool_id: toolId,
      timestamp: Date.now(),
    });

    return { success: true, state: 'APLICANDO' };
  }

  /**
   * Solicita rollback específico
   */
  public async rollbackOptimization(
    toolId: string
  ): Promise<{ success: boolean; state: OptimizationToolState; error?: string }> {
    return this.requestRollbackOptimization(toolId);
  }

  public async requestRollbackOptimization(
    toolId: string
  ): Promise<{ success: boolean; state: OptimizationToolState; error?: string }> {
    if (this.connectionState !== 'AGENT_ONLINE') {
      return { success: false, state: 'FALHA', error: 'DYARTE Agent offline.' };
    }

    const requestId = `rbk_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    this.sendMessage({
      protocol_version: this.PROTOCOL_VERSION,
      request_id: requestId,
      type: 'ROLLBACK_OPTIMIZATION',
      tool_id: toolId,
      timestamp: Date.now(),
    });

    return { success: true, state: 'REVERTENDO' };
  }

  /**
   * Execução de driver de GPU:
   * Interface unificada que integra o Windows Agent com a camada IPC nativa do Electron.
   * Se o Agent possuir suporte direto via socket, envia o pacote de controle; caso contrário,
   * despacha com segurança através da camada nativa DriverService do Electron Main Process.
   */
  public async executeDriver(
    vendor: 'AMD' | 'NVIDIA',
    installerPath?: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    console.log(`[AgentBridge] executeDriver solicitado para: ${vendor}`);

    // Se estiver no aplicativo Electron Windows, utiliza o DriverService IPC
    if (typeof window !== 'undefined' && window.dyarte?.drivers) {
      const result = await window.dyarte.drivers.executeDriverInstaller(vendor);
      return {
        success: result.success,
        message: result.message,
        error: result.error,
      };
    }

    // Se o Agent estiver online via WebSocket e conectado
    if (this.connectionState === 'AGENT_ONLINE') {
      const requestId = `drv_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      this.sendMessage({
        protocol_version: this.PROTOCOL_VERSION,
        request_id: requestId,
        type: 'EXECUTE_DRIVER_PACKAGE',
        vendor,
        installer_path: installerPath || null,
        timestamp: Date.now(),
      });
      return {
        success: true,
        message: `Comando de execução do driver ${vendor} transmitido ao Windows Agent.`,
      };
    }

    return {
      success: false,
      error: 'Instalação nativa de drivers requer o aplicativo desktop DYARTE OPTIMIZER para Windows com privilégios de Administrador.',
    };
  }
}

export const agentBridge = new AgentBridgeService();
