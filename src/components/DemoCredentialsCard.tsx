'use client';

import React, { useState } from 'react';
import { Key, Copy, Check, Shield, User, Sparkles } from 'lucide-react';

export interface DemoAccountItem {
  role: string;
  username: string;
  password: string;
  access?: string;
  isPublic?: boolean;
}

export interface ParsedDemoCredentials {
  cleanText: string;
  accounts: DemoAccountItem[];
  publicRoleNote?: string;
}

/**
 * Parser untuk mengekstrak kredensial demo dari teks chat AI (tabel markdown atau bullet points)
 */
export function parseDemoCredentials(text: string): ParsedDemoCredentials | null {
  if (!text || typeof text !== 'string') return null;

  const accounts: DemoAccountItem[] = [];
  let publicRoleNote: string | undefined;

  // Cek apakah ada penanda bagian kredensial/akun demo
  const hasCredsMarker =
    /🔑\s*(?:\*\*)?(?:Akun Demo|Petunjuk Akses|Kredensial Login)/i.test(text) ||
    /\|\s*Peran\s*(?:\(Role\))?\s*\|\s*Username\s*\|\s*Password\s*\|/i.test(text) ||
    (text.includes('✨ **Prototipe') && text.includes('username') && text.includes('password'));

  if (!hasCredsMarker) return null;

  // Ekstrak catatan peran publik jika ada
  const publicNoteMatch = text.match(/>\s*ℹ️\s*([^\n]+)/i);
  if (publicNoteMatch) {
    publicRoleNote = publicNoteMatch[1].replace(/^[>\s*]+|[*\s]+$/g, '').replace(/\*\*/g, '').trim();
  }

  // 1. Coba parse format Tabel Markdown
  const tableRowRegex = /\|\s*(?:\*\*)?([^\n\|]+?)(?:\*\*)?\s*\|\s*`?([^\n\|`]+?)`?\s*\|\s*`?([^\n\|`]+?)`?\s*\|\s*([^\n\|]+?)\s*\|/g;
  let match: RegExpExecArray | null;
  while ((match = tableRowRegex.exec(text)) !== null) {
    const rawRole = match[1].replace(/\*\*/g, '').trim();
    const rawUser = match[2].trim();
    const rawPass = match[3].trim();
    const rawAccess = match[4].trim();

    // Skip header dan baris pemisah
    if (/^(?:Peran|Role|---|:---)/i.test(rawRole) || /^(?:Username|---|:---)/i.test(rawUser)) {
      continue;
    }

    const isPublic = /tanpa login/i.test(rawUser) || /tanpa login/i.test(rawPass) || /akses publik/i.test(rawAccess);

    accounts.push({
      role: rawRole,
      username: isPublic ? '(Tanpa Login)' : rawUser,
      password: isPublic ? '(Tanpa Login)' : rawPass,
      access: rawAccess,
      isPublic
    });
  }

  // 2. Jika tabel tidak ditemukan, coba parse bullet points
  if (accounts.length === 0) {
    const bulletRegex = /[•\*\-]\s*(?:\*\*)?([^\n:\*]+)(?:\*\*)?\s*:\s*username\s*`?([a-zA-Z0-9_-]+)`?\s*\/\s*password\s*`?([^\s`]+)`?/gi;
    let bm: RegExpExecArray | null;
    while ((bm = bulletRegex.exec(text)) !== null) {
      accounts.push({
        role: bm[1].trim(),
        username: bm[2].trim(),
        password: bm[3].trim(),
        access: 'Akses Operasional',
        isPublic: false
      });
    }
  }

  if (accounts.length === 0) return null;

  // Hapus blok kredensial dari teks pesan utama agar tidak dobel render
  const splitIndex = text.search(/🔑\s*(?:\*\*)?(?:Akun Demo|Petunjuk Akses|Kredensial Login)/i);
  let cleanText = text;
  if (splitIndex !== -1) {
    cleanText = text.substring(0, splitIndex).trim();
  } else {
    const tableIndex = text.search(/\|\s*Peran/i);
    if (tableIndex !== -1) {
      cleanText = text.substring(0, tableIndex).trim();
    }
  }

  return { cleanText, accounts, publicRoleNote };
}

interface DemoCredentialsCardProps {
  data: ParsedDemoCredentials;
}

export function DemoCredentialsCard({ data }: DemoCredentialsCardProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (textToCopy: string, key: string) => {
    navigator.clipboard.writeText(textToCopy);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey(null);
    }, 2000);
  };

  const handleCopyAll = () => {
    const summary = data.accounts
      .map((acc) =>
        acc.isPublic
          ? `• ${acc.role}: Akses Publik (Tanpa Login)`
          : `• ${acc.role}: Username: ${acc.username} | Password: ${acc.password} (${acc.access || 'Akses'})`
      )
      .join('\n');
    navigator.clipboard.writeText(summary);
    setCopiedKey('all');
    setTimeout(() => {
      setCopiedKey(null);
    }, 2000);
  };

  return (
    <div className="mt-3 rounded-2xl bg-gradient-to-b from-[#161622] to-[#0f0f16] border border-emerald-500/25 shadow-xl shadow-black/40 overflow-hidden text-zinc-100">
      {/* Header Card */}
      <div className="p-3.5 px-4 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-[#10f48e]">
            <Key className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>Akun Demo & Kredensial Login</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#10f48e]/20 text-[#10f48e] border border-[#10f48e]/30 font-medium">
                Siap Dicoba
              </span>
            </h4>
            <p className="text-[11px] text-zinc-400">
              Gunakan akun di bawah ini untuk mencoba hak akses masing-masing peran pada Canvas Preview.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCopyAll}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-500/30 text-[11px] font-medium text-zinc-300 hover:text-white transition-all cursor-pointer"
          title="Salin Semua Akun Demo"
        >
          {copiedKey === 'all' ? (
            <>
              <Check className="w-3 h-3 text-[#10f48e]" />
              <span className="text-[#10f48e]">Tersalin!</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Salin Semua</span>
            </>
          )}
        </button>
      </div>

      {/* Public Role Note */}
      {data.publicRoleNote && (
        <div className="p-2.5 px-4 bg-blue-500/10 border-b border-blue-500/20 text-[11px] text-blue-200 flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span>{data.publicRoleNote}</span>
        </div>
      )}

      {/* Table / List of Accounts */}
      <div className="p-3 space-y-2">
        {data.accounts.map((acc, index) => {
          const isUserCopied = copiedKey === `u-${index}`;
          const isPassCopied = copiedKey === `p-${index}`;

          return (
            <div
              key={index}
              className={`p-2.5 rounded-xl border transition-all ${
                acc.isPublic
                  ? 'bg-blue-950/20 border-blue-500/20'
                  : index === 0
                  ? 'bg-emerald-950/20 border-emerald-500/25'
                  : 'bg-white/[0.02] border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                {/* Role Badge & Access */}
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${
                      acc.isPublic
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        : index === 0
                        ? 'bg-emerald-500/20 text-[#10f48e] border border-emerald-500/30'
                        : 'bg-white/10 text-zinc-300 border border-white/10'
                    }`}
                  >
                    {acc.isPublic ? <User className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                    <span>{acc.role}</span>
                  </span>
                  {acc.access && (
                    <span className="text-[10px] text-zinc-400 truncate max-w-[200px]">
                      {acc.access}
                    </span>
                  )}
                </div>

                {/* Credentials */}
                {acc.isPublic ? (
                  <span className="text-[11px] font-medium text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                    Akses Publik (Tanpa Login)
                  </span>
                ) : (
                  <div className="flex items-center gap-2">
                    {/* Username Box */}
                    <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-md px-2 py-1">
                      <span className="text-[10px] text-zinc-500">User:</span>
                      <code className="text-[11px] font-mono font-bold text-zinc-200">
                        {acc.username}
                      </code>
                      <button
                        type="button"
                        onClick={() => handleCopy(acc.username, `u-${index}`)}
                        className="ml-1 p-0.5 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                        title="Salin Username"
                      >
                        {isUserCopied ? (
                          <Check className="w-3 h-3 text-[#10f48e]" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>

                    {/* Password Box */}
                    <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-md px-2 py-1">
                      <span className="text-[10px] text-zinc-500">Pass:</span>
                      <code className="text-[11px] font-mono font-bold text-zinc-200">
                        {acc.password}
                      </code>
                      <button
                        type="button"
                        onClick={() => handleCopy(acc.password, `p-${index}`)}
                        className="ml-1 p-0.5 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                        title="Salin Kata Sandi"
                      >
                        {isPassCopied ? (
                          <Check className="w-3 h-3 text-[#10f48e]" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Tips */}
      <div className="p-2.5 px-4 bg-black/30 border-t border-white/5 flex items-center justify-between text-[10px] text-zinc-400">
        <span>💡 Tips: Klik tombol Quick Login di layar login aplikasi untuk masuk otomatis 1-klik.</span>
      </div>
    </div>
  );
}
