import { generateDataSchemaWithAI } from '../src/app/api/guided/route';

const sessionKursusMusik: any = {
  step: 'SKEMA_DATA',
  match: {
    businessCategory: 'Kursus Musik',
    tier: 'BASIC',
    templateId: 'general_service'
  },
  storyline: {
    narasi: 'Aplikasi pengelolaan kursus musik untuk pencatatan murid, penugasan instruktur, jadwal les, dan pemantauan pembayaran kursus.',
    asumsiMasalah: 'Jadwal les sering bentrok dan pencatatan pembayaran murid masih manual.',
    asumsiAlurUtama: 'Pendaftaran Murid & Pemilihan Paket Kursus -> Penentuan Jadwal & Instruktur -> Pelaksanaan Les -> Pembayaran SPP Bulanan'
  },
  roles: {
    selected: ['Super Admin', 'Instruktur Musik', 'Murid', 'Petugas Admin'],
    wajib: ['Super Admin'],
    tambahan: ['Instruktur Musik', 'Murid', 'Petugas Admin']
  },
  flow: {
    alurInti: [
      { step: 1, pelaku: 'Murid', aksi: 'Mendaftar & memilih paket kursus musik (misal: Piano, Gitar, Drum, Vokal)' },
      { step: 2, pelaku: 'Petugas Admin', aksi: 'Menentukan jadwal kelas dan menugaskan instruktur musik' },
      { step: 3, pelaku: 'Instruktur Musik', aksi: 'Mengisi absensi kehadiran dan materi pembelajaran les' },
      { step: 4, pelaku: 'Super Admin', aksi: 'Menerima pembayaran SPP kursus dan mencetak kuitansi' }
    ],
    alurPendukung: [
      {
        nama: 'Pendaftaran & Penjadwalan Kursus',
        steps: [
          { pelaku: 'Petugas Admin', aksi: 'Memverifikasi ketersediaan ruangan studio musik dan jadwal instruktur' }
        ]
      }
    ],
    fiturPendukung: [
      'Pencatatan Pilihan Instrumen & Paket Kursus (Gitar, Piano, Vokal, Drum)',
      'Manajemen Jadwal Les Mingguan & Ruangan Studio',
      'Kartu SPP & Bukti Pembayaran Digital',
      'Log Materi & Catatan Progres Murid'
    ]
  },
  rbac: {
    modul: [
      {
        nama: 'Manajemen Staf & Instruktur',
        deskripsiFungsional: 'Kelola data instruktur dan akun admin'
      },
      {
        nama: 'Jadwal & Absensi Les',
        deskripsiFungsional: 'Pengaturan jadwal les mingguan dan absensi murid'
      },
      {
        nama: 'Pendaftaran & SPP',
        deskripsiFungsional: 'Pendaftaran paket kursus baru dan pembayaran biaya SPP'
      }
    ]
  }
};

async function runTest() {
  console.log('=== UJI GENERASI SKEMA DATA KURSUS MUSIK DENGAN GEMINI (PROMPT SEKARANG) ===');
  const result = await generateDataSchemaWithAI(
    sessionKursusMusik,
    'gemini',
    process.env.GEMINI_API_KEY
  );

  console.log('\nTabel yang Dihasilkan:');
  for (const t of result.tabel) {
    console.log(`\n- Tabel: ${t.nama} (${t.keterangan})`);
    for (const f of t.field) {
      console.log(`    * ${f.nama} (${f.tipe}) - ${f.keterangan || ''} ${f.targetRole ? `[targetRole: ${f.targetRole}]` : ''}`);
    }
  }

  console.log('\nKorelasi Ringkas:\n', result.korelasiRingkas);
}

runTest().catch(console.error);
