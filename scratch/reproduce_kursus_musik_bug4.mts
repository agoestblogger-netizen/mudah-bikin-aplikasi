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
import { POST } from '../src/app/api/generate/route';

async function runTest() {
  console.log('=== MEMULAI INVESTIGASI BUG 4 & BUG 3: DOMAIN KURSUS MUSIK ===');

  const sessionKursusMusik = {
    step: 'REVIEW_FINAL',
    statusKonfirmasi: 'disetujui',
    reviewFinalApproved: true,
    review: { statusKonfirmasi: 'disetujui' },
    match: {
      businessCategory: 'Kursus Musik',
      tier: 'BASIC',
      templateId: 'general_service'
    },
    storyline: {
      narasi: 'Aplikasi pengelolaan kursus musik untuk pencatatan murid, penugasan instruktur, jadwal les, dan pemantauan pembayaran kursus.',
      asumsiMasalah: 'Jadwal les sering bentrok dan pencatatan pembayaran murid masih manual.',
      asumsiAlurUtama: 'Pendaftaran Murid -> Penentuan Jadwal & Instruktur -> Pelaksanaan Les -> Pembayaran SPP Bulanan'
    },
    roles: {
      selected: ['Super Admin', 'Instruktur Musik', 'Murid', 'Petugas Admin'],
      wajib: ['Super Admin'],
      tambahan: ['Instruktur Musik', 'Murid', 'Petugas Admin']
    },
    flow: {
      alurInti: [
        { step: 1, pelaku: 'Murid', aksi: 'Mendaftar les dan memilih instrumen musik' },
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
        'Pencatatan Pilihan Instrumen (Gitar, Piano, Vokal, Drum)',
        'Manajemen Jadwal Les Mingguan & Ruangan Studio',
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
            'Petugas Admin': 'Lihat Jadwal Instruktur',
            'Instruktur Musik': '-',
            'Murid': '-'
          }
        },
        {
          namaModul: 'Jadwal & Absensi Les',
          izinPeran: {
            'Super Admin': 'Atur Semua Jadwal',
            'Petugas Admin': 'Atur Jadwal & Alokasi Studio',
            'Instruktur Musik': 'Lihat Jadwal & Input Absensi/Progres Sendiri',
            'Murid': 'Lihat Jadwal Milik Sendiri'
          }
        },
        {
          namaModul: 'Pendaftaran & SPP',
          izinPeran: {
            'Super Admin': 'Verifikasi & Laporan Pembayaran SPP',
            'Petugas Admin': 'Input Pendaftaran Murid & Penerimaan SPP',
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
            { nama: 'instrumen_pilihan', tipe: 'text', keterangan: 'Instrumen (Piano, Gitar, Drum, Vokal)' },
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

  const compiledBrief = compileBriefFromSession(sessionKursusMusik as any);
  (sessionKursusMusik as any).compiledBrief = compiledBrief;

  console.log('Compiled Brief (Job Desc preview):');
  const jobDescSection = compiledBrief.slice(compiledBrief.indexOf('Job Description'));
  console.log(jobDescSection);

  // Buat request simulasi ke /api/generate
  const reqPayload = {
    prompt: 'Saya menyetujui Brief Kebutuhan ini. Silakan buatkan prototipe aplikasinya sekarang.',
    chatHistory: [],
    stage: 'TAHAP_2_MOCKUP',
    currentCode: '',
    mode: 'BUILD',
    userProvider: 'openai',
    userApiKey: process.env.OPENAI_API_KEY,
    sessionState: sessionKursusMusik
  };

  console.log('\nMengirim request ke /api/generate...');
  const req = new Request('http://localhost:3000/api/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'authorization': 'Bearer test-token'
    },
    body: JSON.stringify(reqPayload)
  });

  const response = await POST(req);
  console.log('HTTP Status:', response.status);
  const contentType = response.headers.get('content-type') || '';
  console.log('Content-Type:', contentType);
  let finalReplyText = '';
  let finalCode: any = null;

  if (contentType.includes('application/json')) {
    const resData = await response.json();
    finalReplyText = resData.replyText;
    finalCode = resData.code;
    console.log('JSON success:', resData.success);
    console.log('JSON provider:', resData.provider);
    console.log('JSON replyText snippet:', resData.replyText?.slice(0, 300));
  } else if (response.body) {
    const reader = response.body.getReader();
    const dec = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += dec.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const raw = line.slice(5).trim();
        if (!raw || raw === '[DONE]') continue;

        try {
          const parsed = JSON.parse(raw);
          if (parsed.type === 'chunk' && parsed.text) {
            process.stdout.write(parsed.text);
          } else if (parsed.type === 'done') {
            finalReplyText = parsed.replyText;
            finalCode = parsed.code;
          }
        } catch (_) {}
      }
    }
  }

  console.log('\n\n--- HASIL API /api/generate ---');
  console.log('Has Code:', Boolean(finalCode));
  if (finalCode && finalCode.html) {
    const html = finalCode.html;
    fs.writeFileSync(path.resolve(process.cwd(), 'scratch/kursus_musik_generated.html'), html);
    console.log('\nKode HTML disimpan ke: scratch/kursus_musik_generated.html');
    console.log('Panjang HTML:', html.length, 'karakter');

    // Analisis tombol & onclick
    const onclickMatches = [...html.matchAll(/onclick=["']([^"']+)["']/g)].map(m => m[1]);
    console.log('\nSemua handler onclick yang dipanggil di HTML (total ' + onclickMatches.length + '):');
    const uniqueFns = new Set(onclickMatches.map(c => c.split('(')[0].trim()));
    console.log('Fungsi unik di onclick:', Array.from(uniqueFns));

    // Analisis fungsi yang didefinisikan di dalam tag <script>
    const scriptMatches = [...html.matchAll(/<script[\s\S]*?>([\s\S]*?)<\/script>/gi)];
    const combinedJs = scriptMatches.map(s => s[1]).join('\n');

    // Cek syntax error di combinedJs menggunakan acorn
    try {
      const acorn = await import('acorn');
      acorn.parse(combinedJs, { ecmaVersion: 'latest', sourceType: 'script' });
      console.log('✅ Sintaks JS 100% Valid (Acorn Parse OK)');
    } catch (e: any) {
      console.log('❌ SINTAKS JS ERROR:', e.message, 'line:', e.loc?.line, 'col:', e.loc?.column);
    }

    // Cek apakah ada overlay modal yang display: flex atau blokir layar
    const modalMatches = [...html.matchAll(/class=["'][^"']*modal[^"']*["'][^>]*style=["']([^"']*)["']/gi)];
    console.log('Modals inline styles:', modalMatches.map(m => m[1]));
  }
}

runTest();
