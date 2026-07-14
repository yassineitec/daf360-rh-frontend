import { Component, inject, input, output, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { CardComponent, StatusBadgeComponent } from '@khalilrebhiitec/daf360';
import { environment } from '../../../../../environments/environment';
import { getAvatarUrl } from '../../../../shared/utils/avatar.utils';

export interface EmployeeCardData {
  profileId:        number | null;
  fullName:         string;
  poste:            string | null;
  department:       string | null;
  discipline:       string | null;
  contractType:     string | null;
  paysLabel:        string | null;
  anciennete:       string;
  presenceStatus:   'PRESENT' | 'TELETRAVAIL' | 'ABSENT';
  photoUrl:         string | null;
  gender:           string | null;
  initials:         string;
  completionPerso:  boolean;
  completionDocs:   boolean;
  completionSkills: boolean;
}

@Component({
  selector: 'rh-employee-card',
  standalone: true,
  imports: [StatusBadgeComponent, TranslatePipe, CardComponent],
  template: `
    <daf-card [options]="{ variant: 'glass', padding: 'none', radius: 'xl', hoverable: true }">
      <div class="relative overflow-hidden p-5">

      <!-- Presence indicator (top-right) -->
      <div class="absolute top-0 right-0 p-3">
        @switch (employee().presenceStatus) {
          @case ('PRESENT') {
            <span class="flex items-center gap-1 text-[11px] font-bold text-secondary">
              <span class="w-2 h-2 rounded-full bg-secondary"></span>
              {{ 'DASHBOARD.EMPLOYEE_CARD.PRESENT' | translate }}
            </span>
          }
          @case ('TELETRAVAIL') {
            <span class="flex items-center gap-1 text-[11px] font-bold text-teal">
              <span class="material-symbols-outlined text-[14px]">home</span>
              {{ 'DASHBOARD.EMPLOYEE_CARD.REMOTE' | translate }}
            </span>
          }
          @case ('ABSENT') {
            <daf-badge
              [label]="'DASHBOARD.EMPLOYEE_CARD.ON_LEAVE' | translate"
              [options]="{ variant: 'danger', size: 'sm' }" />
          }
        }
      </div>

      <!-- Avatar + info -->
      <div class="flex items-start gap-4 mb-4">
        <div class="w-14 h-14 rounded-full border-2 border-[#79D7BE] overflow-hidden shrink-0
                    bg-surface-container flex items-center justify-center">
          @if (!avatarFailed()) {
            <img [src]="getAvatarUrl(employee().profileId, employee().photoUrl, employee().gender)"
                 [alt]="employee().fullName"
                 class="w-full h-full object-cover"
                 (error)="avatarFailed.set(true)" />
          } @else {
            <span class="text-[14px] font-bold text-on-surface-variant">
              {{ employee().initials }}
            </span>
          }
        </div>
        <div class="min-w-0">
          <h3 class="text-[14px] font-bold text-on-surface truncate">{{ employee().fullName }}</h3>
          <p class="text-[12px] text-outline truncate">
            {{ employee().discipline ?? employee().poste ?? '—' }}{{ employee().department ? ' • ' + employee().department : '' }}
          </p>
          <div class="flex items-center gap-2 mt-1 flex-wrap">
            @if (employee().contractType) {
              <span class="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5
                           rounded bg-surface-container text-on-surface-variant">
                {{ employee().contractType }}
              </span>
            }
            @if (employee().paysLabel) {
              <span class="flex items-center gap-0.5 text-[11px] text-outline">
                <span class="material-symbols-outlined text-[12px]">location_on</span>
                {{ employee().paysLabel }}
              </span>
            }
          </div>
          <p class="text-[11px] text-teal font-bold uppercase mt-1">
            {{ 'DASHBOARD.EMPLOYEE_CARD.SENIORITY' | translate }} {{ employee().anciennete }}
          </p>
        </div>
      </div>

      <!-- Profile completion grid -->
      <div class="grid grid-cols-3 gap-2 mb-4">
        @for (cell of completionCells(); track cell.key) {
          <div class="p-2 text-center">
            <p class="text-[9px] text-outline uppercase font-bold mb-1">{{ cell.key | translate }}</p>
            <span class="material-symbols-outlined text-[16px]"
              [class]="cell.ok ? 'text-secondary' : 'text-error'">
              {{ cell.ok ? 'check_circle' : 'cancel' }}
            </span>
          </div>
        }
      </div>

      <!-- Action buttons -->
      <div class="flex gap-2">
        <button
          type="button"
          class="flex-1 py-2 bg-teal text-white rounded-lg text-[13px] font-semibold
                 hover:opacity-90 transition-opacity"
          (click)="viewProfile.emit(employee().profileId)">
          {{ 'DASHBOARD.EMPLOYEE_CARD.VIEW_PROFILE' | translate }}
        </button>
        <button
          type="button"
          class="px-3 py-2 border border-outline-variant rounded-lg hover:bg-surface-container
                 transition-colors"
          (click)="moreActions.emit(employee().profileId)">
          <span class="material-symbols-outlined text-[16px] text-on-surface-variant">
            more_horiz
          </span>
        </button>
      </div>
      </div>
    </daf-card>
  `,
})
export class EmployeeCardComponent {
  readonly employee     = input.required<EmployeeCardData>();
  readonly avatarFailed = signal(false);
  readonly viewProfile = output<number | null>();
  readonly moreActions = output<number | null>();
  readonly getAvatarUrl = getAvatarUrl;

  resolvePhoto(url: string | null): string | null {
    if (!url) return null;
    if (url.startsWith('/api/')) return environment.hrApiUrl + url;
    return url;
  }

  completionCells() {
    const e = this.employee();
    return [
      { key: 'DASHBOARD.EMPLOYEE_CARD.COMPLETION_PERSO',  ok: e.completionPerso },
      { key: 'DASHBOARD.EMPLOYEE_CARD.COMPLETION_DOCS',   ok: e.completionDocs },
      { key: 'DASHBOARD.EMPLOYEE_CARD.COMPLETION_SKILLS', ok: e.completionSkills },
    ];
  }
}
