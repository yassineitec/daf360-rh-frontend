import { adminLabel } from '../../../shared/utils/admin-label.utils';
import { Component, output, signal, OnInit, inject, computed } from '@angular/core';
import { OnboardingProfileDto, OnboardingFormData, contractNeedsEndDate } from '../onboarding.model';
import { ConfigurableListService } from '../../../core/lists/configurable-list.service';
import { contractLabel } from '../../profiles/profile-labels';
import { ListValue } from '../../../core/lists/configurable-list.model';
import { RefDataService } from '../../../core/ref/ref-data.service';
import { RefDataItem } from '../../../core/ref/ref-data.model';
import { UserStore } from '../../../core/user.store';
import { input } from '@angular/core';
import {
  SelectComponent,
  MultiDatePickerComponent,
  SelectOption,
} from '@khalilrebhiitec/daf360';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { isoToDate, dateToIso } from '../../../shared/date-picker.utils';

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
  private userStore = inject(UserStore);
  private translate = inject(TranslateService);
  private listSvc   = inject(ConfigurableListService);

  /** Admin › Listes configurables › Type de contrat (CONTRACT_TYPE) — the same list as the profile. */
  private readonly contractTypes = signal<ListValue[]>([]);

  readonly contractOptions = computed<SelectOption[]>(() => {
    const options = this.contractTypes().map(v => ({ value: v.valueCode, label: adminLabel(v, this.translate) }));
    // A code the list does not hold (deactivated value, or a pre-migration PERMANENT/…)
    // stays selectable, otherwise the select would show empty and lose it on save.
    const current = this.contractType();
    if (current && !options.some(o => o.value === current)) {
      options.push({ value: current, label: contractLabel(current, this.translate) });
    }
    return options;
  });

  /** Fixed-term types ask for an end date (CDD, CIVP, stage, détachement). */
  readonly needsEndDate = computed(() => contractNeedsEndDate(this.contractType()));

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

  readonly gradeOptions      = computed<SelectOption[]>(() => this.grades().map(g => ({ value: String(g.id), label: adminLabel(g, this.translate) })));
  readonly disciplineOptions = computed<SelectOption[]>(() => this.disciplines().map(d => ({ value: String(d.id), label: adminLabel(d, this.translate) })));
  readonly nogOptions        = computed<SelectOption[]>(() => this.nogLevels().map(n => ({ value: String(n.id), label: adminLabel(n, this.translate) })));
  readonly departmentOptions = computed<SelectOption[]>(() => this.departments().map(d => ({ value: String(d.id), label: adminLabel(d, this.translate) })));

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

    // Scoped to the RH officer's own entity. These four used to pass nothing, and the
    // endpoints answered with every entity's rows — the same defect the create-candidate
    // wizard had, and the reason the lists read as duplicated.
    // Re-emit after each list loads so prefilled ids resolve to their labels
    // (the summary/recap displays labels, not ids).
    const paysId = this.userStore.currentUser()?.paysId;
    this.refSvc.getGrades(paysId).subscribe(r => { this.grades.set(r); this.emit(); });
    this.refSvc.getDisciplines(paysId).subscribe(r => { this.disciplines.set(r); this.emit(); });
    this.refSvc.getNogLevels(paysId).subscribe(r => { this.nogLevels.set(r); this.emit(); });
    this.refSvc.getDepartments(paysId).subscribe(r => { this.departments.set(r); this.emit(); });
    this.listSvc.getListValues('CONTRACT_TYPE', paysId).subscribe(v => this.contractTypes.set(v));

    this.emit();
  }

  private labelOf(list: RefDataItem[], id: number | null): string | undefined {
    const item = id == null ? undefined : list.find(x => x.id === id);
    return item ? adminLabel(item, this.translate) : undefined;
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
