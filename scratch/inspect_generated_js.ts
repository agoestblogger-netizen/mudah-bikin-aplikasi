import { JSDOM } from 'jsdom';

async function testJsdomExtraction() {
  const userPrompt = 'buatkan aplikasi FreshWash Laundry System 4 role: Admin, Kasir, Petugas/Washer, dan Pelanggan';
  const sampleBrief = `
📋 Brief Kebutuhan
- Nama App: FreshWash Laundry System
- Orientasi UI: Responsif
- Tema Visual: Modern Indigo & Cyan Teal
- Fitur Utama (V1):
  1. Dashboard & Statistik Omset (Admin)
  2. Papan Kerja Antrian Cucian (Washer)
  3. Form Input Pesanan & Kasir POS
  4. Manajemen Tagihan & Pelunasan
  5. Lacak Status Resi Cucian Pelanggan
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

  const response = await fetch('http://localhost:3000/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: 'ok setuju buatkan prototipenya sekarang',
      stage: 'TAHAP_1_PEMBUKAAN',
      chatHistory: [
        { sender: 'USER', text: userPrompt },
        { sender: 'AI', text: sampleBrief }
      ],
      currentCode: ''
    })
  });

  const result = await response.json();
  console.log('Result Success:', result.success);
  console.log('Result Provider:', result.provider);
  console.log('Result ReplyText (First 500 chars):\n', result.replyText?.slice(0, 500));
  const html = result.code?.html || '';
  console.log('HTML Length:', html.length);


  // Inspect the script tag
  const scriptContent = html.match(/<script[\s\S]*?>([\s\S]*?)<\/script>/i)?.[1] || '';
  console.log('Script Content (First 1500 chars):\n', scriptContent.slice(0, 1500));

  // Check how switchRole is defined in the script
  const switchRoleMatch = scriptContent.match(/function\s+switchRole[\s\S]*?\{[\s\S]*?\n\s*\}/);
  console.log('\n--- switchRole implementation found in script ---:\n', switchRoleMatch?.[0] || 'NOT FOUND');

  // Check how render is defined in the script
  const renderMatch = scriptContent.match(/function\s+render[\s\S]*?\{[\s\S]*?\n\s*\}/);
  console.log('\n--- render implementation found in script ---:\n', renderMatch?.[0] || 'NOT FOUND');
}

testJsdomExtraction().catch(console.error);
