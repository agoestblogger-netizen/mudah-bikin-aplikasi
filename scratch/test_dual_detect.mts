/**
 * Unit test untuk detectDualProcess — verifikasi kriteria deteksi ketat.
 * Domain yang harus return isDual: true: toko emas, pegadaian
 * Domain yang harus return null (isDual: false): cuci mobil, rental mobil, kafe, bengkel
 */

import { detectDualProcess } from '../src/lib/templates/processes/guided';
import type { MockupSessionState } from '../src/lib/templates/processes/types';

function makeSession(narasi: string, asumsiAlurUtama: string): MockupSessionState {
  return {
    step: 'ALUR',
    match: {
      templateId: 'MT-01',
      overlayIds: [],
      patternIds: ['UP-01'],
      tier: 'BASIC',
      businessCategory: 'Test',
    },
    storyline: {
      narasi,
      asumsiMasalah: '',
      asumsiAktor: ['Super Admin', 'Staf Toko', 'Pelanggan'],
      asumsiAlurUtama,
      statusKonfirmasi: 'disetujui',
    },
    roles: { selected: ['Super Admin', 'Staf Toko', 'Pelanggan'] },
    flow: {},
    painPoints: { selected: [] },
    features: { selected: [] },
  } as MockupSessionState;
}

const tests: Array<{ name: string; session: MockupSessionState; expectedIsDual: boolean }> = [
  {
    name: 'Toko emas: jual perhiasan DAN beli perhiasan bekas dari pelanggan',
    session: makeSession(
      'Toko emas kami melayani dua jenis transaksi setiap hari: menjual perhiasan emas baru kepada pelanggan yang ingin membeli, dan membeli perhiasan emas bekas dari pelanggan yang ingin menjual. Kedua transaksi ini sama-sama ramai.',
      'Pelanggan datang → Staf menaksir emas → Transaksi jual atau beli emas → Pembayaran → Pemilik rekap'
    ),
    expectedIsDual: true,
  },
  {
    name: 'Pegadaian: gadai barang DAN tebus barang gadai',
    session: makeSession(
      'Usaha gadai kami menerima dua layanan rutin: menerima barang jaminan dari nasabah yang ingin menggadaikan, dan memproses penebusan barang gadai bagi nasabah yang ingin mengambil kembali barang jaminannya setelah melunasi pinjaman.',
      'Nasabah datang → Penaksir cek barang gadai → Proses gadai atau tebus → Pembayaran → Pemilik rekap'
    ),
    expectedIsDual: true,
  },
  {
    name: 'Cuci mobil: tidak ada proses berlawanan',
    session: makeSession(
      'Usaha cuci mobil kami menerima kendaraan pelanggan, mencuci dan memvakum interior, lalu menyerahkan kembali ke pelanggan.',
      'Mobil datang dicatat kasir → Staf cuci mencuci & memvakum → Kasir terima pembayaran → Pemilik pantau rekap'
    ),
    expectedIsDual: false,
  },
  {
    name: 'Rental mobil: serah & terima kunci adalah satu alur linier',
    session: makeSession(
      'Usaha rental mobil kami melayani penyewa yang ingin meminjam kendaraan lepas kunci atau dengan sopir. Petugas rental memeriksa dokumen, melakukan serah terima kunci, dan saat mobil dikembalikan mencatat kondisi akhir.',
      'Penyewa booking → Petugas serah terima kunci & cek unit → Pengembalian armada → Pemilik pantau'
    ),
    expectedIsDual: false,
  },
  {
    name: 'Bengkel "kadang juga jual sparepart" — modalitas rendah harus diabaikan',
    session: makeSession(
      'Bengkel servis motor kami mengerjakan servis rutin, ganti oli, dan perbaikan mesin. Kadang juga kami jual sparepart kepada pelanggan yang membutuhkan.',
      'Pelanggan datang → Mekanik diagnosa → Servis kendaraan → Pembayaran → Pemilik rekap'
    ),
    expectedIsDual: false,
  },
  {
    name: 'Kafe: tidak ada proses transaksi berlawanan',
    session: makeSession(
      'Kafe kami melayani pelanggan yang memesan kopi dan makanan. Kasir mencatat pesanan, barista meracik minuman, dan pelayan mengantarkan ke meja.',
      'Pelanggan pesan → Kasir catat → Barista racik → Pelayan antar → Pemilik rekap'
    ),
    expectedIsDual: false,
  },
];

let pass = 0;
let fail = 0;

for (const t of tests) {
  const result = detectDualProcess(t.session);
  const isDual = result !== null && result.isDual;
  const ok = isDual === t.expectedIsDual;
  if (ok) {
    console.log(`PASS: ${t.name}`);
    if (result) console.log(`       processA: "${result.processA}", processB: "${result.processB}"`);
    pass++;
  } else {
    console.error(`FAIL: ${t.name}`);
    console.error(`       Expected isDual=${t.expectedIsDual}, got isDual=${isDual}`);
    if (result) console.error(`       processA: "${result.processA}", processB: "${result.processB}"`);
    fail++;
  }
}

console.log(`\n=== HASIL: ${pass} PASS, ${fail} FAIL ===`);
if (fail > 0) process.exit(1);
