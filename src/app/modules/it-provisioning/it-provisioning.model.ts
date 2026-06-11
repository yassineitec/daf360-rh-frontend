
export type ItProvisioningStatus = 'PENDING' | 'IN_PROGRESS' | 'EMAIL_CREATED' | 'COMPLETED';

// ─────────────────────────────────────────────────────────────────────────────
// IT Assets (new it_assets table — replaces per-field flat structure)
// ─────────────────────────────────────────────────────────────────────────────
export interface ItAssetDto {
  id:               number;
  assetTypeCode:    string;
  assetTypeLabelFr: string;
  provided:         boolean;
  serialNumber:     string | null;
  brandModel:       string | null;
  assetTag:         string | null;
  status:           string;
}

export type AssetStatus = 'NEUF' | 'BON_ETAT' | 'USAGE' | 'EN_REPARATION' | 'DEFECTUEUX';

export interface ProvisioningListItem {
  id: number;
  candidateId: number;
  candidateFullName: string;
  appliedPosition: string | null;
  paysId: number;
  expectedStartDate: string | null;
  candidateAcceptedAt: string | null;
  status: ItProvisioningStatus;
  ms365Email: string | null;
  assetsProvided: number;    // count of provided assets from it_assets
  licenseOffice365: boolean;
  licenseAutocad: boolean;
  licenseRevit: boolean;
  licenseAutodesk: boolean;
  licenseKaspersky: boolean;
  licenseOther: string | null;
  createdAt: string;
}

export interface ProvisioningDetail {
  id: number;
  candidateId: number;
  userId: number | null;
  status: ItProvisioningStatus;
  ms365Email: string | null;
  ms365EmailCreatedAt: string | null;
  // ── Assets list (new it_assets table) ────────────────────────────────────
  assets: ItAssetDto[];
  hardwareNotes: string | null;
  licenseOffice365: boolean;
  licenseAutocad: boolean;
  licenseRevit: boolean;
  licenseAutodesk: boolean;
  licenseKaspersky: boolean;
  licenseOther: string | null;
  adAccountCreated: boolean;
  adProfileType: string | null;
  adAccountCreatedAt: string | null;
  completedBy: number | null;
  completedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string | null;
  // Enriched from candidate
  candidateFullName: string;
  appliedPosition: string | null;
  paysId: number;
  expectedStartDate: string | null;
  candidateAcceptedAt: string | null;
}

export interface UpdateAssetRequest {
  id:           number;
  provided:     boolean;
  serialNumber: string | null;
  brandModel:   string | null;
  assetTag:     string | null;
  status:       string | null;
}

export interface UpdateProvisioningRequest {
  // Assets are sent as a list of patch objects
  assets?: UpdateAssetRequest[];
  hardwareNotes?: string | null;
  licenseOffice365?: boolean;
  licenseAutocad?: boolean;
  licenseRevit?: boolean;
  licenseAutodesk?: boolean;
  licenseKaspersky?: boolean;
  licenseOther?: string | null;
  adAccountCreated?: boolean;
  adProfileType?: string | null;
  notes?: string | null;
}

// Progress step computed from ProvisioningDetail
export interface ProgressStep { label: string; done: boolean; }

export function computeSteps(p: ProvisioningDetail | null): ProgressStep[] {
  const anyProvided = p?.assets?.some(a => a.provided) ?? false;
  return [
    { label: 'MS365',            done: !!p?.ms365Email },
    { label: 'Matériel',         done: anyProvided },
    { label: 'Licences',         done: !!p?.licenseOffice365 },
    { label: 'Active Directory', done: !!p?.adAccountCreated },
    { label: 'Terminé',          done: p?.status === 'COMPLETED' },
  ];
}

