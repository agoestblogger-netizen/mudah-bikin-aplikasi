import {
  buildGuidedStep,
  applyGuidedAnswer,
  detectCoreOperationalRole,
  renderRoleSummaryTable
} from '../src/lib/templates/processes/guided';
import type { MockupSessionState } from '../src/lib/templates/processes/types';

function runPoin3Tests() {
  console.log('--- TEST POIN 3: ROLE & DELEGATION SPECIFICATIONS ---');

  const session: MockupSessionState = {
    step: 'ROLE',
    match: {
      templateId: 'MT-20',
      overlayIds: [],
      patternIds: ['UP-06', 'UP-09'],
      tier: 'BASIC',
      businessCategory: 'Toko Kelontong',
      contextualRoles: ['Super Admin', 'Kasir', 'Staf Gudang', 'Pelanggan']
    },
    storyline: {
      narasi: 'Di toko kelontong Anda, kasir melayani pembeli dan mencatat stok.',
      asumsiMasalah: 'Pencatatan manual rawan selisih.',
      asumsiAktor: ['Super Admin', 'Kasir', 'Staf Gudang', 'Pelanggan'],
      asumsiAlurUtama: 'Pembeli memilih barang -> Kasir melayani -> Pemilik memantau rekap',
      statusKonfirmasi: 'disetujui',
      revisiCount: 0
    },
    roles: { selected: [] },
    flow: {},
    painPoints: { selected: [] },
    features: { selected: [] }
  };

  // 1. Core operational role detection
  const coreRole = detectCoreOperationalRole(session);
  console.log('1. Core operational role detected:', coreRole);
  if (coreRole !== 'Kasir') throw new Error(`Expected core role to be Kasir, got ${coreRole}`);

  // 2. buildRoleStep options verification
  const roleStep = buildGuidedStep(session);
  console.log('\n2. Role step options:');
  roleStep?.options.forEach((o) => {
    console.log(`   - ${o.label} [${o.roleStatus}] locked=${o.locked} rec=${o.recommended}`);
    console.log(`     Narasi: ${o.description}`);
    console.log(`     Tugas: ${o.responsibilities?.join('; ')}`);
  });

  const superAdminOpt = roleStep?.options.find((o) => o.id === 'Super Admin');
  if (!superAdminOpt || !superAdminOpt.locked || superAdminOpt.roleStatus !== 'WAJIB_OWNER') {
    throw new Error('Super Admin must be locked with WAJIB_OWNER status');
  }

  const coreOpt = roleStep?.options.find((o) => o.id === coreRole);
  if (!coreOpt || coreOpt.roleStatus !== 'WAJIB_INTI') {
    throw new Error('Core operational role must have WAJIB_INTI status');
  }

  // 3. User selects Super Admin and Kasir (Staf Gudang and Pelanggan are removed/deselected)
  console.log('\n3. User keeps Super Admin + Kasir, removes Staf Gudang:');
  const nextSession = applyGuidedAnswer(session, 'ROLE', ['Super Admin', 'Kasir']);

  console.log('   Selected:', nextSession.roles.selected);
  console.log('   Wajib:', nextSession.roles.wajib);
  console.log('   Tambahan:', nextSession.roles.tambahan);
  console.log('   Tugas Dilimpahkan:', nextSession.roles.tugasDilimpahkan);

  if (!nextSession.roles.wajib?.includes('Super Admin') || !nextSession.roles.wajib?.includes('Kasir')) {
    throw new Error('Expected wajib to include Super Admin and Kasir');
  }

  const delegatedStafGudang = nextSession.roles.tugasDilimpahkan?.find((d) => d.dariRole === 'Staf Gudang');
  if (!delegatedStafGudang || delegatedStafGudang.keRole !== 'Super Admin') {
    throw new Error('Tasks of removed Staf Gudang must be delegated to Super Admin');
  }
  console.log('   Tugas Staf Gudang yang dilimpahkan ke Owner:', delegatedStafGudang.daftarTugas);

  // 4. Render final summary table
  console.log('\n4. Mandatory closing summary table:');
  const table = renderRoleSummaryTable(nextSession.roles, nextSession.match.businessCategory);
  console.log(table);

  if (!table.includes('| Role | Status | Tanggung Jawab Utama |')) {
    throw new Error('Table header missing');
  }
  if (!table.includes('_ (dilimpahkan dari Staf Gudang)_') && !table.includes('dilimpahkan dari Staf Gudang')) {
    throw new Error('Delegated tasks must be marked with italics');
  }

  // 5. Re-delegation to another role
  console.log('\n5. Re-delegate tasks from Staf Gudang to Kasir:');
  delegatedStafGudang.keRole = 'Kasir';
  const tableReDelegated = renderRoleSummaryTable(nextSession.roles, nextSession.match.businessCategory);
  console.log(tableReDelegated);
  if (!tableReDelegated.includes('Kasir | Wajib (Alur Inti) |') || !tableReDelegated.includes('dilimpahkan dari Staf Gudang')) {
    throw new Error('Table should reflect re-delegation to Kasir');
  }

  console.log('\n✅ ALL POIN 3 TESTS PASSED PERFECTLY!');
}

runPoin3Tests();
