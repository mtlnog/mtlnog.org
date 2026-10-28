import { describe, it, expect } from 'vitest';
import { splitMeetings } from './meetings';

describe('splitMeetings', () => {
  const a = { date: '2027-03-18', title: 'A', venue: 'V' };
  const b = { date: '2026-01-10', title: 'B', venue: 'V' };
  const c = { date: '2027-10-01', title: 'C', venue: 'V' };

  it('splits by date, counting today as upcoming', () => {
    const { upcoming, past } = splitMeetings([c, b, a], '2027-03-18');
    expect(upcoming.map((m) => m.title)).toEqual(['A', 'C']);
    expect(past.map((m) => m.title)).toEqual(['B']);
  });

  it('sorts past meetings newest first', () => {
    const d = { date: '2026-06-01', title: 'D', venue: 'V' };
    expect(splitMeetings([b, d], '2027-01-01').past.map((m) => m.title)).toEqual(['D', 'B']);
  });

  it('handles an empty list', () => {
    expect(splitMeetings([], '2027-01-01')).toEqual({ upcoming: [], past: [] });
  });
});
