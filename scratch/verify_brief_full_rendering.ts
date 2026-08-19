async function verifyBriefRendering() {
  console.log('=== VERIFIKASI PENUH LEMBAR BRIEF KEBUTUHAN (4 ROLE SMARTLAUNDRY PRO) ===\n');

  const detailedPrompt = `Saya ingin membuat aplikasi SmartLaundry Pro untuk bisnis laundry kiloan dan satuan.
Target pengguna ada 4 peran: Admin/Owner, Kasir, Petugas Cuci (Washer), dan Pelanggan.
Fiturnya:
- Admin: dashboard omset harian/bulanan, grafik performa, kelola user & tarif layanan, laporan keuangan
- Kasir: form order baru, keranjang layanan cuci/setrika/express, kalkulator bayar tunai/QRIS, cetak nota
- Washer: papan antrian cuci masuk, update status cucian (antri, cuci, kering, setrika, siap ambil)
- Pelanggan: portal lacak resi cucian dan riwayat order`;

  console.log('1. Mengirim permintaan perancangan detail ke https://www.mudahbikinapps.store/api/generate...');
  const start = performance.now();
  let ttft = 0;
  let receivedText = '';

  const res = await fetch('https://www.mudahbikinapps.store/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: detailedPrompt,
      stage: 'TAHAP_1_PEMBUKAAN',
      chatHistory: [],
      currentCode: ''
    })
  });

  console.log(`   - HTTP Status: ${res.status}`);
  console.log(`   - Content-Type: ${res.headers.get('content-type')}`);

  if (res.body) {
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      if (ttft === 0) {
        ttft = performance.now() - start;
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
            receivedText += parsed.text;
          } else if (parsed.type === 'done') {
            receivedText = parsed.replyText || receivedText;
          }
        } catch (_) {}
      }
    }
  }

  const totalTime = performance.now() - start;
  console.log(`\n2. Metrik Performa Streaming:`);
  console.log(`   - Time to First Token (TTFT): ${(ttft / 1000).toFixed(3)} detik (${ttft < 2000 ? '✅ Lolos < 2 detik' : '❌ Melebihi 2 detik'})`);
  console.log(`   - Total Waktu Respons: ${(totalTime / 1000).toFixed(3)} detik`);
  console.log(`   - Panjang Teks Diterima: ${receivedText.length} karakter (~${Math.round(receivedText.length / 4)} tokens)`);

  console.log(`\n3. Verifikasi Kelengkapan Field Lembar Brief Kebutuhan:`);
  const checkField = (name: string, pattern: RegExp) => {
    const found = pattern.test(receivedText);
    console.log(`   * Field "${name}": ${found ? '✅ Ditemukan Lengkap' : '❌ TIDAK DITEMUKAN / TERPOTONG'}`);
    return found;
  };

  const hasNamaApp = checkField('Nama App', /Nama App/i);
  const hasOrientasi = checkField('Orientasi UI', /Orientasi UI/i);
  const hasTema = checkField('Tema Visual', /Tema Visual/i);
  const hasFitur = checkField('Fitur Utama (V1)', /Fitur Utama \(V1\)/i);
  const hasRoadmap = checkField('Roadmap Lanjutan (V2/V3)', /Roadmap Lanjutan/i);
  const hasJobDesc = checkField('Job Description & Struktur Halaman per Role', /Job Description/i);
  const hasAdmin = checkField('Role Admin', /Admin/i);
  const hasKasir = checkField('Role Kasir', /Kasir/i);
  const hasWasher = checkField('Role Washer / Petugas', /Washer|Petugas/i);
  const hasPelanggan = checkField('Role Pelanggan', /Pelanggan/i);
  const hasConfirmationQ = checkField('Pertanyaan Konfirmasi Akhir', /Apakah Brief Kebutuhan|Apakah lembar Brief/i);

  const allComplete = hasNamaApp && hasOrientasi && hasTema && hasFitur && hasRoadmap && hasJobDesc && hasAdmin && hasKasir && hasWasher && hasPelanggan && hasConfirmationQ;
  console.log(`\n4. Status Integritas Akhir: ${allComplete ? '🎉 SEMUA FIELD LENGKAP TANPA POTONGAN' : '⚠️ ADA FIELD YANG HILANG'}`);

  console.log('\n--- PREVIEW TEKS LENGKAP BRIEF KEBUTUHAN ---');
  console.log(receivedText);
}

verifyBriefRendering().catch(console.error);
