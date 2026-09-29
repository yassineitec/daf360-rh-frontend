import { Component, OnInit, computed, inject, signal, TemplateRef, viewChild } from '@angular/core';
import { Observable } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import {
  ButtonComponent,
  FormFieldComponent, MetricCardComponent, ModalRef, ModalService, PageComponent,
  MultiDatePickerComponent,
  PageHeaderComponent, PaginationComponent, SearchToolbarComponent, SelectComponent,
  SelectOption, ToggleComponent, ToolbarAction,
} from '@khalilrebhiitec/daf360';

import { NotificationService } from '../../core/notification.service';
import { ProfileService } from '../profiles/profile.service';
import { CongeListBase } from './conge-list-base';
import {
  CongeCounts, CongeFilter, CongePage, CongeRow, LeaveCategoryCode, LeaveHeaders,
  LeaveTypeOption, SettleRequest,
} from './models/conge.model';
import { errorMessage, formatDays, localeOf } from './conge-display';
import { CongesTableSectionComponent } from './sections/conges-table-section.component';
import { CongesCardsSectionComponent } from './sections/conges-cards-section.component';
import { CongeDetailComponent } from './sections/conge-detail.component';

/**
 * `/rh/conges/settle` — régularisations: HR filing a congé on someone else's behalf, and the
 * record of those already filed. Canonical page shape (UI-PLAYBOOK §1).
 *
 * WHAT THIS REPLACES
 * -----------------------------------------------------------------------------
 * The timesheet's `demandes-regularisations` page, congés tab. That page also carried
 * autorisation and télétravail tabs; those modules have not moved yet, so this screen is
 * congés only rather than a three-tab shell with two empty tabs.
 *
 * THE FORM IS A MODAL, NOT A PANEL ABOVE THE LIST
 * -----------------------------------------------------------------------------
 * Filing a régularisation is occasional; reading what has already been filed is why the page
 * is usually open. A permanent form pushed the list below the fold and made the common case
 * pay for the rare one, so it moved behind a toolbar button.
 *
 * WHY IT IS NOT THE SELF-SERVICE FORM WITH AN EMPLOYEE PICKER
 * -----------------------------------------------------------------------------
 * It very nearly is, and deliberately so: it reads the SAME `/headers/{id}` payload the
 * employee's own modal reads, so the day caps, the justification rule, the approver roles and
 * the balance gate are identical. What differs is that everything depends on WHICH employee,
 * and none of it can be answered until one is chosen — so the rest of the form stays hidden
 * until then rather than showing empty dropdowns that look broken.
 *
 * IT LANDS EN_ATTENTE, IT DOES NOT SELF-APPROVE
 * -----------------------------------------------------------------------------
 * Filing is not deciding. The régularisation appears in the approver's queue like any other
 * request, which is why the form asks who the approver is. Someone holding SETTLE_LEAVES may
 * then approve it themselves from the inbox — one act, recorded as two, with `created_by` and
 * `decided_by` naming them both.
 */
@Component({
  selector: 'app-conge-settle',
  standalone: true,
  imports: [
    PageComponent, PageHeaderComponent, MetricCardComponent, SearchToolbarComponent,
    PaginationComponent, SelectComponent, FormFieldComponent, ToggleComponent,
    MultiDatePickerComponent, ButtonComponent, CongesTableSectionComponent,
    CongesCardsSectionComponent, CongeDetailComponent, TranslatePipe,
  ],
  template: `
    <daf-page [loading]="firstLoad()" [kpis]="4">

      <!-- No icon on the page header: platform convention.
           The primary action lives in the header's own pageActions slot — the page's one
           creating act belongs beside its title, not among the filters that only narrow what
           is already there. -->
      <daf-page-header
        [title]="'CONGES.SETTLE.TITLE' | translate"
        [subtitle]="'CONGES.SETTLE.SUBTITLE' | translate">
        <ng-container pageActions>
          <daf-button
            [options]="{ variant: 'primary', iconStart: 'post_add',
                         label: ('CONGES.SETTLE.NEW' | translate),
                         disabled: working() }"
            (onClick)="openForm()" />
        </ng-container>
      </daf-page-header>

      <section class="grid grid-cols-4 gap-2 sm:gap-6">
        <daf-metric-card
          [label]="'CONGES.SETTLE.KPI.TOTAL' | translate" [value]="kpi().total"
          [options]="{ icon: 'sync', iconColor: 'text-primary', iconBg: 'bg-primary/10',
                       help: ('CONGES.SETTLE.KPI.TOTAL_HELP' | translate) }" />
        <daf-metric-card
          [label]="'CONGES.KPI.PENDING' | translate" [value]="kpi().pending"
          [options]="{ icon: 'hourglass_top', iconColor: 'text-warning', iconBg: 'bg-warning/10' }" />
        <daf-metric-card
          [label]="'CONGES.KPI.APPROVED' | translate" [value]="kpi().approved"
          [options]="{ icon: 'check_circle', iconColor: 'text-success', iconBg: 'bg-success/10' }" />
        <daf-metric-card
          [label]="'CONGES.KPI.REFUSED' | translate" [value]="kpi().refused"
          [options]="{ icon: 'cancel', iconColor: 'text-danger', iconBg: 'bg-danger/10' }" />
      </section>

      <daf-search-toolbar
        [placeholder]="'CONGES.SEARCH_PLACEHOLDER' | translate"
        [value]="search()"
        [debounce]="300"
        (valueChange)="onSearch($event)"
        [actions]="toolbarActions()"
        (action)="onToolbarAction($event)"
        [filterFields]="filterFields()"
        [filterConfig]="filterConfig()"
        (filterApply)="applyFilters($event)"
        [views]="viewOptions()"
        [view]="viewMode()"
        (viewChange)="setView($event)" />

      @if (error()) {
        <div class="flex items-center gap-2 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          <span class="material-symbols-outlined text-[18px]">error</span>
          {{ error() }}
        </div>
      }

      @if (viewMode() === 'grid') {
        <rh-conges-cards-section
          [items]="rows()" [loading]="loading()" [skeletonCount]="pageSize()"
          [emptyMessage]="emptyMessage()" [showFiledBy]="true"
          (open)="openDetail($event)" />
      } @else {
        <rh-conges-table-section
          [items]="rows()" [loading]="loading()" [skeletonRows]="pageSize()"
          [emptyMessage]="emptyMessage()" [showFiledBy]="true" [busy]="working()"
          [sortKey]="sortKey()" [sortDir]="sortDir()"
          (open)="openDetail($event)" (sortChange)="onSort($event)" />
      }

      @if (totalPages() > 0) {
        <daf-pagination
          [currentPage]="currentPage()" [totalPages]="totalPages()"
          [totalElements]="totalElements()" [pageSize]="pageSize()"
          [pageSizeOptions]="pageSizeOptions"
          [perPageLabel]="'PROFILES.LIST.PER_PAGE' | translate"
          [summaryLabel]="'PROFILES.LIST.RANGE_SUMMARY' | translate"
          (pageChange)="onPageChange($event)" (pageSizeChange)="onPageSizeChange($event)" />
      }

      <!-- Same body as the queue's consult modal. -->
      <ng-template #detailTpl>
        <rh-conge-detail [row]="detailRow()" />
      </ng-template>

      <!-- ── The régularisation form, opened from the page header ──────────── -->
      <ng-template #formTpl>
        <div class="flex flex-col gap-4">

          <daf-select
            [options]="employeeOptions()"
            [selected]="sel(employeeId())"
            [config]="{ label: ('CONGES.SETTLE.EMPLOYEE' | translate), required: true, fullWidth: true,
                        searchable: true,
                        placeholder: ('CONGES.SETTLE.EMPLOYEE_PLACEHOLDER' | translate),
                        error: showErrors() && !employeeId() ? ('CONGES.SETTLE.REQUIRED' | translate) : '' }"
            (selectedChange)="onEmployee($event[0])" />

          @if (!employeeId()) {
            <p class="text-body-sm text-on-surface-variant">
              {{ 'CONGES.SETTLE.PICK_EMPLOYEE_FIRST' | translate }}
            </p>
          }

          @if (employeeId() && headers()) {
            <!-- Balances first: they are what the decision is made against. -->
            <div class="flex flex-wrap gap-3">
              @for (b of balanceCards(); track b.key) {
                <div class="flex flex-1 basis-32 flex-col gap-0.5 rounded-xl bg-surface-container-low px-4 py-2.5">
                  <span class="text-body-sm text-on-surface-variant">{{ b.label }}</span>
                  <span class="text-headline-sm font-semibold tabular-nums">{{ b.value }}</span>
                </div>
              }
            </div>

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <daf-select
                [options]="typeOptions()"
                [selected]="sel(formType())"
                [config]="{ label: ('CONGES.SETTLE.TYPE' | translate), required: true, fullWidth: true,
                            searchable: true,
                            error: showErrors() && !formType() ? ('CONGES.SETTLE.REQUIRED' | translate) : '' }"
                (selectedChange)="onType($event[0])" />

              <daf-select
                [options]="categoryOptions()"
                [selected]="sel(category())"
                [config]="{ label: ('CONGES.SETTLE.CATEGORY' | translate), required: true, fullWidth: true }"
                (selectedChange)="onCategory($event[0])" />

              <!-- ONE picker, not two date inputs.
                   selectionMode follows the category: a multi-day congé picks a range, every
                   other category IS one day and a second field would invite a range the server
                   would collapse anyway. It also renders that employee's own holidays and
                   weekend rules from /headers, so the calendar greys out the days the server
                   will not charge for — the native input could show none of that. -->
              <daf-multi-date-picker
                class="sm:col-span-2"
                [config]="datePickerConfig()"
                [value]="dateValue()"
                (valueChange)="onDateChange($event)" />

              @if (approverOptions().length > 0) {
                <daf-select
                  [options]="approverOptions()"
                  [selected]="sel(responsableId())"
                  [config]="{ label: ('CONGES.SETTLE.APPROVER' | translate), required: true, fullWidth: true,
                              disabled: autoAssigned(),
                              hint: autoAssigned() ? ('CONGES.SETTLE.APPROVER_AUTO' | translate) : '',
                              error: showErrors() && !responsableId() ? ('CONGES.SETTLE.REQUIRED' | translate) : '' }"
                  (selectedChange)="responsableId.set(str($event[0]))" />
              }
            </div>

            <!-- The type names approver roles, but nobody above this employee holds one.
                 Reported rather than papered over: filing against the wrong approver would
                 put the request in a queue its owner cannot act on. -->
            @if (noEligibleApprover()) {
              <p class="rounded-lg bg-warning/10 px-3 py-2 text-body-sm">
                {{ 'CONGES.SETTLE.NO_APPROVER' | translate }}
              </p>
            }

            @if (selectedType(); as t) {
              @if (t.maxDays != null) {
                <p class="text-body-sm text-on-surface-variant">
                  {{ 'CONGES.SETTLE.MAX_DAYS' | translate: { days: t.maxDays } }}
                </p>
              }
            }

            <daf-toggle
              [checked]="justificatif()"
              [options]="{ label: ('CONGES.SETTLE.JUSTIFICATIF' | translate) }"
              (checkedChange)="justificatif.set($event)" />

            @if (justificationMissing()) {
              <p class="rounded-lg bg-warning/10 px-3 py-2 text-body-sm">
                {{ 'CONGES.SETTLE.JUSTIFICATION_REQUIRED' | translate }}
              </p>
            }

            <daf-form-field
              [options]="{ label: ('CONGES.SETTLE.REASON' | translate), type: 'textarea', rows: 3,
                           required: true, fullWidth: true,
                           hint: ('CONGES.SETTLE.REASON_HINT' | translate),
                           error: showErrors() && !reason().trim() ? ('CONGES.SETTLE.REQUIRED' | translate) : '' }"
              [value]="reason()"
              (valueChange)="reason.set(str($event) ?? '')" />
          }
        </div>
      </ng-template>

    </daf-page>
  `,
})
export class CongeSettleComponent extends CongeListBase implements OnInit {
  private readonly profiles = inject(ProfileService);
  private readonly modal = inject(ModalService);
  private readonly notify = inject(NotificationService);

  private readonly formTpl = viewChild.required<TemplateRef<unknown>>('formTpl');
  private readonly detailTpl = viewChild.required<TemplateRef<unknown>>('detailTpl');
  private formRef: ModalRef | null = null;

  /** The row the consult modal is about — see CongeInboxComponent for why it is a signal. */
  readonly detailRow = signal<CongeRow | null>(null);

  // ── Form state ────────────────────────────────────────────────────────────
  readonly employees = signal<{ userId: number; fullName: string }[]>([]);
  readonly employeeId = signal<string | null>(null);
  readonly headers = signal<LeaveHeaders | null>(null);

  /** Named `formType` so it cannot collide with the base class's list `type` filter. */
  readonly formType = signal<string | null>(null);
  readonly category = signal<LeaveCategoryCode | null>('MULTIPLE_DAYS');
  readonly dateDebut = signal<string | null>(null);
  readonly dateFin = signal<string | null>(null);
  readonly responsableId = signal<string | null>(null);
  readonly justificatif = signal(false);
  readonly reason = signal('');
  readonly showErrors = signal(false);

  /** Off by default: the screen opens on what THIS person filed, not on an audit of everyone. */
  readonly mineOnly = signal(true);

  protected fetch(filter: CongeFilter): Observable<CongePage> {
    return this.svc.settled(
      { ...filter, mine: this.mineOnly() }, this.translate.currentLang() ?? 'fr');
  }
  protected fetchCounts(): Observable<CongeCounts> {
    return this.svc.settledCounts(this.mineOnly());
  }
  protected scopeKey(): string { return 'CONGES.SETTLE'; }

  ngOnInit(): void {
    this.loadEmployees();
    this.loadTypes();
    this.refreshAll();
  }

  // ── Toolbar ───────────────────────────────────────────────────────────────

  readonly toolbarActions = computed<ToolbarAction[]>(() => {
    this.translate.currentLang();
    // "Nouvelle régularisation" is NOT here — it sits in the page header, beside the title.
    // The toolbar holds what narrows the list; the header holds what creates a record.
    return [
      {
        // A toggle rather than a filter field: it changes WHOSE records are listed, which is
        // a different question from which of them to show.
        id: 'scope',
        label: this.translate.instant(
          this.mineOnly() ? 'CONGES.SETTLE.SHOW_ALL' : 'CONGES.SETTLE.SHOW_MINE'),
        icon: this.mineOnly() ? 'groups' : 'person',
        position: 'right',
      },
    ];
  });

  onToolbarAction(id: string): void {
    if (id === 'scope') {
      this.mineOnly.update((v) => !v);
      this.currentPage.set(0);
      this.refreshAll();
    }
  }

  // ── The form ──────────────────────────────────────────────────────────────

  /** Bound in the template's page-header slot, so public rather than private. */
  openForm(): void {
    this.resetForm();
    this.employeeId.set(null);
    this.headers.set(null);
    this.formRef = this.modal.open({
      title: this.translate.instant('CONGES.SETTLE.NEW'),
      subtitle: this.translate.instant('CONGES.SETTLE.NEW_SUB'),
      body: this.formTpl(),
      size: 'lg',
      closeOnBackdrop: false,
      buttons: [
        { label: this.translate.instant('CONGES.CANCEL'), variant: 'secondary', action: (r) => r.close() },
        {
          label: this.translate.instant('CONGES.SETTLE.SUBMIT'),
          variant: 'primary',
          icon: 'post_add',
          // Does NOT close on its own: the submit validates, and a modal that vanished before
          // the server answered would hide the very error the user has to act on.
          action: () => this.submit(),
        },
      ],
    });
  }

  readonly employeeOptions = computed<SelectOption[]>(() =>
    this.employees().map((e) => ({ value: String(e.userId), label: e.fullName })));

  readonly typeOptions = computed<SelectOption[]>(() =>
    (this.headers()?.types ?? []).map((t) => ({ value: t.code, label: t.label })));

  readonly categoryOptions = computed<SelectOption[]>(() =>
    (this.headers()?.categories ?? []).map((c) => ({ value: c.value, label: c.label })));

  readonly selectedType = computed<LeaveTypeOption | null>(() =>
    (this.headers()?.types ?? []).find((t) => t.code === this.formType()) ?? null);

  /**
   * Who may approve THIS type for THIS employee.
   *
   * A type with `eligibleApprovers === null` names no roles and falls back to the default
   * manager list; an empty array means it names roles nobody holds, which is the
   * `noEligibleApprover` case below and NOT the same thing.
   */
  readonly approverOptions = computed<SelectOption[]>(() => {
    const t = this.selectedType();
    const list = t?.eligibleApprovers ?? this.headers()?.approvers ?? [];
    return list.map((a) => ({ value: String(a.userId), label: `${a.fullName} — ${a.roleName}` }));
  });

  readonly noEligibleApprover = computed(() => {
    const t = this.selectedType();
    return t != null && t.eligibleApprovers != null && t.eligibleApprovers.length === 0;
  });

  /** One configured approver means there is nothing to ask — the field shows it, locked. */
  readonly autoAssigned = computed(() =>
    (this.selectedType()?.autoAssign ?? false) && this.approverOptions().length === 1);

  readonly isRange = computed(() => this.category() === 'MULTIPLE_DAYS');

  /**
   * The calendar's own configuration, rebuilt when the category or the employee changes.
   *
   * `holidays` and the weekend rules come from THIS employee's `/headers` payload, so an
   * Egyptian employee's Friday/Saturday is greyed out rather than Tunisia's Saturday/Sunday —
   * the server has always costed it that way and the picker now agrees.
   *
   * `allowPastDays` is TRUE and that is the point of the screen: a régularisation records
   * leave already taken, so a picker that refused past dates would refuse every real case.
   */
  readonly datePickerConfig = computed(() => {
    this.translate.currentLang();
    const h = this.headers();
    return {
      label: this.translate.instant(this.isRange() ? 'CONGES.SETTLE.PERIOD' : 'CONGES.SETTLE.DATE'),
      placeholder: this.translate.instant('CONGES.SETTLE.PICK_DATE'),
      selectionMode: (this.isRange() ? 'range' : 'single') as 'range' | 'single',
      required: true,
      fullWidth: true,
      allowPastDays: true,
      holidays: h?.holidays ?? {},
      maxDays: this.selectedType()?.maxDays ?? undefined,
      error: this.showErrors() && !this.dateDebut()
        ? this.translate.instant('CONGES.SETTLE.REQUIRED') : '',
    };
  });

  /** The picker's value, rebuilt from the two ISO signals the payload is actually built from. */
  readonly dateValue = computed<Date | Date[] | null>(() => {
    const from = this.dateDebut();
    if (!from) return null;
    if (!this.isRange()) return this.parseIso(from);
    const to = this.dateFin();
    return to ? [this.parseIso(from), this.parseIso(to)] : [this.parseIso(from)];
  });

  /**
   * Back to the two ISO signals. A range mid-selection emits a one-element array, which is a
   * start with no end yet — stored as the start, with `dateFin` left null so the submit guard
   * still catches an unfinished range.
   */
  onDateChange(v: Date | Date[] | null): void {
    if (v == null) { this.dateDebut.set(null); this.dateFin.set(null); return; }
    if (Array.isArray(v)) {
      this.dateDebut.set(v[0] ? this.toIso(v[0]) : null);
      this.dateFin.set(v[1] ? this.toIso(v[1]) : null);
    } else {
      this.dateDebut.set(this.toIso(v));
      this.dateFin.set(null);
    }
  }


  readonly justificationMissing = computed(() =>
    (this.selectedType()?.requiresJustification ?? false) && !this.justificatif());

  /** Null renders as a dash, not a zero — "not recorded" is not "none left". */
  readonly balanceCards = computed(() => {
    this.translate.currentLang();
    const b = this.headers()?.balances;
    const loc = localeOf(this.translate.currentLang());
    return [
      { key: 'CONGE', label: this.translate.instant('CONGES.BALANCE.CONGE'), value: formatDays(b?.soldeConge, loc) },
      { key: 'MALADIE', label: this.translate.instant('CONGES.BALANCE.MALADIE'), value: formatDays(b?.soldeMaladie, loc) },
      { key: 'TELETRAVAIL', label: this.translate.instant('CONGES.BALANCE.TELETRAVAIL'), value: formatDays(b?.soldeTeletravail, loc) },
    ];
  });

  /**
   * Choosing an employee reloads everything downstream.
   *
   * The type list, the caps, the approvers and the balances are all per-employee, so keeping
   * a previous selection would offer a type this person may not take, or an approver who does
   * not sit above them. Cleared rather than carried over.
   */
  onEmployee(v: unknown): void {
    const id = this.str(v);
    this.employeeId.set(id);
    this.headers.set(null);
    this.formType.set(null);
    this.responsableId.set(null);
    this.showErrors.set(false);
    if (!id) return;

    this.svc.headersOf(Number(id), this.translate.currentLang() ?? 'fr').subscribe({
      next: (h) => this.headers.set(h),
      error: () => this.notify.error(this.translate.instant('CONGES.SETTLE.ERR_HEADERS')),
    });
  }

  onType(v: unknown): void {
    this.formType.set(this.str(v));
    // A type with exactly one configured approver has nothing to ask about, so the field is
    // filled and locked rather than presented as a choice of one.
    const opts = this.approverOptions();
    this.responsableId.set(this.autoAssigned() && opts.length === 1 ? String(opts[0].value) : null);
  }

  onCategory(v: unknown): void {
    this.category.set(this.str(v) as LeaveCategoryCode | null);
    // A single-day category has no end date; leaving a stale one would post a range.
    if (!this.isRange()) this.dateFin.set(null);
  }

  private submit(): void {
    this.showErrors.set(true);

    if (!this.employeeId() || !this.formType() || !this.category() || !this.dateDebut()
        || !this.responsableId() || !this.reason().trim()
        || (this.isRange() && !this.dateFin())) {
      this.notify.warning(this.translate.instant('CONGES.SETTLE.INCOMPLETE'));
      return;
    }
    if (this.justificationMissing()) {
      this.notify.warning(this.translate.instant('CONGES.SETTLE.JUSTIFICATION_REQUIRED'));
      return;
    }

    const body: SettleRequest = {
      type: this.formType()!,
      category: this.category()!,
      dateDebut: this.dateDebut()!,
      dateFin: this.isRange() ? this.dateFin() : null,
      responsableId: Number(this.responsableId()),
      justificatif: this.justificatif(),
      reason: this.reason().trim(),
    };

    this.working.set(true);
    this.svc.settle(Number(this.employeeId()), body, this.translate.currentLang() ?? 'fr').subscribe({
      next: () => {
        this.working.set(false);
        this.formRef?.close();
        this.formRef = null;
        this.notify.success(this.translate.instant('CONGES.SETTLE.CREATED'));
        this.currentPage.set(0);
        this.refreshAll();
      },
      error: (e) => {
        this.working.set(false);
        // rh-service names the rule that blocked it — an overlap, a cap, a spent balance.
        // The modal stays open so the form can be corrected rather than retyped.
        this.notify.error(errorMessage(e, this.translate.instant('CONGES.SETTLE.ERR_CREATE')));
      },
    });
  }

  private resetForm(): void {
    this.formType.set(null);
    this.category.set('MULTIPLE_DAYS');
    this.dateDebut.set(null);
    this.dateFin.set(null);
    this.responsableId.set(null);
    this.justificatif.set(false);
    this.reason.set('');
    this.showErrors.set(false);
  }

  // ── Data ──────────────────────────────────────────────────────────────────

  /**
   * The employee directory for the picker.
   *
   * `listAllEmployees`, not the profile list: it INCLUDES users with no employee profile, and
   * a régularisation is filed for a person, not for a completed HR file. One page of 500
   * rather than a paged picker — the company is in the hundreds and the select searches.
   */
  private loadEmployees(): void {
    this.profiles.listAllEmployees({}, 0, 500).subscribe({
      next: (p) => this.employees.set(
        (p.content ?? []).map((e) => ({ userId: e.userId, fullName: e.fullName }))),
      error: () => this.notify.warning(this.translate.instant('CONGES.SETTLE.ERR_EMPLOYEES')),
    });
  }

  openDetail(row: CongeRow): void {
    this.detailRow.set(row);
    this.modal.open({
      title: this.translate.instant('CONGES.DETAIL.TITLE'),
      subtitle: this.translate.instant('CONGES.DETAIL.SUBTITLE'),
      icon: 'beach_access',
      body: this.detailTpl(),
      size: 'md',
      buttons: [{
        label: this.translate.instant('CONGES.CLOSE'), variant: 'secondary',
        action: (r) => r.close(),
      }],
    });
  }

  protected sel(v: string | null): string[] { return v == null ? [] : [v]; }
  protected str(v: unknown): string | null { return v == null || v === '' ? null : String(v); }
}
