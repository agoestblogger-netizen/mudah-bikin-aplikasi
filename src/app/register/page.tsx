'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Sparkles, Lock, Mail, ArrowRight, UserPlus, AlertTriangle, CheckCircle2, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { GoogleOAuthButton, OAuthDivider } from '@/components/GoogleOAuthButton';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const redirectUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/auth/callback?next=/app`
        : 'https://mudah-bikin-aplikasi.vercel.app/auth/callback?next=/app';

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl
        }
      });

      if (error) {
        setErrorMsg(`Gagal Mendaftar: ${error.message}`);
        return;
      }

      if (data.user) {
        setIsSubmitted(true);
      } else {
        setErrorMsg('Gagal mendaftarkan akun. Silakan coba beberapa saat lagi.');
      }
    } catch (err: any) {
      setErrorMsg('Terjadi kendala saat menghubungkan ke server. Silakan periksa koneksi internet Anda dan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!email || resending) return;
    setResending(true);
    setResendStatus('');
    try {
      const redirectUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/auth/callback?next=/app`
        : 'https://mudah-bikin-aplikasi.vercel.app/auth/callback?next=/app';

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: redirectUrl
        }
      });

      if (error) {
        setResendStatus(`⚠️ Gagal mengirim ulang: ${error.message}`);
      } else {
        setResendStatus('✓ Link konfirmasi baru telah dikirimkan ke email Anda.');
      }
    } catch (err: any) {
      setResendStatus('⚠️ Terjadi kendala saat mengirim ulang. Silakan coba lagi nanti.');
    } finally {
      setResending(false);
    }
  };

  // State Tampilan Cek Email (Setelah Submit Registrasi)
  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 py-12 selection:bg-indigo-500 selection:text-white relative overflow-hidden font-sans">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-tr from-purple-600/15 via-pink-600/15 to-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-md space-y-6 bg-slate-900/90 border border-slate-800 p-8 rounded-3xl backdrop-blur-xl shadow-2xl relative z-10 text-center">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center mx-auto text-purple-400 shadow-lg shadow-purple-500/10">
            <Mail className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">Cek Email Anda</h1>
            <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
              Link konfirmasi telah dikirimkan ke:
            </p>
            <p className="text-xs font-semibold text-purple-300 bg-purple-950/60 border border-purple-800/60 py-1.5 px-3 rounded-xl break-all">
              {email}
            </p>
            <p className="text-xs text-slate-400 leading-relaxed pt-2">
              Silakan buka kotak masuk email Anda dan klik link konfirmasi untuk mengaktifkan akun sebelum masuk ke aplikasi.
            </p>
          </div>

          {resendStatus && (
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
              {resendStatus}
            </div>
          )}

          <div className="space-y-3 pt-2">
            <Link
              href="/login"
              className="w-full block py-3.5 px-6 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 hover:opacity-90 text-xs font-bold text-white transition-all shadow-lg shadow-purple-600/30 text-center"
            >
              Ke Halaman Masuk / Login
            </Link>

            <div>
              <button
                type="button"
                onClick={handleResendConfirmation}
                disabled={resending}
                className="text-xs text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {resending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Belum menerima email? <strong>Kirim Ulang Link</strong></span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 py-12 selection:bg-indigo-500 selection:text-white">
      <div className="w-full max-w-md space-y-8 bg-slate-900/80 border border-slate-800 p-8 rounded-3xl backdrop-blur-xl shadow-2xl">
        {/* Brand */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center mx-auto shadow-lg shadow-purple-500/20">
            <UserPlus className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white">Daftar Akun Baru</h2>
          <p className="text-xs text-slate-400">Buat akun baru untuk mulai membuat aplikasi web</p>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-800 text-xs text-rose-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Tombol Google OAuth (tersembunyi sampai NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED=true) */}
        <GoogleOAuthButton label="Daftar dengan Google" />
        <OAuthDivider />

        {/* Register Form Email/Password — TETAP ADA */}
        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">Email Pengguna</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">Password Baru</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                className="w-full pl-10 pr-11 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-indigo-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1 transition-colors focus:outline-none"
                title={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 hover:opacity-90 text-white font-bold text-xs shadow-lg shadow-purple-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span>{loading ? 'Mendaftarkan...' : 'Daftar & Buat Akun'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="text-center pt-2 text-xs text-slate-400">
          Sudah punya akun?{' '}
          <Link href="/login" className="text-purple-400 font-semibold hover:underline">
            Masuk Sekarang
          </Link>
        </div>
      </div>
    </div>
  );
}
