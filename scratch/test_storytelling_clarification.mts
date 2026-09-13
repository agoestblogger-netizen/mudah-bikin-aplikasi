/**
 * Unit test untuk verifikasi:
 * Klarifikasi Arah Bisnis di Step STORYTELLING (Sebelum Narasi Dibuat)
 */

import {
  detectAmbiguousStorylineDomain,
  buildDirectionClarificationCard,
  DUAL_PROCESS_PATTERNS,
  detectDualProcess,
  buildKasusGandaFromSession,
  buildGuidedStep
} from '../src/lib/templates/processes/guided';
import type { MockupSessionState } from '../src/lib/templates/processes/types';

let pass = 0;
let fail = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`✅ PASS: ${msg}`);
    pass++;
  } else {
    console.error(`❌ FAIL: ${msg}`);
    fail++;
  }
}

console.log('--- TEST 1: Deteksi Prompt Ambigu Murni vs Eksplisit vs Regresi ---');

// 1.1 Prompt ambigu murni (harus terdeteksi ambigu)
const ambEmas = detectAmbiguousStorylineDomain('buatkan aplikasi toko emas');
assert(ambEmas !== null && ambEmas.pattern.id === 'toko_emas', 'Prompt "buatkan aplikasi toko emas" terdeteksi ambigu toko_emas');

const ambPegadaian = detectAmbiguousStorylineDomain('buatkan aplikasi pegadaian');
assert(ambPegadaian !== null && ambPegadaian.pattern.id === 'pegadaian', 'Prompt "buatkan aplikasi pegadaian" terdeteksi ambigu pegadaian');

const ambTukarTambah = detectAmbiguousStorylineDomain('buatkan aplikasi tukar tambah mobil');
assert(ambTukarTambah !== null && ambTukarTambah.pattern.id === 'tukar_tambah', 'Prompt "buatkan aplikasi tukar tambah mobil" terdeteksi ambigu tukar_tambah');

// 1.2 Prompt yang sudah eksplisit menyebut arah (TIDAK boleh terdeteksi ambigu)
const expEmasJualBeli = detectAmbiguousStorylineDomain('toko emas yang jual dan beli perhiasan');
assert(expEmasJualBeli === null, 'Prompt "toko emas yang jual dan beli perhiasan" TIDAK ambigu (eksplisit arah)');

const expEmasBeliBekas = detectAmbiguousStorylineDomain('aplikasi toko emas khusus beli emas bekas pelanggan');
assert(expEmasBeliBekas === null, 'Prompt "aplikasi toko emas khusus beli emas bekas pelanggan" TIDAK ambigu');

const expPegadaianGadaiTebus = detectAmbiguousStorylineDomain('aplikasi pegadaian untuk terima gadai dan tebus barang');
assert(expPegadaianGadaiTebus === null, 'Prompt "aplikasi pegadaian untuk terima gadai dan tebus barang" TIDAK ambigu');

// 1.3 Regresi domain biasa (cuci mobil, kafe, klinik gigi, dll — TIDAK boleh terdeteksi)
const regCuciMobil = detectAmbiguousStorylineDomain('buatkan aplikasi cuci mobil');
assert(regCuciMobil === null, 'Regresi cuci mobil: TIDAK ambigu (null)');

const regKafe = detectAmbiguousStorylineDomain('buatkan aplikasi kasir kafe dan resto');
assert(regKafe === null, 'Regresi kafe: TIDAK ambigu (null)');

const regKlinikGigi = detectAmbiguousStorylineDomain('buatkan aplikasi klinik dokter gigi');
assert(regKlinikGigi === null, 'Regresi klinik gigi: TIDAK ambigu (null)');

const regRentalMobil = detectAmbiguousStorylineDomain('buatkan aplikasi rental mobil lepas kunci');
assert(regRentalMobil === null, 'Regresi rental mobil: TIDAK ambigu (null)');

console.log('\n--- TEST 2: Struktur Kartu Klarifikasi Arah Bisnis ---');
if (ambEmas) {
  const card = buildDirectionClarificationCard(ambEmas.pattern);
  assert(card.stepId === 'STORYTELLING', 'Kartu klarifikasi stepId adalah STORYTELLING');
  assert(card.options.length === 3, 'Kartu klarifikasi memiliki tepat 3 opsi');
  assert(card.options[0].id === 'dir_A_only', 'Opsi 1: dir_A_only (Jual ke pelanggan)');
  assert(card.options[1].id === 'dir_B_only', 'Opsi 2: dir_B_only (Beli dari pelanggan)');
  assert(card.options[2].id === 'dir_both', 'Opsi 3: dir_both (Dua-duanya)');
  assert(card.options[2].recommended === true, 'Opsi dir_both direkomendasikan');
}

console.log('\n--- TEST 3: Alur Pilihan "Dua-duanya" (dir_both) Menuju Step ALUR ---');
// Simulasi session setelah user memilih "dir_both" di storytelling:
const sessionAfterBoth: MockupSessionState = {
  step: 'ROLE',
  match: {
    templateId: 'MT-20',
    overlayIds: [],
    patternIds: ['UP-06', 'UP-09'],
    tier: 'BASIC',
    businessCategory: 'Toko Emas'
  },
  storyline: {
    narasi: 'Toko emas melayani penjualan perhiasan emas baru kepada pelanggan serta pembelian emas bekas/buyback dari masyarakat.',
    asumsiMasalah: 'Pencatatan emas rawan salah hitung',
    asumsiAktor: ['Super Admin', 'Staf Penaksir & Kasir', 'Pelanggan'],
    asumsiAlurUtama: 'Pelanggan transaksi -> Kasir proses -> Pemilik rekap',
    statusKonfirmasi: 'disetujui'
  },
  roles: {
    selected: ['Super Admin', 'Staf Penaksir & Kasir', 'Pelanggan'],
    wajib: ['Super Admin', 'Staf Penaksir & Kasir']
  },
  flow: {
    dualFlowPreDecided: true,
    dualProcessNames: { processA: 'Penjualan ke Pelanggan', processB: 'Pembelian dari Pelanggan' }
  },
  painPoints: { selected: [] },
  features: { selected: [] }
};

// Pastikan saat session ini memiliki dualFlowPreDecided: true,
// buildKasusGandaFromSession menghasilkan 2 kasus ganda
const kasusGanda = buildKasusGandaFromSession(
  sessionAfterBoth,
  sessionAfterBoth.flow.dualProcessNames!.processA,
  sessionAfterBoth.flow.dualProcessNames!.processB
);
assert(kasusGanda.length === 2, 'Menghasilkan tepat 2 kasus ganda');
assert(kasusGanda[0].nama === 'Penjualan ke Pelanggan', 'Kasus 1: Penjualan ke Pelanggan');
assert(kasusGanda[1].nama === 'Pembelian dari Pelanggan', 'Kasus 2: Pembelian dari Pelanggan');
assert(kasusGanda[0].alurInti.length > 0, 'Kasus 1 memiliki langkah alur');
assert(kasusGanda[1].alurInti.length > 0, 'Kasus 2 memiliki langkah alur');

// Pastikan di step ALUR kartu yang dihasilkan adalah kartu konfirmasi alur biasa (BUKAN kartu tanya dua alur)
const sessionInAlur: MockupSessionState = {
  ...sessionAfterBoth,
  step: 'ALUR',
  flow: {
    ...sessionAfterBoth.flow,
    kasusGanda,
    alurInti: []
  }
};
const alurCard = buildGuidedStep(sessionInAlur);
assert(alurCard !== null && alurCard.stepId === 'ALUR', 'Kartu step ALUR terbentuk');
assert(!alurCard?.options.some(o => o.id === 'pilih_dua_alur'), 'TIDAK bertanya ulang "dua alur atau satu"');
assert(alurCard?.options.some(o => o.id === 'confirm_alur'), 'Memiliki opsi konfirmasi "confirm_alur"');

console.log('\n--- TEST 4: Alur Pilihan "Jual saja" (dir_A_only) ---');
// Simulasi session setelah user memilih "dir_A_only":
const sessionAfterAOnly: MockupSessionState = {
  step: 'ROLE',
  match: {
    templateId: 'MT-20',
    overlayIds: [],
    patternIds: ['UP-06', 'UP-09'],
    tier: 'BASIC',
    businessCategory: 'Toko Emas'
  },
  storyline: {
    narasi: 'Toko emas melayani penjualan perhiasan emas berkualitas kepada pelanggan yang datang mencari koleksi cincin dan kalung.',
    asumsiMasalah: 'Stok perhiasan rawan selisih',
    asumsiAktor: ['Super Admin', 'Kasir Penjualan', 'Pelanggan'],
    asumsiAlurUtama: 'Pelanggan memilih -> Kasir timbang & cetak nota -> Pelanggan bayar -> Pemilik pantau',
    statusKonfirmasi: 'disetujui'
  },
  roles: {
    selected: ['Super Admin', 'Kasir Penjualan', 'Pelanggan'],
    wajib: ['Super Admin', 'Kasir Penjualan']
  },
  flow: {}, // dualFlowPreDecided tidak ada
  painPoints: { selected: [] },
  features: { selected: [] }
};
// Narasi hanya satu arah jual -> detectDualProcess harus return null
const dualAOnly = detectDualProcess(sessionAfterAOnly);
assert(dualAOnly === null, 'Pilihan satu arah (jual saja): detectDualProcess return null, alur berjalan normal satu Alur Inti');

console.log(`\n========================================`);
console.log(`TOTAL HASIL: ${pass} PASS, ${fail} FAIL`);
console.log(`========================================`);

if (fail > 0) process.exit(1);
