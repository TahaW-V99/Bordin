import { Mail, MapPin, Phone } from "lucide-react";
import { ContactForm } from "@/features/public/components/contact-form";
import { PublicPageHero } from "@/features/public/components/public-sections";
import { PUBLIC_SITE, SOCIAL_LINKS } from "@/features/public/data/site-config";
import { Card } from "@/shared/components/ui/card";
import { buildPublicPageMetadata } from "@/features/public/lib/seo";

export const metadata = buildPublicPageMetadata({
  title: "تماس با ما",
  description: "برای پشتیبانی، همکاری یا پرسش درباره بُردین با ما در تماس باشید.",
  path: "/contact",
});

export default function ContactPage() {
  return (
    <>
      <PublicPageHero
        title="تماس با ما"
        description="سؤال، پیشنهاد یا درخواست پشتیبانی دارید؟ از طریق فرم زیر یا اطلاعات تماس با ما در ارتباط باشید."
      />

      <section className="px-4 py-16 sm:px-6">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-5">
          <Card className="p-6 lg:col-span-2">
            <h2 className="text-xl font-bold text-white">اطلاعات تماس</h2>
            <div className="mt-6 space-y-5">
              <div className="flex items-start gap-3">
                <Mail className="mt-1 h-5 w-5 text-bordin-orange" aria-hidden />
                <div>
                  <p className="text-sm font-medium text-white">ایمیل پشتیبانی</p>
                  <a
                    href={`mailto:${PUBLIC_SITE.email}`}
                    className="mt-1 block text-sm text-white/60 hover:text-bordin-orange"
                    dir="ltr"
                  >
                    {PUBLIC_SITE.email}
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="mt-1 h-5 w-5 text-bordin-orange" aria-hidden />
                <div>
                  <p className="text-sm font-medium text-white">تماس تجاری</p>
                  <p className="mt-1 text-sm text-white/60" dir="ltr">
                    info@bordin.ir
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="mt-1 h-5 w-5 text-bordin-orange" aria-hidden />
                <div>
                  <p className="text-sm font-medium text-white">موقعیت</p>
                  <p className="mt-1 text-sm text-white/60">ایران — خدمات آنلاین سراسری</p>
                </div>
              </div>
            </div>

            <div className="mt-8 border-t border-white/8 pt-6">
              <p className="text-sm font-medium text-white">شبکه‌های اجتماعی</p>
              <div className="mt-3 flex flex-wrap gap-3">
                {SOCIAL_LINKS.map((social) => (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-white/10 px-3 py-2 text-sm text-white/65 transition-colors hover:border-bordin-orange/40 hover:text-bordin-orange"
                  >
                    {social.label}
                  </a>
                ))}
              </div>
            </div>
          </Card>

          <Card className="p-6 lg:col-span-3">
            <h2 className="text-xl font-bold text-white">فرم تماس</h2>
            <p className="mt-2 text-sm text-white/55">
              پیام شما برای تیم پشتیبانی بُردین ارسال می‌شود. معمولاً ظرف ۲۴ تا ۴۸ ساعت پاسخ
              داده می‌شود.
            </p>
            <div className="mt-6">
              <ContactForm />
            </div>
          </Card>
        </div>
      </section>
    </>
  );
}
