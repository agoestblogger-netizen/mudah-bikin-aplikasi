/**
 * Test Suite: Fitur Pertanyaan Variasi Produk/Layanan
 */

import { applyGuidedAnswer, buildGuidedStep, compileBriefFromSession } from '../src/lib/templates/processes/guided';
import type { MockupSessionState } from '../src/lib/templates/processes/types';

function makeKursusSession(overrides: Partial<MockupSessionState['storyline']> = {}): MockupSessionState {
  return {
    step: 'STORYTELLING',
    match: {
      templateId: 'JASA_KURSUS',
      overlayIds: [],
      patternIds: ['UP-06'],
      tier: 'ADVANCE',
      businessCategory: 'Jasa Kursus / Pelatihan',
      contextualRoles: ['Super Admin', 'Instruktur', 'Siswa'],
    },
    roles: { selected: ['Super Admin', 'Instruktur'] },
    flow: {},
    painPoints: { selected: [] },
    features: { selected: [] },
    actorsClassification: [
      { actor: 'Super Admin', category: 'PENGGUNA_SISTEM' },
      { actor: 'Instruktur', category: 'PENGGUNA_SISTEM' },
      { actor: 'Siswa', category: 'ENTITAS_DATA', ownerRole: 'Instruktur' }
    ],
    storyline: {
      narasi: 'Platform kursus menyetir mobil yang mengelola instruktur dan siswa dengan berbagai paket kursus.',
      asumsiMasalah: 'Pendaftaran siswa masih manual',
      asumsiAktor: ['Super Admin', 'Instruktur', 'Siswa'],
      asumsiAlurUtama: 'Siswa mendaftar kursus, memilih instruktur, dan mengikuti sesi latihan mengemudi.',
      statusKonfirmasi: 'disetujui',
      revisiCount: 0,
      riwayatKoreksi: [],
      ...overrides
    }
  };
}

function makeBengkelSession(): MockupSessionState {
  return {
    step: 'STORYTELLING',
    match: {
      templateId: 'BENGKEL_MOTOR',
      overlayIds: [],
      patternIds: ['UP-01'],
      tier: 'BASIC',
      businessCategory: 'Servis Kendaraan',
      contextualRoles: ['Super Admin', 'Mekanik'],
    },
    roles: { selected: ['Super Admin', 'Mekanik'] },
    flow: {},
    painPoints: { selected: [] },
    features: { selected: [] },
    actorsClassification: [
      { actor: 'Super Admin', category: 'PENGGUNA_SISTEM' },
      { actor: 'Mekanik', category: 'PENGGUNA_SISTEM' },
    ],
    storyline: {
      narasi: 'Bengkel motor yang mencatat servis kendaraan pelanggan secara manual.',
      asumsiMasalah: 'Pencatatan servis masih di buku tulis',
      asumsiAktor: ['Super Admin', 'Mekanik'],
      asumsiAlurUtama: 'Pelanggan datang, mekanik mengecek motor, mencatat keluhan, dan mengerjakan servis langsung di tempat.',
      statusKonfirmasi: 'disetujui',
      revisiCount: 0,
      riwayatKoreksi: [],
    }
  };
}

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`  ❌ ${name}`);
    console.log(`     ${e.message}`);
    failed++;
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`ASSERT FAILED: ${msg}`);
}

function assertEqual<T>(actual: T, expected: T, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected "${String(expected)}" but got "${String(actual)}"`);
  }
}

console.log('\n== [1] Pertanyaan variasi muncul setelah isConfirm ==');

test('Konfirmasi kursus → pendingProductVariantQuestion aktif', () => {
  const session = makeKursusSession();
  const result = applyGuidedAnswer(session, 'STORYTELLING', ['confirm_story'], undefined);
  assertEqual(result.step, 'STORYTELLING', 'step');
  assert(result.storyline?.pendingProductVariantQuestion !== undefined, 'pendingProductVariantQuestion harus ada');
});

test('Kartu variasi memiliki opsi variant_single dan variant_multiple', () => {
  const session = makeKursusSession({ pendingProductVariantQuestion: { entityLabel: 'kursus' } });
  const payload = buildGuidedStep(session);
  const ids = payload!.options.map(o => o.id);
  assert(ids.includes('variant_single'), 'harus ada opsi variant_single');
  assert(ids.includes('variant_multiple'), 'harus ada opsi variant_multiple');
});

test('Judul kartu variasi menyebut entityLabel kursus', () => {
  const session = makeKursusSession({ pendingProductVariantQuestion: { entityLabel: 'kursus' } });
  const payload = buildGuidedStep(session);
  assert(payload!.title.toLowerCase().includes('kursus'), `judul harus menyebut "kursus", dapat: "${payload!.title}"`);
});

console.log('\n== [2] variant_single → DOMAIN_PROFILE, narasi tidak berubah ==');

test('variant_single → step DOMAIN_PROFILE', () => {
  const session = makeKursusSession({ pendingProductVariantQuestion: { entityLabel: 'kursus' } });
  const result = applyGuidedAnswer(session, 'STORYTELLING', ['variant_single'], undefined);
  assertEqual(result.step, 'DOMAIN_PROFILE', 'step harus DOMAIN_PROFILE');
});

test('variant_single → narasi tidak di-append', () => {
  const originalNarasi = 'Platform kursus menyetir mobil yang mengelola instruktur dan siswa dengan berbagai paket kursus.';
  const session = makeKursusSession({ pendingProductVariantQuestion: { entityLabel: 'kursus' } });
  const result = applyGuidedAnswer(session, 'STORYTELLING', ['variant_single'], undefined);
  assertEqual(result.storyline!.narasi, originalNarasi, 'narasi tidak boleh berubah');
  assert(result.storyline?.pendingProductVariantQuestion === undefined, 'pendingProductVariantQuestion harus dihapus');
});

console.log('\n== [3] variant_multiple → append note ke narasi ==');

test('variant_multiple tanpa nama varian → append [Variasi Produk:...]', () => {
  const session = makeKursusSession({ pendingProductVariantQuestion: { entityLabel: 'kursus' } });
  const result = applyGuidedAnswer(session, 'STORYTELLING', ['variant_multiple'], undefined);
  assertEqual(result.step, 'DOMAIN_PROFILE', 'step harus DOMAIN_PROFILE');
  assert(result.storyline!.narasi.includes('[Variasi Produk:'), `narasi harus mengandung "[Variasi Produk:", dapat: "${result.storyline!.narasi.substring(0, 150)}"`);
});

test('variant_multiple dengan nama varian → contoh varian muncul di narasi', () => {
  const session = makeKursusSession({ pendingProductVariantQuestion: { entityLabel: 'kursus' } });
  const result = applyGuidedAnswer(session, 'STORYTELLING', ['variant_multiple'], 'Paket Basic, Paket Advanced');
  assert(result.storyline!.narasi.includes('Paket Basic'), 'narasi harus menyebut "Paket Basic"');
  assert(result.storyline!.narasi.includes('Paket Advanced'), 'narasi harus menyebut "Paket Advanced"');
});

test('variant_multiple → pendingProductVariantQuestion dihapus', () => {
  const session = makeKursusSession({ pendingProductVariantQuestion: { entityLabel: 'kursus' } });
  const result = applyGuidedAnswer(session, 'STORYTELLING', ['variant_multiple'], undefined);
  assert(result.storyline?.pendingProductVariantQuestion === undefined, 'pendingProductVariantQuestion harus dihapus');
});

console.log('\n== [4] Skip bisnis transaksi tunggal (bengkel) ==');

test('Bengkel → konfirmasi langsung ke DOMAIN_PROFILE tanpa pertanyaan variasi', () => {
  const session = makeBengkelSession();
  const result = applyGuidedAnswer(session, 'STORYTELLING', ['confirm_story'], undefined);
  assertEqual(result.step, 'DOMAIN_PROFILE', `bengkel harus langsung ke DOMAIN_PROFILE, step=${result.step}, pending=${JSON.stringify(result.storyline?.pendingProductVariantQuestion)}`);
});

console.log('\n== [5] Skip jika narasi sudah ada penanda variasi ==');

test('Narasi dengan [Variasi Produk:...] → skip pertanyaan', () => {
  const session = makeKursusSession({
    narasi: 'Platform kursus menyetir. [Variasi Produk: Bisnis ini menawarkan beberapa varian kursus. Pelanggan dapat memilih dari beberapa opsi yang tersedia.]'
  });
  const result = applyGuidedAnswer(session, 'STORYTELLING', ['confirm_story'], undefined);
  assertEqual(result.step, 'DOMAIN_PROFILE', 'sudah ada penanda variasi → harus langsung ke DOMAIN_PROFILE');
  assert(result.storyline?.pendingProductVariantQuestion === undefined, 'pendingProductVariantQuestion tidak boleh di-set ulang');
});

console.log('\n== [6] Urutan Sub-step: Variasi Produk DULU, baru Klasifikasi Aktor ==');

test('Pelatihan Kuliner: setelah confirm_story, muncul Variasi Produk DULU (bukan Siswa langsung)', () => {
  const kulinerSession: MockupSessionState = {
    step: 'STORYTELLING',
    match: {
      templateId: 'KULINER_01',
      overlayIds: [],
      patternIds: [],
      tier: 'ADVANCE',
      businessCategory: 'Pelatihan Kuliner',
      contextualRoles: ['Super Admin', 'Instruktur', 'Siswa'],
    },
    roles: { selected: [] },
    flow: {},
    painPoints: { selected: [] },
    features: { selected: [] },
    storyline: {
      narasi: 'Pelatihan kuliner membuat roti yang mengelola instruktur dan siswa.',
      asumsiMasalah: 'Pendaftaran manual',
      asumsiAktor: ['Super Admin', 'Instruktur', 'Siswa'],
      asumsiAlurUtama: 'Siswa mendaftar pelatihan, mengikuti kelas praktik, dan instruktur mencatat nilai.',
      statusKonfirmasi: 'disetujui',
      revisiCount: 0,
      riwayatKoreksi: [],
    }
  };

  // 1. Konfirmasi storytelling
  const afterConfirm = applyGuidedAnswer(kulinerSession, 'STORYTELLING', ['confirm_story'], undefined);
  assertEqual(afterConfirm.step, 'STORYTELLING', 'step harus tetap STORYTELLING');
  assert(
    afterConfirm.storyline?.pendingProductVariantQuestion !== undefined,
    'Harus ada pendingProductVariantQuestion SEBELUM klasifikasi aktor!'
  );
  assert(
    afterConfirm.storyline?.pendingActorClarification === undefined,
    'pendingActorClarification BELUM boleh muncul sekarang (harus setelah variasi terjawab)'
  );

  // 2. User menjawab: Ada beberapa varian (Roti Tawar, Roti Gandum, Dasar Roti)
  const afterVariant = applyGuidedAnswer(
    afterConfirm,
    'STORYTELLING',
    ['variant_multiple'],
    'Roti Tawar, Roti Gandum, Dasar Roti'
  );
  assertEqual(afterVariant.step, 'STORYTELLING', 'step harus tetap STORYTELLING untuk klasifikasi Siswa');
  assert(
    afterVariant.storyline?.pendingActorClarification !== undefined,
    'Setelah variasi dijawab, BARU muncul pendingActorClarification untuk Siswa!'
  );
  const targetActor = afterVariant.storyline?.pendingActorClarification?.actors[0]?.actor;
  assertEqual(targetActor, 'Siswa', 'Aktor yang diklarifikasi harus Siswa');

  // 3. Verifikasi narasi memuat ketiga varian roti
  assert(afterVariant.storyline!.narasi.includes('Roti Tawar'), 'narasi memuat Roti Tawar');
  assert(afterVariant.storyline!.narasi.includes('Roti Gandum'), 'narasi memuat Roti Gandum');
  assert(afterVariant.storyline!.narasi.includes('Dasar Roti'), 'narasi memuat Dasar Roti');

  // 4. User mengonfirmasi peran Siswa sebagai Entitas Data
  const afterActor = applyGuidedAnswer(
    afterVariant,
    'STORYTELLING',
    ['confirm_actor_recommendation'],
    undefined
  );
  assertEqual(afterActor.step, 'DOMAIN_PROFILE', 'Setelah klasifikasi Siswa selesai, langsung lanjut ke DOMAIN_PROFILE');
});

console.log('\n== [7] Simulasi DB: Nama varian user dipakai sebagai nilai katalog ==');

test('generateDeterministicSimulasiDb memakai nama varian user di tabel katalog', () => {
  const sessionWithVariants: MockupSessionState = {
    step: 'SIMULASI_DB',
    match: {
      templateId: 'KULINER_01',
      overlayIds: [],
      patternIds: [],
      tier: 'ADVANCE',
      businessCategory: 'Pelatihan Kuliner',
    },
    roles: { selected: ['Super Admin', 'Instruktur'] },
    flow: {},
    painPoints: { selected: [] },
    features: { selected: [] },
    actorsClassification: [
      { actor: 'Super Admin', category: 'PENGGUNA_SISTEM' },
      { actor: 'Instruktur', category: 'PENGGUNA_SISTEM' },
      { actor: 'Siswa', category: 'ENTITAS_DATA', ownerRole: 'Instruktur' }
    ],
    storyline: {
      narasi: 'Pelatihan kuliner membuat roti. [Variasi Produk: Bisnis ini menawarkan beberapa varian pelatihan (contoh varian: Roti Tawar, Roti Gandum, Dasar Roti). Pelanggan dapat memilih dari beberapa opsi yang tersedia.]',
      asumsiMasalah: 'Pendaftaran manual',
      asumsiAktor: ['Super Admin', 'Instruktur', 'Siswa'],
      asumsiAlurUtama: 'Siswa mendaftar',
      statusKonfirmasi: 'disetujui'
    },
    dataSchema: {
      tabel: [
        {
          nama: 'paket_pelatihan',
          keterangan: 'Katalog varian pelatihan roti',
          field: [
            { nama: 'id', tipe: 'teks', keterangan: 'ID paket' },
            { nama: 'nama_paket', tipe: 'teks', keterangan: 'Nama varian paket pelatihan' },
            { nama: 'biaya', tipe: 'angka', keterangan: 'Biaya kursus' },
            { nama: 'deskripsi', tipe: 'teks', keterangan: 'Silabus' }
          ]
        },
        {
          nama: 'siswa',
          keterangan: 'Data peserta kursus',
          field: [
            { nama: 'id', tipe: 'teks', keterangan: 'ID siswa' },
            { nama: 'nama', tipe: 'teks', keterangan: 'Nama lengkap' }
          ]
        }
      ]
    }
  };

  const { generateDeterministicSimulasiDb } = require('../src/lib/templates/processes/guided');
  const simDb = generateDeterministicSimulasiDb(sessionWithVariants);
  assert(simDb !== null, 'simDb tidak boleh null');
  const paketTable = simDb.contohData.tabel.find((t: any) => t.nama === 'paket_pelatihan');
  assert(paketTable !== undefined, 'tabel paket_pelatihan harus ada di simulasi');

  const rows = paketTable.baris;
  const namaPakets = rows.map((r: any) => r.nama_paket);
  console.log('  Data Simulasi Katalog Paket Pelatihan:', namaPakets);

  assert(namaPakets.includes('Roti Tawar'), 'Harus ada "Roti Tawar" di data simulasi katalog');
  assert(namaPakets.includes('Roti Gandum'), 'Harus ada "Roti Gandum" di data simulasi katalog');
  assert(namaPakets.includes('Dasar Roti'), 'Harus ada "Dasar Roti" di data simulasi katalog');
});

console.log('\n== [8] Skip pertanyaan untuk internal operational (CRM) ==');

test('Sales Prospek CRM → langsung ke ROLE tanpa pertanyaan variasi', () => {
  const crmSession: MockupSessionState = {
    step: 'STORYTELLING',
    match: {
      templateId: 'MT-20',
      overlayIds: [],
      patternIds: [],
      tier: 'BASIC',
      businessCategory: 'Sales Prospek CRM'
    },
    roles: { selected: [] },
    flow: {},
    painPoints: { selected: [] },
    features: { selected: [] },
    storyline: {
      narasi: 'Sistem pelacakan prospek sales lapangan dengan GPS dan funnel pipeline.',
      asumsiMasalah: 'Laporan prospek fiktif',
      asumsiAktor: ['Super Admin', 'Sales', 'Manager'],
      asumsiAlurUtama: 'Sales mencatat prospek -> Manager menyetujui -> Super Admin melihat dashboard',
      statusKonfirmasi: 'disetujui'
    }
  };

  const result = applyGuidedAnswer(crmSession, 'STORYTELLING', ['confirm_story'], undefined);
  assertEqual(result.step, 'DOMAIN_PROFILE', 'CRM harus langsung ke DOMAIN_PROFILE');
  assert(result.storyline?.pendingProductVariantQuestion === undefined, 'tidak ada variasi untuk CRM');
});

console.log('\n== [9] Poin 1 — shouldAskProductVariant: domain DI LUAR daftar lama tetap ditanya ==');

test('Studio Tato → MENERIMA pertanyaan variasi (bukan dalam skiplist transaksional)', () => {
  const tatoSession: MockupSessionState = {
    step: 'STORYTELLING',
    match: {
      templateId: 'STUDIO_TATO',
      overlayIds: [],
      patternIds: [],
      tier: 'BASIC',
      businessCategory: 'Studio Tato'
    },
    roles: { selected: ['Super Admin', 'Artist'] },
    flow: {},
    painPoints: { selected: [] },
    features: { selected: [] },
    storyline: {
      narasi: 'Studio tato yang mengelola booking pelanggan dan portofolio artist.',
      asumsiMasalah: 'Booking masih via WhatsApp',
      asumsiAktor: ['Super Admin', 'Artist', 'Pelanggan'],
      asumsiAlurUtama: 'Pelanggan melihat portofolio, book jadwal, artist mengerjakan, admin catat pembayaran.',
      statusKonfirmasi: 'disetujui'
    }
  };

  const result = applyGuidedAnswer(tatoSession, 'STORYTELLING', ['confirm_story'], undefined);
  // Dengan refactor baru (tidak ada allowlist), studio tato HARUS ditanya variasi
  assert(
    result.storyline?.pendingProductVariantQuestion !== undefined,
    `Studio tato harus mendapat pertanyaan variasi — bisnis ini bisa punya tipe tato (mini, fullarm, custom). step=${result.step}`
  );
  assertEqual(result.step, 'STORYTELLING', 'step harus STORYTELLING (menunggu jawaban variasi)');
});

test('Bimbel Privat → MENERIMA pertanyaan variasi (bukan dalam skiplist)', () => {
  const bimbelSession: MockupSessionState = {
    step: 'STORYTELLING',
    match: {
      templateId: 'BIMBEL_PRIVAT',
      overlayIds: [],
      patternIds: [],
      tier: 'BASIC',
      businessCategory: 'Bimbel Privat'
    },
    roles: { selected: ['Super Admin', 'Tutor'] },
    flow: {},
    painPoints: { selected: [] },
    features: { selected: [] },
    storyline: {
      narasi: 'Bimbel privat matematika dan sains untuk siswa SD hingga SMA.',
      asumsiMasalah: 'Jadwal tutor masih manual',
      asumsiAktor: ['Super Admin', 'Tutor', 'Siswa'],
      asumsiAlurUtama: 'Siswa mendaftar, pilih mata pelajaran, tutor mengajar.',
      statusKonfirmasi: 'disetujui'
    }
  };

  const result = applyGuidedAnswer(bimbelSession, 'STORYTELLING', ['confirm_story'], undefined);
  assert(
    result.storyline?.pendingProductVariantQuestion !== undefined,
    `Bimbel privat harus mendapat pertanyaan variasi. step=${result.step}`
  );
});

test('Ternak Lele (domain tidak biasa) → MENERIMA pertanyaan variasi', () => {
  const ternakSession: MockupSessionState = {
    step: 'STORYTELLING',
    match: {
      templateId: 'TERNAK_LELE',
      overlayIds: [],
      patternIds: [],
      tier: 'BASIC',
      businessCategory: 'Budidaya Ikan Lele'
    },
    roles: { selected: ['Super Admin', 'Pekerja'] },
    flow: {},
    painPoints: { selected: [] },
    features: { selected: [] },
    storyline: {
      narasi: 'Usaha budidaya ikan lele dengan beberapa kolam dan pembeli grosir.',
      asumsiMasalah: 'Pencatatan panen manual',
      asumsiAktor: ['Super Admin', 'Pekerja', 'Pembeli'],
      asumsiAlurUtama: 'Pekerja catat panen, super admin input pembeli, kirim ke pembeli.',
      statusKonfirmasi: 'disetujui'
    }
  };

  const result = applyGuidedAnswer(ternakSession, 'STORYTELLING', ['confirm_story'], undefined);
  // Ternak lele tidak masuk skiplist transaksional atau operasional → HARUS ditanya
  assert(
    result.storyline?.pendingProductVariantQuestion !== undefined,
    `Ternak lele harus mendapat pertanyaan variasi (bisa ada varian: bibit, konsumsi, indukan). step=${result.step}`
  );
});

test('Warung Kelontong → SKIP pertanyaan variasi (masuk skiplist transaksional)', () => {
  const warungSession: MockupSessionState = {
    step: 'STORYTELLING',
    match: {
      templateId: 'WARUNG',
      overlayIds: [],
      patternIds: [],
      tier: 'BASIC',
      businessCategory: 'Toko Kelontong'
    },
    roles: { selected: ['Super Admin', 'Kasir'] },
    flow: {},
    painPoints: { selected: [] },
    features: { selected: [] },
    storyline: {
      narasi: 'Toko kelontong yang melayani pembelian eceran sehari-hari.',
      asumsiMasalah: 'Stok tidak tercatat',
      asumsiAktor: ['Super Admin', 'Kasir'],
      asumsiAlurUtama: 'Kasir catat penjualan, super admin cek stok.',
      statusKonfirmasi: 'disetujui'
    }
  };

  const result = applyGuidedAnswer(warungSession, 'STORYTELLING', ['confirm_story'], undefined);
  assert(
    result.storyline?.pendingProductVariantQuestion === undefined,
    'Toko kelontong harus SKIP pertanyaan variasi'
  );
  assertEqual(result.step, 'DOMAIN_PROFILE', 'harus langsung ke DOMAIN_PROFILE');
});

test('Laundry Kiloan → SKIP pertanyaan variasi (masuk skiplist transaksional)', () => {
  const laundrySession: MockupSessionState = {
    step: 'STORYTELLING',
    match: {
      templateId: 'LAUNDRY_KILOAN',
      overlayIds: [],
      patternIds: [],
      tier: 'BASIC',
      businessCategory: 'Laundry Kiloan'
    },
    roles: { selected: ['Super Admin', 'Petugas Laundry'] },
    flow: {},
    painPoints: { selected: [] },
    features: { selected: [] },
    storyline: {
      narasi: 'Laundry kiloan yang melayani cuci-setrika per kilogram untuk pelanggan sekitar.',
      asumsiMasalah: 'Nota masih ditulis tangan',
      asumsiAktor: ['Super Admin', 'Petugas Laundry', 'Pelanggan'],
      asumsiAlurUtama: 'Pelanggan antar cucian, petugas timbang dan catat, pelanggan ambil setelah selesai.',
      statusKonfirmasi: 'disetujui'
    }
  };

  const result = applyGuidedAnswer(laundrySession, 'STORYTELLING', ['confirm_story'], undefined);
  // Inti regresi Langkah 8b: pertanyaan VARIASI harus di-skip.
  assert(
    result.storyline?.pendingProductVariantQuestion === undefined,
    'Laundry kiloan harus SKIP pertanyaan variasi (transaksi sekali selesai, tanpa katalog varian)'
  );
  // Catatan: laundry TIDAK langsung ke ROLE karena "Pelanggan" adalah ENTITAS_DATA,
  // sehingga sub-step klarifikasi aktor tetap muncul setelah variasi di-skip.
  assert(
    result.storyline?.pendingActorClarification !== undefined,
    'Laundry harus lanjut ke klarifikasi aktor (Pelanggan = ENTITAS_DATA), bukan pertanyaan variasi'
  );
  assertEqual(result.step, 'STORYTELLING', 'step tetap STORYTELLING untuk kartu klarifikasi aktor');
  assert(
    !result.storyline?.pendingProductVariantQuestion,
    'Tidak boleh ada kartu variasi untuk laundry kiloan'
  );
});

console.log('\n== [10] Poin 3 — Full Pipeline Pelatihan Kuliner: state machine + brief readiness ==');

test('Full pipeline Pelatihan Kuliner: narasi → muncul pertanyaan variasi → jawab "Ada varian" → narasi ter-append', () => {
  // Tahap 0: Session awal, narasi "Pelatihan kuliner membuat roti" TANPA menyebut variasi
  const sessionAwal: MockupSessionState = {
    step: 'STORYTELLING',
    match: {
      templateId: 'KULINER_02',
      overlayIds: [],
      patternIds: [],
      tier: 'ADVANCE',
      businessCategory: 'Pelatihan Kuliner'
    },
    roles: { selected: [] },
    flow: {},
    painPoints: { selected: [] },
    features: { selected: [] },
    storyline: {
      narasi: 'Pelatihan kuliner membuat roti yang mengelola instruktur dan siswa.',
      asumsiMasalah: 'Pendaftaran kelas masih manual via chat',
      asumsiAktor: ['Super Admin', 'Instruktur', 'Siswa'],
      asumsiAlurUtama: 'Siswa mendaftar kelas, memilih program pelatihan, instruktur mencatat nilai, admin cetak sertifikat.',
      statusKonfirmasi: 'disetujui',
      revisiCount: 0,
      riwayatKoreksi: []
    }
  };

  // Tahap 1: Confirm story → harus muncul pertanyaan variasi (Pelatihan Kuliner tidak dalam skiplist)
  const s1 = applyGuidedAnswer(sessionAwal, 'STORYTELLING', ['confirm_story'], undefined);
  assert(
    s1.storyline?.pendingProductVariantQuestion !== undefined,
    `[Tahap 1] Pelatihan Kuliner harus mendapat pertanyaan variasi. step=${s1.step}, pending=${JSON.stringify(s1.storyline?.pendingProductVariantQuestion)}`
  );
  assertEqual(s1.step, 'STORYTELLING', '[Tahap 1] step harus STORYTELLING');

  // Tahap 2: User menjawab "Ada beberapa varian" dengan nama: "Roti Tawar, Roti Gandum, Croissant"
  const s2 = applyGuidedAnswer(s1, 'STORYTELLING', ['variant_multiple'], 'Roti Tawar, Roti Gandum, Croissant');
  assertEqual(s2.step, 'STORYTELLING', '[Tahap 2] step masih STORYTELLING (lanjut ke klasifikasi aktor Siswa)');

  // Tahap 3: Verifikasi narasi sudah ter-append varian
  const narasi2 = s2.storyline!.narasi;
  assert(narasi2.includes('Roti Tawar'), `[Tahap 3] narasi harus memuat "Roti Tawar", dapat: "${narasi2.substring(0, 200)}"`);
  assert(narasi2.includes('Roti Gandum'), `[Tahap 3] narasi harus memuat "Roti Gandum"`);
  assert(narasi2.includes('Croissant'), `[Tahap 3] narasi harus memuat "Croissant"`);
  assert(narasi2.includes('[Variasi Produk:'), `[Tahap 3] narasi harus memuat penanda [Variasi Produk:]`);

  // Tahap 4: Klasifikasi aktor Siswa muncul
  assert(
    s2.storyline?.pendingActorClarification !== undefined,
    '[Tahap 4] Setelah variasi dijawab, harus muncul pendingActorClarification untuk Siswa'
  );
  const aktors = s2.storyline!.pendingActorClarification!.actors;
  assert(aktors.some(a => a.actor === 'Siswa'), '[Tahap 4] Siswa harus menjadi kandidat Entitas Data');

  console.log(`  [Info] Narasi ter-append: "${narasi2.substring(0, 200)}..."`);
});

test('Full pipeline: Brief yang dihasilkan dari session Pelatihan Kuliner memuat varian DAN hint 3-tier schema', () => {
  // Session pasca-selesai: roles & actorsClassification sudah terisi, narasi sudah memuat varian
  const sessionPascaInterview: MockupSessionState = {
    step: 'SKEMA_DATA',
    match: {
      templateId: 'KULINER_02',
      overlayIds: [],
      patternIds: [],
      tier: 'ADVANCE',
      businessCategory: 'Pelatihan Kuliner'
    },
    roles: {
      selected: ['Super Admin', 'Instruktur'],
      wajib: ['Super Admin'],
      tambahan: ['Instruktur']
    },
    flow: {},
    painPoints: { selected: [] },
    features: { selected: [] },
    actorsClassification: [
      { actor: 'Super Admin', category: 'PENGGUNA_SISTEM' },
      { actor: 'Instruktur', category: 'PENGGUNA_SISTEM' },
      // Bug 1b: Siswa sebagai ENTITAS_DATA dengan ownerRole = 'Instruktur'
      { actor: 'Siswa', category: 'ENTITAS_DATA', ownerRole: 'Instruktur' }
    ],
    storyline: {
      // Narasi sudah memuat varian (ter-append setelah user jawab variant_multiple)
      narasi: 'Pelatihan kuliner membuat roti yang mengelola instruktur dan siswa. [Variasi Produk: Bisnis ini menawarkan beberapa varian pelatihan (contoh varian: Roti Tawar, Roti Gandum, Croissant). Pelanggan dapat memilih dari beberapa opsi yang tersedia.]',
      asumsiMasalah: 'Pendaftaran kelas masih manual via chat',
      asumsiAktor: ['Super Admin', 'Instruktur', 'Siswa'],
      asumsiAlurUtama: 'Siswa mendaftar kelas, memilih program pelatihan, instruktur mencatat nilai, admin cetak sertifikat.',
      statusKonfirmasi: 'disetujui',
      revisiCount: 0,
      riwayatKoreksi: []
    }
  };

  // Kompilasi brief — ini yang dikirim ke AI
  const brief = compileBriefFromSession(sessionPascaInterview);

  // Verifikasi brief memuat nama varian (akan menginstruksikan AI membuat tabel katalog)
  assert(brief.includes('Roti Tawar'), `Brief harus memuat "Roti Tawar". Brief awal: "${brief.substring(0, 300)}"`);
  assert(brief.includes('Roti Gandum'), 'Brief harus memuat "Roti Gandum"');
  assert(brief.includes('Croissant'), 'Brief harus memuat "Croissant"');
  assert(brief.includes('[Variasi Produk:'), 'Brief harus memuat penanda [Variasi Produk:] sebagai hint untuk AI');

  // Verifikasi alur utama ada di brief (memuat "mendaftar kelas" → hint tabel pendaftaran)
  assert(
    brief.includes('mendaftar kelas') || brief.includes('mendaftar'),
    'Brief harus memuat alur pendaftaran sebagai hint tabel pendaftaran'
  );

  // Verifikasi roles di brief
  assert(brief.includes('Super Admin'), 'Brief harus memuat role Super Admin');
  assert(brief.includes('Instruktur'), 'Brief harus memuat role Instruktur');

  console.log(`  [Info] Brief panjang: ${brief.length} karakter. Snippet: "${brief.substring(0, 250)}..."`);
});

test('Bug 1b — Instruktur sebagai ownerRole Siswa: getEntityOwnerRole mengembalikan "Instruktur"', () => {
  // Import getEntityOwnerRole untuk verifikasi resolusi ownerRole
  const { getEntityOwnerRole } = require('../src/lib/templates/processes/guided');

  const sessionWithOwner: MockupSessionState = {
    step: 'SKEMA_DATA',
    match: {
      templateId: 'KULINER_02',
      overlayIds: [],
      patternIds: [],
      tier: 'ADVANCE',
      businessCategory: 'Pelatihan Kuliner'
    },
    roles: { selected: ['Super Admin', 'Instruktur'] },
    flow: {},
    painPoints: { selected: [] },
    features: { selected: [] },
    actorsClassification: [
      { actor: 'Super Admin', category: 'PENGGUNA_SISTEM' },
      { actor: 'Instruktur', category: 'PENGGUNA_SISTEM' },
      { actor: 'Siswa', category: 'ENTITAS_DATA', ownerRole: 'Instruktur' }
    ],
    storyline: {
      narasi: 'Pelatihan kuliner membuat roti.',
      asumsiMasalah: 'Manual',
      asumsiAktor: ['Super Admin', 'Instruktur', 'Siswa'],
      asumsiAlurUtama: 'Siswa mendaftar',
      statusKonfirmasi: 'disetujui'
    }
  };

  // getEntityOwnerRole harus mengembalikan 'Instruktur' untuk entitas 'Siswa'
  const ownerRoleSiswa = getEntityOwnerRole(sessionWithOwner, 'Siswa');
  assertEqual(
    ownerRoleSiswa,
    'Instruktur',
    `ownerRole Siswa harus "Instruktur", bukan Super Admin. Dapat: "${ownerRoleSiswa}"`
  );

  // Verifikasi bahwa Instruktur BUKAN ENTITAS_DATA (Bug 1b: ENTITAS_DATA tidak boleh jadi ownerRole-target)
  const { isActorEntityData } = require('../src/lib/templates/processes/guided');
  const instrukturIsEntity = isActorEntityData(sessionWithOwner, 'Instruktur');
  assert(
    !instrukturIsEntity,
    'Instruktur tidak boleh dikategorikan sebagai ENTITAS_DATA — harus PENGGUNA_SISTEM'
  );

  console.log(`  [Info] ownerRole Siswa = "${ownerRoleSiswa}" ✅`);
});

test('Bug 1b — Simulasi DB untuk Pelatihan Kuliner: tidak ada akun demo untuk Siswa (ENTITAS_DATA)', () => {
  const { generateDeterministicSimulasiDb } = require('../src/lib/templates/processes/guided');

  const sessionKuliner: MockupSessionState = {
    step: 'SIMULASI_DB',
    match: {
      templateId: 'KULINER_02',
      overlayIds: [],
      patternIds: [],
      tier: 'ADVANCE',
      businessCategory: 'Pelatihan Kuliner'
    },
    roles: { selected: ['Super Admin', 'Instruktur'] },  // Siswa TIDAK ada di selected roles
    flow: {},
    painPoints: { selected: [] },
    features: { selected: [] },
    actorsClassification: [
      { actor: 'Super Admin', category: 'PENGGUNA_SISTEM' },
      { actor: 'Instruktur', category: 'PENGGUNA_SISTEM' },
      { actor: 'Siswa', category: 'ENTITAS_DATA', ownerRole: 'Instruktur' }
    ],
    storyline: {
      narasi: 'Pelatihan kuliner membuat roti. [Variasi Produk: Bisnis ini menawarkan beberapa varian pelatihan (contoh varian: Roti Tawar, Roti Gandum, Croissant). Pelanggan dapat memilih dari beberapa opsi yang tersedia.]',
      asumsiMasalah: 'Pendaftaran manual',
      asumsiAktor: ['Super Admin', 'Instruktur', 'Siswa'],
      asumsiAlurUtama: 'Siswa mendaftar',
      statusKonfirmasi: 'disetujui'
    },
    dataSchema: {
      tabel: [
        {
          nama: 'paket_pelatihan',
          keterangan: 'Katalog varian paket pelatihan roti',
          field: [
            { nama: 'id', tipe: 'teks', keterangan: 'ID paket' },
            { nama: 'nama_paket', tipe: 'teks', keterangan: 'Nama varian paket pelatihan' },
            { nama: 'biaya', tipe: 'angka', keterangan: 'Biaya kursus' }
          ]
        },
        {
          nama: 'pendaftaran',
          keterangan: 'Tabel pendaftaran siswa ke paket pelatihan',
          field: [
            { nama: 'id', tipe: 'teks', keterangan: 'ID pendaftaran' },
            { nama: 'id_paket', tipe: 'relasi ke paket_pelatihan', keterangan: 'Relasi ke paket' },
            { nama: 'nama_siswa', tipe: 'teks', keterangan: 'Nama siswa' },
            { nama: 'tanggal_daftar', tipe: 'tanggal', keterangan: 'Tanggal mendaftar' }
          ]
        },
        {
          nama: 'sesi_praktik',
          keterangan: 'Rekaman sesi praktik siswa',
          field: [
            { nama: 'id', tipe: 'teks', keterangan: 'ID sesi' },
            { nama: 'id_pendaftaran', tipe: 'relasi ke pendaftaran', keterangan: 'Relasi ke pendaftaran' },
            { nama: 'nilai', tipe: 'angka', keterangan: 'Nilai praktik' },
            { nama: 'catatan', tipe: 'teks', keterangan: 'Catatan instruktur' }
          ]
        }
      ]
    }
  };

  const simDb = generateDeterministicSimulasiDb(sessionKuliner);
  assert(simDb !== null, 'simDb tidak boleh null');

  // Verifikasi akun login: hanya Super Admin dan Instruktur, BUKAN Siswa (Siswa = ENTITAS_DATA)
  const akunRoles = simDb.akunLogin.map((a: any) => a.role);
  console.log(`  [Info] Akun Demo: ${akunRoles.join(', ')}`);
  assert(akunRoles.includes('Super Admin'), 'Harus ada akun Super Admin');
  assert(akunRoles.includes('Instruktur'), 'Harus ada akun Instruktur');
  assert(!akunRoles.includes('Siswa'), 'Siswa (ENTITAS_DATA) TIDAK boleh ada di akun demo login');

  // Verifikasi tabel katalog memuat varian dari narasi
  const paketTable = simDb.contohData.tabel.find((t: any) => t.nama === 'paket_pelatihan');
  assert(paketTable !== undefined, 'Harus ada tabel paket_pelatihan di simulasi');
  const namaPakets = paketTable.baris.map((r: any) => r.nama_paket);
  console.log(`  [Info] Nama Paket di SimDB: ${namaPakets.join(', ')}`);
  assert(namaPakets.includes('Roti Tawar'), 'Harus ada "Roti Tawar" di katalog simulasi');
  assert(namaPakets.includes('Roti Gandum'), 'Harus ada "Roti Gandum" di katalog simulasi');
  assert(namaPakets.includes('Croissant'), 'Harus ada "Croissant" di katalog simulasi');

  // Verifikasi tabel pendaftaran ada (tabel pendaftaran = tabel penghubung 3-tier)
  const pendaftaranTable = simDb.contohData.tabel.find((t: any) => t.nama === 'pendaftaran');
  assert(pendaftaranTable !== undefined, 'Harus ada tabel pendaftaran di simulasi (3-tier: katalog → pendaftaran)');
});

console.log('\n========================================================================');
console.log(`HASIL: ${passed} PASS, ${failed} FAIL`);
console.log('========================================================================\n');

if (failed > 0) {
  process.exit(1);
}

