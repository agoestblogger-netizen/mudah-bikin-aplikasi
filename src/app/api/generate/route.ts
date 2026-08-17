import { NextResponse } from 'next/server';
import { validateAndRepairGeneratedCode } from '@/lib/codeValidator';
import { checkRateLimit } from '@/lib/rateLimiter';

// =============================================================================
// KONFIGURASI MODEL AI TERPUSAT (Single Source of Truth)
// =============================================================================
export const DEFAULT_GEMINI_MODEL = 'gemini-3.7-flash';
export const DEFAULT_OPENAI_MODEL = 'gpt-5.4-mini';

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
    
    // Deteksi Persetujuan/Konfirmasi Pengguna terhadap Brief Kebutuhan
    const isConfirmationApproval = /(^|\b)(ok|oke|sip|setuju|lanjut|lanjutkan|siap|deal|sudah sesuai|sesuai|buatkan|buatkan sekarang|bikin sekarang|gas|kerjakan)($|\b)/i.test(prompt.trim());
    
    // Deteksi Apakah Prompt Awal Pengguna BENAR-BENAR SANGAT DETAIL:
    // WAJIB panjang > 200 karakter DAN secara eksplisit merinci target peran/user/masalah DAN daftar fitur/alur secara bersamaan.
    const isVeryDetailedInitialPrompt = prompt.length > 200 && (
      (prompt.toLowerCase().includes('target') || prompt.toLowerCase().includes('user') || prompt.toLowerCase().includes('pengguna') || prompt.toLowerCase().includes('pasien') || prompt.toLowerCase().includes('petugas') || prompt.toLowerCase().includes('admin') || prompt.toLowerCase().includes('masalah')) &&
      (prompt.toLowerCase().includes('fitur') || prompt.toLowerCase().includes('alur') || prompt.toLowerCase().includes('menu') || prompt.toLowerCase().includes('tabel') || prompt.toLowerCase().includes('layanan'))
    );
    const userMessageCount = (chatHistory || []).filter((m: any) => m.sender === 'USER').length;

    // Mode Diskusi / Eksplorasi Tahap 1 (Sebelum Konfirmasi Brief Kebutuhan)
    const isIdeationMode = (stage === 'TAHAP_1_PEMBUKAAN') && !(hasBriefPresented && isConfirmationApproval);

    let systemPrompt = '';

    if (isIdeationMode) {
      if (hasBriefPresented && !isConfirmationApproval) {
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
   - **Job Description per Role** (WAJIB diisi jika aplikasi punya 2+ role/akses bertingkat, kosongkan jika single-user):
     * [Role 1 — misal: Admin]: [1-2 kalimat tugas utama + halaman/tab default saat login]
     * [Role 2 — misal: Kasir]: [1-2 kalimat tugas utama + halaman/tab default saat login]
     * [dst untuk setiap role yang ada]
4. Tanyakan konfirmasi eksplisit di baris terakhir:
   "Apakah lembar Brief Kebutuhan yang diperbarui ini sudah sesuai, atau masih ada detail yang ingin diubah sebelum saya buatkan prototipenya?"`;
      } else if (isVeryDetailedInitialPrompt || userMessageCount >= 3) {
        // KONDISI 3: PROMPT AWAL SUDAH SANGAT DETAIL (>200 chars) ATAU SUDAH DISKUSI 3 PUTARAN -> RANGKUM KE BRIEF KEBUTUHAN + SESI KONFIRMASI
        systemPrompt = `Anda adalah Konsultan Aplikasi AI dari platform "Mudah Bikin Aplikasi".
Tugas Anda: Merangkum kebutuhan aplikasi yang sudah sangat detail menjadi lembar resmi "Brief Kebutuhan" dan meminta konfirmasi sebelum pembuatan prototipe.

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
   - **Job Description per Role** (WAJIB diisi jika aplikasi punya 2+ role/akses bertingkat; kosongkan jika single-user):
     * [Role 1 — misal: Admin]: [tugas utama harian + tab/halaman default yang relevan saat login]
     * [Role 2 — misal: Kasir]: [tugas utama harian + tab/halaman default yang relevan saat login]
     * [dst — proaktif sarankan job desc yang masuk akal bila user belum menyebutkan]
4. WAJIB tanyakan konfirmasi di baris terakhir:
   "Apakah Brief Kebutuhan di atas sudah sesuai dengan yang Anda inginkan, atau ada yang mau ditambah/diubah sebelum saya buatkan prototipenya?"`;
      } else {
        // KONDISI 4: PROMPT AWAL SINGKAT / VAGUE (contoh: "aplikasi laundry" atau "ingin buat aplikasi klinik")
        systemPrompt = `Anda adalah Konsultan Aplikasi AI dari platform "Mudah Bikin Aplikasi".
Tugas Anda pada tahap ini adalah mendiskusikan, menggali, dan mempertajam ide aplikasi bersama pengguna (Sub-langkah 1-4 Eksplorasi Ide).

ATURAN MUTLAK PERCAKAPAN (WAJIB DIPATUHI):
1. DILARANG KERAS menghasilkan blok kode HTML, CSS, JavaScript, atau blok \`\`\`html ... \`\`\`!
2. DILARANG KERAS menyebutkan kata-kata teknis seperti "saya akan berikan kode HTML", "generate kode", "fitur CRUD", "data dummy", "syntax error", atau janji teknis apa pun tentang pembuatan kode!
3. Format respons WAJIB MURNI TEKS PERCAKAPAN SANTAI & RAMAH (2-4 kalimat singkat dan nyaman dibaca):
   - Sapa dan akui ide pengguna dengan antusias.
   - DALAMI & PERTAJAM (Sub-langkah 2): Berikan 1 masukan/saran fitur proaktif yang relevan.
   - TANYAKAN ROLE/AKSES JIKA RELEVAN: Jika aplikasi kemungkinan punya multi-role (misal laundry punya Kasir+Washer+Admin, klinik punya Dokter+Pasien+Admin), PROAKTIF tanyakan atau sarankan pembagian tugas tiap role — contoh: "Untuk laundry seperti ini, biasanya ada 3 peran: Admin (kelola data master), Kasir (terima pesanan & pembayaran), dan Washer (lihat antrian cucian yang perlu dikerjakan). Apakah Anda ingin aplikasinya mendukung ketiga peran ini?"
   - AJUKAN TEPAT SATU PERTANYAAN FOKUS (DILARANG borongan banyak pertanyaan sekaligus).
4. JANGAN tampilkan form Brief Kebutuhan dan JANGAN buat kode di giliran ini.`;
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
20. ATURAN ROLE SWITCHER & PEMBATASAN AKSES NYATA WAJIB (REAL FUNCTIONAL ROLE GATING):
    - Jika aplikasi memiliki fitur multi-peran / akses bertingkat (misal: Pasien / Petugas / Admin, atau User / Kasir / Manager, atau Tamu / Anggota / Pengurus):
    - DILARANG KERAS membuat Role Switcher yang hanya mengubah teks label/badge tanpa membatasi akses tampilan secara nyata!
    - IMPLEMENTASI ROLE GATING WAJIB MEMENUHI 3 SYARAT FUNGSIONAL NYATA:
      1. VISIBILITAS TAB / MENU TERBATAS: Tab/menu yang tidak sesuai hak akses role WAJIB disembunyikan total (style.display = 'none' atau tidak di-render).
         * Role Pasien / Publik: Hanya melihat tab publik (misal: Tab Layar Antrian / Ambil Nomor). Tab Loket Petugas dan Tab Master Layanan Admin WAJIB DISEMBUNYIKAN (style.display = 'none').
         * Role Petugas / Operator: Melihat tab publik dan tab loket pemanggil. Tab Master Layanan / Pengaturan Admin WAJIB DISEMBUNYIKAN (style.display = 'none').
         * Role Admin: Melihat SELURUH tab (Layar Antrian, Loket Pemanggil, dan Master Layanan).
      2. VISIBILITAS TOMBOL AKSI TERBATAS: Tombol aksi sensitif (seperti tombol "Panggil Nomor", "Selesai", "Tambah/Edit/Hapus Layanan") WAJIB disembunyikan (style.display = 'none') atau di-disable untuk role yang tidak berhak.
      3. AUTO-REDIRECT TAB AKTIF SAAT GANTI ROLE: Jika pengguna mengganti peran saat sedang berada di tab yang tidak diizinkan untuk peran baru, fungsi switchRole(role) WAJIB secara otomatis mengalihkan tab aktif ke tab yang aman/publik (misal tab antrian).
    - POLA JAVASCRIPT ROLE SWITCHER WAJIB:
      \`\`\`javascript
      let currentRole = 'Pasien'; // default awal

      function switchRole(role) {
        currentRole = role;
        // Redirect tab aktif jika tidak diizinkan untuk role baru
        if (role === 'Pasien' && (activeTab === 'loket' || activeTab === 'master')) {
          showTab('antrian');
        } else if (role === 'Petugas' && activeTab === 'master') {
          showTab('antrian');
        }
        render();
        showToast('Mode beralih ke: ' + role, 'success');
      }

      function render() {
        // 1. Update Badge Peran
        const badge = document.getElementById('currentRoleBadge');
        if (badge) badge.innerText = currentRole;

        // 2. Kontrol Visibilitas Tab Sesuai Role
        const btnLoket = document.getElementById('tab-btn-loket');
        const btnMaster = document.getElementById('tab-btn-master');
        if (btnLoket) btnLoket.style.display = (currentRole === 'Petugas' || currentRole === 'Admin') ? 'block' : 'none';
        if (btnMaster) btnMaster.style.display = (currentRole === 'Admin') ? 'block' : 'none';

        // 3. Kontrol Visibilitas Tombol Aksi Sensitif
        document.querySelectorAll('.admin-only').forEach(el => {
          el.style.display = (currentRole === 'Admin') ? 'inline-flex' : 'none';
        });
        document.querySelectorAll('.petugas-only').forEach(el => {
          el.style.display = (currentRole === 'Petugas' || currentRole === 'Admin') ? 'inline-flex' : 'none';
        });
      }
      \`\`\`
21. DESAIN UI PER ROLE BERDASARKAN JOB DESCRIPTION (ROLE-AWARE UX — WAJIB DITERAPKAN JIKA ADA MULTI-ROLE):
    - Membatasi akses tab saja TIDAK CUKUP. Setiap role WAJIB mendapatkan pengalaman yang terasa DIRANCANG UNTUK MEREKA, bukan 1 dashboard generik yang sebagian tabnya disembunyikan.
    - ATURAN WAJIB:
      a. TAB/HALAMAN DEFAULT SAAT LOGIN BERBEDA PER ROLE: Fungsi switchRole() WAJIB mengatur tab awal yang sesuai job desc role tersebut. Contoh:
         - Role Washer / Operator Lapangan → default ke tab "Antrian Kerja" atau "Tugas Hari Ini", BUKAN tab "Ringkasan" atau "Laporan".
         - Role Kasir / Keuangan → default ke tab "Input Pesanan" atau "Pembayaran".
         - Role Admin / Manager → default ke tab "Ringkasan" atau "Dashboard".
      b. KOLOM TABEL DISESUAIKAN PER ROLE: Jika tabel yang sama diakses oleh beberapa role, kolom yang TIDAK RELEVAN untuk role tertentu WAJIB disembunyikan. Contoh:
         - Tabel pesanan untuk role Washer: tampilkan [No Order, Nama Pelanggan, Jenis Cuci, Status Cuci] — JANGAN tampilkan kolom [Harga, Diskon, Status Pembayaran, Lunas/Belum].
         - Tabel pesanan untuk role Kasir: tampilkan [No Order, Nama Pelanggan, Total Harga, Metode Bayar, Status Pembayaran] — kolom teknis operasional cuci tidak perlu.
         - Tabel pesanan untuk role Admin: tampilkan SEMUA kolom.
         - IMPLEMENTASI: gunakan conditional rendering di dalam loop render() — \`\${currentRole !== 'Washer' ? '<td>'+item.harga+'</td>' : ''}\`
      c. KARTU STATISTIK DASHBOARD BERBEDA PER ROLE: Jika ada halaman Ringkasan/Dashboard, kartu metrik yang ditampilkan WAJIB relevan untuk role tersebut:
         - Role Washer: tampilkan kartu "Antrian Menunggu", "Sedang Dikerjakan", "Selesai Hari Ini" — JANGAN tampilkan "Total Pendapatan" atau "Nilai Order".
         - Role Kasir: tampilkan kartu "Order Masuk Hari Ini", "Belum Dibayar", "Total Pendapatan Hari Ini".
         - Role Admin: tampilkan SEMUA kartu metrik bisnis (pendapatan, order, efisiensi operasional, dsb).
         - IMPLEMENTASI: gunakan conditional rendering \`\${currentRole === 'Washer' ? '<div class="stat-card">Antrian: '+antrian+'</div>' : ''}\`
      d. DATA TIDAK BOLEH BERBEDA — Sumber data (array state) TETAP SAMA untuk semua role. Yang berbeda HANYA tampilan/filter/kolom yang dirender di UI. DILARANG membuat array data terpisah per role.`;

      if (stage === 'TAHAP_1_PEMBUKAAN' && hasBriefPresented && isConfirmationApproval) {
        systemPrompt += `\n\nATURAN TAHAP 1 (KONFIRMASI SELESAI -> GENERATE MOCKUP TAHAP 2):
- Pengguna telah mengonfirmasi persetujuan pada lembar "Brief Kebutuhan".
- Tugas Anda: Berikan sambutan hangat dan antusias, lalu WAJIB LANGSUNG MEMBUAT KODE HTML MOCKUP LENGKAP UTUH DALAM BLOK \`\`\`html ... \`\`\` sesuai 21 Prinsip Wajib yang sudah baku (data awal 3-5 item contoh realistis, tombol Tambah/Edit/Hapus aktif di memori, Role Gating fungsional nyata [Prinsip 20], Role-Aware UX sesuai Job Description [Prinsip 21 — tab default per role, kolom tabel berbeda, kartu statistik berbeda], styling modern tanpa Tailwind Play CDN, event handler 100% selaras).
- Tuliskan ringkasan checklist kesiapan aplikasi di bawah kode HTML.`;
      } else if (stage === 'TAHAP_5_PATCH') {
        systemPrompt += `\n\nATURAN TAHAP 5 (PEMBARUAN FITUR / REVISI / PATCH) - VALIDASI FUNGSIONAL WAJIB (NFR-10b):
- Pengguna meminta revisi/patch (misal: ubah warna, tambah kolom, ganti teks, tambah tab/modal).
- KEPATUHAN POLA UI SPESIFIK (PRINSIP 15): Jika pengguna meminta pola UI spesifik (misal: tab navigasi), WAJIB implementasikan PERSIS pola tab tersebut (bukan tombol biasa pengganti tab).
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

          // --- GEMINI STREAMING ---
          if (aiProvider === 'gemini' && geminiApiKey) {
            const geminiStreamUrl = `https://generativelanguage.googleapis.com/v1beta/models/${activeGeminiModel}:streamGenerateContent?alt=sse&key=${geminiApiKey}`;
            try {
              const geminiRes = await fetch(geminiStreamUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiApiKey },
                body: JSON.stringify({
                  systemInstruction: { parts: [{ text: systemPrompt }] },
                  contents: buildGeminiContents(),
                  generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
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
              console.warn('Gemini streaming error, will fallback:', geminiStreamErr);
            }
          }

          // --- OPENAI STREAMING (primary atau fallback dari Gemini) ---
          if (!streamSuccess && openaiApiKey) {
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
                  max_completion_tokens: 1024,
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
              console.warn('OpenAI streaming error:', oaiStreamErr);
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
            if (isRateLimitOrDemand && attempts < 4) {
              let delayMs = 1500 * attempts;
              const retryInfo = data.error?.details?.find((d: any) => d['@type']?.includes('RetryInfo'));
              if (retryInfo?.retryDelay) {
                const parsedSec = parseInt(retryInfo.retryDelay, 10);
                if (!isNaN(parsedSec) && parsedSec > 0 && parsedSec <= 35) {
                  delayMs = (parsedSec + 1) * 1000;
                }
              }
              console.log(`Gemini ${endpoint.split('/models/')[1]} wait/cooldown: waiting ${delayMs}ms before attempt ${attempts + 1}...`);
              await new Promise(r => setTimeout(r, delayMs));
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
          console.warn(`Gemini (${activeGeminiModel}) high demand spike. Falling back automatically to OpenAI (${activeOpenAIModel})...`);
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
              max_completion_tokens: isIdeationMode ? 1024 : 8192,
              temperature: isIdeationMode ? 0.7 : 0.5
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
    } else if (match) {
      if (hasValidCode) {
        cleanReplyText = assistantMessage.replace(/```html[\s\S]*?```/, '\n\n✨ **Prototipe aplikasi berhasil diperbarui dan dimuat langsung ke Canvas Preview.**').trim();
      } else {
        cleanReplyText = 'Maaf, pembuatan/pembaruan kode belum berhasil memenuhi standar validasi fungsional DOM & event handler. Mohon kirimkan instruksi kembali.';
      }
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
