/**
 * DYARTE OPTIMIZER - DriverService
 * Camada de serviço do processo principal (Node/Electron) para gerenciamento e execução de drivers de GPU.
 * 
 * Arquitetura:
 * React UI -> Electron IPC -> Main Process -> DriverService -> Windows APIs / UAC
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

/**
 * Resolve o caminho centralizado da pasta de drivers.
 * - PRODUÇÃO / EMPACOTADO: process.resourcesPath/drivers
 * - DESENVOLVIMENTO: <raiz-do-projeto>/drivers
 */
function getDriversPath() {
  const isPackaged = process.resourcesPath && !process.defaultApp && (
    process.mainModule?.filename?.includes('resources') ||
    __dirname.includes('resources') ||
    fs.existsSync(path.join(process.resourcesPath, 'drivers'))
  );

  if (isPackaged) {
    const prodPath = path.join(process.resourcesPath, 'drivers');
    console.log('[DriverService] Modo PRODUÇÃO detectado. Caminho dos drivers:', prodPath);
    return prodPath;
  }

  // Em desenvolvimento, pasta drivers na raiz do projeto
  const devPath = path.resolve(__dirname, 'drivers');
  console.log('[DriverService] Modo DESENVOLVIMENTO detectado. Caminho dos drivers:', devPath);
  return devPath;
}

/**
 * Detecta o fabricante da GPU ativa no Windows através do WMI / CIM / PowerShell.
 * Retornos possíveis: 'AMD' | 'NVIDIA' | 'UNKNOWN'
 */
function detectGpuVendor() {
  console.log('[DriverService] [Hardware] Iniciando detecção de GPU do sistema...');

  // Se não estiver no Windows (ex: Linux no container de desenvolvimento)
  if (process.platform !== 'win32') {
    console.log('[DriverService] Plataforma não-Windows detectada (' + process.platform + '). Detecção nativa WMI não aplicável.');
    return {
      vendor: 'UNKNOWN',
      gpuNames: ['Plataforma de Desenvolvimento (' + process.platform + ')'],
      rawOutput: '',
    };
  }

  try {
    // Consulta Win32_VideoController via PowerShell
    const cmd = `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_VideoController | Select-Object -ExpandProperty Name"`;
    const output = execSync(cmd, { encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] });
    const lines = output.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    console.log('[DriverService] GPUs identificadas pelo Windows:', lines);

    let hasNvidia = false;
    let hasAmd = false;

    for (const line of lines) {
      const lower = line.toLowerCase();
      if (
        lower.includes('nvidia') ||
        lower.includes('geforce') ||
        lower.includes('rtx') ||
        lower.includes('gtx') ||
        lower.includes('quadro')
      ) {
        hasNvidia = true;
      }
      if (
        lower.includes('amd') ||
        lower.includes('radeon') ||
        lower.includes('advanced micro devices')
      ) {
        hasAmd = true;
      }
    }

    if (hasNvidia && !hasAmd) {
      console.log('[DriverService] Fabricante detectado: NVIDIA');
      return { vendor: 'NVIDIA', gpuNames: lines, rawOutput: lines.join(', ') };
    }

    if (hasAmd && !hasNvidia) {
      console.log('[DriverService] Fabricante detectado: AMD');
      return { vendor: 'AMD', gpuNames: lines, rawOutput: lines.join(', ') };
    }

    if (hasNvidia && hasAmd) {
      // Se tiver ambos (ex: CPU Ryzen com vídeo integrado + GPU dedicada NVIDIA)
      // Geralmente a dedicada NVIDIA é a primária para jogos/otimização
      console.log('[DriverService] Sistema híbrido AMD/NVIDIA detectado. Priorizando GPU dedicada NVIDIA para drivers de performance.');
      return { vendor: 'NVIDIA', gpuNames: lines, rawOutput: lines.join(', ') };
    }

    console.log('[DriverService] Nenhuma GPU AMD ou NVIDIA compatível foi identificada no WMI.');
    return { vendor: 'UNKNOWN', gpuNames: lines, rawOutput: lines.join(', ') };
  } catch (err) {
    console.error('[DriverService] Erro ao consultar Win32_VideoController via PowerShell:', err.message);
    return { vendor: 'UNKNOWN', gpuNames: [], rawOutput: err.message };
  }
}

/**
 * Procura automaticamente qualquer executável (.exe) válido dentro da pasta do fabricante.
 * Não depende de um nome fixo como Setup.exe.
 * 
 * @param {'AMD' | 'NVIDIA'} vendor 
 */
function findDriverInstaller(vendor) {
  if (vendor !== 'AMD' && vendor !== 'NVIDIA') {
    return {
      found: false,
      error: `Fabricante de driver inválido especificado: "${vendor}". Valores permitidos: AMD ou NVIDIA.`,
    };
  }

  const driversPath = getDriversPath();
  const vendorDir = path.join(driversPath, vendor);

  console.log(`[DriverService] Procurando instalador na pasta: ${vendorDir}`);

  if (!fs.existsSync(vendorDir)) {
    try {
      fs.mkdirSync(vendorDir, { recursive: true });
    } catch (e) {
      // ignore
    }
    return {
      found: false,
      vendorDir,
      error: `A pasta de drivers "${vendorDir}" não existia e foi criada agora. Nenhum instalador foi encontrado nela.`,
    };
  }

  let files = [];
  try {
    files = fs.readdirSync(vendorDir);
  } catch (err) {
    return {
      found: false,
      vendorDir,
      error: `Falha ao ler o diretório de drivers: ${err.message}`,
    };
  }

  // Filtra arquivos executáveis do Windows (.exe)
  const exeFiles = files.filter(f => f.toLowerCase().endsWith('.exe'));

  if (exeFiles.length === 0) {
    console.log(`[DriverService] Nenhum executável .exe encontrado em ${vendorDir}`);
    return {
      found: false,
      vendorDir,
      error: `Instalador do driver ${vendor} não encontrado na pasta "${vendorDir}". Coloque o arquivo .exe do instalador dentro desta pasta.`,
    };
  }

  // Seleciona o executável principal encontrado
  const selectedExe = exeFiles[0];
  const fullPath = path.join(vendorDir, selectedExe);
  let sizeMb = 0;

  try {
    const stats = fs.statSync(fullPath);
    sizeMb = (stats.size / (1024 * 1024)).toFixed(1);
  } catch (e) {
    // ignore
  }

  console.log(`[DriverService] Instalador localizado: ${selectedExe} (${sizeMb} MB) em ${fullPath}`);

  return {
    found: true,
    fileName: selectedExe,
    fullPath,
    vendorDir,
    sizeMb: Number(sizeMb),
  };
}

/**
 * Executa o instalador do driver com elevação UAC no Windows.
 * 
 * @param {'AMD' | 'NVIDIA'} vendor 
 * @param {{ allowSimulatedFallback?: boolean }} options 
 */
async function executeDriverInstaller(vendor, options = {}) {
  console.log(`[DriverService] ========================================`);
  console.log(`[DriverService] Solicitação de execução de driver: ${vendor}`);

  // 1. Detectar GPU do sistema
  const gpuDetection = detectGpuVendor();
  const detectedVendor = gpuDetection.vendor;

  console.log(`[DriverService] Hardware detectado: ${detectedVendor} (${gpuDetection.rawOutput})`);

  // Se não puder identificar o fabricante
  if (detectedVendor === 'UNKNOWN') {
    // Se estivermos em ambiente de desenvolvimento fora do Windows e a flag de teste for permitida
    if (process.platform !== 'win32' && options.allowSimulatedFallback) {
      console.log('[DriverService] [DEV/TEST] Ambiente não-Windows com fallback permitido para validação.');
    } else {
      const msg = 'A GPU deste computador não pôde ser identificada com segurança pelo subsistema do Windows. Por precaução de integridade do sistema operacional, nenhum instalador de driver foi executado.';
      console.error('[DriverService] Falha de segurança:', msg);
      return {
        success: false,
        phase: 'failed',
        error: msg,
        detectedVendor: 'UNKNOWN',
        gpuDetails: gpuDetection.rawOutput,
      };
    }
  }

  // 2. Verificar correspondência entre o driver clicado e o hardware real
  if (detectedVendor !== 'UNKNOWN' && detectedVendor !== vendor) {
    const msg = `Este driver (${vendor}) não corresponde à GPU detectada neste computador (${detectedVendor}: ${gpuDetection.rawOutput}). Operação bloqueada para evitar conflito de kernel no Windows.`;
    console.error('[DriverService] Incompatibilidade de hardware:', msg);
    return {
      success: false,
      phase: 'failed',
      error: msg,
      detectedVendor,
      gpuDetails: gpuDetection.rawOutput,
    };
  }

  // 3. Localizar instalador compatível na pasta
  const installerResult = findDriverInstaller(vendor);
  if (!installerResult.found) {
    console.error('[DriverService] Instalador não encontrado:', installerResult.error);
    return {
      success: false,
      phase: 'failed',
      error: installerResult.error,
      vendorDir: installerResult.vendorDir,
      detectedVendor,
    };
  }

  // 4. Executar instalador com elevação UAC no Windows
  const targetExe = installerResult.fullPath;
  console.log(`[DriverService] Solicitando elevação UAC para executar: "${targetExe}"...`);

  if (process.platform === 'win32') {
    try {
      // Escapa aspas no PowerShell
      const escapedPath = targetExe.replace(/'/g, "''");
      const workingDir = path.dirname(targetExe).replace(/'/g, "''");

      // PowerShell Start-Process com -Verb RunAs dispara nativamente a caixa do UAC do Windows
      const psScript = `Start-Process -FilePath '${escapedPath}' -WorkingDirectory '${workingDir}' -Verb RunAs`;
      const psArgs = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', psScript];

      const child = spawn('powershell.exe', psArgs, {
        detached: true,
        stdio: 'ignore',
      });

      child.unref();

      console.log(`[DriverService] Processo de instalação disparado com sucesso via UAC (PID: ${child.pid || 'ativo'}).`);

      return {
        success: true,
        phase: 'executing',
        fileName: installerResult.fileName,
        fullPath: installerResult.fullPath,
        sizeMb: installerResult.sizeMb,
        detectedVendor,
        message: `Instalação do driver ${vendor} iniciada com sucesso. Verifique o prompt de Administrador (UAC) na barra de tarefas do Windows.`,
      };
    } catch (execErr) {
      console.error('[DriverService] Erro ao disparar processo com UAC no Windows:', execErr.message);
      return {
        success: false,
        phase: 'failed',
        error: `Falha ao iniciar o processo do instalador com privilégios de Administrador: ${execErr.message}`,
      };
    }
  } else {
    // Ambiente de desenvolvimento (Linux/macOS)
    console.log(`[DriverService] [DEV/NON-WIN] Simulação de disparo concluída para: ${targetExe}`);
    return {
      success: true,
      phase: 'executing',
      fileName: installerResult.fileName,
      fullPath: installerResult.fullPath,
      sizeMb: installerResult.sizeMb,
      detectedVendor,
      message: `[Ambiente de Teste] Instalador ${installerResult.fileName} localizado e validado para execução no Windows.`,
    };
  }
}

/**
 * Retorna o status consolidado de drivers, pasta e GPU.
 */
function getDriverStatus() {
  const driversPath = getDriversPath();
  const gpuDetection = detectGpuVendor();
  const amdInstaller = findDriverInstaller('AMD');
  const nvidiaInstaller = findDriverInstaller('NVIDIA');

  return {
    driversPath,
    gpu: {
      vendor: gpuDetection.vendor,
      names: gpuDetection.gpuNames,
      raw: gpuDetection.rawOutput,
    },
    installers: {
      amd: amdInstaller,
      nvidia: nvidiaInstaller,
    },
  };
}

module.exports = {
  getDriversPath,
  detectGpuVendor,
  findDriverInstaller,
  executeDriverInstaller,
  getDriverStatus,
};
