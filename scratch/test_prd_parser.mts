import { parsePRD } from '../src/components/PRDCard';

const sampleText1 = `
Product Requirements Document (PRD)
Rancangan Spesifikasi Sistem & Database
Plan Ready for Review
Aplikasi Ronda Pintar - Technical PRD & Architecture Plan

1. Executive Summary & Core Purpose
Ronda Pintar adalah aplikasi manajemen keamanan lingkungan berbasis web yang modern dan mobile-friendly. Aplikasi ini menggantikan sistem buku ronda manual dengan platform digital yang memungkinkan:
• Petugas Ronda melihat jadwal pribadi, konfirmasi kehadiran, dan melaporkan kejadian real-time dari HP.
• Warga melaporkan kejadian kapan saja dan melihat status keamanan lingkungan.
• Admin Kelurahan mengelola jadwal, memantau absensi, menindaklanjuti laporan, dan melihat statistik keamanan.

2. Peran Pengguna & Hak Akses (User Roles & Login)
• Admin Kelurahan: Akses penuh - kelola jadwal, data warga, lokasi pos, verifikasi laporan, export data, lihat semua statistik.
• Petugas Ronda: Lihat jadwal pribadi, konfirmasi kehadiran, submit laporan kejadian, lihat riwayat laporan sendiri.
• Warga: Lihat jadwal ronda

3. Halaman & Tampilan Utama
- Dashboard Admin
- Form Laporan

4. Struktur Data
- Tabel Users
- Tabel Jadwal

5. Alur Kerja Utama
- Input laporan -> Verifikasi

6. Aturan Validasi
- Wajib isi tanggal

7. Rencana Integrasi Google Sheets
- Sheet Users, Sheet Jadwal
`;

const sampleTextWithBold = `
# Product Requirements Document (PRD)
## Technical PRD & Architecture Plan

### 1. Executive Summary & Core Purpose
Aplikasi ini adalah sistem absensi.

### 2. Peran Pengguna & Hak Akses
- Admin
- User

### 3. Halaman Utama
- Home
`;

const sampleTextMarkdownNumbered = `
Berikut adalah PRD untuk aplikasi Anda:

**Product Requirements Document (PRD)**
**Aplikasi Ronda Pintar**

**1. Executive Summary & Core Purpose**
Ronda Pintar adalah...

**2. Peran Pengguna & Hak Akses**
Admin dan Petugas.
`;

console.log('Sample 1:', parsePRD(sampleText1) ? 'SUCCESS' : 'FAILED');
console.log('Sample 2 (Markdown ###):', parsePRD(sampleTextWithBold) ? 'SUCCESS' : 'FAILED');
console.log('Sample 3 (Bold **1.):', parsePRD(sampleTextMarkdownNumbered) ? 'SUCCESS' : 'FAILED');
