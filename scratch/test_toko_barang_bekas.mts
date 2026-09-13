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

async function testPrompts() {
  const prompts = [
    "buatkan aplikasi toko jual beli barang bekas",
    "buatkan aplikasi toko barang bekas (jual perabotan dan beli barang bekas dari warga)",
    "toko loak/barang antik campuran",
    "pasar barang bekas serba ada"
  ];

  for (const p of prompts) {
    console.log(`\n================================================================`);
    console.log(`Testing prompt: "${p}"...`);
    try {
      const res = await generateStorylineWithAI(p);
      console.log('Kondisi:', res.analisisArah?.kondisi);
      console.log('Alasan Kondisi:', res.analisisArah?.alasan);
      console.log('Keputusan Role:', res.analisisArah?.duaArah?.pemisahanRole?.keputusan);
      console.log('Alasan PERSIS:', res.analisisArah?.duaArah?.pemisahanRole?.alasan);
      console.log('Aktor:', res.asumsiAktor);
      console.log('Narasi:', res.narasi);
    } catch (err) {
      console.error('Error:', err);
    }
  }
}

testPrompts();
