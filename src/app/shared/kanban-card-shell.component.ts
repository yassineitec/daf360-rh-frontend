import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Presentational shell that gives kanban cards the `daf-client-card` shape +
 * interaction (glass surface, hover lift, click affordance) while each kanban
 * keeps its OWN interior content, data and drag process via `<ng-content>`.
 *
 * The glass surface is replicated here (values copied from the lib `.glass-card`)
 * instead of using the global class, because that global rule ships a
 * `:hover { transform }` + `transition: all` combo that fights drag positioning.
 * Owning the styles lets us make the hover lift drag-safe:
 *   - native HTML5 drag (recrutement board): pass `[dragging]` → `.is-dragging`
 *   - Angular CDK drag (pipeline board): `:host-context(.cdk-drop-list-dragging)`
 * In both cases the transform is suppressed and never left transitioning on a
 * moving element, so cards stick to the cursor with no jump/lag.
 */
@Component({
  selector: 'rh-kanban-card-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-content />`,
  host: {
    '[class.surface-glass]': "surface() === 'glass'",
    '[class.surface-flat]': "surface() === 'flat'",
    '[class.surface-white]': "surface() === 'white'",
    '[class.is-dragging]': 'dragging()',
    '[class.accent-urgent]': "accent() === 'urgent'",
    '[class.accent-top]': "accent() === 'top'",
  },
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      position: relative;
      border-radius: 0.75rem;           /* rounded-xl */
      cursor: grab;
      transition: transform 0.3s ease, box-shadow 0.3s ease, background-color 0.3s ease;
    }

    /* ── Glass surface (daf-client-card parity), values copied from lib .glass-card ── */
    :host(.surface-glass) {
      padding: 1.25rem;                 /* p-5 */
      background: rgba(255, 255, 255, 0.8);
      -webkit-backdrop-filter: blur(12px);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.4);
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
    }
    :host(.surface-glass:hover):not(.is-dragging) {
      transform: translateY(-4px) scale(1.02);
      background: rgba(255, 255, 255, 0.95);
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      z-index: 2;
    }

    /* ── Flat surface — fully transparent; only the app background shows ── */
    :host(.surface-flat) {
      padding: 1rem;                    /* p-4 */
      background: transparent;
      border: none;
      box-shadow: none;
    }
    :host(.surface-flat:hover):not(.is-dragging) {
      transform: translateY(-4px) scale(1.02);
      box-shadow: 0 12px 24px -8px rgba(0, 0, 0, 0.12);
      z-index: 2;
    }

    /* ── White surface — daf-card 3D depth on solid white ── */
    :host(.surface-white) {
      padding: 1rem;                    /* p-4 */
      background: #ffffff;
      border: none;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
    }
    :host(.surface-white:hover):not(.is-dragging) {
      transform: translateY(-4px) scale(1.02);
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      z-index: 2;
    }

    /* ── Drag safety (both surfaces) ── */
    /* Native drag (candidates board): the host itself is the drag source. */
    :host(.is-dragging) {
      transform: none;
      transition: none;
    }
    /* CDK drag (if ever used): kill the hover lift + transition lag board-wide. */
    :host-context(.cdk-drop-list-dragging) {
      transition: none;
    }
    :host-context(.cdk-drop-list-dragging):hover {
      transform: none;
      box-shadow: none;
    }

    /* Optional left accent. */
    :host(.accent-urgent) { border-left: 4px solid var(--md-sys-color-error, #B3261E); }
    :host(.accent-top)    { border-left: 4px solid #79D7BE; }
  `],
})
export class KanbanCardShellComponent {
  /** Card surface: 'glass' (daf-client-card look), 'flat' (transparent, app bg only), or 'white' (solid white card). */
  readonly surface = input<'glass' | 'flat' | 'white'>('glass');
  /** True while this card is the active drag source — suppresses the hover lift. */
  readonly dragging = input(false);
  /** Optional left-border accent. */
  readonly accent = input<'urgent' | 'top' | null>(null);
}
