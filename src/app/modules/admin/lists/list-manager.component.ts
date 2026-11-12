import { NgTemplateOutlet } from '@angular/common';
import { Component, TemplateRef, computed, inject, input, OnInit, signal, untracked, viewChild } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import {
  ButtonComponent, CheckboxComponent, DafCellDirective, DataTableComponent,
  FormFieldComponent, SortDirection, TableColumn, TableConfig, TableRow, StatusBadgeComponent,
  PaginationComponent, PaginationConfig, ModalService, ModalRef,
  SearchToolbarComponent, SelectComponent, type SelectOption,
} from '@khalilrebhiitec/daf360';
import { ConfigurableListService } from '../../../core/lists/configurable-list.service';
import {
  ContractTypeDecisionRules, CreateListValueRequest, ListType, ListValue, UpdateListValueRequest,
} from '../../../core/lists/configurable-list.model';
import { ContractAlertsService, ContractTypeConfig } from '../contract-alerts/contract-alerts.service';
import { UserStore } from '../../../core/user.store';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TableSort, searchRows, sortByColumn, toTableSort } from '../../../shared/table-sort.utils';
import { adminLabel } from '../../../shared/utils/admin-label.utils';
import { rememberAdminState } from '../admin-section-state';
import { PageGuideComponent } from '../../../shared/guide/page-guide.component';
import { GuideStep } from '../../../shared/guide/page-guide.types';

const PAGE_SIZE = 10;

/** Guide of the « Listes configurables » card, started from « Aide & guides ». */
const GUIDE_STEPS: GuideStep[] = [
  { icon: 'list_alt', titleKey: 'ADMIN_LISTS_GUIDE.WELCOME.TITLE', textKey: 'ADMIN_LISTS_GUIDE.WELCOME.TEXT' },
  { icon: 'tab', titleKey: 'ADMIN_LISTS_GUIDE.TABS.TITLE', textKey: 'ADMIN_LISTS_GUIDE.TABS.TEXT', target: 'lists-tabs' },
  { icon: 'search', titleKey: 'ADMIN_LISTS_GUIDE.TOOLBAR.TITLE', textKey: 'ADMIN_LISTS_GUIDE.TOOLBAR.TEXT', target: 'lists-toolbar' },
  { icon: 'add', titleKey: 'ADMIN_LISTS_GUIDE.ADD.TITLE', textKey: 'ADMIN_LISTS_GUIDE.ADD.TEXT', target: 'lists-toolbar' },
  { icon: 'table_rows', titleKey: 'ADMIN_LISTS_GUIDE.TABLE.TITLE', textKey: 'ADMIN_LISTS_GUIDE.TABLE.TEXT', target: 'lists-table' },
  { icon: 'lock', titleKey: 'ADMIN_LISTS_GUIDE.SYSTEM.TITLE', textKey: 'ADMIN_LISTS_GUIDE.SYSTEM.TEXT', target: 'lists-table' },
  { icon: 'help', titleKey: 'ADMIN_LISTS_GUIDE.END.TITLE', textKey: 'ADMIN_LISTS_GUIDE.END.TEXT' },
];

/**
 * Lists kept in the DB but no longer administered here. EMPLOYMENT_TYPE was replaced by
 * CONTRACT_TYPE (same « Type de contrat » label) — sql/2026-10-15_suppr_liste_employment_type.sql drops it.
 */
const HIDDEN_LIST_CODES = new Set(['EMPLOYMENT_TYPE']);

/**
 * « Décision de contrat » (CONTRACT_DECISION): each value is a choice offered by « Décider »
 * on a contract, and carries the action the engine performs. The label is free; the action
 * is one of these (backend ContractDecisionAction).
 */
const DECISION_LIST_CODE = 'CONTRACT_DECISION';
const DECISION_ACTIONS = ['CONFIRM_TRIAL', 'RENEW_TRIAL', 'BREAK_TRIAL', 'RENEW_CDD', 'EXTEND', 'END_CONTRACT'];
const TRIAL_ACTIONS = ['CONFIRM_TRIAL', 'RENEW_TRIAL', 'BREAK_TRIAL'];
const END_ACTIONS   = ['RENEW_CDD', 'EXTEND', 'END_CONTRACT'];

/**
 * « Type de contrat » (CONTRACT_TYPE): each type follows the lifecycle rules of a nature, and
 * may define its own « Décider » rules — otherwise it inherits its nature's (Échéances de
 * contrat). Backend: ContractRules.
 */
const CONTRACT_TYPE_LIST_CODE = 'CONTRACT_TYPE';
const NATURES = ['CDI', 'CDD', 'CIVP', 'STAGE', 'FREELANCE', 'DETACHEMENT'];

/** A nature with no contract_type_config row offers the backend's defaults (ContractDecisionAction.defaults). */
function defaultDecisions(nature: string): { trial: string[]; end: string[] } {
  return {
    trial: nature === 'CDI' ? [...TRIAL_ACTIONS] : ['CONFIRM_TRIAL', 'BREAK_TRIAL'],
    end:   nature === 'CDI' ? [] : nature === 'CDD' ? ['RENEW_CDD', 'END_CONTRACT'] : ['EXTEND', 'END_CONTRACT'],
  };
}

/** What the « Décisions » section edits for one contract type. */
interface RulesForm {
  nature: string;
  custom: boolean;
  renewable: boolean;
  max: number;
  trial: string[];
  end: string[];
}

/** What each list-value column sorts on. No sort = the list's own `sortOrder`. */
const LIST_VALUE_SORT: Record<string, (v: ListValue) => string | number | null> = {
  valueCode: v => v.valueCode || null,
  labelFr:   v => v.labelFr || null,
  labelEn:   v => v.labelEn || null,
  isActive:  v => (v.isActive ? 1 : 0),   // inactive first on an ascending sort
  isSystem:  v => (v.isSystem ? 1 : 0),   // editable values first on an ascending sort
};

@Component({
  selector: 'app-list-manager',
  standalone: true,
  imports: [
    FormsModule, ReactiveFormsModule, DataTableComponent, DafCellDirective,
    ButtonComponent, FormFieldComponent, CheckboxComponent, StatusBadgeComponent,
    PaginationComponent, SearchToolbarComponent, SelectComponent, TranslatePipe, PageGuideComponent,
    NgTemplateOutlet,
  ],
  templateUrl: './list-manager.component.html',
  styleUrl: './list-manager.component.scss',
})
export class ListManagerComponent implements OnInit {
  private listService = inject(ConfigurableListService);
  private fb          = inject(FormBuilder);
  private userStore   = inject(UserStore);
  private translate   = inject(TranslateService);
  private modal       = inject(ModalService);
  private modalRef?: ModalRef;
  bodyTpl = viewChild.required<TemplateRef<unknown>>('bodyTpl');
  rulesTpl = viewChild.required<TemplateRef<unknown>>('rulesTpl');
  private alertsSvc = inject(ContractAlertsService);

  /**
   * The entity picked in /rh/admin. A per-pays list (CONTRACT_TYPE…) shows and creates the
   * values of THIS entity; a global list ignores it. The admin shell rebuilds this tab when
   * the pick changes, so the value is read as-is, never watched.
   */
  readonly paysId = input<number | null>(null);
  adding  = signal(false);

  /** Steps of the card's page guide (one view: the lists and their values). */
  readonly guideSteps = GUIDE_STEPS;

  listTypes       = signal<ListType[]>([]);
  selectedType    = signal<ListType | null>(null);
  values          = signal<ListValue[]>([]);
  loadingTypes    = signal(true);
  loadingValues   = signal(false);
  /** Search over the selected list's values (toolbar above the table). */
  searchQuery     = signal('');
  editingId       = signal<number | null>(null);
  error           = signal<string | null>(null);
  successMsg      = signal<string | null>(null);

  /** A list's name (tab + content title) in the UI language. */
  typeLabel(type: ListType): string {
    return adminLabel(type, this.translate);
  }

  /**
   * A list's description in the UI language. The DB holds one (French) description, so it is
   * translated here by list code; a list with no TYPE_DESC entry keeps the DB text.
   */
  typeDescription(type: ListType): string | null {
    if (!type.description) return null;
    const key = 'ADMIN.data.lists.TYPE_DESC.' + type.code;
    const label = this.translate.instant(key);
    return label !== key ? label : type.description;
  }

  /** The values table (absent while loading) — fed to the toolbar's `[table]`. */
  readonly table = viewChild(DataTableComponent);

  /** New search → back to the first page (else one can sit on an empty page). */
  onSearch(value: string): void {
    if (value === this.searchQuery()) return;
    this.searchQuery.set(value);
    this.currentPage.set(0);
  }

  /** Per-pays list: whether the selected list is split by entity right now. */
  readonly isPerPaysView = computed(() =>
    !!this.selectedType()?.isPerPays && this.paysId() != null);

  /**
   * The admin endpoint returns every entity's values at once. For a per-pays list, keep the
   * picked entity's own values plus the shared ones (pays_id NULL) — exactly what a form of
   * that entity is offered (ConfigurableListValueRepository.findActiveByListTypeAndPays).
   */
  readonly scopedValues = computed(() => {
    if (!this.isPerPaysView()) return this.values();
    const pays = this.paysId();
    return this.values().filter(v => v.paysId === pays || v.paysId === null);
  });

  /** Searches what the row shows: code, both labels, and the translated status badges. */
  readonly filteredValues = computed(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k);
    return searchRows(this.scopedValues(), this.searchQuery(), v => [
      v.valueCode, v.labelFr, v.labelEn,
      t(v.isActive ? 'ADMIN.data.lists.ACTIVE' : 'ADMIN.data.lists.INACTIVE'),
      v.isSystem ? t('ADMIN.data.lists.SYSTEM') : null,
    ]);
  });

  readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    return [
      { key: 'valueCode', label: this.translate.instant('ADMIN.data.lists.COL_CODE'), sortable: true },
      { key: 'labelFr', label: this.translate.instant('ADMIN.data.lists.COL_LABEL_FR'), sortable: true },
      { key: 'labelEn', label: this.translate.instant('ADMIN.data.lists.COL_LABEL_EN'), sortable: true },
      { key: 'isActive', label: this.translate.instant('ADMIN.data.lists.COL_ACTIVE'), sortable: true },
      { key: 'isSystem', label: this.translate.instant('ADMIN.data.lists.COL_SYSTEM'), sortable: true },
      // Only where it means something: a global list has no entity to tell apart.
      ...(this.isDecisionList()
        ? [{ key: 'decisionAction', label: this.translate.instant('ADMIN.data.lists.COL_ACTION'), sortable: false }]
        : []),
      ...(this.isContractTypeList()
        ? [{ key: 'decisions', label: this.translate.instant('ADMIN.data.lists.RULES.COL'), sortable: false }]
        : []),
      ...(this.isPerPaysView()
        ? [{ key: 'scope', label: this.translate.instant('ADMIN.data.lists.COL_SCOPE'), sortable: false }]
        : []),
    ];
  });

  currentPage = signal(0);
  /** Table header sort — applied to the whole filtered list, before paging (`manualSort`). */
  readonly sort = signal<TableSort | null>(null);

  // ── Mémoire de la section ──────────────────────────────────────────────────
  /** Liste ouverte, recherche, tri et page gardés tant qu'on reste dans /rh/admin (voir `rememberAdminState`). */
  private readonly memory = rememberAdminState('lists', {
    selectedType: this.selectedType, searchQuery: this.searchQuery, currentPage: this.currentPage, sort: this.sort,
  });

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filteredValues().length / PAGE_SIZE)));

  readonly pagedValues = computed(() => {
    const start = this.currentPage() * PAGE_SIZE;
    return sortByColumn(this.filteredValues(), this.sort(), LIST_VALUE_SORT).slice(start, start + PAGE_SIZE);
  });

  readonly rows = computed<TableRow[]>(() =>
    this.pagedValues().map(v => ({
      valueCode: v.valueCode,
      labelFr:   v.labelFr,
      labelEn:   v.labelEn,
      isActive:  v.isActive,
      isSystem:  v.isSystem,
      decisionAction: v.decisionAction ?? null,
      decisions: null,
      _source:   v,
    })),
  );

  readonly tableConfig = computed<TableConfig>(() => {
    this.translate.currentLang();
    this.editingId();
    const tr = (k: string) => this.translate.instant(k);
    // A seed read once by the table — tracking it would rebuild the config on every header click.
    const sort = untracked(this.sort);
    return {
      hoverable: false,
      showHeader: false,
      emptyMessage: this.translate.instant('ADMIN.data.lists.EMPTY_MESSAGE'),
      // Stable row identity: row heights are keyed by it, not by render index.
      rowId: (row: TableRow) => (row['_source'] as ListValue).id,
      resizableColumns:  true,
      resizableRows:     true,
      columnPicker:      true,
      columnPickerLabel: tr('REQUESTS.TABLE.COLUMN_PICKER'),
      showReset:         true,
      resetLabel:        tr('REQUESTS.TABLE.RESET'),
      sortLabel:         tr('REQUESTS.TABLE.SORT_BY'),
      // Rows are one client-side page; this component sorts the whole list (sortByColumn).
      manualSort:        true,
      ...(sort ? { defaultSort: sort } : {}),
      actions: [
        {
          id: 'save', icon: 'check', variant: 'default',
          tooltip: this.translate.instant('ADMIN.data.lists.SAVE'),
          hidden: (row: TableRow) => this.editingId() !== (row['_source'] as ListValue).id,
          disabled: () => this.editForm.invalid,
          onClick: (row: TableRow) => this.saveEdit(row['_source'] as ListValue),
        },
        {
          id: 'cancel', icon: 'close',
          tooltip: this.translate.instant('ADMIN.data.lists.CANCEL'),
          hidden: (row: TableRow) => this.editingId() !== (row['_source'] as ListValue).id,
          onClick: () => this.cancelEdit(),
        },
        {
          id: 'edit', icon: 'edit',
          tooltip: this.translate.instant('ADMIN.data.lists.EDIT'),
          hidden: (row: TableRow) => this.editingId() === (row['_source'] as ListValue).id,
          onClick: (row: TableRow) => this.startEdit(row['_source'] as ListValue),
        },
        {
          // « Type de contrat » only: the type's « Décider » rules (own or inherited).
          id: 'rules', icon: 'rule',
          tooltip: this.translate.instant('ADMIN.data.lists.RULES.ACTION'),
          hidden: (row: TableRow) => !this.isContractTypeList()
            || this.editingId() === (row['_source'] as ListValue).id,
          onClick: (row: TableRow) => this.openRulesModal(row['_source'] as ListValue),
        },
        {
          id: 'delete', icon: 'delete', variant: 'danger',
          tooltip: this.translate.instant('ADMIN.data.lists.DELETE'),
          hidden: (row: TableRow) => this.editingId() === (row['_source'] as ListValue).id,
          disabled: (row: TableRow) => (row['_source'] as ListValue).isSystem,
          onClick: (row: TableRow) => this.confirmDeleteValue(row['_source'] as ListValue),
        },
      ],
    };
  });

  readonly paginationConfig: PaginationConfig = {
    showFirstLast: true,
    showPrevNext:  true,
    maxVisible:    5,
    size:          'sm',
  };

  onPageChange(page: number): void {
    this.currentPage.set(page);
  }

  /** Header click (or the reset icon): a new order makes the current page meaningless. */
  onSortChange(key: string, dir: SortDirection): void {
    this.sort.set(toTableSort(key, dir));
    this.currentPage.set(0);
  }

  editForm: FormGroup = this.fb.group({
    labelFr:   ['', Validators.required],
    labelEn:   ['', Validators.required],
    sortOrder: [0],
    isActive:  [true],
    decisionAction: [''],
  });

  /** The selected list is « Décision de contrat » — its values carry an action. */
  readonly isDecisionList = computed(() => this.selectedType()?.code === DECISION_LIST_CODE);

  /** The engine's actions, in the UI language (same wording as Échéances de contrat). */
  readonly actionOptions = computed<SelectOption[]>(() => {
    this.translate.currentLang();
    return DECISION_ACTIONS.map(a => ({ value: a, label: this.actionLabel(a) }));
  });

  actionLabel(a: string | null | undefined): string {
    return a ? this.translate.instant('ADMIN.contractAlerts.action.' + a) : '—';
  }

  // ── « Type de contrat » : décisions propres ou héritées ────────────────────

  /** The selected list is « Type de contrat » — each type may carry its own « Décider » rules. */
  readonly isContractTypeList = computed(() => this.selectedType()?.code === CONTRACT_TYPE_LIST_CODE);

  readonly trialActions = TRIAL_ACTIONS;
  readonly endActions   = END_ACTIONS;
  readonly natureOptions: SelectOption[] = NATURES.map(n => ({ value: n, label: n }));

  /** The entity's Échéances de contrat rows: what a type without rules of its own inherits. */
  readonly natureConfigs = signal<ContractTypeConfig[]>([]);

  /** What the « Décisions » section is editing (add modal or rules modal). */
  rules: RulesForm = this.emptyRules('CDI');
  rulesEditing = signal<ListValue | null>(null);
  rulesSaving  = signal(false);
  rulesError   = signal<string | null>(null);

  private loadNatureConfigs(): void {
    const pays = this.paysId();
    if (pays == null) { this.natureConfigs.set([]); return; }
    this.alertsSvc.list(pays).subscribe({
      next: list => this.natureConfigs.set(list),
      error: () => this.natureConfigs.set([]),   // the defaults below still apply
    });
  }

  /** The nature a type follows: its lifecycle_nature, else its own code when it is one, else CDI. */
  natureOf(v: ListValue): string {
    const n = (v.lifecycleNature ?? '').trim().toUpperCase();
    if (NATURES.includes(n)) return n;
    const c = (v.valueCode ?? '').trim().toUpperCase();
    return NATURES.includes(c) ? c : 'CDI';
  }

  /** The rules a nature gives a type that has none of its own (Échéances de contrat, else defaults). */
  inheritedRules(nature: string): Omit<RulesForm, 'nature' | 'custom'> {
    const cfg = this.natureConfigs().find(c => c.contractTypeCode === nature) ?? null;
    const d = defaultDecisions(nature);
    return {
      renewable: cfg?.trialPeriodRenewable ?? false,
      max:       cfg?.trialMaxRenewals ?? 1,
      trial:     [...(cfg?.trialDecisions ?? d.trial)],
      end:       [...(cfg?.endDecisions ?? d.end)],
    };
  }

  private emptyRules(nature: string): RulesForm {
    return { nature, custom: false, ...this.inheritedRules(nature) };
  }

  private rulesOfValue(v: ListValue): RulesForm {
    const nature = this.natureOf(v);
    if (!v.customDecisions) return this.emptyRules(nature);
    const inherited = this.inheritedRules(nature);
    return {
      nature,
      custom:    true,
      renewable: v.trialRenewable ?? inherited.renewable,
      max:       v.trialMaxRenewals ?? inherited.max,
      trial:     [...(v.trialDecisions ?? inherited.trial)],
      end:       [...(v.endDecisions ?? inherited.end)],
    };
  }

  /** New nature: an inheriting type now shows that nature's rules. */
  onNaturePick(nature: string | undefined): void {
    if (!nature) return;
    this.rules.nature = nature;
    if (!this.rules.custom) this.rules = this.emptyRules(nature);
  }

  /** Switching to own rules starts from what the type inherited until now. */
  onCustomToggle(on: boolean): void {
    this.rules = on
      ? { ...this.rules, ...this.inheritedRules(this.rules.nature), custom: true }
      : this.emptyRules(this.rules.nature);
  }

  /** Checkbox → keeps the list in the engine's order. */
  toggleAction(list: string[], action: string, on: boolean): void {
    const i = list.indexOf(action);
    if (on && i < 0) list.push(action);
    if (!on && i >= 0) list.splice(i, 1);
    list.sort((a, b) => DECISION_ACTIONS.indexOf(a) - DECISION_ACTIONS.indexOf(b));
  }

  setMax(v: unknown): void {
    const n = Number(v);
    this.rules.max = Number.isFinite(n) ? Math.trunc(n) : NaN;
  }

  rulesValid(): boolean {
    return !this.rules.custom || (Number.isInteger(this.rules.max) && this.rules.max >= 0 && this.rules.max <= 10);
  }

  /** What is sent to the backend for the section. */
  private rulesPayload(): ContractTypeDecisionRules & { lifecycleNature: string } {
    const r = this.rules;
    return r.custom
      ? { lifecycleNature: r.nature, customDecisions: true, trialRenewable: r.renewable,
          trialMaxRenewals: r.max, trialDecisions: [...r.trial], endDecisions: [...r.end] }
      : { lifecycleNature: r.nature, customDecisions: false };
  }

  /** « Essai : Confirmer, Rompre · Fin : Prolonger » */
  summaryOf(r: { trial: string[]; end: string[] }): string {
    const t = (a: string) => this.translate.instant('ADMIN.contractAlerts.short.' + a);
    const trial = r.trial.map(t).join(', ');
    const end   = r.end.map(t).join(', ');
    return [trial && `${this.translate.instant('ADMIN.contractAlerts.shortTrial')} : ${trial}`,
            end   && `${this.translate.instant('ADMIN.contractAlerts.shortEnd')} : ${end}`]
      .filter(Boolean).join(' · ') || this.translate.instant('ADMIN.data.lists.RULES.NONE');
  }

  /** Table cell of a contract type: where its rules come from, and what they offer. */
  decisionsCell(v: ListValue): { own: boolean; badge: string; text: string } {
    const r = this.rulesOfValue(v);
    return {
      own: r.custom,
      badge: r.custom
        ? this.translate.instant('ADMIN.data.lists.RULES.OWN')
        : this.translate.instant('ADMIN.data.lists.RULES.INHERITED_SHORT', { nature: r.nature }),
      text: this.summaryOf(r),
    };
  }

  openRulesModal(v: ListValue): void {
    this.rulesEditing.set(v);
    this.rules = this.rulesOfValue(v);
    this.rulesError.set(null);
    this.modalRef = this.modal.open({
      minWidth:    '560px',
      minHeight:   '440px',
      resizable:   true,
      maximizable: true,
      title: this.translate.instant('ADMIN.data.lists.RULES.MODAL_TITLE', { label: v.labelFr }),
      body: this.rulesTpl(),
      closeOnBackdrop: false,
    });
  }

  saveRules(): void {
    const v = this.rulesEditing();
    if (!v) return;
    if (!this.rulesValid()) { this.rulesError.set(this.translate.instant('ADMIN.data.lists.RULES.ERR_MAX')); return; }
    this.rulesSaving.set(true);
    this.rulesError.set(null);
    this.listService.updateValue(v.id, this.rulesPayload()).subscribe({
      next: () => {
        this.rulesSaving.set(false);
        this.modalRef?.close();
        this.flash(this.translate.instant('ADMIN.data.lists.RULES.SAVED'));
        this.loadValues(v.listTypeId, false);
      },
      error: err => {
        this.rulesSaving.set(false);
        this.rulesError.set(err?.error?.detail ?? err?.error?.message ?? this.translate.instant('ADMIN.data.lists.ERR_GENERIC'));
      },
    });
  }

  addForm: FormGroup = this.fb.group({
    valueCode: ['', [Validators.required, Validators.maxLength(100)]],
    labelFr:   ['', Validators.required],
    labelEn:   ['', Validators.required],
    sortOrder: [0],
    decisionAction: [''],
  });

  ngOnInit(): void {
    this.listService.getListTypes().subscribe({
      next: all => {
        const types = all.filter(t => !HIDDEN_LIST_CODES.has(t.code));
        this.listTypes.set(types);
        this.loadingTypes.set(false);
        // Liste restaurée (`rememberAdminState`) : on la rouvre telle quelle, sans vider sa
        // recherche ni revenir en page 1 — `selectType` ne sert qu'aux vrais changements.
        const restored = types.find(t => t.id === this.selectedType()?.id);
        if (restored) {
          this.selectedType.set(restored);
          this.loadValues(restored.id, false);
          if (restored.code === CONTRACT_TYPE_LIST_CODE) this.loadNatureConfigs();
        } else if (types.length) this.selectType(types[0]);
      },
      error: () => { this.error.set(this.translate.instant('ADMIN.data.lists.ERR_LOAD_TYPES')); this.loadingTypes.set(false); },
    });
  }

  selectType(type: ListType): void {
    this.selectedType.set(type);
    this.modalRef?.close();
    this.editingId.set(null);
    this.searchQuery.set('');   // a search typed for one list means nothing in the next
    this.loadValues(type.id);
    if (type.code === CONTRACT_TYPE_LIST_CODE) this.loadNatureConfigs();
  }

  openAddForm(): void {
    this.addForm.reset({ sortOrder: 0, decisionAction: this.isDecisionList() ? DECISION_ACTIONS[0] : '' });
    this.rules = this.emptyRules('CDI');
    this.rulesError.set(null);
    this.modalRef = this.modal.open({
      minWidth:    this.isContractTypeList() ? '560px' : '360px',
      minHeight:   this.isContractTypeList() ? '520px' : '260px',
      resizable:   true,
      maximizable: true,
      title: this.translate.instant('ADMIN.data.lists.MODAL_ADD_TITLE'),
      body: this.bodyTpl(),
      closeOnBackdrop: false,
    });
  }

  cancelAdd(): void {
    this.modalRef?.close();
  }

  loadValues(id: number, resetPage = true): void {
    this.loadingValues.set(true);
    if (resetPage) this.currentPage.set(0);
    this.listService.getAllValuesForAdmin(id).subscribe({
      next: vals => {
        this.values.set(vals);
        // Page restaurée (ou liste raccourcie) : on retombe sur la dernière page existante.
        this.currentPage.update(p => Math.min(p, this.totalPages() - 1));
        this.loadingValues.set(false);
      },
      error: () => { this.error.set(this.translate.instant('ADMIN.data.lists.ERR_LOAD_VALUES')); this.loadingValues.set(false); },
    });
  }

  startEdit(value: ListValue): void {
    this.editingId.set(value.id);
    this.editForm.patchValue({
      labelFr: value.labelFr, labelEn: value.labelEn,
      sortOrder: value.sortOrder, isActive: value.isActive,
      decisionAction: value.decisionAction ?? '',
    });
  }

  cancelEdit(): void { this.editingId.set(null); }

  saveEdit(value: ListValue): void {
    if (this.editForm.invalid) return;
    // No nature sent: the backend keeps the value's current one.
    const { decisionAction, ...rest } = this.editForm.value;
    // The action only means something on « Décision de contrat »; other lists never send it.
    const dto: UpdateListValueRequest = this.isDecisionList() && decisionAction
      ? { ...rest, decisionAction } : rest;
    this.listService.updateValue(value.id, dto).subscribe({
      next: () => { this.editingId.set(null); this.flash(this.translate.instant('ADMIN.data.lists.MSG_UPDATED')); this.loadValues(value.listTypeId); },
      error: err => this.error.set(err?.error?.detail ?? err?.error?.message ?? this.translate.instant('ADMIN.data.lists.ERR_GENERIC')),
    });
  }

  /** Same ModalService confirm-dialog convention as the other admin catalog pages. */
  confirmDeleteValue(value: ListValue): void {
    this.modal.open({
      title: this.translate.instant('ADMIN.data.lists.DELETE'),
      body: this.translate.instant('ADMIN.data.lists.CONFIRM_Q'),
      size: 'sm',
      closeOnBackdrop: false,
      buttons: [
        { label: this.translate.instant('ADMIN.data.lists.NO'), variant: 'secondary', action: r => r.close() },
        {
          label: this.translate.instant('ADMIN.data.lists.YES'), variant: 'primary', icon: 'delete',
          action: r => { this.deleteValue(value.id, value.listTypeId); r.close(); },
        },
      ],
    });
  }

  deleteValue(id: number, listTypeId: number): void {
    this.listService.deleteValue(id).subscribe({
      next: () => { this.flash(this.translate.instant('ADMIN.data.lists.MSG_DELETED')); this.loadValues(listTypeId); },
      error: err => {
        this.error.set(err?.error?.detail ?? err?.error?.message ?? this.translate.instant('ADMIN.data.lists.ERR_DELETE'));
      },
    });
  }

  addValue(): void {
    if (this.addForm.invalid || !this.selectedType()) return;
    if (this.isContractTypeList() && !this.rulesValid()) {
      this.rulesError.set(this.translate.instant('ADMIN.data.lists.RULES.ERR_MAX'));
      return;
    }
    const type = this.selectedType()!;
    this.adding.set(true);
    // A per-pays list gets the value for the entity picked in /rh/admin; a global one stays
    // shared (null), as before.
    const paysId = type.isPerPays ? this.paysId() : null;
    // « Type de contrat »: its nature and, if asked, its own « Décider » rules.
    const { decisionAction, ...rest } = this.addForm.value;
    const dto: CreateListValueRequest = {
      listTypeId: type.id, paysId, ...rest,
      ...(this.isDecisionList() && decisionAction ? { decisionAction } : {}),
      ...(this.isContractTypeList() ? this.rulesPayload() : {}),
    };
    this.listService.createValue(dto).subscribe({
      next: () => {
        this.adding.set(false);
        this.modalRef?.close();
        this.addForm.reset({ sortOrder: 0 });
        this.flash(this.translate.instant('ADMIN.data.lists.MSG_ADDED'));
        this.loadValues(type.id);
      },
      error: err => {
        this.adding.set(false);
        this.error.set(err?.error?.detail ?? err?.error?.message ?? this.translate.instant('ADMIN.data.lists.ERR_CREATE'));
      },
    });
  }

  private flash(msg: string): void {
    this.successMsg.set(msg);
    this.error.set(null);
    setTimeout(() => this.successMsg.set(null), 3500);
  }
}
