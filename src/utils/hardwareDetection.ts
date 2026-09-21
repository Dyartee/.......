import { DeviceInfo } from '../types';

/**
 * Clean up the GPU name from WebGL unmasked renderer string
 */
export function cleanGpuRenderer(raw: string): string {
  if (!raw || !raw.trim()) return 'N/D';
  let cleaned = raw;

  // Format: "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)"
  // or "ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)"
  // or "ANGLE (Apple, Apple M2 Max, OpenGL 4.1)"
  if (cleaned.includes('ANGLE (')) {
    const parts = cleaned.match(/ANGLE \([^,]+,\s*([^,]+)/);
    if (parts && parts[1]) {
      cleaned = parts[1].trim();
    } else {
      cleaned = cleaned.replace(/^ANGLE \(/, '').replace(/\)$/, '');
    }
  }

  // Remove redundant "(R)", "(TM)" for cleaner presentation
  cleaned = cleaned.replace(/\(R\)/gi, '').replace(/\(TM\)/gi, '').trim();

  return cleaned || 'N/D';
}

/**
 * Inspect client GPU via WebGL context
 */
export function detectRealGPU(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl') ||
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);

    if (!gl) {
      return 'N/D';
    }

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) {
      return 'N/D';
    }

    const unmasked = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
    return cleanGpuRenderer(String(unmasked));
  } catch (err) {
    console.warn('Hardware GPU detection error:', err);
    return 'N/D';
  }
}

/**
 * Detect real CPU Cores and Architecture
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
    name: `${cores} Núcleos Lógicos (${arch})`,
    cores,
    arch,
  };
}

/**
 * Detect client RAM in GB (Supported on Chrome, Edge, Opera, Chromium)
 */
export function detectRealRAM(): {
  gb: number;
  formatted: string;
} {
  const nav = typeof navigator !== 'undefined' ? (navigator as any) : {};
  const deviceMem = nav.deviceMemory; // in GB: e.g. 8, 16, 32

  if (deviceMem && typeof deviceMem === 'number') {
    return {
      gb: deviceMem,
      formatted: `${deviceMem} GB RAM (Navegador)`,
    };
  }

  return {
    gb: 0,
    formatted: 'N/D',
  };
}

/**
 * Detect Windows version or client OS
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
    version = 'Edição 64-bit';
    build = 'Kernel NT 10.0';
  } else if (ua.includes('Windows NT 6.3')) {
    name = 'Windows 8.1';
    version = '64-bit';
    build = 'Kernel NT 6.3';
  } else if (ua.includes('Windows NT 6.1')) {
    name = 'Windows 7';
    version = 'SP1';
    build = 'Kernel NT 6.1';
  } else if (ua.includes('Macintosh') || ua.includes('Mac OS X')) {
    name = 'macOS';
    version = 'Darwin';
    build = 'Darwin x64';
  } else if (ua.includes('Linux')) {
    name = 'Linux';
    version = 'GNU/Linux';
    build = 'Kernel 6.x';
  }

  return { name, version, build };
}

/**
 * Detect Screen / Monitor resolution
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
 * Build a complete real DeviceInfo object detected from the user's computer
 */
export async function detectFullComputerSpecs(existingDevice?: DeviceInfo): Promise<DeviceInfo> {
  const cpuInfo = detectRealCPU();
  const realGpu = detectRealGPU();
  const ramInfo = detectRealRAM();
  const osInfo = detectRealOS();

  // Try storage estimate
  let storageStr = 'N/D';
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      if (estimate.quota) {
        const totalGb = Math.round(estimate.quota / (1024 * 1024 * 1024));
        if (totalGb > 0) {
          storageStr = `${totalGb} GB Armazenamento Alocado (Navegador)`;
        }
      }
    } catch {
      // ignore
    }
  }

  if (
    storageStr === 'N/D' &&
    existingDevice?.storage &&
    existingDevice.storage !== 'N/D' &&
    !existingDevice.storage.includes('Kingston KC3000') &&
    !existingDevice.storage.includes('512 GB SSD NVMe')
  ) {
    storageStr = existingDevice.storage;
  }

  // Real Ping test to local backend
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

  const cleanCpu =
    existingDevice?.cpu &&
    existingDevice.cpu !== 'N/D' &&
    !existingDevice.cpu.includes('Ryzen 5 5600')
      ? existingDevice.cpu
      : cpuInfo.name;

  const cleanGpu =
    existingDevice?.gpu &&
    existingDevice.gpu !== 'N/D' &&
    !existingDevice.gpu.includes('RTX 3060 12GB')
      ? existingDevice.gpu
      : realGpu;

  const cleanRam =
    existingDevice?.ram &&
    existingDevice.ram !== 'N/D' &&
    !existingDevice.ram.includes('2x8GB @ 3200MHz')
      ? existingDevice.ram
      : ramInfo.formatted;

  const cleanMotherboard =
    existingDevice?.motherboard &&
    existingDevice.motherboard !== 'N/D' &&
    !existingDevice.motherboard.includes('ASUS TUF') &&
    !existingDevice.motherboard.includes('Host')
      ? existingDevice.motherboard
      : 'N/D';

  return {
    cpu: cleanCpu,
    gpu: cleanGpu,
    ram: cleanRam,
    storage: storageStr,
    motherboard: cleanMotherboard,
    motherboard_chipset: existingDevice?.motherboard_chipset,
    bios_version: existingDevice?.bios_version,
    resizable_bar: existingDevice?.resizable_bar ?? null,
    secure_boot: existingDevice?.secure_boot ?? null,
    xmp_profile: existingDevice?.xmp_profile ?? null,
    input_lag_ms: existingDevice?.input_lag_ms ?? null,
    ram_frequency: existingDevice?.ram_frequency ?? null,
    gpu_clock_mhz: existingDevice?.gpu_clock_mhz ?? null,
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
