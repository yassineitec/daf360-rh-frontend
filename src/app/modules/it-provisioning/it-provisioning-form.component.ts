import {
  Component, computed, inject, OnInit, signal,
} from '@angular/core';
import { SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { ItProvisioningService }     from './it-provisioning.service';
import { ConfirmEmailModalComponent } from './confirm-email-modal.component';
import {
  ItAssetDto, ProvisioningDetail, UpdateAssetRequest,
  UpdateProvisioningRequest,
} from './it-provisioning.model';
import {
  StatusBadgeComponent, ButtonComponent, CardComponent,
  DataTableComponent, DafCellDirective, TableColumn, TableConfig, TableRow,
  FormFieldComponent, SelectComponent, CheckboxComponent, SelectOption,
} from '@khalilrebhiitec/daf360';
import { statusBadge } from '../../shared/status-badge.utils';
import { SpinnerComponent }     from '../../shared/spinner.component';
import { ModalComponent }       from '../../shared/modal.component';
import { ConfigurableListService } from '../../core/lists/configurable-list.service';
import { ListValue } from '../../core/lists/configurable-list.model';
import { PdfDownloadButtonComponent } from '../../shared/pdf-download-button/pdf-download-button.component';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

const STEP_CARD_INFO = [
  { key: 'identity',  icon: 'person'        },
  { key: 'ms365',     icon: 'cloud'         },
  { key: 'hardware',  icon: 'laptop_mac'    },
  { key: 'licenses',  icon: 'verified_user' },
  { key: 'ad',        icon: 'lan'           },
  { key: 'notes',     icon: 'flag'          },
];

@Component({
  selector: 'app-it-provisioning-form',
  standalone: true,
  imports: [
    SlicePipe, FormsModule, StatusBadgeComponent, ButtonComponent, CardComponent,
    DataTableComponent, DafCellDirective, FormFieldComponent, SelectComponent, CheckboxComponent,
    SpinnerComponent, ModalComponent, ConfirmEmailModalComponent, PdfDownloadButtonComponent,
    TranslatePipe,
  ],
  templateUrl: './it-provisioning-form.component.html',
})
export class ItProvisioningFormComponent implements OnInit {
  private route       = inject(ActivatedRoute);
  private router      = inject(Router);
  private service     = inject(ItProvisioningService);
  private listService = inject(ConfigurableListService);
  private translate   = inject(TranslateService);

  // ── Page state ────────────────────────────────────────────────────────────
  prov            = signal<ProvisioningDetail | null>(null);
  loading         = signal(true);
  saving          = signal(false);
  completing      = signal(false);
  submittingEmail = signal(false);
  error           = signal<string | null>(null);
  successMsg      = signal<string | null>(null);

  // ── Modals ────────────────────────────────────────────────────────────────
  showEmailModal    = signal(false);
  showCompleteModal = signal(false);

  // ── Form fields ───────────────────────────────────────────────────────────
  emailInput      = signal('');
  // Assets edited in-place as a mutable copy
  editableAssets  = signal<ItAssetDto[]>([]);
  hardwareNotes   = signal('');
  licenseOffice365  = signal(false);
  licenseAutocad    = signal(false);
  licenseRevit      = signal(false);
  licenseAutodesk   = signal(false);
  licenseKaspersky  = signal(false);
  licenseOther      = signal('');
  adAccountCreated  = signal(false);
  adProfileType     = signal('');
  notes             = signal('');

  // ── Wizard navigation ─────────────────────────────────────────────────────
  currentStep = signal(1);
  readonly totalSteps = STEP_CARD_INFO.length;
  readonly wizardSteps = STEP_CARD_INFO;

  readonly cardTitle = computed(() => {
    this.translate.currentLang();
    return this.translate.instant('IT_PROVISIONING.form.steps.' + STEP_CARD_INFO[this.currentStep() - 1].key + '.title');
  });
  readonly cardSub   = computed(() => {
    this.translate.currentLang();
    return this.translate.instant('IT_PROVISIONING.form.steps.' + STEP_CARD_INFO[this.currentStep() - 1].key + '.sub');
  });
  readonly cardIcon  = computed(() => STEP_CARD_INFO[this.currentStep() - 1].icon);

  /** Per-step completion, used to render check marks in the progression panel. */
  readonly stepDone = computed<boolean[]>(() => {
    const p = this.prov();
    if (!p) return [false, false, false, false, false, false];
    return [
      true,
      !!p.ms365Email,
      this.editableAssets().some(a => a.provided),
      this.licenseOffice365() || this.licenseAutocad() || this.licenseRevit() || this.licenseAutodesk() || this.licenseKaspersky(),
      this.adAccountCreated(),
      p.status === 'COMPLETED',
    ];
  });

  goNext(): void { this.currentStep.update(s => Math.min(this.totalSteps, s + 1)); }
  goPrev(): void { this.currentStep.update(s => Math.max(1, s - 1)); }
  goToStep(step: number): void { this.currentStep.set(step); }

  /** Circle classes for the progression panel — active / done / upcoming. */
  stepCircleClasses(i: number): string {
    if (this.currentStep() === i + 1) return 'bg-primary border-primary text-white ring-4 ring-primary/20';
    if (this.stepDone()[i])           return 'bg-success border-success text-white';
    return 'bg-surface-container border-outline-variant text-outline';
  }

  stepLabelClasses(i: number): string {
    return this.currentStep() === i + 1 ? 'text-teal' : 'text-on-surface';
  }

  stepEyebrowClasses(i: number): string {
    return this.currentStep() === i + 1 ? 'text-teal' : 'text-outline';
  }

  // ── Computed ──────────────────────────────────────────────────────────────
  readonly canComplete = computed(() => {
    const p = this.prov();
    return !!p?.ms365Email && this.adAccountCreated();
  });

  readonly isCompleted = computed(() => this.prov()?.status === 'COMPLETED');

  readonly emailIsValid = computed(() => {
    const e = this.emailInput().trim();
    return e.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  });

  readonly adOptions = signal<ListValue[]>([]);

  readonly hwStatuses = computed<{ value: string; label: string }[]>(() => {
    this.translate.currentLang();
    return ['NEUF', 'BON_ETAT', 'USAGE', 'EN_REPARATION', 'DEFECTUEUX'].map(value => ({
      value,
      label: this.translate.instant('IT_PROVISIONING.form.hwStatus.' + value),
    }));
  });

  readonly hwStatusSelectOptions = computed<SelectOption[]>(() =>
    this.hwStatuses().map(({ value, label }) => ({ value, label })),
  );

  // ── Hardware table (daf-data-table) ─────────────────────────────────────────
  readonly assetColumns = computed<TableColumn[]>(() => {
    this.translate.currentLang();
    return [
      { key: 'provided',         label: this.translate.instant('IT_PROVISIONING.form.assetCol.provided'),  align: 'center', width: '60px' },
      { key: 'assetTypeLabelFr', label: this.translate.instant('IT_PROVISIONING.form.assetCol.material'), width: '160px' },
      { key: 'serialNumber',     label: this.translate.instant('IT_PROVISIONING.form.assetCol.serial') },
      { key: 'brandModel',       label: this.translate.instant('IT_PROVISIONING.form.assetCol.brandModel') },
      { key: 'assetTag',         label: this.translate.instant('IT_PROVISIONING.form.assetCol.assetTag') },
      { key: 'status',           label: this.translate.instant('IT_PROVISIONING.form.assetCol.status'), width: '160px' },
    ];
  });

  readonly assetRows = computed<TableRow[]>(() =>
    this.editableAssets().map(a => ({ ...a })),
  );

  readonly assetTableConfig = computed<TableConfig>(() => {
    this.translate.currentLang();
    return { emptyMessage: this.translate.instant('IT_PROVISIONING.form.assetEmpty') };
  });

  assetIndex(assetTypeCode: string): number {
    return this.editableAssets().findIndex(a => a.assetTypeCode === assetTypeCode);
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  private provId = 0;
  protected readonly statusBadge = statusBadge;

  protected toTextValue(value: string | number | null | undefined): string {
    return value == null ? '' : String(value);
  }

  ngOnInit(): void {
    this.provId = Number(this.route.snapshot.paramMap.get('id'));
    this.listService.getListValues('AD_PROFILE_TYPE').subscribe(v => this.adOptions.set(v));
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.service.getProvisioning(this.provId).subscribe({
      next: (p) => {
        this.prov.set(p);
        this.initFromProv(p);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(this.translate.instant('IT_PROVISIONING.form.loadError'));
        this.loading.set(false);
      },
    });
  }

  private initFromProv(p: ProvisioningDetail): void {
    this.emailInput.set(p.ms365Email ?? '');
    // Deep-copy assets so edits don't mutate the signal directly
    this.editableAssets.set(p.assets.map(a => ({ ...a })));
    this.hardwareNotes.set(p.hardwareNotes ?? '');
    this.licenseOffice365.set(p.licenseOffice365);
    this.licenseAutocad.set(p.licenseAutocad);
    this.licenseRevit.set(p.licenseRevit);
    this.licenseAutodesk.set(p.licenseAutodesk);
    this.licenseKaspersky.set(p.licenseKaspersky);
    this.licenseOther.set(p.licenseOther ?? '');
    this.adAccountCreated.set(p.adAccountCreated);
    this.adProfileType.set(p.adProfileType ?? '');
    this.notes.set(p.notes ?? '');
  }

  // ── Asset helpers ─────────────────────────────────────────────────────────
  setAssetField(index: number, field: keyof ItAssetDto, value: unknown): void {
    this.editableAssets.update(assets => {
      const copy = [...assets];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  }

  toggleAssetProvided(index: number, provided: boolean): void {
    this.editableAssets.update(assets => {
      const copy = [...assets];
      copy[index] = { ...copy[index], provided };
      // Clear detail fields when un-providing
      if (!provided) {
        copy[index] = { ...copy[index], serialNumber: null, brandModel: null, assetTag: null, status: '' };
      }
      return copy;
    });
  }

  // ── Save (PATCH) ──────────────────────────────────────────────────────────
  onSave(): void {
    this.saving.set(true);
    const assetUpdates: UpdateAssetRequest[] = this.editableAssets().map(a => ({
      assetTypeCode: a.assetTypeCode,
      id:            a.id ?? null,
      provided:      a.provided,
      serialNumber:  a.serialNumber || null,
      brandModel:    a.brandModel   || null,
      assetTag:      a.assetTag     || null,
      status:        a.status       || null,
    }));
    const dto: UpdateProvisioningRequest = {
      assets:          assetUpdates,
      hardwareNotes:   this.hardwareNotes()   || null,
      licenseOffice365: this.licenseOffice365(),
      licenseAutocad:   this.licenseAutocad(),
      licenseRevit:     this.licenseRevit(),
      licenseAutodesk:  this.licenseAutodesk(),
      licenseKaspersky: this.licenseKaspersky(),
      licenseOther:     this.licenseOther()   || null,
      adAccountCreated: this.adAccountCreated(),
      adProfileType:    this.adProfileType()  || null,
      notes:            this.notes()          || null,
    };
    this.service.updateProvisioning(this.provId, dto).subscribe({
      next: (p) => {
        this.prov.set(p);
        this.initFromProv(p);
        this.saving.set(false);
        this.flash(this.translate.instant('IT_PROVISIONING.form.saveSuccess'));
      },
      error: () => {
        this.saving.set(false);
        this.error.set(this.translate.instant('IT_PROVISIONING.form.saveError'));
      },
    });
  }

  // ── Email submission ──────────────────────────────────────────────────────
  onOpenEmailModal(): void { this.showEmailModal.set(true); }

  onEmailConfirmed(): void {
    this.showEmailModal.set(false);
    this.submittingEmail.set(true);
    this.service.submitEmail(this.provId, this.emailInput().trim()).subscribe({
      next: (p) => {
        this.prov.set(p);
        this.initFromProv(p);
        this.submittingEmail.set(false);
        this.flash(this.translate.instant('IT_PROVISIONING.form.emailSuccess'));
      },
      error: (err) => {
        this.submittingEmail.set(false);
        const msg = err?.error?.detail ?? err?.error?.title ?? this.translate.instant('IT_PROVISIONING.form.emailError');
        this.error.set(msg);
      },
    });
  }

  // ── Complete ──────────────────────────────────────────────────────────────
  onOpenCompleteModal(): void {
    if (this.canComplete()) this.showCompleteModal.set(true);
  }

  onCompleteConfirmed(): void {
    this.showCompleteModal.set(false);
    this.completing.set(true);
    this.error.set(null);

    // Step 1 — save current form state (ensures adAccountCreated is persisted in DB)
    const assetUpdates = this.editableAssets().map(a => ({
      assetTypeCode: a.assetTypeCode,
      id:            a.id ?? null,
      provided:      a.provided,
      serialNumber:  a.serialNumber || null,
      brandModel:    a.brandModel   || null,
      assetTag:      a.assetTag     || null,
      status:        a.status       || null,
    }));
    const dto = {
      assets:           assetUpdates,
      hardwareNotes:    this.hardwareNotes()    || null,
      licenseOffice365: this.licenseOffice365(),
      licenseAutocad:   this.licenseAutocad(),
      licenseRevit:     this.licenseRevit(),
      licenseAutodesk:  this.licenseAutodesk(),
      licenseKaspersky: this.licenseKaspersky(),
      licenseOther:     this.licenseOther()     || null,
      adAccountCreated: this.adAccountCreated(),
      adProfileType:    this.adProfileType()    || null,
      notes:            this.notes()            || null,
    };

    this.service.updateProvisioning(this.provId, dto).subscribe({
      next: (saved) => {
        this.prov.set(saved);
        // Step 2 — now complete
        this.service.completeProvisioning(this.provId).subscribe({
          next: () => {
            this.completing.set(false);
            this.load();
            this.flash(this.translate.instant('IT_PROVISIONING.form.completeSuccess'));
          },
          error: (err) => {
            this.completing.set(false);
            const msg = err?.error?.message ?? err?.error?.detail ?? this.translate.instant('IT_PROVISIONING.form.completeError');
            this.error.set(msg);
          },
        });
      },
      error: (err) => {
        this.completing.set(false);
        this.error.set(err?.error?.message ?? this.translate.instant('IT_PROVISIONING.form.saveBeforeCompleteError'));
      },
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  private flash(msg: string): void {
    this.successMsg.set(msg);
    setTimeout(() => this.successMsg.set(null), 4000);
  }

  goBack(): void { this.router.navigate(['/rh/it-provisioning']); }
}
