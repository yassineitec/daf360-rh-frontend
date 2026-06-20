import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  ButtonComponent,
  CardComponent,
  FormFieldComponent,
  FormFieldOptions,
  PaginationComponent,
  SelectComponent,
  SelectConfig,
  ToolbarComponent,
} from '@khalilrebhiitec/daf360';
import {
  CandidatesPipelineService,
  PipelineCandidateItem,
  PipelineStats,
  CandidateKanbanColumn,
} from './services/candidates.service';
import { CandidateKpiCardsComponent } from './components/candidate-kpi-cards/candidate-kpi-cards.component';
import { CandidateTableRowComponent, ProcessedCandidate } from './components/candidate-table-row/candidate-table-row.component';

const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#3b82f6',
];

const PAGE_SIZE = 10;

@Component({
  selector: 'rh-candidates',
  standalone: true,
  imports: [
    ButtonComponent,
    CardComponent,
    FormFieldComponent,
    SelectComponent,
    PaginationComponent,
    ToolbarComponent,
    CandidateKpiCardsComponent,
    CandidateTableRowComponent,
  ],
  templateUrl: './candidates.component.html',
})
export class CandidatesComponent implements OnInit {
  private svc    = inject(CandidatesPipelineService);
  private router = inject(Router);

  readonly stats         = signal<PipelineStats | null>(null);
  readonly candidates    = signal<ProcessedCandidate[]>([]);
  readonly loading       = signal(false);
  readonly statsLoading  = signal(false);
  readonly search        = signal('');
  readonly stageFilter   = signal('');
  readonly currentPage   = signal(0);
  readonly totalElements = signal(0);
  readonly totalPages    = computed(() => Math.ceil(this.totalElements() / PAGE_SIZE));
  readonly stages        = signal<{ value: string; label: string }[]>([]);

  readonly stageSelectOptions = computed(() =>
    this.stages()
      .filter(s => s.value !== '')
      .map(s => ({ value: s.value, label: s.label }))
  );

  readonly searchFieldOptions: FormFieldOptions = {
    type: 'search',
    placeholder: 'Rechercher un candidat...',
    prefixIcon: 'search',
    fullWidth: true,
  };

  readonly stageSelectConfig: SelectConfig = {
    placeholder: 'Toutes les étapes',
  };

  ngOnInit(): void {
    this.loading.set(true);
    this.statsLoading.set(true);
    forkJoin({
      stats:  this.svc.getStats(),
      page:   this.svc.getCandidates({ page: 0, size: PAGE_SIZE }),
      kanban: this.svc.getKanban(),
    }).subscribe({
      next: ({ stats, page, kanban }) => {
        this.stats.set(stats);
        this.totalElements.set(page.totalElements);
        this.candidates.set(this.process(page.content));
        this.stages.set([
          { value: '', label: 'Toutes les étapes' },
          ...kanban.map((col: CandidateKanbanColumn) => ({
            value: col.stage,
            label: col.stageLabel,
          })),
        ]);
        this.loading.set(false);
        this.statsLoading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.statsLoading.set(false);
      },
    });
  }

  onNewCandidate(): void {
    this.router.navigate(['/rh/candidates', 'new']);
  }

  onSearch(value: string | number | null): void {
    this.search.set((value as string) ?? '');
    this.currentPage.set(0);
    this.loadCandidates();
  }

  onStageChange(stages: string[]): void {
    this.stageFilter.set(stages[0] ?? '');
    this.currentPage.set(0);
    this.loadCandidates();
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.loadCandidates();
  }

  onView(id: number): void {
    const c = this.candidates().find(c => c.id === id);
    if (c?.status === 'HIRED') {
      this.router.navigate(['/rh/profiles']);
    }
  }

  onMessage(id: number): void {
    const c = this.candidates().find(c => c.id === id);
    if (c?.email) {
      window.open(`mailto:${c.email}`, '_blank');
    }
  }

  onMore(_id: number): void {}

  private loadCandidates(): void {
    this.loading.set(true);
    this.svc.getCandidates({
      search: this.search()      || undefined,
      stage:  this.stageFilter() || undefined,
      page:   this.currentPage(),
      size:   PAGE_SIZE,
    }).subscribe({
      next: page => {
        this.totalElements.set(page.totalElements);
        this.candidates.set(this.process(page.content));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private process(items: PipelineCandidateItem[]): ProcessedCandidate[] {
    return items.map((item, i) => ({
      ...item,
      initials: item.fullName
        .split(' ')
        .map(n => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase(),
      colorIndex: i % AVATAR_COLORS.length,
    }));
  }
}
