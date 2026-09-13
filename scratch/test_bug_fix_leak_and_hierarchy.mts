import fs from 'fs';
if (fs.existsSync('.env.local')) {
  process.loadEnvFile('.env.local');
}

import { analyzeCustomRoleWithAI } from '../src/app/api/guided/route';
import {
  getRoleNarrativeAndResponsibilities,
  canonicalRoleKey
} from '../src/lib/templates/processes/guided';
import type { MockupSessionState } from '../src/lib/templates';

async function runTests() {
  console.log('================================================================');
  console.log('TEST 1: Bug 1 - Role "Petugas Pembeli" di Domain Barang Rosok');
  console.log('================================================================');

  const storylineRosok: MockupSessionState['storyline'] = {
    narasi: 'Petugas armada mengendarai motor roda tiga atau mobil pikap keliling ke rumah-rumah warga untuk menjemput dan menimbang barang rosok seperti kardus, besi, dan botol bekas.',
    asumsiMasalah: 'penimbangan dan pembayaran manual',
    asumsiAktor: ['Super Admin', 'Pemilik Armada', 'Petugas Pembeli'],
    asumsiAlurUtama: 'Penjemputan rosok dengan mobil pikap dan motor roda tiga',
    statusKonfirmasi: 'disetujui',
    revisiCount: 0
  };

  const keyPetugasPembeli = canonicalRoleKey('Petugas Pembeli');
  console.log(`- canonicalRoleKey("Petugas Pembeli"): "${keyPetugasPembeli}" (Bukan "customer"!)`);

  const rolePembeliDetails = getRoleNarrativeAndResponsibilities(
    'Petugas Pembeli',
    'Penerimaan Barang Bekas',
    storylineRosok
  );

  console.log('- Narasi "Petugas Pembeli":', rolePembeliDetails.narasi);
  console.log('- Tanggung Jawab:', rolePembeliDetails.tanggungJawab);

  const containsCarWash =
    /cuci|pencucian|pembersihan interior|eksterior hingga bersih/i.test(rolePembeliDetails.narasi) ||
    rolePembeliDetails.tanggungJawab.some((t) => /cuci|pencucian|pembersihan/i.test(t));

  if (!containsCarWash && keyPetugasPembeli !== 'customer') {
    console.log('✅ TEST 1 LULUS: Tidak ada kebocoran konten cuci mobil! Petugas Pembeli terdefinisi sebagai staf lapangan rosok.');
  } else {
    console.error('❌ TEST 1 GAGAL: Masih bocor konten cuci mobil atau masih diklasifikasikan sebagai customer!');
  }

  console.log('\n================================================================');
  console.log('TEST 2: Bug 2 - Pengepul dengan Catatan Hierarki Rantai Pasok');
  console.log('================================================================');

  const dummySessionRosok: MockupSessionState = {
    step: 'ROLE',
    match: {
      templateId: 'MT-03',
      overlayIds: ['IND-04'],
      patternIds: ['UP-01', 'UP-02'],
      tier: 'STANDARD',
      businessCategory: 'Penerimaan Barang Bekas',
      contextualPainPoints: ['pencatatan manual timbangan barang'],
      contextualRoles: ['Super Admin', 'Pemilik Armada']
    },
    storyline: storylineRosok,
    roles: {
      selected: ['Super Admin', 'Pemilik Armada'],
      wajib: ['Super Admin'],
      tambahan: ['Pemilik Armada']
    },
    flow: { selectedId: '' },
    features: { selected: [] },
    dbSchema: { tables: [] },
    screenSimulation: { flows: [] }
  };

  const existingRolesRosok = [
    {
      id: 'Super Admin',
      label: 'Super Admin',
      description: 'Pemilik usaha penampungan rosok.',
      responsibilities: ['Memantau transaksi dan laporan keuangan']
    },
    {
      id: 'Pemilik Armada',
      label: 'Pemilik Armada',
      description: 'Petugas lapangan yang mengetuk pintu rumah warga langsung menggunakan armada untuk membeli rosok.',
      responsibilities: ['Mendatangi rumah warga', 'Menimbang rosok di tempat', 'Membayar tunai ke warga']
    }
  ];

  const noteHierarki = 'orang yang menerima hasil pembelian dari para pemilik armada yang telah membeli beberapa barang rosok dari warga';

  const resHierarki = await analyzeCustomRoleWithAI({
    roleName: 'Pengepul',
    roleNote: noteHierarki,
    existingRoles: existingRolesRosok,
    session: dummySessionRosok
  });

  console.log('- Result Analisis Hierarki:');
  console.log(`  isSimilar: ${resHierarki.isSimilar}`);
  console.log(`  similarRoleName: ${resHierarki.similarRoleName}`);
  console.log(`  explanation: ${resHierarki.similarityExplanation}`);
  console.log(`  narasi: ${resHierarki.narasi}`);
  console.log(`  tanggungJawab:`, resHierarki.tanggungJawab);

  if (!resHierarki.isSimilar) {
    console.log('✅ TEST 2 LULUS: Relasi hierarki dipahami dengan benar! Pengepul TIDAK dianggap mirip dengan Pemilik Armada.');
  } else {
    console.error('❌ TEST 2 GAGAL: Pengepul masih salah dianggap mirip dengan Pemilik Armada!');
  }

  console.log('\n================================================================');
  console.log('TEST 3: Kemiripan Valid Tanpa Catatan Hierarki (Kasir Pembayaran vs Kasir)');
  console.log('================================================================');

  const existingRolesKafe = [
    {
      id: 'Super Admin',
      label: 'Super Admin',
      description: 'Pemilik kedai kopi.',
      responsibilities: ['Memantau operasional']
    },
    {
      id: 'Kasir',
      label: 'Kasir',
      description: 'Melayani pembayaran pesanan pelanggan di meja kasir.',
      responsibilities: ['Mencatat pesanan', 'Menerima pembayaran tunai/qris', 'Mencetak struk']
    }
  ];

  const resSimilarValid = await analyzeCustomRoleWithAI({
    roleName: 'Kasir Pembayaran',
    roleNote: undefined,
    existingRoles: existingRolesKafe,
    session: {
      step: 'ROLE',
      match: {
        templateId: 'MT-01',
        overlayIds: ['IND-01'],
        patternIds: ['UP-01'],
        tier: 'BASIC',
        businessCategory: 'kedai kopi dan kafe',
        contextualPainPoints: [],
        contextualRoles: ['Super Admin', 'Kasir']
      },
      roles: { selected: ['Super Admin', 'Kasir'], wajib: ['Super Admin'], tambahan: ['Kasir'] },
      flow: { selectedId: '' },
      features: { selected: [] },
      dbSchema: { tables: [] },
      screenSimulation: { flows: [] }
    }
  });

  console.log('- Result Kemiripan Valid:');
  console.log(`  isSimilar: ${resSimilarValid.isSimilar}`);
  console.log(`  similarRoleName: ${resSimilarValid.similarRoleName}`);

  if (resSimilarValid.isSimilar && resSimilarValid.similarRoleName?.toLowerCase().includes('kasir')) {
    console.log('✅ TEST 3 LULUS: Kemiripan valid (posisi setara tanpa hierarki) tetap terdeteksi normal!');
  } else {
    console.log('⚠️ TEST 3 Info: Result kemiripan valid:', resSimilarValid);
  }

  console.log('\n================================================================');
  console.log('TEST 4: Domain Cuci Mobil Asli (Anti-Regresi)');
  console.log('================================================================');

  const storylineCuciMobil: MockupSessionState['storyline'] = {
    narasi: 'Pelanggan datang membawa mobil atau motor ke tempat cuci mobil salju untuk mendapatkan layanan cuci bodi dan vakum interior.',
    asumsiMasalah: 'antrean cuci tidak tercatat',
    asumsiAktor: ['Super Admin', 'Kasir', 'Petugas Cuci', 'Pelanggan'],
    asumsiAlurUtama: 'Antrean dan pencucian kendaraan',
    statusKonfirmasi: 'disetujui',
    revisiCount: 0
  };

  const roleCuciPelanggan = getRoleNarrativeAndResponsibilities('Pelanggan', 'Jasa Cuci Mobil Salju', storylineCuciMobil);
  const rolePetugasCuci = getRoleNarrativeAndResponsibilities('Petugas Cuci', 'Jasa Cuci Mobil Salju', storylineCuciMobil);

  console.log('- Narasi Pelanggan Cuci Mobil:', roleCuciPelanggan.narasi);
  console.log('- Narasi Petugas Cuci:', rolePetugasCuci.narasi);

  const cuciValid =
    /cuci|pencucian|layanan pencucian/i.test(roleCuciPelanggan.narasi) &&
    /pembersihan|sabun salju|cuci/i.test(rolePetugasCuci.narasi);

  if (cuciValid) {
    console.log('✅ TEST 4 LULUS: Domain cuci mobil asli tetap berfungsi sempurna tanpa regresi!');
  } else {
    console.error('❌ TEST 4 GAGAL: Cuci mobil mengalami regresi!');
  }

  console.log('\n================================================================');
  console.log('TEST 5: Domain Lain Menyebut Kendaraan tapi BUKAN Cuci Mobil (Generalisasi)');
  console.log('================================================================');

  // A. Rental Mobil Lepas Kunci
  const storylineRental: MockupSessionState['storyline'] = {
    narasi: 'Penyewa datang memilih mobil avanza lepas kunci, menyerahkan KTP dan deposit jaminan, lalu memeriksa fisik kendaraan dan kilometer sebelum serah-terima kunci.',
    asumsiMasalah: 'pencatatan deposit dan kilometer armada',
    asumsiAktor: ['Super Admin', 'Petugas Rental', 'Penyewa'],
    asumsiAlurUtama: 'Sewa mobil dan serah-terima kunci kendaraan',
    statusKonfirmasi: 'disetujui',
    revisiCount: 0
  };

  const rolePenyewaRental = getRoleNarrativeAndResponsibilities('Penyewa', 'Rental Mobil Lepas Kunci', storylineRental);
  console.log('- Narasi Rental Mobil (Penyewa):', rolePenyewaRental.narasi);

  const rentalNoCuciLeak = !/cuci|pencucian|salju/i.test(rolePenyewaRental.narasi) && /sewa|rental|armada/i.test(rolePenyewaRental.narasi);

  // B. Ekspedisi Pengiriman Barang
  const storylineLogistik: MockupSessionState['storyline'] = {
    narasi: 'Pengirim paket datang menyerahkan barang ke loket, lalu kurir mengendarai mobil box atau motor untuk mengantar barang ke alamat penerima.',
    asumsiMasalah: 'pelacakan resi pengiriman',
    asumsiAktor: ['Super Admin', 'Kurir Pengantar', 'Pengirim'],
    asumsiAlurUtama: 'Pengiriman barang menggunakan mobil box dan motor',
    statusKonfirmasi: 'disetujui',
    revisiCount: 0
  };

  const rolePengirimEkspedisi = getRoleNarrativeAndResponsibilities('Pengirim', 'Jasa Ekspedisi Logistik', storylineLogistik);
  console.log('- Narasi Ekspedisi Logistik (Pengirim):', rolePengirimEkspedisi.narasi);

  const ekspedisiNoCuciLeak = !/cuci|pencucian|salju/i.test(rolePengirimEkspedisi.narasi);

  if (rentalNoCuciLeak && ekspedisiNoCuciLeak) {
    console.log('✅ TEST 5 LULUS: Generalisasi terbukti! Bisnis rental dan ekspedisi yang menyebut mobil/motor tidak bocor ke template cuci mobil.');
  } else {
    console.error('❌ TEST 5 GAGAL: Masih ada kebocoran di rental atau ekspedisi!', { rentalNoCuciLeak, ekspedisiNoCuciLeak });
  }
}

runTests().catch(console.error);
