import { parseBriefKebutuhan } from '../src/components/BriefKebutuhanCard';

const sampleText = `Terima kasih atas konfirmasinya! Berikut adalah lembar "Brief Kebutuhan" untuk aplikasi laundry:

📋 **Brief Kebutuhan**
- **Nama App**: LaundryKita Pro
- **Orientasi UI**: Mobile-first, agar mudah diakses di smartphone kasir dan washer.
- **Tema Visual**: Nuansa biru laut dan putih bersih, modern dan minimalis.
- **Fitur Utama (V1)**:
  1. Form order cuci kiloan dan satuan
  2. Kalkulator bayar tunai & QRIS
  3. Papan antrian kerja washer
  4. Update status cucian (antri, cuci, selesai)
  5. Lacak status resi pelanggan
  6. Dashboard omset harian admin
- **Roadmap Lanjutan (V2/V3)**:
  - Notifikasi WhatsApp otomatis
  - Integrasi kurir antar-jemput
- **Fitur Unik (USP)**: Lacak status mandiri pelanggan secara real-time.
- **Job Description & Struktur Halaman per Role**:
  * **Admin**:
    - Dashboard (default): section Ringkasan Omset, section Aktivitas Terkini
    - Master Data: section Kelola Tarif, section Data Pelanggan
  * **Kasir**:
    - Kasir POS (default): section Form Order Baru, section Keranjang
    - Pembayaran: section Kalkulator Bayar, section Cetak Nota
  * **Washer**:
    - Antrian Kerja (default): section Papan Antrian Masuk, section Update Status Cuci
  * **Pelanggan**:
    - Portal Lacak (default): section Cek Resi Cucian, section Riwayat Order

Apakah lembar Brief Kebutuhan di atas sudah sesuai, atau ada detail yang ingin diubah sebelum saya buatkan prototipenya?`;

console.log('=== TEST PARSE BRIEF KEBUTUHAN ===');
const parsed = parseBriefKebutuhan(sampleText);
console.log('Parsed Result:', JSON.stringify(parsed, null, 2));

if (parsed && parsed.appName === 'LaundryKita Pro' && parsed.roles.length === 4 && parsed.features.length === 6) {
  console.log('🎉 TEST PARSER PASSED 100%');
} else {
  console.error('❌ TEST PARSER FAILED');
  process.exit(1);
}
