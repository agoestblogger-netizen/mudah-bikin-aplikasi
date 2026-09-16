import {
  detectTargetRoleForField,
  detectTargetRoleForFieldAsync,
  repairRelasiSimulasiDb,
  validateContohDataVsSchema,
  generateDeterministicSimulasiDb
} from '../src/lib/templates/processes/guided';
import type { MockupSessionState } from '../src/lib/templates/processes/types';

console.log('================================================================');
console.log('TEST SUITE TEMUAN #2: LAPIS AI SEMANTIK & JARING PENGAMAN POIN A');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// 1. SUBTEST 2a: LAPIS 3 AI SEMANTIK BERHASIL MENCOCOKKAN ROLE
// -----------------------------------------------------------------------------
console.log('--- [Subtest 2a] Uji Lapis AI Semantik untuk Role Non-Standar ---');

// Mock semantic AI matcher yang merepresentasikan respon LLM yang cerdas
const mockSemanticAi = async (stem: string, kata: string, officialRoles: string[]) => {
  const stemLower = stem.toLowerCase();
  if (stemLower.includes('pembimbing')) {
    return officialRoles.find((r) => r.toLowerCase().includes('mentor')) || null;
  }
  if (stemLower.includes('pengawas')) {
    return officialRoles.find((r) => r.toLowerCase().includes('pembina')) || null;
  }
  return null;
};

// Test 3: pembimbing_id -> Mentor Vokasi
const fPembimbing = {
  nama: 'pembimbing_id',
  tipe: 'relasi ke pengguna',
  keterangan: 'ID pembimbing praktek kerja'
};
const rolesTest3 = ['Super Admin', 'Mentor Vokasi', 'Staf Administrasi'];

const resTest3Sync = detectTargetRoleForField(fPembimbing, rolesTest3);
console.log(`  Test 3 (Sync tanpa AI): ${resTest3Sync || 'null (Lapis 1 & 2 & Kamus Tetap tidak cocok)'}`);

const resTest3Async = await detectTargetRoleForFieldAsync(fPembimbing, rolesTest3, mockSemanticAi);
console.log(`  Test 3 (Async dengan Lapis AI Semantik): ${resTest3Async}`);
if (resTest3Async !== 'Mentor Vokasi') {
  throw new Error(`Expected 'Mentor Vokasi', got: ${resTest3Async}`);
}
console.log('  ✅ Test 3 PASS: Lapis 3 AI semantik berhasil mendeteksi "Mentor Vokasi"!\n');

// Test 5: pengawas_id -> Pembina Lapangan
const fPengawas = {
  nama: 'pengawas_id',
  tipe: 'relasi ke pengguna',
  keterangan: 'ID pengawas kegiatan lapangan'
};
const rolesTest5 = ['Super Admin', 'Pembina Lapangan', 'Staf'];

const resTest5Sync = detectTargetRoleForField(fPengawas, rolesTest5);
console.log(`  Test 5 (Sync tanpa AI): ${resTest5Sync || 'null (Lapis 1 & 2 & Kamus Tetap tidak cocok)'}`);

const resTest5Async = await detectTargetRoleForFieldAsync(fPengawas, rolesTest5, mockSemanticAi);
console.log(`  Test 5 (Async dengan Lapis AI Semantik): ${resTest5Async}`);
if (resTest5Async !== 'Pembina Lapangan') {
  throw new Error(`Expected 'Pembina Lapangan', got: ${resTest5Async}`);
}
console.log('  ✅ Test 5 PASS: Lapis 3 AI semantik berhasil mendeteksi "Pembina Lapangan"!\n');

// -----------------------------------------------------------------------------
// 2. SUBTEST 2b: JARING PENGAMAN JIKA SEMUA LAPIS (TERMASUK AI) GAGAL
// -----------------------------------------------------------------------------
console.log('--- [Subtest 2b] Jaring Pengaman: Gagal Deteksi -> Peringatan POIN A & Kosongkan ID ---');

// AI menyatakan "tidak ada yang cocok" / null
const mockAiGagal = async () => null;

const fMisterius = {
  nama: 'konsultan_asing_id',
  tipe: 'relasi ke pengguna',
  keterangan: 'ID konsultan misterius luar negeri'
};
const rolesUmum = ['Super Admin', 'Staf Administrasi', 'Instruktur'];

const resGagal = await detectTargetRoleForFieldAsync(fMisterius, rolesUmum, mockAiGagal);
console.log(`  Deteksi konsultan_asing_id saat AI ragu: ${resGagal || 'null'}`);
if (resGagal !== null) {
  throw new Error(`Expected null, got: ${resGagal}`);
}

// Simulasi data tabel dengan relasi ke pengguna tapi targetRole tidak pasti
const tabelContoh = [
  {
    nama: 'pengguna',
    baris: [
      { id: 'USR-001', nama: 'Owner', peran: 'Super Admin' },
      { id: 'USR-002', nama: 'Siti', peran: 'Staf Administrasi' },
      { id: 'USR-003', nama: 'Hendra', peran: 'Instruktur' }
    ]
  },
  {
    nama: 'proyek_khusus',
    field: [
      { nama: 'id', tipe: 'text', keterangan: 'ID Proyek' },
      { nama: 'konsultan_asing_id', tipe: 'relasi ke pengguna', keterangan: 'ID konsultan misterius luar negeri' }
    ],
    baris: [
      { id: 'PRJ-001', konsultan_asing_id: 'USR-001' },
      { id: 'PRJ-002', konsultan_asing_id: 'USR-002' }
    ]
  }
];

// Jalankan repairRelasiSimulasiDb
repairRelasiSimulasiDb(tabelContoh, rolesUmum);

console.log('  Nilai field konsultan_asing_id setelah repairRelasiSimulasiDb:');
tabelContoh[1].baris.forEach((r, idx) => {
  console.log(`    Baris ${idx + 1} (${r.id}): "${r.konsultan_asing_id}"`);
  if (r.konsultan_asing_id !== '') {
    throw new Error(`Jaring pengaman gagal! Field diisi "${r.konsultan_asing_id}", seharusnya kosong ""`);
  }
});
console.log('  ✅ Jaring Pengaman DB PASS: Field tidak diisi ID sembarang pengguna!\n');

// Uji validator validateContohDataVsSchema
const schemas = [
  {
    nama: 'pengguna',
    field: [
      { nama: 'id', tipe: 'text', keterangan: 'ID' },
      { nama: 'nama', tipe: 'text', keterangan: 'Nama' },
      { nama: 'peran', tipe: 'text', keterangan: 'Peran' }
    ]
  },
  {
    nama: 'proyek_khusus',
    field: [
      { nama: 'id', tipe: 'text', keterangan: 'ID' },
      { nama: 'konsultan_asing_id', tipe: 'relasi ke pengguna', keterangan: 'ID konsultan misterius luar negeri' }
    ]
  }
];

const validasiMasalah = validateContohDataVsSchema({ tabel: tabelContoh }, schemas, rolesUmum);
console.log('  Masalah validasi yang terdeteksi:');
validasiMasalah.forEach((m) => console.log(`    - ${m}`));

const hasPoinAWarning = validasiMasalah.some(
  (m) => m.includes('⚠️ PERINGATAN [POIN A]') && m.includes('konsultan_asing_id')
);
if (!hasPoinAWarning) {
  throw new Error('Expected ⚠️ PERINGATAN [POIN A] for konsultan_asing_id');
}
console.log('  ✅ Jaring Pengaman Validasi PASS: Peringatan eksplisit POIN A terbit ke user!\n');

// -----------------------------------------------------------------------------
// 3. SUBTEST 2c: FIELD BUKAN PENGGUNA (warna_favorit, mobil_id) TIDAK DAPAT WARNING PALSU
// -----------------------------------------------------------------------------
console.log('--- [Subtest 2c] Field Bukan Relasi Pengguna: ZERO FALSE POSITIVE ---');

const tabelNormal = [
  {
    nama: 'pengguna',
    baris: [{ id: 'USR-001', nama: 'Admin', peran: 'Super Admin' }]
  },
  {
    nama: 'mobil',
    baris: [{ id: 'MBL-001', plat_nomor: 'B 1234 CD' }]
  },
  {
    nama: 'jadwal',
    field: [
      { nama: 'id', tipe: 'text', keterangan: 'ID' },
      { nama: 'mobil_id', tipe: 'relasi ke mobil', keterangan: 'ID unit kendaraan' },
      { nama: 'warna_favorit', tipe: 'text', keterangan: 'Warna kesukaan murid' }
    ],
    baris: [
      { id: 'JDW-001', mobil_id: 'MBL-001', warna_favorit: 'Biru Metalik' }
    ]
  }
];

const schemasNormal = [
  {
    nama: 'pengguna',
    field: [{ nama: 'id', tipe: 'text', keterangan: 'ID' }, { nama: 'nama', tipe: 'text', keterangan: 'Nama' }, { nama: 'peran', tipe: 'text', keterangan: 'Peran' }]
  },
  {
    nama: 'mobil',
    field: [{ nama: 'id', tipe: 'text', keterangan: 'ID' }, { nama: 'plat_nomor', tipe: 'text', keterangan: 'Plat' }]
  },
  {
    nama: 'jadwal',
    field: [
      { nama: 'id', tipe: 'text', keterangan: 'ID' },
      { nama: 'mobil_id', tipe: 'relasi ke mobil', keterangan: 'ID unit kendaraan' },
      { nama: 'warna_favorit', tipe: 'text', keterangan: 'Warna kesukaan murid' }
    ]
  }
];

// Jalankan repair
repairRelasiSimulasiDb(tabelNormal, rolesUmum);
const validasiNormal = validateContohDataVsSchema({ tabel: tabelNormal }, schemasNormal, rolesUmum);

console.log('  Validasi tabel normal (mobil_id, warna_favorit):', validasiNormal.length === 0 ? '0 masalah (BERSIH)' : validasiNormal);
if (validasiNormal.length > 0) {
  throw new Error(`Expected 0 masalah for non-user fields, got: ${validasiNormal.join(', ')}`);
}
console.log('  ✅ Zero False Positive PASS: Field non-user tidak memicu peringatan POIN A!\n');

console.log('================================================================');
console.log('🎉 SELURUH SUBTEST TEMUAN #2 BERHASIL 100% LOLOS (PASS)!');
console.log('================================================================');
