import Link from "next/link";
import {
  CalendarClock,
  Coins,
  Medal,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  formatPersianNumber,
  formatTehranDateTime,
  isValidInstant,
} from "@/shared/lib/dates";
import { resolveTeamCompetitionBannerUrl } from "@/shared/lib/team-competition-banner";

const BANNER_WIDTH = 156;
const BANNER_HEIGHT = 193;

function safeTehranDateTime(value?: string | null) {
  if (!value || !isValidInstant(value)) return "—";
  try {
    return formatTehranDateTime(value);
  } catch {
    return "—";
  }
}

function safePersianNumber(value?: number | null) {
  return formatPersianNumber(Number.isFinite(Number(value)) ? Number(value) : 0);
}

export type TeamCompetitionCardData = {
  id: string;
  titleFa: string;
  description?: string | null;
  bannerUrl?: string | null;
  teamCapacity: number;
  registrationDeadline: string;
  registrationFeePerMember: number;
  winnerCoinReward: number;
  runnerUpCoinReward: number;
  stage: string;
  entryCount?: number;
  status?: string;
  joined?: boolean;
  rankingEndsAt?: string;
  knockoutEndsAt?: string | null;
  createdAt?: string;
  medals?: Array<{ placement: string; titleFa: string }>;
};

const stageLabel: Record<string, string> = {
  REGISTRATION: "ثبت‌نام",
  RANKING: "رده‌بندی",
  KNOCKOUT: "حذفی",
  FINISHED: "پایان‌یافته",
};

function InfoLine({
  icon: Icon,
  label,
  value,
  orange = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  orange?: boolean;
}) {
  return (
    <p className="flex items-start gap-1.5">
      <Icon className={orange ? "mt-0.5 h-3.5 w-3.5 shrink-0 text-bordin-orange" : "mt-0.5 h-3.5 w-3.5 shrink-0 text-white/45"} />
      <span>
        <span className={orange ? "text-bordin-orange" : "text-white/55"}>{label}</span>{" "}
        <span className="text-white/75">{value}</span>
      </span>
    </p>
  );
}

export function TeamCompetitionCard({
  data,
  variant = "list",
}: {
  data: TeamCompetitionCardData;
  variant?: "list" | "slider";
}) {
  if (!data?.id) return null;

  const href = `/competitions/teams/${data.id}`;
  const isFinished = data.stage === "FINISHED" || data.status === "finished";
  const isActive =
    data.stage === "RANKING" ||
    data.stage === "KNOCKOUT" ||
    (data.status === "active" && data.stage !== "REGISTRATION");
  const isSlider = variant === "slider";
  const bannerSrc = resolveTeamCompetitionBannerUrl(data.bannerUrl);

  return (
    <div
      className={
        isSlider
          ? "min-w-[280px] shrink-0 rounded-2xl border border-white/8 bg-gradient-to-br from-white/[0.04] to-transparent p-4"
          : "rounded-2xl border border-white/8 bg-gradient-to-br from-white/[0.04] to-transparent p-4"
      }
    >
      <div className="mb-3 flex gap-3">
        {bannerSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={bannerSrc}
            alt=""
            width={BANNER_WIDTH}
            height={BANNER_HEIGHT}
            className="h-[193px] w-[156px] shrink-0 rounded-xl object-cover"
          />
        ) : (
          <div
            className="flex shrink-0 items-center justify-center rounded-xl bg-white/5 text-xs text-white/40"
            style={{ width: BANNER_WIDTH, height: BANNER_HEIGHT }}
          >
            بنر
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap gap-1">
            {isFinished ? (
              <Badge>پایان‌یافته</Badge>
            ) : isActive ? (
              <Badge variant="green">{stageLabel[data.stage] ?? "فعال"}</Badge>
            ) : (
              <Badge variant="orange">آینده</Badge>
            )}
            {data.joined ? <Badge variant="green">ثبت‌نام شده</Badge> : null}
          </div>
          <p className="truncate font-bold">{data.titleFa || "رقابت تیمی"}</p>
          {!isSlider && data.description ? (
            <p className="mt-1 line-clamp-2 text-xs text-white/50">{data.description}</p>
          ) : null}
        </div>
      </div>

      <div className="space-y-1 text-xs">
        {!isFinished && !isActive ? (
          <InfoLine
            icon={CalendarClock}
            label="ددلاین ثبت‌نام:"
            value={safeTehranDateTime(data.registrationDeadline)}
            orange={isSlider}
          />
        ) : null}
        <InfoLine
          icon={Users}
          label="ظرفیت:"
          value={`${safePersianNumber(data.entryCount)} / ${safePersianNumber(data.teamCapacity)} تیم`}
          orange={isSlider}
        />
        <InfoLine
          icon={Coins}
          label="هزینه ثبت‌نام:"
          value={`${safePersianNumber(data.registrationFeePerMember)} سکه / عضو`}
          orange={isSlider}
        />
        <InfoLine
          icon={Trophy}
          label="جایزه قهرمان:"
          value={`${safePersianNumber(data.winnerCoinReward)} · نایب: ${safePersianNumber(data.runnerUpCoinReward)}`}
          orange={isSlider}
        />
        {Array.isArray(data.medals) && data.medals.length > 0 ? (
          <InfoLine
            icon={Medal}
            label="مدال‌ها:"
            value={data.medals.map((m) => m.titleFa).filter(Boolean).join("، ")}
            orange={isSlider}
          />
        ) : null}
        {isActive && data.rankingEndsAt ? (
          <p className="text-white/55">
            پایان مرحله فعلی: {safeTehranDateTime(data.rankingEndsAt)}
          </p>
        ) : null}
      </div>

      <Link href={href} className="mt-4 block">
        <Button size="sm" variant="secondary" className="w-full">
          مشاهده بیشتر
        </Button>
      </Link>
    </div>
  );
}
