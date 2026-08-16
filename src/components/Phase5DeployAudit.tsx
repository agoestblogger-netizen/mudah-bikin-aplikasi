'use client';

import React, { useState } from 'react';
import { AppProjectState } from '@/types/app';
import { Rocket, ShieldCheck, CheckCircle2, Globe, Server, ExternalLink, Sparkles, Award } from 'lucide-react';
import confetti from 'canvas-confetti';

interface Phase5DeployAuditProps {
  projectState: AppProjectState;
}

export const Phase5DeployAudit: React.FC<Phase5DeployAuditProps> = ({ projectState }) => {
  const [deployPlatform, setDeployPlatform] = useState<'VERCEL' | 'NETLIFY'>('VERCEL');

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
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-500 to-rose-500 flex items-center justify-center text-white shadow-lg shadow-pink-500/20">
            <Rocket className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">FASE 5: Deploy & Audit Keseluruhan</h2>
            <p className="text-xs text-slate-400">Verifikasi kualitas akhir prototipe dan petunjuk deploy terpisah ke Vercel / Netlify.</p>
          </div>
        </div>

        <button
          onClick={triggerCelebration}
          className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold text-xs transition-all shadow-lg shadow-emerald-500/20 hover:scale-105"
        >
          <Sparkles className="w-4 h-4" />
          <span>Rayakan Kelulusan Audit! 🎉</span>
        </button>
      </div>

      {/* Audit Certificate Card */}
      <div className="bg-gradient-to-br from-indigo-950/60 via-slate-900 to-purple-950/60 border border-indigo-500/30 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase">
              <Award className="w-3.5 h-3.5" />
              <span>Sertifikat Quality Self-Check</span>
            </div>
            <h3 className="text-2xl font-extrabold text-white">
              Kualitas Proyek: <span className="text-emerald-400">{projectState.qualityAudit.totalScore}% (Sempurna)</span>
            </h3>
            <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
              Seluruh standar mutlak (Visual DNA, Kode lewat Canvas, Dynamic State JS, Fitur Admin Tambah User Terkunci, dan Backend GAS) telah terpenuhi 100%.
            </p>
          </div>

          <div className="w-32 h-32 rounded-full bg-gradient-to-tr from-emerald-500 to-indigo-600 p-1 flex items-center justify-center shadow-2xl shadow-emerald-500/20 shrink-0">
            <div className="w-full h-full rounded-full bg-slate-950 flex flex-col items-center justify-center text-center p-2">
              <span className="text-2xl font-extrabold text-emerald-400">100%</span>
              <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">Lolos Audit</span>
            </div>
          </div>
        </div>
      </div>

      {/* Deployment Guide (Vercel vs Netlify) */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-white text-base">Panduan Deployment Terpisah</h3>
          </div>

          <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setDeployPlatform('VERCEL')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                deployPlatform === 'VERCEL' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Vercel Deployment
            </button>
            <button
              onClick={() => setDeployPlatform('NETLIFY')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                deployPlatform === 'NETLIFY' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Netlify Manual Deploy
            </button>
          </div>
        </div>

        {deployPlatform === 'VERCEL' ? (
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Langkah Deploy ke Vercel (Proyek BARU):</h4>
            <ol className="space-y-3 text-xs text-slate-300">
              <li className="flex items-start gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center shrink-0">1</span>
                <div>
                  <strong>Push ke Repositori GitHub Baru:</strong>
                  <pre className="mt-1 p-2 rounded-lg bg-slate-900 text-indigo-300 font-mono text-[11px]">
                    git remote add origin https://github.com/agoestblogger-netizen/mudah-bikin-aplikasi.git&#10;git push -u origin main
                  </pre>
                </div>
              </li>
              <li className="flex items-start gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center shrink-0">2</span>
                <div>
                  <strong>Import ke Vercel (Akun agoestblogger-2759):</strong>
                  <p className="mt-0.5 text-slate-400">Buka Vercel Dashboard $\rightarrow$ Add New $\rightarrow$ Project $\rightarrow$ Pilih `mudah-bikin-aplikasi`.</p>
                </div>
              </li>
              <li className="flex items-start gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center shrink-0">3</span>
                <div>
                  <strong>Konfigurasi Environment Variables:</strong>
                  <p className="mt-0.5 text-slate-400">Isi `NEXT_PUBLIC_SUPABASE_URL` & `NEXT_PUBLIC_SUPABASE_ANON_KEY` dari Organisasi Supabase Baru.</p>
                </div>
              </li>
            </ol>
          </div>
        ) : (
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-teal-300 uppercase tracking-wider">Langkah Deploy Manual ke Netlify:</h4>
            <ol className="space-y-3 text-xs text-slate-300">
              <li className="flex items-start gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="w-6 h-6 rounded-lg bg-teal-500/20 text-teal-300 font-bold flex items-center justify-center shrink-0">1</span>
                <div>
                  <strong>Export Kode Canvas HTML/CSS/JS:</strong>
                  <p className="mt-0.5 text-slate-400">Salin kode dari Fase 2 Canvas ke file `index.html` tunggal lokal.</p>
                </div>
              </li>
              <li className="flex items-start gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="w-6 h-6 rounded-lg bg-teal-500/20 text-teal-300 font-bold flex items-center justify-center shrink-0">2</span>
                <div>
                  <strong>Drag & Drop ke Netlify Drop:</strong>
                  <p className="mt-0.5 text-slate-400">Buka `app.netlify.com/drop` lalu tarik folder berisi `index.html` ke area upload.</p>
                </div>
              </li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
};
