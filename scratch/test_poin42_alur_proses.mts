/**
 * TEST POIN 42 — Verifikasi "Alur Proses" muncul di Brief Kebutuhan
 * Skenario: Klinik 3-Role (Dokter, Staf Klinik, Pasien)
 */
async function testAlurProses() {
  console.log('=== TEST POIN 42: Alur Proses di Brief Kebutuhan ===\n');

  const res = await fetch('http://localhost:3000/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: 'buatkan aplikasi antrian klinik dengan 3 role: Dokter, Staf Klinik, dan Pasien. Saya ingin dokter bisa input diagnosa, staf klinik bisa panggil antrean dan kelola layanan, pasien bisa cek status antrean mereka.',
      chatHistory: [],
      stage: 'TAHAP_1_PEMBUKAAN',
      currentCode: null
    })
  });

  const text = await res.text();

  // Parse SSE stream: ambil semua data: {...} events
  let reply = '';
  let lastJson: any = null;
  const lines = text.split('\n');
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      try {
        const payload = JSON.parse(line.slice(6));
        if (payload.replyText) reply += payload.replyText;
        if (payload.type === 'done' || payload.success !== undefined) {
          lastJson = payload;
        }
      } catch {}
    }
  }

  if (!reply && lastJson?.replyText) reply = lastJson.replyText;
  if (!reply) {
    console.error('Tidak ada reply ditemukan. Raw response (500 chars):', text.substring(0, 500));
    return;
  }

  console.log('=== REPLY AI (trimmed 3000 chars) ===');
  console.log(reply.substring(0, 3000));
  console.log('\n...\n');

  const hasAlurProses = (reply.match(/Alur Proses/g) || []).length;
  console.log(`\n=== VALIDASI ===`);
  console.log(`Jumlah "Alur Proses" ditemukan di Brief: ${hasAlurProses}`);
  console.log(`Ada tanda panah →: ${reply.includes('→') ? '✅' : '❌'}`);
  console.log(`Brief tidak terpotong (ada konfirmasi di akhir): ${(reply.includes('sudah sesuai') || reply.includes('apakah')) ? '✅' : '❌'}`);

  if (hasAlurProses >= 2) {
    console.log('\n✅ PASS: Alur Proses hadir di Brief Kebutuhan untuk minimal 2 role');
  } else {
    console.log('\n❌ FAIL: Alur Proses tidak lengkap atau tidak muncul');
  }
}

testAlurProses().catch(console.error);
