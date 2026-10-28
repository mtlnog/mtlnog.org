export interface TeamMember {
  id: 'eric' | 'jonathan' | 'denis';
  name: string;
  email: string;
  // Path under public/, e.g. '/team/eric.jpg'. Initials are shown when absent.
  photo?: string;
}

// Roles and bios are translated in src/i18n/{fr,en}.json under team.members.<id>.
export const team: readonly TeamMember[] = [
  { id: 'eric', name: 'Eric Dugas', email: 'eric@mtlnog.org' },
  { id: 'jonathan', name: 'Jonathan Senecal', email: 'jonathan@mtlnog.org' },
  { id: 'denis', name: 'Denis Bonneau', email: 'denis@mtlnog.org' },
];
