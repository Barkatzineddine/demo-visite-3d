// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { RoomId } from '../../src/domain/apartment';
import { DEFAULT_CHOICES } from '../../src/domain/schema';
import { dictionaries, type Key } from '../../src/i18n';
import { buildSheet } from '../../src/pdf/sheet';
import { jpegSize, PdfDoc } from '../../src/pdf/writer';
import { interpolate } from '../../src/shared/i18n';

/** The formatting helpers of src/format.ts, without React. */
function fmt(lang: 'fr' | 'en') {
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB';
  const t = (key: Key, vars?: Record<string, string | number>) => interpolate(dictionaries[lang][key], vars);
  const num = (n: number, digits = 0) => n.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return {
    t, num,
    m2: (n: number, digits = 1) => `${num(n, digits)} m²`,
    euros: (n: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n),
    room: (id: RoomId | 'balcon') => t(`room.${id}` as Key),
    view: (v: string) => (v === 'maquette' ? t('tour.maquette') : t(`room.${v}` as Key)),
    light: (id: string) => t(`light.${id}` as Key),
    finish: (kind: string, id: string) => t(`${kind}.${id}` as Key),
    day: (d: Date) => d.toLocaleDateString(locale),
  };
}

/** A tiny but real baseline JPEG header: SOI, an APP0 segment, then SOF0 with 320 × 200 pixels. */
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0xc8, 0x01, 0x40, 0x03, 0x01, 0x22, 0x00, 0xff, 0xd9]);
const latin1 = (bytes: Uint8Array) => Array.from(bytes, (b) => String.fromCharCode(b)).join('');

describe('PDF writer', () => {
  it('reads the pixel size of a JPEG and refuses anything else', () => {
    expect(jpegSize(JPEG)).toEqual({ w: 320, h: 200 });
    expect(jpegSize(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
    expect(new PdfDoc().image(new Uint8Array([1, 2, 3]), 0, 0, 10, 10)).toBe(false);
  });

  it('embeds a JPEG as an image object, byte for byte', () => {
    const doc = new PdfDoc();
    expect(doc.image(JPEG, 40, 40, 320, 200)).toBe(true);
    const out = latin1(doc.output(new Date(2026, 9, 24)));
    expect(out).toContain('/Subtype /Image /Width 320 /Height 200');
    expect(out).toContain('/Filter /DCTDecode');
    expect(out).toContain(`stream\n${latin1(JPEG)}\nendstream`);
    expect(out).toContain('/XObject << /Im0');
  });
});

describe('viewing sheet', () => {
  const now = new Date(2026, 9, 24, 10, 30);
  const choices = { ...DEFAULT_CHOICES, floor: 'beton' as const, walls: 'sauge' as const, light: 'coucher' as const, view: 'chambre1' as const };

  it('has two pages: the view, facts and finishes, then the plan and the areas', () => {
    const out = latin1(buildSheet({ choices, image: JPEG, link: 'https://example.test/#/?sol=beton', now, f: fmt('fr') }));
    expect(out.startsWith('%PDF-1.4')).toBe(true);
    expect(out).toContain('/Count 2');
    expect(out).toContain('/DCTDecode');
    for (const text of ['Fiche de visite', 'Béton ciré', 'Vert sauge', 'Coucher de soleil', 'Chambre 1', 'Total loi Carrez', '66,82']) {
      expect(out).toContain(text.replace('é', String.fromCharCode(0xe9)));
    }
  });

  it('is written in English too, and works without a picture', () => {
    const out = latin1(buildSheet({ choices: DEFAULT_CHOICES, image: null, link: 'https://example.test/', now, f: fmt('en') }));
    expect(out).not.toContain('/DCTDecode');
    for (const text of ['Viewing sheet', 'Oak parquet', 'Carrez total', '66.82', 'Bedroom 1']) expect(out).toContain(text);
  });
});

describe('dictionaries', () => {
  it('use the same placeholders in both languages', () => {
    const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const key of Object.keys(dictionaries.fr) as Key[]) expect(vars(dictionaries.en[key]), key).toEqual(vars(dictionaries.fr[key]));
  });
});
