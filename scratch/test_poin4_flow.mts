import {
  getDomainFlowDetails,
  renderFlowMarkdown,
  resolveActorForStep,
  buildGuidedStep,
  applyGuidedAnswer,
  compileBriefFromSession
} from '../src/lib/templates/processes/guided';
import type { MockupSessionState } from '../src/lib/templates/processes/types';

function createMockSession(overrides: Partial<MockupSessionState> = {}): MockupSessionState {
  return {
    step: 'ALUR',
    match: {
      templateId: 'pos-retail',
      patternIds: ['UP-02', 'UP-09'],
      overlayIds: ['IND-01'],
      tier: 'BASIC',
      businessCategory: 'Retail / Toko',
      contextualRoles: ['Super Admin', 'Kasir', 'Pelanggan']
    },
    storyline: {
      narasi: 'Toko serba ada yang melayani pembelian barang harian oleh pelanggan di meja kasir.',
      asumsiMasalah: 'Pencatatan kas dan transaksi sering tidak sinkron di akhir shift',
      asumsiAktor: ['Super Admin', 'Kasir', 'Pelanggan'],
      asumsiAlurUtama: 'Pelanggan belanja → Kasir memindai dan menerima pembayaran → Super Admin cek kas',
      statusKonfirmasi: 'disetujui'
    },
    roles: {
      selected: ['Super Admin', 'Kasir'],
      wajib: ['Super Admin', 'Kasir'],
      tambahan: []
    },
    flow: {},
    painPoints: { selected: [] },
    features: { selected: [] },
    ...overrides
  };
}

async function runTests() {
  console.log('=== TEST POIN 4: STEP ALUR & FITUR PENDUKUNG ===\n');

  // Test 1: Domain Flow Details for Retail (Active Kasir)
  console.log('--- TEST 1: Retail Domain Flow (Kasir Active) ---');
  const sessionRetail = createMockSession();
  const flowRetail = getDomainFlowDetails(sessionRetail);

  console.log(`Alur Inti steps count: ${flowRetail.alurInti.length} (must be 5-7)`);
  if (flowRetail.alurInti.length < 5 || flowRetail.alurInti.length > 7) {
    throw new Error(`Alur Inti count invalid: ${flowRetail.alurInti.length}`);
  }

  const actorsInInti = flowRetail.alurInti.map((s) => s.pelaku);
  console.log(`Actors in Alur Inti: ${actorsInInti.join(', ')}`);
  if (!actorsInInti.includes('Kasir')) {
    throw new Error('Role wajib kedua (Kasir) HARUS muncul di Alur Inti');
  }

  console.log(`Alur Pendukung count: ${flowRetail.alurPendukung.length} (must be 1-2)`);
  if (flowRetail.alurPendukung.length < 1 || flowRetail.alurPendukung.length > 2) {
    throw new Error(`Alur Pendukung count invalid: ${flowRetail.alurPendukung.length}`);
  }

  console.log(`Fitur Pendukung count: ${flowRetail.fiturPendukung.length} (must be 3-5)`);
  if (flowRetail.fiturPendukung.length < 3 || flowRetail.fiturPendukung.length > 5) {
    throw new Error(`Fitur Pendukung count invalid: ${flowRetail.fiturPendukung.length}`);
  }
  console.log('✅ TEST 1 PASSED\n');

  // Test 2: Role Consistency & Task Delegation (Kasir Dihapus & Dilimpahkan ke Owner)
  console.log('--- TEST 2: Role Consistency (Kasir Dihapus -> Tugas Dilimpahkan ke Super Admin) ---');
  const sessionDelegated = createMockSession({
    roles: {
      selected: ['Super Admin'],
      wajib: ['Super Admin'],
      tambahan: [],
      tugasDilimpahkan: [
        {
          dariRole: 'Kasir',
          keRole: 'Super Admin',
          daftarTugas: [
            'Mencatat transaksi belanja pesanan pelanggan',
            'Menerima pembayaran tunai maupun digital dan mencetak nota'
          ]
        }
      ]
    }
  });

  const flowDelegated = getDomainFlowDetails(sessionDelegated);
  const actorsDelegated = flowDelegated.alurInti.map((s) => s.pelaku);
  console.log(`Actors in Alur Inti after delegation: ${actorsDelegated.join(', ')}`);

  if (actorsDelegated.includes('Kasir')) {
    throw new Error('Kasir yang sudah dihapus TIDAK BOLEH muncul sebagai pelaku di Alur Inti!');
  }
  if (!actorsDelegated.includes('Super Admin')) {
    throw new Error('Super Admin HARUS menjadi pelaku dari tugas kasir yang dilimpahkan!');
  }
  console.log('✅ TEST 2 PASSED\n');

  // Test 3: Custom Delegation (Kasir dilimpahkan ke Manajer Toko)
  console.log('--- TEST 3: Custom Delegation (Kasir -> Manajer Toko) ---');
  const sessionCustomDelegated = createMockSession({
    roles: {
      selected: ['Super Admin', 'Manajer Toko'],
      wajib: ['Super Admin'],
      tambahan: ['Manajer Toko'],
      tugasDilimpahkan: [
        {
          dariRole: 'Kasir',
          keRole: 'Manajer Toko',
          daftarTugas: ['Melayani kasir']
        }
      ]
    }
  });
  const flowCustom = getDomainFlowDetails(sessionCustomDelegated);
  const actorsCustom = flowCustom.alurInti.map((s) => s.pelaku);
  console.log(`Actors with custom delegation: ${actorsCustom.join(', ')}`);
  if (!actorsCustom.includes('Manajer Toko')) {
    throw new Error('Manajer Toko HARUS muncul sebagai pelaku alur kasir!');
  }
  console.log('✅ TEST 3 PASSED\n');

  // Test 4: Service / Workshop Domain
  console.log('--- TEST 4: Servis / Bengkel Domain ---');
  const sessionBengkel = createMockSession({
    match: {
      templateId: 'service-workshop',
      patternIds: ['UP-04'],
      overlayIds: ['IND-03'],
      tier: 'BASIC',
      businessCategory: 'Bengkel & Servis Kendaraan',
      contextualRoles: ['Super Admin', 'Teknisi', 'Pelanggan']
    },
    roles: {
      selected: ['Super Admin', 'Teknisi'],
      wajib: ['Super Admin', 'Teknisi'],
      tambahan: []
    }
  });
  const flowBengkel = getDomainFlowDetails(sessionBengkel);
  console.log(`Bengkel steps count: ${flowBengkel.alurInti.length}`);
  const bengkelActors = flowBengkel.alurInti.map((s) => s.pelaku);
  console.log(`Bengkel actors: ${bengkelActors.join(', ')}`);
  if (!bengkelActors.includes('Teknisi')) {
    throw new Error('Teknisi HARUS muncul sebagai pelaku di bengkel!');
  }
  console.log('✅ TEST 4 PASSED\n');

  // Test 5: Render Markdown Formatting
  console.log('--- TEST 5: Render Markdown Formatting ---');
  const markdown = renderFlowMarkdown(flowRetail);
  console.log('Rendered Markdown Output snippet:');
  console.log(markdown.substring(0, 300) + '...\n');
  if (!markdown.includes('#### 1. Alur Inti (Aktivitas Utama)')) {
    throw new Error('Markdown harus berisi heading Alur Inti');
  }
  if (!markdown.includes('#### 2. Alur Pendukung')) {
    throw new Error('Markdown harus berisi heading Alur Pendukung');
  }
  if (!markdown.includes('#### 3. Fitur Pendukung (MVP)')) {
    throw new Error('Markdown harus berisi heading Fitur Pendukung');
  }
  if (markdown.startsWith('Halo') || markdown.startsWith('Baik')) {
    throw new Error('Narasi tidak boleh memiliki pembuka percakapan ekstra');
  }
  console.log('✅ TEST 5 PASSED\n');

  // Test 6: buildGuidedStep for ALUR
  console.log('--- TEST 6: buildGuidedStep(ALUR) ---');
  const payload = buildGuidedStep(sessionRetail);
  console.log(`Payload stepId: ${payload.stepId}, Options count: ${payload.options.length}`);
  const alurIntiOpt = payload.options.find((o) => o.id === 'alur_inti');
  if (!alurIntiOpt) throw new Error('Option alur_inti wajib ada');
  if (!alurIntiOpt.locked) throw new Error('Option alur_inti HARUS locked');
  if (alurIntiOpt.category !== 'ALUR_INTI') throw new Error('Category alur_inti harus ALUR_INTI');
  if (!alurIntiOpt.steps || alurIntiOpt.steps.length === 0) throw new Error('Steps alur_inti harus ada');

  const supportingFlowOpt = payload.options.find((o) => o.category === 'ALUR_PENDUKUNG');
  if (!supportingFlowOpt) throw new Error('Option ALUR_PENDUKUNG harus ada');

  const featureOpt = payload.options.find((o) => o.category === 'FITUR_PENDUKUNG');
  if (!featureOpt) throw new Error('Option FITUR_PENDUKUNG harus ada');
  console.log('✅ TEST 6 PASSED\n');

  // Test 7: applyGuidedAnswer for ALUR
  console.log('--- TEST 7: applyGuidedAnswer(ALUR) ---');
  const nextSession = applyGuidedAnswer(
    sessionRetail,
    'ALUR',
    ['alur_inti', payload.options.find((o) => o.category === 'ALUR_PENDUKUNG')!.id, featureOpt.id],
    'Pencetakan label barcode custom'
  );

  console.log(`Next step: ${nextSession.step} (must be RBAC)`);
  if (nextSession.step !== 'RBAC') {
    throw new Error(`Expected step RBAC, got ${nextSession.step}`);
  }
  if (!nextSession.flow.alurInti || nextSession.flow.alurInti.length === 0) {
    throw new Error('session.flow.alurInti harus terisi');
  }
  if (!nextSession.flow.alurPendukung || nextSession.flow.alurPendukung.length === 0) {
    throw new Error('session.flow.alurPendukung harus terisi');
  }
  if (!nextSession.flow.fiturPendukung || nextSession.flow.fiturPendukung.length === 0) {
    throw new Error('session.flow.fiturPendukung harus terisi');
  }
  if (!nextSession.flow.fiturPendukung.includes('Pencetakan label barcode custom')) {
    throw new Error('Custom feature dari "other" harus masuk ke fiturPendukung');
  }
  console.log('session.flow state:');
  console.log(JSON.stringify(nextSession.flow, null, 2));
  console.log('✅ TEST 7 PASSED\n');

  // Test 8: compileBriefFromSession formatting
  console.log('--- TEST 8: compileBriefFromSession Output ---');
  const brief = compileBriefFromSession(nextSession);
  if (!brief.includes('- **Alur Inti (Aktivitas Utama)**:')) {
    throw new Error('Brief harus menyertakan Alur Inti');
  }
  if (!brief.includes('- **Alur Pendukung**:')) {
    throw new Error('Brief harus menyertakan Alur Pendukung');
  }
  if (!brief.includes('- **Fitur Pendukung (MVP)**:')) {
    throw new Error('Brief harus menyertakan Fitur Pendukung (MVP)');
  }
  if (brief.includes('(V1)') || brief.includes('(V2)')) {
    throw new Error('Brief tidak boleh memuat pemisahan V1/V2 lagi');
  }
  console.log('✅ TEST 8 PASSED\n');

  console.log('🎉 ALL POIN 4 TESTS PASSED 100%!');
}

runTests().catch((err) => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
