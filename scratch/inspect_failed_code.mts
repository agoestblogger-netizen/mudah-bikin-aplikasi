import fs from 'fs';
import { validateAndRepairGeneratedCode } from '../src/lib/codeValidator';

// Periksa apakah ada file html di scratch atau coba parse kode yang baru digenerate
const outputFile = 'scratch/repro_output.json';
if (fs.existsSync(outputFile)) {
  const data = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
  console.log('Repro output summary:', data.replyText);
}
