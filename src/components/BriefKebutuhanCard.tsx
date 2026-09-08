import React from 'react';

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
      let pendingAlurRole: RoleDetail | null = null;
      const forbiddenKeywords = ['job description', 'struktur halaman', 'alur proses', 'alur', 'fitur utama', 'roadmap', 'catatan', 'fitur unik', 'nama peran', 'peran 1', 'role 1'];

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Jika baris sebelumnya adalah header Alur Proses tanpa isi teks, baris ini adalah isi Alur Prosesnya
        if (pendingAlurRole) {
          const cleanText = trimmed.replace(/^[\-\*]\s*/, '').trim();
          if (cleanText && !cleanText.startsWith('*') && !cleanText.startsWith('#')) {
            pendingAlurRole.alurProses = cleanText;
            pendingAlurRole = null;
            continue;
          }
          pendingAlurRole = null;
        }

        // Cek baris Alur Proses di bawah role saat ini (misal: `- Alur Proses: Klik ...` atau `* **Alur Proses**: Klik ...` atau `* **Alur Proses**:`)
        if (currentRole && /^(?:[\*\-]\s*)?(?:\*\*)?Alur\s+Proses(?:\*\*)?:?/i.test(trimmed)) {
          const alurText = trimmed.replace(/^(?:[\*\-]\s*)?(?:\*\*)?Alur\s+Proses(?:\*\*)?:?\s*/i, '').trim();
          if (alurText) {
            currentRole.alurProses = alurText;
          } else {
            pendingAlurRole = currentRole;
          }
          continue;
        }

        // Cek baris Header Role (misal: `* **Admin**:` atau `* **[Admin]**:` atau `- **Kasir**:`)
        const roleHeaderMatch = trimmed.match(/^[\*\-]\s*\*\*\[?([A-Za-z0-9\s\/\-_]+?)\]?\*\*:?$/) ||
                                trimmed.match(/^\*\*\[?([A-Za-z0-9\s\/\-_]+?)\]?\*\*:?$/);

        if (roleHeaderMatch) {
          let rName = roleHeaderMatch[1].replace(/[\*\[\]:]/g, '').trim();
          const isForbidden = forbiddenKeywords.some(k => rName.toLowerCase().startsWith(k));
          
          if (rName && !isForbidden) {
            rName = rName.replace(/^(?:Role|Peran)\s+/i, '').trim();
            currentRole = { roleName: rName, pages: [] };
            roles.push(currentRole);
            continue;
          } else if (rName.toLowerCase().includes('alur proses') && currentRole) {
            pendingAlurRole = currentRole;
            continue;
          }
        }

        // Cek baris Halaman/Section di bawah role saat ini (misal: `- Dashboard (default): section ...`)
        if (currentRole && (trimmed.startsWith('-') || trimmed.startsWith('*'))) {
          // Abaikan jika baris ini ternyata Alur Proses
          if (/Alur\s+Proses/i.test(trimmed)) {
            const alurText = trimmed.replace(/^(?:[\*\-]\s*)?(?:\*\*)?Alur\s+Proses(?:\*\*)?:?\s*/i, '').trim();
            if (alurText) {
              currentRole.alurProses = alurText;
            } else {
              pendingAlurRole = currentRole;
            }
            continue;
          }

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

          if (pageName && !forbiddenKeywords.some(k => pageName.toLowerCase().startsWith(k))) {
            currentRole.pages.push({
              pageName,
              isDefault,
              sections: sectionList
            });
          }
        }
      }
    }

    // Filter role kosong (tanpa halaman dan tanpa alur)
    const validRoles = roles.filter(r => r.pages.length > 0 || Boolean(r.alurProses));

    // Jika berhasil mengekstrak minimal appName dan (features atau roles)
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
    <div className="space-y-3 my-1 text-slate-200 text-xs">
      {/* 1. Teks Pengantar Percakapan (jika ada) */}
      {data.introText && (
        <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">
          {data.introText}
        </p>
      )}

      {/* 2. Kotak Sederhana Dokumen Brief Kebutuhan */}
      <div className="rounded-2xl bg-slate-950 border border-slate-800 p-5 space-y-3.5 shadow-md">
        {/* Header Kotak Sederhana */}
        <div className="pb-2.5 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
            <span>📋</span>
            <span>Brief Kebutuhan:</span>
            <span className="text-indigo-300 font-semibold">{data.appName}</span>
          </h3>
        </div>

        {/* Baris-Baris Field Utama */}
        <div className="space-y-2.5 leading-relaxed">
          {/* Nama App */}
          <div>
            <span className="font-semibold text-slate-200">• Nama App:</span>{' '}
            <span className="text-slate-300">{data.appName}</span>
          </div>

          {/* Orientasi UI */}
          {data.orientation && (
            <div>
              <span className="font-semibold text-slate-200">• Orientasi UI:</span>{' '}
              <span className="text-slate-300">{data.orientation}</span>
            </div>
          )}

          {/* Tema Visual */}
          {data.visualTheme && (
            <div>
              <span className="font-semibold text-slate-200">• Tema Visual:</span>{' '}
              <span className="text-slate-300">{data.visualTheme}</span>
            </div>
          )}

          {/* Fitur Utama (V1) - List Bernomor Biasa */}
          {data.features.length > 0 && (
            <div className="space-y-1 pt-1">
              <div className="font-semibold text-slate-200">• Fitur Utama (V1):</div>
              <ol className="list-decimal list-inside space-y-1 pl-2 text-slate-300">
                {data.features.map((feat, idx) => (
                  <li key={idx} className="leading-relaxed">
                    {feat}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Roadmap Lanjutan (V2/V3) */}
          {data.roadmap.length > 0 && (
            <div className="space-y-1 pt-1">
              <div className="font-semibold text-slate-200">• Roadmap Lanjutan (V2/V3):</div>
              <ul className="list-disc list-inside space-y-1 pl-2 text-slate-400">
                {data.roadmap.map((item, idx) => (
                  <li key={idx} className="leading-relaxed">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Fitur Unik (USP) */}
          {data.usp && (
            <div className="pt-1">
              <span className="font-semibold text-slate-200">• Fitur Unik (USP):</span>{' '}
              <span className="text-slate-300">{data.usp}</span>
            </div>
          )}

          {/* Job Description & Struktur Halaman per Role (Pemisahan Visual Sederhana) */}
          {data.roles.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-800/80">
              <div className="font-semibold text-slate-200">
                • Job Description & Struktur Halaman per Role:
              </div>

              <div className="space-y-3 pl-2 pt-1">
                {data.roles.map((r, rIdx) => {
                  const cleanRoleTitle = r.roleName.toLowerCase().startsWith('role') ? r.roleName : `Role ${r.roleName}`;
                  return (
                    <div key={rIdx} className="space-y-1.5 pt-2.5 first:pt-0 border-t first:border-t-0 border-slate-800/60">
                      <div className="font-bold text-indigo-300 text-xs">
                        * {cleanRoleTitle}:
                      </div>

                      <ul className="space-y-1 pl-3 text-slate-300 text-[11.5px]">
                        {r.pages.map((p, pIdx) => (
                          <li key={pIdx} className="leading-relaxed">
                            - <span className="font-medium text-slate-200">{p.pageName}</span>
                            {p.isDefault && <span className="text-indigo-400 font-normal"> (default)</span>}
                            {p.sections.length > 0 && `: section ${p.sections.join(', ')}`}
                          </li>
                        ))}
                        {r.alurProses && (
                          <li className="leading-relaxed text-slate-400 pt-0.5">
                            - <span className="font-medium text-indigo-200/90">Alur Proses:</span> {r.alurProses}
                          </li>
                        )}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Pertanyaan Konfirmasi Akhir (di luar kotak sebagai teks biasa) */}
      {data.closingQuestion && (
        <p className="text-slate-300 leading-relaxed pt-1 whitespace-pre-wrap">
          {data.closingQuestion}
        </p>
      )}
    </div>
  );
};
