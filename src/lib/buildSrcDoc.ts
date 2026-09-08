/**
 * Helper untuk menyusun HTML yang valid, modern, dan mandiri (Zero-Dependency) untuk iframe srcDoc.
 * Memastikan styling tajam, ber-kontras tinggi, dan kebal dari restriksi sandbox tanpa CDN CSS eksternal.
 */
export function buildSrcDoc(canvasCode: { html: string; css: string; js: string }): string {
  if (!canvasCode || !canvasCode.html) return '';

  const { html, css = '', js = '' } = canvasCode;
  const isFullDoc = html.includes('<!DOCTYPE') || html.includes('<html') || html.includes('<body');

  // OpenDesign-like selection bridge (Mark/Select + bounds + patch apply)
  // Catatan: semua message memakai source yang sama agar parent bisa membedakan.
  const odBridgeScript = `
  <script>
  (function() {
    const SOURCE = 'OD_BRIDGE';
    const ALLOWED_SELECTOR = 'p,h1,h2,h3,h4,h5,h6,span,label,button,a,li,th,td';
    const PATCH_TYPE_TEXT_COLOR = 'textColor';
    const PATCH_TYPE_TEXT_CONTENT = 'textContent';
    const PATCH_TYPE_BG_COLOR = 'bgColor';

    let odMode = 'none';
    let odPatches = Array.isArray(window.__OD_PATCHES__) ? window.__OD_PATCHES__ : [];

    function postToParent(payload) {
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(Object.assign({ source: SOURCE }, payload), '*');
        }
      } catch (e) {}
    }

    function clamp01(n) {
      return Math.max(0, Math.min(1, n));
    }

    function getViewportSize() {
      const w = window.innerWidth || document.documentElement.clientWidth || 1;
      const h = window.innerHeight || document.documentElement.clientHeight || 1;
      return { w, h };
    }

    function normalizeRect(rect) {
      const { w, h } = getViewportSize();
      const left = rect.left / w;
      const top = rect.top / h;
      const width = rect.width / w;
      const height = rect.height / h;
      return {
        x: clamp01(left),
        y: clamp01(top),
        w: clamp01(width),
        h: clamp01(height)
      };
    }

    function assignElementUids() {
      const els = Array.from(document.querySelectorAll(ALLOWED_SELECTOR));
      els.forEach((el, idx) => {
        el.setAttribute('data-od-uid', 'e' + idx);
      });
    }

    function applyOnePatch(patch) {
      if (!patch || !patch.elementUid) return;
      const el = document.querySelector('[data-od-uid="' + patch.elementUid + '"]');
      if (!el) return;
      if (patch.patchType === PATCH_TYPE_TEXT_COLOR) {
        el.style.color = String(patch.value ?? '');
      } else if (patch.patchType === PATCH_TYPE_BG_COLOR) {
        el.style.backgroundColor = String(patch.value ?? '');
      } else if (patch.patchType === PATCH_TYPE_TEXT_CONTENT) {
        el.textContent = String(patch.value ?? '');
      }
    }

    function applyAllPatches() {
      if (!Array.isArray(odPatches)) return;
      odPatches.forEach(applyOnePatch);
    }

    function setMode(mode) {
      odMode = mode || 'none';
      if (odMode === 'select' || odMode === 'mark') {
        document.documentElement.style.cursor = 'crosshair';
      } else {
        document.documentElement.style.cursor = '';
      }
      if (hoveredEl) {
        hoveredEl.style.outline = '';
        hoveredEl.style.outlineOffset = '';
        hoveredEl = null;
      }
    }

    // Hover highlight in select mode
    let hoveredEl = null;
    let isEditingText = false;
    let justFinishedEditTime = 0;

    document.addEventListener('mouseover', function(e) {
      if (odMode !== 'select' || isEditingText) return;
      const target = e.target;
      if (!(target instanceof Element)) return;
      const el = target.closest('[data-od-uid]');
      if (el && el !== hoveredEl) {
        if (hoveredEl) {
          hoveredEl.style.outline = '';
          hoveredEl.style.outlineOffset = '';
        }
        hoveredEl = el;
        hoveredEl.style.outline = '2px dashed rgba(99, 102, 241, 0.75)';
        hoveredEl.style.outlineOffset = '2px';
      }
    }, true);

    document.addEventListener('mouseout', function(e) {
      if (hoveredEl && !isEditingText) {
        hoveredEl.style.outline = '';
        hoveredEl.style.outlineOffset = '';
        hoveredEl = null;
      }
    }, true);

    // Prevent any form submits while in design/select/mark modes
    document.addEventListener('submit', function(e) {
      if (odMode === 'select' || odMode === 'mark') {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);

    // Double-click inline text editing (WYSIWYG Direct Edit)
    document.addEventListener('dblclick', function(e) {
      if (odMode !== 'select') return;
      const target = e.target;
      if (!(target instanceof Element)) return;
      const el = target.closest('[data-od-uid]');
      if (!el) return;

      e.preventDefault();
      e.stopPropagation();

      isEditingText = true;
      if (hoveredEl && hoveredEl !== el) {
        hoveredEl.style.outline = '';
        hoveredEl.style.outlineOffset = '';
        hoveredEl = null;
      }

      el.contentEditable = 'true';
      el.focus();
      el.style.outline = '2px solid #6366f1';
      el.style.outlineOffset = '2px';
      el.style.cursor = 'text';

      let done = false;
      function finishEdit() {
        if (done) return;
        done = true;
        isEditingText = false;
        justFinishedEditTime = Date.now();

        el.contentEditable = 'false';
        el.style.outline = '';
        el.style.outlineOffset = '';
        el.style.cursor = '';
        el.removeEventListener('blur', onBlur);
        el.removeEventListener('keydown', onKeyDown);

        const newText = (el.textContent || '').trim();
        const elementUid = el.getAttribute('data-od-uid');
        if (!elementUid) return;

        // Langsung simpan patch ke odPatches memori lokal iframe agar persist saat ada re-apply
        const patch = {
          id: 'patch_' + Date.now(),
          elementUid: elementUid,
          patchType: PATCH_TYPE_TEXT_CONTENT,
          value: newText
        };
        odPatches = (odPatches || []).filter(function(p) {
          return !(p.elementUid === elementUid && p.patchType === PATCH_TYPE_TEXT_CONTENT);
        });
        odPatches.push(patch);

        const rect = el.getBoundingClientRect();
        const bounds = normalizeRect(rect);

        postToParent({
          type: 'OD_UPDATE_TEXT',
          elementUid,
          newText,
          bounds
        });
      }

      function onBlur() {
        finishEdit();
      }

      function onKeyDown(ke) {
        if (ke.key === 'Enter' && !ke.shiftKey) {
          ke.preventDefault();
          ke.stopPropagation();
          finishEdit();
        } else if (ke.key === 'Escape') {
          ke.preventDefault();
          ke.stopPropagation();
          done = true;
          isEditingText = false;
          justFinishedEditTime = Date.now();
          el.contentEditable = 'false';
          el.style.outline = '';
          el.style.outlineOffset = '';
          el.style.cursor = '';
          el.removeEventListener('blur', onBlur);
          el.removeEventListener('keydown', onKeyDown);
        }
      }

      el.addEventListener('blur', onBlur);
      el.addEventListener('keydown', onKeyDown);
    }, true);

    // Select by element click
    document.addEventListener('click', function(e) {
      if (odMode !== 'select') return;

      // Dalam mode select, selalu tahan default behavior (jangan redirect link atau submit form)
      e.preventDefault();
      e.stopPropagation();

      // Jika baru saja selesai edit teks dalam 350ms terakhir, abaikan click lanjutan ini
      if (Date.now() - justFinishedEditTime < 350) {
        return;
      }

      try {
        const target = e.target;
        if (!(target instanceof Element)) return;
        const el = target.closest('[data-od-uid]');
        
        // Klik di area kanvas kosong / non-elemen: tahan aksi tombol prototipe tapi JANGAN tutup popover
        if (!el) {
          return;
        }

        const elementUid = el.getAttribute('data-od-uid');
        const rect = el.getBoundingClientRect();
        const bounds = normalizeRect(rect);
        const cs = window.getComputedStyle(el);
        const currentText = (el.textContent || '').trim().slice(0, 2000);
        const currentColor = (cs && cs.color) ? cs.color : '';
        const currentBg = (cs && cs.backgroundColor) ? cs.backgroundColor : '';
        const tagName = el.tagName.toLowerCase();

        postToParent({
          type: 'OD_SELECT_ELEMENT',
          elementUid,
          tagName,
          bounds,
          currentText,
          currentColor,
          currentBg
        });
      } catch (err) {}
    }, true);

    // Mark by dragging area (MVP: kirim final saat mouse up)
    let dragging = false;
    let dragStart = null;
    let dragEnd = null;

    function getDragRect() {
      if (!dragStart || !dragEnd) return null;
      const x1 = Math.min(dragStart.x, dragEnd.x);
      const y1 = Math.min(dragStart.y, dragEnd.y);
      const x2 = Math.max(dragStart.x, dragEnd.x);
      const y2 = Math.max(dragStart.y, dragEnd.y);
      return { left: x1, top: y1, width: x2 - x1, height: y2 - y1 };
    }

    function beginDrag(e) {
      if (odMode !== 'mark') return;
      if (!(e instanceof MouseEvent)) return;
      if (e.button !== 0) return;
      dragging = true;
      dragStart = { x: e.clientX, y: e.clientY };
      dragEnd = { x: e.clientX, y: e.clientY };
      try {
        e.preventDefault();
        e.stopPropagation();
      } catch (err) {}
    }

    function updateDrag(e) {
      if (!dragging || odMode !== 'mark') return;
      if (!(e instanceof MouseEvent)) return;
      dragEnd = { x: e.clientX, y: e.clientY };
      try {
        e.preventDefault();
        e.stopPropagation();
      } catch (err) {}
    }

    function endDrag(e) {
      if (!dragging || odMode !== 'mark') return;
      if (!(e instanceof MouseEvent)) return;
      dragging = false;
      dragEnd = { x: e.clientX, y: e.clientY };
      try {
        e.preventDefault();
        e.stopPropagation();
      } catch (err) {}

      const r = getDragRect();
      if (!r || r.width < 6 || r.height < 6) return;
      const bounds = normalizeRect(r);
      postToParent({
        type: 'OD_AREA_MARK',
        bounds
      });

      dragStart = null;
      dragEnd = null;
    }

    document.addEventListener('mousedown', beginDrag, true);
    window.addEventListener('mousemove', updateDrag, { passive: false });
    window.addEventListener('mouseup', endDrag, true);

    // Receive messages from parent
    window.addEventListener('message', function(ev) {
      const msg = ev && ev.data;
      if (!msg || msg.source !== SOURCE) return;
      if (msg.type === 'OD_MODE') {
        setMode(msg.mode);
      } else if (msg.type === 'OD_SET_PATCHES') {
        odPatches = Array.isArray(msg.patches) ? msg.patches : [];
        applyAllPatches();
      } else if (msg.type === 'OD_APPLY_PATCH') {
        const patch = msg.patch;
        odPatches = Array.isArray(odPatches) ? odPatches : [];
        odPatches.push(patch);
        applyOnePatch(patch);
      } else if (msg.type === 'OD_START_INLINE_EDIT') {
        const el = document.querySelector('[data-od-uid="' + msg.elementUid + '"]');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
        }
      }
    });

    // Init
    assignElementUids();
    applyAllPatches();
    postToParent({ type: 'OD_READY' });
  })();
  </script>
  `;

  const baseHeaders = `
  <!-- Google Fonts: Plus Jakarta Sans -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <!-- Lucide Icons (Pure DOM SVG Parser) -->
  <script src="https://unpkg.com/lucide@latest"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: #f8fafc;
      color: #0f172a;
      min-height: 100vh;
      padding: 24px;
    }
    ${css}
  </style>
  `;

  if (isFullDoc) {
    let cleanDoc = html;

    // Bersihkan script Tailwind CDN Play jika ada agar tidak memicu SecurityError
    cleanDoc = cleanDoc.replace(/<script[^>]*cdn\.tailwindcss\.com[^>]*><\/script>/gi, '');

    // Masukkan Google Fonts dan Base Resets ke dalam <head> jika belum ada
    if (!cleanDoc.includes('Plus+Jakarta+Sans')) {
      if (cleanDoc.includes('<head>')) {
        cleanDoc = cleanDoc.replace('<head>', `<head>${baseHeaders}`);
      } else if (cleanDoc.includes('<html>')) {
        cleanDoc = cleanDoc.replace('<html>', `<html><head>${baseHeaders}</head>`);
      } else {
        cleanDoc = `<head>${baseHeaders}</head>` + cleanDoc;
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

    // Append bridge script
    if (cleanDoc.includes('</body>')) {
      cleanDoc = cleanDoc.replace('</body>', odBridgeScript + '</body>');
    } else {
      cleanDoc += odBridgeScript;
    }
    return cleanDoc;
  }

  // Jika berupa fragmen komponen HTML
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${baseHeaders}
</head>
<body>
  ${html}
  ${js ? `<script>\ntry {\n${js}\n} catch(e) { console.error("JS Error:", e); }\n</script>` : ''}
  ${odBridgeScript}
</body>
</html>`;
}
