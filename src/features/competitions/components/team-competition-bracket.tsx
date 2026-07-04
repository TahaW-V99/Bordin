"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { formatPersianNumber } from "@/shared/lib/dates";
import { cn } from "@/shared/lib/cn";
import {
  KNOCKOUT_ROUND_LABELS_FA,
  type TeamCompetitionCapacity,
} from "@/shared/constants/team-competitions";
import {
  type BracketFixture,
  type BracketLayout,
  type BracketMatchNode,
  type BracketSideTree,
  type BracketTeam,
  BRACKET_COLUMN_WIDTH,
  BRACKET_CONNECTOR_WIDTH,
  BRACKET_MATCH_HEIGHT,
  buildBracketLayout,
  buildPreviewFirstRound,
  finalMatchTopForCapacity,
  matchSlotCenterY,
} from "@/features/competitions/components/team-competition-bracket-model";

const BRACKET_SCROLL_KEY = (competitionId: string) =>
  `bordin-tc-bracket-scroll:${competitionId}`;

function saveBracketScroll(competitionId: string, container: HTMLElement | null) {
  sessionStorage.setItem(
    BRACKET_SCROLL_KEY(competitionId),
    JSON.stringify({
      left: container?.scrollLeft ?? 0,
      top: container?.scrollTop ?? 0,
      pageY: window.scrollY,
    }),
  );
}

function columnFeedCenter(column: { matches: BracketMatchNode[] }): number {
  if (column.matches.length === 0) return 0;
  if (column.matches.length === 1) return matchSlotCenterY(column.matches[0]!);
  const first = matchSlotCenterY(column.matches[0]!);
  const last = matchSlotCenterY(column.matches[column.matches.length - 1]!);
  return (first + last) / 2;
}

function SideFinalBridge({
  innerColumn,
  finalMatch,
  totalHeight,
  from,
}: {
  innerColumn?: { matches: BracketMatchNode[] };
  finalMatch: BracketMatchNode | null;
  totalHeight: number;
  from: "left" | "right";
}) {
  if (!innerColumn?.matches.length || !finalMatch) {
    return <div className="w-6 shrink-0" style={{ height: totalHeight }} />;
  }

  const w = BRACKET_CONNECTOR_WIDTH;
  const yInner = columnFeedCenter(innerColumn);
  const yFinal = matchSlotCenterY(finalMatch);

  const d =
    from === "left"
      ? `M 0 ${yInner} H ${w / 2} V ${yFinal} H ${w}`
      : `M ${w} ${yInner} H ${w / 2} V ${yFinal} H 0`;

  return (
    <div className="relative shrink-0" style={{ width: w, height: totalHeight }}>
      <svg
        className="absolute inset-0 overflow-visible text-bordin-orange/50"
        width={w}
        height={totalHeight}
        aria-hidden
      >
        <path
          d={d}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export function TeamCompetitionBracket({
  fixtures = [],
  teams,
  teamCapacity = 8,
  winnerTeamId = null,
  competitionId,
}: {
  fixtures?: BracketFixture[];
  teams: BracketTeam[];
  teamCapacity?: TeamCompetitionCapacity;
  winnerTeamId?: string | null;
  competitionId?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!competitionId) return;
    const raw = sessionStorage.getItem(BRACKET_SCROLL_KEY(competitionId));
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as { left?: number; top?: number; pageY?: number };
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({
          left: saved.left ?? 0,
          top: saved.top ?? 0,
          behavior: "instant",
        });
        if (typeof saved.pageY === "number") {
          window.scrollTo({ top: saved.pageY, behavior: "instant" });
        }
      });
    } catch {
      // ignore corrupt storage
    }
  }, [competitionId]);

  if (teams.length === 0) {
    return (
      <p className="text-sm text-white/45">
        پس از پایان مرحله رده‌بندی، براکت نمایش داده می‌شود.
      </p>
    );
  }

  const capacity = normalizeCapacity(teamCapacity, teams.length);
  const teamMeta = new Map(teams.map((t) => [t.id, t]));

  const enrichTeam = (team: BracketTeam | null): BracketTeam | null => {
    if (!team) return null;
    const meta = teamMeta.get(team.id);
    return meta ? { ...team, seedRank: meta.seedRank ?? team.seedRank } : team;
  };

  const enrichedFixtures: BracketFixture[] = fixtures.map((f) => ({
    ...f,
    left: enrichTeam(f.left),
    right: enrichTeam(f.right),
  }));

  const layout: BracketLayout =
    enrichedFixtures.length > 0
      ? buildBracketLayout(enrichedFixtures, capacity, KNOCKOUT_ROUND_LABELS_FA)
      : buildPreviewFirstRound(teams, capacity, KNOCKOUT_ROUND_LABELS_FA);

  const championId = winnerTeamId ?? layout.final?.winnerTeamId ?? null;

  const teamProfileHref = (teamId: string) => {
    if (!competitionId) return `/showcase/team/${teamId}`;
    return `/showcase/team/${teamId}?from=competition-knockout&competitionId=${competitionId}`;
  };

  const onTeamNavigate = () => {
    if (competitionId) saveBracketScroll(competitionId, scrollRef.current);
  };

  return (
    <div className="space-y-4">
      <div ref={scrollRef} className="overflow-x-auto pb-4">
        <div
          dir="ltr"
          className="mx-auto flex min-w-max items-stretch justify-center gap-0 px-2"
          style={{ minHeight: layout.right.totalHeight }}
        >
          <BracketSide
            tree={layout.left}
            edge="outer-left"
            towardCenter="right"
            teamProfileHref={teamProfileHref}
            onTeamNavigate={onTeamNavigate}
          />

          <SideFinalBridge
            innerColumn={layout.left.columns.at(-1)}
            finalMatch={layout.final}
            totalHeight={layout.right.totalHeight}
            from="left"
          />

          <BracketCenter
            final={layout.final}
            championId={championId}
            totalHeight={layout.right.totalHeight}
            capacity={capacity}
            teamProfileHref={teamProfileHref}
            onTeamNavigate={onTeamNavigate}
          />

          <SideFinalBridge
            innerColumn={layout.right.columns.at(-1)}
            finalMatch={layout.final}
            totalHeight={layout.right.totalHeight}
            from="right"
          />

          <BracketSide
            tree={layout.right}
            edge="outer-right"
            towardCenter="left"
            teamProfileHref={teamProfileHref}
            onTeamNavigate={onTeamNavigate}
          />
        </div>
      </div>

      <p className="text-center text-xs text-white/40">
        {formatPersianNumber(teams.length)} تیم · براکت حذفی
        {fixtures.length === 0 ? " (پیش‌نمایش جفت‌سازی رده‌بندی)" : ""}
      </p>
    </div>
  );
}

function normalizeCapacity(
  capacity: number,
  teamCount: number,
): TeamCompetitionCapacity {
  if (capacity === 8 || capacity === 16 || capacity === 32) return capacity;
  if (teamCount <= 8) return 8;
  if (teamCount <= 16) return 16;
  return 32;
}

function BracketSide({
  tree,
  edge,
  towardCenter,
  teamProfileHref,
  onTeamNavigate,
}: {
  tree: BracketSideTree;
  edge: "outer-left" | "outer-right";
  towardCenter: "left" | "right";
  teamProfileHref: (teamId: string) => string;
  onTeamNavigate: () => void;
}) {
  const reverse = edge === "outer-right";

  return (
    <div
      className={cn("flex items-stretch", reverse ? "flex-row-reverse" : "flex-row")}
    >
      {tree.columns.map((column, colIdx) => (
        <div key={column.key} className="flex items-stretch">
          <BracketRoundColumn
            column={column}
            totalHeight={tree.totalHeight}
            teamProfileHref={teamProfileHref}
            onTeamNavigate={onTeamNavigate}
          />
          {colIdx < tree.columns.length - 1 ? (
            <BracketConnector
              outerColumn={column}
              innerColumn={tree.columns[colIdx + 1]!}
              totalHeight={tree.totalHeight}
              towardCenter={towardCenter}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}

function BracketRoundColumn({
  column,
  totalHeight,
  teamProfileHref,
  onTeamNavigate,
}: {
  column: { labelFa: string; matches: BracketMatchNode[] };
  totalHeight: number;
  teamProfileHref: (teamId: string) => string;
  onTeamNavigate: () => void;
}) {
  return (
    <div
      className="relative shrink-0"
      style={{ width: BRACKET_COLUMN_WIDTH, height: totalHeight }}
    >
      <p className="absolute -top-6 inset-x-0 truncate text-center text-[10px] font-medium text-bordin-orange/80">
        {column.labelFa}
      </p>
      {column.matches.map((match) => (
        <MatchPairSlot
          key={match.id}
          match={match}
          teamProfileHref={teamProfileHref}
          onTeamNavigate={onTeamNavigate}
        />
      ))}
    </div>
  );
}

/** Fixed bracket slot — owns the connector anchor at its vertical center. */
function MatchPairSlot({
  match,
  isFinal = false,
  teamProfileHref,
  onTeamNavigate,
}: {
  match: BracketMatchNode;
  isFinal?: boolean;
  teamProfileHref: (teamId: string) => string;
  onTeamNavigate: () => void;
}) {
  return (
    <div
      className="absolute inset-x-0"
      style={{ top: match.top, height: BRACKET_MATCH_HEIGHT }}
    >
      <span
        className="pointer-events-none absolute start-0 end-0 top-1/2 -translate-y-1/2"
        style={{ height: 0 }}
        aria-hidden
        data-bracket-anchor
      />
      <MatchPair
        match={match}
        isFinal={isFinal}
        teamProfileHref={teamProfileHref}
        onTeamNavigate={onTeamNavigate}
      />
    </div>
  );
}

function BracketConnector({
  outerColumn,
  innerColumn,
  totalHeight,
  towardCenter,
}: {
  outerColumn: { matches: BracketMatchNode[] };
  innerColumn: { matches: BracketMatchNode[] };
  totalHeight: number;
  towardCenter: "left" | "right";
}) {
  const w = BRACKET_CONNECTOR_WIDTH;
  const midX = w / 2;
  const paths: string[] = [];

  for (let i = 0; i < outerColumn.matches.length; i += 2) {
    const matchA = outerColumn.matches[i];
    const matchB = outerColumn.matches[i + 1];
    const to = innerColumn.matches[Math.floor(i / 2)];
    if (!matchA || !to) continue;

    const yA = matchSlotCenterY(matchA);
    const yB = matchB ? matchSlotCenterY(matchB) : yA;
    const yTo = matchSlotCenterY(to);
    const yMin = Math.min(yA, yB);
    const yMax = Math.max(yA, yB);

    if (towardCenter === "right") {
      paths.push(`M 0 ${yA} H ${midX}`);
      if (matchB) paths.push(`M 0 ${yB} H ${midX}`);
      if (matchB) paths.push(`M ${midX} ${yMin} V ${yMax}`);
      paths.push(`M ${midX} ${yTo} H ${w}`);
    } else {
      paths.push(`M ${w} ${yA} H ${midX}`);
      if (matchB) paths.push(`M ${w} ${yB} H ${midX}`);
      if (matchB) paths.push(`M ${midX} ${yMin} V ${yMax}`);
      paths.push(`M ${midX} ${yTo} H 0`);
    }
  }

  return (
    <div className="relative shrink-0" style={{ width: w, height: totalHeight }}>
      <svg
        className="absolute inset-0 overflow-visible text-bordin-orange/55"
        width={w}
        height={totalHeight}
        aria-hidden
      >
        {paths.map((d, idx) => (
          <path
            key={idx}
            d={d}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>
    </div>
  );
}

function BracketCenter({
  final,
  championId,
  totalHeight,
  capacity,
  teamProfileHref,
  onTeamNavigate,
}: {
  final: BracketMatchNode | null;
  championId: string | null;
  totalHeight: number;
  capacity: TeamCompetitionCapacity;
  teamProfileHref: (teamId: string) => string;
  onTeamNavigate: () => void;
}) {
  const finalTop = final ? final.top : finalMatchTopForCapacity(capacity);
  const trophyHeaderHeight = 56;
  const finalLabelHeight = 16;
  const headerGap = 12;
  const headerTop = Math.max(
    0,
    finalTop - trophyHeaderHeight - finalLabelHeight - headerGap,
  );

  return (
    <div
      className="relative mx-2 shrink-0"
      style={{ width: BRACKET_COLUMN_WIDTH + 16, height: totalHeight }}
    >
      <div
        className="absolute inset-x-0 flex flex-col items-center"
        style={{ top: headerTop }}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-bordin-orange/40 bg-bordin-orange/10 shadow-[0_0_24px_rgba(245,185,66,0.25)]">
          <Trophy
            className={cn(
              "h-7 w-7 transition-colors",
              championId ? "text-bordin-orange" : "text-bordin-orange/50",
            )}
          />
        </div>
        <p className="mt-1 text-[10px] font-semibold text-bordin-orange">فینال</p>
      </div>

      {final ? (
        <MatchPairSlot
          match={final}
          isFinal
          teamProfileHref={teamProfileHref}
          onTeamNavigate={onTeamNavigate}
        />
      ) : (
        <div
          className="absolute inset-x-0 rounded-2xl border border-dashed border-white/15 bg-white/[0.02]"
          style={{ top: finalTop, height: BRACKET_MATCH_HEIGHT }}
        >
          <span
            className="pointer-events-none absolute start-0 end-0 top-1/2 -translate-y-1/2"
            style={{ height: 0 }}
            aria-hidden
            data-bracket-anchor
          />
        </div>
      )}
    </div>
  );
}

function MatchPair({
  match,
  isFinal = false,
  teamProfileHref,
  onTeamNavigate,
}: {
  match: BracketMatchNode;
  isFinal?: boolean;
  teamProfileHref: (teamId: string) => string;
  onTeamNavigate: () => void;
}) {
  return (
    <div
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-xl border shadow-lg transition-all duration-300",
        isFinal
          ? "border-bordin-orange/45 bg-gradient-to-b from-bordin-orange/12 to-transparent"
          : "border-white/12 bg-[#141414]",
      )}
    >
      <TeamCard
        team={match.teamA}
        score={match.scoreA}
        resolved={match.resolved}
        winnerTeamId={match.winnerTeamId}
        href={match.teamA ? teamProfileHref(match.teamA.id) : undefined}
        onNavigate={onTeamNavigate}
      />
      <div className="h-px bg-white/8" />
      <TeamCard
        team={match.teamB}
        score={match.scoreB}
        resolved={match.resolved}
        winnerTeamId={match.winnerTeamId}
        href={match.teamB ? teamProfileHref(match.teamB.id) : undefined}
        onNavigate={onTeamNavigate}
      />
    </div>
  );
}

function TeamCard({
  team,
  score,
  resolved,
  winnerTeamId,
  href,
  onNavigate,
}: {
  team: BracketTeam | null;
  score: number;
  resolved: boolean;
  winnerTeamId: string | null;
  href?: string;
  onNavigate: () => void;
}) {
  if (!team) {
    return (
      <div className="flex flex-1 items-center px-2.5">
        <span className="text-[11px] text-white/25">—</span>
      </div>
    );
  }

  const isWinner = resolved && winnerTeamId === team.id;
  const isLoser = resolved && winnerTeamId && winnerTeamId !== team.id;
  const qualified = resolved ? isWinner : !team.isEliminated;

  const content = (
    <>
      <TeamLogo logoUrl={team.logoUrl} name={team.name} />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-[11px] font-semibold leading-tight",
            isWinner ? "text-bordin-orange" : "text-white",
          )}
        >
          {team.name}
        </p>
        {team.seedRank != null ? (
          <p className="text-[9px] text-white/35">رتبه {formatPersianNumber(team.seedRank)}</p>
        ) : null}
      </div>
      <span
        className={cn(
          "shrink-0 text-xs font-bold tabular-nums",
          isWinner ? "text-bordin-orange" : "text-white/55",
        )}
      >
        {formatPersianNumber(score)}
      </span>
    </>
  );

  return (
    <div
      className={cn(
        "flex flex-1 items-center gap-2 px-2.5 transition-opacity duration-300",
        isLoser || (team.isEliminated && !isWinner) ? "opacity-35" : "opacity-100",
        qualified && resolved ? "bg-bordin-orange/[0.06]" : "",
      )}
    >
      {href ? (
        <Link
          href={href}
          onClick={onNavigate}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg outline-none transition hover:bg-white/[0.04] focus-visible:ring-2 focus-visible:ring-bordin-orange/50"
        >
          {content}
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-2">{content}</div>
      )}
    </div>
  );
}

function TeamLogo({ logoUrl, name }: { logoUrl: string | null; name: string }) {
  if (logoUrl) {
    return (
      <Image
        src={logoUrl}
        alt=""
        width={28}
        height={28}
        className="h-7 w-7 shrink-0 rounded-lg object-cover ring-1 ring-white/10"
        unoptimized
      />
    );
  }
  return (
    <div
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/8 text-[10px] ring-1 ring-white/10"
      aria-hidden
    >
      {name.charAt(0) || "⚽"}
    </div>
  );
}
