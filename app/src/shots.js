// ?shot= scenes for screenshots and testing (no UI chrome needed).
//   ?shot=cover&photo=pier&caption=Sunset%20Heist&layout=hero&grade=palms
//       Full-frame exported-style cover at the viewport's size.
//   ?shot=editor&photo=boulevard&caption=Boulevard%20Queen&layout=trio&grade=neon
//       The editor, with a sample photo loaded and the scene applied.
// Scenes are driven by query params only; the app itself needs no network.

import { defaultState, loadSamples } from './main.js';
import { drawCover } from './cover.js';

const SAMPLE_SRC = { pier: 'samples/pier.jpg', boulevard: 'samples/boulevard.jpg' };

function param(name, fallback) {
  const v = new URLSearchParams(location.search).get(name);
  return v === null || v === '' ? fallback : v;
}

function pickPhoto(state, name) {
  const src = SAMPLE_SRC[name] ?? SAMPLE_SRC.pier;
  const idx = state.photos.findIndex((img) => img.src.endsWith(name + '.jpg'));
  const photo = idx === -1 ? 0 : idx;
  state.panels.forEach((p) => { p.photo = photo; });
  return state;
}

export async function runShotScene() {
  const shot = param('shot', '');
  if (!shot) return false;
  const state = defaultState();
  await loadSamples(state);
  state.caption = param('caption', state.caption);
  state.sub = param('sub', state.sub);
  state.layout = param('layout', state.layout);
  state.grade = param('grade', state.grade);
  pickPhoto(state, param('photo', 'pier'));

  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    const canvas = document.createElement('canvas');
    canvas.id = 'shot-cover';
    canvas.width = innerWidth;
    canvas.height = innerHeight;
    document.body.append(canvas);
    drawCover(canvas.getContext('2d'), state, canvas.width, canvas.height);
    document.title = `Cover — ${state.caption}`;
    return true;
  }
  return false;
}

// Editor scene: the normal editor boots, then the scene is applied to it.
export function applyEditorScene(editor) {
  const shot = new URLSearchParams(location.search).get('shot');
  if (shot !== 'editor') return;
  const { state, render } = editor;
  state.caption = param('caption', state.caption);
  state.sub = param('sub', state.sub);
  state.layout = param('layout', state.layout);
  state.grade = param('grade', state.grade);
  pickPhoto(state, param('photo', 'pier'));
  const captionInput = document.querySelector('#caption');
  if (captionInput) captionInput.value = state.caption;
  const subInput = document.querySelector('#sub');
  if (subInput) subInput.value = state.sub;
  document.querySelectorAll('#layouts button').forEach((b) => b.classList.toggle('active', b.dataset.layout === state.layout));
  document.querySelectorAll('#grades button').forEach((b) => b.classList.toggle('active', b.dataset.grade === state.grade));
  render();
}
