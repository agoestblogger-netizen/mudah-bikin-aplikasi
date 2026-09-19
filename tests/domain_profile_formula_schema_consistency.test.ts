import assert from 'assert';
import {
  extractFormulaVariables,
  renderFormulaMarkdownTable,
  renderDomainProfileMarkdown,
  buildDomainProfileStep,
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
  sanitizeSchemaFieldsByDomainProfile,
  ensureStaffRecorderInActivityTables,
  formatModelOperasionalPrompt,
  formatModelTarifPrompt
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
                var matchedKey = tableKeys.find(function (k) {
                  var lk = k.toLowerCase();
                  return lk === targetName || lk === 'katalog_' + targetName || lk === targetName + 's';
                });
                if (matchedKey && Array.isArray(dbSource[matchedKey])) {
                  var targetRow = dbSource[matchedKey].find(function (r: any) { return r && r.id === form[key]; });
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

console.log('\n--- TEST 8: Opsi TIDAK_RELEVAN & Fallback komponenBiayaYangLazim Kosong ---');
{
  const crmProfile: DomainProfile = {
    modelOperasional: 'TIDAK_RELEVAN',
    modelTarif: 'TIDAK_RELEVAN',
    adaJaminanDeposit: false,
    entitasKatalogMaster: ['klien', 'layanan_konsultasi'],
    entitasPencatatanTransaksi: ['prospek_sales', 'aktivitas_follow_up'],
    komponenBiayaYangLazim: []
  };

  // 1. Markdown rendering harus netral dan jujur
  const md = renderDomainProfileMarkdown(crmProfile, 'CRM Sales B2B');
  assert.ok(md.includes('- **Model Operasional**: ⚪ Tidak berlaku untuk jenis aplikasi ini'), 'Model Operasional harus netral saat TIDAK_RELEVAN');
  assert.ok(md.includes('- **Model Tarif & Kalkulasi**: ⚪ Tidak berlaku untuk jenis aplikasi ini'), 'Model Tarif harus netral saat TIDAK_RELEVAN');
  assert.ok(md.includes('- **Whitelist Komponen Biaya Sah**: *(Tidak ada komponen biaya / murni non-finansial)*'), 'Whitelist kosong harus menampilkan teks informatif non-finansial');

  // 2. buildDomainProfileStep harus menampilkan label "Tidak berlaku"
  const mockSession: MockupSessionState = {
    step: 'DOMAIN_PROFILE',
    match: { templateId: 'MT-21', overlayIds: [], patternIds: [], tier: 'BASIC', businessCategory: 'CRM Sales B2B' },
    roles: { selected: ['Super Admin'] },
    flow: {},
    painPoints: { selected: [] },
    features: { selected: [] },
    domainProfile: crmProfile
  };
  const stepPayload = buildDomainProfileStep(mockSession);
  const confirmOpt = stepPayload.options.find(o => o.id === 'confirm_domain_profile');
  assert.ok(confirmOpt?.description?.includes('Tidak berlaku'), 'Deskripsi opsi harus ramah dan memuat "Tidak berlaku"');

  // 3. isFieldAllowedByDomainProfile harus tetap mengizinkan field non-finansial operasional
  assert.strictEqual(isFieldAllowedByDomainProfile('status_prospek', crmProfile), true, 'Field non-finansial harus diizinkan');
  assert.strictEqual(isFieldAllowedByDomainProfile('nama_klien', crmProfile), true, 'Field non-finansial harus diizinkan');
  assert.strictEqual(isFieldAllowedByDomainProfile('catatan_follow_up', crmProfile), true, 'Field non-finansial harus diizinkan');

  // Field finansial liar tanpa rumus atau whitelist harus ditolak
  assert.strictEqual(isFieldAllowedByDomainProfile('harga_satuan', crmProfile), false, 'Field finansial tanpa whitelist harus ditolak');
  assert.strictEqual(isFieldAllowedByDomainProfile('total_biaya', crmProfile), false, 'Field finansial tanpa whitelist harus ditolak');

  console.log('✅ PASS Test 8: TIDAK_RELEVAN dan fallback biaya kosong diverifikasi dengan sukses.');
}

console.log('\n--- TEST 9: Konsistensi Field dicatat_oleh / Pemilik Baris (Row-Level Access) ---');
{
  const crmSession: MockupSessionState = {
    step: 'SKEMA_DATA',
    match: { templateId: 'MT-21', overlayIds: [], patternIds: [], tier: 'BASIC', businessCategory: 'CRM Sales B2B' },
    roles: {
      selected: ['Super Admin', 'Sales Executive', 'Klien / Prospek']
    },
    flow: {},
    painPoints: { selected: [] },
    features: { selected: [] },
    domainProfile: {
      modelOperasional: 'TIDAK_RELEVAN',
      modelTarif: 'TIDAK_RELEVAN',
      adaJaminanDeposit: false,
      entitasKatalogMaster: ['katalog_layanan'],
      entitasPencatatanTransaksi: ['prospek_leads', 'aktivitas_kunjungan', 'penawaran_deals'],
      komponenBiayaYangLazim: []
    }
  };

  const sampleTables = [
    {
      nama: 'pengguna',
      keterangan: 'Akun login pengguna',
      field: [{ nama: 'id', tipe: 'text', keterangan: 'ID' }]
    },
    {
      nama: 'katalog_layanan',
      keterangan: 'Katalog produk dan paket layanan',
      field: [
        { nama: 'id', tipe: 'text', keterangan: 'ID' },
        { nama: 'nama_layanan', tipe: 'text', keterangan: 'Nama Layanan' }
      ]
    },
    {
      nama: 'prospek_leads',
      keterangan: 'Mencatat prospek calon pelanggan baru',
      field: [
        { nama: 'id', tipe: 'text', keterangan: 'ID' },
        { nama: 'nama_prospek', tipe: 'text', keterangan: 'Nama Prospek' },
        { nama: 'nilai_potensi', tipe: 'angka', keterangan: 'Nilai potensi' }
      ]
    },
    {
      nama: 'aktivitas_kunjungan',
      keterangan: 'Log kunjungan staf sales ke klien',
      field: [
        { nama: 'id', tipe: 'text', keterangan: 'ID' },
        { nama: 'sales_id', tipe: 'relasi ke pengguna', keterangan: 'Sales yang berkunjung', targetRole: 'Sales Executive' },
        { nama: 'catatan_hasil', tipe: 'text', keterangan: 'Hasil meeting' }
      ]
    }
  ];

  const processed = ensureStaffRecorderInActivityTables(sampleTables, crmSession);

  // 1. Tabel 'pengguna' tidak boleh disuntik 'dicatat_oleh'
  const userTable = processed.find(t => t.nama === 'pengguna');
  assert.strictEqual(userTable?.field.some(f => f.nama === 'dicatat_oleh'), false, 'Tabel pengguna tidak boleh disuntik dicatat_oleh');

  // 2. Tabel katalog master tidak boleh disuntik 'dicatat_oleh'
  const catalogTable = processed.find(t => t.nama === 'katalog_layanan');
  assert.strictEqual(catalogTable?.field.some(f => f.nama === 'dicatat_oleh'), false, 'Tabel katalog tidak boleh disuntik dicatat_oleh');

  // 3. Tabel aktivitas tanpa field pencatat ('prospek_leads') WAJIB disuntik 'dicatat_oleh'
  const leadsTable = processed.find(t => t.nama === 'prospek_leads');
  const recorderField = leadsTable?.field.find(f => f.nama === 'dicatat_oleh');
  assert.ok(recorderField, 'Tabel prospek_leads harus disuntik field dicatat_oleh');
  assert.strictEqual(recorderField?.tipe, 'relasi ke pengguna', 'Tipe dicatat_oleh harus relasi ke pengguna');
  assert.strictEqual(recorderField?.targetRole, 'Sales Executive', 'Target role harus Staf / Sales Executive');

  // 4. Tabel yang SUDAH punya field staf ('aktivitas_kunjungan' dengan sales_id) tidak boleh diduplikasi
  const visitTable = processed.find(t => t.nama === 'aktivitas_kunjungan');
  assert.strictEqual(visitTable?.field.some(f => f.nama === 'dicatat_oleh'), false, 'Tabel dengan sales_id tidak boleh disuntik duplikat');

  console.log('✅ PASS Test 9: ensureStaffRecorderInActivityTables sukses menjamin konsistensi field pencatat.');
}

console.log('\n--- TEST 10: Dynamic domainProfile & Skenario Kontras (CSIRT vs Rental Sepeda) ---');
{
  // Skenario A: CSIRT Incident Response (Ekstrem Non-Finansial, Non-Logistik)
  const csirtProfile: DomainProfile = {
    modelOperasional: {
      label: 'Respon Insiden & Mitigasi Krisis Siber (CSIRT)',
      deskripsi: 'Penanganan tiket insiden dari triage, investigasi, mitigasi, hingga post-mortem.'
    },
    modelTarif: null,
    melibatkanPengirimanFisik: false,
    adaJaminanDeposit: false,
    entitasKatalogMaster: ['kategori_insiden', 'aset_terdampak'],
    entitasPencatatanTransaksi: ['tiket_insiden', 'log_tindakan_mitigasi'],
    komponenBiayaYangLazim: []
  };

  // 1. Markdown rendering CSIRT
  const mdCsirt = renderDomainProfileMarkdown(csirtProfile, 'CSIRT Incident Response');
  assert.ok(mdCsirt.includes('Respon Insiden & Mitigasi Krisis Siber (CSIRT)'), 'Label dinamis CSIRT harus muncul di markdown');
  assert.ok(!mdCsirt.includes('Model Tarif & Kalkulasi'), 'Model Tarif TIDAK boleh muncul sama sekali jika null');
  assert.ok(!mdCsirt.includes('Jaminan / Deposit'), 'Jaminan/Deposit TIDAK boleh muncul sama sekali jika false');

  // 2. Format Prompt CSIRT
  const opCsirtPrompt = formatModelOperasionalPrompt(csirtProfile.modelOperasional);
  assert.ok(opCsirtPrompt.includes('Respon Insiden & Mitigasi Krisis Siber (CSIRT)'));
  assert.ok(opCsirtPrompt.includes('Penanganan tiket insiden'));
  const tarifCsirtPrompt = formatModelTarifPrompt(csirtProfile.modelTarif);
  assert.ok(tarifCsirtPrompt.includes('Tidak Ada Model Tarif Khusus'));

  // 3. Field gate CSIRT
  assert.strictEqual(isFieldAllowedByDomainProfile('status_tiket', csirtProfile), true);
  assert.strictEqual(isFieldAllowedByDomainProfile('tingkat_keparahan', csirtProfile), true);
  assert.strictEqual(isFieldAllowedByDomainProfile('ongkir', csirtProfile), false, 'ongkir harus diblokir oleh melibatkanPengirimanFisik === false');
  assert.strictEqual(isFieldAllowedByDomainProfile('kurir', csirtProfile), false, 'kurir harus diblokir oleh melibatkanPengirimanFisik === false');
  assert.strictEqual(isFieldAllowedByDomainProfile('no_resi', csirtProfile), false, 'no_resi harus diblokir oleh melibatkanPengirimanFisik === false');
  assert.strictEqual(isFieldAllowedByDomainProfile('total_biaya', csirtProfile), false, 'total_biaya liar harus diblokir');

  // Skenario B: Rental Sepeda (Model Operasional Lokasi, Ada Tarif Sewa, Ada Deposit, Non-Logistik)
  const rentalProfile: DomainProfile = {
    modelOperasional: {
      label: 'Pelayanan di Lokasi / Counter Langsung',
      deskripsi: 'Pelanggan datang langsung ke lokasi usaha, memilih unit, dan mengembalikannya ke counter.'
    },
    modelTarif: {
      label: 'Sewa Berdasarkan Durasi Waktu',
      deskripsi: 'Tarif dihitung per jam dikalikan durasi pemakaian unit sepeda.'
    },
    melibatkanPengirimanFisik: false,
    adaJaminanDeposit: true,
    fungsiDeposit: 'Jaminan kerusakan/keterlambatan unit fisik sepeda',
    entitasKatalogMaster: ['sepeda'],
    entitasPencatatanTransaksi: ['transaksi_sewa'],
    komponenBiayaYangLazim: ['durasi_jam', 'tarif_per_jam', 'deposit', 'denda_keterlambatan', 'total_biaya']
  };

  // 1. Markdown rendering Rental Sepeda
  const mdRental = renderDomainProfileMarkdown(rentalProfile, 'Rental Sepeda Gowes');
  assert.ok(mdRental.includes('Pelayanan di Lokasi / Counter Langsung'), 'Label operasional rental harus muncul');
  assert.ok(mdRental.includes('Sewa Berdasarkan Durasi Waktu'), 'Model tarif rental harus muncul');
  assert.ok(mdRental.includes('Jaminan / Deposit'), 'Jaminan deposit rental harus muncul karena true');
  assert.ok(mdRental.includes('Jaminan kerusakan/keterlambatan unit fisik sepeda'));

  // 2. Field gate Rental Sepeda
  assert.strictEqual(isFieldAllowedByDomainProfile('durasi_jam', rentalProfile), true);
  assert.strictEqual(isFieldAllowedByDomainProfile('tarif_per_jam', rentalProfile), true);
  assert.strictEqual(isFieldAllowedByDomainProfile('deposit', rentalProfile), true);
  assert.strictEqual(isFieldAllowedByDomainProfile('denda_keterlambatan', rentalProfile), true);
  // Logistik terblokir via melibatkanPengirimanFisik === false
  assert.strictEqual(isFieldAllowedByDomainProfile('ongkir', rentalProfile), false, 'ongkir terblokir via melibatkanPengirimanFisik === false');
  assert.strictEqual(isFieldAllowedByDomainProfile('biaya_pengiriman', rentalProfile), false);
  assert.strictEqual(isFieldAllowedByDomainProfile('ekspedisi', rentalProfile), false);
  assert.strictEqual(isFieldAllowedByDomainProfile('no_resi', rentalProfile), false);

  // Skenario C: Toko Online Fisik (Melibatkan Pengiriman Fisik === true)
  const ecommerceProfile: DomainProfile = {
    modelOperasional: {
      label: 'Pesanan Online & Pengiriman Paket',
      deskripsi: 'Pelanggan memesan secara daring dan barang dikirimkan via kurir logistik.'
    },
    modelTarif: {
      label: 'Harga Satuan per Produk',
      deskripsi: 'Kalkulasi harga barang dikalikan kuantitas belanja.'
    },
    melibatkanPengirimanFisik: true,
    adaJaminanDeposit: false,
    entitasKatalogMaster: ['produk'],
    entitasPencatatanTransaksi: ['pesanan'],
    komponenBiayaYangLazim: ['harga_satuan', 'jumlah_beli', 'ongkir', 'total_bayar']
  };

  // Ongkir dan no_resi harus diizinkan untuk ecommerce yang melibatkan pengiriman fisik
  assert.strictEqual(isFieldAllowedByDomainProfile('ongkir', ecommerceProfile), true, 'ongkir diizinkan jika melibatkan pengiriman fisik & whitelist');
  assert.strictEqual(isFieldAllowedByDomainProfile('no_resi', ecommerceProfile), true, 'no_resi diizinkan jika melibatkan pengiriman fisik');

  console.log('✅ PASS Test 10: Dynamic domainProfile & Skenario Kontras (CSIRT vs Rental vs E-Commerce) tervalidasi sempurna.');
}

runTest7().then(() => {
  console.log('\n🎉 ALL 10 TESTS PASSED! Seluruh arsitektur domainProfile dinamis, flag semantik terpisah & kelaziman diverifikasi.');
}).catch((err) => {
  console.error('❌ Test 7 failed:', err);
  process.exit(1);
});

