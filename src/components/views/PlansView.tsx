import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Plan, PlanId } from '../../types';
import {
  Check,
  CheckCircle2,
  Crown,
  ExternalLink,
  Flame,
  Gem,
  HelpCircle,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';

export const PlansView: React.FC = () => {
  const { plans, currentUser, config, adminProcessWebhookPayment, addToast, t } = useApp();

  const [simulatedEmail, setSimulatedEmail] = useState(currentUser?.email || '');
  const [isSimulatingPayment, setIsSimulatingPayment] = useState(false);
  const [selectedPlanForSim, setSelectedPlanForSim] = useState<PlanId>('completo');

  const handleExternalBuy = (plan: Plan) => {
    const url = config[plan.checkoutUrlKey] || 'https://dyarte.com/planos';
    addToast(
      'info',
      t('toast_checkout_title'),
      `${t('toast_checkout_msg')} ${plan.name}: ${url}`
    );
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleSimulateWebhook = async (planId: PlanId) => {
    setIsSimulatingPayment(true);
    const targetPlan = plans.find((p) => p.id === planId);
    if (!targetPlan) return;

    await new Promise((resolve) => setTimeout(resolve, 1200));

    adminProcessWebhookPayment({
      email: simulatedEmail || currentUser?.email || 'cliente@email.com',
      plan_id: planId,
      transaction_id: `TX-${Math.floor(100000 + Math.random() * 900000)}`,
      amount: targetPlan.price,
    });

    setIsSimulatingPayment(false);
  };

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Title */}
      <div className="text-center max-w-2xl mx-auto space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E00000]/15 border border-[#E00000]/40 text-[#FF4444] text-xs font-mono font-bold uppercase">
          <Gem className="w-3.5 h-3.5" />
          {t('plans_badge_official')}
        </div>
        <h1 className="text-3xl font-extrabold text-white font-mono uppercase tracking-tight">
          {t('plans_title')}
        </h1>
        <p className="text-sm text-zinc-400 leading-relaxed">
          {t('plans_subtitle')}
        </p>
      </div>

      {/* 3 Cards Desktop Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch max-w-5xl mx-auto">
        {plans.map((plan) => {
          const userPlanLevel = currentUser?.nivel_plano ?? 0;
          const isCurrentPlan =
            (userPlanLevel > 0 && userPlanLevel === plan.level) ||
            currentUser?.plano_atual.toUpperCase() === plan.name.toUpperCase();
          const isPreviousPlan = userPlanLevel > plan.level;
          const isComplete = plan.id === 'completo';

          return (
            <div
              key={plan.id}
              className={`rounded-2xl p-6 flex flex-col justify-between relative transition-all duration-300 ${
                isCurrentPlan
                  ? 'bg-gradient-to-b from-[#220d0d] via-[#160b0d] to-[#0f0d12] border-2 border-[#E00000] shadow-[0_0_35px_rgba(224,0,0,0.5)] ring-2 ring-[#E00000]/60 z-10'
                  : isPreviousPlan
                  ? 'bg-[#0d0d12] border border-zinc-800 text-zinc-500 opacity-60 grayscale-[35%]'
                  : isComplete
                  ? 'bg-gradient-to-b from-[#1c1212] via-[#141015] to-[#0d0d11] border border-[#E00000]/50 hover:border-[#E00000] shadow-[0_0_20px_rgba(224,0,0,0.2)]'
                  : 'bg-[#121218] border border-[#232330] hover:border-[#3a3a4c]'
              }`}
            >
              {/* Badge on Top */}
              {isCurrentPlan ? (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 rounded-full text-[10px] font-mono font-black uppercase tracking-wider bg-[#E00000] text-white shadow-[0_0_15px_rgba(224,0,0,0.7)] whitespace-nowrap flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{t('plan_current_active')}</span>
                  </span>
                </div>
              ) : isPreviousPlan ? (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-2.5 py-0.5 rounded-full text-[9px] font-mono uppercase tracking-wider bg-zinc-800 text-zinc-400 border border-zinc-700 whitespace-nowrap">
                    {t('plan_included_in_plan')}
                  </span>
                </div>
              ) : plan.badge ? (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span
                    className={`px-3 py-1 rounded-full text-[10px] font-mono font-extrabold uppercase tracking-wider shadow-md whitespace-nowrap ${
                      plan.badgeType === 'max'
                        ? 'bg-[#E00000] text-white shadow-[0_0_12px_rgba(224,0,0,0.6)]'
                        : 'bg-amber-400 text-black font-bold'
                    }`}
                  >
                    {plan.badgeType === 'max' ? t('plan_badge_max') : t('plan_badge_rec')}
                  </span>
                </div>
              ) : null}

              <div>
                {/* Plan Header */}
                <div className="flex items-center justify-between mb-3 mt-1">
                  <h3
                    className={`text-lg font-extrabold font-mono uppercase ${
                      isCurrentPlan ? 'text-white' : isPreviousPlan ? 'text-zinc-400' : 'text-white'
                    }`}
                  >
                    {t(`plan_name_${plan.id}`) || plan.name}
                  </h3>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                      isCurrentPlan
                        ? 'bg-[#E00000]/20 text-[#FF5555] border border-[#E00000]/40'
                        : 'bg-zinc-800 text-zinc-300'
                    }`}
                  >
                    {t('plan_level_label')} {plan.level}
                  </span>
                </div>

                <p
                  className={`text-xs min-h-[34px] leading-relaxed ${
                    isPreviousPlan ? 'text-zinc-500' : 'text-zinc-400'
                  }`}
                >
                  {t(`plan_desc_${plan.id}`) || plan.description}
                </p>

                {/* Price Display */}
                <div
                  className={`my-5 pb-5 border-b ${
                    isCurrentPlan
                      ? 'border-[#E00000]/40'
                      : isPreviousPlan
                      ? 'border-zinc-800/80'
                      : 'border-zinc-800'
                  }`}
                >
                  <div className="flex items-baseline gap-1">
                    <span className="text-xs text-zinc-400 font-mono">R$</span>
                    <span
                      className={`text-3xl font-black font-mono ${
                        isPreviousPlan ? 'text-zinc-400' : 'text-white'
                      }`}
                    >
                      {plan.price.toFixed(2).replace('.', ',')}
                    </span>
                    <span className="text-xs text-zinc-500 font-mono">/{t('plan_period_month')}</span>
                  </div>
                </div>

                {/* Features List */}
                <div className="space-y-2.5 mb-6">
                  <span className="text-[10px] font-mono uppercase text-zinc-500 font-bold tracking-wider block">
                    {t('plan_features_label')}:
                  </span>
                  {plan.features.map((feature, idx) => (
                    <div
                      key={idx}
                      className={`flex items-start gap-2.5 text-xs ${
                        isPreviousPlan ? 'text-zinc-500' : 'text-zinc-300'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                          isCurrentPlan
                            ? 'bg-[#E00000] text-white'
                            : isPreviousPlan
                            ? 'bg-zinc-800 text-zinc-500'
                            : isComplete
                            ? 'bg-[#E00000]/20 text-[#FF4444]'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        <Check className="w-2.5 h-2.5" />
                      </div>
                      <span className="leading-tight">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2">
                {isCurrentPlan ? (
                  <div className="w-full py-3 px-4 rounded-xl bg-[#E00000]/20 border border-[#E00000] text-white text-xs font-mono font-bold text-center uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(224,0,0,0.3)]">
                    <CheckCircle2 className="w-4 h-4 text-[#FF4444]" />
                    <span>{t('plan_current_active')}</span>
                  </div>
                ) : isPreviousPlan ? (
                  <div className="w-full py-3 px-4 rounded-xl bg-zinc-900/90 border border-zinc-800 text-zinc-500 text-xs font-mono font-semibold text-center uppercase tracking-wider flex items-center justify-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-zinc-600" />
                    <span>{t('plan_included_in_plan')}</span>
                  </div>
                ) : (
                  <button
                    onClick={() => handleExternalBuy(plan)}
                    className="w-full py-3 px-4 rounded-xl text-xs font-mono font-extrabold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer bg-[#E00000] hover:bg-[#c50000] text-white shadow-[0_0_20px_rgba(224,0,0,0.4)] hover:shadow-[0_0_28px_rgba(224,0,0,0.6)]"
                  >
                    <span>{t('plan_buy_official')}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Architecture & Webhook Live Simulation Card - Visible exclusively to Administrator */}
      {currentUser?.role === 'ADMIN' && (
        <div className="p-6 rounded-2xl bg-[#101017] border border-amber-500/30 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white font-mono uppercase">
                  {t('plans_webhook_title')} <span className="text-amber-400 text-xs font-mono ml-2">[PAINEL ADMINISTRATIVO]</span>
                </h3>
              </div>
              <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
                Ambiente de teste e simulação de ativação de licenças via webhook oficial DYARTE. Restrito ao administrador.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedPlanForSim}
                onChange={(e) => setSelectedPlanForSim(e.target.value as PlanId)}
                className="px-3 py-2 rounded-lg bg-[#09090d] border border-zinc-700 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
              >
                <option value="medio">{t('plan_name_medio')} (R$ 30,00)</option>
                <option value="avancado">{t('plan_name_avancado')} (R$ 45,00)</option>
                <option value="completo">{t('plan_name_completo')} (R$ 60,00)</option>
              </select>

              <button
                onClick={() => handleSimulateWebhook(selectedPlanForSim)}
                disabled={isSimulatingPayment}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50"
              >
                {isSimulatingPayment ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>{t('plans_syncing')}</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    <span>Testar Ativação</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Visual Architecture Flow Diagram */}
          <div className="p-4 rounded-xl bg-[#09090d] border border-zinc-800/80 font-mono text-[11px] text-zinc-400 overflow-x-auto">
            <div className="flex items-center gap-2 text-zinc-300 min-w-[600px]">
              <span className="text-white font-bold">{t('plans_flow_client')}</span>
              <span>→</span>
              <span className="text-zinc-400">{t('plans_flow_choose')}</span>
              <span>→</span>
              <span className="text-rose-400">{t('plans_flow_checkout')}</span>
              <span>→</span>
              <span className="text-emerald-400 font-bold">{t('plans_flow_approved')}</span>
              <span>→</span>
              <span className="text-amber-400 font-bold">{t('plans_flow_sync')}</span>
              <span>→</span>
              <span className="text-[#FF4444] font-bold">{t('plans_flow_updated')}</span>
              <span>→</span>
              <span className="text-white font-bold">{t('plans_flow_unlocked')}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
