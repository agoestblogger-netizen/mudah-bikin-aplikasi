import { detectMatchingMasterTemplate, detectSelectivePageTemplates, formatSelectivePageTemplatesForCodeGen } from '../src/lib/templates';
import { validateAndRepairGeneratedCode } from '../src/lib/codeValidator';

async function testRaw() {
  const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";
  const model = "gemini-3.6-flash";

  const sampleBrief = `
📋 Brief Kebutuhan
- Nama App: CleanFlow Laundry Management
- Orientasi UI: Responsif
- Tema Visual: Modern indigo, cyan teal, clean white
- Fitur Utama (V1):
  1. Dashboard & Statistik Laundry
  2. Papan Kerja Antrian Cucian (Washer)
  3. Form Input Pesanan & Kasir POS
  4. Manajemen Tagihan & Pembayaran
  5. Cek Status Cucian Pelanggan
- Job Description & Struktur Halaman per Role:
  * Admin:
    - Dashboard (default): section Ringkasan Statistik, section Aktivitas Terkini
    - Kelola Master: section Tarif Layanan, section Data Pelanggan
  * Kasir:
    - Input Pesanan (default): section Form Order Baru, section Keranjang Layanan
    - Tagihan: section Daftar Tagihan Belum Lunas, section Pembayaran Kasir
  * Petugas / Washer:
    - Antrian Kerja (default): section Papan Antrian Cucian, section Update Status Cuci
  * Pelanggan:
    - Status Cucian (default): section Lacak Resi Cucian, section Riwayat Order
`;

  const selectivePTs = detectSelectivePageTemplates(sampleBrief);
  const ptDirective = formatSelectivePageTemplatesForCodeGen(selectivePTs);

  console.log('Fetching directly from Gemini with gemini-2.0-flash...');
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{
            text: `Buatkan kode HTML lengkap prototipe aplikasi CleanFlow Laundry Management sesuai Brief Kebutuhan berikut:\n${sampleBrief}\n\n${ptDirective}\n\nPastikan kode HTML lengkap di dalam blok \`\`\`html ... \`\`\` dengan JavaScript fungsional lengkap (fungsi showTab, switchRole, render, tambah, edit, hapus, updateStatus).`
          }]
        }
      ],
      generationConfig: {
        maxOutputTokens: 8192,
        temperature: 0.2
      }
    })
  });

  const data = await res.json();
  if (data.error) {
    console.error('Gemini API Error:', data.error);
    return;
  }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  console.log('Gemini response length:', text.length);

  const match = text.match(/```html([\s\S]*?)```/);
  if (match) {
    const html = match[1].trim();
    console.log('Extracted HTML length:', html.length);
    const val = validateAndRepairGeneratedCode(html, '', '');
    console.log('Validation isValid:', val.isValid);
    console.log('Validation issues:', val.issues);
    if (!val.isValid) {
      console.log('Sample script in HTML:\n', html.match(/<script[\s\S]*?<\/script>/i)?.[0]?.slice(0, 1500));
    }
  } else {
    console.log('No ```html block found! Full response:', text.slice(0, 500));
  }
}

testRaw().catch(console.error);
