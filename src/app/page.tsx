'use client';

import React from 'react';
import Link from 'next/link';
import { Sparkles, ArrowRight, Play, CheckCircle2, ShieldCheck, Database, Rocket, Layers, Code2 } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Bar */}
      <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <span className="font-extrabold text-white text-lg tracking-tight">Mudah Bikin Aplikasi</span>
              <span className="text-xs text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full ml-2">AI Generator</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-800 text-xs font-semibold text-white transition-all"
            >
              Masuk / Register
            </Link>
            <Link
              href="/app"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:opacity-90 text-xs font-bold text-white transition-all shadow-lg shadow-indigo-600/30"
            >
              Mulai Buat Aplikasi
            </Link>
          </div>
        </div>
      </header>

      {/* Main Hero Section (ngodingpakeai.com style) */}
      <main className="max-w-7xl mx-auto px-6 py-16 space-y-16">
        <div className="text-center space-y-6 max-w-4xl mx-auto pt-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span>Platform Generator AI Tanpa Coding</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight leading-tight">
            Mau bikin aplikasi apa <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400">
              hari ini?
            </span>
          </h1>

          <p className="text-slate-300 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            Ceritakan ide aplikasi Anda sesingkat apa pun — langsung jadi kode fungsional siap pakai (Frontend + Backend Google Sheets) dengan preview live & panduan deploy.
          </p>

          <p className="text-xs text-slate-400 font-medium text-center tracking-wide">
            Product By: Agus Han (AHY Store)
          </p>

          {/* 1 Main Hero Card */}
          <div className="pt-4 max-w-xl mx-auto">
            <Link
              href="/app"
              className="group block p-8 rounded-3xl bg-gradient-to-br from-indigo-900/60 via-slate-900 to-purple-950/60 border border-indigo-500/30 hover:border-indigo-500 transition-all duration-300 shadow-2xl shadow-indigo-500/10 text-left relative overflow-hidden"
            >
              <div className="absolute -top-20 -right-20 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl group-hover:bg-indigo-500/30 transition-all" />

              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300 group-hover:scale-110 transition-transform">
                  <Code2 className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full">
                  Generator Instan
                </span>
              </div>

              <h2 className="text-xl font-extrabold text-white mb-2 group-hover:text-indigo-300 transition-colors">
                🚀 Mulai Generator Aplikasi Baru
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed mb-6">
                Masuk ke alur percakapan 6 Tahap Sesi Mockup. Diskusikan ide Anda dan saksikan prototipe interaktif dibuat secara instan di Canvas.
              </p>

              <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 group-hover:translate-x-1 transition-transform">
                <span>Mulai Percakapan AI Sekarang</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </Link>
          </div>
        </div>

        {/* Core Guarantees & Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8 pb-12">
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base">Fungsional CRUD Nyata</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Bukan sekadar mockup statis. Aplikasi memiliki State JS hidup untuk penambahan item, kalkulasi otomatis, dan penghapusan data.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Database className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base">Backend Google Apps Script</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Data otomatis tersimpan di Google Sheets tanpa biaya server tambahan bagi Anda atau pengguna akhir.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400">
              <Rocket className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base">Deploy Mandiri Cloudflare Pages</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Unduh file `index.html` dengan 1 klik, lalu drag-and-drop ke Cloudflare Pages untuk publikasi gratis.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-8 px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} Mudah Bikin Aplikasi — Platform Generator AI</p>
          <p className="font-medium text-slate-400">Product By: Agus Han (AHY Store)</p>
        </div>
      </footer>
    </div>
  );
}
