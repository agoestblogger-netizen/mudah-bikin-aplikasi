import { detectMatchingMasterTemplate, formatTemplateContextForIdeation, getConciseCatalogSummary } from '../src/lib/templates';

async function measureIdeation() {
  console.log('=== INVESTIGASI REGRESI PERFORMA DISKUSI (TAHAP 1) ===\n');

  const prompt = 'buatkan aplikasi laundry';
  const stage = 'TAHAP_1_PEMBUKAAN';

  // 1. Ukur Waktu Eksekusi Matching MT di Node.js
  const t0 = performance.now();
  const matchedMT = detectMatchingMasterTemplate(prompt);
  const catalogSummary = getConciseCatalogSummary();
  const blueprintContext = matchedMT ? formatTemplateContextForIdeation(matchedMT) : '';
  const tMatching = performance.now() - t0;

  console.log('1. Analisis Template Matching:');
  console.log(`   - Waktu Matching CPU: ${tMatching.toFixed(3)} ms (Sangat cepat/instan)`);
  console.log(`   - Matched MT: ${matchedMT?.template?.id || 'None'} - ${matchedMT?.template?.nama || 'None'}`);

  console.log(`   - Panjang Blueprint Context: ${blueprintContext.length} chars (${blueprintContext.split('\n').length} baris)`);
  console.log(`   - Panjang Catalog Summary: ${catalogSummary.length} chars (${catalogSummary.split('\n').length} baris)`);

  // 2. Bangun IDEATION_SYSTEM_PROMPT
  const baseIdeationPrompt = `Anda adalah Konsultan Aplikasi AI dari platform "Mudah Bikin Aplikasi".
Tugas Anda pada tahap ini adalah mendiskusikan, menggali, dan mempertajam ide aplikasi bersama pengguna (Sub-langkah 1-4 Eksplorasi Ide).

ATURAN MUTLAK PERCAKAPAN (WAJIB DIPATUHI):
1. DILARANG KERAS menghasilkan blok kode HTML, CSS, JavaScript, atau blok \`\`\`html ... \`\`\`!
2. DILARANG KERAS menyebutkan kata-kata teknis seperti "saya akan berikan kode HTML", "generate kode", "fitur CRUD", "data dummy", "syntax error", atau janji teknis apa pun tentang pembuatan kode!
3. Format respons WAJIB MURNI TEKS PERCAKAPAN SANTAI & RAMAH (2-4 kalimat singkat dan nyaman dibaca):
   - Sapa dan akui ide pengguna dengan antusias.
   - DALAMI & PERTAJAM (Sub-langkah 2): Berikan 1 masukan/saran fitur proaktif yang relevan.
   - TANYAKAN ROLE & USULKAN BREAKDOWN SECTION: Jika aplikasi kemungkinan punya multi-role (misal laundry punya Kasir+Washer+Admin), PROAKTIF tanyakan pembagian peran dan USULKAN halaman/section utama tiap role — contoh: "Untuk laundry seperti ini, biasanya ada 3 peran: Admin (Dashboard statistik & Kelola Master), Kasir (Input Pesanan & Pembayaran Tagihan), dan Washer (Antrian Cucian & Update Status Cuci). Apakah pembagian halaman dan tugas tiap role ini sudah pas?"
   - AJUKAN TEPAT SATU PERTANYAAN FOKUS (DILARANG borongan banyak pertanyaan sekaligus).
4. JANGAN tampilkan form Brief Kebutuhan dan JANGAN buat kode di giliran ini.`;

  const fullPromptWithBlueprint = `${baseIdeationPrompt}\n\n${blueprintContext}`;
  console.log('\n2. Ukuran IDEATION_SYSTEM_PROMPT:');
  console.log(`   - Base Prompt: ${baseIdeationPrompt.length} chars (${baseIdeationPrompt.split('\n').length} baris)`);
  console.log(`   - Total dengan Blueprint Context: ${fullPromptWithBlueprint.length} chars (${fullPromptWithBlueprint.split('\n').length} baris, ~${Math.round(fullPromptWithBlueprint.length / 4)} tokens)`);

  // 3. Uji Waktu Respons Langsung ke Endpoint Streaming SSE
  console.log('\n3. Mengukur Waktu Respons Streaming Langsung (TTFT & Total Waktu):');

  const startStream = performance.now();
  let ttft = 0;
  let chunkCount = 0;
  let receivedText = '';

  const res = await fetch('https://www.mudahbikinapps.store/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: 'buatkan aplikasi laundry',
      stage: 'TAHAP_1_PEMBUKAAN',
      chatHistory: [],
      currentCode: ''
    })
  });

  const contentType = res.headers.get('content-type') || '';
  console.log(`   - HTTP Status: ${res.status}`);
  console.log(`   - Content-Type Header: ${contentType} (${contentType.includes('text/event-stream') ? '✅ SSE Streaming Aktif' : '❌ Non-Streaming JSON'})`);

  if (res.body) {
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      if (ttft === 0) {
        ttft = performance.now() - startStream;
      }

      buffer += dec.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const raw = line.slice(5).trim();
        if (raw === '[DONE]') continue;
        try {
          const parsed = JSON.parse(raw);
          if (parsed.type === 'chunk') {
            chunkCount++;
            receivedText += parsed.text;
          }
        } catch (_) {}
      }
    }
  }

  const totalStreamTime = performance.now() - startStream;
  console.log(`   - Time to First Token (TTFT): ${(ttft / 1000).toFixed(3)} detik`);
  console.log(`   - Total Streaming Time: ${(totalStreamTime / 1000).toFixed(3)} detik`);
  console.log(`   - Jumlah Chunks Diterima: ${chunkCount}`);
  console.log(`   - Output Text (Pertama 200 karakter):\n     "${receivedText.slice(0, 200).replace(/\n/g, ' ')}..."`);
}

measureIdeation().catch(console.error);
