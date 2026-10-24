import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, scene, test } from './fixtures';

const axe = async (page: Page) => {
  // entrance animations: measure contrast once the finite ones are over (a slow runner catches them halfway)
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity));
  return new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
};
const serious = (r: Awaited<ReturnType<typeof axe>>) =>
  r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`);

test.describe('accessibility (axe, WCAG 2.2 AA)', () => {
  test('tour, in a room with a point of interest open', async ({ page }) => {
    await page.goto('./');
    await scene(page);
    await page.locator('.views').getByRole('button', { name: 'Séjour et cuisine' }).click();
    await page.locator('.spot').first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(serious(await axe(page))).toEqual([]);
  });
  test('floor plan', async ({ page }) => {
    await page.goto('./#/plan');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(serious(await axe(page))).toEqual([]);
  });
  test('the tour can be driven without a mouse', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard');
    await page.goto('./');
    await page.keyboard.press('Tab'); // the first key press starts the 3D on a desktop
    await expect(page.locator('.stage-ready canvas')).toBeVisible({ timeout: 45_000 });
    const room = page.locator('.views').getByRole('button', { name: 'Salle d’eau' });
    await room.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/vue=sdb/);
    const plan = page.locator('.mini-plan').getByRole('button', { name: 'Entrée' });
    await plan.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/vue=entree/);
  });
});

test.describe('security and privacy', () => {
  test('ships a strict CSP with Trusted Types', async ({ page }) => {
    await page.goto('./');
    const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("script-src 'self' 'sha256-");
    expect(csp).toContain("require-trusted-types-for 'script'");
  });

  test.describe('with the violation expected', () => {
    test.use({ allowedConsole: /TrustedHTML|Trusted Type/ });
    test('the browser refuses raw HTML injection', async ({ page }) => {
      await page.goto('./');
      const result = await page.evaluate(() => {
        // eslint-disable-next-line no-restricted-properties -- this test proves the browser blocks it
        try { document.createElement('div').innerHTML = '<img src=x onerror=alert(1)>'; return 'allowed'; } catch { return 'blocked'; }
      });
      expect(result).toBe('blocked');
    });
  });

  test('an altered link keeps only what is valid, and says so', async ({ page }) => {
    await page.goto('./#/?sol=marbre&murs=sauge&lumiere=nuit&vue=%3Cscript%3E');
    await expect(page.locator('.toast')).toContainText('Ce lien était incomplet ou modifié');
    await expect(page.getByRole('group', { name: /Sol des pièces sèches/ }).getByRole('radio', { name: /Parquet chêne/ })).toBeChecked();
    await expect(page.getByRole('group', { name: /Couleur des murs/ }).getByRole('radio', { name: 'Vert sauge' })).toBeChecked();
  });

  test('no request leaves the site: no tracker, font or CDN', async ({ page }) => {
    const origins = new Set<string>();
    page.on('request', (r) => { if (!r.url().startsWith('data:') && !r.url().startsWith('blob:')) origins.add(new URL(r.url()).origin); });
    await page.goto('./');
    await scene(page);
    await page.locator('.views').getByRole('button', { name: 'Chambre 1' }).click();
    await page.getByRole('link', { name: 'Plan et surfaces' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect([...origins]).toEqual([new URL(page.url()).origin]);
    expect(await page.evaluate(() => document.cookie)).toBe('');
  });
});

test('works offline once visited, 3D included (service worker)', async ({ page, context, isMobile }) => {
  test.skip(isMobile, 'same code path as desktop');
  await page.goto('./');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'T3 traversant avec balcon, Lyon 7e' })).toBeVisible();
  await scene(page); // the 3D code and its textures are precached
  await page.getByRole('link', { name: 'Plan et surfaces' }).click(); // lazy-loaded screen, precached
  await expect(page.getByRole('heading', { level: 1, name: 'Plan et surfaces' })).toBeVisible();
  await context.setOffline(false);
});
