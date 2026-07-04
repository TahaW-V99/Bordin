import Link from "next/link";

export default function ShowcaseNotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-black px-4 text-center text-white">
      <p className="text-lg font-bold">پروفایل یافت نشد</p>
      <p className="text-sm text-white/50">این ویترین وجود ندارد یا حذف شده است.</p>
      <Link
        href="/home"
        className="rounded-xl border border-bordin-orange/30 bg-bordin-orange/10 px-4 py-2 text-sm text-bordin-orange"
      >
        بازگشت به خانه
      </Link>
    </div>
  );
}
