import assert from 'assert';
import {
  generateRoleModuleChecklist,
  buildRbacStep,
  isSemanticModuleMatch,
  deriveModuleNameFromAction
} from '../src/lib/templates/processes/guided';
import type {
  MockupSessionState,
  RoleModuleChecklistGroup,
  RoleModuleChecklistItem
} from '../src/lib/templates/processes/types';

export async function runRoleModuleChecklistTest() {
  console.log('=== TEST SUITE: CHECKLIST MODUL / FORM PER ROLE (STEP RBAC) ===\n');

  // 1. Uji deriveModuleNameFromAction dan isSemanticModuleMatch
  console.log('--- TEST 1: Heuristik Nama Modul & Kesetaraan Semantik ---');
  const mod1 = deriveModuleNameFromAction('Pelanggan mengisi form booking paket cuci kiloan');
  console.log(`  Derived from action: "${mod1}"`);
  assert(mod1.length > 0, 'Harus berhasil mengekstrak nama modul dari aksi');

  const isMatch1 = isSemanticModuleMatch('Booking Layanan', 'Pemesanan Paket Cuci');
  assert(isMatch1 === true, 'Booking Layanan dan Pemesanan Paket Cuci harus dianggap semantik serupa');

  const isMatch2 = isSemanticModuleMatch('Pembayaran Kasir', 'Pemeriksaan Mutu Cucian');
  assert(isMatch2 === false, 'Pembayaran Kasir dan Pemeriksaan Mutu Cucian tidak boleh dianggap cocok');
  console.log('  ✅ PASS: Heuristik penamaan dan kesetaraan semantik bekerja dengan tepat.');

  // 2. Uji generateRoleModuleChecklist dengan Alur + Referensi Lazim Industri
  console.log('\n--- TEST 2: Derivasi Checklist Modul per Role dari Alur & Referensi Lazim ---');

  const dummySession: MockupSessionState = {
    step: 'ALUR',
    match: {
      templateId: 'laundry_kiloan',
      tier: 'BASIC' as const,
      businessCategory: 'Jasa Laundry Kiloan & Satuan',
      patternIds: ['CORE_OPERATIONAL', 'PAYMENT_GATE'],
      overlayIds: ['SERVICE_BASED']
    },
    roles: {
      selected: ['Pelanggan', 'Kasir', 'Staf Pencuci', 'Super Admin'],
      removedExternalRoles: []
    },
    flow: {
      alurInti: [
        { step: 1, pelaku: 'Pelanggan', aksi: 'Menyerahkan pakaian kotor di kasir' },
        { step: 2, pelaku: 'Kasir', aksi: 'Menimbang pakaian dan mencetak nota transaksi kasir' },
        { step: 3, pelaku: 'Staf Pencuci', aksi: 'Mencuci dan mengeringkan pakaian sesuai instruksi nota' },
        { step: 4, pelaku: 'Kasir', aksi: 'Menerima pembayaran tunai atau QRIS dari pelanggan' },
        { step: 5, pelaku: 'Pelanggan', aksi: 'Mengambil pakaian bersih dan menerima bukti lunas' }
      ]
    },
    domainProfile: {
      modelOperasional: 'DI_TEMPAT' as const,
      modelTarif: 'BERAT_TIMBANGAN' as const,
      adaJaminanDeposit: false,
      entitasKatalogMaster: ['Paket Layanan Cuci', 'Daftar Parfum'],
      entitasPencatatanTransaksi: ['Transaksi Kasir', 'Nota Order'],
      komponenBiayaYangLazim: ['Biaya Cuci per Kg', 'Biaya Setrika'],
      referensiAlurKerjaLazim: [
        {
          role: 'Kasir',
          modul: [
            { nama: 'Penimbangan & Penerimaan Cucian', deskripsi: 'Pencatatan berat dan detail kain masuk' },
            { nama: 'Kasir & Pembayaran POS', deskripsi: 'Penerimaan pembayaran kasir dan cetak struk' },
            { nama: 'Form Komplain & Klaim Pakaian Rusak', deskripsi: 'Pencatatan komplain pakaian luntur atau hilang' }
          ]
        },
        {
          role: 'Staf Pencuci',
          modul: [
            { nama: 'Pelaksanaan Cuci & Kering', deskripsi: 'Operasional mesin cuci dan pengering' },
            { nama: 'Pemeriksaan Mutu Cucian (Quality Check)', deskripsi: 'Pengecekan kebersihan noda sebelum packing' }
          ]
        }
      ]
    },
    painPoints: { selected: ['pencatatan manual lambat', 'sulit pantau status cucian'] },
    features: { selected: [] }
  };


  const checklist = generateRoleModuleChecklist(dummySession);

  // Verifikasi grup per role
  assert(Array.isArray(checklist), 'Hasil checklist harus berupa array grup');
  assert(checklist.length === 4, `Jumlah grup harus sesuai role aktif (4), didapat: ${checklist.length}`);

  const kasirGroup = checklist.find((g) => g.role === 'Kasir');
  assert(Boolean(kasirGroup), 'Grup Kasir harus ditemukan');

  // Item yang tersirat dari alur harus default checked = true
  const alurItem = kasirGroup!.items.find((it) => it.termasukDiAlur);
  assert(Boolean(alurItem), 'Kasir harus memiliki modul yang berasal dari alur');
  assert(alurItem!.checked === true, 'Modul dari alur harus DEFAULT TERCENTANG');
  assert(alurItem!.disarankan === false, 'Modul dari alur tidak bertanda disarankan');

  // Item referensi lazim yang belum tersirat di alur harus default checked = false dan disarankan = true
  const komplainItem = kasirGroup!.items.find((it) => it.nama.includes('Komplain'));
  assert(Boolean(komplainItem), 'Modul Komplain dari referensi lazim harus ada di Kasir');
  assert(komplainItem!.checked === false, 'Modul rekomendasi industri harus DEFAULT TIDAK TERCENTANG');
  assert(komplainItem!.disarankan === true, 'Modul rekomendasi industri harus bertanda disarankan');
  assert(komplainItem!.termasukDiAlur === false, 'Modul rekomendasi industri tidak bertanda termasukDiAlur');

  // Super Admin / Pemilik harus memiliki master data & laporan
  const adminGroup = checklist.find((g) => g.role === 'Super Admin');
  assert(Boolean(adminGroup), 'Grup Super Admin harus ada');
  const masterItem = adminGroup!.items.find((it) => it.nama.toLowerCase().includes('master'));
  const reportItem = adminGroup!.items.find((it) => it.nama.toLowerCase().includes('laporan'));
  assert(Boolean(masterItem), 'Super Admin harus memiliki modul data master');
  assert(Boolean(reportItem), 'Super Admin harus memiliki modul laporan operasional');
  assert(masterItem!.checked === true, 'Modul master admin harus default tercentang');
  assert(reportItem!.checked === true, 'Modul laporan admin harus default tercentang');

  console.log('  ✅ PASS: Derivasi modul alur vs modul rekomendasi industri per role valid 100%.');

  // 3. Uji Preservasi Modul Custom saat Re-generasi Checklist
  console.log('\n--- TEST 3: Preservasi Modul Custom yang Ditambahkan Pengguna ---');
  const customModule: RoleModuleChecklistItem = {
    id: 'mod_custom_123',
    nama: 'Inspeksi Parfum Khusus',
    deskripsi: 'Pengecekan aroma pakaian sebelum serah terima',
    role: 'Staf Pencuci',
    termasukDiAlur: false,
    disarankan: false,
    checked: true,
    isCustom: true
  };

  const sessionWithCustom: MockupSessionState = {
    ...dummySession,
    rbac: {
      modul: [],
      stage: 'CHECKLIST',
      checklistPerRole: [
        {
          role: 'Staf Pencuci',
          items: [customModule]
        }
      ]
    }
  };

  const reChecklist = generateRoleModuleChecklist(sessionWithCustom);
  const reStafPencuci = reChecklist.find((g) => g.role === 'Staf Pencuci');
  assert(Boolean(reStafPencuci), 'Grup Staf Pencuci harus ada');
  const preservedCustom = reStafPencuci!.items.find((it) => it.nama === 'Inspeksi Parfum Khusus');
  assert(Boolean(preservedCustom), 'Modul custom user harus dipertahankan saat re-generasi');
  assert(preservedCustom!.isCustom === true, 'Modul custom harus tetap bertanda isCustom: true');
  assert(preservedCustom!.checked === true, 'Modul custom harus tetap tercentang');
  console.log('  ✅ PASS: Modul custom yang ditambahkan pengguna berhasil dipreservasi.');

  // 4. Uji buildRbacStep stage CHECKLIST vs MATRIX
  console.log('\n--- TEST 4: Struktur Payload GuidedStep untuk Stage CHECKLIST vs MATRIX ---');
  const checklistStep = buildRbacStep(sessionWithCustom);
  assert(checklistStep.rbacStage === 'CHECKLIST', 'rbacStage harus bernilai CHECKLIST saat belum ada modul matriks');
  assert(Boolean(checklistStep.roleModuleChecklist), 'roleModuleChecklist harus disertakan di step payload');
  assert(checklistStep.options.some((o) => o.id === 'confirm_role_modules'), 'Harus menyertakan tombol konfirmasi modul');

  const sessionWithMatrix: MockupSessionState = {
    ...sessionWithCustom,
    rbac: {
      stage: 'MATRIX',
      modul: [
        {
          nama: 'Kasir & Pembayaran POS',
          deskripsiFungsional: 'Pencatatan kasir',
          izinPerRole: [{ role: 'Kasir', level: 'CRUD Penuh' }]
        }
      ]
    }
  };

  const matrixStep = buildRbacStep(sessionWithMatrix);
  assert(matrixStep.rbacStage === 'MATRIX', 'rbacStage harus bernilai MATRIX');
  assert(matrixStep.options.some((o) => o.id === 'confirm_rbac'), 'Harus ada tombol konfirmasi rbac');
  assert(matrixStep.options.some((o) => o.id === 'reopen_module_checklist'), 'Harus ada tombol buka kembali checklist');

  console.log('  ✅ PASS: Transisi stage CHECKLIST dan MATRIX di buildRbacStep valid.');

  console.log('\n========================================================================');
  console.log('🎉 SEMUA TEST CHECKLIST MODUL PER ROLE (RBAC STEP) LOLOS DENGAN SUKSES!');
  console.log('========================================================================\n');
}

if (require.main === module) {
  runRoleModuleChecklistTest().catch((err) => {
    console.error('Test error:', err);
    process.exit(1);
  });
}
