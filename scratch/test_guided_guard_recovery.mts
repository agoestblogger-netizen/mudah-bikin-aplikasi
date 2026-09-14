import fs from 'fs';
import path from 'path';
import assert from 'assert';

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

const { POST: postGenerate } = await import('../src/app/api/generate/route');
const { POST: postGuided } = await import('../src/app/api/guided/route');

function createGenerateReq(body: any): Request {
  return new Request('http://localhost:3000/api/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-token'
    },
    body: JSON.stringify(body)
  });
}

function createGuidedReq(body: any): Request {
  return new Request('http://localhost:3000/api/guided', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-token'
    },
    body: JSON.stringify(body)
  });
}

async function run() {
  console.log('=== TEST SUITE: GUARD PEMULIHAN GUIDED INTERVIEW ===\n');

  // 1. Uji Guard saat sesi berada di step ROLE
  console.log('--- 1. Uji Guard saat macet di step ROLE ---');
  const sessionRole = {
    step: 'ROLE',
    match: { businessCategory: 'Barbershop', templateId: 'MT-01', patternIds: [] },
    storyline: { narasi: 'Barbershop modern dengan sistem antrean online.' },
    roles: { selected: ['Super Admin', 'Barber & Kasir'] }
  };

  const resRole = await postGenerate(createGenerateReq({
    prompt: 'buatkan prototipe sekarang',
    stage: 'TAHAP_2_MOCKUP',
    mode: 'BUILD',
    sessionState: sessionRole
  }));

  assert.strictEqual(resRole.status, 400, 'Harus ditolak dengan status 400');
  const dataRole = await resRole.json();
  assert.strictEqual(dataRole.needsGuidedInterview, true, 'needsGuidedInterview harus true');
  assert.strictEqual(dataRole.currentStep, 'ROLE', 'currentStep harus ROLE');
  assert.strictEqual(dataRole.stepName, 'Role & Tanggung Jawab', 'stepName harus Role & Tanggung Jawab');
  assert.ok(dataRole.error.includes('Role & Tanggung Jawab'), 'Pesan error harus eksplisit menyebut Role & Tanggung Jawab');
  assert.ok(dataRole.suggestedActions.some((a: any) => a.id === 'resume_step' && a.targetStep === 'ROLE'), 'Harus menyertakan aksi resume_step ke ROLE');
  console.log('✅ Guard di step ROLE berhasil menolak dan memberikan arahan konkret!\n');

  // 2. Uji Guard saat sesi berada di step ALUR
  console.log('--- 2. Uji Guard saat macet di step ALUR ---');
  const sessionAlur = {
    ...sessionRole,
    step: 'ALUR',
    flow: { alurInti: ['Booking', 'Layanan Potong', 'Pembayaran'] }
  };

  const resAlur = await postGenerate(createGenerateReq({
    prompt: 'buatkan prototipe sekarang',
    stage: 'TAHAP_2_MOCKUP',
    mode: 'BUILD',
    sessionState: sessionAlur
  }));

  assert.strictEqual(resAlur.status, 400, 'Harus ditolak dengan status 400');
  const dataAlur = await resAlur.json();
  assert.strictEqual(dataAlur.currentStep, 'ALUR');
  assert.strictEqual(dataAlur.stepName, 'Alur Kerja Operasional');
  assert.ok(dataAlur.error.includes('Alur Kerja Operasional'));
  console.log('✅ Guard di step ALUR berhasil menolak dan memberikan arahan konkret!\n');

  // 3. Uji Guard saat sesi berada di step RBAC
  console.log('--- 3. Uji Guard saat macet di step RBAC ---');
  const sessionRbac = {
    ...sessionAlur,
    step: 'RBAC'
  };

  const resRbac = await postGenerate(createGenerateReq({
    prompt: 'buatkan prototipe sekarang',
    stage: 'TAHAP_2_MOCKUP',
    mode: 'BUILD',
    sessionState: sessionRbac
  }));

  assert.strictEqual(resRbac.status, 400, 'Harus ditolak dengan status 400');
  const dataRbac = await resRbac.json();
  assert.strictEqual(dataRbac.currentStep, 'RBAC');
  assert.strictEqual(dataRbac.stepName, 'Hak Akses (RBAC)');
  assert.ok(dataRbac.error.includes('Hak Akses (RBAC)'));
  console.log('✅ Guard di step RBAC berhasil menolak dan memberikan arahan konkret!\n');

  // 4. Uji Guard saat REVIEW_FINAL tapi BELUM disetujui
  console.log('--- 4. Uji Guard saat di REVIEW_FINAL tapi belum disetujui ---');
  const sessionReviewBelumApprove = {
    ...sessionRbac,
    step: 'REVIEW_FINAL',
    statusKonfirmasi: 'belum_disetujui'
  };

  const resReviewBelum = await postGenerate(createGenerateReq({
    prompt: 'buatkan prototipe sekarang',
    stage: 'TAHAP_2_MOCKUP',
    mode: 'BUILD',
    sessionState: sessionReviewBelumApprove
  }));

  assert.strictEqual(resReviewBelum.status, 400);
  const dataReviewBelum = await resReviewBelum.json();
  assert.strictEqual(dataReviewBelum.currentStep, 'REVIEW_FINAL');
  console.log('✅ Guard di REVIEW_FINAL belum approve berhasil menolak!\n');

  // 5. Uji Eksekusi Resume di /api/guided (Action: RESUME)
  console.log('--- 5. Uji Pemulihan Sesi via /api/guided (action: RESUME) ---');
  const resumeReq = createGuidedReq({
    action: 'RESUME',
    session: sessionRole,
    targetStep: 'ROLE'
  });
  const resumeRes = await (await postGuided(resumeReq)).json();
  assert.strictEqual(resumeRes.success, true, 'Resume harus sukses');
  assert.strictEqual(resumeRes.session?.step, 'ROLE', 'Step sesi harus tetap ROLE');
  assert.ok(resumeRes.guidedStep?.options?.length > 0, 'Harus mengembalikan opsi kartu ROLE');
  assert.ok(resumeRes.narration.includes('ringkasan peran') || resumeRes.narration.includes('ROLE'), 'Narasi harus sesuai');
  console.log('✅ /api/guided action RESUME berhasil mengembalikan kartu interaktif step tujuan!\n');

  // 6. Uji Kelolosan Sesi yang Benar-Benar Disetujui (REVIEW_FINAL disetujui)
  console.log('--- 6. Uji Sesi REVIEW_FINAL yang Resmi Disetujui (Lolos Guard) ---');
  const sessionReviewDisetujui = {
    ...sessionRbac,
    step: 'REVIEW_FINAL',
    statusKonfirmasi: 'disetujui',
    reviewFinalApproved: true,
    dataSchema: { tabel: [{ nama: 'users' }, { nama: 'antrean' }] },
    simulasiDb: { contohData: { tabel: 'antrean', baris: [{ id: '1' }] } },
    compiledBrief: 'Brief resmi Barbershop'
  };

  const resSah = await postGenerate(createGenerateReq({
    prompt: 'Saya menyetujui Brief Kebutuhan ini. Silakan buatkan prototipe aplikasinya sekarang.',
    stage: 'TAHAP_2_MOCKUP',
    mode: 'BUILD',
    sessionState: sessionReviewDisetujui
  }));

  // Jika lolos guardrail, status BUKAN 400 needsGuidedInterview
  const isBlocked = resSah.status === 400 && Boolean((await resSah.clone().json().catch(() => ({}))).needsGuidedInterview);
  assert.strictEqual(isBlocked, false, 'Sesi yang sudah disetujui TIDAK BOLEH diblokir oleh guard!');
  console.log('✅ Sesi REVIEW_FINAL yang disetujui resmi lolos guard dengan mulus!\n');

  console.log('🎉 SEMUA TEST VERIFIKASI SELESAI DAN LULUS 100%!');
}

run().catch((err) => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
