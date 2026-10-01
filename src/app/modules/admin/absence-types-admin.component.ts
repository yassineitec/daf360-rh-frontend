import {
  Component, computed, inject, OnInit, signal, TemplateRef, viewChild,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  DataTableComponent, ButtonComponent,
  FormFieldComponent, SelectComponent, ToggleComponent, ModalService,
  type ModalRef, type TableColumn, type TableConfig, type TableRow,
  type SelectOption, type BadgeVariant,
} from '@khalilrebhiitec/daf360';

import { NotificationService } from '../../core/notification.service';
// Service and model stay in `modules/conges`: they describe the congé domain, and the
// self-service modal reads the same catalogue. Only the ADMIN SCREEN lives here, with the
// other sixteen configurable lists — which is where someone goes to configure something.
import { AbsenceTypesService, RoleOption } from '../conges/absence-types.service';
import {
  AbsenceTypeRow, AbsenceTypeUpsert, BALANCE_FIELDS,
} from '../conges/models/absence-type.model';

/**
 * Administering what a congé IS.
 *
 * This screen is the reason the leave model stopped being an enum. Adding a type, retiring
 * one, changing what it costs and who signs it off used to be a deployment; here they are
 * rows.
 *
 * WHAT THE FORM MAKES HARD ON PURPOSE
 * -----------------------------------------------------------------------------
 *   CODE IS WRITE-ONCE. Editable on create, read-only afterwards. Every filed request
 *   stores the code, and 716 already do — a rename orphans them. The backend ignores a
 *   submitted code on update, so this is a second lock rather than the only one.
 *
 *   RETIRING NAMES THE DAMAGE. The confirmation asks the server how many requests use the
 *   type and says so. Retiring one used by 300 requests and one used by none are very
 *   different acts and should not look identical.
 *
 *   THE BALANCE PAIR MOVES TOGETHER. Switching "tracks a balance" on reveals which balance
 *   and refuses to save without it — a type that claims to debit an allowance and silently
 *   does not is the kind of bug an employee discovers months later in their own figures.
 *
 * TWO FIELDS ARE LABELLED AS INERT. `allowedGender` and `approverResolutionStrategy` are
 * stored and round-tripped but enforced by no code — verified in the source, not assumed.
 * The form says so beside them. Presenting them as working rules would be a lie the screen
 * tells convincingly.
 */
@Component({
  selector: 'app-absence-types-admin',
  standalone: true,
  imports: [
    DataTableComponent, ButtonComponent,
    FormFieldComponent, SelectComponent, ToggleComponent, TranslatePipe,
  ],
  // No `daf-page` / `daf-page-header` here: AdminComponent already wraps every tab in one
  // and renders the breadcrumb header. A second pair would nest a page inside a page and
  // print the title twice.
  template: `
    @if (loading()) {
      <p class="at-loading">{{ 'CONGES.TYPES.LOADING' | translate }}</p>
    }

    <p class="at-intro">{{ 'CONGES.TYPES.SUBTITLE' | translate }}</p>

    <div class="at-bar">
        <daf-button
          [options]="{ label: ('CONGES.TYPES.NEW' | translate), variant: 'primary', iconStart: 'add' }"
          (onClick)="openCreate()" />
      </div>

      <daf-data-table
        [columns]="columns()"
        [rows]="tableRows()"
        [config]="tableConfig()" />

      <!-- ── The form, used for both create and edit ────────────────────── -->
      <ng-template #formTpl>
        <div class="at-form">

          <div class="at-grid">
            <daf-form-field
              [options]="{ label: ('CONGES.TYPES.CODE' | translate), required: true, fullWidth: true,
                           disabled: editing() !== null,
                           hint: (editing() ? ('CONGES.TYPES.CODE_LOCKED' | translate) : ('CONGES.TYPES.CODE_HINT' | translate)),
                           error: showErrors() && !codeValid() ? ('CONGES.TYPES.CODE_INVALID' | translate) : '' }"
              [value]="code()"
              (valueChange)="code.set((str($event) ?? '').toUpperCase())" />

            <daf-form-field
              [options]="{ label: ('CONGES.TYPES.ORDER' | translate), type: 'number', fullWidth: true,
                           hint: ('CONGES.TYPES.ORDER_HINT' | translate) }"
              [value]="displayOrder()"
              (valueChange)="displayOrder.set(num($event) ?? 0)" />

            <daf-form-field
              [options]="{ label: ('CONGES.TYPES.LABEL_FR' | translate), required: true, fullWidth: true,
                           error: showErrors() && !labelFr().trim() ? ('CONGES.TYPES.REQUIRED' | translate) : '' }"
              [value]="labelFr()"
              (valueChange)="labelFr.set(str($event) ?? '')" />

            <daf-form-field
              [options]="{ label: ('CONGES.TYPES.LABEL_EN' | translate), required: true, fullWidth: true,
                           error: showErrors() && !labelEn().trim() ? ('CONGES.TYPES.REQUIRED' | translate) : '' }"
              [value]="labelEn()"
              (valueChange)="labelEn.set(str($event) ?? '')" />
          </div>

          <!-- ── Balance ─────────────────────────────────────────────────
               The pair moves together: the field only appears once the
               toggle is on, and saving without it is refused. -->
          <p class="at-sec">{{ 'CONGES.TYPES.SEC_BALANCE' | translate }}</p>
          <div class="at-grid">
            <daf-toggle
              [checked]="tracksBalance()"
              [options]="{ label: ('CONGES.TYPES.TRACKS_BALANCE' | translate) }"
              (checkedChange)="onTracksBalance($event)" />

            @if (tracksBalance()) {
              <daf-select
                [options]="balanceOptions()"
                [selected]="sel(balanceField())"
                [config]="{ label: ('CONGES.TYPES.BALANCE_FIELD' | translate), required: true, fullWidth: true,
                            error: showErrors() && !balanceField() ? ('CONGES.TYPES.BALANCE_REQUIRED' | translate) : '' }"
                (selectedChange)="balanceField.set(str($event[0]))" />
            }

            <daf-form-field
              [options]="{ label: ('CONGES.TYPES.MAX_DAYS' | translate), type: 'number', fullWidth: true,
                           hint: ('CONGES.TYPES.MAX_DAYS_HINT' | translate) }"
              [value]="maxDays()"
              (valueChange)="maxDays.set(num($event))" />
          </div>

          <!-- ── Scheduling ──────────────────────────────────────────────
               Two rules counted in WORKING days — weekends and public holidays do not
               consume notice, which is the point of asking for "three days' notice"
               rather than "three days". -->
          <p class="at-sec">{{ 'CONGES.TYPES.SEC_SCHEDULING' | translate }}</p>
          <p class="at-hint">{{ 'CONGES.TYPES.SCHEDULING_HINT' | translate }}</p>
          <div class="at-grid">
            <daf-form-field
              [options]="{ label: ('CONGES.TYPES.NOTICE_DAYS' | translate), type: 'number', fullWidth: true,
                           hint: ('CONGES.TYPES.NOTICE_DAYS_HINT' | translate) }"
              [value]="advanceNoticeDays()"
              (valueChange)="advanceNoticeDays.set(num($event))" />

            <daf-form-field
              [options]="{ label: ('CONGES.TYPES.GAP_DAYS' | translate), type: 'number', fullWidth: true,
                           hint: ('CONGES.TYPES.GAP_DAYS_HINT' | translate) }"
              [value]="leaveGapDays()"
              (valueChange)="leaveGapDays.set(num($event))" />
          </div>
          <!-- Empty and 0 are DIFFERENT answers and the form says so, because the
               difference is invisible once saved. -->
          <p class="at-hint">{{ 'CONGES.TYPES.SCHEDULING_NULL_HINT' | translate }}</p>

          <!-- ── Explanation ─────────────────────────────────────────── -->
          <p class="at-sec">{{ 'CONGES.TYPES.SEC_DESCRIPTION' | translate }}</p>
          <daf-form-field
            [options]="{ label: ('CONGES.TYPES.DESCRIPTION' | translate), type: 'textarea', rows: 3,
                         fullWidth: true, hint: ('CONGES.TYPES.DESCRIPTION_HINT' | translate) }"
            [value]="description()"
            (valueChange)="description.set(str($event) ?? '')" />

          <!-- ── Rules ───────────────────────────────────────────────── -->
          <p class="at-sec">{{ 'CONGES.TYPES.SEC_RULES' | translate }}</p>
          <div class="at-grid">
            <daf-toggle
              [checked]="requiresJustification()"
              [options]="{ label: ('CONGES.TYPES.REQUIRES_JUSTIF' | translate) }"
              (checkedChange)="requiresJustification.set($event)" />

            <daf-toggle
              [checked]="managerCanView()"
              [options]="{ label: ('CONGES.TYPES.MANAGER_CAN_VIEW' | translate) }"
              (checkedChange)="managerCanView.set($event)" />
            <p class="at-hint">{{ 'CONGES.TYPES.MANAGER_CAN_VIEW_HINT' | translate }}</p>

            <daf-toggle
              [checked]="includedInHrStats()"
              [options]="{ label: ('CONGES.TYPES.IN_HR_STATS' | translate) }"
              (checkedChange)="includedInHrStats.set($event)" />

            <daf-toggle
              [checked]="active()"
              [options]="{ label: ('CONGES.TYPES.ACTIVE' | translate) }"
              (checkedChange)="active.set($event)" />
          </div>

          <!-- ── Approvers ───────────────────────────────────────────── -->
          <p class="at-sec">{{ 'CONGES.TYPES.SEC_APPROVERS' | translate }}</p>
          <p class="at-hint">{{ 'CONGES.TYPES.APPROVERS_HINT' | translate }}</p>
          <daf-select
            [options]="roleOptions()"
            [selected]="approverRoleIds()"
            [config]="{ label: ('CONGES.TYPES.APPROVER_ROLES' | translate), multiple: true,
                        placeholder: ('CONGES.TYPES.APPROVERS_NONE' | translate),
                        fullWidth: true, searchable: true }"
            (selectedChange)="approverRoleIds.set($event)" />

          <!-- ── Stored but not enforced ─────────────────────────────── -->
          <p class="at-sec">{{ 'CONGES.TYPES.SEC_INERT' | translate }}</p>
          <p class="at-warn">{{ 'CONGES.TYPES.INERT_HINT' | translate }}</p>
          <div class="at-grid">
            <daf-select
              [options]="genderOptions()"
              [selected]="sel(allowedGender())"
              [config]="{ label: ('CONGES.TYPES.ALLOWED_GENDER' | translate), fullWidth: true }"
              (selectedChange)="allowedGender.set(str($event[0]))" />

            <daf-select
              [options]="strategyOptions()"
              [selected]="sel(strategy())"
              [config]="{ label: ('CONGES.TYPES.STRATEGY' | translate), fullWidth: true }"
              (selectedChange)="strategy.set(str($event[0]))" />
          </div>

          @if (formError()) { <p class="at-error">{{ formError() }}</p> }
        </div>
      </ng-template>
  `,
  styles: [`
    .at-loading { color:var(--color-text-muted);font-size:var(--text-body-sm);margin:0 0 12px }
    .at-intro   { color:var(--color-text-muted);font-size:var(--text-body-sm);margin:0 0 16px }
    .at-bar  { display: flex; justify-content: flex-end; margin-bottom: 14px; }
    .at-form { display: flex; flex-direction: column; gap: 6px; }
    .at-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; align-items: end; }
    @media (max-width: 640px) { .at-grid { grid-template-columns: 1fr; } }
    .at-sec  { margin: 20px 0 4px; font-size: .6875rem; letter-spacing: .1em; text-transform: uppercase;
               font-weight: 700; color: var(--color-on-surface-variant); }
    .at-hint { margin: 0 0 6px; font-size: .8125rem; color: var(--color-on-surface-variant); }
    .at-warn { margin: 0 0 6px; font-size: .8125rem; color: var(--color-warning); }
    .at-error{ margin: 10px 0 0; font-size: .875rem; color: var(--color-danger); }
  `],
})
export class AbsenceTypesAdminComponent implements OnInit {
  private readonly svc = inject(AbsenceTypesService);
  private readonly modal = inject(ModalService);
  private readonly notify = inject(NotificationService);
  private readonly translate = inject(TranslateService);

  private readonly formTpl = viewChild.required<TemplateRef<unknown>>('formTpl');

  readonly rows = signal<AbsenceTypeRow[]>([]);
  readonly roles = signal<RoleOption[]>([]);
  readonly loading = signal(false);

  /** The row being edited, or null for a create. Also locks the code field. */
  readonly editing = signal<AbsenceTypeRow | null>(null);

  // ── Form ──────────────────────────────────────────────────────────────────
  readonly code = signal('');
  readonly labelFr = signal('');
  readonly labelEn = signal('');
  readonly active = signal(true);
  readonly tracksBalance = signal(false);
  readonly balanceField = signal<string | null>(null);
  readonly includedInHrStats = signal(false);
  readonly requiresJustification = signal(false);
  readonly maxDays = signal<number | null>(null);
  /** Null = inherit the country default; 0 = no rule for this type. Kept apart on purpose. */
  readonly advanceNoticeDays = signal<number | null>(null);
  readonly leaveGapDays = signal<number | null>(null);
  readonly description = signal('');
  readonly displayOrder = signal(0);
  readonly allowedGender = signal<string | null>('ALL');
  readonly managerCanView = signal(true);
  readonly strategy = signal<string | null>('TOP_OF_HIERARCHY');
  readonly approverRoleIds = signal<string[]>([]);

  readonly showErrors = signal(false);
  readonly formError = signal<string | null>(null);

  /** Uppercase, digits and underscore — matches the server's @Pattern exactly. */
  readonly codeValid = computed(() => /^[A-Z0-9_]+$/.test(this.code().trim()));

  readonly balanceOptions = computed<SelectOption[]>(() =>
    BALANCE_FIELDS.map((f) => ({ value: f, label: f })));

  readonly genderOptions = computed<SelectOption[]>(() => {
    this.translate.currentLang();
    return ['ALL', 'MALE', 'FEMALE'].map((g) => ({
      value: g, label: this.translate.instant('CONGES.TYPES.GENDER.' + g),
    }));
  });

  readonly strategyOptions = computed<SelectOption[]>(() =>
    ['TOP_OF_HIERARCHY', 'ROLE_MATCH', 'SAME_COUNTRY_FIRST'].map((s) => ({ value: s, label: s })));

  readonly roleOptions = computed<SelectOption[]>(() =>
    this.roles().map((r) => ({ value: String(r.id), label: r.frenchName })));

  readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    return [
      { key: 'code',        label: this.translate.instant('CONGES.TYPES.CODE'), sortable: true },
      { key: 'label',       label: this.translate.instant('CONGES.TYPES.LABEL'), sortable: true },
      { key: 'balanceCell', label: this.translate.instant('CONGES.TYPES.BALANCE'), type: 'badge' },
      { key: 'rulesCell',   label: this.translate.instant('CONGES.TYPES.RULES') },
      { key: 'approversCell', label: this.translate.instant('CONGES.TYPES.APPROVERS') },
      { key: 'activeCell',  label: this.translate.instant('CONGES.TYPES.STATE'), type: 'badge' },
      { key: 'displayOrder', label: this.translate.instant('CONGES.TYPES.ORDER'), type: 'number', align: 'right' },
    ];
  });

  readonly tableConfig = computed<TableConfig>(() => {
    this.translate.currentLang();
    return {
      hoverable: true,
      loading: this.loading(),
      emptyMessage: this.translate.instant('CONGES.TYPES.EMPTY'),
      defaultSort: { key: 'displayOrder', dir: 'asc' },
      actions: [
        {
          id: 'edit',
          icon: 'edit',
          tooltip: this.translate.instant('CONGES.TYPES.EDIT'),
          onClick: (r) => this.openEdit(r as unknown as AbsenceTypeRow),
        },
        {
          id: 'toggle',
          icon: 'toggle_on',
          tooltip: this.translate.instant('CONGES.TYPES.TOGGLE'),
          onClick: (r) => this.toggleActive(r as unknown as AbsenceTypeRow),
        },
        {
          id: 'retire',
          icon: 'delete',
          variant: 'danger',
          tooltip: this.translate.instant('CONGES.TYPES.RETIRE'),
          onClick: (r) => this.confirmRetire(r as unknown as AbsenceTypeRow),
        },
      ],
    };
  });

  readonly tableRows = computed<TableRow[]>(() =>
    this.rows().map((t) => ({
      ...t,
      label: this.translate.currentLang() === 'en' ? t.labelEn : t.labelFr,
      balanceCell: t.tracksBalance
        ? { label: t.balanceField ?? '?', options: { variant: 'info' as BadgeVariant } }
        : { label: this.translate.instant('CONGES.TYPES.NO_BALANCE'), options: { variant: 'neutral' as BadgeVariant } },
      rulesCell: this.rulesSummary(t),
      approversCell: t.approverRoles.length
        ? t.approverRoles.map((r) => r.roleName).join(', ')
        : this.translate.instant('CONGES.TYPES.APPROVERS_DEFAULT'),
      activeCell: t.active
        ? { label: this.translate.instant('CONGES.TYPES.ON'), options: { variant: 'success' as BadgeVariant } }
        : { label: this.translate.instant('CONGES.TYPES.OFF'), options: { variant: 'neutral' as BadgeVariant } },
    })));

  ngOnInit(): void {
    this.load();
    this.svc.roles().subscribe({
      next: (r) => this.roles.set(r ?? []),
      // Not fatal: the rest of the screen works, and the picker being empty is visibly
      // different from it offering a stale list.
      error: () => this.notify.warning(this.translate.instant('CONGES.TYPES.ERR_ROLES')),
    });
  }

  private load(): void {
    this.loading.set(true);
    this.svc.list().subscribe({
      next: (r) => { this.rows.set(r ?? []); this.loading.set(false); },
      error: () => {
        this.loading.set(false);
        this.notify.error(this.translate.instant('CONGES.TYPES.ERR_LOAD'));
      },
    });
  }

  /** A one-line summary of the flags, so the table says what a type does without opening it. */
  private rulesSummary(t: AbsenceTypeRow): string {
    const bits: string[] = [];
    if (t.requiresJustification) bits.push(this.translate.instant('CONGES.TYPES.F_JUSTIF'));
    if (t.maxDays != null)       bits.push(this.translate.instant('CONGES.TYPES.F_MAX', { n: t.maxDays }));
    // Only when the type sets its own value — a null inherits the country's and saying so in
    // a one-line summary would claim a rule this type does not itself define.
    if (t.advanceNoticeDays)     bits.push(this.translate.instant('CONGES.TYPES.F_NOTICE', { n: t.advanceNoticeDays }));
    if (t.leaveGapDays)          bits.push(this.translate.instant('CONGES.TYPES.F_GAP', { n: t.leaveGapDays }));
    if (!t.managerCanView)       bits.push(this.translate.instant('CONGES.TYPES.F_PRIVATE'));
    if (t.includedInHrStats)     bits.push(this.translate.instant('CONGES.TYPES.F_STATS'));
    return bits.length ? bits.join(' · ') : '—';
  }

  // ── Create / edit ─────────────────────────────────────────────────────────

  protected openCreate(): void {
    this.editing.set(null);
    this.reset();
    this.openForm();
  }

  private openEdit(row: AbsenceTypeRow): void {
    this.editing.set(row);
    this.code.set(row.code);
    this.labelFr.set(row.labelFr);
    this.labelEn.set(row.labelEn);
    this.active.set(row.active);
    this.tracksBalance.set(row.tracksBalance);
    this.balanceField.set(row.balanceField);
    this.includedInHrStats.set(row.includedInHrStats);
    this.requiresJustification.set(row.requiresJustification);
    this.maxDays.set(row.maxDays);
    this.advanceNoticeDays.set(row.advanceNoticeDays);
    this.leaveGapDays.set(row.leaveGapDays);
    this.description.set(row.description ?? '');
    this.displayOrder.set(row.displayOrder);
    this.allowedGender.set(row.allowedGender ?? 'ALL');
    this.managerCanView.set(row.managerCanView);
    this.strategy.set(row.approverResolutionStrategy ?? 'TOP_OF_HIERARCHY');
    this.approverRoleIds.set(row.approverRoles.map((r) => String(r.roleId)));
    this.showErrors.set(false);
    this.formError.set(null);
    this.openForm();
  }

  private openForm(): void {
    const isEdit = this.editing() !== null;
    this.modal.open({
      title: this.translate.instant(isEdit ? 'CONGES.TYPES.EDIT_TITLE' : 'CONGES.TYPES.NEW_TITLE'),
      subtitle: isEdit ? this.editing()!.code : this.translate.instant('CONGES.TYPES.NEW_SUB'),
      body: this.formTpl(),
      size: 'lg',
      closeOnBackdrop: false,
      buttons: [
        { label: this.translate.instant('CONGES.CANCEL'), variant: 'secondary', action: (r) => r.close() },
        {
          label: this.translate.instant('CONGES.TYPES.SAVE'),
          variant: 'primary',
          icon: 'save',
          action: (ref) => this.save(ref),
        },
      ],
    });
  }

  /** Switching the toggle off clears the field, so a stale value cannot be resurrected. */
  protected onTracksBalance(on: boolean): void {
    this.tracksBalance.set(on);
    if (!on) this.balanceField.set(null);
  }

  private save(ref: ModalRef): void {
    this.showErrors.set(true);
    this.formError.set(null);

    if (!this.codeValid() || !this.labelFr().trim() || !this.labelEn().trim()) {
      this.formError.set(this.translate.instant('CONGES.TYPES.ERR_REQUIRED'));
      return;
    }
    if (this.tracksBalance() && !this.balanceField()) {
      this.formError.set(this.translate.instant('CONGES.TYPES.BALANCE_REQUIRED'));
      return;
    }

    const dto: AbsenceTypeUpsert = {
      code: this.code().trim(),
      labelFr: this.labelFr().trim(),
      labelEn: this.labelEn().trim(),
      active: this.active(),
      tracksBalance: this.tracksBalance(),
      balanceField: this.tracksBalance() ? this.balanceField() : null,
      includedInHrStats: this.includedInHrStats(),
      requiresJustification: this.requiresJustification(),
      maxDays: this.maxDays(),
      advanceNoticeDays: this.advanceNoticeDays(),
      leaveGapDays: this.leaveGapDays(),
      description: this.description().trim() || null,
      displayOrder: this.displayOrder(),
      allowedGender: this.allowedGender(),
      managerCanView: this.managerCanView(),
      approverResolutionStrategy: this.strategy(),
      // Always sent, so clearing every role clears the restriction. null would mean
      // "leave it alone", which is not what an emptied picker means.
      approverRoleIds: this.approverRoleIds().map((v) => Number(v)),
    };

    const row = this.editing();
    const call = row ? this.svc.update(row.id, dto) : this.svc.create(dto);

    call.subscribe({
      next: () => {
        ref.close();
        this.notify.success(this.translate.instant(
          row ? 'CONGES.TYPES.SAVED' : 'CONGES.TYPES.CREATED', { code: dto.code }));
        this.load();
      },
      // The server names the actual rule — duplicate code, half-set balance pair — and that
      // beats any generic message this component could invent.
      error: (e) => this.formError.set(
        e?.error?.message ?? this.translate.instant('CONGES.TYPES.ERR_SAVE')),
    });
  }

  // ── Activate / retire ─────────────────────────────────────────────────────

  private toggleActive(row: AbsenceTypeRow): void {
    this.svc.setActive(row.id, !row.active).subscribe({
      next: () => {
        this.notify.success(this.translate.instant(
          row.active ? 'CONGES.TYPES.DEACTIVATED' : 'CONGES.TYPES.ACTIVATED', { code: row.code }));
        this.load();
      },
      error: () => this.notify.error(this.translate.instant('CONGES.TYPES.ERR_SAVE')),
    });
  }

  /**
   * Retiring asks the server how many requests use the type first, and says so.
   *
   * Retiring one used by 300 requests and one used by none are very different acts; a
   * confirmation that looks identical for both is not a confirmation.
   */
  private confirmRetire(row: AbsenceTypeRow): void {
    this.svc.usage(row.id).subscribe({
      next: (u) => this.askRetire(row, u.requests),
      // Unknown count: still offer it, but say the count could not be read rather than
      // implying zero.
      error: () => this.askRetire(row, null),
    });
  }

  private askRetire(row: AbsenceTypeRow, used: number | null): void {
    const detail = used === null
      ? this.translate.instant('CONGES.TYPES.RETIRE_UNKNOWN')
      : used === 0
        ? this.translate.instant('CONGES.TYPES.RETIRE_UNUSED')
        : this.translate.instant('CONGES.TYPES.RETIRE_USED', { n: used });

    this.modal.open({
      title: this.translate.instant('CONGES.TYPES.RETIRE_TITLE', { code: row.code }),
      subtitle: detail,
      size: 'sm',
      buttons: [
        { label: this.translate.instant('CONGES.CANCEL'), variant: 'secondary', action: (r) => r.close() },
        {
          label: this.translate.instant('CONGES.TYPES.RETIRE'),
          variant: 'primary',
          action: (ref) => {
            ref.close();
            this.svc.retire(row.id).subscribe({
              next: () => {
                this.notify.success(this.translate.instant('CONGES.TYPES.RETIRED', { code: row.code }));
                this.load();
              },
              error: () => this.notify.error(this.translate.instant('CONGES.TYPES.ERR_SAVE')),
            });
          },
        },
      ],
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private reset(): void {
    this.code.set('');
    this.labelFr.set('');
    this.labelEn.set('');
    this.active.set(true);
    this.tracksBalance.set(false);
    this.balanceField.set(null);
    this.includedInHrStats.set(false);
    this.requiresJustification.set(false);
    this.maxDays.set(null);
    this.advanceNoticeDays.set(null);
    this.leaveGapDays.set(null);
    this.description.set('');
    // Next in sequence, so a new type lands at the end of the dropdown rather than
    // silently jumping to the front by sharing order 0 with CONGE.
    this.displayOrder.set(this.rows().reduce((m, t) => Math.max(m, t.displayOrder), -1) + 1);
    this.allowedGender.set('ALL');
    this.managerCanView.set(true);
    this.strategy.set('TOP_OF_HIERARCHY');
    this.approverRoleIds.set([]);
    this.showErrors.set(false);
    this.formError.set(null);
  }

  protected sel(v: string | null): string[] { return v == null ? [] : [v]; }
  protected str(v: unknown): string | null { return v == null || v === '' ? null : String(v); }
  protected num(v: unknown): number | null {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
}
