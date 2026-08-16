'use client';

import React, { useState } from 'react';
import { AppProjectState, PRDStage } from '@/types/app';
import { initialProjectState } from '@/lib/defaultState';
import { Navbar } from '@/components/Navbar';
import { Stage1InterviewAI } from '@/components/Stage1InterviewAI';
import { Stage2MockupCanvas } from '@/components/Stage2MockupCanvas';
import { Stage3BriefLock } from '@/components/Stage3BriefLock';
import { Stage4GASBackend } from '@/components/Stage4GASBackend';
import { Stage5FeaturePatch } from '@/components/Stage5FeaturePatch';
import { Stage6Troubleshooter } from '@/components/Stage6Troubleshooter';
import { Eye, Code2, Download, RefreshCw, Sparkles, Layers } from 'lucide-react';

export default function AppWorkspacePage() {
  const [projectState, setProjectState] = useState<AppProjectState>(initialProjectState);
  const [rightPanelTab, setRightPanelTab] = useState<'PREVIEW' | 'GAS_SCRIPT'>('PREVIEW');
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const handleUpdateState = (updated: Partial<AppProjectState>) => {
    setProjectState((prev) => ({
      ...prev,
      ...updated,
      updatedAt: new Date().toISOString()
    }));
  };

  const handleSelectStage = (stage: PRDStage) => {
    setProjectState((prev) => ({
      ...prev,
      currentStage: stage
    }));
  };

  // PRD Bagian 9: Download index.html mandiri untuk deploy ke Cloudflare Pages
  const handleDownloadIndexHtml = () => {
    const fullHtml = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${projectState.title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    ${projectState.canvasCode.css}
  </style>
</head>
<body>
  ${projectState.canvasCode.html}
  <script>
    ${projectState.canvasCode.js}
  </script>
</body>
</html>`;

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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white flex flex-col">
      {/* Top Navbar */}
      <Navbar
        currentStage={projectState.currentStage}
        onSelectStage={handleSelectStage}
        projectTitle={projectState.title}
        auditScore={projectState.qualityAudit.totalScore}
      />

      {/* Main 2-Panel Workspace (PRD Bagian 9) */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT PANEL (7 Cols): Chat History & 6 PRD Stage Controls */}
        <div className="lg:col-span-7 flex flex-col space-y-4">
          {projectState.currentStage === 'TAHAP_1_PEMBUKAAN' && (
            <Stage1InterviewAI
              projectState={projectState}
              onUpdateState={handleUpdateState}
              onNextStage={() => handleSelectStage('TAHAP_2_MOCKUP')}
            />
          )}

          {projectState.currentStage === 'TAHAP_2_MOCKUP' && (
            <Stage2MockupCanvas
              projectState={projectState}
              onUpdateState={handleUpdateState}
              onNextStage={() => handleSelectStage('TAHAP_3_KUNCI_KEBUTUHAN')}
            />
          )}

          {projectState.currentStage === 'TAHAP_3_KUNCI_KEBUTUHAN' && (
            <Stage3BriefLock
              projectState={projectState}
              onNextStage={() => handleSelectStage('TAHAP_4_BACKEND')}
            />
          )}

          {projectState.currentStage === 'TAHAP_4_BACKEND' && (
            <Stage4GASBackend
              projectState={projectState}
              onUpdateState={handleUpdateState}
              onNextStage={() => handleSelectStage('TAHAP_5_PATCH')}
            />
          )}

          {projectState.currentStage === 'TAHAP_5_PATCH' && (
            <Stage5FeaturePatch
              projectState={projectState}
              onUpdateState={handleUpdateState}
              onNextStage={() => handleSelectStage('TAHAP_6_TROUBLESHOOTING')}
            />
          )}

          {projectState.currentStage === 'TAHAP_6_TROUBLESHOOTING' && (
            <Stage6Troubleshooter projectState={projectState} />
          )}
        </div>

        {/* RIGHT PANEL (5 Cols): Live Preview Iframe + GAS Script + Download index.html */}
        <div className="lg:col-span-5 flex flex-col bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden backdrop-blur-xl sticky top-20 h-[calc(100vh-100px)]">
          {/* Header & Controls */}
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

            {/* Download index.html button (PRD Bagian 9) */}
            <button
              onClick={handleDownloadIndexHtml}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-90 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{downloaded ? 'Tersimpan!' : 'Download index.html'}</span>
            </button>
          </div>

          {/* Panel Content */}
          <div className="flex-1 overflow-hidden p-4 relative">
            {isGenerating && (
              <div className="absolute inset-0 z-20 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center gap-3 text-indigo-300 text-xs font-semibold">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>AI Sedang Memproses & Melakukan Anti-Cutoff...</span>
              </div>
            )}

            {rightPanelTab === 'PREVIEW' ? (
              <div className="w-full h-full bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-inner">
                <iframe
                  title="Live Preview Canvas"
                  srcDoc={`<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"/><link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet"><style>${projectState.canvasCode.css}</style></head><body>${projectState.canvasCode.html}<script>${projectState.canvasCode.js}</script></body></html>`}
                  className="w-full h-full border-none"
                  sandbox="allow-scripts allow-forms allow-modals"
                />
              </div>
            ) : (
              <div className="w-full h-full flex flex-col space-y-2">
                <span className="text-[11px] font-mono text-slate-400">code.gs (Google Apps Script)</span>
                <textarea
                  rows={20}
                  readOnly
                  value={projectState.gasConfig.scriptCode}
                  className="w-full flex-1 p-4 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-xs text-emerald-300 focus:outline-none"
                />
              </div>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}
