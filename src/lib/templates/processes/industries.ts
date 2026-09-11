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
    roleLabels: ['Resepsionis', 'Housekeeping', 'F&B', 'Manajer Hotel', 'Tamu'],
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
  }
];
