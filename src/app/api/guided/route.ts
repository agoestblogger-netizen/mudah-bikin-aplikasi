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
  DUAL_PROCESS_PATTERNS,
  REQUIRED_ROLE,
  type DomainFlowData,
  type GuidedStepId,
  type MockupSessionState,
  type AnalisisArahResult,
  type KondisiArahBisnis,
  type PemisahanRoleResult
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
    maxTokens = 4000,
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

  let activeGemini = isUserGemini ? userModel || DEFAULT_GEMINI_MODEL : process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  if (activeGemini === 'gemini-3.5-flash' || activeGemini === 'gemini-2.5-flash') {
    activeGemini = 'gemini-3.6-flash';
  }
  const openaiModel = hasUserKey
    ? userModel || (isOpenRouter ? OPENROUTER_DEFAULT_MODEL : DEFAULT_OPENAI_MODEL)
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
Tugas Anda: Menyambut ide pengguna dengan hangat, apresiatif, dan ramah, lalu merangkai cerita proses bisnis (2-4 kalimat) yang mengalir luwes, hidup, dan SANGAT SPESIFIK ke domain bisnis tersebut.

PANDUAN & ATURAN WAJIB (DIPATUHI KETAT):
0. ANALISIS KONSEPTUAL ARAH BISNIS (analisisArah - WAJIB):
   Analisis aktivitas frontliner / customer-facing dari permintaan pengguna untuk menyimpulkan salah satu dari tiga kondisi berikut:
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

1. OBJEK FISIK & AKTIVITAS SPESIFIK DOMAIN (WAJIB):
   - Cerita WAJIB menyebutkan minimal satu detail aktivitas atau objek fisik nyata yang spesifik ke domain bisnis yang diminta pengguna.
   - Contoh objek/aktivitas konkret:
     * Cuci mobil: selang air bertekanan, vakum interior, sabun salju, pengering chamois, plat nomor kendaraan, antrean slot cuci.
     * Klinik dokter gigi: dental chair (kursi periksa), rekam medis keluhan gigi/rongga mulut, alat rontgen/sterilisasi gigi, resep obat, jadwal penambalan/pembersihan karang gigi.
     * Laundry kiloan: timbangan digital cucian, pemilahan baju luntur/halus, mesin cuci/dryer, setrika uap, plastik packing wangi, nota kiloan.
     * Kafe / Bakery: racikan biji kopi espresso, display etalase kue/roti, tiket pesanan dapur, cetak struk kasir, meja barista.
     * Bengkel motor/mobil: estimasi sparepart/oli, montir mengecek mesin, nota servis berkala, riwayat kilometer kendaraan.
   - DILARANG KERAS menggunakan frasa generik lintas-industri seperti: "tim di lapangan", "aktivitas harian", "layanan pelanggan", "tim melayani secara teratur" tanpa detail konkret tambahan!

2. PERAN SPESIFIK & MANUSIAWI (asumsiAktor) BESERTA DETAIL PERAN (detailAktor):
   - asumsiAktor WAJIB berisi istilah pekerjaan konkret di lapangan sesuai domain (contoh untuk cuci mobil: "Super Admin", "Kasir Penerima Kendaraan", "Staf Cuci & Lap", "Pelanggan").
   - DILARANG memakai sebutan generik abstrak seperti "Staf Operasional", "Operator", "Pegawai", atau "Tim Lapangan".
   - Selalu sertakan "Super Admin" sebagai peran pemilik/pengelola tertinggi.
   - ATURAN GROUNDING & DEDUPLIKASI KONSEPTUAL (WAJIB):
     * Setiap peran dalam asumsiAktor HARUS memiliki dasar konseptual yang jelas dan terlibat langsung dalam alur narasi yang diceritakan. JANGAN memunculkan peran seperti "Operator", "Viewer", atau artefak teknis lain yang tidak ada di cerita!
     * Jika narasi hanya menceritakan satu peran staf frontliner yang sama yang melayani kedua arah (misal teller atau kasir), MAKA asumsiAktor HANYA BOLEH berisi 1 peran frontliner tersebut, DILARANG memunculkan peran duplikat/buatan yang fungsinya sama persis!
     * DILARANG memunculkan dua peran kasir semu seperti "Kasir Penjualan" dan "Kasir Pembelian" jika jenis keahlian keduanya sama persis (misal di money changer atau warung sembako). Gunakan SATU peran representatif (misal "Teller Valas" atau "Kasir Toko").
     * Format asumsiAktor WAJIB berupa array of string sederhana: ["Super Admin", "Peran Frontliner", "Pelanggan"]. DILARANG membuat format gabungan seperti ["Kasir (Sales & Pembelian)"]!

3. TAHAPAN ALUR UTAMA (asumsiAlurUtama):
   - Format: "Langkah 1 -> Langkah 2 -> Langkah 3 -> Langkah 4".
   - Tuliskan 3-5 tahapan konkret dari awal interaksi pelanggan sampai akhir proses.
   - DILARANG memakai kalimat umum seperti "Pelanggan memesan -> Petugas memproses -> Pemilik memantau".
   - Jika kondisi DUA_ARAH, alur utama WAJIB merangkum kedua siklus transaksi secara nyata dan berimbang.
     Contoh nyata Koperasi Simpan Pinjam: "Anggota menyetor tabungan & kasir mencatat saldo buku -> Anggota mengajukan pinjaman dana -> Petugas memverifikasi kelayakan & mencairkan dana pinjaman -> Anggota membayar cicilan berkala -> Pengurus memantau rekap simpan pinjam".

4. ATURAN SELF-CHECK EKSPLISIT (WAJIB):
   "Sebelum menampilkan cerita, cek apakah kalimat ini bisa dipakai untuk industri lain tanpa berubah signifikan selain nama aplikasi — kalau ya, tulis ulang dengan detail yang lebih spesifik ke domain yang diminta."

5. NADA HANGAT, BERSAHABAT, & TANPA ISTILAH TEKNIS:
   - Gunakan bahasa Indonesia percakapan yang santun, luwes, dan akrab layaknya rekan diskusi bisnis yang suportif.
   - DILARANG KERAS menggunakan kata teknis IT/software (seperti CRUD, database, API, backend, frontend, skema, tabel, sistem informasi, autentikasi, server). Ceritakan murni interaksi manusia dan barang nyata!

6. KALIMAT PENUTUP WAJIB:
   Akhiri narasi cerita DENGAN PERSIS KALIMAT INI:
   "${CONFIRMATION_CLOSING}"

7. FORMAT OUTPUT HANYA JSON VALID:
{
  "analisisArah": {
    "kondisi": "SATU_ARAH" | "DUA_ARAH" | "AMBIGU",
    "alasan": "Penjelasan konseptual mengapa dinilai satu arah, dua arah, atau ambigu",
    "duaArah": {
      "prosesA": "Nama proses transaksi keluar/penjualan/setoran (jika DUA_ARAH)",
      "prosesB": "Nama proses transaksi masuk/pembelian/pinjaman (jika DUA_ARAH)",
      "entitasBersama": "Objek/barang/dana utama yang terlibat",
      "pemisahanRole": {
        "keputusan": "PISAH" | "GABUNG",
        "alasan": "Alasan konseptual mengapa dipisah atau digabung",
        "roleKasusA": "Nama role frontliner kasus A (jika PISAH)",
        "roleKasusB": "Nama role frontliner kasus B (jika PISAH)"
      }
    },
    "klarifikasiAmbigu": {
      "pertanyaan": "Pertanyaan ramah memastikan fokus arah bisnis (jika AMBIGU)",
      "opsiA": "Arah bisnis A",
      "opsiB": "Arah bisnis B",
      "opsiBoth": "Dua-duanya (keterangan)"
    }
  },
  "appName": "Nama aplikasi kreatif & spesifik domain",
  "businessCategory": "Kategori industri konkret",
  "narasi": "2-4 kalimat cerita proses bisnis hangat yang menyebut aktivitas & objek fisik nyata domain ini. ${CONFIRMATION_CLOSING}",
  "asumsiMasalah": "Masalah operasional fisik/pencatatan nyata yang dihadapi",
  "asumsiAktor": ["Super Admin", "Peran Spesifik 1", "Peran Spesifik 2", "Pelanggan"],
  "asumsiAlurUtama": "Aktivitas nyata 1 -> Aktivitas nyata 2 -> Aktivitas nyata 3 -> Pemilik memantau rekap",
  "detailAktor": {
    "Super Admin": {
      "narasi": "Pemilik atau penanggung jawab utama operasional...",
      "tanggungJawab": ["Tanggung jawab konkret 1", "Tanggung jawab konkret 2", "Tanggung jawab konkret 3"]
    },
    "Peran Spesifik 1": {
      "narasi": "1-2 kalimat penjelasan peran yang digrounding langsung ke cerita nyata...",
      "tanggungJawab": ["Aktivitas konkret 1 dari cerita", "Aktivitas konkret 2 dari cerita", "Aktivitas konkret 3"]
    }
  }
}`;

  const raw = await invokeAIChat({
    systemInstruction,
    userPrompt: `Permintaan Pengguna: "${prompt}"\nAnalisis arah bisnis (SATU_ARAH, DUA_ARAH, atau AMBIGU) dan analisis pemisahan role frontliner jika DUA_ARAH, susun cerita proses bisnis yang hangat dan hidup memuat aktivitas konkret, lalu ekstrak field terstruktur:`,
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
          const kondisi: KondisiArahBisnis = (['SATU_ARAH', 'DUA_ARAH', 'AMBIGU'].includes(rawArah.kondisi)
            ? rawArah.kondisi
            : 'SATU_ARAH') as KondisiArahBisnis;

          let pemisahanRole: PemisahanRoleResult | undefined = undefined;
          if (rawArah.duaArah?.pemisahanRole && typeof rawArah.duaArah.pemisahanRole === 'object') {
            const rawPr = rawArah.duaArah.pemisahanRole;
            let finalKeputusan: 'PISAH' | 'GABUNG' = rawPr.keputusan === 'PISAH' ? 'PISAH' : 'GABUNG';
            let finalAlasan = String(rawPr.alasan || '').trim();
            let roleKasusA = rawPr.roleKasusA ? String(rawPr.roleKasusA).trim() : undefined;
            let roleKasusB = rawPr.roleKasusB ? String(rawPr.roleKasusB).trim() : undefined;

            // KONSEPTUAL GROUNDING SAFEGUARD (The Diagnostic Litmus Test):
            // 1. Spesialis Kategori Berisiko Tinggi (HP, motor, emas, laptop, kamera) -> WAJIB PISAH
            // 2. Toko Barang Bekas Campuran / Generalis (loak, perabotan campuran, barang antik) -> WAJIB GABUNG
            // 3. Administrasi Kasir Simetris (money changer, koperasi, agen bank, sembako) -> WAJIB GABUNG
            const domainScopeText = `${prompt} ${appName} ${businessCategory} ${rawArah.duaArah?.prosesA || ''} ${rawArah.duaArah?.prosesB || ''}`.toLowerCase();
            
            const isMixedOrGeneralistSecondhand = /\b(barang\s*bekas(\s*(campuran|umum|serba\s*ada))?|loak|loakan|barang\s*antik|pasar\s*barang\s*bekas|thrift\s*shop|rongsok)\b/i.test(domainScopeText);
            const isSpecificHighRiskSpecialist = !isMixedOrGeneralistSecondhand && /\b(hp|handphone|smartphone|gadget|laptop|komputer|pc|kamera|lensa|motor|mobil|kendaraan|emas|perhiasan|buyback)\b/i.test(domainScopeText);
            const isPureAdministrativeFinancialDomain = /\b(money\s*changer|valas|valuta|kurs|koperasi|simpan\s*pinjam|tabungan|ppob|agen\s*bank|sembako|kelontong|galon|gas)\b/i.test(domainScopeText);

            if (isSpecificHighRiskSpecialist && !isPureAdministrativeFinancialDomain) {
              finalKeputusan = 'PISAH';
              if (!finalAlasan.toLowerCase().includes('teknis') && !finalAlasan.toLowerCase().includes('diagnostik') && !finalAlasan.toLowerCase().includes('appraisal') && !finalAlasan.toLowerCase().includes('keahlian')) {
                finalAlasan = 'Penilaian fisik/fungsional barang bekas pada domain spesialis ini membutuhkan kompetensi dan alat diagnostik teknis khusus yang berbeda dari penjualan unit baru.';
              }
            } else if (isMixedOrGeneralistSecondhand) {
              finalKeputusan = 'GABUNG';
              finalAlasan = 'Toko menerima barang bekas campuran/umum dan tidak berfokus pada satu kategori barang teknis berisiko tinggi, sehingga penilaian kondisi barang bersifat kasat mata/umum dan dapat ditangani oleh staf toko multi-fungsi tanpa alat diagnostik khusus.';
              roleKasusA = undefined;
              roleKasusB = undefined;
            } else if (isPureAdministrativeFinancialDomain && !isSpecificHighRiskSpecialist) {
              finalKeputusan = 'GABUNG';
              finalAlasan = 'Transaksi kedua sisi merupakan alur administrasi/keuangan kasir simetris tanpa kebutuhan uji teknis/diagnostik fisik barang bekas, sehingga dapat dilayani oleh satu peran frontliner.';
              roleKasusA = undefined;
              roleKasusB = undefined;
            }

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
              pertanyaan: String(rawArah.klarifikasiAmbigu.pertanyaan || '').trim(),
              opsiA: String(rawArah.klarifikasiAmbigu.opsiA || '').trim(),
              opsiB: String(rawArah.klarifikasiAmbigu.opsiB || '').trim(),
              opsiBoth: String(rawArah.klarifikasiAmbigu.opsiBoth || '').trim()
            } : undefined
          };
        }

        // Safeguard integritas peran jika keputusan adalah GABUNG:
        // Pastikan tidak ada dua peran kasir semu yang terpisah arah di asumsiAktor
        if (analisisArah?.kondisi === 'DUA_ARAH' && analisisArah.duaArah?.pemisahanRole?.keputusan === 'GABUNG') {
          const staffRoles = asumsiAktor.filter(
            (r: string) => !/^(super\s*admin|pemilik|owner|pelanggan|penyewa|nasabah|anggota|pasien|konsumen)\b/i.test(r)
          );
          if (staffRoles.length >= 2) {
            const hasOppositeStaff =
              staffRoles.some((r: string) => /sales|kasir|jual|penjualan|setor|setoran|simpan/i.test(r)) &&
              staffRoles.some((r: string) => /beli|pembelian|tarik|penarikan|pinjam/i.test(r));
            if (hasOppositeStaff) {
              const lowerCat = `${businessCategory} ${appName} ${prompt}`.toLowerCase();
              const combinedStaffName =
                lowerCat.includes('valas') || lowerCat.includes('money')
                  ? 'Teller Valas'
                  : lowerCat.includes('bank') || lowerCat.includes('ppob')
                  ? 'Operator Loket'
                  : lowerCat.includes('bekas') || lowerCat.includes('loak') || lowerCat.includes('antik')
                  ? 'Staf Toko Barang Bekas'
                  : 'Kasir Operasional';

              const newAktor = asumsiAktor.filter((r: string) => !staffRoles.includes(r));
              newAktor.splice(1, 0, combinedStaffName);
              asumsiAktor.length = 0;
              asumsiAktor.push(...newAktor);

              if (detailAktor) {
                const combinedTasks: string[] = [];
                for (const sr of staffRoles) {
                  if (detailAktor[sr]) {
                    combinedTasks.push(...detailAktor[sr].tanggungJawab);
                    delete detailAktor[sr];
                  }
                }
                detailAktor[combinedStaffName] = {
                  narasi: `Staf frontliner yang melayani transaksi di ${businessCategory}.`,
                  tanggungJawab: Array.from(new Set(combinedTasks)).slice(0, 3)
                };
              }
            }
          }
        }

        return {
          appName,
          businessCategory,
          templateId: 'MT-20',
          overlayIds: [],
          patternIds: ['UP-06', 'UP-09'],
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

  // Fallback kontekstual berbasis kata kunci jika AI tidak merespons
  const cleanPrompt = prompt.trim();
  const lowerPrompt = cleanPrompt.toLowerCase();

  let fallbackAppName = `Aplikasi ${cleanPrompt.slice(0, 30)}`;
  let fallbackCategory = cleanPrompt.slice(0, 40) || 'Bisnis Anda';
  let fallbackNarasi = `Wah, ide yang menarik untuk ${cleanPrompt}! Mari kita rancang alur operasionalnya agar staf di tempat kerja dapat melayani setiap pesanan dengan rapi dan terdata dengan jelas, sementara kamu sebagai pemilik bisa memantau pemasukan harian kapan pun dengan tenang. ${CONFIRMATION_CLOSING}`;
  let fallbackAktor = ['Super Admin', 'Staf Kasir', 'Pelanggan'];
  let fallbackAlur = 'Pelanggan memesan -> Petugas memproses di lokasi -> Pembayaran tercatat -> Pemilik melihat rekap';
  let fallbackDetailAktor: Record<string, { narasi: string; tanggungJawab: string[] }> = {
    'Super Admin': {
      narasi: `Pemilik usaha atau penanggung jawab utama operasional ${fallbackCategory}. Memastikan alur kerja berjalan tertib dan memantau omzet harian.`,
      tanggungJawab: ['Memantau transaksi dan omzet harian', 'Mengelola staf dan hak akses akun', 'Mengatur pengaturan operasional aplikasi']
    }
  };

  if (lowerPrompt.includes('rental') || lowerPrompt.includes('sewa') || lowerPrompt.includes('rent car')) {
    fallbackAppName = 'RentCar Mandiri';
    fallbackCategory = 'Rental & Sewa Kendaraan';
    fallbackNarasi = `Wah, ide usaha rental kendaraan yang sangat prospektif! Bayangkan alur transaksinya nanti: petugas rental memeriksa ketersediaan armada, memverifikasi data identitas serta jaminan penyewa, lalu melakukan serah-terima kunci dan mengecek kondisi fisik armada bersama penyewa. Saat mobil dikembalikan, pemeriksaan bodi dan bahan bakar tercatat otomatis, sementara kamu sebagai pemilik bisa memantau jadwal armada aktif dan rekap omzet harian dengan tenang. ${CONFIRMATION_CLOSING}`;
    fallbackAktor = ['Super Admin', 'Petugas Rental', 'Sopir Armada', 'Penyewa'];
    fallbackAlur = 'Penyewa booking & verifikasi jaminan -> Petugas serah terima kunci & cek unit -> Pengembalian armada -> Pemilik pantau unit aktif & omzet';
    fallbackDetailAktor = {
      'Super Admin': {
        narasi: 'Pemilik usaha rental kendaraan yang memantau pergerakan armada, jadwal sewa aktif, dan pemasukan keuangan harian.',
        tanggungJawab: ['Memantau jadwal armada dan sewa aktif', 'Meninjau laporan omzet dan denda keterlambatan', 'Mengatur ketersediaan dan tarif armada']
      },
      'Petugas Rental': {
        narasi: 'Petugas garis depan yang memverifikasi dokumen persyaratan penyewa (SIM & KTP/jaminan), mengecek kondisi fisik dan kilometer armada, serta melakukan serah-terima kunci.',
        tanggungJawab: ['Memverifikasi dokumen identitas dan jaminan penyewa', 'Mencatat kondisi fisik dan kilometer awal-akhir mobil', 'Melakukan serah-terima kunci dan formulir sewa']
      },
      'Sopir Armada': {
        narasi: 'Pengemudi armada rental yang mendampingi dan mengantarkan penumpang dengan aman dan nyaman ke tempat tujuan sesuai kesepakatan perjalanan.',
        tanggungJawab: ['Mempersiapkan kendaraan dan mendampingi penumpang selama perjalanan', 'Mengemudikan unit secara aman sesuai rute kesepakatan pelanggan', 'Melaporkan status penyelesaian perjalanan dan kondisi kilometer armada']
      },
      'Penyewa': {
        narasi: 'Penyewa armada kendaraan lepas kunci atau dengan sopir yang memilih unit, menyerahkan dokumen persyaratan dan jaminan sewa, serta menikmati perjalanan.',
        tanggungJawab: ['Memilih armada kendaraan dan durasi waktu sewa', 'Menyerahkan dokumen identitas (SIM/KTP) dan jaminan', 'Melakukan pembayaran dan menerima serah-terima armada']
      }
    };
  } else if (lowerPrompt.includes('cuci') || (lowerPrompt.includes('mobil') && lowerPrompt.includes('cuci'))) {
    fallbackAppName = 'AutoShine Carwash';
    fallbackCategory = 'Jasa Cuci Kendaraan';
    fallbackNarasi = `Wah, ide usaha cuci kendaraan yang sangat prospektif! Bayangkan saat mobil pelanggan masuk ke area cuci: kasir mencatat plat nomor dan paket pembersihan yang dipilih, lalu tim cuci menyemprot bodi dengan air bertekanan dan memvakum jok hingga bersih kesat. Setelah mobil kinclong dan diserahkan ke pelanggan, kamu sebagai pemilik bisa langsung mengecek rekap jumlah kendaraan yang dicuci dan total omzet hari ini tanpa khawatir selisih. ${CONFIRMATION_CLOSING}`;
    fallbackAktor = ['Super Admin', 'Kasir Penerima Kendaraan', 'Staf Cuci & Vakum', 'Pelanggan'];
    fallbackAlur = 'Mobil datang dicatat kasir -> Staf cuci mencuci & memvakum interior -> Kasir terima pembayaran -> Pemilik pantau rekap harian';
  } else if (lowerPrompt.includes('gigi') || lowerPrompt.includes('dental') || lowerPrompt.includes('klinik')) {
    fallbackAppName = 'DentalCare Sehat';
    fallbackCategory = 'Klinik Dokter Gigi';
    fallbackNarasi = `Wah, ide klinik gigi yang mulia dan sangat dibutuhkan! Bayangkan alur prakteknya: resepsionis menyambut pasien dengan ramah dan mencatat keluhan serta riwayat gigi di meja depan, lalu dokter gigi melakukan pemeriksaan langsung di dental chair dengan alat yang sudah higienis. Pasien selesai berobat menerima resep dan kuitansi, sementara kamu sebagai pemilik klinik dapat meninjau jadwal kunjungan dan pendapatan harian dengan tenang. ${CONFIRMATION_CLOSING}`;
    fallbackAktor = ['Super Admin', 'Dokter Gigi', 'Resepsionis & Kasir', 'Pasien'];
    fallbackAlur = 'Pasien mendaftar di meja resepsionis -> Dokter periksa di dental chair -> Pembayaran & penyerahan obat -> Pemilik tinjau rekap pasien';
  } else if (lowerPrompt.includes('laundry') || lowerPrompt.includes('kiloan') || lowerPrompt.includes('cuci pakaian')) {
    fallbackAppName = 'FreshClean Laundry';
    fallbackCategory = 'Laundry Kiloan & Satuan';
    fallbackNarasi = `Wah, ide laundry yang sangat praktis dan dicari banyak orang! Bayangkan operasional hariannya: staf kasir menimbang tumpukan pakaian kotor pelanggan, memilah pakaian khusus, lalu mencetak nota estimasi selesai. Tim cuci memasukkan pakaian ke mesin cuci dan menyetrika uap hingga rapi berbungkus plastik wangi, sementara kamu sebagai pemilik bisa memantau berat cucian yang diproses serta omzet harian langsung dari ponsel. ${CONFIRMATION_CLOSING}`;
    fallbackAktor = ['Super Admin', 'Kasir Penerima Cucian', 'Staf Cuci & Setrika Uap', 'Pelanggan'];
    fallbackAlur = 'Pakaian ditimbang kasir -> Dicuci & disetrika uap rapi -> Pelanggan ambil cucian bersih -> Pemilik pantau total kiloan & omzet';
  } else if (lowerPrompt.includes('kafe') || lowerPrompt.includes('cafe') || lowerPrompt.includes('kopi') || lowerPrompt.includes('coffee')) {
    fallbackAppName = 'KopiNusantara Cafe';
    fallbackCategory = 'Kafe & Kedai Kopi';
    fallbackNarasi = `Wah, ide kafe dan kedai kopi yang sangat menarik! Bayangkan suasana tempatnya: kasir menyambut pelanggan dan mencatat pesanan menu kopi serta camilan, lalu barista meracik espresso segar dan menyajikannya ke meja pelanggan. Pesanan selesai langsung tercatat di sistem kasir, sementara kamu sebagai pemilik kafe bisa memantau menu terlaris dan rekap omzet harian dengan santai. ${CONFIRMATION_CLOSING}`;
    fallbackAktor = ['Super Admin', 'Barista & Dapur', 'Staf Kasir', 'Pelanggan'];
    fallbackAlur = 'Pelanggan pesan kopi -> Barista meracik pesanan -> Pembayaran di kasir -> Pemilik pantau omzet & menu terlaris';
    fallbackDetailAktor = {
      'Super Admin': {
        narasi: 'Pemilik usaha kafe yang memantau menu terlaris, stok bahan baku kopi, dan pemasukan keuangan harian.',
        tanggungJawab: ['Memantau laporan penjualan dan omzet harian', 'Mengatur ketersediaan bahan baku dan menu kafe', 'Mengelola staf kasir dan barista']
      },
      'Barista & Dapur': {
        narasi: 'Petugas peracik minuman dan makanan di kafe yang menyiapkan pesanan kopi espresso dan menu sesuai tiket pesanan pelanggan.',
        tanggungJawab: ['Menerima tiket pesanan minuman/makanan dari kasir', 'Meracik biji kopi dan menyajikan menu dengan standar rasa terbaik', 'Memeriksa kebersihan area mesin kopi dan perlengkapan bar']
      },
      'Staf Kasir': {
        narasi: 'Petugas meja depan kafe yang menyambut pelanggan, menginput pesanan kopi/makanan, dan memproses pembayaran transaksi.',
        tanggungJawab: ['Mencatat pilihan menu dan preferensi pesanan pelanggan', 'Menerima pembayaran tunai maupun nontunai (QRIS)', 'Mencetak struk pesanan untuk diteruskan ke meja barista']
      },
      'Pelanggan': {
        narasi: 'Pengunjung kafe yang memesan sajian kopi atau makanan, menikmati suasana kafe, serta menyelesaikan pembayaran.',
        tanggungJawab: ['Memilih menu minuman kopi dan makanan favorit', 'Melakukan pembayaran di kasir', 'Menikmati sajian pesanan di tempat atau bawa pulang']
      }
    };
  }

  return {
    appName: fallbackAppName,
    businessCategory: fallbackCategory,
    templateId: 'MT-20',
    overlayIds: [],
    patternIds: ['UP-06', 'UP-09'],
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

ATURAN WAJIB:
1. NADA HANGAT & BERSAHABAT: Tanggapi koreksi pengguna dengan positif, apresiatif, dan suportif.
2. DETAIL OBJEK & AKTIVITAS FISIK KONKRET:
   - Rangkai kembali cerita sehingga memasukkan poin koreksi pengguna secara alami dan memuat aktivitas/objek fisik nyata (bukan frasa generik seperti "tim lapangan" atau "layanan pelanggan").
3. PERAN DAN ALUR SPESIFIK:
   - asumsiAktor WAJIB mencantumkan nama pekerjaan nyata (contoh: "Staf Cuci & Lap", "Resepsionis", bukan "Staf Operasional"). Selalu sertakan "Super Admin".
   - asumsiAlurUtama WAJIB urutan aksi fisik nyata di lokasi kerja.
4. ATURAN SELF-CHECK EKSPLISIT:
   "Sebelum menampilkan cerita, cek apakah kalimat ini bisa dipakai untuk industri lain tanpa berubah signifikan selain nama aplikasi — kalau ya, tulis ulang dengan detail yang lebih spesifik ke domain yang diminta."
5. TANPA ISTILAH TEKNIS: DILARANG KERAS menggunakan istilah teknis IT/coding/database (seperti CRUD, database, API, tabel, skema, backend). Ceritakan alur aktivitas kerja nyata manusia!
6. KALIMAT PENUTUP WAJIB: Akhiri narasi cerita DENGAN PERSIS KALIMAT INI:
"${CONFIRMATION_CLOSING}"
7. PERBARUI FIELD DALAM FORMAT JSON:
{
  "narasi": "2-4 kalimat cerita terbaru yang hangat, memuat detail konkret, dan ditutup dengan kalimat konfirmasi wajib.",
  "asumsiMasalah": "Masalah utama yang diselesaikan",
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

      // 1. Sintesis Storyline & Analisis Konseptual Arah Bisnis MURNI AI (POIN 2 & Instruksi Revisi)
      const storylineResult = await generateStorylineWithAI(
        prompt,
        provider,
        userApiKey,
        userModel
      );

      const analisis = storylineResult.analisisArah;

      // KONDISI 3: AMBIGU — Permintaan terlalu singkat/umum menurut AI, tampilkan kartu klarifikasi sebelum narasi difinalkan
      if (analisis && analisis.kondisi === 'AMBIGU' && analisis.klarifikasiAmbigu) {
        const amb = analisis.klarifikasiAmbigu;
        const pendingSession: MockupSessionState = {
          step: 'STORYTELLING',
          match: {
            templateId: storylineResult.templateId || 'MT-20',
            overlayIds: storylineResult.overlayIds || [],
            patternIds: storylineResult.patternIds || ['UP-06', 'UP-09'],
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

        const clarificationNarration =
          `Halo! Ide aplikasi bisnismu sangat menarik.\n\n` +
          `Sebelum kita susun alur cerita proses bisnisnya, ada satu hal penting yang perlu dipastikan:\n\n` +
          `> ❓ **${amb.pertanyaan}**\n\n` +
          `Silakan pilih arah bisnis di kartu bawah agar narasi yang saya susun langsung tepat sasaran.`;

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

      // Khusus step STORYTELLING: proses klarifikasi arah bisnis, konfirmasi, koreksi kecil, atau meleset jauh (POIN 2)
      if (stepId === 'STORYTELLING') {
        const selected = body.selected || [];
        const other = (body.other || '').trim();

        // Sub-handler: Jawaban klarifikasi arah bisnis sebelum narasi dibuat
        if (session.storyline?.pendingDirectionClarification) {
          const { originalPrompt, opsiA, opsiB, nameA, nameB } = session.storyline.pendingDirectionClarification;
          const choice = selected[0] || 'dir_both';

          let enrichedPrompt = originalPrompt;
          let isBoth = choice === 'dir_both';

          const labelA = nameA || opsiA || 'Arah Bisnis A';
          const labelB = nameB || opsiB || 'Arah Bisnis B';

          if (choice === 'dir_A_only') {
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
          const geminiKey =
            provider === 'gemini' && userApiKey && userApiKey.trim()
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
          const patternIds = storylineResult.patternIds || ['UP-06', 'UP-09'];
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

        const existingStory = session.storyline || {
          narasi: '',
          asumsiMasalah: '',
          asumsiAktor: session.match.contextualRoles || ['Super Admin', 'Staf', 'Pelanggan'],
          asumsiAlurUtama: '',
          statusKonfirmasi: 'disetujui',
          revisiCount: 0
        };

        const isMismatch =
          selected.includes('mismatch_story') ||
          (Boolean(other) && /meleset\s*jauh|salah\s*(semua|total)|bukan\s*begitu|keliru\s*total/i.test(other));

        const isConfirm =
          selected.includes('confirm_story') ||
          (!other && selected.length === 0 && !selected.includes('minor_adjust') && !isMismatch) ||
          (Boolean(other) && !selected.includes('minor_adjust') && !isMismatch && /^(ya|oke|ok|sudah|pas|lanjut|benar|betul|sesuai|setuju|mantap|sip)\b/i.test(other));

        const isMinorAdjust =
          selected.includes('minor_adjust') ||
          (Boolean(other) && !isConfirm && !isMismatch);

        const currentRevisi = existingStory.revisiCount || 0;

        // 1. Mismatch Jauh ("Meleset jauh dari proses bisnis saya")
        if (isMismatch) {
          if (currentRevisi >= 2) {
            // Batas 2 kali koreksi tercapai: lanjut ke ROLE dengan catatan
            const updated: MockupSessionState = {
              ...session,
              step: 'ROLE',
              storyline: {
                ...existingStory,
                statusKonfirmasi: 'dikoreksi',
                modeKlarifikasiBertahap: false,
                revisiCount: currentRevisi
              }
            };
            const guidedStep = buildGuidedStep(updated);
            const narration =
              'Siap, kita simpan pemahaman proses bisnis sejauh ini dan lanjut dulu ke penentuan peran ya. Tenang saja, kamu masih bisa mengoreksi lagi nanti pas melihat detail di bagian berikutnya!\n\nOwner di sini berperan sebagai Super Admin — pemegang akses tertinggi di aplikasi. Sekarang, yuk kita pilih siapa saja pengguna yang akan mengoperasikan aplikasi ini:';
            return NextResponse.json({
              success: true,
              action,
              session: updated,
              guidedStep,
              narration
            });
          } else {
            // Masuk ke pertanyaan bertahap satu per satu
            const nextRevisi = currentRevisi + 1;
            const updated: MockupSessionState = {
              ...session,
              step: 'STORYTELLING',
              storyline: {
                ...existingStory,
                statusKonfirmasi: 'dikoreksi',
                modeKlarifikasiBertahap: true,
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

        // 2. Jika sebelumnya dalam mode klarifikasi bertahap (mismatch) dan user memberikan jawaban
        if (existingStory.modeKlarifikasiBertahap && !isConfirm) {
          if (currentRevisi >= 2) {
            // Batas 2 kali koreksi tercapai -> lanjut ke ROLE
            const updated: MockupSessionState = {
              ...session,
              step: 'ROLE',
              storyline: {
                ...existingStory,
                statusKonfirmasi: 'dikoreksi',
                modeKlarifikasiBertahap: false,
                revisiCount: currentRevisi
              }
            };
            const guidedStep = buildGuidedStep(updated);
            const narration =
              'Siap, kita simpan pemahaman proses bisnis sejauh ini dan lanjut dulu ke penentuan peran ya. Tenang saja, kamu masih bisa mengoreksi lagi nanti pas melihat detail di bagian berikutnya!\n\nOwner di sini berperan sebagai Super Admin — pemegang akses tertinggi di aplikasi. Sekarang, yuk kita pilih siapa saja pengguna yang akan mengoperasikan aplikasi ini:';
            return NextResponse.json({
              success: true,
              action,
              session: updated,
              guidedStep,
              narration
            });
          }

          const feedback = other || selected.join(', ');
          const refined = await refineStorylineWithAI(
            existingStory,
            feedback,
            true,
            provider,
            userApiKey,
            userModel
          );
          let newNarasi = refined.narasi.trim();
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
              revisiCount: currentRevisi
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

        // 3. Ada koreksi / catatan alur ("minor_adjust"): perbarui narasi & TAMPILKAN ULANG di STORYTELLING
        if (isMinorAdjust) {
          if (currentRevisi >= 2) {
            // Batas 2 kali koreksi tercapai: lanjut ke ROLE dengan catatan
            const updated: MockupSessionState = {
              ...session,
              step: 'ROLE',
              storyline: {
                ...existingStory,
                statusKonfirmasi: 'dikoreksi',
                modeKlarifikasiBertahap: false,
                revisiCount: currentRevisi
              }
            };
            const guidedStep = buildGuidedStep(updated);
            const narration =
              'Siap, kita simpan pemahaman proses bisnis sejauh ini dan lanjut dulu ke penentuan peran ya. Tenang saja, kamu masih bisa mengoreksi lagi nanti pas melihat detail di bagian berikutnya!\n\nOwner di sini berperan sebagai Super Admin — pemegang akses tertinggi di aplikasi. Sekarang, yuk kita pilih siapa saja pengguna yang akan mengoperasikan aplikasi ini:';
            return NextResponse.json({
              success: true,
              action,
              session: updated,
              guidedStep,
              narration
            });
          }

          // Belum mencapai batas: susun ulang narasi dan TAMPILKAN ULANG ke user di step STORYTELLING
          const nextRevisi = currentRevisi + 1;
          const feedback = other || selected.join(', ');
          const refined = await refineStorylineWithAI(
            existingStory,
            feedback,
            false,
            provider,
            userApiKey,
            userModel
          );
          let newNarasi = refined.narasi.trim();
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
              revisiCount: nextRevisi
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

        // 4. Konfirmasi langsung ("Sudah sesuai, lanjut ke Role") -> lanjut ke ROLE
        const updated: MockupSessionState = {
          ...session,
          step: 'ROLE',
          storyline: {
            ...existingStory,
            statusKonfirmasi: 'disetujui',
            modeKlarifikasiBertahap: false
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

        // Kalimat konfirmasi eksplisit jika ada role tambahan yang dihapus (POIN 3)
        const removalMessages: string[] = [];
        if (updated.roles.tugasDilimpahkan && updated.roles.tugasDilimpahkan.length > 0) {
          for (const d of updated.roles.tugasDilimpahkan) {
            removalMessages.push(
              `Oke, role ${d.dariRole} dihapus. Berarti tugas (${d.daftarTugas.join(', ')}) otomatis jadi tanggung jawab Owner ya — kalau mau dilimpahkan ke role lain, tinggal bilang saja.`
            );
          }
        }

        // Tampilkan alur sistem langsung poin bernomor tanpa narasi pembuka tambahan (POIN 4)
        const flowData = getDomainFlowDetails(updated);

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

        let narration = '';
        if (removalMessages.length > 0) {
          narration += removalMessages.join('\n\n') + '\n\n';
        }
        narration += `Berikut tabel ringkasan peran yang sudah disepakati:\n\n${summaryTable}\n\n`;

        if (reconciled && reconMsg) {
          narration += `> ℹ️ *${reconMsg}*\n\n`;
        }

        // Jika user sebelumnya sudah memilih "Dua-duanya" saat klarifikasi arah di STORYTELLING,
        // LANGSUNG proses sebagai kasus ganda TANPA bertanya ulang (POIN 4 instruksi user)
        if (updated.flow?.dualFlowPreDecided) {
          const processA = updated.flow?.dualProcessNames?.processA || 'Penjualan ke Pelanggan';
          const processB = updated.flow?.dualProcessNames?.processB || 'Pembelian dari Pelanggan';
          const kasusGanda = buildKasusGandaFromSession(updated, processA, processB);

          const updatedWithKasus: MockupSessionState = {
            ...updated,
            step: 'ALUR',
            flow: {
              ...updated.flow,
              kasusGanda,
              alurInti: []
            }
          };

          const flowDataForReconcile: DomainFlowData = {
            ...flowData,
            kasusGanda
          };
          const { updatedSession: reconSession, reconciled: reconPre, message: reconMsgPre } =
            reconcileCoreOperationalRole(updatedWithKasus, flowDataForReconcile);

          const finalSession: MockupSessionState = {
            ...reconSession,
            flow: {
              ...reconSession.flow,
              alurPendukung: flowData.alurPendukung.map((ap) => ({ nama: ap.nama, steps: ap.steps })),
              fiturPendukung: flowData.fiturPendukung.map((fp) => fp.label)
            }
          };

          const dualFlowData: DomainFlowData = {
            ...flowData,
            kasusGanda
          };
          const flowMarkdownDual = renderFlowMarkdown(dualFlowData);
          const guidedStepDual = buildGuidedStep(finalSession);

          let dualNarration = '';
          if (removalMessages.length > 0) {
            dualNarration += removalMessages.join('\n\n') + '\n\n';
          }
          dualNarration += `Berikut tabel ringkasan peran yang sudah disepakati:\n\n${summaryTable}\n\n`;
          if (reconPre && reconMsgPre) {
            dualNarration += `> ℹ️ *${reconMsgPre}*\n\n`;
          }
          dualNarration +=
            `Sesuai pilihanmu di awal (menangani dua arah bisnis), kedua proses langsung dipisahkan menjadi alur mandiri masing-masing:\n\n` +
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
          (Boolean(otherText) && /^(ya|oke|ok|sudah|pas|lanjut|benar|betul|sesuai|setuju|mantap|sip)\b/i.test(otherText));

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
