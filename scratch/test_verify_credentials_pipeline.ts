import { parseDemoCredentials } from '../src/components/DemoCredentialsCard';

// Simulasi teks respons yang dihasilkan oleh AI setelah membuat prototipe
const simulatedResponseWithTable = `✨ **Prototipe aplikasi berhasil dibuat dan dimuat langsung ke Canvas Preview.**

🔑 **Akun Demo & Kredensial Login (Username & Password):**
Silakan gunakan akun demo di bawah ini untuk mencoba prototipe pada Canvas Preview:

> ℹ️ *Aplikasi ini dibuka pertama kali di halaman **Warga** (akses publik tanpa login). Untuk mencoba fitur staf/pengelola, silakan login dengan akun berikut:*

| Peran (Role) | Username | Password | Hak Akses |
| :--- | :--- | :--- | :--- |
| **Admin Kelurahan** | \`adminkelurahan\` | \`adminkelurahan123\` | Akses Penuh (Kelola jadwal & warga) |
| **Petugas Ronda** | \`petugasronda\` | \`petugasronda123\` | Akses Operasional & presensi |
| **Warga** | *(Tanpa Login)* | *(Tanpa Login)* | Akses Publik (Tampilan Awal) |

💡 *Tips: Anda juga dapat langsung mengklik tombol role login instan (Quick Login) yang tersedia pada layar login aplikasi.*`;

const parsed = parseDemoCredentials(simulatedResponseWithTable);
console.log('Parsed credentials check:');
console.log('Clean Text:', parsed?.cleanText);
console.log('Accounts Count:', parsed?.accounts.length);
console.log('Accounts:', parsed?.accounts);
console.log('Public Note:', parsed?.publicRoleNote);

if (!parsed || parsed.accounts.length !== 3) {
  throw new Error('Test failed: Expected 3 accounts parsed!');
}
console.log('✅ TEST PASSED: Parsing credentials card works perfectly!');
