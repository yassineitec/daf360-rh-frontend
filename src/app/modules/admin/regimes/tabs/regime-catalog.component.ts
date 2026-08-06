import {
  Component, OnChanges, SimpleChanges, inject, input, signal, computed,
} from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import {
  ButtonComponent, FormFieldComponent, ToggleComponent, CardComponent, StatusBadgeComponent,
  ModalService, SelectComponent, SelectOption,
} from '@khalilrebhiitec/daf360';
import { RegimeService } from '../regime.service';
import { WorkingTimeRegime, RegimeDetail, CreateRegimeRequest } from '../regime.model';
import { RefDataService } from '../../../../core/ref/ref-data.service';
import { PaysTimezone, TimezoneOption } from '../../../../core/ref/ref-data.model';
import { DafHasPermissionDirective } from '@khalilrebhiitec/daf360';
import { ModalComponent } from '../../../../shared/modal.component';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-regime-catalog',
  standalone: true,
  imports: [
    ReactiveFormsModule, DafHasPermissionDirective,
    ButtonComponent, FormFieldComponent, ToggleComponent, CardComponent, StatusBadgeComponent,
    ModalComponent, SelectComponent,
    TranslatePipe,
  ],
  templateUrl: './regime-catalog.component.html',
  styleUrl: './regime-catalog.component.scss',
})
export class RegimeCatalogComponent implements OnChanges {
  private svc   = inject(RegimeService);
  private fb    = inject(FormBuilder);
  private modal = inject(ModalService);
  private translate = inject(TranslateService);
  private refData   = inject(RefDataService);

  readonly paysId = input<number>(179);

  // ── State ──────────────────────────────────────────────────────────────────
  regimes      = signal<WorkingTimeRegime[]>([]);
  detail       = signal<RegimeDetail | null>(null);
  selectedId   = signal<number | null>(null);
  loading      = signal(true);
  isSaving     = signal(false);
  isDeleting   = signal(false);
  showCreateModal = signal(false);
  errorMsg     = signal<string | null>(null);
  successMsg   = signal<string | null>(null);
  skeletonRows = [1,2,3,4];

  selectedRegime = computed(() =>
    this.regimes().find(r => r.id === this.selectedId()) ?? null
  );

  currentDefaultName = computed(() =>
    this.regimes().find(r => r.isDefault && r.id !== this.selectedId())?.labelFr ?? null
  );

  showDefaultWarning = computed(() => {
    const val = this.form.get('isDefault')?.value;
    return val === true && this.currentDefaultName() !== null;
  });

  formTouched       = signal(false);
  createFormTouched = signal(false);

  // ── Timezone ───────────────────────────────────────────────────────────────
  /** The entity's own zone — what a regime inherits when it declares none. */
  paysTimezone = signal<PaysTimezone | null>(null);
  private readonly timezones = signal<TimezoneOption[]>([]);

  /**
   * Options for the regime override, with an explicit "inherit" entry first.
   *
   * Inheriting is the right answer for almost every regime, so it must be the visible
   * default rather than something achieved by leaving a select untouched.
   */
  readonly timezoneOptions = computed<SelectOption[]>(() => {
    const inheritLabel = this.paysTimezone()?.timezone
      ? this.translate.instant('ADMIN.regimes.catalog.tzInheritFrom',
          { zone: this.paysTimezone()!.timezone })
      : this.translate.instant('ADMIN.regimes.catalog.tzInheritUnset');
    return [
      { value: '', label: inheritLabel },
      ...this.timezones().map(t => ({ value: t.id, label: t.label })),
    ];
  });

  /**
   * daf-select's value is an array (it is multi-capable). Mirrored in signals rather than
   * read from the control, because FormControl.value is not reactive — a computed over it
   * would be evaluated once and then never update the select.
   */
  timezoneSelected       = signal<string[]>(['']);
  createTimezoneSelected = signal<string[]>(['']);

  /** True while a regime declares its own zone — worth flagging, it is the exception. */
  readonly timezoneOverridden = computed(() => !!this.timezoneSelected()[0]);

  onTimezoneChange(values: string[]): void {
    const tz = values[0] ?? '';
    this.timezoneSelected.set([tz]);
    this.form.get('timezone')?.setValue(tz);
  }

  onCreateTimezoneChange(values: string[]): void {
    const tz = values[0] ?? '';
    this.createTimezoneSelected.set([tz]);
    this.createForm.get('timezone')?.setValue(tz);
  }

  // ── Forms ──────────────────────────────────────────────────────────────────
  form = this.fb.group({
    code:             ['', [Validators.required, Validators.maxLength(50)]],
    labelFr:          ['', Validators.required],
    labelEn:          [''],
    descriptionFr:    [''],
    hoursPerWeek:     [40, [Validators.required, Validators.min(1), Validators.max(60)]],
    daysPerWeek:      [5,  [Validators.required, Validators.min(1), Validators.max(7)]],
    startTime:        [''],
    endTime:          [''],
    seasonalFrom:     [''],
    seasonalTo:       [''],
    timezone:         [''],
    isFlexible:       [false],
    isDefault:        [false],
    breakDurationMin: [0],
    overtimeAllowed:  [false],
    maxHoursPerDay:   [null as number | null],
  });

  createForm = this.fb.group({
    code:             ['', [Validators.required, Validators.maxLength(50)]],
    labelFr:          ['', Validators.required],
    labelEn:          [''],
    descriptionFr:    [''],
    hoursPerWeek:     [40, [Validators.required, Validators.min(1), Validators.max(60)]],
    daysPerWeek:      [5,  [Validators.required, Validators.min(1), Validators.max(7)]],
    startTime:        [''],
    endTime:          [''],
    seasonalFrom:     [''],
    seasonalTo:       [''],
    timezone:         [''],
    isFlexible:       [false],
    isDefault:        [false],
    breakDurationMin: [0],
    overtimeAllowed:  [false],
    maxHoursPerDay:   [null as number | null],
  });

  // ── Lifecycle ───────────────────────────────────────────────────────────────
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['paysId']) {
      this.loadRegimes();
      this.loadTimezoneContext();
    }
  }

  /**
   * The entity's zone (to show what a regime inherits) plus the IANA catalogue.
   * Both are best-effort: a failure here must not stop the regime form from working.
   */
  private loadTimezoneContext(): void {
    this.refData.getPaysTimezones().subscribe(list =>
      this.paysTimezone.set(list.find(p => p.id === this.paysId()) ?? null));
    this.refData.getTimezones().subscribe(tzs => this.timezones.set(tzs));
  }

  loadRegimes(): void {
    this.loading.set(true);
    this.selectedId.set(null);
    this.detail.set(null);
    this.svc.getRegimes(this.paysId()).subscribe({
      next: rs => { this.regimes.set(rs); this.loading.set(false); },
      error: ()  => this.loading.set(false),
    });
  }

  selectRegime(r: WorkingTimeRegime): void {
    this.selectedId.set(r.id);
    this.errorMsg.set(null);
    this.successMsg.set(null);
    this.form.patchValue({
      code: r.code, labelFr: r.labelFr, labelEn: r.labelEn ?? '',
      descriptionFr: r.descriptionFr ?? '',
      hoursPerWeek: r.hoursPerWeek, daysPerWeek: r.daysPerWeek,
      startTime: r.startTime ?? '', endTime: r.endTime ?? '',
      seasonalFrom: r.seasonalFrom ?? '', seasonalTo: r.seasonalTo ?? '',
      timezone: r.timezone ?? '',
      isFlexible: r.isFlexible, isDefault: r.isDefault,
      breakDurationMin: r.breakDurationMin ?? 0,
      overtimeAllowed: r.overtimeAllowed ?? false,
      maxHoursPerDay: r.maxHoursPerDay ?? null,
    });
    this.timezoneSelected.set([r.timezone ?? '']);
    this.svc.getRegimeDetail(r.id).subscribe({ next: d => this.detail.set(d) });
  }

  toggleDefault(): void {
    const cur = this.form.get('isDefault')?.value;
    this.form.patchValue({ isDefault: !cur });
  }

  saveRegime(): void {
    if (this.form.invalid || !this.selectedId()) {
      this.formTouched.set(true);
      return;
    }
    this.isSaving.set(true);
    this.errorMsg.set(null);
    const v = this.form.value;
    this.svc.updateRegime(this.selectedId()!, {
      labelFr: v.labelFr!, labelEn: v.labelEn ?? '',
      descriptionFr: v.descriptionFr ?? '',
      hoursPerWeek: v.hoursPerWeek!, daysPerWeek: v.daysPerWeek!,
      startTime: v.startTime || undefined, endTime: v.endTime || undefined,
      isFlexible: v.isFlexible!, isDefault: v.isDefault!,
      breakDurationMin: v.breakDurationMin ?? 0,
      overtimeAllowed: v.overtimeAllowed ?? false,
      maxHoursPerDay: v.maxHoursPerDay ?? undefined,
      // null (not undefined) so clearing a seasonal window actually erases it
      seasonalFrom: v.seasonalFrom || null, seasonalTo: v.seasonalTo || null,
      // Same reason: null restores inheritance from the entity's zone. Sending undefined
      // would leave a stale override running this regime on another country's clock.
      timezone: v.timezone || null,
    }).subscribe({
      next: updated => {
        this.regimes.update(rs => rs.map(r => r.id === updated.id ? updated : r));
        this.isSaving.set(false);
        this.successMsg.set(this.translate.instant('ADMIN.regimes.catalog.updateSuccess'));
        setTimeout(() => this.successMsg.set(null), 3000);
      },
      error: err => {
        this.isSaving.set(false);
        this.errorMsg.set(err?.error?.message ?? this.translate.instant('ADMIN.regimes.catalog.errorSave'));
      },
    });
  }

  deleteRegime(): void {
    if (!this.selectedId()) return;
    this.modal.open({
      title: this.translate.instant('ADMIN.regimes.catalog.deleteTitle'),
      body:  this.translate.instant('ADMIN.regimes.catalog.deleteBody'),
      buttons: [
        { label: this.translate.instant('ADMIN.regimes.common.cancel'),   variant: 'secondary', action: r => r.close() },
        { label: this.translate.instant('ADMIN.regimes.common.delete'), variant: 'primary',   action: r => { this.doDeleteRegime(); r.close(); } },
      ],
    });
  }

  private doDeleteRegime(): void {
    this.isDeleting.set(true);
    this.svc.deleteRegime(this.selectedId()!).subscribe({
      next: () => {
        this.regimes.update(rs => rs.filter(r => r.id !== this.selectedId()));
        this.selectedId.set(null); this.detail.set(null);
        this.isDeleting.set(false);
      },
      error: err => {
        this.isDeleting.set(false);
        this.errorMsg.set(err?.error?.message ?? this.translate.instant('ADMIN.regimes.common.errorDelete'));
      },
    });
  }

  createRegime(): void {
    if (this.createForm.invalid) {
      this.createFormTouched.set(true);
      return;
    }
    const v = this.createForm.value;
    const dto: CreateRegimeRequest = {
      code: v.code!, labelFr: v.labelFr!, labelEn: v.labelEn ?? '',
      descriptionFr: v.descriptionFr ?? '',
      hoursPerWeek: v.hoursPerWeek!, daysPerWeek: v.daysPerWeek!,
      startTime: v.startTime || undefined, endTime: v.endTime || undefined,
      isFlexible: v.isFlexible ?? false, isDefault: v.isDefault ?? false,
      breakDurationMin: v.breakDurationMin ?? 0,
      overtimeAllowed: v.overtimeAllowed ?? false,
      maxHoursPerDay: v.maxHoursPerDay ?? undefined,
      seasonalFrom: v.seasonalFrom || null, seasonalTo: v.seasonalTo || null,
      timezone: v.timezone || null,
      paysId: this.paysId(),
    };
    this.svc.createRegime(dto).subscribe({
      next: created => {
        this.regimes.update(rs => [...rs, created]);
        this.showCreateModal.set(false);
        this.createForm.reset({ hoursPerWeek: 40, daysPerWeek: 5, isFlexible: false, isDefault: false, breakDurationMin: 0, overtimeAllowed: false, timezone: '' });
        this.createTimezoneSelected.set(['']);
        this.selectRegime(created);
      },
      error: err => this.errorMsg.set(err?.error?.message ?? this.translate.instant('ADMIN.regimes.common.errorCreate')),
    });
  }

  canDelete = computed(() => {
    const d = this.detail();
    if (!d) return false;
    return d.employeeCount === 0 && d.roleCount === 0 && !this.selectedRegime()?.isDefault;
  });

  /**
   * True when the regime's seasonal window covers today, i.e. it is currently the regime
   * in force for its entity — outranking role assignments and personal overrides.
   * An open-ended `seasonalTo` means "until further notice".
   */
  isSeasonalActive(r: WorkingTimeRegime): boolean {
    if (!r.seasonalFrom) return false;
    const today = new Date().toISOString().slice(0, 10);
    if (r.seasonalFrom > today) return false;
    return !r.seasonalTo || r.seasonalTo >= today;
  }

  formatTime(t: string | undefined): string { return t ?? '—'; }

  fieldError(name: string, message: string): string | undefined {
    if (!this.formTouched()) return undefined;
    return this.form.get(name)?.invalid ? message : undefined;
  }

  createFieldError(name: string, message: string): string | undefined {
    if (!this.createFormTouched()) return undefined;
    return this.createForm.get(name)?.invalid ? message : undefined;
  }

  setNum(control: 'hoursPerWeek' | 'daysPerWeek' | 'maxHoursPerDay', formGroup: 'form' | 'createForm', value: unknown): void {
    const num = value === '' || value === null || value === undefined ? null : Number(value);
    const group = formGroup === 'form' ? this.form : this.createForm;
    group.get(control)?.setValue(num);
  }
}
