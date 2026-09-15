import {
  detectTargetRoleForField,
  isTablePengguna,
  validateContohDataVsSchema,
  generateDeterministicSimulasiDb,
  repairRelasiSimulasiDb
} from '../src/lib/templates/processes/guided';
import type { MockupSessionState } from '../src/lib/templates/processes/types';

console.log('--- TEST LANGKAH 4: ROLE-AWARE RELATION VALIDATION & GENERATION ---');

// Skenario: Kursus Menyetir Mobil
const officialRoles = ['Pemilik', 'Staf Administrasi', 'Instruktur', 'Siswa'];

// Subtest 1: Deteksi targetRole dari berbagai variasi field
console.log('\n[Subtest 1] Deteksi targetRole dari nama dan keterangan field:');
const f1 = { nama: 'instruktur_id', tipe: 'relasi ke pengguna' };
const role1 = detectTargetRoleForField(f1, officialRoles);
console.log(`  f1 (instruktur_id) -> ${role1}`);
if (role1 !== 'Instruktur') throw new Error(`Subtest 1.1 failed, expected 'Instruktur', got ${role1}`);

const f2 = { nama: 'id_siswa', tipe: 'text', keterangan: 'ID siswa yang mengikuti praktik' };
const role2 = detectTargetRoleForField(f2, officialRoles);
console.log(`  f2 (id_siswa) -> ${role2}`);
if (role2 !== 'Siswa') throw new Error(`Subtest 1.2 failed, expected 'Siswa', got ${role2}`);

const f3 = { nama: 'pengajar_id', tipe: 'relasi ke pengguna', keterangan: 'relasi ke pengguna dengan peran instruktur' };
const role3 = detectTargetRoleForField(f3, officialRoles);
console.log(`  f3 (pengajar_id / pengajar sinonim instruktur) -> ${role3}`);
if (role3 !== 'Instruktur') throw new Error(`Subtest 1.3 failed, expected 'Instruktur', got ${role3}`);

console.log('  ✅ Subtest 1 PASS');

// Subtest 2: Validator menolak ID user yang perannya salah
console.log('\n[Subtest 2] Validator menolak ID user yang perannya tidak cocok:');
const contohDataWrongRole = {
  tabel: [
    {
      nama: 'pengguna',
      baris: [
        { id: 'USR-001', nama: 'Pak Bambang', peran: 'Pemilik' },
        { id: 'USR-002', nama: 'Siti Rahma', peran: 'Staf Administrasi' },
        { id: 'USR-003', nama: 'Pak Hendra', peran: 'Instruktur' },
        { id: 'USR-004', nama: 'Budi Pratama', peran: 'Siswa' }
      ]
    },
    {
      nama: 'sesi_praktik',
      baris: [
        // USR-002 adalah Staf Administrasi, padahal instruktur_id butuh Instruktur!
        { id: 'SES-001', instruktur_id: 'USR-002', id_siswa: 'USR-004', tanggal: '2026-09-10' },
        { id: 'SES-002', instruktur_id: 'USR-003', id_siswa: 'USR-004', tanggal: '2026-09-11' }
      ]
    }
  ]
};

const schemas = [
  {
    nama: 'pengguna',
    field: [
      { nama: 'id', tipe: 'text' },
      { nama: 'nama', tipe: 'text' },
      { nama: 'peran', tipe: 'text' }
    ]
  },
  {
    nama: 'sesi_praktik',
    field: [
      { nama: 'id', tipe: 'text' },
      { nama: 'instruktur_id', tipe: 'relasi ke pengguna' },
      { nama: 'id_siswa', tipe: 'relasi ke pengguna' },
      { nama: 'tanggal', tipe: 'tanggal' }
    ]
  }
];

const issuesWrongRole = validateContohDataVsSchema(contohDataWrongRole, schemas, officialRoles);
console.log('  Issues terdeteksi:', issuesWrongRole);
const hasWrongRoleIssue = issuesWrongRole.some(
  (m) => m.includes('instruktur_id') && m.includes('merujuk ke pengguna dengan peran "Staf Administrasi"')
);
if (!hasWrongRoleIssue) {
  throw new Error('Subtest 2 failed: validator tidak mendeteksi role yang salah pada relasi!');
}
console.log('  ✅ Subtest 2 PASS');

// Subtest 3: Validator menolak jika tabel pengguna sama sekali tidak memiliki baris untuk peran target
console.log('\n[Subtest 3] Validator menolak bila tabel pengguna tidak memiliki data untuk peran target:');
const contohDataMissingRole = {
  tabel: [
    {
      nama: 'pengguna',
      baris: [
        { id: 'USR-001', nama: 'Pak Bambang', peran: 'Pemilik' },
        { id: 'USR-002', nama: 'Siti Rahma', peran: 'Staf Administrasi' }
        // Tidak ada user dengan peran Instruktur maupun Siswa
      ]
    },
    {
      nama: 'sesi_praktik',
      baris: [
        { id: 'SES-001', instruktur_id: 'USR-001', id_siswa: 'USR-002', tanggal: '2026-09-10' }
      ]
    }
  ]
};

const issuesMissingRole = validateContohDataVsSchema(contohDataMissingRole, schemas, officialRoles);
console.log('  Issues terdeteksi:', issuesMissingRole);
const hasMissingRoleIssue = issuesMissingRole.some(
  (m) => m.includes('membutuhkan relasi ke pengguna dengan peran "Instruktur"') && m.includes('belum memiliki data')
);
if (!hasMissingRoleIssue) {
  throw new Error('Subtest 3 failed: validator tidak mendeteksi tabel pengguna yang kekurangan peran target!');
}
console.log('  ✅ Subtest 3 PASS');

// Subtest 4: Generator deterministik & repairRelasiSimulasiDb menghasilkan data role-aware yang valid
console.log('\n[Subtest 4] generateDeterministicSimulasiDb & validasi clean:');
const mockSession: MockupSessionState = {
  step: 'simulasi_db',
  roles: {
    selected: officialRoles
  },
  dataSchema: {
    tabel: [
      {
        nama: 'pengguna',
        field: [
          { nama: 'id', tipe: 'text', keterangan: 'ID pengguna' },
          { nama: 'nama', tipe: 'text', keterangan: 'Nama pengguna' },
          { nama: 'peran', tipe: 'text', keterangan: 'Peran pengguna (Pemilik/Staf Administrasi/Instruktur/Siswa)' }
        ]
      },
      {
        nama: 'sesi_praktik',
        field: [
          { nama: 'id', tipe: 'text', keterangan: 'ID sesi praktik' },
          { nama: 'instruktur_id', tipe: 'relasi ke pengguna', keterangan: 'Instruktur pengampu praktik' },
          { nama: 'id_siswa', tipe: 'relasi ke pengguna', keterangan: 'Siswa peserta praktik' },
          { nama: 'nilai_kopling', tipe: 'angka', keterangan: 'Nilai teknik kopling (skala 0-100)' },
          { nama: 'kondisi_rem', tipe: 'text', keterangan: 'Pilihan: Baik / Cukup / Perlu Servis' }
        ]
      }
    ]
  }
};

const simDb = generateDeterministicSimulasiDb(mockSession);
const tblPengguna = simDb.contohData.tabel.find((t) => t.nama === 'pengguna');
const tblSesi = simDb.contohData.tabel.find((t) => t.nama === 'sesi_praktik');

console.log('  Tabel pengguna baris:');
tblPengguna?.baris.forEach((r) => console.log(`    ${r.id} | ${r.nama} | ${r.peran}`));

console.log('  Tabel sesi_praktik baris:');
tblSesi?.baris.forEach((r) => console.log(`    ${r.id} | instruktur_id: ${r.instruktur_id} | id_siswa: ${r.id_siswa}`));

// Verifikasi baris pengguna mencakup semua role
const rolesInPengguna = tblPengguna?.baris.map((r) => r.peran);
for (const reqRole of officialRoles) {
  if (!rolesInPengguna?.includes(reqRole)) {
    throw new Error(`Subtest 4 failed: tabel pengguna tidak memuat role '${reqRole}'!`);
  }
}

// Verifikasi instruktur_id menunjuk ke user ber-role Instruktur
const instrukturRow = tblPengguna?.baris.find((r) => r.peran === 'Instruktur');
for (const row of tblSesi?.baris || []) {
  if (row.instruktur_id !== instrukturRow?.id) {
    throw new Error(`Subtest 4 failed: instruktur_id (${row.instruktur_id}) tidak merujuk ke user Instruktur (${instrukturRow?.id})`);
  }
}

// Verifikasi id_siswa menunjuk ke user ber-role Siswa
const siswaRow = tblPengguna?.baris.find((r) => r.peran === 'Siswa');
for (const row of tblSesi?.baris || []) {
  if (row.id_siswa !== siswaRow?.id) {
    throw new Error(`Subtest 4 failed: id_siswa (${row.id_siswa}) tidak merujuk ke user Siswa (${siswaRow?.id})`);
  }
}

// Validasi skema pada hasil generate
const issuesFinal = validateContohDataVsSchema(simDb.contohData, mockSession.dataSchema?.tabel, officialRoles);
console.log('  Validator output:', issuesFinal);
if (issuesFinal.length > 0) {
  throw new Error(`Subtest 4 failed: validasi menghasilkan isu tak terduga: ${issuesFinal.join('; ')}`);
}
console.log('  ✅ Subtest 4 PASS: 0 isu, semua relasi role-aware 100% konsisten!');

console.log('\n🎉 SEMUA SUBTEST LANGKAH 4 BERHASIL 100%!');
