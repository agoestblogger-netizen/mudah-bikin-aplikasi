const samplePrdMsg = `
Product Requirements Document (PRD)
Rancangan Spesifikasi Sistem & Database
Plan Ready for Review
Aplikasi Ronda Pintar - Technical PRD & Architecture Plan

1. Executive Summary & Core Purpose
Ronda Pintar adalah...

2. Peran Pengguna & Hak Akses (User Roles & Login)
• Admin Kelurahan: Akses penuh - kelola jadwal, data warga, lokasi pos, verifikasi laporan, export data, lihat semua statistik.
• Petugas Ronda: Lihat jadwal pribadi, konfirmasi kehadiran, submit laporan kejadian, lihat riwayat laporan sendiri.
• Warga: Akses publik - lihat jadwal ronda dan laporkan kejadian langsung tanpa login.

3. Arsitektur Multi-Halaman
- View 1: Login
- View 2: Dashboard
`;

function extractRolesFromText(text: string): string[] {
  const roles: string[] = [];
  const forbiddenKeywords = [
    'nama peran', 'nama role', 'role 1', 'role 2', 'role 3', 'peran 1', 'peran 2', 'peran 3',
    'alur proses', 'alur', 'job description', 'struktur halaman', 'fitur utama', 'roadmap', 'catatan', 'fitur unik', 'halaman utama'
  ];

  // Cari section Peran Pengguna di PRD
  const prdRoleSectionMatch = text.match(/(?:Peran Pengguna|User Roles)[^\n]*\n([\s\S]*?)(?=(?:\n(?:#{1,6}\s*)?(?:\*\*)?(?:Bagian\s+|Poin\s+)?\d+[\.\)]\s*)|$)/i);
  const roleSectionText = prdRoleSectionMatch ? prdRoleSectionMatch[1] : text;

  // Pola: • RoleName: atau * **RoleName**: atau - RoleName:
  const prdRoleRegex = /(?:^[•\*\-]\s*(?:\*\*)?([^\n:\*]+)(?:\*\*)?\s*:)/gm;
  let prdM: RegExpExecArray | null;
  while ((prdM = prdRoleRegex.exec(roleSectionText)) !== null) {
    let rName = prdM[1].trim();
    rName = rName.replace(/^(?:Role|Peran)\s+/i, '').replace(/\s*\(.*?\)$/, '').trim();
    const isForbidden = forbiddenKeywords.some(k => rName.toLowerCase().startsWith(k));
    if (rName && rName.length < 35 && !isForbidden && !roles.some(r => r.toLowerCase() === rName.toLowerCase())) {
      roles.push(rName);
    }
  }

  return roles;
}

const extracted = extractRolesFromText(samplePrdMsg);
console.log('Extracted roles:', extracted);
