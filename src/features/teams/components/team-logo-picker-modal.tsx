"use client";

import { useEffect, useState } from "react";
import { CoinCostLabel } from "@/shared/components/teams/coin-cost-label";
import { Modal } from "@/shared/components/ui/modal";
import { Button } from "@/shared/components/ui/button";
import { TeamLogo } from "@/features/teams/components/team-logo";
import {
  TEAM_LOGO_COST,
  isPaidTeamLogo,
  selectableTeamLogoKeys,
} from "@/shared/constants/teams";
import { formatPersianNumber } from "@/shared/lib/dates";

export function TeamLogoPickerModal({
  open,
  onClose,
  unlockedLogos,
  currentLogoKey,
  onSave,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  unlockedLogos: number[];
  currentLogoKey: number | null;
  onSave: (logoKey: number) => void;
  loading?: boolean;
}) {
  const [selected, setSelected] = useState<number | null>(currentLogoKey);

  useEffect(() => {
    if (open) setSelected(currentLogoKey);
  }, [open, currentLogoKey]);

  const needsPurchase =
    selected != null && isPaidTeamLogo(selected) && !unlockedLogos.includes(selected);

  return (
    <Modal open={open} onClose={onClose} className="max-w-md">
      <h4 className="mb-4 shrink-0 text-center font-bold">تغییر لوگو</h4>

      <div className="scrollbar-bordin max-h-[55vh] overflow-y-auto pe-1">
        <div className="grid grid-cols-3 justify-items-center gap-4 py-2">
          {selectableTeamLogoKeys().map((key) => (
            <TeamLogo
              key={key}
              logoKey={key}
              size="xl"
              unlocked={!isPaidTeamLogo(key) || unlockedLogos.includes(key)}
              selected={selected === key}
              onClick={() => setSelected(key)}
            />
          ))}
        </div>
      </div>

      <div className="mt-5 flex shrink-0 gap-2">
        <Button variant="ghost" fullWidth onClick={onClose} disabled={loading}>
          انصراف
        </Button>
        <Button
          fullWidth
          loading={loading}
          disabled={selected == null}
          onClick={() => selected != null && onSave(selected)}
        >
          <span className="flex items-center justify-center gap-2">
            ذخیره
            {needsPurchase ? <CoinCostLabel amount={TEAM_LOGO_COST} /> : null}
          </span>
        </Button>
      </div>
    </Modal>
  );
}
