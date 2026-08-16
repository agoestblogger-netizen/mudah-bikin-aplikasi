'use client';

import React, { useState } from 'react';
import { AppProjectState, TroubleshootIssue } from '@/types/app';
import { ShieldAlert, AlertTriangle, CheckCircle2, Send, HelpCircle, ArrowRight, RefreshCw, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';

interface Stage6TroubleshooterProps {
  projectState: AppProjectState;
}

export const Stage6Troubleshooter: React.FC<Stage6TroubleshooterProps> = ({ projectState }) => {
  const [selectedIssue, setSelectedIssue] = useState<TroubleshootIssue | null>(
    projectState.troubleshootIssues[0] || null
  );
  const [customError, setCustomError] = useState('');
  const [aiDiagnosis, setAiDiagnosis] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDiagnoseError = async () => {
    if (!customError.trim() || loading) return;
    setLoading(true);

    try {
      // Panggil API Route dengan stage: TAHAP_6_TROUBLESHOOTING (Instruksi: minta error dari Console dulu sebelum kasih solusi)
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: customError,
          stage: 'TAHAP_6_TROUBLESHOOTING'
        })
      });

      const data = await res.json();
      setAiDiagnosis(data.replyText || 'Diagnosa selesai.');
    } catch (err) {
      console.error('Error in troubleshooting:', err);
    } finally {
      setLoading(false);
    }
  };

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
            <p className="text-xs text-slate-400">Asisten analisa error & diagnosa kendala teknis (minta error dari Console F12 sebelum beri solusi).</p>
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
                onClick={() => {
                  setSelectedIssue(issue);
                  setAiDiagnosis('');
                }}
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

          {/* Tanya Masalah Kustom ke AI */}
          <div className="pt-4 border-t border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-slate-300">Punya Error Lain? Tanyakan AI</h4>
            <textarea
              rows={3}
              value={customError}
              onChange={(e) => setCustomError(e.target.value)}
              placeholder="Jelaskan error atau paste log dari Console (F12)..."
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-rose-500 focus:outline-none"
            />
            <button
              onClick={handleDiagnoseError}
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>Analisa Error</span>
            </button>
          </div>
        </div>

        {/* Issue Details & Diagnostic Solution */}
        <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-6">
          {aiDiagnosis ? (
            <div className="p-5 rounded-2xl bg-slate-950 border border-rose-800/60 space-y-3">
              <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">Hasil Analisa AI Troubleshooter:</span>
              <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-line">{aiDiagnosis}</p>
            </div>
          ) : selectedIssue ? (
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
