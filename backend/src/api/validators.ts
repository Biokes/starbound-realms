import { Request, Response, NextFunction } from 'express';

/** Largest value a Postgres INTEGER column holds; system ids are stored as INTEGER (#141). */
export const MAX_INTEGER_ID = 2_147_483_647;

/** A Stellar ed25519 public key (StrKey): "G" followed by 55 base32 characters (A–Z, 2–7). */
const STELLAR_PUBLIC_KEY = /^G[A-Z2-7]{55}$/;

/** Digits only, so values like "12abc", "-1", "1.5" or " 7 " are rejected rather than truncated. */
const UNSIGNED_INTEGER = /^\d+$/;

/** Throws a 400 error that the error handler turns into a JSON response. */
function badRequest(message: string): Error {
  return Object.assign(new Error(message), { statusCode: 400 });
}

/** Returns the address when it is a well-formed Stellar public key; otherwise throws a 400. */
export function parseStellarAddress(raw: string): string {
  if (!STELLAR_PUBLIC_KEY.test(raw)) {
    throw badRequest('Invalid Stellar address');
  }
  return raw;
}

/**
 * Returns a non-negative integer id no larger than `max`. Throws a 400 whose
 * message names the id (e.g. "Invalid system ID") when the value is malformed.
 */
export function parseIntegerId(raw: string, label: string, max = Number.MAX_SAFE_INTEGER): number {
  if (!UNSIGNED_INTEGER.test(raw)) {
    throw badRequest(`Invalid ${label}`);
  }
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id > max) {
    throw badRequest(`Invalid ${label}`);
  }
  return id;
}

/**
 * Wraps a parser as a `router.param` callback, so a route parameter is checked
 * before any handler for that route runs. A thrown 400 goes to the error handler.
 */
export function validateParam(parse: (raw: string) => unknown) {
  return (_req: Request, _res: Response, next: NextFunction, value: string) => {
    try {
      parse(value);
      next();
    } catch (err) {
      next(err);
    }
  };
}
