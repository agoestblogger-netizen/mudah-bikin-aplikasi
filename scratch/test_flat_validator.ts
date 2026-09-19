import assert from 'assert';
import { detectFlatSchemaViolation } from '../src/app/api/guided/route';

console.log('=== TEST JARING PENGAMAN: detectFlatSchemaViolation ===\n');

const mockSessionWithEntity: any = {
  actorsClassification: [
    { actor: 'Siswa', category: 'ENTITAS_DATA', ownerRole: 'Petugas Admin' }
  ]
};

// Kasus 1: Skema FLAT yang menyerap instrumen ke tabel siswa tanpa katalog
const flatTables = [
  {
    nama: 'siswa',
    field: [
      { nama: 'id', tipe: 'text', keterangan: 'ID' },
      { nama: 'nama', tipe: 'text', keterangan: 'Nama' },
      { nama: 'instrumen_dipelajari', tipe: 'text', keterangan: 'Instrumen yang dipelajari' }
    ]
  },
  {
    nama: 'jadwal_studio',
    field: [
      { nama: 'id', tipe: 'text', keterangan: 'ID' },
      { nama: 'siswa_id', tipe: 'relasi ke siswa', keterangan: 'Siswa' }
    ]
  }
];

const violation = detectFlatSchemaViolation(flatTables, mockSessionWithEntity);
console.log('Kasus 1 (Skema Flat):');
console.log('Hasil deteksi:', violation);
assert(violation, 'HARUS mendeteksi pelanggaran skema flat');
assert(violation.includes('Tabel profil "siswa" menyerap field penawaran "instrumen_dipelajari"'), 'Pesan pelanggaran harus spesifik');
console.log('✓ Kasus 1 PASS: Berhasil mendeteksi skema flat!\n');

// Kasus 2: Skema 3-Lapis yang Benar (Ada katalog & bridge)
const threeTierTables = [
  {
    nama: 'siswa',
    field: [
      { nama: 'id', tipe: 'text', keterangan: 'ID' },
      { nama: 'nama', tipe: 'text', keterangan: 'Nama' }
    ]
  },
  {
    nama: 'instrumen_musik',
    field: [
      { nama: 'id', tipe: 'text', keterangan: 'ID' },
      { nama: 'nama_instrumen', tipe: 'text', keterangan: 'Nama' }
    ]
  },
  {
    nama: 'pendaftaran_instrumen',
    field: [
      { nama: 'id', tipe: 'text', keterangan: 'ID' },
      { nama: 'siswa_id', tipe: 'relasi ke siswa', keterangan: 'Siswa' },
      { nama: 'instrumen_id', tipe: 'relasi ke instrumen_musik', keterangan: 'Instrumen' }
    ]
  }
];

const noViolation = detectFlatSchemaViolation(threeTierTables, mockSessionWithEntity);
console.log('Kasus 2 (Skema 3-Lapis Valid):');
console.log('Hasil deteksi:', noViolation);
assert.strictEqual(noViolation, null, 'TIDAK BOLEH mendeteksi pelanggaran pada skema 3-lapis');
console.log('✓ Kasus 2 PASS: Skema 3-lapis bersih tanpa false positive!');
