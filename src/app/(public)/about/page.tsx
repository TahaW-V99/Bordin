import { PublicCtaBanner, PublicPageHero, SectionHeading } from "@/features/public/components/public-sections";
import { Card } from "@/shared/components/ui/card";
import { buildPublicPageMetadata } from "@/features/public/lib/seo";

export const metadata = buildPublicPageMetadata({
  title: "درباره ما",
  description:
    "با بُردین، پلتفرم پیش‌بینی فوتبال ایرانی با سیستم امتیازدهی، رقابت و جامعه پیش‌بینی‌کنندگان آشنا شوید.",
  path: "/about",
});

const VALUES = [
  {
    title: "چشم‌انداز",
    text: "ساخت بزرگ‌ترین جامعه پیش‌بینی فوتبال در ایران با تجربه‌ای عادلانه، شفاف و سرگرم‌کننده.",
  },
  {
    title: "مأموریت",
    text: "تبدیل دانش فوتبالی کاربران به تجربه‌ای رقابتی با پاداش‌های مشخص و قابل پیگیری.",
  },
  {
    title: "جامعه",
    text: "ایجاد فضایی برای رقابت سالم، تعامل و رشد مهارت پیش‌بینی بین علاقه‌مندان فوتبال.",
  },
] as const;

export default function AboutPage() {
  return (
    <>
      <PublicPageHero
        title="درباره بُردین"
        description="بُردین پلتفرمی است که پیش‌بینی فوتبال را به یک تجربه رقابتی با سیستم امتیاز، سکه و پاداش تبدیل می‌کند."
      />

      <section className="px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-4xl space-y-10">
          <div>
            <h2 className="text-2xl font-bold text-white">بُردین چیست؟</h2>
            <p className="mt-4 text-sm leading-8 text-white/65">
              بُردین یک پلتفرم پیش‌بینی فوتبال است. کاربران نتایج بازی‌ها را پیش‌بینی می‌کنند،
              بر اساس دقت پیش‌بینی امتیاز و سکه دریافت می‌کنند و در رقابت‌های مختلف از جمله
              کنداکتور روزانه، کاپ‌ها، تورنمنت‌ها و رقابت‌های تیمی شرکت می‌کنند. سیستم امتیازدهی
              و پاداش بُردین اختصاصی این پلتفرم است و بر پایه نزدیکی پیش‌بینی به نتیجه واقعی
              طراحی شده است.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {VALUES.map((item) => (
              <Card key={item.title} className="p-6">
                <h3 className="text-lg font-bold text-bordin-orange">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-white/60">{item.text}</p>
              </Card>
            ))}
          </div>

          <div>
            <SectionHeading
              align="start"
              title="فلسفه پلتفرم"
              description="ما معتقدیم پیش‌بینی فوتبال باید بیش از یک حدس ساده باشد — تجربه‌ای باشد که مهارت، دانش و پشتکار را پاداش دهد."
            />
            <ul className="mt-6 space-y-3 text-sm leading-8 text-white/65">
              <li>• شفافیت در قوانین امتیازدهی و پاداش‌ها</li>
              <li>• رقابت عادلانه با سایر پیش‌بینی‌کنندگان</li>
              <li>• تمرکز بر تجربه کاربری ساده و موبایل‌محور</li>
              <li>• احترام به جامعه کاربران و امنیت حساب‌ها</li>
            </ul>
          </div>
        </div>
      </section>

      <PublicCtaBanner />
    </>
  );
}
