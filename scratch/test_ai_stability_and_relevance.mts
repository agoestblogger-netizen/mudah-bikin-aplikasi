import {
  generateSupportingFlowsAndFeaturesWithAI,
  generateRbacMatrixWithAI,
  validateSupportingFlowsRelevance,
  validateRbacMatrixRelevance
} from '../src/app/api/guided/route.js';
import type { MockupSessionState } from '../src/lib/templates/types.js';
import fs from 'node:fs';

if (fs.existsSync('.env.local')) {
  process.loadEnvFile('.env.local');
}

interface DomainTestCase {
  name: string;
  domain: string;
  narrative: string;
  mainFlow: string;
  problem: string;
  roles: string[];
}

const testDomains: DomainTestCase[] = [
  {
    name: 'Koperasi Simpan Pinjam',
    domain: 'Koperasi Simpan Pinjam',
    narrative: 'Koperasi simpan pinjam melayani anggota dalam pengajuan pinjaman dan setoran simpanan sukarela maupun wajib. Petugas operasional dan kasir melayani transaksi harian di loket serta pengurus koperasi memantau persetujuan kredit.',
    mainFlow: 'Anggota mengajukan pinjaman -> Petugas Kasir memverifikasi kelayakan berkas -> Pengurus Koperasi menyetujui plafon kredit -> Petugas Kasir mencairkan dana dan mencetak kuitansi',
    problem: 'Pencatatan angsuran dan monitoring kredit macet masih manual',
    roles: ['Super Admin', 'Anggota', 'Petugas Kasir', 'Pengurus Koperasi']
  },
  {
    name: 'Rental Mobil',
    domain: 'Rental Mobil & Sewa Kendaraan',
    narrative: 'Usaha rental mobil melayani penyewa untuk sewa harian dan bulanan dengan sopir maupun lepas kunci. Petugas rental mengecek unit armada dan kasir menerima deposit sewa.',
    mainFlow: 'Penyewa booking armada mobil -> Petugas Rental checklist fisik bodi dan serah kunci -> Penyewa mengembalikan armada -> Petugas Rental cek denda keterlambatan dan bodi',
    problem: 'Jadwal ketersediaan armada bentrok dan denda lecet bodi sering diperdebatkan',
    roles: ['Super Admin', 'Penyewa', 'Petugas Rental', 'Kasir Pembayaran']
  },
  {
    name: 'Pet Hotel (Penitipan Hewan)',
    domain: 'Pet Hotel & Salon Kucing',
    narrative: 'Tempat penitipan hewan peliharaan kucing dan anjing dengan layanan grooming mandi bulu dan penginapan ber-AC. Staf groomer memandikan anabul dan dokter hewan siaga.',
    mainFlow: 'Pemilik hewan titip anabul dan serahkan buku vaksin -> Petugas Groomer mandikan dan bersihkan telinga -> Staf Kasir terima biaya inap dan perawatan',
    problem: 'Catatan alergi pakan tertukar dan kapasitas kandang penuh mendadak',
    roles: ['Super Admin', 'Pemilik Hewan', 'Petugas Groomer', 'Kasir Loket']
  }
];

async function runTests() {
  console.log('================================================================');
  console.log('STRESS TEST & RELEVANCE VERIFICATION (3 SIKLUS PER DOMAIN)');
  console.log('================================================================\n');

  let totalTests = 0;
  let passedTests = 0;

  for (const domainCase of testDomains) {
    console.log(`\n--------------------------------------------------------------`);
    console.log(`PENGUJIAN DOMAIN: ${domainCase.name.toUpperCase()}`);
    console.log(`--------------------------------------------------------------`);

    for (let cycle = 1; cycle <= 3; cycle++) {
      totalTests++;
      console.log(`\n[Siklus ${cycle}/3] Menguji ${domainCase.name}...`);

      const session: MockupSessionState = {
        step: 'ALUR',
        domain: domainCase.domain,
        match: {
          businessCategory: domainCase.domain,
          templateId: 'MT-20',
          tier: 'TIER_1',
          patternIds: ['UP-06']
        },
        storyline: {
          narasi: domainCase.narrative,
          asumsiAlurUtama: domainCase.mainFlow,
          asumsiMasalah: domainCase.problem,
          asumsiAktor: domainCase.roles
        },
        roles: {
          selected: domainCase.roles,
          wajib: ['Super Admin', domainCase.roles[2] || 'Staf'],
          custom: []
        },
        flow: {
          alurInti: domainCase.mainFlow.split('->').map((stepStr, idx) => ({
            step: idx + 1,
            pelaku: domainCase.roles[idx % domainCase.roles.length],
            aksi: stepStr.trim()
          }))
        }
      };

      try {
        // 1. Uji Supporting Flows & Features
        const supporting = await generateSupportingFlowsAndFeaturesWithAI(session);
        const sfRelevance = validateSupportingFlowsRelevance(supporting.alurPendukung, session);

        if (!sfRelevance.valid) {
          console.error(`❌ [GAGAL RELEVANSI SF] Domain ${domainCase.name}: ${sfRelevance.anomalyFound}`);
          continue;
        }

        console.log(`  ✓ Alur Pendukung (Lolos Validasi Relevansi):`);
        supporting.alurPendukung.forEach((ap) => {
          console.log(`    - ${ap.nama}`);
        });

        // Pasang alur pendukung ke session untuk konteks RBAC
        session.flow!.alurPendukung = supporting.alurPendukung;
        session.flow!.fiturPendukung = supporting.fiturPendukung.map((fp) => fp.label);

        // 2. Uji RBAC Matrix
        const rbac = await generateRbacMatrixWithAI(session);
        const rbacRelevance = validateRbacMatrixRelevance(rbac, session);

        if (!rbacRelevance.valid) {
          console.error(`❌ [GAGAL RELEVANSI RBAC] Domain ${domainCase.name}: ${rbacRelevance.anomalyFound}`);
          continue;
        }

        console.log(`  ✓ Matriks RBAC (Lolos Validasi Relevansi):`);
        rbac.modul.forEach((m) => {
          console.log(`    * [Modul] ${m.nama}: ${m.deskripsiFungsional || ''}`);
        });

        // Verifikasi isolasi leksikal spesifik koperasi
        if (domainCase.name === 'Koperasi Simpan Pinjam') {
          const allText = JSON.stringify({ supporting, rbac }).toLowerCase();
          const hasPetAnomaly = /hewan|kucing|anjing|kandang|pakan|grooming|vaksin\s*hewan/i.test(allText);
          const hasRentalAnomaly = /armada|odometer|stnk/i.test(allText);
          if (hasPetAnomaly || hasRentalAnomaly) {
            console.error(`❌ [ANOMALI BOCOR] Terdeteksi istilah pet/rental di Koperasi!`);
            continue;
          }
        }

        passedTests++;
        console.log(`  🎉 [SUKSES SIKLUS ${cycle}] Tidak ada anomali konten!`);
      } catch (err) {
        console.error(`❌ [ERROR EXCEPTION] Siklus ${cycle} ${domainCase.name}:`, err);
      }
    }
  }

  console.log('\n================================================================');
  console.log(`HASIL AKHIR: ${passedTests}/${totalTests} PENGUJIAN LOLOS DENGAN SEMPURNA!`);
  console.log('================================================================');
}

runTests().catch(console.error);
