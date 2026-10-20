import { describe, it, expect, vi } from 'vitest';
import { parseStellarAddress, parseIntegerId, validateParam } from './validators';

/** Returns whatever the callback throws, so its properties can be asserted. */
function getThrown(fn: () => unknown): unknown {
  try {
    fn();
  } catch (err) {
    return err;
  }
  return undefined;
}

describe('parseStellarAddress', () => {
  it('accepts a 56-character G-prefixed base32 public key', () => {
    const address = 'G' + 'A'.repeat(55);

    expect(parseStellarAddress(address)).toBe(address);
  });

  it.each([
    ['wrong prefix', 'S' + 'A'.repeat(55)],
    ['too short', 'G' + 'A'.repeat(54)],
    ['too long', 'G' + 'A'.repeat(56)],
    ['character outside base32', 'G' + '0'.repeat(55)],
    ['lowercase letters', 'G' + 'a'.repeat(55)],
  ])('rejects a value with %s', (_label, value) => {
    expect(() => parseStellarAddress(value)).toThrow('Invalid Stellar address');
    expect(getThrown(() => parseStellarAddress(value))).toHaveProperty('statusCode', 400);
  });
});

describe('parseIntegerId', () => {
  it('parses a plain non-negative integer', () => {
    expect(parseIntegerId('42', 'system ID')).toBe(42);
  });

  it('accepts zero', () => {
    expect(parseIntegerId('0', 'system ID')).toBe(0);
  });

  it.each([
    ['trailing characters', '12abc'],
    ['a sign', '-1'],
    ['a decimal', '1.5'],
    ['whitespace', ' 7 '],
    ['an empty string', ''],
  ])('rejects %s', (_label, raw) => {
    expect(() => parseIntegerId(raw, 'system ID')).toThrow('Invalid system ID');
  });

  it('rejects values above the given maximum', () => {
    expect(() => parseIntegerId('2147483648', 'system ID', 2147483647)).toThrow('Invalid system ID');
  });

  it('rejects values beyond the safe integer range', () => {
    expect(() => parseIntegerId('99999999999999999999', 'battle ID')).toThrow('Invalid battle ID');
  });
});

describe('validateParam', () => {
  it('calls next() without arguments when the value is valid', () => {
    const next = vi.fn();

    validateParam((raw: string) => parseIntegerId(raw, 'system ID'))({} as any, {} as any, next, '5');

    expect(next).toHaveBeenCalledWith();
  });

  it('forwards the thrown error to next() when the value is invalid', () => {
    const next = vi.fn();

    validateParam((raw: string) => parseStellarAddress(raw))({} as any, {} as any, next, 'bad');

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
  });
});
