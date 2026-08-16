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

    // BASE SYSTEM PROMPT DENGAN 11 PRINSIP TERVALIDASI
    let systemPrompt = `Anda adalah AI Generator Aplikasi dari platform "Mudah Bikin Aplikasi" (Basic Tier / MVP).
Tugas Anda adalah memandu pengguna non-programmer melalui 6 Tahap Sesi Mockup.

11 PRINSIP TERVALIDASI WAJIB:
1. ARSITEKTUR STATE: Semua data (maksimal 3-5 item contoh) di 1 array/object JS di memori. Render via render().
2. FUNGSIONAL PENUH: Tombol aksi memanipulasi state asli dan memanggil render() di baris terakhir. Tipe data ID konsisten string.
3. ANTI-CUTOFF: Render loop .map(), 3-5 item dummy.
4. 3 CHECKLIST EKSPLISIT: Data, Tombol/Aksi, Login/Akses.
5. FITUR ADMIN DI-GATE: Fitur Tambah User aktif tapi tersembunyi di balik role Admin.
6. LOGIN TANPA KREDENSIAL DEFAULT: Dilarang pakai admin/123 global.
7. DILARANG confirm(), alert(), prompt() BAWAAN BROWSER: Wajib gunakan modal/banner HTML kustom.
8. DUMMY DATA BARRIER: Data contoh mockup tidak dikirim ke Google Sheets sungguhan.
9. OPTIMISTIC UI DENGAN ROLLBACK: Update instan + rollback jika error.
10. BACKEND FAILSAFE GAS: Multi-tab setup + LockService + Content-Type: text/plain.
11. FORMAT KODE: Berikan kode HTML utuh di dalam blok: \`\`\`html ... \`\`\`.`;

    // ATURAN KHUSUS PER TAHAP SESUAI PRD:
    if (stage === 'TAHAP_1_PEMBUKAAN') {
      systemPrompt += `\n\nATURAN TAHAP 1 (PEMBUKAAN SINGKAT):
- Gali SEDIKIT detail minimal untuk membangun mockup pertama (jenis aplikasi, target user, 2-3 fitur inti).
- SATU pertanyaan per giliran, maksimal 2-4 pertanyaan fokus singkat secara dinamis.
- JANGAN langsung tampilkan checklist formal di awal.
- ATURAN KHUSUS "BUATKAN LANGSUNG": Jika pengguna mengatakan "buatkan saja", "terserah kamu", "kamu putuskan sendiri", "buatkan langsung", "tanpa tanya lagi", atau sejenisnya di tengah percakapan, AI WAJIB LANGSUNG MEMBUAT KODE HTML MOCKUP LENGKAP DALAM BLOK \`\`\`html ... \`\`\`. DILARANG KERAS menanyakan pertanyaan lanjutan atau hanya memberikan teks ringkasan!`;
    } else if (stage === 'TAHAP_5_PATCH') {
      systemPrompt += `\n\nATURAN TAHAP 5 (PEMBARUAN FITUR / PATCH):
- Pengguna meminta penambahan/revisi fitur baru.
- JANGAN merombak atau generate ulang semua konsep dari awal tanpa alasan.
- Berikan PENJELASAN SINGKAT bagian yang berubah + KODE HTML LENGKAP TER-UPDATE (agar preview iframe tetap bisa me-render file utuh).`;
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

    // OpenAI Server-Side Dynamic API Call
    const messages = [
      { role: 'system', content: systemPrompt },
      ...(chatHistory || []).map((m: any) => ({
        role: m.sender === 'USER' ? 'user' : 'assistant',
        content: m.text
      })),
      { role: 'user', content: prompt }
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
        max_tokens: 3500,
        temperature: 0.6
      })
    });

    let data = await response.json();
    let assistantMessage = data.choices?.[0]?.message?.content || '';
    let finishReason = data.choices?.[0]?.finish_reason;

    // ANTI-CUTOFF 2 LAPIS (DIPERBAIKI: Menggunakan hitungan backtick genap/ganjil untuk mencegah false-positive retry loop)
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      const isFinishReasonLength = finishReason === 'length';
      
      // Cek apakah ada blok kode html yang belum tertutup
      const backtickMatches = assistantMessage.match(/```/g) || [];
      const isCodeBlockUnclosed = assistantMessage.includes('```html') && (backtickMatches.length % 2 !== 0);

      // Jika tidak ada cutoff dan blok kode sudah tertutup, keluar dari loop
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
          max_tokens: 2500,
          temperature: 0.3
        })
      });

      const contData = await contResponse.json();
      const contText = contData.choices?.[0]?.message?.content || '';
      finishReason = contData.choices?.[0]?.finish_reason;

      // Jika AI menolak/tidak bisa melanjutkan (misal sudah selesai), jangan append duplikasi kalimat penolakan
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

    const validated = htmlCode ? validateAndRepairGeneratedCode(htmlCode, '', '') : null;
    const hasValidCode = Boolean(validated && validated.repairedCode && validated.repairedCode.html && validated.repairedCode.html.trim().length > 0);

    // Format Pesan Teks Chat Bersih & Jujur
    let cleanReplyText = '';
    if (match) {
      if (hasValidCode) {
        // Ganti blok kode di chat dengan notifikasi sukses yang informatif
        cleanReplyText = assistantMessage.replace(/```html[\s\S]*?```/, '\n\n✨ **Prototipe aplikasi berhasil dibangun dan telah dimuat langsung ke Canvas Preview di panel kanan.**').trim();
      } else {
        // Jika kode kosong / gagal divalidasi, laporkan dengan jujur
        cleanReplyText = 'Maaf, prototipe kode belum berhasil dibuat dengan lengkap. Silakan kirimkan instruksi ulang.';
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
