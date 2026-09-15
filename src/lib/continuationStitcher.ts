/**
 * SMART BOUNDARY CONTINUATION STITCHER (Pilar 3)
 * Menggabungkan potongan kode dari respons sambungan (continuation chunk)
 * secara aman dengan deteksi overlap dan deduplikasi token batas (boundary token deduplication)
 * untuk mencegah SYNTAX_ERROR seperti `Unexpected token ')'` atau fence leaks.
 */

export function stitchContinuationCode(existing: string, contRaw: string): string {
  if (!contRaw) return existing;
  let cont = contRaw;

  // 1. Bersihkan code fences di awal continuation jika model mengulangnya
  if (cont.startsWith('```html\n')) cont = cont.slice(8);
  else if (cont.startsWith('```html')) cont = cont.slice(7);
  else if (cont.startsWith('```javascript\n')) cont = cont.slice(14);
  else if (cont.startsWith('```js\n')) cont = cont.slice(6);
  else if (cont.startsWith('```\n')) cont = cont.slice(4);
  else if (cont.startsWith('```')) cont = cont.slice(3);

  // 2. Deteksi overlapping substring persis (dari 150 karakter turun sampai 6 karakter)
  const maxOverlap = Math.min(150, existing.length, cont.length);
  for (let len = maxOverlap; len >= 6; len--) {
    const endChunk = existing.slice(-len);
    if (cont.startsWith(endChunk)) {
      return existing + cont.slice(len);
    }
  }

  // 3. Deteksi overlapping dengan pengabaian whitespace batas
  const trimmedEnd = existing.trimEnd();
  const trimmedCont = cont.trimStart();
  for (let len = Math.min(80, trimmedEnd.length, trimmedCont.length); len >= 6; len--) {
    const endChunk = trimmedEnd.slice(-len);
    if (trimmedCont.startsWith(endChunk)) {
      const remainder = trimmedCont.slice(len);
      return existing + (existing.endsWith('\n') || cont.startsWith('\n') ? '' : ' ') + remainder;
    }
  }

  // 4. Boundary Token Deduplication (pencegah SYNTAX_ERROR: Unexpected token ')')
  // Jika ujung existing berakhir dengan token penutup (')', '}', ';', ']', '>')
  // dan awal continuation dimulai dengan token penutup yang sama persis
  const boundaryTokens = [')', '}', ';', ']', '>'];
  for (const token of boundaryTokens) {
    if (trimmedEnd.endsWith(token) && trimmedCont.startsWith(token)) {
      const cleanCont = trimmedCont.slice(token.length);
      return existing + cleanCont;
    }
  }

  return existing + cont;
}
