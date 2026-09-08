/**
 * Helper pembersih kebocoran teks percakapan AI / markdown dari kode HTML prototipe.
 * Memastikan bahwa hanya markup HTML & tag script murni yang dirender di iframe canvas
 * dan disimpan di database.
 */
export function cleanConversationalLeaks(html: string): string {
  if (!html) return '';
  let clean = html;

  // 1. Potong teks apapun di luar/setelah tag </html>
  if (clean.includes('</html>')) {
    clean = clean.slice(0, clean.lastIndexOf('</html>') + 7).trim();
  }

  // 2. Bersihkan teks percakapan / markdown antara </script> terakhir dan </body>
  const lastScriptIndex = clean.lastIndexOf('</script>');
  if (lastScriptIndex !== -1) {
    const beforeLastScript = clean.slice(0, lastScriptIndex + 9);
    const afterLastScript = clean.slice(lastScriptIndex + 9);

    const bodyIndex = afterLastScript.search(/<\/body>/i);
    if (bodyIndex !== -1) {
      const betweenScriptAndBody = afterLastScript.slice(0, bodyIndex);
      const bodyAndBeyond = afterLastScript.slice(bodyIndex);

      // Pisahkan baris di antara script dan body: hanya izinkan baris yang murni tag HTML (<...>) atau whitespace
      const lines = betweenScriptAndBody.split('\n');
      const filteredLines = lines.filter(line => {
        const trimmed = line.trim();
        if (!trimmed) return false;
        // Izinkan baris tag HTML valid seperti <div id="toast" class="toast"></div>
        if (trimmed.startsWith('<') && trimmed.endsWith('>')) return true;
        // Buang jika mengandung indikasi teks percakapan atau markdown
        if (/(?:kode|prototipe|berikut|seluruh|ringkasan|integritas|jika|placeholder|catatan|fitur|perubahan|here|note|update|summary|[#*`>-]|\d+\.)/i.test(trimmed)) {
          return false;
        }
        // Buang teks biasa yang tidak dibungkus kurung siku HTML
        if (!trimmed.includes('<') && !trimmed.includes('>')) {
          return false;
        }
        return true;
      });

      const middle = filteredLines.join('\n').trim();
      clean = beforeLastScript + (middle ? '\n' + middle + '\n' : '\n') + bodyAndBeyond;
    } else {
      // Tidak ada </body> setelah </script>
      const cleanedAfter = afterLastScript
        .replace(/(?:Kode prototipe|Berikut adalah|Seluruh kode|###|Ringkasan|Integritas|Jika Anda|Prototipe|Here is|Note:)[\s\S]*/gi, '')
        .replace(/(?:^|\n)\s*(?:[#*`>-]|\d+\.|\*\*)[^\n<]*/gi, '')
        .replace(/<\/html>[\s\S]*$/i, '</html>')
        .trim();
      clean = beforeLastScript + (cleanedAfter ? '\n' + cleanedAfter : '\n</body>\n</html>');
    }
  }

  // 3. Bersihkan sisa teks percakapan / markdown yang berada sebelum </body> (meskipun tidak ada script)
  clean = clean.replace(/(?:Kode prototipe|Berikut adalah|Seluruh kode|###\s*Ringkasan|Integritas Fungsionalitas|Jika Anda ingin)[\s\S]*?(?=<\/body>|$)/gi, '');

  return clean.trim();
}
