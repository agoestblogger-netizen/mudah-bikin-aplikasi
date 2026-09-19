import assert from 'assert';
import {
  extractFormulaVariables,
  renderFormulaMarkdownTable,
  type BusinessFormula,
  type DomainProfile,
  type MockupSessionState
} from '../src/lib/templates';
import {
  filterFormulasByDomainProfile,
  ensureMergedSingleCycleRentalTransactions,
  ensureDomainProfileEntitiesInSchema,
  ensureDomainProfileEntitiesAndViews,
  ensureFormulaFieldsInTargetTables,
  isFieldAllowedByDomainProfile,
  sanitizeSchemaFieldsByDomainProfile
} from '../src/app/api/guided/route';
import { checkAndRepairMissingSchemaTables } from '../src/lib/codeValidator';

console.log('--- TEST 1: Sinkronisasi komponenInput dari formulaExpression (Point 1) ---');
{
  const rawFormulas: BusinessFormula[] = [
    {
      namaField: 'total_biaya',
      labelField: 'Total Biaya Sewa',
      targetTable: 'transaksi_sewa',
      deskripsi: 'Total biaya sewa',
      formulaText: 'durasi_jam * tarif_per_jam + denda_keterlambatan',
      // AI salah mencantumkan 'deposit' di komponenInput meski tidak ada di formulaExpression
      komponenInput: ['durasi_jam', 'tarif_per_jam', 'deposit', 'denda_keterlambatan'],
      tipeOperasi: 'kombinasi',
      formulaExpression: 'durasi_jam * tarif_per_jam + denda_keterlambatan'
    },
    {
      namaField: 'sisa_tagihan',
      labelField: 'Sisa Tagihan Pelunasan',
      targetTable: 'transaksi_sewa',
      deskripsi: 'Sisa tagihan setelah deposit',
      formulaText: 'total_biaya - deposit_diterima',
      komponenInput: ['total_biaya', 'deposit_diterima', 'ongkir_siluman'],
      tipeOperasi: 'pengurangan',
      formulaExpression: 'total_biaya - deposit_diterima'
    }
  ];

  const profile: DomainProfile = {
    modelOperasional: 'DI_TEMPAT',
    modelTarif: 'SEWA_DURASI',
    adaJaminanDeposit: true,
    fungsiDeposit: 'Jaminan unit sepeda',
    entitasKatalogMaster: ['sepeda'],
    entitasPencatatanTransaksi: ['transaksi_sewa', 'pembayaran_deposit', 'pelunasan_biaya', 'laporan_harian'],
    komponenBiayaYangLazim: ['durasi_jam', 'tarif_per_jam', 'deposit_diterima', 'denda_keterlambatan', 'total_biaya', 'sisa_tagihan']
  };

  const parsedVars = extractFormulaVariables(rawFormulas[0].formulaExpression);
  assert.deepStrictEqual(parsedVars, ['durasi_jam', 'tarif_per_jam', 'denda_keterlambatan']);
  assert.ok(!parsedVars.includes('deposit'), 'extractFormulaVariables tidak boleh memuat deposit');

  const filtered = filterFormulasByDomainProfile(rawFormulas, profile);
  assert.strictEqual(filtered.length, 2);
  
  // Verifikasi 'deposit' halusinasi telah dibersihkan dari komponenInput
  assert.deepStrictEqual(filtered[0].komponenInput, ['durasi_jam', 'tarif_per_jam', 'denda_keterlambatan']);
  assert.deepStrictEqual(filtered[1].komponenInput, ['total_biaya', 'deposit_diterima']);

  // Verifikasi markdown table hanya mencantumkan variabel yang benar-benar ada di ekspresi
  const md = renderFormulaMarkdownTable(filtered);
  assert.ok(!md.includes('`durasi_jam, tarif_per_jam, deposit, denda_keterlambatan`'), 'Markdown table tidak boleh menampilkan deposit di komponen total_biaya');
  assert.ok(md.includes('`durasi_jam, tarif_per_jam, denda_keterlambatan`'), 'Markdown table harus menampilkan komponenInput yang tersinkronisasi');

  console.log('✅ PASS Test 1: komponenInput berhasil disinkronkan murni dari parsing formulaExpression');
}

console.log('--- TEST 2: Snapshot Field di Tabel Target Formula (Point 2 - Opsi A) ---');
{
  const mockTables = [
    {
      nama: 'pengguna',
      field: [
        { nama: 'id', tipe: 'text', keterangan: 'ID' },
        { nama: 'nama_lengkap', tipe: 'text', keterangan: 'Nama' }
      ]
    },
    {
      nama: 'katalog_sepeda',
      field: [
        { nama: 'id', tipe: 'text', keterangan: 'ID unit' },
        { nama: 'kode_unit', tipe: 'text', keterangan: 'Kode Sepeda' },
        { nama: 'tarif_per_jam', tipe: 'angka', keterangan: 'Tarif sewa per jam katalog' }
      ]
    },
    {
      nama: 'transaksi_sewa',
      field: [
        { nama: 'id', tipe: 'text', keterangan: 'ID transaksi' },
        { nama: 'sepeda_id', tipe: 'relasi ke katalog_sepeda', keterangan: 'Sepeda yang disewa' },
        { nama: 'durasi_jam', tipe: 'angka', keterangan: 'Durasi peminjaman' },
        { nama: 'denda_keterlambatan', tipe: 'angka', keterangan: 'Denda keterlambatan' }
      ]
    }
  ];

  const formulas: BusinessFormula[] = [
    {
      namaField: 'total_biaya',
      labelField: 'Total Biaya',
      targetTable: 'transaksi_sewa',
      deskripsi: 'Total biaya sewa',
      formulaText: 'durasi_jam * tarif_per_jam + denda_keterlambatan',
      komponenInput: ['durasi_jam', 'tarif_per_jam', 'denda_keterlambatan'],
      formulaExpression: 'durasi_jam * tarif_per_jam + denda_keterlambatan'
    }
  ];

  // Sebelum ensureFormulaFieldsInTargetTables, transaksi_sewa TIDAK punya tarif_per_jam
  const sewaBefore = mockTables.find(t => t.nama === 'transaksi_sewa')!;
  assert.ok(!sewaBefore.field.some(f => f.nama === 'tarif_per_jam'));

  const processedTables = ensureFormulaFieldsInTargetTables(mockTables, formulas);
  const sewaAfter = processedTables.find(t => t.nama === 'transaksi_sewa')!;

  // Setelah ensureFormulaFieldsInTargetTables, tarif_per_jam disalin sebagai snapshot field ke transaksi_sewa!
  const snapshotField = sewaAfter.field.find(f => f.nama === 'tarif_per_jam');
  assert.ok(snapshotField, 'Field tarif_per_jam WAJIB ada di transaksi_sewa sebagai snapshot field');
  assert.strictEqual(snapshotField?.tipe, 'angka');
  assert.ok(snapshotField?.keterangan.includes('snapshot dari katalog_sepeda'), 'Keterangan harus mencatat snapshot untuk audit trail');

  // Field total_biaya juga harus ada dengan flag isFormula
  const totalBiayaField = sewaAfter.field.find(f => f.nama === 'total_biaya');
  assert.ok(totalBiayaField, 'Field total_biaya harus ada');
  assert.strictEqual((totalBiayaField as any).isFormula, true);
  assert.strictEqual((totalBiayaField as any).formulaExpression, 'durasi_jam * tarif_per_jam + denda_keterlambatan');

  console.log('✅ PASS Test 2: Field formula disalin langsung ke tabel transaksi sebagai snapshot audit trail');
}

console.log('--- TEST 3: Evaluasi computeFormulaValue dengan Relasi Fallback (Point 2 - Opsi B) ---');
{
  // Simulasi runtime Vue instance Mixin Pilar 1
  const mockVueContext: any = {
    tables: {
      katalog_sepeda: [
        { id: 'SEP-01', kode_unit: 'SP-01', tarif_per_jam: 25000 }
      ]
    },
    computeFormulaValue(form: any, fld: any) {
      if (!form || !fld) return 0;
      if (fld.formulaExpression) {
        try {
          var expr = fld.formulaExpression;
          var ctx = Object.assign({}, form);
          var dbSource = (this && this.db) || (this && this.tables) || (typeof window !== 'undefined' && (window as any).__mockDb);
          if (dbSource) {
            for (var key in form) {
              if (key.endsWith('_id') && form[key]) {
                var targetName = key.slice(0, -3).toLowerCase();
                var tableKeys = Object.keys(dbSource);
                var matchedKey = tableKeys.find(function(k) {
                  var lk = k.toLowerCase();
                  return lk === targetName || lk === 'katalog_' + targetName || lk === targetName + 's';
                });
                if (matchedKey && Array.isArray(dbSource[matchedKey])) {
                  var targetRow = dbSource[matchedKey].find(function(r: any) { return r && r.id === form[key]; });
                  if (targetRow) {
                    for (var rk in targetRow) {
                      if (ctx[rk] === undefined || ctx[rk] === null) {
                        ctx[rk] = targetRow[rk];
                      }
                    }
                  }
                }
              }
            }
          }
          var evaluated = new Function('f', 'with(f) { return (' + expr + '); }')(ctx);
          return isNaN(evaluated) || !isFinite(evaluated) ? 0 : evaluated;
        } catch (e) {
          return form[fld.key] || 0;
        }
      }
      return form[fld.key] || 0;
    }
  };

  const fieldFormula = {
    key: 'total_biaya',
    formulaExpression: 'durasi_jam * tarif_per_jam + denda_keterlambatan'
  };

  // Kasus: form TIDAK punya field tarif_per_jam secara langsung, hanya punya sepeda_id
  const formWithoutDirectTarif = {
    sepeda_id: 'SEP-01',
    durasi_jam: 3,
    denda_keterlambatan: 5000
  };

  const calculated = mockVueContext.computeFormulaValue(formWithoutDirectTarif, fieldFormula);
  // 3 jam * 25000 + 5000 = 80000
  assert.strictEqual(calculated, 80000, 'computeFormulaValue harus dapat menembus relasi sepeda_id untuk resolve tarif_per_jam');

  console.log('✅ PASS Test 3: computeFormulaValue menembus 1 lapis relasi untuk resolve variabel katalog');
}

console.log('--- TEST 4: Proteksi & Regenerasi rekap_transaksi_harian (Point 3) ---');
{
  const mockTables = [
    {
      nama: 'katalog_sepeda',
      field: [{ nama: 'id', tipe: 'text', keterangan: 'ID' }]
    },
    {
      nama: 'transaksi_sewa',
      field: [{ nama: 'id', tipe: 'text', keterangan: 'ID' }]
    },
    {
      nama: 'pembayaran_deposit',
      field: [{ nama: 'id', tipe: 'text', keterangan: 'ID' }, { nama: 'deposit_diterima', tipe: 'angka', keterangan: 'Deposit' }]
    },
    {
      nama: 'rekap_transaksi_harian',
      field: [
        { nama: 'id', tipe: 'text', keterangan: 'ID' },
        { nama: 'tanggal_rekap', tipe: 'tanggal', keterangan: 'Tanggal' },
        { nama: 'total_pendapatan', tipe: 'angka', keterangan: 'Pendapatan' }
      ]
    }
  ];

  // 1. Uji ensureMergedSingleCycleRentalTransactions TIDAK menghapus rekap_transaksi_harian
  const merged = ensureMergedSingleCycleRentalTransactions(mockTables);
  const rekapPresent = merged.some(t => t.nama.toLowerCase() === 'rekap_transaksi_harian');
  assert.ok(rekapPresent, 'rekap_transaksi_harian TIDAK BOLEH dihapus oleh ensureMergedSingleCycleRentalTransactions');

  // Pembayaran 1:1 harus tetap digabung ke transaksi_sewa
  const pembayaranPresent = merged.some(t => t.nama.toLowerCase() === 'pembayaran_deposit');
  assert.ok(!pembayaranPresent, 'pembayaran_deposit (1:1 child) harus digabung');

  // 2. Uji jika rekap_transaksi_harian sama sekali belum ada, ensureDomainProfileEntitiesInSchema akan membuatnya
  const sessionRental: any = {
    step: 'SKEMA_DATA',
    match: {
      templateId: 'MT-20',
      overlayIds: [],
      patternIds: [],
      tier: 'MENENGAH',
      businessCategory: 'Rental Sepeda'
    },
    storyline: {
      narasi: 'Sewa sepeda tepi pantai dengan deposit. Di akhir shift, kasir menghitung uang fisik di laci dan mencatat penutupan kasir harian secara manual.',
      asumsiAlurUtama: 'Penyewa datang, sewa, kembalikan, kasir tutup shift'
    },
    flow: {
      alurInti: [],
      alurPendukung: [],
      fiturPendukung: ['Laporan akhir harian otomatis: rekap transaksi penyewaan dan total omzet']
    },
    domainProfile: {
      modelOperasional: 'DI_TEMPAT',
      modelTarif: 'SEWA_DURASI',
      adaJaminanDeposit: true,
      entitasKatalogMaster: ['sepeda'],
      entitasPencatatanTransaksi: ['transaksi_sewa', 'pembayaran_deposit', 'pelunasan_biaya', 'laporan_harian'],
      komponenBiayaYangLazim: ['durasi_jam', 'tarif_per_jam', 'deposit_diterima']
    }
  };

  const tablesWithoutReport = [
    {
      nama: 'katalog_sepeda',
      field: [{ nama: 'id', tipe: 'text', keterangan: 'ID' }]
    },
    {
      nama: 'transaksi_sewa',
      field: [{ nama: 'id', tipe: 'text', keterangan: 'ID' }]
    }
  ];

  const withReport = ensureDomainProfileEntitiesInSchema(tablesWithoutReport, sessionRental);
  const foundReport = withReport.find(t => t.nama === 'rekap_transaksi_harian');
  assert.ok(foundReport, 'ensureDomainProfileEntitiesInSchema harus menghasilkan tabel rekap_transaksi_harian');
  assert.ok(foundReport?.field.some(f => f.nama === 'tanggal_rekap'), 'Field tanggal_rekap harus ada');
  assert.ok(foundReport?.field.some(f => f.nama === 'total_pendapatan'), 'Field total_pendapatan harus ada');

  console.log('✅ PASS Test 4: rekap_transaksi_harian terlindungi dari penghapusan & digenerate otomatis');
}

console.log('\n--- TEST 5: Gerbang Universal Whitelist & Sanitization Sweep ---');
{
  const dpRental: DomainProfile = {
    modelOperasional: 'DI_TEMPAT',
    modelTarif: 'SEWA_DURASI',
    adaJaminanDeposit: true,
    entitasKatalogMaster: ['sepeda'],
    entitasPencatatanTransaksi: ['transaksi_sewa'],
    komponenBiayaYangLazim: ['durasi_jam', 'tarif_per_jam', 'deposit_diterima', 'denda_keterlambatan']
  };

  const confirmedFormulas: BusinessFormula[] = [
    {
      namaField: 'total_biaya',
      labelField: 'Total Biaya',
      targetTable: 'transaksi_sewa',
      deskripsi: 'Total biaya',
      formulaText: 'durasi_jam * tarif_per_jam + denda_keterlambatan',
      komponenInput: ['durasi_jam', 'tarif_per_jam', 'denda_keterlambatan'],
      tipeOperasi: 'kombinasi',
      formulaExpression: 'durasi_jam * tarif_per_jam + denda_keterlambatan'
    }
  ];

  // 1. Uji isFieldAllowedByDomainProfile
  assert.strictEqual(isFieldAllowedByDomainProfile('durasi_jam', dpRental, confirmedFormulas), true);
  assert.strictEqual(isFieldAllowedByDomainProfile('denda_keterlambatan', dpRental, confirmedFormulas), true);
  assert.strictEqual(isFieldAllowedByDomainProfile('deposit_diterima', dpRental, confirmedFormulas), true);
  assert.strictEqual(isFieldAllowedByDomainProfile('total_biaya', dpRental, confirmedFormulas), true);
  assert.strictEqual(isFieldAllowedByDomainProfile('kondisi_saat_ambil', dpRental, confirmedFormulas), true);
  assert.strictEqual(isFieldAllowedByDomainProfile('kondisi_saat_kembali', dpRental, confirmedFormulas), true);

  // Field liar yang TIDAK diizinkan:
  assert.strictEqual(isFieldAllowedByDomainProfile('jumlah_bayar', dpRental, confirmedFormulas), false);
  assert.strictEqual(isFieldAllowedByDomainProfile('metode_pembayaran', dpRental, confirmedFormulas), false);
  assert.strictEqual(isFieldAllowedByDomainProfile('sisa_tagihan', dpRental, confirmedFormulas), false);
  assert.strictEqual(isFieldAllowedByDomainProfile('ongkir', dpRental, confirmedFormulas), false);

  // 2. Uji sanitizeSchemaFieldsByDomainProfile
  const dummyTables = [
    {
      nama: 'transaksi_sewa',
      field: [
        { nama: 'id', tipe: 'text', keterangan: 'ID' },
        { nama: 'durasi_jam', tipe: 'angka', keterangan: 'Durasi' },
        { nama: 'jumlah_bayar', tipe: 'angka', keterangan: 'Liar' },
        { nama: 'metode_pembayaran', tipe: 'pilihan', keterangan: 'Liar' },
        { nama: 'sisa_tagihan', tipe: 'angka', keterangan: 'Liar' },
        { nama: 'denda_keterlambatan', tipe: 'angka', keterangan: 'Sah' }
      ]
    }
  ];

  const sessionMock: any = {
    domainProfile: dpRental,
    formulas: { daftar: confirmedFormulas }
  };

  const sanitized = sanitizeSchemaFieldsByDomainProfile(dummyTables, sessionMock);
  const sewaFields = sanitized[0].field.map(f => f.nama);
  assert.ok(!sewaFields.includes('jumlah_bayar'), 'jumlah_bayar harus disapu bersih');
  assert.ok(!sewaFields.includes('metode_pembayaran'), 'metode_pembayaran harus disapu bersih');
  assert.ok(!sewaFields.includes('sisa_tagihan'), 'sisa_tagihan harus disapu bersih');
  assert.ok(sewaFields.includes('denda_keterlambatan'), 'denda_keterlambatan harus tetap ada');
  assert.ok(sewaFields.includes('durasi_jam'), 'durasi_jam harus tetap ada');

  console.log('✅ PASS Test 5: Gerbang Whitelist & Sanitization Sweep berfungsi sempurna');
}

console.log('\n--- TEST 6: Brace-Balancing & Silent Auto-Repair checkAndRepairMissingSchemaTables ---');
{
  const htmlWithMultiTables = `
    const app = Vue.createApp({
      data() {
        return {
          activeTab: 'sepeda',
          tabs: [
            { id: 'sepeda', label: 'Sepeda', icon: '🚲' }
          ],
          tablesConfig: {
            sepeda: {
              label: 'Sepeda',
              fields: [
                { key: 'nama_sepeda', label: 'Nama' }
              ]
            }
          },
          db: {
            sepeda: []
          }
        };
      }
    });
  `;

  const missingTables = [
    {
      nama: 'transaksi_sewa',
      label: 'Transaksi Sewa',
      field: [{ nama: 'id', tipe: 'text', keterangan: 'ID' }]
    },
    {
      nama: 'rekap_harian',
      label: 'Rekap Harian',
      field: [{ nama: 'id', tipe: 'text', keterangan: 'ID' }]
    }
  ];

  const result = checkAndRepairMissingSchemaTables(htmlWithMultiTables, '', missingTables, ['Admin']);
  // Karena perbaikan berhasil disuntikkan secara senyap, issues TIDAK boleh memuat SCHEMA_TABLE_MISSING_IN_CONFIG
  const hasBlockingIssue = result.issues.some(i => i.includes('SCHEMA_TABLE_MISSING_IN_CONFIG'));
  assert.strictEqual(hasBlockingIssue, false, 'Auto-repair berhasil tidak boleh menghasilkan blocking issue');
  assert.ok(result.repairedHtml.includes('transaksi_sewa:'), 'transaksi_sewa harus berhasil disuntikkan ke tablesConfig');
  assert.ok(result.repairedHtml.includes('rekap_harian:'), 'rekap_harian harus berhasil disuntikkan ke tablesConfig');
  assert.ok(result.repairedHtml.includes("id: 'transaksi_sewa'"), 'tab transaksi_sewa harus disuntikkan ke tabs');

  console.log('✅ PASS Test 6: Brace-Balancing parser & Silent auto-repair berjalan sempurna');
}

console.log('\n--- TEST 7: viewConfig (Computed View) vs Tabel Tersimpan & Validator Exemption ---');
async function runTest7() {
  // Skenario A: Default Laporan Turunan (Rental Sepeda Pemantauan Biasa)
  const sessionRentalDefault: any = {
    step: 'SKEMA_DATA',
    match: { businessCategory: 'Rental Sepeda' },
    storyline: {
      narasi: 'Sewa sepeda tepi pantai. Super Admin memantau laporan harian omzet dan transaksi penyewaan.',
      asumsiAlurUtama: 'Pelanggan sewa sepeda, bayar, kembalikan unit.'
    },
    flow: {
      alurInti: [
        { step: 1, pelaku: 'Pelanggan', aksi: 'Menyewa sepeda' },
        { step: 2, pelaku: 'Staf', aksi: 'Menyerahkan sepeda' },
        { step: 3, pelaku: 'Pelanggan', aksi: 'Mengembalikan sepeda' }
      ],
      fiturPendukung: ['Laporan harian mengenai omzet dan transaksi penyewaan untuk pemantauan oleh Super Admin']
    },
    domainProfile: {
      modelOperasional: 'DI_TEMPAT',
      modelTarif: 'SEWA_DURASI',
      adaJaminanDeposit: true,
      entitasKatalogMaster: ['sepeda'],
      entitasPencatatanTransaksi: ['transaksi_sewa'],
      komponenBiayaYangLazim: ['durasi_jam', 'tarif_per_jam', 'deposit_diterima']
    }
  };

  const initialTablesA = [
    { nama: 'pelanggan', field: [{ nama: 'id', tipe: 'text', keterangan: 'ID' }] },
    { nama: 'katalog_sepeda', field: [{ nama: 'id', tipe: 'text', keterangan: 'ID' }] },
    {
      nama: 'transaksi_sewa',
      field: [
        { nama: 'id', tipe: 'text', keterangan: 'ID' },
        { nama: 'jam_mulai', tipe: 'datetime', keterangan: 'Mulai' },
        { nama: 'total_biaya', tipe: 'angka', keterangan: 'Total Biaya' }
      ]
    },
    // Tabel rekap dummy yang mungkin dibuat AI sebelum sanitasi
    { nama: 'rekap_transaksi_harian', field: [{ nama: 'id', tipe: 'text', keterangan: 'ID' }] }
  ];

  const resA = await ensureDomainProfileEntitiesAndViews(initialTablesA, sessionRentalDefault);
  // Pastikan tabel rekap fisik DIHAPUS secara generik dari tables
  assert.strictEqual(
    resA.tables.some(t => /rekap|laporan|summary|omzet/i.test(t.nama)),
    false,
    'Tabel rekap fisik harus dihapus secara generik pada kasus pemantauan (default viewConfig)'
  );
  // Pastikan viewConfig terbentuk
  assert.strictEqual(resA.views.length, 1, 'Harus terbentuk 1 viewConfig laporan_harian');
  assert.strictEqual(resA.views[0].sourceTable, 'transaksi_sewa');
  assert.strictEqual(resA.views[0].aggregates.length >= 2, true);
  console.log('✅ PASS Test 7A: Default laporan pemantauan berhasil menjadi viewConfig (tanpa tabel fisik)');

  // Skenario B: Kontras Tutup Kasir Fisik Manual (Tabel Tersimpan)
  const sessionRentalClosing: any = {
    step: 'SKEMA_DATA',
    match: { businessCategory: 'Rental Sepeda' },
    storyline: {
      narasi: 'Sewa sepeda tepi pantai. Setiap sore kasir menghitung uang fisik di laci dan mencatat berita acara penutupan kasir harian.',
      asumsiAlurUtama: 'Pelanggan sewa sepeda, kembalikan, kasir tutup shift.'
    },
    flow: {
      alurInti: [
        { step: 1, pelaku: 'Pelanggan', aksi: 'Menyewa sepeda' },
        { step: 2, pelaku: 'Kasir', aksi: 'Menghitung uang fisik kas dan mencatat penutupan kasir harian di akhir shift' }
      ],
      fiturPendukung: ['Penutupan kasir harian dan serah terima shift']
    },
    domainProfile: {
      modelOperasional: 'DI_TEMPAT',
      modelTarif: 'SEWA_DURASI',
      adaJaminanDeposit: true,
      entitasKatalogMaster: ['sepeda'],
      entitasPencatatanTransaksi: ['transaksi_sewa'],
      komponenBiayaYangLazim: ['durasi_jam', 'tarif_per_jam', 'deposit_diterima']
    }
  };

  const initialTablesB = [
    { nama: 'pelanggan', field: [{ nama: 'id', tipe: 'text', keterangan: 'ID' }] },
    { nama: 'transaksi_sewa', field: [{ nama: 'id', tipe: 'text', keterangan: 'ID' }] }
  ];

  const resB = await ensureDomainProfileEntitiesAndViews(initialTablesB, sessionRentalClosing);
  assert.strictEqual(
    resB.tables.some(t => /rekap|laporan|summary|omzet/i.test(t.nama)),
    true,
    'Tabel rekap fisik HARUS dipertahankan untuk skenario operasional penutupan kasir manual'
  );
  assert.strictEqual(resB.views.length, 0, 'Views harus kosong karena sudah menjadi tabel fisik tersimpan');
  console.log('✅ PASS Test 7B: Kontras operasional tutup kasir manual berhasil mempertahankan tabel tersimpan');

  // Skenario C: Validator tidak mempermasalahkan view_* tab
  const htmlWithViewTab = `
    const app = Vue.createApp({
      data() {
        return {
          activeTab: 'view_laporan_harian',
          tabs: [
            { id: 'sepeda', label: 'Sepeda', icon: '🚲' },
            { id: 'view_laporan_harian', label: '📊 Laporan Harian (Read-Only)', icon: '📊', isView: true }
          ],
          tablesConfig: {
            sepeda: {
              label: 'Sepeda',
              fields: [{ key: 'nama_sepeda', label: 'Nama' }]
            }
          },
          viewsConfig: {
            laporan_harian: {
              label: 'Laporan Harian (Read-Only)',
              sourceTable: 'sepeda'
            }
          },
          db: { sepeda: [] }
        };
      }
    });
  `;
  const schemaTablesOnly = [{ nama: 'sepeda', field: [{ nama: 'nama_sepeda', tipe: 'text' }] }];
  const valRes = checkAndRepairMissingSchemaTables(htmlWithViewTab, '', schemaTablesOnly, ['Admin']);
  assert.strictEqual(valRes.issues.length, 0, 'Tab view_* tidak boleh menyebabkan issue missing table');
  console.log('✅ PASS Test 7C: Validator checkAndRepairMissingSchemaTables mengecualikan tab view_* secara aman');
}

runTest7().then(() => {
  console.log('\n🎉 ALL 7 TESTS PASSED! Seluruh arsitektur viewConfig & kelaziman laporan diverifikasi.');
}).catch((err) => {
  console.error('❌ Test 7 failed:', err);
  process.exit(1);
});

