import crypto from 'crypto';

// 32-byte Ed25519 signing keypair for server authorization
// Raw private key (hex) and public key (hex)
const SERVER_ED25519_PRIV_HEX =
  process.env.OPTIMIZATION_SIGNING_PRIVATE_KEY ||
  'ae7342e2403dcbc3891243b0a9be0a0f5a216eedb12161143cd6d8c8fa12e75e';

const PKCS8_HEADER = Buffer.from('302e020100300506032b657004220420', 'hex');
const privateKeyObject = crypto.createPrivateKey({
  key: Buffer.concat([PKCS8_HEADER, Buffer.from(SERVER_ED25519_PRIV_HEX, 'hex')]),
  format: 'der',
  type: 'pkcs8',
});

export interface OptimizationTokenPayload {
  tool_id: string;
  user_id: string;
  nonce: string;
  iat: number;
  exp: number;
}

/**
 * Generates an Ed25519 signed JWT-like authorization token for executing an optimization.
 * The token has a short lifetime (60 seconds) and binds the toolId, userId, and a unique nonce.
 */
export function generateOptimizationExecutionToken(
  toolId: string,
  userId: string,
  ttlSeconds: number = 60
): string {
  const now = Math.floor(Date.now() / 1000);
  const payloadObj: OptimizationTokenPayload = {
    tool_id: toolId,
    user_id: userId,
    nonce: crypto.randomBytes(8).toString('hex'),
    iat: now,
    exp: now + ttlSeconds,
  };

  const payloadStr = JSON.stringify(payloadObj);
  const payloadB64Url = Buffer.from(payloadStr, 'utf8').toString('base64url');

  // Sign raw payload bytes with Ed25519 private key
  const signature = crypto.sign(null, Buffer.from(payloadStr, 'utf8'), privateKeyObject);
  const sigB64Url = signature.toString('base64url');

  return `${payloadB64Url}.${sigB64Url}`;
}
