import { Component, input } from '@angular/core';
import { StatusBadgeComponent, ProgressBarComponent } from '@khalilrebhiitec/daf360';
import { EmployeeProfile } from '../../../models/profile.model';

@Component({
  selector: 'rh-profile-sidebar-info',
  standalone: true,
  imports: [StatusBadgeComponent, ProgressBarComponent],
  template: `
    <div class="space-y-5">

      <!-- Section: Contact -->
      <div class="bg-white border border-outline-variant rounded-xl p-5">
        <h3 class="text-[13px] font-bold text-outline uppercase tracking-wider mb-3">
          Contact
        </h3>
        <div class="space-y-3">
          @if (profile().personalEmail) {
            <div class="flex items-start gap-2">
              <span class="material-symbols-outlined text-[16px] text-outline mt-0.5">mail</span>
              <div class="min-w-0">
                <p class="text-[11px] text-outline">Email pro</p>
                <p class="text-[13px] text-on-surface truncate">
                  {{ profile().personalEmail ?? '—' }}
                </p>
              </div>
            </div>
          }
          @if (profile().phone) {
            <div class="flex items-start gap-2">
              <span class="material-symbols-outlined text-[16px] text-outline mt-0.5">phone</span>
              <div>
                <p class="text-[11px] text-outline">Téléphone</p>
                <p class="text-[13px] text-on-surface">{{ profile().phone }}</p>
              </div>
            </div>
          }
          @if (profile().homeAddress) {
            <div class="flex items-start gap-2">
              <span class="material-symbols-outlined text-[16px] text-outline mt-0.5 flex-shrink-0">
                location_on
              </span>
              <div class="min-w-0">
                <p class="text-[11px] text-outline">Adresse</p>
                <p class="text-[13px] text-on-surface line-clamp-2">{{ profile().homeAddress }}</p>
              </div>
            </div>
          }
          @if (profile().dateOfBirth) {
            <div class="flex items-start gap-2">
              <span class="material-symbols-outlined text-[16px] text-outline mt-0.5">cake</span>
              <div>
                <p class="text-[11px] text-outline">Date de naissance</p>
                <p class="text-[13px] text-on-surface">{{ fmt(profile().dateOfBirth) }}</p>
              </div>
            </div>
          }
        </div>
      </div>

      <!-- Section: Contact d'Urgence -->
      @if (profile().emergencyContactName) {
        <div class="bg-white border border-outline-variant rounded-xl p-5">
          <h3 class="text-[13px] font-bold text-outline uppercase tracking-wider mb-3">
            Contact d'Urgence
          </h3>
          <div class="space-y-1">
            <p class="font-semibold text-[14px] text-on-surface">
              {{ profile().emergencyContactName }}
            </p>
            @if (profile().emergencyContactRelation) {
              <p class="text-[13px] text-outline">{{ profile().emergencyContactRelation }}</p>
            }
            @if (profile().emergencyContactPhone) {
              <div class="flex items-center gap-1 mt-2 text-[13px] text-on-surface">
                <span class="material-symbols-outlined text-[14px] text-outline">phone</span>
                {{ profile().emergencyContactPhone }}
              </div>
            }
          </div>
        </div>
      }

      <!-- Section: Informations Rapides -->
      <div class="bg-white border border-outline-variant rounded-xl p-5">
        <h3 class="text-[13px] font-bold text-outline uppercase tracking-wider mb-3">
          Informations Rapides
        </h3>
        <div class="space-y-3">

          <!-- Onboarding -->
          <div>
            <p class="text-[11px] text-outline mb-1">Onboarding</p>
            @if (profile().onboardingCompleted) {
              <daf-badge label="Complété" [options]="{ variant: 'success' }" />
            } @else {
              <daf-progress-bar
                label="Onboarding"
                [value]="50"
                [options]="{ variant: 'teal', size: 'sm' }" />
            }
          </div>

          <!-- Probation -->
          @if (profile().isOnProbation) {
            <div>
              <p class="text-[11px] text-outline mb-1">Période d'essai</p>
              <daf-badge label="En période d'essai" [options]="{ variant: 'warning' }" />
              @if (profile().probationEndDate) {
                <p class="text-[11px] text-outline mt-1">
                  Fin: {{ fmt(profile().probationEndDate) }}
                </p>
              }
            </div>
          }

          <!-- CNSS -->
          @if (profile().cnssNumber) {
            <div>
              <p class="text-[11px] text-outline">CNSS</p>
              <p class="text-[13px] font-medium text-on-surface">{{ profile().cnssNumber }}</p>
            </div>
          }

          <!-- Situation familiale -->
          @if (profile().maritalStatus) {
            <div>
              <p class="text-[11px] text-outline">Situation</p>
              <p class="text-[13px] text-on-surface">
                {{ profile().maritalStatus }}
                @if (profile().numberOfChildren != null) {
                  — {{ profile().numberOfChildren }} enfant(s)
                }
              </p>
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class ProfileSidebarInfoComponent {
  profile = input.required<EmployeeProfile>();

  fmt(iso: string | null | undefined): string {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString('fr-FR'); }
    catch { return iso; }
  }
}
