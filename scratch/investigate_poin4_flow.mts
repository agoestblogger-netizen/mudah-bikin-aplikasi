import { generateStorylineWithAI } from '../src/app/api/guided/route';
import { buildGuidedStep, getDomainFlowDetails } from '../src/lib/templates/processes/guided';
import type { MockupSessionState } from '../src/lib/templates/processes/types';

async function investigate() {
  console.log('================================================================');
  console.log('INVESTIGASI BAGIAN A & BAGIAN B (STEP ALUR)');
  console.log('================================================================\n');

  // --------------------------------------------------------------------------
  // 1. TEST END-TO-END ASLI RENTAL MOBIL (PROMPT -> AI -> ROLE STEP)
  // --------------------------------------------------------------------------
  console.log('--- [BAGIAN A] TEST END-TO-END ASLI DARI PROMPT (TANPA INJEKSI MANUAL) ---');
  const rentalPrompt = 'buatkan aplikasi rental mobil lepas kunci dan dengan sopir';
  console.log(`Prompt: "${rentalPrompt}"\n`);

  const rentalStoryline = await generateStorylineWithAI(rentalPrompt);

  console.log('HASIL STORYLINE AI:');
  console.log(`- AppName: ${rentalStoryline.appName}`);
  console.log(`- Kategori: ${rentalStoryline.businessCategory}`);
  console.log(`- Narasi Storytelling:\n  "${rentalStoryline.narasi}"`);
  console.log(`- Asumsi Alur Utama:\n  "${rentalStoryline.asumsiAlurUtama}"`);
  console.log(`- Asumsi Masalah:\n  "${rentalStoryline.asumsiMasalah}"`);
  console.log(`- Asumsi Aktor (Asli dari AI):\n  ${JSON.stringify(rentalStoryline.asumsiAktor)}`);
  console.log(`- Detail Aktor Keys:\n  ${Object.keys(rentalStoryline.detailAktor || {})}`);

  const sessionRentalNatural: MockupSessionState = {
    step: 'ROLE',
    match: {
      templateId: rentalStoryline.templateId || 'MT-20',
      overlayIds: rentalStoryline.overlayIds || [],
      patternIds: rentalStoryline.patternIds || ['UP-06', 'UP-09'],
      tier: 'STARTER',
      businessCategory: rentalStoryline.businessCategory,
      contextualPainPoints: [],
      contextualRoles: []
    },
    storyline: {
      narasi: rentalStoryline.narasi,
      asumsiMasalah: rentalStoryline.asumsiMasalah,
      asumsiAktor: rentalStoryline.asumsiAktor, // MURNI ASLI TANPA SUNTIKAN
      asumsiAlurUtama: rentalStoryline.asumsiAlurUtama,
      statusKonfirmasi: 'disetujui',
      revisiCount: 0,
      detailAktor: rentalStoryline.detailAktor
    },
    roles: { selected: [] },
    flow: {},
    painPoints: { selected: [] },
    features: { selected: [] }
  };

  const roleStepNatural = buildGuidedStep(sessionRentalNatural);
  console.log('\nHASIL STEP ROLE DARI PROMPT ASLI:');
  console.table(
    roleStepNatural.options.map(opt => ({
      ID: opt.id,
      Label: opt.label,
      Status: opt.roleStatus,
      Locked: opt.locked ? 'Ya' : 'Tidak',
      Recommended: opt.recommended ? 'Ya' : 'Tidak',
      Deskripsi: opt.description.slice(0, 75) + '...',
      TanggungJawab: opt.responsibilities?.join('; ')
    }))
  );

  // --------------------------------------------------------------------------
  // 2. INVESTIGASI KECUKUPAN DETAIL asumsiAlurUtama (BAGIAN B)
  // --------------------------------------------------------------------------
  console.log('\n--- [BAGIAN B] INVESTIGASI KECUKUPAN DETAIL asumsiAlurUtama ---');
  
  const cuciMobilPrompt = 'buatkan aplikasi cuci mobil';
  const cuciStoryline = await generateStorylineWithAI(cuciMobilPrompt);

  console.log('\n[Domain 1: Rental Mobil]');
  console.log(`- Narasi: "${rentalStoryline.narasi}"`);
  console.log(`- Asumsi Alur Utama: "${rentalStoryline.asumsiAlurUtama}"`);

  console.log('\n[Domain 2: Cuci Mobil]');
  console.log(`- Narasi: "${cuciStoryline.narasi}"`);
  console.log(`- Asumsi Alur Utama: "${cuciStoryline.asumsiAlurUtama}"`);

  // Evaluasi Alur yang dihasilkan saat ini oleh getDomainFlowDetails
  const sessionCuci: MockupSessionState = {
    step: 'FLOW',
    match: {
      templateId: 'MT-01',
      overlayIds: [],
      patternIds: ['UP-06'],
      tier: 'STARTER',
      businessCategory: cuciStoryline.businessCategory,
      contextualPainPoints: [],
      contextualRoles: []
    },
    storyline: {
      narasi: cuciStoryline.narasi,
      asumsiMasalah: cuciStoryline.asumsiMasalah,
      asumsiAktor: cuciStoryline.asumsiAktor,
      asumsiAlurUtama: cuciStoryline.asumsiAlurUtama,
      statusKonfirmasi: 'disetujui',
      revisiCount: 0,
      detailAktor: cuciStoryline.detailAktor
    },
    roles: { selected: ['Super Admin', 'Kasir Penerima Kendaraan', 'Staf Cuci & Vakum'], wajib: ['Super Admin', 'Kasir Penerima Kendaraan'] },
    flow: {},
    painPoints: { selected: [] },
    features: { selected: [] }
  };

  const existingRentalFlow = getDomainFlowDetails(sessionRentalNatural);
  const existingCuciFlow = getDomainFlowDetails(sessionCuci);

  console.log('\nAlur Inti Saat Ini (Rental Mobil):');
  console.table(existingRentalFlow.alurInti);

  console.log('\nAlur Inti Saat Ini (Cuci Mobil):');
  console.table(existingCuciFlow.alurInti);
}

investigate().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
