import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  CardComponent,
  ProgressBarComponent,
  ButtonComponent,
  StatusBadgeComponent,
  BulkActionBarComponent,
} from '@khalilrebhiitec/daf360';
import {
  PipelineService,
  KanbanColumn,
  KanbanCandidate,
  PipelineStats,
  PipelineActivity,
  PipelineObjective,
} from './services/pipeline.service';
import { getAvatarUrl } from '../../shared/utils/avatar.utils';
import { KpiCardComponent, KpiCardVariant } from '../../shared/kpi-card.component';

interface StageCard {
  label: string;
  count: number;
  icon: string;
  variant: KpiCardVariant;
}

interface BulkAction {
  id: string;
  label: string;
  icon: string;
  variant?: 'default' | 'danger';
}

const STAGE_STYLES: Array<{ label: string; icon: string; variant: KpiCardVariant }> = [
  { label: 'Sourcing',   icon: 'search',       variant: 'blue'  },
  { label: 'Entretien',  icon: 'forum',        variant: 'green' },
  { label: 'Offre',      icon: 'description',  variant: 'amber' },
  { label: 'Recruté',    icon: 'check_circle', variant: 'green' },
];

const ACTIVITY_META: Record<string, { icon: string; bg: string; color: string }> = {
  ACCEPT:                   { icon: 'verified',      bg: 'bg-teal-100',    color: 'text-teal-700'   },
  HIRE_CANDIDATE:           { icon: 'check_circle',  bg: 'bg-green-100',   color: 'text-green-600'  },
  REJECT:                   { icon: 'person_remove', bg: 'bg-red-100',     color: 'text-red-500'    },
  CREATE:                   { icon: 'person_add',    bg: 'bg-blue-100',    color: 'text-blue-600'   },
  UPLOAD_CV:                { icon: 'upload_file',   bg: 'bg-teal-100',    color: 'text-teal-600'   },
  COMPLETE_IT_PROVISIONING: { icon: 'terminal',      bg: 'bg-teal-100',    color: 'text-teal-600'   },
  UPDATE:                   { icon: 'mail_outline',  bg: 'bg-orange-100',  color: 'text-orange-600' },
};

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'secondary' | 'neutral' | 'teal';

const BADGE_VARIANT: Record<string, BadgeVariant> = {
  urgent:      'danger',
  new:         'info',
  in_progress: 'teal',
  offer:       'warning',
  hired:       'success',
  rejected:    'neutral',
  top:         'success',
};

@Component({
  selector: 'rh-pipeline',
  standalone: true,
  imports: [CardComponent, KpiCardComponent, ProgressBarComponent, ButtonComponent, StatusBadgeComponent, BulkActionBarComponent],
  templateUrl: './pipeline.component.html',
})
export class PipelineComponent implements OnInit {
  private pipelineService = inject(PipelineService);
  private router          = inject(Router);

  readonly kanbanColumns = signal<KanbanColumn[]>([]);
  readonly candidates    = signal<KanbanCandidate[]>([]);
  readonly stats         = signal<PipelineStats | null>(null);
  readonly activities    = signal<PipelineActivity[]>([]);
  readonly objectives    = signal<PipelineObjective[]>([]);
  readonly loading       = signal(true);
  readonly selectedIds   = signal(new Set<number>());
  readonly avatarFailed  = signal(new Set<number>());

  readonly bulkActions: BulkAction[] = [
    { id: 'planifier', label: 'Planifier entretien', icon: 'calendar_month'          },
    { id: 'offre',     label: 'Envoyer offre',        icon: 'send'                    },
    { id: 'rejeter',   label: 'Rejeter',               icon: 'close', variant: 'danger' },
  ];

  readonly stageCards = computed<StageCard[]>(() =>
    this.kanbanColumns().slice(0, 4).map((col, i) => ({
      count: col.count,
      ...(STAGE_STYLES[i] ?? STAGE_STYLES[0]),
    }))
  );


  readonly selectedCount = computed(() => this.selectedIds().size);

  /** Cap the "Activités Récentes" feed so the sidebar stays compact. */
  readonly recentActivities = computed(() => this.activities().slice(0, 5));

  readonly currentObjective = computed<PipelineObjective | null>(() => {
    const objs = this.objectives();
    return objs.length ? objs[objs.length - 1] : null;
  });

  readonly objectiveProgress = computed<number>(() => {
    const obj = this.currentObjective();
    if (!obj || obj.target === 0) return 0;
    return Math.min(100, Math.round((obj.actual / obj.target) * 100));
  });

  ngOnInit(): void {
    forkJoin({
      kanban:     this.pipelineService.getKanban(),
      list:       this.pipelineService.getCandidates({ page: 0, size: 20 }),
      stats:      this.pipelineService.getStats(),
      activities: this.pipelineService.getActivity(),
      objectives: this.pipelineService.getObjectives(),
    }).subscribe({
      next: ({ kanban, list, stats, activities, objectives }) => {
        this.kanbanColumns.set(kanban);
        this.candidates.set(list.content);
        this.stats.set(stats);
        this.activities.set(activities);
        this.objectives.set(objectives);
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

  /** Left-accent border colour, one distinct colour per pipeline stage. */
  private readonly STAGE_BORDER: Record<string, string> = {
    SCREENING: '#3755c3', // blue   — Candidatures
    ENTRETIEN: '#79D7BE', // teal   — Entretiens
    OFFRE:     '#F59E0B', // amber  — Offres
    RECRUTE:   '#10B981', // green  — Recrutés
    REJETE:    '#BA1A1A', // red    — Rejetés
  };

  stageBorderColor(c: KanbanCandidate): string {
    return this.STAGE_BORDER[(c.stage ?? '').toUpperCase()] ?? '#C4C5D5';
  }

  fitScoreClass(score: number): string {
    return score >= 85 ? 'text-[#79D7BE] font-bold text-sm' : 'text-outline font-bold text-sm';
  }

  /** Up to two contextual meta items shown in a desktop card's footer, in priority order. */
  cardMeta(c: KanbanCandidate): Array<{ icon: string; text: string }> {
    const items: Array<{ icon: string; text: string }> = [];
    if (c.nextEvent)        items.push({ icon: 'calendar_month', text: c.nextEvent });
    else if (c.experience)  items.push({ icon: 'work',           text: c.experience });
    else if (c.salary)      items.push({ icon: 'attach_money',   text: c.salary });
    if (c.location) items.push({ icon: 'location_on', text: c.location });
    return items.slice(0, 2);
  }

  onBulkAction(actionId: string): void {
    // TODO: implement bulk actions
    console.log('bulk action:', actionId, [...this.selectedIds()]);
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

  /** Real workflow progress (%) for provisioning/onboarding cards; 0 when unknown. */
  progressValue(c: KanbanCandidate): number {
    return c.progressPercent ?? 0;
  }

  getCardVariant(candidate: KanbanCandidate): 'provisioning' | 'onboarding' | 'default' {
    const s = candidate.status;
    if (s === 'IT_IN_PROGRESS' || s === 'EMAIL_RECEIVED') return 'provisioning';
    if (s === 'HR_IN_PROGRESS' || s === 'HIRED')          return 'onboarding';
    return 'default';
  }

  badgeVariant(badgeType: string): BadgeVariant {
    return BADGE_VARIANT[badgeType] ?? 'neutral';
  }

  activityMeta(action: string) {
    return ACTIVITY_META[action] ?? { icon: 'info', bg: 'bg-surface-container', color: 'text-outline' };
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
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  formatDelay(days: number): string {
    return `Moy. ${Math.round(days)}j`;
  }
}
