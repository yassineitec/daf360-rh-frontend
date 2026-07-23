import {
  Component, OnChanges, SimpleChanges, inject, input, signal, computed,
} from '@angular/core';
import {
  ButtonComponent, FormFieldComponent, SelectComponent, SelectOption, CardComponent,
  StatusBadgeComponent, BadgeOptions, DataTableComponent, DafCellDirective,
  TableColumn, TableConfig, TableRow, ModalService,
} from '@khalilrebhiitec/daf360';
import { BreakService } from './breaks/break.service';
import { RegimeService } from './regimes/regime.service';
import { LegalRulesAdminComponent } from './breaks/legal-rules-admin.component';
import {
  BreakTemplateDto, CreateBreakTemplateRequest,
} from './breaks/break.model';
import { WorkingTimeRegime } from './regimes/regime.model';
import { DafHasPermissionDirective } from '@khalilrebhiitec/daf360';

type BreakTab = 'templates' | 'legal-rules';

@Component({
  selector: 'app-breaks-admin',
  standalone: true,
  imports: [
    ButtonComponent, FormFieldComponent, SelectComponent,
    LegalRulesAdminComponent, DafHasPermissionDirective, StatusBadgeComponent,
    DataTableComponent, DafCellDirective,
  ],
  template: `
<div>
  <!-- Sub-tab bar -->
  <nav class="ba-tab-bar" role="tablist">
    <button class="ba-tab-btn" [class.active]="activeTab()==='templates'" (click)="activeTab.set('templates')" type="button">
      <span class="material-symbols-outlined ba-tab-icon">list_alt</span> Modèles de pause
    </button>
    <button class="ba-tab-btn" [class.active]="activeTab()==='legal-rules'" (click)="activeTab.set('legal-rules')" type="button">
      <span class="material-symbols-outlined ba-tab-icon">gavel</span> Règles légales
    </button>
  </nav>

  <!-- Templates tab -->
  @if (activeTab() === 'templates') {
    <div>
      <!-- Header -->
      <div class="ba-header">
        <div>
          <h2 style="font-size:var(--text-headline-md);font-weight:700;color:var(--color-primary);margin:0;">Modèles de pause</h2>
          <p style="font-size:var(--text-body-sm);color:var(--color-on-surface-variant);margin:3px 0 0;">Pauses automatiques par régime horaire</p>
        </div>
        <daf-button *dafHasPermission="'ADMIN_BREAKS'"
          [label]="showCreateForm() ? 'Annuler' : 'Nouveau modèle'" variant="teal"
          [options]="{ iconStart: showCreateForm() ? 'close' : 'add' }"
          (onClick)="showCreateForm.set(!showCreateForm())" />
      </div>

      <!-- Create form -->
      @if (showCreateForm()) {
        <div style="background:var(--color-surface-container-low);border:1px solid var(--color-outline-variant);border-radius:14px;padding:20px;margin-bottom:20px;">
          <p style="font-size:var(--text-body-sm);font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--color-on-surface-variant);margin:0 0 14px;">Nouveau modèle de pause</p>
          @if (formError()) { <div style="background:var(--color-error-container);border-radius:8px;padding:10px;font-size:var(--text-body-sm);color:var(--color-on-error-container);margin-bottom:12px;">{{ formError() }}</div> }
          <div class="ba-form-grid">
            <div class="ba-form-span2">
              <daf-select
                [selected]="formRegimeId ? [String(formRegimeId)] : []"
                [options]="regimeOptions()"
                [config]="{ label: 'Régime horaire *', placeholder: 'Sélectionner un régime…', fullWidth: true }"
                (selectedChange)="formRegimeId = $event[0] ? Number($event[0]) : 0" />
            </div>
            <daf-form-field
              [options]="{ label: 'Libellé FR *', type: 'text', fullWidth: true }"
              [value]="formLabelFr"
              (valueChange)="formLabelFr = $any($event) ?? ''" />
            <daf-form-field
              [options]="{ label: 'Libellé EN', type: 'text', fullWidth: true }"
              [value]="formLabelEn"
              (valueChange)="formLabelEn = $any($event) ?? ''" />
            <daf-select
              [selected]="[formType]"
              [options]="typeOptions"
              [config]="{ label: 'Type *', fullWidth: true }"
              (selectedChange)="formType = $event[0] ?? 'AUTO'" />
            <daf-form-field
              [options]="{ label: 'Durée (minutes) *', type: 'number', fullWidth: true }"
              [value]="formDurationMin"
              (valueChange)="formDurationMin = Number($event) || 0" />
            <daf-select
              [selected]="[formDays]"
              [options]="daysOptions"
              [config]="{ label: 'Jours applicables', fullWidth: true }"
              (selectedChange)="formDays = $event[0] ?? 'ALL'" />
            <daf-form-field
              [options]="{ label: 'Min heures travaillées (déclencheur)', type: 'number', placeholder: 'ex: 6', fullWidth: true }"
              [value]="formMinHours"
              (valueChange)="formMinHours = $event === '' || $event === null ? null : Number($event)" />
            <div>
              <daf-form-field
                [options]="{ label: 'Heure de début (optionnel)', type: 'time', hint: 'Laisser vide = déduction par seuil d\\'heures', fullWidth: true }"
                [value]="formTimeStart"
                (valueChange)="formTimeStart = $any($event) ?? ''" />
            </div>
            <daf-form-field
              [options]="{ label: 'Heure de fin (optionnel)', type: 'time', fullWidth: true }"
              [value]="formTimeEnd"
              (valueChange)="formTimeEnd = $any($event) ?? ''" />
          </div>
          <div style="display:flex;justify-content:flex-end;margin-top:14px;">
            <daf-button
              [label]="isSaving() ? 'Enregistrement…' : 'Enregistrer'" variant="teal"
              [options]="{ disabled: isSaving(), loading: isSaving() }"
              (onClick)="saveTemplate()" />
          </div>
        </div>
      }

      <!-- Templates by regime -->
      @if (isLoading()) {
        <div style="display:flex;flex-direction:column;gap:8px;">
          @for (i of [1,2,3]; track i) {
            <div style="height:60px;border-radius:10px;background:linear-gradient(90deg,var(--color-outline-variant) 25%,var(--color-surface-container-low) 50%,var(--color-outline-variant) 75%);background-size:200% 100%;animation:shimmer 1.5s infinite;"></div>
          }
        </div>
      }

      @if (!isLoading()) {
        @if (groupedTemplates().length === 0) {
          <div style="text-align:center;padding:56px;color:var(--color-outline);">
            <span class="material-symbols-outlined" style="font-size:40px;display:block;margin-bottom:12px;opacity:.4;">list_alt</span>
            <p style="font-size:var(--text-body-sm);margin:0;">Aucun modèle de pause configuré pour cette entité.</p>
            <p style="font-size:var(--text-body-sm);margin:6px 0 0;color:var(--color-outline);">Créez le premier modèle en cliquant sur "Nouveau modèle".</p>
          </div>
        }

        @for (group of groupedTemplates(); track group.regimeId) {
          <div style="margin-bottom:20px;">
            <p style="font-size:var(--text-body-sm);font-weight:700;color:var(--color-on-surface-variant);text-transform:uppercase;letter-spacing:.4px;margin:0 0 8px;display:flex;align-items:center;gap:6px;">
              <span class="material-symbols-outlined" style="font-size:14px;color:var(--color-teal);">schedule</span>
              {{ group.regimeName }}
            </p>
            <div class="table-scroll">
            <daf-data-table [columns]="columns" [rows]="rowsFor(group.templates)" [config]="tableConfig">
              <ng-template dafCell="deductionType" let-row>
                <daf-badge [label]="row['deductionType']" [options]="deductionBadgeOptions(row['deductionType'])" />
              </ng-template>
              <ng-template dafCell="durationMin" let-row>
                <daf-badge [label]="row['durationMin'] + ' min'" [options]="{ variant: 'teal' }" />
              </ng-template>
              <ng-template dafCell="_actions" let-row>
                <daf-button *dafHasPermission="'ADMIN_BREAKS'"
                  class="icon-btn-delete" title="Supprimer"
                  label="" variant="danger"
                  [options]="{ iconStart: 'delete', size: 'sm' }"
                  (onClick)="removeTemplate(row['_source'].id)" />
              </ng-template>
            </daf-data-table>
            </div>
          </div>
        }
      }
    </div>
  }

  <!-- Legal rules tab -->
  @if (activeTab() === 'legal-rules') {
    <app-legal-rules-admin [paysId]="paysId()" />
  }
</div>
  `,
  styles: [`
    @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
    .ba-tab-bar { display:flex;gap:4px;margin-bottom:24px;border-bottom:1px solid var(--color-outline-variant);overflow-x:auto;flex-wrap:wrap }
    .ba-tab-btn { display:flex;align-items:center;gap:6px;padding:10px 16px;border:none;border-bottom:2px solid transparent;background:none;font-family:var(--font-sans);font-size:var(--text-label-sm);font-weight:500;color:var(--color-on-surface-variant);cursor:pointer;white-space:nowrap;margin-bottom:-1px;transition:color var(--duration-normal) var(--ease-smooth),border-color var(--duration-normal) var(--ease-smooth) }
    .ba-tab-btn:hover { color:var(--color-on-surface) }
    .ba-tab-btn.active { color:var(--color-tertiary);border-bottom-color:var(--color-tertiary);font-weight:600 }
    .ba-tab-icon { font-size:18px }
    .ba-header { display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;margin-bottom:20px }
    .ba-form-grid { display:grid;grid-template-columns:1fr 1fr;gap:12px }
    .ba-form-span2 { grid-column:span 2 }
    .table-scroll { overflow-x:auto }

    @media (max-width: 560px) {
      .ba-form-grid { grid-template-columns:1fr }
      .ba-form-span2 { grid-column:span 1 }
    }
  `],
})
export class BreaksAdminComponent implements OnChanges {
  private breakSvc  = inject(BreakService);
  private regimeSvc = inject(RegimeService);
  private modal     = inject(ModalService);

  readonly paysId = input<number>(179);

  activeTab     = signal<BreakTab>('templates');
  templates     = signal<BreakTemplateDto[]>([]);
  regimes       = signal<WorkingTimeRegime[]>([]);
  isLoading     = signal(true);
  showCreateForm = signal(false);
  isSaving      = signal(false);
  formError     = signal<string | null>(null);

  readonly typeOptions: SelectOption[] = [
    { value: 'AUTO', label: 'AUTO — Automatique conditionnelle' },
    { value: 'MANDATORY', label: 'MANDATORY — Obligatoire' },
    { value: 'OPTIONAL', label: 'OPTIONAL — Facultative' },
  ];
  readonly daysOptions: SelectOption[] = [
    { value: 'ALL', label: 'Tous les jours' },
    { value: 'WEEKDAYS', label: 'Jours ouvrés' },
    { value: 'WEEKEND', label: 'Week-end' },
  ];

  regimeOptions = computed<SelectOption[]>(() =>
    this.regimes().map(r => ({ value: String(r.id), label: `${r.labelFr} · ${r.hoursPerWeek}h/sem` }))
  );

  readonly columns: TableColumn[] = [
    { key: 'labelFr', label: 'Libellé' },
    { key: 'deductionType', label: 'Type' },
    { key: 'durationMin', label: 'Durée' },
    { key: 'appliesToDays', label: 'Jours' },
    { key: 'schedule', label: 'Horaire' },
    { key: 'trigger', label: 'Déclencheur' },
    { key: '_actions', label: 'Action', align: 'right' },
  ];

  readonly tableConfig: TableConfig = { hoverable: true };

  rowsFor(templates: BreakTemplateDto[]): TableRow[] {
    return templates.map(t => ({
      labelFr: t.labelFr,
      deductionType: t.deductionType,
      durationMin: t.durationMin,
      appliesToDays: this.formatDays(t.appliesToDays),
      schedule: t.breakTimeStart ? `${t.breakTimeStart} – ${t.breakTimeEnd}` : '—',
      trigger: t.minWorkHoursTrigger ? `≥ ${t.minWorkHoursTrigger}h` : '—',
      _source: t,
    }));
  }

  deductionBadgeOptions(type: string): BadgeOptions {
    if (type === 'MANDATORY') return { variant: 'danger' };
    if (type === 'AUTO') return { variant: 'teal' };
    return { variant: 'neutral' };
  }

  // Form fields
  formRegimeId  = 0;
  formLabelFr   = '';
  formLabelEn   = '';
  formType      = 'AUTO';
  formDurationMin = 30;
  formDays      = 'ALL';
  formMinHours: number | null = null;
  formTimeStart = '';
  formTimeEnd   = '';

  readonly Number = Number;
  readonly String = String;

  groupedTemplates = computed(() => {
    const groups = new Map<number, { regimeId: number; regimeName: string; templates: BreakTemplateDto[] }>();
    for (const t of this.templates()) {
      const regime = this.regimes().find(r => r.id === t.regimeId);
      const name   = regime?.labelFr ?? 'Régime #' + t.regimeId;
      if (!groups.has(t.regimeId)) groups.set(t.regimeId, { regimeId: t.regimeId, regimeName: name, templates: [] });
      groups.get(t.regimeId)!.templates.push(t);
    }
    return Array.from(groups.values());
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['paysId']) this.loadAll();
  }

  loadAll(): void {
    this.isLoading.set(true);
    this.regimeSvc.getRegimes(this.paysId()).subscribe({ next: rs => this.regimes.set(rs) });
    this.breakSvc.getTemplatesForPays(this.paysId()).subscribe({
      next: ts => { this.templates.set(ts); this.isLoading.set(false); },
      error: () => this.isLoading.set(false),
    });
  }

  saveTemplate(): void {
    if (!this.formRegimeId || !this.formLabelFr || !this.formDurationMin) {
      this.formError.set('Régime, libellé et durée sont obligatoires.');
      return;
    }
    this.isSaving.set(true);
    this.formError.set(null);
    const req: CreateBreakTemplateRequest = {
      paysId: this.paysId(),
      regimeId: this.formRegimeId,
      labelFr: this.formLabelFr,
      labelEn: this.formLabelEn || undefined,
      deductionType: this.formType,
      durationMin: this.formDurationMin,
      appliesToDays: this.formDays,
      minWorkHoursTrigger: this.formMinHours ?? undefined,
      sortOrder: this.templates().filter(t => t.regimeId === this.formRegimeId).length,
      breakTimeStart: this.formTimeStart || undefined,
      breakTimeEnd:   this.formTimeEnd   || undefined,
    };
    this.breakSvc.createTemplate(req).subscribe({
      next: t => {
        this.templates.update(ts => [...ts, t]);
        this.showCreateForm.set(false);
        this.isSaving.set(false);
        this.resetForm();
      },
      error: err => {
        this.isSaving.set(false);
        this.formError.set(err?.error?.message ?? 'Erreur lors de la création.');
      },
    });
  }

  removeTemplate(id: number): void {
    this.modal.open({
      title: 'Supprimer le modèle',
      body:  'Supprimer ce modèle de pause ?',
      buttons: [
        { label: 'Annuler',   variant: 'secondary', action: r => r.close() },
        { label: 'Supprimer', variant: 'primary',   action: r => { this.doRemoveTemplate(id); r.close(); } },
      ],
    });
  }

  private doRemoveTemplate(id: number): void {
    this.breakSvc.deleteTemplate(id).subscribe({
      next: () => this.templates.update(ts => ts.filter(t => t.id !== id)),
      error: () => {},
    });
  }

  formatDays(d: string): string {
    const m: Record<string, string> = { ALL: 'Tous', WEEKDAYS: 'Jours ouvrés', WEEKEND: 'Week-end' };
    return m[d] ?? d;
  }

  private resetForm(): void {
    this.formRegimeId = 0; this.formLabelFr = ''; this.formLabelEn = '';
    this.formType = 'AUTO'; this.formDurationMin = 30; this.formDays = 'ALL'; this.formMinHours = null;
    this.formTimeStart = '';
    this.formTimeEnd   = '';
  }
}
