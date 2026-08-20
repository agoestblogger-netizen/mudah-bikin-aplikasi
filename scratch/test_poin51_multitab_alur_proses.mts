// Test Poin 51: Multi-Tab Alur Proses Verification
async function fetchStreamReply(promptText: string, history: any[] = [], ip: string = '127.0.0.1'): Promise<string> {
  const res = await fetch('http://localhost:3000/api/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': ip
    },
    body: JSON.stringify({
      prompt: promptText,
      chatHistory: history,
      stage: 'TAHAP_1_PEMBUKAAN',
      currentCode: null
    })
  });

  const bodyText = await res.text();
  let accumulatedText = '';
  let finalDoneText = '';

  const lines = bodyText.split('\n');
  for (const line of lines) {
    if (line.startsWith('data: ') && line !== 'data: [DONE]') {
      try {
        const json = JSON.parse(line.substring(6));
        if (json.type === 'chunk' && json.text) {
          accumulatedText += json.text;
        } else if (json.type === 'done' && json.replyText) {
          finalDoneText = json.replyText;
        }
      } catch (_) {}
    }
  }

  return finalDoneText || accumulatedText;
}

async function runTest() {
  console.log('=== TEST POIN 51: MULTI-TAB ALUR PROSES DALAM BRIEF KEBUTUHAN ===\n');

  // Giliran 1: Eksplorasi
  console.log('1. Mengirim ide klinik...');
  const reply1 = await fetchStreamReply('Aplikasi klinik dokter umum dan dokter gigi', [], '10.51.1.1');
  console.log('Balasan Eksplorasi Ringkas:\n', reply1.slice(0, 300) + '...\n');

  // Giliran 2: Minta Generate Brief Kebutuhan
  console.log('2. Menyetujui usulan peran dan meminta lembar Brief Kebutuhan...');
  const chatHistory = [
    { sender: 'USER', text: 'Aplikasi klinik dokter umum dan dokter gigi' },
    { sender: 'AI', text: reply1 }
  ];

  const briefReply = await fetchStreamReply('Sudah pas dan setuju, tolong buatkan lembar Brief Kebutuhannya sekarang', chatHistory, '10.51.1.2');

  console.log('\n============================================================');
  console.log('📋 HASIL LEMBAR BRIEF KEBUTUHAN YANG DIGENERATE:');
  console.log('============================================================\n');
  console.log(briefReply);

  // Verifikasi Poin 51:
  console.log('\n============================================================');
  console.log('🔍 VERIFIKASI MULTI-TAB ALUR PROSES:');
  console.log('============================================================');

  // Cek apakah Brief lengkap & tidak terpotong
  const isBriefComplete = briefReply.includes('Brief Kebutuhan') && (briefReply.includes('Apakah') || briefReply.includes('prototipe'));
  console.log(`- Brief Utuh & Tidak Terpotong: ${isBriefComplete ? '✅ YA' : '❌ TIDAK'}`);

  // Ekstrak section Job Description & Struktur Halaman
  const jobDescMatch = briefReply.match(/(?:Job Description|Struktur Halaman)[^\n]*\n([\s\S]*?)(?=\n\s*(?:Apakah|Fitur Utama|Roadmap|Fitur Unik|Catatan|$))/i);
  const jobDescText = jobDescMatch ? jobDescMatch[1] : briefReply;

  // Analisis per role
  const roleBlocks = jobDescText.split(/(?=\*\s+\*\*)/).filter(b => b.trim().startsWith('*'));

  console.log(`- Ditemukan ${roleBlocks.length} role di dalam Brief.\n`);

  let allMultiTabRolesValid = true;

  for (const block of roleBlocks) {
    const roleNameMatch = block.match(/\*\s+\*\*\[?([^\]:\*\n]+)\]?\*\*\s*:/);
    const roleName = roleNameMatch ? roleNameMatch[1].trim() : 'Unknown';

    // Hitung jumlah halaman/tab
    const tabMatches = block.match(/-\s+\[?[^\]\n]+\]?\s*(?:\([^)]*\))?\s*:\s*section/gi) || [];
    const tabCount = tabMatches.length;

    // Ambil baris Alur Proses
    const alurMatch = block.match(/-\s+\*\*Alur\s+Proses[^*]*\*\*\s*:\s*([^\n]+)/gi) || [];
    const alurText = alurMatch.join(' ');

    console.log(`• Role: "${roleName}" (${tabCount} Tab)`);
    console.log(`  Alur: ${alurText}`);

    if (tabCount >= 2) {
      // Role punya 2+ tab: Alur Proses WAJIB menyebut Tab 2 / perpindahan tab / atau punya 2 baris alur
      const mentionsTab2OrSwitch = /(?:buka\s+tab|tab\s+2|\(tab\s+2\)|pindah\s+ke|halaman\s+2|laporan|riwayat|hasil|jadwal|antrean|monitor)/i.test(alurText) || alurMatch.length >= 2;
      if (mentionsTab2OrSwitch) {
        console.log(`  Status: ✅ PASS (Melibatkan kedua tab / perpindahan tab)`);
      } else {
        console.log(`  Status: ❌ FAIL (Hanya menggambarkan Tab 1, tidak melibatkan Tab 2)`);
        allMultiTabRolesValid = false;
      }
    } else {
      console.log(`  Status: ✅ PASS (Single-tab role)`);
    }
    console.log('');
  }

  if (isBriefComplete && allMultiTabRolesValid) {
    console.log('🎉 SEMUA ROLE MULTI-TAB BERHASIL MEMENUHI ATURAN POIN 51!');
  } else {
    console.error('⚠️ MASIH ADA ROLE YANG TIDAK MEMENUHI POIN 51.');
    process.exit(1);
  }
}

runTest().catch(console.error);
