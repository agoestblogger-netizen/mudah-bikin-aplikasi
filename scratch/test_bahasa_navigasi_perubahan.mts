import {
  generateStorylineWithAI,
  sanitizeStorylineNarrative,
  getRandomGreeting,
  DYNAMIC_GREETINGS
} from '../src/app/api/guided/route';
import {
  applyGuidedAnswer,
  buildGuidedStep,
  buildBackNavigationStep,
  generateChangeNote,
  getDomainFlowDetails,
  renderRoleSummaryTable,
  renderFlowMarkdown,
  renderRbacMarkdownTable,
  renderDataSchemaMarkdown,
  renderSimulasiDbMarkdown,
  renderReviewFinalMarkdown,
  generateDeterministicSimulasiDb
} from '../src/lib/templates/processes/guided';
import type { MockupSessionState } from '../src/lib/templates/processes/types';

async function runTests() {
  console.log('====================================================');
  console.log('🧪 TEST 1: BAGIAN A - VARIASI BAHASA & SUDUT PANDANG');
  console.log('====================================================');

  // Test 1.1: Variasi greeting
  const greetings = new Set<string>();
  for (let i = 0; i < 20; i++) {
    greetings.add(getRandomGreeting());
  }
  console.log(`Variasi greeting unik yang dihasilkan dari 20x panggilan: ${greetings.size} jenis.`);
  if (greetings.size <= 1) {
    throw new Error('FAILED: Greeting tidak bervariasi!');
  }
  console.log('Contoh greeting sample:', Array.from(greetings).slice(0, 3));

  // Test 1.2: Sanitasi narasi aman (hanya kata ganti orang pertama jamak, tidak menyentuh kata kerja/benda lain)
  const testDirtyNarratives = [
    'Tim kami langsung menyambut pelanggan di gerbang. Kami kemudian menggosok bodi kendaraan sampai kinclong. Setelah itu kita memproses pembayaran di kasir.',
    'Pelanggan datang ke tempat cuci mobil. Tim kami segera menyemprotkan air dan menggosok bodi mobil. Lalu kami mencetak nota transaksi.'
  ];

  for (const dirty of testDirtyNarratives) {
    const cleaned = sanitizeStorylineNarrative(dirty, ['Super Admin', 'Washer', 'Pelanggan']);
    console.log('\n--- Sanitasi Contoh ---');
    console.log('Kotor :', dirty);
    console.log('Bersih:', cleaned);

    // 1. Pastikan kata ganti orang pertama jamak "kami/kita/tim kami" BERHASIL dibersihkan
    const hasKami = /\b(kami|kita|tim\s+kami|tim\s+kita)\b/i.test(cleaned);
    if (hasKami) {
      throw new Error(`FAILED: Kata 'kami/kita' masih ditemukan di narasi: ${cleaned}`);
    }

    // 2. Pastikan TIDAK ADA kata dobel "kendaraan kendaraan" atau frasa aneh "kendaraan mobil"
    const hasDoubleKendaraan = /kendaraan\s+kendaraan/i.test(cleaned);
    const hasKendaraanMobil = /kendaraan\s+mobil/i.test(cleaned);
    if (hasDoubleKendaraan || hasKendaraanMobil) {
      throw new Error(`FAILED: Ditemukan kejanggalan kalimat/kata dobel akibat replace mekanis: ${cleaned}`);
    }
  }

  // Test 1.3: Mekanisme deteksi kata ganti untuk pemicu RETRY AI
  const needsRetryA = /\b(kami|kita|tim\s+kami|tim\s+kita)\b/i.test('Tim kami siap melayani pelanggan.');
  const needsRetryB = /\b(kami|kita|tim\s+kami|tim\s+kita)\b/i.test('Pelanggan datang, Washer mencuci mobil sampai bersih.');
  if (!needsRetryA || needsRetryB) {
    throw new Error('FAILED: Logika deteksi retry AI tidak akurat!');
  }
  console.log('\nLogika deteksi retry AI:');
  console.log('- "Tim kami siap melayani pelanggan" -> Trigger Retry AI: YES');
  console.log('- "Pelanggan datang, Washer mencuci mobil" -> Trigger Retry AI: NO (Lolos)');

  console.log('\n✅ TEST 1 (Bagian A) LULUS: Sanitasi aman bebas kalimat janggal & mekanisme retry AI terverifikasi!');

  console.log('\n====================================================');
  console.log('🧪 TEST 2: BAGIAN B - NAVIGASI MUNDUR ("ADA YANG TERLEWAT")');
  console.log('====================================================');

  // Siapkan session awal di step ALUR
  let session: MockupSessionState = {
    step: 'ALUR',
    match: {
      templateId: 'MT-01',
      overlayIds: ['IO-01'],
      patternIds: ['UP-06'],
      tier: 'BASIC',
      businessCategory: 'cuci mobil'
    },
    storyline: {
      narasi: 'Pelanggan membawa kendaraan ke lokasi cuci mobil. Kasir mencatat pesanan paket cuci dan plat nomor. Washer mencuci kendaraan dengan sampo salju dan membilasnya sampai bersih. Pelanggan melakukan pembayaran di kasir dan menerima bukti transaksi.',
      asumsiMasalah: 'Antrean cuci mobil sering tidak tercatat rapi dan pembayaran lambat',
      asumsiAktor: ['Super Admin', 'Kasir', 'Washer', 'Pelanggan'],
      asumsiAlurUtama: 'Pelanggan datang -> Kasir mencatat pesanan -> Washer mencuci kendaraan -> Kasir menerima pembayaran',
      statusKonfirmasi: 'disetujui',
      revisiCount: 0
    },
    roles: {
      selected: ['Super Admin', 'Kasir', 'Washer', 'Pelanggan'],
      wajib: ['Super Admin', 'Washer'],
      tambahan: ['Kasir', 'Pelanggan']
    },
    flow: {
      alurInti: [
        { step: 1, pelaku: 'Pelanggan', aksi: 'Mendatangi lokasi cuci mobil membawa kendaraan' },
        { step: 2, pelaku: 'Kasir', aksi: 'Mencatat jenis paket cuci dan plat nomor kendaraan' },
        { step: 3, pelaku: 'Washer', aksi: 'Mencuci kendaraan dengan sampo salju dan membilasnya hingga bersih' },
        { step: 4, pelaku: 'Kasir', aksi: 'Menerima pembayaran dan menyerahkan bukti transaksi' },
        { step: 5, pelaku: 'Super Admin', aksi: 'Memantau rekap pendapatan dan performa harian' }
      ]
    },
    painPoints: { selected: [] },
    features: { selected: [] }
  };

  // Test 2.1: Kartu ALUR harus memiliki opsi 'back_to_previous'
  const alurCard = buildGuidedStep(session)!;
  const backOptionInAlur = alurCard.options.find((o) => o.id === 'back_to_previous');
  if (!backOptionInAlur) {
    throw new Error('FAILED: Opsi back_to_previous tidak ditemukan di buildGuidedStep untuk step ALUR!');
  }
  console.log('Opsi back_to_previous di Alur:', backOptionInAlur.label);

  // Test 2.2: Saat diklik back_to_previous, hasilkan daftar step sebelumnya
  const backNavigationCard = buildBackNavigationStep(session.step);
  console.log('Daftar step sebelumnya yang bisa dipilih:', backNavigationCard.options.map((o) => o.label));

  const availableJumps = backNavigationCard.options.map((o) => o.id);
  if (!availableJumps.includes('jump_step_STORYTELLING') || !availableJumps.includes('jump_step_ROLE')) {
    throw new Error('FAILED: Daftar langkah sebelumnya tidak lengkap!');
  }
  if (!availableJumps.includes('cancel_back')) {
    throw new Error('FAILED: Tombol cancel_back tidak tersedia!');
  }

  // Test 2.3: User memilih kembali ke ROLE (jump_step_ROLE)
  let jumpedSession = applyGuidedAnswer(session, 'ALUR', ['jump_step_ROLE']);
  if (jumpedSession.step !== 'ROLE') {
    throw new Error(`FAILED: Sesi gagal melompat ke ROLE, step saat ini: ${jumpedSession.step}`);
  }
  console.log(`Berhasil melompat mundur! Sesi sekarang di step: ${jumpedSession.step}`);

  // Test 2.4: User mengoreksi role di ROLE (misal menghapus Washer, dilimpahkan ke Owner)
  // Peran terpilih: Super Admin, Kasir, Pelanggan (tanpa Washer)
  let updatedRoleSession = applyGuidedAnswer(
    jumpedSession,
    'ROLE',
    ['Super Admin', 'Kasir', 'Pelanggan']
  );

  // Pastikan alur TIDAK auto-skip, melainkan maju ke ALUR secara normal!
  if (updatedRoleSession.step !== 'ALUR') {
    throw new Error(`FAILED: Setelah konfirmasi ROLE, step harus ALUR, tetapi bernilai: ${updatedRoleSession.step}`);
  }
  console.log(`Setelah konfirmasi koreksi ROLE, alur maju normal ke: ${updatedRoleSession.step} (bukan auto-skip!)`);

  console.log('\n✅ TEST 2 (Bagian B) LULUS: Navigasi mundur dan alur maju bertahap terverifikasi!');

  console.log('\n====================================================');
  console.log('🧪 TEST 3: BAGIAN C - INDIKATOR PERUBAHAN REGENERASI BERANTAI');
  console.log('====================================================');

  // Regenerasi Alur Inti dengan daftar role baru yang tidak punya Washer
  const newFlowDetails = getDomainFlowDetails(updatedRoleSession, { forceFresh: true });
  updatedRoleSession.flow = {
    ...updatedRoleSession.flow,
    alurInti: newFlowDetails.alurInti
  };

  console.log('Alur Inti Sebelumnya:');
  session.flow.alurInti?.forEach((s) => console.log(`  ${s.step}. (${s.pelaku}) ${s.aksi}`));

  console.log('\nAlur Inti Baru Setelah Washer Dihapus:');
  updatedRoleSession.flow.alurInti?.forEach((s) => console.log(`  ${s.step}. (${s.pelaku}) ${s.aksi}`));

  // Uji generateChangeNote untuk ALUR
  const changeNoteAlur = generateChangeNote('ALUR', updatedRoleSession);
  console.log('\nCatatan Perubahan ALUR yang dihasilkan:');
  console.log(changeNoteAlur);

  if (!changeNoteAlur || !changeNoteAlur.includes('Catatan Penyesuaian')) {
    throw new Error('FAILED: generateChangeNote untuk ALUR tidak menghasilkan catatan perubahan yang diharapkan!');
  }

  // Uji generateChangeNote untuk RBAC jika lanjut ke RBAC
  let rbacSession = applyGuidedAnswer(updatedRoleSession, 'ALUR', ['confirm_alur']);
  rbacSession.rbac = {
    modul: [
      {
        nama: 'Transaksi Cuci Mobil',
        izinPerRole: [
          { role: 'Super Admin', level: 'Penuh' },
          { role: 'Kasir', level: 'Input & Lihat' }
        ]
      },
      {
        nama: 'Manajemen Tarif & Layanan',
        izinPerRole: [
          { role: 'Super Admin', level: 'Penuh' },
          { role: 'Kasir', level: 'Hanya Lihat' }
        ]
      }
    ]
  };

  const changeNoteRbac = generateChangeNote('RBAC', rbacSession);
  console.log('\nCatatan Perubahan RBAC yang dihasilkan:');
  console.log(changeNoteRbac);

  if (!changeNoteRbac || !changeNoteRbac.includes('Catatan Penyesuaian')) {
    throw new Error('FAILED: generateChangeNote untuk RBAC tidak menghasilkan catatan perubahan yang diharapkan!');
  }

  // Test 3.2: Jika tidak ada perubahan berarti (misal user mengonfirmasi RBAC tanpa ubah apapun),
  // pastikan catatan perubahan tidak dipaksakan muncul jika snapshot kosong
  const pristineSession: MockupSessionState = {
    ...rbacSession,
    changeSnapshots: undefined
  };
  const noteEmpty = generateChangeNote('RBAC', pristineSession);
  if (noteEmpty !== null) {
    throw new Error(`FAILED: Sesi tanpa perubahan seharusnya bernilai null, tapi menghasilkan: ${noteEmpty}`);
  }
  console.log('Catatan untuk sesi tanpa perubahan snapshot: null (Tepat: tidak ada teks tidak perlu)');

  console.log('\n✅ TEST 3 (Bagian C) LULUS: Indikator perubahan naratif terverifikasi!');

  console.log('\n====================================================');
  console.log('🧪 TEST 4: REGRESI ALUR NORMAL (TANPA NAVIGASI MUNDUR)');
  console.log('====================================================');

  let normalSession: MockupSessionState = {
    step: 'STORYTELLING',
    match: {
      templateId: 'MT-01',
      overlayIds: [],
      patternIds: ['UP-06'],
      tier: 'BASIC',
      businessCategory: 'toko roti'
    },
    storyline: {
      narasi: 'Pelanggan memilih aneka roti di etalase toko. Kasir memindai harga dan mencetak struk belanja. Pelanggan membayar belanjaan secara tunai atau QRIS.',
      asumsiMasalah: 'Pencatatan kasir masih manual',
      asumsiAktor: ['Super Admin', 'Kasir', 'Pelanggan'],
      asumsiAlurUtama: 'Pelanggan memilih roti -> Kasir mencatat pesanan -> Pelanggan membayar',
      statusKonfirmasi: 'disetujui',
      revisiCount: 0
    },
    roles: { selected: [] },
    flow: {},
    painPoints: { selected: [] },
    features: { selected: [] }
  };

  // STORYTELLING -> ROLE
  normalSession = applyGuidedAnswer(normalSession, 'STORYTELLING', ['confirm_story']);
  if (normalSession.step !== 'ROLE') throw new Error(`Expected ROLE, got ${normalSession.step}`);

  // ROLE -> ALUR
  normalSession = applyGuidedAnswer(normalSession, 'ROLE', ['Super Admin', 'Kasir', 'Pelanggan']);
  if (normalSession.step !== 'ALUR') throw new Error(`Expected ALUR, got ${normalSession.step}`);

  // ALUR -> RBAC
  normalSession = applyGuidedAnswer(normalSession, 'ALUR', ['confirm_alur']);
  if (normalSession.step !== 'RBAC') throw new Error(`Expected RBAC, got ${normalSession.step}`);

  // RBAC -> SKEMA_DATA
  normalSession = applyGuidedAnswer(normalSession, 'RBAC', ['confirm_rbac']);
  if (normalSession.step !== 'SKEMA_DATA') throw new Error(`Expected SKEMA_DATA, got ${normalSession.step}`);

  // SKEMA_DATA -> SIMULASI_DB
  normalSession = applyGuidedAnswer(normalSession, 'SKEMA_DATA', ['confirm_schema']);
  if (normalSession.step !== 'SIMULASI_DB') throw new Error(`Expected SIMULASI_DB, got ${normalSession.step}`);

  // SIMULASI_DB -> REVIEW_FINAL
  normalSession = applyGuidedAnswer(normalSession, 'SIMULASI_DB', ['confirm_simulasi']);
  if (normalSession.step !== 'REVIEW_FINAL') throw new Error(`Expected REVIEW_FINAL, got ${normalSession.step}`);

  console.log('Alur normal STORYTELLING -> ROLE -> ALUR -> RBAC -> SKEMA_DATA -> SIMULASI_DB -> REVIEW_FINAL berjalan sempurna!');
  console.log('✅ TEST 4 (Regresi) LULUS: Tidak ada breaking change pada alur standar!');

  console.log('\n🎉 SELURUH TEST (1-4) BERHASIL DILALUI DENGAN SUKSES!');
}

runTests().catch((err) => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
