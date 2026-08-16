/**
 * Helper untuk menyusun HTML yang valid, modern, dan aman untuk iframe srcDoc.
 * Mengintegrasikan Tailwind CSS CDN, Google Fonts (Plus Jakarta Sans), dan Lucide Icons.
 */
export function buildSrcDoc(canvasCode: { html: string; css: string; js: string }): string {
  if (!canvasCode || !canvasCode.html) return '';

  const { html, css = '', js = '' } = canvasCode;
  const isFullDoc = html.includes('<!DOCTYPE') || html.includes('<html') || html.includes('<body');

  const cdnHeader = `
  <!-- Tailwind CSS Play CDN -->
  <script src="https://cdn.tailwindcss.com"></script>
  <!-- Google Fonts: Plus Jakarta Sans -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <!-- Lucide Icons CDN -->
  <script src="https://unpkg.com/lucide@latest"></script>
  <style>
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
    }
    ${css}
  </style>
  `;

  if (isFullDoc) {
    let cleanDoc = html;

    // Masukkan CDN Header ke dalam <head> jika belum ada
    if (!cleanDoc.includes('cdn.tailwindcss.com')) {
      if (cleanDoc.includes('<head>')) {
        cleanDoc = cleanDoc.replace('<head>', `<head>${cdnHeader}`);
      } else if (cleanDoc.includes('<html>')) {
        cleanDoc = cleanDoc.replace('<html>', `<html><head>${cdnHeader}</head>`);
      } else {
        cleanDoc = `<head>${cdnHeader}</head>` + cleanDoc;
      }
    }

    // Masukkan JS jika ada dan belum ada di dokumen
    if (js && js.trim().length > 0 && !cleanDoc.includes(js)) {
      if (cleanDoc.includes('</body>')) {
        cleanDoc = cleanDoc.replace('</body>', `<script>\ntry {\n${js}\n} catch(e) { console.error("JS Error:", e); }\n</script></body>`);
      } else {
        cleanDoc += `<script>\ntry {\n${js}\n} catch(e) { console.error("JS Error:", e); }\n</script>`;
      }
    }

    return cleanDoc;
  }

  // Jika berupa fragmen komponen HTML
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${cdnHeader}
</head>
<body class="bg-slate-50 text-slate-900 min-h-screen p-6">
  ${html}
  ${js ? `<script>\ntry {\n${js}\n} catch(e) { console.error("JS Error:", e); }\n</script>` : ''}
</body>
</html>`;
}
