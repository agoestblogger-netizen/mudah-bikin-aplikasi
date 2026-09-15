import assert from 'node:assert';
import {
  validateContohDataVsSchema,
  generateDeterministicSimulasiDb,
  extractEnumOptions
} from '../src/lib/templates/processes/guided.js';
import type { MockupSessionState, SimulasiContohData } from '../src/lib/templates/processes/types.js';

console.log('=== TEST LANGKAH 3: VALIDATOR ENUM & NUMERIC INCREMENT SIMULASI_DB ===\n');

// 1. Test helper extractEnumOptions
console.log('--- Subtest 1: extractEnumOptions ---');
const opt1 = extractEnumOptions('Kondisi sistem pengereman (Baik / Rusak / Perlu Servis)');
console.log('Options extracted (Baik/Rusak/Perlu Servis):', opt1);
assert.deepStrictEqual(opt1, ['Baik', 'Rusak', 'Perlu Servis']);

const opt2 = extractEnumOptions('Status kelulusan ujian (Lulus / Tidak Lulus)');
console.log('Options extracted (Lulus/Tidak Lulus):', opt2);
assert.deepStrictEqual(opt2, ['Lulus', 'Tidak Lulus']);

const opt3 = extractEnumOptions('Metode pembayaran (Tunai, Transfer, QRIS)');
console.log('Options extracted (Tunai, Transfer, QRIS):', opt3);
assert.deepStrictEqual(opt3, ['Tunai', 'Transfer', 'QRIS']);
console.log('Subtest 1 PASS ✅\n');

// Schema Kursus Menyetir Mobil (tabel lembar_evaluasi & inspeksi)
const schemaKursusMenyetir = [
  {
    nama: 'evaluasi_praktik',
    keterangan: 'Lembar penilaian praktik mengemudi siswa',
    field: [
      { nama: 'id_evaluasi', tipe: 'text', keterangan: 'ID unik evaluasi' },
      { nama: 'siswa_id', tipe: 'relasi ke siswa', keterangan: 'Siswa yang dinilai' },
      { nama: 'nilai_kopling', tipe: 'angka', keterangan: 'Skor penguasaan setengah kopling (0-100)' },
      { nama: 'kondisi_rem', tipe: 'text', keterangan: 'Kondisi respon pengereman (Baik / Rusak / Perlu Servis)' },
      { nama: 'status_kelulusan', tipe: 'text', keterangan: 'Hasil akhir sesi (Lulus / Tidak Lulus)' }
    ]
  },
  {
    nama: 'siswa',
    keterangan: 'Data siswa kursus',
    field: [
      { nama: 'id_siswa', tipe: 'text', keterangan: 'ID siswa' },
      { nama: 'nama_siswa', tipe: 'text', keterangan: 'Nama lengkap siswa' }
    ]
  }
];

// 2. Test Skenario Kasus 1: Nilai Increment Berurutan Rata (nilai_kopling = 10, 20, 30)
console.log('--- Subtest 2: Penolakan Nilai Increment Berurutan Rata (nilai_kopling = 10, 20, 30) ---');
const dataIncrement: SimulasiContohData = {
  tabel: [
    {
      nama: 'siswa',
      baris: [
        { id_siswa: 'SIS-001', nama_siswa: 'Budi Santoso' },
        { id_siswa: 'SIS-002', nama_siswa: 'Siti Rahma' },
        { id_siswa: 'SIS-003', nama_siswa: 'Ahmad Hidayat' }
      ]
    },
    {
      nama: 'evaluasi_praktik',
      baris: [
        { id_evaluasi: 'EVA-001', siswa_id: 'SIS-001', nilai_kopling: 10, kondisi_rem: 'Baik', status_kelulusan: 'Lulus' },
        { id_evaluasi: 'EVA-002', siswa_id: 'SIS-002', nilai_kopling: 20, kondisi_rem: 'Baik', status_kelulusan: 'Lulus' },
        { id_evaluasi: 'EVA-003', siswa_id: 'SIS-003', nilai_kopling: 30, kondisi_rem: 'Baik', status_kelulusan: 'Tidak Lulus' }
      ]
    }
  ]
};

const issuesIncrement = validateContohDataVsSchema(dataIncrement, schemaKursusMenyetir);
console.log('Issues found on increment data:', issuesIncrement);
const hasIncrementIssue = issuesIncrement.some(i => i.includes('nilai numerik increment berurutan rata') && i.includes('nilai_kopling'));
assert(hasIncrementIssue, 'Validator HARUS menangkap nilai_kopling increment [10, 20, 30]!');
console.log('Subtest 2 PASS ✅ (nilai_kopling [10, 20, 30] berhasil ditangkap validator)\n');

// 3. Test Skenario Kasus 2: Nilai Placeholder Generik & Salah Domain (kondisi_rem = "Hasil A", "Hasil B", "Hasil C")
console.log('--- Subtest 3: Penolakan Placeholder Generik & Salah Domain (kondisi_rem = "Hasil A", ...) ---');
const dataGenericPlaceholder: SimulasiContohData = {
  tabel: [
    {
      nama: 'siswa',
      baris: [
        { id_siswa: 'SIS-001', nama_siswa: 'Budi Santoso' },
        { id_siswa: 'SIS-002', nama_siswa: 'Siti Rahma' },
        { id_siswa: 'SIS-003', nama_siswa: 'Ahmad Hidayat' }
      ]
    },
    {
      nama: 'evaluasi_praktik',
      baris: [
        { id_evaluasi: 'EVA-001', siswa_id: 'SIS-001', nilai_kopling: 85, kondisi_rem: 'Hasil A', status_kelulusan: 'Lulus' },
        { id_evaluasi: 'EVA-002', siswa_id: 'SIS-002', nilai_kopling: 78, kondisi_rem: 'Hasil B', status_kelulusan: 'Lulus' },
        { id_evaluasi: 'EVA-003', siswa_id: 'SIS-003', nilai_kopling: 92, kondisi_rem: 'Hasil C', status_kelulusan: 'Tidak Lulus' }
      ]
    }
  ]
};

const issuesGeneric = validateContohDataVsSchema(dataGenericPlaceholder, schemaKursusMenyetir);
console.log('Issues found on generic placeholder data:', issuesGeneric);
const hasGenericIssue = issuesGeneric.some(i => i.includes('kondisi_rem') && (i.includes('placeholder generik') || i.includes('tidak sesuai domain pilihan')));
assert(hasGenericIssue, 'Validator HARUS menangkap kondisi_rem bernilai "Hasil A/B/C"!');
console.log('Subtest 3 PASS ✅ (kondisi_rem "Hasil A/B/C" berhasil ditangkap validator)\n');

// 4. Test Skenario Kasus 3: Data Realistis yang Benar Harus Lolos Bersih (0 masalah)
console.log('--- Subtest 4: Data Realistis Sesuai Domain Harus Bersih 100% ---');
const dataValid: SimulasiContohData = {
  tabel: [
    {
      nama: 'siswa',
      baris: [
        { id_siswa: 'SIS-001', nama_siswa: 'Budi Santoso' },
        { id_siswa: 'SIS-002', nama_siswa: 'Siti Rahma' },
        { id_siswa: 'SIS-003', nama_siswa: 'Ahmad Hidayat' }
      ]
    },
    {
      nama: 'evaluasi_praktik',
      baris: [
        { id_evaluasi: 'EVA-001', siswa_id: 'SIS-001', nilai_kopling: 85, kondisi_rem: 'Baik', status_kelulusan: 'Lulus' },
        { id_evaluasi: 'EVA-002', siswa_id: 'SIS-002', nilai_kopling: 78, kondisi_rem: 'Perlu Servis', status_kelulusan: 'Lulus' },
        { id_evaluasi: 'EVA-003', siswa_id: 'SIS-003', nilai_kopling: 92, kondisi_rem: 'Baik', status_kelulusan: 'Tidak Lulus' }
      ]
    }
  ]
};

const issuesValid = validateContohDataVsSchema(dataValid, schemaKursusMenyetir);
console.log('Issues found on valid data:', issuesValid);
assert.strictEqual(issuesValid.length, 0, 'Data valid tidak boleh memiliki masalah validasi!');
console.log('Subtest 4 PASS ✅ (Data realistis lolos bersih)\n');

// 5. Test Skenario Kasus 4: Fallback generator internal tidak menghasilkan increment 10, 20, 30
console.log('--- Subtest 5: generateDeterministicSimulasiDb menghasilkan skor realistis ---');
const sessionKursus = {
  step: 'SIMULASI_DB',
  match: { businessCategory: 'Kursus Menyetir Mobil' },
  roles: { selected: ['Super Admin', 'Instruktur'] },
  dataSchema: { tabel: schemaKursusMenyetir }
} as unknown as MockupSessionState;

const simResult = generateDeterministicSimulasiDb(sessionKursus);
const evalRows = simResult.contohData.tabel.find((t: any) => t.nama === 'evaluasi_praktik')?.baris || [];
console.log('Generated evaluasi_praktik rows:', evalRows);
const koplingValues = evalRows.map((r: any) => r.nilai_kopling);
console.log('nilai_kopling values:', koplingValues);
assert.notDeepStrictEqual(koplingValues, [10, 20, 30], 'nilai_kopling tidak boleh lagi berisi [10, 20, 30]!');

const issuesGen = validateContohDataVsSchema(simResult.contohData, schemaKursusMenyetir);
console.log('Validation issues on generated fallback:', issuesGen);
assert.strictEqual(issuesGen.length, 0, 'Data hasil generator fallback harus 100% lolos validasi!');
console.log('Subtest 5 PASS ✅\n');

console.log('=== SEMUA SUBTEST LANGKAH 3 SUKSES (100% PASS) ===');
