import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MarkdownMessage } from '../src/components/MarkdownMessage';

async function testMarkdownRendering() {
  console.log('=== MEMULAI TEST RENDER MARKDOWN GFM (TABEL, HEADING, LIST, BOLD) ===\n');

  const testContent = `Berikut tabel ringkasan peran yang sudah disepakati:

| Peran | Status | Tanggung Jawab Utama |
|---|---|---|
| Super Admin | Wajib (Owner) | Memantau ringkasan omzet dan transaksi harian; Mendaftarkan dan mengelola hak akses akun staf |
| Staf Kasir | Aktif | Melayani pembayaran dan mencatat transaksi pelanggan |
| Pelanggan | Tidak Dipakai | Tidak perlu akun terpisah, interaksi lewat kasir |

### Bagian B: Alur Sistem & Fitur Pendukung

#### 1. Alur Inti (Aktivitas Utama)
1. *(Pelanggan)* Datang ke lokasi
2. *(Staf Kasir)* Mencatat pesanan dan menerima uang
3. *(Super Admin)* Memantau laporan omzet harian

> ❓ **Apakah alur di atas sudah pas dengan kebutuhan operasionalmu?**

- Fitur cetak nota PDF
- Dasbor pemantauan antrean real-time
`;

  // Render komponen ke static HTML string
  const html = renderToStaticMarkup(
    React.createElement(MarkdownMessage, { content: testContent, isUser: false })
  );

  console.log('[HTML Output Preview]:\n', html.slice(0, 500) + '...\n');

  // 1. Verifikasi render Tabel GFM
  const hasTable = html.includes('<table');
  const hasThead = html.includes('<thead');
  const hasTbody = html.includes('<tbody');
  const hasThPeran = html.includes('Peran') && html.includes('<th');
  const hasTdSuperAdmin = html.includes('Super Admin') && html.includes('<td');
  const hasTdPelanggan = html.includes('Pelanggan') && html.includes('<td');
  const hasTableScrollWrapper = html.includes('overflow-x-auto') && html.includes('<table');

  console.log('--- 1. Pengujian Tabel Markdown GFM ---');
  console.log(`- Tag <table> terbentuk: ${hasTable ? 'PASS' : 'FAIL'}`);
  console.log(`- Tag <thead> terbentuk: ${hasThead ? 'PASS' : 'FAIL'}`);
  console.log(`- Tag <tbody> terbentuk: ${hasTbody ? 'PASS' : 'FAIL'}`);
  console.log(`- Kolom Header (<th>Peran</th>) ada: ${hasThPeran ? 'PASS' : 'FAIL'}`);
  console.log(`- Baris Sel (<td>Super Admin</td>) ada: ${hasTdSuperAdmin ? 'PASS' : 'FAIL'}`);
  console.log(`- Baris Sel (<td>Pelanggan</td>) ada: ${hasTdPelanggan ? 'PASS' : 'FAIL'}`);
  console.log(`- Wrapper responsif HP (overflow-x-auto) terpasang: ${hasTableScrollWrapper ? 'PASS' : 'FAIL'}`);

  if (!hasTable || !hasThead || !hasTbody || !hasThPeran || !hasTdSuperAdmin || !hasTableScrollWrapper) {
    throw new Error('Test Tabel Markdown GFM GAGAL!');
  }

  // 2. Verifikasi render Heading (### & ####)
  console.log('\n--- 2. Pengujian Heading Markdown ---');
  const hasH3 = html.includes('<h3') && html.includes('Bagian B: Alur Sistem');
  const hasH4 = html.includes('<h4') && html.includes('1. Alur Inti');
  console.log(`- Heading <h3> terbentuk: ${hasH3 ? 'PASS' : 'FAIL'}`);
  console.log(`- Heading <h4> terbentuk: ${hasH4 ? 'PASS' : 'FAIL'}`);

  if (!hasH3 || !hasH4) {
    throw new Error('Test Heading Markdown GAGAL!');
  }

  // 3. Verifikasi render List (Ol & Ul)
  console.log('\n--- 3. Pengujian List (Ol & Ul) ---');
  const hasOl = html.includes('<ol') && html.includes('Datang ke lokasi');
  const hasUl = html.includes('<ul') && html.includes('Fitur cetak nota PDF');
  console.log(`- Ordered List <ol> terbentuk: ${hasOl ? 'PASS' : 'FAIL'}`);
  console.log(`- Unordered List <ul> terbentuk: ${hasUl ? 'PASS' : 'FAIL'}`);

  if (!hasOl || !hasUl) {
    throw new Error('Test List Markdown GAGAL!');
  }

  // 4. Verifikasi render Bold (**teks**) dan Blockquote (> teks)
  console.log('\n--- 4. Pengujian Bold & Blockquote ---');
  const hasBold = html.includes('<strong') && html.includes('Apakah alur di atas sudah pas');
  const hasBlockquote = html.includes('<blockquote');
  console.log(`- Bold <strong> terbentuk: ${hasBold ? 'PASS' : 'FAIL'}`);
  console.log(`- Blockquote <blockquote> terbentuk: ${hasBlockquote ? 'PASS' : 'FAIL'}`);

  if (!hasBold || !hasBlockquote) {
    throw new Error('Test Bold & Blockquote GAGAL!');
  }

  // 5. Verifikasi bahwa pesan USER tetap teks biasa tanpa wrapping berlebihan
  console.log('\n--- 5. Pengujian Bubble USER ---');
  const userHtml = renderToStaticMarkup(
    React.createElement(MarkdownMessage, { content: 'Ini pesan dari pengguna', isUser: true })
  );
  const isPlainUser = userHtml.includes('whitespace-pre-wrap') && !userHtml.includes('<table');
  console.log(`- Bubble pesan USER rapi dan simpel: ${isPlainUser ? 'PASS' : 'FAIL'}`);

  console.log('\n======================================================');
  console.log('SEMUA PENGUJIAN MARKDOWN RENDERER LULUS 100%! 🎉');
  console.log('======================================================');
}

testMarkdownRendering().catch((err) => {
  console.error('\n❌ ERROR:', err);
  process.exit(1);
});
