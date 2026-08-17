'use client';

import React from 'react';
import { Sparkles, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface NavbarProps {
  userEmail?: string;
  onNewSession?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ userEmail, onNewSession }) => {
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

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
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-all border border-slate-700"
            >
              + Buat Proyek Baru
            </button>
          )}

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold border border-rose-500/20 transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar</span>
          </button>

          {/* Avatar/Icon di sebelah kanan tombol Keluar (tanpa teks email) */}
          <div
            title={userEmail || 'Akun Pengguna'}
            className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-600 p-[1.5px] flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0 cursor-default"
          >
            <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center text-xs font-bold text-white">
              {initial}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
