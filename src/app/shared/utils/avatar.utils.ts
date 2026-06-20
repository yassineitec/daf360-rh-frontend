export function avatarUrl(gender: string | null | undefined): string {
  if (gender === 'FEMININ') return '/images/avatars/female.png';
  return '/images/avatars/male.png';
}

export function getAvatarUrl(
  profileId: number | null | undefined,
  photoUrl: string | null | undefined,
  gender: string | null | undefined,
): string {
  if (photoUrl && profileId) return `/api/hr/profiles/${profileId}/photo`;
  if (gender === 'FEMININ') return '/images/avatars/female.png';
  return '/images/avatars/male.png';
}

export function getInitials(fullName: string): string {
  return fullName
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
