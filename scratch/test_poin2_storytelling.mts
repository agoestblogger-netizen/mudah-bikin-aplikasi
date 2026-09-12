import { buildGuidedStep, applyGuidedAnswer } from '../src/lib/templates/processes/guided';
import type { MockupSessionState } from '../src/lib/templates/processes/types';

function runTests() {
  console.log('--- TEST POIN 2: STORYTELLING STEP ---');

  // Test 1: Initial Session on STORYTELLING
  const session: MockupSessionState = {
    step: 'STORYTELLING',
    match: {
      templateId: 'MT-20',
      overlayIds: [],
      patternIds: ['UP-06', 'UP-09'],
      tier: 'BASIC',
      businessCategory: 'Toko Kelontong',
      contextualRoles: ['Super Admin', 'Kasir', 'Pelanggan']
    },
    storyline: {
      narasi: 'Di toko kelontong Anda, kasir melayani pembeli setiap hari dan mencatat stok barang. Pemilik memantau rekap harian. Apakah ini sudah menggambarkan proses bisnismu? Kalau ada yang beda, boleh langsung dikoreksi.',
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

  const step1 = buildGuidedStep(session);
  console.log('1. buildGuidedStep on STORYTELLING:');
  console.log('   stepId:', step1?.stepId);
  console.log('   options count:', step1?.options.length);
  console.log('   options:', step1?.options.map(o => o.label));
  if (step1?.stepId !== 'STORYTELLING') throw new Error('Expected stepId to be STORYTELLING');
  if (!step1?.options.some(o => o.id === 'confirm_story')) throw new Error('Missing confirm_story option');
  if (!step1?.options.some(o => o.id === 'mismatch_story')) throw new Error('Missing mismatch_story option');

  // Test 2: User confirms -> advances to ROLE
  console.log('\n2. User confirms (confirm_story):');
  const sessionConfirmed = applyGuidedAnswer(session, 'STORYTELLING', ['confirm_story']);
  console.log('   Next step:', sessionConfirmed.step);
  console.log('   Status konfirmasi:', sessionConfirmed.storyline?.statusKonfirmasi);
  if (sessionConfirmed.step !== 'ROLE') throw new Error('Expected step to be ROLE on confirm');
  if (sessionConfirmed.storyline?.statusKonfirmasi !== 'disetujui') throw new Error('Expected statusKonfirmasi to be disetujui');

  // Test 3: ROLE step prioritizes storyline.asumsiAktor
  console.log('\n3. buildGuidedStep on ROLE:');
  const roleStep = buildGuidedStep(sessionConfirmed);
  console.log('   stepId:', roleStep?.stepId);
  console.log('   top roles:', roleStep?.options.slice(0, 5).map(o => `${o.label} (${o.description})`));
  const hasAktorStoryline = roleStep?.options.some(o => o.description?.includes('Cerita Bisnis'));
  console.log('   Has storyline actors in role choices?:', hasAktorStoryline);
  if (!hasAktorStoryline) throw new Error('Expected storyline actors to be recommended in ROLE step');

  // Test 4: User reports mismatch (revisi 1) -> stays on STORYTELLING
  console.log('\n4. User reports mismatch (revisi 1):');
  const sessionMismatch1 = applyGuidedAnswer(session, 'STORYTELLING', ['mismatch_story']);
  console.log('   Next step:', sessionMismatch1.step);
  console.log('   revisiCount:', sessionMismatch1.storyline?.revisiCount);
  console.log('   statusKonfirmasi:', sessionMismatch1.storyline?.statusKonfirmasi);
  if (sessionMismatch1.step !== 'STORYTELLING') throw new Error('Expected step to remain STORYTELLING for clarification');
  if (sessionMismatch1.storyline?.revisiCount !== 1) throw new Error('Expected revisiCount to be 1');

  // Test 5: User reports mismatch again (revisi 2) -> stays on STORYTELLING for 2nd clarification
  console.log('\n5. User reports mismatch again (revisi 2):');
  const sessionMismatch2 = applyGuidedAnswer(sessionMismatch1, 'STORYTELLING', ['mismatch_story']);
  console.log('   Next step:', sessionMismatch2.step);
  console.log('   revisiCount:', sessionMismatch2.storyline?.revisiCount);
  if (sessionMismatch2.step !== 'STORYTELLING') throw new Error('Expected step to remain STORYTELLING for 2nd clarification');
  if (sessionMismatch2.storyline?.revisiCount !== 2) throw new Error('Expected revisiCount to be 2');

  // Test 6: Reached 2 revisions limit -> advances to ROLE
  console.log('\n6. Reached 2 revisions limit (revisi 3):');
  const sessionMismatch3 = applyGuidedAnswer(sessionMismatch2, 'STORYTELLING', ['mismatch_story']);
  console.log('   Next step:', sessionMismatch3.step);
  if (sessionMismatch3.step !== 'ROLE') throw new Error('Expected step to advance to ROLE after 2 revisions');

  // Test 7: Minor adjustment -> advances to ROLE with 'dikoreksi'
  console.log('\n7. User makes minor adjustment:');
  const sessionAdjusted = applyGuidedAnswer(session, 'STORYTELLING', ['minor_adjust'], 'Tambahkan kurir antar pesanan');
  console.log('   Next step:', sessionAdjusted.step);
  console.log('   statusKonfirmasi:', sessionAdjusted.storyline?.statusKonfirmasi);
  console.log('   narasi:', sessionAdjusted.storyline?.narasi);
  if (sessionAdjusted.step !== 'ROLE') throw new Error('Expected step to advance to ROLE on minor adjust');
  if (sessionAdjusted.storyline?.statusKonfirmasi !== 'dikoreksi') throw new Error('Expected statusKonfirmasi to be dikoreksi');

  console.log('\n✅ ALL POIN 2 TESTS PASSED PERFECTLY!');
}

runTests();
