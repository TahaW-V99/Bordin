import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  Coins,
  Crown,
  Gift,
  Medal,
  ShoppingBag,
  Target,
  Trophy,
  Users,
  Wallet,
  Zap,
} from "lucide-react";export type LandingFeature = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  accent: "orange" | "green" | "purple";
};

export const HOW_IT_WORKS_STEPS = [
  {
    step: 1,
    title: "ثبت‌نام و ورود",
    description: "با شماره موبایل وارد شوید و پروفایل خود را بسازید.",
  },
  {
    step: 2,
    title: "پیش‌بینی بازی‌ها",
    description: "برای بازی‌های کنداکتور روزانه و رقابت‌ها پیش‌بینی ثبت کنید.",
  },
  {
    step: 3,
    title: "کسب امتیاز و سکه",
    description: "بر اساس دقت پیش‌بینی، XP و سکه دریافت کنید.",
  },
  {
    step: 4,
    title: "رقابت و ارتقا",
    description: "در لیدربورد بالا بروید، مدال بگیرید و در رقابت‌ها بدرخشید.",
  },
] as const;

export const LANDING_FEATURES: LandingFeature[] = [
  {
    id: "kandakator",
    title: "کنداکتور روزانه",
    description:
      "هر روز بازی‌های منتخب را پیش‌بینی کنید. پس از اعلام نتیجه رسمی، پیش‌بینی‌ها امتیازدهی و پاداش تعلق می‌گیرد.",
    icon: CalendarDays,
    accent: "orange",
  },
  {
    id: "cups",
    title: "کاپ‌ها (جام)",
    description:
      "در کاپ‌های ویژه شرکت کنید، پیش‌بینی‌های خود را ثبت کنید و برای رسیدن به جوایز و مدال بجنگید.",
    icon: Trophy,
    accent: "green",
  },
  {
    id: "tournaments",
    title: "تورنمنت‌ها",
    description:
      "تورنمنت‌های سازمان‌یافته با قوانین مشخص؛ رقابت با سایر بازیکنان در جدول اختصاصی هر تورنمنت.",
    icon: Crown,
    accent: "purple",
  },
  {
    id: "team-competitions",
    title: "رقابت‌های تیمی",
    description:
      "تیم بسازید یا بپیوندید و در رقابت‌های حذفی تیمی با مراحل رده‌بندی و نوک‌آوت شرکت کنید.",
    icon: Users,
    accent: "orange",
  },
  {
    id: "leaderboard",
    title: "لیدربورد",
    description:
      "رتبه‌بندی جهانی کاربران و تیم‌ها را ببینید و برای صدر جدول تلاش کنید.",
    icon: Target,
    accent: "green",
  },
  {
    id: "coins",
    title: "سیستم سکه",
    description:
      "سکه واحد اصلی پاداش و هزینه در بُردین است؛ از پیش‌بینی، مأموریت‌ها و رقابت‌ها کسب کنید.",
    icon: Coins,
    accent: "purple",
  },
  {
    id: "rewards",
    title: "جوایز و پاداش",
    description:
      "پاداش‌های متنوع شامل سکه، XP، مدال و جوایز ویژه رقابت‌ها در انتظار عملکرد خوب شماست.",
    icon: Gift,
    accent: "orange",
  },
  {
    id: "levels",
    title: "سطح و مدال",
    description:
      "با کسب XP سطح خود را از تماشاگر به اسطوره ارتقا دهید و مدال‌های افتخار جمع کنید.",
    icon: Medal,
    accent: "green",
  },
  {
    id: "teams",
    title: "ساخت تیم",
    description:
      "تیم تشکیل دهید، اعضا را دعوت کنید و در رقابت‌های تیمی و لیدربورد تیمی شرکت کنید.",
    icon: Users,
    accent: "purple",
  },
  {
    id: "store",
    title: "فروشگاه",
    description:
      "بسته‌های سکه را از فروشگاه خریداری کنید و پرداخت امن از طریق درگاه زیبال انجام دهید.",
    icon: ShoppingBag,
    accent: "orange",
  },
  {
    id: "wallet",
    title: "کیف پول",
    description:
      "موجودی سکه و تاریخچه تراکنش‌های خود را مشاهده و مدیریت کنید.",
    icon: Wallet,
    accent: "green",
  },
  {
    id: "wheel",
    title: "گردونه شانس",
    description:
      "گردونه را بچرخانید و شانس دریافت جوایز تصادفی از جمله سکه را امتحان کنید.",
    icon: Zap,
    accent: "purple",
  },
  {
    id: "missions",
    title: "مأموریت‌ها",
    description:
      "مأموریت‌های مرحله‌ای را تکمیل کنید و پاداش‌های اضافی سکه و XP بگیرید.",
    icon: Target,
    accent: "orange",
  },
];

export const UI_PREVIEW_PLACEHOLDERS = [
  { id: "home", title: "صفحه خانه", description: "پیش‌بینی‌های روزانه و کنداکتور" },
  { id: "competitions", title: "مسابقات", description: "کاپ، تورنمنت و رقابت تیمی" },
  { id: "leaderboard", title: "لیدربورد", description: "رتبه‌بندی کاربران و تیم‌ها" },
  { id: "profile", title: "پروفایل", description: "سطح، مدال‌ها و ویترین افتخارات" },
] as const;
