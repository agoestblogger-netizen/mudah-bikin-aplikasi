/**
 * Integration Test: Simulasi Alur API Guided dari START hingga ALUR
 * untuk Kasus Domain Ambigu (Toko Emas)
 */

import { POST } from '../src/app/api/guided/route';
import { NextRequest } from 'next/server';

let pass = 0;
let fail = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`✅ PASS: ${msg}`);
    pass++;
  } else {
    console.error(`❌ FAIL: ${msg}`);
    fail++;
  }
}

async function makeRequest(body: any): Promise<any> {
  const req = new NextRequest('http://localhost:3000/api/guided', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token',
    },
    body: JSON.stringify(body),
  });
  const res = await POST(req);
  return res.json();
}

console.log('--- TEST E2E 1: START dengan prompt ambigu "buatkan aplikasi toko emas" ---');
const startRes = await makeRequest({
  action: 'START',
  prompt: 'buatkan aplikasi toko emas'
});

assert(startRes.success === true, 'START response success === true');
assert(startRes.session?.step === 'STORYTELLING', 'Session step === STORYTELLING');
assert(
  Boolean(startRes.session?.storyline?.pendingDirectionClarification),
  'pendingDirectionClarification aktif di session'
);
assert(
  startRes.guidedStep?.options?.length === 3,
  'Kartu klarifikasi arah bisnis memiliki 3 opsi'
);
assert(
  startRes.guidedStep?.options?.some((o: any) => o.id === 'dir_both' && o.recommended),
  'Opsi dir_both tersedia dan direkomendasikan'
);
assert(
  startRes.narration?.includes('fokusnya menjual perhiasan'),
  'Narasi chat menampilkan pertanyaan klarifikasi arah bisnis'
);

console.log('\n--- TEST E2E 2: NEXT di STORYTELLING memilih "Dua-duanya" (dir_both) ---');
// Mengirim jawaban klarifikasi arah bisnis
const clarifyRes = await makeRequest({
  action: 'NEXT',
  stepId: 'STORYTELLING',
  session: startRes.session,
  selected: ['dir_both']
});

assert(clarifyRes.success === true, 'Klarifikasi NEXT success === true');
assert(clarifyRes.session?.step === 'STORYTELLING', 'Session tetap di STORYTELLING untuk meninjau narasi');
assert(
  clarifyRes.session?.storyline?.pendingDirectionClarification === undefined,
  'pendingDirectionClarification sudah dibersihkan'
);
assert(
  Boolean(clarifyRes.session?.storyline?.narasi),
  'Narasi storytelling AI sudah berhasil disusun'
);
assert(
  clarifyRes.session?.flow?.dualFlowPreDecided === true,
  'dualFlowPreDecided === true ditandai di session.flow'
);
assert(
  clarifyRes.guidedStep?.options?.some((o: any) => o.id === 'confirm_story'),
  'Kartu konfirmasi narasi normal ("confirm_story") sekarang ditampilkan'
);

console.log('\n--- TEST E2E 3: NEXT dari STORYTELLING ke ROLE ---');
const toRoleRes = await makeRequest({
  action: 'NEXT',
  stepId: 'STORYTELLING',
  session: clarifyRes.session,
  selected: ['confirm_story']
});

assert(toRoleRes.success === true, 'Transisi ke ROLE success === true');
assert(toRoleRes.session?.step === 'ROLE', 'Session step berpindah ke ROLE');
assert(
  toRoleRes.session?.flow?.dualFlowPreDecided === true,
  'Flag dualFlowPreDecided tetap terjaga di step ROLE'
);

console.log('\n--- TEST E2E 4: NEXT dari ROLE ke ALUR (Pre-Decided Kasus Ganda Langsung Diproses) ---');
const toAlurRes = await makeRequest({
  action: 'NEXT',
  stepId: 'ROLE',
  session: toRoleRes.session,
  selected: ['Super Admin', 'Staf Penaksir & Kasir']
});

assert(toAlurRes.success === true, 'Transisi ke ALUR success === true');
assert(toAlurRes.session?.step === 'ALUR', 'Session step berpindah ke ALUR');
assert(
  toAlurRes.session?.flow?.kasusGanda?.length === 2,
  'kasusGanda langsung terbentuk dengan 2 alur mandiri'
);
assert(
  toAlurRes.session?.flow?.dualFlowPending !== true,
  'dualFlowPending TIDAK aktif (sistem tidak bertanya ulang "dua alur atau satu")'
);
assert(
  toAlurRes.guidedStep?.options?.some((o: any) => o.id === 'confirm_alur'),
  'Kartu ALUR yang ditampilkan adalah kartu konfirmasi biasa ("confirm_alur")'
);
assert(
  toAlurRes.narration?.includes('Kasus 1:') || toAlurRes.narration?.includes('Penjualan ke Pelanggan'),
  'Narasi ALUR menampilkan kedua alur mandiri'
);

console.log(`\n========================================`);
console.log(`TOTAL E2E: ${pass} PASS, ${fail} FAIL`);
console.log(`========================================`);

if (fail > 0) process.exit(1);
