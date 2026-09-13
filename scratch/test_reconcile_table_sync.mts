import fs from 'fs';
import path from 'path';

// Baca .env.local jika ada
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

const { POST } = await import('../src/app/api/guided/route');
const { renderRoleSummaryTable, reconcileCoreOperationalRole } = await import(
  '../src/lib/templates/processes/guided'
);

function createMockReq(body: any): Request {
  return new Request('http://localhost:3000/api/guided', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-token'
    },
    body: JSON.stringify(body)
  });
}

async function runTests() {
  console.log('=== MEMULAI TEST SINKRONISASI TABEL RINGKASAN ROLE & REKONSILIASI ===\n');

  // -------------------------------------------------------------
  // SKENARIO 1: Domain E-Commerce yang memicu rekonsiliasi Kurir jadi Wajib (Alur Inti)
  // -------------------------------------------------------------
  console.log('--- SKENARIO 1: Rekonsiliasi Kurir menjadi Wajib (Alur Inti) ---');

  const ecommerceSession: any = {
    step: 'ROLE',
    match: {
      templateId: 'MT-03',
      patternIds: ['UP-01', 'UP-06'],
      tier: 'BASIC',
      businessCategory: 'Toko Online & E-Commerce Retail',
      contextualRoles: ['Super Admin', 'Staf Gudang', 'Kurir', 'Pelanggan']
    },
    storyline: {
      narasi:
        'Pelanggan memesan produk secara online. Staf gudang menyiapkan dan mengemas barang pesanan. Kurir mengambil paket dan mengantarkannya langsung ke alamat pelanggan.',
      asumsiMasalah: 'Pengelolaan stok dan pelacakan pengiriman manual',
      asumsiAktor: ['Super Admin', 'Staf Gudang', 'Kurir', 'Pelanggan'],
      asumsiAlurUtama:
        'Pelanggan checkout pesanan -> Staf gudang kemas barang -> Kurir antarkan paket sampai ke tangan penerima -> Super Admin cek status pengiriman selesai',
      statusKonfirmasi: 'disetujui',
      revisiCount: 0
    },
    roles: {
      selected: ['Super Admin', 'Staf Gudang', 'Kurir', 'Pelanggan'],
      wajib: ['Super Admin', 'Staf Gudang'], // Awalnya Staf Gudang yang disangka role wajib
      tambahan: ['Kurir', 'Pelanggan']
    }
  };

  const req1 = createMockReq({
    action: 'NEXT',
    stepId: 'ROLE',
    session: ecommerceSession,
    selected: ['Super Admin', 'Staf Gudang', 'Kurir', 'Pelanggan']
  });

  const res1 = await POST(req1);
  const data1 = await res1.json();
  const narasi1 = data1.narration || '';

  console.log('[Skenario 1] Narasi yang dihasilkan:\n', narasi1);

  // Ambil tabel dari narasi
  const tableMatch1 = narasi1.match(/\| Peran \|[\s\S]*?\n\n/);
  const tableStr1 = tableMatch1 ? tableMatch1[0] : '';
  console.log('[Skenario 1] Tabel Ringkasan Terdeteksi:\n', tableStr1);

  // Verifikasi Kurir di tabel HARUS "Wajib (Alur Inti)" jika pesan rekonsiliasi Kurir muncul
  const hasKurirReconMsg = narasi1.includes('Kurir') && narasi1.includes('disesuaikan jadi role wajib');
  console.log(`- Pesan rekonsiliasi Kurir muncul: ${hasKurirReconMsg ? 'PASS' : 'INFO (Tidak terpicu)'}`);

  const kurirTableRow = tableStr1.split('\n').find((line: string) => line.includes('| Kurir |'));
  console.log('- Baris tabel Kurir:', kurirTableRow);

  if (hasKurirReconMsg) {
    const kurirIsWajibAlurInti = kurirTableRow && kurirTableRow.includes('Wajib (Alur Inti)');
    console.log(`- Status Kurir di tabel adalah "Wajib (Alur Inti)": ${kurirIsWajibAlurInti ? 'PASS' : 'FAIL'}`);
    if (!kurirIsWajibAlurInti) {
      throw new Error(
        `Skenario 1 GAGAL: Pesan rekonsiliasi menyatakan Kurir jadi role wajib, tapi tabel menampilkan: "${kurirTableRow}"`
      );
    }
  }

  // -------------------------------------------------------------
  // SKENARIO 2: Domain yang TIDAK memicu rekonsiliasi (sudah selaras sejak awal)
  // -------------------------------------------------------------
  console.log('\n--- SKENARIO 2: Domain Tanpa Rekonsiliasi (Cuci Mobil) ---');

  const cuciMobilSession: any = {
    step: 'ROLE',
    match: {
      templateId: 'MT-01',
      patternIds: ['UP-01'],
      tier: 'BASIC',
      businessCategory: 'Jasa Cuci Mobil',
      contextualRoles: ['Super Admin', 'Staf Cuci & Lap', 'Pelanggan']
    },
    storyline: {
      narasi:
        'Pelanggan datang membawa mobil kotor. Staf cuci mencuci dan mengeringkan mobil hingga bersih berkilap.',
      asumsiMasalah: 'Antrean kendaraan cuci tidak terdata',
      asumsiAktor: ['Super Admin', 'Staf Cuci & Lap', 'Pelanggan'],
      asumsiAlurUtama: 'Pelanggan datang -> Staf cuci kerjakan -> Serah terima kendaraan',
      statusKonfirmasi: 'disetujui',
      revisiCount: 0
    },
    roles: {
      selected: ['Super Admin', 'Staf Cuci & Lap', 'Pelanggan'],
      wajib: ['Super Admin', 'Staf Cuci & Lap'],
      tambahan: ['Pelanggan']
    }
  };

  const req2 = createMockReq({
    action: 'NEXT',
    stepId: 'ROLE',
    session: cuciMobilSession,
    selected: ['Super Admin', 'Staf Cuci & Lap', 'Pelanggan']
  });

  const res2 = await POST(req2);
  const data2 = await res2.json();
  const narasi2 = data2.narration || '';

  const tableMatch2 = narasi2.match(/\| Peran \|[\s\S]*?\n\n/);
  const tableStr2 = tableMatch2 ? tableMatch2[0] : '';
  console.log('[Skenario 2] Tabel Ringkasan Cuci Mobil:\n', tableStr2);

  const stafCuciRow = tableStr2.split('\n').find((l: string) => l.includes('Staf Cuci & Lap'));
  const pelangganRow = tableStr2.split('\n').find((l: string) => l.includes('Pelanggan'));

  console.log('- Baris Staf Cuci & Lap:', stafCuciRow);
  console.log('- Baris Pelanggan:', pelangganRow);

  const stafCuciWajib = stafCuciRow && stafCuciRow.includes('Wajib (Alur Inti)');
  const pelangganAktif = pelangganRow && pelangganRow.includes('Aktif');

  console.log(`- Staf Cuci & Lap berstatus "Wajib (Alur Inti)": ${stafCuciWajib ? 'PASS' : 'FAIL'}`);
  console.log(`- Pelanggan berstatus "Aktif": ${pelangganAktif ? 'PASS' : 'FAIL'}`);

  if (!stafCuciWajib || !pelangganAktif) {
    throw new Error('Skenario 2 GAGAL: Status role di tabel tidak sesuai ekspektasi!');
  }

  // -------------------------------------------------------------
  // SKENARIO 3: Kombinasi Rekonsiliasi + Role Custom yang Ditambahkan Pengguna
  // -------------------------------------------------------------
  console.log('\n--- SKENARIO 3: Rekonsiliasi + Role Custom Pengguna ---');

  const customRoleInput = [
    {
      id: 'Quality Control',
      label: 'Quality Control',
      description: 'Memeriksa kualitas barang dan kerapian packing sebelum dikirim kurir',
      responsibilities: ['Pemeriksaan kelayakan produk', 'Pemberian stempel lolos QC']
    }
  ];

  const req3 = createMockReq({
    action: 'NEXT',
    stepId: 'ROLE',
    session: ecommerceSession,
    selected: ['Super Admin', 'Staf Gudang', 'Kurir', 'Pelanggan', 'Quality Control'],
    customRoles: customRoleInput
  });

  const res3 = await POST(req3);
  const data3 = await res3.json();
  const narasi3 = data3.narration || '';

  const tableMatch3 = narasi3.match(/\| Peran \|[\s\S]*?\n\n/);
  const tableStr3 = tableMatch3 ? tableMatch3[0] : '';
  console.log('[Skenario 3] Tabel Ringkasan dengan Role Custom:\n', tableStr3);

  const qcRow = tableStr3.split('\n').find((l: string) => l.includes('Quality Control'));
  console.log('- Baris Quality Control:', qcRow);

  const qcPresent = Boolean(qcRow);
  const qcIsAktif = qcRow && qcRow.includes('Aktif');
  console.log(`- Quality Control ada di tabel ringkasan: ${qcPresent ? 'PASS' : 'FAIL'}`);
  console.log(`- Quality Control berstatus "Aktif": ${qcIsAktif ? 'PASS' : 'FAIL'}`);

  if (!qcPresent || !qcIsAktif) {
    throw new Error('Skenario 3 GAGAL: Role custom tidak muncul dengan benar di tabel ringkasan!');
  }

  console.log('\n======================================================');
  console.log('SEMUA TEST SINKRONISASI TABEL RINGKASAN ROLE LULUS 100%! 🎉');
  console.log('======================================================');
}

runTests().catch((err) => {
  console.error('\n❌ ERROR DALAM TEST:', err);
  process.exit(1);
});
