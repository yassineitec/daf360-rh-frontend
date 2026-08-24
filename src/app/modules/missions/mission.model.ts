/**
 * The mission contract, mirroring rh-service's `dto/mission` package. Shared by both
 * RH screens (missions + billeterie); the finance remote and the shell keep their own
 * narrower copies of what they actually read.
 */

export type MissionStatus =
  | 'PENDING_HR'
  | 'REJECTED_HR'
  | 'PENDING_FINANCE'
  | 'APPROVED'
  | 'REJECTED_FINANCE'
  | 'CANCELLED';

export type MissionScope = 'NATIONAL' | 'INTERNATIONAL';

export type MissionTransportMode = 'AVION' | 'TRAIN' | 'BUS' | 'VOITURE' | 'BATEAU' | 'AUTRE';

export type MissionPaymentMethod = 'ESPECES' | 'VIREMENT' | 'CARTE' | 'AUTRE';

export type MissionChangeRequestType = 'PERIOD_CHANGE' | 'CANCELLATION';

export type MissionChangeRequestStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

/** The transport modes, in the order the select offers them. */
export const TRANSPORT_MODES: MissionTransportMode[] =
  ['AVION', 'TRAIN', 'BUS', 'VOITURE', 'BATEAU', 'AUTRE'];

export const PAYMENT_METHODS: MissionPaymentMethod[] =
  ['ESPECES', 'VIREMENT', 'CARTE', 'AUTRE'];

export interface MissionEligibleEmployee {
  id: number;
  fullName: string;
  email: string | null;
  roleName: string | null;
  paysId: number | null;
}

export interface MissionExpense {
  currency: string | null;

  allowanceDailyRate: number | null;
  missionAllowance: number | null;

  lodgingCost: number | null;
  hotelName: string | null;
  nights: number | null;
  reservationNumber: string | null;

  transportMode: MissionTransportMode | null;
  transportCarrier: string | null;
  ticketReference: string | null;
  ticketCost: number | null;
  /** ISO datetimes — the only hours in the whole process. */
  outboundAt: string | null;
  returnAt: string | null;

  visaFees: number | null;
  insuranceFees: number | null;
  otherFees: number | null;
  otherFeesLabel: string | null;

  advanceAmount: number | null;
  paymentMethod: MissionPaymentMethod | null;

  cashPickupDate: string | null;
  documentPickupDate: string | null;

  hrNotes: string | null;

  /** Read-only — the server recomputes it from the lines on every write. */
  totalEstimatedCost: number | null;
  preparedBy: number | null;
  preparedAt: string | null;
}

export interface MissionChangeRequest {
  id: number;
  missionId: number;
  missionTitle: string | null;
  employeeName: string | null;
  requestedBy: number;
  requestedByName: string | null;
  requestType: MissionChangeRequestType;
  requestedStartDate: string | null;
  requestedEndDate: string | null;
  reason: string;
  status: MissionChangeRequestStatus;
  resolvedBy: number | null;
  resolvedByName: string | null;
  resolvedAt: string | null;
  resolutionNotes: string | null;
  createdAt: string;
}

export interface MissionHistoryEntry {
  id: number;
  fromStatus: string | null;
  toStatus: string;
  actorUserId: number | null;
  actorName: string | null;
  notes: string | null;
  createdAt: string;
}

export interface Mission {
  id: number;
  paysId: number | null;

  employeeUserId: number;
  employeeName: string | null;
  employeeRoleName: string | null;

  createdBy: number;
  createdByName: string | null;

  responsableUserId: number | null;
  responsableDisplayName: string | null;

  title: string;
  details: string | null;
  startDate: string;
  endDate: string;
  durationDays: number;

  scope: MissionScope;
  destinationPaysId: number | null;
  countryLabel: string | null;
  city: string;
  address: string | null;

  status: MissionStatus;

  hrValidatedBy: number | null;
  hrValidatedByName: string | null;
  hrValidatedAt: string | null;
  hrNotes: string | null;

  financeDecidedBy: number | null;
  financeDecidedByName: string | null;
  financeDecidedAt: string | null;
  financeNotes: string | null;

  cancelledAt: string | null;
  cancellationReason: string | null;

  createdAt: string;
  updatedAt: string | null;

  expenses: MissionExpense | null;
  pendingChangeRequest: MissionChangeRequest | null;
  history: MissionHistoryEntry[] | null;
}

/**
 * The create/adjust payload. Same shape for both, because RH's adjustment is the manager's
 * form re-submitted — see `MissionController#adjust`.
 */
export interface MissionPayload {
  employeeUserId: number;
  responsableUserId: number | null;
  responsableName: string | null;
  title: string;
  details: string | null;
  startDate: string;
  endDate: string;
  scope: MissionScope;
  destinationPaysId: number | null;
  countryLabel: string | null;
  city: string;
  address: string | null;
}

/** Everything on the expense sheet that RH may actually write. */
export type MissionExpensePayload =
  Omit<MissionExpense, 'totalEstimatedCost' | 'preparedBy' | 'preparedAt'>;
