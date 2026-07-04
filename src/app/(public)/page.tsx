import { LandingPage } from "@/features/public/components/landing-page";
import { buildPublicPageMetadata } from "@/features/public/lib/seo";

export const dynamic = "force-static";

export const metadata = buildPublicPageMetadata({
  title: "پیش‌بینی فوتبال، رقابت و جوایز",
  description:
    "بُردین پلتفرم پیش‌بینی فوتبال با کنداکتور روزانه، کاپ، تورنمنت، رقابت تیمی، لیدربورد، سکه، فروشگاه و سیستم پاداش اختصاصی است.",
  path: "/",
});

export default function HomePage() {
  return <LandingPage />;
}
