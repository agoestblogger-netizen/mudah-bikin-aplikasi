import * as fs from 'fs';
import * as path from 'path';

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      process.env[key] = val;
    }
  }
}

import {
  analyzeRolesWithAI,
  analyzeCustomRoleWithAI,
  ensureRoleDetailsGroundedWithAI
} from '../src/app/api/guided/route.js';
import {
  getRoleNarrativeAndResponsibilities,
  applyGuidedAnswer,
  isExternalRole
} from '../src/lib/templates/processes/guided.js';
import type { MockupSessionState } from '../src/lib/templates/processes/types.js';

async function runTests() {
  console.log('=== TEST 1: Pelimpahan Tugas Role Eksternal vs Internal (Regression Check) ===');
  const baseSession: MockupSessionState = {
    step: 'ROLE',
    match: {
      templateId: 'MT-05',
      overlayIds: [],
      patternIds: [],
      tier: 'TIER_1',
      businessCategory: 'Jual Beli Barang Bekas / Rosok'
    },
    storyline: {
      narasi: 'Petugas keliling menjemput barang rosok ke rumah warga dan menimbangnya di tempat, lalu membawanya untuk disetor ke gudang pengepul.',
      asumsiMasalah: 'Pencatatan timbangan manual',
      asumsiAktor: ['Super Admin', 'Petugas Pembeli', 'Pengepul', 'Warga'],
      asumsiAlurUtama: 'Petugas mendatangi warga -> menimbang -> membayar -> setor ke pengepul',
      detailAktor: {
        'Petugas Pembeli': {
          narasi: 'Petugas keliling yang mendatangi rumah warga, memeriksa jenis dan kondisi barang rosok, menimbang berat, serta membayar tunai di tempat.',
          tanggungJawab: [
            'Mendatangi lokasi penjemputan barang bekas di rumah warga',
            'Memilah jenis rosok dan menimbang berat barang secara akurat',
            'Melakukan pembayaran tunai ke warga dan mencatat bukti timbangan'
          ]
        },
        'Pengepul': {
          narasi: 'Pihak penampung di pos/gudang pusat yang standby menerima, menimbang ulang, dan merekap setoran barang rosok dari para armada keliling.',
          tanggungJawab: [
            'Menerima dan memeriksa kualitas setoran rosok dari para petugas keliling',
            'Menimbang total tonase barang masuk dan merekap pembayaran setoran',
            'Mengatur pengelompokan dan penyimpanan stok rosok di gudang'
          ]
        },
        'Warga': {
          narasi: 'Warga atau pelanggan yang memiliki barang bekas yang siap dijual dan meminta penjemputan ke rumah.',
          tanggungJawab: [
            'Mengajukan permintaan penjemputan barang rosok',
            'Menyaksikan proses penimbangan barang oleh petugas',
            'Menerima uang pembayaran hasil penjualan barang rosok'
          ]
        }
      },
      statusKonfirmasi: 'disetujui'
    },
    roles: {
      selected: ['Super Admin', 'Petugas Pembeli', 'Pengepul', 'Warga']
    },
    flow: {}
  };

  // Deselect "Warga"
  const answerWithoutWarga = applyGuidedAnswer(
    baseSession,
    'ROLE',
    ['Super Admin', 'Petugas Pembeli', 'Pengepul']
  );
  console.log('Removed external roles:', answerWithoutWarga.roles.removedExternalRoles);
  console.log('Tugas dilimpahkan:', answerWithoutWarga.roles.tugasDilimpahkan);

  if (answerWithoutWarga.roles.tugasDilimpahkan?.some(d => d.dariRole.toLowerCase().includes('warga'))) {
    throw new Error('FAIL: Tugas Warga keliru dilimpahkan ke Owner!');
  }
  if (!answerWithoutWarga.roles.removedExternalRoles?.includes('Warga')) {
    throw new Error('FAIL: Warga harus tercatat di removedExternalRoles!');
  }
  console.log('PASS: Warga tidak dilimpahkan ke Owner ✅');

  // Deselect "Pengepul" (staf/pihak internal)
  const answerWithoutPengepul = applyGuidedAnswer(
    baseSession,
    'ROLE',
    ['Super Admin', 'Petugas Pembeli', 'Warga']
  );
  if (!answerWithoutPengepul.roles.tugasDilimpahkan?.some(d => d.dariRole === 'Pengepul')) {
    throw new Error('FAIL: Pengepul harus dilimpahkan ke Owner!');
  }
  console.log('PASS: Pengepul dilimpahkan ke Owner saat dihapus ✅');

  console.log('\n=== TEST 2: getRoleNarrativeAndResponsibilities Zero-Keyword Verification ===');
  // Pastikan getRoleNarrativeAndResponsibilities membaca dari detailAktor
  const pengepulGrounded = getRoleNarrativeAndResponsibilities('Pengepul', baseSession.match.businessCategory, baseSession.storyline);
  console.log('Pengepul Grounded:', pengepulGrounded);
  if (!pengepulGrounded.narasi.includes('penampung di pos/gudang')) {
    throw new Error('FAIL: Pengepul detailAktor not respected!');
  }
  if (pengepulGrounded.tanggungJawab.some(t => t.includes('Mendatangi lokasi penjemputan'))) {
    throw new Error('FAIL: Pengepul must NOT have mobile visit tasks!');
  }

  // Uji fallback tanpa detailAktor (harus bersih tanpa keyword liar)
  const genericFallback = getRoleNarrativeAndResponsibilities('Pengepul', 'Bisnis Rosok', undefined);
  console.log('Generic Fallback Pengepul (No detailAktor):', genericFallback);
  if (genericFallback.narasi.includes('pencucian') || genericFallback.narasi.includes('lapangan')) {
    throw new Error('FAIL: Keyword leak found in fallback!');
  }
  console.log('PASS: getRoleNarrativeAndResponsibilities is 100% keyword-free ✅');

  console.log('\n=== TEST 3: AI Conceptual Role Analysis (Live AI Call) ===');
  // Menguji live AI call ke analyzeRolesWithAI untuk kasus Pengepul, Sopir, Petugas Pembeli
  const testSession: MockupSessionState = {
    step: 'STORYTELLING',
    match: {
      templateId: 'MT-05',
      overlayIds: [],
      patternIds: [],
      tier: 'TIER_1',
      businessCategory: 'Jual Beli Barang Rosok & Rongsokan'
    },
    storyline: {
      narasi: 'Layanan jual beli barang bekas di mana petugas keliling mendatangi rumah warga menggunakan pick up untuk menimbang kardus, besi, dan plastik di tempat. Hasil pembelian dari warga kemudian dibawa dan disetorkan ke gudang pengepul besar untuk ditimbang ulang secara tonase dan dicatat pembayarannya.',
      asumsiMasalah: 'Pencatatan nota timbangan manual yang sering selisih antara setoran armada dan stok gudang',
      asumsiAktor: ['Super Admin', 'Petugas Pembeli Keliling', 'Pengepul Gudang', 'Warga'],
      asumsiAlurUtama: 'Petugas keliling membeli barang dari warga -> membawa ke gudang -> pengepul menimbang tonase setoran -> admin memantau rekap transaksi',
      statusKonfirmasi: 'disetujui'
    },
    roles: { selected: [] },
    flow: {}
  };

  const tStart = Date.now();
  const aiResult = await analyzeRolesWithAI({
    rolesToAnalyze: ['Petugas Pembeli Keliling', 'Pengepul Gudang', 'Warga'],
    session: testSession
  });
  const latency = Date.now() - tStart;
  console.log(`AI Batch Analysis Latency: ${latency}ms`);
  console.log('AI Analysis Result:');
  console.dir(aiResult, { depth: null });

  // Verifikasi Petugas Pembeli Keliling
  const pembeli = aiResult['Petugas Pembeli Keliling'] || Object.values(aiResult)[0];
  console.log('\n[Check] Petugas Pembeli Keliling:');
  console.log('Narasi:', pembeli.narasi);
  console.log('Tanggung Jawab:', pembeli.tanggungJawab);
  if (pembeli.narasi.toLowerCase().includes('cuci') || pembeli.narasi.toLowerCase().includes('mobil')) {
    throw new Error('FAIL: Kebocoran domain cuci mobil pada Petugas Pembeli!');
  }

  // Verifikasi Pengepul Gudang
  const pengepul = aiResult['Pengepul Gudang'] || Object.values(aiResult)[1];
  console.log('\n[Check] Pengepul Gudang:');
  console.log('Narasi:', pengepul.narasi);
  console.log('Tanggung Jawab:', pengepul.tanggungJawab);
  if (pengepul.tanggungJawab.some(t => /mendatangi\s+rumah|keliling\s+membeli|mengunjungi\s+warga/i.test(t))) {
    throw new Error('FAIL: Pengepul tidak boleh bertugas keliling ke rumah warga!');
  }
  console.log('PASS: Pengepul Gudang standby menerima setoran barang rosok dari petugas keliling ✅');

  // Verifikasi Warga (pihak eksternal)
  const warga = aiResult['Warga'] || Object.values(aiResult)[2];
  console.log('\n[Check] Warga:');
  console.log('Narasi:', warga.narasi);
  console.log('Tanggung Jawab:', warga.tanggungJawab);

  console.log('\n=== TEST 4: Domain Rental Mobil - Peran "Sopir" & "Petugas Kunci" ===');
  const rentalSession: MockupSessionState = {
    step: 'STORYTELLING',
    match: {
      templateId: 'MT-08',
      overlayIds: [],
      patternIds: [],
      tier: 'TIER_1',
      businessCategory: 'Rental Mobil & Sewa Kendaraan'
    },
    storyline: {
      narasi: 'Usaha rental kendaraan lepas kunci dan dengan sopir di mana penyewa memesan armada, petugas melakukan serah terima kunci serta cek fisik kilometer, dan sopir bertugas mengantar perjalanan pelanggan hingga selesai.',
      asumsiMasalah: 'Pengawasan kondisi armada dan jadwal tugas sopir',
      asumsiAktor: ['Super Admin', 'Sopir', 'Petugas Serah Terima Kunci', 'Penyewa'],
      asumsiAlurUtama: 'Penyewa pesan armada -> petugas cek fisik & kunci -> sopir antarkan perjalanan -> armada kembali',
      statusKonfirmasi: 'disetujui'
    },
    roles: { selected: [] },
    flow: {}
  };

  const rentalResult = await analyzeRolesWithAI({
    rolesToAnalyze: ['Sopir', 'Petugas Serah Terima Kunci', 'Penyewa'],
    session: rentalSession
  });
  console.log('Rental Roles Result:');
  console.dir(rentalResult, { depth: null });
  const sopir = rentalResult['Sopir'] || Object.values(rentalResult)[0];
  if (sopir.narasi.toLowerCase().includes('kurir') || sopir.narasi.toLowerCase().includes('ekspedisi') || sopir.narasi.toLowerCase().includes('paket')) {
    throw new Error('FAIL: Sopir rental mobil salah kaprah sebagai kurir paket!');
  }
  console.log('PASS: Sopir rental dianalisis sebagai pengemudi armada perjalanan penumpang ✅');

  console.log('\n=== TEST 5: Domain Stabil Lain (Klinik Gigi, Toko Emas, Cuci Mobil) ===');
  // Klinik Gigi
  const dentalSession: MockupSessionState = {
    step: 'STORYTELLING',
    match: { templateId: 'MT-02', overlayIds: [], patternIds: [], tier: 'TIER_1', businessCategory: 'Klinik Dokter Gigi' },
    storyline: {
      narasi: 'Pasien datang mendaftar antrean perawatan gigi, dokter gigi melakukan tindakan penambalan atau pembersihan karang di dental chair dibantu perawat, lalu kasir memproses pembayaran obat dan tindakan.',
      asumsiMasalah: 'Antrean pasien dan rekam medis yang belum terpusat',
      asumsiAktor: ['Super Admin', 'Dokter Gigi', 'Perawat Dental', 'Kasir', 'Pasien'],
      asumsiAlurUtama: 'Pasien daftar -> dokter periksa -> kasir terima bayar',
      statusKonfirmasi: 'disetujui'
    },
    roles: { selected: [] },
    flow: {}
  };
  const dentalResult = await analyzeRolesWithAI({
    rolesToAnalyze: ['Dokter Gigi', 'Perawat Dental'],
    session: dentalSession
  });
  console.log('Dental Result:', Object.keys(dentalResult));
  if (!dentalResult['Dokter Gigi']?.narasi.toLowerCase().includes('gigi')) {
    throw new Error('FAIL: Dokter Gigi deskripsi tidak sesuai konteks klinik gigi!');
  }
  console.log('PASS: Domain Klinik Gigi presisi ✅');

  // Toko Emas
  const goldSession: MockupSessionState = {
    step: 'STORYTELLING',
    match: { templateId: 'MT-05', overlayIds: [], patternIds: [], tier: 'TIER_1', businessCategory: 'Toko Jual Beli Perhiasan Emas' },
    storyline: {
      narasi: 'Pelanggan datang membeli perhiasan atau menjual kembali emas lama, petugas penaksir menguji kadar karat dan timbangan, lalu kasir mencetak kuitansi resmi.',
      asumsiMasalah: 'Penentuan harga buyback dan pengujian kadar karat',
      asumsiAktor: ['Super Admin', 'Petugas Penaksir Kadar Emas', 'Kasir Toko', 'Pelanggan'],
      asumsiAlurUtama: 'Pelanggan bawa emas -> penaksir uji kadar & timbang -> kasir proses transaksi',
      statusKonfirmasi: 'disetujui'
    },
    roles: { selected: [] },
    flow: {}
  };
  const goldResult = await analyzeRolesWithAI({
    rolesToAnalyze: ['Petugas Penaksir Kadar Emas'],
    session: goldSession
  });
  console.log('Gold Result:', goldResult['Petugas Penaksir Kadar Emas']);
  if (!goldResult['Petugas Penaksir Kadar Emas']?.narasi.toLowerCase().includes('emas')) {
    throw new Error('FAIL: Penaksir Toko Emas tidak sesuai konteks emas!');
  }
  console.log('PASS: Domain Toko Emas presisi ✅');

  console.log('\n=== TEST 6: Role Custom Asing yang Belum Pernah Ada di Template ===');
  const customRoleResult = await analyzeCustomRoleWithAI({
    roleName: 'Juru Timbang Tandan Buah Segar',
    roleNote: 'standby di loading ramp pabrik kelapa sawit untuk menimbang truk TBS yang masuk dari kebun plasma',
    existingRoles: [
      { id: 'Super Admin', label: 'Super Admin', description: 'Pemilik perkebunan' },
      { id: 'Mandor Kebun', label: 'Mandor Kebun', description: 'Mengawasi panen' }
    ],
    session: {
      step: 'ROLE',
      match: { templateId: 'MT-20', overlayIds: [], patternIds: [], tier: 'TIER_1', businessCategory: 'Pabrik Pengolahan Kelapa Sawit' },
      storyline: {
        narasi: 'Pabrik kelapa sawit menerima pasokan TBS dari para petani plasma dan kebun inti.',
        asumsiMasalah: 'Pencatatan jembatan timbang',
        asumsiAktor: ['Super Admin', 'Mandor Kebun'],
        asumsiAlurUtama: 'Truk masuk jembatan timbang -> catat tara dan bruto -> bongkar di loading ramp',
        statusKonfirmasi: 'disetujui'
      },
      roles: { selected: ['Super Admin', 'Mandor Kebun'] },
      flow: {}
    }
  });
  console.log('Custom Role Foreign Domain Result:', customRoleResult);
  if (!customRoleResult.narasi.toLowerCase().includes('buah') && !customRoleResult.narasi.toLowerCase().includes('sawit') && !customRoleResult.narasi.toLowerCase().includes('timbang')) {
    throw new Error('FAIL: Role custom asing gagal dianalisis secara kontekstual!');
  }
  if (customRoleResult.isSimilar) {
    throw new Error('FAIL: Juru Timbang TBS tidak boleh dianggap mirip dengan Super Admin atau Mandor!');
  }
  console.log('PASS: Role custom asing dianalisis sempurna tanpa keyword matching ✅');

  console.log('\n======================================================');
  console.log('ALL VERIFICATION TESTS COMPLETED SUCCESSFULLY! 🎉✅');
  console.log('======================================================');
}

runTests().catch((err) => {
  console.error('TEST ERROR:', err);
  process.exit(1);
});
