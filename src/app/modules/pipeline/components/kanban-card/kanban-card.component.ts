import { Component, input, output } from '@angular/core';
import { StatusBadgeComponent } from '@khalilrebhiitec/daf360';
import type { BadgeOptions } from '@khalilrebhiitec/daf360';
import { KanbanCandidate } from '../../services/pipeline.service';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'rh-kanban-card',
  standalone: true,
  imports: [StatusBadgeComponent],
  styles: [`
    .card-accent-urgent { border-left: 4px solid var(--md-sys-color-error, #B3261E); }
    .card-accent-top    { border-left: 4px solid #79D7BE; }
  `],
  template: `
    <div
      class="bg-white p-4 rounded-xl border border-outline-variant shadow-sm
             hover:shadow-md hover:-translate-y-1 transition-all duration-300
             cursor-pointer relative"
      [class.card-accent-urgent]="candidate().badgeType === 'urgent'"
      [class.card-accent-top]="candidate().badgeType === 'top'"
      (click)="cardClick.emit(candidate().id)">

      <!-- Top row: badge + fit score -->
      <div class="flex justify-between mb-3">
        <daf-badge [label]="candidate().badge" [options]="badgeOptions()" />
        <span class="font-bold text-sm" style="color:#79D7BE">
          {{ candidate().fitScore }}% Fit
        </span>
      </div>

      <!-- Avatar + info -->
      <div class="flex items-center gap-3 mb-4">
        <div class="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
          @if (candidate().photoUrl) {
            <img [src]="resolvePhoto(candidate().photoUrl)!"
                 class="w-full h-full object-cover" />
          } @else {
            <div class="w-full h-full bg-surface-container-high text-on-surface-variant
                        flex items-center justify-center font-bold text-sm">
              {{ initials() }}
            </div>
          }
        </div>
        <div>
          <p class="font-bold text-on-surface text-[14px]">{{ candidate().fullName }}</p>
          <p class="text-xs text-outline">{{ candidate().poste }}</p>
        </div>
      </div>

      <!-- Skills -->
      <div class="flex flex-wrap gap-1.5 mb-4">
        @for (skill of candidate().skills; track skill) {
          <span class="bg-surface-container-low text-outline text-[10px] px-2 py-0.5 rounded">
            {{ skill }}
          </span>
        }
      </div>

      <!-- Note -->
      @if (candidate().note) {
        <div class="bg-surface-container-low p-2 rounded-lg mb-4 text-xs text-outline italic">
          {{ candidate().note }}
        </div>
      }

      <!-- Footer -->
      <div class="flex justify-between pt-3 border-t border-outline-variant text-outline">
        <div class="flex items-center gap-1 text-[11px]">
          @if (candidate().experience) {
            <span class="material-symbols-outlined text-[13px]">work</span>
            <span>{{ candidate().experience }}</span>
          } @else if (candidate().nextEvent) {
            <span class="material-symbols-outlined text-[13px]">calendar_month</span>
            <span>{{ candidate().nextEvent }}</span>
          } @else if (candidate().salary) {
            <span class="material-symbols-outlined text-[13px]">attach_money</span>
            <span>{{ candidate().salary }}</span>
          }
        </div>
        @if (candidate().location) {
          <div class="flex items-center gap-1 text-[11px]">
            <span class="material-symbols-outlined text-[13px]">location_on</span>
            <span>{{ candidate().location }}</span>
          </div>
        }
      </div>
    </div>
  `,
})
export class KanbanCardComponent {
  candidate = input.required<KanbanCandidate>();
  cardClick = output<number>();

  resolvePhoto(url: string | undefined): string | null {
    if (!url) return null;
    return `${environment.hrApiUrl}/api/hr/profiles/${this.candidate().id}/photo`;
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
    return { ...map[type] ?? { variant: 'neutral' }, size: 'sm' };
  }

  initials(): string {
    return this.candidate().fullName
      .split(' ')
      .slice(0, 2)
      .map(p => p[0]?.toUpperCase() ?? '')
      .join('');
  }
}
