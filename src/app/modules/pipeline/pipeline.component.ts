import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { CardComponent, ProgressBarComponent } from '@khalilrebhiitec/daf360';
import {
  PipelineService,
  KanbanColumn,
  KanbanCandidate,
} from './services/pipeline.service';
import { getAvatarUrl } from '../../shared/utils/avatar.utils';

interface StageCard {
  label: string;
  count: number;
  icon: string;
  iconBg: string;
  iconColor: string;
  accent: boolean;
}

const STAGE_STYLES = [
  { icon: 'search',            iconBg: 'bg-blue-100',   iconColor: 'text-blue-600',   accent: false },
  { icon: 'record_voice_over', iconBg: 'bg-teal-100',   iconColor: 'text-teal-600',   accent: true  },
  { icon: 'description',       iconBg: 'bg-orange-100', iconColor: 'text-orange-500', accent: false },
  { icon: 'check_circle',      iconBg: 'bg-green-100',  iconColor: 'text-green-600',  accent: false },
];

@Component({
  selector: 'rh-pipeline',
  standalone: true,
  imports: [CardComponent, ProgressBarComponent],
  templateUrl: './pipeline.component.html',
})
export class PipelineComponent implements OnInit {
  private pipelineService = inject(PipelineService);
  private router          = inject(Router);

  readonly kanbanColumns   = signal<KanbanColumn[]>([]);
  readonly candidates      = signal<KanbanCandidate[]>([]);
  readonly loading         = signal(true);
  readonly searchQuery     = signal('');
  readonly selectedIds     = signal(new Set<number>());
  readonly avatarFailed    = signal(new Set<number>());

  readonly stageCards = computed<StageCard[]>(() =>
    this.kanbanColumns().slice(0, 4).map((col, i) => ({
      label: col.stageLabel,
      count: col.count,
      ...(STAGE_STYLES[i] ?? STAGE_STYLES[0]),
    }))
  );

  readonly filteredCandidates = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.candidates();
    return this.candidates().filter(c =>
      c.fullName.toLowerCase().includes(q) || c.poste.toLowerCase().includes(q)
    );
  });

  readonly selectedCount = computed(() => this.selectedIds().size);

  readonly recentActivities = [
    { icon: 'person_check',  description: 'Ahmed Belaid → Entretien Technique', time: 'il y a 2h',  color: 'text-blue-500' },
    { icon: 'send',          description: 'Ibrahim Tlili — Offre Envoyée',        time: 'il y a 4h',  color: 'text-teal-600' },
    { icon: 'check_circle',  description: 'Sana Khelifi — Recrutée',              time: 'hier',        color: 'text-green-500' },
  ];

  ngOnInit(): void {
    forkJoin({
      kanban: this.pipelineService.getKanban(),
      list:   this.pipelineService.getCandidates({ page: 0, size: 20 }),
    }).subscribe({
      next: ({ kanban, list }) => {
        this.kanbanColumns.set(kanban);
        this.candidates.set(list.content);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onNewCandidate(): void {
    this.router.navigate(['/rh/candidates', 'new']);
  }

  onCandidateClick(id: number): void {
    this.router.navigate(['/rh/candidates', id]);
  }

  onSearch(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  toggleSelect(id: number, event: Event): void {
    event.stopPropagation();
    this.selectedIds.update(s => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  isSelected(id: number): boolean {
    return this.selectedIds().has(id);
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
  }

  getCardVariant(candidate: KanbanCandidate): 'provisioning' | 'onboarding' | 'default' {
    if (candidate.status === 'IT_IN_PROGRESS')  return 'provisioning';
    if (candidate.status === 'HR_IN_PROGRESS')  return 'onboarding';
    return 'default';
  }

  resolveAvatar(candidate: KanbanCandidate): string {
    return getAvatarUrl(candidate.id, candidate.photoUrl, candidate.gender);
  }

  onAvatarError(id: number): void {
    this.avatarFailed.update(s => new Set(s).add(id));
  }

  initials(name: string): string {
    return name.split(' ').slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('');
  }

  formatDate(dateStr: string | undefined): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  }
}
