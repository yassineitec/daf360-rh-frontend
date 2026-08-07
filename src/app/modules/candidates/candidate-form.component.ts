import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

import { UserStore }        from '../../core/user.store';
import { CandidateService } from './candidate.service';
import { CreateCandidateRequest } from './candidate.model';
import { RefDataService } from '../../core/ref/ref-data.service';
import { RefDataItem }    from '../../core/ref/ref-data.model';
import { ConfigurableListService } from '../../core/lists/configurable-list.service';
import { ListValue }               from '../../core/lists/configurable-list.model';
import { RecruitmentDemandService } from '../recruitment-demands/recruitment-demand.service';
import { ApprovedDemandOption }     from '../recruitment-demands/recruitment-demand.model';
import { catchError, of }           from 'rxjs';
import {
  ButtonComponent,
  CardComponent,
  ChipGroupComponent,
  ChipOption,
  MultiDatePickerComponent,
  FileUploadComponent,
  FormFieldComponent,
  SelectComponent,
  SelectOption,
  SliderComponent,
  UploadedFile,
} from '@khalilrebhiitec/daf360';
import { isoToDate, dateToIso } from '../../shared/date-picker.utils';
import { GENDER_OPTIONS } from '../../shared/utils/gender.utils';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { WizardStepCardComponent } from '../../shared/wizard/wizard-step-card.component';

@Component({
  selector: 'app-candidate-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    ButtonComponent,
    CardComponent,
    WizardStepCardComponent,
    ChipGroupComponent,
    MultiDatePickerComponent,
    FileUploadComponent,
    FormFieldComponent,
    SelectComponent,
    SliderComponent,
    TranslatePipe,
  ],
  templateUrl: './candidate-form.component.html',
})
export class CandidateFormComponent implements OnInit {

  private fb               = inject(FormBuilder);
  private candidateService = inject(CandidateService);
  private userStore        = inject(UserStore);
  private refSvc           = inject(RefDataService);
  private listSvc          = inject(ConfigurableListService);
  private demandSvc        = inject(RecruitmentDemandService);
  private router           = inject(Router);
  private translate        = inject(TranslateService);

  saving          = signal(false);
  error           = signal<string | null>(null);
  cvFiles         = signal<UploadedFile[]>([]);
  experienceYears = signal(0);

  grades          = signal<RefDataItem[]>([]);
  disciplines     = signal<RefDataItem[]>([]);
  departments     = signal<RefDataItem[]>([]);
  nationalities   = signal<RefDataItem[]>([]);
  employmentTypes = signal<ListValue[]>([]);

  readonly gradeOptions = computed<SelectOption[]>(() =>
    this.grades().map(g => ({ value: String(g.id), label: g.labelFr }))
  );
  readonly disciplineOptions = computed<SelectOption[]>(() =>
    this.disciplines().map(d => ({ value: String(d.id), label: d.labelFr }))
  );
  readonly departmentOptions = computed<SelectOption[]>(() =>
    this.departments().map(d => ({ value: String(d.id), label: d.labelFr }))
  );
  readonly nationalityOptions = computed<SelectOption[]>(() =>
    this.nationalities().map(n => ({ value: String(n.id), label: n.labelFr }))
  );

  /** Gender options limited to Homme / Femme (canonical MALE/FEMALE codes). */
  readonly genderOptions: SelectOption[] = GENDER_OPTIONS
    .filter(o => o.value === 'MALE' || o.value === 'FEMALE')
    .map(o => ({ value: o.value, label: o.label }));

  /**
   * Contract types come from the configurable EMPLOYMENT_TYPE list (per pays).
   * The candidate stores an `employmentTypeId`; the backend later derives the
   * actual contract code from it at hire time (CandidateService#hireCandidate).
   */
  readonly employmentTypeChipOptions = computed<ChipOption[]>(() =>
    this.employmentTypes().map(t => ({ value: String(t.id), label: t.labelFr || t.labelEn })),
  );

  // ── Wizard state ─────────────────────────────────────────────────────────
  currentStep = signal(1);

  private readonly STEP_INFO: { titleKey: string; subKey: string; icon: string }[] = [
    { titleKey: 'CANDIDATES.FORM.STEP1_TITLE', subKey: 'CANDIDATES.FORM.STEP1_SUB', icon: 'person' },
    { titleKey: 'CANDIDATES.FORM.STEP2_TITLE', subKey: 'CANDIDATES.FORM.STEP2_SUB', icon: 'work' },
    { titleKey: 'CANDIDATES.FORM.STEP3_TITLE', subKey: 'CANDIDATES.FORM.STEP3_SUB', icon: 'description' },
    { titleKey: 'CANDIDATES.FORM.STEP4_TITLE', subKey: 'CANDIDATES.FORM.STEP4_SUB', icon: 'edit_note' },
  ];

  readonly wizardSteps = computed(() => {
    this.translate.currentLang();
    return this.STEP_INFO.map(s => ({ title: this.translate.instant(s.titleKey) }));
  });
  readonly cardTitle   = computed(() => {
    this.translate.currentLang();
    return this.translate.instant(this.STEP_INFO[this.currentStep() - 1].titleKey);
  });
  readonly cardSub     = computed(() => {
    this.translate.currentLang();
    return this.translate.instant(this.STEP_INFO[this.currentStep() - 1].subKey);
  });
  readonly cardIcon    = computed(() => this.STEP_INFO[this.currentStep() - 1].icon);

  readonly canGoNext = computed(() => {
    this.formValue(); // FormGroup.valid isn't reactive — depend on form value so this recomputes as fields fill
    switch (this.currentStep()) {
      case 1:  return this.identityGroup.valid;
      case 2:  return this.positionGroup.valid;
      default: return true;
    }
  });

  readonly stepValidationError = computed<string | null>(() => {
    this.formValue(); // recompute on every form change (see canGoNext)
    this.translate.currentLang();
    switch (this.currentStep()) {
      case 1:  return this.identityGroup.valid ? null : this.translate.instant('CANDIDATES.FORM.STEP1_ERR');
      case 2:  return this.positionGroup.valid ? null : this.translate.instant('CANDIDATES.FORM.STEP2_ERR');
      default: return null;
    }
  });

  form: FormGroup = this.fb.group({
    identity: this.fb.group({
      firstName:     ['', Validators.required],
      lastName:      ['', Validators.required],
      emailPersonal: ['', [Validators.required, Validators.email]],
      phone:         [null as string | null],
      dateOfBirth:   [null as string | null],
      gender:        [null as string | null],
      nationalId:    [null as string | null],
      location:      [null as string | null],
    }),
    position: this.fb.group({
      appliedPosition:     [null as string | null],
      recruitmentDemandId: [null as number | null],
      departmentId:        [null as number | null],
      employmentTypeId:    [null as number | null, Validators.required],
      appliedGradeId:      [null as number | null],
      appliedDisciplineId: [null as number | null],
      nationalityId:       [null as number | null],
      expectedStartDate:   ['', Validators.required],
      salaireNetCandidat:  [null as number | null],
      salaireNetRh:        [null as number | null],
    }),
    notes: [null as string | null],
  });

  private readonly formValue = toSignal(this.form.valueChanges, { initialValue: this.form.value });

  readonly profileCompleteness = computed(() => {
    const v   = this.formValue() as any;
    const id  = v?.identity ?? {};
    const pos = v?.position ?? {};
    const fields = [
      id.firstName, id.lastName, id.emailPersonal, id.phone,
      id.dateOfBirth, id.gender, id.nationalId,
      pos.appliedPosition, pos.employmentTypeId, pos.expectedStartDate,
      pos.departmentId, pos.appliedGradeId, pos.appliedDisciplineId,
      pos.nationalityId, v?.notes,
    ];
    const total  = fields.length + 1; // +1 for CV
    const filled = fields.filter((val: unknown) => val != null && val !== '').length
                 + (this.cvFiles().length > 0 ? 1 : 0);
    return Math.round((filled / total) * 100);
  });

  readonly completenessLabel = computed(() => {
    this.translate.currentLang();
    const p = this.profileCompleteness();
    if (p >= 100) return this.translate.instant('CANDIDATES.FORM.COMPLETE');
    if (p >= 75)  return this.translate.instant('CANDIDATES.FORM.VERY_GOOD');
    if (p >= 50)  return this.translate.instant('CANDIDATES.FORM.GOOD');
    if (p >= 25)  return this.translate.instant('CANDIDATES.FORM.IN_PROGRESS');
    return this.translate.instant('CANDIDATES.FORM.TO_COMPLETE');
  });

  readonly requiredFieldsStatus = computed(() => {
    this.translate.currentLang();
    const v   = this.formValue() as any;
    const id  = v?.identity ?? {};
    const pos = v?.position ?? {};
    return [
      { label: this.translate.instant('CANDIDATES.FORM.RF_NAME'),     done: !!(id.firstName && id.lastName) },
      { label: this.translate.instant('CANDIDATES.FORM.RF_EMAIL'),    done: !!id.emailPersonal },
      { label: this.translate.instant('CANDIDATES.FORM.RF_POSITION'), done: !!pos.appliedPosition },
      { label: this.translate.instant('CANDIDATES.FORM.RF_CONTRACT'), done: !!pos.employmentTypeId },
      { label: this.translate.instant('CANDIDATES.FORM.RF_START'),    done: !!pos.expectedStartDate },
    ];
  });

  get identityGroup(): FormGroup { return this.form.get('identity') as FormGroup; }
  get positionGroup(): FormGroup { return this.form.get('position') as FormGroup; }

  // ── Vacancy (recruitment demand) ─────────────────────────────────────────

  /** Approved demands only — the endpoint filters, an unapproved demand is not a vacancy. */
  readonly demands = signal<ApprovedDemandOption[]>([]);

  readonly demandOptions = computed<SelectOption[]>(() =>
    this.demands().map(d => ({
      value: String(d.id),
      label: d.department ? `${d.label} — ${d.department}` : d.label,
    })));

  /**
   * Minimum years implied by each required experience level.
   *
   * Read off the seeded labels, which state the bands: Junior (0-2), Confirmé (3-5),
   * Sénior (6-10), Expert (+10). JUNIOR maps to 1 rather than its literal floor of 0, because 0
   * is both "fresh graduate" and "slider untouched" — 1 keeps the two distinguishable.
   *
   * Keyed on the value CODE, never the label: labels are admin-editable.
   */
  private static readonly EXPERIENCE_YEARS: Record<string, number> = {
    DEBUTANT: 0, JUNIOR: 1, CONFIRME: 3, SENIOR: 6, EXPERT: 10,
  };

  /**
   * Attaches the candidature to a vacancy and prefills everything the vacancy knows.
   *
   * Prefill only fills fields the recruiter has left EMPTY. Overwriting typed values would make
   * picking a demand destructive, and a candidate is often considered for a slightly different
   * shape of the role than the demand describes.
   *
   * Department, grade and discipline now come across as IDs (V72) — the demand carries the same
   * dimension FKs the employee profile will. This used to match the department by label string,
   * and grade/discipline could not be filled at all because the demand did not hold them.
   */
  onDemandSelected(values: string[]): void {
    this.setSelectNum('position.recruitmentDemandId', values);
    const id = values[0] ? Number(values[0]) : null;
    if (id == null) return;

    this.demandSvc.getById(id).pipe(catchError(() => of(null))).subscribe(d => {
      if (!d) return;
      const pos = this.positionGroup;
      const fillIfEmpty = (key: string, value: unknown) => {
        const ctrl = pos.get(key);
        if (!ctrl) return;
        const cur = ctrl.value;
        if (value != null && value !== '' && (cur == null || cur === '')) ctrl.setValue(value);
      };

      fillIfEmpty('appliedPosition',     d.jobExactTitle?.trim() || d.jobTitle?.trim());
      fillIfEmpty('expectedStartDate',   d.targetStartDate);
      fillIfEmpty('departmentId',        d.departmentId);
      fillIfEmpty('appliedGradeId',      d.gradeId);
      fillIfEmpty('appliedDisciplineId', d.disciplineId);

      // Departments fall back to the label for demands raised before V72, which have an id of
      // null but still carry a name.
      if (d.departmentId == null && d.department && pos.get('departmentId')?.value == null) {
        const match = this.departments().find(x => x.labelFr === d.department);
        if (match) pos.get('departmentId')?.setValue(match.id);
      }

      /*
       * Experience is the one field where the two sides mean different things: the demand says
       * what the ROLE requires, `experienceYears` is what THIS candidate has. So the slider is
       * seeded with the role's minimum — a starting point the recruiter is expected to correct —
       * and only while it is still untouched at 0.
       */
      const years = d.experienceLevelCode
        ? CandidateFormComponent.EXPERIENCE_YEARS[d.experienceLevelCode.toUpperCase()]
        : undefined;
      if (years !== undefined && this.experienceYears() === 0) {
        this.experienceYears.set(years);
      }

      pos.markAsTouched();
    });
  }

  ngOnInit(): void {
    const paysId = this.userStore.currentUser()?.paysId;
    if (paysId) {
      this.demandSvc.getApprovedOptions(paysId)
        .pipe(catchError(() => of([] as ApprovedDemandOption[])))
        .subscribe(d => this.demands.set(d));
    }
    this.refSvc.getGrades().subscribe(r => this.grades.set(r));
    this.refSvc.getDisciplines().subscribe(r => this.disciplines.set(r));
    this.refSvc.getDepartments().subscribe(r => this.departments.set(r));
    this.refSvc.getNationalities().subscribe(r => this.nationalities.set(r));
    this.listSvc.getListValues('EMPLOYMENT_TYPE', paysId).subscribe(v => this.employmentTypes.set(v));
  }

  // ── Bridge helpers ───────────────────────────────────────────────────────

  getSelectStr(path: string): string[] {
    const val = this.form.get(path)?.value;
    return val ? [String(val)] : [];
  }

  setSelectStr(path: string, values: string[]): void {
    const ctrl = this.form.get(path);
    ctrl?.setValue(values[0] ?? '');
    ctrl?.markAsTouched();
  }

  getSelectNum(path: string): string[] {
    const val = this.form.get(path)?.value;
    return val != null ? [String(val)] : [];
  }

  setSelectNum(path: string, values: string[]): void {
    const ctrl = this.form.get(path);
    ctrl?.setValue(values[0] ? Number(values[0]) : null);
    ctrl?.markAsTouched();
  }

  getTextValue(path: string): string | number | null {
    return this.form.get(path)?.value ?? null;
  }

  setTextValue(path: string, value: string | number | null): void {
    this.form.get(path)?.setValue(value);
    this.form.get(path)?.markAsTouched();
  }

  getFieldError(path: string): string {
    const ctrl = this.form.get(path);
    if (!ctrl?.touched || !ctrl?.invalid) return '';
    if (ctrl.hasError('required')) return this.translate.instant('CANDIDATES.FORM.FIELD_REQUIRED');
    if (ctrl.hasError('email')) return this.translate.instant('CANDIDATES.FORM.EMAIL_INVALID');
    return '';
  }

  getDateValue(path: string): Date | null {
    return isoToDate(this.form.get(path)?.value ?? null);
  }

  setDateValue(path: string, value: Date | Date[] | null): void {
    const ctrl = this.form.get(path);
    ctrl?.setValue(dateToIso(value) || null);
    ctrl?.markAsTouched();
  }

  fillStyle(filled: boolean): string {
    return filled ? "'FILL' 1" : "'FILL' 0";
  }

  // ── Navigation ───────────────────────────────────────────────────────────

  navigateToList(): void {
    this.router.navigate(['/rh/candidates']);
  }

  onCancel(): void {
    this.router.navigate(['/rh/candidates']);
  }

  goNext(): void {
    this.error.set(null);
    if (!this.canGoNext()) {
      if (this.currentStep() === 1) this.identityGroup.markAllAsTouched();
      if (this.currentStep() === 2) this.positionGroup.markAllAsTouched();
      this.error.set(this.stepValidationError());
      return;
    }
    if (this.currentStep() < this.STEP_INFO.length) {
      this.currentStep.update(s => s + 1);
    } else {
      this.onSubmit();
    }
  }

  goPrev(): void {
    if (this.currentStep() > 1) this.currentStep.update(s => s - 1);
  }

  // ── Submit ───────────────────────────────────────────────────────────────

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set(this.translate.instant('CANDIDATES.FORM.ERR_REQUIRED_STAR'));
      return;
    }
    this.error.set(null);
    this.saving.set(true);

    const paysId   = this.userStore.currentUser()?.paysId ?? 179;
    const identity = this.identityGroup.value;
    const position = this.positionGroup.value;

    const dto: CreateCandidateRequest = {
      paysId,
      firstName:           identity.firstName,
      lastName:            identity.lastName,
      emailPersonal:       identity.emailPersonal,
      phone:               identity.phone               || null,
      dateOfBirth:         identity.dateOfBirth         || null,
      gender:              identity.gender              || null,
      nationalId:          identity.nationalId          || null,
      appliedPosition:     position.appliedPosition     || null,
      departmentId:        position.departmentId        ?? null,
      employmentTypeId:    position.employmentTypeId    ?? null,
      recruitmentDemandId: position.recruitmentDemandId ?? null,
      appliedGradeId:      position.appliedGradeId      ?? null,
      appliedDisciplineId: position.appliedDisciplineId ?? null,
      nationalityId:       position.nationalityId       ?? null,
      expectedStartDate:   position.expectedStartDate   || null,
      notes:               this.form.get('notes')?.value ?? null,
      experienceYears:     this.experienceYears() || null,
      location:            identity.location            || null,
      salaireNetCandidat:  position.salaireNetCandidat  ?? null,
      salaireNetRh:        position.salaireNetRh        ?? null,
    };

    this.candidateService.create(dto).subscribe({
      next:  created => this.afterSave(created.id),
      error: err     => {
        this.saving.set(false);
        this.error.set(err?.error?.detail ?? err?.error?.message ?? this.translate.instant('CANDIDATES.FORM.ERR_CREATE'));
      },
    });
  }

  private afterSave(candidateId: number): void {
    const file = this.cvFiles().find(f => !f.error)?.file ?? null;
    if (!file) {
      this.saving.set(false);
      this.router.navigate(['/rh/candidates', candidateId]);
      return;
    }
    this.candidateService.uploadCv(candidateId, file).subscribe({
      next: () => {
        this.saving.set(false);
        this.router.navigate(['/rh/candidates', candidateId]);
      },
      error: () => {
        this.saving.set(false);
        this.error.set(this.translate.instant('CANDIDATES.FORM.ERR_CV_AFTER_SAVE'));
        setTimeout(() => this.router.navigate(['/rh/candidates', candidateId]), 3000);
      },
    });
  }
}
