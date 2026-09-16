import fs from 'fs';
import * as acorn from 'acorn';

// Baca prompt dan jalankan Gemini generateContent langsung untuk menangkap raw assistantMessage
async function checkRawGeneration() {
  const apiKey = process.env.GEMINI_API_KEY;
  const sessionRaw = fs.readFileSync('scratch/session_kursus_mobil.json', 'utf8');
  const sessionData = JSON.parse(sessionRaw);

  // Buat request POST ke local generate handler tapi tangkap raw assistantMessage
  // Kita bisa import invokeAIChat atau panggil endpoint langsung
  console.log('Menguji direct generate dan memeriksa AST syntax error...');
}

checkRawGeneration();
