import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

import { UserStore }        from '../../core/user.store';
import { CandidateService } from './candidate.service';
import { CreateCandidateRequest } from './candidate.model';
import { RefDataService } from '../../core/ref/ref-data.service';
import { RefDataItem }    from '../../core/ref/ref-data.model';
import {
  ButtonComponent,
  ChipGroupComponent,
  ChipOption,
  DatePickerComponent,
  FileUploadComponent,
  FormFieldComponent,
  SelectComponent,
  SelectOption,
  SliderComponent,
  UploadedFile,
} from '@khalilrebhiitec/daf360';

@Component({
  selector: 'app-candidate-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    ButtonComponent,
    ChipGroupComponent,
    DatePickerComponent,
    FileUploadComponent,
    FormFieldComponent,
    SelectComponent,
    SliderComponent,
  ],
  templateUrl: './candidate-form.component.html',
})
export class CandidateFormComponent implements OnInit {

  private fb               = inject(FormBuilder);
  private candidateService = inject(CandidateService);
  private userStore        = inject(UserStore);
  private refSvc           = inject(RefDataService);
  private router           = inject(Router);

  saving          = signal(false);
  error           = signal<string | null>(null);
  cvFiles         = signal<UploadedFile[]>([]);
  experienceYears = signal(0);

  grades        = signal<RefDataItem[]>([]);
  disciplines   = signal<RefDataItem[]>([]);
  departments   = signal<RefDataItem[]>([]);
  nationalities = signal<RefDataItem[]>([]);

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

  readonly contractChipOptions: ChipOption[] = [
    { value: 'PERMANENT',  label: 'CDI' },
    { value: 'FIXED_TERM', label: 'CDD' },
    { value: 'CONSULTANT', label: 'Freelance' },
    { value: 'INTERN',     label: 'Stage' },
  ];

  form: FormGroup = this.fb.group({
    identity: this.fb.group({
      firstName:     ['', Validators.required],
      lastName:      ['', Validators.required],
      emailPersonal: ['', [Validators.required, Validators.email]],
      phone:         [null as string | null],
      dateOfBirth:   [null as string | null],
      nationalId:    [null as string | null],
    }),
    position: this.fb.group({
      appliedPosition:     ['', Validators.required],
      departmentId:        [null as number | null],
      contractType:        ['', Validators.required],
      appliedGradeId:      [null as number | null],
      appliedDisciplineId: [null as number | null],
      nationalityId:       [null as number | null],
      expectedStartDate:   ['', Validators.required],
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
      id.dateOfBirth, id.nationalId,
      pos.appliedPosition, pos.contractType, pos.expectedStartDate,
      pos.departmentId, pos.appliedGradeId, pos.appliedDisciplineId,
      pos.nationalityId, v?.notes,
    ];
    const total  = fields.length + 1; // +1 for CV
    const filled = fields.filter((val: unknown) => val != null && val !== '').length
                 + (this.cvFiles().length > 0 ? 1 : 0);
    return Math.round((filled / total) * 100);
  });

  readonly completenessLabel = computed(() => {
    const p = this.profileCompleteness();
    if (p >= 100) return 'Complet';
    if (p >= 75)  return 'Très bon';
    if (p >= 50)  return 'Bon';
    if (p >= 25)  return 'En cours';
    return 'À compléter';
  });

  readonly requiredFieldsStatus = computed(() => {
    const v   = this.formValue() as any;
    const id  = v?.identity ?? {};
    const pos = v?.position ?? {};
    return [
      { label: 'Prénom et Nom',       done: !!(id.firstName && id.lastName) },
      { label: 'Email professionnel', done: !!id.emailPersonal },
      { label: 'Poste souhaité',      done: !!pos.appliedPosition },
      { label: 'Type de contrat',     done: !!pos.contractType },
      { label: 'Date de début',       done: !!pos.expectedStartDate },
    ];
  });

  get identityGroup(): FormGroup { return this.form.get('identity') as FormGroup; }
  get positionGroup(): FormGroup { return this.form.get('position') as FormGroup; }

  ngOnInit(): void {
    this.refSvc.getGrades().subscribe(r => this.grades.set(r));
    this.refSvc.getDisciplines().subscribe(r => this.disciplines.set(r));
    this.refSvc.getDepartments().subscribe(r => this.departments.set(r));
    this.refSvc.getNationalities().subscribe(r => this.nationalities.set(r));
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
    if (ctrl.hasError('required')) return 'Ce champ est obligatoire.';
    if (ctrl.hasError('email')) return "Format d'email invalide.";
    return '';
  }

  getDateValue(path: string): string {
    return this.form.get(path)?.value ?? '';
  }

  setDateValue(path: string, value: string): void {
    const ctrl = this.form.get(path);
    ctrl?.setValue(value || null);
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

  // ── Submit ───────────────────────────────────────────────────────────────

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Veuillez remplir tous les champs obligatoires (marqués *).');
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
      nationalId:          identity.nationalId          || null,
      appliedPosition:     position.appliedPosition     || null,
      departmentId:        position.departmentId        ?? null,
      contractType:        position.contractType        || null,
      appliedGradeId:      position.appliedGradeId      ?? null,
      appliedDisciplineId: position.appliedDisciplineId ?? null,
      nationalityId:       position.nationalityId       ?? null,
      expectedStartDate:   position.expectedStartDate   || null,
      notes:               this.form.get('notes')?.value ?? null,
    };

    this.candidateService.create(dto).subscribe({
      next:  created => this.afterSave(created.id),
      error: err     => {
        this.saving.set(false);
        this.error.set(err?.error?.detail ?? err?.error?.message ?? 'Erreur lors de la création.');
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
        this.error.set('Candidat enregistré, mais le téléversement du CV a échoué. Réessayez depuis la fiche.');
        setTimeout(() => this.router.navigate(['/rh/candidates', candidateId]), 3000);
      },
    });
  }
}
