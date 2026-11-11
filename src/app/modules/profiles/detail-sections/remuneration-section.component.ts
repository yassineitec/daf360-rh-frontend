import {
  ChangeDetectionStrategy, Component, DestroyRef, TemplateRef, computed, inject, input, OnInit, signal, viewChild,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  ButtonComponent, CheckboxComponent, DataTableComponent, FormFieldComponent, MetricCardComponent,
  ModalService, MultiDatePickerComponent, SearchToolbarComponent, SectionCardComponent, SectionTitleComponent,
  SelectComponent, StatusBadgeComponent,
  type ModalRef, type SelectOption, type TableColumn, type TableConfig, type TableRow,
} from '@khalilrebhiitec/daf360';

import { UserStore } from '../../../core/user.store';
import { dateToIso, isoToDate } from '../../../shared/date-picker.utils';
import { EmployeeProfile } from '../models/profile.model';
import { contractLabel } from '../profile-labels';
import {
  BenefitCatalogueDto, BenefitSnapshotDto, EmployeePayrollBonusDto, EmployeePayrollConfigDto, EmployeePayrollConfigHistoryDto,
  FxRateDto, MEAL_BENEFIT_CODE, RemunerationBreakdown, SalaryChangeDto, RemunerationService, RemunerationSimulationDto, payrollContractCode, toEditableConfig,
} from '../services/remuneration.service';

/** What the « Nouvelle rémunération » pop-up edits. */
interface RemunerationDraft {
  effectiveDate: string;          // yyyy-MM-dd
  contractType: string;
  gross: number | null;           // as typed, in `currency`
  currency: string;               // the working currency, or the one it was typed in
  net: number | null;             // engine net, working currency
  benefitCodes: string[];
  reason: string;
}

interface BonusDraft {
  amount: number | null;
  currency: string;
  month: number;
  year: number | null;
  label: string;
  comment: string;
}

/** Edit permission on the payroll configuration (payroll-service checks it again). */
const MANAGE_PERMISSION = 'PAYROLL_MANAGE_EMPLOYEE_CONFIG';

/**
 * « Rémunération » tab of the employee profile — owned by daf360-payroll-service, not by this
 * page's ProfileUpdateDto: its own loads, its own saves.
 *
 * Three sections, lib components only:
 *  1. Rémunération actuelle — base salary (gross) and engine net, this month's exceptional
 *     bonuses, benefits-in-kind with their monthly value, contract, effective date, family.
 *  2. Historique des modifications — every salary change with the values it replaced, who
 *     saved it, the reason, the effective date, meal tickets and other benefits as priced
 *     that day (payroll V37 snapshot; older rows show the codes only).
 *  3. Primes exceptionnelles — label, comment, month/year, amount and currency.
 *
 * « Nouvelle rémunération » and « Ajouter une prime » open resizable lib modals. Saving goes
 * through the same payroll endpoints as before: the server recomputes the net with the real
 * engine, mirrors it into salaire_net_rh, and keeps the gross as typed (no double conversion).
 * The effective date is informational: payroll runs keep using the latest saved salary.
 */
@Component({
  selector: 'rh-remuneration-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonComponent, CheckboxComponent, DataTableComponent, FormFieldComponent, MetricCardComponent,
    MultiDatePickerComponent, SearchToolbarComponent, SectionCardComponent, SectionTitleComponent,
    SelectComponent, StatusBadgeComponent, TranslatePipe,
  ],
  host: { class: 'block' },
  templateUrl: './remuneration-section.component.html',
})
export class RemunerationSectionComponent implements OnInit {
  private svc = inject(RemunerationService);
  private translate = inject(TranslateService);
  private modal = inject(ModalService);
  private userStore = inject(UserStore);
  private destroyRef = inject(DestroyRef);

  readonly profile = input.required<EmployeeProfile>();
  /** Contract type label from Admin › Listes configurables › CONTRACT_TYPE, resolved by the page. */
  readonly contractLabel = input<string | null>(null);

  private readonly formTpl = viewChild.required<TemplateRef<unknown>>('remunerationFormTpl');
  private readonly bonusTpl = viewChild.required<TemplateRef<unknown>>('bonusFormTpl');

  // ── Loaded data ────────────────────────────────────────────────────────────
  readonly config   = signal<EmployeePayrollConfigDto | null>(null);
  readonly history  = signal<EmployeePayrollConfigHistoryDto[]>([]);
  readonly bonuses  = signal<EmployeePayrollBonusDto[]>([]);
  readonly benefits = signal<BenefitCatalogueDto[]>([]);
  readonly pricedContracts = signal<string[]>([]);
  readonly fxRates  = signal<FxRateDto[]>([]);

  readonly loading        = signal(true);
  readonly historyLoading = signal(true);
  readonly bonusesLoading = signal(true);
  readonly loadError      = signal<string | null>(null);
  readonly historySearch  = signal('');
  readonly bonusSearch    = signal('');

  readonly canManage = computed(() => this.userStore.hasPermission(MANAGE_PERMISSION) || this.userStore.isAdmin());

  // ── Shared helpers ─────────────────────────────────────────────────────────
  private readonly locale = computed(() => (this.translate.currentLang() === 'en' ? 'en-GB' : 'fr-FR'));

  /** Working currency first, then every currency payroll has a rate for. */
  readonly currencyOptions = computed<SelectOption[]>(() => {
    const working = this.config()?.workingCurrency ?? null;
    const others = this.fxRates().map(r => r.currencyCode).filter(c => c !== working).sort();
    return [working, ...others].filter((c): c is string => !!c).map(c => ({ value: c, label: c }));
  });

  readonly monthOptions = computed<SelectOption[]>(() => {
    const fmt = new Intl.DateTimeFormat(this.locale(), { month: 'long' });
    return Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: fmt.format(new Date(2000, i, 1)) }));
  });

  money(value: number | null | undefined, currency: string | null | undefined, digits = 2): string {
    if (value == null) return '—';
    const n = new Intl.NumberFormat(this.locale(), { minimumFractionDigits: 0, maximumFractionDigits: digits }).format(value);
    return currency ? n + ' ' + currency : n;
  }

  date(iso: string | null | undefined): string {
    const d = isoToDate(iso);
    return d ? new Intl.DateTimeFormat(this.locale(), { dateStyle: 'medium' }).format(d) : '—';
  }

  benefitLabel(b: { benefitLabelFr?: string | null; benefitLabelEn?: string | null; labelFr?: string | null; labelEn?: string | null; benefitCode?: string; code?: string }): string {
    const en = this.translate.currentLang() === 'en';
    const fr = b.benefitLabelFr ?? b.labelFr ?? null;
    const eng = b.benefitLabelEn ?? b.labelEn ?? null;
    if (en && eng) return eng;
    if (fr) return fr;
    // Pre-V37 history row: label from today's catalogue, else the code.
    const code = b.benefitCode ?? b.code ?? '';
    const known = this.benefits().find(x => x.benefitCode === code);
    return known ? (en && known.benefitLabelEn ? known.benefitLabelEn : known.benefitLabelFr) : code;
  }

  contractText(code: string | null | undefined): string {
    if (!code) return '—';
    const hr = payrollContractCode(this.profile().contractType);
    return payrollContractCode(code) === hr && this.contractLabel()
      ? this.contractLabel()!
      : contractLabel(code, this.translate);
  }

  // ── 1. Rémunération actuelle ───────────────────────────────────────────────
  readonly workingCurrency = computed(() => this.config()?.workingCurrency ?? null);
  readonly saved = computed(() => this.config()?.updatedAt != null);

  /** Selected benefits priced from the country's ACTIVE rules. */
  readonly currentBenefits = computed(() => {
    const cfg = this.config();
    if (!cfg) return [];
    return cfg.selectedBenefitCodes.map(code => {
      const b = this.benefits().find(x => x.benefitCode === code);
      return {
        code,
        label: b ? this.benefitLabel(b) : code,
        value: b?.monthlyValue ?? null,
        taxable: b?.isTaxable ?? null,
        meal: code === MEAL_BENEFIT_CODE,
      };
    });
  });

  readonly benefitsTotal = computed(() =>
    this.currentBenefits().reduce((sum, b) => sum + (b.value ?? 0), 0));

  /** This month's exceptional bonuses. */
  readonly monthBonuses = computed(() => {
    const now = new Date();
    return this.bonuses().filter(b => b.periodYear === now.getFullYear() && b.periodMonth === now.getMonth() + 1);
  });

  /** « 500 TND + 100 EUR » — bonuses may be in several currencies, never summed across them. */
  readonly monthBonusesText = computed(() => {
    const byCurrency = new Map<string, number>();
    for (const b of this.monthBonuses()) byCurrency.set(b.currency, (byCurrency.get(b.currency) ?? 0) + b.amount);
    if (!byCurrency.size) return this.money(0, this.workingCurrency());
    return [...byCurrency.entries()].map(([c, v]) => this.money(v, c)).join(' + ');
  });

  readonly grossText = computed(() => {
    const cfg = this.config();
    return cfg ? this.money(cfg.currentGrossSalary, cfg.workingCurrency) : '—';
  });
  readonly netText = computed(() => {
    const cfg = this.config();
    return cfg ? this.money(cfg.currentNetSalary, cfg.workingCurrency, 0) : '—';
  });
  /** « Saisi en 1 000 EUR » under the gross, when it was typed in another currency. */
  readonly enteredAsText = computed(() => {
    const cfg = this.config();
    return cfg?.inputCurrency && cfg.inputAmountOriginal != null
      ? this.translate.instant('PROFILES.REMUNERATION_TAB.ENTERED_AS', { amount: this.money(cfg.inputAmountOriginal, cfg.inputCurrency) })
      : null;
  });
  readonly effectiveDateText = computed(() => {
    const cfg = this.config();
    if (!cfg?.updatedAt) return '—';
    return this.date(cfg.effectiveDate ?? cfg.updatedAt);
  });
  readonly familyText = computed(() => {
    const cfg = this.config();
    if (!cfg) return '—';
    return this.translate.instant('PROFILES.REMUNERATION_TAB.FAMILY_VALUE', {
      married: this.translate.instant(cfg.isMarried ? 'PROFILES.REMUNERATION_TAB.MARRIED' : 'PROFILES.REMUNERATION_TAB.NOT_MARRIED'),
      children: cfg.childrenCount ?? 0,
    });
  });

  // ── 2. Historique des modifications ────────────────────────────────────────
  readonly historyColumns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant('PROFILES.REMUNERATION_TAB.COL.' + k);
    const amount = { maximumFractionDigits: 3, locale: this.locale() };
    return [
      { key: 'effectiveDate', label: t('EFFECTIVE_DATE'), type: 'date', sortable: true, format: { locale: this.locale(), dateStyle: 'medium' } },
      { key: 'previousGross', label: t('PREVIOUS_GROSS'), type: 'number', sortable: true, format: amount },
      { key: 'previousNet',   label: t('PREVIOUS_NET'),   type: 'number', sortable: true, format: amount },
      { key: 'gross',         label: t('NEW_GROSS'),      type: 'number', sortable: true, format: amount },
      { key: 'net',           label: t('NEW_NET'),        type: 'number', sortable: true, format: amount },
      { key: 'currency',      label: t('CURRENCY') },
      { key: 'enteredAs',     label: t('ENTERED_AS') },
      { key: 'contract',      label: t('CONTRACT'),       sortable: true },
      { key: 'mealTickets',   label: t('MEAL_TICKETS'),   type: 'number', format: amount },
      { key: 'otherBenefits', label: t('OTHER_BENEFITS') },
      { key: 'reason',        label: t('REASON') },
      { key: 'changedByName', label: t('CHANGED_BY'),     sortable: true },
      { key: 'approvedByName', label: t('APPROVED_BY'),   sortable: true },
      { key: 'changedAt',     label: t('CHANGED_AT'),     type: 'date', sortable: true, format: { locale: this.locale(), dateStyle: 'short', timeStyle: 'short' } },
    ];
  });

  private readonly historyRows = computed<TableRow[]>(() => {
    this.translate.currentLang();
    return this.history().map(h => {
      // An older payroll-service (before V37) sends no "benefits": fall back to the codes.
      const benefits: BenefitSnapshotDto[] = h.benefits
        ?? (h.selectedBenefitCodes ?? []).map(code => ({ code, labelFr: null, labelEn: null, monthlyValue: null, taxable: null }));
      const meal = benefits.find(b => b.code === MEAL_BENEFIT_CODE);
      const others = benefits.filter(b => b.code !== MEAL_BENEFIT_CODE)
        .map(b => b.monthlyValue != null ? this.benefitLabel(b) + ' (' + this.money(b.monthlyValue, null) + ')' : this.benefitLabel(b));
      return {
        id: h.id,
        effectiveDate: h.effectiveDate ?? h.changedAt,
        previousGross: h.previousGrossSalary,
        previousNet: h.previousNetSalary,
        gross: h.currentGrossSalary,
        net: h.currentNetSalary,
        currency: h.workingCurrency ?? this.workingCurrency() ?? '—',
        enteredAs: h.inputCurrency && h.inputAmountOriginal != null ? this.money(h.inputAmountOriginal, h.inputCurrency) : '—',
        contract: this.contractText(h.contractType),
        // Selected without a recorded value (pre-V37 row) → shown as selected, amount unknown.
        mealTickets: meal ? meal.monthlyValue : null,
        otherBenefits: others.length ? others.join(', ') : '—',
        reason: h.reason,
        changedByName: h.changedByName ?? this.translate.instant('PROFILES.REMUNERATION_TAB.UNKNOWN_USER', { id: h.changedBy }),
        approvedByName: h.approvedBy == null
          ? this.translate.instant('PROFILES.REMUNERATION_TAB.DIRECT_SAVE')
          : (h.approvedByName ?? this.translate.instant('PROFILES.REMUNERATION_TAB.UNKNOWN_USER', { id: h.approvedBy })),
        changedAt: h.changedAt,
      };
    });
  });

  readonly historyView = computed(() => filterRows(this.historyRows(), this.historySearch()));

  readonly historyTableConfig = computed<TableConfig>(() => ({
    loading: this.historyLoading(),
    emptyMessage: this.translate.instant('PROFILES.REMUNERATION_TAB.HISTORY_EMPTY'),
    columnPicker: true,
    columnPickerLabel: this.translate.instant('PROFILES.REMUNERATION_TAB.COLUMNS'),
    resizableColumns: true,
    stickyHeader: true,
    maxHeight: '60vh',
    defaultSort: { key: 'changedAt', dir: 'desc' },
  }));

  // ── 3. Primes exceptionnelles ──────────────────────────────────────────────
  readonly bonusColumns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant('PROFILES.REMUNERATION_TAB.COL.' + k);
    return [
      { key: 'period',  label: t('PERIOD'), sortable: true, sortAccessor: r => r['periodSort'] },
      { key: 'label',   label: t('LABEL'), sortable: true },
      { key: 'comment', label: t('COMMENT') },
      { key: 'amount',  label: t('AMOUNT'), type: 'number', sortable: true, format: { maximumFractionDigits: 3, locale: this.locale() } },
      { key: 'currency', label: t('CURRENCY'), sortable: true },
      { key: 'createdAt', label: t('RECORDED_AT'), type: 'date', sortable: true, format: { locale: this.locale(), dateStyle: 'medium' } },
    ];
  });

  private readonly bonusRows = computed<TableRow[]>(() => {
    const fmt = new Intl.DateTimeFormat(this.locale(), { month: 'long', year: 'numeric' });
    return this.bonuses().map(b => ({
      id: b.id,
      period: fmt.format(new Date(b.periodYear, b.periodMonth - 1, 1)),
      periodSort: b.periodYear * 100 + b.periodMonth,
      label: b.label,
      comment: b.comment ?? '—',
      amount: b.amount,
      currency: b.currency,
      createdAt: b.createdAt,
    }));
  });

  readonly bonusView = computed(() => filterRows(this.bonusRows(), this.bonusSearch()));

  readonly bonusTableConfig = computed<TableConfig>(() => ({
    loading: this.bonusesLoading(),
    emptyMessage: this.translate.instant('PROFILES.REMUNERATION_TAB.BONUSES_EMPTY'),
    defaultSort: { key: 'period', dir: 'desc' },
    actions: this.canManage() ? [{
      id: 'delete',
      icon: 'delete',
      variant: 'danger',
      tooltip: this.translate.instant('PROFILES.REMUNERATION_TAB.DELETE_BONUS'),
      onClick: (row: TableRow) => this.confirmDeleteBonus(row['id'] as number, row['label'] as string),
    }] : [],
  }));

  // ── Load ───────────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.destroyRef.onDestroy(() => { if (this.netTimer) clearTimeout(this.netTimer); });
    this.loadConfig();
    this.loadHistory();
    this.loadBonuses();
    this.loadSalaryChanges();
    this.svc.getFxRates().subscribe({
      next: rates => this.fxRates.set(rates),
      error: () => { /* the currency pickers just offer the working currency */ },
    });
  }

  private loadConfig(): void {
    this.svc.get(this.profile().userId).subscribe({
      next: raw => {
        // A never-configured employee may come back without a country (payroll could not
        // read RH): this page already has it. Contract: the SAVED payroll one once a
        // configuration exists; the HR one only to seed a first configuration.
        const cfg: EmployeePayrollConfigDto = {
          ...raw,
          paysId: raw.paysId ?? this.profile().paysId,
          contractType: raw.updatedAt != null
            ? raw.contractType
            : (payrollContractCode(this.profile().contractType) ?? raw.contractType),
        };
        this.config.set(cfg);
        this.loading.set(false);
        if (cfg.paysId != null) {
          this.svc.getActiveRules(cfg.paysId).subscribe({
            next: rules => {
              this.benefits.set(rules.benefits ?? []);
              this.pricedContracts.set([...new Set((rules.socialChargeRates ?? [])
                .map(r => payrollContractCode(r.contractType))
                .filter((c): c is string => !!c))]);
            },
            error: () => { this.benefits.set([]); this.pricedContracts.set([]); },
          });
        }
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(this.translate.instant('PROFILES.REMUNERATION_TAB.LOAD_ERROR'));
      },
    });
  }

  private loadHistory(): void {
    this.historyLoading.set(true);
    this.svc.getHistory(this.profile().userId).subscribe({
      next: list => { this.history.set(list); this.historyLoading.set(false); },
      error: () => { this.history.set([]); this.historyLoading.set(false); },
    });
  }

  // ── Salary change requests (payroll V38) ───────────────────────────────────
  readonly salaryChanges = signal<SalaryChangeDto[]>([]);
  /** Success message after a submission / a withdrawal. */
  readonly notice = signal<string | null>(null);

  /** The request waiting for the country director, if any (one per employee). */
  readonly pendingChange = computed(() => this.salaryChanges().find(c => c.status === 'PENDING') ?? null);

  /** The latest request when it was rejected — RH sees why, until it submits again. */
  readonly lastRejected = computed(() => {
    const latest = this.salaryChanges()[0];
    return latest && latest.status === 'REJECTED' ? latest : null;
  });

  private loadSalaryChanges(): void {
    this.svc.getSalaryChanges(this.profile().userId).subscribe({
      next: list => {
        const before = this.pendingChange();
        this.salaryChanges.set(list);
        // Approved meanwhile: the configuration and history changed too.
        if (before && !list.some(c => c.id === before.id && c.status === 'PENDING')) {
          this.loadConfig();
          this.loadHistory();
        }
      },
      error: () => this.salaryChanges.set([]),
    });
  }

  confirmCancelChange(): void {
    const pending = this.pendingChange();
    if (!pending) return;
    this.modal.open({
      title: this.translate.instant('PROFILES.REMUNERATION_TAB.CANCEL_REQUEST'),
      body: this.translate.instant('PROFILES.REMUNERATION_TAB.CANCEL_REQUEST_CONFIRM'),
      size: 'sm',
      buttons: [
        { label: this.translate.instant('PROFILES.COMMON.CANCEL'), variant: 'secondary', action: ref => ref.close() },
        {
          label: this.translate.instant('PROFILES.REMUNERATION_TAB.CANCEL_REQUEST'),
          variant: 'primary',
          action: ref => this.svc.cancelSalaryChange(pending.id).subscribe({
            next: () => {
              this.notice.set(this.translate.instant('PROFILES.REMUNERATION_TAB.CANCELLED'));
              this.loadSalaryChanges();
              ref.close();
            },
            error: err => { this.loadError.set(serverMessage(err)); ref.close(); },
          }),
        },
      ],
    });
  }

  private loadBonuses(): void {
    this.bonusesLoading.set(true);
    this.svc.getBonuses(this.profile().userId).subscribe({
      next: list => { this.bonuses.set(list); this.bonusesLoading.set(false); },
      error: () => { this.bonuses.set([]); this.bonusesLoading.set(false); },
    });
  }

  // ── « Nouvelle rémunération » pop-up ───────────────────────────────────────
  readonly draft = signal<RemunerationDraft | null>(null);
  readonly draftError = signal<string | null>(null);
  readonly reasonError = signal('');
  readonly calculatingNet = signal(false);
  readonly saving = signal(false);
  private netTimer: ReturnType<typeof setTimeout> | null = null;

  readonly contractOptions = computed<SelectOption[]>(() => {
    this.translate.currentLang();
    const current = this.draft()?.contractType;
    const codes = [...this.pricedContracts()];
    // Keep the employee's current contract selectable even if the rules no longer price it.
    if (current && !codes.includes(current)) codes.push(current);
    return codes.map(c => ({ value: c, label: this.contractText(c) }));
  });

  readonly contractUnpriced = computed(() => {
    const c = this.draft()?.contractType;
    return !!c && this.pricedContracts().length > 0 && !this.pricedContracts().includes(c);
  });

  /** « Brut actuel 2 500 TND → nouveau 2 800 TND (+12 %) » — base salaries in the working
   *  currency (the simulation's base is the typed gross, converted). */
  readonly changeSummary = computed(() => {
    const cfg = this.config(), sim = this.simulation();
    const before = cfg?.currentGrossSalary;
    if (!before || !sim) return null;
    const after = sim.monthly.baseSalary;
    const pct = ((after - before) / before) * 100;
    return this.translate.instant('PROFILES.REMUNERATION_TAB.CHANGE_SUMMARY', {
      before: this.money(before, sim.currency),
      after: this.money(after, sim.currency),
      pct: (pct >= 0 ? '+' : '') + new Intl.NumberFormat(this.locale(), { maximumFractionDigits: 1 }).format(pct),
    });
  });

  // ── Simulation (payroll simulation engine) ─────────────────────────────────
  /** Last simulation of the form; null until the first answer / when the gross is empty. */
  readonly simulation = signal<RemunerationSimulationDto | null>(null);
  private simSeq = 0;

  readonly simulationColumns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    const sim = this.simulation();
    const t = (k: string, p?: object) => this.translate.instant('PROFILES.REMUNERATION_TAB.SIM.' + k, p);
    const amount = { maximumFractionDigits: 3, locale: this.locale() };
    const cols: TableColumn[] = [
      { key: 'label', label: t('ITEM') },
      { key: 'monthly', label: t('MONTHLY', { currency: sim?.currency ?? '' }), type: 'number', align: 'right', format: amount },
    ];
    if (sim?.withBonuses) {
      const month = new Intl.DateTimeFormat(this.locale(), { month: 'long', year: 'numeric' })
        .format(new Date(sim.periodYear, sim.periodMonth - 1, 1));
      cols.push({ key: 'withBonuses', label: t('WITH_BONUSES', { month }), type: 'number', align: 'right', format: amount });
    }
    cols.push({ key: 'note', label: t('HOW') });
    return cols;
  });

  /** Gross → net, line by line, showing where each benefit and bonus enters. */
  readonly simulationRows = computed<TableRow[]>(() => {
    this.translate.currentLang();
    const sim = this.simulation();
    if (!sim) return [];
    const m = sim.monthly, b = sim.withBonuses;
    const t = (k: string, p?: object) => this.translate.instant('PROFILES.REMUNERATION_TAB.SIM.' + k, p);
    const rows: TableRow[] = [];
    let i = 0;
    const add = (label: string, monthly: number | null, withBonuses: number | null, note = '') =>
      rows.push({ id: i++, label, monthly, withBonuses, note });

    add(t('BASE'), m.baseSalary, b?.baseSalary ?? null);
    for (const x of sim.bonuses) {
      const typed = x.bonusCurrency !== sim.currency ? ' (' + this.money(x.amount, x.bonusCurrency) + ')' : '';
      add('+ ' + x.label + typed, null, x.amountInCurrency, t('NOTE_BONUS'));
    }
    add('= ' + t('GROSS'), m.gross, b?.gross ?? null);
    // Intermediate lines are DERIVED from the engine's totals so every "=" line is exactly the
    // engine's figure: contributions = gross + taxable benefits − taxable base; the remainder
    // between the taxable base and the net (CSS-type contributions on the IRPP base, the
    // country's own rubriques) is shown as one signed line, only when it is not zero.
    const charges = (x: RemunerationBreakdown) => x.gross + x.taxableBenefits - x.taxableBase;
    add('− ' + t('EMPLOYEE_CHARGES'), charges(m), b ? charges(b) : null, t('NOTE_CHARGES'));
    for (const x of sim.benefits.filter(x => x.taxable === true)) {
      add('+ ' + this.benefitLabel(x), x.monthlyValue, b ? x.monthlyValue : null, t('NOTE_TAXABLE_BENEFIT'));
    }
    add('= ' + t('TAXABLE_BASE'), m.taxableBase, b?.taxableBase ?? null);
    add('− ' + t('IRPP'), m.irpp, b?.irpp ?? null, sim.married != null
      ? t('NOTE_FAMILY', {
          married: this.translate.instant(sim.married ? 'PROFILES.REMUNERATION_TAB.MARRIED' : 'PROFILES.REMUNERATION_TAB.NOT_MARRIED'),
          children: sim.children ?? 0,
        })
      : '');
    for (const x of sim.benefits.filter(x => x.taxable !== true)) {
      add('+ ' + this.benefitLabel(x), x.monthlyValue, b ? x.monthlyValue : null, t('NOTE_EXEMPT_BENEFIT'));
    }
    const other = (x: RemunerationBreakdown) => x.net - (x.taxableBase - x.irpp + x.nonTaxableBenefits);
    const round3 = (v: number) => Math.round(v * 1000) / 1000;
    if (round3(other(m)) !== 0 || (b && round3(other(b)) !== 0)) {
      add('± ' + t('OTHER'), round3(other(m)), b ? round3(other(b)) : null, t('NOTE_OTHER'));
    }
    add('= ' + t('NET'), m.net, b?.net ?? null);
    add('+ ' + t('EMPLOYER_CHARGES'), m.employerCharges, b?.employerCharges ?? null);
    add('= ' + t('EMPLOYER_COST'), m.employerCost, b?.employerCost ?? null);
    return rows;
  });

  readonly simulationTableConfig = computed<TableConfig>(() => ({
    loading: this.calculatingNet() && !this.simulation(),
    hoverable: false,
    showReset: false,
    emptyMessage: this.translate.instant('PROFILES.REMUNERATION_TAB.SIM.EMPTY'),
  }));

  /** An employee who already has a salary: any change goes to the country director (payroll V38).
   *  The first salary is saved directly — a new hire's figure was approved as a candidate cost. */
  readonly requiresApproval = computed(() => {
    const cfg = this.config();
    return !!cfg && cfg.updatedAt != null && cfg.currentGrossSalary != null;
  });

  openNewRemuneration(): void {
    const cfg = this.config();
    if (!cfg || !this.canManage()) return;
    const editable = toEditableConfig(cfg);
    const pending = this.pendingChange();
    // A pending request is reopened as is: submitting again updates it (one per employee).
    this.draft.set(pending ? {
      effectiveDate: pending.effectiveDate ?? dateToIso(new Date()),
      contractType: payrollContractCode(pending.contractType) ?? 'CDI',
      gross: pending.grossSalary,
      currency: pending.inputCurrency ?? cfg.workingCurrency ?? '',
      net: pending.newNetSalary,
      benefitCodes: [...pending.selectedBenefitCodes],
      reason: pending.reason,
    } : {
      effectiveDate: dateToIso(new Date()),
      contractType: payrollContractCode(cfg.contractType) ?? 'CDI',
      gross: editable.currentGrossSalary,
      currency: cfg.inputCurrency ?? cfg.workingCurrency ?? '',
      net: cfg.currentNetSalary,
      benefitCodes: [...cfg.selectedBenefitCodes],
      reason: '',
    });
    this.draftError.set(null);
    this.reasonError.set('');
    this.simulation.set(null);
    this.scheduleNet();
    const approval = this.requiresApproval();
    this.modal.open({
      title: this.translate.instant(pending ? 'PROFILES.REMUNERATION_TAB.EDIT_REQUEST_TITLE' : 'PROFILES.REMUNERATION_TAB.NEW_TITLE'),
      subtitle: this.profile().fullName ?? undefined,
      icon: 'payments',
      body: this.formTpl(),
      width: '960px',
      minWidth: '360px',
      minHeight: '320px',
      resizable: true,
      maximizable: true,
      closeOnBackdrop: false,
      buttons: [
        {
          label: this.translate.instant('PROFILES.COMMON.CANCEL'),
          variant: 'secondary',
          action: ref => { this.cancelNet(); ref.close(); },
        },
        {
          label: this.translate.instant(approval ? 'PROFILES.REMUNERATION_TAB.SUBMIT' : 'PROFILES.REMUNERATION_TAB.SAVE'),
          variant: 'primary',
          action: ref => this.saveRemuneration(ref),
        },
      ],
    });
  }

  patchDraft(partial: Partial<RemunerationDraft>, recalc = false): void {
    const d = this.draft();
    if (!d) return;
    this.draft.set({ ...d, ...partial });
    if (recalc) this.scheduleNet();
  }

  onEffectiveDate(v: Date | Date[] | null): void {
    // The effective month decides which exceptional bonuses the simulation adds.
    this.patchDraft({ effectiveDate: dateToIso(v) }, true);
  }

  toggleDraftBenefit(code: string): void {
    const d = this.draft();
    if (!d) return;
    this.patchDraft({
      benefitCodes: d.benefitCodes.includes(code) ? d.benefitCodes.filter(c => c !== code) : [...d.benefitCodes, code],
    }, true);
  }

  asNumber(v: unknown): number | null {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  readonly toDate = isoToDate;

  /** The net is shown as a whole number — display only, the stored value keeps its precision. */
  rounded(v: number | null | undefined): number | null {
    return v == null ? null : Math.round(v);
  }

  private cancelNet(): void {
    if (this.netTimer) clearTimeout(this.netTimer);
    this.netTimer = null;
    this.calculatingNet.set(false);
  }

  /** Simulation rerun shortly after the gross / currency / contract / benefits / date change. */
  private scheduleNet(): void {
    this.cancelNet();
    const d = this.draft();
    if (!d) return;
    if (d.gross == null || d.gross <= 0) {
      ++this.simSeq;
      this.simulation.set(null);
      this.draft.set({ ...d, net: null });
      return;
    }
    this.netTimer = setTimeout(() => this.runSimulation(), 500);
  }

  /** Payroll simulation engine on the form's values — benefits and the month's bonuses
   *  included, family from the RH file. Nothing is saved. */
  private runSimulation(): void {
    const d = this.draft(), cfg = this.config();
    if (!d || !cfg || d.gross == null || d.gross <= 0) return;
    const seq = ++this.simSeq;
    this.calculatingNet.set(true);
    this.draftError.set(null);
    this.svc.simulate(this.profile().userId, {
      grossSalary: d.gross,
      inputCurrency: d.currency && d.currency !== cfg.workingCurrency ? d.currency : null,
      paysId: cfg.paysId,
      contractType: d.contractType,
      selectedBenefitCodes: d.benefitCodes,
      effectiveDate: d.effectiveDate || null,
    }).subscribe({
      next: sim => {
        if (seq !== this.simSeq) return;   // a newer change is already running
        this.calculatingNet.set(false);
        this.simulation.set(sim);
        const now = this.draft();
        if (now) this.draft.set({ ...now, net: sim.monthly.net });
      },
      error: err => {
        if (seq !== this.simSeq) return;
        this.calculatingNet.set(false);
        this.simulation.set(null);
        this.draftError.set(serverMessage(err) ?? this.translate.instant('PROFILES.REMUNERATION_TAB.CALCULATE_ERROR'));
      },
    });
  }

  private saveRemuneration(ref: ModalRef): void {
    const d = this.draft(), cfg = this.config();
    if (!d || !cfg || this.saving()) return;
    this.draftError.set(null);
    this.reasonError.set(d.reason.trim() ? '' : this.translate.instant('PROFILES.REMUNERATION_TAB.REASON_REQUIRED'));
    if (this.reasonError()) return;
    if (d.gross == null || d.gross <= 0) {
      this.draftError.set(this.translate.instant('PROFILES.REMUNERATION_TAB.GROSS_REQUIRED'));
      return;
    }
    if (!d.effectiveDate) {
      this.draftError.set(this.translate.instant('PROFILES.REMUNERATION_TAB.DATE_REQUIRED'));
      return;
    }
    if (this.contractUnpriced()) {
      this.draftError.set(this.translate.instant('PROFILES.REMUNERATION_TAB.CONTRACT_UNPRICED'));
      return;
    }
    this.cancelNet();
    this.saving.set(true);
    const inputCurrency = d.currency && d.currency !== cfg.workingCurrency ? d.currency : null;

    if (this.requiresApproval()) {
      // Already paid: nothing changes until the country director approves.
      this.svc.submitSalaryChange(this.profile().userId, {
        paysId: cfg.paysId!,
        contractType: d.contractType,
        selectedBenefitCodes: d.benefitCodes,
        grossSalary: d.gross,
        inputCurrency,
        effectiveDate: d.effectiveDate,
        reason: d.reason.trim(),
      }).subscribe({
        next: () => {
          this.saving.set(false);
          this.notice.set(this.translate.instant('PROFILES.REMUNERATION_TAB.SUBMITTED'));
          this.loadSalaryChanges();
          ref.close();
        },
        error: err => {
          this.saving.set(false);
          this.draftError.set(serverMessage(err) ?? this.translate.instant('PROFILES.REMUNERATION_TAB.SAVE_ERROR'));
        },
      });
      return;
    }

    this.svc.upsert(this.profile().userId, {
      paysId: cfg.paysId!,
      contractType: d.contractType,
      selectedBenefitCodes: d.benefitCodes,
      currentGrossSalary: d.gross,
      // The server recomputes the net from the saved gross; sent only as a fallback.
      currentNetSalary: d.net,
      reason: d.reason.trim(),
      inputCurrency,
      effectiveDate: d.effectiveDate,
    }).subscribe({
      next: updated => {
        this.saving.set(false);
        this.config.set({ ...updated, paysId: updated.paysId ?? cfg.paysId });
        this.loadHistory();
        ref.close();
      },
      error: err => {
        this.saving.set(false);
        this.draftError.set(serverMessage(err) ?? this.translate.instant('PROFILES.REMUNERATION_TAB.SAVE_ERROR'));
      },
    });
  }

  // ── « Ajouter une prime » pop-up ───────────────────────────────────────────
  readonly bonusDraft = signal<BonusDraft | null>(null);
  readonly bonusError = signal<string | null>(null);

  openAddBonus(): void {
    if (!this.canManage()) return;
    const now = new Date();
    this.bonusDraft.set({
      amount: null,
      currency: this.workingCurrency() ?? this.currencyOptions()[0]?.value ?? '',
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      label: '',
      comment: '',
    });
    this.bonusError.set(null);
    this.modal.open({
      title: this.translate.instant('PROFILES.REMUNERATION_TAB.ADD_BONUS'),
      subtitle: this.profile().fullName ?? undefined,
      icon: 'redeem',
      body: this.bonusTpl(),
      width: '640px',
      minWidth: '340px',
      minHeight: '280px',
      resizable: true,
      maximizable: true,
      closeOnBackdrop: false,
      buttons: [
        { label: this.translate.instant('PROFILES.COMMON.CANCEL'), variant: 'secondary', action: ref => ref.close() },
        { label: this.translate.instant('PROFILES.REMUNERATION_TAB.ADD'), variant: 'primary', action: ref => this.saveBonus(ref) },
      ],
    });
  }

  patchBonus(partial: Partial<BonusDraft>): void {
    const b = this.bonusDraft();
    if (b) this.bonusDraft.set({ ...b, ...partial });
  }

  private saveBonus(ref: ModalRef): void {
    const b = this.bonusDraft();
    if (!b) return;
    const label = b.label.trim();
    if (b.amount == null || b.amount <= 0 || !label || b.year == null || !b.currency) {
      this.bonusError.set(this.translate.instant('PROFILES.REMUNERATION_TAB.BONUS_REQUIRED'));
      return;
    }
    this.bonusError.set(null);
    this.svc.createBonus(this.profile().userId, {
      amount: b.amount, currency: b.currency, periodMonth: b.month, periodYear: b.year,
      label, comment: b.comment.trim() || null,
    }).subscribe({
      next: created => { this.bonuses.set([created, ...this.bonuses()]); ref.close(); },
      error: err => this.bonusError.set(serverMessage(err) ?? this.translate.instant('PROFILES.REMUNERATION_TAB.BONUS_SAVE_ERROR')),
    });
  }

  private confirmDeleteBonus(id: number, label: string): void {
    this.modal.open({
      title: this.translate.instant('PROFILES.REMUNERATION_TAB.DELETE_BONUS'),
      body: this.translate.instant('PROFILES.REMUNERATION_TAB.DELETE_BONUS_CONFIRM', { label }),
      size: 'sm',
      buttons: [
        { label: this.translate.instant('PROFILES.COMMON.CANCEL'), variant: 'secondary', action: ref => ref.close() },
        {
          label: this.translate.instant('PROFILES.COMMON.DELETE'),
          variant: 'primary',
          action: ref => this.svc.deleteBonus(this.profile().userId, id).subscribe({
            next: () => { this.bonuses.set(this.bonuses().filter(x => x.id !== id)); ref.close(); },
            error: () => ref.close(),
          }),
        },
      ],
    });
  }
}

/** Case- and accent-insensitive match of `q` against every text/number value of a row. */
function filterRows(rows: TableRow[], q: string): TableRow[] {
  const needle = normalize(q.trim());
  if (!needle) return rows;
  return rows.filter(r => Object.values(r).some(v =>
    (typeof v === 'string' || typeof v === 'number') && normalize(String(v)).includes(needle)));
}

function normalize(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** ProblemDetail detail sent by payroll-service (e.g. "contract not priced"), if any. */
function serverMessage(err: unknown): string | null {
  const body = (err as { error?: { detail?: string; message?: string } } | null)?.error;
  return body?.detail ?? body?.message ?? null;
}
