/**
 * AUTOMATED DOM-ALIGNMENT & STATIC CODE VALIDATOR (PRD Bagian 5 & 7, NFR-10b)
 * Memverifikasi keselarasan event handler HTML vs definisi JS serta eksistensi elemen DOM ID.
 */

import { cleanConversationalLeaks } from './cleanLeaks';

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
  js: string,
  expectedRoles?: string[]
): ValidationReport {
  const issues: string[] = [];
  let repairedHtml = cleanConversationalLeaks(html);
  let repairedJs = js;

  // 0. Sanitasi Anti-Leak: Buang teks percakapan / markdown
  if (repairedHtml.includes('<!DOCTYPE')) {
    repairedHtml = repairedHtml.slice(repairedHtml.indexOf('<!DOCTYPE')).trim();
  } else if (repairedHtml.includes('<html')) {
    repairedHtml = repairedHtml.slice(repairedHtml.indexOf('<html')).trim();
  }

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
    // POS / Penjualan / Transaksi
    'prosesPenjualan': ['prosesTransaksi', 'simpanTransaksi', 'simpanPesanan', 'checkout', 'bayar', 'selesaiTransaksi', 'selesaikanTransaksi', 'handleCheckout', 'simpanData', 'simpanForm'],
    'prosesTransaksi': ['prosesPenjualan', 'simpanTransaksi', 'simpanPesanan', 'checkout', 'bayar', 'selesaiTransaksi', 'selesaikanTransaksi', 'handleCheckout', 'simpanData', 'simpanForm'],
    'prosesPesanan': ['prosesTransaksi', 'prosesPenjualan', 'simpanPesanan', 'simpanOrder', 'checkout', 'selesaiTransaksi'],
    'prosesBayar': ['bayar', 'checkout', 'prosesPenjualan', 'prosesTransaksi', 'simpanTransaksi'],
    'bayar': ['prosesPenjualan', 'prosesTransaksi', 'checkout', 'selesaiTransaksi', 'simpanTransaksi'],
    'checkout': ['prosesPenjualan', 'prosesTransaksi', 'prosesPesanan', 'bayar', 'selesaiTransaksi', 'simpanTransaksi'],
    'selesaiTransaksi': ['prosesPenjualan', 'prosesTransaksi', 'checkout', 'bayar', 'simpanTransaksi'],
    'selesaikanTransaksi': ['prosesPenjualan', 'prosesTransaksi', 'checkout', 'bayar', 'simpanTransaksi'],
    'cetakStruk': ['cetak', 'printNota', 'printStruk', 'cetakNota', 'downloadInvoice', 'cetakInvoice'],
    'cetakNota': ['cetakStruk', 'cetak', 'printNota', 'printStruk', 'downloadInvoice'],
    'tambahKeranjang': ['tambahItem', 'masukkanKeranjang', 'addToCart', 'tambahProduk'],
    'masukkanKeranjang': ['tambahKeranjang', 'tambahItem', 'addToCart', 'tambahProduk'],
    'hitungTotal': ['updateTotal', 'kalkulasiTotal', 'render', 'hitungKembalian'],
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
        const actionPrefixes = ['simpan', 'hapus', 'bukaModal', 'tutupModal', 'update', 'lacak', 'cari', 'tambah', 'filter', 'proses', 'bayar', 'checkout', 'selesai', 'cetak', 'hitung', 'handle'];
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
                (prefLower === 'hapus' && (defLower.startsWith('delete') || defLower.startsWith('remove'))) ||
                (prefLower === 'proses' && (defLower.startsWith('bayar') || defLower.startsWith('checkout') || defLower.startsWith('simpan') || defLower.startsWith('selesai'))) ||
                (prefLower === 'bayar' && (defLower.startsWith('proses') || defLower.startsWith('checkout') || defLower.startsWith('simpan'))) ||
                (prefLower === 'checkout' && (defLower.startsWith('proses') || defLower.startsWith('bayar') || defLower.startsWith('simpan'))) ||
                (prefLower === 'cetak' && defLower.startsWith('print'))
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


      // Auto-repair untuk eksekusiHapus modal konfirmasi jika belum terdefinisi
      if (!resolved && fn === 'eksekusiHapus' && repairedHtml.includes('</script>')) {
        const fallbackEksekusiHapus = `
function eksekusiHapus() {
  const _getEl = (s) => document.getElementById(s);
  const id = _getEl('hapusId')?.value;
  if (!id) return;
  const arrNames = ['items', 'dataList', 'daftarPesanan', 'daftarProduk', 'orders', 'pesananList', 'pasien', 'antrian', 'members', 'transactions', 'transaksi', 'produk'];
  for (const a of arrNames) {
    try {
      if (typeof window[a] !== 'undefined' && Array.isArray(window[a])) {
        window[a] = window[a].filter(item => String(item?.id ?? item?.kode ?? item?.no ?? '') !== String(id));
      }
    } catch(e) {}
  }
  if (typeof tutupModalHapus === 'function') tutupModalHapus();
  else if (_getEl('modalHapus')) _getEl('modalHapus').style.display = 'none';
  if (typeof render === 'function') render();
  else if (typeof renderTable === 'function') renderTable();
  if (typeof showToast === 'function') showToast('Data berhasil dihapus!', 'success');
}
`;
        repairedHtml = repairedHtml.replace('</script>', `${fallbackEksekusiHapus}\n</script>`);
        definedFunctions.add('eksekusiHapus');
        resolved = true;
      }

      // Jika tidak ada fungsi nyata yang cocok, catat sebagai issue agar memicu NFR-10b AI Auto-Recovery
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
      } else if (elemId === 'hapusId') {
        if (repairedHtml.includes('</body>')) {
          repairedHtml = repairedHtml.replace('</body>', `  <input type="hidden" id="hapusId" value="">\n</body>`);
        } else {
          repairedHtml += `\n<input type="hidden" id="hapusId" value="">`;
        }
        existingHtmlIds.add(elemId);
      } else if (elemId === 'modalHapus') {
        if (repairedHtml.includes('</body>')) {
          repairedHtml = repairedHtml.replace('</body>', `  <div id="modalHapus" class="modal" style="display:none;"></div>\n</body>`);
        } else {
          repairedHtml += `\n<div id="modalHapus" class="modal" style="display:none;"></div>`;
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

  // 10. Pemeriksaan Integritas Pembatasan Akses Role per Tab (Poin 40 — data-access-roles)
  // Jika kode memiliki loginAs() atau multi-role logic, SETIAP .tab-btn WAJIB punya data-access-roles
  const hasLoginAsFunc = /function\s+loginAs\s*\(/.test(combinedJs) || /loginAs\s*=\s*(function|\()/.test(combinedJs);
  const hasMultiRoleLogic = /currentRole|loginAs|filterTabsByRole/i.test(combinedJs);

  const isMultiRoleApp = Boolean(expectedRoles && expectedRoles.length > 1);

  if (hasMultiRoleLogic || hasLoginAsFunc || isMultiRoleApp) {
    // Cek apakah ada fungsi filterTabsByRole
    const hasFilterTabsByRole = /filterTabsByRole\s*\(/.test(combinedJs) ||
                                 /\.getAttribute\s*\(\s*['"]data-access-roles['"]\s*\)/.test(combinedJs);

    // Cari semua tab-btn button
    const tabBtnMatches = [...repairedHtml.matchAll(/<button[^>]*class=[^>]*tab-btn[^>]*>/gi)];
    const tabBtnsWithoutAccessRoles = tabBtnMatches.filter(m => !m[0].includes('data-access-roles'));

    // Poin 54: Jika aplikasi multi-role, WAJIB memiliki navigasi tab untuk memisahkan fitur antar-peran!
    if (isMultiRoleApp && tabBtnMatches.length === 0) {
      issues.push(
        `MULTI_ROLE_MISSING_TABS: Aplikasi multi-role (${expectedRoles!.join(', ')}) WAJIB memiliki navigasi tab (<button class="tab-btn" data-access-roles="...">) untuk masing-masing peran! ` +
        `DILARANG menumpuk seluruh fitur ke dalam satu tampilan statis tanpa pemisahan peran melalui tab.`
      );
    }

    if (tabBtnsWithoutAccessRoles.length > 0) {
      issues.push(
        `ROLE_GATING_MISSING_DATA_ATTR: Ditemukan ${tabBtnsWithoutAccessRoles.length} tombol tab-btn TANPA atribut data-access-roles. ` +
        `WAJIB tambahkan data-access-roles="RoleA,RoleB" pada SETIAP <button class="tab-btn"> ` +
        `agar filterTabsByRole() bekerja generik tanpa hardcoded getElementById. ` +
        `Contoh: data-access-roles="Admin,Dokter"`
      );
    }

    // Poin 55: Pastikan setiap peran resmi memiliki setidaknya 1 tab navigasi khusus
    if (isMultiRoleApp && tabBtnMatches.length > 0) {
      const tabAccessRoles = [...repairedHtml.matchAll(/data-access-roles\s*=\s*['"]([^'"]+)['"]/gi)]
        .flatMap(m => m[1].split(',').map(r => r.trim().toLowerCase()));

      const missingRoleTabs = expectedRoles!.filter(role => {
        const roleLower = role.trim().toLowerCase();
        return !tabAccessRoles.some(ar => ar === roleLower || ar.includes(roleLower) || roleLower.includes(ar));
      });

      if (missingRoleTabs.length > 0) {
        issues.push(
          `ROLE_MISSING_TAB_NAVIGATION: Peran [${missingRoleTabs.join(', ')}] TIDAK memiliki tab khusus dengan data-access-roles="${missingRoleTabs.join(',')}". ` +
          `Setiap peran dalam Brief Kebutuhan WAJIB memiliki tab dan tampilan UI yang relevan dengan Job Description-nya!`
        );
      }

      // Auto-repair cerdas: Ubah label tab peran mentah (misal: "👥 Admin" -> "👥 Kelola Data", "💳 Anggota" -> "🪪 Kartu Anggota Digital")
      for (const role of expectedRoles!) {
        const rLower = role.trim().toLowerCase();
        // Regex cari button tab dengan inner text nama peran (bisa diawali emoji)
        const roleBtnRegex = new RegExp(`(<button[^>]*class=['"][^'"]*tab-btn[^'"]*['"][^>]*>)\\s*([\\p{Emoji}\\p{Extended_Pictographic}\\s]*)${role.trim()}\\s*(<\\/button>)`, 'gui');
        repairedHtml = repairedHtml.replace(roleBtnRegex, (match, openTag, emoji, closeTag) => {
          const cleanEmoji = emoji ? emoji.trim() + ' ' : '';
          if (rLower === 'admin' || rLower === 'superadmin' || rLower === 'pengelola') {
            return `${openTag}${cleanEmoji || '👥 '}Kelola Data${closeTag}`;
          } else if (rLower === 'anggota' || rLower === 'member' || rLower === 'user') {
            return `${openTag}${cleanEmoji || '🪪 '}Kartu Anggota Digital${closeTag}`;
          } else if (rLower === 'kasir') {
            return `${openTag}${cleanEmoji || '🛒 '}Transaksi Penjualan${closeTag}`;
          } else if (rLower === 'dokter') {
            return `${openTag}${cleanEmoji || '🩺 '}Pemeriksaan Pasien${closeTag}`;
          } else {
            return `${openTag}${cleanEmoji}Menu ${role}${closeTag}`;
          }
        });
      }

      // Auto-repair: Hapus tombol switch peran langsung (loginAs) yang ditaruh di dalam appContainer
      const appContainerIdx = repairedHtml.indexOf('id="appContainer"') !== -1 ? repairedHtml.indexOf('id="appContainer"') : repairedHtml.indexOf("id='appContainer'");
      if (appContainerIdx !== -1) {
        const preApp = repairedHtml.substring(0, appContainerIdx);
        let postApp = repairedHtml.substring(appContainerIdx);
        postApp = postApp.replace(/<button[^>]*onclick=['"](?:javascript:)?loginAs\([^)]*\)['"][^>]*>[\s\S]*?<\/button>/gi, '');
        repairedHtml = preApp + postApp;
      }

      // Poin 56 & 57: Pemeriksaan ketat tombol/link berlabel nama peran mentah di dalam appContainer
      const appContainerMatch = repairedHtml.match(/<div[^>]*id=['"]appContainer['"][^>]*>([\s\S]*?)<\/body>/i);
      if (appContainerMatch) {
        const appHtml = appContainerMatch[1];
        const interactiveElements = [...appHtml.matchAll(/<(button|a)([^>]*)>([\s\S]*?)<\/\1>/gi)];

        for (const el of interactiveElements) {
          const attrs = el[2];
          const rawContent = el[3].replace(/<[^>]*>/g, '').trim();

          // Abaikan tombol logout / ganti akun
          if (attrs.includes('logout()') || /keluar|ganti\s*akun/i.test(rawContent)) {
            continue;
          }

          // Abaikan tombol aksi form standar
          if (attrs.includes('tutupModal') || attrs.includes('bukaModal') || /batal|tutup|simpan|hapus|edit|tambah/i.test(rawContent)) {
            continue;
          }

          // Bersihkan emoji, icon, dan simbol
          const cleanText = rawContent.replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim().toLowerCase();

          for (const role of expectedRoles!) {
            const rLower = role.trim().toLowerCase();
            const isPureRoleName = cleanText === rLower ||
                                   cleanText === 'role ' + rLower ||
                                   cleanText === 'peran ' + rLower ||
                                   cleanText === 'menu ' + rLower ||
                                   cleanText === 'tab ' + rLower ||
                                   cleanText === 'halaman ' + rLower;

            if (isPureRoleName) {
              issues.push(
                `ROLE_AS_TAB_LABEL: Ditemukan tombol/link dengan label nama peran mentah "${rawContent}" di dalam halaman aplikasi (#appContainer). ` +
                `DILARANG menamai tombol tab dengan nama peran! Tab di dalam aplikasi adalah NAVIGASI FITUR (contoh: "Kelola Anggota", "Kartu Digital", "Laporan"). ` +
                `Pergantian peran HANYA dilakukan melalui tombol "Keluar / Ganti Akun" yang kembali ke form login.`
              );
            }
          }
        }

        // Cek jika masih ada tombol loginAs di dalam appContainer
        const appLoginAsMatches = [...appHtml.matchAll(/onclick=['"](?:javascript:)?loginAs\(['"]([^'"]+)['"]\)/gi)];
        if (appLoginAsMatches.length > 0) {
          issues.push(
            `FORBIDDEN_ROLE_SWITCHER_IN_APP: Ditemukan tombol ganti peran langsung di dalam halaman aplikasi (appContainer). ` +
            `DILARANG membuat tombol ganti peran / role switcher di dalam halaman aplikasi! ` +
            `Pergantian peran SELURUHNYA HANYA lewat tombol Logout / "Keluar / Ganti Akun" yang mengembalikan pengguna ke #loginScreen.`
          );
        }
      }

      // Poin 58: Isolasi peran (tidak semua tab dibuka untuk semua peran)
      if (tabBtnMatches.length > 1) {
        const allRolesJoined = expectedRoles!.map(r => r.trim().toLowerCase()).sort().join(',');
        const identicalAccessTabs = tabBtnMatches.filter(m => {
          const ar = (m[0].match(/data-access-roles=['"]([^'"]+)['"]/i)?.[1] || '').split(',').map(r => r.trim().toLowerCase()).sort().join(',');
          return ar === allRolesJoined;
        });
        if (identicalAccessTabs.length === tabBtnMatches.length) {
          issues.push(
            `NO_ROLE_ISOLATION: Seluruh tombol tab memiliki data-access-roles="${expectedRoles!.join(',')}". ` +
            `DILARANG mencampur semua peran di setiap tab! Setiap peran WAJIB memiliki tab spesifik miliknya sendiri ` +
            `(misal: Tab Admin untuk kelola data master, Tab Anggota untuk kartu digital & status pribadi).`
          );
        }
      }

      // Auto-repair defensive: Sembunyikan seluruh tombol tab yang punya data-access-roles di markup HTML awal jika belum ada style="display:none"
      repairedHtml = repairedHtml.replace(/<button([^>]*?)>/gi, (match, attrs) => {
        if (!attrs.includes('tab-btn')) return match;
        const accessRolesMatch = attrs.match(/data-access-roles=["']([^"']+)["']/i);
        if (accessRolesMatch) {
          const roles = accessRolesMatch[1].split(',').map((r: string) => r.trim().toLowerCase());
          const hasPublicAccess = roles.some((r: string) => /^(pasien|pelanggan|customer|tamu|guest|publik|client)$/i.test(r));
          if (!hasPublicAccess && !attrs.includes('style=')) {
            return `<button${attrs} style="display: none;">`;
          } else if (!hasPublicAccess && attrs.includes('style="') && !attrs.includes('display: none') && !attrs.includes('display:none')) {
            return `<button${attrs.replace('style="', 'style="display: none; ')}>`;
          }
        }
        return match;
      });

      // Bersihkan wrapper div role-switcher yang kosong jika ada
      repairedHtml = repairedHtml.replace(/<div[^>]*class=['"][^'"]*role(?:-switcher|-buttons)?[^'"]*['"][^>]*>\s*<\/div>/gi, '');
    }

    if (isMultiRoleApp && !hasFilterTabsByRole) {
      issues.push(
        `ROLE_GATING_MISSING_FILTER_FUNC: Aplikasi multi-role WAJIB memiliki fungsi filterTabsByRole(role) di dalam tag <script> ` +
        `yang membaca atribut data-access-roles pada setiap <button class="tab-btn">.`
      );
    }

    if (isMultiRoleApp && !hasLoginAsFunc) {
      issues.push(
        `ROLE_GATING_MISSING_LOGIN_AS: Fungsi loginAs(role) tidak ditemukan di dalam tag <script>. ` +
        `Aplikasi multi-role WAJIB memiliki fungsi loginAs(role) yang memanggil filterTabsByRole(role).`
      );
    }

    if (!hasFilterTabsByRole && tabBtnMatches.length > 0) {
      // Cek apakah ada hardcoded getElementById per tab (pola lama yang rawan regresi)
      const hasHardcodedTabFilter = /getElementById\s*\(\s*['"]tab-btn-/.test(combinedJs);
      if (hasHardcodedTabFilter) {
        issues.push(
          `ROLE_GATING_HARDCODED: Ditemukan pola getElementById('tab-btn-...') hardcoded untuk kontrol tab. ` +
          `WAJIB ganti dengan fungsi filterTabsByRole() generik yang membaca atribut data-access-roles. ` +
          `Ini adalah akar penyebab regresi berulang saat nama tab berbeda antar app.`
        );
      }
    }

    // 10b. Pemeriksaan Kontaminasi Peran & Form Login Produksi (Poin 44 & 45: Single Source of Truth dari Brief Kebutuhan)
    if (expectedRoles && expectedRoles.length > 0) {
      const normalizedExpected = expectedRoles.map(r => r.trim().toLowerCase());
      
      // Ambil semua role yang didefinisikan di JS (DEMO_ACCOUNTS, loginAs, dll) & HTML
      const loginAsCalls = [...repairedHtml.matchAll(/loginAs\(\s*['"]([^'"]+)['"]\s*\)/g)].map(m => m[1].trim());
      const jsLoginAsCalls = [...combinedJs.matchAll(/loginAs\(\s*['"]([^'"]+)['"]\s*\)/g)].map(m => m[1].trim());
      const demoAccountRoles = [...combinedJs.matchAll(/role\s*:\s*['"]([^'"]+)['"]/gi)].map(m => m[1].trim());
      const tabAccessRoles = [...repairedHtml.matchAll(/data-access-roles\s*=\s*['"]([^'"]+)['"]/gi)]
        .flatMap(m => m[1].split(',').map(r => r.trim()));

      const allFoundRoles = [...new Set([...loginAsCalls, ...jsLoginAsCalls, ...demoAccountRoles, ...tabAccessRoles])];

      // Deteksi role asing / tercemar (misal: Washer / Kasir / Admin di app klinik)
      allFoundRoles.forEach(foundRole => {
        if (!foundRole) return;
        const isMatched = normalizedExpected.some(exp => exp === foundRole.toLowerCase() || foundRole.toLowerCase().includes(exp) || exp.includes(foundRole.toLowerCase()));
        if (!isMatched) {
          issues.push(
            `ROLE_CONTAMINATION: Terdeteksi peran asing "${foundRole}" yang TIDAK ADA dalam Brief Kebutuhan resmi (${expectedRoles.join(', ')}). ` +
            `Kode aplikasi WAJIB HANYA memuat peran resmi dari Brief Kebutuhan!`
          );
        }
      });

      // Periksa keberadaan form login produksi (username & password) jika multi-role
      if (expectedRoles.length > 1) {
        const hasUsernameInput = /id\s*=\s*['"](?:loginUsername|username|userEmail|loginEmail)['"]/i.test(repairedHtml) ||
                                 /type\s*=\s*['"](?:text|email)['"][^>]*id\s*=\s*['"][^'"]*(?:user|login|email)[^'"]*['"]/i.test(repairedHtml);
        const hasPasswordInput = /type\s*=\s*['"]password['"]/i.test(repairedHtml);
        const hasLoginHandler = /function\s+handleLogin\s*\(/.test(combinedJs) || /handleLogin\s*=\s*(function|\()/.test(combinedJs) || hasLoginAsFunc;

        if (!hasUsernameInput || !hasPasswordInput) {
          issues.push(
            `LOGIN_FORM_MISSING_FIELDS: Form login gaya produksi WAJIB memiliki input username (<input type="text" id="loginUsername">) ` +
            `dan password (<input type="password" id="loginPassword">) untuk autentikasi demo per role.`
          );
        }

        if (!hasLoginHandler) {
          issues.push(
            `LOGIN_FORM_MISSING_HANDLER: Fungsi handleLogin() tidak ditemukan di tag <script>. ` +
            `WAJIB buat fungsi handleLogin() untuk mencocokkan username/password demo ke peran resmi.`
          );
        }
      }

      // 10c. Pemeriksaan Tab Gating Publik & Keamanan Data (Poin 52 — Anti-Data Leak & Initial Public Role Filtering)
      let detectedPublicRole: string | null = null;
      for (const r of expectedRoles) {
        if (/^(pasien|pelanggan|customer|tamu|guest|publik|client)/i.test(r)) {
          detectedPublicRole = r;
          break;
        }
      }

      if (detectedPublicRole) {
        // 1. Verifikasi apakah gerbang loginScreen aktif atau filterTabsByRole dipanggil saat inisialisasi awal publik (di luar loginAs)
        const hasLoginScreenGate = /id\s*=\s*['"]loginScreen['"]/i.test(repairedHtml) &&
                                   /id\s*=\s*['"]appContainer['"][^>]*style\s*=\s*['"][^'"]*display\s*:\s*none/i.test(repairedHtml);
        const hasInitialFilterCall = hasLoginScreenGate ||
                                     new RegExp(`filterTabsByRole\\s*\\(\\s*['"]?${detectedPublicRole}['"]?\\s*\\)`, 'i').test(combinedJs) ||
                                     /DOMContentLoaded[\s\S]*?filterTabsByRole/i.test(combinedJs) ||
                                     /init\(\)[\s\S]*?filterTabsByRole/i.test(combinedJs) ||
                                     /window\.onload[\s\S]*?filterTabsByRole/i.test(combinedJs);

        if (!hasInitialFilterCall) {
          issues.push(
            `PUBLIC_ROLE_UNFILTERED_ON_LOAD: Aplikasi memiliki halaman publik ("${detectedPublicRole}"), tetapi filterTabsByRole("${detectedPublicRole}") ` +
            `TIDAK dipanggil saat inisialisasi awal (di luar loginAs). Akibatnya seluruh tab staf terbuka tanpa login!`
          );

          // Auto-repair: Sisipkan pemanggilan filterTabsByRole awal jika fungsi tersebut ada di script
          if (repairedHtml.includes('function filterTabsByRole') || repairedJs.includes('function filterTabsByRole')) {
            if (repairedHtml.includes('document.addEventListener(\'DOMContentLoaded\'') || repairedHtml.includes('document.addEventListener("DOMContentLoaded"')) {
              repairedHtml = repairedHtml.replace(/(document\.addEventListener\(\s*['"]DOMContentLoaded['"]\s*,\s*(?:\(\)|\w+)?\s*=>?\s*\{)/i, `$1\n      if (typeof filterTabsByRole === 'function') filterTabsByRole('${detectedPublicRole}');`);
            } else if (repairedHtml.includes('</script>')) {
              repairedHtml = repairedHtml.replace('</script>', `\n    // Inisialisasi awal tab publik (Poin 52)\n    document.addEventListener('DOMContentLoaded', () => {\n      if (typeof filterTabsByRole === 'function') filterTabsByRole('${detectedPublicRole}');\n    });\n    </script>`);
            }
          }
        }

        // Auto-repair defensive: Sembunyikan tombol tab staf di markup HTML bawaan jika belum ada style="display:none"
        repairedHtml = repairedHtml.replace(/<button([^>]*?)>/gi, (match, attrs) => {
          if (!attrs.includes('tab-btn')) return match;
          const accessRolesMatch = attrs.match(/data-access-roles=["']([^"']+)["']/i);
          if (accessRolesMatch) {
            const roles = accessRolesMatch[1].split(',').map((r: string) => r.trim().toLowerCase());
            const hasPublicAccess = roles.some((r: string) => /^(pasien|pelanggan|customer|tamu|guest|publik|client)$/i.test(r));
            if (!hasPublicAccess && !attrs.includes('style=')) {
              return `<button${attrs} style="display: none;">`;
            } else if (!hasPublicAccess && attrs.includes('style="') && !attrs.includes('display: none') && !attrs.includes('display:none')) {
              return `<button${attrs.replace('style="', 'style="display: none; ')}>`;
            }
          }
          return match;
        });

        // 2. Deteksi PUBLIC_DATA_LEAK: Tombol Edit/Hapus staf yang terbuka di tab publik
        const tabBtns = [...repairedHtml.matchAll(/<button([^>]*?)>/gi)].filter(m => m[1].includes('tab-btn'));
        for (const btnMatch of tabBtns) {
          const btnAttrs = btnMatch[1];
          const tabIdMatch = btnAttrs.match(/showTab\(['"]([^'"]+)['"]\)/i);
          const accessRolesMatch = btnAttrs.match(/data-access-roles=["']([^"']+)["']/i);

          if (tabIdMatch && accessRolesMatch) {
            const tabId = tabIdMatch[1];
            const roles = accessRolesMatch[1].split(',').map((r: string) => r.trim().toLowerCase());
            const isExclusivelyPublic = roles.every((r: string) => /^(pasien|pelanggan|customer|tamu|guest|publik|client)$/i.test(r));

            if (isExclusivelyPublic) {
              const tabSectionRegex = new RegExp(`<div[^>]*id=["'](?:tab-)?${tabId}["'][^>]*>([\\s\\S]*?)<\\/div>`, 'i');
              const tabSectionMatch = repairedHtml.match(tabSectionRegex);
              if (tabSectionMatch) {
                const sectionContent = tabSectionMatch[1];
                const hasExposedStaffActions = /<button[^>]*onclick=["'][^"']*(?:hapus|delete|bukaModalHapus|editPesanan|editData|ubahStatus)[^"']*["'][^>]*>/i.test(sectionContent);
                if (hasExposedStaffActions) {
                  issues.push(
                    `PUBLIC_DATA_LEAK: Tab publik "${tabId}" memuat tombol Edit/Hapus atau aksi staf tanpa autentikasi. ` +
                    `Halaman publik HANYA boleh berisi form pencarian/lacak spesifik atau form pemesanan mandiri, BUKAN tabel master dengan tombol staf!`
                  );
                }
              }
            }
          }
        }
      }
    }
  }

  repairedHtml = cleanConversationalLeaks(repairedHtml);

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
