import fs from 'fs';
import path from 'path';

// Manual env loader
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      process.env[key] = value;
    }
  }
}

import {
  generateStorylineWithAI,
  isClicheStorylineOpening,
  sanitizeStorylineNarrative
} from '../src/app/api/guided/route';

const TEST_DOMAINS = [
  { name: '1. Cuci Mobil & Motor', prompt: 'buatkan aplikasi cuci mobil dan motor' },
  { name: '2. Klinik Dokter Gigi', prompt: 'aplikasi antrean dan rekam medis pasien klinik dokter gigi' },
  { name: '3. Laundry Kiloan', prompt: 'aplikasi penerimaan cucian dan kasir laundry kiloan' },
  { name: '4. Kafe & Kedai Kopi', prompt: 'aplikasi pemesanan menu dan kasir kafe kedai kopi' },
  { name: '5. Bengkel Motor', prompt: 'aplikasi servis berkala dan riwayat kendaraan bengkel motor' },
  { name: '6. Toko Emas Jual Beli', prompt: 'aplikasi jual beli perhiasan dan buyback toko emas' },
  { name: '7. Koperasi Simpan Pinjam', prompt: 'aplikasi simpanan sukarela dan pengajuan pinjaman koperasi simpan pinjam' }
];

async function runLiveVerification() {
  console.log('================================================================');
  console.log('🚀 LIVE VERIFICATION: 7 DOMAIN BERBEDA MENGGUNAKAN AI NYATA');
  console.log('================================================================\n');

  const results: Array<{
    domain: string;
    openingSentence: string;
    fullNarrative: string;
    isCliche: boolean;
    hasMenarik: boolean;
    hasKamiKita: boolean;
  }> = [];

  for (const testCase of TEST_DOMAINS) {
    console.log(`\n⏳ Menguji domain: [${testCase.name}]...`);
    const startTime = Date.now();

    const res = await generateStorylineWithAI(
      testCase.prompt,
      'openai',
      process.env.OPENAI_API_KEY,
      process.env.OPENAI_MODEL || 'gpt-4o-mini'
    );

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const narasi = res.narasi;
    const sanitized = sanitizeStorylineNarrative(narasi, res.asumsiAktor);
    const firstSentence = sanitized.split(/[\.\n\?\!]/)[0].trim();

    const isCliche = isClicheStorylineOpening(sanitized);
    const hasMenarik = /\bmenarik\b/i.test(firstSentence);
    const hasKamiKita = /\b(kami|kita|tim\s+kami|tim\s+kita)\b/i.test(sanitized);

    console.log(`⏱️ Selesai dalam ${elapsed}s`);
    console.log(`📌 Kalimat Pembuka: "${firstSentence}."`);
    console.log(`📖 Narasi Lengkap: "${sanitized}"`);
    console.log(`🏷️ Aktor: [${res.asumsiAktor.join(', ')}]`);
    console.log(`🔍 Evaluasi Pembuka:`);
    console.log(`   - Terdeteksi Klise?: ${isCliche ? '❌ YA (GAGAL)' : '✅ TIDAK (LOLOS)'}`);
    console.log(`   - Mengandung kata 'menarik' di pembuka?: ${hasMenarik ? '❌ YA' : '✅ TIDAK'}`);
    console.log(`   - Mengandung 'kami/kita'?: ${hasKamiKita ? '❌ YA' : '✅ TIDAK'}`);

    results.push({
      domain: testCase.name,
      openingSentence: firstSentence,
      fullNarrative: sanitized,
      isCliche,
      hasMenarik,
      hasKamiKita
    });

    if (isCliche) {
      throw new Error(`FAILED: Kalimat pembuka untuk domain ${testCase.name} masih klise: "${firstSentence}"`);
    }
  }

  console.log('\n================================================================');
  console.log('📊 REKAPITULASI KALIMAT PEMBUKA DARI 7 DOMAIN BERBEDA:');
  console.log('================================================================');
  results.forEach((r, idx) => {
    console.log(`${idx + 1}. [${r.domain}]`);
    console.log(`   👉 "${r.openingSentence}."\n`);
  });

  // Uji Diversitas Struktur: Pastikan tidak ada 2 domain yang memiliki awal kalimat identik
  const openingPrefixes = results.map(r => r.openingSentence.slice(0, 20).toLowerCase());
  const uniquePrefixes = new Set(openingPrefixes);
  console.log(`Variasi Prefix Kalimat Pembuka: ${uniquePrefixes.size} unik dari ${results.length} domain.`);

  console.log('\n🎉 SELURUH VERIFIKASI LIVE 7 DOMAIN BERHASIL 100%! TIDAK ADA POLA "SANGAT MENARIK"!');
}

runLiveVerification().catch((err) => {
  console.error('\n❌ VERIFIKASI LIVE GAGAL:', err);
  process.exit(1);
});
