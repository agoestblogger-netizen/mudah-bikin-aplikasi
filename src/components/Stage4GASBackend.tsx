'use client';

import React, { useState } from 'react';
import { AppProjectState } from '@/types/app';
import { Database, Code2, Copy, CheckCircle2, ExternalLink, ArrowRight } from 'lucide-react';

interface Stage4GASBackendProps {
  projectState: AppProjectState;
  onUpdateState: (updated: Partial<AppProjectState>) => void;
  onNextStage: () => void;
}

export const Stage4GASBackend: React.FC<Stage4GASBackendProps> = ({
  projectState,
  onUpdateState,
  onNextStage
}) => {
  const [webAppUrl, setWebAppUrl] = useState(projectState.gasConfig.webAppUrl);
  const [copied, setCopied] = useState(false);

  const scriptCode = projectState.gasConfig.scriptCode;

  const handleCopyScript = () => {
    navigator.clipboard.writeText(scriptCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveGAS = () => {
    onUpdateState({
      gasConfig: {
        ...projectState.gasConfig,
        webAppUrl,
        isConnected: webAppUrl.trim().length > 0
      }
    });
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 lg:p-8 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Tahap 4 PRD: Backend & Sambungkan (Google Apps Script)</h2>
            <p className="text-xs text-slate-400">Hubungkan prototipe Canvas dengan database Google Sheets via backend Google Apps Script teruji.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Code GS Editor */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-emerald-400" />
              <h3 className="font-bold text-white text-sm">1. Kode Apps Script (code.gs)</h3>
            </div>
            <button
              onClick={handleCopyScript}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all shadow-md shadow-emerald-600/20"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copied ? 'Kode Tersalin!' : 'Salin Kode GAS'}</span>
            </button>
          </div>

          <textarea
            rows={16}
            readOnly
            value={scriptCode}
            className="w-full p-4 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-xs text-emerald-300 focus:outline-none"
          />
        </div>

        {/* Setup & Connection */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-6">
          <div className="space-y-3">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Database className="w-4 h-4 text-purple-400" />
              2. Kolom Header Google Sheets
            </h3>
            <div className="flex flex-wrap gap-2 p-3 bg-slate-950 border border-slate-800 rounded-2xl font-mono text-xs text-purple-300">
              {projectState.dataColumns.map((col, idx) => (
                <span key={idx} className="bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg">
                  {col.columnName}
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-800">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-indigo-400" />
              3. Web App Deployment URL
            </h3>

            <input
              type="text"
              value={webAppUrl}
              onChange={(e) => setWebAppUrl(e.target.value)}
              onBlur={handleSaveGAS}
              placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono focus:border-emerald-500 focus:outline-none"
            />

            <div className="flex items-center gap-2 text-xs">
              <CheckCircle2 className={`w-4 h-4 ${webAppUrl ? 'text-emerald-400' : 'text-slate-600'}`} />
              <span className={webAppUrl ? 'text-emerald-300' : 'text-slate-500'}>
                {webAppUrl ? 'GAS Web App URL Terkonfirmasi Terhubung' : 'Masukkan Web App URL di atas'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="flex justify-end pt-2">
        <button
          onClick={() => {
            handleSaveGAS();
            onNextStage();
          }}
          className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 hover:scale-[1.02] transition-all"
        >
          <span>Lanjut ke Tahap 5: Pembaruan Fitur (Patch)</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
