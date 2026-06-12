import {
  Component, computed, inject, OnInit, signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { LifecycleService } from './lifecycle.service';
import {
  WorkflowInstance, WorkflowTask, EVENT_TYPE_LABELS,
  groupTasksByPhase, computeProgress, findNextDueTask,
} from './models/lifecycle.model';
import { TimelineComponent }    from '../../shared/timeline.component';
import { StatusBadgeComponent } from '@khalilrebhiitec/daf360';
import { statusBadge } from '../../shared/status-badge.utils';
import { SpinnerComponent }     from '../../shared/spinner.component';

@Component({
  selector: 'app-workflow-detail',
  standalone: true,
  imports: [RouterLink, TimelineComponent, StatusBadgeComponent, SpinnerComponent],
  template: `
    <nav class="breadcrumb">
      <a routerLink="/lifecycle" class="bc-link">Lifecycle</a>
      <span class="bc-sep">›</span>
      <span class="bc-current">Workflow #{{ workflowId }}</span>
    </nav>

    @if (loading()) {
      <div class="center-spinner"><app-spinner size="lg" /></div>
    } @else if (!workflow()) {
      <div class="error-state">
        <p>Workflow introuvable.</p>
        <a routerLink="/lifecycle" class="btn-ghost">Retour</a>
      </div>
    } @else {

      <!-- Warning banner -->
      @if (isBlocked() || isOverdue()) {
        <div class="warning-banner" [class.blocked]="isBlocked()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          @if (isBlocked()) {
            Ce workflow est <strong>bloqué</strong>. Une ou plusieurs tâches sont BLOQUÉES.
          } @else {
            Ce workflow est <strong>en retard</strong>. La prochaine tâche a dépassé son SLA.
          }
        </div>
      }

      <!-- Header card -->
      <div class="wf-header card">
        <div class="wf-meta">
          <h1 class="wf-title">{{ eventLabel(workflow()!.eventType) }}</h1>
          <div class="wf-chips">
            <daf-badge [label]="statusBadge(workflow()!.status).label" [options]="statusBadge(workflow()!.status).options" />
            <span class="meta-chip">Profil #{{ workflow()!.employeeProfileId }}</span>
            @if (workflow()!.startDate) {
              <span class="meta-chip">Démarré {{ fmtDate(workflow()!.startDate) }}</span>
            }
            @if (workflow()!.dueDate) {
              <span class="meta-chip">Échéance {{ fmtDate(workflow()!.dueDate) }}</span>
            }
          </div>
        </div>

        <!-- Progress bar -->
        <div class="progress-section">
          <div class="progress-label">
            <span>Progression</span>
            <span class="progress-pct-val">{{ progressPct() }}%</span>
          </div>
          <div class="progress-bar-lg">
            <div class="progress-fill-lg"
                 [style.width]="progressPct() + '%'"
                 [class.done]="progressPct() >= 100"></div>
          </div>
          <div class="progress-counts">{{ doneTasks() }} / {{ totalTasks() }} tâches terminées</div>
        </div>

        @if (workflow()!.notes) {
          <div class="wf-notes">
            <span class="notes-label">Notes</span>
            <p>{{ workflow()!.notes }}</p>
          </div>
        }
      </div>

      <!-- Timeline -->
      <div class="timeline-section">
        <app-timeline
          [phases]="phases()"
          (completeTask)="onCompleteTask($event)"
        />
      </div>

    }
  `,
  styleUrl: './workflow-detail.component.scss',
})
export class WorkflowDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private svc   = inject(LifecycleService);

  workflowId = 0;
  loading    = signal(true);
  workflow   = signal<WorkflowInstance | null>(null);
  saving     = signal(false);
  protected readonly statusBadge = statusBadge;

  phases      = computed(() => groupTasksByPhase(this.workflow()?.tasks ?? []));
  progressPct = computed(() => computeProgress(this.workflow()?.tasks ?? []));
  nextDue     = computed(() => findNextDueTask(this.workflow()?.tasks ?? []));
  doneTasks   = computed(() =>
    (this.workflow()?.tasks ?? []).filter(t => t.status === 'DONE' || t.status === 'SKIPPED').length);
  totalTasks  = computed(() => (this.workflow()?.tasks ?? []).length);
  isBlocked   = computed(() =>
    this.workflow()?.status === 'BLOCKED' ||
    (this.workflow()?.tasks ?? []).some(t => t.status === 'BLOCKED'));
  isOverdue   = computed(() => {
    const t = this.nextDue();
    return !!(t?.dueDate && new Date(t.dueDate) < new Date());
  });

  ngOnInit() {
    this.workflowId = Number(this.route.snapshot.paramMap.get('id'));
    this.svc.getWorkflow(this.workflowId).pipe(catchError(() => of(null)))
      .subscribe(w => { this.loading.set(false); this.workflow.set(w); });
  }

  onCompleteTask(task: WorkflowTask) {
    this.svc.completeTask(this.workflowId, task.id, {})
      .pipe(catchError(() => of(null)))
      .subscribe(updated => {
        if (updated) {
          this.workflow.update(w => w ? {
            ...w, tasks: (w.tasks ?? []).map(t => t.id === updated.id ? updated : t),
          } : w);
        }
      });
  }

  eventLabel(t: string) { return EVENT_TYPE_LABELS[t] ?? t; }
  fmtDate(iso: string | null): string {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString('fr-FR'); }
    catch { return iso; }
  }
}
