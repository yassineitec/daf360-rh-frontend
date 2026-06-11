import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { EmployeeService } from '../../../core/services/employee.service';
import { Employee } from '../../../core/models/employee.model';
import { Page } from '../../../core/models/page.model';

@Component({
  selector: 'app-employee-list',
  standalone: true,
  imports: [RouterLink, DecimalPipe],
  template: `
    <!-- Header -->
    <div class="page-header">
      <div>
        <h2 class="page-title">Employees</h2>
        <p class="page-subtitle">{{ page()?.totalElements ?? 0 }} total employees</p>
      </div>
      <a class="btn btn-primary" routerLink="/employees/new">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.5"
                stroke-linecap="round"/>
        </svg>
        New Employee
      </a>
    </div>

    <!-- Error -->
    @if (error()) {
      <div class="alert alert-error">{{ error() }}</div>
    }

    <!-- Search + filter bar -->
    <div class="search-bar">
      <input class="search-input" type="text" placeholder="Search by name, email…"
             [value]="search()"
             (input)="onSearch($event)" />
      <select class="form-control" style="width:auto"
              [value]="statusFilter()"
              (change)="onStatusFilter($event)">
        <option value="">All statuses</option>
        <option value="ACTIVE">Active</option>
        <option value="INACTIVE">Inactive</option>
        <option value="ARCHIVED">Archived</option>
      </select>
    </div>

    <!-- Table card -->
    <div class="card">
      @if (loading()) {
        <div class="spinner-wrap"><div class="spinner"></div></div>
      } @else if (filtered().length === 0) {
        <div class="empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="8" stroke="#ccc" stroke-width="1.5"/>
            <path d="M21 21l-4.35-4.35" stroke="#ccc" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <p>No employees found</p>
        </div>
      } @else {
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Matricule</th>
                <th>Name</th>
                <th>Email</th>
                <th>Position</th>
                <th>Contract</th>
                <th>Status</th>
                <th>Leave Balance</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (emp of filtered(); track emp.id) {
                <tr>
                  <td><span class="mono">{{ emp.matricule }}</span></td>
                  <td>
                    <span class="text-strong">{{ emp.firstName }} {{ emp.lastName }}</span>
                  </td>
                  <td class="text-muted">{{ emp.email }}</td>
                  <td>{{ emp.position ?? '—' }}</td>
                  <td>
                    <span class="badge">{{ emp.contractType }}</span>
                  </td>
                  <td>
                    <span class="badge" [class.badge-dark]="emp.status === 'ACTIVE'"
                                        [class.badge-outline]="emp.status !== 'ACTIVE'">
                      {{ emp.status }}
                    </span>
                  </td>
                  <td>{{ emp.annualLeaveBalance | number:'1.1-1' }} days</td>
                  <td>
                    <div class="row-actions">
                      <a class="btn btn-ghost btn-sm" [routerLink]="['/employees', emp.id]">
                        Edit
                      </a>
                      @if (emp.status === 'ACTIVE') {
                        <button class="btn btn-ghost btn-sm" (click)="disable(emp)">
                          Disable
                        </button>
                      }
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        @if (page() && page()!.totalPages > 1) {
          <div class="pagination">
            <span class="page-info">
              Page {{ (page()!.number + 1) }} of {{ page()!.totalPages }}
            </span>
            <button class="page-btn" [disabled]="page()!.first" (click)="goTo(0)">
              ««
            </button>
            <button class="page-btn" [disabled]="page()!.first"
                    (click)="goTo(page()!.number - 1)">
              ‹
            </button>
            @for (n of pageNumbers(); track n) {
              <button class="page-btn" [class.active]="n === page()!.number"
                      (click)="goTo(n)">
                {{ n + 1 }}
              </button>
            }
            <button class="page-btn" [disabled]="page()!.last"
                    (click)="goTo(page()!.number + 1)">
              ›
            </button>
            <button class="page-btn" [disabled]="page()!.last"
                    (click)="goTo(page()!.totalPages - 1)">
              »»
            </button>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .row-actions { display: flex; gap: 4px; }
  `],
})
export class EmployeeListComponent implements OnInit {
  page    = signal<Page<Employee> | null>(null);
  loading = signal(true);
  error   = signal('');
  search  = signal('');
  statusFilter = signal('');

  constructor(private employeeService: EmployeeService) {}

  ngOnInit(): void {
    this.load(0);
  }

  load(pageNum: number): void {
    this.loading.set(true);
    this.error.set('');
    this.employeeService.list({ page: pageNum, size: 20, sort: 'lastName,asc' }).subscribe({
      next:  (p) => { this.page.set(p); this.loading.set(false); },
      error: (e) => { this.error.set(e.error?.message ?? 'Failed to load employees'); this.loading.set(false); },
    });
  }

  goTo(n: number): void { this.load(n); }

  filtered(): Employee[] {
    const all = this.page()?.content ?? [];
    const q   = this.search().toLowerCase();
    const s   = this.statusFilter();
    return all.filter((e) => {
      const matchQ = !q || `${e.firstName} ${e.lastName} ${e.email}`.toLowerCase().includes(q);
      const matchS = !s || e.status === s;
      return matchQ && matchS;
    });
  }

  pageNumbers(): number[] {
    const p = this.page();
    if (!p) return [];
    const total = p.totalPages;
    const cur   = p.number;
    const start = Math.max(0, cur - 2);
    const end   = Math.min(total - 1, cur + 2);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  onSearch(e: Event): void {
    this.search.set((e.target as HTMLInputElement).value);
  }

  onStatusFilter(e: Event): void {
    this.statusFilter.set((e.target as HTMLSelectElement).value);
  }

  disable(emp: Employee): void {
    if (!confirm(`Disable ${emp.firstName} ${emp.lastName}?`)) return;
    this.employeeService.disable(emp.id).subscribe({
      next:  () => this.load(this.page()?.number ?? 0),
      error: (e) => this.error.set(e.error?.message ?? 'Failed to disable employee'),
    });
  }
}
