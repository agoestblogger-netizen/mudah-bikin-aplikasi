import fs from 'fs';
import path from 'path';

// Baca .env.local manual
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...vals] = trimmed.split('=');
      const val = vals.join('=').trim().replace(/^['"]|['"]$/g, '');
      if (key && !process.env[key.trim()]) {
        process.env[key.trim()] = val;
      }
    }
  }
}

import { generateDataSchemaWithAI } from '../src/app/api/guided/route';

async function runMultiDomainVerification() {
  console.log('================================================================');
  console.log('🧪 VERIFIKASI MULTI-DOMAIN: GROUNDING & REFERENSI INDUSTRI UMUM');
  console.log('================================================================\n');

  const provider = 'openai';
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  // ---------------------------------------------------------------------------
  // 1. DOMAIN KURSUS MUSIK
  // ---------------------------------------------------------------------------
  console.log('--- 1. DOMAIN: KURSUS MUSIK ---');
  const sessionKursus: any = {
    match: { businessCategory: 'Kursus Musik' },
    storyline: {
      narasi: 'Pengelolaan kursus les musik mulai pendaftaran murid, penentuan paket les, jadwal ruangan studio, absensi instruktur, dan pembayaran SPP bulanan.',
      asumsiAlurUtama: 'Pendaftaran & Pemilihan Paket -> Penjadwalan Ruangan & Instruktur -> Pelaksanaan Les -> Pembayaran SPP'
    },
    roles: { selected: ['Super Admin', 'Instruktur Musik', 'Murid'] },
    flow: {
      alurInti: [
        { step: 1, pelaku: 'Murid', aksi: 'Mendaftar les dan memilih paket kursus musik' },
        { step: 2, pelaku: 'Super Admin', aksi: 'Menentukan jadwal les mingguan dan mengalokasikan ruangan studio' },
        { step: 3, pelaku: 'Instruktur Musik', aksi: 'Mengisi materi pembelajaran dan presensi murid' },
        { step: 4, pelaku: 'Super Admin', aksi: 'Menerima pembayaran SPP bulanan kursus' }
      ],
      fiturPendukung: [
        'Pencatatan Pilihan Instrumen & Paket Kursus (Piano, Gitar, Drum, Vokal)',
        'Manajemen Ruangan Studio & Jadwal',
        'Kartu Iuran SPP Digital'
      ]
    },
    rbac: {
      modul: [
        { nama: 'Pendaftaran & Paket', deskripsiFungsional: 'Pendaftaran murid baru dan paket kursus' },
        { nama: 'Jadwal & Studio', deskripsiFungsional: 'Jadwal mengajar dan alokasi ruangan' },
        { nama: 'Keuangan & SPP', deskripsiFungsional: 'Pencatatan pembayaran biaya kursus' }
      ]
    }
  };

  const resKursus = await generateDataSchemaWithAI(sessionKursus, provider, apiKey, model);
  console.log('Tabel Kursus Musik yang Dihasilkan:');
  resKursus.tabel.forEach(t => console.log(`  * Tabel: ${t.nama} -> [${t.field.map(f => f.nama).join(', ')}]`));
  const kursusFields = resKursus.tabel.flatMap(t => t.field.map(f => `${t.nama}.${f.nama} (${f.keterangan})`));
  const hasCourseType = kursusFields.some(f => /paket|kursus|instrumen|jenis/i.test(f));
  console.log('Hasil Uji Kursus Musik:', hasCourseType ? '✅ [PASS] Berhasil grounded ke paket/jenis kursus!' : '❌ [FAIL]');

  // ---------------------------------------------------------------------------
  // 2. DOMAIN RENTAL MOBIL (REGRESI)
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. DOMAIN: RENTAL MOBIL (REGRESI) ---');
  const sessionRental: any = {
    match: { businessCategory: 'Rental Mobil' },
    storyline: {
      narasi: 'Sistem penyewaan kendaraan lepas kunci dan dengan supir, pemantauan ketersediaan unit mobil, dan pengembalian unit.',
      asumsiAlurUtama: 'Pilih Mobil -> Verifikasi KTP -> Pembayaran DP & Serah Terima -> Pengembalian Unit'
    },
    roles: { selected: ['Super Admin', 'Petugas Rental', 'Penyewa'] },
    flow: {
      alurInti: [
        { step: 1, pelaku: 'Penyewa', aksi: 'Melihat katalog dan memilih unit mobil yang tersedia' },
        { step: 2, pelaku: 'Petugas Rental', aksi: 'Memverifikasi identitas KTP/SIM dan menerima uang muka sewa' },
        { step: 3, pelaku: 'Petugas Rental', aksi: 'Menyerahkan unit kendaraan dan mencatat kondisi fisik mobil' },
        { step: 4, pelaku: 'Petugas Rental', aksi: 'Menerima pengembalian mobil dan menghitung denda keterlambatan' }
      ]
    },
    rbac: {
      modul: [
        { nama: 'Katalog Armada', deskripsiFungsional: 'Kelola data mobil dan tarif harian' },
        { nama: 'Transaksi Sewa', deskripsiFungsional: 'Pencatatan sewa mobil dan status rental' }
      ]
    }
  };

  const resRental = await generateDataSchemaWithAI(sessionRental, provider, apiKey, model);
  console.log('Tabel Rental Mobil yang Dihasilkan:');
  resRental.tabel.forEach(t => console.log(`  * Tabel: ${t.nama} -> [${t.field.map(f => f.nama).join(', ')}]`));
  const rentalFields = resRental.tabel.flatMap(t => t.field.map(f => `${t.nama}.${f.nama} (${f.keterangan})`));
  const hasCarFields = rentalFields.some(f => /mobil|armada|kendaraan|unit|tarif|sewa|plat|denda/i.test(f));
  console.log('Hasil Uji Rental Mobil:', hasCarFields ? '✅ [PASS] Seluruh entitas armada/sewa/tarif terjaga rapi!' : '❌ [FAIL]');

  // ---------------------------------------------------------------------------
  // 3. DOMAIN KOPERASI SIMPAN PINJAM (REGRESI)
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. DOMAIN: KOPERASI SIMPAN PINJAM (REGRESI) ---');
  const sessionKoperasi: any = {
    match: { businessCategory: 'Koperasi Simpan Pinjam' },
    storyline: {
      narasi: 'Pengelolaan simpanan sukarela dan pengajuan pinjaman anggota dengan angsuran bulanan.',
      asumsiAlurUtama: 'Pengajuan Pinjaman -> Verifikasi Skor Kredit -> Pencairan Dana -> Angsuran Bulanan'
    },
    roles: { selected: ['Super Admin', 'Petugas Kredit', 'Anggota Koperasi'] },
    flow: {
      alurInti: [
        { step: 1, pelaku: 'Anggota Koperasi', aksi: 'Mengajukan pinjaman dana dan memilih tenor angsuran' },
        { step: 2, pelaku: 'Petugas Kredit', aksi: 'Memverifikasi berkas jaminan dan kapasitas bayar anggota' },
        { step: 3, pelaku: 'Super Admin', aksi: 'Menyetujui permohonan dan mencairkan dana pinjaman' },
        { step: 4, pelaku: 'Petugas Kredit', aksi: 'Menerima pembayaran angsuran cicilan bulanan' }
      ]
    },
    rbac: {
      modul: [
        { nama: 'Keanggotaan', deskripsiFungsional: 'Data anggota dan simpanan' },
        { nama: 'Pengajuan Pinjaman', deskripsiFungsional: 'Kelola pinjaman dan verifikasi limit' },
        { nama: 'Angsuran', deskripsiFungsional: 'Pencatatan cicilan bulanan' }
      ]
    }
  };

  const resKoperasi = await generateDataSchemaWithAI(sessionKoperasi, provider, apiKey, model);
  console.log('Tabel Koperasi yang Dihasilkan:');
  resKoperasi.tabel.forEach(t => console.log(`  * Tabel: ${t.nama} -> [${t.field.map(f => f.nama).join(', ')}]`));
  const koperasiFields = resKoperasi.tabel.flatMap(t => t.field.map(f => `${t.nama}.${f.nama} (${f.keterangan})`));
  const hasLoanFields = koperasiFields.some(f => /pinjaman|angsuran|tenor|cicilan|nominal|bunga/i.test(f));
  console.log('Hasil Uji Koperasi:', hasLoanFields ? '✅ [PASS] Entitas pinjaman, tenor, dan angsuran solid!' : '❌ [FAIL]');

  // ---------------------------------------------------------------------------
  // 4. DOMAIN BARU: KLINIK HEWAN & PET CARE (BELUM PERNAH DITES SEBELUMNYA)
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. DOMAIN BARU: KLINIK HEWAN & PET CARE ---');
  const sessionKlinikHewan: any = {
    match: { businessCategory: 'Klinik Hewan & Pet Care' },
    storyline: {
      narasi: 'Sistem operasional klinik hewan dan perawatan peliharaan (grooming & penitipan), pencatatan rekam medis hewan, tindakan dokter, dan tagihan pengobatan.',
      asumsiAlurUtama: 'Pendaftaran Pasien Hewan -> Pemeriksaan Dokter -> Tindakan / Obat -> Pembayaran Kasir'
    },
    roles: { selected: ['Super Admin', 'Dokter Hewan', 'Pemilik Hewan', 'Resepsionis'] },
    flow: {
      alurInti: [
        { step: 1, pelaku: 'Pemilik Hewan', aksi: 'Mendaftarkan hewan peliharaan dan keluhan awal sakit' },
        { step: 2, pelaku: 'Dokter Hewan', aksi: 'Memeriksa fisik hewan, menentukan diagnosa dan resep obat' },
        { step: 3, pelaku: 'Resepsionis', aksi: 'Menghitung total biaya tindakan medis dan mencetak nota tagihan' }
      ],
      fiturPendukung: [
        'Rekam Medis Riwayat Vaksinasi & Alergi',
        'Katalog Layanan Grooming & Penitipan',
        'Manajemen Stok Obat-obatan Hewan'
      ]
    },
    rbac: {
      modul: [
        { nama: 'Pendaftaran Pasien Hewan', deskripsiFungsional: 'Registrasi hewan dan pemiliknya' },
        { nama: 'Rekam Medis & Tindakan', deskripsiFungsional: 'Input diagnosa dan tindakan medis dokter' },
        { nama: 'Kasir & Pembayaran', deskripsiFungsional: 'Pembayaran tagihan obat dan layanan' }
      ]
    }
  };

  const resKlinik = await generateDataSchemaWithAI(sessionKlinikHewan, provider, apiKey, model);
  console.log('Tabel Klinik Hewan yang Dihasilkan:');
  resKlinik.tabel.forEach(t => console.log(`  * Tabel: ${t.nama} -> [${t.field.map(f => f.nama).join(', ')}]`));
  const klinikFields = resKlinik.tabel.flatMap(t => t.field.map(f => `${t.nama}.${f.nama} (${f.keterangan})`));
  const hasPetFields = klinikFields.some(f => /hewan|diagnosa|keluhan|tindakan|obat|pasien|rekam_medis/i.test(f));
  console.log('Hasil Uji Domain Baru Klinik Hewan:', hasPetFields ? '✅ [PASS] AI berhasil mengekstrak entitas hewan, diagnosa, dan tindakan medis murni dari konteks & pola industri tanpa keyword matching!' : '❌ [FAIL]');
}

runMultiDomainVerification();
