// Vice Cover Studio — the entry program (Node 22, standard library only).
// The app is app/: plain static files a desktop browser loads offline
// (index.html and its ES modules, no library, no network request). This
// program hands it in: it copies app/ and screenshots/ from beside this file
// to /output and writes /output/dossier.json, the summary the judge reads,
// with the vendored make.fun library.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// --- Pre-flight gate check (added after the first dossier build) -------------
// A screenshot over the gate's limits silently invalidates the whole entry,
// so refuse loudly here instead of writing a dossier the scorer would
// refuse. Limits from reference/gate.json: 3-4 screenshots, each at most
// 256 KiB, long side at most 1280 px, short side at least 480 px.
function imageSize(buf) {
  // PNG: width/height are big-endian uint32 at bytes 16/20 of the IHDR.
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  // JPEG: walk segments until a Start-Of-Frame marker gives dimensions.
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) break;
      const marker = buf[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5) };
      }
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  return null;
}

function checkGateInputs() {
  const index = join(here, 'app', 'index.html');
  if (!existsSync(index)) throw new Error('missing app/index.html — the app has no entry page');
  const shotsDir = join(here, 'screenshots');
  if (!existsSync(shotsDir)) throw new Error('missing screenshots/ — the entry needs 3-4 screenshots');
  const shots = readdirSync(shotsDir)
    .filter((n) => !n.startsWith('.'))
    .sort();
  if (shots.length < 3 || shots.length > 4) {
    throw new Error(`screenshots/: found ${shots.length}, the gate needs 3-4`);
  }
  for (const name of shots) {
    const file = join(shotsDir, name);
    const size = statSync(file).size;
    if (size > 262144) throw new Error(`screenshots/${name} is ${size} bytes, over the 256 KiB gate cap`);
    const dims = imageSize(readFileSync(file));
    if (!dims) throw new Error(`screenshots/${name} is not a readable PNG or JPEG`);
    const long = Math.max(dims.w, dims.h);
    const short = Math.min(dims.w, dims.h);
    if (long > 1280 || short < 480) {
      throw new Error(`screenshots/${name} is ${dims.w}x${dims.h}, outside the gate's 1280 long / 480 short limits`);
    }
  }
  console.log(`gate pre-flight ok: ${shots.length} screenshots within limits`);
}

checkGateInputs();

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the
// bytes; the others refuse an entry the scorer would refuse (more than 4
// screenshots or one over 256 KiB; more than 993 files in app/ or 48 MiB of
// app files, in all, or a path under app/ over 1000 bytes: app/ counts beside
// /output's own 1000-entry cap, its screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);
