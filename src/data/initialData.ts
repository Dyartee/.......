import { Plan, Tool, User, License, OptimizationHistoryItem, DeviceInfo, AppConfig, AdminLog } from '../types';
import { CANONICAL_TOOLS } from './canonicalCatalog';

export const INITIAL_PLANS: Plan[] = [
  {
    id: 'basico',
    name: 'BÁSICO',
    level: 1,
    price: 0.0,
    period: 'gratuito',
    description: 'Diagnóstico e otimizações elementares do sistema para computadores de uso geral.',
    features: [
      'Informações essenciais do sistema',
      'Diagnóstico básico de componentes',
      'Limpeza de arquivos temporários do usuário',
      'Ajustes básicos de desempenho da CPU',
      'Configurações voltadas à responsividade geral',
    ],
    active: true,
    checkoutUrlKey: 'basic_checkout_url',
  },
  {
    id: 'medio',
    name: 'MÉDIO',
    level: 2,
    price: 30.0,
    period: 'mês',
    description: 'Controle inteligente de memória, processos e otimizações essenciais do Windows.',
    features: [
      'Informações completas do sistema',
      'Verificação e diagnóstico do PC',
      'Limpeza de arquivos temporários e cache',
      'Otimizações essenciais do Windows',
      'Ajustes inteligentes de memória RAM',
      'Plano de energia de alta performance',
      'Redução de processos desnecessários',
      'Otimização de inicialização rápida',
      'Ajustes de estabilidade e latência',
    ],
    active: true,
    checkoutUrlKey: 'medium_checkout_url',
  },
  {
    id: 'avancado',
    name: 'AVANÇADO',
    level: 3,
    price: 45.0,
    period: 'mês',
    description: 'Para entusiastas e gamers que buscam alto desempenho e menor latência.',
    features: [
      'Tudo do Médio +',
      'Otimizações avançadas do Windows',
      'Otimizações específicas para jogos',
      'Configurações de baixa latência',
      'Ajustes avançados de desempenho',
      'Otimização e profiles de GPU',
      'AMD & NVIDIA Driver Optimized',
      'Ajustes para consistência de frametime',
      'Melhorias de responsividade',
    ],
    badge: '⭐ MAIS VENDIDO',
    badgeType: 'popular',
    active: true,
    checkoutUrlKey: 'advanced_checkout_url',
  },
  {
    id: 'completo',
    name: 'COMPLETO',
    level: 4,
    price: 60.0,
    period: 'mês',
    description: 'A experiência definitiva sem limitações. Configurações avançadas de latência e frametime.',
    features: [
      'Tudo do Avançado +',
      'Todas as otimizações disponíveis',
      'Configurações extremas de desempenho',
      'Otimizações de consistência de quadros',
      'Redução da fila de latência de comandos',
      'Configurações avançadas de latência DPC',
      'Suite Exclusiva DYARTE Extreme',
      'Recursos futuros adicionados ao plano Completo',
    ],
    badge: '👑 MÁXIMO DESEMPENHO',
    badgeType: 'max',
    active: true,
    checkoutUrlKey: 'complete_checkout_url',
  },
];

export const INITIAL_TOOLS: Tool[] = CANONICAL_TOOLS;

export const INITIAL_DEVICE: DeviceInfo = {
  cpu: 'N/D',
  gpu: 'N/D',
  ram: 'N/D',
  storage: 'N/D',
  motherboard: 'N/D',
  motherboard_chipset: undefined,
  bios_version: undefined,
  resizable_bar: null,
  secure_boot: null,
  xmp_profile: null,
  input_lag_ms: null,
  ram_frequency: null,
  gpu_clock_mhz: null,
  windows_license: null,
  windows: 'N/D',
  windows_version: 'N/D',
  build: 'N/D',
  device_id: 'N/D',
  is_agent_connected: false,
  agent_version: 'N/D',
  last_heartbeat: 'Desconectado',
  cpu_usage_pct: null,
  gpu_usage_pct: null,
  ram_usage_pct: null,
  temp_c: null,
  ping_ms: null,
};

export const INITIAL_CONFIG: AppConfig = {
  basic_checkout_url: 'https://dyarte.com/planos/basico',
  medium_checkout_url: 'https://dyarte.com/planos/medio',
  advanced_checkout_url: 'https://dyarte.com/planos/avancado',
  complete_checkout_url: 'https://dyarte.com/planos/completo',
  support_email: 'suporte@dyarte.com',
  discord_url: 'https://discord.gg/dyarte-optimizer',
  agent_download_url: 'https://dyarte.com/downloads/dyarte-agent-setup-v1.4.2.exe',
  app_version: 'v2.4.0 Desktop Build',
  require_agent_connection: true,
  amd_driver_drive_url: 'https://drive.google.com/drive/folders/dyarte-amd-driver-optimizer-v2',
  nvidia_driver_drive_url: 'https://drive.google.com/drive/folders/dyarte-nvidia-driver-optimizer-v2',
  safety_lock_enabled: true,
};

import { isDevFixturesEnabled, DEV_USERS, DEV_LICENSES, DEV_ADMIN_LOGS } from './devFixtures';

export const INITIAL_USERS: User[] = isDevFixturesEnabled() ? DEV_USERS : [];

export const INITIAL_LICENSES: License[] = isDevFixturesEnabled() ? DEV_LICENSES : [];

// Histórico real começa vazio em uma instalação limpa
export const INITIAL_HISTORY: OptimizationHistoryItem[] = [];

export const INITIAL_ADMIN_LOGS: AdminLog[] = isDevFixturesEnabled() ? DEV_ADMIN_LOGS : [];

