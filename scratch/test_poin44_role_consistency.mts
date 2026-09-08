/**
 * TEST POIN 44: Verifikasi Konsistensi Peran & Pencegahan Kontaminasi Peran Asing
 * Skenario: App Klinik dengan Brief Kebutuhan 3-Role (Dokter, Staf Klinik, Pasien)
 */

async function testPoin44RoleConsistency() {
  console.log('=== TEST POIN 44: KONSISTENSI PERAN & ANTI-KONTAMINASI ===\n');

  const briefMsg = `📋 **Brief Kebutuhan**
- **Nama App**: Antrian Klinik Cerdas
- **Orientasi UI**: Desktop-first
- **Tema Visual**: Biru medis profesional & segar
- **Fitur Utama (V1)**:
  1. Pasien: Cek status dan estimasi antrean
  2. Staf Klinik: Panggil nomor antrean & kelola layanan
  3. Dokter: Input diagnosa dan resep pasien
- **Roadmap Lanjutan (V2/V3)**: Booking online, riwayat rekam medis digital
- **Job Description & Struktur Halaman per Role**:
  * **Dokter**:
    - Pemeriksaan (default): section Pasien Menunggu, section Form Diagnosa & Resep
    - Alur Proses: Klik "Pilih Pasien" → data pasien muncul → Klik "Simpan Diagnosa" → status berubah jadi "Selesai Diperiksa"
  * **Staf Klinik**:
    - Antrian (default): section Antrean Aktif, section Daftar Pasien
    - Layanan: section Master Layanan
    - Alur Proses: Klik "Panggil Nomor" → status antrean berubah jadi "Dipanggil" → Klik "Selesai" → status berubah jadi "Selesai"
  * **Pasien**:
    - Status Antrean (default): section Cek No Antrean, section Estimasi Waktu
    - Alur Proses: Klik "Cek Status" → status nomor antrean muncul di layar

Apakah Brief Kebutuhan di atas sudah sesuai dengan yang Anda inginkan, atau ada section/fitur yang mau ditambah/diubah sebelum saya buatkan prototipenya?`;

  console.log('1. Mengirim request generate kode dengan riwayat Brief Kebutuhan Klinik 3-Role...');
  const res = await fetch('http://localhost:3000/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: 'buatkan prototipe sekarang',
      chatHistory: [
        { sender: 'USER', text: 'buatkan aplikasi antrian klinik dengan 3 role: Dokter, Staf Klinik, Pasien' },
        { sender: 'AI', text: briefMsg },
        { sender: 'USER', text: 'ya sudah sesuai dan pas, buatkan aplikasi prototipenya sekarang' }
      ],
      stage: 'TAHAP_1_PEMBUKAAN',
      currentCode: null
    })
  });

  const json = await res.json();
  if (!json.success) {
    console.error('❌ API Error:', json.error);
    return;
  }

  const html: string = json.code?.html || '';
  console.log(`\nHTML Length: ${html.length} chars`);
  
  if (!html) {
    console.error('❌ Tidak ada kode HTML yang dihasilkan. Reply text:\n', json.replyText);
    return;
  }

  // Cek 1: Ekstraksi tombol loginAs(...)
  const loginAsCalls = [...html.matchAll(/loginAs\(\s*['"]([^'"]+)['"]\s*\)/g)].map(m => m[1].trim());
  const uniqueLoginRoles = [...new Set(loginAsCalls)];
  console.log('\n[Cek 1] Tombol loginAs() yang ditemukan di HTML:', uniqueLoginRoles);

  // Cek 2: Deteksi kontaminasi peran asing
  const foreignRoles = ['Washer', 'Kasir', 'Admin', 'Petugas', 'Owner', 'Manager'];
  const contaminated = uniqueLoginRoles.filter(r => foreignRoles.includes(r) && !['Dokter', 'Staf Klinik', 'Pasien'].includes(r));
  console.log(`[Cek 2] Deteksi peran asing/tercemar (Washer, Kasir, Admin, dll): ${contaminated.length === 0 ? '✅ BERSIH TOTAL (0 peran asing)' : '❌ TERCEMAR: ' + contaminated.join(', ')}`);

  // Cek 3: Verifikasi keberadaan 3 peran resmi klinik
  const hasDokter = uniqueLoginRoles.includes('Dokter');
  const hasStaf = uniqueLoginRoles.some(r => r.toLowerCase().includes('staf'));
  const hasPasien = uniqueLoginRoles.some(r => r.toLowerCase().includes('pasien'));
  console.log(`[Cek 3] Keberadaan peran resmi Brief:`);
  console.log(`  - Dokter: ${hasDokter ? '✅ ADA' : '❌ HILANG'}`);
  console.log(`  - Staf Klinik: ${hasStaf ? '✅ ADA' : '❌ HILANG'}`);
  console.log(`  - Pasien: ${hasPasien ? '✅ ADA' : '❌ HILANG'}`);

  // Cek 4: Verifikasi data-access-roles pada tab-btn
  const tabBtns = [...html.matchAll(/<button[^>]*class=[^>]*tab-btn[^>]*data-access-roles=["']([^"']+)["'][^>]*>/gi)];
  console.log(`\n[Cek 4] Tab buttons dengan data-access-roles (${tabBtns.length} tab):`);
  let hasContaminatedTabRoles = false;
  tabBtns.forEach((t, i) => {
    const rolesInTab = t[1].split(',').map((r: string) => r.trim());
    console.log(`  Tab ${i + 1}: data-access-roles="${t[1]}"`);
    rolesInTab.forEach((r: string) => {
      if (foreignRoles.includes(r) && !['Dokter', 'Staf Klinik', 'Pasien'].includes(r)) {
        console.log(`    ⚠️ TERCEMAR role asing di tab: "${r}"`);
        hasContaminatedTabRoles = true;
      }
    });
  });
  console.log(`  Status data-access-roles: ${!hasContaminatedTabRoles ? '✅ BERSIH DARI ROLE ASING' : '❌ ADA ROLE ASING'}`);

  // Ringkasan
  const allPass = (contaminated.length === 0) && hasDokter && hasStaf && hasPasien && !hasContaminatedTabRoles;
  console.log('\n============================================================');
  if (allPass) {
    console.log('🎉 SEMUA CEK PASS: Kode 100% konsisten dengan Brief Kebutuhan resmi!');
  } else {
    console.log('❌ GAGAL: Masih ada ketidakkonsistenan peran.');
  }
  console.log('============================================================\n');
}

testPoin44RoleConsistency().catch(console.error);
