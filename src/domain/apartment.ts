// The apartment, described once: rooms, walls with their doors and windows, the balcony. The 3D
// scene, the 2D plan, the Carrez areas and the walk mode's collisions all read this description.
// Metres; x runs west to east, z north to south (the balcony is on the south side), y is up.

export const CEILING = 2.5;
export const EXTERIOR = 0.2;
export const PARTITION = 0.1;
export const EYE = 1.6;
/** Interior bounds of the apartment, inside the exterior walls. */
export const BOUNDS = { x0: 0, z0: 0, x1: 9.6, z1: 7.2 } as const;

export const ROOM_IDS = ['sejour', 'chambre1', 'chambre2', 'sdb', 'entree', 'wc', 'placard'] as const;
export type RoomId = (typeof ROOM_IDS)[number];
export type FloorKind = 'main' | 'tiles';

export interface Rect { x0: number; z0: number; x1: number; z1: number }

export interface Room extends Rect {
  id: RoomId;
  floor: FloorKind;
  /** Where the visitor stands when flying into the room, and what they look at. */
  eye: [number, number];
  look: [number, number, number];
}

export const ROOMS: Room[] = [
  { id: 'sejour', x0: 0, z0: 2.6, x1: 6.2, z1: 7.2, floor: 'main', eye: [5.55, 3.2], look: [1.4, 1.0, 6.4] },
  { id: 'chambre1', x0: 6.2, z0: 0, x1: 9.6, z1: 3.7, floor: 'main', eye: [6.7, 3.2], look: [9.2, 0.9, 0.7] },
  { id: 'chambre2', x0: 6.2, z0: 3.7, x1: 9.6, z1: 7.2, floor: 'main', eye: [6.7, 4.25], look: [9.1, 0.9, 6.8] },
  { id: 'sdb', x0: 0, z0: 0, x1: 2.4, z1: 2.6, floor: 'tiles', eye: [2.05, 0.45], look: [0.5, 1.0, 2.1] },
  { id: 'entree', x0: 2.4, z0: 0, x1: 4.9, z1: 2.6, floor: 'main', eye: [3.35, 0.45], look: [3.75, 1.2, 5.5] },
  { id: 'wc', x0: 4.9, z0: 0, x1: 6.2, z1: 1.4, floor: 'tiles', eye: [5.25, 1.1], look: [5.9, 0.6, 0.2] },
  { id: 'placard', x0: 4.9, z0: 1.4, x1: 6.2, z1: 2.6, floor: 'main', eye: [4.3, 2.0], look: [5.6, 1.0, 2.0] },
];

export type OpeningKind = 'entry' | 'door' | 'passage' | 'window' | 'bay' | 'closet';
export interface Opening {
  kind: OpeningKind;
  /** Distance from the wall's start to the opening's near edge, and its width. */
  at: number;
  width: number;
  sill: number;
  height: number;
  /** Doors: the room the leaf swings into; its hinge is at the near edge, or the far one when flipped. */
  into?: RoomId;
  flip?: boolean;
}

export interface Wall {
  id: string;
  a: [number, number];
  b: [number, number];
  thickness: number;
  exterior: boolean;
  openings: Opening[];
}

const door = (at: number, into: RoomId, flip = false): Opening => ({ kind: 'door', at, width: 0.8, sill: 0, height: 2.04, into, flip });
const pane = (at: number, width: number, sill = 0.9, height = 1.35): Opening => ({ kind: 'window', at, width, sill, height });

// Exterior walls run along the interior bounds; their thickness is drawn outwards.
export const WALLS: Wall[] = [
  { id: 'nord', a: [0, 0], b: [9.6, 0], thickness: EXTERIOR, exterior: true, openings: [pane(0.85, 0.7, 1.45, 0.7), { kind: 'entry', at: 2.9, width: 0.9, sill: 0, height: 2.1, into: 'entree' }] },
  { id: 'sud', a: [0, 7.2], b: [9.6, 7.2], thickness: EXTERIOR, exterior: true, openings: [{ kind: 'bay', at: 0.9, width: 3.2, sill: 0, height: 2.15 }, pane(4.6, 1.0), pane(7.25, 1.4)] },
  { id: 'ouest', a: [0, 0], b: [0, 7.2], thickness: EXTERIOR, exterior: true, openings: [pane(4.6, 1.2)] },
  { id: 'est', a: [9.6, 0], b: [9.6, 7.2], thickness: EXTERIOR, exterior: true, openings: [pane(1.15, 1.4), pane(4.9, 1.2)] },
  { id: 'nord-sejour', a: [0, 2.6], b: [6.2, 2.6], thickness: PARTITION, exterior: false, openings: [{ kind: 'passage', at: 3.1, width: 1.3, sill: 0, height: 2.2 }] },
  { id: 'sdb-entree', a: [2.4, 0], b: [2.4, 2.6], thickness: PARTITION, exterior: false, openings: [door(1.25, 'sdb', true)] },
  { id: 'entree-wc', a: [4.9, 0], b: [4.9, 2.6], thickness: PARTITION, exterior: false, openings: [door(0.35, 'wc'), { kind: 'closet', at: 1.5, width: 1.0, sill: 0, height: 2.2 }] },
  { id: 'wc-placard', a: [4.9, 1.4], b: [6.2, 1.4], thickness: PARTITION, exterior: false, openings: [] },
  { id: 'jour-nuit', a: [6.2, 0], b: [6.2, 7.2], thickness: PARTITION, exterior: false, openings: [door(2.78, 'chambre1', true), door(3.95, 'chambre2')] },
  { id: 'chambres', a: [6.2, 3.7], b: [9.6, 3.7], thickness: PARTITION, exterior: false, openings: [] },
];

/** The balcony, outside the south wall: not counted in the Carrez area. */
export const BALCONY: Rect = { x0: 0.5, z0: BOUNDS.z1 + EXTERIOR, x1: 5.9, z1: BOUNDS.z1 + EXTERIOR + 1.6 };
/** The way through the bay window to the balcony, reaching into the room and onto the balcony. */
const BAY: Rect = { x0: 0.9, z0: BOUNDS.z1 - 0.5, x1: 4.1, z1: BOUNDS.z1 + EXTERIOR + 0.5 };

const onBounds = (v: number, edge: number) => Math.abs(v - edge) < 1e-9;

/** The interior rectangle of a room, inside its walls: half a partition in, nothing of the exterior walls. */
export function roomInterior(r: Rect): Rect {
  const h = PARTITION / 2;
  return {
    x0: r.x0 + (onBounds(r.x0, BOUNDS.x0) ? 0 : h), x1: r.x1 - (onBounds(r.x1, BOUNDS.x1) ? 0 : h),
    z0: r.z0 + (onBounds(r.z0, BOUNDS.z0) ? 0 : h), z1: r.z1 - (onBounds(r.z1, BOUNDS.z1) ? 0 : h),
  };
}

export function roomArea(r: Room): number {
  const i = roomInterior(r);
  return Math.round((i.x1 - i.x0) * (i.z1 - i.z0) * 100) / 100;
}

/** Loi Carrez: the usable floor area of the rooms (all above 1.80 m here); balconies are excluded. */
export const carrez = () => Math.round(ROOMS.reduce((s, r) => s + roomArea(r), 0) * 100) / 100;
export const balconyArea = () => Math.round((BALCONY.x1 - BALCONY.x0) * (BALCONY.z1 - BALCONY.z0) * 100) / 100;

export function roomAt(x: number, z: number): Room | undefined {
  return ROOMS.find((r) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1);
}

/** A wall's axis direction, length and a point at a distance along it. */
export function axis(w: Wall) {
  const length = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
  const dir: [number, number] = [(w.b[0] - w.a[0]) / length, (w.b[1] - w.a[1]) / length];
  const at = (d: number): [number, number] => [w.a[0] + dir[0] * d, w.a[1] + dir[1] * d];
  return { length, dir, at };
}

export const isHorizontal = (w: Wall) => w.a[1] === w.b[1];

/** The wall's extent across its axis: exterior walls grow outwards, partitions are centred. */
export function wallAcross(w: Wall): [number, number] {
  const c = isHorizontal(w) ? w.a[1] : w.a[0];
  if (!w.exterior) return [c - PARTITION / 2, c + PARTITION / 2];
  const outwards = (isHorizontal(w) && c === BOUNDS.z0) || (!isHorizontal(w) && c === BOUNDS.x0) ? -1 : 1;
  return outwards < 0 ? [c - EXTERIOR, c] : [c, c + EXTERIOR];
}

export interface Segment { a: [number, number]; b: [number, number] }

/** Wall pieces one cannot walk through, as segments on the wall axes. */
export function solidSegments(): Segment[] {
  const segments: Segment[] = [];
  for (const w of WALLS) {
    const { length, at } = axis(w);
    let from = 0;
    const through = w.openings.filter((o) => o.kind === 'door' || o.kind === 'passage' || o.kind === 'bay').sort((p, q) => p.at - q.at);
    for (const o of through) {
      if (o.at > from) segments.push({ a: at(from), b: at(o.at) });
      from = o.at + o.width;
    }
    if (from < length) segments.push({ a: at(from), b: at(length) });
  }
  return segments;
}

/** Margins: how close to each side of a region the walker's centre may get (x, then z). */
type Region = [Rect, number, number];
const inside = ([r, mx, mz]: Region, x: number, z: number) => x >= r.x0 + mx && x <= r.x1 - mx && z >= r.z0 + mz && z <= r.z1 - mz;
const clampTo = ([r, mx, mz]: Region, x: number, z: number): [number, number] => [Math.min(r.x1 - mx, Math.max(r.x0 + mx, x)), Math.min(r.z1 - mz, Math.max(r.z0 + mz, z))];

/**
 * Moves a walker (a circle of `radius` on the floor) from `from` by `step`, sliding along walls
 * instead of stopping dead, and never leaving the apartment or its balcony.
 */
export function walk(from: [number, number], step: [number, number], radius = 0.25, segments = solidSegments()): [number, number] {
  let x = from[0] + step[0];
  let z = from[1] + step[1];
  const min = radius + PARTITION / 2;
  for (let pass = 0; pass < 3; pass++) {
    for (const { a: [ax, az], b: [bx, bz] } of segments) {
      const vx = bx - ax;
      const vz = bz - az;
      const len2 = vx * vx + vz * vz;
      const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / len2));
      const dx = x - (ax + vx * t);
      const dz = z - (az + vz * t);
      const dist = Math.hypot(dx, dz);
      if (dist < min && dist > 1e-9) { x = ax + vx * t + (dx / dist) * min; z = az + vz * t + (dz / dist) * min; }
    }
  }
  const regions: Region[] = [[BOUNDS, radius, radius], [BAY, radius, 0], [BALCONY, radius, radius]];
  if (regions.some((r) => inside(r, x, z))) return [x, z];
  // outside every region: back to the nearest allowed point
  const candidates = regions.map((r) => clampTo(r, x, z));
  return candidates.reduce((best, c) => (Math.hypot(c[0] - x, c[1] - z) < Math.hypot(best[0] - x, best[1] - z) ? c : best));
}
