// "Customise": floor, walls and kitchen finishes as swatch radios, then sharing (link) and keeping
// (PDF sheet). Every change goes to the address, so the link always reopens what is on screen.
import { useState } from 'react';
import { FLOOR_IDS, FRONT_IDS, LISTING, TOP_IDS, WALL_COLORS, WALL_IDS } from '../domain/catalog';
import { DEFAULT_CHOICES, type Choices } from '../domain/schema';
import { useFormat } from '../format';
import type { Key } from '../i18n';
import { download } from '../shared/download';
import { useFeedback } from '../shared/ui/Feedback';
import { capture } from '../state/capture';
import { resetFinishes, setChoices, shareUrl, useChoices } from '../state/choices';

type Kind = 'floor' | 'walls' | 'fronts' | 'top';
/** Swatch colours: what each finish reads as from a distance (the 3D shows the real texture). */
const SWATCH: Record<Kind, Record<string, string>> = {
  floor: { chene: 'linear-gradient(135deg, #c79a66 0 25%, #b88a58 25% 50%, #cfa574 50% 75%, #b3844f 75%)', carrelage: 'linear-gradient(90deg, #dcd8d1 0 48%, #c9c4bb 48% 52%, #dcd8d1 52%)', beton: 'radial-gradient(circle at 30% 30%, #b9b5ae, #9f9b94)' },
  walls: WALL_COLORS,
  fronts: { blanc: '#eeece7', chene: 'linear-gradient(90deg, #c69b6a, #b78b5b, #c9a170)', sauge: '#8f9c80', noir: '#2b2b2b' },
  top: { quartz: 'radial-gradient(circle at 70% 30%, #ffffff, #e9e6e0)', chene: 'linear-gradient(90deg, #c69b6a, #b78b5b, #c9a170)', beton: 'radial-gradient(circle at 30% 30%, #a9a59e, #8d8982)' },
};
const IDS: Record<Kind, readonly string[]> = { floor: FLOOR_IDS, walls: WALL_IDS, fronts: FRONT_IDS, top: TOP_IDS };
const LABEL: Record<Kind, Key> = { floor: 'finish.floor', walls: 'finish.walls', fronts: 'finish.fronts', top: 'finish.top' };

export function Finishes() {
  const f = useFormat();
  const { t } = f;
  const { toast } = useFeedback();
  const choices = useChoices((s) => s.choices);
  const [manual, setManual] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const changed = (['floor', 'walls', 'fronts', 'top'] as Kind[]).some((k) => choices[k] !== DEFAULT_CHOICES[k]);

  const copy = async () => {
    const url = shareUrl();
    try {
      await navigator.clipboard.writeText(url);
      setManual(null);
      toast(t('share.copied'), 'ok');
    } catch {
      setManual(url); // clipboard refused: show the link to copy by hand
    }
  };

  const pdf = async () => {
    setBusy(true);
    try {
      const { buildSheet } = await import('../pdf/sheet');
      const shot = capture();
      let image: Uint8Array | null = shot ? Uint8Array.from(atob(shot.split(',')[1] ?? ''), (c) => c.charCodeAt(0)) : null;
      // no 3D running: the dollhouse picture made for link previews
      if (!image) image = await fetch(`${import.meta.env.BASE_URL}img/og.jpg`).then((r) => (r.ok ? r.arrayBuffer() : null)).then((b) => (b ? new Uint8Array(b) : null)).catch(() => null);
      const bytes = buildSheet({ choices: useChoices.getState().choices, image, link: shareUrl(), now: new Date(), f });
      download(t('pdf.file', { ref: LISTING.ref }), bytes, 'application/pdf');
      toast(t('share.pdfDone'), 'ok');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="finishes">
      <h2 className="panel-title">{t('finish.title')}</h2>
      <p className="hint">{t('finish.lead')}</p>
      {(Object.keys(IDS) as Kind[]).map((kind) => (
        <fieldset key={kind} className="swatches">
          <legend>{t(LABEL[kind])} <span className="swatch-value">{f.finish(kind, choices[kind])}</span></legend>
          <div className="swatch-row">
            {IDS[kind].map((id) => (
              <label key={id} className="swatch" title={f.finish(kind, id)}>
                <input type="radio" name={kind} value={id} checked={choices[kind] === id} onChange={() => { setChoices({ [kind]: id } as Partial<Choices>); }} />
                <span className="swatch-chip" style={{ background: SWATCH[kind][id] }} aria-hidden="true" />
                <span className="sr">{f.finish(kind, id)}{id === DEFAULT_CHOICES[kind] ? ` (${t('finish.origin')})` : ''}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <button type="button" className="link-btn" disabled={!changed} onClick={resetFinishes}>{t('finish.reset')}</button>

      <h2 className="panel-title share-title">{t('share.title')}</h2>
      <div className="share-actions">
        <button type="button" className="btn btn-primary" onClick={() => void copy()}>{t('share.link')}</button>
        <button type="button" className="btn btn-ghost" disabled={busy} aria-busy={busy || undefined} onClick={() => void pdf()}>{t('share.pdf')}</button>
      </div>
      <p className="hint">{t('share.pdfNote')}</p>
      {manual ? (
        <label className="manual-link">
          <span>{t('share.manual')}</span>
          <input type="text" readOnly value={manual} onFocus={(e) => { e.currentTarget.select(); }} />
        </label>
      ) : null}
    </div>
  );
}
