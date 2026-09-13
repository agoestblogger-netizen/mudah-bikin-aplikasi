import { getDomainFlowDetails } from '../src/lib/templates/processes/guided';
import { MockupSessionState } from '../src/lib/templates/types';

function runTest() {
  console.log('=== START TEST: Barbershop, Regresi, & Novel Domains ===\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  // 1. TEST BARBERSHOP DOMAIN
  console.log('--- 1. Testing Domain Barbershop ---');
  const barbershopSession: MockupSessionState = {
    domain: 'aplikasi barbershop',
    rawPrompt: 'Saya butuh aplikasi barbershop untuk mencatat antrean potong rambut dan kasir',
    roles: {
      selected: ['Super Admin', 'Barber', 'Pelanggan'],
      wajib: ['Super Admin', 'Barber']
    },
    storyline: {
      narasi: 'Pelanggan datang ke barbershop untuk potong rambut dan cuci muka, barber melayani pangkas sesuai permintaan.',
      asumsiAktor: ['Pelanggan', 'Barber', 'Super Admin'],
      asumsiAlurUtama: 'Pelanggan memilih kapster dan jenis cukur, barber memotong rambut, kasir menerima pembayaran.'
    },
    match: {
      businessCategory: 'Barbershop'
    } as any
  };

  const barberFlows = getDomainFlowDetails(barbershopSession);
  console.log('Barbershop Supporting Flows:');
  barberFlows.alurPendukung.forEach((f) => {
    console.log(`  * ${f.nama}`);
    f.steps.forEach((s) => console.log(`    - (${s.pelaku}) ${s.aksi}`));
  });
  console.log('Barbershop Supporting Features:');
  barberFlows.fiturPendukung.forEach((feat) => console.log(`  * [${feat.id}] ${feat.label}`));

  // Verification checks
  const barberJson = JSON.stringify(barberFlows);
  assert(!barberJson.includes('Menyampaikan catatan atau keluhan jika hasil layanan membutuhkan penyesuaian'), 'Bebas dari kalimat keluhan generik lama');
  assert(!barberJson.includes('Memeriksa kendala yang dilaporkan dan menindaklanjuti perbaikan hingga tuntas'), 'Bebas dari kalimat perbaikan kendala generik lama');
  assert(barberFlows.alurPendukung.some((f) => f.id === 'alur_garansi_potong'), 'Memiliki alur klaim ulang potong rambut');
  assert(barberFlows.alurPendukung.some((f) => f.id === 'alur_restock_alat_cukur'), 'Memiliki alur restock alat cukur & pomade');
  assert(barberFlows.fiturPendukung.some((f) => f.id === 'feat_antrean_barber'), 'Memiliki fitur antrean pangkas barber');
  assert(barberFlows.fiturPendukung.some((f) => f.id === 'feat_katalog_gaya'), 'Memiliki fitur katalog gaya rambut');

  // 2. TEST REGRESI DOMAINS (Rental Mobil, Cuci Mobil, Kafe)
  console.log('\n--- 2. Testing Regresi: Rental Mobil ---');
  const rentalSession: MockupSessionState = {
    domain: 'rental mobil lepas kunci',
    roles: { selected: ['Super Admin', 'Staf Operasional', 'Penyewa'], wajib: ['Super Admin', 'Staf Operasional'] },
    storyline: { narasi: 'Sewa mobil lepas kunci harian', asumsiAktor: ['Penyewa', 'Staf Operasional'], asumsiAlurUtama: 'Sewa mobil dan serah terima unit' },
    match: { businessCategory: 'Rental Mobil' } as any
  };
  const rentalFlows = getDomainFlowDetails(rentalSession);
  assert(rentalFlows.alurPendukung.some((f) => f.id === 'alur_denda_armada'), 'Rental memiliki alur denda BBM / lecet unit');
  assert(rentalFlows.fiturPendukung.some((f) => f.id === 'feat_km_kondisi'), 'Rental memiliki fitur checklist inspeksi');

  console.log('\n--- Testing Regresi: Cuci Mobil ---');
  const cuciSession: MockupSessionState = {
    domain: 'cuci mobil dan detailing',
    roles: { selected: ['Super Admin', 'Operator Cuci', 'Pelanggan'], wajib: ['Super Admin', 'Operator Cuci'] },
    storyline: { narasi: 'Jasa cuci salju kendaraan mobil dan motor', asumsiAktor: ['Pelanggan', 'Operator Cuci'], asumsiAlurUtama: 'Kendaraan masuk hidrolik dan dicuci' },
    match: { businessCategory: 'Cuci Mobil' } as any
  };
  const cuciFlows = getDomainFlowDetails(cuciSession);
  assert(cuciFlows.alurPendukung.some((f) => f.id === 'alur_garansi_cuci'), 'Cuci mobil memiliki alur inspeksi cuci ulang');
  assert(cuciFlows.fiturPendukung.some((f) => f.id === 'feat_antrean_cuci'), 'Cuci mobil memiliki fitur antrean bay cuci');

  console.log('\n--- Testing Regresi: Kafe ---');
  const kafeSession: MockupSessionState = {
    domain: 'kafe & coffee shop',
    roles: { selected: ['Super Admin', 'Barista', 'Pelanggan'], wajib: ['Super Admin', 'Barista'] },
    storyline: { narasi: 'Pemesanan kopi dan pastry di kedai kopi', asumsiAktor: ['Pelanggan', 'Barista'], asumsiAlurUtama: 'Pesan kopi dan bayar di kasir' },
    match: { businessCategory: 'Kafe' } as any
  };
  const kafeFlows = getDomainFlowDetails(kafeSession);
  assert(kafeFlows.alurPendukung.some((f) => f.id === 'alur_restock_kopi'), 'Kafe memiliki alur restock biji kopi');
  assert(kafeFlows.fiturPendukung.some((f) => f.id === 'feat_tiket_dapur'), 'Kafe memiliki fitur tiket dapur/barista');

  // 3. TEST NOVEL DOMAINS (Belum pernah diatur spesifik regex)
  console.log('\n--- 3. Testing Novel Domain A: Studio Rekaman Audio ---');
  const studioSession: MockupSessionState = {
    domain: 'rental studio rekaman musik dan mixing audio',
    roles: { selected: ['Super Admin', 'Sound Engineer', 'Musisi'], wajib: ['Super Admin', 'Sound Engineer'] },
    storyline: {
      narasi: 'Penyewaan studio rekaman audio per shift jam untuk latihan band dan rekaman vokal profesional',
      asumsiAktor: ['Musisi', 'Sound Engineer', 'Super Admin'],
      asumsiAlurUtama: 'Musisi membooking ruang rekaman, sound engineer mengatur mixing konsol dan rekaman audio.'
    },
    match: { businessCategory: 'Studio Rekaman' } as any
  };
  const studioFlows = getDomainFlowDetails(studioSession);
  console.log('Studio Rekaman Supporting Flows:');
  studioFlows.alurPendukung.forEach((f) => {
    console.log(`  * ${f.nama}`);
    f.steps.forEach((s) => console.log(`    - (${s.pelaku}) ${s.aksi}`));
  });
  console.log('Studio Rekaman Supporting Features:');
  studioFlows.fiturPendukung.forEach((feat) => console.log(`  * [${feat.id}] ${feat.label}`));

  const studioJson = JSON.stringify(studioFlows);
  assert(!studioJson.includes('Menyampaikan catatan atau keluhan jika hasil layanan membutuhkan penyesuaian'), 'Novel A bebas dari kalimat generik lama');
  assert(studioFlows.alurPendukung.length >= 2, 'Novel A menghasilkan minimal 2 alur pendukung');
  assert(studioFlows.fiturPendukung.length >= 5, 'Novel A menghasilkan 5 fitur pendukung');
  assert(studioJson.includes('Studio Rekaman') || studioJson.includes('studio rekaman'), 'Novel A ter-grounding dengan label domainnya');

  console.log('\n--- Testing Novel Domain B: Jasa Pembuatan Kolam Renang ---');
  const kolamSession: MockupSessionState = {
    domain: 'kontraktor pembuatan dan instalasi kolam renang villa',
    roles: { selected: ['Super Admin', 'Mandor Lapangan', 'Klien Proyek'], wajib: ['Super Admin', 'Mandor Lapangan'] },
    storyline: {
      narasi: 'Pengerjaan instalasi plumbing pipa sirkulasi dan pengecoran kolam renang pribadi',
      asumsiAktor: ['Klien Proyek', 'Mandor Lapangan', 'Super Admin'],
      asumsiAlurUtama: 'Konsultasi desain kolam, survei lahan, pengerjaan konstruksi, dan uji kebocoran air.'
    },
    match: { businessCategory: 'Konstruksi Kolam Renang' } as any
  };
  const kolamFlows = getDomainFlowDetails(kolamSession);
  console.log('Kolam Renang Supporting Flows:');
  kolamFlows.alurPendukung.forEach((f) => {
    console.log(`  * ${f.nama}`);
    f.steps.forEach((s) => console.log(`    - (${s.pelaku}) ${s.aksi}`));
  });
  const kolamJson = JSON.stringify(kolamFlows);
  assert(!kolamJson.includes('Menyampaikan catatan atau keluhan jika hasil layanan membutuhkan penyesuaian'), 'Novel B bebas dari kalimat generik lama');
  assert(kolamFlows.alurPendukung.length >= 2, 'Novel B menghasilkan minimal 2 alur pendukung');
  assert(kolamJson.includes('Konstruksi Kolam Renang') || kolamJson.includes('konstruksi kolam renang'), 'Novel B ter-grounding dengan label domainnya');

  console.log(`\n=== SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTest();
