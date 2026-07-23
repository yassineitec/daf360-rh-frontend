import { Component, output, signal, OnInit, inject, computed } from '@angular/core';
import { OnboardingProfileDto, OnboardingFormData, CONTRACT_OPTIONS } from '../onboarding.model';
import { RefDataService } from '../../../core/ref/ref-data.service';
import { RefDataItem } from '../../../core/ref/ref-data.model';
import { input } from '@angular/core';
import {
  SelectComponent,
  MultiDatePickerComponent,
  SelectOption,
} from '@khalilrebhiitec/daf360';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { isoToDate, dateToIso } from '../../../shared/date-picker.utils';

const CONTRACT_LABEL_KEY: Record<string, string> = {
  PERMANENT:  'ONBOARDING.STEP_CONTRACT.CONTRACT_PERMANENT',
  FIXED_TERM: 'ONBOARDING.STEP_CONTRACT.CONTRACT_FIXED_TERM',
  INTERN:     'ONBOARDING.STEP_CONTRACT.CONTRACT_INTERN',
  CONSULTANT: 'ONBOARDING.STEP_CONTRACT.CONTRACT_CONSULTANT',
};

@Component({
  selector: 'app-step-contract',
  standalone: true,
  imports: [ SelectComponent, MultiDatePickerComponent, TranslatePipe],
  templateUrl: './step-contract.component.html',
  styleUrl: './step-contract.component.scss',
})
export class StepContractComponent implements OnInit {
  data     = input<OnboardingProfileDto>({});
  formInfo = input<OnboardingFormData | null>(null);
  changed  = output<Partial<OnboardingProfileDto>>();

  private refSvc = inject(RefDataService);
  private translate = inject(TranslateService);

  readonly contractOptions = computed<SelectOption[]>(() => {
    this.translate.currentLang();
    return CONTRACT_OPTIONS
      .filter(o => o.value !== '')
      .map(o => ({ value: o.value, label: this.translate.instant(CONTRACT_LABEL_KEY[o.value] ?? o.label) }));
  });

  hireDate         = signal('');
  contractType     = signal('');
  contractEndDate  = signal('');
  gradeId          = signal<number | null>(null);
  disciplineId     = signal<number | null>(null);
  nogLevelId       = signal<number | null>(null);
  departmentId     = signal<number | null>(null);
  isOnProbation    = signal(false);
  probationEndDate = signal('');

  grades      = signal<RefDataItem[]>([]);
  disciplines = signal<RefDataItem[]>([]);
  nogLevels   = signal<RefDataItem[]>([]);
  departments = signal<RefDataItem[]>([]);

  readonly gradeOptions      = computed<SelectOption[]>(() => this.grades().map(g => ({ value: String(g.id), label: g.labelFr })));
  readonly disciplineOptions = computed<SelectOption[]>(() => this.disciplines().map(d => ({ value: String(d.id), label: d.labelFr })));
  readonly nogOptions        = computed<SelectOption[]>(() => this.nogLevels().map(n => ({ value: String(n.id), label: n.labelFr })));
  readonly departmentOptions = computed<SelectOption[]>(() => this.departments().map(d => ({ value: String(d.id), label: d.labelFr })));

  protected readonly isoToDate = isoToDate;
  protected readonly dateToIso = dateToIso;

  ngOnInit(): void {
    const d  = this.data();
    const fi = this.formInfo();

    this.hireDate.set(d.hireDate ?? '');
    this.contractType.set(d.contractType ?? fi?.contractType ?? '');
    this.contractEndDate.set(d.contractEndDate ?? '');
    this.gradeId.set(d.gradeId ?? null);
    this.disciplineId.set(d.disciplineId ?? null);
    this.nogLevelId.set(d.nogLevelId ?? null);
    this.departmentId.set(d.departmentId ?? null);
    this.isOnProbation.set(d.isOnProbation ?? false);
    this.probationEndDate.set(d.probationEndDate ?? '');

    // No paysId → backend returns ALL active ref data (matches the candidate form).
    // Re-emit after each list loads so prefilled ids resolve to their labels
    // (the summary/recap displays labels, not ids).
    this.refSvc.getGrades().subscribe(r => { this.grades.set(r); this.emit(); });
    this.refSvc.getDisciplines().subscribe(r => { this.disciplines.set(r); this.emit(); });
    this.refSvc.getNogLevels().subscribe(r => { this.nogLevels.set(r); this.emit(); });
    this.refSvc.getDepartments().subscribe(r => { this.departments.set(r); this.emit(); });

    this.emit();
  }

  private labelOf(list: RefDataItem[], id: number | null): string | undefined {
    return id == null ? undefined : list.find(x => x.id === id)?.labelFr;
  }

  emit(): void {
    this.changed.emit({
      hireDate:         this.hireDate()         || undefined,
      contractType:     this.contractType()      || undefined,
      contractEndDate:  this.contractEndDate()   || null,
      gradeId:          this.gradeId(),
      disciplineId:     this.disciplineId(),
      nogLevelId:       this.nogLevelId(),
      departmentId:     this.departmentId(),
      // Resolved labels — what the recap displays (kept in sync with the ids).
      grade:            this.labelOf(this.grades(),      this.gradeId()),
      discipline:       this.labelOf(this.disciplines(), this.disciplineId()),
      nogLevel:         this.labelOf(this.nogLevels(),   this.nogLevelId()),
      department:       this.labelOf(this.departments(), this.departmentId()),
      isOnProbation:    this.isOnProbation(),
      probationEndDate: this.probationEndDate()  || null,
    });
  }
}
