import { LegalDocument, PublicPageHero } from "@/features/public/components/public-sections";
import { TERMS_OF_SERVICE_SECTIONS } from "@/features/public/data/legal/terms-of-service";
import { buildPublicPageMetadata } from "@/features/public/lib/seo";

export const metadata = buildPublicPageMetadata({
  title: "قوانین و مقررات",
  description: "شرایط استفاده از پلتفرم بُردین شامل قوانین حساب، رقابت‌ها، سکه و خرید از فروشگاه.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <>
      <PublicPageHero
        title="قوانین و مقررات"
        description="لطفاً قبل از استفاده از بُردین، شرایط و قوانین زیر را مطالعه کنید."
      />
      <section className="px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <LegalDocument sections={TERMS_OF_SERVICE_SECTIONS.map((s) => ({ ...s, paragraphs: [...s.paragraphs] }))} />
        </div>
      </section>
    </>
  );
}
