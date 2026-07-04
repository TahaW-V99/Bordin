export const DISPLAY_NAME_CHANGE_COST = 600;
export const AVATAR_PURCHASE_COST = 200;

export const PREMIUM_AVATAR_IDS = ["avatar-02", "avatar-09", "avatar-10"] as const;

export type AvatarOption = {
  id: string;
  src: string;
  label: string;
  gender: "male" | "female";
  premium: boolean;
};

export const DEFAULT_AVATAR_ID = "avatar-01";

export const PROFILE_AVATARS: AvatarOption[] = [
  { id: "avatar-01", src: "/avatars/1.png", label: "کاپیتان", gender: "male", premium: false },
  { id: "avatar-02", src: "/avatars/2.png", label: "مهاجم", gender: "male", premium: true },
  { id: "avatar-03", src: "/avatars/3.png", label: "دروازه‌بان", gender: "male", premium: false },
  { id: "avatar-04", src: "/avatars/4.png", label: "هافبک", gender: "male", premium: false },
  { id: "avatar-05", src: "/avatars/5.png", label: "مربی", gender: "male", premium: false },
  { id: "avatar-06", src: "/avatars/6.png", label: "ستاره", gender: "female", premium: false },
  { id: "avatar-07", src: "/avatars/7.png", label: "رقیب", gender: "female", premium: false },
  { id: "avatar-08", src: "/avatars/8.png", label: "قهرمان", gender: "female", premium: false },
  { id: "avatar-09", src: "/avatars/9.png", label: "تسخیرگر", gender: "female", premium: true },
  { id: "avatar-10", src: "/avatars/10.png", label: "اسطوره", gender: "female", premium: true },
];

export function isPremiumAvatarId(id: string) {
  return (PREMIUM_AVATAR_IDS as readonly string[]).includes(id);
}

export function getAvatarSrc(avatarUrl: string | null | undefined) {
  if (!avatarUrl) {
    return PROFILE_AVATARS.find((a) => a.id === DEFAULT_AVATAR_ID)?.src ?? "/avatars/1.png";
  }
  if (avatarUrl.startsWith("/")) return avatarUrl;
  const match = PROFILE_AVATARS.find((a) => a.id === avatarUrl);
  return match?.src ?? `/avatars/${avatarUrl}.png`;
}

export function isValidAvatarId(id: string) {
  return PROFILE_AVATARS.some((a) => a.id === id);
}
