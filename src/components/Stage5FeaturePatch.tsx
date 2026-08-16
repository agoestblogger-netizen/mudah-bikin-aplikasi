'use client';

import React, { useState } from 'react';
import { AppProjectState, FeaturePatchRequest } from '@/types/app';
import { Wrench, Sparkles, Plus, Clock, ArrowRight, RefreshCw } from 'lucide-react';

interface Stage5FeaturePatchProps {
  projectState: AppProjectState;
  onUpdateState: (updated: Partial<AppProjectState>) => void;
  onNextStage: () => void;
}

export const Stage5FeaturePatch: React.FC<Stage5FeaturePatchProps> = ({
  projectState,
  onUpdateState,
  onNextStage
}) => {
  const [patchDesc, setPatchDesc] = useState('');
  const [targetComp, setTargetComp] = useState('Dashboard & State JS');
  const [patchHistory, setPatchHistory] = useState<FeaturePatchRequest[]>(projectState.patchHistory);
  const [loading, setLoading] = useState(false);

  const handleApplyPatch = async () => {
    if (!patchDesc.trim() || loading) return;
    setLoading(true);

    try {
      // Panggil API Route dengan stage: TAHAP_5_PATCH (Instruksi: jangan generate ulang semua, cukup jelaskan + kirim bagian yang berubah)
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Terapkan pembaruan fitur pada ${targetComp}: ${patchDesc}`,
          stage: 'TAHAP_5_PATCH',
          currentCode: projectState.canvasCode
        })
      });

      const data = await res.json();
      const patchSummary = data.replyText || `Patch pada ${targetComp} berhasil diterapkan.`;

      const newPatch: FeaturePatchRequest = {
        id: 'patch-' + Date.now(),
        requestedAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        description: patchDesc,
        targetComponent: targetComp,
        status: 'APPLIED',
        patchSummary
      };

      const updatedHistory = [newPatch, ...patchHistory];
      setPatchHistory(updatedHistory);
      setPatchDesc('');

      onUpdateState({
        patchHistory: updatedHistory,
        canvasCode: data.code || projectState.canvasCode
      });
    } catch (err) {
      console.error('Error applying patch:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 lg:p-8 backdrop-blur-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Tahap 5 PRD: Pembaruan Fitur (Patch System)</h2>
            <p className="text-xs text-slate-400">Terapkan revisi fitur secara inkremental (penjelasan bagian berubah + kode HTML ter-update).</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-amber-950/60 border border-amber-800/40 px-3 py-1.5 rounded-full text-xs text-amber-300 font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Total Patch: {patchHistory.length}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Request Form */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-5">
          <h3 className="font-bold text-white text-base flex items-center gap-2">
            <Plus className="w-4 h-4 text-indigo-400" />
            1. Minta Pembaruan Fitur Baru (Patch)
          </h3>

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-300">Deskripsi Pembaruan / Revisi Fitur</label>
            <textarea
              rows={4}
              value={patchDesc}
              onChange={(e) => setPatchDesc(e.target.value)}
              placeholder="Contoh: Tambahkan tombol Export PDF pada laporan transaksi..."
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-300">Target Komponen</label>
            <select
              value={targetComp}
              onChange={(e) => setTargetComp(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-indigo-500 focus:outline-none"
            >
              <option value="Dashboard & State JS">Dashboard & State JS Canvas</option>
              <option value="Halaman Login & Role Admin">Halaman Login & Role Admin</option>
              <option value="Backend Google Apps Script">Backend Google Apps Script (code.gs)</option>
            </select>
          </div>

          <button
            onClick={handleApplyPatch}
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>AI Sedang Menerapkan Patch...</span>
              </>
            ) : (
              <>
                <Wrench className="w-4 h-4" />
                <span>Terapkan Patch ke Kode Canvas</span>
              </>
            )}
          </button>
        </div>

        {/* Patch History */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4">
          <h3 className="font-bold text-white text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            2. Riwayat Pembaruan Fitur
          </h3>

          <div className="space-y-3 max-h-[380px] overflow-y-auto pr-2 no-scrollbar">
            {patchHistory.map((p) => (
              <div key={p.id} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-300">{p.targetComponent}</span>
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full font-semibold">
                    {p.status}
                  </span>
                </div>
                <p className="text-xs text-white">{p.description}</p>
                <p className="text-[11px] text-slate-400 pt-1 border-t border-slate-800">{p.patchSummary}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="flex justify-end pt-2">
        <button
          onClick={onNextStage}
          className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 hover:scale-[1.02] transition-all"
        >
          <span>Lanjut ke Tahap 6: Penanganan Kendala (Troubleshooting)</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
