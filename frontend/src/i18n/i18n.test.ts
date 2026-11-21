import { describe, it, expect } from 'vitest';
import i18n from './index';

describe('i18n configuration', () => {
  it('initializes with English locale and resolves strings', () => {
    expect(i18n.language).toBe('en');
    expect(i18n.t('nav.brand')).toBe('✦ STARBOUND REALMS');
    expect(i18n.t('hero.connect')).toBe('Connect Freighter');
    expect(i18n.t('filters.allResources')).toBe('All Resources');
    expect(i18n.t('sidebar.title')).toBe('Owned Systems');
    expect(i18n.t('minimap.ariaLabel')).toBe('Galaxy minimap');
  });

  it('interpolates parameters correctly', () => {
    expect(i18n.t('galaxy.title', { systemId: 42, resourceType: 'Plasma' })).toBe('System 42 — Plasma');
    expect(i18n.t('hero.connected', { address: 'G123...456' })).toBe('✓ Connected — G123...456');
  });
});
