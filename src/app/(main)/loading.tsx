export default function MainLoading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-black">
      <div className="flex flex-col items-center gap-4">
        <div className="h-11 w-11 animate-spin rounded-full border-2 border-white/15 border-t-bordin-orange" />
        <p className="text-sm font-semibold text-bordin-orange/90">در حال بارگذاری بُردین...</p>
      </div>
    </div>
  );
}
