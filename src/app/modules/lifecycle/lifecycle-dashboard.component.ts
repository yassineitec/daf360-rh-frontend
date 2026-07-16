import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';

import { LifecycleService } from './lifecycle.service';
import {
  OffboardingWorkflowInstance, OffboardingStatus,
  OFFBOARDING_STATUS_LABELS, DEPARTURE_REASON_LABELS,
  computeProgress, findNextDueTask,
} from './models/lifecycle.model';
import {
  StatusBadgeComponent, BadgeOptions, ButtonComponent,
  DataTableComponent, DafCellDirective, TableColumn, TableConfig, TableRow,
} from '@khalilrebhiitec/daf360';
import { NewWorkflowModalComponent } from './new-workflow-modal.component';

type BadgeVariant = BadgeOptions['variant'];

const STATUS_VARIANTS: Record<OffboardingStatus, BadgeVariant> = {
  PENDING:    'neutral',
  IN_PROGRESS:'teal',
  BLOCKED:    'danger',
  VALIDATED:  'success',
  CANCELLED:  'neutral',
  ARCHIVED:   'neutral',
};

@Component({
  selector: 'app-lifecycle-dashboard',
  standalone: true,
  imports: [
    FormsModule, StatusBadgeComponent, ButtonComponent,
    NewWorkflowModalComponent, DataTableComponent, DafCellDirective,
  ],
  template: `
    <div class="page-header">
      <div>
        <h1 class="page-title">Offboarding</h1>
        <p class="page-sub">{{ rows().length }} dossier{{ rows().length !== 1 ? 's' : '' }}</p>
      </div>
      <daf-button label="Démarrer un offboarding" variant="teal" [options]="{ iconStart: 'add' }" (onClick)="showModal.set(true)" />
    </div>

    <div class="filters-bar">
      <select class="filter-select" [(ngModel)]="filterStatus" (ngModelChange)="onFilterChange()">
        <option value="">Tous les statuts</option>
        @for (s of statusOptions; track s.value) {
          <option [value]="s.value">{{ s.label }}</option>
        }
      </select>
      @if (filterStatus) {
        <daf-button label="Réinitialiser" variant="ghost" [options]="{ size: 'sm', iconStart: 'close' }" (onClick)="clearFilter()" />
      }
    </div>

    <div class="card table-card">
      @if (loading()) {
        <div class="loading-rows">
          @for (_ of [1,2,3,4,5]; track $index) { <div class="skeleton-row"></div> }
        </div>
      } @else if (filtered().length === 0) {
        <div class="empty-state">
          <span class="material-symbols-outlined" style="font-size:48px;color:var(--color-outline)">inbox</span>
          <p>Aucun dossier d'offboarding{{ filterStatus ? ' pour ce statut' : '' }}</p>
        </div>
      } @else {
        <daf-data-table [columns]="columns" [rows]="tableRows()" [config]="tableConfig" (rowClick)="open($event)">

          <ng-template dafCell="status" let-row>
            <daf-badge
              [label]="statusLabel(row['_status'])"
              [options]="{ variant: statusVariant(row['_status']), size: 'sm' }"
            />
          </ng-template>

          <ng-template dafCell="sla" let-row>
            @if (row['_slaBreached']) {
              <daf-badge label="SLA dépassé" [options]="{ variant: 'danger', size: 'sm' }" />
            } @else if (row['_overdue']) {
              <daf-badge label="En retard" [options]="{ variant: 'warning', size: 'sm' }" />
            } @else {
              <span class="cell-muted">—</span>
            }
          </ng-template>

          <ng-template dafCell="progress" let-row>
            @if (row['_hasTasks']) {
              <div class="progress-cell">
                <div class="progress-bar-sm">
                  <div class="progress-fill-sm" [style.width]="row['_pct'] + '%'" [class.done]="row['_pct'] >= 100"></div>
                </div>
                <span class="progress-pct">{{ row['_pct'] }}%</span>
              </div>
            } @else {
              <span class="cell-muted">—</span>
            }
          </ng-template>

        </daf-data-table>
      }
    </div>

    <app-new-workflow-modal
      [visible]="showModal()"
      (closed)="showModal.set(false)"
      (created)="onCreated($event)"
    />
  `,
  styles: [`
    .page-header    { display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px }
    .page-title     { font-size:22px;font-weight:700;color:var(--color-text,#1A1C1E);margin:0 }
    .page-sub       { font-size:13px;color:var(--color-text-muted,#6B7280);margin:2px 0 0 }
    .filters-bar    { display:flex;align-items:center;gap:10px;margin-bottom:16px }
    .filter-select  { padding:7px 12px;border:1px solid var(--color-border,#E0E7E9);border-radius:8px;font-size:13px;background:var(--color-surface,#fff);color:var(--color-text,#1A1C1E);min-width:180px }
    .card           { background:var(--color-surface,#fff);border:1px solid var(--color-border,#E0E7E9);border-radius:12px;overflow:hidden }
    .table-card     { padding:0 }
    .loading-rows   { padding:16px;display:flex;flex-direction:column;gap:10px }
    .skeleton-row   { height:44px;background:var(--color-bg-secondary,#F5F7F9);border-radius:6px;animation:pulse 1.4s ease-in-out infinite }
    @keyframes pulse { 0%,100%{opacity:1}50%{opacity:.5} }
    .empty-state    { padding:48px;text-align:center;color:var(--color-text-muted,#6B7280) }
    .empty-state p  { margin:8px 0 0;font-size:14px }
    .cell-muted     { color:var(--color-text-muted,#9CA3AF);font-size:13px }
    .progress-cell  { display:flex;align-items:center;gap:8px }
    .progress-bar-sm  { flex:1;height:6px;background:var(--color-bg-secondary,#E5E7EB);border-radius:3px;min-width:60px }
    .progress-fill-sm { height:100%;background:var(--color-primary,#1C4E5C);border-radius:3px;transition:width .3s }
    .progress-fill-sm.done { background:#22C55E }
    .progress-pct   { font-size:12px;font-weight:600;color:var(--color-text-muted);min-width:30px }
  `],
  styleUrl: './lifecycle-dashboard.component.scss',
})
export class LifecycleDashboardComponent implements OnInit {
  private svc    = inject(LifecycleService);
  private router = inject(Router);
  private route  = inject(ActivatedRoute);

  protected readonly OFFBOARDING_STATUS_LABELS = OFFBOARDING_STATUS_LABELS;

  loading      = signal(false);
  rows         = signal<OffboardingWorkflowInstance[]>([]);
  showModal    = signal(false);
  filterStatus = '';

  readonly filtered = computed(() => {
    const all = this.rows();
    if (!this.filterStatus) return all;
    return all.filter(r => r.status === (this.filterStatus as OffboardingStatus));
  });

  readonly columns: TableColumn[] = [
    { key: 'employee',       label: 'Employé',         width: '130px' },
    { key: 'motif',          label: 'Motif',            width: '160px' },
    { key: 'triggerDate',    label: 'Déclenchement',   width: '130px' },
    { key: 'lastWorkingDay', label: 'Dernier jour',     width: '120px' },
    { key: 'status',         label: 'Statut',           width: '130px' },
    { key: 'sla',            label: 'SLA',              width: '120px' },
    { key: 'progress',       label: 'Tâches',           width: '130px' },
  ];

  readonly tableConfig: TableConfig = { hoverable: true };

  readonly tableRows = computed<TableRow[]>(() =>
    this.filtered().map(w => {
      const pct     = computeProgress(w.tasks ?? []);
      const nextDue = findNextDueTask(w.tasks ?? []);
      const overdue = !!(nextDue?.dueDate && new Date(nextDue.dueDate) < new Date());
      return {
        employee:       w.employeeFullName ?? 'Profil #' + w.employeeProfileId,
        motif:          DEPARTURE_REASON_LABELS[w.departureReason] ?? w.departureReason,
        triggerDate:    this.fmt(w.triggerDate),
        lastWorkingDay: this.fmt(w.lastWorkingDay),
        status:         '',
        sla:            '',
        progress:       '',
        _status:        w.status,
        _slaBreached:   w.slaBreachFlag,
        _overdue:       overdue,
        _pct:           pct,
        _hasTasks:      (w.tasks?.length ?? 0) > 0,
        _source:        w,
      };
    }),
  );

  readonly statusOptions = (Object.keys(OFFBOARDING_STATUS_LABELS) as OffboardingStatus[]).map(v => ({
    value: v, label: OFFBOARDING_STATUS_LABELS[v],
  }));

  statusLabel(s: string): string  { return OFFBOARDING_STATUS_LABELS[s as OffboardingStatus] ?? s; }
  statusVariant(s: string): BadgeVariant { return STATUS_VARIANTS[s as OffboardingStatus] ?? 'neutral'; }

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.svc.listOffboarding().pipe(catchError(() => of([]))).subscribe(list => {
      this.rows.set(list);
      this.loading.set(false);
    });
  }

  onFilterChange() { /* filtered() is reactive */ }
  clearFilter()    { this.filterStatus = ''; }
  onCreated(id: number) { this.showModal.set(false); this.router.navigate([id], { relativeTo: this.route }); }

  open(row: TableRow) {
    this.router.navigate([(row['_source'] as OffboardingWorkflowInstance).id], { relativeTo: this.route });
  }

  private fmt(iso: string | null): string {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString('fr-FR'); } catch { return iso; }
  }
}
