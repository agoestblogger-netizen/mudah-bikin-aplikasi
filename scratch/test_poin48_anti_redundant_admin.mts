// Helper membaca SSE stream dari /api/generate
async function fetchStreamReply(promptText: string, history: any[]): Promise<string> {
  const res = await fetch('http://localhost:3000/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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

async function testPoin48() {
  console.log('=== TEST POIN 48: ANTI-REDUNDAN USULAN ROLE ADMIN ===\n');

  // SKENARIO 1 (Kasus Bug yang Dilaporkan): "Aplikasi klinik dokter umum dan dokter gigi"
  console.log('--- SKENARIO 1: "Aplikasi klinik dokter umum dan dokter gigi" ---');
  const prompt1 = 'Aplikasi klinik dokter umum dan dokter gigi';
  const reply1 = await fetchStreamReply(prompt1, []);

  console.log(`Reply Skenario 1:\n${reply1}\n`);

  const hasAdminInRoleList = /\b(?:Admin|Owner|Manager)\b/i.test(reply1);
  const hasRedundantAdminOffer = /(?:Selain\s+(?:itu|peran|role)[^\n]*?(?:butuh|menambahkan|perlu|sangat\s+berguna)[^\n]*?(?:role\s+)?(?:admin|super\s*admin)[^\n]*?\?)/i.test(reply1);

  console.log(`[Cek 1.1] Role Admin Ada di Daftar Usulan: ${hasAdminInRoleList ? '✅ ADA' : 'ℹ️ TIDAK DI LIST'}`);
  console.log(`[Cek 1.2] Paragraf Tawaran Admin Redundan di Bawah: ${!hasRedundantAdminOffer ? '✅ BERSIH (TIDAK REDUNDAN)' : '❌ MUNCUL BUG REDUNDAN'}`);

  // SKENARIO 2 (Regresi Poin 47): 4 Role Operasional Murni Tanpa Admin ("Dokter, Receptionist, Staf Farmasi, Pasien")
  console.log('\n--- SKENARIO 2: 4 Role Operasional Tanpa Admin (Harus Tetap Ditawarkan) ---');
  const prompt2 = 'buatkan aplikasi antrean dan layanan klinik dengan 4 role: Dokter, Receptionist, Staf Farmasi, dan Pasien';
  const reply2 = await fetchStreamReply(prompt2, []);

  console.log(`Reply Skenario 2:\n${reply2}\n`);

  const offersAdminInPureOps = /admin|super\s*admin|owner|pengawas/i.test(reply2) && (reply2.toLowerCase().includes('kelola') || reply2.toLowerCase().includes('akun') || reply2.toLowerCase().includes('parameter') || reply2.toLowerCase().includes('layanan') || reply2.toLowerCase().includes('harga') || reply2.toLowerCase().includes('staf'));
  console.log(`[Cek 2.1] AI Tetap Proaktif Menawarkan Admin pada 4 Role Operasional: ${offersAdminInPureOps ? '✅ SUKSES DITAWARKAN' : '❌ REGRESI / HILANG'}`);

  console.log('\n============================================================');
  console.log('🎉 SEMUA PENGUJIAN POIN 48 SELESAI!');
  console.log('============================================================\n');
}

testPoin48().catch(console.error);
