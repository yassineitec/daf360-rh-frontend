/**
 * The employee's whole SharePoint dossier — mirror of rh-service `DocumentHistoryService.History`.
 *
 * `status` is the outcome of the lookup, not of one tree:
 *  - FOUND          at least one employee root was listed
 *  - NO_CONFIG      no root could be derived (no path for the country, unusable/ambiguous name)
 *  - FOLDER_MISSING roots derived, none exists in SharePoint
 *  - UNAVAILABLE    Graph credentials are not set on this deployment
 */
export type DocumentHistoryStatus = 'FOUND' | 'NO_CONFIG' | 'FOLDER_MISSING' | 'UNAVAILABLE';

/** One tree walked — e.g. `01_Contracts-Employment`, `03_Payroll-Admin`. */
export interface DocumentHistoryRoot {
  key: string;
  path: string;
  found: boolean;
  truncated: boolean;
}

export interface DocumentHistoryEntry {
  /** Graph drive item id — the only handle the download endpoint accepts. */
  id: string;
  name: string;
  rootKey: string;
  /** First subfolder under the employee root; null for a file in the root itself. */
  category: string | null;
  folderPath: string;
  createdAt: string | null;
  modifiedAt: string | null;
  createdBy: string | null;
  modifiedBy: string | null;
  sizeBytes: number | null;
  webUrl: string | null;
  /** Uploaded through the app (`{docId}_` prefix) — the Documents tab lists it too. */
  filedByApp: boolean;
  docId: number | null;
}

export interface DocumentHistory {
  status: DocumentHistoryStatus;
  roots: DocumentHistoryRoot[];
  items: DocumentHistoryEntry[];
  truncated: boolean;
  fetchedAt: string;
}
