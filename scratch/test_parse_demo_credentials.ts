import { expect } from 'expect';

interface DemoAccountItem {
  role: string;
  username: string;
  password: string;
  access?: string;
  isPublic?: boolean;
}

export function parseDemoCredentials(text: string): {
  cleanText: string;
  accounts: DemoAccountItem[];
  publicRoleNote?: string;
} | null {
  if (!text) return null;

  const accounts: DemoAccountItem[] = [];
  let publicRoleNote: string | undefined;

  // Cek apakah ada bagian kredensial/akun demo
  const hasCredsMarker = /🔑\s*(?:\*\*)?(?:Akun Demo|Petunjuk Akses|Kredensial Login)/i.test(text) ||
    /\|\s*Peran\s*(?:\(Role\))?\s*\|\s*Username\s*\|\s*Password\s*\|/i.test(text);

  if (!hasCredsMarker) return null;

  // Ekstrak public note jika ada
  const publicNoteMatch = text.match(/>\s*ℹ️\s*\*?([^\n\*]+(?:akses publik[^\n\*]*|tanpa login[^\n\*]*))\*?/i);
  if (publicNoteMatch) {
    publicRoleNote = publicNoteMatch[1].replace(/^[>\s*]+|[*\s]+$/g, '').trim();
  }

  // 1. Coba parse format Tabel Markdown
  const tableRowRegex = /\|\s*(?:\*\*)?([^\n\|]+?)(?:\*\*)?\s*\|\s*`?([^\n\|`]+?)`?\s*\|\s*`?([^\n\|`]+?)`?\s*\|\s*([^\n\|]+?)\s*\|/g;
  let match: RegExpExecArray | null;
  while ((match = tableRowRegex.exec(text)) !== null) {
    const rawRole = match[1].replace(/\*\*/g, '').trim();
    const rawUser = match[2].trim();
    const rawPass = match[3].trim();
    const rawAccess = match[4].trim();

    // Skip header dan separator
    if (/^(?:Peran|Role|---|:---)/i.test(rawRole) || /^(?:Username|---|:---)/i.test(rawUser)) {
      continue;
    }

    const isPublic = /tanpa login/i.test(rawUser) || /tanpa login/i.test(rawPass) || /akses publik/i.test(rawAccess);

    accounts.push({
      role: rawRole,
      username: isPublic ? '(Tanpa Login)' : rawUser,
      password: isPublic ? '(Tanpa Login)' : rawPass,
      access: rawAccess,
      isPublic
    });
  }

  // 2. Jika tabel tidak ditemukan, coba parse bullet points
  if (accounts.length === 0) {
    const bulletRegex = /[•\*\-]\s*(?:\*\*)?([^\n:\*]+)(?:\*\*)?\s*:\s*username\s*`?([a-zA-Z0-9_-]+)`?\s*\/\s*password\s*`?([^\s`]+)`?/gi;
    let bm: RegExpExecArray | null;
    while ((bm = bulletRegex.exec(text)) !== null) {
      accounts.push({
        role: bm[1].trim(),
        username: bm[2].trim(),
        password: bm[3].trim(),
        access: 'Akses Sistem',
        isPublic: false
      });
    }
  }

  if (accounts.length === 0) return null;

  // Hapus blok kredensial dari teks pesan utama agar tidak dobel render teks berantakan
  const splitIndex = text.search(/🔑\s*(?:\*\*)?(?:Akun Demo|Petunjuk Akses|Kredensial Login)/i);
  let cleanText = text;
  if (splitIndex !== -1) {
    cleanText = text.substring(0, splitIndex).trim();
  } else {
    // Potong mulai dari tabel jika marker tidak ketemu
    const tableIndex = text.search(/\|\s*Peran/i);
    if (tableIndex !== -1) {
      cleanText = text.substring(0, tableIndex).trim();
    }
  }

  return { cleanText, accounts, publicRoleNote };
}

// Test Sample 1: Markdown Table
const sample1 = `✨ **Prototipe aplikasi berhasil dibuat dan dimuat langsung ke Canvas Preview.**

🔑 **Akun Demo & Kredensial Login (Username & Password):**
Silakan gunakan akun demo di bawah ini untuk mencoba prototipe pada Canvas Preview:

> ℹ️ *Aplikasi ini dibuka pertama kali di halaman **Warga** (akses publik tanpa login). Untuk mencoba fitur staf/pengelola, silakan login dengan akun berikut:*

| Peran (Role) | Username | Password | Hak Akses |
| :--- | :--- | :--- | :--- |
| **Admin Ronda** | \`adminronda\` | \`adminronda123\` | Akses Penuh (Kelola data & laporan) |
| **Petugas Ronda** | \`petugasronda\` | \`petugasronda123\` | Akses Operasional & input data |
| **Warga** | *(Tanpa Login)* | *(Tanpa Login)* | Akses Publik (Tampilan Awal) |

💡 *Tips: Anda juga dapat langsung mengklik tombol role login instan (Quick Login) yang tersedia pada layar login aplikasi.*`;

const res1 = parseDemoCredentials(sample1);
console.log('Result 1:', JSON.stringify(res1, null, 2));

// Test Sample 2: Bullet Points
const sample2 = `✨ **Prototipe selesai!**

🔑 **Petunjuk Akses & Akun Demo:**
- Masuk ke aplikasi menggunakan salah satu akun demo berikut:
  * **Admin**: username \`admin\` / password \`admin123\`
  * **Kasir**: username \`kasir\` / password \`kasir123\``;

const res2 = parseDemoCredentials(sample2);
console.log('Result 2:', JSON.stringify(res2, null, 2));
