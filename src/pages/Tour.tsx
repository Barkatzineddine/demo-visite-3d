// The listing with its tour: title and price, the 3D visit with the finishes beside it, then the
// facts, the description, the energy labels and the agent.
import { useEffect } from 'react';
import { balconyArea, carrez } from '../domain/apartment';
import { AGENCY, LISTING } from '../domain/catalog';
import { useFormat } from '../format';
import { usePage } from '../shared/router';
import { useFeedback } from '../shared/ui/Feedback';
import { openedFromValidLink } from '../state/choices';
import { Finishes } from '../ui/Finishes';
import { Viewer } from '../ui/Viewer';

const DPE = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;

export default function Tour() {
  const { t, euros, m2, num } = useFormat();
  const { toast } = useFeedback();
  usePage(`${t('listing.title')} · ${AGENCY.name}`);
  useEffect(() => { if (!openedFromValidLink) toast(t('share.badLink'), 'info'); }, [t, toast]);

  const facts: [string, string][] = [
    [t('fact.carrez'), m2(carrez(), 2)],
    [t('fact.rooms'), t('fact.roomsValue')],
    [t('fact.balcony'), m2(balconyArea(), 2)],
    [t('fact.floor'), t('fact.floorValue')],
    [t('fact.exposure'), t('fact.exposureValue')],
    [t('fact.built'), String(LISTING.built)],
    [t('fact.heating'), t('fact.heatingValue')],
    [t('fact.charges'), t('fact.chargesValue', { amount: euros(LISTING.charges) })],
    [t('fact.tax'), euros(LISTING.tax)],
    [t('fact.parking'), t('fact.parkingValue')],
  ];

  return (
    <>
      <header className="listing-head">
        <div>
          <p className="kicker">{t('listing.kicker', { ref: LISTING.ref })}</p>
          <h1 tabIndex={-1}>{t('listing.title')}</h1>
          <p className="muted">{t('listing.address')}</p>
        </div>
        <div className="price">
          <p className="price-value">{euros(LISTING.price)}</p>
          <p className="hint">{t('listing.perM2', { price: euros(Math.round(LISTING.price / carrez())) })} · {t('listing.priceNote')}</p>
        </div>
      </header>
      <ul className="key-facts" aria-label={t('listing.about')}>
        <li><strong>{m2(carrez(), 1)}</strong> {t('chip.carrez')}</li>
        <li><strong>3</strong> {t('chip.rooms')}</li>
        <li><strong>{m2(balconyArea(), 1)}</strong> {t('chip.balcony')}</li>
        <li><strong>{t('fact.floorValue')}</strong></li>
        <li><strong>DPE {LISTING.dpe}</strong></li>
      </ul>

      <div className="tour-layout">
        <Viewer />
        <aside className="panel side-panel">
          <Finishes />
        </aside>
      </div>

      <div className="about-grid">
        <section className="panel" aria-labelledby="about">
          <h2 id="about" className="panel-title">{t('listing.about')}</h2>
          <p className="lead">{t('listing.description', { carrez: num(carrez(), 1), balcony: num(balconyArea(), 1) })}</p>
          <dl className="facts">
            {facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
        </section>
        <div className="about-side">
          <section className="panel" aria-labelledby="energy">
            <h2 id="energy" className="panel-title">{t('listing.energy')}</h2>
            <div className="energy" role="img" aria-label={`${t('listing.dpe', { value: LISTING.dpe })}. ${t('listing.dpeDetail')}.`}>
              {DPE.map((c, i) => (
                <span key={c} className={`energy-bar e-${c.toLowerCase()}`} style={{ width: `${34 + i * 9}%` }} data-on={c === LISTING.dpe || undefined}>{c}</span>
              ))}
            </div>
            <p className="small"><strong>{t('listing.dpe', { value: LISTING.dpe })}</strong> · {t('listing.dpeDetail')}</p>
            <p className="small"><strong>{t('listing.ges', { value: LISTING.ges })}</strong> · {t('listing.gesDetail')}</p>
            <p className="hint">{t('listing.energyCost')}</p>
          </section>
          <section className="panel agent" aria-labelledby="agent">
            <h2 id="agent" className="panel-title">{t('listing.contact')}</h2>
            <p><strong>{t('listing.agent')}</strong><br /><span className="muted">{AGENCY.name}</span></p>
            <div className="share-actions">
              <a className="btn btn-primary" href={`tel:+33${AGENCY.phone.replace(/\s/g, '').slice(1)}`}>{t('listing.call')} · {AGENCY.phone}</a>
              <a className="btn btn-ghost" href={`mailto:${AGENCY.email}?subject=${encodeURIComponent(`${LISTING.ref} · ${t('listing.title')}`)}`}>{t('listing.write')}</a>
            </div>
            <p className="hint">{t('listing.legal')}</p>
          </section>
        </div>
      </div>
    </>
  );
}
