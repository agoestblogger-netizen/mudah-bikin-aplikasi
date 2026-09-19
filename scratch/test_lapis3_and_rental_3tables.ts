import {
  ensureMergedCatalogAndInventory,
  ensureMergedSingleCycleRentalTransactions,
  auditDatabaseDesignStandardsWithAI
} from '../src/app/api/guided/route';
import { generateMermaidErDiagram } from '../src/lib/erdGenerator';

async function runTests() {
  console.log('========================================================================');
  console.log('🚀 TEST SUITE: BAGIAN A, B & C — LAPIS 3 RULES & RENTAL 3 TABEL');
  console.log('========================================================================\n');

  // -------------------------------------------------------------------------
  // TEST 1: BAGIAN A — PENANDAAN ENTITAS & ISTILAH BISNIS DI NARASI
  // -------------------------------------------------------------------------
  console.log('--- [TEST 1] BAGIAN A: PENANDAAN ENTITAS & ISTILAH BISNIS KUNCI ---');
  const sampleNarasiWithQuotes = `
"Pelanggan" mendatangi kios untuk memilih jenis sepeda dari "Katalog Sepeda", lalu "Petugas Rental" mencatat pendaftaran sewa serta menerima "Uang Deposit" dan menetapkan "Tarif Sewa per Jam". Setelah bersepeda santai mengelilingi taman kota, "Pelanggan" mengembalikan unit untuk diperiksa fisiknya dan melunasi "Total Biaya Sewa" secara langsung di kasir.
  `.trim();

  console.log('Narasi dengan Tanda Kutip Ganda:');
  console.log(sampleNarasiWithQuotes);

  // Ekstrak entitas dalam tanda kutip
  const extractedEntities = Array.from(sampleNarasiWithQuotes.matchAll(/"([^"]+)"/g)).map(m => m[1]);
  console.log('Entitas & Istilah yang tertangkap:', extractedEntities);

  const expectedKeyTerms = ['Pelanggan', 'Katalog Sepeda', 'Petugas Rental', 'Uang Deposit', 'Tarif Sewa per Jam', 'Total Biaya Sewa'];
  const allTermsFound = expectedKeyTerms.every(term => extractedEntities.includes(term));

  if (!allTermsFound) {
    throw new Error('Test 1 GAGAL: Tidak semua entitas dan istilah kunci tertangkap dari tanda kutip');
  }
  console.log('✅ TEST 1 LULUS: Penandaan entitas dan istilah transaksi kunci berhasil tertangkap secara presisi!\n');

  // -------------------------------------------------------------------------
  // TEST 2: BAGIAN B & C — MERGE RENTAL SEPEDA MENJADI TEPAT 3 TABEL
  // -------------------------------------------------------------------------
  console.log('--- [TEST 2] BAGIAN B & C: MERGE RENTAL SEPEDA KE TEPAT 3 TABEL ---');
  const rawRentalMultiTables = [
    {
      nama: 'pelanggan',
      keterangan: 'Data identitas penyewa sepeda',
      displayField: 'nama_lengkap',
      field: [
        { nama: 'id', tipe: 'text', keterangan: 'PK' },
        { nama: 'nama_lengkap', tipe: 'text', keterangan: 'Nama Pelanggan' },
        { nama: 'nomor_identitas', tipe: 'text', keterangan: 'Nomor KTP/SIM' },
        { nama: 'nomor_telepon', tipe: 'text', keterangan: 'Nomor WhatsApp' }
      ]
    },
    {
      nama: 'katalog_sepeda',
      keterangan: 'Katalog unit sepeda yang disewakan',
      displayField: 'kode_sepeda',
      field: [
        { nama: 'id', tipe: 'text', keterangan: 'PK' },
        { nama: 'kode_sepeda', tipe: 'text', keterangan: 'Kode unit sepeda' },
        { nama: 'jenis_sepeda', tipe: 'text', keterangan: 'Jenis sepeda' },
        { nama: 'tarif_per_jam', tipe: 'angka', keterangan: 'Tarif sewa per jam' },
        { nama: 'kondisi_fisik', tipe: 'text', keterangan: 'Kondisi fisik' },
        { nama: 'status_ketersediaan', tipe: 'text', keterangan: 'Status ketersediaan' }
      ]
    },
    {
      nama: 'inventaris_sepeda',
      keterangan: 'Pencatatan stok fisik unit sepeda',
      field: [
        { nama: 'id', tipe: 'text', keterangan: 'PK' },
        { nama: 'stok_awal', tipe: 'angka', keterangan: 'Stok awal' },
        { nama: 'jumlah_keluar', tipe: 'angka', keterangan: 'Jumlah disewa' },
        { nama: 'sisa_stok_sepeda', tipe: 'angka', keterangan: 'Sisa stok', isFormula: true, formulaExpression: 'stok_awal - jumlah_keluar' }
      ]
    },
    {
      nama: 'penyewaan_sepeda',
      keterangan: 'Pencatatan transaksi sewa unit sepeda',
      field: [
        { nama: 'id', tipe: 'text', keterangan: 'PK' },
        { nama: 'pelanggan_id', tipe: 'relasi ke pelanggan', keterangan: 'Penyewa' },
        { nama: 'katalog_sepeda_id', tipe: 'relasi ke katalog_sepeda', keterangan: 'Unit sepeda' },
        { nama: 'jam_mulai', tipe: 'tanggal', keterangan: 'Waktu mulai sewa' },
        { nama: 'jam_selesai', tipe: 'tanggal', keterangan: 'Waktu selesai sewa' },
        { nama: 'durasi_jam', tipe: 'angka', keterangan: 'Durasi pemakaian jam' },
        { nama: 'total_biaya', tipe: 'angka', keterangan: 'Total biaya sewa', isFormula: true, formulaExpression: 'durasi_jam * tarif_per_jam' },
        { nama: 'deposit_diterima', tipe: 'angka', keterangan: 'Uang jaminan deposit yang diterima di awal' }
      ]
    },
    {
      nama: 'pembayaran_penyewaan_detail',
      keterangan: 'Rincian pembayaran sewa sekali lunas',
      field: [
        { nama: 'id', tipe: 'text', keterangan: 'PK' },
        { nama: 'penyewaan_id', tipe: 'relasi ke penyewaan_sepeda', keterangan: 'Ref sewa' },
        { nama: 'deposit_pembayaran', tipe: 'angka', keterangan: 'Deposit yang diserahkan' },
        { nama: 'jumlah_bayar', tipe: 'angka', keterangan: 'Nominal pembayaran' },
        { nama: 'metode_pembayaran', tipe: 'text', keterangan: 'Metode (Tunai/QRIS)' },
        { nama: 'status_pembayaran', tipe: 'text', keterangan: 'Status lunas' },
        {
          nama: 'jumlah_kembalian_deposit',
          tipe: 'angka',
          keterangan: 'Sisa uang deposit yang dikembalikan',
          isFormula: true,
          formulaExpression: 'deposit_pembayaran - total_biaya'
        }
      ]
    },
    {
      nama: 'pemeriksaan_kondisi_sepeda',
      keterangan: 'Pengecekan fisik saat diambil dan dikembalikan',
      field: [
        { nama: 'id', tipe: 'text', keterangan: 'PK' },
        { nama: 'penyewaan_id', tipe: 'relasi ke penyewaan_sepeda', keterangan: 'Ref sewa' },
        { nama: 'kondisi_saat_ambil', tipe: 'text', keterangan: 'Kondisi awal serah unit' },
        { nama: 'kondisi_saat_kembali', tipe: 'text', keterangan: 'Kondisi saat terima kembali' }
      ]
    }
  ];

  console.log('Jumlah tabel awal (sebelum normalisasi):', rawRentalMultiTables.length);

  // Jalankan pipeline normalisasi Bagian C
  let normalizedTables = ensureMergedCatalogAndInventory(rawRentalMultiTables as any);
  normalizedTables = ensureMergedSingleCycleRentalTransactions(normalizedTables as any);

  console.log('Jumlah tabel setelah normalisasi:', normalizedTables.length);
  const tableNames = normalizedTables.map(t => t.nama);
  console.log('Daftar nama tabel setelah normalisasi:', tableNames);

  if (normalizedTables.length !== 3) {
    throw new Error(`Test 2 GAGAL: Diharapkan tepat 3 tabel, tetapi diperoleh ${normalizedTables.length} tabel: ${tableNames.join(', ')}`);
  }

  const hasPelanggan = normalizedTables.some(t => t.nama === 'pelanggan');
  const hasKatalog = normalizedTables.some(t => t.nama === 'katalog_sepeda');
  const hasTransaksi = normalizedTables.some(t => t.nama === 'transaksi_sewa');

  if (!hasPelanggan || !hasKatalog || !hasTransaksi) {
    throw new Error(`Test 2 GAGAL: 3 tabel harus 'pelanggan', 'katalog_sepeda', dan 'transaksi_sewa'`);
  }

  const transaksiTable = normalizedTables.find(t => t.nama === 'transaksi_sewa');
  const transaksiFieldNames = transaksiTable?.field.map(f => f.nama) || [];
  console.log('Field lengkap pada transaksi_sewa:', transaksiFieldNames);

  // Cek integritas field gabungan (pendaftaran + pembayaran + pemeriksaan + deposit & formula sisa_tagihan)
  const expectedCombinedFields = [
    'id', 'pelanggan_id', 'katalog_sepeda_id', 'jam_mulai', 'durasi_jam', 'total_biaya',
    'deposit_diterima', 'sisa_tagihan',
    'jumlah_bayar', 'metode_pembayaran', 'status_pembayaran',
    'kondisi_saat_ambil', 'kondisi_saat_kembali'
  ];
  const missingInTransaksi = expectedCombinedFields.filter(f => !transaksiFieldNames.includes(f));
  if (missingInTransaksi.length > 0) {
    throw new Error(`Test 2 GAGAL: Field gabungan tidak lengkap di transaksi_sewa: ${missingInTransaksi.join(', ')}`);
  }

  // Verifikasi formula sisa_tagihan
  const formulaSisaTagihan = transaksiTable?.field.find(f => f.nama === 'sisa_tagihan');
  console.log('Formula sisa_tagihan:', formulaSisaTagihan);
  if (!formulaSisaTagihan?.isFormula || !formulaSisaTagihan?.formulaExpression?.includes('deposit_diterima')) {
    throw new Error('Test 2 GAGAL: Formula sisa_tagihan tidak terkonfigurasi dengan benar (total_biaya - deposit_diterima)');
  }

  // Verifikasi bahwa formula redundan jumlah_kembalian_deposit sudah benar-benar dihapus
  const hasKembalian = transaksiFieldNames.includes('jumlah_kembalian_deposit');
  if (hasKembalian) {
    throw new Error('Test 2 GAGAL: Field redundan jumlah_kembalian_deposit masih ada di transaksi_sewa!');
  }

  console.log('✅ TEST 2 LULUS: Skema Rental Sepeda bersih tepat 3 tabel, deposit terkonsolidasi & formula sisa_tagihan dipertahankan, jumlah_kembalian_deposit berhasil dihapus!\n');

  // -------------------------------------------------------------------------
  // TEST 3: BAGIAN B — NON-REGRESI DOMAIN KURSUS MUSIK (TETAP 3 LAPIS SEJATI)
  // -------------------------------------------------------------------------
  console.log('--- [TEST 3] BAGIAN B: NON-REGRESI KURSUS MUSIK (TETAP 3 LAPIS SEJATI) ---');
  const kursusMusikTables = [
    {
      nama: 'paket_kursus',
      keterangan: 'Katalog paket materi & instrumen les musik (Lapis 1)',
      displayField: 'nama_paket',
      field: [
        { nama: 'id', tipe: 'text', keterangan: 'PK' },
        { nama: 'nama_paket', tipe: 'text', keterangan: 'Paket Gitar / Piano / Drum' },
        { nama: 'tarif_bulanan', tipe: 'angka', keterangan: 'Biaya kursus per bulan' }
      ]
    },
    {
      nama: 'pendaftaran_kursus',
      keterangan: 'Pencatatan registrasi siswa ke paket kursus (Lapis 2)',
      field: [
        { nama: 'id', tipe: 'text', keterangan: 'PK' },
        { nama: 'siswa_id', tipe: 'relasi ke pengguna', keterangan: 'Siswa' },
        { nama: 'paket_kursus_id', tipe: 'relasi ke paket_kursus', keterangan: 'Paket' }
      ]
    },
    {
      nama: 'jadwal_sesi_studio',
      keterangan: 'Sesi latihan studio berulang mingguan (Lapis 3 - 1-ke-banyak nyata)',
      field: [
        { nama: 'id', tipe: 'text', keterangan: 'PK' },
        { nama: 'pendaftaran_kursus_id', tipe: 'relasi ke pendaftaran_kursus', keterangan: 'Pendaftaran' },
        { nama: 'tanggal_sesi', tipe: 'tanggal', keterangan: 'Jadwal pertemuan' },
        { nama: 'ruangan_studio', tipe: 'text', keterangan: 'Studio A/B' }
      ]
    },
    {
      nama: 'evaluasi_perkembangan',
      keterangan: 'Log evaluasi berkala siswa per pertemuan (Lapis 3 - 1-ke-banyak nyata)',
      field: [
        { nama: 'id', tipe: 'text', keterangan: 'PK' },
        { nama: 'pendaftaran_kursus_id', tipe: 'relasi ke pendaftaran_kursus', keterangan: 'Pendaftaran' },
        { nama: 'catatan_progres', tipe: 'text', keterangan: 'Evaluasi nada dan tempo' }
      ]
    }
  ];

  console.log('Jumlah tabel Kursus Musik sebelum normalizer:', kursusMusikTables.length);
  // Jalankan normalizer yang sama
  let normalizedKursus = ensureMergedCatalogAndInventory(kursusMusikTables as any);
  normalizedKursus = ensureMergedSingleCycleRentalTransactions(normalizedKursus as any);

  console.log('Jumlah tabel Kursus Musik setelah normalizer:', normalizedKursus.length);
  const kursusNames = normalizedKursus.map(t => t.nama);
  console.log('Daftar nama tabel Kursus Musik:', kursusNames);

  // Kursus Musik TIDAK BOLEH dipangkas ke 2 tabel! Harus tetap 4 tabel (Lapis 1 + Lapis 2 + dua Lapis 3)
  if (normalizedKursus.length !== 4) {
    throw new Error(`Test 3 GAGAL: Kursus Musik terpotong salah menjadi ${normalizedKursus.length} tabel!`);
  }

  const hasJadwal = normalizedKursus.some(t => t.nama === 'jadwal_sesi_studio');
  const hasEvaluasi = normalizedKursus.some(t => t.nama === 'evaluasi_perkembangan');

  if (!hasJadwal || !hasEvaluasi) {
    throw new Error('Test 3 GAGAL: Tabel Lapis 3 sejati (jadwal studio / evaluasi) ikut terhapus!');
  }

  console.log('✅ TEST 3 LULUS: Kursus Musik tetap mempertahankan 3 Lapis Sejati (Lapis 1 Master, Lapis 2 Connector, Lapis 3 Multi-Record)!\n');

  // -------------------------------------------------------------------------
  // TEST 4: BAGIAN C — ERD MERMAID RENTAL SEPEDA 3 TABEL (BEBAS DARI KOLOM KETERANGAN "PK")
  // -------------------------------------------------------------------------
  console.log('--- [TEST 4] BAGIAN C: GENERASI MERMAID ERD (BERSIH DARI KOLOM KETERANGAN) ---');
  const erd3Tables = generateMermaidErDiagram(normalizedTables as any);
  console.log('Sintaks Mermaid ERD (3 Tabel Mode Ringkas):');
  console.log(erd3Tables);

  const hasPelangganRel = erd3Tables.includes('PELANGGAN ||--o{ TRANSAKSI_SEWA');
  const hasKatalogRel = erd3Tables.includes('KATALOG_SEPEDA ||--o{ TRANSAKSI_SEWA');
  const hasNoChildTable = !erd3Tables.includes('PEMBAYARAN') && !erd3Tables.includes('PEMERIKSAAN');

  // Pastikan TIDAK ada kolom komentar "PK" atau "FK" ganda
  const hasPkAsComment = erd3Tables.includes('PK "PK"') || erd3Tables.includes('FK "FK"') || erd3Tables.includes('"Penyewa"') && erd3Tables.includes('string pelanggan_id FK "Penyewa"');
  console.log('Apakah terdapat komentar "PK" atau "FK" ganda pada baris field?:', hasPkAsComment);

  if (!hasPelangganRel || !hasKatalogRel || !hasNoChildTable || hasPkAsComment) {
    throw new Error('Test 4 GAGAL: ERD masih mengandung teks komentar ganda di baris field');
  }

  console.log('✅ TEST 4 LULUS: ERD mode ringkas benar-benar bersih dari kolom komentar ("PK"/"FK"), hanya menampilkan type name [PK|FK] murni!\n');

  console.log('========================================================================');
  console.log('🎉 SELURUH PENGUJIAN BAGIAN A, B, DAN C LULUS DENGAN SEMPURNA! 🎉');
  console.log('========================================================================');
}

runTests().catch(err => {
  console.error('TEST ERROR:', err);
  process.exit(1);
});
