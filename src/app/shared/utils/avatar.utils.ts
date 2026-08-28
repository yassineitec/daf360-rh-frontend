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
  // 'sm' like getAvatarUrl: this helper is documented for tiles, and a tile never needs 512px.
  return profilePhotoUrl(profileId, photoUrl, 'sm') ?? genderAvatarUrl(gender);
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
  size?: PhotoSize,
): string | null {
  if (!photoUrl || !profileId) return null;
  const params = [
    size === 'sm' ? 'size=sm' : null,
    versionOf(photoUrl),
  ].filter(Boolean);
  return `/api/hr/profiles/${profileId}/photo${params.length ? '?' + params.join('&') : ''}`;
}

/**
 * The `v=…` token out of a stored `photo_url`, or null.
 *
 * **This is what makes a replaced photo appear.** The endpoint answers with a seven-day
 * `Cache-Control`, and the backend's whole defence against that is rewriting `photo_url` with a
 * fresh `?v={epochSeconds}` on every upload and on every revalidation that finds a new file
 * (`EmployeeProfileService.photoUrlFor`). Rebuilding the URL from the profile id alone — which
 * this function used to do — threw the token away, so the `<img>` src was byte-identical before
 * and after an upload and the browser never refetched: the upload succeeded, SharePoint got the
 * file, and the page kept showing the old face until the week elapsed.
 *
 * Read out of the stored value rather than generated here (e.g. `Date.now()`): a token that
 * changes on every render would defeat the cache entirely and re-download every avatar on every
 * navigation. The token must change exactly when the image does, and only the server knows that.
 *
 * Null-safe by design — rows stamped by hand (the `photo_url` backfill UPDATE) carry no token,
 * and those simply keep the previous caching behaviour rather than breaking.
 */
function versionOf(photoUrl: string): string | null {
  const at = photoUrl.indexOf('v=');
  if (at < 0) return null;
  const value = photoUrl.slice(at + 2).split('&')[0];
  return /^[0-9]+$/.test(value) ? `v=${value}` : null;
}

/**
 * Which cached variant to request. `'sm'` is the 128px copy, for surfaces that draw the face
 * small — grid cards, table rows, the annuaire. Omit it on the detail page: that one shows a
 * large portrait and the 512px master is the point.
 *
 * The distinction is worth the parameter because the endpoint answers with a seven-day
 * `Cache-Control`, so a list view that asks for full size makes the browser hold a 512px image
 * for a 32px cell for a week.
 */
export type PhotoSize = 'sm' | 'full';

/**
 * The detail page's photo URL: full size, and re-read from SharePoint on load.
 *
 * `fresh=1` makes the backend ignore its 24-hour revalidation window for this one employee, so
 * the profile you are looking at is never showing a photo that has since been replaced or deleted
 * in SharePoint. Affordable precisely because it is ONE person — two Graph calls on an image
 * request that loads asynchronously.
 *
 * Never use this for a list. Twelve avatars would be 24 Graph calls per page view, and a
 * hundred-person annuaire 200; keeping lists fresh is the delta sync's job, which costs one call
 * for the whole drive.
 */
export function profilePhotoUrlFresh(
  profileId: number | null | undefined,
  photoUrl: string | null | undefined,
): string | null {
  const base = profilePhotoUrl(profileId, photoUrl);
  if (!base) return null;
  return base + (base.includes('?') ? '&' : '?') + 'fresh=1';
}

/**
 * List-surface avatar: the small photo variant, then the gendered placeholder.
 *
 * Always `?size=sm` — every caller of this helper renders a table row or a card, never a
 * detail-page portrait. A caller that needs full size builds the URL with
 * {@link profilePhotoUrl} instead.
 */
export function getAvatarUrl(
  profileId: number | null | undefined,
  photoUrl: string | null | undefined,
  gender: string | null | undefined,
): string {
  // Through profilePhotoUrl so the cache-busting token is carried here too: a photo replaced on
  // the detail page has to change in the list as well, and this helper feeds every list.
  return profilePhotoUrl(profileId, photoUrl, 'sm')
    ?? (isFemale(gender) ? '/images/avatars/female.png' : '/images/avatars/male.png');
}

export function getInitials(fullName: string): string {
  return fullName
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
