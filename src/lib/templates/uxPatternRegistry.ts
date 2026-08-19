/**
 * UX PATTERN REGISTRY & SELECTION ENGINE
 * Version: 1.0 (Specification based on UX_Reference_Library_v1.0)
 * 
 * Prinsip:
 * 1. Output akhir tetap Vanilla CSS kustom (tanpa dependensi eksternal/Tailwind).
 * 2. Seleksi kualitatif berbasis bahasa natural (tanpa scoring numerik/persentase buatan).
 * 3. Prinsip "Customer vs Staff UX beda meski objek bisnis sama".
 */

import { UXPattern, MasterTemplate } from './types';

export const UX_PATTERNS: UXPattern[] = [
  // ===========================================================================
  // 1. AUTHENTICATION (UX-AUTH)
  // ===========================================================================
  {
    id: 'UX-AUTH-01',
    name: 'Login / Sign In',
    category: 'Authentication',
    primaryUser: 'Semua Pengguna / Staff / Customer',
    userGoal: 'Masuk ke sistem dengan aman dan cepat',
    businessContext: 'Gerbang autentikasi peran dan akses data',
    informationPriority: {
      primary: ['Field Email/Username', 'Field Password', 'Tombol Masuk'],
      secondary: ['Ingat Saya', 'Lupa Password'],
      contextual: ['Pesan Error Validasi', 'Opsi Daftar Baru']
    },
    primaryAction: ['Masuk / Login'],
    secondaryActions: ['Lupa Password', 'Daftar Akun Baru'],
    requiredData: ['email_or_username', 'password'],
    states: ['Idle', 'Loading Autentikasi', 'Error Kredensial', 'Success Redirect'],
    uxRules: [
      'Field password memiliki toggle intip (show/hide password)',
      'Error validasi tampil jelas dan spesifik di bawah field terkait',
      'Tombol login disable atau menampilkan spinner saat proses autentikasi berlangsung',
      'Auto-focus pada input pertama saat halaman dimuat'
    ],
    referenceProviders: ['MUI', 'shadcn', 'Cruip']
  },
  {
    id: 'UX-AUTH-02',
    name: 'Register / Sign Up',
    category: 'Authentication',
    primaryUser: 'Pengguna Baru / Customer Mandiri',
    userGoal: 'Mendaftarkan akun baru dengan data yang valid',
    businessContext: 'Onboarding pelanggan atau registrasi mandiri',
    informationPriority: {
      primary: ['Nama Lengkap', 'Email / No HP', 'Password', 'Konfirmasi Password'],
      secondary: ['Syarat & Ketentuan', 'Tombol Daftar'],
      contextual: ['Petunjuk Kekuatan Password', 'Link ke Halaman Login']
    },
    primaryAction: ['Daftar Akun'],
    secondaryActions: ['Sudah punya akun? Masuk'],
    requiredData: ['full_name', 'email', 'password', 'password_confirmation'],
    states: ['Form Input', 'Validasi Real-time', 'Loading Pendaftaran', 'Pendaftaran Berhasil'],
    uxRules: [
      'Indikator kekuatan password yang intuitif',
      'Pemberitahuan verifikasi email/link aktivasi yang jelas setelah submit',
      'Cegah duplikasi klik dengan state loading pada tombol'
    ],
    referenceProviders: ['MUI', 'shadcn', 'Cruip']
  },

  // ===========================================================================
  // 2. CUSTOMER (UX-CUST)
  // ===========================================================================
  {
    id: 'UX-CUST-01',
    name: 'Customer Dashboard',
    category: 'Customer',
    primaryUser: 'Customer / Pasien / Member',
    userGoal: 'Melihat ringkasan akun, status transaksi aktif, dan menu aksi cepat',
    businessContext: 'Portal mandiri pelanggan (Self-service Portal)',
    informationPriority: {
      primary: ['Status Layanan/Pesanan Aktif', 'Nomor Antrean/Resi Berjalan'],
      secondary: ['Poin/Saldo Reward', 'Menu Layanan Utama', 'Riwayat Terakhir'],
      contextual: ['Promo/Pengumuman', 'Kontak Bantuan']
    },
    primaryAction: ['Buat Pesanan / Ambil Antrean / Booking Baru'],
    secondaryActions: ['Lihat Riwayat Lengkap', 'Hubungi Admin'],
    requiredData: ['customer_name', 'active_orders_count', 'recent_transactions'],
    states: ['Memuat Data', 'Ada Transaksi Aktif', 'Kosong (Belum ada aktivitas)', 'Error Koneksi'],
    uxRules: [
      'Kartu status aktif diletakkan paling atas dengan kontras visual tinggi',
      'Informasi disajikan dalam bahasa santun dan non-teknis',
      'Aksi utama selalu dapat diakses dalam 1 sentuhan/klik di perangkat mobile'
    ],
    referenceProviders: ['MUI', 'shadcn', 'Cruip']
  },
  {
    id: 'UX-CUST-03',
    name: 'Booking & Appointment Scheduling',
    category: 'Customer',
    primaryUser: 'Customer / Pasien / Klien',
    userGoal: 'Memilih jadwal layanan, dokter/petugas, dan mengonfirmasi janji temu',
    businessContext: 'Penjadwalan reservasi layanan kesehatan, konsultasi, atau salon',
    informationPriority: {
      primary: ['Pilihan Layanan / Poli', 'Pilihan Tanggal & Jam Tersedia', 'Pilihan Petugas/Dokter'],
      secondary: ['Ringkasan Biaya / Kuota Sisa', 'Data Pasien / Pemesan'],
      contextual: ['Catatan Khusus / Keluhan', 'Kebijakan Pembatalan']
    },
    primaryAction: ['Konfirmasi Booking'],
    secondaryActions: ['Ubah Pilihan Tanggal', 'Batal'],
    requiredData: ['service_id', 'date', 'time_slot', 'doctor_or_staff_id', 'patient_info'],
    states: ['Pilih Layanan', 'Pilih Slot Waktu', 'Slot Penuh', 'Konfirmasi Sukses'],
    uxRules: [
      'Slot waktu yang sudah penuh ditandai jelas (disabled/tercoret) tanpa perlu diklik',
      'Ringkasan booking ditampilkan sebelum tombol konfirmasi akhir',
      'Status ketersediaan dokter/petugas tertera secara real-time'
    ],
    referenceProviders: ['MUI', 'Ant Design Pro', 'shadcn']
  },
  {
    id: 'UX-CUST-04',
    name: 'Patient / Customer Queue (Antrean Mandiri)',
    category: 'Customer',
    primaryUser: 'Pasien / Customer',
    userGoal: 'Melihat posisi antrean pribadi, estimasi waktu tunggu, dan status panggilan',
    businessContext: 'Antrean klinik, puskesmas, loket layanan, atau customer service',
    informationPriority: {
      primary: ['Nomor Antrean Saya (my_queue_number)'],
      secondary: ['Nomor Sedang Dilayani (current_serving)', 'Sisa Antrean di Depan (people_ahead)', 'Estimasi Waktu Tunggu (estimated_wait)'],
      contextual: ['Nama Dokter / Petugas (doctor)', 'Poli / Layanan (service)', 'Lokasi Ruangan (location)']
    },
    primaryAction: ['Refresh / Cek Status Terkini'],
    secondaryActions: ['Batalkan Antrean'],
    requiredData: ['queue_number', 'current_number', 'position', 'estimated_wait', 'status'],
    states: ['Menunggu (WAITING)', 'Dipanggil (CALLED)', 'Sedang Dilayani (SERVING)', 'Selesai (COMPLETED)', 'Batal (CANCELLED)'],
    uxRules: [
      'Nomor antrean pasien menjadi informasi paling besar dan dominan di layar (Hero display)',
      'Nomor yang sedang dilayani saat ini terlihat langsung tanpa perlu membuka tab/halaman lain',
      'Posisi antrean dan estimasi waktu disajikan dengan bahasa sederhana (misal: "Sisa 3 orang lagi • ±15 menit")',
      'Saat status menjadi "Dipanggil (CALLED)", tampilan visual berubah mencolok (animasi pulse / aksen hijau) agar pasien segera menuju loket/ruangan',
      'Tombol Batal Antrean BUKAN primary CTA (posisi sekunder, diberi konfirmasi modal dialog)',
      'Perangkat mobile tidak memerlukan scrolling panjang untuk melihat nomor dan status antrean'
    ],
    referenceProviders: ['MUI', 'Tremor', 'shadcn']
  },
  {
    id: 'UX-CUST-05',
    name: 'Order Tracking / Lacak Resi Status',
    category: 'Customer',
    primaryUser: 'Pelanggan / Pemesan',
    userGoal: 'Mengetahui progres pengerjaan cucian/pesanan dan rincian barang',
    businessContext: 'Lacak resi laundry, reparasi, pengiriman barang, atau cetak dokumen',
    informationPriority: {
      primary: ['Nomor Resi / Nota', 'Status Progres Terkini (Step Tracker)'],
      secondary: ['Daftar Rincian Cucian/Barang', 'Total Tagihan & Status Lunas'],
      contextual: ['Estimasi Selesai', 'Kontak Toko / Driver']
    },
    primaryAction: ['Lacak Resi Lain'],
    secondaryActions: ['Hubungi WhatsApp Toko'],
    requiredData: ['tracking_code', 'current_step', 'total_amount', 'is_paid', 'item_details'],
    states: ['Antri Cuci', 'Sedang Dicuci/Diproses', 'Setrika/Finishing', 'Siap Diambil', 'Sudah Diambil'],
    uxRules: [
      'Visual timeline/stepper horizontal atau vertikal yang memperlihatkan alur dari awal hingga akhir',
      'Warna badge status membedakan secara tegas proses berjalan vs siap ambil vs sudah selesai',
      'Pencarian resi mandiri tanpa perlu login wajib didukung'
    ],
    referenceProviders: ['MUI', 'Cruip', 'shadcn']
  },

  // ===========================================================================
  // 3. TRANSACTION (UX-TRX)
  // ===========================================================================
  {
    id: 'UX-TRX-01',
    name: 'Product / Service Selection Catalog',
    category: 'Transaction',
    primaryUser: 'Kasir / Petugas / Pelanggan',
    userGoal: 'Memilih item barang atau layanan yang akan dibeli secara cepat',
    businessContext: 'Katalog POS kasir, menu restoran, atau pilihan paket laundry',
    informationPriority: {
      primary: ['Nama Item / Layanan', 'Harga Satuan', 'Tombol Tambah (+)'],
      secondary: ['Kategori / Tab Filter', 'Stok Tersedia / Varian'],
      contextual: ['Foto / Ikon Produk', 'Deskripsi Singkat']
    },
    primaryAction: ['Tambah ke Keranjang / Transaksi'],
    secondaryActions: ['Filter Kategori', 'Cari Item'],
    requiredData: ['item_id', 'item_name', 'category', 'price', 'stock'],
    states: ['Katalog Siap', 'Item Kosong/Habis', 'Pencarian Ditemukan', 'Pencarian Nihil'],
    uxRules: [
      'Grid kartu produk responsive dengan touch target besar pada tombol tambah',
      'Filter kategori instan (pills) tanpa reload halaman',
      'Indikator item yang sudah masuk keranjang (badge counter kuantitas)'
    ],
    referenceProviders: ['MUI', 'Flowbite', 'shadcn']
  },
  {
    id: 'UX-TRX-04',
    name: 'Payment / Kasir POS Calculator',
    category: 'Transaction',
    primaryUser: 'Kasir / Billing Staff',
    userGoal: 'Menghitung total belanja, menerima pembayaran tunai/non-tunai, dan menghitung kembalian',
    businessContext: 'Kasir toko, loket pembayaran klinik, resto, laundry',
    informationPriority: {
      primary: ['Total Tagihan (Grand Total)', 'Input Uang Diterima', 'Uang Kembalian (Change)'],
      secondary: ['Pilihan Metode Bayar (Tunai, QRIS, Transfer, Debit)', 'Tombol Uang Pas / Pecahan Cepat'],
      contextual: ['Diskon / Pajak', 'Rincian Item']
    },
    primaryAction: ['Selesaikan Pembayaran & Cetak Nota'],
    secondaryActions: ['Simpan Pesanan (Hold)', 'Batal Transaksi'],
    requiredData: ['grand_total', 'paid_amount', 'change_amount', 'payment_method'],
    states: ['Menunggu Input Bayar', 'Uang Kurang (Merah)', 'Uang Pas / Lebih (Hijau)', 'Sukses Lunas'],
    uxRules: [
      'Kalkulator kembalian otomatis real-time tanpa perlu klik tombol hitung',
      'Tombol pecahan uang cepat (misal: 20rb, 50rb, 100rb, Uang Pas) untuk mempercepat kerja kasir',
      'Pemberitahuan visual mencolok saat uang kurang agar kasir tidak salah input'
    ],
    referenceProviders: ['MUI', 'Tailwind Plus', 'Tabler']
  },
  {
    id: 'UX-TRX-06',
    name: 'Receipt / Nota & Bukti Pembayaran',
    category: 'Transaction',
    primaryUser: 'Kasir / Pelanggan',
    userGoal: 'Melihat struk nota bukti transaksi dan mencetak/bagikan ke pelanggan',
    businessContext: 'Cetak nota struk kasir, invoice pembayaran, atau tanda terima',
    informationPriority: {
      primary: ['Nama Usaha & No Nota', 'Daftar Item & Total Bayar', 'Status Pembayaran (Lunas/Hutang)'],
      secondary: ['Tanggal & Nama Kasir', 'Kembalian & Metode Bayar'],
      contextual: ['Catatan Kaki / Ucapan Terima Kasih', 'QR Code Nota']
    },
    primaryAction: ['Cetak Struk / Download PDF'],
    secondaryActions: ['Kirim WhatsApp', 'Transaksi Baru'],
    requiredData: ['invoice_number', 'date', 'items', 'subtotal', 'discount', 'grand_total', 'cashier_name'],
    states: ['Tampilan Struk Siap', 'Mencetak', 'Sukses'],
    uxRules: [
      'Format layout proporsional menyerupai kertas struk kasir (thermal receipt style)',
      'Aksi "Transaksi Baru" mudah diakses untuk melanjutkan antrean berikutnya'
    ],
    referenceProviders: ['MUI', 'Tabler', 'Cruip']
  },

  // ===========================================================================
  // 4. OPERATIONS (UX-OPS)
  // ===========================================================================
  {
    id: 'UX-OPS-01',
    name: 'Staff Work Queue / Papan Antrian Kerja',
    category: 'Operations',
    primaryUser: 'Dokter / Washer / Operator / Mekanik / Koki',
    userGoal: 'Melihat antrean tugas masuk, memanggil pasien/pekerjaan berikutnya, dan mengupdate status',
    businessContext: 'Antrean pemeriksaan dokter, papan cuci washer, dapur restoran, servis bengkel',
    informationPriority: {
      primary: ['Tugas / Pasien Sedang Dikerjakan Saat Ini', 'Tugas / Pasien Urutan Berikutnya'],
      secondary: ['Tombol Aksi Status (Panggil, Mulai, Selesai, Lewati)', 'Daftar Antrean Masuk'],
      contextual: ['Waktu Masuk / Durasi Pengerjaan', 'Catatan Tambahan']
    },
    primaryAction: ['Panggil / Mulai Kerjakan', 'Tandai Selesai'],
    secondaryActions: ['Lewati (Skip)', 'Beri Catatan Tambahan'],
    requiredData: ['current_task_id', 'task_title', 'priority', 'status', 'queue_list'],
    states: ['Siap Menerima Tugas', 'Sedang Mengerjakan', 'Menunggu Bahan/Konfirmasi', 'Semua Tugas Selesai'],
    uxRules: [
      'Berbeda total dengan UX Pasien/Customer: Staf fokus pada kendali antrean, tombol aksi panggil/selesai berukuran besar, dan antrean berikutnya',
      'Satu tombol utama dominan untuk transisi status tercepat (Mulai → Selesai)',
      'Indikator prioritas/urgensi (misal: Pasien Gawat Darurat atau Pesanan Express) ber-aksen merah/kuning mencolok'
    ],
    referenceProviders: ['Ant Design Pro', 'Tabler', 'MUI']
  },
  {
    id: 'UX-OPS-06',
    name: 'Status Tracking & Progres Operasional',
    category: 'Operations',
    primaryUser: 'Supervisor / Manager / Staff',
    userGoal: 'Memantau dan mengubah status alur pekerjaan antar departemen',
    businessContext: 'Pelacakan alur laundry (Cuci → Kering → Setrika → Siap), reparasi, produksi',
    informationPriority: {
      primary: ['Status Alur Saat Ini', 'Tombol Maju ke Tahap Berikutnya'],
      secondary: ['Riwayat Perubahan Status & Operator', 'Waktu Tiap Tahapan'],
      contextual: ['Kendala / Catatan Revisi']
    },
    primaryAction: ['Update Status ke Tahap Berikutnya'],
    secondaryActions: ['Kembalikan ke Tahap Sebelumnya (Rework)', 'Lihat Detail Order'],
    requiredData: ['order_id', 'current_workflow_stage', 'assigned_operator', 'history_logs'],
    states: ['Draft', 'Tahap 1', 'Tahap 2', 'Tahap 3', 'Selesai'],
    uxRules: [
      'Dropdown atau tombol toggle status dengan feedback instan',
      'Pemberitahuan peringatan jika ada tahap wajib yang belum selesai'
    ],
    referenceProviders: ['Ant Design Pro', 'Tabler', 'Tremor']
  },

  // ===========================================================================
  // 5. DATA MANAGEMENT (UX-DATA)
  // ===========================================================================
  {
    id: 'UX-DATA-01',
    name: 'Records List & Master Data Table',
    category: 'Data',
    primaryUser: 'Admin / Manager / Petugas Data',
    userGoal: 'Melihat, mencari, menyaring, dan mengelola koleksi data tabular',
    businessContext: 'Master data barang, data pelanggan, data pasien, daftar staf',
    informationPriority: {
      primary: ['Kolom Identitas Utama (Nama, Kode, Kategori)', 'Kolom Status', 'Tombol Aksi (Edit, Hapus)'],
      secondary: ['Kolom Angka/Tanggal (Harga, Stok, Tgl Dibuat)', 'Pagination / Jumlah Baris'],
      contextual: ['Keterangan Tambahan', 'Filter Lanjutan']
    },
    primaryAction: ['Tambah Data Baru (+)', 'Cari Data'],
    secondaryActions: ['Filter Kategori', 'Export Data', 'Bulk Action'],
    requiredData: ['columns_schema', 'records_data', 'total_count'],
    states: ['Memuat Tabel', 'Data Ditemukan', 'Tabel Kosong (Empty State)', 'Hasil Filter Nihil'],
    uxRules: [
      'Tabel responsif: di layar desktop berupa tabel penuh, di layar mobile bertransisi jadi kartu-kartu ringkas',
      'Empty state yang ramah dan solutif dengan tombol "Tambah Data Pertama"',
      'Aksi hapus selalu meminta konfirmasi modal dialog kustom (bukan browser confirm)'
    ],
    referenceProviders: ['MUI', 'Flowbite', 'Ant Design Pro', 'Tabler']
  },
  {
    id: 'UX-DATA-05',
    name: 'Create & Edit Form Input',
    category: 'Data',
    primaryUser: 'Admin / Operator Data',
    userGoal: 'Menginput atau memperbarui data dengan validasi yang akurat',
    businessContext: 'Form input produk baru, form daftar pasien, form transaksi',
    informationPriority: {
      primary: ['Field-field Wajib (Required Fields)', 'Tombol Simpan / Perbarui'],
      secondary: ['Field Opsional', 'Tombol Batal'],
      contextual: ['Pesan Validasi / Helper Text']
    },
    primaryAction: ['Simpan Data'],
    secondaryActions: ['Batal / Kembali'],
    requiredData: ['form_fields_schema', 'initial_values'],
    states: ['Form Bersih', 'Sedang Diisi', 'Error Validasi', 'Menyimpan...'],
    uxRules: [
      'Kelompokkan field yang banyak ke dalam section/grup logis',
      'Field wajib diberi tanda bintang (*) yang jelas',
      'Format angka (misal: Rupiah) otomatis diformat saat mengetik'
    ],
    referenceProviders: ['MUI', 'Ant Design Pro', 'Flowbite']
  },

  // ===========================================================================
  // 6. ANALYTICS (UX-ANA)
  // ===========================================================================
  {
    id: 'UX-ANA-01',
    name: 'Executive Dashboard & KPI Overview',
    category: 'Analytics',
    primaryUser: 'Owner / Direktur / Pimpinan Usaha',
    userGoal: 'Memantau kesehatan bisnis secara cepat melalui angka ringkasan KPI dan grafik tren',
    businessContext: 'Dashboard omset harian, tren pendapatan, ringkasan transaksi, dan performa cabang',
    informationPriority: {
      primary: ['KPI Cards Utama (Total Omset, Jumlah Transaksi, Pelanggan Baru, Order Aktif)'],
      secondary: ['Grafik Tren Pendapatan / Mingguan', 'Tabel 5 Transaksi Terkini'],
      contextual: ['Perbandingan vs Kemarin / Bulan Lalu', 'Peringatan Stok Menipis']
    },
    primaryAction: ['Pilih Periode Waktu (Hari Ini, 7 Hari, Bulan Ini)'],
    secondaryActions: ['Download Laporan Lengkap', 'Lihat Detail Modul'],
    requiredData: ['kpi_metrics', 'trend_chart_data', 'recent_activity_list'],
    states: ['Memuat Dashboard', 'Data Tersedia', 'Belum Ada Transaksi'],
    uxRules: [
      'KPI Cards diletakkan di baris paling atas dengan tipografi angka yang besar dan tegas',
      'Grafik visual sederhana (bar / line chart visual CSS) yang mudah dibaca dalam 3 detik',
      'Filter rentang tanggal cepat yang tidak membingungkan pimpinan'
    ],
    referenceProviders: ['Tremor', 'MUI', 'Ant Design Pro']
  },
  {
    id: 'UX-ANA-02',
    name: 'Operational Dashboard & Monitoring Harian',
    category: 'Analytics',
    primaryUser: 'Manager Operasional / Supervisor / Admin',
    userGoal: 'Memantau kelancaran operasional harian, bottleneck antrean, dan utilitas staf',
    businessContext: 'Dashboard antrean klinik harian, dashboard kapasitas cucian laundry, monitoring kasir',
    informationPriority: {
      primary: ['Status Antrean Hari Ini (Menunggu, Dilayani, Selesai)', 'Beban Kerja per Staf/Dokter'],
      secondary: ['Daftar Transaksi Perlu Tindakan / Tertunda', 'Notifikasi Stok Habis'],
      contextual: ['Estimasi Waktu Rata-rata Pelayanan']
    },
    primaryAction: ['Refresh Data Operasional'],
    secondaryActions: ['Tugaskan Ulang (Re-assign)', 'Buka Antrean'],
    requiredData: ['daily_queue_stats', 'staff_workload_metrics', 'pending_alerts'],
    states: ['Operasional Normal', 'Ada Bottleneck / Antrean Menumpuk', 'Tutup / Istirahat'],
    uxRules: [
      'Indikator status real-time dengan warna peringatan jika antrean melebihi batas wajar',
      'Akses pintas langsung dari kartu metrik menuju halaman kerja operasional terkait'
    ],
    referenceProviders: ['Tremor', 'Ant Design Pro', 'Tabler']
  }
];

/**
 * Mencari satu UX Pattern berdasarkan ID uniknya.
 */
export function getUXPatternById(id: string): UXPattern | undefined {
  return UX_PATTERNS.find(p => p.id.toUpperCase() === id.toUpperCase());
}

/**
 * Mencocokkan teks konteks kebutuhan dan Master Template ke daftar UX Pattern yang relevan.
 * Bersifat selektif (hanya mengambil 2-4 pattern yang paling esensial).
 */
export function findRelevantUXPatterns(contextText: string, masterTemplateId?: string): UXPattern[] {
  const lower = contextText.toLowerCase();
  const matchedPatterns: UXPattern[] = [];
  const addedIds = new Set<string>();

  const addPattern = (p: UXPattern) => {
    if (!addedIds.has(p.id)) {
      addedIds.add(p.id);
      matchedPatterns.push(p);
    }
  };

  // 1. Deteksi Healthcare / Klinik / Dokter / Pasien / Antrean
  if (masterTemplateId === 'MT-06' || lower.includes('klinik') || lower.includes('dokter') || lower.includes('pasien') || lower.includes('rekam medis') || lower.includes('poli') || lower.includes('antrean') || lower.includes('antrian')) {
    const queueCust = getUXPatternById('UX-CUST-04');
    const queueOps = getUXPatternById('UX-OPS-01');
    const booking = getUXPatternById('UX-CUST-03');
    const execDash = getUXPatternById('UX-ANA-01');
    if (queueCust) addPattern(queueCust);
    if (queueOps) addPattern(queueOps);
    if (booking) addPattern(booking);
    if (execDash) addPattern(execDash);
  }

  // 2. Deteksi Laundry / Jasa Service / Tracking Resi
  if (masterTemplateId === 'MT-03' || lower.includes('laundry') || lower.includes('cucian') || lower.includes('lacak') || lower.includes('resi') || lower.includes('washer')) {
    const trackCust = getUXPatternById('UX-CUST-05');
    const workQueue = getUXPatternById('UX-OPS-01');
    const posTrx = getUXPatternById('UX-TRX-04');
    const execDash = getUXPatternById('UX-ANA-01');
    if (trackCust) addPattern(trackCust);
    if (workQueue) addPattern(workQueue);
    if (posTrx) addPattern(posTrx);
    if (execDash) addPattern(execDash);
  }

  // 3. Deteksi Retail / Toko / POS Kasir
  if (masterTemplateId === 'MT-01' || lower.includes('toko') || lower.includes('retail') || lower.includes('kasir') || lower.includes('stok') || lower.includes('pos')) {
    const posTrx = getUXPatternById('UX-TRX-04');
    const receipt = getUXPatternById('UX-TRX-06');
    const dataTable = getUXPatternById('UX-DATA-01');
    const execDash = getUXPatternById('UX-ANA-01');
    if (posTrx) addPattern(posTrx);
    if (receipt) addPattern(receipt);
    if (dataTable) addPattern(dataTable);
    if (execDash) addPattern(execDash);
  }

  // 4. Deteksi Sekolah / Les / Kursus
  if (masterTemplateId === 'MT-04' || lower.includes('sekolah') || lower.includes('kursus') || lower.includes('siswa') || lower.includes('guru') || lower.includes('nilai')) {
    const dataTable = getUXPatternById('UX-DATA-01');
    const custDash = getUXPatternById('UX-CUST-01');
    const execDash = getUXPatternById('UX-ANA-01');
    if (dataTable) addPattern(dataTable);
    if (custDash) addPattern(custDash);
    if (execDash) addPattern(execDash);
  }

  // 5. Default Fallback jika belum ada kecocokan spesifik
  if (matchedPatterns.length === 0) {
    const defaultData = getUXPatternById('UX-DATA-01');
    const defaultDash = getUXPatternById('UX-ANA-01');
    const defaultForm = getUXPatternById('UX-DATA-05');
    if (defaultDash) addPattern(defaultDash);
    if (defaultData) addPattern(defaultData);
    if (defaultForm) addPattern(defaultForm);
  }

  return matchedPatterns.slice(0, 4);
}

/**
 * Memformat panduan UX terstruktur untuk disuntikkan secara selektif ke IDEATION_SYSTEM_PROMPT di Tahap 1.
 * Mengutamakan panduan kualitatif bahasa natural tanpa skor angka / persentase buatan.
 */
export function formatUXGuidanceForIdeation(patterns: UXPattern[]): string {
  if (!patterns || patterns.length === 0) return '';

  const patternsSummary = patterns.map(p => {
    const primaryP = p.informationPriority.primary.join(', ');
    const secondaryP = p.informationPriority.secondary.join(', ');
    const rulesList = p.uxRules.slice(0, 2).map(r => `    - ${r}`).join('\n');

    return `  * Pola "${p.name}" (Role: ${p.primaryUser}):
    - Prioritas Utama: ${primaryP}
    - Informasi Pendukung: ${secondaryP}
${rulesList}`;
  }).join('\n');

  return `
=== PANDUAN STANDAR UX & PRIORITAS INFORMASI (INTERNAL UX KNOWLEDGE) ===
1. PRINSIP "CUSTOMER VS STAFF UX BERBEDA MESKI OBJEK BISNIS SAMA":
   - Jika satu objek data (misal: Antrean / Pesanan / Status) diakses oleh peran berbeda, susun struktur section dengan fokus yang kontras:
     * Sisi Customer/Pasien: Fokus mandiri, melihat status/nomor milik sendiri secara dominan (Hero display), bahasa ramah non-teknis, estimasi waktu tunggu sederhana.
     * Sisi Dokter/Staf/Operator: Fokus kendali kerja, melihat antrean masuk berikutnya, tombol aksi cepat (Panggil, Selesai, Lewati), dan catatan teknis.
     * Sisi Admin/Manager: Fokus monitoring antrean keseluruhan, ringkasan volume harian, dan metrik bottleneck.
2. REKOMENDASI POLA UX TERPILIH UNTUK KASUS INI:
${patternsSummary}

Gunakan pertimbangan prioritas informasi di atas saat menyusun usulan section di dalam "Job Description & Struktur Halaman per Role" pada lembar Brief Kebutuhan.`;
}
