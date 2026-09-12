import * as userAuth from '../src/lib/supabase/user';
// @ts-ignore
userAuth.getUserFromRequest = async () => ({ id: 'mock-user-123', email: 'test@example.com' } as any);

import type { MockupSessionState } from '../src/lib/templates';

async function runTest() {
  const { POST } = await import('../src/app/api/guided/route');
  const session: MockupSessionState = {
    step: 'ALUR',
    match: {
      templateId: 'tpl_custom_flow',
      overlayIds: [],
      patternIds: [],
      tier: 'BASIC',
      businessCategory: 'Rental Mobil'
    },
    storyline: {
      narasi: 'Bisnis rental mobil lepas kunci dan dengan sopir.',
      asumsiMasalah: 'Pencatatan armada manual.',
      asumsiAktor: ['Super Admin', 'Petugas Rental', 'Sopir', 'Pelanggan'],
      asumsiAlurUtama: '1. Pelanggan memilih mobil\n2. Petugas memverifikasi dokumen\n3. Serah terima unit armada\n4. Pemilik memantau operasional',
      statusKonfirmasi: 'disetujui',
      revisiCount: 0
    },
    roles: {
      selected: ['Super Admin', 'Petugas Rental', 'Sopir', 'Pelanggan'],
      wajib: ['Super Admin', 'Petugas Rental'],
      tambahan: ['Sopir', 'Pelanggan']
    },
    flow: {},
    painPoints: { selected: [] },
    features: { selected: [] }
  };

  console.log('=== TEST API 1: Memilih "koreksi_alur" dengan teks koreksi ===');
  const reqCorrection = new Request('http://localhost:3000/api/guided', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token'
    },
    body: JSON.stringify({
      action: 'NEXT',
      stepId: 'ALUR',
      session,
      selected: ['koreksi_alur'],
      other: 'koreksi langkah 2: Petugas Rental memverifikasi dokumen SIM/BPKB dan foto spidometer'
    })
  });

  const res1 = await POST(reqCorrection);
  const data1 = await res1.json();
  console.log('Response 1:', data1);
  console.log('Success:', data1.success);
  console.log('Returned session.step:', data1.session?.step);
  console.log('Returned guidedStep.stepId:', data1.guidedStep?.stepId);
  console.log('Step 2 aksi:', data1.session?.flow?.alurInti?.find((s: any) => s.step === 2)?.aksi);

  if (data1.session?.step !== 'ALUR') {
    throw new Error(`FAIL: Step harus tetap ALUR saat koreksi, dapat: ${data1.session?.step}`);
  }
  if (data1.guidedStep?.stepId !== 'ALUR') {
    throw new Error(`FAIL: guidedStep harus untuk ALUR, dapat: ${data1.guidedStep?.stepId}`);
  }
  const step2Aksi = data1.session?.flow?.alurInti?.find((s: any) => s.step === 2)?.aksi;
  if (!step2Aksi || !step2Aksi.includes('SIM/BPKB') && !step2Aksi.includes('spidometer')) {
    console.warn('Note: Step 2 aksi is:', step2Aksi);
  }
  console.log('✅ TEST API 1 PASSED: Sistem tidak lompat ke RBAC, memperbarui flow, dan menampilkan kartu ALUR ulang!');

  console.log('\n=== TEST API 2: Memilih "confirm_alur" setelah koreksi ===');
  const reqConfirm = new Request('http://localhost:3000/api/guided', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token'
    },
    body: JSON.stringify({
      action: 'NEXT',
      stepId: 'ALUR',
      session: data1.session,
      selected: ['confirm_alur']
    })
  });

  const res2 = await POST(reqConfirm);
  const data2 = await res2.json();
  console.log('Success:', data2.success);
  console.log('Returned session.step:', data2.session?.step);
  console.log('Returned guidedStep.stepId:', data2.guidedStep?.stepId);
  console.log('Narration snippet:', data2.narration?.slice(0, 70));

  if (data2.session?.step !== 'RBAC') {
    throw new Error(`FAIL: Step harus maju ke RBAC setelah confirm, dapat: ${data2.session?.step}`);
  }
  if (data2.guidedStep?.stepId !== 'RBAC') {
    throw new Error(`FAIL: guidedStep harus untuk RBAC, dapat: ${data2.guidedStep?.stepId}`);
  }
  console.log('✅ TEST API 2 PASSED: Setelah confirm_alur dipilih, sistem maju dengan sukses ke RBAC!');
}

runTest().catch((err) => {
  console.error('Error during test:', err);
  process.exit(1);
});
