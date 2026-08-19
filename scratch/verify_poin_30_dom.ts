import { detectMatchingMasterTemplate, detectSelectivePageTemplates, formatSelectivePageTemplatesForCodeGen } from '../src/lib/templates';
import { validateAndRepairGeneratedCode } from '../src/lib/codeValidator';
import { JSDOM } from 'jsdom';

async function verifyPoin30() {
  console.log('=== VERIFIKASI KETAT POIN 30: DEFAULT TAB & VISIBILITAS PER ROLE ===\n');

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

  console.log('1. Mengirim permintaan generate kode ke https://www.mudahbikinapps.store/api/generate...');
  const startTime = Date.now();
  const response = await fetch('https://www.mudahbikinapps.store/api/generate', {
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

  const durationMs = Date.now() - startTime;
  console.log(`   - Waktu respons: ${(durationMs / 1000).toFixed(2)} detik`);

  const result = await response.json();
  console.log('   - Success:', result.success);
  console.log('   - Code Object:', Boolean(result.code));
  
  if (!result.code?.html) {
    console.error('FAILED: result.code.html is empty! Reply text:', result.replyText?.slice(0, 300));
    return;
  }

  const rawHtml = result.code.html;
  console.log('   - Panjang HTML:', rawHtml.length, 'karakter');

  // 2. Validasi NFR-10b
  console.log('\n2. Validasi Integritas DOM & JavaScript:');
  const val = validateAndRepairGeneratedCode(rawHtml, '', '');
  console.log('   - Valid:', val.isValid);
  console.log('   - Issues:', val.issues);

  // 3. Simulasi DOM dengan JSDOM
  console.log('\n3. Menguji Eksekusi DOM & Fungsi switchRole() di Lingkungan Browser Nyata:');
  const dom = new JSDOM(rawHtml, {
    runScripts: 'dangerously',
    resources: 'usable',
    url: 'http://localhost/'
  });

  const { window } = dom;
  const { document } = window;

  // Eksekusi script inline di window context jika belum terikat
  const scriptTags = Array.from(document.querySelectorAll('script'));
  scriptTags.forEach(s => {
    if (s.textContent) {
      try {
        (window as any).eval(s.textContent);
      } catch (e) {
        console.warn('Script eval note:', (e as any).message);
      }
    }
  });

  await new Promise(r => setTimeout(r, 200));


  const rolesToTest = ['Admin', 'Kasir', 'Petugas', 'Pelanggan'];
  
  console.log('\n4. Hasil Pengujian Tab Default & Visibilitas Tombol Tab:');
  console.log('--------------------------------------------------------------------------------');
  
  for (const role of rolesToTest) {
    console.log(`\n👉 MENGUJI ROLE: [${role}]`);
    
    // Panggil switchRole
    if (typeof (window as any).switchRole === 'function') {
      (window as any).switchRole(role);
    } else {
      console.error(`   ❌ Fungsi switchRole() tidak terdefinisi di window!`);
      continue;
    }

    // Periksa activeTab
    const currentActiveTab = (window as any).activeTab;
    console.log(`   * Active Tab Saat Ini: "${currentActiveTab}"`);

    // Periksa tab konten yang aktif (.tab-content.active)
    const activeContent = document.querySelector('.tab-content.active');
    console.log(`   * Tab Content yang Ditampilkan: ID="${activeContent?.id || 'none'}"`);

    // Periksa visibilitas semua tombol tab
    const tabButtons = Array.from(document.querySelectorAll('.tab-btn, button[onclick*="showTab"], button[onclick*="switchTab"]'));
    const visibleTabs: string[] = [];
    const hiddenTabs: string[] = [];

    tabButtons.forEach((btn: any) => {
      const isHidden = btn.style.display === 'none' || btn.hidden || btn.classList.contains('hidden');
      const text = btn.textContent.trim().replace(/\s+/g, ' ');
      if (isHidden) {
        hiddenTabs.push(text);
      } else {
        visibleTabs.push(text);
      }
    });

    console.log(`   * Tab yang MUNCUL (Visible): [ ${visibleTabs.join(' | ')} ]`);
    console.log(`   * Tab yang DISEMBUNYIKAN (Hidden): [ ${hiddenTabs.join(' | ')} ]`);

    // Verifikasi aturan spesifik
    if (role === 'Admin') {
      const ok = currentActiveTab === 'dashboard' || activeContent?.id.includes('dashboard');
      console.log(`   * Verifikasi Default Landing: ${ok ? '✅ Lolos (Dashboard)' : '❌ Regresi (Bukan Dashboard)'}`);
    } else if (role === 'Kasir') {
      const ok = currentActiveTab !== 'dashboard' && (currentActiveTab === 'kasir' || currentActiveTab === 'order' || activeContent?.id.includes('kasir') || activeContent?.id.includes('order') || activeContent?.id.includes('pesanan'));
      const noDashboard = !visibleTabs.some(t => t.toLowerCase().includes('dashboard'));
      console.log(`   * Verifikasi Default Landing: ${ok ? '✅ Lolos (Kasir / Input Pesanan)' : '❌ Regresi (Masih Dashboard)'}`);
      console.log(`   * Verifikasi Tab Dashboard Tersembunyi: ${noDashboard ? '✅ Lolos' : '❌ Regresi (Dashboard Masih Terlihat)'}`);
    } else if (role === 'Petugas') {
      const ok = currentActiveTab !== 'dashboard' && (currentActiveTab === 'antrian' || currentActiveTab === 'tugas' || activeContent?.id.includes('antrian') || activeContent?.id.includes('cucian') || activeContent?.id.includes('tugas'));
      const noDashboard = !visibleTabs.some(t => t.toLowerCase().includes('dashboard'));
      console.log(`   * Verifikasi Default Landing: ${ok ? '✅ Lolos (Antrian Kerja Cucian)' : '❌ Regresi (Masih Dashboard)'}`);
      console.log(`   * Verifikasi Tab Dashboard Tersembunyi: ${noDashboard ? '✅ Lolos' : '❌ Regresi (Dashboard Masih Terlihat)'}`);
    } else if (role === 'Pelanggan') {
      const ok = currentActiveTab !== 'dashboard' && (currentActiveTab === 'lacak' || currentActiveTab === 'status' || activeContent?.id.includes('lacak') || activeContent?.id.includes('status'));
      const noDashboard = !visibleTabs.some(t => t.toLowerCase().includes('dashboard'));
      console.log(`   * Verifikasi Default Landing: ${ok ? '✅ Lolos (Lacak Status Cucian)' : '❌ Regresi (Masih Dashboard)'}`);
      console.log(`   * Verifikasi Tab Dashboard Tersembunyi: ${noDashboard ? '✅ Lolos' : '❌ Regresi (Dashboard Masih Terlihat)'}`);
    }
  }

  console.log('\n--------------------------------------------------------------------------------');
  console.log('=== SELESAI PENGUJIAN DOM POIN 30 ===');
}

verifyPoin30().catch(console.error);
