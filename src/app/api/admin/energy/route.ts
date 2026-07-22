import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/shared/lib/auth";
import { requireAdmin } from "@/server/services/admin-service";
import {
  applyEnergyConfig,
  getEnergyConfig,
} from "@/server/services/energy-service";
import type { EnergyCostsMap } from "@/shared/constants/energy";

const applySchema = z.object({
  costs: z.record(z.string(), z.number().min(0).max(1000)),
  inviteRecoveryEnabled: z.boolean(),
});

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await requireAdmin(session.userId);
    const config = await getEnergyConfig();
    return NextResponse.json({ config });
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطای سرور";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await requireAdmin(session.userId);
    const body = applySchema.parse(await request.json());
    const config = await applyEnergyConfig({
      costs: body.costs as Partial<EnergyCostsMap>,
      inviteRecoveryEnabled: body.inviteRecoveryEnabled,
    });
    return NextResponse.json({ success: true, config });
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطای سرور";
    const status = message.includes("ادمین") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
