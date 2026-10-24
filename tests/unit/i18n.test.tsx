import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { I18nProvider, useI18n } from '../../src/i18n';
import { capture, setCapturer } from '../../src/state/capture';

function Probe() {
  const { t, lang, setLang, money, date } = useI18n();
  return (
    <div>
      <p data-testid="text">{t('listing.kicker', { ref: 'VL-1' })}</p>
      <p data-testid="money">{money(389000, 0)}</p>
      <p data-testid="date">{date('2026-10-24')}</p>
      <button type="button" onClick={() => { setLang(lang === 'fr' ? 'en' : 'fr'); }}>switch</button>
    </div>
  );
}

describe('i18n', () => {
  beforeEach(() => { localStorage.clear(); });

  it('starts in French, switches to English and remembers it', () => {
    render(<I18nProvider><Probe /></I18nProvider>);
    expect(screen.getByTestId('text').textContent).toBe('Réf. VL-1 · Appartement à vendre');
    expect(screen.getByTestId('money').textContent?.replace(/\s/g, ' ')).toBe('389 000 €');
    expect(screen.getByTestId('date').textContent).toBe('samedi 24 octobre');
    act(() => { screen.getByRole('button').click(); });
    expect(screen.getByTestId('text').textContent).toBe('Ref. VL-1 · Apartment for sale');
    expect(screen.getByTestId('money').textContent).toBe('€389,000');
    expect(document.documentElement.lang).toBe('en');
    expect(localStorage.getItem('verlaine:lang')).toBe('en');
  });

  it('reopens in the language picked before, and ignores a tampered value', () => {
    localStorage.setItem('verlaine:lang', 'en');
    const { unmount } = render(<I18nProvider><Probe /></I18nProvider>);
    expect(screen.getByTestId('text').textContent).toContain('Apartment');
    unmount();
    localStorage.setItem('verlaine:lang', '<img>');
    render(<I18nProvider><Probe /></I18nProvider>);
    expect(screen.getByTestId('text').textContent).toContain('Appartement');
  });

  it('refuses to be used outside its provider', () => {
    expect(() => render(<Probe />)).toThrow('useI18n outside I18nProvider');
  });
});

describe('capture', () => {
  it('returns nothing until the 3D view registers itself', () => {
    expect(capture()).toBeNull();
    setCapturer(() => 'data:image/jpeg;base64,AA');
    expect(capture()).toBe('data:image/jpeg;base64,AA');
    setCapturer(null);
    expect(capture()).toBeNull();
  });
});
