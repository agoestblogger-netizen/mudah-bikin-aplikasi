/**
 * Test Verifikasi: Tampilkan Ulang Narasi Hasil Revisi di STORYTELLING Sebelum Lanjut ke ROLE
 * 
 * 1. Koreksi narasi (minor_adjust) -> narasi baru DITAMPILKAN ULANG, sesi TETAP di STORYTELLING
 * 2. Konfirmasi setelah revisi ("confirm_story") -> sesi BARU pindah ke ROLE
 * 3. Batas 2x revisi berturut-turut -> koreksi ke-3 otomatis lanjut ke ROLE dengan catatan
 * 4. Kasus tanpa koreksi ("confirm_story" putaran 1) -> langsung lanjut ke ROLE
 */

import fs from 'fs';
import { POST } from '../src/app/api/guided/route';

// Baca .env.local
if (fs.existsSync('.env.local')) {
  const envContent = fs.readFileSync('.env.local', 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

let pass = 0;
let fail = 0;

function assert(cond: boolean, msg: string) {
  if (cond) {
    console.log(`✅ PASS: ${msg}`);
    pass++;
  } else {
    console.error(`❌ FAIL: ${msg}`);
    fail++;
  }
}

function createMockRequest(body: any): Request {
  return new Request('http://localhost:3000/api/guided', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token'
    },
    body: JSON.stringify(body)
  });
}

async function runTest() {
  console.log('================================================================');
  console.log('TEST SUITE: REVISI STORYTELLING DITAMPILKAN ULANG SEBELUM ROLE');
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // TEST 1 & 2: Alur Koreksi Narasi -> Tampilkan Ulang -> Konfirmasi ke ROLE
  // -------------------------------------------------------------
  console.log('--- TEST 1: START dengan prompt "aplikasi beli barang rosok" ---');
  let startReq = createMockRequest({
    action: 'START',
    prompt: 'aplikasi beli barang rosok'
  });
  let startRes = await (await POST(startReq)).json();
  assert(startRes.success === true, 'START berhasil');
  let session = startRes.session;
  console.log(`  > Step awal: ${session.step}`);
  console.log(`  > Narasi awal: "${startRes.narration?.slice(0, 100)}..."`);

  // Jika muncul klarifikasi arah bisnis (AMBIGU), pilih opsi "hanya menerima barang dari warga"
  if (session.storyline?.pendingDirectionClarification) {
    console.log('  > Memilih klarifikasi arah bisnis (opsi B: terima barang)...');
    const clarReq = createMockRequest({
      action: 'NEXT',
      session,
      stepId: 'STORYTELLING',
      selected: ['dir_b'],
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY
    });
    const clarRes = await (await POST(clarReq)).json();
    assert(clarRes.success === true, 'Klarifikasi arah berhasil');
    session = clarRes.session;
    console.log(`  > Narasi setelah klarifikasi: "${clarRes.narration?.slice(0, 100)}..."`);
  }

  assert(session.step === 'STORYTELLING', 'Sesi berada di step STORYTELLING');

  console.log('\n--- TEST 1B: User memberi koreksi pertama di STORYTELLING ---');
  const koreksiText = 'bukan warga yang membawa ke toko, tapi ada petugas keliling yang menjemput barang ke kampung';
  const rev1Req = createMockRequest({
    action: 'NEXT',
    session,
    stepId: 'STORYTELLING',
    selected: ['minor_adjust'],
    other: koreksiText,
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY
  });
  const rev1Res = await (await POST(rev1Req)).json();
  assert(rev1Res.success === true, 'Request koreksi alur berhasil direspons');
  
  // Verifikasi 1: Sesi TETAP di STORYTELLING!
  assert(rev1Res.session.step === 'STORYTELLING', 'Sesi TETAP di step STORYTELLING (bukan lompat ke ROLE)');
  assert(rev1Res.guidedStep.stepId === 'STORYTELLING', 'Kartu yang dikembalikan adalah STORYTELLING');

  // Verifikasi 2: Narasi hasil revisi DITAMPILKAN ULANG di narration!
  const narrationText = rev1Res.narration || '';
  console.log(`  > Narration response:\n"${narrationText}"\n`);
  assert(
    narrationText.includes('Sip, catatanmu sudah saya sesuaikan') || narrationText.includes('keliling'),
    'Narration memuat pesan konfirmasi penyesuaian catatan'
  );
  assert(
    narrationText.toLowerCase().includes('apakah ini sudah menggambarkan proses bisnismu'),
    'Narration ditutup dengan pertanyaan konfirmasi ulang'
  );

  // Verifikasi 3: Pilihan konfirmasi di kartu guidedStep
  const confirmOpt = rev1Res.guidedStep.options.find((o: any) => o.id === 'confirm_story');
  assert(Boolean(confirmOpt), 'Opsi "confirm_story" tersedia di kartu untuk dikonfirmasi user');

  // -------------------------------------------------------------
  // TEST 2: User Konfirmasi pada Putaran Kedua ("confirm_story")
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: User memilih "Sudah sesuai, lanjut ke Role" pada putaran kedua ---');
  const confReq = createMockRequest({
    action: 'NEXT',
    session: rev1Res.session,
    stepId: 'STORYTELLING',
    selected: ['confirm_story']
  });
  const confRes = await (await POST(confReq)).json();
  assert(confRes.success === true, 'Konfirmasi putaran kedua berhasil');
  assert(confRes.session.step === 'ROLE', 'Sesi SEKARANG BARU pindah ke step ROLE');
  assert(confRes.guidedStep.stepId === 'ROLE', 'Kartu guidedStep berpindah ke ROLE');
  console.log(`  > Narration pembuka ROLE: "${confRes.narration?.slice(0, 80)}..."`);

  // -------------------------------------------------------------
  // TEST 3: Batas 2x Koreksi Berturut-turut
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Batas 2x koreksi berturut-turut ---');
  // Mulai sesi baru pada step STORYTELLING
  let test3Session = {
    ...session,
    step: 'STORYTELLING' as const,
    storyline: {
      ...session.storyline,
      revisiCount: 0,
      statusKonfirmasi: 'dikoreksi' as const
    }
  };

  // Koreksi 1
  console.log('  > Koreksi 1...');
  const k1Req = createMockRequest({
    action: 'NEXT',
    session: test3Session,
    stepId: 'STORYTELLING',
    selected: ['minor_adjust'],
    other: 'tambah armada tossa roda tiga',
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY
  });
  const k1Res = await (await POST(k1Req)).json();
  assert(k1Res.session.step === 'STORYTELLING', 'Koreksi 1: sesi tetap STORYTELLING');
  assert(k1Res.session.storyline.revisiCount === 1, 'revisiCount bertambah jadi 1');

  // Koreksi 2
  console.log('  > Koreksi 2...');
  const k2Req = createMockRequest({
    action: 'NEXT',
    session: k1Res.session,
    stepId: 'STORYTELLING',
    selected: ['minor_adjust'],
    other: 'timbangannya memakai timbangan gantung digital',
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY
  });
  const k2Res = await (await POST(k2Req)).json();
  assert(k2Res.session.step === 'STORYTELLING', 'Koreksi 2: sesi tetap STORYTELLING');
  assert(k2Res.session.storyline.revisiCount === 2, 'revisiCount bertambah jadi 2');

  // Koreksi 3 (Sudah mencapai batas 2x!)
  console.log('  > Koreksi 3 (Batas 2x terlampaui)...');
  const k3Req = createMockRequest({
    action: 'NEXT',
    session: k2Res.session,
    stepId: 'STORYTELLING',
    selected: ['minor_adjust'],
    other: 'tambah buku kas kecil',
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY
  });
  const k3Res = await (await POST(k3Req)).json();
  assert(k3Res.session.step === 'ROLE', 'Koreksi 3: sistem otomatis lanjut ke ROLE');
  assert(
    k3Res.narration.includes('kita simpan pemahaman proses bisnis sejauh ini') ||
    k3Res.narration.includes('masih bisa mengoreksi lagi nanti'),
    'Koreksi 3: narration memuat catatan transisi ramah'
  );

  // -------------------------------------------------------------
  // TEST 4: Kasus Regresi Tanpa Koreksi Langsung Konfirmasi Putaran 1
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: Kasus tanpa koreksi (langsung konfirmasi di narasi pertama) ---');
  let test4Session = {
    ...session,
    step: 'STORYTELLING' as const,
    storyline: {
      ...session.storyline,
      revisiCount: 0,
      statusKonfirmasi: 'disetujui' as const
    }
  };
  const regReq = createMockRequest({
    action: 'NEXT',
    session: test4Session,
    stepId: 'STORYTELLING',
    selected: ['confirm_story']
  });
  const regRes = await (await POST(regReq)).json();
  assert(regRes.session.step === 'ROLE', 'Putaran 1 langsung konfirmasi -> langsung ke ROLE tanpa tampilan tambahan');
  assert(regRes.guidedStep.stepId === 'ROLE', 'Kartu langsung ROLE');

  console.log('\n================================================================');
  console.log(`HASIL AKHIR TEST SUITE: ${pass} PASS, ${fail} FAIL`);
  console.log('================================================================\n');

  if (fail > 0) {
    process.exit(1);
  }
}

runTest();
