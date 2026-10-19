/**
 * CIVP → CDI conversion requests (rh-service V119, CdiConversionService).
 *
 * Roles are permissions, never names:
 *   RH_REQUEST_CDI_CONVERSION   files the request
 *   RH_VALIDATE_CDI_CONVERSION  technical & salary validator — approve / reject / escalate
 *   RH_ARBITRATE_CDI_CONVERSION decides an escalated request
 *   RH_MANAGE_LIFECYCLE         notified of the decision, carries out the conversion
 */
export const CDI_PERMISSIONS = {
  REQUEST:   'RH_REQUEST_CDI_CONVERSION',
  VALIDATE:  'RH_VALIDATE_CDI_CONVERSION',
  ARBITRATE: 'RH_ARBITRATE_CDI_CONVERSION',
  HR:        'RH_MANAGE_LIFECYCLE',
  VIEW:      'RH_VIEW_CONTRACTS',
} as const;

/** Every code that opens the inbox page — mirrors the backend's read check. */
export const CDI_PAGE_PERMISSIONS = [
  CDI_PERMISSIONS.REQUEST, CDI_PERMISSIONS.VALIDATE, CDI_PERMISSIONS.ARBITRATE,
  CDI_PERMISSIONS.HR, CDI_PERMISSIONS.VIEW,
];

export type CdiConversionStatus = 'SUBMITTED' | 'ESCALATED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type CdiStepAction = 'SUBMIT' | 'APPROVE' | 'REJECT' | 'ESCALATE' | 'CANCEL' | 'CONVERT';
export type CdiDecisionAction = 'APPROVE' | 'REJECT' | 'ESCALATE';

export interface CdiConversionStep {
  id: number;
  action: CdiStepAction;
  actorUserId: number;
  actorName: string | null;
  comment: string | null;
  netSalary: number | null;
  startDate: string | null;
  createdAt: string;
}

export interface CdiConversion {
  id: number;
  contractId: number;
  employeeProfileId: number;
  employeeName: string | null;
  paysId: number;
  status: CdiConversionStatus;
  requestedBy: number;
  requestedByName: string | null;
  requestedAt: string;
  requestedStartDate: string;
  proposedNetSalary: number;
  justification: string;
  validatedNetSalary: number | null;
  validatedStartDate: string | null;
  decidedBy: number | null;
  decidedByName: string | null;
  decidedAt: string | null;
  convertedContractId: number | null;
  convertedAt: string | null;
  contractStartDate: string | null;
  contractEndDate: string | null;
  /** What THE CALLER may do now — permission, status and four-eyes already applied server-side. */
  canDecide: boolean;
  canEscalate: boolean;
  canCancel: boolean;
  canConvert: boolean;
  steps: CdiConversionStep[];
}

export interface SubmitCdiConversionPayload {
  requestedStartDate: string;
  proposedNetSalary: number;
  justification: string;
}

export interface CdiDecisionPayload {
  action: CdiDecisionAction;
  comment: string | null;
  netSalary: number | null;
  startDate: string | null;
}

/** Approved and still to be carried out by RH. */
export function isAwaitingConversion(r: CdiConversion | null | undefined): boolean {
  return !!r && r.status === 'APPROVED' && r.convertedContractId == null;
}

/** Pending, or approved and not converted: a new request cannot be filed on the contract. */
export function isInProgress(r: CdiConversion | null | undefined): boolean {
  return !!r && (r.status === 'SUBMITTED' || r.status === 'ESCALATED' || isAwaitingConversion(r));
}
