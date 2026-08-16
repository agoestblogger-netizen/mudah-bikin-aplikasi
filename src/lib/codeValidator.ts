/**
 * AUTOMATED STATIC CODE VALIDATOR (PRD Bagian 5 & 7)
 * Memverifikasi & memperbaiki kode JavaScript/HTML sebelum disajikan ke pengguna.
 */

export interface ValidationReport {
  isValid: boolean;
  issues: string[];
  repairedCode: {
    html: string;
    css: string;
    js: string;
  };
}

export function validateAndRepairGeneratedCode(
  html: string,
  css: string,
  js: string
): ValidationReport {
  const issues: string[] = [];
  let repairedHtml = html;
  let repairedJs = js;

  // 1. Ekstrak JavaScript dari dalam tag <script> di HTML jika ada
  let inlineJs = '';
  const scriptMatches = repairedHtml.match(/<script[\s\S]*?>([\s\S]*?)<\/script>/gi);
  if (scriptMatches) {
    inlineJs = scriptMatches.map(s => s.replace(/<\/?script[\s\S]*?>/gi, '')).join('\n');
  }

  const combinedJs = (inlineJs + '\n' + repairedJs).trim();

  // 2. Cek & Perbaiki Larangan `confirm()`, `alert()`, dan `prompt()` (PRD Bagian 7 Syarat 3b)
  const forbiddenApis = ['confirm(', 'alert(', 'prompt('];
  forbiddenApis.forEach((api) => {
    if (repairedHtml.includes(api) || repairedJs.includes(api)) {
      issues.push(`Ditemukan pemanggilan API bawaan browser berisiko: ${api}`);
      
      // Sanitasi di dalam HTML
      repairedHtml = repairedHtml.replace(/if\s*\(\s*!*confirm\([^)]*\)\s*\)\s*return;/g, '// confirm bypassed');
      repairedHtml = repairedHtml.replace(/confirm\([^)]*\)/g, 'true');
      repairedHtml = repairedHtml.replace(/alert\(([^)]*)\)/g, 'console.log("Notifikasi:", $1)');
      repairedHtml = repairedHtml.replace(/prompt\(([^)]*)\)/g, '""');

      // Sanitasi di dalam JS terpisah
      repairedJs = repairedJs.replace(/if\s*\(\s*!*confirm\([^)]*\)\s*\)\s*return;/g, '// confirm bypassed');
      repairedJs = repairedJs.replace(/confirm\([^)]*\)/g, 'true');
      repairedJs = repairedJs.replace(/alert\(([^)]*)\)/g, 'console.log("Notifikasi:", $1)');
      repairedJs = repairedJs.replace(/prompt\(([^)]*)\)/g, '""');
    }
  });

  // 3. Cek form submit yang berpotensi me-reload iframe tanpa preventDefault
  if (repairedHtml.includes('<form') && !repairedHtml.includes('preventDefault')) {
    // Ubah form onsubmit untuk mencegah reload halaman iframe
    repairedHtml = repairedHtml.replace(/<form([^>]*)>/gi, (match) => {
      if (match.includes('onsubmit')) {
        return match;
      }
      return match.replace('<form', '<form onsubmit="event.preventDefault();"');
    });
  }

  // 4. Pastikan tombol di dalam form default ke type="button" agar tidak reload
  repairedHtml = repairedHtml.replace(/<button(?![^>]*type=)([^>]*)>/gi, '<button type="button"$1>');

  return {
    isValid: issues.length === 0,
    issues,
    repairedCode: {
      html: repairedHtml,
      css,
      js: repairedJs // JANGAN inject stub function dummy yang menimpa fungsi asli!
    }
  };
}
