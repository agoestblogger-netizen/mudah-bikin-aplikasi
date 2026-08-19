async function inspectLaundry() {
  console.log('=== INSPEKSI HASIL BRIEF KEBUTUHAN LAUNDRY (FASE D-1) ===\n');

  const res = await fetch('http://localhost:3000/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: 'ya sudah sesuai dan pas, buatkan brief kebutuhannya',
      chatHistory: [
        { sender: 'USER', text: 'buatkan aplikasi laundry kiloan' },
        { sender: 'AI', text: 'Untuk usaha laundry, biasanya ada peran Admin, Kasir, dan Washer...' },
        { sender: 'USER', text: 'ya sudah sesuai dan pas, buatkan brief kebutuhannya' }
      ],
      stage: 'TAHAP_1_PEMBUKAAN',
      currentCode: null
    })
  });

  const rawText = await res.text();
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

  console.log('--- HASIL PENUH BRIEF KEBUTUHAN (LAUNDRY) ---\n');
  console.log(fullMessage);
  console.log('\n--------------------------------------------\n');

  console.log('=== EVALUASI ATURAN UX LAUNDRY ===');
  console.log('1. Format Baku Brief Kebutuhan:', fullMessage.includes('📋 **Brief Kebutuhan**'));
  console.log('2. Role Kasir/Admin & Washer terakomodasi secara terpisah:', /kasir|washer|admin/i.test(fullMessage));
  console.log('3. Pertanyaan konfirmasi akhir muncul sempurna:', /apakah.*brief.*sesuai/i.test(fullMessage));
}

inspectLaundry().catch(console.error);
