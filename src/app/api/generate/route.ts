import { NextResponse } from 'next/server';
import { validateAndRepairGeneratedCode } from '@/lib/codeValidator';
import { checkRateLimit } from '@/lib/rateLimiter';

export const maxDuration = 300; // 300 detik (5 menit) dengan Vercel Fluid Compute

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

    const apiKey = process.env.OPENAI_API_KEY;

    // BASE SYSTEM PROMPT DENGAN 13 PRINSIP TERVALIDASI
    let systemPrompt = `Anda adalah AI Generator Aplikasi dari platform "Mudah Bikin Aplikasi" (Basic Tier / MVP).
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
12. CDN FRAMEWORK & DESIGN TOKENS WAJIB (MODERN VISUAL SYSTEM):
    - WAJIB sertakan resource CDN modern di dalam <head>:
      \`\`\`html
      <!-- Tailwind CSS Play CDN -->
      <script src="https://cdn.tailwindcss.com"></script>
      <!-- Google Fonts: Plus Jakarta Sans -->
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
      <!-- Lucide Icons CDN -->
      <script src="https://unpkg.com/lucide@latest"></script>
      <style>body { font-family: 'Plus Jakarta Sans', sans-serif; }</style>
      \`\`\`
    - PRIORITASKAN UTILITY CLASS TAILWIND daripada menulis CSS manual di <style>.
    - DESIGN TOKENS WAJIB:
      * Body: \`<body class="bg-slate-50 text-slate-900 min-h-screen p-6 md:p-10">\`
      * Container Card: \`bg-white rounded-xl border border-slate-200/80 shadow-sm p-6 mb-6\`
      * Typography: Judul \`text-2xl font-bold text-slate-900 mb-2\`, Subtitle \`text-sm text-slate-500 mb-6\`
      * Tombol Utama (Accent): \`px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm transition flex items-center gap-2\`
      * Tombol Sekunder / Edit: \`px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-medium rounded-lg shadow-sm transition inline-flex items-center gap-1\`
      * Tombol Hapus (Danger): \`px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-medium rounded-lg transition inline-flex items-center gap-1\`
      * Form Inputs: \`w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition text-sm\`
      * Tabel Modern: container \`overflow-hidden rounded-xl border border-slate-200 shadow-sm\`, header \`bg-slate-50 text-slate-700 text-xs font-semibold uppercase tracking-wider px-4 py-3.5 border-b border-slate-200\`, cell \`px-4 py-3.5 text-sm text-slate-600 border-b border-slate-100 last:border-0\`
      * Navigasi Tab Modern: container \`flex gap-2 border-b border-slate-200 mb-6\`, tab-btn \`px-4 py-2.5 font-medium text-sm text-slate-500 hover:text-slate-700 border-b-2 border-transparent transition -mb-[2px]\`, active \`text-indigo-600 border-indigo-600 font-semibold\`
      * Modal Dialog: backdrop \`fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4\`, box \`bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4\`
      * Ikon SVG (Lucide): Gunakan tag \`<i data-lucide="nama-ikon" class="w-4 h-4"></i>\` dan WAJIB panggil \`lucide.createIcons();\` di akhir fungsi \`render()\`.
      * Spacing Konsisten: Gunakan skala Tailwind murni (p-4, p-6, gap-4, gap-6, space-y-4), DILARANG nilai acak.
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
    - POLA HTML WAJIB UNTUK TAB:
      <div class="tab-nav">
        <button type="button" id="tab-btn-daftar" class="tab-btn active" onclick="showTab('daftar')">Daftar</button>
        <button type="button" id="tab-btn-tambah" class="tab-btn" onclick="showTab('tambah')">Tambah</button>
        <button type="button" id="tab-btn-edit" class="tab-btn" onclick="showTab('edit')">Edit</button>
      </div>
      <div id="daftar" class="tab-content active">...</div>
      <div id="tambah" class="tab-content">...</div>
      <div id="edit" class="tab-content">...</div>
    - POLA JAVASCRIPT WAJIB UNTUK TAB:
      function showTab(tabId) {
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
        document.getElementById(tabId)?.classList.add('active');
        document.getElementById('tab-btn-' + tabId)?.classList.add('active');
        render();
      }
      function showEditForm(id) {
        const item = items.find(i => String(i.id) === String(id));
        if (item) {
          document.getElementById('editId').value = item.id;
          // isi nilai input lainnya...
          showTab('edit');
        }
      }
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
    - DILARANG menggunakan alert() bawaan browser untuk notifikasi.`;

    // Deteksi Jalur Cepat (Fast-Forward) vs Jalur Normal
    const isFastForward = /(buatkan\s*(saja|langsung)|terserah|tanpa\s*tanya|kamu\s*putuskan|langsung\s*buatkan|tanpa\s*tanya\s*lagi)/i.test(prompt);
    const userMessageCount = (chatHistory || []).filter((m: any) => m.sender === 'USER').length;

    // ATURAN KHUSUS TAHAP:
    if (stage === 'TAHAP_1_PEMBUKAAN') {
      if (isFastForward || userMessageCount >= 2) {
        systemPrompt += `\n\nATURAN TAHAP 1 (JALUR CEPAT / GENERATE MOCKUP):
- Pengguna meminta untuk langsung membuatkan aplikasi atau wawancara singkat sudah cukup.
- AI WAJIB LANGSUNG MEMBUAT KODE HTML MOCKUP LENGKAP DALAM BLOK \`\`\`html ... \`\`\` dengan 15 Prinsip Wajib di atas (data awal 3-5 item contoh, tombol Tambah/Edit/Hapus aktif di memori, warna kontras tinggi, pola UI persis).`;
      } else {
        systemPrompt += `\n\nATURAN TAHAP 1 (JALUR NORMAL - WAWANCARA AWAL):
- DILARANG KERAS menghasilkan blok kode \`\`\`html ... \`\`\` pada giliran ini!
- Pengguna sedang memberikan ide awal biasa. Tugas Anda adalah menyapa dengan ramah dan menanyakan TEPAT SATU pertanyaan singkat yang fokus untuk menggali kebutuhan aplikasi (misal: siapa target penggunanya, atau apa 2-3 alur fitur utama yang diinginkan).
- JANGAN langsung membuat kode sebelum pengguna menjawab atau meminta dibuatkan langsung.`;
      }
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

    if (!apiKey) {
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

    // OpenAI Server-Side Dynamic API Call (dioptimalkan untuk kecepatan & keamanan limit Vercel)
    const recentHistory = (chatHistory || []).slice(-6);
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
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        max_tokens: 8192,
        temperature: 0.5
      })
    });

    let data = await response.json();
    let assistantMessage = data.choices?.[0]?.message?.content || '';
    let finishReason = data.choices?.[0]?.finish_reason;

    // ANTI-CUTOFF 2 LAPIS LENGKAP (4 Ronde Maksimal)
    let retryCount = 0;
    const maxRetries = 4;

    while (retryCount < maxRetries) {
      const isFinishReasonLength = finishReason === 'length';
      
      const backtickMatches = assistantMessage.match(/```/g) || [];
      const isCodeBlockUnclosed = assistantMessage.includes('```html') && (backtickMatches.length % 2 !== 0);

      if (!isFinishReasonLength && !isCodeBlockUnclosed) {
        break;
      }

      console.log(`Anti-cutoff triggered (Attempt ${retryCount + 1}). Finish reason: ${finishReason}, backticks: ${backtickMatches.length}`);

      const continuationMessages = [
        ...messages,
        { role: 'assistant', content: assistantMessage },
        { role: 'user', content: 'Lanjutkan persis dari titik karakter terakhir. Jangan mengulangi kode dari awal.' }
      ];

      const contResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: continuationMessages,
          max_tokens: 4096,
          temperature: 0.3
        })
      });

      const contData = await contResponse.json();
      const contText = contData.choices?.[0]?.message?.content || '';
      finishReason = contData.choices?.[0]?.finish_reason;

      if (contText.toLowerCase().includes('tidak dapat melanjutkan') || contText.toLowerCase().includes('cannot continue')) {
        break;
      }

      assistantMessage += contText;
      retryCount++;
    }

    // Ekstraksi Blok Kode HTML
    let htmlCode = '';
    const match = assistantMessage.match(/```html([\s\S]*?)```/);
    if (match) {
      htmlCode = match[1].trim();
    }

    // Validasi Penuh Sesuai FR-03 & NFR-10 (Dijalankan di Awal dan Setiap Revisi)
    let validated = htmlCode ? validateAndRepairGeneratedCode(htmlCode, '', '') : null;

    // NFR-10b: Pemeriksaan Integritas & Keselarasan DOM Otomatis
    if (validated && validated.repairedCode && validated.repairedCode.html) {
      const finalHtml = validated.repairedCode.html;
      const hasScriptTag = finalHtml.includes('<script>') || finalHtml.includes('<script ');
      const hasRenderFunction = finalHtml.includes('function render') || finalHtml.includes('render()');
      const hasMismatches = validated.issues && validated.issues.length > 0;
      
      // Jika terdeteksi ketidakselarasan handler/ID atau script hilang, picu AI auto-recovery (NFR-10b)
      if (hasMismatches || !hasScriptTag || !hasRenderFunction) {
        const issueList = validated.issues.join('\n- ');
        console.warn('NFR-10b triggered with DOM alignment issues:\n', issueList);
        const repairPrompt = [
          ...messages,
          { role: 'assistant', content: assistantMessage },
          { role: 'user', content: `PERINGATAN NFR-10b (VALIDASI KESELARASAN DOM):
Ditemukan kendala pada kode yang Anda berikan:
- ${issueList || 'Tag <script> atau fungsi render() tidak ditemukan.'}

INSTRUKSI PERBAIKAN WAJIB:
1. Pastikan setiap atribut onclick="fungsi()" memiliki definisi fungsi yang PERSIS SAMA namanya di <script>.
2. Pastikan setiap document.getElementById('id') memiliki elemen HTML dengan ID yang sama.
3. Pertahankan seluruh fitur fungsional (array 3-5 item contoh, tambah, edit, hapus, modal).
4. Berikan KODE HTML UTUH LENGKAP di dalam blok \`\`\`html ... \`\`\`.` }
        ];

        const repairRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: repairPrompt,
            max_tokens: 8192,
            temperature: 0.3
          })
        });

        const repairData = await repairRes.json();
        const repairMsg = repairData.choices?.[0]?.message?.content || '';
        const repairMatch = repairMsg.match(/```html([\s\S]*?)```/);
        if (repairMatch) {
          htmlCode = repairMatch[1].trim();
          assistantMessage = repairMsg;
          validated = validateAndRepairGeneratedCode(htmlCode, '', '');
        }
      }
    }

    const hasValidCode = Boolean(
      validated &&
      validated.isValid &&
      validated.repairedCode &&
      validated.repairedCode.html &&
      validated.repairedCode.html.trim().length > 0
    );

    // Format Pesan Teks Chat Bersih & Jujur
    let cleanReplyText = '';
    if (match) {
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
