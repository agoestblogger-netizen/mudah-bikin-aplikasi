interface BriefLikeMessage {
  sender?: string;
  text?: string;
}

// Ambil nama aplikasi dari lembar "Brief Kebutuhan" AI, contoh: "- **Nama App**: Kasir Pintar"
export function extractAppTitle(text: string): string | null {
  if (!text) return null;
  const match = text.match(/\*\*Nama App\*\*\s*[::]\s*([^\n\r*]+)/i) || text.match(/Nama App\s*[::]\s*([^\n\r]+)/i);
  if (!match) return null;
  const name = (match[1] || '').replace(/\s+/g, ' ').trim().replace(/^[:.\-\s]+|[:.\-\s]+$/g, '');
  if (!name) return null;
  return name.slice(0, 120);
}

// Cari judul dari pesan AI terbaru yang memuat "Nama App"
export function extractAppTitleFromChat(messages: BriefLikeMessage[]): string | null {
  if (!Array.isArray(messages)) return null;
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (!msg || msg.sender !== 'AI') continue;
    const title = extractAppTitle(msg.text || '');
    if (title) return title;
  }
  return null;
}