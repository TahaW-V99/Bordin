import { headers } from "next/headers";
import { StorePage } from "@/features/store/components/store-page";
import { isStoreSellEnabled } from "@/shared/lib/environment";

export default async function StoreRoute() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "";
  const sellTabVisible = isStoreSellEnabled(host);

  return <StorePage sellTabVisible={sellTabVisible} />;
}
