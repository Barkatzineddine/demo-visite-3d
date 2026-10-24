// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { carrez, ROOMS } from '../../src/domain/apartment';
import { planGeometry, type Box } from '../../src/domain/plan';

const g = planGeometry();
const inside = (p: [number, number], b: Box, slack = 0.01) => p[0] >= b.x - slack && p[0] <= b.x + b.w + slack && p[1] >= b.y - slack && p[1] <= b.y + b.h + slack;
const overlap = (a: Box, b: Box) => a.x < b.x + b.w - 1e-6 && b.x < a.x + a.w - 1e-6 && a.y < b.y + b.h - 1e-6 && b.y < a.y + a.h - 1e-6;

describe('floor plan', () => {
  it('lists every room with the areas of the 3D model, adding up to the Carrez total', () => {
    expect(g.rooms.map((r) => r.id).sort()).toEqual(ROOMS.map((r) => r.id).sort());
    expect(g.rooms.reduce((s, r) => s + r.area, 0)).toBeCloseTo(carrez(), 2);
    for (const r of g.rooms) expect(r.width * r.depth).toBeCloseTo(r.area, 2);
  });

  it('draws walls around the openings: no wall piece covers a window', () => {
    expect(g.walls.length).toBeGreaterThan(20);
    expect(g.windows).toHaveLength(7); // six windows and the bay
    for (const w of g.windows) for (const piece of g.walls) expect(overlap(w, piece)).toBe(false);
  });

  it('swings each door into its room, the leaf as long as the opening is wide', () => {
    expect(g.doors).toHaveLength(5); // front door, bathroom, toilet, two bedrooms
    for (const d of g.doors) {
      expect(Math.hypot(d.open[0] - d.hinge[0], d.open[1] - d.hinge[1])).toBeCloseTo(d.radius, 6);
      expect(Math.hypot(d.closed[0] - d.hinge[0], d.closed[1] - d.hinge[1])).toBeCloseTo(d.radius, 6);
      const room = g.rooms.find((r) => inside(d.open, r.box));
      expect(room, `door at ${d.hinge.join(',')}`).toBeDefined();
    }
  });

  it('frames the whole apartment and its balcony', () => {
    const v = g.view;
    for (const r of [...g.rooms.map((x) => x.box), g.balcony]) {
      expect(r.x).toBeGreaterThan(v.x);
      expect(r.y).toBeGreaterThan(v.y);
      expect(r.x + r.w).toBeLessThan(v.x + v.w);
      expect(r.y + r.h).toBeLessThan(v.y + v.h);
    }
  });
});
