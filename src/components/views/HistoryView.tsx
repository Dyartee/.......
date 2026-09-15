import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  History,
  CheckCircle2,
  Clock,
  Filter,
  Calendar,
  Layers,
  Terminal,
  Trash2,
  Zap,
} from 'lucide-react';

export const HistoryView: React.FC = () => {
  const { history, t, getToolName } = useApp();
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'SISTEMA' | 'DESEMPENHO' | 'GAMING'>('ALL');

  const filteredHistory = history.filter((item) => {
    if (selectedFilter !== 'ALL' && item.category !== selectedFilter) {
      return false;
    }
    return true;
  });

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white font-mono uppercase">
              {t('hist_title')}
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-800 text-zinc-300">
              {history.length} {t('hist_records_count')}
            </span>
          </div>
          <p className="text-sm text-zinc-400 mt-1">
            {t('hist_subtitle')}
          </p>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-1.5 bg-[#111117] p-1 rounded-lg border border-[#21212d] text-xs font-mono">
          <button
            onClick={() => setSelectedFilter('ALL')}
            className={`px-3 py-1.5 rounded transition-colors cursor-pointer ${
              selectedFilter === 'ALL' ? 'bg-[#E00000] text-white font-bold' : 'text-zinc-400 hover:text-white'
            }`}
          >
            {t('hist_filter_all')}
          </button>
          <button
            onClick={() => setSelectedFilter('SISTEMA')}
            className={`px-3 py-1.5 rounded transition-colors cursor-pointer ${
              selectedFilter === 'SISTEMA' ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white'
            }`}
          >
            {t('cat_sistema')}
          </button>
          <button
            onClick={() => setSelectedFilter('DESEMPENHO')}
            className={`px-3 py-1.5 rounded transition-colors cursor-pointer ${
              selectedFilter === 'DESEMPENHO' ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white'
            }`}
          >
            {t('cat_desempenho')}
          </button>
          <button
            onClick={() => setSelectedFilter('GAMING')}
            className={`px-3 py-1.5 rounded transition-colors cursor-pointer ${
              selectedFilter === 'GAMING' ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white'
            }`}
          >
            {t('cat_gaming')}
          </button>
        </div>
      </div>

      {/* History Items List */}
      {filteredHistory.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-[#111117] border border-[#21212d] space-y-3">
          <History className="w-8 h-8 text-zinc-600 mx-auto" />
          <h3 className="text-base font-bold text-white font-mono">{t('hist_empty_title')}</h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            {t('hist_empty_desc')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredHistory.map((item) => {
            return (
              <div
                key={item.history_id}
                className="p-4 rounded-xl bg-[#121218] border border-[#21212d] hover:border-[#333345] transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-lg bg-emerald-950/50 border border-emerald-700/40 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono font-bold text-zinc-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-zinc-500" />
                        {item.date}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 uppercase">
                        {t(`cat_${item.category.toLowerCase()}`) || item.category}
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400 uppercase font-bold">
                        ✓ {t('hist_status_success')}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-white font-mono">
                      {getToolName({ tool_id: item.tool_id, tool_name: item.tool_name })}
                    </h4>
                    <p className="text-xs text-zinc-300 mt-0.5 leading-relaxed">{item.result}</p>
                    {item.details && (
                      <p className="text-[11px] text-zinc-500 font-mono mt-1">
                        Log: {item.details}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono text-zinc-400 shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-zinc-800">
                  <div className="text-right">
                    <span className="text-[10px] text-zinc-500 block">{t('hist_exec_time')}</span>
                    <span className="text-zinc-300 font-semibold">{item.duration_ms} ms</span>
                  </div>
                  <div className="text-right hidden sm:block">
                    <span className="text-[10px] text-zinc-500 block">{t('hist_record_id')}</span>
                    <span className="text-zinc-400">{item.history_id}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
