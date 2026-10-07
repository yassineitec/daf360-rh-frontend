import { Component, computed, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CardComponent } from '@khalilrebhiitec/daf360';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { genderLabel } from '../../../shared/utils/gender.utils';
import { adminLabel, BilingualLabel } from '../../../shared/utils/admin-label.utils';
import { RefDataService } from '../../../core/ref/ref-data.service';
import { ConfigurableListService } from '../../../core/lists/configurable-list.service';
import { UserStore } from '../../../core/user.store';
import { contractLabel } from '../../profiles/profile-labels';

@Component({
  selector: 'app-step-summary',
  standalone: true,
  imports: [CardComponent, TranslatePipe],
  templateUrl: './step-summary.component.html',
  styleUrl: './step-summary.component.scss',
})
export class StepSummaryComponent {
  data = input<any>({});
  formInfo = input<any>(null);
  editStep = output<number>();

  private translate = inject(TranslateService);
  private refSvc    = inject(RefDataService);
  private listSvc   = inject(ConfigurableListService);
  private userStore = inject(UserStore);

  // The rh/admin lists the earlier steps picked from — the same (cached) calls, scoped to
  // the same entity. The recap resolves its labels from them at display time, so they
  // follow the UI language; the French text a step stored in the draft is only a fallback.
  private readonly paysId        = this.userStore.currentUser()?.paysId;
  private readonly grades        = toSignal(this.refSvc.getGrades(this.paysId),       { initialValue: [] });
  private readonly disciplines   = toSignal(this.refSvc.getDisciplines(this.paysId),  { initialValue: [] });
  private readonly nogLevels     = toSignal(this.refSvc.getNogLevels(this.paysId),    { initialValue: [] });
  private readonly departments   = toSignal(this.refSvc.getDepartments(this.paysId),  { initialValue: [] });
  private readonly banks         = toSignal(this.refSvc.getBanks(this.paysId),        { initialValue: [] });
  private readonly nationalities = toSignal(this.refSvc.getNationalities(),           { initialValue: [] });
  private readonly maritalList   = toSignal(this.listSvc.getListValues('MARITAL_STATUS'), { initialValue: [] });
  private readonly contractTypes = toSignal(this.listSvc.getListValues('CONTRACT_TYPE', this.paysId), { initialValue: [] });

  private byId(items: (BilingualLabel & { id: number })[], id: number | null | undefined, fallback: unknown): string {
    const item = id != null ? items.find(x => x.id === id) : undefined;
    return item ? adminLabel(item, this.translate) : this.val(fallback);
  }

  /** Recap labels in the UI language, from the rh/admin lists. */
  readonly labels = computed(() => {
    this.translate.currentLang();
    const d = this.data() ?? {};
    const marital = d.maritalStatus ? this.maritalList().find(v => v.valueCode === d.maritalStatus) : undefined;
    return {
      grade:         this.byId(this.grades(),        d.gradeId,       d.grade),
      discipline:    this.byId(this.disciplines(),   d.disciplineId,  d.discipline),
      nogLevel:      this.byId(this.nogLevels(),     d.nogLevelId,    d.nogLevel),
      department:    this.byId(this.departments(),   d.departmentId,  d.department),
      bank:          this.byId(this.banks(),         d.bankId,        d.bankName),
      nationality:   this.byId(this.nationalities(), d.nationalityId, d.nationality),
      maritalStatus: marital ? adminLabel(marital, this.translate) : this.val(d.maritalStatus),
    };
  });

  genderLabel(code: string | null | undefined): string {
    return genderLabel(code, this.translate);
  }


  val(v: any): string {
    if (v === null || v === undefined || v === '') return '—';
    if (typeof v === 'boolean') return this.translate.instant(v ? 'ONBOARDING.STEP_SUMMARY.YES' : 'ONBOARDING.STEP_SUMMARY.NO');
    return String(v);
  }

  /** Contract type — the CONTRACT_TYPE admin label; a code the list does not hold keeps the i18n set. */
  contractTypeLabel(): string {
    const code = this.data()?.contractType;
    if (!code) return '—';
    const v = this.contractTypes().find(t => t.valueCode === code);
    return v ? adminLabel(v, this.translate) : contractLabel(code, this.translate);
  }

  maskIban(iban: any): string {
    if (!iban) return '—';
    const s = String(iban);
    if (s.length <= 4) return s;
    return s.slice(0, 4) + '****';
  }

  /** Resolve the selected régime's label from the form's available regimes. */
  regimeLabel(): string {
    const id = this.data()?.regimeTemplateId;
    if (id == null) return '—';
    const match = (this.formInfo()?.availableRegimes ?? []).find((r: any) => r.id === id);
    return match ? adminLabel(match, this.translate) : this.val(id);
  }
}
