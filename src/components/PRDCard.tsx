'use client';

import React, { useState } from 'react';
import {
  FileText,
  Copy,
  Check,
  Wrench,
  ShieldCheck,
  Database,
  Terminal,
  Layers,
  Sparkles,
  Users,
  ChevronRight,
  Edit3,
  Save,
  X
} from 'lucide-react';

export interface PRDSection {
  number: number;
  title: string;
  content: string;
}

export interface ParsedPRD {
  docTitle: string;
  appTitle: string;
  sections: PRDSection[];
  closingNote?: string;
  rawMarkdown: string;
}

/**
 * Parser untuk membedah teks Markdown PRD (7 Poin Teknis)
 */
export function parsePRD(text: string): ParsedPRD | null {
  if (!text || typeof text !== 'string') return null;

  // Cek apakah teks memuat penanda PRD
  const hasPRDHeader =
    /Product Requirements Document/i.test(text) ||
    /\bPRD\b/i.test(text) ||
    /Technical PRD/i.test(text) ||
    /Rancangan Spesifikasi Sistem/i.test(text) ||
    /Architecture Plan/i.test(text) ||
    /Plan Ready for Review/i.test(text);

  if (!hasPRDHeader) return null;

  // Minimal harus ada indikasi konten spesifikasi teknis
  const hasTechnicalContent =
    /Executive Summary/i.test(text) ||
    /Ringkasan Eksekutif/i.test(text) ||
    /Peran Pengguna/i.test(text) ||
    /User Roles/i.test(text) ||
    /Arsitektur Multi-Halaman/i.test(text) ||
    /Struktur Database/i.test(text) ||
    /Spesifikasi Backend/i.test(text) ||
    /Fitur Unggulan/i.test(text) ||
    /Keamanan & Validasi/i.test(text);

  if (!hasTechnicalContent) {
    return null;
  }

  try {
    // Ekstrak Judul Dokumen & Nama Aplikasi
    let docTitle = 'Product Requirements Document (PRD)';
    let appTitle = 'Aplikasi Web';

    const titleMatch = text.match(/([^\n]+(?:Technical PRD|PRD & Architecture Plan|Spesifikasi Sistem)[^\n]*)/i);
    if (titleMatch) {
      appTitle = titleMatch[1].replace(/[#*`_]/g, '').trim();
    } else {
      const generalTitleMatch = text.match(/(?:Aplikasi|Sistem)\s+([^\n\-–—:.]+)/i);
      if (generalTitleMatch) {
        appTitle = generalTitleMatch[0].replace(/[#*`_]/g, '').trim();
      }
    }

    // Ekstrak Bagian Utama dengan regex nomor 1 s/d 7 yang mendukung bold, header, parenthesis
    const sectionRegex =
      /(?:^|\n)(?:#{1,6}\s*)?(?:\*\*)?(?:Bagian\s+|Poin\s+)?(\d+)[\.\)]\s*(?:\*\*)?\s*([^\n]+)\n([\s\S]*?)(?=(?:\n(?:#{1,6}\s*)?(?:\*\*)?(?:Bagian\s+|Poin\s+)?\d+[\.\)]\s*)|$)/gi;
    const sections: PRDSection[] = [];
    let match;

    while ((match = sectionRegex.exec(text)) !== null) {
      const num = parseInt(match[1], 10);
      const rawTitle = match[2];
      const title = rawTitle.replace(/^[*_#`\s]+|[*_#`:\s]+$/g, '').trim();
      const content = match[3].trim();
      sections.push({
        number: num,
        title,
        content
      });
    }

    // Fallback cerdas: Jika regex section gagal menangkap nomor terstruktur,
    // jangan kembalikan null! Bungkus dalam 1 section utuh agar kartu PRD dan tombol Edit tetap aktif!
    if (sections.length === 0) {
      sections.push({
        number: 1,
        title: 'Spesifikasi & Rencana Arsitektur',
        content: text.trim()
      });
    }

    // Ekstrak Closing Note di akhir jika ada (misal pertanyaan konfirmasi)
    let closingNote = '';
    const lastSection = sections[sections.length - 1];
    if (lastSection) {
      const splitClosing = lastSection.content.split(/\n(?=(?:Apakah|Silakan|Jika sudah|Untuk mulai|Beri tahu saya))/i);
      if (splitClosing.length > 1) {
        lastSection.content = splitClosing[0].trim();
        closingNote = splitClosing.slice(1).join('\n').trim();
      }
    }

    return {
      docTitle,
      appTitle,
      sections,
      closingNote,
      rawMarkdown: text
    };
  } catch (e) {
    console.error('Error parsing PRD:', e);
    return null;
  }
}

interface PRDCardProps {
  data: ParsedPRD;
  onSwitchToBuild?: () => void;
  onUpdatePRD?: (updatedMarkdown: string) => void;
}

const SECTION_ICONS: Record<number, React.ReactNode> = {
  1: <Sparkles className="w-4 h-4 text-[#10f48e]" />,
  2: <Users className="w-4 h-4 text-emerald-400" />,
  3: <Layers className="w-4 h-4 text-cyan-400" />,
  4: <Database className="w-4 h-4 text-yellow-400" />,
  5: <Terminal className="w-4 h-4 text-indigo-400" />,
  6: <Sparkles className="w-4 h-4 text-amber-400" />,
  7: <ShieldCheck className="w-4 h-4 text-emerald-400" />
};

export const PRDCard: React.FC<PRDCardProps> = ({ data, onSwitchToBuild, onUpdatePRD }) => {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editMarkdown, setEditMarkdown] = useState(data.rawMarkdown);
  const [currentData, setCurrentData] = useState<ParsedPRD>(data);
  const [collapsedSections, setCollapsedSections] = useState<Record<number, boolean>>({});

  const handleCopy = () => {
    navigator.clipboard.writeText(currentData.rawMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleSection = (num: number) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [num]: !prev[num]
    }));
  };

  const handleSaveEdit = () => {
    const parsed = parsePRD(editMarkdown);
    if (parsed) {
      setCurrentData(parsed);
    } else {
      setCurrentData((prev) => ({
        ...prev,
        rawMarkdown: editMarkdown
      }));
    }
    setIsEditing(false);
    onUpdatePRD?.(editMarkdown);
  };

  const handleCancelEdit = () => {
    setEditMarkdown(currentData.rawMarkdown);
    setIsEditing(false);
  };

  return (
    <div className="w-full max-w-2xl rounded-2xl bg-[#0a0a10] border border-[#10f48e]/35 shadow-2xl overflow-hidden text-zinc-200 my-2 animate-in fade-in duration-200 select-text">
      {/* Header PRD Card */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-[#101018] via-[#0d0d14] to-[#12121c] border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#10f48e]/15 border border-[#10f48e]/40 text-[#10f48e] text-[10px] font-extrabold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10f48e] animate-pulse" />
              {isEditing ? 'Mode Edit PRD Aktif' : 'Plan Ready for Review'}
            </span>
            <span className="text-[11px] text-zinc-400 font-medium">
              Technical PRD & Architecture Plan
            </span>
          </div>
          <h3 className="text-sm sm:text-base font-extrabold text-white truncate flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#10f48e] shrink-0" />
            <span className="truncate">{currentData.appTitle}</span>
          </h3>
        </div>

        {/* Action Buttons: Edit PRD & Copy PRD */}
        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
          {!isEditing ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setEditMarkdown(currentData.rawMarkdown);
                  setIsEditing(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-[#10f48e]/15 hover:bg-[#10f48e]/25 border border-[#10f48e]/40 text-[#10f48e] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-sm shadow-[#10f48e]/10"
                title="Edit teks dokumen PRD secara langsung"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>✏️ Edit PRD</span>
              </button>

              <button
                type="button"
                onClick={handleCopy}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                title="Salin isi dokumen PRD lengkap ke clipboard"
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

      {/* Konten PRD: Mode Tampilan Normal vs Mode Editor */}
      {isEditing ? (
        <div className="p-4 sm:p-5 space-y-3 bg-[#06060a]">
          <div className="flex items-center justify-between text-[11px] text-zinc-400">
            <span>Ubah teks spesifikasi PRD di bawah ini sesuai kebutuhan Anda:</span>
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
        <div className="p-4 sm:p-5 space-y-3.5 max-h-[520px] overflow-y-auto scrollbar-thin divide-y divide-white/5">
          {currentData.sections.map((sec) => {
            const isCollapsed = collapsedSections[sec.number];
            const icon = SECTION_ICONS[sec.number] || <Layers className="w-4 h-4 text-zinc-400" />;

            return (
              <div key={sec.number} className="pt-3 first:pt-0">
                <button
                  type="button"
                  onClick={() => toggleSection(sec.number)}
                  className="w-full flex items-center justify-between text-left group py-1 cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                      {icon}
                    </div>
                    <h4 className="text-xs font-bold text-white group-hover:text-[#10f48e] transition-colors">
                      {sec.number}. {sec.title}
                    </h4>
                  </div>
                  <ChevronRight
                    className={`w-4 h-4 text-zinc-500 transition-transform ${
                      isCollapsed ? '' : 'rotate-90 text-[#10f48e]'
                    }`}
                  />
                </button>

                {!isCollapsed && (
                  <div className="mt-2 pl-8 text-[11.5px] leading-relaxed text-zinc-300 whitespace-pre-wrap font-sans bg-white/[0.02] p-3 rounded-xl border border-white/5">
                    {sec.content}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Footer Kartu PRD: Closing & Tombol Beralih ke Build */}
      <div className="p-4 bg-[#0e0e15] border-t border-white/10 space-y-3">
        {currentData.closingNote && (
          <p className="text-xs text-zinc-300 leading-relaxed">
            {currentData.closingNote}
          </p>
        )}

        {onSwitchToBuild && !isEditing && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
            <span className="text-[11px] text-zinc-400">
              PRD ini akan dijadikan acuan spesifikasi saat prototipe dibangun.
            </span>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setEditMarkdown(currentData.rawMarkdown);
                  setIsEditing(true);
                }}
                className="py-2.5 px-3.5 rounded-xl bg-white/5 hover:bg-[#10f48e]/15 border border-white/10 hover:border-[#10f48e]/40 text-zinc-200 hover:text-[#10f48e] font-bold text-xs transition-all flex items-center justify-center gap-1.5 active:scale-98 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5 text-[#10f48e]" />
                <span>Edit PRD</span>
              </button>

              <button
                type="button"
                onClick={onSwitchToBuild}
                className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-400 to-[#10f48e] hover:from-emerald-500 hover:to-[#0df28a] text-black font-extrabold text-xs shadow-lg shadow-[#10f48e]/25 transition-all flex items-center justify-center gap-2 shrink-0 active:scale-98 cursor-pointer"
              >
                <Wrench className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Setujui PRD & Beralih ke Mode Build</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
