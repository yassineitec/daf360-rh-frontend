import {
  Component, OnChanges, SimpleChanges, computed, inject, input, signal,
} from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import {
  ButtonComponent,
  CardComponent,
  MultiDatePickerComponent,
  FormFieldComponent,
  SelectComponent,
  StatusBadgeComponent,
  type SelectOption,
} from '@khalilrebhiitec/daf360';
import { ContractHistoryService } from './contract-history.service';
import {
  ContractHistoryDto, TypeContratDto, CreateContractRequest,
} from './contract-history.model';
import { isoToDate, dateToIso } from '../../../shared/date-picker.utils';

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
    SelectComponent,
    StatusBadgeComponent,
  ],
  template: `
<div style="margin-top:4px;">

  <!-- Header -->
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
    <div>
      <p style="font-size:12px;font-weight:700;color:#44474c;text-transform:uppercase;letter-spacing:.4px;margin:0;">
        Historique des contrats
      </p>
      @if (activeContract()) {
        <p style="font-size:12px;color:#0f4a57;margin:3px 0 0;">
          Contrat actif : <strong>{{ activeContract()!.typeContratLabelFr }}</strong>
          · depuis {{ activeContract()!.dateEffet | date:'dd/MM/yyyy' }}
          @if (activeContract()!.salaireNet) { · {{ activeContract()!.salaireNet | number:'1.0-0' }} TND net }
        </p>
      }
    </div>
    @if (canEdit()) {
      <daf-button [label]="showForm() ? 'Annuler' : 'Nouveau contrat / avenant'" variant="primary"
        [options]="{ size: 'sm', iconStart: showForm() ? 'close' : 'add' }"
        (onClick)="showForm.set(!showForm())" />
    }
  </div>

  <!-- Add form -->
  @if (showForm()) {
    <daf-card [options]="{ variant: 'flat', padding: 'md' }" style="display:block;margin-bottom:18px;">
      <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:#44474c;margin:0 0 12px;">
        Nouveau contrat / avenant
      </p>
      @if (formError()) {
        <div style="background:#fee2e2;border-radius:8px;padding:9px 12px;font-size:12px;color:#991b1b;margin-bottom:10px;">
          {{ formError() }}
        </div>
      }
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <daf-select [options]="typeContratOptions()" [config]="{ label: 'Type *' }"
          [selected]="formType ? [formType] : []" (selectedChange)="formType = $event[0]" />

        <daf-select [options]="docTypeOptions" [config]="{ label: 'Document *' }"
          [selected]="[formTypeDoc]" (selectedChange)="formTypeDoc = $event[0]" />

        <daf-multi-date-picker [config]="{ label: 'Date d\\'effet *', selectionMode: 'single' }"
          [value]="toDate(formDateEffet)" (valueChange)="formDateEffet = fromDate($event)" />

        <daf-multi-date-picker [config]="{ label: 'Date de fin', selectionMode: 'single' }"
          [value]="toDate(formDateFin)" (valueChange)="formDateFin = fromDate($event)" />

        <daf-form-field [options]="{ label: 'Salaire net (TND)', type: 'number', placeholder: 'ex: 2800' }"
          [value]="formSalaire" (valueChange)="formSalaire = asNumber($event)" />

        <daf-form-field [options]="{ label: 'Motif', placeholder: 'ex: Revalorisation annuelle' }"
          [value]="formMotif" (valueChange)="formMotif = asText($event)" />

        <daf-form-field style="grid-column:span 2;" [options]="{ label: 'Commentaire', type: 'textarea', rows: 2 }"
          [value]="formCommentaire" (valueChange)="formCommentaire = asText($event)" />
      </div>
      <div style="display:flex;justify-content:flex-end;margin-top:12px;">
        <daf-button [label]="isSaving() ? 'Enregistrement…' : 'Enregistrer'" variant="primary"
          [options]="{ disabled: isSaving(), loading: isSaving() }" (onClick)="saveContract()" />
      </div>
    </daf-card>
  }

  <!-- Timeline -->
  @if (isLoading()) {
    <div style="display:flex;flex-direction:column;gap:8px;">
      @for (i of [1,2,3]; track i) {
        <div style="height:56px;border-radius:10px;background:linear-gradient(90deg,#e2e8f0 25%,#f1f5f9 50%,#e2e8f0 75%);background-size:200% 100%;animation:shimmer 1.5s infinite;"></div>
      }
    </div>
  }

  @if (!isLoading() && history().length === 0) {
    <div style="text-align:center;padding:32px;color:#75777d;">
      <span class="material-symbols-outlined" style="font-size:36px;display:block;margin-bottom:8px;opacity:.35;">description</span>
      <p style="font-size:13px;margin:0;">Aucun contrat enregistré.</p>
    </div>
  }

  @if (!isLoading() && history().length > 0) {
    <div style="display:flex;flex-direction:column;gap:0;position:relative;">
      @for (c of history(); track c.id; let last = $last) {
        <div style="display:flex;gap:12px;padding-bottom:0;">
          <!-- Timeline dot + line -->
          <div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0;width:20px;">
            <div style="width:12px;height:12px;border-radius:50%;flex-shrink:0;margin-top:6px;"
              [style.background]="c.isActive ? '#1a6b7c' : '#c5c6cd'"></div>
            @if (!last) { <div style="width:2px;flex:1;background:#eceef0;margin-top:2px;"></div> }
          </div>
          <!-- Card -->
          <daf-card [options]="{ variant: 'outlined', padding: 'sm' }" style="display:block;flex:1;margin-bottom:10px;"
            [style.border-left-color]="c.isActive ? '#1a6b7c' : 'transparent'"
            [style.border-left-width]="c.isActive ? '3px' : '1px'">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
              <div style="flex:1;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;">
                  <span style="font-size:13px;font-weight:700;color:#1d2b3e;">{{ c.typeContratLabelFr }}</span>
                  <daf-badge [label]="c.typeDocument === 'CONTRAT_INITIAL' ? 'Contrat initial' : 'Avenant'"
                    [options]="{ variant: c.typeDocument === 'CONTRAT_INITIAL' ? 'info' : 'warning', pill: true, size: 'sm' }" />
                  @if (c.isActive) {
                    <daf-badge label="Actif" [options]="{ variant: 'teal', pill: true, size: 'sm' }" />
                  }
                </div>
                <div style="font-size:12px;color:#44474c;display:flex;flex-wrap:wrap;gap:12px;">
                  <span>📅 Du {{ c.dateEffet | date:'dd/MM/yyyy' }}
                    @if (c.dateFin) { → {{ c.dateFin | date:'dd/MM/yyyy' }} }
                    @else { → En cours }
                  </span>
                  @if (c.salaireNet) {
                    <span>💰 {{ c.salaireNet | number:'1.0-0' }} TND net/mois</span>
                  }
                </div>
                @if (c.motif) {
                  <p style="font-size:11px;color:#75777d;margin:4px 0 0;font-style:italic;">{{ c.motif }}</p>
                }
                @if (c.commentaire) {
                  <p style="font-size:11px;color:#75777d;margin:2px 0 0;">{{ c.commentaire }}</p>
                }
              </div>
              <span style="font-size:10px;color:#a8a9ad;white-space:nowrap;flex-shrink:0;">
                {{ c.dateCreation | date:'dd/MM/yyyy' }}
              </span>
            </div>
          </daf-card>
        </div>
      }
    </div>
  }
</div>
  `,
  styles: [`@keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }`],
})
export class ContractHistoryComponent implements OnChanges {
  private svc = inject(ContractHistoryService);

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
  readonly docTypeOptions: SelectOption[] = [
    { value: 'CONTRAT_INITIAL', label: 'Contrat initial' },
    { value: 'AVENANT', label: 'Avenant' },
  ];

  // Form fields
  formType      = '';
  formTypeDoc   = 'CONTRAT_INITIAL';
  formDateEffet = '';
  formDateFin   = '';
  formSalaire: number | null = null;
  formMotif     = '';
  formCommentaire = '';

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
      this.formError.set('Le type de contrat et la date d\'effet sont obligatoires.');
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
        this.formError.set(err?.error?.message ?? 'Erreur lors de l\'enregistrement.');
      },
    });
  }

  private resetForm(): void {
    this.formType = ''; this.formTypeDoc = 'CONTRAT_INITIAL';
    this.formDateEffet = ''; this.formDateFin = ''; this.formSalaire = null;
    this.formMotif = ''; this.formCommentaire = '';
  }
}
