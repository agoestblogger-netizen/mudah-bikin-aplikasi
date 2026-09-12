import { buildGuidedStep, applyGuidedAnswer, getDomainFlowDetails, type MockupSessionState } from '../src/lib/templates';

function createMockSession(): MockupSessionState {
  return {
    step: 'ALUR',
    match: {
      templateId: 'tpl_custom_flow',
      overlayIds: [],
      patternIds: [],
      tier: 'BASIC',
      businessCategory: 'Rental Mobil'
    },
    storyline: {
      narasi: 'Bisnis rental mobil lepas kunci dan dengan sopir. Petugas rental memverifikasi dokumen SIM dan KTP penyewa, mengecek kondisi fisik dan kilometer armada, serta melakukan serah-terima kunci.',
      asumsiMasalah: 'Pencatatan manual dokumen penyewa dan kondisi armada rawan keliru.',
      asumsiAktor: ['Super Admin', 'Petugas Rental', 'Sopir', 'Pelanggan'],
      asumsiAlurUtama: '1. Pelanggan memilih mobil dan durasi sewa\n2. Petugas rental memverifikasi KTP/SIM dan cek mobil\n3. Serah terima kunci mobil ke penyewa\n4. Pemilik memantau armada yang keluar masuk',
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
}

console.log('=== TEST 1: Verifikasi buildGuidedStep pada ALUR ===');
const session = createMockSession();
const alurStep = buildGuidedStep(session);
console.log('StepId:', alurStep?.stepId);
console.log('Title:', alurStep?.title);
console.log('Options:', alurStep?.options.map(o => ({ id: o.id, label: o.label, requiresInput: o.requiresInput })));

if (alurStep?.options.find(o => o.id === 'koreksi_alur')?.requiresInput !== true) {
  throw new Error('FAIL: koreksi_alur harus memiliki requiresInput: true');
}
if (!alurStep?.options.find(o => o.id === 'confirm_alur')) {
  throw new Error('FAIL: confirm_alur harus tersedia');
}
console.log('✅ TEST 1 PASSED: Kartu ALUR memiliki opsi confirm_alur dan koreksi_alur (requiresInput: true)');

console.log('\n=== TEST 2: Verifikasi applyGuidedAnswer ALUR (Persetujuan) ===');
const nextSession = applyGuidedAnswer(session, 'ALUR', ['confirm_alur']);
console.log('Next step:', nextSession.step);
console.log('Alur Inti steps count:', nextSession.flow?.alurInti?.length);
console.log('Alur Pendukung count:', nextSession.flow?.alurPendukung?.length);
console.log('Fitur Pendukung count:', nextSession.flow?.fiturPendukung?.length);

if (nextSession.step !== 'RBAC') {
  throw new Error(`FAIL: Next step harus RBAC, dapat: ${nextSession.step}`);
}
if (!nextSession.flow?.alurInti || nextSession.flow.alurInti.length === 0) {
  throw new Error('FAIL: alurInti harus tersimpan di flow');
}
if (!nextSession.flow?.alurPendukung || nextSession.flow.alurPendukung.length === 0) {
  throw new Error('FAIL: alurPendukung harus tersimpan di flow');
}
if (!nextSession.flow?.fiturPendukung || nextSession.flow.fiturPendukung.length === 0) {
  throw new Error('FAIL: fiturPendukung harus tersimpan di flow');
}
console.log('✅ TEST 2 PASSED: Persetujuan melangkah ke RBAC dengan semua data flow utuh');

console.log('\n=== TEST 3: Verifikasi Konsistensi requiresInput di Step Lain ===');
const storySession = { ...session, step: 'STORYTELLING' as const };
const storyStep = buildGuidedStep(storySession);
const minorAdjust = storyStep?.options.find(o => o.id === 'minor_adjust');
console.log('STORYTELLING minor_adjust requiresInput:', minorAdjust?.requiresInput);
if (minorAdjust?.requiresInput !== true) {
  throw new Error('FAIL: minor_adjust di STORYTELLING harus requiresInput: true');
}

const rbacSession = { ...session, step: 'RBAC' as const };
const rbacStep = buildGuidedStep(rbacSession);
const koreksiRbac = rbacStep?.options.find(o => o.id === 'koreksi_rbac');
console.log('RBAC koreksi_rbac requiresInput:', koreksiRbac?.requiresInput);
if (koreksiRbac?.requiresInput !== true) {
  throw new Error('FAIL: koreksi_rbac di RBAC harus requiresInput: true');
}

const skemaSession = { ...session, step: 'SKEMA_DATA' as const };
const skemaStep = buildGuidedStep(skemaSession);
const koreksiSchema = skemaStep?.options.find(o => o.id === 'koreksi_schema');
console.log('SKEMA_DATA koreksi_schema requiresInput:', koreksiSchema?.requiresInput);
if (koreksiSchema?.requiresInput !== true) {
  throw new Error('FAIL: koreksi_schema di SKEMA_DATA harus requiresInput: true');
}

const simulasiSession = { ...session, step: 'SIMULASI_DB' as const };
const simulasiStep = buildGuidedStep(simulasiSession);
const koreksiSimulasi = simulasiStep?.options.find(o => o.id === 'koreksi_simulasi');
console.log('SIMULASI_DB koreksi_simulasi requiresInput:', koreksiSimulasi?.requiresInput);
if (koreksiSimulasi?.requiresInput !== true) {
  throw new Error('FAIL: koreksi_simulasi di SIMULASI_DB harus requiresInput: true');
}

console.log('✅ TEST 3 PASSED: Seluruh step memiliki opsi konfirmasi & koreksi yang konsisten dengan requiresInput: true');
