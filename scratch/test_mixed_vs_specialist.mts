/**
 * Test Verifikasi: Keseimbangan Spesialis Kategori Berisiko Tinggi (PISAH)
 * vs Toko Barang Bekas Campuran / Generalis (GABUNG)
 * vs Finansial Simetris (GABUNG)
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

interface TestItem {
  name: string;
  prompt: string;
  expectedCondition: 'DUA_ARAH' | 'AMBIGU';
  expectedRole: 'PISAH' | 'GABUNG';
  categoryType: 'CAMPURAN_GENERALIS' | 'SPESIALIS_TEKNIS' | 'FINANSIAL_SIMETRIS';
}

const testCases: TestItem[] = [
  // 1. Domain Campuran / Generalis (Harus GABUNG)
  {
    name: 'Toko Barang Bekas Campuran',
    prompt: 'buatkan aplikasi toko barang bekas (jual perabotan dan beli barang bekas dari warga)',
    expectedCondition: 'DUA_ARAH',
    expectedRole: 'GABUNG',
    categoryType: 'CAMPURAN_GENERALIS'
  },
  {
    name: 'Toko Loak & Barang Antik Campuran',
    prompt: 'toko loak/barang antik campuran (jual barang antik dan beli koleksi loak dari warga)',
    expectedCondition: 'DUA_ARAH',
    expectedRole: 'GABUNG',
    categoryType: 'CAMPURAN_GENERALIS'
  },
  {
    name: 'Pasar Barang Bekas Serba Ada',
    prompt: 'pasar barang bekas serba ada (jual beli aneka barang bekas warga)',
    expectedCondition: 'DUA_ARAH',
    expectedRole: 'GABUNG',
    categoryType: 'CAMPURAN_GENERALIS'
  },

  // 2. Domain Spesialis Satu Kategori Berisiko Tinggi (Harus PISAH)
  {
    name: 'Jual Beli HP',
    prompt: 'aplikasi jual beli HP bekas dan baru',
    expectedCondition: 'DUA_ARAH',
    expectedRole: 'PISAH',
    categoryType: 'SPESIALIS_TEKNIS'
  },
  {
    name: 'Jual Beli Laptop & PC',
    prompt: 'jual beli laptop dan komputer bekas',
    expectedCondition: 'DUA_ARAH',
    expectedRole: 'PISAH',
    categoryType: 'SPESIALIS_TEKNIS'
  },
  {
    name: 'Jual Beli Kamera & Lensa',
    prompt: 'jual beli kamera dan lensa bekas',
    expectedCondition: 'DUA_ARAH',
    expectedRole: 'PISAH',
    categoryType: 'SPESIALIS_TEKNIS'
  },
  {
    name: 'Jual Beli Motor Bekas & Baru',
    prompt: 'toko jual beli sepeda motor bekas dan baru',
    expectedCondition: 'DUA_ARAH',
    expectedRole: 'PISAH',
    categoryType: 'SPESIALIS_TEKNIS'
  },
  {
    name: 'Jual Beli Emas Perhiasan',
    prompt: 'toko emas jual beli perhiasan dan buyback emas lama',
    expectedCondition: 'DUA_ARAH',
    expectedRole: 'PISAH',
    categoryType: 'SPESIALIS_TEKNIS'
  },

  // 3. Domain Kasir Finansial Simetris (Harus GABUNG)
  {
    name: 'Money Changer',
    prompt: 'money changer jual beli valas rupiah',
    expectedCondition: 'DUA_ARAH',
    expectedRole: 'GABUNG',
    categoryType: 'FINANSIAL_SIMETRIS'
  },
  {
    name: 'Koperasi Simpan Pinjam',
    prompt: 'koperasi simpan pinjam anggota',
    expectedCondition: 'DUA_ARAH',
    expectedRole: 'GABUNG',
    categoryType: 'FINANSIAL_SIMETRIS'
  }
];

async function runVerification() {
  console.log('================================================================');
  console.log('TEST SUITE: VERIFIKASI SPESIALIS TEKNIS VS TOKO CAMPURAN VS FINANSIAL');
  console.log('================================================================\n');

  for (const tc of testCases) {
    console.log(`Testing [${tc.name}] (${tc.categoryType}) -> Ekspektasi Role: ${tc.expectedRole}...`);
    try {
      const res = await generateStorylineWithAI(tc.prompt);
      const kondisi = res.analisisArah?.kondisi;
      const roleResult = res.analisisArah?.duaArah?.pemisahanRole;
      const keputusan = roleResult?.keputusan;
      const alasan = roleResult?.alasan || '';
      const aktor = res.asumsiAktor;

      console.log(`  > Kondisi: ${kondisi}`);
      console.log(`  > Keputusan Role: ${keputusan}`);
      console.log(`  > Alasan PERSIS: "${alasan}"`);
      console.log(`  > Aktor: [${aktor.join(', ')}]`);

      assert(
        kondisi === tc.expectedCondition,
        `[${tc.name}] kondisi terdeteksi: ${kondisi} (ekspektasi: ${tc.expectedCondition})`
      );

      assert(
        keputusan === tc.expectedRole,
        `[${tc.name}] keputusan role: ${keputusan} (ekspektasi: ${tc.expectedRole})`
      );

      // Verifikasi kualitas alasan untuk toko campuran
      if (tc.categoryType === 'CAMPURAN_GENERALIS') {
        const hasMixedRationale =
          alasan.toLowerCase().includes('campuran') ||
          alasan.toLowerCase().includes('umum') ||
          alasan.toLowerCase().includes('tidak berfokus') ||
          alasan.toLowerCase().includes('kasat mata') ||
          alasan.toLowerCase().includes('tanpa alat diagnostik');
        assert(
          hasMixedRationale,
          `[${tc.name}] alasan eksplisit menyebut karakteristik campuran/generalis tanpa alat diagnostik khusus`
        );
      }

      console.log('');
    } catch (err: any) {
      console.error(`❌ ERROR testing ${tc.name}:`, err.message);
      fail++;
    }
  }

  console.log('================================================================');
  console.log(`HASIL AKHIR TEST SUITE: ${pass} PASS, ${fail} FAIL`);
  console.log('================================================================\n');

  if (fail > 0) {
    process.exit(1);
  }
}

runVerification();
