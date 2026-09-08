export type PatchType =
  | 'textColor'
  | 'textContent'
  | 'bgColor'
  | 'fontSize'
  | 'fontWeight'
  | 'textAlign'
  | 'borderRadius'
  | 'remove';

export interface SinglePatch {
  id: string;
  elementUid: string;
  patchType: PatchType;
  value: string;
  createdAt: string;
}

export const ALLOWED_OD_SELECTOR = 'p,h1,h2,h3,h4,h5,h6,span,label,button,a,li,th,td,b,strong,i,em,small';

/**
 * Menerapkan patches visual langsung ke dalam string HTML sumber secara permanen.
 * Memastikan perubahan WYSIWYG (teks, warna, radius, ukuran) tersimpan ke kode sumber.
 */
export function syncPatchesToHtml(html: string, patches: SinglePatch[]): string {
  if (!html || !patches || patches.length === 0) return html;
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return html;
  }

  try {
    const isFullDoc = html.includes('<!DOCTYPE') || html.includes('<html') || html.includes('<body');
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Pastikan data-od-uid terpasang secara konsisten
    const els = Array.from(doc.querySelectorAll(ALLOWED_OD_SELECTOR));
    els.forEach((el, idx) => {
      if (!el.hasAttribute('data-od-uid')) {
        el.setAttribute('data-od-uid', 'e' + idx);
      }
    });

    // Terapkan setiap patch berurutan
    for (const patch of patches) {
      if (!patch || !patch.elementUid) continue;
      const target = doc.querySelector(`[data-od-uid="${patch.elementUid}"]`) as HTMLElement | null;
      if (!target) continue;

      switch (patch.patchType) {
        case 'textContent':
          target.textContent = patch.value;
          break;
        case 'textColor':
          target.style.color = patch.value;
          break;
        case 'bgColor':
          target.style.backgroundColor = patch.value;
          break;
        case 'fontSize':
          target.style.fontSize = patch.value;
          break;
        case 'fontWeight':
          target.style.fontWeight = patch.value;
          break;
        case 'textAlign':
          target.style.textAlign = patch.value;
          break;
        case 'borderRadius':
          target.style.borderRadius = patch.value;
          break;
        case 'remove':
          target.remove();
          break;
      }
    }

    if (isFullDoc) {
      const hasDoctype = html.includes('<!DOCTYPE') || html.includes('<!doctype');
      const serialized = doc.documentElement.outerHTML;
      return hasDoctype ? `<!DOCTYPE html>\n${serialized}` : serialized;
    } else {
      return doc.body.innerHTML;
    }
  } catch (err) {
    console.error('Gagal mensinkronkan patches ke HTML:', err);
    return html;
  }
}

/**
 * Membersihkan atribut data-od-uid untuk kebutuhan ekspor kode bersih
 */
export function stripOdUids(html: string): string {
  if (!html) return '';
  return html.replace(/\s*data-od-uid="[^"]*"/g, '');
}
