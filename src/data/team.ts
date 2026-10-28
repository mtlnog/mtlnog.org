export interface TeamMember {
  id: 'eric' | 'jonathan' | 'denis';
  name: string;
  // Path under public/, e.g. '/team/eric.jpg'. Initials are shown when absent.
  photo?: string;
}

// Roles and bios are translated in src/i18n/{fr,en}.json under team.members.<id>.
export const team: readonly TeamMember[] = [
  { id: 'eric', name: 'Eric Dugas' },
  { id: 'jonathan', name: 'Jonathan Senecal' },
  { id: 'denis', name: 'Denis Bonneau' },
];
