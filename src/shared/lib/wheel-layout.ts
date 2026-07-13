import { WHEEL_REWARD_OPTIONS } from "@/shared/constants/wheel";

function hashSeed(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** چیدمان ثابت روزانهِ مقادیر روی گردونه (برای هماهنگی UI و سرور) */
export function buildWheelSegmentLayout(userId: string, dateKey: string, amounts?: number[]) {
  const sourceAmounts = amounts?.length ? amounts : WHEEL_REWARD_OPTIONS.map((o) => o.amount);
  const arr = [...sourceAmounts];
  let state = hashSeed(`${userId}:${dateKey}`);

  for (let i = arr.length - 1; i > 0; i--) {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    const j = state % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
}

export function findSegmentIndex(layout: number[], amount: number) {
  return layout.findIndex((value) => value === amount);
}
