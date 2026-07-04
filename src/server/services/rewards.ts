import { prisma } from "@/shared/lib/prisma";
import { bucketAccuracy } from "./accuracy";

export async function getRewardForAccuracy(
  rewardTableSlug: string,
  accuracyPercent: number,
) {
  const bucket = bucketAccuracy(accuracyPercent);
  const table = await prisma.rewardTable.findUnique({
    where: { slug: rewardTableSlug },
    include: {
      tiers: {
        where: { accuracyPercent: bucket },
        include: { medal: true },
      },
    },
  });

  if (!table?.tiers[0]) {
    return { coins: 0, xp: 0, medal: null, bucket };
  }

  const tier = table.tiers[0];
  return {
    coins: tier.coins,
    xp: tier.xp,
    medal: tier.medal,
    bucket,
  };
}

export async function getAdminConfigNumber(key: string, fallback: number) {
  const config = await prisma.adminConfig.findUnique({
    where: { key: key as never },
  });
  if (!config?.value) return fallback;
  const val = config.value as number | { value: number };
  return typeof val === "number" ? val : (val as { value: number }).value ?? fallback;
}
