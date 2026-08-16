/**
 * Helper untuk menyusun HTML yang valid, ber-kontras tinggi, dan aman untuk iframe srcDoc.
 * Memastikan teks dan elemen UI selalu tajam, kontras tinggi, dan mudah dibaca oleh non-programmer.
 */
export function buildSrcDoc(canvasCode: { html: string; css: string; js: string }): string {
  if (!canvasCode || !canvasCode.html) return '';

  const { html, css = '', js = '' } = canvasCode;
  const isFullDoc = html.includes('<!DOCTYPE') || html.includes('<html') || html.includes('<body');

  // Injeksi base style kontras tinggi jika belum ada
  const highContrastBaseCss = `
    /* High-contrast base resets */
    html, body {
      background-color: #f8fafc !important;
      color: #0f172a !important;
      font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 20px;
      box-sizing: border-box;
    }
    h1, h2, h3, h4, h5, h6 {
      color: #0f172a !important;
      font-weight: 700;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    th {
      background-color: #f1f5f9 !important;
      color: #1e293b !important;
      font-weight: 700;
      padding: 12px 16px;
      border-bottom: 2px solid #e2e8f0;
      text-align: left;
    }
    td {
      color: #334155 !important;
      padding: 12px 16px;
      border-bottom: 1px solid #f1f5f9;
    }
    input, select, textarea {
      background-color: #ffffff !important;
      color: #0f172a !important;
      border: 1px solid #cbd5e1 !important;
      padding: 8px 12px;
      border-radius: 8px;
    }
  `;

  if (isFullDoc) {
    let cleanDoc = html;

    // Masukkan Google Fonts dan High Contrast Base Resets ke dalam <head>
    const fontAndResetTag = `
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
      <style>
        ${highContrastBaseCss}
        ${css}
      </style>
    `;

    if (cleanDoc.includes('<head>')) {
      cleanDoc = cleanDoc.replace('<head>', `<head>${fontAndResetTag}`);
    } else if (cleanDoc.includes('<html>')) {
      cleanDoc = cleanDoc.replace('<html>', `<html><head>${fontAndResetTag}</head>`);
    } else {
      cleanDoc = `<head>${fontAndResetTag}</head>` + cleanDoc;
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
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    ${highContrastBaseCss}
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
