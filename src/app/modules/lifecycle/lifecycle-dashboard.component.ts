import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';

import { LifecycleService } from './lifecycle.service';
import {
  WorkflowInstance, WorkflowStatus, WORKFLOW_EVENT_TYPES, EVENT_TYPE_LABELS,
  computeProgress, findNextDueTask, WorkflowFilter,
} from './models/lifecycle.model';
import { StatusBadgeComponent } from '@khalilrebhiitec/daf360';
import { statusBadge } from '../../shared/status-badge.utils';
import { SlaCountdownPipe }          from '../../shared/sla-countdown.pipe';
import { SpinnerComponent }          from '../../shared/spinner.component';
import { NewWorkflowModalComponent } from './new-workflow-modal.component';

@Component({
  selector: 'app-lifecycle-dashboard',
  standalone: true,
  imports: [RouterLink, FormsModule, StatusBadgeComponent, SlaCountdownPipe, SpinnerComponent, NewWorkflowModalComponent],
  template: `
    <div class="page-header">
      <div>
        <h1 class="page-title">Lifecycle & Workflows</h1>
        <p class="page-sub">{{ total() }} workflow{{ total() !== 1 ? 's' : '' }}</p>
      </div>
      <button class="btn-primary" (click)="showModal.set(true)" type="button">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Nouveau workflow
      </button>
    </div>

    <div class="filters-bar">
      <select class="filter-select" [(ngModel)]="filterStatus" (ngModelChange)="reload()">
        <option value="">Tous les statuts</option>
        @for (s of statusOptions; track s.value) { <option [value]="s.value">{{ s.label }}</option> }
      </select>
      <select class="filter-select" [(ngModel)]="filterEventType" (ngModelChange)="reload()">
        <option value="">Tous les types</option>
        @for (t of eventTypes; track t) { <option [value]="t">{{ eventLabel(t) }}</option> }
      </select>
      @if (filterStatus || filterEventType) {
        <button class="clear-btn" (click)="clearFilters()" type="button">✕ Réinitialiser</button>
      }
    </div>

    <div class="card table-card">
      @if (loading()) {
        <div class="loading-rows">
          @for (_ of [1,2,3,4]; track $index) { <div class="skeleton-row"></div> }
        </div>
      } @else if (rows().length === 0) {
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
            <circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
          <p>Aucun workflow trouvé</p>
        </div>
      } @else {
        <table class="data-table">
          <thead>
            <tr>
              <th>Employé</th>
              <th>Type d'événement</th>
              <th>Statut</th>
              <th>Progression</th>
              <th>Prochaine tâche</th>
              <th>SLA</th>
              <th>Démarré</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.id) {
              <tr class="data-row" [routerLink]="[row.id]">
                <td class="cell-id">Profil #{{ row.employeeProfileId }}</td>
                <td><span class="event-chip">{{ eventLabel(row.eventType) }}</span></td>
                <td><daf-badge [label]="statusBadge(row.status).label" [options]="statusBadge(row.status).options" /></td>
                <td>
                  <div class="progress-cell">
                    <div class="progress-bar">
                      <div class="progress-fill" [style.width]="(row.progressPct ?? 0) + '%'"
                           [class.done]="(row.progressPct ?? 0) >= 100"></div>
                    </div>
                    <span class="progress-pct">{{ row.progressPct ?? 0 }}%</span>
                  </div>
                </td>
                <td class="cell-muted">{{ row.nextDueTask?.title ?? '—' }}</td>
                <td>
                  @if (row.nextDueTask?.dueDate) {
                    @let sla = row.nextDueTask!.dueDate | slaCountdown;
                    <span class="sla-chip" [class]="'sla-chip--' + sla.level">{{ sla.label }}</span>
                  } @else { <span class="cell-muted">—</span> }
                </td>
                <td class="cell-muted">{{ fmtDate(row.startDate) }}</td>
                <td class="cell-action">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </td>
              </tr>
            }
          </tbody>
        </table>

        @if (totalPages() > 1) {
          <div class="pagination">
            <span class="pag-info">{{ page() + 1 }} / {{ totalPages() }}</span>
            <div class="pag-controls">
              <button (click)="goPage(page() - 1)" [disabled]="page() <= 0" type="button">‹</button>
              <button (click)="goPage(page() + 1)" [disabled]="page() >= totalPages() - 1" type="button">›</button>
            </div>
          </div>
        }
      }
    </div>

    <app-new-workflow-modal
      [visible]="showModal()"
      (closed)="showModal.set(false)"
      (created)="onCreated()"
    />
  `,
  styleUrl: './lifecycle-dashboard.component.scss',
})
export class LifecycleDashboardComponent implements OnInit {
  private svc = inject(LifecycleService);

  loading    = signal(false);
  rows       = signal<WorkflowInstance[]>([]);
  total      = signal(0);
  totalPages = signal(1);
  page       = signal(0);
  showModal  = signal(false);

  filterStatus    = '';
  filterEventType = '';
  protected readonly statusBadge = statusBadge;

  readonly statusOptions = [
    { value: 'OPEN',        label: 'Ouvert' },
    { value: 'IN_PROGRESS', label: 'En cours' },
    { value: 'BLOCKED',     label: 'Bloqué' },
    { value: 'COMPLETED',   label: 'Terminé' },
    { value: 'CANCELLED',   label: 'Annulé' },
  ];
  readonly eventTypes = [...WORKFLOW_EVENT_TYPES];

  eventLabel(t: string) { return EVENT_TYPE_LABELS[t] ?? t; }

  ngOnInit() { this.reload(); }

  reload(resetPage = true) {
    if (resetPage) this.page.set(0);
    this.loading.set(true);

    const filter: WorkflowFilter = {
      status:    (this.filterStatus || undefined) as WorkflowStatus | undefined,
      eventType:  this.filterEventType || undefined,
      page:       this.page(),
      size:       20,
    };

    this.svc.listWorkflows(filter).pipe(catchError(() => of(null))).subscribe(res => {
      this.loading.set(false);
      if (res) {
        this.rows.set(res.content.map(w => ({
          ...w,
          progressPct:  computeProgress(w.tasks ?? []),
          nextDueTask:  findNextDueTask(w.tasks ?? []),
        })));
        this.total.set(res.totalElements);
        this.totalPages.set(res.totalPages);
      }
    });
  }

  goPage(p: number) { this.page.set(p); this.reload(false); }
  clearFilters() { this.filterStatus = ''; this.filterEventType = ''; this.reload(); }
  onCreated() { this.showModal.set(false); this.reload(); }
  fmtDate(iso: string | null): string {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString('fr-FR'); }
    catch { return iso; }
  }
}
