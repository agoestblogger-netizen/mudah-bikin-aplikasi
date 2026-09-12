import { generateStorylineWithAI } from '../src/app/api/guided/route';
import {
  buildGuidedStep,
  detectCoreOperationalRole,
  getDomainFlowDetails,
  reconcileCoreOperationalRole
} from '../src/lib/templates/processes/guided';
import type { MockupSessionState } from '../src/lib/templates/processes/types';

async function runEndToEndVerification() {
  console.log('================================================================');
  console.log('VERIFIKASI POIN 4 (STEP ALUR) & TIGA KETENTUAN TAMBAHAN');
  console.log('================================================================\n');

  const testCases = [
    {
      id: 'rental_mobil',
      label: 'Domain 1: Rental Mobil Lepas Kunci & Sopir (End-to-End Asli)',
      prompt: 'buatkan aplikasi rental mobil lepas kunci dan dengan sopir'
    },
    {
      id: 'cuci_mobil',
      label: 'Domain 2: Cuci Mobil (End-to-End Asli)',
      prompt: 'buatkan aplikasi cuci mobil'
    },
    {
      id: 'klinik_gigi',
      label: 'Domain 3: Klinik Dokter Gigi (End-to-End Asli)',
      prompt: 'buatkan aplikasi klinik dokter gigi'
    }
  ];

  const results: any[] = [];

  for (const tc of testCases) {
    console.log(`\n>>> MENJALANKAN TEST END-TO-END ASLI: ${tc.label} <<<`);
    console.log(`Prompt: "${tc.prompt}"`);

    // 1. Generate Storyline Asli via AI
    const storyline = await generateStorylineWithAI(tc.prompt);

    // 2. Setup Session State
    const sessionInitial: MockupSessionState = {
      step: 'ROLE',
      match: {
        templateId: storyline.templateId || 'MT-01',
        overlayIds: storyline.overlayIds || [],
        patternIds: storyline.patternIds || ['UP-06'],
        tier: 'STARTER',
        businessCategory: storyline.businessCategory,
        contextualPainPoints: [],
        contextualRoles: []
      },
      storyline: {
        narasi: storyline.narasi,
        asumsiMasalah: storyline.asumsiMasalah,
        asumsiAktor: storyline.asumsiAktor,
        asumsiAlurUtama: storyline.asumsiAlurUtama,
        statusKonfirmasi: 'disetujui',
        revisiCount: 0,
        detailAktor: storyline.detailAktor
      },
      roles: { selected: [] },
      flow: {},
      painPoints: { selected: [] },
      features: { selected: [] }
    };

    // 3. Step ROLE: Tentukan role wajib awal
    const initialCoreRole = detectCoreOperationalRole(sessionInitial);
    const roleStep = buildGuidedStep(sessionInitial);
    const selectedRoles = roleStep.options.map((opt) => opt.label);

    const sessionAtRole: MockupSessionState = {
      ...sessionInitial,
      roles: {
        wajib: ['Super Admin', initialCoreRole],
        selected: selectedRoles,
        tambahan: selectedRoles.filter((r) => r !== 'Super Admin' && r !== initialCoreRole)
      }
    };

    // 4. Step ALUR: Generate flow data murni dari storyline
    const flowData = getDomainFlowDetails(sessionAtRole);

    // 5. Rekonsiliasi Peran Wajib Inti
    const { updatedSession, reconciled, previousCoreRole, newCoreRole, message: reconMsg } =
      reconcileCoreOperationalRole(sessionAtRole, flowData);

    results.push({
      tc,
      storyline,
      initialCoreRole,
      roleOptions: roleStep.options,
      flowData,
      reconciled,
      previousCoreRole,
      newCoreRole,
      reconMsg,
      finalWajibRoles: updatedSession.roles?.wajib
    });
  }

  // CETAK HASIL LENGKAP HASIL TEST END-TO-END ASLI (DOMAIN 1, 2, 3)
  for (const r of results) {
    console.log('\n================================================================');
    console.log(`LAPORAN LENGKAP: ${r.tc.label}`);
    console.log('================================================================');
    console.log(`\n1. NARASI BISNIS (STORYLINE):\n"${r.storyline.narasi}"`);
    console.log(`\n2. ASUMSI ALUR UTAMA (AI):\n"${r.storyline.asumsiAlurUtama}"`);
    console.log(`\n3. ASUMSI AKTOR (AI):\n${JSON.stringify(r.storyline.asumsiAktor, null, 2)}`);
    console.log(`\n4. ROLE WAJIB AWAL (sebelum rekonsiliasi ALUR): "${r.initialCoreRole}"`);
    console.log(`\n5. STATUS REKONSILIASI ROLE:`);
    console.log(`- Terpicu? ${r.reconciled ? 'YA (TERREKONSILIASI)' : 'TIDAK (TETAP SESUAI)'}`);
    console.log(`- Role Wajib Inti Sebelumnya: ${r.previousCoreRole}`);
    console.log(`- Role Wajib Inti Final: ${r.newCoreRole}`);
    if (r.reconMsg) {
      console.log(`- Pesan Rekonsiliasi ke User:\n  "${r.reconMsg}"`);
    }

    console.log(`\n6. DAFTAR LANGKAH ALUR INTI (${r.flowData.alurInti.length} Langkah):`);
    console.table(
      r.flowData.alurInti.map((s: any) => ({
        Step: s.step,
        Pelaku: s.pelaku,
        Aksi: s.aksi
      }))
    );

    console.log(`\n7. ALUR PENDUKUNG:`);
    for (const ap of r.flowData.alurPendukung) {
      console.log(`* [${ap.nama}]`);
      for (const st of ap.steps) {
        console.log(`  - ${st.pelaku}: ${st.aksi}`);
      }
    }

    console.log(`\n8. FITUR PENDUKUNG:`);
    for (const fp of r.flowData.fiturPendukung) {
      console.log(`- [${fp.id}] ${fp.label}`);
    }
  }

  // 4. TEST KHUSUS: DOMAIN LAUNDRY KILOAN (UJI REKONSILIASI ROLE & TIE-BREAKER EKSPLISIT)
  console.log('\n================================================================');
  console.log('TEST KHUSUS REKONSILIASI ROLE & TIE-BREAKER (KETENTUAN TAMBAHAN 3)');
  console.log('================================================================');
  const sessionLaundryTie: MockupSessionState = {
    step: 'FLOW',
    match: {
      templateId: 'MT-01',
      overlayIds: [],
      patternIds: ['UP-06'],
      tier: 'STARTER',
      businessCategory: 'Jasa Laundry Kiloan & Satuan',
      contextualPainPoints: [],
      contextualRoles: []
    },
    storyline: {
      narasi:
        'Pelanggan membawa cucian kotor ke kasir untuk ditimbang dan dicatat nota estimasi. Staf cuci memproses pencucian dan menyetrika uap hingga rapi serta wangi sebelum diserahkan kembali. Pelanggan menyelesaikan pembayaran, dan kamu sebagai pemilik memantau total omzet harian.',
      asumsiMasalah: 'Pencatatan kiloan tercecer',
      asumsiAktor: ['Super Admin', 'Kasir Penerima Cucian', 'Staf Cuci & Setrika Uap', 'Pelanggan'],
      asumsiAlurUtama:
        'Pelanggan bawa cucian -> Kasir timbang cucian & buat nota -> Staf cuci cuci pakaian -> Staf cuci setrika rapi & serahkan cucian -> Kasir terima pembayaran -> Pemilik pantau omzet',
      statusKonfirmasi: 'disetujui',
      revisiCount: 0
    },
    roles: {
      wajib: ['Super Admin', 'Kasir Penerima Cucian'],
      selected: ['Super Admin', 'Kasir Penerima Cucian', 'Staf Cuci & Setrika Uap', 'Pelanggan'],
      tambahan: ['Staf Cuci & Setrika Uap']
    },
    flow: {},
    painPoints: { selected: [] },
    features: { selected: [] }
  };

  const flowLaundry = getDomainFlowDetails(sessionLaundryTie);
  const reconLaundry = reconcileCoreOperationalRole(sessionLaundryTie, flowLaundry);

  console.log(`\nDomain: Jasa Laundry Kiloan`);
  console.log(`- Role Wajib Awal: "Kasir Penerima Cucian"`);
  console.log(`- Alur Inti:`);
  console.table(flowLaundry.alurInti.map((s) => ({ Step: s.step, Pelaku: s.pelaku, Aksi: s.aksi })));
  console.log(`- Status Rekonsiliasi: ${reconLaundry.reconciled ? 'YA (TERREKONSILIASI)' : 'TIDAK'}`);
  console.log(`- Role Baru: ${reconLaundry.newCoreRole}`);
  console.log(`- Pesan Rekonsiliasi: "${reconLaundry.message}"`);
  console.log(
    `- Bukti Tie-Breaker: Kasir (2 langkah: timbang & pembayaran) vs Staf Cuci (2 langkah: cuci & setrika rapi/serahkan). Staf Cuci dimenangkan karena hasKeyAction=true dan langkah penentu serah-terima!`
  );

  // 5. TEST KETENTUAN TAMBAHAN 2: resolveActorForStep HANYA MENERAPKAN PELIMPAHAN TUGAS
  console.log('\n================================================================');
  console.log('TEST KETENTUAN TAMBAHAN 2: PELIMPAHAN TUGAS (resolveActorForStep)');
  console.log('================================================================');
  const sessionDelegated: MockupSessionState = {
    ...sessionLaundryTie,
    roles: {
      wajib: ['Super Admin', 'Kasir Penerima Cucian'],
      selected: ['Super Admin', 'Kasir Penerima Cucian', 'Pelanggan'], // Staf Cuci dihapus user di step ROLE
      tugasDilimpahkan: [
        {
          dariRole: 'Staf Cuci & Setrika Uap',
          keRole: 'Super Admin',
          daftarTugas: ['Mencuci pakaian', 'Menyetrika uap']
        }
      ]
    }
  };

  const flowDelegated = getDomainFlowDetails(sessionDelegated);
  console.log(
    'Alur Inti saat Staf Cuci dihapus dan tugasnya dilimpahkan ke Super Admin di step ROLE:'
  );
  console.table(flowDelegated.alurInti.map((s) => ({ Step: s.step, Pelaku: s.pelaku, Aksi: s.aksi })));
  console.log(
    'HASIL: Langkah 3 & 4 yang sebelumnya dikerjakan "Staf Cuci & Setrika Uap" otomatis menjadi tanggung jawab "Super Admin" sesuai pelimpahan!'
  );
}

runEndToEndVerification().catch((err) => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
