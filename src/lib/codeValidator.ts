/**
 * AUTOMATED DOM-ALIGNMENT & STATIC CODE VALIDATOR (PRD Bagian 5 & 7, NFR-10b)
 * Memverifikasi keselarasan event handler HTML vs definisi JS serta eksistensi elemen DOM ID.
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

  // 1. Ekstrak JavaScript dari dalam tag <script> di HTML
  let inlineJs = '';
  const scriptMatches = repairedHtml.match(/<script[\s\S]*?>([\s\S]*?)<\/script>/gi);
  if (scriptMatches) {
    inlineJs = scriptMatches.map(s => s.replace(/<\/?script[\s\S]*?>/gi, '')).join('\n');
  } else if (repairedHtml.includes('<script')) {
    const parts = repairedHtml.split(/<script[\s\S]*?>/i);
    inlineJs = parts.slice(1).join('\n').replace(/<\/script>[\s\S]*$/i, '');
  }
  const combinedJs = (inlineJs + '\n' + repairedJs).trim();


  // 1.5 VALIDASI SINTAKS JAVASCRIPT PALING AWAL (PRD NFR-10b / Step 10)
  // Menolak dan menangkap SyntaxError (misal: unexpected identifier, unclosed string, syntax error token)
  if (combinedJs) {
    try {
      // Validasi parsing sintaks JS tanpa mengeksekusi side effects runtime
      new Function(combinedJs);
    } catch (syntaxErr: any) {
      issues.push(`SYNTAX_ERROR: JavaScript SyntaxError pada script: ${syntaxErr.message}`);
    }
  }

  // 2. Pemeriksaan Keselarasan Event Handler (onclick="..." vs JS Function Definitions)
  const onclickFunctionNames: string[] = [];
  const onclickRegex = /onclick=["']\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = onclickRegex.exec(repairedHtml)) !== null) {
    onclickFunctionNames.push(m[1]);
  }

  // Cari semua nama fungsi yang didefinisikan di JS
  const definedFunctions = new Set<string>();
  const funcDefRegex = /(?:function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)|(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:function|\([^)]*\)\s*=>|\w+\s*=>)|window\.([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:function|\([^)]*\)\s*=>|\w+\s*=>)|([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*function)/g;
  while ((m = funcDefRegex.exec(combinedJs)) !== null) {
    const fnName = m[1] || m[2] || m[3] || m[4];
    if (fnName) definedFunctions.add(fnName);
  }


  // Peta alias umum (misal: AI menulis showTab di onclick tapi switchTab di JS, atau bukaModal vs openModal)
  const commonAliases: Record<string, string[]> = {
    'showTab': ['switchTab', 'gantiTab', 'pindahTab', 'changeTab', 'selectTab', 'openTab'],
    'switchTab': ['showTab', 'gantiTab', 'pindahTab', 'changeTab', 'selectTab', 'openTab'],
    'gantiTab': ['showTab', 'switchTab', 'pindahTab', 'changeTab', 'selectTab', 'openTab'],
    'switchRole': ['gantiRole', 'toggleRole', 'changeRole', 'setRole', 'pilihRole'],
    'gantiRole': ['switchRole', 'toggleRole', 'changeRole', 'setRole', 'pilihRole'],
    'tutupModalForm': ['closeModal', 'tutupModal', 'closeModalForm', 'hideModal', 'batalForm'],
    'tutupModal': ['closeModal', 'tutupModalForm', 'closeModalForm', 'hideModal'],
    'tutupModalHapus': ['closeModalHapus', 'tutupModal', 'closeModal', 'batalHapus'],
    'bukaModalTambah': ['openModalTambah', 'tambahItem', 'bukaModal', 'showAddModal', 'tambahOrder', 'tambahData'],
    'bukaModalEdit': ['openModalEdit', 'editItem', 'bukaModal', 'showEditModal', 'editOrder', 'editData'],
    'bukaModal': ['openModal', 'bukaModalTambah', 'bukaModalEdit', 'showModal'],
    'simpanForm': ['simpanData', 'simpanPesanan', 'simpanOrder', 'simpanItem', 'submitForm', 'saveData', 'saveForm', 'handleSimpan', 'tambahItem', 'tambahOrder'],
    'simpanData': ['simpanForm', 'simpanPesanan', 'simpanOrder', 'simpanItem', 'submitForm', 'saveData', 'saveForm', 'tambahItem', 'tambahOrder'],
    'eksekusiHapus': ['hapusItem', 'hapusData', 'hapusOrder', 'deleteItem', 'confirmHapus', 'konfirmasiHapus'],
    'hapusData': ['eksekusiHapus', 'hapusItem', 'hapusOrder', 'deleteItem'],
    'updateStatusCuci': ['updateStatus', 'gantiStatus', 'ubahStatus', 'setStatus'],
    'cariResi': ['lacakResi', 'cariStatus', 'lacakPesanan', 'cariData', 'lacakOrder'],
    'lacakResi': ['cariResi', 'cariStatus', 'lacakPesanan', 'cariData', 'lacakOrder'],
    'showToast': ['toast', 'notifikasi', 'tampilkanToast', 'showNotification']
  };


  onclickFunctionNames.forEach(fn => {
    // Abaikan fungsi bawaan seperti event.preventDefault, console.log, dll
    if (['preventDefault', 'stopPropagation', 'alert', 'confirm', 'prompt', 'render'].includes(fn)) return;
    if (!definedFunctions.has(fn)) {
      // Cek apakah ada alias yang cocok dengan fungsi nyata yang sudah terdefinisi di script
      let resolved = false;
      const aliases = commonAliases[fn] || [];
      for (const alias of aliases) {
        if (definedFunctions.has(alias)) {
          // Rekonsiliasi alias valid: arahkan panggilan ke fungsi nyata yang memang ada
          if (repairedHtml.includes('</script>')) {
            repairedHtml = repairedHtml.replace('</script>', `\nfunction ${fn}(...args) { if (typeof ${alias} === 'function') ${alias}(...args); }\n</script>`);
            definedFunctions.add(fn);
            resolved = true;
            break;
          }
        }
      }

      // Rekonsiliasi semantik cerdas berbasis kata kerja aksi (HANYA jika fungsi nyata yang relevan ada di script)
      if (!resolved) {
        const actionPrefixes = ['simpan', 'hapus', 'bukaModal', 'tutupModal', 'update', 'lacak', 'cari', 'tambah', 'filter'];
        for (const prefix of actionPrefixes) {
          if (fn.toLowerCase().startsWith(prefix.toLowerCase())) {
            for (const defFn of Array.from(definedFunctions)) {
              const defLower = defFn.toLowerCase();
              const prefLower = prefix.toLowerCase();
              if (
                defLower.startsWith(prefLower) ||
                (prefLower === 'bukamodal' && defLower.startsWith('openmodal')) ||
                (prefLower === 'tutupmodal' && defLower.startsWith('closemodal')) ||
                (prefLower === 'simpan' && (defLower.startsWith('save') || defLower.startsWith('submit'))) ||
                (prefLower === 'hapus' && (defLower.startsWith('delete') || defLower.startsWith('remove')))
              ) {
                if (repairedHtml.includes('</script>')) {
                  repairedHtml = repairedHtml.replace('</script>', `\nfunction ${fn}(...args) { if (typeof ${defFn} === 'function') ${defFn}(...args); }\n</script>`);
                  definedFunctions.add(fn);
                  resolved = true;
                  break;
                }
              }
            }
          }
          if (resolved) break;
        }
      }


      // Jika tidak ada fungsi nyata yang cocok, WAJIB catat sebagai issue agar memicu NFR-10b AI Auto-Recovery (DILARANG STUBBING KOSONG)
      if (!resolved) {
        issues.push(`MISMATCH_HANDLER: Fungsi "${fn}" dipanggil di onclick HTML tetapi TIDAK didefinisikan di dalam tag <script>.`);
      }
    }
  });

  // 3. Pemeriksaan Keselarasan DOM ID (document.getElementById('xyz') vs HTML id="xyz")
  const referencedElementIds: string[] = [];
  const getElemIdRegex = /document\.getElementById\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
  while ((m = getElemIdRegex.exec(combinedJs)) !== null) {
    referencedElementIds.push(m[1]);
  }

  const existingHtmlIds = new Set<string>();
  const htmlIdRegex = /id=["']([^"']+)["']/g;
  while ((m = htmlIdRegex.exec(repairedHtml)) !== null) {
    existingHtmlIds.add(m[1]);
  }

  referencedElementIds.forEach(elemId => {
    if (!existingHtmlIds.has(elemId)) {
      if (elemId === 'toastNotification' || elemId.toLowerCase().includes('toast')) {
        if (repairedHtml.includes('</body>')) {
          repairedHtml = repairedHtml.replace('</body>', `  <div id="${elemId}" class="toast"></div>\n</body>`);
        } else {
          repairedHtml += `\n<div id="${elemId}" class="toast"></div>`;
        }
        existingHtmlIds.add(elemId);
      } else {
        issues.push(`MISMATCH_DOM_ID: JavaScript memanggil document.getElementById('${elemId}'), tetapi elemen dengan id="${elemId}" TIDAK ditemukan di struktur HTML.`);
      }
    }
  });

  // 4. Deteksi Kritis: Aksi Tertukar (Action Swap Detector)
  // Mencegah tombol Edit memanggil fungsi hapus, atau tombol Hapus memanggil fungsi edit
  const editButtonHapusRegex = /<button[^>]*onclick=["'][^"']*(?:hapus|delete|remove)[^"']*["'][^>]*>\s*(?:<[^>]+>\s*)*(?:Edit|Ubah)/gi;
  if (editButtonHapusRegex.test(repairedHtml)) {
    issues.push(`CRITICAL_ACTION_SWAP: Terdeteksi tombol dengan teks "Edit" memanggil fungsi HAPUS!`);
  }

  const hapusButtonEditRegex = /<button[^>]*onclick=["'][^"']*(?:edit|ubah|update|showEdit)[^"']*["'][^>]*>\s*(?:<[^>]+>\s*)*(?:Hapus|Delete)/gi;
  if (hapusButtonEditRegex.test(repairedHtml)) {
    issues.push(`CRITICAL_ACTION_SWAP: Terdeteksi tombol dengan teks "Hapus" memanggil fungsi EDIT!`);
  }

  // 5. Auto-Inject Styling untuk Tombol Aksi Tabel (Mencegah tombol polos default)
  // Pastikan tombol Edit memiliki class="btn-secondary" jika belum ada
  repairedHtml = repairedHtml.replace(/<button(?![^>]*class=)([^>]*onclick=["'][^"']*(?:edit|ubah|showEdit)[^"']*["'][^>]*)>/gi, '<button class="btn-secondary"$1>');
  // Pastikan tombol Hapus memiliki class="btn-danger" jika belum ada
  repairedHtml = repairedHtml.replace(/<button(?![^>]*class=)([^>]*onclick=["'][^"']*(?:hapus|delete|remove|openModal)[^"']*["'][^>]*)>/gi, '<button class="btn-danger"$1>');

  // 4. Perbaikan Otomatis Perbandingan ID (Stringified Guard)
  // Ubah `item.id !== id` atau `item.id != id` menjadi `String(item.id) !== String(id)`
  if (repairedHtml.includes('.id !==') || repairedHtml.includes('.id !=') || repairedHtml.includes('.id ===') || repairedHtml.includes('.id ==')) {
    repairedHtml = repairedHtml.replace(/(\w+)\.id\s*!==\s*([a-zA-Z0-9_$]+)/g, 'String($1.id) !== String($2)');
    repairedHtml = repairedHtml.replace(/(\w+)\.id\s*===\s*([a-zA-Z0-9_$]+)/g, 'String($1.id) === String($2)');
  }

  // 5. Cek & Perbaiki Larangan `confirm()`, `alert()`, dan `prompt()` (PRD Bagian 7)
  const forbiddenApis = ['confirm(', 'alert(', 'prompt('];
  forbiddenApis.forEach((api) => {
    if (repairedHtml.includes(api) || repairedJs.includes(api)) {
      repairedHtml = repairedHtml.replace(/if\s*\(\s*!*confirm\([^)]*\)\s*\)\s*return;/g, '// confirm bypassed');
      repairedHtml = repairedHtml.replace(/confirm\([^)]*\)/g, 'true');
      repairedHtml = repairedHtml.replace(/alert\(([^)]*)\)/g, 'console.log("Notifikasi:", $1)');
      repairedHtml = repairedHtml.replace(/prompt\(([^)]*)\)/g, '""');
    }
  });

  // 6. Sanitasi Larangan jQuery `:contains()` dan querySelector pada atribut `[onclick=...]`
  if (repairedHtml.includes(':contains(') || repairedJs.includes(':contains(')) {
    repairedHtml = repairedHtml.replace(/document\.querySelector\([^)]*:contains[^)]*\)\.classList\.add\([^)]*\);?/g, '// active tab handled cleanly');
    repairedJs = repairedJs.replace(/document\.querySelector\([^)]*:contains[^)]*\)\.classList\.add\([^)]*\);?/g, '// active tab handled cleanly');
  }
  if (repairedHtml.includes('[onclick=') || repairedJs.includes('[onclick=')) {
    repairedHtml = repairedHtml.replace(/document\.querySelector\([^)]*\[onclick=[^)]*\)\.classList\.add\([^)]*\);?/g, '// active tab highlight sanitized');
    repairedJs = repairedJs.replace(/document\.querySelector\([^)]*\[onclick=[^)]*\)\.classList\.add\([^)]*\);?/g, '// active tab highlight sanitized');
  }

  // 7. Defensive Null-Safety Transformer: Ubah akses classList langsung menjadi safe optional chaining (?.) dan amankan .style
  repairedHtml = repairedHtml.replace(/\?\.\s*style/g, '.style');
  repairedJs = repairedJs.replace(/\?\.\s*style/g, '.style');
  repairedHtml = repairedHtml.replace(/document\.getElementById\(([^)]+)\)\.classList/g, 'document.getElementById($1)?.classList');
  repairedHtml = repairedHtml.replace(/document\.querySelector\(([^)]+)\)\.classList/g, 'document.querySelector($1)?.classList');
  repairedJs = repairedJs.replace(/document\.getElementById\(([^)]+)\)\.classList/g, 'document.getElementById($1)?.classList');
  repairedJs = repairedJs.replace(/document\.querySelector\(([^)]+)\)\.classList/g, 'document.querySelector($1)?.classList');

  // 8. Defensive Icon & Resource Safety: Pastikan pemanggilan lucide.createIcons() aman jika CDN sedang loading
  repairedHtml = repairedHtml.replace(/lucide\.createIcons\(\);?/g, 'if (typeof lucide !== "undefined" && lucide?.createIcons) lucide.createIcons();');
  repairedJs = repairedJs.replace(/lucide\.createIcons\(\);?/g, 'if (typeof lucide !== "undefined" && lucide?.createIcons) lucide.createIcons();');

  // 9. Pastikan Anti-Reload pada Form
  if (repairedHtml.includes('<form') && !repairedHtml.includes('preventDefault')) {
    repairedHtml = repairedHtml.replace(/<form([^>]*)>/gi, (match) => {
      if (match.includes('onsubmit')) return match;
      return match.replace('<form', '<form onsubmit="event.preventDefault();"');
    });
  }
  repairedHtml = repairedHtml.replace(/<button(?![^>]*type=)([^>]*)>/gi, '<button type="button"$1>');

  // 10. Pemeriksaan Integritas Pembatasan Akses Role Switcher (Section 13)
  // Jika kode memiliki variabel/fungsi terkait role, pastikan ada logika kondisional yang membatasi tampilan (style.display, hidden, dsb)
  const hasRoleLogic = /currentRole|userRole|activeRole|switchRole|toggleRole|gantiRole|changeRole/i.test(combinedJs);
  if (hasRoleLogic) {
    const hasRoleConditionInJs = /currentRole\s*===|userRole\s*===|activeRole\s*===|role\s*===|switchRole\s*\(|toggleRole\s*\(/i.test(combinedJs);
    const hasRoleVisibilityControl = /style\.display|\.classList\.(?:add|remove|toggle)|\.hidden|disabled\s*=/i.test(combinedJs);
    
    if (hasRoleConditionInJs && !hasRoleVisibilityControl) {
      issues.push(`ROLE_GATING_MISSING: Terdeteksi variabel/fungsi Role Switcher, tetapi TIDAK ADA logika kondisional yang membatasi visibilitas tab atau tombol aksi secara nyata.`);
    }
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
