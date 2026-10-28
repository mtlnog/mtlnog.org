export const INVITE_TYPES = ['slack', 'sponsorship'] as const;

export type InviteType = (typeof INVITE_TYPES)[number];

function isInviteType(value: string): value is InviteType {
  return (INVITE_TYPES as readonly string[]).includes(value);
}

// Reads ?type= from a location.search string; only exact known values count.
export function inviteTypeFromSearch(search: string): InviteType | null {
  const value = new URLSearchParams(search).get('type') ?? '';
  return isInviteType(value) ? value : null;
}
