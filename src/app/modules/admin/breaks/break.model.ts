export interface BreakTemplateDto {
  id: number;
  paysId: number;
  regimeId: number;
  labelFr: string;
  labelEn: string;
  deductionType: 'MANDATORY' | 'AUTO' | 'OPTIONAL';
  durationMin: number;
  appliesToDays: string;
  minWorkHoursTrigger?: number;
  sortOrder: number;
  isActive: boolean;
  breakTimeStart?: string | null;  // "HH:mm" format, e.g. "10:00"
  breakTimeEnd?:   string | null;  // "HH:mm" format, e.g. "10:15"
}

export interface BreakLegalRuleDto {
  id: number;
  paysId: number;
  labelFr: string;
  labelEn: string;
  minWorkHours: number;
  maxWorkHours?: number;
  deductionMin: number;
  appliesToDays: string;
  effectiveFrom: string;
  effectiveTo?: string;
  isActive: boolean;
}

export interface CreateBreakTemplateRequest {
  paysId: number;
  regimeId: number;
  labelFr: string;
  labelEn?: string;
  deductionType: string;
  durationMin: number;
  appliesToDays: string;
  minWorkHoursTrigger?: number;
  sortOrder?: number;
  breakTimeStart?: string;
  breakTimeEnd?:   string;
}

export interface CreateBreakLegalRuleRequest {
  paysId: number;
  labelFr: string;
  labelEn?: string;
  minWorkHours: number;
  maxWorkHours?: number;
  deductionMin: number;
  appliesToDays: string;
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface ComputedBreakDeduction {
  source: 'TEMPLATE' | 'LEGAL_RULE';
  label: string;
  durationMin: number;
  deductedHours: number;
  appliesToDays: string;
  breakTimeStart?: string | null;
  breakTimeEnd?:   string | null;
}
