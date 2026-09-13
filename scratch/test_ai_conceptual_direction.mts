/**
 * Test Verifikasi: Analisis Konseptual AI untuk Arah Bisnis
 * Murni menguji keputusan AI tanpa regex list / domain list.
 */

import { generateStorylineWithAI } from '../src/app/api/guided/route';
import { detectDualProcess, buildDirectionClarificationCard } from '../src/lib/templates/processes/guided';
import type { MockupSessionState } from '../src/lib/templates/processes/types';
import fs from 'fs';

// Baca .env.local secara native
if (fs.existsSync('.env.local')) {
  const envContent = fs.readFileSync('.env.local', 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

let pass = 0;
let fail = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`✅ PASS: ${msg}`);
    pass++;
  } else {
    console.error(`❌ FAIL: ${msg}`);
    fail++;
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('TEST 1: KOPERASI SIMPAN PINJAM & SINONIM (Kasus Utama User)');
  console.log('================================================================');
  
  // 1.1 Koperasi Simpan Pinjam
  console.log('Testing: "buatkan aplikasi koperasi simpan pinjam"...');
  const resKoperasi = await generateStorylineWithAI('buatkan aplikasi koperasi simpan pinjam');
  console.log('  Kondisi AI:', resKoperasi.analisisArah?.kondisi);
  console.log('  Alasan AI:', resKoperasi.analisisArah?.alasan);
  console.log('  Dua Arah:', resKoperasi.analisisArah?.duaArah);
  console.log('  Narasi:', resKoperasi.narasi);
  console.log('  Alur Utama:', resKoperasi.asumsiAlurUtama);

  assert(
    resKoperasi.analisisArah?.kondisi === 'DUA_ARAH',
    'Koperasi simpan pinjam disimpulkan DUA_ARAH oleh AI'
  );
  assert(
    Boolean(resKoperasi.analisisArah?.duaArah?.prosesA && resKoperasi.analisisArah?.duaArah?.prosesB),
    'AI menyertakan nama kedua proses (simpan & pinjam)'
  );
  // Verifikasi grounding narasi: mencakup simpan DAN pinjam
  const narasiLower = (resKoperasi.narasi + ' ' + resKoperasi.asumsiAlurUtama).toLowerCase();
  const hasSimpan = /simpan|setor|tabung|deposito/i.test(narasiLower);
  const hasPinjam = /pinjam|kredit|pembiayaan|angsuran/i.test(narasiLower);
  assert(
    hasSimpan && hasPinjam,
    'Narasi & alur utama WAJIB mencakup KEDUA sisi (simpan DAN pinjam), tidak menjatuhkan salah satu'
  );

  // 1.2 Sinonim: Koperasi tabungan dan kredit anggota
  console.log('\nTesting sinonim: "koperasi tabungan dan kredit anggota"...');
  const resKoperasiSinonim = await generateStorylineWithAI('koperasi tabungan dan kredit anggota');
  console.log('  Kondisi AI:', resKoperasiSinonim.analisisArah?.kondisi);
  assert(
    resKoperasiSinonim.analisisArah?.kondisi === 'DUA_ARAH',
    'Sinonim "koperasi tabungan dan kredit" tetap disimpulkan DUA_ARAH tanpa bergantung kata literal'
  );

  console.log('\n================================================================');
  console.log('TEST 2: DOMAIN LAMA (Toko Emas Ambigu vs Eksplisit, Pegadaian, Cuci Mobil, Rental, Kafe)');
  console.log('================================================================');

  // 2.1 Toko emas tanpa detail -> AMBIGU
  console.log('Testing: "buatkan aplikasi toko emas"...');
  const resEmasAmbigu = await generateStorylineWithAI('buatkan aplikasi toko emas');
  console.log('  Kondisi AI:', resEmasAmbigu.analisisArah?.kondisi);
  console.log('  Klarifikasi Ambigu:', resEmasAmbigu.analisisArah?.klarifikasiAmbigu);
  assert(
    resEmasAmbigu.analisisArah?.kondisi === 'AMBIGU',
    'Prompt singkat "buatkan aplikasi toko emas" disimpulkan AMBIGU oleh AI'
  );
  assert(
    Boolean(resEmasAmbigu.analisisArah?.klarifikasiAmbigu?.pertanyaan),
    'AI menyusun pertanyaan klarifikasi kontekstual yang natural'
  );

  // 2.2 Toko emas eksplisit jual dan beli -> DUA_ARAH
  console.log('\nTesting: "toko emas yang melayani jual perhiasan dan beli emas bekas"...');
  const resEmasEksplisit = await generateStorylineWithAI('toko emas yang melayani jual perhiasan dan beli emas bekas');
  console.log('  Kondisi AI:', resEmasEksplisit.analisisArah?.kondisi);
  assert(
    resEmasEksplisit.analisisArah?.kondisi === 'DUA_ARAH',
    'Toko emas eksplisit jual dan beli disimpulkan DUA_ARAH'
  );

  // 2.3 Cuci mobil -> SATU_ARAH
  console.log('\nTesting: "buatkan aplikasi cuci mobil"...');
  const resCuciMobil = await generateStorylineWithAI('buatkan aplikasi cuci mobil');
  console.log('  Kondisi AI:', resCuciMobil.analisisArah?.kondisi);
  assert(
    resCuciMobil.analisisArah?.kondisi === 'SATU_ARAH',
    'Cuci mobil disimpulkan SATU_ARAH (tidak ada proses berlawanan)'
  );

  // 2.4 Rental mobil lepas kunci -> SATU_ARAH (alur linier serah-terima)
  console.log('\nTesting: "buatkan aplikasi rental mobil lepas kunci"...');
  const resRental = await generateStorylineWithAI('buatkan aplikasi rental mobil lepas kunci');
  console.log('  Kondisi AI:', resRental.analisisArah?.kondisi);
  assert(
    resRental.analisisArah?.kondisi === 'SATU_ARAH',
    'Rental mobil disimpulkan SATU_ARAH (serah-terima unit diakui sebagai satu alur linier awal-akhir)'
  );

  // 2.5 Kafe -> SATU_ARAH
  console.log('\nTesting: "buatkan aplikasi kasir kafe dan resto"...');
  const resKafe = await generateStorylineWithAI('buatkan aplikasi kasir kafe dan resto');
  console.log('  Kondisi AI:', resKafe.analisisArah?.kondisi);
  assert(
    resKafe.analisisArah?.kondisi === 'SATU_ARAH',
    'Kafe disimpulkan SATU_ARAH'
  );

  console.log('\n================================================================');
  console.log('TEST 3: DOMAIN BARU (Money Changer / Toko Sepeda Bekas Jual Beli)');
  console.log('================================================================');

  console.log('Testing: "buatkan aplikasi money changer penukaran valuta asing jual beli mata uang"...');
  const resMoneyChanger = await generateStorylineWithAI('buatkan aplikasi money changer penukaran valuta asing jual beli mata uang');
  console.log('  Kondisi AI:', resMoneyChanger.analisisArah?.kondisi);
  console.log('  Alasan AI:', resMoneyChanger.analisisArah?.alasan);
  console.log('  Dua Arah:', resMoneyChanger.analisisArah?.duaArah);
  assert(
    resMoneyChanger.analisisArah?.kondisi === 'DUA_ARAH',
    'Domain baru "money changer" disimpulkan DUA_ARAH secara konseptual murni tanpa hardcode'
  );

  console.log('\n================================================================');
  console.log('TEST 4: DETECT DUAL PROCESS INTEGRATION KE SESSION & STEP ALUR');
  console.log('================================================================');

  // Buat mock session dari hasil AI Koperasi
  const sessionKoperasi: MockupSessionState = {
    step: 'ALUR',
    match: {
      templateId: 'MT-01',
      overlayIds: [],
      patternIds: ['UP-01'],
      tier: 'BASIC',
      businessCategory: resKoperasi.businessCategory
    },
    storyline: {
      narasi: resKoperasi.narasi,
      asumsiMasalah: resKoperasi.asumsiMasalah,
      asumsiAktor: resKoperasi.asumsiAktor,
      asumsiAlurUtama: resKoperasi.asumsiAlurUtama,
      statusKonfirmasi: 'disetujui',
      analisisArah: resKoperasi.analisisArah
    },
    roles: { selected: resKoperasi.asumsiAktor },
    flow: {},
    painPoints: { selected: [] },
    features: { selected: [] }
  };

  const dualKoperasi = detectDualProcess(sessionKoperasi);
  assert(dualKoperasi !== null && dualKoperasi.isDual, 'detectDualProcess membaca hasil analisis konseptual AI Koperasi -> isDual: true');
  assert(
    Boolean(dualKoperasi?.processA && dualKoperasi?.processB),
    `detectDualProcess mengekstrak processA="${dualKoperasi?.processA}" dan processB="${dualKoperasi?.processB}"`
  );

  // Buat mock session dari hasil AI Cuci Mobil (harus null)
  const sessionCuci: MockupSessionState = {
    step: 'ALUR',
    match: {
      templateId: 'MT-01',
      overlayIds: [],
      patternIds: ['UP-01'],
      tier: 'BASIC',
      businessCategory: resCuciMobil.businessCategory
    },
    storyline: {
      narasi: resCuciMobil.narasi,
      asumsiMasalah: resCuciMobil.asumsiMasalah,
      asumsiAktor: resCuciMobil.asumsiAktor,
      asumsiAlurUtama: resCuciMobil.asumsiAlurUtama,
      statusKonfirmasi: 'disetujui',
      analisisArah: resCuciMobil.analisisArah
    },
    roles: { selected: resCuciMobil.asumsiAktor },
    flow: {},
    painPoints: { selected: [] },
    features: { selected: [] }
  };
  const dualCuci = detectDualProcess(sessionCuci);
  assert(dualCuci === null, 'detectDualProcess untuk cuci mobil mengembalikan null (bukan dual)');

  console.log(`\n================================================================`);
  console.log(`HASIL AKHIR: ${pass} PASS, ${fail} FAIL`);
  console.log(`================================================================`);

  if (fail > 0) process.exit(1);
}

runTests().catch((e) => {
  console.error('Test Error:', e);
  process.exit(1);
});
