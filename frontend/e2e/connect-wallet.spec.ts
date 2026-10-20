import { test, expect, type Page } from '@playwright/test';
import { installFreighterStub } from './support/freighter-stub';

const BACKEND_URL = 'http://localhost:3000';

/** A well-formed Stellar address for the simulated Freighter account. */
const PLAYER_ADDRESS = 'G' + 'A'.repeat(55);

/** Galaxy rows as `GET /galaxy` returns them: snake_case columns, string `last_claimed`. */
const GALAXY_ROWS = [
  {
    system_id: 1,
    owner: null,
    coord_x: 0,
    coord_y: 0,
    resource_type: 'Iron',
    resource_yield: 10,
    defense_rating: 5,
    last_claimed: '0',
  },
  {
    system_id: 2,
    owner: null,
    coord_x: 1,
    coord_y: 0,
    resource_type: 'Energy',
    resource_yield: 8,
    defense_rating: 3,
    last_claimed: '0',
  },
];

/**
 * Answers the backend's routes from fixtures. Responses are cross-origin (the
 * app runs on the Vite port), so each one needs the CORS header to be readable.
 */
async function mockBackend(page: Page): Promise<void> {
  const cors = { 'Access-Control-Allow-Origin': '*' };

  // Playwright matches the most recently added route first, so the catch-all goes
  // in before the specific /galaxy route. Other backend routes get a 404, which
  // keeps their panels in the empty state.
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

test.describe('connect wallet to galaxy', () => {
  test('connects Freighter and renders the galaxy map', async ({ page }) => {
    // Skip the first-visit onboarding modal, which would otherwise cover the Connect button.
    // Key matches ONBOARDING_STORAGE_KEY in src/components/OnboardingModal.tsx.
    await page.addInitScript(() => {
      window.localStorage.setItem('starbound:onboarding-dismissed', 'true');
    });
    await page.addInitScript(installFreighterStub, PLAYER_ADDRESS);
    // Horizon and Soroban RPC calls would hit the live network; they are not under test.
    await page.route('https://**', (route) => route.abort());
    await mockBackend(page);

    await page.goto('/');
    await page.getByRole('button', { name: 'Connect Freighter' }).click();

    await expect(
      page.getByRole('button', { name: `Connected wallet: ${PLAYER_ADDRESS}` })
    ).toBeVisible();
    await expect(page.getByRole('img', { name: 'Galaxy map' })).toBeVisible();
    await expect(page.getByTestId('galaxy-cell-1')).toBeVisible();
    await expect(page.getByTestId('galaxy-cell-2')).toBeVisible();
  });
});
