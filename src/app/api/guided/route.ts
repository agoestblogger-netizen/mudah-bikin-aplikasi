import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rateLimiter';
import { getUserFromRequest } from '@/lib/supabase/user';
import {
  detectMatchingMasterTemplate,
  detectIndustryOverlays,
  getIndustryOverlaysByIds,
  getIndustryOverlayById,
  getMasterTemplateById,
  getTemplateProcessMap,
  detectTier,
  buildGuidedStep,
  applyGuidedAnswer,
  compileBriefFromSession,
  isBriefBusinessComplete,
  renderRoleSummaryTable,
  getDomainFlowDetails,
  renderFlowMarkdown,
  reconcileCoreOperationalRole,
  resolveActorForStep,
  detectDualProcess,
  buildDualFlowQuestion,
  buildKasusGandaFromSession,
  detectAmbiguousStorylineDomain,
  buildDirectionClarificationCard,
  buildNonBusinessClarificationCard,
  DUAL_PROCESS_PATTERNS,
  REQUIRED_ROLE,
  isSuperAdminRole,
  isExternalRole,
  isActorEntityData,
  isActorSystemUser,
  getEntityOwnerRole,
  analyzeActorClassification,
  type ActorClassification,
  isNavigationActionId,
  getRoleNarrativeAndResponsibilities,
  calculateConceptualSimilarity,
  detectCoreOperationalRole,
  type DomainFlowData,
  type GuidedStepId,
  type SessionStep,
  type MockupSessionState,
  type AnalisisArahResult,
  type KondisiArahBisnis,
  type PemisahanRoleResult,
  type SupportingFlowItem,
  type SupportingFeatureItem,
  renderRbacMarkdownTable,
  renderDataSchemaMarkdown,
  generateDeterministicSimulasiDb,
  renderSimulasiDbMarkdown,
  repairRelasiSimulasiDb,
  validateContohDataVsSchema,
  detectTargetRoleForField,
  detectTargetRoleForFieldAsync,
  type SemanticRoleMatcher,
  type SimulasiContohData,
  type SimulasiContohTabel,
  renderReviewFinalMarkdown,
  buildBackNavigationStep,
  generateChangeNote,
  isPureConfirmationText,
  isTablePengguna
} from '@/lib/templates';
import {
  DEFAULT_GEMINI_MODEL,
  DEFAULT_OPENAI_MODEL,
  OPENROUTER_DEFAULT_MODEL,
  OPENROUTER_SITE_URL,
  OPENROUTER_APP_TITLE
} from '@/app/api/generate/route';
import { OPENROUTER_API_BASE, OPENAI_API_BASE } from '@/lib/modelConfig';
import {
  ensureSemanticIndex,
  resolveSemanticMapping,
  type SemanticMappingResult,
  type SemanticMatch
} from '@/lib/semanticSearch';

export const maxDuration = 60;

type GuidedAction = 'START' | 'NEXT' | 'COMPILE' | 'ANALYZE_CUSTOM_ROLE' | 'RESUME';

interface CustomRolePayloadItem {
  id: string;
  label: string;
  description: string;
  responsibilities: string[];
}

interface EditedRolePayloadItem {
  description: string;
  responsibilities: string[];
}

interface GuidedBody {
  action?: GuidedAction;
  prompt?: string;
  session?: MockupSessionState;
  stepId?: GuidedStepId;
  selected?: string[];
  other?: string;
  targetStep?: string;
  appName?: string;
  provider?: string;
  apiKey?: string;
  model?: string;
  // Payload untuk analisis & manajemen peran kustom / sunting deskripsi peran
  roleName?: string;
  roleNote?: string;
  existingRoles?: Array<{ id: string; label: string; description?: string; responsibilities?: string[] }>;
  customRoles?: CustomRolePayloadItem[];
  editedRoles?: Record<string, EditedRolePayloadItem>;
}

function buildNarrationPrompt(session: MockupSessionState, action: GuidedAction, stepTitle?: string): string {
  const category = session.match.businessCategory || getIndustryOverlaysByIds(session.match.overlayIds)[0]?.nama || session.match.templateId || 'kebutuhan bisnis Anda';
  const roleLabels = session.roles.selected.join(', ') || 'belum dipilih';
  const wajib = session.features.selected.filter((f) => f.priority === 'WAJIB').length;
  const nyusul = session.features.selected.filter((f) => f.priority === 'NYUSUL').length;
  return `Konteks sesi Aplikasi Generator:
- Kategori/Industri Bisnis: ${category}
- Template: ${session.match.templateId || 'belum terdeteksi'}
- Pola proses: ${session.match.patternIds.join(', ') || '-'}
- Tier: ${session.match.tier}
- Peran terpilih: ${roleLabels}
- Alur terpilih: ${session.flow.selectedId || 'belum'}
- Fitur Wajib: ${wajib}, Fitur V2: ${nyusul}
- Aksi: ${action}${stepTitle ? ` (langkah: ${stepTitle})` : ''}

Tulis 1-2 kalimat narasi ramah dalam bahasa Indonesia untuk memandu pengguna.
PENTING: Jangan gunakan istilah "perancangan aplikasi".
DILARANG mengubah, menambah, atau menghapus opsi pilihan; opsi ditentukan sistem.`;
}

async function invokeAIChat(options: {
  systemInstruction: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  provider?: string;
  userApiKey?: string;
  userModel?: string;
}): Promise<string | null> {
  const {
    systemInstruction,
    userPrompt,
    temperature = 0.4,
    maxTokens = 4000,
    provider,
    userApiKey,
    userModel
  } = options;

  const hasUserKey = Boolean(userApiKey && userApiKey.trim());
  const trimmedKey = (userApiKey || '').trim();

  // Auto-detect provider dari format key pengguna jika ada inkonsistensi pilihan di dropdown
  let effectiveProvider = provider;
  if (trimmedKey.startsWith('sk-or-')) {
    effectiveProvider = 'openrouter';
  } else if (trimmedKey.startsWith('sk-proj-') || (trimmedKey.startsWith('sk-') && !trimmedKey.startsWith('sk-or-'))) {
    effectiveProvider = 'openai';
  } else if (trimmedKey.startsWith('AIza')) {
    effectiveProvider = 'gemini';
  }

  const isUserGemini = hasUserKey && effectiveProvider === 'gemini';
  const isOpenRouter = hasUserKey && effectiveProvider === 'openrouter';

  const requestedProvider = hasUserKey
    ? isUserGemini
      ? 'gemini'
      : 'openai'
    : (process.env.AI_PROVIDER || (process.env.GEMINI_API_KEY ? 'gemini' : 'openai')).toLowerCase();

  const geminiApiKey = isUserGemini ? trimmedKey : process.env.GEMINI_API_KEY;
  const openaiApiKey = isUserGemini ? undefined : hasUserKey ? trimmedKey : process.env.OPENAI_API_KEY;
  const openaiBaseUrl = isUserGemini
    ? undefined
    : hasUserKey
      ? isOpenRouter
        ? OPENROUTER_API_BASE
        : OPENAI_API_BASE
      : 'https://api.openai.com/v1';

  let activeGemini = isUserGemini ? userModel || DEFAULT_GEMINI_MODEL : process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  if (activeGemini === 'gemini-3.5-flash' || activeGemini === 'gemini-2.5-flash') {
    activeGemini = 'gemini-3.6-flash';
  }
  const openaiModel = hasUserKey
    ? userModel && (isOpenRouter || !userModel.includes('/'))
      ? userModel
      : (isOpenRouter ? OPENROUTER_DEFAULT_MODEL : DEFAULT_OPENAI_MODEL)
    : process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL;

  try {
    if (requestedProvider === 'gemini' && geminiApiKey) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${activeGemini}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': geminiApiKey
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemInstruction }] },
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            generationConfig: { temperature, maxOutputTokens: maxTokens }
          })
        }
      );
      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || '';
        if (text.trim()) return text.trim();
      } else {
        const errText = await res.text().catch(() => '');
        console.warn(`Gemini call failed (${res.status}), mencoba fallback ke OpenAI...`);
        const fallbackKey = process.env.OPENAI_API_KEY;
        if (fallbackKey) {
          const fallbackRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${fallbackKey}`
            },
            body: JSON.stringify({
              model: process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
              messages: [
                { role: 'system', content: systemInstruction },
                { role: 'user', content: userPrompt }
              ],
              temperature,
              max_tokens: maxTokens
            })
          });
          if (fallbackRes.ok) {
            const data = await fallbackRes.json();
            const text = data.choices?.[0]?.message?.content || '';
            if (text.trim()) return text.trim();
          }
        }
      }
    } else if (openaiApiKey) {
      const isGemmaOrNoSystem = openaiModel.toLowerCase().includes('gemma') || openaiModel.toLowerCase().includes('r1');
      const messages = isGemmaOrNoSystem
        ? [
            {
              role: 'user',
              content: `[INSTRUKSI SISTEM & ATURAN]:\n${systemInstruction}\n\n[PERMINTAAN PENGGUNA]:\n${userPrompt}`
            }
          ]
        : [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: userPrompt }
          ];

      const bodyPayload: Record<string, any> = {
        model: openaiModel,
        messages,
        max_tokens: maxTokens
      };
      if (!openaiModel.toLowerCase().includes('r1') && !openaiModel.toLowerCase().includes('o1')) {
        bodyPayload.temperature = temperature;
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiApiKey}`
      };
      if (isOpenRouter) {
        headers['X-OpenRouter-Title'] = OPENROUTER_APP_TITLE;
        headers['HTTP-Referer'] = OPENROUTER_SITE_URL;
        headers['X-Title'] = OPENROUTER_APP_TITLE;
      }
      const res = await fetch(`${openaiBaseUrl || 'https://api.openai.com/v1'}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(bodyPayload)
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content || '';
        if (text.trim()) return text.trim();
      } else {
        const errText = await res.text().catch(() => '');
        console.warn(`OpenAI/OpenRouter call failed (${res.status}):`, errText);
      }
    }
  } catch (err) {
    console.warn('AI invocation failed:', err);
  }

  // Fallback cadangan OpenAI dinonaktifkan sesuai permintaan pengguna.
  return null;
}

/**
 * Mendeteksi apakah narasi cerita masih terpengaruh kerangka klise:
 * 1. Formula pujian: [ide/inisiatif/langkah/rencana/konsep/aplikasi/dsb] + [kata sifat pujian] + [untuk/dalam/guna/demi/agar]
 * 2. Formula pujian terbalik / awalan sebuah: [sebuah ide/langkah/inisiatif] + [cerdas/tepat/cemerlang/dsb]
 * 3. Pola klise umum ide/aplikasi ... menarik
 */
/**
 * Menghasilkan nama bisnis/aplikasi yang bersih dari prompt atau kategori bisnis sistem.
 */
export function extractBusinessNameFromPrompt(prompt: string, domainCandidate?: string): string {
  let rawPrompt = (prompt || '').trim();

  // Jika ada teks pengaya seperti ". PANDUAN PENTING...", ambil hanya bagian prompt asli di depannya
  const guideSplit = rawPrompt.split(/\.\s*PANDUAN PENTING/i);
  if (guideSplit.length > 1) {
    rawPrompt = guideSplit[0].trim();
  }

  // Bersihkan prompt dari kata awalan imperatif / kata benda software
  let cleanPrompt = rawPrompt
    .replace(/^(tolong\s+)?(buatkan|bikinkan|buat|bikin|rancang|kembangkan|desain|siapkan|kelola|atur)\s+/i, '')
    .replace(/^(aplikasi|sistem|web|platform|software|program|tool)\s+(untuk\s+|bagi\s+)?/i, '')
    .replace(/[.!?,;]+$/g, '')
    .trim();

  if (cleanPrompt.length >= 2) {
    return cleanPrompt;
  }

  const candidate = (domainCandidate || '').trim();
  if (candidate && candidate.toLowerCase() !== 'operasional bisnis' && candidate.toLowerCase() !== 'bisnis ini') {
    return candidate;
  }

  return cleanPrompt || 'bisnis yang Anda rencanakan';
}

/**
 * Menghasilkan kalimat pembuka narasi storytelling standar deterministik (Teks Tetap).
 * Format: "Berikut adalah flow proses bisnis dari [nama bisnis/aplikasi yang diminta user]."
 */
export function buildStandardGreeting(promptOrBusiness: string, domainCandidate?: string): string {
  const name = extractBusinessNameFromPrompt(promptOrBusiness, domainCandidate);
  return `Berikut adalah flow proses bisnis dari ${name}.`;
}

/**
 * Memastikan narasi storytelling selalu diawali kalimat pembuka standar deterministik.
 */
export function ensureStandardGreetingInNarasi(narasi: string, standardGreeting: string): string {
  if (!narasi) return standardGreeting;
  let text = narasi.trim();

  // Jika sudah persis diawali standardGreeting, langsung kembalikan
  if (text.startsWith(standardGreeting)) {
    return text;
  }

  // Jika diawali format "Berikut adalah flow proses bisnis dari ...":
  const prefixMatch = text.match(/^Berikut adalah flow proses bisnis dari [^.]+?\.\s*/i);
  if (prefixMatch) {
    text = text.slice(prefixMatch[0].length).trim();
    return `${standardGreeting} ${text}`;
  }

  // Jika kalimat pertama adalah sapaan klise, evaluasi ide, ajakan, atau pengantar sapaan lama:
  const firstSentence = text.split(/[\.\n\?\!]/)[0] || '';
  if (
    isClicheStorylineOpening(firstSentence) ||
    /^(mari|ayo|yuk)\s+kita\s+lihat\b/i.test(firstSentence) ||
    /^(dalam\s+dunia|ketika\s+memikirkan|membayangkan\s+bagaimana)\b/i.test(firstSentence) ||
    /^(sebuah\s+(ide|langkah|inisiatif|rencana)|ide\s+untuk|langkah\s+cerdas)\b/i.test(firstSentence)
  ) {
    const rest = text.slice(firstSentence.length).replace(/^[.\n?!]\s*/, '').trim();
    return `${standardGreeting} ${rest}`;
  }

  return `${standardGreeting} ${text}`;
}

/**
 * Mendeteksi apakah narasi cerita masih terpengaruh kerangka klise:
 * Berfungsi sebagai jaring pengaman untuk isi NARASI (melewati kalimat pembuka standar).
 */
export function isClicheStorylineOpening(text: string): boolean {
  if (!text) return false;

  const sentences = text
    .split(/[\.\n\?\!]/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);

  for (const sentence of sentences) {
    // Lewati kalimat pembuka standar deterministik
    if (sentence.startsWith('berikut adalah flow proses bisnis dari')) continue;

    // 1. Pola Intensifier Generik: [sangat/amat/sungguh/cukup/benar-benar/betapa/begitu/teramat] + 1-2 kata + [preposisi tujuan]
    const isIntensifierPraise =
      /\b(sangat|amat|sungguh|cukup|benar-benar|betapa|begitu|teramat)\s+(?:[a-z]+(?:nya|an|kan|lah|kah|pun)?\s+){1,2}(untuk|dalam|guna|demi|agar|bagi)\b/i.test(sentence);

    // 2. Pola Sifat Pujian Formulaik + Preposisi Tujuan
    const isDirectPraiseGoal =
      /\b(tepat|relevan|cerdas|cemerlang|brilian|hebat|luar\s+biasa|istimewa|solutif|potensial|prospektif|strategis|bermanfaat|krusial|menjanjikan|penting|efektif|efisien)(?:nya|an|kan|lah|kah|pun)?\b(?:\s+\w+){0,3}\s+(untuk|dalam|guna|demi|agar|bagi)\b/i.test(sentence);

    // 3. Pola Pujian Subjek Ide/Aplikasi/Inisiatif
    const isIdeSubjectPraise =
      /\b(ide|aplikasi|konsep|rencana|gagasan|inisiatif)\b.*?\b(sangat|amat|sungguh|cukup|benar-benar)?\s*(tepat|relevan|cerdas|cemerlang|brilian|hebat|luar\s+biasa|istimewa|solutif|potensial|prospektif|strategis|bermanfaat|krusial|menjanjikan|penting|efektif|efisien)(?:nya|an|kan|lah|kah|pun)?\b/i.test(sentence);

    // 4. Pola Template Formulaik [Langkah/Cara/Solusi/Upaya/Inisiatif] + [Sifat] + Preposisi
    const isLangkahFormula =
      /\b(langkah|cara|solusi|upaya|inisiatif|pilihan|terobosan)\s+(yang\s+)?(sangat\s+)?([a-z]+(?:nya)?)\s+(untuk|dalam|guna|demi|agar|bagi)\b/i.test(sentence);

    // 5. Pola awalan sebuah + pujian
    const isSebuahPraise =
      /^(sebuah\s+(ide|langkah|inisiatif|rencana|terobosan|solusi|upaya))\b.*?\b(cerdas|cemerlang|tepat|luar\s+biasa|brilian|bagus|hebat|relevan|efektif|solutif|menarik)(?:nya|an|lah|kah)?\b/i.test(sentence);

    // 6. Pola klise kata 'menarik' di posisi MANA PUN dalam kalimat
    const isGenericMenarik = /\bmenarik(?:nya|kan|an|lah|kah|pun)?\b/i.test(sentence);

    // 7. Boilerplate kaku ajakan hasil anchoring: "Mari kita lihat bagaimana alur/proses..."
    const isBoilerplateAjakan =
      /^(mari|ayo|yuk)\s+kita\s+lihat\s+bagaimana\s+(alur|proses)\b/i.test(sentence);

    if (
      isIntensifierPraise ||
      isDirectPraiseGoal ||
      isIdeSubjectPraise ||
      isLangkahFormula ||
      isSebuahPraise ||
      isGenericMenarik ||
      isBoilerplateAjakan
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Dinonaktifkan: Kalimat pembuka sekarang selalu hadir secara deterministik (hardcoded),
 * fungsi ini dipertahankan untuk kompatibilitas signature.
 */
export function lacksGreetingOpening(_text: string): boolean {
  return false;
}

/**
 * Memastikan narasi storytelling murni dari sudut pandang pihak ketiga objektif sebagai jaring pengaman terakhir:
 * - HANYA menangani penggantian kata ganti orang pertama jamak ("kami", "kita", "tim kami", "tim kita") menjadi peran operasional nyata.
 * - DILARANG melakukan replace mekanis terhadap kata benda/kerja (seperti istilah membumi) agar tidak merusak tata bahasa kalimat.
 */
export function sanitizeStorylineNarrative(narrative: string, actors: string[] = []): string {
  if (!narrative) return narrative;
  let cleaned = narrative;

  const defaultActor =
    actors.find((a) => !isSuperAdminRole(a) && !isExternalRole(a)) ||
    (actors.length > 1 ? actors[1] : 'Petugas');

  cleaned = cleaned.replace(/\b(tim\s+kami|tim\s+kita)\b/gi, defaultActor);
  cleaned = cleaned.replace(/\bkami\b/gi, defaultActor);
  // Jangan ganti 'kita' jika bagian dari frasa ajakan inklusif konsultan AI ("Mari kita", "Ayo kita", "Yuk kita")
  cleaned = cleaned.replace(/(?<!\b(?:mari|ayo|yuk)\s+)\bkita\b/gi, defaultActor);
  return cleaned;
}

interface AIStorylineResult {
  appName: string;
  businessCategory: string;
  templateId: string;
  overlayIds: string[];
  patternIds: string[];
  narasi: string;
  asumsiMasalah: string;
  asumsiAktor: string[];
  asumsiAlurUtama: string;
  detailAktor?: Record<string, { narasi: string; tanggungJawab: string[] }>;
  analisisArah?: AnalisisArahResult;
}

const CONFIRMATION_CLOSING = 'Apakah ini sudah menggambarkan proses bisnismu? Kalau ada yang beda, boleh langsung dikoreksi.';

/**
 * Menyusun cerita proses bisnis singkat (2-4 kalimat) murni berbasis AI tanpa istilah teknis (POIN 2 & 3).
 */
export async function generateStorylineWithAI(
  prompt: string,
  provider?: string,
  apiKey?: string,
  model?: string
): Promise<AIStorylineResult> {
  const systemInstruction = `Anda adalah Partner Diskusi & Konsultan Aplikasi AI dari platform "Aplikasi Generator".
Tugas Anda: Pertama-tama, nilai apakah input pengguna memang merupakan ide aplikasi/proses bisnis yang valid. Jika ya, rangkai cerita proses bisnis (2-4 kalimat) yang mengalir luwes, hidup, dan SANGAT SPESIFIK ke domain bisnis tersebut.

PANDUAN & ATURAN WAJIB (DIPATUHI KETAT):
0. ANALISIS KONSEPTUAL ARAH BISNIS (analisisArah - WAJIB):
   Analisis permintaan pengguna secara holistik untuk menyimpulkan salah satu dari EMPAT kondisi berikut:

   d) "BUKAN_IDE_BISNIS" (CEK INI PERTAMA KALI SEBELUM CEK LAINNYA):
      Jika input pengguna SAMA SEKALI TIDAK dapat diinterpretasikan sebagai ide aplikasi atau proses bisnis:
      - Kata navigasi/kontrol yang nyasar: "lanjut", "ok", "ya", "oke", "next", "yes", "back", "kembali", "stop", "cancel"
      - Input tidak bermakna/typo parah: huruf acak, karakter spesial tanpa konteks, angka saja
      - Kalimat bukan bisnis: pertanyaan umum, kalimat acak, atau teks yang tidak menyiratkan bisnis/aplikasi apapun
      JIKA kondisi ini terpenuhi, isi field "klarifikasiBukanIde" dan JANGAN isi field narasi/asumsiAktor/asumsiAlurUtama.
      Jika ada kemungkinan kecil sekalipun bahwa input merujuk ke domain bisnis (contoh: "salon", "bakso", "cuci"), JANGAN pilih BUKAN_IDE_BISNIS.

   Jika bukan BUKAN_IDE_BISNIS, analisis aktivitas frontliner / customer-facing untuk menyimpulkan salah satu dari tiga kondisi berikut:
   a) "SATU_ARAH":
      Aliran transaksi hanya SEARAH dari bisnis ke pelanggan (pelanggan memesan/dilayani dan membayar bisnis).
      * Kafe, kedai kopi, restoran, bakery, rumah makan: Pelanggan memesan hidangan/minuman dan membayar ke kasir. Memiliki variasi menu kafe dan resto BUKAN dua arah transaksi! Ini MURNI "SATU_ARAH".
      * Cuci mobil, klinik gigi/medis, salon, barbershop, apotek, toko baju, retail umum: Pelanggan memesan/dilayani dan membayar. Ini MURNI "SATU_ARAH".
      * Rental mobil/motor/kost: Alur linier satu arah dengan tahap serah dan terima (pelanggan sewa, serah-terima kunci, lalu pengembalian unit saat durasi sewa selesai) TETAP dianggap "SATU_ARAH", karena ini adalah satu proses berkesinambungan awal-akhir, bukan dua transaksi berlawanan!
      * Aktivitas sisipan/sesekali dengan modalitas rendah (misal bengkel yang "kadang juga jual sparepart") tetap "SATU_ARAH".
   b) "DUA_ARAH":
      HANYA JIKA ada dua jenis transaksi rutin dengan pelanggan yang ALIRANNYA BERLAWANAN (ada aliran barang/dana masuk DAN aliran barang/dana keluar):
      - Koperasi Simpan Pinjam: "Menerima simpanan/tabungan anggota (dana masuk)" vs "Menyalurkan pinjaman/kredit anggota (dana keluar)"
      - Toko Emas Jual-Beli: "Menjual perhiasan emas (barang keluar)" vs "Membeli emas bekas/buyback dari pelanggan (barang masuk)"
      - Pegadaian: "Penerimaan titip gadai (barang masuk, pinjaman cair)" vs "Penebusan barang gadai (pelunasan, barang kembali)"
      - Toko Jual Beli Motor / Mobil / HP Bekas: "Penjualan unit siap pakai (barang keluar)" vs "Pembelian / tukar tambah / appraisal unit bekas (barang masuk)"
      - Money Changer: "Pembelian valas dari nasabah" vs "Penjualan valas ke nasabah"
      
      ATURAN MUTLAK JIKA DUA_ARAH:
      1. KEPUTUSAN GABUNG/PISAH ROLE TIDAK BOLEH MEMANGKAS KEDALAMAN NARASI & ALUR BISNIS:
         - Keputusan apakah peran frontliner DIGABUNG atau DIPISAH HANYA menentukan pembagian akun pengguna/staf, SAMA SEKALI DILARANG menyederhanakan atau memangkas narasi proses bisnis!
         - Walaupun peran frontliner DIGABUNG (misal satu staf kasir/operasional), cerita di field "narasi" dan tahapan di "asumsiAlurUtama" WAJIB TETAP MERINCI SIKLUS LENGKAP KEDUA SISI TRANSAKSI!
      
      2. CAKUPAN SIKLUS PROSES KEDUA SISI (DILARANG MENYEMPITKAN PROSES HANYA KE TRANSAKSI KASIR):
         - Koperasi Simpan Pinjam:
           * Sisi SIMPAN (dana masuk): Anggota menyetor tabungan/simpanan sukarela, pencatatan buku tabungan & penambahan saldo simpanan.
           * Sisi PINJAM (dana keluar & siklus kredit): Anggota mengajukan permohonan pinjaman dana, petugas memverifikasi berkas & kelayakan kredit, dana pinjaman dicairkan kepada anggota, dan selanjutnya anggota membayar angsuran/cicilan berkala.
           * DILARANG KERAS menyempitkan sisi pinjam hanya menjadi "membayar cicilan di meja kasir"! Proses PENGAJUAN PINJAMAN, VERIFIKASI/ANALISIS KELAYAKAN, dan PENCAIRAN DANA PINJAMAN WAJIB tertulis eksplisit di "narasi" dan "asumsiAlurUtama"!
         - Toko Emas Jual-Beli:
           * Sisi JUAL: Pelanggan memilih perhiasan di etalase, cek kadar/gramasi, cetak nota/surat emas resmi.
           * Sisi BELI/BUYBACK: Pelanggan membawa emas lama, penaksir menguji kadar/gosok batu uji/timbang presisi, penetapan harga taksiran, hingga penyerahan uang buyback ke pelanggan.
         - Toko Jual Beli Motor / Mobil / HP Bekas:
           * Sisi JUAL: Konsumen memilih unit siap pakai di display/showroom, negosiasi harga, pembayaran, dan serah terima unit & surat kendaraan.
           * Sisi BELI/TUKAR TAMBAH: Konsumen membawa kendaraan lama, petugas melakukan appraisal teknis (cek nomor mesin, fisik rangka, kilometer, dan BPKB), penaksiran harga beli, dan pembayaran dana ke konsumen.
         - Money Changer:
           * Sisi BELI VALAS: Nasabah membawa mata uang asing, teller memeriksa keaslian uang dengan detektor UV, menghitung kurs beli, dan menyerahkan uang Rupiah.
           * Sisi JUAL VALAS: Nasabah membutuhkan valas untuk bepergian, teller menghitung kurs jual, menerima pembayaran Rupiah, dan menyerahkan pecahan mata uang asing.

      3. ANALISIS PEMISAHAN ROLE FRONTLINER (pemisahanRole - WAJIB DIISI DENGAN UJI DIAGNOSTIK):
         Analisis peran frontliner yang bertugas di kedua sisi transaksi (Kasus A dan Kasus B):
         Apakah tugas/keahlian yang dibutuhkan di sisi A cukup berbeda dari sisi B sehingga sebaiknya jadi DUA ROLE TERPISAH, atau wajar DIGABUNG jadi SATU ROLE?

          PERTANYAAN UJI PENENTU (THE DIAGNOSTIC LITMUS TEST):
          "Apakah salah satu sisi transaksi membutuhkan keahlian/alat diagnostik teknis untuk memeriksa kondisi fisik atau kerusakan tersembunyi pada barang bekas (seperti HP, laptop, kamera, motor, emas)?"

          A. KONDISI WAJIB "PISAH" (HANYA UNTUK BISNIS SPESIALIS SATU KATEGORI BARANG BERISIKO TINGGI):
             Bisnis berfokus pada SATU KATEGORI barang teknis/bernilai tinggi di mana appraisal teknis merupakan kompetensi inti bervolume tinggi yang membutuhkan alat diagnostik khusus (laboratorium/checker) untuk mendeteksi kerusakan tersembunyi yang fatal:
             - Toko Jual Beli HP / Gadget / Tablet: Menaksir HP bekas butuh pengecekan nomor IMEI & status blacklist Kemenperin, kesehatan baterai (battery health), true tone & kondisi fisik layar/touchscreen, fungsi kamera & sensor (WAJIB PISAH: "Sales Counter HP Baru" vs "Petugas Appraisal HP Bekas").
             - Toko Jual Beli Laptop / Komputer: Menaksir laptop bekas butuh uji spesifikasi hardware, kesehatan SSD/HDD, tes stress CPU/GPU & suhu thermal, tes baterai & keyboard (WAJIB PISAH: "Sales Laptop Baru" vs "Teknisi Appraisal Laptop Bekas").
             - Toko Jual Beli Kamera / Lensa: Menaksir kamera bekas butuh cek shutter count, jamur/fogging pada elemen optik lensa, fungsi motor autofocus, dan kebersihan sensor (WAJIB PISAH: "Sales Kamera Baru" vs "Petugas Appraisal Kamera & Lensa").
             - Showroom Jual Beli Sepeda Motor / Mobil: Menaksir kendaraan bekas butuh inspeksi teknis nomor mesin & rangka, cek keaslian BPKB/STNK, cek riwayat kilometer, uji transmisi & kebocoran oli mesin (WAJIB PISAH: "Sales Showroom Motor Baru" vs "Petugas Appraisal Motor Bekas").
             - Toko Emas Jual-Beli: Menaksir emas bekas butuh uji karat dengan batu uji & asam nitrat, timbangan digital presisi karat, atau alat uji XRF (WAJIB PISAH: "Sales Display Perhiasan" vs "Penaksir Emas / Buyback").

          B. KONDISI WAJIB "GABUNG" (UNTUK TOKO CAMPURAN/GENERALIS & TRANSAKSI KEUANGAN/LOKET):
             1. Toko Barang Bekas Campuran / Generalis / Loak / Antik:
                Menerima dan menjual barang bekas CAMPURAN/beragam kategori (perabotan, loakan, buku, pakaian, pajangan, barang antik campuran). Penaksiran di sini bersifat penilaian fisik umum/kasar secara kasat mata, BUKAN kompetensi diagnostik laboratorium mendalam pada satu bidang tertentu, sehingga wajar ditangani oleh satu peran frontliner multi-fungsi (WAJIB GABUNG: "Staf Toko Barang Bekas" atau "Kasir & Penerima Barang").
             2. Transaksi Finansial, Valas, Simpan Pinjam, atau Kasir Sembako:
                Murni aliran uang kasir simetris tanpa pengujian fisik barang bekas:
                - Money Changer: Teller melayani nasabah yang membeli maupun menjual mata uang asing di satu loket yang sama dengan detektor UV standar (WAJIB GABUNG: "Teller Valas"). Dilarang membuat Teller Jual dan Teller Beli terpisah!
                - Koperasi Simpan Pinjam: Staf operasional/kasir melayani anggota untuk setoran tabungan maupun pengajuan permohonan pinjaman di meja layanan yang sama (WAJIB GABUNG: "Kasir Operasional"). Dilarang memisahkan kasir setor dan kasir pinjam!
                - Agen Bank / Loket PPOB: Operator loket melayani transaksi setor tunai maupun tarik tunai (WAJIB GABUNG: "Operator Loket").
                - Warung Sembako / Toko Kelontong: Kasir melayani belanja sembako dan penukaran fisik galon/tabung gas kosong (WAJIB GABUNG: "Kasir Toko").

          ATURAN MUTLAK DAFTAR AKTOR (asumsiAktor) SESUAI HASIL UJI:
          - Jika GABUNG: "asumsiAktor" WAJIB HANYA memuat SATU peran frontliner gabungan (misal: "Staf Toko Barang Bekas", "Teller Valas", "Operator Loket", "Kasir Toko", "Kasir Operasional"). Dilarang memecah menjadi dua kasir per arah!
            Tanggung jawab di "detailAktor" WAJIB ditulis eksplisit merinci kedua sisi tanpa kata "atau" yang mengaburkan (misal: "melayani penjualan barang bekas serta penerimaan barang bekas yang dibawa pelanggan", "menghitung kurs transaksi penjualan valas maupun pembelian valas nasabah", "mencatat transaksi penyetoran tunai serta penarikan tunai nasabah", "melayani penerimaan setoran tabungan simpanan serta pemrosesan berkas permohonan pinjaman anggota").
          - Jika PISAH: "asumsiAktor" WAJIB memunculkan kedua peran spesifik per sisi (misal: "Sales Counter HP Baru" dan "Petugas Appraisal HP Bekas"), dan buatkan detail tanggung jawab masing-masing di "detailAktor".

      Sebutkan nama kedua arah dan analisis pemisahan role di objek "duaArah":
      {
        "prosesA": "...",
        "prosesB": "...",
        "entitasBersama": "...",
        "pemisahanRole": {
          "keputusan": "PISAH" | "GABUNG",
          "alasan": "Alasan konseptual transparan mengapa dipisah atau digabung",
          "roleKasusA": "Nama role frontliner untuk proses A (jika PISAH)",
          "roleKasusB": "Nama role frontliner untuk proses B (jika PISAH)"
        }
      }
   c) "AMBIGU" (ATURAN PRIORITAS UNTUK PROMPT SINGKAT TANPA DETAIL ARAH):
      JIKA permintaan pengguna menyebut nama usaha umum tanpa kata arah/transaksi (contoh: "buatkan aplikasi toko emas", "aplikasi pegadaian", "showroom motor", "dealer mobil", "koperasi") TANPA menyebutkan secara spesifik apakah hanya satu arah atau dua arah:
      AI DILARANG MENEBAK SENDIRI apakah satu arah atau dua arah! AI WAJIB menyimpulkan "AMBIGU".
      CATATAN PENTING: Jika pengguna SUDAH secara eksplisit menyebutkan kedua arah transaksi (seperti "jual beli", "simpan pinjam", "tukar tambah", "jual dan beli emas"), maka itu SUDAH JELAS "DUA_ARAH", DILARANG disimpulkan sebagai AMBIGU!
      
      Jika kondisi AMBIGU, AI WAJIB mengisi objek "klarifikasiAmbigu" dengan pertanyaan ramah dan natural sesuai konteks domain tersebut:
      {
        "pertanyaan": "Pertanyaan ramah memastikan fokus arah bisnis (contoh: Toko emas ini fokusnya menjual perhiasan ke pelanggan, menerima pembelian emas bekas, atau dua-duanya?)",
        "opsiA": "Arah bisnis A (contoh: Penjualan perhiasan ke pelanggan)",
        "opsiB": "Arah bisnis B (contoh: Pembelian emas bekas dari pelanggan)",
        "opsiBoth": "Dua-duanya (keterangan)"
      }

   ATURAN PEMISAHAN ROLE (untuk kondisi DUA_ARAH):
   Percayakan sepenuhnya analisis pemisahan role kepada penilaian konseptual AI. Gunakan "Diagnostic Litmus Test" secara mandiri:
   - PISAH jika satu sisi membutuhkan kompetensi teknis/alat diagnostik SPESIALIS yang berbeda (HP bekas, motor, emas, kamera, laptop)
   - GABUNG jika kedua sisi merupakan administrasi kasir simetris atau toko barang bekas campuran/generalis
   Sistem TIDAK akan meng-override keputusan ini — tanggung jawab penuh ada pada analisis AI.

1. STRUKTUR ALUR CERITA LENGKAP END-TO-END BERTAHAP (WAJIB 3 FASE - DILARANG MELOMPAT):
   Narasi cerita (2-4 kalimat) DILARANG melompat langsung ke tengah proses (seperti langsung menimbang barang di timbangan atau langsung cetak nota kasir). Cerita WAJIB merangkai alur lengkap berkesinambungan yang memuat 3 tahapan kronologis:
   a) Fase Pembuka (Titik Awal Interaksi):
      Pelanggan/warga/sumber barang mendatangi tempat usaha membawa barang/kebutuhan, atau petugas lapangan mendatangi lokasi sumber barang untuk penjemputan.
   b) Fase Inti Operasional (Penanganan Fisik & Layanan Lapangan):
      Staf/petugas memeriksa kondisi fisik, memilah jenis material/layanan, dan menimbang/menguji kelayakan dengan alat ukur presisi di tempat.
   c) Fase Penutup (Penyelesaian Transaksi & Rekonsiliasi):
      Pencatatan nota transaksi/tanda terima, pembayaran tunai/transfer ke pelanggan/warga, dan pelaporan berkala ke buku rekapitulasi pemilik.

2. OBJEK FISIK & AKTIVITAS SPESIFIK DOMAIN (WAJIB):
   - Cerita WAJIB menyebutkan minimal satu detail aktivitas atau objek fisik nyata yang spesifik ke domain bisnis yang diminta pengguna.
   - Contoh objek/aktivitas konkret:
     * Cuci mobil: selang air bertekanan, vakum interior, sabun salju, pengering chamois, plat nomor kendaraan, antrean slot cuci.
     * Klinik dokter gigi: dental chair (kursi periksa), rekam medis keluhan gigi/rongga mulut, alat rontgen/sterilisasi gigi, resep obat, jadwal penambalan/pembersihan karang gigi.
     * Laundry kiloan: timbangan digital cucian, pemilahan baju luntur/halus, mesin cuci/dryer, setrika uap, plastik packing wangi, nota kiloan.
     * Kafe / Bakery: racikan biji kopi espresso, display etalase kue/roti, tiket pesanan dapur, cetak struk kasir, meja barista.
     * Bengkel motor/mobil: estimasi sparepart/oli, montir mengecek mesin, nota servis berkala, riwayat kilometer kendaraan.
   - DILARANG KERAS menggunakan frasa generik lintas-industri seperti: "tim di lapangan", "aktivitas harian", "layanan pelanggan", "tim melayani secara teratur" tanpa detail konkret tambahan!

3. PERAN SPESIFIK & MANUSIAWI (asumsiAktor) BESERTA DETAIL PERAN (detailAktor):
   - asumsiAktor WAJIB berisi istilah pekerjaan konkret di lapangan sesuai domain (contoh untuk cuci mobil: "Super Admin", "Kasir Penerima Kendaraan", "Staf Cuci & Lap", "Pelanggan").
   - DILARANG memakai sebutan generik abstrak seperti "Staf Operasional", "Operator", "Pegawai", atau "Tim Lapangan".
   - Selalu sertakan "Super Admin" sebagai peran pemilik/pengelola tertinggi.
   - ATURAN WAJIB SUPER ADMIN (PENGATURAN USER/PENGGUNA DI SEMUA DOMAIN):
     Tanggung jawab Super Admin WAJIB SELALU secara eksplisit mencakup pengaturan pengguna/user (menambah/menghapus akun staf, menetapkan peran, dan hak akses aplikasi) di SEMUA domain bisnis tanpa terkecuali, terlepas apakah ada peran tata kelola/kebijakan bisnis terpisah atau tidak.
   - ATURAN GROUNDING & DEDUPLIKASI KONSEPTUAL (WAJIB):
     * Setiap peran dalam asumsiAktor HARUS memiliki dasar konseptual yang jelas dan terlibat langsung dalam alur narasi yang diceritakan. JANGAN memunculkan peran seperti "Operator", "Viewer", atau artefak teknis lain yang tidak ada di cerita!
     * Jika narasi hanya menceritakan satu peran staf frontliner yang sama yang melayani kedua arah (misal teller atau kasir), MAKA asumsiAktor HANYA BOLEH berisi 1 peran frontliner tersebut, DILARANG memunculkan peran duplikat/buatan yang fungsinya sama persis!
     * DILARANG memunculkan dua peran kasir semu seperti "Kasir Penjualan" dan "Kasir Pembelian" jika jenis keahlian keduanya sama persis (misal di money changer atau warung sembako). Gunakan SATU peran representatif (misal "Teller Valas" atau "Kasir Toko").
     * Format asumsiAktor WAJIB berupa array of string sederhana: ["Super Admin", "Peran Frontliner", "Pelanggan"]. DILARANG membuat format gabungan seperti ["Kasir (Sales & Pembelian)"]!

4. TAHAPAN ALUR UTAMA (asumsiAlurUtama):
   - Format: "Langkah 1 -> Langkah 2 -> Langkah 3 -> Langkah 4".
   - Tuliskan 3-5 tahapan konkret dari awal interaksi pelanggan sampai akhir proses.
   - DILARANG memakai kalimat umum seperti "Pelanggan memesan -> Petugas memproses -> Pemilik memantau".
   - Jika kondisi DUA_ARAH, alur utama WAJIB merangkum kedua siklus transaksi secara nyata dan berimbang.
     Contoh nyata Koperasi Simpan Pinjam: "Anggota menyetor tabungan & kasir mencatat saldo buku -> Anggota mengajukan pinjaman dana -> Petugas memverifikasi kelayakan & mencairkan dana pinjaman -> Anggota membayar cicilan berkala -> Pengurus memantau rekap simpan pinjam".

5. ATURAN SELF-CHECK EKSPLISIT (WAJIB DIIKUTI):
   Uji Konteks Domain:
   "Sebelum menampilkan cerita, cek apakah alur ini bisa dipakai untuk industri lain tanpa berubah signifikan selain nama aplikasi — kalau ya, tulis ulang dengan detail yang lebih spesifik ke domain yang diminta."

6. STRUKTUR NARASI: 2-3 KALIMAT CERITA OPERASIONAL + KALIMAT PENUTUP KONFIRMASI:
   - JANGAN membuat kalimat sapaan/pembuka (seperti pujian, evaluasi ide, atau 'mari kita lihat...'). Kalimat pembuka standar sudah ditangani langsung oleh sistem di luar AI.
   - Field "narasi" WAJIB HANYA berisi 2-3 kalimat cerita alur operasional bisnis konkret (3 fase: Fase awal kedatangan/permintaan -> Fase penanganan fisik/layanan oleh staf dengan alat presisi -> Fase pembayaran/tanda terima).
   - Gunakan bahasa Indonesia sehari-hari yang santun, luwes, dan membumi (sebut "mencuci kendaraan" bukan "menggosok bodi"; sebut "menimbang barang" bukan "melakukan pengukuran massa").
   - DILARANG KERAS menggunakan kata teknis IT/software (CRUD, database, API, backend, dsb.). Ceritakan murni interaksi manusia dan barang nyata!

7. SUDUT PANDANG (WAJIB PIHAK KETIGA OBJEKTIF):
   - Narasi cerita WAJIB ditulis dari sudut pandang PIHAK KETIGA OBJEKTIF yang mendeskripsikan bagaimana bisnis ini berjalan pada umumnya secara netral.
   - DILARANG KERAS menggunakan kata ganti orang pertama jamak seperti "kami", "kita", atau "tim kami" untuk merujuk pelaku bisnis (contoh SALAH: "Tim kami langsung mencuci kendaraan...", "Setelah itu kami mencatat pembayaran...").
   - Sebut nama peran/aktor spesifik secara langsung sebagai subjek kalimat (contoh: sebut nama peran nyata seperti Kasir, Washer, Dokter Gigi, Petugas Gudang, atau Pelanggan, bukan menggunakan 'tim kami').
   - Peran yang disebut dalam narasi HARUS KONSISTEN dan PERSIS SAMA dengan yang dicantumkan di asumsiAktor (bukan istilah generik).

8. KALIMAT PENUTUP WAJIB:
   Akhiri narasi cerita DENGAN PERSIS KALIMAT INI:
   "${CONFIRMATION_CLOSING}"

9. FORMAT OUTPUT HANYA JSON VALID:
{
  "analisisArah": {
    "kondisi": "SATU_ARAH" | "DUA_ARAH" | "AMBIGU" | "BUKAN_IDE_BISNIS",
    "alasan": "Penjelasan konseptual mengapa dinilai satu arah, dua arah, ambigu, atau bukan ide bisnis",
    "duaArah": {
      "prosesA": "Nama proses transaksi keluar/penjualan/setoran (jika DUA_ARAH)",
      "prosesB": "Nama proses transaksi masuk/pembelian/pinjaman (jika DUA_ARAH)",
      "entitasBersama": "Objek/barang/dana utama yang terlibat",
      "pemisahanRole": {
        "keputusan": "PISAH" | "GABUNG",
        "alasan": "Alasan konseptual mengapa dipisah atau digabung berdasarkan Diagnostic Litmus Test",
        "roleKasusA": "Nama role frontliner kasus A (jika PISAH)",
        "roleKasusB": "Nama role frontliner kasus B (jika PISAH)"
      }
    },
    "klarifikasiAmbigu": {
      "sapaan": "Sapaan ramah dan pembuka kontekstual ke ide bisnis pengguna (tanpa kata klise)",
      "pertanyaan": "Pertanyaan ramah memastikan fokus arah bisnis (jika AMBIGU)",
      "opsiA": "Arah bisnis A",
      "opsiB": "Arah bisnis B",
      "opsiBoth": "Dua-duanya (keterangan)"
    },
    "klarifikasiBukanIde": {
      "pesanKlarifikasi": "Kalimat ramah dan singkat yang menjelaskan bahwa input tidak teridentifikasi sebagai ide bisnis, dan meminta pengguna untuk mendeskripsikan ide aplikasi/bisnis mereka. Contoh: 'Halo! Sepertinya input tadi bukan deskripsi ide bisnis. Boleh ceritakan aplikasi apa yang ingin kamu bangun?'"
    }
  },
  "appName": "Nama aplikasi kreatif & spesifik domain (kosong jika BUKAN_IDE_BISNIS)",
  "businessCategory": "Kategori industri konkret (kosong jika BUKAN_IDE_BISNIS)",
  "narasi": "2-3 kalimat cerita proses bisnis nyata (fase datang -> fase layanan -> fase bayar). ${CONFIRMATION_CLOSING} (kosong jika BUKAN_IDE_BISNIS)",
  "asumsiMasalah": "Masalah operasional fisik/pencatatan nyata yang dihadapi",
  "asumsiAktor": ["Super Admin", "Peran Spesifik 1", "Peran Spesifik 2", "Pelanggan"],
  "asumsiAlurUtama": "Aktivitas nyata 1 -> Aktivitas nyata 2 -> Aktivitas nyata 3 -> Pemilik memantau rekap",
  "detailAktor": {
    "Super Admin": {
      "narasi": "Pemilik usaha atau penanggung jawab utama operasional...",
      "tanggungJawab": ["Mendaftarkan dan mengelola akun pengguna, penugasan staf, serta penetapan hak akses aplikasi", "Memantau laporan omzet dan transaksi harian", "Mengatur konfigurasi dan parameter operasional aplikasi"]
    },
    "Peran Spesifik 1": {
      "narasi": "1-2 kalimat penjelasan peran yang digrounding langsung ke cerita nyata...",
      "tanggungJawab": ["Aktivitas konkret 1 dari cerita", "Aktivitas konkret 2 dari cerita", "Aktivitas konkret 3"]
    }
  }
}`;

  const raw = await invokeAIChat({
    systemInstruction,
    userPrompt: `Permintaan Pengguna: "${prompt}"\nLangkah 1: Nilai apakah ini ide bisnis/aplikasi yang valid (jika tidak, kembalikan kondisi BUKAN_IDE_BISNIS). Langkah 2: Jika valid, analisis arah bisnis (SATU_ARAH, DUA_ARAH, atau AMBIGU) dan analisis pemisahan role frontliner berdasarkan Diagnostic Litmus Test jika DUA_ARAH, susun cerita proses bisnis yang hangat dan hidup memuat aktivitas konkret, lalu ekstrak semua field terstruktur:`,
    temperature: 0.6,
    maxTokens: 4000,
    provider,
    userApiKey: apiKey,
    userModel: model
  });

  if (raw) {
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const businessCategory = String(parsed.businessCategory || '').trim() || 'Bisnis Anda';
        const appName =
          String(parsed.appName || '').trim() ||
          (businessCategory.toLowerCase().startsWith('aplikasi') ? businessCategory : `Aplikasi ${businessCategory}`);
        let narasi = String(parsed.narasi || '').trim();
        if (!narasi.toLowerCase().includes('apakah ini sudah menggambarkan proses bisnismu')) {
          narasi = narasi ? `${narasi} ${CONFIRMATION_CLOSING}` : CONFIRMATION_CLOSING;
        }

        const asumsiAktor =
          Array.isArray(parsed.asumsiAktor) && parsed.asumsiAktor.length > 0
            ? parsed.asumsiAktor.map(String)
            : ['Super Admin', 'Staf Layanan', 'Pelanggan'];

        let detailAktor: Record<string, { narasi: string; tanggungJawab: string[] }> | undefined = undefined;
        if (parsed.detailAktor && typeof parsed.detailAktor === 'object') {
          detailAktor = {};
          for (const [k, v] of Object.entries(parsed.detailAktor)) {
            if (v && typeof v === 'object') {
              const obj = v as any;
              const rawTasks = Array.isArray(obj.tanggungJawab) ? obj.tanggungJawab.map(String) : [];
              // Sanitasi kata "atau" yang mengaburkan tanggung jawab ganda
              const sanitizedTasks = rawTasks.map((t: string) => {
                let s = t;
                s = s.replace(/\bjual\s+beli\s+atau\s+tukar\s*tambah\b/gi, 'penjualan serta penerimaan unit tukar tambah');
                s = s.replace(/\bpenjualan\s+atau\s+pembelian\b/gi, 'penjualan maupun pembelian');
                s = s.replace(/\bsimpan\s*pinjam\s+atau\s+kredit\b/gi, 'simpanan serta penyaluran kredit');
                s = s.replace(/\bsetor\s+atau\s+tarik\b/gi, 'setoran maupun penarikan');
                return s;
              });
              detailAktor[k] = {
                narasi: String(obj.narasi || '').trim(),
                tanggungJawab: sanitizedTasks
              };
            }
          }
        }

        let analisisArah: AnalisisArahResult | undefined = undefined;
        if (parsed.analisisArah && typeof parsed.analisisArah === 'object') {
          const rawArah = parsed.analisisArah;
          const kondisi: KondisiArahBisnis = (['SATU_ARAH', 'DUA_ARAH', 'AMBIGU', 'BUKAN_IDE_BISNIS'].includes(rawArah.kondisi)
            ? rawArah.kondisi
            : 'SATU_ARAH') as KondisiArahBisnis;

          // Jika AI mendeteksi BUKAN_IDE_BISNIS, return langsung tanpa proses lebih lanjut
          if (kondisi === 'BUKAN_IDE_BISNIS') {
            const pesanKlarifikasi = rawArah.klarifikasiBukanIde?.pesanKlarifikasi
              ? String(rawArah.klarifikasiBukanIde.pesanKlarifikasi).trim()
              : 'Halo! Sepertinya input tadi bukan deskripsi ide bisnis atau aplikasi. Boleh ceritakan lebih detail, aplikasi apa yang ingin kamu bangun?';
            return {
              appName: '',
              businessCategory: '',
              templateId: 'MT-20',
              overlayIds: [],
              patternIds: [],
              narasi: '',
              asumsiMasalah: '',
              asumsiAktor: [],
              asumsiAlurUtama: '',
              analisisArah: {
                kondisi: 'BUKAN_IDE_BISNIS',
                alasan: String(rawArah.alasan || '').trim(),
                klarifikasiBukanIde: { pesanKlarifikasi }
              }
            };
          }

          // Percayakan keputusan pemisahanRole sepenuhnya kepada AI (tanpa keyword override)
          let pemisahanRole: PemisahanRoleResult | undefined = undefined;
          if (rawArah.duaArah?.pemisahanRole && typeof rawArah.duaArah.pemisahanRole === 'object') {
            const rawPr = rawArah.duaArah.pemisahanRole;
            const finalKeputusan: 'PISAH' | 'GABUNG' = rawPr.keputusan === 'PISAH' ? 'PISAH' : 'GABUNG';
            const finalAlasan = String(rawPr.alasan || '').trim();
            const roleKasusA = rawPr.roleKasusA ? String(rawPr.roleKasusA).trim() : undefined;
            const roleKasusB = rawPr.roleKasusB ? String(rawPr.roleKasusB).trim() : undefined;

            pemisahanRole = {
              keputusan: finalKeputusan,
              alasan: finalAlasan,
              roleKasusA,
              roleKasusB
            };
          }

          analisisArah = {
            kondisi,
            alasan: String(rawArah.alasan || '').trim(),
            duaArah: rawArah.duaArah ? {
              prosesA: String(rawArah.duaArah.prosesA || '').trim(),
              prosesB: String(rawArah.duaArah.prosesB || '').trim(),
              entitasBersama: String(rawArah.duaArah.entitasBersama || '').trim(),
              pemisahanRole
            } : undefined,
            klarifikasiAmbigu: rawArah.klarifikasiAmbigu ? {
              sapaan: rawArah.klarifikasiAmbigu.sapaan ? String(rawArah.klarifikasiAmbigu.sapaan).trim() : undefined,
              pertanyaan: String(rawArah.klarifikasiAmbigu.pertanyaan || '').trim(),
              opsiA: String(rawArah.klarifikasiAmbigu.opsiA || '').trim(),
              opsiB: String(rawArah.klarifikasiAmbigu.opsiB || '').trim(),
              opsiBoth: String(rawArah.klarifikasiAmbigu.opsiBoth || '').trim()
            } : undefined,
            klarifikasiBukanIde: rawArah.klarifikasiBukanIde?.pesanKlarifikasi ? {
              pesanKlarifikasi: String(rawArah.klarifikasiBukanIde.pesanKlarifikasi).trim()
            } : undefined
          };
        }

        // Peran yang dikembalikan AI sudah digrounding sesuai analisis konseptual — tidak perlu override

        // Lapis 1: Sanitasi kata ganti orang pertama jamak ("kami/kita") murni pada kata gantinya saja
        narasi = sanitizeStorylineNarrative(narasi, asumsiAktor);

        // Lapis 2: Kalimat pembuka dibuat TETAP/HARDCODE di kode secara deterministik (Bukan AI-Generated)
        // Format: "Berikut adalah flow proses bisnis dari [nama bisnis/aplikasi yang diminta user]."
        const standardGreeting = buildStandardGreeting(prompt, businessCategory);
        narasi = ensureStandardGreetingInNarasi(narasi, standardGreeting);

        // Lapis 3: Jika kata 'menarik' masih tersisa di narasi secara tak sengaja, bersihkan secara kontekstual
        if (/\bmenarik(?:nya|kan|an|lah|kah|pun)?\b/i.test(narasi)) {
          narasi = narasi
            .replace(/bisa menjadi pengalaman yang menarik/gi, 'memiliki dinamika dan ritme tersendiri')
            .replace(/\b(sangat\s+|cukup\s+)?menarik(?:nya|kan|an|lah|kah|pun)?\b/gi, 'tersendiri');
        }

        if (!narasi.toLowerCase().includes('apakah ini sudah menggambarkan proses bisnismu')) {
          narasi = narasi ? `${narasi} ${CONFIRMATION_CLOSING}` : CONFIRMATION_CLOSING;
        }

        narasi = sanitizeStorylineNarrative(narasi, asumsiAktor);

        return {
          appName,
          businessCategory,
          templateId: 'MT-20',
          overlayIds: [],
          patternIds: [],
          narasi,
          asumsiMasalah:
            String(parsed.asumsiMasalah || '').trim() ||
            `Pengelolaan antrean dan pencatatan riwayat layanan ${businessCategory} rawan tercecer jika tanpa alur yang rapi.`,
          asumsiAktor,
          asumsiAlurUtama:
            String(parsed.asumsiAlurUtama || '').trim() ||
            'Pelanggan mendaftar -> Petugas mengerjakan layanan -> Pembayaran & struk -> Pemilik mengecek rekap',
          detailAktor,
          analisisArah
        };
      }
    } catch (e) {
      console.warn('Gagal mem-parse JSON hasil generateStorylineWithAI:', e);
    }
  }

  // Fallback generik jika AI tidak merespons (tanpa keyword-based domain overrides)
  const cleanPrompt = prompt.trim();

  let fallbackAppName = `Aplikasi ${cleanPrompt.slice(0, 30)}`;
  let fallbackCategory = cleanPrompt.slice(0, 40) || 'Bisnis Anda';
  const fallbackGreeting = buildStandardGreeting(prompt, fallbackCategory);
  let fallbackNarasi = `${fallbackGreeting} Pelanggan menyampaikan pesanan atau kebutuhan layanan, petugas operasional memproses pekerjaan dengan teliti, kemudian pembayaran diselesaikan di kasir dengan tanda terima yang rapi agar pemilik usaha dapat memantau rekapan secara berkala. ${CONFIRMATION_CLOSING}`;
  let fallbackAktor = ['Super Admin', 'Staf Kasir', 'Pelanggan'];
  let fallbackAlur = 'Pelanggan memesan -> Petugas memproses di lokasi -> Pembayaran tercatat -> Pemilik melihat rekap';
  let fallbackDetailAktor: Record<string, { narasi: string; tanggungJawab: string[] }> = {
    'Super Admin': {
      narasi: `Pemilik usaha atau penanggung jawab utama operasional ${fallbackCategory}. Memastikan alur kerja berjalan tertib, mengelola akun pengguna serta staf bertugas, dan memantau omzet harian.`,
      tanggungJawab: ['Mendaftarkan dan mengelola akun pengguna, penugasan staf, serta penetapan hak akses aplikasi', 'Memantau transaksi dan omzet harian operasional', 'Mengatur konfigurasi dan parameter operasional aplikasi']
    }
  };

  return {
    appName: fallbackAppName,
    businessCategory: fallbackCategory,
    templateId: 'MT-20',
    overlayIds: [],
    patternIds: [],
    narasi: fallbackNarasi,
    asumsiMasalah: `Pencatatan antrean dan alur kerja di ${fallbackCategory} membutuhkan koordinasi yang rapi agar tidak ada yang terlewat.`,
    asumsiAktor: fallbackAktor,
    asumsiAlurUtama: fallbackAlur,
    detailAktor: fallbackDetailAktor
  };
}

/**
 * Memperbarui narasi cerita dan asumsi alur/aktor berdasarkan koreksi pengguna (POIN 2).
 */
async function refineStorylineWithAI(
  previousStoryline: NonNullable<MockupSessionState['storyline']>,
  userFeedback: string,
  isClarificationAnswer: boolean,
  provider?: string,
  apiKey?: string,
  model?: string
): Promise<{
  narasi: string;
  asumsiMasalah: string;
  asumsiAktor: string[];
  asumsiAlurUtama: string;
}> {
  const systemInstruction = `Anda adalah Partner Diskusi & Konsultan Aplikasi AI dari platform "Aplikasi Generator".
Tugas Anda: Memperbarui cerita dan asumsi proses bisnis berdasarkan masukan atau koreksi dari pengguna dengan gaya bahasa yang hangat, ramah, dan SANGAT SPESIFIK ke domain bisnis terkait.

ATURAN WAJIB (PRINSIP KUMULATIF & PRESERVASI MUTLAK):
1. PRINSIP KUMULATIF & PRESERVASI FAKTA LAMA (PALING KRUSIAL & MUTLAK):
   - "Cerita Sebelumnya" adalah satu-satunya sumber kebenaran yang WAJIB dipertahankan utuh.
   - Anda WAJIB MEMPERTAHANKAN SEMUA detail fakta operasional, aktivitas fisik nyata, lokasi kerja (misal: rumah warga vs gudang vs toko), alur kerja, dan nama peran yang SUDAH ADA di Cerita Sebelumnya.
   - Masukan / koreksi pengguna HANYA menambal, mengoreksi, atau menambahkan bagian spesifik yang secara eksplisit disinggung.
   - DILARANG KERAS MENGHAPUS, MENYEDERHANAKAN, ATAU MENGUBAH detail fakta yang tidak disinggung pengguna!
     * Contoh: Jika di cerita sebelumnya sudah ada detail tahapan lanjutan (misal: verifikasi akhir atau serah terima), dan koreksi pengguna terbaru hanya membahas perubahan pada tahap awal transaksi, Anda WAJIB TETAP MEMPERTAHANKAN seluruh tahapan lanjutan yang tidak dikoreksi secara utuh!
     * Jangan pernah menghilangkan alur lanjutan, pengecekan, atau rekonsiliasi yang sudah pernah disepakati di putaran sebelumnya kecuali pengguna secara eksplisit meminta menghapusnya.

2. FLEKSIBILITAS LOKASI & WAKTU PELAKSANAAN:
   - Waktu dan titik transaksi WAJIB mengikuti instruksi pengguna dan logika operasional bisnis nyata:
     * Jika pengguna menyatakan suatu aksi dilakukan di tempat tertentu pada awal alur, MAKA aksi tersebut terjadi di sana sesuai penegasan pengguna.
     * DILARANG memindahkan atau menunda tahapan jika pengguna sudah menegaskan waktu atau lokasinya!
     * Alur lanjutan adalah untuk pemrosesan berikutnya, pencatatan akhir, dan rekonsiliasi berkala pemilik.

3. STRUKTUR LENGKAP TANPA PEMOTONGAN (3-6 KALIMAT):
   - Rangkai kembali cerita secara utuh dari hulu ke hilir dengan 3-6 kalimat lengkap yang kaya detail konkret.
   - JANGAN memotong atau meringkas proses operasional hanya demi membuat kalimat pendek. Semua detail penting yang sudah disepakati harus tetap hadir.

4. NADA HANGAT & BERSAHABAT: Tanggapi koreksi pengguna dengan positif, apresiatif, dan suportif.

5. PERAN DAN ALUR SPESIFIK:
   - asumsiAktor WAJIB mencantumkan nama pekerjaan nyata sesuai domain bisnis pengguna (bukan sekadar label generik polos jika ada peran spesifik yang disebutkan di cerita). Selalu sertakan "Super Admin".
   - asumsiAlurUtama WAJIB urutan aksi fisik nyata di lokasi kerja yang mencerminkan keseluruhan alur secara kumulatif.

6. ATURAN SELF-CHECK EKSPLISIT:
   "Sebelum menampilkan cerita, cek: Apakah ada fakta lama dari Cerita Sebelumnya yang hilang atau mundur? Jika ada yang hilang, tambahkan kembali sebelum mengirim hasil."

7. TANPA ISTILAH TEKNIS: DILARANG KERAS menggunakan istilah teknis IT/coding/database (seperti CRUD, database, API, tabel, skema, backend). Ceritakan alur aktivitas kerja nyata manusia!

8. KALIMAT PENUTUP WAJIB: Akhiri narasi cerita DENGAN PERSIS KALIMAT INI:
"${CONFIRMATION_CLOSING}"

9. PERBARUI FIELD DALAM FORMAT JSON:
{
  "narasi": "Cerita lengkap kumulatif yang hangat, memuat seluruh detail operasional konkret tanpa ada yang hilang, dan ditutup dengan kalimat konfirmasi wajib.",
  "asumsiMasalah": "Masalah utama yang diselesaikan",
  "asumsiAktor": ["Super Admin", "..."],
  "asumsiAlurUtama": "Rangkuman alur fisik lengkap kumulatif dari hulu ke hilir"
}`;

  const riwayatText =
    previousStoryline.riwayatKoreksi && previousStoryline.riwayatKoreksi.length > 0
      ? `\n\nRiwayat Catatan / Koreksi yang Terakumulasi Sebelumnya:\n${previousStoryline.riwayatKoreksi.map((r, i) => `${i + 1}. ${r}`).join('\n')}`
      : '';

  const userPrompt = `Cerita Sebelumnya (Wajib dipertahankan seluruh fakta di dalamnya):
"${previousStoryline.narasi}"
Aktor Sebelumnya: ${previousStoryline.asumsiAktor.join(', ')}
Alur Sebelumnya: ${previousStoryline.asumsiAlurUtama}${riwayatText}

Masukan / Koreksi Terbaru Pengguna (HANYA ubah/tambal bagian ini, pertahankan semua detail lainnya):
"${userFeedback}"

Perbarui cerita dan field asumsi dalam format JSON dengan mematuhi prinsip kumulatif (semua detail lama wajib tetap utuh):`;

  const raw = await invokeAIChat({
    systemInstruction,
    userPrompt,
    temperature: 0.6,
    maxTokens: 4000,
    provider,
    userApiKey: apiKey,
    userModel: model
  });

  if (raw) {
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        let narasi = String(parsed.narasi || '').trim();

        const prevGreetingMatch = previousStoryline.narasi.match(/^Berikut adalah flow proses bisnis dari [^.]+?\./i);
        const standardGreeting = prevGreetingMatch
          ? prevGreetingMatch[0]
          : buildStandardGreeting('bisnis ini');
        narasi = ensureStandardGreetingInNarasi(narasi, standardGreeting);

        if (!narasi.toLowerCase().includes('apakah ini sudah menggambarkan proses bisnismu')) {
          narasi = narasi ? `${narasi} ${CONFIRMATION_CLOSING}` : CONFIRMATION_CLOSING;
        }
        return {
          narasi,
          asumsiMasalah: String(parsed.asumsiMasalah || previousStoryline.asumsiMasalah).trim(),
          asumsiAktor:
            Array.isArray(parsed.asumsiAktor) && parsed.asumsiAktor.length > 0
              ? parsed.asumsiAktor.map(String)
              : previousStoryline.asumsiAktor,
          asumsiAlurUtama: String(parsed.asumsiAlurUtama || previousStoryline.asumsiAlurUtama).trim()
        };
      }
    } catch (e) {
      console.warn('Gagal mem-parse JSON dari refineStorylineWithAI:', e);
    }
  }

  // Fallback
  const prevGreetingMatch = previousStoryline.narasi.match(/^Berikut adalah flow proses bisnis dari [^.]+?\./i);
  const standardGreeting = prevGreetingMatch
    ? prevGreetingMatch[0]
    : buildStandardGreeting('bisnis ini');
  const baseNarrative = previousStoryline.narasi.replace(CONFIRMATION_CLOSING, '').trim();
  const rawFallback = `${baseNarrative} (Penyesuaian: ${userFeedback}). ${CONFIRMATION_CLOSING}`;
  const fallbackNarasi = ensureStandardGreetingInNarasi(rawFallback, standardGreeting);

  return {
    narasi: fallbackNarasi,
    asumsiMasalah: previousStoryline.asumsiMasalah,
    asumsiAktor: previousStoryline.asumsiAktor,
    asumsiAlurUtama: previousStoryline.asumsiAlurUtama
  };
}

/**
 * Parser JSON tangguh yang menangani markdown formatting, trailing commas,
 * komentar JS, dan pemulihan unclosed braces/brackets akibat token cutoff.
 */
export function robustJsonParse<T = any>(raw: string | null | undefined): T | null {
  if (!raw || typeof raw !== 'string') return null;

  let cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  let startIndex = -1;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIndex = firstBrace;
  } else if (firstBracket !== -1) {
    startIndex = firstBracket;
  }

  if (startIndex === -1) return null;

  cleaned = cleaned.slice(startIndex);

  // Hapus komentar // dan /* */
  cleaned = cleaned.replace(/\/\/[^\n\r]*/g, '');
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');

  // Hapus trailing comma sebelum } atau ]
  cleaned = cleaned.replace(/,\s*([\}\]])/g, '$1');

  try {
    return JSON.parse(cleaned);
  } catch {
    // Lanjutkan ke auto-repair
  }

  try {
    let repaired = cleaned;
    const quoteCount = (repaired.match(/(?<!\\)"/g) || []).length;
    if (quoteCount % 2 !== 0) {
      repaired += '"';
    }

    let openBraces = 0;
    let openBrackets = 0;
    let inString = false;
    let escape = false;

    for (let i = 0; i < repaired.length; i++) {
      const ch = repaired[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (ch === '{') openBraces++;
        else if (ch === '}') openBraces = Math.max(0, openBraces - 1);
        else if (ch === '[') openBrackets++;
        else if (ch === ']') openBrackets = Math.max(0, openBrackets - 1);
      }
    }

    repaired = repaired.replace(/,\s*$/, '');
    while (openBrackets > 0) {
      repaired += ']';
      openBrackets--;
    }
    while (openBraces > 0) {
      repaired += '}';
      openBraces--;
    }

    repaired = repaired.replace(/,\s*([\}\]])/g, '$1');
    return JSON.parse(repaired);
  } catch {
    return null;
  }
}

const CROSS_DOMAIN_ANOMALY_PATTERNS: {
  triggerAnomaly: RegExp;
  allowedIfContextHas: RegExp;
  categoryName: string;
}[] = [
  {
    triggerAnomaly: /\b(hewan|kucing|anjing|anabul|pakan|kandang|grooming|vaksin.*hewan|pasir.*gumpal|sterilisasi.*kandang)\b/i,
    allowedIfContextHas: /\b(pet|hewan|kucing|anjing|anabul|veteriner|fauna|satwa|ternak)\b/i,
    categoryName: 'Pet / Penitipan Hewan'
  },
  {
    triggerAnomaly: /\b(cukur|silet|clipper|pomade|kapster|pangkas.*rambut)\b/i,
    allowedIfContextHas: /\b(barber|cukur|pangkas|rambut|salon|kapster)\b/i,
    categoryName: 'Barbershop / Pangkas Rambut'
  },
  {
    triggerAnomaly: /\b(kaporit|kolam\s*renang|waterpark|pemandian|pelampung)\b/i,
    allowedIfContextHas: /\b(kolam|renang|waterpark|pemandian|waterboom)\b/i,
    categoryName: 'Kolam Renang'
  },
  {
    triggerAnomaly: /\b(armada|odometer|ganti\s*oli|stnk.*unit|mobil.*sewa|lepas\s*kunci)\b/i,
    allowedIfContextHas: /\b(rental|sewa.*kendaraan|mobil|motor|armada|rent\s*car)\b/i,
    categoryName: 'Rental Kendaraan'
  },
  {
    triggerAnomaly: /\b(nozzle|cetak.*banner|roll\s*vinyl|mata\s*ayam|sablon.*kaos)\b/i,
    allowedIfContextHas: /\b(percetakan|cetak|banner|sablon|offset|digital\s*print)\b/i,
    categoryName: 'Percetakan Digital'
  }
];

export function validateSupportingFlowsRelevance(
  flows: SupportingFlowItem[],
  session: MockupSessionState
): { valid: boolean; anomalyFound?: string } {
  if (!flows || flows.length === 0) return { valid: false, anomalyFound: 'Alur pendukung kosong' };

  const activeRoles = session.roles?.selected || ['Super Admin', 'Staf Operasional', 'Pelanggan'];
  const removedExt = session.roles?.removedExternalRoles || [];

  // 1. MEKANISME UTAMA: VALIDASI KONSISTENSI AKTOR
  // Pastikan SEMUA pelaku di setiap langkah alur pendukung adalah peran yang aktif di sesi
  for (const f of flows) {
    if (!Array.isArray(f.steps) || f.steps.length === 0) {
      return { valid: false, anomalyFound: `Alur "${f.nama}" tidak memiliki langkah pengerjaan.` };
    }
    for (const step of f.steps) {
      const pelaku = (step.pelaku || '').trim();
      if (!pelaku) {
        return { valid: false, anomalyFound: `Langkah pada alur "${f.nama}" tidak mencantumkan pelaku.` };
      }

      // Periksa apakah pelaku adalah role yang sudah dihapus
      const isRemoved = removedExt.some((r) => r.toLowerCase() === pelaku.toLowerCase());
      if (isRemoved) {
        return {
          valid: false,
          anomalyFound: `Aktor "${pelaku}" telah dihapus dari aplikasi tetapi masih muncul di alur pendukung.`
        };
      }

      // Periksa kecocokan dengan daftar peran aktif
      const isMatched = activeRoles.some(
        (r) =>
          r.toLowerCase() === pelaku.toLowerCase() ||
          r.toLowerCase().includes(pelaku.toLowerCase()) ||
          pelaku.toLowerCase().includes(r.toLowerCase())
      );

      if (!isMatched) {
        return {
          valid: false,
          anomalyFound: `Aktor "${pelaku}" tidak terdaftar dalam peran aktif aplikasi (${activeRoles.join(', ')}).`
        };
      }
    }
  }

  // 2. MEKANISME TAMBAHAN: DETEKSI ANOMALI KATA KUNCI LINTAS DOMAIN
  const contextText = `${(session as any).domain || ''} ${session.match?.businessCategory || ''} ${session.storyline?.narasi || ''} ${session.storyline?.asumsiAlurUtama || ''}`.toLowerCase();

  const allFlowText = flows
    .map((f) => `${f.nama} ${f.steps.map((s) => `${s.pelaku} ${s.aksi}`).join(' ')}`)
    .join(' ')
    .toLowerCase();

  for (const rule of CROSS_DOMAIN_ANOMALY_PATTERNS) {
    if (rule.triggerAnomaly.test(allFlowText) && !rule.allowedIfContextHas.test(contextText)) {
      return {
        valid: false,
        anomalyFound: `Konten terdeteksi memuat anomali domain "${rule.categoryName}" yang tidak relevan dengan proses bisnis ini.`
      };
    }
  }

  return { valid: true };
}

export function validateRbacMatrixRelevance(
  rbac: RbacMatrixResult,
  session: MockupSessionState
): { valid: boolean; anomalyFound?: string } {
  if (!rbac || !Array.isArray(rbac.modul) || rbac.modul.length === 0) {
    return { valid: false, anomalyFound: 'Matriks RBAC kosong' };
  }

  const activeRoles = session.roles?.selected || ['Super Admin', 'Staf Operasional', 'Pelanggan'];
  const removedExt = session.roles?.removedExternalRoles || [];

  // 1. MEKANISME UTAMA: VALIDASI KONSISTENSI ROLE PADA MODUL RBAC
  for (const m of rbac.modul) {
    if (!m.nama || !Array.isArray(m.izinPerRole)) {
      return { valid: false, anomalyFound: `Modul RBAC tidak memiliki nama atau daftar izin peran.` };
    }
    for (const ip of m.izinPerRole) {
      const roleName = (ip.role || '').trim();
      const isRemoved = removedExt.some((r) => r.toLowerCase() === roleName.toLowerCase());
      if (isRemoved) {
        return {
          valid: false,
          anomalyFound: `Peran "${roleName}" yang telah dihapus masih muncul di matriks RBAC modul "${m.nama}".`
        };
      }
      const isKnown = activeRoles.some(
        (r) =>
          r.toLowerCase() === roleName.toLowerCase() ||
          r.toLowerCase().includes(roleName.toLowerCase()) ||
          roleName.toLowerCase().includes(r.toLowerCase())
      );
      if (!isKnown) {
        return {
          valid: false,
          anomalyFound: `Peran "${roleName}" pada modul "${m.nama}" tidak terdaftar dalam peran aktif (${activeRoles.join(', ')}).`
        };
      }
    }
  }

  // 2. MEKANISME TAMBAHAN: DETEKSI ANOMALI KATA KUNCI LINTAS DOMAIN
  const contextText = `${(session as any).domain || ''} ${session.match?.businessCategory || ''} ${session.storyline?.narasi || ''} ${session.storyline?.asumsiAlurUtama || ''}`.toLowerCase();

  const allRbacText = rbac.modul
    .map((m) => `${m.nama} ${m.deskripsiFungsional || ''} ${m.izinPerRole.map((ip) => `${ip.role} ${ip.level}`).join(' ')}`)
    .join(' ')
    .toLowerCase();

  for (const rule of CROSS_DOMAIN_ANOMALY_PATTERNS) {
    if (rule.triggerAnomaly.test(allRbacText) && !rule.allowedIfContextHas.test(contextText)) {
      return {
        valid: false,
        anomalyFound: `Modul RBAC memuat anomali domain "${rule.categoryName}" yang tidak relevan dengan proses bisnis ini.`
      };
    }
  }

  return { valid: true };
}

/**
 * Menyusun Alur Pendukung dan Fitur Pendukung operasional berbasis analisis AI konseptual terpadu.
 * Menggantikan total percabangan regex domain dan template statis (Opsi 1).
 */
export async function generateSupportingFlowsAndFeaturesWithAI(
  session: MockupSessionState,
  provider?: string,
  apiKey?: string,
  model?: string
): Promise<{
  alurPendukung: SupportingFlowItem[];
  fiturPendukung: SupportingFeatureItem[];
}> {
  const startTime = Date.now();
  const activeRoles = session.roles?.selected || ['Super Admin', 'Staf Operasional', 'Pelanggan'];
  const activeOwner = REQUIRED_ROLE;
  const coreRole = session.roles?.wajib?.find((r) => r !== REQUIRED_ROLE) || detectCoreOperationalRole(session);
  const narrative = session.storyline?.narasi || '';
  const mainFlow = session.storyline?.asumsiAlurUtama || '';
  const problem = session.storyline?.asumsiMasalah || '';
  const domain = (session as any).domain || session.match?.businessCategory || 'Operasional Bisnis';

  const systemInstruction = `Anda adalah Analis Sistem & Konsultan Desain Alur Kerja Aplikasi Bisnis Nyata.
Tugas Anda: Menyusun Alur Pendukung (Supporting Workflows) dan Fitur Pendukung (Supporting Features) operasional yang SANGAT KONKRET, SPESIFIK KE INDUSTRI TERKAIT, dan MURNI DIGROUNDING ke narasi cerita bisnis nyata pengguna serta daftar peran yang aktif.

ATURAN WAJIB & LARANGAN MUTLAK:
1. GROUNDING PENUH KE NARASI & PERAN AKTIF (ANALISIS KONSEPTUAL TANGGUNG JAWAB):
   - Baca dengan cermat Narasi, Masalah Utama, Alur Utama (Alur Inti), serta Daftar Peran dan Tanggung Jawabnya.
   - Aktor/pelaku di setiap langkah WAJIB diambil HANYA dari Daftar Peran Aktif: ${activeRoles.join(', ')}. DILARANG mengarang nama peran yang tidak ada di daftar!
   - PENUGASAN PERAN GOVERNANCE / PENGAMBIL KEPUTUSAN KONSEPTUAL:
     * Cermati rincian narasi dan tanggung jawab setiap peran yang diberikan.
     * Jika ada peran yang secara jelas bertindak sebagai pengambil keputusan, otorisasi, persetujuan batas/plafon, evaluasi risiko, audit, atau pengawas tata kelola (ditentukan DARI ISI TANGGUNG JAWABNYA, BUKAN dari mencocokkan nama peran ke daftar kata kunci), WAJIB libatkan peran tersebut di langkah alur yang memang membutuhkan persetujuan, evaluasi kelayakan, atau otorisasi kebijakan — bukan diserahkan ke staf operasional biasa yang hanya menjalankan tugas rutin lapangan.
     * Staf operasional biasa menjalankan tugas fisik rutin, pelayanan langsung, dan persiapan teknis.
   - Kalimat aksi harus menggambarkan aktivitas fisik/operasional nyata manusia di tempat kerja dengan objek spesifik bisnis tersebut.

2. LARANGAN KERAS KERANGKA/FORMULA JUDUL ABSTRAK (ANTI-TEMPLATE GENERIK):
   - DILARANG KERAS menggunakan frasa payung abstrak di judul alur seperti:
     * "Penanganan Penyesuaian Hasil & Jaminan Pengerjaan [X]"
     * "Pemeliharaan Sarana Kerja & Kesiapan Perlengkapan [X]"
     * "Jaminan Kepuasan & Penyesuaian Kualitas Layanan [X]"
     * "Standar Operasional Penunjang [X]"
     * Frasa payung umum lainnya yang cuma menempelkan nama domain di akhir kalimat!
   - JUDUL ALUR PENDUKUNG WAJIB MENYEBUTKAN SECARA EKSPLISIT:
     a. Nama peralatan kerja fisik, instrumen, atau bahan konsumsi nyata (contoh: "Restock Silet Cukur, Pisau Clipper & Pomade", "Kalibrasi Mixer & Perawatan Kabel Audio", "Restock Tinta Banner & Pembersihan Head Printer", "Pengadaan Kaporit Kolam & Perawatan Pompa Sirkulasi", "Kalibrasi Mesin & Perawatan Alat Produksi", "Restock Biji Kopi Espresso & Perawatan Suhu Chiller").
     b. ATAU bentuk kendala / komplain fisik nyata yang dihadapi konsumen (contoh: "Klaim Ulang Potong Gratis jika Rambut Kurang Rapi", "Koreksi Retake Audio Vokal & Re-balancing Frekuensi", "Cetak Ulang Cepat jika Warna Luntur atau Format Rusak", "Uji Kebersihan Air & Pengurasan Endapan Dasar Kolam", "Penanganan Barang Cacat & Garansi Penggantian Produk", "Penggantian Pesanan Salah & Garansi Cita Rasa Masakan").

3. SELF-CHECK SEBELUM MENGELUARKAN OUTPUT (SANGAT KRUSIAL):
   - Lakukan pengujian berikut pada setiap judul alur pendukung Anda sebelum mengeluarkan JSON:
     "Jika nama bidang usaha ini dihilangkan, apakah judul ini masih bisa dipakai untuk bisnis lain (seperti kantor, toko grosir, atau pabrik) tanpa terasa salah?"
     JIKA YA -> MAKA JUDUL ANDA GAGAL!
     Segera ganti dan sebutkan alat kerja fisik, bahan habis pakai, atau komplain spesifik yang HANYA MUNGKIN ADA di bidang usaha pengguna ini!

4. FLEKSIBILITAS JUMLAH (TANPA KUOTA ARTIFISIAL):
   - Jumlah alur pendukung harus proporsional dengan kompleksitas proses bisnis nyata (1 hingga 2 alur pendukung).
   - Jika proses bisnisnya ramping dan hanya memiliki 1 alur pendukung logis yang relevan, berikan 1 saja! DILARANG memaksakan alur kedua yang mengada-ada.
   - Fitur Pendukung: Hasilkan 3 hingga 5 fitur bernilai tinggi yang spesifik menunjang efisiensi operasional peran terkait (misal dasbor antrean khusus alat/layanan, cetak lembar kerja/invoice PDF, integrasi notifikasi WhatsApp, atau rekapitulasi performa kerja).

5. TANPA ISTILAH TEKNIS IT:
   - Dilarang memakai istilah IT seperti database, backend, CRUD, API, endpoint, tabel SQL.

6. FORMAT OUTPUT JSON WAJIB:
{
  "alurPendukung": [
    {
      "id": "alur_spesifik_1",
      "nama": "Judul Alur Pendukung Menyebut Objek/Alat/Masalah Konkret",
      "steps": [
        { "pelaku": "Nama Peran dari Daftar", "aksi": "Tindakan operasional nyata" },
        { "pelaku": "Nama Peran dari Daftar", "aksi": "Tindakan operasional nyata" }
      ]
    }
  ],
  "fiturPendukung": [
    { "id": "feat_spesifik_1", "label": "Deskripsi fitur pendukung spesifik domain" }
  ]
}`;

  const roleDescriptions = activeRoles
    .map((r) => {
      const detail = session.storyline?.detailAktor?.[r];
      if (detail && detail.tanggungJawab?.length) {
        return `- ${r}: ${detail.narasi || ''} (Tanggung Jawab: ${detail.tanggungJawab.join('; ')})`;
      }
      return `- ${r}`;
    })
    .join('\n');

  const userPrompt = `Domain Bisnis: ${domain}
Narasi Cerita: "${narrative}"
Masalah Utama: "${problem}"
Alur Inti (Alur Utama): "${mainFlow}"

Daftar Peran Aktif & Rincian Tanggung Jawabnya:
${roleDescriptions}

Peran Pemilik/Super Admin: ${activeOwner}
Peran Operasional Utama: ${coreRole}

Susun Alur Pendukung dan Fitur Pendukung operasional yang paling relevan dan spesifik untuk bisnis ini dalam format JSON:`;

  const parseAndValidateAIResult = (rawText: string | null): {
    alurPendukung: SupportingFlowItem[];
    fiturPendukung: SupportingFeatureItem[];
  } | null => {
    if (!rawText) return null;
    try {
      const parsed = robustJsonParse<any>(rawText);
      if (!parsed || typeof parsed !== 'object') return null;

      const alurPendukung: SupportingFlowItem[] = [];
      if (Array.isArray(parsed.alurPendukung) && parsed.alurPendukung.length > 0) {
        for (let i = 0; i < parsed.alurPendukung.length; i++) {
          const ap = parsed.alurPendukung[i];
          if (ap && typeof ap.nama === 'string' && Array.isArray(ap.steps) && ap.steps.length > 0) {
            alurPendukung.push({
              id: ap.id ? String(ap.id).toLowerCase().replace(/[^a-z0-9_]/g, '_') : `alur_pendukung_${i + 1}`,
              nama: String(ap.nama).trim(),
              steps: ap.steps.map((s: any) => ({
                pelaku: resolveActorForStep(String(s.pelaku || coreRole), session.roles),
                aksi: String(s.aksi || '').trim()
              }))
            });
          }
        }
      }

      const fiturPendukung: SupportingFeatureItem[] = [];
      if (Array.isArray(parsed.fiturPendukung) && parsed.fiturPendukung.length > 0) {
        for (let j = 0; j < parsed.fiturPendukung.length; j++) {
          const fp = parsed.fiturPendukung[j];
          const label = typeof fp === 'string' ? fp : fp?.label;
          const id = fp?.id ? String(fp.id) : `feat_${j + 1}`;
          if (label) {
            fiturPendukung.push({ id, label: String(label).trim() });
          }
        }
      }

      if (alurPendukung.length > 0 && fiturPendukung.length > 0) {
        const relevance = validateSupportingFlowsRelevance(alurPendukung, session);
        if (!relevance.valid) {
          console.warn(`[AI-SUPPORTING-FLOWS] Ditolak karena uji relevansi gagal: ${relevance.anomalyFound}`);
          return null;
        }
        return { alurPendukung, fiturPendukung };
      }
    } catch (e) {
      console.warn('[AI-SUPPORTING-FLOWS] Gagal parse JSON AI:', e);
    }
    return null;
  };

  // Panggilan AI Utama
  let raw = await invokeAIChat({
    systemInstruction,
    userPrompt,
    temperature: 0.4,
    maxTokens: 4000,
    provider,
    userApiKey: apiKey,
    userModel: model
  });

  let parsedResult = parseAndValidateAIResult(raw);

  // Jika gagal parse atau memuat anomali domain asing, lakukan retry 1x
  if (!parsedResult && (provider || apiKey || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY)) {
    console.log('[AI-SUPPORTING-FLOWS] Melakukan retry AI 1x dengan prompt penegasan format & relevansi...');
    const retryPrompt = `${userPrompt}\n\n⚠️ PERINGATAN PENTING:
Output JSON Anda sebelumnya terpotong atau memuat entitas/istilah dari industri lain yang tidak relevan!
WAJIB keluarkan HANYA JSON murni yang valid tanpa komentar, tanpa trailing comma, dan 100% grounded ke bisnis "${domain}".`;

    raw = await invokeAIChat({
      systemInstruction,
      userPrompt: retryPrompt,
      temperature: 0.2,
      maxTokens: 4000,
      provider,
      userApiKey: apiKey,
      userModel: model
    });
    parsedResult = parseAndValidateAIResult(raw);
  }

  const elapsed = Date.now() - startTime;
  console.log(`[AI-SUPPORTING-FLOWS] Selesai dalam ${elapsed}ms`);

  if (parsedResult) {
    return parsedResult;
  }

  console.warn('[AI-SUPPORTING-FLOWS] AI call gagal atau tidak lolos validasi, menggunakan fallback sintesis dinamis');
  // Fallback sintesis dinamis murni berbasis sesi aktif (bebas profiling statis)
  const baseFlow = getDomainFlowDetails(session, { forceFresh: true });
  return {
    alurPendukung: baseFlow.alurPendukung,
    fiturPendukung: baseFlow.fiturPendukung
  };
}

function applyDeterministicFlowCorrection(
  currentFlow: DomainFlowData,
  userCorrection: string,
  session: MockupSessionState
): DomainFlowData {
  const alurInti = [...currentFlow.alurInti.map((s) => ({ ...s }))];
  const alurPendukung = [...currentFlow.alurPendukung.map((ap) => ({ ...ap, steps: [...ap.steps] }))];
  const fiturPendukung = [...currentFlow.fiturPendukung.map((fp) => ({ ...fp }))];

  // 1. Koreksi langkah tertentu: "langkah 2: kasir terima uang...", "koreksi langkah 3: ..."
  const stepMatch = userCorrection.match(/langkah\s+(\d+)\s*[:=-]?\s*(.+)/i);
  if (stepMatch) {
    const stepNum = parseInt(stepMatch[1], 10);
    const newActionText = stepMatch[2].trim();
    const target = alurInti.find((s) => s.step === stepNum);
    if (target) {
      const actorMatch = newActionText.match(/^\(([^)]+)\)\s*(.+)/);
      if (actorMatch) {
        target.pelaku = resolveActorForStep(actorMatch[1].trim(), session.roles);
        target.aksi = actorMatch[2].trim();
      } else {
        target.aksi = newActionText;
      }
    }
  }

  // 2. Tambah langkah baru: "tambah langkah: serah terima kunci"
  const addStepMatch = userCorrection.match(/tambah(kan)?\s+langkah\s*[:=-]?\s*(.+)/i);
  if (addStepMatch) {
    const actionText = addStepMatch[2].trim();
    const defaultActor = alurInti[alurInti.length - 2]?.pelaku || REQUIRED_ROLE;
    alurInti.push({
      step: alurInti.length + 1,
      pelaku: defaultActor,
      aksi: actionText
    });
  }

  // 3. Tambah fitur pendukung: "tambah fitur cetak struk", "fitur: barcode scanner"
  const addFeatMatch = userCorrection.match(/tambah(kan)?\s+fitur\s*[:=-]?\s*(.+)/i);
  if (addFeatMatch) {
    const featLabel = addFeatMatch[2].trim();
    fiturPendukung.push({
      id: `feat_user_${Date.now()}`,
      label: featLabel
    });
  }

  // 4. Koreksi umum naratif jika tidak menyebut kata 'langkah' atau 'fitur'
  if (!stepMatch && !addStepMatch && !addFeatMatch && userCorrection.length > 5) {
    if (alurInti.length > 1) {
      const midIdx = Math.max(1, alurInti.length - 2);
      alurInti[midIdx].aksi = `${alurInti[midIdx].aksi} (Disesuaikan: ${userCorrection})`;
    }
  }

  return {
    alurInti,
    alurPendukung,
    fiturPendukung
  };
}

async function refineFlowWithAI(
  currentFlow: DomainFlowData,
  userCorrection: string,
  session: MockupSessionState,
  provider?: string,
  apiKey?: string,
  model?: string
): Promise<DomainFlowData> {
  const knownActors = [
    REQUIRED_ROLE,
    ...(session.roles?.selected || []),
    ...(session.storyline?.asumsiAktor || [])
  ];

  const systemInstruction = `Anda adalah Partner Diskusi & Arsitek Solusi AI dari platform "Aplikasi Generator".
Tugas Anda: Memperbarui Alur Inti, Alur Pendukung, atau Fitur Pendukung aplikasi bisnis berdasarkan masukan atau koreksi dari pengguna.

ATURAN WAJIB:
1. PERTAHANKAN FORMAT:
   - Alur Inti: array of { "step": nomor urut, "pelaku": "Nama Peran", "aksi": "Deskripsi aktivitas fisik nyata" }.
   - Pelaku Alur Inti WAJIB menggunakan peran yang dikenal: ${knownActors.join(', ')}.
   - Alur Pendukung: array of { "id": string, "nama": string, "steps": [{ "pelaku": string, "aksi": string }] }.
   - Fitur Pendukung: array of { "id": string, "label": string }.
2. RELEVANSI DOMAIN & TANPA ISTILAH TEKNIS IT:
   - Dilarang menambahkan istilah teknis seperti CRUD, API, endpoint, skema database. Gunakan urutan aktivitas operasional nyata.
3. KELUARAN WAJIB JSON:
{
  "alurInti": [
    { "step": 1, "pelaku": "...", "aksi": "..." }
  ],
  "alurPendukung": [
    { "id": "...", "nama": "...", "steps": [{ "pelaku": "...", "aksi": "..." }] }
  ],
  "fiturPendukung": [
    { "id": "...", "label": "..." }
  ]
}`;

  const userPrompt = `Alur Saat Ini:
[Alur Inti]
${currentFlow.alurInti.map((s) => `${s.step}. (${s.pelaku}) ${s.aksi}`).join('\n')}

[Alur Pendukung]
${currentFlow.alurPendukung.map((ap) => `- ${ap.nama}: ${ap.steps.map((s) => `(${s.pelaku}) ${s.aksi}`).join(' -> ')}`).join('\n')}

[Fitur Pendukung]
${currentFlow.fiturPendukung.map((fp) => `- ${fp.label}`).join('\n')}

Masukan / Koreksi Pengguna:
"${userCorrection}"

Perbarui dan kembalikan JSON lengkap:`;

  const raw = await invokeAIChat({
    systemInstruction,
    userPrompt,
    temperature: 0.5,
    maxTokens: 4000,
    provider,
    userApiKey: apiKey,
    userModel: model
  });

  if (raw) {
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed.alurInti) && parsed.alurInti.length > 0) {
          const refinedAlurInti = parsed.alurInti.map((s: any, idx: number) => ({
            step: idx + 1,
            pelaku: resolveActorForStep(String(s.pelaku || 'Petugas').trim(), session.roles),
            aksi: String(s.aksi || '').trim()
          }));

          const refinedAlurPendukung = Array.isArray(parsed.alurPendukung)
            ? parsed.alurPendukung.map((ap: any, idx: number) => ({
                id: String(ap.id || `alur_pendukung_${idx + 1}`),
                nama: String(ap.nama || `Alur ${idx + 1}`),
                steps: Array.isArray(ap.steps)
                  ? ap.steps.map((st: any) => ({
                      pelaku: resolveActorForStep(String(st.pelaku || 'Petugas').trim(), session.roles),
                      aksi: String(st.aksi || '').trim()
                    }))
                  : []
              }))
            : currentFlow.alurPendukung;

          const refinedFiturPendukung = Array.isArray(parsed.fiturPendukung)
            ? parsed.fiturPendukung.map((fp: any, idx: number) => ({
                id: String(fp.id || `feat_custom_${idx + 1}`),
                label: String(fp.label || fp).trim()
              }))
            : currentFlow.fiturPendukung;

          return {
            alurInti: refinedAlurInti,
            alurPendukung: refinedAlurPendukung,
            fiturPendukung: refinedFiturPendukung
          };
        }
      }
    } catch (e) {
      console.warn('Gagal mem-parse JSON dari refineFlowWithAI:', e);
    }
  }

  return applyDeterministicFlowCorrection(currentFlow, userCorrection, session);
}

export interface ResolveOwnerRoleResult {
  ownerRole: string;
  confidence: 'high' | 'low';
  reason?: string;
  actionOwners?: { action: string; role: string }[];
}

export async function resolveEntityOwnerRoleWithAI(
  entityName: string,
  activeRoles: string[],
  flowData: {
    alurInti?: { step: number; pelaku: string; aksi: string }[];
    alurPendukung?: { nama: string; steps: { pelaku: string; aksi: string }[] }[];
  },
  provider?: string,
  apiKey?: string,
  model?: string
): Promise<ResolveOwnerRoleResult> {
  const alurInti = flowData.alurInti || [];
  const alurPendukung = flowData.alurPendukung || [];

  const flowSummary = [
    'Alur Inti:',
    ...alurInti.map((s) => `${s.step}. [${s.pelaku}] ${s.aksi}`),
    ...(alurPendukung.length > 0 ? ['\nAlur Pendukung:'] : []),
    ...alurPendukung.flatMap((ap) => [
      `- ${ap.nama}:`,
      ...ap.steps.map((s) => `  * [${s.pelaku}] ${s.aksi}`)
    ])
  ].join('\n');

  const systemInstruction = `Anda adalah analis proses bisnis perangkat lunak yang bertugas menganalisis tanggung jawab peran (role pengguna sistem) terhadap entitas data.
Tugas Anda: Menentukan peran (dari daftar peran pengguna sistem aktif) yang bertugas mencatat, mengelola, atau melayani entitas data "${entityName}" berdasarkan alur kerja operasional.

ATURAN WAJIB:
1. Analisis alur kerja nyata: Peran pengguna sistem mana yang melayani, menginput data, mencatat transaksi, atau berinteraksi langsung dengan ${entityName}?
2. Pilih SATU peran yang PERSIS sama dengan salah satu dari daftar peran aktif berikut:
${activeRoles.map((r) => `- "${r}"`).join('\n')}
3. PENTING — LARANGAN MENEBAK:
   Jika konteks alur kerja TIDAK secara jelas menyebutkan atau mengimplikasikan siapa yang mencatat/mengelola ${entityName}, atau jika Anda ragu/ambigu:
   Anda WAJIB mengisi "ownerRole": "tidak jelas" dan "confidence": "low".
   JANGAN MENEBAK! JANGAN ASAL PILIH!
4. Jika alur menyebutkan aksi lain terhadap entitas tersebut (misal: memeriksa kelayakan, menyelesaikan status, membatalkan), cantumkan pada array "actionOwners".

Format keluaran WAJIB JSON valid murni:
{
  "ownerRole": "Nama Peran Aktif ATAU 'tidak jelas'",
  "confidence": "high" | "low",
  "reason": "Penjelasan singkat dari alur kerja",
  "actionOwners": [
    { "action": "deskripsi aksi", "role": "Nama Peran" }
  ]
}`;

  const userPrompt = `Entitas Data yang dicari pengelolanya: "${entityName}"

Daftar Peran Pengguna Sistem Aktif:
${activeRoles.map((r) => `- ${r}`).join('\n')}

Teks Lengkap Alur Kerja Operasional:
${flowSummary}

Tentukan peran pengelola/pencatat untuk "${entityName}":`;

  try {
    const raw = await invokeAIChat({
      systemInstruction,
      userPrompt,
      temperature: 0.2,
      maxTokens: 1000,
      provider,
      userApiKey: apiKey,
      userModel: model
    });

    if (raw) {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        const ownerRoleRaw = String(parsed.ownerRole || '').trim();
        const matchedRole = activeRoles.find(
          (r) => r.toLowerCase() === ownerRoleRaw.toLowerCase()
        );

        if (matchedRole && parsed.confidence === 'high') {
          return {
            ownerRole: matchedRole,
            confidence: 'high',
            reason: parsed.reason,
            actionOwners: Array.isArray(parsed.actionOwners) ? parsed.actionOwners : []
          };
        }
      }
    }
  } catch (err) {
    console.warn('[resolveEntityOwnerRoleWithAI] Error invoking AI:', err);
  }

  // Fallback semantik alur: periksa apakah ada langkah di alur kerja yang secara eksplisit
  // menyebutkan aktor staf aktif melakukan aksi terhadap nama entitas ini
  const explicitStep = alurInti.find((s) => {
    const isStaff = activeRoles.some((r) => r.toLowerCase() === s.pelaku.toLowerCase() && !isSuperAdminRole(r));
    return isStaff && new RegExp(`\\b${entityName}\\b`, 'i').test(s.aksi);
  });

  if (explicitStep) {
    const matchedRole = activeRoles.find((r) => r.toLowerCase() === explicitStep.pelaku.toLowerCase());
    if (matchedRole) {
      return {
        ownerRole: matchedRole,
        confidence: 'high',
        reason: `Langkah alur kerja "${explicitStep.aksi}" dilakukan oleh ${matchedRole}`
      };
    }
  }

  // Jika alur kerja tidak menyebutkan siapa pencatatnya:
  return {
    ownerRole: 'tidak jelas',
    confidence: 'low',
    reason: `Alur kerja tidak menyebutkan peran spesifik yang mencatat atau mengelola data ${entityName}`
  };
}

export interface ClassifyActorResult {
  category: 'PENGGUNA_SISTEM' | 'ENTITAS_DATA';
  confidence: 'high' | 'low';
  reason: string;
}

let _lapis2CallCount = 0;
export function getLapis2CallCount(): number {
  return _lapis2CallCount;
}
export function resetLapis2CallCount(): void {
  _lapis2CallCount = 0;
}

export type MockAiClassifier = (
  actor: string,
  storyline: NonNullable<MockupSessionState['storyline']>
) => Promise<ClassifyActorResult | null>;

let _mockAiClassifier: MockAiClassifier | null = null;
export function setMockAiClassifierForTesting(fn: MockAiClassifier | null) {
  _mockAiClassifier = fn;
}

/**
 * LAPIS 2: Penilaian Semantik Berbasis AI untuk Klasifikasi Pelaku (Pengguna Sistem vs Entitas Data).
 * Mengevaluasi peran pelaku berdasarkan makna kalimat tanggung jawab dan konteks narasi alur,
 * bukan semata-mata dari pencocokan nama aktor ke daftar kamus.
 */
export async function classifyActorWithAI(
  actor: string,
  storyline: NonNullable<MockupSessionState['storyline']>,
  provider?: string,
  apiKey?: string,
  model?: string
): Promise<ClassifyActorResult> {
  const clean = actor.trim();
  if (isSuperAdminRole(clean)) {
    return {
      category: 'PENGGUNA_SISTEM',
      confidence: 'high',
      reason: 'Pemilik usaha / Super Admin pemegang kendali utama aplikasi'
    };
  }

  _lapis2CallCount++;
  console.log(
    `[LAPIS-2-AI-CALL] classifyActorWithAI dipanggil untuk "${clean}" (Total pemanggilan: ${_lapis2CallCount})`
  );

  if (_mockAiClassifier) {
    const mockRes = await _mockAiClassifier(clean, storyline);
    if (mockRes) return mockRes;
  }

  const detailAktor = storyline.detailAktor || {};
  const detail = detailAktor[clean];
  const detailText = detail
    ? `Tanggung Jawab: ${(detail.tanggungJawab || []).join(', ')}. Narasi: ${detail.narasi || '-'}`
    : '';

  const systemInstruction = `Anda adalah analis arsitektur sistem informasi enterprise.
Tugas Anda: Mengevaluasi peran pelaku "${clean}" dalam proses bisnis: apakah bertindak sebagai "PENGGUNA_SISTEM" atau "ENTITAS_DATA".

DEFINISI KATEGORI:
1. PENGGUNA_SISTEM: Pelaku (pemilik, staf, petugas operasional) yang memegang komputer/perangkat, login dengan akun mandiri, dan mengoperasikan aplikasi (menginput, memverifikasi, mengelola data).
2. ENTITAS_DATA: Pelaku pihak luar (pelanggan, pasien, siswa, penyewa, donatur, kontributor riset, pemesan khusus, partisipan uji coba, dsb.) yang TIDAK membuka aplikasi sendiri. Keberadaannya hanya DICATAT, DILAYANI, atau DIPERIKSA oleh staf/pengguna sistem lain.

ATURAN EVALUASI:
- Periksa kalimat narasi dan alur: Siapa yang melakukan aksi terhadap "${clean}"? Jika data "${clean}" dicatat atau dilayani oleh peran staf lain, maka "${clean}" adalah ENTITAS_DATA.
- Jika alur menyebut "${clean}" login mandiri atau membuka portal mandiri, maka PENGGUNA_SISTEM.
- Berikan alasan penalaran yang spesifik dan mengutip alur cerita bisnis (bukan alasan template).

Format keluaran WAJIB JSON murni:
{
  "category": "PENGGUNA_SISTEM" | "ENTITAS_DATA",
  "confidence": "high" | "low",
  "reason": "Penjelasan penalaran spesifik berdasarkan narasi proses bisnis"
}`;

  const userPrompt = `Pelaku yang dievaluasi: "${clean}"

Narasi Proses Bisnis:
${storyline.narasi || '-'}

Alur Operasional:
${storyline.asumsiAlurUtama || '-'}
${detailText ? `\nDetail Aktor:\n${detailText}` : ''}

Tentukan kategori "${clean}" (PENGGUNA_SISTEM atau ENTITAS_DATA):`;

  try {
    const raw = await invokeAIChat({
      systemInstruction,
      userPrompt,
      temperature: 0.1,
      maxTokens: 500,
      provider,
      userApiKey: apiKey,
      userModel: model
    });

    if (raw) {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        const cat = String(parsed.category || '').trim().toUpperCase();
        if (cat === 'PENGGUNA_SISTEM' || cat === 'ENTITAS_DATA') {
          return {
            category: cat,
            confidence: parsed.confidence === 'high' ? 'high' : 'low',
            reason: parsed.reason || `🤖 Hasil penalaran alur bisnis: ${clean} berposisi sebagai ${cat === 'ENTITAS_DATA' ? 'Entitas Data' : 'Pengguna Sistem'}.`
          };
        }
      }
    }
  } catch (err) {
    console.warn(`[classifyActorWithAI] Gagal memanggil AI untuk "${clean}":`, err);
  }

  // Fallback ke Lapis 1 Heuristik jika AI tidak merespons
  const baseClassification = analyzeActorClassification({
    step: 'STORYTELLING',
    storyline
  });
  const fallback = baseClassification.classifications.find(
    (c: ActorClassification) => c.actor.toLowerCase() === clean.toLowerCase()
  );
  return {
    category: fallback?.category || 'PENGGUNA_SISTEM',
    confidence: 'low',
    reason: fallback?.reason || `🤖 Saran: ${clean} diklasifikasikan sebagai Pengguna Sistem.`
  };
}

export async function analyzeActorClassificationWithAI(
  session: MockupSessionState,
  provider?: string,
  apiKey?: string,
  model?: string
): Promise<{
  classifications: ActorClassification[];
  hasCandidateEntity: boolean;
}> {
  // 1. Jalankan Lapis 1 (Heuristik Narasi & Tindakan Kalimat)
  const lapis1 = analyzeActorClassification(session);
  const classifications: ActorClassification[] = [];
  let hasCandidateEntity = false;

  for (const c of lapis1.classifications) {
    // Jalur cepat: Jika Lapis 1 sudah confident (Owner, Jabatan Staf Baku, atau Predicate Semantic Match):
    // Gunakan hasil Lapis 1 tanpa perlu memanggil AI tambahan (hemat latensi & biaya)
    if (c.confidence === 'high') {
      classifications.push(c);
      if (c.category === 'ENTITAS_DATA') {
        hasCandidateEntity = true;
      }
      continue;
    }

    // 2. LAPIS 2: Pemicu eksplisit jika Lapis 1 INCONCLUSIVE (confidence: low, source: INCONCLUSIVE_FALLBACK)
    console.log(
      `[LAPIS-2-AI-TRIGGERED] classifyActorWithAI dipanggil untuk "${c.actor}" karena Lapis 1 inconclusive (confidence: low, source: ${c.matchSource}).`
    );

    if (session.storyline) {
      const aiResult = await classifyActorWithAI(
        c.actor,
        session.storyline,
        provider,
        apiKey,
        model
      );
      classifications.push({
        actor: c.actor,
        category: aiResult.category,
        confidence: aiResult.confidence,
        matchSource: 'AI_SEMANTIC',
        reason: aiResult.reason
      });
      if (aiResult.category === 'ENTITAS_DATA') {
        hasCandidateEntity = true;
      }
    } else {
      classifications.push(c);
      if (c.category === 'ENTITAS_DATA') {
        hasCandidateEntity = true;
      }
    }
  }

  return { classifications, hasCandidateEntity };
}

export interface RbacMatrixResult {
  modul: {
    nama: string;
    deskripsiFungsional?: string;
    izinPerRole: { role: string; level: string; keterangan?: string }[];
  }[];
  markdownTable: string;
  catatanPelimpahan?: string[];
}

export function generateFallbackRbacMatrix(session: MockupSessionState): RbacMatrixResult {
  const removedExt = session.roles?.removedExternalRoles || [];
  const activeRoles = (session.roles?.selected || ['Super Admin', 'Staf Operasional', 'Pelanggan']).filter(
    (r) => !removedExt.includes(r)
  );
  const flowData = session.flow || {};
  const alurInti = flowData.alurInti || [];
  const alurPendukung = flowData.alurPendukung || [];
  const delegated = session.roles?.tugasDilimpahkan || [];
  const ownerRole = activeRoles.find((r) => isSuperAdminRole(r)) || activeRoles[0] || 'Super Admin';
  const customerRole = activeRoles.find((r) => isActorEntityData(session, r));
  const domain = ((session as any).domain || session.match?.businessCategory || 'Layanan').trim();

  const modul: {
    nama: string;
    deskripsiFungsional?: string;
    izinPerRole: { role: string; level: string; keterangan?: string }[];
  }[] = [];

  // Modul 1: Portal Pemesanan / Pengajuan Mandiri (Jika ada peran eksternal/pelanggan/anggota)
  if (customerRole) {
    modul.push({
      nama: `Portal Mandiri & Pengajuan Layanan (${customerRole})`,
      deskripsiFungsional: `Portal mandiri untuk ${customerRole.toLowerCase()} dalam membuat pengajuan, mengunggah berkas, dan memantau status`,
      izinPerRole: activeRoles.map((r) => {
        if (r === customerRole) {
          return { role: r, level: 'Buat & Pantau (Milik Sendiri)', keterangan: 'Akses terbatas ke data transaksi pribadi' };
        }
        if (r === ownerRole) {
          return { role: r, level: 'Supervisi & Otorisasi Pengajuan', keterangan: 'Akses pantau dan kontrol seluruh antrean' };
        }
        return { role: r, level: 'Verifikasi & Validasi Berkas', keterangan: 'Validasi kelayakan berkas pengajuan' };
      })
    });
  }

  // Modul 2: Operasional Internal & Pemrosesan Layanan
  modul.push({
    nama: `Pemrosesan Operasional & Verifikasi Berkas`,
    deskripsiFungsional: `Pencatatan verifikasi data, validasi operasional harian, dan pelaksanaan teknis layanan`,
    izinPerRole: activeRoles.map((r) => {
      if (customerRole && r === customerRole) {
        return { role: r, level: 'Lihat Status Pengerjaan (Milik Sendiri)', keterangan: 'Menerima bukti pengerjaan/berita acara' };
      }
      if (r === ownerRole) {
        return { role: r, level: 'Supervisi Mutu & Kontrol Operasional', keterangan: 'Monitoring progres dan eskalasi kendala' };
      }
      return { role: r, level: 'Eksekusi & Validasi Operasional', keterangan: 'Input data verifikasi, checklist, dan pemrosesan' };
    })
  });

  // Modul 3: Transaksi Keuangan & Kasir
  const hasPayment = alurInti.some((s) => /bayar|kasir|uang|tagihan|kuitansi|cair|dana|simpan|angsur|cicil|biaya/i.test(s.aksi));
  if (hasPayment || alurInti.length >= 3) {
    modul.push({
      nama: `Transaksi Pembayaran & Pembukuan Kasir`,
      deskripsiFungsional: `Penerimaan pembayaran, pencatatan transaksi keuangan, dan penerbitan bukti kuitansi resmi`,
      izinPerRole: activeRoles.map((r) => {
        if (customerRole && r === customerRole) {
          return { role: r, level: 'Lihat Tagihan & Bukti Bayar Pribadi', keterangan: 'Unduh nota pembayaran sendiri' };
        }
        if (r === ownerRole) {
          return { role: r, level: 'Audit Keuangan & Rekonsiliasi Saldo', keterangan: 'Akses penuh pembukuan dan kas' };
        }
        return { role: r, level: 'Input Transaksi & Cetak Struk', keterangan: 'Pencatatan transaksi kasir harian' };
      })
    });
  }

  // Modul 4: Penanganan Kendala & Audit (Alur Pendukung)
  if (alurPendukung.length > 0) {
    modul.push({
      nama: `Penanganan Kendala & Audit Kepatuhan Operasional`,
      deskripsiFungsional: `Pencatatan kendala layanan, tindak lanjut penyesuaian transaksi, dan audit kepatuhan harian`,
      izinPerRole: activeRoles.map((r) => {
        if (customerRole && r === customerRole) {
          return { role: r, level: 'Kirim Masukan / Lapor Kendala (Milik Sendiri)', keterangan: 'Hanya seputar transaksi yang digunakan' };
        }
        if (r === ownerRole) {
          return { role: r, level: 'Otorisasi Solusi & Evaluasi Audit', keterangan: 'Persetujuan kebijakan kompensasi dan audit' };
        }
        return { role: r, level: 'Pemeriksaan Berkas & Penanganan Teknis', keterangan: 'Tindak lanjut penyelesaian kendala di lapangan' };
      })
    });
  }

  // Modul 5: Manajemen Master Data & Hak Akses
  modul.push({
    nama: `Manajemen Sistem, Master Data & Hak Akses`,
    deskripsiFungsional: `Pengaturan katalog harga, data master, akun pengguna, dan log audit`,
    izinPerRole: activeRoles.map((r) => {
      if (r === ownerRole) {
        return { role: r, level: 'Kontrol Penuh & Pengaturan Sistem', keterangan: 'Kelola akun staf, hak akses, dan tarif' };
      }
      return { role: r, level: '-', keterangan: 'Tidak memiliki hak akses' };
    })
  });

  const catatanPelimpahan: string[] = [];
  if (delegated.length > 0) {
    delegated.forEach((d) => {
      catatanPelimpahan.push(
        `Wewenang operasional "${d.dariRole}" dialihkan sepenuhnya ke "${d.keRole}" karena perampingan organisasi (${d.daftarTugas.join(', ')}).`
      );
    });
  }

  const markdownTable = renderRbacMarkdownTable(activeRoles, modul, catatanPelimpahan);

  return {
    modul,
    markdownTable,
    catatanPelimpahan: catatanPelimpahan.length > 0 ? catatanPelimpahan : undefined
  };
}

export async function generateRbacMatrixWithAI(
  session: MockupSessionState,
  provider?: string,
  apiKey?: string,
  model?: string
): Promise<RbacMatrixResult> {
  const startTime = Date.now();
  const removedExt = session.roles?.removedExternalRoles || [];
  const activeRoles = (session.roles?.selected || ['Super Admin', 'Staf Operasional', 'Pelanggan']).filter(
    (r) => !removedExt.includes(r)
  );
  const flowData = session.flow || {};
  const alurInti = flowData.alurInti || [];
  const alurPendukung = flowData.alurPendukung || [];
  const fiturPendukung = flowData.fiturPendukung || [];
  const businessDomain = session.match?.businessCategory || session.storyline?.asumsiAlurUtama || 'Operasional Bisnis';
  const narrative = session.storyline?.narasi || '';
  const delegated = session.roles?.tugasDilimpahkan || [];

  const delegationNotesPrompt =
    delegated.length > 0
      ? `\n⚠️ ATURAN KHUSUS PELIMPAHAN TUGAS (WAJIB DIPATUHI):
${delegated
  .map(
    (d) =>
      `- Peran "${d.dariRole}" telah DIHAPUS dari sistem dan seluruh wewenangnya DILIMPAHKAN ke "${d.keRole}".
  * JANGAN membuat kolom untuk "${d.dariRole}". Kolom role WAJIB HANYA terdiri dari: ${activeRoles.join(', ')}.
  * Seluruh modul yang mencakup tugas "${d.dariRole}" (${d.daftarTugas.join(', ')}) TETAP HARUS ADA di baris modul, dan wewenang operasionalnya diberikan kepada "${d.keRole}".
  * Buat catatan pelimpahan: "Wewenang ${d.dariRole} dialihkan ke ${d.keRole} karena perampingan organisasi."`
  )
  .join('\n')}`
      : '';

  const systemInstruction = `Anda adalah Analis Keamanan Sistem & Perancang Matriks Hak Akses (Role-Based Access Control / RBAC) untuk Aplikasi Bisnis Nyata.
Tugas Anda: Menyusun Matriks Hak Akses (RBAC) per Modul Fungsional yang SANGAT PRESISI, AMAN, dan MURNI DIGROUNDING pada alur kerja nyata dan peran yang aktif.

ATURAN WAJIB & LARANGAN MUTLAK:
1. KOLOM ROLE WAJIB HANYA PERAN AKTIF:
   Daftar Peran Aktif: ${activeRoles.join(', ')}.
   DILARANG KERAS membuat kolom untuk peran yang tidak ada di daftar ini! Peran eksternal yang tidak dipakai dilarang muncul!

2. PEMISAHAN MODUL FUNGSIONAL (SEPARATION OF DUTIES):
   - Jika suatu proses alur kerja melibatkan pergantian pelaku atau serah-terima tanggung jawab (contoh abstrak: Role Pemohon membuat pengajuan awal → Role Staf Operasional memverifikasi dan mengeksekusi layanan), DILARANG KERAS menggabungkannya ke dalam 1 baris modul!
   - WAJIB dipecah menjadi modul-modul fungsional terpisah berdasarkan tanggung jawab pelaku:
     * Modul Layanan Mandiri Pemohon (misal: "Pengajuan & Permohonan Mandiri" atau "Pemesanan Layanan Mandiri")
     * Modul Operasional Internal Staf (misal: "Verifikasi Berkas & Pemrosesan Layanan" atau "Pelaksanaan Tugas Lapangan")
   - Modul hanya digabung jika mengelola objek data referensi/katalog yang sama dengan hirarki otorisasi (misal: "Manajemen Data Master / Katalog Tarif").

3. ACTION-SCOPED PERMISSIONS (DILARANG KERAS CRUD GENERIK):
   - DILARANG KERAS menuliskan label izin generik polos seperti "Create, Read", "CRUD", "Read Only", "Akses Penuh", "View, Edit".
   - Setiap izin WAJIB menyebutkan CAKUPAN DATA (SCOPE) dan TINDAKAN SPESIFIK:
     * Untuk Peran Publik / Pemohon / Pengguna Luar: "Buat & Pantau (Milik Sendiri)" atau "Input Form & Upload Berkas (Milik Sendiri)". Role publik TIDAK BOLEH memiliki akses ke modul operasional internal staf!
     * Untuk Staf Operasional / Eksekutor Internal: "Verifikasi Berkas & Eksekusi Operasional (Semua Data Aktif)" atau "Catat Hasil Pelaksanaan & Pembaruan Status (Data Bertugas)".
     * Untuk Pemilik / Super Admin / Pimpinan: "Supervisi, Otorisasi Pembatalan, & Audit Penuh" atau "Pengaturan Master Data & Kontrol Penuh".
     * Jika role TIDAK BERHAK / tidak terlibat pada modul tersebut: tulis "-" atau "Tidak Memiliki Akses".

4. JUMLAH MODUL PROPORSIONAL:
   - Buat 4 hingga 6 modul fungsional yang mencakup seluruh Alur Inti, Alur Pendukung, dan Fitur Utama sistem ini.
   - Setiap modul harus punya nama yang jelas dan deskripsi fungsional 1 kalimat.

${delegationNotesPrompt}

5. FORMAT OUTPUT JSON WAJIB:
{
  "modul": [
    {
      "nama": "Nama Modul Fungsional",
      "deskripsiFungsional": "Deskripsi singkat fungsi dan tujuan modul ini",
      "izinPerRole": [
        { "role": "Nama Peran", "level": "Tindakan Spesifik (Cakupan Data)", "keterangan": "penjelasan singkat batasan wewenang" }
      ]
    }
  ],
  "catatanPelimpahan": [
    "Catatan pelimpahan jika ada peran yang tugasnya dialihkan"
  ]
}`;

  const userPrompt = `Domain Usaha: ${businessDomain}

Gambaran Proses:
${narrative}

Daftar Peran Aktif:
${activeRoles.join(', ')}

Alur Inti Operasional:
${alurInti.map((s) => `${s.step}. (${s.pelaku}) ${s.aksi}`).join('\n')}

Alur Pendukung:
${alurPendukung.map((ap) => `- ${ap.nama}: ${ap.steps.map((s) => `(${s.pelaku}) ${s.aksi}`).join(' -> ')}`).join('\n')}

Fitur Pendukung:
${fiturPendukung.map((fp) => `- ${typeof fp === 'string' ? fp : (fp as any)?.label || fp}`).join('\n')}

Susun matriks hak akses per modul fungsional dalam format JSON:`;

  const parseAndValidateRbac = (rawText: string | null): RbacMatrixResult | null => {
    if (!rawText) return null;
    try {
      const parsed = robustJsonParse<any>(rawText);
      if (parsed && Array.isArray(parsed.modul) && parsed.modul.length > 0) {
        const validatedModul: {
          nama: string;
          deskripsiFungsional?: string;
          izinPerRole: { role: string; level: string; keterangan?: string }[];
        }[] = [];

        for (const m of parsed.modul) {
          if (m && typeof m.nama === 'string') {
            const izinPerRole: { role: string; level: string; keterangan?: string }[] = [];
            for (const r of activeRoles) {
              const found = Array.isArray(m.izinPerRole)
                ? m.izinPerRole.find((ip: any) => String(ip.role || '').trim().toLowerCase() === r.toLowerCase())
                : null;
              izinPerRole.push({
                role: r,
                level: found ? String(found.level || '-').trim() : '-',
                keterangan: found?.keterangan ? String(found.keterangan).trim() : undefined
              });
            }
            validatedModul.push({
              nama: String(m.nama).trim(),
              deskripsiFungsional: m.deskripsiFungsional ? String(m.deskripsiFungsional).trim() : undefined,
              izinPerRole
            });
          }
        }

        if (validatedModul.length > 0) {
          const catatanPelimpahan = Array.isArray(parsed.catatanPelimpahan) && parsed.catatanPelimpahan.length > 0
            ? parsed.catatanPelimpahan.map((c: any) => String(c).trim())
            : delegated.length > 0
              ? delegated.map((d) => `Wewenang operasional "${d.dariRole}" dialihkan ke "${d.keRole}" karena perampingan staf (${d.daftarTugas.join(', ')}).`)
              : undefined;

          const candidate: RbacMatrixResult = {
            modul: validatedModul,
            markdownTable: renderRbacMarkdownTable(activeRoles, validatedModul, catatanPelimpahan),
            catatanPelimpahan
          };

          const relevance = validateRbacMatrixRelevance(candidate, session);
          if (!relevance.valid) {
            console.warn(`[AI-RBAC] Ditolak karena uji relevansi gagal: ${relevance.anomalyFound}`);
            return null;
          }

          return candidate;
        }
      }
    } catch (e) {
      console.warn('[AI-RBAC] Gagal parse JSON AI:', e);
    }
    return null;
  };

  // Panggilan AI Utama (maxTokens dinaikkan ke 5000 agar tidak terpotong)
  let raw = await invokeAIChat({
    systemInstruction,
    userPrompt,
    temperature: 0.3,
    maxTokens: 5000,
    provider,
    userApiKey: apiKey,
    userModel: model
  });

  let parsedRbac = parseAndValidateRbac(raw);

  // Jika gagal parse atau memuat anomali domain asing, lakukan retry 1x
  if (!parsedRbac && (provider || apiKey || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY)) {
    console.log('[AI-RBAC] Melakukan retry AI 1x dengan prompt penegasan format & relevansi...');
    const retryPrompt = `${userPrompt}\n\n⚠️ PERINGATAN PENTING:
Output JSON matriks RBAC Anda sebelumnya terpotong atau memuat modul dari domain bisnis yang tidak relevan!
WAJIB keluarkan HANYA JSON murni yang valid tanpa komentar, tanpa trailing comma, dan modul-modulnya 100% mencerminkan Alur Inti dan Alur Pendukung di atas.`;

    raw = await invokeAIChat({
      systemInstruction,
      userPrompt: retryPrompt,
      temperature: 0.2,
      maxTokens: 5000,
      provider,
      userApiKey: apiKey,
      userModel: model
    });
    parsedRbac = parseAndValidateRbac(raw);
  }

  const elapsed = Date.now() - startTime;
  console.log(`[AI-RBAC] Selesai dalam ${elapsed}ms`);

  if (parsedRbac) {
    return parsedRbac;
  }

  console.warn('[AI-RBAC] AI call gagal atau tidak lolos validasi, beralih ke fallback deterministik dinamis');
  return generateFallbackRbacMatrix(session);
}

export async function reviseRbacMatrixWithAI(
  session: MockupSessionState,
  userCorrection: string,
  provider?: string,
  apiKey?: string,
  model?: string
): Promise<RbacMatrixResult> {
  const startTime = Date.now();
  const currentModul = session.rbac?.modul || [];
  const removedExt = session.roles?.removedExternalRoles || [];
  const activeRoles = (session.roles?.selected || ['Super Admin', 'Staf Operasional', 'Pelanggan']).filter(
    (r) => !removedExt.includes(r)
  );
  const delegated = session.roles?.tugasDilimpahkan || [];

  if (currentModul.length === 0) {
    return generateRbacMatrixWithAI(session, provider, apiKey, model);
  }

  const systemInstruction = `Anda adalah Analis Keamanan Sistem & Perancang RBAC.
Tugas Anda: Memperbaiki dan memperbarui Matriks Hak Akses (RBAC) berdasarkan koreksi pengguna.

ATURAN REVISI (KONSISTEN & KUMULATIF):
1. Baca koreksi pengguna dengan teliti: sesuaikan baris modul atau wewenang role yang diminta.
2. PERTAHANKAN seluruh modul dan wewenang peran lain yang tidak diminta diubah (KUMULATIF).
3. Kolom peran WAJIB HANYA terdiri dari: ${activeRoles.join(', ')}.
4. Pertahankan kaidah Action-Scoped Permissions (sebutkan Scope: "Milik Sendiri", "Semua Data", dsb) dan hindari CRUD generik.
5. Format output JSON sama persis dengan format modul RBAC.`;

  const userPrompt = `Matriks Hak Akses Saat Ini:
${JSON.stringify(currentModul, null, 2)}

Daftar Peran Aktif:
${activeRoles.join(', ')}

Koreksi / Penyesuaian Pengguna:
"${userCorrection}"

Perbarui dan kembalikan JSON lengkap:`;

  const raw = await invokeAIChat({
    systemInstruction,
    userPrompt,
    temperature: 0.4,
    maxTokens: 3500,
    provider,
    userApiKey: apiKey,
    userModel: model
  });

  const elapsed = Date.now() - startTime;
  console.log(`[AI-RBAC-REVISE] Selesai dalam ${elapsed}ms`);

  if (raw) {
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed.modul) && parsed.modul.length > 0) {
          const validatedModul: {
            nama: string;
            deskripsiFungsional?: string;
            izinPerRole: { role: string; level: string; keterangan?: string }[];
          }[] = [];

          for (const m of parsed.modul) {
            if (m && typeof m.nama === 'string') {
              const izinPerRole: { role: string; level: string; keterangan?: string }[] = [];
              for (const r of activeRoles) {
                const found = Array.isArray(m.izinPerRole)
                  ? m.izinPerRole.find((ip: any) => String(ip.role || '').trim().toLowerCase() === r.toLowerCase())
                  : null;
                izinPerRole.push({
                  role: r,
                  level: found ? String(found.level || '-').trim() : '-',
                  keterangan: found?.keterangan ? String(found.keterangan).trim() : undefined
                });
              }
              validatedModul.push({
                nama: String(m.nama).trim(),
                deskripsiFungsional: m.deskripsiFungsional ? String(m.deskripsiFungsional).trim() : undefined,
                izinPerRole
              });
            }
          }

          if (validatedModul.length > 0) {
            const catatanPelimpahan = Array.isArray(parsed.catatanPelimpahan) && parsed.catatanPelimpahan.length > 0
              ? parsed.catatanPelimpahan.map((c: any) => String(c).trim())
              : session.rbac?.catatanPelimpahan;

            const markdownTable = renderRbacMarkdownTable(activeRoles, validatedModul, catatanPelimpahan);
            return {
              modul: validatedModul,
              markdownTable,
              catatanPelimpahan
            };
          }
        }
      }
    } catch (e) {
      console.warn('[AI-RBAC-REVISE] Gagal parse JSON revisi:', e);
    }
  }

  // Fallback koreksi jika LLM gagal: pertahankan modul yang ada
  const markdownTable = renderRbacMarkdownTable(activeRoles, currentModul, session.rbac?.catatanPelimpahan);
  return {
    modul: currentModul,
    markdownTable,
    catatanPelimpahan: session.rbac?.catatanPelimpahan
  };
}

export interface DataSchemaResult {
  tabel: {
    nama: string;
    keterangan?: string;
    field: { nama: string; tipe: string; keterangan: string }[];
  }[];
  korelasiRingkas?: string;
  markdownTable?: string;
}

export function generateFallbackDataSchema(session: MockupSessionState): DataSchemaResult {
  const delegated = session.roles?.tugasDilimpahkan || [];
  const activeRoles = session.roles?.selected || ['Super Admin', 'Staf Operasional', 'Pelanggan'];
  const rbacModul = session.rbac?.modul || [];
  const alurPendukung = session.flow?.alurPendukung || [];

  const tabel: {
    nama: string;
    keterangan?: string;
    field: { nama: string; tipe: string; keterangan: string }[];
  }[] = [];

  // Tabel 1: pengguna (selalu ada untuk multi-role RBAC)
  tabel.push({
    nama: 'pengguna',
    keterangan: 'Menyimpan akun pengguna, kredensial, dan peran wewenang aktif di sistem',
    field: [
      { nama: 'id', tipe: 'text', keterangan: 'Identitas unik pengguna' },
      { nama: 'nama_lengkap', tipe: 'text', keterangan: 'Nama lengkap pengguna atau staf' },
      { nama: 'role', tipe: 'text', keterangan: `Peran pengguna (${activeRoles.join(' / ')})` },
      { nama: 'kontak', tipe: 'text', keterangan: 'Nomor WhatsApp atau alamat email aktif' },
      { nama: 'status_aktif', tipe: 'text', keterangan: 'Status keaktifan akun (Aktif / Nonaktif)' }
    ]
  });

  const getDelegationNote = (defaultActor: string): string => {
    const d = delegated.find((item) => item.dariRole.toLowerCase() === defaultActor.toLowerCase());
    if (d) {
      return `Selalu diisi oleh ${d.keRole} — peran "${d.dariRole}" telah dialihkan ke "${d.keRole}" karena perampingan organisasi`;
    }
    return `ID atau nama ${defaultActor} yang memproses data`;
  };

  const operationalRole = activeRoles.find((r) => !isSuperAdminRole(r) && !isActorEntityData(session, r)) || 'Staf Operasional';
  const customerRole = activeRoles.find((r) => isActorEntityData(session, r));

  // Tabel khusus untuk setiap ENTITAS_DATA yang dikelola oleh ownerRole (tanpa field kredensial)
  const entityDataActors = (session.actorsClassification || []).filter((a) => a.category === 'ENTITAS_DATA');
  for (const ent of entityDataActors) {
    const tableName = ent.actor.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const alreadyExists = tabel.some((t) => t.nama === tableName);
    if (!alreadyExists) {
      const managerRole = ent.ownerRole || operationalRole;
      tabel.push({
        nama: tableName,
        keterangan: `Mencatat data profil dan riwayat ${ent.actor} yang dikelola oleh ${managerRole}`,
        field: [
          { nama: 'id', tipe: 'text', keterangan: `Identitas unik data ${ent.actor}` },
          { nama: `nama_${tableName}`, tipe: 'text', keterangan: `Nama lengkap ${ent.actor}` },
          { nama: 'kontak_telepon', tipe: 'text', keterangan: `Nomor telepon atau kontak ${ent.actor}` },
          { nama: 'alamat_identitas', tipe: 'text', keterangan: `Alamat atau identitas pengenal ${ent.actor}` },
          { nama: 'status_verifikasi', tipe: 'text', keterangan: 'Status verifikasi data (Terverifikasi / Menunggu Verifikasi)' },
          { nama: 'dicatat_oleh', tipe: 'relasi ke pengguna', keterangan: `Staf yang mencatat dan mengelola data (${managerRole})` }
        ]
      });
    }
  }

  // Tabel 2: Transaksi / Permohonan Utama (disarikan dari modul mandiri / alur inti)
  const selfServiceModul = rbacModul.find((m) => /mandiri|pemesanan|pengajuan|pendaftaran|booking/i.test(m.nama));
  const mainEntityName = selfServiceModul
    ? selfServiceModul.nama.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
    : 'transaksi_layanan';

  tabel.push({
    nama: mainEntityName,
    keterangan: 'Mencatat data transaksi permohonan atau pemesanan utama dari pengguna',
    field: [
      { nama: 'id', tipe: 'text', keterangan: 'Kode transaksi unik' },
      { nama: customerRole ? `${customerRole.toLowerCase().replace(/\s+/g, '_')}_id` : 'pelanggan_id', tipe: customerRole ? 'relasi ke pengguna' : (entityDataActors.length > 0 ? `relasi ke ${entityDataActors[0].actor.toLowerCase().replace(/[^a-z0-9]+/g, '_')}` : 'relasi ke pengguna'), keterangan: 'ID pihak pemohon / pelanggan' },
      { nama: 'tanggal_pengajuan', tipe: 'tanggal', keterangan: 'Waktu permohonan atau pemesanan dibuat' },
      { nama: 'rincian_kebutuhan', tipe: 'text', keterangan: 'Deskripsi permohonan, item, atau layanan yang diminta' },
      { nama: 'status_transaksi', tipe: 'text', keterangan: 'Status proses (Menunggu Verifikasi / Diproses / Selesai / Dibatalkan)' },
      { nama: 'diverifikasi_oleh', tipe: 'relasi ke pengguna', keterangan: getDelegationNote(operationalRole) }
    ]
  });

  // Tabel 3: Pengerjaan Fisik / Operasional Lapangan (disarikan dari modul staf operasional)
  const operationalModul = rbacModul.find((m) => /operasional|pelaksanaan|verifikasi|inspeksi|layanan/i.test(m.nama) && m !== selfServiceModul);
  const opEntityName = operationalModul
    ? operationalModul.nama.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
    : 'pelaksanaan_tugas';

  tabel.push({
    nama: opEntityName,
    keterangan: 'Mencatat pelaksanaan operasional teknis, pemeriksaan berkas, dan pengerjaan lapangan',
    field: [
      { nama: 'id', tipe: 'text', keterangan: 'Identitas unik lembar pengerjaan' },
      { nama: `${mainEntityName}_id`, tipe: `relasi ke ${mainEntityName}`, keterangan: 'Referensi ke transaksi permohonan terkait' },
      { nama: 'tanggal_pelaksanaan', tipe: 'tanggal', keterangan: 'Waktu eksekusi atau verifikasi dilakukan' },
      { nama: 'catatan_pemeriksaan', tipe: 'text', keterangan: 'Hasil observasi, kelayakan fisik, atau status kelengkapan' },
      { nama: 'petugas_eksekusi', tipe: 'relasi ke pengguna', keterangan: getDelegationNote(operationalRole) }
    ]
  });

  // Tabel 4: Penanganan Kendala / Alur Pendukung (jika ada)
  if (alurPendukung.length > 0) {
    tabel.push({
      nama: 'penanganan_kendala',
      keterangan: 'Mencatat riwayat kendala operasional, komplain layanan, atau jadwal pemeliharaan pendukung',
      field: [
        { nama: 'id', tipe: 'text', keterangan: 'Nomor tiket kendala unik' },
        { nama: `${mainEntityName}_id`, tipe: `relasi ke ${mainEntityName}`, keterangan: 'Referensi ke transaksi terkait (bila ada)' },
        { nama: 'tanggal_laporan', tipe: 'tanggal', keterangan: 'Waktu kendala atau jadwal servis dicatat' },
        { nama: 'deskripsi_kendala', tipe: 'text', keterangan: 'Rincian kendala teknis atau permohonan penyesuaian' },
        { nama: 'tindakan_solusi', tipe: 'text', keterangan: 'Langkah penyelesaian yang disetujui atau dieksekusi' },
        { nama: 'ditangani_oleh', tipe: 'relasi ke pengguna', keterangan: getDelegationNote(operationalRole) }
      ]
    });
  }

  const korelasiRingkas =
    `Setiap transaksi baru tercatat di tabel \`${mainEntityName}\` dengan menghubungkan akun \`pengguna\`. ` +
    `Staf operasional menindaklanjuti proses melalui tabel \`${opEntityName}\` untuk verifikasi dan pencatatan hasil kerja harian. ` +
    (alurPendukung.length > 0
      ? `Bila ditemukan kendala operasional atau jadwal pemeliharaan, tiket dicatat pada tabel \`penanganan_kendala\` untuk ditindaklanjuti hingga tuntas.`
      : `Seluruh riwayat transaksi dapat diaudit sewaktu-waktu oleh Super Admin untuk rekapitulasi performa.`);

  const markdownTable = renderDataSchemaMarkdown(tabel, korelasiRingkas);

  return {
    tabel,
    korelasiRingkas,
    markdownTable
  };
}

export async function detectTargetRoleSemanticAI(
  stem: string,
  kata: string,
  officialRoles: string[],
  opts?: {
    provider?: string;
    apiKey?: string;
    model?: string;
  }
): Promise<string | null> {
  if (!officialRoles || officialRoles.length === 0) return null;
  const rolesList = officialRoles.join(', ');
  const systemInstruction = `Anda adalah Analis Semantik Peran Sistem Aplikasi Bisnis.
Tugas Anda: Menilai apakah suatu kata/istilah field database secara semantik merujuk pada salah satu Peran Resmi pengguna yang tersedia.
Daftar Peran Resmi Tersedia: ${rolesList}.

Aturan Evaluasi:
1. Evaluasi apakah istilah field (misal: "pembimbing", "pengawas", "pendamping", "konselor", "pelatih") secara makna tugas atau wewenang merujuk ke salah satu Peran Resmi di atas.
2. Jika ada SATU peran resmi yang paling tepat dan cocok dengan keyakinan tinggi, balas HANYA dengan nama persis peran tersebut dari daftar peran resmi.
3. Jika TIDAK ADA yang cocok atau ragu-ragu, balas HANYA: TIDAK_COCOK.
4. DILARANG menambahkan penjelasan atau tanda baca apapun.`;

  const userPrompt = `Istilah field: "${stem}". Keterangan: "${kata}".\nManakah peran resmi yang paling cocok dari: [${rolesList}]?`;

  try {
    const raw = await invokeAIChat({
      systemInstruction,
      userPrompt,
      temperature: 0.1,
      maxTokens: 500,
      provider: opts?.provider,
      userApiKey: opts?.apiKey,
      userModel: opts?.model
    });

    if (!raw) return null;
    const clean = raw.trim().replace(/^[`'"]+|[`'"]+$/g, '').trim();
    if (clean.toUpperCase() === 'TIDAK_COCOK' || clean.toLowerCase().includes('tidak cocok')) {
      return null;
    }

    const matched = officialRoles.find(
      (r) => r.toLowerCase() === clean.toLowerCase() || clean.toLowerCase().includes(r.toLowerCase())
    );
    return matched || null;
  } catch (err) {
    console.warn('[AI-SEMANTIC-ROLE] Gagal evaluasi semantik peran:', err);
    return null;
  }
}

export async function extractTablesAndCorrelationFromParsed(
  parsed: any,
  fallbackCorrelation?: string,
  officialRoles?: string[],
  semanticAiMatcher?: SemanticRoleMatcher
): Promise<{ tables: { nama: string; keterangan?: string; field: { nama: string; tipe: string; keterangan: string; targetRole?: string }[] }[]; korelasiRingkas?: string } | null> {
  if (!parsed) return null;
  const rawTables = Array.isArray(parsed)
    ? parsed
    : (Array.isArray(parsed.tabel) ? parsed.tabel : (Array.isArray(parsed.tables) ? parsed.tables : null));

  if (!rawTables || rawTables.length === 0) return null;

  const validatedTables: {
    nama: string;
    keterangan?: string;
    field: { nama: string; tipe: string; keterangan: string; targetRole?: string }[];
  }[] = [];

  for (const t of rawTables) {
    const rawFields = t && (t.field || t.fields || t.kolom);
    if (t && typeof t.nama === 'string' && Array.isArray(rawFields) && rawFields.length > 0) {
      const validFields: { nama: string; tipe: string; keterangan: string; targetRole?: string }[] = [];
      for (const f of rawFields) {
        if (f && typeof f.nama === 'string') {
          const fieldObj: { nama: string; tipe: string; keterangan: string; targetRole?: string } = {
            nama: String(f.nama).trim().toLowerCase().replace(/\s+/g, '_'),
            tipe: String(f.tipe || 'text').trim(),
            keterangan: String(f.keterangan || f.deskripsi || '').trim()
          };
          if (f.targetRole && typeof f.targetRole === 'string' && f.targetRole.trim()) {
            fieldObj.targetRole = f.targetRole.trim();
          } else {
            const detected = await detectTargetRoleForFieldAsync(fieldObj, officialRoles, semanticAiMatcher);
            if (detected) {
              fieldObj.targetRole = detected;
            }
          }
          validFields.push(fieldObj);
        }
      }
      if (validFields.length > 0) {
        validatedTables.push({
          nama: String(t.nama).trim().toLowerCase().replace(/\s+/g, '_'),
          keterangan: t.keterangan ? String(t.keterangan).trim() : (t.deskripsi ? String(t.deskripsi).trim() : undefined),
          field: validFields
        });
      }
    }
  }

  if (validatedTables.length === 0) return null;

  // Normalisasi otomatis dan verifikasi integritas relasi (Bug 1 Fix)
  const tableNames = new Set(validatedTables.map((t) => t.nama.toLowerCase()));
  const userTable = validatedTables.find((t) => isTablePengguna(t.nama))?.nama || 'pengguna';

  for (const t of validatedTables) {
    for (const f of t.field) {
      const relMatch = f.tipe.match(/^relasi ke\s+([a-zA-Z0-9_]+)/i);
      if (relMatch) {
        const targetRaw = relMatch[1].toLowerCase();
        if (!tableNames.has(targetRaw)) {
          // Cek apakah targetRaw adalah nama/alias peran atau sinonim pengguna
          const isRoleOrUser =
            isTablePengguna(targetRaw) ||
            (officialRoles && officialRoles.some((r) => r.toLowerCase().replace(/\s+/g, '_') === targetRaw || r.toLowerCase().includes(targetRaw) || targetRaw.includes(r.toLowerCase()))) ||
            (f.targetRole && officialRoles && officialRoles.includes(f.targetRole));

          if (isRoleOrUser && tableNames.has(userTable)) {
            console.log(`[AI-DATA-SCHEMA] Auto-repair field relasi "${t.nama}.${f.nama}": tipe "${f.tipe}" dinormalisasi ke "relasi ke ${userTable}"`);
            f.tipe = `relasi ke ${userTable}`;
            if (!f.targetRole && officialRoles) {
              const matchedRole = officialRoles.find((r) => r.toLowerCase().replace(/\s+/g, '_') === targetRaw || r.toLowerCase().includes(targetRaw) || targetRaw.includes(r.toLowerCase()));
              if (matchedRole) {
                f.targetRole = matchedRole;
              }
            }
          }
        }
      }
    }
  }

  const korelasi = (parsed.korelasiRingkas || parsed.korelasi || parsed.summary)
    ? String(parsed.korelasiRingkas || parsed.korelasi || parsed.summary).trim()
    : fallbackCorrelation;

  return { tables: validatedTables, korelasiRingkas: korelasi };
}

export function detectInvalidSchemaRelations(
  tables: { nama: string; field: { nama: string; tipe: string; keterangan?: string }[] }[]
): string[] {
  const tableNames = new Set(tables.map((t) => t.nama.toLowerCase()));
  const errors: string[] = [];

  for (const t of tables) {
    for (const f of t.field) {
      const relMatch = (f.tipe || '').match(/^relasi ke\s+([a-zA-Z0-9_]+)/i);
      if (relMatch) {
        const target = relMatch[1].toLowerCase();
        if (!tableNames.has(target)) {
          errors.push(`Field "${t.nama}.${f.nama}" bertipe "relasi ke ${target}", namun tabel "${target}" tidak ada di dalam skema.`);
        }
      }
    }
  }

  return errors;
}

export function detectMissingCoreTermsFromSchema(
  tables: { nama: string; keterangan?: string; field: { nama: string; tipe: string; keterangan: string }[] }[],
  alurInti: { step: number; pelaku: string; aksi: string }[],
  fiturPendukung: string[] = []
): string[] {
  const missing: string[] = [];
  const allFieldTexts = tables.flatMap((t) => [
    t.nama.toLowerCase(),
    (t.keterangan || '').toLowerCase(),
    ...t.field.map((f) => `${f.nama.toLowerCase()} ${f.keterangan.toLowerCase()}`)
  ]).join(' ');

  const combinedAlurText = [
    ...alurInti.map((s) => s.aksi),
    ...fiturPendukung
  ].join('. ');

  const regexPatterns = [
    /(?:memilih|pilihan|pilih)\s+([a-z0-9_]+(?:\s+[a-z0-9_]+)?)/gi,
    /\b(paket\s+[a-z0-9_]+)/gi,
    /\b(jenis\s+[a-z0-9_]+)/gi,
    /\b(tipe\s+[a-z0-9_]+)/gi,
    /\b(kategori\s+[a-z0-9_]+)/gi
  ];

  const candidateTerms = new Set<string>();
  for (const regex of regexPatterns) {
    const matches = combinedAlurText.matchAll(regex);
    for (const m of matches) {
      const term = m[1]?.trim().toLowerCase();
      if (term && !/^(dan|atau|yang|untuk|dari|di|ke|pada|dengan|oleh|ini|itu)$/i.test(term)) {
        candidateTerms.add(term);
      }
    }
  }

  if (/paket\s+kursus/i.test(combinedAlurText) || /memilih\s+paket/i.test(combinedAlurText)) {
    candidateTerms.add('paket kursus');
  }

  for (const term of candidateTerms) {
    const keywords = term.split(/\s+/).filter((w) => w.length > 2);
    const isPresent = keywords.some((kw) => allFieldTexts.includes(kw));
    if (!isPresent) {
      missing.push(term);
    }
  }

  return Array.from(new Set(missing));
}

export async function generateDataSchemaWithAI(
  session: MockupSessionState,
  provider?: string,
  apiKey?: string,
  model?: string
): Promise<DataSchemaResult> {
  const startTime = Date.now();
  const activeRoles = session.roles?.selected || ['Super Admin', 'Staf Operasional', 'Pelanggan'];
  const delegated = session.roles?.tugasDilimpahkan || [];
  const narrative = session.storyline?.narasi || '';
  const mainFlow = session.flow?.alurInti || [];
  const alurPendukung = session.flow?.alurPendukung || [];
  const fiturPendukung = session.flow?.fiturPendukung || [];
  const rbacModul = session.rbac?.modul || [];
  const businessDomain = session.match?.businessCategory || 'Operasional Bisnis';

  const delegationRulesPrompt = delegated.length > 0
    ? `\n⚠️ ATURAN KHUSUS PELIMPAHAN TUGAS PADA FIELD TABEL (WAJIB DIPATUHI):
${delegated.map((d) => `- Peran "${d.dariRole}" telah DIHAPUS dari sistem dan seluruh wewenangnya dialihkan ke "${d.keRole}".
  * Setiap field pencatat/pemroses yang secara normal dikerjakan oleh "${d.dariRole}" (misal: dicatat_oleh, diverifikasi_oleh, kasir_id) WAJIB diberi keterangan: "Selalu diisi oleh ${d.keRole} — peran ${d.dariRole} telah dialihkan ke ${d.keRole} karena perampingan organisasi."`).join('\n')}`
    : '';

  const entityDataActors = (session.actorsClassification || []).filter((a) => a.category === 'ENTITAS_DATA');
  const entityDataRulesPrompt = entityDataActors.length > 0
    ? `\n⚠️ ATURAN KHUSUS ENTITAS DATA (BUKAN PENGGUNA SISTEM YANG LOGIN):
${entityDataActors
  .map(
    (e) =>
      `- "${e.actor}" adalah ENTITAS DATA yang dicatat dan dilayani oleh "${e.ownerRole || 'Staf Operasional'}", BUKAN akun pengguna login.
  * WAJIB dibuatkan tabel data tersendiri (misal: "${e.actor.toLowerCase()}") untuk mencatat profil dan riwayat bisnisnya.
  * DILARANG KERAS menyertakan field kredensial (username, password, pin, token) pada tabel "${e.actor.toLowerCase()}".
  * Field relasi dari tabel transaksi ke ${e.actor} merujuk ke tabel "${e.actor.toLowerCase()}" (tipe: "relasi ke ${e.actor.toLowerCase()}"), dan field pencatatnya merujuk ke pengguna dengan targetRole "${e.ownerRole || 'Staf Operasional'}".`
  )
  .join('\n')}`
    : '';

  const systemInstruction = `Anda adalah Analis Basis Data & Perancang Skema Data Aplikasi Bisnis Nyata.
Tugas Anda: Menyusun Skema Tabel Data dan Relasi Entitas yang SANGAT PRESISI, MURNI DIGROUNDING pada alur proses bisnis nyata, peran pengguna yang aktif, dan matriks hak akses (RBAC) yang telah disepakati.
${entityDataRulesPrompt}
${delegationRulesPrompt}

ATURAN WAJIB & STRICT PRINCIPLES:
1. PENYISIRAN KATA BENDA & ATRIBUT PILIHAN (GROUNDING MUTLAK):
   - SETIAP kata benda konkret, pilihan opsi, jenis, paket, tipe, kategori, instrumen, durasi, ruangan, tarif, atau metode yang disebutkan di Alur Inti, Alur Pendukung, maupun Fitur (misalnya: 'paket kursus', 'paket cuci', 'jenis layanan', 'ruangan studio', 'metode pembayaran') WAJIB diekstrak menjadi field nyata di tabel terkait!
   - DILARANG menyatukan atau mengaburkan pilihan konkret ini menjadi field generik seperti 'keterangan' atau 'catatan' semata.
   - Jika alur memuat pemilihan produk/paket:
     * Pada pola Katalog + Penghubung: tabel katalog memuat nama & rincian paket, sedangkan tabel penghubung memuat field relasi ke paket tersebut (misal: 'paket_id' atau 'kursus_id' dengan tipe 'relasi ke [tabel_katalog]').
     * Pada pola Relasi Langsung: tabel transaksi memuat field konkret seperti 'paket_kursus' atau 'jenis_layanan'.

2. POLA STRUKTUR DATA: HUBUNGAN LANGSUNG VS KATALOG PRODUK + PENDAFTARAN PENGHUBUNG (HEURISTIK PENALARAN ALUR):
   Evaluasi secara objektif isi Gambaran Proses, Alur Inti, dan Alur Pendukung yang SUDAH DIKONFIRMASI pengguna. Tentukan pola skema data yang tepat berdasarkan indikasi nyata berikut (BUKAN berdasarkan template atau pencocokan kata kunci nama domain):

   A. HEURISTIK PEMICU POLA "KATALOG PRODUK + PENDAFTARAN PENGHUBUNG":
      Terapkan pola Katalog + Penghubung JIKA narasi alur yang dikonfirmasi menunjukkan SALAH SATU dari kondisi berikut:
      1) Entitas (pelanggan/siswa/anggota/klien/pasien/pengguna) dapat mengambil lebih dari satu jenis produk/layanan yang sama-sama tercatat di sistem (bukan hanya satu opsi sekali pakai).
      2) Entitas dapat mengambil produk/layanan yang sama secara berulang kali (misal: mengambil paket baru setelah paket pertama selesai, menyewa unit lagi di waktu berbeda, langganan multi-periode).
      3) Terdapat indikasi eksplisit mengenai "riwayat" / "histori pembelian atau pendaftaran" / "riwayat transaksi" per entitas di alur operasional.

      JIKA HEURISTIK INI TERPICU, WAJIB SUSUN STRUKTUR DENGAN POLA 3 LAPIS:
      - LAPIS 1: TABEL KATALOG PRODUK/LAYANAN (Master Data)
        * Berisi daftar produk, paket, atau layanan dengan field deskriptif (misal: nama_paket/nama_layanan, tarif/harga, durasi/kapasitas, deskripsi, status_aktif).
        * DILARANG memiliki field relasi ke entitas pelanggan/pengguna (ini katalog master yang independen).
      - LAPIS 2: TABEL PENDAFTARAN / TRANSAKSI PENGHUBUNG (Connector / Bridge)
        * Berfungsi sebagai jembatan pencatatan antara entitas pengguna/pelanggan dan produk/layanan yang diambil.
        * WAJIB MEMILIKI DUA FIELD RELASI KUNCI (DILARANG KERAS MELEWATKAN SALAH SATUNYA):
          1) Field relasi ke entitas akun pengguna: WAJIB bertipe 'relasi ke pengguna' dengan targetRole diisi nama peran terkait (contoh: 'relasi ke pengguna' dengan targetRole 'Klien Perusahaan' atau 'Siswa'). DILARANG KERAS membuat nama tipe relasi ke nama peran seperti 'relasi ke klien', 'relasi ke siswa', atau 'relasi ke pelanggan' jika akun mereka tersimpan di tabel 'pengguna'!
          2) Field relasi ke tabel katalog produk/layanan yang dipilih: WAJIB 'relasi ke [nama_tabel_katalog_nyata]', contoh: 'relasi ke paket_kursus', 'relasi ke katalog_parameter_uji', 'relasi ke katalog_alat'.
          3) Tanggal transaksi/pendaftaran, status proses (misal: 'Menunggu Verifikasi' / 'Aktif' / 'Selesai' / 'Dibatalkan'), dan nomor/kode registrasi transaksi.
      - LAPIS 3: TABEL TRANSAKSIONAL TURUNAN (Jadwal, Evaluasi/Progres, Pembayaran/Angsuran, Presensi, Pelaksanaan Tugas, dsb)
        * Jika alur membutuhkan pencatatan turunan (misal sesi belajar/jadwal pertemuan, catatan perkembangan/evaluasi, bukti/angsuran pembayaran, progres pengerjaan):
        * Field relasi pada tabel turunan WAJIB MERUJUK KE TABEL PENDAFTARAN/TRANSAKSI PENGHUBUNG (misal: 'relasi ke pendaftaran_kursus', 'relasi ke transaksi_sewa', 'relasi ke pendaftaran_pengujian_sampel'), BUKAN langsung ke entitas pelanggan atau ke tabel katalog produk secara terpisah!

   B. POLA HUBUNGAN LANGSUNG (BISNIS TRANSAKSI TUNGGAL / SEKALI SELESAI):
      JIKA TIDAK ADA tanda-tanda multi-layanan berulang, histori pendaftaran per entitas, atau langganan berkelanjutan di narasi alur (misal: servis motor sekali datang langsung beres, cuci mobil reguler sekali datang langsung selesai):
      - TETAP GUNAKAN POLA SEDERHANA: Tabel transaksi/pencatatan langsung menghubungkan pelanggan dengan layanan atau pengerjaan saat itu.
      - JANGAN OVER-ENGINEER! Dilarang memaksakan pembuatan tabel katalog master dan tabel pendaftaran terpisah jika alurnya murni transaksi langsung sekali selesai.

   C. PRINSIP GENERALITAS PENALARAN (ZERO HARDCODED DOMAIN):
      Keputusan pola di atas MURNI HASIL PENALARAN ATAS DINAMIKA ALUR, BUKAN daftar kata kunci domain (jangan otomatis memicu hanya karena kata "kursus", dan jangan menolak hanya karena domain tidak umum). Evaluasi apakah relasi entitas ke produk bersifat transaksi langsung 1-kali-selesai atau multi-transaksi/berulang/histori.

3. REFERENSI POLA SKEMA UMUM INDUSTRI (MURNI PENALARAN AI - SEBAGAI PERTIMBANGAN PELENGKAP):
   - Gunakan pemahaman Anda tentang pola skema data yang LAZIM untuk jenis bisnis yang sedang dibangun:
     * Bisnis kursus / edukasi: lazim mencatat jenis/paket kursus, instrumen/mata pelajaran, level kemahiran, ruangan, jadwal sesi.
     * Bisnis servis / bengkel / klinik: lazim mencatat jenis layanan/tindakan, keluhan awal, diagnosa, suku cadang/obat.
     * Bisnis rental / sewa: lazim mencatat tipe/kategori unit, nomor polisi/identitas unit, tarif sewa, kondisi fisik unit.
     * Bisnis retail / inventaris: lazim mencatat kategori produk, satuan unit, harga modal/jual, stok minimum.
   - Seluruh field tambahan dari referensi umum ini TETAP harus masuk akal untuk alur spesifik dan tunduk pada prinsip "tanpa kuota artifisial" (tidak dipaksakan jika tidak relevan).

4. PEMETAAN DARI MODUL RBAC & ALUR KERJA:
   - Gunakan matriks modul RBAC sebagai petunjuk utama entitas data. Setiap modul fungsional umumnya membutuhkan setidaknya satu tabel data transaksi/pencatatan.
   - Jika proses bisnis membutuhkan struktur master-detail atau log tersendiri (misal: rincian item, angsuran cicilan, riwayat servis), sediakan tabel terkait secara proporsional.
   - Tabel akun pengguna / peran (misal: "pengguna") WAJIB ada untuk mendukung otorisasi RBAC peran-peran aktif: ${activeRoles.join(', ')}.

5. TANPA KUOTA ARTIFISIAL (3 HINGGA 6 TABEL PROPORSIONAL):
   - Rancang skema dengan jumlah tabel yang pas dan proporsional (biasanya 3 sampai 6 tabel).
   - Jangan membuat tabel kembung atau tabel dummy yang tidak ada kaitannya dengan alur kerja pengguna.

6. TIPE DATA MANUSIAWI & INTEGRITAS RELASI KE TABEL NYATA:
   - DILARANG KERAS memakai istilah teknis SQL seperti VARCHAR, INT, BIGINT, BOOLEAN, ENUM, TIMESTAMP, FOREIGN KEY!
   - Gunakan HANYA 4 tipe data yang mudah dipahami orang awam:
     a. "text" (untuk nama, catatan, kode, status, nomor surat, alamat, jenis, kategori)
     b. "angka" (untuk nominal uang, tarif, harga, durasi waktu, jumlah item, persentase)
     c. "tanggal" (untuk tanggal pengajuan, batas waktu, jadwal pelaksanaan, jam transaksi)
     d. "relasi ke [Nama Tabel]" (INTEGRITAS MUTLAK: [Nama Tabel] WAJIB merupakan NAMA TABEL NYATA yang tercantum dalam skema JSON Anda! Dilarang menaruh nama peran jika tabel fisiknya tidak dibuat. Semua relasi ke akun pengguna/pelanggan/siswa/klien/staf WAJIB bertipe "relasi ke pengguna").

7. KORELASI RINGKAS (BUKAN ERD VISUAL / BUKAN TABEL TERPISAH):
   - Di akhir, berikan 2-3 kalimat penjelasan korelasi ringkas yang menggambarkan aliran data antar-tabel dari hulu ke hilir.
${delegationRulesPrompt}

8. FORMAT OUTPUT JSON WAJIB:
{
  "tabel": [
    {
      "nama": "nama_tabel_huruf_kecil_underscore",
      "keterangan": "Fungsi dan tujuan tabel ini",
      "field": [
        { "nama": "id", "tipe": "text", "keterangan": "Identitas unik record" },
        { "nama": "nama_field", "tipe": "text", "keterangan": "Fungsi field ini" }
      ]
    }
  ],
  "korelasiRingkas": "2-3 kalimat ringkas alur keterhubungan antar-tabel dari transaksi awal hingga pelaporan akhir."
}`;

  const userPrompt = `Domain Usaha: ${businessDomain}

Gambaran Proses:
${narrative}
${session.storyline?.asumsiAlurUtama ? `Alur Utama (Storyline): ${session.storyline.asumsiAlurUtama}` : ''}

Daftar Peran Aktif:
${activeRoles.join(', ')}

Alur Inti Operasional:
${mainFlow.map((s) => `${s.step}. (${s.pelaku}) ${s.aksi}`).join('\n')}

Alur Pendukung:
${alurPendukung.map((ap) => `- ${ap.nama}: ${ap.steps.map((s) => `(${s.pelaku}) ${s.aksi}`).join(' -> ')}`).join('\n')}
${fiturPendukung.length > 0 ? `\nFitur Pendukung Disepakati:\n${fiturPendukung.map((fp, idx) => `${idx + 1}. ${fp}`).join('\n')}` : ''}

Matriks Modul RBAC yang Disepakati:
${rbacModul.map((m) => `- ${m.nama}: ${m.deskripsiFungsional || ''}`).join('\n')}

Rancang skema tabel data dan relasi dalam format JSON:`;

  const semanticAiMatcher: SemanticRoleMatcher = (stem, kata, roles) =>
    detectTargetRoleSemanticAI(stem, kata, roles, { provider, apiKey, model });

  const parseAndValidateDataSchema = async (rawText: string | null): Promise<DataSchemaResult | null> => {
    if (!rawText) return null;
    try {
      const parsed = robustJsonParse<any>(rawText);
      const extracted = await extractTablesAndCorrelationFromParsed(
        parsed,
        undefined,
        session.roles?.selected,
        semanticAiMatcher
      );
      if (extracted && extracted.tables.length >= 2) {
        const markdownTable = renderDataSchemaMarkdown(extracted.tables, extracted.korelasiRingkas);
        return {
          tabel: extracted.tables,
          korelasiRingkas: extracted.korelasiRingkas,
          markdownTable
        };
      }
    } catch (e) {
      console.warn('[AI-DATA-SCHEMA] Gagal parse JSON skema data:', e);
    }
    return null;
  };

  let raw = await invokeAIChat({
    systemInstruction,
    userPrompt,
    temperature: 0.3,
    maxTokens: 4000,
    provider,
    userApiKey: apiKey,
    userModel: model
  });

  let parsedSchema = await parseAndValidateDataSchema(raw);

  // Format retry jika parse gagal
  if (!parsedSchema && (provider || apiKey || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY)) {
    console.log('[AI-DATA-SCHEMA] Melakukan retry AI 1x dengan prompt penegasan format...');
    const retryPrompt = `${userPrompt}\n\n⚠️ PERINGATAN PENTING:
Output JSON Anda sebelumnya gagal diproses atau tidak lengkap!
WAJIB keluarkan HANYA JSON murni yang valid tanpa komentar, tanpa trailing comma, dan memuat array "tabel" (dengan "nama" dan array "field") serta "korelasiRingkas".`;

    raw = await invokeAIChat({
      systemInstruction,
      userPrompt: retryPrompt,
      temperature: 0.2,
      maxTokens: 4000,
      provider,
      userApiKey: apiKey,
      userModel: model
    });
    parsedSchema = await parseAndValidateDataSchema(raw);
  }

  // Validasi Grounding Kata Benda Alur (Bagian A.2)
  if (parsedSchema && (provider || apiKey || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY)) {
    const missingTerms = detectMissingCoreTermsFromSchema(parsedSchema.tabel, mainFlow, fiturPendukung);
    if (missingTerms.length > 0) {
      console.log(`[AI-DATA-SCHEMA] Terdeteksi istilah penting alur yang belum tercermin di field: ${missingTerms.join(', ')}. Melakukan penegasan grounding...`);
      const groundingRetryPrompt = `${userPrompt}\n\n⚠️ PERINGATAN GROUNDING ALUR BISNIS (WAJIB DIPENUHI):
Skema data Anda sebelumnya belum memuat atribut/entitas konkret yang secara eksplisit disepakati di Alur Operasional:
- Istilah/Pilihan yang belum tercermin: ${missingTerms.map((m) => `"${m}"`).join(', ')}.
WAJIB masukkan atribut di atas sebagai field nyata (misal: nama field, tipe, dan keterangannya) ke dalam tabel transaksi/pendaftaran/layanan yang sesuai!
Kembalikan JSON lengkap seluruh tabel yang telah diperbarui:`;

      const retryRaw = await invokeAIChat({
        systemInstruction,
        userPrompt: groundingRetryPrompt,
        temperature: 0.2,
        maxTokens: 4000,
        provider,
        userApiKey: apiKey,
        userModel: model
      });
      const retryParsed = await parseAndValidateDataSchema(retryRaw);
      if (retryParsed) {
        parsedSchema = retryParsed;
      }
    }

    const invalidRelations = detectInvalidSchemaRelations(parsedSchema.tabel);
    if (invalidRelations.length > 0) {
      console.log(`[AI-DATA-SCHEMA] Terdeteksi relasi menunjuk tabel tidak ada: ${invalidRelations.join('; ')}. Melakukan penegasan integritas relasi...`);
      const relationRetryPrompt = `${userPrompt}\n\n⚠️ PERINGATAN INTEGRITAS RELASI SKEMA (WAJIB DIPERBAIKI):
Skema data Anda sebelumnya memuat field relasi yang menunjuk ke tabel yang TIDAK ADA di dalam skema:
${invalidRelations.map((e) => `- ${e}`).join('\n')}

ATURAN PERBAIKAN MUTLAK:
1. Seluruh field bertipe "relasi ke [Nama Tabel]" WAJIB menunjuk tabel yang benar-benar ada di daftar tabel Anda!
2. Jika relasi mengarah ke akun pengguna (misal: pelanggan, siswa, klien, staf, instruktur), gunakan tipe "relasi ke pengguna" dengan targetRole peran tersebut (DILARANG membuat tipe relasi ke nama peran seperti "relasi ke klien" jika tabel fisiknya tidak ada).
Kembalikan JSON lengkap seluruh tabel yang telah diperbaiki:`;

      const retryRaw = await invokeAIChat({
        systemInstruction,
        userPrompt: relationRetryPrompt,
        temperature: 0.2,
        maxTokens: 4000,
        provider,
        userApiKey: apiKey,
        userModel: model
      });
      const retryParsed = await parseAndValidateDataSchema(retryRaw);
      if (retryParsed) {
        parsedSchema = retryParsed;
      }
    }
  }

  const elapsed = Date.now() - startTime;
  console.log(`[AI-DATA-SCHEMA] Selesai dalam ${elapsed}ms`);

  if (parsedSchema) {
    return parsedSchema;
  }

  console.warn('[AI-DATA-SCHEMA] AI call gagal atau tidak valid, beralih ke fallback deterministik dinamis');
  return generateFallbackDataSchema(session);
}

export async function reviseDataSchemaWithAI(
  session: MockupSessionState,
  userCorrection: string,
  provider?: string,
  apiKey?: string,
  model?: string
): Promise<DataSchemaResult> {
  const startTime = Date.now();
  const currentTables = session.dataSchema?.tabel || [];
  const activeRoles = session.roles?.selected || ['Super Admin', 'Staf Operasional', 'Pelanggan'];

  if (currentTables.length === 0) {
    return generateDataSchemaWithAI(session, provider, apiKey, model);
  }

  const systemInstruction = `Anda adalah Analis Basis Data & Perancang Skema Data Aplikasi Bisnis.
Tugas Anda: Memperbaiki dan memperbarui Skema Tabel Data berdasarkan koreksi atau masukan pengguna.

ATURAN REVISI (KONSISTEN & SESUAI KEBUTUHAN):
1. Baca koreksi pengguna dengan teliti: sesuaikan tabel, field, atau relasi yang diminta.
2. PERTAHANKAN tabel dan kolom yang ada secara kumulatif, KECUALI jika koreksi pengguna meminta penyederhanaan proses/penghapusan tabel yang tidak lagi relevan.
3. HEURISTIK POLA STRUKTUR DATA:
   - Jika alur bisnis atau koreksi melibatkan entitas yang dapat mengambil beberapa paket/layanan, mengambil layanan secara berulang, atau membutuhkan riwayat/histori pendaftaran: terapkan/pertahankan struktur 3 Lapis: (1) Tabel Katalog Produk/Layanan master tanpa relasi pelanggan, (2) Tabel Pendaftaran/Transaksi penghubung berelasi ke pelanggan DAN katalog, (3) Tabel Transaksional turunan (jadwal, evaluasi, pembayaran) berelasi ke Tabel Pendaftaran penghubung.
   - Jika koreksi pengguna MENGUBAH dinamika bisnis menjadi transaksi tunggal sekali selesai (misal: hanya 1 paket privat sekali seumur hidup tanpa katalog multi-paket, tanpa pendaftaran berulang, tanpa histori): AI WAJIB menyederhanakan skema menjadi pola relasi langsung (hapus tabel penghubung/katalog yang tidak diperlukan, gabungkan menjadi tabel transaksi/pelaksanaan langsung yang ringkas tanpa over-engineering).
   - Jika alur bisnis adalah transaksi langsung sekali selesai, pertahankan pola relasi langsung tanpa over-engineering.
4. INTEGRITAS RELASI KE TABEL NYATA:
   - Seluruh field bertipe "relasi ke [Nama Tabel]" WAJIB merujuk ke tabel yang benar-benar ada di dalam skema. Jika relasi mengarah ke akun pengguna (siswa, klien, pelanggan), WAJIB bertipe "relasi ke pengguna" dengan targetRole peran tersebut (DILARANG membuat nama tipe seperti "relasi ke klien" jika tabel fisiknya tidak ada).
5. Pertahankan tipe data manusiawi: "text", "angka", "tanggal", "relasi ke [Tabel]".
6. Format output JSON WAJIB memuat array "tabel" (dengan "nama", "keterangan", dan "field") serta "korelasiRingkas".`;

  const userPrompt = `Skema Tabel Data Saat Ini:
${JSON.stringify(currentTables, null, 2)}

Korelasi Saat Ini:
"${session.dataSchema?.korelasiRingkas || ''}"

Gambaran Bisnis & Alur:
${session.storyline?.narasi || ''}
${session.storyline?.asumsiAlurUtama ? `Alur Utama: ${session.storyline.asumsiAlurUtama}` : ''}

Daftar Peran Aktif:
${activeRoles.join(', ')}

Koreksi / Penyesuaian Pengguna:
"${userCorrection}"

Perbarui dan kembalikan JSON lengkap:`;

  const raw = await invokeAIChat({
    systemInstruction,
    userPrompt,
    temperature: 0.3,
    maxTokens: 4000,
    provider,
    userApiKey: apiKey,
    userModel: model
  });

  const elapsed = Date.now() - startTime;
  console.log(`[AI-DATA-SCHEMA-REVISE] Selesai dalam ${elapsed}ms`);

  if (raw) {
    try {
      const parsed = robustJsonParse<any>(raw);
      const semanticAiMatcher: SemanticRoleMatcher = (stem, kata, roles) =>
        detectTargetRoleSemanticAI(stem, kata, roles, { provider, apiKey, model });
      const extracted = await extractTablesAndCorrelationFromParsed(
        parsed,
        session.dataSchema?.korelasiRingkas,
        session.roles?.selected,
        semanticAiMatcher
      );
      if (extracted && extracted.tables.length > 0) {
        const markdownTable = renderDataSchemaMarkdown(extracted.tables, extracted.korelasiRingkas);
        return {
          tabel: extracted.tables,
          korelasiRingkas: extracted.korelasiRingkas,
          markdownTable
        };
      }
    } catch (e) {
      console.warn('[AI-DATA-SCHEMA-REVISE] Gagal parse JSON revisi:', e);
    }
  }

  // Fallback koreksi jika LLM gagal: pertahankan tabel yang ada
  const markdownTable = renderDataSchemaMarkdown(currentTables, session.dataSchema?.korelasiRingkas);
  return {
    tabel: currentTables,
    korelasiRingkas: session.dataSchema?.korelasiRingkas,
    markdownTable
  };
}

export interface SimulasiDbResult {
  contohData: SimulasiContohData;
  akunLogin: {
    nama: string;
    role: string;
    username: string;
    password: string;
  }[];
  instruksiGenerator: string[];
  markdownTable?: string;
}

export async function reviseSimulasiDbWithAI(
  session: MockupSessionState,
  userCorrection: string,
  provider?: string,
  apiKey?: string,
  model?: string
): Promise<SimulasiDbResult> {
  const startTime = Date.now();
  const currentSimulasi = session.simulasiDb || generateDeterministicSimulasiDb(session);
  const freshSimulasi = generateDeterministicSimulasiDb(session);
  const activeRoles =
    session.roles?.selected && session.roles.selected.length > 0
      ? session.roles.selected
      : [REQUIRED_ROLE];
  const tables = session.dataSchema?.tabel || [];
  const dRowsByTable = new Map<string, Record<string, any>[]>(
    freshSimulasi.contohData.tabel.map((t) => [t.nama, t.baris])
  );

  // Bangun data contoh untuk setiap tabel dari skema: ambil nilai AI bila ada,
  // sisanya isi ulang dari nilai deterministik (BUKAN placeholder).
  const buildContohTabelRevisi = (
    schemaTabel: typeof tables,
    parsedTabel: any[],
    fallbackMap: Map<string, Record<string, any>[]>
  ): SimulasiContohTabel[] =>
    schemaTabel.map((t) => {
      const pc = parsedTabel.find((x) => x && String(x?.nama || '').toLowerCase() === t.nama.toLowerCase());
      const aiRows: Record<string, any>[] = Array.isArray(pc?.baris) ? pc.baris : [];
      const dRows = fallbackMap.get(t.nama) || [];
      const rows: Record<string, any>[] = [0, 1, 2].map((i) => {
        const src = aiRows[i] || {};
        const row: Record<string, any> = {};
        for (const f of t.field) {
          const existingKey = Object.keys(src).find((k) => k.toLowerCase() === f.nama.toLowerCase());
          if (existingKey !== undefined && src[existingKey] !== undefined) {
            row[f.nama] = src[existingKey];
          } else {
            row[f.nama] = dRows[i]?.[f.nama] ?? '-';
          }
        }
        return row;
      });
      return {
        nama: t.nama,
        keterangan: t.keterangan,
        field: t.field.map((f) => ({ nama: f.nama, tipe: f.tipe, keterangan: f.keterangan })),
        baris: rows
      };
    });

  const schemaBrief = tables
    .map((t) => {
      const fields = t.field.map((f) => `${f.nama}${f.tipe ? ` (${f.tipe})` : ''}`).join(', ');
      return `- ${t.nama}: ${fields}`;
    })
    .join('\n');

  const systemInstruction = `Anda adalah Spesialis Data Dummy & Akun Uji Coba Prototipe Aplikasi Bisnis.
Tugas Anda: Memperbarui data contoh (SEMUA tabel, 3 baris per tabel) dan/atau akun demo login berdasarkan koreksi pengguna.

ATURAN REVISI KONSISTEN & KETAT:
1. Output JSON harus berisi SEMUA tabel berikut (tidak boleh ada yang terlewat):\n${schemaBrief}
2. NAMA FIELD pada setiap baris HARUS PERSIS SAMA 100% dengan field skema tabel terkait. DILARANG mengubah atau menambah nama field lain!
3. Setiap tabel dikembalikan tepat 3 baris data yang realistis sesuai koreksi pengguna.
4. Field bertipe "relasi ke [Entitas]" WAJIB berisi ID yang benar-benar muncul pada kolom ID tabel entitas tersebut (misal "MOB-001" harus dicantumkan di tabel armada_mobil). Jangan menaruh angka acak.
5. Akun login HARUS HANYA mencakup peran aktif: [${activeRoles.join(', ')}]. Format kredensial: username = lowercase(namaRole tanpa spasi), password = username + "123". Nama akun dapat disesuaikan jika pengguna memintanya.
6. Format output JSON:
{
  "contohData": {
    "tabel": [
      { "nama": "<nama tabel>", "baris": [ { ... 3 baris sesuai field skema ... } ] }
    ]
  },
  "akunLogin": [
    { "nama": "...", "role": "...", "username": "...", "password": "..." }
  ]
}`;

  const currentDataBrief =
    currentSimulasi.contohData && Array.isArray(currentSimulasi.contohData.tabel)
      ? JSON.stringify(
          currentSimulasi.contohData.tabel.map((t) => ({ nama: t.nama, baris: t.baris })),
          null,
          2
        )
      : '[]';

  const userPrompt = `Skema Tabel (Lengkap):
${schemaBrief}

Data Contoh Saat Ini:
${currentDataBrief}

Daftar Akun Demo Saat Ini:
${JSON.stringify(currentSimulasi.akunLogin || [], null, 2)}

Koreksi / Masukan Pengguna:
"${userCorrection}"

Perbarui SEMUA tabel di atas dan kembalikan JSON hasil revisi:`;

  const raw = await invokeAIChat({
    systemInstruction,
    userPrompt,
    temperature: 0.3,
    maxTokens: 4000,
    provider,
    userApiKey: apiKey,
    userModel: model
  });

  const elapsed = Date.now() - startTime;
  console.log(`[AI-SIMULASI-DB-REVISE] Selesai dalam ${elapsed}ms`);

  const instruksiGenerator = currentSimulasi.instruksiGenerator || [
    'Simpan tiap tabel dari session.dataSchema sebagai state di memori (React state atau array biasa saat generate kode nanti) — BUKAN localStorage/sessionStorage.',
    'Isi 3-5 baris data dummy per tabel dengan relasi yang VALID — field bertipe "relasi ke [Entitas]" harus benar-benar merujuk ke ID yang ada di tabel entitas tersebut, bukan angka acak.',
    'Akses data lewat fungsi terpisah per tabel (tambahTransaksi(), ambilProdukById(), dst) — bukan manipulasi array langsung tersebar di banyak tempat kode.',
    'Simulasikan relasi antar tabel secara manual di kode (pencarian berdasarkan id) — konsisten dengan cara kerja backend Google Sheets nanti yang tidak punya JOIN otomatis.',
    'Terapkan RBAC sejak prototipe menggunakan akun dummy di atas — role yang tidak punya akses ke suatu modul (sesuai matriks RBAC dari POIN 5) tidak boleh melihat data/fitur modul itu di prototipe.'
  ];

  if (raw) {
    try {
      const parsed = robustJsonParse<any>(raw);
      const parsedTables =
        parsed?.contohData && Array.isArray(parsed.contohData.tabel) ? parsed.contohData.tabel : [];
      const parsedAkun = parsed?.akunLogin;
      if (parsedTables.length > 0 || Array.isArray(parsedAkun)) {
        const contohTabel = buildContohTabelRevisi(tables, parsedTables, dRowsByTable);
        // Pastikan FK pada semua tabel merujuk ID yang benar-benar ada setelah revisi AI
        repairRelasiSimulasiDb(contohTabel);

        // Validasi akun login
        let validatedAkun = currentSimulasi.akunLogin;
        if (Array.isArray(parsedAkun) && parsedAkun.length > 0) {
          validatedAkun = activeRoles.map((role) => {
            const cleanUser = role.toLowerCase().replace(/[^a-z0-9]/g, '');
            const pass = `${cleanUser}123`;
            const matched = parsedAkun.find(
              (a: any) =>
                a && (a.role?.toLowerCase() === role.toLowerCase() || a.username?.toLowerCase() === cleanUser)
            );
            return {
              nama: matched?.nama ? String(matched.nama).trim() : `Akun Demo ${role}`,
              role,
              username: cleanUser,
              password: pass
            };
          });
        }

        const res: SimulasiDbResult = {
          contohData: { tabel: contohTabel },
          akunLogin: validatedAkun,
          instruksiGenerator
        };
        res.markdownTable = renderSimulasiDbMarkdown(res);
        return res;
      }
    } catch (err) {
      console.warn('[AI-SIMULASI-DB-REVISE] Gagal parse JSON revisi simulasi DB:', err);
    }
  }

  // Fallback: kembalikan current simulasi (tetap berisi semua tabel)
  const md = renderSimulasiDbMarkdown(currentSimulasi);
  return {
    contohData: currentSimulasi.contohData,
    akunLogin: currentSimulasi.akunLogin,
    instruksiGenerator,
    markdownTable: md
  };
}

// Jenis panggilan AI ringan untuk mengisi KONTEN (bukan struktur/relasi) pada SIMULASI_DB.
export type AiIsiNilaiSimulasiCaller = (
  systemInstruction: string,
  userPrompt: string
) => Promise<string | null>;

export type NilaiIsiSimulasi = Record<string, Record<string, unknown[]>>;

function cariFieldPK(tabel: { field: { nama: string; tipe?: string }[] }): { nama: string } | null {
  return (
    tabel.field.find((f) => f.nama === 'id') ||
    tabel.field.find((f) => /^id_/i.test(f.nama) && !/relasi ke/i.test(f.tipe || '')) ||
    tabel.field.find((f) => /^kode/i.test(f.nama)) ||
    tabel.field.find((f) => /^nomor_nota$|^no_nota$|^no_/i.test(f.nama)) ||
    null
  );
}

const fieldBolehDiisiAI = (f: { nama: string; tipe?: string }, pkField: { nama: string } | null): boolean => {
  const fLower = f.nama.toLowerCase();
  const fType = (f.tipe || '').toLowerCase();
  const isPk = Boolean(pkField && fLower === pkField.nama.toLowerCase());
  const isFk = fType.includes('relasi ke') || fLower.endsWith('_id') || (fLower.startsWith('id_') && fLower !== 'id');
  const isIdLike = /^(id|kode)/i.test(fLower) || isPk || isFk;
  return !isIdLike;
};

const normKeyIsi = (s: string): string => s.toLowerCase().replace(/[\s_]+/g, '');

/**
 * SATU pemanggilan AI ringan untuk mengisi nilai KONTEN field non-ID/non-relasi pada
 * SEMUA tabel sekaligus (prinsip satu-pemanggilan-terpadu). Nilai kembali berupa peta
 * tabel -> field -> array 3 nilai. Struktur, ID, dan relasi TETAP deterministik di kode.
 * Return null bila AI gagal / tak tersedia (proses lama):
 */
export async function aiIsiNilaiSimulasiDb(
  session: MockupSessionState,
  opts?: {
    provider?: string;
    apiKey?: string;
    model?: string;
    caller?: AiIsiNilaiSimulasiCaller;
    maxTokens?: number;
    masalahDariValidasi?: string[];
  }
): Promise<{ nilai: NilaiIsiSimulasi; latensiMs: number } | null> {
  const start = Date.now();
  const tables = session.dataSchema?.tabel || [];
  if (tables.length === 0) return null;

  const domain = session.match?.businessCategory || 'Aplikasi Bisnis';
  const cleanNarasi = session.storyline?.narasi
    ? session.storyline.narasi.replace(/Apakah ini sudah menggambarkan[\s\S]*$/i, '').trim()
    : '';
  const alurUtama = session.storyline?.asumsiAlurUtama || '';

  const schemaBrief = tables
    .map((t) => {
      const pk = cariFieldPK(t);
      const fields = t.field
        .filter((f) => fieldBolehDiisiAI(f, pk))
        .map((f) => `    - ${f.nama} (${f.tipe}) — ${f.keterangan || '-'}`)
        .join('\n');
      return `Tabel "${t.nama}"${t.keterangan ? ` (${t.keterangan})` : ''}:\n${fields || '    (semua field ID/relasi deterministik)'}`;
    })
    .join('\n\n');

  const systemInstruction = `Anda adalah penulis data contoh (dummy data) yang realistis dan kontekstual untuk prototipe aplikasi bisnis.
Tugas Anda: Mengisi NILAI KONTEN untuk field-field non-ID/non-relasi pada setiap tabel.
Anda HANYA mengisi konten (teks nama barang/layanan, kategori, pilihan status, harga wajar, warna, ukuran, tanggal, dsb).
Anda TIDAK membuat struktur tabel, ID primer, maupun relasi antar-tabel (karena ID & relasi sudah diatur secara deterministik oleh sistem).

ATURAN KETAT:
1. Kembalikan JSON valid tanpa markdown codeblock, tanpa komentar:
{
  "nilai": {
    "<nama tabel persis>": {
      "<nama field persis>": ["nilai baris 1", "nilai baris 2", "nilai baris 3"]
    }
  }
}
2. Sertakan SEMUA tabel dan SEMUA field yang terdaftar di bawah, masing-masing PERSIS 3 nilai berbeda yang masuk akal dan realistis untuk 3 baris data.
3. Nilai HARUS sangat kontekstual dengan domain bisnis dan KETERANGAN field:
   - BACA KETERANGAN FIELD LENGKAP SECARA SEMANTIK (ANTI-SALAH TAFSIR LOKASI):
     * Jika field berisi lokasi kerusakan/cacat/kondisi bagian fisik unit/barang (misal: "Lokasi kerusakan spesifik pada rangka atau ban", "Kondisi fisik barang"): nilai HARUS berupa deskripsi fisik komponen unit barang (misal sepeda: "Rantai kendor & lecet rangka", "Rem belakang aus", "Velg sedikit oleng"; kendaraan: "Baret pada bumper depan", "Lampu sen redup"; barang/alat: "Baret pemakaian wajar", "Komponen aus").
     * DILARANG KERAS menafsirkan kata "lokasi" pada kerusakan/kondisi barang sebagai alamat jalan atau alamat geografis ("Jl. Merdeka...", "Jl. Sudirman...")!
     * Alamat jalan ("Jl. ...", nomor jalan) HANYA untuk field tempat tinggal pelanggan/warga atau alamat outlet/cabang bisnis.
   - Jika field produk/barang/layanan/varian: gunakan nama produk/layanan nyata sesuai domain (misal distro/pakaian: "Kemeja Flannel Tartan", "Kaos Polos Cotton Combed", "Jaket Denim Trucker"; klinik hewan: "Kucing Persia", "Anjing Golden Retriever", "Kelinci Holland Lop"; es krim: "Vanilla Classic", "Dark Chocolate", "Strawberry Swirl").
   - Jika field ukuran baju/produk: gunakan ukuran industri nyata ("S", "M", "L", "XL").
   - Jika field warna: gunakan warna nyata ("Hitam Solid", "Navy Blue", "Olive Green", "Maroon").
   - Jika field status/ketersediaan/kondisi/evaluasi: patuhi pilihan yang tertulis di keterangan field (misal "Baik", "Rusak", "Perlu Servis" atau "Lulus", "Tidak Lulus"). DILARANG KERAS menggunakan placeholder generik seperti "Hasil A/B/C", "Pilihan 1/2/3", atau "Data 1/2/3".
   - Untuk kolom skor/nilai/angka evaluasi (misal nilai kopling, nilai rem, skor teknik): berikan angka realistis yang bervariasi wajar (misal: 85, 78, 92). DILARANG KERAS memberikan angka increment berurutan rata seperti 10, 20, 30 atau 1, 2, 3.
   - Untuk field peran/role pada tabel pengguna: nilai HARUS PERSIS SAMA (exact match) dengan salah satu nama peran resmi: [${(session.roles?.selected || []).join(', ')}]. DILARANG KERAS menyingkat nama peran (misal "Staf Administrasi" disingkat jadi "Staf", atau "Super Admin" jadi "Admin").
   - JANGAN PERNAH menaruh nama orang di field nama barang/produk/varian/status/ukuran/warna/spesifikasi.
   - Nama orang HANYA boleh dipakai untuk field nama pelanggan, nama staf, nama dokter, nama peminjam (gunakan nama orang Indonesia: "Budi Santoso", "Siti Rahma", "Ahmad Hidayat").
4. Untuk tipe "angka": kembalikan angka murni (number) dalam rentang nominal wajar:
   - KONSISTENSI SKALA FINANSIAL SATU BARIS (MUTLAK): Seluruh field nominal uang (seperti harga, tarif, biaya, tagihan, total_tagihan, deposit, jaminan, uang_muka, denda) dalam satu tabel HARUS menggunakan satuan skala nominal Rupiah penuh yang seragam (BUKAN sebagian Rupiah penuh dan sebagian singkatan ribuan).
   - Nilai field deposit/jaminan HARUS proporsional terhadap biaya/tagihan di baris yang sama (misal total tagihan rental 150.000 -> deposit 50.000 s.d. 100.000; DILARANG KERAS deposit bernilai 15 sementara total tagihan bernilai 150.000).
   - Tulis angka murni tanpa titik/koma (misal: harga/tagihan: 150000, 250000, 500000; deposit: 50000, 100000, 200000; stok: 10, 25, 50; bobot kg: 2.5, 4.0, 7.5).
5. Untuk tipe "tanggal": format "YYYY-MM-DD" (misal "2026-09-10", "2026-09-11", "2026-09-12").
6. DILARANG memakai placeholder seperti "Contoh Data", "Item 1", "Dummy", "...", "-", atau mengulang-ulang nama field.`;

  const userPrompt = `Bangun nilai contoh realistis untuk aplikasi berikut:
Domain Bisnis: ${domain}
${cleanNarasi ? `Gambaran Alur Kerja: ${cleanNarasi}\n` : ''}${alurUtama ? `Alur Utama: ${alurUtama}\n` : ''}
Daftar tabel dan field yang perlu diisi (SEMUA tabel, setiap field PERSIS 3 nilai realistis):

${schemaBrief}`;

  const retryNote =
    opts?.masalahDariValidasi && opts.masalahDariValidasi.length > 0
      ? `\n\nHasil sebelumnya DITOLAK validator dengan masalah berikut — perbaiki semua:
${opts.masalahDariValidasi.map((m) => `- ${m}`).join('\n')}

INSTRUKSI KHUSUS PERBAIKAN:
- Perbaiki setiap field di atas agar nilainya bervariasi, realistis, dan kontekstual sesuai skema.
- Untuk field yang memiliki pilihan di keterangan, pilih HANYA salah satu nilai dari daftar pilihan tersebut.
- Pastikan field kerusakan fisik barang TIDAK diisi alamat jalan ("Jl. ..."), melainkan bagian fisik yang rusak/kondisinya (misal 'rantai kendor', 'rem aus').
- Pastikan seluruh field nominal uang (deposit, total_tagihan, biaya) berskala Rupiah penuh dan proporsional (dilarang jomplang seperti deposit 15 vs tagihan 150.000).
- DILARANG membuat nilai increment rata (seperti 10, 20, 30); berikan skor/nilai natural yang bervariasi.
- DILARANG menggunakan placeholder generik ("Hasil A", "Data 1", dsb).`
      : '';

  let raw: string | null = null;
  try {
    raw = opts?.caller
      ? await opts.caller(systemInstruction, userPrompt + retryNote)
      : await invokeAIChat({
          systemInstruction,
          userPrompt: userPrompt + retryNote,
          temperature: 0.4,
          maxTokens: opts?.maxTokens || 3000,
          provider: opts?.provider,
          userApiKey: opts?.apiKey,
          userModel: opts?.model
        });
  } catch (e) {
    console.warn('[AI-SIMULASI-ISI] AI call throw/error:', e);
    return null;
  }

  const latensiMs = Date.now() - start;
  if (!raw) return null;

  try {
    const parsed = robustJsonParse<{ nilai?: Record<string, Record<string, unknown>> }>(raw);
    const parsedNilai = parsed?.nilai;
    if (!parsedNilai || typeof parsedNilai !== 'object') {
      console.warn('[AI-SIMULASI-ISI] JSON AI tidak memuat objek "nilai"');
      return null;
    }

    const nilai: NilaiIsiSimulasi = {};
    for (const t of tables) {
      const pk = cariFieldPK(t);
      const tKey = Object.keys(parsedNilai).find((k) => normKeyIsi(k) === normKeyIsi(t.nama));
      const parsedFieldObj = tKey ? parsedNilai[tKey] : undefined;
      if (!parsedFieldObj || typeof parsedFieldObj !== 'object') continue;

      for (const f of t.field) {
        if (!fieldBolehDiisiAI(f, pk)) continue;
        const fKey = Object.keys(parsedFieldObj).find((k) => normKeyIsi(k) === normKeyIsi(f.nama));
        const vals = fKey ? parsedFieldObj[fKey] : undefined;
        const arr = Array.isArray(vals)
          ? vals.filter((v: unknown) => v !== null && v !== undefined)
          : [];
        if (arr.length === 0) continue;
        if (!nilai[t.nama]) nilai[t.nama] = {};
        nilai[t.nama][f.nama] = arr;
      }
    }

    const total = Object.values(nilai).reduce((n, m) => n + Object.keys(m).length, 0);
    if (total === 0) {
      console.warn('[AI-SIMULASI-ISI] Tidak ada field yang bisa diisi AI (semua ID/relasi), pakai kamus');
      return null;
    }
    console.log(`[AI-SIMULASI-ISI] ${tables.length} tabel / ${total} field diisi AI dalam ${latensiMs}ms`);
    return { nilai, latensiMs };
  } catch (e) {
    console.warn('[AI-SIMULASI-ISI] Gagal parse JSON nilai AI:', e);
    return null;
  }
}

export interface SimulasiDbHybridResult {
  simulasiDb: NonNullable<MockupSessionState['simulasiDb']>;
  sumber: 'ai' | 'kamus';
  latensiAIMs: number;
  masalahTerakhir?: string[];
}

/**
 * Pengisi nilai SIMULASI_DB model HYBRID:
 * - 1) coba isi konten lewat SATU panggilan AI ringan (aiIsiNilaiSimulasiDb)
 * - 2) susun deterministik dengan nilai AI tsb (struktur/ID/relasi dari kode)
 * - 3) validasi hasil dgn validateContohDataVsSchema; ada masalah -> retry AI 1x dgn feedback
 * - 4) masih bermasalah / AI gagal -> fallback mulus ke kamus kata kunci (BERJAMIN lulus)
 */
export async function generateSimulasiDbHybrid(
  session: MockupSessionState,
  opts?: {
    provider?: string;
    apiKey?: string;
    model?: string;
    caller?: AiIsiNilaiSimulasiCaller;
    maxTokens?: number;
  }
): Promise<SimulasiDbHybridResult> {
  const start = Date.now();
  const schemaTables = session.dataSchema?.tabel || [];

  const buildDenganAI = (nilai: NilaiIsiSimulasi) => generateDeterministicSimulasiDb(session, { nilaiAI: nilai });

  const cobaAI = async (masalah?: string[]) => {
    try {
      const aiRes = await aiIsiNilaiSimulasiDb(session, {
        provider: opts?.provider,
        apiKey: opts?.apiKey,
        model: opts?.model,
        caller: opts?.caller,
        maxTokens: opts?.maxTokens,
        masalahDariValidasi: masalah
      });
      if (!aiRes) return null;
      const built = buildDenganAI(aiRes.nilai);
      const validasi = validateContohDataVsSchema(built.contohData, schemaTables, session.roles?.selected);
      return { built, masalah: validasi };
    } catch (e) {
      console.warn('[AI-SIMULASI-ISI] kendala saat membangun hasil AI:', e);
      return null;
    }
  };

  let hasil = await cobaAI();
  if (hasil && hasil.masalah.length > 0) {
    console.log(`[AI-SIMULASI-ISI] Retry 1x (validator: ${hasil.masalah.length} masalah): ${hasil.masalah.slice(0, 3).join('; ')}`);
    hasil = await cobaAI(hasil.masalah);
  }
  if (hasil && hasil.masalah.length === 0) {
    return { simulasiDb: hasil.built, sumber: 'ai', latensiAIMs: Date.now() - start };
  }

  console.warn('[AI-SIMULASI-ISI] AI gagal / hasil tidak lolos validasi, fallback ke kamus kata kunci');
  return {
    simulasiDb: generateDeterministicSimulasiDb(session),
    sumber: 'kamus',
    latensiAIMs: Date.now() - start,
    masalahTerakhir: hasil?.masalah
  };
}

async function generateNarration(
  session: MockupSessionState,
  action: GuidedAction,
  stepTitle: string | undefined,
  provider: string | undefined,
  userApiKey: string | undefined,
  userModel: string | undefined
): Promise<string> {
  const narrationPrompt = buildNarrationPrompt(session, action, stepTitle);
  const systemInstruction =
    'Anda adalah Partner Diskusi & Konsultan Aplikasi AI dari platform "Aplikasi Generator". Berikan narasi singkat, hangat, bersahabat, dan konkret. Sebut kegiatan ini sebagai "Aplikasi Generator", jangan gunakan istilah "perancangan aplikasi". Jangan pernah mengubah daftar opsi pilihan pengguna.';

  const aiText = await invokeAIChat({
    systemInstruction,
    userPrompt: narrationPrompt,
    temperature: 0.5,
    maxTokens: 220,
    provider,
    userApiKey,
    userModel
  });

  if (aiText) return aiText;

  // Fallback deterministik bila AI tidak tersedia
  const category = session.match.businessCategory || getIndustryOverlaysByIds(session.match.overlayIds)[0]?.nama || session.match.templateId || 'kebutuhan bisnis Anda';
  if (action === 'START') {
    return session.storyline?.narasi || `Mari kita mulai dengan proses bisnis untuk ${category}.`;
  }
  if (action === 'COMPILE') {
    return 'Brief sudah dirapikan dari pilihan Anda. Silakan cek halaman Brief, edit bila perlu, lalu setujui untuk membuat prototipe.';
  }
  return stepTitle ? `Oke, lanjut ke bagian berikutnya: ${stepTitle.replace(/\s*\(.*\)\s*$/, '')}.` : 'Oke, lanjut.';
}

export interface RoleAnalysisItem {
  name: string;
  note?: string;
}

export interface AnalyzeRolesInput {
  rolesToAnalyze: (string | RoleAnalysisItem)[];
  session?: MockupSessionState;
  existingRoles?: Array<{ id?: string; label: string; description?: string; responsibilities?: string[] }>;
  provider?: string;
  userApiKey?: string;
  userModel?: string;
}

export interface RoleDetailOutput {
  narasi: string;
  tanggungJawab: string[];
  isSimilar?: boolean;
  similarRoleName?: string | null;
  similarityExplanation?: string | null;
}

export async function analyzeRolesWithAI(input: AnalyzeRolesInput): Promise<Record<string, RoleDetailOutput>> {
  const { rolesToAnalyze, session, existingRoles = [], provider, userApiKey, userModel } = input;
  if (!rolesToAnalyze || rolesToAnalyze.length === 0) {
    return {};
  }

  // Normalisasi daftar role yang akan dianalisis
  const normalizedRoles: RoleAnalysisItem[] = rolesToAnalyze
    .map((r) => (typeof r === 'string' ? { name: r.trim() } : { name: r.name.trim(), note: r.note?.trim() }))
    .filter((r) => r.name.length > 0);

  if (normalizedRoles.length === 0) {
    return {};
  }

  const category = session?.match?.businessCategory || 'bisnis ini';
  const story = `${session?.storyline?.narasi || ''}`.trim();
  const mainFlow = `${session?.storyline?.asumsiAlurUtama || ''}`.trim();
  const existingListStr = existingRoles
    .map((r) => `- ${r.label}${r.description ? `: ${r.description}` : ''}`)
    .join('\n');

  const singleNote = normalizedRoles[0]?.note;
  const isHierarchicalRelation = Boolean(
    singleNote &&
    /\b(menerima\s+(?:hasil|setoran|barang|data|laporan|pembelian)|menampung|membawahi|mengawasi|mengkoordinir|melapor\s+ke|di\s+bawah|dari\s+para|dari\s+setiap|dari\s+semua)\b/i.test(singleNote)
  );

  const rolesPromptList = normalizedRoles
    .map((r, i) => `${i + 1}. "${r.name}"${r.note ? ` (Catatan konteks: "${r.note}")` : ''}`)
    .join('\n');

  const systemInstruction = `Anda adalah Analis Proses Bisnis & Perancangan Struktur Kerja Aplikasi yang sangat cermat dan berpengalaman.
Tugas Anda: Menganalisis peran-peran pengguna (roles) dalam operasional aplikasi berdasarkan cerita alur proses bisnis nyata yang sudah dikonfirmasi.

DAFTAR PERAN YANG WAJIB DIANALISIS:
${rolesPromptList}

KONTEKS ALUR PROSES BISNIS:
- Kategori Bisnis: ${category}
- Cerita Proses Bisnis: "${story}"
- Alur Operasional Utama: "${mainFlow}"
${existingRoles.length > 0 ? `\nDAFTAR PERAN LAIN YANG SUDAH ADA DI SISTEM:\n${existingListStr}` : ''}

PRINSIP WAJIB & STRICT RULES:
1. GROUNDED KE ALUR CERITA BISNIS NYATA (BUKAN KEMIRIPAN STRING / NAMA KATA):
   Analisis fungsi peran WAJIB berdasarkan posisi, peran, dan aktivitas pihak tersebut dalam alur proses bisnis di atas.
   - DILARANG KERAS menyimpulkan fungsi peran hanya dari kemiripan nama kata atau stereotipe peran di industri lain!
   - Analisis fungsi peran secara ketat berdasarkan konteks narasi dan alur bisnis yang diberikan pengguna di atas.
   - Jika suatu peran bertindak sebagai penerima/penampung atau pemeriksa hasil kerja peran lain, posisikan perannya sesuai tanggung jawab penerimaan dan pengawasan tersebut.

2. ZERO TECH JARGON (BAHASA MANUSIAWI):
   Gunakan bahasa Indonesia yang santun, hangat, konkret, dan profesional.
   DILARANG KERAS menggunakan istilah teknis database/IT/coding (seperti: database, tabel, CRUD, query, skema, frontend, backend, endpoint).

3. SPESIFIKASI DESKRIPSI & TANGGUNG JAWAB TIAP PERAN:
   Untuk setiap peran:
   - "narasi": 1-2 kalimat konkret yang menjelaskan posisi dan fungsi peran dalam operasional bisnis tersebut.
   - "tanggungJawab": 2-3 butir tugas operasional konkret yang dijalankan peran tersebut sehari-hari.

4. PERAN EKSTERNAL / PENGGUNA LAYANAN (CUSTOMER / KLIEN):
   Jika peran adalah pihak luar yang dilayani (customer / counterparty / pengguna layanan), deskripsi dan butir tanggung jawabnya adalah tindakan pengguna layanan (misal: memesan layanan, mengajukan permohonan, membayar transaksi, atau menerima hasil layanan), BUKAN pekerjaan operasional staf internal.

5. PERAN SUPER ADMIN / OWNER (PENGATURAN USER/PENGGUNA WAJIB DI SEMUA DOMAIN):
   Jika peran adalah Super Admin atau Pemilik Usaha, butir tanggung jawab WAJIB SELALU secara eksplisit mencantumkan pengaturan pengguna/user (mendaftarkan akun pengguna, penugasan staf, dan penetapan hak akses aplikasi).

6. PERAN TATA KELOLA / GOVERNANCE (PENGURUS / DIREKSI / DEWAN PENGAWAS):
   Jika peran adalah Pengurus, Direksi, atau Dewan Pengawas, deskripsi dan tanggung jawab fokus pada penetapan kebijakan operasional bisnis, regulasi bunga/plafon/produk, persetujuan batas transaksi khusus, dan evaluasi periodik kinerja organisasi.

7. PENGECEKAN KEMIRIPAN (isSimilar, similarRoleName, similarityExplanation):
   ${existingRoles.length > 0 ? `Bandingkan peran baru dengan daftar peran yang sudah ada di atas:
   - Kemiripan HANYA bernilai true jika kedua peran berada di posisi SETARA dan melakukan PEKERJAAN OPERASIONAL YANG SAMA (contoh: "Kasir Pembayaran" vs "Kasir", "Juru Masak" vs "Koki").
   - HIERARKI / RANTAI PROSES DILARANG DIANGGAP MIRIP: Jika peran baru adalah penampung/penerima/pengawas dari peran lain (misal: pelaksana lapangan vs koordinator penampung), ini adalah BEDA LEVEL/FUNGSI, set isSimilar = false.
   - Jika peran baru berbeda jelas fungsinya: set isSimilar = false.` : 'Set isSimilar = false, similarRoleName = null, similarityExplanation = null.'}

Keluarkan HANYA format JSON valid tanpa markdown tambahan di luar JSON:
{
  "${normalizedRoles[0].name}": {
    "narasi": "...",
    "tanggungJawab": ["...", "..."],
    "isSimilar": false,
    "similarRoleName": null,
    "similarityExplanation": null
  }
}`;

  const userPrompt = `Analisis peran-peran berikut secara mendalam dan berikan deskripsi serta tanggung jawab operasional konkret sesuai konteks bisnis:\n${rolesPromptList}`;

  const raw = await invokeAIChat({
    systemInstruction,
    userPrompt,
    temperature: 0.2,
    maxTokens: 2500,
    provider,
    userApiKey,
    userModel
  });

  const resultMap: Record<string, RoleDetailOutput> = {};

  if (raw) {
    try {
      const cleaned = raw.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
      const parsed = JSON.parse(cleaned);
      if (parsed && typeof parsed === 'object') {
        for (const item of normalizedRoles) {
          const directMatch = parsed[item.name];
          const looseMatch = directMatch || Object.entries(parsed).find(
            ([k]) => k.toLowerCase().trim() === item.name.toLowerCase().trim()
          )?.[1];

          if (looseMatch && typeof looseMatch.narasi === 'string' && Array.isArray(looseMatch.tanggungJawab)) {
            const aiSimilar = Boolean(looseMatch.isSimilar && looseMatch.similarRoleName);
            const finalSimilar = (isHierarchicalRelation && item.name === normalizedRoles[0].name) ? false : aiSimilar;

            resultMap[item.name] = {
              narasi: String(looseMatch.narasi).trim(),
              tanggungJawab: looseMatch.tanggungJawab.map((t: any) => String(t).trim()).filter(Boolean).slice(0, 3),
              isSimilar: finalSimilar,
              similarRoleName: finalSimilar && looseMatch.similarRoleName ? String(looseMatch.similarRoleName).trim() : null,
              similarityExplanation: finalSimilar && looseMatch.similarityExplanation ? String(looseMatch.similarityExplanation).trim() : null
            };
          }
        }
      }
    } catch (e) {
      console.warn('[analyzeRolesWithAI] Failed to parse JSON, using fallback:', e);
    }
  }

  // Fallback untuk peran yang belum terisi di resultMap
  for (const item of normalizedRoles) {
    if (!resultMap[item.name]) {
      const fallback = getRoleNarrativeAndResponsibilities(item.name, category, session?.storyline);
      let fallbackNarasi = fallback.narasi;
      const fallbackTasks = [...fallback.tanggungJawab];

      if (item.note) {
        fallbackNarasi += ` (Fokus tugas: ${item.note})`;
        if (!fallbackTasks.some((t) => t.toLowerCase().includes(item.note!.toLowerCase()))) {
          fallbackTasks.unshift(`Menjalankan tugas: ${item.note}`);
        }
      }

      resultMap[item.name] = {
        narasi: fallbackNarasi,
        tanggungJawab: fallbackTasks.slice(0, 3),
        isSimilar: false,
        similarRoleName: null,
        similarityExplanation: null
      };
    }
  }

  return resultMap;
}

export interface AnalyzeCustomRoleInput {
  roleName: string;
  roleNote?: string;
  existingRoles: Array<{ id: string; label: string; description?: string; responsibilities?: string[] }>;
  session?: MockupSessionState;
  provider?: string;
  userApiKey?: string;
  userModel?: string;
}

export interface AnalyzeCustomRoleResult {
  isSimilar: boolean;
  similarRoleName: string | null;
  similarityExplanation: string | null;
  narasi: string;
  tanggungJawab: string[];
}

export async function analyzeCustomRoleWithAI(input: AnalyzeCustomRoleInput): Promise<AnalyzeCustomRoleResult> {
  const { roleName, roleNote, existingRoles, session, provider, userApiKey, userModel } = input;
  const resultMap = await analyzeRolesWithAI({
    rolesToAnalyze: [{ name: roleName, note: roleNote }],
    session,
    existingRoles,
    provider,
    userApiKey,
    userModel
  });

  const res = resultMap[roleName] || Object.values(resultMap)[0];
  if (res) {
    return {
      isSimilar: Boolean(res.isSimilar && res.similarRoleName),
      similarRoleName: res.similarRoleName || null,
      similarityExplanation: res.similarityExplanation || null,
      narasi: res.narasi,
      tanggungJawab: res.tanggungJawab
    };
  }

  const category = session?.match?.businessCategory || 'bisnis ini';
  const fallback = getRoleNarrativeAndResponsibilities(roleName, category, session?.storyline);
  return {
    isSimilar: false,
    similarRoleName: null,
    similarityExplanation: null,
    narasi: fallback.narasi,
    tanggungJawab: fallback.tanggungJawab
  };
}

export async function ensureRoleDetailsGroundedWithAI(
  session: MockupSessionState,
  provider?: string,
  userApiKey?: string,
  userModel?: string
): Promise<void> {
  if (!session.storyline?.asumsiAktor || session.storyline.asumsiAktor.length === 0) {
    return;
  }
  if (!session.storyline.detailAktor) {
    session.storyline.detailAktor = {};
  }

  const existingDetails = session.storyline.detailAktor;
  // Peran yang belum memiliki detail valid (narasi & tanggungJawab)
  const candidateRoles = session.storyline.asumsiAktor.filter((r) => {
    const clean = r.trim();
    if (isSuperAdminRole(clean)) return false; // Super admin sudah memiliki definisi baku yang stabil
    const found =
      existingDetails[clean] ||
      Object.entries(existingDetails).find(([k]) => k.toLowerCase() === clean.toLowerCase())?.[1];
    return !(found && found.narasi && found.tanggungJawab?.length > 0);
  });

  if (candidateRoles.length === 0) {
    return; // Semua peran sudah memiliki detail valid dari AI!
  }

  try {
    const analysisMap = await analyzeRolesWithAI({
      rolesToAnalyze: candidateRoles.map((name) => ({ name })),
      session,
      provider,
      userApiKey,
      userModel
    });

    for (const [rName, detail] of Object.entries(analysisMap)) {
      if (detail && detail.narasi && detail.tanggungJawab?.length > 0) {
        session.storyline.detailAktor[rName] = {
          narasi: detail.narasi,
          tanggungJawab: detail.tanggungJawab
        };
      }
    }
  } catch (err) {
    console.warn('[ensureRoleDetailsGroundedWithAI] Failed to batch-analyze roles with AI:', err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Anda harus login terlebih dahulu.' },
        { status: 401 }
      );
    }

    const forwardedFor = req.headers.get('x-forwarded-for');
    const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1';
    const rateLimit = await checkRateLimit(user.id || clientIp);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: `Batas kuota request tercapai. Coba lagi dalam ${rateLimit.resetInSeconds} detik.` },
        { status: 429 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as GuidedBody;
    const action: GuidedAction = (body.action || 'START').toUpperCase() as GuidedAction;
    const provider = body.provider;
    const userApiKey = body.apiKey;
    const userModel = body.model;

    if (action === 'ANALYZE_CUSTOM_ROLE') {
      const roleName = (body.roleName || '').trim();
      if (!roleName) {
        return NextResponse.json({ success: false, error: 'Nama peran wajib diisi.' }, { status: 400 });
      }

      const existingRoles = body.existingRoles || [];
      const roleNote = (body.roleNote || '').trim() || undefined;

      const analysis = await analyzeCustomRoleWithAI({
        roleName,
        roleNote,
        existingRoles,
        session: body.session,
        provider,
        userApiKey,
        userModel
      });

      return NextResponse.json({
        success: true,
        action,
        role: {
          name: roleName,
          description: analysis.narasi,
          responsibilities: analysis.tanggungJawab
        },
        similarity: {
          isSimilar: analysis.isSimilar,
          similarRoleName: analysis.similarRoleName,
          similarityExplanation: analysis.similarityExplanation
        }
      });
    }

    if (action === 'START') {
      const prompt = (body.prompt || '').trim();
      if (!prompt) {
        return NextResponse.json({ success: false, error: 'prompt wajib diisi untuk START.' }, { status: 400 });
      }

      // 1. Sintesis Storyline & Analisis Konseptual Arah Bisnis MURNI AI (POIN 2 & Instruksi Revisi)
      const storylineResult = await generateStorylineWithAI(
        prompt,
        provider,
        userApiKey,
        userModel
      );

      const analisis = storylineResult.analisisArah;

      // KONDISI 4: BUKAN_IDE_BISNIS — Input awal bukan ide bisnis atau aplikasi menurut evaluasi AI
      if (analisis && analisis.kondisi === 'BUKAN_IDE_BISNIS') {
        const pesanKlarifikasi =
          analisis.klarifikasiBukanIde?.pesanKlarifikasi ||
          'Halo! Sepertinya input tadi belum mendeskripsikan ide bisnis atau aplikasi. Boleh ceritakan lebih detail, aplikasi apa yang ingin kamu bangun?';

        const pendingSession: MockupSessionState = {
          step: 'STORYTELLING',
          match: {
            templateId: storylineResult.templateId || 'MT-20',
            overlayIds: storylineResult.overlayIds || [],
            patternIds: storylineResult.patternIds || [],
            tier: 'BASIC',
            businessCategory: '',
            contextualPainPoints: [],
            contextualRoles: []
          },
          storyline: {
            narasi: '',
            asumsiMasalah: '',
            asumsiAktor: [],
            asumsiAlurUtama: '',
            statusKonfirmasi: 'dikoreksi',
            revisiCount: 0,
            analisisArah: analisis,
            pendingNonBusinessClarification: {
              originalPrompt: prompt,
              pesanKlarifikasi
            }
          },
          roles: { selected: [] },
          flow: {},
          painPoints: { selected: [] },
          features: { selected: [] }
        };

        const clarificationCard = buildNonBusinessClarificationCard(pesanKlarifikasi);

        return NextResponse.json({
          success: true,
          action,
          session: pendingSession,
          guidedStep: clarificationCard,
          narration: pesanKlarifikasi,
          tier: { tier: 'BASIC', reasons: [] },
          template: null,
          overlays: [],
          semantic: null
        });
      }

      // KONDISI 3: AMBIGU — Permintaan terlalu singkat/umum menurut AI, tampilkan kartu klarifikasi sebelum narasi difinalkan
      if (analisis && analisis.kondisi === 'AMBIGU' && analisis.klarifikasiAmbigu) {
        const amb = analisis.klarifikasiAmbigu;
        const pendingSession: MockupSessionState = {
          step: 'STORYTELLING',
          match: {
            templateId: storylineResult.templateId || 'MT-20',
            overlayIds: storylineResult.overlayIds || [],
            patternIds: storylineResult.patternIds || [],
            tier: 'BASIC',
            businessCategory: storylineResult.businessCategory,
            contextualPainPoints: [storylineResult.asumsiMasalah],
            contextualRoles: storylineResult.asumsiAktor
          },
          storyline: {
            narasi: storylineResult.narasi,
            asumsiMasalah: storylineResult.asumsiMasalah,
            asumsiAktor: storylineResult.asumsiAktor,
            asumsiAlurUtama: storylineResult.asumsiAlurUtama,
            detailAktor: storylineResult.detailAktor,
            statusKonfirmasi: 'dikoreksi',
            revisiCount: 0,
            analisisArah: analisis,
            pendingDirectionClarification: {
              originalPrompt: prompt,
              pertanyaan: amb.pertanyaan,
              opsiA: amb.opsiA,
              opsiB: amb.opsiB,
              opsiBoth: amb.opsiBoth || 'Dua-duanya'
            }
          },
          roles: { selected: [] },
          flow: {},
          painPoints: { selected: [] },
          features: { selected: [] }
        };

        const clarificationCard = buildDirectionClarificationCard({
          pertanyaan: amb.pertanyaan,
          opsiA: amb.opsiA,
          opsiB: amb.opsiB,
          opsiBoth: amb.opsiBoth
        });

        const sapaanAmbigu = amb.sapaan && amb.sapaan.trim()
          ? amb.sapaan.trim()
          : 'Halo! Senang bisa mendiskusikan alur bisnismu.';

        const clarificationNarration =
          `${sapaanAmbigu}\n\n` +
          `Sebelum kita susun alur cerita proses bisnisnya, ada satu hal penting yang perlu dipastikan terlebih dahulu:\n\n` +
          `> ❓ **${amb.pertanyaan}**\n\n` +
          `Silakan pilih arah bisnis di kartu bawah agar alur yang saya siapkan langsung tepat sasaran.`;

        return NextResponse.json({
          success: true,
          action,
          session: pendingSession,
          guidedStep: clarificationCard,
          narration: clarificationNarration,
          tier: { tier: 'BASIC', reasons: [] },
          template: null,
          overlays: [],
          semantic: null
        });
      }

      // KONDISI 1 & 2: SATU_ARAH atau DUA_ARAH
      // 2. Pencarian semantik (Gemini embedding jika tersedia)
      const isGeminiKey = (userApiKey || '').trim().startsWith('AIza') || (provider === 'gemini' && !(userApiKey || '').trim().startsWith('sk-'));
      const geminiKey =
        isGeminiKey && userApiKey && userApiKey.trim()
          ? userApiKey.trim()
          : process.env.GEMINI_API_KEY || '';

      let semantic: SemanticMappingResult | null = null;
      if (geminiKey) {
        try {
          await ensureSemanticIndex(geminiKey);
          const semanticQuery = `${storylineResult.businessCategory} ${storylineResult.asumsiAlurUtama} ${prompt}`.trim();
          semantic = await resolveSemanticMapping(semanticQuery, geminiKey);
        } catch (err) {
          console.warn('Semantic mapping dilewati:', err);
        }
      }

      const templateId = storylineResult.templateId || 'MT-20';
      const overlayIds = storylineResult.overlayIds || [];
      const patternIds = storylineResult.patternIds || [];
      const tier = detectTier({ patternIds });

      const isDual = analisis?.kondisi === 'DUA_ARAH' && Boolean(analisis.duaArah);

      const session: MockupSessionState = {
        step: 'STORYTELLING',
        match: {
          templateId,
          overlayIds,
          patternIds,
          tier: tier.tier,
          businessCategory: storylineResult.businessCategory,
          contextualPainPoints: [storylineResult.asumsiMasalah],
          contextualRoles: storylineResult.asumsiAktor
        },
        storyline: {
          narasi: storylineResult.narasi,
          asumsiMasalah: storylineResult.asumsiMasalah,
          asumsiAktor: storylineResult.asumsiAktor,
          asumsiAlurUtama: storylineResult.asumsiAlurUtama,
          detailAktor: storylineResult.detailAktor,
          statusKonfirmasi: 'disetujui',
          revisiCount: 0,
          analisisArah: analisis
        },
        roles: { selected: [] },
        flow: {
          ...(isDual
            ? {
                dualFlowPreDecided: true,
                dualProcessNames: {
                  processA: analisis!.duaArah!.prosesA,
                  processB: analisis!.duaArah!.prosesB
                }
              }
            : {})
        },
        painPoints: { selected: [] },
        features: { selected: [] }
      };

      const guidedStep = buildGuidedStep(session);
      // Narasi chat awal: sanitasi sudut pandang pihak ketiga objektif dan biarkan AI bervariasi bebas
      let rawNarasi = (session.storyline?.narasi || storylineResult.narasi || '').trim();
      let sanitized = sanitizeStorylineNarrative(rawNarasi, session.storyline?.asumsiAktor || storylineResult.asumsiAktor);

      const narration = sanitized;
      if (session.storyline) {
        session.storyline.narasi = sanitized;
      }

      const matchedTemplate = getMasterTemplateById(templateId);

      return NextResponse.json({
        success: true,
        action,
        session,
        guidedStep,
        narration,
        tier: { tier: tier.tier, reasons: tier.reasons },
        template: matchedTemplate ? { id: matchedTemplate.id, nama: matchedTemplate.nama } : null,
        overlays: getIndustryOverlaysByIds(overlayIds).map((o) => ({ id: o.id, nama: o.nama })),
        semantic: semantic
          ? {
              used: semantic.confident,
              topScore: Number(semantic.topScore.toFixed(3)),
              candidates: semantic.candidates.slice(0, 5).map((c) => ({
                id: c.id,
                kind: c.kind,
                label: c.label,
                similarity: Number(c.similarity.toFixed(3))
              }))
            }
          : null
      });
    }

    if (action === 'RESUME') {
      let session = body.session as MockupSessionState | undefined;
      const targetStep = (body.targetStep || session?.step || 'STORYTELLING') as SessionStep;
      if (!session) {
        session = {
          step: targetStep,
          match: {
            templateId: 'MT-20',
            patternIds: [],
            businessCategory: 'Bisnis',
            contextualPainPoints: [],
            contextualRoles: []
          },
          roles: { selected: ['Super Admin'] },
          flow: { alurInti: [] },
          painPoints: { selected: [] },
          features: { selected: [] }
        } as unknown as MockupSessionState;
      } else {
        session = {
          ...session,
          step: targetStep
        };
      }

      const card = buildGuidedStep(session);
      let narration = `Melanjutkan proses perencanaan dari tahap **${targetStep}**:`;
      if (targetStep === 'STORYTELLING') {
        narration = session.storyline?.narasi || 'Berikut cerita proses bisnis awal aplikasi:';
      } else if (targetStep === 'ROLE') {
        const roleTable = renderRoleSummaryTable(session.roles, session.match?.businessCategory, session.storyline);
        narration = `Berikut ringkasan peran (roles) yang telah disusun:\n\n${roleTable}\n\nSilakan pilih "Sudah pas" untuk melanjutkan atau berikan koreksi untuk menyesuaikan wewenang peran.`;
      } else if (targetStep === 'ALUR') {
        const flowData = getDomainFlowDetails(session);
        const flowMd = renderFlowMarkdown(flowData);
        narration = `Berikut alur kerja operasional yang telah disusun:\n\n${flowMd}\n\nSilakan pilih "Sudah pas" untuk melanjutkan atau berikan koreksi untuk menyesuaikan alur.`;
      } else if (targetStep === 'RBAC') {
        const rbacMd =
          session.rbac?.markdownTable ||
          renderRbacMarkdownTable(
            session.roles?.selected || [],
            session.rbac?.modul || [],
            session.rbac?.catatanPelimpahan
          );
        narration = `Berikut matriks hak akses (RBAC) yang telah disusun:\n\n${rbacMd}\n\nSilakan pilih "Sudah pas" untuk melanjutkan atau berikan koreksi.`;
      } else if (targetStep === 'SKEMA_DATA') {
        const schemaMd =
          session.dataSchema?.markdownTable ||
          (session.dataSchema
            ? renderDataSchemaMarkdown(session.dataSchema.tabel, session.dataSchema.korelasiRingkas)
            : '');
        narration = `Berikut struktur skema tabel data:\n\n${schemaMd}\n\nSilakan periksa dan lanjutkan jika sudah sesuai.`;
      } else if (targetStep === 'SIMULASI_DB') {
        const simMd =
          session.simulasiDb?.markdownTable ||
          (session.simulasiDb ? renderSimulasiDbMarkdown(session.simulasiDb) : '');
        narration = `Berikut simulasi database dan akun demo:\n\n${simMd}\n\nSilakan periksa dan lanjutkan jika sudah sesuai.`;
      } else if (targetStep === 'REVIEW_FINAL') {
        narration = renderReviewFinalMarkdown(session);
      }

      return NextResponse.json({
        success: true,
        action: 'RESUME',
        session,
        guidedStep: card,
        narration
      });
    }

    if (action === 'NEXT') {
      const session = body.session;
      const stepId = body.stepId || (session?.step as GuidedStepId | undefined);
      if (!session || !stepId) {
        return NextResponse.json({ success: false, error: 'session dan stepId wajib untuk NEXT.' }, { status: 400 });
      }

      const selected = body.selected || [];

      // 1. Opsi Navigasi Mundur: "Ada yang terlewat di langkah sebelumnya" (Bagian B)
      if (selected.includes('back_to_previous')) {
        const backCard = buildBackNavigationStep(session.step);
        return NextResponse.json({
          success: true,
          action,
          session,
          guidedStep: backCard,
          narration: 'Kamu bisa kembali ke langkah sebelumnya yang sudah pernah dilewati untuk memeriksa atau melakukan perbaikan:'
        });
      }

      // 2. Pembatalan Navigasi Mundur: "Batal (Tetap di langkah saat ini)"
      if (selected.includes('cancel_back')) {
        const normalCard = buildGuidedStep(session);
        return NextResponse.json({
          success: true,
          action,
          session,
          guidedStep: normalCard,
          narration: 'Kembali ke peninjauan langkah saat ini.'
        });
      }

      // 3. User memilih langkah tujuan lompatan mundur (jump_step_*)
      const jumpSelection = selected.find((s: string) => s.startsWith('jump_step_'));
      if (jumpSelection) {
        const targetStep = jumpSelection.replace('jump_step_', '') as SessionStep;
        const jumpedSession: MockupSessionState = {
          ...session,
          step: targetStep
        };
        const targetCard = buildGuidedStep(jumpedSession);
        let narration = 'Silakan tinjau dan sesuaikan bagian ini:';

        if (targetStep === 'STORYTELLING') {
          narration = jumpedSession.storyline?.narasi || 'Berikut cerita proses bisnis awal aplikasi:';
        } else if (targetStep === 'ROLE') {
          const roleTable = renderRoleSummaryTable(
            jumpedSession.roles,
            jumpedSession.match?.businessCategory,
            jumpedSession.storyline
          );
          narration = `Berikut ringkasan peran (roles) yang telah disusun sebelumnya:\n\n${roleTable}\n\nSilakan pilih "Sudah pas" untuk melanjutkan atau berikan koreksi untuk menyesuaikan wewenang peran.`;
        } else if (targetStep === 'ALUR') {
          const flowData = getDomainFlowDetails(jumpedSession);
          const flowMd = renderFlowMarkdown(flowData);
          narration = `Berikut alur kerja operasional yang telah disusun sebelumnya:\n\n${flowMd}\n\nSilakan pilih "Sudah pas" untuk melanjutkan atau berikan koreksi untuk menyesuaikan alur.`;
        } else if (targetStep === 'RBAC') {
          const rbacMd =
            jumpedSession.rbac?.markdownTable ||
            renderRbacMarkdownTable(
              jumpedSession.roles?.selected || [],
              jumpedSession.rbac?.modul || [],
              jumpedSession.rbac?.catatanPelimpahan
            );
          narration = `Berikut matriks hak akses (RBAC) sebelumnya:\n\n${rbacMd}\n\nSilakan pilih "Sudah pas" untuk melanjutkan atau berikan koreksi untuk menyesuaikan hak akses.`;
        } else if (targetStep === 'SKEMA_DATA') {
          const schemaMd =
            jumpedSession.dataSchema?.markdownTable ||
            (jumpedSession.dataSchema
              ? renderDataSchemaMarkdown(jumpedSession.dataSchema.tabel, jumpedSession.dataSchema.korelasiRingkas)
              : '');
          narration = `Berikut skema basis data sebelumnya:\n\n${schemaMd}\n\nSilakan pilih "Sudah pas" untuk melanjutkan atau berikan koreksi untuk menyesuaikan struktur tabel.`;
        } else if (targetStep === 'SIMULASI_DB') {
          const simMd =
            jumpedSession.simulasiDb?.markdownTable ||
            (jumpedSession.simulasiDb ? renderSimulasiDbMarkdown(jumpedSession.simulasiDb) : '');
          narration = `Berikut simulasi database & akun demo login sebelumnya:\n\n${simMd}\n\nSilakan pilih "Sudah pas" untuk melanjutkan atau berikan koreksi untuk menyesuaikan data contoh.`;
        }

        return NextResponse.json({
          success: true,
          action,
          session: jumpedSession,
          guidedStep: targetCard,
          narration
        });
      }

      // Khusus step STORYTELLING: proses klarifikasi arah bisnis, konfirmasi, koreksi kecil, atau meleset jauh (POIN 2)
      if (stepId === 'STORYTELLING') {
        const selected = body.selected || [];
        const other = (body.other || '').trim();

        // Sub-handler: Jawaban klarifikasi jika input sebelumnya dinilai BUKAN ide bisnis
        if (session.storyline?.pendingNonBusinessClarification || selected.includes('clarify_business_input')) {
          const newPrompt = (other || '').trim();
          if (!newPrompt) {
            const card = buildNonBusinessClarificationCard(session.storyline?.pendingNonBusinessClarification?.pesanKlarifikasi);
            return NextResponse.json({
              success: true,
              action,
              session,
              guidedStep: card,
              narration: 'Silakan ketikkan deskripsi ide bisnismu di kolom input di bawah agar kita bisa mulai menyusun alur aplikasinya.'
            });
          }

          // Generate ulang storyline dengan prompt baru yang diberikan user
          const storylineResult = await generateStorylineWithAI(
            newPrompt,
            provider,
            userApiKey,
            userModel
          );

          const analisis = storylineResult.analisisArah;

          // Jika masih dinilai BUKAN_IDE_BISNIS
          if (analisis && analisis.kondisi === 'BUKAN_IDE_BISNIS') {
            const pesan =
              analisis.klarifikasiBukanIde?.pesanKlarifikasi ||
              'Input tersebut tampaknya masih belum menjelaskan ide aplikasi atau bisnis. Boleh ceritakan usaha apa yang ingin kamu buatkan sistemnya?';
            const updatedPending: MockupSessionState = {
              ...session,
              storyline: {
                ...session.storyline,
                narasi: '',
                asumsiMasalah: '',
                asumsiAktor: [],
                asumsiAlurUtama: '',
                statusKonfirmasi: 'dikoreksi',
                analisisArah: analisis,
                pendingNonBusinessClarification: {
                  originalPrompt: newPrompt,
                  pesanKlarifikasi: pesan
                }
              }
            };
            return NextResponse.json({
              success: true,
              action,
              session: updatedPending,
              guidedStep: buildNonBusinessClarificationCard(pesan),
              narration: pesan,
              tier: { tier: 'BASIC', reasons: [] },
              template: null,
              overlays: [],
              semantic: null
            });
          }

          // Jika AMBIGU
          if (analisis && analisis.kondisi === 'AMBIGU' && analisis.klarifikasiAmbigu) {
            const amb = analisis.klarifikasiAmbigu;
            const updatedPending: MockupSessionState = {
              ...session,
              storyline: {
                narasi: storylineResult.narasi,
                asumsiMasalah: storylineResult.asumsiMasalah,
                asumsiAktor: storylineResult.asumsiAktor,
                asumsiAlurUtama: storylineResult.asumsiAlurUtama,
                detailAktor: storylineResult.detailAktor,
                statusKonfirmasi: 'dikoreksi',
                revisiCount: 0,
                analisisArah: analisis,
                pendingDirectionClarification: {
                  originalPrompt: newPrompt,
                  pertanyaan: amb.pertanyaan,
                  opsiA: amb.opsiA,
                  opsiB: amb.opsiB,
                  opsiBoth: amb.opsiBoth || 'Dua-duanya'
                },
                pendingNonBusinessClarification: undefined
              }
            };

            const clarificationCard = buildDirectionClarificationCard({
              pertanyaan: amb.pertanyaan,
              opsiA: amb.opsiA,
              opsiB: amb.opsiB,
              opsiBoth: amb.opsiBoth
            });

            const sapaanAmbigu = amb.sapaan && amb.sapaan.trim()
              ? amb.sapaan.trim()
              : 'Halo! Senang bisa mendiskusikan alur bisnismu.';

            const clarificationNarration =
              `${sapaanAmbigu}\n\n` +
              `Sebelum kita susun alur cerita proses bisnisnya, ada satu hal penting yang perlu dipastikan terlebih dahulu:\n\n` +
              `> ❓ **${amb.pertanyaan}**\n\n` +
              `Silakan pilih arah bisnis di kartu bawah agar alur yang saya siapkan langsung tepat sasaran.`;

            return NextResponse.json({
              success: true,
              action,
              session: updatedPending,
              guidedStep: clarificationCard,
              narration: clarificationNarration,
              tier: { tier: 'BASIC', reasons: [] },
              template: null,
              overlays: [],
              semantic: null
            });
          }

          // Normal (SATU_ARAH atau DUA_ARAH): Lanjutkan seperti biasa
          const isDual = analisis?.kondisi === 'DUA_ARAH' && Boolean(analisis.duaArah);
          const templateId = storylineResult.templateId || 'MT-20';
          const overlayIds = storylineResult.overlayIds || [];
          const patternIds = storylineResult.patternIds || [];
          const tier = detectTier({ patternIds });

          const updatedSession: MockupSessionState = {
            ...session,
            match: {
              templateId,
              overlayIds,
              patternIds,
              tier: tier.tier,
              businessCategory: storylineResult.businessCategory,
              contextualPainPoints: [storylineResult.asumsiMasalah],
              contextualRoles: storylineResult.asumsiAktor
            },
            storyline: {
              narasi: storylineResult.narasi,
              asumsiMasalah: storylineResult.asumsiMasalah,
              asumsiAktor: storylineResult.asumsiAktor,
              asumsiAlurUtama: storylineResult.asumsiAlurUtama,
              detailAktor: storylineResult.detailAktor,
              statusKonfirmasi: 'disetujui',
              revisiCount: 0,
              analisisArah: analisis,
              pendingNonBusinessClarification: undefined
            },
            flow: {
              ...(isDual
                ? {
                    dualFlowPreDecided: true,
                    dualProcessNames: {
                      processA: analisis!.duaArah!.prosesA,
                      processB: analisis!.duaArah!.prosesB
                    }
                  }
                : {})
            }
          };

          const guidedStep = buildGuidedStep(updatedSession);
          let rawNarasi = (updatedSession.storyline?.narasi || storylineResult.narasi || '').trim();
          let sanitized = sanitizeStorylineNarrative(rawNarasi, updatedSession.storyline?.asumsiAktor || storylineResult.asumsiAktor);
          const matchedTemplate = getMasterTemplateById(templateId);

          return NextResponse.json({
            success: true,
            action,
            session: updatedSession,
            guidedStep,
            narration: sanitized,
            tier: { tier: tier.tier, reasons: tier.reasons },
            template: matchedTemplate ? { id: matchedTemplate.id, nama: matchedTemplate.nama } : null,
            overlays: getIndustryOverlaysByIds(overlayIds).map((o) => ({ id: o.id, nama: o.nama })),
            semantic: null
          });
        }

        // Sub-handler: Jawaban klarifikasi arah bisnis sebelum narasi dibuat
        if (session.storyline?.pendingDirectionClarification) {
          const { originalPrompt, opsiA, opsiB, nameA, nameB } = session.storyline.pendingDirectionClarification;
          const choice = selected[0] || (other ? 'dir_custom' : 'dir_both');

          let enrichedPrompt = originalPrompt;
          let isBoth = choice === 'dir_both';

          const labelA = nameA || opsiA || 'Arah Bisnis A';
          const labelB = nameB || opsiB || 'Arah Bisnis B';

          if (other) {
            const isCustomBoth = /kedua|dua|seimbang|ganda|jual\s+beli|beli\s+jual|dua-duanya/i.test(other);
            isBoth = isCustomBoth;
            enrichedPrompt = `${originalPrompt}. PANDUAN PENTING ARAH BISNIS: Pengguna memberikan arahan bisnis spesifik: "${other}". Susun alur cerita proses bisnis lengkap yang fokus penuh pada arahan tersebut secara utuh 3 fase dari hulu ke hilir. JANGAN membuat alur yang bertentangan dengan arahan pengguna ini.`;
          } else if (choice === 'dir_A_only') {
            enrichedPrompt = `${originalPrompt}. PANDUAN PENTING: Pengguna memilih fokus HANYA pada "${labelA}". JANGAN buat alur untuk "${labelB}". Susun cerita proses bisnis murni satu arah untuk ${labelA}.`;
          } else if (choice === 'dir_B_only') {
            enrichedPrompt = `${originalPrompt}. PANDUAN PENTING: Pengguna memilih fokus HANYA pada "${labelB}". JANGAN buat alur untuk "${labelA}". Susun cerita proses bisnis murni satu arah untuk ${labelB}.`;
          } else {
            isBoth = true;
            enrichedPrompt = `${originalPrompt}. PANDUAN PENTING: Pengguna memilih melayani DUA ARAH BISNIS SEKALIGUS: "${labelA}" DAN "${labelB}". Keduanya sama-sama rutin dan setara. Cerita proses bisnis WAJIB menyebutkan kedua aktivitas ini secara seimbang.`;
          }

          // 1. Generate narasi AI dengan prompt yang diperkaya
          const storylineResult = await generateStorylineWithAI(
            enrichedPrompt,
            provider,
            userApiKey,
            userModel
          );

          // 2. Pencarian semantik jika tersedia
          const isGeminiKey = (userApiKey || '').trim().startsWith('AIza') || (provider === 'gemini' && !(userApiKey || '').trim().startsWith('sk-'));
          const geminiKey =
            isGeminiKey && userApiKey && userApiKey.trim()
              ? userApiKey.trim()
              : process.env.GEMINI_API_KEY || '';

          let semantic: SemanticMappingResult | null = null;
          if (geminiKey) {
            try {
              await ensureSemanticIndex(geminiKey);
              const semanticQuery = `${storylineResult.businessCategory} ${storylineResult.asumsiAlurUtama} ${enrichedPrompt}`.trim();
              semantic = await resolveSemanticMapping(semanticQuery, geminiKey);
            } catch (err) {
              console.warn('Semantic mapping dilewati:', err);
            }
          }

          const templateId = storylineResult.templateId || 'MT-20';
          const overlayIds = storylineResult.overlayIds || [];
          const patternIds = storylineResult.patternIds || [];
          const tier = detectTier({ patternIds });

          const updatedStorylineSession: MockupSessionState = {
            ...session,
            step: 'STORYTELLING',
            match: {
              ...session.match,
              templateId,
              overlayIds,
              patternIds,
              tier: tier.tier,
              businessCategory: storylineResult.businessCategory,
              contextualPainPoints: [storylineResult.asumsiMasalah],
              contextualRoles: storylineResult.asumsiAktor
            },
            storyline: {
              narasi: storylineResult.narasi,
              asumsiMasalah: storylineResult.asumsiMasalah,
              asumsiAktor: storylineResult.asumsiAktor,
              asumsiAlurUtama: storylineResult.asumsiAlurUtama,
              detailAktor: storylineResult.detailAktor,
              statusKonfirmasi: 'disetujui',
              revisiCount: 0,
              analisisArah: storylineResult.analisisArah
              // pendingDirectionClarification dibersihkan
            },
            flow: {
              ...session.flow,
              // Jika pilih "Dua-duanya", tandai dualFlowPreDecided = true
              ...(isBoth
                ? {
                    dualFlowPreDecided: true,
                    dualProcessNames: {
                      processA: storylineResult.analisisArah?.duaArah?.prosesA || labelA,
                      processB: storylineResult.analisisArah?.duaArah?.prosesB || labelB
                    }
                  }
                : {})
            }
          };

          const guidedStep = buildGuidedStep(updatedStorylineSession);
          const narration = updatedStorylineSession.storyline?.narasi || storylineResult.narasi;
          const matchedTemplate = getMasterTemplateById(templateId);

          return NextResponse.json({
            success: true,
            action,
            session: updatedStorylineSession,
            guidedStep,
            narration,
            tier: { tier: tier.tier, reasons: tier.reasons },
            template: matchedTemplate ? { id: matchedTemplate.id, nama: matchedTemplate.nama } : null,
            overlays: getIndustryOverlaysByIds(overlayIds).map((o) => ({ id: o.id, nama: o.nama })),
            semantic: semantic
              ? {
                  used: semantic.confident,
                  topScore: Number(semantic.topScore.toFixed(3)),
                  candidates: semantic.candidates.slice(0, 5).map((c) => ({
                    id: c.id,
                    kind: c.kind,
                    label: c.label,
                    similarity: Number(c.similarity.toFixed(3))
                  }))
                }
              : null
          });
        }

        // Sub-handler: Jawaban klarifikasi peran pelaku (Pengguna Sistem vs Entitas Data)
        if (session.storyline?.pendingActorClarification) {
          const updated = applyGuidedAnswer(session, 'STORYTELLING', selected, other);
          if (updated.step === 'STORYTELLING' && updated.storyline?.pendingActorClarification) {
            const guidedStep = buildGuidedStep(updated);
            const pend = updated.storyline.pendingActorClarification;
            const curActor = pend.actors[pend.currentIndex || 0];
            const narration =
              `Sip, klarifikasi tersimpan!\n\n` +
              `Berikutnya untuk **${curActor?.actor}**: apakah membuka aplikasi sendiri atau dicatat staf?`;
            return NextResponse.json({
              success: true,
              action,
              session: updated,
              guidedStep,
              narration
            });
          }

          // Semua aktor selesai diklarifikasi -> lanjut ke ROLE
          await ensureRoleDetailsGroundedWithAI(updated, provider, userApiKey, userModel);
          const guidedStep = buildGuidedStep(updated);
          const narration =
            'Owner di sini berperan sebagai Super Admin — pemegang akses tertinggi di aplikasi.\n\nMantap! Klasifikasi pihak terlibat sudah beres. Sekarang, yuk kita tentukan siapa saja peran yang akan memakai aplikasi ini:';
          return NextResponse.json({
            success: true,
            action,
            session: updated,
            guidedStep,
            narration
          });
        }

        const existingStory = session.storyline || {
          narasi: '',
          asumsiMasalah: '',
          asumsiAktor: session.match.contextualRoles || ['Super Admin', 'Staf', 'Pelanggan'],
          asumsiAlurUtama: '',
          statusKonfirmasi: 'disetujui',
          revisiCount: 0
        };

        const feedbackText = (other || '').trim();
        const hasSpecificDetails =
          feedbackText.length >= 25 ||
          /\b(bayar|pembayaran|tunai|transfer|harga|timbang|timbangan|berat|nominal|nota|struk|kwitansi|warga|pelanggan|gudang|pengepul|pengumpul|sopir|kurir|kasir|staf|admin|jemput|setor|pilah|sortir|kirim|jadwal|waktu|langsung|di tempat|lokasi|alur|tahap|langkah)\b/i.test(
            feedbackText
          );

        const isExplicitMismatchWithoutDetails =
          selected.includes('mismatch_story') && !hasSpecificDetails;
        const isTextMismatchWithoutDetails =
          Boolean(feedbackText) &&
          !hasSpecificDetails &&
          /^(meleset\s*jauh|salah\s*(semua|total)|bukan\s*begitu|keliru\s*total|bukan\s*ini)$/i.test(feedbackText);

        const isMismatch = isExplicitMismatchWithoutDetails || isTextMismatchWithoutDetails;

        const isConfirm =
          selected.includes('confirm_story') ||
          (!feedbackText && selected.length === 0 && !selected.includes('minor_adjust') && !isMismatch) ||
          (Boolean(feedbackText) &&
            !selected.includes('minor_adjust') &&
            !isMismatch &&
            !hasSpecificDetails &&
            isPureConfirmationText(feedbackText));

        const isMinorAdjust =
          selected.includes('minor_adjust') ||
          hasSpecificDetails ||
          (Boolean(feedbackText) && !isConfirm && !isMismatch);

        const currentRevisi = existingStory.revisiCount || 0;
        const prevRiwayat = existingStory.riwayatKoreksi || [];
        const newRiwayat = feedbackText ? [...prevRiwayat, feedbackText] : prevRiwayat;

        // 1. Mismatch Jauh ("Meleset jauh dari proses bisnis saya") HANYA jika benar-benar tanpa detail konkret
        if (isMismatch) {
          // Masuk ke pertanyaan bertahap satu per satu
          const nextRevisi = currentRevisi + 1;
          const updated: MockupSessionState = {
            ...session,
            step: 'STORYTELLING',
            storyline: {
              ...existingStory,
              statusKonfirmasi: 'dikoreksi',
              modeKlarifikasiBertahap: true,
              revisiCount: nextRevisi,
              riwayatKoreksi: newRiwayat
            }
          };
          const questionNarration =
            nextRevisi === 1
              ? 'Siap, tidak apa-apa! Supaya ceritanya lebih tepat sasaran: boleh ceritakan apa masalah operasional paling mendesak yang ingin kamu bereskan lebih dulu?'
              : 'Paham. Lalu siapa saja orang atau pihak yang terlibat langsung dalam aktivitas tersebut sehari-hari?';

          const guidedStep = buildGuidedStep(updated);
          return NextResponse.json({
            success: true,
            action,
            session: updated,
            guidedStep,
            narration: questionNarration
          });
        }

        // 2. Jika sebelumnya dalam mode klarifikasi bertahap (mismatch) dan user memberikan jawaban
        if (existingStory.modeKlarifikasiBertahap && !isConfirm) {
          const feedback = feedbackText || selected.join(', ');
          const refined = await refineStorylineWithAI(
            { ...existingStory, riwayatKoreksi: newRiwayat },
            feedback,
            true,
            provider,
            userApiKey,
            userModel
          );
          let newNarasi = refined.narasi.trim();
          const prevGreetingMatchA = existingStory.narasi.match(/^Berikut adalah flow proses bisnis dari [^.]+?\./i);
          const standardGreetingA = prevGreetingMatchA
            ? prevGreetingMatchA[0]
            : buildStandardGreeting(session.match?.businessCategory || 'bisnis ini');
          newNarasi = ensureStandardGreetingInNarasi(newNarasi, standardGreetingA);

          if (!newNarasi.toLowerCase().includes('apakah ini sudah menggambarkan proses bisnismu')) {
            newNarasi = `${newNarasi} ${CONFIRMATION_CLOSING}`.trim();
          }

          const updated: MockupSessionState = {
            ...session,
            step: 'STORYTELLING',
            match: {
              ...session.match,
              contextualRoles: refined.asumsiAktor
            },
            storyline: {
              ...existingStory,
              ...refined,
              narasi: newNarasi,
              statusKonfirmasi: 'dikoreksi',
              modeKlarifikasiBertahap: false,
              revisiCount: currentRevisi + 1,
              riwayatKoreksi: newRiwayat
            }
          };
          const guidedStep = buildGuidedStep(updated);
          const narration = `Sip, cerita proses bisnis sudah saya rangkai ulang berdasarkan penjelasanmu:\n\n${newNarasi}`;
          return NextResponse.json({
            success: true,
            action,
            session: updated,
            guidedStep,
            narration
          });
        }

        // 3. Ada koreksi / catatan alur ("minor_adjust" atau koreksi spesifik): perbarui narasi & TAMPILKAN ULANG di STORYTELLING
        if (isMinorAdjust) {
          const nextRevisi = currentRevisi + 1;
          const feedback = feedbackText || selected.join(', ');
          const refined = await refineStorylineWithAI(
            { ...existingStory, riwayatKoreksi: newRiwayat },
            feedback,
            false,
            provider,
            userApiKey,
            userModel
          );
          let newNarasi = refined.narasi.trim();
          const prevGreetingMatchB = existingStory.narasi.match(/^Berikut adalah flow proses bisnis dari [^.]+?\./i);
          const standardGreetingB = prevGreetingMatchB
            ? prevGreetingMatchB[0]
            : buildStandardGreeting(session.match?.businessCategory || 'bisnis ini');
          newNarasi = ensureStandardGreetingInNarasi(newNarasi, standardGreetingB);

          if (!newNarasi.toLowerCase().includes('apakah ini sudah menggambarkan proses bisnismu')) {
            newNarasi = `${newNarasi} ${CONFIRMATION_CLOSING}`.trim();
          }

          const updated: MockupSessionState = {
            ...session,
            step: 'STORYTELLING',
            match: {
              ...session.match,
              contextualRoles: refined.asumsiAktor
            },
            storyline: {
              ...existingStory,
              ...refined,
              narasi: newNarasi,
              statusKonfirmasi: 'dikoreksi',
              modeKlarifikasiBertahap: false,
              revisiCount: nextRevisi,
              riwayatKoreksi: newRiwayat
            }
          };
          const guidedStep = buildGuidedStep(updated);
          const narration = `Sip, catatanmu sudah saya sesuaikan ke alur cerita!\n\n${newNarasi}`;
          return NextResponse.json({
            success: true,
            action,
            session: updated,
            guidedStep,
            narration
          });
        }

        // 4. Konfirmasi langsung ("Sudah sesuai, lanjut ke Role") -> evaluasi sub-step klarifikasi peran pelaku
        let updated = applyGuidedAnswer(session, 'STORYTELLING', body.selected || [], body.other);

        // LAPIS 2: Penilaian Semantik Berbasis AI untuk mengevaluasi peran pelaku non-owner
        if (updated.storyline?.asumsiAktor && updated.storyline.asumsiAktor.length > 0) {
          const aiClassifications = await analyzeActorClassificationWithAI(
            updated,
            provider,
            userApiKey,
            userModel
          );
          updated.actorsClassification = aiClassifications.classifications;

          if (aiClassifications.hasCandidateEntity) {
            updated.step = 'STORYTELLING';
            updated.storyline = {
              ...updated.storyline,
              statusKonfirmasi: 'disetujui',
              pendingActorClarification: {
                actors: aiClassifications.classifications.filter((c) => c.category === 'ENTITAS_DATA'),
                ownerActor:
                  aiClassifications.classifications.find((c) => isSuperAdminRole(c.actor))?.actor ||
                  REQUIRED_ROLE,
                currentIndex: 0
              }
            };
          } else {
            delete updated.storyline.pendingActorClarification;
            updated.step = 'ROLE';
          }
        }

        if (updated.step === 'STORYTELLING' && updated.storyline?.pendingActorClarification) {
          const guidedStep = buildGuidedStep(updated);
          const pend = updated.storyline.pendingActorClarification;
          const curActor = pend.actors[pend.currentIndex || 0];
          const narration =
            `Alur cerita proses bisnis sudah disetujui!\n\n` +
            `Sebelum kita memilih peran sistem, mari pastikan dulu klasifikasi pihak yang terlibat:\n` +
            `Apakah **${curActor?.actor}** akan membuka aplikasi sendiri dengan akun login mandiri, atau sekadar data yang dicatat oleh staf?`;
          return NextResponse.json({
            success: true,
            action,
            session: updated,
            guidedStep,
            narration
          });
        }

        await ensureRoleDetailsGroundedWithAI(updated, provider, userApiKey, userModel);
        const guidedStep = buildGuidedStep(updated);
        const narration =
          'Owner di sini berperan sebagai Super Admin — pemegang akses tertinggi di aplikasi.\n\nMantap! Senang alurnya sudah pas dengan bayanganmu. Sekarang, yuk kita tentukan siapa saja peran yang akan memakai aplikasi ini:';
        return NextResponse.json({
          success: true,
          action,
          session: updated,
          guidedStep,
          narration
        });
      }

      // Khusus step ROLE: tangani penghapusan role tambahan, pelimpahan tugas, dan tabel ringkasan final (POIN 3)
      if (stepId === 'ROLE') {
        // 1. Integrasikan peran custom yang ditambahkan pengguna
        if (body.customRoles && Array.isArray(body.customRoles) && body.customRoles.length > 0) {
          if (!session.storyline) {
            session.storyline = {
              narasi: '',
              asumsiMasalah: '',
              asumsiAktor: [],
              asumsiAlurUtama: '',
              statusKonfirmasi: 'disetujui',
              revisiCount: 0
            };
          }
          if (!session.storyline.detailAktor) {
            session.storyline.detailAktor = {};
          }
          for (const cr of body.customRoles) {
            const cleanName = cr.label?.trim() || cr.id?.trim();
            if (!cleanName) continue;
            session.storyline.detailAktor[cleanName] = {
              narasi: cr.description || '',
              tanggungJawab: cr.responsibilities || []
            };
            if (!session.storyline.asumsiAktor.includes(cleanName)) {
              session.storyline.asumsiAktor.push(cleanName);
            }
            if (!session.match.contextualRoles?.includes(cleanName)) {
              session.match.contextualRoles = [...(session.match.contextualRoles || []), cleanName];
            }
          }
        }

        // 2. Integrasikan perubahan deskripsi / tanggung jawab peran yang disunting pengguna
        if (body.editedRoles && typeof body.editedRoles === 'object') {
          if (!session.storyline) {
            session.storyline = {
              narasi: '',
              asumsiMasalah: '',
              asumsiAktor: [],
              asumsiAlurUtama: '',
              statusKonfirmasi: 'disetujui',
              revisiCount: 0
            };
          }
          if (!session.storyline.detailAktor) {
            session.storyline.detailAktor = {};
          }
          for (const [rName, edited] of Object.entries(body.editedRoles)) {
            session.storyline.detailAktor[rName] = {
              narasi: edited.description,
              tanggungJawab: edited.responsibilities
            };
          }
        }

        const otherText = (body.other || '').trim();

        // Cek jika pengguna meminta pengalihan tugas spesifik: "limpahkan tugas X ke Y"
        const delegationMatch = otherText.match(/limpahkan\s+(?:tugas\s+)?(.+?)\s+ke\s+(.+)/i);
        if (delegationMatch && session.roles?.tugasDilimpahkan && session.roles.tugasDilimpahkan.length > 0) {
          const fromPart = delegationMatch[1].trim().toLowerCase();
          const toPart = delegationMatch[2].trim();
          const targetDelegation = session.roles.tugasDilimpahkan.find(
            (d) => d.dariRole.toLowerCase().includes(fromPart) || fromPart.includes(d.dariRole.toLowerCase())
          );
          if (targetDelegation) {
            targetDelegation.keRole = toPart;
            const table = renderRoleSummaryTable(session.roles, session.match.businessCategory, session.storyline);
            const narration = `Siap, tugas dari role **${targetDelegation.dariRole}** sekarang resmi dilimpahkan ke **${toPart}**!\n\n${table}\n\nSekarang, yuk kita lanjut ke alur kerja utama aplikasi:`;
            const guidedStep = buildGuidedStep(session);
            return NextResponse.json({
              success: true,
              action,
              session,
              guidedStep,
              narration
            });
          }
        }

        let updated = applyGuidedAnswer(session, 'ROLE', body.selected || [], body.other);

        // Recompute tier setelah peran dipilih
        const tier = detectTier({
          patternIds: updated.match.patternIds,
          roleCount: updated.roles.selected.length,
          selectedFeatureIds: updated.features?.selected?.map((f) => f.id) || []
        });
        updated = { ...updated, match: { ...updated.match, tier: tier.tier } };

        // Kalimat konfirmasi eksplisit jika ada role yang dihapus / dideselect
        const removalMessages: string[] = [];
        if (updated.roles.removedExternalRoles && updated.roles.removedExternalRoles.length > 0) {
          for (const extRole of updated.roles.removedExternalRoles) {
            if (isNavigationActionId(extRole)) continue;
            removalMessages.push(
              `Oke, role ${extRole} tidak dipakai sebagai akun terpisah — berarti aplikasi tidak perlu login khusus untuk ${extRole.toLowerCase()}. Interaksi dengan ${extRole.toLowerCase()} tetap berjalan lewat staf yang sudah tercatat di alur kerja.`
            );
          }
        }
        if (updated.roles.tugasDilimpahkan && updated.roles.tugasDilimpahkan.length > 0) {
          for (const d of updated.roles.tugasDilimpahkan) {
            if (isNavigationActionId(d.dariRole) || isNavigationActionId(d.keRole)) continue;
            removalMessages.push(
              `Oke, role ${d.dariRole} dihapus. Berarti tugas (${d.daftarTugas.join(', ')}) otomatis jadi tanggung jawab Owner ya — kalau mau dilimpahkan ke role lain, tinggal bilang saja.`
            );
          }
        }

        // Satu Pemanggilan AI Terpadu untuk Alur Pendukung & Fitur Pendukung (Opsi 1)
        // Terpicu setiap transisi ROLE -> ALUR dan setiap regenerasi peran
        const supportingData = await generateSupportingFlowsAndFeaturesWithAI(
          updated,
          provider,
          userApiKey,
          userModel
        );

        // Periksa apakah domain ini adalah alur dua arah / kasus ganda aktif
        const isDualFlowActive =
          Boolean(updated.flow?.dualFlowPreDecided) ||
          Boolean(session.flow?.kasusGanda && session.flow.kasusGanda.length > 0) ||
          Boolean(session.flow?.dualProcessNames?.processA && session.flow?.dualProcessNames?.processB);

        if (isDualFlowActive) {
          const processA =
            updated.flow?.dualProcessNames?.processA ||
            session.flow?.dualProcessNames?.processA ||
            session.storyline?.analisisArah?.duaArah?.prosesA ||
            'Penjualan ke Pelanggan';
          const processB =
            updated.flow?.dualProcessNames?.processB ||
            session.flow?.dualProcessNames?.processB ||
            session.storyline?.analisisArah?.duaArah?.prosesB ||
            'Pembelian dari Pelanggan';

          // Bangun ulang Kasus Ganda secara MENYELURUH dari roles terbaru
          const kasusGanda = buildKasusGandaFromSession(updated, processA, processB);
          const flowDataFresh = getDomainFlowDetails(updated, {
            forceFresh: true,
            supportingFlows: supportingData.alurPendukung,
            supportingFeatures: supportingData.fiturPendukung
          });

          const updatedWithKasus: MockupSessionState = {
            ...updated,
            step: 'ALUR',
            flow: {
              ...updated.flow,
              kasusGanda,
              alurInti: [],
              dualFlowPending: false,
              dualProcessNames: { processA, processB }
            }
          };

          const flowDataForReconcile: DomainFlowData = {
            ...flowDataFresh,
            kasusGanda
          };
          const { updatedSession: reconSession, reconciled: reconPre, message: reconMsgPre } =
            reconcileCoreOperationalRole(updatedWithKasus, flowDataForReconcile);

          const finalSession: MockupSessionState = {
            ...reconSession,
            flow: {
              ...reconSession.flow,
              alurPendukung: flowDataFresh.alurPendukung.map((ap) => ({ nama: ap.nama, steps: ap.steps })),
              fiturPendukung: flowDataFresh.fiturPendukung.map((fp) => fp.label)
            }
          };

          const dualFlowData: DomainFlowData = {
            ...flowDataFresh,
            kasusGanda
          };
          const flowMarkdownDual = renderFlowMarkdown(dualFlowData);
          const guidedStepDual = buildGuidedStep(finalSession);

          const summaryTableDual = renderRoleSummaryTable(
            finalSession.roles,
            finalSession.match.businessCategory,
            finalSession.storyline
          );

          const changeNoteDual = generateChangeNote('ALUR', finalSession);
          let dualNarration = '';
          if (changeNoteDual) {
            dualNarration += `${changeNoteDual}\n\n`;
          }
          if (removalMessages.length > 0) {
            dualNarration += removalMessages.join('\n\n') + '\n\n';
          }
          dualNarration += `Berikut tabel ringkasan peran yang sudah disepakati:\n\n${summaryTableDual}\n\n`;
          if (reconPre && reconMsgPre) {
            dualNarration += `> ℹ️ *${reconMsgPre}*\n\n`;
          }
          dualNarration +=
            `Sesuai kesepakatan alur kerja dua arah bisnis, kedua proses disusun ulang secara mandiri masing-masing:\n\n` +
            `${flowMarkdownDual}\n\n` +
            `Silakan periksa kedua alur di atas. Jika sudah pas, pilih "Sudah pas" untuk lanjut ke penetapan Hak Akses (RBAC).`;

          return NextResponse.json({
            success: true,
            action,
            session: finalSession,
            guidedStep: guidedStepDual,
            narration: dualNarration
          });
        }

        // Alur Satu Arah: Tampilkan alur sistem langsung dari data peran terbaru & supportingData AI
        const flowData = getDomainFlowDetails(updated, {
          forceFresh: true,
          supportingFlows: supportingData.alurPendukung,
          supportingFeatures: supportingData.fiturPendukung
        });

        // Rekonsiliasi peran wajib inti berdasarkan alur kerja aktual (POIN 4)
        const { updatedSession, reconciled, message: reconMsg } = reconcileCoreOperationalRole(updated, flowData);
        updated = updatedSession;

        // Simpan flow data yang sudah terekonsiliasi ke session
        updated.flow = {
          ...updated.flow,
          alurInti: flowData.alurInti,
          alurPendukung: flowData.alurPendukung.map((ap) => ({
            nama: ap.nama,
            steps: ap.steps
          })),
          fiturPendukung: flowData.fiturPendukung.map((fp) => fp.label)
        };

        const guidedStep = buildGuidedStep(updated);

        // Penutup wajib: tabel ringkasan final dengan tugas dilimpahkan miring (POIN 3)
        const summaryTable = renderRoleSummaryTable(updated.roles, updated.match.businessCategory, updated.storyline);

        const changeNote = generateChangeNote('ALUR', updated);
        let narration = '';
        if (changeNote) {
          narration += `${changeNote}\n\n`;
        }
        if (removalMessages.length > 0) {
          narration += removalMessages.join('\n\n') + '\n\n';
        }
        narration += `Berikut tabel ringkasan peran yang sudah disepakati:\n\n${summaryTable}\n\n`;

        if (reconciled && reconMsg) {
          narration += `> ℹ️ *${reconMsg}*\n\n`;
        }

        const flowMarkdown = renderFlowMarkdown(flowData);
        narration += flowMarkdown;

        // Deteksi kasus ganda SEBELUM kirim kartu ALUR biasa
        const dualDetect = detectDualProcess(updated);
        if (dualDetect) {
          // Tandai session sedang menunggu jawaban clarification kasus ganda
          // Simpan nama proses agar handler jawaban bisa membacanya
          const sessionWithPending: MockupSessionState = {
            ...updated,
            step: 'ALUR',
            flow: {
              ...updated.flow,
              dualFlowPending: true,
              dualProcessNames: { processA: dualDetect.processA, processB: dualDetect.processB }
            }
          };
          const clarificationCard = buildDualFlowQuestion(dualDetect.processA, dualDetect.processB);
          const dualNarration =
            narration +
            `\n\n---\n\n> ⚠️ **Terdeteksi dua proses utama yang setara:** *${dualDetect.processA}* dan *${dualDetect.processB}* — keduanya sama-sama rutin di bisnis ini.\n>\n> Mau bagaimana ditangani di alur sistem?`;
          return NextResponse.json({
            success: true,
            action,
            session: sessionWithPending,
            guidedStep: clarificationCard,
            narration: dualNarration
          });
        }

        return NextResponse.json({
          success: true,
          action,
          session: updated,
          guidedStep,
          narration
        });
      }

      // Khusus step ALUR: tangani koreksi alur kerja atau persetujuan lanjut ke RBAC
      if (stepId === 'ALUR') {
        const otherText = (body.other || '').trim();
        const selected = body.selected || [];

        // Sub-handler: menunggu jawaban pilih_dua_alur atau pilih_satu_alur
        if (session.flow?.dualFlowPending) {
          const flowDataBase = getDomainFlowDetails(session);

          if (selected.includes('pilih_dua_alur')) {
            // Baca nama proses dari session (disimpan saat deteksi)
            const processA = session.flow?.dualProcessNames?.processA || 'Proses A';
            const processB = session.flow?.dualProcessNames?.processB || 'Proses B';
            const kasusGanda = buildKasusGandaFromSession(session, processA, processB);

            const updatedWithKasus: MockupSessionState = {
              ...session,
              step: 'ALUR',
              flow: {
                ...session.flow,
                dualFlowPending: false,
                kasusGanda,
                // alurInti dikosongkan karena kasusGanda yang dipakai
                alurInti: []
              }
            };

            // Rekonsiliasi role: gabungkan steps dari kedua kasus
            const flowDataForReconcile: DomainFlowData = {
              ...flowDataBase,
              kasusGanda
            };
            const { updatedSession: reconSession, reconciled: reconDual, message: reconMsgDual } =
              reconcileCoreOperationalRole(updatedWithKasus, flowDataForReconcile);

            // Simpan alurPendukung dan fiturPendukung ke session
            const finalSession: MockupSessionState = {
              ...reconSession,
              flow: {
                ...reconSession.flow,
                alurPendukung: flowDataBase.alurPendukung.map((ap) => ({ nama: ap.nama, steps: ap.steps })),
                fiturPendukung: flowDataBase.fiturPendukung.map((fp) => fp.label)
              }
            };

            const dualFlowData: DomainFlowData = {
              ...flowDataBase,
              kasusGanda
            };
            const flowMarkdownDual = renderFlowMarkdown(dualFlowData);
            const guidedStepDual = buildGuidedStep(finalSession);

            let narrationDual = `Oke! Kedua proses sudah dipisahkan jadi alur mandiri masing-masing:\n\n${flowMarkdownDual}\n\nSilakan periksa kedua alur di atas. Jika sudah pas, pilih "Sudah pas" untuk ke bagian Hak Akses (RBAC).`;
            if (reconDual && reconMsgDual) {
              narrationDual += `\n\n> ℹ️ *${reconMsgDual}*`;
            }

            return NextResponse.json({
              success: true,
              action,
              session: finalSession,
              guidedStep: guidedStepDual,
              narration: narrationDual
            });
          } else {
            // pilih_satu_alur: lanjut normal tanpa kasusGanda
            const updatedSingle: MockupSessionState = {
              ...session,
              step: 'ALUR',
              flow: {
                ...session.flow,
                dualFlowPending: false,
                kasusGanda: undefined
              }
            };

            // Rekonsiliasi role & simpan flow biasa
            const { updatedSession: reconSingle } = reconcileCoreOperationalRole(updatedSingle, flowDataBase);
            const finalSingle: MockupSessionState = {
              ...reconSingle,
              flow: {
                ...reconSingle.flow,
                alurInti: flowDataBase.alurInti,
                alurPendukung: flowDataBase.alurPendukung.map((ap) => ({ nama: ap.nama, steps: ap.steps })),
                fiturPendukung: flowDataBase.fiturPendukung.map((fp) => fp.label)
              }
            };

            const flowMarkdownSingle = renderFlowMarkdown(flowDataBase);
            const guidedStepSingle = buildGuidedStep(finalSingle);
            const narrationSingle = `Oke, kita pakai satu alur utama saja. Ini susunan alur yang sudah disesuaikan:\n\n${flowMarkdownSingle}\n\nJika sudah pas, pilih "Sudah pas" untuk lanjut ke Hak Akses (RBAC).`;

            return NextResponse.json({
              success: true,
              action,
              session: finalSingle,
              guidedStep: guidedStepSingle,
              narration: narrationSingle
            });
          }
        }

        const isConfirm =
          selected.includes('confirm_alur') ||
          (!otherText && selected.length === 0) ||
          (Boolean(otherText) && isPureConfirmationText(otherText));

        const isCorrection =
          selected.includes('koreksi_alur') ||
          (Boolean(otherText) && !isConfirm) ||
          /^(koreksi|ubah|ganti|revisi|edit)\b/i.test(otherText) ||
          /langkah\s+\d+/i.test(otherText);

        if (isCorrection && !isConfirm) {
          const flowData = getDomainFlowDetails(session);
          const currentFlow: DomainFlowData = {
            alurInti:
              session.flow?.alurInti && session.flow.alurInti.length > 0
                ? session.flow.alurInti
                : flowData.alurInti,
            alurPendukung:
              session.flow?.alurPendukung && session.flow.alurPendukung.length > 0
                ? session.flow.alurPendukung.map((ap, i) => ({
                    id: `alur_pendukung_${i + 1}`,
                    nama: ap.nama,
                    steps: ap.steps
                  }))
                : flowData.alurPendukung,
            fiturPendukung:
              session.flow?.fiturPendukung && session.flow.fiturPendukung.length > 0
                ? session.flow.fiturPendukung.map((fp, i) => ({
                    id: `feat_custom_${i + 1}`,
                    label: fp
                  }))
                : flowData.fiturPendukung
          };

          const refinedFlow = await refineFlowWithAI(
            currentFlow,
            otherText,
            session,
            provider,
            userApiKey,
            userModel
          );

          const updatedSession: MockupSessionState = {
            ...session,
            step: 'ALUR',
            flow: {
              ...session.flow,
              alurInti: refinedFlow.alurInti,
              alurPendukung: refinedFlow.alurPendukung.map((ap) => ({
                nama: ap.nama,
                steps: ap.steps
              })),
              fiturPendukung: refinedFlow.fiturPendukung.map((fp) => fp.label),
              other: otherText
            }
          };

          const flowMarkdown = renderFlowMarkdown(refinedFlow);
          const guidedStep = buildGuidedStep(updatedSession);
          const narration = `Siap, alur kerja dan fitur pendukung sudah saya perbarui sesuai koreksimu:\n\n${flowMarkdown}\n\nSilakan periksa kembali rincian di atas. Jika sudah pas, pilih "Sudah pas" lalu klik Lanjut untuk ke bagian Hak Akses (RBAC).`;

          return NextResponse.json({
            success: true,
            action,
            session: updatedSession,
            guidedStep,
            narration
          });
        }

        // Normal: persetujuan alur -> lanjut ke RBAC (POIN 5)
        let updated = applyGuidedAnswer(session, 'ALUR', body.selected || [], body.other);

        // PENELUSURAN SEMANTIK ownerRole untuk setiap ENTITAS_DATA:
        // Jika ada entitas data yang belum memiliki ownerRole, telusuri secara semantik dari alur.
        // Jika AI tidak yakin / mengembalikan 'tidak jelas', hentikan transisi dan munculkan klarifikasi pilihan peran.
        const unassignedEntities = (updated.actorsClassification || []).filter(
          (a) => a.category === 'ENTITAS_DATA' && !a.ownerRole
        );

        if (unassignedEntities.length > 0) {
          const activeRoles =
            updated.roles?.selected && updated.roles.selected.length > 0
              ? updated.roles.selected
              : [REQUIRED_ROLE];

          let blockedEntity: string | null = null;
          let blockedReason = '';

          for (const ent of unassignedEntities) {
            const resolution = await resolveEntityOwnerRoleWithAI(
              ent.actor,
              activeRoles,
              updated.flow || {},
              provider,
              userApiKey,
              userModel
            );

            if (
              resolution.confidence === 'high' &&
              resolution.ownerRole &&
              resolution.ownerRole !== 'tidak jelas' &&
              activeRoles.some((r) => r.toLowerCase() === resolution.ownerRole.toLowerCase())
            ) {
              ent.ownerRole =
                activeRoles.find((r) => r.toLowerCase() === resolution.ownerRole.toLowerCase()) ||
                resolution.ownerRole;
            } else {
              // Blokir transisi ke RBAC dan tanyakan ke pengguna
              blockedEntity = ent.actor;
              blockedReason =
                resolution.reason ||
                `Dalam alur kerja saat ini, belum jelas peran internal mana yang bertanggung jawab mencatat data ${ent.actor}.`;
              break;
            }
          }

          if (blockedEntity) {
            updated.step = 'ALUR';
            updated.pendingOwnerRoleClarification = {
              entity: blockedEntity,
              suggestedOwnerRoles: activeRoles,
              actionDescriptions: [blockedReason]
            };

            const guidedStep = buildGuidedStep(updated);
            const narration =
              `Sebelum kita melangkah ke pembagian hak akses (RBAC), ada hal penting yang perlu dipastikan:\n\n` +
              `Entitas **${blockedEntity}** diklasifikasikan sebagai **Entitas Data** (bukan pemegang akun login sistem).\n\n` +
              `💡 *${blockedReason}*\n\n` +
              `**Pertanyaan:** Siapa pengguna sistem (staf/petugas) yang bertugas mencatat dan mengelola data **${blockedEntity}** ini di aplikasi?\n\n` +
              `Silakan pilih peran pengelola di bawah ini agar pembagian hak akses (RBAC) dan skema database dapat dirancang secara akurat.`;

            return NextResponse.json({
              success: true,
              action,
              session: updated,
              guidedStep,
              narration
            });
          }
        }

        // Syarat 1: Generate RBAC segar jika belum ada atau baru dibersihkan dari cache
        if (!updated.rbac || !updated.rbac.modul || updated.rbac.modul.length === 0) {
          const rbacResult = await generateRbacMatrixWithAI(updated, provider, userApiKey, userModel);
          updated.rbac = {
            modul: rbacResult.modul,
            markdownTable: rbacResult.markdownTable,
            catatanPelimpahan: rbacResult.catatanPelimpahan,
            statusKonfirmasi: 'dikoreksi',
            revisiCount: 0
          };
        }

        const guidedStep = buildGuidedStep(updated);
        const tableMarkdown =
          updated.rbac.markdownTable ||
          renderRbacMarkdownTable(
            updated.roles?.selected || [],
            updated.rbac.modul,
            updated.rbac.catatanPelimpahan
          );

        const changeNoteRbac = generateChangeNote('RBAC', updated);
        const narration =
          (changeNoteRbac ? `${changeNoteRbac}\n\n` : '') +
          `Mantap! Alur kerja dan fitur pendukung sudah tersimpan.\n\n` +
          `Berikut adalah rancangan matriks pembagian hak akses (RBAC) per modul fungsional untuk setiap peran di aplikasi Anda:\n\n` +
          `${tableMarkdown}\n\n` +
          `Silakan periksa pembagian wewenang di atas. Jika sudah pas, klik "Sudah pas" untuk lanjut ke perancangan Skema Data.`;

        return NextResponse.json({
          success: true,
          action,
          session: updated,
          guidedStep,
          narration
        });
      }

      // Khusus step RBAC: tangani koreksi hak akses atau persetujuan lanjut ke SKEMA_DATA
      if (stepId === 'RBAC') {
        const otherText = (body.other || '').trim();
        const isPureConfirm = isPureConfirmationText(otherText);
        const isCorrection =
          (body.selected && body.selected.includes('koreksi_rbac')) ||
          (Boolean(otherText) && !isPureConfirm);

        if (isCorrection) {
          const correctionText = (body.other || '').trim() || (body.selected || []).join(', ');
          const revised = await reviseRbacMatrixWithAI(
            session,
            correctionText,
            provider,
            userApiKey,
            userModel
          );

          const updatedSession: MockupSessionState = {
            ...session,
            step: 'RBAC', // TETAP DI STEP RBAC (Syarat 3)
            rbac: {
              modul: revised.modul,
              markdownTable: revised.markdownTable,
              catatanPelimpahan: revised.catatanPelimpahan,
              statusKonfirmasi: 'dikoreksi',
              revisiCount: (session.rbac?.revisiCount || 0) + 1
            }
          };
          // Regenerasi otomatis saat RBAC berubah
          delete updatedSession.dataSchema;
          delete updatedSession.simulasiDb;

          const guidedStep = buildGuidedStep(updatedSession);
          const tableMarkdown =
            revised.markdownTable ||
            renderRbacMarkdownTable(
              updatedSession.roles?.selected || [],
              revised.modul,
              revised.catatanPelimpahan
            );

          const narration =
            `Siap, matriks hak akses telah saya perbarui sesuai masukanmu:\n\n` +
            `${tableMarkdown}\n\n` +
            `Silakan tinjau kembali perubahan di atas. Jika sudah sesuai, pilih "Sudah pas" untuk lanjut ke tahap Skema Data.`;

          return NextResponse.json({
            success: true,
            action,
            session: updatedSession,
            guidedStep,
            narration
          });
        }

        // User memilih confirm_rbac ("Sudah pas, lanjut ke Skema Data")
        let updated = applyGuidedAnswer(session, 'RBAC', body.selected || [], body.other);

        // Pastikan skema data digenerate saat transisi ke SKEMA_DATA
        if (!updated.dataSchema || !updated.dataSchema.tabel || updated.dataSchema.tabel.length === 0) {
          try {
            const schemaResult = await generateDataSchemaWithAI(updated, provider, userApiKey, userModel);
            updated.dataSchema = {
              tabel: schemaResult.tabel,
              korelasiRingkas: schemaResult.korelasiRingkas,
              markdownTable: schemaResult.markdownTable,
              statusKonfirmasi: 'dikoreksi',
              revisiCount: 0
            };
          } catch (err: any) {
            console.error('[guided/route] Error generating data schema with AI:', err);
            const fallback = generateFallbackDataSchema(updated);
            const md = renderDataSchemaMarkdown(fallback.tabel, fallback.korelasiRingkas);
            updated.dataSchema = {
              tabel: fallback.tabel,
              korelasiRingkas: fallback.korelasiRingkas,
              markdownTable: md,
              statusKonfirmasi: 'dikoreksi',
              revisiCount: 0
            };
          }
        }

        const guidedStep = buildGuidedStep(updated);
        const schemaMarkdown = updated.dataSchema?.markdownTable || (updated.dataSchema ? renderDataSchemaMarkdown(updated.dataSchema.tabel, updated.dataSchema.korelasiRingkas) : '');
        const changeNoteSchema = generateChangeNote('SKEMA_DATA', updated);
        const narration =
          (changeNoteSchema ? `${changeNoteSchema}\n\n` : '') +
          `Bagus sekali! Matriks hak akses (RBAC) telah disetujui.\n\n` +
          `Berikut rancangan skema tabel data & relasi yang dibutuhkan aplikasi Anda berdasarkan alur dan wewenang yang telah disepakati:\n\n` +
          `${schemaMarkdown}\n\n` +
          `Silakan periksa struktur tabel dan relasinya di atas. Jika sudah pas, klik "Sudah pas" untuk lanjut ke Simulasi Database.`;

        return NextResponse.json({
          success: true,
          action,
          session: updated,
          guidedStep,
          narration
        });
      }

      // Penanganan khusus untuk step SKEMA_DATA
      if (stepId === 'SKEMA_DATA') {
        const otherText = (body.other || '').trim();
        const isPureConfirm = isPureConfirmationText(otherText);
        const isCorrection =
          Boolean(body.selected?.includes('koreksi_schema')) ||
          (Boolean(otherText) && !isPureConfirm);

        if (isCorrection) {
          const userCorrection = body.other || (body.selected && body.selected.join(', ')) || '';
          const currentCount = session.dataSchema?.revisiCount || 0;

          const revisedResult = await reviseDataSchemaWithAI(
            session,
            userCorrection,
            provider,
            userApiKey,
            userModel
          );

          const updatedSession: MockupSessionState = {
            ...session,
            step: 'SKEMA_DATA',
            dataSchema: {
              tabel: revisedResult.tabel,
              korelasiRingkas: revisedResult.korelasiRingkas,
              markdownTable: revisedResult.markdownTable,
              statusKonfirmasi: 'dikoreksi',
              revisiCount: currentCount + 1
            }
          };
          // Regenerasi otomatis saat skema data berubah
          delete updatedSession.simulasiDb;

          const guidedStep = buildGuidedStep(updatedSession);
          const schemaMarkdown = revisedResult.markdownTable || renderDataSchemaMarkdown(revisedResult.tabel, revisedResult.korelasiRingkas);
          const narration =
            `Siap, skema tabel data telah saya perbarui sesuai masukanmu:\n\n` +
            `${schemaMarkdown}\n\n` +
            `Silakan tinjau kembali perubahan di atas. Jika sudah sesuai, pilih "Sudah pas, lanjut ke Simulasi Database".`;

          return NextResponse.json({
            success: true,
            action,
            session: updatedSession,
            guidedStep,
            narration
          });
        }

        // User memilih confirm_schema ("Sudah pas, lanjut ke Simulasi Database")
        let updated = applyGuidedAnswer(session, 'SKEMA_DATA', body.selected || [], body.other);

        // Pastikan simulasi database digenerate saat transisi ke SIMULASI_DB
        const contohTabelSiap =
          updated.simulasiDb?.contohData &&
          Array.isArray((updated.simulasiDb.contohData as SimulasiContohData).tabel) &&
          (updated.simulasiDb.contohData as SimulasiContohData).tabel.some((t) => t.baris.length > 0);
        if (!contohTabelSiap) {
          const hybrid = await generateSimulasiDbHybrid(updated, { provider, apiKey: userApiKey, model: userModel });
          updated.simulasiDb = hybrid.simulasiDb;
          console.log(`[guided/route] SIMULASI_DB ${hybrid.sumber.toUpperCase()} dalam ${hybrid.latensiAIMs}ms (${session.dataSchema?.tabel?.length || 0} tabel)`);
          if (hybrid.masalahTerakhir && hybrid.masalahTerakhir.length > 0) {
            (updated.simulasiDb as any).peringatanValidasi = hybrid.masalahTerakhir;
          }
        }

        const guidedStep = buildGuidedStep(updated);
        const simulasiMarkdown =
          updated.simulasiDb?.markdownTable ||
          (updated.simulasiDb ? renderSimulasiDbMarkdown(updated.simulasiDb) : '');
        const changeNoteSimulasi = generateChangeNote('SIMULASI_DB', updated);
        const honestValidationWarning = (updated.simulasiDb as any)?.peringatanValidasi?.length
          ? `\n\n> ⚠️ **Catatan Integritas Data Contoh:**\n> Sistem mendeteksi beberapa nilai contoh yang perlu disesuaikan: ${(updated.simulasiDb as any).peringatanValidasi.slice(0, 3).join('; ')}.\n> Anda dapat meminta penyesuaian nilai dengan mengetik pesan di kolom chat.`
          : '';
        const narration =
          (changeNoteSimulasi ? `${changeNoteSimulasi}\n\n` : '') +
          `Bagus sekali! Skema data telah disepakati.\n\n` +
          `Berikut simulasi database singkat (data contoh) dan akun demo untuk login uji coba prototipe Anda:\n\n` +
          `${simulasiMarkdown}${honestValidationWarning}\n\n` +
          `Silakan periksa contoh data dan akun login di atas. Jika sudah pas, klik "Sudah pas, lanjut ke Ringkasan Final".`;

        return NextResponse.json({
          success: true,
          action,
          session: updated,
          guidedStep,
          narration
        });
      }

      // Penanganan khusus untuk step SIMULASI_DB
      if (stepId === 'SIMULASI_DB') {
        const otherText = (body.other || '').trim();
        const isPureConfirm = isPureConfirmationText(otherText);
        const isCorrection =
          Boolean(body.selected?.includes('koreksi_simulasi')) ||
          (Boolean(otherText) && !isPureConfirm);

        if (isCorrection) {
          const userCorrection = (body.other || (body.selected && body.selected.join(', ')) || '').trim();
          const currentCount = session.simulasiDb?.revisiCount || 0;

          const revisedResult = await reviseSimulasiDbWithAI(
            session,
            userCorrection,
            provider,
            userApiKey,
            userModel
          );

          const updatedSession: MockupSessionState = {
            ...session,
            step: 'SIMULASI_DB', // TETAP DI STEP SIMULASI_DB
            simulasiDb: {
              contohData: revisedResult.contohData,
              akunLogin: revisedResult.akunLogin,
              instruksiGenerator: revisedResult.instruksiGenerator,
              markdownTable: revisedResult.markdownTable,
              statusKonfirmasi: 'dikoreksi',
              revisiCount: currentCount + 1
            }
          };

          const guidedStep = buildGuidedStep(updatedSession);
          const simulasiMarkdown =
            revisedResult.markdownTable || renderSimulasiDbMarkdown(revisedResult);
          const narration =
            `Siap, simulasi database dan akun demo telah saya perbarui sesuai masukanmu:\n\n` +
            `${simulasiMarkdown}\n\n` +
            `Silakan tinjau kembali perubahan di atas. Jika sudah sesuai, pilih "Sudah pas, lanjut ke Ringkasan Final".`;

          return NextResponse.json({
            success: true,
            action,
            session: updatedSession,
            guidedStep,
            narration
          });
        }

        // User memilih confirm_simulasi ("Sudah pas, lanjut ke Ringkasan Final")
        let updated = applyGuidedAnswer(session, 'SIMULASI_DB', body.selected || [], body.other);
        updated.compiledBrief = compileBriefFromSession(updated);
        const guidedStep = buildGuidedStep(updated);
        const narration = renderReviewFinalMarkdown(updated);

        return NextResponse.json({
          success: true,
          action,
          session: updated,
          guidedStep,
          narration
        });
      }

      // Penanganan khusus untuk step REVIEW_FINAL (Gate Akhir)
      if (stepId === 'REVIEW_FINAL') {
        const otherText = (body.other || '').trim();
        const isApprove =
          Boolean(body.selected?.includes('approve_prototype')) ||
          isPureConfirmationText(otherText);

        if (isApprove) {
          const completeness = isBriefBusinessComplete(session);
          if (!completeness.complete) {
            return NextResponse.json(
              {
                success: false,
                error: `Spesifikasi aplikasi belum lengkap: ${completeness.missing.join('; ')}`,
                completeness
              },
              { status: 400 }
            );
          }

          let updated = applyGuidedAnswer(session, 'REVIEW_FINAL', ['approve_prototype']);
          updated.compiledBrief = compileBriefFromSession(updated);
          updated.statusKonfirmasi = 'disetujui';
          updated.reviewFinalApproved = true;
          if (!updated.review) {
            updated.review = { statusKonfirmasi: 'disetujui' };
          } else {
            updated.review.statusKonfirmasi = 'disetujui';
          }

          return NextResponse.json({
            success: true,
            action: 'APPROVE',
            session: updated,
            brief: updated.compiledBrief,
            narration:
              '🎉 **Spesifikasi Aplikasi Disetujui!**\n\n' +
              'Semua kebutuhan telah lengkap dan terverifikasi. Kami sekarang beralih ke mode BUILD untuk merancang prototipe aplikasi Anda secara langsung.'
          });
        }

        // User memilih salah satu tombol navigasi "Lihat & Edit [Bagian]"
        let updated = applyGuidedAnswer(session, 'REVIEW_FINAL', body.selected || [], body.other);
        const guidedStep = buildGuidedStep(updated);

        let narration = 'Silakan tinjau dan sesuaikan bagian ini:';
        if (updated.step === 'ROLE') {
          const roleTable = renderRoleSummaryTable(
            updated.roles,
            session.match?.businessCategory || 'Bisnis',
            session.storyline
          );
          narration = `Berikut tinjauan peran (roles) aplikasi Anda saat ini:\n\n${roleTable}\n\nSilakan pilih "Sudah pas" untuk melanjutkan atau berikan koreksi untuk menyesuaikan wewenang peran.`;
        } else if (updated.step === 'ALUR') {
          const flowData = getDomainFlowDetails(updated);
          const flowMd = renderFlowMarkdown(flowData);
          narration = `Berikut tinjauan alur kerja operasional aplikasi Anda saat ini:\n\n${flowMd}\n\nSilakan pilih "Sudah pas" untuk melanjutkan atau berikan koreksi untuk menyesuaikan alur.`;
        } else if (updated.step === 'RBAC') {
          const rbacMd =
            updated.rbac?.markdownTable ||
            renderRbacMarkdownTable(
              updated.roles?.selected || [],
              updated.rbac?.modul || [],
              updated.rbac?.catatanPelimpahan
            );
          narration = `Berikut tinjauan matriks hak akses (RBAC) aplikasi Anda saat ini:\n\n${rbacMd}\n\nSilakan pilih "Sudah pas" untuk melanjutkan atau berikan koreksi untuk menyesuaikan hak akses.`;
        } else if (updated.step === 'SKEMA_DATA') {
          const schemaMd =
            updated.dataSchema?.markdownTable ||
            (updated.dataSchema
              ? renderDataSchemaMarkdown(updated.dataSchema.tabel, updated.dataSchema.korelasiRingkas)
              : '');
          narration = `Berikut tinjauan skema basis data aplikasi Anda saat ini:\n\n${schemaMd}\n\nSilakan pilih "Sudah pas" untuk melanjutkan atau berikan koreksi untuk menyesuaikan struktur tabel.`;
        } else if (updated.step === 'SIMULASI_DB') {
          const simMd =
            updated.simulasiDb?.markdownTable ||
            (updated.simulasiDb ? renderSimulasiDbMarkdown(updated.simulasiDb) : '');
          narration = `Berikut tinjauan simulasi database & akun demo login saat ini:\n\n${simMd}\n\nSilakan pilih "Sudah pas" untuk melanjutkan atau berikan koreksi untuk menyesuaikan data contoh.`;
        }

        return NextResponse.json({
          success: true,
          action,
          session: updated,
          guidedStep,
          narration
        });
      }

      // Default applyGuidedAnswer untuk langkah lainnya
      let updated = applyGuidedAnswer(session, stepId, body.selected || [], body.other);

      const guidedStep = buildGuidedStep(updated);
      const narration = await generateNarration(
        updated,
        'NEXT',
        guidedStep?.title,
        provider,
        userApiKey,
        userModel
      );

      return NextResponse.json({
        success: true,
        action,
        session: updated,
        guidedStep,
        narration
      });
    }

    if (action === 'COMPILE') {
      const session = body.session;
      if (!session) {
        return NextResponse.json({ success: false, error: 'session wajib untuk COMPILE.' }, { status: 400 });
      }

      const complete = isBriefBusinessComplete(session);
      const templateName = session.match.templateId
        ? detectMatchingMasterTemplate(session.match.templateId)?.template.nama
        : undefined;
      const brief = compileBriefFromSession(session, {
        appName: body.appName,
        templateName
      });

      const finalSession: MockupSessionState = { ...session, step: 'REVIEW_FINAL' };
      const narration = await generateNarration(finalSession, 'COMPILE', undefined, provider, userApiKey, userModel);

      return NextResponse.json({
        success: true,
        action,
        session: finalSession,
        brief,
        complete,
        narration
      });
    }

    return NextResponse.json({ success: false, error: `Aksi tidak dikenal: ${action}` }, { status: 400 });
  } catch (err) {
    console.error('Error in /api/guided:', err);
    return NextResponse.json({ success: false, error: 'Terjadi kesalahan pada server.' }, { status: 500 });
  }
}
