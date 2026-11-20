import { describe, it, expect } from 'vitest';
import { formatTimeAgo, truncateAddress } from './format';

describe('truncateAddress', () => {
  it('shows the first 6 and last 4 characters, joined by an ellipsis', () => {
    expect(truncateAddress('GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOPQR'))
      .toBe('GABCDE...OPQR');
  });

  it('returns a short address unchanged rather than mangling it', () => {
    expect(truncateAddress('GSHORT')).toBe('GSHORT');
  });
});

describe('formatTimeAgo', () => {
  const now = new Date('2026-11-20T12:00:00.000Z');

  it('says "just now" for anything under a minute', () => {
    expect(formatTimeAgo('2026-11-20T11:59:30.000Z', now)).toBe('just now');
  });

  it('uses minutes, hours, then days', () => {
    expect(formatTimeAgo('2026-11-20T11:55:00.000Z', now)).toBe('5m ago');
    expect(formatTimeAgo('2026-11-20T09:00:00.000Z', now)).toBe('3h ago');
    expect(formatTimeAgo('2026-11-18T12:00:00.000Z', now)).toBe('2d ago');
  });

  it('treats a timestamp slightly in the future as "just now"', () => {
    expect(formatTimeAgo('2026-11-20T12:00:05.000Z', now)).toBe('just now');
  });

  it('returns "unknown" for an unparseable timestamp', () => {
    expect(formatTimeAgo('not a date', now)).toBe('unknown');
  });
});
