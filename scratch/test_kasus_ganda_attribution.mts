import { buildKasusGandaFromSession, isExternalRole, detectCoreOperationalRole } from '../src/lib/templates/processes/guided';
import type { MockupSessionState } from '../src/lib/templates/processes/types';

async function runAttributionTests() {
  console.log('=== MEMULAI TEST ATRIBUSI PELAKU KASUS GANDA (ANTI-NONSENSE) ===\n');

  // -------------------------------------------------------------
  // SKENARIO 1: KOPERASI SIMPAN PINJAM (GABUNG: Kasir Operasional)
  // -------------------------------------------------------------
  console.log('--- SKENARIO 1: Koperasi Simpan Pinjam (Kasus Ganda GABUNG) ---');

  const koperasiSession: MockupSessionState = {
    step: 'ROLE',
    match: {
      templateId: 'MT-08',
      patternIds: ['UP-01', 'UP-06'],
      tier: 'ADVANCED',
      businessCategory: 'Koperasi Simpan Pinjam',
      contextualRoles: ['Super Admin', 'Kasir Operasional', 'Anggota']
    },
    storyline: {
      narasi:
        'Anggota menyetor tabungan simpanan dan mengajukan pinjaman dana. Kasir operasional melayani setoran buku tabungan serta memproses verifikasi dan pencairan dana kredit.',
      asumsiMasalah: 'Pencatatan manual simpan pinjam',
      asumsiAktor: ['Super Admin', 'Kasir Operasional', 'Anggota'],
      asumsiAlurUtama:
        'Anggota setor tabungan -> Kasir catat saldo buku -> Anggota ajukan pinjaman -> Kasir verifikasi kelayakan & cairkan pinjaman -> Super Admin pantau kas',
      statusKonfirmasi: 'disetujui',
      revisiCount: 0,
      analisisArah: {
        kondisi: 'DUA_ARAH',
        alasan: 'Ada aliran simpanan masuk dan pinjaman keluar',
        duaArah: {
          prosesA: 'Penyaluran Pinjaman Dana',
          prosesB: 'Penerimaan Simpanan Anggota',
          entitasBersama: 'Dana Koperasi',
          pemisahanRole: {
            keputusan: 'GABUNG',
            alasan: 'Satu kasir operasional melayani loket anggota di meja layanan yang sama'
          }
        }
      }
    },
    roles: {
      selected: ['Super Admin', 'Kasir Operasional', 'Anggota'],
      wajib: ['Super Admin', 'Kasir Operasional'],
      tambahan: ['Anggota']
    },
    flow: {
      dualFlowPreDecided: true,
      dualProcessNames: {
        processA: 'Penyaluran Pinjaman Dana',
        processB: 'Penerimaan Simpanan Anggota'
      }
    }
  };

  // Test 1a: isExternalRole('Anggota') HARUS true!
  const isAnggotaExternal = isExternalRole('Anggota');
  console.log(`[1a] isExternalRole("Anggota") === true: ${isAnggotaExternal ? 'PASS' : 'FAIL'}`);
  if (!isAnggotaExternal) {
    throw new Error('Test 1a GAGAL: Anggota tidak dikenali sebagai external role!');
  }

  // Test 1b: detectCoreOperationalRole HARUS Kasir Operasional (BUKAN Anggota!)
  const detectedCoreKoperasi = detectCoreOperationalRole(koperasiSession);
  console.log(`[1b] detectCoreOperationalRole: "${detectedCoreKoperasi}" (Harus Kasir Operasional): ${detectedCoreKoperasi === 'Kasir Operasional' ? 'PASS' : 'FAIL'}`);
  if (detectedCoreKoperasi !== 'Kasir Operasional') {
    throw new Error(`Test 1b GAGAL: detectCoreOperationalRole menghasilkan "${detectedCoreKoperasi}", seharusnya Kasir Operasional!`);
  }

  // Test 1c: buildKasusGandaFromSession
  const kasusKoperasi = buildKasusGandaFromSession(
    koperasiSession,
    'Penyaluran Pinjaman Dana',
    'Penerimaan Simpanan Anggota'
  );

  console.log('\n[1c] Hasil Alur Inti Kasus A (Pinjaman):');
  const alurPinjaman = kasusKoperasi[0].alurInti;
  alurPinjaman.forEach((s) => console.log(`  Step ${s.step}. (${s.pelaku}) ${s.aksi}`));

  console.log('\n[1c] Hasil Alur Inti Kasus B (Simpanan):');
  const alurSimpanan = kasusKoperasi[1].alurInti;
  alurSimpanan.forEach((s) => console.log(`  Step ${s.step}. (${s.pelaku}) ${s.aksi}`));

  // Validasi Kasus A (Pinjaman):
  // Step 1: Anggota
  // Step 2, 3, 4: Kasir Operasional
  // Step 5: Super Admin
  if (alurPinjaman[0].pelaku !== 'Anggota') throw new Error(`Alur Pinjaman Step 1 pelaku salah: ${alurPinjaman[0].pelaku}`);
  if (alurPinjaman[1].pelaku !== 'Kasir Operasional') throw new Error(`Alur Pinjaman Step 2 pelaku salah: ${alurPinjaman[1].pelaku}`);
  if (alurPinjaman[2].pelaku !== 'Kasir Operasional') throw new Error(`Alur Pinjaman Step 3 pelaku salah: ${alurPinjaman[2].pelaku}`);
  if (alurPinjaman[3].pelaku !== 'Kasir Operasional') throw new Error(`Alur Pinjaman Step 4 pelaku salah: ${alurPinjaman[3].pelaku}`);
  if (alurPinjaman[4].pelaku !== 'Super Admin') throw new Error(`Alur Pinjaman Step 5 pelaku salah: ${alurPinjaman[4].pelaku}`);

  // Validasi Kasus B (Simpanan):
  // Step 1: Anggota
  // Step 2, 3, 4: Kasir Operasional
  // Step 5: Super Admin
  if (alurSimpanan[0].pelaku !== 'Anggota') throw new Error(`Alur Simpanan Step 1 pelaku salah: ${alurSimpanan[0].pelaku}`);
  if (alurSimpanan[1].pelaku !== 'Kasir Operasional') throw new Error(`Alur Simpanan Step 2 pelaku salah: ${alurSimpanan[1].pelaku}`);
  if (alurSimpanan[2].pelaku !== 'Kasir Operasional') throw new Error(`Alur Simpanan Step 3 pelaku salah: ${alurSimpanan[2].pelaku}`);
  if (alurSimpanan[3].pelaku !== 'Kasir Operasional') throw new Error(`Alur Simpanan Step 4 pelaku salah: ${alurSimpanan[3].pelaku}`);
  if (alurSimpanan[4].pelaku !== 'Super Admin') throw new Error(`Alur Simpanan Step 5 pelaku salah: ${alurSimpanan[4].pelaku}`);

  // Validasi Anti-Nonsense (tidak ada Anggota mencairkan ke anggota)
  for (const s of [...alurPinjaman, ...alurSimpanan]) {
    if (s.pelaku.toLowerCase() === 'anggota' && s.aksi.toLowerCase().includes('kepada anggota')) {
      throw new Error(`Self-referential nonsense ditemukan: (${s.pelaku}) ${s.aksi}`);
    }
  }
  console.log('\n- Validasi atribusi peran Kasus A & B Koperasi: PASS!');
  console.log('- Validasi anti-nonsense (bebas kalimat self-referential mustahil): PASS!');

  // -------------------------------------------------------------
  // SKENARIO 2: MONEY CHANGER (GABUNG: Teller Valas)
  // -------------------------------------------------------------
  console.log('\n--- SKENARIO 2: Money Changer (Kasus Ganda GABUNG: Teller Valas) ---');

  const valasSession: MockupSessionState = {
    step: 'ROLE',
    match: {
      templateId: 'MT-08',
      patternIds: ['UP-01'],
      tier: 'ADVANCED',
      businessCategory: 'Money Changer & Valas',
      contextualRoles: ['Super Admin', 'Teller Valas', 'Nasabah']
    },
    storyline: {
      narasi: 'Nasabah menukarkan valas ke rupiah atau membeli valas. Teller valas melayani loket penukaran.',
      asumsiMasalah: 'Pencatatan kurs manual',
      asumsiAktor: ['Super Admin', 'Teller Valas', 'Nasabah'],
      asumsiAlurUtama: 'Nasabah bawa valas -> Teller periksa & hitung kurs -> Nasabah terima rupiah',
      statusKonfirmasi: 'disetujui',
      revisiCount: 0,
      analisisArah: {
        kondisi: 'DUA_ARAH',
        alasan: 'Ada beli valas dan jual valas',
        duaArah: {
          prosesA: 'Penjualan Valas ke Nasabah',
          prosesB: 'Pembelian Valas dari Nasabah',
          entitasBersama: 'Mata Uang Asing',
          pemisahanRole: {
            keputusan: 'GABUNG',
            alasan: 'Satu loket teller valas melayani jual dan beli'
          }
        }
      }
    },
    roles: {
      selected: ['Super Admin', 'Teller Valas', 'Nasabah'],
      wajib: ['Super Admin', 'Teller Valas'],
      tambahan: ['Nasabah']
    }
  };

  const isNasabahExternal = isExternalRole('Nasabah');
  console.log(`[2a] isExternalRole("Nasabah") === true: ${isNasabahExternal ? 'PASS' : 'FAIL'}`);
  if (!isNasabahExternal) throw new Error('Nasabah tidak terdeteksi sebagai role eksternal!');

  const kasusValas = buildKasusGandaFromSession(valasSession, 'Penjualan Valas', 'Pembelian Valas');
  console.log('[2b] Alur Penjualan Valas:');
  kasusValas[0].alurInti.forEach((s) => console.log(`  Step ${s.step}. (${s.pelaku}) ${s.aksi}`));

  if (kasusValas[0].alurInti[1].pelaku !== 'Teller Valas') {
    throw new Error(`Step 2 Penjualan Valas harus Teller Valas, didapat: ${kasusValas[0].alurInti[1].pelaku}`);
  }
  if (kasusValas[1].alurInti[1].pelaku !== 'Teller Valas') {
    throw new Error(`Step 2 Pembelian Valas harus Teller Valas, didapat: ${kasusValas[1].alurInti[1].pelaku}`);
  }
  console.log('- Validasi atribusi peran Money Changer (Teller Valas vs Nasabah): PASS!');

  // -------------------------------------------------------------
  // SKENARIO 3: TOKO EMAS JUAL-BELI (PISAH: Sales Display vs Penaksir Emas)
  // -------------------------------------------------------------
  console.log('\n--- SKENARIO 3: Toko Emas (Kasus Ganda PISAH: Sales vs Penaksir) ---');

  const emasSession: MockupSessionState = {
    step: 'ROLE',
    match: {
      templateId: 'MT-08',
      patternIds: ['UP-01', 'UP-09'],
      tier: 'ADVANCED',
      businessCategory: 'Toko Emas Jual-Beli & Buyback',
      contextualRoles: ['Super Admin', 'Sales Display Perhiasan', 'Penaksir Emas / Buyback', 'Pelanggan']
    },
    storyline: {
      narasi: 'Pelanggan membeli emas baru atau menjual emas lama untuk buyback.',
      asumsiMasalah: 'Pengujian kadar emas dan pencatatan buyback',
      asumsiAktor: ['Super Admin', 'Sales Display Perhiasan', 'Penaksir Emas / Buyback', 'Pelanggan'],
      asumsiAlurUtama: 'Pelanggan pilih perhiasan -> Sales catat nota -> Pelanggan buyback -> Penaksir uji kadar',
      statusKonfirmasi: 'disetujui',
      revisiCount: 0,
      analisisArah: {
        kondisi: 'DUA_ARAH',
        alasan: 'Ada penjualan perhiasan baru dan buyback emas bekas',
        duaArah: {
          prosesA: 'Penjualan Perhiasan Emas',
          prosesB: 'Pembelian / Buyback Emas Bekas',
          entitasBersama: 'Perhiasan Emas',
          pemisahanRole: {
            keputusan: 'PISAH',
            alasan: 'Appraisal kadar emas butuh alat uji khusus',
            roleKasusA: 'Sales Display Perhiasan',
            roleKasusB: 'Penaksir Emas / Buyback'
          }
        }
      }
    },
    roles: {
      selected: ['Super Admin', 'Sales Display Perhiasan', 'Penaksir Emas / Buyback', 'Pelanggan'],
      wajib: ['Super Admin', 'Sales Display Perhiasan', 'Penaksir Emas / Buyback'],
      tambahan: ['Pelanggan']
    }
  };

  const kasusEmas = buildKasusGandaFromSession(emasSession, 'Penjualan Perhiasan Emas', 'Pembelian / Buyback Emas Bekas');
  console.log('[3a] Alur Penjualan Emas (Kasus A):');
  kasusEmas[0].alurInti.forEach((s) => console.log(`  Step ${s.step}. (${s.pelaku}) ${s.aksi}`));

  console.log('[3b] Alur Buyback Emas (Kasus B):');
  kasusEmas[1].alurInti.forEach((s) => console.log(`  Step ${s.step}. (${s.pelaku}) ${s.aksi}`));

  const actorPenjualan = kasusEmas[0].alurInti[1].pelaku;
  const actorBuyback = kasusEmas[1].alurInti[1].pelaku;

  console.log(`- Pelaku Kasus A (Penjualan): "${actorPenjualan}" (Harus Sales Display Perhiasan): ${actorPenjualan.includes('Sales') ? 'PASS' : 'FAIL'}`);
  console.log(`- Pelaku Kasus B (Buyback): "${actorBuyback}" (Harus Penaksir Emas): ${actorBuyback.includes('Penaksir') ? 'PASS' : 'FAIL'}`);

  if (!actorPenjualan.includes('Sales') || !actorBuyback.includes('Penaksir')) {
    throw new Error('Test Skenario 3 PISAH GAGAL!');
  }

  console.log('\n======================================================');
  console.log('SEMUA TEST ATRIBUSI PELAKU KASUS GANDA LULUS 100%! 🎉');
  console.log('======================================================');
}

runAttributionTests().catch((err) => {
  console.error('\n❌ ERROR DALAM TEST:', err);
  process.exit(1);
});
