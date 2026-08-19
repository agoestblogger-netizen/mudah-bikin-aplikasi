async function verify3Scenarios() {
  console.log('=== VERIFIKASI 3 SKENARIO DIALOG DISKUSI & BRIEF KEBUTUHAN ===\n');

  async function testScenario(name: string, prompt: string, chatHistory: any[]) {
    console.log(`\n================================================================`);
    console.log(`👉 MENGUJI SKENARIO: ${name}`);
    console.log(`================================================================`);
    console.log(`- Prompt User Terakhir: "${prompt}"`);
    console.log(`- Riwayat Percakapan: ${chatHistory.length} pesan`);

    const start = performance.now();
    let ttft = 0;
    let receivedText = '';

    const res = await fetch('https://www.mudahbikinapps.store/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        stage: 'TAHAP_1_PEMBUKAAN',
        chatHistory,
        currentCode: ''
      })
    });

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
    console.log(`- Metrik Performa:`);
    console.log(`  * TTFT: ${(ttft / 1000).toFixed(3)} detik (${ttft < 2000 ? '✅ Lolos < 2s' : '⚠️ TTFT ' + (ttft/1000).toFixed(2) + 's'})`);
    console.log(`  * Total Waktu: ${(totalTime / 1000).toFixed(3)} detik`);
    console.log(`  * Panjang Output: ${receivedText.length} karakter`);

    const check = (fieldName: string, re: RegExp) => {
      const ok = re.test(receivedText);
      console.log(`  * ${fieldName}: ${ok ? '✅ LENGKAP' : '❌ HILANG/TERPOTONG'}`);
      return ok;
    };

    console.log(`- Pemeriksaan Kelengkapan Field:`);
    const c1 = check('Nama App', /Nama App/i);
    const c2 = check('Orientasi UI', /Orientasi UI/i);
    const c3 = check('Tema Visual', /Tema Visual/i);
    const c4 = check('Fitur Utama', /Fitur Utama/i);
    const c5 = check('Roadmap Lanjutan', /Roadmap Lanjutan/i);
    const c6 = check('Job Description & Struktur Halaman', /Job Description/i);
    const c7 = check('Role Breakdown', /Admin|Kasir|Washer|Petugas|Dokter/i);
    const c8 = check('Pertanyaan Konfirmasi Akhir', /Apakah Brief Kebutuhan|Apakah lembar Brief/i);

    const isSuccess = c1 && c2 && c3 && c4 && c5 && c6 && c7 && c8;
    console.log(`- Hasil Akhir Skenario: ${isSuccess ? '🎉 100% SUKSES LENGKAP' : '❌ GAGAL'}`);
    return isSuccess;
  }

  // Skenario A: Dialog Panjang / Detail Lengkap (SmartLaundry Pro)
  const okA = await testScenario(
    'SKENARIO A: Dialog Panjang / Detail Lengkap (SmartLaundry Pro)',
    'Saya ingin membuat aplikasi SmartLaundry Pro 4 peran: Admin, Kasir, Washer, Pelanggan. Fitur: dashboard omset, form order kasir, kalkulator bayar, papan antrian washer, dan portal lacak resi pelanggan.',
    []
  );

  // Skenario B: Dialog Pendek / Jawaban Vague Singkat (LaundryKu — Kasus yang gagal sebelumnya)
  const okB = await testScenario(
    'SKENARIO B: Dialog Pendek Jawaban Singkat (LaundryKu)',
    'ya sesuai sop usaha laundry saja',
    [
      { sender: 'USER', text: 'aplikasi laundry' },
      { sender: 'AI', text: 'Wah menarik! Untuk laundry biasanya ada 3 peran: Admin (Dashboard & Master), Kasir (Input Order & Pembayaran), dan Washer (Antrian Cucian). Apakah pembagian ini sudah pas?' },
      { sender: 'USER', text: 'ya sudah' },
      { sender: 'AI', text: 'Baik, bagaimana dengan rincian layanan seperti kiloan, satuan, dan express? Apakah ada tarif khusus yang ingin disepakati?' }
    ]
  );

  // Skenario C: Dialog Sedang (Klinik Medika — 2 giliran)
  const okC = await testScenario(
    'SKENARIO C: Dialog Sedang (Klinik Medika)',
    'iya pas ada 3 peran: Dokter, Apoteker, dan Kasir. Tolong buatkan brief kebutuhannya',
    [
      { sender: 'USER', text: 'buatkan aplikasi sistem klinik kesehatan' },
      { sender: 'AI', text: 'Ide yang sangat baik! Untuk klinik biasanya mencakup rekam medis pasien, antrian periksa, dan apotek. Apakah ada peran tertentu yang ingin dibagi?' }
    ]
  );

  console.log(`\n================================================================`);
  console.log(`RINGKASAN AKHIR 3 SKENARIO:`);
  console.log(`- Skenario A (Detail Panjang): ${okA ? '✅ LOLOS' : '❌ GAGAL'}`);
  console.log(`- Skenario B (Pendek Vague - LaundryKu): ${okB ? '✅ LOLOS' : '❌ GAGAL'}`);
  console.log(`- Skenario C (Sedang - Klinik): ${okC ? '✅ LOLOS' : '❌ GAGAL'}`);
  console.log(`================================================================`);
}

verify3Scenarios().catch(console.error);
