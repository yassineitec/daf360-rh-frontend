import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  PageComponent, PageHeaderComponent, DataTableComponent, ButtonComponent,
  FormFieldComponent, SelectComponent, ToggleComponent, ModalService,
  type TableColumn, type TableConfig, type TableRow, type SelectOption, type BadgeVariant,
} from '@khalilrebhiitec/daf360';

import { NotificationService } from '../../core/notification.service';
import { ProfileService } from '../profiles/profile.service';
import { CongesService } from './conges.service';
import {
  CongeRow, DemandeEtat, LeaveCategoryCode, LeaveHeaders, LeaveTypeOption, SettleRequest,
} from './models/conge.model';

/** The four states, for the filter on the list below the form. */
const ETATS: { value: DemandeEtat; labelKey: string }[] = [
  { value: 'EN_ATTENTE', labelKey: 'CONGES.ETAT.EN_ATTENTE' },
  { value: 'VALIDE',     labelKey: 'CONGES.ETAT.VALIDE' },
  { value: 'REFUSE',     labelKey: 'CONGES.ETAT.REFUSE' },
  { value: 'ARCHIVE',    labelKey: 'CONGES.ETAT.ARCHIVE' },
];

/**
 * Régularisations — HR filing a congé on someone else's behalf.
 *
 * WHAT THIS REPLACES
 * -----------------------------------------------------------------------------
 * The timesheet's `demandes-regularisations` page, congés tab. That page also carried
 * autorisation and télétravail tabs; those modules have not moved yet, so this screen is
 * congés only rather than a three-tab shell with two empty tabs.
 *
 * WHY IT IS NOT THE SELF-SERVICE FORM WITH AN EMPLOYEE PICKER
 * -----------------------------------------------------------------------------
 * It very nearly is, and deliberately so: it reads the SAME `/headers/{id}` payload the
 * employee's own modal reads, so the day caps, the justification rule, the approver roles and
 * the balance gate are identical. What differs is that everything depends on WHICH employee,
 * and none of it can be answered until one is chosen — so the form stays disabled until then
 * rather than showing an empty type list that looks broken.
 *
 * THE BALANCE IS SHOWN, NOT ENFORCED DIFFERENTLY
 * -----------------------------------------------------------------------------
 * A régularisation records leave that was already taken, so it must be possible to file one
 * that pushes a balance negative — that is the normal case when someone has been off without
 * asking. The server allows it down to the -3 day tolerance and refuses beyond; this screen
 * shows the balance and what the request costs so the decision is made with the figures in
 * view, and lets the server be the one that says no.
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
    PageComponent, PageHeaderComponent, DataTableComponent, ButtonComponent,
    SelectComponent, FormFieldComponent, ToggleComponent, TranslatePipe,
  ],
  template: `
    <daf-page [loading]="loading()">
      <!-- No icon on the page header: platform convention. -->
      <daf-page-header
        [title]="'CONGES.SETTLE.TITLE' | translate"
        [subtitle]="'CONGES.SETTLE.SUBTITLE' | translate" />

      <!-- ── The form ─────────────────────────────────────────────────────── -->
      <section class="cs-form">
        <daf-select
          [options]="employeeOptions()"
          [selected]="sel(employeeId())"
          [config]="{ label: ('CONGES.SETTLE.EMPLOYEE' | translate), required: true, fullWidth: true,
                      searchable: true,
                      placeholder: ('CONGES.SETTLE.EMPLOYEE_PLACEHOLDER' | translate) }"
          (selectedChange)="onEmployee($event[0])" />

        @if (employeeId() && headers()) {
          <!-- Balances first: they are what the decision is made against. -->
          <div class="cs-balances">
            @for (b of balanceCards(); track b.key) {
              <div class="cs-balance">
                <span class="cs-balance-label">{{ b.label }}</span>
                <span class="cs-balance-value">{{ b.value }}</span>
              </div>
            }
          </div>

          <div class="cs-grid">
            <daf-select
              [options]="typeOptions()"
              [selected]="sel(type())"
              [config]="{ label: ('CONGES.SETTLE.TYPE' | translate), required: true, fullWidth: true,
                          error: showErrors() && !type() ? ('CONGES.SETTLE.REQUIRED' | translate) : '' }"
              (selectedChange)="onType($event[0])" />

            <daf-select
              [options]="categoryOptions()"
              [selected]="sel(category())"
              [config]="{ label: ('CONGES.SETTLE.CATEGORY' | translate), required: true, fullWidth: true }"
              (selectedChange)="onCategory($event[0])" />

            <daf-form-field
              [options]="{ label: ('CONGES.SETTLE.FROM' | translate), type: 'date', required: true, fullWidth: true,
                           error: showErrors() && !dateDebut() ? ('CONGES.SETTLE.REQUIRED' | translate) : '' }"
              [value]="dateDebut()"
              (valueChange)="dateDebut.set(str($event))" />

            <!-- Only a multi-day request has an end date; the others ARE one day, and
                 offering a second date would invite a range the server would collapse. -->
            @if (isRange()) {
              <daf-form-field
                [options]="{ label: ('CONGES.SETTLE.TO' | translate), type: 'date', required: true, fullWidth: true,
                             error: showErrors() && !dateFin() ? ('CONGES.SETTLE.REQUIRED' | translate) : '' }"
                [value]="dateFin()"
                (valueChange)="dateFin.set(str($event))" />
            }

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
            <p class="cs-warn">{{ 'CONGES.SETTLE.NO_APPROVER' | translate }}</p>
          }

          @if (selectedType(); as t) {
            @if (t.maxDays != null) {
              <p class="cs-hint">{{ 'CONGES.SETTLE.MAX_DAYS' | translate: { days: t.maxDays } }}</p>
            }
          }

          <div class="cs-grid">
            <daf-toggle
              [checked]="justificatif()"
              [options]="{ label: ('CONGES.SETTLE.JUSTIFICATIF' | translate) }"
              (checkedChange)="justificatif.set($event)" />
          </div>

          @if (justificationMissing()) {
            <p class="cs-warn">{{ 'CONGES.SETTLE.JUSTIFICATION_REQUIRED' | translate }}</p>
          }

          <daf-form-field
            [options]="{ label: ('CONGES.SETTLE.REASON' | translate), type: 'textarea', rows: 3, required: true, fullWidth: true,
                         hint: ('CONGES.SETTLE.REASON_HINT' | translate),
                         error: showErrors() && !reason().trim() ? ('CONGES.SETTLE.REQUIRED' | translate) : '' }"
            [value]="reason()"
            (valueChange)="reason.set(str($event) ?? '')" />

          <div class="cs-submit">
            <daf-button
              [options]="{ label: ('CONGES.SETTLE.RESET' | translate), variant: 'ghost', disabled: working() }"
              (onClick)="resetForm()" />
            <daf-button
              [options]="{ label: ('CONGES.SETTLE.SUBMIT' | translate), variant: 'primary', iconStart: 'post_add', disabled: working() }"
              (onClick)="submit()" />
          </div>
        }
      </section>

      <!-- ── What has already been filed ──────────────────────────────────── -->
      <h3 class="cs-section">{{ 'CONGES.SETTLE.HISTORY' | translate }}</h3>

      <div class="cs-filters">
        <daf-select
          [options]="etatOptions()"
          [selected]="sel(etat())"
          [config]="{ label: ('CONGES.FILTER.ETAT' | translate), placeholder: ('CONGES.FILTER.ALL' | translate), fullWidth: true }"
          (selectedChange)="onEtat($event[0])" />

        <daf-form-field
          [options]="{ label: ('CONGES.FILTER.FROM' | translate), type: 'date', fullWidth: true }"
          [value]="filterFrom()"
          (valueChange)="filterFrom.set(str($event)); reload()" />

        <daf-form-field
          [options]="{ label: ('CONGES.FILTER.TO' | translate), type: 'date', fullWidth: true }"
          [value]="filterTo()"
          (valueChange)="filterTo.set(str($event)); reload()" />

        <!-- Off by default: the screen opens on what THIS person filed. Everyone's is an
             audit view, and one someone should have to ask for. -->
        <daf-toggle
          [checked]="!mineOnly()"
          [options]="{ label: ('CONGES.SETTLE.ALL_FILERS' | translate) }"
          (checkedChange)="onScope($event)" />
      </div>

      <daf-data-table
        [columns]="columns()"
        [rows]="tableRows()"
        [config]="tableConfig()" />

      @if (totalPages() > 1) {
        <div class="cs-pager">
          <daf-button
            [options]="{ label: ('CONGES.PREV' | translate), variant: 'ghost', iconStart: 'chevron_left', disabled: page() === 0 }"
            (onClick)="goto(page() - 1)" />
          <span class="cs-pager-info">{{ page() + 1 }} / {{ totalPages() }}</span>
          <daf-button
            [options]="{ label: ('CONGES.NEXT' | translate), variant: 'ghost', iconStart: 'chevron_right', disabled: page() + 1 >= totalPages() }"
            (onClick)="goto(page() + 1)" />
        </div>
      }
    </daf-page>
  `,
  styles: [`
    .cs-form { margin-bottom: 28px; padding: 18px; border-radius: 12px;
               background: var(--color-surface-container-low); }

    .cs-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px; margin-top: 14px; }
    @media (max-width: 720px) { .cs-grid { grid-template-columns: 1fr; } }

    .cs-balances { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 14px; }
    .cs-balance { flex: 1 1 140px; padding: 10px 14px; border-radius: 10px;
                  background: var(--color-surface); display: flex; flex-direction: column; gap: 2px; }
    .cs-balance-label { font-size: .75rem; color: var(--color-on-surface-variant); }
    .cs-balance-value { font-size: 1.25rem; font-weight: 600; font-variant-numeric: tabular-nums; }

    .cs-hint { margin: 10px 0 0; font-size: .8125rem; color: var(--color-on-surface-variant); }
    .cs-warn { margin: 10px 0 0; font-size: .8125rem; padding: 8px 12px; border-radius: 8px;
               background: color-mix(in srgb, var(--color-warning) 14%, transparent);
               color: var(--color-on-surface); }

    .cs-submit { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }

    .cs-section { margin: 0 0 12px; font-size: 1rem; font-weight: 600; }

    .cs-filters { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)) auto; gap: 12px;
                  align-items: end; margin-bottom: 18px; }
    @media (max-width: 900px) { .cs-filters { grid-template-columns: 1fr 1fr; } }
    @media (max-width: 560px) { .cs-filters { grid-template-columns: 1fr; } }

    .cs-pager { display: flex; align-items: center; justify-content: center; gap: 12px; margin-top: 16px; }
    .cs-pager-info { font-variant-numeric: tabular-nums; color: var(--color-on-surface-variant); font-size: .875rem; }
  `],
})
export class CongeSettleComponent implements OnInit {
  private readonly svc = inject(CongesService);
  private readonly profiles = inject(ProfileService);
  private readonly modal = inject(ModalService);
  private readonly notify = inject(NotificationService);
  private readonly translate = inject(TranslateService);

  // ── Form state ────────────────────────────────────────────────────────────
  readonly employees = signal<{ userId: number; fullName: string }[]>([]);
  readonly employeeId = signal<string | null>(null);
  readonly headers = signal<LeaveHeaders | null>(null);

  readonly type = signal<string | null>(null);
  readonly category = signal<LeaveCategoryCode | null>('MULTIPLE_DAYS');
  readonly dateDebut = signal<string | null>(null);
  readonly dateFin = signal<string | null>(null);
  readonly responsableId = signal<string | null>(null);
  readonly justificatif = signal(false);
  readonly reason = signal('');
  readonly showErrors = signal(false);

  // ── List state ────────────────────────────────────────────────────────────
  readonly rows = signal<CongeRow[]>([]);
  readonly loading = signal(false);
  readonly working = signal(false);
  readonly page = signal(0);
  readonly totalPages = signal(0);
  readonly etat = signal<DemandeEtat | null>(null);
  readonly filterFrom = signal<string | null>(null);
  readonly filterTo = signal<string | null>(null);
  readonly mineOnly = signal(true);

  // ── Derived ───────────────────────────────────────────────────────────────

  readonly employeeOptions = computed<SelectOption[]>(() =>
    this.employees().map((e) => ({ value: String(e.userId), label: e.fullName })));

  readonly typeOptions = computed<SelectOption[]>(() =>
    (this.headers()?.types ?? []).map((t) => ({ value: t.code, label: t.label })));

  readonly categoryOptions = computed<SelectOption[]>(() =>
    (this.headers()?.categories ?? []).map((c) => ({ value: c.value, label: c.label })));

  readonly selectedType = computed<LeaveTypeOption | null>(() =>
    (this.headers()?.types ?? []).find((t) => t.code === this.type()) ?? null);

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
  readonly autoAssigned = computed(() => (this.selectedType()?.autoAssign ?? false)
    && this.approverOptions().length === 1);

  readonly isRange = computed(() => this.category() === 'MULTIPLE_DAYS');

  readonly justificationMissing = computed(() =>
    (this.selectedType()?.requiresJustification ?? false) && !this.justificatif());

  /** Null renders as a dash, not a zero — "not recorded" is not "none left". */
  readonly balanceCards = computed(() => {
    this.translate.currentLang();
    const b = this.headers()?.balances;
    const fmt = (v: number | null | undefined) => (v == null ? '—' : String(v));
    return [
      { key: 'CONGE',      label: this.translate.instant('CONGES.BALANCE.CONGE'),      value: fmt(b?.soldeConge) },
      { key: 'MALADIE',    label: this.translate.instant('CONGES.BALANCE.MALADIE'),    value: fmt(b?.soldeMaladie) },
      { key: 'TELETRAVAIL', label: this.translate.instant('CONGES.BALANCE.TELETRAVAIL'), value: fmt(b?.soldeTeletravail) },
    ];
  });

  readonly etatOptions = computed<SelectOption[]>(() => {
    this.translate.currentLang();
    return ETATS.map((e) => ({ value: e.value, label: this.translate.instant(e.labelKey) }));
  });

  readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    return [
      { key: 'collaborateurName', label: this.translate.instant('CONGES.COL.EMPLOYEE'), sortable: true },
      { key: 'typeLabel',         label: this.translate.instant('CONGES.COL.TYPE') },
      { key: 'periode',           label: this.translate.instant('CONGES.COL.PERIOD') },
      { key: 'totalJours',        label: this.translate.instant('CONGES.COL.DAYS'), type: 'number', align: 'right',
        format: { maximumFractionDigits: 1 } },
      { key: 'etatBadge',         label: this.translate.instant('CONGES.COL.STATE'), type: 'badge' },
      // The point of this list: who filed it. Only meaningful once the scope is widened,
      // but kept always so the column set does not shift under the reader.
      { key: 'createdByName',     label: this.translate.instant('CONGES.COL.FILED_BY') },
      { key: 'createdAt',         label: this.translate.instant('CONGES.COL.SUBMITTED'), type: 'date',
        format: { dateStyle: 'short' }, sortable: true },
    ];
  });

  readonly tableConfig = computed<TableConfig>(() => {
    this.translate.currentLang();
    return {
      hoverable: true,
      loading: this.loading(),
      emptyMessage: this.translate.instant('CONGES.SETTLE.EMPTY'),
      manualSort: true,
    };
  });

  readonly tableRows = computed<TableRow[]>(() =>
    this.rows().map((r) => ({
      ...r,
      periode: r.dateDebut === r.dateFin
        ? this.fmt(r.dateDebut)
        : `${this.fmt(r.dateDebut)} → ${this.fmt(r.dateFin)}`,
      etatBadge: this.badge(r.etatDemande),
      createdByName: r.createdByName ?? '—',
    })));

  ngOnInit(): void {
    this.loadEmployees();
    this.reload();
  }

  // ── Loading ───────────────────────────────────────────────────────────────

  /**
   * The employee directory for the picker.
   *
   * One page of 500 rather than a paged picker: the company is in the hundreds, and a
   * régularisation is typed against a name the user already knows, so searching inside the
   * select beats paging through a list.
   */
  private loadEmployees(): void {
    // listAllEmployees, not the profile list: it INCLUDES users with no employee profile,
    // and a régularisation is filed for a person, not for a completed HR file.
    this.profiles.listAllEmployees({}, 0, 500).subscribe({
      next: (p) => this.employees.set(
        (p.content ?? []).map((e) => ({ userId: e.userId, fullName: e.fullName }))),
      error: () => this.notify.warning(this.translate.instant('CONGES.SETTLE.ERR_EMPLOYEES')),
    });
  }

  reload(): void {
    this.loading.set(true);
    this.svc.settled({
      mine: this.mineOnly(),
      etat: this.etat(), from: this.filterFrom(), to: this.filterTo(),
      page: this.page(), size: 20,
    }, this.translate.currentLang() ?? 'fr').subscribe({
      next: (p) => {
        this.rows.set(p.content ?? []);
        this.totalPages.set(p.totalPages ?? 0);
        this.loading.set(false);
      },
      // Not swallowed into an empty table: "none filed" and "the call failed" must not look
      // the same to someone checking whether a correction went in.
      error: () => {
        this.rows.set([]); this.totalPages.set(0); this.loading.set(false);
        this.notify.error(this.translate.instant('CONGES.SETTLE.ERR_LOAD'));
      },
    });
  }

  goto(p: number): void { this.page.set(Math.max(0, p)); this.reload(); }

  onEtat(v: unknown): void {
    this.etat.set((v == null || v === '' ? null : String(v)) as DemandeEtat | null);
    this.page.set(0);
    this.reload();
  }

  onScope(allFilers: boolean): void {
    this.mineOnly.set(!allFilers);
    this.page.set(0);
    this.reload();
  }

  // ── The form ──────────────────────────────────────────────────────────────

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
    this.type.set(null);
    this.responsableId.set(null);
    this.showErrors.set(false);
    if (!id) return;

    this.svc.headersOf(Number(id), this.translate.currentLang() ?? 'fr').subscribe({
      next: (h) => this.headers.set(h),
      error: () => this.notify.error(this.translate.instant('CONGES.SETTLE.ERR_HEADERS')),
    });
  }

  onType(v: unknown): void {
    this.type.set(this.str(v));
    // A type with exactly one configured approver has nothing to ask about, so the field is
    // filled and locked rather than presented as a choice of one.
    const opts = this.approverOptions();
    this.responsableId.set(this.autoAssigned() && opts.length === 1 ? opts[0].value as string : null);
  }

  onCategory(v: unknown): void {
    this.category.set(this.str(v) as LeaveCategoryCode | null);
    // A single-day category has no end date; leaving a stale one would post a range.
    if (!this.isRange()) this.dateFin.set(null);
  }

  submit(): void {
    this.showErrors.set(true);

    if (!this.employeeId() || !this.type() || !this.category() || !this.dateDebut()
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
      type: this.type()!,
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
        this.notify.success(this.translate.instant('CONGES.SETTLE.CREATED'));
        this.resetForm();
        this.page.set(0);
        this.reload();
      },
      error: (e) => {
        this.working.set(false);
        // rh-service names the rule that blocked it — an overlap, a cap, a spent balance.
        // Shown in a modal rather than a toast: it is the answer to what was just attempted,
        // and it should not disappear on a timer while being read.
        this.modal.open({
          title: this.translate.instant('CONGES.ERROR'),
          subtitle: e?.error?.message ?? this.translate.instant('CONGES.SETTLE.ERR_CREATE'),
          size: 'sm',
          buttons: [{
            label: this.translate.instant('CONGES.CLOSE'), variant: 'secondary',
            action: (r) => r.close(),
          }],
        });
      },
    });
  }

  /** Keeps the chosen employee: filing two corrections for one person is the common case. */
  resetForm(): void {
    this.type.set(null);
    this.category.set('MULTIPLE_DAYS');
    this.dateDebut.set(null);
    this.dateFin.set(null);
    this.responsableId.set(null);
    this.justificatif.set(false);
    this.reason.set('');
    this.showErrors.set(false);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** BadgeCell is { label, options } — the variant lives inside options, not beside it. */
  private badge(etat: DemandeEtat): { label: string; options: { variant: BadgeVariant } } {
    const map: Record<DemandeEtat, BadgeVariant> = {
      EN_ATTENTE: 'warning', VALIDE: 'success', REFUSE: 'danger', ARCHIVE: 'neutral',
    };
    return { label: this.translate.instant('CONGES.ETAT.' + etat), options: { variant: map[etat] } };
  }

  private fmt(iso: string): string {
    // Split rather than new Date(): an ISO date parsed as UTC then rendered locally can show
    // the previous day, which is the exact class of bug this module just moved away from.
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  protected sel(v: string | null): string[] { return v == null ? [] : [v]; }
  protected str(v: unknown): string | null { return v == null || v === '' ? null : String(v); }
}
