import type { ProcessPattern } from './types';

/**
 * 10 Pola Proses Bisnis Universal (UP-01 s/d UP-10).
 * Sumber: dokumen "Peta Proses Bisnis Universal & Lintas Industri" (Bagian 1),
 * disempurnakan dengan field UI-ready: flowVariants, featureCatalog, painPoints, tierSignals.
 *
 * Field ini dipakai untuk dua hal:
 * 1. Menyuapi prompt AI (PLAN & BUILD).
 * 2. Menghasilkan opsi kartu pilihan pada sesi mockup terpandu.
 */
export const PROCESS_PATTERNS: ProcessPattern[] = [
  // ===========================================================================
  // UP-01 — Lead-to-Customer
  // ===========================================================================
  {
    id: 'UP-01',
    nama: 'Lead-to-Customer',
    tujuan: 'Mengubah calon pelanggan (lead) menjadi pelanggan yang closing.',
    entities: [
      { name: 'Lead', fields: ['id', 'nama', 'kontak', 'sumber', 'status'] },
      { name: 'Contact', fields: ['id', 'nama', 'email', 'telepon', 'perusahaan'] },
      { name: 'Company', fields: ['id', 'nama', 'industri', 'alamat'] },
      { name: 'Interaction/Activity', fields: ['id', 'lead_id', 'jenis', 'catatan', 'waktu'] },
      { name: 'Deal/Opportunity', fields: ['id', 'lead_id', 'nilai', 'stage', 'probabilitas'] },
      { name: 'Stage/Pipeline', fields: ['id', 'nama', 'urutan'] }
    ],
    stages: [
      { id: 'lead-captured', label: 'Lead Masuk' },
      { id: 'qualified', label: 'Kualifikasi' },
      { id: 'assigned', label: 'Assign ke Sales' },
      { id: 'follow-up', label: 'Follow-up' },
      { id: 'proposal', label: 'Penawaran' },
      { id: 'negotiation', label: 'Negosiasi' },
      { id: 'won', label: 'Closing (Won)', terminal: true },
      { id: 'lost', label: 'Lost', terminal: true },
      { id: 'handoff', label: 'Handoff ke Onboarding', terminal: true }
    ],
    actors: [
      { role: 'Sales/Marketing', category: 'operational', goals: ['Menangani lead', 'Follow-up', 'Closing'], countsForTier: true },
      { role: 'Sales Manager', category: 'business', goals: ['Memantau pipeline', 'Approval diskon'] },
      { role: 'Customer Success', category: 'operational', goals: ['Menerima handoff', 'Onboarding pelanggan'] }
    ],
    flowVariants: [
      {
        id: 'UP-01-FV1',
        label: 'Pipeline sales standar',
        summary: 'Lead masuk → kualifikasi → follow-up → penawaran → negosiasi → closing.',
        stagePath: ['Lead Masuk', 'Kualifikasi', 'Follow-up', 'Penawaran', 'Negosiasi', 'Closing (Won)']
      },
      {
        id: 'UP-01-FV2',
        label: 'Auto-assign + nurturing',
        summary: 'Lead masuk otomatis dibagi ke sales, lalu di-nurturing berkala sampai siap closing.',
        stagePath: ['Lead Masuk', 'Assign ke Sales', 'Follow-up', 'Penawaran', 'Closing (Won)']
      },
      {
        id: 'UP-01-FV3',
        label: 'Masih manual / belum berjalan',
        summary: 'Lead masih dicatat di chat/kertas, belum ada pipeline tetap.',
        stagePath: ['Lead Masuk']
      }
    ],
    features: [
      { id: 'UP-01-F01', label: 'Form capture lead', severity: 'core', complexity: 'LOW' },
      { id: 'UP-01-F02', label: 'Kanban pipeline', severity: 'core', complexity: 'MEDIUM', countsForTier: true },
      { id: 'UP-01-F03', label: 'Log aktivitas follow-up', severity: 'core', complexity: 'LOW' },
      { id: 'UP-01-F04', label: 'Reminder follow-up', severity: 'advisory', complexity: 'LOW' },
      { id: 'UP-01-F05', label: 'Laporan konversi lead', severity: 'advisory', complexity: 'MEDIUM' },
      { id: 'UP-01-F06', label: 'Approval diskon khusus', severity: 'advisory', complexity: 'HIGH', countsForTier: true }
    ],
    painPoints: [
      { id: 'UP-01-P1', label: 'Lead tidak terkelola / tercampur di chat', severity: 'core' },
      { id: 'UP-01-P2', label: 'Follow-up sering lupa', severity: 'core' },
      { id: 'UP-01-P3', label: 'Tidak ada pipeline/status yang jelas', severity: 'core' },
      { id: 'UP-01-P4', label: 'Laporan konversi masih manual', severity: 'advisory' }
    ],
    tierSignals: [
      { id: 'UP-01-T1', label: 'Multi-pipeline atau multi-tim sales' },
      { id: 'UP-01-T2', label: 'Approval diskon berjenjang' },
      { id: 'UP-01-T3', label: 'Integrasi marketing/lead otomatis' }
    ],
    businessRules: [
      { id: 'UP-01-BR1', type: 'policy', label: 'Lead wajib punya sumber & status yang jelas', severity: 'core' },
      { id: 'UP-01-BR2', type: 'policy', label: 'Follow-up maksimal X hari sebelum lead dingin', severity: 'advisory' },
      { id: 'UP-01-BR3', type: 'approval', label: 'Diskon di atas batas butuh persetujuan Sales Manager', severity: 'advisory' }
    ],
    edgeCases: [
      { id: 'UP-01-EC1', scenario: 'Lead duplikat', handling: 'Deteksi & gabungkan berdasarkan kontak', severity: 'core' },
      { id: 'UP-01-EC2', scenario: 'Lead tidak direspons sales', handling: 'Auto-reassign ke sales lain', severity: 'advisory' },
      { id: 'UP-01-EC3', scenario: 'Deal lost', handling: 'Catat alasan lost untuk analisis', severity: 'advisory' }
    ],
    notifications: [
      { id: 'UP-01-N1', event: 'Lead baru masuk', recipient: 'Sales', channel: 'In-app' },
      { id: 'UP-01-N2', event: 'Follow-up jatuh tempo', recipient: 'Sales', channel: 'In-app' },
      { id: 'UP-01-N3', event: 'Deal won', recipient: 'Customer Success', channel: 'In-app' }
    ],
    audit: ['Riwayat perubahan stage deal', 'Log aktivitas follow-up']
  },

  // ===========================================================================
  // UP-02 — Order-to-Cash
  // ===========================================================================
  {
    id: 'UP-02',
    nama: 'Order-to-Cash',
    tujuan: 'Memproses pesanan pelanggan sampai pembayaran diterima.',
    entities: [
      { name: 'Customer', fields: ['id', 'nama', 'kontak', 'alamat'] },
      { name: 'Product/Item', fields: ['id', 'nama', 'harga', 'stok'] },
      { name: 'Order', fields: ['id', 'customer_id', 'tanggal', 'status', 'total'] },
      { name: 'Order Line', fields: ['id', 'order_id', 'produk_id', 'qty', 'harga'] },
      { name: 'Invoice', fields: ['id', 'order_id', 'nomor', 'jatuh_tempo', 'status'] },
      { name: 'Payment', fields: ['id', 'invoice_id', 'tanggal', 'metode', 'jumlah'] },
      { name: 'Shipment', fields: ['id', 'order_id', 'kurir', 'resi', 'status'] }
    ],
    stages: [
      { id: 'draft', label: 'Draft Pesanan' },
      { id: 'confirmed', label: 'Dikonfirmasi' },
      { id: 'stock-check', label: 'Cek Stok/Kapasitas' },
      { id: 'fulfilled', label: 'Diproses/Dikirim' },
      { id: 'invoiced', label: 'Invoice Terbit' },
      { id: 'paid', label: 'Dibayar' },
      { id: 'reconciled', label: 'Rekonsiliasi', terminal: true },
      { id: 'cancelled', label: 'Dibatalkan', terminal: true }
    ],
    actors: [
      { role: 'Sales/CS', category: 'operational', goals: ['Menerima pesanan', 'Konfirmasi'], countsForTier: true },
      { role: 'Warehouse/Ops', category: 'operational', goals: ['Siapkan & kirim pesanan'], countsForTier: true },
      { role: 'Finance', category: 'operational', goals: ['Invoice', 'Rekonsiliasi pembayaran'] }
    ],
    flowVariants: [
      {
        id: 'UP-02-FV1',
        label: 'Pesan → kirim → invoice → bayar',
        summary: 'Pesanan dikonfirmasi, barang dikirim, invoice dikirim, pembayaran dicatat.',
        stagePath: ['Draft Pesanan', 'Dikonfirmasi', 'Diproses/Dikirim', 'Invoice Terbit', 'Dibayar']
      },
      {
        id: 'UP-02-FV2',
        label: 'Bayar dulu → baru diproses',
        summary: 'Pelanggan bayar di muka, lalu pesanan diproses dan dikirim.',
        stagePath: ['Draft Pesanan', 'Dikonfirmasi', 'Dibayar', 'Diproses/Dikirim']
      },
      {
        id: 'UP-02-FV3',
        label: 'Pesanan berulang/langganan',
        summary: 'Pesanan rutin dengan jadwal tetap dan invoice berkala.',
        stagePath: ['Draft Pesanan', 'Dikonfirmasi', 'Diproses/Dikirim', 'Invoice Terbit', 'Dibayar', 'Rekonsiliasi']
      }
    ],
    features: [
      { id: 'UP-02-F01', label: 'Katalog produk/Item', severity: 'core', complexity: 'LOW' },
      { id: 'UP-02-F02', label: 'Form pesanan/keranjang', severity: 'core', complexity: 'MEDIUM' },
      { id: 'UP-02-F03', label: 'Tracking status pesanan', severity: 'core', complexity: 'MEDIUM' },
      { id: 'UP-02-F04', label: 'Invoice generator', severity: 'core', complexity: 'MEDIUM', countsForTier: true },
      { id: 'UP-02-F05', label: 'Pencatatan pembayaran', severity: 'core', complexity: 'LOW' },
      { id: 'UP-02-F06', label: 'Integrasi payment gateway', severity: 'advisory', complexity: 'HIGH', countsForTier: true },
      { id: 'UP-02-F07', label: 'Rekonsiliasi otomatis', severity: 'advisory', complexity: 'HIGH', countsForTier: true }
    ],
    painPoints: [
      { id: 'UP-02-P1', label: 'Pesanan dicatat manual / hilang', severity: 'core' },
      { id: 'UP-02-P2', label: 'Stok tidak sinkron dengan pesanan', severity: 'core' },
      { id: 'UP-02-P3', label: 'Invoice telat / tidak terkirim', severity: 'advisory' },
      { id: 'UP-02-P4', label: 'Pembayaran tidak terpantau (piutang)', severity: 'core' }
    ],
    tierSignals: [
      { id: 'UP-02-T1', label: 'Multi-gudang / multi-cabang' },
      { id: 'UP-02-T2', label: 'Pengiriman parsial (partial shipment)' },
      { id: 'UP-02-T3', label: 'Diskon/promo bertingkat' },
      { id: 'UP-02-T4', label: 'Integrasi payment gateway' }
    ],
    businessRules: [
      { id: 'UP-02-BR1', type: 'money', label: 'Total pesanan = subtotal - diskon + pajak', severity: 'core' },
      { id: 'UP-02-BR2', type: 'money', label: 'Pembayaran sebagian mencatat piutang', severity: 'core' },
      { id: 'UP-02-BR3', type: 'policy', label: 'Stok berkurang setelah pesanan dikonfirmasi', severity: 'core' },
      { id: 'UP-02-BR4', type: 'money', label: 'Refund pembatalan sesuai kebijakan', severity: 'advisory' }
    ],
    edgeCases: [
      { id: 'UP-02-EC1', scenario: 'Pesanan dibatalkan setelah dibayar', handling: 'Refund + kembalikan stok', severity: 'core' },
      { id: 'UP-02-EC2', scenario: 'Stok kurang saat konfirmasi', handling: 'Backorder atau pengiriman parsial', severity: 'advisory' },
      { id: 'UP-02-EC3', scenario: 'Pembayaran telat', handling: 'Reminder + status piutang', severity: 'advisory' }
    ],
    notifications: [
      { id: 'UP-02-N1', event: 'Pesanan baru', recipient: 'Ops/Warehouse', channel: 'In-app' },
      { id: 'UP-02-N2', event: 'Pembayaran diterima', recipient: 'Finance', channel: 'In-app' },
      { id: 'UP-02-N3', event: 'Barang dikirim', recipient: 'Customer', channel: 'WhatsApp/In-app' }
    ],
    audit: ['Riwayat perubahan status pesanan', 'Log pembayaran & invoice']
  },

  // ===========================================================================
  // UP-03 — Procure-to-Pay
  // ===========================================================================
  {
    id: 'UP-03',
    nama: 'Procure-to-Pay',
    tujuan: 'Mengadakan barang/jasa dari vendor sampai pembayaran ke vendor.',
    entities: [
      { name: 'Vendor/Supplier', fields: ['id', 'nama', 'kontak', 'bank'] },
      { name: 'Purchase Request', fields: ['id', 'requester', 'item', 'qty', 'status'] },
      { name: 'Purchase Order', fields: ['id', 'vendor_id', 'tanggal', 'status', 'total'] },
      { name: 'Goods Receipt', fields: ['id', 'po_id', 'tanggal_terima', 'kondisi'] },
      { name: 'Vendor Invoice', fields: ['id', 'po_id', 'nomor', 'jumlah'] },
      { name: 'Payment', fields: ['id', 'invoice_id', 'tanggal', 'metode'] }
    ],
    stages: [
      { id: 'requested', label: 'Permintaan Pembelian' },
      { id: 'approved', label: 'Disetujui' },
      { id: 'po-issued', label: 'PO diterbitkan' },
      { id: 'received', label: 'Barang/Jasa Diterima' },
      { id: 'matched', label: 'Cocok Invoice (3-way match)' },
      { id: 'paid', label: 'Dibayar', terminal: true },
      { id: 'rejected', label: 'Ditolak', terminal: true }
    ],
    actors: [
      { role: 'Requester', category: 'operational', goals: ['Ajukan permintaan'], countsForTier: true },
      { role: 'Procurement', category: 'operational', goals: ['Buat PO', 'Pilih vendor'], countsForTier: true },
      { role: 'Approver', category: 'business', goals: ['Menyetujui pengadaan'] },
      { role: 'Finance/AP', category: 'operational', goals: ['Cocokkan invoice', 'Bayar vendor'] }
    ],
    flowVariants: [
      {
        id: 'UP-03-FV1',
        label: 'Request → approval → PO → terima → bayar',
        summary: 'Permintaan diajukan, disetujui atasan, PO diterbitkan, barang diterima, invoice dibayar.',
        stagePath: ['Permintaan Pembelian', 'Disetujui', 'PO diterbitkan', 'Barang/Jasa Diterima', 'Dibayar']
      },
      {
        id: 'UP-03-FV2',
        label: 'PO langsung (stok minimum)',
        summary: 'Procurement membuat PO otomatis saat stok minimum, tanpa request formal.',
        stagePath: ['PO diterbitkan', 'Barang/Jasa Diterima', 'Cocok Invoice (3-way match)', 'Dibayar']
      },
      {
        id: 'UP-03-FV3',
        label: 'Tanpa approval formal',
        summary: 'Pembelian kecil dicatat langsung tanpa alur persetujuan berjenjang.',
        stagePath: ['Permintaan Pembelian', 'PO diterbitkan', 'Dibayar']
      }
    ],
    features: [
      { id: 'UP-03-F01', label: 'Form permintaan pembelian', severity: 'core', complexity: 'LOW' },
      { id: 'UP-03-F02', label: 'Approval workflow', severity: 'core', complexity: 'HIGH', countsForTier: true },
      { id: 'UP-03-F03', label: 'Tracking PO', severity: 'core', complexity: 'MEDIUM' },
      { id: 'UP-03-F04', label: 'Penerimaan barang (goods receipt)', severity: 'core', complexity: 'MEDIUM' },
      { id: 'UP-03-F05', label: '3-way matching (PO-receipt-invoice)', severity: 'advisory', complexity: 'HIGH', countsForTier: true },
      { id: 'UP-03-F06', label: 'Pembayaran vendor & jadwal bayar', severity: 'advisory', complexity: 'MEDIUM' }
    ],
    painPoints: [
      { id: 'UP-03-P1', label: 'Approval pengadaan lambat', severity: 'core' },
      { id: 'UP-03-P2', label: 'PO/riwayat pembelian tidak terlacak', severity: 'core' },
      { id: 'UP-03-P3', label: 'Invoice vendor tidak cocok dengan PO/barang', severity: 'core' },
      { id: 'UP-03-P4', label: 'Jadwal pembayaran terlewat', severity: 'advisory' }
    ],
    tierSignals: [
      { id: 'UP-03-T1', label: 'Approval berjenjang (>1 level)' },
      { id: 'UP-03-T2', label: '3-way matching' },
      { id: 'UP-03-T3', label: 'Multi-vendor / multi-currency' }
    ],
    businessRules: [
      { id: 'UP-03-BR1', type: 'approval', label: 'PO di atas nominal tertentu butuh approval', severity: 'core' },
      { id: 'UP-03-BR2', type: 'policy', label: 'Vendor harus terdaftar sebelum PO diterbitkan', severity: 'core' },
      { id: 'UP-03-BR3', type: 'money', label: 'Pembayaran hanya setelah invoice cocok dengan PO & penerimaan', severity: 'advisory' }
    ],
    edgeCases: [
      { id: 'UP-03-EC1', scenario: 'Barang diterima sebagian', handling: 'Catat penerimaan parsial, PO tetap terbuka', severity: 'core' },
      { id: 'UP-03-EC2', scenario: 'Harga invoice beda dengan PO', handling: 'Tandai dispute, tahan pembayaran', severity: 'core' },
      { id: 'UP-03-EC3', scenario: 'Permintaan ditolak', handling: 'Catat alasan, requester bisa revisi', severity: 'advisory' }
    ],
    notifications: [
      { id: 'UP-03-N1', event: 'Permintaan menunggu approval', recipient: 'Approver', channel: 'In-app' },
      { id: 'UP-03-N2', event: 'PO diterbitkan', recipient: 'Vendor', channel: 'Email' },
      { id: 'UP-03-N3', event: 'Invoice jatuh tempo', recipient: 'Finance', channel: 'In-app' }
    ],
    audit: ['Riwayat approval pengadaan', 'Log penerimaan barang']
  },

  // ===========================================================================
  // UP-04 — Hire-to-Retire
  // ===========================================================================
  {
    id: 'UP-04',
    nama: 'Hire-to-Retire',
    tujuan: 'Mengelola siklus hidup karyawan dari rekrutmen sampai purna kerja.',
    entities: [
      { name: 'Candidate', fields: ['id', 'nama', 'posisi', 'status'] },
      { name: 'Employee', fields: ['id', 'nama', 'jabatan', 'departemen', 'status'] },
      { name: 'Position', fields: ['id', 'nama', 'level', 'departemen'] },
      { name: 'Attendance', fields: ['id', 'employee_id', 'tanggal', 'jam_masuk', 'jam_keluar'] },
      { name: 'Leave', fields: ['id', 'employee_id', 'jenis', 'tanggal_mulai', 'tanggal_selesai', 'status'] },
      { name: 'Payroll', fields: ['id', 'employee_id', 'periode', 'gaji_pokok', 'tunjangan', 'potongan'] },
      { name: 'Performance Review', fields: ['id', 'employee_id', 'periode', 'skor', 'catatan'] }
    ],
    stages: [
      { id: 'recruitment', label: 'Rekrutmen' },
      { id: 'onboarding', label: 'Onboarding' },
      { id: 'active', label: 'Aktif (Absensi/Cuti)' },
      { id: 'review', label: 'Review Performa' },
      { id: 'payroll', label: 'Payroll' },
      { id: 'offboarding', label: 'Offboarding', terminal: true }
    ],
    actors: [
      { role: 'HR', category: 'operational', goals: ['Rekrutmen', 'Data karyawan', 'Payroll'], countsForTier: true },
      { role: 'Manager Lini', category: 'business', goals: ['Approve cuti', 'Review performa'] },
      { role: 'Employee', category: 'external', goals: ['Absensi', 'Ajukan cuti', 'Lihat slip gaji'] },
      { role: 'Finance/Payroll', category: 'operational', goals: ['Proses penggajian'] }
    ],
    flowVariants: [
      {
        id: 'UP-04-FV1',
        label: 'Lengkap: rekrutmen → pensiun',
        summary: 'Lamaran → interview → onboarding → absensi/cuti → review → payroll → offboarding.',
        stagePath: ['Rekrutmen', 'Onboarding', 'Aktif (Absensi/Cuti)', 'Review Performa', 'Payroll', 'Offboarding']
      },
      {
        id: 'UP-04-FV2',
        label: 'Absensi & cuti saja',
        summary: 'Fokus pada kehadiran harian dan pengajuan cuti, tanpa rekrutmen/payroll.',
        stagePath: ['Aktif (Absensi/Cuti)', 'Review Performa']
      },
      {
        id: 'UP-04-FV3',
        label: 'Payroll saja',
        summary: 'Hanya penggajian berkala dan slip gaji.',
        stagePath: ['Payroll']
      }
    ],
    features: [
      { id: 'UP-04-F01', label: 'Data karyawan & posisi', severity: 'core', complexity: 'LOW' },
      { id: 'UP-04-F02', label: 'Absensi check-in/out', severity: 'core', complexity: 'MEDIUM' },
      { id: 'UP-04-F03', label: 'Pengajuan cuti + approval', severity: 'core', complexity: 'MEDIUM', countsForTier: true },
      { id: 'UP-04-F04', label: 'Slip gaji / payroll', severity: 'advisory', complexity: 'HIGH', countsForTier: true },
      { id: 'UP-04-F05', label: 'Form lamaran & rekrutmen', severity: 'advisory', complexity: 'MEDIUM' },
      { id: 'UP-04-F06', label: 'Review performa berkala', severity: 'advisory', complexity: 'MEDIUM' }
    ],
    painPoints: [
      { id: 'UP-04-P1', label: 'Absensi manual (kertas/chat)', severity: 'core' },
      { id: 'UP-04-P2', label: 'Pengajuan cuti via chat, tidak tercatat', severity: 'core' },
      { id: 'UP-04-P3', label: 'Slip gaji dibuat manual', severity: 'advisory' },
      { id: 'UP-04-P4', label: 'Data karyawan tersebar', severity: 'core' }
    ],
    tierSignals: [
      { id: 'UP-04-T1', label: 'Payroll otomatis' },
      { id: 'UP-04-T2', label: 'Approval cuti berjenjang' },
      { id: 'UP-04-T3', label: 'Absensi GPS/foto' },
      { id: 'UP-04-T4', label: 'Multi-cabang/multi-shift' }
    ],
    businessRules: [
      { id: 'UP-04-BR1', type: 'policy', label: 'Kuota cuti per karyawan per tahun', severity: 'core' },
      { id: 'UP-04-BR2', type: 'approval', label: 'Cuti melebihi batas hari butuh approval manager', severity: 'core' },
      { id: 'UP-04-BR3', type: 'money', label: 'Payroll = gaji pokok + tunjangan - potongan', severity: 'advisory' }
    ],
    edgeCases: [
      { id: 'UP-04-EC1', scenario: 'Karyawan absen tanpa keterangan', handling: 'Tandai alpha & potong sesuai kebijakan', severity: 'core' },
      { id: 'UP-04-EC2', scenario: 'Cuti bersamaan membuat tim minim', handling: 'Peringatan saat approval', severity: 'advisory' },
      { id: 'UP-04-EC3', scenario: 'Resign mendadak', handling: 'Proses offboarding & serah terima', severity: 'advisory' }
    ],
    notifications: [
      { id: 'UP-04-N1', event: 'Pengajuan cuti', recipient: 'Manager Lini', channel: 'In-app' },
      { id: 'UP-04-N2', event: 'Slip gaji terbit', recipient: 'Employee', channel: 'Email/In-app' },
      { id: 'UP-04-N3', event: 'Kontrak habis', recipient: 'HR', channel: 'In-app' }
    ],
    audit: ['Riwayat absensi', 'Log perubahan data karyawan']
  },

  // ===========================================================================
  // UP-05 — Request-to-Fulfillment
  // ===========================================================================
  {
    id: 'UP-05',
    nama: 'Request-to-Fulfillment',
    tujuan: 'Memproses permintaan internal/layanan (tiket, maintenance) sampai selesai.',
    entities: [
      { name: 'Requester', fields: ['id', 'nama', 'kontak', 'unit'] },
      { name: 'Ticket/Request', fields: ['id', 'requester_id', 'judul', 'deskripsi', 'status', 'prioritas'] },
      { name: 'Category', fields: ['id', 'nama', 'sla_jam'] },
      { name: 'Assignee', fields: ['id', 'nama', 'divisi'] },
      { name: 'SLA', fields: ['id', 'ticket_id', 'target_selesai', 'terpenuhi'] },
      { name: 'Resolution', fields: ['id', 'ticket_id', 'tindakan', 'selesai_pada'] }
    ],
    stages: [
      { id: 'submitted', label: 'Diajukan' },
      { id: 'triaged', label: 'Triage/Kategorisasi' },
      { id: 'assigned', label: 'Assign Petugas' },
      { id: 'in-progress', label: 'Dikerjakan' },
      { id: 'resolved', label: 'Selesai' },
      { id: 'closed', label: 'Ditutup', terminal: true },
      { id: 'reopened', label: 'Dibuka Kembali' }
    ],
    actors: [
      { role: 'Requester', category: 'external', goals: ['Ajukan permintaan', 'Pantau status', 'Beri rating'], countsForTier: true },
      { role: 'Dispatcher/Triage', category: 'operational', goals: ['Kategorisasi', 'Assign petugas'], countsForTier: true },
      { role: 'Petugas Pelaksana', category: 'operational', goals: ['Kerjakan', 'Update status', 'Selesaikan'] }
    ],
    flowVariants: [
      {
        id: 'UP-05-FV1',
        label: 'Tiket penuh: ajukan → triage → assign → selesai',
        summary: 'Permintaan masuk, dikategorikan, ditugaskan, dikerjakan, lalu ditutup dengan rating.',
        stagePath: ['Diajukan', 'Triage/Kategorisasi', 'Assign Petugas', 'Dikerjakan', 'Selesai', 'Ditutup']
      },
      {
        id: 'UP-05-FV2',
        label: 'Langsung ke petugas',
        summary: 'Permintaan langsung ditujukan ke petugas tertentu tanpa triage.',
        stagePath: ['Diajukan', 'Assign Petugas', 'Dikerjakan', 'Selesai']
      },
      {
        id: 'UP-05-FV3',
        label: 'Papan antrian sederhana',
        summary: 'Daftar permintaan tanpa tiket formal, cukup status antri/dikerjakan/selesai.',
        stagePath: ['Diajukan', 'Dikerjakan', 'Selesai']
      }
    ],
    features: [
      { id: 'UP-05-F01', label: 'Form permintaan/tiket', severity: 'core', complexity: 'LOW' },
      { id: 'UP-05-F02', label: 'Status tracker', severity: 'core', complexity: 'MEDIUM' },
      { id: 'UP-05-F03', label: 'Assign petugas', severity: 'core', complexity: 'LOW' },
      { id: 'UP-05-F04', label: 'SLA timer & notifikasi', severity: 'advisory', complexity: 'HIGH', countsForTier: true },
      { id: 'UP-05-F05', label: 'Rating kepuasan', severity: 'advisory', complexity: 'LOW' },
      { id: 'UP-05-F06', label: 'Eskalasi otomatis', severity: 'advisory', complexity: 'HIGH', countsForTier: true }
    ],
    painPoints: [
      { id: 'UP-05-P1', label: 'Permintaan via chat pribadi, tidak terlacak', severity: 'core' },
      { id: 'UP-05-P2', label: 'Tidak ada status jelas untuk pemohon', severity: 'core' },
      { id: 'UP-05-P3', label: 'SLA tidak terukur', severity: 'advisory' },
      { id: 'UP-05-P4', label: 'Beban petugas tidak terpantau', severity: 'advisory' }
    ],
    tierSignals: [
      { id: 'UP-05-T1', label: 'SLA & eskalasi otomatis' },
      { id: 'UP-05-T2', label: 'Approval untuk permintaan tertentu' },
      { id: 'UP-05-T3', label: 'Multi-divisi/multi-lokasi' }
    ],
    businessRules: [
      { id: 'UP-05-BR1', type: 'policy', label: 'Tiket wajib punya kategori & prioritas', severity: 'core' },
      { id: 'UP-05-BR2', type: 'policy', label: 'Tiket hanya bisa ditutup setelah ada resolusi', severity: 'core' },
      { id: 'UP-05-BR3', type: 'sla', label: 'Target penyelesaian per kategori tiket', severity: 'advisory' }
    ],
    edgeCases: [
      { id: 'UP-05-EC1', scenario: 'Tiket tidak direspons', handling: 'Eskalasi ke atasan', severity: 'advisory' },
      { id: 'UP-05-EC2', scenario: 'Permintaan duplikat', handling: 'Gabungkan ke tiket yang ada', severity: 'advisory' },
      { id: 'UP-05-EC3', scenario: 'Pemohon tidak puas', handling: 'Buka kembali tiket', severity: 'core' }
    ],
    notifications: [
      { id: 'UP-05-N1', event: 'Tiket baru', recipient: 'Dispatcher', channel: 'In-app' },
      { id: 'UP-05-N2', event: 'Tiket di-assign', recipient: 'Petugas', channel: 'In-app' },
      { id: 'UP-05-N3', event: 'SLA hampir habis', recipient: 'Petugas & Atasan', channel: 'In-app' }
    ],
    audit: ['Riwayat status tiket', 'Log resolusi']
  },

  // ===========================================================================
  // UP-06 — Booking-to-Checkout
  // ===========================================================================
  {
    id: 'UP-06',
    nama: 'Booking-to-Checkout',
    tujuan: 'Mengelola reservasi slot/resource sampai layanan selesai/checkout.',
    entities: [
      { name: 'Resource', fields: ['id', 'nama', 'tipe', 'status'] },
      { name: 'Customer', fields: ['id', 'nama', 'kontak'] },
      { name: 'Booking', fields: ['id', 'resource_id', 'customer_id', 'mulai', 'selesai', 'status'] },
      { name: 'Schedule', fields: ['id', 'resource_id', 'slot', 'tersedia'] },
      { name: 'Payment/Deposit', fields: ['id', 'booking_id', 'jumlah', 'jenis', 'status'] }
    ],
    stages: [
      { id: 'availability', label: 'Cek Ketersediaan' },
      { id: 'booked', label: 'Booked' },
      { id: 'confirmed', label: 'Dikonfirmasi / DP' },
      { id: 'reminded', label: 'Reminder' },
      { id: 'checked-in', label: 'Check-in' },
      { id: 'in-service', label: 'Layanan Berlangsung' },
      { id: 'checked-out', label: 'Check-out / Settlement', terminal: true },
      { id: 'cancelled', label: 'Batal', terminal: true },
      { id: 'no-show', label: 'No-show', terminal: true }
    ],
    actors: [
      { role: 'Customer', category: 'external', goals: ['Cek jadwal', 'Booking', 'Check-in'], countsForTier: true },
      { role: 'Front Office/Admin', category: 'operational', goals: ['Konfirmasi', 'Kelola jadwal'], countsForTier: true },
      { role: 'Petugas Layanan', category: 'operational', goals: ['Melayani', 'Check-out'] }
    ],
    flowVariants: [
      {
        id: 'UP-06-FV1',
        label: 'Booking online + DP',
        summary: 'Cek slot → booking → DP → reminder → check-in → layanan → checkout.',
        stagePath: ['Cek Ketersediaan', 'Booked', 'Dikonfirmasi / DP', 'Reminder', 'Check-in', 'Layanan Berlangsung', 'Check-out / Settlement']
      },
      {
        id: 'UP-06-FV2',
        label: 'Datang langsung / walk-in',
        summary: 'Pelanggan datang, pilih slot tersedia, bayar, lalu dilayani.',
        stagePath: ['Cek Ketersediaan', 'Booked', 'Check-in', 'Layanan Berlangsung', 'Check-out / Settlement']
      },
      {
        id: 'UP-06-FV3',
        label: 'Booking via WhatsApp (dicatat admin)',
        summary: 'Admin mencatat booking dari chat, reminder manual.',
        stagePath: ['Booked', 'Dikonfirmasi / DP', 'Check-in', 'Check-out / Settlement']
      }
    ],
    features: [
      { id: 'UP-06-F01', label: 'Kalender ketersediaan', severity: 'core', complexity: 'HIGH', countsForTier: true },
      { id: 'UP-06-F02', label: 'Form booking', severity: 'core', complexity: 'MEDIUM' },
      { id: 'UP-06-F03', label: 'Check-in / check-out', severity: 'core', complexity: 'MEDIUM' },
      { id: 'UP-06-F04', label: 'Reminder otomatis', severity: 'advisory', complexity: 'MEDIUM' },
      { id: 'UP-06-F05', label: 'Deposit / DP', severity: 'core', complexity: 'MEDIUM' },
      { id: 'UP-06-F06', label: 'Kalkulasi biaya layanan', severity: 'advisory', complexity: 'MEDIUM' }
    ],
    painPoints: [
      { id: 'UP-06-P1', label: 'Jadwal bentrok / double booking', severity: 'core' },
      { id: 'UP-06-P2', label: 'Pelanggan no-show tanpa kabar', severity: 'core' },
      { id: 'UP-06-P3', label: 'Reminder masih manual', severity: 'advisory' },
      { id: 'UP-06-P4', label: 'DP tidak tercatat rapi', severity: 'advisory' }
    ],
    tierSignals: [
      { id: 'UP-06-T1', label: 'Multi-resource / multi-petugas' },
      { id: 'UP-06-T2', label: 'Dynamic pricing per jam/musim' },
      { id: 'UP-06-T3', label: 'Kebijakan no-show & refund' }
    ],
    businessRules: [
      { id: 'UP-06-BR1', type: 'policy', label: 'Slot yang sudah terisi tidak bisa dibooking ganda', severity: 'core' },
      { id: 'UP-06-BR2', type: 'money', label: 'DP/uang muka mengurangi total biaya layanan', severity: 'core' },
      { id: 'UP-06-BR3', type: 'policy', label: 'Pembatalan H-X mengikuti kebijakan refund/DP hangus', severity: 'advisory' },
      { id: 'UP-06-BR4', type: 'money', label: 'No-show dikenakan biaya / deposit hangus', severity: 'advisory' }
    ],
    edgeCases: [
      { id: 'UP-06-EC1', scenario: 'Double booking', handling: 'Validasi slot real-time, tolak bentrok', severity: 'core' },
      { id: 'UP-06-EC2', scenario: 'Pelanggan no-show', handling: 'Tandai no-show & terapkan kebijakan DP', severity: 'core' },
      { id: 'UP-06-EC3', scenario: 'Perpanjangan sesi/layanan', handling: 'Cek ketersediaan slot berikutnya', severity: 'advisory' }
    ],
    notifications: [
      { id: 'UP-06-N1', event: 'Booking baru', recipient: 'Admin/Front Office', channel: 'In-app' },
      { id: 'UP-06-N2', event: 'Reminder H-1', recipient: 'Customer', channel: 'WhatsApp' },
      { id: 'UP-06-N3', event: 'Keterlambatan/no-show', recipient: 'Admin', channel: 'In-app' }
    ],
    audit: ['Riwayat booking', 'Log check-in/check-out']
  },

  // ===========================================================================
  // UP-07 — Plan-to-Produce
  // ===========================================================================
  {
    id: 'UP-07',
    nama: 'Plan-to-Produce',
    tujuan: 'Mengelola proyek atau produksi dari perencanaan sampai hasil jadi.',
    entities: [
      { name: 'Project/Work Order', fields: ['id', 'nama', 'klien', 'mulai', 'selesai', 'status'] },
      { name: 'Task', fields: ['id', 'project_id', 'judul', 'assignee', 'status', 'deadline'] },
      { name: 'Resource/Material', fields: ['id', 'nama', 'qty', 'satuan'] },
      { name: 'Milestone', fields: ['id', 'project_id', 'nama', 'target', 'status'] },
      { name: 'Timesheet', fields: ['id', 'task_id', 'petugas', 'jam', 'tanggal'] },
      { name: 'Deliverable', fields: ['id', 'project_id', 'nama', 'status'] }
    ],
    stages: [
      { id: 'planning', label: 'Perencanaan/Spek' },
      { id: 'allocated', label: 'Alokasi Resource/Material' },
      { id: 'in-progress', label: 'Eksekusi' },
      { id: 'monitoring', label: 'Monitoring Progres' },
      { id: 'qa-qc', label: 'QA/QC' },
      { id: 'delivered', label: 'Serah Terima', terminal: true },
      { id: 'on-hold', label: 'Ditahan' },
      { id: 'cancelled', label: 'Dibatalkan', terminal: true }
    ],
    actors: [
      { role: 'Project Manager', category: 'business', goals: ['Perencanaan', 'Monitoring', 'Serah terima'], countsForTier: true },
      { role: 'Tim Eksekusi', category: 'operational', goals: ['Kerjakan task', 'Isi timesheet'], countsForTier: true },
      { role: 'Klien/Stakeholder', category: 'external', goals: ['Pantau progres', 'Approve milestone'] }
    ],
    flowVariants: [
      {
        id: 'UP-07-FV1',
        label: 'Proyek: rencana → tugas → QC → serah terima',
        summary: 'Proyek dipecah jadi task & milestone, dieksekusi, di-QC, lalu diserahkan.',
        stagePath: ['Perencanaan/Spek', 'Alokasi Resource/Material', 'Eksekusi', 'Monitoring Progres', 'QA/QC', 'Serah Terima']
      },
      {
        id: 'UP-07-FV2',
        label: 'Produksi berulang (work order)',
        summary: 'Work order per batch produksi dengan BOM dan QC tiap batch.',
        stagePath: ['Perencanaan/Spek', 'Alokasi Resource/Material', 'Eksekusi', 'QA/QC', 'Serah Terima']
      },
      {
        id: 'UP-07-FV3',
        label: 'Proyek sederhana tanpa milestone',
        summary: 'Cukup daftar tugas dan status selesai.',
        stagePath: ['Perencanaan/Spek', 'Eksekusi', 'Serah Terima']
      }
    ],
    features: [
      { id: 'UP-07-F01', label: 'Daftar project & task', severity: 'core', complexity: 'LOW' },
      { id: 'UP-07-F02', label: 'Kanban/Gantt progres', severity: 'core', complexity: 'HIGH', countsForTier: true },
      { id: 'UP-07-F03', label: 'Tracking material/BOM', severity: 'advisory', complexity: 'HIGH', countsForTier: true },
      { id: 'UP-07-F04', label: 'Timesheet', severity: 'advisory', complexity: 'MEDIUM' },
      { id: 'UP-07-F05', label: 'Approval milestone', severity: 'advisory', complexity: 'MEDIUM', countsForTier: true },
      { id: 'UP-07-F06', label: 'Laporan progres', severity: 'core', complexity: 'MEDIUM' }
    ],
    painPoints: [
      { id: 'UP-07-P1', label: 'Progres tidak terpantau', severity: 'core' },
      { id: 'UP-07-P2', label: 'Material datang terlambat', severity: 'core' },
      { id: 'UP-07-P3', label: 'Laporan progres manual', severity: 'advisory' },
      { id: 'UP-07-P4', label: 'Deadline sering lewat', severity: 'advisory' }
    ],
    tierSignals: [
      { id: 'UP-07-T1', label: 'BOM & traceability material' },
      { id: 'UP-07-T2', label: 'Multi-tim/multi-proyek paralel' },
      { id: 'UP-07-T3', label: 'Approval milestone berjenjang' },
      { id: 'UP-07-T4', label: 'Timesheet billable' }
    ],
    businessRules: [
      { id: 'UP-07-BR1', type: 'approval', label: 'Milestone butuh approval sebelum lanjut', severity: 'advisory' },
      { id: 'UP-07-BR2', type: 'policy', label: 'Task tidak bisa selesai jika material belum tersedia', severity: 'advisory' },
      { id: 'UP-07-BR3', type: 'money', label: 'Biaya material & tenaga masuk ke biaya proyek', severity: 'advisory' }
    ],
    edgeCases: [
      { id: 'UP-07-EC1', scenario: 'Material kurang', handling: 'Blokir task terkait & ajukan pengadaan', severity: 'core' },
      { id: 'UP-07-EC2', scenario: 'Deadline lewat', handling: 'Tandai overdue & eskalasi', severity: 'advisory' },
      { id: 'UP-07-EC3', scenario: 'Perubahan scope', handling: 'Catat change request & revisi estimasi', severity: 'advisory' }
    ],
    notifications: [
      { id: 'UP-07-N1', event: 'Task di-assign', recipient: 'Tim Eksekusi', channel: 'In-app' },
      { id: 'UP-07-N2', event: 'Milestone tercapai', recipient: 'Klien/Stakeholder', channel: 'Email' },
      { id: 'UP-07-N3', event: 'Task overdue', recipient: 'Project Manager', channel: 'In-app' }
    ],
    audit: ['Riwayat progres task', 'Log timesheet']
  },

  // ===========================================================================
  // UP-08 — Issue-to-Resolution
  // ===========================================================================
  {
    id: 'UP-08',
    nama: 'Issue-to-Resolution',
    tujuan: 'Menangani komplain, klaim, atau insiden sampai tuntas.',
    entities: [
      { name: 'Complainant', fields: ['id', 'nama', 'kontak'] },
      { name: 'Case/Claim', fields: ['id', 'complainant_id', 'jenis', 'deskripsi', 'status'] },
      { name: 'Evidence/Attachment', fields: ['id', 'case_id', 'file', 'keterangan'] },
      { name: 'Investigation Note', fields: ['id', 'case_id', 'catatan', 'oleh', 'waktu'] },
      { name: 'Resolution', fields: ['id', 'case_id', 'keputusan', 'tanggal'] },
      { name: 'Compensation', fields: ['id', 'case_id', 'jenis', 'jumlah', 'status'] }
    ],
    stages: [
      { id: 'reported', label: 'Laporan Diterima' },
      { id: 'verified', label: 'Verifikasi' },
      { id: 'investigating', label: 'Investigasi' },
      { id: 'decided', label: 'Keputusan' },
      { id: 'compensated', label: 'Kompensasi/Tindakan' },
      { id: 'closed', label: 'Ditutup', terminal: true },
      { id: 'rejected', label: 'Ditolak', terminal: true }
    ],
    actors: [
      { role: 'Petugas Penerima', category: 'operational', goals: ['Terima laporan', 'Verifikasi awal'], countsForTier: true },
      { role: 'Investigator', category: 'operational', goals: ['Investigasi', 'Rekomendasi'], countsForTier: true },
      { role: 'Approver Kompensasi', category: 'business', goals: ['Setujui kompensasi'] }
    ],
    flowVariants: [
      {
        id: 'UP-08-FV1',
        label: 'Klaim penuh: lapor → investigasi → kompensasi',
        summary: 'Laporan diverifikasi, diinvestigasi, diputuskan, lalu kompensasi diberikan.',
        stagePath: ['Laporan Diterima', 'Verifikasi', 'Investigasi', 'Keputusan', 'Kompensasi/Tindakan', 'Ditutup']
      },
      {
        id: 'UP-08-FV2',
        label: 'Klaim cepat dengan bukti',
        summary: 'Bukti lengkap → keputusan langsung tanpa investigasi panjang.',
        stagePath: ['Laporan Diterima', 'Verifikasi', 'Keputusan', 'Kompensasi/Tindakan']
      },
      {
        id: 'UP-08-FV3',
        label: 'Catatan komplain sederhana',
        summary: 'Komplain dicatat dan ditindaklanjuti tanpa alur klaim formal.',
        stagePath: ['Laporan Diterima', 'Investigasi', 'Ditutup']
      }
    ],
    features: [
      { id: 'UP-08-F01', label: 'Form pengaduan + upload bukti', severity: 'core', complexity: 'MEDIUM' },
      { id: 'UP-08-F02', label: 'Tracking status kasus', severity: 'core', complexity: 'MEDIUM' },
      { id: 'UP-08-F03', label: 'Catatan investigasi', severity: 'core', complexity: 'LOW' },
      { id: 'UP-08-F04', label: 'Approval kompensasi', severity: 'advisory', complexity: 'HIGH', countsForTier: true },
      { id: 'UP-08-F05', label: 'Riwayat & laporan kasus', severity: 'advisory', complexity: 'MEDIUM' },
      { id: 'UP-08-F06', label: 'SLA penyelesaian', severity: 'advisory', complexity: 'MEDIUM' }
    ],
    painPoints: [
      { id: 'UP-08-P1', label: 'Komplain tidak tercatat', severity: 'core' },
      { id: 'UP-08-P2', label: 'Bukti/berkas hilang', severity: 'core' },
      { id: 'UP-08-P3', label: 'Keputusan tidak konsisten', severity: 'advisory' },
      { id: 'UP-08-P4', label: 'Tidak ada SLA penyelesaian', severity: 'advisory' }
    ],
    tierSignals: [
      { id: 'UP-08-T1', label: 'Approval kompensasi berjenjang' },
      { id: 'UP-08-T2', label: 'Eskalasi kasus' },
      { id: 'UP-08-T3', label: 'SLA & laporan audit' }
    ],
    businessRules: [
      { id: 'UP-08-BR1', type: 'policy', label: 'Klaim wajib minimal 1 bukti lampiran', severity: 'core' },
      { id: 'UP-08-BR2', type: 'approval', label: 'Kompensasi di atas nominal tertentu butuh approver', severity: 'core' },
      { id: 'UP-08-BR3', type: 'sla', label: 'Klaim diproses maksimal X hari', severity: 'advisory' }
    ],
    edgeCases: [
      { id: 'UP-08-EC1', scenario: 'Bukti tidak lengkap', handling: 'Minta kelengkapan, status menunggu', severity: 'core' },
      { id: 'UP-08-EC2', scenario: 'Klaim tidak valid/palsu', handling: 'Tolak dengan alasan & catat', severity: 'core' },
      { id: 'UP-08-EC3', scenario: 'Sengketa keputusan', handling: 'Eskalasi ke approver lebih tinggi', severity: 'advisory' }
    ],
    notifications: [
      { id: 'UP-08-N1', event: 'Klaim baru', recipient: 'Petugas Penerima', channel: 'In-app' },
      { id: 'UP-08-N2', event: 'Keputusan klaim', recipient: 'Pemohon', channel: 'WhatsApp/Email' },
      { id: 'UP-08-N3', event: 'Kompensasi dibayar', recipient: 'Finance', channel: 'In-app' }
    ],
    audit: ['Riwayat investigasi', 'Log keputusan & kompensasi']
  },

  // ===========================================================================
  // UP-09 — Asset/Inventory Lifecycle
  // ===========================================================================
  {
    id: 'UP-09',
    nama: 'Asset/Inventory Lifecycle',
    tujuan: 'Mengelola aset atau stok dari masuk sampai keluar/disposal.',
    entities: [
      { name: 'Item/Asset', fields: ['id', 'kode', 'nama', 'kategori', 'status'] },
      { name: 'Location/Warehouse', fields: ['id', 'nama', 'tipe', 'alamat'] },
      { name: 'Stock Movement', fields: ['id', 'item_id', 'lokasi', 'jenis', 'qty', 'tanggal'] },
      { name: 'Maintenance Log', fields: ['id', 'item_id', 'jadwal', 'catatan', 'biaya'] },
      { name: 'Disposal Record', fields: ['id', 'item_id', 'alasan', 'tanggal'] }
    ],
    stages: [
      { id: 'received', label: 'Diterima' },
      { id: 'stored', label: 'Disimpan/Ditempatkan' },
      { id: 'in-use', label: 'Digunakan/Dipinjam' },
      { id: 'maintenance', label: 'Perawatan' },
      { id: 'stocktake', label: 'Stock Take/Opname' },
      { id: 'disposed', label: 'Disposal/Write-off', terminal: true },
      { id: 'lost', label: 'Hilang', terminal: true }
    ],
    actors: [
      { role: 'Warehouse/Asset Admin', category: 'operational', goals: ['Kelola stok', 'Catat mutasi', 'Opname'], countsForTier: true },
      { role: 'User Peminjam', category: 'external', goals: ['Pinjam', 'Kembalikan'] },
      { role: 'Auditor', category: 'business', goals: ['Audit stok', 'Verifikasi'] }
    ],
    flowVariants: [
      {
        id: 'UP-09-FV1',
        label: 'Stok gudang: masuk → keluar → opname',
        summary: 'Barang diterima, disimpan, keluar-masuk, lalu diopname berkala.',
        stagePath: ['Diterima', 'Disimpan/Ditempatkan', 'Digunakan/Dipinjam', 'Stock Take/Opname']
      },
      {
        id: 'UP-09-FV2',
        label: 'Peminjaman aset',
        summary: 'Aset dicatat keluar untuk dipinjam, dikembalikan, lalu dicek kondisinya.',
        stagePath: ['Disimpan/Ditempatkan', 'Digunakan/Dipinjam', 'Perawatan', 'Disimpan/Ditempatkan']
      },
      {
        id: 'UP-09-FV3',
        label: 'Tracking stok sederhana',
        summary: 'Cukup catat stok masuk/keluar dan sisa.',
        stagePath: ['Diterima', 'Disimpan/Ditempatkan', 'Digunakan/Dipinjam']
      }
    ],
    features: [
      { id: 'UP-09-F01', label: 'Data item/aset', severity: 'core', complexity: 'LOW' },
      { id: 'UP-09-F02', label: 'Kartu stok / mutasi', severity: 'core', complexity: 'MEDIUM' },
      { id: 'UP-09-F03', label: 'Pencatatan masuk/keluar', severity: 'core', complexity: 'LOW' },
      { id: 'UP-09-F04', label: 'Barcode/QR scan', severity: 'advisory', complexity: 'HIGH', countsForTier: true },
      { id: 'UP-09-F05', label: 'Jadwal maintenance', severity: 'advisory', complexity: 'MEDIUM' },
      { id: 'UP-09-F06', label: 'Laporan stok opname', severity: 'advisory', complexity: 'MEDIUM' }
    ],
    painPoints: [
      { id: 'UP-09-P1', label: 'Stok fisik tidak akurat', severity: 'core' },
      { id: 'UP-09-P2', label: 'Barang hilang / tidak terlacak', severity: 'core' },
      { id: 'UP-09-P3', label: 'Maintenance lupa dijadwalkan', severity: 'advisory' },
      { id: 'UP-09-P4', label: 'Opname manual dan lama', severity: 'advisory' }
    ],
    tierSignals: [
      { id: 'UP-09-T1', label: 'Multi-lokasi/multi-gudang' },
      { id: 'UP-09-T2', label: 'Barcode/QR tracking' },
      { id: 'UP-09-T3', label: 'Jadwal maintenance berkala' },
      { id: 'UP-09-T4', label: 'Depresiasi/nilai aset' }
    ],
    businessRules: [
      { id: 'UP-09-BR1', type: 'policy', label: 'Stok tidak boleh minus', severity: 'core' },
      { id: 'UP-09-BR2', type: 'policy', label: 'Peminjaman wajib mencatat kondisi keluar & masuk', severity: 'advisory' },
      { id: 'UP-09-BR3', type: 'money', label: 'Nilai aset disusutkan berkala (opsional)', severity: 'advisory' }
    ],
    edgeCases: [
      { id: 'UP-09-EC1', scenario: 'Barang rusak saat dipinjam', handling: 'Catat kerusakan & biaya perbaikan', severity: 'core' },
      { id: 'UP-09-EC2', scenario: 'Hasil opname tidak cocok', handling: 'Catat selisih & alasan', severity: 'core' },
      { id: 'UP-09-EC3', scenario: 'Barang hilang', handling: 'Tandai lost & proses write-off', severity: 'advisory' }
    ],
    notifications: [
      { id: 'UP-09-N1', event: 'Stok di bawah minimum', recipient: 'Admin', channel: 'In-app' },
      { id: 'UP-09-N2', event: 'Maintenance jatuh tempo', recipient: 'Teknisi', channel: 'In-app' },
      { id: 'UP-09-N3', event: 'Peminjaman jatuh tempo', recipient: 'Peminjam', channel: 'In-app' }
    ],
    audit: ['Riwayat mutasi stok', 'Log maintenance']
  },

  // ===========================================================================
  // UP-10 — Membership/Subscription Lifecycle
  // ===========================================================================
  {
    id: 'UP-10',
    nama: 'Membership/Subscription Lifecycle',
    tujuan: 'Mengelola pelanggan berulang (member/subscriber) dari daftar sampai renewal/churn.',
    entities: [
      { name: 'Member', fields: ['id', 'nama', 'kontak', 'status'] },
      { name: 'Plan/Tier', fields: ['id', 'nama', 'harga', 'benefit'] },
      { name: 'Subscription', fields: ['id', 'member_id', 'plan_id', 'mulai', 'berakhir', 'status'] },
      { name: 'Billing Cycle', fields: ['id', 'subscription_id', 'periode', 'jumlah', 'status'] },
      { name: 'Usage/Benefit', fields: ['id', 'member_id', 'benefit', 'terpakai', 'kuota'] }
    ],
    stages: [
      { id: 'registered', label: 'Terdaftar' },
      { id: 'plan-selected', label: 'Pilih Plan' },
      { id: 'active', label: 'Aktif' },
      { id: 'usage', label: 'Pemakaian/Benefit' },
      { id: 'billing', label: 'Billing Berkala' },
      { id: 'renewed', label: 'Renewal/Upgrade' },
      { id: 'expired', label: 'Expired', terminal: true },
      { id: 'cancelled', label: 'Churn/Cancel', terminal: true }
    ],
    actors: [
      { role: 'Member', category: 'external', goals: ['Daftar', 'Pakai benefit', 'Perpanjang'], countsForTier: true },
      { role: 'Admin', category: 'operational', goals: ['Kelola plan & member'], countsForTier: true },
      { role: 'Finance/Billing', category: 'operational', goals: ['Tagih', 'Rekonsiliasi'] }
    ],
    flowVariants: [
      {
        id: 'UP-10-FV1',
        label: 'Daftar → paket → perpanjangan',
        summary: 'Member daftar, pilih paket, aktif, pakai benefit, lalu perpanjang.',
        stagePath: ['Terdaftar', 'Pilih Plan', 'Aktif', 'Pemakaian/Benefit', 'Billing Berkala', 'Renewal/Upgrade']
      },
      {
        id: 'UP-10-FV2',
        label: 'Langganan otomatis berulang',
        summary: 'Tagihan berjalan otomatis tiap periode sampai dibatalkan.',
        stagePath: ['Terdaftar', 'Pilih Plan', 'Aktif', 'Billing Berkala', 'Renewal/Upgrade']
      },
      {
        id: 'UP-10-FV3',
        label: 'Paket berbasis sesi/kuota',
        summary: 'Member beli paket sesi, sisa sesi dipantau sampai habis.',
        stagePath: ['Terdaftar', 'Pilih Plan', 'Aktif', 'Pemakaian/Benefit', 'Expired']
      }
    ],
    features: [
      { id: 'UP-10-F01', label: 'Form pendaftaran member', severity: 'core', complexity: 'LOW' },
      { id: 'UP-10-F02', label: 'Data plan/tier & harga', severity: 'core', complexity: 'LOW' },
      { id: 'UP-10-F03', label: 'Status aktif/berakhir', severity: 'core', complexity: 'MEDIUM' },
      { id: 'UP-10-F04', label: 'Reminder renewal', severity: 'advisory', complexity: 'MEDIUM' },
      { id: 'UP-10-F05', label: 'Riwayat billing', severity: 'advisory', complexity: 'MEDIUM' },
      { id: 'UP-10-F06', label: 'Kalkulasi benefit/kuota terpakai', severity: 'advisory', complexity: 'HIGH', countsForTier: true }
    ],
    painPoints: [
      { id: 'UP-10-P1', label: 'Perpanjangan sering lupa', severity: 'core' },
      { id: 'UP-10-P2', label: 'Sisa sesi/kuota tidak terpantau', severity: 'core' },
      { id: 'UP-10-P3', label: 'Billing manual', severity: 'advisory' },
      { id: 'UP-10-P4', label: 'Churn tidak terdeteksi', severity: 'advisory' }
    ],
    tierSignals: [
      { id: 'UP-10-T1', label: 'Billing otomatis berulang' },
      { id: 'UP-10-T2', label: 'Multi-tier & upgrade/downgrade' },
      { id: 'UP-10-T3', label: 'Benefit kuota' }
    ],
    businessRules: [
      { id: 'UP-10-BR1', type: 'money', label: 'Harga & benefit mengikuti plan yang dipilih', severity: 'core' },
      { id: 'UP-10-BR2', type: 'policy', label: 'Status member otomatis expired setelah tanggal berakhir', severity: 'core' },
      { id: 'UP-10-BR3', type: 'money', label: 'Upgrade prorata / downgrade berlaku periode berikutnya', severity: 'advisory' }
    ],
    edgeCases: [
      { id: 'UP-10-EC1', scenario: 'Pembayaran gagal', handling: 'Tandai pending & batasi benefit', severity: 'core' },
      { id: 'UP-10-EC2', scenario: 'Perpanjangan telat', handling: 'Grace period atau nonaktifkan sementara', severity: 'advisory' },
      { id: 'UP-10-EC3', scenario: 'Sisa kuota saat upgrade', handling: 'Bawa kuota atau reset sesuai kebijakan', severity: 'advisory' }
    ],
    notifications: [
      { id: 'UP-10-N1', event: 'Reminder renewal', recipient: 'Member', channel: 'WhatsApp/Email' },
      { id: 'UP-10-N2', event: 'Pembayaran berhasil/gagal', recipient: 'Member & Finance', channel: 'In-app' },
      { id: 'UP-10-N3', event: 'Member expired', recipient: 'Admin', channel: 'In-app' }
    ],
    audit: ['Riwayat billing', 'Log perubahan plan']
  }
];
