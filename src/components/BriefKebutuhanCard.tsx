import React from 'react';
import { 
  FileText, 
  Smartphone, 
  Monitor, 
  Palette, 
  CheckCircle2, 
  Rocket, 
  Sparkles, 
  Users, 
  ShieldCheck,
  Layers,
  ChevronRight
} from 'lucide-react';

export interface PageSectionDetail {
  pageName: string;
  isDefault: boolean;
  sections: string[];
}

export interface RoleDetail {
  roleName: string;
  pages: PageSectionDetail[];
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
}

/**
 * Parser tangguh untuk membedah teks Markdown Brief Kebutuhan menjadi objek terstruktur.
 * Mengembalikan null jika format tidak mencukupi untuk rendering kartu (otomatis fallback).
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
    
    const closingMatch = briefContent.search(/\n\s*(Apakah\s+(?:lembar\s+)?Brief\s+Kebutuhan|Apakah\s+ada\s+detail|Silakan\s+konfirmasi)/i);
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
    const featuresBlockMatch = cardContent.match(/-\s*\*\*Fitur Utama(?:\s*\(V1\))?\*\*:\s*\n([\s\S]*?)(?=\n-\s*\*\*|$)/i);
    if (featuresBlockMatch) {
      const lines = featuresBlockMatch[1].split('\n');
      for (const line of lines) {
        const cleaned = line.replace(/^\s*(?:\d+\.|\*|-)\s*/, '').trim();
        if (cleaned) features.push(cleaned);
      }
    }

    // 6. Ekstrak Roadmap Lanjutan (V2/V3)
    const roadmap: string[] = [];
    const roadmapBlockMatch = cardContent.match(/-\s*\*\*Roadmap Lanjutan(?:\s*\(V2\/V3\))?\*\*:\s*\n([\s\S]*?)(?=\n-\s*\*\*|$)/i);
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

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Cek apakah ini baris Header Role (misal: `* **Admin**:` atau `* **[Admin]**:` atau `- **Kasir**:`)
        const roleHeaderMatch = trimmed.match(/^[\*\-]\s*\*\*\[?([A-Za-z0-9\s\/\-_]+?)\]?\*\*:?$/) ||
                                trimmed.match(/^\*\*\[?([A-Za-z0-9\s\/\-_]+?)\]?\*\*:?$/);

        if (roleHeaderMatch) {
          const rName = roleHeaderMatch[1].replace(/[\*\[\]:]/g, '').trim();
          if (rName && !rName.toLowerCase().startsWith('job description')) {
            currentRole = { roleName: rName, pages: [] };
            roles.push(currentRole);
            continue;
          }
        }

        // Cek apakah ini baris Halaman/Section di bawah role saat ini (misal: `- Dashboard (default): section ...`)
        if (currentRole && (trimmed.startsWith('-') || trimmed.startsWith('*'))) {
          const lineWithoutBullet = trimmed.replace(/^[\-\*]\s*/, '').trim();
          const isDefault = /\(default\)/i.test(lineWithoutBullet);
          
          let pageName = lineWithoutBullet;
          const sectionList: string[] = [];

          if (lineWithoutBullet.includes(':')) {
            const [pNamePart, sectionsPart] = lineWithoutBullet.split(/:\s*(.+)/);
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

          if (pageName) {
            currentRole.pages.push({
              pageName,
              isDefault,
              sections: sectionList
            });
          }
        }
      }
    }


    // Jika berhasil mengekstrak minimal appName dan (features atau roles)
    if (appName && (features.length > 0 || roles.length > 0)) {
      return {
        introText: introText || undefined,
        appName,
        orientation,
        visualTheme,
        features,
        roadmap,
        usp,
        roles,
        closingQuestion: closingQuestion || undefined
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
}

export const BriefKebutuhanCard: React.FC<BriefKebutuhanCardProps> = ({ data }) => {
  return (
    <div className="space-y-3.5 my-1 text-slate-200">
      {/* 1. Teks Pengantar Percakapan (jika ada) */}
      {data.introText && (
        <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
          {data.introText}
        </p>
      )}

      {/* 2. Kartu Utama Brief Kebutuhan */}
      <div className="rounded-2xl bg-gradient-to-b from-slate-900/95 via-slate-900/90 to-slate-950/95 border border-indigo-500/30 shadow-2xl shadow-indigo-950/40 overflow-hidden backdrop-blur-md">
        {/* Header Kartu */}
        <div className="px-5 py-4 bg-gradient-to-r from-indigo-950/80 via-purple-950/50 to-slate-900/80 border-b border-indigo-500/20 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Dokumen Desain Baku
                </span>
                <span className="text-[10px] text-slate-400">Tahap 1 Pembukaan</span>
              </div>
              <h3 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2 mt-0.5">
                <span>📋 Brief Kebutuhan:</span>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-purple-200 to-pink-300">
                  {data.appName}
                </span>
              </h3>
            </div>
          </div>

          {data.orientation && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px] font-medium text-slate-300">
              {data.orientation.toLowerCase().includes('mobile') ? (
                <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Monitor className="w-3.5 h-3.5 text-blue-400" />
              )}
              <span>{data.orientation.split(',')[0]}</span>
            </div>
          )}
        </div>

        {/* Isi Kartu */}
        <div className="p-5 space-y-4 text-xs">
          {/* Metadata Baris (Orientasi & Tema Visual) */}
          {(data.orientation || data.visualTheme) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {data.orientation && (
                <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                    <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Orientasi UI</span>
                  </div>
                  <p className="text-[11.5px] text-slate-200 leading-snug">{data.orientation}</p>
                </div>
              )}

              {data.visualTheme && (
                <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                    <Palette className="w-3.5 h-3.5 text-pink-400" />
                    <span>Tema Visual & Kesan</span>
                  </div>
                  <p className="text-[11.5px] text-slate-200 leading-snug">{data.visualTheme}</p>
                </div>
              )}
            </div>
          )}

          {/* Fitur Utama (V1) */}
          {data.features.length > 0 && (
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/90 space-y-2.5">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <h4 className="text-xs font-bold text-white tracking-wide uppercase">
                  Fitur Utama (Versi 1 / MVP)
                </h4>
                <span className="ml-auto text-[10px] px-2 py-0.5 rounded-md bg-emerald-950/80 text-emerald-300 border border-emerald-800/40">
                  {data.features.length} Fitur
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                {data.features.map((feat, idx) => (
                  <div 
                    key={idx}
                    className="flex items-start gap-2 p-2 rounded-lg bg-slate-900/60 border border-slate-800/60 text-slate-300 text-[11.5px]"
                  >
                    <span className="w-4 h-4 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="leading-snug">{feat}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Job Description & Struktur Halaman per Role (Highlight Terpenting) */}
          {data.roles.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 px-1">
                <Users className="w-4 h-4 text-purple-400 shrink-0" />
                <h4 className="text-xs font-bold text-white tracking-wide uppercase">
                  Job Description & Struktur Halaman per Role
                </h4>
                <span className="ml-auto text-[10px] px-2 py-0.5 rounded-md bg-purple-950/80 text-purple-300 border border-purple-800/40">
                  {data.roles.length} Role
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data.roles.map((r, rIdx) => (
                  <div
                    key={rIdx}
                    className="rounded-xl bg-slate-950/80 border border-indigo-500/20 p-3.5 space-y-2.5 hover:border-indigo-500/40 transition-colors shadow-sm"
                  >
                    {/* Header Role */}
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold text-[11px]">
                          {r.roleName.charAt(0)}
                        </div>
                        <span className="font-bold text-white text-xs">
                          {r.roleName}
                        </span>
                      </div>
                      <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                    </div>

                    {/* Daftar Halaman & Section Role */}
                    <div className="space-y-2">
                      {r.pages.map((p, pIdx) => (
                        <div 
                          key={pIdx}
                          className="p-2 rounded-lg bg-slate-900/80 border border-slate-800/70 text-[11px] space-y-1"
                        >
                          <div className="flex items-center justify-between gap-1.5 font-medium text-slate-200">
                            <span className="flex items-center gap-1">
                              <ChevronRight className="w-3 h-3 text-indigo-400 shrink-0" />
                              <span className="font-semibold">{p.pageName}</span>
                            </span>
                            {p.isDefault && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-medium">
                                Landing Tab
                              </span>
                            )}
                          </div>

                          {p.sections.length > 0 && (
                            <div className="flex flex-wrap gap-1 pl-4 pt-0.5">
                              {p.sections.map((sec, sIdx) => (
                                <span
                                  key={sIdx}
                                  className="text-[10px] px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800"
                                >
                                  {sec}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fitur Unik (USP) & Roadmap Lanjutan */}
          {(data.usp || data.roadmap.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              {data.usp && (
                <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-1 text-amber-200">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-300">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Fitur Unik (USP)</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-amber-100/90">{data.usp}</p>
                </div>
              )}

              {data.roadmap.length > 0 && (
                <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800 space-y-1.5 text-slate-400">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-300">
                    <Rocket className="w-3.5 h-3.5 text-purple-400" />
                    <span>Roadmap Lanjutan (V2/V3)</span>
                  </div>
                  <ul className="space-y-1 text-[11px]">
                    {data.roadmap.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-purple-400 shrink-0">•</span>
                        <span className="leading-snug">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 3. Pertanyaan Konfirmasi Akhir (di luar kartu sebagai bubble/teks interaktif) */}
      {data.closingQuestion && (
        <div className="p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 text-xs text-indigo-200 leading-relaxed font-medium shadow-sm flex items-start gap-2.5 mt-2">
          <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <p className="whitespace-pre-wrap">{data.closingQuestion}</p>
        </div>
      )}
    </div>
  );
};
