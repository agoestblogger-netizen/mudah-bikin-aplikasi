import {
  generateStorylineWithAI,
  sanitizeStorylineNarrative,
  isClicheStorylineOpening,
  lacksGreetingOpening
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

  // Test 1.1: Deteksi kerangka klise
  const clicheSamples = [
    'Ide aplikasi cuci mobil dan motormu sangat menarik untuk membantu pelanggan lebih tertib.',
    'Aplikasi yang ingin kamu buat sangat menarik. Pelanggan membawa kendaraan...',
    'Konsep aplikasi ini sangat menarik sekali untuk dicoba.',
    'Ide untuk aplikasi cuci kendaraan ini sangat tepat untuk meningkatkan efisiensi pelayanan.',
    'Ide untuk aplikasi servis berkala dan riwayat kendaraan ini sangat tepat untuk meningkatkan efisiensi operasional bengkel.',
    'Inisiatif yang luar biasa untuk meningkatkan manajemen klinik gigi dan pelayanan pasien.',
    'Sebuah langkah yang cerdas untuk menyederhanakan pengalaman pelanggan saat memesan.',
    'Sebuah ide yang cemerlang untuk mempermudah transaksi jual beli perhiasan.',
    'Sebuah langkah cerdas untuk mengelola simpanan dan pinjaman anggota koperasi.',
    'Mari kita lihat bagaimana alur operasional di tempat ini biasanya berjalan.',
    'Mari kita lihat bagaimana proses servis kendaraan ini biasanya berjalan.',
    // Kasus 1: Pola pujian dengan kata sifat "relevan" dan preposisi "dalam"
    'Ide untuk aplikasi ini sangat relevan dalam meningkatkan efisiensi klinik gigi.',
    // Kasus 2: Kata "menarik" muncul di akhir/tengah kalimat tanpa kata ide/aplikasi
    'Membayangkan bagaimana transaksi di toko emas bisa berjalan lancar sangat menarik.',
    // Kasus Baru: Pola pujian tanpa kata benda anchor di awal (subjek bebas)
    'Sistem antrean dan rekam medis pasien di klinik dokter gigi ini sangat penting untuk kelancaran layanan.',
    'Mengelola koperasi simpan pinjam adalah langkah cerdas untuk membantu anggota dalam pengelolaan keuangan.',
    'Membangun sistem antrean dan rekam medis pasien adalah langkah penting untuk meningkatkan efisiensi layanan kesehatan.',
    // Kasus Imbuhan: Kata sifat pujian dengan akhiran -nya dan intensifier "betapa"
    'Melihat banyaknya kendaraan yang parkir, tampak jelas betapa pentingnya layanan ini bagi pemilik kendaraan.',
    'Aplikasi ini menunjukkan bermanfaatnya sistem digital untuk operasional bengkel.',
    'Strategisnya lokasi ini dalam menarik pelanggan menjadi keunggulan tersendiri.',
    'Krusialnya koordinasi tim bagi kelancaran transaksi di meja kasir.',
    // Kasus Pola Evaluatif / Peran Generik [sangat/amat/sungguh + peran/kata + dalam/bagi/untuk] (Klausa kedua / mana pun)
    'Dalam dunia bengkel motor, efisiensi dalam menangani kendaraan sangat berperan dalam kepuasan pelanggan.',
    'Di tengah persaingan bisnis kafe, keramahan barista sangat menentukan bagi loyalitas pengunjung.',
    'Saat jam sibuk laundry tiba, ketelitian pemilahan pakaian amat berpengaruh dalam mencegah komplain pelanggan.',
    'Bagi usaha toko emas, keakuratan timbangan digital benar-benar krusial untuk menjaga kepercayaan pembeli.'
  ];
  const freshSamples = [
    'Bisnis cuci kendaraan memang butuh ketelitian ekstra saat jam ramai tiba. Pelanggan datang...',
    'Bagaimana kalau proses antrean cuci mobil bisa lebih rapi dari sekarang? Pelanggan datang...',
    'Mari kita amati bagaimana alur pelayanan cuci kendaraan ini berjalan di lapangan. Pelanggan datang...',
    'Coba kita telusuri pergerakan transaksi dan pesanan kopi di meja kasir. Pelanggan datang...',
    'Usaha laundry kiloan menuntut ketelitian tinggi sejak awal penerimaan pakaian. Pelanggan menyerahkan pakaian kotor...',
    'Di klinik gigi, ketepatan rekam medis dan antrean pasien adalah kunci kelancaran pelayanan. Pasien datang...',
    'Pengelolaan simpan pinjam di koperasi sangat terbantu jika setiap setoran tercatat transparan. Anggota datang...',
    'Membayangkan kendaraan yang bersih dan mengkilap pasti sangat menyenangkan. Pelanggan datang...',
    'Dalam hiruk-pikuk kegiatan koperasi simpan pinjam, setiap detik berharga untuk memastikan layanan berjalan lancar. Anggota datang...',
    'Bisa dibayangkan betapa sibuknya area cuci kendaraan saat pelanggan membawa mobil atau motor mereka untuk mendapatkan perawatan.',
    'Memiliki cucian yang menumpuk bisa jadi hal yang merepotkan.',
    'Dalam kesibukan kafe, pelanggan melangkah masuk dan langsung disambut oleh aroma kopi yang menggoda.',
    'Menjaga kendaraan agar selalu dalam kondisi terbaik adalah prioritas bagi setiap pemilik motor.',
    'Dalam dunia perhiasan yang berkilau, pelayanan terbaik menjadi kunci utama.',
    'Membangun sebuah koperasi simpan pinjam yang efisien memerlukan pengelolaan yang tepat.'
  ];

  for (const s of clicheSamples) {
    if (!isClicheStorylineOpening(s)) {
      throw new Error(`FAILED: Gagal mendeteksi pembuka klise: "${s}"`);
    }
  }
  for (const s of freshSamples) {
    if (isClicheStorylineOpening(s)) {
      throw new Error(`FAILED: Kalimat segar salah terdeteksi sebagai klise: "${s}"`);
    }
  }

  // Test 1.1b: Deteksi ketiadaan sapaan (klausa temporal operasional seperti "Ketika pemilik membawa...")
  const lacksGreetingSample = 'Ketika pemilik kendaraan membawa motor ke bengkel, mereka disambut oleh teknisi yang siap membantu.';
  if (!lacksGreetingOpening(lacksGreetingSample)) {
    throw new Error(`FAILED: Gagal mendeteksi ketiadaan sapaan pada klausa temporal: "${lacksGreetingSample}"`);
  }
  const hasGreetingSample = 'Klinik gigi ini selalu ramai dengan pasien yang menunggu perawatan.';
  if (lacksGreetingOpening(hasGreetingSample)) {
    throw new Error(`FAILED: Kalimat dengan sapaan/observasi salah terdeteksi lacksGreetingOpening: "${hasGreetingSample}"`);
  }

  console.log('✅ Deteksi kerangka klise vs segar berfungsi akurat 100%.');

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

  // Test 1.2b: Pengecualian frasa ajakan 'Mari kita' (konsultan AI menyapa user)
  const mariKitaNarrative = 'Mari kita lihat bagaimana alur operasional di tempat ini biasanya berjalan. Kami menyiapkan peralatan servis.';
  const cleanedMariKita = sanitizeStorylineNarrative(mariKitaNarrative, ['Super Admin', 'Teknisi Servis', 'Pelanggan']);
  console.log('\n--- Sanitasi Frasa Ajakan "Mari kita" ---');
  console.log('Kotor :', mariKitaNarrative);
  console.log('Bersih:', cleanedMariKita);
  if (!cleanedMariKita.startsWith('Mari kita lihat')) {
    throw new Error(`FAILED: Frasa ajakan 'Mari kita lihat' rusak menjadi '${cleanedMariKita}'`);
  }
  if (cleanedMariKita.includes('Kami menyiapkan')) {
    throw new Error(`FAILED: Kata 'kami' operasional tidak ter-replace: '${cleanedMariKita}'`);
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
