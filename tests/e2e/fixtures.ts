// Shared Playwright fixtures: any console error or uncaught exception fails the test, so a CSP or
// Trusted Types violation anywhere in a flow is caught, not just in the tests written for it.
import { test as base, expect, type Page } from '@playwright/test';

export const test = base.extend<{ allowedConsole: RegExp | null; consoleErrors: string[] }>({
  allowedConsole: [null, { option: true }],
  // a first visit starts on the inert pre-rendered copy (build/prerender.ts): navigations wait until the
  // app has replaced it, as a person would, unless a test asks to look at the copy (waitUntil: 'commit')
  page: async ({ page }, use) => {
    const goto = page.goto.bind(page);
    const reload = page.reload.bind(page);
    const live = async (waitUntil?: string) => { if (waitUntil !== 'commit') await page.locator('[data-prerendered]').waitFor({ state: 'detached' }); };
    page.goto = async (url, options) => { const response = await goto(url, options); await live(options?.waitUntil); return response; };
    page.reload = async (options) => { const response = await reload(options); await live(options?.waitUntil); return response; };
    await use(page);
  },
  consoleErrors: [async ({ page, allowedConsole }, use) => {
    const errors: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error' && !(allowedConsole?.test(m.text()))) errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(`uncaught: ${e.message}`));
    await use(errors);
    expect(errors, 'console errors').toEqual([]);
  }, { auto: true }],
});
export { expect };

/** Starts the 3D tour (a tap on phones, any move of the mouse on a desktop) and waits until it draws. */
export async function scene(page: Page): Promise<void> {
  const start = page.getByRole('button', { name: 'Lancer la visite 3D' });
  // a desktop starts at the first move of the mouse (or scroll), maybe before the click lands; a phone waits for the tap
  await expect(async () => {
    await page.mouse.move(5 + Math.random() * 20, 5);
    if (await start.isVisible()) await start.click({ timeout: 2000 }).catch(() => undefined);
    await expect(page.locator('.stage-loading, .stage-ready')).toHaveCount(1, { timeout: 2000 });
  }).toPass({ timeout: 20_000 });
  await expect(page.locator('.stage-ready canvas')).toBeVisible({ timeout: 45_000 });
}

/** Where the address says the visitor stands and what they picked. */
export async function chosen(page: Page): Promise<Record<string, string>> {
  return Object.fromEntries(new URLSearchParams(new URL(page.url()).hash.split('?')[1] ?? ''));
}
