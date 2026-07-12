import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';

import { LifecycleService } from './lifecycle.service';
import {
  WorkflowInstance, WorkflowStatus, WORKFLOW_EVENT_TYPES, EVENT_TYPE_LABELS,
  computeProgress, findNextDueTask, WorkflowFilter,
} from './models/lifecycle.model';
import {
  StatusBadgeComponent, BadgeOptions, ButtonComponent,
  DataTableComponent, DafCellDirective, TableColumn, TableConfig, TableRow, PaginationComponent,
} from '@khalilrebhiitec/daf360';
import { statusBadge } from '../../shared/status-badge.utils';
import { SlaCountdownPipe, SlaLevel } from '../../shared/sla-countdown.pipe';
import { NewWorkflowModalComponent } from './new-workflow-modal.component';

const SLA_VARIANTS: Record<SlaLevel, BadgeOptions['variant']> = {
  ok: 'success', warning: 'warning', critical: 'danger', none: 'neutral',
};

@Component({
  selector: 'app-lifecycle-dashboard',
  standalone: true,
  imports: [
    FormsModule, StatusBadgeComponent, ButtonComponent, NewWorkflowModalComponent,
    DataTableComponent, DafCellDirective, PaginationComponent,
  ],
  template: `
    <div class="page-header">
      <div>
        <h1 class="page-title">Lifecycle & Workflows</h1>
        <p class="page-sub">{{ total() }} workflow{{ total() !== 1 ? 's' : '' }}</p>
      </div>
      <daf-button label="Nouveau workflow" variant="teal" [options]="{ iconStart: 'add' }" (onClick)="showModal.set(true)" />
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
        <daf-button label="Réinitialiser" variant="ghost" [options]="{ size: 'sm', iconStart: 'close' }" (onClick)="clearFilters()" />
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
        <daf-data-table [columns]="columns" [rows]="tableRows()" [config]="tableConfig" (rowClick)="goToWorkflow($event)">
          <ng-template dafCell="eventType" let-row>
            <daf-badge [label]="row['eventType']" [options]="{ variant: 'teal', size: 'sm' }" />
          </ng-template>
          <ng-template dafCell="status" let-row>
            <daf-badge [label]="statusBadge(row['_source'].status).label" [options]="statusBadge(row['_source'].status).options" />
          </ng-template>
          <ng-template dafCell="progress" let-row>
            <div class="progress-cell">
              <div class="progress-bar">
                <div class="progress-fill" [style.width]="row['progressPct'] + '%'" [class.done]="row['progressPct'] >= 100"></div>
              </div>
              <span class="progress-pct">{{ row['progressPct'] }}%</span>
            </div>
          </ng-template>
          <ng-template dafCell="sla" let-row>
            @if (row['sla']) {
              <daf-badge [label]="row['sla'].label" [options]="{ variant: slaVariant(row['sla'].level), size: 'sm' }" />
            } @else { <span class="cell-muted">—</span> }
          </ng-template>
        </daf-data-table>

        @if (totalPages() > 1) {
          <div class="pagination">
            <daf-pagination
              [currentPage]="page()"
              [totalPages]="totalPages()"
              [totalElements]="total()"
              (pageChange)="goPage($event)" />
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
  private svc    = inject(LifecycleService);
  private router = inject(Router);
  private route  = inject(ActivatedRoute);

  private slaPipe = new SlaCountdownPipe();

  readonly columns: TableColumn[] = [
    { key: 'employee', label: 'Employé' },
    { key: 'eventType', label: "Type d'événement" },
    { key: 'status', label: 'Statut' },
    { key: 'progress', label: 'Progression' },
    { key: 'nextTask', label: 'Prochaine tâche' },
    { key: 'sla', label: 'SLA' },
    { key: 'started', label: 'Démarré' },
  ];

  readonly tableConfig: TableConfig = { hoverable: true };

  readonly tableRows = computed<TableRow[]>(() =>
    this.rows().map(row => ({
      employee: 'Profil #' + row.employeeProfileId,
      eventType: this.eventLabel(row.eventType),
      status: row.status,
      progressPct: row.progressPct ?? 0,
      nextTask: row.nextDueTask?.title ?? '—',
      sla: row.nextDueTask?.dueDate ? this.slaPipe.transform(row.nextDueTask.dueDate) : null,
      started: this.fmtDate(row.startDate),
      _source: row,
    })),
  );

  slaVariant(level: SlaLevel): BadgeOptions['variant'] {
    return SLA_VARIANTS[level];
  }

  goToWorkflow(row: TableRow): void {
    this.router.navigate([(row['_source'] as WorkflowInstance).id], { relativeTo: this.route });
  }

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
