'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, LogOut, Bot } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { ModelSettingsMenu } from './ModelSettingsMenu';
import {
  loadModelSettings,
  saveModelSettings,
  getModelLabel,
  getProviderConfig,
} from '@/lib/modelConfig';
import type { ModelSettings } from '@/lib/modelConfig';

interface NavbarProps {
  userEmail?: string;
  onNewSession?: () => void;
  modelSettings?: ModelSettings;
  onModelSettingsChange?: (settings: ModelSettings) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ userEmail, onNewSession, modelSettings, onModelSettingsChange }) => {
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [localSettings, setLocalSettings] = useState<ModelSettings>(() =>
    modelSettings || loadModelSettings()
  );

  const activeSettings = modelSettings || localSettings;
  const hasKey = Boolean(activeSettings.token);
  const activeProviderName = hasKey ? getProviderConfig(activeSettings.provider).label : 'Gemini';

  const handleLogout = async () => {
    setDropdownOpen(false);
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleSaveSettings = (settings: ModelSettings) => {
    setLocalSettings(settings);
    if (onModelSettingsChange) {
      onModelSettingsChange(settings);
    } else {
      saveModelSettings(settings);
    }
  };

  // Tutup dropdown jika klik di luar area
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const initial = userEmail ? userEmail.charAt(0).toUpperCase() : 'U';

  return (
    <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800 px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-white text-base leading-tight tracking-tight">
              Mudah Bikin Aplikasi
            </h1>
            <p className="text-[11px] text-slate-400">AI Web App Generator</p>
          </div>
        </div>

        {/* User Controls */}
        <div className="flex items-center gap-3">
          {onNewSession && (
            <button
              onClick={onNewSession}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-all border border-slate-700"
            >
              + Buat Proyek Baru
            </button>
          )}

          {/* Avatar Dropdown Menu */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen((prev) => !prev)}
              title={userEmail || 'Akun Pengguna'}
              aria-expanded={dropdownOpen}
              className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-600 p-[2px] flex items-center justify-center shadow-md shadow-indigo-600/20 hover:scale-105 active:scale-95 transition-transform cursor-pointer focus:outline-none"
            >
              <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center text-xs font-bold text-white hover:bg-slate-800 transition-colors">
                {initial}
              </div>
            </button>

            {/* Dropdown Content */}
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-slate-900/95 border border-slate-800 shadow-2xl backdrop-blur-2xl py-2 z-50 animate-fadeIn max-h-[80vh] overflow-y-auto scrollbar-thin">
                {/* User Info Header */}
                <div className="px-4 py-3 border-b border-slate-800/80">
                  <p className="text-[11px] font-medium text-slate-400">Masuk sebagai</p>
                  <p className="text-xs font-semibold text-white truncate pt-0.5" title={userEmail}>
                    {userEmail || 'Pengguna'}
                  </p>
                </div>

                {/* Model Badge Di Atas */}
                <div className="px-4 py-2 border-b border-slate-800/80 flex items-center gap-2">
                  <Bot className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide font-bold">AI Model</p>
                    <p className="text-[11px] text-slate-200 truncate font-medium">
                      {hasKey ? (
                        <>{activeProviderName} · {getModelLabel(activeSettings.model, activeSettings.provider)}</>
                      ) : (
                        <>Server Default · Gemini</>
                      )}
                    </p>
                  </div>
                  {hasKey && (
                    <span className="ml-auto shrink-0 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  )}
                </div>

                {/* Model Settings */}
                <ModelSettingsMenu
                  provider={activeSettings.provider}
                  token={activeSettings.token}
                  model={activeSettings.model}
                  onSave={handleSaveSettings}
                />

                {/* Logout Option */}
                <div className="p-1.5 border-t border-slate-800/80 mt-1">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-all text-left"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Keluar</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
