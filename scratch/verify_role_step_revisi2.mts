import { buildGuidedStep } from '../src/lib/templates/processes/guided';
import { generateStorylineWithAI } from '../src/app/api/guided/route';
import type { MockupSessionState } from '../src/lib/templates/processes/types';

async function testRoleRevisi2() {
  console.log('================================================================');
  console.log('VERIFIKASI POIN REVISI 2: PENGHAPUSAN FALLBACK KATALOG PADA STEP ROLE');
  console.log('================================================================\n');

  // ============================================================================
  // TEST 1: Skenario Cuci Mobil Persis (Verifikasi Pemilik/Operator/Viewer Hilang)
  // ============================================================================
  console.log('--- [TEST 1] CUCI MOBIL ---');
  const cuciMobilNarasi = 'pelanggan datang atau pesen dulu lewat aplikasi, lalu tim di garis depan menyambut dengan senyum dan langsung gerak cepat kerjakan cucian mobilnya. Sementara kamu sebagai pemilik bisa tenang memantau berapa order yang masuk hari ini dan berapa omzetnya...';
  
  // Simulasi session dengan aktor konkret dari cerita cuci mobil
  const sessionCuciMobil: MockupSessionState = {
    step: 'ROLE',
    match: {
      templateId: 'MT-20', // MT-20 dulu menyuntikkan Owner, Admin, Operator, Viewer
      overlayIds: [],
      patternIds: ['UP-06', 'UP-09'],
      tier: 'STARTER',
      businessCategory: 'Jasa Cuci Kendaraan',
      contextualPainPoints: [],
      contextualRoles: []
    },
    storyline: {
      narasi: cuciMobilNarasi,
      asumsiMasalah: 'Pengelolaan antrean dan pencatatan kasir',
      asumsiAktor: ['Super Admin', 'Petugas Cuci', 'Kasir', 'Pelanggan'],
      asumsiAlurUtama: 'Mobil masuk -> Petugas cuci mencuci -> Kasir terima bayar',
      statusKonfirmasi: 'disetujui',
      revisiCount: 0
    },
    roles: { selected: [] },
    flow: {},
    painPoints: { selected: [] },
    features: { selected: [] }
  };

  const roleStepCuci = buildGuidedStep(sessionCuciMobil);
  console.log('Daftar Role yang tampil di Step ROLE untuk Cuci Mobil:');
  console.table(
    roleStepCuci.options.map((opt) => ({
      ID: opt.id,
      Label: opt.label,
      Status: opt.roleStatus,
      Locked: opt.locked ? 'Ya' : 'Tidak',
      Recommended: opt.recommended ? 'Ya' : 'Tidak',
      NarasiSingkat: opt.description.slice(0, 60) + '...'
    }))
  );

  // Verifikasi Cuci Mobil
  const cuciRoleIds = roleStepCuci.options.map((o) => o.id);
  const cuciLabels = roleStepCuci.options.map((o) => o.label.toLowerCase());

  if (cuciLabels.includes('pemilik') || cuciRoleIds.includes('Pemilik')) {
    throw new Error('TEST 1 GAGAL: Role "Pemilik" masih muncul terpisah dari Super Admin!');
  }
  if (cuciLabels.includes('operator') || cuciRoleIds.includes('Operator')) {
    throw new Error('TEST 1 GAGAL: Role "Operator" dari katalog masih disuntikkan!');
  }
  if (cuciLabels.includes('viewer') || cuciRoleIds.includes('Viewer')) {
    throw new Error('TEST 1 GAGAL: Role "Viewer" dari katalog masih disuntikkan!');
  }
  const hasPetugasCuci = cuciLabels.some((l) => l.includes('cuci'));
  if (!hasPetugasCuci) {
    throw new Error('TEST 1 GAGAL: "Petugas Cuci" hilang!');
  }

  console.log('✅ TEST 1 LOLOS: Pemilik, Operator, dan Viewer 100% hilang. Petugas Cuci tetap ada!\n');

  // ============================================================================
  // TEST 2: Domain Baru dengan Ambiguitas (Rental Mobil: Penyewa vs Member)
  // ============================================================================
  console.log('--- [TEST 2] RENTAL MOBIL (AMBIGUITAS PENYEWA VS MEMBER) ---');
  const rentalPrompt = 'buatkan aplikasi rental mobil lepas kunci dan dengan sopir';
  console.log(`Menguji prompt: "${rentalPrompt}"...`);
  
  const storylineRental = await generateStorylineWithAI(rentalPrompt);
  console.log(`-> Kategori: ${storylineRental.businessCategory}`);
  console.log(`-> Aktor dari Storyline AI: ${storylineRental.asumsiAktor.join(', ')}`);
  console.log(`-> Narasi: ${storylineRental.narasi}`);

  const sessionRental: MockupSessionState = {
    step: 'ROLE',
    match: {
      templateId: 'MT-20',
      overlayIds: [],
      patternIds: ['UP-06', 'UP-09'],
      tier: 'STARTER',
      businessCategory: storylineRental.businessCategory,
      contextualPainPoints: [],
      contextualRoles: []
    },
    storyline: {
      narasi: storylineRental.narasi,
      asumsiMasalah: storylineRental.asumsiMasalah,
      asumsiAktor: [...storylineRental.asumsiAktor, 'Member', 'Pemilik'], // Disengaja menyuntikkan duplikat sinonim
      asumsiAlurUtama: storylineRental.asumsiAlurUtama,
      statusKonfirmasi: 'disetujui',
      revisiCount: 0
    },
    roles: { selected: [] },
    flow: {},
    painPoints: { selected: [] },
    features: { selected: [] }
  };

  const roleStepRental = buildGuidedStep(sessionRental);
  console.log('\nDaftar Role yang tampil di Step ROLE untuk Rental Mobil:');
  console.table(
    roleStepRental.options.map((opt) => ({
      ID: opt.id,
      Label: opt.label,
      Status: opt.roleStatus,
      Locked: opt.locked ? 'Ya' : 'Tidak',
      Recommended: opt.recommended ? 'Ya' : 'Tidak',
      NarasiSingkat: opt.description.slice(0, 60) + '...'
    }))
  );

  const rentalRoleIds = roleStepRental.options.map((o) => o.id);
  const rentalLabels = roleStepRental.options.map((o) => o.label.toLowerCase());

  if (rentalLabels.includes('pemilik') || rentalRoleIds.includes('Pemilik')) {
    throw new Error('TEST 2 GAGAL: "Pemilik" masih muncul terpisah dari Super Admin!');
  }
  const customerCount = rentalLabels.filter((l) => l.includes('penyewa') || l.includes('member') || l.includes('pelanggan')).length;
  if (customerCount > 1) {
    throw new Error(`TEST 2 GAGAL: Terjadi duplikasi peran pelanggan/penyewa/member (${customerCount} entri)!`);
  }
  if (rentalLabels.includes('operator') || rentalLabels.includes('viewer')) {
    throw new Error('TEST 2 GAGAL: Operator atau Viewer muncul di rental mobil!');
  }

  console.log('✅ TEST 2 LOLOS: Tidak ada duplikasi sinonim peran (Penyewa vs Member tersatukan, Pemilik tersatukan ke Super Admin, katalog generik bersih)!\n');
  console.log('🎉 SEMUA VERIFIKASI POIN REVISI 2 BERHASIL 100%!');
}

testRoleRevisi2().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
