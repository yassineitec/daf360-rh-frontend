import { Component, computed, input, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { CardComponent } from '@khalilrebhiitec/daf360';
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

/**
 * Rows shown per card. Each matches its backend preview size (DashboardService:
 * probation TOP 3, missing documents limit(5)).
 */
const PROBATION_LIMIT    = 3;
const MISSING_DOCS_LIMIT = 5;

/**
 * The watchlist used to be ONE card holding both lists, spanning two grid rows at xl —
 * two rows of content in a two-row-tall box left most of it blank. Each list is now its
 * own one-row card, so its height follows its neighbours instead of being stretched.
 */
@Component({
  selector: 'rh-probation-card',
  standalone: true,
  host: { class: 'block h-full' },
  imports: [TranslatePipe, CardComponent],
  template: `
    <daf-card [options]="{ variant: 'glass', padding: 'md', radius: 'xl', fullHeight: true, hoverable: true }">
      <div class="flex flex-col h-full">

        <div class="flex items-center justify-between mb-3">
          <h3 class="text-[11px] font-bold text-red-700 uppercase tracking-wider">
            {{ 'HOME.ALERT_CARD.PROBATION_TITLE' | translate }}
          </h3>
          @if (extra() > 0) {
            <span class="text-[11px] font-bold bg-red-600 text-white px-2 py-0.5 rounded-full leading-none">
              +{{ extra() }}
            </span>
          }
        </div>

        @if (alerts().length === 0) {
          <div class="flex-1 flex flex-col items-center justify-center py-4 text-center">
            <p class="text-[13px] text-outline">{{ 'HOME.ALERT_CARD.PROBATION_EMPTY' | translate }}</p>
          </div>
        }

        @for (alert of visible(); track alert.profileId) {
          <div class="flex items-center gap-3 py-2 border-b border-outline-variant/60 last:border-0">
            <div class="w-8 h-8 rounded-full bg-red-100 overflow-hidden shrink-0
                        flex items-center justify-center text-[10px] font-bold text-red-600">
              @if (!failed().has(alert.profileId)) {
                <img [src]="getAvatarUrl(alert.profileId, alert.photoUrl, alert.gender)"
                     [alt]="alert.fullName"
                     class="w-full h-full object-cover"
                     (error)="onError(alert.profileId)" />
              } @else {
                {{ initials(alert.fullName) }}
              }
            </div>

            <div class="flex-1 min-w-0">
              <p class="text-[13px] font-semibold text-on-surface truncate">{{ alert.fullName }}</p>
              <p class="text-[11px] text-outline truncate">
                {{ alert.roleName ?? alert.department ?? '—' }}
                @if (alert.department && alert.roleName) { • {{ alert.department }} }
              </p>
            </div>

            <span [class]="daysChipClass(alert.joursRestants)"
                  class="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full">
              J–{{ alert.joursRestants }}
            </span>
          </div>
        }
      </div>
    </daf-card>
  `,
})
export class ProbationCardComponent {
  readonly alerts = input.required<ProbationAlert[]>();
  readonly total  = input.required<number>();
  readonly getAvatarUrl = getAvatarUrl;

  readonly failed  = signal(new Set<number>());
  readonly visible = computed(() => this.alerts().slice(0, PROBATION_LIMIT));
  readonly extra   = computed(() => Math.max(0, this.total() - PROBATION_LIMIT));

  onError(id: number): void {
    this.failed.update(s => new Set(s).add(id));
  }

  initials(name: string): string {
    return name.split(' ').slice(0, 2).map(p => p[0] ?? '').join('').toUpperCase();
  }

  daysChipClass(days: number): string {
    if (days <= 7)  return 'bg-red-600 text-white';
    if (days <= 14) return 'bg-orange-400 text-white';
    return 'bg-yellow-300 text-yellow-900';
  }
}

@Component({
  selector: 'rh-missing-docs-card',
  standalone: true,
  host: { class: 'block h-full' },
  imports: [TranslatePipe, CardComponent],
  template: `
    <daf-card [options]="{ variant: 'glass', padding: 'md', radius: 'xl', fullHeight: true, hoverable: true }">
      <div class="flex flex-col h-full">

        <div class="flex items-center justify-between mb-3">
          <h3 class="text-[11px] font-bold text-on-surface uppercase tracking-wider">
            {{ 'HOME.ALERT_CARD.MISSING_DOCS_TITLE' | translate }}
          </h3>
          @if (extra() > 0) {
            <span class="text-[11px] font-bold bg-on-surface text-surface px-2 py-0.5 rounded-full leading-none">
              +{{ extra() }}
            </span>
          }
        </div>

        @if (alerts().length === 0) {
          <div class="flex-1 flex flex-col items-center justify-center py-4 text-center">
            <p class="text-[13px] text-outline">{{ 'HOME.ALERT_CARD.MISSING_DOCS_EMPTY' | translate }}</p>
          </div>
        }

        @for (doc of visible(); track doc.profileId) {
          <div class="flex items-center justify-between py-2 border-b border-outline-variant/60 last:border-0">
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
    </daf-card>
  `,
})
export class MissingDocsCardComponent {
  readonly alerts = input.required<MissingDocAlert[]>();
  readonly total  = input.required<number>();

  readonly visible = computed(() => this.alerts().slice(0, MISSING_DOCS_LIMIT));
  readonly extra   = computed(() => Math.max(0, this.total() - MISSING_DOCS_LIMIT));

  docTypesLabel(types: string[]): string {
    const map: Record<string, string> = {
      CONTRACT: 'Contrat',
      ID_CARD:  "CIN",
      RIB:      'RIB',
    };
    return types.map(t => map[t] ?? t).join(', ');
  }

  // `bg-danger` / `bg-warning` are declared in the lib's own @theme, so these can't
  // silently lose their background the way `bg-error` did (see src/styles.css).
  urgencyClass(urgency: string): string {
    const map: Record<string, string> = {
      HIGH:   'bg-danger text-white',
      MEDIUM: 'bg-warning text-white',
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
