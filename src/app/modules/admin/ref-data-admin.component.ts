import {
  Component, OnChanges, SimpleChanges, inject, input, signal, computed,
} from '@angular/core';
import {
  ButtonComponent, FormFieldComponent,
  DataTableComponent, DafCellDirective, TableColumn, TableConfig, TableRow,
} from '@khalilrebhiitec/daf360';

import { RefDataService }      from '../../core/ref/ref-data.service';
import { RefDataItem, CreateRefDataRequest } from '../../core/ref/ref-data.model';
import { ContractHistoryService } from '../profiles/contract-history/contract-history.service';
import { TypeContratDto } from '../profiles/contract-history/contract-history.model';

type RefTab = 'grades' | 'disciplines' | 'nog-levels' | 'departments' | 'banks' | 'nationalities' | 'type-contrat' | 'it-asset-types';

interface TabConfig {
  key:      RefTab;
  label:    string;
  hasPays:  boolean;
  endpoint: string;
}

const TABS: TabConfig[] = [
  { key: 'grades',        label: 'Grades',             hasPays: true,  endpoint: 'grades'        },
  { key: 'disciplines',   label: 'Disciplines',         hasPays: true,  endpoint: 'disciplines'   },
  { key: 'nog-levels',    label: 'Niveaux NOG',         hasPays: true,  endpoint: 'nog-levels'    },
  { key: 'departments',   label: 'Départements',        hasPays: true,  endpoint: 'departments'   },
  { key: 'banks',         label: 'Banques',              hasPays: true,  endpoint: 'banks'         },
  { key: 'nationalities', label: 'Nationalités',         hasPays: false, endpoint: 'nationalities' },
  { key: 'type-contrat',    label: 'Types de contrat',     hasPays: false, endpoint: 'type-contrat'   },
  { key: 'it-asset-types',  label: 'Matériels informatiques', hasPays: false, endpoint: 'it-asset-types' },
];

@Component({
  selector: 'app-ref-data-admin',
  standalone: true,
  imports: [ButtonComponent, FormFieldComponent, DataTableComponent, DafCellDirective],
  template: `
<div>
  <!-- Sub-tab bar -->
  <nav class="rda-tab-bar" role="tablist">
    @for (tab of tabs; track tab.key) {
      <button
        class="rda-tab-btn"
        [class.active]="activeTab().key === tab.key"
        (click)="selectTab(tab)"
        role="tab"
        type="button"
      >{{ tab.label }}</button>
    }
  </nav>

  <!-- Flash messages -->
  @if (successMsg()) {
    <div style="background:var(--color-success,#dcfce7);color:#fff;border-radius:8px;padding:10px 14px;font-size:var(--text-body-sm,13px);margin-bottom:16px;">
      {{ successMsg() }}
    </div>
  }
  @if (error()) {
    <div style="background:var(--color-error-container,#fee2e2);color:var(--color-on-error-container,#991b1b);border-radius:8px;padding:10px 14px;font-size:var(--text-body-sm,13px);margin-bottom:16px;">
      {{ error() }}
    </div>
  }

  <!-- Table — generic ref data -->
  @if (!isTypeContratTab()) {
    @if (loading()) {
      <p style="font-size:var(--text-body-sm,13px);color:var(--color-on-surface-variant,#6B7280);">Chargement…</p>
    } @else {
      <daf-data-table [columns]="itemColumns" [rows]="itemRows()" [config]="itemTableConfig()">
        <ng-template dafCell="isActive" let-row>
          @if (row['_source'].isActive) {
            <span class="rda-badge rda-badge-yes">Oui</span>
          } @else {
            <span class="rda-badge rda-badge-no">Non</span>
          }
        </ng-template>
        <ng-template dafCell="_actions" let-row>
          <daf-button
            label="Supprimer"
            variant="danger"
            [options]="{ size: 'sm', iconStart: 'delete' }"
            (onClick)="deleteItem(row['_source'])" />
        </ng-template>
      </daf-data-table>
    }

    <!-- Inline create form — generic -->
    <div style="background:var(--color-surface-container-low,#f8f9fa);border:1px solid var(--color-outline-variant,#eceef0);border-radius:12px;padding:16px 20px;">
      <daf-button
        [label]="showForm() ? '▲ Masquer le formulaire' : '▼ Ajouter une entrée'"
        variant="ghost"
        [options]="{ size: 'sm' }"
        (onClick)="showForm.set(!showForm())" />

      @if (showForm()) {
        <div style="margin-top:16px;display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;align-items:end;">
          <daf-form-field
            [options]="{ label: 'Libellé FR', placeholder: 'Ex: Ingénieur Senior', required: true, fullWidth: true }"
            [value]="createForm.labelFr"
            (valueChange)="createForm.labelFr = $any($event) ?? ''" />
          <daf-form-field
            [options]="{ label: 'Libellé EN', placeholder: 'Ex: Senior Engineer', fullWidth: true }"
            [value]="createForm.labelEn"
            (valueChange)="createForm.labelEn = $any($event) ?? ''" />
          <daf-form-field
            [options]="{ label: 'Code', placeholder: 'Ex: SENIOR_ENG', fullWidth: true }"
            [value]="createForm.code"
            (valueChange)="createForm.code = $any($event) ?? ''" />
          <daf-form-field
            [options]="{ label: 'Ordre', type: 'number', placeholder: '0', fullWidth: true }"
            [value]="createForm.sortOrder"
            (valueChange)="createForm.sortOrder = $event === null || $event === '' ? null : +$event" />
        </div>
        <div style="margin-top:12px;display:flex;gap:8px;">
          <daf-button
            [label]="saving() ? 'Enregistrement…' : 'Ajouter'"
            variant="teal"
            [options]="{ disabled: saving() || !createForm.labelFr.trim(), loading: saving() }"
            (onClick)="onCreate()" />
          <daf-button
            label="Réinitialiser"
            variant="secondary"
            (onClick)="resetForm()" />
        </div>
      }
    </div>
  }

  <!-- Table — Types de contrat -->
  @if (isTypeContratTab()) {
    @if (loading()) {
      <p style="font-size:var(--text-body-sm,13px);color:var(--color-on-surface-variant,#6B7280);">Chargement…</p>
    } @else {
      <daf-data-table [columns]="tcColumns" [rows]="tcRows()" [config]="itemTableConfig()">
        <ng-template dafCell="isActive" let-row>
          @if (row['_source'].isActive) {
            <span class="rda-badge rda-badge-yes">Oui</span>
          } @else {
            <span class="rda-badge rda-badge-no">Non</span>
          }
        </ng-template>
        <ng-template dafCell="_actions" let-row>
          <daf-button
            label="Supprimer"
            variant="danger"
            [options]="{ size: 'sm', iconStart: 'delete' }"
            (onClick)="deleteTypeContrat(row['_source'])" />
        </ng-template>
      </daf-data-table>
    }

    <!-- Inline create form — type contrat -->
    <div style="background:var(--color-surface-container-low,#f8f9fa);border:1px solid var(--color-outline-variant,#eceef0);border-radius:12px;padding:16px 20px;">
      <daf-button
        [label]="showForm() ? '▲ Masquer le formulaire' : '▼ Ajouter un type de contrat'"
        variant="ghost"
        [options]="{ size: 'sm' }"
        (onClick)="showForm.set(!showForm())" />

      @if (showForm()) {
        <div style="margin-top:16px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;align-items:end;">
          <daf-form-field
            [options]="{ label: 'Code', placeholder: 'Ex: CDI', required: true, fullWidth: true }"
            [value]="tcCreateCode"
            (valueChange)="tcCreateCode = $any($event) ?? ''" />
          <daf-form-field
            [options]="{ label: 'Libellé FR', placeholder: 'Ex: Contrat à durée indéterminée', required: true, fullWidth: true }"
            [value]="tcCreateLabelFr"
            (valueChange)="tcCreateLabelFr = $any($event) ?? ''" />
          <daf-form-field
            [options]="{ label: 'Libellé EN', placeholder: 'Ex: Permanent contract', fullWidth: true }"
            [value]="tcCreateLabelEn"
            (valueChange)="tcCreateLabelEn = $any($event) ?? ''" />
        </div>
        <div style="margin-top:12px;display:flex;gap:8px;">
          <daf-button
            [label]="saving() ? 'Enregistrement…' : 'Ajouter'"
            variant="teal"
            [options]="{ disabled: saving() || !tcCreateLabelFr.trim() || !tcCreateCode.trim(), loading: saving() }"
            (onClick)="onCreateTypeContrat()" />
          <daf-button
            label="Réinitialiser"
            variant="secondary"
            (onClick)="tcCreateCode = ''; tcCreateLabelFr = ''; tcCreateLabelEn = ''" />
        </div>
      }
    </div>
  }
</div>
  `,
  styles: [`
    .rda-tab-bar { display:flex;gap:4px;flex-wrap:wrap;margin-bottom:24px;background:var(--color-surface-container);padding:4px;border-radius:12px;width:fit-content }
    .rda-tab-btn { padding:8px 16px;border:none;border-radius:8px;background:none;font-family:var(--font-sans);font-size:var(--text-label-sm);font-weight:600;color:var(--color-on-surface-variant);cursor:pointer;white-space:nowrap;transition:background-color var(--duration-normal) var(--ease-smooth),color var(--duration-normal) var(--ease-smooth) }
    .rda-tab-btn:hover { color:var(--color-on-surface) }
    .rda-tab-btn.active { color:#fff;background:var(--color-teal);box-shadow:var(--shadow-sm) }
    .rda-badge { font-size:11px;padding:2px 8px;border-radius:999px;font-weight:700 }
    .rda-badge-yes { background:var(--color-tertiary-container);color:var(--color-on-tertiary-container) }
    .rda-badge-no  { background:var(--color-surface-container);color:var(--color-on-surface-variant) }
  `],
})
export class RefDataAdminComponent implements OnChanges {
  private refSvc      = inject(RefDataService);
  private contractSvc = inject(ContractHistoryService);

  paysId = input<number>(179);

  // TypeContrat-specific state (loaded when tab = 'type-contrat')
  typeContrats     = signal<TypeContratDto[]>([]);
  tcCreateCode     = '';
  tcCreateLabelFr  = '';
  tcCreateLabelEn  = '';
  isTypeContratTab = computed(() => this.activeTab().key === 'type-contrat');

  readonly tabs = TABS;

  activeTab = signal<TabConfig>(TABS[0]);
  items     = signal<RefDataItem[]>([]);
  loading   = signal(false);
  saving    = signal(false);
  showForm  = signal(false);
  error     = signal<string | null>(null);
  successMsg = signal<string | null>(null);

  createForm: { labelFr: string; labelEn: string; code: string; sortOrder: number | null } = {
    labelFr: '', labelEn: '', code: '', sortOrder: null,
  };

  readonly itemColumns: TableColumn[] = [
    { key: 'labelFr',   label: 'Libellé FR' },
    { key: 'labelEn',   label: 'Libellé EN' },
    { key: 'code',      label: 'Code' },
    { key: 'sortOrder', label: 'Ordre' },
    { key: 'isActive',  label: 'Actif' },
    { key: '_actions',  label: '', align: 'right' },
  ];

  readonly itemRows = computed<TableRow[]>(() =>
    this.items().map(i => ({
      labelFr:   i.labelFr,
      labelEn:   i.labelEn,
      code:      i.code ?? '—',
      sortOrder: i.sortOrder ?? '—',
      isActive:  i.isActive,
      _source:   i,
    })),
  );

  readonly tcColumns: TableColumn[] = [
    { key: 'code',     label: 'Code' },
    { key: 'labelFr',  label: 'Libellé FR' },
    { key: 'labelEn',  label: 'Libellé EN' },
    { key: 'isActive', label: 'Actif' },
    { key: '_actions', label: '', align: 'right' },
  ];

  readonly tcRows = computed<TableRow[]>(() =>
    this.typeContrats().map(tc => ({
      code:      tc.code,
      labelFr:   tc.labelFr,
      labelEn:   tc.labelEn,
      isActive:  tc.isActive,
      _source:   tc,
    })),
  );

  readonly itemTableConfig = computed<TableConfig>(() => ({
    hoverable: true,
  }));

  ngOnChanges(changes: SimpleChanges): void {
    this.loadItems();
  }

  selectTab(tab: TabConfig): void {
    this.activeTab.set(tab);
    this.showForm.set(false);
    this.resetForm();
    this.loadItems();
  }

  loadItems(): void {
    this.loading.set(true);
    this.error.set(null);
    const tab = this.activeTab();

    if (tab.key === 'type-contrat') {
      this.contractSvc.getTypeContrats().subscribe({
        next: tc => { this.typeContrats.set(tc); this.loading.set(false); },
        error: () => { this.error.set('Impossible de charger les types de contrat.'); this.loading.set(false); },
      });
      return;
    }

    if (tab.key === 'it-asset-types') {
      this.refSvc.getItAssetTypes().subscribe({
        next: r  => { this.items.set(r); this.loading.set(false); },
        error: () => { this.error.set('Impossible de charger les matériels.'); this.loading.set(false); },
      });
      return;
    }

    const obs = tab.hasPays
      ? this.getForType(tab.key, this.paysId())
      : this.refSvc.getNationalities();

    obs.subscribe({
      next: r  => { this.items.set(r); this.loading.set(false); },
      error: () => { this.error.set('Impossible de charger les données.'); this.loading.set(false); },
    });
  }

  private getForType(key: RefTab, paysId: number) {
    switch (key) {
      case 'grades':       return this.refSvc.getGrades(paysId);
      case 'disciplines':  return this.refSvc.getDisciplines(paysId);
      case 'nog-levels':   return this.refSvc.getNogLevels(paysId);
      case 'departments':  return this.refSvc.getDepartments(paysId);
      case 'banks':        return this.refSvc.getBanks(paysId);
      default:             return this.refSvc.getNationalities();
    }
  }

  onCreate(): void {
    if (!this.createForm.labelFr.trim()) return;
    this.saving.set(true);
    this.error.set(null);
    const tab = this.activeTab();
    const req: CreateRefDataRequest = {
      labelFr:   this.createForm.labelFr.trim(),
      labelEn:   this.createForm.labelEn.trim() || undefined,
      code:      this.createForm.code.trim()    || undefined,
      sortOrder: this.createForm.sortOrder      ?? undefined,
      paysId:    tab.hasPays ? this.paysId()    : undefined,
    };
    this.refSvc.invalidateAll();
    this.refSvc.create(tab.endpoint, req).subscribe({
      next: () => {
        this.saving.set(false);
        this.resetForm();
        this.showForm.set(false);
        this.flash('Entrée créée avec succès.');
        this.loadItems();
      },
      error: err => {
        this.saving.set(false);
        this.error.set(err?.error?.message ?? 'Erreur lors de la création.');
      },
    });
  }

  deleteItem(item: RefDataItem): void {
    if (!confirm(`Supprimer « ${item.labelFr} » ?`)) return;
    const tab = this.activeTab();
    this.refSvc.invalidateAll();
    this.refSvc.delete(tab.endpoint, item.id, tab.hasPays ? this.paysId() : undefined).subscribe({
      next: () => { this.flash('Entrée supprimée.'); this.loadItems(); },
      error: err => this.error.set(err?.error?.message ?? 'Erreur lors de la suppression.'),
    });
  }

  onCreateTypeContrat(): void {
    if (!this.tcCreateLabelFr.trim() || !this.tcCreateCode.trim()) return;
    this.saving.set(true);
    this.error.set(null);
    this.contractSvc.createTypeContrat({
      code:    this.tcCreateCode.trim(),
      labelFr: this.tcCreateLabelFr.trim(),
      labelEn: this.tcCreateLabelEn.trim() || undefined,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.tcCreateCode = ''; this.tcCreateLabelFr = ''; this.tcCreateLabelEn = '';
        this.showForm.set(false);
        this.flash('Type de contrat créé.');
        this.loadItems();
      },
      error: (err: any) => {
        this.saving.set(false);
        this.error.set(err?.error?.message ?? 'Erreur lors de la création.');
      },
    });
  }

  deleteTypeContrat(tc: TypeContratDto): void {
    if (!confirm(`Supprimer « ${tc.labelFr} » ?`)) return;
    this.contractSvc.deleteTypeContrat(tc.id).subscribe({
      next: () => { this.flash('Type de contrat supprimé.'); this.loadItems(); },
      error: (err: any) => this.error.set(err?.error?.message ?? 'Erreur lors de la suppression.'),
    });
  }

  resetForm(): void {
    this.createForm = { labelFr: '', labelEn: '', code: '', sortOrder: null };
  }

  private flash(msg: string): void {
    this.successMsg.set(msg);
    this.error.set(null);
    setTimeout(() => this.successMsg.set(null), 3500);
  }
}
