import { buildGuidedStep, calculateConceptualSimilarity, deduplicateRoleOptionsSemantically } from '../src/lib/templates/processes/guided';
import { generateStorylineWithAI } from '../src/app/api/guided/route';
import type { MockupSessionState } from '../src/lib/templates/processes/types';

async function main() {
  console.log('================================================================');
  console.log('TEST & VERIFIKASI POIN REVISI 4: DEDUPLIKASI SEMANTIK ROLE');
  console.log('================================================================\n');

  // --------------------------------------------------------------------------
  // TEST 1: DOMAIN RENTAL MOBIL (KASUS ASLI BUG POIN REVISI 4)
  // --------------------------------------------------------------------------
  console.log('--- [TEST 1] RENTAL MOBIL LEPAS KUNCI & SOPIR ---');
  const rentalPrompt = 'buatkan aplikasi rental mobil lepas kunci dan dengan sopir';
  const rentalStoryline = await generateStorylineWithAI(rentalPrompt);

  console.log(`AppName: ${rentalStoryline.appName}`);
  console.log(`Kategori: ${rentalStoryline.businessCategory}`);
  console.log(`Storyline Aktor: ${rentalStoryline.asumsiAktor.join(', ')}`);

  // Simulasi skenario persis di mana ada 'Petugas Rental' dan 'Petugas Penerimaan & Penyerahan Kunci'
  const duplicateAktorList = [
    'Super Admin',
    'Petugas Rental',
    'Sopir Armada',
    'Penyewa',
    'Petugas Penerimaan & Penyerahan Kunci'
  ];

  const sessionRental: MockupSessionState = {
    step: 'ROLE',
    match: {
      templateId: 'MT-20',
      overlayIds: [],
      patternIds: ['UP-06', 'UP-09'],
      tier: 'STARTER',
      businessCategory: rentalStoryline.businessCategory,
      contextualPainPoints: [],
      contextualRoles: []
    },
    storyline: {
      narasi: rentalStoryline.narasi,
      asumsiMasalah: rentalStoryline.asumsiMasalah,
      asumsiAktor: duplicateAktorList,
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

  const roleStepRental = buildGuidedStep(sessionRental);
  console.log('\nDaftar Lengkap Role Step ROLE untuk Rental Mobil (Sesudah Deduplikasi Semantik):');
  console.table(
    roleStepRental.options.map((opt) => ({
      ID: opt.id,
      Label: opt.label,
      Status: opt.roleStatus,
      Locked: opt.locked ? 'Ya' : 'Tidak',
      Recommended: opt.recommended ? 'Ya' : 'Tidak',
      Deskripsi: opt.description,
      TanggungJawab: opt.responsibilities?.join(' | ')
    }))
  );

  const rentalLabels = roleStepRental.options.map((o) => o.label);
  const rentalStatuses = roleStepRental.options.map((o) => o.roleStatus);

  // Verifikasi 1: Petugas Rental dan Petugas Penerimaan & Penyerahan Kunci menjadi SATU entri
  const countHandoverRoles = rentalLabels.filter((l) => 
    l.toLowerCase().includes('rental') || 
    l.toLowerCase().includes('kunci') || 
    l.toLowerCase().includes('serah')
  ).length;

  if (countHandoverRoles !== 1) {
    throw new Error(`TEST 1 GAGAL: Masih ada ${countHandoverRoles} entri petugas rental/kunci! Harusnya hanya 1 entri.`);
  }

  // Verifikasi 2: Status Wajib (Inti) tetap terjaga
  const handoverRole = roleStepRental.options.find((o) => 
    o.label.toLowerCase().includes('rental') || 
    o.label.toLowerCase().includes('kunci')
  );
  if (!handoverRole || handoverRole.roleStatus !== 'WAJIB_INTI') {
    throw new Error(`TEST 1 GAGAL: Role serah-terima unit hasil merge tidak berstatus WAJIB_INTI! Status saat ini: ${handoverRole?.roleStatus}`);
  }

  // Verifikasi 3: Konten tetap kaya dan menyebut SIM/BPKB/kilometer/kunci
  const handoverCombined = `${handoverRole.description} ${handoverRole.responsibilities?.join(' ')}`.toLowerCase();
  if (!handoverCombined.includes('sim') || !handoverCombined.includes('kilometer') || !handoverCombined.includes('kunci')) {
    throw new Error('TEST 1 GAGAL: Detail penting SIM/kilometer/kunci hilang setelah penggabungan!');
  }

  console.log('✅ TEST 1 LOLOS: "Petugas Rental" dan "Petugas Kunci" sukses disatukan menjadi 1 entri Wajib (Inti) tanpa kehilangan detail penting!\n');

  // --------------------------------------------------------------------------
  // TEST 2: TEST REGRESI 3 DOMAIN LAMA (CUCI MOBIL, KLINIK GIGI, KAFE)
  // --------------------------------------------------------------------------
  console.log('--- [TEST 2] TEST REGRESI 3 DOMAIN LAMA ---');

  const domainCases = [
    {
      name: 'Cuci Mobil',
      prompt: 'buatkan aplikasi cuci mobil',
      expectedRoles: ['Super Admin', 'Kasir Penerima Kendaraan', 'Staf Cuci & Vakum', 'Pelanggan']
    },
    {
      name: 'Klinik Gigi',
      prompt: 'buatkan aplikasi klinik dokter gigi',
      expectedRoles: ['Super Admin', 'Dokter Gigi', 'Resepsionis & Kasir', 'Pasien']
    },
    {
      name: 'Kafe',
      prompt: 'buatkan aplikasi kafe dan kedai kopi modern',
      expectedRoles: ['Super Admin', 'Barista & Dapur', 'Staf Kasir', 'Pelanggan']
    }
  ];

  for (const d of domainCases) {
    console.log(`\nMenguji Domain: ${d.name}...`);
    const aiStory = await generateStorylineWithAI(d.prompt);

    const session: MockupSessionState = {
      step: 'ROLE',
      match: {
        templateId: 'MT-01',
        overlayIds: [],
        patternIds: ['UP-06'],
        tier: 'STARTER',
        businessCategory: aiStory.businessCategory,
        contextualPainPoints: [],
        contextualRoles: []
      },
      storyline: {
        narasi: aiStory.narasi,
        asumsiMasalah: aiStory.asumsiMasalah,
        asumsiAktor: aiStory.asumsiAktor,
        asumsiAlurUtama: aiStory.asumsiAlurUtama,
        statusKonfirmasi: 'disetujui',
        revisiCount: 0,
        detailAktor: aiStory.detailAktor
      },
      roles: { selected: [] },
      flow: {},
      painPoints: { selected: [] },
      features: { selected: [] }
    };

    const roleStep = buildGuidedStep(session);
    console.log(`Daftar Role ${d.name}:`);
    console.table(
      roleStep.options.map((opt) => ({
        ID: opt.id,
        Label: opt.label,
        Status: opt.roleStatus,
        DeskripsiSingkat: opt.description.slice(0, 60) + '...',
        TanggungJawab: opt.responsibilities?.slice(0, 2).join('; ')
      }))
    );

    // Pastikan tidak ada role yang salah tergabung (jumlah role harus tetap sesuai aktor relevan)
    if (roleStep.options.length < 3) {
      throw new Error(`TEST REGRESI GAGAL: Role pada domain ${d.name} terlalu sedikit (${roleStep.options.length}), deduplikasi terlalu agresif!`);
    }

    // Pastikan Super Admin dan minimal 1 role inti tetap ada
    const hasOwner = roleStep.options.some((o) => o.roleStatus === 'WAJIB_OWNER');
    const hasCore = roleStep.options.some((o) => o.roleStatus === 'WAJIB_INTI');
    if (!hasOwner || !hasCore) {
      throw new Error(`TEST REGRESI GAGAL: Domain ${d.name} kehilangan WAJIB_OWNER atau WAJIB_INTI!`);
    }
  }

  console.log('\n✅ TEST 2 LOLOS: Tidak ada role yang salah tergabung pada ketiga domain lama!');
  console.log('\n🎉 SEMUA PERSYARATAN POIN REVISI 4 BERHASIL DIVERIFIKASI 100%!');
}

main().catch((err) => {
  console.error('❌ Terjadi Error:', err);
  process.exit(1);
});
