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

  // 1. Cek & Perbaiki Larangan `confirm()`, `alert()`, dan `prompt()` (PRD Bagian 7 Syarat 3b)
  const forbiddenApis = ['confirm(', 'alert(', 'prompt('];
  forbiddenApis.forEach((api) => {
    if (repairedJs.includes(api)) {
      issues.push(`Ditemukan pemanggilan API bawaan browser berisiko: ${api}`);
      // Replace confirm(...) dengan true (skip confirm dialog iframe)
      if (api === 'confirm(') {
        repairedJs = repairedJs.replace(/if\s*\(\s*!*confirm\([^)]*\)\s*\)\s*return;/g, '// confirm dialog replaced for iframe safety');
        repairedJs = repairedJs.replace(/confirm\([^)]*\)/g, 'true');
      }
      if (api === 'alert(') {
        repairedJs = repairedJs.replace(/alert\(([^)]*)\)/g, 'console.log("Notifikasi:", $1)');
      }
    }
  });

  // 2. Cek `.filter()` / `.map()` tanpa reassign ke variabel state (PRD Bagian 5 Validasi Otomatis)
  const filterMatches = repairedJs.match(/(\w+)\.filter\(/g);
  if (filterMatches) {
    filterMatches.forEach((m) => {
      const varName = m.split('.')[0];
      const reassignPattern = new RegExp(`${varName}\\s*=\\s*${varName}\\.filter`);
      if (!reassignPattern.test(repairedJs)) {
        issues.push(`Variabel state "${varName}" di-filter tetapi hasilnya tidak di-assign ulang.`);
      }
    });
  }

  // 3. Cek fungsi onclick pada HTML dipastikan ada definisinya di JS
  const onclickMatches = repairedHtml.match(/onclick=["'](\w+)\(/g);
  if (onclickMatches) {
    onclickMatches.forEach((match) => {
      const funcName = match.replace(/onclick=["']/, '').replace('(', '');
      const funcDefPattern = new RegExp(`function\\s+${funcName}|const\\s+${funcName}\\s*=|let\\s+${funcName}\\s*=`);
      if (!funcDefPattern.test(repairedJs)) {
        issues.push(`Fungsi "${funcName}" dipanggil pada atribut onclick tetapi tidak ditemukan di kode JavaScript.`);
        // Auto-fix stub definition
        repairedJs += `\nfunction ${funcName}() { console.warn("Stub auto-fix for ${funcName}"); }`;
      }
    });
  }

  // 4. Cek fungsi render dipanggil di dalam fungsi mutasi
  if (repairedJs.includes('function delete') && !repairedJs.includes('render')) {
    issues.push('Fungsi penghapusan item tidak memanggil fungsi render di dalamnya.');
  }

  return {
    isValid: issues.length === 0,
    issues,
    repairedCode: {
      html: repairedHtml,
      css,
      js: repairedJs
    }
  };
}
