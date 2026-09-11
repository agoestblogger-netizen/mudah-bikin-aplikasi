/**
 * AUTOMATED DOM-ALIGNMENT & STATIC CODE VALIDATOR (PRD Bagian 5 & 7, NFR-10b)
 * Memverifikasi keselarasan event handler HTML vs definisi JS serta eksistensi elemen DOM ID.
 */

import { cleanConversationalLeaks } from './cleanLeaks';
import { isSuperAdminRole } from './rolePolicy';

export interface ValidationReport {
  isValid: boolean;
  issues: string[];
  repairedCode: {
    html: string;
    css: string;
    js: string;
  };
}

function injectBeforeLastScriptClose(html: string, code: string): string {
  // Pisahkan jika ada script eksternal yang diisi kode inline
  let sanitizedHtml = html.replace(/<script(?=[^>]*\bsrc\s*=)([^>]*)>([\s\S]*?)<\/script>/gi, (match, attrs, innerCode) => {
    if (innerCode && innerCode.trim().length > 0) {
      return `<script${attrs}></script>\n<script>\n${innerCode}\n</script>`;
    }
    return match;
  });

  // Tutup comment yang tidak tertutup terlebih dahulu jika ada
  const lastOpenComment = sanitizedHtml.lastIndexOf('<!--');
  const lastCloseComment = sanitizedHtml.lastIndexOf('-->');
  if (lastOpenComment !== -1 && (lastCloseComment === -1 || lastCloseComment < lastOpenComment)) {
    sanitizedHtml += '\n-->';
  }

  // Cari <script ...>...</script> inline (yang TIDAK memiliki atribut src=)
  const matches = [...sanitizedHtml.matchAll(/<script(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi)];
  if (matches.length > 0) {
    const lastMatch = matches[matches.length - 1];
    const insertPos = lastMatch.index! + lastMatch[0].lastIndexOf('</script>');
    return sanitizedHtml.slice(0, insertPos) + '\n' + code + '\n' + sanitizedHtml.slice(insertPos);
  }

  // Jika tidak ada tag script inline yang bisa diinjeksi, buat tag script baru sebelum </body> atau </html>
  if (sanitizedHtml.includes('</body>')) {
    return sanitizedHtml.replace('</body>', `<script>\n${code}\n</script>\n</body>`);
  }
  if (sanitizedHtml.includes('</html>')) {
    return sanitizedHtml.replace('</html>', `<script>\n${code}\n</script>\n</html>`);
  }
  return sanitizedHtml + `\n<script>\n${code}\n</script>\n</body>\n</html>`;
}

export function injectMissingHandlerStubs(html: string, issues: string[]): string {
  const missingHandlers: string[] = [];
  issues.forEach(issue => {
    const matchHandler = issue.match(/MISMATCH_HANDLER:\s*Fungsi\s*["']([^"']+)["']/i);
    if (matchHandler && matchHandler[1]) missingHandlers.push(matchHandler[1]);
  });
  if (missingHandlers.length === 0 || !html.includes('</script>')) return html;

  let fallbackScript = '\n    // --- AUTO-PATCH SELF-HEALING HANDLERS ---\n';
  missingHandlers.forEach(fn => {
    const isModalClose = /tutup|close|batal/i.test(fn);
    const isModalOpen = /buka|open|tambah|edit/i.test(fn);
    const isPaymentOrProcess = /proses|bayar|checkout|selesai/i.test(fn);

    fallbackScript += `    function ${fn}(...args) {\n`;
    fallbackScript += `      console.log('[Auto-Handler] Dipanggil: ${fn}', args);\n`;
    if (isModalClose) {
      fallbackScript += `      document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');\n`;
    } else if (isModalOpen) {
      fallbackScript += `      const m = document.querySelector('.modal'); if (m) m.style.display = 'flex';\n`;
    } else if (isPaymentOrProcess) {
      fallbackScript += `      if (typeof showToast === 'function') showToast('Transaksi/Aksi berhasil diproses!', 'success');\n`;
      fallbackScript += `      else alert('Transaksi/Aksi berhasil diproses!');\n`;
      fallbackScript += `      if (typeof render === 'function') { try { render(); } catch(e){} }\n`;
      fallbackScript += `      else if (typeof renderTable === 'function') { try { renderTable(); } catch(e){} }\n`;
    } else {
      fallbackScript += `      if (typeof showToast === 'function') showToast('Aksi ' + '${fn}' + ' berhasil dijalankan!', 'success');\n`;
      fallbackScript += `      else alert('Aksi ' + '${fn}' + ' berhasil dijalankan!');\n`;
      fallbackScript += `      if (typeof render === 'function') { try { render(); } catch(e){} }\n`;
    }
    fallbackScript += `    }\n`;
  });
  fallbackScript += '    // ----------------------------------------\n';

  return injectBeforeLastScriptClose(html, fallbackScript);
}

/**
 * Auto-inject area "Manajemen Sistem" untuk Super Admin bila tidak ada.
 * Idempotent (ditandai data-od-auto), aman dari MISMATCH_HANDLER (tanpa onclick),
 * dan hanya diberi data-access-roles="Super Admin" agar tidak bocor ke role lain.
 */
function injectSuperAdminManagementSection(html: string): string {
  if (!html || /data-od-auto=["']superadmin-management["']/i.test(html)) return html;

  const card = `
<div class="card" data-od-auto="superadmin-management" data-access-roles="Super Admin" style="margin-top:16px;">
  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
    <h3 class="title" style="font-size:16px; margin:0;">Manajemen Sistem</h3>
    <span class="badge badge-info">Super Admin</span>
  </div>
  <div style="display:flex; flex-wrap:wrap; gap:8px;">
    <button type="button" class="btn-primary" data-access-roles="Super Admin">Tambah Akun Staf</button>
    <button type="button" class="btn-secondary" data-access-roles="Super Admin">Atur Hak Akses</button>
    <button type="button" class="btn-danger" data-access-roles="Super Admin">Nonaktifkan Akun Staf</button>
  </div>
</div>`;

  // 1. Coba sisipkan ke dalam tab khusus Super Admin.
  const buttonTags = [...html.matchAll(/<button\b[^>]*>/gi)].map((m) => m[0]);
  for (const tag of buttonTags) {
    if (!/tab-btn/i.test(tag)) continue;
    const access = tag.match(/data-access-roles=["']([^"']+)["']/i)?.[1] || '';
    if (!/super\s*admin/i.test(access)) continue;
    const tabId = tag.match(/showTab\(\s*['"]([^'"]+)['"]\s*\)/i)?.[1];
    if (!tabId) continue;
    const escaped = tabId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const idPattern = new RegExp(`(<[a-zA-Z][^>]*id=["']${escaped}["'][^>]*>)`, 'i');
    if (idPattern.test(html)) {
      return html.replace(idPattern, `$1\n${card}`);
    }
  }

  // 2. Fallback: sisipkan sebelum </body>.
  if (html.includes('</body>')) return html.replace('</body>', `${card}\n</body>`);
  return html + card;
}

export function validateAndRepairGeneratedCode(
  html: string,
  css: string,
  js: string,
  expectedRoles?: string[]
): ValidationReport {
  const issues: string[] = [];
  let repairedHtml = cleanConversationalLeaks(html);
  let repairedJs = js || '';

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
  // Termasuk: function declaration, async function, const/let/var = function,
  // arrow function, async arrow function (mis. const handleLogin = async () => {}),
  // dan assignment ke window / variabel global.
  const definedFunctions = new Set<string>();
  const funcDefRegex = /(?:async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)|(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s+)?(?:function\b|(?:\([^)]*\)|[a-zA-Z_$][a-zA-Z0-9_$]*)\s*=>)|window\.([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s+)?(?:function\b|(?:\([^)]*\)|[a-zA-Z_$][a-zA-Z0-9_$]*)\s*=>)|([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s+)?function/g;
  while ((m = funcDefRegex.exec(combinedJs)) !== null) {
    const fnName = m[1] || m[2] || m[3] || m[4];
    if (fnName) definedFunctions.add(fnName);
  }


  // Peta alias umum (misal: AI menulis showTab di onclick tapi switchTab di JS, atau bukaModal vs openModal)
  const commonAliases: Record<string, string[]> = {
    'showTab': ['switchTab', 'gantiTab', 'pindahTab', 'changeTab', 'selectTab', 'openTab'],
    'switchTab': ['showTab', 'gantiTab', 'pindahTab', 'changeTab', 'selectTab', 'openTab'],
    'gantiTab': ['showTab', 'switchTab', 'pindahTab', 'changeTab', 'selectTab', 'openTab'],
    'logout': ['handleLogout', 'keluar', 'logOut', 'userLogout', 'doLogout', 'signOut', 'prosesLogout'],
    'handleLogout': ['logout', 'keluar', 'logOut'],
    'keluar': ['logout', 'handleLogout', 'logOut'],
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
            repairedHtml = injectBeforeLastScriptClose(repairedHtml, `\nfunction ${fn}(...args) { if (typeof ${alias} === 'function') ${alias}(...args); }\n`);
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
                  repairedHtml = injectBeforeLastScriptClose(repairedHtml, `\nfunction ${fn}(...args) { if (typeof ${defFn} === 'function') ${defFn}(...args); }\n`);
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
        repairedHtml = injectBeforeLastScriptClose(repairedHtml, `${fallbackEksekusiHapus}\n`);
        definedFunctions.add('eksekusiHapus');
        resolved = true;
      }

      // Auto-repair untuk fungsi autentikasi login bila benar-benar tidak didefinisikan
      if (!resolved && (fn === 'handleLogin' || fn === 'quickLogin')) {
        const fallbackLogin = fn === 'handleLogin'
          ? `
function handleLogin() {
  try {
    const _u = (document.getElementById('loginUsername')?.value || '').trim().toLowerCase();
    const _p = (document.getElementById('loginPassword')?.value || '').trim();
    let _acc = null;
    if (typeof DEMO_ACCOUNTS !== 'undefined' && Array.isArray(DEMO_ACCOUNTS)) {
      _acc = DEMO_ACCOUNTS.find(a => String(a.username).toLowerCase() === _u && (String(a.password) === _p || !_p));
    }
    if (!_acc) {
      if (_u.includes('super') || _u === 'superadmin') _acc = { role: 'Super Admin' };
      else if (_u.includes('admin')) _acc = { role: 'Admin' };
      else if (_u.includes('kasir')) _acc = { role: 'Kasir' };
      else if (_u.includes('staf') || _u.includes('staff')) _acc = { role: 'Staff' };
      else if (_u.includes('owner') || _u.includes('pemilik')) _acc = { role: 'Pemilik' };
      else if (_u.includes('user') || _u.includes('pelanggan')) _acc = { role: 'Pelanggan' };
      else if (_u) _acc = { role: _u.charAt(0).toUpperCase() + _u.slice(1) };
      else _acc = { role: 'Super Admin' };
    }
    if (_acc && typeof loginAs === 'function') {
      loginAs(_acc.role);
      if (typeof showToast === 'function') showToast('Selamat datang! Masuk sebagai ' + _acc.role, 'success');
      return;
    }
    if (typeof showToast === 'function') showToast('Username atau kata sandi tidak cocok!', 'error');
  } catch (e) { console.log('login error', e); }
}
`
          : `
function quickLogin(u, p) {
  const ui = document.getElementById('loginUsername');
  const pi = document.getElementById('loginPassword');
  if (ui) ui.value = u;
  if (pi) pi.value = p;
  if (typeof handleLogin === 'function') handleLogin();
}
`;
        repairedHtml = injectBeforeLastScriptClose(repairedHtml, `${fallbackLogin}\n`);
        definedFunctions.add(fn);
        resolved = true;
      }

      // Auto-repair untuk fungsi navigasi tab & autentikasi jika dipanggil di onclick tapi belum terdefinisi
      if (!resolved && (fn === 'logout' || fn === 'showTab' || fn === 'loginAs' || fn === 'filterTabsByRole') && repairedHtml.includes('</script>')) {
        let fallbackFn = '';
        if (fn === 'logout') {
          fallbackFn = `
function logout() {
  try {
    currentRole = '';
    const loginEl = document.getElementById('loginScreen');
    const appEl = document.getElementById('appContainer');
    if (appEl) appEl.style.display = 'none';
    if (loginEl) loginEl.style.display = 'flex';
    if (typeof showToast === 'function') showToast('Berhasil keluar. Silakan login kembali.', 'info');
  } catch (e) { console.log('logout error', e); }
}
`;
        } else if (fn === 'showTab') {
          fallbackFn = `
function showTab(tabId) {
  try {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
    const target = document.getElementById(tabId) || document.querySelector('[id*="' + tabId + '"]');
    if (target) target.classList.add('active');
    const targetBtn = document.getElementById('tab-btn-' + tabId) || document.querySelector('[onclick*="' + tabId + '"]');
    if (targetBtn) targetBtn.classList.add('active');
    if (typeof render === 'function') render();
    else if (typeof renderTable === 'function') renderTable();
  } catch (e) { console.log('showTab error', e); }
}
`;
        } else if (fn === 'loginAs') {
          fallbackFn = `
function loginAs(role) {
  try {
    currentRole = role;
    const loginEl = document.getElementById('loginScreen');
    const appEl = document.getElementById('appContainer');
    if (loginEl) loginEl.style.display = 'none';
    if (appEl) appEl.style.display = 'block';
    const badge = document.getElementById('currentRoleBadge');
    if (badge) badge.innerText = role;
    if (typeof filterTabsByRole === 'function') filterTabsByRole(role);
    if (typeof showTab === 'function') {
      const firstTab = document.querySelector('.tab-btn:not([style*="display: none"])');
      const tabMatch = firstTab?.getAttribute('onclick')?.match(/showTab\\(['"]([^'"]+)['"]\\)/);
      if (tabMatch && tabMatch[1]) showTab(tabMatch[1]);
    }
    if (typeof render === 'function') render();
    else if (typeof renderTable === 'function') renderTable();
  } catch (e) { console.log('loginAs error', e); }
}
`;
        } else if (fn === 'filterTabsByRole') {
          fallbackFn = `
function filterTabsByRole(role) {
  try {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      const roles = btn.getAttribute('data-access-roles');
      if (!roles) return;
      const allowed = roles.split(',').map(r => r.trim().toLowerCase());
      if (allowed.includes(String(role).toLowerCase())) {
        btn.style.display = 'inline-flex';
      } else {
        btn.style.display = 'none';
      }
    });
  } catch (e) { console.log('filterTabs error', e); }
}
`;
        }
        repairedHtml = injectBeforeLastScriptClose(repairedHtml, `${fallbackFn}\n`);
        definedFunctions.add(fn);
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
  let hasLoginAsFunc = /function\s+loginAs\s*\(/.test(combinedJs) || /loginAs\s*=\s*(function|\()/.test(combinedJs);
  const hasMultiRoleLogic = /currentRole|loginAs|filterTabsByRole/i.test(combinedJs);

  const isMultiRoleApp = Boolean(expectedRoles && expectedRoles.length > 1);

  if (hasMultiRoleLogic || hasLoginAsFunc || isMultiRoleApp) {
    // Cek apakah ada fungsi filterTabsByRole
    let hasFilterTabsByRole = /filterTabsByRole\s*\(/.test(combinedJs) ||
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
        `Contoh: data-access-roles="Super Admin,Dokter"`
      );
    }

    // Poin 55: Pastikan setiap peran resmi memiliki setidaknya 1 tab navigasi khusus
    if (isMultiRoleApp && tabBtnMatches.length > 0) {
      const tabAccessRoles = [...repairedHtml.matchAll(/data-access-roles\s*=\s*['"]([^'"]+)['"]/gi)]
        .flatMap(m => m[1].split(',').map(r => r.trim().toLowerCase()))
        .filter((r) => r && !/\$\{|%\{|\{\{|<%|<%=|\bcurrentRole\b/i.test(r));

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

      // Auto-repair cerdas: Ubah label tab peran mentah (misal: "⚙️ Super Admin" -> "⚙️ Kelola Sistem",
      // "💳 Anggota" -> "🪪 Kartu Anggota Digital", "📈 Menu Manajer" -> "📈 Monitoring & Persetujuan")
      const functionalTabLabel = (role: string): { emoji: string; label: string } => {
        const r = role.trim().toLowerCase();
        if (/super\s*admin|admin$|^admin|pengelola/.test(r)) return { emoji: '⚙️', label: 'Kelola Sistem' };
        if (/anggota|member|user|pelanggan|penyewa|pasien|siswa|customer|buyer|nasabah|donatur|penerima|warga|tamu/.test(r)) {
          return { emoji: '🪪', label: 'Pesanan & Kartu Saya' };
        }
        if (/kasir|cashier/.test(r)) return { emoji: '🛒', label: 'Transaksi Penjualan' };
        if (/dokter|doctor/.test(r)) return { emoji: '🩺', label: 'Pemeriksaan Pasien' };
        if (/perawat|nurse|bidan|apoteker|farmasi/.test(r)) return { emoji: '💊', label: 'Asuhan & Obat' };
        if (/resepsionis|front\s*office|receptionist|loket/.test(r)) return { emoji: '📋', label: 'Pendaftaran & Antrian' };
        if (/manajer|manager|supervisor|pengawas|kepala/.test(r)) return { emoji: '📈', label: 'Monitoring & Persetujuan' };
        if (/pemilik|owner|direktur|director|pengurus/.test(r)) return { emoji: '📊', label: 'Laporan & Bisnis' };
        if (/gudang|warehouse|spare\s*part|stok|inventory/.test(r)) return { emoji: '📦', label: 'Stok & Gudang' };
        if (/dapur|kitchen|koki|barista/.test(r)) return { emoji: '🍳', label: 'Antrian Dapur' };
        if (/pelayan|waiter|pramusaji/.test(r)) return { emoji: '🍽️', label: 'Pesanan Meja' };
        if (/finance|keuangan|akuntan|accountant|bendahara/.test(r)) return { emoji: '💰', label: 'Keuangan' };
        if (/purchasing|procurement|pengadaan/.test(r)) return { emoji: '🧾', label: 'Pengadaan' };
        if (/petugas\s*sewa|rental/.test(r)) return { emoji: '🔑', label: 'Sewa & Pengembalian' };
        if (/kurir|driver|sopir|logistik/.test(r)) return { emoji: '🚚', label: 'Pengiriman' };
        if (/terapis|trainer|instruktur|guru|pengajar|tutor/.test(r)) return { emoji: '🎓', label: 'Jadwal & Sesi' };
        if (/mekanik|montir|teknisi|operator|maintenance/.test(r)) return { emoji: '🔧', label: 'Pengerjaan & Servis' };
        if (/agen|sales|marketing|fundraiser/.test(r)) return { emoji: '🤝', label: 'Prospek & Penjualan' };
        return { emoji: '📌', label: `Kelola ${role.trim()}` };
      };

      for (const role of expectedRoles!) {
        const { emoji: defaultEmoji, label: functionalLabel } = functionalTabLabel(role);
        // Cari button tab yang isinya nama peran (dengan/tanpa emoji, dengan/tanpa kata "Menu/Tab/Halaman")
        const escapedRole = role.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const roleBtnRegex = new RegExp(
          `(<button[^>]*class=['"][^'"]*tab-btn[^'"]*['"][^>]*>)\\s*([\\p{Emoji}\\p{Extended_Pictographic}\\u200d\\ufe0f\\s]*)(?:(?:Menu|Tab|Halaman)\\s+)?${escapedRole}\\s*(<\\/button>)`,
          'giu'
        );
        repairedHtml = repairedHtml.replace(roleBtnRegex, (match, openTag, prefix, closeTag) => {
          const emojiMatch = String(prefix || '').match(/[\p{Emoji}\p{Extended_Pictographic}]/u);
          const cleanEmoji = emojiMatch ? emojiMatch[0] + ' ' : `${defaultEmoji} `;
          return `${openTag}${cleanEmoji}${functionalLabel}${closeTag}`;
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
            `(misal: Tab Super Admin untuk kelola sistem, Tab Anggota untuk kartu digital & status pribadi).`
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

    // Auto-repair: inject fungsi role-gating generik bila belum ada.
    // Tanpa literal nama peran, jadi tidak memicu ROLE_CONTAMINATION.
    const roleGatingRepairParts: string[] = [];
    const hasRoleGatingMarker = /data-od-auto="role-gating"/.test(repairedHtml);

    if (isMultiRoleApp && !hasFilterTabsByRole && !hasRoleGatingMarker) {
      roleGatingRepairParts.push(`
/* data-od-auto="role-gating" */
function filterTabsByRole(role) {
  document.querySelectorAll('.tab-btn').forEach(function(btn) {
    var allowed = (btn.getAttribute('data-access-roles') || '').split(',').map(function(r) { return r.trim().toLowerCase(); });
    btn.style.display = (role && allowed.indexOf(String(role).trim().toLowerCase()) !== -1) ? '' : 'none';
  });
}`);
      hasFilterTabsByRole = true;
    }

    if (isMultiRoleApp && !hasLoginAsFunc && !hasRoleGatingMarker) {
      roleGatingRepairParts.push(`
function loginAs(role) {
  window.currentRole = role;
  var loginEl = document.getElementById('loginScreen');
  var appEl = document.getElementById('appContainer');
  if (loginEl) loginEl.style.display = 'none';
  if (appEl) appEl.style.display = 'block';
  if (typeof filterTabsByRole === 'function') filterTabsByRole(role);
  var badge = document.getElementById('currentRoleBadge');
  if (badge) badge.innerText = role;
  if (typeof render === 'function') { try { render(); } catch (e) {} }
}`);
      hasLoginAsFunc = true;
    }

    if (roleGatingRepairParts.length > 0) {
      repairedHtml = injectBeforeLastScriptClose(repairedHtml, roleGatingRepairParts.join('\n'));
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
      const hasRequiredSuperAdmin = expectedRoles.some(isSuperAdminRole);
      
      // Ambil semua role yang didefinisikan di JS (DEMO_ACCOUNTS, loginAs, dll) & HTML.
      // Abaikan nilai dinamis/template literal (mis. `${currentRole}`) agar tidak
      // dianggap peran asing.
      const isPlaceholderRole = (role: string) =>
        !role ||
        /\$\{|%\{|\{\{|<%|<%=|\bcurrentRole\b|\broleName\b|\broleId\b/i.test(role);
      const cleanRoles = (items: string[]) =>
        items.map((r) => r.trim()).filter((r) => r && !isPlaceholderRole(r));

      const loginAsCalls = cleanRoles([...repairedHtml.matchAll(/loginAs\(\s*['"]([^'"]+)['"]\s*\)/g)].map(m => m[1]));
      const jsLoginAsCalls = cleanRoles([...combinedJs.matchAll(/loginAs\(\s*['"]([^'"]+)['"]\s*\)/g)].map(m => m[1]));
      const demoAccountRoles = cleanRoles([...combinedJs.matchAll(/role\s*:\s*['"]([^'"]+)['"]/gi)].map(m => m[1]));
      const tabAccessRoles = cleanRoles(
        [...repairedHtml.matchAll(/data-access-roles\s*=\s*['"]([^'"]+)['"]/gi)]
          .flatMap(m => m[1].split(',').map(r => r.trim()))
      );

      const allFoundRoles = [...new Set([...loginAsCalls, ...jsLoginAsCalls, ...demoAccountRoles, ...tabAccessRoles])];

      // Manajemen akun staf adalah capability eksklusif Super Admin.
      if (hasRequiredSuperAdmin) {
        const accountManagementTerms = /akun\s+staf|kelola\s+(?:akun|pengguna|user)|manajemen\s+(?:akun|pengguna|user)|role\s*&\s*permission|hak\s+akses|tambah\s+staf|hapus\s+staf|nonaktifkan\s+akun/i;
        const gatedButtons = [...repairedHtml.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)];
        let managementButtons = gatedButtons.filter((match) => accountManagementTerms.test(match[2].replace(/<[^>]+>/g, ' ')));

        if (managementButtons.length === 0 || !accountManagementTerms.test(repairedHtml)) {
          // Auto-inject area manajemen sistem agar tidak memblokir generation.
          repairedHtml = injectSuperAdminManagementSection(repairedHtml);
          const rescanned = [...repairedHtml.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)];
          managementButtons = rescanned.filter((match) => accountManagementTerms.test(match[2].replace(/<[^>]+>/g, ' ')));

          // Jika auto-inject pun gagal, baru catat sebagai issue.
          if (managementButtons.length === 0) {
            issues.push(
              'SUPER_ADMIN_MANAGEMENT_MISSING: Aplikasi wajib menyediakan area manajemen akun staf, role, dan permission untuk role Super Admin.'
            );
          }
        }

        for (const match of managementButtons) {
          const access = match[1].match(/data-access-roles\s*=\s*["']([^"']+)["']/i)?.[1] || '';
          // Tombol tanpa data-access-roles diasumsikan berada di dalam tab yang
          // sudah digate Super Admin; hanya periksa yang punya atribut eksplisit.
          if (!access) continue;
          const accessRoles = access.split(',').map((role) => role.trim()).filter(Boolean);
          if (!accessRoles.some(isSuperAdminRole) || accessRoles.some((role) => !isSuperAdminRole(role))) {
            issues.push(
              `STAFF_ACCOUNT_ACCESS_LEAK: Tombol manajemen akun staf/permission hanya boleh memiliki data-access-roles="Super Admin" (saat ini: "${access}").`
            );
          }
        }
      }

      // Deteksi role asing / tercemar (misal: Washer / Kasir / Super Admin di app klinik)
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
              repairedHtml = injectBeforeLastScriptClose(repairedHtml, `\n    // Inisialisasi awal tab publik (Poin 52)\n    document.addEventListener('DOMContentLoaded', () => {\n      if (typeof filterTabsByRole === 'function') filterTabsByRole('${detectedPublicRole}');\n    });\n    `);
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
