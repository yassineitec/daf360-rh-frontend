import { Component, input, output } from '@angular/core';
import { StatusBadgeComponent } from '@khalilrebhiitec/daf360';
import type { BadgeOptions } from '@khalilrebhiitec/daf360';
import { EmployeeProfile, LifecycleStatus, LIFECYCLE_LABELS } from '../../../models/profile.model';
import { environment } from '../../../../../../environments/environment';

@Component({
  selector: 'rh-profile-header',
  standalone: true,
  imports: [StatusBadgeComponent],
  template: `
    <div class="bg-white border-b border-outline-variant px-8 py-6">

      <!-- Breadcrumb -->
      <div class="flex items-center gap-2 text-[13px] text-outline mb-4">
        <button
          class="flex items-center gap-1 hover:text-on-surface transition-colors"
          (click)="backClick.emit()">
          <span class="material-symbols-outlined text-[16px]">chevron_left</span>
          Retour
        </button>
        <span>/</span>
        <span>Profils</span>
        <span>/</span>
        <span class="text-on-surface font-medium truncate max-w-[200px]">
          {{ profile().fullName ?? '—' }}
        </span>
      </div>

      <!-- Main header row -->
      <div class="flex items-start gap-6">

        <!-- Avatar -->
        <div class="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0
                    border-2 bg-surface-container"
             style="border-color:#79D7BE">
          @if (resolvedPhotoUrl()) {
            <img [src]="resolvedPhotoUrl()!" [alt]="profile().fullName ?? ''"
                 class="w-full h-full object-cover" />
          } @else {
            <div class="w-full h-full flex items-center justify-center
                        text-[20px] font-bold text-on-surface-variant">
              {{ initials() }}
            </div>
          }
        </div>

        <!-- Info block -->
        <div class="flex-1 min-w-0">
          <h1 class="text-[24px] font-bold text-on-surface leading-tight">
            {{ profile().fullName ?? '—' }}
          </h1>
          <div class="flex items-center gap-2 text-[14px] text-outline mt-1 flex-wrap">
            <span>{{ profile().matricule ?? '—' }}</span>
            @if (profile().grade) {
              <span class="text-outline-variant">•</span>
              <span>{{ profile().grade }}</span>
            }
            @if (profile().department) {
              <span class="text-outline-variant">•</span>
              <span>{{ profile().department }}</span>
            }
          </div>
          <div class="flex items-center gap-4 mt-2 flex-wrap">
            @if (profile().paysId) {
              <span class="flex items-center gap-1 text-[13px] text-outline">
                <span class="material-symbols-outlined text-[14px]">location_on</span>
                {{ paysLabel() }}
              </span>
            }
            @if (profile().hireDate) {
              <span class="flex items-center gap-1 text-[13px] text-outline">
                <span class="material-symbols-outlined text-[14px]">calendar_today</span>
                Depuis {{ fmt(profile().hireDate) }}
              </span>
            }
            <daf-badge
              [label]="lifecycleLabel()"
              [options]="lifecycleBadgeOptions()" />
          </div>
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-3 flex-shrink-0">
          <button
            class="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold
                   border border-[#1b3a4b] text-[#1b3a4b] hover:bg-[#1b3a4b] hover:text-white
                   transition-colors"
            (click)="editClick.emit()">
            <span class="material-symbols-outlined text-[16px]">edit</span>
            Modifier
          </button>
          <button
            class="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold
                   bg-[#1b3a4b] text-white hover:opacity-90 transition-opacity">
            Actions
            <span class="material-symbols-outlined text-[16px]">expand_more</span>
          </button>
        </div>
      </div>
    </div>
  `,
})
export class ProfileHeaderComponent {
  profile   = input.required<EmployeeProfile>();
  editClick = output<void>();
  backClick = output<void>();

  resolvedPhotoUrl(): string | null {
    if (!this.profile().photoUrl) return null;
    return `${environment.hrApiUrl}/api/hr/profiles/${this.profile().id}/photo`;
  }

  initials(): string {
    return (this.profile().fullName ?? '')
      .split(' ')
      .slice(0, 2)
      .map(p => p[0]?.toUpperCase() ?? '')
      .join('');
  }

  lifecycleLabel(): string {
    return LIFECYCLE_LABELS[this.profile().lifecycleStatus as LifecycleStatus]
      ?? this.profile().lifecycleStatus;
  }

  lifecycleBadgeOptions(): BadgeOptions {
    const map: Record<string, BadgeOptions> = {
      ACTIVE:         { variant: 'success' },
      PRE_ONBOARDING: { variant: 'info' },
      ON_LEAVE:       { variant: 'warning' },
      ON_MISSION:     { variant: 'info' },
      OFFBOARDING:    { variant: 'warning' },
      TERMINATED:     { variant: 'danger' },
      ARCHIVED:       { variant: 'neutral' },
    };
    return map[this.profile().lifecycleStatus] ?? { variant: 'neutral' };
  }

  paysLabel(): string {
    const p = this.profile();
    return (p as any)['paysLabel'] ?? p.nationality ?? `Pays #${p.paysId}`;
  }

  fmt(iso: string | null | undefined): string {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString('fr-FR'); }
    catch { return iso; }
  }
}
