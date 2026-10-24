// The viewing sheet: one A4 page with the view on screen, the property's key facts and the finishes
// picked, then the floor plan with every room's area and the Carrez total. Pure: the texts and
// formatting come from the caller, so it is unit-tested in both languages.
import { balconyArea, carrez } from '../domain/apartment';
import { AGENCY, LISTING } from '../domain/catalog';
import { LABEL_OFFSET, planGeometry, type Box } from '../domain/plan';
import type { Choices } from '../domain/schema';
import type { useFormat } from '../format';
import { A4, PdfDoc, textWidth, wrap } from './writer';

type Fmt = Pick<ReturnType<typeof useFormat>, 't' | 'm2' | 'euros' | 'num' | 'room' | 'view' | 'light' | 'finish' | 'day'>;

const INK = '#22262b';
const MUTED = '#646b73';
const LINE = '#dcd6cc';
const BRAND = '#23465c';
const M = 40;

/** Cuts a long unbroken string (a link) into lines that fit the width. */
function hardWrap(text: string, size: number, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const ch of text) {
    if (textWidth(line + ch, size) > width) { lines.push(line); line = ''; }
    line += ch;
  }
  return line ? [...lines, line] : lines;
}

export function buildSheet({ choices, image, link, now, f }: { choices: Choices; image: Uint8Array | null; link: string; now: Date; f: Fmt }): Uint8Array {
  const { t } = f;
  const doc = new PdfDoc({ title: `${AGENCY.name} · ${t('pdf.title')} ${LISTING.ref}`, author: AGENCY.name });
  const W = A4.w - 2 * M;

  // header band
  const band = () => {
    doc.rect(0, 0, A4.w, 58, { fill: BRAND });
    doc.text(AGENCY.name, M, 34, { size: 16, bold: true, color: '#ffffff' });
    doc.text(`${t('pdf.title')} · ${t('listing.kicker', { ref: LISTING.ref }).split(' · ')[0] ?? ''}`, A4.w - M, 28, { size: 10, bold: true, color: '#ffffff', align: 'right' });
    doc.text(t('pdf.made', { date: f.day(now) }), A4.w - M, 42, { size: 8.5, color: '#d7e2ea', align: 'right' });
  };
  const footer = () => {
    doc.line(M, A4.h - 52, A4.w - M, A4.h - 52, { color: LINE });
    doc.text(`${AGENCY.name} · ${AGENCY.address}, ${AGENCY.zip} ${AGENCY.city} · ${AGENCY.phone} · ${AGENCY.email}`, M, A4.h - 38, { size: 7.5, color: MUTED });
    doc.text(`${t('footer.card')} · SIRET ${AGENCY.siret} · ${t('pdf.demo')}`, M, A4.h - 27, { size: 7.5, color: MUTED });
  };

  band();
  let y = 92;
  const titleLines = wrap(t('listing.title'), 17, W - 170, true);
  titleLines.forEach((line, i) => { doc.text(line, M, y + i * 21, { size: 17, bold: true, color: INK }); });
  doc.text(f.euros(LISTING.price), A4.w - M, y, { size: 17, bold: true, color: BRAND, align: 'right' });
  doc.text(t('listing.perM2', { price: f.euros(Math.round(LISTING.price / carrez())) }), A4.w - M, y + 15, { size: 8.5, color: MUTED, align: 'right' });
  y += (titleLines.length - 1) * 21 + 16;
  doc.text(t('listing.address'), M, y, { size: 9.5, color: MUTED });
  y += 16;

  // the view
  const imgH = Math.round(W * 0.6);
  if (image && doc.image(image, M, y, W, imgH)) {
    doc.rect(M, y, W, imgH, { stroke: LINE, width: 0.6 });
    y += imgH + 13;
    doc.text(t('pdf.view', { view: f.view(choices.view), light: f.light(choices.light) }), M, y, { size: 8.5, color: MUTED });
    y += 22;
  }

  // facts and finishes, side by side
  const col = (W - 24) / 2;
  const rows = (x: number, top: number, title: string, items: [string, string][]) => {
    doc.text(title, x, top, { size: 11, bold: true, color: BRAND });
    let ry = top + 18;
    for (const [k, v] of items) {
      doc.text(k, x, ry, { size: 8.5, color: MUTED });
      const lines = wrap(v, 9, col - 112);
      lines.forEach((l, i) => { doc.text(l, x + 112, ry + i * 11, { size: 9, color: INK }); });
      ry += Math.max(1, lines.length) * 11 + 5;
      doc.line(x, ry - 8, x + col, ry - 8, { color: '#ece7de', width: 0.5 });
    }
    return ry;
  };
  const end1 = rows(M, y, t('pdf.facts'), [
    [t('fact.carrez'), f.m2(carrez(), 2)],
    [t('fact.rooms'), t('fact.roomsValue')],
    [t('fact.balcony'), f.m2(balconyArea(), 2)],
    [t('fact.floor'), t('fact.floorValue')],
    [t('fact.built'), String(LISTING.built)],
    [t('fact.exposure'), t('fact.exposureValue')],
    [t('fact.charges'), t('fact.chargesValue', { amount: f.euros(LISTING.charges) })],
    [t('fact.tax'), f.euros(LISTING.tax)],
    [t('listing.energy'), `${t('listing.dpe', { value: LISTING.dpe })} · ${t('listing.ges', { value: LISTING.ges })}`],
  ]);
  const end2 = rows(M + col + 24, y, t('pdf.choices'), [
    [t('finish.floor'), f.finish('floor', choices.floor)],
    [t('finish.walls'), f.finish('walls', choices.walls)],
    [t('finish.fronts'), f.finish('fronts', choices.fronts)],
    [t('finish.top'), f.finish('top', choices.top)],
    [t('pdf.furnished'), t(choices.furnished ? 'pdf.furnishedYes' : 'pdf.furnishedNo')],
    [t('pdf.light'), f.light(choices.light)],
  ]);
  y = Math.max(end1, end2) + 8;
  if (y < A4.h - 100) {
    doc.text(t('pdf.link'), M, y, { size: 8.5, bold: true, color: INK });
    hardWrap(link, 7.5, W).slice(0, 3).forEach((l, i) => { doc.text(l, M, y + 12 + i * 10, { size: 7.5, color: BRAND }); });
  }
  footer();

  // page 2: the plan and the areas
  doc.addPage();
  band();
  doc.text(t('pdf.plan'), M, 92, { size: 15, bold: true, color: INK });
  const g = planGeometry();
  const scale = Math.min(W / g.view.w, 430 / g.view.h);
  const ox = M + (W - g.view.w * scale) / 2 - g.view.x * scale;
  const oy = 108 - g.view.y * scale;
  const px = (x: number, z: number): [number, number] => [ox + x * scale, oy + z * scale];
  const box = (b: Box, style: { fill?: string; stroke?: string; width?: number }) => {
    doc.rect(ox + b.x * scale, oy + b.y * scale, b.w * scale, b.h * scale, style);
  };
  box(g.balcony, { fill: '#f1ede6', stroke: '#b9b1a4', width: 0.6 });
  for (const r of g.rooms) box(r.box, { fill: r.id === 'sdb' || r.id === 'wc' ? '#e8eef0' : '#f7f2e9' });
  for (const w of g.walls) box(w, { fill: INK });
  for (const w of g.windows) {
    box(w, { fill: '#ffffff', stroke: INK, width: 0.5 });
    const [a, b] = w.w > w.h ? [px(w.x, w.y + w.h / 2), px(w.x + w.w, w.y + w.h / 2)] : [px(w.x + w.w / 2, w.y), px(w.x + w.w / 2, w.y + w.h)];
    doc.line(a[0], a[1], b[0], b[1], { color: INK, width: 0.4 });
  }
  for (const s of g.sliders) box(s, { fill: '#ffffff', stroke: INK, width: 0.4 });
  for (const d of g.doors) {
    // leaf, then the swing as a polyline from the open leaf to the closed position
    const a0 = Math.atan2(d.open[1] - d.hinge[1], d.open[0] - d.hinge[0]);
    let a1 = Math.atan2(d.closed[1] - d.hinge[1], d.closed[0] - d.hinge[0]);
    if (d.sweep === 1 && a1 < a0) a1 += Math.PI * 2;
    if (d.sweep === 0 && a1 > a0) a1 -= Math.PI * 2;
    const arc: [number, number][] = Array.from({ length: 13 }, (_, i) => {
      const a = a0 + ((a1 - a0) * i) / 12;
      return px(d.hinge[0] + Math.cos(a) * d.radius, d.hinge[1] + Math.sin(a) * d.radius);
    });
    doc.path([px(...d.hinge), px(...d.open)], { stroke: INK, width: 0.8, close: false });
    doc.path(arc, { stroke: MUTED, width: 0.4, close: false });
  }
  for (const r of g.rooms) {
    const [nx, ny] = LABEL_OFFSET[r.id] ?? [0, 0];
    const [cx, cy] = px(r.box.x + r.box.w / 2 + nx, r.box.y + r.box.h / 2 + ny);
    const small = r.box.w < 1.5;
    doc.text(f.room(r.id), cx, cy - 1, { size: small ? 6.5 : 8.5, bold: true, color: INK, align: 'center' });
    doc.text(f.m2(r.area, 2), cx, cy + (small ? 8 : 10), { size: small ? 6.5 : 8, color: MUTED, align: 'center' });
  }
  const [bx, by] = px(g.balcony.x + g.balcony.w / 2, g.balcony.y + g.balcony.h / 2);
  doc.text(`${f.room('balcon')} · ${f.m2(balconyArea(), 2)}`, bx, by + 3, { size: 8, color: MUTED, align: 'center' });

  // the areas table
  y = 108 + g.view.h * scale + 18;
  doc.text(t('plan.room'), M, y, { size: 8.5, bold: true, color: MUTED });
  doc.text(t('plan.size'), M + 300, y, { size: 8.5, bold: true, color: MUTED, align: 'right' });
  doc.text(t('plan.area'), A4.w - M, y, { size: 8.5, bold: true, color: MUTED, align: 'right' });
  y += 6;
  for (const r of [...g.rooms].sort((a, b) => b.area - a.area)) {
    doc.line(M, y, A4.w - M, y, { color: '#ece7de', width: 0.5 });
    y += 12;
    doc.text(f.room(r.id), M, y, { size: 9, color: INK });
    doc.text(t('plan.dims', { w: f.num(r.width, 2), d: f.num(r.depth, 2) }), M + 300, y, { size: 9, color: MUTED, align: 'right' });
    doc.text(f.m2(r.area, 2), A4.w - M, y, { size: 9, color: INK, align: 'right' });
    y += 4;
  }
  doc.line(M, y, A4.w - M, y, { color: INK, width: 0.8 });
  y += 13;
  doc.text(t('plan.total'), M, y, { size: 10, bold: true, color: INK });
  doc.text(f.m2(carrez(), 2), A4.w - M, y, { size: 10, bold: true, color: BRAND, align: 'right' });
  y += 14;
  doc.text(t('plan.balcony'), M, y, { size: 9, color: MUTED });
  doc.text(f.m2(balconyArea(), 2), A4.w - M, y, { size: 9, color: MUTED, align: 'right' });
  y += 16;
  wrap(t('plan.note'), 8, W).forEach((l, i) => { doc.text(l, M, y + i * 10, { size: 8, color: MUTED }); });
  footer();
  return doc.output(now);
}
