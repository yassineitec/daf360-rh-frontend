/**
 * Canonical gender, tolerant of the pre-V38 vocabularies.
 *
 * `V38__unify_gender_values.sql` normalises employee_profiles.gender to
 * MALE/FEMALE/OTHER/UNSPECIFIED — but rh-service has no Flyway, so that script is applied
 * by hand and any un-migrated row still holds 'Homme', 'Femme', 'M', 'F', 'Masculin'…
 * Matching only 'MALE'/'FEMALE' silently drops the avatar for those rows, which is exactly
 * how "no avatars anywhere" happens. Same value lists as the migration.
 */
export type CanonicalGender = 'MALE' | 'FEMALE' | 'OTHER' | 'UNSPECIFIED';

const MALE_VALUES   = ['HOMME', 'MASCULIN', 'MASCULINO', 'MALE', 'M', 'H'];
const FEMALE_VALUES = ['FEMME', 'FEMININ', 'FÉMININ', 'FEMENINO', 'FEMALE', 'F'];

export function canonicalGender(gender: string | null | undefined): CanonicalGender {
  const g = gender?.trim().toUpperCase() ?? '';
  if (MALE_VALUES.includes(g)) return 'MALE';
  if (FEMALE_VALUES.includes(g)) return 'FEMALE';
  if (g === 'AUTRE' || g === 'OTHER' || g === 'O') return 'OTHER';
  return 'UNSPECIFIED';
}

/** True for any casing/whitespace/vocabulary variant of female. */
export function isFemale(gender: string | null | undefined): boolean {
  return canonicalGender(gender) === 'FEMALE';
}

/**
 * The gendered avatar, or `undefined` when the gender is unknown — callers then leave the
 * image unset so initials render. Deliberately different from {@link avatarUrl}, which
 * always returns a URL and would show an employee of unrecorded gender as male.
 */
export function genderAvatarUrl(gender: string | null | undefined): string | undefined {
  const g = canonicalGender(gender);
  if (g === 'MALE')   return '/images/avatars/male.png';
  if (g === 'FEMALE') return '/images/avatars/female.png';
  return undefined;
}

/**
 * The one avatar rule for employee/candidate tiles: real photo → gendered avatar →
 * `undefined` (caller falls back to initials).
 */
export function employeeAvatar(
  profileId: number | null | undefined,
  photoUrl: string | null | undefined,
  gender: string | null | undefined,
): string | undefined {
  return profilePhotoUrl(profileId, photoUrl) ?? genderAvatarUrl(gender);
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
