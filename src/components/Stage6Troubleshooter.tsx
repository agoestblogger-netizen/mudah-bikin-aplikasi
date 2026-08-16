'use client';

import React, { useState } from 'react';
import { AppProjectState, TroubleshootIssue } from '@/types/app';
import { ShieldAlert, AlertTriangle, CheckCircle2, RefreshCw, HelpCircle, ArrowRight, Play, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';

interface Stage6TroubleshooterProps {
  projectState: AppProjectState;
}

export const Stage6Troubleshooter: React.FC<Stage6TroubleshooterProps> = ({ projectState }) => {
  const [selectedIssue, setSelectedIssue] = useState<TroubleshootIssue | null>(
    projectState.troubleshootIssues[0] || null
  );

  const triggerCelebration = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 lg:p-8 backdrop-blur-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Tahap 6 PRD: Penanganan Kendala (Troubleshooting Suite)</h2>
            <p className="text-xs text-slate-400">Asisten analisa error & diagnosa kendala teknis (CORS, Apps Script, Login Admin, Validation Error).</p>
          </div>
        </div>

        <button
          onClick={triggerCelebration}
          className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold text-xs transition-all shadow-lg shadow-emerald-500/20 hover:scale-105"
        >
          <Sparkles className="w-4 h-4" />
          <span>Selesai Seluruh 6 Tahap! 🎉</span>
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Issue Selector */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4">
          <h3 className="font-bold text-white text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            Daftar Kendala Terdeteksi
          </h3>

          <div className="space-y-3">
            {projectState.troubleshootIssues.map((issue) => (
              <button
                key={issue.id}
                onClick={() => setSelectedIssue(issue)}
                className={`w-full p-4 rounded-2xl border text-left transition-all ${
                  selectedIssue?.id === issue.id
                    ? 'bg-rose-950/30 border-rose-500 text-white shadow-lg shadow-rose-500/10'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-400">{issue.category}</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <h4 className="text-xs font-semibold text-white">{issue.title}</h4>
              </button>
            ))}
          </div>
        </div>

        {/* Issue Details & Diagnostic Solution */}
        <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-6">
          {selectedIssue ? (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">Diagnosa Kendala</span>
                <h3 className="text-base font-bold text-white">{selectedIssue.title}</h3>
                <p className="text-xs text-rose-300 font-mono bg-rose-950/40 p-2 rounded-xl border border-rose-900/40">
                  ⚠️ {selectedIssue.symptom}
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Akar Penyebab:</h4>
                <p className="text-xs text-slate-300 bg-slate-950 p-3 rounded-xl border border-slate-800">
                  {selectedIssue.rootCause}
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Langkah Solusi Terstruktur:</h4>
                <div className="space-y-2">
                  {selectedIssue.solutionSteps.map((step, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200">
                      <span className="w-5 h-5 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[11px]">
                        {idx + 1}
                      </span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400">Pilih salah satu kendala di samping untuk melihat analisa dan perbaikan.</p>
          )}
        </div>
      </div>
    </div>
  );
};
