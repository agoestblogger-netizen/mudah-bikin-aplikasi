'use client';

import React, { useEffect, useRef, useState, useId } from 'react';
import { generateMermaidErDiagram, type SchemaTableForErd } from '@/lib/erdGenerator';
import { Layers, ZoomIn, ZoomOut, RotateCcw, Copy, Check, Sparkles } from 'lucide-react';

interface ErdPanelProps {
  tables: SchemaTableForErd[];
  title?: string;
}

export const ErdPanel: React.FC<ErdPanelProps> = ({ tables, title = 'Entity Relationship Diagram (ERD)' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isRendering, setIsRendering] = useState(false);
  const uniqueId = useId().replace(/[^a-zA-Z0-9]/g, '');

  const mermaidCode = React.useMemo(() => {
    return generateMermaidErDiagram(tables);
  }, [tables]);

  useEffect(() => {
    let isMounted = true;

    async function renderDiagram() {
      if (!mermaidCode) return;
      setIsRendering(true);
      setErrorMsg(null);

      try {
        const mermaidModule = await import('mermaid');
        const mermaid = mermaidModule.default;

        mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
          er: {
            useMaxWidth: false,
            entityPadding: 15,
            stroke: '#6366f1',
            fill: '#181824',
            fontSize: 12
          },
          themeVariables: {
            darkMode: true,
            background: '#0a0a0e',
            primaryColor: '#1f1f2e',
            primaryTextColor: '#f3f4f6',
            primaryBorderColor: '#4f46e5',
            lineColor: '#10f48e',
            secondaryColor: '#111827',
            tertiaryColor: '#1e1e2d'
          }
        });

        const renderId = `erd-${uniqueId}-${Date.now()}`;
        const { svg } = await mermaid.render(renderId, mermaidCode);

        if (isMounted) {
          setSvgContent(svg);
          setIsRendering(false);
        }
      } catch (err: any) {
        console.error('[ERD-PANEL] Gagal me-render Mermaid ERD:', err);
        if (isMounted) {
          setErrorMsg(err?.message || 'Gagal memproses visualisasi diagram ERD');
          setIsRendering(false);
        }
      }
    }

    renderDiagram();

    return () => {
      isMounted = false;
    };
  }, [mermaidCode, uniqueId]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(mermaidCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#0a0a0e] text-zinc-100 rounded-2xl overflow-hidden border border-white/10 shadow-2xl relative">
      {/* Header Toolbar ERD Panel */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#0e0e16] border-b border-white/10 shrink-0 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-white tracking-wide truncate">{title}</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" />
                Live Schema Reflow
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">
              {tables.length} tabel • Mode Ringkas (PK, FK & Garis Relasi)
            </p>
          </div>
        </div>

        {/* Controls: Zoom In, Zoom Out, Reset, Copy Code */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center bg-[#161622] border border-white/10 rounded-xl p-1 gap-0.5">
            <button
              onClick={() => setZoom((z) => Math.min(z + 0.15, 2.5))}
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title="Perbesar (Zoom In)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-mono font-semibold text-zinc-400 px-1 select-none">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.max(z - 0.15, 0.4))}
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title="Perkecil (Zoom Out)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoom(1)}
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title="Reset Ukuran (100%)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={handleCopyCode}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-zinc-200 transition-all active:scale-95"
            title="Salin sintaks Mermaid ERD"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Tersalin!' : 'Copy ERD'}</span>
          </button>
        </div>
      </div>

      {/* Viewport Render SVG ERD */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto p-6 flex items-center justify-center bg-[#07070a] relative custom-scrollbar select-none"
      >
        {isRendering ? (
          <div className="flex flex-col items-center gap-3 text-zinc-500">
            <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
            <span className="text-xs font-medium">Merender diagram relasi tabel...</span>
          </div>
        ) : errorMsg ? (
          <div className="max-w-md p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs space-y-2">
            <p className="font-bold">Kendala Render ERD:</p>
            <p className="font-mono text-[11px] opacity-90">{errorMsg}</p>
            <pre className="p-2 bg-black/50 rounded text-[10px] overflow-x-auto text-zinc-400">{mermaidCode}</pre>
          </div>
        ) : svgContent ? (
          <div
            className="transition-transform duration-150 ease-out origin-center"
            style={{ transform: `scale(${zoom})` }}
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        ) : (
          <div className="text-xs text-zinc-500">Menunggu skema data...</div>
        )}
      </div>

      {/* Footer Info Ringkas */}
      <div className="px-4 py-2 bg-[#0c0c12] border-t border-white/5 text-[11px] text-zinc-500 flex items-center justify-between shrink-0">
        <span>Diagram ini diperbarui secara otomatis setiap kali Anda meminta revisi pada skema tabel di chat.</span>
        <span className="font-mono text-[10px] text-indigo-400 font-semibold">Mermaid erDiagram</span>
      </div>
    </div>
  );
};
