import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Sparkles,
} from "lucide-react";
import { BordinLogo } from "@/shared/components/bordin-logo";
import { Card } from "@/shared/components/ui/card";
import { cn } from "@/shared/lib/cn";
import { FaqAccordion } from "@/features/public/components/faq-accordion";
import { PublicCtaBanner, SectionHeading } from "@/features/public/components/public-sections";
import { FAQ_ITEMS, FAQ_PREVIEW_IDS } from "@/features/public/data/faq-content";
import {
  HOW_IT_WORKS_STEPS,
  LANDING_FEATURES,
  UI_PREVIEW_PLACEHOLDERS,
} from "@/features/public/data/landing-content";
import { PUBLIC_SITE } from "@/features/public/data/site-config";

const accentClasses = {
  orange: "text-bordin-orange bg-bordin-orange/10 border-bordin-orange/20",
  green: "text-bordin-green bg-bordin-green/10 border-bordin-green/20",
  purple: "text-bordin-purple bg-bordin-purple/10 border-bordin-purple/20",
} as const;

export function LandingPage() {
  const faqPreview = FAQ_ITEMS.filter((item) =>
    (FAQ_PREVIEW_IDS as readonly string[]).includes(item.id),
  );

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden px-4 pb-16 pt-12 sm:px-6 sm:pb-20 sm:pt-16 lg:pb-24 lg:pt-20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(255,161,0,0.15)_0%,_transparent_55%)]" />
        <div className="pointer-events-none absolute -left-20 top-20 h-64 w-64 rounded-full bg-bordin-purple/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 top-40 h-64 w-64 rounded-full bg-bordin-green/10 blur-3xl" />

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
          <div className="text-center lg:text-right">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs text-white/70">
              <Sparkles className="h-4 w-4 text-bordin-orange" />
              پلتفرم پیش‌بینی فوتبال با سیستم امتیاز و پاداش اختصاصی
            </div>
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
              {PUBLIC_SITE.name}
              <span className="mt-2 block text-2xl font-semibold text-bordin-orange sm:text-3xl">
                {PUBLIC_SITE.tagline}
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-sm leading-8 text-white/65 sm:text-base lg:mx-0">
              در بُردین نتیجه بازی‌های فوتبال را پیش‌بینی کن، امتیاز و سکه بگیر، در کاپ‌ها و
              تورنمنت‌ها رقابت کن، تیم بساز و در لیدربورد به قله برس.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
              <Link
                href="/login"
                className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-bordin-orange px-8 text-sm font-semibold text-black shadow-glow-orange transition-all hover:bg-bordin-orange/90 active:scale-[0.98] sm:w-auto"
              >
                شروع رایگان
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-white/10 bg-white/5 px-8 text-sm font-semibold text-white transition-all hover:bg-white/10 active:scale-[0.98] sm:w-auto"
              >
                نحوه کار بُردین
              </a>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6 shadow-[0_0_60px_rgba(255,161,0,0.08)] backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <BordinLogo size={48} className="rounded-xl" />
                  <div>
                    <p className="font-bold text-white">پیش‌بینی امروز</p>
                    <p className="text-xs text-white/45">کنداکتور روزانه</p>
                  </div>
                </div>
                <CalendarDays className="h-6 w-6 text-bordin-orange" />
              </div>
              <div className="mt-6 space-y-3">
                {["رئال مادرید ۲ - ۱ بارسلونا", "منچسترسیتی ۱ - ۱ لیورپول", "اینتر ۰ - ۰ میلان"].map(
                  (match) => (
                    <div
                      key={match}
                      className="rounded-xl border border-white/8 bg-black/40 px-4 py-3 text-sm text-white/80"
                    >
                      {match}
                    </div>
                  ),
                )}
              </div>
              <p className="mt-4 text-center text-xs text-white/40">
                نمای پیش‌نمایشی — رابط واقعی در اپلیکیشن
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Introduction */}
      <section className="border-y border-white/8 bg-white/[0.02] px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <SectionHeading
            eyebrow="معرفی پلتفرم"
            title="بیش از یک پیش‌بینی ساده"
            description="بُردین فقط حدس زدن نتیجه نیست؛ یک اکوسیستم رقابتی است که دانش فوتبالی شما را به امتیاز، سکه، سطح، مدال و جایگاه در جامعه پیش‌بینی‌کنندگان تبدیل می‌کند."
          />
          <div className="mt-12 grid gap-4 sm:grid-cols-3">
            {[
              {
                title: "پیش‌بینی هوشمند",
                text: "امتیازدهی بر اساس نزدیکی به نتیجه واقعی، نه فقط درست یا غلط.",
              },
              {
                title: "رقابت واقعی",
                text: "کاپ، تورنمنت، رقابت تیمی و لیدربورد برای رقابت مستمر.",
              },
              {
                title: "پیشرفت قابل مشاهده",
                text: "سطح، مدال، ویترین افتخارات و تاریخچه پیش‌بینی‌ها.",
              },
            ].map((item) => (
              <Card key={item.title} className="p-6">
                <h3 className="text-lg font-bold text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-white/60">{item.text}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-24 px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <SectionHeading
            eyebrow="نحوه کار"
            title="چهار قدم تا شروع رقابت"
            description="از ثبت‌نام تا اولین پیش‌بینی و دریافت پاداش، مسیر شما در بُردین ساده و شفاف است."
          />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS_STEPS.map((item) => (
              <Card key={item.step} className="relative p-6">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-bordin-orange/15 text-sm font-bold text-bordin-orange">
                  {item.step}
                </span>
                <h3 className="mt-4 text-lg font-bold text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-7 text-white/60">{item.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-24 border-t border-white/8 px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <SectionHeading
            eyebrow="امکانات"
            title="همه‌چیز برای یک تجربه رقابتی کامل"
            description="امکانات بُردین بر اساس نیاز واقعی کاربران پیش‌بینی‌کننده طراحی شده‌اند."
          />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {LANDING_FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card key={feature.id} id={feature.id} className="scroll-mt-24 p-6">
                  <div
                    className={cn(
                      "inline-flex h-12 w-12 items-center justify-center rounded-2xl border",
                      accentClasses[feature.accent],
                    )}
                  >
                    <Icon className="h-6 w-6" aria-hidden />
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-white">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-white/60">{feature.description}</p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* UI Preview */}
      <section className="border-t border-white/8 bg-white/[0.02] px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <SectionHeading
            eyebrow="پیش‌نمایش"
            title="نگاهی به رابط کاربری بُردین"
            description="طراحی تیره، مدرن و موبایل‌محور — هماهنگ با تجربه فعلی اپلیکیشن."
          />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {UI_PREVIEW_PLACEHOLDERS.map((preview) => (
              <div
                key={preview.id}
                className="overflow-hidden rounded-2xl border border-white/8 bg-gradient-to-b from-white/[0.05] to-transparent"
              >
                <div className="flex aspect-[9/16] flex-col justify-end bg-[radial-gradient(circle_at_top,_rgba(255,161,0,0.12),_transparent_60%)] p-4">
                  <div className="rounded-xl border border-white/10 bg-black/50 p-3 backdrop-blur-sm">
                    <p className="font-semibold text-white">{preview.title}</p>
                    <p className="mt-1 text-xs text-white/50">{preview.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Preview */}
      <section className="px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <SectionHeading
            eyebrow="سوالات متداول"
            title="پرسش‌های پرتکرار"
            description="پاسخ کوتاه به رایج‌ترین سوالات کاربران جدید."
          />
          <div className="mt-10">
            <FaqAccordion items={faqPreview} />
          </div>
          <div className="mt-8 text-center">
            <Link
              href="/faq"
              className="inline-flex items-center gap-2 text-sm font-semibold text-bordin-orange hover:text-bordin-orange/80"
            >
              مشاهده همه سوالات
              <ArrowLeft className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      <PublicCtaBanner />
    </>
  );
}
