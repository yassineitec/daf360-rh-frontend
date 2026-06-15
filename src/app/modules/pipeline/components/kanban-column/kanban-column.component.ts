import { Component, input, output, OnChanges } from '@angular/core';
import {
  CdkDropList, CdkDrag,
  CdkDragDrop, moveItemInArray, transferArrayItem,
} from '@angular/cdk/drag-drop';
import { KanbanColumn, KanbanCandidate } from '../../services/pipeline.service';
import { KanbanCardComponent } from '../kanban-card/kanban-card.component';

@Component({
  selector: 'rh-kanban-column',
  standalone: true,
  imports: [KanbanCardComponent, CdkDropList, CdkDrag],
  template: `
    <div class="kanban-column space-y-4 flex-shrink-0" style="min-width: 300px; width: 300px;">

      <!-- Column header -->
      <div class="flex justify-between items-center px-2 py-1">
        <span class="font-bold flex items-center gap-2">
          {{ column().stageLabel }}
          <span class="bg-surface-container-highest px-2 py-0.5 rounded text-xs font-normal">
            {{ column().count }}
          </span>
        </span>
        <button class="text-outline hover:text-on-surface transition-colors p-1 rounded">
          <span class="material-symbols-outlined text-[20px]">more_horiz</span>
        </button>
      </div>

      <!-- Drop zone -->
      <div
        cdkDropList
        [id]="column().stage"
        [cdkDropListData]="items"
        (cdkDropListDropped)="onDrop($event)"
        class="flex flex-col gap-4 min-h-15">
        @for (candidate of items; track candidate.id) {
          <rh-kanban-card
            cdkDrag
            [cdkDragData]="candidate"
            [candidate]="candidate"
            (cardClick)="cardClick.emit($event)" />
        }
      </div>
    </div>
  `,
})
export class KanbanColumnComponent implements OnChanges {
  column    = input.required<KanbanColumn>();
  cardClick = output<number>();
  dropped   = output<{ candidateId: number; fromStage: string; toStage: string }>();

  items: KanbanCandidate[] = [];

  private prevCandidatesRef: KanbanCandidate[] | null = null;

  ngOnChanges(): void {
    const newCandidates = this.column().candidates;
    // Only reset local items when the server array reference changes (real data reload).
    // Count-only updates keep the same `candidates` reference — CDK owns the order.
    if (newCandidates !== this.prevCandidatesRef) {
      this.items = [...newCandidates];
      this.prevCandidatesRef = newCandidates;
    }
  }

  onDrop(event: CdkDragDrop<KanbanCandidate[]>): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(this.items, event.previousIndex, event.currentIndex);
    } else {
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex,
      );
      this.dropped.emit({
        candidateId: (event.item.data as KanbanCandidate).id,
        fromStage:   event.previousContainer.id,
        toStage:     this.column().stage,
      });
    }
  }
}
