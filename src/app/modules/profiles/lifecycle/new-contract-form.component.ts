import {
  Component, inject, input, output, signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModalComponent } from '../../../shared/modal.component';
import { ContractLifecycleService } from './contract-lifecycle.service';
import {
  ContractDetailDto, ContractTypeCode, CreateContractRequest,
  CONTRACT_TYPE_CONFIG,
} from './contract-lifecycle.model';

const TYPE_CODES: ContractTypeCode[] = ['CDI', 'CDD', 'CIVP', 'STAGE', 'DETACHEMENT', 'PORTAGE'];

@Component({
  selector: 'app-new-contract-form',
  standalone: true,
  imports: [FormsModule, ModalComponent],
  template: `
    <app-modal title="Nouveau contrat" [visible]="true" (closed)="cancelled.emit()">
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
          <div>
            <label class="lbl">Date de début *</label>
            <input type="date" [(ngModel)]="dateDebut" class="inp" />
          </div>
          @if (cfg[contractType].needsEndDate) {
            <div>
              <label class="lbl">Date de fin prévue *</label>
              <input type="date" [(ngModel)]="dateFinPrevue" class="inp" />
            </div>
          }
        </div>

        <!-- Référence -->
        <div>
          <label class="lbl">Référence contrat</label>
          <input type="text" [(ngModel)]="referenceContrat" class="inp" placeholder="ex: CTR-2026-001" />
        </div>

        <!-- CDI — manager profile -->
        @if (contractType === 'CDI') {
          <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">
            <input type="checkbox" [(ngModel)]="managerProfile" />
            Profil encadrant (période d'essai 6 mois au lieu de 3)
          </label>
        }

        <!-- CIVP fields -->
        @if (contractType === 'CIVP') {
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div>
              <label class="lbl">Référence ANETI</label>
              <input type="text" [(ngModel)]="civpAnetiReference" class="inp" />
            </div>
            <div>
              <label class="lbl">Date convention</label>
              <input type="date" [(ngModel)]="civpConventionDate" class="inp" />
            </div>
          </div>
        }

        <!-- STAGE fields -->
        @if (contractType === 'STAGE') {
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div>
              <label class="lbl">École / Université</label>
              <input type="text" [(ngModel)]="stageEcole" class="inp" placeholder="ex: ESPRIT Tunis" />
            </div>
            <div style="display:flex;align-items:center;gap:8px;margin-top:22px;">
              <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">
                <input type="checkbox" [(ngModel)]="stageConventionSignee" />
                Convention signée
              </label>
            </div>
          </div>
        }

        <!-- DETACHEMENT fields -->
        @if (contractType === 'DETACHEMENT') {
          <div>
            <label class="lbl">Retour prévu</label>
            <input type="date" [(ngModel)]="detachementRetourPrevu" class="inp" />
          </div>
        }

      </div>

      <!-- Footer -->
      <div slot="footer">
        <button type="button" class="btn-ghost" (click)="cancelled.emit()">Annuler</button>
        <button type="button" class="btn-primary" (click)="submit()" [disabled]="saving()">
          {{ saving() ? 'Création…' : 'Créer le contrat' }}
        </button>
      </div>
    </app-modal>
  `,
  styles: [`
    .lbl {
      display: block; font-size: 11px; font-weight: 600;
      text-transform: uppercase; letter-spacing: .4px;
      color: var(--color-text-muted, #6B7280); margin-bottom: 4px;
    }
    .inp {
      width: 100%; background: #f2f4f6; border: none; border-radius: 8px;
      padding: 8px 12px; font-size: 13px; outline: none; box-sizing: border-box;
      &:focus { box-shadow: 0 0 0 2px var(--color-primary, #1a6b7c); }
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
    .btn-primary {
      padding: 9px 20px; background: var(--color-primary, #1a6b7c); color: #fff;
      border: none; border-radius: 8px; font-size: 13px; font-weight: 600;
      cursor: pointer; transition: background .15s;
      &:disabled { opacity: .5; cursor: not-allowed; }
    }
    .btn-ghost {
      padding: 9px 16px; border: 1px solid var(--color-border, #E0E7E9);
      border-radius: 8px; background: none; font-size: 13px; cursor: pointer;
      color: var(--color-text-muted, #6B7280);
    }
  `],
})
export class NewContractFormComponent {
  readonly profileId = input.required<number>();
  readonly paysId    = input.required<number>();

  readonly saved     = output<ContractDetailDto>();
  readonly cancelled = output<void>();

  private svc = inject(ContractLifecycleService);

  readonly types = TYPE_CODES;
  readonly cfg   = CONTRACT_TYPE_CONFIG;

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

  submit(): void {
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
      next:  contract => { this.saving.set(false); this.saved.emit(contract); },
      error: err => {
        this.saving.set(false);
        this.error.set(err?.error?.message ?? 'Erreur lors de la création du contrat.');
      },
    });
  }
}
