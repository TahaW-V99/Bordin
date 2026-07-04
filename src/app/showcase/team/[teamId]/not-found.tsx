import Link from "next/link";

export default function TeamShowcaseNotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-black px-6 text-center text-white">
      <p className="text-sm text-white/60">ویترین این تیم یافت نشد.</p>
      <Link href="/home" className="text-sm text-bordin-orange">
        بازگشت به خانه
      </Link>
    </div>
  );
}
