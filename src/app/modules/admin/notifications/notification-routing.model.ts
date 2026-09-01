export interface NotificationEventTypeWithRule {
  id: number;
  eventCode: string;
  labelFr: string;
  labelEn: string;
  module: string;
  supportsEmail: boolean;
  isSystem: boolean;
  /** Deep-link kind; null means notifications for this event are not clickable. */
  defaultEntityType: string | null;
  ruleId: number | null;
  sendInapp: boolean | null;
  sendEmail: boolean | null;
  inappRecipientCount: number;
  emailToCount: number;
}

export interface RoleOption { id: number; frenchName: string; }

export type RecipientMode =
  | 'ALL'                 // every holder of a role
  | 'MANAGER'             // holders of that role's parent
  | 'PERMISSION'          // every holder of a right
  | 'SUBJECT'             // the person the event is about — no role, no permission
  | 'MANAGER_OF_SUBJECT'; // that person's own manager

export interface RecipientItem {
  id: number;
  /** Null for a PERMISSION recipient, which targets a right rather than a role. */
  roleId: number | null;
  roleName: string | null;
  recipientField?: string | null;
  recipientMode?: RecipientMode | null;
  permissionCode?: string | null;
}

/** What the UI sends to add a recipient: a role + mode, or a permission. */
export interface RecipientDraft {
  mode: RecipientMode;
  roleId?: number;
  permissionCode?: string;
}

export interface PermissionOption { code: string; group: string; }

export interface RoutingRuleDetail {
  ruleId: number;
  eventType: NotificationEventTypeWithRule;
  sendInapp: boolean;
  sendEmail: boolean;
  inappTitleTemplate: string;
  inappBodyTemplate: string;
  emailSubjectTemplate: string | null;
  emailBodyTemplate: string | null;
  inappRecipients: RecipientItem[];
  emailToRecipients: RecipientItem[];
  emailCcRecipients: RecipientItem[];
  emailBccRecipients: RecipientItem[];
  availableRoles: RoleOption[];
}

export interface UpdateRoutingRuleRequest {
  sendInapp?: boolean;
  sendEmail?: boolean;
  inappTitleTemplate?: string;
  inappBodyTemplate?: string;
  emailSubjectTemplate?: string | null;
  emailBodyTemplate?: string | null;
}

export interface AddInappRecipientRequest  { roleId: number; }
export interface AddEmailRecipientRequest  { roleId: number; field: string; }

export interface TestUserPreview  { userId: number; fullName: string; email: string; }
export interface TestEmailPreview { email: string; roleName: string; }

export interface TestDispatchResult {
  inappRecipients: TestUserPreview[];
  emailTo:         TestEmailPreview[];
  emailCc:         TestEmailPreview[];
  emailBcc:        TestEmailPreview[];
  resolvedTitle:   string;
  resolvedBody:    string;
  resolvedSubject: string | null;
  resolvedEmailBody: string | null;
}

/**
 * Deep-link kinds the backend accepts (NotificationEntityType). Anything else is rejected.
 * Kept in sync by hand with the enum in rh-service.
 */
export const ENTITY_TYPES = [
  'CANDIDATE', 'EMPLOYEE_PROFILE', 'OFFBOARDING', 'ONBOARDING',
  'IT_PROVISIONING', 'REQUEST', 'RECRUITMENT_DEMAND', 'CONTRACT',
] as const;

export const TEMPLATE_PLACEHOLDERS = [
  '{candidateName}', '{firstName}', '{lastName}',
  '{ms365Email}', '{entity}', '{date}',
];
