import { generateStorylineWithAI } from '../src/app/api/guided/route';

async function main() {
  console.log('=== TEST LIVE AI STORYTELLING (PROMPT BERBEDA -> NARASI BERBEDA) ===\n');

  const prompts = [
    'buatkan aplikasi cuci mobil',
    'buatkan aplikasi klinik dokter gigi',
    'buatkan aplikasi laundry kiloan'
  ];

  const results: { prompt: string; appName: string; narasi: string; actors: string[]; alur: string }[] = [];

  for (const p of prompts) {
    console.log(`Menguji prompt: "${p}"...`);
    const res = await generateStorylineWithAI(p);
    console.log(`-> App Name: ${res.appName}`);
    console.log(`-> Kategori: ${res.businessCategory}`);
    console.log(`-> Aktor: ${res.asumsiAktor.join(', ')}`);
    console.log(`-> Alur Utama: ${res.asumsiAlurUtama}`);
    console.log(`-> Narasi: ${res.narasi}\n`);

    results.push({
      prompt: p,
      appName: res.appName,
      narasi: res.narasi,
      actors: res.asumsiAktor,
      alur: res.asumsiAlurUtama
    });
  }

  // Verifikasi bahwa ketiga narasi BERBEDA dan BUKAN FALLBACK STATIK
  const narasi0 = results[0].narasi;
  const narasi1 = results[1].narasi;
  const narasi2 = results[2].narasi;

  if (narasi0 === narasi1 || narasi1 === narasi2 || narasi0 === narasi2) {
    throw new Error('Gagal: Narasi antar proses bisnis masih sama!');
  }

  const staticSnippet = 'tim di lapangan dengan sigap melayani pelanggan secara teratur, sementara kamu sebagai pemilik bisa memantau perkembangan aktivitas dan rekap penjualan harian dengan tenang';
  if (narasi0.includes(staticSnippet) || narasi1.includes(staticSnippet) || narasi2.includes(staticSnippet)) {
    throw new Error('Gagal: Masih mengeluarkan teks fallback statik!');
  }

  console.log('🎉 SEMUA PROSES BISNIS MENGHASILKAN NARASI AI YANG UNIK, HIDUP, DAN RELEVAN!');
}

main().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
