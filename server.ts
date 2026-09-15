import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { initializeApp, getApps, App as AdminApp } from 'firebase-admin/app';
import { getAuth, DecodedIdToken } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import firebaseConfig from './firebase-applet-config.json';

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Firebase Admin SDK
let adminApp: AdminApp;
if (!getApps().length) {
  adminApp = initializeApp({
    projectId: firebaseConfig.projectId,
  });
} else {
  adminApp = getApps()[0];
}

const adminAuth = getAuth(adminApp);
const adminDb: Firestore = getFirestore(adminApp, firebaseConfig.firestoreDatabaseId);

// In-Memory Simple Rate Limiting Map
const rateLimitMap = new Map<string, { count: number; firstRequest: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_AUTH_REQUESTS = 60; // 60 requests per minute per IP

function rateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const key = `${ip}_${req.path}`;
  const now = Date.now();
  const record = rateLimitMap.get(key as string);

  if (!record) {
    rateLimitMap.set(key as string, { count: 1, firstRequest: now });
    return next();
  }

  if (now - record.firstRequest < RATE_LIMIT_WINDOW_MS) {
    if (record.count >= MAX_AUTH_REQUESTS) {
      return res.status(429).json({
        error: 'Muitas requisições em pouco tempo. Por favor, aguarde um momento antes de tentar novamente.',
      });
    }
    record.count++;
    return next();
  }

  // Reset window
  rateLimitMap.set(key as string, { count: 1, firstRequest: now });
  return next();
}

// Apply rate limiter to all API endpoints
app.use('/api', rateLimiter);

// Canonical Tools Catalog on Backend Authority (Frontend parameters are not trusted)
const CANONICAL_TOOLS: Record<string, { name: string; category: string; required_plan_level: number }> = {
  tool_sys_win_opt: { name: 'Otimização Básica do Windows', category: 'SISTEMA', required_plan_level: 2 },
  tool_sys_cleanup: { name: 'Limpeza de Arquivos Temporários', category: 'SISTEMA', required_plan_level: 2 },
  tool_sys_startup: { name: 'Ajustes Básicos de Inicialização', category: 'SISTEMA', required_plan_level: 2 },
  tool_sys_proc_manager: { name: 'Redução de Processos Desnecessários', category: 'SISTEMA', required_plan_level: 2 },
  tool_sys_stability: { name: 'Ajustes de Estabilidade do Kernel', category: 'SISTEMA', required_plan_level: 2 },
  tool_sys_advanced_tweaks: { name: 'Otimizações Avançadas do Windows', category: 'SISTEMA', required_plan_level: 3 },
  tool_perf_cpu_basic: { name: 'Desempenho Básico de CPU', category: 'DESEMPENHO', required_plan_level: 1 },
  tool_perf_power_plan: { name: 'Plano de Energia de Alta Performance', category: 'DESEMPENHO', required_plan_level: 2 },
  tool_perf_ram_opt: { name: 'Otimização Inteligente de Memória RAM', category: 'DESEMPENHO', required_plan_level: 2 },
  tool_perf_latency_settings: { name: 'Configurações de Latência & Timer Resolution', category: 'DESEMPENHO', required_plan_level: 3 },
  tool_perf_dpc_latency: { name: 'Ajustes Avançados de Latência DPC', category: 'DESEMPENHO', required_plan_level: 4 },
  tool_perf_queue_depth: { name: 'Redução da Fila de Comandos do Kernel', category: 'DESEMPENHO', required_plan_level: 4 },
  tool_game_fps_tweaks: { name: 'Ajustes de Frametime em Jogos', category: 'GAMING', required_plan_level: 3 },
  tool_game_low_latency: { name: 'Modo Gamer de Baixa Latência', category: 'GAMING', required_plan_level: 3 },
  tool_game_frame_consistency: { name: 'Consistência de Quadros Avançada', category: 'GAMING', required_plan_level: 4 },
  tool_game_extreme_suite: { name: 'Suite Exclusiva DYARTE Extreme', category: 'GAMING', required_plan_level: 4 },
  tool_gpu_profile_opt: { name: 'Perfis Otimizados de GPU', category: 'GPU', required_plan_level: 3 },
  tool_gpu_amd_driver: { name: 'AMD Driver Optimized', category: 'GPU', required_plan_level: 3 },
  tool_gpu_nvidia_driver: { name: 'NVIDIA Driver Optimized', category: 'GPU', required_plan_level: 3 },
};

// Extended Request interface with authenticated user
export interface AuthenticatedRequest extends Request {
  user?: DecodedIdToken;
  userDoc?: any;
}

// Authentication Middleware
async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Acesso não autorizado. Sessão ausente ou inválida.' });
  }

  const token = authHeader.split('Bearer ')[1].trim();
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    req.user = decoded;

    const isKelber = (decoded.email || '').toLowerCase() === 'kelberduarte22@gmail.com';

    // Ensure Custom Claim role: ADMIN for the master administrator
    if (isKelber && decoded.role !== 'ADMIN') {
      try {
        await adminAuth.setCustomUserClaims(decoded.uid, { role: 'ADMIN' });
      } catch (claimErr) {
        console.warn('Erro ao atualizar claims administrativas:', claimErr);
      }
    }

    // Fetch user profile from Firestore
    const userDocRef = adminDb.collection('users').doc(decoded.uid);
    const userSnap = await userDocRef.get();

    if (userSnap.exists) {
      req.userDoc = userSnap.data();
      if (req.userDoc.status === 'BLOQUEADO') {
        return res.status(403).json({ error: 'Sua conta foi suspensa pela administração.' });
      }
      // Guarantee master admin account retains privileges even if doc was tampered with
      if (isKelber && (req.userDoc.role !== 'ADMIN' || req.userDoc.nivel_plano !== 4)) {
        await userDocRef.update({
          role: 'ADMIN',
          nivel_plano: 4,
          plano_atual: 'COMPLETO',
          status_plano: 'ATIVO',
          status_licenca: 'ATIVA',
        });
        req.userDoc.role = 'ADMIN';
        req.userDoc.nivel_plano = 4;
        req.userDoc.plano_atual = 'COMPLETO';
      }
    } else {
      // Default profile for newly authenticated users:
      // Regular users receive strictly level 1 (BÁSICO, Gratuito)
      const defaultUser = {
        user_id: decoded.uid,
        nome: decoded.name || (decoded.email ? decoded.email.split('@')[0] : 'Usuário'),
        email: (decoded.email || '').toLowerCase(),
        role: isKelber ? 'ADMIN' : 'USER',
        nivel_plano: isKelber ? 4 : 1,
        plano_atual: isKelber ? 'COMPLETO' : 'BÁSICO',
        status_plano: 'ATIVO',
        data_criacao: new Date().toISOString().split('T')[0],
        data_inicio: new Date().toISOString().split('T')[0],
        data_expiracao: isKelber ? '2030-12-31' : '-',
        license_id: isKelber ? `lic_${decoded.uid.substring(0, 8)}` : '',
        status_licenca: isKelber ? 'ATIVA' : 'INATIVA',
        device_id: 'DYARTE-DESKTOP',
        ultimo_login: new Date().toISOString(),
        status: 'ATIVO',
      };
      await userDocRef.set(defaultUser, { merge: true });
      req.userDoc = defaultUser;

      if (isKelber) {
        await adminDb.collection('admins').doc(decoded.uid).set({
          email: 'kelberduarte22@gmail.com',
          role: 'ADMIN',
          status: 'ACTIVE',
          granted_at: new Date().toISOString(),
          notes: 'Administrador Mestre Vinculado',
        }, { merge: true });
      }
    }

    next();
  } catch (error) {
    console.error('Falha ao verificar token Firebase:', error);
    return res.status(401).json({ error: 'Sessão expirada ou token de autenticação inválido.' });
  }
}

// Admin Authorization Middleware (Strictly kelberduarte22@gmail.com or verified Custom Claims)
async function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || !req.userDoc) {
    return res.status(401).json({ error: 'Autenticação requerida.' });
  }

  const userEmail = (req.user.email || '').toLowerCase();
  const isMasterAdmin = userEmail === 'kelberduarte22@gmail.com';
  const hasAdminClaim = req.user.role === 'ADMIN';

  if (!isMasterAdmin && !hasAdminClaim) {
    return res.status(403).json({
      error: 'Acesso negado. Apenas o administrador autorizado (kelberduarte22@gmail.com) possui permissão.',
    });
  }

  next();
}

// Log administrative actions to database
async function recordAdminLog(action: string, adminEmail: string, target: string, details: string) {
  try {
    const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await adminDb.collection('admin_logs').doc(logId).set({
      log_id: logId,
      action,
      user_email: adminEmail,
      target,
      details,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Erro ao gravar log administrativo:', err);
  }
}

// -------------------------------------------------------------
// API ROUTES
// -------------------------------------------------------------

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: 'v2.4.0',
    service: 'DYARTE OPTIMIZER API',
    timestamp: new Date().toISOString(),
  });
});

// Sync / Get Current User Profile & Verified Permissions
app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json({
    user: req.userDoc,
  });
});

// Update Profile info (nome, avatar) - restricted to non-sensitive fields
app.patch('/api/auth/profile', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { nome, avatar_seed } = req.body;
    const uid = req.user!.uid;

    const updates: Record<string, any> = {
      ultimo_login: new Date().toISOString(),
    };
    if (typeof nome === 'string' && nome.trim().length >= 2) {
      updates.nome = nome.trim();
    }
    if (typeof avatar_seed === 'string') {
      updates.avatar_seed = avatar_seed;
    }

    await adminDb.collection('users').doc(uid).update(updates);
    const refreshed = (await adminDb.collection('users').doc(uid).get()).data();
    res.json({ success: true, user: refreshed });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar perfil do usuário.' });
  }
});

// Validate License & Device
app.post('/api/license/validate', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { device_id, app_version } = req.body;
    const uid = req.user!.uid;
    const user = req.userDoc;

    // Check licenses collection for user
    const licSnap = await adminDb.collection('licenses').where('user_id', '==', uid).get();
    let userLicense = null;

    if (!licSnap.empty) {
      userLicense = licSnap.docs[0].data();
      // Update last seen and device id
      if (device_id) {
        await licSnap.docs[0].ref.update({
          last_seen: new Date().toISOString(),
          device_id,
          app_version: app_version || '2.4.0',
        });
      }
    }

    const isLicActive = userLicense ? userLicense.status === 'ATIVA' : user.status_licenca === 'ATIVA';
    const isPlanActive = user.status_plano === 'ATIVO';

    res.json({
      valid: isLicActive && isPlanActive,
      status: userLicense?.status || user.status_licenca,
      nivel_plano: user.nivel_plano,
      plano_atual: user.plano_atual,
      expires_at: userLicense?.expires_at || user.data_expiracao,
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao validar licença do dispositivo.' });
  }
});

// Execute Optimization Tool - Protected with Server-Side Canonical Registry & License Validation
app.post('/api/tools/execute', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tool_id } = req.body;
    const user = req.userDoc;
    const uid = req.user!.uid;

    if (!tool_id || typeof tool_id !== 'string') {
      return res.status(400).json({ success: false, error: 'tool_id é obrigatório.' });
    }

    // Consult canonical registry on backend authority
    const canonicalTool = CANONICAL_TOOLS[tool_id];
    if (!canonicalTool) {
      return res.status(400).json({
        success: false,
        error: 'Ferramenta não reconhecida no catálogo oficial de otimizações do sistema.',
      });
    }

    const userLevel = Number(user.nivel_plano) || 1;
    const reqLevel = canonicalTool.required_plan_level;
    const isAdmin = user.role === 'ADMIN';

    // Server-side authorization check based on canonical required plan level
    if (userLevel < reqLevel && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: `Recurso bloqueado. Esta otimização requer o Plano Nível ${reqLevel} (${reqLevel === 2 ? 'Médio' : reqLevel === 3 ? 'Avançado' : 'Completo'}). Seu plano atual é nível ${userLevel}.`,
      });
    }

    // Require active license for paid tools (level > 1)
    if (reqLevel > 1 && user.status_licenca !== 'ATIVA' && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: `Sua licença está com status ${user.status_licenca || 'PENDENTE'}. Ative uma licença válida para executar otimizações avançadas.`,
      });
    }

    // Record optimization history in database
    const historyId = `opt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const historyItem = {
      history_id: historyId,
      user_id: uid,
      tool_id,
      tool_name: canonicalTool.name,
      category: canonicalTool.category,
      date: new Date().toISOString(),
      status: 'SUCESSO',
      result: 'Diretiva de otimização autorizada e agendada para execução pelo DYARTE Agent.',
      duration_ms: 180,
      details: `Execução autorizada pelo backend central (Plano Nível ${reqLevel}).`,
    };

    await adminDb.collection('optimization_history').doc(historyId).set(historyItem);

    res.json({
      success: true,
      historyItem,
      message: 'Otimização autorizada com êxito pelo servidor.',
    });
  } catch (error) {
    console.error('Erro na execução de ferramenta:', error);
    res.status(500).json({ error: 'Erro ao processar execução da otimização no servidor.' });
  }
});

// Register / Sync Windows Device (Input validation and sanitization)
app.post('/api/device/sync', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rawData = req.body || {};
    const uid = req.user!.uid;
    const deviceId = typeof rawData.device_id === 'string' && rawData.device_id.trim()
      ? rawData.device_id.trim().substring(0, 64)
      : `DEV_${uid.substring(0, 8)}`;

    const sanitizedDevice = {
      device_id: deviceId,
      user_id: uid,
      cpu: typeof rawData.cpu === 'string' ? rawData.cpu.substring(0, 100) : 'Processador Windows',
      gpu: typeof rawData.gpu === 'string' ? rawData.gpu.substring(0, 100) : 'Placa de Vídeo',
      ram: typeof rawData.ram === 'string' ? rawData.ram.substring(0, 50) : '16 GB',
      storage: typeof rawData.storage === 'string' ? rawData.storage.substring(0, 80) : 'SSD NVMe',
      windows: typeof rawData.windows === 'string' ? rawData.windows.substring(0, 60) : 'Windows 11 Pro',
      windows_version: typeof rawData.windows_version === 'string' ? rawData.windows_version.substring(0, 40) : '23H2',
      build: typeof rawData.build === 'string' ? rawData.build.substring(0, 30) : '22631.3007',
      motherboard: typeof rawData.motherboard === 'string' ? rawData.motherboard.substring(0, 80) : 'Placa Mãe',
      bios_version: typeof rawData.bios_version === 'string' ? rawData.bios_version.substring(0, 40) : 'UEFI',
      is_agent_connected: Boolean(rawData.is_agent_connected),
      agent_version: typeof rawData.agent_version === 'string' ? rawData.agent_version.substring(0, 20) : '1.4.2-win',
      last_seen: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await adminDb.collection('devices').doc(deviceId).set(sanitizedDevice, { merge: true });
    await adminDb.collection('users').doc(uid).update({ device_id: deviceId });

    res.json({ success: true, device: sanitizedDevice });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao sincronizar informações do dispositivo Windows.' });
  }
});

// Cakto Payment Webhook (Strictly server-side secret validation)
app.post('/api/webhook/cakto', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers['authorization'] || req.headers['x-webhook-secret'];
    const serverSecret = process.env.CAKTO_WEBHOOK_SECRET || 'dyarte_whsec_98f482a1762c90';

    if (!authHeader || (authHeader !== serverSecret && authHeader !== `Bearer ${serverSecret}`)) {
      return res.status(401).json({ error: 'Assinatura ou segredo do webhook inválido.' });
    }

    const { email, plan_id, transaction_id, customer_name } = req.body;
    if (!email || !plan_id) {
      return res.status(400).json({ error: 'Parâmetros de email e plano são obrigatórios.' });
    }

    const safeEmail = String(email).trim().toLowerCase();
    const safePlanId = String(plan_id).trim().toLowerCase();

    let planLevel = 1;
    let planName = 'BÁSICO';
    if (safePlanId.includes('completo') || safePlanId === '4') {
      planLevel = 4;
      planName = 'COMPLETO';
    } else if (safePlanId.includes('avancado') || safePlanId === '3') {
      planLevel = 3;
      planName = 'AVANÇADO';
    } else if (safePlanId.includes('medio') || safePlanId === '2') {
      planLevel = 2;
      planName = 'MÉDIO';
    }

    const userSnap = await adminDb.collection('users').where('email', '==', safeEmail).get();
    if (userSnap.empty) {
      return res.status(404).json({ error: 'Usuário não encontrado para o e-mail informado.' });
    }

    const userDoc = userSnap.docs[0];
    const uid = userDoc.id;
    const newLicenseId = `lic_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    await userDoc.ref.update({
      plano_atual: planName,
      nivel_plano: planLevel,
      status_plano: 'ATIVO',
      status_licenca: 'ATIVA',
      license_id: newLicenseId,
      data_inicio: new Date().toISOString().split('T')[0],
      data_expiracao: expiresAt,
    });

    await adminDb.collection('licenses').doc(newLicenseId).set({
      license_id: newLicenseId,
      license_key: `DYARTE-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      user_id: uid,
      user_name: customer_name || userDoc.data().nome || 'Cliente',
      user_email: safeEmail,
      plan_id: safePlanId,
      status: 'ATIVA',
      created_at: new Date().toISOString().split('T')[0],
      activated_at: new Date().toISOString(),
      expires_at: expiresAt,
      device_id: userDoc.data().device_id || 'PENDENTE',
      transaction_id: transaction_id || `tx_${Date.now()}`,
    });

    await recordAdminLog('WEBHOOK_CAKTO_PURCHASE', 'system_webhook', uid, `Pagamento aprovado para plano ${planName}. Licença ${newLicenseId} criada.`);

    res.json({ success: true, message: `Plano ${planName} ativado com sucesso para ${safeEmail}.` });
  } catch (err) {
    console.error('Erro no processamento do webhook Cakto:', err);
    res.status(500).json({ error: 'Falha interna ao processar webhook de pagamento.' });
  }
});

// -------------------------------------------------------------
// ADMIN ENDPOINTS (Strictly protected by requireAdmin)
// -------------------------------------------------------------

// List All Users in System
app.get('/api/admin/users', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const usersSnap = await adminDb.collection('users').get();
    const usersList = usersSnap.docs.map((d) => d.data());
    res.json({ users: usersList });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar usuários cadastrados.' });
  }
});

// Update User Plan & Level (Admin Only)
app.post('/api/admin/user/plan', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { target_user_id, plan_name, plan_level } = req.body;
    if (!target_user_id || plan_level === undefined) {
      return res.status(400).json({ error: 'ID do usuário e nível do plano são obrigatórios.' });
    }

    const safeLevel = Math.max(0, Math.min(4, Number(plan_level)));
    const safeName = plan_name || (safeLevel === 0 ? 'SEM PLANO' : safeLevel === 2 ? 'MÉDIO' : safeLevel === 3 ? 'AVANÇADO' : 'COMPLETO');

    const updateData: Record<string, any> = {
      plano_atual: safeName,
      nivel_plano: safeLevel,
      status_plano: safeLevel > 0 ? 'ATIVO' : 'SEM_PLANO',
      status_licenca: safeLevel > 0 ? 'ATIVA' : 'PENDENTE',
      data_inicio: safeLevel > 0 ? new Date().toISOString().split('T')[0] : '-',
      data_expiracao: safeLevel > 0 ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : '-',
    };

    await adminDb.collection('users').doc(target_user_id).update(updateData);

    // Record admin log
    await recordAdminLog(
      'UPDATE_USER_PLAN',
      req.user!.email || 'admin',
      target_user_id,
      `Alterado para plano ${safeName} (Nível ${safeLevel})`
    );

    res.json({ success: true, message: `Plano do usuário atualizado para ${safeName}.` });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao alterar plano do usuário.' });
  }
});

// Toggle User Account Status (Block / Unblock)
app.post('/api/admin/user/status', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { target_user_id, status } = req.body;
    if (!target_user_id || !['ATIVO', 'BLOQUEADO'].includes(status)) {
      return res.status(400).json({ error: 'Parâmetros de status inválidos.' });
    }

    await adminDb.collection('users').doc(target_user_id).update({ status });

    await recordAdminLog(
      status === 'BLOQUEADO' ? 'BLOCK_USER' : 'UNBLOCK_USER',
      req.user!.email || 'admin',
      target_user_id,
      `Conta marcada como ${status}`
    );

    res.json({ success: true, status });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao alterar status da conta do usuário.' });
  }
});

// Delete User Account (Admin Only)
app.delete('/api/admin/user/:userId', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ error: 'ID do usuário é obrigatório.' });
    }

    // Safety check: protect master admin from deletion
    const userDocRef = adminDb.collection('users').doc(userId);
    const userSnap = await userDocRef.get();
    if (userSnap.exists) {
      const data = userSnap.data();
      if (data?.email?.toLowerCase() === 'kelberduarte22@gmail.com') {
        return res.status(403).json({ error: 'Não é permitido excluir o usuário Administrador Master.' });
      }
    }

    // Delete Firestore user document
    await userDocRef.delete();

    // Revoke or delete any user licenses
    const licSnap = await adminDb.collection('licenses').where('user_id', '==', userId).get();
    const batch = adminDb.batch();
    licSnap.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    // Try deleting from Firebase Auth if exists
    try {
      await adminAuth.deleteUser(userId);
    } catch {
      // Ignored if user was not in Firebase Auth
    }

    await recordAdminLog(
      'DELETE_USER',
      req.user!.email || 'admin',
      userId,
      `Conta de usuário excluída permanentemente.`
    );

    res.json({ success: true, message: 'Conta excluída com sucesso.' });
  } catch (error) {
    console.error('Erro ao excluir usuário:', error);
    res.status(500).json({ error: 'Falha interna ao remover usuário.' });
  }
});

// Admin License Operations (Create, Suspend, Reactivate, Revoke)
app.post('/api/admin/license/action', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { action, license_id, user_id, plan_id } = req.body;

    if (action === 'CREATE') {
      const newLicenseId = `lic_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      const newLicense = {
        license_id: newLicenseId,
        user_id: user_id || 'unassigned',
        plan_id: plan_id || 'medio',
        status: 'ATIVA',
        created_at: new Date().toISOString(),
        activated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        device_id: 'PENDING',
        last_seen: new Date().toISOString(),
        app_version: '2.4.0',
      };

      await adminDb.collection('licenses').doc(newLicenseId).set(newLicense);
      await recordAdminLog('CREATE_LICENSE', req.user!.email || 'admin', newLicenseId, `Criada licença ${newLicenseId}`);
      return res.json({ success: true, license: newLicense });
    }

    if (!license_id) {
      return res.status(400).json({ error: 'license_id é obrigatório.' });
    }

    const licRef = adminDb.collection('licenses').doc(license_id);
    let newStatus = 'ATIVA';
    if (action === 'SUSPEND') newStatus = 'SUSPENSA';
    if (action === 'REVOKE') newStatus = 'CANCELADA';
    if (action === 'REACTIVATE') newStatus = 'ATIVA';

    await licRef.update({ status: newStatus });
    await recordAdminLog(`${action}_LICENSE`, req.user!.email || 'admin', license_id, `Status alterado para ${newStatus}`);

    res.json({ success: true, license_id, status: newStatus });
  } catch (error) {
    res.status(500).json({ error: 'Erro na operação de licença.' });
  }
});

// Get Administrative Audit Logs
app.get('/api/admin/logs', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const logsSnap = await adminDb.collection('admin_logs').orderBy('timestamp', 'desc').limit(100).get();
    const logs = logsSnap.docs.map((d) => d.data());
    res.json({ logs });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao carregar logs administrativos.' });
  }
});

// List All Licenses in System (Admin Only - Real Database Capture)
app.get('/api/admin/licenses', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const licSnap = await adminDb.collection('licenses').get();
    const licensesList = licSnap.docs.map((d) => d.data());
    res.json({ licenses: licensesList });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar licenças do sistema.' });
  }
});

// Real-time Database Aggregate Stats for Admin Dashboard
app.get('/api/admin/stats', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [usersSnap, licSnap] = await Promise.all([
      adminDb.collection('users').get(),
      adminDb.collection('licenses').get(),
    ]);

    const users = usersSnap.docs.map((d) => d.data());
    const licenses = licSnap.docs.map((d) => d.data());

    const totalUsers = users.length;
    const activeLicenses = licenses.filter((l) => l.status === 'ATIVA').length;
    const paidUsers = users.filter((u) => Number(u.nivel_plano) > 1 && u.status_plano === 'ATIVO').length;

    // Real estimated monthly revenue calculation based on active user plan levels (R$ 30, R$ 45, R$ 60)
    const monthlyRevenue = users.reduce((acc, u) => {
      if (u.status_plano === 'ATIVO') {
        const lvl = Number(u.nivel_plano);
        if (lvl === 2) return acc + 30;
        if (lvl === 3) return acc + 45;
        if (lvl === 4) return acc + 60;
      }
      return acc;
    }, 0);

    res.json({
      totalUsers,
      activeLicenses,
      paidUsers,
      monthlyRevenue,
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao calcular estatísticas reais do banco de dados.' });
  }
});

// -------------------------------------------------------------
// PRODUCTION / VITE MIDDLEWARE SETUP
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DYARTE OPTIMIZER Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
