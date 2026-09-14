import fs from 'fs';
import path from 'path';
import assert from 'assert';

const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...vals] = trimmed.split('=');
      const val = vals.join('=').trim().replace(/^["']|["']$/g, '');
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = val;
      }
    }
  }
}

import {
  compileBriefFromSession,
  generateDeterministicSimulasiDb,
  type MockupSessionState
} from '../src/lib/templates/processes/guided';

const { POST: postGenerate } = await import('../src/app/api/generate/route');

function createGenerateReq(body: any): Request {
  return new Request('http://localhost:3000/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
    body: JSON.stringify(body)
  });
}

async function runTests() {
  console.log('=== TEST SUITE: BUG GANDA & SIMULASI_DB FIX ===\n');

  // TEST 1: Audit Kontaminasi Template Legacy pada compileBriefFromSession (Cuci Mobil)
  console.log('--- TEST 1: Verifikasi Brief Cuci Mobil Tidak Tercemar Template Legacy ---');
  const sessionCuciMobil: MockupSessionState = {
    step: 'REVIEW_FINAL',
    match: {
      templateId: 'MT-20',
      overlayIds: [],
      patternIds: ['UP-06', 'UP-09'],
      tier: 'BASIC',
      businessCategory: 'Cuci Mobil & Motor'
    },
    storyline: {
      narasi: 'Pelanggan membawa mobil, kasir mencatat plat dan paket cuci salju, petugas lapangan mencuci hingga bersih kinclong, dan kasir menerima pembayaran.',
      asumsiMasalah: 'Antrean kendaraan rawan tercecer.',
      asumsiAktor: ['Super Admin', 'Kasir', 'Staf Cuci', 'Pelanggan'],
      asumsiAlurUtama: 'Mobil datang -> Dicuci -> Bayar -> Rekap harian'
    },
    roles: {
      selected: ['Super Admin', 'Kasir', 'Staf Cuci', 'Pelanggan'],
      wajib: ['Super Admin']
    },
    flow: {
      alurInti: [
        { step: 1, pelaku: 'Kasir', aksi: 'Mencatat plat nomor dan pilihan paket cuci' },
        { step: 2, pelaku: 'Staf Cuci', aksi: 'Mencuci bodi mobil dengan sabun salju dan membilas bersih' },
        { step: 3, pelaku: 'Kasir', aksi: 'Menerima pembayaran tunai atau nontunai dan mencetak nota' }
      ]
    },
    rbac: {
      modul: [
        { nama: 'Kasir & Antrean', hakAkses: { Kasir: ['create', 'read'], 'Staf Cuci': ['read'] } }
      ]
    },
    dataSchema: {
      tabel: [
        {
          nama: 'antrean_cuci',
          keterangan: 'Pencatatan kendaraan masuk',
          field: [
            { nama: 'id', tipe: 'text', keterangan: 'ID antrean' },
            { nama: 'nomor_plat', tipe: 'text', keterangan: 'Nomor plat mobil' },
            { nama: 'paket_cuci', tipe: 'text', keterangan: 'Paket cuci salju' },
            { nama: 'total_biaya', tipe: 'angka', keterangan: 'Nominal pembayaran' },
            { nama: 'status', tipe: 'text', keterangan: 'Status pengerjaan cuci' }
          ]
        }
      ]
    },
    simulasiDb: {
      contohData: {
        tabel: 'antrean_cuci',
        baris: [
          { id: 'ANT-001', nomor_plat: 'B 1234 ABC', paket_cuci: 'Paket Cuci Salju', total_biaya: 50000, status: 'Diproses' }
        ]
      },
      akunLogin: [
        { role: 'Super Admin', username: 'admin', password: 'password123', deskripsiAkses: 'Full Akses' },
        { role: 'Kasir', username: 'kasir', password: 'password123', deskripsiAkses: 'Kasir' }
      ]
    }
  };

  const briefCuci = compileBriefFromSession(sessionCuciMobil);
  console.log('Panjang Brief:', briefCuci.length, 'karakter');

  // Pastikan kata-kata template legacy TIDAK PERNAH ADA di brief
  const forbiddenPatterns = [
    'UP-06',
    'UP-09',
    'Booking-to-Checkout',
    'Asset/Inventory Lifecycle',
    'Slot yang sudah terisi tidak bisa dibooking ganda',
    'DP/uang muka mengurangi total biaya layanan',
    'Stok tidak boleh minus',
    'Disposal/Write-off',
    'Maintenance Log',
    'Double booking',
    'Pelanggan no-show'
  ];

  for (const forbidden of forbiddenPatterns) {
    assert.strictEqual(
      briefCuci.includes(forbidden),
      false,
      `Brief Kebutuhan TIDAK BOLEH mengandung konten template legacy: "${forbidden}"`
    );
  }
  console.log('✅ Brief Cuci Mobil 100% bersih dari pencemaran template legacy!\n');

  // TEST 2: Verifikasi generateDeterministicSimulasiDb untuk Toko Es Krim
  console.log('--- TEST 2: Verifikasi Data Contoh SIMULASI_DB Toko Es Krim ---');
  const sessionEsKrim: MockupSessionState = {
    step: 'SIMULASI_DB',
    match: {
      templateId: 'MT-20',
      overlayIds: [],
      patternIds: [],
      tier: 'BASIC',
      businessCategory: 'Toko Es Krim'
    },
    roles: {
      selected: ['Super Admin', 'Kasir Toko', 'Staf Pembuat Es Krim', 'Pelanggan'],
      wajib: ['Super Admin']
    },
    dataSchema: {
      tabel: [
        {
          nama: 'produk',
          keterangan: 'Daftar menu varian es krim dan topping',
          field: [
            { nama: 'id', tipe: 'text', keterangan: 'ID unik produk' },
            { nama: 'nama_varian', tipe: 'text', keterangan: 'Nama rasa es krim atau topping' },
            { nama: 'kategori', tipe: 'text', keterangan: 'Jenis item utama atau tambahan' },
            { nama: 'harga', tipe: 'angka', keterangan: 'Harga jual per cup/scoop' },
            { nama: 'status_tersedia', tipe: 'text', keterangan: 'Status aktif atau nonaktif di menu' }
          ]
        }
      ]
    }
  };

  const simDb = generateDeterministicSimulasiDb(sessionEsKrim);
  const tables = Array.isArray((simDb.contohData as any)?.tabel)
    ? (simDb.contohData as any).tabel
    : Array.isArray(simDb.contohData)
    ? simDb.contohData
    : [(simDb.contohData as any)];
  const barisContoh = tables[0]?.baris || [];
  console.log('Tabel terpilih:', tables[0]?.nama || tables[0]?.tabel);
  console.log('Baris contoh:', JSON.stringify(barisContoh, null, 2));

  // Verifikasi 1: nama_varian BUKAN nama orang ('Budi Santoso' dsb), melainkan rasa es krim
  const varianValues = barisContoh.map((r: any) => r.nama_varian);
  assert.deepStrictEqual(varianValues, ['Vanilla', 'Coklat', 'Strawberry']);
  console.log('✅ nama_varian berisi varian es krim nyata:', varianValues);

  // Verifikasi 2: kategori BUKAN "Contoh Data N", melainkan "Utama" / "Tambahan" / "Topping"
  const kategoriValues = barisContoh.map((r: any) => r.kategori);
  assert.strictEqual(kategoriValues.some((v: string) => v.includes('Contoh Data')), false);
  assert.deepStrictEqual(kategoriValues, ['Utama', 'Tambahan', 'Topping']);
  console.log('✅ kategori berisi nilai kategori nyata:', kategoriValues);

  // Verifikasi 3: status_tersedia BUKAN status transaksi ('Selesai'/'Diproses'), melainkan 'Aktif'/'Nonaktif'
  const statusValues = barisContoh.map((r: any) => r.status_tersedia);
  assert.strictEqual(statusValues.includes('Selesai'), false);
  assert.strictEqual(statusValues.includes('Diproses'), false);
  assert.deepStrictEqual(statusValues, ['Aktif', 'Nonaktif', 'Aktif']);
  console.log('✅ status_tersedia sesuai domain ketersediaan menu (Aktif/Nonaktif):', statusValues);

  // Verifikasi 4: TIDAK ADA string "Contoh Data" di seluruh baris
  const allJson = JSON.stringify(barisContoh);
  assert.strictEqual(allJson.includes('Contoh Data'), false, 'Tidak boleh ada placeholder "Contoh Data"');
  console.log('✅ 0% placeholder generik "Contoh Data" ditemukan di SIMULASI_DB!\n');

  // TEST 3: Verifikasi Guard REVIEW_FINAL pada /api/generate
  console.log('--- TEST 3: Verifikasi Guard REVIEW_FINAL pada /api/generate ---');
  
  // A. Sesi disetujui (nextSession dari approve_prototype): WAJIB LOLOS GUARD
  const approvedSession = {
    ...sessionCuciMobil,
    statusKonfirmasi: 'disetujui',
    reviewFinalApproved: true,
    compiledBrief: briefCuci
  };

  const resApproved = await postGenerate(createGenerateReq({
    prompt: 'Saya menyetujui Brief Kebutuhan ini. Silakan buatkan prototipe aplikasinya sekarang.',
    stage: 'TAHAP_2_MOCKUP',
    mode: 'BUILD',
    sessionState: approvedSession
  }));

  const dataApproved = await resApproved.clone().json().catch(() => ({}));
  const isBlockedApproved = resApproved.status === 400 && Boolean(dataApproved.needsGuidedInterview);
  console.log('Status HTTP approvedSession:', resApproved.status);
  console.log('Guard blocked?:', isBlockedApproved);
  assert.strictEqual(isBlockedApproved, false, 'Sesi approved WAJIB lolos guard!');
  console.log('✅ Approved session sukses melewati guard!\n');

  // B. Pesan persetujuan resmi saat session di REVIEW_FINAL (bahkan jika flag terhambat): WAJIB LOLOS GUARD
  const sessionAtReviewFinal = {
    ...sessionCuciMobil,
    step: 'REVIEW_FINAL'
  };

  const resWithApprovalPrompt = await postGenerate(createGenerateReq({
    prompt: 'Saya menyetujui Brief Kebutuhan ini. Silakan buatkan prototipe aplikasinya sekarang.',
    stage: 'TAHAP_2_MOCKUP',
    mode: 'BUILD',
    sessionState: sessionAtReviewFinal
  }));

  const dataPrompt = await resWithApprovalPrompt.clone().json().catch(() => ({}));
  const isBlockedPrompt = resWithApprovalPrompt.status === 400 && Boolean(dataPrompt.needsGuidedInterview);
  console.log('Status HTTP approval prompt:', resWithApprovalPrompt.status);
  console.log('Guard blocked?:', isBlockedPrompt);
  assert.strictEqual(isBlockedPrompt, false, 'Approval prompt di REVIEW_FINAL WAJIB lolos guard!');
  console.log('✅ Sesi REVIEW_FINAL dengan pesan persetujuan resmi lolos guard!\n');

  // C. Permintaan prematur di step ROLE: WAJIB TETAP DIBLOKIR GUARD
  const sessionPrematur = {
    ...sessionCuciMobil,
    step: 'ROLE'
  };

  const resPrematur = await postGenerate(createGenerateReq({
    prompt: 'buatkan prototipe sekarang',
    stage: 'TAHAP_2_MOCKUP',
    mode: 'BUILD',
    sessionState: sessionPrematur
  }));

  const dataPrematur = await resPrematur.json();
  assert.strictEqual(resPrematur.status, 400);
  assert.strictEqual(dataPrematur.needsGuidedInterview, true);
  assert.strictEqual(dataPrematur.currentStep, 'ROLE');
  console.log('✅ Permintaan prematur di step ROLE berhasil ditolak guard dengan tepat!\n');

  console.log('🎉 SEMUA TEST SUITE LOLOS 100%!');
}

runTests().catch((err) => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
