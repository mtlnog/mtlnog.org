export interface Meeting {
  date: string; // YYYY-MM-DD
  title: string;
  venue: string;
  url?: string;
}

// Add meetings here; the Meetings page splits them by build date.
export const meetings: Meeting[] = [];

export function splitMeetings(
  list: Meeting[],
  today: string,
): { upcoming: Meeting[]; past: Meeting[] } {
  const upcoming = list.filter((m) => m.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past = list.filter((m) => m.date < today).sort((a, b) => b.date.localeCompare(a.date));
  return { upcoming, past };
}
