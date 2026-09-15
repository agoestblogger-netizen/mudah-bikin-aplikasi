import fs from 'fs';
import path from 'path';

// Baca .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...vals] = trimmed.split('=');
      const val = vals.join('=').trim().replace(/^['"]|['"]$/g, '');
      if (key && !process.env[key.trim()]) {
        process.env[key.trim()] = val;
      }
    }
  }
}

import { compileBriefFromSession } from '../src/lib/templates/processes/guided';

// Simulasi session Kursus Musik
const kursusMusikSession = {
  match: {
    businessCategory: 'Kursus Musik',
    tier: 'BASIC'
  },
  storyline: {
    narasi: 'Aplikasi pengelolaan kursus musik untuk pencatatan murid, penugasan instruktur, jadwal les, dan pemantauan pembayaran kursus.',
    asumsiMasalah: 'Jadwal les sering bentrok dan pencatatan pembayaran murid masih manual.',
    asumsiAlurUtama: 'Pendaftaran Murid -> Penentuan Jadwal & Instruktur -> Pelaksanaan Les -> Pembayaran SPP Bulanan'
  },
  roles: {
    selected: ['Super Admin', 'Instruktur Musik', 'Murid'],
    wajib: ['Super Admin'],
    tambahan: ['Instruktur Musik', 'Murid']
  },
  flow: {
    alurInti: [
      { step: 1, pelaku: 'Murid', aksi: 'Mendaftar les dan memilih instrumen musik' },
      { step: 2, pelaku: 'Super Admin', aksi: 'Menentukan jadwal kelas dan menugaskan instruktur musik' },
      { step: 3, pelaku: 'Instruktur Musik', aksi: 'Mengisi absensi kehadiran dan materi pembelajaran les' },
      { step: 4, pelaku: 'Super Admin', aksi: 'Menerima pembayaran SPP kursus dan mencetak kuitansi' }
    ],
    fiturPendukung: [
      'Pencatatan Pilihan Instrumen (Gitar, Piano, Vokal, Drum)',
      'Manajemen Jadwal Les Mingguan',
      'Kartu SPP & Bukti Pembayaran Digital',
      'Log Materi & Catatan Progres Murid'
    ]
  },
  rbac: {
    modul: [
      {
        namaModul: 'Manajemen Staf & Instruktur',
        izinPeran: {
          'Super Admin': 'Kelola Akun & Penugasan Instruktur',
          'Instruktur Musik': '-',
          'Murid': '-'
        }
      },
      {
        namaModul: 'Jadwal & Absensi Les',
        izinPeran: {
          'Super Admin': 'Atur Semua Jadwal',
          'Instruktur Musik': 'Lihat Jadwal & Input Absensi/Progres Sendiri',
          'Murid': 'Lihat Jadwal Milik Sendiri'
        }
      },
      {
        namaModul: 'Pendaftaran & SPP',
        izinPeran: {
          'Super Admin': 'Verifikasi & Terima Pembayaran SPP',
          'Instruktur Musik': '-',
          'Murid': 'Daftar Mandiri & Lihat Tagihan SPP Sendiri'
        }
      }
    ]
  },
  dataSchema: {
    tabel: [
      {
        nama: 'murid',
        keterangan: 'Data murid kursus musik',
        field: [
          { nama: 'id', tipe: 'text', keterangan: 'ID unik murid (MUR-001)' },
          { nama: 'nama_lengkap', tipe: 'text', keterangan: 'Nama lengkap murid' },
          { nama: 'instrumen_pilihan', tipe: 'text', keterangan: 'Instrumen yang dipelajari (Piano, Gitar, Drum, Vokal)' },
          { nama: 'nomor_wa', tipe: 'text', keterangan: 'Nomor WhatsApp murid / wali' },
          { nama: 'status_belajar', tipe: 'text', keterangan: 'Aktif, Cuti, Lulus' }
        ]
      },
      {
        nama: 'jadwal_les',
        keterangan: 'Jadwal sesi les musik mingguan',
        field: [
          { nama: 'id', tipe: 'text', keterangan: 'ID unik jadwal (JAD-001)' },
          { nama: 'murid_id', tipe: 'relasi ke murid', keterangan: 'Relasi ke murid' },
          { nama: 'instruktur', tipe: 'text', keterangan: 'Nama instruktur pembimbing' },
          { nama: 'hari_jam', tipe: 'text', keterangan: 'Hari dan waktu les (Senin 15:00)' },
          { nama: 'ruangan', tipe: 'text', keterangan: 'Studio 1, Studio 2, Ruang Piano' }
        ]
      },
      {
        nama: 'pembayaran_spp',
        keterangan: 'Catatan iuran SPP bulanan',
        field: [
          { nama: 'id', tipe: 'text', keterangan: 'ID kuitansi (SPP-001)' },
          { nama: 'murid_id', tipe: 'relasi ke murid', keterangan: 'Relasi ke murid' },
          { nama: 'bulan', tipe: 'text', keterangan: 'Bulan tagihan (Januari 2025)' },
          { nama: 'nominal', tipe: 'angka', keterangan: 'Nominal biaya les' },
          { nama: 'status_bayar', tipe: 'text', keterangan: 'Lunas, Menunggu Konfirmasi, Belum Bayar' }
        ]
      }
    ],
    korelasiRingkas: 'murid terhubung ke jadwal_les dan pembayaran_spp'
  }
};

const compiledBrief = compileBriefFromSession(kursusMusikSession as any);
console.log('=== COMPILED BRIEF KURSUS MUSIK ===');
console.log(compiledBrief);
