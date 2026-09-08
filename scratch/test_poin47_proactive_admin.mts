import { parseBriefKebutuhan } from '../src/components/BriefKebutuhanCard';

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

async function testPoin47() {
  console.log('=== TEST POIN 47: PROAKTIF PERIKSA KEBUTUHAN ROLE ADMIN/SUPER ADMIN (APP 3+ ROLE) ===\n');

  // SKENARIO 1: App Klinik 4 Role Operasional Tanpa Admin di Awal
  console.log('--- SKENARIO 1: App Klinik dengan 4 Role Operasional (Dokter, Receptionist, Staf Farmasi, Pasien) ---');
  const userPrompt1 = 'buatkan aplikasi antrean dan layanan klinik dengan 4 role: Dokter, Receptionist, Staf Farmasi, dan Pasien';
  const reply1 = await fetchStreamReply(userPrompt1, []);

  console.log(`Reply Skenario 1:\n${reply1}\n`);
  const mentionsAdminOffer = /admin|super\s*admin|owner|pengawas/i.test(reply1) && (reply1.toLowerCase().includes('kelola') || reply1.toLowerCase().includes('akun') || reply1.toLowerCase().includes('staf') || reply1.toLowerCase().includes('parameter') || reply1.toLowerCase().includes('tarif') || reply1.toLowerCase().includes('layanan'));
  console.log(`[Cek 1.1] AI Proaktif Menawarkan Role Admin/Super Admin: ${mentionsAdminOffer ? '✅ SUKSES DITAWARKAN' : '❌ GAGAL / DIAM SAJA'}`);

  // SKENARIO 2: User Menolak Tawaran Admin
  console.log('\n--- SKENARIO 2: User Menolak Tawaran Admin ("tidak perlu admin, cukup 4 role ini saja") ---');
  const userPrompt2 = 'tidak perlu role admin, cukup 4 role yang saya sebutkan tadi. Tolong buatkan lembar Brief Kebutuhannya.';
  const reply2 = await fetchStreamReply(userPrompt2, [
    { sender: 'USER', text: userPrompt1 },
    { sender: 'AI', text: reply1 }
  ]);

  console.log(`Reply Skenario 2 Length: ${reply2.length} chars`);
  const parsed2 = parseBriefKebutuhan(reply2);
  console.log(`Parsed Brief Roles Count: ${parsed2?.roles.length || 0}`);
  parsed2?.roles.forEach(r => console.log(`- Role: "${r.roleName}"`));
  const hasAdminForced = (parsed2?.roles || []).some(r => /admin|super\s*admin|owner/i.test(r.roleName));
  const all4RolesPresent = ['Dokter', 'Receptionist', 'Farmasi', 'Pasien'].every(keyword => (parsed2?.roles || []).some(r => r.roleName.toLowerCase().includes(keyword.toLowerCase())));
  console.log(`[Cek 2.1] AI Tidak Memaksakan Admin: ${!hasAdminForced ? '✅ SUKSES (Tanpa Admin)' : '❌ MASIH MEMAKSA ADMIN'}`);
  console.log(`[Cek 2.2] Ke-4 Role Tetap Lengkap di Brief: ${all4RolesPresent ? '✅ LENGKAP' : '❌ KURANG'}`);

  // SKENARIO 3: App 2 Role Sederhana (Kasir + Pembeli)
  console.log('\n--- SKENARIO 3: App 2 Role Sederhana (Toko Baju: Kasir + Pembeli) ---');
  const userPrompt3 = 'buatkan aplikasi kasir toko baju sederhana untuk 2 role: Kasir dan Pembeli';
  const reply3 = await fetchStreamReply(userPrompt3, []);

  console.log(`Reply Skenario 3:\n${reply3}\n`);
  const offersAdminIn2RoleApp = /butuh 1 role admin|tambahkan sebagai role admin|role tambahan admin/i.test(reply3);
  console.log(`[Cek 3.1] AI Tidak Menawarkan Admin pada App 2 Role: ${!offersAdminIn2RoleApp ? '✅ BENAR (Tidak Tawarkan Admin)' : '❌ SALAH (Memaksakan Admin pada App 2 Role)'}`);

  console.log('\n============================================================');
  console.log('🎉 SEMUA PENGUJIAN POIN 47 SELESAI!');
  console.log('============================================================\n');
}

testPoin47().catch(console.error);
