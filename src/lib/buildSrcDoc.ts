import { cleanConversationalLeaks } from './cleanLeaks';
import { OD_UID_SELECTOR, assignOdUidsToHtml } from './odUid';

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
    const ALLOWED_SELECTOR = ${JSON.stringify(OD_UID_SELECTOR)};
    const PATCH_TYPE_TEXT_COLOR = 'textColor';
    const PATCH_TYPE_TEXT_CONTENT = 'textContent';
    const PATCH_TYPE_BG_COLOR = 'bgColor';
    const PATCH_TYPE_FONT_SIZE = 'fontSize';
    const PATCH_TYPE_FONT_WEIGHT = 'fontWeight';
    const PATCH_TYPE_TEXT_ALIGN = 'textAlign';
    const PATCH_TYPE_BORDER_RADIUS = 'borderRadius';
    const PATCH_TYPE_REMOVE = 'remove';

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
      const existingUids = new Set();
      document.querySelectorAll('[data-od-uid]').forEach(function(el) {
        const uid = el.getAttribute('data-od-uid');
        if (uid) existingUids.add(uid);
      });
      let counter = 0;
      const els = Array.from(document.querySelectorAll(ALLOWED_SELECTOR));
      els.forEach(function(el) {
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
      } else if (patch.patchType === PATCH_TYPE_FONT_SIZE) {
        el.style.fontSize = String(patch.value ?? '');
      } else if (patch.patchType === PATCH_TYPE_FONT_WEIGHT) {
        el.style.fontWeight = String(patch.value ?? '');
      } else if (patch.patchType === PATCH_TYPE_TEXT_ALIGN) {
        el.style.textAlign = String(patch.value ?? '');
      } else if (patch.patchType === PATCH_TYPE_BORDER_RADIUS) {
        el.style.borderRadius = String(patch.value ?? '');
      } else if (patch.patchType === PATCH_TYPE_REMOVE) {
        el.remove();
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

      // Elemen form (select/input/textarea) tidak boleh diedit sebagai teks HTML
      const tag = (el.tagName || '').toLowerCase();
      if (tag === 'select' || tag === 'input' || tag === 'textarea' || tag === 'option') return;

      e.preventDefault();
      e.stopPropagation();

      isEditingText = true;
      const initialText = el.textContent || '';
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
          el.textContent = initialText; // Kembalikan ke teks awal saat dibatalkan
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
        const currentFontSize = (cs && cs.fontSize) ? cs.fontSize : '';
        const currentFontWeight = (cs && cs.fontWeight) ? cs.fontWeight : '';
        const currentTextAlign = (cs && cs.textAlign) ? cs.textAlign : '';
        const currentBorderRadius = (cs && cs.borderRadius) ? cs.borderRadius : '';
        const tagName = el.tagName.toLowerCase();

        const outerHtml = (el.outerHTML || '').slice(0, 20000);
        const breadcrumbs = [];
        let curr = el;
        while (curr && curr !== document.body && curr !== document.documentElement && breadcrumbs.length < 3) {
          const tName = curr.tagName.toLowerCase();
          const cName = curr.className && typeof curr.className === 'string' ? '.' + curr.className.trim().split(/\s+/)[0] : '';
          breadcrumbs.unshift(tName + cName);
          curr = curr.parentElement;
        }

        postToParent({
          type: 'OD_SELECT_ELEMENT',
          elementUid,
          tagName,
          bounds,
          currentText,
          currentColor,
          currentBg,
          currentFontSize,
          currentFontWeight,
          currentTextAlign,
          currentBorderRadius,
          outerHtml,
          breadcrumbs
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
      } else if (msg.type === 'OD_REMOVE_ELEMENT') {
        const el = document.querySelector('[data-od-uid="' + msg.elementUid + '"]');
        if (el) el.remove();
      } else if (msg.type === 'OD_REPLACE_ELEMENT') {
        const { elementUid, newElementHtml } = msg;
        const target = document.querySelector('[data-od-uid="' + elementUid + '"]');
        if (target && newElementHtml) {
          const temp = document.createElement('div');
          temp.innerHTML = newElementHtml;
          const newEl = temp.firstElementChild;
          if (newEl) {
            newEl.setAttribute('data-od-uid', elementUid);
            target.replaceWith(newEl);
            if (typeof window.lucide !== 'undefined' && window.lucide.createIcons) {
              try { window.lucide.createIcons(); } catch(e) {}
            }
          }
        }
      } else if (msg.type === 'OD_INSERT_ICON') {
        const { elementUid, iconName } = msg;
        const target = document.querySelector('[data-od-uid="' + elementUid + '"]');
        if (target && iconName) {
          const existingIcon = target.querySelector('i[data-lucide], svg.lucide, svg[data-lucide]');
          const newI = document.createElement('i');
          newI.setAttribute('data-lucide', String(iconName).toLowerCase().trim());
          newI.style.width = '16px';
          newI.style.height = '16px';
          newI.style.display = 'inline-block';
          newI.style.verticalAlign = 'middle';
          newI.style.marginRight = '6px';
          if (existingIcon) {
            existingIcon.replaceWith(newI);
          } else {
            target.insertBefore(newI, target.firstChild);
          }
          if (typeof window.lucide !== 'undefined' && window.lucide.createIcons) {
            try { window.lucide.createIcons(); } catch(e) {}
          }
        }
      } else if (msg.type === 'OD_INSERT_IMAGE') {
        const { elementUid, imageUrl, styleType } = msg;
        const target = document.querySelector('[data-od-uid="' + elementUid + '"]');
        if (target && imageUrl) {
          if (target.tagName && target.tagName.toLowerCase() === 'img') {
            target.src = imageUrl;
          } else {
            const existingImg = target.querySelector('img');
            if (existingImg) {
              existingImg.src = imageUrl;
            } else {
              const newImg = document.createElement('img');
              newImg.src = imageUrl;
              newImg.alt = 'Gambar';
              if (styleType === 'avatar') {
                newImg.style.width = '36px';
                newImg.style.height = '36px';
                newImg.style.borderRadius = '9999px';
                newImg.style.objectFit = 'cover';
                newImg.style.display = 'inline-block';
                newImg.style.verticalAlign = 'middle';
                newImg.style.marginRight = '8px';
              } else if (styleType === 'banner') {
                newImg.style.width = '100%';
                newImg.style.height = '180px';
                newImg.style.objectFit = 'cover';
                newImg.style.borderRadius = '8px';
                newImg.style.marginBottom = '12px';
                newImg.style.display = 'block';
              } else {
                newImg.style.width = '48px';
                newImg.style.height = '48px';
                newImg.style.borderRadius = '8px';
                newImg.style.objectFit = 'cover';
                newImg.style.display = 'inline-block';
                newImg.style.verticalAlign = 'middle';
                newImg.style.marginRight = '8px';
              }
              target.insertBefore(newImg, target.firstChild);
            }
          }
        }
      } else if (msg.type === 'OD_RESOLVE_AREA') {
        const { markId, bounds } = msg;
        if (!bounds) return;

        assignElementUids();

        const winW = window.innerWidth || document.documentElement.clientWidth || 1;
        const winH = window.innerHeight || document.documentElement.clientHeight || 1;
        const boxLeft = bounds.x * winW;
        const boxTop = bounds.y * winH;
        const boxRight = (bounds.x + bounds.w) * winW;
        const boxBottom = (bounds.y + bounds.h) * winH;
        const boxW = Math.max(1, bounds.w * winW);
        const boxH = Math.max(1, bounds.h * winH);
        const boxArea = boxW * boxH;

        const allEls = Array.from(document.querySelectorAll('[data-od-uid]'));
        let bestEl = null;
        let bestScore = -1;

        for (let i = 0; i < allEls.length; i++) {
          const el = allEls[i];
          if (el === document.body || el === document.documentElement) continue;
          const tName = (el.tagName || '').toUpperCase();
          if (tName === 'BODY' || tName === 'HTML' || tName === 'SCRIPT' || tName === 'STYLE') continue;

          const r = el.getBoundingClientRect();
          if (r.width <= 4 || r.height <= 4) continue;

          const interW = Math.max(0, Math.min(boxRight, r.right) - Math.max(boxLeft, r.left));
          const interH = Math.max(0, Math.min(boxBottom, r.bottom) - Math.max(boxTop, r.top));
          const interArea = interW * interH;
          if (interArea <= 0) continue;

          const elArea = r.width * r.height;
          const coverageOfEl = interArea / elArea;
          const coverageOfBox = interArea / boxArea;

          let score = 0;
          if (coverageOfEl >= 0.7) {
            // Sebagian besar elemen berada di dalam kotak seleksi
            score = coverageOfBox * 12 + coverageOfEl * 6;
          } else if (coverageOfBox >= 0.7) {
            // Elemen melingkupi sebagian besar kotak seleksi
            score = coverageOfBox * 8 + coverageOfEl * 4;
          } else {
            // Irisan proporsional (IoU)
            score = (interArea / (elArea + boxArea - interArea)) * 10;
          }

          if (elArea > boxArea * 5) {
            score *= 0.2;
          }

          const outerLen = el.outerHTML ? el.outerHTML.length : 0;
          if (outerLen > 15000) {
            score *= 0.1;
          }

          if (score > bestScore) {
            bestScore = score;
            bestEl = el;
          }
        }

        if (bestEl) {
          const elementUid = bestEl.getAttribute('data-od-uid');
          const tagName = bestEl.tagName.toLowerCase();
          const outerHtml = (bestEl.outerHTML || '').slice(0, 15000);
          const currentText = (bestEl.textContent || '').trim().slice(0, 2000);
          const breadcrumbs = [];
          let curr = bestEl;
          while (curr && curr !== document.body && curr !== document.documentElement && breadcrumbs.length < 3) {
            const tn = curr.tagName.toLowerCase();
            const cn = curr.className && typeof curr.className === 'string' ? '.' + curr.className.trim().split(/\s+/)[0] : '';
            breadcrumbs.unshift(tn + cn);
            curr = curr.parentElement;
          }

          postToParent({
            type: 'OD_AREA_RESOLVED',
            markId: markId,
            elementUid: elementUid,
            tagName: tagName,
            outerHtml: outerHtml,
            currentText: currentText,
            breadcrumbs: breadcrumbs
          });
        }
      }
    });

    // Polyfill window.confirm agar tidak diblokir oleh sandbox iframe
    try {
      const _origConfirm = window.confirm;
      window.confirm = function(msg) {
        try {
          if (_origConfirm) return _origConfirm.call(window, msg);
        } catch (e) {}
        return true;
      };
    } catch (e) {}

    // Fallback pengaman untuk modal konfirmasi hapus
    if (typeof window.bukaModalHapus !== 'function') {
      window.bukaModalHapus = function(id) {
        const input = document.getElementById('hapusId');
        if (input) input.value = String(id);
        const modal = document.getElementById('modalHapus');
        if (modal) {
          modal.style.display = 'flex';
        } else if (typeof window.eksekusiHapus === 'function') {
          window.eksekusiHapus(id);
        } else if (typeof window.hapusItem === 'function') {
          window.hapusItem(id);
        } else if (typeof window.hapusData === 'function') {
          window.hapusData(id);
        }
      };
    }

    if (typeof window.tutupModalHapus !== 'function') {
      window.tutupModalHapus = function() {
        const modal = document.getElementById('modalHapus');
        if (modal) modal.style.display = 'none';
      };
    }

    if (typeof window.eksekusiHapus !== 'function') {
      window.eksekusiHapus = function(passedId) {
        const id = passedId || document.getElementById('hapusId')?.value;
        let deleted = false;

        // 1. Coba panggil fungsi hapus spesifik jika ada
        const altFns = ['hapusItem', 'hapusData', 'hapusPesanan', 'hapusOrder', 'hapusProduk', 'deleteItem', 'removeItem', 'hapusPasien', 'hapusAntrian'];
        for (const fn of altFns) {
          if (typeof window[fn] === 'function' && fn !== 'eksekusiHapus') {
            try {
              window[fn](id);
              deleted = true;
              break;
            } catch (e) {}
          }
        }

        // 2. Jika belum terhapus, filter array global yang relevan
        if (!deleted && id) {
          const commonArrays = ['items', 'dataList', 'daftarPesanan', 'daftarProduk', 'orders', 'pesananList', 'pasien', 'antrian', 'members', 'transactions', 'transaksi', 'produk'];
          for (const arrName of commonArrays) {
            try {
              if (Array.isArray(window[arrName])) {
                const beforeLen = window[arrName].length;
                window[arrName] = window[arrName].filter(item => String(item?.id ?? item?.kode ?? item?.no ?? '') !== String(id));
                if (window[arrName].length < beforeLen) deleted = true;
              }
            } catch (e) {}
          }
        }

        // 3. Tutup modal
        const modal = document.getElementById('modalHapus');
        if (modal) modal.style.display = 'none';

        // 4. Re-render tampilan
        if (typeof window.render === 'function') {
          try { window.render(); } catch (e) {}
        } else if (typeof window.renderTable === 'function') {
          try { window.renderTable(); } catch (e) {}
        }

        if (typeof window.showToast === 'function') {
          try { window.showToast('Data berhasil dihapus!', 'success'); } catch (e) {}
        }
      };
    }

    // Init
    assignElementUids();
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
    let cleanDoc = cleanConversationalLeaks(html);

    if (cleanDoc.includes('<!DOCTYPE')) {
      cleanDoc = cleanDoc.slice(cleanDoc.indexOf('<!DOCTYPE')).trim();
    } else if (cleanDoc.includes('<html')) {
      cleanDoc = cleanDoc.slice(cleanDoc.indexOf('<html')).trim();
    }

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

    // Tanam UID deterministik ke HTML sumber sebelum bridge disuntikkan,
    // agar UID runtime sama dengan UID saat patch disimpan ke canvasCode.html.
    cleanDoc = assignOdUidsToHtml(cleanDoc);

    // Append bridge script
    if (cleanDoc.includes('</body>')) {
      cleanDoc = cleanDoc.replace('</body>', odBridgeScript + '</body>');
    } else {
      cleanDoc += odBridgeScript;
    }
    return cleanDoc;
  }

  // Jika berupa fragmen komponen HTML
  const cleanFragment = cleanConversationalLeaks(html);

  let fragmentDoc = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${baseHeaders}
</head>
<body>
  ${cleanFragment}
  ${js ? `<script>\ntry {\n${js}\n} catch(e) { console.error("JS Error:", e); }\n</script>` : ''}
</body>
</html>`;

  fragmentDoc = assignOdUidsToHtml(fragmentDoc);

  if (fragmentDoc.includes('</body>')) {
    return fragmentDoc.replace('</body>', odBridgeScript + '</body>');
  }
  return fragmentDoc + odBridgeScript;
}
