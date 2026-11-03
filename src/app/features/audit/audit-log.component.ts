import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { StatusBadgeComponent } from '@khalilrebhiitec/daf360';
import { DafModalComponent } from '../../shared/daf-modal.component';
import { AuditService } from '../../core/services/audit.service';
import { EmployeeService } from '../../core/services/employee.service';
import { AuditLog } from '../../core/models/audit.model';
import { Page } from '../../core/models/page.model';
import {
  tableLabel, tableDomain, recordIdentity, rowEmployeeProfileId, computeFieldDiffs, groupBatches,
  actionVariant, domainVariant, FieldDiff, DisplayRow,
} from './audit-display.util';

@Component({
  selector: 'app-audit-log',
  standalone: true,
  imports: [TranslatePipe, DafModalComponent, StatusBadgeComponent],
  template: `
    <div class="page-header">
      <div>
        <h2 class="page-title">{{ 'AUDIT.TITLE' | translate }}</h2>
        <p class="page-subtitle">{{ 'AUDIT.SUBTITLE' | translate }}</p>
      </div>
    </div>

    @if (error()) { <div class="alert alert-error">{{ error() }}</div> }

    <div class="card">
      @if (loading()) {
        <div class="spinner-wrap"><div class="spinner"></div></div>
      } @else if (!page() || page()!.content.length === 0) {
        <div class="empty-state"><p>{{ 'AUDIT.EMPTY' | translate }}</p></div>
      } @else {
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>{{ 'AUDIT.COL_DATE' | translate }}</th>
                <th>{{ 'AUDIT.COL_DOMAIN' | translate }}</th>
                <th>{{ 'AUDIT.COL_SOURCE' | translate }}</th>
                <th>{{ 'AUDIT.COL_ACTOR' | translate }}</th>
                <th>{{ 'AUDIT.COL_ACTION' | translate }}</th>
                <th>{{ 'AUDIT.COL_ENTITY' | translate }}</th>
                <th>{{ 'AUDIT.COL_ENTITY_ID' | translate }}</th>
                <th>{{ 'AUDIT.COL_EMPLOYEE' | translate }}</th>
                <th>{{ 'AUDIT.COL_IP' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (row of displayRows(); track rowKey(row)) {
                @if (row.kind === 'group') {
                  <tr class="audit-row-clickable" (click)="openGroup(row.members)">
                    <td class="text-muted">
                      <span class="ledger-rail ledger-rail-group" [style.--rail-color]="railColor(row.action)">
                        {{ row.timestamp.slice(0,16).replace('T',' ') }}
                      </span>
                    </td>
                    <td><daf-badge [label]="tableDomain(row.entityType)" [options]="{ variant: domainVariant(tableDomain(row.entityType)), size: 'sm' }" /></td>
                    <td><span class="badge badge-dark">{{ 'AUDIT.SOURCE_FIELD_CHANGE' | translate }}</span></td>
                    <td><span class="mono" style="font-size:0.75rem">{{ 'AUDIT.ACTOR_SYSTEM' | translate }}</span></td>
                    <td><daf-badge [label]="'AUDIT.ACTION_' + row.action | translate" [options]="{ variant: actionVariant(row.action), size: 'sm' }" /></td>
                    <td>{{ tableLabel(row.entityType) }}</td>
                    <td class="mono group-cell" [title]="'AUDIT.GROUP_HINT' | translate">
                      <span class="material-symbols-outlined group-icon">schedule</span>
                      {{ 'AUDIT.GROUP_LABEL' | translate: { count: row.members.length } }}
                    </td>
                    <td class="text-muted">—</td>
                    <td class="text-muted">—</td>
                  </tr>
                } @else {
                  <tr class="audit-row-clickable" (click)="openDetail(row.entry)">
                    <td class="text-muted">
                      <span class="ledger-rail" [style.--rail-color]="railColor(row.entry.action)">
                        {{ row.entry.timestamp.slice(0,16).replace('T',' ') }}
                      </span>
                    </td>
                    <td>
                      @if (row.entry.source === 'GENERIC') {
                        <daf-badge [label]="tableDomain(row.entry.entityType)" [options]="{ variant: domainVariant(tableDomain(row.entry.entityType)), size: 'sm' }" />
                      } @else { <span class="text-muted">—</span> }
                    </td>
                    <td>
                      <span class="badge" [class.badge-dark]="row.entry.source === 'EVENT_LOG'">
                        {{ (row.entry.source === 'EVENT_LOG' ? 'AUDIT.SOURCE_EVENT' : 'AUDIT.SOURCE_FIELD_CHANGE') | translate }}
                      </span>
                    </td>
                    <td><span class="mono" style="font-size:0.75rem">{{ row.entry.actor ?? '—' }}</span></td>
                    <td>
                      @if (row.entry.source === 'GENERIC') {
                        <daf-badge [label]="'AUDIT.ACTION_' + row.entry.action | translate" [options]="{ variant: actionVariant(row.entry.action), size: 'sm' }" />
                      } @else { <span class="badge badge-dark">{{ row.entry.action }}</span> }
                    </td>
                    <td>{{ row.entry.source === 'GENERIC' ? tableLabel(row.entry.entityType) : row.entry.entityType }}</td>
                    <td class="mono">{{ row.entry.source === 'GENERIC' ? recordIdentity(row.entry) : (row.entry.entityId ?? '—') }}</td>
                    <td>{{ employeeLabelFor(row.entry) }}</td>
                    <td class="text-muted">{{ row.entry.ip ?? '—' }}</td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>

        @if (page()!.totalPages > 1) {
          <div class="pagination">
            <span class="page-info">
              {{ 'AUDIT.PAGE_INFO' | translate: { current: page()!.number + 1, total: page()!.totalPages, count: page()!.totalElements } }}
            </span>
            <button class="page-btn" [disabled]="page()!.first"  (click)="load(page()!.number - 1)">‹</button>
            <button class="page-btn" [disabled]="page()!.last"   (click)="load(page()!.number + 1)">›</button>
          </div>
        }
      }
    </div>

    <app-daf-modal [title]="'AUDIT.DETAIL_TITLE' | translate" [visible]="detailOpen()" size="lg"
               [hasFooter]="true" (closed)="detailOpen.set(false)">
      @if (activeEntry(); as entry) {
        <div class="detail-meta">
          <div><span class="detail-meta-label">{{ 'AUDIT.COL_DATE' | translate }}</span>{{ entry.timestamp.slice(0,19).replace('T',' ') }}</div>
          <div><span class="detail-meta-label">{{ 'AUDIT.COL_DOMAIN' | translate }}</span>{{ entry.source === 'GENERIC' ? tableDomain(entry.entityType) : '—' }}</div>
          <div><span class="detail-meta-label">{{ 'AUDIT.COL_ENTITY' | translate }}</span>{{ entry.source === 'GENERIC' ? tableLabel(entry.entityType) : entry.entityType }}</div>
          <div><span class="detail-meta-label">{{ 'AUDIT.COL_ACTION' | translate }}</span>{{ entry.source === 'GENERIC' ? ('AUDIT.ACTION_' + entry.action | translate) : entry.action }}</div>
          <div><span class="detail-meta-label">{{ 'AUDIT.COL_ENTITY_ID' | translate }}</span>{{ entry.source === 'GENERIC' ? recordIdentity(entry) : (entry.entityId ?? '—') }}</div>
          <div><span class="detail-meta-label">{{ 'AUDIT.COL_EMPLOYEE' | translate }}</span>{{ employeeLabelFor(entry) }}</div>
          <div><span class="detail-meta-label">{{ 'AUDIT.COL_ACTOR' | translate }}</span>{{ entry.actor ?? ('AUDIT.ACTOR_SYSTEM' | translate) }}</div>
        </div>

        @if (activeDiff().length === 0) {
          <p class="text-muted">{{ 'AUDIT.DETAIL_NO_FIELDS' | translate }}</p>
        } @else {
          <div class="diff-list">
            @for (d of activeDiff(); track d.field) {
              <div class="diff-row">
                <div class="diff-field-name">{{ d.field }}</div>
                @if (d.changed) {
                  <div class="diff-line diff-line-removed"><span class="diff-marker">−</span>{{ d.before }}</div>
                  <div class="diff-line diff-line-added"><span class="diff-marker">+</span>{{ d.after }}</div>
                } @else {
                  <div class="diff-line diff-line-unchanged">{{ d.after }}</div>
                }
              </div>
            }
          </div>
        }
      }
      <div slot="footer">
        <button class="page-btn" (click)="detailOpen.set(false)">{{ 'AUDIT.CLOSE' | translate }}</button>
      </div>
    </app-daf-modal>

    <app-daf-modal [title]="'AUDIT.GROUP_MODAL_TITLE' | translate" [visible]="groupOpen()" size="lg"
               [hasFooter]="true" (closed)="groupOpen.set(false)">
      @if (activeGroup(); as members) {
        <p class="text-muted">{{ 'AUDIT.GROUP_MODAL_HINT' | translate }}</p>
        <table class="diff-table group-members-table">
          <thead>
            <tr>
              <th>{{ 'AUDIT.COL_DATE' | translate }}</th>
              <th>{{ 'AUDIT.COL_ENTITY_ID' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (m of members; track m.id) {
              <tr class="group-member-row" (click)="openDetailFromGroup(m)">
                <td>{{ m.timestamp.slice(0,19).replace('T',' ') }}</td>
                <td>{{ recordIdentity(m) }}</td>
              </tr>
            }
          </tbody>
        </table>
      }
      <div slot="footer">
        <button class="page-btn" (click)="groupOpen.set(false)">{{ 'AUDIT.CLOSE' | translate }}</button>
      </div>
    </app-daf-modal>
  `,
  styles: [`
    .audit-row-clickable { cursor: pointer; }
    .audit-row-clickable:hover { background: #f8fafc; }

    /* ── Ledger rail: a thin coloured spine on the date cell, keyed to the action ── */
    .ledger-rail { position: relative; display: inline-block; padding-left: 0.65rem;
      font-family: ui-monospace, 'Consolas', monospace; font-size: 0.75rem; color: #475569; }
    .ledger-rail::before { content: ''; position: absolute; left: 0; top: 1px; bottom: 1px;
      width: 3px; border-radius: 2px; background: var(--rail-color, #cbd5e1); }
    .ledger-rail-group::before { background-image:
      repeating-linear-gradient(to bottom, var(--rail-color, #cbd5e1) 0 3px, transparent 3px 6px);
      background-color: transparent; }

    .group-cell { font-style: italic; color: #475569; display: inline-flex; align-items: center; gap: 0.35rem; }
    .group-icon { font-size: 15px; color: #64748b; }

    .detail-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem 1.5rem; margin-bottom: 1.25rem;
      font-size: 0.8rem; }
    .detail-meta-label { display: block; font-size: 0.7rem; font-weight: 600; color: #94a3b8; }

    /* ── Field diff: a version-control-style +/- list, one entry per changed field ── */
    .diff-list { display: flex; flex-direction: column; font-size: 0.8rem;
      font-family: ui-monospace, 'Consolas', monospace; }
    .diff-row { padding: 0.5rem 0; border-bottom: 1px solid #f1f5f9; }
    .diff-field-name { font-family: -apple-system, sans-serif; font-weight: 600; color: #64748b;
      font-size: 0.75rem; margin-bottom: 0.25rem; }
    .diff-line { padding: 0.15rem 0.5rem; border-radius: 4px; white-space: pre-wrap; word-break: break-word; }
    .diff-marker { display: inline-block; width: 1.2em; font-weight: 700; }
    .diff-line-removed { background: #fef2f2; color: #991b1b; }
    .diff-line-removed .diff-marker { color: #dc2626; }
    .diff-line-added { background: #f0fdf4; color: #166534; margin-top: 2px; }
    .diff-line-added .diff-marker { color: #16a34a; }
    .diff-line-unchanged { color: #94a3b8; }

    .diff-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
    .diff-table th { text-align: left; padding: 0.5rem 0.75rem; background: #f8fafc; color: #475569;
      font-weight: 700; font-size: 0.7rem; border-bottom: 1px solid #e2e8f0; }
    .diff-table td { padding: 0.5rem 0.75rem; border-bottom: 1px solid #f1f5f9; vertical-align: top;
      word-break: break-word; }
    .group-members-table .group-member-row { cursor: pointer; }
    .group-members-table .group-member-row:hover { background: #eff6ff; }
  `],
})
export class AuditLogComponent implements OnInit {
  private readonly translate = inject(TranslateService);
  private readonly employeeService = inject(EmployeeService);

  page    = signal<Page<AuditLog> | null>(null);
  loading = signal(true);
  error   = signal('');

  detailOpen  = signal(false);
  groupOpen   = signal(false);
  activeEntry = signal<AuditLog | null>(null);
  activeGroup = signal<AuditLog[] | null>(null);

  /** employee_profile_id -> "Prénom Nom", resolved lazily for whichever ids show up on the
   *  current page. A placeholder is shown (and kept) if the lookup 404s. */
  private employeeLabels = signal<Record<number, string>>({});

  readonly displayRows = computed<DisplayRow<AuditLog>[]>(() =>
    groupBatches(this.page()?.content ?? []));

  readonly activeDiff = computed<FieldDiff[]>(() => {
    const entry = this.activeEntry();
    return entry ? computeFieldDiffs(entry) : [];
  });

  readonly tableLabel = tableLabel;
  readonly tableDomain = tableDomain;
  readonly recordIdentity = recordIdentity;
  readonly actionVariant = actionVariant;
  readonly domainVariant = domainVariant;

  /** The ledger rail's colour, by action -- same green/blue/red convention as the action badge,
   *  just restated as a CSS colour since the rail is a plain border, not a `daf-badge`. Also used
   *  for EVENT_LOG rows (an arbitrary action string), which fall through to the neutral blue. */
  railColor(action: string): string {
    switch (action) {
      case 'I': return '#15803d';
      case 'D': return '#b91c1c';
      case 'U': return '#2563eb';
      default:  return '#94a3b8';
    }
  }

  constructor(private auditService: AuditService) {}

  ngOnInit(): void { this.load(0); }

  load(page: number): void {
    this.loading.set(true);
    this.auditService.logs(page).subscribe({
      next:  (p) => { this.page.set(p); this.loading.set(false); this.resolveEmployees(p.content); },
      error: (e) => { this.error.set(e.error?.message ?? this.translate.instant('AUDIT.ERROR')); this.loading.set(false); },
    });
  }

  employeeLabelFor(entry: AuditLog): string {
    if (entry.source !== 'GENERIC') return '—';
    const id = rowEmployeeProfileId(entry);
    if (id === null) return '—';
    return this.employeeLabels()[id] ?? this.translate.instant('AUDIT.EMPLOYEE_PLACEHOLDER', { id });
  }

  /** Resolves whichever employee_profile_ids appear on this page and aren't already cached --
   *  at most a handful of individual GETs per page (same pattern as Facturation's affaire
   *  resolution in audit-trail-admin.component.ts). */
  private resolveEmployees(entries: AuditLog[]): void {
    const known = this.employeeLabels();
    const missing = Array.from(new Set(
      entries
        .filter(e => e.source === 'GENERIC')
        .map(rowEmployeeProfileId)
        .filter((id): id is number => id !== null && !(id in known))
    ));
    if (missing.length === 0) return;

    forkJoin(missing.map(id => this.employeeService.get(id).pipe(
      catchError(() => of(null)),
    ))).subscribe(results => {
      const next = { ...this.employeeLabels() };
      results.forEach((employee, i) => {
        if (employee) next[missing[i]] = `${employee.firstName} ${employee.lastName}`;
      });
      this.employeeLabels.set(next);
    });
  }

  rowKey(row: DisplayRow<AuditLog>): string {
    return row.kind === 'group'
      ? `group-${row.members[0].source}:${row.members[0].id}`
      : `${row.entry.source}:${row.entry.id}`;
  }

  openDetail(entry: AuditLog): void {
    this.activeEntry.set(entry);
    this.detailOpen.set(true);
  }

  openGroup(members: AuditLog[]): void {
    this.activeGroup.set(members);
    this.groupOpen.set(true);
  }

  /** Clicking a member inside the group modal replaces it with that entry's own detail. */
  openDetailFromGroup(entry: AuditLog): void {
    this.groupOpen.set(false);
    this.openDetail(entry);
  }
}
