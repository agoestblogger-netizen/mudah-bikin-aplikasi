/**
 * AUTOMATED DOM-ALIGNMENT & STATIC CODE VALIDATOR (PRD Bagian 5 & 7, NFR-10b)
 * Memverifikasi keselarasan event handler HTML vs definisi JS serta eksistensi elemen DOM ID.
 */

import { cleanConversationalLeaks } from './cleanLeaks';
import { isSuperAdminRole } from './rolePolicy';
import * as acorn from 'acorn';
import tailwindV2ClassesData from './tailwindV2Classes.json';

const tailwindV2ClassesSet = new Set<string>(tailwindV2ClassesData as string[]);

const ALLOWED_NON_TAILWIND_CLASSES = new Set([
  'tab-btn', 'tab-content', 'tab-pane', 'nav-tabs', 'active',
  'modal', 'modal-open', 'modal-backdrop', 'modal-content',
  'badge', 'badge-info', 'badge-success', 'badge-warning', 'badge-danger',
  'toast', 'toast-success', 'toast-error', 'toast-warning', 'toast-info',
  'card', 'btn', 'btn-primary', 'btn-secondary', 'btn-danger', 'btn-success',
  'title', 'table-auto'
]);

function isAllowedNonTailwindClass(cls: string): boolean {
  if (ALLOWED_NON_TAILWIND_CLASSES.has(cls)) return true;
  // FontAwesome icon classes: fa, fas, far, fab, fad, fal, fat, fa-*, etc.
  if (/^(?:fa[srlbtd]?|fa-[a-z0-9-]+)$/i.test(cls)) return true;
  return false;
}

export interface ValidationReport {
  isValid: boolean;
  issues: string[];
  repairedCode: {
    html: string;
    css: string;
    js: string;
  };
}

/**
 * Mencari indeks kurung siku tutup `]` yang berpasangan dengan `[` pembuka array,
 * dengan memperhitungkan kedalaman (nesting) dan mengabaikan kurung di dalam string.
 */
export function findMatchingArrayBracket(code: string, openBracketIndex: number): number {
  let depth = 0;
  let inString = false;
  let stringChar = '';
  for (let i = openBracketIndex; i < code.length; i++) {
    const ch = code[i];
    if (inString) {
      if (ch === stringChar && code[i - 1] !== '\\') {
        inString = false;
      }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = true;
      stringChar = ch;
      continue;
    }
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Normalisasi nama peran untuk pencocokan tab navigasi yang toleran terhadap karakter khusus:
 * - Mengubah '&', '&amp;' menjadi 'dan'
 * - Menghilangkan tanda baca kurung, strip, slash
 * - Menyeragamkan whitespace dan lowercase
 */
export function normalizeRoleForTabMatch(r: string): string {
  return (r || '')
    .toLowerCase()
    .replace(/&amp;/g, ' dan ')
    .replace(/&/g, ' dan ')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Ekstraksi seluruh nama fungsi yang didefinisikan di JavaScript menggunakan AST traversal.
 * Mendukung: FunctionDeclaration, VariableDeclaration (FunctionExpression & ArrowFunction),
 * AssignmentExpression (window.xyz = ..., xyz = ...), dan fungsi bersarang di dalam block/event.
 */
export function extractFunctionsFromAst(ast: any): Set<string> {
  const fns = new Set<string>();

  function walk(node: any) {
    if (!node || typeof node !== 'object') return;

    if (node.type === 'FunctionDeclaration' && node.id?.name) {
      fns.add(node.id.name);
    } else if (node.type === 'VariableDeclarator' && node.id?.name && node.init) {
      if (node.init.type === 'FunctionExpression' || node.init.type === 'ArrowFunctionExpression') {
        fns.add(node.id.name);
      }
    } else if (node.type === 'AssignmentExpression') {
      const left = node.left;
      const right = node.right;
      const isFn = right && (right.type === 'FunctionExpression' || right.type === 'ArrowFunctionExpression');
      if (isFn) {
        if (left.type === 'Identifier' && left.name) {
          fns.add(left.name);
        } else if (left.type === 'MemberExpression' && left.property) {
          if (left.object?.name === 'window') {
            fns.add(left.property.name || left.property.value);
          }
        }
      }
    } else if (node.type === 'Property') {
      // Dukungan Vue Options API methods: { methodName() { ... }, methodName: function() { ... } }
      if (node.key?.name === 'methods' || node.key?.value === 'methods') {
        if (node.value?.type === 'ObjectExpression' && Array.isArray(node.value.properties)) {
          for (const prop of node.value.properties) {
            const propName = prop.key?.name || prop.key?.value;
            if (propName) fns.add(propName);
          }
        }
      } else if (node.value?.type === 'FunctionExpression' || node.value?.type === 'ArrowFunctionExpression') {
        const propName = node.key?.name || node.key?.value;
        if (propName) fns.add(propName);
      }
    }

    for (const key of Object.keys(node)) {
      if (key === 'loc' || key === 'range') continue;
      const child = node[key];
      if (Array.isArray(child)) {
        for (const c of child) {
          if (c && typeof c.type === 'string') walk(c);
        }
      } else if (child && typeof child.type === 'string') {
        walk(child);
      }
    }
  }

  walk(ast);
  return fns;
}

/**
 * Memeriksa kesesuaian kelas utility terhadap Tailwind CSS v2.2.19 Precompiled.
 * Menggunakan WHITELIST terhadap seluruh 39.000+ kelas resmi di tailwind.min.css v2.2.19.
 * Menandai arbitrary values ([...]) dan utilitas yang tidak terdaftar di stylesheet v2.2.19 (fail-silent).
 */
export function checkTailwindV2Syntax(html: string): { warnings: string[]; invalidClasses: string[] } {
  const warnings: string[] = [];
  const invalidClasses: string[] = [];

  // Ekstrak seluruh nilai atribut class="..." (abaikan :class atau v-bind:class)
  const staticClassRegex = /(?<![:\w-])class=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  const classesFound = new Set<string>();

  while ((match = staticClassRegex.exec(html)) !== null) {
    const classStr = match[1];
    const tokens = classStr.split(/\s+/).filter(Boolean);
    for (const t of tokens) {
      classesFound.add(t);
    }
  }

  // Ekstrak string literal di dalam :class="..." atau v-bind:class="..."
  const dynamicClassRegex = /(?::|v-bind:)class=["']([^"']+)["']/gi;
  while ((match = dynamicClassRegex.exec(html)) !== null) {
    const expr = match[1];
    const stringLiteralRegex = /['"]([^'"]+)['"]/g;
    let strMatch: RegExpExecArray | null;
    while ((strMatch = stringLiteralRegex.exec(expr)) !== null) {
      const tokens = strMatch[1].split(/\s+/).filter(Boolean);
      for (const t of tokens) {
        if (/^[a-zA-Z0-9_:\-\/\[\]#]+$/.test(t)) {
          classesFound.add(t);
        }
      }
    }
  }

  const arbitraryPattern = /^[a-zA-Z0-9_-]+-\[[^\]]+\]$/;

  for (const cls of classesFound) {
    if (arbitraryPattern.test(cls)) {
      invalidClasses.push(cls);
      warnings.push(`TAILWIND_V2_ARBITRARY_VALUE: Kelas "${cls}" menggunakan arbitrary value [...] yang TIDAK didukung oleh Tailwind CSS v2.2.19.`);
    } else if (!tailwindV2ClassesSet.has(cls) && !isAllowedNonTailwindClass(cls)) {
      invalidClasses.push(cls);
      warnings.push(`TAILWIND_V2_NOT_IN_WHITELIST: Kelas "${cls}" TIDAK terdaftar di stylesheet Tailwind CSS v2.2.19 precompiled (berpotensi silent visual failure).`);
    }
  }

  return { warnings, invalidClasses };
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

export function injectAtFirstScriptStart(html: string, code: string): string {
  const match = html.match(/<script\b(?![^>]*\bsrc\s*=)[^>]*>/i);
  if (match && typeof match.index === 'number') {
    const insertIdx = match.index + match[0].length;
    return html.slice(0, insertIdx) + '\n' + code + '\n' + html.slice(insertIdx);
  }
  return injectBeforeLastScriptClose(html, code);
}

export function transformInlineScripts(html: string, transformFn: (js: string) => string): string {
  return html.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi, (match, openTag, scriptContent, closeTag) => {
    if (/\bsrc\s*=/i.test(openTag)) return match;
    return openTag + transformFn(scriptContent) + closeTag;
  });
}

export function injectVueMixinIntoCreateApp(code: string): string {
  if (!code) return code;
  if (/mixins\s*:\s*\[[^\]]*Pilar1VueScaffoldMixin/.test(code)) return code;

  if (/mixins\s*:\s*\[/.test(code)) {
    return code.replace(/(mixins\s*:\s*\[)/, `$1typeof Pilar1VueScaffoldMixin !== 'undefined' ? Pilar1VueScaffoldMixin : (window.Pilar1VueScaffoldMixin || {}), `);
  }

  const createAppRegex = /((?:Vue\s*\.\s*)?createApp\s*\(\s*\{)/;
  if (createAppRegex.test(code)) {
    return code.replace(
      createAppRegex,
      `$1\n    mixins: [typeof Pilar1VueScaffoldMixin !== 'undefined' ? Pilar1VueScaffoldMixin : (window.Pilar1VueScaffoldMixin || {})],`
    );
  }
  return code;
}

/**
 * Ekstrak nama-nama fungsi yang hilang (MISMATCH_HANDLER) dari issues array.
 * Di-export agar route.ts bisa menggunakannya untuk targeted AI repair call
 * tanpa harus menyuntik stub kosong yang menyesatkan user.
 */
export function extractMissingHandlers(issues: string[]): string[] {
  const missing: string[] = [];
  for (const issue of issues) {
    const m = issue.match(/MISMATCH_HANDLER:\s*Fungsi\s*["']([^"']+)["']/i);
    if (m && m[1] && !missing.includes(m[1])) missing.push(m[1]);
  }
  return missing;
}

/**
 * Ekstrak daftar elemen stub form dari issues array.
 * Di-export agar route.ts dapat mengidentifikasi kolom/form mana yang memerlukan
 * targeted repair atau peringatan eksplisit ke pengguna (POIN A).
 */
export function extractStubFormIssues(issues: string[]): string[] {
  const stubs: string[] = [];
  for (const issue of issues) {
    const m = issue.match(/STUB_FORM_FIELDS:\s*Ditemukan\s*\d+\s*elemen form dengan label\/placeholder template palsu:\s*\[(.*?)\]/i);
    if (m && m[1]) {
      const parts = m[1].split(',').map(s => s.trim()).filter(Boolean);
      for (const p of parts) {
        if (!stubs.includes(p)) stubs.push(p);
      }
    }
  }
  return stubs;
}

/**
 * @deprecated JANGAN GUNAKAN — Fungsi ini menyuntik stub kosong yang membuat
 * prototipe terlihat "lolos" validasi padahal fungsionalnya rusak.
 * Gunakan extractMissingHandlers() + targeted AI repair di route.ts.
 * Dipertahankan sementara agar tidak ada import error; akan dihapus sepenuhnya
 * setelah semua caller dimigrasikan.
 */
export function injectMissingHandlerStubs(html: string, issues: string[]): string {
  // Fungsi ini SENGAJA dibuat no-op (mengembalikan html tanpa perubahan)
  // agar stub palsu tidak bisa lolos diam-diam ke user.
  // Lihat POIN A pada dokumen perbaikan generate kode untuk konteks lengkapnya.
  void issues; // suppress unused warning
  return html;
}

/**
 * Auto-inject area "Manajemen Sistem" untuk Owner/Super Admin bila tidak ada.
 * Idempotent (ditandai data-od-auto), aman dari MISMATCH_HANDLER (tanpa onclick),
 * dan hanya diberi data-access-roles sesuai nama peran Owner dinamis agar tidak bocor ke role lain.
 */
export function findClosingDivIndex(html: string, startIdx: number): number {
  let depth = 0;
  const tagRegex = /<\/?div\b[^>]*>/gi;
  tagRegex.lastIndex = startIdx;
  let match;
  while ((match = tagRegex.exec(html)) !== null) {
    if (match[0].startsWith('</')) {
      depth--;
      if (depth === 0) {
        return match.index;
      }
    } else {
      depth++;
    }
  }
  return -1;
}

export function removeOutsideSuperadminPanel(html: string): string {
  const marker = 'data-od-auto="superadmin-management"';
  const appIdx = html.search(/<div[^>]*id=["']app["']/i);
  if (appIdx === -1) return html;
  const appCloseIdx = findClosingDivIndex(html, appIdx);
  if (appCloseIdx === -1) return html;

  let panelIdx = html.indexOf(marker);
  while (panelIdx !== -1) {
    if (panelIdx > appCloseIdx || panelIdx < appIdx) {
      const divStart = html.lastIndexOf('<div', panelIdx);
      if (divStart !== -1) {
        const divClose = findClosingDivIndex(html, divStart);
        if (divClose !== -1) {
          const divEnd = divClose + '</div>'.length;
          html = html.slice(0, divStart) + html.slice(divEnd);
          return removeOutsideSuperadminPanel(html);
        }
      }
    }
    panelIdx = html.indexOf(marker, panelIdx + marker.length);
  }
  return html;
}

export function injectOwnerManagementSection(html: string, ownerRoleName: string = 'Super Admin'): string {
  if (!html) return html;

  const isVue = /Vue\.createApp\s*\(/.test(html) || /<div[^>]*id=["']app["']/.test(html);

  if (isVue) {
    // 1. Bersihkan seluruh kartu superadmin-management yang diletakkan di luar <div id="app">
    html = removeOutsideSuperadminPanel(html);

    // 2. Jika sudah ada di dalam <div id="app">, tidak perlu diduplikasi
    if (/data-od-auto=["']superadmin-management["']/i.test(html)) {
      return html;
    }

    const vueCard = `
    <!-- Panel Manajemen Sistem Khusus ${ownerRoleName} (Auto-Injected Ramah Vue) -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mt-6" data-od-auto="superadmin-management" v-if="isRoleAllowed(['${ownerRoleName}'])">
      <div class="flex justify-between items-center mb-3">
        <h3 class="text-base font-bold text-gray-900 flex items-center gap-2">
          <i class="fas fa-shield-alt text-blue-600"></i> Manajemen Sistem
        </h3>
        <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">${ownerRoleName}</span>
      </div>
      <p class="text-xs text-gray-500 mb-4">Pengaturan master data, akun staf operasional, dan hak akses modul.</p>
      <div class="flex flex-wrap gap-2">
        <button type="button" @click="bukaModalTambahStaf" class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition">
          + Tambah Akun Staf
        </button>
        <button type="button" @click="bukaModalAturHakAkses" class="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition">
          Atur Hak Akses
        </button>
        <button type="button" @click="nonaktifkanAkunStaf" class="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded-lg transition">
          Nonaktifkan Akun Staf
        </button>
      </div>
    </div>`;

    // 1. Prioritas: Masukkan ke dalam container utama aplikasi (appContainer) sebelum penutupnya
    const appContainerIdx = html.search(/<div[^>]*id=["']appContainer["']/i);
    if (appContainerIdx !== -1) {
      const containerCloseIdx = findClosingDivIndex(html, appContainerIdx);
      if (containerCloseIdx !== -1) {
        return html.slice(0, containerCloseIdx) + vueCard + '\n' + html.slice(containerCloseIdx);
      }
    }

    // 2. Masukkan sebelum penutup <div id="app">
    const appIdx = html.search(/<div[^>]*id=["']app["']/i);
    if (appIdx !== -1) {
      const appCloseIdx = findClosingDivIndex(html, appIdx);
      if (appCloseIdx !== -1) {
        return html.slice(0, appCloseIdx) + vueCard + '\n' + html.slice(appCloseIdx);
      }
    }

    // 3. Fallback Vue: sebelum script
    const scriptIdx = html.indexOf('<script');
    if (scriptIdx !== -1) {
      return html.slice(0, scriptIdx) + vueCard + '\n' + html.slice(scriptIdx);
    }
  }

  // Vanilla Fallback
  const card = `
<div class="card" data-od-auto="superadmin-management" data-access-roles="${ownerRoleName}" style="margin-top:16px;">
  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
    <h3 class="title" style="font-size:16px; margin:0;">Manajemen Sistem</h3>
    <span class="badge badge-info">${ownerRoleName}</span>
  </div>
  <div style="display:flex; flex-wrap:wrap; gap:8px;">
    <button type="button" class="btn-primary" data-access-roles="${ownerRoleName}">Tambah Akun Staf</button>
    <button type="button" class="btn-secondary" data-access-roles="${ownerRoleName}">Atur Hak Akses</button>
    <button type="button" class="btn-danger" data-access-roles="${ownerRoleName}">Nonaktifkan Akun Staf</button>
  </div>
</div>`;

  if (html.includes('</body>')) return html.replace('</body>', `${card}\n</body>`);
  return html + card;
}

export function validateAndRepairGeneratedCode(
  html: string,
  css: string,
  js: string,
  expectedRoles?: string[],
  ownerRoleName?: string
): ValidationReport {
  const issues: string[] = [];
  let repairedHtml = cleanConversationalLeaks(html);
  let repairedJs = js || '';

  // Resolusi nama role Owner dinamis dari session/expectedRoles tanpa keyword matching kaku
  let resolvedOwner = (ownerRoleName || '').trim();
  if (!resolvedOwner && expectedRoles && expectedRoles.length > 0) {
    resolvedOwner = expectedRoles[0].trim();
  }
  if (!resolvedOwner) {
    const matchOwner = html.match(/(?:const|var|let|window\.)OWNER_ROLE_NAME\s*=\s*['"]([^'"]+)['"]/i);
    if (matchOwner) resolvedOwner = matchOwner[1].trim();
  }
  if (!resolvedOwner) {
    resolvedOwner = 'Super Admin';
  }

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
  let combinedJs = (inlineJs + '\n' + repairedJs).trim();


  // 1.5 VALIDASI SINTAKS JAVASCRIPT DENGAN ACORN AST PARSER (Pilar 2)
  // Menolak dan menangkap SyntaxError dengan line & column number akurat
  const definedFunctions = new Set<string>();
  if (combinedJs) {
    try {
      const ast: any = acorn.parse(combinedJs, { ecmaVersion: 'latest', sourceType: 'script', locations: true });
      const astFns = extractFunctionsFromAst(ast);
      for (const fn of astFns) {
        definedFunctions.add(fn);
      }
    } catch (syntaxErr: any) {
      const loc = syntaxErr.loc ? ` (baris ${syntaxErr.loc.line}, kolom ${syntaxErr.loc.column})` : '';
      issues.push(`SYNTAX_ERROR: JavaScript SyntaxError pada script: ${syntaxErr.message}${loc}`);
    }
  }

  // 1.6 Regex Fallback untuk definisi fungsi (menjaga kompatibilitas jika AST gagal parsing)
  let m: RegExpExecArray | null;
  const funcDefRegex = /(?:async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)|(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s+)?(?:function\b|(?:\([^)]*\)|[a-zA-Z_$][a-zA-Z0-9_$]*)\s*=>)|window\.([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s+)?(?:function\b|(?:\([^)]*\)|[a-zA-Z_$][a-zA-Z0-9_$]*)\s*=>)|([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s+)?function/g;
  while ((m = funcDefRegex.exec(combinedJs)) !== null) {
    const fnName = m[1] || m[2] || m[3] || m[4];
    if (fnName) definedFunctions.add(fnName);
  }

  // 1.8 KERANGKA PLUMBING DETERMINISTIK (Pilar 1)
  // Menyediakan implementasi standar yang teruji untuk navigasi tab, login role, dan toast
  // jika aplikasi memuat elemen tab (.tab-btn / showTab) atau sistem otentikasi login
  const isVueApp = /Vue\.createApp\s*\(/.test(combinedJs) || /<div[^>]*id=["']app["']/.test(repairedHtml);
  const hasTabs = repairedHtml.includes('.tab-btn') || repairedHtml.includes('showTab(') || /data-access-roles/i.test(repairedHtml) || /v-for=["'][^"']*tabs/i.test(repairedHtml);
  const hasLogin = repairedHtml.includes('loginScreen') || repairedHtml.includes('loginAs(') || repairedHtml.includes('DEMO_ACCOUNTS') || /v-model=["']loginForm/i.test(repairedHtml);

  const plumbingToInject: string[] = [];

  if (isVueApp) {
    // =========================================================================
    // VUE 3 CDN DETERMINISTIC SCAFFOLD (PILAR 1)
    // Sesuai aturan merge Vue 3: Method komponen AI MENANG jika didefinisikan;
    // Mixin bertindak sebagai fallback safety net anti-MISMATCH_HANDLER.
    // =========================================================================
    if (!combinedJs.includes('Pilar1VueScaffoldMixin')) {
      plumbingToInject.push(`
// Auto-Injected Pilar 1 Vue Scaffold Mixin (Fase 2 & Fase 3)
var OWNER_ROLE_NAME = typeof window !== 'undefined' && window.OWNER_ROLE_NAME ? window.OWNER_ROLE_NAME : '${resolvedOwner}';
if (typeof window !== 'undefined') window.OWNER_ROLE_NAME = OWNER_ROLE_NAME;

var Pilar1VueScaffoldMixin = {
  data() {
    return {
      currentRole: this.currentRole || '',
      isLoggedIn: false,
      activeTab: this.activeTab || 'tabDasbor',
      toast: this.toast || { show: false, visible: false, message: '', type: 'info' }
    };
  },
  methods: {
    isRoleAllowed(roles) {
      if (!roles || !roles.length) return true;
      var owner = typeof window !== 'undefined' && window.OWNER_ROLE_NAME ? window.OWNER_ROLE_NAME : '${resolvedOwner}';
      if (this.currentRole === owner) return true;
      return roles.includes(this.currentRole) || roles.includes('*');
    },
    canEditCurrentTab() {
      if (this.currentTableConfig) {
        var allowed = this.currentTableConfig.roles || this.currentTableConfig.allowRoles || [];
        return this.isRoleAllowed(allowed);
      }
      if (this.tablesConfig) {
        var key = (this.activeTab || '').replace(/^tab_/, '');
        var cfg = this.tablesConfig[key] || this.tablesConfig[this.activeTab];
        if (cfg) {
          var allowedCfg = cfg.roles || cfg.allowRoles || [];
          return this.isRoleAllowed(allowedCfg);
        }
      }
      if (this.tabs && this.tabs.length) {
        var curTab = this.tabs.find(function(t) { return t.id === this.activeTab; }.bind(this));
        if (curTab) {
          var tabRoles = curTab.roles || curTab.allowRoles || [];
          return this.isRoleAllowed(tabRoles);
        }
      }
      var owner = typeof window !== 'undefined' && window.OWNER_ROLE_NAME ? window.OWNER_ROLE_NAME : '${resolvedOwner}';
      return this.currentRole === owner;
    },
    showTab(tabId) {
      this.activeTab = tabId;
    },
    loginAs(role) {
      this.currentRole = role;
      this.isLoggedIn = true;
      var acc = (this.demoAccounts || []).find(function(a) { return a.role === role; });
      if (acc && acc.landingTab) {
        this.showTab(acc.landingTab);
      } else if (this.tabs && this.tabs.length) {
        var first = this.tabs.find(function(t) { return this.isRoleAllowed(t.roles); }.bind(this));
        if (first) this.showTab(first.id);
      }
    },
    logout() {
      this.currentRole = '';
      this.isLoggedIn = false;
      this.activeTab = '';
      this.showToast('Berhasil keluar.', 'info');
    },
    showToast(message, type) {
      type = type || 'info';
      this.toast = { show: true, visible: true, message: message, type: type };
      var self = this;
      setTimeout(function() {
        if (self.toast) {
          self.toast.show = false;
          self.toast.visible = false;
        }
      }, 3000);
    },
    bukaModalTambahStaf() {
      if (typeof this.openCreate === 'function' && this.tablesConfig && this.tablesConfig.pengguna) {
        this.openCreate('pengguna');
      } else {
        this.showToast('Membuka formulir pendaftaran akun staf', 'info');
      }
    },
    bukaModalAturHakAkses() {
      this.showToast('Panel konfigurasi hak akses modul operasional dibuka', 'info');
    },
    nonaktifkanAkunStaf() {
      this.showToast('Pilih akun staf dari tabel pengguna untuk dinonaktifkan', 'warning');
    }
  }
};
if (typeof window !== 'undefined') window.Pilar1VueScaffoldMixin = Pilar1VueScaffoldMixin;

// Auto-hook monkey patch Vue.createApp
(function() {
  if (typeof Vue !== 'undefined' && Vue.createApp && !Vue.__pilar1Patched) {
    var _origCreateApp = Vue.createApp;
    Vue.createApp = function(rootComp, rootProps) {
      rootComp = rootComp || {};
      rootComp.mixins = rootComp.mixins || [];
      if (typeof Pilar1VueScaffoldMixin !== 'undefined' && !rootComp.mixins.includes(Pilar1VueScaffoldMixin)) {
        rootComp.mixins.unshift(Pilar1VueScaffoldMixin);
      }
      var app = _origCreateApp(rootComp, rootProps);
      if (typeof Pilar1VueScaffoldMixin !== 'undefined' && app && typeof app.mixin === 'function') {
        app.mixin(Pilar1VueScaffoldMixin);
      }
      return app;
    };
    Vue.__pilar1Patched = true;
  }
})();
`);
    }

    definedFunctions.add('showTab');
    definedFunctions.add('filterTabsByRole');
    definedFunctions.add('logout');
    definedFunctions.add('loginAs');
    definedFunctions.add('showToast');
    definedFunctions.add('isRoleAllowed');
    definedFunctions.add('canEditCurrentTab');
    definedFunctions.add('bukaModalTambahStaf');
    definedFunctions.add('bukaModalAturHakAkses');
    definedFunctions.add('nonaktifkanAkunStaf');
  } else {
    // VANILLA DOM DETERMINISTIC PLUMBING
    if (hasTabs && !definedFunctions.has('showTab')) {
      plumbingToInject.push(`
function showTab(tabId) {
  try {
    document.querySelectorAll('.tab-content, .tab-pane, [data-tab-content]').forEach(t => {
      t.classList.remove('active');
      t.style.display = 'none';
    });
    document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
    const target = document.getElementById(tabId) || document.getElementById('tab-' + tabId) || document.querySelector('[id*="' + tabId + '"]');
    if (target) {
      target.classList.add('active');
      target.style.display = 'block';
    }
    const targetBtn = document.getElementById('tab-btn-' + tabId) || document.querySelector('[onclick*="' + tabId + '"]');
    if (targetBtn) targetBtn.classList.add('active');
    if (typeof render === 'function') render();
    else if (typeof renderTable === 'function') renderTable();
  } catch (e) { console.log('showTab error', e); }
}
`);
      definedFunctions.add('showTab');
    }

    if (hasTabs && !definedFunctions.has('filterTabsByRole')) {
      plumbingToInject.push(`
// Scaffold Plumbing Deterministik (Pilar 1)
var OWNER_ROLE_NAME = typeof window !== 'undefined' && window.OWNER_ROLE_NAME ? window.OWNER_ROLE_NAME : '${resolvedOwner}';
if (typeof window !== 'undefined') window.OWNER_ROLE_NAME = OWNER_ROLE_NAME;

function filterTabsByRole(role) {
  try {
    const ownerName = typeof window !== 'undefined' && window.OWNER_ROLE_NAME ? window.OWNER_ROLE_NAME : OWNER_ROLE_NAME;
    document.querySelectorAll('.tab-btn').forEach(btn => {
      const roles = btn.getAttribute('data-access-roles');
      if (!roles) return;
      const allowed = roles.split(',').map(r => r.trim().toLowerCase());
      const isOwner = Boolean(ownerName && role && String(role).trim().toLowerCase() === String(ownerName).trim().toLowerCase());
      if (isOwner || (role && (allowed.includes(String(role).toLowerCase()) || allowed.includes('*') || allowed.includes('all')))) {
        btn.style.display = 'inline-flex';
      } else {
        btn.style.display = 'none';
      }
    });
  } catch (e) { console.log('filterTabs error', e); }
}
`);
      definedFunctions.add('filterTabsByRole');
    }

    if (hasLogin && !definedFunctions.has('logout')) {
      plumbingToInject.push(`
function logout() {
  try {
    currentRole = '';
    const loginEl = document.querySelector('#loginScreen, .login-screen');
    const appEl = document.querySelector('#appContainer, .app-container');
    if (appEl) appEl.style.display = 'none';
    if (loginEl) loginEl.style.display = 'flex';
    if (typeof showToast === 'function') showToast('Berhasil keluar. Silakan login kembali.', 'info');
  } catch (e) { console.log('logout error', e); }
}
`);
      definedFunctions.add('logout');
    }

    if (hasLogin && !definedFunctions.has('loginAs')) {
      plumbingToInject.push(`
function loginAs(role) {
  try {
    currentRole = role;
    const loginEl = document.querySelector('#loginScreen, .login-screen');
    const appEl = document.querySelector('#appContainer, .app-container');
    if (loginEl) loginEl.style.display = 'none';
    if (appEl) appEl.style.display = 'block';
    const badge = document.querySelector('#currentRoleBadge, #userRoleBadge, .role-badge');
    if (badge) badge.innerText = role;
    if (typeof filterTabsByRole === 'function') filterTabsByRole(role);
    const matched = (typeof DEMO_ACCOUNTS !== 'undefined' ? DEMO_ACCOUNTS : []).find(a => a.role === role);
    if (matched && matched.landingTab && typeof showTab === 'function') {
      showTab(matched.landingTab);
    } else if (typeof showTab === 'function') {
      const firstTab = document.querySelector('.tab-btn:not([style*="display: none"])');
      const tabMatch = firstTab?.getAttribute('onclick')?.match(/showTab\\(['"]([^'"]+)['"]\\)/);
      if (tabMatch && tabMatch[1]) {
        showTab(tabMatch[1]);
      } else if (firstTab) {
        firstTab.click();
      }
    }
    if (typeof render === 'function') render();
    else if (typeof renderTable === 'function') renderTable();
  } catch (e) { console.log('loginAs error', e); }
}
`);
      definedFunctions.add('loginAs');
    }

    if (!definedFunctions.has('showToast')) {
      plumbingToInject.push(`
function showToast(msg, type = 'info') {
  try {
    let t = document.getElementById('appToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'appToast';
      t.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#1e293b;color:#fff;padding:12px 20px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:9999;font-size:14px;transition:opacity 0.3s ease;';
      document.body.appendChild(t);
    }
    t.innerText = (type === 'error' ? '❌ ' : type === 'success' ? '✅ ' : 'ℹ️ ') + msg;
    t.style.display = 'block';
    t.style.opacity = '1';
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.style.display = 'none', 300); }, 3000);
  } catch (e) { console.log('showToast', msg); }
}
`);
      definedFunctions.add('showToast');
    }
  }

  // Inisialisasi state array otomatis jika fungsi CRUD merujuk items / data tanpa deklarasi
  if (/\bitems\s*\.\s*(find|filter|map|push|some|every|forEach)\b/.test(combinedJs) && !/\b(?:let|var|const)\s+items\b/.test(combinedJs)) {
    plumbingToInject.push(`
var items = typeof items !== 'undefined' ? items : [
  { id: '1', nama: 'Contoh Data 1', status: 'Aktif' },
  { id: '2', nama: 'Contoh Data 2', status: 'Aktif' }
];`);
  }
  if (/\bdata\s*\.\s*(find|filter|map|push|some|every|forEach)\b/.test(combinedJs) && !/\b(?:let|var|const)\s+data\b/.test(combinedJs)) {
    plumbingToInject.push(`
var data = typeof data !== 'undefined' ? data : [
  { id: '1', nama: 'Contoh Data 1', status: 'Aktif' },
  { id: '2', nama: 'Contoh Data 2', status: 'Aktif' }
];`);
  }
  if (/DEMO_ACCOUNTS/.test(combinedJs) && !/window\.DEMO_ACCOUNTS\s*=/.test(combinedJs)) {
    plumbingToInject.push(`
if (typeof DEMO_ACCOUNTS !== 'undefined' && typeof window !== 'undefined') {
  window.DEMO_ACCOUNTS = DEMO_ACCOUNTS;
}`);
  }
  const alreadyHasOwnerRole = /(?:const|let|var|window\.)OWNER_ROLE_NAME\s*=/.test(combinedJs) || plumbingToInject.some(p => p.includes('OWNER_ROLE_NAME'));
  if (!alreadyHasOwnerRole) {
    plumbingToInject.push(`
var OWNER_ROLE_NAME = typeof window !== 'undefined' && window.OWNER_ROLE_NAME ? window.OWNER_ROLE_NAME : '${resolvedOwner}';
if (typeof window !== 'undefined') window.OWNER_ROLE_NAME = OWNER_ROLE_NAME;`);
  }

  if (plumbingToInject.length > 0) {
    const codeChunk = plumbingToInject.join('\n');
    if (isVueApp) {
      repairedHtml = injectAtFirstScriptStart(repairedHtml, codeChunk);
    } else {
      repairedHtml = injectBeforeLastScriptClose(repairedHtml, codeChunk);
    }
    combinedJs = (combinedJs + '\n' + codeChunk).trim();
  }

  if (isVueApp) {
    // 1. Perbaikan manipulasi DOM manual pada loginScreen/appContainer (Bug 2)
    const domRepair = repairVueManualDomManipulation(repairedHtml, repairedJs);
    repairedHtml = domRepair.html;
    repairedJs = domRepair.js;

    // 2. Perbaikan role-check hardcode pada canEditCurrentTab (Bug 3)
    repairedJs = repairVueHardcodedRoleChecks(repairedJs);

    // 3. Transformasi script inline di HTML (Bug 2, Bug 3, Bug 4)
    repairedHtml = transformInlineScripts(repairedHtml, (s) => {
      let script = repairVueManualDomManipulation('', s).js;
      script = repairVueHardcodedRoleChecks(script);
      script = injectVueMixinIntoCreateApp(script);
      return script;
    });

    repairedJs = injectVueMixinIntoCreateApp(repairedJs);
  }

  // 2. Pemeriksaan Keselarasan Event Handler (onclick="..." vs JS Function Definitions)
  const onclickFunctionNames: string[] = [];
  const onclickRegex = /onclick=["']\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;
  while ((m = onclickRegex.exec(repairedHtml)) !== null) {
    onclickFunctionNames.push(m[1]);
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
      if (!resolved && (fn === 'logout' || fn === 'showTab' || fn === 'loginAs' || fn === 'filterTabsByRole' || fn === 'showToast')) {
        let fallbackFn = '';
        if (fn === 'logout') {
          fallbackFn = `
function logout() {
  try {
    currentRole = '';
    const loginEl = document.querySelector('#loginScreen, .login-screen');
    const appEl = document.querySelector('#appContainer, .app-container');
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
    document.querySelectorAll('.tab-content, .tab-pane, [data-tab-content]').forEach(t => {
      t.classList.remove('active');
      t.style.display = 'none';
    });
    document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
    const target = document.getElementById(tabId) || document.getElementById('tab-' + tabId) || document.querySelector('[id*="' + tabId + '"]');
    if (target) {
      target.classList.add('active');
      target.style.display = 'block';
    }
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
    const loginEl = document.querySelector('#loginScreen, .login-screen');
    const appEl = document.querySelector('#appContainer, .app-container');
    if (loginEl) loginEl.style.display = 'none';
    if (appEl) appEl.style.display = 'block';
    const badge = document.querySelector('#currentRoleBadge, #userRoleBadge, .role-badge');
    if (badge) badge.innerText = role;
    if (typeof filterTabsByRole === 'function') filterTabsByRole(role);
    if (typeof showTab === 'function') {
      const firstTab = document.querySelector('.tab-btn:not([style*="display: none"])');
      const tabMatch = firstTab?.getAttribute('onclick')?.match(/showTab\\(['"]([^'"]+)['"]\\)/);
      if (tabMatch && tabMatch[1]) showTab(tabMatch[1]);
      else if (firstTab) firstTab.click();
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
    var ownerName = typeof window.OWNER_ROLE_NAME !== 'undefined' ? window.OWNER_ROLE_NAME : (typeof OWNER_ROLE_NAME !== 'undefined' ? OWNER_ROLE_NAME : '${resolvedOwner}');
    document.querySelectorAll('.tab-btn').forEach(btn => {
      const roles = btn.getAttribute('data-access-roles');
      if (!roles) return;
      const allowed = roles.split(',').map(r => r.trim().toLowerCase());
      const isOwner = Boolean(ownerName && role && String(role).trim().toLowerCase() === String(ownerName).trim().toLowerCase());
      if (isOwner || (role && (allowed.includes(String(role).toLowerCase()) || allowed.includes('*') || allowed.includes('all')))) {
        btn.style.display = 'inline-flex';
      } else {
        btn.style.display = 'none';
      }
    });
  } catch (e) { console.log('filterTabs error', e); }
}
`;
        } else if (fn === 'showToast') {
          fallbackFn = `
function showToast(msg, type = 'info') {
  try {
    let t = document.getElementById('appToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'appToast';
      t.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#1e293b;color:#fff;padding:12px 20px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:9999;font-size:14px;transition:opacity 0.3s ease;';
      document.body.appendChild(t);
    }
    t.innerText = (type === 'error' ? '❌ ' : type === 'success' ? '✅ ' : 'ℹ️ ') + msg;
    t.style.display = 'block';
    t.style.opacity = '1';
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.style.display = 'none', 300); }, 3000);
  } catch (e) { console.log('showToast', msg); }
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
      } else if (elemId === 'currentRoleBadge' || elemId === 'userRoleBadge') {
        if (repairedHtml.includes('</body>')) {
          repairedHtml = repairedHtml.replace('</body>', `  <span id="${elemId}" style="display:none;"></span>\n</body>`);
        } else {
          repairedHtml += `\n<span id="${elemId}" style="display:none;"></span>`;
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

  // 9b. Auto-Repair: Pastikan CSS memiliki aturan display untuk .tab-content (Anti-Stacked Pages & Normalisasi Tab)
  if (repairedHtml.includes('tab-content') || repairedHtml.includes('tab-pane') || repairedHtml.includes('showTab(')) {
    const hasTabContentCss = /\.tab-content[^{]*\{[^}]*display\s*:\s*none/i.test(repairedHtml) ||
                             /\.tab-pane[^{]*\{[^}]*display\s*:\s*none/i.test(repairedHtml);
    if (!hasTabContentCss) {
      const tabCssRule = `\n    /* Auto-Injected Tab Isolation CSS (Poin 54) */\n    .tab-content, .tab-pane { display: none; }\n    .tab-content.active, .tab-pane.active { display: block; }\n`;
      if (repairedHtml.includes('</style>')) {
        repairedHtml = repairedHtml.replace('</style>', `${tabCssRule}</style>`);
      } else if (repairedHtml.includes('</head>')) {
        repairedHtml = repairedHtml.replace('</head>', `  <style>${tabCssRule}  </style>\n</head>`);
      } else {
        repairedHtml = `<style>${tabCssRule}</style>\n` + repairedHtml;
      }
    }
  }

  // 10. Pemeriksaan Integritas Pembatasan Akses Role per Tab (Poin 40 — data-access-roles)
  // Jika kode memiliki loginAs() atau multi-role logic, SETIAP .tab-btn WAJIB punya data-access-roles
  let hasLoginAsFunc = /function\s+loginAs\s*\(/.test(combinedJs) || /loginAs\s*=\s*(function|\()/.test(combinedJs);
  const hasMultiRoleLogic = /currentRole|loginAs|filterTabsByRole/i.test(combinedJs);

  const isMultiRoleApp = Boolean(expectedRoles && expectedRoles.length > 1);

  if (hasMultiRoleLogic || hasLoginAsFunc || isMultiRoleApp) {
    // Cek apakah ada fungsi filterTabsByRole
    let hasFilterTabsByRole = /filterTabsByRole\s*\(/.test(combinedJs) ||
                                 /\.getAttribute\s*\(\s*['"]data-access-roles['"]\s*\)/.test(combinedJs) ||
                                 (isVueApp && /isRoleAllowed\s*\(/.test(combinedJs));

    const isVueTabs = isVueApp && (/v-for=["'][^"']*tabs/i.test(repairedHtml) || repairedHtml.includes('isRoleAllowed('));

    if (isVueTabs) {
      // TAB GATING PADA VUE 3 CDN (Fase 2)
      hasFilterTabsByRole = true;

      if (isMultiRoleApp) {
        const tabRolesFromJs: string[] = [];
        const rolesArrayMatches = [...combinedJs.matchAll(/roles\s*:\s*\[([^\]]+)\]/gi)];
        for (const rm of rolesArrayMatches) {
          const itemRoles = rm[1].split(',').map(s => s.replace(/['"]/g, '').trim().toLowerCase()).filter(Boolean);
          tabRolesFromJs.push(...itemRoles);
        }

        const missingRoleTabs = expectedRoles!.filter(role => {
          const roleNorm = normalizeRoleForTabMatch(role);
          return !tabRolesFromJs.some(ar => {
            const arNorm = normalizeRoleForTabMatch(ar);
            return arNorm === roleNorm || arNorm.includes(roleNorm) || roleNorm.includes(arNorm);
          });
        });

        if (missingRoleTabs.length > 0) {
          issues.push(
            `ROLE_MISSING_TAB_NAVIGATION: Peran [${missingRoleTabs.join(', ')}] TIDAK memiliki tab khusus dengan hak akses role di array tabs. ` +
            `Setiap peran dalam Brief Kebutuhan WAJIB memiliki tab dan tampilan UI yang relevan dengan Job Description-nya!`
          );

          // Auto-repair: Injeksi tab yang hilang langsung ke dalam array tabs di data() Vue
          const functionalTabLabelInner = (role: string): { emoji: string; label: string } => {
            const r = role.trim().toLowerCase();
            if (/super\s*admin|admin$|^admin|pengelola/.test(r)) return { emoji: '⚙️', label: 'Kelola Sistem' };
            if (/anggota|member|user|pelanggan|penyewa|pasien|siswa|customer|buyer|nasabah|donatur|penerima|warga|tamu/.test(r)) return { emoji: '🪪', label: 'Pesanan & Info Saya' };
            if (/kasir|cashier/.test(r)) return { emoji: '🛒', label: 'Transaksi Penjualan' };
            if (/laundry|cuci|setrika|wash/.test(r)) return { emoji: '🧺', label: 'Operasional Cuci & Setrika' };
            if (/dokter|doctor|hewan/.test(r)) return { emoji: '🐾', label: 'Pemeriksaan & Perawatan' };
            if (/perawat|nurse|bidan|apoteker|farmasi|petugas/.test(r)) return { emoji: '💊', label: 'Operasional & Tugas Harian' };
            if (/resepsionis|front\s*office|receptionist|loket/.test(r)) return { emoji: '📋', label: 'Pendaftaran & Antrian' };
            if (/manajer|manager|supervisor|pengawas|kepala/.test(r)) return { emoji: '📈', label: 'Monitoring & Persetujuan' };
            if (/pemilik|owner|direktur|director|pengurus/.test(r)) return { emoji: '📊', label: 'Laporan & Bisnis' };
            if (/gudang|warehouse|stok|inventory/.test(r)) return { emoji: '📦', label: 'Stok & Gudang' };
            if (/mekanik|montir|teknisi|operator|maintenance/.test(r)) return { emoji: '🔧', label: 'Pengerjaan & Servis' };
            if (/kurir|driver|sopir|logistik/.test(r)) return { emoji: '🚚', label: 'Pengiriman' };
            if (/terapis|trainer|instruktur|guru|pengajar|tutor/.test(r)) return { emoji: '🎓', label: 'Jadwal & Sesi' };
            if (/agen|sales|marketing/.test(r)) return { emoji: '🤝', label: 'Prospek & Penjualan' };
            return { emoji: '📌', label: `Kelola ${role.trim()}` };
          };

          const successfullyInjectedRoles: string[] = [];

          for (const missingRole of missingRoleTabs) {
            const roleId = missingRole.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
            const { emoji, label } = functionalTabLabelInner(missingRole);
            const newTabEntry = `{ id: 'tab_${roleId}', label: '${emoji} ${label}', roles: ['${missingRole}'], icon: '${emoji}' }`;

            let injected = false;
            // Cari array tabs: [ ... ] di dalam data() dan tambahkan entry baru sebelum penutup ] array tabs yang sebenarnya
            const tabsIdx = repairedHtml.search(/\btabs\s*:\s*\[/);
            if (tabsIdx !== -1) {
              const openBracket = repairedHtml.indexOf('[', tabsIdx);
              const closeBracket = findMatchingArrayBracket(repairedHtml, openBracket);
              if (openBracket !== -1 && closeBracket !== -1) {
                const inner = repairedHtml.slice(openBracket + 1, closeBracket);
                const trimmedInner = inner.trimEnd();
                const sep = trimmedInner.length > 0 && !trimmedInner.endsWith(',') ? ',\n            ' : '\n            ';
                repairedHtml =
                  repairedHtml.slice(0, openBracket + 1) +
                  inner +
                  sep +
                  newTabEntry +
                  '\n          ' +
                  repairedHtml.slice(closeBracket);
                injected = true;
              }
            }

            // Pastikan template memiliki container untuk tab yang diinjeksi jika belum ada
            if (!repairedHtml.includes(`tab_${roleId}`)) {
              if (repairedHtml.includes('id="appContainer"') || repairedHtml.includes("id='appContainer'")) {
                const containerMatch = repairedHtml.match(/<div\b[^>]*id=["']appContainer["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>/i);
                if (containerMatch) {
                  const tabPaneContent = `\n        <!-- Tab Auto-Injected: ${label} -->\n        <div v-show="activeTab === 'tab_${roleId}'" class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">\n          <div class="flex justify-between items-center border-b pb-4">\n            <h2 class="text-xl font-bold text-gray-800">${emoji} ${label}</h2>\n            <span class="text-xs px-2.5 py-1 bg-blue-100 text-blue-800 font-semibold rounded-full">${missingRole}</span>\n          </div>\n          <p class="text-gray-600 text-sm">Area kerja dan modul operasional untuk peran ${missingRole}.</p>\n        </div>`;
                  const insertPos = containerMatch.index! + containerMatch[0].lastIndexOf('</div>');
                  repairedHtml = repairedHtml.slice(0, insertPos) + tabPaneContent + '\n      ' + repairedHtml.slice(insertPos);
                }
              }
            }

            if (injected) {
              successfullyInjectedRoles.push(missingRole);
            }
          }
        }
      }
    }

    // Cari semua tab-btn button (Vanilla DOM)
    const tabBtnMatches = [...repairedHtml.matchAll(/<button[^>]*class=[^>]*tab-btn[^>]*>/gi)];
    const tabBtnsWithoutAccessRoles = tabBtnMatches.filter(m => !m[0].includes('data-access-roles'));

    // Poin 54: Jika aplikasi multi-role, WAJIB memiliki navigasi tab untuk memisahkan fitur antar-peran!
    if (isMultiRoleApp && !isVueTabs && tabBtnMatches.length === 0) {
      issues.push(
        `MULTI_ROLE_MISSING_TABS: Aplikasi multi-role (${expectedRoles!.join(', ')}) WAJIB memiliki navigasi tab (<button class="tab-btn" data-access-roles="...">) untuk masing-masing peran! ` +
        `DILARANG menumpuk seluruh fitur ke dalam satu tampilan statis tanpa pemisahan peran melalui tab.`
      );
    }

    if (!isVueTabs && tabBtnsWithoutAccessRoles.length > 0) {
      issues.push(
        `ROLE_GATING_MISSING_DATA_ATTR: Ditemukan ${tabBtnsWithoutAccessRoles.length} tombol tab-btn TANPA atribut data-access-roles. ` +
        `WAJIB tambahkan data-access-roles="RoleA,RoleB" pada SETIAP <button class="tab-btn"> ` +
        `agar filterTabsByRole() bekerja generik tanpa hardcoded getElementById. ` +
        `Contoh: data-access-roles="Super Admin,Dokter"`
      );
    }

    // Poin 55: Pastikan setiap peran resmi memiliki setidaknya 1 tab navigasi khusus
    if (isMultiRoleApp && !isVueTabs && tabBtnMatches.length > 0) {
      const tabAccessRoles = [...repairedHtml.matchAll(/data-access-roles\s*=\s*['"]([^'"]+)['"]/gi)]
        .flatMap(m => m[1].split(',').map(r => r.trim().toLowerCase()))
        .filter((r) => r && !/\$\{|%\{|\{\{|<%|<%=|\bcurrentRole\b/i.test(r));

      const missingRoleTabs = expectedRoles!.filter(role => {
        const roleNorm = normalizeRoleForTabMatch(role);
        return !tabAccessRoles.some(ar => {
          const arNorm = normalizeRoleForTabMatch(ar);
          return arNorm === roleNorm || arNorm.includes(roleNorm) || roleNorm.includes(arNorm);
        });
      });

      // Auto-repair cerdas: Ubah label tab peran mentah (misal: "⚙️ Super Admin" -> "⚙️ Kelola Sistem",
      // "💳 Anggota" -> "🪪 Kartu Anggota Digital", "📈 Menu Manajer" -> "📈 Monitoring & Persetujuan")
      const functionalTabLabel = (role: string): { emoji: string; label: string } => {
        const r = role.trim().toLowerCase();
        if (r === resolvedOwner.toLowerCase()) return { emoji: '⚙️', label: 'Kelola Sistem' };
        if (/super\s*admin|admin$|^admin|pengelola/.test(r)) return { emoji: '⚙️', label: 'Kelola Sistem' };
        if (/anggota|member|user|pelanggan|penyewa|pasien|siswa|customer|buyer|nasabah|donatur|penerima|warga|tamu/.test(r)) {
          return { emoji: '🪪', label: 'Pesanan & Kartu Saya' };
        }
        if (/kasir|cashier/.test(r)) return { emoji: '🛒', label: 'Transaksi Penjualan' };
        if (/laundry|cuci|setrika|wash/.test(r)) return { emoji: '🧺', label: 'Operasional Cuci & Setrika' };
        if (/dokter|doctor/.test(r)) return { emoji: '🩺', label: 'Pemeriksaan Pasien' };
        if (/perawat|nurse|bidan|apoteker|farmasi/.test(r)) return { emoji: '💊', label: 'Asuhan & Obat' };
        if (/petugas\s*perawat|petugas.*hewan|klinik\s*hewan|drh|veteriner|vet\b/.test(r)) return { emoji: '🐾', label: 'Perawatan & Pemeriksaan Hewan' };
        if (/petugas/.test(r)) return { emoji: '💊', label: 'Operasional & Tugas Harian' };
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

      if (missingRoleTabs.length > 0) {
        issues.push(
          `ROLE_MISSING_TAB_NAVIGATION: Peran [${missingRoleTabs.join(', ')}] TIDAK memiliki tab khusus dengan data-access-roles="${missingRoleTabs.join(',')}". ` +
          `Setiap peran dalam Brief Kebutuhan WAJIB memiliki tab dan tampilan UI yang relevan dengan Job Description-nya!`
        );

        const successfullyInjectedVanilla: string[] = [];

        for (const missingRole of missingRoleTabs) {
          const roleId = missingRole.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
          const { emoji, label } = functionalTabLabel(missingRole);

          let injected = false;
          // Cari tombol tab-btn terakhir dan sisipkan tombol baru setelahnya
          const lastTabBtnMatch = [...repairedHtml.matchAll(/<button[^>]*class=[^>]*tab-btn[^>]*>[\s\S]*?<\/button>/gi)].pop();
          if (lastTabBtnMatch && lastTabBtnMatch.index !== undefined) {
            const insertPos = lastTabBtnMatch.index + lastTabBtnMatch[0].length;
            const newBtn = `\n        <button type="button" class="tab-btn px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 border-b-2 border-transparent" data-tab="tab_${roleId}" data-access-roles="${missingRole}" onclick="showTab('tab_${roleId}')">${emoji} ${label}</button>`;
            repairedHtml = repairedHtml.slice(0, insertPos) + newBtn + repairedHtml.slice(insertPos);
            injected = true;
          }

          // Injeksi container tab-pane jika belum ada
          if (!repairedHtml.includes(`id="tab_${roleId}"`) && !repairedHtml.includes(`id='tab_${roleId}'`)) {
            const appContainerMatch = repairedHtml.match(/<div\b[^>]*id=["']appContainer["'][^>]*>([\s\S]*?)<\/body>/i);
            if (appContainerMatch) {
              const tabPane = `\n      <!-- Tab Auto-Injected: ${label} -->\n      <div id="tab_${roleId}" class="tab-pane tab-content p-6 space-y-4" style="display: none;">\n        <div class="flex justify-between items-center border-b pb-4">\n          <h2 class="text-xl font-bold text-gray-800">${emoji} ${label}</h2>\n          <span class="text-xs px-2.5 py-1 bg-blue-100 text-blue-800 font-semibold rounded-full">${missingRole}</span>\n        </div>\n        <p class="text-gray-600 text-sm">Area kerja dan modul operasional untuk peran ${missingRole}.</p>\n      </div>`;
              const insertPos = repairedHtml.lastIndexOf('</div>', repairedHtml.indexOf('</body>'));
              if (insertPos !== -1) {
                repairedHtml = repairedHtml.slice(0, insertPos) + tabPane + '\n    ' + repairedHtml.slice(insertPos);
              }
            }
          }

          if (injected) {
            successfullyInjectedVanilla.push(missingRole);
          }
        }
      }

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
  var ownerName = typeof window.OWNER_ROLE_NAME !== 'undefined' ? window.OWNER_ROLE_NAME : (typeof OWNER_ROLE_NAME !== 'undefined' ? OWNER_ROLE_NAME : '${resolvedOwner}');
  document.querySelectorAll('.tab-btn').forEach(function(btn) {
    var allowed = (btn.getAttribute('data-access-roles') || '').split(',').map(function(r) { return r.trim().toLowerCase(); });
    var isOwner = Boolean(ownerName && role && String(role).trim().toLowerCase() === String(ownerName).trim().toLowerCase());
    btn.style.display = (isOwner || (role && allowed.indexOf(String(role).trim().toLowerCase()) !== -1)) ? '' : 'none';
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
  var badge = typeof document !== 'undefined' && document.querySelector ? document.querySelector('#currentRoleBadge, #userRoleBadge, .role-badge') : null;
  if (badge) badge.innerText = role;
  var matched = (typeof DEMO_ACCOUNTS !== 'undefined' ? DEMO_ACCOUNTS : []).find(function(a) { return a.role === role; });
  if (matched && matched.landingTab && typeof showTab === 'function') {
    showTab(matched.landingTab);
  } else {
    var firstVisible = Array.from(document.querySelectorAll('.tab-btn')).find(function(b) { return b.style.display !== 'none'; });
    if (firstVisible) firstVisible.click();
  }
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

    // 10a.2 Verifikasi Aktivasi Landing Tab Saat Login (Bagian A: Sinkronisasi Tab & Role)
    // Pada aplikasi multi-role bertab, fungsi login WAJIB mengalihkan tab aktif (memanggil showTab/landingTab atau mengklik tab pertama yang terlihat).
    // DILARANG membiarkan tab Super Admin tetap terbuka untuk semua peran yang login!
    if (isMultiRoleApp && (tabBtnMatches.length > 0 || repairedHtml.includes('tab-content') || repairedHtml.includes('tab-pane') || isVueApp)) {
      const loginFuncMatch = combinedJs.match(/(?:function\s+(?:loginAs|switchRole|selectRole)\s*\(([^)]*)\)|(?:loginAs|switchRole|selectRole)\s*=\s*(?:async\s+)?function\s*\(([^)]*)\)|(?:loginAs|switchRole|selectRole)\s*=\s*\(([^)]*)\)\s*=>|(?:\bloginAs|switchRole|selectRole)\s*\(([^)]*)\)\s*\{)\s*\{?([\s\S]*?)\n\s*\}/);
      
      const hasTabSwitchInLogin = loginFuncMatch ? (
        /showTab\s*\(|switchTab\s*\(|openTab\s*\(|selectTab\s*\(|\.click\s*\(|\.classList\.add\s*\(\s*['"]active['"]\s*\)|landingTab|activeTab\s*=/i.test(loginFuncMatch[5] || loginFuncMatch[4] || loginFuncMatch[0])
      ) : (isVueApp && /activeTab|landingTab|showTab/.test(combinedJs));

      if (!hasTabSwitchInLogin) {
        // Cek apakah fungsi showTab/setara ada di script untuk auto-repair
        const hasShowTabFunc = /(?:function\s+showTab|showTab\s*=)/.test(combinedJs);
        let repairedLoginTab = false;

        if (hasShowTabFunc && repairedHtml.includes('function loginAs')) {
          const loginTabInjectCode = `
      // Auto-repaired landing tab switch (Bagian A)
      var matchedAcc = (typeof DEMO_ACCOUNTS !== 'undefined' ? DEMO_ACCOUNTS : []).find(function(a) { return a.role === role; });
      if (matchedAcc && matchedAcc.landingTab && typeof showTab === 'function') {
        showTab(matchedAcc.landingTab);
      } else {
        var firstVisibleTab = Array.from(document.querySelectorAll('.tab-btn')).find(function(b) { return b.style.display !== 'none'; });
        if (firstVisibleTab) firstVisibleTab.click();
      }`;

          if (/function loginAs\s*\([^)]*\)\s*\{[\s\S]*?render\(\)/.test(repairedHtml)) {
            repairedHtml = repairedHtml.replace(
              /(function loginAs\s*\([^)]*\)\s*\{[\s\S]*?)(render\(\);?)/,
              `$1${loginTabInjectCode}\n      $2`
            );
            repairedLoginTab = true;
          } else {
            repairedHtml = repairedHtml.replace(
              /(function loginAs\s*\([^)]*\)\s*\{[\s\S]*?)(\n\s*\})/,
              `$1${loginTabInjectCode}$2`
            );
            repairedLoginTab = true;
          }
        }

        if (!repairedLoginTab) {
          issues.push(
            `LOGIN_TAB_NOT_SWITCHED: Fungsi loginAs(role) tidak mengaktifkan tab landing per role ` +
            `(tidak memanggil showTab(landingTab) atau firstVisibleTab.click()). ` +
            `Akibatnya seluruh role yang login akan melihat tampilan tab yang sama persis!`
          );
        }
      }
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

      // Manajemen akun staf adalah capability eksklusif Owner/Super Admin.
      if (hasRequiredSuperAdmin || Boolean(resolvedOwner)) {
        if (isVueApp) {
          repairedHtml = removeOutsideSuperadminPanel(repairedHtml);
        }

        const accountManagementTerms = /akun\s+staf|kelola\s+(?:akun|pengguna|user)|manajemen\s+(?:akun|pengguna|user)|role\s*&\s*permission|hak\s+akses|tambah\s+staf|hapus\s+staf|nonaktifkan\s+akun/i;
        
        // Pada aplikasi Vue, tombol manajemen WAJIB berada di dalam <div id="app">
        let htmlToScan = repairedHtml;
        if (isVueApp) {
          const appMatch = repairedHtml.search(/<div[^>]*id=["']app["']/i);
          if (appMatch !== -1) {
            const appEnd = findClosingDivIndex(repairedHtml, appMatch);
            if (appEnd !== -1) {
              htmlToScan = repairedHtml.slice(appMatch, appEnd);
            }
          }
        }

        const gatedButtons = [...htmlToScan.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)];
        let managementButtons = gatedButtons.filter((match) => accountManagementTerms.test(match[2].replace(/<[^>]+>/g, ' ')));

        if (managementButtons.length === 0 || !accountManagementTerms.test(htmlToScan)) {
          // Auto-inject area manajemen sistem agar tidak memblokir generation.
          repairedHtml = injectOwnerManagementSection(repairedHtml, resolvedOwner);
          const rescanned = [...repairedHtml.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)];
          managementButtons = rescanned.filter((match) => accountManagementTerms.test(match[2].replace(/<[^>]+>/g, ' ')));

          // Jika auto-inject pun gagal, baru catat sebagai issue.
          if (managementButtons.length === 0) {
            issues.push(
              `SUPER_ADMIN_MANAGEMENT_MISSING: Aplikasi wajib menyediakan area manajemen akun staf, role, dan permission untuk role ${resolvedOwner}.`
            );
          }
        }

        const isOwnerRole = (r: string) => r.toLowerCase() === resolvedOwner.toLowerCase() || isSuperAdminRole(r);
        for (const match of managementButtons) {
          const access = match[1].match(/data-access-roles\s*=\s*["']([^"']+)["']/i)?.[1] || '';
          // Tombol tanpa data-access-roles diasumsikan berada di dalam tab yang
          // sudah digate Owner; hanya periksa yang punya atribut eksplisit.
          if (!access) continue;
          const accessRoles = access.split(',').map((role) => role.trim()).filter(Boolean);
          if (!accessRoles.some(isOwnerRole) || accessRoles.some((role) => !isOwnerRole(role))) {
            issues.push(
              `STAFF_ACCOUNT_ACCESS_LEAK: Tombol manajemen akun staf/permission hanya boleh memiliki data-access-roles="${resolvedOwner}" (saat ini: "${access}").`
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
                                 /type\s*=\s*['"](?:text|email)['"][^>]*id\s*=\s*['"][^'"]*(?:user|login|email)[^'"]*['"]/i.test(repairedHtml) ||
                                 /v-model\s*=\s*['"][^'"]*(?:username|user|login)[^'"]*['"]/i.test(repairedHtml);
        const hasPasswordInput = /type\s*=\s*['"]password['"]/i.test(repairedHtml);
        const hasLoginHandler = /function\s+handleLogin\s*\(/.test(combinedJs) || /handleLogin\s*=\s*(function|\()/.test(combinedJs) || /\bhandleLogin\s*\(/.test(combinedJs) || hasLoginAsFunc;

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
        
        // Gate Vanilla JS: appContainer dengan style="display:none" di markup awal
        const hasVanillaJsGate = /id\s*=\s*['"]loginScreen['"]/i.test(repairedHtml) &&
                                   /id\s*=\s*['"]appContainer['"][^>]*style\s*=\s*['"][^'"]*display\s*:\s*none/i.test(repairedHtml);

        // Gate Vue 3 Reaktif: v-if="!isLoggedIn" atau v-show="!isLoggedIn" pada loginScreen
        // dikombinasikan dengan v-else atau v-if="isLoggedIn" pada appContainer.
        // Ini sudah aman secara reaktif — seluruh DOM staf tidak pernah terrender saat belum login.
        const hasVueLoginScreenVif = /id\s*=\s*['"]loginScreen['"][^>]*v-(?:if|show)\s*=\s*["']!(?:currentRole|isLoggedIn)["']/i.test(repairedHtml) ||
                                      /v-(?:if|show)\s*=\s*["']!(?:currentRole|isLoggedIn)["'][^>]*id\s*=\s*['"]loginScreen['"]/i.test(repairedHtml);
        const hasVueAppContainerVif = /id\s*=\s*['"]appContainer['"][^>]*v-(?:if|show|else)\b/i.test(repairedHtml) ||
                                       /v-(?:else|if\s*=\s*["'](?:currentRole|isLoggedIn)["'])[^>]*id\s*=\s*['"]appContainer['"]/i.test(repairedHtml);
        const hasVueReactiveGate = isVueApp && (hasVueLoginScreenVif || hasVueAppContainerVif);

        // Gate Vue tab-level: isRoleAllowed() digunakan di v-show/v-if pada navigasi tab —
        // tab staf hanya muncul kalau currentRole cocok. Saat currentRole = '' (belum login), semua tab staf tersembunyi.
        const hasVueIsRoleAllowedTabGate = isVueApp &&
          /v-(?:if|show)\s*=\s*["'][^"']*isRoleAllowed\s*\(/i.test(repairedHtml);

        const hasLoginScreenGate = hasVanillaJsGate || hasVueReactiveGate || hasVueIsRoleAllowedTabGate;

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

          // Auto-repair: Sisipkan pemanggilan filterTabsByRole awal jika fungsi tersebut ada di script (khusus Vanilla JS)
          if (!isVueApp && (repairedHtml.includes('function filterTabsByRole') || repairedJs.includes('function filterTabsByRole'))) {
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

  // =========================================================================
  // 11. VALIDASI FIELD RELASI: Field "relasi ke X" WAJIB <select>, BUKAN <input type="text">
  // =========================================================================
  // Deteksi pola input teks bebas untuk field yang jelas bertipe relasi:
  // - input dengan id/name/placeholder yang mengandung "relasi_ke_", "Id", "_id", "_fk"
  // - DILARANG type="text" untuk field ini; WAJIB <select> berisi opsi dari tabel induk
  {
    // Pola: <input type="text" ... id="inputXxxId"> atau placeholder yang menyebutkan "relasi"
    // Cek apakah ada input dengan nama yang khas field relasi
    const relasiInputPattern = /<input(?=[^>]*type=["']text["'])[^>]*(?:id|name|placeholder)=["'][^"']*(?:relasi_ke_|_fk|RelId|SiswaId|InstrukturId|PenggunaId|UserId|GurId|MuridId|PelaId|PaketId)[^"']*["'][^>]*>/gi;
    const relasiInputMatches = [...repairedHtml.matchAll(relasiInputPattern)];
    if (relasiInputMatches.length > 0) {
      issues.push(
        `RELASI_FIELD_NOT_DROPDOWN: Ditemukan ${relasiInputMatches.length} field relasi (FK/foreign key) yang dirender sebagai <input type="text"> bukan <select>. ` +
        `Field bertipe "relasi ke [Entitas]" WAJIB menggunakan <select> berisi daftar pilihan dari tabel yang direlasikan. ` +
        `Field bermasalah: ${relasiInputMatches.map(m => m[0].match(/id=["']([^"']+)["']/i)?.[1] || 'unknown').join(', ')}`
      );
    }

    // Cek juga pola yang lebih umum: input dengan label/placeholder yang menyebut "pilih" atau "relasi"
    // namun ternyata diimplementasikan sebagai text input
    const generalRelasiInputPattern = /<input(?=[^>]*type=["']text["'])[^>]*placeholder=["'][^"']*(?:pilih|relasi|select)\s+(?:siswa|instruktur|pengguna|guru|murid|pelanggan|anggota|pasien|produk|paket|kelas|kategori)[^"']*["'][^>]*>/gi;
    const generalRelasiMatches = [...repairedHtml.matchAll(generalRelasiInputPattern)];
    if (generalRelasiMatches.length > 0) {
      issues.push(
        `RELASI_FIELD_TEXT_INPUT: Ditemukan input teks dengan placeholder "pilih [entitas]" yang seharusnya menjadi <select> dropdown. ` +
        `WAJIB ganti dengan <select> yang memuat opsi dari array data tabel terkait.`
      );
    }
  }

  // =========================================================================
  // 12. VALIDASI FORM STUB / GENERIC PLACEHOLDER (Langkah 2 - Anti-Stub Form)
  // =========================================================================
  // Deteksi label, placeholder, atau id form yang menggunakan template generik
  // seperti "Field 1", "Field 2", "Value 1", "Value 2", "Kolom 2", dsb.
  {
    const stubLabelPattern = /<label\b[^>]*>([\s\S]*?)<\/label>/gi;
    const stubPlaceholderPattern = /placeholder=["']([^"']+)["']/gi;
    const stubIdPattern = /(?:id|name)=["'](inputField\d+|inputValue\d+|field_\d+|value_\d+)["']/gi;

    const detectedStubs: string[] = [];

    // Deteksi label stub
    let labelMatch: RegExpExecArray | null;
    while ((labelMatch = stubLabelPattern.exec(repairedHtml)) !== null) {
      const text = labelMatch[1].replace(/<[^>]*>/g, '').trim();
      if (/^(?:Field\s*\d+|Value\s*\d+|Kolom\s*\d+|Nama\s*Field\s*\d*|Placeholder\s*\d*)$/i.test(text)) {
        detectedStubs.push(`Label: "${text}"`);
      }
    }

    // Deteksi placeholder stub
    let placeholderMatch: RegExpExecArray | null;
    while ((placeholderMatch = stubPlaceholderPattern.exec(repairedHtml)) !== null) {
      const ph = placeholderMatch[1].trim();
      if (/^(?:Value\s*\d+|Field\s*\d+|Kolom\s*\d+|Nilai\s*\d+|Placeholder\s*\d+|Contoh\s*Value|Contoh\s*Field)$/i.test(ph)) {
        detectedStubs.push(`Placeholder: "${ph}"`);
      }
    }

    // Deteksi id/name stub
    let idMatch: RegExpExecArray | null;
    while ((idMatch = stubIdPattern.exec(repairedHtml)) !== null) {
      detectedStubs.push(`ID/Name: "${idMatch[1]}"`);
    }

    if (detectedStubs.length > 0) {
      const uniqueStubs = [...new Set(detectedStubs)];
      issues.push(
        `STUB_FORM_FIELDS: Ditemukan ${uniqueStubs.length} elemen form dengan label/placeholder template palsu: [${uniqueStubs.join(', ')}]. ` +
        `Formulir WAJIB menggunakan nama field sungguhan dari skema data tabel (bukan stub template generik seperti Field 2 atau Value 2).`
      );
    }
  }

  // =========================================================================
  // 13. VALIDASI TOMBOL & AKSI (Langkah 6a — MISSING_CREATE_BRANCH)
  // =========================================================================
  // Memastikan fungsi simpan memiliki jalur CREATE (bukan cuma UPDATE if editId)
  {
    let jsAst: any = null;
    try {
      jsAst = acorn.parse(combinedJs, { ecmaVersion: 'latest', sourceType: 'script' });
    } catch {
      // syntax error sudah ditangkap sebelumnya jika ada
    }

    const createBranchIssues = checkMissingCreateBranches(jsAst, repairedHtml, combinedJs);
    issues.push(...createBranchIssues);
  }

  // =========================================================================
  // 14. VALIDASI TOMBOL & AKSI (Langkah 6b — MISSING_TOAST_FEEDBACK)
  // =========================================================================
  // Memastikan fungsi tombol aksi operasional memberikan feedback visual showToast()
  // dan dilarang hanya memanggil console.log() tanpa feedback ke user
  {
    let jsAst: any = null;
    try {
      jsAst = acorn.parse(combinedJs, { ecmaVersion: 'latest', sourceType: 'script' });
    } catch {
      // syntax error sudah ditangkap sebelumnya jika ada
    }

    const toastIssues = checkMissingToastFeedbacks(jsAst, repairedHtml, combinedJs);
    issues.push(...toastIssues);
  }

  // =========================================================================
  // 15. VALIDASI TOMBOL & AKSI (Langkah 6c — MISSING_TYPE_BRANCH)
  // =========================================================================
  // Memastikan fungsi modal/detail yang dipanggil lintas tipe data memiliki
  // percabangan dan pengisian konten nyata untuk SETIAP tipe data yang dipanggil di UI.
  {
    let jsAst: any = null;
    try {
      jsAst = acorn.parse(combinedJs, { ecmaVersion: 'latest', sourceType: 'script' });
    } catch {
      // syntax error sudah ditangkap sebelumnya jika ada
    }

    const typeBranchIssues = checkMissingTypeBranches(jsAst, repairedHtml, combinedJs);
    issues.push(...typeBranchIssues);
  }

  // =========================================================================
  // 16. VALIDASI TOMBOL & AKSI (Langkah 6d — MISSING_DELETE_WIRING / FAKE_DELETE_ACTION)
  // =========================================================================
  // Memastikan aksi hapus terpasang di UI tabel (bukan modal yatim) dan
  // fungsi eksekusi hapus benar-benar memodifikasi array state (.splice() / .filter()).
  {
    let jsAst: any = null;
    try {
      jsAst = acorn.parse(combinedJs, { ecmaVersion: 'latest', sourceType: 'script' });
    } catch {
      // syntax error sudah ditangkap sebelumnya jika ada
    }

    const deleteIssues = checkMissingDeleteWiringAndFakeAction(jsAst, repairedHtml, combinedJs);
    issues.push(...deleteIssues);
  }

  // 16.5 AUTO-REPAIR: Bersihkan variant pseudo-class yang tidak diaktifkan di Tailwind v2.2.19 CDN precompiled
  // (misal: active:scale-95, active:bg-*, group-active:*, disabled:*, focus-visible:*)
  if (/\b(?:active|group-active|disabled|focus-visible):[a-zA-Z0-9_-]+/i.test(repairedHtml)) {
    repairedHtml = repairedHtml.replace(/(?<![:\w-])class=["']([^"']+)["']/gi, (match, classStr) => {
      if (/\b(?:active|group-active|disabled|focus-visible):/i.test(classStr)) {
        const cleaned = classStr
          .split(/\s+/)
          .filter((cls: string) => !/^(?:active|group-active|disabled|focus-visible):/i.test(cls))
          .join(' ');
        return `class="${cleaned}"`;
      }
      return match;
    });

    // Pertahankan feedback aktif melalui aturan CSS murni di <style> jika ada tombol
    if (!repairedHtml.includes('button:active') && repairedHtml.includes('<style>')) {
      repairedHtml = repairedHtml.replace('<style>', '<style>\n    button:active { transform: scale(0.97); }');
    }
  }

  // 17. VALIDASI KESESUAIAN TAILWIND V2 (Whitelist & Constraint Tailwind v2)
  const twReport = checkTailwindV2Syntax(repairedHtml);
  if (twReport.warnings.length > 0) {
    console.warn('[Tailwind v2 Linter]', twReport.warnings);
    issues.push(...twReport.warnings);
  }

  // =========================================================================
  // 18. VALIDASI REAKTIVITAS VUE & ANTI-DOM MANIPULATION (Bug 2)
  // =========================================================================
  if (isVueApp) {
    let jsAst: any = null;
    try {
      jsAst = acorn.parse(combinedJs, { ecmaVersion: 'latest', sourceType: 'script' });
    } catch {}

    const domIssues = checkVueManualDomManipulation(jsAst, repairedHtml, combinedJs);
    issues.push(...domIssues);

    // =========================================================================
    // 19. VALIDASI ANTI-HARDCODED ROLE CHECK (Bug 3)
    // =========================================================================
    const roleCheckIssues = checkVueHardcodedRoleCheck(jsAst, repairedHtml, combinedJs, expectedRoles || []);
    issues.push(...roleCheckIssues);

    // =========================================================================
    // 20. VALIDASI DANGLING CONFIG REFERENCES (Bug 1a)
    // =========================================================================
    const danglingConfigIssues = checkVueDanglingConfigReferences(combinedJs);
    issues.push(...danglingConfigIssues);
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

/**
 * Ekstraksi issue DANGLING_CONFIG_REFERENCE untuk pelaporan atau auto-recovery
 */
export function extractDanglingConfigIssues(issues: string[]): string[] {
  return (issues || []).filter(i => i.startsWith('DANGLING_CONFIG_REFERENCE:'));
}

/**
 * Ekstraksi issue VUE_MANUAL_DOM_MANIPULATION untuk pelaporan atau auto-recovery
 */
export function extractVueManualDomIssues(issues: string[]): string[] {
  return (issues || []).filter(i => i.startsWith('VUE_MANUAL_DOM_MANIPULATION:'));
}

/**
 * Ekstraksi issue VUE_HARDCODED_ROLE_CHECK untuk pelaporan atau auto-recovery
 */
export function extractVueHardcodedRoleIssues(issues: string[]): string[] {
  return (issues || []).filter(i => i.startsWith('VUE_HARDCODED_ROLE_CHECK:'));
}

/**
 * Memeriksa apakah terdapat manipulasi DOM manual seperti document.getElementById(...).style.display
 * di dalam method / fungsi Vue (Bug 2).
 */
export function checkVueManualDomManipulation(ast: any, html: string, jsCode: string): string[] {
  const issues: string[] = [];
  const isVue = /Vue\.createApp\s*\(/.test(jsCode) || /<div[^>]*id=["']app["']/.test(html);
  if (!isVue) return issues;

  let hasManualDom = false;
  if (ast) {
    function walk(node: any) {
      if (!node || typeof node !== 'object' || hasManualDom) return;

      // document.getElementById(...).style.display = ...
      if (node.type === 'AssignmentExpression' && node.left?.type === 'MemberExpression') {
        const left = node.left;
        if (left.property?.name === 'display') {
          if (left.object?.type === 'MemberExpression' && left.object.property?.name === 'style') {
            const grandObj = left.object.object;
            if (grandObj?.type === 'CallExpression' && grandObj.callee?.type === 'MemberExpression') {
              const calleeProp = grandObj.callee.property?.name;
              if (calleeProp === 'getElementById' || calleeProp === 'querySelector') {
                hasManualDom = true;
                return;
              }
            }
          }
        }
      }

      for (const key of Object.keys(node)) {
        if (key === 'parent') continue;
        const child = node[key];
        if (Array.isArray(child)) {
          for (const c of child) walk(c);
        } else if (child && typeof child === 'object') {
          walk(child);
        }
      }
    }
    walk(ast);
  }

  if (!hasManualDom) {
    const regex = /document\s*\.\s*(?:getElementById|querySelector)\s*\(\s*['"][^'"]*['"]\s*\)\s*\.\s*style\s*\.\s*display/i;
    if (regex.test(jsCode)) {
      hasManualDom = true;
    }
  }

  if (hasManualDom) {
    issues.push(
      `VUE_MANUAL_DOM_MANIPULATION: DILARANG memanipulasi DOM manual (document.getElementById(...).style.display) di dalam method Vue. WAJIB menggunakan reaktivitas Vue (state isLoggedIn dan direktif v-if/v-show).`
    );
  }

  return issues;
}

export function repairVueManualDomManipulation(html: string, js: string): { html: string; js: string } {
  let repairedJs = js || '';
  let repairedHtml = html || '';

  // 1. Bersihkan manipulasi style.display di loginScreen / appContainer pada JS
  repairedJs = repairedJs.replace(
    /(?:const|let|var)\s+[a-zA-Z_$0-9]*\s*=\s*document\.(?:getElementById|querySelector)\s*\(\s*['"][^'"]*(?:loginScreen|appContainer)[^'"]*['"]\s*\);?/gi,
    ''
  );
  repairedJs = repairedJs.replace(
    /if\s*\(\s*(?:loginEl|appEl)\s*\)\s*(?:loginEl|appEl)\.style\.display\s*=\s*['"][^'"]*['"];?/gi,
    ''
  );
  repairedJs = repairedJs.replace(
    /document\.(?:getElementById|querySelector)\s*\(\s*['"][^'"]*(?:loginScreen|appContainer)[^'"]*['"]\s*\)\.style\.display\s*=\s*['"][^'"]*['"];?/gi,
    ''
  );

  // 2. Pastikan loginAs/handleLogin menyetel this.isLoggedIn = true, dan logout menyetel this.isLoggedIn = false
  if (/logout\s*\([^)]*\)\s*\{/i.test(repairedJs) && !/this\.isLoggedIn\s*=\s*false/i.test(repairedJs)) {
    repairedJs = repairedJs.replace(/(logout\s*\([^)]*\)\s*\{)/i, '$1\n      this.isLoggedIn = false;');
  }
  if (/loginAs\s*\([^)]*\)\s*\{/i.test(repairedJs) && !/this\.isLoggedIn\s*=\s*true/i.test(repairedJs)) {
    repairedJs = repairedJs.replace(/(loginAs\s*\([^)]*\)\s*\{)/i, '$1\n      this.isLoggedIn = true;');
  }
  if (/handleLogin\s*\([^)]*\)\s*\{/i.test(repairedJs) && !/this\.isLoggedIn\s*=\s*true/i.test(repairedJs)) {
    repairedJs = repairedJs.replace(/(handleLogin\s*\([^)]*\)\s*\{)/i, '$1\n      this.isLoggedIn = true;');
  }

  // 3. Pastikan data() mendefinisikan isLoggedIn: false
  if (/createApp\s*\(\s*\{[\s\S]*?data\s*\(\s*\)\s*\{[\s\S]*?return\s*\{/i.test(repairedJs)) {
    const createAppMatch = repairedJs.match(/(createApp\s*\(\s*\{[\s\S]*?data\s*\(\s*\)\s*\{[\s\S]*?return\s*\{)/i);
    if (createAppMatch) {
      const rest = repairedJs.slice(createAppMatch.index! + createAppMatch[0].length);
      const returnEnd = rest.indexOf('}');
      const returnBody = returnEnd !== -1 ? rest.slice(0, returnEnd) : rest.slice(0, 200);
      if (!/\bisLoggedIn\b/.test(returnBody)) {
        repairedJs = repairedJs.replace(
          /(createApp\s*\(\s*\{[\s\S]*?data\s*\(\s*\)\s*\{[\s\S]*?return\s*\{)/i,
          '$1\n        isLoggedIn: false,'
        );
      }
    }
  } else if (/data\s*\(\s*\)\s*\{[\s\S]*?return\s*\{/i.test(repairedJs) && !/return\s*\{[\s\S]*?\bisLoggedIn\b/i.test(repairedJs)) {
    repairedJs = repairedJs.replace(/(data\s*\(\s*\)\s*\{[\s\S]*?return\s*\{)/i, '$1\n        isLoggedIn: false,');
  }

  // 4. Di HTML, pastikan #loginScreen dan #appContainer menggunakan v-if/v-show reaktif
  repairedHtml = repairedHtml.replace(/<div\b(?=[^>]*\bid=["']loginScreen["'])([^>]*)>/gi, (match, attrs) => {
    let cleanAttrs = attrs.replace(/\s*style=["'][^"']*["']/gi, '');
    if (!/\bv-(?:if|show|else)\b/i.test(cleanAttrs)) {
      cleanAttrs += ' v-if="!isLoggedIn"';
    }
    return `<div${cleanAttrs}>`;
  });

  repairedHtml = repairedHtml.replace(/<div\b(?=[^>]*\bid=["']appContainer["'])([^>]*)>/gi, (match, attrs) => {
    let cleanAttrs = attrs.replace(/\s*style=["'][^"']*["']/gi, '');
    if (!/\bv-(?:if|show|else)\b/i.test(cleanAttrs)) {
      cleanAttrs += ' v-if="isLoggedIn"';
    }
    return `<div${cleanAttrs}>`;
  });

  return { html: repairedHtml, js: repairedJs };
}

/**
 * Memeriksa apakah terdapat pengecekan role hardcode di luar isRoleAllowed (Bug 3).
 * Khususnya di canEditCurrentTab() atau method/computed lainnya.
 */
export function checkVueHardcodedRoleCheck(ast: any, html: string, jsCode: string, roles: string[] = []): string[] {
  const issues: string[] = [];
  const isVue = /Vue\.createApp\s*\(/.test(jsCode) || /<div[^>]*id=["']app["']/.test(html);
  if (!isVue) return issues;

  const knownRolePatterns = ['Super Admin', 'Admin', 'Staf', 'Kasir', 'Instruktur', 'Siswa', 'Murid', 'Pelanggan', 'User', ...roles];
  const knownLower = new Set(knownRolePatterns.map(r => r.toLowerCase().trim()));

  let hardcodedFn: string | null = null;
  let hardcodedRole: string | null = null;

  if (ast) {
    function walk(node: any, currentFnName: string | null = null) {
      if (!node || typeof node !== 'object' || hardcodedFn) return;

      let fnName = currentFnName;
      if (node.type === 'Property' && node.key?.name && (node.value?.type === 'FunctionExpression' || node.value?.type === 'ArrowFunctionExpression')) {
        fnName = node.key.name;
      } else if (node.type === 'MethodDefinition' && node.key?.name) {
        fnName = node.key.name;
      } else if (node.type === 'FunctionDeclaration' && node.id?.name) {
        fnName = node.id.name;
      }

      if (fnName && fnName !== 'isRoleAllowed' && fnName !== 'filterTabsByRole') {
        if (node.type === 'CallExpression' && node.callee?.type === 'MemberExpression' && node.callee.property?.name === 'includes') {
          const arg0 = node.arguments?.[0];
          if (arg0 && (arg0.type === 'Literal' || typeof arg0.value === 'string')) {
            const val = String(arg0.value || '').toLowerCase().trim();
            if (knownLower.has(val) || val.includes('admin') || val.includes('staf') || val.includes('kasir')) {
              hardcodedFn = fnName;
              hardcodedRole = String(arg0.value);
              return;
            }
          }
        }
      }

      for (const key of Object.keys(node)) {
        if (key === 'parent') continue;
        const child = node[key];
        if (Array.isArray(child)) {
          for (const c of child) walk(c, fnName);
        } else if (child && typeof child === 'object') {
          walk(child, fnName);
        }
      }
    }
    walk(ast);
  }

  if (!hardcodedFn) {
    const canEditMatch = jsCode.match(/canEditCurrentTab\s*\([^)]*\)\s*\{([\s\S]*?)\}/);
    if (canEditMatch && /roles\.includes\s*\(\s*['"][^'"]+['"]\s*\)/i.test(canEditMatch[1])) {
      hardcodedFn = 'canEditCurrentTab';
      hardcodedRole = 'literal role';
    }
  }

  if (hardcodedFn) {
    issues.push(
      `VUE_HARDCODED_ROLE_CHECK: Terdeteksi pengecekan role literal (${hardcodedRole}) di dalam method '${hardcodedFn}'. DILARANG meng-hardcode nama peran di luar isRoleAllowed. WAJIB menggunakan this.isRoleAllowed(roles) agar dinamis untuk seluruh peran.`
    );
  }

  return issues;
}

export function checkVueDanglingConfigReferences(jsCode: string): string[] {
  if (!jsCode) return [];
  const issues: string[] = [];

  const refsCurrentTableConfig = /this\.currentTableConfig\b/.test(jsCode);
  const refsTablesConfig = /this\.tablesConfig\b/.test(jsCode);

  if (refsCurrentTableConfig || refsTablesConfig) {
    const hasCurrentTableConfig = /\bcurrentTableConfig\s*[:(]/.test(jsCode);
    const hasTablesConfig = /\btablesConfig\s*:\s*\{/.test(jsCode);

    if (refsCurrentTableConfig && !hasCurrentTableConfig && !hasTablesConfig) {
      issues.push(
        `DANGLING_CONFIG_REFERENCE: Terdeteksi referensi 'currentTableConfig' (misal di canEditCurrentTab) namun 'currentTableConfig' atau 'tablesConfig' tidak pernah didefinisikan di data() maupun computed. Hal ini menyebabkan tombol Tambah/Edit/Hapus mati total.`
      );
    }
  }

  return issues;
}

export function repairVueHardcodedRoleChecks(js: string): string {
  if (!js) return js;
  const canonicalCanEdit = `canEditCurrentTab() {
        if (this.currentTableConfig) {
          const allowed = this.currentTableConfig.roles || this.currentTableConfig.allowRoles || [];
          return this.isRoleAllowed(allowed);
        }
        if (this.tablesConfig) {
          const key = (this.activeTab || '').replace(/^tab_/, '');
          const cfg = this.tablesConfig[key] || this.tablesConfig[this.activeTab];
          if (cfg) {
            const allowed = cfg.roles || cfg.allowRoles || [];
            return this.isRoleAllowed(allowed);
          }
        }
        if (this.tabs && this.tabs.length) {
          const curTab = this.tabs.find(t => t.id === this.activeTab);
          if (curTab) {
            const allowed = curTab.roles || curTab.allowRoles || [];
            return this.isRoleAllowed(allowed);
          }
        }
        const owner = (typeof window !== 'undefined' && window.OWNER_ROLE_NAME) ? window.OWNER_ROLE_NAME : 'Super Admin';
        return this.currentRole === owner;
      }`;

  const regex = /canEditCurrentTab\s*\([^)]*\)\s*\{/g;
  let match: RegExpExecArray | null;
  let result = '';
  let lastIndex = 0;

  while ((match = regex.exec(js)) !== null) {
    result += js.slice(lastIndex, match.index);
    const startBrace = match.index + match[0].length - 1;
    let depth = 1;
    let i = startBrace + 1;
    while (i < js.length && depth > 0) {
      if (js[i] === '{') depth++;
      else if (js[i] === '}') depth--;
      i++;
    }
    result += canonicalCanEdit;
    lastIndex = i;
    regex.lastIndex = i;
  }
  result += js.slice(lastIndex);
  return result;
}

/**
 * Ekstraksi issue TAILWIND_V2 violations untuk pelaporan atau auto-recovery
 */
export function extractTailwindV2Violations(issues: string[]): string[] {
  return (issues || []).filter((i) => i.startsWith('TAILWIND_V2_'));
}

/**
 * Ekstraksi issue MISSING_TOAST_FEEDBACK untuk pelaporan atau auto-recovery
 */
export function extractMissingToastFeedbacks(issues: string[]): string[] {
  return (issues || [])
    .filter((i) => i.startsWith('MISSING_TOAST_FEEDBACK:'))
    .map((i) => i.replace(/^MISSING_TOAST_FEEDBACK:\s*/, ''));
}

/**
 * Memeriksa apakah ada fungsi tombol aksi operasional yang hanya memanggil console.log()
 * tanpa memanggil showToast() untuk memberikan feedback visual ke pengguna (Sub-Bug 6b).
 */
export function checkMissingToastFeedbacks(
  ast: any,
  html: string,
  jsCode: string
): string[] {
  const issues: string[] = [];

  // 1. Ekstrak tombol-tombol aksi dari HTML beserta handler dan label teksnya (mendukung Vanilla onclick dan Vue @click)
  const actionButtons: { fnName: string; label: string }[] = [];
  const btnRegex = /<button\b[^>]*(?:\bonclick|@click|v-on:click)=["'](?:return\s+)?([a-zA-Z0-9_]+)\s*(?:\((?:[\s\S]*?)\))?["'][^>]*>([\s\S]*?)<\/button>/gi;
  let match: RegExpExecArray | null;

  while ((match = btnRegex.exec(html)) !== null) {
    const fnName = match[1];
    const rawLabel = match[2].replace(/<[^>]*>/g, '').trim();
    const isNavigationOrModalToggle = /^(showTab|bukaModal|tutupModal|closeModal|openModal|switchTab|loginAs|logout|quickLogin|switchRole|toggleNav|toggleSidebar|bukaModalTambah|bukaModalEdit|bukaModalHapus|openCreate|openEdit|confirmDelete|closeDeleteModal)$/i.test(fnName);
    if (!isNavigationOrModalToggle && fnName) {
      actionButtons.push({ fnName, label: rawLabel || fnName });
    }
  }

  // 2. Kumpulkan node fungsi dari AST
  const fnBodies = new Map<string, { body: string; node?: any }>();
  if (ast) {
    function walk(node: any) {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'FunctionDeclaration' && node.id?.name) {
        fnBodies.set(node.id.name, { body: '', node });
      } else if (node.type === 'VariableDeclarator' && node.id?.name && node.init) {
        if (node.init.type === 'FunctionExpression' || node.init.type === 'ArrowFunctionExpression') {
          fnBodies.set(node.id.name, { body: '', node: node.init });
        }
      } else if (node.type === 'AssignmentExpression') {
        const left = node.left;
        const right = node.right;
        if (right && (right.type === 'FunctionExpression' || right.type === 'ArrowFunctionExpression')) {
          const name = left.type === 'Identifier' ? left.name : (left.type === 'MemberExpression' ? (left.property?.name || left.property?.value) : null);
          if (name) fnBodies.set(name, { body: '', node: right });
        }
      } else if (node.type === 'Property') {
        if (node.value?.type === 'FunctionExpression' || node.value?.type === 'ArrowFunctionExpression') {
          const name = node.key?.name || node.key?.value;
          if (name) fnBodies.set(name, { body: '', node: node.value });
        }
      }
      for (const k of Object.keys(node)) {
        if (k === 'loc' || k === 'range') continue;
        const child = node[k];
        if (Array.isArray(child)) {
          for (const c of child) walk(c);
        } else if (child && typeof child.type === 'string') {
          walk(child);
        }
      }
    }
    walk(ast);
  }

  // Fallback / suplementasi body teks via regex untuk periksa showToast vs console.log
  const funcTextRegex = /(?:function\s+([a-zA-Z0-9_]+)|(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*(?:function|\([^)]*\)\s*=>))\s*\([^)]*\)\s*\{([\s\S]*?)\n\s*\}/g;
  let textMatch: RegExpExecArray | null;
  while ((textMatch = funcTextRegex.exec(jsCode)) !== null) {
    const name = textMatch[1] || textMatch[2];
    const body = textMatch[3] || '';
    if (name) {
      const existing = fnBodies.get(name);
      if (existing) {
        existing.body = body;
      } else {
        fnBodies.set(name, { body });
      }
    }
  }

  // 3. Periksa setiap tombol aksi
  const checkedFns = new Set<string>();
  for (const btn of actionButtons) {
    if (checkedFns.has(btn.fnName)) continue;
    checkedFns.add(btn.fnName);

    const fnData = fnBodies.get(btn.fnName);
    if (!fnData) continue;

    let hasShowToast = false;
    let hasConsoleLog = false;
    let hasWindowPrint = false;

    // Periksa via AST CallExpression
    if (fnData.node) {
      function searchCalls(n: any) {
        if (!n || typeof n !== 'object') return;
        if (n.type === 'CallExpression') {
          if (n.callee?.type === 'Identifier' && n.callee.name === 'showToast') {
            hasShowToast = true;
          }
          if (n.callee?.type === 'MemberExpression') {
            if (n.callee.object?.name === 'console') {
              hasConsoleLog = true;
            }
            if (n.callee.property?.name === 'showToast') {
              hasShowToast = true;
            }
            if (n.callee.object?.name === 'window' && n.callee.property?.name === 'print') {
              hasWindowPrint = true;
            }
          }
        }
        for (const k of Object.keys(n)) {
          if (k === 'loc' || k === 'range') continue;
          const child = n[k];
          if (Array.isArray(child)) {
            for (const c of child) searchCalls(c);
          } else if (child && typeof child.type === 'string') {
            searchCalls(child);
          }
        }
      }
      searchCalls(fnData.node);
    }

    // Suplementasi dari teks regex jika belum ditemukan
    if (fnData.body) {
      if (/console\.(?:log|warn|info|debug)\s*\(/i.test(fnData.body)) hasConsoleLog = true;
      if (/showToast\s*\(/i.test(fnData.body)) hasShowToast = true;
      if (/window\.print\s*\(/i.test(fnData.body)) hasWindowPrint = true;
    }

    const isActionKeyword = /^(?:cetak|print|download|unduh|ekspor|export|kirim|send|proses|process|verifikasi|verify|selesaikan|bayar|konfirmasi)/i.test(btn.fnName) ||
                            /(?:cetak|print|download|unduh|ekspor|kirim|proses|verifikasi|selesai|bayar|konfirmasi)/i.test(btn.label);

    if ((hasConsoleLog && !hasShowToast) || (isActionKeyword && !hasShowToast && !hasWindowPrint)) {
      issues.push(
        `MISSING_TOAST_FEEDBACK: Fungsi aksi "${btn.fnName}" (dipanggil tombol "${btn.label}") tidak memberikan feedback showToast(). Dilarang hanya console.log(); WAJIB panggil showToast() untuk memberi notifikasi status aksi kepada pengguna.`
      );
    }
  }

  return issues;
}

/**
 * Ekstraksi issue MISSING_CREATE_BRANCH untuk pelaporan atau auto-recovery
 */
export function extractMissingCreateBranches(issues: string[]): string[] {
  return (issues || [])
    .filter((i) => i.startsWith('MISSING_CREATE_BRANCH:'))
    .map((i) => i.replace(/^MISSING_CREATE_BRANCH:\s*/, ''));
}

/**
 * Memeriksa apakah ada fungsi simpan form yang hanya memiliki cabang UPDATE (if editId)
 * tanpa cabang CREATE yang memasukkan item baru ke array state (Sub-Bug 6a).
 */
export function checkMissingCreateBranches(
  ast: any,
  html: string,
  jsCode: string
): string[] {
  const issues: string[] = [];

  // Helper untuk mengecek apakah sebuah AST node memuat operasi array push / unshift / splice
  const hasArrayInsertOperation = (subNode: any): boolean => {
    let found = false;
    function check(n: any) {
      if (found || !n || typeof n !== 'object') return;
      if (n.type === 'CallExpression') {
        if (n.callee?.type === 'MemberExpression') {
          const propName = n.callee.property?.name || n.callee.property?.value;
          if (propName === 'push' || propName === 'unshift') {
            found = true;
            return;
          }
          if (propName === 'splice' && n.arguments?.length >= 3) {
            const secondArg = n.arguments[1];
            if (secondArg && secondArg.type === 'Literal' && secondArg.value === 0) {
              found = true;
              return;
            }
          }
        }
      }
      for (const k of Object.keys(n)) {
        if (k === 'loc' || k === 'range') continue;
        const child = n[k];
        if (Array.isArray(child)) {
          for (const c of child) check(c);
        } else if (child && typeof child.type === 'string') {
          check(child);
        }
      }
    }
    check(subNode);
    return found;
  };

  // Helper untuk mengecek apakah kondisi test mengetes editId
  const isEditCondition = (testNode: any): boolean => {
    let isEdit = false;
    function checkTest(n: any) {
      if (isEdit || !n || typeof n !== 'object') return;
      if (n.type === 'Identifier') {
        if (/(?:edit|selected|isEdit|currentId|editing)/i.test(n.name)) {
          isEdit = true;
          return;
        }
      }
      if (n.type === 'MemberExpression') {
        const prop = n.property?.name || n.property?.value;
        if (prop === 'value' || prop === 'dataset' || /(?:edit|id)/i.test(prop)) {
          isEdit = true;
          return;
        }
      }
      if (n.type === 'Literal' && typeof n.value === 'string' && /(?:edit|id)/i.test(n.value)) {
        isEdit = true;
        return;
      }
      for (const k of Object.keys(n)) {
        if (k === 'loc' || k === 'range') continue;
        const child = n[k];
        if (Array.isArray(child)) {
          for (const c of child) checkTest(c);
        } else if (child && typeof child.type === 'string') {
          checkTest(child);
        }
      }
    }
    checkTest(testNode);
    return isEdit;
  };

  if (ast) {
    interface FnInfo {
      name: string;
      node: any;
    }
    const fns: FnInfo[] = [];

    function walk(node: any) {
      if (!node || typeof node !== 'object') return;

      if (node.type === 'FunctionDeclaration' && node.id?.name) {
        fns.push({ name: node.id.name, node });
      } else if (node.type === 'VariableDeclarator' && node.id?.name && node.init) {
        if (node.init.type === 'FunctionExpression' || node.init.type === 'ArrowFunctionExpression') {
          fns.push({ name: node.id.name, node: node.init });
        }
      } else if (node.type === 'AssignmentExpression') {
        const left = node.left;
        const right = node.right;
        if (right && (right.type === 'FunctionExpression' || right.type === 'ArrowFunctionExpression')) {
          const name = left.type === 'Identifier' ? left.name : (left.type === 'MemberExpression' ? (left.property?.name || left.property?.value) : null);
          if (name) fns.push({ name, node: right });
        }
      } else if (node.type === 'Property') {
        if (node.value?.type === 'FunctionExpression' || node.value?.type === 'ArrowFunctionExpression') {
          const name = node.key?.name || node.key?.value;
          if (name) fns.push({ name, node: node.value });
        }
      }

      for (const key of Object.keys(node)) {
        if (key === 'loc' || key === 'range') continue;
        const child = node[key];
        if (Array.isArray(child)) {
          for (const c of child) {
            if (c && typeof c.type === 'string') walk(c);
          }
        } else if (child && typeof child.type === 'string') {
          walk(child);
        }
      }
    }

    walk(ast);

    // Kumpulkan fungsi yang dipanggil dari form submit / tombol simpan di HTML (Vanilla & Vue)
    const formSubmitFns = new Set<string>();
    const submitMatches = [...html.matchAll(/(?:onsubmit|@submit(?:\.[a-z]+)?|v-on:submit(?:\.[a-z]+)?)=["'](?:return\s+)?([a-zA-Z0-9_]+)\s*(?:\([^"']*\))?["']/gi)];
    for (const m of submitMatches) {
      formSubmitFns.add(m[1]);
    }
    const saveBtnMatches = [...html.matchAll(/<button[^>]*(?:onclick|@click|v-on:click)=["']([a-zA-Z0-9_]+)\s*(?:\([^"']*\))?["'][^>]*>[\s\S]*?(?:Simpan|Save|Submit|Tambah|Tambahkan)[\s\S]*?<\/button>/gi)];
    for (const m of saveBtnMatches) {
      formSubmitFns.add(m[1]);
    }

    const candidateSaveFns = fns.filter((f) => {
      if (formSubmitFns.has(f.name)) return true;
      return /^(?:simpan|save|handlesimpan|handlesubmit|tambah[a-z0-9]|create[a-z0-9]|submittransaksi|submitsiswa)/i.test(f.name);
    });

    for (const fn of candidateSaveFns) {
      const fnBody = fn.node.body;
      if (!fnBody) continue;

      let hasEditIf = false;
      let hasCreateInAlternate = false;

      function searchIfs(n: any) {
        if (!n || typeof n !== 'object') return;
        if (n.type === 'IfStatement') {
          if (isEditCondition(n.test)) {
            hasEditIf = true;
            if (n.alternate && hasArrayInsertOperation(n.alternate)) {
              hasCreateInAlternate = true;
            }
          }
        }
        for (const k of Object.keys(n)) {
          if (k === 'loc' || k === 'range') continue;
          const child = n[k];
          if (Array.isArray(child)) {
            for (const c of child) searchIfs(c);
          } else if (child && typeof child.type === 'string') {
            searchIfs(child);
          }
        }
      }

      searchIfs(fnBody);
      const hasGlobalInsert = hasArrayInsertOperation(fnBody);

      if (hasEditIf && !hasCreateInAlternate && !hasGlobalInsert) {
        issues.push(
          `MISSING_CREATE_BRANCH: Fungsi simpan "${fn.name}" memiliki cabang edit/update (if editId), tetapi TIDAK memiliki jalur kode CREATE (tidak ditemukan operasi .push()/.unshift() ke array state). Saat tombol Tambah ditekan dan ID kosong, data baru tidak akan pernah tersimpan.`
        );
      }
    }
  }

  // Regex fallback jika AST tidak mendeteksi (misal sintaks fungsi inline di luar AST)
  if (issues.length === 0 && jsCode) {
    const fnRegex = /(?:function\s+([a-zA-Z0-9_]+)|(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*(?:function|\([^)]*\)\s*=>))\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/g;
    let match: RegExpExecArray | null;
    while ((match = fnRegex.exec(jsCode)) !== null) {
      const fnName = match[1] || match[2];
      const body = match[3] || '';
      if (/^(?:simpan|save|handlesimpan|handlesubmit)/i.test(fnName)) {
        const hasEditConditionRegex = /if\s*\(\s*(?:editId|id|selectedId|currentEditId|isEdit|editingId|[a-zA-Z0-9_]*edit[a-zA-Z0-9_]*)\s*\)/i.test(body) ||
                                     /if\s*\(\s*document\.getElementById\([^)]*(?:edit|id)[^)]*\)\.(?:value|dataset)\s*\)/i.test(body);
        const hasPushRegex = /\.(?:push|unshift)\s*\(/i.test(body) || /\.splice\s*\([^,]+,\s*0\s*,/i.test(body);
        if (hasEditConditionRegex && !hasPushRegex) {
          issues.push(
            `MISSING_CREATE_BRANCH: Fungsi simpan "${fnName}" memiliki cabang edit/update (if editId), tetapi TIDAK memiliki jalur kode CREATE (tidak ditemukan operasi .push()/.unshift() ke array state). Saat tombol Tambah ditekan dan ID kosong, data baru tidak akan pernah tersimpan.`
          );
        }
      }
    }
  }

  return issues;
}

/**
 * Ekstraksi issue MISSING_TYPE_BRANCH untuk pelaporan atau auto-recovery
 */
export function extractMissingTypeBranches(issues: string[]): string[] {
  return (issues || [])
    .filter((i) => i.startsWith('MISSING_TYPE_BRANCH:'))
    .map((i) => i.replace(/^MISSING_TYPE_BRANCH:\s*/, ''));
}

/**
 * Memeriksa apakah ada fungsi modal/aksi yang dipanggil dengan parameter tipe data yang berbeda
 * dari UI (misal bukaModal(id, 'sesi') dan bukaModal(id, 'user')), tetapi fungsi target tidak memiliki
 * percabangan penanganan atau hanya menyembunyikan field tanpa mengisi data/menampilkan konten pengganti (Sub-Bug 6c).
 */
export function checkMissingTypeBranches(
  ast: any,
  html: string,
  jsCode: string
): string[] {
  // Arsitektur CRUD Generik Parameterized (Fase 2):
  // Modal form tunggal me-render kolom secara dinamis dari tablesConfig[activeTable].fields.
  // Tidak ada cabang if/else hardcoded per entitas; Sub-Bug 6c tereliminasi struktural.
  if (/tablesConfig|currentTableConfig|v-for=["'][^"']*\bfields\b/i.test(html + jsCode)) {
    return [];
  }

  const issues: string[] = [];

  // Helper untuk memecah argumen pemanggilan fungsi dengan mempertimbangkan tanda kutip
  const splitArgs = (str: string): string[] => {
    const args: string[] = [];
    let current = '';
    let inQuote: string | null = null;
    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      if ((char === "'" || char === '"') && (i === 0 || str[i - 1] !== '\\')) {
        if (!inQuote) inQuote = char;
        else if (inQuote === char) inQuote = null;
      }
      if (char === ',' && !inQuote) {
        args.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    if (current.trim()) args.push(current.trim());
    return args;
  };

  // 1. Ekstrak pemanggilan fungsi di HTML yang memiliki argumen string literal (seperti 'sesi', 'user')
  // Map: fnName -> Map<argIndex, Set<stringLiteralValues>>
  const fnArgTypeCalls = new Map<string, Map<number, Set<string>>>();
  const isNavOrBuiltin = /^(?:showTab|switchTab|loginAs|switchRole|tutupModal|closeModal|openTab|filterTabsByRole|toggleSidebar|toggleNav|confirm|alert|showToast|console\.(?:log|warn|error)|parseInt|parseFloat|Number|String|Boolean)$/i;

  const onclickRegex = /\bonclick=(["'])([\s\S]*?)\1/gi;
  let ocMatch: RegExpExecArray | null;

  while ((ocMatch = onclickRegex.exec(html)) !== null) {
    const rawCode = ocMatch[2];
    const callRegex = /([a-zA-Z0-9_$]+)\s*\(([\s\S]*?)\)/g;
    let callMatch: RegExpExecArray | null;
    while ((callMatch = callRegex.exec(rawCode)) !== null) {
      const fnName = callMatch[1];
      if (isNavOrBuiltin.test(fnName)) continue;
      const rawArgs = callMatch[2].trim();
      if (!rawArgs) continue;

      const args = splitArgs(rawArgs);
      for (let idx = 0; idx < args.length; idx++) {
        const arg = args[idx];
        const strMatch = arg.match(/^['"]([^'"]+)['"]$/);
        if (strMatch) {
          const literalVal = strMatch[1];
          if (!fnArgTypeCalls.has(fnName)) {
            fnArgTypeCalls.set(fnName, new Map());
          }
          const argMap = fnArgTypeCalls.get(fnName)!;
          if (!argMap.has(idx)) {
            argMap.set(idx, new Set());
          }
          argMap.get(idx)!.add(literalVal);
        }
      }
    }
  }

  // 2. Kumpulkan definisi fungsi di JS (AST & body teks)
  interface FnTarget {
    name: string;
    node?: any;
    bodyText: string;
  }
  const fnDefs = new Map<string, FnTarget>();

  if (ast) {
    function walk(node: any) {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'FunctionDeclaration' && node.id?.name) {
        fnDefs.set(node.id.name, { name: node.id.name, node, bodyText: '' });
      } else if (node.type === 'VariableDeclarator' && node.id?.name && node.init) {
        if (node.init.type === 'FunctionExpression' || node.init.type === 'ArrowFunctionExpression') {
          fnDefs.set(node.id.name, { name: node.id.name, node: node.init, bodyText: '' });
        }
      } else if (node.type === 'AssignmentExpression') {
        const left = node.left;
        const right = node.right;
        if (right && (right.type === 'FunctionExpression' || right.type === 'ArrowFunctionExpression')) {
          const name = left.type === 'Identifier' ? left.name : (left.type === 'MemberExpression' ? (left.property?.name || left.property?.value) : null);
          if (name) fnDefs.set(name, { name, node: right, bodyText: '' });
        }
      }
      for (const k of Object.keys(node)) {
        if (k === 'loc' || k === 'range') continue;
        const child = node[k];
        if (Array.isArray(child)) {
          for (const c of child) walk(c);
        } else if (child && typeof child.type === 'string') {
          walk(child);
        }
      }
    }
    walk(ast);
  }

  // Lengkapi bodyText via regex
  if (jsCode) {
    const fnRegex = /(?:function\s+([a-zA-Z0-9_]+)|(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*(?:function|\([^)]*\)\s*=>))\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/g;
    let textMatch: RegExpExecArray | null;
    while ((textMatch = fnRegex.exec(jsCode)) !== null) {
      const name = textMatch[1] || textMatch[2];
      const body = textMatch[3] || '';
      if (name) {
        const existing = fnDefs.get(name);
        if (existing) {
          existing.bodyText = body;
        } else {
          fnDefs.set(name, { name, bodyText: body });
        }
      }
    }
  }

  // Helper untuk mengecek apakah sebuah cabang kode memiliki operasi substantif
  // (mengisi nilai input, innerHTML, textContent, showToast, atau menampilkan kontainer pengganti)
  const branchHasSubstantiveContent = (branchAst: any, branchText: string): boolean => {
    let hasSubstantive = false;

    // 1. AST Check
    if (branchAst) {
      function checkNode(n: any) {
        if (hasSubstantive || !n || typeof n !== 'object') return;

        // Assignment ke .value, .innerHTML, .innerText, .textContent
        if (n.type === 'AssignmentExpression') {
          if (n.left?.type === 'MemberExpression') {
            const prop = n.left.property?.name || n.left.property?.value;
            if (/^(?:value|innerHTML|innerText|textContent)$/i.test(prop)) {
              hasSubstantive = true;
              return;
            }
            // Assignment ke style.display bukan 'none'
            if (prop === 'display') {
              if (n.right?.type === 'Literal' && typeof n.right.value === 'string' && n.right.value !== 'none') {
                hasSubstantive = true;
                return;
              }
            }
          }
        }

        // Pemanggilan showToast atau classList.remove('hidden') atau append/createElement
        if (n.type === 'CallExpression') {
          const callee = n.callee;
          if (callee?.type === 'Identifier') {
            if (callee.name === 'showToast' || /^(?:render|tampil|buka|load|isi|set)[A-Z0-9_]/i.test(callee.name)) {
              hasSubstantive = true;
              return;
            }
          }
          if (callee?.type === 'MemberExpression') {
            const prop = callee.property?.name || callee.property?.value;
            if (/^(?:remove|append|appendChild|insertAdjacentHTML)$/i.test(prop)) {
              hasSubstantive = true;
              return;
            }
            if (callee.object?.name === 'document' && prop === 'createElement') {
              hasSubstantive = true;
              return;
            }
          }
        }

        for (const k of Object.keys(n)) {
          if (k === 'loc' || k === 'range') continue;
          const child = n[k];
          if (Array.isArray(child)) {
            for (const c of child) checkNode(c);
          } else if (child && typeof child.type === 'string') {
            checkNode(child);
          }
        }
      }

      checkNode(branchAst);
    }

    // 2. Text / Regex Check
    if (!hasSubstantive && branchText) {
      const hasSubstantiveRegex = /(?:\.(?:value|innerHTML|innerText|textContent)\s*=|\bshowToast\s*\(|\.display\s*=\s*['"](?!none)[a-z]+['"]|\.classList\.remove\s*\(|\.append(?:Child)?\s*\(|createElement\s*\()/i;
      if (hasSubstantiveRegex.test(branchText)) {
        hasSubstantive = true;
      }
    }

    return hasSubstantive;
  };

  // Helper untuk mengenali nilai ID rekaman (seperti 'USR-001', 'SES-001', '123') agar tidak salah dianggap tipe
  const isIdValue = (val: string): boolean => {
    if (/^\d+$/.test(val)) return true;
    if (/[-\/]/.test(val)) return true;
    if (/[0-9]/.test(val) && /[a-zA-Z]/.test(val)) return true;
    return false;
  };

  // 3. Evaluasi setiap fungsi yang dipanggil dengan argumen literal di UI
  for (const [fnName, argMap] of fnArgTypeCalls.entries()) {
    const fnTarget = fnDefs.get(fnName);
    if (!fnTarget) continue; // fungsi tidak terdefinisi sudah ditangkap validator lain jika ada

    for (const [argIdx, typeSet] of argMap.entries()) {
      let paramName = '';
      if (fnTarget.node?.params && fnTarget.node.params[argIdx]) {
        paramName = fnTarget.node.params[argIdx].name || '';
      }
      if (/^(?:id|[a-zA-Z0-9_]*id)$/i.test(paramName)) {
        continue; // Parameter ini adalah ID rekaman, bukan tipe discriminator
      }

      // Pertimbangkan argumen ini jika:
      // a) Memiliki >= 2 nilai literal berbeda (polymorphic dispatch), ATAU
      // b) Memiliki 1 nilai literal tapi nama fungsi berkaitan dengan modal/detail/form/aksi data
      //    atau nama parameter di posisi tersebut mengandung kata kunci tipe
      const isModalOrDataAction = /^(?:bukaModal|openModal|lihatDetail|bukaDetail|showModal|showDetail|detail|modal|form|edit)[a-zA-Z0-9_]*/i.test(fnName);
      const isTypeParam = /^(?:type|tipe|mode|entity|kategori|jenis|target)$/i.test(paramName);

      if (typeSet.size < 2 && !isModalOrDataAction && !isTypeParam) {
        continue;
      }

      for (const typeVal of typeSet) {
        // Abaikan string numerik atau format ID rekaman seperti 'USR-001', 'SES-001'
        if (isIdValue(typeVal)) continue;

        let hasBranch = false;
        let branchIsSubstantive = false;
        let fallbackHasSubstantive = false;

        // A. Periksa via AST
        if (fnTarget.node) {
          function searchTypeHandling(n: any) {
            if (!n || typeof n !== 'object') return;

            // 1. IfStatement: if (type === 'sesi')
            if (n.type === 'IfStatement') {
              let testMatchesType = false;
              let testInvolvesOtherType = false;

              function checkTest(tn: any) {
                if (!tn || typeof tn !== 'object') return;
                if (tn.type === 'Literal' && typeof tn.value === 'string') {
                  if (tn.value.toLowerCase() === typeVal.toLowerCase()) {
                    testMatchesType = true;
                  } else if (!isIdValue(tn.value)) {
                    testInvolvesOtherType = true;
                  }
                  return;
                }
                for (const k of Object.keys(tn)) {
                  if (k === 'loc' || k === 'range') continue;
                  const c = tn[k];
                  if (Array.isArray(c)) {
                    for (const item of c) checkTest(item);
                  } else if (c && typeof c.type === 'string') {
                    checkTest(c);
                  }
                }
              }
              checkTest(n.test);

              if (testMatchesType) {
                hasBranch = true;
                if (branchHasSubstantiveContent(n.consequent, '')) {
                  branchIsSubstantive = true;
                }
              } else if (testInvolvesOtherType && n.alternate) {
                if (branchHasSubstantiveContent(n.alternate, '')) {
                  fallbackHasSubstantive = true;
                }
              }
            }

            // 1b. Pola early-return pada BlockStatement: jika if (type === '...') melakukan return,
            // sisa baris kode di bawahnya bertindak sebagai fallback untuk tipe lainnya
            if (n.type === 'BlockStatement' && Array.isArray(n.body)) {
              for (let sIdx = 0; sIdx < n.body.length; sIdx++) {
                const stmt = n.body[sIdx];
                if (stmt.type === 'IfStatement' && stmt.consequent) {
                  let hasReturn = false;
                  function checkReturn(cn: any) {
                    if (hasReturn || !cn || typeof cn !== 'object') return;
                    if (cn.type === 'ReturnStatement') {
                      hasReturn = true;
                      return;
                    }
                    for (const rk of Object.keys(cn)) {
                      if (rk === 'loc' || rk === 'range') continue;
                      const ch = cn[rk];
                      if (Array.isArray(ch)) {
                        for (const item of ch) checkReturn(item);
                      } else if (ch && typeof ch.type === 'string') {
                        checkReturn(ch);
                      }
                    }
                  }
                  checkReturn(stmt.consequent);

                  if (hasReturn && sIdx + 1 < n.body.length) {
                    for (let remIdx = sIdx + 1; remIdx < n.body.length; remIdx++) {
                      if (branchHasSubstantiveContent(n.body[remIdx], '')) {
                        fallbackHasSubstantive = true;
                        break;
                      }
                    }
                  }
                }
              }
            }

            // 2. SwitchStatement: case 'sesi':
            if (n.type === 'SwitchCase') {
              if (n.test && n.test.type === 'Literal' && typeof n.test.value === 'string') {
                if (n.test.value.toLowerCase() === typeVal.toLowerCase()) {
                  hasBranch = true;
                  if (branchHasSubstantiveContent(n, '')) {
                    branchIsSubstantive = true;
                  }
                }
              } else if (!n.test) {
                // Default case
                if (branchHasSubstantiveContent(n, '')) {
                  fallbackHasSubstantive = true;
                }
              }
            }

            // 3. Object Property: { sesi: { ... } } atau handlers['sesi']
            if (n.type === 'Property') {
              const keyName = n.key?.name || n.key?.value;
              if (typeof keyName === 'string' && keyName.toLowerCase() === typeVal.toLowerCase()) {
                hasBranch = true;
                if (branchHasSubstantiveContent(n.value, '')) {
                  branchIsSubstantive = true;
                } else if (n.value?.type === 'ObjectExpression' && n.value.properties?.length > 0) {
                  branchIsSubstantive = true;
                }
              }
            }

            for (const k of Object.keys(n)) {
              if (k === 'loc' || k === 'range') continue;
              const child = n[k];
              if (Array.isArray(child)) {
                for (const c of child) searchTypeHandling(c);
              } else if (child && typeof child.type === 'string') {
                searchTypeHandling(child);
              }
            }
          }

          searchTypeHandling(fnTarget.node.body || fnTarget.node);
        }

        // B. Suplementasi via Regex jika AST belum mendeteksi
        if (!hasBranch && fnTarget.bodyText) {
          const escapedType = typeVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const ifRegex = new RegExp(`if\\s*\\([^)]*['"]${escapedType}['"][^)]*\\)\\s*\\{([\\s\\S]*?)\\}`, 'i');
          const caseRegex = new RegExp(`case\\s*['"]${escapedType}['"]\\s*:([\\s\\S]*?)(?:break;|case\\s|default:|$)`, 'i');

          const ifMatch = ifRegex.exec(fnTarget.bodyText);
          const caseMatch = caseRegex.exec(fnTarget.bodyText);

          if (ifMatch) {
            hasBranch = true;
            if (branchHasSubstantiveContent(null, ifMatch[1])) {
              branchIsSubstantive = true;
            }
          } else if (caseMatch) {
            hasBranch = true;
            if (branchHasSubstantiveContent(null, caseMatch[1])) {
              branchIsSubstantive = true;
            }
          } else {
            const elseMatch = /else\s*\{([\s\S]*?)\}/i.exec(fnTarget.bodyText);
            if (elseMatch && branchHasSubstantiveContent(null, elseMatch[1])) {
              fallbackHasSubstantive = true;
            }
          }
        }

        if (!hasBranch && fallbackHasSubstantive) {
          hasBranch = true;
          branchIsSubstantive = true;
        }

        // C. Terbitkan issue jika cabang tidak ada sama sekali atau kosong/hanya hide
        if (!hasBranch) {
          issues.push(
            `MISSING_TYPE_BRANCH: Fungsi "${fnName}" dipanggil dengan tipe "${typeVal}" dari tombol UI, tetapi TIDAK memiliki percabangan kode untuk menangani tipe "${typeVal}". Modal/tampilan akan kosong atau salah data saat tipe ini dibuka.`
          );
        } else if (!branchIsSubstantive) {
          issues.push(
            `MISSING_TYPE_BRANCH: Fungsi "${fnName}" memiliki percabangan untuk tipe "${typeVal}", namun hanya menyembunyikan elemen tanpa mengisi data atau menampilkan field pengganti. Modal/konten akan kosong total untuk tipe "${typeVal}". WAJIB isi nilai/tampilkan field khusus untuk tipe ini atau berikan informasi via showToast().`
          );
        }
      }
    }
  }

  return issues;
}

/**
 * Ekstraksi issue MISSING_DELETE_WIRING untuk pelaporan atau auto-recovery
 */
export function extractMissingDeleteWiring(issues: string[]): string[] {
  return (issues || [])
    .filter((i) => i.startsWith('MISSING_DELETE_WIRING:'))
    .map((i) => i.replace(/^MISSING_DELETE_WIRING:\s*/, ''));
}

/**
 * Ekstraksi issue FAKE_DELETE_ACTION untuk pelaporan atau auto-recovery
 */
export function extractFakeDeleteActions(issues: string[]): string[] {
  return (issues || [])
    .filter((i) => i.startsWith('FAKE_DELETE_ACTION:'))
    .map((i) => i.replace(/^FAKE_DELETE_ACTION:\s*/, ''));
}

/**
 * Memeriksa integrasi aksi hapus (Sub-Bug 6d):
 * 1. FAKE_DELETE_ACTION: Fungsi eksekusi hapus hanya menutup modal/showToast tanpa benar-benar memodifikasi array state (.splice() atau .filter()).
 * 2. MISSING_DELETE_WIRING: Infrastruktur modal konfirmasi hapus / fungsi bukaModalHapus ada, tapi tidak ada tombol yang memanggilnya di tabel/list.
 */
export function checkMissingDeleteWiringAndFakeAction(
  ast: any,
  html: string,
  jsCode: string
): string[] {
  const issues: string[] = [];

  // -------------------------------------------------------------------------
  // 1. Kumpulkan seluruh fungsi di JavaScript (AST & body teks)
  // -------------------------------------------------------------------------
  interface FnDef {
    name: string;
    node?: any;
    bodyText: string;
  }
  const fnDefs = new Map<string, FnDef>();

  if (ast) {
    function walk(node: any) {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'FunctionDeclaration' && node.id?.name) {
        fnDefs.set(node.id.name, { name: node.id.name, node, bodyText: '' });
      } else if (node.type === 'VariableDeclarator' && node.id?.name && node.init) {
        if (node.init.type === 'FunctionExpression' || node.init.type === 'ArrowFunctionExpression') {
          fnDefs.set(node.id.name, { name: node.id.name, node: node.init, bodyText: '' });
        }
      } else if (node.type === 'AssignmentExpression') {
        const left = node.left;
        const right = node.right;
        if (right && (right.type === 'FunctionExpression' || right.type === 'ArrowFunctionExpression')) {
          const name = left.type === 'Identifier' ? left.name : (left.type === 'MemberExpression' ? (left.property?.name || left.property?.value) : null);
          if (name) fnDefs.set(name, { name, node: right, bodyText: '' });
        }
      } else if (node.type === 'Property') {
        if (node.value?.type === 'FunctionExpression' || node.value?.type === 'ArrowFunctionExpression') {
          const name = node.key?.name || node.key?.value;
          if (name) fnDefs.set(name, { name, node: node.value, bodyText: '' });
        }
      }
      for (const k of Object.keys(node)) {
        if (k === 'loc' || k === 'range') continue;
        const child = node[k];
        if (Array.isArray(child)) {
          for (const c of child) walk(c);
        } else if (child && typeof child.type === 'string') {
          walk(child);
        }
      }
    }
    walk(ast);
  }

  if (jsCode) {
    const fnRegex = /(?:function\s+([a-zA-Z0-9_]+)|(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*(?:function|\([^)]*\)\s*=>))\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/g;
    let match: RegExpExecArray | null;
    while ((match = fnRegex.exec(jsCode)) !== null) {
      const name = match[1] || match[2];
      const body = match[3] || '';
      if (name) {
        const existing = fnDefs.get(name);
        if (existing) {
          existing.bodyText = body;
        } else {
          fnDefs.set(name, { name, bodyText: body });
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // 2. BAGIAN A: PEMERIKSAAN FAKE_DELETE_ACTION
  // -------------------------------------------------------------------------
  // Cari fungsi yang bertugas mengeksekusi hapus data:
  // e.g. eksekusiHapus, hapusData, hapusSiswa, hapusUser, confirmHapus, doDelete, dsb.
  const isDeleteExecutionFn = (name: string): boolean => {
    // Mengecualikan pembuka/penutup modal (bukaModalHapus, tutupModalHapus, confirmDelete, konfirmasiHapus)
    if (/^(?:buka|open|tutup|close)modal/i.test(name)) return false;
    if (/^(?:confirmdelete|konfirmasihapus)$/i.test(name)) return false;
    return /^(?:eksekusihapus|hapus|delete|remove|dodelete|actiondelete|executedelete)[a-zA-Z0-9_]*/i.test(name);
  };

  const checkArrayDeletion = (node: any, bodyText: string): boolean => {
    let hasDeletion = false;

    // 1. AST Check: cari call ke .splice() atau assignment dari .filter()
    if (node) {
      function check(n: any) {
        if (hasDeletion || !n || typeof n !== 'object') return;

        if (n.type === 'CallExpression') {
          if (n.callee?.type === 'MemberExpression') {
            const prop = n.callee.property?.name || n.callee.property?.value;
            // .splice(idx, 1)
            if (prop === 'splice') {
              hasDeletion = true;
              return;
            }
          }
        }

        if (n.type === 'AssignmentExpression') {
          // data = data.filter(...) atau array = ...
          let rightHasFilter = false;
          function checkFilter(rn: any) {
            if (rightHasFilter || !rn || typeof rn !== 'object') return;
            if (rn.type === 'CallExpression' && rn.callee?.type === 'MemberExpression') {
              const p = rn.callee.property?.name || rn.callee.property?.value;
              if (p === 'filter') {
                rightHasFilter = true;
                return;
              }
            }
            for (const rk of Object.keys(rn)) {
              if (rk === 'loc' || rk === 'range') continue;
              const ch = rn[rk];
              if (Array.isArray(ch)) {
                for (const item of ch) checkFilter(item);
              } else if (ch && typeof ch.type === 'string') {
                checkFilter(ch);
              }
            }
          }
          checkFilter(n.right);
          if (rightHasFilter) {
            hasDeletion = true;
            return;
          }
        }

        // delete array[index] atau delete obj[key]
        if (n.type === 'UnaryExpression' && n.operator === 'delete') {
          hasDeletion = true;
          return;
        }

        for (const k of Object.keys(n)) {
          if (k === 'loc' || k === 'range') continue;
          const child = n[k];
          if (Array.isArray(child)) {
            for (const c of child) check(c);
          } else if (child && typeof child.type === 'string') {
            check(child);
          }
        }
      }
      check(node);
    }

    // 2. Regex fallback
    if (!hasDeletion && bodyText) {
      if (/\.(?:splice\s*\([^)]+\)|filter\s*\([^)]+\))/i.test(bodyText)) {
        hasDeletion = true;
      }
    }

    return hasDeletion;
  };

  for (const [fnName, fnData] of fnDefs.entries()) {
    if (isDeleteExecutionFn(fnName)) {
      const hasActualDeletion = checkArrayDeletion(fnData.node, fnData.bodyText);
      if (!hasActualDeletion) {
        issues.push(
          `FAKE_DELETE_ACTION: Fungsi eksekusi hapus "${fnName}" tidak memodifikasi array state (tidak ditemukan operasi .splice() atau penugasan kembali .filter()). Fungsi hanya menutup modal atau menampilkan notifikasi tanpa benar-benar menghapus data dari memori aplikasi.`
        );
      }
    }
  }

  // -------------------------------------------------------------------------
  // 3. BAGIAN B: PEMERIKSAAN MISSING_DELETE_WIRING
  // -------------------------------------------------------------------------
  // Apakah ada infrastruktur modal konfirmasi hapus di HTML / JS?
  const hasDeleteModalHtml = /(?:id=["'](?:modalHapus|deleteModal|modalKonfirmasiHapus|modalDelete)["']|v-(?:if|show)=["'][^"']*deleteModal[^"']*["'])/i.test(html);
  const deleteModalOpenerFn = [...fnDefs.keys()].find((name) =>
    /^(?:bukaModalHapus|openDeleteModal|bukaKonfirmasiHapus|openModalDelete|konfirmasiHapus|confirmDelete)$/i.test(name)
  );

  if (hasDeleteModalHtml || deleteModalOpenerFn) {
    // Infrastruktur modal hapus terdefinisi. Sekarang verifikasi apakah ada pemanggilannya di UI.
    // Pemanggilan bisa berada di:
    // 1. Tag HTML static: onclick="bukaModalHapus(...)"
    // 2. Template string JS di dalam render functions: e.g. `<button ... onclick="bukaModalHapus(...)">`
    const openerName = deleteModalOpenerFn || 'bukaModalHapus';
    
    // Periksa pemanggilan di AST CallExpression
    let isCalledInAst = false;
    if (ast) {
      function checkCall(n: any) {
        if (isCalledInAst || !n || typeof n !== 'object') return;
        if (n.type === 'CallExpression') {
          const calleeName = n.callee?.name || n.callee?.property?.name;
          if (calleeName && calleeName.toLowerCase() === openerName.toLowerCase()) {
            isCalledInAst = true;
            return;
          }
        }
        for (const k of Object.keys(n)) {
          if (k === 'loc' || k === 'range') continue;
          const ch = n[k];
          if (Array.isArray(ch)) {
            for (const item of ch) checkCall(item);
          } else if (ch && typeof ch.type === 'string') {
            checkCall(ch);
          }
        }
      }
      checkCall(ast);
    }

    // Bersihkan kontainer modal konfirmasi hapus agar tombol konfirmasi di dalam modal
    // ("Ya, Hapus") tidak salah dianggap sebagai tombol pemanggil dari tabel
    const htmlOutsideDeleteModal = html.replace(/<div\b[^>]*\bid=["'](?:modalHapus|deleteModal|modalKonfirmasiHapus|modalDelete)["'][^>]*>[\s\S]*?<\/div>/gi, '');

    // Periksa pemanggilan di atribut onclick/click HTML statis (di luar modal konfirmasi)
    const isCalledInHtml = new RegExp(`(?:onclick|@click|v-on:click)\\s*=\\s*['"][^'"]*\\b${openerName}\\b`, 'i').test(htmlOutsideDeleteModal);

    // Periksa pemanggilan di template string JS yang me-render baris tabel secara dinamis
    const isCalledInJsTemplates = new RegExp(`(?:onclick|@click|v-on:click)\\s*=\\s*['"\\\\]*[^'"\\\\]*\\b${openerName}\\b`, 'i').test(jsCode);

    // Cek juga apakah ada tombol dengan teks Hapus/Delete yang memanggil fungsi hapus (di luar modal)
    const hasDeleteButtonInHtml = /<button\b[^>]*(?:onclick|@click|v-on:click)=["'][^"']*(?:hapus|delete)[^"']*["'][^>]*>[\s\S]*?(?:Hapus|Delete)[\s\S]*?<\/button>/i.test(htmlOutsideDeleteModal);
    const hasDeleteButtonInJsTemplates = /<button\b[^>]*(?:onclick|@click|v-on:click)=[\\"]*[^\\"'>]*(?:hapus|delete)[^\\"'>]*[\\"]*[^>]*>[\s\S]*?(?:Hapus|Delete)[\s\S]*?<\/button>/i.test(jsCode);

    if (!isCalledInAst && !isCalledInHtml && !isCalledInJsTemplates && !hasDeleteButtonInHtml && !hasDeleteButtonInJsTemplates) {
      const targetLabel = deleteModalOpenerFn ? `fungsi "${deleteModalOpenerFn}"` : 'modal #modalHapus';
      issues.push(
        `MISSING_DELETE_WIRING: Infrastruktur konfirmasi hapus (${targetLabel}) telah terdefinisi di kode, namun TIDAK ADA tombol "Hapus" di tabel/daftar data yang memanggilnya. Pengguna tidak memiliki akses di antarmuka untuk memicu aksi hapus data.`
      );
    }
  }

  return issues;
}

