import fs from 'fs';
import path from 'path';
import assert from 'assert';

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

function createGuidedReq(body: any): Request {
  return new Request('http://localhost:3000/api/guided', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test' },
    body: JSON.stringify(body)
  });
}

function createGenerateReq(body: any): Request {
  return new Request('http://localhost:3000/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test' },
    body: JSON.stringify(body)
  });
}

async function runE2EChain() {
  console.log('=== RUNNING REAL GUIDED PIPELINE END-TO-END ===\n');

  // 1. START
  console.log('Step 0: START (Rental Mobil)');
  const startRaw = await postGuided(createGuidedReq({ action: 'START', prompt: 'buatkan aplikasi rental mobil lepas kunci' }));
  const startRes = await startRaw.json();
  console.log('startRes status:', startRaw.status, startRes);
  assert.strictEqual(startRes.success, true);
  let session = startRes.session;
  console.log(' -> Started at step:', session.step);

  // 2. STORYTELLING -> ROLE
  console.log('\nStep 1: Confirm STORYTELLING');
  const r1 = await (await postGuided(createGuidedReq({ action: 'NEXT', stepId: 'STORYTELLING', selected: ['confirm_story'], session }))).json();
  assert.strictEqual(r1.success, true);
  session = r1.session;
  console.log(' -> Now at step:', session.step);

  // 3. ROLE -> ALUR
  console.log('\nStep 2: Confirm ROLE');
  const r2 = await (await postGuided(createGuidedReq({ action: 'NEXT', stepId: 'ROLE', selected: ['confirm_roles'], session }))).json();
  assert.strictEqual(r2.success, true);
  session = r2.session;
  console.log(' -> Now at step:', session.step);

  // 4. ALUR -> RBAC
  console.log('\nStep 3: Confirm ALUR');
  const r3 = await (await postGuided(createGuidedReq({ action: 'NEXT', stepId: 'ALUR', selected: ['confirm_flow'], session }))).json();
  assert.strictEqual(r3.success, true);
  session = r3.session;
  console.log(' -> Now at step:', session.step);

  // 5. RBAC -> SKEMA_DATA
  console.log('\nStep 4: Confirm RBAC');
  const r4 = await (await postGuided(createGuidedReq({ action: 'NEXT', stepId: 'RBAC', selected: ['confirm_rbac'], session }))).json();
  assert.strictEqual(r4.success, true);
  session = r4.session;
  console.log(' -> Now at step:', session.step);

  // 6. SKEMA_DATA -> SIMULASI_DB
  console.log('\nStep 5: Confirm SKEMA_DATA');
  const r5 = await (await postGuided(createGuidedReq({ action: 'NEXT', stepId: 'SKEMA_DATA', selected: ['confirm_data_schema'], session }))).json();
  assert.strictEqual(r5.success, true);
  session = r5.session;
  console.log(' -> Now at step:', session.step);

  // 7. SIMULASI_DB -> REVIEW_FINAL
  console.log('\nStep 6: Confirm SIMULASI_DB');
  const r6 = await (await postGuided(createGuidedReq({ action: 'NEXT', stepId: 'SIMULASI_DB', selected: ['confirm_simulasi_db'], session }))).json();
  assert.strictEqual(r6.success, true);
  session = r6.session;
  console.log(' -> Now arrived at step:', session.step);
  console.log('    State before approve:');
  console.log('      step:', session.step);
  console.log('      statusKonfirmasi:', session.statusKonfirmasi);
  console.log('      reviewFinalApproved:', session.reviewFinalApproved);
  console.log('      review:', session.review);

  // Sekarang, apa yang terjadi jika frontend di titik ini langsung panggil /api/generate
  // karena closure stale di ChatPanel.tsx (menggunakan session sebelum approve)?
  console.log('\n--- SIMULASI BUG: Frontend panggil /api/generate dengan session snapshot saat ini ---');
  const bugRes = await postGenerate(createGenerateReq({
    prompt: 'Saya menyetujui Brief Kebutuhan ini. Silakan buatkan prototipe aplikasinya sekarang.',
    stage: 'TAHAP_2_MOCKUP',
    mode: 'BUILD',
    sessionState: session
  }));
  const bugData = await bugRes.json();
  console.log('HTTP Status:', bugRes.status);
  console.log('needsGuidedInterview:', bugData.needsGuidedInterview);
  console.log('error:', bugData.error?.split('\n')[0]);
  console.log('currentStep:', bugData.currentStep);
  console.log('stepName:', bugData.stepName);

  // 8. Sekarang jalankan approve_prototype pada /api/guided
  console.log('\n--- 8. User klik "approve_prototype" pada REVIEW_FINAL ---');
  const r7 = await (await postGuided(createGuidedReq({ action: 'NEXT', stepId: 'REVIEW_FINAL', selected: ['approve_prototype'], session }))).json();
  console.log('r7.success:', r7.success);
  console.log('r7.action:', r7.action);
  if (!r7.success) {
    console.log('r7.error:', r7.error);
    console.log('r7.completeness:', JSON.stringify(r7.completeness, null, 2));
  } else {
    const approvedSession = r7.session;
    console.log('Approved session properties:');
    console.log('  step:', approvedSession.step);
    console.log('  statusKonfirmasi:', approvedSession.statusKonfirmasi);
    console.log('  reviewFinalApproved:', approvedSession.reviewFinalApproved);
    console.log('  review:', approvedSession.review);
    console.log('  has compiledBrief:', Boolean(approvedSession.compiledBrief));

    // Kirim approvedSession ke /api/generate
    console.log('\n--- Kirim approvedSession ke /api/generate ---');
    const genRes = await postGenerate(createGenerateReq({
      prompt: 'Saya menyetujui Brief Kebutuhan ini. Silakan buatkan prototipe aplikasinya sekarang.',
      stage: 'TAHAP_2_MOCKUP',
      mode: 'BUILD',
      sessionState: approvedSession
    }));
    const genData = await genRes.clone().json().catch(() => ({}));
    const isBlocked = genRes.status === 400 && Boolean(genData.needsGuidedInterview);
    console.log('HTTP Status:', genRes.status);
    console.log('isBlocked:', isBlocked);
    if (isBlocked) {
      console.log('Blocked error:', genData.error);
    } else {
      console.log('✅ APPROVED SESSION SUKSES LOLOS GUARD!');
    }
  }
}

runE2EChain().catch(console.error);
