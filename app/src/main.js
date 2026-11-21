// Vice Cover Studio — editor UI (round 2).
// Owns the state, the controls, the live preview canvas and the PNG export.
// Photos are read with FileReader on this machine and never leave it.

import { LAYOUTS, GRADES, CAPTION_COLOURS, layoutPanels, drawCover, exportCover } from './cover.js';

export const EXPORT_SIZES = [
  { label: 'Square 1080 × 1080', w: 1080, h: 1080 },
  { label: 'Portrait 1080 × 1350', w: 1080, h: 1350 },
  { label: 'Wide 1920 × 1080', w: 1920, h: 1080 },
];

const SAMPLES = [
  { name: 'Boulevard', src: 'samples/boulevard.jpg' },
  { name: 'Pier', src: 'samples/pier.jpg' },
];

export function defaultState() {
  return {
    layout: 'hero',
    grade: 'sunset',
    caption: 'Sunset Heist',
    sub: 'Vice City, 2026',
    captionColour: 'white',
    captionSize: 1,
    captionPos: 'bottom',
    grain: true,
    photos: [],
    panels: [
      { photo: 0, zoom: 1, ox: 0, oy: 0 },
      { photo: 1, zoom: 1, ox: 0, oy: 0 },
      { photo: 0, zoom: 1, ox: 0, oy: 0 },
      { photo: 1, zoom: 1, ox: 0, oy: 0 },
    ],
  };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function loadSamples(state) {
  state.photos = await Promise.all(SAMPLES.map((s) => loadImage(s.src)));
  return state;
}

export function readUploadFiles(files, state, onDone) {
  const list = [...files].filter((f) => f.type.startsWith('image/'));
  if (!list.length) return;
  let left = list.length;
  list.forEach((file) => {
    const reader = new FileReader();
    reader.onload = () => {
      loadImage(reader.result).then((img) => {
        state.photos.push(img);
        if (--left === 0) onDone();
      });
    };
    reader.readAsDataURL(file);
  });
}

export function renderPreview(state, canvas) {
  const box = canvas.parentElement.getBoundingClientRect();
  const w = Math.max(320, Math.floor(box.width));
  const h = Math.floor((w * 3) / 4);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  drawCover(canvas.getContext('2d'), state, w, h);
}

export async function downloadExport(state, size) {
  const blob = await exportCover(state, size.w, size.h);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vice-cover-${size.w}x${size.h}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return blob;
}

// Build the whole editor inside #app. Returns { state, render } for tests.
export async function initEditor(root) {
  const state = defaultState();
  await loadSamples(state);

  root.innerHTML = `
  <header class="topbar">
    <div class="brand">VICE <span>COVER</span> STUDIO</div>
    <div class="tag">Your photo → GTA-style poster · offline · photos never leave this machine</div>
  </header>
  <main class="studio">
    <section class="preview-col">
      <canvas id="preview" aria-label="Live cover preview"></canvas>
      <div class="hint">Drag a photo inside its panel to move it · scroll on a panel to zoom</div>
      <div class="exports">
        <span class="exports-label">Export PNG</span>
        ${EXPORT_SIZES.map((s, i) => `<button class="export-btn" data-size="${i}">${s.label}</button>`).join('')}
      </div>
      <p class="status" id="status" role="status">Ready — sample photos loaded.</p>
    </section>
    <aside class="controls">
      <section class="group">
        <h2>Photos</h2>
        <label class="upload">Upload your photos
          <input id="upload" type="file" accept="image/*" multiple hidden>
        </label>
        <div class="thumbs" id="thumbs"></div>
        <p class="note">Tap a photo, then tap a panel below to put it there.</p>
      </section>
      <section class="group">
        <h2>Layout</h2>
        <div class="chips" id="layouts">${Object.entries(LAYOUTS).map(([k, v]) => `<button data-layout="${k}">${v.label}</button>`).join('')}</div>
      </section>
      <section class="group">
        <h2>Colour grade</h2>
        <div class="chips" id="grades">${Object.entries(GRADES).map(([k, v]) => `<button data-grade="${k}">${v.label}</button>`).join('')}</div>
      </section>
      <section class="group">
        <h2>Caption</h2>
        <label>Title <input id="caption" type="text" value="${state.caption}" maxlength="24"></label>
        <label>Sub-caption <input id="sub" type="text" value="${state.sub}" maxlength="40"></label>
        <div class="row">
          <label>Colour
            <select id="captionColour">${Object.entries(CAPTION_COLOURS).map(([k, v]) => `<option value="${k}">${v.label ?? k}</option>`).join('')}</select>
          </label>
          <label>Size
            <input id="captionSize" type="range" min="0.7" max="1.4" step="0.05" value="1">
          </label>
          <label>Place
            <select id="captionPos">
              <option value="bottom">Bottom</option>
              <option value="top">Top</option>
            </select>
          </label>
        </div>
        <label class="check"><input id="grain" type="checkbox" checked> Film grain + vignette</label>
      </section>
      <section class="group">
        <h2>Panels</h2>
        <div id="panels"></div>
      </section>
    </aside>
  </main>`;

  const canvas = root.querySelector('#preview');
  const status = root.querySelector('#status');
  let pickedPhoto = 0;
  let activePanel = 0;

  const render = () => {
    renderPreview(state, canvas);
    renderThumbs();
    renderPanels();
  };

  function renderThumbs() {
    const box = root.querySelector('#thumbs');
    box.innerHTML = state.photos
      .map((img, i) => `<button class="thumb${pickedPhoto === i ? ' picked' : ''}" data-photo="${i}" title="Photo ${i + 1}"><img src="${img.src}" alt="Photo ${i + 1}"></button>`)
      .join('');
  }

  function renderPanels() {
    const count = layoutPanels(state.layout, 100, 100).length;
    const box = root.querySelector('#panels');
    box.innerHTML = Array.from({ length: count }, (_, i) => {
      const p = state.panels[i];
      return `<div class="panel-row${activePanel === i ? ' active' : ''}" data-panel="${i}">
        <button class="panel-name">Panel ${i + 1} · photo ${p.photo + 1}</button>
        <label>Zoom <input type="range" min="1" max="2.5" step="0.05" value="${p.zoom}" data-zoom="${i}"></label>
        <button class="mini" data-centre="${i}">Centre</button>
      </div>`;
    }).join('');
  }

  // --- wiring ---
  root.querySelector('#upload').addEventListener('change', (e) => {
    readUploadFiles(e.target.files, state, () => {
      status.textContent = `${state.photos.length} photos loaded — pick one, then a panel.`;
      render();
    });
  });

  root.querySelector('#thumbs').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-photo]');
    if (!btn) return;
    pickedPhoto = Number(btn.dataset.photo);
    state.panels[activePanel].photo = pickedPhoto;
    render();
  });

  root.querySelector('#panels').addEventListener('click', (e) => {
    const row = e.target.closest('[data-panel]');
    if (row) {
      activePanel = Number(row.dataset.panel);
      if (e.target.dataset.centre !== undefined) {
        const p = state.panels[activePanel];
        p.ox = 0;
        p.oy = 0;
        p.zoom = 1;
      }
      render();
      return;
    }
    const centre = e.target.closest('[data-centre]');
    if (centre) {
      const p = state.panels[Number(centre.dataset.centre)];
      p.ox = 0;
      p.oy = 0;
      p.zoom = 1;
      render();
    }
  });
  root.querySelector('#panels').addEventListener('input', (e) => {
    if (e.target.dataset.zoom !== undefined) {
      state.panels[Number(e.target.dataset.zoom)].zoom = Number(e.target.value);
      renderPreview(state, canvas);
    }
  });

  root.querySelector('#layouts').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-layout]');
    if (!btn) return;
    state.layout = btn.dataset.layout;
    root.querySelectorAll('#layouts button').forEach((b) => b.classList.toggle('active', b === btn));
    render();
  });
  root.querySelector('#grades').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-grade]');
    if (!btn) return;
    state.grade = btn.dataset.grade;
    root.querySelectorAll('#grades button').forEach((b) => b.classList.toggle('active', b === btn));
    render();
  });

  root.querySelector('#caption').addEventListener('input', (e) => {
    state.caption = e.target.value || 'Untitled';
    renderPreview(state, canvas);
  });
  root.querySelector('#sub').addEventListener('input', (e) => {
    state.sub = e.target.value;
    renderPreview(state, canvas);
  });
  root.querySelector('#captionColour').addEventListener('change', (e) => {
    state.captionColour = e.target.value;
    renderPreview(state, canvas);
  });
  root.querySelector('#captionSize').addEventListener('input', (e) => {
    state.captionSize = Number(e.target.value);
    renderPreview(state, canvas);
  });
  root.querySelector('#captionPos').addEventListener('change', (e) => {
    state.captionPos = e.target.value;
    renderPreview(state, canvas);
  });
  root.querySelector('#grain').addEventListener('change', (e) => {
    state.grain = e.target.checked;
    renderPreview(state, canvas);
  });

  root.querySelectorAll('.export-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const size = EXPORT_SIZES[Number(btn.dataset.size)];
      status.textContent = `Exporting ${size.label}…`;
      const blob = await downloadExport(state, size);
      status.textContent = `Exported ${size.label} — ${(blob.size / 1024).toFixed(0)} KB PNG.`;
    });
  });

  // Drag to pan the photo inside its panel; wheel to zoom it.
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    const r = canvas.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * canvas.width;
    const py = ((e.clientY - r.top) / r.height) * canvas.height;
    const panels = layoutPanels(state.layout, canvas.width, canvas.height);
    const i = panels.findIndex(([x, y, w, h]) => px >= x && px <= x + w && py >= y && py <= y + h);
    if (i === -1) return;
    activePanel = i;
    drag = { i, x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
    renderPanels();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const r = canvas.getBoundingClientRect();
    const p = state.panels[drag.i];
    p.ox += (e.clientX - drag.x) / r.width;
    p.oy += (e.clientY - drag.y) / r.height;
    p.ox = Math.max(-0.5, Math.min(0.5, p.ox));
    p.oy = Math.max(-0.5, Math.min(0.5, p.oy));
    drag.x = e.clientX;
    drag.y = e.clientY;
    renderPreview(state, canvas);
  });
  canvas.addEventListener('pointerup', () => {
    drag = null;
    renderPanels();
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const panels = layoutPanels(state.layout, canvas.width, canvas.height);
    const r = canvas.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * canvas.width;
    const py = ((e.clientY - r.top) / r.height) * canvas.height;
    const i = panels.findIndex(([x, y, w, h]) => px >= x && px <= x + w && py >= y && py <= y + h);
    if (i === -1) return;
    const p = state.panels[i];
    p.zoom = Math.max(1, Math.min(2.5, p.zoom - Math.sign(e.deltaY) * 0.1));
    renderPreview(state, canvas);
    renderPanels();
  }, { passive: false });

  // Default active chips.
  root.querySelector('[data-layout="hero"]').classList.add('active');
  root.querySelector('[data-grade="sunset"]').classList.add('active');
  render();
  window.addEventListener('resize', () => renderPreview(state, canvas));
  return { state, render };
}
