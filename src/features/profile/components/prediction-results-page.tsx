"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, ClipboardList } from "lucide-react";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Chip } from "@/shared/components/ui/chip";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { PredictionResultCard } from "@/features/profile/components/prediction-result-card";
import { ChatShareRoomModal } from "@/features/chat/components/chat-share-room-modal";
import type { ChatRoomListItemDto, ChatShareTargetDto, ChatTeamRoomListItemDto } from "@/shared/types/chat";
import {
  parsePredictionResultFilter,
  isPredictionScored,
  type PredictionResultFilter,
  type PredictionResultItem,
} from "@/shared/types/prediction-results";
const FILTERS: Array<{ key: PredictionResultFilter; labelFa: string }> = [
  { key: "pending", labelFa: "پیش‌بینی ثبت شده" },
  { key: "settled", labelFa: "نتیجه مشخص شده" },
];

export function PredictionResultsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialFilter = parsePredictionResultFilter(searchParams.get("filter"));
  const [filter, setFilter] = useState<PredictionResultFilter>(initialFilter);
  const [results, setResults] = useState<PredictionResultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharePredictionId, setSharePredictionId] = useState<string | null>(null);
  const [chatRooms, setChatRooms] = useState<ChatShareTargetDto[]>([]);

  const load = useCallback(async (activeFilter: PredictionResultFilter) => {
    setLoading(true);
    const res = await fetch(`/api/profile/predictions?filter=${activeFilter}`, {
      cache: "no-store",
    });
    const data = await res.json();
    setResults(data.results ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load(filter);
  }, [filter, load]);

  useEffect(() => {
    const parsed = parsePredictionResultFilter(searchParams.get("filter"));
    setFilter(parsed);
  }, [searchParams]);

  const changeFilter = (next: PredictionResultFilter) => {
    setFilter(next);
    router.replace(`/profile/predictions?filter=${next}`, { scroll: false });
  };

  const openShare = async (predictionId: string) => {
    setSharePredictionId(predictionId);
    const [roomRes, teamRes] = await Promise.all([
      fetch("/api/chat/rooms", { cache: "no-store" }),
      fetch("/api/chat/teams", { cache: "no-store" }),
    ]);
    const [roomData, teamData] = await Promise.all([roomRes.json(), teamRes.json()]);
    const generalRooms = ((roomData.rooms ?? []) as ChatRoomListItemDto[])
      .filter((room) => room.slug !== "teams")
      .map((room) => ({
        slug: room.slug,
        titleFa: room.titleFa,
        descriptionFa: room.descriptionFa,
        href: room.href ?? `/chat/${room.slug}`,
        group: "general" as const,
        canAccess: room.canAccess,
        canPost: room.canPost,
      }));
    const teamRooms = ((teamData.rooms ?? []) as ChatTeamRoomListItemDto[]).map((room) => ({
      slug: room.slug,
      titleFa: room.titleFa,
      descriptionFa: room.descriptionFa,
      href: room.href,
      group: "team" as const,
      canAccess: true,
      canPost: true,
    }));
    setChatRooms([...generalRooms, ...teamRooms]);
  };

  return (
    <>
      <PageHeader
        title="نتایج پیش‌بینی"
        subtitle="۷ روز گذشته"
        startAction={
          <Link
            href="/profile"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-white/70 transition hover:border-bordin-orange/40 hover:text-bordin-orange"
            aria-label="بازگشت به پروفایل"
          >
            <ChevronRight className="h-5 w-5" />
          </Link>
        }
      />

      <div className="flex gap-3 overflow-x-auto px-4 pb-4 pt-4 scrollbar-hide">
        {FILTERS.map((item) => (
          <Chip
            key={item.key}
            active={filter === item.key}
            onClick={() => changeFilter(item.key)}
          >
            {item.labelFa}
          </Chip>
        ))}
      </div>

      <div className="space-y-3 px-4 pb-6">
        {loading ? (
          <>
            <Skeleton className="h-36" />
            <Skeleton className="h-36" />
          </>
        ) : results.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={filter === "pending" ? "پیش‌بینی ثبت‌شده‌ای نیست" : "نتیجه مشخص‌شده‌ای نیست"}
            description={
              filter === "pending"
                ? "در ۷ روز گذشته پیش‌بینی در انتظار نتیجه ندارید."
                : "هنوز پیش‌بینی امتیازدهی‌شده‌ای در ۷ روز گذشته ندارید."
            }
          />
        ) : (
          results.map((item) => (
            <PredictionResultCard
              key={item.id}
              item={item}
              onShareInChat={
                filter === "settled" && isPredictionScored(item) ? openShare : undefined
              }
            />
          ))
        )}
      </div>

      {sharePredictionId ? (
        <ChatShareRoomModal
          predictionId={sharePredictionId}
          rooms={chatRooms}
          onClose={() => setSharePredictionId(null)}
          onShared={(roomSlug) => {
            const target = chatRooms.find((room) => room.slug === roomSlug);
            setSharePredictionId(null);
            router.push(target?.href ?? `/chat/${roomSlug}`);
          }}
        />
      ) : null}
    </>
  );
}
