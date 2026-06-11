export type AbsenceType = 'PAID_LEAVE' | 'SICK_LEAVE' | 'UNPAID_LEAVE' | 'RTT' |
                          'MATERNITY_LEAVE' | 'PATERNITY_LEAVE' | 'TRAINING' | 'EXCEPTIONAL';

export type LeaveStatus = 'PENDING' | 'MANAGER_APPROVED' | 'HR_APPROVED' | 'REJECTED' | 'CANCELLED';

export interface Leave {
  id: number;
  employeeId: number;
  absenceType: AbsenceType;
  startDate: string;
  endDate: string;
  status: LeaveStatus;
  workingDays: number | null;
  comment: string | null;
  rejectionReason: string | null;
  managerValidatorId: number | null;
  hrValidatorId: number | null;
  createdAt: string;
}

export interface LeaveRequest {
  employeeId: number;
  absenceType: AbsenceType;
  startDate: string;
  endDate: string;
  comment: string | null;
}
