import { headers } from "next/headers";
import { StorePage } from "@/features/store/components/store-page";
import { isStoreSellTabVisibleForHost } from "@/shared/lib/environment";

export default async function StoreRoute() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "";
  const sellTabVisible = isStoreSellTabVisibleForHost(host);

  return <StorePage sellTabVisible={sellTabVisible} />;
}
