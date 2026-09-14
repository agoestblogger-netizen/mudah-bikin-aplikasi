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

import * as userAuth from '../src/lib/supabase/user';
// @ts-ignore
userAuth.getUserFromRequest = async () => ({ id: 'mock-user-123', email: 'test@example.com' } as any);

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

async function testInvestigation() {
  console.log('=== INVESTIGASI PAYLOAD NYATA REVIEW_FINAL ===\n');

  // Skenario: Session saat baru tiba di step REVIEW_FINAL (sebelum approve diklik)
  const sessionArrivedAtReviewFinal = {
    step: 'REVIEW_FINAL',
    match: { businessCategory: 'Rental Mobil', templateId: 'MT-01', patternIds: [] },
    storyline: { narasi: 'Rental mobil lepas kunci dengan verifikasi KTP dan SIM.' },
    roles: { selected: ['Super Admin', 'Petugas Rental', 'Penyewa'] },
    dataSchema: { tabel: [{ nama: 'users' }, { nama: 'armada' }, { nama: 'sewa' }] },
    simulasiDb: { contohData: { tabel: 'armada', baris: [{ id: '1', mobil: 'Avanza' }] } }
  };

  console.log('1. Memeriksa state session saat baru tiba di REVIEW_FINAL:');
  console.log('   - step:', sessionArrivedAtReviewFinal.step);
  console.log('   - statusKonfirmasi:', (sessionArrivedAtReviewFinal as any).statusKonfirmasi);
  console.log('   - reviewFinalApproved:', (sessionArrivedAtReviewFinal as any).reviewFinalApproved);

  // Jika frontend mengirim sessionArrivedAtReviewFinal (snapshot lama sebelum approve) ke /api/generate:
  console.log('\n2. Kirim payload dengan snapshot LAMA (sebelum approve) ke /api/generate:');
  const resStale = await postGenerate(createGenerateReq({
    prompt: 'Saya menyetujui Brief Kebutuhan ini. Silakan buatkan prototipe aplikasinya sekarang.',
    stage: 'TAHAP_2_MOCKUP',
    mode: 'BUILD',
    sessionState: sessionArrivedAtReviewFinal
  }));

  const dataStale = await resStale.json();
  console.log('   HTTP Status:', resStale.status);
  console.log('   Guard Blocked?:', dataStale.needsGuidedInterview);
  console.log('   Error Message:', dataStale.error?.split('\n')[0]);
  assert.strictEqual(resStale.status, 400, 'Snapshot lama harus ditolak guard');

  // Sekarang simulasikan klik approve melalui /api/guided:
  console.log('\n3. Panggil /api/guided dengan selected: ["approve_prototype"]:');
  const guidedRes = await postGuided(createGuidedReq({
    action: 'NEXT',
    stepId: 'REVIEW_FINAL',
    selected: ['approve_prototype'],
    session: sessionArrivedAtReviewFinal
  }));

  const guidedData = await guidedRes.json();
  console.log('   /api/guided status:', guidedRes.status);
  console.log('   /api/guided data:', JSON.stringify(guidedData, null, 2));
  const nextSession = guidedData.session;
  console.log('   Returned nextSession:');
  console.log('     - step:', nextSession?.step);
  console.log('     - statusKonfirmasi:', nextSession?.statusKonfirmasi);
  console.log('     - reviewFinalApproved:', nextSession?.reviewFinalApproved);
  console.log('     - review:', nextSession?.review);

  // Sekarang jika nextSession dikirim ke /api/generate:
  console.log('\n4. Kirim nextSession HASIL APPROVE ke /api/generate:');
  const resApproved = await postGenerate(createGenerateReq({
    prompt: 'Saya menyetujui Brief Kebutuhan ini. Silakan buatkan prototipe aplikasinya sekarang.',
    stage: 'TAHAP_2_MOCKUP',
    mode: 'BUILD',
    sessionState: nextSession
  }));

  const dataApproved = await resApproved.clone().json().catch(() => ({}));
  const isBlockedApproved = resApproved.status === 400 && Boolean(dataApproved.needsGuidedInterview);
  console.log('   HTTP Status:', resApproved.status);
  console.log('   Guard Blocked?:', isBlockedApproved);
  if (isBlockedApproved) {
    console.log('   Error Message:', dataApproved.error);
  } else {
    console.log('   ✅ LOLOS GUARD DENGAN BERHASIL (Status bukan 400 blocked)!');
  }

  assert.strictEqual(isBlockedApproved, false, 'Session yang sudah diapprove tidak boleh diblokir');
}

testInvestigation().catch(console.error);
