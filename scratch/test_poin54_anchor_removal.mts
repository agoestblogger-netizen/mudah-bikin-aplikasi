import {
  generateRbacMatrixWithAI,
  generateSupportingFlowsAndFeaturesWithAI,
  validateRbacMatrixRelevance,
  analyzeRolesWithAI
} from '../src/app/api/guided/route';
import type { MockupSessionState } from '../src/lib/templates/processes/types';
import fs from 'node:fs';

if (fs.existsSync('.env.local')) {
  process.loadEnvFile('.env.local');
}

async function runAnchorRemovalTests() {
  console.log('=== TEST SUITE: ANCHOR REMOVAL & VERIFIKASI DOMAIN (PET HOTEL & RENTAL) ===\n');

  // -------------------------------------------------------------------------
  // TEST 1: PET HOTEL 8X SIKLUS (STRESS TEST - FIRST TRY ZERO RENTAL LEAK)
  // -------------------------------------------------------------------------
  console.log('--- TEST 1: Pet Hotel 8x AI Stress Test (Deteksi Kebocoran Rental & Kebutuhan Retry) ---');

  const petHotelSession: MockupSessionState = {
    step: 'RBAC',
    match: {
      templateId: 'MT-05',
      overlayIds: ['IND-05'],
      patternIds: ['UP-01'],
      tier: 'BASIC',
      businessCategory: 'Penitipan & Perawatan Hewan (Pet Hotel)',
      contextualPainPoints: ['Pencatatan riwayat pakan dan obat anabul berantakan'],
      contextualRoles: ['Owner Pet Hotel', 'Pet Caretaker', 'Pemilik Hewan']
    },
    storyline: {
      narasi: 'Sistem penitipan kucing dan anjing (Pet Hotel) di mana pemilik menitipkan anabul kesayangan, petugas merawat pemberian pakan dan obat, serta dokter hewan memeriksa kesehatan berkala.',
      asumsiMasalah: 'Riwayat alergi makanan dan jadwal minum obat anabul sering tertukar antar kandang',
      asumsiAktor: ['Owner Pet Hotel', 'Pet Caretaker', 'Pemilik Hewan'],
      asumsiAlurUtama: 'Pemilik hewan check-in anabul & serah form alergi -> Caretaker tempatkan di kandang steril & beri pakan berkala -> Dokter cek kesehatan harian -> Pemilik jemput anabul & bayar',
      statusKonfirmasi: 'disetujui'
    },
    roles: {
      selected: ['Owner Pet Hotel', 'Pet Caretaker', 'Pemilik Hewan'],
      wajib: ['Owner Pet Hotel', 'Pet Caretaker'],
      tambahan: ['Pemilik Hewan']
    },
    flow: {
      alurInti: [
        { step: 1, pelaku: 'Pemilik Hewan', aksi: 'Mengisi formulir titip hewan, menyertakan buku vaksin, dan menyerahkan anabul di meja resepsionis' },
        { step: 2, pelaku: 'Pet Caretaker', aksi: 'Melakukan penimbangan berat badan, pemeriksaan kutu/jamur, dan menempatkan anabul ke kamar/kandang steril' },
        { step: 3, pelaku: 'Pet Caretaker', aksi: 'Memberikan pakan khusus sesuai porsi, membersihkan pasir litter box, dan mencatat jurnal aktivitas anabul' },
        { step: 4, pelaku: 'Owner Pet Hotel', aksi: 'Memantau okupansi kamar inap anabul dan merekapitulasi laporan pendapatan harian' }
      ],
      alurPendukung: [
        {
          nama: 'Penanganan Hewan Sakit, Karantina & Konsultasi Dokter Hewan',
          steps: [
            { pelaku: 'Pet Caretaker', aksi: 'Memindahkan anabul bergejala flu atau muntah ke ruang isolasi khusus dan melapor' },
            { pelaku: 'Owner Pet Hotel', aksi: 'Menghubungi dokter hewan rekanan dan menyetujui tindakan pengobatan darurat' }
          ]
        }
      ],
      fiturPendukung: [
        'Katalog Kamar Inap & Jadwal Sterilisasi Kandang',
        'Jurnal Harian Anabul (Pakan, Buang Air, Mood Foto)',
        'Notifikasi WhatsApp Update Kondisi Anabul ke Pemilik'
      ]
    },
    painPoints: { selected: [] },
    features: { selected: [] }
  };

  const rentalTermsRegex = /\b(armada|rental|sewa|mobil|motor|odometer|stnk|lepas\s*kunci|bodi\s*kendaraan)\b/i;
  let petHotelPassed = 0;
  let petHotelLeaked = 0;
  const numCycles = 8;

  for (let i = 1; i <= numCycles; i++) {
    const t0 = Date.now();
    // Gunakan provider aktif (OpenAI / Gemini fallback)
    const result = await generateRbacMatrixWithAI(
      petHotelSession,
      process.env.OPENAI_API_KEY ? 'openai' : 'gemini',
      undefined,
      process.env.OPENAI_API_KEY ? 'gpt-4o-mini' : undefined
    );
    const dur = Date.now() - t0;

    const allText = result.modul.map(m => `${m.nama} ${m.deskripsiFungsional || ''} ${m.izinPerRole.map(ip => `${ip.role}: ${ip.level}`).join(' ')}`).join(' ');
    const hasRentalLeak = rentalTermsRegex.test(allText);

    if (hasRentalLeak) {
      console.error(`  ❌ Siklus ${i}: Ditemukan kebocoran kata kunci rental! (${dur}ms)`);
      petHotelLeaked++;
    } else {
      console.log(`  ✅ Siklus ${i}: Bersih 100% tanpa istilah rental (${dur}ms, ${result.modul.length} modul)`);
      petHotelPassed++;
    }
  }

  console.log(`\n  Pet Hotel Hasil: ${petHotelPassed}/${numCycles} Lolos Bersih (Kebocoran: ${petHotelLeaked})\n`);

  // -------------------------------------------------------------------------
  // TEST 2: REGRESI DOMAIN RENTAL MOBIL (KUALITAS TETAP TINGGI & PRESISI)
  // -------------------------------------------------------------------------
  console.log('--- TEST 2: Regresi Domain Rental Mobil (Kualitas RBAC Tetap Presisi & Terpisah) ---');

  const rentalSession: MockupSessionState = {
    step: 'RBAC',
    match: {
      templateId: 'MT-03',
      overlayIds: ['IND-03'],
      patternIds: ['UP-02', 'UP-06'],
      tier: 'BASIC',
      businessCategory: 'Rental Mobil & Sewa Kendaraan',
      contextualPainPoints: ['Jadwal unit bentrok dan denda telat tidak tercatat'],
      contextualRoles: ['Pemilik Rental', 'Petugas Rental', 'Penyewa']
    },
    storyline: {
      narasi: 'Sistem rental mobil lepas kunci dan dengan sopir, di mana penyewa melakukan pemesanan dan verifikasi jaminan, petugas rental melakukan cek fisik kendaraan dan serah terima kunci, serta pemilik memantau status armada.',
      asumsiMasalah: 'Bentrok unit dan penghitungan denda terlambat manual rawan salah',
      asumsiAktor: ['Pemilik Rental', 'Petugas Rental', 'Penyewa'],
      asumsiAlurUtama: 'Penyewa booking armada -> Petugas verifikasi & serah kunci -> Penyewa kembalikan mobil -> Petugas cek fisik & hitung denda',
      statusKonfirmasi: 'disetujui'
    },
    roles: {
      selected: ['Pemilik Rental', 'Petugas Rental', 'Penyewa'],
      wajib: ['Pemilik Rental', 'Petugas Rental'],
      tambahan: ['Penyewa']
    },
    flow: {
      alurInti: [
        { step: 1, pelaku: 'Penyewa', aksi: 'Memilih mobil, durasi sewa, dan upload foto identitas KTP/SIM di form booking' },
        { step: 2, pelaku: 'Petugas Rental', aksi: 'Memverifikasi jaminan, memeriksa bodi kendaraan bersama penyewa, dan serah terima kunci' },
        { step: 3, pelaku: 'Petugas Rental', aksi: 'Menerima pengembalian kendaraan, mengecek kondisi bodi, mencatat kilometer odometer, dan kalkulasi denda jika telat' },
        { step: 4, pelaku: 'Pemilik Rental', aksi: 'Memantau ketersediaan armada, status mobil disewa, dan rekap pendapatan rental harian' }
      ],
      alurPendukung: [
        {
          nama: 'Jadwal Servis Berkala & Perawatan Armada',
          steps: [
            { pelaku: 'Petugas Rental', aksi: 'Mencatat jadwal ganti oli dan mengirim unit ke bengkel rekanan' },
            { pelaku: 'Pemilik Rental', aksi: 'Menyetujui nota biaya servis armada mobil' }
          ]
        }
      ],
      fiturPendukung: [
        'Katalog Armada & Kalender Ketersediaan Unit',
        'Checklist Digital Inspeksi Bodi Kendaraan',
        'Kalkulator Denda Keterlambatan & Selisih BBM'
      ]
    },
    painPoints: { selected: [] },
    features: { selected: [] }
  };

  const tRental0 = Date.now();
  const rentalResult = await generateRbacMatrixWithAI(
    rentalSession,
    process.env.OPENAI_API_KEY ? 'openai' : 'gemini',
    undefined,
    process.env.OPENAI_API_KEY ? 'gpt-4o-mini' : undefined
  );
  const durRental = Date.now() - tRental0;

  console.log(`  Rental Mobil selesai dalam ${durRental}ms (${rentalResult.modul.length} modul):`);
  for (const m of rentalResult.modul) {
    console.log(`    - Modul: "${m.nama}"`);
    for (const ip of m.izinPerRole) {
      console.log(`        * ${ip.role}: ${ip.level}`);
    }
  }

  // Verifikasi Separation of Duties di Rental Mobil
  const penyewaHasRestricted = rentalResult.modul.some(m => {
    const isInternal = /inspeksi|verifikasi|servis|pendapatan|omzet|rekap/i.test(m.nama);
    const penyewaPerm = m.izinPerRole.find(ip => ip.role.toLowerCase().includes('penyewa'))?.level || '-';
    return isInternal && (penyewaPerm === '-' || /tidak\s*memiliki\s*akses/i.test(penyewaPerm));
  });

  if (penyewaHasRestricted) {
    console.log('  ✅ PASS: Separation of Duties di domain Rental tetap terjaga (Penyewa dibatasi dari modul internal)!');
  } else {
    console.warn('  ⚠️ PERINGATAN: Periksa izin peran Penyewa pada modul internal.');
  }

  // -------------------------------------------------------------------------
  // TEST 3: VERIFIKASI PROMPT LAIN (ROLE ANALYSIS & SUPPORTING FLOWS)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 3: Verifikasi Prompt Lain (Role Analysis & Supporting Flows Bebas Anchor) ---');
  
  const roleAnalysis = await analyzeRolesWithAI({
    rolesToAnalyze: [
      { name: 'Koordinator Kandang', note: 'Petugas yang membawahi para caretaker kandang' },
      { name: 'Dokter Hewan Jaga', note: 'Pemeriksa kesehatan hewan' }
    ],
    session: petHotelSession,
    existingRoles: [
      { label: 'Pet Caretaker', description: 'Merawat anabul' }
    ],
    provider: process.env.OPENAI_API_KEY ? 'openai' : 'gemini',
    userModel: process.env.OPENAI_API_KEY ? 'gpt-4o-mini' : undefined
  });

  console.log('  Role Analysis Result:');
  for (const [rName, rData] of Object.entries(roleAnalysis)) {
    console.log(`    - ${rName}: "${rData.narasi}" (isSimilar: ${rData.isSimilar})`);
  }

  const allRoleAnalysisText = JSON.stringify(roleAnalysis);
  const leakInRoleAnalysis = rentalTermsRegex.test(allRoleAnalysisText);
  if (!leakInRoleAnalysis) {
    console.log('  ✅ PASS: analyzeRolesWithAI bersih dari kebocoran rental.');
  } else {
    console.error('  ❌ FAIL: analyzeRolesWithAI memuat istilah rental!');
  }

  console.log('\n=== SEMUA PENGUJIAN SELESAI ===');
}

runAnchorRemovalTests().catch(console.error);
