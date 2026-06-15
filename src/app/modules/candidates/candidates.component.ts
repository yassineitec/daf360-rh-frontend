import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { PaginationComponent } from '@khalilrebhiitec/daf360';
import {
  CandidatesPipelineService,
  PipelineCandidateItem,
  PipelineStats,
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
    FormsModule,
    PaginationComponent,
    CandidateKpiCardsComponent,
    CandidateTableRowComponent,
  ],
  templateUrl: './candidates.component.html',
})
export class CandidatesComponent implements OnInit {
  private svc = inject(CandidatesPipelineService);

  readonly stats         = signal<PipelineStats | null>(null);
  readonly candidates    = signal<ProcessedCandidate[]>([]);
  readonly loading       = signal(false);
  readonly statsLoading  = signal(false);
  readonly viewMode      = signal<'liste' | 'tableau'>('tableau');
  readonly search        = signal('');
  readonly stageFilter   = signal('');
  readonly currentPage   = signal(0);
  readonly totalElements = signal(0);
  readonly totalPages    = computed(() => Math.ceil(this.totalElements() / PAGE_SIZE));

  readonly stages = [
    { value: '', label: 'Toutes les étapes' },
    { value: 'Candidature',         label: 'Candidature' },
    { value: 'Screening RH',        label: 'Screening RH' },
    { value: 'Entretien Technique', label: 'Entretien Technique' },
    { value: 'Offre Envoyée',       label: 'Offre Envoyée' },
    { value: 'Recruté',             label: 'Recruté' },
    { value: 'Rejeté',              label: 'Rejeté' },
  ];

  ngOnInit(): void {
    this.loading.set(true);
    this.statsLoading.set(true);
    forkJoin({
      stats: this.svc.getStats(),
      page:  this.svc.getCandidates({ page: 0, size: PAGE_SIZE }),
    }).subscribe({
      next: ({ stats, page }) => {
        this.stats.set(stats);
        this.totalElements.set(page.totalElements);
        this.candidates.set(this.process(page.content));
        this.loading.set(false);
        this.statsLoading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.statsLoading.set(false);
      },
    });
  }

  onSearch(value: string): void {
    this.search.set(value);
    this.currentPage.set(0);
    this.loadCandidates();
  }

  onStageChange(value: string): void {
    this.stageFilter.set(value);
    this.currentPage.set(0);
    this.loadCandidates();
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.loadCandidates();
  }

  onView(_id: number): void {}
  onMessage(_id: number): void {}
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
