import type { TemplateProcessMap } from './types';

/**
 * Peta 28 Master Template ke pola proses bisnis universal.
 * `overlayIds` diisi bertahap pada Batch 2–5 saat overlay industri dibuat.
 * `coreTransitions` adalah transisi inti yang wajib ada di brief & prototype.
 */
export const TEMPLATE_PROCESS_MAP: TemplateProcessMap[] = [
  {
    templateId: 'MT-01',
    patternIds: ['UP-02', 'UP-09', 'UP-01'],
    overlayIds: ['IND-01'],
    coreTransitions: ['buat pesanan', 'konfirmasi & kurangi stok', 'pembayaran', 'retur/refund'],
    advisoryNotes: ['Loyalty pelanggan opsional lewat UP-01']
  },
  {
    templateId: 'MT-02',
    patternIds: ['UP-02', 'UP-03', 'UP-09'],
    overlayIds: [],
    coreTransitions: ['pesanan grosir', 'cek stok & harga tier', 'pengiriman parsial', 'invoice & pembayaran', 'pengadaan ulang'],
    advisoryNotes: ['Harga bertingkat per pelanggan']
  },
  {
    templateId: 'MT-03',
    patternIds: ['UP-02', 'UP-09', 'UP-06'],
    overlayIds: ['IND-02'],
    coreTransitions: ['input pesanan', 'kirim ke dapur', 'pembayaran/split bill', 'pengurangan stok bahan', 'reservasi meja'],
    advisoryNotes: ['Resep/BOM dan waste tracking menyusul']
  },
  {
    templateId: 'MT-04',
    patternIds: ['UP-06', 'UP-10'],
    overlayIds: [],
    coreTransitions: ['booking slot', 'konfirmasi/DP', 'check-in', 'layanan selesai', 'renewal paket'],
    advisoryNotes: ['Alokasi terapis/petugas per slot']
  },
  {
    templateId: 'MT-05',
    patternIds: ['UP-05', 'UP-09', 'UP-06'],
    overlayIds: ['IND-13'],
    coreTransitions: ['terima unit & keluhan', 'estimasi biaya', 'pengerjaan', 'selesai & serah terima', 'pemakaian spare part'],
    advisoryNotes: ['Riwayat servis per unit']
  },
  {
    templateId: 'MT-06',
    patternIds: ['UP-06', 'UP-09'],
    overlayIds: ['IND-04'],
    coreTransitions: ['pendaftaran & booking', 'antrian', 'pemeriksaan', 'resep & stok obat', 'pembayaran'],
    advisoryNotes: ['Kerahasiaan data pasien']
  },
  {
    templateId: 'MT-07',
    patternIds: ['UP-07', 'UP-03', 'UP-09'],
    overlayIds: ['IND-06'],
    coreTransitions: ['rencana produksi', 'pengadaan material', 'work order', 'QC', 'stok barang jadi'],
    advisoryNotes: ['BOM & traceability batch']
  },
  {
    templateId: 'MT-08',
    patternIds: ['UP-07', 'UP-01', 'UP-02'],
    overlayIds: ['IND-03'],
    coreTransitions: ['lead & penawaran', 'kontrak', 'task & timesheet', 'invoice termin', 'serah terima'],
    advisoryNotes: ['Billing berbasis jam (billable)']
  },
  {
    templateId: 'MT-09',
    patternIds: ['UP-06', 'UP-02'],
    overlayIds: ['IND-09'],
    coreTransitions: ['cek kamar', 'booking', 'check-in', 'layanan tambahan', 'check-out & folio'],
    advisoryNotes: ['Dynamic pricing per musim']
  },
  {
    templateId: 'MT-10',
    patternIds: ['UP-06', 'UP-10'],
    overlayIds: ['IND-05'],
    coreTransitions: ['pendaftaran kelas', 'pembayaran SPP', 'kehadiran', 'penilaian', 'rapor/sertifikat'],
    advisoryNotes: ['Kelas berulang per batch']
  },
  {
    templateId: 'MT-11',
    patternIds: ['UP-01'],
    overlayIds: [],
    coreTransitions: ['capture lead', 'kualifikasi', 'follow-up', 'penawaran', 'closing'],
    advisoryNotes: ['Pipeline per tim sales']
  },
  {
    templateId: 'MT-12',
    patternIds: ['UP-02', 'UP-03', 'UP-10'],
    overlayIds: ['IND-12'],
    coreTransitions: ['invoice', 'pembayaran', 'piutang/utang', 'rekonsiliasi', 'laporan keuangan'],
    advisoryNotes: ['Jurnal & buku besar opsional']
  },
  {
    templateId: 'MT-13',
    patternIds: ['UP-01', 'UP-06', 'UP-10'],
    overlayIds: ['IND-08'],
    coreTransitions: ['lead & survey unit', 'booking unit', 'kontrak sewa', 'cicilan/sewa berkala', 'maintenance request'],
    advisoryNotes: ['Status unit available/booked/sold']
  },
  {
    templateId: 'MT-14',
    patternIds: ['UP-02', 'UP-09'],
    overlayIds: ['IND-07'],
    coreTransitions: ['terima order kirim', 'assign kurir', 'tracking resi', 'proof of delivery', 'COD reconciliation'],
    advisoryNotes: ['Optimasi rute opsional']
  },
  {
    templateId: 'MT-15',
    patternIds: ['UP-10'],
    overlayIds: [],
    coreTransitions: ['daftar member', 'pilih paket', 'pembayaran', 'pemakaian benefit', 'renewal'],
    advisoryNotes: ['Kuota sesi per paket']
  },
  {
    templateId: 'MT-16',
    patternIds: ['UP-04'],
    overlayIds: [],
    coreTransitions: ['data karyawan', 'absensi', 'cuti & approval', 'payroll', 'offboarding'],
    advisoryNotes: ['Absensi GPS/foto opsional']
  },
  {
    templateId: 'MT-17',
    patternIds: ['UP-03', 'UP-09'],
    overlayIds: [],
    coreTransitions: ['permintaan pembelian', 'approval', 'PO', 'penerimaan', 'pembayaran vendor'],
    advisoryNotes: ['3-way matching opsional']
  },
  {
    templateId: 'MT-18',
    patternIds: ['UP-09', 'UP-05'],
    overlayIds: [],
    coreTransitions: ['registrasi aset', 'penempatan', 'request maintenance', 'pengerjaan', 'disposal'],
    advisoryNotes: ['Jadwal maintenance berkala']
  },
  {
    templateId: 'MT-19',
    patternIds: ['UP-06', 'UP-01'],
    overlayIds: ['IND-14'],
    coreTransitions: ['jual tiket/booking', 'pembayaran', 'check-in QR', 'rundown', 'laporan'],
    advisoryNotes: ['Seat mapping opsional']
  },
  {
    templateId: 'MT-20',
    patternIds: [],
    overlayIds: [],
    coreTransitions: ['autentikasi', 'CRUD entitas utama', 'audit log'],
    advisoryNotes: ['Custom Application: proses inti minimal, sisanya bebas']
  },
  {
    templateId: 'MT-21',
    patternIds: ['UP-06', 'UP-09'],
    overlayIds: [],
    coreTransitions: ['pemesanan unit', 'pembayaran/DP', 'serah terima', 'pengembalian & cek kondisi', 'denda & deposit'],
    advisoryNotes: ['Perpanjangan sewa & unit servis']
  },
  {
    templateId: 'MT-22',
    patternIds: ['UP-07', 'UP-03', 'UP-09'],
    overlayIds: ['IND-10'],
    coreTransitions: ['RAB & rencana', 'pengadaan material', 'laporan harian', 'opname progres', 'termin pembayaran'],
    advisoryNotes: ['Subkontraktor & site report foto/lokasi']
  },
  {
    templateId: 'MT-23',
    patternIds: ['UP-07', 'UP-09', 'UP-02'],
    overlayIds: ['IND-11'],
    coreTransitions: ['rencana tanam', 'perawatan & pemupukan', 'panen & grading', 'stok gudang', 'penjualan hasil'],
    advisoryNotes: ['Harga komoditas fluktuatif']
  },
  {
    templateId: 'MT-24',
    patternIds: ['UP-05', 'UP-08'],
    overlayIds: ['IND-15'],
    coreTransitions: ['pengajuan layanan', 'verifikasi berkas', 'disposisi', 'penyelesaian', 'pengaduan'],
    advisoryNotes: ['SLA layanan publik & arsip dokumen']
  },
  {
    templateId: 'MT-25',
    patternIds: ['UP-07', 'UP-10'],
    overlayIds: [],
    coreTransitions: ['ide & kalender editorial', 'produksi konten', 'approval', 'publikasi', 'monetisasi/langganan'],
    advisoryNotes: ['Engagement & sponsor slot']
  },
  {
    templateId: 'MT-26',
    patternIds: ['UP-01', 'UP-08', 'UP-10'],
    overlayIds: [],
    coreTransitions: ['pengajuan polis', 'underwriting', 'premi berkala', 'klaim', 'keputusan & kompensasi'],
    advisoryNotes: ['Investigasi klaim & komisi agen']
  },
  {
    templateId: 'MT-27',
    patternIds: ['UP-02', 'UP-01', 'UP-09'],
    overlayIds: [],
    coreTransitions: ['seller daftar & upload produk', 'checkout & escrow', 'pengiriman', 'konfirmasi terima & lepas dana', 'dispute/refund'],
    advisoryNotes: ['Komisi marketplace & rating seller']
  },
  {
    templateId: 'MT-28',
    patternIds: ['UP-01', 'UP-05'],
    overlayIds: [],
    coreTransitions: ['donasi masuk', 'rekap dana', 'program & penerima manfaat', 'penyaluran', 'laporan transparansi'],
    advisoryNotes: ['Laporan dampak & relawan']
  }
];
