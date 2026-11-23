import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { AccordionCardComponent, AccordionCardOptions, ButtonComponent } from '@khalilrebhiitec/daf360';

export interface NextStepCheck {
  label: string;
  done: boolean;
}

/** What moving on does — the page maps each kind to its call or navigation. */
export type NextStepActionKind =
  'accept' | 'send-offer' | 'offer-accepted' | 'candidate-counter';

export interface NextStepModel {
  /** Material Symbol of the current step. */
  icon: string;
  title: string;
  text: string;
  /** What the step needs before the button unlocks. Empty for a step done elsewhere. */
  checks: NextStepCheck[];
  /** The one way forward, or null when this user has nothing to press (another team's step). */
  action: {
    kind: NextStepActionKind;
    label: string;
    icon: string;
    enabled: boolean;
    /** Shown under a disabled button: what is still missing, in one sentence. */
    blockedHint: string | null;
  } | null;
  /**
   * A second way forward that keeps the step open — the candidate answering an offer with
   * their own figure: the negotiation goes on instead of ending (V133).
   */
  secondary?: { kind: NextStepActionKind; label: string; icon: string } | null;
  /** Said instead of a button when the step is someone else's (IT) or the user lacks the right. */
  waiting: string | null;
  /** The discreet way out — only where the backend allows ending the candidature. */
  end: { label: string } | null;
  done: boolean;
}

/**
 * « Étape actuelle » card of `/rh/candidates/:id`, under the recruitment rail.
 *
 * Replaces the row of header buttons (Accepter / Rejeter / Recruter / Envoyer / Accepter
 * l'offre…), which asked the user to know which one applied when. Here there is ONE
 * button, it always means « passer à l'étape suivante », and it unlocks only once the
 * checklist above it is complete — with a sentence saying what is still missing.
 *
 * Stateless: the page builds the model from the record, the interviews, the offer
 * rounds and the finance decision, and performs the action.
 */
@Component({
  selector: 'rh-candidate-next-step',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AccordionCardComponent, ButtonComponent],
  host: { class: 'block' },
  /*
   * Compact header actions. daf-button's smallest size is 'sm' up to lib 5.16 ('xs' arrives in
   * 5.17.0), and 'sm' still reads as a full-size call to action in a card header. These rules
   * shrink the three buttons in place, whatever lib version is installed; they are unlayered,
   * so they win over the lib's Tailwind utilities without !important. Once every front is on
   * 5.17.0 they can go, in favour of size: 'xs'.
   */
  styles: [`
    .ns-actions ::ng-deep daf-button > button {
      gap: 4px;
      padding: 4px 10px;
      font-size: 11px;
      line-height: 1.2;
    }
    .ns-actions ::ng-deep daf-button > button .material-symbols-outlined {
      font-size: 15px;
      line-height: 1;
    }
  `],
  template: `
    <!-- The lib's stage card. Its HEADER carries the step (title, progress, status pill) AND
         the step's buttons — « Valider… », the counter-proposal, « Mettre fin… » — through
         the [headerAction] slot, so they are on screen whether the card is folded or not.
         Since lib 5.17.0 that slot sits outside the header's toggle button: clicking an
         action never folds or unfolds the card (the stopPropagation below only matters on
         an older lib, where the slot was inside the toggle).

         Static root for the slot: content nested in a control-flow block lives in an
         embedded view the select never matches, and would land in the body instead.

         The BODY (collapsed by default) explains the step: its text, its conditions, what
         still blocks the button (no « Gérer les entretiens / l'offre » link: the tabs are
         right below the card). Forced open while an action
         error is on screen, so the error is never hidden. -->
    <daf-accordion-card
      [options]="accordionOptions()"
      [open]="open() || !!error()"
      (openChange)="open.set($event)">

      <div headerAction class="ns-actions flex flex-wrap items-center justify-end gap-1.5"
           (click)="$event.stopPropagation()">
        @if (model().end; as e) {
          <daf-button
            [options]="{ variant: 'ghost', size: 'sm', iconStart: 'block', label: e.label,
                         disabled: locked() || busy() }"
            (onClick)="end.emit()" />
        }
        @if (model().action; as a) {
          @if (model().secondary; as s) {
            <daf-button
              [options]="{ variant: 'secondary', size: 'sm', iconStart: s.icon, label: s.label,
                           disabled: locked() || busy() }"
              (onClick)="advance.emit(s.kind)" />
          }
          <daf-button
            [options]="{ variant: 'teal', size: 'sm', iconEnd: a.icon, label: a.label,
                         disabled: !a.enabled || locked() || busy(), loading: busy() }"
            (onClick)="advance.emit(a.kind)" />
        } @else if (model().waiting) {
          <span class="inline-flex items-center gap-1.5 rounded-full bg-surface-container px-2.5 py-0.5
                       text-[11px] font-semibold text-on-surface-variant">
            <span class="material-symbols-outlined text-[14px]">hourglass_top</span>
            {{ model().waiting }}
          </span>
        }
      </div>

      <div class="flex flex-col gap-4">
        <p class="text-[13px] leading-relaxed text-on-surface-variant">{{ model().text }}</p>

        @if (model().checks.length) {
          <ul class="flex flex-col gap-1.5 rounded-xl bg-surface-container-low px-4 py-3">
            @for (c of model().checks; track c.label) {
              <li class="flex items-center gap-2 text-[13px]">
                <span class="material-symbols-outlined text-[18px]"
                      [class.text-success]="c.done"
                      [class.text-outline]="!c.done"
                      [style.font-variation-settings]="fill(c.done)">
                  {{ c.done ? 'check_circle' : 'radio_button_unchecked' }}
                </span>
                <span [class.text-on-surface]="c.done" [class.text-on-surface-variant]="!c.done">{{ c.label }}</span>
              </li>
            }
          </ul>
        }

        <!-- Why the header's button is still disabled, in one sentence. -->
        @if (model().action; as a) {
          @if (!a.enabled && a.blockedHint) {
            <p class="flex items-start gap-1.5 text-[12px] text-outline">
              <span class="material-symbols-outlined text-[15px]">lock</span>
              <span class="min-w-0">{{ a.blockedHint }}</span>
            </p>
          }
        }

        @if (error()) {
          <p class="flex items-start gap-1.5 text-[12px] text-danger">
            <span class="material-symbols-outlined text-[15px]">error</span>
            <span class="min-w-0">{{ error() }}</span>
          </p>
        }
      </div>
    </daf-accordion-card>
  `,
})
export class CandidateNextStepComponent {
  private readonly translate = inject(TranslateService);

  readonly model  = input.required<NextStepModel>();

  /**
   * Collapsed by default: the header already says which step the candidature is at, and the
   * buttons sit in that header, so folding the card never hides the way forward.
   */
  protected readonly open = signal(false);

  /**
   * Header of the stage card: the current step as title, « Étape actuelle · 2/3 conditions »
   * (or « Recrutement terminé ») under it, and a pill — EN COURS while something is left,
   * À TRAITER when the step can move on now, TERMINÉ once the recruitment is done.
   */
  protected readonly accordionOptions = computed<AccordionCardOptions>(() => {
    this.translate.currentLang();
    const m = this.model();
    const t = (k: string, p?: Record<string, unknown>) => this.translate.instant('CANDIDATES.NEXT.' + k, p);
    const done = m.checks.filter(c => c.done).length;
    const progress = m.checks.length ? ' · ' + t('ACC_PROGRESS', { done, total: m.checks.length }) : '';
    const ready = !m.done && !!m.action?.enabled;
    return {
      title: m.title,
      subtitle: t(m.done ? 'DONE_LABEL' : 'CURRENT_LABEL') + progress,
      icon: m.icon,
      state: m.done ? 'done' : 'active',
      statusLabel: t(m.done ? 'ACC_DONE' : ready ? 'ACC_READY' : 'ACC_IN_PROGRESS'),
    };
  });
  readonly busy   = input(false);
  readonly error  = input<string | null>(null);
  /** True while the dossier is being edited — every action reloads the record. */
  readonly locked = input(false);

  readonly advance = output<NextStepActionKind>();
  readonly end     = output<void>();

  protected fill(on: boolean): string {
    return on ? "'FILL' 1" : "'FILL' 0";
  }
}
