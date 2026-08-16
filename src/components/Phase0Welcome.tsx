'use client';

import React from 'react';
import { AppProjectState, AppPhase } from '@/types/app';
import { Sparkles, CheckCircle2, ShieldCheck, Cpu, Code2, Database, Rocket, Play, Layers } from 'lucide-react';

interface Phase0WelcomeProps {
  projectState: AppProjectState;
  onNavigatePhase: (phase: AppPhase) => void;
}

export const Phase0Welcome: React.FC<Phase0WelcomeProps> = ({
  projectState,
  onNavigatePhase
}) => {
  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900/60 via-slate-900 to-purple-950/40 border border-indigo-500/20 p-8 lg:p-12 backdrop-blur-xl shadow-2xl">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-6 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Application Generator & Canvas Suite</span>
          </div>

          <h1 className="text-3xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Mudah Bikin Aplikasi <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400">
              Tanpa Hardcode, Selalu Lewat Canvas
            </span>
          </h1>

          <p className="text-slate-300 text-base leading-relaxed">
            Platform generator aplikasi pintar yang membimbing Anda dari wawancara ide, analisis Visual DNA gambar referensi,
            pembuatan prototipe fungsional di Canvas, hingga backend Google Apps Script & deploy terintegrasi.
          </p>

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-4 pt-2">
            <button
              onClick={() => onNavigatePhase('FASE_1_INTERVIEW')}
              className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white font-semibold text-sm shadow-xl shadow-indigo-600/30 hover:scale-[1.02] transition-all"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Mulai Wawancara & DNA Visual (Fase 1)</span>
            </button>

            <button
              onClick={() => onNavigatePhase('FASE_2_CANVAS')}
              className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-slate-800/90 border border-slate-700 text-slate-200 font-semibold text-sm hover:bg-slate-700/80 transition-all"
            >
              <Code2 className="w-4 h-4 text-purple-400" />
              <span>Buka Live Canvas Studio (Fase 2)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Standard Rules Checklist */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-white text-base">Kode SELALU Lewat Canvas</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Tidak ada kode HTML/CSS yang ditampilkan sebagai teks mentah di chat. Seluruh visualisasi prototipe dirender interaktif dalam Canvas viewer.
          </p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Cpu className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-white text-base">Arsitektur Dynamic State JS</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Bukan sekadar tampilan mati. Prototipe memiliki state JavaScript hidup untuk penambahan item, kalkulasi otomatis, dan aksi modal.
          </p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400">
            <Database className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-white text-base">Role Admin & Backend GAS</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Fitur Tambah User otomatis terkunci di balik autentikasi Admin, dan data siap disinkronkan ke Google Sheets via Google Apps Script.
          </p>
        </div>
      </div>

      {/* Project Status Summary */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Layers className="w-5 h-5 text-indigo-400" />
            <h2 className="font-bold text-white text-lg">Status Proyek Saat Ini</h2>
          </div>
          <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full">
            Kualitas Audit: {projectState.qualityAudit.totalScore}%
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl space-y-1">
            <span className="text-xs text-slate-400">Judul Proyek</span>
            <p className="text-sm font-semibold text-white truncate">{projectState.title}</p>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl space-y-1">
            <span className="text-xs text-slate-400">Mode Input</span>
            <p className="text-sm font-semibold text-indigo-300">
              {projectState.inputMode === 'TEXT' ? 'Wawancara Teks' : 'Visual DNA Gambar'}
            </p>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl space-y-1">
            <span className="text-xs text-slate-400">Tipe Autentikasi</span>
            <p className="text-sm font-semibold text-purple-300">
              {projectState.mandatorySpecs.loginType}
            </p>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl space-y-1">
            <span className="text-xs text-slate-400">Google Apps Script</span>
            <p className="text-sm font-semibold text-emerald-400">
              {projectState.gasConfig.isConnected ? 'Terhubung (Ready)' : 'Belum Terhubung'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
