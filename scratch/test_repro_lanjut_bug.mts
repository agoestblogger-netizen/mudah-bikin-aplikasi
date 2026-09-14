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

const { POST } = await import('../src/app/api/guided/route');
const { isPureConfirmationText } = await import('../src/lib/templates/processes/guided');

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

async function run() {
  console.log('=== 1. UNIT TEST: isPureConfirmationText ===');
  // Harus MATCH (true)
  assert.strictEqual(isPureConfirmationText('Lanjut'), true, '"Lanjut" should be true');
  assert.strictEqual(isPureConfirmationText('lanjut!'), true, '"lanjut!" should be true');
  assert.strictEqual(isPureConfirmationText('Oke lanjut'), true, '"Oke lanjut" should be true');
  assert.strictEqual(isPureConfirmationText('oke lanjut.'), true, '"oke lanjut." should be true');
  assert.strictEqual(isPureConfirmationText('Ya sudah pas'), true, '"Ya sudah pas" should be true');
  assert.strictEqual(isPureConfirmationText('Sip, siap'), true, '"Sip, siap" should be true');
  assert.strictEqual(isPureConfirmationText('gaskeun'), true, '"gaskeun" should be true');
  assert.strictEqual(isPureConfirmationText('sudah pas, lanjut'), true, '"sudah pas, lanjut" should be true');

  // BUKAN konfirmasi murni (false)
  assert.strictEqual(isPureConfirmationText('Ya, tapi ada beberapa tambahan...'), false, '"Ya, tapi ada beberapa tambahan..." should be false');
  assert.strictEqual(isPureConfirmationText('Oke, tolong tambah kasir'), false, '"Oke, tolong tambah kasir" should be false');
  assert.strictEqual(isPureConfirmationText('Lanjut tapi ubah alur'), false, '"Lanjut tapi ubah alur" should be false');
  assert.strictEqual(isPureConfirmationText('Ya ada beberapa hal yang keliru'), false, '"Ya ada beberapa hal yang keliru" should be false');
  assert.strictEqual(isPureConfirmationText('Lanjut ke pembuatan skema tabel data aplikasi'), false, '"Lanjut ke..." should be false');
  assert.strictEqual(isPureConfirmationText(''), false, 'Empty string should be false');
  console.log('✅ Unit test isPureConfirmationText BERHASIL SEMUA!\n');

  console.log('=== 2. E2E FLOW TEST: STEP ROLE -> ALUR DENGAN TEKS "Lanjut" ===');
  // 1. Mulai sesi
  const startReq = createMockReq({
    action: 'START',
    prompt: 'buatkan aplikasi bengkel motor'
  });
  const startRes = await (await POST(startReq)).json();
  assert.strictEqual(startRes.session?.step, 'STORYTELLING');

  // 2. Konfirmasi cerita
  const storyReq = createMockReq({
    action: 'NEXT',
    session: startRes.session,
    stepId: 'STORYTELLING',
    selected: ['confirm_story'],
    other: ''
  });
  const storyRes = await (await POST(storyReq)).json();
  assert.strictEqual(storyRes.session?.step, 'ROLE');

  // 3. Di step ROLE, user mengetik "Lanjut" secara teks bebas
  console.log('User mengetik "Lanjut" di step ROLE...');
  const roleReq = createMockReq({
    action: 'NEXT',
    session: storyRes.session,
    stepId: 'ROLE',
    selected: [],
    other: 'Lanjut'
  });
  const roleRes = await (await POST(roleReq)).json();
  console.log('Step setelah "Lanjut" di ROLE:', roleRes.session?.step);
  console.log('Roles terpilih:', roleRes.session?.roles?.selected);

  // Pastikan role "Lanjut" TIDAK dibuat sebagai role!
  assert.ok(!roleRes.session?.roles?.selected?.includes('Lanjut'), 'Kata "Lanjut" TIDAK boleh masuk daftar role');
  assert.strictEqual(roleRes.session?.step, 'ALUR', 'Harus berpindah ke step ALUR');
  console.log('✅ Step ROLE -> ALUR dengan "Lanjut" berhasil tanpa polusi role!\n');

  // 4. Di step ALUR, user mengetik "Oke lanjut"
  console.log('=== 3. E2E TEST: STEP ALUR -> RBAC DENGAN "Oke lanjut" ===');
  const alurReq = createMockReq({
    action: 'NEXT',
    session: roleRes.session,
    stepId: 'ALUR',
    selected: [],
    other: 'Oke lanjut'
  });
  const alurRes = await (await POST(alurReq)).json();
  console.log('Step setelah "Oke lanjut" di ALUR:', alurRes.session?.step);
  assert.strictEqual(alurRes.session?.step, 'RBAC', 'Harus berpindah ke step RBAC');
  console.log('✅ Step ALUR -> RBAC dengan "Oke lanjut" berhasil!\n');

  // 5. Di step RBAC, uji beda antara "Lanjut" murni vs koreksi "Ya, tapi..."
  console.log('=== 4. TEST: STEP RBAC - MURNI VS KOREKSI ===');
  // Kasus A: "Lanjut" murni -> harus pindah ke SKEMA_DATA
  const rbacReqConfirm = createMockReq({
    action: 'NEXT',
    session: alurRes.session,
    stepId: 'RBAC',
    selected: [],
    other: 'Lanjut'
  });
  const rbacResConfirm = await (await POST(rbacReqConfirm)).json();
  console.log('Step setelah "Lanjut" murni di RBAC:', rbacResConfirm.session?.step);
  assert.strictEqual(rbacResConfirm.session?.step, 'SKEMA_DATA', 'Harus maju ke SKEMA_DATA');
  console.log('✅ "Lanjut" murni di RBAC berhasil maju ke SKEMA_DATA!\n');

  // Kasus B: "Ya, tapi ada beberapa tambahan: mekanik jangan bisa hapus data"
  // Harus TETAP di RBAC sebagai koreksi
  const rbacReqCorrection = createMockReq({
    action: 'NEXT',
    session: alurRes.session,
    stepId: 'RBAC',
    selected: [],
    other: 'Ya, tapi ada beberapa tambahan: staf bengkel cuma bisa catat servis'
  });
  const rbacResCorrection = await (await POST(rbacReqCorrection)).json();
  console.log('Step setelah kalimat koreksi di RBAC:', rbacResCorrection.session?.step);
  assert.strictEqual(rbacResCorrection.session?.step, 'RBAC', 'Koreksi harus tetap di RBAC');
  assert.strictEqual(rbacResCorrection.session?.rbac?.statusKonfirmasi, 'dikoreksi');
  console.log('✅ Koreksi "Ya, tapi..." di RBAC berhasil dikenali sebagai revisi, bukan konfirmasi murni!\n');

  // 6. Test Tombol Navigasi Mundur (Ada yang terlewat di langkah sebelumnya)
  console.log('=== 5. TEST: TOMBOL NAVIGASI MUNDUR (Ada yang terlewat) ===');
  const backReq = createMockReq({
    action: 'NEXT',
    session: rbacResConfirm.session, // Sesi di SKEMA_DATA
    stepId: 'SKEMA_DATA',
    selected: ['back_to_previous'],
    other: ''
  });
  const backRes = await (await POST(backReq)).json();
  console.log('Judul kartu navigasi mundur:', backRes.guidedStep?.title);
  const backOptionIds = backRes.guidedStep?.options?.map((o: any) => o.id);
  console.log('Pilihan navigasi mundur:', backOptionIds);
  assert.ok(backOptionIds?.some((id: string) => id.startsWith('jump_step_')), 'Harus menyertakan jump_step_*');
  assert.ok(backOptionIds?.includes('cancel_back'), 'Harus menyertakan cancel_back');
  console.log('✅ Kartu navigasi mundur mengembalikan daftar step sebelumnya dan tombol batal secara utuh!\n');

  console.log('🎉 SEMUA TEST VERIFIKASI SELESAI DAN LULUS!');
}

run().catch((err) => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
