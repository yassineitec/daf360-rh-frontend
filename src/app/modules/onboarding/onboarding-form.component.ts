import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Observable, forkJoin, of, catchError } from 'rxjs';

import { CardComponent, ButtonComponent } from '@khalilrebhiitec/daf360';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { OnboardingService } from './onboarding.service';
import {
  OnboardingFormData,
  OnboardingProfileDto,
  STEPS,
} from './onboarding.model';
import { StepIdentityComponent } from './steps/step-identity.component';
import { StepContractComponent } from './steps/step-contract.component';
import { StepRegimeComponent } from './steps/step-regime.component';
import { StepPersonalComponent } from './steps/step-personal.component';
import { StepBankComponent } from './steps/step-bank.component';
import { StepEmergencyComponent } from './steps/step-emergency.component';
import { StepSummaryComponent } from './steps/step-summary.component';
import { ConfirmSubmitModalComponent } from './confirm-submit-modal.component';
import { SpinnerComponent } from '../../shared/spinner.component';
import { isFemale } from '../../shared/utils/avatar.utils';
import { NotificationService } from '../../core/notification.service';

@Component({
  selector: 'app-onboarding-form',
  standalone: true,
  imports: [
    CardComponent,
    ButtonComponent,
    FormsModule,
    StepIdentityComponent,
    StepContractComponent,
    StepRegimeComponent,
    StepPersonalComponent,
    StepBankComponent,
    StepEmergencyComponent,
    StepSummaryComponent,
    ConfirmSubmitModalComponent,
    SpinnerComponent,
    TranslatePipe,
  ],
  templateUrl: './onboarding-form.component.html',
  styleUrl: './onboarding-form.component.scss',
})
export class OnboardingFormComponent implements OnInit {
  private route   = inject(ActivatedRoute);
  private router  = inject(Router);
  private service = inject(OnboardingService);
  private translate = inject(TranslateService);
  private notify  = inject(NotificationService);

  /** Photo picked in step 1, held in memory; uploaded after the profile is created. */
  readonly selectedPhoto = signal<File | null>(null);
  /** RIB/bank attestation picked in the bank step; uploaded after the profile is created. */
  readonly selectedCertification = signal<File | null>(null);

  // State
  candidateId      = signal(0);
  currentStep      = signal(1);
  formData         = signal<OnboardingFormData | null>(null);
  draftData        = signal<OnboardingProfileDto>({});
  loading          = signal(true);
  saving           = signal(false);
  submitting       = signal(false);
  showConfirmModal = signal(false);
  error            = signal<string | null>(null);
  successMsg       = signal<string | null>(null);

  // Constants
  readonly STEPS = computed(() => {
    this.translate.currentLang();
    return STEPS.map(s => ({
      number: s.number,
      label: this.translate.instant('ONBOARDING.STEPS.' + s.key.toUpperCase()),
    }));
  });
  readonly totalSteps = 7;

  // Computed
  readonly ms365Email  = computed(() => this.formData()?.ms365Email ?? '');
  readonly firstName   = computed(() => this.draftData().firstName  ?? this.formData()?.firstName ?? '');
  readonly lastName    = computed(() => this.draftData().lastName   ?? this.formData()?.lastName  ?? '');
  readonly hasDraft    = computed(() => this.formData()?.hasDraft   ?? false);
  readonly draftSavedAt = computed(() => this.formData()?.draftSavedAt ?? null);

  // Profile photo card
  readonly photoFailed = signal(false);
  /** Data-URL preview of a picked photo — overrides the placeholder avatar in the card. */
  readonly photoPreview = signal<string | null>(null);

  resolvePhoto(fd: OnboardingFormData): string {
    return isFemale(fd.gender)
      ? '/images/avatars/female.png'
      : '/images/avatars/male.png';
  }

  /**
   * Photo picked via the candidate card. Validated client-side (same rules as the
   * profile page), previewed in-memory, and held in `selectedPhoto` for upload after
   * the profile is created. Warns that it's only persisted once onboarding completes.
   */
  onPhotoChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) { this.notify.error(this.translate.instant('PROFILES.PHOTO.ERR_FORMAT')); input.value = ''; return; }
    if (file.size > 3 * 1024 * 1024)  { this.notify.error(this.translate.instant('PROFILES.PHOTO.ERR_SIZE'));   input.value = ''; return; }
    const reader = new FileReader();
    reader.onload = () => this.photoPreview.set(reader.result as string);
    reader.readAsDataURL(file);
    this.selectedPhoto.set(file);
    this.photoFailed.set(false);
    this.notify.warning(this.translate.instant('ONBOARDING.FORM.PHOTO_WARNING'));
  }

  candidateInitials(fd: OnboardingFormData): string {
    return ((fd.firstName ?? '')[0] ?? '').toUpperCase()
         + ((fd.lastName  ?? '')[0] ?? '').toUpperCase();
  }

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('candidateId'));
    this.candidateId.set(id);

    this.service.getOnboardingForm(id).subscribe({
      next: (data) => {
        this.formData.set(data);
        this.draftData.set({
          // Identity
          firstName:               data.firstName,
          lastName:                data.lastName,
          dateOfBirth:             data.dateOfBirth             ?? undefined,
          nationality:             data.nationality             ?? undefined,
          nationalityId:           data.nationalityId           ?? undefined,
          nationalId:              data.nationalId              ?? undefined,
          gender:                  data.gender                  ?? undefined,
          passportNumber:          data.passportNumber          ?? undefined,
          phone:                   data.phone                   ?? undefined,
          // Employment
          contractType:            data.contractType            ?? undefined,
          hireDate:                data.hireDate                ?? undefined,
          contractEndDate:         data.contractEndDate         ?? undefined,
          probationEndDate:        data.probationEndDate        ?? undefined,
          isOnProbation:           data.isOnProbation           ?? false,
          // Dimension FK IDs (for dropdowns)
          gradeId:                 data.gradeId                 ?? undefined,
          disciplineId:            data.disciplineId            ?? undefined,
          nogLevelId:              data.nogLevelId              ?? undefined,
          departmentId:            data.departmentId            ?? undefined,
          // Regime
          regimeTemplateId:        data.selectedRegimeId        ?? undefined,
          // Personal & Social
          cnssNumber:              data.cnssNumber              ?? undefined,
          cnssAffiliationDate:     data.cnssAffiliationDate     ?? undefined,
          maritalStatus:           data.maritalStatus           ?? undefined,
          numberOfChildren:        data.numberOfChildren        ?? undefined,
          personalAddress:         data.personalAddress         ?? undefined,
          // Bank / RIB
          bankId:                  data.bankId                  ?? undefined,
          bankName:                data.bankName                ?? undefined,
          bankAccountNumber:       data.bankAccountNumber       ?? undefined,
          rib:                     data.rib                     ?? undefined,
          iban:                    data.iban                    ?? undefined,
          socialSecurityNumber:    data.socialSecurityNumber    ?? undefined,
          taxId:                   data.taxId                   ?? undefined,
          // Emergency contact
          emergencyContactName:    data.emergencyContactName    ?? undefined,
          emergencyContactRelation: data.emergencyContactRelation ?? undefined,
          emergencyContactPhone:   data.emergencyContactPhone   ?? undefined,
        });
        this.loading.set(false);
      },
      error: () => {
        this.error.set(this.translate.instant('ONBOARDING.FORM.ERR_LOAD_FORM'));
        this.loading.set(false);
      },
    });
  }

  onStepChanged(partial: Partial<OnboardingProfileDto>): void {
    this.draftData.update(d => ({ ...d, ...partial }));
  }

  nextStep(): void {
    if (this.currentStep() < this.totalSteps) {
      this.currentStep.update(s => s + 1);
    }
  }

  prevStep(): void {
    if (this.currentStep() > 1) {
      this.currentStep.update(s => s - 1);
    }
  }

  goToStep(n: number): void {
    this.currentStep.set(n);
  }

  onSaveDraft(): void {
    this.saving.set(true);
    this.service.saveDraft(this.candidateId(), this.draftData()).subscribe({
      next: () => {
        this.saving.set(false);
        this.flash(this.translate.instant('ONBOARDING.FORM.DRAFT_SAVED'));
      },
      error: () => {
        this.saving.set(false);
        this.error.set(this.translate.instant('ONBOARDING.FORM.ERR_SAVE_DRAFT'));
      },
    });
  }

  openConfirmModal(): void {
    const d = this.draftData();
    if (!d.hireDate) {
      this.error.set(this.translate.instant('ONBOARDING.FORM.ERR_HIRE_DATE_REQUIRED'));
      this.currentStep.set(2);
      return;
    }
    if (!d.contractType) {
      this.error.set(this.translate.instant('ONBOARDING.FORM.ERR_CONTRACT_REQUIRED'));
      this.currentStep.set(2);
      return;
    }
    if (!d.regimeTemplateId) {
      this.error.set(this.translate.instant('ONBOARDING.FORM.ERR_REGIME_REQUIRED'));
      this.currentStep.set(3);
      return;
    }
    if (!d.cnssNumber) {
      this.error.set(this.translate.instant('ONBOARDING.FORM.ERR_CNSS_REQUIRED'));
      this.currentStep.set(4);
      return;
    }
    if (!d.rib) {
      this.error.set(this.translate.instant('ONBOARDING.FORM.ERR_RIB_REQUIRED'));
      this.currentStep.set(5);
      return;
    }
    if (!this.selectedCertification()) {
      this.error.set(this.translate.instant('ONBOARDING.FORM.ERR_CERT_REQUIRED'));
      this.currentStep.set(5);
      return;
    }
    this.error.set(null);
    this.showConfirmModal.set(true);
  }

  onSubmitConfirmed(): void {
    this.submitting.set(true);
    this.service.completeProfile(this.candidateId(), this.draftData()).subscribe({
      next: (result) => {
        this.showConfirmModal.set(false);
        // Profile now exists — upload the in-memory attachments (photo + RIB attestation)
        // if picked, then navigate. Upload failures are non-blocking: the profile was
        // created either way; the HR can re-attach from the profile page.
        const pid = result.employeeProfileId;
        const photo = this.selectedPhoto();
        const cert  = this.selectedCertification();
        let failed = false;
        const uploads: Observable<unknown>[] = [];
        if (photo && pid) uploads.push(this.service.uploadPhoto(pid, photo).pipe(catchError(() => { failed = true; return of(null); })));
        if (cert && pid)  uploads.push(this.service.uploadDocument(pid, cert, 'RIB').pipe(catchError(() => { failed = true; return of(null); })));

        if (!uploads.length) {
          this.submitting.set(false);
          this.goToSuccess(result);
          return;
        }
        forkJoin(uploads).subscribe(() => {
          this.submitting.set(false);
          if (failed) this.notify.warning(this.translate.instant('ONBOARDING.FORM.UPLOAD_PARTIAL_FAILED'));
          this.goToSuccess(result);
        });
      },
      error: (err) => {
        this.submitting.set(false);
        this.showConfirmModal.set(false);
        const msg = err?.error?.detail ?? err?.error?.title ?? this.translate.instant('ONBOARDING.FORM.ERR_CREATE');
        this.error.set(msg);
      },
    });
  }

  private goToSuccess(result: { employeeProfileId: number; userId: number; ms365Email: string }): void {
    this.router.navigate(['../success'], {
      relativeTo: this.route,
      queryParams: {
        profileId:  result.employeeProfileId,
        userId:     result.userId,
        ms365Email: result.ms365Email,
        fullName:   this.firstName() + ' ' + this.lastName(),
      },
    });
  }

  private flash(msg: string): void {
    this.successMsg.set(msg);
    setTimeout(() => this.successMsg.set(null), 3500);
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return '—';
    return value.slice(0, 10);
  }

  goBack(): void {
    this.router.navigate(['../'], { relativeTo: this.route });
  }
}
