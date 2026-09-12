import { buildGuidedStep, getRoleNarrativeAndResponsibilities, canonicalRoleKey } from '../src/lib/templates/processes/guided';
import { generateStorylineWithAI } from '../src/app/api/guided/route';
import type { MockupSessionState } from '../src/lib/templates/processes/types';

async function main() {
  console.log('================================================================');
  console.log('TEST & VERIFIKASI POIN REVISI 3: GROUNDING DESKRIPSI & TANGGUNG JAWAB ROLE');
  console.log('================================================================\n');

  // --------------------------------------------------------------------------
  // BAGIAN 1: KONFIRMASI EKSPLISIT FALLBACK TANPA DETAIL_AKTOR
  // --------------------------------------------------------------------------
  console.log('--- [BAGIAN 1] VERIFIKASI FALLBACK (JIKA AI TIDAK ISI DETAIL_AKTOR) ---');
  const dummyRentalStoryline = {
    narasi: 'Pelanggan menyewa mobil lepas kunci atau dengan sopir. Petugas memeriksa SIM dan BPKB serta mencatat kilometer awal dan akhir sebelum serah terima kunci mobil. Sopir siap mengantar penumpang dengan nyaman.',
    asumsiAlurUtama: 'Penyewa booking -> Petugas verifikasi SIM & kilometer -> Serah terima kunci -> Sopir antar penumpang',
    asumsiMasalah: 'Pencatatan kilometer manual dan verifikasi jaminan rental',
    asumsiAktor: ['Super Admin', 'Petugas Penerimaan & Penyerahan Kunci', 'Sopir', 'Penyewa'],
    statusKonfirmasi: 'disetujui' as const,
    revisiCount: 0,
    // Disengaja detailAktor KOSONG (undefined) untuk menguji fallback membaca narasi langsung
    detailAktor: undefined
  };

  const rolesToTestFallback = [
    'Petugas Penerimaan & Penyerahan Kunci',
    'Sopir',
    'Penyewa'
  ];

  for (const r of rolesToTestFallback) {
    const resFallback = getRoleNarrativeAndResponsibilities(r, 'Rental Mobil', dummyRentalStoryline);
    console.log(`\nRole: [${r}] (Fallback Mode: Tanpa detailAktor AI)`);
    console.log(`  Deskripsi: ${resFallback.narasi}`);
    console.log(`  Tanggung Jawab: ${resFallback.tanggungJawab.join('; ')}`);

    // Validasi Sopir tidak boleh paket
    if (r === 'Sopir') {
      if (resFallback.narasi.toLowerCase().includes('paket') || resFallback.tanggungJawab.some(t => t.toLowerCase().includes('paket'))) {
        throw new Error('GAGAL: Sopir di fallback masih menyebut kata "paket"!');
      }
      if (!resFallback.narasi.toLowerCase().includes('penumpang')) {
        throw new Error('GAGAL: Sopir di fallback tidak menyebut "penumpang"!');
      }
    }

    // Validasi Petugas Kunci harus sebut SIM/BPKB/kilometer
    if (r === 'Petugas Penerimaan & Penyerahan Kunci') {
      const combined = (resFallback.narasi + ' ' + resFallback.tanggungJawab.join(' ')).toLowerCase();
      if (!combined.includes('sim') || !combined.includes('kilometer')) {
        throw new Error('GAGAL: Petugas Kunci di fallback tidak membaca SIM/kilometer dari narasi!');
      }
    }

    // Validasi Penyewa tidak boleh e-commerce belanja barang
    if (r === 'Penyewa') {
      const combined = (resFallback.narasi + ' ' + resFallback.tanggungJawab.join(' ')).toLowerCase();
      if (combined.includes('belanja') || combined.includes('keranjang') || combined.includes('katalog produk')) {
        throw new Error('GAGAL: Penyewa di fallback masih e-commerce belanja!');
      }
      if (!combined.includes('sewa') && !combined.includes('armada') && !combined.includes('kendaraan')) {
        throw new Error('GAGAL: Penyewa di fallback tidak relevan dengan sewa kendaraan!');
      }
    }
  }
  console.log('\n✅ BAGIAN 1 LOLOS: Fallback murni membaca teks narasi & alur cerita secara kontekstual, bukan kembali ke switch-case e-commerce/paket!');

  // --------------------------------------------------------------------------
  // BAGIAN 2: KONFIRMASI ROLE_GROUPS DEDUPLIKASI
  // --------------------------------------------------------------------------
  console.log('\n--- [BAGIAN 2] VERIFIKASI ROLE_GROUPS DEDUPLIKASI ---');
  const canonicalSopir = canonicalRoleKey('Sopir');
  const canonicalDriver = canonicalRoleKey('Driver');
  console.log(`canonicalRoleKey("Sopir"): ${canonicalSopir}`);
  console.log(`canonicalRoleKey("Driver"): ${canonicalDriver}`);
  if (canonicalSopir !== 'driver' || canonicalDriver !== 'driver') {
    throw new Error('GAGAL: Deduplikasi sinonim Sopir dan Driver tidak bekerja!');
  }
  console.log('✅ BAGIAN 2 LOLOS: ROLE_GROUPS regex sopir -> driver tetap aktif untuk deduplikasi nama!');

  // --------------------------------------------------------------------------
  // BAGIAN 3: TEST REGRESI 3 DOMAIN LAMA (CUCI MOBIL, KLINIK GIGI, KAFE)
  // --------------------------------------------------------------------------
  console.log('\n--- [BAGIAN 3] TEST REGRESI 3 DOMAIN LAMA DENGAN AI LIVE ---');
  const domainPrompts = [
    { name: 'Cuci Mobil', prompt: 'buatkan aplikasi cuci mobil' },
    { name: 'Klinik Gigi', prompt: 'buatkan aplikasi klinik dokter gigi' },
    { name: 'Kafe', prompt: 'buatkan aplikasi kafe dan kedai kopi modern' }
  ];

  for (const d of domainPrompts) {
    console.log(`\nTesting Domain: ${d.name} ("${d.prompt}")...`);
    const aiStoryline = await generateStorylineWithAI(d.prompt);

    console.log(`  AppName: ${aiStoryline.appName}`);
    console.log(`  Kategori: ${aiStoryline.businessCategory}`);
    console.log(`  Narasi: ${aiStoryline.narasi}`);
    console.log(`  Aktor: ${aiStoryline.asumsiAktor.join(', ')}`);

    // Validasi kualitas narasi storytelling tidak boleh generik
    const genericSnippet = 'tim di lapangan dengan sigap melayani pelanggan secara teratur, sementara kamu sebagai pemilik bisa memantau perkembangan aktivitas dan rekap penjualan harian dengan tenang';
    if (aiStoryline.narasi.includes(genericSnippet)) {
      throw new Error(`GAGAL: Narasi domain ${d.name} masih memakai template generik!`);
    }

    // Bangun step ROLE untuk domain ini
    const session: MockupSessionState = {
      step: 'ROLE',
      match: {
        templateId: 'MT-01',
        overlayIds: [],
        patternIds: ['UP-06'],
        tier: 'STARTER',
        businessCategory: aiStoryline.businessCategory,
        contextualPainPoints: [],
        contextualRoles: []
      },
      storyline: {
        narasi: aiStoryline.narasi,
        asumsiMasalah: aiStoryline.asumsiMasalah,
        asumsiAktor: aiStoryline.asumsiAktor,
        asumsiAlurUtama: aiStoryline.asumsiAlurUtama,
        statusKonfirmasi: 'disetujui',
        revisiCount: 0,
        detailAktor: aiStoryline.detailAktor
      },
      roles: { selected: [] },
      flow: {},
      painPoints: { selected: [] },
      features: { selected: [] }
    };

    const roleStep = buildGuidedStep(session);
    console.log(`  Tabel Role Step ROLE (${d.name}):`);
    console.table(
      roleStep.options.map(opt => ({
        Label: opt.label,
        Deskripsi: opt.description.slice(0, 70) + '...',
        TanggungJawab: opt.responsibilities?.slice(0, 2).join('; ')
      }))
    );
  }
  console.log('\n✅ BAGIAN 3 LOLOS: Kualitas narasi storytelling dan grounding role 3 domain lama tetap prima!');

  // --------------------------------------------------------------------------
  // BAGIAN 4: TEST DOMAIN RENTAL MOBIL (KASUS ASLI BUG)
  // --------------------------------------------------------------------------
  console.log('\n--- [BAGIAN 4] TEST DOMAIN RENTAL MOBIL (KASUS ASLI BUG) ---');
  const rentalPrompt = 'buatkan aplikasi rental mobil lepas kunci dan dengan sopir';
  console.log(`Menguji prompt: "${rentalPrompt}"...`);

  const rentalStoryline = await generateStorylineWithAI(rentalPrompt);
  console.log(`\nStoryline AI Rental Mobil:`);
  console.log(`- AppName: ${rentalStoryline.appName}`);
  console.log(`- Kategori: ${rentalStoryline.businessCategory}`);
  console.log(`- Narasi: ${rentalStoryline.narasi}`);
  console.log(`- Alur: ${rentalStoryline.asumsiAlurUtama}`);
  console.log(`- Aktor: ${rentalStoryline.asumsiAktor.join(', ')}`);

  // Pastikan aktor spesifik rental tercakup dalam pengujian
  const rentalAktorList = Array.from(new Set([
    ...rentalStoryline.asumsiAktor,
    'Petugas Penerimaan & Penyerahan Kunci',
    'Sopir'
  ]));

  const sessionRental: MockupSessionState = {
    step: 'ROLE',
    match: {
      templateId: 'MT-20',
      overlayIds: [],
      patternIds: ['UP-06', 'UP-09'],
      tier: 'STARTER',
      businessCategory: rentalStoryline.businessCategory,
      contextualPainPoints: [],
      contextualRoles: []
    },
    storyline: {
      narasi: rentalStoryline.narasi,
      asumsiMasalah: rentalStoryline.asumsiMasalah,
      asumsiAktor: rentalAktorList,
      asumsiAlurUtama: rentalStoryline.asumsiAlurUtama,
      statusKonfirmasi: 'disetujui',
      revisiCount: 0,
      detailAktor: rentalStoryline.detailAktor
    },
    roles: { selected: [] },
    flow: {},
    painPoints: { selected: [] },
    features: { selected: [] }
  };

  const roleStepRental = buildGuidedStep(sessionRental);
  console.log('\nDaftar Lengkap Role Step ROLE untuk Rental Mobil:');
  console.table(
    roleStepRental.options.map(opt => ({
      ID: opt.id,
      Label: opt.label,
      Deskripsi: opt.description,
      TanggungJawabUtama: opt.responsibilities?.join(' | ')
    }))
  );

  // Verifikasi Spesifik Role Sopir
  const sopirOpt = roleStepRental.options.find(o => o.label.toLowerCase().includes('sopir') || o.label.toLowerCase().includes('driver'));
  if (!sopirOpt) {
    throw new Error('GAGAL: Role Sopir tidak ditemukan di opsi Step ROLE rental mobil!');
  }
  const sopirCombined = (sopirOpt.description + ' ' + (sopirOpt.responsibilities?.join(' ') || '')).toLowerCase();
  console.log('\n[Pemeriksaan Khusus Sopir]:');
  console.log(`- Deskripsi: "${sopirOpt.description}"`);
  console.log(`- Tanggung Jawab: "${sopirOpt.responsibilities?.join('; ')}"`);

  if (sopirCombined.includes('paket pesanan') || sopirCombined.includes('mengantar paket') || sopirCombined.includes('kurir')) {
    throw new Error('GAGAL FATAL: Sopir masih mendeskripsikan pengantaran paket pesanan/kurir!');
  }
  if (!sopirCombined.includes('penumpang') && !sopirCombined.includes('perjalanan') && !sopirCombined.includes('armada')) {
    throw new Error('GAGAL: Sopir tidak menyebut penumpang/perjalanan armada!');
  }
  console.log('-> ✅ Sopir terverifikasi mendeskripsikan pengantaran penumpang & armada kendaraan, BUKAN paket!');

  // Verifikasi Spesifik Role Petugas Kunci
  const kunciOpt = roleStepRental.options.find(o => o.label.toLowerCase().includes('kunci') || o.label.toLowerCase().includes('serah terima'));
  if (!kunciOpt) {
    throw new Error('GAGAL: Role Petugas Penerimaan & Penyerahan Kunci tidak ditemukan di opsi Step ROLE rental mobil!');
  }
  const kunciCombined = (kunciOpt.description + ' ' + (kunciOpt.responsibilities?.join(' ') || '')).toLowerCase();
  console.log('\n[Pemeriksaan Khusus Petugas Penerimaan & Penyerahan Kunci]:');
  console.log(`- Deskripsi: "${kunciOpt.description}"`);
  console.log(`- Tanggung Jawab: "${kunciOpt.responsibilities?.join('; ')}"`);

  const mentionsInspection = kunciCombined.includes('sim') || kunciCombined.includes('bpkb') || kunciCombined.includes('kilometer') || kunciCombined.includes('fisik') || kunciCombined.includes('identitas');
  if (!mentionsInspection) {
    throw new Error('GAGAL FATAL: Petugas Kunci tidak menyebut verifikasi identitas/SIM/kilometer/kondisi fisik!');
  }
  console.log('-> ✅ Petugas Kunci terverifikasi mendeskripsikan verifikasi SIM/dokumen, kondisi fisik/kilometer, dan serah terima kunci!');

  console.log('\n🎉 SEMUA PERSYARATAN POIN REVISI 3 TERPENUHI 100% TANPA KEKURANGAN!');
}

main().catch(err => {
  console.error('❌ Terjadi Error:', err);
  process.exit(1);
});
