/**
 * MASTER UI & PAGE TEMPLATE SPECIFICATION (PT-01 s/d PT-15)
 * Version: 1.0
 * Dependency: Master Template Specification v2.0
 */

import {
  PageTemplate,
  ComponentCategory,
  PageToComponentMapping,
  UIGenerationRule,
  RoleToPageMappingExample
} from './types';

// =============================================================================
// 1. STANDARD PAGE TEMPLATES (PT-01 s/d PT-15)
// =============================================================================
export const PAGE_TEMPLATES: PageTemplate[] = [
  {
    id: 'PT-01',
    nama: 'Dashboard',
    deskripsi: 'Halaman ringkasan informasi utama, indikator performa (KPI), dan aksi cepat operasional.',
    struktur: [
      'Header',
      'Summary Cards (KPI)',
      'Primary Information (Charts / Recent Activities)',
      'Secondary Information',
      'Quick Actions'
    ],
    defaultComponents: ['Greeting', 'KPI Card', 'Summary Card', 'Chart', 'Recent Activity', 'Quick Action', 'Notification'],
    sectionsDetail: [
      { name: 'Header Section', components: ['Greeting', 'Date / Period Filter', 'Notifications'] },
      { name: 'Summary Cards Section', components: ['KPI Card', 'Revenue Metric', 'Status Count'] },
      { name: 'Main Visual Section', components: ['Chart', 'Activity Feed', 'Urgent Alerts'] },
      { name: 'Quick Action Section', components: ['Action Buttons', 'Shortcut Links'] }
    ]
  },
  {
    id: 'PT-02',
    nama: 'List',
    deskripsi: 'Halaman untuk menampilkan daftar data dalam bentuk tabel interaktif atau grid kartu dengan filter dan pencarian.',
    struktur: [
      'Header (Title, Search, Filter, Primary Action Button)',
      'Content (Data Table / Card List)',
      'Footer (Pagination, Total Count)'
    ],
    defaultComponents: ['Search', 'Filter', 'Sort', 'Data Table', 'Card List', 'Pagination', 'Bulk Action', 'Export'],
    sectionsDetail: [
      { name: 'Filter & Search Bar', components: ['Search Input', 'Dropdown Filter', 'Add New Button'] },
      { name: 'Data Grid / Table', components: ['Data Table', 'Action Dropdown', 'Row Checkbox'] },
      { name: 'Pagination Controls', components: ['Page Numbers', 'Rows per Page'] }
    ]
  },
  {
    id: 'PT-03',
    nama: 'Detail',
    deskripsi: 'Halaman untuk melihat rincian informasi lengkap dari satu entitas/record spesifik beserta riwayat terkait.',
    struktur: [
      'Header (Title, Status Badge, Action Buttons)',
      'Main (Summary Info, Details, Related Records, History Timeline)'
    ],
    defaultComponents: ['Profile Card', 'Information List', 'Status Badge', 'Timeline', 'Related Records', 'Action Button'],
    sectionsDetail: [
      { name: 'Record Header', components: ['Entity Title', 'Status Badge', 'Edit/Delete Action'] },
      { name: 'Main Information', components: ['Field Grid', 'Description Box', 'Key Metadata'] },
      { name: 'Related Data Tabs', components: ['Linked Table', 'Activity Timeline'] }
    ]
  },
  {
    id: 'PT-04',
    nama: 'Create / Edit Form',
    deskripsi: 'Halaman atau modal formulir untuk memasukkan data baru atau mengubah data yang sudah ada dengan validasi.',
    struktur: [
      'Header (Form Title, Close / Back Button)',
      'Form Sections (Field Groups, Inputs, Selectors)',
      'Related Information / Summary',
      'Action Bar (Cancel Button, Submit / Save Button)'
    ],
    defaultComponents: ['Text Field', 'Number Field', 'Date Field', 'Select', 'Multi Select', 'Checkbox', 'Radio', 'File Upload', 'Rich Text', 'Repeater', 'Formula Field'],
    sectionsDetail: [
      { name: 'General Information Group', components: ['Text Inputs', 'Category Select', 'Required Indicators'] },
      { name: 'Secondary Details Group', components: ['Date Pickers', 'Optional Notes', 'File Attachments'] },
      { name: 'Form Footer Bar', components: ['Cancel Button', 'Submit Button', 'Validation Messages'] }
    ]
  },
  {
    id: 'PT-05',
    nama: 'Profile',
    deskripsi: 'Halaman profil untuk pengguna, pelanggan, pasien, anggota, atau karyawan dengan tab riwayat.',
    struktur: [
      'Profile Header (Avatar, Name, Role/Badge, Quick Actions)',
      'Tabs (Information, Activity, Transactions, Documents, History)'
    ],
    defaultComponents: ['Avatar', 'User Details', 'Role Badge', 'Information Tab', 'Activity Log', 'Transaction History'],
    sectionsDetail: [
      { name: 'Profile Summary Header', components: ['User Avatar', 'Full Name', 'Contact Info', 'Status Badge'] },
      { name: 'Tab Navigation', components: ['Bio & Account Info', 'Activity Logs', 'Linked Transactions'] }
    ]
  },
  {
    id: 'PT-06',
    nama: 'Calendar',
    deskripsi: 'Halaman jadwal berbasis kalender untuk janji temu, reservasi, event, atau shift kerja.',
    struktur: [
      'Header (Date Navigation, View Switcher Day/Week/Month, Create Action)',
      'Calendar Grid (Day, Week, Month View)',
      'Detail Section (Selected Event / Appointment Summary)'
    ],
    defaultComponents: ['Calendar', 'Event Card', 'Time Slot', 'Staff Filter', 'Resource Filter'],
    sectionsDetail: [
      { name: 'Calendar Control Header', components: ['Month/Week Toggle', 'Prev/Next Date Buttons', 'New Booking Button'] },
      { name: 'Time Grid Area', components: ['Time Slots', 'Booked Blocks', 'Availability Indicators'] },
      { name: 'Event Preview Drawer', components: ['Participant List', 'Time & Location', 'Status Badge'] }
    ]
  },
  {
    id: 'PT-07',
    nama: 'Queue',
    deskripsi: 'Halaman sistem antrean visual untuk loket, poli kesehatan, kasir, atau meja pelayanan.',
    struktur: [
      'Header (Service Title, Date)',
      'Current Service Indicator',
      'Queue Status (Total Waiting, Total Served)',
      'Primary Queue Card (Current Active Number)',
      'Waiting Information / List',
      'Actions (Call Next, Skip, Complete)'
    ],
    defaultComponents: ['Queue Number', 'Current Number', 'Position', 'Estimated Wait', 'Queue Status', 'Service / Doctor Card', 'Refresh', 'Cancel', 'Call Status'],
    sectionsDetail: [
      { name: 'Big Screen Display', components: ['Active Calling Number', 'Counter Name', 'Audio Alert Indicator'] },
      { name: 'Upcoming Queue List', components: ['Waiting Queue Cards', 'ETA Indicator', 'Patient/Customer Name'] },
      { name: 'Operator Action Bar', components: ['Call Next Button', 'Recall Button', 'Mark Complete Button'] }
    ]
  },
  {
    id: 'PT-08',
    nama: 'Transaction / POS',
    deskripsi: 'Halaman kasir point of sale (POS) untuk memilih produk/layanan, keranjang belanja, diskon, dan total.',
    struktur: [
      'Product / Service Selection (Grid/Search)',
      'Cart / Order List',
      'Discount & Tax Calculation',
      'Order Summary (Subtotal, Total)',
      'Payment Trigger'
    ],
    defaultComponents: ['Product Grid', 'Search', 'Cart', 'Quantity Modifier', 'Discount Input', 'Tax Calculator', 'Subtotal', 'Total', 'Payment Button', 'Receipt Generator'],
    sectionsDetail: [
      { name: 'Catalog Selection Area', components: ['Category Chips', 'Product Grid Cards', 'Search Bar'] },
      { name: 'Cart Sidebar', components: ['Order Item Rows', 'Qty Adjusters', 'Item Notes'] },
      { name: 'Checkout Panel', components: ['Discount Field', 'Grand Total Display', 'Pay Now Button'] }
    ]
  },
  {
    id: 'PT-09',
    nama: 'Payment',
    deskripsi: 'Halaman penyelesaian pembayaran, pilihan metode bayar, konfirmasi transfer, dan cetak struk/invoice.',
    struktur: [
      'Invoice Summary (Order Details, Bill Amount)',
      'Amount Input / Confirmation',
      'Payment Method Selector (Cash, Transfer, QRIS, Card)',
      'Payment Confirmation & Proof',
      'Receipt / Struk View'
    ],
    defaultComponents: ['Invoice Card', 'Amount Display', 'Payment Method Selector', 'Cash Calculator', 'QRIS Display', 'Payment Status Badge', 'Receipt Print'],
    sectionsDetail: [
      { name: 'Bill Overview', components: ['Invoice Number', 'Total Due', 'Customer Reference'] },
      { name: 'Payment Method Grid', components: ['Cash', 'QRIS', 'Bank Transfer', 'Credit Card'] },
      { name: 'Payment Success Dialog', components: ['Change Due', 'Print Receipt Button', 'New Transaction Button'] }
    ]
  },
  {
    id: 'PT-10',
    nama: 'Report',
    deskripsi: 'Halaman laporan analitik bisnis dengan rentang tanggal, filter parameter, grafik visual, dan tombol ekspor.',
    struktur: [
      'Header (Date Range Picker, Dimension Filters, Export Button)',
      'Summary (KPI Cards, Comparison Trends)',
      'Analysis Section (Charts, Aggregate Table)'
    ],
    defaultComponents: ['KPI Card', 'Chart', 'Data Table', 'Filter', 'Date Range Picker', 'Export CSV/Excel'],
    sectionsDetail: [
      { name: 'Report Parameter Header', components: ['Date Range Dropdown', 'Branch/Category Filter', 'Export Button'] },
      { name: 'Executive Summary Cards', components: ['Total Revenue', 'Transaction Count', 'Growth Percentage'] },
      { name: 'Detailed Breakdown Table', components: ['Summarized Rows', 'Subtotals', 'Grand Total'] }
    ]
  },
  {
    id: 'PT-11',
    nama: 'Approval',
    deskripsi: 'Halaman verifikasi dan persetujuan bertingkat (approve / reject) dengan dokumen pendukung dan audit trail.',
    struktur: [
      'Request Summary Card',
      'Request Detail & Form View',
      'Supporting Documents Attachment',
      'Approval History / Audit Trail',
      'Action Buttons (Approve, Reject, Request Revision, Comment)'
    ],
    defaultComponents: ['Request Card', 'Status Badge', 'Documents Viewer', 'Timeline', 'Approve Button', 'Reject Button', 'Comment Input'],
    sectionsDetail: [
      { name: 'Submission Summary', components: ['Requester Info', 'Submission Date', 'Amount / Subject'] },
      { name: 'Document Inspection', components: ['Attached Files', 'Notes', 'System Validation Checks'] },
      { name: 'Decision Bar', components: ['Reject Button', 'Request Revision', 'Approve Button', 'Reason Textarea'] }
    ]
  },
  {
    id: 'PT-12',
    nama: 'Workflow',
    deskripsi: 'Halaman pelacakan proses multi-tahap (stepper) dari awal hingga selesai.',
    struktur: [
      'Stepper / Progress Bar',
      'Current Step Detail',
      'Step Action / Form Inputs',
      'Next Step Trigger',
      'Activity Log'
    ],
    defaultComponents: ['Stepper', 'Status Indicator', 'Checklist', 'Action Button', 'Timeline'],
    sectionsDetail: [
      { name: 'Stage Progress Stepper', components: ['Step 1..N Indicators', 'Current Stage Active Highlight'] },
      { name: 'Step Workspace', components: ['Required Actions for Step', 'Task Checklist', 'Verification Inputs'] },
      { name: 'Stage Transition Bar', components: ['Back Button', 'Save Draft', 'Advance to Next Step'] }
    ]
  },
  {
    id: 'PT-13',
    nama: 'Timeline',
    deskripsi: 'Halaman kronologi dan riwayat aktivitas berurutan berdasarkan waktu dan pelaku.',
    struktur: [
      'Timeline Stream',
      'Activity Event Cards',
      'Timestamp & Actor Tags',
      'Attachment Previews'
    ],
    defaultComponents: ['Timeline Container', 'Activity Item', 'User Tag', 'Timestamp Badge', 'Status Chip', 'Attachment Link'],
    sectionsDetail: [
      { name: 'Timeline Controls', components: ['Filter by Actor', 'Date Grouping'] },
      { name: 'Event Stream', components: ['Chronological Event Nodes', 'Activity Descriptions', 'Diff Logs'] }
    ]
  },
  {
    id: 'PT-14',
    nama: 'Kanban',
    deskripsi: 'Halaman papan kartu visual berdasarkan kolom status untuk pipeline penjualan, tugas kerja, atau proses bertahap.',
    struktur: [
      'Kanban Board (Stage 1..N Columns)',
      'Cards per Column',
      'Drag / Move Controls',
      'Quick Add Card'
    ],
    defaultComponents: ['Kanban Board', 'Column Header', 'Task/Deal Card', 'Card Tags', 'Stage Counter', 'Add Card Button'],
    sectionsDetail: [
      { name: 'Board Filter Bar', components: ['Search Cards', 'Assignee Filter', 'Priority Filter'] },
      { name: 'Columns Canvas', components: ['Status Columns', 'Draggable/Movable Cards', 'Column Summary Total'] }
    ]
  },
  {
    id: 'PT-15',
    nama: 'Settings',
    deskripsi: 'Halaman konfigurasi aplikasi, pengguna, peran, hak akses, notifikasi, dan integrasi pihak ketiga.',
    struktur: [
      'Settings Navigation (General, Users, Roles, Permissions, Notifications, Integrations, Advanced)',
      'Active Setting Form Content',
      'Save Action Bar'
    ],
    defaultComponents: ['Settings Navigation Menu', 'Configuration Form', 'Toggle Switches', 'API Key Inputs', 'Save Changes Button'],
    sectionsDetail: [
      { name: 'Setting Categories Sidebar', components: ['General', 'User Accounts', 'Role Matrix', 'Integrations'] },
      { name: 'Setting Form Panel', components: ['Form Field Groups', 'Toggle Options', 'Save Button'] }
    ]
  }
];

// =============================================================================
// 2. UI COMPONENT REGISTRY (8 Categories)
// =============================================================================
export const COMPONENT_REGISTRY: ComponentCategory[] = [
  {
    category: 'Navigation',
    components: ['Sidebar', 'Top Navigation', 'Bottom Navigation', 'Tab Navigation', 'Breadcrumb', 'Menu Dropdown']
  },
  {
    category: 'Data',
    components: ['Data Table', 'Card List', 'Detail List', 'Timeline View', 'Calendar Grid', 'Kanban Board', 'Chart Graph', 'KPI Card']
  },
  {
    category: 'Form',
    components: ['Text Field', 'Number Field', 'Currency Input', 'Date Picker', 'Time Picker', 'Select Dropdown', 'Multi Select', 'Checkbox', 'Radio Group', 'Toggle Switch', 'File Upload', 'Image Upload', 'Rich Text Editor', 'Repeater Rows']
  },
  {
    category: 'Status',
    components: ['Status Badge', 'Status Card', 'Progress Bar', 'Stepper', 'Alert Banner', 'Toast Notification']
  },
  {
    category: 'Transaction',
    components: ['Cart Sidebar', 'Invoice Card', 'Payment Method Grid', 'Receipt Preview', 'Discount Field', 'Tax Calculator', 'Total Due Display']
  },
  {
    category: 'Service',
    components: ['Appointment Slot', 'Queue Card', 'Staff Card', 'Service Card', 'Schedule Grid', 'Calling Number Display']
  },
  {
    category: 'Healthcare',
    components: ['Patient Card', 'Doctor Card', 'Queue Calling Card', 'Medical Record Summary', 'Prescription List', 'Appointment Card', 'Diagnosis Box']
  },
  {
    category: 'Business',
    components: ['Revenue KPI Card', 'Sales Trend Card', 'Customer Balance Card', 'Product Catalog Card', 'Stock Level Card', 'Expense Summary Card']
  }
];

// =============================================================================
// 3. PAGE TO COMPONENT MAPPING
// =============================================================================
export const PAGE_TO_COMPONENT_MAPPINGS: PageToComponentMapping[] = [
  { pageType: 'Dashboard', pageTemplateId: 'PT-01', defaultComponents: ['KPI Card', 'Chart', 'Recent Activity', 'Quick Action'] },
  { pageType: 'List', pageTemplateId: 'PT-02', defaultComponents: ['Search', 'Filter', 'Data Table', 'Pagination'] },
  { pageType: 'Detail', pageTemplateId: 'PT-03', defaultComponents: ['Summary Card', 'Information List', 'Status Badge', 'Timeline'] },
  { pageType: 'Form', pageTemplateId: 'PT-04', defaultComponents: ['Form Fields', 'Validation Alert', 'Action Bar'] },
  { pageType: 'Profile', pageTemplateId: 'PT-05', defaultComponents: ['Avatar Card', 'Tabs Container', 'Activity Log'] },
  { pageType: 'Calendar', pageTemplateId: 'PT-06', defaultComponents: ['Calendar Grid', 'Event Card', 'Staff Filter'] },
  { pageType: 'Queue', pageTemplateId: 'PT-07', defaultComponents: ['Queue Number Card', 'Position Indicator', 'ETA Badge', 'Action Buttons'] },
  { pageType: 'POS', pageTemplateId: 'PT-08', defaultComponents: ['Product Grid', 'Cart Sidebar', 'Subtotal & Total', 'Payment Trigger'] },
  { pageType: 'Payment', pageTemplateId: 'PT-09', defaultComponents: ['Invoice Summary', 'Amount Display', 'Payment Method Grid', 'Receipt Print'] },
  { pageType: 'Report', pageTemplateId: 'PT-10', defaultComponents: ['KPI Metrics', 'Trend Chart', 'Data Table', 'Export Button'] },
  { pageType: 'Approval', pageTemplateId: 'PT-11', defaultComponents: ['Request Card', 'Status Badge', 'Attached Documents', 'Approve/Reject Buttons'] },
  { pageType: 'Workflow', pageTemplateId: 'PT-12', defaultComponents: ['Stepper', 'Status Box', 'Task Checklist', 'Next Step Action'] },
  { pageType: 'Timeline', pageTemplateId: 'PT-13', defaultComponents: ['Chronological Node', 'User Badge', 'Timestamp Label'] },
  { pageType: 'Kanban', pageTemplateId: 'PT-14', defaultComponents: ['Status Columns', 'Draggable Cards', 'Filters Bar'] },
  { pageType: 'Settings', pageTemplateId: 'PT-15', defaultComponents: ['Settings Navigation Menu', 'Configuration Form', 'Save Action Button'] }
];

// =============================================================================
// 4. UI GENERATION RULES (Rule 1-5)
// =============================================================================
export const UI_GENERATION_RULES: UIGenerationRule[] = [
  {
    ruleNumber: 1,
    title: 'Gunakan Page Template yang Tersedia',
    ruleText: 'DILARANG membuat halaman/layout baru jika Page Template yang tersedia (PT-01 s/d PT-15) sudah dapat merepresentasikan kebutuhan tersebut.'
  },
  {
    ruleNumber: 2,
    title: 'Gunakan Component Registry Baku',
    ruleText: 'DILARANG membuat komponen kustom baru jika Component Registry sudah memiliki komponen standar yang sesuai.'
  },
  {
    ruleNumber: 3,
    title: 'Diferensiasi Role Melalui Konfigurasi & Permission',
    ruleText: 'Perbedaan tampilan antar role WAJIB diwujudkan melalui konfigurasi visibilitas dan permission pada Page Template yang sama, BUKAN menggandakan seluruh template secara berulang.'
  },
  {
    ruleNumber: 4,
    title: 'Fleksibilitas Variant',
    ruleText: 'Variant industri berhak menambahkan section dan komponen spesifik ke dalam Page Template standar tanpa merusak arsitektur induk.'
  },
  {
    ruleNumber: 5,
    title: 'Prinsip Fallback Custom',
    ruleText: 'Pola Custom (MT-20) HANYA digunakan jika kebutuhan pengguna benar-benar unik dan tidak dapat direpresentasikan oleh 15 Page Template standar.'
  }
];

// =============================================================================
// 5. ROLE TO PAGE MAPPING EXAMPLES (Healthcare Clinic End-to-End Reference)
// =============================================================================
export const HEALTHCARE_ROLE_PAGE_MAPPINGS: RoleToPageMappingExample[] = [
  {
    role: 'Patient',
    pages: [
      { pageName: 'Dashboard', pageTemplateId: 'PT-01', sections: ['Greeting & Notifikasi', 'Status Antrian Aktif', 'Jadwal Janji Temu Terdekat', 'Tagihan Belum Lunas', 'Aksi Cepat'] },
      { pageName: 'Appointment', pageTemplateId: 'PT-06', sections: ['Kalender Janji Temu', 'Pilih Dokter & Poli', 'Pilih Jam Kunjungan', 'Riwayat Booking'] },
      { pageName: 'Nomor Antrian', pageTemplateId: 'PT-07', sections: ['Nomor Antrian Anda', 'Nomor Sedang Dilayani', 'Posisi Antrean', 'Estimasi Waktu Tunggu', 'Tombol Refresh & Batal'] },
      { pageName: 'Riwayat Pemeriksaan', pageTemplateId: 'PT-02', sections: ['Daftar Kunjungan Medis', 'Detail Diagnosis & Tindakan'] },
      { pageName: 'Resep Obat', pageTemplateId: 'PT-03', sections: ['Daftar Resep Dokter', 'Aturan Pakai Obat', 'Status Pengambilan Farmasi'] },
      { pageName: 'Tagihan & Pembayaran', pageTemplateId: 'PT-09', sections: ['Ringkasan Tagihan Rawat', 'Pilihan Metode Pembayaran', 'Riwayat Transaksi'] },
      { pageName: 'Profil Pasien', pageTemplateId: 'PT-05', sections: ['Data Identitas Pasien', 'Kontak Darurat', 'Riwayat Alergi'] }
    ]
  },
  {
    role: 'Doctor',
    pages: [
      { pageName: 'Dashboard Dokter', pageTemplateId: 'PT-01', sections: ['Ringkasan Pasien Hari Ini', 'Status Poliklinik', 'Jadwal Praktek'] },
      { pageName: 'Antrean Pasien', pageTemplateId: 'PT-07', sections: ['Pasien Sedang Diperiksa', 'Pasien Berikutnya', 'Tombol Panggil Pasien', 'Tombol Mulai Periksa', 'Tombol Selesai'] },
      { pageName: 'Rekam Medis & Diagnosis', pageTemplateId: 'PT-04', sections: ['Form Anamnesa & Pemeriksaan Fisik', 'Diagnosis ICD', 'Rencana Tindakan Medis', 'Input Resep Elektronik'] },
      { pageName: 'Daftar Pasien', pageTemplateId: 'PT-02', sections: ['Pencarian Rekam Medis Pasien', 'Riwayat Kunjungan Terdahulu'] },
      { pageName: 'Jadwal Praktek', pageTemplateId: 'PT-06', sections: ['Kalender Praktek Mingguan', 'Pengaturan Kuota Pasien'] }
    ]
  },
  {
    role: 'Receptionist',
    pages: [
      { pageName: 'Dashboard Resepsionis', pageTemplateId: 'PT-01', sections: ['Ringkasan Kunjungan Hari Ini', 'Status Loket Pendaftaran', 'Antrean Terbuka'] },
      { pageName: 'Pendaftaran Pasien Baru / Lama', pageTemplateId: 'PT-04', sections: ['Form Registrasi Identitas', 'Pilihan Poli & Dokter', 'Cetak Nomor Antrean'] },
      { pageName: 'Manajemen Antrean Loket', pageTemplateId: 'PT-07', sections: ['Daftar Seluruh Antrean Poli', 'Panggil Loket', 'Pindahkan Poli', 'Batal Antrean'] },
      { pageName: 'Booking & Janji Temu', pageTemplateId: 'PT-06', sections: ['Jadwal Pasien Booking Online', 'Konfirmasi Kedatangan (Check-in)'] }
    ]
  }
];

// =============================================================================
// SELECTIVE CODE GENERATION INTEGRATION HELPERS (FASE C)
// =============================================================================

/**
 * Mencari Page Template berdasarkan PT-ID (misal: "PT-01")
 */
export function getPageTemplateById(id: string): PageTemplate | undefined {
  const cleanId = id.trim().toUpperCase();
  return PAGE_TEMPLATES.find(p => p.id.toUpperCase() === cleanId);
}

/**
 * Mendapatkan seluruh daftar Page Template
 */
export function getAllPageTemplates(): PageTemplate[] {
  return PAGE_TEMPLATES;
}

/**
 * Mendapatkan komponen berdasarkan kategori
 */
export function getComponentsByCategory(category: string): string[] {
  const cat = COMPONENT_REGISTRY.find(c => c.category.toLowerCase() === category.toLowerCase());
  return cat ? cat.components : [];
}

/**
 * Mendapatkan seluruh daftar UI Generation Rules
 */
export function getUIGenerationRules(): UIGenerationRule[] {
  return UI_GENERATION_RULES;
}

export interface PageMappingEntry {
  pageName: string;
  ptId: string;
  template: PageTemplate;
}

/**
 * Memetakan teks halaman/section dari Brief Kebutuhan ke Page Template (PT) unik secara selektif.
 * Menjamin HANYA mengambil 3-6 PT-ID relevan (BUKAN seluruh 15 PT sekaligus).
 */
export function detectSelectivePageTemplates(text: string): PageMappingEntry[] {
  const lower = text.toLowerCase();
  const matchedEntries: Map<string, PageMappingEntry> = new Map();

  const rules: { keywords: string[]; ptId: string; defaultName: string }[] = [
    {
      keywords: ['dashboard', 'ringkasan', 'overview', 'statistik', 'ikhtisar', 'beranda', 'kpi'],
      ptId: 'PT-01',
      defaultName: 'Dashboard & Ringkasan'
    },
    {
      keywords: ['pos', 'kasir', 'order baru', 'input order', 'input pesanan', 'transaksi baru', 'pemesanan', 'keranjang'],
      ptId: 'PT-08',
      defaultName: 'POS / Input Pesanan'
    },
    {
      keywords: ['antrian', 'antrean', 'queue', 'papan kerja', 'antrian kerja', 'cucian menunggu', 'tugas menunggu', 'loket', 'pemanggil'],
      ptId: 'PT-07',
      defaultName: 'Antrian & Papan Kerja'
    },
    {
      keywords: ['pembayaran', 'tagihan', 'billing', 'payment', 'pelunasan', 'invoice', 'struk', 'faktur'],
      ptId: 'PT-09',
      defaultName: 'Tagihan & Pembayaran'
    },
    {
      keywords: ['laporan', 'report', 'analitik', 'grafik', 'rekap', 'omset'],
      ptId: 'PT-10',
      defaultName: 'Laporan & Analitik'
    },
    {
      keywords: ['kalender', 'jadwal', 'booking', 'janji temu', 'appointment', 'roster', 'shift'],
      ptId: 'PT-06',
      defaultName: 'Jadwal & Kalender'
    },
    {
      keywords: ['kanban', 'pipeline', 'papan status', 'deal stage'],
      ptId: 'PT-14',
      defaultName: 'Kanban & Pipeline'
    },
    {
      keywords: ['approval', 'persetujuan', 'verifikasi', 'otorisasi'],
      ptId: 'PT-11',
      defaultName: 'Approval & Persetujuan'
    },
    {
      keywords: ['workflow', 'tahapan', 'progres kerja', 'stepper', 'status progres'],
      ptId: 'PT-12',
      defaultName: 'Workflow & Progres'
    },
    {
      keywords: ['profil', 'biodata', 'akun', 'data saya', 'member profile'],
      ptId: 'PT-05',
      defaultName: 'Profil Pengguna'
    },
    {
      keywords: ['settings', 'pengaturan', 'konfigurasi', 'kelola user', 'hak akses'],
      ptId: 'PT-15',
      defaultName: 'Pengaturan & Master Role'
    },
    {
      keywords: ['daftar', 'tabel', 'master data', 'katalog', 'kelola', 'list', 'riwayat'],
      ptId: 'PT-02',
      defaultName: 'Daftar Data & Tabel'
    }
  ];

  for (const r of rules) {
    if (r.keywords.some(k => lower.includes(k))) {
      const template = getPageTemplateById(r.ptId);
      if (template && !matchedEntries.has(r.ptId)) {
        matchedEntries.set(r.ptId, {
          pageName: r.defaultName,
          ptId: r.ptId,
          template
        });
      }
    }
  }

  // Fallback default minimal jika tidak ada match khusus: Dashboard (PT-01) + List (PT-02) + Form (PT-04)
  if (matchedEntries.size === 0) {
    const pt01 = getPageTemplateById('PT-01');
    const pt02 = getPageTemplateById('PT-02');
    if (pt01) matchedEntries.set('PT-01', { pageName: 'Dashboard', ptId: 'PT-01', template: pt01 });
    if (pt02) matchedEntries.set('PT-02', { pageName: 'Daftar Data', ptId: 'PT-02', template: pt02 });
  }

  return Array.from(matchedEntries.values());
}

/**
 * Menghasilkan instruksi terstruktur dan ringkas untuk disuntikkan ke
 * CODE_GENERATION_SYSTEM_PROMPT.
 * HANYA menyertakan PT yang relevan dan komponen yang bersesuaian.
 */
export function formatSelectivePageTemplatesForCodeGen(mappings: PageMappingEntry[]): string {
  if (mappings.length === 0) return '';

  const templatesText = mappings.map((m, idx) => {
    const t = m.template;
    return `   ${idx + 1}. Pola "${t.nama}" (${t.deskripsi}):
      - Struktur Layout: ${t.struktur.join(' → ')}
      - Komponen Baku: ${t.defaultComponents.slice(0, 5).join(', ')}`;
  }).join('\n');

  return `
22. ACUAN STRUKTUR VISUAL PAGE TEMPLATE (SELEKTIF SESUAI BRIEF KEBUTUHAN):
    Aplikasi ini mengacu pada pola layout visual standar berikut untuk tab-tab halamannya:
${templatesText}

    5 ATURAN IMPLEMENTASI UI:
    a. Gunakan pola Page Template di atas untuk menyusun layout tab yang sesuai — contoh: tab antrian wajib memiliki kartu status panggilan & daftar tunggu (bukan sekadar tabel polos); tab kasir/transaksi wajib memiliki area katalog/input + ringkasan.
    b. Wujudkan setiap section yang disepakati di Brief Kebutuhan sebagai blok visual/kartu yang nyata dan rapi.
    c. KEPATUHAN DEFAULT TAB & VISIBILITAS TAB PER ROLE (PRINSIP 20 & 21):
       - Saat loginAs(role) dipanggil: Setiap role WAJIB landing di tab default sesuai yang dideklarasikan di Brief Kebutuhan.
       - Di fungsi render() & filterTabsByRole(role): Tab WAJIB difilter berdasarkan atribut data-access-roles pada masing-masing tab-btn.
    d. Setiap elemen interaktif (tombol panggil, filter status, form pesanan, tab ganti role) WAJIB 100% berfungsi aktif di memori dengan JavaScript selaras.`;
}


