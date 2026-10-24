// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { axis, balconyArea, BOUNDS, carrez, roomArea, roomAt, ROOMS, walk, WALLS } from '../../src/domain/apartment';
import { DEFAULT_CHOICES, decodeChoices, encodeChoices } from '../../src/domain/schema';

/** Walks from a point toward a target in small steps, as the walk mode does. */
function stroll(from: [number, number], to: [number, number], steps = 200): [number, number] {
  let p = from;
  for (let i = 0; i < steps; i++) {
    const dx = to[0] - p[0];
    const dz = to[1] - p[1];
    const d = Math.hypot(dx, dz);
    if (d < 0.02) break;
    const s = Math.min(0.08, d);
    p = walk(p, [(dx / d) * s, (dz / d) * s]);
  }
  return p;
}

describe('apartment', () => {
  it('adds up to about 67 m² loi Carrez, the balcony apart', () => {
    expect(carrez()).toBeCloseTo(66.82, 2);
    const sejour = ROOMS.find((r) => r.id === 'sejour');
    expect(sejour && roomArea(sejour)).toBeCloseTo(27.98, 2);
    expect(balconyArea()).toBeCloseTo(8.64, 2);
  });

  it('places every opening inside its wall, and rooms tile the apartment without overlap', () => {
    for (const w of WALLS) {
      const { length } = axis(w);
      for (const o of w.openings) {
        expect(o.at).toBeGreaterThan(0);
        expect(o.at + o.width).toBeLessThan(length);
        expect(o.sill + o.height).toBeLessThan(2.5);
      }
    }
    const total = ROOMS.reduce((s, r) => s + (r.x1 - r.x0) * (r.z1 - r.z0), 0);
    expect(total).toBeCloseTo((BOUNDS.x1 - BOUNDS.x0) * (BOUNDS.z1 - BOUNDS.z0), 6);
    expect(roomAt(3, 5)?.id).toBe('sejour');
    expect(roomAt(8, 1)?.id).toBe('chambre1');
  });

  it('walks through doors and passages, never through walls', () => {
    // séjour to bedroom 1 through its door, and to the entrance through the passage
    expect(roomAt(...stroll([5.6, 3.2], [7.5, 3.1]))?.id).toBe('chambre1');
    expect(roomAt(...stroll([3.7, 4.0], [3.7, 1.5]))?.id).toBe('entree');
    // straight at the bathroom wall from the séjour: stopped on the séjour side
    const blocked = stroll([1.2, 4.0], [1.2, 1.0]);
    expect(blocked[1]).toBeGreaterThan(2.6);
    // through the bay window onto the balcony, but not over its railing
    const out = stroll([2.5, 6.5], [2.5, 9.5]);
    expect(out[1]).toBeGreaterThan(7.4);
    expect(out[1]).toBeLessThan(9.0);
  });
});

describe('share link', () => {
  it('round-trips the choices', () => {
    const c = { floor: 'beton', walls: 'sauge', fronts: 'noir', top: 'chene', furnished: false, light: 'nuit', view: 'chambre2' } as const;
    expect(decodeChoices(new URLSearchParams(encodeChoices(c)))).toEqual({ choices: c, valid: true });
  });
  it('keeps the valid fields of a tampered link and says it was altered', () => {
    const { choices, valid } = decodeChoices(new URLSearchParams('sol=carrelage&murs=<script>&meuble=1&lumiere=nuit&vue=../etc'));
    expect(valid).toBe(false);
    expect(choices).toEqual({ ...DEFAULT_CHOICES, floor: 'carrelage', light: 'nuit' });
  });
});
