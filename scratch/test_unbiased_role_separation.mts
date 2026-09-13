/**
 * Test Verifikasi: Evaluasi Netralitas Keputusan Pemisahan Role (Anti-Bias PISAH)
 */

import { generateStorylineWithAI } from '../src/app/api/guided/route';
import {
  buildGuidedStep,
  buildKasusGandaFromSession,
  REQUIRED_ROLE
} from '../src/lib/templates/processes/guided';
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

function checkNoAmbiguousOr(detailAktor?: Record<string, { narasi: string; tanggungJawab: string[] }>): boolean {
  if (!detailAktor) return true;
  for (const [role, data] of Object.entries(detailAktor)) {
    for (const task of data.tanggungJawab) {
      if (/\bjual\s+beli\s+atau\b/i.test(task) ||
          /\bpenjualan\s+atau\s+pembelian\b/i.test(task) ||
          /\bsimpan\s*pinjam\s+atau\b/i.test(task) ||
          /\btransaksi\s+jual\s+atau\s+beli\b/i.test(task) ||
          /\bsetor\s+atau\s+tarik\b/i.test(task)) {
        console.error(`  [TEMUAN KATA ATAU AMBIGU] Role: ${role}, Task: "${task}"`);
        return false;
      }
    }
  }
  return true;
}

interface TestDomainResult {
  domain: string;
  kondisi: string;
  keputusan: 'PISAH' | 'GABUNG';
  alasan: string;
  roleKasusA?: string;
  roleKasusB?: string;
  asumsiAktor: string[];
}

const results: TestDomainResult[] = [];

async function testDomain(label: string, prompt: string, expectedDecision?: 'PISAH' | 'GABUNG'): Promise<void> {
  console.log(`\n------------------------------------------------------------`);
  console.log(`Testing [${label}]: "${prompt}"...`);
  const res = await generateStorylineWithAI(prompt);
  const kondisi = res.analisisArah?.kondisi || 'SATU_ARAH';
  const pr = res.analisisArah?.duaArah?.pemisahanRole;
  const keputusan = pr?.keputusan || 'GABUNG';
  const alasan = pr?.alasan || (res.analisisArah?.alasan || '-');

  results.push({
    domain: label,
    kondisi,
    keputusan,
    alasan,
    roleKasusA: pr?.roleKasusA,
    roleKasusB: pr?.roleKasusB,
    asumsiAktor: res.asumsiAktor
  });

  console.log(`  > Kondisi: ${kondisi}`);
  console.log(`  > Keputusan Pemisahan: ${keputusan}`);
  console.log(`  > Alasan: ${alasan}`);
  console.log(`  > Aktor: [${res.asumsiAktor.join(', ')}]`);

  assert(
    kondisi === 'DUA_ARAH',
    `Domain "${label}" terdeteksi DUA_ARAH`
  );

  assert(
    checkNoAmbiguousOr(res.detailAktor),
    `Detail aktor "${label}" bebas dari kata "atau" yang mengaburkan`
  );

  if (expectedDecision) {
    assert(
      keputusan === expectedDecision,
      `Keputusan pemisahan "${label}" sesuai ekspektasi: ${expectedDecision} (aktual: ${keputusan})`
    );
  }
}

async function runAll() {
  console.log('================================================================');
  console.log('INVESTIGASI & VERIFIKASI: EVALUASI KEPUTUSAN PISAH VS GABUNG');
  console.log('================================================================');

  // 1. DUA DOMAIN BARU (Ekspektasi wajar: GABUNG karena dikerjakan satu orang/staf UMKM di konter yang sama)
  await testDomain(
    'Agen Bank & Loket PPOB Setor Tarik Tunai',
    'agen bank dan loket PPOB melayani setor dan tarik tunai nasabah',
    'GABUNG'
  );

  await testDomain(
    'Warung Sembako & Galon/Gas Isi Ulang',
    'warung sembako melayani penjualan sembako serta tukar galon dan tabung gas',
    'GABUNG'
  );

  // 2. MONEY CHANGER (Ekspektasi wajar setelah anti-bias: GABUNG karena skill hitung kurs jual/beli sama)
  await testDomain(
    'Money Changer Valas',
    'aplikasi money changer penukaran valas rupiah',
    'GABUNG'
  );

  // 3. TOKO MOTOR JUAL BELI (Ekspektasi: PISAH karena butuh technical appraisal kondisi motor bekas vs sales motor baru)
  await testDomain(
    'Toko Jual Beli Sepeda Motor',
    'aplikasi toko jual beli sepeda motor',
    'PISAH'
  );

  // 4. TOKO EMAS JUAL BELI (Ekspektasi: PISAH karena butuh penaksir uji kadar emas lebur vs kasir display)
  await testDomain(
    'Toko Emas Jual Beli Perhiasan',
    'toko emas melayani jual perhiasan baru dan beli emas bekas'
  );

  // 5. KOPERASI SIMPAN PINJAM (Bisa PISAH atau GABUNG tergantung penilaian AI terhadap staf teller vs analis kredit)
  await testDomain(
    'Koperasi Simpan Pinjam',
    'buatkan aplikasi koperasi simpan pinjam'
  );

  console.log('\n================================================================');
  console.log('REKAPITULASI DISTRIBUSI KEPUTUSAN KONSEPTUAL');
  console.log('================================================================');
  const pisahCount = results.filter((r) => r.keputusan === 'PISAH').length;
  const gabungCount = results.filter((r) => r.keputusan === 'GABUNG').length;
  console.log(`Total Domain DUA_ARAH Diuji : ${results.length}`);
  console.log(`Keputusan GABUNG           : ${gabungCount} (${Math.round((gabungCount / results.length) * 100)}%)`);
  console.log(`Keputusan PISAH            : ${pisahCount} (${Math.round((pisahCount / results.length) * 100)}%)`);
  console.log('\nRincian per Domain:');
  for (const r of results) {
    console.log(`- [${r.keputusan}] ${r.domain}: ${r.alasan}`);
  }

  console.log(`\nHASIL AKHIR: ${pass} PASS, ${fail} FAIL`);
  console.log('================================================================');
  if (fail > 0) process.exit(1);
}

runAll().catch((e) => {
  console.error('Test error:', e);
  process.exit(1);
});
