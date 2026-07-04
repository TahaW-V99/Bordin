export const OTP_TTL_MS = 2 * 60 * 1000;
export const MAX_OTP_VERIFY_ATTEMPTS = 5;
export const OTP_RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
export const MAX_OTP_SENDS_PER_WINDOW = 5;
export const MAX_PASSWORD_ATTEMPTS = 5;
export const PASSWORD_LOCK_MS = 15 * 60 * 1000;

/** Test/admin phones that always get a fixed OTP (no real SMS). Used on bordin.ir. */
export const FIXED_OTP_BY_PHONE: Record<string, string> = {
  "09120000000": "123456",
  "09120000001": "123456",
};
