import { catchError, of } from 'rxjs';
import { ConfigurableListService } from '../../../core/lists/configurable-list.service';
import { ListValue } from '../../../core/lists/configurable-list.model';
import { adminLabel } from '../../../shared/utils/admin-label.utils';
import {
  AfterViewInit, Component, computed, inject, input, OnInit, output, signal,
  TemplateRef, viewChild,
} from '@angular/core';
import {
  CheckboxComponent,
  MultiDatePickerComponent,
  FormFieldComponent,
  SelectComponent,
  type SelectOption,
  ModalService,
  type ModalRef,
} from '@khalilrebhiitec/daf360';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ContractLifecycleService } from './contract-lifecycle.service';
import {
  ContractDetailDto, ContractTypeCode, CreateContractRequest,
  CONTRACT_TYPE_CONFIG, contractNatureOf,
} from './contract-lifecycle.model';
import { ContractHistoryService } from '../contract-history/contract-history.service';
import {
  TypeDocument,
  CreateContractRequest as CreateHistoryEntryRequest,
} from '../contract-history/contract-history.model';
import { isoToDate, dateToIso } from '../../../shared/date-picker.utils';

@Component({
  selector: 'app-new-contract-form',
  standalone: true,
  imports: [
    FormFieldComponent, MultiDatePickerComponent, CheckboxComponent, SelectComponent,
    TranslatePipe,
  ],
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
          <label class="lbl">{{ 'PROFILES.NEW_CONTRACT.TYPE' | translate }}</label>
          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:6px;">
            @for (t of adminTypes(); track t.id) {
              <button type="button"
                [class.type-chip--active]="selectedTypeId() === t.id"
                class="type-chip"
                (click)="selectType(t)"
              >{{ chipLabel(t) }}</button>
            }
          </div>
        </div>

        <!-- Dates -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <daf-multi-date-picker [config]="{ label: ('PROFILES.NEW_CONTRACT.START_DATE' | translate), selectionMode: 'single' }"
            [value]="toDate(dateDebut)" (valueChange)="dateDebut = fromDate($event)" />
          @if (cfg[contractType].needsEndDate) {
            <daf-multi-date-picker [config]="{ label: ('PROFILES.NEW_CONTRACT.END_DATE' | translate), selectionMode: 'single' }"
              [value]="toDate(dateFinPrevue)" (valueChange)="dateFinPrevue = fromDate($event)" />
          }
        </div>

        <!-- Référence -->
        <daf-form-field [options]="{ label: ('PROFILES.NEW_CONTRACT.REFERENCE' | translate), placeholder: ('PROFILES.NEW_CONTRACT.REFERENCE_PH' | translate) }"
          [value]="referenceContrat" (valueChange)="referenceContrat = asText($event)" />

        <!-- Préavis (V69). This form is the ONLY way to change an employee's préavis after
             onboarding: the value is frozen per contract, so a renegotiation is a new
             contract. Left empty, the backend resolves it from the employee's grade. -->
        <div>
          <daf-form-field
            [options]="{ label: ('PROFILES.NEW_CONTRACT.NOTICE_PERIOD' | translate), type: 'number', placeholder: '30' }"
            [value]="noticePeriodDays" (valueChange)="noticePeriodDays = asNumber($event)" />
          <p class="hint">{{ 'PROFILES.NEW_CONTRACT.NOTICE_HINT' | translate }}</p>
        </div>

        <!-- CDI — manager profile -->
        @if (contractType === 'CDI') {
          <daf-checkbox [options]="{ label: ('PROFILES.NEW_CONTRACT.MANAGER_PROFILE' | translate) }"
            [checked]="managerProfile" (checkedChange)="managerProfile = $event" />
        }

        <!-- CIVP fields -->
        @if (contractType === 'CIVP') {
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <daf-form-field [options]="{ label: ('PROFILES.NEW_CONTRACT.CIVP_REF' | translate) }"
              [value]="civpAnetiReference" (valueChange)="civpAnetiReference = asText($event)" />
            <daf-multi-date-picker [config]="{ label: ('PROFILES.NEW_CONTRACT.CIVP_DATE' | translate), selectionMode: 'single' }"
              [value]="toDate(civpConventionDate)" (valueChange)="civpConventionDate = fromDate($event)" />
          </div>
        }

        <!-- STAGE fields -->
        @if (contractType === 'STAGE') {
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <daf-form-field [options]="{ label: ('PROFILES.NEW_CONTRACT.SCHOOL' | translate), placeholder: ('PROFILES.NEW_CONTRACT.SCHOOL_PH' | translate) }"
              [value]="stageEcole" (valueChange)="stageEcole = asText($event)" />
            <daf-checkbox style="margin-top:22px;" [options]="{ label: ('PROFILES.NEW_CONTRACT.CONVENTION_SIGNED' | translate) }"
              [checked]="stageConventionSignee" (checkedChange)="stageConventionSignee = $event" />
          </div>
        }

        <!-- DETACHEMENT fields -->
        @if (contractType === 'DETACHEMENT') {
          <daf-multi-date-picker [config]="{ label: ('PROFILES.NEW_CONTRACT.RETURN_EXPECTED' | translate), selectionMode: 'single' }"
            [value]="toDate(detachementRetourPrevu)" (valueChange)="detachementRetourPrevu = fromDate($event)" />
        }

        <!-- ── Dossier / historique ────────────────────────────────────────
             Merged in from the separate "Nouveau" form the Historique tab used to
             carry. One contract event, one form: creating a lifecycle contract and
             then re-typing the same dates into a second form to log it was busywork
             that guaranteed the two would disagree. -->
        <div class="sep">
          <span class="sep-label">{{ 'PROFILES.NEW_CONTRACT.SECTION_RECORD' | translate }}</span>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <daf-select [options]="docTypeOptions()"
            [config]="{ label: ('PROFILES.NEW_CONTRACT.DOC_TYPE' | translate) }"
            [selected]="[typeDocument]" (selectedChange)="typeDocument = $any($event[0])" />

          <daf-form-field
            [options]="{ label: ('PROFILES.NEW_CONTRACT.SALARY' | translate), type: 'number', placeholder: '0' }"
            [value]="salaireNet" (valueChange)="salaireNet = asNumber($event)" />
        </div>

        <daf-form-field [options]="{ label: ('PROFILES.NEW_CONTRACT.MOTIF' | translate), placeholder: ('PROFILES.NEW_CONTRACT.MOTIF_PH' | translate) }"
          [value]="motif" (valueChange)="motif = asText($event)" />

        <daf-form-field [options]="{ label: ('PROFILES.NEW_CONTRACT.COMMENT' | translate), type: 'textarea', rows: 2 }"
          [value]="commentaire" (valueChange)="commentaire = asText($event)" />

        <p class="hint">{{ 'PROFILES.NEW_CONTRACT.RECORD_HINT' | translate }}</p>

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
    .hint {
      margin: 4px 0 0; font-size: 11px;
      color: var(--color-text-muted, #6B7280);
    }
    /* Separates the contract itself from how it is recorded in the dossier — the two
       halves used to be two forms, and the boundary is still worth seeing. */
    .sep {
      display: flex; align-items: center; gap: 10px;
      margin: 4px 0 -4px;
    }
    .sep::after {
      content: ''; flex: 1; height: 1px;
      background: var(--color-outline-variant, #E0E7E9);
    }
    .sep-label {
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .4px; color: var(--color-text-muted, #6B7280);
    }
    .type-chip:hover { border-color: var(--color-primary, #1a6b7c); color: var(--color-primary, #1a6b7c); }
    .type-chip--active {
      border-color: var(--color-primary, #1a6b7c);
      background: var(--color-primary, #1a6b7c); color: #fff;
    }
  `],
})
export class NewContractFormComponent implements OnInit, AfterViewInit {
  readonly profileId = input.required<number>();
  readonly paysId    = input.required<number>();

  readonly saved     = output<ContractDetailDto>();
  readonly cancelled = output<void>();

  private svc = inject(ContractLifecycleService);
  /** The historique half of the merged form writes through this. */
  private historySvc = inject(ContractHistoryService);
  private modalService = inject(ModalService);
  private translate = inject(TranslateService);

  private listSvc = inject(ConfigurableListService);
  /**
   * The chips: Admin › Listes configurables › CONTRACT_TYPE of this entity — every type there,
   * « contrat » included. The contract stores the picked value's id; its rules (end date,
   * trial, CIVP/stage fields) follow the value's nature (Admin › « Règles de contrat »).
   */
  protected readonly adminTypes = signal<ListValue[]>([]);
  protected readonly selectedTypeId = signal<number | null>(null);

  protected chipLabel(t: ListValue): string {
    return adminLabel(t, this.translate);
  }
  readonly cfg   = CONTRACT_TYPE_CONFIG;

  formTpl = viewChild.required<TemplateRef<unknown>>('formTpl');

  /** Nature of the picked type — what the conditional fields and the end-date rule key on. */
  get contractType(): ContractTypeCode {
    return contractNatureOf(this.adminTypes().find(t => t.id === this.selectedTypeId()));
  }

  protected selectType(t: ListValue): void {
    this.selectedTypeId.set(t.id);
    this.dateFinPrevue = '';
  }

  dateDebut:             string  = '';
  dateFinPrevue:         string  = '';
  referenceContrat:      string  = '';
  managerProfile:        boolean = false;
  civpAnetiReference:    string  = '';
  civpConventionDate:    string  = '';
  stageEcole:            string  = '';
  stageConventionSignee: boolean = false;
  detachementRetourPrevu: string = '';
  /** Préavis in calendar days. Null = let the backend resolve it from the grade. */
  noticePeriodDays:      number | null = null;

  // ── Dossier / historique half (merged in from the Historique tab's own form) ──
  typeDocument: TypeDocument = 'CONTRAT_INITIAL';
  salaireNet:   number | null = null;
  motif:        string = '';
  commentaire:  string = '';

  readonly docTypeOptions = computed<SelectOption[]>(() => {
    this.translate.currentLang();
    return [
      { value: 'CONTRAT_INITIAL', label: this.translate.instant('PROFILES.HISTORY.DOC_INITIAL') },
      { value: 'AVENANT',         label: this.translate.instant('PROFILES.HISTORY.DOC_AMENDMENT') },
    ];
  });

  saving = signal(false);
  error  = signal<string | null>(null);

  ngOnInit(): void {
    this.listSvc.getListValues('CONTRACT_TYPE', this.paysId())
      .pipe(catchError(() => of([] as ListValue[])))
      .subscribe(v => {
        this.adminTypes.set(v);
        // Preselect CDI (the common case), else the first type of the list.
        const cdi = v.find(t => t.valueCode?.toUpperCase() === 'CDI') ?? v[0];
        this.selectedTypeId.set(cdi?.id ?? null);
      });
  }

  ngAfterViewInit(): void {
    // closeOnBackdrop is disabled — this component's lifetime is driven by the
    // parent's showNewContractModal signal, so silent backdrop-dismiss would
    // leave that signal out of sync with the (now-closed) modal.
    this.modalService.open({
      title: this.translate.instant('PROFILES.NEW_CONTRACT.MODAL_TITLE'),
      body: this.formTpl(),
      closeOnBackdrop: false,
      buttons: [
        {
          label: this.translate.instant('PROFILES.COMMON.CANCEL'),
          variant: 'secondary',
          action: (ref) => {
            ref.close();
            this.cancelled.emit();
          },
        },
        {
          label: this.translate.instant('PROFILES.NEW_CONTRACT.CREATE'),
          variant: 'primary',
          action: (ref) => this.submit(ref),
        },
      ],
    });
  }

  asText(v: string | number | null): string {
    return v == null ? '' : String(v);
  }

  /** '' → null so clearing the préavis means "resolve it", not 0. */
  asNumber(v: string | number | null): number | null {
    if (v === null || v === '') return null;
    const n = typeof v === 'number' ? v : Number(v);
    return isNaN(n) ? null : n;
  }

  protected readonly toDate = isoToDate;
  protected readonly fromDate = dateToIso;

  submit(ref: ModalRef): void {
    if (this.saving()) return;
    this.error.set(null);
    if (!this.dateDebut) { this.error.set(this.translate.instant('PROFILES.NEW_CONTRACT.ERR_START')); return; }
    // Caught here rather than as a 400 whose body reads "paysId: ne doit pas être nul": the
    // profile DTO used to omit paysId entirely, and a missing entity should say so in the
    // form instead of surfacing a field-level backend validation error.
    if (this.paysId() == null) {
      this.error.set(this.translate.instant('PROFILES.NEW_CONTRACT.ERR_NO_PAYS'));
      return;
    }
    const typeId = this.selectedTypeId();
    if (typeId == null) {
      this.error.set(this.translate.instant('PROFILES.NEW_CONTRACT.ERR_NO_TYPE')); return;
    }
    if (this.cfg[this.contractType].needsEndDate && !this.dateFinPrevue) {
      this.error.set(this.translate.instant('PROFILES.NEW_CONTRACT.ERR_END')); return;
    }

    const req: CreateContractRequest = {
      employeeProfileId:       this.profileId(),
      paysId:                  this.paysId(),
      // The list value's id: the contract stores it (like profiles and candidates).
      contractTypeCode:        String(typeId),
      dateDebut:               this.dateDebut,
      dateFinPrevue:           this.dateFinPrevue || null,
      referenceContrat:        this.referenceContrat || null,
      managerProfile:          this.contractType === 'CDI' ? this.managerProfile : false,
      civpAnetiReference:      this.contractType === 'CIVP' ? (this.civpAnetiReference || null) : null,
      civpConventionDate:      this.contractType === 'CIVP' ? (this.civpConventionDate || null) : null,
      stageEcole:              this.contractType === 'STAGE' ? (this.stageEcole || null) : null,
      stageConventionSignee:   this.contractType === 'STAGE' ? this.stageConventionSignee : null,
      detachementRetourPrevu:  this.contractType === 'DETACHEMENT' ? (this.detachementRetourPrevu || null) : null,
      // Sent as-is, including 0 ("aucun préavis dû"). Null means "not specified", which the
      // backend answers from the grade default rather than treating as zero.
      noticePeriodDays:        this.noticePeriodDays,
    };

    this.saving.set(true);
    this.svc.createContract(this.profileId(), req).subscribe({
      next: contract => {
        // The lifecycle contract is the source of truth and it exists now. The historique
        // entry is a dossier record of the same event, so it is written after and its
        // failure never rolls the contract back — the two tables are not transactional
        // together, and a missing log line is recoverable while a lost contract is not.
        this.recordInHistory(() => {
          this.saving.set(false);
          ref.close();
          this.saved.emit(contract);
        });
      },
      error: err => {
        this.saving.set(false);
        this.error.set(err?.error?.message ?? this.translate.instant('PROFILES.NEW_CONTRACT.ERR_CREATE'));
      },
    });
  }

  /**
   * Mirrors the contract into `historique_contrat` so the dossier log carries the salary,
   * the motif and whether this is an initial contract or an avenant — none of which the
   * lifecycle table holds.
   *
   * The history now points at the same CONTRACT_TYPE list value as the contract (the separate
   * type_contrat table is retired), so the picked id is used as is.
   */
  private recordInHistory(done: () => void): void {
    const typeId = this.selectedTypeId();
    if (typeId == null) { done(); return; }

    const entry: CreateHistoryEntryRequest = {
      idTypeContrat: typeId,
      typeDocument:  this.typeDocument,
      dateEffet:     this.dateDebut,
      dateFin:       this.dateFinPrevue || undefined,
      salaireNet:    this.salaireNet ?? undefined,
      motif:         this.motif || undefined,
      commentaire:   this.commentaire || undefined,
    };
    this.historySvc.addContract(this.profileId(), entry).subscribe({
      next: () => done(),
      error: () => {
        console.warn('[new-contract] the dossier history entry could not be saved; '
                     + 'the lifecycle contract was created.');
        done();
      },
    });
  }
}
