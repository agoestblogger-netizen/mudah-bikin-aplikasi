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

  // 1. TEST NOVEL DOMAIN A (Studio Rekaman Audio) vs NOVEL DOMAIN B (Konstruksi Kolam Renang)
  console.log('--- 1. Testing Novel Domain A vs Novel Domain B (No Template Cloning) ---');

  const studioSession: MockupSessionState = {
    domain: 'rental studio rekaman musik dan mixing audio',
    step: 'ROLE',
    match: {
      templateId: 'tpl_studio',
      overlayIds: [],
      patternIds: [],
      tier: 'standard',
      businessCategory: 'Studio Rekaman'
    },
    roles: {
      selected: ['Super Admin', 'Sound Engineer', 'Musisi'],
      wajib: ['Super Admin', 'Sound Engineer']
    },
    storyline: {
      narasi: 'Penyewaan studio rekaman audio per shift jam untuk latihan band dan rekaman vokal musisi, dipandu oleh sound engineer.',
      asumsiAktor: ['Musisi', 'Sound Engineer', 'Super Admin'],
      asumsiAlurUtama: 'Musisi memilih shift studio -> Sound engineer mengatur track instrumen dan mixer -> Musisi merekam vokal -> Kasir/Admin menerima pelunasan sewa shift studio.'
    },
    flow: {}
  };

  const startA = Date.now();
  const resStudio = await generateSupportingFlowsAndFeaturesWithAI(studioSession);
  const latencyA = Date.now() - startA;
  console.log(`Latency Novel Domain A (Studio): ${latencyA}ms`);
  console.log('Studio Rekaman Supporting Flows:');
  resStudio.alurPendukung.forEach((f) => console.log(`  * ${f.nama}`));

  const kolamSession: MockupSessionState = {
    domain: 'kontraktor pembuatan dan instalasi kolam renang villa',
    step: 'ROLE',
    match: {
      templateId: 'tpl_kolam',
      overlayIds: [],
      patternIds: [],
      tier: 'standard',
      businessCategory: 'Konstruksi Kolam Renang'
    },
    roles: {
      selected: ['Super Admin', 'Mandor Lapangan', 'Klien Proyek'],
      wajib: ['Super Admin', 'Mandor Lapangan']
    },
    storyline: {
      narasi: 'Pengerjaan penggalian lahan, instalasi pipa sirkulasi, dan pengecoran keramik kolam renang pribadi untuk klien villa.',
      asumsiAktor: ['Klien Proyek', 'Mandor Lapangan', 'Super Admin'],
      asumsiAlurUtama: 'Klien survei desain -> Mandor mengukur kontur tanah dan pipa sirkulasi -> Tukang mengecor dinding kolam -> Klien menguji kejernihan dan sirkulasi air.'
    },
    flow: {}
  };

  const startB = Date.now();
  const resKolam = await generateSupportingFlowsAndFeaturesWithAI(kolamSession);
  const latencyB = Date.now() - startB;
  console.log(`Latency Novel Domain B (Kolam): ${latencyB}ms`);
  console.log('Kolam Renang Supporting Flows:');
  resKolam.alurPendukung.forEach((f) => console.log(`  * ${f.nama}`));

  // Check differentiation
  const studioText = JSON.stringify(resStudio).toLowerCase();
  const kolamText = JSON.stringify(resKolam).toLowerCase();

  assert(!studioText.includes('jaminan kepuasan & penyesuaian kualitas layanan'), 'Studio bebas dari kalimat template statis lama');
  assert(!kolamText.includes('jaminan kepuasan & penyesuaian kualitas layanan'), 'Kolam bebas dari kalimat template statis lama');
  assert(resStudio.alurPendukung[0]?.nama !== resKolam.alurPendukung[0]?.nama, 'Struktur nama alur Studio dan Kolam TIDAK identik');
  assert(resStudio.fiturPendukung.length >= 3, 'Studio menghasilkan minimal 3 fitur pendukung');
  assert(resKolam.fiturPendukung.length >= 3, 'Kolam menghasilkan minimal 3 fitur pendukung');

  // 2. TEST REGRESI DOMAIN LAMA (Rental, Cuci, Kafe, Barbershop)
  console.log('\n--- 2. Testing Regresi Domain Lama ---');

  const barberSession: MockupSessionState = {
    domain: 'aplikasi barbershop pangkas rambut',
    step: 'ROLE',
    match: { templateId: 'tpl_barber', overlayIds: [], patternIds: [], tier: 'standard', businessCategory: 'Barbershop' },
    roles: { selected: ['Super Admin', 'Barber / Kapster', 'Pelanggan'], wajib: ['Super Admin', 'Barber / Kapster'] },
    storyline: {
      narasi: 'Pelanggan potong rambut dan cuci muka di barbershop, barber melayani pangkas sesuai gaya rambut yang dipilih.',
      asumsiAktor: ['Pelanggan', 'Barber / Kapster', 'Super Admin'],
      asumsiAlurUtama: 'Pelanggan memilih kapster -> Barber memotong rambut dan styling pomade -> Pelanggan membayar di kasir.'
    },
    flow: {}
  };
  const resBarber = await generateSupportingFlowsAndFeaturesWithAI(barberSession);
  console.log('Barbershop Supporting Flows:');
  resBarber.alurPendukung.forEach((f) => console.log(`  * ${f.nama}`));
  assert(resBarber.alurPendukung.length >= 1, 'Barbershop menghasilkan alur pendukung');
  assert(resBarber.fiturPendukung.length >= 3, 'Barbershop menghasilkan fitur pendukung');

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

  // Putaran 1: Transisi ROLE -> ALUR pertama kali
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

  // Putaran 2: User balik ke ROLE dan menambah peran kustom 'Pengurus Koperasi' (analis komite kredit)
  console.log('\nUser kembali ke step ROLE dan menambah peran baru: "Pengurus Komite Kredit"...');
  const roleSubmissionWithNewRole = applyGuidedAnswer(
    sessionInAlur1,
    'ROLE',
    ['Super Admin', 'Kasir Operasional', 'Pengurus Komite Kredit', 'Anggota Koperasi']
  );

  // Verifikasi cache lama terhapus oleh applyGuidedAnswer
  assert(roleSubmissionWithNewRole.flow.alurPendukung === undefined, 'Cache flow.alurPendukung lama otomatis terhapus saat role diubah');
  assert(roleSubmissionWithNewRole.flow.fiturPendukung === undefined, 'Cache flow.fiturPendukung lama otomatis terhapus saat role diubah');

  // Putaran 3: Masuk kembali ke ALUR dengan peran terbaru
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
  const jsonKoperasi2 = JSON.stringify(sessionInAlur2.flow);
  console.log('Contoh aktor pada steps Alur Pendukung baru:', JSON.stringify(resKoperasi2.alurPendukung.map(ap => ap.steps)));

  assert(sessionInAlur2.flow.alurPendukung !== undefined && sessionInAlur2.flow.alurPendukung.length > 0, 'Alur Pendukung sukses ter-refresh!');
  assert(sessionInAlur2.flow.fiturPendukung !== undefined && sessionInAlur2.flow.fiturPendukung.length > 0, 'Fitur Pendukung sukses ter-refresh!');

  // 4. TEST DOMAIN BENAR-BENAR BARU 1 & 2
  console.log('\n--- 4. Testing 2 Novel Unseen Domains (Penitipan Kucing & Percetakan Digital) ---');
  
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
  assert(resPet.alurPendukung.length >= 1, 'Pet hotel memiliki alur pendukung');

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
  assert(resCetak.alurPendukung.length >= 1, 'Percetakan memiliki alur pendukung');

  console.log(`\n=== SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runUnifiedSupportingFlowTests().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
