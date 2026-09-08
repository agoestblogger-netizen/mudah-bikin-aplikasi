'use client';

import React, { useEffect, useRef, useState } from 'react';
import { FolderOpen, Trash2, Loader2 } from 'lucide-react';
import { buildSrcDoc } from '@/lib/buildSrcDoc';
import type { SavedProject } from '@/types/app';

interface SavedProjectsListProps {
  projects: SavedProject[];
  loading: boolean;
  deletingId: string | null;
  onLoad: (project: SavedProject) => void;
  onDelete: (id: string) => void;
}

// Lebar render asli iframe miniatur — kontainer mengecilkan dengan transform scale.
const THUMB_RENDER_WIDTH = 900;
const THUMB_RENDER_HEIGHT = Math.round((THUMB_RENDER_WIDTH * 3) / 4);

// Ukur lebar kontainer thumbnail lalu hitung skala agar iframe 900px pas dirender.
function useContainerScale(containerRef: React.RefObject<HTMLDivElement | null>, designWidth: number): number {
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth > 0 ? el.clientWidth / designWidth : 0);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef, designWidth]);

  return scale;
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Baru saja';
  if (diffMin < 60) return `${diffMin} mnt lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} jam lalu`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay} hari lalu`;
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function SavedProjectCard({
  project,
  deleting,
  onLoad,
  onDelete,
}: {
  project: SavedProject;
  deleting: boolean;
  onLoad: () => void;
  onDelete: () => void;
}) {
  const thumbContainerRef = useRef<HTMLDivElement>(null);
  const scale = useContainerScale(thumbContainerRef, THUMB_RENDER_WIDTH);

  const canvas = {
    html: project.canvas_html || '',
    css: project.canvas_css || '',
    js: project.canvas_js || ''
  };
  const srcDoc = buildSrcDoc(canvas);
  const hasPreview = Boolean(srcDoc);

  return (
    <div className="relative group">
      {/* Thumbnail Mini Live Preview */}
      <button
        type="button"
        onClick={onLoad}
        title={`Buka: ${project.title}`}
        className="w-full aspect-[4/3] rounded-xl overflow-hidden bg-slate-950 border border-slate-800 hover:border-indigo-500/70 transition-all cursor-pointer relative block text-left"
      >
        {hasPreview && scale > 0 ? (
          <div ref={thumbContainerRef} className="absolute inset-0 overflow-hidden">
            <div
              style={{
                width: THUMB_RENDER_WIDTH,
                height: THUMB_RENDER_HEIGHT,
                transformOrigin: 'top left',
                transform: `scale(${scale})`,
              }}
              className="pointer-events-none relative"
            >
              <iframe
                title={`Preview ${project.title}`}
                srcDoc={srcDoc}
                width={THUMB_RENDER_WIDTH}
                height={THUMB_RENDER_HEIGHT}
                className="border-none"
                sandbox="allow-scripts allow-forms"
                scrolling="no"
              />
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-600">
            <FolderOpen className="w-8 h-8" />
          </div>
        )}
        {/* Overlay interaktif saat hover */}
        <div className="absolute inset-0 bg-slate-950/0 group-hover:bg-slate-950/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <span className="text-[10px] font-bold text-white bg-indigo-600/90 px-2.5 py-1 rounded-lg">Buka di Preview</span>
        </div>
      </button>

      {/* Badge Tong Sampah di Pojok Atas Thumbnail */}
      <button
        type="button"
        onClick={onDelete}
        disabled={deleting}
        aria-label={`Hapus ${project.title}`}
        title="Hapus file"
        className="absolute top-2 left-2 w-7 h-7 rounded-full bg-slate-900/90 border border-slate-700 text-slate-300 hover:text-rose-400 hover:bg-rose-500/15 hover:border-rose-500/50 flex items-center justify-center transition-all cursor-pointer z-10 disabled:opacity-50"
      >
        {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
      </button>

      {/* Info Kartu */}
      <div className="mt-1.5 flex items-center justify-between gap-2 px-0.5">
        <p className="text-[11px] font-semibold text-slate-200 truncate" title={project.title}>
          {project.title}
        </p>
        <span className="text-[9px] text-slate-500 shrink-0">{formatRelativeTime(project.updated_at)}</span>
      </div>
    </div>
  );
}

export const SavedProjectsList: React.FC<SavedProjectsListProps> = ({
  projects,
  loading,
  deletingId,
  onLoad,
  onDelete,
}) => {
  return (
    <div className="w-full h-full overflow-y-auto p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-bold text-white inline-flex items-center gap-1.5">
          <FolderOpen className="w-3.5 h-3.5 text-indigo-400" />
          File Terbaru Anda
        </h4>
        <span className="text-[10px] text-slate-500">{projects.length} file</span>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-3 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
          <p className="text-xs">Memuat file tersimpan...</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-16 px-6 space-y-3 text-slate-500">
          <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center">
            <FolderOpen className="w-6 h-6 text-indigo-400/60" />
          </div>
          <p className="text-xs leading-relaxed max-w-[220px]">
            Belum ada prototype tersimpan. Hasil generasi AI akan otomatis muncul di sini.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {projects.map((p) => (
            <SavedProjectCard
              key={p.id}
              project={p}
              deleting={deletingId === p.id}
              onLoad={() => onLoad(p)}
              onDelete={() => onDelete(p.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};