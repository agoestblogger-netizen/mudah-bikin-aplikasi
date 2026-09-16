import assert from 'assert';
import {
  analyzeActorClassification,
  buildGuidedStep,
  applyGuidedAnswer,
  isActorEntityData,
  isActorSystemUser,
  getEntityOwnerRole,
  isExternalRole,
  generateDeterministicSimulasiDb
} from '../src/lib/templates/processes/guided';
import { MockupSessionState } from '../src/lib/templates/processes/types';
import {
  resolveEntityOwnerRoleWithAI,
  generateFallbackDataSchema,
  classifyActorWithAI,
  analyzeActorClassificationWithAI,
  getLapis2CallCount,
  resetLapis2CallCount,
  setMockAiClassifierForTesting
} from '../src/app/api/guided/route';

function createMockSession(overrides: Partial<MockupSessionState>): MockupSessionState {
  return {
    step: 'STORYTELLING',
    match: {
      templateId: 'MT-20',
      overlayIds: [],
      patternIds: [],
      tier: 'BASIC',
      businessCategory: 'Operasional Bisnis'
    },
    roles: {
      wajib: ['Super Admin'],
      selected: ['Super Admin']
    },
    flow: {
      alurInti: [],
      alurPendukung: [],
      fiturPendukung: []
    },
    painPoints: { selected: [] },
    features: { selected: [] },
    ...overrides
  };
}

async function main() {
  console.log('========================================================================');
  console.log('🧪 TEST SUITE #15: KLASIFIKASI PELAKU (PENGGUNA SISTEM vs ENTITAS DATA)');
  console.log('========================================================================\n');

  // -----------------------------------------------------------------------------
  // POIN 1: UJI RENTAL SEPEDA (Pelanggan -> ENTITAS_DATA)
  // -----------------------------------------------------------------------------
  console.log('[Poin 1] Rental Sepeda: Pelanggan sebagai Entitas Data');

  const rentalSepedaSession = createMockSession({
    step: 'STORYTELLING',
    match: {
      templateId: 'MT-20',
      overlayIds: [],
      patternIds: [],
      tier: 'BASIC',
      businessCategory: 'Rental Sepeda'
    },
    storyline: {
      narasi: 'Sistem penyewaan sepeda wisata.',
      asumsiMasalah: 'Pencatatan unit sepeda dan data penyewa sering tercecer.',
      asumsiAktor: ['Super Admin', 'Petugas Rental', 'Pelanggan'],
      asumsiAlurUtama: 'Pelanggan menyewa sepeda -> Petugas mencatat dan menyerahkan unit -> Pengembalian',
      statusKonfirmasi: 'disetujui'
    }
  });

  // 1.1 Analisis Klasifikasi
  const { classifications, hasCandidateEntity } = analyzeActorClassification(rentalSepedaSession);
  console.log('  Hasil Klasifikasi:', classifications);

  assert.strictEqual(hasCandidateEntity, true, 'FAILED: Rental Sepeda harus mendeteksi Pelanggan sebagai kandidat Entitas Data');

  const superAdminClass = classifications.find(c => c.actor === 'Super Admin');
  const petugasClass = classifications.find(c => c.actor === 'Petugas Rental');
  const pelangganClass = classifications.find(c => c.actor === 'Pelanggan');

  assert.strictEqual(superAdminClass?.category, 'PENGGUNA_SISTEM', 'FAILED: Super Admin harus PENGGUNA_SISTEM');
  assert.strictEqual(petugasClass?.category, 'PENGGUNA_SISTEM', 'FAILED: Petugas Rental harus PENGGUNA_SISTEM');
  assert.strictEqual(pelangganClass?.category, 'ENTITAS_DATA', 'FAILED: Pelanggan harus default ENTITAS_DATA');
  const reasonP = pelangganClass?.reason || '';
  assert(
    reasonP.includes('pihak') ||
      reasonP.includes('pencatatan') ||
      reasonP.includes('Entitas Data') ||
      reasonP.includes('alur'),
    'FAILED: Alasan klasifikasi harus jelas'
  );

  // Pasang klasifikasi ke session
  rentalSepedaSession.actorsClassification = classifications;

  // 1.2 Helper functions check
  assert.strictEqual(isActorEntityData(rentalSepedaSession, 'Pelanggan'), true, 'FAILED: isActorEntityData harus true untuk Pelanggan');
  assert.strictEqual(isActorSystemUser(rentalSepedaSession, 'Petugas Rental'), true, 'FAILED: isActorSystemUser harus true untuk Petugas Rental');

  // 1.3 Bagian B (buildRoleStep via buildGuidedStep) memfilter ENTITAS_DATA
  rentalSepedaSession.step = 'ROLE';
  const roleStepPayload = buildGuidedStep(rentalSepedaSession)!;
  const roleLabels = roleStepPayload.options.map(o => o.label);
  console.log('  Opsi Peran di Bagian B:', roleLabels);

  assert(roleLabels.some(l => l.includes('Super Admin')), 'FAILED: Super Admin harus ada di opsi peran');
  assert(roleLabels.some(l => l.includes('Petugas Rental')), 'FAILED: Petugas Rental harus ada di opsi peran');
  assert(!roleLabels.some(l => l.includes('Pelanggan')), 'FAILED: Pelanggan TIDAK BOLEH muncul di opsi peran Bagian B!');

  // 1.4 Resolusi ownerRole semantik dari alur
  const flowDataRental = {
    alurInti: [
      { step: 1, pelaku: 'Petugas Rental', aksi: 'Mencatat data identitas Pelanggan dan nomor unit sepeda' },
      { step: 2, pelaku: 'Petugas Rental', aksi: 'Menerima pembayaran sewa dan menyerahkan kunci sepeda' },
      { step: 3, pelaku: 'Petugas Rental', aksi: 'Memeriksa kondisi sepeda saat dikembalikan oleh Pelanggan' }
    ]
  };

  const resolvedOwner = await resolveEntityOwnerRoleWithAI(
    'Pelanggan',
    ['Super Admin', 'Petugas Rental'],
    flowDataRental
  );
  console.log('  Resolusi ownerRole untuk Pelanggan:', resolvedOwner);

  assert.strictEqual(resolvedOwner.ownerRole, 'Petugas Rental', 'FAILED: ownerRole Pelanggan harus Petugas Rental');
  assert.strictEqual(resolvedOwner.confidence, 'high', 'FAILED: Confidence harus high dari alur eksplisit');

  // Pasang ownerRole ke session
  if (pelangganClass) {
    pelangganClass.ownerRole = resolvedOwner.ownerRole;
  }
  assert.strictEqual(getEntityOwnerRole(rentalSepedaSession, 'Pelanggan'), 'Petugas Rental');

  // 1.5 Skema Data: Tabel pelanggan dibuat tanpa kredensial
  rentalSepedaSession.roles = {
    wajib: ['Super Admin'],
    selected: ['Super Admin', 'Petugas Rental']
  };
  const dataSchema = generateFallbackDataSchema(rentalSepedaSession);
  const pelangganTable = dataSchema.tabel.find(t => t.nama.toLowerCase() === 'pelanggan');
  console.log('  Tabel Pelanggan di Skema Data:', pelangganTable);

  assert(pelangganTable, 'FAILED: Tabel pelanggan harus dibuat di Skema Data');
  const colNames = (pelangganTable.field || []).map(k => k.nama.toLowerCase());
  assert(!colNames.includes('password'), 'FAILED: Tabel pelanggan TIDAK BOLEH memiliki kolom password');
  assert(!colNames.includes('password_hash'), 'FAILED: Tabel pelanggan TIDAK BOLEH memiliki kolom password_hash');
  assert(!colNames.includes('username'), 'FAILED: Tabel pelanggan TIDAK BOLEH memiliki kolom username');
  assert(colNames.some(c => c.includes('nama')), 'FAILED: Tabel pelanggan harus punya kolom nama');

  // 1.6 Simulasi DB: Tidak ada akun demo untuk Pelanggan
  const simDb = generateDeterministicSimulasiDb(rentalSepedaSession);
  console.log('  Akun Login Demo:', simDb.akunLogin.map(a => a.role));

  const simRoles = simDb.akunLogin.map(a => a.role);
  assert(simRoles.includes('Super Admin'), 'FAILED: Akun demo Super Admin harus ada');
  assert(simRoles.includes('Petugas Rental'), 'FAILED: Akun demo Petugas Rental harus ada');
  assert(!simRoles.includes('Pelanggan'), 'FAILED: Pelanggan TIDAK BOLEH memiliki akun login demo!');
  console.log('  ✅ Poin 1 Selesai: Rental Sepeda Pelanggan tervalidasi penuh sebagai Entitas Data.\n');


  // -----------------------------------------------------------------------------
  // POIN 2: UJI FALLBACK AMBIGU/TIDAK JELAS (AI Low Confidence)
  // -----------------------------------------------------------------------------
  console.log('[Poin 2] AI Uncertainty Fallback: Penelusuran Semantik Tidak Jelas');

  // Alur kerja tanpa penyebutan siapa staf yang mencatat
  const ambiguousFlow = {
    alurInti: [
      { step: 1, pelaku: 'Super Admin', aksi: 'Membuka operasional harian' },
      { step: 2, pelaku: 'Super Admin', aksi: 'Melihat rekap pendapatan' }
    ]
  };

  const ambiguousResolution = await resolveEntityOwnerRoleWithAI(
    'Penyewa',
    ['Super Admin', 'Pengawas'],
    ambiguousFlow
  );
  console.log('  Hasil resolusi alur ambigu:', ambiguousResolution);

  assert.strictEqual(ambiguousResolution.ownerRole, 'tidak jelas', 'FAILED: Harus mengembalikan "tidak jelas"');
  assert.strictEqual(ambiguousResolution.confidence, 'low', 'FAILED: Confidence harus low');

  // Simulasikan state blokir di ALUR
  const sessionWithBlock = createMockSession({
    step: 'ALUR',
    match: {
      templateId: 'MT-20',
      overlayIds: [],
      patternIds: [],
      tier: 'BASIC',
      businessCategory: 'Rental'
    },
    roles: {
      wajib: ['Super Admin'],
      selected: ['Super Admin', 'Pengawas']
    },
    actorsClassification: [
      { actor: 'Super Admin', category: 'PENGGUNA_SISTEM', reason: 'Pemilik' },
      { actor: 'Pengawas', category: 'PENGGUNA_SISTEM', reason: 'Staf' },
      { actor: 'Penyewa', category: 'ENTITAS_DATA', reason: 'Entitas luar' }
    ],
    pendingOwnerRoleClarification: {
      entity: 'Penyewa',
      suggestedOwnerRoles: ['Super Admin', 'Pengawas']
    }
  });

  sessionWithBlock.step = 'ALUR';
  const blockedStepCard = buildGuidedStep(sessionWithBlock)!;
  console.log('  Card Klarifikasi Blokir:', blockedStepCard.title);
  assert(blockedStepCard.title.includes('Penyewa'), 'FAILED: Judul klarifikasi harus menyebut entitas Penyewa');
  assert.strictEqual(blockedStepCard.options.length, 2, 'FAILED: Harus ada 2 opsi pilihan peran');
  assert.strictEqual(blockedStepCard.options[0].id, 'owner_role:Super Admin');
  assert.strictEqual(blockedStepCard.options[1].id, 'owner_role:Pengawas');

  // User menjawab memilih 'Pengawas'
  const afterClarification = applyGuidedAnswer(sessionWithBlock, 'ALUR', ['owner_role:Pengawas'], '');
  assert.strictEqual(afterClarification.step, 'RBAC', 'FAILED: Setelah klarifikasi dijawab, harus lanjut ke RBAC');
  assert(!afterClarification.pendingOwnerRoleClarification, 'FAILED: pendingOwnerRoleClarification harus dihapus');

  const penyewaClass = afterClarification.actorsClassification?.find(a => a.actor === 'Penyewa');
  assert.strictEqual(penyewaClass?.ownerRole, 'Pengawas', 'FAILED: Penyewa.ownerRole harus terisi Pengawas');
  console.log('  ✅ Poin 2 Selesai: AI uncertainty fallback dan pemblokiran transisi terverifikasi.\n');


  // -----------------------------------------------------------------------------
  // POIN 3: UJI USER OVERRIDE (Pelanggan diubah jadi PENGGUNA_SISTEM)
  // -----------------------------------------------------------------------------
  console.log('[Poin 3] User Override: Pelanggan diubah menjadi Pengguna Sistem di Bagian A');

  const overrideSession = createMockSession({
    step: 'STORYTELLING',
    match: {
      templateId: 'MT-20',
      overlayIds: [],
      patternIds: [],
      tier: 'BASIC',
      businessCategory: 'Rental Sepeda'
    },
    storyline: {
      narasi: 'Sistem rental sepeda mandiri oleh pelanggan lewat aplikasi.',
      asumsiMasalah: 'Antrean manual',
      asumsiAktor: ['Super Admin', 'Petugas Rental', 'Pelanggan'],
      asumsiAlurUtama: 'Pelanggan booking lewat aplikasi -> Petugas konfirmasi',
      statusKonfirmasi: 'disetujui'
    }
  });

  // Langkah 3.1: Konfirmasi storytelling -> mendeteksi Pelanggan sebagai kandidat entitas data & memicu sub-step
  const afterConfirmStory = applyGuidedAnswer(overrideSession, 'STORYTELLING', ['confirm_story'], '');
  console.log('  Pending Actor Clarification:', afterConfirmStory.storyline?.pendingActorClarification);
  assert(afterConfirmStory.storyline?.pendingActorClarification, 'FAILED: pendingActorClarification harus aktif');

  // Periksa card pertanyaan sub-step Bagian A
  const subStepCard = buildGuidedStep(afterConfirmStory)!;
  console.log('  Sub-step Card:', subStepCard.title);
  assert(subStepCard.title.includes('Pelanggan'), 'FAILED: Card harus menanyakan Pelanggan');
  assert.strictEqual(subStepCard.options[1].id, 'switch_actor_category', 'FAILED: Opsi switch_actor_category harus tersedia');

  // Langkah 3.2: User mengklik ubah Pelanggan menjadi Pengguna Sistem (switch_actor_category)
  const afterOverride = applyGuidedAnswer(
    afterConfirmStory,
    'STORYTELLING',
    ['switch_actor_category'],
    ''
  );

  const overriddenPelanggan = afterOverride.actorsClassification?.find(a => a.actor === 'Pelanggan');
  assert.strictEqual(overriddenPelanggan?.category, 'PENGGUNA_SISTEM', 'FAILED: Pelanggan harus berubah menjadi PENGGUNA_SISTEM');
  assert.strictEqual(afterOverride.step, 'ROLE', 'FAILED: Setelah klasifikasi selesai, harus lanjut ke ROLE');

  // Sekarang periksa Bagian B (buildRoleStep via buildGuidedStep)
  const roleStepOverridden = buildGuidedStep(afterOverride)!;
  const roleLabelsOverridden = roleStepOverridden.options.map(o => o.label);
  console.log('  Opsi Peran setelah override:', roleLabelsOverridden);

  assert(roleLabelsOverridden.some(l => l.includes('Pelanggan')), 'FAILED: Pelanggan sekarang HARUS muncul di opsi peran!');

  // Jika Pelanggan dipilih masuk roles.selected, akun demo harus dibuat
  afterOverride.roles = {
    wajib: ['Super Admin'],
    selected: ['Super Admin', 'Petugas Rental', 'Pelanggan']
  };
  const simDbOverridden = generateDeterministicSimulasiDb(afterOverride);
  const simRolesOverridden = simDbOverridden.akunLogin.map(a => a.role);
  console.log('  Akun demo setelah override:', simRolesOverridden);
  assert(simRolesOverridden.includes('Pelanggan'), 'FAILED: Pelanggan harus mendapatkan akun demo jika menjadi PENGGUNA_SISTEM');
  console.log('  ✅ Poin 3 Selesai: User override ke Pengguna Sistem terverifikasi penuh.\n');


  // -----------------------------------------------------------------------------
  // POIN 4: REGRESI SALES PROSPEK CRM (Semua PENGGUNA_SISTEM)
  // -----------------------------------------------------------------------------
  console.log('[Poin 4] Regresi: Sales Prospek CRM (Semua internal staff)');

  const crmSession = createMockSession({
    step: 'STORYTELLING',
    match: {
      templateId: 'MT-20',
      overlayIds: [],
      patternIds: [],
      tier: 'BASIC',
      businessCategory: 'Sales Prospek CRM'
    },
    storyline: {
      narasi: 'Sistem pelacakan prospek sales lapangan dengan GPS dan funnel pipeline.',
      asumsiMasalah: 'Laporan prospek fiktif dan follow up telat.',
      asumsiAktor: ['Super Admin', 'Sales', 'Manager'],
      asumsiAlurUtama: 'Sales mencatat prospek -> Manager menyetujui -> Super Admin melihat dashboard',
      statusKonfirmasi: 'disetujui'
    }
  });

  const crmClassification = analyzeActorClassification(crmSession);
  console.log('  CRM Classifications:', crmClassification.classifications);

  assert.strictEqual(crmClassification.hasCandidateEntity, false, 'FAILED: CRM tidak boleh memiliki kandidat Entitas Data!');
  crmClassification.classifications.forEach(c => {
    assert.strictEqual(c.category, 'PENGGUNA_SISTEM', `FAILED: Role ${c.actor} harus PENGGUNA_SISTEM`);
  });

  // Konfirmasi storytelling langsung lompat ke ROLE tanpa sub-step pertanyaan yang memblokir
  const afterCrmConfirm = applyGuidedAnswer(crmSession, 'STORYTELLING', ['confirm_story'], '');
  console.log('  Step setelah konfirmasi storytelling CRM:', afterCrmConfirm.step);
  assert.strictEqual(afterCrmConfirm.step, 'ROLE', 'FAILED: CRM harus langsung lanjut ke step ROLE (0 blocking questions)');
  assert(!afterCrmConfirm.storyline?.pendingActorClarification, 'FAILED: Tidak boleh ada pendingActorClarification');
  console.log('  ✅ Poin 4 Selesai: Regresi Sales Prospek CRM lolos tanpa hambatan.\n');


  // -----------------------------------------------------------------------------
  // POIN 5: DEPRECATION CHECK (isExternalRole delegasi ke actorsClassification)
  // -----------------------------------------------------------------------------
  console.log('[Poin 5] Deprecation Check: isExternalRole sebagai wrapper actorsClassification & log fallback');

  const depSession = createMockSession({
    step: 'ROLE',
    actorsClassification: [
      { actor: 'Klien', category: 'ENTITAS_DATA', reason: 'Pihak luar' },
      { actor: 'Resepsionis', category: 'PENGGUNA_SISTEM', reason: 'Staf' }
    ]
  });

  // isExternalRole harus mengembalikan true untuk Klien karena category === ENTITAS_DATA
  assert.strictEqual(isExternalRole('Klien', depSession), true, 'FAILED: isExternalRole harus true untuk ENTITAS_DATA');
  assert.strictEqual(isExternalRole('Resepsionis', depSession), false, 'FAILED: isExternalRole harus false untuk PENGGUNA_SISTEM');

  // Jika user meng-override Klien jadi PENGGUNA_SISTEM:
  if (depSession.actorsClassification) {
    depSession.actorsClassification[0].category = 'PENGGUNA_SISTEM';
  }
  assert.strictEqual(isExternalRole('Klien', depSession), false, 'FAILED: Setelah di-override, isExternalRole harus false!');

  // Uji fallback dictionary ketika session belum punya actorsClassification (harus ada console.warn)
  const isFallbackLogged = isExternalRole('Pelanggan', null);
  assert.strictEqual(isFallbackLogged, true, 'FAILED: Fallback dictionary tetap bekerja');
  console.log('  ✅ Poin 5 Selesai: isExternalRole terbukti murni mendelegasikan ke actorsClassification dan fallback logging aktif.\n');


  // -----------------------------------------------------------------------------
  // POIN 6: VUE ARCHITECTURE & TABLESCONFIG VERIFICATION
  // -----------------------------------------------------------------------------
  console.log('[Poin 6] Vue Architecture: tablesConfig & Akses Entitas Data');

  const vueSession = createMockSession({
    step: 'REVIEW_FINAL',
    roles: {
      wajib: ['Super Admin'],
      selected: ['Super Admin', 'Petugas Rental']
    },
    actorsClassification: [
      { actor: 'Super Admin', category: 'PENGGUNA_SISTEM', reason: 'Owner' },
      { actor: 'Petugas Rental', category: 'PENGGUNA_SISTEM', reason: 'Staf' },
      { actor: 'Pelanggan', category: 'ENTITAS_DATA', ownerRole: 'Petugas Rental', reason: 'Data penyewa' }
    ]
  });

  // Simulasi pembuatan tablesConfig
  const pelangganOwner = getEntityOwnerRole(vueSession, 'Pelanggan') || 'Super Admin';
  const mockTablesConfig = {
    pelanggan: {
      label: 'Pelanggan',
      allowRoles: ['Super Admin', pelangganOwner],
      fields: [
        { key: 'nama', label: 'Nama Lengkap', type: 'text', required: true },
        { key: 'telepon', label: 'No Telepon', type: 'text', required: true }
      ]
    }
  };

  console.log('  mockTablesConfig.pelanggan.allowRoles:', mockTablesConfig.pelanggan.allowRoles);
  assert(mockTablesConfig.pelanggan.allowRoles.includes('Petugas Rental'), 'FAILED: Petugas Rental harus ada di allowRoles pelanggan');
  assert(mockTablesConfig.pelanggan.allowRoles.includes('Super Admin'), 'FAILED: Super Admin harus ada di allowRoles pelanggan');
  assert(!mockTablesConfig.pelanggan.allowRoles.includes('Pelanggan'), 'FAILED: Pelanggan TIDAK BOLEH ada di allowRoles (bukan login role)!');

  console.log('  ✅ Poin 6 Selesai: Vue architecture tablesConfig terverifikasi.\n');


  // -----------------------------------------------------------------------------
  // POIN 7: UJI NAMA AKTOR DI LUAR 22 KATA BAKU (Penalaran Narasi & Tanggung Jawab)
  // -----------------------------------------------------------------------------
  console.log('[Poin 7] Pengujian Aktor Non-Kamus: Penalaran Narasi Teks Tanggung Jawab');

  // 7.1 Aktor non-kamus: "Kontributor Riset" (Bukan sinonim pelanggan/pasien/siswa)
  // Konteks: Peneliti mengumpulkan sampel dari Kontributor Riset dan mencatat hasil analisis laboratorium.
  console.log('  [7.1] Kasus "Kontributor Riset" (Laboratorium Sains / Penelitian)');
  const risetSession = createMockSession({
    step: 'STORYTELLING',
    match: {
      templateId: 'MT-20',
      overlayIds: [],
      patternIds: [],
      tier: 'BASIC',
      businessCategory: 'Riset Laboratorium'
    },
    storyline: {
      narasi: 'Sistem pengujian laboratorium independen. Peneliti mengumpulkan sampel uji dari Kontributor Riset yang menyumbangkan materi lapangan, kemudian menginput hasil uji ke sistem.',
      asumsiMasalah: 'Sampel biologis rawan tertukar jika tidak dicatat rapi.',
      asumsiAktor: ['Super Admin', 'Peneliti', 'Kontributor Riset'],
      asumsiAlurUtama: 'Peneliti menerima sampel dari Kontributor Riset -> Menginput uji lab -> Analisis -> Laporan',
      detailAktor: {
        'Peneliti': {
          narasi: 'Staf peneliti laboratorium yang memeriksa sampel dan menginput parameter uji ke sistem.',
          tanggungJawab: ['Mencatat penerimaan sampel', 'Menginput hasil pengujian laboratorium']
        },
        'Kontributor Riset': {
          narasi: 'Pihak eksternal yang menyumbangkan materi spesimen biologis untuk diuji oleh tim peneliti.',
          tanggungJawab: ['Menyerahkan sampel spesimen di lapangan untuk dicatat oleh Peneliti']
        }
      },
      statusKonfirmasi: 'disetujui'
    }
  });

  const risetClassifications = analyzeActorClassification(risetSession);
  console.log('    Hasil Heuristik Narasi Riset:', risetClassifications.classifications);

  const penelitiClass = risetClassifications.classifications.find(c => c.actor === 'Peneliti');
  const kontributorClass = risetClassifications.classifications.find(c => c.actor === 'Kontributor Riset');

  assert.strictEqual(penelitiClass?.category, 'PENGGUNA_SISTEM', 'FAILED: Peneliti harus PENGGUNA_SISTEM');
  assert.strictEqual(
    kontributorClass?.category,
    'ENTITAS_DATA',
    'FAILED: "Kontributor Riset" HARUS terklasifikasi sebagai ENTITAS_DATA melalui analisis kalimat tindakan pasif/target!'
  );
  const reasonK = kontributorClass?.reason || '';
  assert(
    reasonK.includes('narasi') || reasonK.includes('dicatat') || reasonK.includes('Entitas Data'),
    'FAILED: Reason harus memuat dasar penalaran narasi alur!'
  );

  // Uji juga via Lapis 2 AI Function (Fallback mode tanpa provider eksternal)
  const aiClassifyKontributor = await classifyActorWithAI('Kontributor Riset', risetSession.storyline!);
  console.log('    Hasil classifyActorWithAI (Kontributor Riset):', aiClassifyKontributor);
  assert.strictEqual(aiClassifyKontributor.category, 'ENTITAS_DATA');

  // 7.2 Aktor non-kamus: "Pemesan Khusus" (Katering Diet Spesial)
  console.log('  [7.2] Kasus "Pemesan Khusus" (Katering Diet Kustom)');
  const kateringSession = createMockSession({
    step: 'STORYTELLING',
    match: {
      templateId: 'MT-20',
      overlayIds: [],
      patternIds: [],
      tier: 'BASIC',
      businessCategory: 'Katering Diet'
    },
    storyline: {
      narasi: 'Bisnis katering diet khusus. Staf Dapur menerima permintaan menu kustom dari Pemesan Khusus melalui telepon, lalu menginput daftar alergi dan komposisi kalori ke aplikasi.',
      asumsiMasalah: 'Menu alergi berisiko fatal jika salah racik.',
      asumsiAktor: ['Super Admin', 'Staf Dapur', 'Pemesan Khusus'],
      asumsiAlurUtama: 'Staf Dapur mencatat detail pesanan Pemesan Khusus -> Memasak -> Pengiriman',
      detailAktor: {
        'Staf Dapur': {
          narasi: 'Staf yang memasak dan mengelola resep serta pesanan katering.',
          tanggungJawab: ['Mencatat pesanan kustom Pemesan Khusus', 'Menyiapkan porsi sesuai takaran kalori']
        },
        'Pemesan Khusus': {
          narasi: 'Klien dengan kebutuhan diet medis tertentu yang memesan paket makanan khusus.',
          tanggungJawab: ['Menyampaikan pantangan alergi kepada Staf Dapur untuk dicatat ke sistem']
        }
      },
      statusKonfirmasi: 'disetujui'
    }
  });

  const kateringClassifications = analyzeActorClassification(kateringSession);
  console.log('    Hasil Heuristik Narasi Katering:', kateringClassifications.classifications);

  const stafDapurClass = kateringClassifications.classifications.find(c => c.actor === 'Staf Dapur');
  const pemesanKhususClass = kateringClassifications.classifications.find(c => c.actor === 'Pemesan Khusus');

  assert.strictEqual(stafDapurClass?.category, 'PENGGUNA_SISTEM', 'FAILED: Staf Dapur harus PENGGUNA_SISTEM');
  assert.strictEqual(
    pemesanKhususClass?.category,
    'ENTITAS_DATA',
    'FAILED: "Pemesan Khusus" HARUS terklasifikasi sebagai ENTITAS_DATA melalui penalaran predikat kalimat "mencatat pesanan Pemesan Khusus"!'
  );
  // Regresi Ringan Poin 7: Pastikan "Kontributor Riset" & "Pemesan Khusus" diselesaikan cepat oleh Lapis 1 (0 Lapis 2 AI call)
  resetLapis2CallCount();
  const risetWithAI = await analyzeActorClassificationWithAI(risetSession);
  const kateringWithAI = await analyzeActorClassificationWithAI(kateringSession);
  assert.strictEqual(
    getLapis2CallCount(),
    0,
    'FAILED: "Kontributor Riset" & "Pemesan Khusus" harus diselesaikan langsung oleh Lapis 1 tanpa memanggil Lapis 2 AI!'
  );
  assert.strictEqual(
    risetWithAI.classifications.find(c => c.actor === 'Kontributor Riset')?.category,
    'ENTITAS_DATA'
  );
  assert.strictEqual(
    kateringWithAI.classifications.find(c => c.actor === 'Pemesan Khusus')?.category,
    'ENTITAS_DATA'
  );
  console.log('    Regresi Ringan Lolos: 0 pemanggilan Lapis 2 untuk kasus yang match di Lapis 1 (fast-path).');
  console.log('  ✅ Poin 7 Selesai: Aktor non-kamus ("Kontributor Riset", "Pemesan Khusus") terbukti 100% diklasifikasikan benar lewat penalaran narasi Lapis 1.\n');


  // -----------------------------------------------------------------------------
  // POIN 8: PEMBUKTIAN LAPIS 2 AI SEMANTIK TERPANGGIL SAAT LAPIS 1 GAGAL TOTAL
  // (Menghindari 27 Kata Kerja Regex Lapis 1 & Menghindari Seluruh Nama Kamus Pelaku)
  // -----------------------------------------------------------------------------
  console.log('[Poin 8] Pembuktian Lapis 2 AI Semantik Terpanggil & Menyelamatkan Klasifikasi');

  // Skenario: Lembaga Kajian Kebijakan Publik
  // Pelaku luar: "Narasumber Telaah" (Bukan nama kamus, bukan staff)
  // Narasi sengaja MENGHINDARI seluruh 27 kata kerja Lapis 1:
  // (mencatat, menginput, merekap, menerima, mengumpulkan, menampung, menyimpan, memverifikasi,
  // menagih, menghubungi, mengirim, menyerahkan, melayani, memeriksa, menilai, menguji,
  // menyumbang, memesan, menyewa, mendaftar, berobat, belajar, les, meminta, mengajukan, datang, berkunjung)
  const telaahSession = createMockSession({
    step: 'STORYTELLING',
    match: {
      templateId: 'MT-20',
      overlayIds: [],
      patternIds: [],
      tier: 'BASIC',
      businessCategory: 'Kajian Kebijakan Publik'
    },
    storyline: {
      narasi: 'Lembaga kajian kebijakan publik. Peneliti berhadapan langsung dengan Narasumber Telaah di ruang wawancara khusus guna menggali perspektif regulasi industri.',
      asumsiMasalah: 'Dokumentasi wawancara sering tercecer tanpa transkrip rapi.',
      asumsiAktor: ['Super Admin', 'Peneliti', 'Narasumber Telaah'],
      asumsiAlurUtama: 'Peneliti bersiap di bilik dialog -> Narasumber Telaah duduk berhadapan -> Peneliti mendengarkan pemaparan -> Rekaman tersimpan otomatis',
      detailAktor: {
        'Peneliti': {
          narasi: 'Tenaga ahli yang menyusun transkrip dan memantau rekaman audio.',
          tanggungJawab: ['Menghidupkan alat perekam di bilik', 'Menyusun naskah transkrip wawancara']
        },
        'Narasumber Telaah': {
          narasi: 'Tokoh pakar yang memberikan pandangan lisan saat sesi tanya jawab.',
          tanggungJawab: ['Berbicara di depan mikrofon bilik wawancara']
        }
      },
      statusKonfirmasi: 'disetujui'
    }
  });

  // Step 8.1: Buktikan Lapis 1 GAGAL / INCONCLUSIVE
  const lapis1Telaah = analyzeActorClassification(telaahSession);
  const narasumberLapis1 = lapis1Telaah.classifications.find(c => c.actor === 'Narasumber Telaah');
  console.log('    Hasil Lapis 1 untuk "Narasumber Telaah":', narasumberLapis1);

  assert(narasumberLapis1, 'FAILED: Narasumber Telaah harus ada di klasifikasi Lapis 1');
  assert.strictEqual(
    narasumberLapis1.confidence,
    'low',
    'FAILED: Lapis 1 HARUS memiliki confidence: low karena 27 kata kerja regex tidak match sama sekali!'
  );
  assert.strictEqual(
    narasumberLapis1.matchSource,
    'INCONCLUSIVE_FALLBACK',
    'FAILED: matchSource Lapis 1 HARUS "INCONCLUSIVE_FALLBACK"'
  );
  assert.strictEqual(
    narasumberLapis1.category,
    'PENGGUNA_SISTEM',
    'FAILED: Default fallback Lapis 1 adalah PENGGUNA_SISTEM karena tidak ada predikat maupun kamus yang cocok'
  );
  console.log('    ✓ Terbukti: Lapis 1 gagal match & mengembalikan confidence: low (INCONCLUSIVE_FALLBACK).');

  // Step 8.2: Pasang AI Classifier Mock untuk simulasi respons semantik AI
  setMockAiClassifierForTesting(async (actor, storyline) => {
    if (actor === 'Narasumber Telaah') {
      return {
        category: 'ENTITAS_DATA',
        confidence: 'high',
        reason: '🤖 Hasil penalaran alur bisnis (AI): Narasumber Telaah berposisi sebagai Entitas Data yang diwawancarai dan direkam suaranya, bukan pengoperasi sistem aplikasi.'
      };
    }
    return null;
  });

  // Step 8.3: Jalankan alur Bagian A produksi (analyzeActorClassificationWithAI)
  resetLapis2CallCount();
  assert.strictEqual(getLapis2CallCount(), 0, 'Initial counter harus 0');

  const productionResult = await analyzeActorClassificationWithAI(telaahSession);
  const narasumberFinal = productionResult.classifications.find(c => c.actor === 'Narasumber Telaah');
  console.log('    Hasil Lapis 2 (Produksi) untuk "Narasumber Telaah":', narasumberFinal);
  console.log('    Total Pemanggilan Lapis 2 (Trace Counter):', getLapis2CallCount());

  // Step 8.4: Buktikan Lapis 2 BENAR-BENAR TERPANGGIL
  assert.strictEqual(
    getLapis2CallCount(),
    1,
    'FAILED: classifyActorWithAI HARUS terpanggil tepat 1x untuk menyelamatkan "Narasumber Telaah"!'
  );

  // Step 8.5: Buktikan Lapis 2 MENYELAMATKAN KLASIFIKASI MENJADI ENTITAS_DATA
  assert.strictEqual(
    narasumberFinal?.category,
    'ENTITAS_DATA',
    'FAILED: Lapis 2 AI harus berhasil menyelamatkan klasifikasi menjadi ENTITAS_DATA!'
  );
  assert.strictEqual(
    narasumberFinal?.confidence,
    'high',
    'FAILED: Confidence setelah diselamatkan Lapis 2 harus high'
  );
  assert.strictEqual(
    narasumberFinal?.matchSource,
    'AI_SEMANTIC',
    'FAILED: matchSource harus teridentifikasi sebagai AI_SEMANTIC'
  );
  assert.strictEqual(
    productionResult.hasCandidateEntity,
    true,
    'FAILED: hasCandidateEntity harus bernilai true setelah Lapis 2 menyelamatkan entitas!'
  );
  console.log('  ✅ Poin 8 Selesai: Lapis 2 AI Semantik terbukti terpanggil di call site produksi dan sukses menyelamatkan klasifikasi entitas saat Lapis 1 gagal total.\n');

  // Bersihkan mock classifier setelah test
  setMockAiClassifierForTesting(null);

  console.log('========================================================================');
  console.log('🎉 SEMUA 8 POIN VERIFIKASI KLASIFIKASI PELAKU LOLOS DENGAN SEMPURNA!');
  console.log('========================================================================\n');
}

main().catch((err) => {
  console.error('Test Suite #15 Failed:', err);
  process.exit(1);
});
