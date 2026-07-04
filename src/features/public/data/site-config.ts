export const PUBLIC_SITE = {
  name: "بُردین",
  tagline: "پیش‌بینی کن، جایگاهت را بساز",
  description:
    "پلتفرم پیش‌بینی فوتبال با سیستم امتیازدهی، سکه، رقابت‌های روزانه، کاپ، تورنمنت، رقابت تیمی، لیدربورد و جوایز.",
  email: "support@bordin.ir",
  copyright: `© ${new Date().getFullYear()} بُردین. تمامی حقوق محفوظ است.`,
} as const;

export const PUBLIC_NAV_LINKS = [
  { href: "/", label: "خانه" },
  { href: "/about", label: "درباره ما" },
  { href: "/faq", label: "سوالات متداول" },
  { href: "/contact", label: "تماس با ما" },
] as const;

export const PUBLIC_FOOTER_LINKS = {
  product: [
    { href: "/#features", label: "امکانات" },
    { href: "/#how-it-works", label: "نحوه کار" },
    { href: "/faq", label: "سوالات متداول" },
  ],
  company: [
    { href: "/about", label: "درباره ما" },
    { href: "/contact", label: "تماس با ما" },
  ],
  legal: [
    { href: "/privacy", label: "حریم خصوصی" },
    { href: "/terms", label: "قوانین و مقررات" },
  ],
} as const;

export const SOCIAL_LINKS = [
  {
    href: "https://www.linkedin.com/in/tahagholami-",
    label: "لینکدین",
  },
  {
    href: "https://wa.me/989010558858",
    label: "واتساپ",
  },
] as const;

export const PUBLIC_ROUTES = [
  "/",
  "/about",
  "/contact",
  "/privacy",
  "/terms",
  "/faq",
] as const;
