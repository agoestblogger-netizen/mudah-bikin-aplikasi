'use client';

import React, { useState } from 'react';

// Membaca env var yang di-inject Vercel saat build time (otomatis, tidak perlu hardcode).
// VERCEL_GIT_COMMIT_SHA  → full 40-char SHA
// NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA → versi NEXT_PUBLIC agar bisa dibaca di client
// VERCEL_GIT_COMMIT_MESSAGE → opsional (tidak dipakai di badge tapi tersedia)
const COMMIT_SHA = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || '';
const BUILD_TIME = process.env.NEXT_PUBLIC_BUILD_TIME || '';

function formatBuildTime(isoStr: string): string {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    // Format singkat: "17 Ags 20:03"
    return d.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta'
    });
  } catch {
    return isoStr.slice(0, 10);
  }
}

export function BuildBadge() {
  const [showTooltip, setShowTooltip] = useState(false);

  const shortSha = COMMIT_SHA ? COMMIT_SHA.slice(0, 7) : 'dev';
  const buildLabel = BUILD_TIME ? formatBuildTime(BUILD_TIME) : 'local';
  const hasInfo = COMMIT_SHA || BUILD_TIME;

  return (
    <div className="fixed bottom-3 right-3 z-50 select-none">
      <button
        className="group relative text-[10px] font-mono text-slate-600 hover:text-slate-400 transition-colors cursor-default"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => setShowTooltip(v => !v)}
        aria-label="Build info"
        type="button"
      >
        {/* Badge utama — sangat kecil dan muted */}
        <span className="opacity-40 hover:opacity-70 transition-opacity">
          {shortSha}
          {buildLabel ? ` · ${buildLabel}` : ''}
        </span>

        {/* Tooltip saat hover */}
        {showTooltip && hasInfo && (
          <div className="absolute bottom-full right-0 mb-1.5 min-w-[200px] bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-left shadow-xl shadow-black/40 pointer-events-none">
            <p className="text-slate-300 text-[11px] font-semibold mb-1">Build Info</p>
            {COMMIT_SHA && (
              <p className="text-slate-400 text-[10px] font-mono break-all">
                <span className="text-slate-500">SHA: </span>{COMMIT_SHA}
              </p>
            )}
            {BUILD_TIME && (
              <p className="text-slate-400 text-[10px] mt-0.5">
                <span className="text-slate-500">Built: </span>{formatBuildTime(BUILD_TIME)}
              </p>
            )}
          </div>
        )}
      </button>
    </div>
  );
}
