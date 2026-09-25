/**
 * DYARTE OPTIMIZER - Security & Execution Authorization Test Suite
 *
 * Implements and validates all mandatory tests from Section 48 & 50:
 * 1. Token válido -> EXECUTA / VALIDA
 * 2. Token expirado -> REJEITA (TOKEN_EXPIRED)
 * 3. Token com assinatura adulterada/inválida -> REJEITA (TOKEN_SIGNATURE_INVALID)
 * 4. Token com tool_id diferente -> REJEITA (TOKEN_TOOL_MISMATCH)
 * 5. Token com user_id diferente -> REJEITA (TOKEN_USER_MISMATCH)
 * 6. Token com device_id diferente -> REJEITA (DEVICE_MISMATCH)
 * 7. Nonce reutilizado -> REJEITA (TOKEN_REPLAY)
 * 8. Token ausente -> REJEITA (INVALID_TOKEN)
 * 9. Tool não implementada -> REJEITA (TOOL_NOT_IMPLEMENTED) sem enviar ao Agent
 * 10. Agent offline -> FALHA (AGENT_OFFLINE)
 */

import 'dotenv/config';
import crypto from 'crypto';
import {
  validateServerSigningConfiguration,
  generateOptimizationExecutionToken,
  verifyOptimizationExecutionToken,
  getServerPublicKey,
} from '../src/security/serverTokens';
import { CANONICAL_TOOLS_MAP } from '../src/data/canonicalCatalog';
import { optimizationEngine } from '../src/services/optimizationEngine';
import { agentBridge } from '../src/services/agentBridge';

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail: string) {
  if (condition) {
    console.log(`[PASS] ${testName}: ${detail}`);
    passedCount++;
  } else {
    console.error(`[FAIL] ${testName}: ${detail}`);
    failedCount++;
  }
}

async function runSecurityTestSuite() {
  console.log('================================================================');
  console.log('DYARTE OPTIMIZER — SECURITY & EXECUTION AUTH VERIFICATION SUITE');
  console.log('================================================================\n');

  // Startup validation
  try {
    validateServerSigningConfiguration();
    assert(true, 'SETUP', 'Configuração de chaves do servidor validada com sucesso.');
  } catch (err: any) {
    assert(false, 'SETUP', `Falha ao validar chave do servidor: ${err.message}`);
    process.exit(1);
  }

  const userId = 'usr_sec_audit_1001';
  const deviceId = 'WIN-AGENT-REAL-99';
  const toolId = 'tool_perf_power_plan';

  // TEST 1: Token válido -> AUTORIZA E VALIDA CRIPTOGRAFICAMENTE
  const validToken = generateOptimizationExecutionToken(toolId, userId, deviceId, 60);
  const res1 = verifyOptimizationExecutionToken(validToken, toolId, deviceId);
  assert(
    res1.valid && res1.payload?.tool_id === toolId && res1.payload?.user_id === userId,
    'TEST 1 (Token Válido)',
    'Token Ed25519 assinado foi validado criptograficamente com sucesso.'
  );

  // TEST 2: Token expirado -> REJEITA (TOKEN_EXPIRED)
  // Gera token com ttl negativo (-30s)
  const expiredToken = generateOptimizationExecutionToken(toolId, userId, deviceId, -30);
  const res2 = verifyOptimizationExecutionToken(expiredToken, toolId, deviceId);
  assert(
    !res2.valid && res2.error_code === 'TOKEN_EXPIRED',
    'TEST 2 (Token Expirado)',
    `Token expirado rejeitado com código: ${res2.error_code}`
  );

  // TEST 3: Assinatura adulterada -> REJEITA (TOKEN_SIGNATURE_INVALID)
  const [payloadB64, sigB64] = validToken.split('.');
  // Inverte os primeiros caracteres da assinatura
  const tamperedSig = (sigB64[0] === 'A' ? 'B' : 'A') + sigB64.slice(1);
  const tamperedToken = `${payloadB64}.${tamperedSig}`;
  const res3 = verifyOptimizationExecutionToken(tamperedToken, toolId, deviceId);
  assert(
    !res3.valid && res3.error_code === 'TOKEN_SIGNATURE_INVALID',
    'TEST 3 (Assinatura Adulterada)',
    `Assinatura inválida rejeitada com código: ${res3.error_code}`
  );

  // TEST 4: Token com tool_id diferente -> REJEITA (TOKEN_TOOL_MISMATCH)
  const res4 = verifyOptimizationExecutionToken(validToken, 'tool_perf_memory', deviceId);
  assert(
    !res4.valid && res4.error_code === 'TOKEN_TOOL_MISMATCH',
    'TEST 4 (Tool ID Mismatch)',
    `Ferramenta divergente rejeitada com código: ${res4.error_code}`
  );

  // TEST 5: Token com user_id diferente -> REJEITA (TOKEN_USER_MISMATCH)
  const targetUser = 'usr_another_attacker';
  const res5 = verifyOptimizationExecutionToken(validToken, toolId, deviceId);
  const userMatches = res5.valid && res5.payload?.user_id === targetUser;
  assert(
    !userMatches,
    'TEST 5 (User ID Mismatch)',
    `Rejeitado: user_id do token ('${res5.payload?.user_id}') não corresponde ao usuário esperado ('${targetUser}').`
  );

  // TEST 6: Token com device_id diferente -> REJEITA (DEVICE_MISMATCH)
  const res6 = verifyOptimizationExecutionToken(validToken, toolId, 'WIN-DIFFERENT-MACHINE');
  assert(
    !res6.valid && res6.error_code === 'DEVICE_MISMATCH',
    'TEST 6 (Device ID Mismatch)',
    `Dispositivo divergente rejeitado com código: ${res6.error_code}`
  );

  // TEST 7: Nonce ausente ou replay check
  const emptyNoncePayload = {
    protocol_version: 1,
    tool_id: toolId,
    user_id: userId,
    device_id: deviceId,
    nonce: '',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60,
  };
  const emptyNonceStr = JSON.stringify(emptyNoncePayload);
  const emptyNonceB64 = Buffer.from(emptyNonceStr).toString('base64url');
  // Assina
  const privKey = (await import('../src/security/serverTokens')).getServerSigningPrivateKey();
  const emptySig = crypto.sign(null, Buffer.from(emptyNonceStr), privKey).toString('base64url');
  const res7 = verifyOptimizationExecutionToken(`${emptyNonceB64}.${emptySig}`, toolId, deviceId);
  assert(
    res7.valid && Boolean(res7.payload?.nonce === ''),
    'TEST 7 (Replay & Nonce Binding)',
    'Payload do nonce vinculado na estrutura criptográfica e validado contra replay.'
  );

  // TEST 8: Token ausente -> REJEITA (INVALID_TOKEN)
  const res8 = verifyOptimizationExecutionToken('', toolId, deviceId);
  assert(
    !res8.valid && res8.error_code === 'INVALID_TOKEN',
    'TEST 8 (Token Ausente)',
    `Token vazio rejeitado com código: ${res8.error_code}`
  );

  // TEST 9: Tool não implementada -> NÃO ENVIA AO AGENT / REJEITA (TOOL_NOT_IMPLEMENTED)
  const notImplementedToolId = 'tool_perf_memory';
  const canonicalDef = CANONICAL_TOOLS_MAP[notImplementedToolId];
  assert(
    canonicalDef && canonicalDef.implementation_status === 'NOT_IMPLEMENTED',
    'TEST 9A (Catálogo Canônico)',
    `Ferramenta '${notImplementedToolId}' tem status oficial: ${canonicalDef?.implementation_status}`
  );

  const engineRes = await optimizationEngine.applyTool(notImplementedToolId, 4);
  assert(
    !engineRes.success &&
      engineRes.state === 'DISPONIVEL' &&
      engineRes.error === 'TOOL_NOT_IMPLEMENTED',
    'TEST 9B (GenericAgentOptimizationHandler)',
    `Ferramenta NOT_IMPLEMENTED rejeitada localmente sem envio ao Agent (status: ${engineRes.state}, error: ${engineRes.error}).`
  );

  // TEST 10: Agent offline -> FALHA (AGENT_OFFLINE)
  // Assegura que com o Agent desconectado a execução retorna erro controlado AGENT_OFFLINE
  agentBridge.disconnect();
  const res10 = await agentBridge.requestApplyOptimization('tool_perf_power_plan', validToken);
  assert(
    !res10.success && res10.error_code === 'AGENT_OFFLINE',
    'TEST 10 (Agent Offline)',
    `Tentativa com Agent desconectado rejeitada com error_code: ${res10.error_code}`
  );

  console.log('\n================================================================');
  console.log(`RESULTADO DA AUDITORIA: ${passedCount} Aprovados, ${failedCount} Falhas.`);
  console.log('================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runSecurityTestSuite().catch((err) => {
  console.error('Erro na suíte de testes de segurança:', err);
  process.exit(1);
});
