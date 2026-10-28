import { describe, it, expect } from 'vitest';
import { splitMeetings, montrealDate } from './meetings';

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

describe('montrealDate', () => {
  it('uses the Montréal calendar date, not UTC', () => {
    // 20:30 EDT on March 17 is already March 18 in UTC.
    expect(montrealDate(new Date('2027-03-18T00:30:00Z'))).toBe('2027-03-17');
    expect(montrealDate(new Date('2027-03-18T12:00:00Z'))).toBe('2027-03-18');
  });
});
