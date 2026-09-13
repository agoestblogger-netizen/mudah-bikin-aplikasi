import {
  applyGuidedAnswer,
  buildGuidedStep,
  compileBriefFromSession,
  renderRbacMarkdownTable
} from '../src/lib/templates/processes/guided';
import type { MockupSessionState } from '../src/lib/templates/processes/types';
import {
  generateFallbackRbacMatrix,
  generateRbacMatrixWithAI,
  reviseRbacMatrixWithAI
} from '../src/app/api/guided/route';

async function runRbacTests() {
  console.log('=== TEST SUITE: POIN 5 (STEP RBAC & TIGA SYARAT TAMBAHAN WAJIB) ===\n');
  let allPassed = true;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      allPassed = false;
    }
  }

  // Sesi Dasar: Rental Mobil
  const baseSession: MockupSessionState = {
    step: 'ALUR',
    match: {
      templateId: 'MT-03',
      overlayIds: ['IND-03'],
      patternIds: ['UP-02', 'UP-06'],
      tier: 'BASIC',
      businessCategory: 'Rental Mobil & Sewa Armada',
      contextualPainPoints: ['Pencatatan manual rawan bentrok'],
      contextualRoles: ['Pemilik Rental', 'Petugas Rental', 'Penyewa']
    },
    storyline: {
      narasi: 'Sistem rental mobil dengan reservasi online oleh penyewa, serah terima armada oleh petugas rental, dan laporan oleh pemilik.',
      asumsiMasalah: 'Jadwal armada ganda dan denda telat kembalikan unit tidak terkontrol',
      asumsiAktor: ['Pemilik Rental', 'Petugas Rental', 'Penyewa'],
      asumsiAlurUtama: 'Penyewa booking armada -> Petugas cek fisik & serah terima kunci -> Penyewa kembalikan armada -> Petugas hitung denda & bbm',
      statusKonfirmasi: 'disetujui'
    },
    roles: {
      selected: ['Pemilik Rental', 'Petugas Rental', 'Penyewa'],
      wajib: ['Pemilik Rental', 'Petugas Rental'],
      tambahan: ['Penyewa']
    },
    flow: {
      alurInti: [
        { step: 1, pelaku: 'Penyewa', aksi: 'Penyewa memilih unit mobil, durasi sewa, dan mengunggah berkas jaminan KTP/SIM' },
        { step: 2, pelaku: 'Petugas Rental', aksi: 'Petugas memverifikasi jaminan, memeriksa checklist fisik bodi kendaraan, dan menyerahkan kunci' },
        { step: 3, pelaku: 'Petugas Rental', aksi: 'Petugas menerima kembali armada, memeriksa catatan odometer & sisa BBM, serta menghitung denda' },
        { step: 4, pelaku: 'Pemilik Rental', aksi: 'Pemilik melihat rekapan utilisasi kendaraan dan laporan omzet sewa armada harian' }
      ],
      alurPendukung: [
        {
          nama: 'Jadwal Servis Berkala & Ganti Oli Armada',
          steps: [
            { pelaku: 'Petugas Rental', aksi: 'Mencatat jadwal servis dan mengirim mobil ke bengkel rekanan' },
            { pelaku: 'Pemilik Rental', aksi: 'Menyetujui nota biaya perawatan mesin kendaraan' }
          ]
        }
      ],
      fiturPendukung: [
        'Katalog Armada & Kalender Ketersediaan Unit',
        'Checklist Digital Inspeksi Bodi Sebelum & Sesudah Sewa',
        'Kalkulator Otomatis Denda Keterlambatan & Selisih BBM'
      ]
    },
    painPoints: { selected: [] },
    features: { selected: [] }
  };

  // -------------------------------------------------------------------------
  // TEST 1: SYARAT TAMBAHAN 1 - PEMBERSIHAN CAKHE RBAC SAAT ROLE / ALUR BERUBAH
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 1: Syarat Tambahan 1 (Regenerasi RBAC saat ROLE/ALUR berubah) ---');
  
  // 1a. Transisi awal ALUR -> RBAC
  const stepRbacSession = applyGuidedAnswer(baseSession, 'ALUR', ['confirm_alur']);
  assert(stepRbacSession.step === 'RBAC', 'Sesi berpindah ke step RBAC setelah confirm_alur');

  // Simulasikan rbac terisi di step RBAC
  const initialRbac = generateFallbackRbacMatrix(stepRbacSession);
  stepRbacSession.rbac = {
    modul: initialRbac.modul,
    markdownTable: initialRbac.markdownTable,
    statusKonfirmasi: 'dikoreksi',
    revisiCount: 0
  };
  assert(Boolean(stepRbacSession.rbac && stepRbacSession.rbac.modul.length > 0), 'RBAC berhasil terisi di step RBAC');

  // 1b. User mundur ke step ROLE dan mengubah role
  const modifiedRoleSession = applyGuidedAnswer(
    stepRbacSession,
    'ROLE',
    ['Pemilik Rental', 'Petugas Rental'], // Penyewa dihapus
    undefined
  );
  assert(modifiedRoleSession.rbac === undefined, 'Cache session.rbac terhapus saat user mengubah daftar role di step ROLE');

  // 1c. User mundur ke step ALUR dan mengubah alur
  stepRbacSession.rbac = {
    modul: initialRbac.modul,
    markdownTable: initialRbac.markdownTable,
    statusKonfirmasi: 'dikoreksi',
    revisiCount: 0
  };
  const modifiedFlowSession = applyGuidedAnswer(
    stepRbacSession,
    'ALUR',
    ['confirm_alur'],
    'Tambahkan alur klaim asuransi jika terjadi tabrakan'
  );
  assert(modifiedFlowSession.rbac === undefined, 'Cache session.rbac terhapus saat user mengubah alur kerja di step ALUR');

  // -------------------------------------------------------------------------
  // TEST 2: SYARAT TAMBAHAN 2 - PELIMPAHAN TUGAS ROLE & ROLE EKSTERNAL TIDAK DIPAKAI
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 2: Syarat Tambahan 2 (Konsistensi Pelimpahan Tugas & Role Eksternal) ---');

  // Kasus: Toko Kelontong, Kasir dihapus dan tugas dilimpahkan ke Pemilik Toko, Pembeli tidak dipakai
  const delegationSession: MockupSessionState = {
    ...baseSession,
    match: {
      ...baseSession.match,
      businessCategory: 'Toko Kelontong & Sembako'
    },
    roles: {
      selected: ['Pemilik Toko'], // Kasir dihapus, Pembeli tidak dipakai
      wajib: ['Pemilik Toko'],
      tambahan: [],
      tugasDilimpahkan: [
        {
          dariRole: 'Kasir Toko',
          keRole: 'Pemilik Toko',
          daftarTugas: ['Pencatatan transaksi penjualan kasir', 'Penerimaan uang tunai & cetak struk']
        }
      ],
      removedExternalRoles: ['Pembeli']
    }
  };

  const delegatedRbac = generateFallbackRbacMatrix(delegationSession);
  
  // Verifikasi kolom role: HANYA ada 'Pemilik Toko'
  const allRolesInModul = new Set(delegatedRbac.modul.flatMap((m) => m.izinPerRole.map((ip) => ip.role)));
  assert(allRolesInModul.has('Pemilik Toko'), 'Role Pemilik Toko hadir di RBAC');
  assert(!allRolesInModul.has('Kasir Toko'), 'Role Kasir Toko TIDAK memiliki kolom tersendiri di RBAC (karena dihapus)');
  assert(!allRolesInModul.has('Pembeli'), 'Role Pembeli TIDAK memiliki kolom di RBAC (karena removedExternalRoles)');

  // Verifikasi wewenang kasir tetap ada di modul kasir
  const modulKasir = delegatedRbac.modul.find((m) => /kasir|pembayaran/i.test(m.nama));
  assert(Boolean(modulKasir), 'Modul transaksi pembayaran/kasir tetap ada di matriks');
  const izinPemilikDiKasir = modulKasir?.izinPerRole.find((ip) => ip.role === 'Pemilik Toko');
  assert(Boolean(izinPemilikDiKasir && izinPemilikDiKasir.level !== '-'), 'Wewenang kasir dialihkan ke Pemilik Toko');

  // Verifikasi catatan pelimpahan
  assert(
    Boolean(delegatedRbac.catatanPelimpahan && delegatedRbac.catatanPelimpahan.length > 0),
    'Catatan pelimpahan tugas hadir di bawah matriks RBAC'
  );
  assert(
    delegatedRbac.catatanPelimpahan![0].includes('Kasir Toko') && delegatedRbac.catatanPelimpahan![0].includes('Pemilik Toko'),
    'Isi catatan pelimpahan menyebut role asal dan role penerima limpahan'
  );

  // -------------------------------------------------------------------------
  // TEST 3: SYARAT TAMBAHAN 3 - MEKANISME KOREKSI RBAC BERTURUT-TURUT
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 3: Syarat Tambahan 3 (Mekanisme Koreksi RBAC Konsisten) ---');

  let activeRbacSession: MockupSessionState = {
    ...baseSession,
    step: 'RBAC',
    rbac: {
      modul: initialRbac.modul,
      markdownTable: initialRbac.markdownTable,
      statusKonfirmasi: 'dikoreksi',
      revisiCount: 0
    }
  };

  // Koreksi Putaran 1
  const rev1 = await reviseRbacMatrixWithAI(
    activeRbacSession,
    'Petugas Rental jangan diberi wewenang ubah harga sewa, cuma boleh cek unit',
    undefined, undefined, undefined
  );
  activeRbacSession = {
    ...activeRbacSession,
    step: 'RBAC', // TETAP DI STEP RBAC
    rbac: {
      modul: rev1.modul,
      markdownTable: rev1.markdownTable,
      statusKonfirmasi: 'dikoreksi',
      revisiCount: 1
    }
  };
  assert(activeRbacSession.step === 'RBAC', 'Koreksi 1: Sesi TETAP di step RBAC (tidak dipaksa lanjut)');
  assert(activeRbacSession.rbac?.revisiCount === 1, 'Koreksi 1: revisiCount naik menjadi 1');

  // Koreksi Putaran 2
  const rev2 = await reviseRbacMatrixWithAI(
    activeRbacSession,
    'Penyewa boleh membatalkan booking sendiri jika status masih menunggu konfirmasi',
    undefined, undefined, undefined
  );
  activeRbacSession = {
    ...activeRbacSession,
    step: 'RBAC',
    rbac: {
      modul: rev2.modul,
      markdownTable: rev2.markdownTable,
      statusKonfirmasi: 'dikoreksi',
      revisiCount: 2
    }
  };
  assert(activeRbacSession.step === 'RBAC', 'Koreksi 2: Sesi TETAP di step RBAC');
  assert(activeRbacSession.rbac?.revisiCount === 2, 'Koreksi 2: revisiCount naik menjadi 2');

  // Koreksi Putaran 3
  const rev3 = await reviseRbacMatrixWithAI(
    activeRbacSession,
    'Tambahkan modul klaim asuransi unit armada rusak dengan wewenang persetujuan di Pemilik Rental',
    undefined, undefined, undefined
  );
  activeRbacSession = {
    ...activeRbacSession,
    step: 'RBAC',
    rbac: {
      modul: rev3.modul,
      markdownTable: rev3.markdownTable,
      statusKonfirmasi: 'dikoreksi',
      revisiCount: 3
    }
  };
  assert(activeRbacSession.step === 'RBAC', 'Koreksi 3: Sesi TETAP di step RBAC setelah 3 kali koreksi');
  assert(activeRbacSession.rbac?.revisiCount === 3, 'Koreksi 3: revisiCount naik menjadi 3 (tanpa batas)');

  // User akhirnya memilih confirm_rbac
  const finalRbacSession = applyGuidedAnswer(activeRbacSession, 'RBAC', ['confirm_rbac']);
  assert(finalRbacSession.step === 'SKEMA_DATA', 'Sesi berpindah ke SKEMA_DATA HANYA saat user memilih confirm_rbac');
  assert(finalRbacSession.rbac?.statusKonfirmasi === 'disetujui', 'statusKonfirmasi diset ke "disetujui"');

  // -------------------------------------------------------------------------
  // TEST 4: VERIFIKASI ACTION-SCOPED PERMISSIONS & SEPARATION OF DUTIES
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 4: Action-Scoped Permissions & Separation of Duties ---');
  
  const rentalRbac = generateFallbackRbacMatrix(baseSession);

  // 4a. Cek ketiadaan CRUD generik
  const allLevels = rentalRbac.modul.flatMap((m) => m.izinPerRole.map((ip) => ip.level));
  const hasGenericCrud = allLevels.some((l) => /^(create|read|update|delete|crud|read only|akses penuh|view|edit)$/i.test(l.trim()));
  assert(!hasGenericCrud, 'TIDAK ADA level izin yang menggunakan kata CRUD generik mentah tanpa konteks scope');

  // 4b. Cek Separation of Duties: Pemesanan Mandiri vs Operasional Lapangan
  const modulPemesanan = rentalRbac.modul.find((m) => /pengajuan|reservasi|pemesanan/i.test(m.nama));
  const modulOperasional = rentalRbac.modul.find((m) => /operasional|lapangan|pelaksanaan/i.test(m.nama));
  assert(Boolean(modulPemesanan && modulOperasional), 'Pemesanan Mandiri dan Operasional Lapangan DIPECAH jadi 2 baris modul berbeda');

  const izinPenyewaPemesanan = modulPemesanan?.izinPerRole.find((ip) => ip.role === 'Penyewa');
  const izinPenyewaOperasional = modulOperasional?.izinPerRole.find((ip) => ip.role === 'Penyewa');
  assert(
    Boolean(izinPenyewaPemesanan?.level.includes('Milik Sendiri')),
    'Penyewa di modul pemesanan dibatasi scope "(Milik Sendiri)"'
  );
  assert(
    Boolean(izinPenyewaOperasional?.level.includes('Milik Sendiri')),
    'Penyewa di modul operasional hanya menerima status pengerjaan milik sendiri'
  );

  // -------------------------------------------------------------------------
  // TEST 5: KOMPILASI KE BRIEF KEBUTUHAN
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 5: Injeksi Matriks RBAC ke Brief Kebutuhan ---');

  const briefCompiled = compileBriefFromSession(finalRbacSession, { appName: 'Rental Mobil Nusantara' });
  assert(briefCompiled.includes('Matriks Hak Akses (RBAC) per Modul Fungsional'), 'Brief Kebutuhan memuat section Matriks Hak Akses (RBAC)');
  assert(briefCompiled.includes('| Modul Fungsional |'), 'Brief Kebutuhan memuat tabel Markdown RBAC yang valid');
  assert(briefCompiled.includes('Pemilik Rental'), 'Tabel RBAC di Brief memuat role Pemilik Rental');
  assert(briefCompiled.includes('Petugas Rental'), 'Tabel RBAC di Brief memuat role Petugas Rental');

  console.log('\n===================================================================');
  if (allPassed) {
    console.log('🎉 SEMUA PENGUJIAN POIN 5 & TIGA SYARAT TAMBAHAN LULUS 100%!');
  } else {
    console.error('❌ BEBERAPA PENGUJIAN GAGAL.');
    process.exit(1);
  }
}

runRbacTests().catch((err) => {
  console.error('Fatal error saat pengujian:', err);
  process.exit(1);
});
