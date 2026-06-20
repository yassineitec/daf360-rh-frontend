import { Component, computed, input, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { getAvatarUrl } from '../../../../shared/utils/avatar.utils';

export interface ProbationAlert {
  profileId:       number;
  fullName:        string;
  photoUrl:        string | null;
  finPeriodeEssai: string;
  joursRestants:   number;
  department:      string | null;
  roleName:        string | null;
  gender:          string | null;
}

export interface MissingDocAlert {
  profileId:   number;
  fullName:    string;
  missingDocs: ('CONTRACT' | 'ID_CARD' | 'RIB')[];
  urgency:     'HIGH' | 'MEDIUM' | 'LOW';
}

const VISIBLE_LIMIT = 2;

@Component({
  selector: 'rh-alert-card',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div class="bg-white p-5 rounded-xl border border-outline-variant shadow-sm h-full">

      <!-- Header -->
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-[14px] font-bold text-on-surface">
          {{ 'DASHBOARD.ALERT_CARD.TITLE' | translate }}
        </h3>
        <span class="material-symbols-outlined text-red-500 text-[20px]">report</span>
      </div>

      <!-- Fin de période d'essai -->
      <div class="bg-red-50 rounded-lg p-3 mb-3">
        <div class="flex items-center justify-between mb-2">
          <p class="text-[12px] font-bold text-red-700 uppercase">
            {{ 'DASHBOARD.ALERT_CARD.PROBATION_TITLE' | translate }}
          </p>
          @if (probationExtra() > 0) {
            <span class="text-[11px] font-bold bg-red-600 text-white px-2 py-0.5 rounded-full leading-none">
              +{{ probationExtra() }}
            </span>
          }
        </div>

        @if (probationAlerts().length === 0) {
          <p class="text-[13px] text-red-400">
            {{ 'DASHBOARD.ALERT_CARD.PROBATION_EMPTY' | translate }}
          </p>
        }

        @for (alert of probationVisible(); track alert.profileId) {
          <div class="flex items-center gap-3 py-2 border-b border-red-100 last:border-0">
            <!-- Avatar -->
            <div class="w-8 h-8 rounded-full bg-red-100 overflow-hidden shrink-0
                        flex items-center justify-center text-[10px] font-bold text-red-600">
              @if (!probationFailed().has(alert.profileId)) {
                <img [src]="getAvatarUrl(alert.profileId, alert.photoUrl, alert.gender)"
                     [alt]="alert.fullName"
                     class="w-full h-full object-cover"
                     (error)="onProbationError(alert.profileId)" />
              } @else {
                {{ initials(alert.fullName) }}
              }
            </div>

            <!-- Info -->
            <div class="flex-1 min-w-0">
              <p class="text-[13px] font-semibold text-red-800 truncate">{{ alert.fullName }}</p>
              <p class="text-[11px] text-red-500 truncate">
                {{ alert.roleName ?? alert.department ?? '—' }}
                @if (alert.department && alert.roleName) { • {{ alert.department }} }
              </p>
            </div>

            <!-- Days chip -->
            <span [class]="daysChipClass(alert.joursRestants)"
                  class="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full">
              J–{{ alert.joursRestants }}
            </span>
          </div>
        }
      </div>

      <!-- Documents manquants -->
      <div class="bg-surface-container rounded-lg p-3">
        <div class="flex items-center justify-between mb-2">
          <p class="text-[12px] font-bold text-on-surface">
            {{ 'DASHBOARD.ALERT_CARD.MISSING_DOCS_TITLE' | translate }}
          </p>
          @if (missingDocsExtra() > 0) {
            <span class="text-[11px] font-bold bg-on-surface text-surface px-2 py-0.5 rounded-full leading-none">
              +{{ missingDocsExtra() }}
            </span>
          }
        </div>

        @if (missingDocsAlerts().length === 0) {
          <p class="text-[13px] text-outline">
            {{ 'DASHBOARD.ALERT_CARD.MISSING_DOCS_EMPTY' | translate }}
          </p>
        }

        @for (doc of missingDocsVisible(); track doc.profileId) {
          <div class="flex items-center justify-between py-1.5 border-b border-outline-variant last:border-0">
            <div class="min-w-0">
              <span class="text-[13px] text-on-surface font-medium truncate block">{{ doc.fullName }}</span>
              <span class="text-[11px] text-outline">{{ docTypesLabel(doc.missingDocs) }}</span>
            </div>
            <span [class]="urgencyClass(doc.urgency)"
                  class="shrink-0 ml-2 text-[10px] font-bold px-2 py-0.5 rounded">
              {{ urgencyLabel(doc.urgency) }}
            </span>
          </div>
        }
      </div>
    </div>
  `,
})
export class AlertCardComponent {
  readonly probationAlerts   = input.required<ProbationAlert[]>();
  readonly probationTotal    = input.required<number>();
  readonly missingDocsAlerts = input.required<MissingDocAlert[]>();
  readonly missingDocsTotal  = input.required<number>();
  readonly getAvatarUrl      = getAvatarUrl;

  readonly probationFailed = signal(new Set<number>());

  readonly probationVisible = computed(() => this.probationAlerts().slice(0, VISIBLE_LIMIT));
  readonly probationExtra   = computed(() => Math.max(0, this.probationTotal() - VISIBLE_LIMIT));

  readonly missingDocsVisible = computed(() => this.missingDocsAlerts().slice(0, VISIBLE_LIMIT));
  readonly missingDocsExtra   = computed(() => Math.max(0, this.missingDocsTotal() - VISIBLE_LIMIT));

  onProbationError(id: number): void {
    this.probationFailed.update(s => new Set(s).add(id));
  }

  initials(name: string): string {
    return name.split(' ').slice(0, 2).map(p => p[0] ?? '').join('').toUpperCase();
  }

  daysChipClass(days: number): string {
    if (days <= 7)  return 'bg-red-600 text-white';
    if (days <= 14) return 'bg-orange-400 text-white';
    return 'bg-yellow-300 text-yellow-900';
  }

  docTypesLabel(types: string[]): string {
    const map: Record<string, string> = {
      CONTRACT: 'Contrat',
      ID_CARD:  "CIN",
      RIB:      'RIB',
    };
    return types.map(t => map[t] ?? t).join(', ');
  }

  urgencyClass(urgency: string): string {
    const map: Record<string, string> = {
      HIGH:   'bg-error text-white',
      MEDIUM: 'bg-orange-400 text-white',
      LOW:    'bg-surface-container-high text-outline',
    };
    return map[urgency] ?? 'bg-surface-container-high text-outline';
  }

  urgencyLabel(urgency: string): string {
    const map: Record<string, string> = {
      HIGH:   'Urgent',
      MEDIUM: 'Moyen',
      LOW:    'Faible',
    };
    return map[urgency] ?? urgency;
  }
}
