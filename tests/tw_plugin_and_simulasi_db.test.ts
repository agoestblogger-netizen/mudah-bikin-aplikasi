import assert from 'assert';
import { checkTailwindV2Syntax } from '../src/lib/codeValidator';
import {
  generateDeterministicSimulasiDb,
  validateContohDataVsSchema
} from '../src/lib/templates/processes/guided';
import { MockupSessionState } from '../src/lib/templates/processes/types';

console.log('================================================================');
console.log('🧪 TEST SUITE #14: BUG A (TAILWIND PLUGIN CLASS) & BUG B (SIMULASI DB QUALITY)');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// [BUG A] SUBTEST 1: Deteksi Kelas Plugin Non-Core pada checkTailwindV2Syntax
// -----------------------------------------------------------------------------
console.log('[Bug A - Subtest 1] Uji Negatif: HTML dengan plugin class (scrollbar-hide, form-input, prose)');

const htmlWithPluginClasses = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css">
</head>
<body class="bg-gray-50">
  <div class="overflow-x-auto scrollbar-hide">
    <input type="text" class="form-input text-gray-700">
    <div class="prose">
      <p>Deskripsi teks</p>
    </div>
  </div>
</body>
</html>`;

const twReport = checkTailwindV2Syntax(htmlWithPluginClasses);
console.log('  Invalid classes detected:', twReport.invalidClasses);

assert(
  twReport.invalidClasses.includes('scrollbar-hide'),
  'FAILED: scrollbar-hide harus ditolak oleh whitelist Tailwind v2!'
);
assert(
  twReport.invalidClasses.includes('form-input'),
  'FAILED: form-input harus ditolak oleh whitelist Tailwind v2!'
);
assert(
  twReport.invalidClasses.includes('prose'),
  'FAILED: prose harus ditolak oleh whitelist Tailwind v2!'
);
console.log('  ✅ Subtest 1: Semua kelas plugin non-core berhasil ditangkap whitelist v2!\n');

// -----------------------------------------------------------------------------
// [BUG A] SUBTEST 2: Solusi CSS Custom untuk Scrollbar Lolos Validasi
// -----------------------------------------------------------------------------
console.log('[Bug A - Subtest 2] Uji Positif: Solusi CSS custom tanpa kelas plugin');

const htmlWithValidCustomCss = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css">
  <style>
    .overflow-x-auto::-webkit-scrollbar { display: none; }
    .overflow-x-auto { -ms-overflow-style: none; scrollbar-width: none; }
  </style>
</head>
<body class="bg-gray-50 p-4">
  <div class="overflow-x-auto flex space-x-2">
    <button class="tab-btn px-4 py-2 bg-blue-600 text-white rounded-lg">Tab 1</button>
    <button class="tab-btn px-4 py-2 bg-gray-200 text-gray-800 rounded-lg">Tab 2</button>
  </div>
</body>
</html>`;

const validTwReport = checkTailwindV2Syntax(htmlWithValidCustomCss);
assert.strictEqual(
  validTwReport.invalidClasses.length,
  0,
  `FAILED: CSS custom + Tailwind core classes tidak boleh menghasilkan invalidClasses! Dapat: ${validTwReport.invalidClasses.join(', ')}`
);
assert.strictEqual(
  validTwReport.warnings.length,
  0,
  'FAILED: CSS custom + Tailwind core classes tidak boleh menghasilkan warning!'
);
console.log('  ✅ Subtest 2: HTML dengan CSS custom sembunyikan scrollbar 100% valid tanpa warning!\n');

// -----------------------------------------------------------------------------
// [BUG B1] SUBTEST 3: Field detail_kerusakan Menghasilkan Kerusakan Fisik, BUKAN Alamat
// -----------------------------------------------------------------------------
console.log('[Bug B1 - Subtest 3] Uji Skema Rental Sepeda: detail_kerusakan harus deskripsi fisik');

const rentalSepedaSession = {
  step: 'SIMULASI_DB',
  match: {
    templateId: 'rental_sepeda',
    overlayIds: [],
    patternIds: [],
    tier: 'BASIC' as const,
    businessCategory: 'Rental Sepeda'
  },
  roles: {
    selected: ['Super Admin', 'Petugas Rental', 'Pelanggan']
  },
  dataSchema: {
    tabel: [
      {
        nama: 'pengguna',
        keterangan: 'Akun sistem',
        field: [
          { nama: 'id', tipe: 'text', keterangan: 'ID pengguna' },
          { nama: 'nama', tipe: 'text', keterangan: 'Nama pengguna' },
          { nama: 'peran', tipe: 'text', keterangan: 'Peran pengguna' },
          { nama: 'username', tipe: 'text', keterangan: 'Username login' }
        ]
      },
      {
        nama: 'sepeda',
        keterangan: 'Katalog unit sepeda',
        field: [
          { nama: 'id', tipe: 'text', keterangan: 'ID sepeda' },
          { nama: 'tipe_sepeda', tipe: 'text', keterangan: 'Gunung / Lipat / Balap' },
          { nama: 'tarif_per_hari', tipe: 'angka', keterangan: 'Tarif sewa per hari' },
          { nama: 'status', tipe: 'text', keterangan: 'Tersedia / Disewa / Perawatan' }
        ]
      },
      {
        nama: 'pemeriksaan_kembali',
        keterangan: 'Pemeriksaan unit sepeda saat kembali',
        field: [
          { nama: 'id', tipe: 'text', keterangan: 'ID pemeriksaan' },
          { nama: 'sepeda_id', tipe: 'relasi ke sepeda', keterangan: 'Relasi ke unit sepeda' },
          { nama: 'detail_kerusakan', tipe: 'text', keterangan: 'Lokasi kerusakan spesifik pada rangka atau ban' },
          { nama: 'deposit', tipe: 'angka', keterangan: 'Uang deposit jaminan sewa' },
          { nama: 'total_tagihan', tipe: 'angka', keterangan: 'Total tagihan sewa dan denda' }
        ]
      }
    ]
  }
} as unknown as MockupSessionState;

const rentalSimulasi = generateDeterministicSimulasiDb(rentalSepedaSession);
const pemTabel = rentalSimulasi.contohData.tabel.find(t => t.nama === 'pemeriksaan_kembali');
assert(pemTabel, 'FAILED: tabel pemeriksaan_kembali harus ada di contohData!');

const damageValues = pemTabel.baris.map(r => String(r.detail_kerusakan));
console.log('  Hasil detail_kerusakan:', damageValues);

for (const val of damageValues) {
  assert(
    !/(?:^jl\.|\bjalan\b|\bmerdeka\b|\bsudirman\b|\bdiponegoro\b)/i.test(val),
    `FAILED: detail_kerusakan TIDAK BOLEH berisi alamat jalan! Nilai didapat: "${val}"`
  );
  assert(
    /rantai|rem|velg|rangka|ban|baret|lecet|oleng|aus|kendor|mulus/i.test(val),
    `FAILED: detail_kerusakan harus berisi deskripsi komponen fisik sepeda! Nilai didapat: "${val}"`
  );
}
console.log('  ✅ Subtest 3: detail_kerusakan sukses berisi kondisi fisik unit, bebas dari alamat jalan!\n');

// -----------------------------------------------------------------------------
// [BUG B1] SUBTEST 4: Validator Menolak Field Kerusakan yang Diisi Alamat Jalan
// -----------------------------------------------------------------------------
console.log('[Bug B1 - Subtest 4] Validator checkKontenSimulasi menangkap alamat jalan di field kerusakan');

const badDamageContohData = {
  tabel: [
    {
      nama: 'pemeriksaan_kembali',
      baris: [
        { id: 'PEM-001', sepeda_id: 'SEP-001', detail_kerusakan: 'Jl. Merdeka No. 1', deposit: 50000, total_tagihan: 150000 },
        { id: 'PEM-002', sepeda_id: 'SEP-002', detail_kerusakan: 'Jl. Sudirman No. 45', deposit: 100000, total_tagihan: 250000 },
        { id: 'PEM-003', sepeda_id: 'SEP-003', detail_kerusakan: 'Jl. Diponegoro No. 12', deposit: 200000, total_tagihan: 500000 }
      ]
    },
    {
      nama: 'pengguna',
      baris: [
        { id: 'USR-001', nama: 'Admin', peran: 'Super Admin', username: 'admin' },
        { id: 'USR-002', nama: 'Petugas', peran: 'Petugas Rental', username: 'petugas' },
        { id: 'USR-003', nama: 'Pelanggan', peran: 'Pelanggan', username: 'pelanggan' }
      ]
    },
    {
      nama: 'sepeda',
      baris: [
        { id: 'SEP-001', tipe_sepeda: 'Gunung', tarif_per_hari: 100000, status: 'Tersedia' },
        { id: 'SEP-002', tipe_sepeda: 'Lipat', tarif_per_hari: 75000, status: 'Disewa' },
        { id: 'SEP-003', tipe_sepeda: 'Balap', tarif_per_hari: 120000, status: 'Tersedia' }
      ]
    }
  ]
};

const badDamageIssues = validateContohDataVsSchema(badDamageContohData, rentalSepedaSession.dataSchema!.tabel, rentalSepedaSession.roles!.selected);
console.log('  Issues detected on bad damage values:', badDamageIssues);
assert(
  badDamageIssues.some(i => i.includes('detail_kerusakan') && i.includes('alamat jalan')),
  'FAILED: Validator harus melaporkan alamat jalan pada field detail_kerusakan!'
);
console.log('  ✅ Subtest 4: Validator berhasil menangkap alamat jalan pada field kerusakan fisik!\n');

// -----------------------------------------------------------------------------
// [BUG B2] SUBTEST 5: Field deposit Proporsional & Berskala Rupiah Penuh
// -----------------------------------------------------------------------------
console.log('[Bug B2 - Subtest 5] Uji Skala Nominal: deposit harus berskala Rupiah sebanding');

const depositValues = pemTabel.baris.map(r => Number(r.deposit));
const tagihanValues = pemTabel.baris.map(r => Number(r.total_tagihan));
console.log('  Deposit values:', depositValues);
console.log('  Total tagihan values:', tagihanValues);

for (let i = 0; i < depositValues.length; i++) {
  const dep = depositValues[i];
  const tag = tagihanValues[i];
  assert(
    dep >= 10000,
    `FAILED: Deposit harus berupa angka Rupiah penuh (>= 10.000), bukan nominal terpotong (${dep})!`
  );
  assert(
    dep <= tag * 2 && dep >= tag * 0.1,
    `FAILED: Deposit (${dep}) harus proporsional terhadap total tagihan (${tag})!`
  );
}
console.log('  ✅ Subtest 5: deposit berskala Rupiah penuh (50.000 - 200.000) dan proporsional terhadap tagihan!\n');

// -----------------------------------------------------------------------------
// [BUG B2] SUBTEST 6: Validator Menangkap Anomali Skala Finansial Jomplang
// -----------------------------------------------------------------------------
console.log('[Bug B2 - Subtest 6] Validator menangkap deposit jomplang (15 vs 150.000)');

const badScaleContohData = {
  tabel: [
    {
      nama: 'pemeriksaan_kembali',
      baris: [
        { id: 'PEM-001', sepeda_id: 'SEP-001', detail_kerusakan: 'Rantai kendor', deposit: 15, total_tagihan: 150000 },
        { id: 'PEM-002', sepeda_id: 'SEP-002', detail_kerusakan: 'Rem aus', deposit: 28, total_tagihan: 250000 },
        { id: 'PEM-003', sepeda_id: 'SEP-003', detail_kerusakan: 'Velg oleng', deposit: 45, total_tagihan: 500000 }
      ]
    },
    {
      nama: 'pengguna',
      baris: [
        { id: 'USR-001', nama: 'Admin', peran: 'Super Admin', username: 'admin' },
        { id: 'USR-002', nama: 'Petugas', peran: 'Petugas Rental', username: 'petugas' },
        { id: 'USR-003', nama: 'Pelanggan', peran: 'Pelanggan', username: 'pelanggan' }
      ]
    },
    {
      nama: 'sepeda',
      baris: [
        { id: 'SEP-001', tipe_sepeda: 'Gunung', tarif_per_hari: 100000, status: 'Tersedia' },
        { id: 'SEP-002', tipe_sepeda: 'Lipat', tarif_per_hari: 75000, status: 'Disewa' },
        { id: 'SEP-003', tipe_sepeda: 'Balap', tarif_per_hari: 120000, status: 'Tersedia' }
      ]
    }
  ]
};

const badScaleIssues = validateContohDataVsSchema(badScaleContohData, rentalSepedaSession.dataSchema!.tabel, rentalSepedaSession.roles!.selected);
console.log('  Issues detected on bad scale:', badScaleIssues);
assert(
  badScaleIssues.some(i => i.includes('anomali skala finansial') && i.includes('deposit')),
  'FAILED: Validator harus melaporkan anomali skala finansial antara deposit (15) dan total_tagihan (150000)!'
);
console.log('  ✅ Subtest 6: Validator sukses mendeteksi anomali skala finansial jomplang!\n');

// -----------------------------------------------------------------------------
// SUBTEST 7: Generalisasi Domain Rental Mobil & Servis Elektronik
// -----------------------------------------------------------------------------
console.log('[Subtest 7] Generalisasi: Domain Rental Mobil (kondisi_bodi + uang_muka + total_biaya)');

const rentalMobilSession = {
  step: 'SIMULASI_DB',
  match: {
    templateId: 'rental_mobil',
    overlayIds: [],
    patternIds: [],
    tier: 'BASIC' as const,
    businessCategory: 'Rental Mobil'
  },
  roles: { selected: ['Super Admin', 'Staf Kasir', 'Penyewa'] },
  dataSchema: {
    tabel: [
      {
        nama: 'pengguna',
        keterangan: 'Akun pengguna',
        field: [
          { nama: 'id', tipe: 'text', keterangan: 'ID pengguna' },
          { nama: 'nama', tipe: 'text', keterangan: 'Nama pengguna' },
          { nama: 'peran', tipe: 'text', keterangan: 'Peran pengguna' }
        ]
      },
      {
        nama: 'transaksi_sewa',
        keterangan: 'Transaksi sewa mobil',
        field: [
          { nama: 'id', tipe: 'text', keterangan: 'ID transaksi' },
          { nama: 'kondisi_bodi', tipe: 'text', keterangan: 'Lokasi lecet atau penyok spesifik kendaraan' },
          { nama: 'uang_muka', tipe: 'angka', keterangan: 'Nominal DP sewa' },
          { nama: 'total_biaya', tipe: 'angka', keterangan: 'Total biaya sewa mobil' }
        ]
      }
    ]
  }
} as unknown as MockupSessionState;

const mobilSimulasi = generateDeterministicSimulasiDb(rentalMobilSession);
const trxTabel = mobilSimulasi.contohData.tabel.find(t => t.nama === 'transaksi_sewa');
assert(trxTabel, 'FAILED: tabel transaksi_sewa harus ada!');

const mobilKondisi = trxTabel.baris.map(r => String(r.kondisi_bodi));
const mobilDp = trxTabel.baris.map(r => Number(r.uang_muka));
const mobilTotal = trxTabel.baris.map(r => Number(r.total_biaya));

console.log('  Rental Mobil kondisi_bodi:', mobilKondisi);
console.log('  Rental Mobil uang_muka:', mobilDp);
console.log('  Rental Mobil total_biaya:', mobilTotal);

for (const val of mobilKondisi) {
  assert(!/(?:^jl\.|\bjalan\b)/i.test(val), `FAILED: kondisi_bodi mobil tidak boleh berisi alamat! Dapat: "${val}"`);
  assert(/baret|bumper|lampu|ban|mulus|pemakaian/i.test(val), `FAILED: kondisi_bodi harus deskripsi fisik! Dapat: "${val}"`);
}

for (let i = 0; i < mobilDp.length; i++) {
  assert(mobilDp[i] >= 10000, `FAILED: DP mobil harus nominal penuh! Dapat: ${mobilDp[i]}`);
  assert(mobilTotal[i] >= mobilDp[i], `FAILED: Total biaya sewa mobil harus >= DP!`);
}

console.log('  ✅ Subtest 7: Generalisasi ke domain Rental Mobil bekerja sempurna!\n');

console.log('================================================================');
console.log('🎉 SEMUA SUBTEST TEST SUITE #14 (BUG A & BUG B) LULUS 100%!');
console.log('================================================================');
