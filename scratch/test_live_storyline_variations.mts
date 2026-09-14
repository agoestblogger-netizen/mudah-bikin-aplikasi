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
    const hasMenarik = /\bmenarik\b/i.test(firstSentence);

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

  // Evaluasi Keunikan Kerangka: pastikan tidak ada 2 domain yang menghasilkan kerangka kalimat identik (misal: "Mari kita lihat bagaimana alur operasional di...")
  const openingSentences = results.map(r => r.openingSentence.toLowerCase());
  const normalizedSkeletons = openingSentences.map(s =>
    s.replace(/(cuci mobil|klinik dokter gigi|klinik gigi|laundry|kafe|kedai kopi|bengkel motor|toko emas|koperasi simpan pinjam|koperasi)/gi, '[BISNIS]')
     .replace(/(kendaraan|motor|mobil|pakaian|kopi|perhiasan|simpanan|pinjaman)/gi, '[OBJEK]')
  );

  for (let i = 0; i < normalizedSkeletons.length; i++) {
    for (let j = i + 1; j < normalizedSkeletons.length; j++) {
      if (normalizedSkeletons[i] === normalizedSkeletons[j]) {
        throw new Error(`FAILED: Domain [${results[i].domain}] dan [${results[j].domain}] memiliki kerangka kalimat pembuka yang identik!\n- ${results[i].openingSentence}\n- ${results[j].openingSentence}`);
      }
    }
  }
  console.log('✅ Verifikasi Keunikan: Tidak ada satupun domain dari 7 domain yang memiliki kerangka pembuka identik!');

  // Uji Khusus: Jalankan 3 domain yang sebelumnya terjangkit "Mari kita lihat..." (Cuci Mobil, Toko Emas, Koperasi) secara berulang
  console.log('\n================================================================');
  console.log('🔬 UJI KHUSUS: PENGUJIAN BERULANG 3 DOMAIN TERDAMPAK (CUCI, EMAS, KOPERASI)');
  console.log('================================================================');
  const affectedDomains = [
    { name: 'Cuci Mobil & Motor', prompt: 'buatkan aplikasi cuci mobil dan motor' },
    { name: 'Toko Emas Jual Beli', prompt: 'aplikasi jual beli dan penaksiran toko emas' },
    { name: 'Koperasi Simpan Pinjam', prompt: 'aplikasi simpan pinjam dan catatan setoran anggota koperasi' }
  ];

  for (const domain of affectedDomains) {
    console.log(`\n🔄 Menguji ulang 2x untuk domain: ${domain.name}...`);
    for (let run = 1; run <= 2; run++) {
      const res = await generateStorylineWithAI(
        domain.prompt,
        'openai',
        process.env.OPENAI_API_KEY,
        process.env.OPENAI_MODEL || 'gpt-4o-mini'
      );
      const firstS = res.narasi.split(/[\.\n\?\!]/)[0].trim();
      console.log(`   [Run ${run}] 👉 "${firstS}."`);
      if (isClicheStorylineOpening(firstS)) {
        throw new Error(`FAILED: [${domain.name} Run ${run}] Masih menghasilkan pola klise/boilerplate: "${firstS}"`);
      }
      if (/^mari\s+kita\s+lihat\s+bagaimana\s+alur\s+operasional/i.test(firstS)) {
        throw new Error(`FAILED: [${domain.name} Run ${run}] Masih meniru boilerplate anchor kaku: "${firstS}"`);
      }
    }
  }

  console.log('\n🎉 SELURUH VERIFIKASI LIVE 7 DOMAIN, UJI KEUNIKAN, & UJI BERULANG BERHASIL 100%!');
}

runLiveVerification().catch((err) => {
  console.error('\n❌ VERIFIKASI LIVE GAGAL:', err);
  process.exit(1);
});
