import { parseBriefKebutuhan } from '../src/components/BriefKebutuhanCard';

async function testPoin46() {
  console.log('=== TEST POIN 46: ANTI-REGRESI REVISI BRIEF KEBUTUHAN & ALUR PROSES ===\n');

  // 1. Test Parser Unit Logic
  console.log('--- TEST 1: Unit Test Parser BriefKebutuhanCard (Glitch Resiliency) ---');
  const glitchedBriefText = `📋 **Brief Kebutuhan**
- **Nama App**: Antrian Klinik Sehat
- **Orientasi UI**: Desktop-first
- **Tema Visual**: Biru medis segar
- **Fitur Utama (V1)**:
  1. Pasien ambil antrean
  2. Dokter periksa pasien
- **Job Description & Struktur Halaman per Role**:
  * **Dokter**:
    - Pemeriksaan (default): section Pasien Menunggu, section Resep
  * **Alur Proses**:
    Klik "Panggil Pasien" → status berubah jadi "Diperiksa" → Klik "Simpan Resep" → status berubah jadi "Selesai"
  * **Receptionist**:
    - Pendaftaran (default): section Antrean Masuk
    - Alur Proses: Klik "Terima Pasien" → nomor antrean aktif
  * **Pasien**:
    - Status (default): section Cek Nomor
    - Alur Proses: Klik "Cek Status" → status antrean muncul

Apakah lembar Brief Kebutuhan di atas sudah sesuai?`;

  const parsed = parseBriefKebutuhan(glitchedBriefText);
  console.log('Parsed Roles Count:', parsed?.roles.length);
  parsed?.roles.forEach(r => {
    console.log(`- Role: "${r.roleName}", Pages: ${r.pages.length}, Alur: ${r.alurProses ? '✅ ADA (' + r.alurProses.substring(0, 30) + '...)' : '❌ HILANG'}`);
  });

  const hasPhantomRole = parsed?.roles.some(r => r.roleName.toLowerCase().includes('alur proses'));
  console.log(`[Cek 1.1] Phantom Role 'Alur Proses': ${!hasPhantomRole ? '✅ TIDAK ADA' : '❌ MUNCUL BUG'}`);
  console.log(`[Cek 1.2] Dokter memiliki Alur Proses: ${parsed?.roles[0]?.alurProses ? '✅ ADA' : '❌ HILANG'}`);

  // 2. Test Live Revision Pipeline via API
  console.log('\n--- TEST 2: Live API Test - Revisi Brief Kebutuhan 2x Berturut-turut ---');
  const initialBrief = `📋 **Brief Kebutuhan**
- **Nama App**: Klinik Cerdas Pratama
- **Orientasi UI**: Desktop-first
- **Tema Visual**: Hijau toska medis
- **Fitur Utama (V1)**:
  1. Pendaftaran antrean pasien
  2. Pemeriksaan dokter dan resep
  3. Pembayaran kasir
- **Job Description & Struktur Halaman per Peran**:
  * **Dokter**:
    - Pemeriksaan (default): section Antrean Pasien, section Catatan Medis
    - Alur Proses: Klik "Mulai Periksa" → status pasien berubah jadi "Sedang Diperiksa" → Klik "Selesai" → status jadi "Menunggu Obat"
  * **Receptionist**:
    - Pendaftaran (default): section Registrasi Pasien
    - Alur Proses: Klik "Daftar Antrean" → tiket antrean tercetak dengan status "Menunggu"
  * **Staf Farmasi**:
    - Farmasi (default): section Resep Masuk
    - Alur Proses: Klik "Siapkan Obat" → status berubah jadi "Siap Diambil"
  * **Pasien**:
    - Status Antrean (default): section Monitor Antrean
    - Alur Proses: Klik "Cek Nomor" → status antrean dan estimasi waktu tampil

Apakah lembar Brief Kebutuhan di atas sudah sesuai?`;

  // Helper untuk membaca SSE stream dari /api/generate
  async function fetchStreamReply(promptText: string, history: any[]): Promise<string> {
    const res = await fetch('http://localhost:3000/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: promptText,
        chatHistory: history,
        stage: 'TAHAP_1_PEMBUKAAN',
        currentCode: null
      })
    });

    const bodyText = await res.text();
    let accumulatedText = '';
    let finalDoneText = '';

    const lines = bodyText.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ') && line !== 'data: [DONE]') {
        try {
          const json = JSON.parse(line.substring(6));
          if (json.type === 'chunk' && json.text) {
            accumulatedText += json.text;
          } else if (json.type === 'done' && json.replyText) {
            finalDoneText = json.replyText;
          }
        } catch (_) {}
      }
    }

    return finalDoneText || accumulatedText;
  }

  // Revisi 1: Tambahkan catatan alergi untuk Dokter
  console.log('\n[Revisi 1] Mengirim permintaan: "tambahkan section Catatan Alergi untuk role Dokter"');
  const replyRev1 = await fetchStreamReply('tambahkan section Catatan Alergi untuk role Dokter', [
    { sender: 'USER', text: 'buatkan aplikasi klinik dengan role Dokter, Receptionist, Staf Farmasi, Pasien' },
    { sender: 'AI', text: initialBrief }
  ]);

  console.log(`Reply Rev 1 Length: ${replyRev1.length} chars`);
  
  const parsedRev1 = parseBriefKebutuhan(replyRev1);
  console.log(`Parsed Rev 1 Roles Count: ${parsedRev1?.roles.length || 0}`);
  parsedRev1?.roles.forEach(r => {
    console.log(`- Role: "${r.roleName}", Pages: ${r.pages.length}, Alur: ${r.alurProses ? '✅ ADA (' + r.alurProses.substring(0, 30) + '...)' : '❌ HILANG'}`);
  });

  const rev1Phantom = parsedRev1?.roles.some(r => r.roleName.toLowerCase().includes('alur proses'));
  const rev1AllHaveAlur = (parsedRev1?.roles || []).length >= 4 && parsedRev1?.roles.every(r => Boolean(r.alurProses));
  console.log(`[Cek 2.1] Revisi 1 - Phantom Role: ${!rev1Phantom ? '✅ BERSIH' : '❌ ADA'}`);
  console.log(`[Cek 2.2] Revisi 1 - Semua 4 Role Punya Alur: ${rev1AllHaveAlur ? '✅ LENGKAP' : '❌ ADA YG HILANG'}`);

  // Revisi 2: Ganti nama Receptionist jadi Petugas Pendaftaran
  console.log('\n[Revisi 2] Mengirim permintaan: "ganti nama role Receptionist menjadi Petugas Pendaftaran"');
  const replyRev2 = await fetchStreamReply('ganti nama role Receptionist menjadi Petugas Pendaftaran', [
    { sender: 'USER', text: 'buatkan aplikasi klinik dengan role Dokter, Receptionist, Staf Farmasi, Pasien' },
    { sender: 'AI', text: initialBrief },
    { sender: 'USER', text: 'tambahkan section Catatan Alergi untuk role Dokter' },
    { sender: 'AI', text: replyRev1 }
  ]);

  console.log(`Reply Rev 2 Length: ${replyRev2.length} chars`);

  const parsedRev2 = parseBriefKebutuhan(replyRev2);
  console.log(`Parsed Rev 2 Roles Count: ${parsedRev2?.roles.length || 0}`);
  parsedRev2?.roles.forEach(r => {
    console.log(`- Role: "${r.roleName}", Pages: ${r.pages.length}, Alur: ${r.alurProses ? '✅ ADA (' + r.alurProses.substring(0, 30) + '...)' : '❌ HILANG'}`);
  });

  const rev2Phantom = parsedRev2?.roles.some(r => r.roleName.toLowerCase().includes('alur proses'));
  const rev2AllHaveAlur = (parsedRev2?.roles || []).length >= 4 && parsedRev2?.roles.every(r => Boolean(r.alurProses));
  console.log(`[Cek 3.1] Revisi 2 - Phantom Role: ${!rev2Phantom ? '✅ BERSIH' : '❌ ADA'}`);
  console.log(`[Cek 3.2] Revisi 2 - Semua Role Punya Alur: ${rev2AllHaveAlur ? '✅ LENGKAP' : '❌ ADA YG HILANG'}`);

  console.log('\n============================================================');
  console.log('🎉 SEMUA PENGUJIAN POIN 46 SELESAI!');
  console.log('============================================================\n');
}

testPoin46().catch(console.error);
