interface BriefLikeMessage {
  sender?: string;
  text?: string;
}

// Ambil nama aplikasi dari lembar "Brief Kebutuhan" AI
// Format sebenarnya: "• Nama App: Dashboard Keuangan Harian" atau "- **Nama App**: X"
export function extractAppTitle(text: string): string | null {
  if (!text) return null;
  const patterns = [
    /[•\-*]\s*\*?\*?Nama\s*App\*?\*?\s*[::]\s*([^\n\r*•]+)/i,
    /Nama\s*App\s*[::]\s*([^\n\r*]+)/i
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const name = (m[1] || '').replace(/\s+/g, ' ').trim();
      if (name && name.length >= 2) return name.slice(0, 120);
    }
  }
  return null;
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