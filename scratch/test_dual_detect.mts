import { detectDualProcess } from '../src/lib/templates/processes/guided.js';
import type { MockupSessionState } from '../src/lib/templates/processes/types.js';

function makeSession(narasi: string, asumsiAlurUtama: string): MockupSessionState {
  return {
    step: 'ALUR' as const,
    match: { templateId: 'MT-01', overlayIds: [], patternIds: ['UP-01'], tier: 'BASIC', businessCategory: 'Test' },
    storyline: { narasi, asumsiMasalah: '', asumsiAktor: ['Super Admin', 'Staf Toko', 'Pelanggan'], asumsiAlurUtama, statusKonfirmasi: 'disetujui' },
    roles: { selected: ['Super Admin', 'Staf Toko', 'Pelanggan'] },
    flow: {},
    painPoints: { selected: [] },
    features: { selected: [] },
  } as MockupSessionState;
}

const tests = [
  { name: 'Toko emas: jual DAN beli perhiasan (HARUS TERDETEKSI)', session: makeSession('Toko emas kami melayani dua jenis transaksi setiap hari: menjual perhiasan emas baru kepada pelanggan yang ingin membeli, dan membeli perhiasan emas bekas dari pelanggan yang ingin menjual. Kedua transaksi ini sama-sama ramai.', 'Pelanggan datang → Staf menaksir emas → Transaksi jual atau beli emas → Pembayaran → Pemilik rekap'), expectedIsDual: true },
  { name: 'Pegadaian: gadai DAN tebus (HARUS TERDETEKSI)', session: makeSession('Usaha gadai kami menerima dua layanan rutin: menerima barang jaminan dari nasabah yang menggadaikan, dan memproses penebusan barang gadai bagi nasabah yang melunasi pinjaman.', 'Nasabah datang → Penaksir cek barang gadai → Proses gadai atau tebus → Pembayaran → Pemilik rekap'), expectedIsDual: true },
  { name: 'Cuci mobil (TIDAK BOLEH TERDETEKSI)', session: makeSession('Usaha cuci mobil kami menerima kendaraan pelanggan, mencuci dan memvakum interior, lalu menyerahkan kembali ke pelanggan.', 'Mobil datang dicatat kasir → Staf cuci mencuci & memvakum → Kasir terima pembayaran → Pemilik pantau'), expectedIsDual: false },
  { name: 'Rental mobil (TIDAK BOLEH TERDETEKSI)', session: makeSession('Usaha rental mobil kami melayani penyewa lepas kunci atau dengan sopir. Petugas rental memeriksa dokumen dan melakukan serah terima kunci.', 'Penyewa booking → Petugas serah terima kunci & cek unit → Pengembalian armada → Pemilik pantau'), expectedIsDual: false },
  { name: 'Bengkel "kadang juga jual sparepart" modalitas lemah (TIDAK BOLEH TERDETEKSI)', session: makeSession('Bengkel servis motor kami mengerjakan servis rutin, ganti oli, dan perbaikan mesin. Kadang juga kami jual sparepart kepada pelanggan yang membutuhkan.', 'Pelanggan datang → Mekanik diagnosa → Servis kendaraan → Pembayaran → Pemilik rekap'), expectedIsDual: false },
  { name: 'Kafe (TIDAK BOLEH TERDETEKSI)', session: makeSession('Kafe kami melayani pelanggan yang memesan kopi dan makanan. Kasir mencatat pesanan, barista meracik minuman.', 'Pelanggan pesan → Kasir catat → Barista racik → Pelayan antar → Pemilik rekap'), expectedIsDual: false },
];

let pass = 0, fail = 0;
for (const t of tests) {
  const result = detectDualProcess(t.session);
  const isDual = result !== null && result.isDual;
  const ok = isDual === t.expectedIsDual;
  if (ok) { console.log(`PASS: ${t.name}`); if (result) console.log(`       processA="${result.processA}", processB="${result.processB}"`); pass++; }
  else { console.error(`FAIL: ${t.name}`); console.error(`       Expected=${t.expectedIsDual}, got=${isDual}`); if (result) console.error(`       processA="${result.processA}", processB="${result.processB}"`); fail++; }
}
console.log(`\n=== ${pass} PASS, ${fail} FAIL ===`);
if (fail > 0) process.exit(1);
