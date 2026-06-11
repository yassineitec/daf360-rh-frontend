export interface NotificationEventTypeWithRule {
  id: number;
  eventCode: string;
  labelFr: string;
  labelEn: string;
  module: string;
  supportsEmail: boolean;
  isSystem: boolean;
  ruleId: number | null;
  sendInapp: boolean | null;
  sendEmail: boolean | null;
  inappRecipientCount: number;
  emailToCount: number;
}

export interface RoleOption { id: number; frenchName: string; }

export interface RecipientItem {
  id: number;
  roleId: number;
  roleName: string;
  recipientField?: string | null;
}

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

export const TEMPLATE_PLACEHOLDERS = [
  '{candidateName}', '{firstName}', '{lastName}',
  '{ms365Email}', '{entity}', '{date}',
];
