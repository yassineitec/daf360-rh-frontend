// ─────────────────────────────────────────────────────────────────────────────
// Enums & literals
// ─────────────────────────────────────────────────────────────────────────────
export type RequestStatus   = 'SUBMITTED' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'PENDING_L2';
export type RequestCategory = 'DOCUMENT' | 'PERSONAL_DATA_CHANGE' | 'BANK_DETAILS' | 'CAREER' | 'OTHER';

export const CATEGORY_LABELS: Record<RequestCategory, string> = {
  DOCUMENT:             'Document officiel',
  PERSONAL_DATA_CHANGE: 'Données personnelles',
  BANK_DETAILS:         'Coordonnées bancaires',
  CAREER:               'Carrière',
  OTHER:                'Autre',
};

export const STATUS_STEPS: RequestStatus[] = [
  'SUBMITTED', 'IN_REVIEW', 'PENDING_L2', 'APPROVED',
];

// ─────────────────────────────────────────────────────────────────────────────
// API DTOs
// ─────────────────────────────────────────────────────────────────────────────
export interface RequestType {
  id:                  number;
  paysId:              number;
  typeCode:            string;
  displayNameFr:       string;
  displayNameEn:       string;
  description:         string | null;
  category:            RequestCategory;
  approvalLevel:       'L1' | 'L2';
  defaultSlaDays:      number;
  documentTemplateUrl: string | null;
  isActive:            boolean;
}

export interface EmployeeRequest {
  id:                  number;
  employeeProfileId:   number;
  requestTypeId:       number;
  paysId:              number;
  submissionDate:      string;
  submissionChannel:   string;
  status:              RequestStatus;
  assignedOfficerId:   number | null;
  resolutionDate:      string | null;
  closureComment:      string | null;
  attachmentUrl:       string | null;
  createdAt:           string;
  updatedAt:           string | null;
  // Populated by backend enrichment
  typeCode?:           string;
  typeDisplayNameFr?:  string;
  approvals?:          ApprovalSummary[];
}

export interface ApprovalSummary {
  id:           number;
  level:        'L1' | 'L2';
  approverId:   number;
  decision:     'APPROVED' | 'REJECTED';
  comment:      string | null;
  decisionDate: string;
}

export interface GeneratedDocument {
  id:               number;
  employeeRequestId: number;
  documentType:     string;
  fileUrl:          string;
  verificationCode: string | null;
  generatedAt:      string;
  generatedBy:      number | null;
}

export interface RequestFilter {
  profileId?: number;
  status?:    RequestStatus;
  typeId?:    number;
  paysId?:    number;
  page?:      number;
  size?:      number;
}

export interface PageResponse<T> {
  content:       T[];
  page:          number;
  size:          number;
  totalElements: number;
  totalPages:    number;
  last:          boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dynamic form builder
// ─────────────────────────────────────────────────────────────────────────────
export type FieldType = 'text' | 'email' | 'tel' | 'textarea' | 'file' | 'date' | 'iban';

export interface FieldDef {
  key:         string;
  type:        FieldType;
  label:       string;
  placeholder?: string;
  required:    boolean;
  pattern?:    string;
  hint?:       string;
  /** Spans full width in the 2-col grid. */
  wide?:       boolean;
}

/** Fields specific to each type code (beyond the universal comment field). */
export const TYPE_FIELDS: Record<string, FieldDef[]> = {
  // ── PERSONAL_DATA_CHANGE ────────────────────────────────────────────────
  CHANGEMENT_ADRESSE: [
    { key: 'newValue', type: 'textarea', label: 'Nouvelle adresse complète', required: true, wide: true,
      placeholder: 'N° et rue, code postal, ville, pays' },
  ],
  CHANGEMENT_EMAIL: [
    { key: 'newValue', type: 'email', label: 'Nouvelle adresse email personnelle', required: true },
  ],
  CHANGEMENT_TELEPHONE: [
    { key: 'newValue', type: 'tel', label: 'Nouveau numéro de téléphone', required: true,
      placeholder: '+216 XX XXX XXX' },
  ],
  CHANGEMENT_URGENCE: [
    { key: 'contactName',     type: 'text', label: 'Nom et prénom',   required: true },
    { key: 'contactRelation', type: 'text', label: 'Lien de parenté', required: false },
    { key: 'contactPhone',    type: 'tel',  label: 'Téléphone',        required: true },
  ],
  CHANGEMENT_PHOTO: [
    { key: 'attachment', type: 'file', label: 'Nouvelle photo (JPG/PNG, max 2 Mo)',
      required: true, hint: 'Format portrait, fond neutre' },
  ],

  // ── BANK_DETAILS (L2) ────────────────────────────────────────────────────
  MISE_A_JOUR_BANCAIRE: [
    { key: 'bankName',   type: 'text', label: 'Banque',    required: true },
    { key: 'iban',       type: 'iban', label: 'IBAN',      required: true,
      placeholder: 'TN59…', pattern: '[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}' },
    { key: 'rib',        type: 'text', label: 'RIB',       required: false },
    { key: 'attachment', type: 'file', label: 'Relevé bancaire (PDF/JPG, max 5 Mo)',
      required: true, wide: true },
  ],

  // ── CAREER ───────────────────────────────────────────────────────────────
  DEMANDE_FORMATION: [
    { key: 'formationTitle', type: 'text',     label: 'Intitulé de la formation', required: true },
    { key: 'provider',       type: 'text',     label: 'Organisme de formation',   required: false },
    { key: 'startDate',      type: 'date',     label: 'Date de début prévue',     required: false },
    { key: 'motivation',     type: 'textarea', label: 'Justification',            required: true, wide: true },
  ],
  MUTATION_INTERNE: [
    { key: 'targetDept',  type: 'text',     label: 'Département / poste cible', required: true },
    { key: 'motivation',  type: 'textarea', label: 'Motivation',                required: true, wide: true },
  ],
  TELETRAVAIL_PONCTUEL: [
    { key: 'startDate', type: 'date',     label: 'Date souhaitée',  required: true },
    { key: 'reason',    type: 'textarea', label: 'Raison',           required: false },
  ],
};

/** Universal comment field appended to every form. */
export const COMMENT_FIELD: FieldDef = {
  key: 'comment', type: 'textarea', label: 'Commentaire (optionnel)',
  required: false, wide: true, placeholder: 'Informations complémentaires…',
};

/** Returns the ordered field definitions for a given type code. */
export function getFieldsForType(typeCode: string): FieldDef[] {
  const specific = TYPE_FIELDS[typeCode] ?? [];
  return [...specific, COMMENT_FIELD];
}

/** True when the field definition represents a file input. */
export function isFileField(f: FieldDef): boolean {
  return f.type === 'file';
}
