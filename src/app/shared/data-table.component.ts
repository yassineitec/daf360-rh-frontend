import {
  Component, computed, input, output, signal,
} from '@angular/core';

export interface TableColumn<T = unknown> {
  key:        keyof T | string;
  label:      string;
  sortable?:  boolean;
  width?:     string;
  align?:     'left' | 'center' | 'right';
}

@Component({
  selector: 'app-data-table',
  standalone: true,
  template: `
    <div class="table-wrapper">

      @if (loading()) {
        <div class="table-loading" aria-live="polite">
          @for (_ of loadingRows(); track $index) {
            <div class="loading-row"></div>
          }
        </div>
      }

      @if (!loading() && rows().length === 0) {
        <div class="table-empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
          <p>{{ emptyMessage() }}</p>
        </div>
      }

      @if (!loading() && rows().length > 0) {
        <table class="table" role="table">
          <thead>
            <tr>
              @for (col of columns(); track col.key) {
                <th
                  [style.width]="col.width"
                  [class.sortable]="col.sortable"
                  [class.sorted]="sortKey() === col.key"
                  (click)="col.sortable && toggleSort(col.key)"
                >
                  {{ col.label }}
                  @if (col.sortable) {
                    <svg class="sort-icon" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M7 14l5-5 5 5H7z" [class.asc]="sortKey() === col.key && sortDir() === 'asc'"/>
                      <path d="M17 10l-5 5-5-5h10z" [class.asc]="sortKey() === col.key && sortDir() === 'desc'"/>
                    </svg>
                  }
                </th>
              }
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track $index) {
              <tr (click)="rowClick.emit(row)">
                @for (col of columns(); track col.key) {
                  <td [style.textAlign]="col.align ?? 'left'">
                    {{ getCellValue(row, col.key) }}
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      }

      @if (totalPages() > 1) {
        <div class="table-pagination">
          <span class="pagination-info">{{ (page() - 1) * pageSize() + 1 }}–{{ min(page() * pageSize(), total()) }} sur {{ total() }}</span>
          <div class="pagination-controls">
            <button (click)="prevPage()" [disabled]="page() <= 1">‹</button>
            <span>{{ page() }} / {{ totalPages() }}</span>
            <button (click)="nextPage()" [disabled]="page() >= totalPages()">›</button>
          </div>
        </div>
      }

    </div>
  `,
  styles: [`
    .table-wrapper { overflow-x: auto; }

    .table {
      width: 100%; border-collapse: collapse; font-size: 13px;
      th, td { padding: 10px 14px; text-align: left; }
      th {
        background: var(--color-bg-secondary, #EEF2F5);
        font-weight: 600; font-size: 11px; letter-spacing: .5px;
        text-transform: uppercase; color: var(--color-text-muted, #6B7280);
        border-bottom: 1px solid var(--color-border, #E0E7E9);
        white-space: nowrap;
        &.sortable { cursor: pointer; user-select: none;
          &:hover { color: var(--color-text, #1A1C1E); } }
      }
      tr:not(:last-child) td { border-bottom: 1px solid var(--color-border, #E0E7E9); }
      tr:hover td { background: var(--color-bg, #F8FAFB); }
    }

    .table-empty {
      padding: 48px 24px;
      display: flex; flex-direction: column; align-items: center; gap: 12px;
      color: var(--color-text-muted, #6B7280);
      svg { opacity: .4; }
      p { margin: 0; font-size: 13px; }
    }

    .table-loading { padding: 16px; display: flex; flex-direction: column; gap: 8px; }
    .loading-row {
      height: 36px; background: linear-gradient(90deg, #e8ecef 25%, #f0f4f8 50%, #e8ecef 75%);
      background-size: 200% 100%; border-radius: 4px;
      animation: shimmer 1.4s infinite;
    }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

    .table-pagination {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 16px; border-top: 1px solid var(--color-border, #E0E7E9);
      font-size: 12px; color: var(--color-text-muted, #6B7280);
    }
    .pagination-controls { display: flex; align-items: center; gap: 8px;
      button {
        border: 1px solid var(--color-border, #E0E7E9);
        background: none; width: 28px; height: 28px;
        border-radius: 4px; cursor: pointer; font-size: 14px;
        &:disabled { opacity: .4; cursor: default; }
        &:not(:disabled):hover { background: var(--color-bg-secondary, #EEF2F5); }
      }
    }
  `],
})
export class DataTableComponent<T extends object = Record<string, unknown>> {
  columns      = input.required<TableColumn<T>[]>();
  rows         = input<T[]>([]);
  loading      = input(false);
  total        = input(0);
  page         = input(1);
  pageSize     = input(20);
  emptyMessage = input('Aucun résultat');

  rowClick   = output<T>();
  pageChange = output<number>();
  sortChange = output<{ key: string; dir: 'asc' | 'desc' }>();

  sortKey  = signal<string | null>(null);
  sortDir  = signal<'asc' | 'desc'>('asc');

  totalPages  = computed(() => Math.ceil(this.total() / this.pageSize()) || 1);
  loadingRows = computed(() => Array.from({ length: 5 }));

  toggleSort(key: string | keyof T) {
    const k = String(key);
    if (this.sortKey() === k) {
      this.sortDir.update(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortKey.set(k);
      this.sortDir.set('asc');
    }
    this.sortChange.emit({ key: k, dir: this.sortDir() });
  }

  prevPage() { if (this.page() > 1) this.pageChange.emit(this.page() - 1); }
  nextPage() { if (this.page() < this.totalPages()) this.pageChange.emit(this.page() + 1); }

  getCellValue(row: T, key: string | keyof T): unknown {
    return (row as Record<string, unknown>)[String(key)] ?? '—';
  }

  protected min(a: number, b: number) { return Math.min(a, b); }
}
