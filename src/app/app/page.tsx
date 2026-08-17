'use client';

import React, { useState, useEffect } from 'react';
import { AppProjectState } from '@/types/app';
import { initialProjectState } from '@/lib/defaultState';
import { Navbar } from '@/components/Navbar';
import { ChatPanel } from '@/components/ChatPanel';
import { supabase } from '@/lib/supabase/client';
import { buildSrcDoc } from '@/lib/buildSrcDoc';
import Link from 'next/link';
import { Eye, Code2, Download, RefreshCw, Layers } from 'lucide-react';

export default function AppWorkspacePage() {
  const [projectState, setProjectState] = useState<AppProjectState>(initialProjectState);
  const [rightPanelTab, setRightPanelTab] = useState<'PREVIEW' | 'GAS_SCRIPT'>('PREVIEW');
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // Pemeriksaan Sesi Supabase Auth Ketat (PRD Bagian 11)
  useEffect(() => {
    async function verifyAuthSession() {
      try {
        const { data } = await supabase.auth.getSession();
        if (data && data.session) {
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
        }
      } catch (err) {
        setIsAuthenticated(false);
      }
    }
    verifyAuthSession();
  }, []);

  const handleUpdateState = (updated: Partial<AppProjectState>) => {
    setProjectState((prev) => ({
      ...prev,
      ...updated,
      updatedAt: new Date().toISOString()
    }));
  };

  const handleNewSession = () => {
    setProjectState({
      ...initialProjectState,
      id: 'proj-' + Date.now(),
      updatedAt: new Date().toISOString()
    });
  };

  // PRD Bagian 9: Download index.html mandiri untuk deploy ke Cloudflare Pages
  const handleDownloadIndexHtml = () => {
    const fullHtml = buildSrcDoc(projectState.canvasCode);
    if (!fullHtml) return;

    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'index.html');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 3000);
  };

  // Guard Layar Kunci / Pemeliharaan (PRD Bagian 11)
  if (isAuthenticated === false) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-6 py-12 selection:bg-indigo-500 selection:text-white relative overflow-hidden font-sans">
        {/* Subtle ambient gradient glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-tr from-indigo-600/10 via-purple-600/10 to-pink-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-md text-center space-y-8 relative z-10">
          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Masuk Dulu untuk Lanjut
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              Untuk keamanan dan menyimpan progres pembuatan aplikasi, Anda perlu masuk ke akun Anda terlebih dahulu.
            </p>
          </div>

          <div className="space-y-4 pt-2">
            <Link
              href="/login"
              className="w-full block py-3.5 px-6 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:opacity-90 text-sm font-bold text-white transition-all shadow-lg shadow-indigo-600/30 text-center"
            >
              Masuk / Login Akun
            </Link>

            <div>
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                Kembali ke Landing Page
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="flex items-center gap-3 text-indigo-400 text-xs font-semibold">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Memverifikasi status login...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white flex flex-col">
      {/* Top Navbar Minimalis (PRD FR-09) */}
      <Navbar onNewSession={handleNewSession} />

      {/* Main 2-Panel Workspace Murni Sesuai PRD FR-09 */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* PANEL KIRI (6 Kolom): Percakapan AI Penuh */}
        <div className="lg:col-span-6 flex flex-col">
          <ChatPanel
            projectState={projectState}
            onUpdateState={handleUpdateState}
            isGenerating={isGenerating}
            setIsGenerating={setIsGenerating}
          />
        </div>

        {/* PANEL KANAN (6 Kolom): Pratinjau (Live Preview) & Backend Apps Script */}
        <div className="lg:col-span-6 flex flex-col bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden backdrop-blur-xl sticky top-20 h-[calc(100vh-100px)]">
          {/* Header Kontrol Panel Kanan */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-950/60 shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setRightPanelTab('PREVIEW')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  rightPanelTab === 'PREVIEW'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Live Preview</span>
              </button>

              <button
                onClick={() => setRightPanelTab('GAS_SCRIPT')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  rightPanelTab === 'GAS_SCRIPT'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Backend Apps Script</span>
              </button>
            </div>

            {/* Tombol Download index.html (PRD FR-11 & FR-12) */}
            <button
              onClick={handleDownloadIndexHtml}
              disabled={!projectState.canvasCode.html}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-90 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{downloaded ? 'Tersimpan!' : 'Download index.html'}</span>
            </button>
          </div>

          {/* Isi Viewport Live Preview / Script */}
          <div className="flex-1 overflow-hidden p-4 relative">
            {rightPanelTab === 'PREVIEW' ? (
              <div className="w-full h-full bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-inner flex items-center justify-center">
                {projectState.canvasCode.html ? (
                  <iframe
                    title="Live Preview Canvas"
                    srcDoc={buildSrcDoc(projectState.canvasCode)}
                    className="w-full h-full border-none bg-slate-50"
                    sandbox="allow-scripts allow-forms allow-modals"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-8 space-y-4 text-slate-500">
                    <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center text-indigo-400/60 shadow-inner">
                      <Layers className="w-8 h-8 text-indigo-400" />
                    </div>
                    <div className="space-y-1.5 max-w-sm">
                      <h4 className="text-sm font-bold text-white">Pratinjau Aplikasi Akan Muncul Di Sini</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Mulai percakapan dengan AI di panel kiri untuk mendeskripsikan aplikasi yang ingin Anda bangun. Mockup interaktif akan langsung dirender secara real-time di sini.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full h-full bg-slate-950 rounded-2xl border border-slate-800 p-4 overflow-y-auto font-mono text-xs text-emerald-400">
                {projectState.gasConfig.scriptCode ? (
                  <pre className="whitespace-pre-wrap">{projectState.gasConfig.scriptCode}</pre>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4 text-slate-500 font-sans">
                    <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center text-emerald-400/60 shadow-inner">
                      <Code2 className="w-8 h-8 text-emerald-400" />
                    </div>
                    <div className="space-y-1.5 max-w-sm">
                      <h4 className="text-sm font-bold text-white">Backend Google Apps Script Belum Dibuat</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Minta AI di panel kiri: <em>"Buatkan script Google Apps Script untuk menghubungkan aplikasi ke Google Sheets"</em>.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}
