import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { ToolbarToggleOption } from '@khalilrebhiitec/daf360';

/**
 * Cards / table switch meant to be projected into `daf-search-toolbar`, so it lands just
 * before the "Filtres" button — the toolbar's own `[views]` toggle renders *after* it.
 * Same markup and classes as that built-in toggle, so the two read as one control.
 *
 * ```html
 * <daf-search-toolbar …>
 *   <app-view-toggle [options]="viewOptions()" [(value)]="viewMode" [ariaLabel]="…" />
 * </daf-search-toolbar>
 * ```
 */
@Component({
  selector: 'app-view-toggle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex shrink-0 overflow-hidden rounded-lg border-2 border-outline-variant/30 bg-surface-container-lowest"
         role="group" [attr.aria-label]="ariaLabel() || null">
      @for (opt of options(); track opt.id) {
        <button type="button"
                [title]="opt.tooltip ?? opt.label ?? opt.id"
                [attr.aria-pressed]="value() === opt.id"
                class="flex items-center gap-1.5 p-2.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-tertiary"
                [class]="value() === opt.id ? 'bg-tertiary/15 text-teal' : 'text-outline hover:bg-surface-container'"
                (click)="value.set(opt.id)">
          <span class="material-symbols-outlined text-[20px]">{{ opt.icon }}</span>
        </button>
      }
    </div>
  `,
})
export class ViewToggleComponent {
  readonly options = input.required<ToolbarToggleOption[]>();
  readonly value = model.required<string>();
  readonly ariaLabel = input('');
}

export type ListViewMode = 'grid' | 'table';

/** The view a page last used, from localStorage — `'grid'` when unknown or storage is blocked. */
export function readStoredView(key: string): ListViewMode {
  try {
    return localStorage.getItem(key) === 'table' ? 'table' : 'grid';
  } catch {
    return 'grid';
  }
}

/** Remembers the choice per browser; a blocked storage just keeps the in-memory value. */
export function storeView(key: string, view: ListViewMode): void {
  try { localStorage.setItem(key, view); } catch { /* storage blocked */ }
}
