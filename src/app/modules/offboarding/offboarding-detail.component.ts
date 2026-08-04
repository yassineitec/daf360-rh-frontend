import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { Subject, catchError, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';

import {
  AccordionState, BreadcrumbItem, ButtonComponent, CardComponent, CheckboxComponent,
  FormFieldComponent, MultiDatePickerComponent, PageComponent, PageHeaderComponent,
  PageHeaderBadge, ProgressBarComponent, SelectComponent, SelectOption,
  StatusBadgeComponent, StepperComponent, StepperConfig, StepperStep, ToggleComponent,
} from '@khalilrebhiitec/daf360';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { OffboardingService } from './offboarding.service';
import {
  ASSET_TYPES, AssetType, ChecklistGroup, DEPARTURE_REASONS, DepartureReason, ExitInterview,
  OffboardingAssetReturn, OffboardingAuditEntry, OffboardingChecklistItem, OffboardingSettlement, OffboardingTask,
  OffboardingWorkflowInstance, SettlementLine, computeProgress, findNextDueTask, isTerminal,
} from './models/offboarding.model';
import { ProfileService } from '../profiles/profile.service';
import { EmployeeListItem } from '../profiles/models/profile.model';
import {
  STAGES, StageCode, StageView, activeStageIndex, dayMonth, daysUntil, longDate,
  outstandingBlockers, resolveStageStates, stageDef, stageStatusKey, statusVariant,
  tasksOfStage,
} from './offboarding-display';
import { ModalComponent } from '../../shared/modal.component';
// Aliased: this component already exposes an 'employeeAvatar' signal to the template.
import { employeeAvatar as resolveEmployeeAvatar } from '../../shared/utils/avatar.utils';
import { isoToDate, dateToIso } from '../../shared/date-picker.utils';
import { UserStore } from '../../core/user.store';
import { NotificationService } from '../../core/notification.service';

import { StageDeclarationComponent } from './stages/stage-declaration.component';
import { StageValidationComponent } from './stages/stage-validation.component';
import { StageHandoverComponent } from './stages/stage-handover.component';
import { StageItAssetsComponent } from './stages/stage-it-assets.component';
import { StageHrDocsComponent } from './stages/stage-hr-docs.component';
import { StagePayrollComponent } from './stages/stage-payroll.component';
import { StageClosureComponent } from './stages/stage-closure.component';
import { StageReservedComponent } from './stages/stage-reserved.component';
import { OffboardingAuditDrawerComponent } from './audit-drawer.component';

/**
 * `/rh/offboarding/:id` — the canonical record page (UI-PLAYBOOK §1, §10f) laid out
 * from `design/offboarding-detail.html`: header + progress, the 7-stage rail, then
 * one accordion card per stage.
 *
 * What this replaced: a flat `daf-data-table` of the 9 tasks plus two loose
 * sections, a hand-rolled breadcrumb, an `app-spinner` and ~65 lines of raw-hex
 * SCSS. The workflow is not a table — it is seven stages with states, which is
 * what the rail and the cards now show.
 *
 * The page stays the **single writer**: every stage component is stateless, takes
 * its data in and emits intent out, and every mutation goes through a modal here.
 */
@Component({
  selector: 'rh-offboarding-detail',
  standalone: true,
  imports: [
    PageComponent, PageHeaderComponent, CardComponent, ButtonComponent,
    StepperComponent, ProgressBarComponent, StatusBadgeComponent,
    FormFieldComponent, SelectComponent, CheckboxComponent, MultiDatePickerComponent,
    ToggleComponent, ModalComponent, TranslatePipe,
    StageDeclarationComponent, StageValidationComponent, StageHandoverComponent,
    StageItAssetsComponent, StageHrDocsComponent, StagePayrollComponent, StageClosureComponent,
    StageReservedComponent,
    OffboardingAuditDrawerComponent,
  ],
  templateUrl: './offboarding-detail.component.html',
  // No `styles` any more: the ~45 lines here drew the vertical stage tracker, which
  // duplicated the horizontal daf-stepper from the same resolver. Deleting it also
  // removed this page's last two raw hex values (#79d7be / #b9e9df).
})
export class OffboardingDetailComponent implements OnInit {
  private route     = inject(ActivatedRoute);
  private svc       = inject(OffboardingService);
  private translate = inject(TranslateService);
  private userStore = inject(UserStore);
  private notify    = inject(NotificationService);
  private profileSvc = inject(ProfileService);

  workflowId = 0;

  /** Only RH_MANAGE_OFFBOARDING holders may run the file-level actions (cancel/validate). */
  readonly canManage = computed(() => this.userStore.hasPermission('RH_MANAGE_OFFBOARDING'));

  // ── Per-stage access ───────────────────────────────────────────────────────
  // Two distinct questions, and conflating them was the old file-wide `canEdit`
  // (removed — every stage now resolves its own):
  //   canViewStage — may I read this stage's body?  (owning department, or RH)
  //   canActOnStage — may I change anything in it?  (the above, and the file still open)
  // The RAIL is never gated: everyone who can open the file sees all seven stages and
  // their states, so an IT officer can tell the passation is done without being able to
  // read it. "RH sees everything" is not special-cased — V58 grants DRH/Admin every
  // stage permission, so it falls out of the grants.

  private readonly heldPermissions = computed(() => new Set(this.userStore.permissions()));

  /**
   * Is the signed-in user the handover manager named on THIS file?
   *
   * A per-file fact, not a permission — which is why stage 2 cannot be resolved from
   * `STAGE_PERMISSIONS` alone. Compares portal user ids: the file carries
   * `handoverManagerUserId` precisely because the client only knows its own *user* id and
   * cannot match a profile id.
   */
  readonly isHandoverManager = computed(() => {
    const managerUserId = this.wf()?.handoverManagerUserId;
    const me = this.userStore.currentUser()?.userId;
    return !!managerUserId && !!me && managerUserId === me;
  });

  canViewStage(code: StageCode): boolean {
    const held = this.heldPermissions();
    if (stageDef(code).permissions.some(p => held.has(p))) return true;
    // Stage 2's left panel belongs to the named manager, so they must be able to open the
    // stage even without an RH permission. The single per-file exception to the map.
    return code === 'VALIDATION' && this.isHandoverManager();
  }

  canActOnStage(code: StageCode): boolean {
    return this.canViewStage(code) && !this.isTerminal();
  }

  /** The manager panel: the named manager, or RH standing in for them. */
  readonly canValidateAsManager = computed(() =>
    !this.isTerminal()
    && (this.isHandoverManager() || this.canManage())
    && !!this.wf()?.lastWorkingDay,
  );

  /** RH's panel — ordered after the manager, mirroring the API's own refusal. */
  readonly canValidateAsHr = computed(() =>
    !this.isTerminal()
    && (this.heldPermissions().has('RH_VALIDATE_OFFBOARDING') || this.canManage())
    && !!this.wf()?.managerValidatedAt,
  );

  /** Owning department of a stage, for the "réservé à…" placeholder. */
  stageOwnerLabel(code: StageCode): string {
    this.translate.currentLang();
    return this.translate.instant('OFFBOARDING.STAGE_OWNER.' + code);
  }

  // ── State ──────────────────────────────────────────────────────────────────
  /** Whole-page skeleton — first load only (§5), so a refetch never blanks it. */
  firstLoad         = signal(true);
  loading           = signal(true);
  loadFailed        = signal(false);
  wf                = signal<OffboardingWorkflowInstance | null>(null);
  tasks             = signal<OffboardingTask[]>([]);
  interview         = signal<ExitInterview | null>(null);
  assets            = signal<OffboardingAssetReturn[]>([]);
  syncingAssets     = signal(false);

  auditOpen = signal(false);

  // ── Modal state ────────────────────────────────────────────────────────────
  showCompleteModal     = signal(false);
  showSkipModal         = signal(false);
  showValidateModal     = signal(false);
  showCancelModal       = signal(false);
  showConfirmAssetModal = signal(false);
  showInterviewModal    = signal(false);
  showAssetModal        = signal(false);

  activeTask  = signal<OffboardingTask | null>(null);
  activeAsset = signal<OffboardingAssetReturn | null>(null);

  // ── Form fields ────────────────────────────────────────────────────────────
  taskComment    = '';
  skipReason     = '';
  cancelReason   = '';
  assetCondition = '';
  ivDate         = '';
  ivFeedback     = '';
  ivReasons:     DepartureReason[] = [];
  assetDesc      = '';
  assetType:     AssetType = 'IT';
  assetExpectedDate = '';

  // ── Loading flags ──────────────────────────────────────────────────────────
  actioning       = signal(false);
  validating      = signal(false);
  cancelling      = signal(false);
  savingInterview = signal(false);
  interviewError  = signal<string | null>(null);
  savingAsset     = signal(false);
  assetError      = signal<string | null>(null);
  confirmingAsset = signal(false);

  // ── Derived ────────────────────────────────────────────────────────────────
  readonly progressPct = computed(() => computeProgress(this.tasks()));
  readonly doneTasks   = computed(() =>
    this.tasks().filter(t => t.status === 'DONE' || t.status === 'SKIPPED').length);

  readonly isTerminal = computed(() => {
    const w = this.wf();
    return !!w && isTerminal(w.status);
  });

  readonly blockers = computed(() => outstandingBlockers(this.tasks()));
  readonly canValidate = computed(() => this.tasks().length > 0 && this.blockers().length === 0);

  readonly employeeName = computed(() => {
    const w = this.wf();
    return w?.employeeFullName
      ?? this.translate.instant('OFFBOARDING.LIST.PROFILE_PREFIX', { id: w?.employeeProfileId });
  });

  /** "Départ : 15 octobre 2023 (J-5)" — the design's sub-line. */
  readonly headerSubtitle = computed(() => {
    this.translate.currentLang();
    const w = this.wf();
    if (!w) return '';
    const date = longDate(w.lastWorkingDay ?? w.triggerDate);
    const days = daysUntil(w.lastWorkingDay);
    const suffix = days == null ? ''
      : days > 0 ? ` (${this.translate.instant('OFFBOARDING.DETAIL.DAYS_LEFT', { n: days })})`
      : days === 0 ? ` (${this.translate.instant('OFFBOARDING.DETAIL.DAY_TODAY')})`
      : ` (${this.translate.instant('OFFBOARDING.DETAIL.DAYS_PAST', { n: -days })})`;
    return `${this.translate.instant('OFFBOARDING.DETAIL.DEPARTURE')} : ${date}${suffix}`;
  });

  readonly breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.translate.currentLang();
    return [
      { label: this.translate.instant('OFFBOARDING.LIST.TITLE'), link: '/rh/offboarding' },
      { label: this.employeeName() },
    ];
  });

  readonly headerBadges = computed<PageHeaderBadge[]>(() => {
    this.translate.currentLang();
    const w = this.wf();
    if (!w) return [];
    const badges: PageHeaderBadge[] = [
      { label: this.reasonLabel(w.departureReason), variant: 'danger',  size: 'sm', pill: true },
      { label: this.statusLabel(w.status),          variant: statusVariant(w.status), size: 'sm' },
    ];
    if (w.slaBreachFlag) {
      badges.push({ label: this.translate.instant('OFFBOARDING.BADGE.SLA_BREACHED'), variant: 'danger', size: 'sm' });
    }
    return badges;
  });

  /** The task the design names in its pulsing header chip. */
  readonly nextStepLabel = computed(() => findNextDueTask(this.tasks())?.taskLabel ?? null);

  // ── Stages ─────────────────────────────────────────────────────────────────
  readonly stageStates = computed<Record<StageCode, AccordionState>>(() => {
    const w = this.wf();
    return w ? resolveStageStates(w, this.tasks()) : ({} as Record<StageCode, AccordionState>);
  });

  /** One view per stage — header chrome only; the bodies bind the raw data. */
  readonly stageViews = computed<Record<StageCode, StageView>>(() => {
    this.translate.currentLang();
    const states = this.stageStates();
    const out = {} as Record<StageCode, StageView>;
    STAGES.forEach((stage, i) => {
      const state = states[stage.code] ?? 'pending';
      out[stage.code] = {
        code:     stage.code,
        index:    i + 1,
        icon:     stage.icon,
        title:    this.translate.instant('OFFBOARDING.STAGE.' + stage.railKey + '_TITLE'),
        subtitle: this.stageSubtitle(stage.code, state),
        state,
        statusLabel: this.translate.instant('OFFBOARDING.STAGE_STATUS.' + stageStatusKey(state)),
      };
    });
    return out;
  });

  readonly railSteps = computed<StepperStep[]>(() => {
    this.translate.currentLang();
    const states = this.stageStates();
    return STAGES.map(s => ({
      title:     this.translate.instant('OFFBOARDING.STAGE.' + s.railKey + '_RAIL'),
      icon:      s.icon,
      // `completed` is all-or-nothing (§10g): set on every step, from the resolver,
      // so stage 4 can be in progress while 1–3 are green.
      completed: states[s.code] === 'done',
      disabled:  states[s.code] === 'locked',
    }));
  });

  readonly railIndex = computed(() => activeStageIndex(this.stageStates()));

  // A `trackerSteps` computed used to build the same seven stages again for a VERTICAL
  // sidebar tracker. Removed: it read from `stageStates` exactly like `railSteps`, so it
  // could only ever repeat what the horizontal rail already said, while pushing the progress
  // bar and the next-step chip out of sight below it. Both now sit under the rail itself.

  /** Exposed for the identity card's date fields — the helper is a module function. */
  protected readonly longDate = longDate;

  /** Set when the image 404s, so the initials tile takes over. */
  readonly avatarFailed = signal(false);

  /**
   * Photo → gendered avatar → null (initials). The payload now carries `employeeGender`
   * and `employeePhotoUrl`, so the case page shows the same avatar as the board and the
   * list. Not `getAvatarUrl`, which always returns a URL and would render an employee
   * with no recorded gender as male.
   */
  readonly employeeAvatar = computed(() => {
    const w = this.wf();
    if (!w || this.avatarFailed()) return null;
    return resolveEmployeeAvatar(w.employeeProfileId, w.employeePhotoUrl, w.employeeGender) ?? null;
  });

  readonly employeeInitials = computed(() => {
    const parts = (this.wf()?.employeeFullName ?? '').trim().split(/\s+/);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
  });

  readonly railConfig = computed<StepperConfig>(() => {
    this.translate.currentLang();
    return {
      chrome:           'header-only',
      clickableSteps:   true,
      stepperLabel:     this.translate.instant('OFFBOARDING.DETAIL.RAIL_ARIA'),
      completedLabel:   this.translate.instant('OFFBOARDING.STAGE_STATUS.DONE'),
      currentStepLabel: this.translate.instant('OFFBOARDING.STAGE_STATUS.IN_PROGRESS'),
    };
  });

  /** Reasons for the exit-interview checkbox list. */
  protected readonly DEPARTURE_REASONS = DEPARTURE_REASONS;

  readonly assetTypeOptions = computed<SelectOption[]>(() =>
    ASSET_TYPES.map(t => ({ value: t, label: this.translate.instant('OFFBOARDING.ASSET_TYPE.' + t) })),
  );

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.workflowId = Number(this.route.snapshot.paramMap.get('id'));
    this.loadWorkflow();
    this.loadInterview();
    this.loadAssets();
  }

  private loadWorkflow(): void {
    this.loading.set(true);
    this.svc.getOffboarding(this.workflowId).pipe(catchError(() => of(null))).subscribe(w => {
      this.wf.set(w);
      this.tasks.set(w?.tasks ?? []);
      this.loadFailed.set(!w);
      this.loading.set(false);
      this.firstLoad.set(false);
      if (w) this.seedOpenStages();
    });
  }

  /**
   * Land on the stage that needs attention — the first blocked one, else the active one.
   * Only on first load: never yank a user who has already navigated somewhere else.
   *
   * Restricted to stages the user can read, so an IT officer opening a file whose live
   * stage is Passation lands on IT & Matériel instead of on a "réservé au manager"
   * placeholder. Falls back to the workflow's real position when they can read none of
   * it — the rail still tells them where the file stands.
   */
  private seedOpenStages(): void {
    if (this.stageSeeded) return;
    this.stageSeeded = true;
    const states = this.stageStates();
    const pick = (predicate: (code: StageCode) => boolean) =>
      STAGES.findIndex(s => predicate(s.code) && this.canViewStage(s.code));

    const blocked = pick(c => states[c] === 'blocked');
    const active  = pick(c => states[c] === 'active');
    const anyMine = pick(c => states[c] !== 'locked');
    const fallback = STAGES.findIndex(s => states[s.code] === 'active');

    const index = [blocked, active, anyMine, fallback].find(i => i >= 0) ?? 0;
    this.currentStageIndex.set(index);
  }
  private stageSeeded = false;

  private loadInterview(): void {
    this.svc.getExitInterview(this.workflowId)
      .pipe(catchError(() => of(null)))
      .subscribe(iv => this.interview.set(iv));
  }

  private loadAssets(): void {
    this.svc.getAssets(this.workflowId).pipe(catchError(() => of([]))).subscribe(list =>
      this.assets.set(list));
  }

  // ── Wizard navigation ──────────────────────────────────────────────────────
  // The page shows exactly ONE stage; Précédent / Suivant, the rail and the sidebar
  // tracker all move between them. It used to be seven accordions with several open at
  // once, which buried the stage that actually needed work.

  /** Index into STAGES of the stage on screen. */
  readonly currentStageIndex = signal(0);
  /** Exposed for the action bar's "Étape x sur y" counter. */
  protected readonly totalStages = STAGES.length;

  readonly currentStage = computed(() => STAGES[this.currentStageIndex()]?.code ?? STAGES[0].code);

  readonly canGoPrev = computed(() => this.currentStageIndex() > 0);

  /**
   * Also false when the next stage is locked. `goToIndex` already refused to enter a
   * locked stage, but the button stayed enabled and swallowed the click — which reads as
   * a broken button, not as a gate. `nextBlockedReason` says what is missing.
   */
  readonly canGoNext = computed(() => {
    const next = STAGES[this.currentStageIndex() + 1];
    return !!next && this.stageStates()[next.code] !== 'locked';
  });

  /** Why Suivant is disabled — shown as the button's tooltip. */
  readonly nextBlockedReason = computed(() => {
    this.translate.currentLang();
    const next = STAGES[this.currentStageIndex() + 1];
    if (!next || this.stageStates()[next.code] !== 'locked') return '';
    // Only DECLARATION gates today (see StageDef.requires), so name it rather than
    // listing prerequisites generically.
    const unmet = next.requires.filter(r => this.stageStates()[r] !== 'done');
    return unmet.length
      ? this.translate.instant('OFFBOARDING.DETAIL.LOCKED_NEEDS', {
          stages: unmet.map(r => this.translate.instant('OFFBOARDING.STAGE.' + stageDef(r).railKey + '_RAIL')).join(', '),
        })
      : this.translate.instant('OFFBOARDING.DETAIL.LOCKED_BLOCKERS');
  });

  /** Label of the next stage, so the button can name where it goes. */
  readonly nextStageTitle = computed(() => {
    this.translate.currentLang();
    const next = STAGES[this.currentStageIndex() + 1];
    return next ? this.translate.instant('OFFBOARDING.STAGE.' + next.railKey + '_RAIL') : '';
  });

  readonly prevStageTitle = computed(() => {
    this.translate.currentLang();
    const prev = STAGES[this.currentStageIndex() - 1];
    return prev ? this.translate.instant('OFFBOARDING.STAGE.' + prev.railKey + '_RAIL') : '';
  });

  /** True when the stage on screen is the one the workflow is waiting on. */
  isCurrent(code: StageCode): boolean { return this.currentStage() === code; }

  goPrev(): void { this.goToIndex(this.currentStageIndex() - 1); }
  goNext(): void { this.goToIndex(this.currentStageIndex() + 1); }

  /**
   * Jump to a stage by code — used by the rail and the cross-links
   * a stage emits (e.g. Payroll → "see the blockers in IT & Matériel").
   */
  openOnly(code: StageCode): void {
    const index = STAGES.findIndex(s => s.code === code);
    if (index >= 0) this.goToIndex(index);
  }

  private goToIndex(index: number): void {
    if (index < 0 || index >= STAGES.length) return;
    // A locked stage has unmet prerequisites; navigating into it would show controls that
    // cannot be used. The rail already renders it disabled — this guards the other paths.
    if (this.stageStates()[STAGES[index].code] === 'locked') return;
    this.currentStageIndex.set(index);
    // No scrolling: the panel swaps in place under a sticky sidebar and a fixed action
    // bar, so a smooth-scroll only animated the page for no reason. Matches the
    // onboarding wizard, which also just swaps its step.
  }

  onRailClick(index: number): void {
    const stage = STAGES[index];
    if (stage && this.stageStates()[stage.code] !== 'locked') this.goToIndex(index);
  }

  view(code: StageCode): StageView {
    return this.stageViews()[code];
  }

  /** The one-liner under each stage title — data, not decoration. */
  private stageSubtitle(code: StageCode, state: AccordionState): string {
    const t = (k: string, p?: Record<string, unknown>) => this.translate.instant(k, p);
    const w = this.wf();
    if (!w) return '';

    switch (code) {
      case 'DECLARATION':
        return t('OFFBOARDING.STAGE.DECLARATION_SUB', { date: dayMonth(w.triggerDate) });
      case 'VALIDATION': {
        const at = w.hrValidatedAt ?? w.validatedAt ?? w.managerValidatedAt;
        return at ? t('OFFBOARDING.STAGE.VALIDATION_SUB', { date: dayMonth(at) })
                  : t('OFFBOARDING.STAGE.VALIDATION_SUB_PENDING');
      }
      case 'HANDOVER':
        return w.handoverManagerName
          ? t('OFFBOARDING.STAGE.HANDOVER_SUB', { name: w.handoverManagerName })
          : t('OFFBOARDING.STAGE.HANDOVER_SUB_PENDING');
      case 'IT_ASSETS': {
        const pending = this.assets().filter(a => !a.actualReturnDate).length;
        return pending
          ? t('OFFBOARDING.STAGE.IT_SUB_PENDING', { assets: pending })
          : t('OFFBOARDING.STAGE.IT_SUB_DONE');
      }
      case 'HR_DOCS':
        return this.interview()
          ? t('OFFBOARDING.STAGE.HR_SUB_DONE')
          : t('OFFBOARDING.STAGE.HR_SUB_PENDING');
      case 'PAYROLL': {
        const s = w.settlement;
        return s
          ? t('OFFBOARDING.STAGE.PAYROLL_SUB', { amount: s.totalNet.toLocaleString('fr-FR') })
          : t('OFFBOARDING.STAGE.PAYROLL_SUB_PENDING');
      }
      case 'CLOSURE':
        return state === 'done'
          ? t('OFFBOARDING.STAGE.CLOSURE_SUB_DONE')
          : t('OFFBOARDING.STAGE.CLOSURE_SUB_PENDING');
    }
  }

  /**
   * Every stage's tasks, resolved in one pass.
   *
   * A computed, not a template method: `tasksOfStage` filters, so a fresh array on every
   * change-detection cycle would make each child's `tasks` input look changed forever.
   * One record keeps the references stable while `tasks()` is unchanged.
   */
  readonly tasksByStage = computed<Record<StageCode, OffboardingTask[]>>(() => {
    const all = this.tasks();
    const out = {} as Record<StageCode, OffboardingTask[]>;
    for (const stage of STAGES) out[stage.code] = tasksOfStage(stage, all);
    return out;
  });

  /** The payroll card needs FINAL_SETTLEMENT by code for its own settlement CTA, and
   *  excludes it from the generic task list itself. */
  readonly payrollTasks = computed(() => this.tasksByStage()['PAYROLL']);

  // ── Task actions ───────────────────────────────────────────────────────────
  openCompleteModal(task: OffboardingTask): void {
    this.activeTask.set(task);
    this.taskComment = '';
    this.showCompleteModal.set(true);
  }

  openSkipModal(task: OffboardingTask): void {
    this.activeTask.set(task);
    this.skipReason = '';
    this.showSkipModal.set(true);
  }

  confirmComplete(): void {
    const task = this.activeTask();
    if (!task) return;
    this.actioning.set(true);
    this.svc.completeTask(task.id, { comments: this.taskComment || undefined })
      .pipe(catchError(() => {
        this.notify.error(this.translate.instant('OFFBOARDING.TOAST.TASK_DONE_ERR'));
        this.actioning.set(false);
        return of(null);
      }))
      .subscribe(updated => {
        this.actioning.set(false);
        this.showCompleteModal.set(false);
        if (updated) {
          this.tasks.update(list => list.map(t => t.id === updated.id ? updated : t));
          this.notify.success(this.translate.instant('OFFBOARDING.TOAST.TASK_DONE'));
          // Completing the last blocking task flips the instance BLOCKED → IN_PROGRESS
          // server-side. The response is the task alone, so without this the header badge
          // keeps reading "Bloqué" on a file that is no longer blocked.
          this.loadWorkflow();
        }
      });
  }

  confirmSkip(): void {
    const task = this.activeTask();
    if (!task || !this.skipReason.trim()) return;
    this.actioning.set(true);
    this.svc.skipTask(task.id, this.skipReason)
      .pipe(catchError(() => {
        this.notify.error(this.translate.instant('OFFBOARDING.TOAST.TASK_SKIP_ERR'));
        this.actioning.set(false);
        return of(null);
      }))
      .subscribe(updated => {
        this.actioning.set(false);
        this.showSkipModal.set(false);
        if (updated) {
          this.tasks.update(list => list.map(t => t.id === updated.id ? updated : t));
          this.notify.success(this.translate.instant('OFFBOARDING.TOAST.TASK_SKIPPED'));
          this.loadWorkflow();
        }
      });
  }

  // ── Validate / Cancel ──────────────────────────────────────────────────────
  confirmValidate(): void {
    this.validating.set(true);
    this.svc.validateOffboarding(this.workflowId)
      .pipe(catchError(() => {
        this.notify.error(this.translate.instant('OFFBOARDING.TOAST.VALIDATE_ERR'));
        this.validating.set(false);
        return of(null);
      }))
      .subscribe(updated => {
        this.validating.set(false);
        this.showValidateModal.set(false);
        if (updated) {
          this.wf.set(updated);
          this.notify.success(this.translate.instant('OFFBOARDING.TOAST.VALIDATED'));
        }
      });
  }

  confirmCancel(): void {
    this.cancelling.set(true);
    this.svc.cancelOffboarding(this.workflowId, this.cancelReason)
      .pipe(catchError(err => {
        // Surface the server's reason. Cancel legitimately fails with 422
        // INVALID_TRANSITION ("only active workflows can be cancelled") — e.g. the file is
        // already CANCELLED or VALIDATED. A generic toast left the user unable to tell that
        // from a network failure.
        this.notify.error(err?.error?.message
          ?? this.translate.instant('OFFBOARDING.TOAST.CANCEL_ERR'));
        this.cancelling.set(false);
        return of(null);
      }))
      .subscribe(updated => {
        this.cancelling.set(false);
        this.showCancelModal.set(false);
        if (updated) {
          this.wf.set(updated);
          this.notify.success(this.translate.instant('OFFBOARDING.TOAST.CANCELLED'));
        }
      });
  }

  // ── Stage 1 — complete the declaration ─────────────────────────────────────
  // A modal rather than inline editing, matching every other mutation on this page
  // (complete, skip, cancel, interview, asset) and keeping the stage component stateless.

  showDeclarationModal = signal(false);
  savingDeclaration    = signal(false);
  declarationError     = signal<string | null>(null);
  /** Reported separately: the upload can 403 on its own (see uploadJustification). */
  justificationError   = signal<string | null>(null);

  declLastWorkingDay   = '';
  declTheoreticalExit  = '';
  declNoticePeriod     = '';
  declNoticeWaiver     = false;
  declNotes            = '';
  declFile: File | null = null;
  declFileName         = signal<string | null>(null);

  openDeclarationModal(): void {
    const w = this.wf();
    this.declLastWorkingDay  = w?.lastWorkingDay ?? '';
    this.declTheoreticalExit = w?.theoreticalExitDate ?? '';
    this.declNoticePeriod    = w?.noticePeriodLabel ?? '';
    this.declNoticeWaiver    = w?.noticeWaiverRequested ?? false;
    this.declNotes           = w?.departureNotes ?? '';
    this.declFile = null;
    this.declFileName.set(w?.justificationDocumentName ?? null);
    this.declarationError.set(null);
    this.justificationError.set(null);
    this.showDeclarationModal.set(true);
  }

  onJustificationPicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.declFile = file;
    if (file) this.declFileName.set(file.name);
    this.justificationError.set(null);
  }

  /**
   * The departure date is what completes the stage and unlocks the rest of the wizard,
   * so it is the one required field. Uploads the letter first when one was picked, then
   * saves — an upload failure does not lose the rest of the form.
   */
  saveDeclaration(): void {
    if (!this.declLastWorkingDay) {
      this.declarationError.set(this.translate.instant('OFFBOARDING.DECLARATION.ERR_DATE_REQUIRED'));
      return;
    }
    if (this.savingDeclaration()) return;
    this.declarationError.set(null);
    this.justificationError.set(null);
    this.savingDeclaration.set(true);

    const profileId = this.wf()?.employeeProfileId;
    const upload$ = this.declFile && profileId
      ? this.svc.uploadJustification(profileId, this.declFile).pipe(
          catchError(() => {
            this.justificationError.set(
              this.translate.instant('OFFBOARDING.DECLARATION.ERR_UPLOAD'));
            return of(null);
          }),
        )
      : of(null);

    upload$.pipe(
      switchMap(uploaded => this.svc.updateDeclaration(this.workflowId, {
        lastWorkingDay:      this.declLastWorkingDay,
        theoreticalExitDate: this.declTheoreticalExit || null,
        noticePeriodLabel:   this.declNoticePeriod || null,
        noticeWaiverRequested: this.declNoticeWaiver,
        departureNotes:      this.declNotes || null,
        ...(uploaded ? {
          justificationDocumentUrl:  uploaded.fileUrl,
          justificationDocumentName: uploaded.fileName,
        } : {}),
      })),
      catchError(err => {
        this.declarationError.set(err?.error?.message
          ?? this.translate.instant('OFFBOARDING.DECLARATION.ERR_SAVE'));
        this.savingDeclaration.set(false);
        return of(null);
      }),
    ).subscribe(updated => {
      this.savingDeclaration.set(false);
      if (!updated) return;
      this.wf.set(updated);
      this.tasks.set(updated.tasks ?? this.tasks());
      this.showDeclarationModal.set(false);
      this.notify.success(this.translate.instant('OFFBOARDING.DECLARATION.SAVED'));
      // Asset due dates are re-derived from the new departure date server-side.
      this.loadAssets();
    });
  }

  // ── Stage 5 — Kit RH ───────────────────────────────────────────────────────

  showScheduleModal = signal(false);
  savingSchedule    = signal(false);
  scheduleError     = signal<string | null>(null);
  schedDate = '';
  schedTime = '10:00';

  generatingKit  = signal<string | null>(null);
  downloadingKit = signal(false);

  openScheduleModal(): void {
    const at = this.interview()?.scheduledAt;
    this.schedDate = at ? at.slice(0, 10) : '';
    this.schedTime = at ? new Date(at).toTimeString().slice(0, 5) : '10:00';
    this.scheduleError.set(null);
    this.showScheduleModal.set(true);
  }

  saveSchedule(): void {
    if (!this.schedDate || this.savingSchedule()) return;
    this.savingSchedule.set(true);
    this.scheduleError.set(null);
    // Local time, then ISO: an interview is at a wall-clock moment for the people attending.
    const at = new Date(`${this.schedDate}T${this.schedTime || '10:00'}:00`);
    this.svc.scheduleExitInterview(this.workflowId, { scheduledAt: at.toISOString() })
      .pipe(catchError(err => {
        this.scheduleError.set(err?.error?.message
          ?? this.translate.instant('OFFBOARDING.KIT.ERR_SCHEDULE'));
        this.savingSchedule.set(false);
        return of(null);
      }))
      .subscribe(iv => {
        this.savingSchedule.set(false);
        if (!iv) return;
        this.interview.set(iv);
        this.showScheduleModal.set(false);
        this.notify.success(this.translate.instant('OFFBOARDING.KIT.SCHEDULED'));
      });
  }

  generateKitDocument(itemCode: string): void {
    if (this.generatingKit()) return;
    this.generatingKit.set(itemCode);
    this.svc.generateKitDocument(this.workflowId, itemCode)
      .pipe(catchError(err => {
        this.notify.error(err?.error?.message
          ?? this.translate.instant('OFFBOARDING.KIT.ERR_GENERATE'));
        this.generatingKit.set(null);
        return of(null);
      }))
      .subscribe(item => {
        this.generatingKit.set(null);
        if (!item) return;
        this.patchChecklist(items => items.map(i => i.id === item.id ? item : i));
        this.notify.success(this.translate.instant('OFFBOARDING.KIT.GENERATED'));
      });
  }

  downloadKitArchive(): void {
    if (this.downloadingKit()) return;
    this.downloadingKit.set(true);
    this.svc.downloadKitArchive(this.workflowId)
      .pipe(catchError(err => {
        this.notify.error(err?.error?.message
          ?? this.translate.instant('OFFBOARDING.KIT.ERR_DOWNLOAD'));
        this.downloadingKit.set(false);
        return of(null);
      }))
      .subscribe(blob => {
        this.downloadingKit.set(false);
        if (blob) this.saveBlob(blob, `kit-rh-${this.workflowId}.zip`);
      });
  }

  /** Anchor-click download. Revoked immediately after: the browser has the bytes by then. */
  private saveBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Stage 6 — Solde de tout compte ─────────────────────────────────────────

  suggestingSettlement = signal(false);
  showLineModal        = signal(false);
  savingLine           = signal(false);
  lineError            = signal<string | null>(null);
  editingLine          = signal<SettlementLine | null>(null);
  lineLabel  = '';
  lineAmount = '';

  suggestSettlement(): void {
    if (this.suggestingSettlement()) return;
    this.suggestingSettlement.set(true);
    this.svc.suggestSettlement(this.workflowId)
      .pipe(catchError(err => {
        this.notify.error(err?.error?.message
          ?? this.translate.instant('OFFBOARDING.SETTLEMENT.ERR_SUGGEST'));
        this.suggestingSettlement.set(false);
        return of(null);
      }))
      .subscribe(settlement => {
        this.suggestingSettlement.set(false);
        if (settlement) this.applySettlement(settlement);
      });
  }

  openLineModal(line: SettlementLine | null): void {
    this.editingLine.set(line);
    this.lineLabel  = line?.label ?? '';
    this.lineAmount = line ? String(line.amount) : '';
    this.lineError.set(null);
    this.showLineModal.set(true);
  }

  saveLine(): void {
    const amount = Number(this.lineAmount.replace(',', '.'));
    if (!this.lineLabel.trim() || Number.isNaN(amount)) {
      this.lineError.set(this.translate.instant('OFFBOARDING.SETTLEMENT.ERR_INVALID'));
      return;
    }
    if (this.savingLine()) return;
    this.savingLine.set(true);
    this.lineError.set(null);

    const existing = this.editingLine();
    const dto = { label: this.lineLabel.trim(), amount };
    const call$ = existing?.id
      ? this.svc.updateSettlementLine(existing.id, dto)
      : this.svc.addSettlementLine(this.workflowId, dto);

    call$.pipe(catchError(err => {
      this.lineError.set(err?.error?.message
        ?? this.translate.instant('OFFBOARDING.SETTLEMENT.ERR_SAVE'));
      this.savingLine.set(false);
      return of(null);
    })).subscribe(settlement => {
      this.savingLine.set(false);
      if (!settlement) return;
      this.applySettlement(settlement);
      this.showLineModal.set(false);
    });
  }

  deleteLine(line: SettlementLine): void {
    if (!line.id) return;
    this.svc.deleteSettlementLine(line.id)
      .pipe(catchError(() => {
        this.notify.error(this.translate.instant('OFFBOARDING.SETTLEMENT.ERR_SAVE'));
        return of(null);
      }))
      .subscribe(settlement => { if (settlement) this.applySettlement(settlement); });
  }

  onExecutionDate(value: Date | Date[] | null): void {
    const iso = dateToIso(value);
    if (!iso) return;
    this.svc.updateSettlement(this.workflowId, { settlementExecutionDate: iso })
      .pipe(catchError(() => {
        this.notify.error(this.translate.instant('OFFBOARDING.SETTLEMENT.ERR_SAVE'));
        return of(null);
      }))
      .subscribe(updated => { if (updated) this.applyInstance(updated); });
  }

  /**
   * The line endpoints return the whole settlement, not the instance — cheaper, and it keeps
   * the totals authoritative. Patch it onto the instance signal so the stage re-renders.
   */
  private applySettlement(settlement: OffboardingSettlement): void {
    this.wf.update(w => w ? { ...w, settlement } : w);
  }

  // ── Stage 7 — Reopen / Archive ─────────────────────────────────────────────

  showReopenModal  = signal(false);
  showArchiveModal = signal(false);
  reopening        = signal(false);
  archiving        = signal(false);
  reopenReason     = '';
  reopenError      = signal<string | null>(null);

  /** Same right as validating: un-closing a file is the same weight as closing it. */
  readonly canReopen = computed(() =>
    this.isTerminal()
    && this.wf()?.status !== 'ARCHIVED'
    && (this.heldPermissions().has('RH_VALIDATE_OFFBOARDING') || this.canManage()),
  );

  readonly canArchive = computed(() =>
    this.wf()?.status === 'VALIDATED'
    && (this.heldPermissions().has('RH_VALIDATE_OFFBOARDING') || this.canManage()),
  );

  openReopenModal(): void {
    this.reopenReason = '';
    this.reopenError.set(null);
    this.showReopenModal.set(true);
  }

  confirmReopen(): void {
    if (!this.reopenReason.trim() || this.reopening()) return;
    this.reopening.set(true);
    this.reopenError.set(null);
    this.svc.reopenOffboarding(this.workflowId, this.reopenReason.trim())
      .pipe(catchError(err => {
        this.reopenError.set(err?.error?.message
          ?? this.translate.instant('OFFBOARDING.CLOSURE.ERR_REOPEN'));
        this.reopening.set(false);
        return of(null);
      }))
      .subscribe(updated => {
        this.reopening.set(false);
        if (!updated) return;
        this.applyInstance(updated);
        this.showReopenModal.set(false);
        this.notify.success(this.translate.instant('OFFBOARDING.CLOSURE.REOPENED'));
      });
  }

  confirmArchive(): void {
    if (this.archiving()) return;
    this.archiving.set(true);
    this.svc.archiveOffboarding(this.workflowId)
      .pipe(catchError(err => {
        this.notify.error(err?.error?.message
          ?? this.translate.instant('OFFBOARDING.CLOSURE.ERR_ARCHIVE'));
        this.archiving.set(false);
        return of(null);
      }))
      .subscribe(updated => {
        this.archiving.set(false);
        this.showArchiveModal.set(false);
        if (!updated) return;
        this.applyInstance(updated);
        this.notify.success(this.translate.instant('OFFBOARDING.CLOSURE.ARCHIVED'));
      });
  }

  auditEntries = signal<OffboardingAuditEntry[]>([]);
  auditLoading = signal(false);

  /**
   * Fetched when the drawer is opened, not on page load: it is a per-file query across six
   * entity types that most visits never look at.
   */
  openAuditDrawer(): void {
    this.auditOpen.set(true);
    if (this.auditEntries().length || this.auditLoading()) return;
    this.auditLoading.set(true);
    this.svc.getAuditTrail(this.workflowId)
      .pipe(catchError(() => {
        this.notify.error(this.translate.instant('OFFBOARDING.CLOSURE.ERR_AUDIT'));
        this.auditLoading.set(false);
        return of([] as OffboardingAuditEntry[]);
      }))
      .subscribe(entries => {
        this.auditEntries.set(entries);
        this.auditLoading.set(false);
      });
  }

  downloadAuditCsv(): void {
    this.svc.downloadAuditCsv(this.workflowId)
      .pipe(catchError(() => {
        this.notify.error(this.translate.instant('OFFBOARDING.CLOSURE.ERR_AUDIT'));
        return of(null);
      }))
      .subscribe(blob => {
        if (blob) this.saveBlob(blob, `offboarding-${this.workflowId}-audit.csv`);
      });
  }

  // ── Stage 4 — Informatique & Matériel ──────────────────────────────────────

  generatingDischarge = signal(false);

  /**
   * The column stores a moment but the picker only offers a day, so the chosen date becomes
   * 23:59 local: the employee works until the end of their last day, and deactivating at
   * 00:00 would cut them off a day early. Replace with a datetime control if the lib grows
   * one — the stored value is already precise enough.
   */
  onDeactivationDate(value: Date | Date[] | null): void {
    const day = dateToIso(value);
    if (!day) return;
    const at = new Date(`${day}T23:59:00`);
    this.svc.updateItSecurity(this.workflowId, { accountDeactivationAt: at.toISOString() })
      .pipe(catchError(() => {
        this.notify.error(this.translate.instant('OFFBOARDING.IT.ERR_DEACTIVATION'));
        return of(null);
      }))
      .subscribe(updated => {
        if (!updated) return;
        this.applyInstance(updated);
        this.notify.success(this.translate.instant('OFFBOARDING.IT.DEACTIVATION_SAVED'));
      });
  }

  generateDischarge(): void {
    if (this.generatingDischarge()) return;
    this.generatingDischarge.set(true);
    this.svc.generateDischarge(this.workflowId)
      .pipe(catchError(err => {
        this.notify.error(err?.error?.message
          ?? this.translate.instant('OFFBOARDING.IT.ERR_DISCHARGE'));
        this.generatingDischarge.set(false);
        return of(null);
      }))
      .subscribe(updated => {
        this.generatingDischarge.set(false);
        if (!updated) return;
        this.applyInstance(updated);
        this.notify.success(this.translate.instant('OFFBOARDING.IT.DISCHARGE_GENERATED'));
      });
  }

  // ── Stage 3 — Passation ────────────────────────────────────────────────────

  showSuccessorModal = signal(false);
  showAddItemModal   = signal(false);
  savingHandover     = signal(false);
  savingItem         = signal(false);
  handoverError      = signal<string | null>(null);

  successorQuery       = '';
  successorResults     = signal<EmployeeListItem[]>([]);
  successorSearching   = signal(false);
  selectedSuccessor    = signal<EmployeeListItem | null>(null);
  newItemLabel         = '';

  private successorSearch$ = new Subject<string>();

  constructor() {
    this.successorSearch$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntilDestroyed(),
      switchMap(q => {
        if (!q.trim()) { this.successorSearching.set(false); return of(null); }
        this.successorSearching.set(true);
        return this.profileSvc.listAllEmployees({ search: q }, 0, 8)
          .pipe(catchError(() => of(null)));
      }),
    ).subscribe(res => {
      this.successorSearching.set(false);
      // Only employees with a profile, and never the person leaving — the API refuses that
      // anyway, so offering it would only produce an error.
      const leaving = this.wf()?.employeeProfileId;
      this.successorResults.set((res?.content ?? [])
        .filter(e => e.profileId !== null && e.profileId !== leaving));
    });
  }

  openSuccessorModal(): void {
    this.successorQuery = '';
    this.successorResults.set([]);
    this.selectedSuccessor.set(null);
    this.handoverError.set(null);
    this.showSuccessorModal.set(true);
  }

  onSuccessorQuery(q: string): void {
    this.successorQuery = q;
    if (!q.trim()) { this.successorResults.set([]); return; }
    this.successorSearch$.next(q);
  }

  pickSuccessor(e: EmployeeListItem): void {
    this.selectedSuccessor.set(e);
    this.successorResults.set([]);
    this.successorQuery = '';
  }

  saveSuccessor(): void {
    const picked = this.selectedSuccessor();
    if (!picked?.profileId || this.savingHandover()) return;
    this.savingHandover.set(true);
    this.handoverError.set(null);
    this.svc.updateHandover(this.workflowId, { handoverManagerProfileId: picked.profileId })
      .pipe(catchError(err => {
        this.handoverError.set(err?.error?.message
          ?? this.translate.instant('OFFBOARDING.HANDOVER.ERR_SUCCESSOR'));
        this.savingHandover.set(false);
        return of(null);
      }))
      .subscribe(updated => {
        this.savingHandover.set(false);
        if (!updated) return;
        this.applyInstance(updated);
        this.showSuccessorModal.set(false);
        this.notify.success(this.translate.instant('OFFBOARDING.HANDOVER.SUCCESSOR_SAVED'));
      });
  }

  /** The PV reuses the employee's own documents, like the declaration's justification. */
  onMinutesPicked(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    const profileId = this.wf()?.employeeProfileId;
    if (!file || !profileId) return;
    this.savingHandover.set(true);
    this.handoverError.set(null);
    this.svc.uploadJustification(profileId, file).pipe(
      switchMap(up => this.svc.updateHandover(this.workflowId, {
        handoverMinutesUrl:  up.fileUrl,
        handoverMinutesName: up.fileName,
      })),
      catchError(err => {
        this.handoverError.set(err?.error?.message
          ?? this.translate.instant('OFFBOARDING.HANDOVER.ERR_PV'));
        this.savingHandover.set(false);
        return of(null);
      }),
    ).subscribe(updated => {
      this.savingHandover.set(false);
      if (!updated) return;
      this.applyInstance(updated);
      this.notify.success(this.translate.instant('OFFBOARDING.HANDOVER.PV_SAVED'));
    });
  }

  openMinutes(): void {
    const url = this.wf()?.handoverMinutesUrl;
    if (url) window.open(url, '_blank', 'noopener');
  }

  // ── Checklists (stages 3, 4, 5) ────────────────────────────────────────────

  openAddItemModal(): void {
    this.newItemLabel = '';
    this.handoverError.set(null);
    this.showAddItemModal.set(true);
  }

  addChecklistItem(group: ChecklistGroup): void {
    if (!this.newItemLabel.trim() || this.savingItem()) return;
    this.savingItem.set(true);
    this.svc.addChecklistItem(this.workflowId, { group, label: this.newItemLabel.trim() })
      .pipe(catchError(err => {
        this.handoverError.set(err?.error?.message
          ?? this.translate.instant('OFFBOARDING.HANDOVER.ERR_ITEM'));
        this.savingItem.set(false);
        return of(null);
      }))
      .subscribe(created => {
        this.savingItem.set(false);
        if (!created) return;
        this.patchChecklist(items => [...items, created]);
        this.showAddItemModal.set(false);
      });
  }

  /**
   * Ticks a line. Patches the one item in place rather than refetching the instance: the
   * checkbox has already flipped optimistically in the DOM, and a refetch would make the
   * whole stage flicker on every tick.
   */
  onToggleChecklistItem(payload: { item: OffboardingChecklistItem; done: boolean }): void {
    const id = payload.item.id;
    if (!id) return;
    this.svc.updateChecklistItem(id, { isDone: payload.done })
      .pipe(catchError(() => {
        this.notify.error(this.translate.instant('OFFBOARDING.HANDOVER.ERR_ITEM'));
        // Put the model back so the checkbox stops disagreeing with the server.
        this.patchChecklist(items => items.map(i => i.id === id ? { ...i, isDone: !payload.done } : i));
        return of(null);
      }))
      .subscribe(updated => {
        if (updated) this.patchChecklist(items => items.map(i => i.id === id ? updated : i));
      });
  }

  removeChecklistItem(item: OffboardingChecklistItem): void {
    if (!item.id) return;
    this.svc.deleteChecklistItem(item.id)
      .pipe(catchError(() => {
        this.notify.error(this.translate.instant('OFFBOARDING.HANDOVER.ERR_ITEM'));
        return of(null);
      }))
      .subscribe(() => this.patchChecklist(items => items.filter(i => i.id !== item.id)));
  }

  /** The checklist lives on the instance signal, so edits go through a shallow copy. */
  private patchChecklist(
    fn: (items: OffboardingChecklistItem[]) => OffboardingChecklistItem[],
  ): void {
    this.wf.update(w => w ? { ...w, checklistItems: fn(w.checklistItems ?? []) } : w);
  }

  // ── Stage 2 — Validation Manager & RH ──────────────────────────────────────

  showManagerModal = signal(false);
  showHrModal      = signal(false);
  savingManager    = signal(false);
  savingHr         = signal(false);
  managerError     = signal<string | null>(null);
  hrError          = signal<string | null>(null);

  mgrComment       = '';
  hrLastWorkingDay = '';
  hrNoticePaid     = false;

  openManagerModal(): void {
    this.mgrComment = this.wf()?.managerComment ?? '';
    this.managerError.set(null);
    this.showManagerModal.set(true);
  }

  openHrModal(): void {
    const w = this.wf();
    // Pre-filled with the declared date: RH confirms it far more often than it changes it,
    // and an empty picker would read as "no date agreed" on a file that has one.
    this.hrLastWorkingDay = w?.lastWorkingDay ?? '';
    this.hrNoticePaid     = w?.noticePaidNotWorked ?? false;
    this.hrError.set(null);
    this.showHrModal.set(true);
  }

  saveManagerValidation(): void {
    if (this.savingManager()) return;
    this.savingManager.set(true);
    this.managerError.set(null);
    this.svc.validateAsManager(this.workflowId, { comment: this.mgrComment || null })
      .pipe(catchError(err => {
        this.managerError.set(err?.error?.message
          ?? this.translate.instant('OFFBOARDING.VALIDATION.ERR_MANAGER'));
        this.savingManager.set(false);
        return of(null);
      }))
      .subscribe(updated => {
        this.savingManager.set(false);
        if (!updated) return;
        this.applyInstance(updated);
        this.showManagerModal.set(false);
        this.notify.success(this.translate.instant('OFFBOARDING.VALIDATION.MANAGER_SAVED'));
      });
  }

  saveHrValidation(): void {
    if (this.savingHr()) return;
    this.savingHr.set(true);
    this.hrError.set(null);
    this.svc.validateAsHr(this.workflowId, {
      lastWorkingDay:      this.hrLastWorkingDay || null,
      noticePaidNotWorked: this.hrNoticePaid,
    }).pipe(catchError(err => {
      this.hrError.set(err?.error?.message
        ?? this.translate.instant('OFFBOARDING.VALIDATION.ERR_HR'));
      this.savingHr.set(false);
      return of(null);
    })).subscribe(updated => {
      this.savingHr.set(false);
      if (!updated) return;
      this.applyInstance(updated);
      this.showHrModal.set(false);
      this.notify.success(this.translate.instant('OFFBOARDING.VALIDATION.HR_SAVED'));
      // RH may have moved the departure date, which re-dates the pending returns.
      this.loadAssets();
    });
  }

  /** Both validation endpoints return the whole instance, tasks included. */
  private applyInstance(updated: OffboardingWorkflowInstance): void {
    this.wf.set(updated);
    if (updated.tasks) this.tasks.set(updated.tasks);
  }

  // ── Exit interview ─────────────────────────────────────────────────────────
  /** V62 — scheduling has its own modal (openScheduleModal); this one records the
   *  scheduled interview this opens the record-it form, prefilled if it exists. */
  openInterviewModal(): void {
    const iv = this.interview();
    this.ivDate     = iv?.conductedDate ?? '';
    this.ivFeedback = iv?.feedbackText ?? '';
    this.ivReasons  = this.parseReasonList(iv?.departureReasons);
    this.interviewError.set(null);
    this.showInterviewModal.set(true);
  }

  setReason(r: DepartureReason, checked: boolean): void {
    this.ivReasons = checked
      ? [...this.ivReasons, r]
      : this.ivReasons.filter(x => x !== r);
  }

  saveInterview(): void {
    if (!this.ivDate) return;
    this.savingInterview.set(true);
    this.interviewError.set(null);
    this.svc.saveExitInterview(this.workflowId, {
      conductedDate:    this.ivDate,
      departureReasons: this.ivReasons,
      feedbackText:     this.ivFeedback || null,
    }).pipe(
      catchError(err => {
        const msg = err?.error?.message ?? this.translate.instant('OFFBOARDING.TOAST.INTERVIEW_ERR');
        this.interviewError.set(msg);
        this.notify.error(msg);
        this.savingInterview.set(false);
        return of(null);
      }),
    ).subscribe(iv => {
      this.savingInterview.set(false);
      if (iv) {
        this.interview.set(iv);
        this.showInterviewModal.set(false);
        this.notify.success(this.translate.instant('OFFBOARDING.TOAST.INTERVIEW_SAVED'));
        // EXIT_INTERVIEW may have been auto-completed server-side.
        this.loadWorkflow();
      }
    });
  }

  // ── Assets ─────────────────────────────────────────────────────────────────
  syncAssetsFromIt(): void {
    this.syncingAssets.set(true);
    this.svc.syncAssetsFromIt(this.workflowId).pipe(
      catchError(() => {
        this.notify.error(this.translate.instant('OFFBOARDING.TOAST.ASSET_SYNC_ERR'));
        this.syncingAssets.set(false);
        return of(null);
      }),
    ).subscribe(list => {
      if (list) {
        this.assets.set(list);
        this.notify.success(this.translate.instant('OFFBOARDING.TOAST.ASSET_SYNCED'));
      }
      this.syncingAssets.set(false);
    });
  }

  openAssetModal(): void {
    this.assetDesc = '';
    this.assetType = 'IT';
    this.assetExpectedDate = '';
    this.assetError.set(null);
    this.showAssetModal.set(true);
  }

  saveAsset(): void {
    if (!this.assetDesc.trim() || !this.assetExpectedDate) return;
    this.savingAsset.set(true);
    this.assetError.set(null);
    this.svc.addAsset(this.workflowId, {
      workflowInstanceId: this.workflowId,
      assetDescription:   this.assetDesc,
      assetType:          this.assetType,
      expectedReturnDate: this.assetExpectedDate,
    }).pipe(
      catchError(err => {
        const msg = err?.error?.message ?? this.translate.instant('OFFBOARDING.TOAST.ASSET_ERR');
        this.assetError.set(msg);
        this.notify.error(msg);
        this.savingAsset.set(false);
        return of(null);
      }),
    ).subscribe(asset => {
      this.savingAsset.set(false);
      if (asset) {
        this.assets.update(list => [...list, asset]);
        this.showAssetModal.set(false);
        this.notify.success(this.translate.instant('OFFBOARDING.TOAST.ASSET_ADDED'));
      }
    });
  }

  openConfirmAsset(a: OffboardingAssetReturn): void {
    this.activeAsset.set(a);
    this.assetCondition = '';
    this.showConfirmAssetModal.set(true);
  }

  confirmAssetReturn(): void {
    const asset = this.activeAsset();
    if (!asset) return;
    this.confirmingAsset.set(true);
    this.svc.confirmAssetReturn(asset.id, this.assetCondition)
      .pipe(catchError(() => {
        this.notify.error(this.translate.instant('OFFBOARDING.TOAST.ASSET_CONFIRM_ERR'));
        this.confirmingAsset.set(false);
        return of(null);
      }))
      .subscribe(updated => {
        this.confirmingAsset.set(false);
        this.showConfirmAssetModal.set(false);
        if (updated) {
          this.assets.update(list => list.map(a => a.id === updated.id ? updated : a));
          this.notify.success(this.translate.instant('OFFBOARDING.TOAST.ASSET_CONFIRMED'));
          // ASSET_RETURN_IT auto-completes server-side once every asset is back, and it is
          // the file's blocking gate — so the rail, the stage states and Clôture all move
          // on the *last* confirmation. Refetch rather than guess which one that was.
          this.loadWorkflow();
        }
      });
  }

  // ── Still without an endpoint; the controls that call these are disabled ──
  // `onToggleAccess` used to live here as an empty stub while stage 4's checkboxes were
  // enabled — so ticking one silently discarded the click. It now goes to
  // `onToggleChecklistItem` like every other group.

  // ── Label helpers ──────────────────────────────────────────────────────────
  statusLabel(s: string): string { return this.translate.instant('OFFBOARDING.STATUS.' + s); }
  reasonLabel(r: string): string { return this.translate.instant('OFFBOARDING.REASON.' + r); }

  private parseReasonList(json: string | null | undefined): DepartureReason[] {
    if (!json) return [];
    try { return JSON.parse(json) as DepartureReason[]; } catch { return []; }
  }

  // Bridge the plain ISO-string date fields to daf-multi-date-picker's Date model.
  asDate(iso: string): Date | null       { return isoToDate(iso); }
  toIso(v: Date | Date[] | null): string { return dateToIso(v); }
}
