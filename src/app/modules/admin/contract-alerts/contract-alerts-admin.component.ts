import { Component, Input, OnChanges, TemplateRef, computed, inject, signal, viewChild } from '@angular/core';
import {
  ButtonComponent, FormFieldComponent, StatusBadgeComponent,
  DataTableComponent, DafCellDirective, TableColumn, TableConfig, TableRow,
  ModalService, ModalRef,
} from '@khalilrebhiitec/daf360';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { UserStore } from '../../../core/user.store';
import {
  AlertRunSummary, ContractAlertsService, ContractTypeConfig, LeadTimes,
} from './contract-alerts.service';

/**
 * The lifecycle contract types (employee_contracts.contract_type_code). A type with no row
 * for the entity is still listed, so the admin can see it is unconfigured and create it:
 * only pays_id = 1 was ever seeded, and the alert job falls back to defaults without one.
 */
const LIFECYCLE_TYPES = ['CDI', 'CDD', 'CIVP', 'STAGE', 'FREELANCE', 'DETACHEMENT'];

/** Same bounds as the backend (LifecycleAlertJob.MAX_LEAD_DAYS). */
const MAX_LEAD_DAYS = 365;

/** Shown for a missing row — the job's own fallbacks, so the screen tells the truth. */
const DEFAULT_LEAD: LeadTimes = { alertDaysBeforeExpiry: 30, alertDaysBeforeTrialEnd: 15 };

interface Line {
  code: string;
  config: ContractTypeConfig | null;
}

/**
 * Administration › Échéances de contrat — how many days before a contract end and before a
 * trial-period end HR is notified, per entity and contract type.
 *
 * Who is notified, and with what wording, is the CONTRACT_EXPIRY / TRIAL_PERIOD_END rules'
 * business in Administration › Notifications; this screen only owns the WHEN.
 */
@Component({
  selector: 'app-contract-alerts-admin',
  standalone: true,
  imports: [
    ButtonComponent, FormFieldComponent, StatusBadgeComponent,
    DataTableComponent, DafCellDirective, TranslatePipe,
  ],
  template: `
    <div class="caa-wrap">
      <div class="caa-header">
        <div>
          <h2 class="caa-title">{{ 'ADMIN.contractAlerts.title' | translate }}</h2>
          <p class="caa-sub">{{ 'ADMIN.contractAlerts.subtitle' | translate }}</p>
        </div>
        @if (canRunNow()) {
          <daf-button
            [label]="'ADMIN.contractAlerts.runNow' | translate"
            variant="secondary"
            [options]="{ iconStart: 'play_arrow', loading: running(), disabled: running() }"
            (onClick)="runNow()" />
        }
      </div>

      @if (error()) {
        <div class="caa-error">{{ error() }}</div>
      }
      @if (runResult(); as r) {
        <div class="caa-info">
          @if (r.ran) {
            {{ 'ADMIN.contractAlerts.runResult' | translate:{ due: r.due, sent: r.sent, pending: r.pending } }}
          } @else {
            {{ 'ADMIN.contractAlerts.runBusy' | translate }}
          }
        </div>
      }

      <ng-template #bodyTpl>
        <p class="caa-modal-type">{{ editing()?.code }}</p>
        <div class="caa-form-grid">
          <daf-form-field
            [options]="{ label: ('ADMIN.contractAlerts.expiryLabel' | translate), type: 'number', fullWidth: true, hint: ('ADMIN.contractAlerts.expiryHint' | translate) }"
            [value]="form.alertDaysBeforeExpiry"
            (valueChange)="form.alertDaysBeforeExpiry = toDays($event)" />
          <daf-form-field
            [options]="{ label: ('ADMIN.contractAlerts.trialLabel' | translate), type: 'number', fullWidth: true, hint: ('ADMIN.contractAlerts.trialHint' | translate) }"
            [value]="form.alertDaysBeforeTrialEnd"
            (valueChange)="form.alertDaysBeforeTrialEnd = toDays($event)" />
        </div>
        @if (modalError()) {
          <p class="caa-field-error">{{ modalError() }}</p>
        }
        <div class="caa-modal-footer">
          <daf-button [label]="'ADMIN.contractAlerts.cancel' | translate" variant="secondary" (onClick)="modalRef?.close()" />
          <daf-button
            [label]="(saving() ? 'ADMIN.contractAlerts.saving' : 'ADMIN.contractAlerts.save') | translate"
            variant="teal"
            [options]="{ disabled: saving() || !formValid(), loading: saving() }"
            (onClick)="save()" />
        </div>
      </ng-template>

      <div class="table-scroll">
        <daf-data-table [columns]="columns()" [rows]="rows()" [config]="tableConfig()">
          <ng-template dafCell="code" let-row>
            <span class="caa-code">{{ row['code'] }}</span>
          </ng-template>
          <ng-template dafCell="expiry" let-row>
            {{ 'ADMIN.contractAlerts.days' | translate:{ n: row['expiry'] } }}
          </ng-template>
          <ng-template dafCell="trial" let-row>
            {{ 'ADMIN.contractAlerts.days' | translate:{ n: row['trial'] } }}
          </ng-template>
          <ng-template dafCell="status" let-row>
            <daf-badge
              [label]="(row['configured'] ? 'ADMIN.contractAlerts.configured' : 'ADMIN.contractAlerts.defaults') | translate"
              [options]="{ variant: row['configured'] ? 'success' : 'warning', size: 'sm' }" />
          </ng-template>
        </daf-data-table>
      </div>
      <p class="caa-note">{{ 'ADMIN.contractAlerts.note' | translate }}</p>
    </div>
  `,
  styles: [`
    .caa-wrap   { width:100% }
    .caa-header { display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:20px }
    .caa-title  { font-size:var(--text-headline-md);font-weight:600;color:var(--color-on-surface);margin:0 }
    .caa-sub    { font-size:var(--text-body-sm);color:var(--color-on-surface-variant);margin:3px 0 0;max-width:70ch }
    .caa-error  { background:var(--color-error-container);border-radius:8px;padding:10px 14px;font-size:var(--text-body-sm);color:var(--color-on-error-container);margin-bottom:14px }
    .caa-info   { background:var(--color-surface-container);border-radius:8px;padding:10px 14px;font-size:var(--text-body-sm);color:var(--color-on-surface);margin-bottom:14px }
    .caa-code   { font-weight:600;color:var(--color-on-surface) }
    .caa-note   { font-size:var(--text-body-sm);color:var(--color-on-surface-variant);margin:12px 0 0 }
    .caa-modal-type { font-weight:600;margin:0 0 12px }
    .caa-form-grid  { display:grid;grid-template-columns:1fr 1fr;gap:12px }
    .caa-field-error { font-size:var(--text-body-sm);color:var(--color-danger);margin:8px 0 0 }
    .caa-modal-footer { display:flex;justify-content:flex-end;gap:12px;margin-top:16px;padding-top:16px;border-top:1px solid var(--color-outline-variant) }
    .table-scroll { overflow-x:auto }
    @media (max-width: 480px) { .caa-form-grid { grid-template-columns:1fr } }
  `],
})
export class ContractAlertsAdminComponent implements OnChanges {
  @Input() paysId!: number;

  private svc       = inject(ContractAlertsService);
  private translate = inject(TranslateService);
  private modal     = inject(ModalService);
  private userStore = inject(UserStore);
  modalRef?: ModalRef;
  bodyTpl = viewChild.required<TemplateRef<unknown>>('bodyTpl');

  configs    = signal<ContractTypeConfig[]>([]);
  loading    = signal(false);
  error      = signal<string | null>(null);
  editing    = signal<Line | null>(null);
  saving     = signal(false);
  modalError = signal<string | null>(null);
  running    = signal(false);
  runResult  = signal<AlertRunSummary | null>(null);

  form: LeadTimes = { ...DEFAULT_LEAD };

  /** The manual trigger needs the same permission as the backend endpoint. */
  canRunNow = computed(() => this.userStore.hasPermission('RH_MANAGE_ALERTS') || this.userStore.isAdmin());

  /** Every lifecycle type, plus any extra code configured for this entity. */
  readonly lines = computed<Line[]>(() => {
    const byCode = new Map(this.configs().map(c => [c.contractTypeCode, c]));
    const codes = [...new Set([...LIFECYCLE_TYPES, ...byCode.keys()])];
    return codes.map(code => ({ code, config: byCode.get(code) ?? null }));
  });

  readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    return [
      { key: 'code',   label: t('ADMIN.contractAlerts.colType'),   width: '140px' },
      { key: 'expiry', label: t('ADMIN.contractAlerts.colExpiry'), align: 'center' },
      { key: 'trial',  label: t('ADMIN.contractAlerts.colTrial'),  align: 'center' },
      { key: 'status', label: t('ADMIN.contractAlerts.colStatus'), align: 'center', width: '150px' },
    ];
  });

  readonly tableConfig = computed<TableConfig>(() => {
    this.translate.currentLang();
    return {
      showHeader: false,
      hoverable: true,
      loading: this.loading(),
      emptyMessage: this.translate.instant('ADMIN.contractAlerts.empty'),
      rowId: (row: TableRow) => row['code'] as string,
      actions: [
        {
          id: 'edit', icon: 'edit',
          tooltip: this.translate.instant('ADMIN.contractAlerts.edit'),
          onClick: (row: TableRow) => this.openEdit(row['_source'] as Line),
        },
      ],
    };
  });

  readonly rows = computed<TableRow[]>(() =>
    this.lines().map(l => ({
      code:       l.code,
      expiry:     l.config?.alertDaysBeforeExpiry   ?? DEFAULT_LEAD.alertDaysBeforeExpiry,
      trial:      l.config?.alertDaysBeforeTrialEnd ?? DEFAULT_LEAD.alertDaysBeforeTrialEnd,
      configured: l.config !== null,
      _source:    l,
    })),
  );

  ngOnChanges(): void { this.load(); }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.list(this.paysId).subscribe({
      next:  list => { this.configs.set(list); this.loading.set(false); },
      error: ()   => { this.error.set(this.translate.instant('ADMIN.contractAlerts.loadError')); this.loading.set(false); },
    });
  }

  toDays(v: unknown): number {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : NaN;
  }

  formValid(): boolean {
    const ok = (n: number) => Number.isInteger(n) && n >= 0 && n <= MAX_LEAD_DAYS;
    return ok(this.form.alertDaysBeforeExpiry) && ok(this.form.alertDaysBeforeTrialEnd);
  }

  openEdit(line: Line): void {
    this.editing.set(line);
    this.form = {
      alertDaysBeforeExpiry:   line.config?.alertDaysBeforeExpiry   ?? DEFAULT_LEAD.alertDaysBeforeExpiry,
      alertDaysBeforeTrialEnd: line.config?.alertDaysBeforeTrialEnd ?? DEFAULT_LEAD.alertDaysBeforeTrialEnd,
    };
    this.modalError.set(null);
    this.modalRef = this.modal.open({
      title: this.translate.instant('ADMIN.contractAlerts.editTitle'),
      body: this.bodyTpl(),
      closeOnBackdrop: false,
    });
  }

  save(): void {
    const line = this.editing();
    if (!line) return;
    if (!this.formValid()) {
      this.modalError.set(this.translate.instant('ADMIN.contractAlerts.invalid', { max: MAX_LEAD_DAYS }));
      return;
    }
    this.saving.set(true);
    this.modalError.set(null);
    const lead = { ...this.form };
    const call = line.config
      ? this.svc.update(line.config.id, lead)
      : this.svc.create(this.paysId, line.code, lead);
    call.subscribe({
      next: saved => {
        this.configs.update(list => [...list.filter(c => c.contractTypeCode !== saved.contractTypeCode), saved]);
        this.saving.set(false);
        this.modalRef?.close();
      },
      error: err => {
        this.saving.set(false);
        this.modalError.set(err?.error?.detail ?? err?.error?.message
          ?? this.translate.instant('ADMIN.contractAlerts.saveError'));
      },
    });
  }

  runNow(): void {
    this.running.set(true);
    this.runResult.set(null);
    this.error.set(null);
    this.svc.runNow().subscribe({
      next:  r  => { this.runResult.set(r); this.running.set(false); },
      error: () => { this.error.set(this.translate.instant('ADMIN.contractAlerts.runError')); this.running.set(false); },
    });
  }
}
