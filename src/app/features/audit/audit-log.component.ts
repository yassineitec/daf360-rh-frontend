import { Component, OnInit, signal } from '@angular/core';
import { AuditService } from '../../core/services/audit.service';
import { AuditLog } from '../../core/models/audit.model';
import { Page } from '../../core/models/page.model';

@Component({
  selector: 'app-audit-log',
  standalone: true,
  template: `
    <div class="page-header">
      <div>
        <h2 class="page-title">Audit Log</h2>
        <p class="page-subtitle">Full history of HR actions</p>
      </div>
    </div>

    @if (error()) { <div class="alert alert-error">{{ error() }}</div> }

    <div class="card">
      @if (loading()) {
        <div class="spinner-wrap"><div class="spinner"></div></div>
      } @else if (!page() || page()!.content.length === 0) {
        <div class="empty-state"><p>No audit entries found.</p></div>
      } @else {
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Entity ID</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              @for (log of page()!.content; track log.id) {
                <tr>
                  <td class="text-muted mono">{{ log.createdAt.slice(0,16).replace('T',' ') }}</td>
                  <td>
                    <span class="mono" style="font-size:0.75rem">{{ log.actorId }}</span>
                  </td>
                  <td>
                    <span class="badge badge-dark">{{ log.action }}</span>
                  </td>
                  <td>{{ log.entity }}</td>
                  <td class="mono">{{ log.entityId ?? '—' }}</td>
                  <td class="text-muted">{{ log.ip ?? '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        @if (page()!.totalPages > 1) {
          <div class="pagination">
            <span class="page-info">
              Page {{ page()!.number + 1 }} of {{ page()!.totalPages }} —
              {{ page()!.totalElements }} entries
            </span>
            <button class="page-btn" [disabled]="page()!.first"  (click)="load(page()!.number - 1)">‹</button>
            <button class="page-btn" [disabled]="page()!.last"   (click)="load(page()!.number + 1)">›</button>
          </div>
        }
      }
    </div>
  `,
})
export class AuditLogComponent implements OnInit {
  page    = signal<Page<AuditLog> | null>(null);
  loading = signal(true);
  error   = signal('');

  constructor(private auditService: AuditService) {}

  ngOnInit(): void { this.load(0); }

  load(page: number): void {
    this.loading.set(true);
    this.auditService.logs(page).subscribe({
      next:  (p) => { this.page.set(p); this.loading.set(false); },
      error: (e) => { this.error.set(e.error?.message ?? 'Failed to load audit logs'); this.loading.set(false); },
    });
  }
}
