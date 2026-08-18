'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AppProjectState } from '@/types/app';
import { initialProjectState } from '@/lib/defaultState';
import { Navbar } from '@/components/Navbar';
import { ChatPanel } from '@/components/ChatPanel';
import { BuildBadge } from '@/components/BuildBadge';
import { supabase } from '@/lib/supabase/client';
import { buildSrcDoc } from '@/lib/buildSrcDoc';
import Link from 'next/link';
import { Eye, Code2, Download, RefreshCw, Layers, Maximize2, Minimize2 } from 'lucide-react';

// Urutan langkah progress yang ditampilkan di preview saat generate kode batch
const GENERATE_PROGRESS_STEPS = [
  { label: 'Menganalisa kebutuhan aplikasi...', pct: 10 },
  { label: 'Menyusun struktur HTML & layout...', pct: 28 },
  { label: 'Menulis komponen & fungsi JavaScript...', pct: 52 },
  { label: 'Menyempurnakan interaksi & tampilan...', pct: 72 },
  { label: 'Memvalidasi kode & logika...', pct: 88 },
  { label: 'Menyelesaikan & menyiapkan preview...', pct: 97 },
];

export default function AppWorkspacePage() {
  const router = useRouter();
  const [projectState, setProjectState] = useState<AppProjectState>(initialProjectState);
  const [rightPanelTab, setRightPanelTab] = useState<'PREVIEW' | 'GAS_SCRIPT'>('PREVIEW');
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [userEmail, setUserEmail] = useState<string | undefined>(undefined);
  const [isPreviewFullscreen, setIsPreviewFullscreen] = useState(false);

  // Shortcut Keyboard Esc untuk keluar dari Fullscreen (Poin 37)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isPreviewFullscreen) {
        setIsPreviewFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPreviewFullscreen]);


  // Pemeriksaan Sesi Supabase Auth Ketat
  useEffect(() => {
    let isMounted = true;

    async function verifyAuthSession() {
      if (typeof window !== 'undefined') {
        const hash = window.location.hash;
        const search = window.location.search;

        // Cek jika ada error di Hash / Search (misal: link expired / used)
        if (hash && (hash.includes('error=') || hash.includes('error_description='))) {
          const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.substring(1) : hash);
          const desc = hashParams.get('error_description') || hashParams.get('error');
          if (desc) {
            router.push(`/login?error_msg=${encodeURIComponent('Link konfirmasi email tidak valid atau sudah kedaluwarsa. Silakan minta link baru atau coba masuk.')}`);
            return;
          }
        }

        // Cek jika ada code PKCE di query
        const searchParams = new URLSearchParams(search);
        const code = searchParams.get('code');
        if (code) {
          try {
            const { data: codeData, error } = await supabase.auth.exchangeCodeForSession(code);
            if (!error && codeData.session?.user) {
              if (isMounted) {
                setIsAuthenticated(true);
                setUserEmail(codeData.session.user.email);
              }
              return;
            }
          } catch (err) {
            // Lanjut ke getSession fallback
          }
        }
      }

      try {
        const { data } = await supabase.auth.getSession();
        if (data && data.session && data.session.user) {
          if (isMounted) {
            setIsAuthenticated(true);
            setUserEmail(data.session.user.email);
          }
        } else {
          if (isMounted) {
            setIsAuthenticated(false);
          }
        }
      } catch (err) {
        if (isMounted) {
          setIsAuthenticated(false);
        }
      }
    }

    verifyAuthSession();

    // Dengarkan perubahan state auth secara live
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && session.user) {
        if (isMounted) {
          setIsAuthenticated(true);
          setUserEmail(session.user.email);
        }
      } else if (event === 'SIGNED_OUT') {
        if (isMounted) {
          setIsAuthenticated(false);
          setUserEmail(undefined);
        }
      }
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [router]);

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
      <Navbar userEmail={userEmail} onNewSession={handleNewSession} />

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

        {/* PANEL KANAN: Pratinjau (Live Preview) & Backend Apps Script (Mendukung Fullscreen Poin 37) */}
        <div
          className={
            isPreviewFullscreen
              ? 'fixed inset-0 z-50 p-3 sm:p-5 bg-slate-950/95 backdrop-blur-2xl flex flex-col transition-all duration-300 ease-in-out'
              : 'lg:col-span-6 flex flex-col bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden backdrop-blur-xl sticky top-20 h-[calc(100vh-100px)] transition-all duration-300 ease-in-out'
          }
        >
          <div className={isPreviewFullscreen ? 'flex-1 flex flex-col bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl h-full' : 'flex-1 flex flex-col h-full overflow-hidden'}>
            {/* Header Kontrol Panel Kanan */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-950/60 shrink-0 gap-2">
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

              {/* Aksi Kanan: Download index.html & Fullscreen Toggle */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadIndexHtml}
                  disabled={!projectState.canvasCode.html}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-90 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 disabled:opacity-40"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{downloaded ? 'Tersimpan!' : 'Download index.html'}</span>
                  <span className="sm:hidden">Download</span>
                </button>

                {/* Tombol Fullscreen Expand / Collapse (Poin 37) */}
                <button
                  onClick={() => setIsPreviewFullscreen(prev => !prev)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    isPreviewFullscreen
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30'
                      : 'bg-slate-900/90 text-slate-300 border-slate-700 hover:text-white hover:bg-slate-800'
                  }`}
                  title={isPreviewFullscreen ? 'Tutup Fullscreen (Esc)' : 'Perbesar Fullscreen'}
                  aria-label={isPreviewFullscreen ? 'Tutup Fullscreen' : 'Perbesar Fullscreen'}
                >
                  {isPreviewFullscreen ? (
                    <>
                      <Minimize2 className="w-3.5 h-3.5" />
                      <span className="hidden md:inline">Tutup Fullscreen</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span className="hidden md:inline">Fullscreen</span>
                    </>
                  )}
                </button>
              </div>
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
                  ) : isGenerating ? (
                    // === POIN 16: SKELETON PROGRESS SAAT GENERATE KODE BATCH ===
                    <GeneratingSkeletonPreview />
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
        </div>


      </main>

      {/* Poin 17: Build version badge (pojok kanan bawah) */}
      <BuildBadge />
    </div>
  );
}

// =============================================================================
// POIN 16: KOMPONEN SKELETON PREVIEW SAAT AI MEMBANGUN APLIKASI (BATCH PIPELINE)
// Menampilkan langkah-langkah perkiraan tahapan secara berurutan, jujur dilabeli
// sebagai perkiraan (bukan real-time progress sesungguhnya). Animasi shimmer estetis.
// =============================================================================
function GeneratingSkeletonPreview() {
  const [stepIdx, setStepIdx] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Maju 1 langkah setiap ~8 detik (6 langkah × 8s = 48s, lalu freeze di step terakhir)
    intervalRef.current = setInterval(() => {
      setStepIdx(prev => Math.min(prev + 1, GENERATE_PROGRESS_STEPS.length - 1));
    }, 8000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const currentStep = GENERATE_PROGRESS_STEPS[stepIdx];

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-6 gap-6">
      {/* Animasi icon */}
      <div className="relative">
        <div className="w-16 h-16 rounded-2xl bg-indigo-900/40 border border-indigo-500/30 flex items-center justify-center shadow-lg shadow-indigo-500/10">
          <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" style={{ animationDuration: '1.5s' }} />
        </div>
        <div className="absolute inset-0 rounded-2xl bg-indigo-500/10 animate-ping" style={{ animationDuration: '2s' }} />
      </div>

      {/* Label tahapan */}
      <div className="text-center space-y-1 max-w-xs">
        <p className="text-xs font-semibold text-indigo-300">{currentStep.label}</p>
        <p className="text-[10px] text-slate-500 italic">*perkiraan tahapan, bukan progress real-time</p>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-xs">
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-[2000ms] ease-out"
            style={{ width: `${currentStep.pct}%` }}
          />
        </div>
        <p className="text-right text-[10px] text-slate-500 mt-1">{currentStep.pct}%</p>
      </div>

      {/* Skeleton baris konten palsu */}
      <div className="w-full max-w-xs space-y-2.5 mt-2">
        {/* Skeleton "header" aplikasi */}
        <div className="h-6 rounded-lg bg-slate-800 animate-pulse w-3/4" />
        <div className="h-4 rounded-lg bg-slate-800/70 animate-pulse w-full" />
        <div className="h-4 rounded-lg bg-slate-800/70 animate-pulse w-5/6" />
        {/* Skeleton "tabel" */}
        <div className="mt-3 space-y-1.5">
          <div className="h-5 rounded bg-slate-800 animate-pulse w-full" />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-4 rounded bg-slate-800/50 animate-pulse w-full" style={{ animationDelay: `${i * 150}ms` }} />
          ))}
        </div>
        {/* Skeleton "tombol" */}
        <div className="flex gap-2 pt-1">
          <div className="h-7 rounded-lg bg-indigo-900/50 animate-pulse w-20" />
          <div className="h-7 rounded-lg bg-slate-800/50 animate-pulse w-16" />
        </div>
      </div>
    </div>
  );
}
