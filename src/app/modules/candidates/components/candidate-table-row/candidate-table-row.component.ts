import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ButtonComponent } from '@khalilrebhiitec/daf360';
import { CandidateStageBadgeComponent } from '../candidate-stage-badge/candidate-stage-badge.component';
import { PipelineCandidateItem } from '../../services/candidates.service';

const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#3b82f6',
];

export type ProcessedCandidate = PipelineCandidateItem & {
  initials: string;
  colorIndex: number;
};

@Component({
  selector: '[rh-candidate-table-row]',
  standalone: true,
  imports: [DatePipe, CandidateStageBadgeComponent, ButtonComponent],
  template: `
    <!-- Candidat -->
    <td class="py-3 px-4">
      <div class="flex items-center gap-3">
        @if (candidate.photoUrl) {
          <img [src]="candidate.photoUrl" class="w-9 h-9 rounded-full object-cover shrink-0" />
        } @else {
          <div
            class="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
            [style.background-color]="avatarColor"
          >{{ candidate.initials }}</div>
        }
        <p class="text-sm font-semibold text-on-surface">{{ candidate.fullName }}</p>
      </div>
    </td>
    <!-- Poste -->
    <td class="py-3 px-4 text-sm text-outline">{{ candidate.poste }}</td>
    <!-- Étape -->
    <td class="py-3 px-4">
      <rh-candidate-stage-badge [stage]="candidate.stage" />
    </td>
    <!-- Score -->
    <td class="py-3 px-4">
      <div class="flex items-center gap-2">
        <div class="w-20 h-1.5 bg-surface-container-high rounded-full overflow-hidden">
          <div
            class="h-full rounded-full transition-all"
            [style.width.%]="candidate.score"
            [style.background-color]="scoreColor"
          ></div>
        </div>
        <span class="text-sm font-semibold text-on-surface">{{ candidate.score }}%</span>
      </div>
    </td>
    <!-- Date -->
    <td class="py-3 px-4 text-sm text-outline">
      {{ candidate.datePostulation | date: 'dd/MM/yyyy' }}
    </td>
    <!-- Actions -->
    <td class="py-3 px-4">
      <div class="flex items-center gap-1">
        <daf-button
          variant="ghost"
          [options]="{ iconStart: 'visibility', size: 'sm' }"
          (onClick)="viewClick.emit(candidate.id)"
        />
        <daf-button
          variant="ghost"
          [options]="{ iconStart: 'chat_bubble', size: 'sm' }"
          (onClick)="messageClick.emit(candidate.id)"
        />
        <daf-button
          variant="ghost"
          [options]="{ iconStart: 'more_vert', size: 'sm' }"
          (onClick)="moreClick.emit(candidate.id)"
        />
      </div>
    </td>
  `,
  host: { class: 'hover:bg-surface-container-low transition-colors' },
})
export class CandidateTableRowComponent {
  @Input({ required: true }) candidate!: ProcessedCandidate;
  @Output() viewClick    = new EventEmitter<number>();
  @Output() messageClick = new EventEmitter<number>();
  @Output() moreClick    = new EventEmitter<number>();

  get avatarColor(): string {
    return AVATAR_COLORS[this.candidate.colorIndex % AVATAR_COLORS.length];
  }

  get scoreColor(): string {
    if (this.candidate.score >= 75) return '#22c55e';
    if (this.candidate.score >= 50) return '#f97316';
    return '#ef4444';
  }
}
