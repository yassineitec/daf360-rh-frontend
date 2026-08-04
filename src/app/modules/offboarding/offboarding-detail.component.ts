import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { catchError, of } from 'rxjs';

import {
  AccordionState, BreadcrumbItem, ButtonComponent, CardComponent, CheckboxComponent,
  FormFieldComponent, MultiDatePickerComponent, PageComponent, PageHeaderComponent,
  PageHeaderBadge, ProgressBarComponent, SelectComponent, SelectOption,
  StatusBadgeComponent, StepperComponent, StepperConfig, StepperStep,
} from '@khalilrebhiitec/daf360';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { OffboardingService } from './offboarding.service';
import {
  ASSET_TYPES, AssetType, DEPARTURE_REASONS, DepartureReason, ExitInterview,
  OffboardingAssetReturn, OffboardingChecklistItem, OffboardingTask,
  OffboardingWorkflowInstance, computeProgress, findNextDueTask, isTerminal,
} from './models/offboarding.model';
import {
  STAGES, StageCode, StageView, activeStageIndex, dayMonth, daysUntil, longDate,
  outstandingBlockers, resolveStageStates, stageStatusKey, statusVariant, tasksOfStage,
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
    ModalComponent, TranslatePipe,
    StageDeclarationComponent, StageValidationComponent, StageHandoverComponent,
    StageItAssetsComponent, StageHrDocsComponent, StagePayrollComponent, StageClosureComponent,
    OffboardingAuditDrawerComponent,
  ],
  templateUrl: './offboarding-detail.component.html',
  // Vertical stage tracker for the sticky sidebar. Same rules as the onboarding
  // per-case page (onboarding-form.component.scss) so the two trackers are identical;
  // inlined here because this page has no stylesheet of its own.
  styles: [`
    .tracker-step {
      display: flex;
      gap: 12px;
      padding-bottom: 20px;
      position: relative;
      align-items: flex-start;
    }
    .tracker-step.tracker-step-last { padding-bottom: 0; }

    .tracker-line {
      position: absolute;
      left: 13px;
      top: 28px;
      width: 2px;
      height: calc(100% - 8px);
      z-index: 0;
    }
    .tracker-line.tracker-line-done    { background: var(--color-tertiary); }
    .tracker-line.tracker-line-pending { background: var(--color-outline-variant); }

    .tracker-dot {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      z-index: 1;
    }
    .tracker-dot.tracker-dot-done   { background: var(--color-tertiary); color: #ffffff; }
    .tracker-dot.tracker-dot-active { border: 4px solid #79d7be; background: #b9e9df; }
    .tracker-dot.tracker-dot-pending {
      background: var(--color-surface-container-high);
      border: 1px solid var(--color-outline-variant);
      color: var(--color-outline);
    }

    .tracker-dot-inner {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--color-tertiary);
    }
  `],
})
export class OffboardingDetailComponent implements OnInit {
  private route     = inject(ActivatedRoute);
  private svc       = inject(OffboardingService);
  private translate = inject(TranslateService);
  private userStore = inject(UserStore);
  private notify    = inject(NotificationService);

  workflowId = 0;

  /** Only RH_MANAGE_OFFBOARDING holders may run mutating actions. */
  readonly canManage = computed(() => this.userStore.hasPermission('RH_MANAGE_OFFBOARDING'));
  /** Stage-level edit gate: manageable *and* the file is still open. */
  readonly canEdit   = computed(() => this.canManage() && !this.isTerminal());

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

  /**
   * The same seven stages as a VERTICAL tracker for the sticky sidebar, matching the
   * onboarding per-case layout. Derived from the one stage resolver as the horizontal
   * rail, so the two can never disagree about which stage is live.
   */
  readonly trackerSteps = computed(() => {
    this.translate.currentLang();
    const states = this.stageStates();
    const activeIdx = this.railIndex();
    return STAGES.map((s, i) => {
      const state = states[s.code];
      return {
        code:  s.code,
        icon:  s.icon,
        label: this.translate.instant('OFFBOARDING.STAGE.' + s.railKey + '_RAIL'),
        done:    state === 'done',
        active:  state !== 'done' && i === activeIdx,
        // Anything neither finished nor current is still ahead — including locked stages,
        // which read as pending rather than as a separate visual state.
        pending: state !== 'done' && i !== activeIdx,
        last:    i === STAGES.length - 1,
      };
    });
  });

  /** Exposed for the sidebar's date fields — the helper is a module function. */
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
   */
  private seedOpenStages(): void {
    if (this.stageSeeded) return;
    this.stageSeeded = true;
    const states = this.stageStates();
    const target = STAGES.findIndex(s => states[s.code] === 'blocked');
    const active = STAGES.findIndex(s => states[s.code] === 'active');
    const index = target >= 0 ? target : (active >= 0 ? active : 0);
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
  readonly canGoNext = computed(() => this.currentStageIndex() < STAGES.length - 1);

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
   * Jump to a stage by code — used by the rail, the sidebar tracker and the cross-links
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

  /** Tasks of one stage — the payroll card needs FINAL_SETTLEMENT by code.
   *  A computed, not a template method: a fresh array on every check would make
   *  the child's input look changed on every cycle. */
  readonly payrollTasks = computed(() => this.stageTasks('PAYROLL'));

  private stageTasks(code: StageCode): OffboardingTask[] {
    const stage = STAGES.find(s => s.code === code);
    return stage ? tasksOfStage(stage, this.tasks()) : [];
  }

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

  // ── Exit interview ─────────────────────────────────────────────────────────
  /** PENDING V46 — the design's action is *schedule*; until the API can express a
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
        }
      });
  }

  // ── PENDING V46 — no endpoint yet; the controls that call these are disabled ──
  onToggleAccess(_payload: { item: OffboardingChecklistItem; done: boolean }): void { /* PENDING V46 */ }
  onGenerateDischarge(): void { /* PENDING V46 */ }
  onDownloadKit(): void { /* PENDING V46 */ }
  onViewHandoverMinutes(): void {
    const url = this.wf()?.handoverMinutesUrl;
    if (url) window.open(url, '_blank', 'noopener');
  }
  onDownloadAudit(): void { /* PENDING V46 */ }

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
