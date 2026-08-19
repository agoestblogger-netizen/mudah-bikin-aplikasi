async function inspectBrief() {
  console.log('=== INSPEKSI HASIL BRIEF KEBUTUHAN KLINIK (FASE D-1) ===\n');

  const resKlinik = await fetch('http://localhost:3000/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: 'ya sudah sesuai dan pas, buatkan brief kebutuhannya',
      chatHistory: [
        { sender: 'USER', text: 'buatkan aplikasi klinik umum pratama' },
        { sender: 'AI', text: 'Untuk klinik, ada peran Pasien, Dokter, dan Resepsionis...' },
        { sender: 'USER', text: 'ya sudah sesuai dan pas, buatkan brief kebutuhannya' }
      ],
      stage: 'TAHAP_1_PEMBUKAAN',
      currentCode: null
    })
  });

  console.log('Response Status:', resKlinik.status);
  console.log('Response Content-Type:', resKlinik.headers.get('Content-Type'));
  const rawText = await resKlinik.text();
  console.log('Raw text length:', rawText.length);
  if (resKlinik.status !== 200) {
    console.log('Raw error response:', rawText);
  }
  const lines = rawText.split('\n');
  let fullMessage = '';

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      try {
        const parsed = JSON.parse(line.slice(6));
        if (parsed.type === 'chunk' && parsed.text) {
          fullMessage += parsed.text;
        }
      } catch (e) {}
    }
  }

  console.log('--- HASIL PENUH BRIEF KEBUTUHAN (KLINIK) ---\n');
  console.log(fullMessage);
  console.log('\n--------------------------------------------\n');

  // Evaluasi 4 Aspek Wajib:
  console.log('=== EVALUASI ATURAN UX FASE D-1 ===');
  console.log('1. Format Baku Brief Kebutuhan (Tanpa field baru liar):', fullMessage.includes('📋 **Brief Kebutuhan**'));
  console.log('2. Role Pasien memiliki fokus nomor antrean & info waktu:', /nomor\s+antrean|waktu\s+tunggu|posisi/i.test(fullMessage));
  console.log('3. Role Dokter memiliki fokus pasien berikutnya & panggil/periksa:', /pasien\s+saat\s+ini|berikutnya|panggil|periksa|rekam\s+medis/i.test(fullMessage));
  console.log('4. Role Resepsionis/Admin memiliki fokus pendaftaran & rekap antrean:', /pendaftaran|rekap|master|daftar\s+pasien/i.test(fullMessage));
  console.log('5. Pertanyaan konfirmasi akhir muncul sempurna (tidak terpotong):', /apakah.*brief.*sesuai/i.test(fullMessage));
}

inspectBrief().catch(console.error);
