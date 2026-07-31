import { OnboardingListItem } from './onboarding.model';

/**
 * Display helpers shared by the `/rh/onboarding` page, its card section and its
 * table section, so the three can never disagree on initials or on what the
 * "last updated" column actually means.
 */

export function initialsOf(fullName: string): string {
  const parts = (fullName ?? '').trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

/** The API sends ISO timestamps; the list only ever shows the date part. */
export function isoDate(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : '—';
}

/**
 * "Last updated" is the saved draft when there is one, otherwise the date the
 * MS365 mailbox was created — the two events this list can actually date.
 */
export function lastUpdated(item: OnboardingListItem): string {
  return isoDate(item.draftSavedAt ?? item.ms365EmailCreatedAt);
}
