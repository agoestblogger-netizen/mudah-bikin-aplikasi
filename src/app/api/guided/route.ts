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
  type DomainFlowData,
  type GuidedStepId,
  type MockupSessionState
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

type GuidedAction = 'START' | 'NEXT' | 'COMPILE';

interface GuidedBody {
  action?: GuidedAction;
  prompt?: string;
  session?: MockupSessionState;
  stepId?: GuidedStepId;
  selected?: string[];
  other?: string;
  appName?: string;
  provider?: string;
  apiKey?: string;
  model?: string;
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
    maxTokens = 350,
    provider,
    userApiKey,
    userModel
  } = options;

  const hasUserKey = Boolean(userApiKey && userApiKey.trim());
  const requestedProvider = hasUserKey
    ? provider === 'gemini'
      ? 'gemini'
      : 'openai'
    : (process.env.AI_PROVIDER || (process.env.GEMINI_API_KEY ? 'gemini' : 'openai')).toLowerCase();

  const isUserGemini = hasUserKey && provider === 'gemini';
  const isOpenRouter = hasUserKey && (provider === 'openrouter' || (userApiKey || '').startsWith('sk-or-'));

  const geminiApiKey = isUserGemini ? userApiKey!.trim() : process.env.GEMINI_API_KEY;
  const openaiApiKey = isUserGemini ? undefined : hasUserKey ? userApiKey!.trim() : process.env.OPENAI_API_KEY;
  const openaiBaseUrl = isUserGemini
    ? undefined
    : hasUserKey
      ? isOpenRouter
        ? OPENROUTER_API_BASE
        : OPENAI_API_BASE
      : 'https://api.openai.com/v1';

  const geminiModel = isUserGemini ? userModel || DEFAULT_GEMINI_MODEL : process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  const openaiModel = hasUserKey
    ? userModel || (isOpenRouter ? OPENROUTER_DEFAULT_MODEL : DEFAULT_OPENAI_MODEL)
    : process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL;

  try {
    if (requestedProvider === 'gemini' && geminiApiKey) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
}

const CONFIRMATION_CLOSING = 'Apakah ini sudah menggambarkan proses bisnismu? Kalau ada yang beda, boleh langsung dikoreksi.';

/**
 * Menyusun cerita proses bisnis singkat (2-4 kalimat) murni berbasis AI tanpa istilah teknis (POIN 2).
 */
async function generateStorylineWithAI(
  prompt: string,
  provider?: string,
  apiKey?: string,
  model?: string
): Promise<AIStorylineResult> {
  const systemInstruction = `Anda adalah Partner Diskusi & Konsultan Aplikasi AI dari platform "Aplikasi Generator".
Tugas Anda: Menyambut ide pengguna dengan hangat, apresiatif, dan ramah, lalu merangkai cerita proses bisnis (2-4 kalimat) yang mengalir luwes, hidup, dan manusiawi.

PANDUAN NADA & GAYA BAHASA (WAJIB DIPATUHI):
1. NADA SANGAT HANGAT & BERSAHABAT: Gunakan bahasa Indonesia percakapan yang santun, luwes, dan akrab layaknya rekan diskusi bisnis yang suportif. HINDARI bahasa kaku seperti laporan kantor/birokrasi atau robot!
2. PEMBUKA YANG MENGALIR: Awali dengan menyapa atau mengapresiasi ide pengguna secara natural (misalnya: "Wah, ide yang menarik!", "Keren, senang sekali bisa bantu wujudkan ide usahamu!", atau "Menarik sekali! Mari kita bayangkan operasional sehari-harinya:").
3. CERITA HIDUP & KONKRET: Rangkum dengan mengalir: siapa yang melayani di garis depan, bagaimana interaksi dengan pelanggan, dan bagaimana pemilik memantau usaha dengan tenang tanpa ribet.
4. SANGAT PENTING - TANPA ISTILAH TEKNIS: DILARANG KERAS menggunakan kata-kata teknis komputer/software (seperti CRUD, database, API, backend, frontend, skema, tabel, sistem informasi, autentikasi, server). Ceritakan murni keseharian manusia di lapangan!
5. KALIMAT PENUTUP WAJIB: Tutup cerita dengan kalimat konfirmasi yang ramah:
"${CONFIRMATION_CLOSING}"
6. EKSTRAKSI FIELD:
- appName: Nama aplikasi yang spesifik dan menarik (contoh: "Toko Kelontong Berkah", "CatBoarding Care")
- businessCategory: Kategori bisnis spesifik (contoh: "Toko Retail Kelontong", "Penitipan Kucing")
- asumsiMasalah: 1-2 kalimat masalah operasional nyata yang dihadapi
- asumsiAktor: daftar 3-5 peran nyata (selalu sertakan "Super Admin", dan peran manusia nyata di bisnis tersebut)
- asumsiAlurUtama: ringkasan alur utama dari awal sampai selesai

Kembalikan HANYA JSON valid:
{
  "appName": "Toko Kelontong Berkah",
  "businessCategory": "Ritel & Toko Kelontong",
  "narasi": "Wah, ide yang menarik! Bayangkan keseharian tokomu nanti: kasir dengan sigap menyapa pembeli dan mencatat belanjaan yang keluar, sehingga rak jualan selalu terpantau rapi. Kamu sebagai pemilik bisa santai mengecek pemasukan harian kapan pun dari mana saja tanpa khawatir ada hitungan yang selisih. ${CONFIRMATION_CLOSING}",
  "asumsiMasalah": "Pencatatan penjualan dan stok barang rawan tercecer jika masih ditulis manual di buku.",
  "asumsiAktor": ["Super Admin", "Kasir", "Staf Gudang", "Pelanggan"],
  "asumsiAlurUtama": "Pelanggan memilih barang -> Kasir melayani belanja & cetak nota -> Stok terpotong rapi -> Pemilik memantau omzet harian"
}`;

  const raw = await invokeAIChat({
    systemInstruction,
    userPrompt: `Permintaan Pengguna: "${prompt}"\nSusun cerita proses bisnis yang hangat dan bersahabat, lalu ekstrak field terstruktur:`,
    temperature: 0.5,
    maxTokens: 600,
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
            : ['Super Admin', 'Staf Operasional', 'Pelanggan'];

        return {
          appName,
          businessCategory,
          templateId: 'MT-20',
          overlayIds: [],
          patternIds: ['UP-06', 'UP-09'],
          narasi,
          asumsiMasalah:
            String(parsed.asumsiMasalah || '').trim() ||
            `Pengelolaan operasional harian ${businessCategory} butuh alur yang teratur.`,
          asumsiAktor,
          asumsiAlurUtama:
            String(parsed.asumsiAlurUtama || '').trim() ||
            'Pelanggan mengajukan pesanan -> Petugas memproses -> Pemilik memantau laporan'
        };
      }
    } catch (e) {
      console.warn('Gagal mem-parse JSON hasil generateStorylineWithAI:', e);
    }
  }

  // Fallback hangat dan bersahabat jika AI tidak merespons
  const cleanPrompt = prompt.trim();
  return {
    appName: `Aplikasi ${cleanPrompt.slice(0, 30)}`,
    businessCategory: cleanPrompt.slice(0, 40) || 'Bisnis Anda',
    templateId: 'MT-20',
    overlayIds: [],
    patternIds: ['UP-06', 'UP-09'],
    narasi: `Wah, ide yang menarik untuk ${cleanPrompt}! Bayangkan operasionalnya nanti: tim di lapangan dengan sigap melayani pelanggan secara teratur, sementara kamu sebagai pemilik bisa memantau perkembangan aktivitas dan rekap penjualan harian dengan tenang. ${CONFIRMATION_CLOSING}`,
    asumsiMasalah: `Pengelolaan operasional dan pencatatan untuk ${cleanPrompt} memerlukan alur kerja yang rapi.`,
    asumsiAktor: ['Super Admin', 'Staf Operasional', 'Pelanggan'],
    asumsiAlurUtama: 'Pelanggan memesan -> Petugas memproses -> Pemilik memeriksa laporan harian'
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
Tugas Anda: Memperbarui cerita dan asumsi proses bisnis berdasarkan masukan atau koreksi dari pengguna dengan gaya bahasa yang hangat, ramah, dan mengalir luwes.

ATURAN WAJIB:
1. NADA HANGAT & BERSAHABAT: Tanggapi koreksi pengguna dengan positif, apresiatif, dan suportif.
2. SESUAIKAN DENGAN KOREKSI: Rangkai kembali cerita sehingga memasukkan poin koreksi pengguna secara alami dan enak dibaca.
3. TANPA ISTILAH TEKNIS: DILARANG KERAS menggunakan istilah teknis IT/coding/database (seperti CRUD, database, API, tabel, skema, backend). Ceritakan alur aktivitas kerja nyata manusia!
4. KALIMAT PENUTUP: Akhiri narasi cerita DENGAN PERSIS KALIMAT INI:
"${CONFIRMATION_CLOSING}"
5. PERBARUI FIELD:
- narasi: 2-4 kalimat cerita proses bisnis terbaru yang mengalir halus dan ramah
- asumsiMasalah: masalah utama yang diselesaikan
- asumsiAktor: daftar peran (selalu sertakan "Super Admin", ditambah peran hasil koreksi)
- asumsiAlurUtama: ringkasan alur utama dari awal ke akhir

Kembalikan HANYA JSON valid:
{
  "narasi": "...",
  "asumsiMasalah": "...",
  "asumsiAktor": ["Super Admin", "..."],
  "asumsiAlurUtama": "..."
}`;

  const userPrompt = `Cerita Sebelumnya:
"${previousStoryline.narasi}"
Aktor Sebelumnya: ${previousStoryline.asumsiAktor.join(', ')}
Alur Sebelumnya: ${previousStoryline.asumsiAlurUtama}

Masukan / Koreksi Pengguna:
"${userFeedback}"

Perbarui cerita dan field asumsi dalam format JSON dengan nada hangat dan ramah:`;

  const raw = await invokeAIChat({
    systemInstruction,
    userPrompt,
    temperature: 0.5,
    maxTokens: 500,
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
  return {
    narasi: `${previousStoryline.narasi.replace(CONFIRMATION_CLOSING, '').trim()} (Penyesuaian: ${userFeedback}). ${CONFIRMATION_CLOSING}`,
    asumsiMasalah: previousStoryline.asumsiMasalah,
    asumsiAktor: previousStoryline.asumsiAktor,
    asumsiAlurUtama: previousStoryline.asumsiAlurUtama
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

    if (action === 'START') {
      const prompt = (body.prompt || '').trim();
      if (!prompt) {
        return NextResponse.json({ success: false, error: 'prompt wajib diisi untuk START.' }, { status: 400 });
      }

      // 1. Sintesis Storyline proses bisnis MURNI AI (POIN 2)
      const storylineResult = await generateStorylineWithAI(
        prompt,
        provider,
        userApiKey,
        userModel
      );

      // 2. Pencarian semantik (Gemini embedding jika tersedia)
      const geminiKey =
        provider === 'gemini' && userApiKey && userApiKey.trim()
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
      const patternIds = storylineResult.patternIds || ['UP-06', 'UP-09'];
      const tier = detectTier({ patternIds });

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
          statusKonfirmasi: 'disetujui',
          revisiCount: 0
        },
        roles: { selected: [] },
        flow: {},
        painPoints: { selected: [] },
        features: { selected: [] }
      };

      const guidedStep = buildGuidedStep(session);
      // Narasi chat awal langsung cerita proses bisnis (POIN 2)
      const narration = session.storyline?.narasi || storylineResult.narasi;

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

    if (action === 'NEXT') {
      const session = body.session;
      const stepId = body.stepId || (session?.step as GuidedStepId | undefined);
      if (!session || !stepId) {
        return NextResponse.json({ success: false, error: 'session dan stepId wajib untuk NEXT.' }, { status: 400 });
      }

      // Khusus step STORYTELLING: proses konfirmasi, koreksi kecil, atau meleset jauh (POIN 2)
      if (stepId === 'STORYTELLING') {
        const selected = body.selected || [];
        const other = (body.other || '').trim();
        const existingStory = session.storyline || {
          narasi: '',
          asumsiMasalah: '',
          asumsiAktor: session.match.contextualRoles || ['Super Admin', 'Staf', 'Pelanggan'],
          asumsiAlurUtama: '',
          statusKonfirmasi: 'disetujui',
          revisiCount: 0
        };

        const isConfirm =
          selected.includes('confirm_story') ||
          (!other && selected.length === 0) ||
          (Boolean(other) && /^(ya|oke|ok|sudah|pas|lanjut|benar|betul|sesuai|setuju|mantap|sip)\b/i.test(other));

        const isMismatch =
          selected.includes('mismatch_story') ||
          (Boolean(other) && /meleset\s*jauh|salah\s*(semua|total)|bukan\s*begitu|keliru\s*total/i.test(other));

        const currentRevisi = existingStory.revisiCount || 0;

        if (isMismatch) {
          if (currentRevisi >= 2) {
            // Batas 2 kali koreksi tercapai: lanjut ke ROLE dengan catatan (POIN 2 aturan 5)
            const updated: MockupSessionState = {
              ...session,
              step: 'ROLE',
              storyline: {
                ...existingStory,
                statusKonfirmasi: 'dikoreksi',
                revisiCount: currentRevisi
              }
            };
            const guidedStep = buildGuidedStep(updated);
            const narration =
              'Siap, kita simpan pemahaman proses bisnis sejauh ini dan lanjut dulu ke penentuan peran ya. Tenang saja, kamu masih bisa mengoreksi lagi nanti pas melihat detail di bagian berikutnya!';
            return NextResponse.json({
              success: true,
              action,
              session: updated,
              guidedStep,
              narration
            });
          } else {
            // Masuk ke pertanyaan bertahap satu per satu (POIN 2 aturan 4)
            const nextRevisi = currentRevisi + 1;
            const updated: MockupSessionState = {
              ...session,
              step: 'STORYTELLING',
              storyline: {
                ...existingStory,
                statusKonfirmasi: 'dikoreksi',
                revisiCount: nextRevisi
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
        }

        // Jika sebelumnya dalam mode klarifikasi bertahap dan user memberikan jawaban
        if (currentRevisi > 0 && !isConfirm) {
          const feedback = other || selected.join(', ');
          const refined = await refineStorylineWithAI(
            existingStory,
            feedback,
            true,
            provider,
            userApiKey,
            userModel
          );
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
              statusKonfirmasi: 'dikoreksi',
              revisiCount: currentRevisi
            }
          };
          const guidedStep = buildGuidedStep(updated);
          return NextResponse.json({
            success: true,
            action,
            session: updated,
            guidedStep,
            narration: updated.storyline?.narasi
          });
        }

        // Koreksi kecil / catatan alur: perbarui storyline lalu langsung lanjut ke ROLE (POIN 2 aturan 3)
        if (other && !isConfirm) {
          const refined = await refineStorylineWithAI(
            existingStory,
            other,
            false,
            provider,
            userApiKey,
            userModel
          );
          const updated: MockupSessionState = {
            ...session,
            step: 'ROLE',
            match: {
              ...session.match,
              contextualRoles: refined.asumsiAktor
            },
            storyline: {
              ...existingStory,
              ...refined,
              statusKonfirmasi: 'dikoreksi',
              revisiCount: currentRevisi
            }
          };
          const guidedStep = buildGuidedStep(updated);
          const narration =
            'Owner di sini berperan sebagai Super Admin — pemegang akses tertinggi di aplikasi.\n\nSip, catatanmu sudah saya sesuaikan ke alur cerita! Sekarang, yuk kita pilih siapa saja pengguna yang akan mengoperasikan aplikasi ini:';
          return NextResponse.json({
            success: true,
            action,
            session: updated,
            guidedStep,
            narration
          });
        }

        // Konfirmasi langsung -> lanjut ke ROLE (POIN 2 aturan 3 & POIN 3 pembuka)
        const updated: MockupSessionState = {
          ...session,
          step: 'ROLE',
          storyline: {
            ...existingStory,
            statusKonfirmasi: 'disetujui'
          }
        };
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
            const table = renderRoleSummaryTable(session.roles, session.match.businessCategory);
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

        const guidedStep = buildGuidedStep(updated);

        // Kalimat konfirmasi eksplisit jika ada role tambahan yang dihapus (POIN 3)
        const removalMessages: string[] = [];
        if (updated.roles.tugasDilimpahkan && updated.roles.tugasDilimpahkan.length > 0) {
          for (const d of updated.roles.tugasDilimpahkan) {
            removalMessages.push(
              `Oke, role ${d.dariRole} dihapus. Berarti tugas (${d.daftarTugas.join(', ')}) otomatis jadi tanggung jawab Owner ya — kalau mau dilimpahkan ke role lain, tinggal bilang saja.`
            );
          }
        }

        // Penutup wajib: tabel ringkasan final dengan tugas dilimpahkan miring (POIN 3)
        const summaryTable = renderRoleSummaryTable(updated.roles, updated.match.businessCategory);

        let narration = '';
        if (removalMessages.length > 0) {
          narration += removalMessages.join('\n\n') + '\n\n';
        }
        narration += `Berikut tabel ringkasan peran yang sudah disepakati:\n\n${summaryTable}\n\n`;

        // Tampilkan alur sistem langsung poin bernomor tanpa narasi pembuka tambahan (POIN 4)
        const flowData = getDomainFlowDetails(updated);
        const flowMarkdown = renderFlowMarkdown(flowData);
        narration += flowMarkdown;

        return NextResponse.json({
          success: true,
          action,
          session: updated,
          guidedStep,
          narration
        });
      }

      // Khusus step ALUR: tangani koreksi alur inti via chat atau persetujuan lanjut ke RBAC (POIN 4)
      if (stepId === 'ALUR') {
        const otherText = (body.other || '').trim();
        const isCorrection =
          /^(koreksi|ubah|ganti|revisi|edit)\b/i.test(otherText) ||
          /langkah\s+\d+/i.test(otherText);

        if (isCorrection) {
          // Tangani koreksi langkah alur inti
          const flowData = getDomainFlowDetails(session);
          let alurInti = [...(session.flow?.alurInti || flowData.alurInti)];

          // Cek nomor langkah yang dikoreksi (misal "koreksi langkah 3: kasir tawarkan diskon")
          const stepMatch = otherText.match(/langkah\s+(\d+)\s*[:=-]?\s*(.+)/i);
          if (stepMatch) {
            const stepNum = parseInt(stepMatch[1], 10);
            const newAction = stepMatch[2].trim();
            const targetStep = alurInti.find((s) => s.step === stepNum);
            if (targetStep) {
              targetStep.aksi = newAction;
            }
          }

          const updatedSession: MockupSessionState = {
            ...session,
            step: 'ALUR',
            flow: {
              ...session.flow,
              alurInti
            }
          };
          const updatedFlowData: DomainFlowData = {
            ...flowData,
            alurInti
          };
          const flowMarkdown = renderFlowMarkdown(updatedFlowData);
          const guidedStep = buildGuidedStep(updatedSession);
          const narration = `Siap, alur inti sudah saya perbarui sesuai koreksimu:\n\n${flowMarkdown}\n\nSilakan periksa kembali atau klik Lanjut untuk ke bagian Hak Akses (RBAC).`;
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
        const guidedStep = buildGuidedStep(updated);
        const narration =
          'Mantap! Alur kerja dan fitur pendukung sudah tersimpan.\n\nSekarang, yuk kita atur pembagian hak akses (RBAC) untuk masing-masing peran di aplikasi:';
        return NextResponse.json({
          success: true,
          action,
          session: updated,
          guidedStep,
          narration
        });
      }

      // Default applyGuidedAnswer untuk langkah berikutnya (ALUR, RBAC, dst)
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
