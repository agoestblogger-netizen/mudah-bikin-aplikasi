import type { IndustryOverlay } from './types';

/**
 * Overlay industri (IND-01 s/d IND-20).
 * Sumber: dokumen "Peta Proses Bisnis Universal & Lintas Industri" (Bagian 2),
 * dilengkapi painPoints, roleLabels, extraFeatures, core/advisory, dan provenance.
 *
 * Batch 2: IND-01 Retail s/d IND-05 Pendidikan.
 */
const REVIEW_DATE = '2026-09-11';
const DOC_SOURCE = 'Peta Proses Bisnis Universal & Lintas Industri — Bagian 2';

export const INDUSTRY_OVERLAYS: IndustryOverlay[] = [
  // ===========================================================================
  // IND-01 — Retail / Toko
  // ===========================================================================
  {
    id: 'IND-01',
    nama: 'Retail / Toko',
    keywords: ['retail', 'toko', 'minimarket', 'kelontong', 'warung', 'butik', 'petshop', 'sembako', 'ritel', 'toko online'],
    patternIds: ['UP-02', 'UP-09', 'UP-01'],
    extraEntities: [
      { name: 'SKU/Varian', fields: ['id', 'produk_id', 'varian', 'barcode', 'harga'] },
      { name: 'Diskon/Promo', fields: ['id', 'nama', 'tipe', 'nilai', 'periode'] },
      { name: 'POS Transaction', fields: ['id', 'kasir', 'shift', 'total', 'metode_bayar'] },
      { name: 'Return/Refund', fields: ['id', 'transaksi_id', 'alasan', 'jumlah', 'status'] }
    ],
    notes: [
      'Rekonsiliasi kas per shift kasir',
      'Manajemen promo/diskon bertingkat',
      'Retur barang dan refund',
      'Multi-cabang / multi-gudang'
    ],
    painPoints: [
      { id: 'IND-01-P1', label: 'Kas tidak balance tiap shift', severity: 'core' },
      { id: 'IND-01-P2', label: 'Promo/diskon sulit dihitung', severity: 'core' },
      { id: 'IND-01-P3', label: 'Retur barang tidak tercatat', severity: 'core' },
      { id: 'IND-01-P4', label: 'Stok antar cabang tidak sinkron', severity: 'advisory' }
    ],
    roleLabels: ['Kasir', 'Admin Toko', 'Supervisor', 'Pemilik', 'Pelanggan'],
    extraFeatures: [
      { id: 'IND-01-F01', label: 'POS / kasir cepat', severity: 'core', complexity: 'MEDIUM', countsForTier: true },
      { id: 'IND-01-F02', label: 'Manajemen SKU & varian', severity: 'core', complexity: 'MEDIUM' },
      { id: 'IND-01-F03', label: 'Retur & refund', severity: 'core', complexity: 'MEDIUM' },
      { id: 'IND-01-F04', label: 'Rekonsiliasi kas per shift', severity: 'core', complexity: 'MEDIUM' },
      { id: 'IND-01-F05', label: 'Promo & diskon bertingkat', severity: 'advisory', complexity: 'HIGH', countsForTier: true },
      { id: 'IND-01-F06', label: 'Multi-cabang / multi-gudang', severity: 'advisory', complexity: 'HIGH', countsForTier: true },
      { id: 'IND-01-F07', label: 'Loyalty member', severity: 'advisory', complexity: 'MEDIUM' }
    ],
    coreItems: ['POS transaksi', 'Stok berkurang otomatis', 'Retur/refund', 'Rekonsiliasi kas per shift'],
    advisoryItems: ['Loyalty pelanggan', 'Promo bertingkat', 'Multi-cabang'],
    provenance: [
      { source: DOC_SOURCE, note: 'Bagian 2.1 Retail / Toko' },
      { source: 'Diskusi user', note: 'Rekonsiliasi kas & retur ditegaskan sebagai core' }
    ],
    version: '1.0',
    lastReviewed: REVIEW_DATE
  },

  // ===========================================================================
  // IND-02 — F&B (Restoran, Kafe, Katering)
  // ===========================================================================
  {
    id: 'IND-02',
    nama: 'F&B (Restoran, Kafe, Katering)',
    keywords: ['f&b', 'restoran', 'resto', 'cafe', 'kafe', 'warung makan', 'rumah makan', 'katering', 'catering', 'bakery', 'kedai kopi', 'food court', 'kuliner'],
    patternIds: ['UP-02', 'UP-09', 'UP-06'],
    extraEntities: [
      { name: 'Menu Item', fields: ['id', 'nama', 'kategori', 'harga', 'status'] },
      { name: 'Resep/BOM bahan', fields: ['id', 'menu_id', 'bahan', 'qty', 'satuan'] },
      { name: 'Meja/Table', fields: ['id', 'nomor', 'kapasitas', 'status'] },
      { name: 'Kitchen Order Ticket', fields: ['id', 'order_id', 'status', 'waktu_masuk'] }
    ],
    notes: [
      'Split bill / pembagian tagihan',
      'Tracking waste bahan baku',
      'Resep dengan konversi satuan',
      'Pesanan dine-in vs delivery'
    ],
    painPoints: [
      { id: 'IND-02-P1', label: 'Pesanan ke dapur tidak akurat', severity: 'core' },
      { id: 'IND-02-P2', label: 'Split bill rumit', severity: 'core' },
      { id: 'IND-02-P3', label: 'Stok bahan telat ketahuan habis', severity: 'advisory' },
      { id: 'IND-02-P4', label: 'Waste bahan tidak terukur', severity: 'advisory' }
    ],
    roleLabels: ['Kasir', 'Dapur/Kitchen', 'Pelayan', 'Pemilik', 'Pelanggan'],
    extraFeatures: [
      { id: 'IND-02-F01', label: 'Katalog menu & harga', severity: 'core', complexity: 'LOW' },
      { id: 'IND-02-F02', label: 'Input pesanan dine-in/takeaway', severity: 'core', complexity: 'MEDIUM' },
      { id: 'IND-02-F03', label: 'Kitchen order ticket (KOT)', severity: 'core', complexity: 'MEDIUM', countsForTier: true },
      { id: 'IND-02-F04', label: 'Split bill', severity: 'core', complexity: 'MEDIUM' },
      { id: 'IND-02-F05', label: 'Laporan omzet harian', severity: 'core', complexity: 'MEDIUM' },
      { id: 'IND-02-F06', label: 'Manajemen meja/reservasi', severity: 'advisory', complexity: 'MEDIUM' },
      { id: 'IND-02-F07', label: 'Tracking stok bahan baku', severity: 'advisory', complexity: 'MEDIUM' },
      { id: 'IND-02-F08', label: 'Resep/BOM & konversi satuan', severity: 'advisory', complexity: 'HIGH', countsForTier: true },
      { id: 'IND-02-F09', label: 'Pesanan delivery', severity: 'advisory', complexity: 'MEDIUM' }
    ],
    coreItems: ['Katalog menu', 'Input pesanan', 'KOT ke dapur', 'Split bill', 'Laporan omzet harian'],
    advisoryItems: ['Manajemen meja/reservasi', 'Tracking stok bahan', 'Resep/BOM', 'Pesanan delivery'],
    provenance: [
      { source: DOC_SOURCE, note: 'Bagian 2.2 F&B' },
      { source: 'Contoh sesi user', note: 'Split bill & KOT dinilai wajib pada contoh F&B' }
    ],
    version: '1.0',
    lastReviewed: REVIEW_DATE
  },

  // ===========================================================================
  // IND-03 — Jasa Profesional (Konsultan, Agensi, Freelance)
  // ===========================================================================
  {
    id: 'IND-03',
    nama: 'Jasa Profesional (Konsultan, Agensi, Freelance)',
    keywords: ['jasa profesional', 'konsultan', 'agensi', 'agency', 'freelance', 'kantor hukum', 'arsitek', 'akuntan', 'konsultasi', 'software house'],
    patternIds: ['UP-01', 'UP-07', 'UP-02'],
    extraEntities: [
      { name: 'Engagement/Contract', fields: ['id', 'klien_id', 'jenis', 'nilai', 'periode'] },
      { name: 'Timesheet Billable', fields: ['id', 'engagement_id', 'petugas', 'jam', 'billable'] },
      { name: 'Retainer', fields: ['id', 'klien_id', 'periode', 'nilai', 'sisa'] }
    ],
    notes: [
      'Billing berbasis jam kerja',
      'Tracking utilization tim',
      'Kontrak retainer vs project-based'
    ],
    painPoints: [
      { id: 'IND-03-P1', label: 'Jam kerja tidak tercatat', severity: 'core' },
      { id: 'IND-03-P2', label: 'Billing telat & sering direvisi', severity: 'core' },
      { id: 'IND-03-P3', label: 'Utilization tim tidak terpantau', severity: 'advisory' },
      { id: 'IND-03-P4', label: 'Kontrak retainer campur dengan project', severity: 'advisory' }
    ],
    roleLabels: ['Partner/Manajer', 'Konsultan', 'Admin Proyek', 'Finance', 'Klien'],
    extraFeatures: [
      { id: 'IND-03-F01', label: 'Data klien & engagement', severity: 'core', complexity: 'LOW' },
      { id: 'IND-03-F02', label: 'Timesheet billable', severity: 'core', complexity: 'MEDIUM', countsForTier: true },
      { id: 'IND-03-F03', label: 'Billing per jam/proyek/retainer', severity: 'core', complexity: 'MEDIUM', countsForTier: true },
      { id: 'IND-03-F04', label: 'Manajemen kontrak', severity: 'core', complexity: 'MEDIUM' },
      { id: 'IND-03-F05', label: 'Invoice termin', severity: 'core', complexity: 'MEDIUM' },
      { id: 'IND-03-F06', label: 'Tracking utilization tim', severity: 'advisory', complexity: 'MEDIUM' }
    ],
    coreItems: ['Data engagement', 'Timesheet', 'Invoice sesuai kontrak'],
    advisoryItems: ['Dashboard utilization', 'Retainer otomatis'],
    provenance: [
      { source: DOC_SOURCE, note: 'Bagian 2.3 Jasa Profesional' }
    ],
    version: '1.0',
    lastReviewed: REVIEW_DATE
  },

  // ===========================================================================
  // IND-04 — Kesehatan (Klinik, Praktik Dokter, Apotek)
  // ===========================================================================
  {
    id: 'IND-04',
    nama: 'Kesehatan (Klinik, Praktik Dokter, Apotek)',
    keywords: ['klinik', 'puskesmas', 'praktik dokter', 'apotek', 'rekam medis', 'pasien', 'dokter', 'bidan', 'fisioterapi', 'optik', 'rumah sakit'],
    patternIds: ['UP-06', 'UP-09'],
    extraEntities: [
      { name: 'Pasien/Rekam Medis', fields: ['id', 'nama', 'tanggal_lahir', 'riwayat', 'alergi'] },
      { name: 'Jadwal Praktik Dokter', fields: ['id', 'dokter', 'poli', 'hari', 'jam'] },
      { name: 'Resep Obat', fields: ['id', 'pasien_id', 'obat', 'dosis', 'status'] },
      { name: 'Antrian', fields: ['id', 'pasien_id', 'nomor', 'status', 'estimasi'] }
    ],
    notes: [
      'Kerahasiaan data pasien',
      'Antrian & estimasi waktu tunggu',
      'Interaksi resep dengan stok obat',
      'Rujukan ke fasilitas lain'
    ],
    painPoints: [
      { id: 'IND-04-P1', label: 'Antrean panjang & tidak teratur', severity: 'core' },
      { id: 'IND-04-P2', label: 'Rekam medis sulit dicari', severity: 'core' },
      { id: 'IND-04-P3', label: 'Stok obat tidak sinkron dengan resep', severity: 'core' },
      { id: 'IND-04-P4', label: 'Jadwal dokter sering berubah', severity: 'advisory' }
    ],
    roleLabels: ['Dokter', 'Perawat', 'Resepsionis', 'Apoteker', 'Pasien'],
    extraFeatures: [
      { id: 'IND-04-F01', label: 'Pendaftaran pasien & antrian', severity: 'core', complexity: 'MEDIUM' },
      { id: 'IND-04-F02', label: 'Jadwal praktik dokter', severity: 'core', complexity: 'MEDIUM' },
      { id: 'IND-04-F03', label: 'Rekam medis / pemeriksaan', severity: 'core', complexity: 'HIGH', countsForTier: true },
      { id: 'IND-04-F04', label: 'Resep elektronik & stok obat', severity: 'core', complexity: 'HIGH', countsForTier: true },
      { id: 'IND-04-F05', label: 'Rujukan', severity: 'advisory', complexity: 'MEDIUM' },
      { id: 'IND-04-F06', label: 'Estimasi waktu tunggu', severity: 'advisory', complexity: 'MEDIUM' }
    ],
    coreItems: ['Pendaftaran & antrian', 'Pemeriksaan/rekam medis', 'Resep & pengurangan stok obat'],
    advisoryItems: ['Rujukan', 'Estimasi waktu tunggu', 'Pengingat jadwal'],
    provenance: [
      { source: DOC_SOURCE, note: 'Bagian 2.4 Kesehatan' }
    ],
    version: '1.0',
    lastReviewed: REVIEW_DATE
  },

  // ===========================================================================
  // IND-05 — Pendidikan (Sekolah, Bimbel, Kursus Online)
  // ===========================================================================
  {
    id: 'IND-05',
    nama: 'Pendidikan (Sekolah, Bimbel, Kursus Online)',
    keywords: ['sekolah', 'bimbel', 'bimbingan belajar', 'kursus', 'les privat', 'kampus', 'universitas', 'pesantren', 'madrasah', 'rapor', 'spp', 'pendidikan'],
    patternIds: ['UP-06', 'UP-10'],
    extraEntities: [
      { name: 'Siswa', fields: ['id', 'nama', 'kelas', 'orang_tua', 'status'] },
      { name: 'Kelas/Batch', fields: ['id', 'nama', 'pengajar', 'jadwal', 'kuota'] },
      { name: 'Kurikulum/Materi', fields: ['id', 'kelas_id', 'judul', 'urutan'] },
      { name: 'Nilai/Progres', fields: ['id', 'siswa_id', 'materi', 'nilai', 'catatan'] },
      { name: 'Kehadiran', fields: ['id', 'siswa_id', 'tanggal', 'status'] }
    ],
    notes: [
      'Penjadwalan kelas berulang',
      'Progres belajar individual',
      'Rapor & sertifikat',
      'Pembayaran termin/SPP'
    ],
    painPoints: [
      { id: 'IND-05-P1', label: 'Absensi manual', severity: 'core' },
      { id: 'IND-05-P2', label: 'SPP telat / tidak tercatat', severity: 'core' },
      { id: 'IND-05-P3', label: 'Nilai tersebar & rapor lambat', severity: 'core' },
      { id: 'IND-05-P4', label: 'Jadwal kelas bentrok', severity: 'advisory' }
    ],
    roleLabels: ['Admin/TU', 'Guru/Pengajar', 'Siswa', 'Orang Tua', 'Kepala Sekolah'],
    extraFeatures: [
      { id: 'IND-05-F01', label: 'Pendaftaran siswa & kelas', severity: 'core', complexity: 'MEDIUM' },
      { id: 'IND-05-F02', label: 'Jadwal kelas berulang', severity: 'core', complexity: 'MEDIUM', countsForTier: true },
      { id: 'IND-05-F03', label: 'Kehadiran siswa', severity: 'core', complexity: 'MEDIUM' },
      { id: 'IND-05-F04', label: 'Penilaian & rapor', severity: 'core', complexity: 'MEDIUM' },
      { id: 'IND-05-F05', label: 'Pembayaran SPP/termin', severity: 'core', complexity: 'MEDIUM' },
      { id: 'IND-05-F06', label: 'Sertifikat', severity: 'advisory', complexity: 'LOW' },
      { id: 'IND-05-F07', label: 'Portal orang tua', severity: 'advisory', complexity: 'MEDIUM' }
    ],
    coreItems: ['Pendaftaran & kelas', 'Kehadiran', 'Penilaian/rapor', 'Pembayaran SPP'],
    advisoryItems: ['Sertifikat', 'Portal orang tua', 'Progres individual'],
    provenance: [
      { source: DOC_SOURCE, note: 'Bagian 2.5 Pendidikan' }
    ],
    version: '1.0',
    lastReviewed: REVIEW_DATE
  }
];
