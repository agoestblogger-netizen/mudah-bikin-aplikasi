import { renderReviewFinalMarkdown, compileBriefFromSession } from '../src/lib/templates/processes/guided.js';
import type { MockupSessionState } from '../src/lib/templates/processes/types.js';

// Fungsi extractBriefAndRolesFromHistory disalin persis dari route.ts untuk perbandingan murni
function extractBriefAndRolesFromHistory(chatHistory: any[]): {
  rawBrief: string;
  roles: string[];
  publicRole: string | null;
  staffRoles: string[];
  roleLandingTabs: Record<string, string>;
} {
  const briefMsgs = (chatHistory || []).filter((m: any) => 
    m.text && (
      m.text.includes('Brief Kebutuhan') ||
      (m.text.includes('Nama App:') && m.text.includes('Fitur Utama')) ||
      m.text.includes('Job Description') ||
      m.text.includes('Struktur Halaman')
    )
  );
  const lastBriefMsg = briefMsgs[briefMsgs.length - 1]?.text || '';
  
  let rawBrief = lastBriefMsg;
  const briefMarkerIndex = lastBriefMsg.search(/📋\s*\*\*Brief Kebutuhan\*\*|\*\*Brief Kebutuhan\*\*/i);
  if (briefMarkerIndex !== -1) {
    rawBrief = lastBriefMsg.substring(briefMarkerIndex);
    const closingMatch = rawBrief.search(/\n\s*(Apakah\s+(?:lembar\s+)?Brief\s+Kebutuhan|Apakah\s+ada\s+detail|Silakan\s+konfirmasi)/i);
    if (closingMatch !== -1) {
      rawBrief = rawBrief.substring(0, closingMatch).trim();
    }
  }

  let roles: string[] = [];
  let publicRole: string | null = null;

  if (lastBriefMsg) {
    const jobDescMatch = lastBriefMsg.match(/(?:Job Description|Struktur Halaman)[^\n]*\n([\s\S]*?)(?=\n[ \t]*(?:Apakah|Fitur Utama|Roadmap|Fitur Unik|Catatan(?: Tambahan)?|Saran)|\n[ \t]*-[ \t]*\*\*Catatan|$)/i);
    const jobDescText = jobDescMatch ? jobDescMatch[1] : lastBriefMsg;
    
    const roleLineRegex = /(?:\*|-|\d+\.)\s+\*\*\[?([^\]:\*\n]+)\]?\*\*\s*:/g;
    let m: RegExpExecArray | null;
    const forbiddenKeywords = [
      'nama app', 'nama aplikasi', 'orientasi ui', 'tema visual', 'tier aplikasi',
      'pola proses bisnis', 'kekhasan industri', 'entitas data', 'state utama',
      'transisi inti', 'aturan bisnis', 'edge case', 'komponen wajib', 'saran',
      'fitur menyusul', 'catatan tambahan',
      'nama peran', 'nama role', 'role 1', 'role 2', 'role 3', 'peran 1', 'peran 2', 'peran 3',
      'alur proses', 'alur', 'job description', 'struktur halaman', 'fitur utama', 'roadmap', 'catatan', 'fitur unik', 'halaman utama'
    ];
    while ((m = roleLineRegex.exec(jobDescText)) !== null) {
      let roleName = m[1].trim();
      roleName = roleName.replace(/^(?:Role|Peran)\s+/i, '').replace(/\s*\(.*?\)$/, '').trim();
      const isForbidden = forbiddenKeywords.some(k => roleName.toLowerCase().startsWith(k));
      if (roleName && !isForbidden && !roles.some(r => r.toLowerCase() === roleName.toLowerCase())) {
        roles.push(roleName);
      }
    }

    if (roles.length === 0) {
      const targetUserMatch = lastBriefMsg.match(/(?:Target Pengguna|Daftar Peran|Peran Pengguna)[^\n]*\n([\s\S]*?)(?=\n[ \t]*(?:Job Description|Struktur Halaman|Alur|Fitur|$))/i);
      if (targetUserMatch) {
        const lines = targetUserMatch[1].split('\n');
        for (const line of lines) {
          const roleItemMatch = line.match(/(?:\*|-|\d+\.)\s+\*\*\[?([^\]:\*\n]+)\]?\*\*/);
          if (roleItemMatch) {
            let roleName = roleItemMatch[1].trim();
            roleName = roleName.replace(/^(?:Role|Peran)\s+/i, '').replace(/\s*\(.*?\)$/, '').trim();
            const isForbidden = forbiddenKeywords.some(k => roleName.toLowerCase().startsWith(k));
            if (roleName && !isForbidden && !roles.some(r => r.toLowerCase() === roleName.toLowerCase())) {
              roles.push(roleName);
            }
          }
        }
      }
    }
  }

  publicRole = roles.find(r => /^(pasien|pelanggan|customer|tamu|guest|publik|client)/i.test(r)) || null;
  const staffRoles = roles.filter(r => r !== publicRole);
  const roleLandingTabs: Record<string, string> = {};
  for (const role of roles) {
    roleLandingTabs[role] = role.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  return { rawBrief, roles, publicRole, staffRoles, roleLandingTabs };
}

// 3 Domain Uji
const testCases: { domain: string; session: MockupSessionState }[] = [
  {
    domain: 'Rental Mobil',
    session: {
      step: 'REVIEW_FINAL',
      match: { patternIds: ['PAT-01'], overlayIds: ['IND-01'], businessCategory: 'Rental Mobil', tier: 'BASIC' },
      storyline: {
        narasi: 'Sistem rental mobil dengan manajemen armada dan transaksi booking penyewa.',
        asumsiMasalah: 'Pengelolaan ketersediaan unit dan transparansi sewa harian',
        asumsiAlurUtama: 'Penyewa booking unit -> Petugas serah terima -> Pengembalian & pelunasan'
      },
      roles: {
        selected: ['Super Admin', 'Petugas Rental', 'Penyewa'],
        wajib: ['Super Admin', 'Petugas Rental', 'Penyewa'],
        tambahan: []
      },
      flow: {
        alurInti: [
          { step: 1, pelaku: 'Penyewa', aksi: 'Memilih unit mobil dan tanggal sewa' },
          { step: 2, pelaku: 'Petugas Rental', aksi: 'Memeriksa identitas dan serah terima unit' },
          { step: 3, pelaku: 'Penyewa', aksi: 'Mengembalikan mobil dan melunasi denda jika ada' },
          { step: 4, pelaku: 'Super Admin', aksi: 'Menerima rekapitulasi laporan sewa dan kas harian' }
        ],
        alurPendukung: [
          {
            nama: 'Perpanjangan Sewa',
            steps: [{ step: 1, pelaku: 'Penyewa', aksi: 'Mengajukan perpanjangan durasi via sistem' }]
          }
        ],
        fiturPendukung: ['Katalog Armada Mobil', 'Formulir Serah Terima', 'Notifikasi Pengembalian']
      },
      rbac: {
        modul: [
          { namaModul: 'Manajemen Armada', akses: { 'Super Admin': 'FULL', 'Petugas Rental': 'VIEW_EDIT', Penyewa: 'NO' } },
          { namaModul: 'Transaksi Rental', akses: { 'Super Admin': 'FULL', 'Petugas Rental': 'FULL', Penyewa: 'VIEW' } }
        ]
      },
      dataSchema: {
        tabel: [
          {
            nama: 'armada_mobil',
            field: [
              { nama: 'id_mobil', tipe: 'text', keterangan: 'ID Unit Mobil' },
              { nama: 'nomor_plat', tipe: 'text', keterangan: 'Plat Nomor Kendaraan' },
              { nama: 'status_ketersediaan', tipe: 'status', keterangan: 'Status Ready / Disewa' }
            ]
          },
          {
            nama: 'transaksi_rental',
            field: [
              { nama: 'no_kontrak', tipe: 'text', keterangan: 'Nomor Kontrak Sewa' },
              { nama: 'total_bayar', tipe: 'angka', keterangan: 'Total Tagihan Sewa' }
            ]
          }
        ]
      },
      simulasiDb: {
        tabel: [
          {
            nama: 'armada_mobil',
            kolom: ['id_mobil', 'nomor_plat', 'status_ketersediaan'],
            baris: [{ id_mobil: 'MOB-01', nomor_plat: 'B 1234 CD', status_ketersediaan: 'Ready' }]
          }
        ]
      },
      compiledBrief: ''
    }
  },
  {
    domain: 'Koperasi Simpan Pinjam',
    session: {
      step: 'REVIEW_FINAL',
      match: { patternIds: ['PAT-02'], overlayIds: ['IND-02'], businessCategory: 'Koperasi Simpan Pinjam', tier: 'PROFESSIONAL' },
      storyline: {
        narasi: 'Aplikasi pembukuan dan pengajuan pinjaman anggota koperasi simpan pinjam.',
        asumsiMasalah: 'Pencatatan manual simpanan anggota dan verifikasi pinjaman yang lambat',
        asumsiAlurUtama: 'Anggota setor simpanan -> Kasir catat transaksi -> Anggota ajukan pinjaman -> Pengurus approval'
      },
      roles: {
        selected: ['Pengurus Koperasi', 'Petugas Kasir', 'Anggota Koperasi'],
        wajib: ['Pengurus Koperasi', 'Petugas Kasir', 'Anggota Koperasi'],
        tambahan: []
      },
      flow: {
        alurInti: [
          { step: 1, pelaku: 'Anggota Koperasi', aksi: 'Mengajukan pinjaman dan menyetor simpanan wajib' },
          { step: 2, pelaku: 'Petugas Kasir', aksi: 'Memverifikasi bukti setoran dan mencairkan pinjaman' },
          { step: 3, pelaku: 'Pengurus Koperasi', aksi: 'Memberikan persetujuan (approval) pinjaman di atas plafon' }
        ],
        alurPendukung: [],
        fiturPendukung: ['Buku Simpanan Digital', 'Plafon Pinjaman', 'Laporan SHU']
      },
      rbac: {
        modul: [
          { namaModul: 'Manajemen Anggota', akses: { 'Pengurus Koperasi': 'FULL', 'Petugas Kasir': 'VIEW_EDIT', 'Anggota Koperasi': 'VIEW' } },
          { namaModul: 'Approval Pinjaman', akses: { 'Pengurus Koperasi': 'FULL', 'Petugas Kasir': 'NO', 'Anggota Koperasi': 'NO' } }
        ]
      },
      dataSchema: {
        tabel: [
          {
            nama: 'anggota_koperasi',
            field: [
              { nama: 'no_anggota', tipe: 'text', keterangan: 'Nomor Buku Anggota' },
              { nama: 'nama_lengkap', tipe: 'text', keterangan: 'Nama Lengkap Anggota' }
            ]
          },
          {
            nama: 'transaksi_pinjaman',
            field: [
              { nama: 'id_pinjaman', tipe: 'text', keterangan: 'ID Pinjaman' },
              { nama: 'nominal_pengajuan', tipe: 'angka', keterangan: 'Jumlah Pinjaman' },
              { nama: 'status_approval', tipe: 'status', keterangan: 'Menunggu / Disetujui' }
            ]
          }
        ]
      },
      simulasiDb: {
        tabel: [
          {
            nama: 'anggota_koperasi',
            kolom: ['no_anggota', 'nama_lengkap'],
            baris: [{ no_anggota: 'ANG-001', nama_lengkap: 'Budi Santoso' }]
          }
        ]
      },
      compiledBrief: ''
    }
  },
  {
    domain: 'Klinik Kesehatan',
    session: {
      step: 'REVIEW_FINAL',
      match: { patternIds: ['PAT-03'], overlayIds: ['IND-03'], businessCategory: 'Klinik Kesehatan', tier: 'PROFESSIONAL' },
      storyline: {
        narasi: 'Sistem antrean pendaftaran pasien, rekam medis dokter, dan penebusan obat di apotek klinik.',
        asumsiMasalah: 'Penumpukan nomor antrean manual dan catatan rekam medis kertas yang sering terselip',
        asumsiAlurUtama: 'Pasien ambil nomor antrean -> Resepsionis verifikasi poli -> Dokter input rekam medis -> Apoteker serah obat'
      },
      roles: {
        selected: ['Resepsionis', 'Dokter Poli', 'Apoteker', 'Pasien'],
        wajib: ['Resepsionis', 'Dokter Poli', 'Apoteker', 'Pasien'],
        tambahan: []
      },
      flow: {
        alurInti: [
          { step: 1, pelaku: 'Pasien', aksi: 'Mendaftar antrean online atau check-in kiosk' },
          { step: 2, pelaku: 'Resepsionis', aksi: 'Memverifikasi kartu identitas dan memanggil pasien' },
          { step: 3, pelaku: 'Dokter Poli', aksi: 'Pemeriksaan fisik dan memasukkan rekam medis serta resep obat' },
          { step: 4, pelaku: 'Apoteker', aksi: 'Menyiapkan obat dan menyerahkan kepada pasien' }
        ],
        alurPendukung: [],
        fiturPendukung: ['Nomor Antrean Realtime', 'Form Rekam Medis SOAP', 'Inventori Obat Apotek']
      },
      rbac: {
        modul: [
          { namaModul: 'Antrean & Pendaftaran', akses: { 'Resepsionis': 'FULL', 'Dokter Poli': 'VIEW', 'Apoteker': 'VIEW', 'Pasien': 'VIEW' } },
          { namaModul: 'Rekam Medis', akses: { 'Resepsionis': 'NO', 'Dokter Poli': 'FULL', 'Apoteker': 'VIEW', 'Pasien': 'NO' } },
          { namaModul: 'Apotek & Resep', akses: { 'Resepsionis': 'NO', 'Dokter Poli': 'VIEW_EDIT', 'Apoteker': 'FULL', 'Pasien': 'NO' } }
        ]
      },
      dataSchema: {
        tabel: [
          {
            nama: 'antrean_pasien',
            field: [
              { nama: 'no_antrean', tipe: 'text', keterangan: 'Nomor Antrean A01' },
              { nama: 'status_panggilan', tipe: 'status', keterangan: 'Menunggu / Diperiksa / Selesai' }
            ]
          },
          {
            nama: 'rekam_medis',
            field: [
              { nama: 'id_rm', tipe: 'text', keterangan: 'ID Rekam Medis' },
              { nama: 'diagnosa', tipe: 'text', keterangan: 'Diagnosa Penyakit' }
            ]
          }
        ]
      },
      simulasiDb: {
        tabel: [
          {
            nama: 'antrean_pasien',
            kolom: ['no_antrean', 'status_panggilan'],
            baris: [{ no_antrean: 'A01', status_panggilan: 'Menunggu' }]
          }
        ]
      },
      compiledBrief: ''
    }
  }
];

async function runComparison() {
  console.log('================================================================');
  console.log('POIN C: UJI KOMPARASI AKURASI BRIEF (SUMBER BARU VS LAMA)');
  console.log('================================================================\n');

  for (const tc of testCases) {
    console.log(`>>> Menguji Domain: ${tc.domain}`);

    // Generate markdown brief dari session menggunakan compileBriefFromSession
    const compiledMarkdown = compileBriefFromSession(tc.session);
    tc.session.compiledBrief = compiledMarkdown;

    // 1. CARA BARU (POIN C): Baca langsung dari session terstruktur
    const newRoles = tc.session.roles.selected;
    const newBrief = tc.session.compiledBrief;
    const newPublicRole = newRoles.find(r => /^(pasien|pelanggan|customer|tamu|guest|publik|client)/i.test(r)) || null;
    const newStaffRoles = newRoles.filter(r => r !== newPublicRole);
    const newRoleLandingTabs: Record<string, string> = {};
    for (const role of newRoles) {
      newRoleLandingTabs[role] = role.toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    // 2. CARA LAMA: Simulasikan bot mengirim brief di chatHistory lalu di-regex ulang
    const mockChatHistory = [
      { sender: 'AI', text: compiledMarkdown }
    ];
    const oldResult = extractBriefAndRolesFromHistory(mockChatHistory);

    // 3. KOMPARASI DETAIL
    console.log(`  [Data Sumber Baru (POIN C - sessionState)]:`);
    console.log(`    - Roles: ${JSON.stringify(newRoles)} (${newRoles.length} roles)`);
    console.log(`    - Public Role: ${newPublicRole}`);
    console.log(`    - Staff Roles: ${JSON.stringify(newStaffRoles)}`);
    console.log(`    - Compiled Brief Length: ${newBrief.length} chars`);
    console.log(`    - RBAC Modules: ${tc.session.rbac?.modul.map(m => m.namaModul).join(', ')}`);
    console.log(`    - Data Schema: ${tc.session.dataSchema?.tabel.map(t => t.nama).join(', ')}`);

    console.log(`  [Data Sumber Lama (Regex Re-parsing Chat History)]:`);
    console.log(`    - Extracted Roles: ${JSON.stringify(oldResult.roles)} (${oldResult.roles.length} roles)`);
    console.log(`    - Public Role: ${oldResult.publicRole}`);
    console.log(`    - Staff Roles: ${JSON.stringify(oldResult.staffRoles)}`);
    console.log(`    - Raw Brief Length: ${oldResult.rawBrief.length} chars`);

    // Evaluasi Kesamaan & Keunggulan
    const rolesMatch = JSON.stringify(newRoles.slice().sort()) === JSON.stringify(oldResult.roles.slice().sort());
    const publicRoleMatch = newPublicRole === oldResult.publicRole;
    const briefHasRbac = newBrief.includes('RBAC') || newBrief.includes('Matriks Hak Akses');
    const briefHasSchema = newBrief.includes('Skema Tabel') || newBrief.includes('Entitas Data');

    console.log(`  [Hasil Evaluasi Komparasi]:`);
    console.log(`    - Roles 100% Identik: ${rolesMatch ? '✅ YA' : '❌ BEDA'}`);
    console.log(`    - Public Role Identik: ${publicRoleMatch ? '✅ YA' : '❌ BEDA'}`);
    console.log(`    - Struktur RBAC Utuh: ${briefHasRbac ? '✅ YA' : '❌ TIDAK'}`);
    console.log(`    - Skema Data Utuh: ${briefHasSchema ? '✅ YA' : '❌ TIDAK'}`);

    if (!rolesMatch) {
      console.log(`    ⚠️ PERBEDAAN TERDETEKSI:`);
      console.log(`      Baru: ${JSON.stringify(newRoles)}`);
      console.log(`      Lama: ${JSON.stringify(oldResult.roles)}`);
    } else {
      console.log(`    ✨ Analisis: Sumber baru menjamin 100% integritas tanpa risiko noise regex / false positives.`);
    }
    console.log('----------------------------------------------------------------\n');
  }
}

runComparison().catch(console.error);
