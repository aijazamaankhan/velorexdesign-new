/* Admin: image cropper with auto-crop. Modelled on velorexmusic.com's
   src/js/admin/image-cropper.js.

   Sits between "admin picked files" and the upload: each file opens in the
   cropper, the admin frames it (or lets auto-crop do it), and only the framed
   image is uploaded. Cropping in the browser means no full-size original is
   ever written to the server, and uploads are smaller.

   STATE MODEL: the crop rectangle is kept in NATURAL image pixels, never in
   screen pixels. Screen positions are derived on every render from the
   letterbox transform in layout(), so resizing the window or rotating a phone
   cannot move the crop. Pointer deltas are divided by the scale on the way in.

   Output: WebP (JPEG if the browser cannot encode WebP), longest side at most
   1600 px. upload-image.php accepts both. */

const ImageCropper = (function () {
    'use strict';

    const MIN_NATURAL = 32;
    const MAX_SIDE = 1600;
    const RATIOS = [
        { label: 'Square', value: 1, hint: 'Product pages and cards' },
        { label: '4:5', value: 0.8, hint: 'Portrait' },
        { label: '4:3', value: 4 / 3, hint: 'Landscape' },
        { label: '16:9', value: 16 / 9, hint: 'Banner' },
        { label: 'Free', value: 0, hint: 'Any shape' }
    ];

    let els = null;
    let settle = null;
    let natural = { w: 0, h: 0 };
    let crop = { x: 0, y: 0, w: 0, h: 0 };
    let ratio = 1;
    let drag = null;
    let source = null;      // HTMLImageElement or canvas currently shown
    let fileName = '';
    let autoAll = false;

    const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

    function build() {
        if (els) return els;
        const m = document.createElement('div');
        m.className = 'crop-modal';
        m.id = 'cropModal';
        m.setAttribute('role', 'dialog');
        m.setAttribute('aria-modal', 'true');
        m.setAttribute('aria-labelledby', 'cropTitle');
        m.innerHTML = `
            <div class="crop-dialog">
                <div class="crop-head">
                    <div><h3 id="cropTitle">Crop image</h3><span class="crop-file" id="cropFile"></span></div>
                    <span class="crop-count" id="cropCount"></span>
                    <button type="button" class="crop-x" id="cropClose" aria-label="Skip this image">&times;</button>
                </div>
                <div class="crop-tools">
                    <div class="crop-ratios" id="cropRatios" role="group" aria-label="Shape">
                        ${RATIOS.map((r, i) => `<button type="button" class="crop-chip${i === 0 ? ' is-active' : ''}" data-ratio="${r.value}" title="${r.hint}">${r.label}</button>`).join('')}
                    </div>
                    <div class="crop-actions-mini">
                        <button type="button" class="crop-chip" id="cropAuto" title="Find the product and frame it"><i class="fas fa-wand-magic-sparkles"></i> Auto-crop</button>
                        <button type="button" class="crop-chip" id="cropRotL" title="Rotate left"><i class="fas fa-rotate-left"></i></button>
                        <button type="button" class="crop-chip" id="cropRotR" title="Rotate right"><i class="fas fa-rotate-right"></i></button>
                        <button type="button" class="crop-chip" id="cropReset" title="Reset"><i class="fas fa-expand"></i></button>
                    </div>
                </div>
                <div class="crop-stage" id="cropStage">
                    <img id="cropImg" alt="" draggable="false">
                    <div class="crop-box" id="cropBox" tabindex="0" aria-label="Crop area. Arrow keys move it.">
                        <span class="crop-grid"></span>
                        <span class="crop-h" data-h="nw"></span><span class="crop-h" data-h="ne"></span>
                        <span class="crop-h" data-h="sw"></span><span class="crop-h" data-h="se"></span>
                    </div>
                </div>
                <div class="crop-foot">
                    <span class="crop-readout" id="cropReadout"></span>
                    <div class="crop-buttons">
                        <button type="button" class="btn btn-secondary" id="cropSkip">Skip image</button>
                        <button type="button" class="btn btn-secondary" id="cropOriginal">Use original</button>
                        <button type="button" class="btn btn-secondary" id="cropAutoAll" hidden>Auto-crop all</button>
                        <button type="button" class="btn btn-primary" id="cropApply"><i class="fas fa-crop-simple"></i> Crop &amp; use</button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(m);
        const $ = id => document.getElementById(id);
        els = { modal: m, stage: $('cropStage'), img: $('cropImg'), box: $('cropBox'), ratios: $('cropRatios'),
            file: $('cropFile'), count: $('cropCount'), readout: $('cropReadout'), autoAllBtn: $('cropAutoAll') };
        wire($);
        return els;
    }

    /* Letterbox transform: the image is object-fit:contain inside the stage. */
    function layout() {
        const r = els.stage.getBoundingClientRect();
        const scale = Math.min(r.width / natural.w, r.height / natural.h);
        const dw = natural.w * scale, dh = natural.h * scale;
        return { scale, ox: (r.width - dw) / 2, oy: (r.height - dh) / 2 };
    }

    function render() {
        if (!natural.w) return;
        const L = layout();
        const b = els.box.style;
        b.left = (L.ox + crop.x * L.scale) + 'px';
        b.top = (L.oy + crop.y * L.scale) + 'px';
        b.width = (crop.w * L.scale) + 'px';
        b.height = (crop.h * L.scale) + 'px';
        const out = outSize();
        els.readout.textContent = `${Math.round(crop.w)} × ${Math.round(crop.h)} px → saved at ${out.w} × ${out.h}`;
    }

    function outSize() {
        const k = Math.min(1, MAX_SIDE / Math.max(crop.w, crop.h));
        return { w: Math.round(crop.w * k), h: Math.round(crop.h * k) };
    }

    function fitRatio(w, h, cx, cy) {
        if (ratio > 0) {
            if (w / h > ratio) h = w / ratio; else w = h * ratio;
            if (w > natural.w) { w = natural.w; h = w / ratio; }
            if (h > natural.h) { h = natural.h; w = h * ratio; }
        }
        w = clamp(w, MIN_NATURAL, natural.w);
        h = clamp(h, MIN_NATURAL, natural.h);
        return { x: clamp(cx - w / 2, 0, natural.w - w), y: clamp(cy - h / 2, 0, natural.h - h), w, h };
    }

    function resetCrop() {
        let w = natural.w, h = natural.h;
        if (ratio > 0) { w = Math.min(natural.w, natural.h * ratio); h = w / ratio; }
        crop = fitRatio(w, h, natural.w / 2, natural.h / 2);
        render();
    }

    /* Auto-crop: estimate the background from the four corners on a small copy,
       find rows/columns that differ from it, then fit the chosen shape around
       that content with a little breathing room. Falls back to the centre. */
    function contentBounds() {
        try {
            const S = 160;
            const k = Math.min(1, S / Math.max(natural.w, natural.h));
            const w = Math.max(1, Math.round(natural.w * k)), h = Math.max(1, Math.round(natural.h * k));
            const c = document.createElement('canvas');
            c.width = w; c.height = h;
            const g = c.getContext('2d', { willReadFrequently: true });
            g.drawImage(source, 0, 0, w, h);
            const d = g.getImageData(0, 0, w, h).data;
            const px = (x, y) => { const i = (y * w + x) * 4; return [d[i], d[i + 1], d[i + 2], d[i + 3]]; };
            const corners = [px(0, 0), px(w - 1, 0), px(0, h - 1), px(w - 1, h - 1)];
            const bg = [0, 1, 2, 3].map(k2 => corners.reduce((s, p) => s + p[k2], 0) / 4);
            const differs = (x, y) => {
                const p = px(x, y);
                if (bg[3] < 40) return p[3] > 40; // transparent background
                return Math.abs(p[0] - bg[0]) + Math.abs(p[1] - bg[1]) + Math.abs(p[2] - bg[2]) > 48;
            };
            const rowHas = y => { let n = 0; for (let x = 0; x < w; x++) if (differs(x, y)) n++; return n > w * 0.015; };
            const colHas = x => { let n = 0; for (let y = 0; y < h; y++) if (differs(x, y)) n++; return n > h * 0.015; };
            let top = 0, bottom = h - 1, left = 0, right = w - 1;
            while (top < bottom && !rowHas(top)) top++;
            while (bottom > top && !rowHas(bottom)) bottom--;
            while (left < right && !colHas(left)) left++;
            while (right > left && !colHas(right)) right--;
            if (right - left < w * 0.08 || bottom - top < h * 0.08) return null;
            const inv = 1 / k;
            return { x: left * inv, y: top * inv, w: (right - left + 1) * inv, h: (bottom - top + 1) * inv };
        } catch (_) {
            return null;
        }
    }

    function autoCrop() {
        const b = contentBounds();
        if (!b) { resetCrop(); return; }
        const pad = 0.08;
        const w = b.w * (1 + pad * 2), h = b.h * (1 + pad * 2);
        crop = fitRatio(w, h, b.x + b.w / 2, b.y + b.h / 2);
        render();
    }

    function setRatio(v) {
        ratio = v;
        if (ratio > 0) {
            const cx = crop.x + crop.w / 2, cy = crop.y + crop.h / 2;
            let w = crop.w, h = crop.h;
            if (w / h > ratio) w = h * ratio; else h = w / ratio;
            crop = fitRatio(w, h, cx, cy);
        }
        render();
    }

    function rotate(dir) {
        const c = document.createElement('canvas');
        c.width = natural.h; c.height = natural.w;
        const g = c.getContext('2d');
        g.translate(c.width / 2, c.height / 2);
        g.rotate(dir * Math.PI / 2);
        g.drawImage(source, -natural.w / 2, -natural.h / 2);
        source = c;
        natural = { w: c.width, h: c.height };
        els.img.src = c.toDataURL('image/png');
        els.img.onload = () => { els.img.onload = null; autoCrop(); };
    }

    /* Pointer: drag the box to move it, drag a corner to resize. */
    function onDown(e) {
        const handle = e.target.dataset && e.target.dataset.h;
        if (!handle && !els.box.contains(e.target)) return;
        e.preventDefault();
        els.box.setPointerCapture(e.pointerId);
        drag = { handle: handle || 'move', sx: e.clientX, sy: e.clientY, start: { ...crop } };
    }
    function onMove(e) {
        if (!drag) return;
        const s = layout().scale;
        const dx = (e.clientX - drag.sx) / s, dy = (e.clientY - drag.sy) / s;
        const o = drag.start;
        if (drag.handle === 'move') {
            crop = { ...o, x: clamp(o.x + dx, 0, natural.w - o.w), y: clamp(o.y + dy, 0, natural.h - o.h) };
        } else {
            const east = drag.handle.includes('e'), south = drag.handle.includes('s');
            const ax = east ? o.x : o.x + o.w;          // fixed corner
            const ay = south ? o.y : o.y + o.h;
            let w = Math.abs((east ? o.x + o.w + dx : o.x + dx) - ax);
            let h = Math.abs((south ? o.y + o.h + dy : o.y + dy) - ay);
            const maxW = east ? natural.w - ax : ax, maxH = south ? natural.h - ay : ay;
            if (ratio > 0) {
                let drv = Math.max(w, h * ratio);
                drv = clamp(drv, MIN_NATURAL, Math.min(maxW, maxH * ratio));
                w = drv; h = drv / ratio;
            } else {
                w = clamp(w, MIN_NATURAL, maxW); h = clamp(h, MIN_NATURAL, maxH);
            }
            crop = { x: east ? ax : ax - w, y: south ? ay : ay - h, w, h };
        }
        render();
    }
    function onUp() { drag = null; }

    function canvasBlob(canvas) {
        return new Promise(resolve => canvas.toBlob(b => {
            if (b && b.type === 'image/webp') return resolve(b);
            canvas.toBlob(j => resolve(j), 'image/jpeg', 0.88);
        }, 'image/webp', 0.86));
    }

    async function encode(full) {
        const r = full ? { x: 0, y: 0, w: natural.w, h: natural.h } : crop;
        const k = Math.min(1, MAX_SIDE / Math.max(r.w, r.h));
        const c = document.createElement('canvas');
        c.width = Math.round(r.w * k); c.height = Math.round(r.h * k);
        const g = c.getContext('2d');
        g.imageSmoothingQuality = 'high';
        g.drawImage(source, r.x, r.y, r.w, r.h, 0, 0, c.width, c.height);
        const blob = await canvasBlob(c);
        const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
        const base = (fileName || 'image').replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '-').slice(0, 60) || 'image';
        return new File([blob], `${base}.${ext}`, { type: blob.type });
    }

    function finish(result) {
        els.modal.classList.remove('is-open');
        document.removeEventListener('keydown', onKey);
        const s = settle; settle = null;
        if (s) s(result);
    }

    function onKey(e) {
        if (!settle) return;
        if (e.key === 'Escape') { e.preventDefault(); finish({ skip: true }); }
        else if (e.key === 'Enter' && document.activeElement && document.activeElement.tagName !== 'BUTTON') {
            e.preventDefault(); document.getElementById('cropApply').click();
        } else if (e.key.startsWith('Arrow') && document.activeElement === els.box) {
            e.preventDefault();
            const step = e.shiftKey ? 20 : 4;
            const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
            const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
            crop.x = clamp(crop.x + dx, 0, natural.w - crop.w);
            crop.y = clamp(crop.y + dy, 0, natural.h - crop.h);
            render();
        }
    }

    function wire($) {
        els.box.addEventListener('pointerdown', onDown);
        els.box.addEventListener('pointermove', onMove);
        els.box.addEventListener('pointerup', onUp);
        els.box.addEventListener('pointercancel', onUp);
        els.ratios.addEventListener('click', e => {
            const b = e.target.closest('.crop-chip');
            if (!b) return;
            els.ratios.querySelectorAll('.crop-chip').forEach(x => x.classList.toggle('is-active', x === b));
            setRatio(parseFloat(b.dataset.ratio) || 0);
        });
        $('cropAuto').addEventListener('click', autoCrop);
        $('cropReset').addEventListener('click', resetCrop);
        $('cropRotL').addEventListener('click', () => rotate(-1));
        $('cropRotR').addEventListener('click', () => rotate(1));
        $('cropApply').addEventListener('click', async () => finish({ file: await encode(false) }));
        $('cropOriginal').addEventListener('click', async () => finish({ file: await encode(true) }));
        $('cropSkip').addEventListener('click', () => finish({ skip: true }));
        $('cropClose').addEventListener('click', () => finish({ skip: true }));
        els.autoAllBtn.addEventListener('click', async () => { autoAll = true; finish({ file: await encode(false) }); });
        window.addEventListener('resize', () => { if (settle) render(); });
    }

    function loadImage(file) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => resolve({ img, url });
            img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read ' + file.name)); };
            img.src = url;
        });
    }

    /** Opens one file. Resolves to { file } (cropped) or { skip: true }. */
    async function open(file, index, total) {
        build();
        const { img, url } = await loadImage(file);
        source = img;
        natural = { w: img.naturalWidth, h: img.naturalHeight };
        fileName = file.name;
        els.file.textContent = file.name;
        els.count.textContent = total > 1 ? `${index + 1} of ${total}` : '';
        els.autoAllBtn.hidden = !(total > 1 && index < total - 1);
        els.img.src = url;
        els.modal.classList.add('is-open');
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        autoCrop(); // start from the auto frame; the admin adjusts if needed
        els.box.focus({ preventScroll: true });
        document.addEventListener('keydown', onKey);
        const result = await new Promise(resolve => { settle = resolve; });
        URL.revokeObjectURL(url);
        return result;
    }

    /** Auto-crop without showing the dialog (used by "Auto-crop all"). */
    async function silent(file) {
        build();
        const { img, url } = await loadImage(file);
        source = img;
        natural = { w: img.naturalWidth, h: img.naturalHeight };
        fileName = file.name;
        autoCrop();
        const out = await encode(false);
        URL.revokeObjectURL(url);
        return out;
    }

    /** Runs a batch; returns the files to upload (skipped ones left out). */
    async function runBatch(files) {
        autoAll = false;
        const out = [];
        for (let i = 0; i < files.length; i++) {
            const f = files[i];
            if (f.type === 'image/svg+xml') { out.push(f); continue; }
            try {
                if (autoAll) { out.push(await silent(f)); continue; }
                const r = await open(f, i, files.length);
                if (r && r.file) out.push(r.file);
            } catch (err) {
                showToast(err.message || 'Could not open image', 'error');
            }
        }
        return out;
    }

    return { runBatch };
})();
