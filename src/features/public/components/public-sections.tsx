import Link from "next/link";
import { cn } from "@/shared/lib/cn";

type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "center" | "start";
  className?: string;
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "max-w-3xl",
        align === "center" && "mx-auto text-center",
        align === "start" && "text-right",
        className,
      )}
    >
      {eyebrow ? (
        <p className="mb-3 text-sm font-semibold text-bordin-orange">{eyebrow}</p>
      ) : null}
      <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-4 text-sm leading-7 text-white/60 sm:text-base">{description}</p>
      ) : null}
    </div>
  );
}

type PublicPageHeroProps = {
  title: string;
  description: string;
  className?: string;
};

export function PublicPageHero({ title, description, className }: PublicPageHeroProps) {
  return (
    <section
      className={cn(
        "relative overflow-hidden border-b border-white/8 px-4 py-16 sm:px-6 sm:py-20 lg:py-24",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(255,161,0,0.12)_0%,_transparent_55%)]" />
      <div className="relative mx-auto max-w-4xl text-center">
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
          {title}
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-white/60 sm:text-base">
          {description}
        </p>
      </div>
    </section>
  );
}

type LegalSection = {
  id: string;
  title: string;
  paragraphs: string[];
};

export function LegalDocument({ sections }: { sections: LegalSection[] }) {
  return (
    <div className="space-y-10">
      {sections.map((section) => (
        <section key={section.id} id={section.id} className="scroll-mt-28">
          <h2 className="text-xl font-bold text-white">{section.title}</h2>
          <div className="mt-4 space-y-3">
            {section.paragraphs.map((paragraph, index) => (
              <p key={index} className="text-sm leading-8 text-white/65">
                {paragraph}
              </p>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function PublicCtaBanner() {
  return (
    <section className="px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl border border-bordin-orange/30 bg-gradient-to-br from-bordin-orange/15 via-white/[0.03] to-transparent p-8 text-center sm:p-12">
        <h2 className="text-2xl font-bold text-white sm:text-3xl">آماده‌ای رقابت را شروع کنی؟</h2>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-white/65 sm:text-base">
          همین حالا وارد بُردین شو، پیش‌بینی‌های روزانه را ثبت کن و جایگاهت را در دنیای
          پیش‌بینی فوتبال بساز.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/login"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-bordin-orange px-6 text-sm font-semibold text-black shadow-glow-orange transition-all hover:bg-bordin-orange/90 active:scale-[0.98]"
          >
            ورود / ثبت‌نام
          </Link>
          <Link
            href="/faq"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-6 text-sm font-semibold text-white transition-all hover:bg-white/10 active:scale-[0.98]"
          >
            سوالات متداول
          </Link>
        </div>
      </div>
    </section>
  );
}
