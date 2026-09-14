import assert from 'node:assert';
import {
  generateDeterministicSimulasiDb,
  renderSimulasiDbMarkdown,
  validateContohDataVsSchema
} from '../src/lib/templates/processes/guided.js';
import {
  generateSimulasiDbHybrid,
  aiIsiNilaiSimulasiDb,
  type AiIsiNilaiSimulasiCaller
} from '../src/app/api/guided/route.js';
import type { MockupSessionState } from '../src/lib/templates/processes/types.js';

console.log('=== TEST POIN 9: HYBRID AI UNTUK PENGISIAN NILAI SIMULASI_DB ===\n');

const mk = (tabel: any[]): MockupSessionState =>
  ({
    step: 'SIMULASI_DB',
    match: { patternIds: ['PAT-01'], overlayIds: [], businessCategory: 'X', tier: 'BASIC' },
    roles: { selected: ['Super Admin', 'Kasir'], wajib: ['Super Admin'], tambahan: ['Kasir'] },
    dataSchema: { tabel }
  }) as unknown as MockupSessionState;

const callerNull: AiIsiNilaiSimulasiCaller = async () => null;
const callerThrow: AiIsiNilaiSimulasiCaller = async () => {
  throw new Error('simulasi rate limit');
};
const callerJSON = (payload: string): AiIsiNilaiSimulasiCaller => async () => payload;

const cekStrukturDanValidasi = (sim: any, schema: any[], label: string) => {
  assert(sim && sim.contohData, `${label}: contohData kosong`);
  const contohNames = sim.contohData.tabel.map((t: any) => t.nama);
  const schemaNames = schema.map((s) => s.nama);
  assert.deepStrictEqual(
    contohNames,
    schemaNames,
    `${label}: tabel contoh [${contohNames.join(', ')}] != skema [${schemaNames.join(', ')}]`
  );
  const masalah = validateContohDataVsSchema(sim.contohData, schema);
  assert.strictEqual(masalah.length, 0, `${label}: hasil AI tidak lolos validasi: ${masalah.join('; ')}`);
  return sim;
};

// -------------------------------------------------------------
// PART 1: RE-TEST 6 DOMAIN (AI call GAGAL -> fallback kamus)
// -------------------------------------------------------------
console.log('--- PART 1: 6 domain (fallback kamus saat AI gagal) ---');
const domain6: { name: string; schema: any[] }[] = [
  {
    name: 'Toko Es Krim',
    schema: [
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
      }
    ]
  },
  {
    name: 'Rental Armada',
    schema: [
      {
        nama: 'armada_mobil',
        keterangan: 'Katalog kendaraan rental',
        field: [
          { nama: 'id_mobil', tipe: 'text', keterangan: 'ID unik kendaraan' },
          { nama: 'tipe_mobil', tipe: 'text', keterangan: 'Model/merk mobil' },
          { nama: 'status_ketersediaan', tipe: 'text', keterangan: 'Tersedia / Disewa / Bengkel' }
        ]
      }
    ]
  },
  {
    name: 'Rental Transaksi',
    schema: [
      {
        nama: 'armada_mobil',
        keterangan: 'Katalog kendaraan',
        field: [
          { nama: 'id_mobil', tipe: 'text', keterangan: 'ID unik kendaraan' },
          { nama: 'tipe_mobil', tipe: 'text', keterangan: 'Model/merk mobil' }
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
    ]
  },
  {
    name: 'Koperasi',
    schema: [
      {
        nama: 'anggota',
        keterangan: 'Data anggota',
        field: [{ nama: 'id_anggota', tipe: 'text', keterangan: 'ID anggota' }, { nama: 'nama_anggota', tipe: 'text', keterangan: 'Nama lengkap anggota' }]
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
    ]
  },
  {
    name: 'Barang Rosok',
    schema: [
      {
        nama: 'transaksi_timbang_rosok',
        keterangan: 'Penerimaan dan penimbangan barang bekas',
        field: [
          { nama: 'nomor_nota', tipe: 'text', keterangan: 'Nomor nota setor' },
          { nama: 'nama_warga', tipe: 'text', keterangan: 'Nama lengkap warga penyetor' },
          { nama: 'jenis_rosok', tipe: 'text', keterangan: '(Besi / Kardus / Plastik)' },
          { nama: 'berat_kg', tipe: 'angka', keterangan: 'Berat setoran' },
          { nama: 'total_harga', tipe: 'angka', keterangan: 'Total nilai setoran' }
        ]
      }
    ]
  },
  {
    name: 'Warung Sembako',
    schema: [
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
    ]
  }
];
for (const d of domain6) {
  const r = await generateSimulasiDbHybrid(mk(d.schema), { caller: callerNull });
  assert.strictEqual(r.sumber, 'kamus', `${d.name}: harus jatuh ke kamus`);
  cekStrukturDanValidasi(r.simulasiDb, d.schema, d.name);
  assert(renderSimulasiDbMarkdown(r.simulasiDb).includes(r.simulasiDb.contohData.tabel[0].nama), `${d.name}: markdown kosong`);
  const baris = r.simulasiDb.contohData.tabel[0].baris;
  for (const row of baris)
    for (const v of Object.values(row))
      assert(!/^contoh data/i.test(String(v)), `${d.name}: placeholder tertinggal: "${v}"`);
  console.log(`  ✓ ${d.name}: sumber=kamus, ${r.simulasiDb.contohData.tabel.length} tabel, validasi BERSIH`);
}

// -------------------------------------------------------------
// PART 2: 3 DOMAIN BARU DI LUAR KAMUS — AI berhasil mengisi nilai
// -------------------------------------------------------------
console.log('\n--- PART 2: 3 domain BARU di luar kamus (AI mengisi konten) ---');
const butik = mk([
  {
    nama: 'produk_pakaian',
    keterangan: 'Katalog pakaian butik',
    field: [
      { nama: 'id_produk', tipe: 'text', keterangan: 'ID unik produk' },
      { nama: 'nama_produk', tipe: 'text', keterangan: 'Nama model pakaian' },
      { nama: 'warna', tipe: 'text', keterangan: 'Warna produk' },
      { nama: 'ukuran', tipe: 'text', keterangan: 'Ukuran baju' },
      { nama: 'bahan', tipe: 'text', keterangan: 'Jenis bahan kain' },
      { nama: 'harga_konsumen', tipe: 'angka', keterangan: 'Harga jual konsumen' },
      { nama: 'stok', tipe: 'angka', keterangan: 'Jumlah stok' }
    ]
  }
]);
const butikPayload = {
  nilai: {
    produk_pakaian: {
      nama_produk: ['Kemeja Polos Slim Fit', 'Jaket Denim Oversize', 'Cardigan Wol Premium'],
      warna: ['Navy', 'Putih', 'Salmon'],
      ukuran: ['L', 'XL', 'M'],
      bahan: ['Katun premium', 'Denim tebal', 'Wol merino'],
      harga_konsumen: [120000, 229000, 349000],
      stok: [8, 15, 4]
    }
  }
};
const rButik = await generateSimulasiDbHybrid(butik, { caller: callerJSON(JSON.stringify(butikPayload)) });
assert.strictEqual(rButik.sumber, 'ai', 'Butik: harus sumber=ai');
cekStrukturDanValidasi(rButik.simulasiDb, butik.dataSchema!.tabel, 'Butik');
const bRow = rButik.simulasiDb.contohData.tabel[0].baris;
for (let i = 0; i < 3; i++) {
  assert.strictEqual(bRow[i].warna, ['Navy', 'Putih', 'Salmon'][i], `warna AI baris ${i}`);
  assert.strictEqual(bRow[i].ukuran, ['L', 'XL', 'M'][i], `ukuran AI baris ${i}`);
  assert.strictEqual(bRow[i].bahan, ['Katun premium', 'Denim tebal', 'Wol merino'][i], `bahan AI baris ${i}`);
  assert.strictEqual(bRow[i].harga_konsumen, [120000, 229000, 349000][i], `harga AI baris ${i}`);
}
console.log('  ✓ Butik: warna/ukuran/bahan/harga dari AI (di luar kamus) dipakai & valid');

const storeCat = mk([
  {
    nama: 'cat',
    keterangan: 'Katalog cat tembok',
    field: [
      { nama: 'id_cat', tipe: 'text', keterangan: 'ID unik warna cat' },
      { nama: 'nama_warna_cat', tipe: 'text', keterangan: 'Nama warna cat' },
      { nama: 'jenis_finish', tipe: 'text', keterangan: 'Jenis hasil akhir cat' },
      { nama: 'liter', tipe: 'angka', keterangan: 'Isi kemasan' },
      { nama: 'harga_per_liter', tipe: 'angka', keterangan: 'Harga per liter' }
    ]
  }
]);
const catPayload = {
  nilai: {
    cat: {
      nama_warna_cat: ['Sunset Orange', 'Deep Teal', 'Ivory White'],
      jenis_finish: ['Dop', 'Matte lembut', 'Semi Gloss'],
      liter: [5, 1, 2.5],
      harga_per_liter: [85000, 92000, 78000]
    }
  }
};
const rCat = await generateSimulasiDbHybrid(storeCat, { caller: callerJSON(JSON.stringify(catPayload)) });
assert.strictEqual(rCat.sumber, 'ai', 'Cat: harus sumber=ai');
cekStrukturDanValidasi(rCat.simulasiDb, storeCat.dataSchema!.tabel, 'Toko Cat');
const cRow = rCat.simulasiDb.contohData.tabel[0].baris;
for (let i = 0; i < 3; i++) {
  assert.strictEqual(cRow[i].nama_warna_cat, ['Sunset Orange', 'Deep Teal', 'Ivory White'][i], `warna cat AI baris ${i}`);
  assert.strictEqual(cRow[i].jenis_finish, ['Dop', 'Matte lembut', 'Semi Gloss'][i], `finish AI baris ${i}`);
  assert.strictEqual(cRow[i].harga_per_liter, [85000, 92000, 78000][i], `harga cat AI baris ${i}`);
}
console.log('  ✓ Toko Cat: warna/finish/harga dari AI dipakai & valid');

const klinik = mk([
  {
    nama: 'pasien',
    keterangan: 'Data pasien',
    field: [
      { nama: 'id_pasien', tipe: 'text', keterangan: 'ID unik pasien' },
      { nama: 'nama_pasien', tipe: 'text', keterangan: 'Nama lengkap pasien' },
      { nama: 'gol_darah', tipe: 'text', keterangan: 'Golongan darah' },
      { nama: 'alergi', tipe: 'text', keterangan: 'Riwayat alergi obat' },
      { nama: 'no_telp', tipe: 'text', keterangan: 'Nomor telepon' }
    ]
  },
  {
    nama: 'jadwal_kontrol',
    keterangan: 'Janji kontrol pasien',
    field: [
      { nama: 'id_jadwal', tipe: 'text', keterangan: 'ID unik jadwal' },
      { nama: 'pasien_id', tipe: 'relasi ke pasien', keterangan: 'Pasien terkait' },
      { nama: 'tanggal', tipe: 'tanggal', keterangan: 'Tanggal kontrol' },
      { nama: 'keluhan_utama', tipe: 'text', keterangan: 'Keluhan utama pasien' }
    ]
  }
]);
const klinikPayload = {
  nilai: {
    pasien: {
      nama_pasien: ['Dewi Lestari', 'Rudi Hartono', 'Maya Sari'],
      gol_darah: ['O', 'A', 'B'],
      alergi: ['Tidak ada', 'Penisilin', 'Lateks'],
      no_telp: ['081321456789', '085611223344', '087812345678']
    },
    jadwal_kontrol: {
      tanggal: ['2026-09-10', '2026-09-11', '2026-09-12'],
      keluhan_utama: ['Nyeri geraham kiri', 'Sakit gigi setelah makan', 'Gusi berdarah']
    }
  }
};
const rKlinik = await generateSimulasiDbHybrid(klinik, { caller: callerJSON(JSON.stringify(klinikPayload)) });
assert.strictEqual(rKlinik.sumber, 'ai', 'Klinik: harus sumber=ai');
cekStrukturDanValidasi(rKlinik.simulasiDb, klinik.dataSchema!.tabel, 'Klinik Gigi');
// Integritas relasi: pasien_id harus merujuk id_pasien yang ada di tabel pasien (dibangun deterministik)
const pasienIds = rKlinik.simulasiDb.contohData.tabel.find((t: any) => t.nama === 'pasien')!.baris.map((r: any) => r.id_pasien);
const jadwalRows = rKlinik.simulasiDb.contohData.tabel.find((t: any) => t.nama === 'jadwal_kontrol')!.baris;
for (const row of jadwalRows) assert(pasienIds.includes(String(row.pasien_id)), `pasien_id ${row.pasien_id} tidak valid`);
const gRow = rKlinik.simulasiDb.contohData.tabel[0].baris;
for (let i = 0; i < 3; i++) assert.strictEqual(gRow[i].gol_darah, ['O', 'A', 'B'][i], `gol_darah AI baris ${i}`);
console.log('  ✓ Klinik: gol_darah/alergi/jadwal dari AI, FK pasien_id tetap valid');

// -------------------------------------------------------------
// PART 3: VALIDATOR MENANGKAP HASIL AI ANEH + FALLBACK MULUS
// -------------------------------------------------------------
console.log('\n--- PART 3: validator menangkap konten aneh & fallback ---');
const esKrim = domain6[0];
// a) AI menaruh NAMA ORANG di field produk
const garbageOrang = {
  nilai: { produk: { nama_varian: ['Budi Santoso', 'Siti Rahma', 'Ahmad Hidayat'] } }
};
const rGarbage = await generateSimulasiDbHybrid(mk(esKrim.schema), { caller: callerJSON(JSON.stringify(garbageOrang)) });
assert.strictEqual(rGarbage.sumber, 'kamus', 'nama orang di produk harus ditolak validator -> kamus');
assert(Array.isArray(rGarbage.masalahTerakhir) && rGarbage.masalahTerakhir.some((m) => m.includes('berisi nama orang')), rGarbage.masalahTerakhir?.join(';'));
const eskRow = rGarbage.simulasiDb.contohData.tabel[0].baris;
assert.deepStrictEqual(eskRow.map((r: any) => r.nama_varian), ['Vanilla', 'Coklat', 'Strawberry'], 'fallback kamus mengembalikan variasi es krim');
cekStrukturDanValidasi(rGarbage.simulasiDb, esKrim.schema, 'Garbage-nama-orang');
console.log(`  ✓ nama orang di field produk tertangkap -> kamus (masalah: ${rGarbage.masalahTerakhir?.[0]})`);

// b) AI mengisi ANGKA dengan teks
const garbageAngka = { nilai: { produk: { harga: ['murah', 'mahal', 'sedang'] } } };
const rGarbageAngka = await generateSimulasiDbHybrid(mk(esKrim.schema), { caller: callerJSON(JSON.stringify(garbageAngka)) });
assert.strictEqual(rGarbageAngka.sumber, 'kamus', 'harga teks harus ditolak -> kamus');
assert(rGarbageAngka.masalahTerakhir?.some((m) => m.includes('bukan angka')), rGarbageAngka.masalahTerakhir?.join(';'));
cekStrukturDanValidasi(rGarbageAngka.simulasiDb, esKrim.schema, 'Garbage-angka');
console.log('  ✓ harga diisi teks (bukan angka) tertangkap -> kamus');

// c) AI call THROW (rate limit) tidak boleh error
const rThrow = await generateSimulasiDbHybrid(mk(esKrim.schema), { caller: callerThrow });
assert.strictEqual(rThrow.sumber, 'kamus', 'throw harus fallback mulus');
cekStrukturDanValidasi(rThrow.simulasiDb, esKrim.schema, 'Throw');
console.log('  ✓ AI call throw (rate limit) -> fallback kamus mulus tanpa error');

// d) Unit test langsung: validator menangkap placeholder generik & kontaminasi
const contohBuruk = {
  tabel: [
    {
      nama: 'produk',
      field: esKrim.schema[0].field as any,
      baris: [
        { id_produk: 'PRD-001', nama_varian: '...', kategori: 'Utama', harga: 'banyak', status_tersedia: 'Selesai' },
        { id_produk: 'PRD-002', nama_varian: 'Contoh Data 2', kategori: 'Tambahan', harga: 10, status_tersedia: 'Aktif' },
        { id_produk: 'PRD-003', nama_varian: 'Indomie Goreng', kategori: 'Tambahan', harga: 20, status_tersedia: 'Aktif' }
      ]
    }
  ]
};
const mBuruk = validateContohDataVsSchema(contohBuruk as any, esKrim.schema);
assert(mBuruk.length >= 3, `harus ada banyak masalah: ${mBuruk.join(' | ')}`);
assert(mBuruk.some((m) => m.includes('placeholder')), mBuruk.join(';'));
assert(mBuruk.some((m) => m.includes('bukan angka')), mBuruk.join(';'));
assert(mBuruk.some((m) => m.includes('status transaksi')), mBuruk.join(';'));
console.log(`  ✓ Validator menangkap placeholder/angka-teks/status transaksi (${mBuruk.length} masalah): ${mBuruk.join('; ')}`);

// -------------------------------------------------------------
// PART 4: LATENSI — unit (fake caller) + LIVE (AI nyata, .env.production)
// -------------------------------------------------------------
console.log('\n--- PART 4: Latensi tambahan ---');
const t0 = Date.now();
await generateSimulasiDbHybrid(mk(butik.dataSchema!.tabel), { caller: callerJSON(JSON.stringify(butikPayload)) });
await generateSimulasiDbHybrid(mk(storeCat.dataSchema!.tabel), { caller: callerJSON(JSON.stringify(catPayload)) });
await generateSimulasiDbHybrid(mk(klinik.dataSchema!.tabel), { caller: callerJSON(JSON.stringify(klinikPayload)) });
console.log(`  ✓ Fake caller (no network): 3 domain hybrid selesai dalam ${Date.now() - t0}ms (overhead ~0)`);

let openaiAda = Boolean(process.env.OPENAI_API_KEY) || Boolean(process.env.GEMINI_API_KEY);
try {
  process.loadEnvFile('.env.production');
} catch (e) {
  console.warn('  ! .env.production tidak bisa dibaca:', e);
}
openaiAda = Boolean(process.env.OPENAI_API_KEY) || Boolean(process.env.GEMINI_API_KEY);

if (openaiAda) {
  for (const [label, ses] of [
    ['Butik (live)', butik],
    ['Toko Cat (live)', storeCat],
    ['Klinik Gigi (live)', klinik]
  ] as [string, MockupSessionState][]) {
    const t1 = Date.now();
    const live = await generateSimulasiDbHybrid(ses);
    const lat = Date.now() - t1;
    cekStrukturDanValidasi(live.simulasiDb, (ses as any).dataSchema.tabel, `${label}-real`);
    console.log(`  ✓ ${label}: sumber=${live.sumber}, latensi=${lat}ms, validasi BERSIH`);
  }
} else {
  console.warn('  ! Tidak ada API key (OPENAI/GEMINI) — langkah LIVE dilewati');
}

console.log('\n=== SEMUA VERIFIKASI POIN 9 (HYBRID AI) LULUS 100%! ===');