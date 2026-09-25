import crypto from 'crypto';

export interface OptimizationTokenPayload {
  protocol_version: number;
  tool_id: string;
  user_id: string;
  device_id: string;
  nonce: string;
  iat: number;
  exp: number;
}

const PKCS8_HEADER = Buffer.from('302e020100300506032b657004220420', 'hex');
const SPKI_HEADER = Buffer.from('302a300506032b6570032100', 'hex');

// Official public key for DYARTE OPTIMIZER execution authority
export const SERVER_ED25519_PUB_HEX = '6412366338ce65c1d1f9792847def61e9b052d357ea26d5252d34c9c16aaf00d';

let cachedPrivateKey: crypto.KeyObject | null = null;
let cachedPublicKey: crypto.KeyObject | null = null;

/**
 * Validates and retrieves the server's Ed25519 signing private key.
 * CRITICAL SECURITY REQUIREMENT:
 * - Must be supplied via OPTIMIZATION_SIGNING_PRIVATE_KEY environment variable.
 * - Must be strictly 64 hex characters (32 raw bytes).
 * - NO fallback, NO auto-generation, NO default key in source code.
 */
export function getServerSigningPrivateKey(): crypto.KeyObject {
  if (cachedPrivateKey) {
    return cachedPrivateKey;
  }

  const rawKeyHex = (process.env.OPTIMIZATION_SIGNING_PRIVATE_KEY || '').trim();

  if (!rawKeyHex) {
    const errorMsg =
      '[FATAL SECURITY CONFIGURATION] A variável de ambiente OPTIMIZATION_SIGNING_PRIVATE_KEY não está configurada no servidor. ' +
      'O backend requer uma chave privada Ed25519 (64 hex characters) para emitir tokens de execução de otimização autorizados.';
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  if (rawKeyHex.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(rawKeyHex)) {
    const errorMsg =
      `[FATAL SECURITY CONFIGURATION] A chave OPTIMIZATION_SIGNING_PRIVATE_KEY possui formato inválido ` +
      `(esperado: 64 caracteres hexadecimais, recebido: ${rawKeyHex.length} caracteres).`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  try {
    cachedPrivateKey = crypto.createPrivateKey({
      key: Buffer.concat([PKCS8_HEADER, Buffer.from(rawKeyHex, 'hex')]),
      format: 'der',
      type: 'pkcs8',
    });
    return cachedPrivateKey;
  } catch (err: any) {
    const errorMsg = `[FATAL SECURITY CONFIGURATION] Falha ao instanciar chave privada Ed25519: ${err?.message || err}`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
}

/**
 * Returns the server's Ed25519 public key object for signature verification.
 */
export function getServerPublicKey(): crypto.KeyObject {
  if (cachedPublicKey) {
    return cachedPublicKey;
  }

  cachedPublicKey = crypto.createPublicKey({
    key: Buffer.concat([SPKI_HEADER, Buffer.from(SERVER_ED25519_PUB_HEX, 'hex')]),
    format: 'der',
    type: 'spki',
  });
  return cachedPublicKey;
}

/**
 * Validates the server signing configuration on startup.
 * Throws explicit fatal error if configuration is absent or invalid.
 */
export function validateServerSigningConfiguration(): void {
  // Accessing the private key triggers all format and crypto validations
  getServerSigningPrivateKey();
  getServerPublicKey();
}

/**
 * Generates an Ed25519 signed authorization token for executing an optimization.
 * The token has a short lifetime (default: 60 seconds) and binds:
 * - protocol_version (1)
 * - tool_id
 * - user_id
 * - device_id
 * - cryptographically secure random nonce
 * - iat & exp timestamps
 */
export function generateOptimizationExecutionToken(
  toolId: string,
  userId: string,
  deviceId: string = 'N/D',
  ttlSeconds: number = 60
): string {
  const privateKey = getServerSigningPrivateKey();
  const now = Math.floor(Date.now() / 1000);

  const payloadObj: OptimizationTokenPayload = {
    protocol_version: 1,
    tool_id: toolId,
    user_id: userId,
    device_id: deviceId,
    nonce: crypto.randomBytes(16).toString('hex'),
    iat: now,
    exp: now + ttlSeconds,
  };

  const payloadStr = JSON.stringify(payloadObj);
  const payloadB64Url = Buffer.from(payloadStr, 'utf8').toString('base64url');

  // Sign raw payload bytes with Ed25519 private key
  const signature = crypto.sign(null, Buffer.from(payloadStr, 'utf8'), privateKey);
  const sigB64Url = signature.toString('base64url');

  return `${payloadB64Url}.${sigB64Url}`;
}

export interface TokenVerificationResult {
  valid: boolean;
  payload?: OptimizationTokenPayload;
  error_code?: string;
  error?: string;
}

/**
 * Verifies an Ed25519 signed optimization token.
 */
export function verifyOptimizationExecutionToken(
  tokenStr: string,
  expectedToolId?: string,
  expectedDeviceId?: string,
  clockSkewSeconds: number = 15
): TokenVerificationResult {
  if (!tokenStr || typeof tokenStr !== 'string') {
    return { valid: false, error_code: 'INVALID_TOKEN', error: 'Token ausente ou formato inválido.' };
  }

  const dotIdx = tokenStr.indexOf('.');
  if (dotIdx === -1) {
    return { valid: false, error_code: 'INVALID_TOKEN', error: 'Delimitador de assinatura ausente.' };
  }

  const payloadB64 = tokenStr.substring(0, dotIdx);
  const sigB64 = tokenStr.substring(dotIdx + 1);

  let payloadBuf: Buffer;
  let sigBuf: Buffer;
  try {
    payloadBuf = Buffer.from(payloadB64, 'base64url');
    sigBuf = Buffer.from(sigB64, 'base64url');
  } catch {
    return { valid: false, error_code: 'INVALID_TOKEN', error: 'Falha na decodificação Base64URL.' };
  }

  if (sigBuf.length !== 64) {
    return { valid: false, error_code: 'INVALID_TOKEN', error: 'Comprimento de assinatura Ed25519 inválido.' };
  }

  const pubKey = getServerPublicKey();
  const sigOk = crypto.verify(null, payloadBuf, pubKey, sigBuf);
  if (!sigOk) {
    return { valid: false, error_code: 'TOKEN_SIGNATURE_INVALID', error: 'Assinatura criptográfica rejeitada.' };
  }

  let payload: OptimizationTokenPayload;
  try {
    payload = JSON.parse(payloadBuf.toString('utf8'));
  } catch {
    return { valid: false, error_code: 'INVALID_TOKEN', error: 'Payload do token não é JSON válido.' };
  }

  if (payload.protocol_version !== 1) {
    return { valid: false, error_code: 'PROTOCOL_MISMATCH', error: 'Versão de protocolo inválida no token.' };
  }

  if (expectedToolId && payload.tool_id !== expectedToolId) {
    return { valid: false, error_code: 'TOKEN_TOOL_MISMATCH', error: 'Ferramenta autorizada no token diverge da solicitada.' };
  }

  if (expectedDeviceId && payload.device_id && payload.device_id !== 'N/D' && expectedDeviceId !== 'N/D' && payload.device_id !== expectedDeviceId) {
    return { valid: false, error_code: 'DEVICE_MISMATCH', error: 'Dispositivo autorizado no token diverge do dispositivo atual.' };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (payload.exp < (nowSec - clockSkewSeconds)) {
    return { valid: false, error_code: 'TOKEN_EXPIRED', error: 'Token de execução expirado.' };
  }

  return { valid: true, payload };
}
