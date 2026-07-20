import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule,
  ValidationErrors, Validators,
} from '@angular/forms';
import { catchError, of, startWith } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';

import { CardComponent } from '@khalilrebhiitec/daf360';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ProfileService }  from './profile.service';
import { SpinnerComponent } from '../../shared/spinner.component';
import { RefDataService }   from '../../core/ref/ref-data.service';
import { RefDataItem }      from '../../core/ref/ref-data.model';
import { UserStore }        from '../../core/user.store';

// ── Custom validators ──────────────────────────────────────────────────────────
const EMPLOYEE_ID_RE = /^[A-Z]{2,8}-\d{2}-\d{4}$/;

function employeeIdValidator(c: AbstractControl): ValidationErrors | null {
  const v = c.value as string | null;
  if (!v) return null;
  return EMPLOYEE_ID_RE.test(v) ? null : { employeeIdFormat: true };
}

function notFutureDate(c: AbstractControl): ValidationErrors | null {
  const v = c.value as string | null;
  if (!v) return null;
  return new Date(v) <= new Date() ? null : { futureDate: true };
}

function cddEndDateRequired(group: AbstractControl): ValidationErrors | null {
  const type = group.get('contractType')?.value as string;
  const end  = group.get('contractEndDate')?.value as string | null;
  return type === 'CDD' && !end ? { cddEndDateRequired: true } : null;
}

const STEP_KEYS = [
  'PROFILES.NEW.STEP_IDENTITY',
  'PROFILES.NEW.STEP_EMPLOYMENT',
  'PROFILES.NEW.STEP_POSITION',
  'PROFILES.NEW.STEP_REGIME',
] as const;

@Component({
  selector: 'app-profile-new',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, SpinnerComponent, CardComponent, TranslatePipe],
  template: `
    <!-- ── Breadcrumb ──────────────────────────────────────────────── -->
    <nav class="breadcrumb">
      <a routerLink="/profiles" class="bc-link">{{ 'PROFILES.NEW.BREADCRUMB_LIST' | translate }}</a>
      <span class="bc-sep">›</span>
      <span class="bc-current">{{ 'PROFILES.NEW.BREADCRUMB_CURRENT' | translate }}</span>
    </nav>

    <div class="stepper-page">
      <!-- ── Step indicators ─────────────────────────────────────────── -->
      <div class="step-indicators" role="list" [attr.aria-label]="'PROFILES.NEW.STEPS_ARIA' | translate">
        @for (key of steps; track key; let i = $index) {
          <div
            class="step-indicator"
            [class.active]="step() === i"
            [class.done]="step() > i"
            role="listitem"
          >
            <span class="step-num">{{ step() > i ? '✓' : i + 1 }}</span>
            <span class="step-label">{{ key | translate }}</span>
          </div>
          @if (i < steps.length - 1) { <div class="step-line" [class.done]="step() > i"></div> }
        }
      </div>

      <!-- ── Form card ───────────────────────────────────────────────── -->
      <daf-card [options]="{ variant: 'glass', padding: 'lg', radius: 'xl' }" class="block form-card">

        <!-- Step 1 — Identité -->
        @if (step() === 0) {
          <section aria-labelledby="step1">
            <h2 class="step-title" id="step1">{{ 'PROFILES.NEW.STEP_IDENTITY' | translate }}</h2>
            <form [formGroup]="step1Form" class="form-grid">

              <div class="field-row">
                <label class="form-label">{{ 'PROFILES.NEW.USER_ID' | translate }}</label>
                <input class="form-input" type="number" formControlName="userId"
                       placeholder="Ex: 10215" />
                @if (err1('userId', 'required')) {
                  <span class="field-error">{{ 'PROFILES.NEW.ERR_REQUIRED' | translate }}</span>
                }
              </div>

              <div class="field-row">
                <label class="form-label">
                  {{ 'PROFILES.NEW.EMPLOYEE_ID' | translate }}
                  <span class="hint">{{ 'PROFILES.NEW.EMPLOYEE_ID_HINT' | translate }}</span>
                </label>
                <input class="form-input" type="text" formControlName="employeeId"
                       placeholder="ARX-26-0001" style="text-transform:uppercase"
                       (input)="uppercase($event, 'employeeId', step1Form)" />
                @if (err1('employeeId', 'required')) {
                  <span class="field-error">{{ 'PROFILES.NEW.ERR_REQUIRED' | translate }}</span>
                }
                @if (err1('employeeId', 'employeeIdFormat')) {
                  <span class="field-error">{{ 'PROFILES.NEW.ERR_ID_FORMAT' | translate }}</span>
                }
              </div>

              <div class="field-row">
                <label class="form-label">{{ 'PROFILES.NEW.PAYS' | translate }}</label>
                <input class="form-input" type="number" formControlName="paysId" placeholder="179" />
                @if (err1('paysId', 'required')) {
                  <span class="field-error">{{ 'PROFILES.NEW.ERR_REQUIRED' | translate }}</span>
                }
              </div>

            </form>
          </section>
        }

        <!-- Step 2 — Emploi -->
        @if (step() === 1) {
          <section aria-labelledby="step2">
            <h2 class="step-title" id="step2">{{ 'PROFILES.NEW.STEP_EMPLOYMENT' | translate }}</h2>
            <form [formGroup]="step2Form" class="form-grid">

              <div class="field-row">
                <label class="form-label">{{ 'PROFILES.NEW.HIRE_DATE' | translate }}</label>
                <input class="form-input" type="date" formControlName="hireDate" />
                @if (err2('hireDate', 'required'))    { <span class="field-error">{{ 'PROFILES.NEW.ERR_REQUIRED' | translate }}</span> }
                @if (err2('hireDate', 'futureDate'))  { <span class="field-error">{{ 'PROFILES.NEW.ERR_FUTURE_DATE' | translate }}</span> }
              </div>

              <div class="field-row">
                <label class="form-label">{{ 'PROFILES.NEW.CONTRACT_TYPE' | translate }}</label>
                <select class="form-input" formControlName="contractType">
                  <option value="">{{ 'PROFILES.COMMON.SELECT_ELLIPSIS' | translate }}</option>
                  @for (t of contractTypes; track t) { <option [value]="t">{{ t }}</option> }
                </select>
                @if (err2('contractType', 'required')) { <span class="field-error">{{ 'PROFILES.NEW.ERR_REQUIRED' | translate }}</span> }
              </div>

              @if (step2Form.get('contractType')?.value === 'CDD') {
                <div class="field-row">
                  <label class="form-label">{{ 'PROFILES.NEW.CONTRACT_END' | translate }}</label>
                  <input class="form-input" type="date" formControlName="contractEndDate" />
                  @if (step2Form.errors?.['cddEndDateRequired']) {
                    <span class="field-error">{{ 'PROFILES.NEW.ERR_CDD_END' | translate }}</span>
                  }
                </div>
              }

              <div class="field-row">
                <label class="form-label">{{ 'PROFILES.NEW.PROBATION_END' | translate }}</label>
                <input class="form-input" type="date" formControlName="probationEndDate" />
              </div>

            </form>
          </section>
        }

        <!-- Step 3 — Poste -->
        @if (step() === 2) {
          <section aria-labelledby="step3">
            <h2 class="step-title" id="step3">{{ 'PROFILES.NEW.STEP_POSITION' | translate }}</h2>
            <form [formGroup]="step3Form" class="form-grid">

              <div class="field-row">
                <label class="form-label">{{ 'PROFILES.NEW.DEPARTMENT' | translate }}</label>
                <select class="form-input" formControlName="departmentId">
                  <option [ngValue]="null">{{ 'PROFILES.COMMON.SELECT_PLACEHOLDER' | translate }}</option>
                  @for (d of departments(); track d.id) { <option [ngValue]="d.id">{{ d.labelFr }}</option> }
                </select>
              </div>

              <div class="field-row">
                <label class="form-label">{{ 'PROFILES.NEW.GRADE' | translate }}</label>
                <select class="form-input" formControlName="gradeId">
                  <option [ngValue]="null">{{ 'PROFILES.COMMON.SELECT_PLACEHOLDER' | translate }}</option>
                  @for (g of grades(); track g.id) { <option [ngValue]="g.id">{{ g.labelFr }}</option> }
                </select>
              </div>

              <div class="field-row">
                <label class="form-label">{{ 'PROFILES.NEW.DISCIPLINE' | translate }}</label>
                <select class="form-input" formControlName="disciplineId">
                  <option [ngValue]="null">{{ 'PROFILES.COMMON.SELECT_PLACEHOLDER' | translate }}</option>
                  @for (d of disciplines(); track d.id) { <option [ngValue]="d.id">{{ d.labelFr }}</option> }
                </select>
              </div>

              <div class="field-row">
                <label class="form-label">{{ 'PROFILES.NEW.NOG_LEVEL' | translate }}</label>
                <select class="form-input" formControlName="nogLevelId">
                  <option [ngValue]="null">{{ 'PROFILES.COMMON.SELECT_PLACEHOLDER' | translate }}</option>
                  @for (n of nogLevels(); track n.id) { <option [ngValue]="n.id">{{ n.labelFr }}</option> }
                </select>
              </div>

            </form>
          </section>
        }

        <!-- Step 4 — Régime -->
        @if (step() === 3) {
          <section aria-labelledby="step4">
            <h2 class="step-title" id="step4">{{ 'PROFILES.NEW.STEP_REGIME_TITLE' | translate }}</h2>
            <p class="step-hint">{{ 'PROFILES.NEW.REGIME_HINT' | translate }}</p>
            <form [formGroup]="step4Form" class="form-grid">

              <div class="field-row">
                <label class="form-label">{{ 'PROFILES.NEW.REGIME_TEMPLATE_ID' | translate }}</label>
                <input class="form-input" type="number" formControlName="regimeTemplateId"
                       [placeholder]="'PROFILES.NEW.REGIME_TEMPLATE_PH' | translate" />
              </div>

              <div class="field-row">
                <label class="form-label">{{ 'PROFILES.NEW.REGIME_START' | translate }}</label>
                <input class="form-input" type="date" formControlName="regimeStartDate" />
              </div>

              <div class="field-row" style="grid-column:1/-1">
                <label class="form-label">{{ 'PROFILES.NEW.REGIME_REASON' | translate }}</label>
                <input class="form-input" type="text" formControlName="regimeReason"
                       [placeholder]="'PROFILES.COMMON.OPTIONAL' | translate" />
              </div>

            </form>
          </section>
        }

        <!-- ── Navigation ──────────────────────────────────────────────── -->
        <div class="step-nav">
          @if (step() > 0) {
            <button class="btn-ghost" type="button" (click)="prev()">{{ 'PROFILES.NEW.PREV' | translate }}</button>
          } @else {
            <a routerLink="/profiles" class="btn-ghost">{{ 'PROFILES.COMMON.CANCEL' | translate }}</a>
          }

          @if (step() < steps.length - 1) {
            <button class="btn-primary" type="button" (click)="next()"
                    [disabled]="!currentStepValid()">
              {{ 'PROFILES.NEW.NEXT' | translate }}
            </button>
          } @else {
            <button class="btn-primary" type="button" (click)="submit()"
                    [disabled]="!currentStepValid() || saving()">
              @if (saving()) { <app-spinner size="sm" /> }
              {{ 'PROFILES.NEW.SUBMIT' | translate }}
            </button>
          }
        </div>

        <!-- Error banner -->
        @if (errorMsg()) {
          <div class="error-banner" role="alert">{{ errorMsg() }}</div>
        }

      </daf-card><!-- /form-card -->
    </div>
  `,
  styles: [`
    .breadcrumb      { display:flex;align-items:center;gap:6px;padding:16px 24px 0;font-size:12px }
    .bc-link         { color:var(--color-primary);text-decoration:none }
    .bc-link:hover   { text-decoration:underline }
    .bc-sep,.bc-current { color:var(--color-text-muted) }

    .stepper-page { max-width:680px;margin:24px auto;padding:0 16px 40px }

    /* ── Step indicators */
    .step-indicators { display:flex;align-items:center;margin-bottom:24px }
    .step-indicator  { display:flex;align-items:center;gap:8px;flex-shrink:0 }
    .step-num        { width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;background:var(--color-border);color:var(--color-text-muted);transition:all .2s }
    .step-label      { font-size:12px;font-weight:500;color:var(--color-text-muted);white-space:nowrap }
    .step-indicator.active .step-num  { background:var(--color-primary);color:#fff }
    .step-indicator.active .step-label{ color:var(--color-text);font-weight:600 }
    .step-indicator.done   .step-num  { background:var(--color-success,#16A34A);color:#fff }
    .step-line { flex:1;height:1px;background:var(--color-border);margin:0 8px;transition:background .2s }
    .step-line.done { background:var(--color-success,#16A34A) }

    /* ── Form card */
    .step-title { font-family:var(--font-display,'DM Serif Display',serif);font-size:18px;font-weight:400;margin:0 0 20px;color:var(--color-text) }
    .step-hint  { font-size:13px;color:var(--color-text-muted);margin:-12px 0 16px }
    .form-grid  { display:grid;grid-template-columns:1fr 1fr;gap:16px }
    .field-row  { display:flex;flex-direction:column;gap:4px }
    .form-label { font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--color-text-muted) }
    .hint       { font-size:10px;font-weight:400;text-transform:none;letter-spacing:0;color:var(--color-text-subtle,#9CA3AF);display:block;margin-top:2px }
    .form-input { padding:8px 12px;border:1px solid var(--color-border);border-radius:var(--radius-md);font-size:13px;font-family:inherit;color:var(--color-text);background:var(--color-surface);outline:none;width:100%;transition:border .15s }
    .form-input:focus { border-color:var(--color-primary) }
    .field-error { font-size:11px;color:var(--color-danger,#DC2626);margin-top:2px }

    /* ── Navigation */
    .step-nav { display:flex;align-items:center;justify-content:space-between;margin-top:28px;padding-top:20px;border-top:1px solid var(--color-border) }
    .error-banner { margin-top:12px;padding:10px 14px;border-radius:var(--radius-md);background:#fee2e2;color:#991b1b;font-size:13px }
    .btn-primary { display:inline-flex;align-items:center;gap:6px;padding:8px 20px;background:var(--color-primary);color:#fff;border:none;border-radius:var(--radius-md);font-size:13px;font-weight:600;cursor:pointer;transition:background .15s }
    .btn-primary:hover    { background:var(--color-primary-hover) }
    .btn-primary:disabled { opacity:.5;cursor:not-allowed }
    .btn-ghost { display:inline-flex;align-items:center;gap:6px;padding:7px 16px;border:1px solid var(--color-border);border-radius:var(--radius-md);background:none;font-size:13px;cursor:pointer;color:var(--color-text-muted);text-decoration:none;transition:all .15s }
    .btn-ghost:hover { background:var(--color-bg-secondary);color:var(--color-text) }

    @media (max-width:500px) { .form-grid { grid-template-columns:1fr } }
  `],
})
export class ProfileNewComponent implements OnInit {
  private fb        = inject(FormBuilder);
  private svc       = inject(ProfileService);
  private router    = inject(Router);
  private refSvc    = inject(RefDataService);
  private userStore = inject(UserStore);
  private translate = inject(TranslateService);

  grades      = signal<RefDataItem[]>([]);
  disciplines = signal<RefDataItem[]>([]);
  nogLevels   = signal<RefDataItem[]>([]);
  departments = signal<RefDataItem[]>([]);

  readonly steps         = STEP_KEYS;
  readonly contractTypes = ['CDI', 'CDD', 'FREELANCE', 'INTERN'];

  step    = signal(0);
  saving  = signal(false);
  errorMsg = signal<string | null>(null);

  // ── Form groups ─────────────────────────────────────────────────────────────
  step1Form = this.fb.group({
    userId:     [null as number | null, [Validators.required, Validators.min(1)]],
    employeeId: ['',  [Validators.required, employeeIdValidator]],
    paysId:     [null as number | null, [Validators.required, Validators.min(1)]],
  });

  step2Form = this.fb.group({
    hireDate:        ['', [Validators.required, notFutureDate]],
    contractType:    ['', Validators.required],
    contractEndDate: [null as string | null],
    probationEndDate:[null as string | null],
  }, { validators: cddEndDateRequired });

  step3Form = this.fb.group({
    departmentId:  [null as number | null],
    gradeId:       [null as number | null],
    disciplineId:  [null as number | null],
    nogLevelId:    [null as number | null],
  });

  step4Form = this.fb.group({
    regimeTemplateId: [null as number | null],
    regimeStartDate:  [null as string | null],
    regimeReason:     [''],
  });

  ngOnInit(): void {
    const paysId = this.userStore.currentUser()?.paysId ?? 52;
    this.refSvc.getGrades(paysId).subscribe(r => this.grades.set(r));
    this.refSvc.getDisciplines(paysId).subscribe(r => this.disciplines.set(r));
    this.refSvc.getNogLevels(paysId).subscribe(r => this.nogLevels.set(r));
    this.refSvc.getDepartments(paysId).subscribe(r => this.departments.set(r));
  }

  // ── Form status as signals (FormGroup.valid is RxJS-backed, not a signal;
  //    toSignal() bridges statusChanges → signal graph so computed() reacts
  //    whenever the user types, not just when step() changes).
  private readonly _s1 = toSignal(this.step1Form.statusChanges.pipe(startWith(this.step1Form.status)));
  private readonly _s2 = toSignal(this.step2Form.statusChanges.pipe(startWith(this.step2Form.status)));
  private readonly _s3 = toSignal(this.step3Form.statusChanges.pipe(startWith(this.step3Form.status)));

  // ── Current step validation ──────────────────────────────────────────────────
  currentStepValid = computed(() => {
    const statuses = [this._s1(), this._s2(), this._s3(), 'VALID']; // step4 is all optional
    return (statuses[this.step()] ?? 'VALID') === 'VALID';
  });

  // ── Navigation ───────────────────────────────────────────────────────────────
  next() {
    const forms = [this.step1Form, this.step2Form, this.step3Form, this.step4Form];
    forms[this.step()]?.markAllAsTouched();
    if (forms[this.step()]?.valid) this.step.update(s => s + 1);
  }

  prev() { this.step.update(s => s - 1); }

  // ── Submit ───────────────────────────────────────────────────────────────────
  submit() {
    [this.step1Form, this.step2Form, this.step3Form, this.step4Form]
      .forEach(f => f.markAllAsTouched());
    if (!this.step1Form.valid || !this.step2Form.valid || !this.step3Form.valid) return;

    const dto = {
      userId:          this.step1Form.value.userId!,
      paysId:          this.step1Form.value.paysId!,
      employeeId:      this.step1Form.value.employeeId!.toUpperCase(),
      hireDate:        this.step2Form.value.hireDate!,
      contractType:    this.step2Form.value.contractType!,
      contractEndDate: this.step2Form.value.contractEndDate ?? undefined,
      departmentId:  this.step3Form.value.departmentId ?? undefined,
      gradeId:       this.step3Form.value.gradeId ?? undefined,
      disciplineId:  this.step3Form.value.disciplineId ?? undefined,
      nogLevelId:    this.step3Form.value.nogLevelId ?? undefined,
    };

    this.saving.set(true);
    this.errorMsg.set(null);

    this.svc.create(dto).pipe(
      catchError(err => {
        const msg = err?.error?.message ?? err?.error?.detail ?? this.translate.instant('PROFILES.NEW.ERR_CREATE');
        this.errorMsg.set(msg);
        this.saving.set(false);
        return of(null);
      })
    ).subscribe(profile => {
      this.saving.set(false);
      if (profile) this.router.navigate(['/profiles', profile.id]);
    });
  }

  // ── Error helpers ────────────────────────────────────────────────────────────
  err1(field: string, error: string) { return this.fieldError(this.step1Form, field, error); }
  err2(field: string, error: string) { return this.fieldError(this.step2Form, field, error); }
  err3(field: string, error: string) { return this.fieldError(this.step3Form, field, error); }

  private fieldError(form: FormGroup, field: string, error: string): boolean {
    const c = form.get(field);
    return !!(c?.touched && c?.errors?.[error]);
  }

  uppercase(event: Event, controlName: string, form: FormGroup) {
    const input = event.target as HTMLInputElement;
    const pos   = input.selectionStart ?? 0;
    form.get(controlName)?.setValue(input.value.toUpperCase(), { emitEvent: false });
    input.setSelectionRange(pos, pos);
  }
}
