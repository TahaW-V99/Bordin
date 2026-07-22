import { AsyncLocalStorage } from "node:async_hooks";

type AssetPaymentContext = {
  /** Whether the user has explicitly confirmed spending Football Credit. */
  allowFootballCredit: boolean;
};

const storage = new AsyncLocalStorage<AssetPaymentContext>();

/**
 * Runs `fn` within an asset-payment context so any spend performed downstream
 * (through {@link processAssetPayment} or the memory-db mirror) can read whether
 * the user confirmed Football Credit usage — without threading a boolean
 * through every service signature. Spend API routes wrap their handler with
 * this, passing the `allowFootballCredit` flag parsed from the request.
 */
export function runWithAssetPaymentContext<T>(
  allowFootballCredit: boolean,
  fn: () => Promise<T>,
): Promise<T> {
  return storage.run({ allowFootballCredit }, fn);
}

/** True when the current request confirmed spending Football Credit. */
export function isFootballCreditAllowed(): boolean {
  return storage.getStore()?.allowFootballCredit ?? false;
}
