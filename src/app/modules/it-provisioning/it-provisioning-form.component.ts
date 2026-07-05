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
  UpdateProvisioningRequest, computeSteps,
} from './it-provisioning.model';
import { StatusBadgeComponent } from '@khalilrebhiitec/daf360';
import { statusBadge } from '../../shared/status-badge.utils';
import { SpinnerComponent }     from '../../shared/spinner.component';
import { ModalComponent }       from '../../shared/modal.component';
import { ConfigurableListService } from '../../core/lists/configurable-list.service';
import { ListValue } from '../../core/lists/configurable-list.model';
import { PdfDownloadButtonComponent } from '../../shared/pdf-download-button/pdf-download-button.component';

@Component({
  selector: 'app-it-provisioning-form',
  standalone: true,
  imports: [SlicePipe, FormsModule, StatusBadgeComponent, SpinnerComponent, ModalComponent, ConfirmEmailModalComponent, PdfDownloadButtonComponent],
  templateUrl: './it-provisioning-form.component.html',
  styleUrl:    './it-provisioning-form.component.scss',
})
export class ItProvisioningFormComponent implements OnInit {
  private route       = inject(ActivatedRoute);
  private router      = inject(Router);
  private service     = inject(ItProvisioningService);
  private listService = inject(ConfigurableListService);

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

  // ── Computed ──────────────────────────────────────────────────────────────
  readonly steps = computed(() => computeSteps(this.prov()));

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

  readonly hwStatuses: { value: string; label: string }[] = [
    { value: 'NEUF',          label: 'Neuf' },
    { value: 'BON_ETAT',      label: 'Bon état' },
    { value: 'USAGE',         label: 'Usagé' },
    { value: 'EN_REPARATION', label: 'En réparation' },
    { value: 'DEFECTUEUX',    label: 'Défectueux' },
  ];

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  private provId = 0;
  protected readonly statusBadge = statusBadge;

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
        this.error.set('Impossible de charger le dossier de provisioning.');
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
    if (this.isCompleted()) return;
    this.saving.set(true);
    const assetUpdates: UpdateAssetRequest[] = this.editableAssets().map(a => ({
      id:           a.id,
      provided:     a.provided,
      serialNumber: a.serialNumber || null,
      brandModel:   a.brandModel   || null,
      assetTag:     a.assetTag     || null,
      status:       a.status       || null,
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
        this.flash('Modifications enregistrées avec succès.');
      },
      error: () => {
        this.saving.set(false);
        this.error.set("Erreur lors de l'enregistrement.");
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
        this.flash('Email MS365 soumis. Compte utilisateur créé avec succès.');
      },
      error: (err) => {
        this.submittingEmail.set(false);
        const msg = err?.error?.detail ?? err?.error?.title ?? "Erreur lors de la soumission de l'email.";
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
      id: a.id, provided: a.provided,
      serialNumber: a.serialNumber || null,
      brandModel:   a.brandModel   || null,
      assetTag:     a.assetTag     || null,
      status:       a.status       || null,
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
            this.flash('Provisioning marqué comme terminé !');
          },
          error: (err) => {
            this.completing.set(false);
            const msg = err?.error?.message ?? err?.error?.detail ?? 'Erreur lors de la finalisation.';
            this.error.set(msg);
          },
        });
      },
      error: (err) => {
        this.completing.set(false);
        this.error.set(err?.error?.message ?? "Erreur lors de l'enregistrement avant finalisation.");
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
