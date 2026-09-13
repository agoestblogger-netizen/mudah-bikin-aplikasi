import { applyGuidedAnswer } from '../src/lib/templates/processes/guided';
import { MockupSessionState } from '../src/lib/templates/types';

function runCumulativeRevisionTests() {
  console.log('=== START TEST: Cumulative Storytelling Revision & Classification ===\n');

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

  // 1. TEST SKENARIO 1: Koreksi spesifik dengan kata "bukan begitu" TIDAK boleh membajak ke mode klarifikasi bertahap
  console.log('--- 1. Testing Input Classification: Specific Correction vs Blind Mismatch ---');

  const initialSession: MockupSessionState = {
    domain: 'aplikasi jual beli barang bekas rosok',
    step: 'STORYTELLING',
    match: {
      templateId: 'tpl_scrap',
      overlayIds: [],
      patternIds: [],
      tier: 'standard',
      contextualRoles: ['Super Admin', 'Pengumpul Barang', 'Warga Penjual']
    },
    storyline: {
      narasi: 'Pengumpul menjemput barang rosok ke rumah warga, lalu membawanya ke gudang. Apakah ini sudah menggambarkan proses bisnismu?',
      asumsiMasalah: 'Pencatatan timbangan barang rosok',
      asumsiAktor: ['Super Admin', 'Pengumpul Barang', 'Warga Penjual'],
      asumsiAlurUtama: 'Jemput barang, bawa ke gudang',
      statusKonfirmasi: 'dikoreksi',
      revisiCount: 1,
      riwayatKoreksi: []
    },
    roles: { selected: [] },
    flow: {}
  };

  // Case 1A: User types a specific operational correction starting with "bukan begitu"
  const correctionText = 'bukan begitu, pembayaran ke warga dilakukan langsung di tempat setelah pengumpul menetapkan berat dan harga';
  const result1A = applyGuidedAnswer(initialSession, 'STORYTELLING', [], correctionText);

  assert(result1A.step === 'STORYTELLING', 'Step tetap di STORYTELLING untuk konfirmasi');
  assert(result1A.storyline?.modeKlarifikasiBertahap !== true, 'TIDAK masuk ke mode klarifikasi bertahap karena memuat detail konkret');
  assert(result1A.storyline?.riwayatKoreksi?.includes(correctionText) === true, 'Koreksi spesifik tersimpan di riwayatKoreksi');

  // Case 1B: User sends pure blind mismatch ("mismatch_story" tanpa detail)
  const result1B = applyGuidedAnswer(initialSession, 'STORYTELLING', ['mismatch_story'], '');
  assert(result1B.storyline?.modeKlarifikasiBertahap === true, 'Blind mismatch (tanpa detail) masuk mode klarifikasi bertahap');

  // Case 1C: User types short abstract complaint without any details
  const result1C = applyGuidedAnswer(initialSession, 'STORYTELLING', [], 'salah total');
  assert(result1C.storyline?.modeKlarifikasiBertahap === true, 'Komplain abstrak singkat tanpa detail masuk mode klarifikasi');

  // 2. TEST SKENARIO 2: Simulasi 8 Putaran Koreksi Berantai (Kumulatif)
  console.log('\n--- 2. Testing 8 Consecutive Cumulative Revisions ---');
  let currentSession = { ...initialSession };

  const corrections = [
    'Pengumpul datang ke rumah warga untuk menimbang barang rosok dan membayar tunai atau transfer langsung di tempat',
    'Barang yang sudah dibayar kemudian disetor ke gudang pengepul untuk ditimbang ulang dan dipilah per jenis material',
    'Pastikan pembayaran tetap selesai di depan rumah warga, bukan menunggu hasil timbangan gudang',
    'Tambahkan peran Petugas Gudang yang bertugas menerima setoran dan memeriksa nota timbangan',
    'Pengumpul mencetak bukti transaksi digital dan menyerahkannya ke warga saat itu juga',
    'Petugas gudang mencatat hasil pemilahan tembaga, besi, dan kardus ke sistem',
    'Super Admin memantau rekonsiliasi kas keluar untuk pengumpul dan persediaan stok di gudang',
    'Setuju dengan alur jemput, bayar di tempat, setor ke gudang, dan rekonsiliasi kas Super Admin'
  ];

  for (let i = 0; i < corrections.length; i++) {
    const corr = corrections[i];
    currentSession = applyGuidedAnswer(currentSession, 'STORYTELLING', ['minor_adjust'], corr);
  }

  console.log(`Total riwayat tersimpan: ${currentSession.storyline?.riwayatKoreksi?.length || 0}`);
  assert((currentSession.storyline?.riwayatKoreksi?.length || 0) === 8, 'Semua 8 koreksi tersimpan kumulatif di riwayatKoreksi');
  assert(
    currentSession.storyline?.riwayatKoreksi?.some((r) => r.includes('rumah warga')) === true,
    'Fakta rumah warga tersimpan di riwayat'
  );
  assert(
    currentSession.storyline?.riwayatKoreksi?.some((r) => r.includes('gudang pengepul')) === true,
    'Fakta gudang pengepul tersimpan di riwayat'
  );
  assert(
    currentSession.storyline?.riwayatKoreksi?.some((r) => r.includes('bayar di tempat')) === true,
    'Fakta bayar di tempat tersimpan di riwayat'
  );

  // 3. TEST SKENARIO 3: Konfirmasi akhir memajukan langkah ke ROLE dengan riwayat utuh
  console.log('\n--- 3. Testing Confirmation Step Advance to ROLE ---');
  const confirmedSession = applyGuidedAnswer(currentSession, 'STORYTELLING', ['confirm_story'], 'Sudah pas');
  assert(confirmedSession.step === 'ROLE', 'Konfirmasi memajukan session ke step ROLE');
  assert(confirmedSession.storyline?.statusKonfirmasi === 'disetujui', 'Status konfirmasi disetujui');
  assert((confirmedSession.storyline?.riwayatKoreksi?.length || 0) >= 8, 'Riwayat kumulatif tetap utuh saat lanjut ke ROLE');

  console.log(`\n=== SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runCumulativeRevisionTests();
