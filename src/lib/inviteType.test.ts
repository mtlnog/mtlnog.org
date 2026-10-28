import { describe, it, expect } from 'vitest';
import { inviteTypeFromSearch } from './inviteType';

describe('inviteTypeFromSearch', () => {
  it('returns a known invite type', () => {
    expect(inviteTypeFromSearch('?type=sponsorship')).toBe('sponsorship');
    expect(inviteTypeFromSearch('?type=slack&x=1')).toBe('slack');
  });

  it('ignores unknown, differently cased, empty or missing values', () => {
    expect(inviteTypeFromSearch('?type=SPONSORSHIP')).toBeNull();
    expect(inviteTypeFromSearch('?type=foo')).toBeNull();
    expect(inviteTypeFromSearch('?type=')).toBeNull();
    expect(inviteTypeFromSearch('')).toBeNull();
  });
});
