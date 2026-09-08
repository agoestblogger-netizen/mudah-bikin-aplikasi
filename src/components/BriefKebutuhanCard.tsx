'use client';

import React, { useState } from 'react';
import {
  FileText,
  Copy,
  Check,
  Wrench,
  Sparkles,
  Users,
  Edit3,
  Save,
  X,
  Layers,
  CheckCircle2
} from 'lucide-react';

export interface PageSectionDetail {
  pageName: string;
  isDefault: boolean;
  sections: string[];
}

export interface RoleDetail {
  roleName: string;
  pages: PageSectionDetail[];
  alurProses?: string;
}

export interface ParsedBriefKebutuhan {
  introText?: string;
  appName: string;
  orientation?: string;
  visualTheme?: string;
  features: string[];
  roadmap: string[];
  usp?: string;
  roles: RoleDetail[];
  closingQuestion?: string;
  rawMarkdown: string;
}

/**
 * Parser untuk membedah teks Markdown Brief Kebutuhan menjadi objek terstruktur.
 * Mengembalikan null jika format tidak mencukupi untuk rendering kartu (otomatis fallback ke bubble standar).
 */
export function parseBriefKebutuhan(text: string): ParsedBriefKebutuhan | null {
  if (!text || typeof text !== 'string') return null;

  // Deteksi penanda awal Brief Kebutuhan
  const briefMarkerIndex = text.search(/📋\s*\*\*Brief Kebutuhan\*\*|\*\*Brief Kebutuhan\*\*/i);
  if (briefMarkerIndex === -1) return null;

  // Validasi minimal: harus ada Nama App atau Fitur Utama
  if (!/Nama App/i.test(text) && !/Fitur Utama/i.test(text)) return null;

  try {
    const introText = text.substring(0, briefMarkerIndex).trim();
    const briefContent = text.substring(briefMarkerIndex);

    // 1. Ekstrak Pertanyaan Konfirmasi Akhir (di luar kartu)
    let cardContent = briefContent;
    let closingQuestion = '';

    const closingMatch = briefContent.search(
      /\n\s*(Apakah\s+(?:lembar\s+)?Brief\s+Kebutuhan|Apakah\s+ada\s+detail|Silakan\s+konfirmasi|Jika\s+sudah\s+pas)/i
    );
    if (closingMatch !== -1) {
      cardContent = briefContent.substring(0, closingMatch).trim();
      closingQuestion = briefContent.substring(closingMatch).trim();
    }

    // 2. Ekstrak Nama App
    const appNameMatch = cardContent.match(/-\s*\*\*Nama App\*\*:\s*([^\n]+)/i);
    const appName = appNameMatch ? appNameMatch[1].trim() : 'Aplikasi Web';

    // 3. Ekstrak Orientasi UI
    const orientationMatch = cardContent.match(/-\s*\*\*Orientasi UI\*\*:\s*([^\n]+)/i);
    const orientation = orientationMatch ? orientationMatch[1].trim() : undefined;

    // 4. Ekstrak Tema Visual
    const visualThemeMatch = cardContent.match(/-\s*\*\*Tema Visual\*\*:\s*([^\n]+)/i);
    const visualTheme = visualThemeMatch ? visualThemeMatch[1].trim() : undefined;

    // 5. Ekstrak Fitur Utama (V1)
    const features: string[] = [];
    const featuresBlockMatch = cardContent.match(
      /-\s*\*\*Fitur Utama(?:\s*\(V1\))?\*\*:\s*\n([\s\S]*?)(?=\n-\s*\*\*|$)/i
    );
    if (featuresBlockMatch) {
      const lines = featuresBlockMatch[1].split('\n');
      for (const line of lines) {
        const cleaned = line.replace(/^\s*(?:\d+\.|\*|-)\s*/, '').trim();
        if (cleaned) features.push(cleaned);
      }
    }

    // 6. Ekstrak Roadmap Lanjutan (V2/V3)
    const roadmap: string[] = [];
    const roadmapBlockMatch = cardContent.match(
      /-\s*\*\*Roadmap Lanjutan(?:\s*\(V2\/V3\))?\*\*:\s*\n([\s\S]*?)(?=\n-\s*\*\*|$)/i
    );
    if (roadmapBlockMatch) {
      const lines = roadmapBlockMatch[1].split('\n');
      for (const line of lines) {
        const cleaned = line.replace(/^\s*(?:\d+\.|\*|-)\s*/, '').trim();
        if (cleaned) roadmap.push(cleaned);
      }
    }

    // 7. Ekstrak Fitur Unik (USP)
    const uspMatch = cardContent.match(/-\s*\*\*Fitur Unik(?:\s*\(USP\))?\*\*:\s*([^\n]+)/i);
    const usp = uspMatch ? uspMatch[1].trim() : undefined;

    // 8. Ekstrak Job Description & Struktur Halaman per Role
    const roles: RoleDetail[] = [];
    const rolesBlockMatch = cardContent.match(/-\s*\*\*Job Description[\s\S]*?\*\*:\s*\n([\s\S]*?)$/i);

    if (rolesBlockMatch) {
      const rawRolesText = rolesBlockMatch[1];
      const lines = rawRolesText.split('\n');
      let currentRole: RoleDetail | null = null;
      const forbiddenKeywords = ['alur proses', 'job description', 'struktur halaman', 'fitur utama', 'roadmap'];

      for (let i = 0; i < lines.length; i++) {
        const rawLine = lines[i];
        const trimmed = rawLine.trim();
        if (!trimmed) continue;

        // Deteksi baris role: * **RoleName**: atau * **[RoleName]**:
        const roleMatch = trimmed.match(/^\*\s+\*\*\[?([^\]:\*\n]+)\]?\*\*\s*:/);
        if (roleMatch) {
          let roleName = roleMatch[1].trim();
          roleName = roleName.replace(/^(?:Role|Peran)\s+/i, '').replace(/\s*\(.*?\)$/, '').trim();
          if (roleName && !forbiddenKeywords.some((k) => roleName.toLowerCase().startsWith(k))) {
            currentRole = {
              roleName,
              pages: []
            };
            roles.push(currentRole);
          }
          continue;
        }

        // Deteksi baris alur proses: - Alur Proses: ...
        if (currentRole && /^[-\*]\s*(?:\*\*)?Alur\s+Proses(?:\*\*)?\s*:/i.test(trimmed)) {
          const alurMatch = trimmed.match(/^[-\*]\s*(?:\*\*)?Alur\s+Proses(?:\*\*)?\s*:\s*(.*)/i);
          if (alurMatch && alurMatch[1].trim()) {
            currentRole.alurProses = alurMatch[1].trim();
          }
          continue;
        }

        // Deteksi baris halaman: - [Halaman 1] (default): section X, section Y
        if (currentRole && /^[-\*]\s*\[?[^\]]+\]?/.test(trimmed)) {
          const lineWithoutBullet = trimmed.replace(/^[-\*]\s*/, '').trim();
          const isDefault = /\(default\)/i.test(lineWithoutBullet);
          let pageName = '';
          const sectionList: string[] = [];

          const colonIdx = lineWithoutBullet.indexOf(':');
          if (colonIdx !== -1) {
            const pNamePart = lineWithoutBullet.substring(0, colonIdx).replace(/\(default\)/i, '');
            const sectionsPart = lineWithoutBullet.substring(colonIdx + 1);
            pageName = pNamePart.trim();

            if (sectionsPart) {
              const rawSecs = sectionsPart.split(/,\s*/);
              for (const s of rawSecs) {
                const sClean = s.replace(/^section\s+/i, '').trim();
                if (sClean) sectionList.push(sClean);
              }
            }
          } else {
            pageName = lineWithoutBullet.replace(/\(default\)/i, '').trim();
          }

          pageName = pageName.replace(/\(default\)/i, '').trim();

          if (pageName && !forbiddenKeywords.some((k) => pageName.toLowerCase().startsWith(k))) {
            currentRole.pages.push({
              pageName,
              isDefault,
              sections: sectionList
            });
          }
        }
      }
    }

    const validRoles = roles.filter((r) => r.pages.length > 0 || Boolean(r.alurProses));

    if (appName && (features.length > 0 || validRoles.length > 0)) {
      return {
        introText: introText || undefined,
        appName,
        orientation,
        visualTheme,
        features,
        roadmap,
        usp,
        roles: validRoles,
        closingQuestion: closingQuestion || undefined,
        rawMarkdown: text
      };
    }

    return null;
  } catch (err) {
    console.warn('Brief parsing fallback to raw text:', err);
    return null;
  }
}

interface BriefKebutuhanCardProps {
  data: ParsedBriefKebutuhan;
  onSwitchToBuild?: () => void;
  onUpdateBrief?: (updatedMarkdown: string) => void;
}

export const BriefKebutuhanCard: React.FC<BriefKebutuhanCardProps> = ({
  data,
  onSwitchToBuild,
  onUpdateBrief
}) => {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editMarkdown, setEditMarkdown] = useState(data.rawMarkdown || '');
  const [currentData, setCurrentData] = useState<ParsedBriefKebutuhan>(data);

  const handleCopy = () => {
    navigator.clipboard.writeText(currentData.rawMarkdown || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveEdit = () => {
    const parsed = parseBriefKebutuhan(editMarkdown);
    if (parsed) {
      setCurrentData(parsed);
    } else {
      setCurrentData((prev) => ({
        ...prev,
        rawMarkdown: editMarkdown
      }));
    }
    setIsEditing(false);
    onUpdateBrief?.(editMarkdown);
  };

  const handleCancelEdit = () => {
    setEditMarkdown(currentData.rawMarkdown || '');
    setIsEditing(false);
  };

  return (
    <div className="w-full max-w-2xl rounded-2xl bg-[#0a0a10] border border-[#10f48e]/35 shadow-2xl overflow-hidden text-zinc-200 my-2 animate-in fade-in duration-200 select-text">
      {/* 1. Teks Pengantar Percakapan (jika ada) */}
      {currentData.introText && !isEditing && (
        <div className="p-4 sm:p-5 bg-gradient-to-r from-[#101018] via-[#0d0d14] to-[#12121c] border-b border-white/10 text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
          {currentData.introText}
        </div>
      )}

      {/* Header Kotak Brief Kebutuhan */}
      <div className="p-4 sm:p-5 bg-[#0e0e15] border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#10f48e]/15 border border-[#10f48e]/40 text-[#10f48e] text-[10px] font-extrabold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10f48e] animate-pulse" />
              {isEditing ? 'Mode Edit Brief Aktif' : 'Brief Siap Dikonfirmasi'}
            </span>
            <span className="text-[11px] text-zinc-400 font-medium">
              Spesifikasi Fungsional & Alur Kerja
            </span>
          </div>
          <h3 className="text-sm sm:text-base font-extrabold text-white truncate flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#10f48e] shrink-0" />
            <span className="truncate">{currentData.appName}</span>
          </h3>
        </div>

        {/* Action Buttons: Edit Brief & Copy */}
        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
          {!isEditing ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setEditMarkdown(currentData.rawMarkdown || '');
                  setIsEditing(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-[#10f48e]/15 hover:bg-[#10f48e]/25 border border-[#10f48e]/40 text-[#10f48e] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-sm shadow-[#10f48e]/10"
                title="Edit teks dokumen Brief Kebutuhan secara langsung"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>✏️ Edit Brief</span>
              </button>

              <button
                type="button"
                onClick={handleCopy}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                title="Salin isi lembar Brief Kebutuhan ke clipboard"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#10f48e]" />
                    <span className="text-[#10f48e]">Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-400 hover:text-white text-xs font-medium transition-all flex items-center gap-1 cursor-pointer active:scale-95"
              >
                <X className="w-3.5 h-3.5" />
                <span>Batal</span>
              </button>

              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-400 to-[#10f48e] text-black font-extrabold text-xs shadow-md shadow-[#10f48e]/20 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Save className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Simpan</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Konten: Mode Edit vs Mode Visual Card */}
      {isEditing ? (
        <div className="p-4 sm:p-5 space-y-3 bg-[#06060a]">
          <div className="flex items-center justify-between text-[11px] text-zinc-400">
            <span>Ubah teks lembar Brief Kebutuhan di bawah ini sesuai keinginan Anda:</span>
            <span className="text-[10px] text-zinc-500 font-mono">Markdown Format</span>
          </div>
          <textarea
            rows={18}
            value={editMarkdown}
            onChange={(e) => setEditMarkdown(e.target.value)}
            className="w-full rounded-xl bg-[#0e0e16] border border-[#10f48e]/40 p-3.5 font-mono text-xs text-zinc-100 leading-relaxed focus:outline-none focus:ring-1 focus:ring-[#10f48e] resize-y scrollbar-thin select-text"
          />
        </div>
      ) : (
        <div className="p-4 sm:p-5 space-y-3 text-xs leading-relaxed max-h-[520px] overflow-y-auto scrollbar-thin">
          {/* Metadata Pokok */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white/[0.02] p-3 rounded-xl border border-white/5">
            <div>
              <span className="text-zinc-500 text-[11px] block">Nama Aplikasi</span>
              <span className="font-bold text-white">{currentData.appName}</span>
            </div>
            {currentData.orientation && (
              <div>
                <span className="text-zinc-500 text-[11px] block">Orientasi Desain</span>
                <span className="text-zinc-300">{currentData.orientation}</span>
              </div>
            )}
            {currentData.visualTheme && (
              <div className="sm:col-span-2 pt-1 border-t border-white/5">
                <span className="text-zinc-500 text-[11px] block">Tema Visual & Nuansa</span>
                <span className="text-zinc-300">{currentData.visualTheme}</span>
              </div>
            )}
          </div>

          {/* Fitur Utama (V1) */}
          {currentData.features.length > 0 && (
            <div className="space-y-1.5 pt-2">
              <div className="font-bold text-white flex items-center gap-1.5 text-xs">
                <Sparkles className="w-3.5 h-3.5 text-[#10f48e]" />
                <span>Fitur Utama yang Akan Dibangun (V1):</span>
              </div>
              <ol className="list-decimal list-inside space-y-1 pl-1 text-zinc-300 text-[11.5px]">
                {currentData.features.map((feat, idx) => (
                  <li key={idx} className="leading-relaxed">
                    {feat}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Roadmap Lanjutan */}
          {currentData.roadmap.length > 0 && (
            <div className="space-y-1 pt-1">
              <div className="text-zinc-400 text-[11px] font-semibold">
                Roadmap Lanjutan (V2/V3):
              </div>
              <ul className="list-disc list-inside space-y-0.5 pl-1 text-zinc-500 text-[11px]">
                {currentData.roadmap.map((item, idx) => (
                  <li key={idx} className="leading-relaxed">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Job Description & Struktur Halaman per Role */}
          {currentData.roles.length > 0 && (
            <div className="space-y-2 pt-3 border-t border-white/10">
              <div className="font-bold text-white flex items-center gap-1.5 text-xs">
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                <span>Pembagian Peran & Struktur Halaman:</span>
              </div>

              <div className="space-y-2.5 pt-1">
                {currentData.roles.map((r, rIdx) => (
                  <div
                    key={rIdx}
                    className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5"
                  >
                    <div className="font-extrabold text-[#10f48e] text-xs flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{r.roleName}</span>
                    </div>

                    <ul className="space-y-1 pl-4 text-zinc-300 text-[11.5px]">
                      {r.pages.map((p, pIdx) => (
                        <li key={pIdx} className="leading-relaxed list-disc">
                          <span className="font-semibold text-white">{p.pageName}</span>
                          {p.isDefault && (
                            <span className="text-[#10f48e] font-normal text-[10.5px]"> (Landing Awal)</span>
                          )}
                          {p.sections.length > 0 && (
                            <span className="text-zinc-400">: section {p.sections.join(', ')}</span>
                          )}
                        </li>
                      ))}
                      {r.alurProses && (
                        <li className="leading-relaxed text-zinc-400 pt-1 text-[11px] list-none -ml-4 pl-2 border-l-2 border-[#10f48e]/40">
                          <span className="font-bold text-zinc-200">Alur Kerja:</span> {r.alurProses}
                        </li>
                      )}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer Kartu Brief Kebutuhan */}
      <div className="p-4 bg-[#0e0e15] border-t border-white/10 space-y-3">
        {currentData.closingQuestion && !isEditing && (
          <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
            {currentData.closingQuestion}
          </p>
        )}

        {onSwitchToBuild && !isEditing && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
            <span className="text-[11px] text-zinc-400">
              Brief Kebutuhan ini menjadi panduan rancangan saat prototipe dibangun.
            </span>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setEditMarkdown(currentData.rawMarkdown || '');
                  setIsEditing(true);
                }}
                className="py-2.5 px-3.5 rounded-xl bg-white/5 hover:bg-[#10f48e]/15 border border-white/10 hover:border-[#10f48e]/40 text-zinc-200 hover:text-[#10f48e] font-bold text-xs transition-all flex items-center justify-center gap-1.5 active:scale-98 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5 text-[#10f48e]" />
                <span>Edit Brief</span>
              </button>

              <button
                type="button"
                onClick={onSwitchToBuild}
                className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-400 to-[#10f48e] hover:from-emerald-500 hover:to-[#0df28a] text-black font-extrabold text-xs shadow-lg shadow-[#10f48e]/25 transition-all flex items-center justify-center gap-2 shrink-0 active:scale-98 cursor-pointer"
              >
                <Wrench className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Setujui Brief & Beralih ke Mode Build</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
