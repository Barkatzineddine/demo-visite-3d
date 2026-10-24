import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { chosen, expect, scene, test } from './fixtures';

const views = (page: Page) => page.locator('.views');
const marker = (page: Page) => page.locator('.mini-plan .plan-marker');
const group = (page: Page, name: RegExp) => page.getByRole('group', { name });

/** Opens the tour and steps into the living room (the flight takes about a second). */
async function inLivingRoom(page: Page) {
  await page.goto('./');
  await scene(page);
  await views(page).getByRole('button', { name: 'Séjour et cuisine' }).click();
  await expect(marker(page)).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(300);
}

test.describe('the tour', () => {
  test('flies from the dollhouse into a room and back, the address following', async ({ page }) => {
    await page.goto('./');
    await scene(page);
    await expect(views(page).getByRole('button', { name: 'Maquette' })).toHaveAttribute('aria-pressed', 'true');
    await views(page).getByRole('button', { name: 'Chambre 1' }).click();
    await expect.poll(() => chosen(page)).toMatchObject({ vue: 'chambre1' });
    await expect(page.locator('.stage-3d')).toHaveAttribute('aria-label', /Chambre 1/);
    await expect(page.locator('.mini-plan [aria-current=location]')).toHaveAccessibleName('Chambre 1');

    // the room's point of interest
    await page.getByRole('button', { name: 'En savoir plus : Chambre parentale' }).click();
    await expect(page.getByRole('dialog', { name: 'Chambre parentale' })).toContainText(/12,2\s?m²/);
    await page.getByRole('button', { name: 'Fermer' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await views(page).getByRole('button', { name: 'Maquette' }).click();
    await expect.poll(() => chosen(page)).toMatchObject({ vue: 'maquette' });
    await expect(marker(page)).toHaveCount(0);
  });

  test('goes to a room from the small plan', async ({ page }) => {
    await page.goto('./');
    await scene(page);
    await page.locator('.mini-plan').getByRole('button', { name: 'Chambre 2' }).click();
    await expect.poll(() => chosen(page)).toMatchObject({ vue: 'chambre2' });
    await expect(marker(page)).toBeVisible({ timeout: 20_000 });
  });

  test('walks with the keyboard, and the plan shows where and which way', async ({ page, isMobile }) => {
    test.skip(isMobile, 'no keyboard on a phone: the next test walks by touch');
    await inLivingRoom(page);
    const before = await marker(page).getAttribute('transform');
    await page.locator('.tour-canvas').focus();
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(700);
    await page.keyboard.up('ArrowUp');
    await expect.poll(() => marker(page).getAttribute('transform')).not.toBe(before);
    const moved = await marker(page).getAttribute('transform');
    await page.keyboard.down('ArrowLeft');
    await page.waitForTimeout(400);
    await page.keyboard.up('ArrowLeft');
    await expect.poll(() => marker(page).getAttribute('transform')).not.toBe(moved);
  });

  test('walks to the spot of the floor that is clicked or tapped', async ({ page, isMobile }) => {
    await inLivingRoom(page);
    const before = await marker(page).getAttribute('transform');
    await page.locator('.tour-canvas').scrollIntoViewIfNeeded();
    const box = await page.locator('.tour-canvas').boundingBox();
    if (!box) throw new Error('no canvas');
    const at = { x: box.x + box.width * 0.5, y: box.y + box.height * 0.88 };
    if (isMobile) await page.touchscreen.tap(at.x, at.y);
    else await page.mouse.click(at.x, at.y);
    await expect.poll(() => marker(page).getAttribute('transform'), { timeout: 8000 }).not.toBe(before);
  });

  test('changes finishes, light and furnishing live; the link keeps them', async ({ page }) => {
    await page.goto('./');
    await scene(page);
    await group(page, /Sol des pièces sèches/).locator('label', { hasText: 'Béton ciré' }).click();
    await group(page, /Couleur des murs/).locator('label', { hasText: 'Vert sauge' }).click();
    await group(page, /Façades de cuisine/).locator('label', { hasText: 'Noir mat' }).click();
    await group(page, /Plan de travail/).locator('label', { hasText: 'Chêne massif' }).click();
    await page.getByRole('radio', { name: 'Nuit' }).click();
    await page.getByRole('checkbox', { name: 'Meublé' }).uncheck();
    const picked = { sol: 'beton', murs: 'sauge', facades: 'noir', plan: 'chene', lumiere: 'nuit', meuble: '0' };
    await expect.poll(() => chosen(page)).toMatchObject(picked);

    await page.reload();
    await expect(group(page, /Sol des pièces sèches/).getByRole('radio', { name: 'Béton ciré' })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: 'Meublé' })).not.toBeChecked();
    await scene(page);
    await expect(page.getByRole('radio', { name: 'Nuit' })).toHaveAttribute('aria-checked', 'true');

    await page.getByRole('button', { name: 'Revenir aux finitions d’origine' }).click();
    await expect.poll(() => chosen(page)).toMatchObject({ sol: 'chene', murs: 'blanc', facades: 'blanc', plan: 'quartz', lumiere: 'nuit' });
  });

  test('copies a link that reopens the same visit', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('./');
    await group(page, /Couleur des murs/).locator('label', { hasText: 'Terre cuite' }).click();
    await page.getByRole('button', { name: 'Copier le lien' }).click();
    await expect(page.locator('.toast')).toContainText('Lien copié');
    const link = await page.evaluate(() => navigator.clipboard.readText());
    expect(link).toContain('murs=terre');
    const other = await context.newPage();
    await other.goto(link);
    await expect(group(other, /Couleur des murs/).getByRole('radio', { name: 'Terre cuite' })).toBeChecked();
  });

  test('downloads a two-page PDF sheet with the view on screen, and a picture', async ({ page }) => {
    await page.goto('./');
    await scene(page);
    const [pdf] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Fiche PDF' }).click()]);
    expect(pdf.suggestedFilename()).toBe('fiche-VL-T3-0716.pdf');
    const bytes = readFileSync(await pdf.path()).toString('latin1');
    expect(bytes.startsWith('%PDF-1.4')).toBe(true);
    expect(bytes).toContain('/Count 2');
    expect(bytes).toContain('/DCTDecode');
    await expect(page.locator('.toast')).toContainText('Fiche PDF téléchargée');

    const [jpg] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Image' }).click()]);
    expect(jpg.suggestedFilename()).toBe('visite-maquette.jpg');
    expect([...readFileSync(await jpg.path()).subarray(0, 2)]).toEqual([0xff, 0xd8]);
  });

  test('a phone loads the 3D only when asked', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'phones only');
    const engine: string[] = [];
    page.on('request', (r) => { if (/\/assets\/Engine-/.test(r.url())) engine.push(r.url()); });
    await page.goto('./');
    await page.mouse.move(20, 20);
    await page.waitForTimeout(1500);
    await expect(page.locator('canvas')).toHaveCount(0);
    expect(engine).toEqual([]);
    await page.getByRole('button', { name: 'Lancer la visite 3D' }).tap();
    await expect(page.locator('.stage-ready canvas')).toBeVisible({ timeout: 45_000 });
    expect(engine).toHaveLength(1);
  });

  test('without WebGL, the dollhouse picture and the plan stay', async ({ page }) => {
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function getContext(this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
        return type.startsWith('webgl') ? null : (original as (...a: unknown[]) => RenderingContext | null).call(this, type, ...rest);
      } as typeof original;
    });
    await page.goto('./');
    await page.getByRole('button', { name: 'Lancer la visite 3D' }).click().catch(() => undefined);
    await page.mouse.move(30, 30);
    await expect(page.getByText('La 3D n’est pas disponible')).toBeVisible();
    await expect(page.getByRole('img', { name: /Maquette 3D de l’appartement/ })).toBeVisible();
    await page.getByRole('link', { name: 'Plan et surfaces' }).click();
    await expect(page.getByRole('img', { name: /Plan de l’appartement/ })).toBeVisible();
  });
});

test.describe('floor plan', () => {
  test('lists each room with its size and area, and opens one in 3D', async ({ page }) => {
    await page.goto('./#/plan');
    await expect(page.getByRole('heading', { level: 1, name: 'Plan et surfaces' })).toBeVisible();
    const rows = page.locator('.areas tbody tr');
    await expect(rows).toHaveCount(7);
    await expect(rows.first()).toContainText(/Séjour et cuisine\s*6,15 × 4,55 m\s*27,98\s?m²/);
    await expect(page.locator('.areas .total')).toContainText(/66,82\s?m²/);
    await page.getByRole('link', { name: 'Voir en 3D, Chambre 2' }).click();
    await expect.poll(() => chosen(page)).toMatchObject({ vue: 'chambre2' });
    await scene(page);
    await expect(page.locator('.stage-3d')).toHaveAttribute('aria-label', /Chambre 2/);
  });
});

test('speaks English, and remembers it', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dual-aspect two-bedroom flat with balcony, Lyon 7th');
  await page.reload();
  await expect(page.getByRole('link', { name: 'Floor plan' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});
