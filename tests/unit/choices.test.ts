import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CHOICES } from '../../src/domain/schema';

/** The module reads the address when it loads: each test loads it fresh for the address it sets. */
async function load(hash: string) {
  history.replaceState(null, '', `/demo-visite-3d/${hash}`);
  vi.resetModules();
  return import('../../src/state/choices');
}

describe('choices in the address', () => {
  beforeEach(() => { history.replaceState(null, '', '/demo-visite-3d/'); });

  it('starts from the original finishes, and a change goes to the address without a history entry', async () => {
    const { useChoices, setChoices, shareUrl } = await load('');
    expect(useChoices.getState().choices).toEqual(DEFAULT_CHOICES);
    const length = history.length;
    setChoices({ walls: 'terre', light: 'nuit' });
    expect(location.hash).toBe('#/?sol=chene&murs=terre&facades=blanc&plan=quartz&meuble=1&lumiere=nuit&vue=maquette');
    expect(history.length).toBe(length);
    expect(shareUrl()).toBe(`${location.origin}/demo-visite-3d/#/?sol=chene&murs=terre&facades=blanc&plan=quartz&meuble=1&lumiere=nuit&vue=maquette`);
  });

  it('reopens a shared visit, and keeps the plan page address as it is', async () => {
    const { useChoices, setChoices, openedFromValidLink } = await load('#/?sol=beton&murs=lin&facades=noir&plan=chene&meuble=0&lumiere=matin&vue=chambre2');
    expect(openedFromValidLink).toBe(true);
    expect(useChoices.getState().choices).toEqual({ floor: 'beton', walls: 'lin', fronts: 'noir', top: 'chene', furnished: false, light: 'matin', view: 'chambre2' });
    history.replaceState(null, '', '/demo-visite-3d/#/plan');
    setChoices({ floor: 'carrelage' });
    expect(location.hash).toBe('#/plan');
    expect(useChoices.getState().choices.floor).toBe('carrelage');
  });

  it('flags an altered link and keeps only what is valid in it', async () => {
    const { useChoices, openedFromValidLink } = await load('#/?sol=marbre&murs=sauge&vue=%3Cscript%3E');
    expect(openedFromValidLink).toBe(false);
    expect(useChoices.getState().choices).toEqual({ ...DEFAULT_CHOICES, walls: 'sauge' });
  });

  it('puts the original finishes back, lighting and view untouched', async () => {
    const { useChoices, setChoices, resetFinishes } = await load('');
    setChoices({ floor: 'beton', fronts: 'sauge', light: 'coucher', view: 'sejour' });
    resetFinishes();
    expect(useChoices.getState().choices).toEqual({ ...DEFAULT_CHOICES, light: 'coucher', view: 'sejour' });
  });
});
