import { KanbanCandidate } from '../pipeline/services/pipeline.service';
import { BOARD_STAGES, BoardStageKey, candidatureStage, stepDetail } from '../pipeline/board.model';
import { candidateAvatar as kanbanAvatar, candidateInitials as initialsOf } from '../pipeline/pipeline-display';
import { candidateAvatar } from './candidate-display';
import { ProvisioningListItem } from '../it-provisioning/it-provisioning.model';
import { OnboardingListItem } from '../onboarding/onboarding.model';
import { CdiConversion } from '../cdi-conversions/cdi-conversion.model';
import { OffboardingWorkflowInstance, isTerminal } from '../offboarding/models/offboarding.model';
import { STAGES, resolveStageStates, stageProgressOf } from '../offboarding/offboarding-display';
import { employeeAvatar } from '../../shared/utils/avatar.utils';

/**
 * « Pipeline RH » — the HR LIFECYCLE board, one column per process a person goes through:
 *
 *   Candidat          — a candidature in progress (Entretiens → Validation RH → Offre).
 *   Provisioning IT   — the IT file of a recruit (M365 account, AD profile, hardware, licences).
 *   Onboarding        — the RH file of a recruit (M365 account received, RH file, profile).
 *   Passage en CDI    — a CIVP → CDI request not yet converted.
 *   Offboarding       — a departure in progress.
 *
 * Each column reads its own module's endpoint, so a recruit whose IT and RH files run in
 * parallel shows in both columns. Every card has the same anatomy: the CURRENT step in the
 * pill, where it stands inside that step under the name, and the steps ALREADY VALIDATED in
 * the footer.
 */
export type LifecycleColumnKey = 'CANDIDATE' | 'IT' | 'ONBOARDING' | 'CDI' | 'OFFBOARDING';

export interface LifecycleColumnDef {
  key: LifecycleColumnKey;
  labelKey: string;
  icon: string;
  /** Solid colour: column dot, pill text, avatar fallback, minimap tile. */
  accent: string;
  /** Tinted colour behind the pill and the minimap tile. */
  badgeBg: string;
  /**
   * Any-of gate — the read permission of the endpoint behind the column. A column the user
   * cannot read is not drawn (rather than drawn empty, which would read as « nobody »).
   */
  permissions: string[];
}

/**
 * A column colour from the lib palette (`@theme` in tokens.css): the token itself for the
 * dot, the pill text and the avatar fallback, and the same token at 12 % behind the pill and
 * the minimap tile. Bound through [style.*], so a CSS variable works where a Tailwind class
 * would not (a class assembled at runtime is never generated) — and a rebrand of the lib
 * recolours the board with the rest of the app.
 */
function tone(token: string): { accent: string; badgeBg: string } {
  return {
    accent: `var(--color-${token})`,
    badgeBg: `color-mix(in srgb, var(--color-${token}) 12%, transparent)`,
  };
}

/**
 * One lib token per column, left to right:
 *   Candidat        secondary          — the recruitment colour
 *   Provisioning IT teal               — the brand's deep teal
 *   Onboarding      warning            — in progress, needs action
 *   Passage en CDI  success            — the step towards a permanent contract
 *   Offboarding     on-surface-variant — neutral grey: a departure is not an error
 */
export const LIFECYCLE_COLUMNS: LifecycleColumnDef[] = [
  { key: 'CANDIDATE',   labelKey: 'CANDIDATES.LIFECYCLE.COL_CANDIDATE',   icon: 'person_search',
    ...tone('secondary'),
    permissions: ['VIEW_CANDIDATES', 'EDIT_CANDIDATE', 'CREATE_CANDIDATE', 'HR_ONBOARDING'] },
  { key: 'IT',          labelKey: 'CANDIDATES.LIFECYCLE.COL_IT',          icon: 'devices',
    ...tone('teal'),
    permissions: ['IT_PROVISIONING'] },
  { key: 'ONBOARDING',  labelKey: 'CANDIDATES.LIFECYCLE.COL_ONBOARDING',  icon: 'person_add',
    ...tone('warning'),
    permissions: ['HR_ONBOARDING'] },
  { key: 'CDI',         labelKey: 'CANDIDATES.LIFECYCLE.COL_CDI',         icon: 'workspace_premium',
    ...tone('success'),
    permissions: ['RH_REQUEST_CDI_CONVERSION', 'RH_VALIDATE_CDI_CONVERSION', 'RH_ARBITRATE_CDI_CONVERSION',
                  'RH_MANAGE_LIFECYCLE', 'RH_VIEW_CONTRACTS'] },
  { key: 'OFFBOARDING', labelKey: 'CANDIDATES.LIFECYCLE.COL_OFFBOARDING', icon: 'logout',
    ...tone('on-surface-variant'),
    permissions: ['RH_MANAGE_OFFBOARDING', 'RH_VIEW_CONTRACTS', 'RH_MANAGE_LIFECYCLE'] },
];

/** One line of the card under the identity row. */
export interface LifecycleMeta {
  icon: string;
  text: string;
  /** Rendered italic / faded — a value that is missing rather than known. */
  muted?: boolean;
}

/** A card, whatever process it comes from. */
export interface LifecycleCard {
  /** Unique across the board (`IT-12`): the same person can sit in two columns. */
  key: string;
  name: string;
  subtitle: string | null;
  avatar: string | null;
  initials: string;
  /** The current step. */
  stepLabel: string;
  stepIcon: string;
  /** Where the file stands inside the current step; null when there is nothing finer to say. */
  stepDetail: string | null;
  meta: LifecycleMeta[];
  /** The steps already validated, in process order — the card's footer. */
  doneSteps: string[];
  /** A red flag next to the pill (blocked, SLA breached…). */
  alert: string | null;
  /** Lower-cased text the search box matches against. */
  haystack: string;
  /** Where a click goes. */
  commands: (string | number)[];
  queryParams?: Record<string, string>;
}

export interface LifecycleColumn extends Omit<LifecycleColumnDef, 'labelKey' | 'permissions'> {
  label: string;
  cards: LifecycleCard[];
}

/** i18n lookup handed in by the page, so the mappers stay pure. */
export type Translate = (key: string, params?: Record<string, unknown>) => string;

const haystack = (...parts: (string | null | undefined)[]) =>
  parts.filter(Boolean).join(' ').toLowerCase();

function shortDate(iso: string | null | undefined, locale: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
}

/** The current step plus everything before it — the split every column shares. */
function split<T extends string>(order: readonly T[], done: (s: T) => boolean): { current: T | null; past: T[] } {
  const current = order.find(s => !done(s)) ?? null;
  const past = current ? order.slice(0, order.indexOf(current)) : [...order];
  return { current, past };
}

// ── Candidat ────────────────────────────────────────────────────────────────

/**
 * A candidature: the step is the candidate page's rail rule (`candidatureStage`), the detail
 * its subtitle (`stepDetail`), and the steps before it are validated — a candidature only
 * leaves Entretiens once every PV is in, and only leaves Validation RH once RH validated it.
 */
export function candidateCard(c: KanbanCandidate, t: Translate, locale: string): LifecycleCard | null {
  const stage = candidatureStage(c);
  // An agreed offer is followed in the IT / Onboarding columns of this board, not here.
  if (!stage || stage === 'HIRED') return null;
  const order: BoardStageKey[] = BOARD_STAGES.map(s => s.key);
  const def = BOARD_STAGES.find(s => s.key === stage)!;
  const detail = stepDetail(c);
  const meta: LifecycleMeta[] = [];
  if (stage === 'PRESELECTION' || stage === 'INTERVIEWS') {
    meta.push(c.nextInterviewAt
      ? { icon: 'event', text: t('CANDIDATES.LIFECYCLE.NEXT_INTERVIEW', { date: shortDate(c.nextInterviewAt, locale) }) }
      : { icon: 'event_busy', text: t('CANDIDATES.KANBAN.NO_INTERVIEW'), muted: true });
  }
  meta.push(c.demandTitle
    ? { icon: 'work', text: c.demandTitle }
    : { icon: 'work_outline', text: t('CANDIDATES.FILTERS.SPONTANEOUS'), muted: true });
  return {
    key: 'CANDIDATE-' + c.id,
    name: c.fullName,
    subtitle: c.poste || null,
    // The « Candidats » board's own rule (photo → gendered avatar), so a card looks alike on both.
    avatar: kanbanAvatar(c) || null,
    initials: c.initials || initialsOf(c.fullName),
    stepLabel: t(def.labelKey),
    stepIcon: def.icon,
    stepDetail: detail ? t(detail.key, detail.params) : null,
    meta,
    doneSteps: order.slice(0, order.indexOf(stage)).map(k => t('CANDIDATES.RAIL.' + k)),
    alert: null,
    haystack: haystack(c.fullName, c.poste, c.demandTitle),
    commands: ['/rh/candidates', c.id],
    queryParams: { from: 'recrutement' },
  };
}

// ── Provisioning IT ─────────────────────────────────────────────────────────

const IT_STEPS = ['EMAIL', 'AD', 'HARDWARE', 'LICENSES'] as const;
type ItStep = (typeof IT_STEPS)[number];

const IT_STEP_ICON: Record<ItStep | 'CLOSE', string> = {
  EMAIL: 'alternate_email', AD: 'badge', HARDWARE: 'laptop_mac', LICENSES: 'key', CLOSE: 'task_alt',
};

function licenseCount(p: ProvisioningListItem): number {
  return [p.licenseOffice365, p.licenseAutocad, p.licenseRevit, p.licenseAutodesk, p.licenseKaspersky]
    .filter(Boolean).length + (p.licenseOther ? 1 : 0);
}

/**
 * An IT file still open. The form has no imposed order, so the steps follow the page's own
 * (M365 account → AD profile → hardware → licences); the current one is the first not done,
 * and once all four are, what is left is closing the file.
 */
export function itCard(p: ProvisioningListItem, t: Translate, locale: string): LifecycleCard | null {
  if (p.status === 'COMPLETED') return null;
  const licenses = licenseCount(p);
  const done: Record<ItStep, boolean> = {
    EMAIL: !!p.ms365Email,
    AD: !!p.adProfileType,
    HARDWARE: (p.assetsProvided ?? 0) > 0,
    LICENSES: licenses > 0,
  };
  const { current, past } = split(IT_STEPS, s => done[s]);
  const step = current ?? 'CLOSE';
  const meta: LifecycleMeta[] = [];
  if (p.ms365Email) meta.push({ icon: 'mail', text: p.ms365Email });
  if ((p.assetsProvided ?? 0) > 0 || licenses > 0) {
    meta.push({ icon: 'inventory_2', text: t('CANDIDATES.LIFECYCLE.IT_EQUIPMENT', { assets: p.assetsProvided ?? 0, licenses }) });
  }
  const start = shortDate(p.expectedStartDate, locale);
  meta.push(start
    ? { icon: 'event', text: t('CANDIDATES.LIFECYCLE.START_ON', { date: start }) }
    : { icon: 'event', text: t('CANDIDATES.LIFECYCLE.NO_START_DATE'), muted: true });
  return {
    key: 'IT-' + p.id,
    name: p.candidateFullName,
    subtitle: p.appliedPosition,
    avatar: null,
    initials: initialsOf(p.candidateFullName),
    stepLabel: t('CANDIDATES.LIFECYCLE.IT_STEP.' + step),
    stepIcon: IT_STEP_ICON[step],
    stepDetail: t('CANDIDATES.LIFECYCLE.IT_STATUS.' + p.status),
    meta,
    doneSteps: past.map(s => t('CANDIDATES.LIFECYCLE.IT_STEP.' + s)),
    alert: null,
    haystack: haystack(p.candidateFullName, p.appliedPosition, p.ms365Email),
    commands: ['/rh/it-provisioning', p.id],
  };
}

// ── Onboarding ──────────────────────────────────────────────────────────────

const ONBOARDING_STEPS = ['EMAIL', 'FILE', 'PROFILE'] as const;
type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

const ONBOARDING_STEP_ICON: Record<OnboardingStep, string> = {
  EMAIL: 'alternate_email', FILE: 'edit_document', PROFILE: 'how_to_reg',
};

/**
 * A recruit's RH file: the M365 account arrives from IT, RH fills the file (a draft is the
 * sign it started), then submits it, which creates the employee profile — the step a pending
 * file is always still short of.
 */
export function onboardingCard(o: OnboardingListItem, t: Translate, locale: string): LifecycleCard {
  const emailIn = !!o.ms365Email || o.candidateStatus === 'EMAIL_RECEIVED'
    || o.itProvisioningStatus === 'EMAIL_CREATED' || o.itProvisioningStatus === 'COMPLETED';
  const done: Record<OnboardingStep, boolean> = { EMAIL: emailIn, FILE: emailIn && o.hasDraft, PROFILE: false };
  const { current, past } = split(ONBOARDING_STEPS, s => done[s]);
  const step = current ?? 'PROFILE';
  const savedAt = shortDate(o.draftSavedAt, locale);
  const detail = step === 'EMAIL'
    ? t('CANDIDATES.LIFECYCLE.ONB_DETAIL.WAITING_IT')
    : step === 'FILE'
      ? t('CANDIDATES.LIFECYCLE.ONB_DETAIL.TO_FILL')
      : savedAt ? t('CANDIDATES.LIFECYCLE.ONB_DETAIL.DRAFT_AT', { date: savedAt }) : t('CANDIDATES.LIFECYCLE.ONB_DETAIL.TO_SUBMIT');
  const start = shortDate(o.expectedStartDate, locale);
  const meta: LifecycleMeta[] = [];
  if (o.ms365Email) meta.push({ icon: 'mail', text: o.ms365Email });
  meta.push(start
    ? { icon: 'event', text: t('CANDIDATES.LIFECYCLE.START_ON', { date: start }) }
    : { icon: 'event', text: t('CANDIDATES.LIFECYCLE.NO_START_DATE'), muted: true });
  return {
    key: 'ONBOARDING-' + o.candidateId,
    name: o.candidateFullName,
    subtitle: o.appliedPosition,
    avatar: candidateAvatar(o.gender) ?? null,
    initials: initialsOf(o.candidateFullName),
    stepLabel: t('CANDIDATES.LIFECYCLE.ONB_STEP.' + step),
    stepIcon: ONBOARDING_STEP_ICON[step],
    stepDetail: detail,
    meta,
    doneSteps: past.map(s => t('CANDIDATES.LIFECYCLE.ONB_STEP.' + s)),
    alert: null,
    haystack: haystack(o.candidateFullName, o.appliedPosition, o.ms365Email),
    commands: ['/rh/onboarding', o.candidateId],
  };
}

// ── Passage en CDI ──────────────────────────────────────────────────────────

/**
 * A CIVP → CDI request still open: filed → validated (by the validator, or by the arbiter
 * after an escalation) → converted by RH. Rejected / cancelled ones are closed, converted
 * ones are CDIs: neither is on the board.
 */
export function cdiCard(r: CdiConversion, t: Translate, locale: string): LifecycleCard | null {
  const open = r.status === 'SUBMITTED' || r.status === 'ESCALATED' || (r.status === 'APPROVED' && !r.convertedAt);
  if (!open) return null;
  const escalated = r.status === 'ESCALATED' || (r.steps ?? []).some(s => s.action === 'ESCALATE');
  const step = r.status === 'SUBMITTED' ? 'VALIDATION' : r.status === 'ESCALATED' ? 'ARBITRATION' : 'CONVERSION';
  const past = ['SUBMIT'];
  if (step !== 'VALIDATION' && escalated) past.push('ESCALATED');
  if (step === 'CONVERSION') past.push('APPROVED');
  const icon = step === 'VALIDATION' ? 'fact_check' : step === 'ARBITRATION' ? 'gavel' : 'workspace_premium';
  const startIso = r.validatedStartDate ?? r.requestedStartDate;
  const start = shortDate(startIso, locale);
  const meta: LifecycleMeta[] = [];
  if (start) meta.push({ icon: 'event', text: t('CANDIDATES.LIFECYCLE.CDI_FROM', { date: start }) });
  if (r.contractEndDate) meta.push({ icon: 'hourglass_bottom', text: t('CANDIDATES.LIFECYCLE.CIVP_ENDS', { date: shortDate(r.contractEndDate, locale) }) });
  return {
    key: 'CDI-' + r.id,
    name: r.employeeName || '—',
    subtitle: r.requestedByName ? t('CANDIDATES.LIFECYCLE.CDI_REQUESTED_BY', { name: r.requestedByName }) : null,
    avatar: employeeAvatar(r.employeeProfileId, null, null) ?? null,
    initials: initialsOf(r.employeeName) || '?',
    stepLabel: t('CANDIDATES.LIFECYCLE.CDI_STEP.' + step),
    stepIcon: icon,
    stepDetail: t('CANDIDATES.LIFECYCLE.CDI_DETAIL.' + step),
    meta,
    doneSteps: past.map(s => t('CANDIDATES.LIFECYCLE.CDI_STEP.' + s)),
    alert: null,
    haystack: haystack(r.employeeName, r.requestedByName),
    commands: ['/rh/cdi-conversions', r.id],
  };
}

// ── Offboarding ─────────────────────────────────────────────────────────────

/** A departure in progress — the case page's own stage resolver, so the two never disagree. */
export function offboardingCard(
  wf: OffboardingWorkflowInstance, t: Translate, locale: string, reasonLabel: (code: string) => string,
): LifecycleCard | null {
  if (isTerminal(wf.status)) return null;
  const progress = stageProgressOf(wf);
  const states = resolveStageStates(wf, wf.tasks ?? []);
  const last = shortDate(wf.lastWorkingDay, locale);
  const meta: LifecycleMeta[] = [
    last
      ? { icon: 'event', text: t('CANDIDATES.LIFECYCLE.LAST_DAY', { date: last }) }
      : { icon: 'event', text: t('OFFBOARDING.LIST.NO_LAST_DAY'), muted: true },
  ];
  if (wf.handoverManagerName) meta.push({ icon: 'handshake', text: wf.handoverManagerName });
  return {
    key: 'OFFBOARDING-' + wf.id,
    name: wf.employeeFullName || '—',
    subtitle: reasonLabel(wf.departureReason) || null,
    avatar: employeeAvatar(wf.employeeProfileId, wf.employeePhotoUrl, wf.employeeGender) ?? null,
    initials: initialsOf(wf.employeeFullName) || '?',
    stepLabel: t(progress.titleKey),
    stepIcon: progress.icon,
    stepDetail: t('OFFBOARDING.LIST.STEP_OF', { step: progress.step, total: progress.total }),
    meta,
    doneSteps: STAGES.filter(s => states[s.code] === 'done').map(s => t('OFFBOARDING.STAGE.' + s.railKey + '_TITLE')),
    alert: progress.blocked ? t('OFFBOARDING.STATUS.BLOCKED')
      : wf.slaBreachFlag ? t('OFFBOARDING.BOARD.SLA') : null,
    haystack: haystack(wf.employeeFullName, wf.handoverManagerName),
    commands: ['/rh/offboarding', wf.id],
  };
}
