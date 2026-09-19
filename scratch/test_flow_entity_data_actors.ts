import assert from 'node:assert';
import {
  getDomainFlowDetails,
  reconcileCoreOperationalRole,
  isActorEntityData,
  resolveActorForStep
} from '../src/lib/templates/processes/guided';
import type { MockupSessionState } from '../src/lib/templates/processes/types';

console.log('========================================================================');
console.log('🚀 TEST SUITE: PENANDAAN AKTOR ALUR INTI & ENTITAS DATA (BEBAS HIJACKING)');
console.log('========================================================================\n');

// -------------------------------------------------------------------------
// TEST 1: DOMAIN RENTAL SEPEDA (Pelanggan vs Petugas Rental vs Super Admin)
// -------------------------------------------------------------------------
console.log('--- [TEST 1] DOMAIN RENTAL SEPEDA ---');

const rentalSession: MockupSessionState = {
  storyline: {
    narasi: '"Pelanggan" mendatangi kios untuk memilih jenis sepeda dari "Katalog Sepeda", lalu "Petugas Rental" mencatat pendaftaran sewa serta menerima "Uang Deposit". Setelah bersepeda, "Pelanggan" mengembalikan unit untuk diperiksa fisiknya dan melunasi "Total Biaya Sewa" di kasir.',
    asumsiAlurUtama: 'Pelanggan datang ke counter rental untuk memilih sepeda -> Petugas mencatat pendaftaran sewa dan menerima uang deposit -> Pelanggan menggunakan sepeda hingga periode sewa selesai -> Petugas memeriksa kondisi sepeda saat dikembalikan -> Pelanggan melunasi total biaya sewa di kasir -> Pemilik memantau rekap transaksi harian',
    asumsiAktor: ['Pelanggan', 'Petugas Rental']
  },
  actorsClassification: [
    { actor: 'Pelanggan', category: 'ENTITAS_DATA', ownerRole: 'Petugas Rental', reason: 'Penyewa luar' },
    { actor: 'Petugas Rental', category: 'PENGGUNA_SISTEM', reason: 'Staf operasional rental' }
  ],
  roles: {
    wajib: ['Super Admin', 'Petugas Rental'],
    selected: ['Super Admin', 'Petugas Rental'],
    tambahan: []
  }
};

const rentalFlow = getDomainFlowDetails(rentalSession);
console.log('Langkah Alur Inti Rental Sepeda:');
rentalFlow.alurInti.forEach(s => console.log(`  ${s.step}. (${s.pelaku}) ${s.aksi}`));

// Verifikasi Pelaku Langkah:
const step1 = rentalFlow.alurInti.find(s => s.step === 1);
const step2 = rentalFlow.alurInti.find(s => s.step === 2);
const step3 = rentalFlow.alurInti.find(s => s.step === 3);
const step4 = rentalFlow.alurInti.find(s => s.step === 4);
const step5 = rentalFlow.alurInti.find(s => s.step === 5);
const step6 = rentalFlow.alurInti.find(s => s.step === 6);

assert.strictEqual(step1?.pelaku, 'Pelanggan', 'Langkah 1 (datang & memilih) harus (Pelanggan), bukan (Petugas Rental)');
assert.strictEqual(step2?.pelaku, 'Petugas Rental', 'Langkah 2 (mencatat sewa & deposit) harus (Petugas Rental)');
assert.strictEqual(step3?.pelaku, 'Pelanggan', 'Langkah 3 (menggunakan sepeda) harus (Pelanggan), bukan (Petugas Rental)');
assert.strictEqual(step4?.pelaku, 'Petugas Rental', 'Langkah 4 (memeriksa sepeda) harus (Petugas Rental)');
assert.strictEqual(step5?.pelaku, 'Pelanggan', 'Langkah 5 (melunasi sewa di kasir) harus (Pelanggan)');
assert.strictEqual(step6?.pelaku, 'Super Admin', 'Langkah 6 (pantau rekap) harus (Super Admin)');

// Verifikasi Alur Pendukung:
const alur1Step1 = rentalFlow.alurPendukung[0]?.steps[0];
assert.strictEqual(alur1Step1?.pelaku, 'Pelanggan', 'Alur Pendukung 1 langkah 1 harus diawali (Pelanggan)');

console.log('✅ TEST 1 LULUS: Rental Sepeda berhasil menandai Pelanggan, Petugas Rental, dan Super Admin sesuai peran riil!\n');

// -------------------------------------------------------------------------
// TEST 2: DOMAIN KURSUS MUSIK (Siswa vs Instruktur Musik vs Super Admin)
// -------------------------------------------------------------------------
console.log('--- [TEST 2] DOMAIN KURSUS MUSIK ---');

const kursusSession: MockupSessionState = {
  storyline: {
    narasi: '"Siswa" mendaftar dan memilih instrumen les musik di studio. "Instruktur Musik" menyusun jadwal latihan dan membimbing siswa di ruang studio. "Siswa" mengikuti sesi latihan dan evaluasi berkala.',
    asumsiAlurUtama: 'Siswa mendaftar dan memilih paket kursus musik -> Instruktur menjadwalkan sesi latihan di studio -> Siswa mengikuti sesi latihan musik -> Instruktur mencatat evaluasi perkembangan -> Pemilik memantau rekap studio',
    asumsiAktor: ['Siswa', 'Instruktur Musik']
  },
  actorsClassification: [
    { actor: 'Siswa', category: 'ENTITAS_DATA', ownerRole: 'Instruktur Musik', reason: 'Peserta didik' },
    { actor: 'Instruktur Musik', category: 'PENGGUNA_SISTEM', reason: 'Staf pengajar' }
  ],
  roles: {
    wajib: ['Super Admin', 'Instruktur Musik'],
    selected: ['Super Admin', 'Instruktur Musik'],
    tambahan: []
  }
};

const kursusFlow = getDomainFlowDetails(kursusSession);
console.log('Langkah Alur Inti Kursus Musik:');
kursusFlow.alurInti.forEach(s => console.log(`  ${s.step}. (${s.pelaku}) ${s.aksi}`));

const kStep1 = kursusFlow.alurInti.find(s => s.step === 1);
const kStep2 = kursusFlow.alurInti.find(s => s.step === 2);
const kStep3 = kursusFlow.alurInti.find(s => s.step === 3);
const kStep4 = kursusFlow.alurInti.find(s => s.step === 4);
const kStep5 = kursusFlow.alurInti.find(s => s.step === 5);

assert.strictEqual(kStep1?.pelaku, 'Siswa', 'Langkah 1 (pendaftaran kursus) harus (Siswa), bukan (Super Admin)');
assert.strictEqual(kStep2?.pelaku, 'Instruktur Musik', 'Langkah 2 (menjadwalkan sesi) harus (Instruktur Musik)');
assert.strictEqual(kStep3?.pelaku, 'Siswa', 'Langkah 3 (mengikuti latihan) harus (Siswa), bukan (Super Admin)');
assert.strictEqual(kStep4?.pelaku, 'Instruktur Musik', 'Langkah 4 (catat evaluasi) harus (Instruktur Musik)');
assert.strictEqual(kStep5?.pelaku, 'Super Admin', 'Langkah 5 (pantau rekap) harus (Super Admin)');

console.log('✅ TEST 2 LULUS: Kursus Musik berhasil menandai Siswa, Instruktur Musik, dan Super Admin secara tepat!\n');

// -------------------------------------------------------------------------
// TEST 3: DOMAIN KLINIK GIGI (Pasien vs Dokter Gigi vs Super Admin)
// -------------------------------------------------------------------------
console.log('--- [TEST 3] DOMAIN KLINIK GIGI ---');

const klinikSession: MockupSessionState = {
  storyline: {
    narasi: '"Pasien" datang untuk reservasi perawatan gigi. "Dokter Gigi" memeriksa rongga mulut dan melakukan tindakan pembersihan karang gigi. "Pasien" menerima kuitansi pembayaran dan resep obat.',
    asumsiAlurUtama: 'Pasien datang dan mendaftar di meja resepsionis -> Dokter Gigi melakukan pemeriksaan rongga mulut -> Pasien menjalani tindakan perawatan gigi -> Dokter Gigi meresepkan obat -> Pemilik memeriksa rekonsiliasi harian',
    asumsiAktor: ['Pasien', 'Dokter Gigi']
  },
  actorsClassification: [
    { actor: 'Pasien', category: 'ENTITAS_DATA', ownerRole: 'Dokter Gigi', reason: 'Pihak yang menerima perawatan medis' },
    { actor: 'Dokter Gigi', category: 'PENGGUNA_SISTEM', reason: 'Tenaga medis' }
  ],
  roles: {
    wajib: ['Super Admin', 'Dokter Gigi'],
    selected: ['Super Admin', 'Dokter Gigi'],
    tambahan: []
  }
};

const klinikFlow = getDomainFlowDetails(klinikSession);
console.log('Langkah Alur Inti Klinik Gigi:');
klinikFlow.alurInti.forEach(s => console.log(`  ${s.step}. (${s.pelaku}) ${s.aksi}`));

const klStep1 = klinikFlow.alurInti.find(s => s.step === 1);
const klStep2 = klinikFlow.alurInti.find(s => s.step === 2);
const klStep3 = klinikFlow.alurInti.find(s => s.step === 3);

assert.strictEqual(klStep1?.pelaku, 'Pasien', 'Langkah 1 (pendaftaran) harus (Pasien)');
assert.strictEqual(klStep2?.pelaku, 'Dokter Gigi', 'Langkah 2 (pemeriksaan) harus (Dokter Gigi)');
assert.strictEqual(klStep3?.pelaku, 'Pasien', 'Langkah 3 (menjalani tindakan) harus (Pasien)');

console.log('✅ TEST 3 LULUS: Klinik Gigi berhasil menandai Pasien dan Dokter Gigi secara presisi!\n');

// -------------------------------------------------------------------------
// TEST 4: PEMISAHAN KONSEPTUAL RBAC VS NARASI ALUR
// -------------------------------------------------------------------------
console.log('--- [TEST 4] PEMISAHAN KONSEPTUAL RBAC & SISTEM ROLES (NON-REGRESI) ---');

// 1. Pastikan ENTITAS_DATA TIDAK dimasukkan ke session.roles.selected
assert.strictEqual(rentalSession.roles?.selected.includes('Pelanggan'), false, 'Pelanggan DILARANG masuk session.roles.selected');
assert.strictEqual(kursusSession.roles?.selected.includes('Siswa'), false, 'Siswa DILARANG masuk session.roles.selected');
assert.strictEqual(klinikSession.roles?.selected.includes('Pasien'), false, 'Pasien DILARANG masuk session.roles.selected');

// 2. Pastikan reconcileCoreOperationalRole tidak menjadikan Pelanggan sebagai role operasional
const recRental = reconcileCoreOperationalRole(rentalSession, rentalFlow);
assert.strictEqual(recRental.newCoreRole, 'Petugas Rental', 'Core operational role Rental Sepeda tetap Petugas Rental');

const recKursus = reconcileCoreOperationalRole(kursusSession, kursusFlow);
assert.strictEqual(recKursus.newCoreRole, 'Instruktur Musik', 'Core operational role Kursus Musik tetap Instruktur Musik');

console.log('✅ TEST 4 LULUS: Hak akses RBAC / login sistem 100% terjaga murni untuk PENGGUNA_SISTEM!\n');

console.log('========================================================================');
console.log('🎉 SEMUA 4 PENGUJIAN PENANDAAN AKTOR ALUR INTI LULUS SEMPURNA! 🎉');
console.log('========================================================================');
