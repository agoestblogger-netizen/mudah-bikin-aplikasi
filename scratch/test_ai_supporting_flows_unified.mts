import {
  applyGuidedAnswer,
  getDomainFlowDetails
} from '../src/lib/templates/processes/guided';
import {
  type MockupSessionState,
  type SupportingFlowItem,
  type SupportingFeatureItem
} from '../src/lib/templates/types';
import { generateSupportingFlowsAndFeaturesWithAI } from '../src/app/api/guided/route';

async function runUnifiedSupportingFlowTests() {
  console.log('=== START TEST: AI Unified Supporting Flows & Features (Option 1) ===\n');

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

  // Fungsi pembantu untuk ekstraksi kerangka (skeleton) tanpa kata benda domain
  function extractSkeleton(title: string, domainKeywords: string[]): string {
    let clean = title.toLowerCase();
    domainKeywords.forEach(k => {
      clean = clean.replace(new RegExp(k.toLowerCase(), 'g'), '');
    });
    // Hapus spasi berlebih dan tanda baca
    return clean.replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // 1. TEST 5 DOMAIN KUNCI: Studio, Kolam Renang, Barbershop, Pet Hotel, Percetakan
  console.log('--- 1. Testing 5 Domain: Studio, Kolam, Barbershop, Pet Hotel, Percetakan ---');

  // A. Studio Rekaman
  const studioSession: MockupSessionState = {
    domain: 'rental studio rekaman musik dan mixing audio',
    step: 'ROLE',
    match: { templateId: 'tpl_studio', overlayIds: [], patternIds: [], tier: 'standard', businessCategory: 'Studio Rekaman' },
    roles: { selected: ['Super Admin', 'Sound Engineer', 'Musisi'], wajib: ['Super Admin', 'Sound Engineer'] },
    storyline: {
      narasi: 'Penyewaan studio rekaman audio per shift jam untuk latihan band dan rekaman vokal musisi, dipandu oleh sound engineer.',
      asumsiAktor: ['Musisi', 'Sound Engineer', 'Super Admin'],
      asumsiAlurUtama: 'Musisi memilih shift studio -> Sound engineer mengatur track instrumen dan mixer -> Musisi merekam vokal -> Kasir/Admin menerima pelunasan sewa shift studio.'
    },
    flow: {}
  };
  const resStudio = await generateSupportingFlowsAndFeaturesWithAI(studioSession);
  console.log('Studio Rekaman Supporting Flows:');
  resStudio.alurPendukung.forEach((f) => console.log(`  * ${f.nama}`));

  // B. Kolam Renang
  const kolamSession: MockupSessionState = {
    domain: 'fasilitas wahana kolam renang dan waterpark',
    step: 'ROLE',
    match: { templateId: 'tpl_kolam', overlayIds: [], patternIds: [], tier: 'standard', businessCategory: 'Kolam Renang' },
    roles: { selected: ['Super Admin', 'Petugas Kolam', 'Pengunjung Kolam'], wajib: ['Super Admin', 'Petugas Kolam'] },
    storyline: {
      narasi: 'Wahana wisata air kolam renang keluarga dengan kolam arus, seluncuran, loker sewa, dan pengujian kebersihan air berkala.',
      asumsiAktor: ['Pengunjung Kolam', 'Petugas Kolam', 'Super Admin'],
      asumsiAlurUtama: 'Pengunjung membeli tiket masuk -> Petugas memindai tiket di loket -> Pengunjung menyewa loker dan pelampung -> Pengunjung berenang.'
    },
    flow: {}
  };
  const resKolam = await generateSupportingFlowsAndFeaturesWithAI(kolamSession);
  console.log('Kolam Renang Supporting Flows:');
  resKolam.alurPendukung.forEach((f) => console.log(`  * ${f.nama}`));

  // C. Barbershop
  const barberSession: MockupSessionState = {
    domain: 'aplikasi barbershop pangkas rambut',
    step: 'ROLE',
    match: { templateId: 'tpl_barber', overlayIds: [], patternIds: [], tier: 'standard', businessCategory: 'Barbershop' },
    roles: { selected: ['Super Admin', 'Barber / Kapster', 'Pelanggan'], wajib: ['Super Admin', 'Barber / Kapster'] },
    storyline: {
      narasi: 'Pelanggan potong rambut dan cuci muka di barbershop, barber melayani pangkas sesuai model gaya rambut yang dipilih.',
      asumsiAktor: ['Pelanggan', 'Barber / Kapster', 'Super Admin'],
      asumsiAlurUtama: 'Pelanggan memilih kapster -> Barber memotong rambut dan styling pomade -> Pelanggan membayar di kasir.'
    },
    flow: {}
  };
  const resBarber = await generateSupportingFlowsAndFeaturesWithAI(barberSession);
  console.log('Barbershop Supporting Flows:');
  resBarber.alurPendukung.forEach((f) => console.log(`  * ${f.nama}`));

  // D. Pet Hotel
  const petSession: MockupSessionState = {
    domain: 'hotel penitipan kucing dan grooming bulu',
    step: 'ROLE',
    match: { templateId: 'tpl_pet', overlayIds: [], patternIds: [], tier: 'standard', businessCategory: 'Pet Hotel' },
    roles: { selected: ['Super Admin', 'Cat Caretaker', 'Pemilik Kucing'], wajib: ['Super Admin', 'Cat Caretaker'] },
    storyline: {
      narasi: 'Penitipan kucing dengan kamar AC individual, pemberian pakan khusus wetfood, dan treatment grooming kutu/jamur.',
      asumsiAktor: ['Pemilik Kucing', 'Cat Caretaker', 'Super Admin'],
      asumsiAlurUtama: 'Pemilik menitipkan kucing dan cek buku vaksin -> Caretaker menempatkan di kandang VIP -> Caretaker memberi makan dan membersihkan litter box -> Pemilik menjemput.'
    },
    flow: {}
  };
  const resPet = await generateSupportingFlowsAndFeaturesWithAI(petSession);
  console.log('Pet Hotel Supporting Flows:');
  resPet.alurPendukung.forEach((f) => console.log(`  * ${f.nama}`));

  // E. Percetakan Digital
  const cetakSession: MockupSessionState = {
    domain: 'percetakan digital banner dan sablon merchandise',
    step: 'ROLE',
    match: { templateId: 'tpl_cetak', overlayIds: [], patternIds: [], tier: 'standard', businessCategory: 'Digital Printing' },
    roles: { selected: ['Super Admin', 'Operator Mesin Cetak', 'Klien Pemesan'], wajib: ['Super Admin', 'Operator Mesin Cetak'] },
    storyline: {
      narasi: 'Layanan print outdoor banner spanduk dan sublimasi kaos merchandise dengan resolusi tinggi.',
      asumsiAktor: ['Klien Pemesan', 'Operator Mesin Cetak', 'Super Admin'],
      asumsiAlurUtama: 'Klien mengunggah file desain -> Operator memeriksa resolusi dan bleeding warna -> Mesin mencetak spanduk -> Klien melunasi dan mengambil hasil cetak.'
    },
    flow: {}
  };
  const resCetak = await generateSupportingFlowsAndFeaturesWithAI(cetakSession);
  console.log('Percetakan Supporting Flows:');
  resCetak.alurPendukung.forEach((f) => console.log(`  * ${f.nama}`));

  // UJI BEBAS DARI FRASA PAYUNG ABSTRAK GENERIK LAMA
  const allFlowTitles = [
    ...resStudio.alurPendukung.map(f => f.nama),
    ...resKolam.alurPendukung.map(f => f.nama),
    ...resBarber.alurPendukung.map(f => f.nama),
    ...resPet.alurPendukung.map(f => f.nama),
    ...resCetak.alurPendukung.map(f => f.nama)
  ];

  const hasGenericUmbrella = allFlowTitles.some(t =>
    /penanganan penyesuaian hasil & jaminan pengerjaan|pemeliharaan sarana kerja & kesiapan perlengkapan|jaminan kepuasan & penyesuaian kualitas/i.test(t)
  );
  assert(!hasGenericUmbrella, 'SEMUA 5 domain bebas dari frasa payung abstrak generik');

  // UJI KEKHASAN OBJEK/ISTILAH SPESIFIK TIAP DOMAIN
  const barberTitles = resBarber.alurPendukung.map(f => f.nama.toLowerCase()).join(' ');
  assert(
    /potong|cukur|clipper|silet|pomade|rambut/i.test(barberTitles),
    'Barbershop menyebut objek riil (potong/cukur/clipper/silet/pomade)'
  );

  const studioTitles = resStudio.alurPendukung.map(f => f.nama.toLowerCase()).join(' ');
  assert(
    /retake|audio|vokal|mixer|equalizer|mikrofon|kabel/i.test(studioTitles),
    'Studio Rekaman menyebut objek riil (retake/audio/vokal/mixer/equalizer/mikrofon/kabel)'
  );

  const kolamTitles = resKolam.alurPendukung.map(f => f.nama.toLowerCase()).join(' ');
  assert(
    /kebersihan air|endapan|kaporit|filter|pompa/i.test(kolamTitles),
    'Kolam Renang menyebut objek riil (kebersihan air/endapan/kaporit/filter/pompa)'
  );

  const petTitles = resPet.alurPendukung.map(f => f.nama.toLowerCase()).join(' ');
  assert(
    /hewan|sakit|alergi|pakan|pasir|kandang|sterilisasi/i.test(petTitles),
    'Pet Hotel menyebut objek riil (hewan/sakit/alergi/pakan/pasir/kandang)'
  );

  const cetakTitles = resCetak.alurPendukung.map(f => f.nama.toLowerCase()).join(' ');
  assert(
    /cetak|luntur|head printer|nozzle|tinta|banner/i.test(cetakTitles),
    'Percetakan menyebut objek riil (cetak/luntur/head printer/nozzle/tinta/banner)'
  );

  // UJI KERANGKA TIDAK IDENTIK (SKELETON DIVERSIFICATION)
  const skeletonStudio = extractSkeleton(resStudio.alurPendukung[0]?.nama || '', ['studio', 'rekaman', 'musik', 'audio']);
  const skeletonKolam = extractSkeleton(resKolam.alurPendukung[0]?.nama || '', ['kolam', 'renang', 'waterpark']);
  const skeletonBarber = extractSkeleton(resBarber.alurPendukung[0]?.nama || '', ['barber', 'rambut', 'pangkas', 'cukur']);
  const skeletonPet = extractSkeleton(resPet.alurPendukung[0]?.nama || '', ['pet', 'hotel', 'kucing', 'anjing', 'hewan']);
  const skeletonCetak = extractSkeleton(resCetak.alurPendukung[0]?.nama || '', ['percetakan', 'digital', 'banner', 'sablon']);

  assert(skeletonStudio !== skeletonKolam, 'Skeleton Alur 1 Studio != Kolam Renang');
  assert(skeletonStudio !== skeletonBarber, 'Skeleton Alur 1 Studio != Barbershop');
  assert(skeletonKolam !== skeletonBarber, 'Skeleton Alur 1 Kolam Renang != Barbershop');
  assert(skeletonPet !== skeletonCetak, 'Skeleton Alur 1 Pet Hotel != Percetakan');

  // 2. TEST REGRESI DOMAIN LAMA (Rental Mobil, Cuci Mobil, Kafe)
  console.log('\n--- 2. Testing Regresi Domain Lama (Rental, Cuci Mobil, Kafe) ---');

  const rentalSession: MockupSessionState = {
    domain: 'rental persewaan mobil lepas kunci',
    step: 'ROLE',
    match: { templateId: 'tpl_rental', overlayIds: [], patternIds: [], tier: 'standard', businessCategory: 'Rental Mobil' },
    roles: { selected: ['Super Admin', 'Staf Operasional', 'Penyewa Mobil'], wajib: ['Super Admin', 'Staf Operasional'] },
    storyline: {
      narasi: 'Penyewaan mobil lepas kunci dengan deposit jaminan, pengembalian unit, dan denda overtime.',
      asumsiAktor: ['Penyewa Mobil', 'Staf Operasional', 'Super Admin'],
      asumsiAlurUtama: 'Penyewa memilih armada -> Staf mengecek fisik mobil -> Penyewa membayar sewa -> Penyewa mengembalikan mobil.'
    },
    flow: {}
  };
  const resRental = await generateSupportingFlowsAndFeaturesWithAI(rentalSession);
  console.log('Rental Mobil Supporting Flows:');
  resRental.alurPendukung.forEach((f) => console.log(`  * ${f.nama}`));
  const rentalTitles = resRental.alurPendukung.map(f => f.nama.toLowerCase()).join(' ');
  assert(/denda|klaim|kerusakan armada|servis|ganti oli|ban/i.test(rentalTitles), 'Rental mobil mempertahankan istilah armada/denda/servis/oli');

  const cuciSession: MockupSessionState = {
    domain: 'cuci mobil dan salon kendaraan hidrolik',
    step: 'ROLE',
    match: { templateId: 'tpl_cuci', overlayIds: [], patternIds: [], tier: 'standard', businessCategory: 'Cuci Mobil' },
    roles: { selected: ['Super Admin', 'Staf Cuci', 'Pelanggan Cuci'], wajib: ['Super Admin', 'Staf Cuci'] },
    storyline: {
      narasi: 'Layanan pencucian bodi mobil, pembersihan kolong hidrolik, dan semprot busa snow wash.',
      asumsiAktor: ['Pelanggan Cuci', 'Staf Cuci', 'Super Admin'],
      asumsiAlurUtama: 'Pelanggan mendaftar di loket -> Staf mencuci bodi dan kolong hidrolik -> Staf mengeringkan bodi -> Pelanggan memeriksa kebersihan.'
    },
    flow: {}
  };
  const resCuci = await generateSupportingFlowsAndFeaturesWithAI(cuciSession);
  console.log('Cuci Mobil Supporting Flows:');
  resCuci.alurPendukung.forEach((f) => console.log(`  * ${f.nama}`));
  const cuciTitles = resCuci.alurPendukung.map(f => f.nama.toLowerCase()).join(' ');
  assert(/cuci ulang|kaca buram|kolong|mesin steam|kompresor|sampo/i.test(cuciTitles), 'Cuci mobil mempertahankan istilah cuci ulang/kaca/kolong/steam/sampo');

  const kafeSession: MockupSessionState = {
    domain: 'kedai kopi espresso dan kafe resto',
    step: 'ROLE',
    match: { templateId: 'tpl_kafe', overlayIds: [], patternIds: [], tier: 'standard', businessCategory: 'Kafe Resto' },
    roles: { selected: ['Super Admin', 'Barista', 'Pelanggan Kafe'], wajib: ['Super Admin', 'Barista'] },
    storyline: {
      narasi: 'Penyajian racikan kopi espresso dan makanan ringan dengan sistem pesanan meja dan pembayaran kasir.',
      asumsiAktor: ['Pelanggan Kafe', 'Barista', 'Super Admin'],
      asumsiAlurUtama: 'Pelanggan memilih menu di meja -> Barista meracik kopi -> Pelanggan menikmati hidangan -> Kasir menerima pembayaran.'
    },
    flow: {}
  };
  const resKafe = await generateSupportingFlowsAndFeaturesWithAI(kafeSession);
  console.log('Kafe Supporting Flows:');
  resKafe.alurPendukung.forEach((f) => console.log(`  * ${f.nama}`));
  const kafeTitles = resKafe.alurPendukung.map(f => f.nama.toLowerCase()).join(' ');
  assert(/pesanan salah|cita rasa|biji kopi|espresso|susu|chiller/i.test(kafeTitles), 'Kafe mempertahankan istilah pesanan salah/rasa/biji kopi/chiller');

  // 3. TEST KHUSUS SYARAT WAJIB: Regenerasi Alur Pendukung saat Role Berubah Substantif di Koperasi
  console.log('\n--- 3. Testing Mandatory Requirement: Dynamic Regeneration on Role Change (Koperasi) ---');

  const koperasiSessionInitial: MockupSessionState = {
    domain: 'koperasi simpan pinjam',
    step: 'ROLE',
    match: { templateId: 'tpl_koperasi', overlayIds: [], patternIds: [], tier: 'standard', businessCategory: 'Koperasi Simpan Pinjam' },
    roles: {
      selected: ['Super Admin', 'Kasir Operasional', 'Anggota Koperasi'],
      wajib: ['Super Admin', 'Kasir Operasional']
    },
    storyline: {
      narasi: 'Koperasi simpan pinjam melayani pengajuan pinjaman modal usaha dan setoran simpanan wajib sukarela anggota berkala.',
      asumsiAktor: ['Anggota Koperasi', 'Kasir Operasional', 'Super Admin'],
      asumsiAlurUtama: 'Anggota mengajukan pinjaman -> Kasir memeriksa buku simpanan -> Kasir mencairkan dana tunai -> Super Admin memantau arus kas.'
    },
    flow: {}
  };

  const resKoperasi1 = await generateSupportingFlowsAndFeaturesWithAI(koperasiSessionInitial);
  const sessionInAlur1: MockupSessionState = {
    ...koperasiSessionInitial,
    step: 'ALUR',
    flow: {
      alurPendukung: resKoperasi1.alurPendukung.map(ap => ({ nama: ap.nama, steps: ap.steps })),
      fiturPendukung: resKoperasi1.fiturPendukung.map(fp => fp.label)
    }
  };
  console.log('Koperasi Putaran 1 (Sebelum Role Baru):');
  sessionInAlur1.flow.alurPendukung?.forEach(ap => console.log(`  * ${ap.nama}`));

  // User balik ke ROLE dan menambah peran kustom 'Pengurus Komite Kredit'
  console.log('\nUser kembali ke step ROLE dan menambah peran baru: "Pengurus Komite Kredit"...');
  const roleSubmissionWithNewRole = applyGuidedAnswer(
    sessionInAlur1,
    'ROLE',
    ['Super Admin', 'Kasir Operasional', 'Pengurus Komite Kredit', 'Anggota Koperasi']
  );

  assert(roleSubmissionWithNewRole.flow.alurPendukung === undefined, 'Cache flow.alurPendukung lama otomatis terhapus saat role diubah');
  assert(roleSubmissionWithNewRole.flow.fiturPendukung === undefined, 'Cache flow.fiturPendukung lama otomatis terhapus saat role diubah');

  const resKoperasi2 = await generateSupportingFlowsAndFeaturesWithAI(roleSubmissionWithNewRole);
  const sessionInAlur2: MockupSessionState = {
    ...roleSubmissionWithNewRole,
    step: 'ALUR',
    flow: {
      alurPendukung: resKoperasi2.alurPendukung.map(ap => ({ nama: ap.nama, steps: ap.steps })),
      fiturPendukung: resKoperasi2.fiturPendukung.map(fp => fp.label)
    }
  };

  console.log('Koperasi Putaran 2 (Setelah Role Baru Ditambahkan):');
  sessionInAlur2.flow.alurPendukung?.forEach(ap => console.log(`  * ${ap.nama}`));

  assert(sessionInAlur2.flow.alurPendukung !== undefined && sessionInAlur2.flow.alurPendukung.length > 0, 'Alur Pendukung sukses ter-refresh!');
  assert(sessionInAlur2.flow.fiturPendukung !== undefined && sessionInAlur2.flow.fiturPendukung.length > 0, 'Fitur Pendukung sukses ter-refresh!');

  console.log(`\n=== SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runUnifiedSupportingFlowTests().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
