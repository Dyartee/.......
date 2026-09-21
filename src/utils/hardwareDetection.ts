import { DeviceInfo } from '../types';

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
 * Constrói as especificações do dispositivo respeitando a hierarquia de fontes:
 * 1. Electron IPC (WMI nativo do Windows)
 * 2. Dados reais persistidos anteriormente (sem valores de mock)
 * 3. Browser APIs (explicitamente identificadas como navegador)
 * 4. N/D para qualquer dado não verificado
 */
export async function detectFullComputerSpecs(existingDevice?: DeviceInfo): Promise<DeviceInfo> {
  const cpuInfo = detectRealCPU();
  const browserGpu = detectRealGPU();
  const ramInfo = detectRealRAM();
  const osInfo = detectRealOS();

  // Teste de latência real com backend local
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
  let officialGpu = 'N/D';
  if (typeof window !== 'undefined' && window.dyarte?.drivers?.detectGpuVendor) {
    try {
      const detection = await window.dyarte.drivers.detectGpuVendor();
      if (detection?.gpuNames && detection.gpuNames.length > 0) {
        officialGpu = detection.gpuNames.join(' / ');
      }
    } catch {
      // ignore
    }
  }

  const chosenGpu =
    officialGpu !== 'N/D'
      ? officialGpu
      : existingDevice?.gpu && existingDevice.gpu !== 'N/D'
      ? existingDevice.gpu
      : browserGpu;

  const chosenCpu =
    existingDevice?.cpu && existingDevice.cpu !== 'N/D'
      ? existingDevice.cpu
      : cpuInfo.name;

  const chosenRam =
    existingDevice?.ram && existingDevice.ram !== 'N/D'
      ? existingDevice.ram
      : ramInfo.formatted;

  return {
    cpu: chosenCpu,
    gpu: chosenGpu,
    ram: chosenRam,
    storage: existingDevice?.storage && existingDevice.storage !== 'N/D' ? existingDevice.storage : 'N/D',
    motherboard: existingDevice?.motherboard && existingDevice.motherboard !== 'N/D' ? existingDevice.motherboard : 'N/D',
    motherboard_chipset: existingDevice?.motherboard_chipset || undefined,
    bios_version: existingDevice?.bios_version || undefined,
    resizable_bar: existingDevice?.resizable_bar ?? null,
    secure_boot: existingDevice?.secure_boot ?? null,
    xmp_profile: existingDevice?.xmp_profile ?? null,
    input_lag_ms: existingDevice?.input_lag_ms ?? null,
    ram_frequency: existingDevice?.ram_frequency ?? null,
    gpu_clock_mhz: existingDevice?.gpu_clock_mhz ?? null,
    cpu_clock_mhz: existingDevice?.cpu_clock_mhz ?? null,
    cpu_power_w: existingDevice?.cpu_power_w ?? null,
    cpu_temperature: existingDevice?.cpu_temperature ?? null,
    gpu_temperature: existingDevice?.gpu_temperature ?? null,
    gpu_power_w: existingDevice?.gpu_power_w ?? null,
    gpu_memory_used_mb: existingDevice?.gpu_memory_used_mb ?? null,
    gpu_memory_total_mb: existingDevice?.gpu_memory_total_mb ?? null,
    ram_used_mb: existingDevice?.ram_used_mb ?? null,
    ram_total_mb: existingDevice?.ram_total_mb ?? null,
    fps: existingDevice?.fps ?? null,
    frametime_ms: existingDevice?.frametime_ms ?? null,
    gpu_latency_ms: existingDevice?.gpu_latency_ms ?? null,
    active_process: existingDevice?.active_process ?? null,
    active_game_pid: existingDevice?.active_game_pid ?? null,
    active_game_name: existingDevice?.active_game_name ?? null,
    driver_version: existingDevice?.driver_version ?? null,
    windows_license: existingDevice?.windows_license ?? null,
    windows: existingDevice?.windows && existingDevice.windows !== 'N/D' ? existingDevice.windows : osInfo.name,
    windows_version: existingDevice?.windows_version && existingDevice.windows_version !== 'N/D' ? existingDevice.windows_version : osInfo.version,
    build: existingDevice?.build && existingDevice.build !== 'N/D' ? existingDevice.build : osInfo.build,
    device_id: existingDevice?.device_id && existingDevice.device_id !== 'N/D' ? existingDevice.device_id : `DYARTE-PC-${Date.now().toString(36).toUpperCase()}`,
    is_agent_connected: Boolean(existingDevice?.is_agent_connected),
    agent_version: existingDevice?.is_agent_connected ? (existingDevice.agent_version || '1.0.0') : 'N/D',
    last_heartbeat: existingDevice?.is_agent_connected ? (existingDevice.last_heartbeat || 'Conectado') : 'Desconectado',
    cpu_usage_pct: existingDevice?.cpu_usage_pct ?? null,
    gpu_usage_pct: existingDevice?.gpu_usage_pct ?? null,
    ram_usage_pct: existingDevice?.ram_usage_pct ?? null,
    temp_c: existingDevice?.temp_c ?? null,
    ping_ms: pingMs,
  };
}
