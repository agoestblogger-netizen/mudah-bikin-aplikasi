import { extractTablesAndCorrelationFromParsed } from '../src/app/api/guided/route';
import { detectTargetRoleForField } from '../src/lib/templates/processes/guided';

console.log('--- TEST 1: ISOLATED UNIT TEST UNTUK EXTRACT_TABLES & DETECT_TARGET_ROLE ---');

const officialRoles = ['Super Admin', 'Mentor Vokasi', 'Pembina Lapangan'];

// Mock payload parsed JSON dari LLM
const mockParsed = {
  tabel: [
    {
      nama: 'pengguna',
      keterangan: 'Tabel pengguna sistem',
      field: [
        { nama: 'id', tipe: 'text', keterangan: 'ID pengguna' },
        { nama: 'nama', tipe: 'text', keterangan: 'Nama pengguna' },
        { nama: 'peran', tipe: 'text', keterangan: 'Peran' }
      ]
    },
    {
      nama: 'kegiatan_lapangan',
      keterangan: 'Pencatatan kegiatan',
      field: [
        { nama: 'id', tipe: 'text', keterangan: 'ID Kegiatan' },
        { nama: 'mentor_vokasi_id', tipe: 'relasi ke pengguna', keterangan: 'ID mentor pendamping' },
        { nama: 'pembina_id', tipe: 'relasi ke pengguna', keterangan: 'ID pembina kegiatan' },
        { nama: 'warna_favorit', tipe: 'text', keterangan: 'Warna identitas kelompok' }
      ]
    }
  ],
  korelasiRingkas: 'Relasi pengguna dengan kegiatan lapangan'
};

// 1. Uji extractTablesAndCorrelationFromParsed DENGAN officialRoles
console.log('\n[Subtest 1.1] extractTablesAndCorrelationFromParsed DENGAN officialRoles:');
const extracted = await extractTablesAndCorrelationFromParsed(mockParsed, undefined, officialRoles);

if (!extracted) {
  throw new Error('Gagal mengekstrak tabel dari mockParsed');
}

const kegiatanTable = extracted.tables.find((t) => t.nama === 'kegiatan_lapangan');
if (!kegiatanTable) {
  throw new Error('Tabel kegiatan_lapangan tidak ditemukan');
}

const mentorField = kegiatanTable.field.find((f) => f.nama === 'mentor_vokasi_id');
const pembinaField = kegiatanTable.field.find((f) => f.nama === 'pembina_id');
const warnaField = kegiatanTable.field.find((f) => f.nama === 'warna_favorit');

console.log('  mentor_vokasi_id targetRole:', mentorField?.targetRole);
console.log('  pembina_id targetRole:', pembinaField?.targetRole);
console.log('  warna_favorit targetRole:', warnaField?.targetRole);

if (mentorField?.targetRole !== 'Mentor Vokasi') {
  throw new Error(`Expected mentor_vokasi_id targetRole 'Mentor Vokasi', got: ${mentorField?.targetRole}`);
}
if (pembinaField?.targetRole !== 'Pembina Lapangan') {
  throw new Error(`Expected pembina_id targetRole 'Pembina Lapangan', got: ${pembinaField?.targetRole}`);
}
if (warnaField?.targetRole !== undefined) {
  throw new Error(`Expected warna_favorit targetRole undefined, got: ${warnaField?.targetRole}`);
}
console.log('  ✅ Subtest 1.1 PASS: targetRole terisi dinamis dari officialRoles!');

// 2. Uji warning log eksplisit saat detectTargetRoleForField dipanggil tanpa officialRoles
console.log('\n[Subtest 1.2] Warning log saat dipanggil tanpa officialRoles:');
let warnLogged = false;
const originalWarn = console.warn;
console.warn = (...args: any[]) => {
  const msg = args.join(' ');
  if (msg.includes('[ROLE-RELATION-WARN]')) {
    warnLogged = true;
  }
  originalWarn(...args);
};

const fTest = { nama: 'mentor_vokasi_id', tipe: 'relasi ke pengguna' };
const resNoRoles = detectTargetRoleForField(fTest); // TANPA officialRoles
console.warn = originalWarn;

console.log('  Result without officialRoles:', resNoRoles);
console.log('  Warning logged:', warnLogged);

if (!warnLogged) {
  throw new Error('Expected console.warn with [ROLE-RELATION-WARN] when officialRoles is missing');
}
console.log('  ✅ Subtest 1.2 PASS: Log peringatan eksplisit terpanggil!');

console.log('\n🎉 ALL ISOLATED UNIT TESTS PASS!');
