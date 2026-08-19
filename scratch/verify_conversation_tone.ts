async function verifyTone() {
  console.log('=== VERIFIKASI NADA KOMUNIKASI AI DI GILIRAN AWAL (PROAKTIF USULKAN SOLUSI) ===\n');

  console.log('1. Menguji giliran pertama dengan prompt singkat: "buatkan aplikasi laundry"...');
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

  let fullReply = '';
  if (res.body) {
    const reader = res.body.getReader();
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
          if (parsed.type === 'chunk') fullReply += parsed.text;
          else if (parsed.type === 'done') fullReply = parsed.replyText || fullReply;
        } catch (_) {}
      }
    }
  }

  console.log('\n--- HASIL RESPON AI (GILIRAN 1) ---');
  console.log(fullReply);
  console.log('-----------------------------------\n');

  console.log('2. Evaluasi Nada dan Kualitas Penyampaian:');
  const hasBurdensomeQuestion = /apakah sudah (anda|kamu) (pikirkan|pertimbangkan|siapkan)|bagaimana konsep yang anda inginkan/i.test(fullReply);
  console.log(`   - Tidak ada pertanyaan membebani user: ${!hasBurdensomeQuestion ? '✅ LOLOS (Bebas dari nada membebani)' : '❌ GAGAL (Masih ada pertanyaan membebani)'}`);

  const hasConcreteRoles = /Admin/i.test(fullReply) && /Kasir/i.test(fullReply) && (/Washer/i.test(fullReply) || /Petugas/i.test(fullReply));
  console.log(`   - Mengusulkan peran konkret secara proaktif: ${hasConcreteRoles ? '✅ LOLOS (Admin, Kasir, Washer disebut konkret)' : '❌ GAGAL'}`);

  const hasGentleConfirmation = /sudah (cukup )?(pas|sesuai|cocok)|ada (peran|fitur|penyesuaian) lain/i.test(fullReply);
  console.log(`   - Kalimat penutup berupa konfirmasi ringan: ${hasGentleConfirmation ? '✅ LOLOS (Konfirmasi ringan)' : '❌ GAGAL'}`);

  const isSuccess = !hasBurdensomeQuestion && hasConcreteRoles && hasGentleConfirmation;
  console.log(`\nStatus Evaluasi: ${isSuccess ? '🎉 SEMUA KRITERIA NADA KOMUNIKASI TERPENUHI' : '⚠️ PERLU PENYEMPURNAAN'}`);
}

verifyTone().catch(console.error);
