'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  Plus, 
  FolderOpen, 
  PanelLeftClose, 
  PanelLeftOpen, 
  Bot, 
  LogOut, 
  Settings, 
  Sparkles 
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { ModelSettingsMenu } from './ModelSettingsMenu';
import { 
  loadModelSettings, 
  saveModelSettings, 
  getModelLabel, 
  getProviderConfig 
} from '@/lib/modelConfig';
import type { ModelSettings } from '@/lib/modelConfig';

interface AppSidebarProps {
  userEmail?: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onNewProject: () => void;
  onOpenSavedProjects: () => void;
  savedProjectsCount?: number;
  modelSettings?: ModelSettings;
  onModelSettingsChange?: (settings: ModelSettings) => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  userEmail,
  isCollapsed,
  onToggleCollapse,
  onNewProject,
  onOpenSavedProjects,
  savedProjectsCount = 0,
  modelSettings,
  onModelSettingsChange,
}) => {
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const [localSettings, setLocalSettings] = useState<ModelSettings>(() =>
    modelSettings || loadModelSettings()
  );

  const activeSettings = modelSettings || localSettings;
  const hasKey = Boolean(activeSettings.token);
  const activeProviderName = hasKey ? getProviderConfig(activeSettings.provider).label : 'Gemini';

  const handleLogout = async () => {
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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const initial = userEmail ? userEmail.charAt(0).toUpperCase() : 'U';

  return (
    <aside 
      className={`relative flex flex-col bg-[#0b0b0f] border-r border-white/10 transition-all duration-300 ease-in-out shrink-0 select-none z-30 ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Top Header: Profile / Brand & Toggle */}
      <div className="h-16 px-3.5 flex items-center justify-between border-b border-white/10">
        {!isCollapsed ? (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-orange-500 to-amber-500 p-[1.5px] shrink-0">
              <div className="w-full h-full rounded-full bg-[#121217] flex items-center justify-center text-xs font-bold text-white">
                {initial}
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate" title={userEmail}>
                {userEmail ? userEmail.split('@')[0] : 'Workspace'}
              </p>
              <p className="text-[10px] text-zinc-500 truncate" title={userEmail}>
                {userEmail || 'Free Plan'}
              </p>
            </div>
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-orange-500 to-amber-500 p-[1.5px] mx-auto shrink-0">
            <div className="w-full h-full rounded-full bg-[#121217] flex items-center justify-center text-xs font-bold text-white">
              {initial}
            </div>
          </div>
        )}

        {/* Collapse / Expand Toggle Button */}
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors shrink-0"
          title={isCollapsed ? 'Perluas Sidebar' : 'Ciutkan Sidebar'}
          aria-label={isCollapsed ? 'Perluas Sidebar' : 'Ciutkan Sidebar'}
        >
          {isCollapsed ? (
            <PanelLeftOpen className="w-4 h-4" />
          ) : (
            <PanelLeftClose className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Main Actions & Nav */}
      <div className="p-3 flex-1 flex flex-col gap-2 overflow-y-auto">
        {/* + Buat Proyek Baru Button */}
        <button
          onClick={onNewProject}
          className={`w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold shadow-lg shadow-orange-500/20 active:scale-[0.98] transition-all ${
            isCollapsed ? 'p-2.5 h-10' : 'px-4 py-2.5 text-xs'
          }`}
          title="Buat Proyek Baru"
        >
          <Plus className="w-4 h-4 shrink-0 stroke-[2.5]" />
          {!isCollapsed && <span>Buat Proyek Baru</span>}
        </button>

        {/* Proyek Tersimpan Button */}
        <button
          onClick={onOpenSavedProjects}
          className={`w-full flex items-center rounded-xl border border-white/5 hover:border-white/10 hover:bg-white/5 text-zinc-300 hover:text-white transition-all ${
            isCollapsed ? 'justify-center p-2.5 h-10' : 'justify-between px-3 py-2 text-xs font-medium'
          }`}
          title="Buka Proyek Tersimpan"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <FolderOpen className="w-4 h-4 text-orange-400 shrink-0" />
            {!isCollapsed && <span className="truncate">Proyek Tersimpan</span>}
          </div>
          {!isCollapsed && savedProjectsCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-md bg-white/10 text-[10px] font-mono text-zinc-400">
              {savedProjectsCount}
            </span>
          )}
        </button>
      </div>

      {/* Footer: AI Settings & Logout */}
      <div className="p-3 border-t border-white/10 flex flex-col gap-1 relative" ref={settingsRef}>
        {/* Model Settings Trigger */}
        <div className="relative">
          <button
            onClick={() => setSettingsOpen(prev => !prev)}
            className={`w-full flex items-center rounded-xl border border-transparent hover:border-white/5 hover:bg-white/5 text-zinc-400 hover:text-white transition-all ${
              isCollapsed ? 'justify-center p-2.5 h-10' : 'gap-2.5 px-3 py-2 text-xs font-medium'
            }`}
            title={`AI Model: ${hasKey ? activeProviderName : 'Gemini Default'}`}
          >
            <Settings className="w-4 h-4 text-zinc-400 shrink-0" />
            {!isCollapsed && (
              <div className="min-w-0 text-left flex-1">
                <span className="block truncate">AI Model</span>
                <span className="block text-[10px] text-zinc-500 truncate">
                  {hasKey ? `${activeProviderName}` : 'Gemini'}
                </span>
              </div>
            )}
            {!isCollapsed && hasKey && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
            )}
          </button>

          {/* Model Settings Popover (Upward) */}
          {settingsOpen && (
            <div className={`absolute bottom-full mb-2 z-50 w-80 rounded-2xl bg-[#121217] border border-white/10 shadow-2xl backdrop-blur-xl p-3 max-h-[75vh] overflow-y-auto ${
              isCollapsed ? 'left-14' : 'left-0'
            }`}>
              <div className="flex items-center gap-2 pb-2 mb-2 border-b border-white/10">
                <Bot className="w-4 h-4 text-orange-400" />
                <span className="text-xs font-bold text-white">Konfigurasi Model AI</span>
              </div>
              <ModelSettingsMenu
                provider={activeSettings.provider}
                token={activeSettings.token}
                model={activeSettings.model}
                onSave={(newSet) => {
                  handleSaveSettings(newSet);
                }}
              />
            </div>
          )}
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className={`w-full flex items-center rounded-xl border border-transparent hover:bg-rose-500/10 text-zinc-400 hover:text-rose-400 transition-all ${
            isCollapsed ? 'justify-center p-2.5 h-10' : 'gap-2.5 px-3 py-2 text-xs font-medium'
          }`}
          title="Keluar / Logout"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span>Keluar</span>}
        </button>
      </div>
    </aside>
  );
};
