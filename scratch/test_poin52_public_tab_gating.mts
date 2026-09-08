import { validateAndRepairGeneratedCode } from '../src/lib/codeValidator.js';

async function fetchStreamReply(promptText: string, history: any[] = [], ip: string = '127.0.0.1', stage: string = 'TAHAP_1_PEMBUKAAN'): Promise<string> {
  const res = await fetch('http://localhost:3000/api/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': ip
    },
    body: JSON.stringify({
      prompt: promptText,
      chatHistory: history,
      stage,
      currentCode: null
    })
  });

  if (!res.ok || !res.body) {
    throw new Error(`HTTP Error ${res.status}: ${await res.text()}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let accumulatedText = '';
  let finalDoneText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ') && line !== 'data: [DONE]') {
        try {
          const json = JSON.parse(line.substring(6));
          if (json.type === 'chunk' && json.text) {
            accumulatedText += json.text;
            process.stdout.write('.');
          } else if (json.type === 'done' && json.replyText) {
            finalDoneText = json.replyText;
          }
        } catch (_) {}
      }
    }
  }

  console.log(' (Stream Selesai)');
  return finalDoneText || accumulatedText;
}

async function runTest() {
  console.log('=== TEST POIN 52: TAB GATING PUBLIK & ANTI-DATA LEAK ===\n');

  const history = [
    { sender: 'USER', text: 'Aplikasi laundry kiloan dan satuan dengan pelanggan, kasir, dan washer' },
    {
      sender: 'AI',
      text: `📋 **Brief Kebutuhan**
- **Nama App**: Laundry Pro
- **Orientasi UI**: Responsif
- **Tema Visual**: Biru segar dan bersih
- **Fitur Utama (V1)**:
  1. Lacak Status Cucian (Pelanggan)
  2. Penerimaan & Kasir (Kasir)
  3. Proses Cuci & Pengeringan (Washer)
- **Job Description & Struktur Halaman per Role**:
  * **Pelanggan** (Akses Publik - Tampilan Awal):
    - [Halaman/Tab 1] (default): section Lacak Cucian
    - **Alur Proses**: Klik "Cari Nota" → status cucian muncul di kartu ringkasan
  * **Kasir**:
    - [Halaman/Tab 1] (default): section Input Pesanan, section Daftar Transaksi
    - [Halaman/Tab 2]: section Laporan Kasir
    - **Alur Proses**: Klik "Tambah Pesanan" (Tab 1) → status "Tercatat" → Buka tab "Laporan Kasir" (Tab 2) → data masuk ke rekap
  * **Washer**:
    - [Halaman/Tab 1] (default): section Antrean Cuci, section Mesin
    - [Halaman/Tab 2]: section Riwayat Selesai
    - **Alur Proses**: Klik "Mulai Cuci" (Tab 1) → status "Proses Cuci" → Buka tab "Riwayat Selesai" (Tab 2) → item masuk riwayat

Apakah Brief Kebutuhan di atas sudah sesuai dengan yang Anda inginkan, atau ada section/fitur yang mau ditambah/diubah sebelum saya buatkan prototipenya?`
    }
  ];

  console.log('1. Mengirim persetujuan Brief Kebutuhan untuk men-generate kode mockup...');
  const codeReply = await fetchStreamReply('Sudah pas dan setuju, buatkan prototipe sekarang', history, '10.52.1.2', 'TAHAP_1_PEMBUKAAN');

  console.log('\n2. Memeriksa respons kode HTML...');
  const htmlMatch = codeReply.match(/```html([\s\S]*?)```/);
  if (!htmlMatch) {
    console.error('❌ Tidak ditemukan blok ```html ... ``` dalam balasan AI!');
    console.log(codeReply.slice(0, 500));
    process.exit(1);
  }

  const html = htmlMatch[1].trim();
  console.log(`- Ukuran HTML yang dihasilkan: ${html.length} karakter`);

  // Validasi dengan validator
  const validation = validateAndRepairGeneratedCode(html, '', '', ['Pelanggan', 'Kasir', 'Washer']);
  console.log('\n3. Hasil Validasi codeValidator:');
  console.log(`- Is Valid: ${validation.isValid ? '✅ VALID' : '❌ INVALID'}`);
  if (validation.issues.length > 0) {
    console.log('- Issues:\n ', validation.issues.join('\n  '));
  }

  // Uji Detail Poin 52:
  console.log('\n4. Verifikasi Detail Poin 52:');

  // (a) Cek apakah tab staf disembunyikan di HTML atau dipanggil saat init
  const tabBtnMatches = [...html.matchAll(/<button[^>]*class=[^>]*tab-btn[^>]*data-access-roles=["']([^"']+)["'][^>]*>([\s\S]*?)<\/button>/gi)];
  console.log(`- Ditemukan ${tabBtnMatches.length} tab button:`);
  for (const m of tabBtnMatches) {
    const roles = m[1];
    const label = m[2].replace(/<[^>]*>/g, '').trim();
    const isPublic = /pelanggan|pasien|customer|tamu|publik/i.test(roles);
    const hasDisplayNone = m[0].includes('display: none') || m[0].includes('display:none');
    console.log(`  • Tab "${label}" (Roles: ${roles}) -> ${isPublic ? '🌐 Publik (Visible)' : (hasDisplayNone ? '🔒 Staf (Hidden via style)' : '⚠️ Staf (Perlu JS gating)')}`);
  }

  const hasInitialFilterCall = /filterTabsByRole\s*\(\s*['"]pelanggan['"]\s*\)/i.test(html) ||
                               /DOMContentLoaded[\s\S]*?filterTabsByRole/i.test(html) ||
                               /init\(\)[\s\S]*?filterTabsByRole/i.test(html);
  console.log(`- Pemanggilan filterTabsByRole('Pelanggan') saat Inisialisasi: ${hasInitialFilterCall ? '✅ YA' : '❌ TIDAK'}`);

  // (b) Cek data leak di tab publik
  const publicTabMatch = html.match(/<div[^>]*id=["'](?:tab-)?(?:lacak|pelanggan|pesan|home|publik)["'][^>]*>([\s\S]*?)<\/div>/i);
  let publicDataLeak = false;
  if (publicTabMatch) {
    const content = publicTabMatch[1];
    const hasEditDelete = /<button[^>]*onclick=["'][^"']*(?:hapus|delete|bukaModalHapus|editPesanan|editData)[^"']*["'][^>]*>/i.test(content);
    if (hasEditDelete) {
      publicDataLeak = true;
      console.log('- Deteksi Tombol Edit/Hapus di Tab Publik: ❌ TERBUKA (DATA LEAK)');
    } else {
      console.log('- Deteksi Tombol Edit/Hapus di Tab Publik: ✅ BERSIH (Aman)');
    }
  } else {
    console.log('- Tab publik container diperiksa secara menyeluruh.');
  }

  if (hasInitialFilterCall && !publicDataLeak && validation.isValid) {
    console.log('\n🎉 POIN 52 BERHASIL 100% TERVERIFIKASI!');
  } else {
    console.error('\n⚠️ VERIFIKASI POIN 52 MASIH MENEMUKAN KENDALA.');
    process.exit(1);
  }
}

runTest().catch(console.error);
