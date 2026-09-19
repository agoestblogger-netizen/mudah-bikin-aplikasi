import { HYPERUI_THEME_BUNDLES } from './themeBundles';
import { HyperUIThemeId, ThemeRecommendationResult } from './types';
import { invokeAIChat, robustJsonParse } from '@/app/api/guided/route';

export interface ThemeClassifierInput {
  narrative?: string;
  domainName?: string;
  roles?: string[];
  flowSummary?: string;
  formulaList?: string[];
}

/**
 * Merekomendasikan 1 bundel tema HyperUI terbaik berdasarkan analisis semantik
 * terhadap nuansa narasi bisnis, alur operasional, dan karakter pengguna.
 */
export async function recommendThemeWithAI(
  input: ThemeClassifierInput,
  opts?: { provider?: string; apiKey?: string; model?: string }
): Promise<ThemeRecommendationResult> {
  const { narrative = '', domainName = '', roles = [], flowSummary = '', formulaList = [] } = input;

  const systemInstruction = `Anda adalah Art Director & UI/UX Design System Expert.
Tugas Anda: Menganalisis karakter psikologis, nuansa emosi, dan nada profesionalitas dari sebuah alur bisnis, lalu merekomendasikan TEPAT 1 bundel gaya visual antarmuka dari 6 pilihan bundel tema HyperUI berikut:

DAFTAR 6 BUNDEL TEMA HYPERUI YANG TERSEDIA:
1. "modern_minimalist" (Modern Minimalis)
   - Karakter: Garis bersih, pembatas slate tipis, latar putih lapang, aksen indigo netral.
   - Cocok untuk: Aplikasi operasional umum, ritel rapi, manajemen katalog, kursus/sekolah, perpustakaan, inventaris standar yang mengutamakan keterbacaan jernih dan ketenangan visual.

2. "corporate_formal" (Korporat Formal)
   - Karakter: Berbobot kokoh, header tabel kapital tracking-wide, warna biru navy-slate tegas, pembatas tebal, badge kontur berwibawa.
   - Cocok untuk: Lembaga keuangan, perbankan, koperasi simpan pinjam, firma hukum, kantor pemerintahan, administrasi legal, akuntansi resmi, dan audit yang menuntut kredibilitas tinggi dan disiplin struktur.

3. "sleek_dark" (Sleek Dark Mode)
   - Karakter: Latar zinc-950 gelap pekat, kontras tinggi, kartu berpendar aksen neon/cyan/indigo, tombol gelap modern.
   - Cocok untuk: Sistem analitik intensif, monitoring IT/server/IoT, crypto, gaming, developer tools, atau platform teknologi malam hari berkecepatan tinggi.

4. "warm_pastel" (Soft & Warm Pastel)
   - Karakter: Sudut tumpul membulat lapang (rounded-2xl), palet hangat amber/teal/stone lembut, tanpa sudut tajam, menenangkan.
   - Cocok untuk: Klinik kesehatan, dokter hewan / petshop, salon kecantikan, spa, daycare, penitipan anak, terapi, bakery/kafe hangat, atau layanan kepedulian yang mengedepankan empati dan kehangatan personal.

5. "playful_neobrutalism" (Playful Neobrutalism)
   - Karakter: Border hitam 2px tebal, bayangan kaku (hard box-shadow 4px tanpa blur), warna pop cerah (kuning/pink/cyan), sudut tegas.
   - Cocok untuk: Komunitas kreatif, studio seni/fotografi, clothing brand, persewaan/rental santai dan kasual, event organizer, atau bisnis berjiwa muda yang berani tampil menonjol dan ceria.

6. "vibrant_saas" (Vibrant SaaS & Indigo)
   - Karakter: Estetika platform digital modern Silicon Valley, navigasi pill kapsul di dalam container abu-abu, ring-1 subtle, gradasi violet-indigo dinamis.
   - Cocok untuk: Startup teknologi, SaaS berlangganan, booking online modern (barbershop modern, car detailing, laundry modern, coworking) yang ingin terkesan mutakhir dan lincah.

ATURAN REKOMENDASI:
- Analisis MAKNA dan RASA bahasa narasi, BUKAN pencocokan kata kunci kaku.
- Pilih TEPAT 1 ID tema dari: "modern_minimalist", "corporate_formal", "sleek_dark", "warm_pastel", "playful_neobrutalism", "vibrant_saas".
- Berikan penjelasan singkat (1-2 kalimat) yang ramah, sopan, dan meyakinkan kepada pengguna dalam Bahasa Indonesia mengenai ALASAN mengapa tema tersebut paling selaras dengan identitas bisnismu.

FORMAT OUTPUT HANYA JSON:
{
  "recommendedThemeId": "corporate_formal",
  "reason": "Alur bisnismu berfokus pada otorisasi kredit dan verifikasi keuangan formal, sehingga tema berstruktur tegas dan berwibawa ini paling tepat memberikan rasa aman dan kredibilitas bagi pengurus dan nasabah."
}`;

  const userPrompt = `Data Bisnis untuk Dianalisis:
- Nama/Domain: ${domainName || 'Aplikasi Operasional'}
- Peran Terlibat: ${roles.join(', ') || 'Admin, Pengguna'}
- Ringkasan Alur: ${flowSummary || '-'}
- Rumus/Biaya: ${formulaList.join(', ') || '-'}
- Narasi Lengkap:
${narrative}

Pilih 1 bundel tema terbaik dan berikan alasan semantiknya dalam format JSON.`;

  try {
    const raw = await invokeAIChat({
      systemInstruction,
      userPrompt,
      temperature: 0.15,
      maxTokens: 500,
      provider: opts?.provider,
      userApiKey: opts?.apiKey,
      userModel: opts?.model,
    });

    const parsed = robustJsonParse<any>(raw);
    if (parsed && parsed.recommendedThemeId && parsed.recommendedThemeId in HYPERUI_THEME_BUNDLES) {
      const bundle = HYPERUI_THEME_BUNDLES[parsed.recommendedThemeId as HyperUIThemeId];
      return {
        recommendedThemeId: bundle.id,
        themeName: bundle.name,
        reason: parsed.reason || `Selaras dengan nuansa dan karakter alur ${domainName || 'bisnismu'}.`,
        confidence: 0.95,
      };
    }
  } catch (err) {
    console.warn('[THEME-CLASSIFIER] Gagal rekomendasi tema via AI LLM, beralih ke penalaran semantik fallback:', err);
  }

  // Fallback penalaran semantik heuristik berbasis scoring nuansa makna
  return getSemanticFallbackRecommendation(input);
}

/**
 * Fallback penalaran semantik berbasis skor kemiripan nuansa
 * jika LLM tidak dapat dihubungi atau kehabisan kuota
 */
export function getSemanticFallbackRecommendation(input: ThemeClassifierInput): ThemeRecommendationResult {
  const corpus = [
    input.narrative || '',
    input.domainName || '',
    (input.roles || []).join(' '),
    input.flowSummary || '',
    (input.formulaList || []).join(' '),
  ].join(' ').toLowerCase();

  const scores: Record<HyperUIThemeId, number> = {
    corporate_formal: 0,
    warm_pastel: 0,
    playful_neobrutalism: 0,
    sleek_dark: 0,
    vibrant_saas: 0,
    modern_minimalist: 1, // baseline default
  };

  // 1. Corporate Formal signals
  if (/\b(koperasi|simpan\s*pinjam|pinjaman|bunga|tenor|plafon|pencairan|bank|keuangan|legal|hukum|pembukuan|audit|instansi|pemerintahan)\b/i.test(corpus)) {
    scores.corporate_formal += 4;
  }
  if (/\b(pengurus|ketua|bendahara|sekretaris|notaris|auditor)\b/i.test(corpus)) {
    scores.corporate_formal += 2;
  }

  // 2. Warm Pastel signals
  if (/\b(klinik|hewan|petshop|pet\s*care|\bpet\b|kucing|anjing|salon|\bspa\b|daycare|anak|bayi|kesehatan|pasien|perawat|terapis|kafe|kue|bakery)\b/i.test(corpus)) {
    scores.warm_pastel += 4;
  }
  if (/\b(ramah|hangat|peduli|perawatan|asuhan|lembut)\b/i.test(corpus)) {
    scores.warm_pastel += 2;
  }

  // 3. Playful Neobrutalism signals
  if (/\b(fotografi|kamera|studio|seni|desain|clothing|fashion|event|komunitas|muda|kreatif|persewaan|sepeda|rental)\b/i.test(corpus)) {
    scores.playful_neobrutalism += 4;
  }

  // 4. Sleek Dark signals
  if (/\b(dark|gaming|game|esport|server|developer|coding|crypto|blockchain|iot|cyber|monitoring\s*malam)\b/i.test(corpus)) {
    scores.sleek_dark += 5;
  }

  // 5. Vibrant SaaS signals
  if (/\b(saas|platform|langganan|subscription|barbershop|laundry|cuci|booking\s*online|reservasi)\b/i.test(corpus)) {
    scores.vibrant_saas += 4;
  }

  // Cari tema dengan skor tertinggi
  let bestThemeId: HyperUIThemeId = 'modern_minimalist';
  let highestScore = 0;

  for (const [id, score] of Object.entries(scores) as [HyperUIThemeId, number][]) {
    if (score > highestScore) {
      highestScore = score;
      bestThemeId = id;
    }
  }

  const bundle = HYPERUI_THEME_BUNDLES[bestThemeId];
  const reasons: Record<HyperUIThemeId, string> = {
    corporate_formal: 'Direkomendasikan karena alur bisnismu melibatkan proses administrasi, pencatatan keuangan, dan otorisasi yang mengutamakan struktur kokoh dan kredibilitas profesional.',
    warm_pastel: 'Direkomendasikan karena karakter layanan bisnismu mengedepankan sentuhan personal, empati, dan keramahan yang menenangkan.',
    playful_neobrutalism: 'Direkomendasikan karena identitas bisnismu berjiwa muda, dinamis, dan ekspresif dengan daya tarik visual yang berani.',
    sleek_dark: 'Direkomendasikan karena sistem aplikasi berkarakter teknologi tinggi dan analitik berfokus kontras tajam.',
    vibrant_saas: 'Direkomendasikan karena bisnismu mengadopsi model layanan modern dan lincah dengan estetika platform digital mutakhir.',
    modern_minimalist: 'Direkomendasikan karena memberikan tata letak bersih dan elegan yang mengutamakan kenyamanan membaca serta fokus pada data operasional.',
  };

  return {
    recommendedThemeId: bestThemeId,
    themeName: bundle.name,
    reason: reasons[bestThemeId],
    confidence: highestScore > 2 ? 0.85 : 0.7,
  };
}
