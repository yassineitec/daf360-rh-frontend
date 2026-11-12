export interface ListType {
  id: number;
  code: string;
  labelFr: string;
  labelEn: string;
  description: string | null;
  isPerPays: boolean;
  isSystem: boolean;
}

export interface ListValue {
  id: number;
  listTypeId: number;
  paysId: number | null;
  valueCode: string;
  labelFr: string;
  labelEn: string;
  sortOrder: number;
  isActive: boolean;
  isSystem: boolean;
  payrollContractCode: string | null;
  /** CONTRACT_TYPE only: lifecycle rules this type follows (CDI, CDD, CIVP, STAGE, FREELANCE, DETACHEMENT). */
  lifecycleNature: string | null;
  /** CONTRACT_DECISION only: what the choice does (CONFIRM_TRIAL, RENEW_TRIAL, BREAK_TRIAL, RENEW_CDD, EXTEND, END_CONTRACT). */
  decisionAction?: string | null;
  /** CONTRACT_TYPE only: true when the type has its own « Décider » rules, else it inherits its nature's. */
  customDecisions?: boolean;
  trialRenewable?: boolean | null;
  trialMaxRenewals?: number | null;
  /** Own choices (ContractDecisionAction codes) — null when inherited. */
  trialDecisions?: string[] | null;
  endDecisions?: string[] | null;
  createdAt: string | null;
  updatedAt: string | null;
}

/**
 * CONTRACT_TYPE only — the type's own « Décider » rules. customDecisions true stores the
 * four fields, false clears them (the type inherits its nature's rules), absent = no change.
 */
export interface ContractTypeDecisionRules {
  customDecisions?: boolean;
  trialRenewable?: boolean;
  trialMaxRenewals?: number;
  trialDecisions?: string[];
  endDecisions?: string[];
}

export interface CreateListValueRequest extends ContractTypeDecisionRules {
  listTypeId: number;
  paysId?: number | null;
  valueCode: string;
  labelFr: string;
  labelEn: string;
  sortOrder?: number;
  lifecycleNature?: string | null;
  decisionAction?: string | null;
}

export interface UpdateListValueRequest extends ContractTypeDecisionRules {
  labelFr?: string;
  labelEn?: string;
  sortOrder?: number;
  isActive?: boolean;
  forceDeactivate?: boolean;
  payrollContractCode?: string | null;
  lifecycleNature?: string | null;
  decisionAction?: string | null;
}
