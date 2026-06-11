import {
  Component, OnChanges, SimpleChanges, inject, input, signal, computed,
} from '@angular/core';
import { NgClass, NgStyle } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RegimeService } from '../regime.service';
import { WorkingTimeRegime, RegimeDetail, CreateRegimeRequest } from '../regime.model';
import { PermissionDirective } from '../../../../shared/permission.directive';

@Component({
  selector: 'app-regime-catalog',
  standalone: true,
  imports: [NgClass, NgStyle, FormsModule, ReactiveFormsModule, PermissionDirective],
  templateUrl: './regime-catalog.component.html',
  styleUrl: './regime-catalog.component.scss',
})
export class RegimeCatalogComponent implements OnChanges {
  private svc = inject(RegimeService);
  private fb  = inject(FormBuilder);

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
    isFlexible:       [false],
    isDefault:        [false],
    breakDurationMin: [0],
    overtimeAllowed:  [false],
    maxHoursPerDay:   [null as number | null],
  });

  // ── Lifecycle ───────────────────────────────────────────────────────────────
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['paysId']) { this.loadRegimes(); }
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
      isFlexible: r.isFlexible, isDefault: r.isDefault,
      breakDurationMin: r.breakDurationMin ?? 0,
      overtimeAllowed: r.overtimeAllowed ?? false,
      maxHoursPerDay: r.maxHoursPerDay ?? null,
    });
    this.svc.getRegimeDetail(r.id).subscribe({ next: d => this.detail.set(d) });
  }

  toggleDefault(): void {
    const cur = this.form.get('isDefault')?.value;
    this.form.patchValue({ isDefault: !cur });
  }

  saveRegime(): void {
    if (this.form.invalid || !this.selectedId()) return;
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
    }).subscribe({
      next: updated => {
        this.regimes.update(rs => rs.map(r => r.id === updated.id ? updated : r));
        this.isSaving.set(false);
        this.successMsg.set('Régime mis à jour avec succès.');
        setTimeout(() => this.successMsg.set(null), 3000);
      },
      error: err => {
        this.isSaving.set(false);
        this.errorMsg.set(err?.error?.message ?? 'Erreur lors de la sauvegarde.');
      },
    });
  }

  deleteRegime(): void {
    if (!this.selectedId()) return;
    if (!confirm('Supprimer ce régime ? Cette action est irréversible.')) return;
    this.isDeleting.set(true);
    this.svc.deleteRegime(this.selectedId()!).subscribe({
      next: () => {
        this.regimes.update(rs => rs.filter(r => r.id !== this.selectedId()));
        this.selectedId.set(null); this.detail.set(null);
        this.isDeleting.set(false);
      },
      error: err => {
        this.isDeleting.set(false);
        this.errorMsg.set(err?.error?.message ?? 'Erreur lors de la suppression.');
      },
    });
  }

  createRegime(): void {
    if (this.createForm.invalid) return;
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
      paysId: this.paysId(),
    };
    this.svc.createRegime(dto).subscribe({
      next: created => {
        this.regimes.update(rs => [...rs, created]);
        this.showCreateModal.set(false);
        this.createForm.reset({ hoursPerWeek: 40, daysPerWeek: 5, isFlexible: false, isDefault: false, breakDurationMin: 0, overtimeAllowed: false });
        this.selectRegime(created);
      },
      error: err => this.errorMsg.set(err?.error?.message ?? 'Erreur lors de la création.'),
    });
  }

  canDelete = computed(() => {
    const d = this.detail();
    if (!d) return false;
    return d.employeeCount === 0 && d.roleCount === 0 && !this.selectedRegime()?.isDefault;
  });

  formatTime(t: string | undefined): string { return t ?? '—'; }
}
