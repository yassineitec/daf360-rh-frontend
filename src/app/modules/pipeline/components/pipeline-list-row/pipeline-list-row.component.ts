import { Component, input, output } from '@angular/core';
import { StatusBadgeComponent } from '@khalilrebhiitec/daf360';
import type { BadgeOptions } from '@khalilrebhiitec/daf360';
import { TranslatePipe } from '@ngx-translate/core';
import { KanbanCandidate } from '../../services/pipeline.service';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'rh-pipeline-list-row',
  standalone: true,
  imports: [StatusBadgeComponent, TranslatePipe],
  template: `
    <div
      class="bg-white border border-outline-variant rounded-xl p-4
             flex items-center gap-5 hover:shadow-sm transition-all cursor-pointer"
      (click)="rowClick.emit(candidate().id)">

      <!-- Avatar -->
      <div class="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
        @if (candidate().photoUrl) {
          <img [src]="resolvePhoto(candidate().photoUrl)" [alt]="candidate().fullName"
               class="w-full h-full object-cover" />
        } @else {
          <div class="w-full h-full bg-surface-container-high text-on-surface-variant
                      flex items-center justify-center font-bold text-sm">
            {{ initials() }}
          </div>
        }
      </div>

      <!-- Info -->
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-0.5">
          <span class="font-bold text-on-surface text-sm truncate">{{ candidate().fullName }}</span>
          <daf-badge [label]="candidate().badge" [options]="badgeOptions()" />
        </div>
        <p class="text-sm text-outline truncate">
          {{ candidate().poste }}
          @if (candidate().skills.length) {
            <span class="mx-1">•</span>
            {{ candidate().skills.slice(0, 3).join(', ') }}
          }
        </p>
      </div>

      <!-- Fit score -->
      <span class="font-bold text-sm flex-shrink-0" style="color:#79D7BE">
        {{ 'PIPELINE.FIT_SCORE' | translate: { score: candidate().fitScore } }}
      </span>

      <!-- Location + experience -->
      <div class="text-xs text-outline flex-shrink-0 hidden lg:flex flex-col items-end gap-0.5">
        @if (candidate().location) {
          <span class="flex items-center gap-1">
            <span class="material-symbols-outlined text-[13px]">location_on</span>
            {{ candidate().location }}
          </span>
        }
        @if (candidate().experience) {
          <span class="flex items-center gap-1">
            <span class="material-symbols-outlined text-[13px]">work</span>
            {{ candidate().experience }}
          </span>
        }
      </div>

      <!-- Action -->
      <button class="text-primary font-semibold text-sm flex-shrink-0 hover:underline">
        {{ 'PIPELINE.VIEW_ARROW' | translate }}
      </button>
    </div>
  `,
})
export class PipelineListRowComponent {
  candidate = input.required<KanbanCandidate>();
  rowClick = output<number>();

  resolvePhoto(url: string | undefined): string | null {
    if (!url) return null;
    if (url.startsWith('/api/')) return environment.hrApiUrl + url;
    return url;
  }

  badgeOptions(): BadgeOptions {
    const type = this.candidate().badgeType;
    const map: Record<string, BadgeOptions> = {
      urgent:      { variant: 'danger',  outline: true },
      top:         { variant: 'success', outline: true },
      new:         { variant: 'neutral', outline: true },
      in_progress: { variant: 'primary', outline: true },
      offer:       { variant: 'teal',    outline: true },
      hired:       { variant: 'success' },
    };
    return map[type] ?? { variant: 'neutral' };
  }

  initials(): string {
    return this.candidate().fullName
      .split(' ')
      .slice(0, 2)
      .map(p => p[0]?.toUpperCase() ?? '')
      .join('');
  }
}
