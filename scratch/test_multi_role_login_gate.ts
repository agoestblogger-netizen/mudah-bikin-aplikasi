async function testMultiRoleLoginGate() {
  console.log('=== TEST MULTI-ROLE SIMULATED LOGIN GATE (BAGIAN 2) ===\n');

  // Test 1: Generate Mockup Multi-Role (Laundry 4-Role)
  console.log('--- TEST 1: Generate Mockup Multi-Role Laundry (Admin, Kasir, Washer, Pelanggan) ---');
  const resMulti = await fetch('http://localhost:3000/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: 'ya sudah sesuai dan pas, buatkan aplikasi prototipenya sekarang',
      chatHistory: [
        { sender: 'USER', text: 'buatkan aplikasi laundry kiloan' },
        { sender: 'AI', text: '📋 **Brief Kebutuhan**\n- **Nama App**: LaundryKu Pro\n- **Orientasi UI**: Mobile-first\n- **Tema Visual**: Biru segar modern\n- **Fitur Utama (V1)**:\n  1. Kasir POS\n  2. Antrian Cuci\n  3. Lacak Resi\n  4. Dashboard Omset\n- **Roadmap Lanjutan (V2/V3)**: Notifikasi WA otomatis\n- **Job Description & Struktur Halaman per Role** (Mekanisme Akses: Login demo Admin, Kasir, Washer + Akses Publik Pelanggan):\n  * **Admin**:\n    - Dashboard (default): section Ringkasan Omset, section Laporan Cuci\n  * **Kasir**:\n    - Kasir POS (default): section Form Order Baru, section Pembayaran\n  * **Washer**:\n    - Antrian Kerja (default): section Antrian Cuci, section Tombol Selesai\n  * **Pelanggan**:\n    - Lacak Resi (default): section Input Resi, section Status Progres' },
        { sender: 'USER', text: 'ya sudah sesuai dan pas, buatkan aplikasi prototipenya sekarang' }
      ],
      stage: 'TAHAP_1_PEMBUKAAN',
      currentCode: null
    })
  });

  const jsonMulti = await resMulti.json();
  console.log('Multi-role Success:', jsonMulti.success);
  const htmlMulti = jsonMulti.code?.html || '';
  console.log('HTML Length:', htmlMulti.length);

  const hasLoginScreen = htmlMulti.includes('loginScreen');
  const hasLoginAsFunc = htmlMulti.includes('loginAs(');
  const hasLogoutFunc = htmlMulti.includes('logout()');
  const hasAdminDemo = htmlMulti.includes("loginAs('Admin')") || htmlMulti.includes('loginAs("Admin")');
  const hasKasirDemo = htmlMulti.includes("loginAs('Kasir')") || htmlMulti.includes('loginAs("Kasir")');
  const hasPublicAccess = htmlMulti.includes('Pelanggan') || htmlMulti.includes('Lacak') || htmlMulti.includes('Publik');

  console.log('1. Memiliki id="loginScreen" (Layar Login Simulasi):', hasLoginScreen);
  console.log('2. Memiliki fungsi loginAs(role):', hasLoginAsFunc);
  console.log('3. Memiliki fungsi logout() / Keluar Akun:', hasLogoutFunc);
  console.log('4. Memiliki tombol Akun Demo Admin:', hasAdminDemo);
  console.log('5. Memiliki tombol Akun Demo Kasir:', hasKasirDemo);
  console.log('6. Memiliki opsi Akses Publik Pelanggan:', hasPublicAccess);

  if (hasLoginScreen && hasLoginAsFunc && hasLogoutFunc) {
    console.log('\n✅ PASS: Mockup Multi-Role berhasil menerapkan Gerbang Layar Login Simulasi!');
  } else {
    console.error('\n❌ FAIL: Mockup Multi-Role belum memenuhi semua syarat login screen!');
  }
}

testMultiRoleLoginGate().catch(console.error);
