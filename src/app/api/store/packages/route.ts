import { withAuth, jsonOk } from "@/shared/lib/api-route";
import { isStoreSellEnabled } from "@/shared/lib/environment";
import {
  getPurchaseHistory,
  getSellPackages,
  getStoreCatalog,
  getStoreWallet,
} from "@/server/services/store-service";

export const GET = withAuth(async (userId) => {
  const catalog = await getStoreCatalog();
  const sellPackages = isStoreSellEnabled() ? await getSellPackages() : [];

  let wallet = null;
  let purchaseHistory: Awaited<ReturnType<typeof getPurchaseHistory>> = [];

  try {
    wallet = await getStoreWallet(userId);
  } catch (error) {
    console.error("[store] wallet load failed:", error);
  }

  try {
    purchaseHistory = await getPurchaseHistory(userId);
  } catch (error) {
    console.error("[store] purchase history load failed:", error);
  }

  return jsonOk({
    catalog,
    // Backward-compatible alias for older clients
    packages: catalog.coins,
    sellPackages,
    wallet,
    purchaseHistory,
  });
});
