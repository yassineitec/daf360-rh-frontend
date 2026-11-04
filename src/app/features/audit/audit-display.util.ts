/**
 * Turns the raw generic audit_trail payload (snake_case table name, JSON pk/old/new-value
 * strings) into something a non-developer can actually read, without a backend change.
 *
 * Only ever applied to `source === 'GENERIC'` rows (see audit-log.component.ts): the older
 * EVENT_LOG rows already carry a curated entityType/entityId written by application code, not
 * a raw DB table name/pk_json, so running them through tableLabel/recordIdentity would be
 * meaningless or wrong.
 */

/** Hand-picked French labels for the tables people actually look up. Anything not listed falls
 *  back to {@link humanizeTableName} -- good enough, never a raw snake_case dead end. */
const TABLE_LABELS: Record<string, string> = {
  absence_modification_requests: "Demandes de modification d'absence",
  absences: 'Absences',
  AbsenceTypes: "Types d'absence",
  autorisations: 'Autorisations',
  banks: 'Banques',
  break_legal_rules: 'Règles légales de pause',
  break_templates: 'Modèles de pause',
  candidate_cost_approvals: 'Approbations de coût (candidats)',
  candidate_interview_interviewers: "Interviewers d'entretien",
  candidate_interviews: "Entretiens de candidats",
  candidates: 'Candidats',
  categorie_roles: 'Catégories de rôles',
  categories: 'Catégories',
  configurable_list_types: 'Types de listes configurables',
  configurable_list_values: 'Valeurs de listes configurables',
  contract_type_config: 'Configuration des types de contrat',
  contract_types: 'Types de contrat',
  contrats: 'Contrats',
  departments: 'Départements',
  disciplines: 'Disciplines',
  document_template_versions: 'Versions de maquette de document',
  document_templates: 'Maquettes de documents',
  documents_hr: 'Documents RH',
  email_routing_recipients: "Destinataires de routage d'email",
  employee_contracts: 'Contrats collaborateur',
  employee_documents: 'Documents collaborateur',
  employee_lifecycle_alerts: 'Alertes de cycle de vie',
  employee_lifecycle_transitions: 'Transitions de cycle de vie',
  employee_profiles: 'Profils collaborateur',
  employee_requests: 'Demandes collaborateur',
  employee_sharepoint_folders: 'Dossiers SharePoint collaborateur',
  exit_interviews: 'Entretiens de départ',
  fiches_paie: 'Fiches de paie',
  generated_documents: 'Documents générés',
  grades: 'Grades',
  historique_contrat_collaborateur: 'Historique de contrat',
  holidays: 'Jours fériés',
  interview_types: "Types d'entretien",
  it_asset_types: "Types d'actifs IT",
  it_assets: 'Actifs IT',
  it_provisioning: 'Provisionnement IT',
  job_offers: "Offres d'emploi",
  leave_balances: 'Soldes de congés',
  nationalities: 'Nationalités',
  nog_levels: 'Niveaux NOG',
  notification_event_types: "Types d'événements de notification",
  notification_routing_recipients: 'Destinataires de notification',
  notification_routing_rules: 'Règles de routage de notification',
  notifications: 'Notifications',
  offboarding_asset_returns: "Retours de matériel (offboarding)",
  offboarding_checklist_items: "Checklist d'offboarding",
  offboarding_settlement_lines: 'Lignes de solde de tout compte',
  offboarding_task_catalog: "Catalogue de tâches d'offboarding",
  offboarding_tasks: "Tâches d'offboarding",
  offboarding_validators: "Validateurs d'offboarding",
  offboarding_workflow_instances: "Instances de workflow d'offboarding",
  onboarding_drafts: "Brouillons d'onboarding",
  parameter_sets: 'Jeux de paramètres',
  parametrage_heures_supp_pays: 'Paramétrage heures supp. par pays',
  payroll_components: 'Composants de paie',
  payroll_simulations: 'Simulations de paie',
  pays: 'Pays',
  portal_events: 'Événements du portail',
  recruitment_demands: 'Demandes de recrutement',
  regime_assignment_history: "Historique d'affectation au régime",
  regime_role_assignments: 'Affectations rôle/régime',
  request_approvals: 'Approbations de demande',
  request_type_catalog: 'Catalogue des types de demande',
  role_permissions: 'Permissions de rôle',
  RoleApprovableAbsenceTypes: "Types d'absence approuvables par rôle",
  Roles: 'Rôles',
  sharepoint_locations: 'Emplacements SharePoint',
  teletravails: 'Télétravail',
  timesheet_records: 'Relevés de temps',
  type_contrat: 'Type de contrat',
  Users: 'Utilisateurs',
  workflow_instances: 'Instances de workflow',
  workflow_tasks: 'Tâches de workflow',
  working_time_regimes: 'Régimes de temps de travail',
};

export function tableLabel(tableName: string): string {
  return TABLE_LABELS[tableName] ?? humanizeTableName(tableName);
}

/** Which functional area a table belongs to -- coarser and more useful at a glance than the
 *  table name itself. Anything not listed falls back to 'Autre' rather than guessing. */
export type FunctionalDomain =
  | 'Profil collaborateur' | 'Recrutement' | 'Onboarding' | 'Offboarding' | 'Absences / Congés'
  | 'Contrats' | 'Temps de travail' | 'Cycle de vie collaborateur' | 'Documents' | 'Paie'
  | 'IT / Provisioning' | 'Workflow / Demandes' | 'Notifications' | 'Rôles / Permissions'
  | 'Référentiel' | 'Administration' | 'Autre';

const TABLE_DOMAINS: Record<string, FunctionalDomain> = {
  employee_profiles: 'Profil collaborateur', employee_requests: 'Profil collaborateur',
  employee_sharepoint_folders: 'Profil collaborateur', sharepoint_locations: 'Profil collaborateur',

  candidate_cost_approvals: 'Recrutement', candidate_interview_interviewers: 'Recrutement',
  candidate_interviews: 'Recrutement', candidates: 'Recrutement', interview_types: 'Recrutement',
  job_offers: 'Recrutement', recruitment_demands: 'Recrutement',

  onboarding_drafts: 'Onboarding',

  exit_interviews: 'Offboarding', offboarding_asset_returns: 'Offboarding',
  offboarding_checklist_items: 'Offboarding', offboarding_settlement_lines: 'Offboarding',
  offboarding_task_catalog: 'Offboarding', offboarding_tasks: 'Offboarding',
  offboarding_validators: 'Offboarding', offboarding_workflow_instances: 'Offboarding',

  absence_modification_requests: 'Absences / Congés', absences: 'Absences / Congés',
  AbsenceTypes: 'Absences / Congés', autorisations: 'Absences / Congés',
  break_legal_rules: 'Absences / Congés', break_templates: 'Absences / Congés',
  leave_balances: 'Absences / Congés', holidays: 'Absences / Congés',

  contract_type_config: 'Contrats', contract_types: 'Contrats', type_contrat: 'Contrats',
  contrats: 'Contrats', employee_contracts: 'Contrats',
  historique_contrat_collaborateur: 'Contrats', grades: 'Contrats', nog_levels: 'Contrats',
  departments: 'Contrats',

  timesheet_records: 'Temps de travail', working_time_regimes: 'Temps de travail',
  regime_assignment_history: 'Temps de travail', regime_role_assignments: 'Temps de travail',
  teletravails: 'Temps de travail',

  employee_lifecycle_alerts: 'Cycle de vie collaborateur',
  employee_lifecycle_transitions: 'Cycle de vie collaborateur',

  document_template_versions: 'Documents', document_templates: 'Documents',
  documents_hr: 'Documents', generated_documents: 'Documents', employee_documents: 'Documents',

  fiches_paie: 'Paie', payroll_components: 'Paie', payroll_simulations: 'Paie',
  parametrage_heures_supp_pays: 'Paie',

  it_asset_types: 'IT / Provisioning', it_assets: 'IT / Provisioning', it_provisioning: 'IT / Provisioning',

  request_approvals: 'Workflow / Demandes', request_type_catalog: 'Workflow / Demandes',
  workflow_instances: 'Workflow / Demandes', workflow_tasks: 'Workflow / Demandes',

  email_routing_recipients: 'Notifications', notification_event_types: 'Notifications',
  notification_routing_recipients: 'Notifications', notification_routing_rules: 'Notifications',
  notifications: 'Notifications', portal_events: 'Notifications',

  role_permissions: 'Rôles / Permissions', RoleApprovableAbsenceTypes: 'Rôles / Permissions',
  Roles: 'Rôles / Permissions', categorie_roles: 'Rôles / Permissions',

  banks: 'Référentiel', categories: 'Référentiel', configurable_list_types: 'Référentiel',
  configurable_list_values: 'Référentiel', disciplines: 'Référentiel', nationalities: 'Référentiel',
  pays: 'Référentiel',

  parameter_sets: 'Administration', sysdiagrams: 'Administration', Users: 'Administration',
};

export function tableDomain(tableName: string): FunctionalDomain {
  return TABLE_DOMAINS[tableName] ?? 'Autre';
}

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'secondary' | 'neutral' | 'teal';

/** I/U/D -> the same create/update/delete colour convention as version control and every other
 *  audit log: green means something new exists, blue means something changed in place, red means
 *  something is gone. GENERIC rows only -- EVENT_LOG's action strings aren't I/U/D codes. */
export function actionVariant(action: string): BadgeVariant {
  return action === 'I' ? 'success' : action === 'D' ? 'danger' : 'info';
}

/** One colour family per functional area, grouped by what the area is about rather than
 *  assigned arbitrarily: collaborator/career-lifecycle core (primary), contracts/documents/paie
 *  paperwork (secondary), time/absence side (teal), everything workflow/admin/référentiel
 *  (neutral). Same domain always gets the same colour. */
const DOMAIN_VARIANTS: Record<FunctionalDomain, BadgeVariant> = {
  'Profil collaborateur': 'primary',
  'Cycle de vie collaborateur': 'primary',
  'Recrutement': 'primary',
  'Onboarding': 'primary',
  'Offboarding': 'primary',
  'Contrats': 'secondary',
  'Documents': 'secondary',
  'Paie': 'secondary',
  'Absences / Congés': 'teal',
  'Temps de travail': 'teal',
  'IT / Provisioning': 'neutral',
  'Workflow / Demandes': 'neutral',
  'Notifications': 'neutral',
  'Rôles / Permissions': 'neutral',
  'Référentiel': 'neutral',
  'Administration': 'neutral',
  'Autre': 'neutral',
};

export function domainVariant(domain: FunctionalDomain): BadgeVariant {
  return DOMAIN_VARIANTS[domain];
}

/** Tables with a direct FK to `employee_profiles` (confirmed via a live schema query against
 *  DAF360_HR, not a naming guess) -- excludes `Users`-table FKs (those are "who acted" roles:
 *  approver, responsable, created_by... not "which employee this row is about") and
 *  `candidates`-table FKs (a candidate isn't an employee yet -- a separate, pre-hire concept
 *  this version doesn't resolve). `employee_profiles` itself is the self-referencing case. */
const EMPLOYEE_FK_TABLES = new Set([
  'employee_contracts', 'employee_documents', 'employee_lifecycle_alerts',
  'employee_lifecycle_transitions', 'employee_requests', 'employee_sharepoint_folders',
  'leave_balances', 'payroll_simulations', 'workflow_instances',
]);

/** The employee a GENERIC row belongs to, read straight from the row's own JSON -- works for the
 *  9 tables above plus `employee_profiles` itself (its own id IS the employee). Tables that only
 *  reach an employee indirectly (e.g. via a contract id) are not resolved in this version. */
export function rowEmployeeProfileId(entry: { entityType: string; entityId: string | null; oldValue: string | null; newValue: string | null }): number | null {
  if (entry.entityType === 'employee_profiles') {
    const pk = safeParse(entry.entityId);
    const id = pk?.['id'];
    return typeof id === 'number' ? id : null;
  }
  if (!EMPLOYEE_FK_TABLES.has(entry.entityType)) return null;
  const row = safeParse(entry.newValue) ?? safeParse(entry.oldValue);
  const id = row?.['employee_profile_id'];
  return typeof id === 'number' ? id : null;
}

function humanizeTableName(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\p{L}/gu, c => c.toUpperCase());
}

const IDENTITY_FIELD_CANDIDATES = [
  'reference', 'matricule', 'numero', 'number', 'code',
  'email', 'username', 'nom', 'name', 'libelle', 'label', 'intitule', 'titre', 'title',
];

function safeParse(json: string | null): Record<string, unknown> | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function formatPk(pkJson: string | null): string {
  const pk = safeParse(pkJson);
  if (!pk) return pkJson ?? '—';
  return Object.entries(pk).map(([k, v]) => `${k} = ${v}`).join(', ');
}

/** The best short label this GENERIC entry can offer for "which record": a meaningful field
 *  from the row itself when one exists, else the formatted primary key (never raw JSON). */
export function recordIdentity(entry: { entityId: string | null; oldValue: string | null; newValue: string | null }): string {
  const row = safeParse(entry.newValue) ?? safeParse(entry.oldValue);
  if (row) {
    for (const key of IDENTITY_FIELD_CANDIDATES) {
      const value = row[key];
      if (value !== null && value !== undefined && String(value).trim() !== '') return String(value);
    }
  }
  return formatPk(entry.entityId);
}

export interface FieldDiff {
  field: string;
  before: string;
  after: string;
  changed: boolean;
}

const NO_VALUE = '—';

function display(value: unknown): string {
  if (value === null || value === undefined) return NO_VALUE;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** Field-by-field before/after for one entry. Works for any row that has oldValue/newValue
 *  JSON -- harmless no-op (empty list) for an EVENT_LOG row that doesn't carry full-row JSON. */
export function computeFieldDiffs(entry: { oldValue: string | null; newValue: string | null }): FieldDiff[] {
  const before = safeParse(entry.oldValue) ?? {};
  const after = safeParse(entry.newValue) ?? {};
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).sort();
  return keys.map(field => {
    const b = before[field];
    const a = after[field];
    return {
      field,
      before: field in before ? display(b) : NO_VALUE,
      after: field in after ? display(a) : NO_VALUE,
      changed: JSON.stringify(b) !== JSON.stringify(a),
    };
  });
}

export interface AuditEntryLike {
  source: 'EVENT_LOG' | 'GENERIC';
  entityType: string;
  action: string;
  actor: string | null;
  timestamp: string;
}

export interface SingleRow<T> { kind: 'single'; entry: T }
export interface GroupRow<T> { kind: 'group'; members: T[]; entityType: string; action: string; timestamp: string }
export type DisplayRow<T> = SingleRow<T> | GroupRow<T>;

const BATCH_WINDOW_MS = 2000;
/** Collapsing below this size would hide more than it declutters -- a real burst is dozens of
 *  rows, not two or three. */
const MIN_BATCH_SIZE = 3;

/** Groups consecutive, same-table/action, actor-less GENERIC entries fired within a tight time
 *  window (a scheduled job writing many rows at once) into one summary row. Never touches a row
 *  with a real actor, and never touches an EVENT_LOG row -- those are event-driven, curated, and
 *  rare enough that grouping them would only hide real human/system actions individually logged
 *  on purpose. `entries` must already be sorted newest-first (the API's own order), preserved here. */
export function groupBatches<T extends AuditEntryLike>(entries: T[]): DisplayRow<T>[] {
  const out: DisplayRow<T>[] = [];
  let i = 0;
  while (i < entries.length) {
    const start = entries[i];
    let j = i + 1;
    if (start.source === 'GENERIC' && start.actor === null) {
      while (
        j < entries.length &&
        entries[j].source === 'GENERIC' &&
        entries[j].entityType === start.entityType &&
        entries[j].action === start.action &&
        entries[j].actor === null &&
        Math.abs(new Date(entries[j - 1].timestamp).getTime() - new Date(entries[j].timestamp).getTime()) <= BATCH_WINDOW_MS
      ) {
        j++;
      }
    }
    const size = j - i;
    if (size >= MIN_BATCH_SIZE) {
      out.push({ kind: 'group', members: entries.slice(i, j), entityType: start.entityType, action: start.action, timestamp: start.timestamp });
    } else {
      for (let k = i; k < j; k++) out.push({ kind: 'single', entry: entries[k] });
    }
    i = j;
  }
  return out;
}
