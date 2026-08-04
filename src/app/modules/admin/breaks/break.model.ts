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
  /**
   * Pointage status this break switches employees into (status_definitions.status in
   * DAF360_LOG). null = the break drives no presence transition. Labels are free text,
   * so this explicit mapping is the only way to tell a coffee break from lunch.
   */
  statusCode?:     string | null;
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
  /** Pointage status to switch into during this window; omit for no transition. */
  statusCode?:     string;
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
