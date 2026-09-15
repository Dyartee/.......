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
const MAX_AUTH_REQUESTS = 30; // 30 requests per minute per IP

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

    // Fetch user profile from Firestore
    const userDocRef = adminDb.collection('users').doc(decoded.uid);
    const userSnap = await userDocRef.get();

    if (userSnap.exists) {
      req.userDoc = userSnap.data();
      if (req.userDoc.status === 'BLOQUEADO') {
        return res.status(403).json({ error: 'Sua conta foi suspensa pela administração.' });
      }
    } else {
      // Default profile if newly authenticated via Google / Firebase
      const isKelber = (decoded.email || '').toLowerCase() === 'kelberduarte22@gmail.com';
      const defaultUser = {
        user_id: decoded.uid,
        nome: decoded.name || (decoded.email ? decoded.email.split('@')[0] : 'Usuário'),
        email: (decoded.email || '').toLowerCase(),
        role: isKelber ? 'ADMIN' : 'USER',
        nivel_plano: isKelber ? 4 : 0,
        plano_atual: isKelber ? 'COMPLETO' : 'SEM PLANO',
        status_plano: isKelber ? 'ATIVO' : 'SEM_PLANO',
        data_criacao: new Date().toISOString().split('T')[0],
        data_inicio: isKelber ? new Date().toISOString().split('T')[0] : '-',
        data_expiracao: isKelber ? '2030-12-31' : '-',
        license_id: isKelber ? `lic_${decoded.uid.substring(0, 8)}` : '',
        status_licenca: isKelber ? 'ATIVA' : 'PENDENTE',
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

// Admin Authorization Middleware
async function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || !req.userDoc) {
    return res.status(401).json({ error: 'Autenticação requerida.' });
  }

  const isKelber = (req.user.email || '').toLowerCase() === 'kelberduarte22@gmail.com';
  const isAdminRole = req.userDoc.role === 'ADMIN';

  // Double check admin document in database
  const adminDoc = await adminDb.collection('admins').doc(req.user.uid).get();
  const isAdminInDb = adminDoc.exists && adminDoc.data()?.role === 'ADMIN';

  if (!isKelber && !isAdminRole && !isAdminInDb) {
    return res.status(403).json({ error: 'Acesso negado. Esta operação exige privilégios de administrador.' });
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

// Execute Optimization Tool - Protected with Server-Side Plan & License Validation
app.post('/api/tools/execute', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tool_id, tool_name, category, required_level } = req.body;
    const user = req.userDoc;
    const uid = req.user!.uid;

    const userLevel = Number(user.nivel_plano) || 0;
    const reqLevel = Number(required_level) || 2;

    // Server-side authorization check
    if (userLevel < reqLevel && user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: `Recurso bloqueado. Esta otimização requer o Plano Nível ${reqLevel} (${reqLevel === 2 ? 'Médio' : reqLevel === 3 ? 'Avançado' : 'Completo'}). Seu plano atual é nível ${userLevel}.`,
      });
    }

    if (user.status_licenca !== 'ATIVA' && user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: `Sua licença está com status ${user.status_licenca || 'PENDENTE'}. Ative uma licença válida para executar otimizações.`,
      });
    }

    // Record optimization history in database
    const historyId = `opt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const historyItem = {
      history_id: historyId,
      user_id: uid,
      tool_id: tool_id || 'tool_generic',
      tool_name: tool_name || 'Otimização de Sistema',
      category: category || 'SISTEMA',
      date: new Date().toISOString(),
      status: 'SUCESSO',
      result: 'Parâmetros de registro e telemetria aplicados com sucesso no Windows.',
      duration_ms: Math.floor(Math.random() * 400) + 120,
      details: 'Otimização executada via engine DYARTE e validada pelo servidor central.',
    };

    await adminDb.collection('optimization_history').doc(historyId).set(historyItem);

    res.json({
      success: true,
      historyItem,
      message: 'Otimização autorizada e aplicada com êxito.',
    });
  } catch (error) {
    console.error('Erro na execução de ferramenta:', error);
    res.status(500).json({ error: 'Erro ao processar execução da otimização no servidor.' });
  }
});

// Register / Sync Windows Device
app.post('/api/device/sync', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const deviceData = req.body;
    const uid = req.user!.uid;
    const deviceId = deviceData.device_id || `DEV_${uid.substring(0, 8)}`;

    const deviceDoc = {
      ...deviceData,
      device_id: deviceId,
      user_id: uid,
      last_seen: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await adminDb.collection('devices').doc(deviceId).set(deviceDoc, { merge: true });
    await adminDb.collection('users').doc(uid).update({ device_id: deviceId });

    res.json({ success: true, device: deviceDoc });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao sincronizar informações do dispositivo Windows.' });
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
