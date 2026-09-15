import React from 'react';
import { useApp } from '../../context/AppContext';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useApp();

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => {
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-lg border shadow-2xl backdrop-blur-md ${
                toast.type === 'success'
                  ? 'bg-[#0f1912]/95 border-emerald-600/40 text-white'
                  : toast.type === 'error'
                  ? 'bg-[#1e0d0d]/95 border-[#E00000]/60 text-white'
                  : toast.type === 'warning'
                  ? 'bg-[#1d1607]/95 border-amber-500/40 text-white'
                  : 'bg-[#121217]/95 border-[#2c2c38] text-white'
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-[#FF3333]" />}
                {toast.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400" />}
                {toast.type === 'info' && <Info className="w-4 h-4 text-blue-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold tracking-wide uppercase text-zinc-300">
                  {toast.title}
                </div>
                <div className="text-xs text-zinc-400 mt-0.5 leading-relaxed break-words">
                  {toast.message}
                </div>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-zinc-500 hover:text-white p-1 rounded transition-colors shrink-0"
                aria-label="Fechar notificação"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
