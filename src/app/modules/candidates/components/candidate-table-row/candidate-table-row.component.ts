import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DatePipe } from '@angular/common';
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
  imports: [DatePipe, CandidateStageBadgeComponent],
  template: `
    <!-- Candidat -->
    <td class="py-3 px-4">
      <div class="flex items-center gap-3">
        @if (candidate.photoUrl) {
          <img [src]="candidate.photoUrl" class="w-9 h-9 rounded-full object-cover shrink-0" />
        } @else {
          <div
            class="w-9 h-9 rounded-full flex items-center justify-center text-white text-[13px] font-bold shrink-0"
            [style.background-color]="avatarColor"
          >{{ candidate.initials }}</div>
        }
        <p class="text-[14px] font-semibold text-on-surface">{{ candidate.fullName }}</p>
      </div>
    </td>
    <!-- Poste -->
    <td class="py-3 px-4 text-[13px] text-outline">{{ candidate.poste }}</td>
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
        <span class="text-[13px] font-semibold text-on-surface">{{ candidate.score }}%</span>
      </div>
    </td>
    <!-- Date -->
    <td class="py-3 px-4 text-[13px] text-outline">
      {{ candidate.datePostulation | date: 'dd/MM/yyyy' }}
    </td>
    <!-- Actions -->
    <td class="py-3 px-4">
      <div class="flex items-center gap-1">
        <button
          class="p-1.5 rounded-lg text-outline hover:text-primary hover:bg-surface-container transition-colors"
          (click)="viewClick.emit(candidate.id)"
        >
          <span class="material-symbols-outlined text-[18px]">visibility</span>
        </button>
        <button
          class="p-1.5 rounded-lg text-outline hover:text-primary hover:bg-surface-container transition-colors"
          (click)="messageClick.emit(candidate.id)"
        >
          <span class="material-symbols-outlined text-[18px]">chat_bubble</span>
        </button>
        <button
          class="p-1.5 rounded-lg text-outline hover:text-primary hover:bg-surface-container transition-colors"
          (click)="moreClick.emit(candidate.id)"
        >
          <span class="material-symbols-outlined text-[18px]">more_vert</span>
        </button>
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
