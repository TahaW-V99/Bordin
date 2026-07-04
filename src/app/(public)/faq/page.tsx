import { FaqAccordion } from "@/features/public/components/faq-accordion";
import { PublicCtaBanner, PublicPageHero } from "@/features/public/components/public-sections";
import { FAQ_ITEMS } from "@/features/public/data/faq-content";
import { buildPublicPageMetadata } from "@/features/public/lib/seo";

export const metadata = buildPublicPageMetadata({
  title: "سوالات متداول",
  description: "پاسخ سوالات رایج درباره پیش‌بینی، سکه، رقابت‌ها، فروشگاه و حساب کاربری در بُردین.",
  path: "/faq",
  keywords: ["سوالات متداول", "راهنمای بُردین"],
});

export default function FaqPage() {
  return (
    <>
      <PublicPageHero
        title="سوالات متداول"
        description="پاسخ پرسش‌های رایج درباره نحوه کار بُردین، پیش‌بینی‌ها، سکه‌ها، رقابت‌ها و حساب کاربری."
      />
      <section className="px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <FaqAccordion items={FAQ_ITEMS} />
        </div>
      </section>
      <PublicCtaBanner />
    </>
  );
}
