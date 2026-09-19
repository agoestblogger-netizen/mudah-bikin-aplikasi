import assert from 'node:assert';
import {
  generateDeterministicSimulasiDb,
  validateContohDataVsSchema,
  resolveFormulaTokenValue
} from '../src/lib/templates/processes/guided';
import { MockupSessionState } from '../src/lib/templates/processes/types';

console.log('========================================================================');
console.log('🧪 UNIT TEST: Verifikasi 5 Perbaikan Bug Simulasi Database (Rental Sepeda)');
console.log('========================================================================\n');

// Mock session Rental Sepeda Pantai sesuai transkrip nyata
const mockSessionRentalSepeda: MockupSessionState = {
  step: 'SIMULASI_DB',
  match: {
    businessCategory: 'Rental Sepeda',
    confidenceScore: 0.95,
    overlayIds: []
  },
  roles: {
    selected: ['Super Admin', 'Staf Rental Sepeda'],
    deskripsi: {
      'Super Admin': 'Pemilik usaha rental sepeda',
      'Staf Rental Sepeda': 'Staf operasional rental sepeda'
    }
  },
  formulas: {
    daftar: [
      {
        namaField: 'total_biaya',
        labelField: 'Total Biaya',
        targetTable: 'transaksi_sewa',
        formulaExpression: 'durasi_jam * tarif_per_jam + denda_keterlambatan',
        komponenInput: ['durasi_jam', 'tarif_per_jam', 'denda_keterlambatan'],
        deskripsi: 'Total biaya sewa dihitung dari durasi dikali tarif per jam ditambah denda keterlambatan'
      },
      {
        namaField: 'sisa_tagihan',
        labelField: 'Sisa Tagihan',
        targetTable: 'transaksi_sewa',
        formulaExpression: 'total_biaya - deposit',
        komponenInput: ['total_biaya', 'deposit'],
        deskripsi: 'Sisa tagihan setelah dikurangi deposit jaminan'
      }
    ]
  },
  dataSchema: {
    tabel: [
      {
        nama: 'pelanggan',
        keterangan: 'Menyimpan data identitas pelanggan penyewa sepeda',
        field: [
          { nama: 'id', tipe: 'text', keterangan: 'ID Pelanggan' },
          { nama: 'nama_pelanggan', tipe: 'text', keterangan: 'Nama lengkap pelanggan' },
          { nama: 'kontak', tipe: 'text', keterangan: 'Kontak telepon atau alamat email' },
          { nama: 'alamat', tipe: 'text', keterangan: 'Alamat tempat tinggal' }
        ]
      },
      {
        nama: 'katalog_sepeda',
        keterangan: 'Daftar armada unit sepeda yang disewakan',
        field: [
          { nama: 'id', tipe: 'text', keterangan: 'ID Sepeda' },
          { nama: 'nama_sepeda', tipe: 'text', keterangan: 'Label sepeda' },
          { nama: 'tarif_per_jam', tipe: 'angka', keterangan: 'Tarif sewa per jam (Rp)' },
          { nama: 'status_ketersediaan', tipe: 'text', keterangan: 'Pilihan: Tersedia / Disewa / Perawatan' }
        ]
      },
      {
        nama: 'transaksi_sewa',
        keterangan: 'Data transaksi penyewaan sepeda',
        field: [
          { nama: 'id', tipe: 'text', keterangan: 'ID Transaksi' },
          { nama: 'nomor_transaksi', tipe: 'text', keterangan: 'Kode transaksi sewa' },
          { nama: 'pelanggan_id', tipe: 'relasi ke pelanggan', keterangan: 'Pelanggan penyewa' },
          { nama: 'sepeda_id', tipe: 'relasi ke katalog_sepeda', keterangan: 'Sepeda yang disewa' },
          { nama: 'durasi_jam', tipe: 'angka', keterangan: 'Lama sewa dalam jam' },
          { nama: 'denda_keterlambatan', tipe: 'angka', keterangan: 'Denda jika terlambat kembali' },
          {
            nama: 'total_biaya',
            tipe: 'angka',
            keterangan: 'Total biaya sewa',
            isFormula: true,
            formulaExpression: 'durasi_jam * tarif_per_jam + denda_keterlambatan'
          },
          { nama: 'deposit', tipe: 'angka', keterangan: 'Uang deposit jaminan' },
          {
            nama: 'sisa_tagihan',
            tipe: 'angka',
            keterangan: 'Sisa tagihan yang harus dilunasi',
            isFormula: true,
            formulaExpression: 'total_biaya - deposit'
          },
          { nama: 'kondisi_saat_ambil', tipe: 'text', keterangan: 'Kondisi sepeda saat diambil (opsional, untuk audit)' },
          { nama: 'kondisi_saat_kembali', tipe: 'text', keterangan: 'Kondisi sepeda saat dikembalikan (opsional, untuk audit)' }
        ]
      },
      {
        nama: 'pengguna',
        keterangan: 'Menyimpan akun pengguna sistem',
        field: [
          { nama: 'id', tipe: 'text', keterangan: 'ID Pengguna' },
          { nama: 'nama_lengkap', tipe: 'text', keterangan: 'Nama lengkap' },
          { nama: 'peran', tipe: 'text', keterangan: 'Hak akses peran' },
          { nama: 'username', tipe: 'text', keterangan: 'Username' }
        ]
      }
    ]
  }
};

// Jalankan simulasi DB deterministik
const simDb = generateDeterministicSimulasiDb(mockSessionRentalSepeda);
const tables = simDb.contohData.tabel;

// -----------------------------------------------------------------------------
// TEST BUG 1: Placeholder/Label Field Leaking Jadi Value Data
// -----------------------------------------------------------------------------
console.log('👉 [Test 1] Cek Leaking Label/Keterangan pada Field Data...');
const katTable = tables.find(t => t.nama === 'katalog_sepeda')!;
const trxTable = tables.find(t => t.nama === 'transaksi_sewa')!;

// 1. nama_sepeda tidak boleh "Nama" atau "Label sepeda"
const namaSepedaVals = katTable.baris.map(r => r.nama_sepeda);
console.log('   nama_sepeda:', namaSepedaVals);
namaSepedaVals.forEach(v => {
  assert(!/^(nama|label sepeda|unit)$/i.test(String(v)), `nama_sepeda tidak boleh berupa label/placeholder: ${v}`);
  assert(/polygon|united|pacific/i.test(String(v)), `nama_sepeda harus nama sepeda realistis: ${v}`);
});

// 2. nomor_transaksi tidak boleh "Nomor" atau "Kode transaksi sewa"
const noTrxVals = trxTable.baris.map(r => r.nomor_transaksi);
console.log('   nomor_transaksi:', noTrxVals);
noTrxVals.forEach(v => {
  assert(!/^(nomor|kode|kode transaksi sewa)$/i.test(String(v)), `nomor_transaksi tidak boleh berupa label: ${v}`);
  assert(/^TRX-/i.test(String(v)), `nomor_transaksi harus format kode TRX-*: ${v}`);
});

// 3. kondisi_saat_ambil & kembali tidak boleh "Opsional" atau "Untuk audit"
const kondisiAmbilVals = trxTable.baris.map(r => r.kondisi_saat_ambil);
const kondisiKembaliVals = trxTable.baris.map(r => r.kondisi_saat_kembali);
console.log('   kondisi_saat_ambil:', kondisiAmbilVals);
console.log('   kondisi_saat_kembali:', kondisiKembaliVals);
[...kondisiAmbilVals, ...kondisiKembaliVals].forEach(v => {
  assert(!/^(opsional|untuk audit)$/i.test(String(v)), `kondisi tidak boleh potongan keterangan: ${v}`);
  assert(!/alamat|jl\./i.test(String(v)), `kondisi tidak boleh alamat: ${v}`);
  assert(String(v).length > 5, `kondisi harus deskripsi kondisi nyata: ${v}`);
});
console.log('   ✅ Test 1 Lolos: Bebas dari leaking label/keterangan.\n');

// -----------------------------------------------------------------------------
// TEST BUG 2: Kontak Pelanggan vs Alamat
// -----------------------------------------------------------------------------
console.log('👉 [Test 2] Cek Kontak Pelanggan Bebas dari Duplikasi Alamat...');
const pelTable = tables.find(t => t.nama === 'pelanggan')!;
pelTable.baris.forEach((r, idx) => {
  console.log(`   Baris ${idx + 1}: kontak="${r.kontak}", alamat="${r.alamat}"`);
  assert(!/^(jl\.|jalan)/i.test(String(r.kontak)), `kontak TIDAK BOLEH berisi alamat jalan: ${r.kontak}`);
  assert(/^(08\d{8,11}|.*@.*)/.test(String(r.kontak)), `kontak harus nomor HP atau email: ${r.kontak}`);
  assert(r.kontak !== r.alamat, `kontak tidak boleh bernilai identik dengan alamat!`);
});
console.log('   ✅ Test 2 Lolos: Kontak berupa nomor telepon/email, bukan alamat jalan.\n');

// -----------------------------------------------------------------------------
// TEST BUG 3: [KRITIS] total_biaya & sisa_tagihan Mengikuti Formula Matematis
// -----------------------------------------------------------------------------
console.log('👉 [Test 3] Cek Presisi Matematis Formula total_biaya & sisa_tagihan...');
trxTable.baris.forEach((r, idx) => {
  const durasi = Number(r.durasi_jam);
  const denda = Number(r.denda_keterlambatan);
  const deposit = Number(r.deposit);
  const sepedaId = String(r.sepeda_id);

  // Ambil tarif_per_jam dari katalog_sepeda terkait
  const sepedaRow = katTable.baris.find(kr => kr.id === sepedaId);
  assert(sepedaRow, `Sepeda dengan ID ${sepedaId} harus ada di katalog_sepeda`);
  const tarif = Number(sepedaRow.tarif_per_jam);

  const expectedTotal = durasi * tarif + denda;
  const expectedSisa = expectedTotal - deposit;

  console.log(`   Baris ${idx + 1}: durasi=${durasi}, tarif=${tarif}, denda=${denda}`);
  console.log(`            total_biaya aktual=${r.total_biaya}, ekspetasi=${expectedTotal}`);
  console.log(`            deposit=${deposit}, sisa_tagihan aktual=${r.sisa_tagihan}, ekspetasi=${expectedSisa}`);

  assert.strictEqual(
    Number(r.total_biaya),
    expectedTotal,
    `total_biaya baris ${idx + 1} HARUS matematis presisi (${durasi} * ${tarif} + ${denda} = ${expectedTotal}), bukan ${r.total_biaya}`
  );
  assert.strictEqual(
    Number(r.sisa_tagihan),
    expectedSisa,
    `sisa_tagihan baris ${idx + 1} HARUS matematis presisi (${expectedTotal} - ${deposit} = ${expectedSisa}), bukan ${r.sisa_tagihan}`
  );
});
console.log('   ✅ Test 3 Lolos: Formula total_biaya dan sisa_tagihan 100% presisi matematis lintas FK!\n');

// -----------------------------------------------------------------------------
// TEST BUG 4: Skema Bersih Tanpa Field Siluman (jumlah_bayar & metode_pembayaran)
// -----------------------------------------------------------------------------
console.log('👉 [Test 4] Cek Skema Data Tidak Memiliki Kolom Siluman...');
const trxFieldNames = trxTable.field.map(f => f.nama);
console.log('   Field di transaksi_sewa:', trxFieldNames);
assert(!trxFieldNames.includes('jumlah_bayar'), 'jumlah_bayar TIDAK BOLEH disuntikkan diam-diam jika tidak disetujui');
assert(!trxFieldNames.includes('metode_pembayaran'), 'metode_pembayaran TIDAK BOLEH disuntikkan diam-diam jika tidak disetujui');
console.log('   ✅ Test 4 Lolos: Tidak ada field baru yang muncul diam-diam.\n');

// -----------------------------------------------------------------------------
// TEST BUG 5: Akun Demo Tidak Duplikat & Label Peran Cocok Persis
// -----------------------------------------------------------------------------
console.log('👉 [Test 5] Cek Akun Demo & Tabel Pengguna Bebas Duplikasi...');
console.log('   akunLogin:', simDb.akunLogin);
const userTable = tables.find(t => t.nama === 'pengguna')!;
console.log('   baris tabel pengguna:', userTable.baris);

// Cek label peran dalam kurung harus persis "Super Admin" atau "Staf Rental Sepeda"
simDb.akunLogin.forEach(acc => {
  assert(
    acc.nama.endsWith(`(${acc.role})`),
    `Nama akun demo (${acc.nama}) harus diakhiri (${acc.role}) persis nama role yang dipilih!`
  );
});

// Cek tabel pengguna: Super Admin HANYA muncul 1 kali
const superAdminRows = userTable.baris.filter(r => r.peran === 'Super Admin');
console.log('   Jumlah akun Super Admin di tabel pengguna:', superAdminRows.length);
assert.strictEqual(superAdminRows.length, 1, 'Super Admin TIDAK BOLEH muncul dua kali di tabel pengguna!');

// Cek nama pengguna baris 1 dan baris 3 tidak boleh sama
assert.notStrictEqual(
  userTable.baris[0].nama_lengkap,
  userTable.baris[2].nama_lengkap,
  'Baris 1 dan Baris 3 tabel pengguna tidak boleh orang yang sama!'
);
console.log('   ✅ Test 5 Lolos: Super Admin tidak terduplikasi, label peran persis sesuai pilihan user.\n');

console.log('========================================================================');
console.log('🎉 SEMUA 5 PENGUJIAN PERBAIKAN SIMULASI DB LOLOS 100%');
console.log('========================================================================');
