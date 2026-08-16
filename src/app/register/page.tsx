'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Sparkles, Lock, Mail, ArrowRight, UserPlus, AlertTriangle } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password
      });

      if (error) {
        setErrorMsg(`Gagal Mendaftar: ${error.message}`);
        return;
      }

      if (data.user) {
        setSuccessMsg('Registrasi berhasil! Silakan periksa email Anda atau masuk dengan akun baru.');
        setTimeout(() => router.push('/login'), 2000);
      } else {
        setErrorMsg('Gagal membuat user di database Supabase.');
      }
    } catch (err: any) {
      setErrorMsg(`Kendala Koneksi Database: ${err.message || 'Layanan Supabase Auth belum terhubung'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 py-12 selection:bg-indigo-500 selection:text-white">
      <div className="w-full max-w-md space-y-8 bg-slate-900/80 border border-slate-800 p-8 rounded-3xl backdrop-blur-xl shadow-2xl">
        {/* Brand */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center mx-auto shadow-lg shadow-purple-500/20">
            <UserPlus className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white">Daftar Akun Baru</h2>
          <p className="text-xs text-slate-400">Buat akun platform Mudah Bikin Aplikasi (Supabase Auth)</p>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-800 text-xs text-rose-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-300 text-center">
            {successMsg}
          </div>
        )}

        {/* Register Form */}
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
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-indigo-500 focus:outline-none"
              />
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
