'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AppProjectState, SavedProject } from '@/types/app';
import { initialProjectState } from '@/lib/defaultState';
import { Navbar } from '@/components/Navbar';
import { ChatPanel } from '@/components/ChatPanel';
import { SavedProjectsList } from '@/components/SavedProjectsList';
import { BuildBadge } from '@/components/BuildBadge';
import { supabase } from '@/lib/supabase/client';
import { buildSrcDoc } from '@/lib/buildSrcDoc';
import Link from 'next/link';
import { Eye, Code2, Download, RefreshCw, Layers, Maximize2, Minimize2, FolderOpen, ChevronsLeft, ChevronsRight } from 'lucide-react';

// Urutan langkah progress yang ditampilkan di preview saat generate kode batch
const GENERATE_PROGRESS_STEPS = [
  { label: 'Menganalisa kebutuhan aplikasi...', pct: 10 },
  { label: 'Menyusun struktur HTML & layout...', pct: 28 },
  { label: 'Menulis komponen & fungsi JavaScript...', pct: 52 },
  { label: 'Menyempurnakan interaksi & tampilan...', pct: 72 },
  { label: 'Memvalidasi kode & logika...', pct: 88 },
  { label: 'Menyelesaikan & menyiapkan preview...', pct: 97 },
];

// Klien menyimpan sesi di localStorage; sertakan token akses ke route server
async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function AppWorkspacePage() {
  const router = useRouter();
  const [projectState, setProjectState] = useState<AppProjectState>(initialProjectState);
  const [rightPanelTab, setRightPanelTab] = useState<'PREVIEW' | 'GAS_SCRIPT' | 'SAVED'>('SAVED');
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [userEmail, setUserEmail] = useState<string | undefined>(undefined);
  const [isPreviewFullscreen, setIsPreviewFullscreen] = useState(false);
  const [sideRailExpanded, setSideRailExpanded] = useState(false);
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [savedLoaded, setSavedLoaded] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const lastSavedCanvasRef = useRef('');
  const lastSavedAnnotationsRef = useRef<string>('');
  const autoSavedProjectIdRef = useRef<string | null>(null);

  // OpenDesign-like marks/comments/patches
  const [interactionMode, setInteractionMode] = useState<'select' | 'mark'>('select');
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [overlaySize, setOverlaySize] = useState({ w: 0, h: 0 });
  const [activeSelection, setActiveSelection] = useState<
    | null
    | {
        markId: string;
        kind: 'area' | 'element';
        bounds: { x: number; y: number; w: number; h: number };
        elementUid?: string;
        initialText?: string;
        initialColor?: string;
      }
  >(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [textColorDraft, setTextColorDraft] = useState('');
  const [textContentDraft, setTextContentDraft] = useState('');

  const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
  const selectionPx = (() => {
    if (!activeSelection) return null;
    if (!overlaySize.w || !overlaySize.h) return null;
    const left = activeSelection.bounds.x * overlaySize.w;
    const top = activeSelection.bounds.y * overlaySize.h;
    const width = activeSelection.bounds.w * overlaySize.w;
    const height = activeSelection.bounds.h * overlaySize.h;
    if (width <= 1 || height <= 1) return null;
    const anchorLeft = clamp(left + width / 2, 120, Math.max(120, overlaySize.w - 120));
    const anchorTop = clamp(top, 60, Math.max(60, overlaySize.h - 60));
    return { left, top, width, height, anchorLeft, anchorTop };
  })();

  const annotationsRef = useRef(projectState.annotations);
  useEffect(() => {
    annotationsRef.current = projectState.annotations;
  }, [projectState.annotations]);

  const canvasHtmlRef = useRef(projectState.canvasCode.html);
  useEffect(() => {
    canvasHtmlRef.current = projectState.canvasCode.html;
  }, [projectState.canvasCode.html]);

  const rightPanelTabRef = useRef(rightPanelTab);
  useEffect(() => {
    rightPanelTabRef.current = rightPanelTab;
  }, [rightPanelTab]);

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

  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setOverlaySize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    const r = el.getBoundingClientRect();
    setOverlaySize({ w: r.width, h: r.height });
    return () => ro.disconnect();
  }, [projectState.canvasCode.html, rightPanelTab, isPreviewFullscreen]);

  const newOdId = () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const c: any = typeof crypto !== 'undefined' ? crypto : null;
      if (c?.randomUUID) return c.randomUUID();
    } catch {}
    return 'od_' + Date.now() + '_' + Math.random().toString(16).slice(2);
  };

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      if (data.source !== 'OD_BRIDGE') return;

      if (rightPanelTabRef.current !== 'PREVIEW') return;
      if (!canvasHtmlRef.current) return;

      if (data.type === 'OD_SELECT_ELEMENT') {
        const elementUid: string | undefined = data.elementUid;
        if (!elementUid) return;
        const markId = newOdId();
        const bounds = data.bounds;
        if (!bounds) return;

        const patches = annotationsRef.current?.patches || [];
        const lastColor = [...patches].reverse().find((p) => p.elementUid === elementUid && p.patchType === 'textColor');
        const lastText = [...patches].reverse().find((p) => p.elementUid === elementUid && p.patchType === 'textContent');

        const initialColor = lastColor?.value ?? data.currentColor ?? '';
        const initialText = lastText?.value ?? data.currentText ?? '';

        setActiveSelection({
          markId,
          kind: 'element',
          bounds,
          elementUid,
          initialColor,
          initialText
        });
        setNoteDraft('');
        setTextColorDraft(String(initialColor || ''));
        setTextContentDraft(String(initialText || ''));
      } else if (data.type === 'OD_AREA_MARK') {
        const markId = newOdId();
        const bounds = data.bounds;
        if (!bounds) return;
        setActiveSelection({ markId, kind: 'area', bounds });
        setNoteDraft('');
        setTextColorDraft('');
        setTextContentDraft('');
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage({ source: 'OD_BRIDGE', type: 'OD_MODE', mode: interactionMode }, '*');
  }, [interactionMode]);


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
    const merged: AppProjectState = {
      ...projectState,
      ...updated,
      updatedAt: new Date().toISOString()
    };
    setProjectState(merged);
    if (updated.canvasCode?.html || updated.annotations) {
      setRightPanelTab('PREVIEW');
      handleAutoSaveProject(merged);
    }
  };

  // Saat generate dimulai, otomatis pindah ke tab Live Preview agar progress bar
  // dan hasil prototype langsung terlihat (tidak tertinggal di tab Tersimpan).
  const handleSetGenerating = useCallback((val: boolean) => {
    if (val) {
      setRightPanelTab('PREVIEW');
    }
    setIsGenerating(val);
  }, []);

  const handleNewSession = () => {
    setProjectState({
      ...initialProjectState,
      id: 'proj-' + Date.now(),
      updatedAt: new Date().toISOString()
    });
    lastSavedCanvasRef.current = '';
    lastSavedAnnotationsRef.current = '';
    autoSavedProjectIdRef.current = null;
    setRightPanelTab('SAVED');
  };

  // =====================================================================
  // Fitur "Tersimpan" (Saved Prototypes)
  // =====================================================================
  const handleAutoSaveProject = useCallback((snapshot: AppProjectState) => {
    if (!isAuthenticated) return;
    const html = snapshot.canvasCode.html || '';
    const annotationsJson = JSON.stringify(snapshot.annotations || { marks: [], notes: [], patches: [] });
    if (!html) return;
    if (html === lastSavedCanvasRef.current && annotationsJson === lastSavedAnnotationsRef.current) return;
    lastSavedCanvasRef.current = html;
    lastSavedAnnotationsRef.current = annotationsJson;

    const body = {
      title: snapshot.title || 'Aplikasi Tanpa Nama',
      description: snapshot.description,
      canvas_html: html,
      canvas_css: snapshot.canvasCode.css || '',
      canvas_js: snapshot.canvasCode.js || '',
      gas_script: snapshot.gasConfig.scriptCode || '',
      gas_web_app_url: snapshot.gasConfig.webAppUrl || '',
      spreadsheet_id: snapshot.gasConfig.sheetId || '',
      annotations: snapshot.annotations || { marks: [], notes: [], patches: [] }
    };

    (async () => {
      try {
        const headers = await getAuthHeaders();

        if (autoSavedProjectIdRef.current) {
          const id = autoSavedProjectIdRef.current;
          const res = await fetch(`/api/projects/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...headers },
            body: JSON.stringify(body)
          });
          if (!res.ok) return;
          const data = (await res.json()) as { project?: SavedProject };
          if (data.project) {
            setSavedProjects((prev) => [data.project!, ...prev.filter((p) => p.id !== data.project!.id)].slice(0, 50));
          }
          return;
        }

        const res = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: JSON.stringify(body)
        });
        if (!res.ok) return;
        const data = (await res.json()) as { project?: SavedProject };
        if (data.project) {
          autoSavedProjectIdRef.current = data.project.id;
          setSavedProjects((prev) => [data.project!, ...prev.filter((p) => p.id !== data.project!.id)].slice(0, 50));
        }
      } catch (err) {
        console.error('Failed to auto-save project:', err);
      }
    })();
  }, [isAuthenticated]);

  const handleLoadProject = (project: SavedProject) => {
    lastSavedCanvasRef.current = project.canvas_html || '';
    autoSavedProjectIdRef.current = project.id;
    setProjectState({
      ...initialProjectState,
      id: 'saved-' + project.id,
      title: project.title,
      description: project.description || '',
      annotations: project.annotations || { marks: [], notes: [], patches: [] },
      updatedAt: project.updated_at || new Date().toISOString(),
      canvasCode: {
        html: project.canvas_html || '',
        css: project.canvas_css || '',
        js: project.canvas_js || ''
      },
      gasConfig: {
        sheetId: project.spreadsheet_id || '',
        webAppUrl: project.gas_web_app_url || '',
        scriptCode: project.gas_script || '',
        isConnected: Boolean(project.gas_script)
      }
    });
    setRightPanelTab('PREVIEW');
  };

  const handleDeleteProject = async (id: string) => {
    setDeletingId(id);
    try {
      const headers = await getAuthHeaders();
      await fetch(`/api/projects/${id}`, { method: 'DELETE', headers });
      setSavedProjects((prev) => prev.filter((p) => p.id !== id));
      if (lastSavedCanvasRef.current && projectState.id === 'saved-' + id) {
        lastSavedCanvasRef.current = '';
        lastSavedAnnotationsRef.current = '';
        autoSavedProjectIdRef.current = null;
      }
    } catch (err) {
      console.error('Failed to delete project:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleSaveAndApply = () => {
    if (!activeSelection) return;
    const current = projectState.annotations || { marks: [], notes: [], patches: [] };
    const now = new Date().toISOString();

    const next: typeof current = {
      marks: Array.isArray(current.marks) ? [...current.marks] : [],
      notes: Array.isArray(current.notes) ? [...current.notes] : [],
      patches: Array.isArray(current.patches) ? [...current.patches] : []
    };

    const markIdx = next.marks.findIndex((m) => m.id === activeSelection.markId);
    if (markIdx === -1) {
      next.marks.push({
        id: activeSelection.markId,
        kind: activeSelection.kind,
        bounds: activeSelection.bounds,
        elementUid: activeSelection.elementUid,
        createdAt: now
      });
    } else {
      next.marks[markIdx] = {
        ...next.marks[markIdx],
        kind: activeSelection.kind,
        bounds: activeSelection.bounds,
        elementUid: activeSelection.elementUid
      };
    }

    const noteIdx = next.notes.findIndex((n) => n.markId === activeSelection.markId);
    if (noteIdx === -1) {
      next.notes.push({
        id: newOdId(),
        markId: activeSelection.markId,
        text: noteDraft,
        createdAt: now
      });
    } else {
      next.notes[noteIdx] = {
        ...next.notes[noteIdx],
        text: noteDraft,
        updatedAt: now
      };
    }

    if (activeSelection.kind === 'element' && activeSelection.elementUid) {
      const elUid = activeSelection.elementUid;
      const colorVal = textColorDraft.trim();
      const textVal = textContentDraft;

      if (colorVal) {
        const patch = {
          id: newOdId(),
          elementUid: elUid,
          patchType: 'textColor' as const,
          value: colorVal,
          createdAt: now
        };
        next.patches.push(patch);
        iframeRef.current?.contentWindow?.postMessage({
          source: 'OD_BRIDGE',
          type: 'OD_APPLY_PATCH',
          patch
        }, '*');
      }

      if (textVal.trim()) {
        const patch = {
          id: newOdId(),
          elementUid: elUid,
          patchType: 'textContent' as const,
          value: textVal,
          createdAt: now
        };
        next.patches.push(patch);
        iframeRef.current?.contentWindow?.postMessage({
          source: 'OD_BRIDGE',
          type: 'OD_APPLY_PATCH',
          patch
        }, '*');
      }
    }

    handleUpdateState({ annotations: next });
  };

  // Muat daftar prototype tersimpan setelah sesi login terverifikasi (sekali saja)
  useEffect(() => {
    if (isAuthenticated !== true || savedLoaded) return;
    getAuthHeaders()
      .then((headers) => fetch('/api/projects', { cache: 'no-store', headers }))
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { projects?: SavedProject[] } | null) => {
        if (data) setSavedProjects(Array.isArray(data.projects) ? data.projects : []);
      })
      .catch((err) => console.error('Failed to load saved projects:', err))
      .finally(() => setSavedLoaded(true));
  }, [isAuthenticated, savedLoaded]);

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
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-6">
        
        {/* PANEL KIRI (±40%): Percakapan AI */}
        <div className="flex flex-col min-w-0">
          <ChatPanel
            projectState={projectState}
            onUpdateState={handleUpdateState}
            isGenerating={isGenerating}
            setIsGenerating={handleSetGenerating}
          />
        </div>

        {/* PANEL KANAN: Pratinjau (Live Preview) & Backend Apps Script (Mendukung Fullscreen Poin 37) */}
        <div
          className={
            isPreviewFullscreen
              ? 'fixed inset-0 z-50 p-3 sm:p-5 bg-slate-950/95 backdrop-blur-2xl flex flex-col transition-all duration-300 ease-in-out'
              : 'flex flex-col min-w-0 bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden backdrop-blur-xl sticky top-20 h-[calc(100vh-100px)] transition-all duration-300 ease-in-out'
          }
        >
          <div className={isPreviewFullscreen ? 'flex-1 grid grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto_minmax(0,1fr)] bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl h-full' : 'flex-1 grid grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto_minmax(0,1fr)] h-full overflow-hidden'}>
            {/* Strip atas: label tab aktif + tombol Fullscreen (tetap di atas; menu lain dipindah ke samping kanan) */}
            <div className="col-span-2 flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-950/60 gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                {rightPanelTab === 'PREVIEW' ? 'Live Preview' : rightPanelTab === 'GAS_SCRIPT' ? 'Backend Apps Script' : 'Tersimpan'}
              </span>

              {rightPanelTab === 'PREVIEW' && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setInteractionMode('select');
                      setActiveSelection(null);
                    }}
                    className={`px-2 py-1 rounded-xl text-[10px] font-semibold border transition-all ${
                      interactionMode === 'select'
                        ? 'bg-indigo-600 text-white border-indigo-500'
                        : 'bg-slate-900/30 text-slate-300 border-slate-700 hover:bg-slate-900/50'
                    }`}
                    title="Pilih elemen (klik)"
                  >
                    Select
                  </button>
                  <button
                    onClick={() => {
                      setInteractionMode('mark');
                      setActiveSelection(null);
                    }}
                    className={`px-2 py-1 rounded-xl text-[10px] font-semibold border transition-all ${
                      interactionMode === 'mark'
                        ? 'bg-emerald-600 text-white border-emerald-500'
                        : 'bg-slate-900/30 text-slate-300 border-slate-700 hover:bg-slate-900/50'
                    }`}
                    title="Mark area (drag)"
                  >
                    Mark
                  </button>
                </div>
              )}

              {/* Tombol Fullscreen Expand / Collapse (Poin 37) */}
              <button
                onClick={() => setIsPreviewFullscreen(prev => !prev)}
                className={`flex items-center gap-1 px-2 py-1 rounded-xl text-[10px] font-semibold border transition-all ${
                  isPreviewFullscreen
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30'
                    : 'bg-slate-900/90 text-slate-300 border-slate-700 hover:text-white hover:bg-slate-800'
                }`}
                title={isPreviewFullscreen ? 'Tutup Fullscreen (Esc)' : 'Perbesar Fullscreen'}
                aria-label={isPreviewFullscreen ? 'Tutup Fullscreen' : 'Perbesar Fullscreen'}
              >
                {isPreviewFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{isPreviewFullscreen ? 'Tutup Fullscreen' : 'Fullscreen'}</span>
              </button>
            </div>

            {/* Isi Viewport Live Preview / Script */}
            <div className="col-start-1 row-start-2 flex-1 overflow-hidden p-4 relative">
              {rightPanelTab === 'PREVIEW' ? (
                <div className="w-full h-full bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-inner relative">
                  {projectState.canvasCode.html ? (
                    <div ref={overlayRef} className="relative w-full h-full">
                      <div className="absolute inset-0 pointer-events-none">
                        {selectionPx && activeSelection && (
                          <>
                            <div
                              className="absolute border-2 border-indigo-500/80 bg-indigo-500/10"
                              style={{
                                left: selectionPx.left,
                                top: selectionPx.top,
                                width: selectionPx.width,
                                height: selectionPx.height
                              }}
                            />

                            <div
                              className="absolute z-50 pointer-events-auto"
                              style={{
                                left: selectionPx.anchorLeft,
                                top: selectionPx.anchorTop,
                                transform: 'translate(-50%, -100%)'
                              }}
                            >
                              <div className="w-[320px] max-w-[80vw] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-3">
                                <div className="text-[11px] font-bold text-slate-200 mb-2">Mark note</div>
                                <textarea
                                  value={noteDraft}
                                  onChange={(e) => setNoteDraft(e.target.value)}
                                  rows={2}
                                  className="w-full bg-slate-950/40 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
                                  placeholder="Tulis catatan untuk mark ini..."
                                />

                                {activeSelection.kind === 'element' && (
                                  <div className="mt-3 space-y-2">
                                    <div className="text-[11px] font-semibold text-slate-300">Editor elemen (simple)</div>
                                    <div className="space-y-1">
                                      <div className="text-[10px] text-slate-400">Text color</div>
                                      <input
                                        value={textColorDraft}
                                        onChange={(e) => setTextColorDraft(e.target.value)}
                                        className="w-full bg-slate-950/40 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                                        placeholder="#RRGGBB atau rgb(...)"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <div className="text-[10px] text-slate-400">Text content</div>
                                      <textarea
                                        value={textContentDraft}
                                        onChange={(e) => setTextContentDraft(e.target.value)}
                                        rows={2}
                                        className="w-full bg-slate-950/40 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
                                        placeholder="Isi teks baru..."
                                      />
                                    </div>
                                  </div>
                                )}

                                <div className="mt-3 flex justify-end">
                                  <button
                                    onClick={handleSaveAndApply}
                                    className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/20 disabled:opacity-40"
                                  >
                                    Save & Apply
                                  </button>
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                      </div>

                      <iframe
                        ref={iframeRef}
                        title="Live Preview Canvas"
                        srcDoc={buildSrcDoc(projectState.canvasCode)}
                        className="w-full h-full border-none bg-slate-50"
                        sandbox="allow-scripts allow-forms allow-modals"
                        onLoad={() => {
                          const win = iframeRef.current?.contentWindow;
                          if (!win) return;
                          win.postMessage(
                            {
                              source: 'OD_BRIDGE',
                              type: 'OD_SET_PATCHES',
                              patches: annotationsRef.current?.patches || []
                            },
                            '*'
                          );

                          win.postMessage(
                            {
                              source: 'OD_BRIDGE',
                              type: 'OD_MODE',
                              mode: interactionMode
                            },
                            '*'
                          );
                        }}
                      />
                    </div>
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
              ) : rightPanelTab === 'GAS_SCRIPT' ? (
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
  Minta AI di panel kiri: <em>&quot;Buatkan script Google Apps Script untuk menghubungkan aplikasi ke Google Sheets&quot;</em>.
</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full h-full bg-slate-900/60 rounded-2xl border border-slate-800 overflow-hidden">
                  <SavedProjectsList
                    projects={savedProjects}
                    loading={!savedLoaded}
                    deletingId={deletingId}
                    onLoad={handleLoadProject}
                    onDelete={handleDeleteProject}
                  />
                </div>
              )}
            </div>

            {/* Sidebar Kanan: badge menu dengan mode ringkas/lengkap */}
            <aside className={`col-start-2 row-start-2 flex flex-col border-l border-slate-800/80 bg-slate-950/80 p-2 overflow-y-auto overflow-x-hidden transition-[width] duration-300 ease-out ${
              sideRailExpanded ? 'w-48' : 'w-[68px]'
            }`}>
              <button
                onClick={() => setSideRailExpanded(v => !v)}
                className={`h-10 rounded-xl border border-slate-800 bg-slate-900/70 text-slate-400 hover:border-slate-700 hover:text-white transition-all flex items-center shrink-0 ${
                  sideRailExpanded ? 'w-full justify-between px-3' : 'w-full justify-center'
                }`}
                title={sideRailExpanded ? 'Ciutkan menu panel' : 'Perluas menu panel'}
                aria-label={sideRailExpanded ? 'Ciutkan menu panel' : 'Perluas menu panel'}
              >
                {sideRailExpanded && <span className="text-[10px] font-bold uppercase tracking-[0.18em]">Menu Panel</span>}
                {sideRailExpanded ? <ChevronsRight className="w-3.5 h-3.5" /> : <ChevronsLeft className="w-3.5 h-3.5" />}
              </button>

              <nav className="mt-3 flex flex-col gap-2" aria-label="Menu panel pratinjau">
                <button
                  onClick={() => setRightPanelTab('PREVIEW')}
                  className={`relative flex min-h-12 w-full items-center rounded-2xl border transition-all ${
                    sideRailExpanded ? 'gap-3 px-3 py-2.5' : 'justify-center px-2 py-2.5'
                  } ${
                    rightPanelTab === 'PREVIEW'
                      ? 'border-indigo-500/40 bg-indigo-500/15 text-indigo-100 shadow-[inset_3px_0_0_0_rgba(99,102,241,0.9)]'
                      : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700 hover:bg-slate-900 hover:text-slate-200'
                  }`}
                  title={sideRailExpanded ? undefined : 'Live Preview'}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-indigo-400/20 bg-indigo-500/10">
                    <Eye className="w-4 h-4" />
                  </span>
                  {sideRailExpanded && (
                    <span className="min-w-0 text-left">
                      <span className="block whitespace-nowrap text-[11px] font-bold text-white">Live Preview</span>
                      <span className="block whitespace-nowrap text-[9px] text-slate-500">Canvas aplikasi</span>
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setRightPanelTab('GAS_SCRIPT')}
                  className={`relative flex min-h-12 w-full items-center rounded-2xl border transition-all ${
                    sideRailExpanded ? 'gap-3 px-3 py-2.5' : 'justify-center px-2 py-2.5'
                  } ${
                    rightPanelTab === 'GAS_SCRIPT'
                      ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-100 shadow-[inset_3px_0_0_0_rgba(16,185,129,0.9)]'
                      : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700 hover:bg-slate-900 hover:text-slate-200'
                  }`}
                  title={sideRailExpanded ? undefined : 'Backend Apps Script'}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-500/10">
                    <Code2 className="w-4 h-4" />
                  </span>
                  {sideRailExpanded && (
                    <span className="min-w-0 text-left">
                      <span className="block whitespace-nowrap text-[11px] font-bold text-white">Backend Apps Script</span>
                      <span className="block whitespace-nowrap text-[9px] text-slate-500">Integrasi Google Sheets</span>
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setRightPanelTab('SAVED')}
                  className={`relative flex min-h-12 w-full items-center rounded-2xl border transition-all ${
                    sideRailExpanded ? 'gap-3 px-3 py-2.5' : 'justify-center px-2 py-2.5'
                  } ${
                    rightPanelTab === 'SAVED'
                      ? 'border-sky-500/40 bg-sky-500/15 text-sky-100 shadow-[inset_3px_0_0_0_rgba(14,165,233,0.9)]'
                      : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700 hover:bg-slate-900 hover:text-slate-200'
                  }`}
                  title={sideRailExpanded ? undefined : 'Tersimpan'}
                >
                  <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-sky-400/20 bg-sky-500/10">
                    <FolderOpen className="w-4 h-4" />
                    {!sideRailExpanded && savedProjects.length > 0 && (
                      <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-slate-950 bg-sky-500 px-0.5 text-[7px] font-bold text-white">
                        {savedProjects.length}
                      </span>
                    )}
                  </span>
                  {sideRailExpanded && (
                    <span className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left">
                      <span>
                        <span className="block whitespace-nowrap text-[11px] font-bold text-white">Tersimpan</span>
                        <span className="block whitespace-nowrap text-[9px] text-slate-500">Proyek Anda</span>
                      </span>
                      {savedProjects.length > 0 && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-sky-500/20 px-1 text-[8px] font-bold text-sky-300">
                          {savedProjects.length}
                        </span>
                      )}
                    </span>
                  )}
                </button>
              </nav>

              <div className="mt-auto border-t border-slate-800/80 pt-2">
                <button
                  onClick={handleDownloadIndexHtml}
                  disabled={!projectState.canvasCode.html}
                  className={`flex min-h-12 w-full items-center rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/25 to-teal-500/15 text-emerald-100 transition-all hover:border-emerald-400/50 hover:from-emerald-500/35 disabled:cursor-not-allowed disabled:opacity-35 ${
                    sideRailExpanded ? 'gap-3 px-3 py-2.5' : 'justify-center px-2 py-2.5'
                  }`}
                  title={sideRailExpanded ? undefined : downloaded ? 'Tersimpan!' : 'Download index.html'}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-400/15">
                    <Download className="w-4 h-4" />
                  </span>
                  {sideRailExpanded && (
                    <span className="min-w-0 text-left">
                      <span className="block whitespace-nowrap text-[11px] font-bold">{downloaded ? 'Tersimpan!' : 'Download index.html'}</span>
                      <span className="block whitespace-nowrap text-[9px] text-emerald-200/55">Ekspor prototipe</span>
                    </span>
                  )}
                </button>
              </div>
            </aside>
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
