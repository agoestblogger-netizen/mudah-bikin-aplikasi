import { validateAndRepairGeneratedCode } from '../src/lib/codeValidator';

async function testPoin45() {
  console.log('=== TEST POIN 45: LAYAR LOGIN PRODUKSI & HALAMAN PUBLIK DEFAULT ===\n');

  // Case 1: App Klinik dengan Halaman Publik (Pasien)
  console.log('--- TEST 1: App Klinik dengan Halaman Publik (Dokter, Staf Klinik, Pasien) ---');
  const clinicBrief = `📋 **Brief Kebutuhan**
- **Nama App**: Antrian Klinik Cerdas
- **Orientasi UI**: Desktop-first
- **Tema Visual**: Biru medis profesional & segar
- **Fitur Utama (V1)**:
  1. Pasien: Cek status dan estimasi antrean
  2. Staf Klinik: Panggil nomor antrean & kelola layanan
  3. Dokter: Input diagnosa dan resep pasien
- **Job Description & Struktur Halaman per Role**:
  * **Dokter**:
    - Pemeriksaan (default): section Pasien Menunggu
    - Alur Proses: Klik "Pilih Pasien" → status berubah jadi "Diperiksa"
  * **Staf Klinik**:
    - Antrian (default): section Antrean Aktif
    - Alur Proses: Klik "Panggil Nomor" → status berubah jadi "Dipanggil"
  * **Pasien**:
    - Status Antrean (default): section Cek No Antrean
    - Alur Proses: Klik "Cek Status" → status nomor antrean muncul`;

  const res1 = await fetch('http://localhost:3000/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: 'buatkan prototipe sekarang',
      chatHistory: [
        { sender: 'USER', text: 'buatkan aplikasi klinik dengan 3 role: Dokter, Staf Klinik, Pasien' },
        { sender: 'AI', text: clinicBrief },
        { sender: 'USER', text: 'ya sudah sesuai dan pas, buatkan prototipenya sekarang' }
      ],
      stage: 'TAHAP_1_PEMBUKAAN',
      currentCode: null
    })
  });

  const json1 = await res1.json();
  if (!json1.success) {
    console.error('❌ API Error Test 1:', json1.error);
    return;
  }

  const html1 = json1.code?.html || '';
  const reply1 = json1.replyText || '';

  console.log(`HTML Length: ${html1.length} chars`);
  console.log(`Reply Text:\n${reply1}\n`);

  // Verifikasi 1: Keberadaan input username & password
  const hasUsernameInput = /id\s*=\s*['"](?:loginUsername|username)['"]/i.test(html1);
  const hasPasswordInput = /id\s*=\s*['"](?:loginPassword|password)['"]/i.test(html1);
  console.log(`[Cek 1.1] Input Username: ${hasUsernameInput ? '✅ ADA' : '❌ HILANG'}`);
  console.log(`[Cek 1.2] Input Password: ${hasPasswordInput ? '✅ ADA' : '❌ HILANG'}`);

  // Verifikasi 2: Form Login Produksi (Bukan Tombol Pilih Peran)
  const hasRoleButtons = /Masuk sebagai\s+(?:Dokter|Staf|Pasien)/i.test(html1);
  console.log(`[Cek 1.3] Tombol pilih peran lama: ${!hasRoleButtons ? '✅ BERSIH (Digantikan form login)' : '❌ MASIH ADA'}`);

  // Verifikasi 3: Tombol Login Staf di Header & Modal Login
  const hasLoginStaffBtn = /id\s*=\s*['"](?:btnLoginStaff|btnLogin)['"]|onclick\s*=\s*['"]bukaModalLogin\(\)['"]/i.test(html1) || /Login\s*Staf|Login/i.test(html1);
  console.log(`[Cek 1.4] Tombol Login Staf di Header: ${hasLoginStaffBtn ? '✅ ADA' : '❌ HILANG'}`);

  // Verifikasi 4: Petunjuk Penggunaan di Reply Text
  const hasReplyPublicGuide = reply1.includes('Pasien') && (reply1.includes('publik') || reply1.includes('tanpa login'));
  const hasReplyCredentials = reply1.includes('dokter') && reply1.includes('dokter123') && reply1.includes('stafklinik');
  console.log(`[Cek 1.5] Petunjuk Landing Publik di Chat: ${hasReplyPublicGuide ? '✅ TERCANTUM' : '❌ HILANG'}`);
  console.log(`[Cek 1.6] Daftar Kredensial Demo di Chat: ${hasReplyCredentials ? '✅ LENGKAP' : '❌ HILANG'}`);

  // Case 2: App Murni Internal Tanpa Halaman Publik (Admin, Dokter, Apoteker)
  console.log('\n--- TEST 2: App Internal Tanpa Halaman Publik (Dokter, Apoteker, Kasir) ---');
  const internalBrief = `📋 **Brief Kebutuhan**
- **Nama App**: SIM RS Internal
- **Fitur Utama (V1)**:
  1. Dokter: Rekam Medis
  2. Apoteker: Resep & Obat
  3. Kasir: Pembayaran
- **Job Description & Struktur Halaman per Role**:
  * **Dokter**:
    - Rekam Medis (default): section Pasien
    - Alur Proses: Klik "Input" → status berubah jadi "Tersimpan"
  * **Apoteker**:
    - Resep (default): section Resep Masuk
    - Alur Proses: Klik "Siapkan" → status berubah jadi "Siap"
  * **Kasir**:
    - Kasir (default): section Tagihan
    - Alur Proses: Klik "Bayar" → status berubah jadi "Lunas"`;

  const res2 = await fetch('http://localhost:3000/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: 'buatkan prototipe sekarang',
      chatHistory: [
        { sender: 'USER', text: 'buatkan aplikasi internal rumah sakit dengan role: Dokter, Apoteker, Kasir' },
        { sender: 'AI', text: internalBrief },
        { sender: 'USER', text: 'sudah pas, buatkan sekarang' }
      ],
      stage: 'TAHAP_1_PEMBUKAAN',
      currentCode: null
    })
  });

  const json2 = await res2.json();
  const html2 = json2.code?.html || '';
  const reply2 = json2.replyText || '';

  console.log(`HTML 2 Length: ${html2.length} chars`);
  console.log(`Reply 2 Text:\n${reply2}\n`);

  const hasLoginScreen2 = /id\s*=\s*['"]loginScreen['"]/i.test(html2);
  const hasReplyCredentials2 = reply2.includes('dokter') && reply2.includes('apoteker') && reply2.includes('kasir');
  console.log(`[Cek 2.1] Layar Login Awal untuk App Internal: ${hasLoginScreen2 ? '✅ ADA' : '❌ HILANG'}`);
  console.log(`[Cek 2.2] Daftar Kredensial Demo di Chat: ${hasReplyCredentials2 ? '✅ LENGKAP' : '❌ HILANG'}`);

  console.log('\n============================================================');
  console.log('🎉 SEMUA PENGUJIAN POIN 45 SELESAI!');
  console.log('============================================================\n');
}

testPoin45().catch(console.error);
