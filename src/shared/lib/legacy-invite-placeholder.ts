export const LEGACY_INVITE_PLACEHOLDER_DISPLAY_NAME = "Legacy Invite Placeholder";
export const GRANT_INVITE_PLACEHOLDER_DISPLAY_NAME = "Grant Invite Placeholder";

export function isLegacyInvitePlaceholderPhone(phone: string | null | undefined) {
  return Boolean(phone?.startsWith("legacy-inv-") || phone?.startsWith("grant-inv-"));
}

export function isLegacyInvitePlaceholderUsername(username: string | null | undefined) {
  return Boolean(username?.startsWith("legacy_inv_") || username?.startsWith("grant_inv_"));
}

export function isLegacyInvitePlaceholderUser(input: {
  phone: string;
  username?: string | null;
  displayName?: string | null;
}) {
  if (isLegacyInvitePlaceholderPhone(input.phone)) return true;
  if (isLegacyInvitePlaceholderUsername(input.username)) return true;
  if (input.displayName?.trim() === LEGACY_INVITE_PLACEHOLDER_DISPLAY_NAME) return true;
  if (input.displayName?.trim() === GRANT_INVITE_PLACEHOLDER_DISPLAY_NAME) return true;
  return false;
}
