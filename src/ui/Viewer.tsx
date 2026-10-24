// The tour: a still of the dollhouse at once (also what the pre-rendered page shows), then the 3D
// engine over it. On a large screen with a mouse it loads at the visitor's first move; on phones it
// waits for a tap (about 1 MB and a GPU warm-up are worth asking for). Without WebGL the still stays.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ROOM_IDS, type RoomId } from '../domain/apartment';
import { HOTSPOTS, LIGHT_IDS } from '../domain/catalog';
import type { View } from '../domain/schema';
import type { Engine, HotspotOnScreen, Pose } from '../engine/Engine';
import { useFormat } from '../format';
import { download } from '../shared/download';
import { useFeedback } from '../shared/ui/Feedback';
import { setChoices, useChoices } from '../state/choices';
import { setCapturer } from '../state/capture';
import { Plan } from './Plan';
import { useHotspotText } from './useHotspotText';

type Phase = 'waiting' | 'loading' | 'ready' | 'flat' | 'lost';

/** WebGL 2, and whether it runs on the CPU (no usable GPU): then the light renderer is the only bearable one. */
function probeWebgl(): { ok: boolean; software: boolean } {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return { ok: false, software: false };
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return { ok: true, software: /swiftshader|llvmpipe|software|basic render/i.test(name) };
  } catch {
    return { ok: false, software: false };
  }
}

const media = (q: string) => typeof matchMedia === 'function' && matchMedia(q).matches;
/** Desktop-class device: the full renderer (ambient occlusion, area lights, mirror) and loading without a tap. */
const capable = () => media('(min-width: 900px) and (pointer: fine)') && !(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
const touch = () => media('(pointer: coarse)');

export function Viewer() {
  const { t, view: viewName, light: lightName } = useFormat();
  const { toast } = useFeedback();
  const choices = useChoices((s) => s.choices);
  const [phase, setPhase] = useState<Phase>('waiting');
  const [desktop] = useState(capable);
  const [spots, setSpots] = useState<HotspotOnScreen[]>([]);
  const [pose, setPose] = useState<Pose | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [full, setFull] = useState(false);
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const engine = useRef<Engine | null>(null);
  const text = useHotspotText();
  const quality = useRef<'high' | 'low'>('low');
  const started = phase === 'loading' || phase === 'ready';

  const start = useCallback(() => {
    setPhase((p) => {
      if (p !== 'waiting') return p;
      const gl = probeWebgl();
      quality.current = desktop && !gl.software ? 'high' : 'low';
      return gl.ok ? 'loading' : 'flat';
    });
  }, [desktop]);

  // desktop: the 3D loads at the first sign of the visitor (never in the build-time snapshot)
  useEffect(() => {
    if ((window as { __PRERENDER__?: boolean }).__PRERENDER__ || !desktop) return;
    const events = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;
    const go = () => { events.forEach((e) => { window.removeEventListener(e, go); }); start(); };
    events.forEach((e) => { window.addEventListener(e, go, { passive: true, once: true }); });
    return () => { events.forEach((e) => { window.removeEventListener(e, go); }); };
  }, [desktop, start]);

  useEffect(() => {
    const host = stage.current;
    if (!started || !host) return;
    let gone = false;
    let made: Engine | null = null;
    import('../engine/Engine').then(({ Engine: E }) => {
      if (gone) return;
      made = new E(host, useChoices.getState().choices, quality.current, {
        ready: () => { setPhase('ready'); },
        view: (v) => { setChoices({ view: v }); },
        hotspots: setSpots,
        pose: setPose,
        lost: () => { setPhase('lost'); },
      });
      engine.current = made;
      setCapturer(() => made?.capture() ?? null);
    }).catch(() => { setPhase('flat'); });
    return () => {
      gone = true;
      setCapturer(null);
      made?.dispose();
      engine.current = null;
    };
  }, [started]);

  useEffect(() => { engine.current?.setChoices(choices); }, [choices]);

  useEffect(() => {
    const onChange = () => { setFull(document.fullscreenElement === section.current); };
    document.addEventListener('fullscreenchange', onChange);
    return () => { document.removeEventListener('fullscreenchange', onChange); };
  }, []);

  const go = (v: View) => { setOpen(null); setChoices({ view: v }); };
  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void section.current?.requestFullscreen().catch(() => undefined);
  };
  const saveImage = () => {
    const url = engine.current?.capture();
    if (!url) return;
    const bytes = Uint8Array.from(atob(url.split(',')[1] ?? ''), (ch) => ch.charCodeAt(0));
    download(`visite-${choices.view}.jpg`, bytes, 'image/jpeg');
    toast(t('tour.imageDone'), 'ok');
  };

  const ready = phase === 'ready';
  const current: RoomId | null = choices.view === 'maquette' ? null : choices.view;
  const hint = choices.view === 'maquette' ? t('tour.hintDollhouse') : touch() ? t('tour.hintWalkTouch') : t('tour.hintWalk');
  const openSpot = open ? HOTSPOTS.find((h) => h.id === open) : undefined;

  return (
    <section ref={section} className={`viewer${full ? ' is-full' : ''}`} aria-label={t('tour.label')}>
      <div className="views" role="toolbar" aria-label={t('tour.views')}>
        {(['maquette', ...ROOM_IDS] as View[]).map((v) => (
          <button key={v} type="button" className="chip" aria-pressed={choices.view === v} disabled={!ready} onClick={() => { go(v); }}>{viewName(v)}</button>
        ))}
      </div>
      <div className={`stage stage-${phase}`}>
        <picture className="stage-poster" aria-hidden={ready ? true : undefined}>
          <source type="image/webp" srcSet={`${import.meta.env.BASE_URL}img/maquette-960.webp 960w, ${import.meta.env.BASE_URL}img/maquette-1600.webp 1600w`} sizes="(min-width: 1240px) 1208px, 100vw" />
          <img src={`${import.meta.env.BASE_URL}img/maquette-960.webp`} width={1600} height={1000} alt={t('tour.poster')} fetchPriority="high" decoding="async" />
        </picture>
        <div ref={stage} className="stage-3d" role="img" aria-label={t('tour.canvas', { view: viewName(choices.view) })} />
        {ready ? (
          <div className="spots" aria-label={t('tour.hotspots')} role="group">
            {spots.map((s) => {
              const title = text(s.id).title;
              return (
                <button key={s.id} type="button" className="spot" style={{ transform: `translate(${s.x}px, ${s.y}px)` }} aria-expanded={open === s.id}
                  aria-label={t('hotspot.open', { title })} title={title} onClick={() => { setOpen(open === s.id ? null : s.id); }}>
                  <span aria-hidden="true">+</span>
                </button>
              );
            })}
          </div>
        ) : null}
        {openSpot ? (
          <div className="spot-card" role="dialog" aria-label={text(openSpot.id).title}>
            <p className="spot-title">{text(openSpot.id).title}</p>
            <p>{text(openSpot.id).text}</p>
            <button type="button" className="spot-close" aria-label={t('common.close')} onClick={() => { setOpen(null); }}>×</button>
          </div>
        ) : null}
        {ready ? (
          <div className="mini-plan">
            <Plan mini current={current} pose={pose} onRoom={(id) => { go(id); }} label={t('tour.miniPlan')} />
          </div>
        ) : null}
        {phase === 'loading' ? <p className="stage-status" data-volatile>{t('tour.loading')}</p> : null}
        {phase === 'waiting' ? (
          <div className="stage-cta" data-volatile>
            <button type="button" className="btn btn-primary btn-lg" onClick={start}>{t('tour.start')}</button>
            <span>{t('tour.startNote')}</span>
          </div>
        ) : null}
        {ready ? <p className="stage-hint" data-volatile>{hint}</p> : null}
      </div>
      {phase === 'flat' || phase === 'lost' ? <p className="hint stage-note" role="status">{t(phase === 'flat' ? 'tour.no3d' : 'tour.lost')}</p> : null}
      <div className="toolbar">
        <div className="seg" role="radiogroup" aria-label={t('tour.light')}>
          {LIGHT_IDS.map((id) => (
            <button key={id} type="button" role="radio" aria-checked={choices.light === id} className="seg-btn" disabled={!ready} onClick={() => { setChoices({ light: id }); }}>{lightName(id)}</button>
          ))}
        </div>
        <label className="switch">
          <input type="checkbox" checked={choices.furnished} disabled={!ready} onChange={(e) => { setChoices({ furnished: e.target.checked }); }} />
          <span>{t('tour.furnished')}</span>
        </label>
        <span className="toolbar-end">
          <button type="button" className="btn btn-ghost btn-sm" disabled={!ready} onClick={saveImage}>{t('tour.image')}</button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={!ready} onClick={toggleFull}>{t(full ? 'tour.exitFullscreen' : 'tour.fullscreen')}</button>
        </span>
      </div>
    </section>
  );
}

