import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { installFreighterStub } from './support/freighter-stub';

/** A well-formed Stellar address for the simulated Freighter account. */
const PLAYER_ADDRESS = 'G' + 'A'.repeat(55);

/** Pages scanned for WCAG 2.0 / 2.1 Level A and AA violations. */
const PAGES = ['/'];

test.describe('accessibility audit (axe-core)', () => {
  for (const path of PAGES) {
    test(`has no WCAG A/AA violations on ${path}`, async ({ page }) => {
      await page.addInitScript(installFreighterStub, PLAYER_ADDRESS);
      await page.goto(path);

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      const summary = results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`);
      expect(summary).toEqual([]);
    });
  }
});
