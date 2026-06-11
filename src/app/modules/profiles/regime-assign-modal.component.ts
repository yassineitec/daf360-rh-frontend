import {
  Component, inject, input, OnChanges, output, signal, SimpleChanges,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, of } from 'rxjs';

import { ProfileService }     from './profile.service';
import { WorkingTimeRegime }  from './models/profile.model';
import { ModalComponent }     from '../../shared/modal.component';
import { SpinnerComponent }   from '../../shared/spinner.component';

@Component({
  selector: 'app-regime-assign-modal',
  standalone: true,
  imports: [ModalComponent, SpinnerComponent, ReactiveFormsModule],
  template: `
    <app-modal
      title="Assigner un régime horaire"
      [visible]="visible()"
      [hasFooter]="true"
      (closed)="closed.emit()"
    >
      <div class="modal-body">
        @if (loadingRegimes()) {
          <div class="center"><app-spinner /></div>
        } @else if (regimes().length === 0) {
          <p class="empty">Aucun régime disponible pour ce pays.</p>
        } @else {
          <form [formGroup]="form" class="regime-form">

            <div class="field-row">
              <label class="form-label">Régime horaire *</label>
              <select class="form-input" formControlName="regimeId">
                <option [value]="null">Sélectionner…</option>
                @for (r of regimes(); track r.id) {
                  <option [value]="r.id">
                    {{ r.labelFr }} — {{ r.hoursPerWeek }}h/sem, {{ r.daysPerWeek }}j
                    @if (r.isDefault) { (défaut) }
                  </option>
                }
              </select>
              @if (form.get('regimeId')?.touched && form.get('regimeId')?.errors?.['required']) {
                <span class="field-error">Requis</span>
              }
            </div>

            <div class="field-row">
              <label class="form-label">Date de début *</label>
              <input class="form-input" type="date" formControlName="startDate" />
              @if (form.get('startDate')?.touched && form.get('startDate')?.errors?.['required']) {
                <span class="field-error">Requis</span>
              }
            </div>

            <div class="field-row">
              <label class="form-label">Date de fin <span class="opt">(optionnelle)</span></label>
              <input class="form-input" type="date" formControlName="endDate" />
            </div>

            <div class="field-row full">
              <label class="form-label">Motif *</label>
              <input class="form-input" type="text" formControlName="reason"
                     placeholder="Ex: Changement de poste, réorganisation…" />
              @if (form.get('reason')?.touched && form.get('reason')?.errors?.['required']) {
                <span class="field-error">Requis</span>
              }
            </div>

          </form>

          @if (errorMsg()) {
            <div class="error-banner" role="alert">{{ errorMsg() }}</div>
          }
        }
      </div>

      <div slot="footer">
        <button class="btn-ghost" type="button" (click)="closed.emit()">Annuler</button>
        <button
          class="btn-primary" type="button"
          [disabled]="form.invalid || saving() || loadingRegimes()"
          (click)="save()"
        >
          @if (saving()) { <app-spinner size="sm" /> }
          Assigner
        </button>
      </div>
    </app-modal>
  `,
  styles: [`
    .modal-body  { min-height: 120px; }
    .center      { display: flex; justify-content: center; padding: 24px; }
    .empty       { color: var(--color-text-muted); font-size: 13px; margin: 0; }
    .regime-form { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .field-row   { display: flex; flex-direction: column; gap: 4px; }
    .full        { grid-column: 1 / -1; }
    .form-label  { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .5px; color: var(--color-text-muted); }
    .opt         { font-weight: 400; text-transform: none; }
    .form-input  { padding: 8px 12px; border: 1px solid var(--color-border); border-radius: var(--radius-md); font-size: 13px; font-family: inherit; background: var(--color-surface); color: var(--color-text); outline: none; transition: border .15s;
      &:focus { border-color: var(--color-primary); } }
    .field-error { font-size: 11px; color: var(--color-danger, #DC2626); }
    .error-banner { margin-top: 12px; padding: 10px 14px; border-radius: var(--radius-md); background: #fee2e2; color: #991b1b; font-size: 13px; }
    .btn-primary { display:inline-flex;align-items:center;gap:6px;padding:8px 20px;background:var(--color-primary);color:#fff;border:none;border-radius:var(--radius-md);font-size:13px;font-weight:600;cursor:pointer; &:disabled{opacity:.5;cursor:not-allowed} }
    .btn-ghost   { padding:7px 16px;border:1px solid var(--color-border);border-radius:var(--radius-md);background:none;font-size:13px;cursor:pointer;color:var(--color-text-muted) }
  `],
})
export class RegimeAssignModalComponent implements OnChanges {
  private fb  = inject(FormBuilder);
  private svc = inject(ProfileService);

  profileId = input.required<number>();
  paysId    = input.required<number>();
  visible   = input(false);

  closed  = output<void>();
  saved   = output<void>();

  loadingRegimes = signal(false);
  saving         = signal(false);
  regimes        = signal<WorkingTimeRegime[]>([]);
  errorMsg       = signal<string | null>(null);

  form = this.fb.group({
    regimeId:  [null as number | null, Validators.required],
    startDate: ['', Validators.required],
    endDate:   [null as string | null],
    reason:    ['', Validators.required],
  });

  ngOnChanges(changes: SimpleChanges) {
    if (changes['visible']?.currentValue === true && this.regimes().length === 0) {
      this.loadRegimes();
    }
  }

  private loadRegimes() {
    this.loadingRegimes.set(true);
    this.svc.listRegimes(this.paysId()).pipe(catchError(() => of([])))
      .subscribe(r => { this.regimes.set(r); this.loadingRegimes.set(false); });
  }

  save() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const v = this.form.value;
    this.saving.set(true);
    this.errorMsg.set(null);

    this.svc.assignRegime(this.profileId(), {
      regimeId:  v.regimeId!,
      startDate: v.startDate!,
      endDate:   v.endDate ?? undefined,
      reason:    v.reason!,
    }).pipe(
      catchError(err => {
        this.errorMsg.set(err?.error?.message ?? 'Erreur lors de l\'assignation');
        this.saving.set(false);
        return of(null);
      })
    ).subscribe(res => {
      if (res !== null) {
        this.saving.set(false);
        this.saved.emit();
        this.closed.emit();
        this.form.reset();
      }
    });
  }
}
