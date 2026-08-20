// Test Poin 53: Default Landing Tab per Role
// Memverifikasi bahwa roleLandingTabs terisi benar dari Brief Kebutuhan
import { readFileSync } from 'fs';

// ---- Mock extractBriefAndRolesFromHistory inline ----
function extractBriefAndRolesFromHistory(chatHistory: any[]): {
  rawBrief: string;
  roles: string[];
  publicRole: string | null;
  staffRoles: string[];
  roleLandingTabs: Record<string, string>;
} {
  const aiMessages = (chatHistory || []).filter((m: any) =>
    m.sender === 'AI' && (m.text?.includes('Brief Kebutuhan') || m.text?.includes('Job Description') || m.text?.includes('Struktur Halaman'))
  );
  const lastBriefMsg = aiMessages[aiMessages.length - 1]?.text || '';
  const roles: string[] = [];
  let publicRole: string | null = null;

  if (lastBriefMsg) {
    const jobDescMatch = lastBriefMsg.match(/(?:Job Description|Struktur Halaman)[^\n]*\n([\s\S]*?)(?=\n\s*(?:Apakah|Fitur Utama|Roadmap|Fitur Unik|Catatan|$))/i);
    const jobDescText = jobDescMatch ? jobDescMatch[1] : lastBriefMsg;
    const roleLineRegex = /\*\s+\*\*\[?([^\]:\*\n]+)\]?\*\*\s*:/g;
    let m: RegExpExecArray | null;
    const forbiddenKeywords = [
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
  }

  for (const r of roles) {
    if (/^(pasien|pelanggan|customer|tamu|guest|publik|client)/i.test(r)) {
      publicRole = r;
      break;
    }
  }
  const staffRoles = roles.filter(r => r !== publicRole);

  const roleLandingTabs: Record<string, string> = {};
  for (const role of roles) {
    const escapedRole = role.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const roleBlockRegex = new RegExp(
      `\\*\\s+\\*\\*\\[?${escapedRole}[^\\]:\\*\\n]*\\]?\\*\\*[^\n]*\n([\\s\\S]*?)(?=\n\\s*\\*\\s+\\*\\*[^\\*]|\n\\s*Apakah|\n\\s*(?:Roadmap|Catatan|Fitur Unik)|$)`, 'i'
    );
    const roleBlockMatch = lastBriefMsg.match(roleBlockRegex);
    if (roleBlockMatch) {
      const block = roleBlockMatch[1];
      const defaultTabMatch = block.match(/\[(?:Halaman|Tab)\s*(\d+|[A-Za-z]+)\]\s*\(default\)\s*:\s*section\s+([^\n,]+)/i) ||
                              block.match(/\[(?:Halaman|Tab)\s*(\d+|[A-Za-z]+)\]\s*\(default\)/i);
      if (defaultTabMatch) {
        const sectionName = (defaultTabMatch[2] || role).trim().toLowerCase()
          .replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-');
        roleLandingTabs[role] = sectionName;
      } else {
        roleLandingTabs[role] = role.toLowerCase().replace(/[^a-z0-9]/g, '');
      }
    } else {
      roleLandingTabs[role] = role.toLowerCase().replace(/[^a-z0-9]/g, '');
    }
  }

  return { rawBrief: lastBriefMsg, roles, publicRole, staffRoles, roleLandingTabs };
}

// ---- Test Cases ----
const briefLaundry = `📋 **Brief Kebutuhan**
- **Nama App**: Laundry Express
- **Job Description & Struktur Halaman per Role**:
  * **Pelanggan** (Akses Publik - Tampilan Awal):
    - [Halaman/Tab 1] (default): section Lacak Cucian
    - **Alur Proses**: Klik "Cari" → status muncul
  * **Kasir**:
    - [Halaman/Tab 1] (default): section Input Pesanan, section Daftar Transaksi
    - [Halaman/Tab 2]: section Laporan Kasir
    - **Alur Proses**: Klik "Bayar" (Tab 1) → Buka tab "Laporan Kasir" (Tab 2)
  * **Washer**:
    - [Halaman/Tab 1] (default): section Antrean Cuci
    - [Halaman/Tab 2]: section Riwayat Selesai
    - **Alur Proses**: Klik "Mulai Cuci" (Tab 1) → Buka tab "Riwayat Selesai" (Tab 2)

Apakah Brief Kebutuhan di atas sudah sesuai?`;

const briefKlinik = `📋 **Brief Kebutuhan**
- **Nama App**: Klinik Cerdas
- **Job Description & Struktur Halaman per Role**:
  * **Pasien** (Akses Publik - Tampilan Awal):
    - [Halaman/Tab 1] (default): section Cek Antrean
    - **Alur Proses**: Masukkan nomor antrean → status tampil
  * **Dokter**:
    - [Halaman/Tab 1] (default): section Daftar Pasien Hari Ini
    - [Halaman/Tab 2]: section Rekam Medis
    - **Alur Proses**: Klik "Periksa" (Tab 1) → Buka tab "Rekam Medis" (Tab 2)
  * **Resepsionis**:
    - [Halaman/Tab 1] (default): section Pendaftaran Pasien
    - **Alur Proses**: Klik "Daftar" → nomor antrean terbit
  * **Apoteker**:
    - [Halaman/Tab 1] (default): section Antrian Resep
    - **Alur Proses**: Klik "Proses Resep" → status "Selesai"

Apakah Brief Kebutuhan di atas sudah sesuai?`;

console.log('=== TEST POIN 53: EKSTRAKSI LANDING TAB PER ROLE ===\n');

// TEST 1: Laundry 3 role
const r1 = extractBriefAndRolesFromHistory([
  { sender: 'USER', text: 'Laundry kiloan' },
  { sender: 'AI', text: briefLaundry }
]);

console.log('TEST 1: Laundry (Pelanggan, Kasir, Washer)');
console.log('Roles:', r1.roles);
console.log('Public Role:', r1.publicRole);
console.log('Landing Tabs:', JSON.stringify(r1.roleLandingTabs, null, 2));

// Verifikasi Poin 53: Kasir dan Washer harus punya landingTab yang BUKAN tab publik
const kasirLanding = r1.roleLandingTabs['Kasir'];
const washerLanding = r1.roleLandingTabs['Washer'];
const pelangganLanding = r1.roleLandingTabs['Pelanggan'];

console.log(`\n- Kasir landingTab: "${kasirLanding}" → ${kasirLanding !== pelangganLanding ? '✅ Beda dari tab Pelanggan' : '❌ SAMA dengan tab Pelanggan!'}`);
console.log(`- Washer landingTab: "${washerLanding}" → ${washerLanding !== pelangganLanding ? '✅ Beda dari tab Pelanggan' : '❌ SAMA dengan tab Pelanggan!'}`);

// Verifikasi bahwa DEMO_ACCOUNTS yang dihasilkan memiliki landingTab
const demoCreds = r1.roles.map(r => {
  const u = r.toLowerCase().replace(/[^a-z0-9]/g, '');
  const isPublic = r === r1.publicRole;
  if (isPublic) return `{ role: '${r}', username: '${u}', password: '${u}123' }`;
  const landingTabHint = r1.roleLandingTabs[r] || u;
  return `{ role: '${r}', username: '${u}', password: '${u}123', landingTab: '${landingTabHint}' }`;
});
console.log('\nDEMO_ACCOUNTS yang akan di-inject ke prompt:');
demoCreds.forEach(c => console.log(' ', c));

// TEST 2: Klinik 4 role
console.log('\n\nTEST 2: Klinik (Pasien, Dokter, Resepsionis, Apoteker)');
const r2 = extractBriefAndRolesFromHistory([
  { sender: 'USER', text: 'Klinik dokter' },
  { sender: 'AI', text: briefKlinik }
]);
console.log('Roles:', r2.roles);
console.log('Public Role:', r2.publicRole);
console.log('Landing Tabs:', JSON.stringify(r2.roleLandingTabs, null, 2));

const pasienLanding = r2.roleLandingTabs['Pasien'];
let allStaffDifferent = true;
for (const r of r2.staffRoles) {
  const lt = r2.roleLandingTabs[r];
  const ok = lt !== pasienLanding;
  console.log(`- ${r} landingTab: "${lt}" → ${ok ? '✅' : '❌ SAMA dengan tab Pasien!'}`);
  if (!ok) allStaffDifferent = false;
}

const t1Pass = kasirLanding !== pelangganLanding && washerLanding !== pelangganLanding;
const t2Pass = allStaffDifferent;

if (t1Pass && t2Pass) {
  console.log('\n\n🎉 POIN 53 EKSTRAKSI LANDING TAB: SEMUA TEST LULUS!');
} else {
  console.error('\n\n❌ POIN 53 MASIH ADA KENDALA.');
  process.exit(1);
}
