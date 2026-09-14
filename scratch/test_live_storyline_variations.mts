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
  lacksGreetingOpening,
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
    hasGreeting: boolean;
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
    const hasGreeting = !lacksGreetingOpening(sanitized);
    const hasKamiKita = /\b(tim\s+kami|tim\s+kita)\b|(?<!\b(?:mari|ayo|silakan|yuk)\s+)\b(kami|kita)\b/i.test(sanitized);

    // Analisis struktur tata bahasa pembuka
    let strukturGramatikal = 'Lainnya';
    if (/^(bisnis|usaha|di\s+|pengelolaan|aktivitas|operasional|menata|setiap)\b/i.test(firstSentence) && !/\b(untuk|dalam)\s+(meningkatkan|mempermudah|menyederhanakan|mengelola)\b/i.test(firstSentence)) {
      strukturGramatikal = 'Observasi / Fakta Nyata Bisnis';
    } else if (/\?$/.test(firstSentence) || /^(bagaimana|pernahkah|apakah)\b/i.test(firstSentence)) {
      strukturGramatikal = 'Pertanyaan Retoris';
    } else if (/^(mari|ayo|silakan)\b/i.test(firstSentence)) {
      strukturGramatikal = 'Ajakan Langsung Tanpa Basa-Basi';
    } else if (/^(jadi|fokus|intinya)\b/i.test(firstSentence)) {
      strukturGramatikal = 'Konfirmasi & Refleksi Praktis';
    } else if (/\b(untuk|dalam|guna|demi)\b/i.test(firstSentence) && /\b(tepat|cerdas|cemerlang|luar biasa|bagus)\b/i.test(firstSentence)) {
      strukturGramatikal = 'Pujian Formulaik (Klise)';
    }

    console.log(`⏱️ Selesai dalam ${elapsed}s`);
    console.log(`📌 Kalimat Pembuka: "${firstSentence}."`);
    console.log(`📐 Struktur Tata Bahasa: [${strukturGramatikal}]`);
    console.log(`📖 Narasi Lengkap: "${sanitized}"`);
    console.log(`🏷️ Aktor: [${res.asumsiAktor.join(', ')}]`);
    console.log(`🔍 Evaluasi Pembuka:`);
    console.log(`   - Ada Sapaan / Pengakuan Ide?: ${hasGreeting ? '✅ YA (LOLOS)' : '❌ TIDAK (LANGSUNG CERITA)'}`);
    console.log(`   - Terdeteksi Klise?: ${isCliche ? '❌ YA (GAGAL)' : '✅ TIDAK (LOLOS)'}`);
    console.log(`   - Mengandung kata 'menarik' di pembuka?: ${hasMenarik ? '❌ YA' : '✅ TIDAK'}`);
    console.log(`   - Mengandung 'kami/kita'?: ${hasKamiKita ? '❌ YA' : '✅ TIDAK'}`);

    results.push({
      domain: testCase.name,
      openingSentence: firstSentence,
      fullNarrative: sanitized,
      hasGreeting,
      isCliche,
      hasMenarik,
      hasKamiKita,
      strukturGramatikal
    });

    if (isCliche) {
      throw new Error(`FAILED: Kalimat pembuka untuk domain ${testCase.name} masih klise formulaik: "${firstSentence}"`);
    }
    if (!hasGreeting) {
      throw new Error(`FAILED: Kalimat pembuka untuk domain ${testCase.name} tidak memiliki sapaan ide: "${firstSentence}"`);
    }
  }

  console.log('\n================================================================');
  console.log('📊 REKAPITULASI KALIMAT PEMBUKA & STRUKTUR DARI 7 DOMAIN BERBEDA:');
  console.log('================================================================');
  results.forEach((r, idx) => {
    console.log(`${idx + 1}. [${r.domain}]`);
    console.log(`   👉 "${r.openingSentence}."`);
    console.log(`   📐 Struktur: ${r.strukturGramatikal}\n`);
  });

  // Uji Khusus: Cuci Mobil vs Bengkel Motor (tidak boleh menghasilkan kalimat yang sama persis)
  console.log('\n================================================================');
  console.log('🔬 UJI KHUSUS: PENGUJIAN BERULANG CUCI MOBIL VS BENGKEL MOTOR');
  console.log('================================================================');
  console.log('Menjalankan kembali pemanggilan untuk Cuci Mobil & Bengkel Motor...');

  const repeatCuci = await generateStorylineWithAI(
    'buatkan aplikasi cuci mobil dan motor',
    'openai',
    process.env.OPENAI_API_KEY,
    process.env.OPENAI_MODEL || 'gpt-4o-mini'
  );
  const repeatBengkel = await generateStorylineWithAI(
    'aplikasi servis berkala dan riwayat kendaraan bengkel motor',
    'openai',
    process.env.OPENAI_API_KEY,
    process.env.OPENAI_MODEL || 'gpt-4o-mini'
  );

  const firstCuci = repeatCuci.narasi.split(/[\.\n\?\!]/)[0].trim();
  const firstBengkel = repeatBengkel.narasi.split(/[\.\n\?\!]/)[0].trim();

  console.log(`🚗 Cuci Mobil (Run 2): "${firstCuci}."`);
  console.log(`🏍️ Bengkel Motor (Run 2): "${firstBengkel}."`);

  if (firstCuci.toLowerCase() === firstBengkel.toLowerCase()) {
    throw new Error('FAILED: Cuci Mobil dan Bengkel Motor menghasilkan kalimat yang sama persis!');
  }
  if (isClicheStorylineOpening(firstCuci) || isClicheStorylineOpening(firstBengkel)) {
    throw new Error('FAILED: Pengujian berulang Cuci Mobil / Bengkel Motor masih mengandung kerangka klise!');
  }

  console.log('\n🎉 SELURUH VERIFIKASI LIVE 7 DOMAIN & UJI KHUSUS BERHASIL 100%!');
}

runLiveVerification().catch((err) => {
  console.error('\n❌ VERIFIKASI LIVE GAGAL:', err);
  process.exit(1);
});
