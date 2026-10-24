// Generates the tour's textures: tileable PBR maps (colour, normal, roughness) written as WebP to
// public/textures. Everything is procedural and seeded, so the output is reproducible and there is
// no third-party asset to download or license. Run with `npm run textures`.
import { mkdirSync } from 'node:fs';
import sharp from 'sharp';

const OUT = 'public/textures';
mkdirSync(OUT, { recursive: true });

// ---------- noise ----------
function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}
/** Periodic value noise: `period` lattice cells across the texture, so it tiles. */
function makeNoise(seed: number) {
  const r = rng(seed);
  const table = Float32Array.from({ length: 4096 }, () => r());
  const at = (x: number, y: number) => table[((x * 73856093) ^ (y * 19349663)) & 4095] ?? 0;
  const fade = (t: number) => t * t * (3 - 2 * t);
  return (u: number, v: number, period: number) => {
    const x = u * period;
    const y = v * period;
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = fade(x - xi);
    const yf = fade(y - yi);
    const w = (n: number) => ((n % period) + period) % period;
    const a = at(w(xi), w(yi));
    const b = at(w(xi + 1), w(yi));
    const c = at(w(xi), w(yi + 1));
    const d = at(w(xi + 1), w(yi + 1));
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
}
function fbm(noise: ReturnType<typeof makeNoise>, u: number, v: number, period: number, octaves = 4) {
  let sum = 0;
  let amp = 0.5;
  let p = period;
  for (let i = 0; i < octaves; i++) { sum += amp * noise(u, v, p); amp *= 0.5; p *= 2; }
  return sum / (1 - 0.5 ** octaves);
}
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (e0: number, e1: number, x: number) => { const t = clamp((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
const hex = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

// ---------- writing ----------
type Pixel = (u: number, v: number, x: number, y: number) => { rgb: [number, number, number]; h: number; r: number; a?: number };

async function texture(name: string, size: number, pixel: Pixel, { normal = 1, alpha = false, quality = 86 } = {}) {
  const channels = alpha ? 4 : 3;
  const color = Buffer.alloc(size * size * channels);
  const height = new Float32Array(size * size);
  const rough = Buffer.alloc(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const p = pixel(x / size, y / size, x, y);
      const i = y * size + x;
      color[i * channels] = clamp(p.rgb[0], 0, 255);
      color[i * channels + 1] = clamp(p.rgb[1], 0, 255);
      color[i * channels + 2] = clamp(p.rgb[2], 0, 255);
      if (alpha) color[i * channels + 3] = clamp((p.a ?? 1) * 255, 0, 255);
      height[i] = p.h;
      rough[i] = clamp(p.r * 255, 0, 255);
    }
  }
  await sharp(color, { raw: { width: size, height: size, channels } }).webp({ quality, alphaQuality: 90 }).toFile(`${OUT}/${name}.webp`);
  if (normal > 0) {
    // tangent-space normals (OpenGL convention) from the height field, wrapping at the edges
    const n = Buffer.alloc(size * size * 3);
    const h = (x: number, y: number) => height[((y + size) % size) * size + ((x + size) % size)] ?? 0;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (h(x + 1, y) - h(x - 1, y)) * normal;
        const dy = (h(x, y + 1) - h(x, y - 1)) * normal;
        const len = Math.hypot(dx, dy, 1);
        const i = (y * size + x) * 3;
        n[i] = (-dx / len * 0.5 + 0.5) * 255;
        n[i + 1] = (dy / len * 0.5 + 0.5) * 255;
        n[i + 2] = (1 / len * 0.5 + 0.5) * 255;
      }
    }
    await sharp(n, { raw: { width: size, height: size, channels: 3 } }).webp({ quality: 90 }).toFile(`${OUT}/${name}-n.webp`);
    await sharp(rough, { raw: { width: size, height: size, channels: 1 } }).webp({ quality: 85 }).toFile(`${OUT}/${name}-r.webp`);
  }
  console.log(`${name} ${size}px`);
}

// ---------- oak herringbone parquet ----------
// Planks of width W and length 6W; the pattern repeats every 12W both ways. One tile = 0.84 m.
{
  const nW = 6;
  const P = 2 * nW; // period in plank widths
  const planks: { x: number; y: number; w: number; h: number; vertical: boolean; tone: number; seed: number }[] = [];
  const r = rng(11);
  const tones = Array.from({ length: P * P * 4 }, () => r());
  for (let m = -3 * P; m <= 3 * P; m++) {
    for (let k = -3; k <= 3; k++) {
      const ox = m + k * nW;
      const oy = m - k * nW;
      if (ox < -2 * P || ox > 2 * P || oy < -2 * P || oy > 2 * P) continue;
      const key = (((ox % P) + P) % P) * P + (((oy % P) + P) % P);
      planks.push({ x: ox, y: oy, w: nW, h: 1, vertical: false, tone: tones[key * 2] ?? 0.5, seed: key * 2 });
      planks.push({ x: ox, y: oy + 1, w: 1, h: nW, vertical: true, tone: tones[key * 2 + 1] ?? 0.5, seed: key * 2 + 1 });
    }
  }
  const grain = makeNoise(5);
  const fine = makeNoise(6);
  const base = hex('#b98a5c');
  await texture('parquet', 1024, (u, v) => {
    const px = u * P;
    const py = v * P;
    const plank = planks.find((p) => px >= p.x && px < p.x + p.w && py >= p.y && py < p.y + p.h) ?? (planks[0] as (typeof planks)[number]);
    const lx = (px - plank.x) / plank.w;
    const ly = (py - plank.y) / plank.h;
    const along = plank.vertical ? ly : lx;
    const across = plank.vertical ? lx : ly;
    const edge = Math.min(lx * plank.w, (1 - lx) * plank.w, ly * plank.h, (1 - ly) * plank.h); // in plank widths
    const g = fbm(grain, across * 0.9 + plank.seed * 0.137, along * 0.08 + plank.seed * 0.071, 16, 4);
    const streak = Math.sin((across * 9 + g * 6 + plank.seed) * Math.PI) * 0.5 + 0.5;
    const f = fine(u, v, 256);
    const tone = 0.82 + plank.tone * 0.3 + (streak - 0.5) * 0.16 + (f - 0.5) * 0.05;
    const groove = smooth(0.0, 0.035, edge);
    const shade = tone * mix(0.55, 1, groove);
    return {
      rgb: [base[0] * shade, base[1] * shade * 0.98, base[2] * shade * 0.94],
      h: groove * 0.8 + streak * 0.04,
      r: 0.42 + (1 - streak) * 0.12 + (1 - groove) * 0.3,
    };
  }, { normal: 6 });
}

// ---------- 60 x 60 porcelain tiles, warm grey stone look (two tiles per texture: 1.2 m) ----------
{
  const n = makeNoise(21);
  const veins = makeNoise(22);
  const r = rng(23);
  const tiles = Array.from({ length: 4 }, () => r());
  await texture('carrelage', 1024, (u, v) => {
    const tx = Math.floor(u * 2);
    const ty = Math.floor(v * 2);
    const lx = u * 2 - tx;
    const ly = v * 2 - ty;
    const joint = Math.min(lx, 1 - lx, ly, 1 - ly) * 600; // mm from the joint
    const grout = smooth(1.2, 2.0, joint);
    const mott = fbm(n, u, v, 6, 5);
    const cloud = fbm(veins, u, v, 3, 5);
    const tone = 0.86 + (tiles[ty * 2 + tx] ?? 0) * 0.04 + (mott - 0.5) * 0.07 + (cloud - 0.5) * 0.06;
    const g = 0.62;
    return {
      rgb: [mix(g * 205, 214 * tone, grout), mix(g * 200, 208 * tone, grout), mix(g * 193, 198 * tone, grout)],
      h: grout * 0.5 + mott * 0.02,
      r: mix(0.9, 0.32 + (mott - 0.5) * 0.1, grout),
    };
  }, { normal: 4 });
}

// ---------- polished concrete (béton ciré), one texture = 2.5 m ----------
{
  const n = makeNoise(31);
  const trowel = makeNoise(32);
  await texture('beton', 1024, (u, v) => {
    const big = fbm(n, u, v, 4, 5);
    const marks = fbm(trowel, u * 0.6 + v * 0.4, v * 1.4 - u * 0.2, 12, 3);
    const tone = 0.86 + (big - 0.5) * 0.16 + (marks - 0.5) * 0.05;
    return { rgb: [196 * tone, 192 * tone, 186 * tone], h: big * 0.3 + marks * 0.2, r: 0.38 + (marks - 0.5) * 0.25 + (big - 0.5) * 0.1 };
  }, { normal: 1.5 });
}

// ---------- terrazzo for the bathroom and WC floors, one texture = 1 m ----------
{
  const r = rng(41);
  const chips = Array.from({ length: 900 }, () => ({ x: r(), y: r(), s: 0.004 + r() ** 2 * 0.018, c: r() }));
  const palette = [hex('#7d8b74'), hex('#c9a585'), hex('#5f6b78'), hex('#e6e1d7'), hex('#a35f45')];
  const n = makeNoise(42);
  await texture('terrazzo', 1024, (u, v) => {
    let rgb: [number, number, number] = [228, 224, 216];
    let chip = false;
    const warp = (n(u, v, 96) - 0.5) * 0.012;
    for (const c of chips) {
      const dx = Math.min(Math.abs(u - c.x), 1 - Math.abs(u - c.x));
      const dy = Math.min(Math.abs(v - c.y), 1 - Math.abs(v - c.y));
      if (Math.hypot(dx * (1 + c.c), dy * (2 - c.c)) + warp < c.s * 0.8) { rgb = palette[Math.floor(c.c * palette.length)] ?? rgb; chip = true; break; }
    }
    const m = (n(u, v, 64) - 0.5) * 10;
    return { rgb: [rgb[0] + m, rgb[1] + m, rgb[2] + m], h: chip ? 0.02 : 0, r: 0.3 };
  }, { normal: 1 });
}

// ---------- zellige wall tiles for the shower, 7.5 x 15 cm, irregular glaze; one texture = 0.6 m ----------
{
  const r = rng(51);
  const glaze = Array.from({ length: 64 }, () => r());
  const n = makeNoise(52);
  await texture('zellige', 1024, (u, v) => {
    const cols = 8;
    const rows = 4;
    const tx = Math.floor(u * cols);
    const ty = Math.floor(v * rows);
    const lx = u * cols - tx;
    const ly = v * rows - ty;
    const joint = smooth(0.0, 0.025, Math.min(lx, 1 - lx) / 2) * smooth(0.0, 0.025, Math.min(ly, 1 - ly));
    const t = glaze[(ty * cols + tx) % 64] ?? 0.5;
    const pool = fbm(n, u, v, 16, 3);
    const tone = 0.9 + t * 0.1 + (pool - 0.5) * 0.12;
    const base = hex('#d9e2dc');
    return { rgb: [mix(170, base[0] * tone, joint), mix(170, base[1] * tone, joint), mix(165, base[2] * tone, joint)], h: joint * 0.6 + pool * 0.15, r: mix(0.85, 0.12 + pool * 0.1, joint) };
  }, { normal: 5 });
}

// ---------- plaster: a very slight texture under the paint; one texture = 2 m ----------
{
  const n = makeNoise(61);
  await texture('platre', 512, (u, v) => {
    const k = fbm(n, u, v, 32, 4);
    const g = 236 + (k - 0.5) * 10;
    return { rgb: [g, g, g], h: k, r: 0.88 + (k - 0.5) * 0.08 };
  }, { normal: 0.6 });
}

// ---------- fabric weave; one texture = 0.25 m ----------
{
  const n = makeNoise(71);
  await texture('tissu', 512, (u, v) => {
    const threads = 96;
    const wx = Math.sin(u * threads * Math.PI * 2) * 0.5 + 0.5;
    const wy = Math.sin(v * threads * Math.PI * 2) * 0.5 + 0.5;
    const over = ((Math.floor(u * threads) + Math.floor(v * threads)) % 2 === 0 ? wx : wy);
    const fuzz = n(u, v, 128);
    const g = 214 + (over - 0.5) * 34 + (fuzz - 0.5) * 18;
    return { rgb: [g, g, g], h: over * 0.7 + fuzz * 0.3, r: 0.95 };
  }, { normal: 3 });
}

// ---------- oak for furniture and kitchen fronts, straight grain; one texture = 1 m ----------
{
  const n = makeNoise(81);
  const base = hex('#c39565');
  await texture('chene', 512, (u, v) => {
    const g = fbm(n, u * 1.0, v * 0.06, 24, 4);
    const ring = Math.sin((u * 40 + g * 10) * Math.PI) * 0.5 + 0.5;
    const tone = 0.85 + (ring - 0.5) * 0.14 + (g - 0.5) * 0.12;
    return { rgb: [base[0] * tone, base[1] * tone, base[2] * tone], h: ring * 0.15, r: 0.5 + (1 - ring) * 0.1 };
  }, { normal: 1.5 });
}

// ---------- quartz worktop, white with fine speckles; one texture = 1 m ----------
{
  const n = makeNoise(91);
  const s = makeNoise(92);
  await texture('quartz', 512, (u, v) => {
    const cloud = fbm(n, u, v, 6, 4);
    const speck = s(u, v, 256) > 0.93 ? -40 : 0;
    const g = 238 + (cloud - 0.5) * 12 + speck;
    return { rgb: [g, g - 1, g - 4], h: 0, r: 0.18 + cloud * 0.08 };
  }, { normal: 0 });
}

// ---------- berber rug: cream wool with dark diamond lines; one texture = 2 m ----------
{
  const n = makeNoise(101);
  await texture('tapis', 512, (u, v) => {
    const frac = (x: number) => x - Math.floor(x);
    const wob = (n(u, v, 32) - 0.5) * 0.04;
    const d1 = Math.min(frac(u * 5 + v * 4 + wob), 1 - frac(u * 5 + v * 4 + wob));
    const d2 = Math.min(frac(u * 5 - v * 4 + wob), 1 - frac(u * 5 - v * 4 + wob));
    const line = Math.max(smooth(0.035, 0.012, d1), smooth(0.035, 0.012, d2));
    const wool = fbm(n, u, v, 64, 3);
    const g = 232 + (wool - 0.5) * 30;
    return { rgb: [mix(g, 52, line * 0.85), mix(g - 6, 46, line * 0.85), mix(g - 16, 40, line * 0.85)], h: wool, r: 1 };
  }, { normal: 4 });
}

// ---------- balcony decking, composite boards; one texture = 1 m ----------
{
  const n = makeNoise(111);
  await texture('terrasse', 512, (u, v) => {
    const boards = 7;
    const ly = v * boards - Math.floor(v * boards);
    const gap = smooth(0.0, 0.06, Math.min(ly, 1 - ly));
    const g = fbm(n, u * 0.5, v * boards * 0.5, 16, 3);
    const tone = 0.8 + (g - 0.5) * 0.2;
    return { rgb: [mix(30, 132 * tone, gap), mix(30, 118 * tone, gap), mix(30, 104 * tone, gap)], h: gap, r: 0.8 };
  }, { normal: 4 });
}

// ---------- a leaf, with transparency, for the plants ----------
{
  const n = makeNoise(121);
  await texture('feuille', 256, (u, v) => {
    const x = (u - 0.5) * 2;
    const y = v * 2 - 1;
    const width = Math.sqrt(Math.max(0, 1 - y * y)) * 0.55 * (1 - 0.25 * y);
    const inside = Math.abs(x) < width;
    const vein = smooth(0.03, 0.0, Math.abs(x)) + smooth(0.02, 0.0, Math.abs(Math.abs(x) - (y + 1) * 0.18 % 0.18 - 0.05)) * 0.3;
    const k = n(u, v, 32);
    const g = 0.75 + k * 0.25;
    return { rgb: [mix(52 * g, 120, vein * 0.5), mix(98 * g, 150, vein * 0.5), mix(46 * g, 90, vein * 0.5)], h: 0, r: 0.6, a: inside ? 1 : 0 };
  }, { normal: 0, alpha: true });
}

// ---------- two abstract paintings for the walls ----------
for (const [name, palette, seed] of [['tableau1', ['#e9e2d4', '#c77c59', '#2f4858', '#d9b26f'], 131], ['tableau2', ['#efe9df', '#6f8f72', '#c9a27e', '#29343d'], 141]] as const) {
  const r = rng(seed);
  const shapes = Array.from({ length: 7 }, (_, i) => ({ x: r(), y: r(), s: 0.12 + r() * 0.3, c: hex(palette[1 + (i % 3)] ?? '#000000'), round: r() > 0.5 }));
  const paper = hex(palette[0]);
  const n = makeNoise(seed + 1);
  await texture(name, 512, (u, v) => {
    let rgb: [number, number, number] = [...paper];
    for (const s of shapes) {
      const d = s.round ? Math.hypot(u - s.x, v - s.y) : Math.max(Math.abs(u - s.x), Math.abs(v - s.y) * 1.4);
      if (d < s.s) rgb = [...s.c];
    }
    const k = (n(u, v, 128) - 0.5) * 14;
    return { rgb: [rgb[0] + k, rgb[1] + k, rgb[2] + k], h: 0, r: 0.9 };
  }, { normal: 0 });
}

// ---------- the facade of the buildings across the street ----------
{
  const n = makeNoise(151);
  await texture('facade', 512, (u, v) => {
    const wx = (u * 6) % 1;
    const wy = (v * 5) % 1;
    const window = wx > 0.25 && wx < 0.75 && wy > 0.2 && wy < 0.8;
    const k = fbm(n, u, v, 8, 3);
    const stone = 214 + (k - 0.5) * 20;
    return { rgb: window ? [70 + k * 30, 84 + k * 30, 98 + k * 30] : [stone, stone - 6, stone - 16], h: window ? 0 : 1, r: window ? 0.15 : 0.9 };
  }, { normal: 2 });
  // the same facade at night: some windows lit, warm, the rest dark (used as the emissive map)
  const lit = (cx: number, cy: number) => { const x = Math.sin(cx * 91.7 + cy * 47.3) * 43758.5; return x - Math.floor(x) < 0.38; };
  await texture('facade-nuit', 256, (u, v) => {
    const wx = (u * 6) % 1;
    const wy = (v * 5) % 1;
    const on = wx > 0.27 && wx < 0.73 && wy > 0.22 && wy < 0.78 && lit(Math.floor(u * 6), Math.floor(v * 5));
    const k = fbm(n, u, v, 4, 2);
    return { rgb: on ? [255, 190 + k * 40, 120 + k * 50] : [0, 0, 0], h: 0, r: 1 };
  }, { normal: 0 });
}
