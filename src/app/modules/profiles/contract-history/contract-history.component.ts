import {
  Component, OnChanges, SimpleChanges, computed, inject, input, signal,
} from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import {
  ButtonComponent,
  CardComponent,
  MultiDatePickerComponent,
  FormFieldComponent,
  PaginationComponent,
  SelectComponent,
  StatusBadgeComponent,
  type SelectOption,
} from '@khalilrebhiitec/daf360';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ContractHistoryService } from './contract-history.service';
import {
  ContractHistoryDto, TypeContratDto, CreateContractRequest,
} from './contract-history.model';
import { isoToDate, dateToIso } from '../../../shared/date-picker.utils';

const PAGE_SIZE = 5;

@Component({
  selector: 'app-contract-history',
  standalone: true,
  imports: [
    DatePipe,
    DecimalPipe,
    ButtonComponent,
    CardComponent,
    MultiDatePickerComponent,
    FormFieldComponent,
    PaginationComponent,
    SelectComponent,
    StatusBadgeComponent,
    TranslatePipe,
  ],
  template: `
<div style="margin-top:4px;">

  <!-- Header -->
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
    <div>
      <p style="font-size:12px;font-weight:700;color:var(--color-on-surface-variant);text-transform:uppercase;letter-spacing:.4px;margin:0;">
        {{ 'PROFILES.HISTORY.TITLE' | translate }}
      </p>
      @if (activeContract()) {
        <p style="font-size:12px;color:var(--color-teal);margin:3px 0 0;">
          {{ 'PROFILES.HISTORY.ACTIVE_CONTRACT' | translate }} <strong>{{ activeContract()!.typeContratLabelFr }}</strong>
          · {{ 'PROFILES.HISTORY.SINCE_LABEL' | translate }} {{ activeContract()!.dateEffet | date:'dd/MM/yyyy' }}
          @if (activeContract()!.salaireNet) { · {{ activeContract()!.salaireNet | number:'1.0-0' }} {{ 'PROFILES.HISTORY.TND_NET_SUFFIX' | translate }} }
        </p>
      }
    </div>
    @if (canEdit()) {
      <daf-button [label]="showForm() ? ('PROFILES.COMMON.CANCEL' | translate) : ('PROFILES.HISTORY.NEW' | translate)" variant="primary"
        [options]="{ size: 'sm', iconStart: showForm() ? 'close' : 'add' }"
        (onClick)="showForm.set(!showForm())" />
    }
  </div>

  <!-- Add form -->
  @if (showForm()) {
    <daf-card [options]="{ variant: 'flat', padding: 'md' }" style="display:block;margin-bottom:18px;">
      <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--color-on-surface-variant);margin:0 0 12px;">
        {{ 'PROFILES.HISTORY.NEW' | translate }}
      </p>
      @if (formError()) {
        <div style="background:var(--color-error-container);border-radius:8px;padding:9px 12px;font-size:12px;color:var(--color-on-error-container);margin-bottom:10px;">
          {{ formError() }}
        </div>
      }
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <daf-select [options]="typeContratOptions()" [config]="{ label: ('PROFILES.HISTORY.TYPE' | translate) }"
          [selected]="formType ? [formType] : []" (selectedChange)="formType = $event[0]" />

        <daf-select [options]="docTypeOptions()" [config]="{ label: ('PROFILES.HISTORY.DOCUMENT' | translate) }"
          [selected]="[formTypeDoc]" (selectedChange)="formTypeDoc = $event[0]" />

        <daf-multi-date-picker [config]="{ label: ('PROFILES.HISTORY.DATE_EFFECT' | translate), selectionMode: 'single' }"
          [value]="toDate(formDateEffet)" (valueChange)="formDateEffet = fromDate($event)" />

        <daf-multi-date-picker [config]="{ label: ('PROFILES.HISTORY.DATE_END' | translate), selectionMode: 'single' }"
          [value]="toDate(formDateFin)" (valueChange)="formDateFin = fromDate($event)" />

        <daf-form-field [options]="{ label: ('PROFILES.HISTORY.SALARY' | translate), type: 'number', placeholder: ('PROFILES.HISTORY.SALARY_PH' | translate) }"
          [value]="formSalaire" (valueChange)="formSalaire = asNumber($event)" />

        <daf-form-field [options]="{ label: ('PROFILES.HISTORY.MOTIF' | translate), placeholder: ('PROFILES.HISTORY.MOTIF_PH' | translate) }"
          [value]="formMotif" (valueChange)="formMotif = asText($event)" />

        <daf-form-field style="grid-column:span 2;" [options]="{ label: ('PROFILES.COMMON.COMMENT' | translate), type: 'textarea', rows: 2 }"
          [value]="formCommentaire" (valueChange)="formCommentaire = asText($event)" />
      </div>
      <div style="display:flex;justify-content:flex-end;margin-top:12px;">
        <daf-button [label]="isSaving() ? ('PROFILES.COMMON.SAVING' | translate) : ('PROFILES.HISTORY.SAVE' | translate)" variant="primary"
          [options]="{ disabled: isSaving(), loading: isSaving() }" (onClick)="saveContract()" />
      </div>
    </daf-card>
  }

  <!-- Timeline -->
  @if (isLoading()) {
    <div style="display:flex;flex-direction:column;gap:8px;">
      @for (i of [1,2,3]; track i) {
        <div style="height:56px;border-radius:10px;background:linear-gradient(90deg,var(--color-surface-container-low) 25%,var(--color-surface-container) 50%,var(--color-surface-container-low) 75%);background-size:200% 100%;animation:shimmer 1.5s infinite;"></div>
      }
    </div>
  }

  @if (!isLoading() && history().length === 0) {
    <div style="text-align:center;padding:32px;color:var(--color-on-surface-variant);">
      <span class="material-symbols-outlined" style="font-size:36px;display:block;margin-bottom:8px;opacity:.35;">description</span>
      <p style="font-size:13px;margin:0;">{{ 'PROFILES.HISTORY.NONE' | translate }}</p>
    </div>
  }

  @if (!isLoading() && history().length > 0) {
    <div style="display:flex;flex-direction:column;gap:0;position:relative;">
      @for (c of pagedHistory(); track c.id; let last = $last) {
        <div style="display:flex;gap:12px;padding-bottom:0;">
          <!-- Timeline dot + line -->
          <div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0;width:20px;">
            <div style="width:12px;height:12px;border-radius:50%;flex-shrink:0;margin-top:6px;"
              [style.background]="c.isActive ? 'var(--color-teal)' : 'var(--color-outline-variant)'"></div>
            @if (!last) { <div style="width:2px;flex:1;background:var(--color-outline-variant);margin-top:2px;"></div> }
          </div>
          <!-- Card -->
          <daf-card [options]="{ variant: 'outlined', padding: 'sm' }" style="display:block;flex:1;margin-bottom:10px;"
            [style.border-left-color]="c.isActive ? 'var(--color-teal)' : 'transparent'"
            [style.border-left-width]="c.isActive ? '3px' : '1px'">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
              <div style="flex:1;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;">
                  <span style="font-size:13px;font-weight:700;color:var(--color-on-surface);">{{ c.typeContratLabelFr }}</span>
                  <daf-badge [label]="(c.typeDocument === 'CONTRAT_INITIAL' ? 'PROFILES.HISTORY.DOC_INITIAL' : 'PROFILES.HISTORY.DOC_AMENDMENT') | translate"
                    [options]="{ variant: c.typeDocument === 'CONTRAT_INITIAL' ? 'info' : 'warning', pill: true, size: 'sm' }" />
                  @if (c.isActive) {
                    <daf-badge [label]="'PROFILES.HISTORY.ACTIVE' | translate" [options]="{ variant: 'teal', pill: true, size: 'sm' }" />
                  }
                </div>
                <div style="font-size:12px;color:var(--color-on-surface-variant);display:flex;flex-wrap:wrap;gap:12px;">
                  <span>📅 {{ 'PROFILES.HISTORY.FROM_LABEL' | translate }} {{ c.dateEffet | date:'dd/MM/yyyy' }}
                    @if (c.dateFin) { → {{ c.dateFin | date:'dd/MM/yyyy' }} }
                    @else { → {{ 'PROFILES.HISTORY.ONGOING' | translate }} }
                  </span>
                  @if (c.salaireNet) {
                    <span>💰 {{ c.salaireNet | number:'1.0-0' }} {{ 'PROFILES.HISTORY.TND_NET_MONTH_SUFFIX' | translate }}</span>
                  }
                </div>
                @if (c.motif) {
                  <p style="font-size:11px;color:var(--color-on-surface-variant);margin:4px 0 0;font-style:italic;">{{ c.motif }}</p>
                }
                @if (c.commentaire) {
                  <p style="font-size:11px;color:var(--color-on-surface-variant);margin:2px 0 0;">{{ c.commentaire }}</p>
                }
              </div>
              <span style="font-size:10px;color:var(--color-outline);white-space:nowrap;flex-shrink:0;">
                {{ c.dateCreation | date:'dd/MM/yyyy' }}
              </span>
            </div>
          </daf-card>
        </div>
      }
    </div>

    <!-- Count + Pagination -->
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:8px;">
      <span style="font-size:12px;color:var(--color-on-surface-variant);">{{ 'PROFILES.HISTORY.COUNT' | translate:{ count: history().length } }}</span>
      @if (totalPages() > 1) {
        <daf-pagination
          [currentPage]="currentPage()"
          [totalPages]="totalPages()"
          [totalElements]="history().length"
          (pageChange)="onPageChange($event)" />
      }
    </div>
  }
</div>
  `,
  styles: [`@keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }`],
})
export class ContractHistoryComponent implements OnChanges {
  private svc = inject(ContractHistoryService);
  private translate = inject(TranslateService);

  readonly profileId = input.required<number>();
  readonly canEdit   = input<boolean>(false);

  history         = signal<ContractHistoryDto[]>([]);
  activeContract  = signal<ContractHistoryDto | null>(null);
  typeContrats    = signal<TypeContratDto[]>([]);
  isLoading       = signal(true);
  showForm        = signal(false);
  isSaving        = signal(false);
  formError       = signal<string | null>(null);

  typeContratOptions = computed<SelectOption[]>(() =>
    this.typeContrats().map((tc) => ({ value: String(tc.id), label: tc.labelFr })),
  );
  readonly docTypeOptions = computed<SelectOption[]>(() => {
    this.translate.currentLang();
    return [
      { value: 'CONTRAT_INITIAL', label: this.translate.instant('PROFILES.HISTORY.DOC_INITIAL') },
      { value: 'AVENANT', label: this.translate.instant('PROFILES.HISTORY.DOC_AMENDMENT') },
    ];
  });

  // Form fields
  formType      = '';
  formTypeDoc   = 'CONTRAT_INITIAL';
  formDateEffet = '';
  formDateFin   = '';
  formSalaire: number | null = null;
  formMotif     = '';
  formCommentaire = '';

  currentPage = signal(0);
  readonly totalPages = computed(() => Math.ceil(this.history().length / PAGE_SIZE));

  readonly pagedHistory = computed(() => {
    const start = this.currentPage() * PAGE_SIZE;
    return this.history().slice(start, start + PAGE_SIZE);
  });

  onPageChange(page: number): void {
    this.currentPage.set(page);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['profileId']) this.load();
  }

  asText(v: string | number | null): string {
    return v == null ? '' : String(v);
  }
  asNumber(v: string | number | null): number | null {
    return v == null || v === '' ? null : Number(v);
  }

  protected readonly toDate = isoToDate;
  protected readonly fromDate = dateToIso;

  private load(): void {
    this.isLoading.set(true);
    this.currentPage.set(0);
    this.svc.getTypeContrats().subscribe(tc => this.typeContrats.set(tc));
    this.svc.getHistory(this.profileId()).subscribe({
      next: h => {
        this.history.set(h);
        this.activeContract.set(h.find(c => c.isActive) ?? null);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  saveContract(): void {
    if (!this.formType || !this.formDateEffet) {
      this.formError.set(this.translate.instant('PROFILES.HISTORY.ERR_REQUIRED'));
      return;
    }
    this.isSaving.set(true);
    this.formError.set(null);
    const req: CreateContractRequest = {
      idTypeContrat: +this.formType,
      typeDocument: this.formTypeDoc as 'CONTRAT_INITIAL' | 'AVENANT',
      dateEffet: this.formDateEffet,
      dateFin: this.formDateFin || undefined,
      salaireNet: this.formSalaire ?? undefined,
      motif: this.formMotif || undefined,
      commentaire: this.formCommentaire || undefined,
    };
    this.svc.addContract(this.profileId(), req).subscribe({
      next: () => {
        this.showForm.set(false);
        this.resetForm();
        this.load();
        this.isSaving.set(false);
      },
      error: err => {
        this.isSaving.set(false);
        this.formError.set(err?.error?.message ?? this.translate.instant('PROFILES.HISTORY.ERR_SAVE'));
      },
    });
  }

  private resetForm(): void {
    this.formType = ''; this.formTypeDoc = 'CONTRAT_INITIAL';
    this.formDateEffet = ''; this.formDateFin = ''; this.formSalaire = null;
    this.formMotif = ''; this.formCommentaire = '';
  }
}
