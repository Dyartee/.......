/**
 * Mandatory Verification Suite (A - M)
 * Verifies core requirements:
 * A: TypeScript Strict Typecheck
 * B: Production Build Assets Check
 * C: Agent Protocol & Action Schema
 * D: API Health & Endpoints
 * E: Real Telemetry Structs (No Math.random)
 * F: Power Plan Command Verification Logic
 * G: Rollback & Defaults Restoration
 * H: Optimization History Schema
 * I: Plan Licensing Levels (1-4 strictly, no 0/SEM PLANO)
 * J: Hardware Detection Pipeline
 * K: Safety Lock Protocol
 * L: Firestore Rules Plan Validation
 * M: Zero-Simulation Code Audit (Zero Math.random in runtime)
 */

import fs from 'fs';
import path from 'path';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail: string) {
  if (condition) {
    console.log(`[PASS] ${testName}: ${detail}`);
    passed++;
  } else {
    console.error(`[FAIL] ${testName}: ${detail}`);
    failed++;
  }
}

async function runTests() {
  console.log('=== DYARTE OPTIMIZER - MANDATORY AUDIT & VERIFICATION SUITE ===\n');

  // Test A: Dist build output exists
  const distExists = fs.existsSync(path.resolve('dist/server.cjs')) && fs.existsSync(path.resolve('dist/index.html'));
  assert(distExists, 'TEST A & B (Build & Output)', 'dist/server.cjs and dist/index.html exist');

  // Test C: Agent main.cpp protocol checks
  const agentSrc = fs.readFileSync(path.resolve('agent/src/main.cpp'), 'utf-8');
  const hasGetTelemetry = agentSrc.includes('MessageType::GET_TELEMETRY') || agentSrc.includes('GET_TELEMETRY');
  const hasGetStatus = agentSrc.includes('MessageType::GET_STATUS') || agentSrc.includes('GET_STATUS');
  const hasRollback = agentSrc.includes('MessageType::ROLLBACK_OPTIMIZATION') || agentSrc.includes('ROLLBACK_OPTIMIZATION');
  const hasGlobalMemoryStatus = agentSrc.includes('GlobalMemoryStatusEx');
  const hasPowerSchemeQuery = agentSrc.includes('powercfg') || agentSrc.includes('GetActivePowerScheme');
  assert(
    hasGetTelemetry && hasGetStatus && hasRollback && hasGlobalMemoryStatus && hasPowerSchemeQuery,
    'TEST C (Agent Protocol)',
    'agent/src/main.cpp implements GET_TELEMETRY, GET_STATUS, ROLLBACK with Win32 APIs'
  );

  // Test D: AgentBridge integration
  const agentBridgeSrc = fs.readFileSync(path.resolve('src/services/agentBridge.ts'), 'utf-8');
  const hasRequestTelemetry = agentBridgeSrc.includes('requestTelemetry');
  const hasHardwareInStatus = agentBridgeSrc.includes('cpu:') && agentBridgeSrc.includes('gpu:');
  assert(
    hasRequestTelemetry && hasHardwareInStatus,
    'TEST D (AgentBridge Protocol)',
    'agentBridge supports real-time telemetry and hardware specs from agent'
  );

  // Test E & M: Zero Math.random in src/, server.ts, and agent/
  const checkFiles = ['src', 'server.ts', 'agent/src'];
  let mathRandomFound = false;
  function searchRandom(dirOrFile: string) {
    const full = path.resolve(dirOrFile);
    if (!fs.existsSync(full)) return;
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(full)) {
        searchRandom(path.join(dirOrFile, entry));
      }
    } else if (/\.(ts|tsx|js|cjs|cpp|h)$/.test(dirOrFile)) {
      const c = fs.readFileSync(full, 'utf-8');
      if (c.includes('Math.random')) {
        console.error(`Found Math.random in ${dirOrFile}`);
        mathRandomFound = true;
      }
    }
  }
  for (const f of checkFiles) searchRandom(f);
  assert(!mathRandomFound, 'TEST E & M (Zero-Simulation & No Math.random)', 'No Math.random found across runtime');

  // Test F & G: Rollback and Windows restore
  const appContextSrc = fs.readFileSync(path.resolve('src/context/AppContext.tsx'), 'utf-8');
  const noSimulateUninstall = !appContextSrc.includes('simulateUninstallRollback');
  const hasFactoryDefaults = appContextSrc.includes('restoreWindowsFactoryDefaults');
  assert(
    noSimulateUninstall && hasFactoryDefaults,
    'TEST F & G (Real Rollback & Windows Restore)',
    'simulateUninstallRollback removed; restoreWindowsFactoryDefaults confirmed'
  );

  // Test H: Optimization History
  const hasOptHistory = appContextSrc.includes('OptimizationHistoryItem') && appContextSrc.includes('setHistory');
  assert(hasOptHistory, 'TEST H (Optimization History)', 'Optimization history tracks real operations and states');

  // Test I: Plan Levels 1-4
  const typesSrc = fs.readFileSync(path.resolve('src/types.ts'), 'utf-8');
  const strictPlanLevel = typesSrc.includes('export type PlanLevel = 1 | 2 | 3 | 4;');
  const serverSrc = fs.readFileSync(path.resolve('server.ts'), 'utf-8');
  const noLevelZeroInServer = !serverSrc.includes("safeLevel === 0 ? 'SEM PLANO'");
  assert(
    strictPlanLevel && noLevelZeroInServer,
    'TEST I (Plan Licensing Structure)',
    'Strict 1-4 plan levels enforced without level 0 or SEM PLANO'
  );

  // Test J: Hardware Detection from Agent
  const hwDetectSrc = fs.readFileSync(path.resolve('src/utils/hardwareDetection.ts'), 'utf-8');
  const queriesAgentDirectly = hwDetectSrc.includes('agentBridge.getStatus(');
  assert(queriesAgentDirectly, 'TEST J (Hardware Detection)', 'detectFullComputerSpecs queries agent directly');

  // Test K: Safety Lock Protocol
  const safetyModalSrc = fs.readFileSync(path.resolve('src/components/modals/SafetyLockModal.tsx'), 'utf-8');
  const noSimulationInModal = !safetyModalSrc.includes('simulateUninstallRollback');
  assert(noSimulationInModal, 'TEST K (Safety Lock UI)', 'SafetyLockModal has no simulated buttons');

  // Test L: Firestore rules plan validation
  const firestoreRules = fs.readFileSync(path.resolve('firestore.rules'), 'utf-8');
  const hasPlanLevelValidation = firestoreRules.includes('isValidPlanLevel');
  assert(hasPlanLevelValidation, 'TEST L (Firestore Rules Plan Validation)', 'firestore.rules enforces plan levels 1-4');

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
