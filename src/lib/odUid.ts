/**
 * Shared OpenDesign UID policy.
 *
 * UID must be deterministic between:
 * - the HTML injected into the preview iframe (buildSrcDoc), and
 * - the source HTML persisted after a WYSIWYG edit (htmlPatcher).
 *
 * Both sides MUST use OD_UID_SELECTOR and ensureOdUids() from this module,
 * otherwise edits silently fail to persist (runtime UID != source UID).
 */

export const OD_UID_SELECTOR =
  'p,h1,h2,h3,h4,h5,h6,span,label,button,a,li,th,td,b,strong,i,em,small,div,section,form,header,nav,main,aside,footer,table,tbody,tr,ul,ol,select,input,textarea';

export function ensureOdUids(doc: Document): void {
  const existingUids = new Set<string>();
  doc.querySelectorAll('[data-od-uid]').forEach((el) => {
    const uid = el.getAttribute('data-od-uid');
    if (uid) existingUids.add(uid);
  });

  let counter = 0;
  const els = Array.from(doc.querySelectorAll(OD_UID_SELECTOR));
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
 * Bake deterministic data-od-uid attributes into an HTML string.
 * Returns the original string untouched when DOMParser is unavailable (SSR).
 */
export function assignOdUidsToHtml(html: string): string {
  if (!html) return html;
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') return html;

  try {
    const isFullDoc = html.includes('<!DOCTYPE') || html.includes('<html') || html.includes('<body');
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    ensureOdUids(doc);

    if (isFullDoc) {
      const hasDoctype = /<!doctype/i.test(html);
      const serialized = doc.documentElement.outerHTML;
      return hasDoctype ? `<!DOCTYPE html>\n${serialized}` : serialized;
    }
    return doc.body.innerHTML;
  } catch {
    return html;
  }
}
