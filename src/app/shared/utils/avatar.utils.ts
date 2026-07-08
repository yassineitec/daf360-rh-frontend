/** True for any casing/whitespace variant of female (FEMALE, "Female ", female). */
export function isFemale(gender: string | null | undefined): boolean {
  return gender?.trim().toUpperCase() === 'FEMALE';
}

export function avatarUrl(gender: string | null | undefined): string {
  if (isFemale(gender)) return '/images/avatars/female.png';
  return '/images/avatars/male.png';
}

export function getAvatarUrl(
  profileId: number | null | undefined,
  photoUrl: string | null | undefined,
  gender: string | null | undefined,
): string {
  if (photoUrl && profileId) return `/api/hr/profiles/${profileId}/photo`;
  if (isFemale(gender)) return '/images/avatars/female.png';
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
