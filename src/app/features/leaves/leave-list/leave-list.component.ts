import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LeaveService } from '../../../core/services/leave.service';
import { Leave, AbsenceType } from '../../../core/models/leave.model';
import { Page } from '../../../core/models/page.model';

const ABSENCE_LABELS: Record<AbsenceType, string> = {
  PAID_LEAVE: 'Paid Leave', SICK_LEAVE: 'Sick Leave', UNPAID_LEAVE: 'Unpaid Leave',
  RTT: 'RTT', MATERNITY_LEAVE: 'Maternity', PATERNITY_LEAVE: 'Paternity',
  TRAINING: 'Training', EXCEPTIONAL: 'Exceptional',
};

@Component({
  selector: 'app-leave-list',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="page-header">
      <div>
        <h2 class="page-title">Leave Requests</h2>
        <p class="page-subtitle">Pending approval queue</p>
      </div>
      <a class="btn btn-primary" routerLink="/leaves/new">+ New Request</a>
    </div>

    @if (error()) { <div class="alert alert-error">{{ error() }}</div> }

    <div class="card">
      @if (loading()) {
        <div class="spinner-wrap"><div class="spinner"></div></div>
      } @else if (!page() || page()!.content.length === 0) {
        <div class="empty-state">
          <p>No pending leave requests.</p>
        </div>
      } @else {
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Employee</th>
                <th>Type</th>
                <th>From</th>
                <th>To</th>
                <th>Days</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (leave of page()!.content; track leave.id) {
                <tr>
                  <td class="mono">#{{ leave.id }}</td>
                  <td>{{ leave.employeeId }}</td>
                  <td>
                    <span class="badge">{{ absenceLabel(leave.absenceType) }}</span>
                  </td>
                  <td>{{ leave.startDate }}</td>
                  <td>{{ leave.endDate }}</td>
                  <td>{{ leave.workingDays ?? '—' }}</td>
                  <td>
                    <span class="badge" [class.badge-dark]="leave.status === 'HR_APPROVED'"
                                        [class.badge-outline]="leave.status === 'REJECTED' || leave.status === 'CANCELLED'">
                      {{ leave.status }}
                    </span>
                  </td>
                  <td>
                    <div style="display:flex; gap:4px">
                      @if (leave.status === 'PENDING') {
                        <button class="btn btn-ghost btn-sm"
                                (click)="approveManager(leave)">Mgr ✓</button>
                      }
                      @if (leave.status === 'MANAGER_APPROVED') {
                        <button class="btn btn-ghost btn-sm"
                                (click)="approveHr(leave)">HR ✓</button>
                      }
                      @if (leave.status === 'PENDING' || leave.status === 'MANAGER_APPROVED') {
                        <button class="btn btn-danger btn-sm"
                                (click)="reject(leave)">Reject</button>
                      }
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        @if (page()!.totalPages > 1) {
          <div class="pagination">
            <span class="page-info">Page {{ page()!.number + 1 }} / {{ page()!.totalPages }}</span>
            <button class="page-btn" [disabled]="page()!.first"  (click)="load(page()!.number - 1)">‹</button>
            <button class="page-btn" [disabled]="page()!.last"   (click)="load(page()!.number + 1)">›</button>
          </div>
        }
      }
    </div>
  `,
})
export class LeaveListComponent implements OnInit {
  page    = signal<Page<Leave> | null>(null);
  loading = signal(true);
  error   = signal('');

  constructor(private leaveService: LeaveService) {}

  ngOnInit(): void { this.load(0); }

  load(page: number): void {
    this.loading.set(true);
    this.leaveService.pending(page).subscribe({
      next:  (p) => { this.page.set(p); this.loading.set(false); },
      error: (e) => { this.error.set(e.error?.message ?? 'Failed to load leaves'); this.loading.set(false); },
    });
  }

  approveManager(leave: Leave): void {
    const managerId = Number(prompt('Enter your Manager ID:'));
    if (!managerId) return;
    this.leaveService.approveManager(leave.id, managerId).subscribe({
      next:  () => this.load(this.page()?.number ?? 0),
      error: (e) => this.error.set(e.error?.message ?? 'Failed to approve'),
    });
  }

  approveHr(leave: Leave): void {
    const hrId = Number(prompt('Enter your HR User ID:'));
    if (!hrId) return;
    this.leaveService.approveHr(leave.id, hrId).subscribe({
      next:  () => this.load(this.page()?.number ?? 0),
      error: (e) => this.error.set(e.error?.message ?? 'Failed to approve'),
    });
  }

  reject(leave: Leave): void {
    const reason = prompt('Rejection reason:');
    if (!reason) return;
    this.leaveService.reject(leave.id, reason).subscribe({
      next:  () => this.load(this.page()?.number ?? 0),
      error: (e) => this.error.set(e.error?.message ?? 'Failed to reject'),
    });
  }

  absenceLabel(type: AbsenceType): string {
    return ABSENCE_LABELS[type] ?? type;
  }
}
