import {
  AfterViewInit, Component, inject, input, output, signal, TemplateRef, viewChild,
} from '@angular/core';
import {
  CheckboxComponent,
  MultiDatePickerComponent,
  FormFieldComponent,
  ModalService,
  type ModalRef,
} from '@khalilrebhiitec/daf360';
import { ContractLifecycleService } from './contract-lifecycle.service';
import {
  ContractDetailDto, ContractTypeCode, CreateContractRequest,
  CONTRACT_TYPE_CONFIG,
} from './contract-lifecycle.model';
import { isoToDate, dateToIso } from '../../../shared/date-picker.utils';

const TYPE_CODES: ContractTypeCode[] = ['CDI', 'CDD', 'CIVP', 'STAGE', 'DETACHEMENT', 'PORTAGE'];

@Component({
  selector: 'app-new-contract-form',
  standalone: true,
  imports: [FormFieldComponent, MultiDatePickerComponent, CheckboxComponent],
  template: `
    <ng-template #formTpl>
      <div style="display:flex;flex-direction:column;gap:16px;">

        @if (error()) {
          <div style="background:#fee2e2;border-radius:8px;padding:10px 14px;font-size:13px;color:#991b1b;">
            {{ error() }}
          </div>
        }

        <!-- Type selector -->
        <div>
          <label class="lbl">Type de contrat *</label>
          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:6px;">
            @for (t of types; track t) {
              <button type="button"
                [class.type-chip--active]="contractType === t"
                class="type-chip"
                (click)="contractType = t; dateFinPrevue = ''"
              >{{ cfg[t].label }}</button>
            }
          </div>
        </div>

        <!-- Dates -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <daf-multi-date-picker [config]="{ label: 'Date de début *', selectionMode: 'single' }"
            [value]="toDate(dateDebut)" (valueChange)="dateDebut = fromDate($event)" />
          @if (cfg[contractType].needsEndDate) {
            <daf-multi-date-picker [config]="{ label: 'Date de fin prévue *', selectionMode: 'single' }"
              [value]="toDate(dateFinPrevue)" (valueChange)="dateFinPrevue = fromDate($event)" />
          }
        </div>

        <!-- Référence -->
        <daf-form-field [options]="{ label: 'Référence contrat', placeholder: 'ex: CTR-2026-001' }"
          [value]="referenceContrat" (valueChange)="referenceContrat = asText($event)" />

        <!-- CDI — manager profile -->
        @if (contractType === 'CDI') {
          <daf-checkbox [options]="{ label: 'Profil encadrant (période d\\'essai 6 mois au lieu de 3)' }"
            [checked]="managerProfile" (checkedChange)="managerProfile = $event" />
        }

        <!-- CIVP fields -->
        @if (contractType === 'CIVP') {
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <daf-form-field [options]="{ label: 'Référence ANETI' }"
              [value]="civpAnetiReference" (valueChange)="civpAnetiReference = asText($event)" />
            <daf-multi-date-picker [config]="{ label: 'Date convention', selectionMode: 'single' }"
              [value]="toDate(civpConventionDate)" (valueChange)="civpConventionDate = fromDate($event)" />
          </div>
        }

        <!-- STAGE fields -->
        @if (contractType === 'STAGE') {
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <daf-form-field [options]="{ label: 'École / Université', placeholder: 'ex: ESPRIT Tunis' }"
              [value]="stageEcole" (valueChange)="stageEcole = asText($event)" />
            <daf-checkbox style="margin-top:22px;" [options]="{ label: 'Convention signée' }"
              [checked]="stageConventionSignee" (checkedChange)="stageConventionSignee = $event" />
          </div>
        }

        <!-- DETACHEMENT fields -->
        @if (contractType === 'DETACHEMENT') {
          <daf-multi-date-picker [config]="{ label: 'Retour prévu', selectionMode: 'single' }"
            [value]="toDate(detachementRetourPrevu)" (valueChange)="detachementRetourPrevu = fromDate($event)" />
        }

      </div>
    </ng-template>
  `,
  styles: [`
    .lbl {
      display: block; font-size: 11px; font-weight: 600;
      text-transform: uppercase; letter-spacing: .4px;
      color: var(--color-text-muted, #6B7280); margin-bottom: 4px;
    }
    .type-chip {
      padding: 6px 14px; border: 1px solid var(--color-border, #E0E7E9);
      border-radius: 999px; background: none; font-size: 13px; cursor: pointer;
      color: var(--color-text-muted, #6B7280); transition: all .15s;
    }
    .type-chip:hover { border-color: var(--color-primary, #1a6b7c); color: var(--color-primary, #1a6b7c); }
    .type-chip--active {
      border-color: var(--color-primary, #1a6b7c);
      background: var(--color-primary, #1a6b7c); color: #fff;
    }
  `],
})
export class NewContractFormComponent implements AfterViewInit {
  readonly profileId = input.required<number>();
  readonly paysId    = input.required<number>();

  readonly saved     = output<ContractDetailDto>();
  readonly cancelled = output<void>();

  private svc = inject(ContractLifecycleService);
  private modalService = inject(ModalService);

  readonly types = TYPE_CODES;
  readonly cfg   = CONTRACT_TYPE_CONFIG;

  formTpl = viewChild.required<TemplateRef<unknown>>('formTpl');

  contractType:          ContractTypeCode = 'CDI';
  dateDebut:             string  = '';
  dateFinPrevue:         string  = '';
  referenceContrat:      string  = '';
  managerProfile:        boolean = false;
  civpAnetiReference:    string  = '';
  civpConventionDate:    string  = '';
  stageEcole:            string  = '';
  stageConventionSignee: boolean = false;
  detachementRetourPrevu: string = '';

  saving = signal(false);
  error  = signal<string | null>(null);

  ngAfterViewInit(): void {
    // closeOnBackdrop is disabled — this component's lifetime is driven by the
    // parent's showNewContractModal signal, so silent backdrop-dismiss would
    // leave that signal out of sync with the (now-closed) modal.
    this.modalService.open({
      title: 'Nouveau contrat',
      body: this.formTpl(),
      closeOnBackdrop: false,
      buttons: [
        {
          label: 'Annuler',
          variant: 'secondary',
          action: (ref) => {
            ref.close();
            this.cancelled.emit();
          },
        },
        {
          label: 'Créer le contrat',
          variant: 'primary',
          action: (ref) => this.submit(ref),
        },
      ],
    });
  }

  asText(v: string | number | null): string {
    return v == null ? '' : String(v);
  }

  protected readonly toDate = isoToDate;
  protected readonly fromDate = dateToIso;

  submit(ref: ModalRef): void {
    if (this.saving()) return;
    this.error.set(null);
    if (!this.dateDebut) { this.error.set('La date de début est obligatoire.'); return; }
    if (this.cfg[this.contractType].needsEndDate && !this.dateFinPrevue) {
      this.error.set('La date de fin est obligatoire pour ce type de contrat.'); return;
    }

    const req: CreateContractRequest = {
      employeeProfileId:       this.profileId(),
      paysId:                  this.paysId(),
      contractTypeCode:        this.contractType,
      dateDebut:               this.dateDebut,
      dateFinPrevue:           this.dateFinPrevue || null,
      referenceContrat:        this.referenceContrat || null,
      managerProfile:          this.contractType === 'CDI' ? this.managerProfile : false,
      civpAnetiReference:      this.contractType === 'CIVP' ? (this.civpAnetiReference || null) : null,
      civpConventionDate:      this.contractType === 'CIVP' ? (this.civpConventionDate || null) : null,
      stageEcole:              this.contractType === 'STAGE' ? (this.stageEcole || null) : null,
      stageConventionSignee:   this.contractType === 'STAGE' ? this.stageConventionSignee : null,
      detachementRetourPrevu:  this.contractType === 'DETACHEMENT' ? (this.detachementRetourPrevu || null) : null,
    };

    this.saving.set(true);
    this.svc.createContract(this.profileId(), req).subscribe({
      next: contract => {
        this.saving.set(false);
        ref.close();
        this.saved.emit(contract);
      },
      error: err => {
        this.saving.set(false);
        this.error.set(err?.error?.message ?? 'Erreur lors de la création du contrat.');
      },
    });
  }
}
