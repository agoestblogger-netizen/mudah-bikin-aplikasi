import fs from 'node:fs';
if (fs.existsSync('.env.local')) {
  process.loadEnvFile('.env.local');
}

import {
  generateSupportingFlowsAndFeaturesWithAI,
  generateRbacMatrixWithAI,
  validateSupportingFlowsRelevance,
  validateRbacMatrixRelevance
} from '../src/app/api/guided/route.js';
import type { MockupSessionState } from '../src/lib/templates/types.js';

interface TestCase {
  name: string;
  domain: string;
  narrative: string;
  mainFlow: string;
  problem: string;
  roles: string[];
  forbiddenKeywords: RegExp[];
  expectedKeywords: RegExp[];
}

const testCases: TestCase[] = [
  {
    name: 'Koperasi Simpan Pinjam',
    domain: 'Koperasi Simpan Pinjam',
    narrative: 'Koperasi simpan pinjam melayani anggota dalam pengajuan pinjaman dan setoran simpanan sukarela maupun wajib. Petugas operasional dan kasir melayani transaksi harian di loket serta pengurus koperasi memantau persetujuan kredit.',
    mainFlow: 'Anggota mengajukan pinjaman -> Petugas Kasir memverifikasi kelayakan berkas -> Pengurus Koperasi menyetujui pinjaman -> Kasir mencairkan dana tunai pinjaman dan cetak kuitansi akad',
    problem: 'Pencatatan angsuran dan monitoring kredit macet masih manual',
    roles: ['Super Admin', 'Anggota', 'Petugas Kasir', 'Pengurus Koperasi'],
    forbiddenKeywords: [/\b(hewan|kucing|anjing|kandang|pakan|grooming|vaksin\s*hewan)\b/i, /\b(armada|odometer|stnk.*unit|mobil.*sewa)\b/i, /\b(cukur|silet|clipper|pomade)\b/i],
    expectedKeywords: [/angsuran|pinjaman|kredit|simpanan|kasir|brankas/i]
  },
  {
    name: 'Rental Mobil',
    domain: 'Rental Mobil & Sewa Kendaraan',
    narrative: 'Usaha rental mobil melayani penyewa untuk sewa harian dan bulanan dengan sopir maupun lepas kunci. Petugas rental mengecek unit armada dan kasir menerima deposit sewa.',
    mainFlow: 'Penyewa booking armada mobil -> Petugas Rental checklist fisik bodi dan serah kunci -> Penyewa mengembalikan armada -> Petugas Rental cek denda keterlambatan dan bodi',
    problem: 'Jadwal ketersediaan armada bentrok dan denda lecet bodi sering diperdebatkan',
    roles: ['Super Admin', 'Penyewa', 'Petugas Rental', 'Kasir Pembayaran'],
    forbiddenKeywords: [/\b(hewan|kucing|anjing|kandang|pakan|grooming)\b/i, /\b(simpanan|pinjaman|kredit\s*macet)\b/i, /\b(cukur|clipper|pomade)\b/i],
    expectedKeywords: [/armada|kendaraan|mobil|bodi|denda|sewa|stnk/i]
  },
  {
    name: 'Kafe & Restoran',
    domain: 'Kafe & Restoran',
    narrative: 'Kafe dan resto menyajikan aneka kopi espresso dan makanan utama. Pelayan mencatat pesanan meja dan barista meracik pesanan serta kasir menerima pembayaran.',
    mainFlow: 'Pelanggan memesan menu di meja -> Pelayan input pesanan ke sistem POS -> Barista dan koki meracik hidangan -> Kasir cetak struk pembayaran dan rekap kas harian',
    problem: 'Bahan baku dapur kadaluarsa dan pesanan menu sering salah saji saat jam makan siang',
    roles: ['Super Admin', 'Pelanggan', 'Pelayan', 'Kasir'],
    forbiddenKeywords: [/\b(hewan|kucing|anjing|kandang|pakan)\b/i, /\b(armada|odometer|stnk)\b/i, /\b(angsuran|kredit\s*macet)\b/i],
    expectedKeywords: [/menu|pesanan|makanan|dapur|chiller|bahan|rekap/i]
  },
  {
    name: 'Pet Hotel (Penitipan Hewan)',
    domain: 'Pet Hotel & Salon Kucing',
    narrative: 'Tempat penitipan hewan peliharaan kucing dan anjing dengan layanan grooming mandi bulu dan penginapan ber-AC. Staf groomer memandikan anabul dan dokter hewan siaga.',
    mainFlow: 'Pemilik hewan titip anabul dan serahkan buku vaksin -> Petugas Groomer mandikan dan bersihkan telinga -> Kasir Loket terima biaya inap dan perawatan',
    problem: 'Catatan alergi pakan tertukar dan kapasitas kandang penuh mendadak',
    roles: ['Super Admin', 'Pemilik Hewan', 'Petugas Groomer', 'Kasir Loket'],
    forbiddenKeywords: [/\b(odometer|stnk.*unit)\b/i, /\b(simpanan|pinjaman|kredit\s*macet)\b/i, /\b(cukur.*rambut.*kumis|pomade)\b/i],
    expectedKeywords: [/hewan|kandang|pakan|anabul|vaksin|grooming/i]
  },
  {
    name: 'Bengkel Motor',
    domain: 'Bengkel Motor & Servis Kendaraan',
    narrative: 'Bengkel motor melayani servis rutin, ganti oli, dan perbaikan mesin kendaraan. Mekanik memeriksa kondisi motor dan kasir mengelola pembayaran onderdil.',
    mainFlow: 'Pelanggan mendaftarkan keluhan motor -> Mekanik memeriksa mesin dan mengganti suku cadang -> Mekanik uji coba kelayakan jalan -> Kasir menerima pembayaran servis dan cetak nota',
    problem: 'Stok suku cadang sering kosong saat dibutuhkan dan pelanggan komplain garansi servis',
    roles: ['Super Admin', 'Pelanggan', 'Mekanik Bengkel', 'Kasir'],
    forbiddenKeywords: [/\b(hewan|kucing|anjing|kandang|pakan)\b/i, /\b(angsuran|simpanan|kredit\s*macet)\b/i, /\b(cukur|clipper|pomade)\b/i],
    expectedKeywords: [/servis|mesin|suku\s*cadang|onderdil|bengkel|motor/i]
  }
];

async function runComprehensiveVerification() {
  console.log('========================================================================');
  console.log('VERIFIKASI MENYELURUH 5 DOMAIN (3 SIKLUS PER DOMAIN = 15 UJI TOTAL)');
  console.log('========================================================================\n');

  let passed = 0;
  let total = 0;

  for (const tc of testCases) {
    console.log(`\n------------------------------------------------------------------------`);
    console.log(`PENGUJIAN DOMAIN: ${tc.name.toUpperCase()}`);
    console.log(`------------------------------------------------------------------------`);

    for (let cycle = 1; cycle <= 3; cycle++) {
      total++;
      console.log(`\n[Siklus ${cycle}/3] Menguji: ${tc.name}`);

      const session: MockupSessionState = {
        step: 'ALUR',
        domain: tc.domain,
        match: {
          businessCategory: tc.domain,
          templateId: 'MT-20',
          tier: 'TIER_1',
          patternIds: ['UP-06']
        },
        storyline: {
          narasi: tc.narrative,
          asumsiAlurUtama: tc.mainFlow,
          asumsiMasalah: tc.problem,
          asumsiAktor: tc.roles
        },
        roles: {
          selected: tc.roles,
          wajib: ['Super Admin', tc.roles[2]],
          custom: []
        },
        flow: {
          alurInti: tc.mainFlow.split('->').map((stepStr, idx) => ({
            step: idx + 1,
            pelaku: tc.roles[idx % tc.roles.length],
            aksi: stepStr.trim()
          }))
        }
      };

      try {
        // 1. Eksekusi Alur Pendukung
        const supporting = await generateSupportingFlowsAndFeaturesWithAI(session);
        const sfCheck = validateSupportingFlowsRelevance(supporting.alurPendukung, session);

        if (!sfCheck.valid) {
          console.error(`❌ [GAGAL SF RELEVANSI] ${tc.name}: ${sfCheck.anomalyFound}`);
          continue;
        }

        console.log(`  ✓ Alur Pendukung Valid & Relevan:`);
        supporting.alurPendukung.forEach((ap) => {
          console.log(`    - ${ap.nama}`);
          ap.steps.forEach((s) => console.log(`      * (${s.pelaku}) ${s.aksi.slice(0, 70)}...`));
        });

        // Pasang ke session untuk uji RBAC
        session.flow!.alurPendukung = supporting.alurPendukung;
        session.flow!.fiturPendukung = supporting.fiturPendukung.map((fp) => fp.label);

        // 2. Eksekusi Matriks RBAC
        const rbac = await generateRbacMatrixWithAI(session);
        const rbacCheck = validateRbacMatrixRelevance(rbac, session);

        if (!rbacCheck.valid) {
          console.error(`❌ [GAGAL RBAC RELEVANSI] ${tc.name}: ${rbacCheck.anomalyFound}`);
          continue;
        }

        console.log(`  ✓ Matriks RBAC Valid & Relevan:`);
        rbac.modul.forEach((m) => {
          console.log(`    * [Modul] ${m.nama}`);
        });

        // 3. Verifikasi Bebas Kebocoran Kata Terlarang (Domain Isolation Guard)
        const combinedJson = JSON.stringify({ supporting, rbac });
        let leakFound = false;
        for (const forbidden of tc.forbiddenKeywords) {
          if (forbidden.test(combinedJson)) {
            console.error(`❌ [KEBOCORAN DOMAIN] Ditemukan istilah terlarang (${forbidden}) di ${tc.name}!`);
            leakFound = true;
            break;
          }
        }
        if (leakFound) continue;

        // 4. Verifikasi Kehadiran Kata Kunci Ekspektasi
        let expectedFound = false;
        for (const expected of tc.expectedKeywords) {
          if (expected.test(combinedJson)) {
            expectedFound = true;
            break;
          }
        }
        if (!expectedFound) {
          console.error(`❌ [TIDAK GROUNDED] Tidak ditemukan kata kunci domain yang diharapkan di ${tc.name}!`);
          continue;
        }

        passed++;
        console.log(`  🎉 [SUKSES SIKLUS ${cycle}] Lolos 100% tanpa anomali.`);
      } catch (err) {
        console.error(`❌ [EXCEPTION] ${tc.name} Siklus ${cycle}:`, err);
      }
    }
  }

  console.log('\n========================================================================');
  console.log(`HASIL AKHIR VERIFIKASI: ${passed}/${total} PENGUJIAN LOLOS DENGAN SEMPURNA!`);
  console.log('========================================================================');

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runComprehensiveVerification().catch(console.error);
