// The visitor's choices (finishes, lighting, furnished, where they stand). They are not stored:
// they live in the address ("#/?sol=chene&murs=lin…"), so a reload or a shared link reopens the
// same visit. A link is untrusted: it is decoded and checked against the schema first.
import { create } from 'zustand';
import { decodeChoices, DEFAULT_CHOICES, encodeChoices, type Choices } from '../domain/schema';

const fromAddress = () => decodeChoices(new URLSearchParams(typeof location === 'undefined' ? '' : (location.hash.split('?')[1] ?? '')));

const first = fromAddress();
/** False when the page was opened from an incomplete or altered link. */
export const openedFromValidLink = first.valid;

export const useChoices = create<{ choices: Choices }>(() => ({ choices: first.choices }));

/** The address of this visit, to share. */
export function shareUrl(c: Choices = useChoices.getState().choices): string {
  return `${location.origin}${location.pathname}#/?${encodeChoices(c)}`;
}

function writeAddress(c: Choices): void {
  // only on the tour page, and without a history entry per click
  const [path = ''] = location.hash.replace(/^#/, '').split('?');
  if (path !== '' && path !== '/') return;
  history.replaceState(history.state, '', `#/?${encodeChoices(c)}`);
}

export function setChoices(patch: Partial<Choices>): void {
  const current = useChoices.getState().choices;
  const next = { ...current, ...patch };
  if (encodeChoices(next) === encodeChoices(current)) return;
  useChoices.setState({ choices: next });
  writeAddress(next);
}

export function resetFinishes(): void {
  const { floor, walls, fronts, top } = DEFAULT_CHOICES;
  setChoices({ floor, walls, fronts, top });
}

/** A new address (back/forward, a pasted link) brings its choices along. */
if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    if (!location.hash.includes('?')) return;
    const { choices } = fromAddress();
    if (encodeChoices(choices) !== encodeChoices(useChoices.getState().choices)) useChoices.setState({ choices });
  });
}
