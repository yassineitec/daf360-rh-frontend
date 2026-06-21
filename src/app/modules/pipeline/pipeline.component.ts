import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { CdkDropListGroup } from '@angular/cdk/drag-drop';
import { PaginationComponent } from '@khalilrebhiitec/daf360';
import type { TableColumn } from '@khalilrebhiitec/daf360';
import {
  PipelineService,
  PipelineStats,
  KanbanColumn,
  KanbanCandidate,
} from './services/pipeline.service';
import { PipelineKpiCardsComponent } from './components/pipeline-kpi-cards/pipeline-kpi-cards.component';
import { KanbanColumnComponent } from './components/kanban-column/kanban-column.component';
import { PipelineListRowComponent } from './components/pipeline-list-row/pipeline-list-row.component';

@Component({
  selector: 'rh-pipeline',
  standalone: true,
  imports: [
    PipelineKpiCardsComponent,
    KanbanColumnComponent,
    PipelineListRowComponent,
    PaginationComponent,
    CdkDropListGroup,
  ],
  templateUrl: './pipeline.component.html',
})
export class PipelineComponent implements OnInit {
  private pipelineService = inject(PipelineService);
  private router = inject(Router);

  stats         = signal<PipelineStats | null>(null);
  kanbanColumns = signal<KanbanColumn[]>([]);
  candidates    = signal<KanbanCandidate[]>([]);
  loading       = signal(true);
  viewMode      = signal<'kanban' | 'list'>('kanban');
  currentPage   = signal(0);
  totalPages    = signal(0);
  totalElements = signal(0);
  selectedStage = signal('');

  readonly listColumns: TableColumn[] = [
    { key: 'fullName',  label: 'Candidat',  type: 'text',   sortable: true },
    { key: 'poste',     label: 'Poste',     type: 'text' },
    { key: 'stage',     label: 'Étape',     type: 'badge' },
    { key: 'fitScore',  label: 'Fit %',     type: 'number', align: 'center' },
    { key: 'location',  label: 'Lieu',      type: 'text' },
    { key: 'action',    label: '',          type: 'custom', align: 'center' },
  ];

  ngOnInit(): void {
    this.loading.set(true);
    forkJoin({
      stats:  this.pipelineService.getStats(),
      kanban: this.pipelineService.getKanban(),
      list:   this.pipelineService.getCandidates({ page: 0, size: 15 }),
    }).subscribe({
      next: ({ stats, kanban, list }) => {
        this.stats.set(stats);
        this.kanbanColumns.set(kanban);
        this.candidates.set(list.content);
        this.totalPages.set(list.totalPages ?? 1);
        this.totalElements.set(list.totalElements ?? 0);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  loadKanban(): void {
    this.pipelineService.getKanban().subscribe(cols => this.kanbanColumns.set(cols));
  }

  loadList(): void {
    this.pipelineService.getCandidates({
      page:  this.currentPage(),
      size:  15,
      stage: this.selectedStage() || undefined,
    }).subscribe(page => {
      this.candidates.set(page.content);
      this.totalElements.set(page.totalElements);
      this.totalPages.set(page.totalPages);
    });
  }

  onViewChange(mode: 'kanban' | 'list'): void {
    this.viewMode.set(mode);
  }

  onCardClick(id: number): void {
    this.router.navigate(['/rh/candidates', id]);
  }

  onStageFilter(stage: string): void {
    this.selectedStage.set(stage);
    this.currentPage.set(0);
    this.loadList();
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.loadList();
  }

  onKanbanDrop(event: { candidateId: number; fromStage: string; toStage: string }): void {
    const { candidateId, fromStage, toStage } = event;

    this.kanbanColumns.update(cols =>
      cols.map(col => {
        if (col.stage === fromStage) return { ...col, count: Math.max(0, col.count - 1) };
        if (col.stage === toStage)   return { ...col, count: col.count + 1 };
        return col;
      }),
    );

    this.pipelineService.moveToStage(candidateId, toStage).subscribe({
      error: () => this.loadKanban(),
    });
  }

  goToNewCandidate(): void {
    this.router.navigate(['/rh/candidates', 'new']);
  }
}
