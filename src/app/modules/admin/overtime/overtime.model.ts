export type TypeCalculHS = 'WEEKEND_ONLY' | 'AFTER_WORK_HOURS' | 'MIXTE';

export interface ParametrageHSDto {
  idParametrage:      number;
  paysId:             number;
  paysIsoCode:        string;
  typeCalculHs:       TypeCalculHS;
  heureDebutTravail:  string | null;  // "HH:mm:ss"
  heureFinTravail:    string | null;
  jourDebutSemaine:   string | null;  // MONDAY
  jourFinSemaine:     string | null;  // FRIDAY
  actif:              boolean;
  dateCreation:       string;
  dateModification:   string | null;
}

export interface CreateParametrageHSRequest {
  paysId:             number;
  typeCalculHs:       TypeCalculHS;
  heureDebutTravail?: string;
  heureFinTravail?:   string;
  jourDebutSemaine?:  string;
  jourFinSemaine?:    string;
}

export interface OvertimeCalculationRequest {
  paysId:       number;
  workDate:     string;  // ISO date
  workStartTime?: string;  // "HH:mm"
  workEndTime?:   string;
  grossHours:   number;
}

export interface OvertimeCalculationResult {
  overtimeHours: number;
  normalHours:   number;
  ruleApplied:   string;
  explanation:   string;
  isWeekendDay:  boolean;
  paysIsoCode:   string;
}

export const TYPE_CALCUL_OPTIONS: { value: TypeCalculHS; label: string; desc: string }[] = [
  { value: 'WEEKEND_ONLY',      label: 'Week-end uniquement',        desc: 'HS si le jour travaillé est un jour de repos (pays_weekends)' },
  { value: 'AFTER_WORK_HOURS',  label: 'Hors horaires normaux',      desc: 'HS si avant heure début ou après heure fin de travail' },
  { value: 'MIXTE',             label: 'Mixte (Week-end + Horaires)', desc: 'HS si week-end OU hors horaires normaux les jours ouvrés' },
];

export const DAYS_OPTIONS = [
  { value: 'MONDAY',    label: 'Lundi' },
  { value: 'TUESDAY',   label: 'Mardi' },
  { value: 'WEDNESDAY', label: 'Mercredi' },
  { value: 'THURSDAY',  label: 'Jeudi' },
  { value: 'FRIDAY',    label: 'Vendredi' },
  { value: 'SATURDAY',  label: 'Samedi' },
  { value: 'SUNDAY',    label: 'Dimanche' },
];
