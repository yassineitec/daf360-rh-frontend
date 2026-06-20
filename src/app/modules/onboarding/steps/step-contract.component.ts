import { Component, input, output, signal, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OnboardingProfileDto, OnboardingFormData, CONTRACT_OPTIONS } from '../onboarding.model';
import { RefDataService } from '../../../core/ref/ref-data.service';
import { RefDataItem } from '../../../core/ref/ref-data.model';

@Component({
  selector: 'app-step-contract',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './step-contract.component.html',
  styleUrl: './step-contract.component.scss',
})
export class StepContractComponent implements OnInit {
  data     = input<OnboardingProfileDto>({});
  formInfo = input<OnboardingFormData | null>(null);
  changed  = output<Partial<OnboardingProfileDto>>();

  private refSvc = inject(RefDataService);

  readonly contractOptions = CONTRACT_OPTIONS;

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

  ngOnInit(): void {
    const d      = this.data();
    const fi     = this.formInfo();
    const paysId = fi?.paysId ?? 179;

    this.hireDate.set(d.hireDate ?? '');
    this.contractType.set(d.contractType ?? fi?.contractType ?? '');
    this.contractEndDate.set(d.contractEndDate ?? '');
    this.gradeId.set(d.gradeId ?? null);
    this.disciplineId.set(d.disciplineId ?? null);
    this.nogLevelId.set(d.nogLevelId ?? null);
    this.departmentId.set(d.departmentId ?? null);
    this.isOnProbation.set(d.isOnProbation ?? false);
    this.probationEndDate.set(d.probationEndDate ?? '');

    this.refSvc.getGrades(paysId).subscribe(r => this.grades.set(r));
    this.refSvc.getDisciplines(paysId).subscribe(r => this.disciplines.set(r));
    this.refSvc.getNogLevels(paysId).subscribe(r => this.nogLevels.set(r));
    this.refSvc.getDepartments(paysId).subscribe(r => this.departments.set(r));

    this.emit();
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
      isOnProbation:    this.isOnProbation(),
      probationEndDate: this.probationEndDate()  || null,
    });
  }
}
