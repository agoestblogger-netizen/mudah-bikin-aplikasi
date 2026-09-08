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

function ensureOdUids(doc: Document) {
  const existingUids = new Set<string>();
  doc.querySelectorAll('[data-od-uid]').forEach((el) => {
    const uid = el.getAttribute('data-od-uid');
    if (uid) existingUids.add(uid);
  });
  let counter = 0;
  const els = Array.from(doc.querySelectorAll(ALLOWED_OD_SELECTOR));
  els.forEach((el) => {
    if (!el.hasAttribute('data-od-uid')) {
      while (existingUids.has('e' + counter)) {
        counter++;
      }
      const newUid = 'e' + counter;
      el.setAttribute('data-od-uid', newUid);
      existingUids.add(newUid);
    }
  });
}

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

    // Pastikan data-od-uid terpasang secara konsisten tanpa menimpa UID yang sudah ada
    ensureOdUids(doc);

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
 * Menghapus satu elemen secara permanen dari string HTML sumber berdasarkan elementUid,
 * tanpa merusak atau mengubah UID elemen lainnya.
 */
export function removeElementFromHtml(html: string, elementUid: string): string {
  if (!html || !elementUid) return html;
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return html;
  }

  try {
    const isFullDoc = html.includes('<!DOCTYPE') || html.includes('<html') || html.includes('<body');
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    ensureOdUids(doc);

    const target = doc.querySelector(`[data-od-uid="${elementUid}"]`);
    if (target) {
      target.remove();
    } else {
      console.warn(`Elemen target dengan UID ${elementUid} tidak ditemukan untuk dihapus.`);
      return html;
    }

    if (isFullDoc) {
      const hasDoctype = html.includes('<!DOCTYPE') || html.includes('<!doctype');
      const serialized = doc.documentElement.outerHTML;
      return hasDoctype ? `<!DOCTYPE html>\n${serialized}` : serialized;
    } else {
      return doc.body.innerHTML;
    }
  } catch (err) {
    console.error('Gagal menghapus elemen di HTML:', err);
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

/**
 * Mengganti satu elemen target secara bedah (surgical) berdasarkan elementUid
 * dengan cuplikan HTML baru di dalam string HTML sumber secara permanen.
 */
export function replaceElementInHtml(html: string, elementUid: string, newElementHtml: string): string {
  if (!html || !elementUid || !newElementHtml) return html;
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return html;
  }

  try {
    const isFullDoc = html.includes('<!DOCTYPE') || html.includes('<html') || html.includes('<body');
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Cari elemen target
    let target = doc.querySelector(`[data-od-uid="${elementUid}"]`);
    if (!target) {
      // Pasang UID konsisten jika belum ada
      ensureOdUids(doc);
      target = doc.querySelector(`[data-od-uid="${elementUid}"]`);
    }

    if (!target) {
      console.warn(`Elemen target dengan UID ${elementUid} tidak ditemukan di HTML.`);
      return html;
    }

    // Parse cuplikan HTML baru
    const tempDoc = parser.parseFromString(newElementHtml, 'text/html');
    const newEl = tempDoc.body.firstElementChild;
    if (!newEl) {
      console.warn('Cuplikan HTML baru tidak menghasilkan elemen valid.');
      return html;
    }

    // Pastikan data-od-uid tetap terpasang pada elemen baru
    newEl.setAttribute('data-od-uid', elementUid);

    // Ganti target dengan newEl
    target.replaceWith(newEl);

    if (isFullDoc) {
      const hasDoctype = html.includes('<!DOCTYPE') || html.includes('<!doctype');
      const serialized = doc.documentElement.outerHTML;
      return hasDoctype ? `<!DOCTYPE html>\n${serialized}` : serialized;
    } else {
      return doc.body.innerHTML;
    }
  } catch (err) {
    console.error('Gagal mengganti elemen bedah di HTML:', err);
    return html;
  }
}

/**
 * Menyisipkan ikon Lucide ke dalam elemen target berdasarkan elementUid secara permanen di HTML.
 * Jika elemen sudah memiliki ikon (<i data-lucide="..."> atau <svg class="...lucide..."),
 * ikon tersebut diganti dengan yang baru. Jika belum, ikon baru disisipkan di awal elemen (prepend).
 */
export function insertIconIntoHtml(html: string, elementUid: string, iconName: string): string {
  if (!html || !elementUid || !iconName) return html;
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return html;
  }

  try {
    const isFullDoc = html.includes('<!DOCTYPE') || html.includes('<html') || html.includes('<body');
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    let target = doc.querySelector(`[data-od-uid="${elementUid}"]`);
    if (!target) {
      ensureOdUids(doc);
      target = doc.querySelector(`[data-od-uid="${elementUid}"]`);
    }

    if (!target) {
      console.warn(`Elemen target dengan UID ${elementUid} tidak ditemukan untuk disisipkan ikon.`);
      return html;
    }

    const existingIcon = target.querySelector('i[data-lucide], svg.lucide, svg[data-lucide]');
    const newIcon = doc.createElement('i');
    newIcon.setAttribute('data-lucide', iconName.toLowerCase().trim());
    newIcon.setAttribute('style', 'width: 16px; height: 16px; display: inline-block; vertical-align: middle; margin-right: 6px;');

    if (existingIcon) {
      existingIcon.replaceWith(newIcon);
    } else {
      target.insertBefore(newIcon, target.firstChild);
    }

    if (isFullDoc) {
      const hasDoctype = html.includes('<!DOCTYPE') || html.includes('<!doctype');
      const serialized = doc.documentElement.outerHTML;
      return hasDoctype ? `<!DOCTYPE html>\n${serialized}` : serialized;
    } else {
      return doc.body.innerHTML;
    }
  } catch (err) {
    console.error('Gagal menyisipkan ikon ke HTML:', err);
    return html;
  }
}

/**
 * Menyisipkan atau memperbarui gambar (img) pada elemen target berdasarkan elementUid secara permanen di HTML.
 * Jika elemen target sendiri adalah <img>, perbarui src.
 * Jika elemen target berisi <img>, perbarui src gambar yang ada.
 * Jika tidak, sisipkan tag <img> baru di awal elemen.
 */
export function insertImageIntoHtml(
  html: string,
  elementUid: string,
  imageUrl: string,
  styleType: 'avatar' | 'banner' | 'thumbnail' = 'thumbnail'
): string {
  if (!html || !elementUid || !imageUrl) return html;
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return html;
  }

  try {
    const isFullDoc = html.includes('<!DOCTYPE') || html.includes('<html') || html.includes('<body');
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    let target = doc.querySelector(`[data-od-uid="${elementUid}"]`) as HTMLElement | null;
    if (!target) {
      ensureOdUids(doc);
      target = doc.querySelector(`[data-od-uid="${elementUid}"]`) as HTMLElement | null;
    }

    if (!target) {
      console.warn(`Elemen target dengan UID ${elementUid} tidak ditemukan untuk disisipkan gambar.`);
      return html;
    }

    let defaultStyle = 'width: 48px; height: 48px; border-radius: 8px; object-fit: cover; display: inline-block; vertical-align: middle; margin-right: 8px;';
    if (styleType === 'avatar') {
      defaultStyle = 'width: 36px; height: 36px; border-radius: 9999px; object-fit: cover; display: inline-block; vertical-align: middle; margin-right: 8px;';
    } else if (styleType === 'banner') {
      defaultStyle = 'width: 100%; height: 180px; object-fit: cover; border-radius: 8px; margin-bottom: 12px; display: block;';
    }

    if (target.tagName.toLowerCase() === 'img') {
      target.setAttribute('src', imageUrl);
    } else {
      const existingImg = target.querySelector('img');
      if (existingImg) {
        existingImg.setAttribute('src', imageUrl);
      } else {
        const newImg = doc.createElement('img');
        newImg.setAttribute('src', imageUrl);
        newImg.setAttribute('alt', 'Gambar');
        newImg.setAttribute('style', defaultStyle);
        target.insertBefore(newImg, target.firstChild);
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
    console.error('Gagal menyisipkan gambar ke HTML:', err);
    return html;
  }
}
