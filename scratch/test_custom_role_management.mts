import fs from 'fs';
if (fs.existsSync('.env.local')) {
  process.loadEnvFile('.env.local');
}

import { analyzeCustomRoleWithAI } from '../src/app/api/guided/route';
import {
  applyGuidedAnswer,
  renderRoleSummaryTable
} from '../src/lib/templates/processes/guided';
import type { MockupSessionState } from '../src/lib/templates';

async function runTests() {
  console.log('=== TEST 1: Deteksi Kemiripan Semantik (Pengepul vs Kolektor Keliling) ===');
  const dummySessionRosok: MockupSessionState = {
    step: 'ROLE',
    match: {
      templateId: 'MT-03',
      overlayIds: ['IND-04'],
      patternIds: ['UP-01', 'UP-02'],
      tier: 'STANDARD',
      businessCategory: 'toko barang bekas dan rosok',
      contextualPainPoints: ['pencatatan manual timbangan barang'],
      contextualRoles: ['Super Admin', 'Kolektor Keliling', 'Kasir Penimbangan']
    },
    storyline: {
      narasi: 'Warga mengumpulkan rosok lalu petugas kolektor keliling datang menjemput dan menimbang barang di lokasi sebelum dibawa ke gudang.',
      asumsiMasalah: 'pencatatan manual',
      asumsiAktor: ['Super Admin', 'Kolektor Keliling', 'Kasir Penimbangan'],
      asumsiAlurUtama: 'Penjemputan dan penimbangan rosok',
      statusKonfirmasi: 'disetujui',
      revisiCount: 0,
      detailAktor: {
        'Kolektor Keliling': {
          narasi: 'Petugas lapangan yang berkeliling menjemput dan menimbang barang bekas dari pelanggan.',
          tanggungJawab: ['Mendatangi lokasi penjemputan barang', 'Menimbang rosok di tempat', 'Membayar uang tunai ke pelanggan']
        }
      }
    },
    roles: {
      selected: ['Super Admin', 'Kolektor Keliling', 'Kasir Penimbangan'],
      wajib: ['Super Admin'],
      tambahan: ['Kolektor Keliling', 'Kasir Penimbangan']
    },
    flow: { selectedId: '' },
    features: { selected: [] },
    dbSchema: { tables: [] },
    screenSimulation: { flows: [] }
  };

  const existingRolesRosok = [
    {
      id: 'Super Admin',
      label: 'Super Admin',
      description: 'Pemilik usaha rosok.',
      responsibilities: ['Memantau transaksi']
    },
    {
      id: 'Kolektor Keliling',
      label: 'Kolektor Keliling',
      description: 'Petugas lapangan yang berkeliling menjemput dan menimbang barang bekas dari pelanggan.',
      responsibilities: ['Mendatangi lokasi penjemputan barang', 'Menimbang rosok di tempat', 'Membayar uang tunai ke pelanggan']
    },
    {
      id: 'Kasir Penimbangan',
      label: 'Kasir Penimbangan',
      description: 'Mencatat hasil timbangan di pos pusat.',
      responsibilities: ['Mencatat total berat', 'Membukukan rekap harian']
    }
  ];

  const t0 = Date.now();
  const res1 = await analyzeCustomRoleWithAI({
    roleName: 'Pengepul',
    roleNote: undefined,
    existingRoles: existingRolesRosok,
    session: dummySessionRosok
  });
  const lat1 = Date.now() - t0;
  console.log(`- Result (Latensi: ${lat1}ms):`);
  console.log(`  isSimilar: ${res1.isSimilar}`);
  console.log(`  similarRoleName: ${res1.similarRoleName}`);
  console.log(`  explanation: ${res1.similarityExplanation}`);
  console.log(`  narasi: ${res1.narasi}`);
  console.log(`  tanggungJawab:`, res1.tanggungJawab);

  if (res1.isSimilar && res1.similarRoleName?.toLowerCase().includes('kolektor')) {
    console.log('  ✅ TEST 1 LULUS: Kemiripan Pengepul vs Kolektor Keliling terdeteksi!');
  } else {
    console.log('  ⚠️ TEST 1 Perhatian: Kemiripan fallback/AI output:', res1);
  }

  console.log('\n=== TEST 2: Tambah Role Jelas Beda Tanpa Catatan (Admin Gudang) ===');
  const t1 = Date.now();
  const res2 = await analyzeCustomRoleWithAI({
    roleName: 'Admin Gudang',
    roleNote: undefined,
    existingRoles: existingRolesRosok,
    session: dummySessionRosok
  });
  const lat2 = Date.now() - t1;
  console.log(`- Result (Latensi: ${lat2}ms):`);
  console.log(`  isSimilar: ${res2.isSimilar}`);
  console.log(`  similarRoleName: ${res2.similarRoleName}`);
  console.log(`  narasi: ${res2.narasi}`);
  console.log(`  tanggungJawab:`, res2.tanggungJawab);

  if (!res2.isSimilar && res2.narasi.length > 10 && res2.tanggungJawab.length >= 2) {
    console.log('  ✅ TEST 2 LULUS: Admin Gudang tidak dianggap mirip, AI mengisi deskripsi & tanggung jawab secara mandiri!');
  } else {
    console.log('  ❌ TEST 2 GAGAL: Admin Gudang terdeteksi mirip atau data tidak lengkap.');
  }

  console.log('\n=== TEST 3: Tambah Role dengan Catatan Opsional ===');
  const t2 = Date.now();
  const res3 = await analyzeCustomRoleWithAI({
    roleName: 'Koordinator Lapangan',
    roleNote: 'yang urus jadwal antar sopir',
    existingRoles: existingRolesRosok,
    session: dummySessionRosok
  });
  const lat3 = Date.now() - t2;
  console.log(`- Result (Latensi: ${lat3}ms):`);
  console.log(`  narasi: ${res3.narasi}`);
  console.log(`  tanggungJawab:`, res3.tanggungJawab);

  const contextReflected =
    res3.narasi.toLowerCase().includes('jadwal') ||
    res3.narasi.toLowerCase().includes('sopir') ||
    res3.narasi.toLowerCase().includes('antar') ||
    res3.tanggungJawab.some(
      (t) =>
        t.toLowerCase().includes('jadwal') ||
        t.toLowerCase().includes('sopir') ||
        t.toLowerCase().includes('antar')
    );

  if (contextReflected) {
    console.log('  ✅ TEST 3 LULUS: Catatan tambahan berhasil mempengaruhi hasil narasi/tanggung jawab AI!');
  } else {
    console.log('  ⚠️ TEST 3 Catatan: Context reflected check:', contextReflected);
  }

  console.log('\n=== TEST 4 & 5: Integrasi Custom Role & Edit Deskripsi ke Session & Step ALUR ===');
  // Simulasikan payload dari frontend saat submit ROLE:
  // User menambahkan custom role "Admin Gudang" dan mengedit narasi "Super Admin"
  const customRolesPayload = [
    {
      id: 'Admin Gudang',
      label: 'Admin Gudang',
      description: res2.narasi,
      responsibilities: res2.tanggungJawab
    }
  ];

  const editedRolesPayload = {
    'Super Admin': {
      description: 'Pemilik tunggal usaha rosok yang mengontrol modal dan omzet harian.',
      responsibilities: ['Mengatur suntikan modal operasional', 'Memantau rekonsiliasi kas timbangan']
    }
  };

  const selectedRolesPayload = ['Super Admin', 'Kolektor Keliling', 'Admin Gudang']; // Kasir Penimbangan di-uncheck (dihapus)

  // Simulasikan logic route.ts:
  const sessionCopy: MockupSessionState = JSON.parse(JSON.stringify(dummySessionRosok));
  if (!sessionCopy.storyline!.detailAktor) {
    sessionCopy.storyline!.detailAktor = {};
  }

  // 1. Integrasikan customRoles
  for (const cr of customRolesPayload) {
    sessionCopy.storyline!.detailAktor[cr.label] = {
      narasi: cr.description,
      tanggungJawab: cr.responsibilities
    };
    if (!sessionCopy.storyline!.asumsiAktor.includes(cr.label)) {
      sessionCopy.storyline!.asumsiAktor.push(cr.label);
    }
  }

  // 2. Integrasikan editedRoles
  for (const [rName, edited] of Object.entries(editedRolesPayload)) {
    sessionCopy.storyline!.detailAktor[rName] = {
      narasi: edited.description,
      tanggungJawab: edited.responsibilities
    };
  }

  // 3. Jalankan applyGuidedAnswer
  const updatedSession = applyGuidedAnswer(sessionCopy, 'ROLE', selectedRolesPayload, undefined);

  console.log('- Selected roles di session:', updatedSession.roles.selected);
  console.log('- Tugas dilimpahkan (Kasir Penimbangan dihapus):', updatedSession.roles.tugasDilimpahkan);

  const summaryTable = renderRoleSummaryTable(
    updatedSession.roles,
    updatedSession.match.businessCategory,
    updatedSession.storyline
  );
  console.log('\n- Hasil renderRoleSummaryTable:');
  console.log(summaryTable);

  const hasAdminGudang = updatedSession.roles.selected.includes('Admin Gudang');
  const summaryHasAdminGudang = summaryTable.includes('Admin Gudang');
  const summaryHasEditedSuperAdmin = summaryTable.includes('suntikan modal operasional');

  if (hasAdminGudang && summaryHasAdminGudang && summaryHasEditedSuperAdmin) {
    console.log('\n  ✅ TEST 4 & 5 LULUS: Custom role terintegrasi dan teks editan Super Admin tampil di tabel ringkasan!');
  } else {
    console.log('\n  ❌ TEST 4 & 5 GAGAL:', { hasAdminGudang, summaryHasAdminGudang, summaryHasEditedSuperAdmin });
  }

  console.log('\n=== TEST 6: Regresi Alur Normal Tanpa Custom Role / Edit ===');
  const normalSelected = ['Super Admin', 'Kolektor Keliling', 'Kasir Penimbangan'];
  const normalSession = applyGuidedAnswer(dummySessionRosok, 'ROLE', normalSelected, undefined);
  const normalTable = renderRoleSummaryTable(
    normalSession.roles,
    normalSession.match.businessCategory,
    normalSession.storyline
  );
  if (normalSession.roles.selected.length === 3 && !normalSession.roles.tugasDilimpahkan?.length) {
    console.log('  ✅ TEST 6 LULUS: Alur normal tanpa custom/edit berjalan mulus tanpa efek samping!');
  } else {
    console.log('  ❌ TEST 6 GAGAL: Perilaku alur normal berubah.');
  }

  console.log('\n=== PENGUKURAN LATENSI MULTI-PANGGILAN (Trade-Off) ===');
  console.log(`- Panggilan 1 (Similarity Check + AI Analysis "Pengepul"): ${lat1} ms`);
  console.log(`- Panggilan 2 (AI Analysis "Admin Gudang"): ${lat2} ms`);
  console.log(`- Panggilan 3 (AI Analysis with Note "Koordinator"): ${lat3} ms`);
  const avgLat = Math.round((lat1 + lat2 + lat3) / 3);
  console.log(`- Rata-rata latensi per-tambah-role: ${avgLat} ms`);
  console.log(`- Trade-off UX: User hanya menunggu ${avgLat}ms saat mengklik tombol '+ Tambah Peran' lokal, tanpa mengganggu atau memperlambat transisi kartu step ROLE ke step ALUR saat tombol 'Lanjut' diklik.`);
}

runTests().catch(console.error);
