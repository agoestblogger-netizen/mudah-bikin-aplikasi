import assert from 'node:assert';
import {
  generateDeterministicSimulasiDb,
  renderSimulasiDbMarkdown,
  validateContohDataVsSchema
} from '../src/lib/templates/processes/guided.js';
import type { MockupSessionState } from '../src/lib/templates/processes/types.js';

console.log('=== TEST POIN 7B: SEMANTIK SIMULASI_DB vs SKEMA (anti-placeholder & anti-kontaminasi) ===\n');

const mk = (tabel: any[]): MockupSessionState =>
  ({
    step: 'SIMULASI_DB',
    match: { patternIds: ['PAT-01'], overlayIds: [], businessCategory: 'X', tier: 'BASIC' },
    roles: { selected: ['Super Admin', 'Kasir'], wajib: ['Super Admin'], tambahan: ['Kasir'] },
    dataSchema: { tabel }
  }) as unknown as MockupSessionState;

const checkNoPlaceholder = (rows: Record<string, any>[], label: string) => {
  for (const row of rows) {
    for (const [k, v] of Object.entries(row)) {
      assert(!/^contoh data/i.test(String(v)), `${label}: field "${k}" masih placeholder "Contoh Data N" (${v})`);
    }
  }
};

// -------------------------------------------------------------
// SKENARIO 1: Toko Es Krim (kasus laporan bug)
// -------------------------------------------------------------
console.log('--- Skenario 1: Toko Es Krim ---');
const esKrim = mk([
  {
    nama: 'produk',
    keterangan: 'Katalog produk es krim',
    field: [
      { nama: 'id_produk', tipe: 'text', keterangan: 'ID unik produk' },
      { nama: 'nama_varian', tipe: 'text', keterangan: 'Nama rasa es krim atau topping' },
      { nama: 'kategori', tipe: 'text', keterangan: 'Jenis item utama atau tambahan' },
      { nama: 'harga', tipe: 'angka', keterangan: 'Harga jual per porsi' },
      { nama: 'status_tersedia', tipe: 'text', keterangan: 'Status aktif atau nonaktif di menu' }
    ]
  }
]);
const simEsKrim = generateDeterministicSimulasiDb(esKrim);
console.log(renderSimulasiDbMarkdown(simEsKrim));
const rasaBaik = ['Vanilla', 'Coklat', 'Strawberry'];
const kategoriBaik = ['Utama', 'Tambahan', 'Topping'];
const statusBaik = ['Aktif', 'Nonaktif'];
for (const row of simEsKrim.contohData.tabel[0].baris) {
  assert(rasaBaik.includes(row.nama_varian), `nama_varian berisi nama orang/placeholder: "${row.nama_varian}"`);
  assert(kategoriBaik.includes(row.kategori), `kategori bukan nilai nyata: "${row.kategori}"`);
  assert(statusBaik.includes(row.status_tersedia), `status_tersedia salah domain: "${row.status_tersedia}"`);
  assert(typeof row.harga === 'number' && row.harga > 0, `harga tidak valid: "${row.harga}"`);
}
const mEs = validateContohDataVsSchema(simEsKrim.contohData, esKrim.dataSchema!.tabel);
console.log('  Validasi kontra-skema:', mEs.length === 0 ? 'BERSIH ✓' : mEs);
assert.strictEqual(mEs.length, 0, `Es krim: masalah = ${mEs.join('; ')}`);
console.log('  ✓ nama_varian=rasa es krim, kategori=Utama/Tambahan/Topping, status_tersedia=Aktif/Nonaktif\n');

// -------------------------------------------------------------
// SKENARIO 2: Rental Mobil (regresi POIN 7)
// -------------------------------------------------------------
console.log('--- Skenario 2: Rental Mobil (armada) ---');
const rentalArmada = mk([
  {
    nama: 'armada_mobil',
    keterangan: 'Katalog kendaraan rental',
    field: [
      { nama: 'id_mobil', tipe: 'text', keterangan: 'ID unik kendaraan' },
      { nama: 'nomor_plat', tipe: 'text', keterangan: 'Nomor plat polisi' },
      { nama: 'tipe_mobil', tipe: 'text', keterangan: 'Model/merk mobil' },
      { nama: 'tarif_sewa_harian', tipe: 'angka', keterangan: 'Tarif sewa per 24 jam' },
      { nama: 'status_ketersediaan', tipe: 'text', keterangan: 'Tersedia / Disewa / Bengkel' }
    ]
  }
]);
const simRental = generateDeterministicSimulasiDb(rentalArmada);
console.log(`  Tabel contoh: ${simRental.contohData.tabel.map((t) => t.nama).join(', ')}`);
for (const row of simRental.contohData.tabel[0].baris) {
  assert(/^(Tersedia|Disewa|Bengkel)$/.test(String(row.status_ketersediaan)), `status_ketersediaan salah: "${row.status_ketersediaan}"`);
  assert(!/selesai|diproses|menunggu verifikasi/i.test(String(row.status_ketersediaan)), 'kontaminasi status transaksi!');
}
checkNoPlaceholder(simRental.contohData.tabel[0].baris, 'Rental-Armada');
assert.strictEqual(validateContohDataVsSchema(simRental.contohData, rentalArmada.dataSchema!.tabel).length, 0);
console.log('  ✓ status_ketersediaan=Tersedia/Disewa/Bengkel (enum dari keterangan)\n');

console.log('--- Skenario 2b: Rental Mobil (transaksi) ---');
const rentalTransaksi = mk([
  {
    nama: 'armada_mobil',
    keterangan: 'Katalog kendaraan rental',
    field: [
      { nama: 'id_mobil', tipe: 'text', keterangan: 'ID unik kendaraan' },
      { nama: 'tipe_mobil', tipe: 'text', keterangan: 'Model/merk mobil' },
      { nama: 'status_ketersediaan', tipe: 'text', keterangan: 'Tersedia / Disewa / Bengkel' }
    ]
  },
  {
    nama: 'transaksi_rental',
    keterangan: 'Penyewaan kendaraan',
    field: [
      { nama: 'no_kontrak', tipe: 'text', keterangan: 'Nomor kontrak sewa' },
      { nama: 'mobil_id', tipe: 'relasi ke armada_mobil', keterangan: 'Mobil yang disewa' },
      { nama: 'nama_penyewa', tipe: 'text', keterangan: 'Nama lengkap pelanggan' },
      { nama: 'durasi_hari', tipe: 'angka', keterangan: 'Jumlah hari sewa' },
      { nama: 'total_bayar', tipe: 'angka', keterangan: 'Total biaya sewa' },
      { nama: 'status_sewa', tipe: 'text', keterangan: 'Status aktif' }
    ]
  }
]);
const simRentalT = generateDeterministicSimulasiDb(rentalTransaksi);
console.log(renderSimulasiDbMarkdown(simRentalT));
for (const row of simRentalT.contohData.tabel[1].baris) {
  assert(/^(Aktif|Nonaktif)$/.test(String(row.status_sewa)), `status_sewa salah domain: "${row.status_sewa}"`);
  assert(!/selesai|diproses|menunggu verifikasi/i.test(String(row.status_sewa)), 'kontaminasi status transaksi!');
}
checkNoPlaceholder(simRentalT.contohData.tabel[1].baris, 'Rental-Transaksi');
assert.strictEqual(validateContohDataVsSchema(simRentalT.contohData, rentalTransaksi.dataSchema!.tabel).length, 0);
console.log('  ✓ status_sewa=Aktif/Nonaktif\n');

// -------------------------------------------------------------
// SKENARIO 3: Koperasi Simpan Pinjam (regresi POIN 7)
// -------------------------------------------------------------
console.log('--- Skenario 3: Koperasi Simpan Pinjam ---');
const koperasi = mk([
  {
    nama: 'anggota',
    keterangan: 'Data anggota koperasi',
    field: [
      { nama: 'id_anggota', tipe: 'text', keterangan: 'ID anggota' },
      { nama: 'nama_anggota', tipe: 'text', keterangan: 'Nama lengkap anggota' }
    ]
  },
  {
    nama: 'transaksi_pinjaman',
    keterangan: 'Pengajuan dan pencairan pinjaman anggota',
    field: [
      { nama: 'id_pinjaman', tipe: 'text', keterangan: 'Kode pinjaman' },
      { nama: 'anggota_id', tipe: 'relasi ke anggota', keterangan: 'ID anggota peminjam' },
      { nama: 'nominal_pinjaman', tipe: 'angka', keterangan: 'Jumlah pinjaman yang dicairkan' },
      { nama: 'tenor_bulan', tipe: 'angka', keterangan: 'Lama angsuran' },
      { nama: 'status_pengajuan', tipe: 'text', keterangan: 'Status persetujuan' }
    ]
  }
]);
const simKoperasi = generateDeterministicSimulasiDb(koperasi);
console.log(renderSimulasiDbMarkdown(simKoperasi));
for (const row of simKoperasi.contohData.tabel[1].baris) {
  assert(/^(Menunggu|Disetujui|Ditolak)$/.test(String(row.status_pengajuan)), `status_pengajuan salah: "${row.status_pengajuan}"`);
  assert(typeof row.nominal_pinjaman === 'number' && row.nominal_pinjaman > 0, 'nominal_pinjaman harus angka > 0');
  assert(typeof row.tenor_bulan === 'number' && row.tenor_bulan > 0, 'tenor_bulan harus angka > 0');
}
checkNoPlaceholder(simKoperasi.contohData.tabel[1].baris, 'Koperasi');
assert.strictEqual(validateContohDataVsSchema(simKoperasi.contohData, koperasi.dataSchema!.tabel).length, 0);
console.log('  ✓ status_pengajuan=Menunggu/Disetujui/Ditolak, nominal & tenor angka\n');

// -------------------------------------------------------------
// SKENARIO 4: Barang Rosok (regresi POIN 7 + enum dari keterangan)
// -------------------------------------------------------------
console.log('--- Skenario 4: Barang Rosok ---');
const rosok = mk([
  {
    nama: 'transaksi_timbang_rosok',
    keterangan: 'Penerimaan dan penimbangan barang bekas',
    field: [
      { nama: 'nomor_nota', tipe: 'text', keterangan: 'Nomor nota setor' },
      { nama: 'nama_warga', tipe: 'text', keterangan: 'Nama warga yang menjual' },
      { nama: 'jenis_rosok', tipe: 'text', keterangan: 'Kategori rosok (besi/kardus/plastik)' },
      { nama: 'berat_kg', tipe: 'angka', keterangan: 'Berat hasil timbang' },
      { nama: 'total_bayar_tunai', tipe: 'angka', keterangan: 'Nominal yang dibayarkan ke warga' }
    ]
  }
]);
const simRosok = generateDeterministicSimulasiDb(rosok);
console.log(renderSimulasiDbMarkdown(simRosok));
for (const row of simRosok.contohData.tabel[0].baris) {
  assert(/^(Besi|Kardus|Plastik)$/.test(String(row.jenis_rosok)), `jenis_rosok tidak dari enum keterangan: "${row.jenis_rosok}"`);
  assert(/^Budi Santoso|Siti Rahma|Ahmad Hidayat$/.test(String(row.nama_warga)), `nama_warga salah: "${row.nama_warga}"`);
}
checkNoPlaceholder(simRosok.contohData.tabel[0].baris, 'Rosok');
assert.strictEqual(validateContohDataVsSchema(simRosok.contohData, rosok.dataSchema!.tabel).length, 0);
console.log('  ✓ jenis_rosok diekstrak dari keterangan "(besi/kardus/plastik)"\n');

// -------------------------------------------------------------
// SKENARIO 5: Warung Sembako (produk generik — cek anti kontaminasi rosok)
// -------------------------------------------------------------
console.log('--- Skenario 5: Warung Sembako (produk generik) ---');
const sembako = mk([
  {
    nama: 'produk_sembako',
    keterangan: 'Stok barang dagangan',
    field: [
      { nama: 'id_produk', tipe: 'text', keterangan: 'ID' },
      { nama: 'nama_produk', tipe: 'text', keterangan: 'Nama produk' },
      { nama: 'kategori', tipe: 'text', keterangan: 'Kelompok kategori barang' },
      { nama: 'harga_beli', tipe: 'angka', keterangan: 'Harga modal' },
      { nama: 'stok', tipe: 'angka', keterangan: 'Jumlah stok tersedia' }
    ]
  }
]);
const simSembako = generateDeterministicSimulasiDb(sembako);
console.log(renderSimulasiDbMarkdown(simSembako));
for (const row of simSembako.contohData.tabel[0].baris) {
  assert(/^Indomie Goreng|Susu Kotak|Kopi Sachet$/.test(String(row.nama_produk)), `nama_produk terkontaminasi rosok: "${row.nama_produk}"`);
  assert(!/Kardus|Besi Tua|Tembaga/i.test(String(row.nama_produk)), `nama_produk memakai nilai rosok: "${row.nama_produk}"`);
}
checkNoPlaceholder(simSembako.contohData.tabel[0].baris, 'Sembako');
assert.strictEqual(validateContohDataVsSchema(simSembako.contohData, sembako.dataSchema!.tabel).length, 0);
console.log('  ✓ tidak ada kontaminasi domain rosok pada produk\n');

console.log('=== SEMUA VERIFIKASI POIN 7B SEMANTIK LULUS 100%! ===');