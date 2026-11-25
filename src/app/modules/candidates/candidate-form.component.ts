import { Component, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import {
  AbstractControl, ReactiveFormsModule, FormBuilder, FormGroup, ValidationErrors, Validators,
} from '@angular/forms';
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
import { ArchivedCandidate }        from '../pipeline/services/pipeline.service';
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
import { genderOptions } from '../../shared/utils/gender.utils';
import { formatFirstName, formatLastName } from '../../shared/utils/person-name.utils';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { WizardStepCardComponent } from '../../shared/wizard/wizard-step-card.component';
import { PageGuideComponent } from '../../shared/guide/page-guide.component';
import { GuideStep } from '../../shared/guide/page-guide.types';

/**
 * Steps of the page guide, started from « Aide & guides » (« Candidats » tab). Each
 * `target` is a `data-guide` anchor in the template; the sidebar ones are desktop-only, so
 * on mobile those steps show centred.
 *
 * `tab` is the wizard step to show (see `onGuideStep`): the guide walks the form itself,
 * since clicking the form's « Suivant » under the guide's backdrop would close the guide.
 */
const GUIDE_STEPS: GuideStep[] = [
  { icon: 'waving_hand', titleKey: 'CANDIDATE_FORM.GUIDE.WELCOME.TITLE',  textKey: 'CANDIDATE_FORM.GUIDE.WELCOME.TEXT',  tab: '1' },
  { icon: 'work_history', titleKey: 'CANDIDATE_FORM.GUIDE.DEMAND.TITLE',  textKey: 'CANDIDATE_FORM.GUIDE.DEMAND.TEXT',   target: 'form', tab: '1' },
  { icon: 'person',      titleKey: 'CANDIDATE_FORM.GUIDE.IDENTITY.TITLE', textKey: 'CANDIDATE_FORM.GUIDE.IDENTITY.TEXT', target: 'form', tab: '2' },
  { icon: 'work',        titleKey: 'CANDIDATE_FORM.GUIDE.POSITION.TITLE', textKey: 'CANDIDATE_FORM.GUIDE.POSITION.TEXT', target: 'form', tab: '3' },
  { icon: 'description', titleKey: 'CANDIDATE_FORM.GUIDE.CV_NOTES.TITLE', textKey: 'CANDIDATE_FORM.GUIDE.CV_NOTES.TEXT', target: 'form', tab: '4' },
  { icon: 'checklist',   titleKey: 'CANDIDATE_FORM.GUIDE.PROGRESS.TITLE', textKey: 'CANDIDATE_FORM.GUIDE.PROGRESS.TEXT', target: 'progress', tab: '4' },
  { icon: 'save',        titleKey: 'CANDIDATE_FORM.GUIDE.ACTIONS.TITLE',  textKey: 'CANDIDATE_FORM.GUIDE.ACTIONS.TEXT',  target: 'actions', tab: '5' },
  { icon: 'help',        titleKey: 'CANDIDATE_FORM.GUIDE.END.TITLE',      textKey: 'CANDIDATE_FORM.GUIDE.END.TEXT',      tab: '1' },
];

/** `Validators.required` that also refuses a value made only of spaces. */
function blankRequired(control: AbstractControl): ValidationErrors | null {
  const v = control.value;
  return v == null || String(v).trim() === '' ? { required: true } : null;
}

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
    PageGuideComponent,
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

  readonly guideSteps = GUIDE_STEPS;

  saving          = signal(false);
  error           = signal<string | null>(null);
  cvFiles         = signal<UploadedFile[]>([]);
  experienceYears = signal(0);

  grades          = signal<RefDataItem[]>([]);
  disciplines     = signal<RefDataItem[]>([]);
  departments     = signal<RefDataItem[]>([]);
  nationalities   = signal<RefDataItem[]>([]);
  employmentTypes = signal<ListValue[]>([]);
  genders         = signal<ListValue[]>([]);

  /**
   * Admin-managed label in the UI language. Both labels are edited in rh/admin; an
   * entry with no English label falls back to the French one rather than showing blank.
   */
  private label(item: { labelFr: string; labelEn: string }): string {
    return (this.translate.currentLang() === 'en' ? item.labelEn : item.labelFr)
      || item.labelFr || item.labelEn;
  }

  readonly gradeOptions = computed<SelectOption[]>(() =>
    this.grades().map(g => ({ value: String(g.id), label: this.label(g) }))
  );
  readonly disciplineOptions = computed<SelectOption[]>(() =>
    this.disciplines().map(d => ({ value: String(d.id), label: this.label(d) }))
  );
  readonly departmentOptions = computed<SelectOption[]>(() =>
    this.departments().map(d => ({ value: String(d.id), label: this.label(d) }))
  );
  /** Candidates are recruited for the Tunisian and Egyptian entities only — offer just those two. */
  private static readonly CANDIDATE_NATIONALITY_CODES = ['TN', 'EG'];
  readonly nationalityOptions = computed<SelectOption[]>(() =>
    this.nationalities()
      .filter(n => CandidateFormComponent.CANDIDATE_NATIONALITY_CODES.includes((n.code ?? '').toUpperCase()))
      .map(n => ({ value: String(n.id), label: this.label(n) }))
  );

  /**
   * Gender options from the admin GENDER list, still limited to Homme / Femme (canonical
   * MALE/FEMALE codes). Falls back to the static options while the list is empty.
   */
  readonly genderOptions = computed<SelectOption[]>(() => {
    this.translate.currentLang();
    const fromAdmin = this.genders()
      .filter(v => v.valueCode === 'MALE' || v.valueCode === 'FEMALE')
      .map(v => ({ value: v.valueCode, label: this.label(v) }));
    return fromAdmin.length
      ? fromAdmin
      : genderOptions(this.translate);
  });

  /**
   * Contract types come from the configurable CONTRACT_TYPE list (per pays).
   * The candidate stores an `employmentTypeId`; the backend later derives the
   * actual contract code from it at hire time (CandidateService#hireCandidate).
   */
  readonly employmentTypeChipOptions = computed<ChipOption[]>(() =>
    this.employmentTypes().map(t => ({ value: String(t.id), label: this.label(t) })),
  );

  // ── Step 1: the recruitment demand (V137) ────────────────────────────────
  /*
   * The wizard starts on the vacancy. Picking it fills the position fields (step 3). When the
   * same post was requested before (department + title + exact title) and those demands left
   * archived candidatures, the step also asks who the candidate is: a new one, or a COPY of
   * one of those archived candidates — the archived record itself stays as it is. A post
   * requested for the first time asks nothing more.
   */
  readonly demandsLoading = signal(true);
  readonly demandsError   = signal<string | null>(null);
  readonly related        = signal<ArchivedCandidate[]>([]);
  readonly relatedLoading = signal(false);
  /** NEW = a blank candidate; REUSE = start from an archived candidature of the same post. */
  readonly candidateSource = signal<'NEW' | 'REUSE'>('NEW');
  /** The archived candidature the form was filled from; its CV is copied server-side. */
  readonly copiedFrom     = signal<{ id: number; fullName: string; cvName: string | null } | null>(null);

  isFull(d: ApprovedDemandOption): boolean {
    return d.headcount != null && (d.positionsFilled ?? 0) >= d.headcount;
  }

  /** The demand currently picked in step 1. */
  readonly chosenDemand = computed(() => {
    this.formValue();
    const id = this.positionGroup.get('recruitmentDemandId')?.value;
    return this.demands().find(d => d.id === id) ?? null;
  });

  readonly sourceOptions = computed<ChipOption[]>(() => {
    this.translate.currentLang();
    const n = this.related().length;
    return [
      { value: 'NEW',   label: this.translate.instant('CANDIDATES.FORM.PRE_NEW'),   icon: 'person_add' },
      { value: 'REUSE', label: this.translate.instant('CANDIDATES.FORM.SOURCE_REUSE', { count: n }), icon: 'content_copy', disabled: n === 0 },
    ];
  });

  readonly relatedOptions = computed<SelectOption[]>(() => {
    this.translate.currentLang();
    return this.related().map(a => ({
      value: String(a.id),
      label: [a.fullName || '—', a.email,
              this.translate.instant('CANDIDATES.FORM.ARCHIVED_ON_SHORT', { date: this.archivedDate(a.archivedAt) })]
        .filter(Boolean).join(' · '),
    }));
  });

  /** Archived candidates of the earlier demands for this post — only when it has some. */
  private loadRelated(demand: ApprovedDemandOption | null): void {
    this.related.set([]);
    if (!demand?.archivedCandidates) return;
    this.relatedLoading.set(true);
    this.demandSvc.getRelatedArchivedCandidates(demand.id).pipe(catchError(() => of([] as ArchivedCandidate[])))
      .subscribe(list => { this.related.set(list ?? []); this.relatedLoading.set(false); });
  }

  onSourceChange(values: string[]): void {
    const next = values[0] === 'REUSE' ? 'REUSE' : 'NEW';
    this.candidateSource.set(next);
    if (next === 'NEW') this.clearCopy();
  }

  onArchivedSelected(values: string[]): void {
    const a = this.related().find(x => String(x.id) === values[0]);
    if (a) this.copyFromArchived(a);
  }

  /**
   * Position fields the archived candidature filled because the demand left them empty —
   * emptied again when the copy is undone, so the demand's own values are never touched.
   */
  private copiedPositionKeys: string[] = [];

  /** Position fields the picked demand filled — emptied when another demand is picked. */
  private demandFilledKeys: string[] = [];

  /** Experience the demand seeded (its required level), restored when a copy is undone. */
  private demandYears = 0;

  /**
   * Fills EVERY field of the wizard from an archived candidature:
   *  - identity, nationality, experience, salary claim and notes — always the archive's values
   *    (a candidate is the same person whatever the demand);
   *  - the position (title, contract type, start date, department, grade, discipline, RH budget)
   *    only where the demand left the field empty — the demand describes the post. A start date
   *    already past is not taken: the old candidature's date means nothing for this one.
   * Picking another archived candidate first undoes the previous copy, so nothing of the first
   * one stays behind. The CV is copied by the server on save.
   */
  private copyFromArchived(a: ArchivedCandidate): void {
    this.relatedLoading.set(true);
    this.candidateService.getById(a.id).pipe(catchError(() => of(null))).subscribe(c => {
      this.relatedLoading.set(false);
      if (!c) {
        this.error.set(this.translate.instant('CANDIDATES.FORM.PICK_ERR_LOAD'));
        return;
      }
      this.clearCopy();
      this.identityGroup.patchValue({
        firstName:      c.firstName ?? '',
        lastName:       c.lastName ?? '',
        emailPersonal:  c.emailPersonal ?? '',
        phone:          c.phone ?? null,
        dateOfBirth:    c.dateOfBirth ?? null,
        gender:         c.gender ?? null,
        location:       c.location ?? null,
      });
      this.positionGroup.patchValue({
        nationalityId:      c.nationalityId ?? null,
        salaireNetCandidat: c.salaireNetCandidat ?? null,
      });

      const today = new Date().toISOString().slice(0, 10);
      const startDate = c.expectedStartDate && c.expectedStartDate >= today ? c.expectedStartDate : null;
      const fromArchive: Record<string, unknown> = {
        appliedPosition:     c.appliedPosition?.trim() || null,
        employmentTypeId:    c.employmentTypeId,
        expectedStartDate:   startDate,
        departmentId:        c.departmentId,
        appliedGradeId:      c.appliedGradeId,
        appliedDisciplineId: c.appliedDisciplineId,
        salaireNetRh:        c.salaireNetRh,
      };
      this.copiedPositionKeys = [];
      for (const [key, value] of Object.entries(fromArchive)) {
        const ctrl = this.positionGroup.get(key);
        if (!ctrl || value == null || value === '') continue;
        if (ctrl.value == null || ctrl.value === '') {
          ctrl.setValue(value);
          this.copiedPositionKeys.push(key);
        }
      }

      this.form.get('notes')?.setValue(c.notes ?? null);
      if (c.experienceYears != null) this.experienceYears.set(c.experienceYears);
      this.copiedFrom.set({
        id: c.id,
        fullName: [c.firstName, c.lastName].filter(Boolean).join(' '),
        cvName: c.cvPath ? (c.cvOriginalName ?? 'CV') : null,
      });
    });
  }

  /** Back to a blank candidate: what the copy filled in is emptied, the demand's values stay. */
  private clearCopy(): void {
    if (!this.copiedFrom()) return;
    this.identityGroup.reset();
    this.positionGroup.patchValue({ nationalityId: null, salaireNetCandidat: null });
    for (const key of this.copiedPositionKeys) this.positionGroup.get(key)?.setValue(null);
    this.copiedPositionKeys = [];
    this.form.get('notes')?.setValue(null);
    this.experienceYears.set(this.demandYears);
    this.copiedFrom.set(null);
  }

  archivedDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso
      : d.toLocaleDateString(this.translate.currentLang() === 'en' ? 'en-GB' : 'fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  // ── Wizard state ─────────────────────────────────────────────────────────
  currentStep = signal(1);

  private readonly STEP_INFO: { titleKey: string; subKey: string; icon: string }[] = [
    { titleKey: 'CANDIDATES.FORM.STEP0_TITLE', subKey: 'CANDIDATES.FORM.STEP0_SUB', icon: 'work_history' },
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

  /**
   * Step 3: a CV that passed the upload component's own type/size checks — or the CV of the
   * archived candidature the form was copied from, which the server copies on save. A file
   * dropped here anyway replaces it.
   */
  readonly cvSelected = computed(() => this.cvFiles().some(f => !f.error) || !!this.copiedFrom()?.cvName);

  readonly canGoNext = computed(() => {
    this.formValue(); // FormGroup.valid isn't reactive — depend on form value so this recomputes as fields fill
    switch (this.currentStep()) {
      case 1:  return this.demandStepDone();
      case 2:  return this.identityGroup.valid;
      case 3:  return this.positionGroup.valid;
      case 4:  return this.cvSelected();
      default: return true;
    }
  });

  /** Step 1: an open demand is picked and, when reusing, the archived candidate too. */
  private demandStepDone(): boolean {
    const d = this.chosenDemand();
    if (!d || this.isFull(d)) return false;
    return this.candidateSource() === 'NEW' || this.copiedFrom() != null;
  }

  readonly stepValidationError = computed<string | null>(() => {
    this.formValue(); // recompute on every form change (see canGoNext)
    this.translate.currentLang();
    switch (this.currentStep()) {
      case 1:  return this.demandStepDone()     ? null : this.translate.instant(
                 this.chosenDemand() ? 'CANDIDATES.FORM.STEP0_ERR_SOURCE' : 'CANDIDATES.FORM.STEP0_ERR');
      case 2:  return this.identityGroup.valid ? null : this.translate.instant('CANDIDATES.FORM.STEP1_ERR');
      case 3:  return this.positionGroup.valid ? null : this.translate.instant('CANDIDATES.FORM.STEP2_ERR');
      case 4:  return this.cvSelected()        ? null : this.translate.instant('CANDIDATES.FORM.STEP3_ERR');
      default: return null;
    }
  });

  /**
   * Every field is required except the notes (step 5). No CIN / passport: both are typed at
   * onboarding, on the employee profile.
   * Text fields use `blankRequired` so whitespace alone doesn't count as filled in. The
   * CV (step 3) is required too, but it is a file signal, not a control — see
   * `cvSelected`.
   */
  form: FormGroup = this.fb.group({
    identity: this.fb.group({
      firstName:     ['', blankRequired],
      lastName:      ['', blankRequired],
      emailPersonal: ['', [blankRequired, Validators.email]],
      phone:         [null as string | null, blankRequired],
      dateOfBirth:   [null as string | null, Validators.required],
      gender:        [null as string | null, Validators.required],
      location:      [null as string | null, blankRequired],
    }),
    position: this.fb.group({
      appliedPosition:     [null as string | null, blankRequired],
      recruitmentDemandId: [null as number | null, Validators.required],
      departmentId:        [null as number | null, Validators.required],
      employmentTypeId:    [null as number | null, Validators.required],
      appliedGradeId:      [null as number | null, Validators.required],
      appliedDisciplineId: [null as number | null, Validators.required],
      nationalityId:       [null as number | null, Validators.required],
      expectedStartDate:   ['', Validators.required],
      salaireNetCandidat:  [null as number | null, [Validators.required, Validators.min(0)]],
      salaireNetRh:        [null as number | null, [Validators.required, Validators.min(0)]],
    }),
    notes: [null as string | null],
  });

  private readonly formValue = toSignal(this.form.valueChanges, { initialValue: this.form.value });

  readonly profileCompleteness = computed(() => {
    const v   = this.formValue() as any;
    const id  = v?.identity ?? {};
    const pos = v?.position ?? {};
    // The required fields only — the notes are optional and don't count.
    const fields = [
      id.firstName, id.lastName, id.emailPersonal, id.phone,
      id.dateOfBirth, id.gender, id.location,
      pos.recruitmentDemandId, pos.appliedPosition, pos.employmentTypeId, pos.expectedStartDate,
      pos.departmentId, pos.appliedGradeId, pos.appliedDisciplineId,
      pos.nationalityId, pos.salaireNetCandidat, pos.salaireNetRh,
    ];
    const total  = fields.length + 1; // +1 for CV
    const filled = fields.filter((val: unknown) => val != null && String(val).trim() !== '').length
                 + (this.cvSelected() ? 1 : 0);
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
    const t = (k: string) => this.translate.instant(k);
    return [
      { label: t('CANDIDATES.FORM.RF_NAME'),     done: !!(id.firstName && id.lastName) },
      { label: t('CANDIDATES.FORM.RF_EMAIL'),    done: !!id.emailPersonal },
      { label: t('CANDIDATES.FORM.RF_IDENTITY'),
        done: !!(id.phone && id.dateOfBirth && id.gender && id.location) },
      { label: t('CANDIDATES.FORM.RF_VACANCY'),  done: pos.recruitmentDemandId != null },
      { label: t('CANDIDATES.FORM.RF_POSITION'), done: !!pos.appliedPosition },
      { label: t('CANDIDATES.FORM.RF_CONTRACT'), done: !!pos.employmentTypeId },
      { label: t('CANDIDATES.FORM.RF_START'),    done: !!pos.expectedStartDate },
      { label: t('CANDIDATES.FORM.RF_ASSIGNMENT'),
        done: pos.departmentId != null && pos.appliedGradeId != null
           && pos.appliedDisciplineId != null && pos.nationalityId != null },
      { label: t('CANDIDATES.FORM.RF_SALARY'),
        done: pos.salaireNetCandidat != null && pos.salaireNetRh != null },
      { label: t('CANDIDATES.FORM.RF_CV'),       done: this.cvSelected() },
    ];
  });

  get identityGroup(): FormGroup { return this.form.get('identity') as FormGroup; }
  get positionGroup(): FormGroup { return this.form.get('position') as FormGroup; }

  // ── Vacancy (recruitment demand) ─────────────────────────────────────────

  /** Approved demands only — the endpoint filters, an unapproved demand is not a vacancy. */
  readonly demands = signal<ApprovedDemandOption[]>([]);

  /**
   * Approved demands, each saying how many posts are left (V137). A full one stays in the list,
   * disabled and saying so, after the open ones — hiding it made the list look empty for no
   * visible reason (the server refuses a candidature on it anyway).
   */
  readonly demandOptions = computed<SelectOption[]>(() => {
    this.translate.currentLang();
    return [...this.demands()]
      .sort((a, b) => Number(this.isFull(a)) - Number(this.isFull(b)))
      .map(d => {
        const base = d.department ? `${d.label} — ${d.department}` : d.label;
        if (d.headcount == null) return { value: String(d.id), label: base };
        if (this.isFull(d)) {
          return { value: String(d.id), label: `${base} · ${this.translate.instant('CANDIDATES.FORM.PRE_DEMAND_FULL')}`, disabled: true };
        }
        const left = d.headcount - (d.positionsFilled ?? 0);
        return {
          value: String(d.id),
          label: `${base} · ${this.translate.instant('CANDIDATES.FORM.DEMAND_POSTS_LEFT', { left, total: d.headcount })}`,
        };
      });
  });

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
    // Another post: the candidate choice starts over (a copy belonged to the previous post).
    this.candidateSource.set('NEW');
    this.clearCopy();
    // …and what the previous demand filled goes too, so the new one fills every field again
    // instead of leaving the old post's title / dates / dimensions in place.
    for (const key of this.demandFilledKeys) this.positionGroup.get(key)?.setValue(null);
    this.demandFilledKeys = [];
    if (this.experienceYears() === this.demandYears) this.experienceYears.set(0);
    this.demandYears = 0;
    this.loadRelated(this.demands().find(d => d.id === id) ?? null);
    if (id == null) return;

    this.demandSvc.getById(id).pipe(catchError(() => of(null))).subscribe(d => {
      // A slow answer for a demand no longer picked must not fill the form.
      if (!d || this.positionGroup.get('recruitmentDemandId')?.value !== id) return;
      const pos = this.positionGroup;
      const fillIfEmpty = (key: string, value: unknown) => {
        const ctrl = pos.get(key);
        if (!ctrl) return;
        const cur = ctrl.value;
        if (value != null && value !== '' && (cur == null || cur === '')) {
          ctrl.setValue(value);
          this.demandFilledKeys.push(key);
        }
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
        if (match) fillIfEmpty('departmentId', match.id);
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
      if (years !== undefined) {
        this.demandYears = years;
        if (this.experienceYears() === 0) this.experienceYears.set(years);
      }

      pos.markAsTouched();
    });
  }

  /** The entity the lists were loaded for — they load once, when the user is known. */
  private loadedForPays: number | null = null;

  constructor() {
    // Opened straight on /rh/candidates/new, the page can start before the signed-in user is
    // loaded: reading paysId once in ngOnInit then found nothing and the demand list stayed
    // empty — shown as « no approved demand ». Wait for the user instead.
    effect(() => {
      const user = this.userStore.currentUser();
      if (!user) return;                       // still loading — keep the spinner
      const paysId = user.paysId ?? null;
      untracked(() => {
        if (paysId == null) { this.demandsLoading.set(false); return; }
        if (paysId === this.loadedForPays) return;
        this.loadedForPays = paysId;
        this.loadForPays(paysId);
      });
    });
  }

  ngOnInit(): void {
    // Lists that do not depend on the entity.
    this.refSvc.getNationalities().subscribe(r => this.nationalities.set(r));
    this.listSvc.getListValues('GENDER')
      .pipe(catchError(() => of([] as ListValue[])))
      .subscribe(v => this.genders.set(v));
  }

  private loadForPays(paysId: number): void {
    this.demandsLoading.set(true);
    this.demandsError.set(null);
    // A failed call is NOT shown as « no approved demand »: that message would send RH looking
    // for a missing approval when the real problem is the server (e.g. V137 not applied).
    this.demandSvc.getApprovedOptions(paysId).subscribe({
      next: d => { this.demands.set(d ?? []); this.demandsLoading.set(false); },
      error: err => {
        this.demandsLoading.set(false);
        this.demandsError.set(err?.error?.detail ?? err?.error?.message
          ?? this.translate.instant('CANDIDATES.FORM.PRE_DEMAND_ERR'));
      },
    });
    // Scoped to the user's OWN entity, and that is not a detail: onSubmit stamps the new
    // candidate with exactly this paysId, so offering grades or departments from anywhere
    // else would let the form write a candidate pointing at another entity's structure.
    // These three calls used to pass nothing at all, and the endpoints answered with every
    // entity's rows — which is what made the lists look duplicated.
    // Nationalities are global (no paysId) and load in ngOnInit.
    this.refSvc.getGrades(paysId).subscribe(r => this.grades.set(r));
    this.refSvc.getDisciplines(paysId).subscribe(r => this.disciplines.set(r));
    this.refSvc.getDepartments(paysId).subscribe(r => this.departments.set(r));
    this.listSvc.getListValues('CONTRACT_TYPE', paysId).subscribe(v => this.employmentTypes.set(v));
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

  /**
   * Salary input → number. Empty stays null (so `required` still fires); 0 stays 0 —
   * the old `$event ? +$event : null` turned a typed 0 into "not filled in".
   */
  toAmount(value: string | number | null): number | null {
    if (value == null || String(value).trim() === '') return null;
    const n = Number(value);
    return isNaN(n) ? null : n;
  }

  protected readonly formatFirstName = formatFirstName;
  protected readonly formatLastName  = formatLastName;

  /**
   * Prénom / Nom put in form when the field loses focus (daf-form-field has no blur output,
   * so the template listens to the native focusout bubbling from its input). The backend
   * applies the same rule on create.
   */
  formatNameField(path: string, format: (raw: string) => string): void {
    const ctrl = this.form.get(path);
    if (!ctrl) return;
    const next = format(String(ctrl.value ?? ''));
    if (next !== ctrl.value) ctrl.setValue(next);
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

  /**
   * The guide shows a wizard step (its `tab`). Display only: it skips the step validation,
   * since nothing is saved, and the guide's last step brings the form back to step 1.
   */
  onGuideStep(step: string): void {
    const n = Number(step);
    if (n >= 1 && n <= this.STEP_INFO.length) {
      this.error.set(null);
      this.currentStep.set(n);
    }
  }

  goNext(): void {
    this.error.set(null);
    if (!this.canGoNext()) {
      if (this.currentStep() === 1) this.positionGroup.get('recruitmentDemandId')?.markAsTouched();
      if (this.currentStep() === 2) this.identityGroup.markAllAsTouched();
      if (this.currentStep() === 3) this.positionGroup.markAllAsTouched();
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
      copiedFromCandidateId: this.copiedFrom()?.id ?? null,
    };

    this.candidateService.create(dto).subscribe({
      next:  created => this.afterSave(created.id),
      error: err     => {
        this.saving.set(false);
        this.error.set(err?.error?.detail ?? err?.error?.message ?? this.translate.instant('CANDIDATES.FORM.ERR_CREATE'));
      },
    });
  }

  /**
   * The salary figures typed in step 2 are stored with the candidate and only read back on
   * the Profil tab. Nothing is sent to finance at creation any more: the first step of the
   * process is preparing the interviews, and finance sees the candidature with its offer.
   */
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
