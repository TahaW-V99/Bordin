import { redirect } from "next/navigation";
import { WalletPage } from "@/features/wallet/components/wallet-page";
import { isStoreSellEnabled } from "@/shared/lib/environment";

export default function Page() {
  if (!isStoreSellEnabled()) {
    redirect("/profile");
  }

  return <WalletPage />;
}
