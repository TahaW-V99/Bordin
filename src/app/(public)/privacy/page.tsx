import { LegalDocument, PublicPageHero } from "@/features/public/components/public-sections";
import { PRIVACY_POLICY_SECTIONS } from "@/features/public/data/legal/privacy-policy";
import { buildPublicPageMetadata } from "@/features/public/lib/seo";

export const metadata = buildPublicPageMetadata({
  title: "حریم خصوصی",
  description: "سیاست حریم خصوصی بُردین — نحوه جمع‌آوری، استفاده و حفاظت از اطلاعات کاربران.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <>
      <PublicPageHero
        title="حریم خصوصی"
        description="در این صفحه نحوه جمع‌آوری، استفاده، نگهداری و حفاظت از اطلاعات شما در بُردین توضیح داده شده است."
      />
      <section className="px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <LegalDocument sections={PRIVACY_POLICY_SECTIONS.map((s) => ({ ...s, paragraphs: [...s.paragraphs] }))} />
        </div>
      </section>
    </>
  );
}
