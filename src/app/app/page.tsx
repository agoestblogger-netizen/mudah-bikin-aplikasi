'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { initialProjectState } from '@/lib/defaultState';
import { AppProjectState, SavedProject } from '@/types/app';
import { Navbar } from '@/components/Navbar';
import { ChatPanel } from '@/components/ChatPanel';
import { SavedProjectsList } from '@/components/SavedProjectsList';
import { BuildBadge } from '@/components/BuildBadge';
import { buildSrcDoc } from '@/lib/buildSrcDoc';
import {
  Code2,
  RefreshCw,
  FolderOpen,
  Eye,
  ChevronsLeft,
  ChevronsRight,
  Layers,
  Sparkles,
  Maximize2,
  Minimize2,
  Edit3,
  X,
  Send,
  Download,
  Trash2,
  Bold,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Square,
  Circle,
  GripHorizontal,
  Undo2,
  Redo2,
  Loader2,
  Image as ImageIcon,
  Check,
  User,
  Bell,
  Star,
  ArrowRight,
  Plus,
  Search,
  Settings,
  Lock,
  Mail,
  Heart,
  Zap,
  ShoppingBag,
  ShieldCheck,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import {
  syncPatchesToHtml,
  stripOdUids,
  replaceElementInHtml,
  removeElementFromHtml,
  insertIconIntoHtml,
  insertImageIntoHtml
} from '@/lib/htmlPatcher';
import { cleanConversationalLeaks } from '@/lib/cleanLeaks';
import { loadModelSettings } from '@/lib/modelConfig';

const POPULAR_ICONS = [
  { name: 'check', label: 'Check', icon: Check },
  { name: 'star', label: 'Star', icon: Star },
  { name: 'bell', label: 'Bell', icon: Bell },
  { name: 'user', label: 'User', icon: User },
  { name: 'plus', label: 'Plus', icon: Plus },
  { name: 'arrow-right', label: 'Panah', icon: ArrowRight },
  { name: 'search', label: 'Cari', icon: Search },
  { name: 'settings', label: 'Setting', icon: Settings },
  { name: 'lock', label: 'Kunci', icon: Lock },
  { name: 'mail', label: 'Email', icon: Mail },
  { name: 'sparkles', label: 'Kilau', icon: Sparkles },
  { name: 'heart', label: 'Suka', icon: Heart },
  { name: 'zap', label: 'Petir', icon: Zap },
  { name: 'shopping-bag', label: 'Belanja', icon: ShoppingBag },
  { name: 'shield-check', label: 'Aman', icon: ShieldCheck },
  { name: 'trash-2', label: 'Hapus', icon: Trash2 },
];

const POPULAR_IMAGES = [
  {
    title: 'Avatar Wanita',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    type: 'avatar' as const,
  },
  {
    title: 'Avatar Pria',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    type: 'avatar' as const,
  },
  {
    title: 'Produk Gadget',
    url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&auto=format&fit=crop&q=80',
    type: 'thumbnail' as const,
  },
  {
    title: 'Dashboard / Tech',
    url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&auto=format&fit=crop&q=80',
    type: 'thumbnail' as const,
  },
  {
    title: 'Banner Gradien',
    url: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&auto=format&fit=crop&q=80',
    type: 'banner' as const,
  },
];

// Urutan langkah progress yang ditampilkan di preview saat generate kode batch
const GENERATE_PROGRESS_STEPS = [
  { label: 'Menyusun arsitektur & struktur aplikasi...', pct: 15 },
  { label: 'Merancang tata letak antarmuka & glassmorphism...', pct: 35 },
  { label: 'Membangun logika & interaktivitas JavaScript...', pct: 55 },
  { label: 'Memvalidasi fungsionalitas & keamanan role...', pct: 75 },
  { label: 'Mengintegrasikan template backend Google Sheets...', pct: 90 },
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
  const [projectState, setProjectState] = useState<AppProjectState>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('mba_active_project');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && typeof parsed === 'object') {
            if (parsed.canvasCode?.html && parsed.canvasCode.html.includes('</html>')) {
              parsed.canvasCode.html = parsed.canvasCode.html.slice(0, parsed.canvasCode.html.lastIndexOf('</html>') + 7).trim();
            }
            return parsed;
          }
        }
      } catch {}
    }
    return initialProjectState;
  });
  const [rightPanelTab, setRightPanelTab] = useState<'PREVIEW' | 'GAS_SCRIPT' | 'SAVED'>('PREVIEW');
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

  // Inisialisasi autoSavedProjectIdRef dari localStorage saat mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedId = localStorage.getItem('mba_active_project_id');
        if (savedId) autoSavedProjectIdRef.current = savedId;
      } catch {}
    }
  }, []);

  const [reloadTrigger, setReloadTrigger] = useState(0);

  const memoizedSrcDoc = useMemo(
    () => buildSrcDoc(projectState.canvasCode),
    [reloadTrigger]
  );

  // Sync initial loaded project once on mount
  useEffect(() => {
    if (projectState.canvasCode?.html) {
      setReloadTrigger((k) => k + 1);
    }
  }, []);

  // OpenDesign-like marks/comments/patches
  const [interactionMode, setInteractionMode] = useState<'none' | 'select' | 'mark'>('none');
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
        tagName?: string;
        initialText?: string;
        initialColor?: string;
        initialBg?: string;
        initialFontSize?: string;
        initialFontWeight?: string;
        initialTextAlign?: string;
        initialBorderRadius?: string;
        outerHtml?: string;
        breadcrumbs?: string[];
      }
  >(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [textColorDraft, setTextColorDraft] = useState('');
  const [bgColorDraft, setBgColorDraft] = useState('');
  const [textContentDraft, setTextContentDraft] = useState('');
  const [fontSizeDraft, setFontSizeDraft] = useState('');
  const [fontWeightDraft, setFontWeightDraft] = useState('');
  const [textAlignDraft, setTextAlignDraft] = useState('');
  const [borderRadiusDraft, setBorderRadiusDraft] = useState('');
  const [isSurgicalLoading, setIsSurgicalLoading] = useState(false);

  // Visual History (Undo / Redo Stack) — Fase 3
  const [historyStack, setHistoryStack] = useState<Array<{
    canvasCode: { html: string; css: string; js: string };
    patches: any[];
  }>>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage((curr) => (curr?.text === text ? null : curr));
    }, 3000);
  };

  const pushHistory = (newCode: { html: string; css: string; js: string }, newPatches: any[]) => {
    setHistoryStack((prev) => {
      const activeIdx = historyIndex >= 0 ? historyIndex : prev.length - 1;
      const sliced = prev.slice(0, activeIdx + 1);
      const next = [...sliced, { canvasCode: newCode, patches: newPatches }];
      if (next.length > 30) next.shift();
      return next;
    });
    setHistoryIndex((prev) => Math.min(prev + 1, 29));
  };

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex >= 0 && historyIndex < historyStack.length - 1;

  const handleUndo = () => {
    if (!canUndo) return;
    const prevIdx = historyIndex - 1;
    const target = historyStack[prevIdx];
    if (!target) return;
    setHistoryIndex(prevIdx);
    setProjectState((prev) => ({
      ...prev,
      canvasCode: target.canvasCode,
      annotations: {
        ...(prev.annotations || { marks: [], notes: [], patches: target.patches }),
        patches: target.patches
      }
    }));
    annotationsRef.current = {
      ...(annotationsRef.current || { marks: [], notes: [], patches: target.patches }),
      patches: target.patches
    };
    setReloadTrigger((k) => k + 1);
    showToast('Undo visual berhasil', 'info');
  };

  const handleRedo = () => {
    if (!canRedo) return;
    const nextIdx = historyIndex + 1;
    const target = historyStack[nextIdx];
    if (!target) return;
    setHistoryIndex(nextIdx);
    setProjectState((prev) => ({
      ...prev,
      canvasCode: target.canvasCode,
      annotations: {
        ...(prev.annotations || { marks: [], notes: [], patches: target.patches }),
        patches: target.patches
      }
    }));
    annotationsRef.current = {
      ...(annotationsRef.current || { marks: [], notes: [], patches: target.patches }),
      patches: target.patches
    };
    setReloadTrigger((k) => k + 1);
    showToast('Redo visual berhasil', 'info');
  };

  useEffect(() => {
    if (projectState.canvasCode.html && historyStack.length === 0) {
      setHistoryStack([{ canvasCode: projectState.canvasCode, patches: annotationsRef.current?.patches || [] }]);
      setHistoryIndex(0);
    }
  }, [projectState.canvasCode.html]);

  const [popoverPos, setPopoverPos] = useState<{ x: number; y: number } | null>(null);
  const [shortcutPanel, setShortcutPanel] = useState<'none' | 'icon' | 'image'>('none');
  const [customIconDraft, setCustomIconDraft] = useState('');
  const [customImageDraft, setCustomImageDraft] = useState('');
  const [imageStyleType, setImageStyleType] = useState<'avatar' | 'banner' | 'thumbnail'>('thumbnail');

  const popoverDragRef = useRef<{
    dragging: boolean;
    startX: number;
    startY: number;
    initX: number;
    initY: number;
  } | null>(null);

  const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
  const selectionPx = (() => {
    if (!activeSelection) return null;
    if (!overlaySize.w || !overlaySize.h) return null;
    const left = activeSelection.bounds.x * overlaySize.w;
    const top = activeSelection.bounds.y * overlaySize.h;
    const width = activeSelection.bounds.w * overlaySize.w;
    const height = activeSelection.bounds.h * overlaySize.h;
    if (width <= 1 || height <= 1) return null;

    const popoverW = Math.min(340, overlaySize.w * 0.9);
    const popoverH = 430;

    // Hitung posisi horizontal default (tengah elemen, dijaga di dalam viewport)
    const idealLeft = left + width / 2 - popoverW / 2;
    const defaultLeft = clamp(idealLeft, 12, Math.max(12, overlaySize.w - popoverW - 12));

    // Hitung posisi vertikal default:
    // Pastikan nilai top TIDAK PERNAH < 14px agar bagian atas popover (header, tombol tutup, tag) SELALU terlihat utuh!
    let defaultTop = 16;
    if (top >= popoverH + 20) {
      // Ada cukup ruang di atas elemen
      defaultTop = top - popoverH - 10;
    } else if (top + height + popoverH + 20 <= overlaySize.h) {
      // Ada ruang di bawah elemen
      defaultTop = top + height + 10;
    } else {
      // Jika atas dan bawah sempit, clamp dengan jarak aman minimal 14px dari tepi atas
      defaultTop = clamp(top - 10, 14, Math.max(14, overlaySize.h - popoverH - 14));
    }

    return { left, top, width, height, defaultLeft, defaultTop, popoverW };
  })();

  const handlePopoverDragStart = (e: React.PointerEvent) => {
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch (_) {}
    const currentX = popoverPos?.x ?? selectionPx?.defaultLeft ?? 16;
    const currentY = popoverPos?.y ?? selectionPx?.defaultTop ?? 16;
    popoverDragRef.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      initX: currentX,
      initY: currentY
    };
  };

  const handlePopoverDragMove = (e: React.PointerEvent) => {
    if (!popoverDragRef.current?.dragging) return;
    e.stopPropagation();
    const dx = e.clientX - popoverDragRef.current.startX;
    const dy = e.clientY - popoverDragRef.current.startY;
    const popoverW = selectionPx?.popoverW || Math.min(320, (overlaySize.w || 360) * 0.85);
    const nextX = clamp(popoverDragRef.current.initX + dx, 10, Math.max(10, (overlaySize.w || 360) - popoverW - 10));
    const nextY = clamp(popoverDragRef.current.initY + dy, 12, Math.max(12, (overlaySize.h || 500) - 80));
    setPopoverPos({ x: nextX, y: nextY });
  };

  const handlePopoverDragEnd = (e: React.PointerEvent) => {
    if (popoverDragRef.current?.dragging) {
      e.stopPropagation();
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (_) {}
      popoverDragRef.current = null;
    }
  };

  const [dragDraft, setDragDraft] = useState<
    | null
    | {
        bounds: { x: number; y: number; w: number; h: number };
      }
  >(null);
  const dragDraftRef = useRef<{
    dragging: boolean;
    startX: number;
    startY: number;
  } | null>(null);
  const dragBoundsRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

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

  const [externalChatSendToken, setExternalChatSendToken] = useState<string | number | null>(null);
  const [externalChatSendText, setExternalChatSendText] = useState<string | null>(null);

  // Shortcut Keyboard: Esc untuk Fullscreen, Cmd/Ctrl+Z untuk Undo, Cmd/Ctrl+Shift+Z / Y untuk Redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isPreviewFullscreen) {
        setIsPreviewFullscreen(false);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
          return;
        }
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
          return;
        }
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPreviewFullscreen, canUndo, canRedo, historyIndex, historyStack]);

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
        const lastBg = [...patches].reverse().find((p) => p.elementUid === elementUid && p.patchType === 'bgColor');
        const lastText = [...patches].reverse().find((p) => p.elementUid === elementUid && p.patchType === 'textContent');
        const lastSize = [...patches].reverse().find((p) => p.elementUid === elementUid && p.patchType === 'fontSize');
        const lastWeight = [...patches].reverse().find((p) => p.elementUid === elementUid && p.patchType === 'fontWeight');
        const lastAlign = [...patches].reverse().find((p) => p.elementUid === elementUid && p.patchType === 'textAlign');
        const lastRadius = [...patches].reverse().find((p) => p.elementUid === elementUid && p.patchType === 'borderRadius');

        const initialColor = lastColor?.value ?? data.currentColor ?? '';
        const initialBg = lastBg?.value ?? data.currentBg ?? '';
        const initialText = lastText?.value ?? data.currentText ?? '';
        const initialFontSize = lastSize?.value ?? data.currentFontSize ?? '';
        const initialFontWeight = lastWeight?.value ?? data.currentFontWeight ?? '';
        const initialTextAlign = lastAlign?.value ?? data.currentTextAlign ?? '';
        const initialBorderRadius = lastRadius?.value ?? data.currentBorderRadius ?? '';

        setActiveSelection({
          markId,
          kind: 'element',
          bounds,
          elementUid,
          tagName: data.tagName,
          initialColor,
          initialBg,
          initialText,
          initialFontSize,
          initialFontWeight,
          initialTextAlign,
          initialBorderRadius,
          outerHtml: data.outerHtml,
          breadcrumbs: Array.isArray(data.breadcrumbs) ? data.breadcrumbs : []
        });
        setPopoverPos(null);
        setNoteDraft('');
        setTextColorDraft(String(initialColor || ''));
        setBgColorDraft(String(initialBg || ''));
        setTextContentDraft(String(initialText || ''));
        setFontSizeDraft(String(initialFontSize || ''));
        setFontWeightDraft(String(initialFontWeight || ''));
        setTextAlignDraft(String(initialTextAlign || ''));
        setBorderRadiusDraft(String(initialBorderRadius || ''));
      } else if (data.type === 'OD_UPDATE_TEXT') {
        const elementUid = data.elementUid;
        const newText = data.newText;
        if (!elementUid) return;

        const current = annotationsRef.current || { marks: [], notes: [], patches: [] };
        const now = new Date().toISOString();
        const patch = {
          id: newOdId(),
          elementUid,
          patchType: 'textContent' as const,
          value: newText,
          createdAt: now
        };
        const nextPatches = (current.patches || []).filter(
          (p) => !(p.elementUid === elementUid && p.patchType === 'textContent')
        );
        nextPatches.push(patch);

        const nextAnnotations = {
          ...current,
          patches: nextPatches
        };

        annotationsRef.current = nextAnnotations;
        setTextContentDraft(newText);
        setActiveSelection((prev) => {
          if (!prev || prev.elementUid !== elementUid) return prev;
          return {
            ...prev,
            initialText: newText
          };
        });

        // Sinkronkan langsung ke canvasCode.html secara permanen (Permanent HTML Source Sync)
        const updatedHtml = syncPatchesToHtml(projectState.canvasCode.html, [patch]);

        handleUpdateState({
          annotations: nextAnnotations,
          canvasCode: {
            ...projectState.canvasCode,
            html: updatedHtml
          }
        }, { skipIframeReload: true });
      } else if (data.type === 'OD_AREA_MARK') {
        const markId = newOdId();
        const bounds = data.bounds;
        if (!bounds) return;
        setActiveSelection({ markId, kind: 'area', bounds });
        setPopoverPos(null);
        setNoteDraft('');
        setTextColorDraft('');
        setBgColorDraft('');
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

  const handleUpdateState = (updated: Partial<AppProjectState>, options?: { skipIframeReload?: boolean }) => {
    if (updated.canvasCode?.html) {
      updated.canvasCode.html = cleanConversationalLeaks(updated.canvasCode.html);
    }
    const merged: AppProjectState = {
      ...projectState,
      ...updated,
      updatedAt: new Date().toISOString()
    };
    if (merged.canvasCode?.html) {
      merged.canvasCode.html = cleanConversationalLeaks(merged.canvasCode.html);
    }
    setProjectState(merged);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('mba_active_project', JSON.stringify(merged));
        if (autoSavedProjectIdRef.current) {
          localStorage.setItem('mba_active_project_id', autoSavedProjectIdRef.current);
        }
      } catch {}
    }
    if (updated.canvasCode?.html || updated.annotations) {
      setRightPanelTab('PREVIEW');
      handleAutoSaveProject(merged);
    }
    if (!options?.skipIframeReload && updated.canvasCode) {
      setReloadTrigger((k) => k + 1);
    }
    if (updated.canvasCode?.html && updated.canvasCode.html !== projectState.canvasCode.html) {
      pushHistory(merged.canvasCode, merged.annotations?.patches || []);
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
    const fresh: AppProjectState = {
      ...initialProjectState,
      id: 'proj-' + Date.now(),
      updatedAt: new Date().toISOString()
    };
    setProjectState(fresh);
    setReloadTrigger((k) => k + 1);
    lastSavedCanvasRef.current = '';
    lastSavedAnnotationsRef.current = '';
    autoSavedProjectIdRef.current = null;
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('mba_active_project');
        localStorage.removeItem('mba_active_project_id');
      } catch {}
    }
    setRightPanelTab('PREVIEW');
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
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('mba_active_project_id', data.project.id);
            } catch {}
          }
          setSavedProjects((prev) => [data.project!, ...prev.filter((p) => p.id !== data.project!.id)].slice(0, 50));
        }
      } catch (err) {
        console.error('Failed to auto-save project:', err);
      }
    })();
  }, [isAuthenticated]);

  const handleLoadProject = (project: SavedProject) => {
    let cleanHtml = project.canvas_html || '';
    if (cleanHtml.includes('</html>')) {
      cleanHtml = cleanHtml.slice(0, cleanHtml.lastIndexOf('</html>') + 7).trim();
    }
    lastSavedCanvasRef.current = cleanHtml;
    autoSavedProjectIdRef.current = project.id;
    const nextState: AppProjectState = {
      ...initialProjectState,
      id: 'saved-' + project.id,
      title: project.title,
      description: project.description || '',
      annotations: { marks: [], notes: [], patches: project.annotations?.patches || [] },
      updatedAt: project.updated_at || new Date().toISOString(),
      canvasCode: {
        html: cleanHtml,
        css: project.canvas_css || '',
        js: project.canvas_js || ''
      },
      gasConfig: {
        sheetId: project.spreadsheet_id || '',
        webAppUrl: project.gas_web_app_url || '',
        scriptCode: project.gas_script || '',
        isConnected: Boolean(project.gas_script)
      }
    };
    setProjectState(nextState);
    setReloadTrigger((k) => k + 1);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('mba_active_project', JSON.stringify(nextState));
        localStorage.setItem('mba_active_project_id', project.id);
      } catch {}
    }
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
      marks: [],
      notes: [],
      patches: Array.isArray(current.patches) ? [...current.patches] : []
    };

    if (activeSelection.kind === 'element' && activeSelection.elementUid) {
      const elUid = activeSelection.elementUid;
      const colorVal = textColorDraft.trim();
      const bgVal = bgColorDraft.trim();
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

      if (bgVal) {
        const patch = {
          id: newOdId(),
          elementUid: elUid,
          patchType: 'bgColor' as const,
          value: bgVal,
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

  const applyQuickPatch = (
    patchType: 'textColor' | 'bgColor' | 'textContent' | 'fontSize' | 'fontWeight' | 'textAlign' | 'borderRadius' | 'remove',
    value: string
  ) => {
    if (!activeSelection || activeSelection.kind !== 'element' || !activeSelection.elementUid) return;
    const elUid = activeSelection.elementUid;
    const current = projectState.annotations || { marks: [], notes: [], patches: [] };
    const now = new Date().toISOString();

    if (patchType === 'remove') {
      // 1. Bersihkan SEMUA patch yang terkait dengan elemen yang dihapus
      const nextPatches = (current.patches || []).filter((p) => p.elementUid !== elUid);
      const next = {
        marks: current.marks || [],
        notes: current.notes || [],
        patches: nextPatches
      };

      // 2. Hapus elemen langsung dari canvasCode.html secara permanen tanpa menggeser UID elemen lain
      const updatedHtml = removeElementFromHtml(projectState.canvasCode.html, elUid);

      // 3. Update state dan simpan ke history TANPA reload iframe
      handleUpdateState({
        annotations: next,
        canvasCode: {
          ...projectState.canvasCode,
          html: updatedHtml
        }
      }, { skipIframeReload: true });

      // 4. Beri tahu iframe untuk langsung menghapus elemen tersebut dari DOM aktif
      iframeRef.current?.contentWindow?.postMessage(
        {
          source: 'OD_BRIDGE',
          type: 'OD_REMOVE_ELEMENT',
          elementUid: elUid
        },
        '*'
      );

      // 5. Tutup seleksi dan popover
      setActiveSelection(null);
      setPopoverPos(null);
      setShortcutPanel('none');
      setCustomIconDraft('');
      setCustomImageDraft('');
      return;
    }

    const patch = {
      id: newOdId(),
      elementUid: elUid,
      patchType,
      value,
      createdAt: now
    };

    const nextPatches = (current.patches || []).filter(
      (p) => !(p.elementUid === elUid && p.patchType === patchType)
    );
    nextPatches.push(patch);

    const next = {
      marks: [],
      notes: [],
      patches: nextPatches
    };

    if (patchType === 'textColor') setTextColorDraft(value);
    if (patchType === 'bgColor') setBgColorDraft(value);
    if (patchType === 'textContent') setTextContentDraft(value);
    if (patchType === 'fontSize') setFontSizeDraft(value);
    if (patchType === 'fontWeight') setFontWeightDraft(value);
    if (patchType === 'textAlign') setTextAlignDraft(value);
    if (patchType === 'borderRadius') setBorderRadiusDraft(value);

    // Sinkronkan langsung ke canvasCode.html secara permanen (Permanent HTML Source Sync)
    const updatedHtml = syncPatchesToHtml(projectState.canvasCode.html, [patch]);

    handleUpdateState({
      annotations: next,
      canvasCode: {
        ...projectState.canvasCode,
        html: updatedHtml
      }
    }, { skipIframeReload: true });

    iframeRef.current?.contentWindow?.postMessage(
      {
        source: 'OD_BRIDGE',
        type: 'OD_APPLY_PATCH',
        patch
      },
      '*'
    );
  };

  const handleInsertIcon = (iconName: string) => {
    if (!activeSelection || activeSelection.kind !== 'element' || !activeSelection.elementUid) return;
    const elUid = activeSelection.elementUid;
    const cleanName = iconName.trim().toLowerCase();
    if (!cleanName) return;

    // 1. Sinkronkan ke canvasCode.html secara permanen
    const updatedHtml = insertIconIntoHtml(projectState.canvasCode.html, elUid, cleanName);

    // 2. Kirim pesan ke iframe untuk update in-place tanpa reload
    iframeRef.current?.contentWindow?.postMessage(
      {
        source: 'OD_BRIDGE',
        type: 'OD_INSERT_ICON',
        elementUid: elUid,
        iconName: cleanName
      },
      '*'
    );

    // 3. Update state tanpa reload iframe
    handleUpdateState(
      {
        canvasCode: {
          ...projectState.canvasCode,
          html: updatedHtml
        }
      },
      { skipIframeReload: true }
    );

    showToast(`Ikon "${cleanName}" berhasil disisipkan!`, 'success');
  };

  const handleInsertImage = (imageUrl: string, styleType: 'avatar' | 'banner' | 'thumbnail' = 'thumbnail') => {
    if (!activeSelection || activeSelection.kind !== 'element' || !activeSelection.elementUid) return;
    const elUid = activeSelection.elementUid;
    const cleanUrl = imageUrl.trim();
    if (!cleanUrl) return;

    // 1. Sinkronkan ke canvasCode.html secara permanen
    const updatedHtml = insertImageIntoHtml(projectState.canvasCode.html, elUid, cleanUrl, styleType);

    // 2. Kirim pesan ke iframe untuk update in-place tanpa reload
    iframeRef.current?.contentWindow?.postMessage(
      {
        source: 'OD_BRIDGE',
        type: 'OD_INSERT_IMAGE',
        elementUid: elUid,
        imageUrl: cleanUrl,
        styleType
      },
      '*'
    );

    // 3. Update state tanpa reload iframe
    handleUpdateState(
      {
        canvasCode: {
          ...projectState.canvasCode,
          html: updatedHtml
        }
      },
      { skipIframeReload: true }
    );

    showToast('Gambar berhasil disisipkan!', 'success');
  };

  const handleSurgicalEdit = async () => {
    if (!activeSelection || activeSelection.kind !== 'element' || !activeSelection.elementUid || !activeSelection.outerHtml) {
      showToast('Pilih elemen target terlebih dahulu.', 'error');
      return;
    }
    const instruction = noteDraft.trim();
    if (!instruction) {
      showToast('Ketik instruksi perubahan untuk elemen ini.', 'error');
      return;
    }

    setIsSurgicalLoading(true);
    try {
      const authHeaders = await getAuthHeaders();
      const modelSettings = loadModelSettings();

      const res = await fetch('/api/generate/surgical', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({
          elementHtml: activeSelection.outerHtml,
          instruction,
          appContext: projectState.title || '',
          tagName: activeSelection.tagName || 'element',
          provider: modelSettings.provider,
          apiKey: modelSettings.token || undefined,
          model: modelSettings.model || undefined
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success || !data.updatedElementHtml) {
        throw new Error(data.error || 'Gagal memperbarui elemen via AI Bedah.');
      }

      const newElementHtml = data.updatedElementHtml;
      const elUid = activeSelection.elementUid;

      // 1. Bersihkan patch visual lama untuk elemen ini agar tidak menimpa hasil bedah AI
      const current = projectState.annotations || { marks: [], notes: [], patches: [] };
      const nextPatches = (current.patches || []).filter((p) => p.elementUid !== elUid);
      const nextAnnotations = {
        marks: current.marks || [],
        notes: current.notes || [],
        patches: nextPatches
      };

      // 2. Ganti elemen di kode sumber HTML secara permanen
      const updatedHtml = replaceElementInHtml(projectState.canvasCode.html, elUid, newElementHtml);

      // 3. Kirim pesan ke iframe untuk mengganti elemen secara in-place di live DOM
      iframeRef.current?.contentWindow?.postMessage(
        {
          source: 'OD_BRIDGE',
          type: 'OD_REPLACE_ELEMENT',
          elementUid: elUid,
          newElementHtml
        },
        '*'
      );

      // 4. Update state proyek & auto save TANPA reload iframe
      handleUpdateState({
        annotations: nextAnnotations,
        canvasCode: {
          ...projectState.canvasCode,
          html: updatedHtml
        }
      }, { skipIframeReload: true });

      // 4. Feedback dan bersihkan modal
      showToast('Komponen berhasil diperbarui via AI Bedah!', 'success');
      setActiveSelection(null);
      setPopoverPos(null);
      setNoteDraft('');
      setShortcutPanel('none');
      setCustomIconDraft('');
      setCustomImageDraft('');
      setInteractionMode('none');
    } catch (err: any) {
      console.error('Surgical edit error:', err);
      showToast(err.message || 'Gagal menerapkan AI Bedah pada elemen.', 'error');
    } finally {
      setIsSurgicalLoading(false);
    }
  };

  const handleSendToChat = () => {
    if (!activeSelection) return;

    handleSaveAndApply();

    const bounds = activeSelection.bounds;
    const area = `bounds: x=${bounds.x.toFixed(4)}, y=${bounds.y.toFixed(4)}, w=${bounds.w.toFixed(4)}, h=${bounds.h.toFixed(4)}`;

    const note = (noteDraft || '').trim();
    const prompt = [
      'Tolong ubah prototype pada MARK/AREA berikut agar sesuai dengan catatan pengguna.',
      `Mode: ${activeSelection.kind}`,
      area,
      activeSelection.kind === 'element' && activeSelection.elementUid ? `elementUid: ${activeSelection.elementUid}` : null,
      note ? `Catatan: ${note}` : null,
      'Fokus perubahan pada area/elemen yang ditandai. Setelah itu buat ulang mockup agar konsisten.'
    ].filter(Boolean).join('\n');

    setExternalChatSendToken(Date.now());
    setExternalChatSendText(prompt);

    // Popover langsung menutup setelah diklik dan dikirim ke chat
    setActiveSelection(null);
    setPopoverPos(null);
    setNoteDraft('');
    setTextColorDraft('');
    setBgColorDraft('');
    setTextContentDraft('');
    setShortcutPanel('none');
    setCustomIconDraft('');
    setCustomImageDraft('');
    setDragDraft(null);
  };



  // Muat daftar prototype tersimpan setelah sesi login terverifikasi (sekali saja)
  useEffect(() => {
    if (isAuthenticated !== true || savedLoaded) return;
    getAuthHeaders()
      .then((headers) => fetch('/api/projects', { cache: 'no-store', headers }))
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { projects?: SavedProject[] } | null) => {
        if (data && Array.isArray(data.projects)) {
          setSavedProjects(data.projects);
          // Jika canvas saat ini masih kosong dan ada saved projects, otomatis pulihkan project terbaru ke Live Preview
          setProjectState((current) => {
            if (!current.canvasCode?.html && data.projects && data.projects.length > 0) {
              const latest = data.projects[0];
              let cleanHtml = latest.canvas_html || '';
              if (cleanHtml.includes('</html>')) {
                cleanHtml = cleanHtml.slice(0, cleanHtml.lastIndexOf('</html>') + 7).trim();
              }
              autoSavedProjectIdRef.current = latest.id;
              lastSavedCanvasRef.current = cleanHtml;
              const restored: AppProjectState = {
                ...initialProjectState,
                id: 'saved-' + latest.id,
                title: latest.title,
                description: latest.description || '',
                annotations: { marks: [], notes: [], patches: latest.annotations?.patches || [] },
                updatedAt: latest.updated_at || new Date().toISOString(),
                canvasCode: {
                  html: cleanHtml,
                  css: latest.canvas_css || '',
                  js: latest.canvas_js || ''
                },
                gasConfig: {
                  sheetId: latest.spreadsheet_id || '',
                  webAppUrl: latest.gas_web_app_url || '',
                  scriptCode: latest.gas_script || '',
                  isConnected: Boolean(latest.gas_script)
                }
              };
              if (typeof window !== 'undefined') {
                try {
                  localStorage.setItem('mba_active_project', JSON.stringify(restored));
                  localStorage.setItem('mba_active_project_id', latest.id);
                } catch {}
              }
              setRightPanelTab('PREVIEW');
              setReloadTrigger((k) => k + 1);
              return restored;
            }
            return current;
          });
        }
      })
      .catch((err) => console.error('Failed to load saved projects:', err))
      .finally(() => setSavedLoaded(true));
  }, [isAuthenticated, savedLoaded]);

  // PRD Bagian 9: Download index.html mandiri untuk deploy ke Cloudflare Pages
  const handleDownloadIndexHtml = () => {
    const fullHtml = buildSrcDoc(projectState.canvasCode);
    if (!fullHtml) return;

    const cleanHtml = stripOdUids(fullHtml);
    const blob = new Blob([cleanHtml], { type: 'text/html;charset=utf-8;' });
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
            externalSendToken={externalChatSendToken ?? undefined}
            externalSendText={externalChatSendText}
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
                <div className="flex items-center gap-1.5">
                  {/* Visual History Undo & Redo (Fase 3) */}
                  <div className="flex items-center gap-0.5 bg-slate-900/60 border border-slate-800 rounded-xl p-0.5 mr-1">
                    <button
                      onClick={handleUndo}
                      disabled={!canUndo}
                      className={`p-1.5 rounded-lg text-[10px] font-semibold transition-all ${
                        canUndo
                          ? 'text-slate-200 hover:bg-slate-800 hover:text-white'
                          : 'text-slate-600 opacity-40 cursor-not-allowed'
                      }`}
                      title="Undo Visual (Ctrl+Z / Cmd+Z)"
                      aria-label="Undo"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={handleRedo}
                      disabled={!canRedo}
                      className={`p-1.5 rounded-lg text-[10px] font-semibold transition-all ${
                        canRedo
                          ? 'text-slate-200 hover:bg-slate-800 hover:text-white'
                          : 'text-slate-600 opacity-40 cursor-not-allowed'
                      }`}
                      title="Redo Visual (Ctrl+Shift+Z / Cmd+Shift+Z / Cmd+Y)"
                      aria-label="Redo"
                    >
                      <Redo2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setReloadTrigger((k) => k + 1)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all ml-0.5"
                      title="Muat Ulang Tampilan Canvas (Refresh)"
                      aria-label="Refresh Preview"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      setInteractionMode((prev) => (prev === 'select' ? 'none' : 'select'));
                      setActiveSelection(null);
                      setPopoverPos(null);
                    }}
                    className={`px-2.5 py-1 rounded-xl text-[10px] font-semibold border transition-all ${
                      interactionMode === 'select'
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm shadow-indigo-600/30'
                        : 'bg-slate-900/30 text-slate-300 border-slate-700 hover:bg-slate-900/50 hover:text-white'
                    }`}
                    title={interactionMode === 'select' ? 'Nonaktifkan Select mode' : 'Pilih elemen (klik)'}
                  >
                    Select
                  </button>
                  <button
                    onClick={() => {
                      setInteractionMode((prev) => (prev === 'mark' ? 'none' : 'mark'));
                      setActiveSelection(null);
                      setPopoverPos(null);
                    }}
                    className={`px-2.5 py-1 rounded-xl text-[10px] font-semibold border transition-all ${
                      interactionMode === 'mark'
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm shadow-emerald-600/30'
                        : 'bg-slate-900/30 text-slate-300 border-slate-700 hover:bg-slate-900/50 hover:text-white'
                    }`}
                    title={interactionMode === 'mark' ? 'Nonaktifkan Mark mode' : 'Mark area (drag)'}
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
                      <div
                        className={`absolute inset-0 z-20 ${interactionMode === 'mark' ? 'pointer-events-auto' : 'pointer-events-none'}`}
                        onPointerDown={(e) => {
                          if (interactionMode !== 'mark') return;
                          if (!overlayRef.current) return;
                          if (e.pointerType === 'mouse' && e.button !== 0) return;
                          e.preventDefault();
                          e.stopPropagation();
                           const rect = overlayRef.current.getBoundingClientRect();
                           setOverlaySize({ w: rect.width, h: rect.height });
                          const startX = e.clientX - rect.left;
                          const startY = e.clientY - rect.top;
                          dragDraftRef.current = { dragging: true, startX, startY };
                          const bounds = {
                            x: startX / rect.width,
                            y: startY / rect.height,
                            w: 0,
                            h: 0
                          };
                          dragBoundsRef.current = bounds;
                          setDragDraft({ bounds });
                        }}
                        onPointerMove={(e) => {
                          if (interactionMode !== 'mark') return;
                          const st = dragDraftRef.current;
                          if (!st?.dragging || !overlayRef.current) return;
                          e.preventDefault();
                          e.stopPropagation();
                           const rect = overlayRef.current.getBoundingClientRect();
                           setOverlaySize({ w: rect.width, h: rect.height });
                          const endX = e.clientX - rect.left;
                          const endY = e.clientY - rect.top;
                          const left = Math.min(st.startX, endX);
                          const top = Math.min(st.startY, endY);
                          const width = Math.abs(endX - st.startX);
                          const height = Math.abs(endY - st.startY);
                          const bounds = {
                            x: clamp(left / rect.width, 0, 1),
                            y: clamp(top / rect.height, 0, 1),
                            w: clamp(width / rect.width, 0, 1),
                            h: clamp(height / rect.height, 0, 1)
                          };
                          dragBoundsRef.current = bounds;
                          setDragDraft({ bounds });
                        }}
                        onPointerUp={(e) => {
                          if (interactionMode !== 'mark') return;
                          const st = dragDraftRef.current;
                          if (!st?.dragging || !overlayRef.current) return;
                          e.preventDefault();
                          e.stopPropagation();
                          dragDraftRef.current = null;
                           const bounds = dragBoundsRef.current;
                           if (!bounds) return;
                           if (!bounds.w || !bounds.h) return;
                           const rect = overlayRef.current.getBoundingClientRect();
                           const minPxW = rect.width * bounds.w;
                           const minPxH = rect.height * bounds.h;
                           if (minPxW < 6 || minPxH < 6) {
                             setDragDraft(null);
                             dragBoundsRef.current = null;
                             return;
                           }
                          const markId = newOdId();
                          setActiveSelection({ markId, kind: 'area', bounds });
                          setNoteDraft('');
                          setTextColorDraft('');
                          setTextContentDraft('');
                          setDragDraft(null);
                          dragBoundsRef.current = null;
                        }}
                      >
                        {dragDraft && (
                          <div
                            className="absolute border-2 border-emerald-400/80 bg-emerald-400/10 pointer-events-none"
                            style={{
                              left: dragDraft.bounds.x * overlaySize.w,
                              top: dragDraft.bounds.y * overlaySize.h,
                              width: dragDraft.bounds.w * overlaySize.w,
                              height: dragDraft.bounds.h * overlaySize.h
                            }}
                          />
                        )}
                      </div>

                      {/* Layer terpisah untuk active selection & floating inspector note agar tidak terblokir oleh pointer event overlay */}
                      {selectionPx && activeSelection && (
                        <div className="absolute inset-0 z-30 pointer-events-none">
                          <div
                            className="absolute border-2 border-indigo-500/80 bg-indigo-500/10 pointer-events-none"
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
                              left: popoverPos?.x ?? selectionPx.defaultLeft,
                              top: popoverPos?.y ?? selectionPx.defaultTop,
                              width: selectionPx.popoverW
                            }}
                            onPointerDown={(e) => e.stopPropagation()}
                            onPointerUp={(e) => e.stopPropagation()}
                            onPointerMove={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            onMouseUp={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="w-full bg-slate-900/95 backdrop-blur-xl border border-slate-700/90 rounded-2xl shadow-2xl p-3 space-y-3 max-h-[82vh] overflow-y-auto custom-scrollbar">
                              {/* Header Card dengan Grab Handle untuk Menggeser Popover */}
                              <div
                                onPointerDown={handlePopoverDragStart}
                                onPointerMove={handlePopoverDragMove}
                                onPointerUp={handlePopoverDragEnd}
                                className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2 cursor-grab active:cursor-grabbing select-none"
                                title="Klik & geser untuk memindahkan posisi popover"
                              >
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <div className="p-0.5 text-slate-500 hover:text-slate-300">
                                    <GripHorizontal className="w-4 h-4" />
                                  </div>
                                  {activeSelection.kind === 'element' ? (
                                    <>
                                      <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 font-mono text-[10px] font-bold uppercase tracking-wider border border-indigo-500/30">
                                        &lt;{activeSelection.tagName || 'elem'}&gt;
                                      </span>
                                      <button
                                        onPointerDown={(e) => e.stopPropagation()}
                                        onClick={() => {
                                          if (activeSelection.elementUid) {
                                            iframeRef.current?.contentWindow?.postMessage(
                                              {
                                                source: 'OD_BRIDGE',
                                                type: 'OD_START_INLINE_EDIT',
                                                elementUid: activeSelection.elementUid
                                              },
                                              '*'
                                            );
                                          }
                                        }}
                                        className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold border border-slate-700/60 flex items-center gap-1 transition-colors"
                                        title="Double-click di canvas atau klik di sini untuk edit teks langsung"
                                      >
                                        <Edit3 className="w-2.5 h-2.5 text-indigo-400" />
                                        <span>Edit Teks</span>
                                      </button>
                                    </>
                                  ) : (
                                    <div className="flex items-center gap-1.5">
                                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold uppercase tracking-wider border border-emerald-500/30">
                                        MARK AREA
                                      </span>
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  {activeSelection.kind === 'element' && (
                                    <button
                                      onPointerDown={(e) => e.stopPropagation()}
                                      onClick={() => {
                                        if (confirm('Hapus elemen ini dari canvas?')) {
                                          applyQuickPatch('remove', 'deleted');
                                        }
                                      }}
                                      className="text-rose-400 hover:text-rose-300 p-1 rounded-lg hover:bg-rose-500/20 transition-colors"
                                      title="Hapus komponen ini langsung"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  <button
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onClick={() => {
                                      setActiveSelection(null);
                                      setPopoverPos(null);
                                      setInteractionMode('none');
                                      setNoteDraft('');
                                      setTextColorDraft('');
                                      setBgColorDraft('');
                                      setTextContentDraft('');
                                      setFontSizeDraft('');
                                      setFontWeightDraft('');
                                      setTextAlignDraft('');
                                      setBorderRadiusDraft('');
                                      setShortcutPanel('none');
                                      setCustomIconDraft('');
                                      setCustomImageDraft('');
                                    }}
                                    className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                                    title="Tutup inspector & kembali ke mode interaktif"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Breadcrumb Hierarki Elemen (Fase 3) */}
                              {activeSelection.kind === 'element' && activeSelection.breadcrumbs && activeSelection.breadcrumbs.length > 0 && (
                                <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono overflow-x-auto whitespace-nowrap bg-slate-950/60 px-2.5 py-1.5 rounded-xl border border-slate-800 custom-scrollbar">
                                  <span className="text-slate-500 text-[9px] font-semibold">DOM:</span>
                                  {activeSelection.breadcrumbs.map((crumb, idx) => (
                                    <span key={idx} className="flex items-center gap-1">
                                      {idx > 0 && <span className="text-slate-600">›</span>}
                                      <span className={idx === activeSelection.breadcrumbs!.length - 1 ? 'text-indigo-300 font-bold bg-indigo-500/10 px-1 py-0.5 rounded' : 'text-slate-400'}>
                                        {crumb}
                                      </span>
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Quick Visual Styler untuk mode Element */}
                              {activeSelection.kind === 'element' && (
                                <div className="space-y-2.5 pt-0.5">
                                  {/* Quick Text Content Input */}
                                  <div>
                                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold mb-1">
                                      <span>Teks Elemen</span>
                                      <span className="text-[9px] text-indigo-400 font-medium">Auto-Sync ke HTML</span>
                                    </div>
                                    <input
                                      type="text"
                                      value={textContentDraft}
                                      onChange={(e) => applyQuickPatch('textContent', e.target.value)}
                                      className="w-full bg-slate-950/60 border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 cursor-text select-text"
                                      placeholder="Ubah isi teks komponen langsung..."
                                    />
                                  </div>

                                  {/* Typography & Alignment Controls */}
                                  <div>
                                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold mb-1">
                                      <span>Tipografi & Format</span>
                                      <span className="font-mono text-[9px] text-slate-500">{fontSizeDraft || 'default'}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {/* Ukuran Font */}
                                      <div className="flex items-center bg-slate-950/70 border border-slate-800 rounded-lg p-0.5">
                                        {[
                                          { label: 'S', val: '12px', title: 'Kecil (12px)' },
                                          { label: 'M', val: '14px', title: 'Normal (14px)' },
                                          { label: 'L', val: '18px', title: 'Besar (18px)' },
                                          { label: 'XL', val: '24px', title: 'Judul (24px)' },
                                        ].map((sz) => (
                                          <button
                                            key={sz.val}
                                            onClick={() => applyQuickPatch('fontSize', sz.val)}
                                            className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition-colors ${fontSizeDraft === sz.val ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                                            title={sz.title}
                                          >
                                            {sz.label}
                                          </button>
                                        ))}
                                      </div>

                                      {/* Font Weight: Bold */}
                                      <button
                                        onClick={() => applyQuickPatch('fontWeight', fontWeightDraft === 'bold' || fontWeightDraft === '700' ? 'normal' : 'bold')}
                                        className={`p-1.5 rounded-lg border text-xs transition-colors flex items-center justify-center ${fontWeightDraft === 'bold' || fontWeightDraft === '700' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:text-white'}`}
                                        title="Tebalkan Teks (Bold)"
                                      >
                                        <Bold className="w-3 h-3" />
                                      </button>

                                      {/* Text Alignment */}
                                      <div className="flex items-center bg-slate-950/70 border border-slate-800 rounded-lg p-0.5">
                                        <button
                                          onClick={() => applyQuickPatch('textAlign', 'left')}
                                          className={`p-1 rounded transition-colors ${textAlignDraft === 'left' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                                          title="Rata Kiri"
                                        >
                                          <AlignLeft className="w-3 h-3" />
                                        </button>
                                        <button
                                          onClick={() => applyQuickPatch('textAlign', 'center')}
                                          className={`p-1 rounded transition-colors ${textAlignDraft === 'center' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                                          title="Rata Tengah"
                                        >
                                          <AlignCenter className="w-3 h-3" />
                                        </button>
                                        <button
                                          onClick={() => applyQuickPatch('textAlign', 'right')}
                                          className={`p-1 rounded transition-colors ${textAlignDraft === 'right' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                                          title="Rata Kanan"
                                        >
                                          <AlignRight className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Quick Text Color Palette */}
                                  <div>
                                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold mb-1">
                                      <span>Warna Teks Cepat</span>
                                      <span className="font-mono text-[9px] text-slate-500">{textColorDraft || 'default'}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      {[
                                        { label: 'Putih', val: '#ffffff', bg: 'bg-white' },
                                        { label: 'Dark', val: '#0f172a', bg: 'bg-slate-900 border border-slate-700' },
                                        { label: 'Indigo', val: '#6366f1', bg: 'bg-indigo-500' },
                                        { label: 'Emerald', val: '#10b981', bg: 'bg-emerald-500' },
                                        { label: 'Amber', val: '#f59e0b', bg: 'bg-amber-500' },
                                        { label: 'Rose', val: '#f43f5e', bg: 'bg-rose-500' },
                                      ].map((sw) => (
                                        <button
                                          key={sw.val}
                                          onClick={() => applyQuickPatch('textColor', sw.val)}
                                          className={`w-5 h-5 rounded-full ${sw.bg} shadow hover:scale-110 active:scale-95 transition-transform ${textColorDraft === sw.val ? 'ring-2 ring-indigo-400' : ''}`}
                                          title={`Terapkan warna teks ${sw.label}`}
                                        />
                                      ))}
                                    </div>
                                  </div>

                                  {/* Quick Background Color Palette */}
                                  <div>
                                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold mb-1">
                                      <span>Warna Latar (BG) Cepat</span>
                                      <span className="font-mono text-[9px] text-slate-500">{bgColorDraft || 'default'}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      {[
                                        { label: 'Transparan', val: 'transparent', bg: 'bg-slate-800 border border-dashed border-slate-600' },
                                        { label: 'Indigo', val: '#4f46e5', bg: 'bg-indigo-600' },
                                        { label: 'Emerald', val: '#059669', bg: 'bg-emerald-600' },
                                        { label: 'Dark Card', val: '#1e293b', bg: 'bg-slate-800' },
                                        { label: 'Amber', val: '#d97706', bg: 'bg-amber-600' },
                                        { label: 'Rose', val: '#e11d48', bg: 'bg-rose-600' },
                                      ].map((sw) => (
                                        <button
                                          key={sw.val}
                                          onClick={() => applyQuickPatch('bgColor', sw.val)}
                                          className={`w-5 h-5 rounded-md ${sw.bg} shadow hover:scale-110 active:scale-95 transition-transform ${bgColorDraft === sw.val ? 'ring-2 ring-indigo-400' : ''}`}
                                          title={`Terapkan latar ${sw.label}`}
                                        />
                                      ))}
                                    </div>
                                  </div>

                                  {/* Quick Border Radius */}
                                  <div>
                                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold mb-1">
                                      <span>Lengkung Sudut (Radius)</span>
                                      <span className="font-mono text-[9px] text-slate-500">{borderRadiusDraft || 'default'}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {[
                                        { label: 'Kotak', val: '0px', shape: 'rounded-none' },
                                        { label: 'Rounded', val: '8px', shape: 'rounded-md' },
                                        { label: 'Pill', val: '9999px', shape: 'rounded-full' },
                                      ].map((rad) => (
                                        <button
                                          key={rad.val}
                                          onClick={() => applyQuickPatch('borderRadius', rad.val)}
                                          className={`px-2.5 py-1 text-[10px] font-semibold border rounded-lg flex items-center gap-1 transition-colors ${borderRadiusDraft === rad.val ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800'}`}
                                          title={`Atur sudut: ${rad.label}`}
                                        >
                                          <div className={`w-2.5 h-2.5 border border-current ${rad.shape}`} />
                                          <span>{rad.label}</span>
                                        </button>
                                      ))}
                                    </div>

                                    {/* Tombol Pintas: Sisipkan Ikon & Gambar Cepat */}
                                    <div className="pt-1 border-t border-slate-800/80">
                                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold mb-1.5">
                                        <span>Tombol Pintas Sisip</span>
                                        <span className="text-[9px] text-indigo-400 font-medium">Instan ke Elemen</span>
                                      </div>
                                      <div className="grid grid-cols-2 gap-1.5">
                                        <button
                                          type="button"
                                          onPointerDown={(e) => e.stopPropagation()}
                                          onClick={() => setShortcutPanel(shortcutPanel === 'icon' ? 'none' : 'icon')}
                                          className={`py-1.5 px-2 rounded-xl text-xs font-semibold flex items-center justify-between border transition-all ${
                                            shortcutPanel === 'icon'
                                              ? 'bg-indigo-600 border-indigo-500 text-white shadow-md'
                                              : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
                                          }`}
                                          title="Buka pilihan ikon pintas Lucide"
                                        >
                                          <div className="flex items-center gap-1.5">
                                            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                                            <span>+ Ikon</span>
                                          </div>
                                          {shortcutPanel === 'icon' ? <ChevronUp className="w-3 h-3 opacity-80" /> : <ChevronDown className="w-3 h-3 opacity-80" />}
                                        </button>

                                        <button
                                          type="button"
                                          onPointerDown={(e) => e.stopPropagation()}
                                          onClick={() => setShortcutPanel(shortcutPanel === 'image' ? 'none' : 'image')}
                                          className={`py-1.5 px-2 rounded-xl text-xs font-semibold flex items-center justify-between border transition-all ${
                                            shortcutPanel === 'image'
                                              ? 'bg-emerald-600 border-emerald-500 text-white shadow-md'
                                              : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
                                          }`}
                                          title="Buka pilihan gambar & avatar pintas"
                                        >
                                          <div className="flex items-center gap-1.5">
                                            <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                                            <span>+ Gambar</span>
                                          </div>
                                          {shortcutPanel === 'image' ? <ChevronUp className="w-3 h-3 opacity-80" /> : <ChevronDown className="w-3 h-3 opacity-80" />}
                                        </button>
                                      </div>

                                      {/* Panel Pilihan Ikon */}
                                      {shortcutPanel === 'icon' && (
                                        <div className="mt-2 p-2 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                                          <div className="text-[10px] text-slate-400 font-semibold flex items-center justify-between">
                                            <span>Pilih Ikon Cepat:</span>
                                            <span className="text-[9px] text-slate-500 font-mono">Lucide Icons</span>
                                          </div>
                                          <div className="grid grid-cols-4 gap-1 max-h-36 overflow-y-auto custom-scrollbar p-0.5">
                                            {POPULAR_ICONS.map((ic) => {
                                              const IconComp = ic.icon;
                                              return (
                                                <button
                                                  key={ic.name}
                                                  type="button"
                                                  onPointerDown={(e) => e.stopPropagation()}
                                                  onClick={() => handleInsertIcon(ic.name)}
                                                  className="p-1.5 rounded-lg bg-slate-900/90 hover:bg-indigo-600 border border-slate-800 hover:border-indigo-500 text-slate-300 hover:text-white flex flex-col items-center justify-center gap-1 transition-all group"
                                                  title={`Sisipkan ikon ${ic.name}`}
                                                >
                                                  <IconComp className="w-3.5 h-3.5 group-hover:scale-110 transition-transform text-indigo-400 group-hover:text-white" />
                                                  <span className="text-[8px] font-mono leading-none truncate max-w-[50px]">{ic.label}</span>
                                                </button>
                                              );
                                            })}
                                          </div>
                                          <div className="pt-1 border-t border-slate-800/80 flex items-center gap-1.5">
                                            <input
                                              type="text"
                                              value={customIconDraft}
                                              onChange={(e) => setCustomIconDraft(e.target.value)}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter' && customIconDraft.trim()) {
                                                  handleInsertIcon(customIconDraft);
                                                  setCustomIconDraft('');
                                                }
                                              }}
                                              placeholder="Nama ikon lain (mis: phone, map)..."
                                              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[10px] text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                                            />
                                            <button
                                              type="button"
                                              onPointerDown={(e) => e.stopPropagation()}
                                              onClick={() => {
                                                if (customIconDraft.trim()) {
                                                  handleInsertIcon(customIconDraft);
                                                  setCustomIconDraft('');
                                                }
                                              }}
                                              disabled={!customIconDraft.trim()}
                                              className="px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-[10px] font-bold text-white shrink-0 transition-colors"
                                            >
                                              Sisip
                                            </button>
                                          </div>
                                        </div>
                                      )}

                                      {/* Panel Pilihan Gambar */}
                                      {shortcutPanel === 'image' && (
                                        <div className="mt-2 p-2 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                                          <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold">
                                            <span>Format Tampilan:</span>
                                          </div>
                                          <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                                            {[
                                              { id: 'avatar', label: 'Bulat (Avatar)' },
                                              { id: 'thumbnail', label: 'Kotak (48px)' },
                                              { id: 'banner', label: 'Banner Lebar' },
                                            ].map((fmt) => (
                                              <button
                                                key={fmt.id}
                                                type="button"
                                                onPointerDown={(e) => e.stopPropagation()}
                                                onClick={() => setImageStyleType(fmt.id as any)}
                                                className={`flex-1 py-0.5 text-[9px] font-medium rounded transition-colors ${
                                                  imageStyleType === fmt.id ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                                                }`}
                                              >
                                                {fmt.label}
                                              </button>
                                            ))}
                                          </div>

                                          <div className="text-[10px] text-slate-400 font-semibold pt-0.5">
                                            <span>Preset Gambar:</span>
                                          </div>
                                          <div className="space-y-1 max-h-36 overflow-y-auto custom-scrollbar p-0.5">
                                            {POPULAR_IMAGES.map((img) => (
                                              <button
                                                key={img.title}
                                                type="button"
                                                onPointerDown={(e) => e.stopPropagation()}
                                                onClick={() => handleInsertImage(img.url, imageStyleType || img.type)}
                                                className="w-full p-1.5 rounded-lg bg-slate-900/90 hover:bg-emerald-600/80 border border-slate-800 hover:border-emerald-500 text-slate-300 hover:text-white flex items-center gap-2 transition-all text-left group"
                                                title={`Sisipkan ${img.title}`}
                                              >
                                                <img src={img.url} alt={img.title} className="w-6 h-6 rounded object-cover shrink-0 border border-slate-700" />
                                                <span className="text-[10px] font-medium truncate flex-1">{img.title}</span>
                                                <Plus className="w-3 h-3 opacity-60 group-hover:opacity-100 shrink-0" />
                                              </button>
                                            ))}
                                          </div>

                                          <div className="pt-1 border-t border-slate-800/80 flex items-center gap-1.5">
                                            <input
                                              type="text"
                                              value={customImageDraft}
                                              onChange={(e) => setCustomImageDraft(e.target.value)}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter' && customImageDraft.trim()) {
                                                  handleInsertImage(customImageDraft, imageStyleType);
                                                  setCustomImageDraft('');
                                                }
                                              }}
                                              placeholder="URL gambar (https://...)..."
                                              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[10px] text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                                            />
                                            <button
                                              type="button"
                                              onPointerDown={(e) => e.stopPropagation()}
                                              onClick={() => {
                                                if (customImageDraft.trim()) {
                                                  handleInsertImage(customImageDraft, imageStyleType);
                                                  setCustomImageDraft('');
                                                }
                                              }}
                                              disabled={!customImageDraft.trim()}
                                              className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-[10px] font-bold text-white shrink-0 transition-colors"
                                            >
                                              Sisip
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* AI Instruction Textarea */}
                              <div>
                                <div className="text-[10px] text-slate-400 font-semibold mb-1 flex items-center gap-1">
                                  <Sparkles className="w-3 h-3 text-indigo-400" />
                                  <span>Perintah AI untuk komponen ini</span>
                                </div>
                                <textarea
                                  autoFocus
                                  value={noteDraft}
                                  onChange={(e) => setNoteDraft(e.target.value)}
                                  rows={2}
                                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none cursor-text select-text"
                                  placeholder="Tulis instruksi perubahan untuk komponen ini..."
                                />
                              </div>

                              {/* Action Buttons: ⚡ AI Bedah (Surgical) & Send to Chat */}
                              <div className="flex items-center gap-2 pt-1">
                                {activeSelection.kind === 'element' && (
                                  <button
                                    onClick={handleSurgicalEdit}
                                    disabled={isSurgicalLoading || !noteDraft.trim()}
                                    className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] ${
                                      isSurgicalLoading || !noteDraft.trim()
                                        ? 'bg-indigo-950/40 text-indigo-400/40 border border-indigo-900/30 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-amber-500 via-purple-600 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-white shadow-md shadow-indigo-600/30'
                                    }`}
                                    title="Perbarui elemen ini secara instan via AI dalam 2-3 detik tanpa reload halaman"
                                  >
                                    {isSurgicalLoading ? (
                                      <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        <span>Memproses...</span>
                                      </>
                                    ) : (
                                      <>
                                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                                        <span>⚡ AI Bedah</span>
                                      </>
                                    )}
                                  </button>
                                )}

                                <button
                                  onClick={handleSendToChat}
                                  disabled={isSurgicalLoading}
                                  className={`${
                                    activeSelection.kind === 'element' ? 'px-3' : 'w-full'
                                  } py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]`}
                                  title="Kirim catatan ke alur percakapan chat utama"
                                >
                                  <Send className="w-3.5 h-3.5" />
                                  <span>{activeSelection.kind === 'element' ? 'Ke Chat' : 'Send to Chat'}</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      <iframe
                        ref={iframeRef}
                        title="Live Preview Canvas"
                        srcDoc={memoizedSrcDoc}
                        className="w-full h-full border-none bg-slate-50"
                        sandbox="allow-scripts allow-forms allow-modals"
                        onLoad={() => {
                          const win = iframeRef.current?.contentWindow;
                          if (!win) return;
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

                      {/* Micro Toast Feedback (Fase 3) */}
                      {toastMessage && (
                        <div className="absolute bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-slate-900/95 border border-slate-700/80 shadow-2xl backdrop-blur-xl text-xs font-semibold animate-in fade-in slide-in-from-bottom-2 duration-200 pointer-events-none select-none">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${toastMessage.type === 'error' ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]' : toastMessage.type === 'success' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.6)]'}`} />
                          <span className="text-slate-200">{toastMessage.text}</span>
                        </div>
                      )}
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
