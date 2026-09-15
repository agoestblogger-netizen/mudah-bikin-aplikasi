import {
  validateContohDataVsSchema,
  generateDeterministicSimulasiDb
} from '../src/lib/templates/processes/guided';
import type { MockupSessionState } from '../src/lib/templates/processes/types';

console.log('--- TEST LANGKAH 5: EXACT MATCH ROLE VALIDATION & DATA GENERATION ---');

const officialRoles = ['Pemilik', 'Staf Administrasi', 'Instruktur', 'Siswa'];

const schemas = [
  {
    nama: 'pengguna',
    field: [
      { nama: 'id', tipe: 'text' },
      { nama: 'nama', tipe: 'text' },
      { nama: 'peran', tipe: 'text' }
    ]
  }
];

// Subtest 1: Validator menolak singkatan peran ("Staf" bukan "Staf Administrasi")
console.log('\n[Subtest 1] Validator menolak singkatan nama peran:');
const dataSingkatan = {
  tabel: [
    {
      nama: 'pengguna',
      baris: [
        { id: 'USR-001', nama: 'Pak Bambang', peran: 'Pemilik' },
        { id: 'USR-002', nama: 'Siti Rahma', peran: 'Staf' }, // Singkatan terlarang!
        { id: 'USR-003', nama: 'Pak Hendra', peran: 'Instruktur' },
        { id: 'USR-004', nama: 'Budi Pratama', peran: 'Siswa' }
      ]
    }
  ]
};

const issuesSingkatan = validateContohDataVsSchema(dataSingkatan, schemas, officialRoles);
console.log('  Issues terdeteksi:', issuesSingkatan);
const hasAbbrIssue = issuesSingkatan.some(
  (m) => m.includes('peran') && m.includes('"Staf" bukan nama peran resmi yang valid (singkatan/alias terlarang)')
);
if (!hasAbbrIssue) {
  throw new Error('Subtest 1 failed: validator tidak menangkap singkatan nama peran "Staf"!');
}
console.log('  ✅ Subtest 1 PASS');

// Subtest 2: Validator menolak peran yang tidak terdaftar sama sekali
console.log('\n[Subtest 2] Validator menolak peran asing yang tidak terdaftar:');
const dataPeranAsing = {
  tabel: [
    {
      nama: 'pengguna',
      baris: [
        { id: 'USR-001', nama: 'Pak Bambang', peran: 'Pemilik' },
        { id: 'USR-002', nama: 'Siti Rahma', peran: 'Manager Keuangan' } // Tidak terdaftar
      ]
    }
  ]
};

const issuesAsing = validateContohDataVsSchema(dataPeranAsing, schemas, officialRoles);
console.log('  Issues terdeteksi:', issuesAsing);
const hasAsingIssue = issuesAsing.some(
  (m) => m.includes('peran') && m.includes('"Manager Keuangan" tidak terdaftar di daftar peran resmi')
);
if (!hasAsingIssue) {
  throw new Error('Subtest 2 failed: validator tidak menangkap peran asing!');
}
console.log('  ✅ Subtest 2 PASS');

// Subtest 3: Validator meloloskan nama peran resmi lengkap (exact match)
console.log('\n[Subtest 3] Validator meloloskan nama peran resmi lengkap:');
const dataValid = {
  tabel: [
    {
      nama: 'pengguna',
      baris: [
        { id: 'USR-001', nama: 'Pak Bambang', peran: 'Pemilik' },
        { id: 'USR-002', nama: 'Siti Rahma', peran: 'Staf Administrasi' },
        { id: 'USR-003', nama: 'Pak Hendra', peran: 'Instruktur' },
        { id: 'USR-004', nama: 'Budi Pratama', peran: 'Siswa' }
      ]
    }
  ]
};

const issuesValid = validateContohDataVsSchema(dataValid, schemas, officialRoles);
console.log('  Issues terdeteksi:', issuesValid);
if (issuesValid.length > 0) {
  throw new Error(`Subtest 3 failed: validator menerbitkan isu tak terduga: ${issuesValid.join('; ')}`);
}
console.log('  ✅ Subtest 3 PASS');

// Subtest 4: Pengujian generateDeterministicSimulasiDb untuk Kursus Menyetir Mobil
console.log('\n[Subtest 4] generateDeterministicSimulasiDb Kursus Menyetir Mobil mematuhi exact match:');
const session: MockupSessionState = {
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
          { nama: 'peran', tipe: 'text', keterangan: 'Peran pengguna' }
        ]
      }
    ]
  }
};

const simDb = generateDeterministicSimulasiDb(session);
const tblPengguna = simDb.contohData.tabel.find((t) => t.nama === 'pengguna');
console.log('  Baris tabel pengguna:');
tblPengguna?.baris.forEach((r) => console.log(`    ${r.id} | ${r.nama} | peran="${r.peran}"`));

const rolesGenerated = tblPengguna?.baris.map((r) => r.peran);
for (const reqRole of officialRoles) {
  if (!rolesGenerated?.includes(reqRole)) {
    throw new Error(`Subtest 4 failed: peran '${reqRole}' tidak ada di tabel pengguna hasil generate!`);
  }
}

const issuesGenerated = validateContohDataVsSchema(simDb.contohData, session.dataSchema?.tabel, officialRoles);
console.log('  Validator output:', issuesGenerated);
if (issuesGenerated.length > 0) {
  throw new Error(`Subtest 4 failed: validasi menghasilkan isu tak terduga: ${issuesGenerated.join('; ')}`);
}
console.log('  ✅ Subtest 4 PASS: 100% exact match peran!');

console.log('\n🎉 SEMUA SUBTEST LANGKAH 5 BERHASIL 100%!');
