import { test, expect, type Page } from '@playwright/test';
import { installFreighterStub } from './support/freighter-stub';

const BACKEND_URL = 'http://localhost:3000';

/** A well-formed Stellar address for the simulated Freighter account. */
const PLAYER_ADDRESS = 'G' + 'A'.repeat(55);

/** Fixed galaxy so every screenshot draws the same map. */
const GALAXY_ROWS = [
  {
    system_id: 1,
    owner: PLAYER_ADDRESS,
    coord_x: 0,
    coord_y: 0,
    resource_type: 'Iron',
    resource_yield: 50,
    defense_rating: 5,
    last_claimed: '0',
  },
  {
    system_id: 2,
    owner: null,
    coord_x: 1,
    coord_y: 0,
    resource_type: 'Energy',
    resource_yield: 30,
    defense_rating: 3,
    last_claimed: '0',
  },
];

/**
 * Tolerance for pixel differences. Anti-aliasing can vary slightly between
 * runs, so a small fraction of differing pixels is allowed.
 */
const SNAPSHOT_OPTIONS = { animations: 'disabled', maxDiffPixelRatio: 0.01 } as const;

/**
 * Answers the backend's routes from fixtures, with the CORS header so the
 * cross-origin responses are readable. Unmocked routes return 404.
 */
async function mockBackend(page: Page): Promise<void> {
  const cors = { 'Access-Control-Allow-Origin': '*' };

  await page.route(`${BACKEND_URL}/**`, (route) =>
    route.fulfill({
      status: 404,
      headers: cors,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'not mocked in this test' }),
    })
  );

  await page.route(`${BACKEND_URL}/galaxy`, (route) =>
    route.fulfill({
      headers: cors,
      contentType: 'application/json',
      body: JSON.stringify({ systems: GALAXY_ROWS, pagination: null }),
    })
  );
}

/** Connects the simulated wallet and waits until the game view is showing. */
async function connectWallet(page: Page): Promise<void> {
  await page.addInitScript(installFreighterStub, PLAYER_ADDRESS);
  await page.goto('/');
  await page.getByRole('button', { name: 'Connect Freighter' }).click();
  await expect(
    page.getByRole('button', { name: `Connected wallet: ${PLAYER_ADDRESS}` })
  ).toBeVisible();
}

test.describe('visual regression', () => {
  test.beforeEach(async ({ page }) => {
    // Skip the first-visit onboarding modal so it can't cover the screens under test.
    // Key matches ONBOARDING_STORAGE_KEY in src/components/OnboardingModal.tsx.
    await page.addInitScript(() => {
      window.localStorage.setItem('starbound:onboarding-dismissed', 'true');
    });
    // Horizon and Soroban RPC are not under test; blocking them keeps screenshots
    // independent of the network.
    await page.route('https://**', (route) => route.abort());
    await mockBackend(page);
  });

  test('landing page', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Connect Freighter' })).toBeVisible();

    await expect(page).toHaveScreenshot('landing-page.png', {
      ...SNAPSHOT_OPTIONS,
      fullPage: true,
    });
  });

  test('galaxy map', async ({ page }) => {
    await connectWallet(page);

    const map = page.getByRole('img', { name: 'Galaxy map' });
    await expect(map).toBeVisible();

    await expect(map).toHaveScreenshot('galaxy-map.png', SNAPSHOT_OPTIONS);
  });

  test('system drawer', async ({ page }) => {
    await connectWallet(page);

    await page.getByTestId('galaxy-cell-2').click();
    const drawer = page.getByRole('dialog', { name: 'System 2', exact: true });
    await expect(drawer).toBeVisible();

    await expect(drawer).toHaveScreenshot('system-drawer.png', SNAPSHOT_OPTIONS);
  });
});
