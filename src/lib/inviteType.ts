import { TOPICS, type Topic } from './contact';

export type InviteType = Topic;

// Options the current invite form shows. Removed when the form moves to all TOPICS.
export const INVITE_TYPES = ['slack', 'sponsorship'] as const satisfies readonly Topic[];

function isTopic(value: string): value is Topic {
  return (TOPICS as readonly string[]).includes(value);
}

// Reads ?type= from a location.search string; only exact known values count.
export function inviteTypeFromSearch(search: string): Topic | null {
  const value = new URLSearchParams(search).get('type') ?? '';
  return isTopic(value) ? value : null;
}
