import assert from 'assert';
import {
  detectInvalidSchemaRelations,
  extractTablesAndCorrelationFromParsed
} from '../src/app/api/guided/route';
import {
  validateContohDataVsSchema
} from '../src/lib/templates/processes/guided';

console.log('========================================================================');
console.log('🧪 TEST SUITE: POLA 3-LAPIS & INTEGRITAS RELASI SKEMA DATA (BAGIAN D)');
console.log('========================================================================\n');

// =============================================================================
// 1. UJI STRUKTUR POLA 3-LAPIS: KATALOG + PENGHUBUNG + TURUNAN
// =============================================================================
console.log('--- [BAGIAN 1] VERIFIKASI STRUKTUR POLA 3-LAPIS (KATALOG + PENGHUBUNG + TURUNAN) ---');

const mock3TierTables = [
  {
    nama: 'paket_kursus',
    keterangan: 'Katalog master paket kursus yang tersedia',
    field: [
      { nama: 'id', tipe: 'text', keterangan: 'ID unik paket' },
      { nama: 'nama_paket', tipe: 'text', keterangan: 'Nama paket' },
      { nama: 'tarif', tipe: 'angka', keterangan: 'Biaya kursus' },
      { nama: 'durasi', tipe: 'angka', keterangan: 'Durasi dalam minggu' },
      { nama: 'status_aktif', tipe: 'text', keterangan: 'Status aktif paket' }
    ]
  },
  {
    nama: 'pendaftaran_kursus',
    keterangan: 'Jembatan pendaftaran antara siswa dan paket kursus',
    field: [
      { nama: 'id', tipe: 'text', keterangan: 'ID pendaftaran' },
      { nama: 'relasi_ke_siswa', tipe: 'relasi ke pengguna', keterangan: 'Relasi ke siswa', targetRole: 'Siswa' },
      { nama: 'relasi_ke_paket_kursus', tipe: 'relasi ke paket_kursus', keterangan: 'Relasi ke katalog paket' },
      { nama: 'tanggal_pendaftaran', tipe: 'tanggal', keterangan: 'Tanggal daftar' },
      { nama: 'status_proses', tipe: 'text', keterangan: 'Status proses' }
    ]
  },
  {
    nama: 'jadwal_sesi',
    keterangan: 'Tabel turunan: jadwal pertemuan per pendaftaran',
    field: [
      { nama: 'id', tipe: 'text', keterangan: 'ID jadwal' },
      { nama: 'relasi_ke_pendaftaran_kursus', tipe: 'relasi ke pendaftaran_kursus', keterangan: 'Relasi ke pendaftaran' },
      { nama: 'tanggal_sesi', tipe: 'tanggal', keterangan: 'Tanggal sesi' }
    ]
  },
  {
    nama: 'pengguna',
    keterangan: 'Akun seluruh pengguna sistem',
    field: [
      { nama: 'id', tipe: 'text', keterangan: 'ID akun' },
      { nama: 'nama', tipe: 'text', keterangan: 'Nama lengkap' },
      { nama: 'peran', tipe: 'text', keterangan: 'Peran' }
    ]
  }
];

// Lapis 1: Master Katalog TIDAK BOLEH memiliki relasi ke entitas pelanggan/siswa
const catalogTable = mock3TierTables.find(t => t.nama === 'paket_kursus')!;
const catalogHasCustomerRel = catalogTable.field.some(f => /relasi ke pengguna|relasi ke siswa|relasi ke pelanggan/i.test(f.tipe));
assert.strictEqual(catalogHasCustomerRel, false, 'Tabel katalog tidak boleh berelasi langsung ke pelanggan/siswa');
console.log('✅ Lapis 1 (Katalog Master): Bebas dari relasi ke pelanggan/siswa (valid).');

// Lapis 2: Tabel Penghubung WAJIB memiliki relasi ke entitas pengguna DAN relasi ke katalog
const connectorTable = mock3TierTables.find(t => t.nama === 'pendaftaran_kursus')!;
const hasUserRel = connectorTable.field.some(f => f.tipe === 'relasi ke pengguna' && f.targetRole === 'Siswa');
const hasCatalogRel = connectorTable.field.some(f => f.tipe === 'relasi ke paket_kursus');
assert.strictEqual(hasUserRel, true, 'Tabel penghubung wajib memiliki relasi ke pengguna dengan targetRole');
assert.strictEqual(hasCatalogRel, true, 'Tabel penghubung wajib memiliki relasi ke katalog paket');
console.log('✅ Lapis 2 (Tabel Penghubung): Memiliki kedua relasi kunci (pengguna + katalog).');

// Lapis 3: Tabel Turunan WAJIB berelasi ke tabel penghubung (bukan mandiri ke siswa/katalog)
const derivedTable = mock3TierTables.find(t => t.nama === 'jadwal_sesi')!;
const hasConnectorRel = derivedTable.field.some(f => f.tipe === 'relasi ke pendaftaran_kursus');
assert.strictEqual(hasConnectorRel, true, 'Tabel turunan wajib berelasi ke tabel pendaftaran penghubung');
console.log('✅ Lapis 3 (Tabel Turunan): Merujuk langsung ke tabel pendaftaran penghubung.');


// =============================================================================
// 2. UJI NEGATIF: RELASI KE TABEL TIDAK ADA (BUG 1) & AUTO-REPAIR
// =============================================================================
console.log('\n--- [BAGIAN 2] UJI NEGATIF RELASI KE TABEL TIDAK ADA (BUG 1) ---');

// Kasus Negatif A: Tabel memiliki field relasi ke tabel yang benar-benar fiktif
const buggySchemaWithPhantomTable = [
  {
    nama: 'pendaftaran_pengujian_sampel',
    field: [
      { nama: 'id', tipe: 'text' },
      { nama: 'relasi_ke_klien', tipe: 'relasi ke klien', keterangan: 'Menunjuk tabel klien yang tidak ada' },
      { nama: 'relasi_ke_paket_fiktif', tipe: 'relasi ke paket_fiktif', keterangan: 'Menunjuk tabel fiktif' }
    ]
  },
  {
    nama: 'pengguna',
    field: [
      { nama: 'id', tipe: 'text' },
      { nama: 'nama', tipe: 'text' },
      { nama: 'peran', tipe: 'text' }
    ]
  }
];

const invalidRelations = detectInvalidSchemaRelations(buggySchemaWithPhantomTable);
assert.strictEqual(invalidRelations.length, 2, 'Harus mendeteksi 2 relasi ke tabel yang tidak ada');
assert.ok(invalidRelations[0].includes('relasi ke klien'), 'Error 1 harus menyebut relasi ke klien');
assert.ok(invalidRelations[1].includes('relasi ke paket_fiktif'), 'Error 2 harus menyebut relasi ke paket_fiktif');
console.log(`✅ detectInvalidSchemaRelations berhasil mendeteksi ${invalidRelations.length} relasi tidak valid:`);
invalidRelations.forEach(err => console.log(`   - ${err}`));

// Kasus Negatif B: Verifikasi validateContohDataVsSchema menandai gagal eksplisit
const dummyContohData = {
  tabel: [
    {
      nama: 'pendaftaran_pengujian_sampel',
      baris: [{ id: 'REG-001', relasi_ke_klien: 'USR-01' }]
    },
    {
      nama: 'pengguna',
      baris: [{ id: 'USR-01', nama: 'PT ABC', peran: 'Klien Perusahaan' }]
    }
  ]
};

const validationProblems = validateContohDataVsSchema(
  dummyContohData,
  buggySchemaWithPhantomTable,
  ['Super Admin', 'Analis Lab', 'Klien Perusahaan']
);

assert.ok(
  validationProblems.some(p => p.includes('tidak ada di skema data') || p.includes('relasi tidak menemukan tabel tujuan')),
  'validateContohDataVsSchema harus menandai kegagalan relasi ke tabel tidak ada'
);
console.log('✅ validateContohDataVsSchema berhasil menandai kesalahan:', validationProblems[0]);

// Kasus Negatif C: Auto-repair role-to-user table di extractTablesAndCorrelationFromParsed
console.log('\n--- [BAGIAN 3] UJI AUTO-REPAIR PERAN KE TABEL PENGGUNA ---');

const rawParsedAiOutput = {
  tabel: [
    {
      nama: 'pendaftaran_pengujian_sampel',
      keterangan: 'Pendaftaran sampel',
      field: [
        { nama: 'id', tipe: 'text', keterangan: 'ID pendaftaran' },
        // AI salah menulis "relasi ke klien" padahal akun tersimpan di tabel "pengguna"
        { nama: 'relasi_ke_klien', tipe: 'relasi ke klien', keterangan: 'Relasi ke klien perusahaan' },
        { nama: 'relasi_ke_parameter_uji', tipe: 'relasi ke katalog_parameter_uji', keterangan: 'Relasi ke katalog' }
      ]
    },
    {
      nama: 'katalog_parameter_uji',
      keterangan: 'Katalog parameter',
      field: [
        { nama: 'id', tipe: 'text', keterangan: 'ID' },
        { nama: 'nama_parameter', tipe: 'text', keterangan: 'Nama parameter' }
      ]
    },
    {
      nama: 'pengguna',
      keterangan: 'Akun pengguna',
      field: [
        { nama: 'id', tipe: 'text', keterangan: 'ID' },
        { nama: 'peran', tipe: 'text', keterangan: 'Peran' }
      ]
    }
  ],
  korelasiRingkas: 'Alur pendaftaran'
};

async function testAutoRepair() {
  const extracted = await extractTablesAndCorrelationFromParsed(
    rawParsedAiOutput,
    'Alur korelasi',
    ['Super Admin', 'Analis Lab', 'Klien Perusahaan']
  );

  assert.ok(extracted, 'Extracted tables tidak boleh null');
  const regTable = extracted!.tables.find(t => t.nama === 'pendaftaran_pengujian_sampel')!;
  const klienField = regTable.field.find(f => f.nama === 'relasi_ke_klien')!;

  assert.strictEqual(
    klienField.tipe,
    'relasi ke pengguna',
    'Tipe field "relasi ke klien" harus otomatis dinormalisasi ke "relasi ke pengguna"'
  );
  assert.strictEqual(
    klienField.targetRole,
    'Klien Perusahaan',
    'TargetRole harus otomatis dipetakan ke peran resmi "Klien Perusahaan"'
  );
  console.log('✅ extractTablesAndCorrelationFromParsed sukses auto-repair:');
  console.log(`   Field: ${klienField.nama} -> Tipe: "${klienField.tipe}", TargetRole: "${klienField.targetRole}"`);

  // Pastikan setelah auto-repair, detectInvalidSchemaRelations menghasilkan 0 error
  const remainingErrors = detectInvalidSchemaRelations(extracted!.tables);
  assert.strictEqual(remainingErrors.length, 0, 'Setelah auto-repair, skema harus 100% bersih');
  console.log('✅ Skema hasil auto-repair 100% valid dan bebas dari relasi ke tabel tidak ada.');
}

testAutoRepair().then(() => {
  console.log('\n========================================================================');
  console.log('🎉 SELURUH PENGUJIAN POLA 3-LAPIS & INTEGRITAS RELASI SKEMA LOLOS (PASS)');
  console.log('========================================================================');
}).catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
