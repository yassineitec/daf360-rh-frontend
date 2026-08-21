/**
 * IT equipment ledger — `it_asset_assignments` (backend V76).
 *
 * One row = one item held by the employee over a period. Several rows of the same type
 * are normal (a replaced laptop, a second monitor). This is NOT `ItAssetDto` from the
 * it-provisioning module: that one is the hire-time form, unique per (dossier, type)
 * and dateless.
 */

/** The item is only "held" while `returnedAt` is null; the other three close the line. */
export type AssetAssignmentStatus = 'ASSIGNED' | 'RETURNED' | 'LOST' | 'WRITTEN_OFF';

/** Where the row came from, so a manual correction is visible as one. */
export type AssetAssignmentSource = 'ONBOARDING' | 'MANUAL' | 'OFFBOARDING' | 'IMPORT';

/** Condition at hand-over. `PERDU` is return-only. */
export type AssetCondition =
  'NEUF' | 'BON_ETAT' | 'USAGE' | 'EN_REPARATION' | 'DEFECTUEUX';

export type AssetReturnCondition = AssetCondition | 'PERDU';

export interface ItAssetAssignmentDto {
  id: number;
  employeeProfileId: number;

  assetTypeId: number;
  assetTypeCode: string | null;
  assetTypeLabelFr: string | null;
  assetTypeLabelEn: string | null;

  serialNumber: string | null;
  brandModel: string | null;
  assetTag: string | null;

  assignedAt: string;            // ISO date
  returnedAt: string | null;     // ISO date, null while held

  conditionOnAssign: string;
  conditionOnReturn: string | null;

  status: AssetAssignmentStatus;
  source: AssetAssignmentSource;

  itProvisioningId: number | null;
  offboardingReturnId: number | null;

  assignedBy: number | null;
  assignedByName: string | null;
  returnedBy: number | null;
  returnedByName: string | null;

  notes: string | null;

  /** Backend-computed, = `returnedAt === null`. */
  isCurrent: boolean;
  /** Backend-computed: to today while held, else assignedAt → returnedAt. */
  daysHeld: number;
}

export interface CreateAssetAssignmentRequest {
  assetTypeId: number;
  assignedAt: string;
  serialNumber?: string | null;
  brandModel?: string | null;
  assetTag?: string | null;
  conditionOnAssign?: string;
  notes?: string | null;
}

export interface ReturnAssetAssignmentRequest {
  returnedAt: string;
  conditionOnReturn?: string | null;
  /** RETURNED (default) | LOST | WRITTEN_OFF */
  status?: AssetAssignmentStatus;
  notes?: string | null;
}

export interface UpdateAssetAssignmentRequest {
  assetTypeId?: number;
  serialNumber?: string | null;
  brandModel?: string | null;
  assetTag?: string | null;
  assignedAt?: string;
  conditionOnAssign?: string;
  notes?: string | null;
}

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'teal';

/**
 * Literal variants, not a computed colour: `daf-badge` maps these to whole Tailwind
 * classes, and a runtime-built one never survives the app's class scan (UI-PLAYBOOK §3).
 * Labels are i18n keys — `statusBadge()` from shared/ is French-only.
 */
export const ASSET_STATUS_CONFIG: Record<AssetAssignmentStatus, { key: string; variant: BadgeVariant }> = {
  ASSIGNED:    { key: 'PROFILES.IT_ASSETS.STATUS.ASSIGNED',    variant: 'teal'    },
  RETURNED:    { key: 'PROFILES.IT_ASSETS.STATUS.RETURNED',    variant: 'neutral' },
  LOST:        { key: 'PROFILES.IT_ASSETS.STATUS.LOST',        variant: 'danger'  },
  WRITTEN_OFF: { key: 'PROFILES.IT_ASSETS.STATUS.WRITTEN_OFF', variant: 'warning' },
};

export const ASSET_SOURCE_KEYS: Record<AssetAssignmentSource, string> = {
  ONBOARDING:  'PROFILES.IT_ASSETS.SOURCE.ONBOARDING',
  MANUAL:      'PROFILES.IT_ASSETS.SOURCE.MANUAL',
  OFFBOARDING: 'PROFILES.IT_ASSETS.SOURCE.OFFBOARDING',
  IMPORT:      'PROFILES.IT_ASSETS.SOURCE.IMPORT',
};

export const ASSIGN_CONDITIONS: AssetCondition[] =
  ['NEUF', 'BON_ETAT', 'USAGE', 'EN_REPARATION', 'DEFECTUEUX'];

export const RETURN_CONDITIONS: AssetReturnCondition[] =
  [...ASSIGN_CONDITIONS, 'PERDU'];

/** Material Symbols glyph per asset type code, with a generic fallback. */
export function assetIcon(code: string | null): string {
  switch ((code ?? '').toUpperCase()) {
    case 'LAPTOP':    case 'PC_PORTABLE': return 'laptop_mac';
    case 'DESKTOP':   case 'PC_FIXE':     return 'desktop_windows';
    case 'MONITOR':   case 'ECRAN':       return 'monitor';
    case 'PHONE':     case 'TELEPHONE':   return 'smartphone';
    case 'SIM':       case 'CARTE_SIM':   return 'sim_card';
    case 'MOUSE':     case 'SOURIS':      return 'mouse';
    case 'KEYBOARD':  case 'CLAVIER':     return 'keyboard';
    case 'HEADSET':   case 'CASQUE':      return 'headset_mic';
    case 'BADGE':                         return 'badge';
    case 'DOCK':      case 'STATION':     return 'dock';
    case 'TABLET':    case 'TABLETTE':    return 'tablet_mac';
    case 'PRINTER':   case 'IMPRIMANTE':  return 'print';
    case 'VEHICLE':   case 'VEHICULE':    return 'directions_car';
    default:                              return 'inventory_2';
  }
}
