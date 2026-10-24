// The 2D floor plan, drawn from the same walls and rooms as the 3D model: wall pieces between the
// openings, windows, door swings and room rectangles with their areas. Plan coordinates are the
// model's (x east, z south) in metres, so north is at the top. Used by the SVG plan and the PDF.
import { axis, BALCONY, BOUNDS, EXTERIOR, isHorizontal, ROOMS, roomArea, roomInterior, wallAcross, WALLS, type Rect, type RoomId, type Wall } from './apartment';

export interface Box { x: number; y: number; w: number; h: number }
export interface DoorSwing { hinge: [number, number]; open: [number, number]; closed: [number, number]; radius: number; sweep: 0 | 1 }
/** Room labels nudged off the door swings in the small rooms (metres). */
export const LABEL_OFFSET: Partial<Record<RoomId, [number, number]>> = { sdb: [-0.22, -0.25], wc: [0.32, 0.22] };

export interface PlanRoom { id: RoomId; box: Box; area: number; width: number; depth: number }

/** A rectangle spanning [s0, s1] along the wall and [t0, t1] across it. */
function along(w: Wall, s0: number, s1: number, [t0, t1]: [number, number]): Box {
  if (isHorizontal(w)) return { x: w.a[0] + s0, y: t0, w: s1 - s0, h: t1 - t0 };
  return { x: t0, y: w.a[1] + s0, w: t1 - t0, h: s1 - s0 };
}

const box = (r: Rect): Box => ({ x: r.x0, y: r.z0, w: r.x1 - r.x0, h: r.z1 - r.z0 });

export function planGeometry() {
  const walls: Box[] = [];
  const windows: Box[] = [];
  const doors: DoorSwing[] = [];
  const sliders: Box[] = [];
  for (const w of WALLS) {
    const { length, at } = axis(w);
    const t = wallAcross(w);
    const ext = w.exterior ? EXTERIOR : 0;
    let from = -ext;
    for (const o of [...w.openings].sort((a, b) => a.at - b.at)) {
      if (o.at > from) walls.push(along(w, from, o.at, t));
      from = o.at + o.width;
      if (o.kind === 'window' || o.kind === 'bay') windows.push(along(w, o.at, o.at + o.width, t));
      if (o.kind === 'closet') {
        const mid = (t[0] + t[1]) / 2;
        sliders.push(along(w, o.at, o.at + o.width / 2 + 0.02, [mid - 0.035, mid - 0.005]), along(w, o.at + o.width / 2 - 0.02, o.at + o.width, [mid + 0.005, mid + 0.035]));
      }
      if ((o.kind === 'door' || o.kind === 'entry') && o.into) {
        const room = ROOMS.find((r) => r.id === o.into);
        if (!room) continue;
        const c = isHorizontal(w) ? w.a[1] : w.a[0];
        const centre = isHorizontal(w) ? (room.z0 + room.z1) / 2 : (room.x0 + room.x1) / 2;
        const side = centre > c ? 1 : -1;
        const face = side > 0 ? t[1] - c : c - t[0];
        const n: [number, number] = isHorizontal(w) ? [0, side] : [side, 0];
        const offset = (p: [number, number], k: number): [number, number] => [p[0] + n[0] * k, p[1] + n[1] * k];
        const hingeAt = o.flip ? o.at + o.width : o.at;
        const otherAt = o.flip ? o.at : o.at + o.width;
        const hinge = offset(at(hingeAt), face);
        const closed = offset(at(otherAt), face);
        const open = offset(hinge, o.width);
        // the arc runs from the open leaf back to the closed position (SVG: y grows downwards)
        const a = [open[0] - hinge[0], open[1] - hinge[1]];
        const b = [closed[0] - hinge[0], closed[1] - hinge[1]];
        doors.push({ hinge, open, closed, radius: o.width, sweep: (a[0] ?? 0) * (b[1] ?? 0) - (a[1] ?? 0) * (b[0] ?? 0) > 0 ? 1 : 0 });
      }
    }
    if (from < length + ext) walls.push(along(w, from, length + ext, t));
  }
  const rooms: PlanRoom[] = ROOMS.map((r) => {
    const i = roomInterior(r);
    return { id: r.id, box: box(i), area: roomArea(r), width: i.x1 - i.x0, depth: i.z1 - i.z0 };
  });
  const margin = 0.7;
  const view = { x: BOUNDS.x0 - EXTERIOR - margin, y: BOUNDS.z0 - EXTERIOR - margin, w: BOUNDS.x1 - BOUNDS.x0 + 2 * (EXTERIOR + margin), h: BALCONY.z1 - BOUNDS.z0 + EXTERIOR + 2 * margin };
  return { walls, windows, doors, sliders, rooms, balcony: box(BALCONY), view };
}

export type PlanGeometry = ReturnType<typeof planGeometry>;
