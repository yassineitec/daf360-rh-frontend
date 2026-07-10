import {
  Component, OnChanges, SimpleChanges, inject, input, signal, computed,
} from '@angular/core';
import {
  ButtonComponent, FormFieldComponent, SelectComponent, SelectOption, CardComponent,
} from '@khalilrebhiitec/daf360';
import { BreakService } from './breaks/break.service';
import { RegimeService } from './regimes/regime.service';
import { LegalRulesAdminComponent } from './breaks/legal-rules-admin.component';
import {
  BreakTemplateDto, CreateBreakTemplateRequest,
} from './breaks/break.model';
import { WorkingTimeRegime } from './regimes/regime.model';
import { PermissionDirective } from '../../shared/permission.directive';

type BreakTab = 'templates' | 'legal-rules';

@Component({
  selector: 'app-breaks-admin',
  standalone: true,
  imports: [
    ButtonComponent, FormFieldComponent, SelectComponent, CardComponent,
    LegalRulesAdminComponent, PermissionDirective,
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
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
        <div>
          <h2 style="font-size:var(--text-headline-md);font-weight:700;color:var(--color-primary);margin:0;">Modèles de pause</h2>
          <p style="font-size:var(--text-body-sm);color:var(--color-on-surface-variant);margin:3px 0 0;">Pauses automatiques par régime horaire</p>
        </div>
        <daf-button *appHasPermission="'ADMIN_BREAKS'"
          [label]="showCreateForm() ? 'Annuler' : 'Nouveau modèle'" variant="teal"
          [options]="{ iconStart: showCreateForm() ? 'close' : 'add' }"
          (onClick)="showCreateForm.set(!showCreateForm())" />
      </div>

      <!-- Create form -->
      @if (showCreateForm()) {
        <div style="background:var(--color-surface-container-low);border:1px solid var(--color-outline-variant);border-radius:14px;padding:20px;margin-bottom:20px;">
          <p style="font-size:var(--text-body-sm);font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--color-on-surface-variant);margin:0 0 14px;">Nouveau modèle de pause</p>
          @if (formError()) { <div style="background:var(--color-error-container);border-radius:8px;padding:10px;font-size:var(--text-body-sm);color:var(--color-on-error-container);margin-bottom:12px;">{{ formError() }}</div> }
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div style="grid-column:span 2">
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
            <daf-card [options]="{ variant: 'glass', padding: 'none', radius: 'lg' }">
              <table style="width:100%;border-collapse:collapse;">
                <thead>
                  <tr style="background:var(--color-background);">
                    <th style="padding:10px 16px;text-align:left;font-size:var(--text-label-sm);font-weight:700;color:var(--color-on-surface-variant);text-transform:uppercase;letter-spacing:.5px;">Libellé</th>
                    <th style="padding:10px 16px;text-align:left;font-size:var(--text-label-sm);font-weight:700;color:var(--color-on-surface-variant);text-transform:uppercase;letter-spacing:.5px;">Type</th>
                    <th style="padding:10px 16px;text-align:left;font-size:var(--text-label-sm);font-weight:700;color:var(--color-on-surface-variant);text-transform:uppercase;letter-spacing:.5px;">Durée</th>
                    <th style="padding:10px 16px;text-align:left;font-size:var(--text-label-sm);font-weight:700;color:var(--color-on-surface-variant);text-transform:uppercase;letter-spacing:.5px;">Jours</th>
                    <th style="padding:10px 16px;text-align:left;font-size:var(--text-label-sm);font-weight:700;color:var(--color-on-surface-variant);text-transform:uppercase;letter-spacing:.5px;">Horaire</th>
                    <th style="padding:10px 16px;text-align:left;font-size:var(--text-label-sm);font-weight:700;color:var(--color-on-surface-variant);text-transform:uppercase;letter-spacing:.5px;">Déclencheur</th>
                    <th style="padding:10px 16px;text-align:right;font-size:var(--text-label-sm);font-weight:700;color:var(--color-on-surface-variant);text-transform:uppercase;letter-spacing:.5px;">Action</th>
                  </tr>
                </thead>
                <tbody>
                  @for (t of group.templates; track t.id) {
                    <tr style="border-top:1px solid var(--color-outline-variant);">
                      <td style="padding:12px 16px;font-size:var(--text-body-md);font-weight:500;color:var(--color-primary);">{{ t.labelFr }}</td>
                      <td style="padding:12px 16px;">
                        <span style="font-size:var(--text-body-sm);padding:3px 10px;border-radius:999px;font-weight:700;"
                          [style.background]="t.deductionType==='MANDATORY' ? 'var(--color-error-container)' : t.deductionType==='AUTO' ? '#e6f4f6' : '#f1f5f9'"
                          [style.color]="t.deductionType==='MANDATORY' ? 'var(--color-on-error-container)' : t.deductionType==='AUTO' ? 'var(--color-teal-light)' : '#475569'">
                          {{ t.deductionType }}
                        </span>
                      </td>
                      <td style="padding:12px 16px;">
                        <span style="background:#e6f4f6;color:var(--color-teal-light);font-size:var(--text-body-sm);padding:3px 10px;border-radius:999px;font-weight:600;">{{ t.durationMin }} min</span>
                      </td>
                      <td style="padding:12px 16px;font-size:var(--text-body-sm);color:var(--color-on-surface-variant);">{{ formatDays(t.appliesToDays) }}</td>
                      <td style="padding:12px 16px;font-size:var(--text-body-sm);color:var(--color-on-surface-variant);">{{ t.breakTimeStart ? t.breakTimeStart + ' – ' + t.breakTimeEnd : '—' }}</td>
                      <td style="padding:12px 16px;font-size:var(--text-body-sm);color:var(--color-on-surface-variant);">
                        {{ t.minWorkHoursTrigger ? '≥ ' + t.minWorkHoursTrigger + 'h' : '—' }}
                      </td>
                      <td style="padding:12px 16px;text-align:right;">
                        <daf-button *appHasPermission="'ADMIN_BREAKS'"
                          label="" variant="danger"
                          [options]="{ iconStart: 'delete', size: 'sm' }"
                          (onClick)="removeTemplate(t.id)" />
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </daf-card>
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
    .ba-tab-bar { display:flex;gap:4px;margin-bottom:24px;background:var(--color-background);padding:4px;border-radius:12px;width:fit-content }
    .ba-tab-btn { display:flex;align-items:center;gap:6px;padding:8px 16px;border:none;border-radius:8px;background:none;font-family:var(--font-sans);font-size:var(--text-label-sm);font-weight:600;color:var(--color-on-surface-variant);cursor:pointer;white-space:nowrap;transition:background-color var(--duration-normal) var(--ease-smooth),color var(--duration-normal) var(--ease-smooth) }
    .ba-tab-btn:hover { color:var(--color-on-surface) }
    .ba-tab-btn.active { color:#fff;background:var(--color-teal);box-shadow:var(--shadow-sm) }
    .ba-tab-icon { font-size:18px }
  `],
})
export class BreaksAdminComponent implements OnChanges {
  private breakSvc  = inject(BreakService);
  private regimeSvc = inject(RegimeService);

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
    if (!confirm('Supprimer ce modèle de pause ?')) return;
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
