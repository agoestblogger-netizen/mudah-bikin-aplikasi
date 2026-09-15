import { NextResponse } from 'next/server';
import { validateAndRepairGeneratedCode, extractMissingHandlers, extractStubFormIssues } from '@/lib/codeValidator';
import { cleanConversationalLeaks } from '@/lib/cleanLeaks';
import { checkRateLimit } from '@/lib/rateLimiter';
import { getUserFromRequest } from '@/lib/supabase/user';
import { stitchContinuationCode } from '@/lib/continuationStitcher';
import * as acorn from 'acorn';
import {
  getConciseCatalogSummary,
  detectMatchingMasterTemplate,
  formatTemplateContextForIdeation,
  detectSelectivePageTemplates,
  formatSelectivePageTemplatesForCodeGen,
  findRelevantUXPatterns,
  formatUXGuidanceForIdeation,
  detectIndustryOverlays,
  getTemplateProcessMap,
  formatBusinessProcessForIdeation
} from '@/lib/templates';
import { OPENROUTER_API_BASE, OPENAI_API_BASE } from '@/lib/modelConfig';
import type { AIProvider } from '@/lib/modelConfig';
import { extractAppTitleFromChat } from '@/lib/extractAppTitle';
import {
  ensureRequiredSystemRole,
  formatRolePolicyForPrompt,
  isSuperAdminRole,
  REQUIRED_SYSTEM_ROLE,
  standardizeBriefRoleNames
} from '@/lib/rolePolicy';
import { renderRbacMarkdownTable, renderDataSchemaMarkdown, renderSimulasiDbMarkdown } from '@/lib/templates/processes/guided';

// =============================================================================
// KONFIGURASI MODEL AI TERPUSAT (Single Source of Truth)
// =============================================================================
export const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash';
export const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
export const OPENROUTER_DEFAULT_MODEL = 'openai/gpt-4o-mini';
export const OPENROUTER_SITE_URL = 'https://mudahbikinapps.store';
export const OPENROUTER_APP_TITLE = 'Mudah Bikin Aplikasi';

// Builder header untuk endpoint kompatibel OpenAI (OpenAI asli atau OpenRouter BYOK)
function buildOpenAICompatHeaders(apiKey: string | undefined, isOpenRouter: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`
  };
  if (isOpenRouter) {
    headers['HTTP-Referer'] = OPENROUTER_SITE_URL;
    headers['X-Title'] = OPENROUTER_APP_TITLE;
    headers['X-OpenRouter-Title'] = OPENROUTER_APP_TITLE;
  }
  return headers;
}



export const getGeminiModel = (): string => process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
export const getOpenAIModel = (): string => process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL;

// =============================================================================
// POIN B: Per-Model Max Output Token Cap (berdasarkan batas riil tiap model)
// Jangan pernah set nilai di atas batas riil model — bisa menyebabkan HTTP 400.
//
// CATATAN PENTING (terverifikasi Sep 2026):
// - claude-3.7-sonnet: DEFAULT 8.192 tokens. Butuh header anthropic-beta: output-128k-2025-02-19
//   untuk mencapai 128K. Tanpa header itu, request dengan max_tokens > 8192 AKAN DITOLAK.
//   Header beta dikirim di buildOpenAICompatHeaders() untuk model Claude via OpenRouter.
// - openrouter/free: Alias auto-routing — model aktual bisa Nemotron (65K), Gemma 4 (besar).
//   Capping di 4096 terlalu konservatif dan salah. Gunakan 16384 (aman untuk semua model modern free).
//   Jika model aktual di baliknya memberi 400, loop error handling di route.ts akan menangani.
// =============================================================================
export function getMaxOutputTokens(modelId: string): number {
  const id = modelId.toLowerCase();

  // --- Grup 4.096: Model dengan hard cap output ketat ---
  // Mistral Large (4K via OR), Mistral 7B (4K), Gemma 2 9B (context 8K total → sisakan untuk input)
  if (
    id.includes('mistral-7b') ||
    id.includes('mistral-instruct') ||
    id.includes('mistral-large') ||    // Mistral Large: 4K output via OpenRouter (terverifikasi)
    id.includes('gemma-2')             // Gemma 2 9B: total context hanya 8K → sisakan ruang input
  ) return 4096;

  // --- Grup 8.192: Model dengan hard cap 8K (tanpa parameter/header khusus) ---
  if (
    id === 'openrouter/free' ||        // OpenRouter Free router: model aktual beragam (8K-65K). 8K aman 100% tanpa risiko 400.
    id.includes('claude-3.5') ||       // Claude 3.5 Sonnet & Haiku: hard cap 8.192 (terverifikasi)
    id.includes('claude-3-5') ||
    id.includes('claude-3.7') ||       // KOREKSI: Claude 3.7 Sonnet default 8.192 TANPA beta header!
    id.includes('claude-3-7') ||       // (butuh anthropic-beta: output-128k-2025-02-19 untuk 128K)
    id.includes('deepseek-chat') ||    // DeepSeek V3 via OpenRouter: provider cap 8K
    id.includes('deepseek-r1') ||      // DeepSeek R1 via OpenRouter: provider cap 8K
    id.includes('deepseek/deepseek') || // Semua varian deepseek via OR
    id.includes('qwen') ||             // Qwen 2.5 Coder: 8K-32K, pakai 8K konservatif
    id.includes('llama-3.3') ||        // Llama 3.3 70B: 4K-16K tergantung provider, pakai 8K
    id.includes('llama-3') ||
    id.includes('llama3')
  ) return 8192;

  // --- Grup 16.384: Model yang mendukung output panjang secara default ---
  // GPT-4o/mini (16K, terverifikasi), GPT-5, Gemini 2.5, o1/o3 (100K)
  return 16384;
}


export const maxDuration = 300; // 300 detik (5 menit) dengan Vercel Fluid Compute

// Helper: Memverifikasi apakah output kode AI terpotong atau mengalami syntax error di titik potong
function isCodeTruncatedOrBroken(text: string): boolean {
  if (!text) return true;

  // Jika dokumen HTML sudah lengkap ditutup dengan </html> dan tag <script> sudah ditutup
  if (text.includes('</html>') && (!text.includes('<script') || text.includes('</script>'))) {
    // Verifikasi apakah JS di dalam script valid (tidak error syntax akibat potongan)
    const scriptMatches = text.match(/<script[\s\S]*?>([\s\S]*?)<\/script>/gi);
    let hasJsSyntaxError = false;
    if (scriptMatches) {
      for (const s of scriptMatches) {
        let cleanJs = s.replace(/<\/?script[\s\S]*?>/gi, '').replace(/\s+as\s+[a-zA-Z_$][a-zA-Z0-9_$]*/g, '').trim();
        if (cleanJs) {
          try {
            new Function(cleanJs);
          } catch (err) {
            hasJsSyntaxError = true;
            break;
          }
        }
      }
    }
    // Jika </html> sudah ada dan tidak ada syntax error fatal, kode sudah lengkap
    if (!hasJsSyntaxError) {
      return false;
    }
  }

  // 1. Cek penutup blok kode markdown
  const backtickMatches = text.match(/```/g) || [];
  if (text.includes('```html') && (backtickMatches.length % 2 !== 0)) {
    return true;
  }

  // 2. Cek tag penutup HTML mendasar
  if (text.includes('<html') && !text.includes('</html>')) {
    return true;
  }
  if (text.includes('<body') && !text.includes('</body>')) {
    return true;
  }
  if (text.includes('<script') && !text.includes('</script>')) {
    return true;
  }

  // 2b. Cek komentar HTML yang belum ditutup
  const lastOpenComment = text.lastIndexOf('<!--');
  const lastCloseComment = text.lastIndexOf('-->');
  if (lastOpenComment !== -1 && (lastCloseComment === -1 || lastCloseComment < lastOpenComment)) {
    return true;
  }

  // 3. Ekstrak HTML dan verifikasi sintaks JS di dalam <script>
  const match = text.match(/```html([\s\S]*?)```/);
  const htmlContent = match ? match[1] : (text.includes('<!DOCTYPE') ? text : '');
  if (htmlContent) {
    const scriptMatches = htmlContent.match(/<script[\s\S]*?>([\s\S]*?)<\/script>/gi);
    if (scriptMatches) {
      for (const s of scriptMatches) {
        let cleanJs = s.replace(/<\/?script[\s\S]*?>/gi, '').replace(/\s+as\s+[a-zA-Z_$][a-zA-Z0-9_$]*/g, '').trim();
        if (cleanJs) {
          try {
            new Function(cleanJs);
          } catch (err) {
            // JS syntax error menandakan ada string/kode terpotong di tengah statement
            return true;
          }
        }
      }
    }
  }

  return false;
}

// Helper: Anti-Redundan Tawaran Admin (Poin 48)
// Jika pesan eksplorasi AI sudah mengusulkan role Admin/Owner/Manager di daftar role utamanya (termasuk varian seperti "Admin Online Shop"),
// hapus kalimat tawaran Admin terpisah di bawahnya agar tidak redundan.
export function cleanRedundantAdminOffer(text: string): string {
  if (!text) return text;
  
  // Cek apakah teks sudah mencantumkan role Admin/Owner/Manager sebagai poin usulan (contoh: "1. **Admin**:", "2. **Admin Online Shop**:", "- Role Admin:", dll)
  const hasAdminInList = /(?:^|\n)\s*(?:\d+[\.\)]|[\*\-])\s*(?:\*\*)?(?:Role\s+)?(?:Admin|Super\s*Admin|Owner|Manager)\b[^\n:]*(?:\*\*)?\s*:/i.test(text);

  if (hasAdminInList) {
    // Regex untuk mencocokkan paragraf tawaran Admin redundan di bagian bawah
    const redundantPattern = /(?:\n\s*)+(?:Selain\s+(?:itu|peran|role)[^\n]*?(?:butuh|menambahkan|perlu|sangat\s+berguna)[^\n]*?(?:role\s+)?(?:admin|super\s*admin)[^\n]*?\?(?:\s*|$))/gi;
    if (redundantPattern.test(text)) {
      text = text.replace(redundantPattern, '\n\nApakah pembagian peran dan alur kerja ini sudah cukup pas untuk usaha Anda, atau ada penyesuaian lain yang ingin ditambahkan?').trim();
    }
  }

  return text;
}

// Helper: Sanitasi Teks Brief Kebutuhan (Poin 46 & 48)
// Memperbaiki glitch format AI saat revisi agar tidak ada heading role hantu atau Alur Proses yang terlepas
function sanitizeBriefKebutuhanText(text: string): string {
  if (!text) return text;
  text = cleanRedundantAdminOffer(text);

  if (!text.includes('Brief Kebutuhan') && !text.includes('Job Description') && !text.includes('Struktur Halaman')) {
    return text;
  }

  const lines = text.split('\n');
  const sanitizedLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const trimmed = line.trim();

    // Glitch: Heading role hantu bernama "Alur Proses" (misal: `* **Alur Proses**:` atau `* Role Alur Proses:` atau `* **Alur Proses Tab 1**:`)
    if (/^[\*\-]\s*(?:\*\*)?(?:Role\s+)?Alur\s+Proses(?:\s+Tab\s+\d+)?(?:\*\*)?:?\s*$/i.test(trimmed)) {
      const matchLabel = trimmed.match(/Alur\s+Proses(?:\s+Tab\s+\d+)?/i)?.[0] || 'Alur Proses';
      line = `      - **${matchLabel}**:`;
      if (i + 1 < lines.length && !lines[i + 1].trim().startsWith('*') && !lines[i + 1].trim().startsWith('#') && !lines[i + 1].trim().startsWith('-')) {
        i++;
        line += ' ' + lines[i].trim();
      }
    }

    // Glitch: Double "Role Role"
    line = line.replace(/(\*\s+\*\*(?:Role\s+)?(?:Role\s+))/gi, '* **');

    sanitizedLines.push(line);
  }

  return sanitizedLines.join('\n');
}

// Helper: Ekstraksi Eksplisit Entitas / Varian Role Spesifik dari Prompt Pengguna (Poin 50B)
// Mencegah AI menggabungkan/menggeneralisasi varian spesifik (misal: 'dokter umum dan dokter gigi' -> Dokter)
export function extractUserSpecifiedRoleVariants(prompt: string, chatHistory: any[] = []): string[] {
  const allText = [(prompt || ''), ...(chatHistory || []).map((m: any) => m.text || '')].join('\n');
  const variantsMap = new Map<string, string>();
  const baseKeywords = 'dokter|kasir|washer|kurir|driver|terapis|mekanik|montir|guru|teknisi|operator|staf|staff|admin|petugas|apoteker|perawat|bidan';

  function addVariant(item: string) {
    if (!item) return;
    const clean = item.trim().replace(/^[\*\-\d\.\s]+/, '');
    if (clean.length < 3 || clean.length > 35) return;
    if (/^(aplikasi|fitur|menu|sistem|alur|halaman|tabel|data|yang|bisa|untuk|dengan|dan|atau|serta|secara)$/i.test(clean)) return;

    const formatted = clean.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    const lower = formatted.toLowerCase();
    if (!variantsMap.has(lower)) {
      variantsMap.set(lower, formatted);
    }
  }

  // Pola 1: Deteksi pola enumerasi 'dengan/memiliki/ada/role/peran [daftar role]'
  const listRegex = /(?:role|peran|aktor|pengguna|user|dengan|memiliki|ada|fitur untuk)\s*(?::|\s+adalah|\s+yaitu)?\s*([A-Za-z0-9\s,\/&\-\+]+?)(?:\.|\n|$|;|\s+untuk\s+mengelola|\s+yang\s+bisa|\s+agar)/gi;
  let listMatch;
  while ((listMatch = listRegex.exec(allText)) !== null) {
    const listRaw = listMatch[1];
    const items = listRaw.split(/,\s*dan\s*|,\s*serta\s*|,\s*atau\s*|,|\bdan\b|\bserta\b|\batau\b/i).map(s => s.trim());
    for (const item of items) {
      if (new RegExp(baseKeywords, 'i').test(item)) {
        addVariant(item);
      }
    }
  }

  // Pola 2: Deteksi pasangan varian/spesialisasi spesifik (misal: 'dokter umum dan gigi', 'washer kiloan dan washer satuan')
  const pairRegex = new RegExp(`\\b(${baseKeywords})\\s+([a-zA-Z0-9\\-_]+(?:\\s+[a-zA-Z0-9\\-_]+)?)\\s*(?:,\\s*dan|,\\s*serta|,\\s*atau|dan|serta|atau|/|,)\\s*(?:(?:(${baseKeywords})\\s+)?([a-zA-Z0-9\\-_]+(?:\\s+[a-zA-Z0-9\\-_]+)?))`, 'gi');
  let pairMatch;
  while ((pairMatch = pairRegex.exec(allText)) !== null) {
    const base1 = pairMatch[1];
    const spec1 = pairMatch[2]?.trim();
    const base2 = pairMatch[3] || base1;
    const spec2 = pairMatch[4]?.trim();

    if (spec1 && !/^(dan|atau|serta|dengan|untuk|yang|di|ke|dari|adalah|yaitu)$/i.test(spec1)) {
      addVariant(`${base1} ${spec1}`);
    }
    if (spec2 && !/^(dan|atau|serta|dengan|untuk|yang|di|ke|dari|adalah|yaitu)$/i.test(spec2)) {
      addVariant(`${base2} ${spec2}`);
    }
  }

  return Array.from(variantsMap.values());
}

// Helper: Ekstraksi Brief Kebutuhan dan Daftar Peran Resmi dari Riwayat Chat (Poin 44 & 45)
function extractBriefAndRolesFromHistory(chatHistory: any[]): {
  rawBrief: string;
  roles: string[];
  publicRole: string | null;
  staffRoles: string[];
  roleLandingTabs: Record<string, string>; // role -> tab ID default
} {
  const briefMsgs = (chatHistory || []).filter((m: any) => 
    m.text && (
      m.text.includes('Brief Kebutuhan') ||
      (m.text.includes('Nama App:') && m.text.includes('Fitur Utama')) ||
      m.text.includes('Job Description') ||
      m.text.includes('Struktur Halaman')
    )
  );
  const lastBriefMsg = briefMsgs[briefMsgs.length - 1]?.text || '';
  
  // Bersihkan teks brief dari sapaan pembuka dan pertanyaan konfirmasi penutup
  let rawBrief = lastBriefMsg;
  const briefMarkerIndex = lastBriefMsg.search(/📋\s*\*\*Brief Kebutuhan\*\*|\*\*Brief Kebutuhan\*\*/i);
  if (briefMarkerIndex !== -1) {
    rawBrief = lastBriefMsg.substring(briefMarkerIndex);
    const closingMatch = rawBrief.search(/\n\s*(Apakah\s+(?:lembar\s+)?Brief\s+Kebutuhan|Apakah\s+ada\s+detail|Silakan\s+konfirmasi)/i);
    if (closingMatch !== -1) {
      rawBrief = rawBrief.substring(0, closingMatch).trim();
    }
  }

  let roles: string[] = [];
  let publicRole: string | null = null;

  if (lastBriefMsg) {
    rawBrief = standardizeBriefRoleNames(rawBrief);
    // Cari section Job Description & Struktur Halaman.
    // Catatan: lookahead memakai [ \t]* (bukan \s*) agar tidak menelan baris baru
    // dan mengosongkan isi section.
    const jobDescMatch = lastBriefMsg.match(/(?:Job Description|Struktur Halaman)[^\n]*\n([\s\S]*?)(?=\n[ \t]*(?:Apakah|Fitur Utama|Roadmap|Fitur Unik|Catatan(?: Tambahan)?|Saran)|\n[ \t]*-[ \t]*\*\*Catatan|$)/i);
    const jobDescText = jobDescMatch ? jobDescMatch[1] : lastBriefMsg;
    
    // Cari baris-baris peran: * **RoleName**: atau - **RoleName**: atau 1. **RoleName**:
    const roleLineRegex = /(?:\*|-|\d+\.)\s+\*\*\[?([^\]:\*\n]+)\]?\*\*\s*:/g;
    let m: RegExpExecArray | null;
    const forbiddenKeywords = [
      'nama app', 'nama aplikasi', 'orientasi ui', 'tema visual', 'tier aplikasi',
      'pola proses bisnis', 'kekhasan industri', 'entitas data', 'state utama',
      'transisi inti', 'aturan bisnis', 'edge case', 'komponen wajib', 'saran',
      'fitur menyusul', 'catatan tambahan',
      'nama peran', 'nama role', 'role 1', 'role 2', 'role 3', 'peran 1', 'peran 2', 'peran 3',
      'alur proses', 'alur', 'job description', 'struktur halaman', 'fitur utama', 'roadmap', 'catatan', 'fitur unik', 'halaman utama'
    ];
    while ((m = roleLineRegex.exec(jobDescText)) !== null) {
      let roleName = m[1].trim();
      // Bersihkan kata awalan jika ada
      roleName = roleName.replace(/^(?:Role|Peran)\s+/i, '').replace(/\s*\(.*?\)$/, '').trim();
      const isForbidden = forbiddenKeywords.some(k => roleName.toLowerCase().startsWith(k));
      if (roleName && !isForbidden && !roles.some(r => r.toLowerCase() === roleName.toLowerCase())) {
        roles.push(roleName);
      }
    }

    // Fallback: Jika belum ada role yang ditemukan dari Job Description, cari di bagian Target Pengguna / Peran
    if (roles.length === 0) {
      const targetRoleMatch = lastBriefMsg.match(/(?:Target Pengguna|Peran Pengguna|Daftar Peran)[^\n]*\n([\s\S]*?)(?=\n[ \t]*(?:Apakah|Fitur Utama|Roadmap|Job Description)|\n[ \t]*-[ \t]*\*\*Catatan|$)/i);
      const targetText = targetRoleMatch ? targetRoleMatch[1] : lastBriefMsg;
      const genericRoleRegex = /(?:\*|-|\d+\.)\s+\*\*\[?([^\]:\*\n]+)\]?\*\*\s*:/g;
      while ((m = genericRoleRegex.exec(targetText)) !== null) {
        let roleName = m[1].trim();
        roleName = roleName.replace(/^(?:Role|Peran)\s+/i, '').replace(/\s*\(.*?\)$/, '').trim();
        const isForbidden = forbiddenKeywords.some(k => roleName.toLowerCase().startsWith(k));
        if (roleName && !isForbidden && !roles.some(r => r.toLowerCase() === roleName.toLowerCase())) {
          roles.push(roleName);
        }
      }
    }
  }

  // Super Admin adalah role sistem wajib, termasuk saat brief awal belum menyebutkannya.
  roles = ensureRequiredSystemRole(roles);

  // Tentukan apakah ada peran publik (Pasien, Pelanggan, Customer, Tamu, Publik, dll)
  for (const r of roles) {
    if (/^(pasien|pelanggan|customer|tamu|guest|publik|client)/i.test(r)) {
      publicRole = r;
      break;
    }
  }

  const staffRoles = roles.filter(r => r !== publicRole);

  // Ekstrak landing tab ID per role dari Brief Kebutuhan (Poin 53)
  // Format Brief: "* **RoleName** (Akses Publik - Tampilan Awal):" atau "* **RoleName**:"
  // Diikuti: "- [Halaman/Tab 1] (default): section Nama" atau "- [Halaman 1] (default): ..."
  const roleLandingTabs: Record<string, string> = {};
  for (const role of roles) {
    const escapedRole = role.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Cari blok teks dari header role sampai role berikutnya
    const roleBlockRegex = new RegExp(
      `\\*\\s+\\*\\*\\[?${escapedRole}[^\\]:\\*\\n]*\\]?\\*\\*[^\n]*\n([\\s\\S]*?)(?=\\n\\s*\\*\\s+\\*\\*[^\\*]|\\n\\s*Apakah|\\n\\s*(?:Roadmap|Catatan|Fitur Unik)|$)`, 'i'
    );
    const roleBlockMatch = lastBriefMsg.match(roleBlockRegex);
    if (roleBlockMatch) {
      const block = roleBlockMatch[1];
      // Cari tab default: baris "- [Halaman/Tab N] (default):" atau "- Tab default:"
      const defaultTabMatch = block.match(/\[(?:Halaman|Tab)\s*(\d+|[A-Za-z]+)\]\s*\(default\)\s*:\s*section\s+([^\n,]+)/i) ||
                              block.match(/\[(?:Halaman|Tab)\s*(\d+|[A-Za-z]+)\]\s*\(default\)/i);
      if (defaultTabMatch) {
        // Buat ID tab dari nama section/role (slug format)
        const sectionName = (defaultTabMatch[2] || role).trim().toLowerCase()
          .replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-');
        roleLandingTabs[role] = sectionName;
      } else {
        // Fallback: gunakan slug dari nama role (untuk staf) atau 'public' untuk publik role
        const isPublic = /^(pasien|pelanggan|customer|tamu|guest|publik|client)/i.test(role);
        roleLandingTabs[role] = isPublic
          ? role.toLowerCase().replace(/[^a-z0-9]/g, '')
          : role.toLowerCase().replace(/[^a-z0-9]/g, '');
      }
    } else {
      roleLandingTabs[role] = role.toLowerCase().replace(/[^a-z0-9]/g, '');
    }
  }

  return { rawBrief: lastBriefMsg, roles, publicRole, staffRoles, roleLandingTabs };
}

// Helper: Strip blok ```html ... ``` dari pesan AI di chatHistory sebelum dikirim ke model
// Mencegah payload membengkak dengan HTML prototipe yang bisa mencapai 50-100KB per pesan.
function stripHtmlFromHistory(history: any[]): any[] {
  return (history || []).map((m: any) => {
    if (m.sender !== 'AI' || !m.text?.includes('```html')) return m;
    return {
      ...m,
      text: m.text.replace(/```html[\s\S]*?```/g, '[Kode HTML prototipe sebelumnya telah digenerate — gunakan kode terkini di Canvas Preview]')
    };
  });
}

export async function POST(req: Request) {
  try {
    // 1. Auth Check — wajib login untuk menggunakan AI generator
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Anda harus login terlebih dahulu untuk menggunakan AI generator.' },
        { status: 401 }
      );
    }

    // 2. Rate Limiting Check — per user ID (persistent, tidak reset saat redeploy)
    const forwardedFor = req.headers.get('x-forwarded-for');
    const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1';
    const rateLimitIdentifier = user.id || clientIp;
    const rateLimit = await checkRateLimit(rateLimitIdentifier);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Batas kuota request tercapai. Mohon tunggu ${rateLimit.resetInSeconds} detik sebelum mencoba kembali.`
        },
        { status: 429 }
      );
    }

    const { prompt, chatHistory, stage, currentCode, userProvider, userApiKey, userModel, mode, sessionState: incomingSession } = await req.json();

    // Deteksi Mode Dropdown Chat ('BUILD' | 'PLAN' | 'SYNC_GAS')
    const activeChatMode = (mode || (stage === 'TAHAP_4_BACKEND' ? 'SYNC_GAS' : (stage === 'TAHAP_2_MOCKUP' || stage === 'TAHAP_5_PATCH' || currentCode) ? 'BUILD' : 'PLAN')).toUpperCase();
    const isPlanMode = activeChatMode === 'PLAN';

    // Analisis Riwayat & Konteks Percakapan Tahap 1
    const allHistoryText = (chatHistory || []).map((m: any) => m.text).join('\n');
    const hasBriefPresented = allHistoryText.includes('Brief Kebutuhan') || (allHistoryText.includes('Nama App:') && allHistoryText.includes('Fitur Utama (V1)'));

    // POIN C: Prioritaskan data terstruktur dari session guided interview jika tersedia.
    // Session sudah terbentuk oleh /api/guided yang kaya konteks (roles.selected, compiledBrief, flow, rbac, dll).
    // Fallback ke re-parsing chat history hanya jika session belum ada (user lama / belum selesai guided).
    let approvedBrief: string;
    let officialRoles: string[];
    let publicRole: string | null;
    let staffRoles: string[];
    let roleLandingTabs: Record<string, string>;

    const hasStructuredSession = Boolean(
      incomingSession &&
      incomingSession.roles?.selected &&
      incomingSession.roles.selected.length > 0
    );

    if (hasStructuredSession) {
      // Jalur POIN C: Gunakan data terstruktur dari session — lebih akurat, tidak perlu regex
      officialRoles = incomingSession.roles.selected as string[];
      approvedBrief = incomingSession.compiledBrief || '';
      console.log(`[POIN C] Menggunakan session terstruktur: ${officialRoles.length} roles, compiledBrief: ${approvedBrief.length} chars`);

      // Tentukan publicRole & staffRoles dari officialRoles
      publicRole = officialRoles.find(r => /^(pasien|pelanggan|customer|tamu|guest|publik|client)/i.test(r)) || null;
      staffRoles = officialRoles.filter(r => r !== publicRole);

      // Bangun roleLandingTabs dari session atau fallback ke slug sederhana
      roleLandingTabs = {};
      for (const role of officialRoles) {
        roleLandingTabs[role] = role.toLowerCase().replace(/[^a-z0-9]/g, '');
      }

      // Jika compiledBrief kosong tapi ada chatHistory yang punya brief, pakai fallback parsing sebagai supplement
      if (!approvedBrief && hasBriefPresented) {
        const parsed = extractBriefAndRolesFromHistory(chatHistory);
        approvedBrief = parsed.rawBrief;
      }
    } else {
      // Jalur fallback lama: parse ulang teks chat history
      const parsed = extractBriefAndRolesFromHistory(chatHistory);
      approvedBrief = parsed.rawBrief;
      officialRoles = parsed.roles;
      publicRole = parsed.publicRole;
      staffRoles = parsed.staffRoles;
      roleLandingTabs = parsed.roleLandingTabs;
      if (officialRoles.length > 0) {
        console.log(`[Fallback] Menggunakan ekstraksi chat history: ${officialRoles.length} roles`);
      }
    }

    // Resolusi nama role Owner dinamis dari session
    const ownerRole = incomingSession?.roles?.ownerRole || incomingSession?.roles?.wajib?.[0] || officialRoles[0] || 'Super Admin';

    // Ekstraksi RBAC Modul dari session (Bagian B)
    let sessionRbacModul: any[] = [];
    if (incomingSession?.rbac?.modul && Array.isArray(incomingSession.rbac.modul) && incomingSession.rbac.modul.length > 0) {
      sessionRbacModul = incomingSession.rbac.modul;
    }

    // Jika ada sessionRbacModul dan approvedBrief belum memuat matriks RBAC, masukkan tabelnya
    if (sessionRbacModul.length > 0 && (!approvedBrief || !approvedBrief.includes('Matriks Hak Akses (RBAC)'))) {
      const tableMd = incomingSession?.rbac?.markdownTable || renderRbacMarkdownTable(officialRoles, sessionRbacModul, incomingSession?.rbac?.catatanPelimpahan);
      if (tableMd) {
        approvedBrief = approvedBrief
          ? `${approvedBrief}\n\n- **Matriks Hak Akses (RBAC) per Modul Fungsional**:\n${tableMd}`
          : `- **Matriks Hak Akses (RBAC) per Modul Fungsional**:\n${tableMd}`;
      }
    }

    // Ekstraksi skema data tabel dari session (SUMBER KEBENARAN field form CRUD)
    const sessionDataSchema = incomingSession?.dataSchema;
    const sessionSimulasiDb = incomingSession?.simulasiDb;
    const schemaMarkdownBlock = sessionDataSchema?.tabel && sessionDataSchema.tabel.length > 0
      ? (sessionDataSchema.markdownTable || renderDataSchemaMarkdown(sessionDataSchema.tabel, sessionDataSchema.korelasiRingkas))
      : null;
    // Bangun peta relasi: field bertipe "relasi ke X" → daftar kandidat label dari simulasiDb
    const relasiFieldMap: Record<string, { label: string; id: string }[]> = {};
    if (sessionDataSchema?.tabel && sessionSimulasiDb?.tabel) {
      for (const tbl of sessionDataSchema.tabel) {
        for (const fld of (tbl.field || [])) {
          const relasiMatch = fld.tipe?.match(/relasi ke\s+([\w_]+)/i);
          if (relasiMatch) {
            const targetNama = relasiMatch[1].toLowerCase();
            const targetTbl = sessionSimulasiDb.tabel.find((t: any) =>
              t.nama?.toLowerCase() === targetNama ||
              t.nama?.toLowerCase().replace(/^(tb_|tbl_|t_)/, '') === targetNama
            );
            if (targetTbl && Array.isArray(targetTbl.baris) && targetTbl.baris.length > 0) {
              const sample = targetTbl.baris[0];
              const idKey = Object.keys(sample).find(k => k === 'id' || /^id_/.test(k)) || Object.keys(sample)[0];
              const labelKey = Object.keys(sample).find(k =>
                /nama|title|judul|name/i.test(k)
              ) || Object.keys(sample).find(k => k !== idKey) || idKey;
              relasiFieldMap[`${tbl.nama}.${fld.nama}`] = targetTbl.baris.slice(0, 8).map((row: any) => ({
                id: String(row[idKey] ?? ''),
                label: String(row[labelKey] ?? row[idKey] ?? '')
              }));
            }
          }
        }
      }
    }

    // Deteksi Permintaan Penyesuaian Skenario / Update Brief oleh Pengguna
    const isAdjustScenarioRequest = /(sesuaikan\s+skenario|penyesuaian\s+skenario|update\s+brief|perbarui\s+brief|simpan\s+catatan|sesuaikan\s+alur|saya\s+telah\s+(?:menyesuaikan|mengubah)\s+rincian\s+brief)/i.test(prompt);

    // Deteksi Persetujuan/Konfirmasi Pengguna terhadap Brief Kebutuhan atau Permintaan Pembuatan Prototipe
    const isConfirmationApproval = !isAdjustScenarioRequest && (
      /(^|\b)(ok|oke|sip|setuju|lanjut|lanjutkan|siap|deal|sudah sesuai|sesuai|buatkan|buatkan sekarang|bikin sekarang|gas|kerjakan|terapkan|eksekusi|ganti sekarang|ubah sekarang|update sekarang|buat|bikin|generate|mulai)($|\b)/i.test(prompt.trim()) ||
      /(buatkan|buat|bikin|generate|mulai|kembangkan)\s*(prototype|prototipe|aplikasi|app|kodenya|kode)/i.test(prompt.trim()) ||
      prompt.toLowerCase().includes('buatkan prototipe') ||
      prompt.toLowerCase().includes('buat prototipe') ||
      prompt.toLowerCase().includes('menyetujui skenario')
    );

    // GATE ALUR PLAN VS BUILD:
    // Jika brief sudah selesai disepakati/dikonfirmasi tetapi user MASIH berada di mode PLAN:
    // Prototipe TIDAK BOLEH dibuat. AI wajib meminta user mengganti mode ke BUILD di dropdown.
    const isBriefApprovedWhileInPlanMode = Boolean(hasBriefPresented && isConfirmationApproval && isPlanMode);

    // =============================================================================
    // HARD ARCHITECTURAL GUARD: DILARANG MEMBUAT PROTOTIPE BARU SEBELUM GUIDED INTERVIEW SELESAI
    // =============================================================================
    // Prototipe baru (currentCode kosong) HANYA boleh dibuat jika user telah menyelesaikan
    // seluruh Guided Interview hingga REVIEW_FINAL dengan statusKonfirmasi: 'disetujui'.
    // Sesi baru yang langsung meminta 'buatkan aplikasi X' tanpa alur interview WAJIB DITOLAK.
    const isAttemptingNewPrototype = !currentCode && (
      stage === 'TAHAP_2_MOCKUP' ||
      activeChatMode === 'BUILD' ||
      isConfirmationApproval
    );

    if (isAttemptingNewPrototype) {
      const isApprovalMessage =
        prompt.includes('Saya menyetujui Brief Kebutuhan') ||
        prompt.includes('menyetujui Brief Kebutuhan') ||
        prompt.includes('menyetujui skenario');

      const isGuidedApproved = Boolean(
        incomingSession &&
        incomingSession.step === 'REVIEW_FINAL' &&
        (incomingSession.statusKonfirmasi === 'disetujui' ||
         incomingSession.review?.statusKonfirmasi === 'disetujui' ||
         incomingSession.reviewFinalApproved === true ||
         Boolean(incomingSession.compiledBrief) ||
         isApprovalMessage)
      );

      if (!isGuidedApproved) {
        console.warn(`[GUARD BLOCKED] Pembuatan prototipe baru ditolak: sesi belum melewati REVIEW_FINAL yang disetujui.`);
        const activeStep = (incomingSession && incomingSession.step) ? incomingSession.step : 'STORYTELLING';
        const stepNameMap: Record<string, string> = {
          STORYTELLING: 'Cerita & Konsep Bisnis',
          ROLE: 'Role & Tanggung Jawab',
          ALUR: 'Alur Kerja Operasional',
          RBAC: 'Hak Akses (RBAC)',
          SKEMA_DATA: 'Skema Tabel & Data',
          SIMULASI_DB: 'Simulasi Database & Akun Demo',
          REVIEW_FINAL: 'Ringkasan Akhir (Review Final)'
        };
        const stepName = stepNameMap[activeStep] || activeStep;

        return NextResponse.json({
          success: false,
          error: `Pembuatan prototipe baru hanya dapat dilakukan setelah menyelesaikan seluruh tahapan perencanaan (Guided Interview) hingga Ringkasan Akhir disetujui.\n\nSaat ini proses perencanaan Anda berada di tahap: **${stepName}**.\n\nSilakan selesaikan tahapan tersebut terlebih dahulu melalui tombol arahan di bawah:`,
          needsGuidedInterview: true,
          currentStep: activeStep,
          stepName,
          suggestedActions: [
            {
              id: 'resume_step',
              label: `▶️ Lanjutkan dari Tahap ${stepName}`,
              targetStep: activeStep
            },
            {
              id: 'restart_guided',
              label: '🔄 Mulai dari Awal (Cerita Bisnis)',
              targetStep: 'STORYTELLING'
            }
          ]
        }, { status: 400 });
      }
    }
    
    // Deteksi Pertanyaan Eksplisit dari Pengguna (Wajib dijawab dalam dialog, dilarang langsung lompat ke eksekusi - Poin 38)
    const hasExplicitQuestion = prompt.includes('?') || /(^|\b)(apakah|apa\s+kamu\s+paham|paham\s+kah|paham\s+gak|paham\s+kan|ngerti\s+gak|ngerti\s+kan|bisa\s+kah|gimana\s+menurutmu|bagaimana\s+menurutmu|menurut\s+kamu|kenapa|mengapa|bagaimana\s+cara|tolong\s+jelaskan|apa\s+maksud|apakah\s+bisa|jelaskan)($|\b)/i.test(prompt.trim());

    // Deteksi Revisi Signifikan / Perubahan Arsitektur Besar (Poin 38)
    const isSignificantRevision = (
      hasExplicitQuestion ||
      /(ganti|ubah|rombak|bikin|buat)\s+(sistem\s+login|mekanisme\s+role|role\s+switcher|arsitektur|seluruh\s+role|struktur\s+utama)/i.test(prompt) ||
      /(tambah|kurang|hapus|ganti)\s+role/i.test(prompt) ||
      /(sistem\s+login\s+sungguhan|login\s+asli|multi\s+role\s+baru|rombak\s+total)/i.test(prompt) ||
      (prompt.length > 220 && (prompt.toLowerCase().includes('role') || prompt.toLowerCase().includes('halaman') || prompt.toLowerCase().includes('fitur')))
    );

    const userMessageCount = (chatHistory || []).filter((m: any) => m.sender === 'USER').length;
    // Deteksi Persetujuan Ringkas Pengguna terhadap Usulan Konsultan di Tahap Diskusi
    const isUserAgreeingToProposal = /(^|\b)(ya|iya|sudah|pas|cocok|setuju|ok|oke|sip|lanjut|bisa|sesuai|siap|cukup|ikut saja|terserah|sop|standar|buatkan|buatkan brief|rangkum)($|\b)/i.test(prompt.trim());

    // Super Admin adalah role wajib platform; AI tidak perlu menawarkannya
    // sebagai pertanyaan tambahan atau menunggu persetujuan pengguna.
    const shouldAskAdminFirst = false;

    // Deteksi Apakah Prompt Awal Pengguna BENAR-BENAR SANGAT DETAIL:
    // WAJIB panjang > 200 karakter DAN secara eksplisit merinci target peran/user/masalah DAN daftar fitur/alur secara bersamaan.
    const isVeryDetailedInitialPrompt = !shouldAskAdminFirst && prompt.length > 200 && (
      (prompt.toLowerCase().includes('target') || prompt.toLowerCase().includes('user') || prompt.toLowerCase().includes('pengguna') || prompt.toLowerCase().includes('pasien') || prompt.toLowerCase().includes('petugas') || prompt.toLowerCase().includes('admin') || prompt.toLowerCase().includes('masalah')) &&
      (prompt.toLowerCase().includes('fitur') || prompt.toLowerCase().includes('alur') || prompt.toLowerCase().includes('menu') || prompt.toLowerCase().includes('tabel') || prompt.toLowerCase().includes('layanan'))
    );

    // Kapan masuk Mode Dialog/Streaming (Bukan eksekusi kode langsung):
    // 1. Stage bukan TAHAP_2_MOCKUP / TAHAP_5_PATCH (keduanya khusus eksekusi kode prototipe)
    // 2. Mode PLAN aktif (selalu dialog ideation/planning, dilarang buat kode di mode ini)
    // 3. Tahap 1 Ideation (belum ada kode & belum konfirmasi di mode BUILD)
    // 4. ATAU Tahap Revisi (sudah ada kode) TETAPI ada Pertanyaan Eksplisit atau Revisi Signifikan yang belum disetujui untuk dieksekusi (Poin 38)
    const isIdeationMode = (
      !['TAHAP_2_MOCKUP', 'TAHAP_3_REVIEW', 'TAHAP_5_PATCH'].includes(stage) && (
        isPlanMode ||
        (!currentCode && !(hasBriefPresented && isConfirmationApproval)) ||
        (Boolean(currentCode) && isSignificantRevision && !isConfirmationApproval)
      )
    );

    // Alokasi budget token streaming ideation yang universal, aman, & anti-terpotong:
    // Dalam protokol SSE streaming, max_completion_tokens adalah batas atas (ceiling).
    // Pesan eksplorasi pendek (2-4 kalimat) tetap selesai instan (< 1.6s TTFT), sementara lembar Brief Kebutuhan multi-role
    // mendapatkan ruang yang leluasa hingga 3584 tokens tanpa risiko terpotong di tengah jalan.
    const ideationMaxTokens = 3584;

    // SEMUA TEMPLATE & REFERENSI STATIS DIMATIKAN SESUAI INSTRUKSI PENGGUNA
    // Menggunakan 100% Pure AI Reasoning agar nama aplikasi, identitas, peran, dan modul
    // sepenuhnya mencerminkan kebutuhan asli pengguna (misal: "Aplikasi Penitipan Kucing" dengan icon 🐱/🐾,
    // BUKAN "Aplikasi Perhotelan & Pariwisata" dengan icon hotel 🏨).
    const pureAIGuidance = `
=== ATURAN MUTLAK SISTEM: 100% PURE AI REASONING (SEMUA TEMPLATE & REFERENSI STATIS DINONAKTIFKAN) ===
1. ANALISIS KEBUTUHAN PENGGUNA SECARA MURNI & SPESIFIK:
   - Analisis topik, model bisnis, dan kebutuhan pengguna murni menggunakan kecerdasan AI, BUKAN dari template kaku atau kategori umum yang melenceng (contoh: "penitipan kucing" BUKAN perhotelan manusia, "laundry" BUKAN salon kecantikan).
2. NAMA APLIKASI & IDENTITAS VISUAL 100% RELEVAN:
   - Nama aplikasi WAJIB BENAR-BENAR SPESIFIK dan SESUAI BISNIS PENGGUNA (contoh: jika pengguna meminta penitipan kucing, nama aplikasi WAJIB bertema penitipan kucing seperti "Aplikasi Penitipan Kucing", "PawsStay Cat Care", atau "MeowBoarding", dengan icon yang sangat relevan seperti 🐱 atau 🐾).
   - DILARANG KERAS menamai aplikasi dengan kategori umum/template yang salah (seperti "Aplikasi Perhotelan & Pariwisata", "Aplikasi Rental", dsb.) atau memakai icon hotel 🏨!
3. KOREKSI NAMA DI KODE/PROTOTIPE JIKA DI RIWAYAT ADA JUDUL TEMPLATE SALAH:
   - Jika pada riwayat chat sebelumnya atau Brief sebelumnya sempat tercatat nama aplikasi dari template lama yang keliru (seperti "Aplikasi Perhotelan & Pariwisata" untuk penitipan kucing), Anda WAJIB MENGOREKSI dan MENGGANTI nama aplikasi tersebut dengan nama yang benar-benar sesuai dengan ide bisnis pengguna saat ini ("Aplikasi Penitipan Kucing") baik pada judul login (#loginScreen h1), header aplikasi, maupun judul tab!
4. PERAN OPERASIONAL & WORKFLOW ALAMI DARI BISNIS:
   - Rancang peran-peran operasional nyata yang sesuai dengan domain bisnis tersebut secara spesifik (selalu sediakan "Super Admin" sebagai pengelola akun staf & sistem, ditambah peran operasional bisnis nyata, contoh untuk penitipan kucing: Petugas Penitipan, Dokter Hewan, dan Pelanggan / Pemilik Kucing).
   - Buat tab navigasi, formulir entri data, tabel interaktif (3-5 baris data contoh realistis), dan alur operasional yang 100% selaras dengan bisnis pengguna tersebut.
`;

    // Ekstraksi Entitas & Varian Role Khusus dari Prompt Pengguna (Poin 50B)
    const userSpecifiedVariants = extractUserSpecifiedRoleVariants(prompt, chatHistory);
    let variantsContext = '';
    if (userSpecifiedVariants.length > 0) {
      variantsContext = `\n\n=== ENTITAS / VARIAN ROLE SPESIFIK DARI PENGGUNA (WAJIB DIPERTAHANKAN UTUH — POIN 50B) ===
Pengguna secara spesifik menyebutkan entitas/varian peran berikut:
${userSpecifiedVariants.map(v => `- ${v}`).join('\n')}

ATURAN MUTLAK PERLAKUAN VARIAN ROLE:
1. Anda WAJIB menyertakan SEMUA entitas/spesialisasi di atas sebagai role mandiri dan terpisah di dalam usulan peran Anda.
2. DILARANG KERAS menggabungkan atau menggeneralisasi peran-peran spesifik tersebut menjadi 1 peran umum (contoh: "Dokter Umum" dan "Dokter Gigi" TIDAK BOLEH digabung jadi hanya "Dokter"; "Washer Kiloan" dan "Washer Satuan" TIDAK BOLEH digabung jadi hanya "Washer"; "Kasir Toko Fisik" dan "Admin Online Shop" TIDAK BOLEH digabung).
3. Jika pengguna menyebutkan varian ini, jangan menolak atau menyederhanakannya, melainkan berikan breakdown tugas spesifik untuk masing-masing varian tersebut.`;
    }

    let systemPrompt = '';

    if (isIdeationMode) {
      if (isBriefApprovedWhileInPlanMode) {
        // KONDISI KHUSUS: BRIEF SUDAH LENGKAP & DISETUJUI, TETAPI MODE INPUT MASIH 'PLAN'
        // Sistem menolak membuat prototipe dan meminta user mengganti mode ke BUILD
        const appTitle = extractAppTitleFromChat(chatHistory) || 'ini';
        systemPrompt = `Anda adalah Konsultan Aplikasi AI dari platform "Mudah Bikin Aplikasi".
Pengguna baru saja menyetujui lembar Brief Kebutuhan atau meminta agar prototipe aplikasi dibuat.
Namun, sistem mendeteksi bahwa dropdown mode saat ini MASIH berada di mode "Plan (Brief Kebutuhan)".

ATURAN KERJA SISTEM:
1. Mode "Plan" hanya difungsikan untuk berdiskusi, merancang ide, dan menyusun lembar Brief Kebutuhan.
2. Di mode "Plan", sistem TIDAK DAPAT dan DILARANG menghasilkan kode prototipe aplikasi.
3. Pembuatan kode prototipe HANYA DAPAT DILAKUKAN jika pengguna telah mengganti mode pengerjaan ke "Build (Prototype)" pada dropdown di samping kolom chat.
4. Selama mode masih "Plan", Anda DILARANG KERAS membuat prototipe ataupun menghasilkan blok kode HTML/CSS/JS!

TUGAS ANDA PADA GILIRAN INI (WAJIB DIPATUHI DENGAN RAMAH, TEGAS & JELAS):
1. Berikan apresiasi hangat bahwa penyusunan Brief Kebutuhan untuk aplikasi "${appTitle}" sudah selesai dan disepakati.
2. Jelaskan bahwa Anda sudah siap membangun aplikasi ini, TETAPI karena dropdown chat saat ini masih dalam mode "Plan (Brief)", prototipe belum dapat dibuat.
3. Berikan instruksi jelas kepada pengguna:
   "Silakan ubah dropdown mode di samping kolom chat dari **Plan (Brief)** menjadi **🛠️ Build (Prototype)**, lalu tekan tombol kirim atau konfirmasi untuk mulai membangun prototipe aplikasi Anda."
4. Ingatkan bahwa pemisahan mode Plan dan Build ini diterapkan agar perencanaan kebutuhan matang terlebih dahulu sebelum kode mulai ditulis.
5. DILARANG KERAS menghasilkan blok kode HTML, CSS, JavaScript (\`\`\`html ... \`\`\`) di giliran ini!`;
      } else if (Boolean(currentCode) && isSignificantRevision && !isConfirmationApproval) {
        // KONDISI KHUSUS (POIN 38): GERBANG DIALOG UNTUK REVISI SIGNIFIKAN / PERTANYAAN EKSPLISIT SAAT MOCKUP SUDAH ADA
        systemPrompt = `Anda adalah Konsultan Aplikasi & Asisten AI dari platform "Mudah Bikin Aplikasi".
Pengguna memiliki aplikasi/mockup yang sudah dibuat, dan saat ini mengajukan PERTANYAAN EKSPLISIT atau REVISI BESAR/STRUKTURAL (misal: mengganti mekanisme role switcher jadi sistem login sungguhan, menambah/menghapus role, perombakan alur, dll).

TUGAS ANDA PADA GILIRAN INI (WAJIB DIPATUHI):
1. JAWAB PERTANYAAN EKSPLISIT PENGGUNA TERLEBIH DAHULU:
   - Jika pengguna bertanya "apakah kamu paham?", "bagaimana menurutmu?", atau pertanyaan lain, jawab secara langsung, lugas, ramah, dan percaya diri (1-2 kalimat pembuka).
2. RANGKUM & KONFIRMASI PEMAHAMAN ANDA TENTANG REVISI YANG AKAN DILAKUKAN:
   - Jelaskan secara singkat dan konkret apa saja perubahan arsitektural/fitur yang akan diterapkan ke aplikasi (misal: merinci role baru, hak akses masing-masing role, atau alur login yang akan dibangun).
   - Jika ada hal yang perlu diperjelas atau disesuaikan, tanyakan secara spesifik.
3. AJUKAN PERTANYAAN KONFIRMASI EKSEKUSI DI AKHIR:
   - "Apakah rencana perubahan ini sudah sesuai dan siap saya terapkan ke aplikasi Anda?"
4. ATURAN MUTLAK:
   - DILARANG KERAS menghasilkan blok kode HTML/JS (\`\`\`html ... \`\`\`) di giliran ini!
   - Jangan langsung eksekusi kode sebelum pengguna mengonfirmasi persetujuannya.`;
      } else if (hasBriefPresented && !isConfirmationApproval) {
        // KONDISI 2: BRIEF KEBUTUHAN SUDAH TAMPIL, PENGGUNA MEMBERIKAN REVISI KECIL / DETAIL
        systemPrompt = `Anda adalah Konsultan Aplikasi AI dari platform "Mudah Bikin Aplikasi".
Tugas Anda: Memperbarui lembar "Brief Kebutuhan" secara LENGKAP & UTUH berdasarkan revisi dari pengguna dan meminta konfirmasi ulang.

ATURAN REVISI BRIEF KEBUTUHAN (WAJIB DIPATUHI — POIN 46 & 51):
1. WAJIB GENERATE ULANG SELURUH LEMBAR SECARA UTUH DARI AWAL:
   - DILARANG memotong teks atau hanya menampilkan potongan yang direvisi saja.
   - Susun ulang seluruh lembar Brief Kebutuhan dari 📋 **Brief Kebutuhan** sampai baris pertanyaan penutup.
   - PERTAHANKAN seluruh nama peran, halaman, section, dan alur proses dari Brief sebelumnya yang TIDAK diminta berubah.
2. STRUKTUR ROLE & ALUR PROSES WAJIB LENGKAP PADA SETIAP ROLE (POIN 51):
   - SETIAP role WAJIB memiliki minimal 1 baris Halaman/Tab DAN 1 baris "- **Alur Proses**: ...".
   - MULTI-TAB ALUR PROSES (POIN 51): Jika role memiliki 2 tab/halaman atau lebih, Alur Proses WAJIB melibatkan perpindahan antar-tab (contoh: [Aksi Tab 1] → [Status Tab 1] → Buka tab "[Nama Tab 2]" (Tab 2) → [Efek/Data di Tab 2] → Klik "[Tombol Tab 2]" → status "[Nilai Akhir]"), ATAU jika alurnya terpisah tuliskan 2 sub-baris: "- **Alur Proses Tab 1**: ..." dan "- **Alur Proses Tab 2**: ...". Batasi maksimal 6-8 langkah total.
   - DILARANG KERAS memisahkan "Alur Proses" menjadi heading role tersendiri (format '* **Alur Proses**:'). Alur proses SELALU menjadi anak (sub-item) dengan indentasi strip (-) di bawah role terkait.
   - DILARANG membuat heading role kosong.
3. ATURAN MUTLAK SIKLUS OPERASIONAL DUA SISI & KELENGKAPAN EVENT/ACTION (TWO-WAY BUSINESS LIFECYCLE):
   - DILARANG KERAS membuat alur operasional yang "buntung" (hanya satu sisi):
     * SEWA / RENTAL / PEMINJAMAN (Sepeda, Mobil, Motor, Buku, Kamera, dll):
       WAJIB LENGKAP DUA SISI:
       a. Sisi Pinjam/Sewa (Check-out): Data penyewa, unit barang yang dipilih, durasi sewa, tanggal kembali, uang jaminan/deposit. Action: \`onclick: Catat Peminjaman / Mulai Sewa Unit\`. Status unit berubah dari "Tersedia" menjadi "Sedang Disewa".
       b. Sisi Pengembalian (Check-in & Denda — WAJIB ADA): Form pengembalian barang, pemeriksaan kondisi fisik (Bagus / Lecet / Rusak), kalkulasi denda otomatis jika terlambat, penyelesaian uang deposit, tombol \`onclick: Selesaikan Pengembalian & Cek Fisik\`, \`onclick: Hitung Denda Keterlambatan\`. Status unit otomatis kembali jadi "Tersedia".
     * JASA / SERVICE / BENGKEL / LAUNDRY:
       WAJIB ADA: Penerimaan/Antrean -> Pengerjaan -> QC Selesai -> Penyerahan/Kasir Pembayaran.
     * TRANSAKSI JUAL-BELI / POS:
       WAJIB ADA: Pilih Produk/Keranjang -> Kasir Pembayaran, Cetak Struk, dan Pengurangan Stok Otomatis.
     * BOOKING / RESERVASI:
       WAJIB ADA: Booking Jadwal/Slot -> Check-in Kedatangan / Verifikasi Tamu.
   - Action / Event pada setiap tab WAJIB menggunakan aksi nyata bertanda \`onclick: [Nama Tombol] ([deskripsi aksi])\`, DILARANG hanya menulis teks umum tanpa aksi tombol.
4. DILARANG KERAS menghasilkan blok kode HTML, CSS, JavaScript, atau blok \`\`\`html ... \`\`\`!
5. DILARANG KERAS menyebutkan kata "kode HTML", "generate kode", "fitur CRUD", "data dummy", "syntax error", atau janji teknis apa pun!
6. Akui perubahan pengguna dengan ramah (1-2 kalimat), lalu sesuaikan skenario alur kerja aplikasi (Alur Proses per role, interaksi antar-tab, rincian field input & action) secara LENGKAP & UTUH berdasarkan peran dan checklist yang disimpan pengguna.
   Tampilkan kembali lembar "Brief Kebutuhan" yang telah disesuaikan skenarionya secara LENGKAP dengan format PERSIS:
   📋 **Brief Kebutuhan**
   - **Nama App**: [nama aplikasi]
   - **Orientasi UI**: [Mobile-first / Desktop-first / Responsif, dengan alasan singkat]
   - **Tema Visual**: [deskripsi warna, gaya, kesan yang diinginkan]
   - **Fitur Utama (V1)**: [daftar bernomor, ringkas per fitur]
   - **Fitur Unik (USP)**: [kalau ada, opsional]
   - **Job Description & Struktur Halaman per Peran** (WAJIB dideklarasikan rinci per halaman & section jika ada 2+ peran; cantumkan mekanisme akses: Login simulasi akun demo untuk peran internal & Akses Publik untuk pelanggan/pasien jika ada; kosongkan jika single-user):
     * **[Nama Peran 1 — tulis nama saja, misal: Admin Klinik]**: ← DILARANG menulis "Role Admin", cukup "Admin Klinik"
       - [Halaman 1] (default): section [Section A], section [Section B]
         * Field Input:
           - [x] [Nama Field 1] (tipe data)
           - [x] [Nama Field 2] (tipe data)
         * Action / Event:
           - [x] onclick: [Nama Tombol] ([deskripsi aksi])
           - [x] onclick: [Nama Tombol 2] ([deskripsi aksi])
       - [Halaman 2]: section [Section C], section [Section D]
         * Field Input:
           - [x] [Nama Field 3] (tipe data)
         * Action / Event:
           - [x] onclick: [Nama Tombol 3] ([deskripsi aksi])
       - **Alur Proses**: Klik "[Nama Tombol Aksi]" (Tab 1) → status/data berubah jadi "[Nilai Konkret]" → Klik "[Tombol Simpan]" → status jadi "[Aktif]" → Buka tab "[Nama Tab 2]" (Tab 2) → [efek/data baru terlihat di Tab 2] (WAJIB libatkan perpindahan kedua tab; nama tombol pakai tanda kutip; nilai status konkret; maks 6-8 langkah)
     * **[Nama Peran 2 — tulis nama saja, misal: Dokter Umum]**:
       - [Halaman 1] (default): section [Section A], section [Section B]
         * Field Input:
           - [x] [Nama Field] (tipe data)
         * Action / Event:
           - [x] onclick: [Nama Tombol] ([deskripsi aksi])
       - [Halaman 2]: section [Section C]
       - **Alur Proses**: Klik "[Nama Tombol]" (Tab 1) → status berubah jadi "[Nilai Konkret]" → Buka tab "[Nama Tab 2]" (Tab 2) → [rekam medis/hasil muncul di riwayat Tab 2] → Klik "[Tombol Selesai]" → status berubah jadi "[Nilai Akhir]"
     * **[Nama Peran 3 — tulis nama saja, misal: Pasien]**:
       - [Halaman 1] (default): section [Section A], section [Section B]
         * Field Input:
           - [x] [Nama Field] (tipe data)
         * Action / Event:
           - [x] onclick: [Nama Tombol] ([deskripsi aksi])
       - **Alur Proses**: Klik "[Nama Tombol]" → status berubah jadi "[Nilai Konkret]" → [konsekuensi yang terlihat di layar] (jika 1 tab saja, alur fokus di tab tersebut)
6. Tanyakan konfirmasi eksplisit di baris terakhir:
   "Apakah penyesuaian skenario dan lembar Brief Kebutuhan di atas sudah sesuai? Jika sudah pas, silakan klik tombol 🚀 **Buatkan Prototipe** untuk mulai membuatnya, atau beri tahu saya jika masih ada detail yang ingin disesuaikan."`;
      } else if (isVeryDetailedInitialPrompt || userMessageCount >= 2 || (userMessageCount >= 1 && isUserAgreeingToProposal)) {
        // KONDISI 3: PROMPT AWAL SANGAT DETAIL (>200 chars) ATAU DISKUSI SUDAH 2+ PUTARAN / USER MENYETUJUI USULAN -> RANGKUM KE BRIEF KEBUTUHAN + SESI KONFIRMASI
        systemPrompt = `Anda adalah Konsultan Aplikasi AI dari platform "Mudah Bikin Aplikasi".
Tugas Anda: Merangkum kebutuhan aplikasi yang sudah disepakati menjadi lembar resmi "Brief Kebutuhan" dan meminta konfirmasi sebelum pembuatan prototipe.

ATURAN MUTLAK PERCAKAPAN:
1. DILARANG KERAS menghasilkan blok kode HTML, CSS, JavaScript, atau blok \`\`\`html ... \`\`\`!
2. DILARANG KERAS menyebutkan kata "kode HTML", "generate kode", "fitur CRUD", "data dummy", "syntax error", atau janji teknis apa pun!
3. ATURAN STRUKTUR HALAMAN & ALUR PROSES MULTI-TAB (POIN 42, 43, 51):
   - STRUKTUR TAB PER ROLE: Untuk peran internal operasional & pengawas (misal: Admin, Dokter, Kasir, Receptionist, Washer), deklarasikan 2 Halaman/Tab (Tab 1: Operasional Utama/Entri Data, Tab 2: Monitoring/Riwayat/Laporan) agar workspace terstruktur rapi. Untuk peran pelanggan/pasien publik cukup 1 tab.
   - ALUR PROSES 2 TAB (POIN 51): Jika role memiliki 2 tab/halaman, Alur Proses WAJIB melibatkan dan menghubungkan perpindahan antar-tab sebagai bagian dari alur kerja nyata (contoh: [Aksi di Tab 1] → [Status di Tab 1] → Buka tab "[Nama Tab 2]" (Tab 2) → [Efek/Data di Tab 2] → Klik "[Tombol di Tab 2]" → status "[Nilai Akhir]"), ATAU jika alurnya terpisah tuliskan 2 baris terpisah ("- **Alur Proses Tab 1**: ..." dan "- **Alur Proses Tab 2**: ..."). Batasi maks 6-8 langkah total.
   - Jika role hanya memiliki 1 tab: Alur Proses fokus di 1 tab tersebut (3-5 langkah).
   - Setiap langkah WAJIB menyebutkan nama tombol dalam tanda kutip dan status konkret yang berubah.
4. ATURAN MUTLAK SIKLUS OPERASIONAL DUA SISI & KELENGKAPAN EVENT/ACTION (TWO-WAY BUSINESS LIFECYCLE):
   - DILARANG KERAS membuat alur operasional yang "buntung" (hanya satu sisi). Model bisnis nyata selalu memiliki siklus tertutup:
     * SEWA / RENTAL / PEMINJAMAN (Sepeda, Mobil, Motor, Buku, Kamera, dll):
       WAJIB LENGKAP DUA SISI:
       a. Sisi Pinjam/Sewa (Check-out): Data penyewa, unit barang yang dipilih, durasi sewa, tanggal kembali, uang jaminan/deposit. Action: \`onclick: Catat Peminjaman / Mulai Sewa Unit\`. Status unit berubah dari "Tersedia" menjadi "Sedang Disewa".
       b. Sisi Pengembalian (Check-in & Denda — WAJIB ADA): Form pengembalian barang, pemeriksaan kondisi fisik (Bagus / Lecet / Rusak), kalkulasi denda otomatis jika terlambat, penyelesaian uang deposit, tombol \`onclick: Selesaikan Pengembalian & Cek Fisik\`, \`onclick: Hitung Denda Keterlambatan\`. Status unit otomatis kembali jadi "Tersedia".
     * JASA / SERVICE / BENGKEL / LAUNDRY:
       WAJIB ADA: Penerimaan/Antrean -> Pengerjaan -> QC Selesai -> Penyerahan/Kasir Pembayaran.
     * TRANSAKSI JUAL-BELI / POS:
       WAJIB ADA: Pilih Produk/Keranjang -> Kasir Pembayaran, Cetak Struk, dan Pengurangan Stok Otomatis.
     * BOOKING / RESERVASI:
       WAJIB ADA: Booking Jadwal/Slot -> Check-in Kedatangan / Verifikasi Tamu.
   - Action / Event pada setiap tab WAJIB menggunakan aksi nyata bertanda \`onclick: [Nama Tombol] ([deskripsi aksi])\`, DILARANG hanya menulis teks umum tanpa aksi tombol.
5. Berikan apresiasi singkat dalam bahasa yang ramah (1-2 kalimat), lalu tampilkan lembar "Brief Kebutuhan" (JANGAN PERNAH gunakan kata "PRD") dengan format PERSIS:
   📋 **Brief Kebutuhan**
   - **Nama App**: [nama aplikasi yang SANGAT SPESIFIK & RELEVAN dengan bisnis pengguna, misal "Aplikasi Penitipan Kucing". DILARANG KERAS menggunakan nama kategori umum/template seperti "Aplikasi Perhotelan & Pariwisata"!]
   - **Orientasi UI**: [Mobile-first / Desktop-first / Responsif, dengan alasan singkat]
   - **Tema Visual**: [deskripsi warna, gaya modern, dan kesan visual]
   - **Fitur Utama (V1)**: [daftar bernomor ringkas per fitur inti yang disepakati]
   - **Fitur Unik (USP)**: [keunikan aplikasi, jika ada]
   - **Job Description & Struktur Halaman per Role** (WAJIB dideklarasikan rinci per halaman & section jika ada 2+ role; cantumkan mekanisme akses: Login simulasi akun demo untuk role internal & Akses Publik untuk pelanggan/pasien jika ada; kosongkan jika single-user):
     * **[Nama Peran 1 — tulis nama saja, misal: Admin Klinik]**: ← DILARANG menulis "Role Admin Klinik", cukup "Admin Klinik"
       - [Halaman/Tab 1] (default): section [Nama Section 1], section [Nama Section 2]
         * Field Input:
           - [x] [Nama Field 1] (tipe data)
           - [x] [Nama Field 2] (tipe data)
         * Action / Event:
           - [x] onclick: [Nama Tombol Aksi] ([deskripsi aksi])
           - [x] onclick: [Nama Tombol Batal/Reset] ([deskripsi aksi])
       - [Halaman/Tab 2]: section [Nama Section 3], section [Nama Section 4]
         * Field Input:
           - [x] [Nama Field 3] (tipe data)
         * Action / Event:
           - [x] onclick: [Nama Tombol] ([deskripsi aksi])
       - **Alur Proses**: Klik "[Nama Tombol Aksi]" (Tab 1) → [data/status berubah jadi "Nilai Konkret"] → Klik "[Tombol Simpan]" → status jadi "[Aktif]" → Buka tab "[Nama Tab 2]" (Tab 2) → [efek/data baru terlihat di Tab 2] (WAJIB libatkan kedua tab; nama tombol pakai tanda kutip & nilai status konkret; maks 6-8 langkah)
     * **[Nama Peran 2 — tulis nama saja, misal: Dokter Umum]**: ← DILARANG menulis "Role Dokter Umum"
       - [Halaman/Tab 1] (default): section [Nama Section 1], section [Nama Section 2]
         * Field Input:
           - [x] [Nama Field] (tipe data)
         * Action / Event:
           - [x] onclick: [Nama Tombol] ([deskripsi aksi])
       - [Halaman/Tab 2]: section [Nama Section 3]
       - **Alur Proses**: Klik "[Nama Tombol]" (Tab 1) → [perubahan konkret di layar] → Buka tab "[Nama Tab 2]" (Tab 2) → [rekam medis/hasil muncul di riwayat] → Klik "[Tombol Selesai]" → status berubah jadi "[Nilai Akhir]"
     * **[Nama Peran 3 — tulis nama saja, misal: Pasien]**: ← DILARANG menulis "Role Pasien"
       - [Halaman/Tab 1] (default): section [Nama Section 1], section [Nama Section 2]
         * Field Input:
           - [x] [Nama Field] (tipe data)
         * Action / Event:
           - [x] onclick: [Nama Tombol] ([deskripsi aksi])
       - **Alur Proses**: Klik "[Nama Tombol]" → status berubah jadi "[Nilai Konkret]" → [konsekuensi terlihat di layar] (jika 1 tab, alur fokus di tab tersebut; langkah menunggu pasif ditulis sebagai konsekuensi: "saat [Role Lain] klik X, status berubah jadi Y")
6. WAJIB tanyakan konfirmasi di baris terakhir:
   "Apakah penyesuaian skenario dan lembar Brief Kebutuhan di atas sudah sesuai? Jika sudah pas, silakan klik tombol 🚀 **Buatkan Prototipe** untuk mulai membuatnya, atau beri tahu saya jika masih ada detail yang ingin disesuaikan."`;
      } else {
        // KONDISI 4: PROMPT AWAL SINGKAT / VAGUE / DISKUSI ROLE
        systemPrompt = `Anda adalah Konsultan Aplikasi AI dari platform "Mudah Bikin Aplikasi".
Tugas Anda pada tahap ini adalah mendiskusikan, menggali, dan mempertajam ide aplikasi bersama pengguna (Sub-langkah 1-4 Eksplorasi Ide).

ATURAN MUTLAK PERCAKAPAN (WAJIB DIPATUHI):
1. DILARANG KERAS menghasilkan blok kode HTML, CSS, JavaScript, atau blok \`\`\`html ... \`\`\`!
2. DILARANG KERAS menyebutkan kata-kata teknis seperti "saya akan berikan kode HTML", "generate kode", "fitur CRUD", "data dummy", "syntax error", atau janji teknis apa pun tentang pembuatan kode!
3. NADA KOMUNIKASI WAJIB: BERIKAN USULAN KONKRET DULU, JANGAN PERNAH MELEMPAR BEBAN BERPIKIR KE USER!
   - DILARANG bertanya dengan nada pasif atau kata-kata terbuka seperti "apakah sudah Anda pikirkan/pertimbangkan?", "bagaimana konsep yang Anda inginkan?", atau "apa fitur yang ingin dibuat?".
   - Karena Anda sudah memiliki acuan struktur modul & peran dari blueprint bisnis, Anda WAJIB langsung MENGUSULKAN pembagian peran dan fitur operasional secara konkret.
   - PANDUAN SIKLUS TERTUTUP (TWO-WAY LIFECYCLE): Jika model bisnis berupa RENTAL / SEWA / PEMINJAMAN (sepeda, mobil, motor, buku, kamera), usulan alur kerja WAJIB mencakup siklus lengkap dua sisi: Peminjaman (Check-out) DAN Pengembalian (Check-in) beserta pemeriksaan kondisi fisik dan kalkulasi denda keterlambatan.

4. STRUKTUR RESPONS EKSPLORASI IDE (WAJIB IKUTI 3 BAGIAN INI — POIN 47 & 48):
   - BAGIAN 1 (APRESIASI): Sapa & akui ide bisnis pengguna dengan hangat & antusias (1 kalimat).
   - BAGIAN 2 (USULAN ROLE): Usulkan / rangkum pembagian peran konkret beserta tugas utamanya (2-3 kalimat atau list ringkas).
    - BAGIAN 3 (PENUTUP & KONFIRMASI):
      Tutup dengan 1 pertanyaan persetujuan umum setelah mengusulkan "Super Admin" sebagai role sistem wajib dan role operasional sesuai kebutuhan bisnis.
      Jangan menanyakan apakah Super Admin perlu ditambahkan karena role tersebut selalu ada.
 5. Jangan membuat role generik "Admin". Gunakan "Super Admin" untuk pengaturan sistem dan nama pekerjaan nyata seperti "Petugas", "Kasir", atau "Petugas Sewa" untuk operasi harian.
 6. JANGAN tampilkan form Brief Kebutuhan dan JANGAN buat kode di giliran ini.`;
      }

      // Suntikkan Ekstraksi Varian Role Spesifik Pengguna (Poin 50B)
      if (variantsContext) {
        systemPrompt += variantsContext;
      }

      // Mode Pure AI: Matikan semua template/referensi statis
      systemPrompt += `\n\n${pureAIGuidance}`;
    } else {
      // MODE GENERATE KODE (User sudah menyetujui Brief Kebutuhan / Tahap 2 Mockup / Tahap 5 Patch / Tahap 6)
      systemPrompt = `Anda adalah AI Generator Aplikasi dari platform "Mudah Bikin Aplikasi" (Basic Tier / MVP).
Tugas Anda adalah memandu pengguna non-programmer melalui seluruh siklus hidup pembuatan aplikasi web fungsional.

PRINSIP TERVALIDASI WAJIB (FR-03, NFR-10, NFR-10b):
1. ARSITEKTUR STATE & DATA AWAL WAJIB (DILARANG ARRAY KOSONG): Variabel state array DILARANG KERAS diinisialisasi kosong (misal: \`let items = [];\`). State WAJIB langsung memiliki 3-5 item dummy contoh realistis lengkap (contoh: \`let items = [{ id: '1', nama: 'Kopi Susu', kategori: 'Minuman', harga: 15000 }, { id: '2', nama: 'Roti Bakar', kategori: 'Makanan', harga: 12000 }, { id: '3', nama: 'Teh Manis', kategori: 'Minuman', harga: 6000 }];\`). Selalu render tampilan melalui fungsi \`render()\`.
2. FUNGSIONAL PENUH PADA SETIAP TITIK RILIS / REVISI: Tombol aksi (Tambah, Edit, Hapus) WAJIB berfungsi nyata memanipulasi array state di memori dan memanggil \`render()\` di baris terakhir. Tipe data ID konsisten string.
3. ANTI-CUTOFF: Render loop .map() pada tabel / kartu list dari 3-5 item dummy tersebut. Jangan hardcode baris tabel secara manual di HTML, render melalui JS loop.
4. 3 CHECKLIST EKSPLISIT: Data, Tombol/Aksi, Login/Akses.
  5. FITUR SUPER ADMIN DI-GATE: Fitur Tambah User aktif tetapi hanya terlihat oleh role "Super Admin".
6. LOGIN TANPA KREDENSIAL DEFAULT: Dilarang pakai admin/123 global.
7. DILARANG confirm(), alert(), prompt() BAWAAN BROWSER: Wajib gunakan modal/banner HTML kustom.
8. DUMMY DATA BARRIER: Data contoh mockup tidak dikirim ke Google Sheets sungguhan.
9. OPTIMISTIC UI DENGAN ROLLBACK: Update instan + rollback jika error.
10. BACKEND FAILSAFE GAS: Multi-tab setup + LockService + Content-Type: text/plain.
11. FORMAT KODE: Berikan kode HTML utuh di dalam blok: \`\`\`html ... \`\`\`.
12. ZERO-DEPENDENCY MODERN DESIGN SYSTEM DI <style> (WAJIB DITERAPKAN):
    - DILARANG menggunakan compiler JavaScript eksternal seperti cdn.tailwindcss.com (karena diblokir di sandbox iframe).
    - WAJIB gunakan CSS murni di dalam tag <style> dengan Design Tokens bernilai konkret berikut:
      \`\`\`css
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        background-color: #f8fafc;
        color: #0f172a;
        font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        min-height: 100vh;
        padding: 24px;
      }
      .container { max-width: 1200px; margin: 0 auto; }

      /* Modern App Header */
      .app-header {
        display: flex; justify-content: space-between; align-items: center; background: #ffffff;
        border-radius: 16px; padding: 18px 24px; border: 1px solid #e2e8f0; margin-bottom: 24px;
        box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03);
      }
      .brand-box { display: flex; align-items: center; gap: 12px; }
      .brand-icon {
        width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%);
        display: flex; align-items: center; justify-content: center; color: #fff; font-size: 20px; font-weight: 800;
        box-shadow: 0 4px 10px rgba(79, 70, 229, 0.3);
      }
      .title { font-size: 22px; font-weight: 800; color: #0f172a; line-height: 1.2; }
      .subtitle { font-size: 13px; color: #64748b; margin-top: 2px; }
      .header-actions { display: flex; align-items: center; gap: 12px; }
      .user-badge {
        display: inline-flex; align-items: center; gap: 8px; background: #f0fdf4; border: 1px solid #bbf7d0;
        padding: 6px 14px; border-radius: 9999px; color: #166534; font-weight: 700; font-size: 12px;
      }

      /* KPI Metric Cards Grid */
      .kpi-grid {
        display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px;
      }
      .kpi-card {
        background: #ffffff; border-radius: 14px; padding: 18px 20px; border: 1px solid #e2e8f0;
        box-shadow: 0 2px 4px rgba(0,0,0,0.03); display: flex; flex-direction: column; gap: 6px;
        transition: transform 0.15s, box-shadow 0.15s;
      }
      .kpi-card:hover { transform: translateY(-2px); box-shadow: 0 6px 12px rgba(0,0,0,0.06); }
      .kpi-label { font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; }
      .kpi-value { font-size: 26px; font-weight: 800; color: #0f172a; line-height: 1.1; }
      .kpi-badge { font-size: 11px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; margin-top: 4px; }

      /* Control Toolbar & Filters */
      .toolbar {
        display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px;
        background: #ffffff; border-radius: 12px; padding: 14px 18px; border: 1px solid #e2e8f0; margin-bottom: 18px;
      }
      .search-input {
        padding: 8px 14px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 13px; outline: none;
        min-width: 240px; font-family: inherit;
      }
      .search-input:focus { border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15); }
      .filter-select {
        padding: 8px 12px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 13px; outline: none;
        background: #fff; font-family: inherit; color: #334155;
      }

      /* Card & Content Boxes */
      .card {
        background: #ffffff;
        border-radius: 14px;
        border: 1px solid rgba(226, 232, 240, 0.8);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
        padding: 24px;
        margin-bottom: 24px;
      }

      /* Buttons */
      .btn-primary {
        background: #4f46e5; color: #ffffff; font-weight: 600; padding: 9px 18px; border-radius: 8px; border: none; cursor: pointer; transition: all 0.15s; display: inline-flex; align-items: center; gap: 8px; font-size: 13px; box-shadow: 0 2px 4px rgba(79, 70, 229, 0.2);
      }
      .btn-primary:hover { background: #4338ca; transform: translateY(-1px); }
      .btn-secondary {
        background: #ffffff; color: #334155; font-weight: 600; padding: 8px 14px; border-radius: 8px; border: 1px solid #cbd5e1; cursor: pointer; transition: all 0.15s; display: inline-flex; align-items: center; gap: 6px; font-size: 13px;
      }
      .btn-secondary:hover { background: #f8fafc; border-color: #94a3b8; }
      .btn-danger {
        background: #fff1f2; color: #e11d48; font-weight: 600; padding: 8px 14px; border-radius: 8px; border: 1px solid #fecdd3; cursor: pointer; transition: all 0.15s; display: inline-flex; align-items: center; gap: 6px; font-size: 13px;
      }
      .btn-danger:hover { background: #ffe4e6; }
      
      /* Form Controls */
      .form-group { margin-bottom: 16px; }
      .form-label { display: block; font-size: 14px; font-weight: 600; color: #334155; margin-bottom: 6px; }
      .form-input {
        width: 100%; padding: 10px 14px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; color: #0f172a; font-size: 14px; outline: none; transition: border-color 0.15s, box-shadow 0.15s; font-family: inherit;
      }
      .form-input:focus { border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15); }
      
      /* Data Table Modern */
      .table-container {
        overflow-x: auto; border-radius: 14px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.03); background: #ffffff; margin-top: 14px;
      }
      table { width: 100%; border-collapse: collapse; text-align: left; }
      th {
        background: #f8fafc; color: #475569; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 14px 18px; border-bottom: 1px solid #e2e8f0;
      }
      td { color: #334155; font-size: 14px; padding: 14px 18px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
      tr:hover td { background-color: #f8fafc; }
      tr:last-child td { border-bottom: none; }

      /* Badges */
      .badge {
        display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em;
      }
      .badge-success { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
      .badge-warning { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
      .badge-danger { background: #ffe4e6; color: #b91c1c; border: 1px solid #fecdd3; }
      .badge-info { background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }

      /* Tabs */
      .tab-nav { display: flex; gap: 8px; border-bottom: 2px solid #e2e8f0; margin-bottom: 24px; }
      .tab-btn {
        padding: 12px 20px; border: none; background: none; cursor: pointer; border-bottom: 3px solid transparent; color: #64748b; font-size: 14px; font-weight: 600; transition: all 0.15s; margin-bottom: -2px; display: inline-flex; align-items: center; gap: 8px;
      }
      .tab-btn:hover { color: #334155; }
      .tab-btn.active { border-bottom-color: #4f46e5; color: #4f46e5; }
      .tab-content { display: none; }
      .tab-content.active { display: block; }

      /* Modals */
      .modal {
        position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px); display: none; align-items: center; justify-content: center; padding: 16px; z-index: 50;
      }
      .modal-box {
        background: #ffffff; border-radius: 16px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.15); max-width: 500px; width: 100%; padding: 26px;
      }

      /* Toast */
      .toast {
        position: fixed; bottom: 24px; right: 24px; padding: 12px 20px; border-radius: 10px; color: #ffffff; font-weight: 600; display: none; z-index: 9999; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); font-size: 13px;
      }
      .toast.error { background: #ef4444; }
      .toast.success { background: #10b981; }
      .toast.info { background: #3b82f6; }
      \`\`\`
    - Lucide Icons & Google Fonts: Diizinkan di <head> (menggunakan tag <link> font dan <script src="https://unpkg.com/lucide@latest"></script>). Panggil \`if (typeof lucide !== 'undefined' && lucide?.createIcons) lucide.createIcons();\` di fungsi \`render()\`.
13. SCOPE GLOBAL & ANTI-RELOAD WAJIB:
    - Semua fungsi handler aksi (seperti \`tambahItem()\`, \`editItem()\`, \`hapusItem()\`, \`showModal()\`, \`closeModal()\`) WAJIB dideklarasikan di SCOPE GLOBAL (langsung di dalam tag \`<script>\`, BUKAN dibungkus di dalam \`document.addEventListener('DOMContentLoaded')\` atau closure function privat lain) agar dapat dipanggil langsung dari atribut \`onclick=""\` di elemen HTML.
    - Semua tombol form WAJIB menggunakan \`type="button"\` (atau form menggunakan \`onsubmit="event.preventDefault();"\`) agar saat tombol diklik TIDAK terjadi reload halaman yang menghapus memory state.
14. ATURAN KESELARASAN DOM & EVENT HANDLER WAJIB (100% MATCH):
    - Nama fungsi di atribut \`onclick="namaFungsi()"\` WAJIB PERSIS SAMA (termasuk besar-kecil huruf) dengan nama fungsi yang didefinisikan di \`<script>\`.
    - ID elemen yang dipanggil lewat \`document.getElementById('xyz')\` WAJIB PERSIS SAMA dengan atribut \`id="xyz"\` pada elemen HTML terkait.
    - Selalu gunakan perbandingan ID tipe string (contoh: \`String(item.id) !== String(id)\`) agar tidak terjadi kegagalan penghapusan/edit akibat perbedaan number vs string.
    - SEBELUM MENYERAHKAN KODE: telusuri ulang satu per satu: setiap atribut onclick punya fungsi yang match di JS, setiap getElementById punya elemen yang match di HTML.
15. KEPATUHAN POLA UI SPESIFIK & POLA TAB BAKU (CSS + HTML + JS WAJIB):
    - Jika pengguna meminta navigasi tab (misal: Daftar, Formulir Tambah, Edit), WAJIB gunakan styling tab bernavigasi modern dengan garis highlight bawah aktif (BUKAN tombol kotak aksi biasa).
    - POLA CSS WAJIB UNTUK TAB:
      .tab-nav { display: flex; gap: 8px; border-bottom: 2px solid #e2e8f0; margin-bottom: 20px; }
      .tab-btn { padding: 10px 20px; border: none; background: none; cursor: pointer; border-bottom: 3px solid transparent; color: #64748b; font-size: 15px; font-weight: 500; transition: all 0.2s; }
      .tab-btn.active { border-bottom-color: #4f46e5; color: #4f46e5; font-weight: 600; }
      .tab-content { display: none; }
      .tab-content.active { display: block; }
    - POLA HTML WAJIB UNTUK TAB (Kategori/Halaman):
      <div class="tab-nav">
        <button type="button" id="tab-btn-semua" class="tab-btn active" onclick="showTab('semua')">Semua Data</button>
        <button type="button" id="tab-btn-kategori1" class="tab-btn" onclick="showTab('kategori1')">Kategori A</button>
      </div>
      <div id="semua" class="tab-content active">...</div>
      <div id="kategori1" class="tab-content">...</div>
    - POLA JAVASCRIPT WAJIB UNTUK TAB:
      function showTab(tabId) {
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
        document.getElementById(tabId)?.classList.add('active');
        document.getElementById('tab-btn-' + tabId)?.classList.add('active');
        render();
      }
    - DILARANG KERAS membuat formulir Tambah/Edit sebagai tab terpisah (Formulir Tambah & Edit WAJIB menggunakan Modal Popup sesuai Prinsip 19).
    - DILARANG KERAS menggunakan querySelector pada atribut onclick (seperti \`document.querySelector('.tab[onclick=...]')\`) atau syntax jQuery (\`:contains()\`).
16. DEFENSIVE DOM ACCESS & NULL-SAFETY WAJIB:
    - Selalu gunakan pengecekan null atau optional chaining (\`?.\`) saat mengakses dan memanipulasi elemen DOM (contoh: \`document.getElementById(id)?.classList.add('active')\` atau \`const el = document.getElementById(id); if (el) el.classList.add('active');\`).
    - DILARANG memanggil \`.classList.add()\`, \`.value\`, atau \`.style\` secara langsung tanpa memastikan elemen tersebut ada di DOM.
17. VALIDASI INPUT FORM WAJIB & NOTIFIKASI TOAST CUSTOM (ANTI-DATA KOSONG):
    - Pada SEMUA fungsi penambahan atau pengeditan data (seperti \`tambahData()\`, \`tambahItem()\`, \`simpanEdit()\`), WAJIB validasi kelengkapan nilai input (\`.value.trim()\`) sebelum memanipulasi array.
    - DILARANG KERAS memproses atau menambahkan data baru jika input wajib masih kosong!
    - POLA CSS TOAST WAJIB:
      .toast { position: fixed; bottom: 24px; right: 24px; padding: 12px 20px; border-radius: 10px; color: #ffffff; font-weight: 600; display: none; z-index: 9999; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); }
      .toast.error { background: #ef4444; }
      .toast.success { background: #10b981; }
    - POLA JS VALIDASI & TOAST WAJIB:
      function showToast(pesan, tipe = 'error') {
        let toast = document.getElementById('toastNotification');
        if (!toast) {
          toast = document.createElement('div');
          toast.id = 'toastNotification';
          document.body.appendChild(toast);
        }
        toast.className = 'toast ' + tipe;
        toast.innerText = pesan;
        toast.style.display = 'block';
        setTimeout(() => { toast.style.display = 'none'; }, 3000);
      }
      function tambahItem() {
        const input1 = document.getElementById('nama')?.value.trim();
        if (!input1) {
          showToast('Harap lengkapi semua kolom formulir!', 'error');
          return; // WAJIB BERHENTI, DILARANG MENAMBAHKAN BARIS KOSONG
        }
        // lanjut proses penambahan data...
      }
    - DILARANG menggunakan alert() bawaan browser untuk notifikasi.
18. ATURAN PEMETAAN AKSI TABEL KETAT (ANTI-AKSI TERTUKAR & WAJIB STYLING):
    - Pada baris tabel di dalam fungsi \`render()\`, SETIAP tombol aksi WAJIB dipetakan ke fungsinya secara tepat dan menggunakan class tombol:
      * Tombol Edit: \`<button type="button" class="btn-secondary" onclick="bukaModalEdit('\${item.id}')">Edit</button>\` (DILARANG KERAS memanggil fungsi hapus di tombol Edit!).
      * Tombol Hapus: \`<button type="button" class="btn-danger" onclick="bukaModalHapus('\${item.id}')">Hapus</button>\` (DILARANG KERAS memanggil fungsi edit di tombol Hapus!).
    - DILARANG menulis tombol aksi tabel tanpa class atau membiarkannya polos default HTML.
19. ARSITEKTUR REUSABLE MODAL/POPUP WAJIB (CRUD POPUP PATTERN):
    - Form Tambah & Edit DILARANG nempel/inline di halaman. WAJIB menggunakan MODAL FORM yang dipakai ulang (reusable) untuk Tambah & Edit, serta 1 MODAL KONFIRMASI HAPUS.
    - DILARANG KERAS MENGGUNAKAN STUB / PLACEHOLDER GENERIK SEPERTI: "Field 1", "Field 2", "Field 3", "Value 1", "Value 2", "Kolom 2", "Nama Field 2", atau placeholder abstrak semacamnya!
    - SETIAP FORMULIR WAJIB MEMILIKI KOLOM SUNGGUHAN SESUAI SKEMA TABEL ENTITAS (misal untuk Transaksi: Tanggal, Kategori, Nominal/Jumlah, Catatan, Status; untuk Siswa: Nama Lengkap, No HP, Paket/Kelas, Status).
    - FIELD BERSIFAT RELASI (Foreign Key / Relasi ke tabel lain) WAJIB berupa \`<select>\` dropdown berisi opsi dari data tabel relasi terkait, DILARANG input teks bebas!
    - POLA HTML MODAL WAJIB (Contoh Konkret Multi-Field Sesuai Skema):
      \`\`\`html
      <!-- MODAL FORM (TAMBAH & EDIT) -->
      <div id="modalForm" class="modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:9999; align-items:center; justify-content:center;">
        <div class="modal-box" style="background:#fff; border-radius:12px; padding:24px; max-width:500px; width:90%; max-height:90vh; overflow-y:auto;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
            <h3 id="modalTitle" class="title" style="font-size:18px; margin:0; font-weight:600;">Tambah Data</h3>
            <button type="button" class="btn-secondary" onclick="tutupModalForm()" style="padding:4px 8px; cursor:pointer;">✕</button>
          </div>
          <form id="formData" onsubmit="event.preventDefault(); simpanForm();">
            <input type="hidden" id="editId" value="">
            
            <!-- Kolom Teks Utama Sesuai Entitas -->
            <div class="form-group" style="margin-bottom:12px;">
              <label class="form-label" for="inputNama" style="display:block; margin-bottom:4px; font-weight:500;">Nama / Keterangan</label>
              <input type="text" id="inputNama" class="form-input" placeholder="Masukkan nama atau keterangan..." style="width:100%; padding:8px 12px; border:1px solid #cbd5e1; border-radius:6px;" required>
            </div>

            <!-- Kolom Dropdown Relasi / Kategori Sesuai Entitas -->
            <div class="form-group" style="margin-bottom:12px;">
              <label class="form-label" for="inputKategori" style="display:block; margin-bottom:4px; font-weight:500;">Kategori / Pilihan Relasi</label>
              <select id="inputKategori" class="form-input" style="width:100%; padding:8px 12px; border:1px solid #cbd5e1; border-radius:6px;">
                <option value="">-- Pilih Kategori --</option>
                <option value="Operasional">Operasional</option>
                <option value="Pendapatan">Pendapatan</option>
              </select>
            </div>

            <!-- Kolom Angka / Nominal / Nilai Spesifik -->
            <div class="form-group" style="margin-bottom:12px;">
              <label class="form-label" for="inputNominal" style="display:block; margin-bottom:4px; font-weight:500;">Nominal / Jumlah</label>
              <input type="number" id="inputNominal" class="form-input" placeholder="Contoh: 50000" style="width:100%; padding:8px 12px; border:1px solid #cbd5e1; border-radius:6px;">
            </div>

            <!-- Kolom Status / Dropdown Nilai -->
            <div class="form-group" style="margin-bottom:16px;">
              <label class="form-label" for="inputStatus" style="display:block; margin-bottom:4px; font-weight:500;">Status</label>
              <select id="inputStatus" class="form-input" style="width:100%; padding:8px 12px; border:1px solid #cbd5e1; border-radius:6px;">
                <option value="Aktif">Aktif</option>
                <option value="Pending">Pending</option>
                <option value="Selesai">Selesai</option>
              </select>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:20px;">
              <button type="button" class="btn-secondary" onclick="tutupModalForm()">Batal</button>
              <button type="submit" class="btn-primary">Simpan</button>
            </div>
          </form>
        </div>
      </div>

      <!-- MODAL KONFIRMASI HAPUS -->
      <div id="modalHapus" class="modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:9999; align-items:center; justify-content:center;">
        <div class="modal-box" style="background:#fff; border-radius:12px; padding:24px; max-width:400px; width:90%;">
          <h3 class="title" style="font-size:18px; margin-top:0;">Konfirmasi Hapus</h3>
          <p class="subtitle" style="margin-bottom:20px; color:#64748b;">Apakah Anda yakin ingin menghapus data ini? Tindakan ini tidak dapat dibatalkan.</p>
          <input type="hidden" id="hapusId" value="">
          <div style="display:flex; justify-content:flex-end; gap:8px;">
            <button type="button" class="btn-secondary" onclick="tutupModalHapus()">Batal</button>
            <button type="button" class="btn-danger" onclick="eksekusiHapus()">Hapus</button>
          </div>
        </div>
      </div>
      \`\`\`
    - POLA JAVASCRIPT MODAL WAJIB:
      \`\`\`javascript
      let editId = null;

      function bukaModalTambah() {
        editId = null;
        document.getElementById('modalTitle').innerText = 'Tambah Data';
        document.getElementById('editId').value = '';
        document.getElementById('inputNama').value = '';
        if (document.getElementById('inputKategori')) document.getElementById('inputKategori').value = '';
        if (document.getElementById('inputNominal')) document.getElementById('inputNominal').value = '';
        if (document.getElementById('inputStatus')) document.getElementById('inputStatus').value = 'Aktif';
        document.getElementById('modalForm').style.display = 'flex';
      }

      function bukaModalEdit(id) {
        editId = String(id);
        const item = items.find(i => String(i.id) === String(id));
        if (!item) return;
        document.getElementById('modalTitle').innerText = 'Edit Data';
        document.getElementById('editId').value = item.id;
        document.getElementById('inputNama').value = item.nama || item.keterangan || '';
        if (document.getElementById('inputKategori')) document.getElementById('inputKategori').value = item.kategori || '';
        if (document.getElementById('inputNominal')) document.getElementById('inputNominal').value = item.nominal || item.jumlah || '';
        if (document.getElementById('inputStatus')) document.getElementById('inputStatus').value = item.status || 'Aktif';
        document.getElementById('modalForm').style.display = 'flex';
      }

      function tutupModalForm() {
        document.getElementById('modalForm').style.display = 'none';
      }

      function simpanForm() {
        const nama = document.getElementById('inputNama')?.value.trim();
        if (!nama) {
          showToast('Harap lengkapi semua kolom formulir!', 'error');
          return;
        }
        const kategori = document.getElementById('inputKategori')?.value || '-';
        const nominal = Number(document.getElementById('inputNominal')?.value || 0);
        const status = document.getElementById('inputStatus')?.value || 'Aktif';

        if (editId) {
          // UPDATE DATA EXISTING
          items = items.map(item => String(item.id) === String(editId) ? { ...item, nama, kategori, nominal, status } : item);
          showToast('Data berhasil diperbarui!', 'success');
        } else {
          // TAMBAH DATA BARU
          const newItem = { id: String(Date.now()), nama, kategori, nominal, status };
          items.push(newItem);
          showToast('Data baru berhasil ditambahkan!', 'success');
        }
        tutupModalForm();
        render();
      }

      function bukaModalHapus(id) {
        document.getElementById('hapusId').value = String(id);
        document.getElementById('modalHapus').style.display = 'flex';
      }

      function tutupModalHapus() {
        document.getElementById('modalHapus').style.display = 'none';
      }

      function eksekusiHapus() {
        const id = document.getElementById('hapusId')?.value;
        if (!id) return;
        items = items.filter(item => String(item.id) !== String(id));
        tutupModalHapus();
        render();
        showToast('Data berhasil dihapus!', 'success');
      }
      \`\`\`
20. LAYAR LOGIN SIMULASI SEBAGAI TAMPILAN AWAL (WAJIB PERSIS SEPERTI GAMBAR 2):
    - JIKA APLIKASI MEMILIKI LEBIH DARI 1 PERAN (MULTI-ROLE):
      * TAMPILAN AWAL WAJIB LANGSUNG MENAMPILKAN LAYAR LOGIN DI TENGAH LAYAR (#loginScreen).
      * Container aplikasi utama (#appContainer) WAJIB DIAWALI DENGAN style="display: none;".
      * DILARANG KERAS langsung menampilkan dashboard aplikasi dengan tombol "Login Staf" di header! Pengguna WAJIB disambut oleh Layar Login (#loginScreen) terlebih dahulu.

    === STRUKTUR HTML LAYAR LOGIN (#loginScreen) — PERSIS SEPERTI GAMBAR 2 ===
    <!-- LAYAR LOGIN DI TENGAH LAYAR (#loginScreen) -->
    <div id="loginScreen" style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f8fafc; padding: 20px; font-family: system-ui, -apple-system, sans-serif;">
      <div class="card" style="max-width: 420px; width: 100%; padding: 36px 32px; border-radius: 20px; background: #ffffff; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.06), 0 8px 10px -6px rgba(0,0,0,0.02); text-align: center;">
        
        <!-- Icon Container Kotak Rounded Biru Lembut -->
        <div style="width: 56px; height: 56px; margin: 0 auto 16px; border-radius: 14px; background: #eff6ff; color: #4f46e5; display: flex; align-items: center; justify-content: center; font-size: 26px;">
          🏬
        </div>

        <!-- Judul & Subjudul -->
        <h2 style="font-size: 24px; font-weight: 700; color: #0f172a; margin: 0 0 6px 0;">[Nama Aplikasi]</h2>
        <p style="font-size: 14px; color: #64748b; margin: 0 0 24px 0;">Masuk ke Akun Anda untuk Memulai</p>

        <!-- Input Username -->
        <div style="text-align: left; margin-bottom: 16px;">
          <label style="display: block; font-size: 13px; font-weight: 600; color: #334155; margin-bottom: 6px;">Username</label>
          <input type="text" id="loginUsername" placeholder="Masukkan username" style="width: 100%; padding: 12px 14px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; box-sizing: border-box; outline: none;" required>
        </div>

        <!-- Input Password -->
        <div style="text-align: left; margin-bottom: 20px;">
          <label style="display: block; font-size: 13px; font-weight: 600; color: #334155; margin-bottom: 6px;">Kata Sandi</label>
          <input type="password" id="loginPassword" placeholder="Masukkan kata sandi" style="width: 100%; padding: 12px 14px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; box-sizing: border-box; outline: none;" required>
        </div>

        <!-- Tombol Masuk -->
        <button type="button" class="btn-primary" onclick="handleLogin()" style="width: 100%; justify-content: center; padding: 12px; font-size: 15px; font-weight: 600; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 8px; background: #4f46e5; color: #ffffff; border: none;">
          ➔] Masuk
        </button>

        <!-- KOTAK AKUN DEMO STAF (PERSIS SEPERTI GAMBAR 2) -->
        <div style="margin-top: 24px; background: #f1f5f9; border-radius: 12px; padding: 16px; font-size: 13px; text-align: left; color: #334155; line-height: 1.6;">
          <div style="font-weight: 700; color: #0f172a; margin-bottom: 8px;">🔑 Akun Demo Staf:</div>
          <!-- Setiap baris role dapat diklik untuk Quick Login instan -->
          <div style="cursor: pointer; padding: 3px 0;" onclick="quickLogin('superadmin', 'superadmin123')">• Super Admin: <code style="color: #4f46e5; font-weight: 600;">superadmin / superadmin123</code></div>
          <div style="cursor: pointer; padding: 3px 0;" onclick="quickLogin('kasir', 'kasir123')">• Kasir: <code style="color: #4f46e5; font-weight: 600;">kasir / kasir123</code></div>
        </div>

      </div>
    </div>

    <!-- CONTAINER UTAMA APLIKASI (#appContainer) TERSEMBUNYI SAAT AWAL LOAD -->
    <div id="appContainer" style="display: none;">
      <header class="app-header" style="display: flex; align-items: center; justify-content: space-between; padding: 16px 24px; background: #ffffff; border-radius: 16px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 42px; height: 42px; border-radius: 10px; background: #eff6ff; color: #4f46e5; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 18px;">
            🏬
          </div>
          <div>
            <div style="font-size: 18px; font-weight: 700; color: #0f172a;">[Nama Aplikasi]</div>
            <div style="font-size: 12px; color: #64748b;">Peran: <span id="currentRoleBadge" style="font-weight: 600; color: #4f46e5;">Admin</span></div>
          </div>
        </div>
        <button type="button" class="btn-secondary" onclick="logout()" style="padding: 8px 14px; font-size: 13px; border-radius: 8px;">
          🚪 Keluar / Ganti Akun
        </button>
      </header>
      <!-- Navigasi Tab & Konten Tab di sini -->
    </div>

    === JAVASCRIPT AUTENTIKASI, QUICK LOGIN & LOGOUT ===
    <script>
    function quickLogin(u, p) {
      const uInput = document.getElementById('loginUsername');
      const pInput = document.getElementById('loginPassword');
      if (uInput) uInput.value = u;
      if (pInput) pInput.value = p;
      handleLogin();
    }

    function handleLogin() {
      const u = (document.getElementById('loginUsername')?.value || '').trim().toLowerCase();
      const p = (document.getElementById('loginPassword')?.value || '').trim();

      const matched = DEMO_ACCOUNTS.find(acc => acc.username.toLowerCase() === u && acc.password === p);
      if (matched) {
        loginAs(matched.role);
        showToast('Selamat datang! Masuk sebagai ' + matched.role, 'success');
      } else {
        showToast('Username atau kata sandi tidak cocok! Silakan klik salah satu akun demo di bawah.', 'error');
      }
    }

    function loginAs(role) {
      currentRole = role;
      const loginEl = document.getElementById('loginScreen');
      const appEl = document.getElementById('appContainer');
      if (loginEl) loginEl.style.display = 'none';
      if (appEl) appEl.style.display = 'block';

      filterTabsByRole(role);

      const badgeEl = document.getElementById('currentRoleBadge');
      if (badgeEl) badgeEl.innerText = role;

      // WAJIB MUTLAK (Bagian A - Anti-Tampilan Sama):
      // SETIAP role yang login WAJIB langsung diarahkan ke landingTab miliknya!
      // DILARANG KERAS membiarkan tab Super Admin tetap terbuka saat Kasir/Barber/Pelanggan login!
      const matched = (typeof DEMO_ACCOUNTS !== 'undefined' ? DEMO_ACCOUNTS : []).find(a => a.role === role);
      if (matched && matched.landingTab && typeof showTab === 'function') {
        showTab(matched.landingTab);
      } else {
        const firstVisibleTab = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.style.display !== 'none');
        if (firstVisibleTab) firstVisibleTab.click();
      }

      render();
    }

    const OWNER_ROLE_NAME = '${ownerRole}';
    window.OWNER_ROLE_NAME = OWNER_ROLE_NAME;

    function filterTabsByRole(role) {
      document.querySelectorAll('.tab-btn').forEach(btn => {
        const allowed = (btn.getAttribute('data-access-roles') || '').split(',').map(r => r.trim().toLowerCase());
        const isOwner = Boolean(role && String(role).trim().toLowerCase() === OWNER_ROLE_NAME.toLowerCase());
        btn.style.display = (isOwner || (role && allowed.includes(role.toLowerCase()))) ? '' : 'none';
      });
    }

    function logout() {
      currentRole = '';
      const loginEl = document.getElementById('loginScreen');
      const appEl = document.getElementById('appContainer');
      if (appEl) appEl.style.display = 'none';
      if (loginEl) loginEl.style.display = 'flex';
      showToast('Berhasil keluar. Silakan login kembali.', 'info');
    }
    </script>

21. DESAIN UI PER ROLE BERDASARKAN JOB DESCRIPTION & STRUKTUR SECTION (ROLE-AWARE UX — WAJIB DITERAPKAN JIKA ADA MULTI-ROLE):
    - Membatasi akses tab saja TIDAK CUKUP. Setiap role WAJIB mendapatkan pengalaman yang terasa DIRANCANG UNTUK MEREKA:
    - ATURAN WAJIB:
      a. SETIAP TOMBOL TAB WAJIB PUNYA data-access-roles: Format: data-access-roles="RoleA,RoleB" — daftar peran yang BOLEH melihat tab ini.
         SESUAIKAN dengan nama peran ASLI dari Brief Kebutuhan, JANGAN pakai nama peran dari domain lain.
      b. LANDING TAB DEFAULT PER ROLE WAJIB SESUAI BRIEF: loginAs(role) → filterTabsByRole(role) → showTab ke landing default masing-masing peran.
      c. SETIAP SECTION YANG DIDEKLARASIKAN WAJIB WUJUD FISIK NYATA di halaman terkait.
      d. KOLOM TABEL & KARTU STATISTIK DISESUAIKAN PER ROLE di loop render().
      e. DATA TIDAK BOLEH BERBEDA — array state TETAP SAMA, yang beda hanya tampilan/filter per role.
23. EFISIENSI MODAL & KESELARASAN HANDLER JAVASCRIPT LENGKAP:
    - HINDARI menduplikasi banyak modal HTML terpisah (misal: modalUser, modalTarif, modalOrder yang memicu puluhan fungsi berbeda). Cukup gunakan 1 modal form dinamis untuk Tambah/Edit Data (\`bukaModal(type)\` / \`tutupModal()\`) dan 1 modal Konfirmasi Hapus (\`bukaModalHapus(id)\` / \`tutupModalHapus()\`).
    - STATE DATA ARRAY WAJIB DIINISIALISASI: Jika fungsi JavaScript merujuk variabel data array (seperti \`items\`, \`data\`, \`list\`), WAJIB deklarasikan secara global di tag <script> dengan 3-5 data awal (misal: \`let items = [...];\` atau \`let data = [...];\`). DILARANG memanggil \`items.find\` atau \`items.push\` tanpa deklarasi variabel \`items\`!
    - KREDENSIAL DEMO DI WINDOW: Selalu lampirkan akun demo ke window: \`window.DEMO_ACCOUNTS = DEMO_ACCOUNTS;\` di dalam tag <script>.
    - HAK AKSES OWNER TERHADAP TAB: Peran Owner/Pengelola ('${ownerRole}') sebagai pengelola sistem WAJIB memiliki akses untuk memeriksa seluruh modul tab operasional (sertakan '${ownerRole}' di atribut data-access-roles setiap tab operasional atau gunakan filterTabsByRole yang mencocokkan ke OWNER_ROLE_NAME).
    - SETIAP fungsi yang dipanggil di atribut onclick HTML (seperti \`loginAs\`, \`handleLogin\`, \`bukaModalLogin\`, \`tutupModalLogin\`, \`logout\`, \`showTab\`, \`filterTabsByRole\`, \`render\`, \`bukaModal\`, \`tutupModal\`, \`simpanData\`, \`hapusData\`, \`prosesPenjualan\`, \`prosesTransaksi\`, \`checkout\`, \`bayar\`, \`cetakStruk\`) WAJIB memiliki definisi fungsi yang LENGKAP & NYATA di dalam tag <script>. DILARANG memanggil fungsi di onclick tanpa mendefinisikannya di JavaScript.`;

      // Mode Pure AI: Matikan semua template/referensi statis
      systemPrompt += `\n\n${pureAIGuidance}`;

      if (approvedBrief || officialRoles.length > 0) {
        // Build DEMO_ACCOUNTS dengan landingTab per role (Poin 53 & Bagian A)
        // landingTab = ID tab default yang langsung ditampilkan saat role ini login (SEMUA role wajib punya landingTab eksplisit)
        const credentialsList = officialRoles.map(r => {
          const u = r.toLowerCase().replace(/[^a-z0-9]/g, '');
          const landingTabHint = roleLandingTabs[r] || u;
          return `{ role: '${r}', username: '${u}', password: '${u}123', landingTab: '${landingTabHint}' }`;
        });

        // Buat panduan landingTab eksplisit per role staf untuk AI
        const staffLandingGuide = staffRoles.map(r => {
          const hint = roleLandingTabs[r] || r.toLowerCase().replace(/[^a-z0-9]/g, '');
          return `   - Role "${r}": landingTab harus diisi dengan ID tab pertama yang terlihat setelah login (Tab default "${r}" sesuai Brief, BUKAN tab publik "${publicRole || 'Pelanggan'}"). Contoh hint ID: '${hint}' — sesuaikan dengan ID tab HTML yang dibuat.`;
        }).join('\n');

        // Suntikkan skema data tabel jika tersedia — SUMBER KEBENARAN field form CRUD
        if (schemaMarkdownBlock) {
          systemPrompt += `\n\n` +
`================================================================================
🗄️ SKEMA DATA TABEL RESMI (SUMBER KEBENARAN FIELD FORM CRUD — WAJIB DIIKUTI 100%):
${schemaMarkdownBlock}
================================================================================
⚠️ ATURAN WAJIB FORM CRUD BERDASARKAN SKEMA DI ATAS:
1. SETIAP form/modal Tambah & Edit WAJIB menggunakan PERSIS field dari tabel yang bersangkutan sesuai skema di atas.
   - Judul modal HARUS sesuai nama tabel yang dioperasikan (misal: "Catat Evaluasi Baru" → hanya field dari tabel \`lembar_evaluasi\`).
   - DILARANG KERAS mencampurkan field dari tabel berbeda dalam 1 modal (misal: memasukkan field \`nama_lengkap\` dari tabel \`siswa\` ke dalam form \`lembar_evaluasi\`).
   - Setiap input di modal WAJIB memetakan ke field yang ADA di kolom tabel terkait di skema ini.
2. FIELD BERTIPE "relasi ke [Entitas]" WAJIB DIRENDER SEBAGAI <select>, BUKAN <input type="text">:
   - Dropdown select WAJIB diisi dengan data dari tabel yang direlasikan (ambil dari array state yang sudah dideklarasikan).
   - Tampilkan label yang manusiawi (nama, judul, dsb.) sebagai teks opsi, simpan ID-nya sebagai value.
   - Contoh wajib untuk field \`relasi_ke_siswa\`: 
     \`<select id="inputSiswaId"><option value="">-- Pilih Siswa --</option></select>\`
     dan isi opsinya via JS: \`siswaList.forEach(s => select.innerHTML += \`<option value="\${s.id}">\${s.nama}</option>\`)\`
   - Populate ulang dropdown relasi setiap kali modal dibuka (\`bukaModalTambah\` & \`bukaModalEdit\`) agar data terbaru selalu termuat.
3. DATA CONTOH (DEMO) WAJIB MENGIKUTI RELASI YANG VALID:
   - ID relasi di tabel anak HARUS mengacu ke ID yang benar-benar ada di tabel induk.
   - Contoh: \`jadwal_pertemuan.relasi_ke_instruktur\` HANYA boleh berisi ID instruktur yang ada di tabel \`pengguna\`/\`instruktur\`, BUKAN ID siswa.
================================================================================`;
        }

        systemPrompt += `\n\n` +
`================================================================================
📋 BRIEF KEBUTUHAN RESMI YANG TELAH DISETUJUI PENGGUNA (SUMBER KEBENARAN TUNGGAL - WAJIB DIIKUTI 100% PERSIS):
${approvedBrief ? approvedBrief : `Peran Resmi: ${officialRoles.join(', ')}`}
================================================================================

⚠️ ATURAN MUTLAK SINKRONISASI PROTOTIPE, ISOLASI PERAN & LARANGAN ROLE SWITCHER:
1. PERGANTIAN PERAN 100% HANYA LEWAT LAYAR LOGIN (#loginScreen):
   - DILARANG KERAS membuat tombol switcher peran (seperti tombol berjejer [Admin] [Anggota] atau dropdown switch role) di dalam halaman aplikasi (#appContainer)!
   - Pergantian peran SELURUHNYA HANYA dilakukan melalui tombol "🚪 Keluar / Ganti Akun" (onclick="logout()") di header aplikasi.
   - Saat tombol logout() ditekan, #appContainer disembunyikan dan kartu login #loginScreen ditampilkan kembali di tengah layar.
   - Dari layar login itulah pengguna memilih/masuk sebagai akun peran lain.

2. LABEL TOMBOL TAB ADALAH NAMA FITUR, BUKAN NAMA PERAN:
   - DILARANG KERAS menamai tombol tab dengan nama peran mentah (misal: tombol tab bertuliskan "Super Admin" atau "Anggota")!
   - Tombol tab di dalam aplikasi adalah NAVIGASI FITUR sesuai Job Description di Brief Kebutuhan:
      * Contoh Tab Super Admin: <button class="tab-btn" data-access-roles="Super Admin" onclick="showTab('tab-anggota')">👥 Data Anggota</button>, <button class="tab-btn" data-access-roles="Super Admin" onclick="showTab('tab-laporan')">📊 Laporan & Kas</button>
     * Contoh Tab Anggota: <button class="tab-btn" data-access-roles="Anggota" onclick="showTab('tab-profil')">🪪 Kartu Anggota Digital</button>, <button class="tab-btn" data-access-roles="Anggota" onclick="showTab('tab-iuran')">💳 Riwayat Iuran</button>

3. ISOLASI TOTAL HAK AKSES PER ROLE (ZERO ROLE LEAKAGE):
   - Setiap tombol tab WAJIB memiliki atribut \`data-access-roles="NamaPeran"\` (contoh: data-access-roles="${officialRoles[0] || 'Super Admin'}").
   - Fungsi filterTabsByRole(role) WAJIB menyembunyikan (display: none) seluruh tab yang data-access-roles-nya TIDAK mencantumkan peran aktif!
   - Saat pengguna login sebagai "Anggota", tab-tab milik "Admin" WAJIB 100% TERSEMBUNYI! Pengguna "Anggota" HANYA melihat tab fitur miliknya (misal: Kartu Digital, Profil Pribadi, Iuran Saya).
   - DILARANG KERAS menampilkan tombol aksi manajemen admin (seperti Tambah/Edit/Hapus seluruh anggota) pada tampilan Anggota!

4. INTEGRASI FILTER TAB & LANDING TAB OTOMATIS (WAJIB MUTLAK — BAGIAN A):
   - Fungsi loginAs(role) WAJIB memanggil filterTabsByRole(role) untuk menampilkan HANYA tab yang memiliki data-access-roles sesuai peran aktif.
   - SETELAH filterTabsByRole(role), loginAs(role) WAJIB MEMANGGIL showTab(matched.landingTab) (atau klik tab pertama yang terlihat).
   - DILARANG KERAS membiarkan tab Super Admin tetap aktif/terbuka saat peran lain (seperti Kasir, Barber, Pelanggan) login! Setiap peran WAJIB langsung disambut oleh halaman/tab landing miliknya sendiri.
   - Navigasi tab WAJIB memiliki styling CSS modern (.tab-nav dan .tab-btn dengan border-radius, background, dan warna tegas, bukan button polos HTML bawaan).

5. ISOLASI KONTEN TAB DALAM CSS (WAJIB MUTLAK — ANTI-TUMPUK HALAMAN):
   - Di dalam tag <style>, WAJIB menyertakan aturan CSS untuk menyembunyikan konten tab tidak aktif:
     .tab-content, .tab-pane { display: none; }
     .tab-content.active, .tab-pane.active { display: block; }
   - DILARANG KERAS membiarkan .tab-content tanpa aturan CSS di atas! Tanpa display: none, seluruh halaman role akan tampil menumpuk di satu layar.
   - Fungsi showTab(tabId) di tag <script> WAJIB menyembunyikan seluruh .tab-content (t.classList.remove('active') dan t.style.display = 'none') dan mengaktifkan HANYA tab target (target.classList.add('active') dan target.style.display = 'block').

6. PEMISAHAN DATA, TABEL & FORM PER ROLE (NORMALISASI TAMPILAN):
   - SETIAP ROLE WAJIB MEMILIKI KONTEN/HALAMAN YANG BERBEDA SECARA FISIK SESUAI BRIEF:
     * Role Super Admin: HANYA berisi tabel akun staf, hak akses / permission, dan audit log sistem.
     * Role Operasional (misal: Petugas Rental, Kasir, Washer): Berisi katalog/tabel operasional, form transaksi/alur kerja (serah terima, cek fisik, hitung denda, perbaikan/status).
     * Role Eksternal (misal: Penyewa, Pelanggan, Pasien): Berisi katalog ketersediaan mandiri, form pemesanan/booking mandiri, atau kartu identitas/status pesanan pribadi. DILARANG memuat tabel akun staf atau tombol aksi manajemen staf!
   - DILARANG KERAS menampilkan data, tabel, atau formulir yang sama persis di semua role!

7. PANDUAN PENERJEMAHAN MATRIKS RBAC KE ANTARMUKA (ACTION-LEVEL RBAC UI GATING — BAGIAN B):
   - Membatasi akses tab navigasi saja TIDAK CUKUP. Di dalam halaman/tab yang diakses, setiap peran WAJIB mendapatkan hak aksi (tombol, formulir, kolom mutasi, filter data) yang SELARAS dengan wewenang mereka pada matriks RBAC!
   - PRINSIP INTERPRETASI KONSEPTUAL / SEMANTIK (BUKAN KEYWORD MATCHING KAKU):
     Wewenang pada matriks RBAC dirumuskan dalam bahasa proses bisnis nyata. Interpretasikan maksud wewenangnya secara kontekstual per modul sesuai domain aplikasi, dengan 4 pola umum (misalnya, bukan daftar tertutup):
     a. POLA "TANPA AKSES" (misalnya: "-", "Tidak Ada Akses", "None"):
        * Sembunyikan tab atau section modul ini sepenuhnya untuk peran tersebut (display: none atau tidak di-render).
     b. POLA "PANTAU / MILIK SENDIRI / TERBATAS" (misalnya: "Lihat Status Sendiri", "Riwayat Pengerjaan Milik Sendiri", "Pantau Antrean", "Self-Service", "Read-Only"):
        * Tampilkan data dalam mode pantau/baca saja (read-only table/card).
        * SEMBUNYIKAN tombol aksi mutasi global (seperti "➕ Tambah Data Baru", tombol "Edit", tombol "Hapus").
        * Jika wewenang menyebutkan "milik sendiri", filter data di JavaScript agar HANYA menampilkan entri milik pengguna tersebut (contoh: item.pelangganId === currentUserId || item.barberId === currentUserId).
     c. POLA "EKSEKUSI / OPERASIONAL / KERJA LAPANGAN" (misalnya: "Kerjakan Servis", "Verifikasi Berkas", "Mulai Pengerjaan", "Check-in Unit", "Input Hasil Cek", "Proses Transaksi"):
        * Sediakan tombol aksi operasional yang relevan di baris tabel atau kartu (misalnya: tombol "Mulai Pengerjaan", "Selesai", "Verifikasi", "Check-out").
        * Jangan beri tombol manajemen sistem tingkat tinggi atau otorisasi manajerial.
     d. POLA "SUPERVISI / MANAJERIAL / KONTROL PENUH" (misalnya: "Otorisasi Transaksi", "Supervisi Mutu", "Setujui/Tolak Pengajuan", "Audit & Laporan Global", "Kelola Tarif & Master"):
        * Sediakan tombol persetujuan manajerial (Approve/Reject), tombol pembatalan, pengaturan tarif/master data, atau ekspor laporan menyeluruh.

   ⚠️ PENEGASAN EKSPLISIT:
   Contoh di atas cuma ilustrasi pola umum — nilai izin di RBAC bisa berbentuk kalimat lain yang maknanya setara, jangan menolak menginterpretasikan wewenang hanya karena kata persisnya tidak cocok dengan contoh.

   - PENERAPAN TEKNIS DI KODE HTML & JAVASCRIPT:
     * Di dalam loop render data (misalnya: renderOrders(), renderAntrean(), renderTabel()):
       Gunakan pengecekan currentRole (atau currentUserId) untuk menentukan tombol aksi apa yang di-render di kolom "Aksi" tabel atau kartu.
     * Tombol Tambah Data di Toolbar Tab:
       Tombol seperti "➕ Tambah Data" HANYA boleh muncul jika peran yang sedang aktif login memiliki wewenang membuat data di modul tersebut.
     * Modal dan Formulir:
       Field input atau opsi tertentu yang hanya boleh diubah oleh manajer/supervisi harus dinonaktifkan atau disembunyikan untuk peran staf operasional biasa.

================================================================================
⚠️ SUMBER KEBENARAN TUNGGAL PERAN, KEAMANAN DATA & AUTENTIKASI (POIN 44, 45, 52, 53):
Aplikasi ini TELAH DISETUJUI dengan daftar peran resmi berikut:
${officialRoles.map((r, i) => `  ${i + 1}. "${r}" ${r === publicRole ? '(AKSES PUBLIK - TAMPILAN AWAL)' : '(PERAN STAF/INTERNAL)'}`).join('\n')}

ATURAN TAB GATING PUBLIK & ANTI-DATA LEAK (WAJIB DIPATUHI — POIN 52):
1. DAFTAR PERAN RESMI DI ATAS ADALAH SATU-SATUNYA SUMBER PERAN UNTUK KODE APLIKASI INI.
2. DILARANG KERAS menambahkan role generic (Admin, Kasir, Washer, Petugas, Owner, Manager) jika TIDAK ADA di daftar resmi di atas. Role "Super Admin" adalah pengecualian wajib dan selalu ada!
3. DILARANG KERAS MENYINGKAT NAMA PERAN DALAM KODE MAUPUN DATA (contoh: "Staf Administrasi" DILARANG disingkat jadi "Staf", "Super Admin" DILARANG disingkat jadi "Admin"). Semua pengecekan role di JavaScript (misal: currentUser.role === 'Staf Administrasi') WAJIB MENGGUNAKAN NAMA PERAN LENGKAP PERSIS SESUAI DAFTAR DI ATAS.
4. TAMPILAN AWAL: LAYAR LOGIN DI TENGAH LAYAR (#loginScreen — WAJIB PERSIS GAMBAR 2):
   - Aplikasi WAJIB LANGSUNG MENAMPILKAN LAYAR LOGIN (#loginScreen) di tengah layar saat pertama kali dibuka (PERSIS SEPERTI GAMBAR 2).
   - Container aplikasi (#appContainer) WAJIB DIAWALI DENGAN style="display: none;".
   - DILARANG KERAS langsung menampilkan dashboard aplikasi dengan tombol "Login Staf" di header!
   - Di kartu login #loginScreen:
     * Icon aplikasi di dalam box rounded biru lembut (Gunakan emoji yang 100% RELEVAN dengan bisnis pengguna, contoh 🐱 atau 🐾 untuk penitipan kucing, 🧺 untuk laundry; DILARANG memakai icon hotel 🏨 jika bisnisnya bukan perhotelan!)
     * Judul aplikasi spesifik (contoh: "Aplikasi Penitipan Kucing", DILARANG memakai judul template umum seperti "Aplikasi Perhotelan & Pariwisata"!) + subjudul "Masuk ke Akun Anda untuk Memulai"
     * Input Username (id="loginUsername" placeholder="Masukkan username")
     * Input Kata Sandi (id="loginPassword" type="password" placeholder="Masukkan kata sandi")
     * Tombol "➔] Masuk" (onclick="handleLogin()")
     * Kotak "🔑 Akun Demo Staf:" di bawah tombol Masuk yang mencantumkan daftar peran resmi dan kredensialnya (dengan onclick quickLogin(u, p)).
${publicRole ? `     * Di bawah kotak Akun Demo Staf, sediakan link sekunder: "Atau lanjut tanpa login sebagai ${publicRole} ➔" (onclick="loginAs('${publicRole}')").` : ''}
4. PERLINDUNGAN KEAMANAN TAB STAF (POIN 52):
   - Seluruh tab manajemen data staf (Edit, Hapus, Ubah Status) HANYA boleh diakses setelah login staf.
5. LOGOUT HANDLER:
   function logout() {
     currentRole = '';
     const loginEl = document.getElementById('loginScreen');
     const appEl = document.getElementById('appContainer');
     if (appEl) appEl.style.display = 'none';
     if (loginEl) loginEl.style.display = 'flex';
     showToast('Berhasil keluar. Silakan login kembali.', 'info');
   }
6. FORM LOGIN GAYA PRODUKSI: Form WAJIB memiliki <input type="text" id="loginUsername" placeholder="Username / Email"> dan <input type="password" id="loginPassword" placeholder="Kata Sandi"> serta tombol <button type="button" onclick="handleLogin()">Masuk</button>. DILARANG membuat tombol "Masuk sebagai [Role]" berjejer di form login!
7. KREDENSIAL SIMULASI & DEFAULT LANDING TAB PER ROLE (WAJIB — POIN 53):
   Cocokkan login di fungsi handleLogin() dengan array DEMO_ACCOUNTS PERSIS seperti ini:
   const DEMO_ACCOUNTS = [
${credentialsList.map(c => `     ${c}`).join(',\n')}
   ];
   ⚠️ KRITIS (POIN 53 & BAGIAN A — DEFAULT LANDING TAB): Setiap entry peran (baik staf maupun publik) WAJIB punya field \`landingTab\` yang diisi dengan ID HTML (id="...") dari TAB PERTAMA/DEFAULT role tersebut sesuai Brief Kebutuhan:
${staffLandingGuide}
   PENTING: "landingTab" adalah ID tab HTML peran spesifik. Jika login sebagai Kasir, harus langsung ke tab Kasir; jika login sebagai Barber, harus langsung ke tab Barber; jika login sebagai Pelanggan, ke tab Pelanggan/Antrean — BUKAN tab Super Admin!
   Jika gagal login, panggil showToast('Username atau kata sandi tidak cocok! Silakan cek petunjuk akun demo.', 'error').
8. SETIAP tombol tab (<button class="tab-btn">) WAJIB menggunakan atribut data-access-roles yang HANYA berisi nama peran resmi di atas.
================================================================================`;
      }

      if ((stage === 'TAHAP_1_PEMBUKAAN' && hasBriefPresented && isConfirmationApproval) || stage === 'TAHAP_2_MOCKUP' || (!currentCode && activeChatMode === 'BUILD')) {
        systemPrompt += `\n\nATURAN TAHAP 1 & 2 (PEMBUATAN PROTOTIPE VISUAL LENGKAP & KAYA FITUR):
- Pengguna meminta pembuatan prototipe aplikasi di mode BUILD.
- Tugas Anda: Berikan sambutan hangat dan antusias, lalu WAJIB LANGSUNG MEMBUAT KODE HTML MOCKUP LENGKAP UTUH DALAM BLOK \`\`\`html ... \`\`\` sesuai 23 Prinsip Wajib yang sudah baku:
  1. Data awal 3-5 item contoh realistis (Prinsip 1).
  2. Layar Login Simulasi Awal (Prinsip 20 & Gambar 2): Untuk app multi-role WAJIB diawali dengan #loginScreen di tengah layar (PERSIS SEPERTI GAMBAR 2). Kartu login memiliki icon aplikasi di kotak rounded biru, judul aplikasi + "Masuk ke Akun Anda untuk Memulai", input Username & Kata Sandi, tombol Masuk ("➔] Masuk"), dan kotak "🔑 Akun Demo Staf:" di bawah tombol Masuk dengan daftar role resmi dan kredensialnya (dapat diklik untuk quickLogin instan). Container aplikasi utama (#appContainer) WAJIB DIAWALI DENGAN style="display: none;". DILARANG KERAS langsung menampilkan dashboard dengan tombol "Login Staf" di header!
  3. Quick Login 1-Klik di Form Login: Pada form login #loginScreen, sertakan fungsi quickLogin(u, p) yang otomatis mengisi username & kata sandi serta langsung mengeksekusi handleLogin() saat salah satu baris akun demo diklik!
  4. STANDAR KUALITAS VISUAL & STRUKTUR TAB KAYA FITUR (ANTI-HALAMAN KOSONG):
     * DILARANG KERAS membuat tab yang hanya berisi tag teks <p> deskripsi atau tag <ul> kosong!
     * SETIAP TAB wajib memiliki struktur visual nyata:
       a) Tab Header & Toolbar: Judul tab yang tegas, input pencarian (search), dropdown filter status, dan tombol aksi utama (misal: "➕ Tambah Data Baru").
       b) Ringkasan Metrik (KPI Stat Cards): 2-4 kartu statistik dengan icon, angka tebal, label, dan badge status.
       c) Tampilan Data Utama: Data Table Interaktif (atau Grid Kartu Modern) yang me-render minimal 3-5 baris data contoh realistis, lengkap dengan badge status berwarna (badge-success, badge-warning, badge-danger, badge-info) dan tombol aksi Edit serta Hapus pada setiap baris data.
  5. Efisiensi Modal & Handler Lengkap (Prinsip 23): cukup 1 modal dinamis untuk Tambah/Edit Data dan 1 modal Hapus; setiap tombol onclick WAJIB memiliki fungsi terdefinisi di <script>.
  6. Styling CSS modern murni tanpa Tailwind Play CDN, responsive layout, event handler 100% selaras.
  7. SIKLUS OPERASIONAL LENGKAP DUA SISI (TWO-WAY LIFECYCLE):
     * Jika aplikasi bertema Rental / Sewa / Peminjaman (sepeda, mobil, motor, buku, kamera):
       - WAJIB memiliki alur Mulai Sewa (Check-out) DAN Pengembalian (Check-in).
       - Pada tabel transaksi sewa aktif, sediakan tombol aksi "Kembalikan" yang membuka modal pengembalian unit, mencatat kondisi fisik (Bagus/Rusak), menghitung denda jika terlambat, dan mengembalikan status unit kembali menjadi "Tersedia".
  8. FUNGSI NAVIGASI, AUTENTIKASI & HANDLER BISNIS OPERASIONAL:
     - Kerangka plumbing navigasi standar (\`showTab\`, \`filterTabsByRole\`, \`loginAs\`, \`logout\`, \`showToast\`) telah didukung secara otomatis oleh runtime framework prototipe.
     - Di dalam tag <script>, fokuskan implementasi pada:
       a) Deklarasi \`DEMO_ACCOUNTS\` lengkap dengan field \`landingTab\` spesifik per role.
       b) Fungsi autentikasi \`handleLogin()\` dan \`quickLogin(u, p)\` yang mengarahkan ke \`loginAs(role)\`.
       c) Logika aksi bisnis operasional (Bagian B) seperti \`render()\`, \`bukaModal(type)\`, \`tutupModal()\`, \`simpanData()\`, \`eksekusiHapus()\`, serta fungsi alur transaksi bisnis domain (misal: tambah pesanan, proses layanan, serah terima, dsb.).
     - SETIAP fungsi aksi kustom yang dipanggil di atribut onclick HTML WAJIB memiliki implementasi fungsi yang nyata di JavaScript.
- Tuliskan ringkasan checklist kesiapan aplikasi di bawah kode HTML.`;

      } else if (stage === 'TAHAP_5_PATCH') {
        systemPrompt += `\n\nATURAN TAHAP 5 (PEMBARUAN FITUR / REVISI / PATCH) - VALIDASI FUNGSIONAL WAJIB (NFR-10b):
- Pengguna meminta revisi/patch (misal: ubah warna, tambah kolom, ganti teks, perbaikan peran, atau perbaikan role yang terbagi di halaman).
- PERGANTIAN PERAN 100% HANYA LEWAT LOGIN (#loginScreen):
  * DILARANG KERAS membuat tombol switch peran (seperti tombol [Admin] [Anggota] atau dropdown role switcher) di dalam halaman aplikasi (#appContainer)!
  * Pergantian peran HANYA dilakukan melalui tombol "🚪 Keluar / Ganti Akun" (onclick="logout()") di header aplikasi, yang mengembalikan pengguna ke kartu #loginScreen.
  * Di dalam halaman aplikasi (#appContainer), HANYA tampilkan tab fitur yang relevan dengan peran yang sedang aktif.
- LABEL TOMBOL TAB ADALAH NAMA FITUR, BUKAN NAMA PERAN:
  * Jangan buat tab bernama "Admin" atau "Anggota". Berikan nama fitur (misal: "👥 Data Anggota", "📊 Laporan & Kas", "🪪 Kartu Digital", "💳 Iuran Saya").
- SINKRONISASI BRIEF KEBUTUHAN & PEMISAHAN PERAN (MUTLAK):
  * Jika pengguna melaporkan peran tidak sesuai dengan brief atau meminta sinkronisasi, Anda WAJIB memeriksa lembar Brief Kebutuhan resmi di atas.
  * Pastikan setiap peran (${officialRoles.join(', ')}) memiliki tab navigasi terpisah (<button class="tab-btn" data-access-roles="...">) dan tampilan UI yang sesuai dengan Job Description masing-masing peran di Brief Kebutuhan.
   * Role "Super Admin" mendapatkan fitur akun staf, role, permission, konfigurasi, dan manajemen data penuh.
   * Owner, Manager, dan petugas tidak boleh mendapatkan fitur membuat, mengubah, menonaktifkan, atau menghapus akun staf.
   * Role eksternal (misal: "Anggota") HANYA mendapatkan tampilan data miliknya (misal: Profil/Kartu Digital Anggota, Iuran Saya), DILARANG menampilkan tombol edit/hapus seluruh data anggota.
- KEPATUHAN POLA UI SPESIFIK (PRINSIP 15 & 22): Jika pengguna meminta pola UI spesifik (misal: tab navigasi, antrian, kasir), WAJIB implementasikan PERSIS pola tersebut.
- PERINGATAN INTEGRITAS FUNGSIONAL: Anda WAJIB mempertahankan SEMUA kode JavaScript yang sudah berfungsi sebelumnya (array data 3-5 item contoh, render(), tambahItem, editItem, hapusItem, modal, event listener).
- DILARANG KERAS menghilangkan fungsi-fungsi JavaScript atau mengosongkan tag <script> saat melakukan revisi styling CSS atau HTML.
- Berikan KODE HTML UTUH LENGKAP (termasuk tag <style> dan <script> utuh yang 100% berfungsi) di dalam blok \`\`\`html ... \`\`\`.`;
      } else if (stage === 'TAHAP_6_TROUBLESHOOTING') {
        systemPrompt += `\n\nATURAN TAHAP 6 (PENANGANAN KENDALA):
- Pengguna melaporkan error/blank/masalah.
- AI WAJIB meminta pesan error dari Console (F12) terlebih dahulu sebelum memberikan solusi.
- JANGAN langsung generate kode baru tanpa mengetahui error aslinya.
- Berikan diagnosa akar penyebab dan langkah solusi spesifik.`;
      }
    }

    // Kebijakan role global ditempatkan di bagian akhir agar mengalahkan
    // referensi template lama yang masih menyebut Admin/Owner sebagai admin sistem.
    systemPrompt += `\n${formatRolePolicyForPrompt()}`;

    const useUserKey = Boolean(userApiKey && userApiKey.trim());
    const provider: AIProvider = ['openrouter', 'openai', 'gemini'].includes(userProvider) ? userProvider : 'openrouter';

    // Alur routing 3 provider (BYOK):
    // - tanpa key user -> server default (env AI_PROVIDER, default gemini)
    // - key gemini     -> jalur native Gemini, override key+model user
    // - key openai     -> api.openai.com/v1
    const trimmedKey = (userApiKey || '').trim();
    let effectiveProvider = provider;
    if (trimmedKey.startsWith('sk-or-')) {
      effectiveProvider = 'openrouter';
    } else if (trimmedKey.startsWith('sk-proj-') || (trimmedKey.startsWith('sk-') && !trimmedKey.startsWith('sk-or-'))) {
      effectiveProvider = 'openai';
    } else if (trimmedKey.startsWith('AIza')) {
      effectiveProvider = 'gemini';
    }

    const isUserGemini = useUserKey && effectiveProvider === 'gemini';
    const isOpenRouter = useUserKey && effectiveProvider === 'openrouter';

    const requestedProvider = useUserKey
      ? (isUserGemini ? 'gemini' : 'openai')
      : (process.env.AI_PROVIDER || (process.env.GEMINI_API_KEY ? 'gemini' : 'openai')).toLowerCase();

    const geminiApiKey = isUserGemini ? trimmedKey : process.env.GEMINI_API_KEY;
    const aiProvider = isUserGemini ? 'gemini' : requestedProvider;

    const openaiApiKey = isUserGemini ? undefined : (useUserKey ? trimmedKey : process.env.OPENAI_API_KEY);
    const openaiBaseUrl = isUserGemini
      ? undefined
      : (useUserKey ? (isOpenRouter ? OPENROUTER_API_BASE : OPENAI_API_BASE) : 'https://api.openai.com/v1');

    const activeGeminiModel = isUserGemini ? (userModel || DEFAULT_GEMINI_MODEL) : getGeminiModel();
    const activeOpenAIModel = useUserKey ? (userModel || (isOpenRouter ? OPENROUTER_DEFAULT_MODEL : DEFAULT_OPENAI_MODEL)) : getOpenAIModel();

    if (aiProvider === 'gemini' && !geminiApiKey) {
      return NextResponse.json({
        success: false,
        error: 'Gemini API key belum dikonfigurasi di server.',
        replyText: 'Kunci Gemini API belum dipasang di environment server.',
        code: null,
        isContinued: false
      });
    }

    if (aiProvider === 'openai' && !openaiApiKey) {
      return NextResponse.json({
        success: false,
        error: 'OpenAI/OpenRouter API key belum dikonfigurasi.',
        replyText: 'Kunci OpenAI/OpenRouter API belum terpasang.',
        code: null,
        isContinued: false
      });
    }

    // Susun Prompt dengan Konteks Kode Terkini (jika sedang dalam revisi / patch)
    let userPromptWithContext = prompt;
    if (stage === 'TAHAP_5_PATCH' && currentCode) {
      userPromptWithContext = `KODE HTML & JS SAAT INI YANG SUDAH BERJALAN AKTIF:\n\`\`\`html\n${currentCode}\n\`\`\`\n\nPERMINTAAN REVISI DARI PENGGUNA: "${prompt}".\n\nINSTRUKSI KHUSUS NFR-10b (VALIDASI FUNGSIONAL LENGKAP): Terapkan perubahan yang diminta pengguna di atas, namun TETAP PERTAHANKAN seluruh fungsi JavaScript, array data 3-5 item dummy, tombol Tambah/Edit/Hapus, dan render() agar tetap 100% berfungsi. Kembalikan KODE HTML LENGKAP UTUH di dalam blok \`\`\`html ... \`\`\`.`;
    }

    // Strip HTML besar dari chatHistory sebelum dikirim ke AI (hemat token & bandwidth)
    const recentHistory = stripHtmlFromHistory((chatHistory || []).slice(-6));

    // =========================================================================
    // JALUR STREAMING (SSE) — KHUSUS UNTUK MODE IDEATION (Sub-langkah 1-4)
    // Short-circuit sebelum pipeline berat berjalan. Return ReadableStream
    // dengan Content-Type: text/event-stream agar token muncul token-per-token
    // di frontend tanpa menunggu seluruh respons selesai.
    // =========================================================================
    if (isIdeationMode) {
      const encoder = new TextEncoder();

      const buildGeminiContents = () => {
        const rawContents: { role: string; text: string }[] = [];
        recentHistory.forEach((m: any) => {
          rawContents.push({ role: m.sender === 'AI' ? 'model' : 'user', text: m.text });
        });
        rawContents.push({ role: 'user', text: prompt });
        const contents: { role: string; parts: { text: string }[] }[] = [];
        for (const item of rawContents) {
          const last = contents[contents.length - 1];
          if (last && last.role === item.role) {
            last.parts[0].text += '\n\n' + item.text;
          } else {
            contents.push({ role: item.role, parts: [{ text: item.text }] });
          }
        }
        if (contents.length > 0 && contents[0].role !== 'user') {
          contents.unshift({ role: 'user', parts: [{ text: 'Halo' }] });
        }
        return contents;
      };

      const stream = new ReadableStream({
        async start(controller) {
          const send = (data: object) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          };

          let fullText = '';
          let streamSuccess = false;

          // --- 1. OPENAI FAST STREAMING (TTFT < 1.5s untuk Giliran Diskusi) ---
          if (openaiApiKey) {
            const isGemmaOrNoSystem = isOpenRouter && (activeOpenAIModel.toLowerCase().includes('gemma') || activeOpenAIModel.toLowerCase().includes('r1'));
            const oaiMessages = isGemmaOrNoSystem
              ? [
                  ...recentHistory.map((m: any, idx: number) => ({
                    role: m.sender === 'USER' ? 'user' : 'assistant',
                    content: idx === 0 && m.sender === 'USER' ? `[PETUNJUK SISTEM]:\n${systemPrompt}\n\n${m.text}` : m.text
                  })),
                  {
                    role: 'user',
                    content: recentHistory.length === 0 ? `[PETUNJUK SISTEM]:\n${systemPrompt}\n\n${prompt}` : prompt
                  }
                ]
              : [
                  { role: 'system', content: systemPrompt },
                  ...recentHistory.map((m: any) => ({ role: m.sender === 'USER' ? 'user' : 'assistant', content: m.text })),
                  { role: 'user', content: prompt }
                ];
            try {
              const bodyPayload: Record<string, any> = {
                model: activeOpenAIModel,
                messages: oaiMessages,
                stream: true
              };
              if (isOpenRouter) {
                bodyPayload.max_tokens = ideationMaxTokens;
              } else {
                bodyPayload.max_completion_tokens = ideationMaxTokens;
              }
              const isReasoning = activeOpenAIModel.includes('o1') || activeOpenAIModel.includes('o3') || activeOpenAIModel.includes('r1');
              if (!isReasoning) {
                bodyPayload.temperature = 0.7;
              }

              const oaiRes = await fetch(`${openaiBaseUrl}/chat/completions`, {
                method: 'POST',
                headers: buildOpenAICompatHeaders(openaiApiKey, isOpenRouter),
                body: JSON.stringify(bodyPayload)
              });

              if (oaiRes.ok && oaiRes.body) {
                const reader = oaiRes.body.getReader();
                const dec = new TextDecoder();
                let buffer = '';
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  buffer += dec.decode(value, { stream: true });
                  const lines = buffer.split('\n');
                  buffer = lines.pop() || '';
                  for (const line of lines) {
                    if (!line.startsWith('data:')) continue;
                    const raw = line.slice(5).trim();
                    if (raw === '[DONE]') continue;
                    try {
                      const parsed = JSON.parse(raw);
                      const chunk: string = parsed.choices?.[0]?.delta?.content || '';
                      if (chunk) {
                        fullText += chunk;
                        send({ type: 'chunk', text: chunk });
                      }
                    } catch (_) {}
                  }
                }
                streamSuccess = true;
              } else {
                const errJson = await oaiRes.json().catch(() => null);
                const errMsg = errJson?.error?.message || errJson?.error || `HTTP ${oaiRes.status}`;
                console.warn(`OpenAI/OpenRouter (${activeOpenAIModel}) stream error:`, oaiRes.status, errMsg);
                if (useUserKey) {
                  let userMsg = errMsg;
                  if (oaiRes.status === 401) userMsg = 'API Key yang dimasukkan tidak valid atau tidak memiliki izin akses.';
                  if (oaiRes.status === 402) userMsg = `Saldo kredit OpenRouter tidak mencukupi untuk model "${activeOpenAIModel}". Silakan pilih model gratis (tab 🆓 Gratis) atau isi saldo akun Anda.`;
                  if (oaiRes.status === 404) userMsg = `Model "${activeOpenAIModel}" tidak ditemukan di OpenRouter.`;
                  if (oaiRes.status === 429) userMsg = `Batas rate limit model "${activeOpenAIModel}" tercapai. Mohon tunggu sejenak atau pilih model lain.`;
                  send({ type: 'chunk', text: `⚠️ **Gagal memanggil model ${activeOpenAIModel}:**\n\n${userMsg}\n\n💡 *Saran: Silakan ganti pilihan model di dropdown bagian atas.*` });
                  send({ type: 'done', fullText: `⚠️ ${userMsg}` });
                  controller.close();
                  return;
                }
              }
            } catch (oaiStreamErr) {
              console.warn('OpenAI ideation streaming error, will fallback to Gemini:', oaiStreamErr);
            }
          }

          // --- 2. GEMINI STREAMING (Fallback jika OpenAI tidak tersedia/error) ---
          if (!streamSuccess && geminiApiKey) {
            const geminiStreamUrl = `https://generativelanguage.googleapis.com/v1beta/models/${activeGeminiModel}:streamGenerateContent?alt=sse&key=${geminiApiKey}`;
            try {
              const geminiRes = await fetch(geminiStreamUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiApiKey },
                body: JSON.stringify({
                  systemInstruction: { parts: [{ text: systemPrompt }] },
                  contents: buildGeminiContents(),
                  generationConfig: { temperature: 0.7, maxOutputTokens: ideationMaxTokens }
                })
              });


              if (geminiRes.ok && geminiRes.body) {
                const reader = geminiRes.body.getReader();
                const dec = new TextDecoder();
                let buffer = '';
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  buffer += dec.decode(value, { stream: true });
                  const lines = buffer.split('\n');
                  buffer = lines.pop() || '';
                  for (const line of lines) {
                    if (!line.startsWith('data:')) continue;
                    const raw = line.slice(5).trim();
                    if (raw === '[DONE]') continue;
                    try {
                      const parsed = JSON.parse(raw);
                      const chunk: string = parsed.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || '';
                      if (chunk) {
                        fullText += chunk;
                        send({ type: 'chunk', text: chunk });
                      }
                    } catch (_) {}
                  }
                }
                streamSuccess = true;
              }
            } catch (geminiStreamErr) {
              console.warn('Gemini streaming fallback error:', geminiStreamErr);
            }
          }

          // Bersihkan kode fence jika model sempat menghasilkan (guard tahap 1)
          const rawClean = fullText.replace(/```html[\s\S]*?```/g, '').replace(/```[\s\S]*?```/g, '').trim();
          const cleanReplyText = sanitizeBriefKebutuhanText(rawClean);

          // Event DONE: kirim teks final yang sudah bersih dan signal selesai
          send({ type: 'done', replyText: cleanReplyText, code: null });
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'X-Accel-Buffering': 'no',
          'Connection': 'keep-alive'
        }
      });
    }

    // =========================================================================
    // BATCH PIPELINE — NON-IDEATION (Generate Kode Tahap 2-6)
    // =========================================================================
    let assistantMessage = '';
    let retryCount = 0;
    const maxRetries = 4;

    let actualProviderUsed = aiProvider;

    // Susun Contents Gemini dengan Aturan Role Bergantian (user / model)
    const rawContents: { role: string; text: string }[] = [];
    recentHistory.forEach((m: any) => {
      rawContents.push({
        role: m.sender === 'AI' ? 'model' : 'user',
        text: m.text
      });
    });
    rawContents.push({
      role: 'user',
      text: userPromptWithContext
    });

    // Gabungkan pesan berurutan dengan role yang sama
    const geminiContents: { role: string; parts: { text: string }[] }[] = [];
    for (const item of rawContents) {
      const last = geminiContents[geminiContents.length - 1];
      if (last && last.role === item.role) {
        last.parts[0].text += '\n\n' + item.text;
      } else {
        geminiContents.push({
          role: item.role,
          parts: [{ text: item.text }]
        });
      }
    }

    // Pastikan pesan pertama ber-role 'user'
    if (geminiContents.length > 0 && geminiContents[0].role !== 'user') {
      geminiContents.unshift({
        role: 'user',
        parts: [{ text: 'Halo' }]
      });
    }

    // Deklarasi awal agar bisa dipakai helper fallback (dijalankan di dua titik).
    let htmlCode = '';
    let validated: ReturnType<typeof validateAndRepairGeneratedCode> | null = null;
    let usedDefaultFallback = false;

    // =========================================================================
    // FALLBACK: Server Default (Gemini → OpenAI) bila BYOK gagal
    // (error provider atau kode hasil model tidak valid)
    // =========================================================================
    const extractHtmlFromMessage = (msg: string): string => {
      let out = '';
      const m = msg.match(/```html([\s\S]*?)```/);
      if (m) out = m[1].trim();
      else if (msg.includes('```html')) out = msg.split('```html')[1].replace(/```[\s\S]*$/, '').trim();
      else if (msg.includes('<!DOCTYPE') || msg.includes('<html')) out = msg.trim();
      if (!out) return '';
      out = cleanConversationalLeaks(out);
      if (out.includes('<!DOCTYPE')) out = out.slice(out.indexOf('<!DOCTYPE')).trim();
      else if (out.includes('<html')) out = out.slice(out.indexOf('<html')).trim();
      return out;
    };

    const acceptFallback = (msg: string, providerName: 'gemini' | 'openai'): boolean => {
      const fbHtml = extractHtmlFromMessage(msg);
      if (!fbHtml) return false;

      const fbValidated = validateAndRepairGeneratedCode(fbHtml, '', '', officialRoles, ownerRole);
      if (fbValidated && fbValidated.isValid) {
        htmlCode = fbHtml;
        assistantMessage = msg;
        validated = fbValidated;
        usedDefaultFallback = true;
        actualProviderUsed = providerName;
        return true;
      }

      // Jika tidak 100% valid tapi secara struktural lengkap (ada tag penutup, tidak syntax error),
      // terima fallback ini dan biarkan logika downstream (targeted repair / partial warning jujur) menanganinya.
      const isStructurallyOk = Boolean(
        fbValidated &&
        fbValidated.repairedCode?.html &&
        fbValidated.repairedCode.html.includes('</html>') &&
        fbValidated.repairedCode.html.includes('</script>') &&
        !fbValidated.issues.some(i => i.startsWith('SYNTAX_ERROR'))
      );
      if (isStructurallyOk) {
        htmlCode = fbValidated.repairedCode?.html || fbHtml;
        assistantMessage = msg;
        validated = fbValidated;
        usedDefaultFallback = true;
        actualProviderUsed = providerName;
        return true;
      }

      console.warn(
        `Fallback ${providerName} tidak valid:`,
        (fbValidated?.issues || []).slice(0, 4).join(' | ').slice(0, 400)
      );
      return false;
    };

    const tryServerDefaultFallback = async (reason: string): Promise<boolean> => {
      if (isIdeationMode || !useUserKey || usedDefaultFallback) return false;

      // 1) Coba Server Default Gemini (gratis).
      const serverGeminiKey = process.env.GEMINI_API_KEY;
      if (serverGeminiKey) {
        try {
          const fbRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${getGeminiModel()}:generateContent?key=${serverGeminiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: systemPrompt }] },
                contents: geminiContents,
                generationConfig: { temperature: 0.3, maxOutputTokens: 16384 }
              })
            }
          );
          if (fbRes.ok) {
            const fbData = await fbRes.json();
            const fbMsg = fbData.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text).join('') || '';
            if (fbMsg && acceptFallback(fbMsg, 'gemini')) {
              console.log(`Server Default (Gemini) fallback berhasil setelah: ${reason}`);
              return true;
            }
            console.warn(`Gemini fallback tidak valid (${reason})`);
          } else {
            console.warn(`Gemini fallback HTTP ${fbRes.status} (${reason})`);
          }
        } catch (err) {
          console.warn('Gemini server fallback error:', err);
        }
      }

      // 2) Model cadangan OpenAI dinonaktifkan sesuai permintaan pengguna.
      return false;
    };

    // =========================================================================
    // JALUR 1: GEMINI API (DIPENGARUHI OLEH getGeminiModel())
    // =========================================================================
    if (aiProvider === 'gemini') {

      const candidateModels = [
        activeGeminiModel,
        'gemini-3.6-flash',
        'gemini-flash-latest',
        'gemini-2.5-flash'
      ].filter((m, idx, self) => self.indexOf(m) === idx);

      const candidateEndpoints = candidateModels.map(
        m => `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`
      );

      let geminiData: any = null;
      let usedEndpoint = '';
      const attemptErrors: string[] = [];

      for (const endpoint of candidateEndpoints) {
        const urlWithKey = `${endpoint}?key=${geminiApiKey}`;
        let attempts = 0;
        while (attempts < 3) {
          attempts++;
          const res = await fetch(urlWithKey, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': geminiApiKey || ''
            },
            body: JSON.stringify({
              systemInstruction: {
                parts: [{ text: systemPrompt }]
              },
              contents: geminiContents,
              generationConfig: {
                temperature: isIdeationMode ? 0.7 : 0.4,
                maxOutputTokens: isIdeationMode ? 1024 : 16384
              }
            })
          });

          const data = await res.json();
          if (res.ok && data.candidates && data.candidates.length > 0) {
            geminiData = data;
            usedEndpoint = endpoint;
            break;
          } else {
            const msg = data.error?.message || res.statusText || 'unknown';
            const isRateLimitOrDemand = res.status === 429 || res.status === 503 || msg.toLowerCase().includes('high demand') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('rate');
            if (isRateLimitOrDemand && attempts < 2) {
              console.log(`Gemini ${endpoint.split('/models/')[1]} quick retry (attempt ${attempts + 1})...`);
              await new Promise(r => setTimeout(r, 1000));
              continue;
            }
            attemptErrors.push(`[${endpoint.split('/models/')[1]}]: ${msg}`);
            break;
          }
        }
        if (geminiData) break;
      }

      if (!geminiData || !geminiData.candidates?.[0]) {
        throw new Error('Gemini API failed: ' + attemptErrors.join(' || '));
      } else {

        let candidate = geminiData.candidates?.[0];
        assistantMessage = candidate?.content?.parts?.map((p: any) => p.text).join('') || '';
        let finishReason = candidate?.finishReason;

        // ANTI-CUTOFF GEMINI (Hanya aktif pada mode generate kode jika finishReason === 'MAX_TOKENS' atau kode terpotong)
        const geminiEndpointWithKey = `${usedEndpoint}?key=${geminiApiKey}`;
        while (!isIdeationMode && retryCount < maxRetries) {
          const isFinishReasonLength = finishReason === 'MAX_TOKENS';
          const isTruncatedOrBroken = isCodeTruncatedOrBroken(assistantMessage);

          if (!isFinishReasonLength && !isTruncatedOrBroken) {
            break;
          }

          console.log(`Gemini Anti-cutoff triggered on ${usedEndpoint} (Attempt ${retryCount + 1}). Finish reason: ${finishReason}, isBroken: ${isTruncatedOrBroken}`);

          const continuationContents = [
            ...geminiContents,
            { role: 'model', parts: [{ text: assistantMessage }] },
            { role: 'user', parts: [{ text: 'Lanjutkan persis dari titik karakter terakhir. Jangan mengulangi kode dari awal, dan pastikan tanda kutip serta sintaks script JavaScript dan HTML ditutup dengan lengkap.' }] }
          ];

          let contText = '';
          try {
            const contRes = await fetch(geminiEndpointWithKey, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': geminiApiKey || ''
              },
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: systemPrompt }] },
                contents: continuationContents,
                generationConfig: { temperature: 0.2, maxOutputTokens: 16384 }
              })
            });

            if (contRes.ok) {
              const contData = await contRes.json();
              const contCandidate = contData.candidates?.[0];
              contText = contCandidate?.content?.parts?.map((p: any) => p.text).join('') || '';
              finishReason = contCandidate?.finishReason;
            } else {
              console.warn(`Gemini continuation failed with status ${contRes.status}: ${contRes.statusText}`);
            }
          } catch (contErr) {
            console.warn('Gemini continuation fetch error:', contErr);
          }


          if (!contText || contText.toLowerCase().includes('tidak dapat melanjutkan')) {
            break;
          }

          // Gunakan Smart Boundary Continuation Stitcher (Pilar 3)
          assistantMessage = stitchContinuationCode(assistantMessage, contText);
          retryCount++;
        }
      }

    // =========================================================================
    // JALUR 2: OPENAI API (DIPENGARUHI OLEH getOpenAIModel())
    // =========================================================================
    } else {
      const isGemmaOrNoSystem = isOpenRouter && (activeOpenAIModel.toLowerCase().includes('gemma') || activeOpenAIModel.toLowerCase().includes('r1'));
      const messages = isGemmaOrNoSystem
        ? [
            ...recentHistory.map((m: any, idx: number) => ({
              role: m.sender === 'USER' ? 'user' : 'assistant',
              content: idx === 0 && m.sender === 'USER' ? `[PETUNJUK SISTEM]:\n${systemPrompt}\n\n${m.text}` : m.text
            })),
            {
              role: 'user',
              content: recentHistory.length === 0 ? `[PETUNJUK SISTEM]:\n${systemPrompt}\n\n${userPromptWithContext}` : userPromptWithContext
            }
          ]
        : [
            { role: 'system', content: systemPrompt },
            ...recentHistory.map((m: any) => ({
              role: m.sender === 'USER' ? 'user' : 'assistant',
              content: m.text
            })),
            { role: 'user', content: userPromptWithContext }
          ];

      const reqBody: Record<string, any> = {
        model: activeOpenAIModel,
        messages
      };
      // POIN B: gunakan batas output riil per model (bukan flat 8192)
      const codeGenMaxTokens = getMaxOutputTokens(activeOpenAIModel);
      if (isOpenRouter) {
        reqBody.max_tokens = isIdeationMode ? 1024 : codeGenMaxTokens;
      } else {
        reqBody.max_completion_tokens = isIdeationMode ? 1024 : codeGenMaxTokens;
      }
      const isReasoning = activeOpenAIModel.includes('o1') || activeOpenAIModel.includes('o3') || activeOpenAIModel.includes('r1');
      if (!isReasoning) {
        reqBody.temperature = isIdeationMode ? 0.7 : 0.4;
      }

      let response = await fetch(`${openaiBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: buildOpenAICompatHeaders(openaiApiKey, isOpenRouter),
        body: JSON.stringify(reqBody)
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        const rawErrMsg = errData?.error?.message || errData?.error || `HTTP ${response.status}`;
        console.error(`OpenAI/OpenRouter error (${response.status}):`, rawErrMsg);
        let userFacingError = rawErrMsg;
        if (response.status === 401) {
          userFacingError = `API Key ${isOpenRouter ? 'OpenRouter' : 'OpenAI'} tidak valid. Silakan periksa kembali API Key di menu bawah.`;
        } else if (response.status === 402) {
          userFacingError = `Saldo kredit akun OpenRouter Anda tidak mencukupi untuk menjalankan model "${activeOpenAIModel}". Silakan pilih model dari tab 🆓 Gratis di dropdown atas atau isi saldo kredit di OpenRouter.`;
        } else if (response.status === 404) {
          userFacingError = `Model "${activeOpenAIModel}" tidak ditemukan atau belum tersedia di OpenRouter.`;
        } else if (response.status === 429) {
          userFacingError = `Batas kuota/rate limit untuk model "${activeOpenAIModel}" tercapai. Mohon tunggu beberapa detik atau pilih model lain.`;
        } else if (response.status === 400) {
          userFacingError = `Model "${activeOpenAIModel}" menolak format permintaan: ${rawErrMsg}`;
        } else if (response.status === 503) {
          userFacingError = `Model "${activeOpenAIModel}" sedang mengalami antrean penuh (overloaded). Silakan pilih model lain.`;
        }

        // Fallback ke Server Default (Gemini/OpenAI) untuk error provider yang lazim.
        const retryableStatus = [400, 401, 402, 404, 429, 503].includes(response.status);
        if (retryableStatus && (await tryServerDefaultFallback(`provider HTTP ${response.status}`))) {
          // Lanjut ke tahap finalisasi dengan hasil Gemini.
        } else {
          return NextResponse.json({
            success: false,
            error: userFacingError,
            replyText: `⚠️ **Gagal memproses dengan model ${activeOpenAIModel}:**\n\n${userFacingError}\n\n💡 *Saran:* Silakan pilih model alternatif di dropdown bagian atas (misalnya model dari tab **🆓 Gratis**).`,
            code: null,
            isContinued: false
          });
        }
      }

      if (!usedDefaultFallback) {
        let data = await response.json();
        assistantMessage = data.choices?.[0]?.message?.content || '';
        let finishReason = data.choices?.[0]?.finish_reason;

        // ANTI-CUTOFF OPENAI (Hanya aktif pada mode generate kode jika finish_reason === 'length' atau kode terpotong)
        while (!isIdeationMode && retryCount < maxRetries) {
          const isFinishReasonLength = finishReason === 'length';
          const isTruncatedOrBroken = isCodeTruncatedOrBroken(assistantMessage);

          if (!isFinishReasonLength && !isTruncatedOrBroken) {
            break;
          }

          console.log(`OpenAI Anti-cutoff triggered (Attempt ${retryCount + 1}). Finish reason: ${finishReason}, isBroken: ${isTruncatedOrBroken}`);

          const continuationMessages = [
            ...messages,
            { role: 'assistant', content: assistantMessage },
            { role: 'user', content: 'Lanjutkan persis dari titik karakter terakhir. Jangan mengulangi kode dari awal, dan pastikan tanda kutip serta sintaks script JavaScript tersambung dengan benar tanpa terpotong.' }
          ];

        let contText = '';
        try {
          const contReqBody: Record<string, any> = {
            model: activeOpenAIModel,
            messages: continuationMessages
          };
          if (isOpenRouter) {
            contReqBody.max_tokens = codeGenMaxTokens;
          } else {
            contReqBody.max_completion_tokens = codeGenMaxTokens;
          }
          if (!isReasoning) contReqBody.temperature = 0.2;

          const contResponse = await fetch(`${openaiBaseUrl}/chat/completions`, {
            method: 'POST',
            headers: buildOpenAICompatHeaders(openaiApiKey, isOpenRouter),
            body: JSON.stringify(contReqBody)
          });

          if (contResponse.ok) {
            const contData = await contResponse.json();
            contText = contData.choices?.[0]?.message?.content || '';
            finishReason = contData.choices?.[0]?.finish_reason;
          }
        } catch (openAiErr) {
          console.warn('OpenAI continuation error:', openAiErr);
        }

        if (!contText || contText.toLowerCase().includes('tidak dapat melanjutkan') || contText.toLowerCase().includes('cannot continue')) {
          break;
        }

        // Gunakan Smart Boundary Continuation Stitcher (Pilar 3)
        assistantMessage = stitchContinuationCode(assistantMessage, contText);
        retryCount++;
      }
      }
    }

    // Ekstraksi Blok Kode HTML (Mendukung fence lengkap maupun unclosed jika terpotong)
    const match = assistantMessage.match(/```html([\s\S]*?)```/);
    if (match) {
      htmlCode = match[1].trim();
    } else if (assistantMessage.includes('```html')) {
      // Jika blok ```html dibuka tapi belum sempat ditutup karena cutoff
      const parts = assistantMessage.split('```html');
      htmlCode = parts[parts.length - 1].replace(/```[\s\S]*$/, '').trim();
    } else if (assistantMessage.includes('<!DOCTYPE') || assistantMessage.includes('<html') || assistantMessage.includes('<body')) {
      htmlCode = assistantMessage.trim();
    }

    // SANITASI KETAT ANTI-LEAK: Potong seluruh teks percakapan chat / markdown
    htmlCode = cleanConversationalLeaks(htmlCode);
    if (htmlCode.includes('<!DOCTYPE')) {
      htmlCode = htmlCode.slice(htmlCode.indexOf('<!DOCTYPE')).trim();
    } else if (htmlCode.includes('<html')) {
      htmlCode = htmlCode.slice(htmlCode.indexOf('<html')).trim();
    }

    // Validasi Penuh Sesuai FR-03 & NFR-10 (Dijalankan pada mode generate kode)
    validated = (!isIdeationMode && htmlCode) ? validateAndRepairGeneratedCode(htmlCode, '', '', officialRoles, ownerRole) : null;

    // NFR-10b: Pemeriksaan Integritas, Kelengkapan Tag, Sintaks JavaScript, & Keselarasan DOM Otomatis (Hanya pada mode generate kode)
    const isCodeIncomplete = !htmlCode || !htmlCode.includes('</html>') || !htmlCode.includes('</script>');
    const hasScriptTag = Boolean(htmlCode && (htmlCode.includes('<script>') || htmlCode.includes('<script ')));
    const hasRenderFunction = Boolean(htmlCode && (htmlCode.includes('function render') || htmlCode.includes('render()')));
    const hasMismatchesOrSyntaxErrors = Boolean(validated && validated.issues && validated.issues.length > 0);
    
    // Jika terdeteksi kode tidak lengkap, SyntaxError JS, ketidakselarasan handler/ID, atau script hilang, picu AI auto-recovery (NFR-10b)
    if (!isIdeationMode && (isCodeIncomplete || !validated || !validated.isValid || hasMismatchesOrSyntaxErrors || !hasScriptTag || !hasRenderFunction)) {
      const issueList = validated && validated.issues && validated.issues.length > 0
        ? validated.issues.join('\n- ')
        : (isCodeIncomplete ? 'Kode HTML/JS terpotong dan tidak memiliki tag penutup </html> atau </script>' : 'Tag <script> atau fungsi render() tidak ditemukan.');
      
      console.warn('NFR-10b triggered with DOM alignment, completeness, or JS Syntax issues:\n', issueList);
      
      let repairSuccess = false;
      // Auto-Recovery Prompt sesuai Provider yang Aktif
      if (actualProviderUsed === 'gemini' && geminiApiKey) {
        try {
          const repairRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${activeGeminiModel}:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt }] },
              contents: [
                ...geminiContents,
                { role: 'model', parts: [{ text: assistantMessage }] },
                { role: 'user', parts: [{ text: `PERINGATAN KRITIS NFR-10b (VALIDASI SINTAKS & KELENGKAPAN KODE):
Ditemukan kendala serius pada kode yang Anda berikan:
- ${issueList}

INSTRUKSI PERBAIKAN WAJIB:
1. Hasilkan KODE HTML LENGKAP DAN UTUH dari <!DOCTYPE html> sampai </html> di dalam blok \`\`\`html ... \`\`\`.
2. KONSISTENSI PERAN MUTLAK: Gunakan HANYA peran resmi (${officialRoles.length > 0 ? officialRoles.join(', ') : 'sesuai Brief Kebutuhan'}). DILARANG KERAS memuat peran dari domain lain (seperti Washer/Kasir/Admin jika tidak ada di Brief Kebutuhan)!
3. Pastikan SELURUH sintaks JavaScript di dalam tag <script> VALID 100% dan bebas dari SyntaxError (seperti unclosed string, unexpected identifier, atau kurung tidak berpasangan).
4. Pastikan setiap atribut onclick="fungsi()" memiliki definisi fungsi yang PERSIS SAMA namanya di <script>.
5. Pastikan setiap document.getElementById('id') memiliki elemen HTML dengan ID yang sama.
6. TAB GATING PUBLIK & ANTI-DATA LEAK (POIN 52): Jika ada peran publik, panggil filterTabsByRole(rolePublik) saat inisialisasi awal (DOMContentLoaded) agar seluruh tab staf tersembunyi tanpa login. Tab publik HANYA untuk pencarian/pelacakan spesifik atau input mandiri, dan DILARANG memuat tombol Edit/Hapus staf!
7. Pertahankan seluruh fitur fungsional (array 3-5 item contoh, tambah, edit, hapus, modal).
8. SINKRONISASI TAB PER PERAN (MUTLAK): Jika aplikasi multi-role (${officialRoles.join(', ')}), WAJIB buat <button class="tab-btn" data-access-roles="..."> terpisah untuk masing-masing peran! Setiap peran WAJIB memiliki tab dan tampilan UI khusus yang terpisah sesuai dengan Job Description di Brief Kebutuhan, BUKAN satu halaman statis tanpa tab.
9. ISOLASI CSS & DATA ROLE (MUTLAK): Di tag <style> WAJIB sertakan: .tab-content, .tab-pane { display: none; } dan .tab-content.active, .tab-pane.active { display: block; }. SETIAP tab role WAJIB memiliki konten, tabel, dan form yang BERBEDA (Super Admin = Akun Staf & Hak Akses, Petugas = Operasional & Unit, Customer = Mandiri/Booking), DILARANG menumpuk konten yang sama di semua role!
10. FORMULIR SESUAI SKEMA TABEL (ANTI-STUB): Dilarang keras menggunakan label atau placeholder template palsu seperti "Field 2", "Value 2", "Kolom 2", dsb. Seluruh form input WAJIB memiliki field riil sesuai skema tabel entitas!` }] }
              ],
              generationConfig: { temperature: 0.2, maxOutputTokens: 16384 }
            })
          });
          const repairData = await repairRes.json();
          const repairMsg = repairData.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || '';
          const repairMatch = repairMsg.match(/```html([\s\S]*?)```/);
          if (repairMatch) {
            htmlCode = cleanConversationalLeaks(repairMatch[1]);
            assistantMessage = repairMsg;
            validated = validateAndRepairGeneratedCode(htmlCode, '', '', officialRoles, ownerRole);
            repairSuccess = true;
          } else if (repairMsg.includes('```html')) {
            htmlCode = cleanConversationalLeaks(repairMsg.split('```html')[1].replace(/```[\s\S]*$/, ''));
            assistantMessage = repairMsg;
            validated = validateAndRepairGeneratedCode(htmlCode, '', '', officialRoles, ownerRole);
            repairSuccess = true;
          }
        } catch (e) {
          console.warn('Gemini auto-repair failed:', e);
        }
      }
      
      if (!repairSuccess && aiProvider !== 'gemini' && openaiApiKey) {
        const repairPrompt = [
          { role: 'system', content: systemPrompt },
          ...recentHistory.map((m: any) => ({
            role: m.sender === 'USER' ? 'user' : 'assistant',
            content: m.text
          })),
          { role: 'user', content: userPromptWithContext },
          { role: 'assistant', content: assistantMessage },
          { role: 'user', content: `PERINGATAN KRITIS NFR-10b (VALIDASI SINTAKS & KELENGKAPAN KODE):
Ditemukan kendala serius pada kode yang Anda berikan:
- ${issueList}

INSTRUKSI PERBAIKAN WAJIB:
1. Hasilkan KODE HTML LENGKAP DAN UTUH dari <!DOCTYPE html> sampai </html> di dalam blok \`\`\`html ... \`\`\`.
2. KONSISTENSI PERAN MUTLAK: Gunakan HANYA peran resmi (${officialRoles.length > 0 ? officialRoles.join(', ') : 'sesuai Brief Kebutuhan'}). DILARANG KERAS memuat peran dari domain lain (seperti Washer/Kasir/Admin jika tidak ada di Brief Kebutuhan)!
3. Pastikan SELURUH sintaks JavaScript di dalam tag <script> VALID 100% dan bebas dari SyntaxError (seperti unclosed string, unexpected identifier, atau kurung tidak berpasangan).
4. Pastikan setiap atribut onclick="fungsi()" memiliki definisi fungsi yang PERSIS SAMA namanya di <script>.
5. Pastikan setiap document.getElementById('id') memiliki elemen HTML dengan ID yang sama.
6. TAB GATING PUBLIK & ANTI-DATA LEAK (POIN 52): Jika ada peran publik, panggil filterTabsByRole(rolePublik) saat inisialisasi awal (DOMContentLoaded) agar seluruh tab staf tersembunyi tanpa login. Tab publik HANYA untuk pencarian/pelacakan spesifik atau input mandiri, dan DILARANG memuat tombol Edit/Hapus staf!
7. Pertahankan seluruh fitur fungsional (array 3-5 item contoh, tambah, edit, hapus, modal).
8. SINKRONISASI TAB PER PERAN (MUTLAK): Jika aplikasi multi-role (${officialRoles.join(', ')}), WAJIB buat <button class="tab-btn" data-access-roles="..."> terpisah untuk masing-masing peran! Setiap peran WAJIB memiliki tab dan tampilan UI khusus yang terpisah sesuai dengan Job Description di Brief Kebutuhan, BUKAN satu halaman statis tanpa tab.
9. ISOLASI CSS & DATA ROLE (MUTLAK): Di tag <style> WAJIB sertakan: .tab-content, .tab-pane { display: none; } dan .tab-content.active, .tab-pane.active { display: block; }. SETIAP tab role WAJIB memiliki konten, tabel, dan form yang BERBEDA (Super Admin = Akun Staf & Hak Akses, Petugas = Operasional & Unit, Customer = Mandiri/Booking), DILARANG menumpuk konten yang sama di semua role!
10. FORMULIR SESUAI SKEMA TABEL (ANTI-STUB): Dilarang keras menggunakan label atau placeholder template palsu seperti "Field 2", "Value 2", "Kolom 2", dsb. Seluruh form input WAJIB memiliki field riil sesuai skema tabel entitas!` }
        ];

        const repairReqBody: Record<string, any> = {
          model: activeOpenAIModel,
          messages: repairPrompt
        };
        if (isOpenRouter) {
          repairReqBody.max_tokens = getMaxOutputTokens(activeOpenAIModel);
        } else {
          repairReqBody.max_completion_tokens = getMaxOutputTokens(activeOpenAIModel);
        }
        const isReasoning = activeOpenAIModel.includes('o1') || activeOpenAIModel.includes('o3') || activeOpenAIModel.includes('r1');
        if (!isReasoning) repairReqBody.temperature = 0.2;

        const repairRes = await fetch(`${openaiBaseUrl}/chat/completions`, {
          method: 'POST',
          headers: buildOpenAICompatHeaders(openaiApiKey, isOpenRouter),
          body: JSON.stringify(repairReqBody)
        });

        if (repairRes.ok) {
          const repairData = await repairRes.json();
          const repairMsg = repairData.choices?.[0]?.message?.content || '';
          const repairMatch = repairMsg.match(/```html([\s\S]*?)```/);
          if (repairMatch) {
            htmlCode = cleanConversationalLeaks(repairMatch[1]);
            assistantMessage = repairMsg;
            validated = validateAndRepairGeneratedCode(htmlCode, '', '', officialRoles, ownerRole);
            repairSuccess = true;
          } else if (repairMsg.includes('```html')) {
            htmlCode = cleanConversationalLeaks(repairMsg.split('```html')[1].replace(/```[\s\S]*$/, ''));
            assistantMessage = repairMsg;
            validated = validateAndRepairGeneratedCode(htmlCode, '', '', officialRoles, ownerRole);
            repairSuccess = true;
          }
        }
      }
    }

    // PERLINDUNGAN TAHAP 1 MUTLAK: DILARANG mengirimkan kode sebelum Brief Kebutuhan disetujui pengguna!
    const isStage1AwaitingConfirmation = (stage === 'TAHAP_1_PEMBUKAAN') && !(hasBriefPresented && isConfirmationApproval);

    // Fallback: bila model BYOK tetap menghasilkan kode tidak valid setelah auto-repair,
    // coba sekali lagi dengan Server Default (Gemini).
    if (
      !isIdeationMode &&
      !usedDefaultFallback &&
      useUserKey &&
      actualProviderUsed !== 'gemini' &&
      htmlCode &&
      validated &&
      validated.issues.length > 0
    ) {
      await tryServerDefaultFallback(`validasi gagal (${validated.issues.slice(0, 2).join('; ').slice(0, 120)})`);
    }

    // =========================================================================
    // SELF-HEALING FINAL PASS (POIN A — Kejujuran ke User)
    // Setelah semua upaya repair (continuation + NFR-10b AI repair + server fallback),
    // jika masih ada MISMATCH_HANDLER yang tersisa:
    //   Opsi 1: Targeted AI call khusus untuk mengisi implementasi fungsi yang hilang
    //   Opsi 2: Jika Opsi 1 gagal — tampilkan kode apa adanya + peringatan jujur ke user
    // DILARANG lagi menyuntik stub kosong yang membuat prototipe terlihat jalan padahal cacat.
    // =========================================================================
    let partialWarningFunctions: string[] = []; // Fungsi yang tetap hilang setelah semua upaya
    let partialWarningStubs: string[] = []; // Kolom form stub yang masih tersisa setelah semua upaya

    if (!isStage1AwaitingConfirmation && validated && !validated.isValid && htmlCode && htmlCode.includes('</html>') && htmlCode.includes('</script>')) {
      const hasSyntaxError = validated.issues.some(i => i.startsWith('SYNTAX_ERROR'));
      const hasCriticalSwap = validated.issues.some(i => i.startsWith('CRITICAL_ACTION_SWAP'));
      const hasRoleContamination = validated.issues.some(i => i.startsWith('ROLE_CONTAMINATION'));

      // Hanya lanjutkan self-healing jika tidak ada isu kritis yang lebih parah
      if (!hasSyntaxError && !hasCriticalSwap && !hasRoleContamination) {
        const missingHandlers = extractMissingHandlers(validated.issues);

        if (missingHandlers.length > 0) {
          // --- OPSI 1: Targeted AI call — generate implementasi nyata hanya untuk fungsi yang hilang ---
          const preRepairHtml = htmlCode;
          let targetedRepairSuccess = false;
          const targetedProvider = actualProviderUsed;

          const officialRoleList = officialRoles.length > 0 ? officialRoles.join(', ') : 'Super Admin';
          const missingHandlerContext = missingHandlers.map(fn => `- function ${fn}(...args) { /* implementasikan sesuai konteks aplikasi */ }`).join('\n');
          const targetedRepairInstruction = `PERINGATAN: Fungsi-fungsi berikut dipanggil di atribut onclick HTML tetapi BELUM DIDEFINISIKAN di dalam tag <script>:
${missingHandlerContext}

DAFTAR ROLE RESMI APLIKASI: [${officialRoleList}]

INSTRUKSI MUTLAK:
1. Tulis HANYA definisi fungsi-fungsi di atas yang hilang tersebut — dengan implementasi NYATA sesuai konteks dan array data aplikasi ini (bukan stub kosong).
2. Setiap fungsi WAJIB memiliki logika yang benar-benar berfungsi: manipulasi array state data aplikasi, buka/tutup modal yang ada, panggil render(), dan showToast().
3. DILARANG KERAS MENGARANG ROLE ASING! Jika fungsi berkaitan dengan pengguna, staf, atau role akun, HANYA gunakan role resmi dari daftar: [${officialRoleList}]. DILARANG menggunakan kata "Staff", "User", "Pegawai", atau peran lain di luar daftar resmi tersebut.
4. FORMAT OUTPUT: HANYA KODE JAVASCRIPT MURNI (definisi fungsi saja).
   - DILARANG menulis tag <script> atau </script>!
   - DILARANG menulis tag HTML apa pun!
   - DILARANG menggunakan markdown fence (\`\`\`)!`;

          // Helper sanitasi output JS dari targeted repair agar bebas tag HTML / markdown fence
          const sanitizeTargetedRepairJs = (rawText: string): string => {
            if (!rawText) return '';
            let js = rawText.trim();
            const fenceMatch = js.match(/```(?:javascript|js|html)?([\s\S]*?)```/i);
            if (fenceMatch) {
              js = fenceMatch[1];
            } else {
              js = js.replace(/```[\s\S]*?```/g, '');
            }
            js = js.replace(/<\/?script[^>]*>/gi, '');
            js = js.replace(/<!--[\s\S]*?-->/g, '');
            const lines = js.split('\n');
            const cleanLines = lines.filter(line => {
              const trimmed = line.trim();
              if (!trimmed) return true;
              return !/^<\/?(?:html|head|body|div|section|button|input|form|p|span|table|tr|td|th)\b[^>]*>$/i.test(trimmed);
            });
            js = cleanLines.join('\n').trim();
            try {
              acorn.parse(js, { ecmaVersion: 'latest', sourceType: 'script' });
              return js;
            } catch (err: any) {
              console.warn('[Targeted Repair] Sintaks JS tidak valid sebelum injeksi:', err?.message);
              return '';
            }
          };

          try {
            if (targetedProvider === 'gemini' && geminiApiKey) {
              const targetedRepairContents = [
                ...geminiContents,
                { role: 'model', parts: [{ text: assistantMessage }] },
                { role: 'user', parts: [{ text: targetedRepairInstruction }] }
              ];
              const tRes = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${activeGeminiModel}:generateContent?key=${geminiApiKey}`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    systemInstruction: { parts: [{ text: systemPrompt }] },
                    contents: targetedRepairContents,
                    generationConfig: { temperature: 0.2, maxOutputTokens: 4096 }
                  })
                }
              );
              if (tRes.ok) {
                const tData = await tRes.json();
                const tMsg: string = tData.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || '';
                if (tMsg && tMsg.trim().length > 20) {
                  const sanitizedJs = sanitizeTargetedRepairJs(tMsg);
                  if (sanitizedJs && !sanitizedJs.toLowerCase().includes('tidak dapat')) {
                    const insertPos = htmlCode.lastIndexOf('</script>');
                    if (insertPos !== -1) {
                      const candidateHtml = htmlCode.slice(0, insertPos) + '\n' + sanitizedJs.trim() + '\n' + htmlCode.slice(insertPos);
                      const candidateValidated = validateAndRepairGeneratedCode(candidateHtml, '', '', officialRoles, ownerRole);

                      const hasNewSyntaxError = candidateValidated.issues.some(i => i.startsWith('SYNTAX_ERROR'));
                      const hasNewRoleContamination = candidateValidated.issues.some(i => i.startsWith('ROLE_CONTAMINATION'));
                      const hasNewCriticalSwap = candidateValidated.issues.some(i => i.startsWith('CRITICAL_ACTION_SWAP'));
                      const remainingMissing = extractMissingHandlers(candidateValidated.issues).length;

                      if (!hasNewSyntaxError && !hasNewRoleContamination && !hasNewCriticalSwap && (candidateValidated.isValid || remainingMissing < missingHandlers.length)) {
                        htmlCode = candidateHtml;
                        validated = candidateValidated;
                        partialWarningFunctions = extractMissingHandlers(candidateValidated.issues);
                        targetedRepairSuccess = true;
                        console.log(`[Targeted Repair] Berhasil. Sisa handler hilang: ${partialWarningFunctions.length}`);
                      } else {
                        console.warn(`[Targeted Repair] Ditolak karena isu baru (Syntax: ${hasNewSyntaxError}, Role: ${hasNewRoleContamination}). Rollback ke kode asal.`);
                        htmlCode = preRepairHtml;
                      }
                    }
                  }
                }
              }
            } else if (openaiApiKey) {
              const targetedMessages = [
                { role: 'system', content: systemPrompt },
                ...recentHistory.map((m: any) => ({ role: m.sender === 'USER' ? 'user' : 'assistant', content: m.text })),
                { role: 'user', content: userPromptWithContext },
                { role: 'assistant', content: assistantMessage },
                { role: 'user', content: targetedRepairInstruction }
              ];
              const tReqBody: Record<string, any> = { model: activeOpenAIModel, messages: targetedMessages };
              const targetedRepairMaxTokens = Math.min(getMaxOutputTokens(activeOpenAIModel), 8192);
              if (isOpenRouter) tReqBody.max_tokens = targetedRepairMaxTokens;
              else tReqBody.max_completion_tokens = targetedRepairMaxTokens;
              const isReasoning = activeOpenAIModel.includes('o1') || activeOpenAIModel.includes('o3') || activeOpenAIModel.includes('r1');
              if (!isReasoning) tReqBody.temperature = 0.2;

              const tRes = await fetch(`${openaiBaseUrl}/chat/completions`, {
                method: 'POST',
                headers: buildOpenAICompatHeaders(openaiApiKey, isOpenRouter),
                body: JSON.stringify(tReqBody)
              });
              if (tRes.ok) {
                const tData = await tRes.json();
                const tMsg: string = tData.choices?.[0]?.message?.content || '';
                if (tMsg && tMsg.trim().length > 20) {
                  const sanitizedJs = sanitizeTargetedRepairJs(tMsg);
                  if (sanitizedJs && !sanitizedJs.toLowerCase().includes('tidak dapat')) {
                    const insertPos = htmlCode.lastIndexOf('</script>');
                    if (insertPos !== -1) {
                      const candidateHtml = htmlCode.slice(0, insertPos) + '\n' + sanitizedJs.trim() + '\n' + htmlCode.slice(insertPos);
                      const candidateValidated = validateAndRepairGeneratedCode(candidateHtml, '', '', officialRoles, ownerRole);

                      const hasNewSyntaxError = candidateValidated.issues.some(i => i.startsWith('SYNTAX_ERROR'));
                      const hasNewRoleContamination = candidateValidated.issues.some(i => i.startsWith('ROLE_CONTAMINATION'));
                      const hasNewCriticalSwap = candidateValidated.issues.some(i => i.startsWith('CRITICAL_ACTION_SWAP'));
                      const remainingMissing = extractMissingHandlers(candidateValidated.issues).length;

                      if (!hasNewSyntaxError && !hasNewRoleContamination && !hasNewCriticalSwap && (candidateValidated.isValid || remainingMissing < missingHandlers.length)) {
                        htmlCode = candidateHtml;
                        validated = candidateValidated;
                        partialWarningFunctions = extractMissingHandlers(candidateValidated.issues);
                        targetedRepairSuccess = true;
                        console.log(`[Targeted Repair] Berhasil. Sisa handler hilang: ${partialWarningFunctions.length}`);
                      } else {
                        console.warn(`[Targeted Repair] Ditolak karena isu baru (Syntax: ${hasNewSyntaxError}, Role: ${hasNewRoleContamination}). Rollback ke kode asal.`);
                        htmlCode = preRepairHtml;
                      }
                    }
                  }
                }
              }
            }
          } catch (targetedErr) {
            console.warn('[Targeted Repair] Error:', targetedErr);
          }

          // --- OPSI 2: Jika Opsi 1 gagal total atau di-rollback — catat semua handler yang masih hilang sebagai partial warning ---
          if (!targetedRepairSuccess) {
            htmlCode = preRepairHtml;
            partialWarningFunctions = missingHandlers;
            console.warn(`[Targeted Repair] Rollback ke kode asal. ${missingHandlers.length} handler masih hilang: ${missingHandlers.join(', ')}`);
            // Re-validasi untuk memastikan verified.repairedCode yang mutakhir dan bersih dari kontaminasi
            const finalValidated = validateAndRepairGeneratedCode(htmlCode, '', '', officialRoles, ownerRole);
            validated = finalValidated;
          }
        } else {
          // Tidak ada MISMATCH_HANDLER — issue lain (ROLE_GATING, dsb.) tidak perlu targeted repair
          console.log('[Self-healing] Tidak ada MISMATCH_HANDLER yang tersisa, skip targeted repair.');
        }

        // Deteksi stub form yang tersisa setelah seluruh auto-repair pass (POIN A & Langkah 2)
        const remainingStubForms = extractStubFormIssues(validated.issues);
        if (remainingStubForms.length > 0) {
          partialWarningStubs = remainingStubForms;
          console.warn(`[Self-healing] Terdeteksi ${remainingStubForms.length} kolom form stub tersisa:`, remainingStubForms);
        }
      }
    }

    // Kode dianggap valid jika secara struktural lengkap (</html> + </script> ada),
    // tidak ada SYNTAX_ERROR, dan bisa ditampilkan ke user.
    // Kasus "partial" (ada MISMATCH_HANDLER atau STUB_FORM yang tersisa) tetap dikirim ke user
    // tapi dengan peringatan jujur — BUKAN diblokir atau distub diam-diam.
    const isStructurallyComplete = Boolean(
      htmlCode &&
      htmlCode.includes('</html>') &&
      htmlCode.includes('</script>') &&
      validated &&
      validated.repairedCode &&
      validated.repairedCode.html &&
      validated.repairedCode.html.trim().length > 0 &&
      !validated.issues.some(i => i.startsWith('SYNTAX_ERROR'))
    );
    const hasValidCode = Boolean(
      !isStage1AwaitingConfirmation &&
      isStructurallyComplete &&
      // Kode diizinkan "valid" jika: (a) memang valid penuh, atau (b) partial — ada handler/form belum sempurna
      // tapi secara struktural sudah cukup untuk ditampilkan ke user dengan peringatan jujur
      (validated!.isValid || partialWarningFunctions.length > 0 || partialWarningStubs.length > 0)
    );

    // Format Pesan Teks Chat Bersih & Jujur
    let cleanReplyText = '';
    if (isStage1AwaitingConfirmation) {
      // Jika AI sempat menghasilkan code fence sebelum konfirmasi disetujui, bersihkan total dari teks chat
      cleanReplyText = assistantMessage.replace(/```html[\s\S]*?```/g, '').replace(/```[\s\S]*?```/g, '').trim();
    } else if (hasValidCode) {
      cleanReplyText = assistantMessage
        .replace(/```html[\s\S]*?```/, '\n\n✨ **Prototipe aplikasi berhasil dibuat dan dimuat langsung ke Canvas Preview.**')
        .replace(/```html[\s\S]*$/, '\n\n✨ **Prototipe aplikasi berhasil dibuat dan dimuat langsung ke Canvas Preview.**')
        .trim();
      if (!cleanReplyText.includes('✨ **Prototipe aplikasi berhasil dibuat')) {
        cleanReplyText += '\n\n✨ **Prototipe aplikasi berhasil dibuat dan dimuat langsung ke Canvas Preview.**';
      }

      if (usedDefaultFallback) {
        cleanReplyText =
          `⚠️ *Model pilihan Anda gagal menghasilkan kode valid. Sistem otomatis memakai **Server Default (${actualProviderUsed === 'gemini' ? 'Gemini' : 'OpenAI'})** untuk prototipe ini.*\n\n` +
          cleanReplyText;
      }

      // PETUNJUK PENGGUNAAN & KREDENSIAL DEMO (POIN 45-D): USER DAN PASSWORD DI CHAT
      if (!cleanReplyText.includes('🔑 **Akun Demo') && !cleanReplyText.includes('🔑 **Petunjuk Akses')) {
        let displayRoles = officialRoles.length > 0 ? [...officialRoles] : [];

        // Fallback: ekstrak role dari DEMO_ACCOUNTS atau loginAs di kode HTML
        if (displayRoles.length === 0 && htmlCode) {
          const accMatches = htmlCode.matchAll(/role\s*:\s*['"]([^'"]+)['"]/gi);
          for (const m of accMatches) {
            const r = m[1].trim();
            if (r && !displayRoles.includes(r)) displayRoles.push(r);
          }
        }
        if (displayRoles.length === 0 && htmlCode) {
          const roleMatches = htmlCode.matchAll(/(?:loginAs|switchRole|selectRole)\s*\(\s*['"]([^'"]+)['"]/gi);
          for (const rm of roleMatches) {
            const r = rm[1].trim();
            if (r && !displayRoles.includes(r)) displayRoles.push(r);
          }
        }
        if (displayRoles.length === 0) {
          displayRoles = [REQUIRED_SYSTEM_ROLE, 'Petugas / Anggota'];
        }

        let credentialsGuide = '\n\n🔑 **Akun Demo & Kredensial Login (Username & Password):**\nSilakan gunakan akun demo di bawah ini untuk mencoba prototipe pada Canvas Preview:\n';

        if (publicRole) {
          credentialsGuide += `\n> ℹ️ *Aplikasi ini dibuka pertama kali di halaman **${publicRole}** (akses publik tanpa login). Untuk mencoba fitur staf/pengelola, silakan login dengan akun berikut:*\n`;
        }

        credentialsGuide += '\n| Peran (Role) | Username | Password | Hak Akses |';
        credentialsGuide += '\n| :--- | :--- | :--- | :--- |';

        displayRoles.forEach((r) => {
          const isPublic = /^(pasien|pelanggan|customer|tamu|guest|publik|client|warga|masyarakat)/i.test(r);
          if (isPublic) {
            credentialsGuide += `\n| **${r}** | *(Tanpa Login)* | *(Tanpa Login)* | Akses Publik (Tampilan Awal) |`;
          } else {
            const u = r.toLowerCase().replace(/[^a-z0-9]/g, '') || 'admin';
            const pass = `${u}123`;
            const desc = isSuperAdminRole(r)
              ? 'Akses sistem penuh, akun staf, role & permission'
              : 'Akses operasional & input data';
            credentialsGuide += `\n| **${r}** | \`${u}\` | \`${pass}\` | ${desc} |`;
          }
        });

        credentialsGuide += '\n\n💡 *Tips: Anda juga dapat langsung mengklik tombol role login instan (Quick Login) yang tersedia pada layar login aplikasi.*';
        cleanReplyText += credentialsGuide;
      }

      // PERINGATAN JUJUR PARTIAL (POIN A): Jika ada fungsi yang masih hilang setelah semua upaya repair,
      // beri tahu user secara eksplisit dengan nama fungsinya — DILARANG sembunyikan dengan stub diam-diam.
      if (partialWarningFunctions.length > 0) {
        const fnList = partialWarningFunctions.map(fn => '`' + fn + '()`').join(', ');
        const firstFn = partialWarningFunctions[0];
        cleanReplyText += `\n\n> ⚠️ **Catatan Integritas Prototipe:**\n> Prototipe berhasil dimuat, namun sistem mendeteksi **${partialWarningFunctions.length} tombol/aksi yang belum sepenuhnya terhubung**: ${fnList}.\n> Tombol-tombol ini mungkin tidak merespons saat diklik. Untuk memperbaikinya, ketik misalnya **"perbaiki fungsi ${firstFn}"** atau **"generate ulang prototipe"**.`;
      }

      // PERINGATAN JUJUR FORM STUB (POIN A & Langkah 2): Jika ada kolom form yang masih memakai label/placeholder template palsu,
      // beri tahu user secara eksplisit — DILARANG menampilkan form palsu tanpa penjelasan.
      if (partialWarningStubs.length > 0) {
        const stubList = partialWarningStubs.join(', ');
        cleanReplyText += `\n\n> ⚠️ **Catatan Integritas Formulir:**\n> Prototipe berhasil dimuat, namun sistem mendeteksi **kolom formulir yang belum sepenuhnya sesuai skema data**: ${stubList}.\n> Kolom-kolom ini masih menggunakan label/placeholder sementara. Anda dapat meminta AI untuk menyesuaikannya dengan mengetik: **"sesuaikan kolom formulir dengan skema data"**.`;
      }
    } else if (htmlCode || assistantMessage.includes('```html')) {
      // Pesan kegagalan yang ACTIONABLE dan informatif
      const topIssues = validated?.issues && validated.issues.length > 0
        ? validated.issues.slice(0, 2).join('; ')
        : (isCodeIncomplete ? 'Kode HTML/JS terpotong di tengah jalan' : 'Pemeriksaan DOM ID & event handler tidak lolos');

      // POIN D: Tentukan apakah kandidat untuk "generate versi sederhana"
      const isComplexityRelated = officialRoles.length > 2 || isCodeIncomplete;
      const top2Roles = officialRoles.slice(0, 2);
      const suggestedSimplifyPrompt = top2Roles.length >= 2
        ? `buatkan prototipe versi sederhana dulu, fokus hanya 2 role utama: ${top2Roles.join(' dan ')}`
        : 'buatkan prototipe versi sederhana dulu';

      cleanReplyText = `⚠️ **Pembuatan kode belum berhasil melewati validasi integritas otomatis.**\n\n🔍 **Detail kendala:** ${topIssues}.\n\n💡 **Saran Tindakan:** Gunakan tombol di bawah untuk mencoba lagi, atau minta versi yang lebih sederhana terlebih dahulu.`;

      return NextResponse.json({
        success: true,
        provider: actualProviderUsed,
        replyText: cleanReplyText,
        code: null,
        isContinued: retryCount > 0,
        // POIN D: Flag fallback otomatis — frontend render tombol "Coba Lagi" dan "Versi Sederhana"
        suggestSimplify: isComplexityRelated,
        suggestedRetryPrompt: 'buatkan prototipe sekarang',
        suggestedSimplifyPrompt: isComplexityRelated ? suggestedSimplifyPrompt : undefined
      });
    } else {
      cleanReplyText = sanitizeBriefKebutuhanText(assistantMessage.trim());
    }

    return NextResponse.json({
      success: true,
      provider: actualProviderUsed,
      replyText: cleanReplyText,
      code: hasValidCode && validated ? validated.repairedCode : null,
      isContinued: retryCount > 0
    });

  } catch (error: any) {
    console.error('Error in /api/generate:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}
