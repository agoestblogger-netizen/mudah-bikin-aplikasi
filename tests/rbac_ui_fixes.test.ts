import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MarkdownMessage } from '../src/components/MarkdownMessage';
import { renderRbacMarkdownTable } from '../src/lib/templates/processes/guided';

async function runRbacUiFixesTest() {
  console.log('=== TEST SUITE: RBAC UI FIXES (<br> HANDLING & RESPONSIVE TABLE) ===\n');
  let allPassed = true;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      allPassed = false;
    }
  }

  // -------------------------------------------------------------------------
  // TEST 1: TEMUAN 1 - DUKUNGAN <br> DAN ANTI-BOCOR TEKS MENTAH
  // -------------------------------------------------------------------------
  console.log('--- TEST 1: Penanganan Tag <br> pada MarkdownMessage ---');

  // String markdown yang memuat tag <br> baik di dalam sel tabel maupun paragraf biasa
  const markdownWithBr = `
| Modul | Keterangan |
|---|---|
| Modul A<br>Deskripsi baris kedua | Nilai 1<br>Nilai 2 |

Paragraf dengan baris baru manual<br>setelah tag break.
`;

  const htmlOutput = renderToStaticMarkup(
    React.createElement(MarkdownMessage, { content: markdownWithBr, isUser: false })
  );

  // Verifikasi bahwa <br> diubah menjadi elemen HTML <br/> atau <br>, BUKAN teks mentah &lt;br&gt; atau escaped string
  const hasRealBrTag = htmlOutput.includes('<br/>') || htmlOutput.includes('<br>');
  const hasEscapedBrText = htmlOutput.includes('&lt;br&gt;') || htmlOutput.includes('&lt;br/&gt;');
  
  assert(hasRealBrTag, 'Tag <br> berhasil dirender menjadi elemen HTML line break');
  assert(!hasEscapedBrText, 'Tidak ada tag <br> yang bocor sebagai teks mentah &lt;br&gt;');

  // -------------------------------------------------------------------------
  // TEST 2: RESTRUKTURISASI TABEL RBAC (PEMBERSIHAN SEL & KETERANGAN MODUL)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 2: Restrukturisasi Tabel RBAC di guided.ts ---');

  const koperasiRoles = ['Anggota', 'Kasir Operasional', 'Pengurus Koperasi', 'Super Admin'];
  const koperasiModul = [
    {
      nama: 'Pengajuan Pinjaman Mandiri',
      deskripsiFungsional: 'Saluran bagi Anggota untuk mengajukan permohonan pinjaman dana secara mandiri beserta dokumen jaminan',
      izinPerRole: [
        { role: 'Anggota', level: 'Buat & Pantau (Milik Sendiri)' },
        { role: 'Kasir Operasional', level: 'Verifikasi Berkas Masuk' },
        { role: 'Pengurus Koperasi', level: 'Otorisasi Plafon Pinjaman' },
        { role: 'Super Admin', level: 'Supervisi & Kontrol Penuh' }
      ]
    },
    {
      nama: 'Pencairan Kredit & Kasir',
      deskripsiFungsional: 'Loket verifikasi berkas fisik dan pencairan dana pinjaman yang telah disetujui Pengurus',
      izinPerRole: [
        { role: 'Anggota', level: '-' },
        { role: 'Kasir Operasional', level: 'Eksekusi Pencairan & Cetak Bukti' },
        { role: 'Pengurus Koperasi', level: 'Audit Rekap Pencairan' },
        { role: 'Super Admin', level: 'Supervisi & Kontrol Penuh' }
      ]
    }
  ];

  const catatanPelimpahan = [
    'Wewenang Petugas Lapangan dialihkan ke Kasir Operasional karena perampingan staf'
  ];

  const generatedTableMd = renderRbacMarkdownTable(koperasiRoles, koperasiModul, catatanPelimpahan);

  // 2a. Sel tabel HANYA memuat nama modul ringkas (tanpa deskripsi panjang / tanpa <br>)
  assert(!generatedTableMd.includes('<br>'), 'Tabel RBAC tidak lagi menyuntikkan tag <br> ke dalam baris sel tabel');
  assert(generatedTableMd.includes('| **Pengajuan Pinjaman Mandiri** |'), 'Sel modul memuat nama modul ringkas dengan cetak tebal');

  // 2b. Deskripsi fungsional hadir rapi di bawah tabel
  assert(generatedTableMd.includes('> 📋 **Keterangan Modul Fungsional:**'), 'Blok Keterangan Modul Fungsional hadir di bawah tabel');
  assert(
    generatedTableMd.includes('Saluran bagi Anggota untuk mengajukan permohonan pinjaman dana'),
    'Isi deskripsi fungsional modul tersaji lengkap dan terstruktur di catatan'
  );

  // 2c. Catatan pelimpahan tetap terjaga
  assert(
    generatedTableMd.includes('> ℹ️ **Catatan Wewenang & Pelimpahan Tugas:**'),
    'Catatan pelimpahan tugas tetap ada dan terpelihara'
  );

  // -------------------------------------------------------------------------
  // TEST 3: RENDER LENGKAP TABEL KOPERASI & VERIFIKASI RESPONSIF
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 3: Render Penuh Matriks RBAC Koperasi & Kelas Responsif ---');

  const fullKoperasiHtml = renderToStaticMarkup(
    React.createElement(MarkdownMessage, { content: generatedTableMd, isUser: false })
  );

  // Verifikasi elemen tabel
  assert(fullKoperasiHtml.includes('<table'), 'Elemen <table> terbentuk');
  assert(fullKoperasiHtml.includes('<th'), 'Elemen <th> terbentuk');
  assert(fullKoperasiHtml.includes('<td'), 'Elemen <td> terbentuk');

  // Verifikasi kelas responsif dan text-wrap
  assert(fullKoperasiHtml.includes('overflow-x-auto'), 'Container tabel memiliki kelas scroll overflow-x-auto');
  assert(fullKoperasiHtml.includes('text-wrap'), 'Header dan sel tabel memiliki kelas text-wrap');
  assert(fullKoperasiHtml.includes('break-words'), 'Header dan sel tabel memiliki kelas break-words');
  assert(fullKoperasiHtml.includes('pointer-events-none'), 'Indikator gradient scroll tepi layar sempit terpasang');

  // Verifikasi role dash (-) styling
  assert(fullKoperasiHtml.includes('text-zinc-600'), 'Izin kosong (-) menggunakan styling muted text-zinc-600');

  // -------------------------------------------------------------------------
  // TEST 4: REGRESI TABEL LAIN (RINGKASAN ROLE & SKEMA DATA)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 4: Regresi Tabel Markdown Lain (Ringkasan Role & Skema) ---');

  const otherTableMd = `
| Nama Tabel | Kolom Utama | Relasi |
|---|---|---|
| anggota | id, nama, no_ktp, no_wa | 1-to-many ke simpanan |
| pinjaman | id, anggota_id, nominal, status | many-to-1 ke anggota |
`;

  const otherHtml = renderToStaticMarkup(
    React.createElement(MarkdownMessage, { content: otherTableMd, isUser: false })
  );

  assert(otherHtml.includes('<table'), 'Tabel skema data tetap dirender sempurna');
  assert(otherHtml.includes('anggota') && otherHtml.includes('pinjaman'), 'Konten tabel skema data utuh');
  assert(otherHtml.includes('overflow-x-auto'), 'Tabel skema data juga mewarisi container responsif');

  console.log('\n===================================================================');
  if (allPassed) {
    console.log('🎉 SEMUA PENGUJIAN PERBAIKAN UI RBAC LULUS 100%!');
  } else {
    throw new Error('Beberapa pengujian perbaikan UI RBAC GAGAL!');
  }
}

runRbacUiFixesTest().catch((e) => {
  console.error(e);
  process.exit(1);
});
