/**
 * Test Verifikasi: Analisis Pemisahan Role per Sisi Transaksi (Kondisi DUA_ARAH)
 */

import { generateStorylineWithAI } from '../src/app/api/guided/route';
import {
  buildGuidedStep,
  buildKasusGandaFromSession,
  reconcileCoreOperationalRole,
  REQUIRED_ROLE
} from '../src/lib/templates/processes/guided';
import type { MockupSessionState, DomainFlowData } from '../src/lib/templates/processes/types';
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

function checkNoAmbiguousOr(detailAktor?: Record<string, { narasi: string; tanggungJawab: string[] }>): boolean {
  if (!detailAktor) return true;
  for (const [role, data] of Object.entries(detailAktor)) {
    for (const task of data.tanggungJawab) {
      // Cek pola kata "atau" yang mengaburkan arah transaksi ganda
      if (/\bjual\s+beli\s+atau\b/i.test(task) ||
          /\bpenjualan\s+atau\s+pembelian\b/i.test(task) ||
          /\bsimpan\s*pinjam\s+atau\b/i.test(task) ||
          /\btransaksi\s+jual\s+atau\s+beli\b/i.test(task)) {
        console.error(`  [TEMUAN KATA ATAU AMBIGU] Role: ${role}, Task: "${task}"`);
        return false;
      }
    }
  }
  return true;
}

async function runTests() {
  console.log('================================================================');
  console.log('TEST 1: TOKO JUAL BELI SEPEDA MOTOR (Kasus Utama Temuan User)');
  console.log('================================================================');
  
  console.log('Testing: "aplikasi toko jual beli sepeda motor"...');
  const resMotor = await generateStorylineWithAI('aplikasi toko jual beli sepeda motor');
  console.log('  Kondisi AI:', resMotor.analisisArah?.kondisi);
  console.log('  Alasan Arah:', resMotor.analisisArah?.alasan);
  console.log('  Pemisahan Role:', resMotor.analisisArah?.duaArah?.pemisahanRole);
  console.log('  Aktor:', resMotor.asumsiAktor);
  console.log('  Detail Aktor:', JSON.stringify(resMotor.detailAktor, null, 2));

  assert(
    resMotor.analisisArah?.kondisi === 'DUA_ARAH',
    'Toko jual beli sepeda motor terdeteksi DUA_ARAH'
  );
  assert(
    Boolean(resMotor.analisisArah?.duaArah?.pemisahanRole),
    'AI menyertakan analisis pemisahanRole'
  );
  assert(
    checkNoAmbiguousOr(resMotor.detailAktor),
    'Tanggung jawab pada detailAktor TIDAK memakai kata "atau" yang mengaburkan kedua sisi transaksi'
  );

  // Verifikasi integrasi ke Step ROLE dan Step ALUR
  const dummySessionMotor: MockupSessionState = {
    step: 'STORYTELLING',
    match: {
      templateId: 'MT-20',
      overlayIds: [],
      patternIds: [],
      tier: 'MEDIUM'
    },
    storyline: {
      narasi: resMotor.narasi,
      asumsiMasalah: resMotor.asumsiMasalah,
      asumsiAktor: resMotor.asumsiAktor,
      asumsiAlurUtama: resMotor.asumsiAlurUtama,
      detailAktor: resMotor.detailAktor,
      statusKonfirmasi: 'disetujui',
      analisisArah: resMotor.analisisArah
    },
    roles: {
      selected: [REQUIRED_ROLE, ...resMotor.asumsiAktor]
    },
    flow: {
      dualFlowPreDecided: true,
      dualProcessNames: {
        processA: resMotor.analisisArah?.duaArah?.prosesA || 'Penjualan Motor',
        processB: resMotor.analisisArah?.duaArah?.prosesB || 'Pembelian/Tukar Tambah Motor'
      }
    }
  };

  const roleStepMotor = buildGuidedStep({ ...dummySessionMotor, step: 'ROLE' });
  console.log('  Role Options ditawarkan:', roleStepMotor.options.map((o) => `${o.label} (${o.roleStatus})`));

  const kasusGandaMotor = buildKasusGandaFromSession(
    dummySessionMotor,
    dummySessionMotor.flow.dualProcessNames!.processA,
    dummySessionMotor.flow.dualProcessNames!.processB
  );
  console.log('  Kasus Ganda A pelaku:', kasusGandaMotor[0]?.alurInti.map((s) => `${s.step}. [${s.pelaku}] ${s.aksi.slice(0, 30)}...`));
  console.log('  Kasus Ganda B pelaku:', kasusGandaMotor[1]?.alurInti.map((s) => `${s.step}. [${s.pelaku}] ${s.aksi.slice(0, 30)}...`));

  if (resMotor.analisisArah?.duaArah?.pemisahanRole?.keputusan === 'PISAH') {
    const actorA = kasusGandaMotor[0]?.alurInti.find((s) => s.step === 2)?.pelaku;
    const actorB = kasusGandaMotor[1]?.alurInti.find((s) => s.step === 2)?.pelaku;
    assert(
      actorA !== actorB,
      `Jika PISAH, pelaku operasional Kasus A (${actorA}) berbeda dari Kasus B (${actorB})`
    );
  }

  console.log('\n================================================================');
  console.log('TEST 2: DOMAIN DUA_ARAH LAIN (Koperasi, Toko Emas, Money Changer)');
  console.log('================================================================');

  // 2.1 Koperasi Simpan Pinjam
  console.log('\nTesting: "buatkan aplikasi koperasi simpan pinjam"...');
  const resKoperasi = await generateStorylineWithAI('buatkan aplikasi koperasi simpan pinjam');
  console.log('  Keputusan Pemisahan Role:', resKoperasi.analisisArah?.duaArah?.pemisahanRole?.keputusan);
  console.log('  Alasan Pemisahan:', resKoperasi.analisisArah?.duaArah?.pemisahanRole?.alasan);
  assert(
    resKoperasi.analisisArah?.kondisi === 'DUA_ARAH',
    'Koperasi tetap DUA_ARAH'
  );
  assert(
    checkNoAmbiguousOr(resKoperasi.detailAktor),
    'Detail aktor koperasi bebas dari kata "atau" yang mengaburkan'
  );

  // 2.2 Toko Emas Jual-Beli
  console.log('\nTesting: "toko emas melayani jual perhiasan dan beli emas bekas"...');
  const resEmas = await generateStorylineWithAI('toko emas melayani jual perhiasan dan beli emas bekas');
  console.log('  Keputusan Pemisahan Role:', resEmas.analisisArah?.duaArah?.pemisahanRole?.keputusan);
  console.log('  Alasan Pemisahan:', resEmas.analisisArah?.duaArah?.pemisahanRole?.alasan);
  assert(
    resEmas.analisisArah?.kondisi === 'DUA_ARAH',
    'Toko emas jual-beli tetap DUA_ARAH'
  );
  assert(
    checkNoAmbiguousOr(resEmas.detailAktor),
    'Detail aktor toko emas bebas dari kata "atau" yang mengaburkan'
  );

  // 2.3 Money Changer
  console.log('\nTesting: "aplikasi money changer penukaran valas rupiah"...');
  const resMoney = await generateStorylineWithAI('aplikasi money changer penukaran valas rupiah');
  console.log('  Keputusan Pemisahan Role:', resMoney.analisisArah?.duaArah?.pemisahanRole?.keputusan);
  console.log('  Alasan Pemisahan:', resMoney.analisisArah?.duaArah?.pemisahanRole?.alasan);
  assert(
    resMoney.analisisArah?.kondisi === 'DUA_ARAH',
    'Money changer tetap DUA_ARAH'
  );
  assert(
    checkNoAmbiguousOr(resMoney.detailAktor),
    'Detail aktor money changer bebas dari kata "atau" yang mengaburkan'
  );

  console.log('\n================================================================');
  console.log(`HASIL AKHIR: ${pass} PASS, ${fail} FAIL`);
  console.log('================================================================');
  if (fail > 0) process.exit(1);
}

runTests().catch((e) => {
  console.error('Test error:', e);
  process.exit(1);
});
