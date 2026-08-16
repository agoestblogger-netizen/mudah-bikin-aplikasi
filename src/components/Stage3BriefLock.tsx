'use client';

import React, { useState } from 'react';
import { AppProjectState } from '@/types/app';
import { FileText, CheckSquare, ShieldCheck, Database, Download, CheckCircle2, ArrowRight } from 'lucide-react';

interface Stage3BriefLockProps {
  projectState: AppProjectState;
  onNextStage: () => void;
}

export const Stage3BriefLock: React.FC<Stage3BriefLockProps> = ({
  projectState,
  onNextStage
}) => {
  const [downloaded, setDownloaded] = useState(false);

  const generateMarkdownBrief = () => {
    return `# BRIEF KONTRAK KEBUTUHAN APLIKASI
**Proyek**: ${projectState.title}
**Tanggal Finalisasi**: ${new Date().toLocaleDateString('id-ID')}

---

## 1. CHECKLIST FITUR UTAMA
${projectState.featureChecklist.map((f) => `- [x] **[${f.category}]** ${f.title}: ${f.description}`).join('\n')}

---

## 2. HAK AKSES ROLE ADMIN & MANAJEMEN USER
${projectState.rolePermissions
  .map(
    (r) =>
      `- **Role ${r.roleName}**:
  - Scope Access: ${r.accessScope}
  - Fitur Tambah User: ${r.canAddUser ? '✅ TERKUNCI KHUSUS ADMIN' : '🔒 TIDAK MEMILIKI AKSES'}`
  )
  .join('\n')}

---

## 3. ATURAN VALIDASI INPUT & SKEMA DATA
${projectState.mandatorySpecs.basicValidationRules.map((v) => `- ${v}`).join('\n')}
`;
  };

  const handleDownloadBrief = () => {
    const content = generateMarkdownBrief();
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Brief_Kunci_Kebutuhan_${projectState.title.replace(/\s+/g, '_')}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 3000);
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 lg:p-8 backdrop-blur-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Tahap 3 PRD: Kunci Kebutuhan (Finalisasi Brief)</h2>
            <p className="text-xs text-slate-400">Konfirmasi final fitur utama, role admin (Tambah User terkunci), dan aturan validasi input.</p>
          </div>
        </div>

        <button
          onClick={handleDownloadBrief}
          className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-lg shadow-indigo-600/20"
        >
          <Download className="w-4 h-4" />
          <span>{downloaded ? 'Kontrak Tersimpan!' : 'Download Brief (.md)'}</span>
        </button>
      </div>

      {/* 3 Main Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Fitur Utama */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <CheckSquare className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-white text-base">Fitur Utama</h3>
          </div>
          <div className="space-y-3">
            {projectState.featureChecklist.map((f) => (
              <div key={f.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider">{f.category}</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <h4 className="text-xs font-semibold text-white">{f.title}</h4>
                <p className="text-[11px] text-slate-400">{f.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Role Admin & Hak Akses */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <ShieldCheck className="w-5 h-5 text-purple-400" />
            <h3 className="font-bold text-white text-base">Role Admin & Tambah User</h3>
          </div>
          <div className="space-y-3">
            {projectState.rolePermissions.map((r, i) => (
              <div key={i} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-300">Role {r.roleName}</span>
                  {r.canAddUser && (
                    <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-semibold">
                      Admin Locked
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300">{r.accessScope}</p>
                <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                  Fitur Tambah User: {r.canAddUser ? '✅ Terkunci Khusus Admin' : '🔒 Terkunci (Non-Admin)'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Validasi Karakter & Schema */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <Database className="w-5 h-5 text-pink-400" />
            <h3 className="font-bold text-white text-base">Validasi & Skema Data</h3>
          </div>
          <div className="space-y-2">
            <span className="text-xs text-slate-400 font-semibold block">Aturan Validasi Form:</span>
            {projectState.mandatorySpecs.basicValidationRules.map((val, idx) => (
              <div key={idx} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-pink-300">
                ✓ {val}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="flex justify-end pt-2">
        <button
          onClick={onNextStage}
          className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 hover:scale-[1.02] transition-all"
        >
          <span>Lanjut ke Tahap 4: Backend & Sambungkan (GAS)</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
