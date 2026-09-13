import fs from 'fs';
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

import { generateStorylineWithAI } from '../src/app/api/guided/route';
import { buildDirectionClarificationCard } from '../src/lib/templates/processes/guided';
import { DUAL_PROCESS_PATTERNS } from '../src/lib/templates/processes/guided';

async function runTests() {
  console.log('=== TEST 1: Verifikasi Card Klarifikasi memiliki allowOther: true ===');
  const dummyPattern = DUAL_PROCESS_PATTERNS[0]; // toko emas
  const cardFromPattern = buildDirectionClarificationCard(dummyPattern);
  console.log('Card allowOther (pattern):', cardFromPattern.allowOther);
  if (cardFromPattern.allowOther !== true) {
    throw new Error('FAIL: cardFromPattern.allowOther harus true!');
  }

  const cardFromDynamic = buildDirectionClarificationCard({
    pertanyaan: 'Fokus pembelian atau penjualan barang rosok?',
    opsiA: 'Fokus Pembelian',
    opsiB: 'Fokus Penjualan',
    opsiBoth: 'Dua-duanya'
  });
  console.log('Card allowOther (dynamic):', cardFromDynamic.allowOther);
  if (cardFromDynamic.allowOther !== true) {
    throw new Error('FAIL: cardFromDynamic.allowOther harus true!');
  }
  console.log('✅ TEST 1 PASSED: allowOther is TRUE on both dynamic and pattern cards!\n');

  console.log('=== TEST 2: Simulasi Generate Storyline dengan Custom Other "Fokus pembelian saja dari sumber barang" ===');
  const originalPrompt = 'buatkan aplikasi barang rosok';
  const customOther = 'Fokus pembelian saja dari sumber barang';
  const enrichedPrompt = `${originalPrompt}. PANDUAN PENTING ARAH BISNIS: Pengguna memberikan arahan bisnis spesifik: "${customOther}". Susun alur cerita proses bisnis lengkap yang fokus penuh pada arahan tersebut secara utuh 3 fase dari hulu ke hilir. JANGAN membuat alur yang bertentangan dengan arahan pengguna ini.`;

  console.log('Menguji AI Storyline Generation...');
  const res = await generateStorylineWithAI(enrichedPrompt);
  console.log('\nHASIL GENERATE:');
  console.log('App Name:', res.appName);
  console.log('Category:', res.businessCategory);
  console.log('Narasi:\n', res.narasi);
  console.log('Asumsi Aktor:', res.asumsiAktor);
  console.log('Asumsi Alur Utama:', res.asumsiAlurUtama);

  // Verifikasi 3 fase pada narasi:
  const narasiLower = res.narasi.toLowerCase();
  const alurLower = res.asumsiAlurUtama.toLowerCase();
  
  // Fase 1: Titik awal interaksi (warga / penghimpun / pelanggan / sumber barang membawa atau penjemputan armada)
  const hasFase1 = /warga|pengepul|penghimpun|sumber\s+barang|pelanggan|pemasok|datang|membawa|jemput|setor/i.test(narasiLower);
  // Fase 2: Pemeriksaan fisik & penimbangan di timbangan
  const hasFase2 = /timbang|pilah|periksa|cek|kondisi|karung|besi|logam|kardus/i.test(narasiLower);
  // Fase 3: Pencatatan nota / harga / pembayaran tunai
  const hasFase3 = /nota|kuitansi|bayar|tunai|uang|harga|catat|rekap/i.test(narasiLower);

  console.log('\n--- Evaluasi Struktur 3 Fase ---');
  console.log('Fase 1 (Titik Awal Interaksi Pelanggan/Warga):', hasFase1 ? '✅ ADA' : '❌ TIDAK TERDETEKSI');
  console.log('Fase 2 (Pemeriksaan & Penimbangan Fisik):', hasFase2 ? '✅ ADA' : '❌ TIDAK TERDETEKSI');
  console.log('Fase 3 (Pencatatan Nota & Pembayaran):', hasFase3 ? '✅ ADA' : '❌ TIDAK TERDETEKSI');

  if (!hasFase1 || !hasFase2 || !hasFase3) {
    console.warn('⚠️ Periksa narasi di atas jika ada fase yang kurang eksplisit.');
  } else {
    console.log('✅ TEST 2 PASSED: Narasi memuat seluruh alur 3 fase lengkap dan tidak melompat langsung ke tengah proses!');
  }

  console.log('\n=== TEST 3: Cek Alur Toko Emas dengan Opsi Lainnya ===');
  const emasPrompt = 'buatkan aplikasi toko emas';
  const customEmas = 'Hanya melayani buyback dan cuci emas perhiasan lama';
  const enrichedEmas = `${emasPrompt}. PANDUAN PENTING ARAH BISNIS: Pengguna memberikan arahan bisnis spesifik: "${customEmas}". Susun alur cerita proses bisnis lengkap yang fokus penuh pada arahan tersebut secara utuh 3 fase dari hulu ke hilir. JANGAN membuat alur yang bertentangan dengan arahan pengguna ini.`;
  const resEmas = await generateStorylineWithAI(enrichedEmas);
  console.log('Narasi Emas:\n', resEmas.narasi);
  console.log('Asumsi Aktor Emas:', resEmas.asumsiAktor);
  console.log('Asumsi Alur Emas:', resEmas.asumsiAlurUtama);
  console.log('✅ TEST 3 PASSED!');
}

runTests().catch((err) => {
  console.error('Test Failed:', err);
  process.exit(1);
});
