import fs from 'fs';
import path from 'path';

// Baca .env.local manual
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

// Simulasi panggilan invokeAIChat dari route.ts
const systemInstruction = `Anda adalah Analis Basis Data & Perancang Skema Data Aplikasi Bisnis.
Tugas Anda: Memperbaiki dan memperbarui Skema Tabel Data berdasarkan koreksi atau masukan pengguna.

ATURAN REVISI (KONSISTEN & KUMULATIF):
1. Baca koreksi pengguna dengan teliti: sesuaikan tabel, field, atau relasi yang diminta.
2. PERTAHANKAN seluruh tabel dan kolom lain yang tidak diminta diubah (KUMULATIF).
3. Pertahankan tipe data manusiawi: "text", "angka", "tanggal", "relasi ke [Tabel]".
4. Format output JSON sama persis dengan format skema data sebelumnya.`;

const currentTables = [
  {
    nama: 'murid',
    keterangan: 'Data murid kursus musik',
    field: [
      { nama: 'id', tipe: 'text', keterangan: 'ID unik murid' },
      { nama: 'nama_lengkap', tipe: 'text', keterangan: 'Nama lengkap murid' },
      { nama: 'telepon', tipe: 'text', keterangan: 'Nomor telepon' }
    ]
  },
  {
    nama: 'jadwal_les',
    keterangan: 'Jadwal les musik',
    field: [
      { nama: 'id', tipe: 'text', keterangan: 'ID unik jadwal' },
      { nama: 'murid_id', tipe: 'relasi ke murid', keterangan: 'Relasi ke murid' }
    ]
  }
];

const userPrompt = `Skema Tabel Data Saat Ini:
${JSON.stringify(currentTables, null, 2)}

Korelasi Saat Ini:
"murid memiliki relasi ke jadwal_les"

Daftar Peran Aktif:
Super Admin, Instruktur Musik, Murid

Koreksi / Penyesuaian Pengguna:
"Tambahkan kolom instrumen_favorit pada tabel murid"

Perbarui dan kembalikan JSON lengkap:`;

async function runDirect() {
  const fallbackKey = process.env.OPENAI_API_KEY;
  console.log('Sending direct request to OpenAI...');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${fallbackKey}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 4000
    })
  });

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content || '';
  console.log('--- RAW AI RESPONSE ---');
  console.log(raw);
  console.log('------------------------');

  // Coba parse
  const jsonMatch = raw.match(/```(?:json)?([\s\S]*?)```/);
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : raw.trim();
  try {
    const parsed = JSON.parse(jsonStr);
    console.log('Parsed keys:', Object.keys(parsed));
    console.log('Parsed tabel:', JSON.stringify(parsed.tabel, null, 2));
  } catch (e: any) {
    console.error('JSON parse error:', e.message);
  }
}

runDirect();
