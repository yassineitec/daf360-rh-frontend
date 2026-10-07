import { Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { AlertCardComponent, MissingDocAlert, ProbationAlert } from '../components/alert-card/alert-card.component';
import { WorkforceStatsComponent } from '../components/workforce-stats/workforce-stats.component';
import { ProfileCompletionComponent } from '../components/profile-completion/profile-completion.component';
import { EngineerProStatsComponent } from '../components/engineer-pro-stats/engineer-pro-stats.component';
import { SeniorityStatsComponent } from '../components/seniority-stats/seniority-stats.component';
import { CountryHeadcount } from '../services/home.service';

/**
 * Home section 2 — the watchlist plus the two headcount/completion cards.
 * On mobile the same figures collapse into one horizontally-scrolling stat strip,
 * because three glass cards stacked vertically push the joiners list off-screen.
 */
@Component({
  selector: 'rh-overview-section',
  standalone: true,
  host: { class: 'block' },
  imports: [TranslatePipe, AlertCardComponent, WorkforceStatsComponent, EngineerProStatsComponent, SeniorityStatsComponent, ProfileCompletionComponent],
  template: `
    <!-- Tablet and up — ONE grid, two shapes, driven by a single col-span.
         md–lg (768–1279): 2 columns. The watchlist spans both, so it gets the full width
                           and the two stat cards sit half-and-half beneath it.
         xl and up:        4 columns. Watchlist spans 2 (½), each stat card takes 1 (¼) —
                           the original three-across row.

         The old markup was 'hidden md:flex' with a nested flex, i.e. ONE layout for every
         width from 768px up: the watchlist took half and the two cards split the other
         half, so at 768px each stat card had ~180px of box and ~130px of content after
         'padding: lg'. That is what squashed the effectif card. A tablet is not a small
         desktop, and this is the tier that was missing rather than a size to shrink into.

         Four stat cards now (Féminin/Masculin, Ing/Pro, Junior/Confirmé/Senior,
         completion), always two per row. At xl the watchlist spans two ROWS, so the
         right half is a 2×2 block and no cell is left empty next to it. -->
    <div class="hidden md:grid gap-6 md:grid-cols-2 xl:grid-cols-4">
      <div class="md:col-span-2 xl:row-span-2">
        <rh-alert-card
          [probationAlerts]="probationAlerts()"
          [probationTotal]="probationTotal()"
          [missingDocsAlerts]="missingDocsAlerts()"
          [missingDocsTotal]="missingDocsTotal()" />
      </div>
      <div class="min-w-0">
        <rh-workforce-stats
          [totalActifs]="totalActifs()"
          [pctFemmes]="pctFemmes()"
          [pctHommes]="pctHommes()"
          [femmes]="femmes()"
          [hommes]="hommes()"
          [byCountry]="byCountry()" />
      </div>
      <div class="min-w-0">
        <rh-engineer-pro-stats
          [total]="ingProTotal()"
          [pctIngenieurs]="pctIngenieurs()"
          [pctPros]="pctPros()"
          [ingenieurs]="ingenieurs()"
          [pros]="pros()" />
      </div>
      <div class="min-w-0">
        <rh-seniority-stats
          [total]="ingProTotal()"
          [pctJuniors]="pctJuniors()"
          [pctConfirmes]="pctConfirmes()"
          [pctSeniors]="pctSeniors()"
          [juniors]="juniors()"
          [confirmes]="confirmes()"
          [seniors]="seniors()" />
      </div>
      <div class="min-w-0">
        <rh-profile-completion
          [tauxGlobalPct]="tauxGlobalPct()"
          [dossiersIncomplets]="dossiersIncomplets()" />
      </div>
    </div>

    <!-- Mobile — stat tiles -->
    <div class="md:hidden rounded-3xl bg-white border border-outline-variant/50 shadow-[0_4px_20px_rgba(0,0,0,0.06)] overflow-hidden">
      <div class="p-4">
        <div class="flex gap-2.5 overflow-x-auto snap-x snap-mandatory -mx-4 px-4 pb-1">
          @for (tile of tiles(); track tile.icon) {
            <div class="shrink-0 snap-start w-26 rounded-2xl p-3 bg-surface-container-lowest flex flex-col items-center text-center gap-1.5">
              <span class="w-9 h-9 rounded-xl flex items-center justify-center bg-teal/10 text-teal">
                <span class="material-symbols-outlined text-[18px]">{{ tile.icon }}</span>
              </span>
              <span class="text-headline-lg font-bold text-on-surface leading-none">{{ tile.value }}</span>
              <p class="text-[10.5px] text-outline leading-tight">{{ tile.labelKey | translate }}</p>
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class OverviewSectionComponent {
  readonly probationAlerts    = input<ProbationAlert[]>([]);
  readonly probationTotal     = input<number>(0);
  readonly missingDocsAlerts  = input<MissingDocAlert[]>([]);
  readonly missingDocsTotal   = input<number>(0);
  readonly totalActifs        = input<number>(0);
  readonly pctFemmes          = input<number | null | undefined>(undefined);
  readonly pctHommes          = input<number | null | undefined>(undefined);
  readonly byCountry          = input<CountryHeadcount[]>([]);
  readonly ingProTotal        = input<number>(0);
  readonly pctIngenieurs      = input<number | null | undefined>(undefined);
  readonly pctPros            = input<number | null | undefined>(undefined);
  readonly pctJuniors         = input<number | null | undefined>(undefined);
  readonly pctConfirmes       = input<number | null | undefined>(undefined);
  readonly pctSeniors         = input<number | null | undefined>(undefined);
  readonly femmes             = input<number | null | undefined>(undefined);
  readonly hommes             = input<number | null | undefined>(undefined);
  readonly ingenieurs         = input<number | null | undefined>(undefined);
  readonly pros               = input<number | null | undefined>(undefined);
  readonly juniors            = input<number | null | undefined>(undefined);
  readonly confirmes          = input<number | null | undefined>(undefined);
  readonly seniors            = input<number | null | undefined>(undefined);
  readonly tauxGlobalPct      = input<number>(0);
  readonly dossiersIncomplets = input<number>(0);

  readonly tiles = computed(() => [
    { icon: 'event_busy',  value: this.probationTotal(),         labelKey: 'HOME.ALERT_CARD.PROBATION_TITLE' },
    { icon: 'description', value: this.missingDocsTotal(),       labelKey: 'HOME.ALERT_CARD.MISSING_DOCS_TITLE' },
    { icon: 'groups',      value: this.totalActifs(),            labelKey: 'HOME.WORKFORCE_STATS.ACTIVE_EMPLOYEES' },
    { icon: 'task_alt',    value: `${this.tauxGlobalPct()}%`,    labelKey: 'HOME.PROFILE_COMPLETION.LABEL' },
  ]);
}
