import { ThemeBundle, HyperUIThemeId } from './types';

/**
 * REGISTRY BUNDEL TEMA HYPERUI (TERKURASI & TERTRANSLASI KE VUE 3)
 * 
 * Dikurasi langsung dari koleksi HyperUI (markmead/hyperui):
 * - Application (tables, modals, stats, tabs, inputs, selects, badges, toasts)
 * - Marketing (headers, banners, buttons, cards, ctas)
 * - Neobrutalism (tabs, cards, buttons, inputs, alerts)
 * 
 * Seluruh komponen interaktif telah diterjemahkan 100% ke direktif Vue 3
 * (v-if, v-model, @click, :class) tanpa manipulasi DOM manual atau Alpine.js.
 */
export const HYPERUI_THEME_BUNDLES: Record<HyperUIThemeId, ThemeBundle> = {
  modern_minimalist: {
    id: 'modern_minimalist',
    name: 'Modern Minimalis',
    tagline: 'Garis bersih, tipografi presisi, dan tata letak lapang bernuansa tenang',
    description: 'Mengutamakan keterbacaan tinggi dengan latar putih bersih, garis tepi slate halus (1px), radius lembut (rounded-lg), serta aksen warna indigo modern yang bersahaja.',
    palette: {
      primary: '#4f46e5', // indigo-600
      secondary: '#64748b', // slate-500
      accent: '#06b6d4', // cyan-500
      background: '#f8fafc', // slate-50
      cardBg: '#ffffff',
      border: '#e2e8f0', // slate-200
      text: '#0f172a', // slate-900
      isDark: false,
    },
    traits: {
      borderRadius: 'rounded-lg',
      shadow: 'shadow-sm',
      borderWeight: 'border border-slate-200',
      mood: 'Bersih, elegan, modern, produktif',
    },
    semanticNuances: [
      'minimalis', 'bersih', 'modern', 'elegan', 'rapi', 'ringkas',
      'toko', 'ritel', 'kursus', 'pendidikan', 'arsip', 'perpustakaan', 'inventaris'
    ],
    classes: {
      bodyBg: 'bg-slate-50 text-slate-800',
      card: 'bg-white rounded-lg border border-slate-200 shadow-sm p-5',
      table: 'min-w-full divide-y divide-slate-200 bg-white text-sm text-left',
      tableHeader: 'bg-slate-50 text-slate-700 font-semibold px-4 py-3 border-b border-slate-200',
      tableRow: 'hover:bg-slate-50/70 transition-colors border-b border-slate-100',
      input: 'w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-colors',
      select: 'w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-colors',
      buttonPrimary: 'inline-flex items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors shadow-sm focus:outline-none',
      buttonSecondary: 'inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm focus:outline-none',
      buttonDanger: 'inline-flex items-center justify-center gap-2 rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 transition-colors shadow-sm focus:outline-none',
      badge: {
        success: 'inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200',
        warning: 'inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 border border-amber-200',
        danger: 'inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700 border border-rose-200',
        info: 'inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 border border-indigo-200',
      },
      tabActive: 'border-b-2 border-indigo-600 text-indigo-600 font-semibold pb-3 px-3 text-sm transition whitespace-nowrap',
      tabInactive: 'border-b-2 border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 pb-3 px-3 text-sm font-medium transition whitespace-nowrap',
      modalContainer: 'relative w-full max-w-lg rounded-xl bg-white p-6 shadow-xl border border-slate-200',
      banner: 'rounded-lg border border-indigo-100 bg-indigo-50/60 p-4 text-indigo-900',
    },
    templates: {
      loginCard: `
<div class="min-h-screen flex items-center justify-center bg-slate-50 p-4">
  <div class="w-full max-w-md rounded-xl bg-white p-8 shadow-sm border border-slate-200">
    <div class="flex items-center justify-center w-12 h-12 rounded-lg bg-indigo-50 text-indigo-600 mb-4 mx-auto">
      <span class="text-2xl font-bold">✨</span>
    </div>
    <h2 class="text-center text-2xl font-bold tracking-tight text-slate-900">Masuk ke Akun Anda</h2>
    <p class="mt-1 text-center text-sm text-slate-500">Pilih akun peran atau isi kredensial di bawah</p>
    <!-- Form Login Reaktif -->
  </div>
</div>`,
      tabNav: `
<nav class="flex border-b border-slate-200 gap-2 overflow-x-auto">
  <button
    v-for="tab in tabs"
    :key="tab.id"
    v-show="isRoleAllowed(tab.roles)"
    @click="showTab(tab.id)"
    :class="activeTab === tab.id ? 'border-b-2 border-indigo-600 text-indigo-600 font-semibold' : 'border-b-2 border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 font-medium'"
    class="pb-3 px-3 text-sm transition whitespace-nowrap"
  >
    {{ tab.label }}
  </button>
</nav>`,
      statCard: `
<div class="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
  <div class="flex items-center justify-between">
    <div>
      <p class="text-xs font-medium text-slate-500 uppercase tracking-wider">{{ label }}</p>
      <p class="mt-1 text-2xl font-bold tracking-tight text-slate-900">{{ value }}</p>
    </div>
    <div class="rounded-md bg-indigo-50 p-2.5 text-indigo-600">
      <i :data-lucide="icon" class="w-5 h-5"></i>
    </div>
  </div>
</div>`,
      table: `
<div class="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
  <table class="min-w-full divide-y divide-slate-200 text-sm text-left">
    <thead class="bg-slate-50 text-slate-700 font-semibold">
      <tr>
        <th v-for="col in columns" :key="col.key" class="px-4 py-3 whitespace-nowrap">{{ col.label }}</th>
        <th class="px-4 py-3 text-right whitespace-nowrap">Aksi</th>
      </tr>
    </thead>
    <tbody class="divide-y divide-slate-100">
      <tr v-for="row in rows" :key="row.id" class="hover:bg-slate-50/70 transition-colors">
        <!-- data td -->
      </tr>
    </tbody>
  </table>
</div>`,
      modal: `
<div v-if="modal.isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
  <div class="relative w-full max-w-lg rounded-xl bg-white p-6 shadow-xl border border-slate-200">
    <h3 class="text-lg font-bold text-slate-900 mb-4">{{ modal.title }}</h3>
    <!-- Form Inputs -->
    <div class="mt-6 flex justify-end gap-2">
      <button @click="closeModal" class="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Batal</button>
      <button @click="saveData" class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Simpan</button>
    </div>
  </div>
</div>`,
      reportBanner: `
<div class="rounded-lg border border-indigo-100 bg-indigo-50/60 p-4 mb-6 flex items-start gap-3">
  <div class="p-1 rounded-md bg-indigo-100 text-indigo-600 mt-0.5">📊</div>
  <div>
    <h4 class="text-sm font-semibold text-indigo-950">Laporan Komputasi Otomatis (Read-Only)</h4>
    <p class="text-xs text-indigo-700 mt-0.5">{{ keterangan }}</p>
  </div>
</div>`,
    },
  },

  corporate_formal: {
    id: 'corporate_formal',
    name: 'Korporat Formal',
    tagline: 'Karakter kokoh, header tabel berbobot tegas, dan palet biru-slate enterprise',
    description: 'Desain berwibawa untuk lingkungan formal perbankan, instansi, hukum, atau korporasi. Menampilkan header tabel kapital tracking-wide, garis pembatas tegas, badge berkontur kokoh, dan tombol tegas.',
    palette: {
      primary: '#1e40af', // blue-800
      secondary: '#475569', // slate-600
      accent: '#0284c7', // sky-600
      background: '#f1f5f9', // slate-100
      cardBg: '#ffffff',
      border: '#cbd5e1', // slate-300
      text: '#0f172a', // slate-900
      isDark: false,
    },
    traits: {
      borderRadius: 'rounded-md',
      shadow: 'shadow',
      borderWeight: 'border-2 border-slate-200',
      mood: 'Profesional, berwibawa, terstruktur, disiplin',
    },
    semanticNuances: [
      'formal', 'korporat', 'perbankan', 'keuangan', 'koperasi', 'hukum',
      'audit', 'administrasi', 'pemerintahan', 'legal', 'instansi', 'akuntansi', 'bumn'
    ],
    classes: {
      bodyBg: 'bg-slate-100 text-slate-900',
      card: 'bg-white rounded-md border border-slate-300 shadow-sm p-6',
      table: 'min-w-full divide-y-2 divide-slate-300 bg-white text-sm text-left',
      tableHeader: 'bg-slate-100 text-slate-800 font-bold uppercase tracking-wider text-xs px-4 py-3 border-b-2 border-slate-300',
      tableRow: 'hover:bg-blue-50/40 transition-colors border-b border-slate-200',
      input: 'w-full rounded-md border-2 border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:ring-0 focus:outline-none transition-colors font-normal',
      select: 'w-full rounded-md border-2 border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white focus:border-blue-700 focus:ring-0 focus:outline-none transition-colors',
      buttonPrimary: 'inline-flex items-center justify-center gap-2 rounded-md bg-blue-800 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-900 transition-colors shadow-sm focus:outline-none',
      buttonSecondary: 'inline-flex items-center justify-center gap-2 rounded-md border-2 border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 transition-colors focus:outline-none',
      buttonDanger: 'inline-flex items-center justify-center gap-2 rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 transition-colors shadow-sm focus:outline-none',
      badge: {
        success: 'inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-900 border border-emerald-300',
        warning: 'inline-flex items-center gap-1 rounded-md bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900 border border-amber-300',
        danger: 'inline-flex items-center gap-1 rounded-md bg-red-100 px-2.5 py-1 text-xs font-bold text-red-900 border border-red-300',
        info: 'inline-flex items-center gap-1 rounded-md bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-900 border border-blue-300',
      },
      tabActive: 'border-b-3 border-blue-800 text-blue-900 font-bold pb-3 px-4 text-sm transition whitespace-nowrap bg-blue-50/50',
      tabInactive: 'border-b-3 border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-400 pb-3 px-4 text-sm font-semibold transition whitespace-nowrap',
      modalContainer: 'relative w-full max-w-lg rounded-lg bg-white p-6 shadow-2xl border-2 border-slate-300',
      banner: 'rounded-md border-l-4 border-blue-800 bg-blue-50 p-4 text-blue-950 border border-blue-200',
    },
    templates: {
      loginCard: `
<div class="min-h-screen flex items-center justify-center bg-slate-100 p-4">
  <div class="w-full max-w-md rounded-lg bg-white p-8 shadow-md border-2 border-slate-300">
    <div class="w-12 h-12 rounded bg-blue-800 text-white flex items-center justify-center text-xl font-bold mb-4 mx-auto">
      🏢
    </div>
    <h2 class="text-center text-2xl font-bold uppercase tracking-wide text-slate-900">Portal Operasional</h2>
    <p class="mt-1 text-center text-xs font-medium text-slate-600 uppercase tracking-wider">Sistem Informasi & Manajemen Dokumen</p>
  </div>
</div>`,
      tabNav: `
<nav class="flex border-b-2 border-slate-300 gap-1 overflow-x-auto bg-white p-1 rounded-t-md">
  <button
    v-for="tab in tabs"
    :key="tab.id"
    v-show="isRoleAllowed(tab.roles)"
    @click="showTab(tab.id)"
    :class="activeTab === tab.id ? 'border-b-2 border-blue-800 text-blue-900 font-bold bg-blue-50/70' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-semibold'"
    class="px-4 py-2.5 text-xs uppercase tracking-wider transition whitespace-nowrap rounded-t"
  >
    {{ tab.label }}
  </button>
</nav>`,
      statCard: `
<div class="rounded-md border-2 border-slate-200 bg-white p-5 shadow-xs">
  <div class="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
    <span class="text-xs font-bold text-slate-600 uppercase tracking-wider">{{ label }}</span>
    <span class="text-blue-800 font-bold">●</span>
  </div>
  <p class="text-3xl font-extrabold text-slate-900 tracking-tight">{{ value }}</p>
</div>`,
      table: `
<div class="overflow-x-auto rounded-md border-2 border-slate-300 bg-white shadow-xs">
  <table class="min-w-full divide-y-2 divide-slate-300 text-sm text-left">
    <thead class="bg-slate-100 text-slate-800 font-bold uppercase text-xs tracking-wider">
      <tr>
        <th v-for="col in columns" :key="col.key" class="px-4 py-3">{{ col.label }}</th>
        <th class="px-4 py-3 text-right">Opsi</th>
      </tr>
    </thead>
    <tbody class="divide-y divide-slate-200">
      <tr v-for="row in rows" :key="row.id" class="hover:bg-blue-50/40">
        <!-- data td -->
      </tr>
    </tbody>
  </table>
</div>`,
      modal: `
<div v-if="modal.isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
  <div class="relative w-full max-w-lg rounded-lg bg-white p-6 shadow-2xl border-2 border-slate-300">
    <h3 class="text-base font-bold uppercase tracking-wider text-slate-900 border-b pb-3 mb-4">{{ modal.title }}</h3>
    <!-- Form Inputs -->
    <div class="mt-6 flex justify-end gap-2 pt-3 border-t">
      <button @click="closeModal" class="rounded border-2 border-slate-300 bg-white px-4 py-2 text-xs font-bold uppercase text-slate-700 hover:bg-slate-100">Batal</button>
      <button @click="saveData" class="rounded bg-blue-800 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-blue-900">Simpan Data</button>
    </div>
  </div>
</div>`,
      reportBanner: `
<div class="rounded border-l-4 border-blue-800 bg-blue-50 p-4 mb-6 border border-blue-200">
  <div class="flex items-center gap-2">
    <span class="font-bold text-blue-900 uppercase text-xs tracking-wider">📊 Laporan Komputasi Terintegrasi</span>
    <span class="text-xs bg-blue-200 text-blue-900 px-2 py-0.5 rounded font-bold">READ-ONLY</span>
  </div>
  <p class="text-xs text-blue-800 mt-1">{{ keterangan }}</p>
</div>`,
    },
  },

  sleek_dark: {
    id: 'sleek_dark',
    name: 'Sleek Dark Mode',
    tagline: 'Latar gelap pekat, kontras visual tajam, dan estetika futuristik modern',
    description: 'Cocok untuk dasbor analitik mendalam, teknologi, sistem monitoring malam hari, atau estetika modern bernuansa gaming/tech. Didominasi warna zinc pekat, kontras tinggi, dan badge menyala.',
    palette: {
      primary: '#6366f1', // indigo-500
      secondary: '#a1a1aa', // zinc-400
      accent: '#22d3ee', // cyan-400
      background: '#09090b', // zinc-950
      cardBg: '#18181b', // zinc-900
      border: '#27272a', // zinc-800
      text: '#f4f4f5', // zinc-100
      isDark: true,
    },
    traits: {
      borderRadius: 'rounded-xl',
      shadow: 'shadow-lg shadow-black/40',
      borderWeight: 'border border-zinc-800',
      mood: 'Futuristik, berteknologi tinggi, fokus, kontras tinggi',
    },
    semanticNuances: [
      'dark', 'gelap', 'malam', 'tech', 'teknologi', 'gaming', 'server',
      'developer', 'analitik', 'crypto', 'iot', 'monitoring', 'cyber', 'it'
    ],
    classes: {
      bodyBg: 'bg-zinc-950 text-zinc-100',
      card: 'bg-zinc-900 rounded-xl border border-zinc-800 shadow-md p-5 text-zinc-100',
      table: 'min-w-full divide-y divide-zinc-800 bg-zinc-900 text-sm text-left text-zinc-200',
      tableHeader: 'bg-zinc-900/90 text-zinc-400 font-medium px-4 py-3 border-b border-zinc-800',
      tableRow: 'hover:bg-zinc-800/60 transition-colors border-b border-zinc-800/60',
      input: 'w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-colors',
      select: 'w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-colors',
      buttonPrimary: 'inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors shadow-md shadow-indigo-950 focus:outline-none',
      buttonSecondary: 'inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-200 hover:bg-zinc-700 transition-colors focus:outline-none',
      buttonDanger: 'inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 transition-colors shadow-md shadow-rose-950 focus:outline-none',
      badge: {
        success: 'inline-flex items-center gap-1 rounded-full bg-emerald-950/80 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-800',
        warning: 'inline-flex items-center gap-1 rounded-full bg-amber-950/80 px-2.5 py-0.5 text-xs font-semibold text-amber-400 border border-amber-800',
        danger: 'inline-flex items-center gap-1 rounded-full bg-rose-950/80 px-2.5 py-0.5 text-xs font-semibold text-rose-400 border border-rose-800',
        info: 'inline-flex items-center gap-1 rounded-full bg-indigo-950/80 px-2.5 py-0.5 text-xs font-semibold text-indigo-400 border border-indigo-800',
      },
      tabActive: 'bg-zinc-800 text-white font-bold px-4 py-2 rounded-lg text-sm transition border border-zinc-700 shadow-xs',
      tabInactive: 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 px-4 py-2 rounded-lg text-sm font-medium transition',
      modalContainer: 'relative w-full max-w-lg rounded-2xl bg-zinc-900 p-6 shadow-2xl border border-zinc-700 text-zinc-100',
      banner: 'rounded-xl border border-indigo-900/60 bg-indigo-950/40 p-4 text-indigo-200',
    },
    templates: {
      loginCard: `
<div class="min-h-screen flex items-center justify-center bg-zinc-950 p-4 text-zinc-100">
  <div class="w-full max-w-md rounded-2xl bg-zinc-900 p-8 shadow-2xl border border-zinc-800">
    <div class="w-12 h-12 rounded-xl bg-indigo-950 border border-indigo-800 text-indigo-400 flex items-center justify-center text-xl font-bold mb-4 mx-auto">
      ⚡
    </div>
    <h2 class="text-center text-2xl font-bold tracking-tight text-white">Akses Sistem</h2>
    <p class="mt-1 text-center text-sm text-zinc-400">Masuk untuk mengelola alur operasional</p>
  </div>
</div>`,
      tabNav: `
<nav class="flex gap-2 p-1.5 bg-zinc-900/90 rounded-xl border border-zinc-800 overflow-x-auto">
  <button
    v-for="tab in tabs"
    :key="tab.id"
    v-show="isRoleAllowed(tab.roles)"
    @click="showTab(tab.id)"
    :class="activeTab === tab.id ? 'bg-zinc-800 text-white font-bold border border-zinc-700 shadow-sm' : 'text-zinc-400 hover:text-white font-medium'"
    class="px-4 py-2 rounded-lg text-sm transition whitespace-nowrap"
  >
    {{ tab.label }}
  </button>
</nav>`,
      statCard: `
<div class="rounded-xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm">
  <p class="text-xs font-medium text-zinc-400">{{ label }}</p>
  <p class="mt-2 text-3xl font-extrabold tracking-tight text-white">{{ value }}</p>
</div>`,
      table: `
<div class="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900 shadow-sm">
  <table class="min-w-full divide-y divide-zinc-800 text-sm text-left text-zinc-300">
    <thead class="bg-zinc-950/60 text-zinc-400 font-semibold">
      <tr>
        <th v-for="col in columns" :key="col.key" class="px-4 py-3">{{ col.label }}</th>
        <th class="px-4 py-3 text-right">Aksi</th>
      </tr>
    </thead>
    <tbody class="divide-y divide-zinc-800/60">
      <tr v-for="row in rows" :key="row.id" class="hover:bg-zinc-800/40 transition-colors">
        <!-- data td -->
      </tr>
    </tbody>
  </table>
</div>`,
      modal: `
<div v-if="modal.isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
  <div class="relative w-full max-w-lg rounded-2xl bg-zinc-900 p-6 shadow-2xl border border-zinc-700 text-zinc-100">
    <h3 class="text-lg font-bold text-white mb-4">{{ modal.title }}</h3>
    <!-- Form Inputs -->
    <div class="mt-6 flex justify-end gap-2">
      <button @click="closeModal" class="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-700">Batal</button>
      <button @click="saveData" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">Simpan Perubahan</button>
    </div>
  </div>
</div>`,
      reportBanner: `
<div class="rounded-xl border border-indigo-900/60 bg-indigo-950/40 p-4 mb-6 text-indigo-200 flex items-center justify-between">
  <div>
    <h4 class="text-sm font-bold text-indigo-100">📊 Laporan Komputasi Dinamis (Read-Only)</h4>
    <p class="text-xs text-indigo-300 mt-0.5">{{ keterangan }}</p>
  </div>
  <span class="rounded bg-indigo-900/80 px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase text-indigo-300 border border-indigo-700">Auto-Compute</span>
</div>`,
    },
  },

  warm_pastel: {
    id: 'warm_pastel',
    name: 'Soft & Warm Pastel',
    tagline: 'Sudut membulat organik, palet hangat bersahabat, dan kenyamanan visual',
    description: 'Memberi rasa hangat dan ramah untuk layanan kesehatan, klinik hewan, salon, daycare, kursus ramah anak, atau kafe. Menggunakan warna lembut (amber/emerald/teal), sudut tumpul lega (rounded-2xl), dan kontras yang menenangkan.',
    palette: {
      primary: '#0d9488', // teal-600
      secondary: '#78716c', // stone-500
      accent: '#f59e0b', // amber-500
      background: '#fdfbf7', // warm stone light
      cardBg: '#ffffff',
      border: '#e7e5e4', // stone-200
      text: '#292524', // stone-800
      isDark: false,
    },
    traits: {
      borderRadius: 'rounded-2xl',
      shadow: 'shadow-sm',
      borderWeight: 'border border-stone-200',
      mood: 'Hangat, ramah, menenangkan, bersahabat',
    },
    semanticNuances: [
      'ramah', 'hangat', 'klinik', 'hewan', 'petshop', 'salon', 'spa',
      'daycare', 'kesehatan', 'bayi', 'anak', 'kuliner', 'kafe', 'kue', 'bakery', 'terapi'
    ],
    classes: {
      bodyBg: 'bg-[#faf8f5] text-stone-800',
      card: 'bg-white rounded-2xl border border-stone-200/90 shadow-sm p-6',
      table: 'min-w-full divide-y divide-stone-200 bg-white text-sm text-left',
      tableHeader: 'bg-amber-50/60 text-stone-700 font-semibold px-4 py-3.5 border-b border-stone-200',
      tableRow: 'hover:bg-amber-50/30 transition-colors border-b border-stone-100',
      input: 'w-full rounded-xl border border-stone-300 bg-stone-50/50 px-3.5 py-2.5 text-sm text-stone-800 placeholder-stone-400 focus:border-teal-600 focus:ring-1 focus:ring-teal-600 focus:outline-none transition-colors',
      select: 'w-full rounded-xl border border-stone-300 bg-stone-50/50 px-3.5 py-2.5 text-sm text-stone-800 focus:border-teal-600 focus:ring-1 focus:ring-teal-600 focus:outline-none transition-colors',
      buttonPrimary: 'inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 transition-colors shadow-sm focus:outline-none',
      buttonSecondary: 'inline-flex items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-5 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50 transition-colors focus:outline-none',
      buttonDanger: 'inline-flex items-center justify-center gap-2 rounded-xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-600 transition-colors shadow-sm focus:outline-none',
      badge: {
        success: 'inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200',
        warning: 'inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 border border-amber-200',
        danger: 'inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 border border-rose-200',
        info: 'inline-flex items-center gap-1 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700 border border-teal-200',
      },
      tabActive: 'bg-teal-50 text-teal-800 font-bold px-4 py-2.5 rounded-xl text-sm transition border border-teal-200/80 shadow-xs',
      tabInactive: 'text-stone-500 hover:text-stone-800 hover:bg-stone-100/60 px-4 py-2.5 rounded-xl text-sm font-medium transition',
      modalContainer: 'relative w-full max-w-lg rounded-3xl bg-white p-7 shadow-xl border border-stone-200',
      banner: 'rounded-2xl border border-teal-200 bg-teal-50/70 p-4 text-teal-900',
    },
    templates: {
      loginCard: `
<div class="min-h-screen flex items-center justify-center bg-[#faf8f5] p-4">
  <div class="w-full max-w-md rounded-3xl bg-white p-8 shadow-sm border border-stone-200">
    <div class="w-14 h-14 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center text-2xl font-bold mb-4 mx-auto border border-teal-100">
      🌿
    </div>
    <h2 class="text-center text-2xl font-bold text-stone-800">Selamat Datang</h2>
    <p class="mt-1 text-center text-sm text-stone-500">Silakan pilih peran Anda untuk memulai</p>
  </div>
</div>`,
      tabNav: `
<nav class="flex gap-2 p-1.5 bg-stone-100/70 rounded-2xl border border-stone-200/70 overflow-x-auto">
  <button
    v-for="tab in tabs"
    :key="tab.id"
    v-show="isRoleAllowed(tab.roles)"
    @click="showTab(tab.id)"
    :class="activeTab === tab.id ? 'bg-white text-teal-800 font-bold shadow-xs border border-teal-100' : 'text-stone-500 hover:text-stone-800 font-medium'"
    class="px-4 py-2.5 rounded-xl text-sm transition whitespace-nowrap"
  >
    {{ tab.label }}
  </button>
</nav>`,
      statCard: `
<div class="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs">
  <p class="text-xs font-semibold text-stone-500 uppercase tracking-wide">{{ label }}</p>
  <p class="mt-2 text-3xl font-extrabold text-stone-800">{{ value }}</p>
</div>`,
      table: `
<div class="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-xs">
  <table class="min-w-full divide-y divide-stone-200 text-sm text-left text-stone-700">
    <thead class="bg-amber-50/50 text-stone-700 font-semibold">
      <tr>
        <th v-for="col in columns" :key="col.key" class="px-4 py-3.5">{{ col.label }}</th>
        <th class="px-4 py-3.5 text-right">Tindakan</th>
      </tr>
    </thead>
    <tbody class="divide-y divide-stone-100">
      <tr v-for="row in rows" :key="row.id" class="hover:bg-amber-50/20 transition-colors">
        <!-- data td -->
      </tr>
    </tbody>
  </table>
</div>`,
      modal: `
<div v-if="modal.isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/30 backdrop-blur-xs">
  <div class="relative w-full max-w-lg rounded-3xl bg-white p-7 shadow-xl border border-stone-200">
    <h3 class="text-xl font-bold text-stone-800 mb-4">{{ modal.title }}</h3>
    <!-- Form Inputs -->
    <div class="mt-6 flex justify-end gap-2.5">
      <button @click="closeModal" class="rounded-xl border border-stone-300 bg-white px-5 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50">Batal</button>
      <button @click="saveData" class="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700">Simpan Data</button>
    </div>
  </div>
</div>`,
      reportBanner: `
<div class="rounded-2xl border border-teal-200 bg-teal-50/70 p-4 mb-6 text-teal-900 flex items-start gap-3">
  <span class="text-xl">📊</span>
  <div>
    <h4 class="text-sm font-bold text-teal-950">Laporan Akumulasi Layanan (Read-Only)</h4>
    <p class="text-xs text-teal-800 mt-0.5">{{ keterangan }}</p>
  </div>
</div>`,
    },
  },

  playful_neobrutalism: {
    id: 'playful_neobrutalism',
    name: 'Playful Neobrutalism',
    tagline: 'Border hitam tebal, bayangan tegas tanpa blur, dan aksen warna pop',
    description: 'Diambil dari koleksi Neobrutalism HyperUI. Menghadirkan identitas visual unik dengan border hitam 2px, hard box-shadow (4px 4px 0px black), sudut kotak tegas, serta warna blok cerah yang berani dan ekspresif.',
    palette: {
      primary: '#facc15', // yellow-400
      secondary: '#38bdf8', // sky-400
      accent: '#f472b6', // pink-400
      background: '#fef08a', // yellow-100 subtle
      cardBg: '#ffffff',
      border: '#000000',
      text: '#000000',
      isDark: false,
    },
    traits: {
      borderRadius: 'rounded-none',
      shadow: 'shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]',
      borderWeight: 'border-2 border-black',
      mood: 'Berani, ceria, retro, ekspresif, menonjol',
    },
    semanticNuances: [
      'kreatif', 'seru', 'playful', 'komunitas', 'muda', 'event',
      'fotografi', 'seni', 'desain', 'fashion', 'clothing', 'hiburan', 'rental', 'persewaan'
    ],
    classes: {
      bodyBg: 'bg-amber-50/80 text-black',
      card: 'bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-6',
      table: 'min-w-full divide-y-2 divide-black bg-white text-sm text-left border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]',
      tableHeader: 'bg-yellow-300 text-black font-extrabold px-4 py-3 border-b-2 border-black uppercase tracking-wider text-xs',
      tableRow: 'hover:bg-yellow-100/60 transition-colors border-b border-black',
      input: 'w-full border-2 border-black bg-white px-3 py-2 text-sm text-black placeholder-gray-500 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] focus:outline-none focus:bg-yellow-50',
      select: 'w-full border-2 border-black bg-white px-3 py-2 text-sm text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] focus:outline-none',
      buttonPrimary: 'inline-flex items-center justify-center gap-2 border-2 border-black bg-yellow-400 px-4 py-2 text-sm font-black text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-all',
      buttonSecondary: 'inline-flex items-center justify-center gap-2 border-2 border-black bg-white px-4 py-2 text-sm font-bold text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-all',
      buttonDanger: 'inline-flex items-center justify-center gap-2 border-2 border-black bg-rose-500 px-4 py-2 text-sm font-bold text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-all',
      badge: {
        success: 'inline-flex items-center gap-1 border border-black bg-emerald-300 px-2.5 py-0.5 text-xs font-bold text-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]',
        warning: 'inline-flex items-center gap-1 border border-black bg-amber-300 px-2.5 py-0.5 text-xs font-bold text-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]',
        danger: 'inline-flex items-center gap-1 border border-black bg-rose-400 px-2.5 py-0.5 text-xs font-bold text-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]',
        info: 'inline-flex items-center gap-1 border border-black bg-cyan-300 px-2.5 py-0.5 text-xs font-bold text-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]',
      },
      tabActive: 'border-2 border-black bg-yellow-300 text-black font-black px-4 py-2 text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition whitespace-nowrap',
      tabInactive: 'border-2 border-transparent hover:border-black text-black font-bold px-4 py-2 text-sm transition whitespace-nowrap',
      modalContainer: 'relative w-full max-w-lg border-3 border-black bg-white p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]',
      banner: 'border-2 border-black bg-cyan-200 p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-black',
    },
    templates: {
      loginCard: `
<div class="min-h-screen flex items-center justify-center bg-amber-100/50 p-4">
  <div class="w-full max-w-md border-3 border-black bg-white p-8 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
    <div class="w-12 h-12 border-2 border-black bg-yellow-400 text-black flex items-center justify-center text-2xl font-black mb-4 mx-auto shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
      ⚡
    </div>
    <h2 class="text-center text-2xl font-black uppercase tracking-tight text-black">Masuk Akun</h2>
    <p class="mt-1 text-center text-xs font-bold text-gray-700">PILIH SALAH SATU PERAN UNTUK MEMULAI</p>
  </div>
</div>`,
      tabNav: `
<nav class="flex gap-2 p-2 border-b-2 border-black bg-white overflow-x-auto">
  <button
    v-for="tab in tabs"
    :key="tab.id"
    v-show="isRoleAllowed(tab.roles)"
    @click="showTab(tab.id)"
    :class="activeTab === tab.id ? 'bg-yellow-300 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]' : 'bg-white hover:bg-gray-100'"
    class="border-2 border-black px-4 py-2 text-xs uppercase font-extrabold transition whitespace-nowrap"
  >
    {{ tab.label }}
  </button>
</nav>`,
      statCard: `
<div class="border-2 border-black bg-white p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
  <div class="flex items-center justify-between">
    <span class="text-xs font-extrabold uppercase text-black">{{ label }}</span>
    <span class="border border-black bg-yellow-300 px-1 text-[10px] font-black">METRIK</span>
  </div>
  <p class="mt-2 text-3xl font-black text-black">{{ value }}</p>
</div>`,
      table: `
<div class="overflow-x-auto border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white">
  <table class="min-w-full divide-y-2 divide-black text-sm text-left">
    <thead class="bg-yellow-300 font-black uppercase text-xs">
      <tr>
        <th v-for="col in columns" :key="col.key" class="px-4 py-3 border-r border-black last:border-r-0">{{ col.label }}</th>
        <th class="px-4 py-3 text-right">AKSI</th>
      </tr>
    </thead>
    <tbody class="divide-y border-t-2 border-black divide-black font-medium">
      <tr v-for="row in rows" :key="row.id" class="hover:bg-yellow-50">
        <!-- data td -->
      </tr>
    </tbody>
  </table>
</div>`,
      modal: `
<div v-if="modal.isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
  <div class="relative w-full max-w-lg border-3 border-black bg-white p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
    <h3 class="text-lg font-black uppercase tracking-tight text-black mb-4 border-b-2 border-black pb-2">{{ modal.title }}</h3>
    <!-- Form Inputs -->
    <div class="mt-6 flex justify-end gap-3 pt-3 border-t-2 border-black">
      <button @click="closeModal" class="border-2 border-black bg-white px-4 py-2 text-xs font-bold uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-100">Batal</button>
      <button @click="saveData" class="border-2 border-black bg-yellow-400 px-4 py-2 text-xs font-black uppercase shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-yellow-300">Simpan Sekarang</button>
    </div>
  </div>
</div>`,
      reportBanner: `
<div class="border-2 border-black bg-cyan-200 p-4 mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-between">
  <div>
    <h4 class="text-sm font-black uppercase text-black">📊 LAPORAN TURUNAN SISTEM (READ-ONLY)</h4>
    <p class="text-xs font-bold text-gray-800 mt-0.5">{{ keterangan }}</p>
  </div>
  <span class="border border-black bg-white px-2 py-0.5 text-[10px] font-black uppercase">OTOMATIS</span>
</div>`,
    },
  },

  vibrant_saas: {
    id: 'vibrant_saas',
    name: 'Vibrant SaaS & Indigo',
    tagline: 'Gaya visual aplikasi modern Silicon Valley: tab pills, kartu ring-1, dan gradasi lembut',
    description: 'Estetika premium platform SaaS modern (seperti Linear, Stripe, Supabase). Memadukan navigasi tab model pill kapsul di dalam container abu-abu, kartu metrik dengan border tipis ring-1, dan tombol gradasi ungu-indigo.',
    palette: {
      primary: '#4338ca', // indigo-700
      secondary: '#6366f1', // indigo-500
      accent: '#8b5cf6', // violet-500
      background: '#f8fafc', // slate-50
      cardBg: '#ffffff',
      border: '#e0e7ff', // indigo-100
      text: '#1e1b4b', // indigo-950
      isDark: false,
    },
    traits: {
      borderRadius: 'rounded-xl',
      shadow: 'shadow-sm ring-1 ring-slate-900/5',
      borderWeight: 'border border-indigo-100',
      mood: 'Canggih, premium, lincah, berenergi tinggi',
    },
    semanticNuances: [
      'saas', 'startup', 'fintech', 'modern', 'digital', 'langganan',
      'membership', 'booking', 'reservasi', 'barber', 'laundry', 'persewaan', 'jasa'
    ],
    classes: {
      bodyBg: 'bg-slate-50 text-slate-800',
      card: 'bg-white rounded-xl border border-indigo-100 shadow-sm ring-1 ring-slate-900/5 p-5',
      table: 'min-w-full divide-y divide-slate-200 bg-white text-sm text-left',
      tableHeader: 'bg-indigo-50/40 text-slate-700 font-semibold px-4 py-3 border-b border-indigo-100',
      tableRow: 'hover:bg-indigo-50/25 transition-colors border-b border-slate-100',
      input: 'w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all shadow-xs',
      select: 'w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all shadow-xs',
      buttonPrimary: 'inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white hover:from-indigo-700 hover:to-violet-700 transition-all shadow-sm shadow-indigo-200 focus:outline-none',
      buttonSecondary: 'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs focus:outline-none',
      buttonDanger: 'inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 transition-colors shadow-sm focus:outline-none',
      badge: {
        success: 'inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20',
        warning: 'inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20',
        danger: 'inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-600/20',
        info: 'inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-600/20',
      },
      tabActive: 'bg-white text-indigo-700 font-bold px-3.5 py-1.5 rounded-lg text-sm transition shadow-xs ring-1 ring-slate-900/5',
      tabInactive: 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 px-3.5 py-1.5 rounded-lg text-sm font-medium transition',
      modalContainer: 'relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-indigo-100 ring-1 ring-slate-900/10',
      banner: 'rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50/80 to-violet-50/60 p-4 text-indigo-950 shadow-xs',
    },
    templates: {
      loginCard: `
<div class="min-h-screen flex items-center justify-center bg-slate-50 p-4">
  <div class="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-900/5 border border-indigo-100">
    <div class="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center text-xl font-bold mb-4 mx-auto shadow-md shadow-indigo-200">
      🚀
    </div>
    <h2 class="text-center text-2xl font-bold tracking-tight text-slate-900">Dashboard Akses</h2>
    <p class="mt-1 text-center text-sm text-slate-500">Pilih salah satu peran untuk simulasi operasional</p>
  </div>
</div>`,
      tabNav: `
<nav class="flex gap-1 p-1 bg-slate-200/70 rounded-xl overflow-x-auto w-fit">
  <button
    v-for="tab in tabs"
    :key="tab.id"
    v-show="isRoleAllowed(tab.roles)"
    @click="showTab(tab.id)"
    :class="activeTab === tab.id ? 'bg-white text-indigo-700 font-bold shadow-xs ring-1 ring-slate-900/5' : 'text-slate-600 hover:text-slate-900 font-medium'"
    class="px-3.5 py-1.5 rounded-lg text-sm transition whitespace-nowrap"
  >
    {{ tab.label }}
  </button>
</nav>`,
      statCard: `
<div class="rounded-xl border border-indigo-100 bg-white p-5 shadow-sm ring-1 ring-slate-900/5">
  <div class="flex items-center justify-between">
    <p class="text-xs font-semibold text-indigo-600 tracking-wide">{{ label }}</p>
    <span class="rounded-md bg-indigo-50 p-1.5 text-indigo-600">
      <i :data-lucide="icon" class="w-4 h-4"></i>
    </span>
  </div>
  <p class="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">{{ value }}</p>
</div>`,
      table: `
<div class="overflow-x-auto rounded-xl border border-indigo-100 bg-white shadow-sm ring-1 ring-slate-900/5">
  <table class="min-w-full divide-y divide-slate-200 text-sm text-left">
    <thead class="bg-indigo-50/30 text-slate-700 font-semibold">
      <tr>
        <th v-for="col in columns" :key="col.key" class="px-4 py-3">{{ col.label }}</th>
        <th class="px-4 py-3 text-right">Tindakan</th>
      </tr>
    </thead>
    <tbody class="divide-y divide-slate-100">
      <tr v-for="row in rows" :key="row.id" class="hover:bg-indigo-50/20 transition-colors">
        <!-- data td -->
      </tr>
    </tbody>
  </table>
</div>`,
      modal: `
<div v-if="modal.isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
  <div class="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-indigo-100 ring-1 ring-slate-900/10">
    <h3 class="text-lg font-bold text-slate-900 mb-4">{{ modal.title }}</h3>
    <!-- Form Inputs -->
    <div class="mt-6 flex justify-end gap-2">
      <button @click="closeModal" class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Batal</button>
      <button @click="saveData" class="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white hover:from-indigo-700 hover:to-violet-700 shadow-sm shadow-indigo-200">Simpan Data</button>
    </div>
  </div>
</div>`,
      reportBanner: `
<div class="rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50/80 to-violet-50/60 p-4 mb-6 text-indigo-950 shadow-xs flex items-center justify-between">
  <div>
    <h4 class="text-sm font-bold text-indigo-950">📊 Laporan Kalkulasi Agregat (Read-Only)</h4>
    <p class="text-xs text-indigo-700 mt-0.5">{{ keterangan }}</p>
  </div>
  <span class="rounded-full bg-indigo-100 text-indigo-800 text-xs px-2.5 py-0.5 font-bold">Auto</span>
</div>`,
    },
  },
};

/**
 * Mendapatkan daftar seluruh bundel tema yang tersedia
 */
export function getAllThemeBundles(): ThemeBundle[] {
  return Object.values(HYPERUI_THEME_BUNDLES);
}

/**
 * Mendapatkan bundel tema berdasarkan ID (dengan fallback aman ke modern_minimalist)
 */
export function getThemeBundleById(id?: string): ThemeBundle {
  if (id && id in HYPERUI_THEME_BUNDLES) {
    return HYPERUI_THEME_BUNDLES[id as HyperUIThemeId];
  }
  return HYPERUI_THEME_BUNDLES.modern_minimalist;
}
