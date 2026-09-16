import assert from 'assert';
import { checkTailwindSyntax } from '../src/lib/codeValidator';

console.log('========================================================================');
console.log('🧪 TEST SUITE: TAILWIND V4 LIGHTWEIGHT VALIDATOR (ANTI-PLUGIN & JIT COMPAT)');
console.log('========================================================================\n');

// -----------------------------------------------------------------------------
// UJI NEGATIF: Kelas dari Plugin Non-Core Harus Ditolak
// -----------------------------------------------------------------------------
console.log('--- UJI NEGATIF: Penolakan Kelas Plugin Non-Core ---');

const htmlWithPlugins = `<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
  <div class="scrollbar-hide overflow-x-auto">
    <input type="text" class="form-input rounded">
    <textarea class="form-textarea border"></textarea>
    <select class="form-select"></select>
    <article class="prose lg:prose-xl">Artikel</article>
    <div class="aspect-w-16 aspect-h-9">Video</div>
  </div>
</body>
</html>`;

const reportNeg = checkTailwindSyntax(htmlWithPlugins);
console.log('  Invalid classes detected:', reportNeg.invalidClasses);
console.log('  Warnings detected:', reportNeg.warnings);

assert(reportNeg.invalidClasses.includes('scrollbar-hide'), 'FAILED: scrollbar-hide harus ditolak');
assert(reportNeg.invalidClasses.includes('form-input'), 'FAILED: form-input harus ditolak');
assert(reportNeg.invalidClasses.includes('form-textarea'), 'FAILED: form-textarea harus ditolak');
assert(reportNeg.invalidClasses.includes('form-select'), 'FAILED: form-select harus ditolak');
assert(reportNeg.invalidClasses.includes('prose'), 'FAILED: prose harus ditolak');
assert(reportNeg.invalidClasses.includes('aspect-w-16'), 'FAILED: aspect-w-16 harus ditolak');
assert(reportNeg.invalidClasses.includes('aspect-h-9'), 'FAILED: aspect-h-9 harus ditolak');
console.log('  ✅ Uji Negatif: Seluruh kelas plugin non-core berhasil ditolak dengan tepat!\n');

// -----------------------------------------------------------------------------
// UJI POSITIF: Arbitrary Value & Modern Variants Harus Lolos (Tailwind v4 JIT)
// -----------------------------------------------------------------------------
console.log('--- UJI POSITIF: Arbitrary Values & Modern Variants Lolos Validasi ---');

const htmlWithModernV4Classes = `<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body class="bg-slate-50 text-slate-900">
  <!-- Arbitrary Values -->
  <div class="w-[350px] max-w-[90vw] top-[12px] bg-[#4f46e5] h-[80vh] rounded-[18px]">
    <!-- Modern Variants -->
    <button class="active:scale-95 active:bg-blue-700 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-indigo-500">
      Button
    </button>
    <!-- Core Aspect Ratio -->
    <div class="aspect-square aspect-video">Media</div>
    <!-- Opacity Modifiers & Dynamic Class -->
    <div class="bg-indigo-50/50 border-emerald-500/20" :class="{ 'opacity-100': true }">Card</div>
  </div>
</body>
</html>`;

const reportPos = checkTailwindSyntax(htmlWithModernV4Classes);
console.log('  Invalid classes detected:', reportPos.invalidClasses);
console.log('  Warnings detected:', reportPos.warnings);

assert.strictEqual(reportPos.invalidClasses.length, 0, `FAILED: Tidak boleh ada invalid class! Dapat: ${reportPos.invalidClasses.join(', ')}`);
assert.strictEqual(reportPos.warnings.length, 0, `FAILED: Tidak boleh ada warnings! Dapat: ${reportPos.warnings.join(', ')}`);
console.log('  ✅ Uji Positif: Arbitrary values & modern variants (active:scale-95, aspect-square, dll) lolos 100% tanpa warning!\n');

console.log('========================================================================');
console.log('🎉 SELURUH PENGUJIAN TAILWIND V4 LIGHTWEIGHT VALIDATOR LOLOS (PASS)!');
console.log('========================================================================');
