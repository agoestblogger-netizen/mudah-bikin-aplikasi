import fs from 'fs';
import path from 'path';

// Baca .env.local
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...vals] = trimmed.split('=');
      const val = vals.join('=').trim().replace(/^["']|["']$/g, '');
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = val;
      }
    }
  }
}

const { POST } = await import('../src/app/api/guided/route');
const { applyGuidedAnswer } = await import('../src/lib/templates/processes/guided');

function createMockReq(body: any): Request {
  return new Request('http://localhost:3000/api/guided', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-token'
    },
    body: JSON.stringify(body)
  });
}

async function runTests() {
  console.log('=== MEMULAI TEST BAGIAN A, B, C ===\n');

  // -------------------------------------------------------------
  // TEST BAGIAN A: Istilah "tidak dipakai" untuk role eksternal vs "dihapus" untuk internal
  // -------------------------------------------------------------
  console.log('--- TEST BAGIAN A: Verifikasi istilah role eksternal vs internal ---');
  
  // Siapkan session di step ROLE untuk cuci mobil
  const dummySessionRole: any = {
    step: 'ROLE',
    match: {
      templateId: 'MT-01',
      patternIds: ['UP-01'],
      tier: 'BASIC',
      businessCategory: 'Jasa Cuci Mobil & Motor',
      contextualRoles: ['Super Admin', 'Staf Cuci & Lap', 'Pelanggan']
    },
    storyline: {
      narasi: 'Pelanggan datang membawa kendaraan kotor. Kasir mencatat pilihan paket cuci. Staf cuci membersihkan kendaraan hingga bersih berkilap.',
      asumsiMasalah: 'Pencatatan kendaraan manual',
      asumsiAktor: ['Super Admin', 'Staf Cuci & Lap', 'Pelanggan'],
      asumsiAlurUtama: 'Pelanggan datang -> Kasir catat -> Staf cuci -> Selesai',
      statusKonfirmasi: 'disetujui',
      revisiCount: 0
    },
    roles: { selected: [] }
  };

  // 1. Deselect role eksternal "Pelanggan" saja (hanya pilih Super Admin & Staf Cuci & Lap)
  const reqA1 = createMockReq({
    action: 'NEXT',
    stepId: 'ROLE',
    session: dummySessionRole,
    selected: ['Super Admin', 'Staf Cuci & Lap']
  });
  const resA1 = await POST(reqA1);
  const dataA1 = await resA1.json();
  const narasiA1 = dataA1.narration || '';
  console.log('[A1] Narasi saat Pelanggan tidak dipilih:\n', narasiA1);

  const a1UsesTidakDipakai = narasiA1.includes('tidak dipakai sebagai akun terpisah');
  const a1AvoidsDihapus = !narasiA1.toLowerCase().includes('role pelanggan dihapus');
  console.log(`[A1] Menggunakan "tidak dipakai": ${a1UsesTidakDipakai ? 'PASS' : 'FAIL'}`);
  console.log(`[A1] Menghindari "role Pelanggan dihapus": ${a1AvoidsDihapus ? 'PASS' : 'FAIL'}`);
  if (!a1UsesTidakDipakai || !a1AvoidsDihapus) {
    throw new Error('Test A1 Gagal: Role eksternal masih menggunakan istilah dihapus!');
  }

  // 2. Deselect role internal "Staf Cuci & Lap" (hanya pilih Super Admin & Pelanggan)
  const reqA2 = createMockReq({
    action: 'NEXT',
    stepId: 'ROLE',
    session: dummySessionRole,
    selected: ['Super Admin', 'Pelanggan']
  });
  const resA2 = await POST(reqA2);
  const dataA2 = await resA2.json();
  const narasiA2 = dataA2.narration || '';
  console.log('\n[A2] Narasi saat Staf Cuci & Lap tidak dipilih:\n', narasiA2);

  const a2UsesDihapus = narasiA2.includes('dihapus') && narasiA2.includes('Owner');
  console.log(`[A2] Staf internal tetap menggunakan "dihapus" dan dilimpahkan ke Owner: ${a2UsesDihapus ? 'PASS' : 'FAIL'}`);
  if (!a2UsesDihapus) {
    throw new Error('Test A2 Gagal: Staf internal tidak memakai istilah dihapus / pelimpahan!');
  }

  // -------------------------------------------------------------
  // TEST BAGIAN B: Standarisasi Greeting Pembuka Sebelum Narasi / Klarifikasi
  // -------------------------------------------------------------
  console.log('\n--- TEST BAGIAN B: Standarisasi Greeting Pembuka ---');

  // Jalur 1: Ide ambigu -> harus muncul greeting ramah duluan sebelum pertanyaan klarifikasi
  console.log('[B1] Test START dengan ide AMBIGU ("aplikasi pembelian barang rosok")...');
  const reqB1 = createMockReq({
    action: 'START',
    prompt: 'aplikasi pembelian barang rosok'
  });
  const resB1 = await POST(reqB1);
  const dataB1 = await resB1.json();
  const narasiB1 = dataB1.narration || '';
  console.log('[B1] Narasi respon awal AMBIGU:\n', narasiB1);

  const b1HasWarmGreeting = /^(aplikasi\s+yang\s+ingin|ide\s+aplikasi|halo|wah|senang|terima\s*kasih|keren|luar\s*biasa)/i.test(narasiB1);
  const b1HasClarificationQuestion = narasiB1.includes('?') || narasiB1.includes('arah bisnis');
  console.log(`[B1] Greeting ramah di awal: ${b1HasWarmGreeting ? 'PASS' : 'FAIL'}`);
  console.log(`[B1] Pertanyaan klarifikasi ada setelahnya: ${b1HasClarificationQuestion ? 'PASS' : 'FAIL'}`);
  if (!b1HasWarmGreeting) {
    throw new Error('Test B1 Gagal: Greeting ramah tidak muncul di awal respons AMBIGU!');
  }

  // Jalur 2: Ide tidak ambigu -> harus muncul greeting ramah duluan sebelum narasi alur bisnis
  console.log('\n[B2] Test START dengan ide NON-AMBIGU ("aplikasi cuci mobil dan motor")...');
  const reqB2 = createMockReq({
    action: 'START',
    prompt: 'aplikasi cuci mobil dan motor'
  });
  const resB2 = await POST(reqB2);
  const dataB2 = await resB2.json();
  const narasiB2 = dataB2.narration || '';
  console.log('[B2] Narasi respon awal NON-AMBIGU:\n', narasiB2.slice(0, 200) + '...');

  const b2HasWarmGreeting = /^(aplikasi\s+yang\s+ingin|ide\s+aplikasi|halo|wah|senang|terima\s*kasih|keren|luar\s*biasa)/i.test(narasiB2);
  console.log(`[B2] Greeting ramah di awal non-ambigu: ${b2HasWarmGreeting ? 'PASS' : 'FAIL'}`);
  if (!b2HasWarmGreeting) {
    throw new Error('Test B2 Gagal: Greeting ramah tidak muncul di awal respons NON-AMBIGU!');
  }

  // -------------------------------------------------------------
  // TEST BAGIAN C: Hapus Batas 2x Revisi di Step STORYTELLING
  // -------------------------------------------------------------
  console.log('\n--- TEST BAGIAN C: Hapus Batas 2x Revisi di STORYTELLING ---');

  let currentSession = dataB2.session;
  console.log(`[C0] Step awal: ${currentSession.step}, revisiCount: ${currentSession.storyline?.revisiCount || 0}`);

  const revisions = [
    'Tolong tambahkan proses inspeksi bodi sebelum dicuci',
    'Tolong tambahkan pilihan cuci uap dan semir ban',
    'Tolong cantumkan bahwa pelanggan dapat ruang tunggu ber-AC',
    'Tolong sertakan garansi cuci ulang jika terkena hujan di hari yang sama'
  ];

  for (let i = 0; i < revisions.length; i++) {
    const revNum = i + 1;
    const revNote = revisions[i];
    console.log(`\n[C-Rev${revNum}] Mengirim koreksi ke-${revNum}: "${revNote}"...`);

    const reqRev = createMockReq({
      action: 'NEXT',
      stepId: 'STORYTELLING',
      session: currentSession,
      selected: ['minor_adjust'],
      other: revNote
    });
    const resRev = await POST(reqRev);
    const dataRev = await resRev.json();

    const newStep = dataRev.session?.step;
    const newRevisiCount = dataRev.session?.storyline?.revisiCount;
    const revNarration = dataRev.narration || '';

    console.log(`[C-Rev${revNum}] Hasil: step = ${newStep}, revisiCount = ${newRevisiCount}`);
    console.log(`[C-Rev${revNum}] Cuplikan narasi: ${revNarration.slice(0, 100)}...`);

    // Validasi: step HARUS TETAP 'STORYTELLING', TIDAK BOLEH auto-advance ke 'ROLE'
    if (newStep !== 'STORYTELLING') {
      throw new Error(`Test C Gagal pada revisi ke-${revNum}: step loncat ke ${newStep} padahal belum dikonfirmasi!`);
    }

    // Validasi: narasi transisi paksa TIDAK boleh muncul
    if (revNarration.includes('simpan pemahaman proses bisnis sejauh ini')) {
      throw new Error(`Test C Gagal pada revisi ke-${revNum}: narasi transisi paksa masih muncul!`);
    }

    currentSession = dataRev.session;
  }

  console.log(`\n[C-Final] Berhasil melakukan 4x koreksi tanpa paksa lanjut! revisiCount akhir = ${currentSession.storyline?.revisiCount}`);

  // Sekarang user secara EKSPLISIT memilih "Sudah sesuai, lanjut ke Role"
  console.log('[C-Confirm] User memilih "Sudah sesuai, lanjut ke Role"...');
  const reqConfirm = createMockReq({
    action: 'NEXT',
    stepId: 'STORYTELLING',
    session: currentSession,
    selected: ['confirm_story']
  });
  const resConfirm = await POST(reqConfirm);
  const dataConfirm = await resConfirm.json();

  console.log(`[C-Confirm] Hasil: step = ${dataConfirm.session?.step}`);
  if (dataConfirm.session?.step !== 'ROLE') {
    throw new Error(`Test C Gagal: Setelah konfirmasi, step seharusnya 'ROLE', tapi didapat '${dataConfirm.session?.step}'`);
  }
  console.log('[C-Confirm] Sukses berpindah ke step ROLE hanya setelah konfirmasi eksplisit: PASS!');

  // Test juga applyGuidedAnswer sinkronus untuk memastikan fungsi murninya juga tidak punya batas revisi
  console.log('\n[C-Pure] Memeriksa applyGuidedAnswer murni...');
  let pureSession = { ...dummySessionRole, step: 'STORYTELLING', storyline: { ...dummySessionRole.storyline, revisiCount: 5 } };
  const pureRes = applyGuidedAnswer(pureSession, 'STORYTELLING', ['minor_adjust'], 'koreksi ke-6');
  if (pureRes.step !== 'STORYTELLING') {
    throw new Error(`Test C-Pure Gagal: applyGuidedAnswer mengubah step ke ${pureRes.step} padahal belum confirm_story!`);
  }
  console.log(`[C-Pure] applyGuidedAnswer dengan revisiCount=5 tetap menghasilkan step=${pureRes.step} (revisiCount=${pureRes.storyline?.revisiCount}): PASS!`);

  console.log('\n=================================================');
  console.log('SEMUA TEST (BAGIAN A, B, C) LULUS 100%! 🎉');
  console.log('=================================================');
}

runTests().catch((err) => {
  console.error('\n❌ ERROR DALAM TEST:', err);
  process.exit(1);
});
