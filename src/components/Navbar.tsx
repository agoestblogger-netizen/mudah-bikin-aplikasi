'use client';

import React from 'react';
import { AppPhase } from '@/types/app';
import { Sparkles, MessageSquareCode, Palette, FileText, Database, Rocket, ShieldCheck } from 'lucide-react';

interface NavbarProps {
  currentPhase: AppPhase;
  onSelectPhase: (phase: AppPhase) => void;
  projectTitle: string;
  auditScore: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentPhase,
  onSelectPhase,
  projectTitle,
  auditScore
}) => {
  const phases: { id: AppPhase; label: string; icon: React.ReactNode }[] = [
    { id: 'FASE_0_WELCOME', label: 'FASE 0: Overview', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'FASE_1_INTERVIEW', label: 'FASE 1: Wawancara & DNA', icon: <MessageSquareCode className="w-4 h-4" /> },
    { id: 'FASE_2_CANVAS', label: 'FASE 2: Canvas Studio', icon: <Palette className="w-4 h-4" /> },
    { id: 'FASE_3_BRIEF', label: 'FASE 3: Brief Contract', icon: <FileText className="w-4 h-4" /> },
    { id: 'FASE_4_GAS_BACKEND', label: 'FASE 4: GAS Backend', icon: <Database className="w-4 h-4" /> },
    { id: 'FASE_5_DEPLOY', label: 'FASE 5: Deploy & Audit', icon: <Rocket className="w-4 h-4" /> }
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
                Mudah Bikin Aplikasi <span className="text-xs font-normal text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full ml-1">Gem AI</span>
              </h1>
              <p className="text-xs text-slate-400 truncate max-w-[200px]">{projectTitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700/60 px-3 py-1.5 rounded-full text-xs font-medium text-slate-300">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Audit: <strong className="text-emerald-400 font-semibold">{auditScore}%</strong></span>
          </div>
        </div>

        {/* Phase Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-slate-950/60 p-1.5 rounded-2xl border border-slate-800 overflow-x-auto max-w-full no-scrollbar">
          {phases.map((p) => {
            const isActive = currentPhase === p.id;
            return (
              <button
                key={p.id}
                onClick={() => onSelectPhase(p.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 whitespace-nowrap ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                {p.icon}
                <span>{p.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
