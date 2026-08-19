import { NextResponse } from 'next/server';
import { validateAndRepairGeneratedCode } from '@/lib/codeValidator';
import { checkRateLimit } from '@/lib/rateLimiter';
import {
  getConciseCatalogSummary,
  detectMatchingMasterTemplate,
  formatTemplateContextForIdeation,
  detectSelectivePageTemplates,
  formatSelectivePageTemplatesForCodeGen,
  findRelevantUXPatterns,
  formatUXGuidanceForIdeation
} from '@/lib/templates';

// =============================================================================
// KONFIGURASI MODEL AI TERPUSAT (Single Source of Truth)
// =============================================================================
export const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash';
export const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';



export const getGeminiModel = (): string => process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
export const getOpenAIModel = (): string => process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL;

export const maxDuration = 300; // 300 detik (5 menit) dengan Vercel Fluid Compute

// Helper: Memverifikasi apakah output kode AI terpotong atau mengalami syntax error di titik potong
function isCodeTruncatedOrBroken(text: string): boolean {
  if (!text) return true;

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

  // 3. Ekstrak HTML dan verifikasi sintaks JS di dalam <script>
  const match = text.match(/```html([\s\S]*?)```/);
  const htmlContent = match ? match[1] : (text.includes('<!DOCTYPE') ? text : '');
  if (htmlContent) {
    const scriptMatches = htmlContent.match(/<script[\s\S]*?>([\s\S]*?)<\/script>/gi);
    if (scriptMatches) {
      for (const s of scriptMatches) {
        const cleanJs = s.replace(/<\/?script[\s\S]*?>/gi, '').trim();
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

export async function POST(req: Request) {
  try {
    // 1. Rate Limiting Check (PRD Bagian 10)
    const forwardedFor = req.headers.get('x-forwarded-for');
    const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1';
    const rateLimit = checkRateLimit(clientIp);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Batas kuota request tercapai (${clientIp}). Mohon tunggu ${rateLimit.resetInSeconds} detik sebelum mencoba kembali.`
        },
        { status: 429 }
      );
    }

    const { prompt, chatHistory, stage, currentCode } = await req.json();

    // Analisis Riwayat & Konteks Percakapan Tahap 1
    const allHistoryText = (chatHistory || []).map((m: any) => m.text).join('\n');
    const hasBriefPresented = allHistoryText.includes('Brief Kebutuhan') || (allHistoryText.includes('Nama App:') && allHistoryText.includes('Fitur Utama (V1)'));
    
    // Deteksi Persetujuan/Konfirmasi Pengguna terhadap Brief Kebutuhan atau Eksekusi Revisi
    const isConfirmationApproval = /(^|\b)(ok|oke|sip|setuju|lanjut|lanjutkan|siap|deal|sudah sesuai|sesuai|buatkan|buatkan sekarang|bikin sekarang|gas|kerjakan|terapkan|eksekusi|ganti sekarang|ubah sekarang|update sekarang)($|\b)/i.test(prompt.trim());
    
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

    // Deteksi Apakah Prompt Awal Pengguna BENAR-BENAR SANGAT DETAIL:
    // WAJIB panjang > 200 karakter DAN secara eksplisit merinci target peran/user/masalah DAN daftar fitur/alur secara bersamaan.
    const isVeryDetailedInitialPrompt = prompt.length > 200 && (
      (prompt.toLowerCase().includes('target') || prompt.toLowerCase().includes('user') || prompt.toLowerCase().includes('pengguna') || prompt.toLowerCase().includes('pasien') || prompt.toLowerCase().includes('petugas') || prompt.toLowerCase().includes('admin') || prompt.toLowerCase().includes('masalah')) &&
      (prompt.toLowerCase().includes('fitur') || prompt.toLowerCase().includes('alur') || prompt.toLowerCase().includes('menu') || prompt.toLowerCase().includes('tabel') || prompt.toLowerCase().includes('layanan'))
    );
    const userMessageCount = (chatHistory || []).filter((m: any) => m.sender === 'USER').length;

    // Deteksi Persetujuan Ringkas Pengguna terhadap Usulan Konsultan di Tahap Diskusi
    const isUserAgreeingToProposal = /(^|\b)(ya|iya|sudah|pas|cocok|setuju|ok|oke|sip|lanjut|bisa|sesuai|siap|cukup|ikut saja|terserah|sop|standar|buatkan|buatkan brief|rangkum)($|\b)/i.test(prompt.trim());

    // Kapan masuk Mode Dialog/Streaming (Bukan eksekusi kode langsung):
    // 1. Tahap 1 Ideation (belum ada kode & belum konfirmasi)
    // 2. ATAU Tahap Revisi (sudah ada kode) TETAPI ada Pertanyaan Eksplisit atau Revisi Signifikan yang belum disetujui untuk dieksekusi (Poin 38)
    const isIdeationMode = (
      ((stage === 'TAHAP_1_PEMBUKAAN' || !currentCode) && !(hasBriefPresented && isConfirmationApproval)) ||
      (Boolean(currentCode) && isSignificantRevision && !isConfirmationApproval)
    );

    // Alokasi budget token streaming ideation yang universal, aman, & anti-terpotong:
    // Dalam protokol SSE streaming, max_completion_tokens adalah batas atas (ceiling).
    // Pesan eksplorasi pendek (2-4 kalimat) tetap selesai instan (< 1.6s TTFT), sementara lembar Brief Kebutuhan multi-role
    // mendapatkan ruang yang leluasa hingga 3584 tokens tanpa risiko terpotong di tengah jalan.
    const ideationMaxTokens = 3584;

    // Pencocokan Blueprint Master Template (Fase B)
    const matchedMT = detectMatchingMasterTemplate(prompt + '\n' + allHistoryText);
    const catalogSummary = getConciseCatalogSummary();
    const blueprintContext = matchedMT ? formatTemplateContextForIdeation(matchedMT) : '';

    // Pencocokan UX Pattern Registry (Fase D-1)
    const matchedUXPatterns = findRelevantUXPatterns(prompt + '\n' + allHistoryText, matchedMT?.template.id);
    const uxGuidanceContext = formatUXGuidanceForIdeation(matchedUXPatterns);

    let systemPrompt = '';

    if (isIdeationMode) {
      if (Boolean(currentCode) && isSignificantRevision && !isConfirmationApproval) {
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
Tugas Anda: Memperbarui lembar "Brief Kebutuhan" berdasarkan revisi kecil dari pengguna dan meminta konfirmasi ulang.

ATURAN MUTLAK PERCAKAPAN:
1. DILARANG KERAS menghasilkan blok kode HTML, CSS, JavaScript, atau blok \`\`\`html ... \`\`\`!
2. DILARANG KERAS menyebutkan kata "kode HTML", "generate kode", "fitur CRUD", "data dummy", "syntax error", atau janji teknis apa pun!
3. Akui revisi pengguna dengan ramah (1-2 kalimat), lalu tampilkan kembali lembar "Brief Kebutuhan" yang telah diperbarui dengan format PERSIS:
   📋 **Brief Kebutuhan**
   - **Nama App**: [nama aplikasi]
   - **Orientasi UI**: [Desktop-first / Mobile-first / Responsif, dengan alasan singkat]
   - **Tema Visual**: [deskripsi warna, gaya, kesan yang diinginkan]
   - **Fitur Utama (V1)**: [daftar bernomor, ringkas per fitur]
   - **Roadmap Lanjutan (V2/V3)**: [fitur yang didorong ke "🚀 Coming Soon" karena di luar kemampuan stack Google Sheets + Apps Script]
   - **Fitur Unik (USP)**: [kalau ada, opsional]
   - **Job Description & Struktur Halaman per Role** (WAJIB dideklarasikan rinci per halaman & section jika ada 2+ role; cantumkan mekanisme akses: Login simulasi akun demo untuk role internal & Akses Publik untuk pelanggan/pasien jika ada; kosongkan jika single-user):
     * **[Nama Role 1 — misal: Admin]**:
       - [Halaman 1] (default): section [Section A], section [Section B]
       - [Halaman 2]: section [Section C], section [Section D]
       - **Alur Proses**: Klik "[Nama Tombol Aksi]" → data/status berubah jadi "[Nilai Konkret]" → Klik "[Tombol Berikutnya]" → status berubah jadi "[Nilai Akhir]" (sebutkan nama tombol pakai tanda kutip; sebutkan nilai status konkret; maks 4-6 langkah)
     * **[Nama Role 2 — misal: Kasir]**:
       - [Halaman 1] (default): section [Section A], section [Section B]
       - [Halaman 2]: section [Section C]
       - **Alur Proses**: Klik "[Nama Tombol]" → [perubahan konkret di layar] → Klik "[Tombol Konfirmasi]" → status berubah jadi "[Nilai Akhir]"
     * **[Nama Role 3 — misal: Petugas / Washer]**:
       - [Halaman 1] (default): section [Section A], section [Section B]
       - **Alur Proses**: Klik "[Nama Tombol]" → status berubah jadi "[Nilai Konkret]" → [konsekuensi yang terlihat di layar] (role read-only/pasif: kalau ada langkah menunggu, tulis sebagai konsekuensi aksi role lain — misal: "saat [Role Lain] klik X, status nomor ini berubah jadi Y")
4. Tanyakan konfirmasi eksplisit di baris terakhir:
   "Apakah lembar Brief Kebutuhan yang diperbarui ini sudah sesuai, atau masih ada detail/section yang ingin diubah sebelum saya buatkan prototipenya?"`;
      } else if (isVeryDetailedInitialPrompt || userMessageCount >= 2 || (userMessageCount >= 1 && isUserAgreeingToProposal)) {
        // KONDISI 3: PROMPT AWAL SANGAT DETAIL (>200 chars) ATAU DISKUSI SUDAH 2+ PUTARAN / USER MENYETUJUI USULAN -> RANGKUM KE BRIEF KEBUTUHAN + SESI KONFIRMASI
        systemPrompt = `Anda adalah Konsultan Aplikasi AI dari platform "Mudah Bikin Aplikasi".
Tugas Anda: Merangkum kebutuhan aplikasi yang sudah disepakati menjadi lembar resmi "Brief Kebutuhan" dan meminta konfirmasi sebelum pembuatan prototipe.


ATURAN MUTLAK PERCAKAPAN:
1. DILARANG KERAS menghasilkan blok kode HTML, CSS, JavaScript, atau blok \`\`\`html ... \`\`\`!
2. DILARANG KERAS menyebutkan kata "kode HTML", "generate kode", "fitur CRUD", "data dummy", "syntax error", atau janji teknis apa pun!
3. Berikan apresiasi singkat dalam bahasa yang ramah (1-2 kalimat), lalu tampilkan lembar "Brief Kebutuhan" (JANGAN PERNAH gunakan kata "PRD") dengan format PERSIS:
   📋 **Brief Kebutuhan**
   - **Nama App**: [nama aplikasi yang menarik & relevan]
   - **Orientasi UI**: [Desktop-first / Mobile-first / Responsif, dengan alasan singkat]
   - **Tema Visual**: [deskripsi warna, gaya modern, dan kesan visual]
   - **Fitur Utama (V1)**: [daftar bernomor ringkas per fitur inti yang disepakati]
   - **Roadmap Lanjutan (V2/V3)**: [daftar fitur yang didorong ke "🚀 Coming Soon" karena di luar batasan stack GAS]
   - **Fitur Unik (USP)**: [keunikan aplikasi, jika ada]
   - **Job Description & Struktur Halaman per Role** (WAJIB dideklarasikan rinci per halaman & section jika ada 2+ role; cantumkan mekanisme akses: Login simulasi akun demo untuk role internal & Akses Publik untuk pelanggan/pasien jika ada; kosongkan jika single-user):
     * **[Nama Role 1 — misal: Admin]**:
       - [Halaman/Tab 1] (default): section [Nama Section 1], section [Nama Section 2]
       - [Halaman/Tab 2]: section [Nama Section 3], section [Nama Section 4]
       - **Alur Proses**: Klik "[Nama Tombol Aksi]" → [data/status berubah jadi "Nilai Konkret"] → Klik "[Tombol Berikutnya]" → status berubah jadi "[Nilai Akhir]" (WAJIB: nama tombol pakai tanda kutip, nilai status konkret, turunkan dari workflow bisnis nyata; maks 4-6 langkah)
     * **[Nama Role 2 — misal: Kasir]**:
       - [Halaman/Tab 1] (default): section [Nama Section 1], section [Nama Section 2]
       - [Halaman/Tab 2]: section [Nama Section 3]
       - **Alur Proses**: Klik "[Nama Tombol]" → [perubahan konkret di layar, misal: item muncul di daftar] → Klik "[Tombol Konfirmasi]" → status berubah jadi "[Nilai Akhir]"
     * **[Nama Role 3 — misal: Petugas / Washer]**:
       - [Halaman/Tab 1] (default): section [Nama Section 1], section [Nama Section 2]
       - **Alur Proses**: Klik "[Nama Tombol]" → status berubah jadi "[Nilai Konkret]" → [konsekuensi terlihat di layar] (langkah menunggu pasif JANGAN ditulis sebagai aksi — tulis sebagai konsekuensi: "saat [Role Lain] klik X, status item ini berubah jadi Y")
4. WAJIB tanyakan konfirmasi di baris terakhir:
   "Apakah Brief Kebutuhan di atas sudah sesuai dengan yang Anda inginkan, atau ada section/fitur yang mau ditambah/diubah sebelum saya buatkan prototipenya?"`;
      } else {
        // KONDISI 4: PROMPT AWAL SINGKAT / VAGUE (contoh: "aplikasi laundry" atau "ingin buat aplikasi klinik")
        systemPrompt = `Anda adalah Konsultan Aplikasi AI dari platform "Mudah Bikin Aplikasi".
Tugas Anda pada tahap ini adalah mendiskusikan, menggali, dan mempertajam ide aplikasi bersama pengguna (Sub-langkah 1-4 Eksplorasi Ide).

ATURAN MUTLAK PERCAKAPAN (WAJIB DIPATUHI):
1. DILARANG KERAS menghasilkan blok kode HTML, CSS, JavaScript, atau blok \`\`\`html ... \`\`\`!
2. DILARANG KERAS menyebutkan kata-kata teknis seperti "saya akan berikan kode HTML", "generate kode", "fitur CRUD", "data dummy", "syntax error", atau janji teknis apa pun tentang pembuatan kode!
3. NADA KOMUNIKASI WAJIB: BERIKAN USULAN KONKRET DULU, JANGAN PERNAH MELEMPAR BEBAN BERPIKIR KE USER!
   - DILARANG bertanya dengan nada pasif atau kata-kata terbuka seperti "apakah sudah Anda pikirkan/pertimbangkan?", "bagaimana konsep yang Anda inginkan?", atau "apa fitur yang ingin dibuat?".
   - Karena Anda sudah memiliki acuan struktur modul & peran dari blueprint bisnis, Anda WAJIB langsung MENGUSULKAN pembagian peran dan fitur operasional secara konkret dan singkat (2-4 kalimat).
   - Format Respons Standar:
     * Kalimat 1: Sapa & akui ide bisnis pengguna dengan hangat & antusias.
     * Kalimat 2-3 (USULAN KONKRET): Usulkan peran default beserta tugas/halaman utamanya (contoh: "Untuk aplikasi laundry, biasanya paling pas dibagi ke 3 peran: Admin (pantau omset & kelola tarif), Kasir (terima pesanan & proses pembayaran), dan Washer (update status cucian hingga siap ambil).")
     * Kalimat 4 (KONFIRMASI RINGAN): Akhiri dengan 1 pertanyaan persetujuan ringan (contoh: "Pembagian peran dan alur kerja ini sudah cukup pas untuk usaha Anda, atau ada peran/penyesuaian lain yang ingin ditambahkan?")
4. JANGAN tampilkan form Brief Kebutuhan dan JANGAN buat kode di giliran ini.`;
      }

      // Suntikkan blueprint terstruktur atau ringkasan katalog internal untuk memandu dialog
      if (blueprintContext) {
        systemPrompt += `\n\n${blueprintContext}`;
      } else {
        systemPrompt += `\n\n=== KATALOG RINGKAS 20 BLUEPRINT INDUSTRI (PANDUAN REFERENSI INTERNAL) ===\n${catalogSummary}\n\nJika ide pengguna mendekati salah satu pola bisnis di atas, gunakan struktur modul dan alur kerja standar yang relevan. Jika tidak ada kecocokan, diskusikan kebutuhan kustom pengguna secara luwes dan terstruktur tanpa memaksakan template.`;
      }

      // Suntikkan Panduan Standar UX & Prioritas Informasi (Fase D-1)
      if (uxGuidanceContext) {
        systemPrompt += `\n\n${uxGuidanceContext}`;
      }
    } else {
      // MODE GENERATE KODE (User sudah menyetujui Brief Kebutuhan / Tahap 2 Mockup / Tahap 5 Patch / Tahap 6)
      systemPrompt = `Anda adalah AI Generator Aplikasi dari platform "Mudah Bikin Aplikasi" (Basic Tier / MVP).
Tugas Anda adalah memandu pengguna non-programmer melalui seluruh siklus hidup pembuatan aplikasi web fungsional.

PRINSIP TERVALIDASI WAJIB (FR-03, NFR-10, NFR-10b):
1. ARSITEKTUR STATE & DATA AWAL WAJIB (DILARANG ARRAY KOSONG): Variabel state array DILARANG KERAS diinisialisasi kosong (misal: \`let items = [];\`). State WAJIB langsung memiliki 3-5 item dummy contoh realistis lengkap (contoh: \`let items = [{ id: '1', nama: 'Kopi Susu', kategori: 'Minuman', harga: 15000 }, { id: '2', nama: 'Roti Bakar', kategori: 'Makanan', harga: 12000 }, { id: '3', nama: 'Teh Manis', kategori: 'Minuman', harga: 6000 }];\`). Selalu render tampilan melalui fungsi \`render()\`.
2. FUNGSIONAL PENUH PADA SETIAP TITIK RILIS / REVISI: Tombol aksi (Tambah, Edit, Hapus) WAJIB berfungsi nyata memanipulasi array state di memori dan memanggil \`render()\` di baris terakhir. Tipe data ID konsisten string.
3. ANTI-CUTOFF: Render loop .map() pada tabel / kartu list dari 3-5 item dummy tersebut. Jangan hardcode baris tabel secara manual di HTML, render melalui JS loop.
4. 3 CHECKLIST EKSPLISIT: Data, Tombol/Aksi, Login/Akses.
5. FITUR ADMIN DI-GATE: Fitur Tambah User aktif tapi tersembunyi di balik role Admin.
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
      .container { max-width: 1000px; margin: 0 auto; }
      .card {
        background: #ffffff;
        border-radius: 12px;
        border: 1px solid rgba(226, 232, 240, 0.8);
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        padding: 24px;
        margin-bottom: 24px;
      }
      .title { font-size: 24px; font-weight: 700; color: #0f172a; margin-bottom: 8px; }
      .subtitle { font-size: 14px; color: #64748b; margin-bottom: 24px; }
      .btn-primary {
        background: #4f46e5; color: #ffffff; font-weight: 600; padding: 10px 18px; border-radius: 8px; border: none; cursor: pointer; transition: background 0.15s; display: inline-flex; align-items: center; gap: 8px;
      }
      .btn-primary:hover { background: #4338ca; }
      .btn-secondary {
        background: #ffffff; color: #334155; font-weight: 500; padding: 8px 14px; border-radius: 8px; border: 1px solid #cbd5e1; cursor: pointer; transition: background 0.15s; display: inline-flex; align-items: center; gap: 6px;
      }
      .btn-secondary:hover { background: #f1f5f9; }
      .btn-danger {
        background: #fff1f2; color: #e11d48; font-weight: 500; padding: 8px 14px; border-radius: 8px; border: 1px solid #fecdd3; cursor: pointer; transition: background 0.15s; display: inline-flex; align-items: center; gap: 6px;
      }
      .btn-danger:hover { background: #ffe4e6; }
      .form-group { margin-bottom: 16px; }
      .form-label { display: block; font-size: 14px; font-weight: 600; color: #334155; margin-bottom: 6px; }
      .form-input {
        width: 100%; padding: 10px 14px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; color: #0f172a; font-size: 14px; outline: none; transition: border-color 0.15s, box-shadow 0.15s;
      }
      .form-input:focus { border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15); }
      .table-container {
        overflow-x: auto; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05); background: #ffffff; margin-top: 16px;
      }
      table { width: 100%; border-collapse: collapse; text-align: left; }
      th {
        background: #f8fafc; color: #475569; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 14px 16px; border-bottom: 1px solid #e2e8f0;
      }
      td { color: #334155; font-size: 14px; padding: 14px 16px; border-bottom: 1px solid #f1f5f9; }
      tr:last-child td { border-bottom: none; }
      .tab-nav { display: flex; gap: 8px; border-bottom: 2px solid #e2e8f0; margin-bottom: 24px; }
      .tab-btn {
        padding: 10px 18px; border: none; background: none; cursor: pointer; border-bottom: 3px solid transparent; color: #64748b; font-size: 14px; font-weight: 600; transition: all 0.15s; margin-bottom: -2px;
      }
      .tab-btn.active { border-bottom-color: #4f46e5; color: #4f46e5; }
      .tab-content { display: none; }
      .tab-content.active { display: block; }
      .modal {
        position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px); display: none; align-items: center; justify-content: center; padding: 16px; z-index: 50;
      }
      .modal-box {
        background: #ffffff; border-radius: 16px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); max-width: 480px; width: 100%; padding: 24px;
      }
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
    - Form Tambah & Edit DILARANG nempel/inline di halaman. WAJIB menggunakan 1 MODAL FORM TUNGGAL yang dipakai ulang (reusable) untuk Tambah & Edit, serta 1 MODAL KONFIRMASI HAPUS.
    - POLA HTML MODAL WAJIB:
      \`\`\`html
      <!-- MODAL FORM (TAMBAH & EDIT) -->
      <div id="modalForm" class="modal">
        <div class="modal-box">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
            <h3 id="modalTitle" class="title" style="font-size:18px; margin-bottom:0;">Tambah Data</h3>
            <button type="button" class="btn-secondary" onclick="tutupModalForm()" style="padding:4px 8px;">✕</button>
          </div>
          <form id="formData" onsubmit="event.preventDefault(); simpanForm();">
            <input type="hidden" id="editId" value="">
            <div class="form-group">
              <label class="form-label" for="inputNama">Nama</label>
              <input type="text" id="inputNama" class="form-input" placeholder="Masukkan nama...">
            </div>
            <!-- field input lainnya sesuai aplikasi -->
            <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:20px;">
              <button type="button" class="btn-secondary" onclick="tutupModalForm()">Batal</button>
              <button type="button" class="btn-primary" onclick="simpanForm()">Simpan</button>
            </div>
          </form>
        </div>
      </div>

      <!-- MODAL KONFIRMASI HAPUS -->
      <div id="modalHapus" class="modal">
        <div class="modal-box">
          <h3 class="title" style="font-size:18px;">Konfirmasi Hapus</h3>
          <p class="subtitle" style="margin-bottom:20px;">Apakah Anda yakin ingin menghapus data ini? Tindakan ini tidak dapat dibatalkan.</p>
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
        // reset form input lainnya...
        document.getElementById('modalForm').style.display = 'flex';
      }

      function bukaModalEdit(id) {
        editId = String(id);
        const item = items.find(i => String(i.id) === String(id));
        if (!item) return;
        document.getElementById('modalTitle').innerText = 'Edit Data';
        document.getElementById('editId').value = item.id;
        document.getElementById('inputNama').value = item.nama;
        // isi input lainnya...
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
        if (editId) {
          // UPDATE DATA EXISTING
          items = items.map(item => String(item.id) === String(editId) ? { ...item, nama } : item);
          showToast('Data berhasil diperbarui!', 'success');
        } else {
          // TAMBAH DATA BARU
          const newItem = { id: String(Date.now()), nama };
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
        const id = document.getElementById('hapusId').value;
        items = items.filter(item => String(item.id) !== String(id));
        tutupModalHapus();
        showToast('Data berhasil dihapus!', 'success');
        render();
      }
      \`\`\`
20. ATURAN PINTU MASUK LAYAR LOGIN SIMULASI & PEMBATASAN AKSES TAB NYATA (MULTI-ROLE LOGIN SCREEN GATE — TERINTEGRASI):
    - JIKA APLIKASI MEMILIKI LEBIH DARI 1 ROLE (Multi-Role, misal: Admin / Kasir / Washer, atau Pasien / Dokter / Resepsionis):

    === BAGIAN A: LAYAR LOGIN SIMULASI ===
      1. MOCKUP WAJIB DIMULAI DARI LAYAR "LOGIN SIMULASI" (id="loginScreen") sebagai pintu masuk:
         * Tampilan awal: kartu login di tengah layar. Container app (id="appContainer") awalnya style.display = 'none'.
         * DILARANG langsung menampilkan dashboard dengan tombol switcher di atas.
         * Sediakan DAFTAR PILIHAN AKUN DEMO dengan NAMA ROLE ASLI dari Brief Kebutuhan.
      2. TOMBOL KELUAR / GANTI AKUN:
         * Header app WAJIB punya tombol "🚪 Keluar / Ganti Akun" (onclick="logout()").
      3. AKSES PUBLIK (Pelanggan/Pasien/Tamu):
         * Jika ada role publik, sediakan tombol akses langsung di layar login (tanpa login akun).
    - JIKA APLIKASI HANYA 1 ROLE: TIDAK ADA layar login, langsung tampil ke app.

    === BAGIAN B: WAJIB — DATA-ATTRIBUTE TAB GATING (GENERIK, BUKAN HARDCODED ID) ===
    PENYEBAB REGRESI BERULANG: Dulu render() menggunakan getElementById('tab-btn-kasir') secara hardcoded —
    jika AI membuat nama tab berbeda (misal 'tab-btn-pemeriksaan'), querySelector return null dan semua tab
    tetap terlihat. SOLUSI PERMANEN: SETIAP tombol tab WAJIB diberi atribut data-access-roles berisi
    daftar role yang boleh melihatnya. Fungsi render() cukup SATU loop generik — tidak peduli nama tab.

    === POLA HTML WAJIB — SETIAP TOMBOL TAB HARUS PUNYA data-access-roles ===
      \`\`\`html
      <!-- LAYAR LOGIN SIMULASI -->
      <div id="loginScreen" style="display: flex; min-height: 85vh; align-items: center; justify-content: center; padding: 20px;">
        <div class="card" style="max-width: 440px; width: 100%; text-align: center; padding: 32px; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1);">
          <div style="font-size: 36px; margin-bottom: 12px;">🔐</div>
          <h2 class="title" style="font-size: 22px; margin-bottom: 6px;">Pintu Masuk Aplikasi</h2>
          <p class="subtitle" style="margin-bottom: 24px; font-size: 14px;">Pilih akun peran demo untuk masuk:</p>
          <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px;">
            <!-- Ganti nama role sesuai Brief Kebutuhan! -->
            <button type="button" class="btn-primary" onclick="loginAs('Admin')" style="justify-content: center; padding: 12px;">👤 Masuk sebagai Admin</button>
            <button type="button" class="btn-secondary" onclick="loginAs('Kasir')" style="justify-content: center; padding: 12px;">💳 Masuk sebagai Kasir</button>
            <button type="button" class="btn-secondary" onclick="loginAs('Washer')" style="justify-content: center; padding: 12px;">🧺 Masuk sebagai Washer</button>
          </div>
          <!-- Akses Publik jika ada role tanpa login -->
          <div style="border-top: 1px solid #e2e8f0; padding-top: 16px;">
            <button type="button" class="btn-secondary" onclick="loginAs('Pelanggan')" style="width: 100%; justify-content: center; border-style: dashed;">🔍 Akses Publik: Lacak Pesanan</button>
          </div>
        </div>
      </div>

      <!-- KONTEN UTAMA APLIKASI -->
      <div id="appContainer" class="container" style="display: none;">
        <header style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0;">
          <div>
            <h1 class="title" style="margin-bottom: 4px;">Nama Aplikasi</h1>
            <p class="subtitle" style="margin-bottom: 0;">Peran Aktif: <strong id="currentRoleBadge">-</strong></p>
          </div>
          <button type="button" class="btn-secondary" onclick="logout()" style="padding: 8px 14px; font-size: 13px;">🚪 Keluar / Ganti Akun</button>
        </header>

        <!-- ⚠️ WAJIB MUTLAK: SETIAP tombol tab HARUS punya atribut data-access-roles
             berisi role yang BOLEH melihat tab ini, dipisah koma.
             render() akan hide/show berdasarkan atribut ini — BUKAN hardcoded ID. -->
        <div class="tab-nav">
          <button type="button" id="tab-btn-dashboard" class="tab-btn active"
                  data-access-roles="Admin"
                  onclick="showTab('dashboard')">📊 Dashboard</button>
          <button type="button" id="tab-btn-kasir" class="tab-btn"
                  data-access-roles="Admin,Kasir"
                  onclick="showTab('kasir')">💳 Kasir POS</button>
          <button type="button" id="tab-btn-antrian" class="tab-btn"
                  data-access-roles="Admin,Washer"
                  onclick="showTab('antrian')">📋 Antrian Kerja</button>
          <button type="button" id="tab-btn-lacak" class="tab-btn"
                  data-access-roles="Admin,Pelanggan"
                  onclick="showTab('lacak')">🔍 Lacak Resi</button>
        </div>
        <!-- Konten Tab... -->
      </div>
      \`\`\`

    === POLA JAVASCRIPT WAJIB — render() GENERIK dengan data-access-roles ===
      \`\`\`javascript
      let currentRole = null; // null saat awal (multi-role)
      let activeTab = 'dashboard';

      // ─── MASUK SEBAGAI ROLE TERTENTU ─────────────────────────────────────────
      function loginAs(role) {
        currentRole = role;
        const loginEl = document.getElementById('loginScreen');
        const appEl = document.getElementById('appContainer');
        if (loginEl) loginEl.style.display = 'none';
        if (appEl) appEl.style.display = 'block';

        // STEP 1: Filter visibilitas tab dulu (SEBELUM showTab, agar tab landing visible)
        filterTabsByRole(role);

        // STEP 2: Arahkan ke landing tab default per role
        if (role === 'Admin' || role === 'Owner' || role === 'Manager') {
          showTab('dashboard');
        } else if (role === 'Kasir' || role === 'Keuangan') {
          showTab('kasir');
        } else if (role === 'Washer' || role === 'Petugas' || role === 'Operator' || role === 'Dokter' || role === 'Teknisi') {
          showTab('antrian'); // Sesuaikan dengan nama tab default role ini di app konkret
        } else if (role === 'Pelanggan' || role === 'Customer' || role === 'Pasien' || role === 'Tamu') {
          showTab('lacak'); // Tab publik
        } else {
          // Fallback: pilih tab pertama yang VISIBLE untuk role ini
          const firstVisible = document.querySelector('.tab-btn[style*="display: block"], .tab-btn:not([style*="display: none"])');
          if (firstVisible) firstVisible.click();
        }

        // STEP 3: Update badge & kontrol tombol aksi sensitif
        render();
        showToast('Berhasil masuk sebagai ' + role, 'success');
      }

      // ─── FUNGSI UTAMA FILTER TAB (GENERIK, BERBASIS data-access-roles) ──────
      // JANGAN GANTI dengan hardcoded getElementById per tab!
      // Cukup set data-access-roles di setiap <button class="tab-btn"> di HTML.
      function filterTabsByRole(role) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
          const allowed = (btn.getAttribute('data-access-roles') || 'Admin').split(',').map(r => r.trim());
          btn.style.display = allowed.includes(role) ? '' : 'none';
        });
      }

      // ─── LOGOUT / GANTI AKUN ─────────────────────────────────────────────────
      function logout() {
        currentRole = null;
        const loginEl = document.getElementById('loginScreen');
        const appEl = document.getElementById('appContainer');
        if (appEl) appEl.style.display = 'none';
        if (loginEl) loginEl.style.display = 'flex';
        showToast('Anda telah keluar. Pilih akun peran lain.', 'info');
      }

      // ─── NAVIGASI TAB ─────────────────────────────────────────────────────────
      function showTab(tabName) {
        activeTab = tabName;
        document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
        const target = document.getElementById('tab-' + tabName);
        if (target) target.classList.add('active');
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.getElementById('tab-btn-' + tabName);
        if (activeBtn) activeBtn.classList.add('active');
      }

      // ─── RENDER BADGE & KONTROL AKSI SENSITIF ────────────────────────────────
      function render() {
        // Update badge peran
        const badge = document.getElementById('currentRoleBadge');
        if (badge && currentRole) badge.innerText = currentRole;

        // Kontrol visibilitas tombol aksi sensitif via CSS class
        document.querySelectorAll('.admin-only').forEach(el => {
          el.style.display = (currentRole === 'Admin') ? '' : 'none';
        });
        document.querySelectorAll('.kasir-only').forEach(el => {
          el.style.display = (currentRole === 'Kasir' || currentRole === 'Admin') ? '' : 'none';
        });
        document.querySelectorAll('.petugas-only').forEach(el => {
          el.style.display = (currentRole === 'Petugas' || currentRole === 'Washer' || currentRole === 'Admin') ? '' : 'none';
        });
        // Tambahkan class-class sensitif lain sesuai kebutuhan app konkret
      }
      \`\`\`

21. DESAIN UI PER ROLE BERDASARKAN JOB DESCRIPTION & STRUKTUR SECTION (ROLE-AWARE UX — WAJIB DITERAPKAN JIKA ADA MULTI-ROLE):
    - Membatasi akses tab saja TIDAK CUKUP. Setiap role WAJIB mendapatkan pengalaman yang terasa DIRANCANG UNTUK MEREKA:
    - ATURAN WAJIB:
      a. SETIAP TOMBOL TAB WAJIB PUNYA data-access-roles: Format: data-access-roles="RoleA,RoleB" — daftar role yang BOLEH melihat tab ini. Contoh:
         - Tab Dashboard → data-access-roles="Admin" (HANYA Admin)
         - Tab Pemeriksaan Dokter (klinik) → data-access-roles="Admin,Dokter"
         - Tab Kasir & Tagihan → data-access-roles="Admin,Kasir,Resepsionis"
         - Tab Lacak Resi / Antrean Publik → data-access-roles="Admin,Pelanggan,Pasien"
         SESUAIKAN dengan nama role ASLI dari Brief Kebutuhan, jangan pakai nama generik.
      b. LANDING TAB DEFAULT PER ROLE WAJIB SESUAI BRIEF: loginAs(role) → filterTabsByRole(role) → showTab ke landing default.
         - Role Washer/Petugas/Dokter/Teknisi → tab kerja utama mereka (bukan Dashboard)
         - Role Kasir/Keuangan → tab POS / Kasir
         - Role Pelanggan/Pasien → tab Lacak/Antrean publik
         - Role Admin/Owner → tab Dashboard
      c. SETIAP SECTION YANG DIDEKLARASIKAN WAJIB WUJUD FISIK NYATA di halaman terkait.
      d. KOLOM TABEL & KARTU STATISTIK DISESUAIKAN PER ROLE di loop render().
      e. DATA TIDAK BOLEH BERBEDA — array state TETAP SAMA, yang beda hanya tampilan/filter per role.
23. EFISIENSI MODAL & KESELARASAN HANDLER JAVASCRIPT LENGKAP:
    - HINDARI menduplikasi banyak modal HTML terpisah (misal: modalUser, modalTarif, modalOrder yang memicu puluhan fungsi berbeda). Cukup gunakan 1 modal form dinamis untuk Tambah/Edit Data (\`bukaModal(type)\` / \`tutupModal()\`) dan 1 modal Konfirmasi Hapus (\`bukaModalHapus(id)\` / \`tutupModalHapus()\`).
    - SETIAP fungsi yang dipanggil di atribut onclick HTML (seperti \`loginAs\`, \`logout\`, \`showTab\`, \`filterTabsByRole\`, \`render\`, \`bukaModal\`, \`tutupModal\`, \`simpanData\`, \`hapusData\`, \`updateStatusCuci\`, \`cariResi\`) WAJIB memiliki definisi fungsi yang LENGKAP & NYATA di dalam tag <script>. DILARANG memanggil fungsi di onclick tanpa mendefinisikannya di JavaScript.`;



      // Seleksi Page Template Baku Berdasarkan Brief Kebutuhan (Fase C)
      const selectivePageMappings = detectSelectivePageTemplates(prompt + '\n' + allHistoryText);
      const selectivePTDirective = formatSelectivePageTemplatesForCodeGen(selectivePageMappings);
      if (selectivePTDirective) {
        systemPrompt += `\n\n${selectivePTDirective}`;
      }


      if (stage === 'TAHAP_1_PEMBUKAAN' && hasBriefPresented && isConfirmationApproval) {
        systemPrompt += `\n\nATURAN TAHAP 1 (KONFIRMASI SELESAI -> GENERATE MOCKUP TAHAP 2):
- Pengguna telah mengonfirmasi persetujuan pada lembar "Brief Kebutuhan".
- Tugas Anda: Berikan sambutan hangat dan antusias, lalu WAJIB LANGSUNG MEMBUAT KODE HTML MOCKUP LENGKAP UTUH DALAM BLOK \`\`\`html ... \`\`\` sesuai 23 Prinsip Wajib yang sudah baku:
  1. Data awal 3-5 item contoh realistis (Prinsip 1).
  2. Login Gate & Tab Gating Fungsional Nyata (Prinsip 20): untuk app multi-role WAJIB ada loginScreen + filterTabsByRole(role) + data-access-roles pada SETIAP <button class="tab-btn">. filterTabsByRole() dipanggil pertama kali di loginAs() SEBELUM showTab(), agar tab yg tidak diizinkan benar-benar tersembunyi setelah login.
  3. Visibilitas Tab Terbatas Per Role (Prinsip 20 & 21): Tab Dashboard hanya muncul untuk Admin. Setiap tab-btn WAJIB punya data-access-roles="RoleA,RoleB" sesuai role yang boleh melihatnya. DILARANG hardcode getElementById('tab-btn-xxx') untuk filter tab.
  4. Kepatuhan Layout Page Template Baku (Prinsip 22): antrian cuci berbentuk kartu antrean (PT-07), kasir berbentuk POS (PT-08), dashboard berbentuk KPI (PT-01).
  5. Efisiensi Modal & Handler Lengkap (Prinsip 23): cukup 1 modal dinamis untuk Tambah/Edit Data dan 1 modal Hapus; setiap tombol onclick WAJIB memiliki fungsi terdefinisi di <script>.
  6. Styling CSS modern murni tanpa Tailwind Play CDN, event handler 100% selaras.
- Tuliskan ringkasan checklist kesiapan aplikasi di bawah kode HTML.`;

      } else if (stage === 'TAHAP_5_PATCH') {
        systemPrompt += `\n\nATURAN TAHAP 5 (PEMBARUAN FITUR / REVISI / PATCH) - VALIDASI FUNGSIONAL WAJIB (NFR-10b):
- Pengguna meminta revisi/patch (misal: ubah warna, tambah kolom, ganti teks, tambah tab/modal).
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

    const aiProvider = (process.env.AI_PROVIDER || (process.env.GEMINI_API_KEY ? 'gemini' : 'openai')).toLowerCase();
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const openaiApiKey = process.env.OPENAI_API_KEY;
    const activeGeminiModel = getGeminiModel();
    const activeOpenAIModel = getOpenAIModel();

    if (aiProvider === 'gemini' && !geminiApiKey) {
      return NextResponse.json({
        success: false,
        error: 'GEMINI_API_KEY belum dikonfigurasi di server.',
        replyText: 'Kunci Gemini API belum dipasang di environment server.',
        code: null,
        isContinued: false
      });
    }

    if (aiProvider === 'openai' && !openaiApiKey) {
      return NextResponse.json({
        success: false,
        error: 'OPENAI_API_KEY belum dikonfigurasi di server.',
        replyText: 'Kunci OpenAI API belum dipasang di environment server.',
        code: null,
        isContinued: false
      });
    }

    // Susun Prompt dengan Konteks Kode Terkini (jika sedang dalam revisi / patch)
    let userPromptWithContext = prompt;
    if (stage === 'TAHAP_5_PATCH' && currentCode) {
      userPromptWithContext = `KODE HTML & JS SAAT INI YANG SUDAH BERJALAN AKTIF:\n\`\`\`html\n${currentCode}\n\`\`\`\n\nPERMINTAAN REVISI DARI PENGGUNA: "${prompt}".\n\nINSTRUKSI KHUSUS NFR-10b (VALIDASI FUNGSIONAL LENGKAP): Terapkan perubahan yang diminta pengguna di atas, namun TETAP PERTAHANKAN seluruh fungsi JavaScript, array data 3-5 item dummy, tombol Tambah/Edit/Hapus, dan render() agar tetap 100% berfungsi. Kembalikan KODE HTML LENGKAP UTUH di dalam blok \`\`\`html ... \`\`\`.`;
    }

    const recentHistory = (chatHistory || []).slice(-6);

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
            const oaiMessages = [
              { role: 'system', content: systemPrompt },
              ...recentHistory.map((m: any) => ({ role: m.sender === 'USER' ? 'user' : 'assistant', content: m.text })),
              { role: 'user', content: prompt }
            ];
            try {
              const oaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiApiKey}` },
                body: JSON.stringify({
                  model: activeOpenAIModel,
                  messages: oaiMessages,
                  max_completion_tokens: ideationMaxTokens,
                  temperature: 0.7,
                  stream: true
                })
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

          const cleanReplyText = fullText.replace(/```html[\s\S]*?```/g, '').replace(/```[\s\S]*?```/g, '').trim();

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

    // =========================================================================
    // JALUR 1: GEMINI API (DIPENGARUHI OLEH getGeminiModel())
    // =========================================================================
    if (aiProvider === 'gemini') {
      // Susun Contents dengan Aturan Role Bergantian (user / model)
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

      const candidateModels = [
        activeGeminiModel,
        'gemini-3.6-flash'
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
                maxOutputTokens: isIdeationMode ? 1024 : 8192
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
        if (openaiApiKey) {
          console.warn(`Gemini (${activeGeminiModel}) unavailable. Falling back instantly to OpenAI (${activeOpenAIModel})...`);
          actualProviderUsed = 'openai';
          const messages = [
            { role: 'system', content: systemPrompt },
            ...recentHistory.map((m: any) => ({
              role: m.sender === 'USER' ? 'user' : 'assistant',
              content: m.text
            })),
            { role: 'user', content: userPromptWithContext }
          ];

          let fallbackRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${openaiApiKey}`
            },
            body: JSON.stringify({
              model: activeOpenAIModel,
              messages,
              max_completion_tokens: isIdeationMode ? 1024 : 16384,
              temperature: isIdeationMode ? 0.7 : 0.4
            })
          });

          let fbData = await fallbackRes.json();
          assistantMessage = fbData.choices?.[0]?.message?.content || '';
        } else {
          throw new Error('Gemini API failed: ' + attemptErrors.join(' || '));
        }
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
                generationConfig: { temperature: 0.2, maxOutputTokens: 8192 }
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

          // Jika Gemini continuation gagal atau kosong, fallback ke OpenAI continuation
          if (!contText && openaiApiKey) {
            console.log('Falling back to OpenAI for continuation...');
            try {
              const contMessages = [
                { role: 'system', content: systemPrompt },
                ...recentHistory.map((m: any) => ({
                  role: m.sender === 'USER' ? 'user' : 'assistant',
                  content: m.text
                })),
                { role: 'user', content: userPromptWithContext },
                { role: 'assistant', content: assistantMessage },
                { role: 'user', content: 'Lanjutkan persis dari titik karakter terakhir. Jangan mengulangi kode dari awal, dan pastikan seluruh script JavaScript dan penutup tag HTML lengkap.' }
              ];

              const contResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${openaiApiKey}`
                },
                body: JSON.stringify({
                  model: activeOpenAIModel,
                  messages: contMessages,
                  max_completion_tokens: 8192,
                  temperature: 0.2
                })
              });

              if (contResponse.ok) {
                const contData = await contResponse.json();
                contText = contData.choices?.[0]?.message?.content || '';
                finishReason = contData.choices?.[0]?.finish_reason;
              }
            } catch (openAiContErr) {
              console.warn('OpenAI continuation fallback error:', openAiContErr);
            }
          }

          if (!contText || contText.toLowerCase().includes('tidak dapat melanjutkan')) {
            break;
          }

          // Bersihkan jika model mengulang pembuka code fence di awal sambungan
          if (contText.startsWith('```html\n')) contText = contText.slice(8);
          else if (contText.startsWith('```html')) contText = contText.slice(7);
          else if (contText.startsWith('```\n')) contText = contText.slice(4);
          else if (contText.startsWith('```')) contText = contText.slice(3);

          assistantMessage += contText;
          retryCount++;
        }
      }

    // =========================================================================
    // JALUR 2: OPENAI API (DIPENGARUHI OLEH getOpenAIModel())
    // =========================================================================
    } else {
      const messages = [
        { role: 'system', content: systemPrompt },
        ...recentHistory.map((m: any) => ({
          role: m.sender === 'USER' ? 'user' : 'assistant',
          content: m.text
        })),
        { role: 'user', content: userPromptWithContext }
      ];

      let response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiApiKey}`
        },
        body: JSON.stringify({
          model: activeOpenAIModel,
          messages,
          max_completion_tokens: isIdeationMode ? 1024 : 8192,
          temperature: isIdeationMode ? 0.7 : 0.5
        })
      });

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
          const contResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${openaiApiKey}`
            },
            body: JSON.stringify({
              model: activeOpenAIModel,
              messages: continuationMessages,
              max_completion_tokens: 8192,
              temperature: 0.2
            })
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

        if (contText.startsWith('```html\n')) contText = contText.slice(8);
        else if (contText.startsWith('```html')) contText = contText.slice(7);
        else if (contText.startsWith('```\n')) contText = contText.slice(4);
        else if (contText.startsWith('```')) contText = contText.slice(3);

        assistantMessage += contText;
        retryCount++;
      }
    }

    // Ekstraksi Blok Kode HTML (Mendukung fence lengkap maupun unclosed jika terpotong)
    let htmlCode = '';
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

    // Validasi Penuh Sesuai FR-03 & NFR-10 (Dijalankan pada mode generate kode)
    let validated = (!isIdeationMode && htmlCode) ? validateAndRepairGeneratedCode(htmlCode, '', '') : null;

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
                { role: 'user', parts: [{ text: userPromptWithContext }] },
                { role: 'model', parts: [{ text: assistantMessage }] },
                { role: 'user', parts: [{ text: `PERINGATAN KRITIS NFR-10b (VALIDASI SINTAKS & KELENGKAPAN KODE):
Ditemukan kendala serius pada kode yang Anda berikan:
- ${issueList}

INSTRUKSI PERBAIKAN WAJIB:
1. Hasilkan KODE HTML LENGKAP DAN UTUH dari <!DOCTYPE html> sampai </html> di dalam blok \`\`\`html ... \`\`\`.
2. Pastikan SELURUH sintaks JavaScript di dalam tag <script> VALID 100% dan bebas dari SyntaxError (seperti unclosed string, unexpected identifier, atau kurung tidak berpasangan).
3. Pastikan setiap atribut onclick="fungsi()" memiliki definisi fungsi yang PERSIS SAMA namanya di <script>.
4. Pastikan setiap document.getElementById('id') memiliki elemen HTML dengan ID yang sama.
5. Pertahankan seluruh fitur fungsional (array 3-5 item contoh, tambah, edit, hapus, modal).` }] }
              ],
              generationConfig: { temperature: 0.2, maxOutputTokens: 8192 }
            })
          });
          const repairData = await repairRes.json();
          const repairMsg = repairData.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || '';
          const repairMatch = repairMsg.match(/```html([\s\S]*?)```/);
          if (repairMatch) {
            htmlCode = repairMatch[1].trim();
            assistantMessage = repairMsg;
            validated = validateAndRepairGeneratedCode(htmlCode, '', '');
            repairSuccess = true;
          } else if (repairMsg.includes('```html')) {
            htmlCode = repairMsg.split('```html')[1].replace(/```[\s\S]*$/, '').trim();
            assistantMessage = repairMsg;
            validated = validateAndRepairGeneratedCode(htmlCode, '', '');
            repairSuccess = true;
          }
        } catch (e) {
          console.warn('Gemini auto-repair failed, will attempt OpenAI repair fallback...', e);
        }
      }
      
      if (!repairSuccess && openaiApiKey) {
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
2. Pastikan SELURUH sintaks JavaScript di dalam tag <script> VALID 100% dan bebas dari SyntaxError (seperti unclosed string, unexpected identifier, atau kurung tidak berpasangan).
3. Pastikan setiap atribut onclick="fungsi()" memiliki definisi fungsi yang PERSIS SAMA namanya di <script>.
4. Pastikan setiap document.getElementById('id') memiliki elemen HTML dengan ID yang sama.
5. Pertahankan seluruh fitur fungsional (array 3-5 item contoh, tambah, edit, hapus, modal).` }
        ];

        const repairRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openaiApiKey}`
          },
          body: JSON.stringify({
            model: activeOpenAIModel,
            messages: repairPrompt,
            max_completion_tokens: 8192,
            temperature: 0.2
          })
        });

        const repairData = await repairRes.json();
        const repairMsg = repairData.choices?.[0]?.message?.content || '';
        const repairMatch = repairMsg.match(/```html([\s\S]*?)```/);
        if (repairMatch) {
          htmlCode = repairMatch[1].trim();
          assistantMessage = repairMsg;
          validated = validateAndRepairGeneratedCode(htmlCode, '', '');
        } else if (repairMsg.includes('```html')) {
          htmlCode = repairMsg.split('```html')[1].replace(/```[\s\S]*$/, '').trim();
          assistantMessage = repairMsg;
          validated = validateAndRepairGeneratedCode(htmlCode, '', '');
        }
      }
    }

    // PERLINDUNGAN TAHAP 1 MUTLAK: DILARANG mengirimkan kode sebelum Brief Kebutuhan disetujui pengguna!
    const isStage1AwaitingConfirmation = (stage === 'TAHAP_1_PEMBUKAAN') && !(hasBriefPresented && isConfirmationApproval);

    const hasValidCode = Boolean(
      !isStage1AwaitingConfirmation &&
      validated &&
      validated.isValid &&
      validated.repairedCode &&
      validated.repairedCode.html &&
      validated.repairedCode.html.trim().length > 0 &&
      !validated.issues.some(i => i.startsWith('SYNTAX_ERROR'))
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
    } else if (htmlCode || assistantMessage.includes('```html')) {
      // Pesan kegagalan yang ACTIONABLE dan informatif
      const topIssues = validated?.issues && validated.issues.length > 0
        ? validated.issues.slice(0, 2).join('; ')
        : (isCodeIncomplete ? 'Kode HTML/JS terpotong di tengah jalan' : 'Pemeriksaan DOM ID & event handler tidak lolos');
      
      cleanReplyText = `⚠️ **Pembuatan kode belum berhasil melewati validasi integritas otomatis.**\n\n🔍 **Detail kendala:** ${topIssues}.\n\n💡 **Saran Tindakan:**\n1. Ketik **"buatkan prototipe sekarang"** untuk mencoba generate ulang.\n2. Jika aplikasi memiliki banyak role (Admin/Kasir/Petugas), Anda juga bisa meminta versi yang lebih sederhana dulu (misal: 2 role utama), lalu menambahkan role lainnya pada tahap revisi.`;
    } else {
      cleanReplyText = assistantMessage.trim();
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
