/**
 * Role policy shared by brief generation, prototype generation, and validation.
 * Super Admin is the only system-level role; business roles remain separate.
 */

export const REQUIRED_SYSTEM_ROLE = 'Super Admin';

export type RoleCategory = 'system' | 'business' | 'operational' | 'external';

export function normalizeRoleName(role: string): string {
  const clean = role.trim().replace(/\s+/g, ' ');
  if (/^(?:super\s*)?admin$/i.test(clean)) return REQUIRED_SYSTEM_ROLE;
  return clean;
}

export function isSuperAdminRole(role: string): boolean {
  return normalizeRoleName(role).toLowerCase() === REQUIRED_SYSTEM_ROLE.toLowerCase();
}

export function ensureRequiredSystemRole(roles: string[]): string[] {
  const normalized = roles
    .map(normalizeRoleName)
    .filter(Boolean);
  const unique = normalized.filter((role, index, all) =>
    all.findIndex((candidate) => candidate.toLowerCase() === role.toLowerCase()) === index
  );

  return [
    REQUIRED_SYSTEM_ROLE,
    ...unique.filter((role) => !isSuperAdminRole(role))
  ];
}

export function getRoleCategory(role: string): RoleCategory {
  if (isSuperAdminRole(role)) return 'system';
  if (/owner|pemilik/i.test(role)) return 'business';
  if (/manager|manajer|supervisor|pengawas/i.test(role)) return 'business';
  if (/pelanggan|customer|penyewa|pasien|anggota|member|tamu|guest|publik|client|siswa|murid/i.test(role)) {
    return 'external';
  }
  return 'operational';
}

export function formatRolePolicyForPrompt(): string {
  return `
=== KEBIJAKAN ROLE PLATFORM (WAJIB) ===
1. Setiap aplikasi WAJIB memiliki role sistem "${REQUIRED_SYSTEM_ROLE}".
2. "${REQUIRED_SYSTEM_ROLE}" adalah satu-satunya role yang boleh membuat, mengubah, menonaktifkan, menghapus akun staf, menetapkan role, atau mengubah permission.
3. "${REQUIRED_SYSTEM_ROLE}" bukan petugas operasional. Jangan gunakan role ini untuk menjalankan transaksi harian.
4. "Owner" adalah role bisnis opsional untuk data dan laporan usaha, bukan pengelola akun staf.
5. "Manager" adalah role pengawas operasional opsional, bukan pengelola akun staf atau permission.
6. Untuk pekerjaan harian gunakan nama pekerjaan nyata seperti "Petugas Sewa", "Kasir", "Operator", atau "Resepsionis".
7. Jangan membuat role generik "Admin". Jika maksudnya akses sistem, gunakan "${REQUIRED_SYSTEM_ROLE}"; jika maksudnya pekerjaan harian, gunakan nama petugas yang sesuai.
8. Jangan menambahkan Owner atau Manager kecuali dibutuhkan oleh konteks bisnis atau disebutkan pengguna.
9. Hak akses akun staf dan permission harus muncul hanya pada halaman khusus "${REQUIRED_SYSTEM_ROLE}".
`;
}

export function standardizeBriefRoleNames(text: string): string {
  if (!text) return text;

  let standardized = text.replace(
    /(^|\n)(\s*[\*\-]\s*)\*\*Admin\*\*:/gim,
    '$1$2**Super Admin**:'
  );

  if (/(^|\n)\s*[\*\-]\s*\*\*Super Admin\*\*:/i.test(standardized)) return standardized;

  const superAdminBlock = `  * **Super Admin**:
    - Manajemen Sistem (default): section Akun Staf, section Role & Permission, section Konfigurasi Sistem
      * Field Input:
        - [x] Nama / Email Staf (Text)
        - [x] Role dan Permission (Select)
        - [x] Status Akun (Aktif / Nonaktif)
      * Action / Event:
        - [x] onclick: Tambah Akun Staf (Membuat akun staf baru)
        - [x] onclick: Atur Role & Permission (Mengubah hak akses staf)
        - [x] onclick: Nonaktifkan Akun Staf (Menutup akses akun)
    - Alur Proses: Buka "Manajemen Sistem" → Klik "Tambah Akun Staf" → Tetapkan role dan permission → Klik "Simpan Akun"`;

  const roleSectionPattern = /(\-\s*\*\*Job Description[^\n]*\*\*:\s*\n)/i;
  if (roleSectionPattern.test(standardized)) {
    return standardized.replace(roleSectionPattern, `$1${superAdminBlock}\n`);
  }

  return `${standardized}\n\n- **Job Description & Struktur Halaman per Role**:\n${superAdminBlock}`;
}
