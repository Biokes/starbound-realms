import { describe, it, expect } from 'vitest';
import {
  ValidationError,
  validateStellarAddress,
  validateNonNegativeInteger,
  validatePositiveInteger,
} from './errors.js';

describe('validateStellarAddress (#237)', () => {
  it('accepts a valid account address starting with G', () => {
    expect(() => validateStellarAddress('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF')).not.toThrow();
  });

  it('accepts a valid contract address starting with C', () => {
    expect(() => validateStellarAddress('CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF')).not.toThrow();
  });

  it('rejects an empty string', () => {
    expect(() => validateStellarAddress('')).toThrow(ValidationError);
    expect(() => validateStellarAddress('')).toThrow('must be a non-empty string');
  });

  it('rejects null or undefined', () => {
    expect(() => validateStellarAddress(null as any)).toThrow(ValidationError);
    expect(() => validateStellarAddress(undefined as any)).toThrow(ValidationError);
  });

  it('rejects an address with wrong length', () => {
    expect(() => validateStellarAddress('GSHORT')).toThrow(ValidationError);
    expect(() => validateStellarAddress('GSHORT')).toThrow('Invalid address length');
  });

  it('rejects an address not starting with G or C', () => {
    expect(() => validateStellarAddress('XAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF')).toThrow(ValidationError);
    expect(() => validateStellarAddress('XAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF')).toThrow('must start with G');
  });

  it('rejects an address with invalid characters', () => {
    expect(() => validateStellarAddress('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA#WHF')).toThrow(ValidationError);
    expect(() => validateStellarAddress('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA#WHF')).toThrow('invalid characters');
  });
});

describe('validateNonNegativeInteger (#237)', () => {
  it('accepts zero', () => {
    expect(() => validateNonNegativeInteger(0, 'count')).not.toThrow();
  });

  it('accepts positive integers', () => {
    expect(() => validateNonNegativeInteger(1, 'count')).not.toThrow();
    expect(() => validateNonNegativeInteger(100, 'count')).not.toThrow();
  });

  it('rejects negative numbers', () => {
    expect(() => validateNonNegativeInteger(-1, 'systemId')).toThrow(ValidationError);
    expect(() => validateNonNegativeInteger(-1, 'systemId')).toThrow('must be non-negative');
  });

  it('rejects non-integers', () => {
    expect(() => validateNonNegativeInteger(1.5, 'count')).toThrow(ValidationError);
    expect(() => validateNonNegativeInteger(1.5, 'count')).toThrow('must be an integer');
  });

  it('rejects non-numbers', () => {
    expect(() => validateNonNegativeInteger('5' as any, 'count')).toThrow(ValidationError);
    expect(() => validateNonNegativeInteger(null as any, 'count')).toThrow(ValidationError);
  });
});

describe('validatePositiveInteger (#237)', () => {
  it('accepts positive integers', () => {
    expect(() => validatePositiveInteger(1, 'count')).not.toThrow();
    expect(() => validatePositiveInteger(100, 'count')).not.toThrow();
  });

  it('rejects zero', () => {
    expect(() => validatePositiveInteger(0, 'count')).toThrow(ValidationError);
    expect(() => validatePositiveInteger(0, 'count')).toThrow('must be positive');
  });

  it('rejects negative numbers', () => {
    expect(() => validatePositiveInteger(-1, 'count')).toThrow(ValidationError);
    expect(() => validatePositiveInteger(-1, 'count')).toThrow('must be positive');
  });

  it('rejects non-integers', () => {
    expect(() => validatePositiveInteger(1.5, 'count')).toThrow(ValidationError);
  });

  it('rejects non-numbers', () => {
    expect(() => validatePositiveInteger('5' as any, 'count')).toThrow(ValidationError);
  });
});
