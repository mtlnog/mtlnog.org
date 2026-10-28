import { describe, it, expect } from 'vitest';
import { routes, pathFor, inviteHref, sponsorFormHref } from './routes';

describe('route map', () => {
  it('maps each page to its localized path', () => {
    expect(pathFor('home', 'fr')).toBe('/fr/');
    expect(pathFor('meetings', 'fr')).toBe('/fr/rencontres/');
    expect(pathFor('meetings', 'en')).toBe('/en/meetings/');
    expect(pathFor('team', 'fr')).toBe('/fr/equipe/');
    expect(pathFor('team', 'en')).toBe('/en/team/');
    expect(pathFor('sponsorship', 'fr')).toBe('/fr/commandites/');
    expect(pathFor('sponsorship', 'en')).toBe('/en/sponsorship/');
  });

  it('builds invite and sponsorship form links', () => {
    expect(inviteHref('en')).toBe('/en/#invite');
    expect(sponsorFormHref('fr')).toBe('/fr/?type=sponsorship#invite');
  });

  it('has a unique path for every page and locale', () => {
    expect(new Set(Object.values(routes).flatMap((r) => [r.fr, r.en])).size).toBe(8);
  });
});
