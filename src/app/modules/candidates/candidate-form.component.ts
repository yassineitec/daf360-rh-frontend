import {
  Component, effect, inject, input, output, signal,
} from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';

import { ModalComponent }     from '../../shared/modal.component';
import { UserStore }          from '../../core/user.store';
import { CandidateService }   from './candidate.service';
import {
  CandidateDetail,
  CreateCandidateRequest,
  UpdateCandidateRequest,
} from './candidate.model';
import { RefDataService }            from '../../core/ref/ref-data.service';
import { RefDataItem }               from '../../core/ref/ref-data.model';
import { RecruitmentDemandService }  from '../recruitment-demands/recruitment-demand.service';
import { ApprovedDemandOption }      from '../recruitment-demands/recruitment-demand.model';
import { ConfigurableListService }   from '../../core/lists/configurable-list.service';
import { ListValue }                 from '../../core/lists/configurable-list.model';

@Component({
  selector: 'app-candidate-form',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent],
  templateUrl: './candidate-form.component.html',
  styleUrl: './candidate-form.component.scss',
})
export class CandidateFormComponent {
  // ── Inputs / Outputs ────────────────────────────────────────────────────────
  visible   = input(false);
  candidate = input<CandidateDetail | null>(null);
  closed    = output<void>();
  saved     = output<void>();

  // ── Services ────────────────────────────────────────────────────────────────
  private fb               = inject(FormBuilder);
  private candidateService = inject(CandidateService);
  private userStore        = inject(UserStore);
  private refSvc           = inject(RefDataService);
  private demandSvc        = inject(RecruitmentDemandService);
  private listSvc          = inject(ConfigurableListService);

  // ── State ───────────────────────────────────────────────────────────────────
  saving              = signal(false);
  error               = signal<string | null>(null);
  cvFile              = signal<File | null>(null);
  cvError             = signal<string | null>(null);
  departmentAutoFilled = signal(false);

  // ── Ref data lists ──────────────────────────────────────────────────────────
  grades           = signal<RefDataItem[]>([]);
  disciplines      = signal<RefDataItem[]>([]);
  departments      = signal<RefDataItem[]>([]);
  nationalities    = signal<RefDataItem[]>([]);
  approvedDemands  = signal<ApprovedDemandOption[]>([]);
  employmentTypes  = signal<ListValue[]>([]);

  // ── Form ────────────────────────────────────────────────────────────────────
  form: FormGroup = this.fb.group({
    identity: this.fb.group({
      firstName:     ['', Validators.required],
      lastName:      ['', Validators.required],
      emailPersonal: ['', [Validators.required, Validators.email]],
      phone:         [null as string | null],
    }),
    position: this.fb.group({
      appliedPosition:     [null as string | null],
      recruitmentDemandId: [null as number | null],
      departmentId:        [null as number | null],
      employmentTypeId:    [null as number | null],
      appliedGradeId:      [null as number | null],
      appliedDisciplineId: [null as number | null],
      nationalityId:       [null as number | null],
      expectedStartDate:   ['', Validators.required],
      paysId:              [null as number | null],
    }),
    notes: [null as string | null],
  });

  // ── Derived ─────────────────────────────────────────────────────────────────
  get identityGroup(): FormGroup {
    return this.form.get('identity') as FormGroup;
  }

  get positionGroup(): FormGroup {
    return this.form.get('position') as FormGroup;
  }

  // ── Effect: react to visibility + candidate changes ─────────────────────────
  constructor() {
    effect(() => {
      if (!this.visible()) return;

      const c = this.candidate();
      this.error.set(null);

      // Reset CV selection on every modal open
      this.cvFile.set(null);
      this.cvError.set(null);

      // Load ref data lists
      const paysId = c?.paysId ?? this.userStore.currentUser()?.paysId ?? 179;
      this.refSvc.getGrades(paysId).subscribe(r => this.grades.set(r));
      this.refSvc.getDisciplines(paysId).subscribe(r => this.disciplines.set(r));
      this.refSvc.getDepartments(paysId).subscribe(r => this.departments.set(r));
      this.refSvc.getNationalities().subscribe(r => this.nationalities.set(r));
      this.demandSvc.getApprovedOptions(paysId).subscribe({ next: r => this.approvedDemands.set(r), error: () => {} });
      this.listSvc.getListValues('EMPLOYMENT_TYPE', paysId).subscribe({ next: v => this.employmentTypes.set(v), error: () => {} });

      if (c) {
        // Edit mode — patch with existing data
        this.form.patchValue({
          identity: {
            firstName:     c.firstName,
            lastName:      c.lastName,
            emailPersonal: c.emailPersonal,
            phone:         c.phone,
          },
          position: {
            appliedPosition:     c.appliedPosition,
            recruitmentDemandId: c.recruitmentDemandId,
            departmentId:        c.departmentId,
            employmentTypeId:    c.employmentTypeId ?? null,
            appliedGradeId:      c.appliedGradeId,
            appliedDisciplineId: c.appliedDisciplineId,
            nationalityId:       c.nationalityId,
            expectedStartDate:   c.expectedStartDate,
            paysId:              c.paysId,
          },
          notes: c.notes,
        });
      } else {
        // Create mode — reset and seed paysId from current user
        this.form.reset({
          identity: { firstName: '', lastName: '', emailPersonal: '', phone: null },
          position: {
            appliedPosition:     null,
            recruitmentDemandId: null,
            departmentId:        null,
            employmentTypeId:    null,
            appliedGradeId:      null,
            appliedDisciplineId: null,
            nationalityId:       null,
            expectedStartDate:   '',
            paysId:              this.userStore.currentUser()?.paysId ?? null,
          },
          notes: null,
        });
      }
    });

    // Auto-fill department when a recruitment demand is selected
    this.positionGroup.get('recruitmentDemandId')!.valueChanges.subscribe((demandId: number | null) => {
      this.departmentAutoFilled.set(false);
      if (!demandId) return;
      const demand = this.approvedDemands().find(d => d.id === demandId);
      if (!demand?.department) return;
      const match = this.departments().find(
        d => d.labelFr.toLowerCase() === demand.department!.toLowerCase()
      );
      if (!match) return;
      this.positionGroup.patchValue({ departmentId: match.id }, { emitEvent: false });
      this.departmentAutoFilled.set(true);
    });
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Veuillez remplir tous les champs obligatoires (marqués *).');
      return;
    }
    this.error.set(null);

    this.saving.set(true);
    this.error.set(null);

    const identity = this.identityGroup.value;
    const position = this.positionGroup.value;
    const notes    = this.form.get('notes')?.value ?? null;

    const c = this.candidate();

    if (!c) {
      // CREATE
      const dto: CreateCandidateRequest = {
        paysId:              position.paysId,
        firstName:           identity.firstName,
        lastName:            identity.lastName,
        emailPersonal:       identity.emailPersonal,
        phone:               identity.phone              || null,
        appliedPosition:     position.appliedPosition    || null,
        recruitmentDemandId: position.recruitmentDemandId ?? null,
        departmentId:        position.departmentId       ?? null,
        employmentTypeId:    position.employmentTypeId   ?? null,
        appliedGradeId:      position.appliedGradeId     ?? null,
        appliedDisciplineId: position.appliedDisciplineId ?? null,
        nationalityId:       position.nationalityId      ?? null,
        expectedStartDate:   position.expectedStartDate  || null,
        notes,
      };

      this.candidateService.create(dto).subscribe({
        next: (created) => this.afterSave(created.id),
        error: (err) => {
          this.saving.set(false);
          this.error.set(err?.error?.detail ?? err?.error?.message ?? 'Une erreur est survenue lors de la création.');
        },
      });
    } else {
      // UPDATE
      const dto: UpdateCandidateRequest = {
        firstName:           identity.firstName,
        lastName:            identity.lastName,
        emailPersonal:       identity.emailPersonal,
        phone:               identity.phone              || null,
        appliedPosition:     position.appliedPosition    || null,
        departmentId:        position.departmentId       ?? null,
        appliedGradeId:      position.appliedGradeId     ?? null,
        appliedDisciplineId: position.appliedDisciplineId ?? null,
        nationalityId:       position.nationalityId      ?? null,
        expectedStartDate:   position.expectedStartDate  || null,
        notes,
      };

      this.candidateService.update(c.id, dto).subscribe({
        next: (updated) => this.afterSave(updated.id),
        error: (err) => {
          this.saving.set(false);
          this.error.set(err?.error?.detail ?? err?.error?.message ?? 'Une erreur est survenue lors de la mise à jour.');
        },
      });
    }
  }

  /** After create/update succeeds: upload CV if one was selected, then close. */
  private afterSave(candidateId: number): void {
    const file = this.cvFile();
    if (!file) {
      this.saving.set(false);
      this.saved.emit();
      this.closed.emit();
      return;
    }
    // Upload the CV (second step)
    this.candidateService.uploadCv(candidateId, file).subscribe({
      next: () => {
        this.saving.set(false);
        this.saved.emit();
        this.closed.emit();
      },
      error: () => {
        // CV upload failed — but the candidate WAS saved; warn and close
        this.saving.set(false);
        this.error.set('Candidat enregistré, mais le téléversement du CV a échoué. Réessayez depuis la fiche candidat.');
        setTimeout(() => { this.saved.emit(); this.closed.emit(); }, 3000);
      },
    });
  }

  /** Validates and stores the selected CV file. */
  onCvFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0] ?? null;
    this.cvError.set(null);
    this.cvFile.set(null);

    if (!file) return;

    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!allowed.includes(file.type)) {
      this.cvError.set('Format non supporté — PDF, DOC ou DOCX uniquement');
      input.value = '';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.cvError.set('Fichier trop volumineux — max 10 Mo');
      input.value = '';
      return;
    }
    this.cvFile.set(file);
  }
}
