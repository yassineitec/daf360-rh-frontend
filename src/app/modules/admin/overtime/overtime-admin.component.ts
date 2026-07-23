import {
  Component, OnChanges, SimpleChanges, inject, input, signal, computed,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import {
  ButtonComponent, FormFieldComponent, SelectComponent, SelectOption, CardComponent,
  StatusBadgeComponent, BadgeOptions, DataTableComponent, DafCellDirective,
  TableColumn, TableConfig, TableRow, ModalService,
} from '@khalilrebhiitec/daf360';
import { ModalComponent } from '../../../shared/modal.component';
import { OvertimeService } from './overtime.service';
import {
  ParametrageHSDto, CreateParametrageHSRequest,
  TYPE_CALCUL_OPTIONS, DAYS_OPTIONS, OvertimeCalculationRequest, OvertimeCalculationResult,
} from './overtime.model';
import { UserStore } from '../../../core/user.store';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-overtime-admin',
  standalone: true,
  imports: [
    DecimalPipe, ButtonComponent, FormFieldComponent, SelectComponent, CardComponent, ModalComponent,
    StatusBadgeComponent, DataTableComponent, DafCellDirective, TranslatePipe,
  ],
  template: `
<div>

  <!-- Header -->
  <div class="ova-header">
    <div>
      <h2 style="font-size:var(--text-headline-md);font-weight:700;color:var(--color-primary);margin:0;">{{ 'ADMIN.regimes.overtime.title' | translate }}</h2>
      <p style="font-size:var(--text-body-sm);color:var(--color-on-surface-variant);margin:3px 0 0;">{{ 'ADMIN.regimes.overtime.subtitle' | translate }}</p>
    </div>
    <daf-button class="desktop-only"
      [label]="'ADMIN.regimes.overtime.newRule' | translate" variant="teal"
      [options]="{ iconStart: 'add' }"
      (onClick)="openNewForm()" />
    <daf-button class="icon-btn-toggle mobile-only"
      [title]="'ADMIN.regimes.overtime.newRule' | translate" variant="teal"
      [options]="{ iconStart: 'add', size: 'sm' }"
      (onClick)="openNewForm()" />
  </div>

  <!-- Simulator -->
  <daf-card style="display:block;margin-bottom:20px;" [options]="{ variant: 'glass', padding: 'lg', radius: 'lg' }">
    <h3 style="font-size:var(--text-body-lg);font-weight:700;color:var(--color-primary);margin:0 0 16px;display:flex;align-items:center;gap:8px;">
      <span class="material-symbols-outlined" style="font-size:18px;color:var(--color-secondary);">calculate</span>
      {{ 'ADMIN.regimes.overtime.simulatorTitle' | translate }}
    </h3>
    <div class="ova-sim-grid">
      <daf-select
        [selected]="simPaysId ? [String(simPaysId)] : []"
        [options]="paysOptions()"
        [config]="{ label: ('ADMIN.regimes.overtime.country' | translate), placeholder: ('ADMIN.regimes.overtime.selectPlaceholder' | translate), fullWidth: true }"
        (selectedChange)="simPaysId = $event[0] ? Number($event[0]) : 0" />
      <daf-form-field
        [options]="{ label: ('ADMIN.regimes.overtime.date' | translate), type: 'date', fullWidth: true }"
        [value]="simDate"
        (valueChange)="simDate = $any($event)" />
      <daf-form-field
        [options]="{ label: ('ADMIN.regimes.overtime.grossHours' | translate), type: 'number', fullWidth: true }"
        [value]="simGrossHours"
        (valueChange)="simGrossHours = Number($event) || 0" />
      <daf-form-field
        [options]="{ label: ('ADMIN.regimes.overtime.startTime' | translate), type: 'time', fullWidth: true }"
        [value]="simStart"
        (valueChange)="simStart = $any($event)" />
      <daf-form-field
        [options]="{ label: ('ADMIN.regimes.overtime.endTime' | translate), type: 'time', fullWidth: true }"
        [value]="simEnd"
        (valueChange)="simEnd = $any($event)" />
      <div style="display:flex;align-items:flex-end;">
        <daf-button
          [label]="(isSimulating() ? 'ADMIN.regimes.overtime.calculating' : 'ADMIN.regimes.overtime.simulate') | translate" variant="teal"
          [options]="{ disabled: isSimulating(), loading: isSimulating(), fullWidth: true }"
          (onClick)="simulate()" />
      </div>
    </div>
    @if (simResult()) {
      <div style="background:var(--color-surface-container-low);border-radius:10px;padding:14px 16px;border:1px solid var(--color-outline-variant);">
        <div style="display:flex;gap:24px;flex-wrap:wrap;margin-bottom:8px;">
          <div><span style="font-size:var(--text-label-sm);color:var(--color-on-surface-variant);text-transform:uppercase;letter-spacing:.4px;">{{ 'ADMIN.regimes.overtime.normalHours' | translate }}</span><br/>
            <span style="font-size:20px;font-weight:800;color:var(--color-primary);">{{ simResult()!.normalHours | number:'1.2-2' }}h</span></div>
          <div><span style="font-size:var(--text-label-sm);color:var(--color-danger);text-transform:uppercase;letter-spacing:.4px;">{{ 'ADMIN.regimes.overtime.overtimeHours' | translate }}</span><br/>
            <span style="font-size:20px;font-weight:800;color:var(--color-danger);">{{ simResult()!.overtimeHours | number:'1.2-2' }}h</span></div>
          <div><span style="font-size:var(--text-label-sm);color:var(--color-on-surface-variant);text-transform:uppercase;letter-spacing:.4px;">{{ 'ADMIN.regimes.overtime.ruleApplied' | translate }}</span><br/>
            <span style="font-size:var(--text-body-md);font-weight:700;color:var(--color-secondary);">{{ simResult()!.ruleApplied }}</span></div>
          <div><span style="font-size:var(--text-label-sm);color:var(--color-on-surface-variant);text-transform:uppercase;letter-spacing:.4px;">{{ 'ADMIN.regimes.overtime.restDay' | translate }}</span><br/>
            <span style="font-size:var(--text-body-md);font-weight:700;" [style.color]="simResult()!.isWeekendDay ? 'var(--color-danger)' : 'var(--color-success)'">
              {{ (simResult()!.isWeekendDay ? 'ADMIN.regimes.common.yes' : 'ADMIN.regimes.common.no') | translate }}
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
    <div class="table-scroll">
    <daf-data-table [columns]="columns()" [rows]="rows()" [config]="tableConfig">
      <ng-template dafCell="paysIsoCode" let-row>
        <daf-badge [label]="row['paysIsoCode']" [options]="{ variant: 'teal' }" />
      </ng-template>
      <ng-template dafCell="typeCalculHs" let-row>
        <daf-badge [label]="getTypeLabel(row['_source'].typeCalculHs)" [options]="typeBadgeOptions(row['_source'].typeCalculHs)" />
      </ng-template>
      <ng-template dafCell="actif" let-row>
        <daf-badge [label]="(row['_source'].actif ? 'ADMIN.regimes.overtime.active' : 'ADMIN.regimes.overtime.inactive') | translate" [options]="{ variant: row['_source'].actif ? 'success' : 'neutral' }" />
      </ng-template>
      <ng-template dafCell="_actions" let-row>
        @if (row['_source'].actif) {
          <daf-button
            [label]="'ADMIN.regimes.common.edit' | translate" variant="secondary" [options]="{ size: 'sm' }"
            (onClick)="openEditForm(row['_source'])" />
          <daf-button
            [label]="'ADMIN.regimes.overtime.deactivate' | translate" variant="danger" [options]="{ size: 'sm' }"
            (onClick)="deactivate(row['_source'].idParametrage)" />
        }
      </ng-template>
    </daf-data-table>
    </div>
  }

</div>

<!-- Create / Edit modal -->
<app-modal
  [title]="(editingId() ? 'ADMIN.regimes.overtime.editRuleTitle' : 'ADMIN.regimes.overtime.newRuleTitle') | translate"
  [visible]="showForm()"
  [hasFooter]="true"
  (closed)="showForm.set(false)"
>
  @if (formError()) {
    <div style="background:var(--color-error-container);border-radius:8px;padding:10px;font-size:var(--text-body-sm);color:var(--color-on-error-container);margin-bottom:12px;">{{ formError() }}</div>
  }
  <div class="ova-form-grid">
    <daf-select
      [selected]="formPaysId ? [String(formPaysId)] : []"
      [options]="paysOptions()"
      [config]="{ label: ('ADMIN.regimes.overtime.countryRequired' | translate), placeholder: ('ADMIN.regimes.overtime.selectCountryPlaceholder' | translate), disabled: !!editingId(), fullWidth: true }"
      (selectedChange)="formPaysId = $event[0] ? Number($event[0]) : 0" />
    <div>
      <daf-select
        [selected]="[formType]"
        [options]="typeOptions()"
        [config]="{ label: ('ADMIN.regimes.overtime.calcType' | translate), fullWidth: true }"
        (selectedChange)="formType = $event[0]" />
      @if (formType) {
        <small style="font-size:var(--text-label-sm);color:var(--color-outline);">{{ getTypeDesc(formType) }}</small>
      }
    </div>

    @if (formType === 'AFTER_WORK_HOURS' || formType === 'MIXTE') {
      <daf-form-field
        [options]="{ label: ('ADMIN.regimes.overtime.workStart' | translate), type: 'time', fullWidth: true }"
        [value]="formHeureDebut"
        (valueChange)="formHeureDebut = $any($event)" />
      <daf-form-field
        [options]="{ label: ('ADMIN.regimes.overtime.workEnd' | translate), type: 'time', fullWidth: true }"
        [value]="formHeureFin"
        (valueChange)="formHeureFin = $any($event)" />
    }

    <daf-select
      [selected]="formJourDebut ? [formJourDebut] : []"
      [options]="daysOptions()"
      [config]="{ label: ('ADMIN.regimes.overtime.firstWorkDay' | translate), placeholder: ('ADMIN.regimes.overtime.optional' | translate), fullWidth: true }"
      (selectedChange)="formJourDebut = $event[0]" />
    <daf-select
      [selected]="formJourFin ? [formJourFin] : []"
      [options]="daysOptions()"
      [config]="{ label: ('ADMIN.regimes.overtime.lastWorkDay' | translate), placeholder: ('ADMIN.regimes.overtime.optional' | translate), fullWidth: true }"
      (selectedChange)="formJourFin = $event[0]" />
  </div>
  <div slot="footer">
    <daf-button [label]="'ADMIN.regimes.common.cancel' | translate" variant="secondary" (onClick)="showForm.set(false)" />
    <daf-button
      [label]="(isSaving() ? 'ADMIN.regimes.common.saving' : (editingId() ? 'ADMIN.regimes.common.update' : 'ADMIN.regimes.common.save')) | translate" variant="teal"
      [options]="{ disabled: isSaving(), loading: isSaving() }"
      (onClick)="saveRule()" />
  </div>
</app-modal>
  `,
  styles: [`
    @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
    .ova-header { display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;margin-bottom:20px }
    .ova-sim-grid { display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:12px }
    .ova-form-grid { display:grid;grid-template-columns:1fr 1fr;gap:12px }
    .table-scroll { overflow-x:auto }

    @media (max-width: 700px) {
      .ova-sim-grid { grid-template-columns:1fr 1fr }
    }
    @media (max-width: 480px) {
      .ova-sim-grid { grid-template-columns:1fr }
      .ova-form-grid { grid-template-columns:1fr }
    }

    .mobile-only { display:none }
    @media (max-width: 640px) {
      .desktop-only { display:none }
      .mobile-only  { display:inline-flex }
    }
  `],
})
export class OvertimeAdminComponent implements OnChanges {
  private svc = inject(OvertimeService);
  private userStore = inject(UserStore);
  private modal = inject(ModalService);
  private translate = inject(TranslateService);

  readonly paysId = input<number>(179);

  rules        = signal<ParametrageHSDto[]>([]);
  isLoading    = signal(true);
  showForm     = signal(false);
  isSaving     = signal(false);
  formError    = signal<string | null>(null);

  readonly typeOptions = computed<SelectOption[]>(() => {
    this.translate.currentLang();
    return TYPE_CALCUL_OPTIONS.map(o => ({ value: o.value, label: this.getTypeLabel(o.value) }));
  });
  readonly daysOptions = computed<SelectOption[]>(() => {
    this.translate.currentLang();
    return DAYS_OPTIONS.map(o => ({ value: o.value, label: this.getDayLabel(o.value) }));
  });

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

  readonly columns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    return [
      { key: 'paysIsoCode', label: this.translate.instant('ADMIN.regimes.overtime.columns.country') },
      { key: 'typeCalculHs', label: this.translate.instant('ADMIN.regimes.overtime.columns.calcType') },
      { key: 'schedule', label: this.translate.instant('ADMIN.regimes.overtime.columns.schedule') },
      { key: 'week', label: this.translate.instant('ADMIN.regimes.overtime.columns.week') },
      { key: 'actif', label: this.translate.instant('ADMIN.regimes.overtime.columns.status') },
      { key: '_actions', label: this.translate.instant('ADMIN.regimes.common.action'), align: 'right' },
    ];
  });

  readonly tableConfig: TableConfig = { hoverable: true };

  rows = computed<TableRow[]>(() => {
    this.translate.currentLang();
    return this.rules().map(rule => ({
      paysIsoCode: rule.paysIsoCode,
      typeCalculHs: rule.typeCalculHs,
      schedule: rule.heureDebutTravail && rule.heureFinTravail
        ? `${rule.heureDebutTravail.slice(0, 5)} → ${rule.heureFinTravail.slice(0, 5)}`
        : '—',
      week: rule.jourDebutSemaine && rule.jourFinSemaine
        ? `${this.getDayLabel(rule.jourDebutSemaine)} → ${this.getDayLabel(rule.jourFinSemaine)}`
        : '—',
      actif: rule.actif,
      _source: rule,
    }));
  });

  typeBadgeOptions(type: string): BadgeOptions {
    if (type === 'WEEKEND_ONLY') return { variant: 'info' };
    if (type === 'AFTER_WORK_HOURS') return { variant: 'warning' };
    return { variant: 'secondary' };
  }

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
      this.formError.set(this.translate.instant('ADMIN.regimes.overtime.errorRequired'));
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
        this.formError.set(err?.error?.message ?? this.translate.instant(id ? 'ADMIN.regimes.common.errorUpdate' : 'ADMIN.regimes.common.errorCreate'));
      },
    });
  }

  deactivate(id: number): void {
    this.modal.open({
      title: this.translate.instant('ADMIN.regimes.overtime.deactivateTitle'),
      body:  this.translate.instant('ADMIN.regimes.overtime.deactivateBody'),
      buttons: [
        { label: this.translate.instant('ADMIN.regimes.common.cancel'),    variant: 'secondary', action: r => r.close() },
        { label: this.translate.instant('ADMIN.regimes.overtime.deactivate'), variant: 'primary',   action: r => { this.doDeactivate(id); r.close(); } },
      ],
    });
  }

  private doDeactivate(id: number): void {
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
    if (!TYPE_CALCUL_OPTIONS.some(o => o.value === t)) return t;
    return this.translate.instant('ADMIN.regimes.overtime.types.' + t);
  }
  getTypeDesc(t: string): string {
    if (!TYPE_CALCUL_OPTIONS.some(o => o.value === t)) return '';
    return this.translate.instant('ADMIN.regimes.overtime.typeDesc.' + t);
  }
  getDayLabel(d: string): string {
    if (!DAYS_OPTIONS.some(o => o.value === d)) return d;
    return this.translate.instant('ADMIN.regimes.overtime.days.' + d);
  }

  private resetForm(): void {
    this.formPaysId = 0; this.formType = 'WEEKEND_ONLY';
    this.formHeureDebut = ''; this.formHeureFin = '';
    this.formJourDebut = ''; this.formJourFin = '';
  }
}
