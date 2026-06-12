export function avatarUrl(gender: string | null | undefined): string {
  if (gender === 'FEMININ') return '/images/avatars/female.png';
  return '/images/avatars/male.png';
}
