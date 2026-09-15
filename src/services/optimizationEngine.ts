/**
 * DYARTE OPTIMIZER - Optimization Engine Contract
 * Arquitetura de ciclo de vida para otimizações de baixo nível no Windows
 */

import { OptimizationToolState, OptimizationBackupRecord } from './telemetryTypes';
import { agentBridge } from './agentBridge';

export interface IOptimizationHandler {
  tool_id: string;
  detect(): Promise<OptimizationToolState>;
  checkCompatibility(): Promise<{ compatible: boolean; reason?: string }>;
  backup(): Promise<OptimizationBackupRecord | null>;
  apply(): Promise<{ success: boolean; state: OptimizationToolState; error?: string }>;
  verify(): Promise<boolean>;
  rollback(backup: OptimizationBackupRecord): Promise<{ success: boolean; error?: string }>;
  getStatus(): Promise<OptimizationToolState>;
}

/**
 * Registrador de Otimizações Conhecidas do DYARTE Optimizer
 * Cada otimização possui uma implementação fixa e versionada no agente Windows,
 * rejeitando qualquer envio de código arbitrário pelo frontend.
 */
export class OptimizationEngine {
  private static instance: OptimizationEngine;

  private constructor() {}

  public static getInstance(): OptimizationEngine {
    if (!OptimizationEngine.instance) {
      OptimizationEngine.instance = new OptimizationEngine();
    }
    return OptimizationEngine.instance;
  }

  /**
   * Executa a aplicação segura através da bridge com o dYARTE-agent.exe
   */
  public async executeTool(toolId: string): Promise<{ success: boolean; state: OptimizationToolState; error?: string }> {
    // Se o agente local estiver conectado, delega ao executável do Windows
    if (agentBridge.getState() === 'AGENT_ONLINE') {
      return await agentBridge.requestApplyOptimization(toolId);
    }

    // Se estiver sem agente conectado
    return {
      success: false,
      state: 'FALHA',
      error: 'Agente Windows (dyarte-agent.exe) não detectado em 127.0.0.1. Inicie o serviço local para aplicar configurações no sistema operacional.',
    };
  }

  /**
   * Executa a reversão (rollback) segura
   */
  public async rollbackTool(toolId: string): Promise<{ success: boolean; state: OptimizationToolState; error?: string }> {
    if (agentBridge.getState() === 'AGENT_ONLINE') {
      return await agentBridge.requestRollbackOptimization(toolId);
    }

    return {
      success: false,
      state: 'FALHA',
      error: 'Agente Windows indisponível para restaurar a configuração anterior.',
    };
  }
}

export const optimizationEngine = OptimizationEngine.getInstance();
