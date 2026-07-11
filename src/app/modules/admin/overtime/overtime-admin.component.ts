import {
  Component, OnChanges, SimpleChanges, inject, input, signal, computed,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import {
  ButtonComponent, FormFieldComponent, SelectComponent, SelectOption, CardComponent,
} from '@khalilrebhiitec/daf360';
import { ModalComponent } from '../../../shared/modal.component';
import { OvertimeService } from './overtime.service';
import {
  ParametrageHSDto, CreateParametrageHSRequest,
  TYPE_CALCUL_OPTIONS, DAYS_OPTIONS, OvertimeCalculationRequest, OvertimeCalculationResult,
} from './overtime.model';
import { UserStore } from '../../../core/user.store';

@Component({
  selector: 'app-overtime-admin',
  standalone: true,
  imports: [DecimalPipe, ButtonComponent, FormFieldComponent, SelectComponent, CardComponent, ModalComponent],
  template: `
<div>

  <!-- Header -->
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
    <div>
      <h2 style="font-size:var(--text-headline-md);font-weight:700;color:var(--color-primary);margin:0;">Heures supplémentaires par pays</h2>
      <p style="font-size:var(--text-body-sm);color:var(--color-on-surface-variant);margin:3px 0 0;">Configuration des règles de calcul selon le type de pays</p>
    </div>
    <daf-button
      label="Nouvelle règle" variant="teal"
      [options]="{ iconStart: 'add' }"
      (onClick)="openNewForm()" />
  </div>

  <!-- Simulator -->
  <daf-card style="display:block;margin-bottom:20px;" [options]="{ variant: 'glass', padding: 'lg', radius: 'lg' }">
    <h3 style="font-size:var(--text-body-lg);font-weight:700;color:var(--color-primary);margin:0 0 16px;display:flex;align-items:center;gap:8px;">
      <span class="material-symbols-outlined" style="font-size:18px;color:var(--color-secondary);">calculate</span>
      Simulateur de calcul HS
    </h3>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:12px;">
      <daf-select
        [selected]="simPaysId ? [String(simPaysId)] : []"
        [options]="paysOptions()"
        [config]="{ label: 'Pays', placeholder: 'Sélectionner…', fullWidth: true }"
        (selectedChange)="simPaysId = $event[0] ? Number($event[0]) : 0" />
      <daf-form-field
        [options]="{ label: 'Date', type: 'date', fullWidth: true }"
        [value]="simDate"
        (valueChange)="simDate = $any($event)" />
      <daf-form-field
        [options]="{ label: 'Heures brutes', type: 'number', fullWidth: true }"
        [value]="simGrossHours"
        (valueChange)="simGrossHours = Number($event) || 0" />
      <daf-form-field
        [options]="{ label: 'Heure début', type: 'time', fullWidth: true }"
        [value]="simStart"
        (valueChange)="simStart = $any($event)" />
      <daf-form-field
        [options]="{ label: 'Heure fin', type: 'time', fullWidth: true }"
        [value]="simEnd"
        (valueChange)="simEnd = $any($event)" />
      <div style="display:flex;align-items:flex-end;">
        <daf-button
          [label]="isSimulating() ? 'Calcul…' : 'Simuler'" variant="teal"
          [options]="{ disabled: isSimulating(), loading: isSimulating(), fullWidth: true }"
          (onClick)="simulate()" />
      </div>
    </div>
    @if (simResult()) {
      <div style="background:var(--color-surface-container-low);border-radius:10px;padding:14px 16px;border:1px solid var(--color-outline-variant);">
        <div style="display:flex;gap:24px;flex-wrap:wrap;margin-bottom:8px;">
          <div><span style="font-size:var(--text-label-sm);color:var(--color-on-surface-variant);text-transform:uppercase;letter-spacing:.4px;">Heures normales</span><br/>
            <span style="font-size:20px;font-weight:800;color:var(--color-primary);">{{ simResult()!.normalHours | number:'1.2-2' }}h</span></div>
          <div><span style="font-size:var(--text-label-sm);color:var(--color-danger);text-transform:uppercase;letter-spacing:.4px;">Heures supp.</span><br/>
            <span style="font-size:20px;font-weight:800;color:var(--color-danger);">{{ simResult()!.overtimeHours | number:'1.2-2' }}h</span></div>
          <div><span style="font-size:var(--text-label-sm);color:var(--color-on-surface-variant);text-transform:uppercase;letter-spacing:.4px;">Règle appliquée</span><br/>
            <span style="font-size:var(--text-body-md);font-weight:700;color:var(--color-secondary);">{{ simResult()!.ruleApplied }}</span></div>
          <div><span style="font-size:var(--text-label-sm);color:var(--color-on-surface-variant);text-transform:uppercase;letter-spacing:.4px;">Jour de repos ?</span><br/>
            <span style="font-size:var(--text-body-md);font-weight:700;" [style.color]="simResult()!.isWeekendDay ? 'var(--color-danger)' : 'var(--color-success)'">
              {{ simResult()!.isWeekendDay ? 'Oui' : 'Non' }}
            </span></div>
        </div>
        <p style="font-size:var(--text-body-sm);color:var(--color-on-surface-variant);margin:0;font-style:italic;">{{ simResult()!.explanation }}</p>
      </div>
    }
  </daf-card>

  <!-- Rules table -->
  @if (isLoading()) {
    <div style="height:120px;border-radius:12px;background:linear-gradient(90deg,var(--color-outline-variant) 25%,var(--color-surface-container-low) 50%,var(--color-outline-variant) 75%);background-size:200% 100%;animation:shimmer 1.5s infinite;"></div>
  }

  @if (!isLoading() && rules().length > 0) {
    <daf-card [options]="{ variant: 'glass', padding: 'none', radius: 'lg' }">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:var(--color-background);">
            <th style="padding:10px 16px;text-align:left;font-size:var(--text-label-sm);font-weight:700;color:var(--color-on-surface-variant);text-transform:uppercase;letter-spacing:.5px;">Pays</th>
            <th style="padding:10px 16px;text-align:left;font-size:var(--text-label-sm);font-weight:700;color:var(--color-on-surface-variant);text-transform:uppercase;letter-spacing:.5px;">Type de calcul</th>
            <th style="padding:10px 16px;text-align:left;font-size:var(--text-label-sm);font-weight:700;color:var(--color-on-surface-variant);text-transform:uppercase;letter-spacing:.5px;">Horaires normaux</th>
            <th style="padding:10px 16px;text-align:left;font-size:var(--text-label-sm);font-weight:700;color:var(--color-on-surface-variant);text-transform:uppercase;letter-spacing:.5px;">Semaine de travail</th>
            <th style="padding:10px 16px;text-align:left;font-size:var(--text-label-sm);font-weight:700;color:var(--color-on-surface-variant);text-transform:uppercase;letter-spacing:.5px;">Statut</th>
            <th style="padding:10px 16px;text-align:right;font-size:var(--text-label-sm);font-weight:700;color:var(--color-on-surface-variant);text-transform:uppercase;letter-spacing:.5px;">Action</th>
          </tr>
        </thead>
        <tbody>
          @for (rule of rules(); track rule.idParametrage) {
            <tr style="border-top:1px solid var(--color-outline-variant);">
              <td style="padding:12px 16px;font-size:var(--text-body-md);font-weight:600;color:var(--color-primary);">
                <span style="background:#e6f4f6;color:var(--color-teal-light);padding:3px 10px;border-radius:999px;font-size:var(--text-body-sm);font-weight:700;font-family:monospace;">{{ rule.paysIsoCode }}</span>
              </td>
              <td style="padding:12px 16px;">
                <span style="font-size:var(--text-body-sm);padding:3px 10px;border-radius:999px;font-weight:700;"
                  [style.background]="rule.typeCalculHs === 'WEEKEND_ONLY' ? '#dbeafe' : rule.typeCalculHs === 'AFTER_WORK_HOURS' ? '#fef3c7' : '#ede9fe'"
                  [style.color]="rule.typeCalculHs === 'WEEKEND_ONLY' ? '#1e40af' : rule.typeCalculHs === 'AFTER_WORK_HOURS' ? '#92400e' : '#5b21b6'">
                  {{ getTypeLabel(rule.typeCalculHs) }}
                </span>
              </td>
              <td style="padding:12px 16px;font-size:var(--text-body-sm);color:var(--color-on-surface-variant);">
                @if (rule.heureDebutTravail && rule.heureFinTravail) {
                  {{ rule.heureDebutTravail.slice(0,5) }} → {{ rule.heureFinTravail.slice(0,5) }}
                } @else { — }
              </td>
              <td style="padding:12px 16px;font-size:var(--text-body-sm);color:var(--color-on-surface-variant);">
                @if (rule.jourDebutSemaine && rule.jourFinSemaine) {
                  {{ getDayLabel(rule.jourDebutSemaine) }} → {{ getDayLabel(rule.jourFinSemaine) }}
                } @else { — }
              </td>
              <td style="padding:12px 16px;">
                <span style="font-size:var(--text-body-sm);padding:2px 10px;border-radius:999px;font-weight:700;"
                  [style.background]="rule.actif ? '#dcfce7' : '#f1f5f9'"
                  [style.color]="rule.actif ? 'var(--color-success)' : '#475569'">
                  {{ rule.actif ? 'Actif' : 'Inactif' }}
                </span>
              </td>
              <td style="padding:12px 16px;text-align:right;display:flex;gap:6px;justify-content:flex-end;align-items:center;">
                @if (rule.actif) {
                  <daf-button
                    label="Modifier" variant="secondary" [options]="{ size: 'sm' }"
                    (onClick)="openEditForm(rule)" />
                  <daf-button
                    label="Désactiver" variant="danger" [options]="{ size: 'sm' }"
                    (onClick)="deactivate(rule.idParametrage)" />
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
    </daf-card>
  }

</div>

<!-- Create / Edit modal -->
<app-modal
  [title]="editingId() ? 'Modifier la règle HS' : 'Nouvelle règle HS'"
  [visible]="showForm()"
  [hasFooter]="true"
  (closed)="showForm.set(false)"
>
  @if (formError()) {
    <div style="background:var(--color-error-container);border-radius:8px;padding:10px;font-size:var(--text-body-sm);color:var(--color-on-error-container);margin-bottom:12px;">{{ formError() }}</div>
  }
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
    <daf-select
      [selected]="formPaysId ? [String(formPaysId)] : []"
      [options]="paysOptions()"
      [config]="{ label: 'Pays *', placeholder: 'Sélectionner un pays…', disabled: !!editingId(), fullWidth: true }"
      (selectedChange)="formPaysId = $event[0] ? Number($event[0]) : 0" />
    <div>
      <daf-select
        [selected]="[formType]"
        [options]="typeOptions"
        [config]="{ label: 'Type de calcul *', fullWidth: true }"
        (selectedChange)="formType = $event[0] ?? 'WEEKEND_ONLY'" />
      @if (formType) {
        <small style="font-size:var(--text-label-sm);color:var(--color-outline);">{{ getTypeDesc(formType) }}</small>
      }
    </div>

    @if (formType === 'AFTER_WORK_HOURS' || formType === 'MIXTE') {
      <daf-form-field
        [options]="{ label: 'Heure début travail', type: 'time', fullWidth: true }"
        [value]="formHeureDebut"
        (valueChange)="formHeureDebut = $any($event)" />
      <daf-form-field
        [options]="{ label: 'Heure fin travail', type: 'time', fullWidth: true }"
        [value]="formHeureFin"
        (valueChange)="formHeureFin = $any($event)" />
    }

    <daf-select
      [selected]="formJourDebut ? [formJourDebut] : []"
      [options]="daysOptions"
      [config]="{ label: '1er jour ouvré', placeholder: '— Optionnel —', fullWidth: true }"
      (selectedChange)="formJourDebut = $event[0] ?? ''" />
    <daf-select
      [selected]="formJourFin ? [formJourFin] : []"
      [options]="daysOptions"
      [config]="{ label: 'Dernier jour ouvré', placeholder: '— Optionnel —', fullWidth: true }"
      (selectedChange)="formJourFin = $event[0] ?? ''" />
  </div>
  <div slot="footer">
    <daf-button label="Annuler" variant="secondary" (onClick)="showForm.set(false)" />
    <daf-button
      [label]="isSaving() ? 'Enregistrement…' : (editingId() ? 'Mettre à jour' : 'Enregistrer')" variant="teal"
      [options]="{ disabled: isSaving(), loading: isSaving() }"
      (onClick)="saveRule()" />
  </div>
</app-modal>
  `,
  styles: [`@keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }`],
})
export class OvertimeAdminComponent implements OnChanges {
  private svc = inject(OvertimeService);
  private userStore = inject(UserStore);

  readonly paysId = input<number>(179);

  rules        = signal<ParametrageHSDto[]>([]);
  isLoading    = signal(true);
  showForm     = signal(false);
  isSaving     = signal(false);
  formError    = signal<string | null>(null);

  readonly typeOptions: SelectOption[] = TYPE_CALCUL_OPTIONS;
  readonly daysOptions: SelectOption[] = DAYS_OPTIONS;

  readonly Number = Number;
  readonly String = String;

  // Form fields
  formPaysId   = 0;
  formType     = 'WEEKEND_ONLY';
  formHeureDebut = '';
  formHeureFin   = '';
  formJourDebut  = '';
  formJourFin    = '';

  // Simulator
  simPaysId    = 0;
  simDate      = new Date().toISOString().split('T')[0];
  simGrossHours = 8;
  simStart     = '';
  simEnd       = '';
  simResult    = signal<OvertimeCalculationResult | null>(null);
  isSimulating = signal(false);

  availablePays = signal<{ id: number; isoCode: string; frenchLabel: string }[]>([]);
  editingId     = signal<number | null>(null);

  paysOptions = computed<SelectOption[]>(() =>
    this.availablePays().map(p => ({ value: String(p.id), label: p.frenchLabel }))
  );

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['paysId']) this.loadAll();
  }

  private loadAll(): void {
    this.isLoading.set(true);
    this.svc.getAll().subscribe({
      next: r => { this.rules.set(r); this.isLoading.set(false); },
      error: () => this.isLoading.set(false),
    });
    this.loadPays();
  }

  private loadPays(): void {
    this.svc.getAllPays().subscribe(list => {
      this.availablePays.set(list.map(p => ({
        id: p.id as number,
        isoCode: p.iso_code as string,
        frenchLabel: (p.french_label as string) || (p.iso_code as string),
      })));
    });
  }

  openNewForm(): void {
    this.editingId.set(null);
    this.resetForm();
    this.formError.set(null);
    this.showForm.set(true);
  }

  openEditForm(rule: ParametrageHSDto): void {
    this.editingId.set(rule.idParametrage);
    this.formPaysId     = rule.paysId;
    this.formType       = rule.typeCalculHs;
    this.formHeureDebut = rule.heureDebutTravail ? rule.heureDebutTravail.slice(0, 5) : '';
    this.formHeureFin   = rule.heureFinTravail   ? rule.heureFinTravail.slice(0, 5)   : '';
    this.formJourDebut  = rule.jourDebutSemaine  ?? '';
    this.formJourFin    = rule.jourFinSemaine    ?? '';
    this.formError.set(null);
    this.showForm.set(true);
  }

  saveRule(): void {
    if (!this.formPaysId || !this.formType) {
      this.formError.set('Pays et type de calcul sont obligatoires.');
      return;
    }
    this.isSaving.set(true);
    this.formError.set(null);
    const req: CreateParametrageHSRequest = {
      paysId: this.formPaysId,
      typeCalculHs: this.formType as CreateParametrageHSRequest['typeCalculHs'],
      heureDebutTravail: this.formHeureDebut || undefined,
      heureFinTravail:   this.formHeureFin   || undefined,
      jourDebutSemaine:  this.formJourDebut  || undefined,
      jourFinSemaine:    this.formJourFin    || undefined,
    };
    const id = this.editingId();
    const op$ = id ? this.svc.update(id, req) : this.svc.create(req);
    op$.subscribe({
      next: r => {
        this.rules.update(rs => {
          const filtered = id
            ? rs.filter(x => x.idParametrage !== id)
            : rs.filter(x => x.paysId !== r.paysId || !x.actif);
          return [r, ...filtered];
        });
        this.showForm.set(false);
        this.isSaving.set(false);
        this.editingId.set(null);
        this.resetForm();
      },
      error: (err: { error?: { message?: string } }) => {
        this.isSaving.set(false);
        this.formError.set(err?.error?.message ?? (id ? 'Erreur lors de la modification.' : 'Erreur lors de la création.'));
      },
    });
  }

  deactivate(id: number): void {
    if (!confirm('Désactiver cette règle HS ?')) return;
    this.svc.deactivate(id).subscribe({
      next: () => this.rules.update(rs => rs.map(r => r.idParametrage === id ? { ...r, actif: false } : r)),
      error: () => {},
    });
  }

  simulate(): void {
    if (!this.simPaysId || !this.simDate) return;
    this.isSimulating.set(true);
    const req: OvertimeCalculationRequest = {
      paysId: this.simPaysId,
      workDate: this.simDate,
      grossHours: this.simGrossHours,
      workStartTime: this.simStart || undefined,
      workEndTime:   this.simEnd   || undefined,
    };
    this.svc.calculate(req).subscribe({
      next: r => { this.simResult.set(r); this.isSimulating.set(false); },
      error: () => this.isSimulating.set(false),
    });
  }

  getTypeLabel(t: string): string {
    return TYPE_CALCUL_OPTIONS.find(o => o.value === t)?.label ?? t;
  }
  getTypeDesc(t: string): string {
    return TYPE_CALCUL_OPTIONS.find(o => o.value === t)?.desc ?? '';
  }
  getDayLabel(d: string): string {
    return DAYS_OPTIONS.find(o => o.value === d)?.label ?? d;
  }

  private resetForm(): void {
    this.formPaysId = 0; this.formType = 'WEEKEND_ONLY';
    this.formHeureDebut = ''; this.formHeureFin = '';
    this.formJourDebut = ''; this.formJourFin = '';
  }
}
