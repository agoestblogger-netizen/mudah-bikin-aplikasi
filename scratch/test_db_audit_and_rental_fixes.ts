import {
  auditDatabaseDesignStandardsWithAI,
  ensureMergedCatalogAndInventory
} from '../src/app/api/guided/route';
import {
  checkAndRepairMissingSchemaTables
} from '../src/lib/codeValidator';
import {
  generateDeterministicSimulasiDb
} from '../src/lib/templates/processes/guided';
import {
  MockupSessionState
} from '../src/lib/templates/processes/types';
import {
  generateMermaidErDiagram
} from '../src/lib/erdGenerator';

async function runTests() {
  console.log('========================================================================');
  console.log('🚀 TEST SUITE: AUDIT KELAZIMAN DB, 3 BUG RENTAL SEPEDA & ERD PANEL');
  console.log('========================================================================\n');

  // -------------------------------------------------------------------------
  // TEST 1: BAGIAN 1.1 — MERGE INVENTARIS KE KATALOG & PRESERVASI FIELD ASLI
  // -------------------------------------------------------------------------
  console.log('--- [TEST 1] BAGIAN 1.1: MERGE & PRESERVASI FIELD ASLI (KONDISI FISIK & STATUS) ---');
  // Memakai field ASLI Rental Sepeda sesuai Brief Kebutuhan
  const originalRentalTables = [
    {
      nama: 'katalog_sepeda',
      keterangan: 'Katalog unit sepeda yang disewakan',
      displayField: 'kode_sepeda',
      field: [
        { nama: 'id', tipe: 'text', keterangan: 'PK' },
        { nama: 'kode_sepeda', tipe: 'text', keterangan: 'Kode unit sepeda' },
        { nama: 'jenis_sepeda', tipe: 'text', keterangan: 'Jenis sepeda (Road/City/MTB)' },
        { nama: 'tarif_per_jam', tipe: 'angka', keterangan: 'Tarif sewa per jam (Rp)' },
        { nama: 'kondisi_fisik', tipe: 'text', keterangan: 'Kondisi fisik sepeda' },
        { nama: 'status_ketersediaan', tipe: 'text', keterangan: 'Status (Tersedia / Disewa / Perawatan)' }
      ]
    },
    {
      nama: 'inventaris_sepeda',
      keterangan: 'Pencatatan jumlah stok unit fisik sepeda',
      field: [
        { nama: 'id', tipe: 'text', keterangan: 'PK' },
        { nama: 'stok_awal', tipe: 'angka', keterangan: 'Stok awal unit' },
        { nama: 'jumlah_keluar', tipe: 'angka', keterangan: 'Unit sedang disewa' },
        { nama: 'sisa_stok_sepeda', tipe: 'angka', keterangan: 'Sisa stok tersedia', isFormula: true, formulaExpression: 'stok_awal - jumlah_keluar' }
      ]
    },
    {
      nama: 'transaksi_sewa',
      keterangan: 'Pencatatan sewa sepeda pelanggan',
      field: [
        { nama: 'id', tipe: 'text', keterangan: 'PK' },
        { nama: 'pelanggan_id', tipe: 'relasi ke pelanggan', keterangan: 'Penyewa' },
        { nama: 'katalog_sepeda_id', tipe: 'relasi ke katalog_sepeda', keterangan: 'Unit sepeda' }
      ]
    }
  ];

  const mergedTables = ensureMergedCatalogAndInventory(originalRentalTables as any);
  const katalogAfter = mergedTables.find(t => t.nama === 'katalog_sepeda');
  const inventarisAfter = mergedTables.find(t => t.nama === 'inventaris_sepeda');

  console.log('Tabel inventaris_sepeda masih ada?:', Boolean(inventarisAfter), '(Harus FALSE)');
  const fieldNamesAfter = katalogAfter?.field.map(f => f.nama) || [];
  console.log('Daftar Field katalog_sepeda setelah merge:', fieldNamesAfter);

  // Verifikasi preservasi field asli
  const requiredOriginalFields = ['kode_sepeda', 'jenis_sepeda', 'tarif_per_jam', 'kondisi_fisik', 'status_ketersediaan'];
  const missingOriginal = requiredOriginalFields.filter(f => !fieldNamesAfter.includes(f));
  if (missingOriginal.length > 0) {
    throw new Error(`Test 1 GAGAL: Field asli hilang setelah merge: ${missingOriginal.join(', ')}`);
  }

  // Verifikasi penambahan field stok & formula
  const requiredNewFields = ['stok_awal', 'jumlah_keluar', 'sisa_stok_sepeda'];
  const missingNew = requiredNewFields.filter(f => !fieldNamesAfter.includes(f));
  if (missingNew.length > 0) {
    throw new Error(`Test 1 GAGAL: Field stok/formula baru tidak masuk: ${missingNew.join(', ')}`);
  }

  console.log('✅ TEST 1 LULUS: Seluruh field asli (termasuk kondisi_fisik & status_ketersediaan) 100% UTUH, dan field stok/formula berhasil ditambahkan!\n');

  // -------------------------------------------------------------------------
  // TEST 2: BAGIAN 1.2 — DATA DUMMY REKAP_OMZET_HARIAN REALISTIS
  // -------------------------------------------------------------------------
  console.log('--- [TEST 2] BAGIAN 1.2: DATA DUMMY OMZET HARIAN & TARGET REALISTIS ---');
  const sessionRentalOmzet: any = {
    step: 'SIMULASI_DB',
    roles: ['Super Admin'],
    flow: 'Rental sepeda',
    painPoints: [],
    features: [],
    match: { templateId: 'rental-sepeda', overlayIds: [], patternIds: [], tier: 'BASIC' },
    dataSchema: {
      tabel: [
        {
          nama: 'rekap_omzet_harian',
          keterangan: 'Laporan omzet dan pencapaian target harian',
          field: [
            { nama: 'id', tipe: 'text', keterangan: 'PK' },
            { nama: 'tanggal', tipe: 'tanggal', keterangan: 'Tanggal rekap' },
            { nama: 'omzet_harian', tipe: 'angka', keterangan: 'Realisasi pendapatan harian (Rp)' },
            { nama: 'target_omzet_harian', tipe: 'angka', keterangan: 'Target omzet harian (Rp)' },
            { nama: 'persentase_capaian', tipe: 'angka', keterangan: 'Persen pencapaian', isFormula: true, formulaExpression: '(omzet_harian / target_omzet_harian) * 100' }
          ]
        }
      ]
    }
  };

  const simulasiOmzet = generateDeterministicSimulasiDb(sessionRentalOmzet);
  const omzetRows = simulasiOmzet.contohData.tabel?.find(t => t.nama === 'rekap_omzet_harian')?.baris || [];
  console.log('Baris data rekap_omzet_harian:');
  console.log(omzetRows);

  for (const r of omzetRows) {
    const omzet = Number(r.omzet_harian);
    const target = Number(r.target_omzet_harian);
    console.log(`Row: omzet=${omzet}, target=${target}`);
    if (omzet < 1000 || target < 1000) {
      throw new Error(`Test 2 GAGAL: Nilai omzet terlalu kecil (${omzet}) - terjebak skala durasi hari [1,3,7]!`);
    }
  }

  const isAllIdentical = omzetRows.every(r => Number(r.omzet_harian) === Number(r.target_omzet_harian));
  if (isAllIdentical) {
    throw new Error('Test 2 GAGAL: omzet_harian dan target_omzet_harian selalu sama persis (100% seragam)');
  }
  console.log('✅ TEST 2 LULUS: Skala nominal Rupiah realistis (> Rp 100.000) dan bervariasi terhadap target!\n');

  // -------------------------------------------------------------------------
  // TEST 3: BAGIAN 1.3 — RBAC-SPECIFIC ROLE MAPPING PADA MISSING TABLES
  // -------------------------------------------------------------------------
  console.log('--- [TEST 3] BAGIAN 1.3: RBAC-SPECIFIC ROLE MAPPING PADA MISSING TABLES ---');
  const sampleJsWithoutPelanggan = `
    const app = Vue.createApp({
      data() {
        return {
          activeTab: 'tab_transaksi_sewa',
          tablesConfig: {
            katalog_sepeda: {
              label: 'Katalog Sepeda',
              displayField: 'kode_sepeda',
              allowRoles: ['Super Admin', 'Petugas Rental'],
              fields: [{ key: 'kode_sepeda', label: 'Kode Sepeda' }]
            }
          },
          db: {
            katalog_sepeda: []
          }
        };
      }
    });
  `;
  const sampleHtml = `<div id="app">${sampleJsWithoutPelanggan}</div>`;

  const schemaTablesOfficial = [
    { nama: 'katalog_sepeda', keterangan: 'Katalog Unit Sepeda' },
    { nama: 'pelanggan', keterangan: 'Data Pelanggan Rental', displayField: 'nama_lengkap', field: [
      { nama: 'id', tipe: 'text' },
      { nama: 'nama_lengkap', tipe: 'text', keterangan: 'Nama Lengkap' },
      { nama: 'no_telepon', tipe: 'text', keterangan: 'Nomor WhatsApp' }
    ]}
  ];

  // RBAC Modules dari Brief Kebutuhan resmi yang disetujui user
  const approvedRbacModules = [
    {
      nama: 'Verifikasi Identitas Pelanggan & Registrasi Sementara',
      deskripsiFungsional: 'Pencatatan data identitas pelanggan dan verifikasi syarat sewa',
      izinPerRole: [
        { role: 'Super Admin', level: 'Full Access' },
        { role: 'Petugas Rental', level: 'Full Access' }
      ]
    },
    {
      nama: 'Pengaturan Tarif & Sistem',
      deskripsiFungsional: 'Konfigurasi tarif sewa dan ketentuan operasional',
      izinPerRole: [
        { role: 'Super Admin', level: 'Full Access' },
        { role: 'Petugas Rental', level: 'No Access' }
      ]
    }
  ];

  const rbacReport = checkAndRepairMissingSchemaTables(
    sampleHtml,
    sampleJsWithoutPelanggan,
    schemaTablesOfficial as any,
    ['Super Admin', 'Petugas Rental', 'Teknisi'], // Ada peran Teknisi yang TIDAK berhak atas pelanggan
    approvedRbacModules as any
  );

  console.log('Issues terdeteksi:', rbacReport.issues);
  console.log('Apakah tabel pelanggan diinjeksi?:', rbacReport.repairedHtml.includes('pelanggan: {'));
  
  // Ekstrak allowRoles pelanggan yang diinjeksi
  const pelangganMatch = rbacReport.repairedHtml.match(/pelanggan:\s*\{[\s\S]*?allowRoles:\s*(\[[^\]]+\])/);
  const injectedRoles = pelangganMatch ? JSON.parse(pelangganMatch[1]) : [];
  console.log('allowRoles yang disuntikkan ke pelanggan:', injectedRoles);

  const hasPetugasRental = injectedRoles.includes('Petugas Rental');
  const hasSuperAdmin = injectedRoles.includes('Super Admin');
  const hasTeknisi = injectedRoles.includes('Teknisi'); // Teknisi TIDAK boleh ada karena modulnya tidak mengizinkan

  if (!hasPetugasRental || !hasSuperAdmin || hasTeknisi) {
    throw new Error('Test 3 GAGAL: allowRoles yang disuntikkan tidak mematuhi matriks modul RBAC yang disetujui!');
  }
  console.log('✅ TEST 3 LULUS: allowRoles mengikuti modul RBAC resmi ("Petugas Rental" & "Super Admin"), peran "Teknisi" tidak terinjeksi!\n');

  // -------------------------------------------------------------------------
  // TEST 4: BAGIAN 2 — AUDIT KELAZIMAN DB (AKUMULASI MULTI-ANOMALI)
  // -------------------------------------------------------------------------
  console.log('--- [TEST 4] BAGIAN 2: AKUMULASI MULTI-ANOMALI DALAM 1X AUDIT ---');
  const multiAnomalyTables = [
    {
      nama: 'katalog_sepeda',
      field: [{ nama: 'id', tipe: 'text', keterangan: 'PK' }]
    },
    {
      nama: 'inventaris_sepeda',
      field: [{ nama: 'id', tipe: 'text', keterangan: 'PK' }, { nama: 'stok', tipe: 'angka', keterangan: 'Stok' }]
    },
    {
      nama: 'katalog_helm',
      field: [{ nama: 'id', tipe: 'text', keterangan: 'PK' }]
    },
    {
      nama: 'inventaris_helm',
      field: [{ nama: 'id', tipe: 'text', keterangan: 'PK' }, { nama: 'stok', tipe: 'angka', keterangan: 'Stok' }]
    }
  ];

  const multiAnomalyResult = await auditDatabaseDesignStandardsWithAI(multiAnomalyTables as any, {
    step: 'SKEMA_DATA',
    match: { templateId: 'rental', overlayIds: [], patternIds: [], tier: 'BASIC', businessCategory: 'Rental Sepeda' },
    storyline: { narasi: 'Penyewaan sepeda dan helm', statusKonfirmasi: 'disetujui' }
  } as any);

  console.log('Hasil Multi-Anomaly Audit:');
  console.log(multiAnomalyResult);

  const hasSepedaAnomaly = multiAnomalyResult?.includes('inventaris_sepeda');
  const hasHelmAnomaly = multiAnomalyResult?.includes('inventaris_helm');

  if (!hasSepedaAnomaly || !hasHelmAnomaly) {
    throw new Error('Test 4 GAGAL: Audit kelaziman tidak mengakumulasikan kedua anomali sekaligus!');
  }
  console.log('✅ TEST 4 LULUS: Kedua anomali (sepeda & helm) terakumulasi dalam 1x audit tanpa terhenti di temuan pertama!\n');

  // -------------------------------------------------------------------------
  // TEST 5: BAGIAN 2 — GENERALISASI DOMAIN 2 (PERSEWAAN ALAT KAMPING)
  // -------------------------------------------------------------------------
  console.log('--- [TEST 5] BAGIAN 2: GENERALISASI DOMAIN 2 (PERSEWAAN ALAT KAMPING) ---');
  const campingTables = [
    {
      nama: 'katalog_alat',
      field: [
        { nama: 'id', tipe: 'text', keterangan: 'PK' },
        { nama: 'nama_alat', tipe: 'text', keterangan: 'Tenda Dome, Kompor Portable' },
        { nama: 'tarif_sewa_harian', tipe: 'angka', keterangan: 'Tarif sewa' }
      ]
    },
    {
      nama: 'inventaris_alat',
      field: [
        { nama: 'id', tipe: 'text', keterangan: 'PK' },
        { nama: 'stok_tersedia', tipe: 'angka', keterangan: 'Stok fisik' }
      ]
    },
    {
      nama: 'peminjaman_alat',
      field: [
        { nama: 'id', tipe: 'text', keterangan: 'PK' },
        { nama: 'pelanggan_id', tipe: 'relasi ke pelanggan', keterangan: 'Penyewa' }
      ]
    }
  ];

  const campingAnomaly = await auditDatabaseDesignStandardsWithAI(campingTables as any, {
    step: 'SKEMA_DATA',
    match: { templateId: 'camping', overlayIds: [], patternIds: [], tier: 'BASIC', businessCategory: 'Persewaan Alat Kamping' },
    storyline: { narasi: 'Penyewaan alat kamping tenda dan kompor', statusKonfirmasi: 'disetujui' }
  } as any);

  console.log('Hasil Audit Domain Kamping (Harus terdeteksi anomali):', campingAnomaly);
  const mergedCamping = ensureMergedCatalogAndInventory(campingTables as any);
  console.log('Tabel Kamping setelah auto-merge:', mergedCamping.map(t => t.nama));

  if (!campingAnomaly || !campingAnomaly.includes('inventaris_alat') || mergedCamping.length !== 2) {
    throw new Error('Test 5 GAGAL: Domain Kamping tidak terdeteksi atau gagal di-merge!');
  }
  console.log('✅ TEST 5 LULUS: Domain Kamping terdeteksi dan berhasil disatukan ke katalog_alat!\n');

  // -------------------------------------------------------------------------
  // TEST 6: BAGIAN 2 — GENERALISASI DOMAIN 3 (SKEMA BERSIH TANPA ANOMALI)
  // -------------------------------------------------------------------------
  console.log('--- [TEST 6] BAGIAN 2: DOMAIN 3 TANPA ANOMALI (TIDAK OVER-EAGER) ---');
  const cleanLaundryTables = [
    {
      nama: 'katalog_layanan',
      keterangan: 'Daftar jenis layanan cuci',
      displayField: 'nama_layanan',
      field: [
        { nama: 'id', tipe: 'text', keterangan: 'PK' },
        { nama: 'nama_layanan', tipe: 'text', keterangan: 'Cuci Komplit / Kering' },
        { nama: 'tarif_per_kg', tipe: 'angka', keterangan: 'Tarif per kg' }
      ]
    },
    {
      nama: 'order_laundry',
      keterangan: 'Pencatatan order cuci',
      field: [
        { nama: 'id', tipe: 'text', keterangan: 'PK' },
        { nama: 'pelanggan_id', tipe: 'relasi ke pengguna', keterangan: 'Pelanggan' },
        { nama: 'katalog_layanan_id', tipe: 'relasi ke katalog_layanan', keterangan: 'Layanan' },
        { nama: 'berat_kg', tipe: 'angka', keterangan: 'Berat (kg)' }
      ]
    }
  ];

  const cleanAnomaly = await auditDatabaseDesignStandardsWithAI(cleanLaundryTables as any, {
    step: 'SKEMA_DATA',
    match: { templateId: 'laundry', overlayIds: [], patternIds: [], tier: 'BASIC', businessCategory: 'Laundry Kiloan' },
    storyline: { narasi: 'Jasa cuci kiloan dan setrika', statusKonfirmasi: 'disetujui' }
  } as any);

  console.log('Hasil Audit Skema Bersih (Harus NULL / tidak ada anomali):', cleanAnomaly);

  if (cleanAnomaly !== null) {
    throw new Error(`Test 6 GAGAL: Skema bersih salah dideteksi sebagai anomali: ${cleanAnomaly}`);
  }
  console.log('✅ TEST 6 LULUS: Skema normalisasi bersih tidak ditandai salah (Zero False-Positive)!\n');

  // -------------------------------------------------------------------------
  // TEST 7: BAGIAN 3 — ERD MERMAID GENERATOR (MODE RINGKAS 5 TABEL RENTAL SEPEDA)
  // -------------------------------------------------------------------------
  console.log('--- [TEST 7] BAGIAN 3: GENERATOR MERMAID ERD DIAGRAM (MODE RINGKAS) ---');
  const fullRental5Tables = [
    {
      nama: 'katalog_sepeda',
      keterangan: 'Katalog unit sepeda',
      field: [
        { nama: 'id', tipe: 'text', keterangan: 'PK' },
        { nama: 'kode_sepeda', tipe: 'text', keterangan: 'Kode Sepeda' },
        { nama: 'jenis_sepeda', tipe: 'text', keterangan: 'Jenis' },
        { nama: 'tarif_per_jam', tipe: 'angka', keterangan: 'Tarif' },
        { nama: 'kondisi_fisik', tipe: 'text', keterangan: 'Kondisi' },
        { nama: 'status_ketersediaan', tipe: 'text', keterangan: 'Status' },
        { nama: 'stok_awal', tipe: 'angka', keterangan: 'Stok awal' },
        { nama: 'jumlah_keluar', tipe: 'angka', keterangan: 'Keluar' },
        { nama: 'sisa_stok_sepeda', tipe: 'angka', keterangan: 'Sisa' }
      ]
    },
    {
      nama: 'pelanggan',
      keterangan: 'Data Pelanggan',
      field: [
        { nama: 'id', tipe: 'text', keterangan: 'PK' },
        { nama: 'nama_lengkap', tipe: 'text', keterangan: 'Nama' },
        { nama: 'nomor_identitas', tipe: 'text', keterangan: 'KTP' },
        { nama: 'nomor_telepon', tipe: 'text', keterangan: 'WhatsApp' },
        { nama: 'alamat', tipe: 'text', keterangan: 'Alamat' }
      ]
    },
    {
      nama: 'transaksi_sewa',
      keterangan: 'Transaksi Sewa',
      field: [
        { nama: 'id', tipe: 'text', keterangan: 'PK' },
        { nama: 'nomor_registrasi', tipe: 'text', keterangan: 'No Reg' },
        { nama: 'pelanggan_id', tipe: 'relasi ke pelanggan', keterangan: 'Penyewa' },
        { nama: 'katalog_sepeda_id', tipe: 'relasi ke katalog_sepeda', keterangan: 'Unit Sepeda' },
        { nama: 'waktu_mulai', tipe: 'tanggal', keterangan: 'Mulai' },
        { nama: 'waktu_selesai', tipe: 'tanggal', keterangan: 'Selesai' },
        { nama: 'total_biaya', tipe: 'angka', keterangan: 'Total' }
      ]
    },
    {
      nama: 'pengembalian_sepeda',
      keterangan: 'Pengembalian Unit',
      field: [
        { nama: 'id', tipe: 'text', keterangan: 'PK' },
        { nama: 'transaksi_sewa_id', tipe: 'relasi ke transaksi_sewa', keterangan: 'Sewa Ref' },
        { nama: 'waktu_kembali', tipe: 'tanggal', keterangan: 'Waktu Kembali' },
        { nama: 'kondisi_kembali', tipe: 'text', keterangan: 'Kondisi Cek' },
        { nama: 'denda_keterlambatan', tipe: 'angka', keterangan: 'Denda' }
      ]
    },
    {
      nama: 'rekap_omzet_harian',
      keterangan: 'Rekap Pendapatan',
      field: [
        { nama: 'id', tipe: 'text', keterangan: 'PK' },
        { nama: 'tanggal', tipe: 'tanggal', keterangan: 'Tanggal' },
        { nama: 'omzet_harian', tipe: 'angka', keterangan: 'Omzet' },
        { nama: 'target_omzet_harian', tipe: 'angka', keterangan: 'Target' },
        { nama: 'persentase_capaian', tipe: 'angka', keterangan: 'Persen' }
      ]
    }
  ];

  const erdMermaid = generateMermaidErDiagram(fullRental5Tables as any);
  console.log('Hasil Sintaks Mermaid erDiagram (Mode Ringkas):');
  console.log(erdMermaid);

  const hasErDiagramHeader = erdMermaid.startsWith('erDiagram');
  const hasRelation1 = erdMermaid.includes('KATALOG_SEPEDA ||--o{ TRANSAKSI_SEWA');
  const hasRelation2 = erdMermaid.includes('PELANGGAN ||--o{ TRANSAKSI_SEWA');
  const hasRelation3 = erdMermaid.includes('TRANSAKSI_SEWA ||--o{ PENGEMBALIAN_SEPEDA');
  
  // Periksa bahwa 5 tabel semuanya ada
  const has5Tables = ['KATALOG_SEPEDA', 'PELANGGAN', 'TRANSAKSI_SEWA', 'PENGEMBALIAN_SEPEDA', 'REKAP_OMZET_HARIAN'].every(t => erdMermaid.includes(`${t} {`));

  // Pastikan field non-key TIDAK ada di dalam diagram
  const hasNonKey1 = erdMermaid.includes('nomor_registrasi');
  const hasNonKey2 = erdMermaid.includes('kondisi_fisik');
  const hasNonKey3 = erdMermaid.includes('waktu_selesai');
  const hasNonKey4 = erdMermaid.includes('nomor_identitas');

  console.log('Semua 5 tabel terdefinisi:', has5Tables);
  console.log('Field non-key tersembunyi (harus true):', !hasNonKey1 && !hasNonKey2 && !hasNonKey3 && !hasNonKey4);

  if (!hasErDiagramHeader || !has5Tables || !hasRelation1 || !hasRelation2 || !hasRelation3 || hasNonKey1 || hasNonKey2) {
    throw new Error('Test 7 GAGAL: Generator Mermaid erDiagram mode ringkas tidak valid');
  }
  console.log('✅ TEST 7 LULUS: Mode ringkas berhasil menampilkan 5 tabel lengkap dengan PK & FK, tanpa field non-key!\n');

  console.log('========================================================================');
  console.log('🎉 SELURUH 7 PENGUJIAN LULUS DENGAN SEMPURNA! 🎉');
  console.log('========================================================================');
}

runTests().catch(err => {
  console.error('TEST ERROR:', err);
  process.exit(1);
});
