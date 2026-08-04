import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { StagePanelComponent } from './stage-panel.component';
import { StageView } from '../offboarding-display';

/**
 * Stands in for a stage whose body the current user may not read.
 *
 * Deliberately keeps `rh-stage-panel`, so the numbered title, the icon disc and the state
 * pill are all still there: an IT officer can see that Passation is *done* without being
 * able to read what was handed over. Only the body is withheld. The rail is never gated
 * for the same reason — progress is not confidential, content is.
 */
@Component({
  selector: 'rh-stage-reserved',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StagePanelComponent, TranslatePipe],
  host: { class: 'block' },
  template: `
    <rh-stage-panel [view]="view()">
      <div class="flex flex-col items-center gap-2 rounded-2xl border border-dashed
                  border-outline-variant bg-surface-container-low px-6 py-10 text-center">
        <span class="material-symbols-outlined text-[26px] text-outline">lock</span>
        <p class="m-0 text-[14px] font-bold text-on-surface">
          {{ 'OFFBOARDING.STAGE_RESERVED.TITLE' | translate: { owner: ownerLabel() } }}
        </p>
        <p class="m-0 max-w-md text-[13px] text-on-surface-variant">
          {{ 'OFFBOARDING.STAGE_RESERVED.BODY' | translate: { owner: ownerLabel() } }}
        </p>
      </div>
    </rh-stage-panel>
  `,
})
export class StageReservedComponent {
  readonly view = input.required<StageView>();
  /** Translated owning department, e.g. "le service RH". */
  readonly ownerLabel = input('');
}
