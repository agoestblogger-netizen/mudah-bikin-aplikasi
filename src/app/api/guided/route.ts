import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rateLimiter';
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
        body: JSON.stringify({
          model: openaiModel,
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: maxTokens,
          temperature
        })
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content || '';
        if (text.trim()) return text.trim();
      }
    }
  } catch (err) {
    console.warn('AI invocation failed:', err);
  }

  return null;
}

interface AIBusinessMappingResult {
  businessCategory: string;
  templateId: string;
  overlayIds: string[];
  patternIds: string[];
  contextualPainPoints: string[];
  contextualRoles: string[];
}

/**
 * Langkah 0 (AI Discovery):
 * Menganalisis ide pengguna untuk memetakan template, overlay, pain points,
 * dan peran yang 100% kontekstual dan masuk akal secara bisnis.
 */
async function mapBusinessIntentWithAI(
  prompt: string,
  provider?: string,
  apiKey?: string,
  model?: string,
  candidates?: SemanticMatch[]
): Promise<AIBusinessMappingResult | null> {
  const systemInstruction = `Anda adalah Principal Enterprise Architect & Business Analyst dari platform "Aplikasi Generator".
Tugas Anda: Menganalisis ide bisnis pengguna dan memetakannya secara SANGAT AKURAT ke Master Template (MT) dan Overlay Industri (IND).

KATALOG MASTER TEMPLATE:
- MT-01: Retail & POS (Toko fisik/online, minimarket, kasir, penjualan barang)
- MT-02: Wholesale & Distribution (Grosir, distributor B2B, gudang)
- MT-03: F&B & Restaurant (Restoran, kafe, katering, warung makan, menu, dapur)
- MT-04: Appointment & Service (Salon, spa, pangkas rambut, barbershop, jasa janji temu)
- MT-05: Workshop & Service Order (Bengkel servis motor/mobil, reparasi elektronik, mekanik, spare part)
- MT-06: Healthcare (Klinik, dokter, rekam medis, antrean pasien, apotek obat)
- MT-07: Manufacturing (Pabrik, produksi, konveksi, BOM, work order)
- MT-08: Project & Professional Service (Konsultan, agensi, software house, timesheet)
- MT-09: Booking & Hospitality (Hotel, villa, homestay, sewa kamar harian)
- MT-10: Education (Sekolah, bimbel, kursus, siswa, kelas, rapor, SPP)
- MT-11: CRM & Sales (Manajemen prospek/leads, pipeline deals)
- MT-12: Finance & Accounting (Keuangan, pembukuan, pinjaman/kredit, angsuran)
- MT-13: Property Management (Kost, sewa ruko/apartemen, kontrak penyewa properti)
- MT-14: Logistics & Delivery (Ekspedisi, kurir pengiriman barang, resi, armada)
- MT-15: Membership & Subscription (Gym, fitness, komunitas berbayar, iuran member)
- MT-16: Human Resources (HR, absensi karyawan, cuti, payroll gaji)
- MT-17: Procurement & Inventory (Pengadaan barang, purchase order, stok gudang)
- MT-18: Asset & Maintenance (Manajemen aset tetap, jadwal pemeliharaan alat)
- MT-19: Event Management (Tiket konser/seminar, check-in QR, rundown)
- MT-20: Custom Application (Aplikasi kustom umum)
- MT-21: Rental & Peminjaman (Sewa sepeda, rental motor, rental mobil, sewa kamera/alat, persewaan perlengkapan)
- MT-22: Konstruksi & Proyek Lapangan (Kontraktor, RAB, progres termin, subkon)
- MT-23: Pertanian & Agribisnis (Kebun, lahan, panen, komoditas tani)
- MT-24: Layanan Publik & Pemerintahan (Dinas, kelurahan, izin, disposisi warga)
- MT-25: Media & Konten Digital (Editorial, artikel, jadwal publikasi konten)
- MT-26: Asuransi & Klaim (Polis, premi berkala, klaim & investigasi)
- MT-27: E-commerce Marketplace (Multi-seller, keranjang, escrow, komisi)
- MT-28: NGO & Nonprofit (Donasi, program sosial, relawan, transparansi)

KATALOG OVERLAY INDUSTRI:
IND-01 (Retail), IND-02 (F&B), IND-03 (Jasa Profesional), IND-04 (Kesehatan), IND-05 (Pendidikan),
IND-06 (Manufaktur), IND-07 (Logistik), IND-08 (Properti), IND-09 (Perhotelan), IND-10 (Konstruksi),
IND-11 (Pertanian), IND-12 (Keuangan/Pegadaian), IND-13 (Bengkel & Servis Otomotif), IND-14 (Event),
IND-15 (Layanan Publik), IND-16 (Media), IND-17 (Kecantikan & Wellness), IND-18 (Asuransi),
IND-19 (Marketplace), IND-20 (NGO), IND-21 (Rental & Persewaan).

ATURAN KRITIS (SANGAT PENTING):
1. PISAHKAN RENTAL vs BENGKEL: Jika ide berupa persewaan/rental (rental motor, rental mobil, sewa kamera, rental sepeda, dll), WAJIB pilih MT-21 dan IND-21. JANGAN PERNAH memilih MT-05 atau IND-13! Dilarang memunculkan peran seperti Service Advisor/Mekanik atau masalah spare part pada bisnis rental!
2. PISAHKAN BENGKEL vs RENTAL: Jika ide berupa reparasi/servis/bengkel (servis motor, ganti oli, bengkel mobil, bengkel AC), WAJIB pilih MT-05 dan IND-13.
3. Buat 3-5 pain points (masalah utama) yang SANGAT RELEVAN dan spesifik untuk bisnis tersebut dalam bahasa Indonesia santun.
4. Buat 3-5 peran operasional yang MASUK AKAL secara nyata untuk bisnis tersebut (contoh rental motor: "Petugas Rental", "Penyewa", "Petugas Cek Fisik Unit").
5. Gunakan MT-20 (Custom) HANYA jika benar-benar tidak ada template yang cocok. Utamakan template yang paling mendekati.

Kembalikan HANYA JSON valid:
{
  "templateId": "MT-21",
  "overlayIds": ["IND-21"],
  "businessCategory": "Rental & Persewaan Sepeda Motor",
  "contextualPainPoints": [
    "Jadwal ketersediaan motor sering bentrok / tumpang tindih",
    "Penyewa terlambat mengembalikan motor tanpa konfirmasi",
    "Kondisi fisik motor (lecet/rusak) saat kembali sulit diverifikasi",
    "Perhitungan denda telat & pengembalian uang jaminan (deposit) rumit"
  ],
  "contextualRoles": [
    "Petugas Rental",
    "Penyewa",
    "Petugas Cek Fisik Unit"
  ]
}`;

  const candidateHint =
    candidates && candidates.length > 0
      ? `\n\nKANDIDAT SEMANTIC (kemiripan embedding dari repository, jadikan pertimbangan utama; tetap validasi dengan aturan kritis):\n` +
        candidates
          .slice(0, 6)
          .map((c) => `- [${c.kind}] ${c.id} ${c.label} (skor ${c.similarity.toFixed(3)})`)
          .join('\n')
      : '';

  const raw = await invokeAIChat({
    systemInstruction,
    userPrompt: `Ide Bisnis Pengguna: "${prompt}"\nPetakan ke Master Template, Overlay, pain points, dan peran yang paling tepat dalam bentuk JSON:${candidateHint}`,
    temperature: 0.1,
    maxTokens: 500,
    provider,
    userApiKey: apiKey,
    userModel: model
  });

  if (!raw) return null;

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);

    if (!parsed.templateId || !getMasterTemplateById(parsed.templateId)) {
      return null;
    }

    const map = getTemplateProcessMap(parsed.templateId);
    const validOverlayIds = Array.isArray(parsed.overlayIds)
      ? parsed.overlayIds.filter((id: string) => Boolean(getIndustryOverlayById(id)))
      : [];

    const finalOverlayIds = validOverlayIds.length > 0 ? validOverlayIds : (map?.overlayIds || []);
    const patternIds = map?.patternIds && map.patternIds.length > 0 ? map.patternIds : ['UP-06', 'UP-09'];

    return {
      templateId: parsed.templateId,
      overlayIds: finalOverlayIds,
      patternIds,
      businessCategory: String(parsed.businessCategory || '').trim() || 'Bisnis Anda',
      contextualPainPoints: Array.isArray(parsed.contextualPainPoints) ? parsed.contextualPainPoints.map(String) : [],
      contextualRoles: Array.isArray(parsed.contextualRoles) ? parsed.contextualRoles.map(String) : []
    };
  } catch (e) {
    console.warn('Gagal mem-parse JSON hasil pemetaan bisnis AI:', e);
    return null;
  }
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
    'Anda adalah Konsultan Aplikasi AI dari platform "Aplikasi Generator". Berikan narasi singkat, hangat, dan konkret. Sebut kegiatan ini sebagai "Aplikasi Generator", jangan gunakan istilah "perancangan aplikasi". Jangan pernah mengubah daftar opsi pilihan pengguna.';

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
    return `Selamat datang di Aplikasi Generator! Mari kita mulai dengan menentukan masalah utama yang ingin Anda selesaikan untuk ${category}. Anda bisa memilih lebih dari satu opsi.`;
  }
  if (action === 'COMPILE') {
    return 'Brief sudah dirapikan dari pilihan Anda. Silakan cek halaman Brief, edit bila perlu, lalu setujui untuk membuat prototipe.';
  }
  return stepTitle ? `Oke, lanjut ke bagian berikutnya: ${stepTitle.replace(/\s*\(.*\)\s*$/, '')}.` : 'Oke, lanjut.';
}

export async function POST(req: Request) {
  try {
    const forwardedFor = req.headers.get('x-forwarded-for');
    const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1';
    const rateLimit = checkRateLimit(clientIp);
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

      // 0. Semantic search (Gemini embedding) untuk menemukan kandidat paling mirip.
      //    Tidak menyimpan teks prompt; hanya embedding repository yang di-index.
      const geminiKey =
        provider === 'gemini' && userApiKey && userApiKey.trim()
          ? userApiKey.trim()
          : process.env.GEMINI_API_KEY || '';

      let semantic: SemanticMappingResult | null = null;
      if (geminiKey) {
        try {
          await ensureSemanticIndex(geminiKey);
          semantic = await resolveSemanticMapping(prompt, geminiKey);
        } catch (err) {
          console.warn('Semantic mapping dilewati:', err);
        }
      }

      let templateId: string;
      let overlayIds: string[];
      let patternIds: string[];
      let businessCategory: string | undefined;
      let contextualPainPoints: string[] | undefined;
      let contextualRoles: string[] | undefined;

      if (semantic?.confident && semantic.templateId) {
        // Skor semantic sudah tinggi & jelas: langsung pakai, tanpa AI mapping.
        templateId = semantic.templateId;
        overlayIds = semantic.overlayIds && semantic.overlayIds.length > 0 ? semantic.overlayIds : [];
        patternIds = semantic.patternIds && semantic.patternIds.length > 0 ? semantic.patternIds : ['UP-06', 'UP-09'];
        const firstOverlay = getIndustryOverlayById(overlayIds[0]);
        const matchedTemplate = getMasterTemplateById(templateId);
        businessCategory = firstOverlay ? firstOverlay.nama : matchedTemplate?.nama;
      } else {
        // 1. Pemetaan cerdas menggunakan AI (dengan petunjuk kandidat semantic bila ada)
        const aiMapping = await mapBusinessIntentWithAI(
          prompt,
          provider,
          userApiKey,
          userModel,
          semantic?.candidates
        );

        if (aiMapping) {
          templateId = aiMapping.templateId;
          overlayIds = aiMapping.overlayIds;
          patternIds = aiMapping.patternIds;
          businessCategory = aiMapping.businessCategory;
          contextualPainPoints = aiMapping.contextualPainPoints;
          contextualRoles = aiMapping.contextualRoles;
        } else {
          // Fallback statis deterministik dari repository yang sudah dibersihkan
          const matched = detectMatchingMasterTemplate(prompt);
          const semanticTemplateId = semantic?.templateId;
          const fallbackTemplateId = matched?.template.id || semanticTemplateId || 'MT-20';
          const map = getTemplateProcessMap(fallbackTemplateId);

          templateId = fallbackTemplateId;
          if (!matched && semanticTemplateId) {
            overlayIds = map?.overlayIds || [];
            patternIds = map?.patternIds || [];
            const firstOverlay = getIndustryOverlayById(overlayIds[0]);
            const tpl = getMasterTemplateById(semanticTemplateId);
            businessCategory = firstOverlay ? firstOverlay.nama : tpl?.nama;
          } else {
            const detectedOverlays = detectIndustryOverlays(prompt);
            overlayIds = Array.from(
              new Set([...(map?.overlayIds || []), ...detectedOverlays.slice(0, 2).map((o) => o.id)])
            );
            patternIds = Array.from(
              new Set([...(map?.patternIds || []), ...detectedOverlays.flatMap((o) => o.patternIds)])
            );
            const firstOverlay = getIndustryOverlayById(overlayIds[0]);
            businessCategory = firstOverlay ? firstOverlay.nama : matched?.template.nama;
          }
        }
      }

      const tier = detectTier({ patternIds });

      const session: MockupSessionState = {
        step: 'PAIN',
        match: {
          templateId,
          overlayIds,
          patternIds,
          tier: tier.tier,
          businessCategory,
          contextualPainPoints,
          contextualRoles
        },
        painPoints: { selected: [] },
        roles: { selected: [] },
        flow: {},
        features: { selected: [] }
      };

      const guidedStep = buildGuidedStep(session);
      const narration = await generateNarration(
        session,
        'START',
        guidedStep?.title,
        provider,
        userApiKey,
        userModel
      );

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

      let updated = applyGuidedAnswer(session, stepId, body.selected || [], body.other);

      // Recompute tier setelah peran dipilih
      if (stepId === 'ROLES') {
        const tier = detectTier({
          patternIds: updated.match.patternIds,
          roleCount: updated.roles.selected.length,
          selectedFeatureIds: updated.features.selected.map((f) => f.id)
        });
        updated = { ...updated, match: { ...updated.match, tier: tier.tier } };
      }

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

      const finalSession: MockupSessionState = { ...session, step: 'BRIEF_REVIEW' };
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
