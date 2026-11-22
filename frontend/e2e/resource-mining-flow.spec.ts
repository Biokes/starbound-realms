import { test, expect, type Page } from '@playwright/test';
import { installFreighterStub } from './support/freighter-stub';

const BACKEND_URL = 'http://localhost:3000';

/** A well-formed Stellar address for the simulated Freighter account. */
const PLAYER_ADDRESS = 'G' + 'A'.repeat(55);

/** Galaxy systems for testing. */
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

/** Player resource balances. After trustline setup, these should update. */
const PLAYER_BALANCES = {
  Iron: '100',
  Energy: '50',
  Plasma: '25',
};

/** Player fleet data. */
const PLAYER_FLEET = {
  scouts: 5,
  fighters: 2,
  cruisers: 1,
  dreadnoughts: 0,
  location: 1,
  last_moved: 0,
};

/**
 * Mocks backend API responses with CORS headers for cross-origin requests.
 */
async function mockBackend(page: Page): Promise<void> {
  const cors = { 'Access-Control-Allow-Origin': '*' };

  // Catch-all 404 for unmocked routes
  await page.route(`${BACKEND_URL}/**`, (route) =>
    route.fulfill({
      status: 404,
      headers: cors,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'not mocked in this test' }),
    })
  );

  // Galaxy data
  await page.route(`${BACKEND_URL}/galaxy`, (route) =>
    route.fulfill({
      headers: cors,
      contentType: 'application/json',
      body: JSON.stringify({ systems: GALAXY_ROWS, pagination: null }),
    })
  );

  // Player balances
  await page.route(`${BACKEND_URL}/player/${PLAYER_ADDRESS}/balances`, (route) =>
    route.fulfill({
      headers: cors,
      contentType: 'application/json',
      body: JSON.stringify(PLAYER_BALANCES),
    })
  );

  // Player fleet
  await page.route(`${BACKEND_URL}/player/${PLAYER_ADDRESS}/fleet`, (route) =>
    route.fulfill({
      headers: cors,
      contentType: 'application/json',
      body: JSON.stringify(PLAYER_FLEET),
    })
  );

  // Player profile
  await page.route(`${BACKEND_URL}/player/${PLAYER_ADDRESS}`, (route) =>
    route.fulfill({
      headers: cors,
      contentType: 'application/json',
      body: JSON.stringify({
        address: PLAYER_ADDRESS,
        systems_owned: 1,
        total_fleet_power: 100,
      }),
    })
  );

  // Recently active players (empty list is fine)
  await page.route(`${BACKEND_URL}/players/recently-active`, (route) =>
    route.fulfill({
      headers: cors,
      contentType: 'application/json',
      body: JSON.stringify({ players: [], pagination: null }),
    })
  );

  // Leaderboard (empty list is fine)
  await page.route(`${BACKEND_URL}/leaderboard`, (route) =>
    route.fulfill({
      headers: cors,
      contentType: 'application/json',
      body: JSON.stringify({ players: [], pagination: null }),
    })
  );

  // Recent battles (empty list is fine)
  await page.route(`${BACKEND_URL}/battles/recent`, (route) =>
    route.fulfill({
      headers: cors,
      contentType: 'application/json',
      body: JSON.stringify({ battles: [], pagination: null }),
    })
  );
}

test.describe('resource mining -> trustline setup -> balance display flow', () => {
  test('displays resource setup banner, sets up trustlines, and shows updated balances', async ({ page }) => {
    // Skip onboarding modal that covers the Connect button
    await page.addInitScript(() => {
      window.localStorage.setItem('starbound:onboarding-dismissed', 'true');
    });

    // Install Freighter stub with signing support
    await page.addInitScript(installFreighterStub, PLAYER_ADDRESS);

    // Block live network calls (Horizon, Soroban RPC) — only mocked backend is allowed
    await page.route('https://**', (route) => route.abort());

    // Mock the backend API
    await mockBackend(page);

    // Load the app
    await page.goto('/');

    // Step 1: Connect wallet
    await page.getByRole('button', { name: 'Connect Freighter' }).click();

    // Verify wallet is connected
    await expect(
      page.getByRole('button', { name: `Connected wallet: ${PLAYER_ADDRESS}` })
    ).toBeVisible();

    // Step 2: Verify the resource setup banner appears (trustlines not yet set)
    // The banner should tell the user to set up resources
    const setupBanner = page.locator('text=/can\'t hold.*yet/i');
    await expect(setupBanner).toBeVisible({ timeout: 5000 });

    // Step 3: Click the "Set up resources" button
    const setupButton = page.getByRole('button', { name: /set up resources/i });
    await expect(setupButton).toBeVisible();
    await setupButton.click();

    // Step 4: Wait for the button to show "Setting up..." state
    await expect(page.getByRole('button', { name: /setting up/i })).toBeVisible({ timeout: 3000 });

    // Step 5: Wait for setup to complete (button returns to normal state)
    // After setup, the banner should disappear
    await expect(setupBanner).not.toBeVisible({ timeout: 5000 });

    // Step 6: Verify resource balances are now displayed
    // The ResourceBalances component shows Iron, Energy, Plasma amounts
    await expect(page.getByText('Your Resources')).toBeVisible();
    await expect(page.getByText(PLAYER_BALANCES.Iron)).toBeVisible();
    await expect(page.getByText(PLAYER_BALANCES.Energy)).toBeVisible();
    await expect(page.getByText(PLAYER_BALANCES.Plasma)).toBeVisible();

    // Step 7: Verify resource symbols are displayed next to balances
    await expect(page.getByText('IRON')).toBeVisible();
    await expect(page.getByText('NRGY')).toBeVisible();
    await expect(page.getByText('PLSM')).toBeVisible();

    // Step 8: Verify the galaxy map is still visible and interactive
    await expect(page.getByRole('img', { name: 'Galaxy map' })).toBeVisible();
    await expect(page.getByTestId('galaxy-cell-1')).toBeVisible();
  });

  test('resource balances update after trustlines are established', async ({ page }) => {
    // This test specifically verifies the balance display re-fetches after trustline setup
    await page.addInitScript(() => {
      window.localStorage.setItem('starbound:onboarding-dismissed', 'true');
    });

    await page.addInitScript(installFreighterStub, PLAYER_ADDRESS);
    await page.route('https://**', (route) => route.abort());
    await mockBackend(page);

    await page.goto('/');
    await page.getByRole('button', { name: 'Connect Freighter' }).click();

    // Before setup, balances should not be visible (or show loading state)
    await expect(page.getByText('Your Resources')).not.toBeVisible();

    // Click setup
    await page.getByRole('button', { name: /set up resources/i }).click();

    // After setup completes, balances should appear
    await expect(page.getByText('Your Resources')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(PLAYER_BALANCES.Iron)).toBeVisible();
  });
});
