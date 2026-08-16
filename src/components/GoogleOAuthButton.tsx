'use client';

import React from 'react';
import { supabase } from '@/lib/supabase/client';

interface GoogleOAuthButtonProps {
  label?: string;
}

/**
 * Tombol "Masuk dengan Google" dengan feature flag bawaan.
 * TIDAK akan dirender jika NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED !== "true"
 * sehingga aman di-push ke production sebelum setup OAuth selesai.
 */
export const GoogleOAuthButton: React.FC<GoogleOAuthButtonProps> = ({
  label = 'Masuk dengan Google'
}) => {
  // FEATURE FLAG: Sembunyikan tombol jika env belum di-set "true"
  const isEnabled = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED === 'true';
  if (!isEnabled) return null;

  const handleGoogleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/app`
      }
    });

    if (error) {
      console.error('Google OAuth error:', error.message);
    }
  };

  return (
    <button
      onClick={handleGoogleSignIn}
      type="button"
      className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-white hover:bg-gray-50 text-gray-800 font-semibold text-xs border border-gray-200 shadow-sm transition-all hover:shadow-md"
    >
      {/* Google G Logo SVG (resmi, bukan dari library eksternal) */}
      <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
        <path fill="none" d="M0 0h48v48H0z"/>
      </svg>
      <span>{label}</span>
    </button>
  );
};

/**
 * Divider "atau" antar metode login — hanya tampil jika Google OAuth aktif.
 */
export const OAuthDivider: React.FC = () => {
  const isEnabled = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED === 'true';
  if (!isEnabled) return null;

  return (
    <div className="relative flex items-center gap-3 py-1">
      <div className="flex-1 h-px bg-slate-800" />
      <span className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">
        atau daftar dengan email
      </span>
      <div className="flex-1 h-px bg-slate-800" />
    </div>
  );
};
