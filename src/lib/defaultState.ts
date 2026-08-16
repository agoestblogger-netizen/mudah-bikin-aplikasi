import { AppProjectState } from '@/types/app';

/**
 * CLEAN SLATE INITIAL STATE (PRD Tahap 1: Sesi Baru Bersih Tanpa Mockup Hardcode)
 * Mockup Canvas dan Backend GAS dimulai dalam keadaan KOSONG sampai digenerate oleh AI.
 */
export const initialProjectState: AppProjectState = {
  id: 'proj-' + Date.now(),
  title: 'Proyek Aplikasi Baru',
  description: 'Belum ada deskripsi. Diskusikan ide Anda bersama AI di Tahap 1.',
  currentStage: 'TAHAP_1_PEMBUKAAN',
  chatMessages: [
    {
      id: 'msg-1',
      sender: 'AI',
      text: 'Halo! Selamat datang di Mudah Bikin Aplikasi. Saya akan memandu Anda membuat aplikasi web fungsional siap pakai.\n\nMari kita mulai: Jenis aplikasi apa yang ingin Anda buat hari ini, dan untuk siapa aplikasi ini dirancang?',
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      suggestedOptions: [
        'Aplikasi Kasir & Inventaris Toko',
        'Sistem Catat Peminjaman Barang / Posyandu',
        'Formulir Pendaftaran & Data Anggota',
        'Dashboard Laporan Keuangan Harian'
      ]
    }
  ],
  mandatorySpecs: {
    appType: '',
    appGoal: '',
    targetUsers: '',
    requiresLogin: false,
    loginType: 'ROLE_BASED',
    hasAdminRole: false,
    hasUserManagement: false,
    keyButtonsActions: [],
    basicValidationRules: []
  },
  featureChecklist: [],
  rolePermissions: [],
  dataColumns: [],
  canvasCode: {
    html: '',
    css: '',
    js: ''
  },
  gasConfig: {
    sheetId: '',
    webAppUrl: '',
    scriptCode: '',
    isConnected: false
  },
  patchHistory: [],
  troubleshootIssues: [],
  qualityAudit: {
    isCanvasCodeOnly: false,
    hasDynamicState: false,
    hasAdminUserManagement: false,
    hasLoginValidation: false,
    isResponsiveGlassmorphism: false,
    hasGasBackend: false,
    totalScore: 0,
    warnings: ['Aplikasi belum digenerate oleh AI.'],
    recommendations: [
      'Jawab pertanyaan AI di Tahap 1 (Wawancara)',
      'Generate mockup fungsional pertama di Tahap 2'
    ]
  },
  updatedAt: new Date().toISOString()
};
