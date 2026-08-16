'use client';

import React from 'react';
import { PRDStage } from '@/types/app';
import { Sparkles, Bot, Palette, FileText, Database, Wrench, ShieldAlert, ShieldCheck } from 'lucide-react';

interface NavbarProps {
  currentStage: PRDStage;
  onSelectStage: (stage: PRDStage) => void;
  projectTitle: string;
  auditScore: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentStage,
  onSelectStage,
  projectTitle,
  auditScore
}) => {
  const stages: { id: PRDStage; label: string; icon: React.ReactNode }[] = [
    { id: 'TAHAP_1_PEMBUKAAN', label: 'Tahap 1: Wawancara AI', icon: <Bot className="w-4 h-4" /> },
    { id: 'TAHAP_2_MOCKUP', label: 'Tahap 2: Mockup Canvas', icon: <Palette className="w-4 h-4" /> },
    { id: 'TAHAP_3_KUNCI_KEBUTUHAN', label: 'Tahap 3: Kunci Kebutuhan', icon: <FileText className="w-4 h-4" /> },
    { id: 'TAHAP_4_BACKEND', label: 'Tahap 4: Backend GAS', icon: <Database className="w-4 h-4" /> },
    { id: 'TAHAP_5_PATCH', label: 'Tahap 5: Pembaruan Fitur', icon: <Wrench className="w-4 h-4" /> },
    { id: 'TAHAP_6_TROUBLESHOOTING', label: 'Tahap 6: Kendala & Solusi', icon: <ShieldAlert className="w-4 h-4" /> }
  ];

  return (
    <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800 px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand & Project Info */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <h1 className="font-bold text-white text-base leading-tight tracking-tight">
                Mudah Bikin Aplikasi <span className="text-xs font-normal text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full ml-1">PRD 6 Tahap</span>
              </h1>
              <p className="text-xs text-slate-400 truncate max-w-[200px]">{projectTitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700/60 px-3 py-1.5 rounded-full text-xs font-medium text-slate-300">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Audit: <strong className="text-emerald-400 font-semibold">{auditScore}%</strong></span>
          </div>
        </div>

        {/* 6 Official PRD Stage Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-slate-950/60 p-1.5 rounded-2xl border border-slate-800 overflow-x-auto max-w-full no-scrollbar">
          {stages.map((s) => {
            const isActive = currentStage === s.id;
            return (
              <button
                key={s.id}
                onClick={() => onSelectStage(s.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 whitespace-nowrap ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                {s.icon}
                <span>{s.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
