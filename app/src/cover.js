// Vice Cover Studio — cover render engine (round 2).
// Draws a multi-panel GTA-style poster cover onto any 2D canvas from a plain
// state object. No network, no fonts to load: lettering is bold system sans
// with a hand-drawn outline and gradient fill. Every panel, grade and caption
// here is drawn in code, so the art is the app's own.

export const LAYOUTS = {
  hero: { label: 'Hero + 2', panels: 3 },
  trio: { label: 'Trio', panels: 3 },
  quad: { label: 'Quad', panels: 4 },
  full: { label: 'Full photo', panels: 1 },
  strip: { label: 'Tilted strip', panels: 3 },
};

export const GRADES = {
  sunset: { label: 'Sunset', top: '#ff9a3d', mid: '#ff5e62', bottom: '#7b2ff7' },
  neon: { label: 'Neon', top: '#ff2fb3', mid: '#7b2ff7', bottom: '#00e5ff' },
  noir: { label: 'Noir', top: '#3a3a3a', mid: '#111111', bottom: '#000000' },
  palms: { label: 'Palms', top: '#ffb347', mid: '#ff6b6b', bottom: '#2b1055' },
  vice: { label: 'Vice', top: '#ff7ad9', mid: '#b967ff', bottom: '#00c2ff' },
};

export const CAPTION_COLOURS = {
  white: '#ffffff',
  gold: '#ffd166',
  pink: '#ff5da2',
  cyan: '#6ff7ff',
};

// Panel rectangles for a layout, as fractions of the cover (x, y, w, h).
export function layoutPanels(layout, W, H) {
  const g = 0.012; // white gutter between panels, as a fraction of width
  const gw = g * W;
  switch (layout) {
    case 'trio':
      return [0, 1, 2].map((i) => [i * (W / 3) + (i ? gw / 2 : 0), 0, W / 3 - (i === 1 ? gw : gw / 2), H]);
    case 'quad':
      return [
        [0, 0, W / 2 - gw / 2, H / 2 - gw / 2],
        [W / 2 + gw / 2, 0, W / 2 - gw / 2, H / 2 - gw / 2],
        [0, H / 2 + gw / 2, W / 2 - gw / 2, H / 2 - gw / 2],
        [W / 2 + gw / 2, H / 2 + gw / 2, W / 2 - gw / 2, H / 2 - gw / 2],
      ];
    case 'full':
      return [[0, 0, W, H]];
    case 'strip': {
      // Three overlapping tilted snapshots on a dark backing.
      const w = W * 0.62;
      const h = H * 0.66;
      return [
        [W * 0.05, H * 0.08, w, h],
        [W * 0.33, H * 0.22, w, h],
        [W * 0.16, H * 0.05, w, h],
      ];
    }
    case 'hero':
    default:
      return [
        [0, 0, W * 0.62 - gw / 2, H],
        [W * 0.62 + gw / 2, 0, W * 0.38 - gw / 2, H / 2 - gw / 2],
        [W * 0.62 + gw / 2, H / 2 + gw / 2, W * 0.38 - gw / 2, H / 2 - gw / 2],
      ];
  }
}

// Draw one photo into a panel rect, cover-fit, with zoom and pan offsets
// (ox, oy in fractions of the panel, -0.5..0.5).
export function drawPanelPhoto(ctx, img, rect, zoom, ox, oy) {
  const [x, y, w, h] = rect;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight) * zoom;
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const dx = x + (w - dw) / 2 + ox * w;
  const dy = y + (h - dh) / 2 + oy * h;
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

// A palm silhouette: curved trunk plus seven drooping fronds.
export function drawPalm(ctx, x, y, s, lean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * lean, s);
  ctx.strokeStyle = '#14081f';
  ctx.fillStyle = '#14081f';
  ctx.lineWidth = 0.09;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(0.12, -0.55, 0.05, -1);
  ctx.stroke();
  for (let i = 0; i < 7; i++) {
    const a = (-Math.PI / 7) * i - Math.PI * 0.05;
    const len = 0.55 + (i % 3) * 0.08;
    ctx.beginPath();
    ctx.moveTo(0.05, -1);
    ctx.quadraticCurveTo(
      0.05 + Math.cos(a) * len * 0.6,
      -1 + Math.sin(a) * len * 0.45 - 0.12,
      0.05 + Math.cos(a) * len,
      -1 + Math.sin(a) * len + 0.28,
    );
    ctx.stroke();
  }
  ctx.restore();
}

// A halftone dot sun, the poster's setting sun. Drawn on an offscreen canvas
// first, so the slits cut through the sun only — never the photo beneath it.
export function drawSun(ctx, cx, cy, r, colour) {
  const off = document.createElement('canvas');
  off.width = Math.ceil(r * 2) + 2;
  off.height = Math.ceil(r * 2) + 2;
  const g = off.getContext('2d');
  g.fillStyle = colour;
  g.beginPath();
  g.arc(off.width / 2, off.height / 2, r, 0, Math.PI * 2);
  g.fill();
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 5; i++) {
    const yy = off.height / 2 + r * 0.15 + i * r * 0.16;
    g.fillRect(0, yy, off.width, r * 0.045 + i * r * 0.008);
  }
  ctx.drawImage(off, cx - off.width / 2, cy - off.height / 2);
}

// Colour grade pass over the whole cover.
export function applyGrade(ctx, grade, W, H) {
  const g = GRADES[grade] ?? GRADES.sunset;
  if (grade === 'noir') {
    ctx.save();
    ctx.globalCompositeOperation = 'saturation';
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    const dark = ctx.createLinearGradient(0, 0, 0, H);
    dark.addColorStop(0, 'rgba(0,0,0,0.05)');
    dark.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = dark;
    ctx.fillRect(0, 0, W, H);
    return;
  }
  const grad = ctx.createLinearGradient(0, 0, W * 0.35, H);
  grad.addColorStop(0, g.top);
  grad.addColorStop(0.55, g.mid);
  grad.addColorStop(1, g.bottom);
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = grade === 'neon' ? 0.55 : 0.42;
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  // Warm wash from the top so the sky always glows.
  const wash = ctx.createLinearGradient(0, 0, 0, H * 0.5);
  wash.addColorStop(0, 'rgba(255,180,90,0.20)');
  wash.addColorStop(1, 'rgba(255,180,90,0)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, W, H * 0.5);
  if (grade === 'palms' || grade === 'sunset') {
    drawSun(ctx, W * 0.78, H * 0.24, Math.min(W, H) * 0.11, '#ffe9a8');
  }
  if (grade === 'palms') {
    drawPalm(ctx, W * 0.06, H * 0.99, H * 0.34, 1);
    drawPalm(ctx, W * 0.97, H * 1.0, H * 0.28, -1);
    drawPalm(ctx, W * 0.88, H * 1.01, H * 0.2, 1);
  }
  if (grade === 'neon') {
    ctx.save();
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = Math.max(2, W * 0.004);
    ctx.shadowColor = '#ff2fb3';
    ctx.shadowBlur = W * 0.02;
    ctx.beginPath();
    ctx.moveTo(0, H * 0.86);
    ctx.lineTo(W, H * 0.86);
    ctx.stroke();
    ctx.restore();
  }
}

// Bold poster lettering: thick dark outline, gradient fill, slight tilt.
export function drawCaption(ctx, state, W, H) {
  const { caption, sub, captionColour, captionSize, captionPos } = state;
  const colour = CAPTION_COLOURS[captionColour] ?? '#ffffff';
  const base = Math.min(W, H) * 0.085 * captionSize;
  const cy = captionPos === 'top' ? H * 0.16 : H * 0.86;
  ctx.save();
  ctx.translate(W / 2, cy);
  ctx.rotate(-0.03);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${base}px "Arial Black", Arial, sans-serif`;
  const grad = ctx.createLinearGradient(0, -base * 0.6, 0, base * 0.6);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.55, colour);
  grad.addColorStop(1, '#ffb347');
  ctx.lineJoin = 'round';
  ctx.lineWidth = base * 0.16;
  ctx.strokeStyle = '#160a24';
  ctx.strokeText(caption.toUpperCase(), 0, 0);
  ctx.fillStyle = grad;
  ctx.fillText(caption.toUpperCase(), 0, 0);
  if (sub) {
    ctx.font = `italic 700 ${base * 0.34}px Georgia, serif`;
    // Thin outline only: a thick one swallows small text. A soft dark pill
    // behind it keeps the sub readable over any photo.
    const subW = ctx.measureText(sub).width;
    ctx.fillStyle = 'rgba(22,10,36,0.55)';
    ctx.beginPath();
    ctx.roundRect(-subW / 2 - base * 0.18, base * 0.5, subW + base * 0.36, base * 0.56, base * 0.28);
    ctx.fill();
    ctx.lineWidth = base * 0.03;
    ctx.strokeText(sub, 0, base * 0.78);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(sub, 0, base * 0.78);
  }
  ctx.restore();
}

// Film grain + vignette, the poster's finish.
let grainTile = null;
export function applyFinish(ctx, W, H, grain) {
  const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.75);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(10,4,20,0.42)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
  if (!grain) return;
  if (!grainTile) {
    grainTile = document.createElement('canvas');
    grainTile.width = 128;
    grainTile.height = 128;
    const g = grainTile.getContext('2d');
    const img = g.createImageData(128, 128);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 22;
    }
    g.putImageData(img, 0, 0);
  }
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = ctx.createPattern(grainTile, 'repeat');
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// The whole cover: backing, panels, grade, caption, finish.
export function drawCover(ctx, state, W, H) {
  ctx.clearRect(0, 0, W, H);
  // Poster backing: deep violet, so gutters read as a frame.
  ctx.fillStyle = '#1b0b2e';
  ctx.fillRect(0, 0, W, H);
  const panels = layoutPanels(state.layout, W, H);
  const tilt = state.layout === 'strip' ? [-0.06, 0.05, -0.02] : null;
  panels.forEach((rect, i) => {
    const panel = state.panels[i] ?? { photo: 0, zoom: 1, ox: 0, oy: 0 };
    const img = state.photos[panel.photo];
    if (!img) return;
    ctx.save();
    if (tilt) {
      ctx.translate(rect[0] + rect[2] / 2, rect[1] + rect[3] / 2);
      ctx.rotate(tilt[i]);
      ctx.translate(-rect[2] / 2, -rect[3] / 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-W * 0.008, -W * 0.008, rect[2] + W * 0.016, rect[3] + W * 0.016);
      drawPanelPhoto(ctx, img, [0, 0, rect[2], rect[3]], panel.zoom, panel.ox, panel.oy);
    } else {
      drawPanelPhoto(ctx, img, rect, panel.zoom, panel.ox, panel.oy);
    }
    ctx.restore();
  });
  applyGrade(ctx, state.grade, W, H);
  drawCaption(ctx, state, W, H);
  applyFinish(ctx, W, H, state.grain !== false);
  // Thin white frame, the poster's edge.
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = Math.max(2, W * 0.004);
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, W - ctx.lineWidth, H - ctx.lineWidth);
  ctx.restore();
}

// Render the cover to an offscreen canvas at export size and return a PNG blob.
export function exportCover(state, w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  drawCover(canvas.getContext('2d'), state, w, h);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}
