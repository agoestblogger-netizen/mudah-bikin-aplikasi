/**
 * Test Verifikasi: Evaluasi Keseimbangan Diagnostic Litmus Test (PISAH vs GABUNG)
 * Memvalidasi 9 domain representatif:
 * - 5 Domain Uji Teknis Diagnostik (WAJIB PISAH): HP, Laptop, Kamera, Motor, Emas
 * - 4 Domain Administratif Simetris (WAJIB GABUNG): Money Changer, Agen Bank, Warung, Koperasi
 */

import { generateStorylineWithAI } from '../src/app/api/guided/route';
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

interface DomainTestItem {
  name: string;
  prompt: string;
  expected: 'PISAH' | 'GABUNG';
  alasanExpected: string;
}

const testList: DomainTestItem[] = [
  // 1. Kategori Diagnostik Teknis (PISAH)
  {
    name: 'Toko Jual Beli HP',
    prompt: 'aplikasi toko jual beli HP baru dan bekas',
    expected: 'PISAH',
    alasanExpected: 'Perlu cek IMEI/blacklist, battery health, true tone & layar'
  },
  {
    name: 'Jual Beli Laptop & PC',
    prompt: 'aplikasi jual beli laptop dan komputer bekas',
    expected: 'PISAH',
    alasanExpected: 'Perlu uji spesifikasi hardware, SSD health, stress test CPU/GPU'
  },
  {
    name: 'Jual Beli Kamera & Lensa',
    prompt: 'toko jual beli kamera dan lensa fotografi baru dan bekas',
    expected: 'PISAH',
    alasanExpected: 'Perlu cek shutter count, jamur optik lensa, dan kebersihan sensor'
  },
  {
    name: 'Toko Jual Beli Sepeda Motor',
    prompt: 'aplikasi toko jual beli sepeda motor',
    expected: 'PISAH',
    alasanExpected: 'Perlu inspeksi fisik mesin, nomor rangka, kilometer, dan BPKB'
  },
  {
    name: 'Toko Emas Jual Beli',
    prompt: 'toko emas melayani jual perhiasan baru dan beli emas bekas',
    expected: 'PISAH',
    alasanExpected: 'Perlu uji kadar karat dengan batu uji & asam nitrat / timbangan presisi'
  },

  // 2. Kategori Administratif Simetris (GABUNG)
  {
    name: 'Money Changer',
    prompt: 'aplikasi money changer penukaran valas rupiah',
    expected: 'GABUNG',
    alasanExpected: 'Kalkulasi kurs beli vs jual simetris di loket yang sama'
  },
  {
    name: 'Agen Bank & PPOB',
    prompt: 'agen bank dan loket PPOB melayani setor dan tarik tunai nasabah',
    expected: 'GABUNG',
    alasanExpected: 'Transaksi setor vs tarik tunai kasir simetris menggunakan EDC'
  },
  {
    name: 'Warung Sembako & Galon/Gas',
    prompt: 'warung sembako melayani penjualan sembako serta tukar galon dan tabung gas',
    expected: 'GABUNG',
    alasanExpected: 'Menukar tabung/galon fisik standar tanpa uji teknis mesin'
  },
  {
    name: 'Koperasi Simpan Pinjam',
    prompt: 'aplikasi koperasi simpan pinjam',
    expected: 'GABUNG',
    alasanExpected: 'Administrasi kasir simpanan dan pinjaman skala koperasi umum'
  }
];

interface FinalSummary {
  name: string;
  kondisi: string;
  keputusan: 'PISAH' | 'GABUNG';
  alasan: string;
  aktor: string[];
}

const finalSummaries: FinalSummary[] = [];

async function runTests() {
  console.log('================================================================');
  console.log('TEST SUITE: EVALUASI KESEIMBANGAN DIAGNOSTIC LITMUS TEST (9 DOMAIN)');
  console.log('================================================================');

  for (const item of testList) {
    console.log(`\nTesting [${item.name}] (Ekspektasi: ${item.expected})...`);
    const res = await generateStorylineWithAI(item.prompt);
    const kondisi = res.analisisArah?.kondisi || 'SATU_ARAH';
    const pr = res.analisisArah?.duaArah?.pemisahanRole;
    const keputusan = pr?.keputusan || 'GABUNG';
    const alasan = pr?.alasan || (res.analisisArah?.alasan || '-');

    finalSummaries.push({
      name: item.name,
      kondisi,
      keputusan,
      alasan,
      aktor: res.asumsiAktor
    });

    console.log(`  > Kondisi: ${kondisi}`);
    console.log(`  > Keputusan: ${keputusan}`);
    console.log(`  > Alasan AI: ${alasan}`);
    console.log(`  > Aktor: [${res.asumsiAktor.join(', ')}]`);

    assert(
      kondisi === 'DUA_ARAH',
      `[${item.name}] terdeteksi DUA_ARAH`
    );

    assert(
      keputusan === item.expected,
      `[${item.name}] keputusan pemisahan konsisten: ${item.expected} (aktual: ${keputusan})`
    );
  }

  console.log('\n================================================================');
  console.log('REKAPITULASI DISTRIBUSI KEPUTUSAN DIAGNOSTIC LITMUS TEST');
  console.log('================================================================');
  const pisahCount = finalSummaries.filter((s) => s.keputusan === 'PISAH').length;
  const gabungCount = finalSummaries.filter((s) => s.keputusan === 'GABUNG').length;
  console.log(`Total Domain Diuji: ${finalSummaries.length}`);
  console.log(`PISAH (Diagnostik Teknis)     : ${pisahCount} (${Math.round((pisahCount / finalSummaries.length) * 100)}%)`);
  console.log(`GABUNG (Administrasi Kasir)   : ${gabungCount} (${Math.round((gabungCount / finalSummaries.length) * 100)}%)`);

  console.log('\nRincian Hasil Evaluasi per Domain:');
  for (const s of finalSummaries) {
    console.log(`- [${s.keputusan}] ${s.name}: ${s.alasan} | Aktor: [${s.aktor.join(', ')}]`);
  }

  console.log(`\nHASIL AKHIR TEST SUITE: ${pass} PASS, ${fail} FAIL`);
  console.log('================================================================');
  if (fail > 0) process.exit(1);
}

runTests().catch((e) => {
  console.error('Error saat menjalankan test suite:', e);
  process.exit(1);
});
