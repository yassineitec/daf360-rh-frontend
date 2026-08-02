import {
  Component, computed, inject, OnInit, signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { ItProvisioningService }     from './it-provisioning.service';
import { ConfirmEmailModalComponent } from './confirm-email-modal.component';
import {
  ItAssetDto, ProvisioningDetail, UpdateAssetRequest,
  UpdateProvisioningRequest,
} from './it-provisioning.model';
import {
  BreadcrumbItem, ButtonComponent, CardComponent, SelectOption,
  PageComponent, PageHeaderBadge, PageHeaderComponent,
  StepperComponent, StepperConfig, StepperStep,
} from '@khalilrebhiitec/daf360';
import { statusBadge } from '../../shared/status-badge.utils';
import { ModalComponent }       from '../../shared/modal.component';
import { ConfigurableListService } from '../../core/lists/configurable-list.service';
import { ListValue } from '../../core/lists/configurable-list.model';
import { WizardStepCardComponent } from '../../shared/wizard/wizard-step-card.component';
import { StepIdentityComponent } from './steps/step-identity.component';
import { StepMs365Component } from './steps/step-ms365.component';
import { AssetFieldChange, StepHardwareComponent } from './steps/step-hardware.component';
import { LicenceFlags, StepLicensesComponent } from './steps/step-licenses.component';
import { StepAdComponent } from './steps/step-ad.component';
import { StepNotesComponent } from './steps/step-notes.component';
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
    ButtonComponent, CardComponent, ModalComponent, ConfirmEmailModalComponent,
    PageComponent, PageHeaderComponent, StepperComponent, TranslatePipe,
    WizardStepCardComponent,
    StepIdentityComponent, StepMs365Component, StepHardwareComponent,
    StepLicensesComponent, StepAdComponent, StepNotesComponent,
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
  /**
   * Whole-page skeleton — first load only (UI-PLAYBOOK §5). `load()` also runs
   * after "Marquer comme terminé", and binding `daf-page [loading]` to the
   * re-fetch would flash the header and the whole wizard away at that moment.
   */
  firstLoad       = signal(true);
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

  readonly breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.translate.currentLang();
    const p = this.prov();
    return [
      { label: this.translate.instant('IT_PROVISIONING.form.breadcrumb'), link: '/rh/it-provisioning' },
      { label: p?.candidateFullName ?? `#${this.provId}` },
    ];
  });

  readonly headerTitle = computed(() => this.prov()?.candidateFullName ?? `#${this.provId}`);

  readonly headerSubtitle = computed(() => {
    this.translate.currentLang();
    const p = this.prov();
    if (!p) return '';
    return p.appliedPosition ?? this.translate.instant('IT_PROVISIONING.LIST.POSITION_UNSPECIFIED');
  });

  /**
   * The label comes from `IT_PROVISIONING.STATUS.*` (translated); only the variant
   * comes from the shared `statusBadge` map, whose labels are hardcoded French.
   * Same split the list page uses, so one status can't read two ways.
   */
  readonly headerBadges = computed<PageHeaderBadge[]>(() => {
    this.translate.currentLang();
    const p = this.prov();
    if (!p) return [];
    return [{
      label:   this.translate.instant('IT_PROVISIONING.STATUS.' + p.status),
      variant: statusBadge(p.status).options.variant ?? 'neutral',
      size:    'sm',
    }];
  });

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

  // ── daf-stepper (4.14.0) — the desktop rail ────────────────────────────────
  /**
   * `completed` is set on **every** step, not just the done ones: the lib turns
   * positional inference off as soon as any step declares it, and this wizard
   * needs that — `stepDone()` is computed from field completeness, so step 4 can
   * be green while the user is on step 2 (§10g).
   *
   * The subtitle only appears on the active step, which is how the hand-rolled
   * rail read before.
   */
  readonly stepperSteps = computed<StepperStep[]>(() => {
    this.translate.currentLang();
    const done = this.stepDone();
    const current = this.currentStep();
    return STEP_CARD_INFO.map((step, i) => ({
      title:     this.translate.instant('IT_PROVISIONING.form.steps.' + step.key + '.title'),
      icon:      step.icon,
      completed: done[i],
      subtitle:  current === i + 1 ? this.translate.instant('IT_PROVISIONING.form.underReview') : undefined,
    }));
  });

  /**
   * `header-only`: the lib draws the rail, this page keeps its own action bar
   * (Enregistrer le brouillon / Marquer comme terminé), which the lib can't know
   * about. `clickableSteps` restores the jump-to-step the old rail had.
   */
  readonly stepperConfig = computed<StepperConfig>(() => {
    this.translate.currentLang();
    return {
      chrome:           'header-only',
      clickableSteps:   true,
      stepperLabel:     this.translate.instant('IT_PROVISIONING.form.progression'),
      completedLabel:   this.translate.instant('IT_PROVISIONING.form.completed'),
      currentStepLabel: this.translate.instant('IT_PROVISIONING.form.currentStep'),
    };
  });

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

  /**
   * Mapped in a `computed`, not inline in the template: `[options]="adOptions()
   * .map(...)"` built a brand-new array on every change-detection cycle, which
   * `daf-select` sees as a new input every tick.
   */
  readonly adSelectOptions = computed<SelectOption[]>(() =>
    this.adOptions().map(opt => ({ value: opt.valueCode, label: opt.labelFr })),
  );

  assetIndex(assetTypeCode: string): number {
    return this.editableAssets().findIndex(a => a.assetTypeCode === assetTypeCode);
  }

  // ── Step bridges ──────────────────────────────────────────────────────────
  /**
   * The step components address a row by `assetTypeCode`, never by index: the page
   * resolves the index here, so a re-ordered catalog can't mis-address a write.
   */
  onAssetProvided({ assetTypeCode, provided }: { assetTypeCode: string; provided: boolean }): void {
    const i = this.assetIndex(assetTypeCode);
    if (i >= 0) this.toggleAssetProvided(i, provided);
  }

  onAssetField({ assetTypeCode, field, value }: AssetFieldChange): void {
    const i = this.assetIndex(assetTypeCode);
    if (i >= 0) this.setAssetField(i, field, value);
  }

  /** The five licence flags as one object, so the step takes a single input. */
  readonly licenceFlags = computed<LicenceFlags>(() => ({
    office365: this.licenseOffice365(),
    autocad:   this.licenseAutocad(),
    revit:     this.licenseRevit(),
    autodesk:  this.licenseAutodesk(),
    kaspersky: this.licenseKaspersky(),
  }));

  onLicenceChange({ key, value }: { key: keyof LicenceFlags; value: boolean }): void {
    switch (key) {
      case 'office365': this.licenseOffice365.set(value); break;
      case 'autocad':   this.licenseAutocad.set(value);   break;
      case 'revit':     this.licenseRevit.set(value);     break;
      case 'autodesk':  this.licenseAutodesk.set(value);  break;
      case 'kaspersky': this.licenseKaspersky.set(value); break;
    }
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
        this.firstLoad.set(false);
      },
      error: () => {
        this.error.set(this.translate.instant('IT_PROVISIONING.form.loadError'));
        this.loading.set(false);
        this.firstLoad.set(false);
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
