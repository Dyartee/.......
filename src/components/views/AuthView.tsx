import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  ShieldCheck,
  Zap,
  Lock,
  Mail,
  User,
  ArrowRight,
  Globe,
  RefreshCw,
  CheckCircle2,
  Crown,
  Eye,
  Sparkles,
} from 'lucide-react';

export const AuthView: React.FC = () => {
  const {
    login,
    loginWithGoogle,
    register,
    requestPasswordReset,
    openLegalModal,
    addToast,
    webBrowserLoginSync,
    isSyncingWithWeb,
  } = useApp();

  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');

  // Login Form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register Form
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regTerms, setRegTerms] = useState(true);

  // Forgot Password Form
  const [forgotEmail, setForgotEmail] = useState('');

  const [isLoading, setIsLoading] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      addToast('error', 'Campos Obrigatórios', 'Informe seu e-mail e senha.');
      return;
    }

    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    const result = login(loginEmail, loginPassword);
    setIsLoading(false);
  };

  const handleWebSessionSync = async () => {
    const res = await webBrowserLoginSync();
    if (!res.success && res.error) {
      addToast('error', 'Falha na Sincronização', res.error);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName || !regEmail || !regPassword) {
      addToast('error', 'Campos Obrigatórios', 'Preencha todos os campos do cadastro.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      addToast('error', 'Erro de Senha', 'As senhas não coincidem.');
      return;
    }
    if (!regTerms) {
      addToast('error', 'Termos Obrigatórios', 'Você deve aceitar os termos de uso.');
      return;
    }

    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 700));
    const result = register({
      nome: regName,
      email: regEmail,
      senha: regPassword,
      confirmacao: regConfirmPassword,
      termos: regTerms,
      privacidade: true,
    });
    setIsLoading(false);

    if (!result.success && result.error) {
      addToast('error', 'Falha no Cadastro', result.error);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const safeEmail = (forgotEmail || '').trim();
    if (!safeEmail) {
      addToast('error', 'E-mail Obrigatório', 'Informe o e-mail cadastrado no site.');
      return;
    }
    setIsLoading(true);
    const result = await requestPasswordReset(safeEmail);
    setIsLoading(false);
    if (result.success) {
      addToast('success', 'Instruções Enviadas', result.message);
      setMode('login');
    } else {
      addToast('error', 'Falha na Recuperação', result.message);
    }
  };

  // Quick Demo Logins
  const handleQuickLogin = (role: 'user' | 'admin' | 'view_only') => {
    if (role === 'admin') {
      login('admin@dyarte.com', 'admin123');
    } else if (role === 'view_only') {
      // Register or login a fresh view-only user
      register({
        nome: 'Visitante Teste',
        email: `visitante_${Math.floor(100 + Math.random() * 900)}@email.com`,
        senha: '123',
        termos: true,
        privacidade: true,
      });
    } else {
      login('kelberduarte22@gmail.com', '123456');
    }
  };

  return (
    <div className="min-h-full flex flex-col justify-center items-center p-6 bg-gradient-to-b from-[#08080c] via-[#0b0b10] to-[#07070a]">
      {/* Background ambient lighting */}
      <div className="w-full max-w-md space-y-5 relative">
        <div className="absolute -top-12 -left-12 w-64 h-64 bg-[#E00000]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#E00000] text-white shadow-[0_0_25px_rgba(224,0,0,0.5)] mb-1">
            <Zap className="w-8 h-8 fill-white" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white font-mono uppercase">
            DYARTE OPTIMIZER
          </h1>
          <p className="text-xs text-zinc-400 font-mono uppercase tracking-wider">
            SOFTWARE DE OTIMIZAÇÃO PROFISSIONAL PARA WINDOWS
          </p>
        </div>

        {/* Sync Badge Info */}
        <div className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-[#12121a] border border-[#20202e] text-center shadow-md">
          <Globe className="w-4 h-4 text-emerald-400 shrink-0" />
          <p className="text-[11px] text-zinc-300 font-mono">
            <span className="text-white font-semibold">Sincronização 100% Web:</span> Planos vinculados à sua conta no site, sem chaves seriais.
          </p>
        </div>

        {/* Main Card */}
        <div className="p-6 md:p-8 rounded-2xl bg-[#111118] border border-[#232332] shadow-2xl relative z-10 space-y-5">
          {/* Primary Quick Web Sync Button */}
          <button
            type="button"
            onClick={handleWebSessionSync}
            disabled={isSyncingWithWeb}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#1c1c28] via-[#242436] to-[#1c1c28] hover:from-[#232333] hover:to-[#232333] border border-zinc-700/80 hover:border-emerald-500/60 text-white transition-all flex items-center justify-between group cursor-pointer shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                <RefreshCw className={`w-4 h-4 ${isSyncingWithWeb ? 'animate-spin' : ''}`} />
              </div>
              <div className="text-left">
                <span className="text-[10px] font-mono text-emerald-400 uppercase font-bold block leading-none mb-0.5">
                  1-Click Web Sync
                </span>
                <span className="text-xs font-bold text-white block">
                  Sincronizar com Sessão do Site
                </span>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
          </button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-zinc-800" />
            <span className="text-[10px] font-mono uppercase text-zinc-500">
              Ou acesse com credenciais
            </span>
            <div className="h-px flex-1 bg-zinc-800" />
          </div>

          {/* Tabs for Login / Register */}
          {mode !== 'forgot' && (
            <div className="flex rounded-xl bg-[#09090d] p-1 border border-[#1e1e2b]">
              <button
                type="button"
                onClick={() => setMode('login')}
                className={`flex-1 py-2 text-xs font-mono font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                  mode === 'login'
                    ? 'bg-[#E00000] text-white shadow-md'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Entrar com Conta do Site
              </button>
              <button
                type="button"
                onClick={() => setMode('register')}
                className={`flex-1 py-2 text-xs font-mono font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                  mode === 'register'
                    ? 'bg-[#E00000] text-white shadow-md'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Criar Conta Web
              </button>
            </div>
          )}

          {/* LOGIN FORM */}
          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="text-[11px] font-mono text-zinc-400 uppercase block mb-1.5">
                  E-mail Cadastrado no Site:
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="seuemail@exemplo.com"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#09090d] border border-[#262635] text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#E00000]"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-mono text-zinc-400 uppercase">Senha da Conta:</label>
                  <button
                    type="button"
                    onClick={() => setMode('forgot')}
                    className="text-[11px] font-mono text-[#FF5555] hover:underline cursor-pointer"
                  >
                    Esqueceu a senha?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#09090d] border border-[#262635] text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#E00000]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl bg-[#E00000] hover:bg-[#c50000] text-white text-xs font-mono font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(224,0,0,0.4)] disabled:opacity-50"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Entrar e Sincronizar Plano</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-zinc-800"></div>
                <span className="flex-shrink mx-3 text-[10px] font-mono text-zinc-500 uppercase">ou acesse com</span>
                <div className="flex-grow border-t border-zinc-800"></div>
              </div>

              <button
                type="button"
                onClick={async () => {
                  setIsLoading(true);
                  const res = await loginWithGoogle();
                  setIsLoading(false);
                  if (!res.success && res.error) {
                    addToast('error', 'Falha com Google', res.error);
                  }
                }}
                disabled={isLoading}
                className="w-full py-2.5 rounded-xl bg-[#12121b] hover:bg-[#1a1a26] border border-zinc-700/80 text-white text-xs font-mono font-medium transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"/>
                  <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"/>
                  <path fill="#FBBC05" d="M5.6 14.8c-.3-.8-.4-1.8-.4-2.8s.1-2 .4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z"/>
                  <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z"/>
                </svg>
                <span>Continuar com Google (Gmail)</span>
              </button>
            </form>
          )}

          {/* REGISTER FORM */}
          {mode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div className="p-3 rounded-xl bg-[#0a0a0f] border border-zinc-800 text-[11px] text-zinc-300 space-y-1">
                <span className="text-emerald-400 font-bold font-mono uppercase block">
                  Cadastro Automático na Nuvem
                </span>
                <p className="text-zinc-400 text-[10px]">
                  Ao cadastrar, você inicia no modo de visualização para explorar as ferramentas do sistema. Ao assinar no site, seu plano é liberado instantaneamente.
                </p>
              </div>

              <div>
                <label className="text-[11px] font-mono text-zinc-400 uppercase block mb-1">
                  Nome Completo:
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Ex: Carlos Silva"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#09090d] border border-[#262635] text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#E00000]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-mono text-zinc-400 uppercase block mb-1">
                  E-mail:
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="seuemail@exemplo.com"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#09090d] border border-[#262635] text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#E00000]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-mono text-zinc-400 uppercase block mb-1">
                    Senha:
                  </label>
                  <input
                    type="password"
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2.5 rounded-xl bg-[#09090d] border border-[#262635] text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#E00000]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-mono text-zinc-400 uppercase block mb-1">
                    Confirmar:
                  </label>
                  <input
                    type="password"
                    required
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2.5 rounded-xl bg-[#09090d] border border-[#262635] text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#E00000]"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="termsCheck"
                  checked={regTerms}
                  onChange={(e) => setRegTerms(e.target.checked)}
                  className="rounded border-zinc-700 bg-black text-[#E00000] focus:ring-0 cursor-pointer"
                />
                <label htmlFor="termsCheck" className="text-[11px] text-zinc-400">
                  Li e concordo com os{' '}
                  <button
                    type="button"
                    onClick={() => openLegalModal('terms')}
                    className="text-white underline hover:text-[#FF4444]"
                  >
                    Termos de Uso
                  </button>{' '}
                  do software.
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl bg-[#E00000] hover:bg-[#c50000] text-white text-xs font-mono font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(224,0,0,0.4)] disabled:opacity-50"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Criar Conta e Explorar</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* FORGOT PASSWORD FORM */}
          {mode === 'forgot' && (
            <form onSubmit={handleForgotSubmit} className="space-y-4">
              <div className="text-center space-y-1">
                <h3 className="text-sm font-bold text-white font-mono uppercase">
                  Recuperação de Acesso
                </h3>
                <p className="text-xs text-zinc-400">
                  Informe o e-mail cadastrado na sua conta do site para redefinir sua senha.
                </p>
              </div>

              <div>
                <label className="text-[11px] font-mono text-zinc-400 uppercase block mb-1">
                  E-mail Cadastrado:
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="seuemail@exemplo.com"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#09090d] border border-[#262635] text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#E00000]"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-[#E00000] hover:bg-[#c50000] text-white text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer shadow-md"
              >
                Enviar Link de Redefinição
              </button>

              <button
                type="button"
                onClick={() => setMode('login')}
                className="w-full py-2 text-xs font-mono text-zinc-400 hover:text-white transition-colors cursor-pointer text-center block"
              >
                Voltar para o Login
              </button>
            </form>
          )}

          {/* Quick Demo Access Buttons */}
          <div className="pt-4 border-t border-zinc-800 space-y-2">
            <span className="text-[10px] font-mono uppercase text-zinc-500 font-bold block text-center">
              Acesso Rápido para Demonstração:
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('user')}
                className="p-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-[10px] font-mono text-zinc-300 transition-colors flex flex-col items-center justify-center gap-1 cursor-pointer border border-zinc-700"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Cliente Ativo</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('view_only')}
                className="p-2 rounded-lg bg-amber-950/30 hover:bg-amber-900/50 text-[10px] font-mono text-amber-300 transition-colors flex flex-col items-center justify-center gap-1 cursor-pointer border border-amber-800/40"
              >
                <Eye className="w-3.5 h-3.5 text-amber-400" />
                <span>Sem Plano</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('admin')}
                className="p-2 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-[10px] font-mono text-rose-300 transition-colors flex flex-col items-center justify-center gap-1 cursor-pointer border border-rose-800/50"
              >
                <Crown className="w-3.5 h-3.5 text-rose-400" />
                <span>Painel Admin</span>
              </button>
            </div>
          </div>
        </div>

        {/* Legal Links Footer */}
        <div className="flex items-center justify-center gap-4 text-xs font-mono text-zinc-500">
          <button
            onClick={() => openLegalModal('terms')}
            className="hover:text-zinc-300 cursor-pointer transition-colors"
          >
            Termos de Uso
          </button>
          <span>•</span>
          <button
            onClick={() => openLegalModal('privacy')}
            className="hover:text-zinc-300 cursor-pointer transition-colors"
          >
            Privacidade
          </button>
          <span>•</span>
          <button
            onClick={() => openLegalModal('support')}
            className="hover:text-zinc-300 cursor-pointer transition-colors"
          >
            Suporte Oficial
          </button>
        </div>
      </div>
    </div>
  );
};
