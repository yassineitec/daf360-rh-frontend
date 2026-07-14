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

// Same glass-card recipe as /finance/affaires' grid-view card (aff-card):
// badge pinned top-right, icon/avatar + ref + name header, row-separated
// info list, and a green pill CTA that's hidden until the card is hovered.
@Component({
  selector: 'rh-employee-card',
  standalone: true,
  imports: [StatusBadgeComponent, TranslatePipe, CardComponent],
  template: `
    <daf-card [options]="{ variant: 'glass', padding: 'none', radius: 'xl', hoverable: true, clickable: true }"
              (click)="viewProfile.emit(employee().profileId)">
      <div class="emp-card">

        <!-- Presence indicator (top-right) -->
        <div class="emp-card__badge-pos">
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

        <!-- Avatar + name -->
        <div class="emp-card__header">
          <div class="emp-card__id-block">
            <div class="emp-card__avatar">
              @if (!avatarFailed()) {
                <img [src]="getAvatarUrl(employee().profileId, employee().photoUrl, employee().gender)"
                     [alt]="employee().fullName"
                     class="w-full h-full object-cover"
                     (error)="avatarFailed.set(true)" />
              } @else {
                <span class="text-[13px] font-bold text-on-surface-variant">{{ employee().initials }}</span>
              }
            </div>
            <div class="min-w-0">
              @if (employee().contractType) {
                <span class="emp-card__ref">{{ employee().contractType }}</span>
              }
              <h5 class="emp-card__name">{{ employee().fullName }}</h5>
            </div>
          </div>
        </div>

        <!-- Info rows -->
        <div class="emp-card__body">
          <div class="emp-card__row">
            <span class="emp-card__row-label">{{ 'DASHBOARD.EMPLOYEE_CARD.ROLE' | translate }}</span>
            <span class="emp-card__row-val truncate">
              {{ employee().discipline ?? employee().poste ?? '—' }}{{ employee().department ? ' • ' + employee().department : '' }}
            </span>
          </div>
          @if (employee().paysLabel) {
            <div class="emp-card__row">
              <span class="emp-card__row-label">{{ 'DASHBOARD.EMPLOYEE_CARD.COUNTRY' | translate }}</span>
              <span class="emp-card__row-val flex items-center gap-1">
                <span class="material-symbols-outlined text-[13px]">location_on</span>
                {{ employee().paysLabel }}
              </span>
            </div>
          }
          <div class="emp-card__row emp-card__row--last">
            <span class="emp-card__row-label">{{ 'DASHBOARD.EMPLOYEE_CARD.SENIORITY' | translate }}</span>
            <span class="emp-card__row-val emp-card__row-val--teal">{{ employee().anciennete }}</span>
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

        <button
          type="button"
          class="emp-card__cta"
          (click)="viewProfile.emit(employee().profileId); $event.stopPropagation()">
          <span class="material-symbols-outlined">arrow_forward</span>
          {{ 'DASHBOARD.EMPLOYEE_CARD.VIEW_PROFILE' | translate }}
        </button>
      </div>
    </daf-card>
  `,
  styles: [`
    .emp-card {
      position: relative;
      overflow: hidden;
      padding: 20px;
      display: flex;
      flex-direction: column;
      cursor: pointer;
      height: 100%;

      &:hover .emp-card__cta { opacity: 1; }
    }

    .emp-card__badge-pos {
      position: absolute;
      top: 12px;
      right: 12px;
    }

    .emp-card__header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;
      margin-top: 20px;
    }

    .emp-card__id-block { display: flex; align-items: center; gap: 10px; }

    .emp-card__avatar {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      border: 2px solid #79D7BE;
      overflow: hidden;
      flex-shrink: 0;
      background: var(--color-surface-container);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .emp-card__ref {
      display: block;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: #006b58;
      margin-bottom: 2px;
    }

    .emp-card__name {
      font-size: 14px;
      font-weight: 700;
      line-height: 20px;
      color: var(--color-on-surface);
      margin: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 100%;
    }

    .emp-card__body { display: flex; flex-direction: column; gap: 10px; flex: 1; margin-bottom: 16px; }

    .emp-card__row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--color-surface-container);
    }

    .emp-card__row--last { border-bottom: none; padding-bottom: 0; }

    .emp-card__row-label { font-size: 11px; font-weight: 400; color: var(--color-outline); flex-shrink: 0; }

    .emp-card__row-val {
      font-size: 13px;
      font-weight: 600;
      color: var(--color-on-surface);
      text-align: right;
    }

    .emp-card__row-val--teal { color: #006b58; font-weight: 700; text-transform: uppercase; font-size: 11px; }

    .emp-card__cta {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      padding: 11px;
      border-radius: 14px;
      border: none;
      background: #006b58;
      color: #fff;
      font-size: 13px;
      font-weight: 700;
      font-family: inherit;
      cursor: pointer;
      opacity: 0;
      box-shadow: 0 6px 16px rgba(0, 107, 88, 0.25);
      transition: opacity 0.2s, box-shadow 0.15s, transform 0.15s;

      .material-symbols-outlined { font-size: 16px; }

      &:hover { box-shadow: 0 10px 20px rgba(0, 107, 88, 0.30); }
      &:active { transform: scale(0.98); }

      @media (max-width: 768px) { opacity: 1; }
    }
  `],
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
