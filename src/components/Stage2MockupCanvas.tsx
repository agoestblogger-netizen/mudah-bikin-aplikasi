'use client';

import React, { useState } from 'react';
import { AppProjectState } from '@/types/app';
import { Palette, Code2, Eye, Copy, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface Stage2MockupCanvasProps {
  projectState: AppProjectState;
  onUpdateState: (updated: Partial<AppProjectState>) => void;
  onNextStage: () => void;
}

export const Stage2MockupCanvas: React.FC<Stage2MockupCanvasProps> = ({
  projectState,
  onUpdateState,
  onNextStage
}) => {
  const [activeTab, setActiveTab] = useState<'PREVIEW' | 'HTML' | 'CSS' | 'JS'>('PREVIEW');
  const [htmlCode, setHtmlCode] = useState(projectState.canvasCode.html);
  const [cssCode, setCssCode] = useState(projectState.canvasCode.css);
  const [jsCode, setJsCode] = useState(projectState.canvasCode.js);
  const [copied, setCopied] = useState(false);

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
            <h2 className="text-xl font-bold text-white">Tahap 2 PRD: Mockup & Preview Canvas</h2>
            <p className="text-xs text-slate-400">Visualisasi prototipe interaktif langsung dalam Canvas dengan State JS hidup.</p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-slate-950/80 border border-slate-800 px-4 py-2 rounded-2xl">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <div>
            <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Canvas Standard</span>
            <span className="text-xs font-semibold text-emerald-300">Dynamic State JS Active</span>
          </div>
        </div>
      </div>

      {/* Main Studio View */}
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

          <button
            onClick={copyFullCode}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-medium text-slate-300 hover:bg-slate-700"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{copied ? 'Tersalin!' : 'Salin Kode'}</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-6">
          {activeTab === 'PREVIEW' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Interactive Sandboxed Canvas Viewport</span>
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
            <textarea
              rows={20}
              value={htmlCode}
              onChange={(e) => {
                setHtmlCode(e.target.value);
                handleUpdateCode();
              }}
              className="w-full p-4 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-xs text-emerald-300 focus:outline-none focus:border-indigo-500"
            />
          )}

          {activeTab === 'CSS' && (
            <textarea
              rows={20}
              value={cssCode}
              onChange={(e) => {
                setCssCode(e.target.value);
                handleUpdateCode();
              }}
              className="w-full p-4 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-xs text-cyan-300 focus:outline-none focus:border-indigo-500"
            />
          )}

          {activeTab === 'JS' && (
            <textarea
              rows={20}
              value={jsCode}
              onChange={(e) => {
                setJsCode(e.target.value);
                handleUpdateCode();
              }}
              className="w-full p-4 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-xs text-yellow-300 focus:outline-none focus:border-indigo-500"
            />
          )}
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="flex justify-end pt-2">
        <button
          onClick={onNextStage}
          className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 hover:scale-[1.02] transition-all"
        >
          <span>Lanjut ke Tahap 3: Kunci Kebutuhan & Admin Lock</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
