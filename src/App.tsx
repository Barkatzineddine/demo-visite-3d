import { lazy, Suspense, useEffect } from 'react';
import { AGENCY } from './domain/catalog';
import { useFormat } from './format';
// not lazy: the tour is the pre-rendered first screen, which the first render replaces with itself
import Tour from './pages/Tour';
import { usePrerenderHandoff } from './shared/prerender';
import { Link, useLocation, useScrollOnNavigate } from './shared/router';
import { onInstallPrompt } from './shared/sw';
import { FeedbackProvider, useFeedback } from './shared/ui/Feedback';

const PlanPage = lazy(() => import('./pages/PlanPage'));

export function App() {
  const { t } = useFormat();
  usePrerenderHandoff();
  return (
    <FeedbackProvider closeLabel={t('common.close')}>
      <Shell />
    </FeedbackProvider>
  );
}

function Shell() {
  const location = useLocation();
  useScrollOnNavigate(location);
  const { t } = useFormat();
  return (
    <>
      <a className="skip" href="#contenu">{t('nav.skip')}</a>
      <DemoBar />
      <Header />
      <main id="contenu" tabIndex={-1} className="wrap">
        <Suspense fallback={<div className="route-loading" aria-hidden="true" />}>
          {location.path === '/plan' ? <PlanPage /> : <Tour />}
        </Suspense>
      </main>
      <Footer />
    </>
  );
}

function DemoBar() {
  const { t, lang, setLang } = useFormat();
  const { confirm, toast } = useFeedback();
  // offered in a toast: a button appearing in the bar would push the page down (layout shift)
  useEffect(() => onInstallPrompt((show) => { if (show) toast(t('demo.installable'), 'info', { label: t('demo.install'), run: () => void show() }); }), [t, toast]);
  const reset = async () => {
    if (!(await confirm({ title: t('demo.resetTitle'), body: t('demo.resetBody'), ok: t('demo.reset'), cancel: t('common.cancel'), danger: true }))) return;
    try {
      Object.keys(localStorage).filter((k) => k.startsWith('verlaine:')).forEach((k) => { localStorage.removeItem(k); });
      sessionStorage.clear();
    } catch { /* storage blocked */ }
    window.location.hash = '';
    window.location.reload();
  };
  return (
    <div className="demo-bar">
      <p><strong>{t('demo.label')}</strong> · {t('demo.text')} <a href="https://barkatzineddine.github.io/#contact">{t('demo.cta')}</a></p>
      <div className="demo-actions">
        <button type="button" className="demo-btn" title={t('lang.label')} lang={lang === 'fr' ? 'en' : 'fr'} onClick={() => { setLang(lang === 'fr' ? 'en' : 'fr'); }}>{t('lang.switch')}</button>
        <button type="button" className="demo-btn" onClick={() => void reset()}>{t('demo.reset')}</button>
      </div>
    </div>
  );
}

function Header() {
  const { t } = useFormat();
  const { path } = useLocation();
  const nav: [string, string][] = [['/', t('nav.tour')], ['/plan', t('nav.plan')]];
  return (
    <header className="site-header">
      <div className="wrap header-inner">
        <Link to="/" className="brand">
          <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true"><path d="M4 15 16 5l12 10" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /><path d="M8 13v14h16V13" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" /><path d="M13 27v-7h6v7" fill="currentColor" /></svg>
          <span><span className="brand-name">{AGENCY.name}</span><span className="brand-sub">{t('brand.sub')}</span></span>
        </Link>
        <nav className="nav" aria-label={t('nav.label')}>
          {nav.map(([to, label]) => (
            <Link key={to} to={to} aria-current={(to === '/' ? path !== '/plan' : path === to) ? 'page' : undefined}>{label}</Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  const { t } = useFormat();
  const by = t('footer.by').split('Zineddine Barkat');
  return (
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <div>
          <p className="brand-name">{AGENCY.name}</p>
          <p>{AGENCY.address}, {AGENCY.zip} {AGENCY.city}<br /><a href={`tel:+33${AGENCY.phone.replace(/\s/g, '').slice(1)}`}>{AGENCY.phone}</a> · <a href={`mailto:${AGENCY.email}`}>{AGENCY.email}</a></p>
          <p className="small">{t('footer.card')} · SIRET {AGENCY.siret}</p>
        </div>
        <div id="securite">
          <h2 className="footer-title">{t('footer.security')}</h2>
          <ul className="sec-list"><li>{t('footer.sec.1')}</li><li>{t('footer.sec.2')}</li><li>{t('footer.sec.3')}</li><li>{t('footer.sec.4')}</li></ul>
        </div>
        <div>
          <h2 className="footer-title">{t('footer.demo')}</h2>
          <p>{t('footer.fiction')}</p>
          <p>{t('footer.engineering')}</p>
          <p>{by[0]}<a href="https://barkatzineddine.github.io/#contact">Zineddine Barkat</a>{by[1]} <a href="https://github.com/Barkatzineddine/demo-visite-3d">{t('footer.code')}</a></p>
        </div>
      </div>
    </footer>
  );
}
