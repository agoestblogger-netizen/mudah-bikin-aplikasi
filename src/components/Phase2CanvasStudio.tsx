'use client';

import React, { useState, useEffect } from 'react';
import { AppProjectState } from '@/types/app';
import { Palette, Code2, Play, Eye, ShieldAlert, CheckCircle2, AlertTriangle, RefreshCw, Layers, Copy } from 'lucide-react';

interface Phase2CanvasStudioProps {
  projectState: AppProjectState;
  onUpdateState: (updated: Partial<AppProjectState>) => void;
  onNextPhase: () => void;
}

export const Phase2CanvasStudio: React.FC<Phase2CanvasStudioProps> = ({
  projectState,
  onUpdateState,
  onNextPhase
}) => {
  const [activeTab, setActiveTab] = useState<'PREVIEW' | 'HTML' | 'CSS' | 'JS'>('PREVIEW');
  const [htmlCode, setHtmlCode] = useState(projectState.canvasCode.html);
  const [cssCode, setCssCode] = useState(projectState.canvasCode.css);
  const [jsCode, setJsCode] = useState(projectState.canvasCode.js);
  const [copied, setCopied] = useState(false);

  // Self-Check HUD metrics
  const audit = projectState.qualityAudit;

  // Generate combined HTML for sandbox iframe
  const generateCombinedSrcDoc = () => {
    return `
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        <style>
          ${cssCode}
        </style>
      </head>
      <body>
        ${htmlCode}
        <script>
          try {
            ${jsCode}
          } catch(err) {
            console.error("Canvas JS Error:", err);
          }
        </script>
      </body>
      </html>
    `;
  };

  const handleUpdateCode = () => {
    onUpdateState({
      canvasCode: {
        html: htmlCode,
        css: cssCode,
        js: jsCode
      }
    });
  };

  const copyFullCode = () => {
    const full = `<!-- HTML -->\n${htmlCode}\n\n/* CSS */\n${cssCode}\n\n// JS\n${jsCode}`;
    navigator.clipboard.writeText(full);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 lg:p-8 backdrop-blur-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Palette className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">FASE 2: Studio Canvas & Prototipe Fungsional</h2>
            <p className="text-xs text-slate-400">Seluruh visualisasi dirender interaktif dalam Canvas (Aturan Mutlak: Kode SELALU lewat Canvas).</p>
          </div>
        </div>

        {/* Audit Quality Score */}
        <div className="flex items-center gap-3 bg-slate-950/80 border border-slate-800 px-4 py-2 rounded-2xl">
          <ShieldAlert className="w-5 h-5 text-emerald-400" />
          <div>
            <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Self-Check Audit</span>
            <span className="text-sm font-extrabold text-emerald-400">{audit.totalScore}/100 Poin</span>
          </div>
        </div>
      </div>

      {/* Audit Checklist Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`p-4 rounded-2xl border flex items-center gap-3 ${audit.isCanvasCodeOnly ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300' : 'bg-rose-950/20 border-rose-800/40 text-rose-300'}`}>
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <div className="text-xs">
            <span className="font-bold block">Render Lewat Canvas</span>
            <span className="text-[10px] opacity-80">Tidak ada teks mentah di chat</span>
          </div>
        </div>

        <div className={`p-4 rounded-2xl border flex items-center gap-3 ${audit.hasDynamicState ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300' : 'bg-amber-950/20 border-amber-800/40 text-amber-300'}`}>
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <div className="text-xs">
            <span className="font-bold block">Dynamic State JS</span>
            <span className="text-[10px] opacity-80">Bukan halaman mati</span>
          </div>
        </div>

        <div className={`p-4 rounded-2xl border flex items-center gap-3 ${audit.hasAdminUserManagement ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300' : 'bg-slate-900 border-slate-800 text-slate-400'}`}>
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <div className="text-xs">
            <span className="font-bold block">Fitur Tambah User</span>
            <span className="text-[10px] opacity-80">Terkunci di balik Role Admin</span>
          </div>
        </div>

        <div className={`p-4 rounded-2xl border flex items-center gap-3 ${audit.isResponsiveGlassmorphism ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300' : 'bg-slate-900 border-slate-800 text-slate-400'}`}>
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <div className="text-xs">
            <span className="font-bold block">Glassmorphism UI</span>
            <span className="text-[10px] opacity-80">Desain modern teruji</span>
          </div>
        </div>
      </div>

      {/* Main Studio View (Canvas Preview vs Code Editor) */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden backdrop-blur-xl">
        {/* Tab Controls */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2">
            {[
              { id: 'PREVIEW', label: 'Live Preview Canvas', icon: <Eye className="w-4 h-4" /> },
              { id: 'HTML', label: 'HTML Structure', icon: <Code2 className="w-4 h-4 text-orange-400" /> },
              { id: 'CSS', label: 'CSS Design System', icon: <Code2 className="w-4 h-4 text-cyan-400" /> },
              { id: 'JS', label: 'Dynamic JS State', icon: <Code2 className="w-4 h-4 text-yellow-400" /> }
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === t.id
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={copyFullCode}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-medium text-slate-300 hover:bg-slate-700"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copied ? 'Tersalin!' : 'Salin Kode'}</span>
            </button>
          </div>
        </div>

        {/* Tab Contents */}
        <div className="p-6">
          {activeTab === 'PREVIEW' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Interactive Sandboxed Canvas Viewport (1000px max-width)</span>
                <span className="text-emerald-400 font-mono">Status: Live Dynamic Execution</span>
              </div>
              <div className="w-full min-h-[550px] bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
                <iframe
                  title="Canvas Live Preview"
                  srcDoc={generateCombinedSrcDoc()}
                  className="w-full h-[550px] border-none"
                  sandbox="allow-scripts allow-modals allow-forms"
                />
              </div>
            </div>
          )}

          {activeTab === 'HTML' && (
            <div className="space-y-2">
              <label className="text-xs font-mono text-slate-400">HTML Code Block</label>
              <textarea
                rows={20}
                value={htmlCode}
                onChange={(e) => {
                  setHtmlCode(e.target.value);
                  handleUpdateCode();
                }}
                className="w-full p-4 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-xs text-emerald-300 focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}

          {activeTab === 'CSS' && (
            <div className="space-y-2">
              <label className="text-xs font-mono text-slate-400">CSS Glassmorphism Stylesheet</label>
              <textarea
                rows={20}
                value={cssCode}
                onChange={(e) => {
                  setCssCode(e.target.value);
                  handleUpdateCode();
                }}
                className="w-full p-4 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-xs text-cyan-300 focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}

          {activeTab === 'JS' && (
            <div className="space-y-2">
              <label className="text-xs font-mono text-slate-400">Dynamic State JS Logic</label>
              <textarea
                rows={20}
                value={jsCode}
                onChange={(e) => {
                  setJsCode(e.target.value);
                  handleUpdateCode();
                }}
                className="w-full p-4 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-xs text-yellow-300 focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="flex justify-end pt-2">
        <button
          onClick={onNextPhase}
          className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 hover:scale-[1.02] transition-all"
        >
          <span>Finalisasi Brief Contract (Fase 3)</span>
        </button>
      </div>
    </div>
  );
};
