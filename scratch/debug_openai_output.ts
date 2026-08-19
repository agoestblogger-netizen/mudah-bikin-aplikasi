async function debugOpenAI() {
  const openaiApiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY || "";
  
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

  const prompt = `Buatkan KODE HTML MOCKUP LENGKAP UTUH dari <!DOCTYPE html> sampai </html> di dalam blok \`\`\`html ... \`\`\` untuk aplikasi FreshWash Laundry System sesuai Brief Kebutuhan di atas.
WAJIB sertakan tag <script> lengkap dengan fungsi:
- showTab(tabName)
- switchRole(role) -> WAJIB redirect ke tab default: Admin->dashboard, Kasir->kasir, Petugas/Washer->antrian, Pelanggan->lacak
- render() -> WAJIB atur style.display tombol tab sesuai role
- updateStatusCuci(id, status)
- bukaModal(type) & tutupModal()
- simpanData() & hapusData(id)
- cariResi()
DILARANG memanggil onclick yang tidak didefinisikan di script.`;

  console.log('Calling OpenAI gpt-4o-mini / gpt-5.4-mini directly...');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openaiApiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_completion_tokens: 8192,
      temperature: 0.2
    })
  });

  const data = await res.json();
  const rawText = data.choices?.[0]?.message?.content || '';
  console.log('OpenAI raw length:', rawText.length);
  console.log('Finish reason:', data.choices?.[0]?.finish_reason);
  
  const match = rawText.match(/```html([\s\S]*?)```/);
  if (match) {
    console.log('Matched HTML length:', match[1].length);
    const scriptMatch = match[1].match(/<script[\s\S]*?>([\s\S]*?)<\/script>/i);
    console.log('Script tag found:', Boolean(scriptMatch));
    if (scriptMatch) {
      console.log('Has switchRole in script:', scriptMatch[1].includes('switchRole'));
      console.log('Has showTab in script:', scriptMatch[1].includes('showTab'));
      console.log('Has render in script:', scriptMatch[1].includes('render'));
      console.log('\n--- Script preview (first 1000 chars) ---:\n', scriptMatch[1].slice(0, 1000));
    }
  } else {
    console.log('No ```html block found! Text tail (last 500 chars):\n', rawText.slice(-500));
  }
}

debugOpenAI().catch(console.error);
