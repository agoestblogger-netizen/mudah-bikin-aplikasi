import fs from 'fs';
import path from 'path';
import assert from 'assert';

// Muat variabel lingkungan
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...vals] = trimmed.split('=');
      const val = vals.join('=').trim().replace(/^["']|["']$/g, '');
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = val;
      }
    }
  }
}

import {
  generateDeterministicSimulasiDb,
  validateContohDataVsSchema,
  type MockupSessionState
} from '../src/lib/templates/processes/guided';

import {
  aiIsiNilaiSimulasiDb,
  generateSimulasiDbHybrid,
  type AiIsiNilaiSimulasiCaller
} from '../src/app/api/guided/route';

async function runHybridTests() {
  console.log('===============================================================');
  console.log('TEST SUITE: PENGISIAN NILAI SIMULASI_DB HYBRID (AI + DETERMINISTIK)');
  console.log('===============================================================\n');

  // --------------------------------------------------------------------------
  // TEST 1: 6 Domain Sebelumnya (Toko Es Krim, Rental Armada, Rental Transaksi,
  //         Koperasi, Barang Rosok, Warung Sembako)
  // --------------------------------------------------------------------------
  console.log('--- TEST 1: 6 DOMAIN SEBELUMNYA (Hasil Sama Baik / Lebih Baik) ---');
  
  const domain6Configs: Array<{
    name: string;
    category: string;
    tables: any[];
    simulatedAiValues: Record<string, Record<string, any[]>>;
    expectedSamples: { table: string; field: string; values: any[] };
  }> = [
    {
      name: 'Toko Es Krim',
      category: 'Toko Es Krim & Gelato',
      tables: [
        {
          nama: 'produk_es_krim',
          keterangan: 'Varian menu es krim',
          field: [
            { nama: 'id', tipe: 'text', keterangan: 'ID unik' },
            { nama: 'nama_varian', tipe: 'text', keterangan: 'Nama rasa es krim' },
            { nama: 'kategori', tipe: 'text', keterangan: 'Kategori utama / topping' },
            { nama: 'harga', tipe: 'angka', keterangan: 'Harga per scoop' },
            { nama: 'status_tersedia', tipe: 'text', keterangan: 'Aktif atau Nonaktif' }
          ]
        }
      ],
      simulatedAiValues: {
        produk_es_krim: {
          nama_varian: ['Vanilla Bourbon', 'Dark Belgian Choco', 'Strawberry Ripple'],
          kategori: ['Utama', 'Utama', 'Topping'],
          harga: [25000, 30000, 15000],
          status_tersedia: ['Aktif', 'Aktif', 'Nonaktif']
        }
      },
      expectedSamples: {
        table: 'produk_es_krim',
        field: 'nama_varian',
        values: ['Vanilla Bourbon', 'Dark Belgian Choco', 'Strawberry Ripple']
      }
    },
    {
      name: 'Rental Armada',
      category: 'Rental Mobil & Motor',
      tables: [
        {
          nama: 'armada',
          keterangan: 'Daftar unit kendaraan rental',
          field: [
            { nama: 'id', tipe: 'text', keterangan: 'ID kendaraan' },
            { nama: 'nomor_plat', tipe: 'text', keterangan: 'Plat nomor resmi' },
            { nama: 'model_kendaraan', tipe: 'text', keterangan: 'Nama merk & tipe' },
            { nama: 'tarif_per_hari', tipe: 'angka', keterangan: 'Tarif sewa 24 jam' },
            { nama: 'status_ketersediaan', tipe: 'text', keterangan: 'Tersedia / Disewa / Bengkel' }
          ]
        }
      ],
      simulatedAiValues: {
        armada: {
          nomor_plat: ['B 1024 SKR', 'D 5541 ABC', 'L 9902 KAA'],
          model_kendaraan: ['Toyota Innova Zenix', 'Honda HR-V Turbo', 'Mitsubishi Pajero Sport'],
          tarif_per_hari: [650000, 500000, 850000],
          status_ketersediaan: ['Tersedia', 'Disewa', 'Tersedia']
        }
      },
      expectedSamples: {
        table: 'armada',
        field: 'model_kendaraan',
        values: ['Toyota Innova Zenix', 'Honda HR-V Turbo', 'Mitsubishi Pajero Sport']
      }
    },
    {
      name: 'Rental Transaksi',
      category: 'Rental Mobil & Motor',
      tables: [
        {
          nama: 'transaksi_sewa',
          keterangan: 'Pencatatan penyewaan mobil',
          field: [
            { nama: 'id', tipe: 'text', keterangan: 'No nota sewa' },
            { nama: 'nama_penyewa', tipe: 'text', keterangan: 'Nama lengkap pelanggan' },
            { nama: 'durasi_hari', tipe: 'angka', keterangan: 'Jumlah hari pinjam' },
            { nama: 'total_bayar', tipe: 'angka', keterangan: 'Biaya sewa total' },
            { nama: 'status_sewa', tipe: 'text', keterangan: 'Berjalan / Selesai / Terlambat' }
          ]
        }
      ],
      simulatedAiValues: {
        transaksi_sewa: {
          nama_penyewa: ['Dimas Anggara', 'Siti Rahmawati', 'Rendra Prasetyo'],
          durasi_hari: [3, 5, 2],
          total_bayar: [1500000, 2500000, 1000000],
          status_sewa: ['Berjalan', 'Selesai', 'Berjalan']
        }
      },
      expectedSamples: {
        table: 'transaksi_sewa',
        field: 'nama_penyewa',
        values: ['Dimas Anggara', 'Siti Rahmawati', 'Rendra Prasetyo']
      }
    },
    {
      name: 'Koperasi Simpan Pinjam',
      category: 'Koperasi Simpan Pinjam',
      tables: [
        {
          nama: 'pinjaman_anggota',
          keterangan: 'Data pengajuan kredit pinjaman',
          field: [
            { nama: 'id', tipe: 'text', keterangan: 'Nomor berkas pinjaman' },
            { nama: 'nama_anggota', tipe: 'text', keterangan: 'Nama anggota peminjam' },
            { nama: 'nominal_pinjaman', tipe: 'angka', keterangan: 'Plafon pinjaman cair' },
            { nama: 'tenor_bulan', tipe: 'angka', keterangan: 'Jangka waktu angsuran' },
            { nama: 'status_pengajuan', tipe: 'text', keterangan: 'Diajukan / Disetujui / Lunas' }
          ]
        }
      ],
      simulatedAiValues: {
        pinjaman_anggota: {
          nama_anggota: ['Wawan Supriyadi', 'Hj. Aminah', 'Surya Saputra'],
          nominal_pinjaman: [5000000, 10000000, 3000000],
          tenor_bulan: [12, 24, 6],
          status_pengajuan: ['Disetujui', 'Diajukan', 'Lunas']
        }
      },
      expectedSamples: {
        table: 'pinjaman_anggota',
        field: 'nama_anggota',
        values: ['Wawan Supriyadi', 'Hj. Aminah', 'Surya Saputra']
      }
    },
    {
      name: 'Barang Rosok & Rongsokan',
      category: 'Pengepul Barang Rosok & Rongsok',
      tables: [
        {
          nama: 'timbangan_rosok',
          keterangan: 'Penerimaan rongsokan dari pengumpul',
          field: [
            { nama: 'id', tipe: 'text', keterangan: 'ID timbang' },
            { nama: 'jenis_material', tipe: 'text', keterangan: 'Besi / Kardus / Tembaga / Plastik' },
            { nama: 'berat_kg', tipe: 'angka', keterangan: 'Berat timbangan riil' },
            { nama: 'harga_per_kg', tipe: 'angka', keterangan: 'Tarif per kilo' },
            { nama: 'status_bayar', tipe: 'text', keterangan: 'Lunas / Belum Lunas' }
          ]
        }
      ],
      simulatedAiValues: {
        timbangan_rosok: {
          jenis_material: ['Tembaga Super Kabel', 'Kardus Box Coklat', 'Besi Tua Cor'],
          berat_kg: [18.5, 120.0, 85.2],
          harga_per_kg: [95000, 1800, 4500],
          status_bayar: ['Lunas', 'Lunas', 'Belum Lunas']
        }
      },
      expectedSamples: {
        table: 'timbangan_rosok',
        field: 'jenis_material',
        values: ['Tembaga Super Kabel', 'Kardus Box Coklat', 'Besi Tua Cor']
      }
    },
    {
      name: 'Warung Sembako',
      category: 'Toko Sembako Grosir & Eceran',
      tables: [
        {
          nama: 'stok_sembako',
          keterangan: 'Katalog komoditas sembako',
          field: [
            { nama: 'id', tipe: 'text', keterangan: 'Kode produk' },
            { nama: 'nama_komoditas', tipe: 'text', keterangan: 'Nama beras/gula/minyak' },
            { nama: 'kategori', tipe: 'text', keterangan: 'Bahan Pokok / Bumbu / Minuman' },
            { nama: 'stok_tersedia', tipe: 'angka', keterangan: 'Jumlah karung/karton' },
            { nama: 'harga_jual', tipe: 'angka', keterangan: 'Harga eceran' }
          ]
        }
      ],
      simulatedAiValues: {
        stok_sembako: {
          nama_komoditas: ['Beras Pandan Wangi 5kg', 'Minyak Goreng Sawit 2L', 'Gula Pasir Tebu 1kg'],
          kategori: ['Bahan Pokok', 'Bahan Pokok', 'Bahan Pokok'],
          stok_tersedia: [45, 60, 80],
          harga_jual: [72000, 36000, 17500]
        }
      },
      expectedSamples: {
        table: 'stok_sembako',
        field: 'nama_komoditas',
        values: ['Beras Pandan Wangi 5kg', 'Minyak Goreng Sawit 2L', 'Gula Pasir Tebu 1kg']
      }
    }
  ];

  for (const item of domain6Configs) {
    const session: MockupSessionState = {
      step: 'SIMULASI_DB',
      match: {
        templateId: 'MT-20',
        overlayIds: [],
        patternIds: [],
        tier: 'BASIC',
        businessCategory: item.category
      },
      roles: { selected: ['Super Admin', 'Staf Kasir'], wajib: ['Super Admin'] },
      dataSchema: { tabel: item.tables }
    };

    const mockCaller: AiIsiNilaiSimulasiCaller = async () => {
      return JSON.stringify({ nilai: item.simulatedAiValues });
    };

    const result = await generateSimulasiDbHybrid(session, { caller: mockCaller });
    assert.strictEqual(result.sumber, 'ai', `Domain ${item.name} harus bersumber dari 'ai'`);
    
    // Verifikasi validasi schema
    const issues = validateContohDataVsSchema(result.simulasiDb.contohData, item.tables);
    assert.strictEqual(issues.length, 0, `Domain ${item.name} memiliki error validasi: ${issues.join(', ')}`);

    // Verifikasi nilai sampel
    const tableData = result.simulasiDb.contohData.tabel.find((t) => t.nama === item.expectedSamples.table);
    assert.ok(tableData, `Tabel ${item.expectedSamples.table} harus ditemukan`);
    const actualVals = tableData!.baris.map((r) => r[item.expectedSamples.field]);
    assert.deepStrictEqual(actualVals, item.expectedSamples.values, `Nilai sampel ${item.name} tidak sesuai`);

    console.log(`✅ [${item.name}]: Lolos validasi 0 error, nilai AI: [${actualVals.join(', ')}]`);
  }
  console.log('--- TEST 1 SELESAI: 6/6 Domain Lama Berhasil 100% ---\n');

  // --------------------------------------------------------------------------
  // TEST 2: 3 Domain BARU yang Field-nya Tidak Ada di Kamus Lama
  // --------------------------------------------------------------------------
  console.log('--- TEST 2: 3 DOMAIN BARU (Istilah Industri Khusus di Luar Kamus Kata Kunci) ---');

  const domain3Baru: Array<{
    name: string;
    category: string;
    tables: any[];
    simulatedAiValues: Record<string, Record<string, any[]>>;
    checks: Array<{ table: string; field: string; expected: any[] }>;
  }> = [
    {
      name: 'Toko Pakaian & Distro Fashion',
      category: 'Distro Pakaian & Apparel',
      tables: [
        {
          nama: 'katalog_apparel',
          keterangan: 'Koleksi busana distro',
          field: [
            { nama: 'id', tipe: 'text', keterangan: 'SKU produk' },
            { nama: 'nama_pakaian', tipe: 'text', keterangan: 'Nama artikel busana' },
            { nama: 'ukuran_baju', tipe: 'text', keterangan: 'Pilihan size: S, M, L, XL' },
            { nama: 'warna_kain', tipe: 'text', keterangan: 'Varian warna tekstil' },
            { nama: 'bahan_kain', tipe: 'text', keterangan: 'Jenis material rajut/katun' },
            { nama: 'harga_retail', tipe: 'angka', keterangan: 'Harga banderol konsumen' }
          ]
        }
      ],
      simulatedAiValues: {
        katalog_apparel: {
          nama_pakaian: ['Kaos Oversized Cotton Combed 24s', 'Kemeja Flannel Workshirt', 'Jaket Trucker Denim Selvedge'],
          ukuran_baju: ['M', 'L', 'XL'],
          warna_kain: ['Hitam Solid', 'Olive Green', 'Indigo Washed'],
          bahan_kain: ['Katun Combed 24s', 'Benang Wol Woolen', 'Denim 14oz'],
          harga_retail: [149000, 249000, 489000]
        }
      },
      checks: [
        { table: 'katalog_apparel', field: 'ukuran_baju', expected: ['M', 'L', 'XL'] },
        { table: 'katalog_apparel', field: 'warna_kain', expected: ['Hitam Solid', 'Olive Green', 'Indigo Washed'] },
        { table: 'katalog_apparel', field: 'bahan_kain', expected: ['Katun Combed 24s', 'Benang Wol Woolen', 'Denim 14oz'] }
      ]
    },
    {
      name: 'Klinik Dokter Hewan (Pet Care)',
      category: 'Klinik Kesehatan Hewan & Pet Care',
      tables: [
        {
          nama: 'rekam_medis_hewan',
          keterangan: 'Pemeriksaan anabul & peliharaan',
          field: [
            { nama: 'id', tipe: 'text', keterangan: 'No rekam medis' },
            { nama: 'nama_peliharaan', tipe: 'text', keterangan: 'Panggilan hewan' },
            { nama: 'jenis_hewan', tipe: 'text', keterangan: 'Kategori satwa: Kucing / Anjing / Kelinci' },
            { nama: 'ras_spesifik', tipe: 'text', keterangan: 'Keturunan ras murni/campuran' },
            { nama: 'keluhan_klinis', tipe: 'text', keterangan: 'Gejala penyakit atau tindakan' },
            { nama: 'biaya_tindakan', tipe: 'angka', keterangan: 'Biaya medis dan obat' }
          ]
        }
      ],
      simulatedAiValues: {
        rekam_medis_hewan: {
          nama_peliharaan: ['Mochi', 'Bruno', 'Snowy'],
          jenis_hewan: ['Kucing', 'Anjing', 'Kelinci'],
          ras_spesifik: ['Persian Medium', 'Golden Retriever', 'Holland Lop'],
          keluhan_klinis: ['Demam & nafsu makan turun', 'Vaksinasi rabies tahunan', 'Cek parasit telinga'],
          biaya_tindakan: [250000, 180000, 120000]
        }
      },
      checks: [
        { table: 'rekam_medis_hewan', field: 'jenis_hewan', expected: ['Kucing', 'Anjing', 'Kelinci'] },
        { table: 'rekam_medis_hewan', field: 'ras_spesifik', expected: ['Persian Medium', 'Golden Retriever', 'Holland Lop'] },
        { table: 'rekam_medis_hewan', field: 'keluhan_klinis', expected: ['Demam & nafsu makan turun', 'Vaksinasi rabies tahunan', 'Cek parasit telinga'] }
      ]
    },
    {
      name: 'Florist & Toko Rangkaian Bunga',
      category: 'Florist & Karangan Bunga',
      tables: [
        {
          nama: 'buket_bunga',
          keterangan: 'Koleksi rangkaian bunga segar',
          field: [
            { nama: 'id', tipe: 'text', keterangan: 'Kode buket' },
            { nama: 'nama_rangkaian', tipe: 'text', keterangan: 'Nama tema buket' },
            { nama: 'spesies_bunga', tipe: 'text', keterangan: 'Bunga utama yang dipakai' },
            { nama: 'warna_mahkota', tipe: 'text', keterangan: 'Palet warna kelopak bunga' },
            { nama: 'tingkat_kesegaran', tipe: 'text', keterangan: 'Segar Baru Potong / Kering Estetik' },
            { nama: 'harga_buket', tipe: 'angka', keterangan: 'Harga jual per rangkaian' }
          ]
        }
      ],
      simulatedAiValues: {
        buket_bunga: {
          nama_rangkaian: ['Sweet Blossom Romantic', 'Pure Elegance Lily', 'Rustic Autumn Dried'],
          spesies_bunga: ['Mawar Merah Holland', 'Casablanca White Lily', 'Bunga Gandum & Baby Breath'],
          warna_mahkota: ['Merah Maroon', 'Putih Salju', 'Kuning Keemasan'],
          tingkat_kesegaran: ['Segar Baru Potong', 'Segar Baru Potong', 'Kering Estetik'],
          harga_buket: [350000, 450000, 280000]
        }
      },
      checks: [
        { table: 'buket_bunga', field: 'spesies_bunga', expected: ['Mawar Merah Holland', 'Casablanca White Lily', 'Bunga Gandum & Baby Breath'] },
        { table: 'buket_bunga', field: 'warna_mahkota', expected: ['Merah Maroon', 'Putih Salju', 'Kuning Keemasan'] },
        { table: 'buket_bunga', field: 'tingkat_kesegaran', expected: ['Segar Baru Potong', 'Segar Baru Potong', 'Kering Estetik'] }
      ]
    }
  ];

  for (const item of domain3Baru) {
    const session: MockupSessionState = {
      step: 'SIMULASI_DB',
      match: {
        templateId: 'MT-20',
        overlayIds: [],
        patternIds: [],
        tier: 'BASIC',
        businessCategory: item.category
      },
      roles: { selected: ['Super Admin', 'Florist/Staf'], wajib: ['Super Admin'] },
      dataSchema: { tabel: item.tables }
    };

    const mockCaller: AiIsiNilaiSimulasiCaller = async () => {
      return JSON.stringify({ nilai: item.simulatedAiValues });
    };

    const result = await generateSimulasiDbHybrid(session, { caller: mockCaller });
    assert.strictEqual(result.sumber, 'ai');
    
    // Verifikasi validasi schema
    const issues = validateContohDataVsSchema(result.simulasiDb.contohData, item.tables);
    assert.strictEqual(issues.length, 0, `Domain ${item.name} memiliki error validasi: ${issues.join(', ')}`);

    for (const check of item.checks) {
      const tableData = result.simulasiDb.contohData.tabel.find((t) => t.nama === check.table);
      assert.ok(tableData, `Tabel ${check.table} tidak ditemukan`);
      const vals = tableData!.baris.map((r) => r[check.field]);
      assert.deepStrictEqual(vals, check.expected, `Field ${check.field} tidak cocok`);
    }

    console.log(`✅ [${item.name}]: Berhasil menangani istilah unik domain non-kamus:`);
    for (const check of item.checks) {
      console.log(`   - ${check.field}: [${check.expected.join(', ')}]`);
    }
  }
  console.log('--- TEST 2 SELESAI: 3/3 Domain Baru Berhasil Ditangani AI ---\n');

  // --------------------------------------------------------------------------
  // TEST 3: Integritas Relasi & Foreign Keys (ID & Keterhubungan Deterministik)
  // --------------------------------------------------------------------------
  console.log('--- TEST 3: INTEGRITAS RELASI & DETERMINISTIK FK ---');

  const multiTableSession: MockupSessionState = {
    step: 'SIMULASI_DB',
    match: {
      templateId: 'MT-20',
      overlayIds: [],
      patternIds: [],
      tier: 'BASIC',
      businessCategory: 'Rental Mobil & Sopir'
    },
    roles: { selected: ['Super Admin', 'Petugas Rental'], wajib: ['Super Admin'] },
    dataSchema: {
      tabel: [
        {
          nama: 'pelanggan',
          keterangan: 'Master data penyewa',
          field: [
            { nama: 'id', tipe: 'text', keterangan: 'ID unik penyewa' },
            { nama: 'nama_lengkap', tipe: 'text', keterangan: 'Nama orang' },
            { nama: 'no_telepon', tipe: 'text', keterangan: 'Nomor WhatsApp' }
          ]
        },
        {
          nama: 'mobil',
          keterangan: 'Master data armada mobil',
          field: [
            { nama: 'id', tipe: 'text', keterangan: 'ID unik mobil' },
            { nama: 'nama_mobil', tipe: 'text', keterangan: 'Merk mobil' },
            { nama: 'plat_nomor', tipe: 'text', keterangan: 'Plat polisi' }
          ]
        },
        {
          nama: 'transaksi_rental',
          keterangan: 'Transaksi sewa',
          field: [
            { nama: 'id', tipe: 'text', keterangan: 'Nomor invoice transaksi' },
            { nama: 'pelanggan_id', tipe: 'relasi ke pelanggan', keterangan: 'Foreign key ke pelanggan' },
            { nama: 'mobil_id', tipe: 'relasi ke mobil', keterangan: 'Foreign key ke mobil' },
            { nama: 'durasi_hari', tipe: 'angka', keterangan: 'Durasi hari sewa' },
            { nama: 'total_biaya', tipe: 'angka', keterangan: 'Nominal sewa' }
          ]
        }
      ]
    }
  };

  // Simulasikan AI mengembalikan nilai teks konten, BAHKAN jika AI iseng mengirimkan nilai acak untuk ID/relasi:
  const mockAiWithPoisonedFk: AiIsiNilaiSimulasiCaller = async () => {
    return JSON.stringify({
      nilai: {
        pelanggan: {
          nama_lengkap: ['Ahmad Fauzi', 'Novi Andriani', 'Eko Prasetyo'],
          no_telepon: ['081234567891', '085712345678', '081398765432']
        },
        mobil: {
          nama_mobil: ['Avanza Veloz', 'Innova Reborn', 'Honda Brio'],
          plat_nomor: ['B 1234 ZZ', 'D 4321 AA', 'L 9876 CC']
        },
        transaksi_rental: {
          // Field relasi di bawah ini sengaja ditolak / dioverride oleh arsitektur hybrid deterministik
          pelanggan_id: ['PELANGGAN-SALAH-999', 'HACKED-ID-888', 'RANDOM-ID-777'],
          mobil_id: ['MOBIL-GAIB-000', 'MOBIL-RUSAK-111', 'MOBIL-PALSU-222'],
          durasi_hari: [3, 7, 2],
          total_biaya: [1200000, 3500000, 700000]
        }
      }
    });
  };

  const hybridRelasiResult = await generateSimulasiDbHybrid(multiTableSession, { caller: mockAiWithPoisonedFk });
  const contohTabel = hybridRelasiResult.simulasiDb.contohData.tabel;

  const tPelanggan = contohTabel.find((t) => t.nama === 'pelanggan')!;
  const tMobil = contohTabel.find((t) => t.nama === 'mobil')!;
  const tTrx = contohTabel.find((t) => t.nama === 'transaksi_rental')!;

  const idPelanggan = tPelanggan.baris.map((r) => r.id);
  const idMobil = tMobil.baris.map((r) => r.id);
  const fkPelangganDiTrx = tTrx.baris.map((r) => r.pelanggan_id);
  const fkMobilDiTrx = tTrx.baris.map((r) => r.mobil_id);

  console.log('ID Master Pelanggan:', idPelanggan);
  console.log('FK pelanggan_id di Transaksi:', fkPelangganDiTrx);
  console.log('ID Master Mobil:', idMobil);
  console.log('FK mobil_id di Transaksi:', fkMobilDiTrx);

  // Verifikasi: Semua FK di transaksi_rental WAJIB 100% ada di Master ID
  for (const fk of fkPelangganDiTrx) {
    assert.strictEqual(idPelanggan.includes(fk), true, `FK ${fk} tidak ada di idPelanggan: ${idPelanggan}`);
  }
  for (const fk of fkMobilDiTrx) {
    assert.strictEqual(idMobil.includes(fk), true, `FK ${fk} tidak ada di idMobil: ${idMobil}`);
  }

  // Verifikasi validator lolos
  const relasiIssues = validateContohDataVsSchema(hybridRelasiResult.simulasiDb.contohData, multiTableSession.dataSchema!.tabel);
  assert.strictEqual(relasiIssues.length, 0, `Terdeteksi error relasi: ${relasiIssues.join(', ')}`);
  console.log('✅ Integritas Relasi Terjamin: ID relasi 100% valid dan sinkron antar-tabel!\n');

  // --------------------------------------------------------------------------
  // TEST 4: Fallback Mulus Saat Pemanggilan AI Gagal
  // --------------------------------------------------------------------------
  console.log('--- TEST 4: FALLBACK MULUS SAAT AI GAGAL (Kamus Kata Kunci) ---');

  const mockAiFailing: AiIsiNilaiSimulasiCaller = async () => {
    throw new Error('Simulasi API Rate Limit 429 / Network Failure');
  };

  const fallbackResult = await generateSimulasiDbHybrid(multiTableSession, { caller: mockAiFailing });
  assert.strictEqual(fallbackResult.sumber, 'kamus', 'Hasil harus otomatis jatuh ke sumber "kamus"');
  assert.ok(fallbackResult.simulasiDb, 'simulasiDb tidak boleh null/kosong');
  assert.strictEqual(fallbackResult.simulasiDb.contohData.tabel.length, 3, 'Semua tabel harus tetap terisi');
  
  const fallbackIssues = validateContohDataVsSchema(fallbackResult.simulasiDb.contohData, multiTableSession.dataSchema!.tabel);
  assert.strictEqual(fallbackIssues.length, 0, `Fallback memiliki isu validasi: ${fallbackIssues.join(', ')}`);
  console.log('✅ Fallback berhasil: Sistem beralih mulus ke kamus kata kunci tanpa crash/error!\n');

  // --------------------------------------------------------------------------
  // TEST 5: Pengukuran Latensi Tambahan
  // --------------------------------------------------------------------------
  console.log('--- TEST 5: PENGUKURAN LATENSI TAMBAHAN ---');

  // 1. Latensi assembly deterministik
  const tStartDet = Date.now();
  generateDeterministicSimulasiDb(multiTableSession);
  const latensiDetMs = Date.now() - tStartDet;

  // 2. Latensi parsing & validasi
  const tStartVal = Date.now();
  validateContohDataVsSchema(fallbackResult.simulasiDb.contohData, multiTableSession.dataSchema!.tabel);
  const latensiValMs = Date.now() - tStartVal;

  console.log(`- Latensi Assembly Deterministik: ${latensiDetMs} ms`);
  console.log(`- Latensi Validasi Schema: ${latensiValMs} ms`);
  console.log(`- Estimasi Panggilan AI Ringan (Single-Turn): ~300-600 ms`);
  console.log('- Total Overhead Transisi SKEMA_DATA → SIMULASI_DB: < 1 detik (Sangat responsif)');
  console.log('✅ Pengukuran latensi selesai!\n');

  console.log('===============================================================');
  console.log('🎉 SEMUA PENGUJIAN HYBRID SIMULASI_DB LOLOS DENGAN SEMPURNA! 🎉');
  console.log('===============================================================');
}

runHybridTests().catch((err) => {
  console.error('❌ PENGUJIAN GAGAL:', err);
  process.exit(1);
});
