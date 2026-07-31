/** True for any casing/whitespace variant of female (FEMALE, "Female ", female). */
export function isFemale(gender: string | null | undefined): boolean {
  return gender?.trim().toUpperCase() === 'FEMALE';
}

export function avatarUrl(gender: string | null | undefined): string {
  if (isFemale(gender)) return '/images/avatars/female.png';
  return '/images/avatars/male.png';
}

/**
 * The employee photo endpoint, or null when there is no photo on file.
 *
 * Deliberately a **relative** path. `employee_profiles.photo_url` already stores
 * `/api/hr/profiles/{id}/photo`, but prefixing it with `environment.hrApiUrl`
 * (`http://localhost:8888` in dev) makes the `<img>` a cross-origin request that
 * carries no Authorization header, so it 401s and falls back to the avatar —
 * which is exactly why the photo showed in the list and not on the detail page.
 * Same origin, through the dev proxy, is what works.
 */
export function profilePhotoUrl(
  profileId: number | null | undefined,
  photoUrl: string | null | undefined,
): string | null {
  return photoUrl && profileId ? `/api/hr/profiles/${profileId}/photo` : null;
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
