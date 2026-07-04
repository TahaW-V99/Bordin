import { HeaderToolbar } from "@/shared/components/layout/header-toolbar";

export function PageHeader({
  title,
  subtitle,
  action,
  startAction,
  titleClassName,
  subtitleClassName,
  hideToolbar = false,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  startAction?: React.ReactNode;
  titleClassName?: string;
  subtitleClassName?: string;
  /** Hide global whistle + coins toolbar (e.g. messages page itself). */
  hideToolbar?: boolean;
}) {
  const endContent =
    action || !hideToolbar ? (
      <div className="flex shrink-0 items-center gap-2">
        {action}
        {!hideToolbar ? <HeaderToolbar /> : null}
      </div>
    ) : null;

  return (
    <header className="sticky top-0 z-40 border-b border-white/8 bg-black/90 px-4 py-4 backdrop-blur-md">
      <div className="flex items-start justify-between gap-3">
        {startAction ? <div className="shrink-0">{startAction}</div> : null}
        <div className="min-w-0 flex-1">
          <h1 className={["text-xl font-bold tracking-tight", titleClassName].filter(Boolean).join(" ")}>
            {title}
          </h1>
          {subtitle ? (
            <p className={["mt-0.5 text-sm text-white/50", subtitleClassName].filter(Boolean).join(" ")}>
              {subtitle}
            </p>
          ) : null}
        </div>
        {endContent}
      </div>
    </header>
  );
}
