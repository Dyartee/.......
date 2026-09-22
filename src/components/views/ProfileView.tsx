import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  UserCircle2,
  Shield,
  KeyRound,
  Laptop,
  Mail,
  Calendar,
  Clock,
  Lock,
  Save,
  FileText,
  HelpCircle,
  LogOut,
  Crown,
} from 'lucide-react';

export const ProfileView: React.FC = () => {
  const {
    currentUser,
    updateCurrentUserProfile,
    device,
    logout,
    openLegalModal,
    addToast,
    changePassword,
  } = useApp();

  const [nome, setNome] = useState(currentUser?.nome || '');
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [isChangingPass, setIsChangingPass] = useState(false);

  const handleUpdateName = (e: React.FormEvent) => {
    e.preventDefault();
    const safeNome = (nome || '').trim();
    if (!safeNome) return;
    updateCurrentUserProfile({ nome: safeNome });
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPass) {
      addToast('error', 'Campos Obrigatórios', 'Preencha a nova senha.');
      return;
    }
    if (newPass !== confirmPass) {
      addToast('error', 'Erro de Confirmação', 'A nova senha e confirmação não conferem.');
      return;
    }
    if (newPass.length < 6) {
      addToast('error', 'Senha Curta', 'A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }

    setIsChangingPass(true);
    const res = await changePassword(newPass);
    setIsChangingPass(false);

    if (res.success) {
      setCurrentPass('');
      setNewPass('');
      setConfirmPass('');
      addToast('success', 'Senha Atualizada', 'Sua senha foi redefinida no Firebase com criptografia segura.');
    } else {
      addToast('error', 'Erro ao Atualizar Senha', res.error || 'Não foi possível alterar a senha.');
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white font-mono uppercase">
              Perfil do Usuário
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-800 text-zinc-300">
              {currentUser?.role === 'ADMIN' ? 'Privilégio: ADMINISTRADOR' : 'Privilégio: CLIENTE'}
            </span>
          </div>
          <p className="text-sm text-zinc-400 mt-1">
            Informações cadastrais, chave de licença associada e credenciais de segurança.
          </p>
        </div>

        <button
          onClick={logout}
          className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-red-950/60 hover:text-red-400 text-xs font-mono text-zinc-300 border border-zinc-700 flex items-center gap-2 transition-all cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Encerrar Sessão</span>
        </button>
      </div>

      {/* User Information Specs Card - Full fields from prompt */}
      <div className="p-6 rounded-2xl bg-[#121218] border border-[#232332] space-y-6">
        <div className="flex items-center gap-4 pb-6 border-b border-[#21212e]">
          <div className="w-14 h-14 rounded-2xl bg-[#E00000]/15 border border-[#E00000]/40 flex items-center justify-center text-xl font-bold text-white font-mono shrink-0">
            {currentUser?.nome.charAt(0).toUpperCase() || 'U'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white font-mono">{currentUser?.nome}</h2>
              {currentUser?.role === 'ADMIN' && (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/40 font-bold">
                  <Crown className="w-3 h-3 text-amber-400" /> ADMIN
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 font-mono mt-0.5">{currentUser?.email}</p>
          </div>
        </div>

        {/* Database Entities Mapping Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs font-mono">
          <div className="p-3.5 rounded-xl bg-[#0d0d12] border border-[#1f1f2a]">
            <span className="text-[10px] text-zinc-500 uppercase block mb-1">ID DO USUÁRIO</span>
            <span className="text-zinc-200 font-semibold">{currentUser?.user_id}</span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0d0d12] border border-[#1f1f2a]">
            <span className="text-[10px] text-zinc-500 uppercase block mb-1">DATA DE CRIAÇÃO</span>
            <span className="text-zinc-200">{currentUser?.data_criacao}</span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0d0d12] border border-[#1f1f2a]">
            <span className="text-[10px] text-zinc-500 uppercase block mb-1">PLANO ATUAL</span>
            <span className="text-[#FF4444] font-bold">
              {`${currentUser?.plano_atual || 'BÁSICO'} (Nível ${currentUser?.nivel_plano || 1})`}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0d0d12] border border-[#1f1f2a]">
            <span className="text-[10px] text-zinc-500 uppercase block mb-1">STATUS DO PLANO</span>
            <span className="text-emerald-400 font-bold">
              ● {currentUser?.status_plano || 'ATIVO'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0d0d12] border border-[#1f1f2a]">
            <span className="text-[10px] text-zinc-500 uppercase block mb-1">VIGÊNCIA</span>
            <span className="text-zinc-300">
              {(currentUser?.nivel_plano ?? 1) === 1
                ? 'Vitalício (Gratuito)'
                : `${currentUser?.data_inicio} até ${currentUser?.data_expiracao}`}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0d0d12] border border-[#1f1f2a]">
            <span className="text-[10px] text-zinc-500 uppercase block mb-1">ID DA LICENÇA</span>
            <span className="text-zinc-300 truncate block">
              {currentUser?.license_id || 'Licença Gratuita Básica'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0d0d12] border border-[#1f1f2a]">
            <span className="text-[10px] text-zinc-500 uppercase block mb-1">STATUS DA LICENÇA</span>
            <span className="text-emerald-400 font-bold">
              {currentUser?.status_licenca || 'ATIVA'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0d0d12] border border-[#1f1f2a]">
            <span className="text-[10px] text-zinc-500 uppercase block mb-1">ID DO DISPOSITIVO</span>
            <span className="text-zinc-300 truncate block">{device.device_id}</span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0d0d12] border border-[#1f1f2a]">
            <span className="text-[10px] text-zinc-500 uppercase block mb-1">ÚLTIMO LOGIN</span>
            <span className="text-zinc-300">{currentUser?.ultimo_login}</span>
          </div>
        </div>
      </div>

      {/* Forms Grid: Edit Name and Change Password */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Name edit */}
        <div className="p-6 rounded-2xl bg-[#121218] border border-[#232332] space-y-4">
          <h3 className="text-sm font-bold text-white font-mono uppercase">Alterar Dados do Perfil</h3>
          <form onSubmit={handleUpdateName} className="space-y-3">
            <div>
              <label className="text-[11px] font-mono text-zinc-400 uppercase block mb-1">
                Nome de Exibição:
              </label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#09090d] border border-[#262635] text-xs text-white focus:outline-none focus:border-[#E00000]"
              />
            </div>

            <div>
              <label className="text-[11px] font-mono text-zinc-400 uppercase block mb-1">
                E-mail Cadastrado:
              </label>
              <input
                type="email"
                disabled
                value={currentUser?.email || ''}
                className="w-full px-3 py-2 rounded-lg bg-[#09090d]/50 border border-[#20202a] text-xs text-zinc-500 cursor-not-allowed font-mono"
              />
              <span className="text-[10px] text-zinc-500 mt-1 block">
                O e-mail é a chave primária da conta e não pode ser alterado diretamente.
              </span>
            </div>

            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#E00000] hover:bg-[#c50000] text-white text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer shadow-md flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Salvar Nome</span>
            </button>
          </form>
        </div>

        {/* Change password */}
        <div className="p-6 rounded-2xl bg-[#121218] border border-[#232332] space-y-4">
          <h3 className="text-sm font-bold text-white font-mono uppercase">Segurança & Senha</h3>
          <form onSubmit={handleChangePassword} className="space-y-3">
            <div>
              <label className="text-[11px] font-mono text-zinc-400 uppercase block mb-1">
                Senha Atual:
              </label>
              <input
                type="password"
                value={currentPass}
                onChange={(e) => setCurrentPass(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 rounded-lg bg-[#09090d] border border-[#262635] text-xs text-white focus:outline-none focus:border-[#E00000]"
              />
            </div>

            <div>
              <label className="text-[11px] font-mono text-zinc-400 uppercase block mb-1">
                Nova Senha:
              </label>
              <input
                type="password"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full px-3 py-2 rounded-lg bg-[#09090d] border border-[#262635] text-xs text-white focus:outline-none focus:border-[#E00000]"
              />
            </div>

            <div>
              <label className="text-[11px] font-mono text-zinc-400 uppercase block mb-1">
                Confirmar Nova Senha:
              </label>
              <input
                type="password"
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                placeholder="Repita a nova senha"
                className="w-full px-3 py-2 rounded-lg bg-[#09090d] border border-[#262635] text-xs text-white focus:outline-none focus:border-[#E00000]"
              />
            </div>

            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer border border-zinc-700 flex items-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Atualizar Senha</span>
            </button>
          </form>
        </div>
      </div>

      {/* Legal and Support Quick Links */}
      <div className="p-4 rounded-xl bg-[#0f0f15] border border-[#20202c] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-xs font-mono text-zinc-400">
          <button
            onClick={() => openLegalModal('terms')}
            className="hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-zinc-500" />
            <span>Termos de Uso</span>
          </button>
          <span>•</span>
          <button
            onClick={() => openLegalModal('privacy')}
            className="hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-zinc-500" />
            <span>Política de Privacidade</span>
          </button>
          <span>•</span>
          <button
            onClick={() => openLegalModal('support')}
            className="hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5 text-zinc-500" />
            <span>Central de Suporte</span>
          </button>
        </div>

        <span className="text-[11px] font-mono text-zinc-600">
          DYARTE OPTIMIZER • Todos os direitos reservados
        </span>
      </div>
    </div>
  );
};
