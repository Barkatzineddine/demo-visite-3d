// The furniture, modelled in code: each piece is authored in its own frame (x across, y up, z from
// the wall towards the room) and placed with a position and a turn. Everything goes into one Batch,
// so the whole furnishing is a handful of meshes that the "furnished / empty" switch shows or hides.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Batch, boxUV } from './geometry';
import type { Materials } from './materials';

const S = 0; // facing south (+z)
const N = Math.PI; // facing north
const E = Math.PI / 2; // facing east (+x)
const W = -Math.PI / 2; // facing west

/** A drawing frame: geometry authored locally, moved into place on the way into the batch. */
class Kit {
  constructor(private readonly batch: Batch, private readonly matrix = new THREE.Matrix4()) {}

  at(x: number, z: number, turn = 0, y = 0): Kit {
    const local = new THREE.Matrix4().makeRotationY(turn).setPosition(x, y, z);
    return new Kit(this.batch, this.matrix.clone().multiply(local));
  }

  /** Any geometry authored in this frame. */
  add(g: THREE.BufferGeometry, mat: THREE.Material): this {
    this.batch.add(g.applyMatrix4(this.matrix), mat);
    return this;
  }

  box(mat: THREE.Material, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): this {
    return this.add(boxUV(x0, y0, z0, x1, y1, z1), mat);
  }

  /** A rounded box between two corners, with texture density about one unit per metre. */
  soft(mat: THREE.Material, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, r = 0.04, tilt = 0): this {
    const w = x1 - x0;
    const h = y1 - y0;
    const d = z1 - z0;
    const g = new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2) * 0.999);
    const uv = g.getAttribute('uv');
    const k = Math.max(w, h, d);
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * k, uv.getY(i) * k);
    g.applyMatrix4(new THREE.Matrix4().makeRotationX(tilt).setPosition((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2));
    return this.add(g, mat);
  }

  cyl(mat: THREE.Material, x: number, y0: number, z: number, rTop: number, rBottom: number, h: number, seg = 24): this {
    return this.add(new THREE.CylinderGeometry(rTop, rBottom, h, seg).translate(x, y0 + h / 2, z), mat);
  }

  /** A turned profile (vase, lamp shade, basin): points are [radius, height]. */
  lathe(mat: THREE.Material, x: number, y0: number, z: number, profile: [number, number][], seg = 32): this {
    return this.add(new THREE.LatheGeometry(profile.map(([r, h]) => new THREE.Vector2(r, h)), seg).translate(x, y0, z), mat);
  }

  plane(mat: THREE.Material, w: number, h: number, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): this {
    const g = new THREE.PlaneGeometry(w, h);
    g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')).setPosition(x, y, z));
    return this.add(g, mat);
  }
}

const rand = (seed: number) => { const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// ---------- living room ----------
function sofa(k: Kit, m: Materials, length = 2.2) {
  const d = 0.95;
  for (const x of [0.06, length - 0.1]) for (const z of [0.08, d - 0.12]) k.cyl(m.walnut, x, 0, z, 0.022, 0.016, 0.12, 10);
  k.soft(m.sofa, 0, 0.12, 0, length, 0.44, d, 0.04);
  k.soft(m.sofa, 0, 0.12, 0, 0.17, 0.66, d, 0.06);
  k.soft(m.sofa, length - 0.17, 0.12, 0, length, 0.66, d, 0.06);
  const seats = 3;
  const sw = (length - 0.34) / seats;
  for (let i = 0; i < seats; i++) {
    k.soft(m.sofa, 0.17 + i * sw + 0.005, 0.42, 0.2, 0.17 + (i + 1) * sw - 0.005, 0.57, d - 0.02, 0.06);
    k.soft(m.sofa, 0.17 + i * sw + 0.01, 0.44, 0.02, 0.17 + (i + 1) * sw - 0.01, 0.92, 0.26, 0.08, -0.12);
  }
  k.soft(m.cushion, 0.25, 0.55, 0.22, 0.7, 0.95, 0.36, 0.07, -0.25);
  k.soft(m.cushion2, length - 0.72, 0.55, 0.22, length - 0.27, 0.95, 0.36, 0.07, -0.2);
  k.soft(m.throw, length - 0.9, 0.56, 0.3, length - 0.2, 0.585, d - 0.05, 0.01);
}

function armchair(k: Kit, m: Materials) {
  for (const x of [0.06, 0.74]) for (const z of [0.08, 0.72]) k.cyl(m.walnut, x, 0, z, 0.02, 0.014, 0.16, 10);
  k.soft(m.armchair, 0, 0.16, 0, 0.8, 0.42, 0.8, 0.05);
  k.soft(m.armchair, 0, 0.16, 0, 0.12, 0.62, 0.8, 0.05);
  k.soft(m.armchair, 0.68, 0.16, 0, 0.8, 0.62, 0.8, 0.05);
  k.soft(m.armchair, 0.12, 0.4, 0.2, 0.68, 0.54, 0.78, 0.06);
  k.soft(m.armchair, 0.12, 0.4, 0.02, 0.68, 0.88, 0.24, 0.08, -0.15);
}

function coffeeTable(k: Kit, m: Materials) {
  k.soft(m.oak, 0, 0.36, 0, 1.1, 0.4, 0.62, 0.03);
  for (const [x, z] of [[0.08, 0.08], [1.02, 0.08], [0.08, 0.54], [1.02, 0.54]] as const) k.cyl(m.blackMatte, x, 0, z, 0.015, 0.015, 0.36, 8);
  k.box(m.book[1] ?? m.white, 0.15, 0.4, 0.15, 0.45, 0.43, 0.38).box(m.book[2] ?? m.white, 0.17, 0.43, 0.16, 0.43, 0.455, 0.36);
  k.lathe(m.ceramic, 0.8, 0.4, 0.3, [[0, 0], [0.05, 0], [0.07, 0.06], [0.05, 0.16], [0.03, 0.2], [0.032, 0.22]]);
}

function tvUnit(k: Kit, m: Materials) {
  k.box(m.oak, 0, 0.12, 0, 1.8, 0.5, 0.42);
  for (const x of [0.05, 1.71]) k.box(m.blackMatte, x, 0, 0.05, x + 0.04, 0.12, 0.37);
  for (let i = 0; i < 3; i++) k.box(m.walnut, 0.02 + i * 0.6, 0.14, 0.42, 0.58 + i * 0.6, 0.48, 0.425);
  k.box(m.screen, 0.25, 0.85, 0.03, 1.55, 1.6, 0.06);
  k.lathe(m.potDark, 1.55, 0.5, 0.22, [[0, 0], [0.08, 0], [0.09, 0.12], [0.06, 0.2]]);
  plant(k.at(1.55, 0.22, 0, 0.62), m, 0.45, 9);
}

function floorLamp(k: Kit, m: Materials) {
  k.cyl(m.blackMatte, 0, 0, 0, 0.14, 0.15, 0.03, 32);
  k.cyl(m.blackMatte, 0, 0.03, 0, 0.012, 0.012, 1.45, 8);
  k.lathe(m.lampShade, 0, 1.38, 0, [[0.2, 0], [0.13, 0.28]], 40);
  k.cyl(m.bulb, 0, 1.4, 0, 0.04, 0.04, 0.06, 12);
}

function rug(k: Kit, m: Materials, w: number, d: number) {
  k.box(m.rug, 0, 0.001, 0, w, 0.012, d);
}

function bookshelf(k: Kit, m: Materials, w = 1.0, h = 2.0) {
  const d = 0.32;
  k.box(m.oak, 0, 0, 0, 0.025, h, d).box(m.oak, w - 0.025, 0, 0, w, h, d).box(m.oak, 0, h - 0.025, 0, w, h, d).box(m.oak, 0, 0, 0, w, 0.06, d);
  const shelves = 5;
  for (let i = 1; i < shelves; i++) {
    const y = (h / shelves) * i;
    k.box(m.oak, 0.025, y, 0, w - 0.025, y + 0.022, d);
    let x = 0.04 + rand(i) * 0.1;
    let b = 0;
    while (x < w - 0.12) {
      const bw = 0.025 + rand(i * 31 + b) * 0.03;
      const bh = 0.2 + rand(i * 17 + b) * 0.1;
      const mat = m.book[Math.floor(rand(i * 7 + b) * m.book.length)] ?? m.white;
      if (rand(i * 13 + b) > 0.85) { x += 0.12; b++; continue; }
      k.box(mat, x, y + 0.022, 0.05, x + bw, y + 0.022 + bh, d - 0.04);
      x += bw + 0.003;
      b++;
    }
  }
  k.lathe(m.ceramic, w * 0.75, (h / shelves) * 3 + 0.022, d / 2, [[0, 0], [0.05, 0], [0.06, 0.08], [0.03, 0.18]]);
}

function plant(k: Kit, m: Materials, size = 1, seed = 1) {
  const leaves = Math.round(7 + size * 10);
  for (let i = 0; i < leaves; i++) {
    const a = rand(seed * 19 + i) * Math.PI * 2;
    const tilt = 0.4 + rand(seed * 23 + i) * 0.7;
    const h = size * (0.35 + rand(seed * 29 + i) * 0.55);
    const len = size * (0.25 + rand(seed * 31 + i) * 0.2);
    const r = Math.sin(tilt) * len * 0.5;
    k.cyl(m.tree, Math.cos(a) * r * 0.5, 0, Math.sin(a) * r * 0.5, 0.004, 0.006, h, 5);
    k.plane(m.leaf, len * 0.55, len, Math.cos(a) * r, h + Math.cos(tilt) * len * 0.4, Math.sin(a) * r, -tilt, -a + Math.PI / 2, 0);
  }
}

function pottedPlant(k: Kit, m: Materials, size = 1.2, seed = 3) {
  const profile: [number, number][] = [[0, 0], [0.16, 0], [0.2, 0.36], [0.18, 0.38], [0, 0.38]];
  k.lathe(m.pot, 0, 0, 0, profile.map(([r, h]) => [r * size * 0.8, h * size * 0.8]));
  plant(k.at(0, 0, 0, 0.3 * size), m, size, seed);
}

function pendant(k: Kit, m: Materials, y: number) {
  k.cyl(m.blackMatte, 0, y + 0.25, 0, 0.003, 0.003, 2.5 - y - 0.25, 6);
  k.lathe(m.lampShade, 0, y, 0, [[0.22, 0], [0.2, 0.06], [0.12, 0.18], [0.03, 0.26]], 40);
  k.cyl(m.bulb, 0, y + 0.06, 0, 0.035, 0.035, 0.07, 12);
}

function diningSet(k: Kit, m: Materials) {
  k.soft(m.oak, 0, 0.72, 0, 1.6, 0.76, 0.9, 0.015);
  for (const [x, z] of [[0.1, 0.1], [1.5, 0.1], [0.1, 0.8], [1.5, 0.8]] as const) k.cyl(m.oak, x, 0, z, 0.025, 0.02, 0.72, 10);
  for (const [x, z, turn] of [[0.45, -0.1, S], [1.15, -0.1, S], [0.45, 1.0, N], [1.15, 1.0, N]] as const) chair(k.at(x, z, turn), m);
  k.lathe(m.ceramic, 0.8, 0.76, 0.45, [[0, 0], [0.12, 0], [0.13, 0.03], [0.1, 0.06]], 32);
}

function chair(k: Kit, m: Materials) {
  for (const [x, z] of [[-0.19, -0.16], [0.19, -0.16], [-0.19, 0.18], [0.19, 0.18]] as const) k.cyl(m.oak, x, 0, z, 0.016, 0.013, 0.45, 8);
  k.soft(m.cushion, -0.22, 0.43, -0.2, 0.22, 0.48, 0.22, 0.02);
  k.soft(m.oak, -0.22, 0.48, -0.22, 0.22, 0.86, -0.19, 0.012, 0.08);
}

function kitchen(k: Kit, m: Materials) {
  // tall column (fridge and oven) on the left, then 2.4 m of base units, wall units above
  k.box(m.fronts, 0, 0, 0, 0.6, 2.2, 0.6);
  k.box(m.black, 0.04, 0.95, 0.6, 0.56, 1.42, 0.605);
  k.box(m.steel, 0.1, 1.44, 0.6, 0.5, 1.455, 0.62);
  k.box(m.blackMatte, 0.6, 0, 0.05, 3.0, 0.1, 0.55);
  for (let i = 0; i < 4; i++) {
    const x = 0.6 + i * 0.6;
    k.box(m.fronts, x + 0.003, 0.1, 0, x + 0.597, 0.86, 0.6);
    k.box(m.steel, x + 0.2, 0.78, 0.6, x + 0.4, 0.792, 0.618);
  }
  k.box(m.top, 0.6, 0.86, 0, 3.0, 0.9, 0.63);
  k.box(m.top, 0.6, 0.9, 0, 3.0, 1.45, 0.012);
  // sink and tap
  k.box(m.steel, 1.05, 0.75, 0.12, 1.55, 0.901, 0.5);
  k.box(m.blackMatte, 1.08, 0.78, 0.15, 1.52, 0.902, 0.47);
  k.cyl(m.steel, 1.3, 0.9, 0.08, 0.015, 0.018, 0.32, 12);
  k.box(m.steel, 1.285, 1.18, 0.08, 1.315, 1.21, 0.28);
  // induction hob
  k.box(m.black, 2.05, 0.9, 0.08, 2.65, 0.906, 0.6);
  for (const [x, z] of [[2.2, 0.22], [2.5, 0.22], [2.2, 0.46], [2.5, 0.46]] as const) k.cyl(m.blackMatte, x, 0.906, z, 0.08, 0.08, 0.001, 24);
  // wall units with the extractor hood
  k.box(m.fronts, 0.6, 1.5, 0, 2.0, 2.2, 0.35);
  k.box(m.fronts, 2.0, 1.75, 0, 2.7, 2.2, 0.36);
  k.box(m.steel, 2.05, 1.72, 0.02, 2.65, 1.75, 0.38);
  k.box(m.fronts, 2.7, 1.5, 0, 3.0, 2.2, 0.35);
  for (let i = 0; i < 3; i++) k.lathe(m.ceramic, 2.25 + i * 0.12, 0.9, 0.18, [[0, 0], [0.035, 0], [0.045, 0.1], [0.04, 0.11]], 16);
}

function island(k: Kit, m: Materials) {
  k.box(m.fronts, 0, 0, 0, 1.8, 0.88, 0.62);
  k.box(m.top, -0.03, 0.88, -0.03, 1.83, 0.92, 0.92);
  for (const x of [0.35, 0.9, 1.45]) {
    k.cyl(m.blackMatte, x, 0, 1.1, 0.018, 0.018, 0.62, 8);
    k.cyl(m.blackMatte, x, 0, 1.1, 0.16, 0.18, 0.02, 24);
    k.soft(m.oak, x - 0.18, 0.62, 0.92, x + 0.18, 0.66, 1.28, 0.03);
  }
  k.lathe(m.potDark, 1.3, 0.92, 0.35, [[0, 0], [0.11, 0], [0.13, 0.05], [0.12, 0.08]], 24);
  for (let i = 0; i < 4; i++) k.cyl(m.brass, 1.24 + rand(i) * 0.12, 0.95, 0.3 + rand(i + 9) * 0.1, 0.03, 0.03, 0.04, 12);
}

function curtains(k: Kit, m: Materials, width: number, y1 = 2.38) {
  // gathered linen on each side of the window, on a thin rail
  k.cyl(m.blackMatte, -0.3, y1, 0.07, 0.008, 0.008, 0.01).box(m.blackMatte, -0.4, y1, 0.065, width + 0.4, y1 + 0.016, 0.081);
  for (const [x0, x1] of [[-0.42, 0.18], [width - 0.18, width + 0.42]] as const) {
    const g = new THREE.PlaneGeometry(x1 - x0, y1 - 0.02, 28, 1);
    const pos = g.getAttribute('position');
    for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin((pos.getX(i) - x0) * 21) * 0.03);
    g.computeVertexNormals();
    g.translate((x0 + x1) / 2, (y1 - 0.02) / 2 + 0.01, 0.12);
    k.add(g, m.curtain);
  }
}

function frame(k: Kit, art: THREE.Material, m: Materials, w: number, h: number, y: number) {
  k.box(m.blackMatte, -w / 2 - 0.03, y - 0.03, 0, w / 2 + 0.03, y + h + 0.03, 0.03);
  k.box(art, -w / 2, y, 0.03, w / 2, y + h, 0.032);
}

// ---------- bedrooms ----------
function bed(k: Kit, m: Materials, w: number, l: number) {
  k.soft(m.cushion2, -w / 2 - 0.08, 0.1, 0, w / 2 + 0.08, 1.12, 0.09, 0.03);
  k.box(m.oak, -w / 2 - 0.04, 0.12, 0.09, w / 2 + 0.04, 0.3, l + 0.1);
  for (const [x, z] of [[-w / 2, 0.15], [w / 2 - 0.05, 0.15], [-w / 2, l], [w / 2 - 0.05, l]] as const) k.box(m.oak, x, 0, z, x + 0.05, 0.12, z + 0.05);
  k.soft(m.linen, -w / 2, 0.3, 0.1, w / 2, 0.52, l + 0.08, 0.05);
  k.soft(m.duvet, -w / 2 - 0.05, 0.45, 0.6, w / 2 + 0.05, 0.58, l + 0.13, 0.06);
  k.soft(m.throw, -w / 2 - 0.06, 0.56, l - 0.45, w / 2 + 0.06, 0.6, l - 0.05, 0.03);
  const pillows = w > 1.5 ? 2 : 1;
  for (let i = 0; i < pillows; i++) {
    const x0 = -w / 2 + 0.08 + i * (w / pillows);
    k.soft(m.linen, x0, 0.5, 0.12, x0 + w / pillows - 0.16, 0.66, 0.55, 0.07, -0.35);
  }
  k.soft(m.cushion, -0.25, 0.55, 0.45, 0.25, 0.8, 0.62, 0.06, -0.3);
}

function nightstand(k: Kit, m: Materials, lamp = true) {
  k.box(m.oak, 0, 0, 0, 0.45, 0.5, 0.4);
  k.box(m.walnut, 0.02, 0.28, 0.4, 0.43, 0.46, 0.405);
  if (lamp) {
    k.lathe(m.ceramic, 0.22, 0.5, 0.2, [[0, 0], [0.07, 0], [0.08, 0.06], [0.04, 0.2], [0.012, 0.24]], 24);
    k.lathe(m.lampShade, 0.22, 0.68, 0.2, [[0.14, 0], [0.11, 0.18]], 32);
    k.cyl(m.bulb, 0.22, 0.72, 0.2, 0.03, 0.03, 0.05, 12);
  }
}

function wardrobe(k: Kit, m: Materials, w: number) {
  const n = Math.round(w / 0.5);
  const dw = w / n;
  k.box(m.white, 0, 0, 0, w, 2.3, 0.6);
  for (let i = 0; i < n; i++) {
    const x = i * dw;
    k.box(m.oak, x + 0.003, 0.02, 0.6, x + dw - 0.003, 2.28, 0.62);
    k.box(m.blackMatte, x + (i % 2 ? 0.03 : dw - 0.05), 0.9, 0.62, x + (i % 2 ? 0.05 : dw - 0.03), 1.4, 0.64);
  }
}

function desk(k: Kit, m: Materials) {
  k.box(m.oak, 0, 0.72, 0, 1.25, 0.75, 0.6);
  for (const x of [0.02, 1.2]) k.box(m.white, x, 0, 0.02, x + 0.03, 0.72, 0.58);
  k.box(m.black, 0.35, 0.75, 0.15, 0.7, 0.76, 0.4).box(m.black, 0.35, 0.76, 0.12, 0.7, 0.98, 0.135);
  k.cyl(m.blackMatte, 1.05, 0.75, 0.15, 0.06, 0.07, 0.02, 20).cyl(m.blackMatte, 1.05, 0.77, 0.15, 0.008, 0.008, 0.38, 8);
  k.lathe(m.lampShade, 1.05, 1.08, 0.24, [[0.09, 0], [0.04, 0.1]], 24);
  k.cyl(m.bulb, 1.05, 1.1, 0.24, 0.025, 0.025, 0.03, 12);
  // office chair
  const c = k.at(0.6, 0.95, N);
  c.cyl(m.blackMatte, 0, 0, 0, 0.26, 0.26, 0.03, 5).cyl(m.steel, 0, 0.03, 0, 0.02, 0.025, 0.4, 10);
  c.soft(m.sofa, -0.24, 0.43, -0.22, 0.24, 0.5, 0.24, 0.03).soft(m.sofa, -0.22, 0.52, -0.26, 0.22, 0.95, -0.2, 0.04, 0.1);
}

// ---------- bathroom and WC ----------
function vanity(k: Kit, m: Materials) {
  k.box(m.oak, 0, 0.3, 0, 1.2, 0.82, 0.48);
  k.box(m.walnut, 0.01, 0.31, 0.48, 0.595, 0.81, 0.485).box(m.walnut, 0.605, 0.31, 0.48, 1.19, 0.81, 0.485);
  k.box(m.ceramic, 0, 0.82, 0, 1.2, 0.84, 0.5);
  k.lathe(m.ceramic, 0.6, 0.84, 0.26, [[0, 0], [0.19, 0], [0.21, 0.12], [0.2, 0.13], [0.0, 0.03]], 40);
  k.cyl(m.steel, 0.6, 0.84, 0.05, 0.012, 0.014, 0.28, 12).box(m.steel, 0.59, 1.1, 0.05, 0.61, 1.12, 0.17);
  k.box(m.mirror, 0.15, 1.05, 0.0, 1.05, 1.85, 0.012);
  k.box(m.bulb, 0.25, 1.9, 0.0, 0.95, 1.93, 0.05);
}

function shower(k: Kit, m: Materials) {
  k.box(m.glass, 1.0, 0.02, 0, 1.01, 2.0, 1.0);
  k.box(m.steel, 0.98, 1.98, 0, 1.03, 2.0, 1.0);
  k.cyl(m.steel, 0.5, 2.0, 0.25, 0.012, 0.012, 0.3, 10).cyl(m.steel, 0.5, 1.98, 0.42, 0.13, 0.13, 0.015, 32);
  k.box(m.steel, 0.42, 1.0, 0.012, 0.58, 1.08, 0.04);
  k.box(m.white, 0.05, 0.002, 0.05, 0.95, 0.004, 1.4);
}

function towelRail(k: Kit, m: Materials) {
  for (const x of [0, 0.45]) k.cyl(m.white, x, 0.3, 0, 0.015, 0.015, 1.1, 10);
  for (let i = 0; i < 8; i++) k.box(m.white, 0, 0.35 + i * 0.13, -0.01, 0.45, 0.37 + i * 0.13, 0.01);
  k.soft(m.linen, 0.02, 1.0, 0.0, 0.43, 1.36, 0.05, 0.02);
}

function toilet(k: Kit, m: Materials) {
  k.box(m.white, -0.3, 0, 0, 0.3, 1.1, 0.16);
  k.box(m.steel, -0.1, 0.95, 0.16, 0.1, 1.08, 0.165);
  k.soft(m.ceramic, -0.18, 0.3, 0.16, 0.18, 0.42, 0.68, 0.12);
  k.soft(m.ceramic, -0.185, 0.42, 0.18, 0.185, 0.44, 0.7, 0.02);
}

function handBasin(k: Kit, m: Materials) {
  k.soft(m.ceramic, -0.2, 0.78, 0, 0.2, 0.9, 0.25, 0.04);
  k.cyl(m.steel, 0, 0.9, 0.04, 0.01, 0.012, 0.14, 10);
}

// ---------- entrance and balcony ----------
function bench(k: Kit, m: Materials) {
  k.box(m.oak, 0, 0.42, 0, 0.95, 0.46, 0.38);
  for (const x of [0.03, 0.88]) k.box(m.oak, x, 0, 0.03, x + 0.04, 0.42, 0.35);
  for (let i = 0; i < 4; i++) k.cyl(m.brass, 0.15 + i * 0.22, 1.65, 0.02, 0.012, 0.012, 0.08, 8);
  k.soft(m.armchair, 0.12, 1.2, 0.03, 0.36, 1.66, 0.1, 0.04);
}

function bistro(k: Kit, m: Materials) {
  k.cyl(m.blackMatte, 0, 0, 0, 0.2, 0.22, 0.02, 24).cyl(m.blackMatte, 0, 0.02, 0, 0.02, 0.02, 0.7, 8).cyl(m.blackMatte, 0, 0.72, 0, 0.32, 0.32, 0.02, 32);
  for (const a of [0.4, Math.PI + 0.4]) {
    const c = k.at(Math.cos(a) * 0.55, Math.sin(a) * 0.55, -a + Math.PI / 2);
    for (const [x, z] of [[-0.18, -0.16], [0.18, -0.16], [-0.18, 0.18], [0.18, 0.18]] as const) c.cyl(m.blackMatte, x, 0, z, 0.01, 0.01, 0.45, 6);
    c.box(m.blackMatte, -0.21, 0.45, -0.2, 0.21, 0.47, 0.22).box(m.blackMatte, -0.21, 0.47, 0.2, 0.21, 0.85, 0.22);
  }
}

/** Where the lamps are, for the night lights: position and how far they reach. */
export const LAMPS: { at: [number, number, number]; power: number; reach: number }[] = [
  { at: [1.6, 1.62, 5.75], power: 1.0, reach: 6 }, // dining pendant
  { at: [1.75, 1.75, 3.9], power: 0.8, reach: 5 }, // above the island
  { at: [3.4, 1.4, 4.75], power: 0.8, reach: 5 }, // floor lamp by the sofa
  { at: [5.5, 2.3, 6.0], power: 0.5, reach: 6 }, // living room ceiling
  { at: [7.1, 0.75, 0.26], power: 0.45, reach: 4 }, // bedside lamps, bedroom 1
  { at: [9.35, 0.75, 0.26], power: 0.45, reach: 4 },
  { at: [9.38, 0.75, 4.0], power: 0.45, reach: 4 }, // bedroom 2
  { at: [7.55, 1.1, 6.91], power: 0.4, reach: 3.5 }, // desk lamp
  { at: [3.65, 2.3, 1.3], power: 0.45, reach: 5 }, // entrance
  { at: [0.85, 1.9, 2.4], power: 0.45, reach: 4 }, // bathroom mirror
];

/**
 * The furniture, and apart from it what hangs on the walls above the dollhouse's cut (curtains,
 * pictures): the dollhouse hides that part, which would otherwise float over the cut walls.
 */
export function buildFurniture(m: Materials): THREE.Group {
  const batch = new Batch();
  const k = new Kit(batch);
  const hung = new Batch({ cast: false });
  const h = new Kit(hung);
  // séjour: kitchen along the north wall, island, dining by the west window, living area by the bay
  kitchen(k.at(0, 2.65, S), m);
  island(k.at(0.85, 3.45, S), m);
  pendant(k.at(1.75, 3.9), m, 1.75);
  diningSet(k.at(0.8, 5.3, S), m);
  pendant(k.at(1.6, 5.75), m, 1.62);
  rug(k.at(3.85, 4.75), m, 2.15, 2.4);
  sofa(k.at(3.2, 7.12, E), m, 2.2);
  coffeeTable(k.at(4.45, 6.4, E), m);
  armchair(k.at(4.55, 4.35, S + 0.3), m);
  tvUnit(k.at(6.15, 5.15, W), m);
  floorLamp(k.at(3.4, 4.75), m);
  bookshelf(k.at(0, 7.1, E), m, 1.0, 2.0);
  pottedPlant(k.at(4.55, 6.95), m, 1.5, 4);
  curtains(h.at(4.1, 7.2, N), m, 3.2);
  curtains(h.at(0, 5.8, E), m, 1.2);
  frame(h.at(5.05, 2.65, S), m.art1, m, 0.9, 0.65, 1.35);
  // bedroom 1
  bed(k.at(8.22, 0, S), m, 1.6, 2.0);
  nightstand(k.at(6.88, 0.05, S), m);
  nightstand(k.at(9.13, 0.05, S), m);
  wardrobe(k.at(6.25, 0.1 + 2.0, E), m, 2.0);
  rug(k.at(7.2, 1.0), m, 2.0, 2.4);
  frame(h.at(8.22, 0.0, S), m.art2, m, 1.0, 0.6, 1.3);
  curtains(h.at(9.6, 1.15, W), m, 1.4);
  pottedPlant(k.at(9.25, 3.3), m, 1.1, 11);
  // bedroom 2
  bed(k.at(8.3, 3.75, S), m, 1.4, 1.9);
  nightstand(k.at(9.12, 3.8, S), m);
  desk(k.at(8.6, 7.15, N), m);
  bookshelf(k.at(6.25, 5.0 + 1.0, E), m, 1.0, 1.6);
  curtains(h.at(8.65, 7.2, N), m, 1.4);
  curtains(h.at(9.6, 4.9, W), m, 1.2);
  // bathroom
  shower(k.at(0, 0, S), m);
  vanity(k.at(1.45, 2.55, N), m);
  towelRail(k.at(2.34, 0.25, W), m);
  // WC
  toilet(k.at(6.15, 0.7, W), m);
  handBasin(k.at(5.5, 0.0, S), m);
  // entrance
  bench(k.at(2.45, 1.15, E), m);
  // balcony
  bistro(k.at(4.9, 8.2), m);
  for (let i = 0; i < 3; i++) pottedPlant(k.at(1.0 + i * 0.7, 8.75), m, 0.8, 20 + i);
  const group = batch.build('furniture');
  group.add(hung.build('wall-decor'));
  return group;
}
