/**
 * Helper untuk menyusun HTML yang valid dan aman untuk iframe srcDoc.
 * Menangani kasus jika HTML sudah berupa dokumen utuh (<!DOCTYPE html>)
 * maupun potongan fragmen, tanpa terjadi double nesting <html>/<body>.
 */
export function buildSrcDoc(canvasCode: { html: string; css: string; js: string }): string {
  if (!canvasCode || !canvasCode.html) return '';

  const { html, css = '', js = '' } = canvasCode;
  const isFullDoc = html.includes('<!DOCTYPE') || html.includes('<html') || html.includes('<body');

  if (isFullDoc) {
    let cleanDoc = html;

    // Jika ada CSS tambahan dan belum ada di dokumen
    if (css && !cleanDoc.includes(css)) {
      if (cleanDoc.includes('</head>')) {
        cleanDoc = cleanDoc.replace('</head>', `<style>${css}</style></head>`);
      } else {
        cleanDoc = `<style>${css}</style>` + cleanDoc;
      }
    }

    // Jika ada JS tambahan dan belum ada di dokumen
    if (js && !cleanDoc.includes(js)) {
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
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Outfit', -apple-system, sans-serif; margin: 0; padding: 20px; background: #0f172a; color: #f8fafc; }
    ${css}
  </style>
</head>
<body>
  ${html}
  <script>
    try {
      ${js}
    } catch(err) {
      console.error("Canvas JS Error:", err);
    }
  </script>
</body>
</html>`;
}
