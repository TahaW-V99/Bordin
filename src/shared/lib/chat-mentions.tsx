import type { ReactNode } from "react";

const MENTION_TOKEN_RE = /@\[(user|team):([^|\]]+)\|([^\]]+)\]/g;

export type ParsedUserMention = {
  userId: string;
  displayName: string;
};

export type ParsedTeamMention = {
  teamId: string;
  teamName: string;
};

export type ComposerMentionMeta = Map<
  string,
  { kind: "user" | "team"; id: string; displayName: string }
>;

export function formatComposerMentionLabel(displayName: string) {
  return `@[${displayName}]`;
}

export function formatChatMentionPlainText(body: string) {
  return body
    .replace(/@\[(?:user|team):[^|\]]+\|([^\]]+)\]/g, "@$1")
    .replace(/@\[([^\]]+)\]/g, "@$1")
    .replace(/@\[(?:user|team):[^\]]*$/g, "");
}

export function decodeMentionsForComposer(body: string): {
  text: string;
  meta: ComposerMentionMeta;
} {
  const meta: ComposerMentionMeta = new Map();
  const text = body.replace(MENTION_TOKEN_RE, (_match, kind, id, name) => {
    const visible = formatComposerMentionLabel(name);
    meta.set(visible, {
      kind: kind as "user" | "team",
      id,
      displayName: name,
    });
    return visible;
  });
  return { text, meta };
}

export function encodeComposerMentions(text: string, meta: ComposerMentionMeta) {
  let result = text;
  for (const [visible, entry] of meta) {
    const replacement =
      entry.kind === "user"
        ? formatUserMention(entry.id, entry.displayName)
        : formatTeamMention(entry.id, entry.displayName);
    result = result.split(visible).join(replacement);
  }
  return result;
}

export function mentionCandidateKey(participant: {
  kind: "user" | "team";
  userId?: string;
  teamId?: string;
}) {
  return participant.kind === "team"
    ? `team:${participant.teamId}`
    : `user:${participant.userId}`;
}

export function formatUserMention(userId: string, displayName: string) {
  return `@[user:${userId}|${displayName}]`;
}

export function formatTeamMention(teamId: string, teamName: string) {
  return `@[team:${teamId}|${teamName}]`;
}

export function parseChatMentions(body: string): {
  users: ParsedUserMention[];
  teams: ParsedTeamMention[];
} {
  const users: ParsedUserMention[] = [];
  const teams: ParsedTeamMention[] = [];
  const seenUsers = new Set<string>();
  const seenTeams = new Set<string>();

  for (const match of body.matchAll(MENTION_TOKEN_RE)) {
    const kind = match[1];
    const id = match[2]!;
    const label = match[3]!;
    if (kind === "user" && !seenUsers.has(id)) {
      seenUsers.add(id);
      users.push({ userId: id, displayName: label });
    }
    if (kind === "team" && !seenTeams.has(id)) {
      seenTeams.add(id);
      teams.push({ teamId: id, teamName: label });
    }
  }

  return { users, teams };
}

export function renderChatMentionBody(
  body: string,
  mentionClassName = "font-semibold text-sky-400",
): ReactNode[] {
  const parts = body.split(/(@\[(?:user|team):[^|\]]+\|[^\]]+\]|@\[[^\]]+\]|@[A-Za-z0-9_\u0600-\u06FF-]+)/g);

  return parts.map((part, index) => {
    const tokenMatch = part.match(/^@\[(?:user|team):[^|\]]+\|([^\]]+)\]$/);
    if (tokenMatch) {
      return (
        <span key={`${part}-${index}`} className={mentionClassName}>
          @{tokenMatch[1]}
        </span>
      );
    }
    if (part.startsWith("@[")) {
      return (
        <span key={`${part}-${index}`} className={mentionClassName}>
          @{part.slice(2, -1)}
        </span>
      );
    }
    if (part.startsWith("@")) {
      return (
        <span key={`${part}-${index}`} className={mentionClassName}>
          {part}
        </span>
      );
    }
    return <span key={`${part}-${index}`}>{part}</span>;
  });
}
