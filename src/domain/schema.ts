// The visitor's choices, described once with Zod: the type comes from the schema, and a shared link
// (untrusted) is checked against it before anything is applied.
import * as z from 'zod/mini';
import { ROOM_IDS } from './apartment';
import { FLOOR_IDS, FRONT_IDS, LIGHT_IDS, TOP_IDS, WALL_IDS } from './catalog';

// The strict CSP forbids eval: Zod must not try its compiled fast path.
z.config({ jitless: true });

export const VIEW_IDS = ['maquette', ...ROOM_IDS] as const;

export const choicesSchema = z.object({
  floor: z.enum(FLOOR_IDS),
  walls: z.enum(WALL_IDS),
  fronts: z.enum(FRONT_IDS),
  top: z.enum(TOP_IDS),
  furnished: z.boolean(),
  light: z.enum(LIGHT_IDS),
  /** The dollhouse ("maquette") or the room the visitor stands in. */
  view: z.enum(VIEW_IDS),
});
export type Choices = z.infer<typeof choicesSchema>;
export type View = Choices['view'];

export const DEFAULT_CHOICES: Choices = {
  floor: 'chene', walls: 'blanc', fronts: 'blanc', top: 'quartz', furnished: true, light: 'apres-midi', view: 'maquette',
};

const KEYS: Record<keyof Choices, string> = { floor: 'sol', walls: 'murs', fronts: 'facades', top: 'plan', furnished: 'meuble', light: 'lumiere', view: 'vue' };

export function encodeChoices(c: Choices): string {
  return new URLSearchParams(Object.entries(KEYS).map(([k, short]) => {
    const v = c[k as keyof Choices];
    return [short, typeof v === 'boolean' ? (v ? '1' : '0') : v];
  })).toString();
}

/** A link's choices; anything missing or invalid falls back to the defaults, and `valid` says so. */
export function decodeChoices(query: URLSearchParams): { choices: Choices; valid: boolean } {
  const present = Object.values(KEYS).filter((short) => query.has(short));
  if (!present.length) return { choices: DEFAULT_CHOICES, valid: true };
  const raw: Record<string, unknown> = {};
  for (const [k, short] of Object.entries(KEYS)) {
    const v = query.get(short);
    if (v === null) continue;
    raw[k] = k === 'furnished' ? (v === '1' ? true : v === '0' ? false : v) : v;
  }
  const merged = { ...DEFAULT_CHOICES, ...raw };
  const parsed = choicesSchema.safeParse(merged);
  if (parsed.success) return { choices: parsed.data, valid: present.length === Object.keys(KEYS).length };
  // keep what is valid, field by field
  const fixed = { ...DEFAULT_CHOICES };
  for (const k of Object.keys(KEYS) as (keyof Choices)[]) {
    const one = choicesSchema.safeParse({ ...DEFAULT_CHOICES, [k]: merged[k] });
    if (one.success) Object.assign(fixed, { [k]: one.data[k] });
  }
  return { choices: fixed, valid: false };
}
