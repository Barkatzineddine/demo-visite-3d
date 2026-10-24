// The building: floors, ceilings, walls around their openings (full height for the walk, cut at
// CUT for the dollhouse), skirting boards, windows, doors, the balcony and what is seen outside.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { axis, BALCONY, BOUNDS, CEILING, EXTERIOR, isHorizontal, ROOMS, roomInterior, wallAcross, WALLS, type Opening, type RoomId, type Wall } from '../domain/apartment';
import { Batch, boxUV, place, slab } from './geometry';
import type { Materials } from './materials';

/** Height at which the dollhouse cuts the walls. */
export const CUT = 1.15;

const horizontal = isHorizontal;
const across = wallAcross;

/** A box spanning [s0, s1] along the wall, [t0, t1] across it and [y0, y1] in height. */
function wallBox(w: Wall, s0: number, s1: number, y0: number, y1: number, t: [number, number]): THREE.BufferGeometry {
  // exterior walls also cover the corners
  const ext = w.exterior ? EXTERIOR : 0;
  const a0 = s0 === 0 ? -ext : s0;
  const a1 = s1 === axis(w).length ? s1 + ext : s1;
  if (horizontal(w)) return boxUV(w.a[0] + a0, y0, t[0], w.a[0] + a1, y1, t[1]);
  return boxUV(t[0], y0, w.a[1] + a0, t[1], y1, w.a[1] + a1);
}

/** The solid pieces of a wall up to `top`: full-height spans, and what lies under sills and over lintels. */
function wallPieces(w: Wall, top: number): [number, number, number, number][] {
  const { length } = axis(w);
  const pieces: [number, number, number, number][] = [];
  let from = 0;
  for (const o of [...w.openings].sort((p, q) => p.at - q.at)) {
    if (o.at > from) pieces.push([from, o.at, 0, top]);
    if (o.sill > 0) pieces.push([o.at, o.at + o.width, 0, Math.min(o.sill, top)]);
    if (o.sill + o.height < top) pieces.push([o.at, o.at + o.width, o.sill + o.height, top]);
    from = o.at + o.width;
  }
  if (from < length) pieces.push([from, length, 0, top]);
  return pieces.filter(([s0, s1, y0, y1]) => s1 > s0 && y1 > y0);
}

export function buildWalls(m: Materials, top: number): THREE.Group {
  const batch = new Batch();
  for (const w of WALLS) {
    const [t0, t1] = across(w);
    for (const [s0, s1, y0, y1] of wallPieces(w, top)) {
      if (w.exterior) {
        // a painted inner skin and a rendered outer body
        const inner = t0 === (horizontal(w) ? w.a[1] : w.a[0]);
        const skin: [number, number] = inner ? [t0, t0 + 0.02] : [t1 - 0.02, t1];
        const body: [number, number] = inner ? [t0 + 0.02, t1] : [t0, t1 - 0.02];
        batch.add(wallBox(w, s0, s1, y0, y1, skin), m.wall).add(wallBox(w, s0, s1, y0, y1, body), m.render);
      } else batch.add(wallBox(w, s0, s1, y0, y1, [t0, t1]), m.wall);
      if (top < CEILING && y1 === top) batch.add(wallBox(w, s0, s1, top, top + 0.005, [t0, t1]), m.wallCap);
    }
    for (const o of w.openings) {
      // reveals: the wall's thickness inside each opening, painted
      if (o.kind === 'window' || o.kind === 'bay') addWindow(batch, m, w, o, top, [t0, t1]);
    }
  }
  return batch.build(top < CEILING ? 'walls-cut' : 'walls');
}

function addWindow(batch: Batch, m: Materials, w: Wall, o: Opening, top: number, [t0, t1]: [number, number]) {
  const mid = (t0 + t1) / 2;
  const frameT: [number, number] = [mid - 0.035, mid + 0.035];
  const f = 0.055;
  const y0 = o.sill;
  const y1 = Math.min(o.sill + o.height, top);
  if (y1 <= y0) return;
  const bar = (s0: number, s1: number, b0: number, b1: number) => batch.add(wallBox({ ...w, exterior: false }, o.at + s0, o.at + s1, b0, b1, frameT), m.frame);
  bar(0, f, y0, y1);
  bar(o.width - f, o.width, y0, y1);
  bar(0, o.width, y0, y0 + f);
  if (o.sill + o.height <= top) bar(0, o.width, y1 - f, y1);
  // two leaves (or two sliding panels for the bay)
  if (o.width > 0.8) bar(o.width / 2 - f / 2, o.width / 2 + f / 2, y0, y1);
  batch.add(wallBox({ ...w, exterior: false }, o.at + f, o.at + o.width - f, y0 + f, y1 - (o.sill + o.height <= top ? f : 0), [mid - 0.004, mid + 0.004]), m.glass);
  // stone sill inside, under raised windows
  if (o.sill > 0 && o.sill <= top) {
    const inner: [number, number] = horizontal(w) ? (w.a[1] === BOUNDS.z0 ? [t1 - 0.01, t1 + 0.04] : [t0 - 0.04, t0 + 0.01]) : (w.a[0] === BOUNDS.x0 ? [t1 - 0.01, t1 + 0.04] : [t0 - 0.04, t0 + 0.01]);
    batch.add(wallBox({ ...w, exterior: false }, o.at - 0.03, o.at + o.width + 0.03, o.sill - 0.03, o.sill, w.exterior ? inner : [t0 - 0.03, t1 + 0.03]), m.white);
  }
}

/** Which side of a wall a room lies on (+1 towards growing z or x). */
function sideOf(w: Wall, room: RoomId): number {
  const r = ROOMS.find((x) => x.id === room);
  if (!r) return 1;
  const c = horizontal(w) ? w.a[1] : w.a[0];
  const centre = horizontal(w) ? (r.z0 + r.z1) / 2 : (r.x0 + r.x1) / 2;
  return centre > c ? 1 : -1;
}

/** Door leaves (open), the front door (closed), casings, thresholds and the closet's sliding doors. */
export function buildDoors(m: Materials, top: number): THREE.Group {
  const batch = new Batch();
  for (const w of WALLS) {
    const [t0, t1] = across(w);
    const { dir, at } = axis(w);
    for (const o of w.openings) {
      if (o.sill > 0 || o.kind === 'window') continue;
      // threshold: the floor through the wall
      const p0 = at(o.at);
      const p1 = at(o.at + o.width);
      const th = horizontal(w) ? slab(Math.min(p0[0], p1[0]), t0, Math.max(p0[0], p1[0]), t1, 0.002) : slab(t0, Math.min(p0[1], p1[1]), t1, Math.max(p0[1], p1[1]), 0.002);
      batch.add(th, o.kind === 'bay' ? m.frame : m.floorMain);
      if (o.kind === 'bay') continue;
      // casings on both faces
      const casing = (s0: number, s1: number, y0: number, y1: number) => {
        if (y0 >= top) return;
        batch.add(wallBox({ ...w, exterior: false }, s0, s1, y0, Math.min(y1, top), [t0 - 0.012, t0]), m.skirting);
        batch.add(wallBox({ ...w, exterior: false }, s0, s1, y0, Math.min(y1, top), [t1, t1 + 0.012]), m.skirting);
      };
      casing(o.at - 0.07, o.at, 0, o.height + 0.07);
      casing(o.at + o.width, o.at + o.width + 0.07, 0, o.height + 0.07);
      casing(o.at - 0.07, o.at + o.width + 0.07, o.height, o.height + 0.07);
      const h = Math.min(o.height - 0.01, top);
      if (o.kind === 'entry') {
        // the front door, closed, flush with the inner face
        const leaf = horizontal(w) ? boxUV(p0[0] + 0.01, 0.01, -0.12, p1[0] - 0.01, h, -0.07) : boxUV(-0.12, 0.01, p0[1], -0.07, h, p1[1]);
        batch.add(leaf, m.entryDoor);
        batch.add(place(new THREE.CylinderGeometry(0.012, 0.012, 0.13, 12), p1[0] - 0.12, 1.02, -0.05, 0, 0, Math.PI / 2), m.handle);
        continue;
      }
      if (o.kind === 'closet') {
        // two sliding white panels, slightly offset
        const half = o.width / 2;
        for (const [k, off] of [[0, -0.02], [1, 0.02]] as const) {
          const s0 = o.at + k * half - 0.01;
          batch.add(wallBox({ ...w, exterior: false }, s0, s0 + half + 0.02, 0.01, h, [(t0 + t1) / 2 + off - 0.012, (t0 + t1) / 2 + off + 0.012]), m.door);
        }
        continue;
      }
      if (o.kind !== 'door' || !o.into) continue;
      // the leaf stands open, almost against the wall, hinged on its side
      const side = sideOf(w, o.into);
      const hinge = o.flip ? o.at + o.width : o.at;
      const [hx, hz] = at(hinge);
      const angle = 1.45;
      const leaf = new THREE.Group();
      const g = boxUV(0, 0.01, -0.02, o.width - 0.02, h, 0.02);
      const leafMesh = new THREE.Mesh(g, m.door);
      leaf.add(leafMesh);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.018, 0.018), m.handle);
      handle.position.set(o.width - 0.12, 1.02, 0.045);
      const handle2 = handle.clone();
      handle2.position.z = -0.045;
      leaf.add(handle, handle2);
      // orient: along the wall towards the opening, then swung into the room
      const towards = o.flip ? -1 : 1;
      const base = Math.atan2(-dir[1] * towards, dir[0] * towards);
      const swing = side * (horizontal(w) ? -1 : 1) * towards * angle;
      leaf.position.set(hx, 0, hz);
      leaf.rotation.y = base + swing;
      batch.addObject(leaf);
    }
  }
  return batch.build('doors');
}

/** One floor mesh per room (kept apart: clicking a floor tells which room it is). */
export function buildFloors(m: Materials): THREE.Mesh[] {
  const floors = ROOMS.map((r) => {
    const i = roomInterior(r);
    const mesh = new THREE.Mesh(slab(i.x0, i.z0, i.x1, i.z1, 0), r.floor === 'main' ? m.floorMain : m.floorTiles);
    mesh.receiveShadow = true;
    mesh.userData.room = r.id;
    mesh.name = `floor-${r.id}`;
    return mesh;
  });
  const balcony = new THREE.Mesh(slab(BALCONY.x0, BALCONY.z0 - 0.01, BALCONY.x1, BALCONY.z1, -0.03), m.deck);
  balcony.receiveShadow = true;
  balcony.userData.room = 'sejour';
  balcony.name = 'floor-balcon';
  return [...floors, balcony];
}

export function buildCeilings(m: Materials): THREE.Group {
  const batch = new Batch({ cast: false, receive: false });
  for (const r of ROOMS) {
    const i = roomInterior(r);
    batch.add(slab(i.x0, i.z0, i.x1, i.z1, CEILING, true), m.ceiling);
  }
  // the slab above, so no light leaks in through the top of the walls
  batch.add(boxUV(BOUNDS.x0 - EXTERIOR, CEILING, BOUNDS.z0 - EXTERIOR, BOUNDS.x1 + EXTERIOR, CEILING + 0.25, BOUNDS.z1 + EXTERIOR), m.render);
  // flush ceiling lights: lit at dusk and night where a lamp shines (séjour, entrance), off elsewhere
  const flush = (x: number, z: number, r: number, lit: boolean) => {
    batch.add(new THREE.LatheGeometry([new THREE.Vector2(0, -0.05), new THREE.Vector2(r * 0.8, -0.045), new THREE.Vector2(r, -0.02), new THREE.Vector2(r, 0)], 40).translate(x, CEILING, z), lit ? m.lampShade : m.ceramic);
  };
  flush(5.5, 6.0, 0.22, true);
  flush(3.65, 1.3, 0.16, true);
  flush(7.9, 1.85, 0.2, false);
  flush(7.9, 5.45, 0.2, false);
  flush(5.55, 0.7, 0.12, false);
  const g = batch.build('ceilings');
  g.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true; });
  return g;
}

/** Panel radiators under the windows (none under the bay, nor behind the desk in bedroom 2). */
export function buildRadiators(m: Materials): THREE.Group {
  const batch = new Batch();
  const radiator = (wall: string, from: number, to: number) => {
    const w = WALLS.find((x) => x.id === wall);
    if (!w) return;
    const c = horizontal(w) ? w.a[1] : w.a[0];
    const inwards = across(w)[0] < c ? 1 : -1;
    const t: [number, number] = inwards > 0 ? [c + 0.035, c + 0.105] : [c - 0.105, c - 0.035];
    const inner = { ...w, exterior: false };
    batch.add(wallBox(inner, from, to, 0.15, 0.7, t), m.white);
    // vertical channels on the face, the look of a steel panel radiator
    const face = inwards > 0 ? t[1] : t[0];
    for (let s = from + 0.03; s < to - 0.02; s += 0.05) batch.add(wallBox(inner, s, s + 0.012, 0.17, 0.68, inwards > 0 ? [face, face + 0.006] : [face - 0.006, face]), m.skirting);
    // the valve
    batch.add(wallBox(inner, to - 0.04, to + 0.02, 0.2, 0.3, inwards > 0 ? [c + 0.04, c + 0.09] : [c - 0.09, c - 0.04]), m.steel);
  };
  radiator('ouest', 4.75, 5.65);
  radiator('sud', 4.7, 5.5);
  radiator('est', 1.35, 2.35);
  radiator('est', 5.05, 5.95);
  return batch.build('radiators');
}

/** Skirting boards along every room, interrupted at doors and passages. */
export function buildSkirting(m: Materials): THREE.Group {
  const batch = new Batch({ cast: false });
  const gaps = WALLS.flatMap((w) => w.openings.filter((o) => o.sill === 0).map((o) => {
    const { at } = axis(w);
    const p0 = at(o.at);
    const p1 = at(o.at + o.width);
    return { horizontal: horizontal(w), c: horizontal(w) ? w.a[1] : w.a[0], from: Math.min(horizontal(w) ? p0[0] : p0[1], horizontal(w) ? p1[0] : p1[1]), to: Math.max(horizontal(w) ? p0[0] : p0[1], horizontal(w) ? p1[0] : p1[1]) };
  }));
  const run = (isH: boolean, c: number, from: number, to: number, inward: number) => {
    const cuts = gaps.filter((g) => g.horizontal === isH && Math.abs(g.c - c) < 0.11).sort((a, b) => a.from - b.from);
    let s = from;
    const pieces: [number, number][] = [];
    for (const g of cuts) { if (g.to <= s || g.from >= to) continue; if (g.from > s) pieces.push([s, g.from]); s = Math.max(s, g.to); }
    if (s < to) pieces.push([s, to]);
    for (const [a, b] of pieces) {
      const t: [number, number] = inward > 0 ? [c, c + 0.012] : [c - 0.012, c];
      batch.add(isH ? boxUV(a, 0, t[0], b, 0.08, t[1]) : boxUV(t[0], 0, a, t[1], 0.08, b), m.skirting);
    }
  };
  for (const r of ROOMS) {
    if (r.floor === 'tiles') continue;
    const i = roomInterior(r);
    run(true, i.z0, i.x0, i.x1, 1);
    run(true, i.z1, i.x0, i.x1, -1);
    run(false, i.x0, i.z0, i.z1, 1);
    run(false, i.x1, i.z0, i.z1, -1);
  }
  return batch.build('skirting');
}

/** Zellige on the shower's two walls, up to 2.1 m. */
export function buildTiling(m: Materials, top: number): THREE.Group {
  const batch = new Batch({ cast: false });
  const y = Math.min(2.1, top);
  batch.add(boxUV(0, 0, 0, 1.0, y, 0.008), m.zellige); // north wall of the shower
  batch.add(boxUV(0, 0, 0, 0.008, y, 1.45), m.zellige); // west wall
  return batch.build(top < CEILING ? 'tiling-cut' : 'tiling');
}

export function buildBalcony(m: Materials): THREE.Group {
  const batch = new Batch();
  const b = BALCONY;
  batch.add(boxUV(b.x0, -0.25, b.z0 - 0.02, b.x1, -0.03, b.z1), m.render);
  const rail = (x0: number, z0: number, x1: number, z1: number) => {
    batch.add(boxUV(x0, -0.03, z0, x1, 1.0, z1), m.railing);
    batch.add(boxUV(x0 - 0.01, 1.0, z0 - 0.01, x1 + 0.01, 1.04, z1 + 0.01), m.frame);
  };
  rail(b.x0, b.z1 - 0.02, b.x1, b.z1);
  rail(b.x0, b.z0, b.x0 + 0.02, b.z1);
  rail(b.x1 - 0.02, b.z0, b.x1, b.z1);
  return batch.build('balcony');
}

/** The building's floor slab under the apartment: a base for the dollhouse. */
export function buildBase(m: Materials): THREE.Mesh {
  const mesh = new THREE.Mesh(boxUV(BOUNDS.x0 - EXTERIOR, -0.3, BOUNDS.z0 - EXTERIOR, BOUNDS.x1 + EXTERIOR, -0.002, BOUNDS.z1 + EXTERIOR), m.render);
  mesh.receiveShadow = true;
  return mesh;
}

/** A tree crown: an icosphere pushed in and out by a smooth noise, so it reads as foliage. */
function crown(radius: number, seed: number): THREE.BufferGeometry {
  const g = mergeVertices(new THREE.IcosahedronGeometry(radius, 3));
  const p = g.getAttribute('position');
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = Math.sin(v.x * 2.3 + seed) * Math.sin(v.y * 2.9 + seed * 0.7) * Math.sin(v.z * 2.1 + seed * 1.3) + 0.35 * Math.sin(v.x * 6.1 + v.z * 5.3 + seed);
    v.multiplyScalar(1 + 0.16 * n);
    v.y *= 0.85;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

/** The street seen from the windows: the ground three floors down, buildings across, trees. */
export function buildSurroundings(m: Materials): THREE.Group {
  const batch = new Batch({ cast: false, receive: false });
  const ground = -9;
  batch.add(slab(-60, -60, 70, 70, ground), m.ground);
  const blocks: [number, number, number, number, number][] = [
    [-30, 30, 40, 44, 20], [-40, -44, 50, -30, 23], [36, -20, 52, 30, 18], [-50, -24, -28, 20, 21],
  ];
  for (const [x0, z0, x1, z1, h] of blocks) batch.add(boxUV(x0, ground, z0, x1, ground + h, z1), m.facade);
  // our own building's facade around the apartment
  batch.add(boxUV(-6, ground, -6.5, 16, -0.31, 9.0), m.render);
  batch.add(boxUV(-6, CEILING + 0.25, -6.5, 16, 15, 7.4), m.render);
  const r = (seed: number) => { const x = Math.sin(seed * 12.9898) * 43758.5453; return x - Math.floor(x); };
  for (let i = 0; i < 14; i++) {
    const x = -14 + i * 2.6 + r(i) * 1.2;
    const z = 15 + r(i + 7) * 4;
    const s = 2.2 + r(i + 3) * 1.4;
    batch.add(place(new THREE.CylinderGeometry(0.15, 0.2, 5, 8), x, ground + 2.5, z), m.trunk);
    // a crown of a few lumpy blobs, in two greens
    for (let j = 0; j < 3; j++) {
      const b = s * (0.75 - j * 0.12);
      batch.add(place(crown(b, i * 3 + j), x + (r(i * 5 + j) - 0.5) * s, ground + 5.5 + s * 0.5 + j * s * 0.45, z + (r(i * 7 + j) - 0.5) * s), j % 2 ? m.tree2 : m.tree);
    }
  }
  return batch.build('surroundings');
}
