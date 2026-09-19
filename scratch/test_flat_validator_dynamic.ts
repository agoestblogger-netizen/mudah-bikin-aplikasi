import assert from 'assert';
import {
  detectFlatSchemaViolation,
  findBridgeTablesForEntity,
  isBaseIdentityField,
  setMockSchemaFlatnessAuditorForTesting,
  getSchemaAuditorCallCount,
  resetSchemaAuditorCallCount
} from '../src/app/api/guided/route';

console.log('========================================================================');
console.log('🧪 TEST: DETEKSI SKEMA FLAT BERBASIS TOPOLOGI PER-ENTITAS & AUDIT SEMANTIK');
console.log('========================================================================\n');

// -----------------------------------------------------------------------------
// 1. UJI FUNGSI DASAR: isBaseIdentityField & findBridgeTablesForEntity
// -----------------------------------------------------------------------------
async function runTests() {
  console.log('--- [BAGIAN 1] VERIFIKASI TOPOLOGI & IDENTITAS DASAR ---');

  assert.strictEqual(isBaseIdentityField('nama_lengkap'), true);
  assert.strictEqual(isBaseIdentityField('no_telepon'), true);
  assert.strictEqual(isBaseIdentityField('alamat_domisili'), true);
  assert.strictEqual(isBaseIdentityField('tanggal_lahir'), true);
  assert.strictEqual(isBaseIdentityField('terdaftar_oleh'), true);
  // Domain offering fields:
  assert.strictEqual(isBaseIdentityField('pilihan_kostum'), false);
  assert.strictEqual(isBaseIdentityField('koleksi_alat'), false);
  assert.strictEqual(isBaseIdentityField('instrumen_musik'), false);
  assert.strictEqual(isBaseIdentityField('tipe_kamera'), false);
  console.log('✓ isBaseIdentityField membedakan identitas vs domain offering tanpa regex kaku.');

  const sampleTables = [
    {
      nama: 'penyewa',
      field: [{ nama: 'id', tipe: 'text' }, { nama: 'nama', tipe: 'text' }]
    },
    {
      nama: 'koleksi_kostum',
      field: [{ nama: 'id', tipe: 'text' }, { nama: 'nama_kostum', tipe: 'text' }]
    },
    {
      nama: 'transaksi_sewa_kostum',
      field: [
        { nama: 'id', tipe: 'text' },
        { nama: 'penyewa_id', tipe: 'relasi ke penyewa' },
        { nama: 'kostum_id', tipe: 'relasi ke koleksi_kostum' }
      ]
    }
  ];

  const bridges = findBridgeTablesForEntity('penyewa', sampleTables);
  assert.strictEqual(bridges.length, 1);
  assert.strictEqual(bridges[0].nama, 'transaksi_sewa_kostum');
  assert.strictEqual(bridges[0].catalogTable, 'koleksi_kostum');
  console.log('✓ findBridgeTablesForEntity mengenali jembatan Lapis 2 secara topologis murni.');


  // -----------------------------------------------------------------------------
  // 2. DOMAIN DI LUAR REGEX LIST LAMA: "SEWA KOSTUM"
  // -----------------------------------------------------------------------------
  console.log('\n--- [BAGIAN 2] DOMAIN DI LUAR REGEX LAMA: SEWA KOSTUM ---');

  const sessionSewaKostum: any = {
    match: { businessCategory: 'Sewa Kostum' },
    storyline: {
      narasi: 'Butik persewaan busana dan kostum adat. Pelanggan memilih kostum untuk disewa beberapa hari, dengan pemeriksaan kelengkapan saat pengembalian.',
      asumsiAlurUtama: 'Penyewa datang -> Pilih kostum -> Transaksi sewa -> Pengembalian & cek denda'
    },
    actorsClassification: [
      { actor: 'Penyewa', category: 'ENTITAS_DATA', ownerRole: 'Kasir Butik' }
    ],
    flow: {
      alurInti: [
        { step: 1, pelaku: 'Kasir Butik', aksi: 'Mencatat data penyewa dan pilihan kostum yang disewa' },
        { step: 2, pelaku: 'Kasir Butik', aksi: 'Mencatat tanggal pengembalian dan uang jaminan' }
      ]
    }
  };

  // Skenario A: Sewa Kostum FLAT (Menyerap pilihan_kostum ke penyewa, tanpa katalog)
  const flatSewaKostumTables = [
    {
      nama: 'penyewa',
      field: [
        { nama: 'id', tipe: 'text', keterangan: 'ID' },
        { nama: 'nama_lengkap', tipe: 'text', keterangan: 'Nama' },
        { nama: 'kontak_hp', tipe: 'text', keterangan: 'HP' },
        { nama: 'pilihan_kostum', tipe: 'text', keterangan: 'Nama kostum yang disewa' } // <-- FIELD TERLARANG
      ]
    },
    {
      nama: 'riwayat_sewa',
      field: [
        { nama: 'id', tipe: 'text', keterangan: 'ID' },
        { nama: 'penyewa_id', tipe: 'relasi ke penyewa', keterangan: 'Relasi ke penyewa' },
        { nama: 'tanggal_pinjam', tipe: 'tanggal', keterangan: 'Tgl' }
      ]
    }
  ];

  // Pasang Mock AI Auditor Lapis 2 untuk Sewa Kostum Flat
  setMockSchemaFlatnessAuditorForTesting(async (actor, entityTable, allTables, session) => {
    if (session.match?.businessCategory === 'Sewa Kostum') {
      return {
        isViolation: true,
        reason: 'Bisnis sewa kostum menyewakan aset fisik pakaian berulang kali. Tabel penyewa menyerap pilihan_kostum sebagai teks bebas tanpa adanya tabel master koleksi_kostum.'
      };
    }
    return null;
  });

  resetSchemaAuditorCallCount();
  const violationKostum = await detectFlatSchemaViolation(flatSewaKostumTables, sessionSewaKostum);
  console.log('Hasil Deteksi Sewa Kostum (Flat):', violationKostum);
  assert(violationKostum, 'FAILED: Sewa Kostum Flat HARUS terdeteksi melanggar!');
  assert(violationKostum.includes('sewa kostum'), 'Pesan audit semantik harus menyebut domain sewa kostum');
  console.log('✓ Lolos Uji Sewa Kostum Flat: Berhasil ditangkap oleh audit semantik dinamis!');

  // Skenario B: Sewa Kostum 3-LAPIS VALID (Ada katalog koleksi_kostum & transaksi_sewa_kostum)
  const validSewaKostumTables = [
    {
      nama: 'penyewa',
      field: [
        { nama: 'id', tipe: 'text', keterangan: 'ID' },
        { nama: 'nama_lengkap', tipe: 'text', keterangan: 'Nama' },
        { nama: 'kontak_hp', tipe: 'text', keterangan: 'HP' }
      ]
    },
    {
      nama: 'koleksi_kostum',
      field: [
        { nama: 'id', tipe: 'text', keterangan: 'ID' },
        { nama: 'nama_kostum', tipe: 'text', keterangan: 'Nama' },
        { nama: 'ukuran', tipe: 'text', keterangan: 'Ukuran' },
        { nama: 'tarif_sewa', tipe: 'angka', keterangan: 'Tarif' }
      ]
    },
    {
      nama: 'transaksi_sewa_kostum',
      field: [
        { nama: 'id', tipe: 'text', keterangan: 'ID' },
        { nama: 'penyewa_id', tipe: 'relasi ke penyewa', keterangan: 'Penyewa' },
        { nama: 'kostum_id', tipe: 'relasi ke koleksi_kostum', keterangan: 'Kostum' },
        { nama: 'tanggal_sewa', tipe: 'tanggal', keterangan: 'Tgl' }
      ]
    }
  ];

  resetSchemaAuditorCallCount();
  const cleanKostum = await detectFlatSchemaViolation(validSewaKostumTables, sessionSewaKostum);
  console.log('Hasil Deteksi Sewa Kostum (3-Lapis):', cleanKostum);
  assert.strictEqual(cleanKostum, null, 'FAILED: Skema 3-lapis tidak boleh dilaporkan melanggar');
  assert.strictEqual(getSchemaAuditorCallCount(), 0, 'Skema 3-lapis valid HARUS lolos di Lapis 1 Topologi tanpa panggil AI');
  console.log('✓ Lolos Uji Sewa Kostum 3-Lapis: Bersih tanpa panggil AI (0 token, 0 ms latency)!');


  // -----------------------------------------------------------------------------
  // 3. DOMAIN DI LUAR REGEX LIST LAMA: "PERSEWAAN ALAT KAMPING"
  // -----------------------------------------------------------------------------
  console.log('\n--- [BAGIAN 3] DOMAIN DI LUAR REGEX LAMA: PERSEWAAN ALAT KAMPING ---');

  const sessionKamping: any = {
    match: { businessCategory: 'Persewaan Alat Kamping' },
    storyline: {
      narasi: 'Persewaan tenda, matras, dan kompor outdoor. Anggota meminjam peralatan kamping dengan durasi sewa beberapa hari.',
      asumsiAlurUtama: 'Pendaftaran Anggota -> Pemilihan Alat Kamping -> Pengambilan -> Pengembalian'
    },
    actorsClassification: [
      { actor: 'Anggota Kamping', category: 'ENTITAS_DATA', ownerRole: 'Pengelola Gudang' }
    ],
    flow: {
      alurInti: [
        { step: 1, pelaku: 'Pengelola Gudang', aksi: 'Mencatat anggota dan alat kamping yang dipinjam' }
      ]
    }
  };

  const flatKampingTables = [
    {
      nama: 'anggota_kamping',
      field: [
        { nama: 'id', tipe: 'text', keterangan: 'ID' },
        { nama: 'nama', tipe: 'text', keterangan: 'Nama' },
        { nama: 'alat_dipinjam', tipe: 'text', keterangan: 'Peralatan yang dipinjam' } // <-- NON-IDENTITY
      ]
    },
    {
      nama: 'jadwal_ambil',
      field: [
        { nama: 'id', tipe: 'text', keterangan: 'ID' },
        { nama: 'anggota_id', tipe: 'relasi ke anggota_kamping', keterangan: 'Anggota' }
      ]
    }
  ];

  setMockSchemaFlatnessAuditorForTesting(async (actor, entityTable, allTables, session) => {
    if (session.match?.businessCategory === 'Persewaan Alat Kamping') {
      return {
        isViolation: true,
        reason: 'Peralatan kamping adalah inventaris fisik terbatas yang dipinjam bergantian. Tabel anggota_kamping menyerap alat_dipinjam tanpa adanya tabel inventaris alat dan transaksi peminjaman terpisah.'
      };
    }
    return null;
  });

  const violationKamping = await detectFlatSchemaViolation(flatKampingTables, sessionKamping);
  console.log('Hasil Deteksi Alat Kamping (Flat):', violationKamping);
  assert(violationKamping, 'FAILED: Persewaan Alat Kamping Flat HARUS terdeteksi!');
  assert(violationKamping.includes('inventaris fisik'), 'Pesan audit harus spesifik');
  console.log('✓ Lolos Uji Persewaan Alat Kamping Flat!');


  // -----------------------------------------------------------------------------
  // 4. UJI SCOPE PER-ENTITAS: MULTI-ENTITAS (SATU BENAR, SATU FLAT)
  // -----------------------------------------------------------------------------
  console.log('\n--- [BAGIAN 4] UJI SCOPE PER-ENTITAS (MULTI-ENTITAS DALAM SATU SKEMA) ---');

  const sessionMultiEntity: any = {
    match: { businessCategory: 'Sanggar Seni & Donasi' },
    storyline: {
      narasi: 'Sanggar seni memiliki siswa les tari dan menerima donasi dari para donatur.',
      asumsiAlurUtama: 'Siswa mendaftar les tari -> Jadwal latihan; Donatur menyalurkan dana'
    },
    actorsClassification: [
      { actor: 'Siswa', category: 'ENTITAS_DATA', ownerRole: 'Admin Sanggar' },
      { actor: 'Donatur', category: 'ENTITAS_DATA', ownerRole: 'Bendahara' }
    ],
    flow: {
      alurInti: [
        { step: 1, pelaku: 'Admin Sanggar', aksi: 'Mendaftarkan siswa dan kelas tari yang diambil' },
        { step: 2, pelaku: 'Bendahara', aksi: 'Mencatat donatur dan donasi yang disalurkan' }
      ]
    }
  };

  // Skema di mana Siswa SUDAH 3-lapis (ada kelas_tari & pendaftaran_tari),
  // TAPI Donatur FLAT (menyerap jenis_donasi sebagai teks bebas tanpa jembatan)
  const multiEntityTables = [
    {
      nama: 'siswa',
      field: [{ nama: 'id', tipe: 'text' }, { nama: 'nama', tipe: 'text' }]
    },
    {
      nama: 'kelas_tari',
      field: [{ nama: 'id', tipe: 'text' }, { nama: 'nama_tari', tipe: 'text' }, { nama: 'biaya', tipe: 'angka' }]
    },
    {
      nama: 'pendaftaran_tari',
      field: [
        { nama: 'id', tipe: 'text' },
        { nama: 'siswa_id', tipe: 'relasi ke siswa' },
        { nama: 'kelas_id', tipe: 'relasi ke kelas_tari' }
      ]
    },
    {
      nama: 'donatur',
      field: [
        { nama: 'id', tipe: 'text' },
        { nama: 'nama_donatur', tipe: 'text' },
        { nama: 'program_donasi_dipilih', tipe: 'text' } // <-- FLAT pada Donatur!
      ]
    },
    {
      nama: 'penerimaan_donasi',
      field: [
        { nama: 'id', tipe: 'text' },
        { nama: 'donatur_id', tipe: 'relasi ke donatur' },
        { nama: 'nominal', tipe: 'angka' }
      ]
    }
  ];

  setMockSchemaFlatnessAuditorForTesting(async (actor, entityTable, allTables, session) => {
    if (actor === 'Donatur') {
      return {
        isViolation: true,
        reason: 'Tabel donatur menyerap program_donasi_dipilih tanpa adanya tabel katalog program donasi terpisah.'
      };
    }
    return null;
  });

  const multiViolation = await detectFlatSchemaViolation(multiEntityTables, sessionMultiEntity);
  console.log('Hasil Deteksi Multi-Entitas:', multiViolation);
  assert(multiViolation, 'FAILED: Pelanggaran pada entitas Donatur HARUS terdeteksi!');
  assert(multiViolation.includes('donatur'), 'Harus secara spesifik menyebut tabel donatur yang bermasalah, bukan siswa');
  // -----------------------------------------------------------------------------
  // 4B. UJI MULTI-ENTITAS: KEDUANYA FLAT SEKALIGUS (SISWA FLAT & DONATUR FLAT)
  // -----------------------------------------------------------------------------
  console.log('\n--- [BAGIAN 4B] UJI MULTI-ENTITAS FLAT SEKALIGUS (AKUMULASI SELURUH PELANGGARAN) ---');

  // Skema di mana Siswa FLAT DAN Donatur juga FLAT
  const allFlatTables = [
    {
      nama: 'siswa',
      field: [
        { nama: 'id', tipe: 'text' },
        { nama: 'nama', tipe: 'text' },
        { nama: 'paket_tari_dipilih', tipe: 'text' } // <-- FLAT Siswa
      ]
    },
    {
      nama: 'donatur',
      field: [
        { nama: 'id', tipe: 'text' },
        { nama: 'nama_donatur', tipe: 'text' },
        { nama: 'program_donasi_dipilih', tipe: 'text' } // <-- FLAT Donatur
      ]
    }
  ];

  setMockSchemaFlatnessAuditorForTesting(async (actor, entityTable, allTables, session) => {
    if (actor === 'Siswa') {
      return {
        isViolation: true,
        reason: 'Tabel siswa menyerap paket_tari_dipilih tanpa tabel katalog paket_tari.'
      };
    }
    if (actor === 'Donatur') {
      return {
        isViolation: true,
        reason: 'Tabel donatur menyerap program_donasi_dipilih tanpa tabel katalog program_donasi.'
      };
    }
    return null;
  });

  const bothViolations = await detectFlatSchemaViolation(allFlatTables, sessionMultiEntity);
  console.log('Hasil Deteksi Keduanya Flat Sekaligus:\n-', bothViolations);
  assert(bothViolations, 'FAILED: Pelanggaran multi-entitas flat harus terdeteksi!');
  assert(bothViolations.includes('siswa'), 'Harus memuat pelanggaran siswa');
  assert(bothViolations.includes('donatur'), 'Harus memuat pelanggaran donatur');
  assert(bothViolations.includes('\n- '), 'Harus memuat separator peluru kedua pelanggaran');
  console.log('✓ Akumulasi Multi-Entitas Terbukti: Siswa DAN Donatur sama-sama dilaporkan sekaligus!');

  // Bersihkan mock setelah testing
  setMockSchemaFlatnessAuditorForTesting(null);

  // -----------------------------------------------------------------------------
  // 5. UJI AI LIVE ASLI TANPA MOCK: "SEWA KOSTUM"
  // -----------------------------------------------------------------------------
  console.log('\n--- [BAGIAN 5] UJI LIVE AI TANPA MOCK: SEWA KOSTUM ---');
  if (process.env.OPENAI_API_KEY) {
    console.log('Menjalankan audit AI Semantik nyata ke model gpt-4o-mini...');
    const liveViolation = await detectFlatSchemaViolation(
      flatSewaKostumTables,
      sessionSewaKostum,
      {
        provider: 'openai',
        apiKey: process.env.OPENAI_API_KEY,
        model: 'gpt-4o-mini'
      }
    );
    console.log('Hasil Live AI Audit untuk Sewa Kostum Flat:');
    console.log('->', liveViolation);
    assert(liveViolation, 'FAILED: Live AI HARUS mendeteksi pelanggaran Sewa Kostum Flat!');
    console.log('✓ Live AI Berhasil Mendeteksi Pelanggaran Sewa Kostum Secara Mandiri!');
  } else {
    console.log('⚠️ Lewati Bagian 5 karena OPENAI_API_KEY tidak disetel.');
  }

  console.log('\n========================================================================');
  console.log('🎉 SELURUH PENGUJIAN DINAMIS & PER-ENTITAS BERHASIL 100%!');
  console.log('========================================================================\n');
}

runTests().catch(console.error);
