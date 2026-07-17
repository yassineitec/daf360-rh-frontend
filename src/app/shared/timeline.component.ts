import {
  Component, inject, input, output,
} from '@angular/core';
import { TaskStatus } from '../modules/lifecycle/models/lifecycle.model';

export interface WorkflowTask {
  id:          number;
  title:       string;
  description?: string;
  status:      TaskStatus;
  assignedTo?: number | null;
  slaHours?:   number | null;
  dueDate?:    string | null;
}

export interface PhaseGroup {
  phase: string;
  tasks: WorkflowTask[];
}
import { SlaCountdownPipe } from './sla-countdown.pipe';
import { UserStore }        from '../core/user.store';

const TASK_STATUS_CONFIG: Record<TaskStatus, { label: string; color: string }> = {
  PENDING:     { label: 'En attente',  color: '#94A3B8' },
  IN_PROGRESS: { label: 'En cours',    color: '#3B82F6' },
  DONE:        { label: 'Terminé',     color: '#16A34A' },
  BLOCKED:     { label: 'Bloqué',      color: '#DC2626' },
  SKIPPED:     { label: 'Ignoré',      color: '#9CA3AF' },
};

@Component({
  selector: 'app-timeline',
  standalone: true,
  imports: [SlaCountdownPipe],
  template: `
    <div class="timeline">
      @for (group of phases(); track group.phase) {
        <div class="phase-group">
          <div class="phase-header">
            <span class="phase-label">{{ group.phase }}</span>
            <span class="phase-progress">{{ doneCount(group.tasks) }}/{{ group.tasks.length }}</span>
          </div>
          <ul class="task-list" role="list">
            @for (task of group.tasks; track task.id) {
              <li
                class="task-item"
                [class.task-done]="task.status === 'DONE'"
                [class.task-blocked]="task.status === 'BLOCKED'"
                role="listitem"
              >
                <button
                  class="task-check"
                  [class.checked]="task.status === 'DONE'"
                  [class.blocked]="task.status === 'BLOCKED'"
                  [disabled]="!canComplete(task)"
                  (click)="completeTask.emit(task)"
                  type="button"
                  [attr.aria-label]="'Marquer ' + task.title + ' comme complété'"
                >
                  @if (task.status === 'DONE') {
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  } @else if (task.status === 'BLOCKED') {
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  }
                </button>

                <div class="task-body">
                  <span class="task-title" [class.strikethrough]="task.status === 'DONE'">{{ task.title }}</span>
                  @if (task.description) {
                    <span class="task-desc">{{ task.description }}</span>
                  }
                  <div class="task-meta">
                    @if (task.assignedTo) {
                      <span class="meta-chip">Assigné #{{ task.assignedTo }}</span>
                    }
                    @if (task.slaHours) {
                      <span class="meta-chip">SLA {{ task.slaHours }}h</span>
                    }
                  </div>
                </div>

                <div class="task-right">
                  @if (task.dueDate && task.status !== 'DONE' && task.status !== 'SKIPPED') {
                    @let sla = task.dueDate | slaCountdown;
                    <span class="sla-chip" [class]="'sla-chip--' + sla.level">{{ sla.label }}</span>
                  }
                  <span
                    class="task-status-dot"
                    [style.background]="statusColor(task.status)"
                    [title]="statusLabel(task.status)"
                  ></span>
                </div>
              </li>
            }
          </ul>
        </div>
      }
    </div>
  `,
  styles: [`
    .timeline { display: flex; flex-direction: column; gap: 24px; }
    .phase-group {}
    .phase-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 0 8px; margin-bottom: 10px;
      border-bottom: 2px solid var(--color-primary, #1C4E5C);
    }
    .phase-label    { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .7px; color: var(--color-primary, #1C4E5C); }
    .phase-progress { font-size: 11px; color: var(--color-text-muted, #6B7280); }
    .task-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 4px; }
    .task-item {
      display: flex; align-items: flex-start; gap: 12px;
      padding: 10px 12px; border-radius: 8px;
      background: var(--color-surface, #fff);
      border: 1px solid var(--color-border, #E0E7E9);
      transition: box-shadow .15s;
    }
    .task-item:hover { box-shadow: 0 2px 8px rgba(0,0,0,.08); }
    .task-item.task-done    { opacity: .65; }
    .task-item.task-blocked { border-color: #DC2626; background: #fff5f5; }
    .task-check {
      width: 20px; height: 20px; flex-shrink: 0; margin-top: 1px;
      border-radius: 50%; border: 2px solid var(--color-border, #E0E7E9);
      background: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: all .15s;
    }
    .task-check:not(:disabled):hover { border-color: var(--color-primary, #1C4E5C); }
    .task-check.checked { background: #16A34A; border-color: #16A34A; color: #fff; }
    .task-check.blocked { background: #DC2626; border-color: #DC2626; color: #fff; }
    .task-check:disabled { opacity: .4; cursor: not-allowed; }
    .task-body     { flex: 1; display: flex; flex-direction: column; gap: 2px; }
    .task-title    { font-size: 13px; font-weight: 500; color: var(--color-text, #1A1C1E); }
    .strikethrough { text-decoration: line-through; }
    .task-desc     { font-size: 11px; color: var(--color-text-muted, #6B7280); }
    .task-meta     { display: flex; gap: 6px; margin-top: 4px; flex-wrap: wrap; }
    .meta-chip     { display: inline-block; padding: 1px 7px; border-radius: 999px; background: var(--color-bg-secondary, #EEF2F5); font-size: 10px; color: var(--color-text-muted, #6B7280); }
    .task-right    { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
    .sla-chip      { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
    .sla-chip--ok       { background: #dcfce7; color: #16A34A; }
    .sla-chip--warning  { background: #fef3c7; color: #D97706; }
    .sla-chip--critical { background: #fee2e2; color: #DC2626; }
    .sla-chip--none     { background: var(--color-bg-secondary, #EEF2F5); color: var(--color-text-muted); }
    .task-status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  `],
})
export class TimelineComponent {
  private userStore = inject(UserStore);

  phases       = input.required<PhaseGroup[]>();
  completeTask = output<WorkflowTask>();

  canComplete(task: WorkflowTask): boolean {
    if (task.status === 'DONE' || task.status === 'BLOCKED' || task.status === 'SKIPPED') return false;
    const userId = this.userStore.currentUser()?.userId;
    return !task.assignedTo || task.assignedTo === userId || this.userStore.isHrManager();
  }

  doneCount(tasks: WorkflowTask[]): number {
    return tasks.filter(t => t.status === 'DONE' || t.status === 'SKIPPED').length;
  }

  statusColor(s: TaskStatus): string { return TASK_STATUS_CONFIG[s]?.color ?? '#94A3B8'; }
  statusLabel(s: TaskStatus): string { return TASK_STATUS_CONFIG[s]?.label ?? s; }
}
