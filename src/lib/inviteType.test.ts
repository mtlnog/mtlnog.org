import { describe, it, expect } from 'vitest';
import { inviteTypeFromSearch } from './inviteType';

describe('inviteTypeFromSearch', () => {
  it('returns a known invite type', () => {
    expect(inviteTypeFromSearch('?type=sponsorship')).toBe('sponsorship');
    expect(inviteTypeFromSearch('?type=slack&x=1')).toBe('slack');
    expect(inviteTypeFromSearch('?type=venue')).toBe('venue');
    expect(inviteTypeFromSearch('?type=speaking')).toBe('speaking');
    expect(inviteTypeFromSearch('?type=general')).toBe('general');
  });

  it('ignores unknown, differently cased, empty or missing values', () => {
    expect(inviteTypeFromSearch('?type=SPONSORSHIP')).toBeNull();
    expect(inviteTypeFromSearch('?type=foo')).toBeNull();
    expect(inviteTypeFromSearch('?type=')).toBeNull();
    expect(inviteTypeFromSearch('')).toBeNull();
  });
});
