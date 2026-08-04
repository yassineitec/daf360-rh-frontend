import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * How the row is tinted. Mirrors the state language of `daf-accordion-card` so a
 * returned asset and a completed stage read the same green.
 */
export type ListRowState = 'default' | 'done' | 'urgent' | 'muted';

/**
 * One line of a checklist: icon tile · title · meta, with whatever control the
 * caller needs on the right (`[trailing]`).
 *
 * Lives app-side rather than in the lib on purpose: all four current callers are
 * on `/rh/offboarding/:id` (asset inventory, handover checklist, access list, Kit
 * RH tiles). A lib component earns its keep at the *second page* — promote this
 * file verbatim when IT-provisioning or another module wants it.
 *
 * `state` maps to whole literal classes below — a class assembled at runtime would
 * never survive the consuming app's Tailwind scan (UI-PLAYBOOK §3).
 */
@Component({
  selector: 'rh-list-row',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="flex items-center justify-between gap-3 rounded-xl border p-4 transition-colors"
         [class]="shellClass()">

      <div class="flex min-w-0 items-center gap-3">
        @if (icon()) {
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
               [class]="tileClass()">
            <span class="material-symbols-outlined text-[20px]">{{ icon() }}</span>
          </div>
        }
        <div class="min-w-0">
          <p class="truncate text-[14px] font-bold text-on-surface">{{ title() }}</p>
          @if (meta()) {
            <p class="truncate text-[10px] font-medium" [class]="metaClass()">{{ meta() }}</p>
          }
        </div>
      </div>

      <div class="flex shrink-0 items-center gap-2">
        <ng-content select="[trailing]" />
      </div>
    </div>
  `,
})
export class ListRowComponent {
  readonly icon  = input<string>('');
  readonly title = input.required<string>();
  readonly meta  = input<string | null | undefined>(null);
  readonly state = input<ListRowState>('default');

  protected readonly shellClass = computed(() => {
    switch (this.state()) {
      case 'done':   return 'border-tertiary/25 bg-tertiary/5';
      case 'urgent': return 'border-danger/25 bg-danger/5';
      case 'muted':  return 'border-outline-variant/20 bg-surface-container-low/60';
      default:       return 'border-outline-variant/20 bg-surface-container-lowest hover:border-outline-variant/50';
    }
  });

  protected readonly tileClass = computed(() => {
    switch (this.state()) {
      case 'done':   return 'bg-tertiary/10 text-tertiary';
      case 'urgent': return 'bg-danger/10 text-danger';
      default:       return 'bg-surface-container text-on-surface-variant';
    }
  });

  /** Meta line takes the state colour so "Validé le 08/10" and "Urgent" read at a glance. */
  protected readonly metaClass = computed(() => {
    switch (this.state()) {
      case 'done':   return 'text-tertiary';
      case 'urgent': return 'italic text-danger';
      default:       return 'text-on-surface-variant/60';
    }
  });
}
