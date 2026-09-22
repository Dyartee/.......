import { DeviceInfo } from '../types';
import { agentBridge } from '../services/agentBridge';

/**
 * DYARTE OPTIMIZER - Hardware Detection Service
 * Regra: Browser APIs NÃO são fontes oficiais de hardware para o Windows.
 * Fontes oficiais: Electron -> IPC -> Native Agent -> Windows APIs (WMI/DirectX/Win32).
 * 
 * Se o dado não vier de fonte oficial, deve ser explicitamente rotulado como
 * "(Reportado pelo navegador)" ou retornar "N/D" / null.
 */

/**
 * Limpa a string de renderer do WebGL para exibição secundária do navegador.
 */
export function cleanGpuRenderer(raw: string): string {
  if (!raw || !raw.trim()) return 'N/D';
  let cleaned = raw;

  if (cleaned.includes('ANGLE (')) {
    const parts = cleaned.match(/ANGLE \([^,]+,\s*([^,]+)/);
    if (parts && parts[1]) {
      cleaned = parts[1].trim();
    } else {
      cleaned = cleaned.replace(/^ANGLE \(/, '').replace(/\)$/, '');
    }
  }

  cleaned = cleaned.replace(/\(R\)/gi, '').replace(/\(TM\)/gi, '').trim();
  return cleaned || 'N/D';
}

/**
 * Inspeciona GPU via WebGL apenas como informação do navegador.
 * NUNCA deve ser tratada como confirmação definitiva de hardware nativo.
 */
export function detectRealGPU(): string {
  try {
    if (typeof document === 'undefined') return 'N/D';
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl') ||
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);

    if (!gl) return 'N/D';

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) return 'N/D';

    const unmasked = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
    const cleaned = cleanGpuRenderer(String(unmasked));
    if (!cleaned || cleaned === 'N/D') return 'N/D';

    return `${cleaned} (WebGL / Navegador)`;
  } catch {
    return 'N/D';
  }
}

/**
 * Detecta núcleos lógicos reportados pelo navegador.
 * NUNCA inventa modelo comercial de CPU (e.g. Ryzen, Intel Core i7).
 */
export function detectRealCPU(): {
  name: string;
  cores: number;
  arch: string;
} {
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 0 : 0;
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const is64 = ua.includes('Win64') || ua.includes('x64') || ua.includes('WOW64') || ua.includes('x86_64');
  const arch = is64 ? '64-bit' : '32-bit';

  if (!cores) {
    return {
      name: 'N/D',
      cores: 0,
      arch,
    };
  }

  return {
    name: `${cores} Núcleos Lógicos (Reportado pelo navegador)`,
    cores,
    arch,
  };
}

/**
 * Informa memória aproximada reportada pela API do navegador.
 * Não deve ser tratada como capacidade física exata instalada na placa-mãe.
 */
export function detectRealRAM(): {
  gb: number;
  formatted: string;
} {
  const nav = typeof navigator !== 'undefined' ? (navigator as any) : {};
  const deviceMem = nav.deviceMemory;

  if (deviceMem && typeof deviceMem === 'number') {
    return {
      gb: deviceMem,
      formatted: `${deviceMem} GB RAM (Estimado pelo navegador)`,
    };
  }

  return {
    gb: 0,
    formatted: 'N/D',
  };
}

/**
 * Detecta OS aproximado a partir do User-Agent
 */
export function detectRealOS(): {
  name: string;
  version: string;
  build: string;
} {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';

  let name = 'N/D';
  let version = 'N/D';
  let build = 'N/D';

  if (ua.includes('Windows NT 10.0')) {
    name = 'Windows 10 / 11';
    version = 'Reportado via Browser';
    build = 'Kernel NT 10.0';
  } else if (ua.includes('Windows NT 6.3')) {
    name = 'Windows 8.1';
    version = 'Reportado via Browser';
    build = 'Kernel NT 6.3';
  } else if (ua.includes('Windows NT 6.1')) {
    name = 'Windows 7';
    version = 'Reportado via Browser';
    build = 'Kernel NT 6.1';
  } else if (ua.includes('Macintosh') || ua.includes('Mac OS X')) {
    name = 'macOS';
    version = 'Darwin';
    build = 'Darwin x64';
  } else if (ua.includes('Linux')) {
    name = 'Linux';
    version = 'GNU/Linux';
    build = 'Kernel Linux';
  }

  return { name, version, build };
}

/**
 * Detecta resolução do monitor via Screen API
 */
export function detectRealScreen(): string {
  if (typeof window === 'undefined' || !window.screen) {
    return 'N/D';
  }
  const dpr = window.devicePixelRatio || 1;
  const realW = Math.round(window.screen.width * dpr);
  const realH = Math.round(window.screen.height * dpr);
  const colorDepth = window.screen.colorDepth || 24;

  let tag = '';
  if (realW >= 3840) tag = ' (4K Ultra HD)';
  else if (realW >= 2560) tag = ' (2K QHD)';
  else if (realW >= 1920) tag = ' (Full HD)';

  return `${realW}x${realH} @ ${colorDepth}-bit${tag}`;
}

/**
 * Constrói as especificações do dispositivo respeitando a hierarquia de fontes estrita:
 * 1. Windows Agent nativo via WMI / SetupAPI / NVAPI
 * 2. Electron IPC nativo verificado
 * 3. Se desconectado / não detectado: "Aguardando conexão com o Windows..." ou "N/D"
 *
 * REGRA ABSOLUTA: NUNCA inferir modelo comercial de hardware via WebGL ou navigator.
 */
export async function detectFullComputerSpecs(existingDevice?: DeviceInfo): Promise<DeviceInfo> {
  // Teste de latência real com backend local (apenas se rota responder)
  let pingMs: number | null = null;
  try {
    const start = performance.now();
    const res = await fetch('/api/health', { method: 'GET', cache: 'no-store' });
    if (res.ok) {
      const end = performance.now();
      pingMs = Math.max(1, Math.round(end - start));
    }
  } catch {
    pingMs = null;
  }

  // Tentar detecção oficial de GPU via Electron IPC se disponível
  let officialGpu: string | null = null;
  if (typeof window !== 'undefined' && window.dyarte?.drivers?.detectGpuVendor) {
    try {
      const detection = await window.dyarte.drivers.detectGpuVendor();
      if (detection?.gpuNames && detection.gpuNames.length > 0) {
        officialGpu = detection.gpuNames.join(' / ');
      }
    } catch {
      officialGpu = null;
    }
  }

  const isAgentOnline = agentBridge.getState() === 'AGENT_ONLINE';

  let agentStatus: any = null;
  if (isAgentOnline) {
    try {
      agentStatus = await agentBridge.getStatus(2000);
    } catch {
      agentStatus = null;
    }
  }

  const verifiedCpu = isAgentOnline && agentStatus?.cpu ? agentStatus.cpu : null;
  const verifiedGpu = officialGpu || (isAgentOnline && agentStatus?.gpu ? agentStatus.gpu : null);
  const verifiedRam = isAgentOnline && agentStatus?.ram ? agentStatus.ram : null;
  const verifiedStorage = isAgentOnline && agentStatus?.storage ? agentStatus.storage : null;
  const verifiedMobo = isAgentOnline && agentStatus?.motherboard ? agentStatus.motherboard : null;
  const verifiedBios = isAgentOnline && agentStatus?.bios_version ? agentStatus.bios_version : undefined;
  const verifiedSecureBoot = isAgentOnline && typeof agentStatus?.secure_boot === 'boolean' ? agentStatus.secure_boot : null;

  const offlineLabel = 'Aguardando dados do Agent';

  return {
    cpu: verifiedCpu || (isAgentOnline ? 'Não reportado pelo Agent' : offlineLabel),
    gpu: verifiedGpu || (isAgentOnline ? 'Não reportado pelo Agent' : offlineLabel),
    ram: verifiedRam || (isAgentOnline ? 'Não reportado pelo Agent' : 'N/D'),
    storage: verifiedStorage || 'N/D',
    motherboard: verifiedMobo || 'N/D',
    motherboard_chipset: undefined,
    bios_version: verifiedBios,
    resizable_bar: null,
    secure_boot: verifiedSecureBoot,
    xmp_profile: null,
    input_lag_ms: null,
    ram_frequency: null,
    gpu_clock_mhz: null,
    cpu_clock_mhz: null,
    cpu_power_w: null,
    cpu_temperature: null,
    gpu_temperature: null,
    gpu_power_w: null,
    gpu_memory_used_mb: null,
    gpu_memory_total_mb: null,
    ram_used_mb: null,
    ram_total_mb: null,
    fps: null,
    frametime_ms: null,
    gpu_latency_ms: null,
    active_process: null,
    active_game_pid: null,
    active_game_name: null,
    driver_version: null,
    windows_license: null,
    windows: agentStatus?.os || (isAgentOnline ? 'Windows' : 'Windows (Aguardando Agent)'),
    windows_version: 'N/D',
    build: 'N/D',
    device_id: agentStatus?.device_id || existingDevice?.device_id || 'DYARTE-PC-LOCAL',
    is_agent_connected: isAgentOnline,
    agent_version: isAgentOnline ? '1.0.0' : 'N/D',
    last_heartbeat: isAgentOnline ? 'Conectado' : 'Desconectado',
    cpu_usage_pct: null,
    gpu_usage_pct: null,
    ram_usage_pct: null,
    temp_c: null,
    ping_ms: pingMs,
  };
}
