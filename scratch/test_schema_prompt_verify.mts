import { renderDataSchemaMarkdown } from '../src/lib/templates/processes/guided.js';

const mockTables = [
  {
    nama: 'lembar_evaluasi',
    keterangan: 'Penilaian perkembangan siswa',
    field: [
      { nama: 'id', tipe: 'UUID', keterangan: 'Primary key' },
      { nama: 'kemampuan_awal', tipe: 'TEXT', keterangan: 'Kemampuan awal siswa' },
      { nama: 'teknik_jari', tipe: 'INTEGER (1-10)', keterangan: 'Nilai teknik jari' },
      { nama: 'ritme', tipe: 'INTEGER (1-10)', keterangan: 'Nilai ritme' },
      { nama: 'tangga_nada', tipe: 'INTEGER (1-10)', keterangan: 'Nilai tangga nada' },
      { nama: 'relasi_ke_siswa', tipe: 'relasi ke siswa', keterangan: 'FK ke tabel siswa' },
      { nama: 'relasi_ke_instruktur', tipe: 'relasi ke pengguna', keterangan: 'FK ke pengguna (instruktur)' }
    ]
  },
  {
    nama: 'siswa',
    keterangan: 'Data siswa kursus',
    field: [
      { nama: 'id', tipe: 'UUID', keterangan: 'Primary key' },
      { nama: 'nama_lengkap', tipe: 'TEXT', keterangan: 'Nama lengkap siswa' },
      { nama: 'instrumen', tipe: 'ENUM (gitar/piano/drum)', keterangan: 'Instrumen dipelajari' }
    ]
  }
];

const schemaMarkdown = renderDataSchemaMarkdown(mockTables, 'lembar_evaluasi.relasi_ke_siswa → siswa.id');

console.log('=== SCHEMA MARKDOWN OUTPUT ===');
console.log(schemaMarkdown);

const checks = [
  { name: 'lembar_evaluasi ada', pass: schemaMarkdown.includes('lembar_evaluasi') },
  { name: 'kemampuan_awal ada', pass: schemaMarkdown.includes('kemampuan_awal') },
  { name: 'teknik_jari ada', pass: schemaMarkdown.includes('teknik_jari') },
  { name: 'relasi_ke_siswa ada', pass: schemaMarkdown.includes('relasi_ke_siswa') },
  { name: 'tipe relasi ada', pass: schemaMarkdown.includes('relasi ke siswa') },
  { name: 'korelasi section ada', pass: schemaMarkdown.includes('Korelasi') },
];

console.log('\n=== CHECKS ===');
checks.forEach(c => console.log(`  ${c.pass ? '✅' : '❌'} ${c.name}`));
const allPass = checks.every(c => c.pass);
console.log(`\n${allPass ? '🎉 SEMUA PASS' : '⚠️ ADA YANG FAIL'}`);
if (!allPass) process.exit(1);
