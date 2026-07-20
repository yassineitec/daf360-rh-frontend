import {
  Component, inject, input, OnChanges, output, signal, SimpleChanges,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, of } from 'rxjs';

import { ProfileService }     from './profile.service';
import { WorkingTimeRegime }  from './models/profile.model';
import { ModalComponent }     from '../../shared/modal.component';
import { SpinnerComponent }   from '../../shared/spinner.component';
import { ButtonComponent }    from '@khalilrebhiitec/daf360';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-regime-assign-modal',
  standalone: true,
  imports: [ModalComponent, SpinnerComponent, ReactiveFormsModule, ButtonComponent, TranslatePipe],
  template: `
    <app-modal
      [title]="'PROFILES.REGIME_MODAL.TITLE' | translate"
      [visible]="visible()"
      [hasFooter]="true"
      (closed)="closed.emit()"
    >
      <div class="modal-body">
        @if (loadingRegimes()) {
          <div class="center"><app-spinner /></div>
        } @else if (regimes().length === 0) {
          <p class="empty">{{ 'PROFILES.REGIME_MODAL.NO_REGIMES' | translate }}</p>
        } @else {
          <form [formGroup]="form" class="regime-form">

            <div class="field-row">
              <label class="form-label">{{ 'PROFILES.REGIME_MODAL.REGIME_LABEL' | translate }}</label>
              <select class="form-input" formControlName="regimeId">
                <option [value]="null">{{ 'PROFILES.COMMON.SELECT_ELLIPSIS' | translate }}</option>
                @for (r of regimes(); track r.id) {
                  <option [value]="r.id">
                    {{ r.labelFr }} — {{ 'PROFILES.REGIME_MODAL.OPTION_META' | translate:{ hours: r.hoursPerWeek, days: r.daysPerWeek } }}
                    @if (r.isDefault) { {{ 'PROFILES.REGIME_MODAL.DEFAULT_SUFFIX' | translate }} }
                  </option>
                }
              </select>
              @if (form.get('regimeId')?.touched && form.get('regimeId')?.errors?.['required']) {
                <span class="field-error">{{ 'PROFILES.COMMON.REQUIRED' | translate }}</span>
              }
            </div>

            <div class="field-row">
              <label class="form-label">{{ 'PROFILES.REGIME_MODAL.START_DATE' | translate }}</label>
              <input class="form-input" type="date" formControlName="startDate" />
              @if (form.get('startDate')?.touched && form.get('startDate')?.errors?.['required']) {
                <span class="field-error">{{ 'PROFILES.COMMON.REQUIRED' | translate }}</span>
              }
            </div>

            <div class="field-row">
              <label class="form-label">{{ 'PROFILES.REGIME_MODAL.END_DATE' | translate }} <span class="opt">{{ 'PROFILES.REGIME_MODAL.END_OPTIONAL' | translate }}</span></label>
              <input class="form-input" type="date" formControlName="endDate" />
            </div>

            <div class="field-row full">
              <label class="form-label">{{ 'PROFILES.REGIME_MODAL.REASON' | translate }}</label>
              <input class="form-input" type="text" formControlName="reason"
                     [placeholder]="'PROFILES.REGIME_MODAL.REASON_PH' | translate" />
              @if (form.get('reason')?.touched && form.get('reason')?.errors?.['required']) {
                <span class="field-error">{{ 'PROFILES.COMMON.REQUIRED' | translate }}</span>
              }
            </div>

          </form>

          @if (errorMsg()) {
            <div class="error-banner" role="alert">{{ errorMsg() }}</div>
          }
        }
      </div>

      <div slot="footer">
        <daf-button [label]="'PROFILES.COMMON.CANCEL' | translate" variant="secondary" (onClick)="closed.emit()" />
        <daf-button
          [label]="'PROFILES.REGIME_MODAL.ASSIGN' | translate"
          variant="teal"
          [options]="{ disabled: form.invalid || saving() || loadingRegimes(), loading: saving() }"
          (onClick)="save()"
        />
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
  private translate = inject(TranslateService);

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
        this.errorMsg.set(err?.error?.message ?? this.translate.instant('PROFILES.REGIME_MODAL.ERR_ASSIGN'));
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
