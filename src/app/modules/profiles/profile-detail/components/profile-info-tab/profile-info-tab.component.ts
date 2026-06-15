import { Component, input } from '@angular/core';
import { StatusBadgeComponent } from '@khalilrebhiitec/daf360';
import { EmployeeProfile } from '../../../models/profile.model';

@Component({
  selector: 'rh-profile-info-tab',
  standalone: true,
  imports: [StatusBadgeComponent],
  template: `
    <div class="grid grid-cols-1 gap-6">

      <!-- Identité -->
      <div class="bg-white border border-outline-variant rounded-xl p-6">
        <div class="flex items-center gap-2 mb-5">
          <span class="material-symbols-outlined text-[20px] text-primary">person</span>
          <h3 class="font-bold text-[16px] text-on-surface">Identité</h3>
        </div>
        <div class="grid grid-cols-2 gap-x-8 gap-y-4">
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-wide text-outline">
              Nom complet
            </p>
            <p class="text-[14px] font-medium text-on-surface mt-0.5">
              {{ profile().fullName ?? '—' }}
            </p>
          </div>
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-wide text-outline">
              Matricule
            </p>
            <p class="text-[14px] font-medium text-on-surface mt-0.5">
              {{ profile().matricule ?? '—' }}
            </p>
          </div>
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-wide text-outline mb-1">Genre</p>
            @if (profile().gender) {
              <daf-badge
                [label]="profile().gender!"
                [options]="{ variant: profile().gender === 'MASCULIN' ? 'primary' : 'secondary', size: 'sm' }" />
            } @else {
              <p class="text-[14px] text-on-surface">—</p>
            }
          </div>
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-wide text-outline">Nationalité</p>
            <p class="text-[14px] font-medium text-on-surface mt-0.5">
              {{ profile().nationality ?? '—' }}
            </p>
          </div>
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-wide text-outline">Date de naissance</p>
            <p class="text-[14px] font-medium text-on-surface mt-0.5">{{ fmt(profile().dateOfBirth) }}</p>
          </div>
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-wide text-outline">Situation</p>
            <p class="text-[14px] font-medium text-on-surface mt-0.5">
              {{ profile().maritalStatus ?? '—' }}
            </p>
          </div>
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-wide text-outline">Enfants</p>
            <p class="text-[14px] font-medium text-on-surface mt-0.5">
              {{ profile().numberOfChildren ?? '—' }}
            </p>
          </div>
        </div>
      </div>

      <!-- Coordonnées personnelles -->
      <div class="bg-white border border-outline-variant rounded-xl p-6">
        <div class="flex items-center gap-2 mb-5">
          <span class="material-symbols-outlined text-[20px] text-primary">contact_mail</span>
          <h3 class="font-bold text-[16px] text-on-surface">Coordonnées personnelles</h3>
        </div>
        <div class="grid grid-cols-2 gap-x-8 gap-y-4">
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-wide text-outline">Email personnel</p>
            <p class="text-[14px] font-medium text-on-surface mt-0.5 break-all">
              {{ profile().personalEmail ?? '—' }}
            </p>
          </div>
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-wide text-outline">Téléphone</p>
            <p class="text-[14px] font-medium text-on-surface mt-0.5">{{ profile().phone ?? '—' }}</p>
          </div>
          <div class="col-span-2">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-outline">Adresse</p>
            <p class="text-[14px] font-medium text-on-surface mt-0.5">
              {{ profile().homeAddress ?? '—' }}
            </p>
          </div>
        </div>
      </div>

      <!-- Affectation -->
      <div class="bg-white border border-outline-variant rounded-xl p-6">
        <div class="flex items-center gap-2 mb-5">
          <span class="material-symbols-outlined text-[20px] text-primary">work</span>
          <h3 class="font-bold text-[16px] text-on-surface">Affectation</h3>
        </div>

        @if (hasMissingPositionData()) {
          <div class="flex items-start gap-2 bg-warning-container/20 border border-[#e08c00]/30
                      rounded-lg p-3 mb-4 text-[13px] text-[#7a4f00]">
            <span class="material-symbols-outlined text-[16px] mt-0.5">info</span>
            <span>
              Les informations de poste seront disponibles après la migration V23.
            </span>
          </div>
        }

        <div class="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-4">
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-wide text-outline">Département</p>
            <p class="text-[14px] font-medium text-on-surface mt-0.5">{{ profile().department ?? '—' }}</p>
          </div>
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-wide text-outline">Grade</p>
            <p class="text-[14px] font-medium text-on-surface mt-0.5">{{ profile().grade ?? '—' }}</p>
          </div>
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-wide text-outline">Discipline</p>
            <p class="text-[14px] font-medium text-on-surface mt-0.5">{{ profile().discipline ?? '—' }}</p>
          </div>
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-wide text-outline">Niveau NOG</p>
            <p class="text-[14px] font-medium text-on-surface mt-0.5">{{ profile().nogLevel ?? '—' }}</p>
          </div>
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-wide text-outline">Pays</p>
            <p class="text-[14px] font-medium text-on-surface mt-0.5">{{ profile().paysId }}</p>
          </div>
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-wide text-outline">Régime</p>
            <p class="text-[14px] font-medium text-on-surface mt-0.5">
              {{ profile().regimeTemplateId ? '#' + profile().regimeTemplateId : 'Standard' }}
            </p>
          </div>
        </div>
      </div>

    </div>
  `,
})
export class ProfileInfoTabComponent {
  profile = input.required<EmployeeProfile>();

  hasMissingPositionData(): boolean {
    const p = this.profile();
    return !p.department || !p.grade || !p.discipline || !p.nogLevel;
  }

  fmt(iso: string | null | undefined): string {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString('fr-FR'); }
    catch { return iso; }
  }
}
