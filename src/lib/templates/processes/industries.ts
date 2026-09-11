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
    keywords: ['retail', 'toko', 'minimarket', 'kelontong', 'warung', 'butik', 'petshop', 'sembako', 'ritel'],
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
  },

  // ===========================================================================
  // IND-06 — Manufaktur / Produksi
  // ===========================================================================
  {
    id: 'IND-06',
    nama: 'Manufaktur / Produksi',
    keywords: ['manufaktur', 'produksi', 'pabrik', 'perakitan', 'konveksi', 'garmen', 'bill of materials', 'bom', 'work order', 'qc produksi'],
    patternIds: ['UP-07', 'UP-03', 'UP-09'],
    extraEntities: [
      { name: 'Bill of Material (BOM)', fields: ['id', 'produk_id', 'material', 'qty', 'satuan'] },
      { name: 'Work Center/Mesin', fields: ['id', 'nama', 'kapasitas', 'status'] },
      { name: 'Batch Produksi', fields: ['id', 'work_order_id', 'batch', 'qty_hasil', 'status'] },
      { name: 'QC Inspection', fields: ['id', 'batch_id', 'parameter', 'hasil', 'catatan'] }
    ],
    notes: [
      'Perencanaan kapasitas mesin',
      'Traceability batch bahan baku ke produk jadi',
      'Pencatatan downtime mesin'
    ],
    painPoints: [
      { id: 'IND-06-P1', label: 'Kapasitas mesin tidak terencana', severity: 'core' },
      { id: 'IND-06-P2', label: 'Batch produksi tidak terlacak', severity: 'core' },
      { id: 'IND-06-P3', label: 'Hasil QC tidak terdokumentasi', severity: 'core' },
      { id: 'IND-06-P4', label: 'Downtime mesin tidak tercatat', severity: 'advisory' }
    ],
    roleLabels: ['Admin Produksi', 'PPIC', 'Operator', 'QC', 'Gudang', 'Manajer Pabrik'],
    extraFeatures: [
      { id: 'IND-06-F01', label: 'Work order produksi', severity: 'core', complexity: 'MEDIUM', countsForTier: true },
      { id: 'IND-06-F02', label: 'BOM & kebutuhan material', severity: 'core', complexity: 'HIGH', countsForTier: true },
      { id: 'IND-06-F03', label: 'Batch & traceability', severity: 'core', complexity: 'HIGH', countsForTier: true },
      { id: 'IND-06-F04', label: 'QC inspection', severity: 'core', complexity: 'MEDIUM' },
      { id: 'IND-06-F05', label: 'Stok barang jadi', severity: 'core', complexity: 'MEDIUM' },
      { id: 'IND-06-F06', label: 'Kapasitas & jadwal mesin', severity: 'advisory', complexity: 'HIGH', countsForTier: true },
      { id: 'IND-06-F07', label: 'Pencatatan downtime mesin', severity: 'advisory', complexity: 'MEDIUM' }
    ],
    coreItems: ['Work order', 'BOM & pengurangan material', 'Batch/traceability', 'QC inspection'],
    advisoryItems: ['Kapasitas mesin', 'Downtime', 'Maintenance mesin'],
    provenance: [
      { source: DOC_SOURCE, note: 'Bagian 2.6 Manufaktur / Produksi' }
    ],
    version: '1.0',
    lastReviewed: REVIEW_DATE
  },

  // ===========================================================================
  // IND-07 — Logistik & Ekspedisi
  // ===========================================================================
  {
    id: 'IND-07',
    nama: 'Logistik & Ekspedisi',
    keywords: ['logistik', 'ekspedisi', 'kurir', 'pengiriman', 'resi', 'tracking paket', 'armada', 'driver', 'delivery order', 'cod'],
    patternIds: ['UP-02', 'UP-09'],
    extraEntities: [
      { name: 'Shipment/Resi', fields: ['id', 'order_id', 'nomor_resi', 'asal', 'tujuan', 'status'] },
      { name: 'Rute', fields: ['id', 'asal', 'tujuan', 'estimasi', 'jarak'] },
      { name: 'Driver/Kurir', fields: ['id', 'nama', 'kendaraan', 'status'] },
      { name: 'Proof of Delivery', fields: ['id', 'shipment_id', 'penerima', 'foto', 'waktu'] }
    ],
    notes: [
      'Tracking posisi kiriman',
      'Optimasi rute pengiriman',
      'COD reconciliation',
      'SLA pengiriman'
    ],
    painPoints: [
      { id: 'IND-07-P1', label: 'Posisi kiriman tidak diketahui', severity: 'core' },
      { id: 'IND-07-P2', label: 'COD tidak balance', severity: 'core' },
      { id: 'IND-07-P3', label: 'Bukti terima sering hilang', severity: 'core' },
      { id: 'IND-07-P4', label: 'Rute tidak optimal', severity: 'advisory' }
    ],
    roleLabels: ['Admin Logistik', 'Dispatcher', 'Kurir/Driver', 'Gudang', 'Pelanggan'],
    extraFeatures: [
      { id: 'IND-07-F01', label: 'Input order kirim & resi', severity: 'core', complexity: 'MEDIUM' },
      { id: 'IND-07-F02', label: 'Assign kurir', severity: 'core', complexity: 'LOW' },
      { id: 'IND-07-F03', label: 'Tracking status/resi', severity: 'core', complexity: 'MEDIUM' },
      { id: 'IND-07-F04', label: 'Proof of delivery', severity: 'core', complexity: 'MEDIUM' },
      { id: 'IND-07-F05', label: 'COD reconciliation', severity: 'core', complexity: 'MEDIUM', countsForTier: true },
      { id: 'IND-07-F06', label: 'Optimasi rute', severity: 'advisory', complexity: 'HIGH', countsForTier: true },
      { id: 'IND-07-F07', label: 'Monitoring SLA pengiriman', severity: 'advisory', complexity: 'MEDIUM' }
    ],
    coreItems: ['Order kirim & resi', 'Assign kurir', 'Tracking status', 'Proof of delivery', 'COD reconciliation'],
    advisoryItems: ['Optimasi rute', 'Monitoring SLA', 'Live tracking maps'],
    provenance: [
      { source: DOC_SOURCE, note: 'Bagian 2.7 Logistik & Ekspedisi' }
    ],
    version: '1.0',
    lastReviewed: REVIEW_DATE
  },

  // ===========================================================================
  // IND-08 — Properti & Real Estate
  // ===========================================================================
  {
    id: 'IND-08',
    nama: 'Properti & Real Estate',
    keywords: ['properti', 'real estate', 'sewa apartemen', 'sewa ruko', 'jual beli rumah', 'agent properti', 'kontrak sewa', 'estate management'],
    patternIds: ['UP-01', 'UP-06', 'UP-10'],
    extraEntities: [
      { name: 'Unit/Properti', fields: ['id', 'nama', 'tipe', 'harga', 'status'] },
      { name: 'Kontrak Sewa/Jual', fields: ['id', 'unit_id', 'penyewa_pembeli', 'mulai', 'selesai', 'nilai'] },
      { name: 'Cicilan/Angsuran', fields: ['id', 'kontrak_id', 'periode', 'jumlah', 'status'] },
      { name: 'Maintenance Request Unit', fields: ['id', 'unit_id', 'keluhan', 'status', 'teknisi'] }
    ],
    notes: [
      'Tracking status unit (available/booked/sold)',
      'Jadwal cicilan jangka panjang',
      'Komplain penyewa'
    ],
    painPoints: [
      { id: 'IND-08-P1', label: 'Status unit tidak up-to-date', severity: 'core' },
      { id: 'IND-08-P2', label: 'Cicilan/angsuran terlewat', severity: 'core' },
      { id: 'IND-08-P3', label: 'Komplain penyewa tidak tercatat', severity: 'core' },
      { id: 'IND-08-P4', label: 'Lead survey tidak terkelola', severity: 'advisory' }
    ],
    roleLabels: ['Admin Properti', 'Agent', 'Finance', 'Teknisi Maintenance', 'Penyewa/Pembeli'],
    extraFeatures: [
      { id: 'IND-08-F01', label: 'Data unit & status', severity: 'core', complexity: 'LOW' },
      { id: 'IND-08-F02', label: 'Lead & jadwal survey', severity: 'core', complexity: 'MEDIUM' },
      { id: 'IND-08-F03', label: 'Kontrak sewa/jual', severity: 'core', complexity: 'MEDIUM' },
      { id: 'IND-08-F04', label: 'Jadwal cicilan/sewa', severity: 'core', complexity: 'MEDIUM', countsForTier: true },
      { id: 'IND-08-F05', label: 'Maintenance request', severity: 'core', complexity: 'MEDIUM' },
      { id: 'IND-08-F06', label: 'Reminder jatuh tempo', severity: 'advisory', complexity: 'LOW' },
      { id: 'IND-08-F07', label: 'Laporan okupansi', severity: 'advisory', complexity: 'MEDIUM' }
    ],
    coreItems: ['Data unit & status', 'Kontrak', 'Jadwal cicilan/sewa', 'Maintenance request'],
    advisoryItems: ['Reminder jatuh tempo', 'Laporan okupansi', 'Virtual tour'],
    provenance: [
      { source: DOC_SOURCE, note: 'Bagian 2.8 Properti & Real Estate' }
    ],
    version: '1.0',
    lastReviewed: REVIEW_DATE
  },

  // ===========================================================================
  // IND-09 — Perhotelan & Pariwisata
  // ===========================================================================
  {
    id: 'IND-09',
    nama: 'Perhotelan & Pariwisata',
    keywords: ['hotel', 'penginapan', 'homestay', 'villa', 'resort', 'guest house', 'booking kamar', 'reservasi kamar', 'pariwisata', 'paket wisata'],
    patternIds: ['UP-06', 'UP-02'],
    extraEntities: [
      { name: 'Room/Kamar', fields: ['id', 'nomor', 'tipe', 'harga', 'status'] },
      { name: 'Rate Plan', fields: ['id', 'tipe_kamar', 'musim', 'harga', 'min_stay'] },
      { name: 'Itinerary Paket Wisata', fields: ['id', 'paket', 'hari', 'kegiatan', 'harga'] },
      { name: 'Guest Folio', fields: ['id', 'tamu_id', 'kamar', 'item_tagihan', 'total'] }
    ],
    notes: [
      'Dynamic pricing per musim',
      'Overbooking management',
      'Folio tagihan gabungan (kamar + F&B + tambahan)'
    ],
    painPoints: [
      { id: 'IND-09-P1', label: 'Double booking kamar', severity: 'core' },
      { id: 'IND-09-P2', label: 'Tagihan tamu tercampur', severity: 'core' },
      { id: 'IND-09-P3', label: 'Housekeeping tidak sinkron', severity: 'core' },
      { id: 'IND-09-P4', label: 'Harga kamar tidak fleksibel per musim', severity: 'advisory' }
    ],
    roleLabels: ['Resepsionis', 'Housekeeping', 'Staf F&B', 'Manajer Hotel', 'Tamu'],
    extraFeatures: [
      { id: 'IND-09-F01', label: 'Kalender ketersediaan kamar', severity: 'core', complexity: 'MEDIUM', countsForTier: true },
      { id: 'IND-09-F02', label: 'Booking & check-in/out', severity: 'core', complexity: 'MEDIUM' },
      { id: 'IND-09-F03', label: 'Guest folio', severity: 'core', complexity: 'MEDIUM', countsForTier: true },
      { id: 'IND-09-F04', label: 'Rate plan / dynamic pricing', severity: 'advisory', complexity: 'HIGH', countsForTier: true },
      { id: 'IND-09-F05', label: 'Housekeeping status', severity: 'advisory', complexity: 'MEDIUM' },
      { id: 'IND-09-F06', label: 'Layanan tambahan (F&B, laundry)', severity: 'advisory', complexity: 'MEDIUM' },
      { id: 'IND-09-F07', label: 'Paket wisata/itinerary', severity: 'advisory', complexity: 'MEDIUM' }
    ],
    coreItems: ['Ketersediaan kamar', 'Booking & check-in/out', 'Guest folio'],
    advisoryItems: ['Dynamic pricing', 'Housekeeping', 'Paket wisata'],
    provenance: [
      { source: DOC_SOURCE, note: 'Bagian 2.9 Perhotelan & Pariwisata' }
    ],
    version: '1.0',
    lastReviewed: REVIEW_DATE
  },

  // ===========================================================================
  // IND-10 — Konstruksi
  // ===========================================================================
  {
    id: 'IND-10',
    nama: 'Konstruksi',
    keywords: ['konstruksi', 'kontraktor', 'pembangunan', 'proyek bangunan', 'rab', 'subkontraktor', 'opname pekerjaan', 'site report', 'alat berat'],
    patternIds: ['UP-07', 'UP-03', 'UP-09'],
    extraEntities: [
      { name: 'RAB (Rencana Anggaran Biaya)', fields: ['id', 'proyek_id', 'item_pekerjaan', 'volume', 'harga_satuan'] },
      { name: 'Progress Termin', fields: ['id', 'proyek_id', 'persentase', 'nilai', 'status'] },
      { name: 'Subkontraktor', fields: ['id', 'nama', 'lingkup', 'nilai_kontrak'] },
      { name: 'Site Report', fields: ['id', 'proyek_id', 'tanggal', 'progres', 'foto', 'lokasi'] }
    ],
    notes: [
      'Laporan progres harian di lapangan (foto + lokasi)',
      'Termin pembayaran bertahap',
      'Tracking material di site'
    ],
    painPoints: [
      { id: 'IND-10-P1', label: 'Progres lapangan tidak terdokumentasi', severity: 'core' },
      { id: 'IND-10-P2', label: 'Termin telat ditagih', severity: 'core' },
      { id: 'IND-10-P3', label: 'Material site hilang/tidak tercatat', severity: 'core' },
      { id: 'IND-10-P4', label: 'Subkontraktor tidak terpantau', severity: 'advisory' }
    ],
    roleLabels: ['Project Manager', 'Site Engineer', 'Pengawas Lapangan', 'Logistik Material', 'Finance', 'Subkontraktor'],
    extraFeatures: [
      { id: 'IND-10-F01', label: 'RAB & item pekerjaan', severity: 'core', complexity: 'MEDIUM', countsForTier: true },
      { id: 'IND-10-F02', label: 'Laporan harian + foto/lokasi', severity: 'core', complexity: 'MEDIUM' },
      { id: 'IND-10-F03', label: 'Opname progres & termin', severity: 'core', complexity: 'HIGH', countsForTier: true },
      { id: 'IND-10-F04', label: 'Material site', severity: 'core', complexity: 'MEDIUM' },
      { id: 'IND-10-F05', label: 'Subkontraktor & kontrak', severity: 'core', complexity: 'MEDIUM' },
      { id: 'IND-10-F06', label: 'Alat berat', severity: 'advisory', complexity: 'MEDIUM' },
      { id: 'IND-10-F07', label: 'Kurva-S progres', severity: 'advisory', complexity: 'MEDIUM' }
    ],
    coreItems: ['RAB', 'Laporan harian lapangan', 'Opname & termin', 'Material site'],
    advisoryItems: ['Alat berat', 'Kurva-S', 'K3/safety report'],
    provenance: [
      { source: DOC_SOURCE, note: 'Bagian 2.10 Konstruksi' }
    ],
    version: '1.0',
    lastReviewed: REVIEW_DATE
  },

  // ===========================================================================
  // IND-11 — Pertanian & Agribisnis
  // ===========================================================================
  {
    id: 'IND-11',
    nama: 'Pertanian & Agribisnis',
    keywords: ['pertanian', 'kebun', 'ladang', 'panen', 'tanam', 'agribisnis', 'peternakan', 'komoditas', 'tani', 'pemupukan'],
    patternIds: ['UP-07', 'UP-09', 'UP-02'],
    extraEntities: [
      { name: 'Lahan/Kebun', fields: ['id', 'nama', 'luas', 'lokasi', 'status'] },
      { name: 'Siklus Tanam', fields: ['id', 'lahan_id', 'komoditas', 'mulai', 'estimasi_panen', 'status'] },
      { name: 'Panen', fields: ['id', 'siklus_id', 'tanggal', 'jumlah', 'grade'] },
      { name: 'Distribusi Hasil', fields: ['id', 'panen_id', 'tujuan', 'qty', 'status'] }
    ],
    notes: [
      'Pencatatan siklus musim tanam',
      'Hasil panen per lahan',
      'Harga jual fluktuatif per komoditas'
    ],
    painPoints: [
      { id: 'IND-11-P1', label: 'Siklus tanam tidak tercatat', severity: 'core' },
      { id: 'IND-11-P2', label: 'Hasil per lahan tidak terukur', severity: 'core' },
      { id: 'IND-11-P3', label: 'Harga komoditas tidak terpantau', severity: 'advisory' },
      { id: 'IND-11-P4', label: 'Distribusi hasil tidak efisien', severity: 'advisory' }
    ],
    roleLabels: ['Pemilik Lahan', 'Mandor', 'Petani', 'Logistik Gudang', 'Pembeli'],
    extraFeatures: [
      { id: 'IND-11-F01', label: 'Data lahan & musim tanam', severity: 'core', complexity: 'MEDIUM' },
      { id: 'IND-11-F02', label: 'Catatan perawatan/pemupukan', severity: 'core', complexity: 'MEDIUM' },
      { id: 'IND-11-F03', label: 'Panen & hasil per lahan', severity: 'core', complexity: 'MEDIUM', countsForTier: true },
      { id: 'IND-11-F04', label: 'Grading kualitas', severity: 'core', complexity: 'LOW' },
      { id: 'IND-11-F05', label: 'Stok hasil gudang', severity: 'core', complexity: 'MEDIUM' },
      { id: 'IND-11-F06', label: 'Harga komoditas & penjualan', severity: 'advisory', complexity: 'MEDIUM' },
      { id: 'IND-11-F07', label: 'Distribusi/pengiriman hasil', severity: 'advisory', complexity: 'MEDIUM' }
    ],
    coreItems: ['Data lahan & musim', 'Perawatan/pemupukan', 'Panen & hasil per lahan', 'Stok gudang'],
    advisoryItems: ['Harga komoditas', 'Distribusi hasil', 'Prediksi panen'],
    provenance: [
      { source: DOC_SOURCE, note: 'Bagian 2.11 Pertanian & Agribisnis' }
    ],
    version: '1.0',
    lastReviewed: REVIEW_DATE
  },

  // ===========================================================================
  // IND-12 — Keuangan & Pegadaian/Fintech
  // ===========================================================================
  {
    id: 'IND-12',
    nama: 'Keuangan & Pegadaian/Fintech',
    keywords: ['keuangan', 'pegadaian', 'fintech', 'pinjaman', 'gadai', 'kredit', 'cicilan', 'bunga', 'collateral', 'taksiran', 'leasing'],
    patternIds: ['UP-02', 'UP-10', 'UP-08'],
    extraEntities: [
      { name: 'Nasabah', fields: ['id', 'nama', 'identitas', 'kontak', 'status_verifikasi'] },
      { name: 'Barang Jaminan/Collateral', fields: ['id', 'jenis', 'deskripsi', 'nilai_taksiran', 'status'] },
      { name: 'Skema Pinjaman', fields: ['id', 'plafon', 'bunga', 'tenor', 'biaya_admin'] },
      { name: 'Jadwal Cicilan/Bunga', fields: ['id', 'pinjaman_id', 'angsuran_ke', 'jatuh_tempo', 'jumlah', 'status'] },
      { name: 'Taksiran Nilai', fields: ['id', 'jaminan_id', 'penaksir', 'nilai', 'tanggal'] }
    ],
    notes: [
      'Proses taksir barang jaminan',
      'Jatuh tempo & lelang',
      'Perhitungan bunga/biaya administrasi',
      'Verifikasi identitas nasabah'
    ],
    painPoints: [
      { id: 'IND-12-P1', label: 'Taksiran tidak konsisten', severity: 'core' },
      { id: 'IND-12-P2', label: 'Jatuh tempo terlewat', severity: 'core' },
      { id: 'IND-12-P3', label: 'Perhitungan bunga manual', severity: 'core' },
      { id: 'IND-12-P4', label: 'Identitas nasabah tidak terverifikasi', severity: 'advisory' }
    ],
    roleLabels: ['Admin Keuangan', 'Penaksir', 'Kasir', 'Kolektor', 'Nasabah'],
    extraFeatures: [
      { id: 'IND-12-F01', label: 'Data nasabah & verifikasi identitas', severity: 'core', complexity: 'MEDIUM' },
      { id: 'IND-12-F02', label: 'Pengajuan pinjaman & skema', severity: 'core', complexity: 'MEDIUM', countsForTier: true },
      { id: 'IND-12-F03', label: 'Taksiran barang jaminan', severity: 'core', complexity: 'HIGH', countsForTier: true },
      { id: 'IND-12-F04', label: 'Jadwal cicilan & bunga', severity: 'core', complexity: 'HIGH', countsForTier: true },
      { id: 'IND-12-F05', label: 'Pembayaran angsuran', severity: 'core', complexity: 'MEDIUM' },
      { id: 'IND-12-F06', label: 'Jatuh tempo & lelang', severity: 'advisory', complexity: 'HIGH', countsForTier: true },
      { id: 'IND-12-F07', label: 'Laporan portofolio pinjaman', severity: 'advisory', complexity: 'MEDIUM' }
    ],
    coreItems: ['Data nasabah', 'Pengajuan & skema pinjaman', 'Taksiran jaminan', 'Jadwal cicilan/bunga', 'Pembayaran angsuran'],
    advisoryItems: ['Jatuh tempo & lelang', 'Laporan portofolio', 'Reminder kolektor'],
    provenance: [
      { source: DOC_SOURCE, note: 'Bagian 2.12 Keuangan & Pegadaian/Fintech' }
    ],
    version: '1.0',
    lastReviewed: REVIEW_DATE
  },

  // ===========================================================================
  // IND-13 — Layanan Otomotif (Bengkel, Rental, Dealer)
  // ===========================================================================
  {
    id: 'IND-13',
    nama: 'Layanan Otomotif (Bengkel, Rental, Dealer)',
    keywords: ['bengkel', 'otomotif', 'servis motor', 'servis mobil', 'dealer', 'rental mobil', 'rental motor', 'spare part', 'montir', 'mekanik', 'ganti oli'],
    patternIds: ['UP-05', 'UP-09', 'UP-06'],
    extraEntities: [
      { name: 'Kendaraan/Unit', fields: ['id', 'plat', 'merk', 'tipe', 'status'] },
      { name: 'Riwayat Servis', fields: ['id', 'kendaraan_id', 'tanggal', 'keluhan', 'tindakan', 'biaya'] },
      { name: 'Spare Part', fields: ['id', 'nama', 'kode', 'stok', 'harga'] },
      { name: 'Kontrak Sewa/Kredit', fields: ['id', 'kendaraan_id', 'penyewa', 'periode', 'nilai'] }
    ],
    notes: [
      'Riwayat servis per kendaraan',
      'Estimasi biaya servis',
      'Tracking unit rental (available/booked)'
    ],
    painPoints: [
      { id: 'IND-13-P1', label: 'Riwayat servis per unit hilang', severity: 'core' },
      { id: 'IND-13-P2', label: 'Stok spare part tidak sinkron', severity: 'core' },
      { id: 'IND-13-P3', label: 'Estimasi biaya tidak konsisten', severity: 'advisory' },
      { id: 'IND-13-P4', label: 'Status unit rental tidak update', severity: 'advisory' }
    ],
    roleLabels: ['Service Advisor', 'Mekanik', 'Kasir', 'Gudang Spare Part', 'Pelanggan'],
    extraFeatures: [
      { id: 'IND-13-F01', label: 'Terima unit & keluhan', severity: 'core', complexity: 'LOW' },
      { id: 'IND-13-F02', label: 'Work order servis', severity: 'core', complexity: 'MEDIUM' },
      { id: 'IND-13-F03', label: 'Riwayat servis per kendaraan', severity: 'core', complexity: 'MEDIUM', countsForTier: true },
      { id: 'IND-13-F04', label: 'Spare part & pengurangan stok', severity: 'core', complexity: 'MEDIUM' },
      { id: 'IND-13-F05', label: 'Estimasi biaya & persetujuan', severity: 'core', complexity: 'MEDIUM' },
      { id: 'IND-13-F06', label: 'Booking servis', severity: 'advisory', complexity: 'MEDIUM' },
      { id: 'IND-13-F07', label: 'Status unit rental', severity: 'advisory', complexity: 'MEDIUM' }
    ],
    coreItems: ['Terima unit & keluhan', 'Work order servis', 'Riwayat servis', 'Spare part'],
    advisoryItems: ['Booking servis', 'Status unit rental', 'Estimasi biaya otomatis'],
    provenance: [
      { source: DOC_SOURCE, note: 'Bagian 2.13 Layanan Otomotif' }
    ],
    version: '1.0',
    lastReviewed: REVIEW_DATE
  },

  // ===========================================================================
  // IND-14 — Event & Hiburan
  // ===========================================================================
  {
    id: 'IND-14',
    nama: 'Event & Hiburan',
    keywords: ['event', 'hiburan', 'tiket', 'konser', 'seminar', 'webinar', 'festival', 'pameran', 'e-ticket', 'rundown'],
    patternIds: ['UP-06', 'UP-01'],
    extraEntities: [
      { name: 'Tiket/Kategori Kursi', fields: ['id', 'event_id', 'kategori', 'harga', 'kuota'] },
      { name: 'Vendor Pendukung', fields: ['id', 'nama', 'layanan', 'kontak', 'status'] },
      { name: 'Rundown Acara', fields: ['id', 'event_id', 'waktu', 'kegiatan', 'penanggung_jawab'] },
      { name: 'Guest List', fields: ['id', 'event_id', 'nama', 'kategori', 'status_checkin'] }
    ],
    notes: [
      'Kapasitas venue & seat mapping',
      'Check-in tiket (QR)',
      'Koordinasi multi-vendor'
    ],
    painPoints: [
      { id: 'IND-14-P1', label: 'Tiket ganda/palsu', severity: 'core' },
      { id: 'IND-14-P2', label: 'Seat mapping kacau', severity: 'core' },
      { id: 'IND-14-P3', label: 'Check-in lambat', severity: 'core' },
      { id: 'IND-14-P4', label: 'Vendor tidak terkoordinasi', severity: 'advisory' }
    ],
    roleLabels: ['Event Manager', 'Ticketing', 'Vendor', 'Staff Check-in', 'Peserta'],
    extraFeatures: [
      { id: 'IND-14-F01', label: 'Katalog event & tiket', severity: 'core', complexity: 'MEDIUM' },
      { id: 'IND-14-F02', label: 'Seat mapping & kapasitas', severity: 'core', complexity: 'HIGH', countsForTier: true },
      { id: 'IND-14-F03', label: 'Pembayaran & e-ticket QR', severity: 'core', complexity: 'MEDIUM', countsForTier: true },
      { id: 'IND-14-F04', label: 'Check-in QR', severity: 'core', complexity: 'MEDIUM' },
      { id: 'IND-14-F05', label: 'Rundown acara', severity: 'core', complexity: 'MEDIUM' },
      { id: 'IND-14-F06', label: 'Koordinasi vendor', severity: 'advisory', complexity: 'MEDIUM' },
      { id: 'IND-14-F07', label: 'Guest list', severity: 'advisory', complexity: 'LOW' },
      { id: 'IND-14-F08', label: 'Laporan penjualan tiket', severity: 'advisory', complexity: 'MEDIUM' }
    ],
    coreItems: ['Katalog event & tiket', 'Seat/kapasitas', 'Pembayaran & e-ticket', 'Check-in QR', 'Rundown'],
    advisoryItems: ['Koordinasi vendor', 'Guest list', 'Laporan penjualan'],
    provenance: [
      { source: DOC_SOURCE, note: 'Bagian 2.14 Event & Hiburan' }
    ],
    version: '1.0',
    lastReviewed: REVIEW_DATE
  },

  // ===========================================================================
  // IND-15 — Layanan Publik/Pemerintahan Internal
  // ===========================================================================
  {
    id: 'IND-15',
    nama: 'Layanan Publik / Pemerintahan',
    keywords: ['layanan publik', 'pemerintahan', 'dinas', 'kelurahan', 'kecamatan', 'disposisi', 'surat menyurat', 'warga', 'pelayanan masyarakat', 'izin'],
    patternIds: ['UP-05', 'UP-08'],
    extraEntities: [
      { name: 'Pemohon/Warga', fields: ['id', 'nama', 'nik', 'kontak', 'alamat'] },
      { name: 'Jenis Layanan', fields: ['id', 'nama', 'persyaratan', 'sla_hari', 'biaya'] },
      { name: 'Dokumen Persyaratan', fields: ['id', 'pengajuan_id', 'jenis', 'file', 'status_verifikasi'] },
      { name: 'Disposisi Pejabat', fields: ['id', 'pengajuan_id', 'dari', 'ke', 'catatan', 'waktu'] }
    ],
    notes: [
      'Disposisi berjenjang antar unit',
      'Tracking dokumen persyaratan',
      'SLA layanan publik'
    ],
    painPoints: [
      { id: 'IND-15-P1', label: 'Disposisi lambat', severity: 'core' },
      { id: 'IND-15-P2', label: 'Berkas hilang/tidak lengkap', severity: 'core' },
      { id: 'IND-15-P3', label: 'Status pengajuan tidak jelas bagi warga', severity: 'core' },
      { id: 'IND-15-P4', label: 'SLA tidak terukur', severity: 'advisory' }
    ],
    roleLabels: ['Petugas Loket', 'Verifikator', 'Pejabat Disposisi', 'Kepala Dinas', 'Warga'],
    extraFeatures: [
      { id: 'IND-15-F01', label: 'Katalog jenis layanan & persyaratan', severity: 'core', complexity: 'LOW' },
      { id: 'IND-15-F02', label: 'Pengajuan warga & upload berkas', severity: 'core', complexity: 'MEDIUM' },
      { id: 'IND-15-F03', label: 'Verifikasi berkas', severity: 'core', complexity: 'MEDIUM' },
      { id: 'IND-15-F04', label: 'Disposisi berjenjang', severity: 'core', complexity: 'HIGH', countsForTier: true },
      { id: 'IND-15-F05', label: 'Tracking status & SLA', severity: 'core', complexity: 'MEDIUM', countsForTier: true },
      { id: 'IND-15-F06', label: 'Pengaduan', severity: 'advisory', complexity: 'MEDIUM' },
      { id: 'IND-15-F07', label: 'Arsip digital & tanda tangan', severity: 'advisory', complexity: 'MEDIUM' }
    ],
    coreItems: ['Jenis layanan & persyaratan', 'Pengajuan & berkas', 'Verifikasi', 'Disposisi', 'Status & SLA'],
    advisoryItems: ['Pengaduan', 'Arsip digital', 'Tanda tangan elektronik'],
    provenance: [
      { source: DOC_SOURCE, note: 'Bagian 2.15 Layanan Publik/Pemerintahan Internal' }
    ],
    version: '1.0',
    lastReviewed: REVIEW_DATE
  },

  // ===========================================================================
  // IND-16 — Media & Konten Digital
  // ===========================================================================
  {
    id: 'IND-16',
    nama: 'Media & Konten Digital',
    keywords: ['media', 'konten digital', 'editorial', 'penerbitan', 'artikel', 'publisher', 'content creator', 'monetisasi konten', 'audiens'],
    patternIds: ['UP-07', 'UP-10'],
    extraEntities: [
      { name: 'Content Item', fields: ['id', 'judul', 'jenis', 'status', 'penulis', 'channel'] },
      { name: 'Publishing Schedule', fields: ['id', 'content_id', 'jadwal', 'channel', 'status'] },
      { name: 'Engagement Metric', fields: ['id', 'content_id', 'views', 'likes', 'share', 'periode'] },
      { name: 'Sponsor/Ads Slot', fields: ['id', 'sponsor', 'slot', 'nilai', 'periode'] }
    ],
    notes: [
      'Kalender editorial',
      'Tracking performa konten',
      'Monetisasi iklan/sponsor'
    ],
    painPoints: [
      { id: 'IND-16-P1', label: 'Jadwal publikasi kacau', severity: 'core' },
      { id: 'IND-16-P2', label: 'Performa konten tidak terukur', severity: 'core' },
      { id: 'IND-16-P3', label: 'Ide konten tidak terpusat', severity: 'advisory' },
      { id: 'IND-16-P4', label: 'Sponsor tidak terkelola', severity: 'advisory' }
    ],
    roleLabels: ['Editor', 'Content Creator', 'Approver', 'Sponsor', 'Subscriber'],
    extraFeatures: [
      { id: 'IND-16-F01', label: 'Kalender editorial', severity: 'core', complexity: 'MEDIUM' },
      { id: 'IND-16-F02', label: 'Produksi konten (draft/revisi)', severity: 'core', complexity: 'MEDIUM' },
      { id: 'IND-16-F03', label: 'Approval konten', severity: 'core', complexity: 'MEDIUM', countsForTier: true },
      { id: 'IND-16-F04', label: 'Penjadwalan publikasi', severity: 'core', complexity: 'MEDIUM' },
      { id: 'IND-16-F05', label: 'Tracking performa konten', severity: 'core', complexity: 'MEDIUM' },
      { id: 'IND-16-F06', label: 'Sponsor & ads slot', severity: 'advisory', complexity: 'HIGH', countsForTier: true },
      { id: 'IND-16-F07', label: 'Laporan monetisasi', severity: 'advisory', complexity: 'MEDIUM' },
      { id: 'IND-16-F08', label: 'Data audiens/subscriber', severity: 'advisory', complexity: 'MEDIUM' }
    ],
    coreItems: ['Kalender editorial', 'Produksi konten', 'Approval', 'Publikasi', 'Performa konten'],
    advisoryItems: ['Sponsor & ads', 'Monetisasi', 'Audiens'],
    provenance: [
      { source: DOC_SOURCE, note: 'Bagian 2.16 Media & Konten Digital' }
    ],
    version: '1.0',
    lastReviewed: REVIEW_DATE
  },

  // ===========================================================================
  // IND-17 — Kecantikan & Wellness (Salon, Spa, Gym)
  // ===========================================================================
  {
    id: 'IND-17',
    nama: 'Kecantikan & Wellness (Salon, Spa, Gym)',
    keywords: ['salon', 'spa', 'gym', 'kecantikan', 'wellness', 'massage', 'pijat', 'barbershop', 'treatment', 'fitness', 'yoga', 'refleksi'],
    patternIds: ['UP-06', 'UP-10'],
    extraEntities: [
      { name: 'Terapis/Trainer', fields: ['id', 'nama', 'spesialisasi', 'jadwal', 'status'] },
      { name: 'Paket Treatment', fields: ['id', 'nama', 'durasi', 'harga', 'include'] },
      { name: 'Sesi Terpakai', fields: ['id', 'member_id', 'paket_id', 'tanggal', 'terapis'] },
      { name: 'Alat/Ruang', fields: ['id', 'nama', 'tipe', 'status'] }
    ],
    notes: [
      'Alokasi terapis per slot',
      'Sisa sesi paket member',
      'Cross-sell produk retail'
    ],
    painPoints: [
      { id: 'IND-17-P1', label: 'Terapis bentrok jadwal', severity: 'core' },
      { id: 'IND-17-P2', label: 'Sisa sesi paket member tidak terpantau', severity: 'core' },
      { id: 'IND-17-P3', label: 'Pelanggan no-show', severity: 'core' },
      { id: 'IND-17-P4', label: 'Stok produk retail tidak sinkron', severity: 'advisory' }
    ],
    roleLabels: ['Terapis/Trainer', 'Resepsionis', 'Admin', 'Pelanggan/Member'],
    extraFeatures: [
      { id: 'IND-17-F01', label: 'Booking slot & terapis', severity: 'core', complexity: 'MEDIUM', countsForTier: true },
      { id: 'IND-17-F02', label: 'Paket treatment & harga', severity: 'core', complexity: 'LOW' },
      { id: 'IND-17-F03', label: 'Sesi paket & pemakaian', severity: 'core', complexity: 'MEDIUM', countsForTier: true },
      { id: 'IND-17-F04', label: 'Membership & renewal', severity: 'core', complexity: 'MEDIUM', countsForTier: true },
      { id: 'IND-17-F05', label: 'Alat/ruang', severity: 'advisory', complexity: 'MEDIUM' },
      { id: 'IND-17-F06', label: 'Cross-sell produk retail', severity: 'advisory', complexity: 'MEDIUM' },
      { id: 'IND-17-F07', label: 'Reminder & no-show policy', severity: 'advisory', complexity: 'MEDIUM' }
    ],
    coreItems: ['Booking slot & terapis', 'Paket treatment', 'Sesi paket', 'Membership/renewal'],
    advisoryItems: ['Alat/ruang', 'Cross-sell retail', 'No-show policy'],
    provenance: [
      { source: DOC_SOURCE, note: 'Bagian 2.17 Kecantikan & Wellness' }
    ],
    version: '1.0',
    lastReviewed: REVIEW_DATE
  },

  // ===========================================================================
  // IND-18 — Asuransi
  // ===========================================================================
  {
    id: 'IND-18',
    nama: 'Asuransi',
    keywords: ['asuransi', 'polis', 'premi', 'klaim', 'underwriting', 'pertanggungan', 'adjuster', 'pemegang polis'],
    patternIds: ['UP-01', 'UP-08', 'UP-10'],
    extraEntities: [
      { name: 'Polis', fields: ['id', 'produk', 'pemegang_polis', 'mulai', 'berakhir', 'status'] },
      { name: 'Premi', fields: ['id', 'polis_id', 'periode', 'jumlah', 'status_bayar'] },
      { name: 'Klaim', fields: ['id', 'polis_id', 'jenis', 'tanggal_kejadian', 'status'] },
      { name: 'Underwriting', fields: ['id', 'pengajuan_id', 'penilai', 'risiko', 'keputusan'] },
      { name: 'Ahli Waris/Penerima Manfaat', fields: ['id', 'polis_id', 'nama', 'hubungan', 'persentase'] }
    ],
    notes: [
      'Underwriting sebelum akad',
      'Verifikasi klaim (dokumen + investigasi)',
      'Jadwal pembayaran premi'
    ],
    painPoints: [
      { id: 'IND-18-P1', label: 'Underwriting lambat', severity: 'core' },
      { id: 'IND-18-P2', label: 'Klaim tidak terverifikasi', severity: 'core' },
      { id: 'IND-18-P3', label: 'Premi menunggak tidak terdeteksi', severity: 'core' },
      { id: 'IND-18-P4', label: 'Data penerima manfaat tidak lengkap', severity: 'advisory' }
    ],
    roleLabels: ['Agen', 'Underwriter', 'Adjuster/Investigator', 'Finance', 'Pemegang Polis'],
    extraFeatures: [
      { id: 'IND-18-F01', label: 'Pengajuan polis', severity: 'core', complexity: 'MEDIUM' },
      { id: 'IND-18-F02', label: 'Underwriting', severity: 'core', complexity: 'HIGH', countsForTier: true },
      { id: 'IND-18-F03', label: 'Jadwal & pembayaran premi', severity: 'core', complexity: 'MEDIUM', countsForTier: true },
      { id: 'IND-18-F04', label: 'Pengajuan klaim & dokumen', severity: 'core', complexity: 'MEDIUM' },
      { id: 'IND-18-F05', label: 'Investigasi klaim', severity: 'core', complexity: 'HIGH', countsForTier: true },
      { id: 'IND-18-F06', label: 'Keputusan & kompensasi', severity: 'core', complexity: 'HIGH', countsForTier: true },
      { id: 'IND-18-F07', label: 'Komisi agen', severity: 'advisory', complexity: 'MEDIUM' },
      { id: 'IND-18-F08', label: 'Ahli waris/penerima manfaat', severity: 'advisory', complexity: 'MEDIUM' }
    ],
    coreItems: ['Pengajuan polis', 'Underwriting', 'Premi berkala', 'Klaim & verifikasi', 'Keputusan kompensasi'],
    advisoryItems: ['Komisi agen', 'Ahli waris', 'Renewal polis'],
    provenance: [
      { source: DOC_SOURCE, note: 'Bagian 2.18 Asuransi' }
    ],
    version: '1.0',
    lastReviewed: REVIEW_DATE
  },

  // ===========================================================================
  // IND-19 — E-commerce Marketplace
  // ===========================================================================
  {
    id: 'IND-19',
    nama: 'E-commerce Marketplace',
    keywords: ['marketplace', 'e-commerce', 'ecommerce', 'multi-seller', 'seller', 'escrow', 'toko online', 'mall online'],
    patternIds: ['UP-02', 'UP-01', 'UP-09'],
    extraEntities: [
      { name: 'Seller/Toko', fields: ['id', 'nama', 'pemilik', 'status_verifikasi', 'komisi'] },
      { name: 'Produk Multi-Seller', fields: ['id', 'seller_id', 'nama', 'harga', 'stok'] },
      { name: 'Escrow Payment', fields: ['id', 'order_id', 'jumlah', 'status_escrow', 'rilis_pada'] },
      { name: 'Rating & Review', fields: ['id', 'order_id', 'produk_id', 'rating', 'ulasan'] }
    ],
    notes: [
      'Escrow dana sampai barang diterima',
      'Dispute buyer-seller',
      'Komisi marketplace per transaksi'
    ],
    painPoints: [
      { id: 'IND-19-P1', label: 'Dana seller tidak jelas kapan cair', severity: 'core' },
      { id: 'IND-19-P2', label: 'Dispute tidak tertangani', severity: 'core' },
      { id: 'IND-19-P3', label: 'Komisi sulit dihitung', severity: 'core' },
      { id: 'IND-19-P4', label: 'Produk tidak sesuai deskripsi', severity: 'advisory' }
    ],
    roleLabels: ['Admin Marketplace', 'Seller', 'Buyer', 'Kurir'],
    extraFeatures: [
      { id: 'IND-19-F01', label: 'Pendaftaran & verifikasi seller', severity: 'core', complexity: 'MEDIUM' },
      { id: 'IND-19-F02', label: 'Katalog multi-seller', severity: 'core', complexity: 'MEDIUM' },
      { id: 'IND-19-F03', label: 'Checkout & escrow', severity: 'core', complexity: 'HIGH', countsForTier: true },
      { id: 'IND-19-F04', label: 'Pengiriman & konfirmasi terima', severity: 'core', complexity: 'MEDIUM' },
      { id: 'IND-19-F05', label: 'Pelepasan dana & komisi', severity: 'core', complexity: 'HIGH', countsForTier: true },
      { id: 'IND-19-F06', label: 'Dispute/refund', severity: 'core', complexity: 'MEDIUM', countsForTier: true },
      { id: 'IND-19-F07', label: 'Rating & ulasan', severity: 'advisory', complexity: 'LOW' },
      { id: 'IND-19-F08', label: 'Laporan GMV', severity: 'advisory', complexity: 'MEDIUM' }
    ],
    coreItems: ['Seller & verifikasi', 'Katalog multi-seller', 'Checkout & escrow', 'Pelepasan dana & komisi', 'Dispute'],
    advisoryItems: ['Rating & ulasan', 'Laporan GMV', 'Program promo'],
    provenance: [
      { source: DOC_SOURCE, note: 'Bagian 2.19 E-commerce Marketplace' }
    ],
    version: '1.0',
    lastReviewed: REVIEW_DATE
  },

  // ===========================================================================
  // IND-20 — NGO / Organisasi Nonprofit
  // ===========================================================================
  {
    id: 'IND-20',
    nama: 'NGO / Organisasi Nonprofit',
    keywords: ['ngo', 'nonprofit', 'non-profit', 'donasi', 'donatur', 'organisasi sosial', 'yayasan', 'relawan', 'penerima manfaat'],
    patternIds: ['UP-01', 'UP-05'],
    extraEntities: [
      { name: 'Donatur', fields: ['id', 'nama', 'kontak', 'tipe', 'status'] },
      { name: 'Donasi/Dana', fields: ['id', 'donatur_id', 'jumlah', 'tanggal', 'program_id'] },
      { name: 'Program/Kegiatan', fields: ['id', 'nama', 'target_dana', 'realisasi', 'status'] },
      { name: 'Penerima Manfaat', fields: ['id', 'nama', 'kategori', 'program_id', 'status'] },
      { name: 'Laporan Pertanggungjawaban', fields: ['id', 'program_id', 'periode', 'file', 'status'] }
    ],
    notes: [
      'Transparansi penyaluran dana',
      'Laporan dampak program',
      'Tracking penerima manfaat'
    ],
    painPoints: [
      { id: 'IND-20-P1', label: 'Penyaluran tidak transparan', severity: 'core' },
      { id: 'IND-20-P2', label: 'Donatur tidak dapat laporan', severity: 'core' },
      { id: 'IND-20-P3', label: 'Penerima manfaat tidak terdata', severity: 'core' },
      { id: 'IND-20-P4', label: 'Program tidak terukur dampaknya', severity: 'advisory' }
    ],
    roleLabels: ['Pengurus', 'Fundraiser', 'Relawan', 'Donatur', 'Penerima Manfaat'],
    extraFeatures: [
      { id: 'IND-20-F01', label: 'Pencatatan donasi', severity: 'core', complexity: 'MEDIUM' },
      { id: 'IND-20-F02', label: 'Rekap & alokasi dana', severity: 'core', complexity: 'MEDIUM', countsForTier: true },
      { id: 'IND-20-F03', label: 'Program & penerima manfaat', severity: 'core', complexity: 'MEDIUM' },
      { id: 'IND-20-F04', label: 'Penyaluran & bukti', severity: 'core', complexity: 'MEDIUM' },
      { id: 'IND-20-F05', label: 'Laporan transparansi', severity: 'core', complexity: 'MEDIUM', countsForTier: true },
      { id: 'IND-20-F06', label: 'Relawan & jadwal', severity: 'advisory', complexity: 'MEDIUM' },
      { id: 'IND-20-F07', label: 'Laporan dampak', severity: 'advisory', complexity: 'MEDIUM' }
    ],
    coreItems: ['Donasi', 'Rekap & alokasi dana', 'Program & penerima', 'Penyaluran & bukti', 'Laporan transparansi'],
    advisoryItems: ['Relawan', 'Laporan dampak', 'Publikasi program'],
    provenance: [
      { source: DOC_SOURCE, note: 'Bagian 2.20 NGO/Organisasi Nonprofit' }
    ],
    version: '1.0',
    lastReviewed: REVIEW_DATE
  }
];
