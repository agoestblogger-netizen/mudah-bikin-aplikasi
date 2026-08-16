import { NextResponse } from 'next/server';
import { validateAndRepairGeneratedCode } from '@/lib/codeValidator';
import { checkRateLimit } from '@/lib/rateLimiter';

export const maxDuration = 60; // Max timeout for Next.js Serverless Function

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
12. ATURAN WARNA & KONTRAS TINGGI WAJIB (DETERMINISTIK):
    - Wajib gunakan palet warna dengan kontras tajam & jelas (Clean Modern UI):
      * body: background: #f8fafc (putih keabuan bersih), color: #0f172a (teks gelap pekat), padding: 24px
      * Kartu / Container: background: #ffffff, border: 1px solid #e2e8f0, border-radius: 16px, box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05)
      * Judul (h1, h2, h3): color: #0f172a, font-weight: 700
      * Label / Subtitle: color: #475569
      * Header Tabel (th): background: #f1f5f9, color: #0f172a, font-weight: 700, padding: 12px, border-bottom: 2px solid #cbd5e1
      * Isi Tabel (td): color: #1e293b, padding: 12px, border-bottom: 1px solid #f1f5f9
      * Form Input: background: #ffffff, border: 1px solid #cbd5e1, color: #0f172a, padding: 10px 14px, border-radius: 10px
      * Tombol Utama: background: #4f46e5 (indigo), color: #ffffff (putih terang), font-weight: 600, padding: 10px 18px, border-radius: 10px
      * Tombol Aksi Hapus / Bahaya: background: #fee2e2, color: #b91c1c, border: 1px solid #fecaca
      * Modal Dialog: background backdrop rgba(15, 23, 42, 0.6), modal-box background #ffffff, color #0f172a
    - DILARANG KERAS: Memakai warna teks yang mirip dengan warna background (misal teks gelap di atas background gelap, atau teks putih di atas background putih). Semua teks WAJIB sangat kontras, tajam, dan mudah dibaca oleh siapa saja.
13. SCOPE GLOBAL & ANTI-RELOAD WAJIB:
    - Semua fungsi handler aksi (seperti \`tambahItem()\`, \`editItem()\`, \`hapusItem()\`, \`showModal()\`, \`closeModal()\`) WAJIB dideklarasikan di SCOPE GLOBAL (langsung di dalam tag \`<script>\`, BUKAN dibungkus di dalam \`document.addEventListener('DOMContentLoaded')\` atau closure function privat lain) agar dapat dipanggil langsung dari atribut \`onclick=""\` di elemen HTML.
    - Semua tombol form WAJIB menggunakan \`type="button"\` (atau form menggunakan \`onsubmit="event.preventDefault();"\`) agar saat tombol diklik TIDAK terjadi reload halaman yang menghapus memory state.`;

    // ATURAN KHUSUS TAHAP:
    if (stage === 'TAHAP_1_PEMBUKAAN') {
      systemPrompt += `\n\nATURAN TAHAP 1 (PEMBUKAAN SINGKAT):
- Gali SEDIKIT detail minimal untuk membangun mockup pertama (jenis aplikasi, target user, 2-3 fitur inti).
- SATU pertanyaan per giliran, maksimal 2-4 pertanyaan fokus singkat secara dinamis.
- JANGAN langsung tampilkan checklist formal di awal.
- ATURAN KHUSUS "BUATKAN LANGSUNG": Jika pengguna mengatakan "buatkan saja", "terserah kamu", "kamu putuskan sendiri", "buatkan langsung", "tanpa tanya lagi", atau sejenisnya di tengah percakapan, AI WAJIB LANGSUNG MEMBUAT KODE HTML MOCKUP LENGKAP DALAM BLOK \`\`\`html ... \`\`\`. DILARANG KERAS menanyakan pertanyaan lanjutan atau hanya memberikan teks ringkasan!`;
    } else if (stage === 'TAHAP_5_PATCH') {
      systemPrompt += `\n\nATURAN TAHAP 5 (PEMBARUAN FITUR / REVISI / PATCH) - VALIDASI FUNGSIONAL WAJIB (NFR-10b):
- Pengguna meminta revisi/patch (misal: ubah warna, tambah kolom, ganti teks).
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
        max_tokens: 2500,
        temperature: 0.5
      })
    });

    let data = await response.json();
    let assistantMessage = data.choices?.[0]?.message?.content || '';
    let finishReason = data.choices?.[0]?.finish_reason;

    // ANTI-CUTOFF EFISIEN (Maksimal 1 kali lanjutan cepat agar aman dari batas 60 detik)
    let retryCount = 0;
    const maxRetries = 1;

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
          max_tokens: 1800,
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

    // NFR-10b: Pemeriksaan Integritas Fungsionalitas Otomatis
    if (validated && validated.repairedCode && validated.repairedCode.html) {
      const finalHtml = validated.repairedCode.html;
      const hasScriptTag = finalHtml.includes('<script>') || finalHtml.includes('<script ');
      const hasRenderFunction = finalHtml.includes('function render') || finalHtml.includes('render()');
      
      // Jika saat revisi script JS tidak sengaja hilang, coba minta perbaikan satu kali (NFR-10b)
      if (currentCode && (!hasScriptTag || !hasRenderFunction)) {
        console.warn('NFR-10b triggered: Script was dropped during revision, requesting immediate AI functional recovery.');
        const repairPrompt = [
          ...messages,
          { role: 'assistant', content: assistantMessage },
          { role: 'user', content: 'PERINGATAN NFR-10b: Kode yang Anda berikan tidak menyertakan script JavaScript fungsional (<script> atau render()). Mohon gabungkan kembali perubahan styling/HTML tersebut dengan seluruh script JavaScript interaktif (array data 3-5 item, tambah, edit, hapus, modal) dan berikan kode HTML utuh dalam ```html ... ```.' }
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
            max_tokens: 3500,
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

    const hasValidCode = Boolean(validated && validated.repairedCode && validated.repairedCode.html && validated.repairedCode.html.trim().length > 0);

    // Format Pesan Teks Chat Bersih & Jujur
    let cleanReplyText = '';
    if (match) {
      if (hasValidCode) {
        cleanReplyText = assistantMessage.replace(/```html[\s\S]*?```/, '\n\n✨ **Prototipe aplikasi berhasil diperbarui dan dimuat langsung ke Canvas Preview.**').trim();
      } else {
        cleanReplyText = 'Maaf, pembuatan/pembaruan kode belum berhasil memenuhi standar validasi fungsional. Silakan kirimkan instruksi ulang.';
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
