import { test, expect, type Page } from '@playwright/test';

/**
 * Claim -> build -> move -> battle against Stellar testnet (#247).
 *
 * Testnet-only and manual. Each step is a real signed transaction that changes
 * on-chain state, so this cannot run in CI. It is skipped unless E2E_TESTNET=1.
 *
 * Requirements:
 * - A headed browser with a Freighter wallet installed, signed in to a funded
 *   testnet account. The Freighter stub used by the other specs does not sign
 *   transactions, so it cannot drive this loop.
 * - E2E_MOVE_TARGET=<system id>: a system adjacent to the fleet's current
 *   location. The contract rejects moves to non-adjacent systems.
 * - At least one unclaimed system on the galaxy map.
 *
 * Chain state persists between runs. `move_fleet` has a cooldown, so wait for
 * it to pass before running the test again.
 */
test.skip(
  !process.env.E2E_TESTNET || !process.env.E2E_MOVE_TARGET,
  'testnet-only: set E2E_TESTNET=1 and E2E_MOVE_TARGET=<adjacent system id>'
);

/** Each transaction waits for testnet confirmation, so the wait budget is generous. */
const CHAIN_WAIT = { timeout: 120_000 };

/** Reads the count shown for a unit type in the "Your Fleet" panel, e.g. 5 from "5Scouts". */
async function readUnitCount(page: Page, label: string): Promise<number> {
  const cell = page.locator('div').filter({ hasText: new RegExp(`^\\d+${label}$`) }).first();
  const text = await cell.locator('span').first().textContent();
  return Number(text);
}

function galaxyCell(page: Page, systemId: number) {
  return page.getByTestId(`galaxy-cell-${systemId}`);
}

function systemDrawer(page: Page, systemId: number) {
  return page.getByRole('dialog', { name: `System ${systemId}`, exact: true });
}

/** Parses the system id out of a galaxy cell's `galaxy-cell-<id>` test id. */
async function systemIdOf(cell: ReturnType<Page['locator']>): Promise<number> {
  const testId = await cell.getAttribute('data-testid');
  return Number(testId!.replace('galaxy-cell-', ''));
}

test('claim -> build -> move -> battle reflects the on-chain outcome at each step', async ({
  page,
}) => {
  test.setTimeout(10 * 60_000);

  await page.goto('/');
  await page.getByRole('button', { name: 'Connect Freighter' }).click();
  // Approve the connection in the Freighter window when it opens.
  await expect(page.getByRole('button', { name: /^Connected wallet: G/ })).toBeVisible(
    CHAIN_WAIT
  );

  // 1. Claim the first unclaimed system.
  const unclaimed = page
    .locator('[data-testid^="galaxy-cell-"][aria-label*="unclaimed"]')
    .first();
  await expect(unclaimed).toBeVisible(CHAIN_WAIT);
  const claimedId = await systemIdOf(unclaimed);

  await unclaimed.click();
  await systemDrawer(page, claimedId).getByRole('button', { name: 'Claim System' }).click();

  // Claiming refreshes the galaxy and closes the drawer. The cell then reads "owned by you".
  await expect(galaxyCell(page, claimedId)).toHaveAttribute(
    'aria-label',
    /owned by you/,
    CHAIN_WAIT
  );

  // 2. Build one Scout and check the fleet count goes up by one.
  const scoutsBefore = await readUnitCount(page, 'Scouts');
  const scoutsAfterBuild = scoutsBefore + 1;
  await page.getByLabel('Unit type').selectOption('Scout');
  await page.getByLabel('Count', { exact: true }).fill('1');
  await page.getByRole('button', { name: 'Build' }).click();
  await expect.poll(() => readUnitCount(page, 'Scouts'), CHAIN_WAIT).toBe(scoutsAfterBuild);

  // 3. Move the fleet to the adjacent system given in E2E_MOVE_TARGET.
  const moveTarget = Number(process.env.E2E_MOVE_TARGET);
  await galaxyCell(page, moveTarget).click();
  await systemDrawer(page, moveTarget).getByRole('button', { name: 'Move Fleet Here' }).click();

  // Moving closes the drawer. Reopening the destination shows no "Move Fleet Here"
  // button, because the fleet is now stationed there.
  await expect(systemDrawer(page, moveTarget)).toBeHidden(CHAIN_WAIT);
  await galaxyCell(page, moveTarget).click();
  const destination = systemDrawer(page, moveTarget);
  await expect(destination).toBeVisible();
  await expect(destination.getByRole('button', { name: 'Move Fleet Here' })).toHaveCount(0);
  await destination.getByRole('button', { name: 'Close system details' }).click();

  // 4. Attack a system owned by another player and check the battle outcome.
  const enemy = page.locator('[data-testid^="galaxy-cell-"][aria-label*="owned by G"]').first();
  await expect(enemy).toBeVisible(CHAIN_WAIT);
  const enemyId = await systemIdOf(enemy);

  await enemy.click();
  await systemDrawer(page, enemyId).getByRole('button', { name: 'Attack' }).click();

  // The result line is "Victory! ..." or "Defeat. ...", depending on the on-chain winner.
  await expect(page.getByText(/^(Victory!|Defeat\.)/)).toBeVisible(CHAIN_WAIT);
  await expect(page.getByRole('heading', { name: 'Battle History' })).toBeVisible();
});
