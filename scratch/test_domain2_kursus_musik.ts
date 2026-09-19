import {
  MockupSessionState,
  buildFormulaStep,
  renderFormulaMarkdownTable,
  generateDeterministicSimulasiDb,
  validateContohDataVsSchema
} from '../src/lib/templates/processes/guided';
import { extractTablesAndCorrelationFromParsed } from '../src/app/api/guided/route';

async function testDomainKursusMusik() {
  console.log('=== DOMAIN 2: KURSUS MUSIK & VOKAL ===');
  
  const sessionKursus: MockupSessionState = {
    id: 'test-kursus-musik',
    currentStep: 'FORMULA',
    storytelling: {
      userBrief: 'Aplikasi manajemen kursus musik privat dan reguler',
      businessAnalysis: {
        jenisUsaha: 'Kursus Pendidikan Musik',
        skalaOperasional: 'Menengah',
        alurKritis: 'Pendaftaran siswa, pemilihan instrumen & paket, presensi dan pembayaran SPP'
      }
    },
    roles: {
      selected: ['Owner Musik', 'Admin Akademik', 'Instruktur Musik', 'Siswa / Wali']
    },
    workflow: {
      steps: [
        { nama: 'Pendaftaran Siswa', pelaku: 'Admin Akademik', deskripsi: 'Pendaftaran siswa baru dan instrumen yang diminati' },
        { nama: 'Plotting Jadwal', pelaku: 'Admin Akademik', deskripsi: 'Penentuan paket kursus dan instruktur' },
        { nama: 'Pembayaran SPP', pelaku: 'Admin Akademik', deskripsi: 'Kalkulasi total tagihan paket dan biaya registrasi' }
      ]
    },
    rbac: { matrix: {} },
    formulas: {
      daftar: [
        {
          targetTable: 'pembayaran_spp',
          namaField: 'total_tagihan',
          labelField: 'Total Tagihan SPP',
          formulaExpression: 'biaya_kursus + biaya_registrasi - potongan_diskon',
          formulaText: 'biaya_kursus + biaya_registrasi - potongan_diskon',
          komponenInput: ['biaya_kursus', 'biaya_registrasi', 'potongan_diskon'],
          deskripsi: 'Total tagihan dihitung dari biaya kursus ditambah biaya registrasi dikurangi diskon'
        }
      ]
    }
  };

  // 1. Validasi Step Formula
  const stepFormula = buildFormulaStep(sessionKursus);
  console.log('Step Formula Title:', stepFormula.title);
  const md = renderFormulaMarkdownTable(sessionKursus.formulas?.daftar || []);
  console.log('Formula Preview:\n' + md);

  // 2. Skema 3 Lapis Kursus Musik (Siswa, Paket/Instrumen, Pendaftaran/SPP)
  const parsedJson = {
    tabel: [
      {
        nama: 'siswa',
        keterangan: 'Master Siswa Musik (Entitas Data)',
        displayField: 'nama_lengkap',
        field: [
          { nama: 'id', tipe: 'teks', keterangan: 'PK' },
          { nama: 'nama_lengkap', tipe: 'teks', keterangan: 'Nama lengkap siswa' },
          { nama: 'instrumen_peminatan', tipe: 'teks', keterangan: 'Gitar, Piano, Biola, Vokal' },
          { nama: 'no_wali', tipe: 'teks', keterangan: 'Kontak wali murid' }
        ]
      },
      {
        nama: 'paket_kursus',
        keterangan: 'Katalog Paket Kursus',
        displayField: 'nama_paket',
        field: [
          { nama: 'id', tipe: 'teks', keterangan: 'PK' },
          { nama: 'nama_paket', tipe: 'teks', keterangan: 'Nama paket kursus' },
          { nama: 'jumlah_sesi', tipe: 'angka', keterangan: 'Jumlah sesi per bulan' },
          { nama: 'tarif_bulanan', tipe: 'angka', keterangan: 'Tarif bulanan' }
        ]
      },
      {
        nama: 'pendaftaran_kursus',
        keterangan: 'Tabel Jembatan Siswa dan Paket',
        compositeFields: ['siswa_id', 'paket_kursus_id'],
        field: [
          { nama: 'id', tipe: 'teks', keterangan: 'PK' },
          { nama: 'siswa_id', tipe: 'relasi ke siswa', keterangan: 'Siswa yang terdaftar', targetTable: 'siswa' },
          { nama: 'paket_kursus_id', tipe: 'relasi ke paket_kursus', keterangan: 'Paket yang dipilih', targetTable: 'paket_kursus' },
          { nama: 'tanggal_mulai', tipe: 'tanggal', keterangan: 'Tanggal mulai les' },
          { nama: 'status_keaktifan', tipe: 'teks', keterangan: 'Aktif / Cuti / Lulus' }
        ]
      },
      {
        nama: 'pembayaran_spp',
        keterangan: 'Transaksi Pembayaran SPP Bulanan',
        compositeFields: ['pendaftaran_kursus_id'],
        field: [
          { nama: 'id', tipe: 'teks', keterangan: 'PK' },
          { nama: 'pendaftaran_kursus_id', tipe: 'relasi ke pendaftaran_kursus', keterangan: 'Pendaftaran siswa & paket', targetTable: 'pendaftaran_kursus' },
          { nama: 'biaya_kursus', tipe: 'angka', keterangan: 'Biaya kursus bulanan' },
          { nama: 'biaya_registrasi', tipe: 'angka', keterangan: 'Biaya registrasi awal' },
          { nama: 'potongan_diskon', tipe: 'angka', keterangan: 'Diskon promo' },
          { nama: 'total_tagihan', tipe: 'angka', keterangan: 'Total tagihan SPP', isFormula: true, formulaExpression: 'biaya_kursus + biaya_registrasi - potongan_diskon' },
          { nama: 'status_bayar', tipe: 'teks', keterangan: 'Lunas / Belum Lunas' }
        ]
      }
    ]
  };

  const extracted = await extractTablesAndCorrelationFromParsed(parsedJson, undefined, sessionKursus.roles?.selected);
  console.log('Parsed Tables Count:', extracted.tables.length);
  
  const pendTbl = extracted.tables.find(t => t.nama === 'pendaftaran_kursus');
  const bayarTbl = extracted.tables.find(t => t.nama === 'pembayaran_spp');

  console.log('Pendaftaran compositeFields:', pendTbl?.compositeFields);
  console.log('Pembayaran compositeFields:', bayarTbl?.compositeFields);
  const totalFld = bayarTbl?.field.find(f => f.nama === 'total_tagihan');
  console.log('total_tagihan isFormula:', totalFld?.isFormula, 'expr:', totalFld?.formulaExpression);

  // 3. Simulasi DB & Formula Evaluation
  sessionKursus.dataSchema = {
    tabel: extracted.tables as any,
    analisisKebutuhan: 'Skema kursus musik 3-lapis dengan formula SPP'
  };

  const simulasi = generateDeterministicSimulasiDb(sessionKursus);
  const bayarTblSim = simulasi.contohData.tabel?.find(t => t.nama === 'pembayaran_spp');
  console.log('Simulasi pembayaran_spp rows count:', bayarTblSim?.baris.length);
  console.log('Sample row pembayaran_spp:', bayarTblSim?.baris[0]);

  for (const r of bayarTblSim?.baris || []) {
    const expected = Number(r.biaya_kursus) + Number(r.biaya_registrasi) - Number(r.potongan_diskon);
    if (Number(r.total_tagihan) !== expected) {
      throw new Error(`Domain 2 Formula Gagal: expected ${expected}, actual ${r.total_tagihan}`);
    }
  }
  console.log('Domain 2 Formula Evaluasi: 100% Konsisten Matematis!');

  // 4. Uji Auto-repair Kejujuran FK pada Pendaftaran
  const dataTest: any = {
    tabel: [
      {
        nama: 'siswa',
        baris: [{ id: 'SW-1', nama_lengkap: 'Clara Shinta', instrumen_peminatan: 'Piano', no_wali: '08112233' }]
      },
      {
        nama: 'paket_kursus',
        baris: [{ id: 'PK-1', nama_paket: 'Piano Royal Class', jumlah_sesi: 8, tarif_bulanan: 1500000 }]
      },
      {
        nama: 'pendaftaran_kursus',
        baris: [
          {
            id: 'REG-1',
            siswa_id: 'Clara Shinta', // Literal string exact match
            paket_kursus_id: 'Piano Royal Class', // Literal string exact match
            tanggal_mulai: '2026-10-01',
            status_keaktifan: 'Aktif'
          }
        ]
      }
    ]
  };

  const validasi = validateContohDataVsSchema(dataTest, extracted.tables as any);
  console.log('Validasi exact match Domain 2:', validasi);
  const regRow = dataTest.tabel.find((t: any) => t.nama === 'pendaftaran_kursus').baris[0];
  console.log('Hasil repair siswa_id:', regRow.siswa_id, '(Expected: SW-1)');
  console.log('Hasil repair paket_kursus_id:', regRow.paket_kursus_id, '(Expected: PK-1)');
  if (regRow.siswa_id !== 'SW-1' || regRow.paket_kursus_id !== 'PK-1') {
    throw new Error('Domain 2 Auto-repair Exact Match Gagal');
  }

  console.log('>>> DOMAIN 2 KURSUS MUSIK: 100% LOLOS & TERSINKRONISASI! <<<');
}

testDomainKursusMusik().catch(err => {
  console.error('DOMAIN 2 ERROR:', err);
  process.exit(1);
});
