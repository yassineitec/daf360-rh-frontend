export interface RefDataItem {
  id: number;
  paysId?: number;
  code?: string;
  labelFr: string;
  labelEn: string;
  sortOrder?: number;
  isActive: boolean;
  swiftCode?: string;
  parentId?: number;
}

/**
 * One selectable IANA timezone. `label` carries the offset that applies right now
 * ("Africa/Tunis (UTC+01:00)") — computed server-side for display; only `id` is persisted,
 * because an offset changes with DST while a zone id does not.
 */
export interface TimezoneOption {
  id: string;
  label: string;
  offsetSeconds: number;
}

/**
 * An entity and the clock its employees work on. A null `timezone` means the entity is
 * NOT configured and its pointage automation is disabled — surface it as a warning.
 */
export interface PaysTimezone {
  id: number;
  isoCode: string;
  frenchLabel: string;
  timezone: string | null;
  offsetLabel: string | null;
}

export interface CreateRefDataRequest {
  paysId?: number;
  code?: string;
  labelFr: string;
  labelEn?: string;
  sortOrder?: number;
  swiftCode?: string;
  parentId?: number;
}
