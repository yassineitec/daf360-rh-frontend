import {
  Component, computed, effect, inject, input, output, signal,
} from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { catchError, of } from 'rxjs';

import { UserStore }               from '../../core/user.store';
import { ConfigurableListService } from '../../core/lists/configurable-list.service';
import { ListValue }               from '../../core/lists/configurable-list.model';
import { RecruitmentDemandService } from './recruitment-demand.service';
import { RefDataService }          from '../../core/ref/ref-data.service';
import { RefDataItem }             from '../../core/ref/ref-data.model';
import { TagsInputComponent }      from '../../shared/tags-input/tags-input.component';
import {
  RecruitmentReason,
  RECRUITMENT_REASONS,
  TECHNICAL_SKILLS_SUGGESTIONS,
  SOFT_SKILLS_SUGGESTIONS,
  CreateRecruitmentDemandRequest,
} from './recruitment-demand.model';

@Component({
  selector: 'app-recruitment-demand-form',
  standalone: true,
  imports: [ReactiveFormsModule, TagsInputComponent, TranslatePipe],
  templateUrl: './recruitment-demand-form.component.html',
  styleUrl: './recruitment-demand-form.component.scss',
})
export class RecruitmentDemandFormComponent {
  visible = input(false);
  closed  = output<void>();
  saved   = output<void>();

  private fb        = inject(FormBuilder);
  private svc       = inject(RecruitmentDemandService);
  private listSvc   = inject(ConfigurableListService);
  private refSvc    = inject(RefDataService);
  private userStore = inject(UserStore);
  private translate = inject(TranslateService);

  // Form state
  saving    = signal(false);
  error     = signal<string | null>(null);
  submitted = signal(false);

  // Signal-managed fields (outside FormGroup)
  recruitmentReason = signal<RecruitmentReason | null>(null);
  technicalSkills   = signal<string[]>([]);
  softSkills        = signal<string[]>([]);

  // Dropdown data
  urgencyLevels    = signal<ListValue[]>([]);
  cspCategories    = signal<ListValue[]>([]);
  experienceLevels = signal<ListValue[]>([]);
  educationLevels  = signal<ListValue[]>([]);
  departments      = signal<RefDataItem[]>([]);

  // Static reference data
  readonly techSugg = TECHNICAL_SKILLS_SUGGESTIONS;
  readonly softSugg = SOFT_SKILLS_SUGGESTIONS;

  // Translated recruitment reasons (recomputed on language change)
  readonly reasons = computed(() => {
    this.translate.currentLang();
    return RECRUITMENT_REASONS.map(r => ({
      value: r.value,
      icon:  r.icon,
      label:       this.translate.instant(`RECRUITMENT_DEMANDS.FORM.REASON.${r.value}_LABEL`),
      description: this.translate.instant(`RECRUITMENT_DEMANDS.FORM.REASON.${r.value}_DESC`),
    }));
  });

  form = this.fb.group({
    jobTitle:          ['', Validators.required],
    jobExactTitle:     [null as string | null],
    needDescription:   [null as string | null, Validators.maxLength(4000)],
    requiredProfile:   ['', Validators.maxLength(2000)],
    scopeOfWork:       ['', Validators.maxLength(2000)],
    urgencyLevelId:    [null as number | null, Validators.required],
    cspCategoryId:     [null as number | null],
    experienceLevelId: [null as number | null],
    educationLevelId:  [null as number | null],
    headcount:         [1, [Validators.required, Validators.min(1), Validators.max(50)]],
    targetStartDate:   [null as string | null],
    budgetRange:       [null as string | null],
    department:        [null as string | null],
    additionalNotes:   [null as string | null],
  });

  constructor() {
    effect(() => {
      if (!this.visible()) return;
      this.resetForm();
      this.loadLists();
    });
  }

  private resetForm(): void {
    this.form.reset({
      jobTitle: '', jobExactTitle: null,
      needDescription: null, requiredProfile: '', scopeOfWork: '',
      urgencyLevelId: null, cspCategoryId: null,
      experienceLevelId: null, educationLevelId: null,
      headcount: 1, targetStartDate: null,
      budgetRange: null, department: null, additionalNotes: null,
    });
    this.recruitmentReason.set(null);
    this.technicalSkills.set([]);
    this.softSkills.set([]);
    this.error.set(null);
    this.submitted.set(false);
  }

  private loadLists(): void {
    const paysId = this.userStore.currentUser()?.paysId;
    this.listSvc.getListValues('URGENCY_LEVEL',    paysId).pipe(catchError(() => of([]))).subscribe(v => this.urgencyLevels.set(v));
    this.listSvc.getListValues('CSP_CATEGORY',     paysId).pipe(catchError(() => of([]))).subscribe(v => this.cspCategories.set(v));
    this.listSvc.getListValues('EXPERIENCE_LEVEL', paysId).pipe(catchError(() => of([]))).subscribe(v => this.experienceLevels.set(v));
    this.listSvc.getListValues('EDUCATION_LEVEL',  paysId).pipe(catchError(() => of([]))).subscribe(v => this.educationLevels.set(v));
    if (paysId) this.refSvc.getDepartments(paysId).pipe(catchError(() => of([]))).subscribe(v => this.departments.set(v));
  }

  selectReason(reason: RecruitmentReason): void {
    this.recruitmentReason.set(reason === this.recruitmentReason() ? null : reason);
  }

  onClose(): void { this.closed.emit(); }

  onSubmit(): void {
    this.submitted.set(true);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set(this.translate.instant('RECRUITMENT_DEMANDS.FORM.ERR_REQUIRED'));
      return;
    }

    const paysId = this.userStore.currentUser()?.paysId;
    if (!paysId) {
      this.error.set(this.translate.instant('RECRUITMENT_DEMANDS.FORM.ERR_NO_PAYS'));
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    const v = this.form.value;
    const dto: CreateRecruitmentDemandRequest = {
      paysId,
      jobTitle:          v.jobTitle!,
      jobExactTitle:     v.jobExactTitle     || null,
      department:        v.department        || null,
      recruitmentReason: this.recruitmentReason() ?? undefined,
      needDescription:   v.needDescription   || null,
      requiredProfile:   v.requiredProfile   || '',
      scopeOfWork:       v.scopeOfWork       || '',
      urgencyLevelId:    Number(v.urgencyLevelId),
      cspCategoryId:     v.cspCategoryId     ? Number(v.cspCategoryId)     : null,
      experienceLevelId: v.experienceLevelId ? Number(v.experienceLevelId) : null,
      educationLevelId:  v.educationLevelId  ? Number(v.educationLevelId)  : null,
      technicalSkills:   this.technicalSkills(),
      softSkills:        this.softSkills(),
      headcount:         v.headcount!,
      targetStartDate:   v.targetStartDate   || null,
      budgetRange:       v.budgetRange       || null,
      additionalNotes:   v.additionalNotes   || null,
    };

    this.svc.create(dto).subscribe({
      next: () => {
        this.saving.set(false);
        this.saved.emit();
        this.closed.emit();
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.detail ?? err?.error?.message ?? this.translate.instant('RECRUITMENT_DEMANDS.FORM.ERR_GENERIC'));
      },
    });
  }
}
