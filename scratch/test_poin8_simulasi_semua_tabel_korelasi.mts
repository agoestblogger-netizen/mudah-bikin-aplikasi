import assert from 'node:assert';
import {
  generateDeterministicSimulasiDb,
  renderSimulasiDbMarkdown,
  validateContohDataVsSchema
} from '../src/lib/templates/processes/guided.js';
import type { MockupSessionState } from '../src/lib/templates/processes/types.js';

console.log('=== TEST POIN 8: SEMUA TABEL TAMPIL + KORELASI FK VALID ===\n');

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

// Cek setiap field relasi punya nilai yang benar-benar ada di tabel tujuan
const tabelSumberIds = (tabelBaris: Record<string, any>[], idField: string): Set<string> =>
  new Set(tabelBaris.map((r) => String(r[idField] ?? '').trim()).filter(Boolean));

function assertSemuaTabelDanFKValid(sim: MockupSessionState['simulasiDb'] & Record<string, any>, schema: any[], label: string) {
  const contohTables = sim.contohData.tabel;
  assert(
    contohTables.length === schema.length,
    `${label}: semua tabel harus tampil (skema ${schema.length}, contoh ${contohTables.length})`
  );
  console.log(`  ✓ ${label}: ${contohTables.length} tabel tampil [${contohTables.map((t) => t.nama).join(', ')}]`);

  for (const t of contohTables) {
    const sc = schema.find((s) => s.nama === t.nama);
    assert(sc, `${label}: tabel contoh "${t.nama}" harus ada di skema`);
    const keys = Object.keys(t.baris[0]);
    const schemaNames = sc.field.map((f: any) => f.nama);
    assert.deepStrictEqual(
      keys,
      schemaNames,
      `${label}: field ${t.nama} [${keys.join(', ')}] != skema [${schemaNames.join(', ')}]`
    );
    checkNoPlaceholder(t.baris, `${label}-${t.nama}`);
  }

  // FK integrity
  for (const t of schema) {
    const contoh = contohTables.find((c) => c.nama === t.nama)!;
    for (const f of t.field) {
      const fType = (f.tipe || '').toLowerCase();
      const ownPk = t.field.find((x: any) => x.nama === 'id' || /^id_/.test(x.nama))?.nama;
      const isRel = fType.includes('relasi ke') || f.nama.toLowerCase().endsWith('_id') || /^id_/.test(f.nama);
      if (!isRel || f.nama === ownPk) continue;

      const raw = fType.match(/relasi ke\s+([a-zA-Z0-9_]+)/i)?.[1] || f.nama.replace(/_(id|fk)$/i, '');
      const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
      const target = contohTables.find((c) => {
        const cn = norm(c.nama);
        const rn = norm(raw);
        return cn.includes(rn) || rn.includes(cn);
      });
      assert(target, `${label}: relasi ${t.nama}.${f.nama} tidak menemukan tabel tujuan (${raw})`);
      const idField = target!.field?.find((x: any) => x.nama === 'id' || /^id_/.test(x.nama))?.nama || 'id';
      const ids = tabelSumberIds(target!.baris, idField);
      assert(ids.size > 0, `${label}: tabel tujuan "${target!.nama}" kolom "${idField}" kosong`);
      for (const row of contoh.baris) {
        const v = String(row[f.nama] ?? '').trim();
        assert(v && ids.has(v), `${label}: ${t.nama}.${f.nama}="${v}" tidak ada di ${target!.nama}.${idField}`);
      }
      console.log(`  ✓ ${t.nama}.${f.nama} → ${target!.nama}.${idField} (FK valid, ${ids.size} id referensi)`);
    }
  }

  const masalah = validateContohDataVsSchema(sim.contohData, schema);
  assert.strictEqual(masalah.length, 0, `${label}: validasi kontra-skema gagal: ${masalah.join('; ')}`);
  console.log('  ✓ Validasi kontra-skema (placeholder/status/FK): BERSIH\n');
}

// -------------------------------------------------------------
// SKENARIO A: Toko Es Krim (5 tabel: pengguna, pelanggan, produk, transaksi, stok_harian)
// -------------------------------------------------------------
console.log('--- Skenario A: Toko Es Krim (5 tabel) ---');
const esKrim = mk([
  {
    nama: 'pengguna',
    keterangan: 'Akun staf internal',
    field: [
      { nama: 'id_pengguna', tipe: 'text', keterangan: 'ID unik staf' },
      { nama: 'nama_lengkap', tipe: 'text', keterangan: 'Nama lengkap staf' },
      { nama: 'email', tipe: 'text', keterangan: 'Email login staf' },
      { nama: 'role_akses', tipe: 'text', keterangan: 'Level akses staf' }
    ]
  },
  {
    nama: 'pelanggan',
    keterangan: 'Data pelanggan',
    field: [
      { nama: 'id_pelanggan', tipe: 'text', keterangan: 'ID unik pelanggan' },
      { nama: 'nama_pelanggan', tipe: 'text', keterangan: 'Nama lengkap pelanggan' },
      { nama: 'no_hp', tipe: 'text', keterangan: 'Nomor whatsapp' },
      { nama: 'alamat', tipe: 'text', keterangan: 'Alamat rumah' }
    ]
  },
  {
    nama: 'produk',
    keterangan: 'Katalog es krim',
    field: [
      { nama: 'id_produk', tipe: 'text', keterangan: 'ID unik produk' },
      { nama: 'nama_varian', tipe: 'text', keterangan: 'Nama rasa es krim atau topping' },
      { nama: 'kategori', tipe: 'text', keterangan: 'Jenis item utama atau tambahan' },
      { nama: 'harga', tipe: 'angka', keterangan: 'Harga jual per porsi' },
      { nama: 'status_tersedia', tipe: 'text', keterangan: 'Status aktif atau nonaktif di menu' }
    ]
  },
  {
    nama: 'transaksi',
    keterangan: 'Penjualan harian',
    field: [
      { nama: 'id_transaksi', tipe: 'text', keterangan: 'ID unik transaksi' },
      { nama: 'tanggal', tipe: 'tanggal', keterangan: 'Waktu transaksi' },
      { nama: 'pelanggan_id', tipe: 'relasi ke pelanggan', keterangan: 'Pelanggan pembeli' },
      { nama: 'pengguna_id', tipe: 'relasi ke pengguna', keterangan: 'Kasir yang melayani' },
      { nama: 'produk_id', tipe: 'relasi ke produk', keterangan: 'Produk yang dibeli' },
      { nama: 'qty', tipe: 'angka', keterangan: 'Jumlah porsi' },
      { nama: 'total_harga', tipe: 'angka', keterangan: 'Total pembayaran' }
    ]
  },
  {
    nama: 'stok_harian',
    keterangan: 'Stok per hari per produk',
    field: [
      { nama: 'id_stok', tipe: 'text', keterangan: 'ID unik catatan stok' },
      { nama: 'tanggal', tipe: 'tanggal', keterangan: 'Hari pencatatan' },
      { nama: 'produk_id', tipe: 'relasi ke produk', keterangan: 'Produk yang dicatat' },
      { nama: 'stok_awal', tipe: 'angka', keterangan: 'Stok awal hari' },
      { nama: 'terjual', tipe: 'angka', keterangan: 'Jumlah terjual' }
    ]
  }
]);
const simEsKrim = generateDeterministicSimulasiDb(esKrim);
console.log(renderSimulasiDbMarkdown(simEsKrim));
assertSemuaTabelDanFKValid(simEsKrim, esKrim.dataSchema!.tabel, 'Es Krim');

// Cek markdown memuat seluruh tabel + catatan korelasi
const mdEsKrim = renderSimulasiDbMarkdown(simEsKrim);
for (const name of ['pengguna', 'pelanggan', 'produk', 'transaksi', 'stok_harian']) {
  assert(mdEsKrim.includes(`\\\`${name}\\\``) || mdEsKrim.includes(`\`${name}\``), `markdown harus memuat tabel ${name}`);
}
assert(
  mdEsKrim.includes('`pelanggan_id → pelanggan.id_pelanggan`') &&
    mdEsKrim.includes('`produk_id → produk.id_produk`'),
  'markdown harus berisi catatan korelasi FK per tabel'
);
console.log('  ✓ Markdown memuat 5 tabel + catatan korelasi FK\n');

// -------------------------------------------------------------
// SKENARIO B: Rental Mobil (armada_mobil + transaksi_rental)
// -------------------------------------------------------------
console.log('--- Skenario B: Rental Mobil (2 tabel) ---');
const rental = mk([
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
const simRental = generateDeterministicSimulasiDb(rental);
console.log(renderSimulasiDbMarkdown(simRental));
assertSemuaTabelDanFKValid(simRental, rental.dataSchema!.tabel, 'Rental');

// -------------------------------------------------------------
// SKENARIO C: Koperasi Simpan Pinjam (anggota + simpanan + transaksi_pinjaman)
// -------------------------------------------------------------
console.log('--- Skenario C: Koperasi Simpan Pinjam (3 tabel) ---');
const koperasi = mk([
  {
    nama: 'anggota',
    keterangan: 'Data anggota',
    field: [
      { nama: 'id_anggota', tipe: 'text', keterangan: 'ID anggota' },
      { nama: 'nama_anggota', tipe: 'text', keterangan: 'Nama lengkap anggota' },
      { nama: 'no_hp', tipe: 'text', keterangan: 'Nomor kontak' }
    ]
  },
  {
    nama: 'simpanan',
    keterangan: 'Simpanan wajib & sukarela',
    field: [
      { nama: 'id_simpanan', tipe: 'text', keterangan: 'ID catatan simpanan' },
      { nama: 'anggota_id', tipe: 'relasi ke anggota', keterangan: 'Anggota penyimpan' },
      { nama: 'nominal_simpanan', tipe: 'angka', keterangan: 'Nominal disetor' },
      { nama: 'tanggal_setor', tipe: 'tanggal', keterangan: 'Tanggal setor' }
    ]
  },
  {
    nama: 'transaksi_pinjaman',
    keterangan: 'Pengajuan dan pencairan pinjaman',
    field: [
      { nama: 'id_pinjaman', tipe: 'text', keterangan: 'Kode pinjaman' },
      { nama: 'anggota_id', tipe: 'relasi ke anggota', keterangan: 'ID anggota peminjam' },
      { nama: 'nominal_pinjaman', tipe: 'angka', keterangan: 'Jumlah pinjaman dicairkan' },
      { nama: 'tenor_bulan', tipe: 'angka', keterangan: 'Lama angsuran' },
      { nama: 'status_pengajuan', tipe: 'text', keterangan: 'Status persetujuan' }
    ]
  }
]);
const simKoperasi = generateDeterministicSimulasiDb(koperasi);
console.log(renderSimulasiDbMarkdown(simKoperasi));
assertSemuaTabelDanFKValid(simKoperasi, koperasi.dataSchema!.tabel, 'Koperasi');

console.log('=== SEMUA VERIFIKASI POIN 8 LULUS 100%! ===');